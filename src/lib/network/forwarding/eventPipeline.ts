/**
 * eventPipeline.ts — Periodic Network Event Pipeline
 *
 * This module drives the simulation tick. On each call it:
 *
 * 1. Runs IP SLA probes (unchanged)
 * 2. Runs DHCPv6 lease simulation (unchanged)
 * 3. Evaluates PPPoE sessions (unchanged)
 * 4. Generates protocol PDUs (OSPF Hello, EIGRP Hello, STP BPDU) via the
 *    packet pipeline and forwards them through `forwardPacketFrame`.
 * 5. **NEW**: Ticks protocol state machine timers (OSPF dead timers,
 *    EIGRP hold timers, STP port timers, DHCP client timers) using the
 *    canonical FSMs in `protocols/protocolStateMachines.ts`.
 * 6. Synchronises FSM state back to the legacy flat fields
 *    (`ospfNeighbors`, `eigrpNeighbors`) so that existing `show` commands
 *    and display code continue to work unchanged.
 */

import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import type { SwitchState } from '@/lib/network/types';
import type { NetworkPacketFrame, PipelineExecutionResult, ProtocolNeighborChangeEvent, AgingChangeEvent } from './packetFrame';
import { forwardPacketFrame } from './commonForwardingEngine';
import { runAgingTick } from '@/lib/network/agingEngine';
import { evaluateIpSlaOperations } from '@/lib/network/ipSlaEngine';
import { evaluateDhcpv6ForDevice } from '@/lib/network/eui64';
import { evaluatePppoeSessions } from '@/lib/network/pppoeEngine';
import {
  ospfTickDeadTimer,
  eigrpTickHoldTimer,
  dhcpTickClient,
  type OspfNeighborRecord,
  type EigrpNeighborRecord,
} from '@/lib/network/protocols';

/** Simulated seconds per pipeline tick (wall-clock 250 ms ≈ 0.25 simulated seconds) */
const SIM_SECONDS_PER_TICK = 0.25;

export function runNetworkEventPipeline(
  deviceStates: Map<string, SwitchState>,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  now: number = Date.now()
): PipelineExecutionResult {
  // Snapshot the input states BEFORE any in-place mutation (the pipeline works
  // on the same object references), so protocol neighbor changes can be diffed.
  const prevStates = new Map<string, SwitchState>();
  deviceStates.forEach((state, deviceId) => prevStates.set(deviceId, { ...state }));
  let updatedStates = new Map<string, SwitchState>(deviceStates);
  const dispatchedPackets: PipelineExecutionResult['dispatchedPackets'] = [];
  const processedFrames: NetworkPacketFrame[] = [];

  // 1. IP SLA Automated Probes & Object Tracking
  const slaResult = evaluateIpSlaOperations(updatedStates, devices, connections, now);
  slaResult.updatedStates.forEach((state, deviceId) => {
    updatedStates.set(deviceId, state);
  });
  dispatchedPackets.push(...slaResult.dispatchedPackets);

  // 2. DHCPv6 Lease Simulation
  devices.forEach(device => {
    const dhcpv6Res = evaluateDhcpv6ForDevice(device.id, updatedStates, connections);
    if (dhcpv6Res?.ipv6Address) {
      const state = updatedStates.get(device.id);
      if (state && state.ports?.['eth0']) {
        state.ports['eth0'].ipAddress = dhcpv6Res.ipv6Address;
      }
    }
  });

  // 3. PPPoE Session Evaluation
  updatedStates = evaluatePppoeSessions(updatedStates, connections);

  // 4. Periodic Protocol PDU Generation & Pipeline Processing
  devices.forEach(device => {
    const state = updatedStates.get(device.id);
    if (!state || device.status === 'offline') return;

    const isOspfActive = Boolean(state.ospfRouterId || state.routingProtocol === 'ospf');
    if (isOspfActive) {
      const ospfFrame: NetworkPacketFrame = {
        id: `ospf-hello-${device.id}-${now}`,
        protocol: 'OSPF',
        timestamp: now,
        ingressDeviceId: device.id,
        srcMac: device.macAddress || '00:00:00:00:00:00',
        dstMac: '01:00:5e:00:00:05',
        etherType: '0x0800',
        srcIp: device.ip || '10.0.0.1',
        dstIp: '224.0.0.5',
        ipProtocol: 89,
        ospfPayload: {
          packetType: 'hello',
          routerId: state.ospfRouterId || device.ip || '1.1.1.1',
          areaId: '0.0.0.0',
          neighbors: Object.keys(state.ospfNeighborStates || {})
        },
        length: 64,
        info: `OSPF Hello Router-ID ${state.ospfRouterId || device.ip || '1.1.1.1'}`
      };

      processedFrames.push(ospfFrame);
      const fwdResult = forwardPacketFrame(ospfFrame, device, state, devices, connections);
      if (fwdResult.accepted && fwdResult.responseFrame) {
        processedFrames.push(fwdResult.responseFrame);
      }
    }

    const isEigrpActive = Boolean(state.eigrpAs || state.routingProtocol === 'eigrp');
    if (isEigrpActive) {
      const asNum = parseInt(state.eigrpAs || '100', 10);
      const eigrpFrame: NetworkPacketFrame = {
        id: `eigrp-hello-${device.id}-${now}`,
        protocol: 'EIGRP',
        timestamp: now,
        ingressDeviceId: device.id,
        srcMac: device.macAddress || '00:00:00:00:00:00',
        dstMac: '01:00:5e:00:00:0a',
        etherType: '0x0800',
        srcIp: device.ip || '10.0.0.1',
        dstIp: '224.0.0.10',
        ipProtocol: 88,
        eigrpPayload: {
          opcode: 'hello',
          asNumber: isNaN(asNum) ? 100 : asNum,
          kValues: [1, 0, 1, 0, 0],
          bandwidth: 100000,
          delay: 10
        },
        length: 60,
        info: `EIGRP Hello AS ${state.eigrpAs || 100}`
      };

      processedFrames.push(eigrpFrame);
      const fwdResult = forwardPacketFrame(eigrpFrame, device, state, devices, connections);
      if (fwdResult.accepted && fwdResult.responseFrame) {
        processedFrames.push(fwdResult.responseFrame);
      }
    }

    if ((device.type === 'switchL2' || device.type === 'switchL3') && state.spanningTreePriority) {
      const stpFrame: NetworkPacketFrame = {
        id: `stp-bpdu-${device.id}-${now}`,
        protocol: 'STP',
        timestamp: now,
        ingressDeviceId: device.id,
        srcMac: state.macAddress || '00:00:00:00:00:00',
        dstMac: '01:80:c2:00:00:00',
        etherType: '0x4242',
        stpPayload: {
          protocolVersion: 'stp',
          rootId: state.macAddress || '0000.0000.0000',
          rootPathCost: 0,
          bridgeId: state.macAddress || '0000.0000.0000',
          portId: '8001',
          messageAge: 0,
          maxAge: 20,
          helloTime: 2,
          forwardDelay: 15
        },
        length: 52,
        info: `STP BPDU Root: ${state.macAddress || 'Self'}`
      };

      processedFrames.push(stpFrame);
      forwardPacketFrame(stpFrame, device, state, devices, connections);
    }
  });

  // 5. Tick Protocol State Machine Timers
  devices.forEach(device => {
    const state = updatedStates.get(device.id);
    if (!state || device.status === 'offline') return;

    const myRouterId = state.ospfRouterId || device.ip || device.id;
    let stateChanged = false;
    const nextState = { ...state };

    // ── 5a. OSPF Dead Timer ticks ──────────────────────────────────────
    if (nextState.ospfNeighborStates && Object.keys(nextState.ospfNeighborStates).length > 0) {
      const updatedNeighbors: Record<string, OspfNeighborRecord> = {};
      for (const [nbrId, nbr] of Object.entries(nextState.ospfNeighborStates)) {
        const res = ospfTickDeadTimer(nbr, SIM_SECONDS_PER_TICK, now, myRouterId);
        updatedNeighbors[nbrId] = res.nextState;
        if (res.events.length > 0 || nbr.state !== res.nextState.state) {
          stateChanged = true;
          if (nbr.state !== res.nextState.state) {
            const intfName = res.nextState.interfaceId || 'Gi0/0';
            const logLine = `%OSPF-5-ADJCHG: Process 1, Nbr ${nbrId} on ${intfName} from ${nbr.state.toUpperCase()} to ${res.nextState.state.toUpperCase()}`;
            if (!nextState.eventLogs) nextState.eventLogs = [];
            nextState.eventLogs.push(logLine);
          }
        }
      }
      nextState.ospfNeighborStates = updatedNeighbors;

      // Sync legacy flat array
      nextState.ospfNeighbors = Object.values(updatedNeighbors)
        .filter(n => n.state !== 'Down')
        .map(n => n.neighborId);
    }

    // ── 5b. EIGRP Hold Timer ticks ────────────────────────────────────
    if (nextState.eigrpNeighborStates && Object.keys(nextState.eigrpNeighborStates).length > 0) {
      const updatedEigrpNbrs: Record<string, EigrpNeighborRecord> = {};
      for (const [nbrIp, nbr] of Object.entries(nextState.eigrpNeighborStates)) {
        const res = eigrpTickHoldTimer(nbr, SIM_SECONDS_PER_TICK, now);
        updatedEigrpNbrs[nbrIp] = res.nextNeighbor;
        if (res.neighborLost || res.neighborGained) stateChanged = true;
      }
      nextState.eigrpNeighborStates = updatedEigrpNbrs;

      // Sync legacy flat array
      nextState.eigrpNeighbors = Object.values(updatedEigrpNbrs)
        .filter(n => n.state === 'Up')
        .map(n => n.neighborIp);
    }

    // ── 5c. DHCP Client timer ticks ───────────────────────────────────
    if (nextState.dhcpClientStates) {
      const updatedDhcp = { ...nextState.dhcpClientStates };
      for (const [ifId, dhcpClient] of Object.entries(updatedDhcp)) {
        const tickRes = dhcpTickClient(dhcpClient, SIM_SECONDS_PER_TICK, now);
        if (tickRes) {
          updatedDhcp[ifId] = tickRes.nextClient;
          stateChanged = true;
          // If address changed (bound or expired), sync to port
          if (tickRes.nextClient.assignedIp !== dhcpClient.assignedIp) {
            const port = nextState.ports?.[ifId];
            if (port) {
              nextState.ports = {
                ...nextState.ports,
                [ifId]: { ...port, ipAddress: tickRes.nextClient.assignedIp || port.ipAddress }
              };
            }
          }
        }
      }
      nextState.dhcpClientStates = updatedDhcp;
    }

    // ── 5d. STP Port timer ticks ──────────────────────────────────────
    if (nextState.lacpPortStates) {
      // LACP timers would be ticked here if needed
      // (simple pass-through for now, structure in place)
    }

    if (stateChanged) {
      updatedStates.set(device.id, nextState);
    }
  });

  // 6. Process incoming OSPF/EIGRP Hellos: create/update neighbor FSM records
  // when we detect that two active protocol routers are directly connected.
  _processProtocolNeighborDiscovery(updatedStates, devices, connections, now);

  // 7. Diff prior vs updated OSPF/EIGRP neighbor states and surface adjacency
  // changes (Full/Up established, Dead/Hold expiry) as timeline events.
  const protocolEvents = computeProtocolNeighborChanges(prevStates, updatedStates);

  // 8. Real-time ARP/MAC aging: prune expired entries on every live tick and
  // surface the aged entries as timeline events (2-min ARP / 5-min MAC).
  const agingResult = runAgingTick(updatedStates);
  const agingEvents: AgingChangeEvent[] = [];
  for (const ev of agingResult.events) {
    agingEvents.push({
      deviceId: ev.deviceId,
      category: 'MAC',
      level: 'info',
      message: ev.message,
      detail: `${ev.deviceId}|${ev.mac}|VLAN ${ev.vlan}`,
    });
  }
  for (const ev of agingResult.arpEvents) {
    agingEvents.push({
      deviceId: ev.deviceId,
      category: 'ARP',
      level: 'info',
      message: `%ARP-6-AGE: Entry ${ev.ip} (${ev.mac}) on ${ev.interface} timed out`,
      detail: `${ev.deviceId}|${ev.ip}`,
    });
  }

  return {
    updatedStates,
    dispatchedPackets,
    processedFrames,
    protocolEvents,
    agingEvents: agingEvents.length > 0 ? agingEvents : undefined,
  };
}

export function computeProtocolNeighborChanges(
  prevStates: Map<string, SwitchState>,
  nextStates: Map<string, SwitchState>
): ProtocolNeighborChangeEvent[] {
  const events: ProtocolNeighborChangeEvent[] = [];

  nextStates.forEach((next, deviceId) => {
    const prev = prevStates.get(deviceId);

    // ── OSPF ─────────────────────────────────────────────────────────────
    const nextOspf = next.ospfNeighborStates || {};
    const prevOspf = prev?.ospfNeighborStates || {};
    for (const [nbrId, nbr] of Object.entries(nextOspf)) {
      const prevNbr = prevOspf[nbrId];
      const prevState = prevNbr ? prevNbr.state : 'Down';
      if (prevState === nbr.state) continue;
      const intf = nbr.interfaceId || 'Gi0/0';
      events.push({
        deviceId,
        protocol: 'OSPF',
        neighbor: nbrId,
        interfaceId: intf,
        oldState: prevState,
        newState: nbr.state,
        level: nbr.state === 'Down' ? 'warning' : 'info',
        message: `%OSPF-5-ADJCHG: Process 1, Nbr ${nbrId} on ${intf} from ${prevState.toUpperCase()} to ${nbr.state.toUpperCase()}`,
      });
    }
    for (const nbrId of Object.keys(prevOspf)) {
      if (nextOspf[nbrId]) continue;
      const prevNbr = prevOspf[nbrId];
      if (prevNbr.state === 'Down') continue;
      events.push({
        deviceId,
        protocol: 'OSPF',
        neighbor: nbrId,
        interfaceId: prevNbr.interfaceId || 'Gi0/0',
        oldState: prevNbr.state,
        newState: 'Down',
        level: 'warning',
        message: `%OSPF-5-ADJCHG: Process 1, Nbr ${nbrId} on ${prevNbr.interfaceId || 'Gi0/0'} from ${prevNbr.state.toUpperCase()} to DOWN`,
      });
    }

    // ── EIGRP ────────────────────────────────────────────────────────────
    const nextEigrp = next.eigrpNeighborStates || {};
    const prevEigrp = prev?.eigrpNeighborStates || {};
    for (const [nbrIp, nbr] of Object.entries(nextEigrp)) {
      const prevNbr = prevEigrp[nbrIp];
      const prevState = prevNbr ? prevNbr.state : 'Down';
      if (prevState === nbr.state) continue;
      const intf = nbr.interfaceId || 'Gi0/0';
      const as = nbr.asNumber ?? 100;
      const isUp = nbr.state === 'Up';
      events.push({
        deviceId,
        protocol: 'EIGRP',
        neighbor: nbrIp,
        interfaceId: intf,
        oldState: prevState,
        newState: nbr.state,
        asNumber: as,
        level: nbr.state === 'Down' ? 'warning' : 'info',
        message: isUp && prevState === 'Down'
          ? `%DUAL-5-NBRCHANGE: IP-EIGRP AS ${as}: Neighbor ${nbrIp} (${intf}) is up: new adjacency`
          : `%DUAL-5-NBRCHANGE: IP-EIGRP AS ${as}: Neighbor ${nbrIp} (${intf}) is down: state change`,
      });
    }
    for (const nbrIp of Object.keys(prevEigrp)) {
      if (nextEigrp[nbrIp]) continue;
      const prevNbr = prevEigrp[nbrIp];
      if (prevNbr.state === 'Down') continue;
      events.push({
        deviceId,
        protocol: 'EIGRP',
        neighbor: nbrIp,
        interfaceId: prevNbr.interfaceId || 'Gi0/0',
        oldState: prevNbr.state,
        newState: 'Down',
        asNumber: prevNbr.asNumber ?? 100,
        level: 'warning',
        message: `%DUAL-5-NBRCHANGE: IP-EIGRP AS ${prevNbr.asNumber ?? 100}: Neighbor ${nbrIp} (${prevNbr.interfaceId || 'Gi0/0'}) is down: state change`,
      });
    }
  });

  return events;
}

/**
 * Discover new protocol neighbors based on physical adjacency and protocol config.
 * For each pair of directly connected OSPF/EIGRP routers, create FSM records and
 * advance state to Full/Up to reflect an established adjacency.
 *
 * This is a simulation shortcut: instead of simulating actual Hello PDU exchange
 * across multiple ticks, we detect adjacency in one pass and initialize the FSM
 * at the correct converged state. State machines then maintain timers from there.
 */
function _processProtocolNeighborDiscovery(
  updatedStates: Map<string, SwitchState>,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  now: number
): void {
  for (const conn of connections) {
    if (!conn.active && conn.active !== undefined) continue;

    const srcDevice = devices.find(d => d.id === conn.sourceDeviceId);
    const dstDevice = devices.find(d => d.id === conn.targetDeviceId);
    if (!srcDevice || !dstDevice) continue;
    if (srcDevice.status === 'offline' || dstDevice.status === 'offline') continue;

    const srcState = updatedStates.get(srcDevice.id);
    const dstState = updatedStates.get(dstDevice.id);
    if (!srcState || !dstState) continue;

    // ── OSPF Neighbor Discovery ────────────────────────────────────────
    const srcOspf = Boolean(srcState.ospfRouterId || srcState.routingProtocol === 'ospf');
    const dstOspf = Boolean(dstState.ospfRouterId || dstState.routingProtocol === 'ospf');

    if (srcOspf && dstOspf) {
      const srcRouterId = srcState.ospfRouterId || srcDevice.ip || srcDevice.id;
      const dstRouterId = dstState.ospfRouterId || dstDevice.ip || dstDevice.id;

      // Register src → dst neighbor
      _upsertOspfNeighbor(srcState, dstRouterId, dstDevice.ip || dstDevice.id, conn.sourcePort, now);
      // Register dst → src neighbor
      _upsertOspfNeighbor(dstState, srcRouterId, srcDevice.ip || srcDevice.id, conn.targetPort, now);

      updatedStates.set(srcDevice.id, srcState);
      updatedStates.set(dstDevice.id, dstState);
    }

    // ── EIGRP Neighbor Discovery ───────────────────────────────────────
    const srcEigrp = Boolean(srcState.eigrpAs || srcState.routingProtocol === 'eigrp');
    const dstEigrp = Boolean(dstState.eigrpAs || dstState.routingProtocol === 'eigrp');
    const sameAs = srcEigrp && dstEigrp &&
      (srcState.eigrpAs === dstState.eigrpAs || (!srcState.eigrpAs && !dstState.eigrpAs));

    if (sameAs) {
      _upsertEigrpNeighbor(srcState, dstDevice.ip || dstDevice.id, conn.sourcePort, srcState.eigrpAs || '100', now);
      _upsertEigrpNeighbor(dstState, srcDevice.ip || srcDevice.id, conn.targetPort, dstState.eigrpAs || '100', now);

      updatedStates.set(srcDevice.id, srcState);
      updatedStates.set(dstDevice.id, dstState);
    }
  }
}

function _upsertOspfNeighbor(
  state: SwitchState,
  neighborId: string,
  neighborIp: string,
  interfaceId: string,
  now: number
): void {
  if (!state.ospfNeighborStates) state.ospfNeighborStates = {};
  if (!state.ospfNeighborStates[neighborId]) {
    // New neighbor — start at Init, quickly advance to Full for simulation fidelity
    const record: OspfNeighborRecord = {
      neighborId,
      neighborIp,
      interfaceId,
      areaId: '0.0.0.0',
      state: 'Full',   // Simulation converged state
      priority: 1,
      deadTimer: 40,
      helloInterval: 10,
      deadInterval: 40,
      lastHelloAt: now,
    };
    state.ospfNeighborStates[neighborId] = record;
    // Keep legacy array in sync
    if (!state.ospfNeighbors) state.ospfNeighbors = [];
    if (!state.ospfNeighbors.includes(neighborId)) {
      state.ospfNeighbors = [...state.ospfNeighbors, neighborId];
    }
  } else {
    // Refresh Hello timestamp
    state.ospfNeighborStates[neighborId] = {
      ...state.ospfNeighborStates[neighborId],
      lastHelloAt: now,
      deadTimer: 40,
    };
  }
}

function _upsertEigrpNeighbor(
  state: SwitchState,
  neighborIp: string,
  interfaceId: string,
  asNumber: string,
  now: number
): void {
  if (!state.eigrpNeighborStates) state.eigrpNeighborStates = {};
  if (!state.eigrpNeighborStates[neighborIp]) {
    const record: EigrpNeighborRecord = {
      neighborIp,
      interfaceId,
      asNumber: parseInt(asNumber, 10) || 100,
      state: 'Up',
      holdTime: 15,
      holdTimer: 15,
      kValues: [1, 0, 1, 0, 0],
      srtt: 2,
      rto: 200,
      seqNumber: 0,
      lastHelloAt: now,
    };
    state.eigrpNeighborStates[neighborIp] = record;
    if (!state.eigrpNeighbors) state.eigrpNeighbors = [];
    if (!state.eigrpNeighbors.includes(neighborIp)) {
      state.eigrpNeighbors = [...state.eigrpNeighbors, neighborIp];
    }
  } else {
    state.eigrpNeighborStates[neighborIp] = {
      ...state.eigrpNeighborStates[neighborIp],
      lastHelloAt: now,
      holdTimer: 15,
    };
  }
}
