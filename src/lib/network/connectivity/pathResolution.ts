import { CanvasDevice, CanvasConnection, CanvasPort } from '@/components/network/networkTopology.types';
import { SwitchState, Port } from '@/lib/network/types';
import { findRoute, getRoutingTable, isIpv6InNetwork } from '@/lib/network/routing';
import { performArpResolution, getMacFromArpCache } from '@/lib/network/arp';
import { performNdpResolution, getMacFromNdpCache } from '@/lib/network/ndp';
import { learnMacAddress, findMacPort } from '@/lib/network/macLearning';
import { ensureDeviceStatesMap } from '@/lib/network/networkUtils';
import { recalculateStp } from '@/lib/network/stp';
import { normalizePortId } from '@/lib/network/initialState';
import { buildImplicitWirelessConnections } from '@/lib/network/wireless';
import { isExternalDomain, resolveHostname } from '@/lib/network/dns';
import { buildConnectionIndex } from '@/lib/network/connectionIndex';
import {
  getPrimaryDeviceIp,
  getSubnetForDeviceIp,
  isConnectionCableCompatible,
  isDevicePoweredOn,
  isIpInSubnet,
  isManagementIpSet,
  isPortShutdown,
} from '@/lib/network/connectivity.utils';
import { portsFormTrunk, getVlanSpecificSTPBlocking } from './vlanAndSwitching';
import { checkPortSecurityViolation, checkSerialEncapsulation } from './security';
import { evaluateAcl, evaluateIpv6Acl } from './acl';
import { evaluateNatForHop } from './natEvaluation';

/**
 * Robust Network connectivity checker for simulation
 * Checks if two devices can communicate based on:
 * 1. Physical connection (Topology)
 * 2. Layer 3 configuration (IP/Subnet)
 * 3. VLAN configuration (for Switches)
 * 4. Port status (Shutdown/Connected)
 */
export function checkConnectivity(
  sourceId: string,
  targetIp: string,
  devices: CanvasDevice[],
  _connections: CanvasConnection[],
  deviceStates?: Map<string, SwitchState>,
  language: 'tr' | 'en' = 'tr',
  options?: { protocol?: 'tcp' | 'udp' | 'icmp' | 'any'; port?: string; dhcpMessage?: 'discover' | 'offer' | 'request' | 'ack' }
): {
  success: boolean;
  hops: string[];
  hopIds: string[];
  targetId?: string;
  error?: string;
  portSecurityViolations?: Array<{ deviceId: string; portId: string; action: string; mac: string }>;
  traversedPorts?: Array<{ deviceId: string; portId: string; type: 'ingress' | 'egress' }>;
  capturedPackets?: Array<{ connectionId: string; sourceIp: string; targetIp: string; protocol: string; length: number; info: string }>;
} {
  const safeDeviceStates = ensureDeviceStatesMap(deviceStates);
  const isSwitchDeviceType = (type: string): boolean => type === 'switchL2' || type === 'switchL3' || type === 'hub';


  // Track port security violations for React state updates
  const portSecurityViolations: Array<{ deviceId: string; portId: string; action: string; mac: string }> = [];
  const traversedPorts: Array<{ deviceId: string; portId: string; type: 'ingress' | 'egress' }> = [];
  const capturedPackets: Array<{ connectionId: string; sourceIp: string; targetIp: string; protocol: string; length: number; info: string }> = [];
  // Track the ARP/NDP broadcast request so it can be recorded on every switch flood port
  let arpBroadcast: { sourceIp: string; targetIp: string; isIpv6?: boolean } | null = null;

  // BOLT: Use a device map for O(1) lookups
  const deviceMap = new Map<string, CanvasDevice>();
  for (const d of devices) {
    deviceMap.set(d.id, d);
  }

  // 1.5. Implicit Wireless Connections
  const connections = [
    ..._connections,
    ...buildImplicitWirelessConnections(devices, safeDeviceStates, 'wireless'),
  ];

  // Build all connection indexes once for this connectivity evaluation. BFS,
  // device-neighbor checks and path lookups reuse the same adjacency map.
  const connectionIndex = buildConnectionIndex(connections);
  const adjList = connectionIndex.adjacency;

  // 0. Resolve hostname to IP if necessary
  let resolvedTargetIp = targetIp;
  let isExternal = false;
  let routingRequired = false;

  // Check if targetIp is a hostname (not an IP address)
  const isIp = (val: string) => {
    if (val.includes(':')) return true;
    const parts = val.split('.');
    return parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
  };
  const isDhcpBroadcast = targetIp === '255.255.255.255' && options?.protocol === 'udp' && (options.port === '67' || options.port === '68');
  if (!isIp(targetIp) && !isDhcpBroadcast) {
    // Check if source device has domain lookup disabled
    const sourceState = deviceStates?.get(sourceId);
    if (sourceState?.domainLookup === false) {
      const dnsServer = sourceState?.dnsServer || '255.255.255.255';
      return { success: false, hops: [], hopIds: [], error: `% Unknown command or domain lookup disabled.\nTranslating "${targetIp}"...domain server (${dnsServer})\n% Unrecognized host or address, or protocol not running.` };
    }

    // Check if this is an external domain
    isExternal = isExternalDomain(targetIp, devices, deviceStates);

    const resolvedIp = resolveHostname(targetIp, devices, deviceStates, deviceMap);
    if (!resolvedIp) {
      return { success: false, hops: [], hopIds: [], error: 'Request timed out.' };
    }
    resolvedTargetIp = resolvedIp;
  }

  // For external domains, simulate successful internet routing
  const hasCloudDevice = devices.some(d => d.type === 'cloud');
  if (isExternal && !hasCloudDevice) {
    const sourceDevice = deviceMap.get(sourceId);
    if (sourceDevice) {
      // Simulate internet routing path
      const hops = ['Internet Gateway', 'ISP Router', 'External Network'];
      const hopIds = [sourceId, 'internet-gateway', 'external-network'];

      return {
        success: true,
        hops,
        hopIds,
        targetId: 'external-domain',
        error: undefined,
        portSecurityViolations
      };
    }
  }

  // 1. Find target device by IP (supports both IPv4 and IPv6)
  // Recalculate STP states for accurate blocking
  let stpDeviceStates = safeDeviceStates;
  if (safeDeviceStates.size > 0) {
    stpDeviceStates = recalculateStp(safeDeviceStates, connections);
  }

  // BOLT: Pre-calculate an ipMap for O(1) device resolution
  const ipMap = new Map<string, string>(); // IP -> deviceId
  for (const d of devices) {
    if (d.ip) ipMap.set(d.ip, d.id);
    if (d.ipv6) ipMap.set(d.ipv6.toLowerCase(), d.id);
    if (d.type === 'cloud') {
      ipMap.set('8.8.8.8', d.id);
      ipMap.set('8.8.4.4', d.id);
      ipMap.set('1.1.1.1', d.id);
      ipMap.set('1.0.0.1', d.id);
      if (d.ip) ipMap.set(d.ip, d.id);
      else ipMap.set('203.0.113.1', d.id);
    }
  }

  if (deviceStates) {
    for (const [id, state] of deviceStates.entries()) {
      for (const portId in state.ports) {
        const port = state.ports[portId];
        if (port.ipAddress) ipMap.set(port.ipAddress, id);
        if (port.ipv6Address) ipMap.set(port.ipv6Address.toLowerCase(), id);
      }
      // Also map NAT global IPs to this router so that outside→inside traffic
      // (e.g. ping to a static NAT global address) can be path-resolved correctly.
      if (state.natStaticTranslations) {
        for (const entry of state.natStaticTranslations) {
          if (!ipMap.has(entry.globalIp)) {
            ipMap.set(entry.globalIp, id);
          }
        }
      }
    }

    // Inject FHRP virtual IPs: map virtual IP to the Active/Master device
    for (const [deviceId, state] of safeDeviceStates) {
      for (const portId in state.ports) {
        const port = state.ports[portId];

        // HSRP: Map virtual IP to Active device
        if (port.hsrp?.groups) {
          for (const [_groupId, group] of Object.entries(port.hsrp.groups)) {
            if (group.virtualIp && group.state === 'Active') {
              ipMap.set(group.virtualIp, deviceId);
            }
            if (group.ipv6VirtualIp && group.state === 'Active') {
              ipMap.set(group.ipv6VirtualIp.toLowerCase(), deviceId);
            }
          }
        }

        // VRRP: Map virtual IP to Master device
        if (port.vrrp?.groups) {
          for (const [_groupId, group] of Object.entries(port.vrrp.groups)) {
            if (group.virtualIp && group.state === 'Master') {
              ipMap.set(group.virtualIp, deviceId);
            }
          }
        }
      }
    }
  }

  // DHCP Discover/Request is broadcast; relay it to the first configured helper.
  if (isDhcpBroadcast && deviceStates) {
    // Find helper addresses on the source device's directly connected router
    const sourceDevice = deviceMap.get(sourceId);
    let helperIp: string | undefined;

    if (sourceDevice && (sourceDevice.type === 'pc' || sourceDevice.type === 'iot' || sourceDevice.type === 'mobile' || sourceDevice.type === 'printer')) {

      const sourceGatewayIp = sourceDevice.gateway;
      if (sourceGatewayIp) {
        for (const [deviceId, state] of safeDeviceStates) {
          const device = deviceMap.get(deviceId);
          if (device?.type === 'router' || device?.type === 'switchL3') {
            for (const portId in state.ports) {
              const port = state.ports[portId];
              if (port.ipAddress === sourceGatewayIp && port.helperAddresses && port.helperAddresses.length > 0 && !port.shutdown) {
                helperIp = port.helperAddresses[0];
                break;
              }
            }
            if (helperIp) break;
          }
        }
      }
      if (!helperIp) {
        for (const [deviceId, state] of safeDeviceStates) {
          const device = deviceMap.get(deviceId);
          if (device?.type === 'router' || device?.type === 'switchL3') {
            for (const portId in state.ports) {
              const port = state.ports[portId];
              if (port.helperAddresses && port.helperAddresses.length > 0 && !port.shutdown) {
                helperIp = port.helperAddresses[0];
                break;
              }
            }
            if (helperIp) break;
          }
        }
      }
    }

    // Fallback: search all devices for helper addresses if not found on gateway
    if (!helperIp) {
      for (const state of safeDeviceStates.values()) {
        for (const port of Object.values(state.ports || {})) {
          if (port.helperAddresses && port.helperAddresses.length > 0 && !port.shutdown) {
            helperIp = port.helperAddresses[0];
            break;
          }
        }
        if (helperIp) break;
      }
    }

    if (helperIp) resolvedTargetIp = helperIp;
  }
  let targetDeviceId = ipMap.get(resolvedTargetIp.toLowerCase());
  // HSRP/VRRP virtual IPs resolve to the elected active/master device.
  if (!targetDeviceId && deviceStates) {
    const virtualCandidates: Array<{ deviceId: string; priority: number; active: boolean; virtualMac?: string }> = [];
    for (const [deviceId, state] of safeDeviceStates) {
      Object.values(state.ports || {}).forEach(port => {
        Object.values(port.hsrp?.groups || {}).forEach(group => {
          if (group.virtualIp === resolvedTargetIp || group.ipv6VirtualIp?.toLowerCase() === resolvedTargetIp.toLowerCase()) {
            virtualCandidates.push({ deviceId, priority: group.priority ?? 100, active: group.state === 'Active', virtualMac: group.virtualMac });
          }
        });
        Object.values(port.vrrp?.groups || {}).forEach(group => {
          if (group.virtualIp === resolvedTargetIp) {
            virtualCandidates.push({ deviceId, priority: group.priority ?? 100, active: group.state === 'Master', virtualMac: group.virtualMac });
          }
        });
      });
    }
    targetDeviceId = virtualCandidates.sort((a, b) => Number(b.active) - Number(a.active) || b.priority - a.priority)[0]?.deviceId;
  }
  let targetDevice = targetDeviceId ? deviceMap.get(targetDeviceId) : undefined;

  // If the resolved target is a NAT global IP, the actual end device is the
  // mapped local IP. Override targetDevice so that BFS finds the full path
  // Server → R1 → PC-1, and the NAT outside→inside translation fires at R1.
  if (targetDeviceId && deviceStates) {
    const routerState = deviceStates.get(targetDeviceId);
    const staticEntry = routerState?.natStaticTranslations?.find(
      t => t.globalIp === resolvedTargetIp
    );
    if (staticEntry) {
      // Find the actual end device (the one with localIp)
      const realDevId = (() => {
        for (const d of devices) {
          if (d.ip === staticEntry.localIp) return d.id;
        }
        if (deviceStates) {
          for (const [id, s] of deviceStates.entries()) {
            for (const portId in s.ports) {
              if (s.ports[portId].ipAddress === staticEntry.localIp) return id;
            }
          }
        }
        return null;
      })();
      if (realDevId) {
        const realDev = deviceMap.get(realDevId);
        if (realDev) {
          targetDevice = realDev;
          // Also update resolvedTargetIp so isDirectSubnet / gateway routing
          // uses the real inner address, not the NAT global address.
          resolvedTargetIp = staticEntry.localIp;
        }
      }
    }
  }

  if (!targetDevice) {
    const isPublicCloudIp = (ip: string, cDev?: CanvasDevice) => {
      const lower = ip.toLowerCase();
      if (['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1'].includes(lower)) return true;
      if (cDev?.ip && cDev.ip.toLowerCase() === lower) return true;
      return false;
    };
    const cloudDev = devices.find(d => d.type === 'cloud');
    if (cloudDev && cloudDev.status !== 'offline' && isPublicCloudIp(resolvedTargetIp, cloudDev)) {
      const isCloudConn = connections.some(c => (c.sourceDeviceId === cloudDev.id || c.targetDeviceId === cloudDev.id) && c.active !== false);
      if (!isCloudConn) {
        return {
          success: false,
          hops: [],
          hopIds: [],
          targetId: cloudDev.id,
          error: language === 'tr' ? 'Bulut (Cloud) cihazı ağa bağlı değil.' : 'Cloud device is not connected to the network.'
        };
      }
      targetDeviceId = cloudDev.id;
      targetDevice = cloudDev;
    } else {
      return { success: false, hops: [], hopIds: [], error: 'Request timed out.' };
    }
  }

  // 1.5. Perform ARP/NDP resolution if target is in same subnet
  const sourceDeviceForArp = deviceMap.get(sourceId);
  if (sourceDeviceForArp && targetDevice?.macAddress) {
    const sourceState = safeDeviceStates.get(sourceId);
    if (sourceState || safeDeviceStates.size === 0) {
      const isIpv6 = resolvedTargetIp.includes(':');
      const sourceIp = getPrimaryDeviceIp(sourceId, devices, safeDeviceStates, isIpv6, sourceDeviceForArp);

      let isInSameSubnet = false;

      if (isIpv6) {
        let prefix = 64;
        if (sourceState) {
          for (const p of Object.values(sourceState.ports)) {
            if (p.ipv6Address?.toLowerCase() === sourceIp.toLowerCase() && p.ipv6Prefix) {
              prefix = p.ipv6Prefix;
              break;
            }
          }
        }
        // Need to import isIpv6InNetwork from routing, but we already have it at the top
        isInSameSubnet = isIpv6InNetwork(sourceIp, resolvedTargetIp, prefix);
      } else {
        const sourceSubnet = getSubnetForDeviceIp(sourceId, sourceIp, devices, safeDeviceStates, sourceDeviceForArp) || '255.255.255.0';
        isInSameSubnet = isIpInSubnet(sourceIp, resolvedTargetIp, sourceSubnet);
      }

      if (isInSameSubnet) {
        const sourceConn = adjList.get(sourceId)?.[0]?.connection;
        const interfaceName = sourceConn ? (sourceConn.sourceDeviceId === sourceId ? sourceConn.sourcePort : sourceConn.targetPort) : 'unknown';

        if (isIpv6) {
          const cachedMac = getMacFromNdpCache(sourceId, resolvedTargetIp, safeDeviceStates);
          performNdpResolution(sourceId, resolvedTargetIp, targetDevice.macAddress, interfaceName, safeDeviceStates, targetDevice.type === 'router');

          if (!cachedMac && sourceConn) {
            arpBroadcast = { sourceIp, targetIp: resolvedTargetIp, isIpv6: true }; // piggyback on arpBroadcast flag for packet flooding
            // NS: Solicited-node multicast
            const parts = resolvedTargetIp.split(':');
            const lastPart = parts[parts.length - 1];
            // Format ff02::1:ff...
            capturedPackets.push({
              connectionId: sourceConn.id,
              sourceIp: sourceIp,
              targetIp: `ff02::1:ff00:${lastPart}`, // simplified multicast IP format
              protocol: 'ICMPv6',
              length: 72,
              info: `ICMPv6 NS: Who has ${resolvedTargetIp}?`
            });
          }
        } else {
          const cachedMac = getMacFromArpCache(sourceId, resolvedTargetIp, safeDeviceStates);
          performArpResolution(sourceId, resolvedTargetIp, targetDevice.macAddress, interfaceName, safeDeviceStates);

          if (!cachedMac && sourceConn) {
            arpBroadcast = { sourceIp, targetIp: resolvedTargetIp, isIpv6: false };
            capturedPackets.push({
              connectionId: sourceConn.id,
              sourceIp: sourceIp,
              targetIp: '255.255.255.255',
              protocol: 'ARP',
              length: 42,
              info: `ARP Request: Who has ${resolvedTargetIp}? Tell ${sourceIp}`
            });
          }
        }
      }
    }
  }

  const getPortVlan = (port: Port | CanvasPort | undefined): number => {
    return Number(port?.accessVlan || port?.vlan || 1);
  };

  const isPortMemberOfVlan = (port: Port | CanvasPort | undefined, vlanId: number, deviceType?: string): boolean => {
    if (!port) return false;
    if (deviceType === 'hub') return true;
    const mode = (port as Port).mode;

    if (mode === 'trunk' || mode === 'dynamic-auto' || mode === 'dynamic-desirable' || mode === 'dot1q-tunnel') {
      const allowed = (port as Port).allowedVlans ?? (port as Port).trunkAllowedVlans;
      if (!allowed || allowed === 'all') return true;
      if (Array.isArray(allowed)) return allowed.map(Number).includes(vlanId);
      if (typeof allowed === 'string') {
        if (allowed.trim().toLowerCase() === 'all') return true;
        return allowed.split(',').some(part => {
          const trimmed = part.trim();
          if (!trimmed) return false;
          const [startRaw, endRaw] = trimmed.split('-');
          const start = Number(startRaw);
          const end = endRaw ? Number(endRaw) : start;
          return Number.isFinite(start) && Number.isFinite(end) && vlanId >= start && vlanId <= end;
        });
      }
      return true;
    }
    return getPortVlan(port) === vlanId;
  };

  const getDeviceVlan = (device: CanvasDevice, state?: SwitchState): number | null => {
    if (device.type === 'pc' || device.type === 'iot' || device.type === 'mobile' || device.type === 'printer') {

      // BOLT: Use pre-calculated adjList for O(1) connection lookup
      const neighbors = adjList.get(device.id);
      const connectedConn = neighbors?.[0]?.connection;

      if (connectedConn && deviceStates) {
        const peerDeviceId = connectedConn.sourceDeviceId === device.id ? connectedConn.targetDeviceId : connectedConn.sourceDeviceId;
        const peerPortId = connectedConn.sourceDeviceId === device.id ? connectedConn.targetPort : connectedConn.sourcePort;
        const peerState = deviceStates.get(peerDeviceId);
        const peerPort = peerState?.ports?.[peerPortId];
        if (peerPort) {
          if (portsFormTrunk(undefined, peerPort.mode)) return 1;
          return getPortVlan(peerPort);
        }
      }
      return Number(device.vlan || 1);
    }
    if (!state) return 1;

    // Prefer any SVI / management VLAN tied to the device's IP
    const ip = device.ip || state.ports['vlan1']?.ipAddress || '';
    for (const [portId, port] of Object.entries(state.ports)) {
      if (portId.startsWith('vlan') && port.ipAddress === ip) {
        const vlanMatch = portId.match(/vlan(\d+)/);
        return vlanMatch ? parseInt(vlanMatch[1], 10) : 1;
      }
    }

    // For access ports, the VLAN assigned to the active port is the device VLAN
    const accessPort = Object.values(state.ports).find((port: Port) => !port.shutdown && port.mode === 'access' && getPortVlan(port) !== 1);
    if (accessPort) return getPortVlan(accessPort);

    return 1;
  };

  const getFallbackVlanFromPath = (deviceId: string): number => {
    const device = deviceMap.get(deviceId);
    const state = deviceStates?.get(deviceId);
    if (!device) return 1;
    const vlan = getDeviceVlan(device, state);
    if (vlan && vlan > 0) return vlan;
    return 1;
  };

  // 2. Pathfinding with Gateway Routing support for inter-subnet communication
  const sourceVlan = getFallbackVlanFromPath(sourceId);
  const sourceDeviceForSubnet = deviceMap.get(sourceId);
  const isTargetIpv6 = resolvedTargetIp.includes(':');
  const sourceIp = getPrimaryDeviceIp(sourceId, devices, safeDeviceStates, isTargetIpv6);
  const sourceSubnet = getSubnetForDeviceIp(sourceId, sourceIp, devices, safeDeviceStates) || sourceDeviceForSubnet?.subnet || '255.255.255.0';
  const targetSubnet = targetDevice.subnet || '255.255.255.0';
  const isDirectSubnet = isIpInSubnet(sourceIp, resolvedTargetIp, sourceSubnet) && isIpInSubnet(resolvedTargetIp, sourceIp, targetSubnet);

  let path: string[] = [];

  // If different subnets and source host has a configured gateway, route via gateway
  const sourceGatewayIp = sourceDeviceForSubnet?.gateway;

  const findPathBetween = (startId: string, endId: string, allowedVlan?: number): string[] | null => {
    const q: string[] = [startId];
    const v = new Set<string>([startId]);
    const p = new Map<string, string>();

    while (q.length > 0) {
      const cur = q.shift();
      if (!cur) break;
      if (cur === endId) break;

      const neighbors = adjList.get(cur) || [];
      for (const { neighborId, connection: conn } of neighbors) {
        if (!v.has(neighborId) && conn) {
          const srcPortId = conn.sourceDeviceId === cur ? conn.sourcePort : conn.targetPort;
          const dstPortId = conn.sourceDeviceId === neighborId ? conn.sourcePort : conn.targetPort;
          const srcDev = deviceMap.get(cur);
          const dstDev = deviceMap.get(neighborId);

          const isSrcShutdown = isPortShutdown(cur, srcPortId, devices, safeDeviceStates, srcDev);
          const isDstShutdown = isPortShutdown(neighborId, dstPortId, devices, safeDeviceStates, dstDev);
          const isSrcPoweredOff = !isDevicePoweredOn(srcDev);
          const isDstPoweredOff = !isDevicePoweredOn(dstDev);
          const isSrcSTPBlocking = allowedVlan ? getVlanSpecificSTPBlocking(cur, srcPortId, allowedVlan, connections, stpDeviceStates, conn, connectionIndex) : false;
          const isDstSTPBlocking = allowedVlan ? getVlanSpecificSTPBlocking(neighborId, dstPortId, allowedVlan, connections, stpDeviceStates, conn, connectionIndex) : false;
          const isCableOk = isConnectionCableCompatible(conn, srcDev, dstDev);
          const isSerialEncapOk = checkSerialEncapsulation(cur, srcPortId, neighborId, dstPortId, safeDeviceStates);

          if (!isSrcShutdown && !isDstShutdown && !isSrcPoweredOff && !isDstPoweredOff && !isSrcSTPBlocking && !isDstSTPBlocking && isCableOk && isSerialEncapOk) {
            v.add(neighborId);
            p.set(neighborId, cur);
            q.push(neighborId);
          }
        }
      }
    }

    if (!v.has(endId)) return null;
    const res: string[] = [];
    let curr: string | undefined = endId;
    while (curr) {
      res.unshift(curr);
      curr = p.get(curr);
    }
    return res;
  };

  if (!isDirectSubnet && sourceGatewayIp && (sourceDeviceForSubnet?.type === 'pc' || sourceDeviceForSubnet?.type === 'iot' || sourceDeviceForSubnet?.type === 'mobile' || sourceDeviceForSubnet?.type === 'printer')) {

    // Find gateway device ID by gateway IP
    const gatewayDeviceId = ipMap.get(sourceGatewayIp.toLowerCase());
    if (gatewayDeviceId && gatewayDeviceId !== targetDevice.id) {
      const pathToGateway = findPathBetween(sourceId, gatewayDeviceId, sourceVlan);
      const pathFromGateway = findPathBetween(gatewayDeviceId, targetDevice.id);
      if (pathToGateway && pathFromGateway) {
        path = [...pathToGateway, ...pathFromGateway.slice(1)];
      } else if (pathToGateway && targetDevice.type === 'cloud') {
        // Ensure cloud is physically reachable from gateway (or directly connected)
        const cloudPathFromGw = findPathBetween(gatewayDeviceId, targetDevice.id);
        if (cloudPathFromGw) {
          path = [...pathToGateway, ...cloudPathFromGw.slice(1)];
        }
      }
    }
  }

  if (path.length === 0) {
    const directPath = findPathBetween(sourceId, targetDevice.id, sourceVlan);
    if (!directPath) {
      if (targetDevice.type === 'cloud' && sourceGatewayIp) {
        const gwId = ipMap.get(sourceGatewayIp.toLowerCase());
        if (gwId) {
          const gwPath = findPathBetween(sourceId, gwId, sourceVlan);
          const cloudPathFromGw = findPathBetween(gwId, targetDevice.id);
          if (gwPath && cloudPathFromGw) {
            path = [...gwPath, ...cloudPathFromGw.slice(1)];
          }
        }
      }
      if (path.length === 0) {
        return { success: false, hops: [], hopIds: [], error: 'Destination host unreachable.' };
      }
    } else {
      path = directPath;
    }
  }

  // BOLT: Pre-calculate path-related connections for O(1) lookup in later stages
  const pathConnections = new Map<string, CanvasConnection>();
  let ttl = 64; // Default TTL

  for (let i = 0; i < path.length - 1; i++) {
    const aId = path[i];
    const bId = path[i + 1];
    const conn = adjList.get(aId)?.find(n => n.neighborId === bId)?.connection;
    if (conn) {
      pathConnections.set(`${aId}-${bId}`, conn);
      pathConnections.set(`${bId}-${aId}`, conn);

      // Track ports used in this hop
      const srcPortId = conn.sourceDeviceId === aId ? conn.sourcePort : conn.targetPort;
      const dstPortId = conn.sourceDeviceId === bId ? conn.sourcePort : conn.targetPort;

      if (srcPortId) traversedPorts.push({ deviceId: aId, portId: srcPortId, type: 'egress' });
      if (dstPortId) traversedPorts.push({ deviceId: bId, portId: dstPortId, type: 'ingress' });

      const aDevice = deviceMap.get(aId);
      const bDevice = deviceMap.get(bId);
      const bState = safeDeviceStates.get(bId);
      const sourceMac = deviceMap.get(sourceId)?.macAddress;
      const targetMac = targetDevice.macAddress;

      // TTL Control: Decrement TTL at each hop through a router
      if (aDevice && (aDevice.type === 'router' || aDevice.type === 'switchL3')) {
        ttl--;
        if (ttl <= 0) {
          return {
            success: false,
            hops: path.slice(0, i + 1).map(id => deviceMap.get(id)?.name || id),
            hopIds: path.slice(0, i + 1),
            targetId: targetDevice.id,
            error: language === 'tr' ? 'ICMP Zaman Aşımı (TTL exceeded)' : 'ICMP Time Exceeded (TTL expired)'
          };
        }
      }

      // MAC Learning on switch (ingress) - Hubs do not learn MAC addresses
      if (bDevice && isSwitchDeviceType(bDevice.type) && bDevice.type !== 'hub' && bState && sourceMac) {
        learnMacAddress(bId, sourceMac, dstPortId, sourceVlan, safeDeviceStates);
      }


      // ARP/NDP learning on L3 devices (routers, L3 switches) when packet traverses
      if (aDevice && (aDevice.type === 'router' || aDevice.type === 'switchL3') && sourceMac && sourceIp) {
        if (sourceIp.includes(':')) {
          performNdpResolution(aId, sourceIp, sourceMac, srcPortId || 'Vlan1', safeDeviceStates, aDevice.type === 'router');
        } else {
          performArpResolution(aId, sourceIp, sourceMac, srcPortId || 'Vlan1', safeDeviceStates);
        }
      }
      if (bDevice && (bDevice.type === 'router' || bDevice.type === 'switchL3') && sourceMac && sourceIp) {
        if (sourceIp.includes(':')) {
          performNdpResolution(bId, sourceIp, sourceMac, dstPortId || 'Vlan1', safeDeviceStates, bDevice.type === 'router');
        } else {
          performArpResolution(bId, sourceIp, sourceMac, dstPortId || 'Vlan1', safeDeviceStates);
        }
      }

      // Learn target ARP/NDP on router / L3 switch next to destination
      if (i === path.length - 2 && (aDevice?.type === 'router' || aDevice?.type === 'switchL3') && targetMac && resolvedTargetIp) {
        if (resolvedTargetIp.includes(':')) {
          performNdpResolution(aId, resolvedTargetIp, targetMac, srcPortId || 'Vlan1', safeDeviceStates, targetDevice.type === 'router');
        } else {
          performArpResolution(aId, resolvedTargetIp, targetMac, srcPortId || 'Vlan1', safeDeviceStates);
        }
      }

      let packetInfo = options?.protocol === 'icmp' ? 'Echo Request' : 'Data Packet';

      // If current device is a switch or hub, check frame forwarding/flooding logic
      if (aDevice && isSwitchDeviceType(aDevice.type)) {
        if (aDevice.type === 'hub') {
          packetInfo += ' (Hub L1 Signal Repeated)';
        } else if (targetMac) {
          const knownPort = findMacPort(aId, targetMac, sourceVlan, safeDeviceStates);
          if (!knownPort) {
            packetInfo += ' (Flooded)';
          }
        }
      }

      // Track packets for capture
      capturedPackets.push({
        connectionId: conn.id,
        sourceIp: sourceIp,
        targetIp: resolvedTargetIp,
        protocol: options?.protocol?.toUpperCase() || 'ICMP',
        length: 74,
        info: packetInfo
      });

      // Record Layer-1 signal repetition on all other ports of a Hub
      if (bDevice && bDevice.type === 'hub') {
        const neighbors = adjList.get(bId) || [];
        for (const { connection: hubConn } of neighbors) {
          if (!hubConn || hubConn.active === false || hubConn.id === conn.id) continue;
          capturedPackets.push({
            connectionId: hubConn.id,
            sourceIp: sourceIp,
            targetIp: resolvedTargetIp,
            protocol: options?.protocol?.toUpperCase() || 'ICMP',
            length: 74,
            info: `${packetInfo} (Hub L1 Broadcast)`
          });
        }
      }

    }
  }

  // Record the ARP broadcast request on every switch flood port (all ports except the incoming one)
  // and the ARP reply on every cable of the path, so both also appear in the capture list of
  // each cable the packets traverse.
  if (arpBroadcast) {
    // ARP Reply (unicast) traverses the full path back to the source
    for (let i = 0; i < path.length - 1; i++) {
      const aId = path[i];
      const bId = path[i + 1];
      const conn = pathConnections.get(`${aId}-${bId}`);
      if (conn) {
        if (arpBroadcast.isIpv6) {
          capturedPackets.push({
            connectionId: conn.id,
            sourceIp: arpBroadcast.targetIp,
            targetIp: arpBroadcast.sourceIp,
            protocol: 'ICMPv6',
            length: 72,
            info: `ICMPv6 NA: ${arpBroadcast.targetIp} is at ${targetDevice.macAddress}`
          });
        } else {
          capturedPackets.push({
            connectionId: conn.id,
            sourceIp: arpBroadcast.targetIp,
            targetIp: arpBroadcast.sourceIp,
            protocol: 'ARP',
            length: 42,
            info: `ARP Reply: ${arpBroadcast.targetIp} is at ${targetDevice.macAddress}`
          });
        }
      }
    }
    // ARP Request (broadcast) floods on every switch port except the incoming one
    // and every switch that receives the broadcast learns the source MAC on its
    // ingress port (switch MAC table update).
    const sourceMac = deviceMap.get(sourceId)?.macAddress;
    for (let i = 0; i < path.length - 1; i++) {
      const aId = path[i];
      const bId = path[i + 1];
      const bDev = deviceMap.get(bId);
      if (!bDev || !isSwitchDeviceType(bDev.type)) continue;
      const incomingConn = pathConnections.get(`${aId}-${bId}`);
      const neighbors = adjList.get(bId) || [];
      for (const { connection: conn } of neighbors) {
        if (!conn || conn.active === false) continue;
        if (conn.id === incomingConn?.id) continue;
        const switchPortId = conn.sourceDeviceId === bId ? conn.sourcePort : conn.targetPort;
        const switchPort = safeDeviceStates.get(bId)?.ports?.[switchPortId];
        if (!isPortMemberOfVlan(switchPort, sourceVlan, bDev.type)) continue;

        if (arpBroadcast.isIpv6) {
          const parts = arpBroadcast.targetIp.split(':');
          const lastPart = parts[parts.length - 1];
          capturedPackets.push({
            connectionId: conn.id,
            sourceIp: arpBroadcast.sourceIp,
            targetIp: `ff02::1:ff00:${lastPart}`,
            protocol: 'ICMPv6',
            length: 72,
            info: `ICMPv6 NS: Who has ${arpBroadcast.targetIp}?`
          });
        } else {
          capturedPackets.push({
            connectionId: conn.id,
            sourceIp: arpBroadcast.sourceIp,
            targetIp: '255.255.255.255',
            protocol: 'ARP',
            length: 42,
            info: `ARP Request: Who has ${arpBroadcast.targetIp}? Tell ${arpBroadcast.sourceIp}`
          });
        }

        // The neighbor switch learns the broadcast source MAC on its ingress port (Hubs do not learn MACs)
        const floodNeighborId = conn.sourceDeviceId === bId ? conn.targetDeviceId : conn.sourceDeviceId;
        const floodNeighbor = deviceMap.get(floodNeighborId);
        if (floodNeighbor && isSwitchDeviceType(floodNeighbor.type) && floodNeighbor.type !== 'hub' && sourceMac) {
          const ingressPort = conn.sourceDeviceId === floodNeighborId ? conn.sourcePort : conn.targetPort;
          learnMacAddress(floodNeighborId, sourceMac, ingressPort, sourceVlan, safeDeviceStates);
        }

      }
    }
  }

  // 2.5 Block ping over console-only links (console is management, no ICMP)
  // Only block if the ENTIRE path is console connections (no other data path available)
  let hasConsoleConnection = false;
  let hasNonConsoleConnection = false;

  for (let i = 0; i < path.length - 1; i++) {
    const aId = path[i];
    const bId = path[i + 1];
    const conn = pathConnections.get(`${aId}-${bId}`);
    if (conn?.cableType === 'console') {
      hasConsoleConnection = true;
    } else {
      hasNonConsoleConnection = true;
    }
  }

  // Only block if path has console connection AND no other data connections (like wireless)
  if (hasConsoleConnection && !hasNonConsoleConnection) {
    return {
      success: false,
      hops: path.map(id => deviceMap.get(id)?.name || id),
      hopIds: path,
      targetId: targetDevice.id,
      error: language === 'tr'
        ? 'Console bağlantısı üzerinden ping yapılamaz.'
        : 'Ping cannot be sent over a console connection.'
    };
  }

  const hopNames = path.map(id => deviceMap.get(id)?.name || id);

  // 2.5. Check subnet compatibility (Layer 3)
  if (sourceDeviceForSubnet && targetDevice) {
    const isSourceIpv6 = sourceIp.includes(':');

    let isInSameSubnet = false;
    if (isTargetIpv6 && isSourceIpv6) {
      // Find prefix length for source
      let prefixLength = 64;
      if (deviceStates) {
        // BOLT: Use pre-resolved safeDeviceStates
        const state = safeDeviceStates.get(sourceId);
        if (state) {
          for (const pId in state.ports) {
            if (state.ports[pId].ipv6Address === sourceIp) {
              prefixLength = state.ports[pId].ipv6Prefix || 64;
              break;
            }
          }
        }
      }
      isInSameSubnet = isIpv6InNetwork(resolvedTargetIp, sourceIp, prefixLength);
    } else if (!isTargetIpv6 && !isSourceIpv6) {
      // BOLT: Use pre-resolved safeDeviceStates
      const sourceSubnet = getSubnetForDeviceIp(sourceId, sourceIp, devices, safeDeviceStates) || sourceDeviceForSubnet.subnet || '255.255.255.0';
      const targetSubnet = targetDevice.subnet || '255.255.255.0';

      const isSourceInSameSubnet = isIpInSubnet(sourceIp, resolvedTargetIp, sourceSubnet);
      const isTargetInSameSubnet = isIpInSubnet(resolvedTargetIp, sourceIp, targetSubnet);

      // Both sides must consider each other in their local subnet for direct L2 communication without a gateway/router
      isInSameSubnet = isSourceInSameSubnet && isTargetInSameSubnet;
    }

    routingRequired = !isInSameSubnet;

    if (!isInSameSubnet) {
      // 1. Source host (PC/IoT/Mobile/Printer) needs a configured gateway in its own subnet to reach an outside subnet
      if (sourceDeviceForSubnet.type === 'pc' || sourceDeviceForSubnet.type === 'iot' || sourceDeviceForSubnet.type === 'mobile' || sourceDeviceForSubnet.type === 'printer') {
        const sourceGateway = sourceDeviceForSubnet.gateway;
        if (!sourceGateway) {
          return {
            success: false,
            hops: hopNames.slice(0, 1),
            hopIds: path.slice(0, 1),
            targetId: targetDevice.id,
            error: language === 'tr'
              ? `Ağ geçidi (Default Gateway) yapılandırılmamış.`
              : `Default Gateway is not configured on source host.`
          };
        }
        // Gateway must be within the source's own subnet
        const sourceSubnet = getSubnetForDeviceIp(sourceId, sourceIp, devices, safeDeviceStates) || sourceDeviceForSubnet.subnet || '255.255.255.0';
        if (!isIpInSubnet(sourceIp, sourceGateway, sourceSubnet)) {
          return {
            success: false,
            hops: hopNames.slice(0, 1),
            hopIds: path.slice(0, 1),
            targetId: targetDevice.id,
            error: language === 'tr'
              ? `Ağ geçidi (Default Gateway) kaynak cihaz ile aynı ağ bloğunda değil.`
              : `Default Gateway is not in the same subnet as the source host.`
          };
        }
      }

      // 2. Target host (PC/IoT/Mobile/Printer) needs a configured gateway in its own subnet to send replies back to an outside subnet
      if (targetDevice.type === 'pc' || targetDevice.type === 'iot' || targetDevice.type === 'mobile' || targetDevice.type === 'printer') {

        const targetGateway = targetDevice.gateway;
        const targetIpToCheck = resolvedTargetIp;
        const targetSubnet = targetDevice.subnet || '255.255.255.0';
        if (!targetGateway) {
          return {
            success: false,
            hops: hopNames,
            hopIds: path,
            targetId: targetDevice.id,
            error: language === 'tr'
              ? `Hedef cihazın Ağ Geçidi (Default Gateway) yapılandırılmamış.`
              : `Default Gateway is not configured on target host.`
          };
        }
        if (!isIpInSubnet(targetIpToCheck, targetGateway, targetSubnet)) {
          return {
            success: false,
            hops: hopNames,
            hopIds: path,
            targetId: targetDevice.id,
            error: language === 'tr'
              ? `Hedef cihazın Ağ Geçidi (Default Gateway) hedef ağ bloğunda değil.`
              : `Default Gateway is not in the same subnet as the target host.`
          };
        }
      }

      // Different subnets - check if there's a Layer-3 routing device in path with proper routes
      let hasL3Gateway = false;

      // Find the first L3 device in the path (the one that will actually route the packet)
      for (const deviceId of path) {
        const device = deviceMap.get(deviceId);
        // BOLT: Use pre-resolved safeDeviceStates
        const state = safeDeviceStates.get(deviceId);
        if ((device?.type === 'router' || device?.type === 'switchL3') && state?.ipRouting) {
          // Check if this router has a route to the destination network
          const routingTable = getRoutingTable(deviceId, safeDeviceStates, devices, connections);
          const route = findRoute(resolvedTargetIp, routingTable);
          if (route || targetDevice.type === 'cloud') {
            hasL3Gateway = true;
            break;
          } else {
            // First L3 device in path doesn't have a route - packet will be dropped
            return {
              success: false,
              hops: hopNames,
              hopIds: path,
              targetId: targetDevice.id,
              error: language === 'tr'
                ? `Hedefe rota bulunamadı. Statik rota yapılandırması gerekli.`
                : `No route to destination. Static route configuration required.`
            };
          }
        }
      }

      // If no router in path with proper route, try to find a connected router
      if (!hasL3Gateway) {
        // Find all routers in the topology
        const routers = devices.filter(d => (d.type === 'router' || d.type === 'switchL3'));
        for (const router of routers) {
          // BOLT: Use pre-resolved safeDeviceStates
          const routerState = safeDeviceStates.get(router.id);
          if (routerState?.ipRouting) {
            // Check if router has a route to destination
            const routingTable = getRoutingTable(router.id, safeDeviceStates, devices, connections);
            const route = findRoute(resolvedTargetIp, routingTable);
            if (!route && targetDevice.type !== 'cloud') continue; // Skip routers without proper route

            // Check if router is connected to any device in the path
            for (const pathDeviceId of path) {
              const conn = adjList.get(router.id)?.find(n => n.neighborId === pathDeviceId)?.connection;
              if (conn) {
                hasL3Gateway = true;
                // Add router to path (insert before the connected device)
                const pathIndex = path.indexOf(pathDeviceId);
                if (pathIndex !== -1) {
                  path.splice(pathIndex, 0, router.id);
                  hopNames.splice(pathIndex, 0, router.name);
                }
                break;
              }
            }
            if (hasL3Gateway) break;
          }
        }
      }

      if (!hasL3Gateway && targetDevice.type !== 'cloud') {
        return {
          success: false,
          hops: hopNames,
          hopIds: path,
          targetId: targetDevice.id,
          error: language === 'tr'
            ? `Hedefe rota bulunamadı. Statik rota yapılandırması gerekli.`
            : `No route to destination. Static route configuration required.`
        };
      }
    }
  }

  // 3. Validate endpoint VLANs when PCs are involved (PC VLAN must match adjacent switch access VLAN).
  if (deviceStates && path.length >= 2) {
    for (let i = 0; i < path.length - 1; i++) {
      const aId = path[i];
      const bId = path[i + 1];
      const a = deviceMap.get(aId);
      const b = deviceMap.get(bId);
      const conn = pathConnections.get(`${aId}-${bId}`);
      if (!a || !b || !conn) continue;

      // If a PC connects to a switch, enforce VLAN match unless the switch port is trunk.
      const pc = a.type === 'pc' ? a : b.type === 'pc' ? b : null;
      const sw = isSwitchDeviceType(a.type) ? a : isSwitchDeviceType(b.type) ? b : null;
      if (pc && sw) {
        const swPortId = conn.sourceDeviceId === sw.id ? conn.sourcePort : conn.targetPort;
        // BOLT: Use pre-resolved safeDeviceStates
        const swState = safeDeviceStates.get(sw.id);
        const swPort = swState?.ports?.[swPortId];
        const swVlan = getPortVlan(swPort);
        const pcVlan = Number(pc.vlan || 1);

        // Allow ping if switch port forms a trunk (explicit or DTP-negotiated) OR if VLANs match
        const pcPortId = conn.sourceDeviceId === sw.id ? conn.targetPort : conn.sourcePort;
        const pcDevice = deviceMap.get(pc.id);
        const pcPort = pcDevice?.ports?.find(p => p.id === pcPortId);
        if (!portsFormTrunk(pcPort?.mode, swPort?.mode) && swVlan !== pcVlan) {
          return {
            success: false,
            hops: hopNames.slice(0, i + 2),
            hopIds: path.slice(0, i + 2),
            targetId: targetDevice.id,
            error: `VLAN mismatch: ${pc.name} is in VLAN ${pcVlan}, but ${sw.name} port ${swPortId} is VLAN ${swVlan}.`,
          };
        }

        // Check port security on switch port
        if (swPort?.portSecurity?.enabled && pc.macAddress) {
          // BOLT: Use pre-resolved safeDeviceStates
          const violation = checkPortSecurityViolation(sw.id, swPortId, pc.macAddress, safeDeviceStates);
          if (violation) {
            // Track violation for React state update
            portSecurityViolations.push({
              deviceId: sw.id,
              portId: swPortId,
              action: violation.action,
              mac: pc.macAddress
            });

            // Handle violation action
            if (violation.action === 'shutdown') {
              return {
                success: false,
                hops: hopNames.slice(0, i + 2),
                hopIds: path.slice(0, i + 2),
                targetId: targetDevice.id,
                error: `Port security violation: ${sw.name} port ${swPortId} has been shut down due to unauthorized MAC ${pc.macAddress}.`,
                portSecurityViolations
              };
            } else if (violation.action === 'restrict') {
              // Allow traffic but log violation
              return {
                success: false,
                hops: hopNames.slice(0, i + 2),
                hopIds: path.slice(0, i + 2),
                targetId: targetDevice.id,
                error: `Port security violation: ${sw.name} port ${swPortId} - unauthorized MAC ${pc.macAddress}. Traffic restricted.`,
                portSecurityViolations
              };
            } else if (violation.action === 'protect') {
              // Drop traffic silently (no error message, just drop)
              return {
                success: false,
                hops: hopNames.slice(0, i + 2),
                hopIds: path.slice(0, i + 2),
                targetId: targetDevice.id,
                error: `Request timed out.`,
                portSecurityViolations
              };
            }
          }
        }
      }
    }
  }

  // 3.5. A switch-to-switch trunk is operational only when both link endpoints are trunk.
  if (deviceStates && path.length >= 2) {
    for (let i = 0; i < path.length - 1; i++) {
      const aId = path[i];
      const bId = path[i + 1];
      const a = deviceMap.get(aId);
      const b = deviceMap.get(bId);
      const conn = pathConnections.get(`${aId}-${bId}`);
      if (!a || !b || !conn || !isSwitchDeviceType(a.type) || !isSwitchDeviceType(b.type)) continue;

      const aPortId = conn.sourceDeviceId === aId ? conn.sourcePort : conn.targetPort;
      const bPortId = conn.sourceDeviceId === bId ? conn.sourcePort : conn.targetPort;
      // BOLT: Use pre-resolved safeDeviceStates
      const aPort = safeDeviceStates.get(aId)?.ports?.[aPortId];
      const bPort = safeDeviceStates.get(bId)?.ports?.[bPortId];
      const aIsTrunk = aPort?.mode === 'trunk';
      const bIsTrunk = bPort?.mode === 'trunk';

      if (aIsTrunk !== bIsTrunk) {
        return {
          success: false,
          hops: hopNames.slice(0, i + 2),
          hopIds: path.slice(0, i + 2),
          targetId: targetDevice.id,
          error: language === 'tr'
            ? `Trunk kurulamadı: ${a.name} ${aPortId} ve ${b.name} ${bPortId} portlarının ikisi de trunk modunda olmalı.`
            : `Trunk failed: both ${a.name} ${aPortId} and ${b.name} ${bPortId} must be in trunk mode.`
        };
      }

      if (aIsTrunk && bIsTrunk) {
        const activeVlan = getFallbackVlanFromPath(sourceId);
        if (!isPortMemberOfVlan(aPort, activeVlan) || !isPortMemberOfVlan(bPort, activeVlan)) {
          return {
            success: false,
            hops: hopNames.slice(0, i + 2),
            hopIds: path.slice(0, i + 2),
            targetId: targetDevice.id,
            error: language === 'tr'
              ? `Trunk VLAN filtresi: ${a.name} ${aPortId} ve ${b.name} ${bPortId} üzerinde VLAN ${activeVlan} izinli değil.`
              : `Trunk VLAN filter: VLAN ${activeVlan} is not allowed on ${a.name} ${aPortId} or ${b.name} ${bPortId}.`
          };
        }
      }
    }
  }

  // 4. VLAN check across the path
  if (deviceStates) {
    for (let i = 1; i < path.length - 1; i++) {
      const deviceId = path[i];
      const device = deviceMap.get(deviceId);
      if (device && isSwitchDeviceType(device.type)) {
        // BOLT: Use pre-resolved safeDeviceStates
        const switchState = safeDeviceStates.get(deviceId);
        if (!switchState) continue;

        const prevDeviceId = path[i - 1];
        const nextDeviceId = path[i + 1];

        const ingressConn = pathConnections.get(`${prevDeviceId}-${deviceId}`);
        const egressConn = pathConnections.get(`${deviceId}-${nextDeviceId}`);

        if (ingressConn && egressConn) {
          const ingressPortId = ingressConn.sourceDeviceId === deviceId ? ingressConn.sourcePort : ingressConn.targetPort;
          const egressPortId = egressConn.sourceDeviceId === deviceId ? egressConn.sourcePort : egressConn.targetPort;

          const ingressPort = switchState.ports[ingressPortId];
          const egressPort = switchState.ports[egressPortId];

          // Default to VLAN 1 if not specified
          const ingressVlan = getPortVlan(ingressPort);
          const egressVlan = getPortVlan(egressPort);

          // Check for VLAN mismatch on access ports
          if (ingressVlan !== egressVlan) {
            // Allow if ports form a trunk (explicit or DTP-negotiated)
            if (!portsFormTrunk(ingressPort?.mode, egressPort?.mode)) {
              // Check if there's a router with ipRouting in the path (L3 routing scenario)
              let hasL3RouterInPath = false;
              for (const pathDeviceId of path) {
                const pathDevice = deviceMap.get(pathDeviceId);
                // BOLT: Use pre-resolved safeDeviceStates
                const pathState = safeDeviceStates.get(pathDeviceId);
                if ((pathDevice?.type === 'router' || pathDevice?.type === 'switchL3') && pathState?.ipRouting) {
                  hasL3RouterInPath = true;
                  break;
                }
              }

              // If router with routing is in path, allow different VLANs (router handles inter-VLAN routing)
              if (!hasL3RouterInPath) {
                return {
                  success: false,
                  hops: hopNames.slice(0, i + 1),
                  hopIds: path.slice(0, i + 1),
                  targetId: targetDevice.id,
                  error: `VLAN mismatch on ${device.name}. Port ${ingressPortId} is in VLAN ${ingressVlan}, but port ${egressPortId} is in VLAN ${egressVlan}.`
                };
              }
            }
          }
        }
      }
    }
  }

  // 5. Enforce same-VLAN communication for L2-only simulation
  let l2ConnectivityPossible = false;
  if (deviceStates) {
    const getDeviceVlanForIp = (deviceId: string, ip: string): number | null => {
      const device = deviceMap.get(deviceId);
      if (!device) return null;
      // BOLT: Use pre-resolved safeDeviceStates
      const state = safeDeviceStates.get(deviceId);
      if (!state) return (device.type === 'pc' || device.type === 'iot') ? Number(device.vlan || 1) : 1;

      if (device.type === 'pc' || device.type === 'iot') return getDeviceVlan(device, state);

      // Check all VLAN SVIs first (vlan1, vlan10, vlan20, etc.)
      for (const [portId, port] of Object.entries(state.ports)) {
        if (portId.startsWith('vlan') && port.ipAddress === ip) {
          const vlanMatch = portId.match(/vlan(\d+)/);
          if (vlanMatch) {
            return parseInt(vlanMatch[1], 10);
          }
          return 1;
        }
      }

      // Check routed physical interfaces (L3)
      const onPhysical = Object.values(state.ports).some((p: Port) => p.ipAddress === ip && p.mode === 'routed');
      if (onPhysical) return null;

      return getDeviceVlan(device, state);
    };

    // BOLT: Use pre-resolved safeDeviceStates
    const sourceIp = getPrimaryDeviceIp(sourceId, devices, safeDeviceStates);
    const sourceVlan = sourceIp ? getDeviceVlanForIp(sourceId, sourceIp) : null;
    const targetVlan = getDeviceVlanForIp(targetDevice.id, resolvedTargetIp);

    // Skip VLAN enforcement for L3 routing scenarios
    const isSourceL3 = sourceVlan === null;
    const isTargetL3 = targetVlan === null;

    // Only block if both are L2 devices AND in different VLANs
    if (!isSourceL3 && !isTargetL3 && sourceVlan !== null && targetVlan !== null) {
      // Same VLAN: allow communication
      if (sourceVlan === targetVlan) {
        l2ConnectivityPossible = true;
      } else {
        // Different VLANs: check if router with ipRouting is in path
        let hasL3RouterInPath = false;
        for (const pathDeviceId of path) {
          const pathDevice = deviceMap.get(pathDeviceId);
          // BOLT: Use pre-resolved safeDeviceStates
          const pathState = safeDeviceStates.get(pathDeviceId);
          if ((pathDevice?.type === 'router' || pathDevice?.type === 'switchL3') && pathState?.ipRouting) {
            hasL3RouterInPath = true;
            break;
          }
        }

        // If router with routing is in path, allow different VLANs (router handles inter-VLAN routing)
        if (hasL3RouterInPath) {
          routingRequired = true; // Different VLANs require routing
        } else {
          return {
            success: false,
            hops: hopNames,
            hopIds: path,
            targetId: targetDevice.id,
            error: `VLAN mismatch: source VLAN ${sourceVlan}, target VLAN ${targetVlan}.`
          };
        }
      }
    }
  }

  // 6. Layer 3 Routing Logic - Check if routing is possible between different subnets/VLANs
  let l3ConnectivityPossible = false;
  if (deviceStates) {
    // BOLT: Use pre-resolved safeDeviceStates
    const sourceState = safeDeviceStates.get(sourceId);

    // Check if source has routing capability and a route to target
    const isTargetIpv6 = resolvedTargetIp.includes(':');
    const sourceHasRouting = isTargetIpv6 ? (sourceState?.ipv6Enabled || sourceState?.ipRouting) : sourceState?.ipRouting;

    if (sourceHasRouting) {
      // BOLT: Use pre-resolved safeDeviceStates
      const sourceRoutes = getRoutingTable(sourceId, safeDeviceStates, devices, connections);
      const route = findRoute(resolvedTargetIp, sourceRoutes);

      if (route) {
        l3ConnectivityPossible = true;
      }
    }

    if (!l3ConnectivityPossible) {
      if (targetDevice.type === 'cloud') {
        l3ConnectivityPossible = true;
      } else {
        // Check if there's a router in the path that can route between VLANs
        for (const deviceId of path) {
          // BOLT: Use pre-resolved safeDeviceStates
          const state = safeDeviceStates.get(deviceId);
          const device = deviceMap.get(deviceId);
          const hasRouting = isTargetIpv6 ? (state?.ipv6Enabled || state?.ipRouting) : state?.ipRouting;

          if (hasRouting && (device?.type === 'router' || device?.type === 'switchL3')) {
            // Router in path - check if it has routes to both source and target networks
            // BOLT: Use pre-resolved safeDeviceStates
            const routes = getRoutingTable(deviceId, safeDeviceStates, devices, connections);
            // Get source IP from device data
            const srcIp = getPrimaryDeviceIp(sourceId, devices, safeDeviceStates, isTargetIpv6);
            const sourceRoute = findRoute(srcIp, routes);
            const targetRoute = findRoute(resolvedTargetIp, routes);

            if (sourceRoute && (targetRoute || (targetDevice.type as string) === 'cloud')) {
              l3ConnectivityPossible = true;
              break;
            }
          }
        }
      }
    }

    // If routing was required but no router in the path could handle it
    if (routingRequired && !l3ConnectivityPossible) {
      // For different subnets, routing MUST be possible through an L3 device
      return {
        success: false,
        hops: hopNames,
        hopIds: path,
        targetId: targetDevice.id,
        error: language === 'tr'
          ? 'Yönlendirme başarısız: Geçerli bir rota bulunamadı.'
          : 'Routing failed: No valid route found.'
      };
    }
  }

  // Fallback for simple topologies without advanced device states
  const basicConnectivityPossible = !deviceStates && !routingRequired;

  // Track packet addresses as they are translated while traversing the path.
  let currentSourceIp = getPrimaryDeviceIp(sourceId, devices, safeDeviceStates, resolvedTargetIp.includes(':'));
  let currentTargetIp = resolvedTargetIp;

  // 6.5 DHCP Snooping Enforcement
  // Rogue DHCP server protection: DHCP OFFER/ACK blocked on untrusted ports
  if (deviceStates) {
    for (let i = 0; i < path.length; i++) {
      const deviceId = path[i];
      const state = safeDeviceStates.get(deviceId);
      const device = deviceMap.get(deviceId);

      if (state && device && isSwitchDeviceType(device.type)) {
        if (!state.dhcpSnoopingEnabled) continue;

        const prevDeviceId = i > 0 ? path[i - 1] : null;
        if (!prevDeviceId) continue;

        const ingressConn = pathConnections.get(`${prevDeviceId}-${deviceId}`);
        if (!ingressConn) continue;

        const rawIngressPortId = ingressConn.sourceDeviceId === deviceId ? ingressConn.sourcePort : ingressConn.targetPort;
        if (!rawIngressPortId) continue;

        const normalizedId = normalizePortId(rawIngressPortId) || rawIngressPortId;
        const ingressPort = state.ports[normalizedId];
        if (!ingressPort) continue;

        // Check if this VLAN is being snooped
        const portVlan = getPortVlan(ingressPort);
        const snoopingVlans = state.dhcpSnoopingVlans || [];
        if (snoopingVlans.length > 0 && !snoopingVlans.includes(String(portVlan))) continue;

        if (!ingressPort.dhcpSnoopingTrust) {
          // Untrusted port — block DHCP OFFER/ACK from any source
          // Allow DHCP DISCOVER/REQUEST from clients to pass through to trusted servers
          const isDhcpServerResponse = options?.dhcpMessage === 'offer' || options?.dhcpMessage === 'ack';

          if (isDhcpServerResponse) {
            // Check if the previous-hop device is a DHCP server for more specific error message
            const hopSourceState = safeDeviceStates.get(prevDeviceId);
            const isDhcpServer = hopSourceState ? (
              (hopSourceState.dhcpPools && Object.keys(hopSourceState.dhcpPools).length > 0) ||
              (hopSourceState.services?.dhcp?.pools && hopSourceState.services.dhcp.pools.length > 0)
            ) : false;

            if (isDhcpServer) {
              return {
                success: false,
                hops: hopNames.slice(0, i + 1),
                hopIds: path.slice(0, i + 1),
                targetId: targetDevice.id,
                error: language === 'tr'
                  ? `DHCP snooping: Yetkisiz DHCP sunucusu ${device.name} port ${normalizedId} üzerinden engellendi.`
                  : `DHCP snooping: Rogue DHCP server blocked on ${device.name} port ${normalizedId}.`
              };
            } else {
              return {
                success: false,
                hops: hopNames.slice(0, i + 1),
                hopIds: path.slice(0, i + 1),
                targetId: targetDevice.id,
                error: language === 'tr'
                  ? `DHCP snooping: DHCP OFFER/ACK paketi yetkisiz port ${normalizedId} üzerinden engellendi.`
                  : `DHCP snooping: DHCP OFFER/ACK packet blocked on untrusted port ${normalizedId}.`
              };
            }
          }
        }
      }
    }
  }

  // 7. ACL, NAT & Firewall Logic - Check rules for any firewalls or ACLs in the path
  // BOLT: Use pre-resolved safeDeviceStates
  for (let i = 0; i < path.length; i++) {
    const stepDeviceId = path[i];
    const state = safeDeviceStates.get(stepDeviceId);
    const device = deviceMap.get(stepDeviceId);

    if (state) {
      const prevDeviceId = i > 0 ? path[i - 1] : null;
      const nextDeviceId = i < path.length - 1 ? path[i + 1] : null;

      const ingressConn = prevDeviceId ? pathConnections.get(`${prevDeviceId}-${stepDeviceId}`) : null;
      const egressConn = nextDeviceId ? pathConnections.get(`${stepDeviceId}-${nextDeviceId}`) : null;

      const rawIngressPortId = ingressConn ? (ingressConn.sourceDeviceId === stepDeviceId ? ingressConn.sourcePort : ingressConn.targetPort) : null;
      const rawEgressPortId = egressConn ? (egressConn.sourceDeviceId === stepDeviceId ? egressConn.sourcePort : egressConn.targetPort) : null;

      const ingressPortId = rawIngressPortId ? (normalizePortId(rawIngressPortId) || rawIngressPortId) : null;
      const egressPortId = rawEgressPortId ? (normalizePortId(rawEgressPortId) || rawEgressPortId) : null;

      const ingressPort = ingressPortId ? state.ports[ingressPortId] : null;
      const egressPort = egressPortId ? state.ports[egressPortId] : null;

      // 7.1. Check Inbound ACLs
      if (ingressPort?.accessGroupIn) {
        const aclResult = evaluateAcl(
          ingressPort.accessGroupIn,
          state,
          currentSourceIp,
          currentTargetIp,
          options?.protocol,
          options?.port
        );
        if (aclResult === 'deny') {
          return {
            success: false,
            hops: hopNames.slice(0, i + 1),
            hopIds: path.slice(0, i + 1),
            targetId: targetDevice.id,
            error: language === 'tr'
              ? `Paket ${device?.name} ingress port ${ingressPortId} ACL kuralı nedeniyle engellendi.`
              : `Packet blocked by inbound ACL on ${device?.name} interface ${ingressPortId}.`
          };
        }
      }

      if (ingressPort?.ipv6TrafficFilterIn && currentSourceIp.includes(':')) {
        const aclResult = evaluateIpv6Acl(
          ingressPort.ipv6TrafficFilterIn,
          state,
          currentSourceIp,
          currentTargetIp,
          options?.protocol || 'ipv6'
        );
        if (aclResult === 'deny') {
          return {
            success: false,
            hops: hopNames.slice(0, i + 1),
            hopIds: path.slice(0, i + 1),
            targetId: targetDevice.id,
            error: language === 'tr'
              ? `Paket ${device?.name} ingress port ${ingressPortId} IPv6 ACL kuralı nedeniyle engellendi.`
              : `Packet blocked by inbound IPv6 ACL on ${device?.name} interface ${ingressPortId}.`
          };
        }
      }

      // 7.1.5 NAT Logic (Inside -> Outside or Outside -> Inside)
      if (ingressPortId && egressPortId) {
        const natResult = evaluateNatForHop(
          stepDeviceId,
          state,
          ingressPortId,
          egressPortId,
          currentSourceIp,
          currentTargetIp,
          options,
          language
        );
        if (natResult.error) {
          return {
            success: false,
            hops: hopNames.slice(0, i + 1),
            hopIds: path.slice(0, i + 1),
            targetId: targetDevice.id,
            error: natResult.error,
          };
        }
        if (natResult.newSourceIp) currentSourceIp = natResult.newSourceIp;
        if (natResult.newTargetIp) currentTargetIp = natResult.newTargetIp;
      }

      // 7.2. Check Outbound ACLs
      if (egressPort?.accessGroupOut) {
        const aclResult = evaluateAcl(
          egressPort.accessGroupOut,
          state,
          currentSourceIp,
          currentTargetIp,
          options?.protocol,
          options?.port
        );
        if (aclResult === 'deny') {
          return {
            success: false,
            hops: hopNames.slice(0, i + 1),
            hopIds: path.slice(0, i + 1),
            targetId: targetDevice.id,
            error: language === 'tr'
              ? `Paket ${device?.name} egress port ${egressPortId} ACL kuralı nedeniyle engellendi.`
              : `Packet blocked by outbound ACL on ${device?.name} interface ${egressPortId}.`
          };
        }
      }

      if (egressPort?.ipv6TrafficFilterOut && currentSourceIp.includes(':')) {
        const aclResult = evaluateIpv6Acl(
          egressPort.ipv6TrafficFilterOut,
          state,
          currentSourceIp,
          currentTargetIp,
          options?.protocol || 'ipv6'
        );
        if (aclResult === 'deny') {
          return {
            success: false,
            hops: hopNames.slice(0, i + 1),
            hopIds: path.slice(0, i + 1),
            targetId: targetDevice.id,
            error: language === 'tr'
              ? `Paket ${device?.name} egress port ${egressPortId} IPv6 ACL kuralı nedeniyle engellendi.`
              : `Packet blocked by outbound IPv6 ACL on ${device?.name} interface ${egressPortId}.`
          };
        }
      }
    }

    // 7.3. Legacy Firewall Logic
    if (device?.type === 'firewall') {
      const rules = device.firewallRules || [];
      const enabledRules = rules.filter(r => r.enabled);
      let allowed = enabledRules.length === 0; // Default: ALLOW ALL if no enabled rules

      // Evaluate enabled rules in order
      for (const rule of enabledRules) {
        const sourceMatch = rule.sourceIp === '*' || rule.sourceIp === 'any' || rule.sourceIp === currentSourceIp;
        const targetMatch = rule.targetIp === '*' || rule.targetIp === 'any' || rule.targetIp === currentTargetIp;

        // Protocol matching
        const requestedProtocol = options?.protocol || 'any';
        const protocolMatch = requestedProtocol === 'any' || rule.protocol === 'any' || rule.protocol === requestedProtocol;

        // Port matching
        let portMatch = true;
        if (rule.port !== '*' && rule.port !== 'any') {
          if (options?.port && options.port !== '*') {
            portMatch = rule.port === options.port;
          }
          else if (requestedProtocol !== 'any') {
            if (requestedProtocol === 'tcp' || requestedProtocol === 'udp') {
              portMatch = false;
            }
          }
        }

        if (sourceMatch && targetMatch && protocolMatch && portMatch) {
          allowed = rule.action === 'allow';
          break;
        }
      }

      if (!allowed) {
        return {
          success: false,
          hops: hopNames.slice(0, i + 1),
          hopIds: path.slice(0, i + 1),
          targetId: targetDevice.id,
          error: language === 'tr'
            ? `Paket firewall (${device.name}) kuralı nedeniyle engellendi.`
            : `Packet blocked by firewall (${device.name}) rule.`
        };
      }
    }
  }

  if (!l2ConnectivityPossible && !l3ConnectivityPossible && !basicConnectivityPossible) {
    // If we got here and no connectivity was confirmed, double check management IPs
    // BOLT: Use pre-resolved safeDeviceStates
    if (!getPrimaryDeviceIp(sourceId, devices, safeDeviceStates) && !isManagementIpSet(sourceId, safeDeviceStates)) {
      return { success: false, hops: [], hopIds: [], error: 'Source has no IP address.' };
    }
  }

  return {
    success: true,
    hops: hopNames,
    hopIds: path,
    targetId: targetDevice.id,
    portSecurityViolations,
    traversedPorts,
    capturedPackets
  };
}
