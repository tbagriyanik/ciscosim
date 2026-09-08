import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import type { SwitchState, Port } from '@/lib/network/types';
import type { NetworkPacketFrame } from './packetFrame';
import { getRoutingTable, findRoute, Route } from '@/lib/network/routing';
import { learnMacAddress } from '@/lib/network/macLearning';
import { generateIcmpUnreachable } from './icmpUtils';

export interface ForwardingEngineResult {
  accepted: boolean;
  trapToControlPlane: boolean;
  egressPorts: string[];
  nextHopDevice?: CanvasDevice;
  actionReason: string;
  responseFrame?: NetworkPacketFrame;
}

/**
 * Stage 1: Ingress Layer 1 / Layer 2 Sanity & Security Filtering
 */
export function checkIngressSanity(
  frame: NetworkPacketFrame,
  device: CanvasDevice,
  _state: SwitchState | undefined,
  ingressPort: Port | undefined
): { allowed: boolean; reason: string } {
  if (device.status === 'offline') {
    return { allowed: false, reason: 'Device is powered off' };
  }

  if (!ingressPort) {
    return { allowed: true, reason: 'Ingress port not specified' };
  }

  if (ingressPort.shutdown) {
    return { allowed: false, reason: `Port ${ingressPort.name || ingressPort.id} is shutdown` };
  }

  // STP State check: Allow BPDUs even when port is Discarding/Learning
  if (frame.protocol === 'STP') {
    return { allowed: true, reason: 'STP BPDU allowed' };
  }

  if (ingressPort.status === 'blocked' || ingressPort.status === 'disabled') {
    return { allowed: false, reason: `Port status is ${ingressPort.status}` };
  }

  return { allowed: true, reason: 'Ingress checks passed' };
}

/**
 * Stage 2: Control Plane Protocol Processing (STP, ARP, DHCP, OSPF, EIGRP, IP SLA)
 */
export function processControlPlaneProtocols(
  frame: NetworkPacketFrame,
  device: CanvasDevice,
  state: SwitchState | undefined,
  now: number = Date.now()
): { handled: boolean; updatedState?: SwitchState; responseFrame?: NetworkPacketFrame } {
  if (!state) return { handled: false };

  const updatedState = { ...state };
  let handled = false;
  let responseFrame: NetworkPacketFrame | undefined;

  // 1. ARP Protocol Trap
  if (frame.protocol === 'ARP' && frame.arpPayload) {
    handled = true;
    const { operation, senderIp, senderMac, targetIp } = frame.arpPayload;

    // Learn ARP entry into local ARP cache
    const currentArp = updatedState.arpCache || [];
    if (!currentArp.some(a => a.ip === senderIp)) {
      updatedState.arpCache = [
        ...currentArp,
        { ip: senderIp, mac: senderMac, interface: frame.ingressPortId || 'eth0', timestamp: now }
      ];
    }

    // Check if target IP belongs to this device
    const localIps = Object.values(updatedState.ports || {})
      .map(p => p.ipAddress)
      .filter(Boolean) as string[];

    if (device.ip) localIps.push(device.ip);

    if (operation === 'request' && targetIp && localIps.includes(targetIp)) {
      const myMac = device.macAddress || Object.values(updatedState.ports || {})[0]?.macAddress || '00:00:00:00:00:00';
      responseFrame = {
        id: `arp-reply-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        protocol: 'ARP',
        timestamp: now,
        ingressDeviceId: device.id,
        srcMac: myMac,
        dstMac: senderMac,
        etherType: '0x0806',
        srcIp: targetIp,
        dstIp: senderIp,
        arpPayload: {
          operation: 'reply',
          senderIp: targetIp,
          senderMac: myMac,
          targetIp: senderIp,
          targetMac: senderMac
        },
        length: 42,
        info: `ARP Reply ${targetIp} is at ${myMac}`
      };
    }
  }

  // 2. DHCP Protocol Trap
  if ((frame.protocol === 'DHCP' || frame.protocol === 'DHCPV6') && frame.dhcpPayload) {
    handled = true;
    const { messageType, clientMac } = frame.dhcpPayload;

    if (messageType === 'discover' || messageType === 'request') {
      const poolKeys = Object.keys(updatedState.dhcpPools || {});
      if (poolKeys.length > 0) {
        const pool = updatedState.dhcpPools![poolKeys[0]];
        const assignedIp = pool.network ? `${pool.network.split('.').slice(0, 3).join('.')}.${100 + Math.floor(Math.random() * 100)}` : '192.168.1.100';

        responseFrame = {
          id: `dhcp-ack-${Date.now()}`,
          protocol: 'DHCP',
          timestamp: now,
          ingressDeviceId: device.id,
          srcMac: device.macAddress || '00:00:00:00:00:00',
          dstMac: clientMac,
          etherType: '0x0800',
          srcIp: device.ip || '192.168.1.1',
          dstIp: assignedIp,
          dhcpPayload: {
            messageType: messageType === 'discover' ? 'offer' : 'ack',
            clientMac,
            offeredIp: assignedIp,
            subnetMask: pool.subnetMask || '255.255.255.0',
            gateway: pool.defaultRouter || device.ip
          },
          length: 300,
          info: `DHCP ${messageType === 'discover' ? 'Offer' : 'ACK'} ${assignedIp} for ${clientMac}`
        };
      }
    }
  }

  // 3. STP Protocol Trap
  if (frame.protocol === 'STP' && frame.stpPayload) {
    handled = true;
    if (frame.stpPayload.rootId) {
      updatedState.spanningTreePriority = Math.min(updatedState.spanningTreePriority || 32768, 32768);
    }
  }

  // 4. OSPF Protocol Trap
  if (frame.protocol === 'OSPF' && frame.ospfPayload) {
    handled = true;
    const { routerId } = frame.ospfPayload;
    if (routerId) {
      const existing = updatedState.ospfNeighbors || [];
      if (!existing.includes(routerId)) {
        updatedState.ospfNeighbors = [...existing, routerId];
      }
    }
  }

  // 5. EIGRP Protocol Trap
  if (frame.protocol === 'EIGRP' && frame.eigrpPayload) {
    handled = true;
    const { routes } = frame.eigrpPayload;
    const peerIp = frame.srcIp || '10.0.0.1';
    const existing = updatedState.eigrpNeighbors || [];
    if (!existing.includes(peerIp)) {
      updatedState.eigrpNeighbors = [...existing, peerIp];
    }

    if (routes && routes.length > 0) {
      const currentDynamic = updatedState.dynamicRoutes || [];
      routes.forEach(r => {
        if (!currentDynamic.some(e => e.destination === r.prefix)) {
          const newRoute: Route = {
            destination: r.prefix,
            subnetMask: r.mask,
            nextHop: r.nexthop,
            interfaceId: frame.ingressPortId || 'Gi0/0',
            type: 'dynamic',
            metric: r.delay + r.bandwidth,
            administrativeDistance: 90
          };
          currentDynamic.push(newRoute);
        }
      });
      updatedState.dynamicRoutes = currentDynamic;
    }
  }

  // 6. IP SLA Probe Trap
  if (frame.protocol === 'IP_SLA' && frame.ipSlaPayload) {
    handled = true;
    const { operationId } = frame.ipSlaPayload;
    if (updatedState.ipSlaOperations?.[operationId]) {
      const op = updatedState.ipSlaOperations[operationId];
      op.statistics.attempts += 1;
      op.statistics.successes += 1;
      op.statistics.last = 2;
      op.lastRunAt = now;

      if (updatedState.ipSlaTracks) {
        Object.entries(updatedState.ipSlaTracks).forEach(([_trackId, track]) => {
          if (track.operationId === operationId) {
            track.state = 'up';
            track.lastChange = now;
          }
        });
      }
    }
  }

  return { handled, updatedState, responseFrame };
}

/**
 * Stage 3: Common Data Plane Layer 2 / Layer 3 Forwarding Engine
 */
export function forwardPacketFrame(
  frame: NetworkPacketFrame,
  device: CanvasDevice,
  state: SwitchState | undefined,
  _devices: CanvasDevice[] = [],
  _connections: CanvasConnection[] = []
): ForwardingEngineResult {
  // Stage 1: Ingress checks
  const ingressPort = state?.ports?.[frame.ingressPortId || ''];
  const sanity = checkIngressSanity(frame, device, state, ingressPort);
  if (!sanity.allowed) {
    return {
      accepted: false,
      trapToControlPlane: false,
      egressPorts: [],
      actionReason: sanity.reason
    };
  }

  // TTL handling: Check incoming TTL
  let ttl = frame.ttl;
  if (ttl === undefined) ttl = 255; // Default TTL if not set

  // If TTL is 0, drop the packet and send ICMP Time Exceeded
  if (ttl <= 0) {
    const icmpMsg = generateIcmpUnreachable(frame, 'time-exceeded', 'ttl-zero');
    return {
      accepted: false,
      trapToControlPlane: true,
      egressPorts: [],
      actionReason: 'Packet dropped due to TTL zero',
      responseFrame: icmpMsg
    };
  }

  // Decrement TTL for this hop
  ttl--;
  frame.ttl = ttl; // Update frame TTL for propagation

  // Stage 2: Control plane traps
  const controlRes = processControlPlaneProtocols(frame, device, state);
  if (controlRes.handled) {
    return {
      accepted: true,
      trapToControlPlane: true,
      egressPorts: [],
      actionReason: 'Handled by Control Plane Protocol Engine',
      responseFrame: controlRes.responseFrame
    };
  }

  // Learn MAC Address if Switch
  if (state && (device.type === 'switchL2' || device.type === 'switchL3') && frame.ingressPortId) {
    const deviceMap = new Map<string, SwitchState>([[device.id, state]]);
    learnMacAddress(device.id, frame.srcMac, frame.ingressPortId, frame.vlanId || 1, deviceMap);
  }


  // Stage 3: Switching / Routing Forwarding Logic
  const egressPorts: string[] = [];

  if (device.type === 'switchL2' || device.type === 'switchL3' || device.type === 'hub') {
    if (device.type === 'hub' || frame.dstMac === 'ff:ff:ff:ff:ff:ff' || !frame.dstMac) {
      // L1 Flood to all active forwarding ports (except ingress port)
      Object.values(state?.ports || {}).forEach(p => {
        if (p.id !== frame.ingressPortId && !p.shutdown && p.status === 'connected') {
          egressPorts.push(p.id);
        }
      });
    } else {
      const matchEntry = state?.macAddressTable?.find(m => m.mac === frame.dstMac);
      if (matchEntry?.port && matchEntry.port !== frame.ingressPortId && !state?.ports?.[matchEntry.port]?.shutdown) {
        egressPorts.push(matchEntry.port);
      } else {
        // Unicast miss -> Flood
        Object.values(state?.ports || {}).forEach(p => {
          if (p.id !== frame.ingressPortId && !p.shutdown && p.status === 'connected') {
            egressPorts.push(p.id);
          }
        });
      }
    }
  } else if (device.type === 'router' || device.type === 'firewall') {
    // Router Layer 3 Route Lookup
    if (frame.dstIp && state) {
      const deviceMap = new Map<string, SwitchState>([[device.id, state]]);
      const fullTable = getRoutingTable(device.id, deviceMap);
      const route = findRoute(frame.dstIp, fullTable);
      if (route && (route.interfaceId || route.nextHop)) {
        const portId = route.interfaceId || route.nextHop;
        // Static routes may reference a shutdown interface; don't forward out.
        if (!state.ports?.[portId]?.shutdown) {
          egressPorts.push(portId);
        }
      }
    }
  } else if (device.type === 'cloud') {
    // Cloud WAN transit bridge forwarding
    (device.ports || []).forEach(p => {
      if (p.id !== frame.ingressPortId && !p.shutdown && p.status === 'connected') {
        egressPorts.push(p.id);
      }
    });
  }

  return {
    accepted: true,
    trapToControlPlane: false,
    egressPorts,
    actionReason: `Forwarded to ${egressPorts.length} egress ports`
  };
}
