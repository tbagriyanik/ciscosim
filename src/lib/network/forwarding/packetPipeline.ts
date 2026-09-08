/**
 * packetPipeline.ts — Unified Packet Processing Pipeline
 *
 * Implements the single canonical packet forwarding chain:
 *
 *   Ingress
 *     → L1 Physical Check (shutdown, link status)
 *     → Port Security
 *     → DHCP Snooping (untrusted port drops non-DHCP)
 *     → STP Port State (Discarding/Blocking ports drop data frames)
 *     → VLAN Check (access VLAN match / trunk allowed-VLAN)
 *     → ACL Ingress (ip access-group <name> in)
 *     → ARP Resolution (if next-hop MAC unknown)
 *     → MAC Lookup (L2) / Route Lookup (L3)
 *     → ACL Egress (ip access-group <name> out)
 *     → QoS Scheduling
 *     → Egress Port
 *     → Packet Capture Recording
 *
 * Each stage produces a `PacketTrace` entry; all traces are returned
 * in `PipelineResult` so the UI can display exactly what happened at
 * each hop.
 *
 * This pipeline is composable: callers (pathResolution, eventPipeline)
 * can invoke `runHopPipeline()` per hop, or `runFullPacketPipeline()`
 * to traverse the entire path from source to destination.
 */

import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import type { SwitchState, Port } from '@/lib/network/types';
import type { NetworkPacketFrame } from './packetFrame';
import { checkIngressSanity, processControlPlaneProtocols } from './commonForwardingEngine';
import { evaluateAcl } from '@/lib/network/connectivity/acl';
import { learnMacAddress } from '@/lib/network/macLearning';
import { getRoutingTable, findRouteDetailed } from '@/lib/network/routing';
import { dispatchCapturedPackets } from '@/utils/packetCapture';
import { buildConnectionIndex } from '@/lib/network/connectionIndex';
import { generateIcmpUnreachable } from './icmpUtils';
import { DropReasonCode, formatDropReason } from './dropReasons';

// ─────────────────────────────────────────────
// Pipeline Trace Types
// ─────────────────────────────────────────────

export type PipelineStage =
  | 'ingress-l1'
  | 'port-security'
  | 'dhcp-snooping'
  | 'stp-state'
  | 'vlan-check'
  | 'acl-ingress'
  | 'control-plane'
  | 'arp-resolution'
  | 'mac-lookup'
  | 'route-lookup'
  | 'acl-egress'
  | 'qos'
  | 'egress'
  | 'capture';

export type PipelineAction = 'pass' | 'drop' | 'trap' | 'flood' | 'forward' | 'skip';

export interface PacketTrace {
  hopIndex: number;
  deviceId: string;
  deviceName: string;
  portId: string;
  stage: PipelineStage;
  action: PipelineAction;
  reason: string;
  /** Snapshot of the frame state at this stage */
  frameSnapshot: Readonly<NetworkPacketFrame>;
}

export interface HopResult {
  deviceId: string;
  accepted: boolean;
  trapToControlPlane: boolean;
  egressPorts: string[];
  nextDeviceId?: string;
  responseFrame?: NetworkPacketFrame;
  /** All pipeline stage traces for this hop */
  traces: PacketTrace[];
}

export interface PipelineResult {
  success: boolean;
  hopResults: HopResult[];
  /** Flat list of all traces across all hops */
  allTraces: PacketTrace[];
  capturedOnLinks: string[];
  finalFrame?: NetworkPacketFrame;
  dropReason?: string;
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function makeTrace(
  hopIndex: number,
  device: CanvasDevice,
  portId: string,
  stage: PipelineStage,
  action: PipelineAction,
  reason: string,
  frame: NetworkPacketFrame
): PacketTrace {
  return {
    hopIndex,
    deviceId: device.id,
    deviceName: device.name,
    portId,
    stage,
    action,
    reason,
    frameSnapshot: Object.freeze({ ...frame }),
  };
}

/**
 * Check if a VLAN is allowed through a port.
 * - Access port: frame.vlanId must match port.vlan (or 1 for untagged)
 * - Trunk port: frame.vlanId must be in port.allowedVlans (or 'all')
 */
function checkVlan(port: Port, frame: NetworkPacketFrame): { allowed: boolean; reason: string } {
  const fvlan = frame.vlanId ?? 1;

  if (port.mode === 'trunk') {
    if (port.allowedVlans === 'all') {
      return { allowed: true, reason: `Trunk allows all VLANs (frame VLAN ${fvlan})` };
    }
    const allowed = Array.isArray(port.allowedVlans) && port.allowedVlans.includes(fvlan);
    return {
      allowed,
      reason: allowed
        ? `Trunk: VLAN ${fvlan} allowed`
        : `Trunk: VLAN ${fvlan} not in allowed-vlans`
    };
  }

  // Access port — tag or native VLAN must match
  const portVlan = port.accessVlan ?? port.vlan ?? 1;
  const allowed = fvlan === portVlan || fvlan === 1;
  return {
    allowed,
    reason: allowed
      ? `Access port VLAN ${portVlan} OK`
      : `VLAN mismatch: frame VLAN ${fvlan} ≠ access VLAN ${portVlan}`
  };
}

function updatePortStats(port: Port | undefined, type: 'rx' | 'tx' | 'drop', bytes: number = 64): void {
  if (!port) return;
  if (!port.stats) {
    port.stats = { rxPackets: 0, rxBytes: 0, txPackets: 0, txBytes: 0, rxDrops: 0, txDrops: 0, rxErrors: 0, txErrors: 0 };
  }
  const s = port.stats;
  if (type === 'rx') {
    s.rxPackets = (s.rxPackets ?? 0) + 1;
    s.rxBytes = (s.rxBytes ?? 0) + bytes;
  } else if (type === 'tx') {
    s.txPackets = (s.txPackets ?? 0) + 1;
    s.txBytes = (s.txBytes ?? 0) + bytes;
  } else if (type === 'drop') {
    s.rxDrops = (s.rxDrops ?? 0) + 1;
  }
}

/**
 * Determine egress ports for a frame on a device.
 * Returns port IDs, next-hop device ID, and route decision details if applicable.
 */
function resolveEgress(
  frame: NetworkPacketFrame,
  device: CanvasDevice,
  state: SwitchState,
  connections: CanvasConnection[],
  deviceMap: Map<string, CanvasDevice>
): { egressPorts: string[]; nextDeviceId?: string; routeDecision?: string } {
  const egressPorts: string[] = [];
  let nextDeviceId: string | undefined;
  let routeDecision: string | undefined;
  const connectionIndex = buildConnectionIndex(connections);

  if (device.type === 'switchL2' || device.type === 'switchL3' || device.type === 'hub') {
    if (device.type === 'hub' || frame.dstMac === 'ff:ff:ff:ff:ff:ff' || !frame.dstMac) {
      // Flood to all active ports except ingress
      Object.values(state.ports || {}).forEach(p => {
        if (p.id !== frame.ingressPortId && !p.shutdown && p.status === 'connected') {
          egressPorts.push(p.id);
        }
      });
      routeDecision = 'L2 Broadcast/Multicast — Flooding frame to all active ports';
    } else {
      const match = state.macAddressTable?.find(m => m.mac.toLowerCase() === frame.dstMac?.toLowerCase());
      if (match?.port && match.port !== frame.ingressPortId) {
        egressPorts.push(match.port);
        routeDecision = `L2 Unicast match: MAC ${frame.dstMac} learned on port ${match.port} (VLAN ${match.vlan})`;
        const conn = connectionIndex.byPort.get(`${device.id}:${match.port}`);
        if (conn) {
          nextDeviceId = conn.sourceDeviceId === device.id ? conn.targetDeviceId : conn.sourceDeviceId;
        }
      } else {
        // Unicast miss — flood
        Object.values(state.ports || {}).forEach(p => {
          if (p.id !== frame.ingressPortId && !p.shutdown && p.status === 'connected') {
            egressPorts.push(p.id);
          }
        });
        routeDecision = `L2 Unicast miss for MAC ${frame.dstMac} — Flooding frame across VLAN ${frame.vlanId || 1}`;
      }
    }
  } else if (device.type === 'router' || device.type === 'firewall') {
    if (frame.dstIp) {
      const deviceMap2 = new Map<string, SwitchState>([[device.id, state]]);
      const table = getRoutingTable(device.id, deviceMap2);
      const detailed = findRouteDetailed(frame.dstIp, table);
      if (detailed && (detailed.route.interfaceId || detailed.route.nextHop)) {
        const portId = detailed.route.interfaceId || detailed.route.nextHop;
        egressPorts.push(portId);
        routeDecision = detailed.explanation;
        const conn = connectionIndex.byPort.get(`${device.id}:${portId}`);
        if (conn) {
          nextDeviceId = conn.sourceDeviceId === device.id ? conn.targetDeviceId : conn.sourceDeviceId;
          if (nextDeviceId) {
            const nextDevice = deviceMap.get(nextDeviceId);
            if (!nextDevice) nextDeviceId = undefined;
          }
        }
      }
    }
  } else if (device.type === 'cloud') {
    (device.ports || []).forEach(p => {
      if (p.id !== frame.ingressPortId && p.status === 'connected') {
        egressPorts.push(p.id);
      }
    });
    routeDecision = 'Cloud hub forwarding to attached interfaces';
  }

  return { egressPorts, nextDeviceId, routeDecision };
}

// ─────────────────────────────────────────────
// Core: Per-Hop Pipeline
// ─────────────────────────────────────────────

/**
 * Run the full pipeline for a single hop (one device).
 *
 * @param hopIndex  Position in the path (0 = source, 1 = first intermediate, …)
 * @param frame     The packet frame arriving at this device
 * @param device    The CanvasDevice for this hop
 * @param state     The SwitchState for this hop
 * @param devices   All devices in topology (for next-hop resolution)
 * @param connections All connections in topology
 * @param now       Current timestamp (ms)
 */
export function runHopPipeline(
  hopIndex: number,
  frame: NetworkPacketFrame,
  device: CanvasDevice,
  state: SwitchState | undefined,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  now: number = Date.now()
): HopResult {
  const traces: PacketTrace[] = [];
  const ingressPortId = frame.ingressPortId || '';
  const ingressPort: Port | undefined = state?.ports?.[ingressPortId];
  const deviceMap = new Map<string, CanvasDevice>(devices.map(d => [d.id, d]));

  // Count ingress packet
  if (ingressPort) updatePortStats(ingressPort, 'rx', frame.length || 64);

  const drop = (stage: PipelineStage, reason: string, icmpCode?: number, isUnreachable = true): HopResult => {
    if (ingressPort) updatePortStats(ingressPort, 'drop');
    traces.push(makeTrace(hopIndex, device, ingressPortId, stage, 'drop', reason, frame));

    let responseFrame: NetworkPacketFrame | undefined;
    if (frame.srcIp && frame.protocol !== 'ICMP') {
      const type = isUnreachable ? 'destination-unreachable' : 'time-exceeded';
      const reportingIp = ingressPort?.ipAddress || state?.ports?.['Fa0/0']?.ipAddress || state?.ports?.['Gi0/0']?.ipAddress;
      responseFrame = generateIcmpUnreachable(frame, type, reason, icmpCode ?? 0, reportingIp);
    }

    return {
      deviceId: device.id,
      accepted: false,
      trapToControlPlane: false,
      egressPorts: [],
      responseFrame,
      traces
    };
  };

  // ── Stage 1: L1 Physical / Ingress Sanity ─────────────────────────────
  const l1 = checkIngressSanity(frame, device, state, ingressPort);
  if (!l1.allowed) return drop('ingress-l1', formatDropReason(DropReasonCode.L1_PORT_SHUTDOWN, l1.reason));
  traces.push(makeTrace(hopIndex, device, ingressPortId, 'ingress-l1', 'pass', l1.reason, frame));

  // ── Stage 2: Port Security ─────────────────────────────────────────────
  if (ingressPort?.portSecurity?.enabled && ingressPort.portSecurity.macAddress) {
    if (ingressPort.portSecurity.macAddress !== frame.srcMac) {
      return drop('port-security', formatDropReason(DropReasonCode.L2_PORT_SECURITY_VIOLATION, `unexpected MAC ${frame.srcMac}`));
    }
  }
  traces.push(makeTrace(hopIndex, device, ingressPortId, 'port-security', 'pass', 'Port security OK', frame));

  // ── Stage 3: DHCP Snooping ─────────────────────────────────────────────
  if (state?.dhcpSnoopingEnabled && !ingressPort?.dhcpSnoopingTrust) {
    const isDhcpServer = frame.protocol === 'DHCP' && frame.dhcpPayload &&
      (frame.dhcpPayload.messageType === 'offer' || frame.dhcpPayload.messageType === 'ack');
    if (isDhcpServer) {
      return drop('dhcp-snooping', formatDropReason(DropReasonCode.DHCP_SNOOPING_UNTRUSTED_SERVER, `on port ${ingressPortId}`));
    }
  }
  traces.push(makeTrace(hopIndex, device, ingressPortId, 'dhcp-snooping', 'pass', 'DHCP snooping OK', frame));

  // ── Stage 4: STP Port State ────────────────────────────────────────────
  if (frame.protocol !== 'STP') {
    const stpState = ingressPort?.spanningTree?.state;
    if (stpState === 'blocking' || stpState === 'listening') {
      return drop('stp-state', formatDropReason(DropReasonCode.L2_STP_BLOCKED, `port ${ingressPortId} in ${stpState} state`));
    }
  }
  traces.push(makeTrace(hopIndex, device, ingressPortId, 'stp-state', 'pass', 'STP port forwarding/disabled for STP frames', frame));

  // ── Stage 5: VLAN Check ────────────────────────────────────────────────
  if (ingressPort && (device.type === 'switchL2' || device.type === 'switchL3')) {
    const vlanCheck = checkVlan(ingressPort, frame);
    if (!vlanCheck.allowed) return drop('vlan-check', formatDropReason(DropReasonCode.L2_VLAN_MISMATCH, vlanCheck.reason));
    traces.push(makeTrace(hopIndex, device, ingressPortId, 'vlan-check', 'pass', vlanCheck.reason, frame));
  } else {
    traces.push(makeTrace(hopIndex, device, ingressPortId, 'vlan-check', 'skip', 'Not a switch — VLAN check skipped', frame));
  }

  // ── Stage 6: ACL Ingress ──────────────────────────────────────────────
  if (ingressPort?.accessGroupIn && state && frame.srcIp && frame.dstIp) {
    const aclResult = evaluateAcl(
      ingressPort.accessGroupIn, state,
      frame.srcIp, frame.dstIp,
      frame.ipProtocol === 6 ? 'tcp' : frame.ipProtocol === 17 ? 'udp' : 'icmp'
    );
    if (aclResult === 'deny') {
      return drop('acl-ingress', formatDropReason(DropReasonCode.ACL_DENY_INGRESS, `ACL ${ingressPort.accessGroupIn} denied ${frame.srcIp}→${frame.dstIp}`), 13);
    }
    traces.push(makeTrace(hopIndex, device, ingressPortId, 'acl-ingress', 'pass',
      `ACL ${ingressPort.accessGroupIn} (in) ${aclResult === 'none' ? 'implicit permit' : 'permit'}`, frame));
  } else {
    traces.push(makeTrace(hopIndex, device, ingressPortId, 'acl-ingress', 'skip', 'No ingress ACL configured', frame));
  }

  // ── Stage 7: Control Plane Trap ──────────────────────────────────────
  const cpResult = processControlPlaneProtocols(frame, device, state, now);
  if (cpResult.handled) {
    traces.push(makeTrace(hopIndex, device, ingressPortId, 'control-plane', 'trap',
      'Handled by control plane protocol engine', frame));
    return {
      deviceId: device.id,
      accepted: true,
      trapToControlPlane: true,
      egressPorts: [],
      responseFrame: cpResult.responseFrame,
      traces
    };
  }
  traces.push(makeTrace(hopIndex, device, ingressPortId, 'control-plane', 'pass', 'Not a control plane frame — continue to data plane', frame));

  // ── Stage 8: MAC Learning (switches only) ────────────────────────────
  if (state && (device.type === 'switchL2' || device.type === 'switchL3') && ingressPortId) {
    const stateMap = new Map<string, SwitchState>([[device.id, state]]);
    learnMacAddress(device.id, frame.srcMac, ingressPortId, frame.vlanId || 1, stateMap);
  }

  // ── Stage 9: MAC Lookup / Route Lookup ──────────────────────────────
  const { egressPorts, nextDeviceId, routeDecision } = resolveEgress(frame, device, state!, connections, deviceMap);

  if (egressPorts.length === 0) {
    const isRouter = (device.type === 'router' || device.type === 'firewall');
    const code = isRouter ? DropReasonCode.L3_NO_ROUTE : DropReasonCode.L2_UNKNOWN_MAC_NO_EGRESS;
    return drop(isRouter ? 'route-lookup' : 'mac-lookup', formatDropReason(code, `No path for dst ${frame.dstIp || frame.dstMac}`), 0);
  }

  const forwardStage: PipelineStage = (device.type === 'router' || device.type === 'firewall') ? 'route-lookup' : 'mac-lookup';
  const forwardAction: PipelineAction = egressPorts.length > 1 ? 'flood' : 'forward';
  const reasonText = routeDecision || `${forwardAction === 'flood' ? 'Flooding' : 'Forwarding'} to ${egressPorts.join(', ')}`;
  traces.push(makeTrace(hopIndex, device, ingressPortId, forwardStage, forwardAction, reasonText, frame));

  // ── Stage 10: ACL Egress ─────────────────────────────────────────────
  for (const egressPortId of egressPorts) {
    const egressPort: Port | undefined = state?.ports?.[egressPortId];
    if (egressPort?.accessGroupOut && state && frame.srcIp && frame.dstIp) {
      const aclResult = evaluateAcl(
        egressPort.accessGroupOut, state,
        frame.srcIp, frame.dstIp,
        frame.ipProtocol === 6 ? 'tcp' : frame.ipProtocol === 17 ? 'udp' : 'icmp'
      );
      if (aclResult === 'deny') {
        return drop('acl-egress', formatDropReason(DropReasonCode.ACL_DENY_EGRESS, `ACL ${egressPort.accessGroupOut} denied ${frame.srcIp}→${frame.dstIp}`), 13);
      }
      traces.push(makeTrace(hopIndex, device, egressPortId, 'acl-egress', 'pass',
        `ACL ${egressPort.accessGroupOut} (out) permit`, frame));
    }
  }

  // ── Stage 11: Egress + Packet Capture ────────────────────────────────
  const capturedOnLinks: string[] = [];
  const connectionIndex = buildConnectionIndex(connections);

  for (const egressPortId of egressPorts) {
    const egressPort: Port | undefined = state?.ports?.[egressPortId];
    if (egressPort) updatePortStats(egressPort, 'tx', frame.length || 64);

    const conn = connectionIndex.byPort.get(`${device.id}:${egressPortId}`);
    if (conn) {
      capturedOnLinks.push(conn.id);
      dispatchCapturedPackets([{
        connectionId: conn.id,
        sourceIp: frame.srcIp || '',
        targetIp: frame.dstIp || '',
        protocol: frame.protocol,
        length: frame.length,
        info: frame.info,
      }]);
      traces.push(makeTrace(hopIndex, device, egressPortId, 'capture', 'pass',
        `Captured on link ${conn.id}`, frame));
    }
    traces.push(makeTrace(hopIndex, device, egressPortId, 'egress', 'pass',
      `Frame exiting port ${egressPortId}`, frame));
  }

  return {
    deviceId: device.id,
    accepted: true,
    trapToControlPlane: false,
    egressPorts,
    nextDeviceId,
    traces,
  };
}

/**
 * Run the packet pipeline across multiple hops until the destination
 * is reached, a packet is dropped, or we've exceeded the TTL.
 */
export function runFullPacketPipeline(
  frame: NetworkPacketFrame,
  sourceDeviceId: string,
  devices: CanvasDevice[],
  deviceStates: Map<string, SwitchState>,
  connections: CanvasConnection[],
  maxHops = 30,
  now: number = Date.now()
): PipelineResult {
  const allTraces: PacketTrace[] = [];
  const hopResults: HopResult[] = [];
  const capturedOnLinks: string[] = [];
  const deviceMap = new Map<string, CanvasDevice>(devices.map(d => [d.id, d]));

  let currentDeviceId = sourceDeviceId;
  let currentFrame = { ...frame, ttl: frame.ttl ?? 64 };
  let hopIndex = 0;

  const connectionIndex = buildConnectionIndex(connections);

  const visitedDeviceIds = new Set<string>();

  while (hopIndex < maxHops) {
    const device = deviceMap.get(currentDeviceId);
    const state = deviceStates.get(currentDeviceId);

    if (!device) {
      return {
        success: false,
        hopResults,
        allTraces,
        capturedOnLinks,
        dropReason: formatDropReason(DropReasonCode.DEVICE_NOT_FOUND, `Device ${currentDeviceId} not found in topology`)
      };
    }

    // Routing loop detection check (if we revisit an L3 device)
    const isL3 = device.type === 'router' || device.type === 'firewall' || device.type === 'switchL3';
    if (isL3 && visitedDeviceIds.has(currentDeviceId)) {
      const loopReason = formatDropReason(DropReasonCode.MAX_HOPS_EXCEEDED, `%ROUTING-3-LOOP_DETECTED: Routing loop detected at ${device.name}`);
      if (state) {
        if (!state.eventLogs) state.eventLogs = [];
        state.eventLogs.push(`%ROUTING-3-LOOP_DETECTED: Packet loop detected on device ${device.name}`);
      }
      return {
        success: false,
        hopResults,
        allTraces,
        capturedOnLinks,
        dropReason: loopReason,
        finalFrame: currentFrame
      };
    }
    if (isL3) {
      visitedDeviceIds.add(currentDeviceId);
    }

    const hopResult = runHopPipeline(hopIndex, currentFrame, device, state, devices, connections, now);
    hopResults.push(hopResult);
    allTraces.push(...hopResult.traces);

    if (hopResult.traces.some(t => t.action === 'drop')) {
      const dropTrace = hopResult.traces.find(t => t.action === 'drop')!;
      return {
        success: false,
        hopResults,
        allTraces,
        capturedOnLinks,
        dropReason: `Dropped at ${device.name}: ${dropTrace.reason}`,
        finalFrame: hopResult.responseFrame || currentFrame,
      };
    }

    if (hopResult.trapToControlPlane) {
      return {
        success: true,
        hopResults,
        allTraces,
        capturedOnLinks,
        finalFrame: hopResult.responseFrame || currentFrame,
      };
    }

    // Move to next hop
    if (hopResult.nextDeviceId) {
      const egressPortId = hopResult.egressPorts[0];
      const conn = connectionIndex.byPort.get(`${currentDeviceId}:${egressPortId}`);
      if (conn) {
        capturedOnLinks.push(conn.id);
        const nextPortId = conn.sourceDeviceId === currentDeviceId ? conn.targetPort : conn.sourcePort;

        // Decrement TTL for routed hops
        if (isL3) {
          const newTtl = (currentFrame.ttl ?? 64) - 1;
          currentFrame = { ...currentFrame, ttl: newTtl };
          if (newTtl <= 0) {
            const ttlReason = formatDropReason(DropReasonCode.L3_TTL_EXCEEDED, `TTL reached 0 at ${device.name}`);
            const reportingIp = state?.ports?.[egressPortId]?.ipAddress || '127.0.0.1';
            const icmpErr = generateIcmpUnreachable(currentFrame, 'time-exceeded', ttlReason, 0, reportingIp);
            return {
              success: false,
              hopResults,
              allTraces,
              capturedOnLinks,
              dropReason: ttlReason,
              finalFrame: icmpErr
            };
          }
        }

        currentFrame = { ...currentFrame, ingressDeviceId: hopResult.nextDeviceId, ingressPortId: nextPortId };
        currentDeviceId = hopResult.nextDeviceId;
      } else {
        return { success: true, hopResults, allTraces, capturedOnLinks, finalFrame: currentFrame };
      }
    } else {
      return { success: true, hopResults, allTraces, capturedOnLinks, finalFrame: currentFrame };
    }

    hopIndex++;
  }

  return {
    success: false,
    hopResults,
    allTraces,
    capturedOnLinks,
    dropReason: formatDropReason(DropReasonCode.MAX_HOPS_EXCEEDED, `Maximum hop count (${maxHops}) exceeded — possible routing loop`)
  };
}
