import { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import { SwitchState, Port } from './types';
import { calculateOSPFRoutes } from './ospf';
import { calculateEigrpRoutes, calculateEigrp6Routes } from './eigrp-dual';
import { validateSviStatus } from './core/L3Validation';
import { getNetworkAddress } from './core/showHelpers';
import { isIpInSubnet } from './connectivity.utils';
import { evaluateAcl } from './connectivity/acl';


export interface Route {
  destination: string;      // e.g., "192.168.2.0" or "2001:db8:1::"
  subnetMask?: string;       // e.g., "255.255.255.0" (for IPv4)
  prefixLength?: number;     // e.g., 64 (for IPv6)
  nextHop: string;          // e.g., "192.168.1.1" or "2001:db8:1::1" or interface name
  metric?: number;          // Administrative distance/metric
  type: 'connected' | 'static' | 'dynamic'; // Route type
  area?: number;            // For OSPF
  ospfRouteType?: 'E1' | 'E2' | 'N1' | 'N2';
  code?: string;
  interfaceId?: string;
  administrativeDistance?: number;
  asPath?: string;          // For BGP — AS path attribute
  localPreference?: number; // For BGP — local preference attribute
}

/**
 * Build routing table for a device
 */
function buildRoutingTable(
  deviceId: string,
  deviceStates: Map<string, SwitchState>
): Route[] {
  const routes: Route[] = [];
  const state = deviceStates.get(deviceId);
  if (!state) return routes;

  // 1. Connected routes (directly connected networks)
  for (const [portId, port] of Object.entries(state.ports)) {
    if (port.shutdown) continue;

    // Check SVI status if it's a VLAN interface
    if (portId.toLowerCase().startsWith('vlan')) {
      const vlanId = parseInt(portId.replace(/vlan/i, ''), 10);
      if (!isNaN(vlanId)) {
        const sviStatus = validateSviStatus(state, vlanId);
        if (sviStatus.status !== 'up') {
          continue;
        }
      }
    }

    if (port.ipAddress && port.subnetMask) {
      routes.push({
        destination: getNetworkAddress(port.ipAddress, port.subnetMask),
        subnetMask: port.subnetMask,
        nextHop: portId, // Directly connected
        type: 'connected',
        metric: 0
      });
    }
    if (port.ipv6Address && port.ipv6Prefix) {
      routes.push({
        destination: port.ipv6Address,
        prefixLength: port.ipv6Prefix,
        nextHop: portId,
        type: 'connected',
        metric: 0
      });
    }

    // HSRP/VRRP virtual IPs (connected routes if Active)
    if (port.hsrp?.groups) {
      for (const [_, group] of Object.entries(port.hsrp.groups)) {
        if (group.state === 'Active' && group.virtualIp) {
          routes.push({
            destination: group.virtualIp,
            subnetMask: '255.255.255.255', // Host route
            nextHop: portId,
            type: 'connected',
            metric: 0
          });
        }
      }
    }
  }

  // 2. Static routes
  if (state.staticRoutes) {
    routes.push(...state.staticRoutes);
  }
  if (state.ipv6StaticRoutes) {
    routes.push(...state.ipv6StaticRoutes);
  }

  // 3. Dynamic routes (Learned or configured)
  if (state.dynamicRoutes) {
    routes.push(...state.dynamicRoutes);
  }
  if (state.ipv6DynamicRoutes) {
    routes.push(...state.ipv6DynamicRoutes);
  }

  // 4. OSPF Dijkstra SPF based learning
  if (state.routingProtocol === 'ospf') {
    const ospfRoutes = calculateOSPFRoutes(deviceId, deviceStates);
    ospfRoutes.forEach(r => {
      // Don't learn if already have it as connected or static
      if (!routes.some(existing => existing.destination === r.destination && (existing.type === 'connected' || existing.type === 'static'))) {
        routes.push(r);
      }
    });
  }

  // 5. EIGRP DUAL based learning
  if (state.routingProtocol === 'eigrp' && state.eigrpAs) {
    const eigrpRoutes = calculateEigrpRoutes(deviceId, deviceStates);
    eigrpRoutes.forEach(r => {
      if (!routes.some(existing => existing.destination === r.destination && (existing.type === 'connected' || existing.type === 'static'))) {
        routes.push(r);
      }
    });
  }

  // RIP dynamic routing learning
  if (state.routingProtocol === 'rip') {
    const ripRoutes = calculateRipRoutes(deviceId, deviceStates);
    ripRoutes.forEach(r => {
      if (!routes.some(existing => existing.destination === r.destination && (existing.type === 'connected' || existing.type === 'static'))) {
        routes.push(r);
      }
    });
  }

  // 6. OSPFv3 route computation
  if (state.routingProtocol === 'ospfv3') {
    const ospfV3Routes = calculateOSPFRoutes(deviceId, deviceStates);
    ospfV3Routes.forEach(r => {
      if (!routes.some(existing => existing.destination === r.destination && (existing.type === 'connected' || existing.type === 'static'))) {
        routes.push(r);
      }
    });
  }

  // 7. RIPng route computation
  if (state.routingProtocol === 'ripng') {
    const ripngRoutes = calculateRipngRoutes(deviceId, deviceStates);
    ripngRoutes.forEach(r => {
      if (!routes.some(existing => existing.destination === r.destination && (existing.type === 'connected' || existing.type === 'static'))) {
        routes.push(r);
      }
    });
  }

  // 8. EIGRPv6 DUAL based learning
  if (state.eigrp6Config?.as) {
    const eigrp6Routes = calculateEigrp6Routes(deviceId, deviceStates);
    eigrp6Routes.forEach(r => {
      if (!routes.some(existing => existing.destination === r.destination && (existing.type === 'connected' || existing.type === 'static'))) {
        routes.push(r);
      }
    });
  }

  // 9. BGP route exchange — advanced BGP learning from established neighbors
  if (state.routingProtocol === 'bgp' && state.bgpAs) {
    const bgpRoutes = calculateBgpRoutes(deviceId, deviceStates);
    bgpRoutes.forEach(r => {
      if (!routes.some(existing => existing.destination === r.destination && (existing.type === 'connected' || existing.type === 'static'))) {
        routes.push(r);
      }
    });
  }

  return applyRouteRedistribution(deviceId, deviceStates, routes);
}

/**
 * Apply route redistribution rules across protocols for a device
 */
function applyRouteRedistribution(
  deviceId: string,
  deviceStates: Map<string, SwitchState>,
  routes: Route[]
): Route[] {
  const state = deviceStates.get(deviceId);
  if (!state || !state.redistributeRules || state.redistributeRules.length === 0) return routes;

  const result = [...routes];

  state.redistributeRules.forEach(rule => {
    let sourceRoutes: Route[] = [];

    if (rule.sourceProtocol === 'connected') {
      sourceRoutes = routes.filter(r => r.type === 'connected');
    } else if (rule.sourceProtocol === 'static') {
      sourceRoutes = routes.filter(r => r.type === 'static');
    } else if (rule.sourceProtocol === 'rip') {
      sourceRoutes = calculateRipRoutes(deviceId, deviceStates);
    } else if (rule.sourceProtocol === 'ospf') {
      const ospfRoutes = calculateOSPFRoutes(deviceId, deviceStates);
      sourceRoutes = ospfRoutes;
    } else if (rule.sourceProtocol === 'eigrp') {
      const eigrpRoutes = calculateEigrpRoutes(deviceId, deviceStates);
      sourceRoutes = eigrpRoutes;
    } else if (rule.sourceProtocol === 'bgp') {
      sourceRoutes = (state.dynamicRoutes || []).filter(r => r.code === 'B' || r.type === 'dynamic');
    }

    sourceRoutes.forEach(srcRoute => {
      const existsInTable = result.some(r => r.destination === srcRoute.destination && (r.type === 'connected' || r.type === 'static'));
      if (existsInTable) return;

      const codeMap: Record<string, string> = {
        ospf: 'O E2',
        rip: 'R',
        eigrp: 'D EX',
        bgp: 'B'
      };

      const defaultMetricMap: Record<string, number> = {
        ospf: 20,
        rip: 1,
        eigrp: 100,
        bgp: 1
      };

      const redistributedRoute: Route = {
        destination: srcRoute.destination,
        subnetMask: srcRoute.subnetMask,
        nextHop: srcRoute.nextHop || 'directly connected',
        interfaceId: srcRoute.interfaceId,
        metric: rule.metric !== undefined ? rule.metric : (defaultMetricMap[rule.targetProtocol] || 20),
        type: 'dynamic',
        code: codeMap[rule.targetProtocol] || 'O E2',
        administrativeDistance: rule.targetProtocol === 'ospf' ? 110 : rule.targetProtocol === 'rip' ? 120 : rule.targetProtocol === 'eigrp' ? 170 : 20
      };

      result.push(redistributedRoute);
    });
  });

  return result;
}


export interface RouteDecisionDetails {
  route: Route;
  destinationIp: string;
  matchedPrefix: string;
  prefixLength: number;
  administrativeDistance: number;
  metric: number;
  type: string;
  explanation: string;
}

export function getAdministrativeDistance(route: Route): number {
  if (route.administrativeDistance !== undefined) return route.administrativeDistance;
  switch (route.type) {
    case 'connected': return 0;
    case 'static': return 1;
    case 'dynamic':
      if (route.code?.startsWith('D') || route.code === 'EX') return 90; // EIGRP
      if (route.code?.startsWith('O') || route.ospfRouteType) return 110; // OSPF
      if (route.code === 'R') return 120; // RIP
      if (route.code === 'B') return 20;  // BGP
      return 110;
    default:
      return 110;
  }
}

/**
 * Find best route to destination IP with full decision details (LPM, AD, Metric)
 */
export function findRouteDetailed(destinationIp: string, routingTable: Route[]): RouteDecisionDetails | null {
  if (!destinationIp) return null;

  let bestRoute: Route | null = null;
  let bestPrefixLength = -1;
  let bestAd = 999;
  let bestMetric = Infinity;

  const isTargetIpv6 = isIpv6(destinationIp);

  for (const route of routingTable) {
    if (!route.destination) continue;

    const isRouteIpv6 = isIpv6(route.destination);
    if (isTargetIpv6 !== isRouteIpv6) continue;

    let prefixLen = -1;
    let matches = false;

    if (isTargetIpv6) {
      prefixLen = route.prefixLength ?? 0;
      matches = isIpv6InNetwork(destinationIp, route.destination, prefixLen);
    } else {
      if (route.subnetMask) {
        prefixLen = getPrefixLength(route.subnetMask);
        matches = isIpInNetwork(destinationIp, route.destination, route.subnetMask);
      }
    }

    if (!matches) continue;

    const ad = getAdministrativeDistance(route);
    const metric = route.metric ?? 0;

    // Selection rules:
    // 1. Longest Prefix Match (higher prefix length)
    // 2. Lower Administrative Distance (AD)
    // 3. Lower Metric
    if (prefixLen > bestPrefixLength) {
      bestPrefixLength = prefixLen;
      bestAd = ad;
      bestMetric = metric;
      bestRoute = route;
    } else if (prefixLen === bestPrefixLength) {
      if (ad < bestAd) {
        bestAd = ad;
        bestMetric = metric;
        bestRoute = route;
      } else if (ad === bestAd && metric < bestMetric) {
        bestMetric = metric;
        bestRoute = route;
      }
    }
  }

  if (!bestRoute) return null;

  const matchedPrefix = isTargetIpv6
    ? `${bestRoute.destination}/${bestPrefixLength}`
    : `${bestRoute.destination}/${bestPrefixLength}`;

  return {
    route: bestRoute,
    destinationIp,
    matchedPrefix,
    prefixLength: bestPrefixLength,
    administrativeDistance: bestAd,
    metric: bestMetric,
    type: bestRoute.type,
    explanation: `LPM ${matchedPrefix} [AD:${bestAd}/Metric:${bestMetric}] via ${bestRoute.interfaceId || bestRoute.nextHop}`,
  };
}

/**
 * Find best route to destination IP
 */
export function findRoute(destinationIp: string, routingTable: Route[]): Route | null {
  const detailed = findRouteDetailed(destinationIp, routingTable);
  return detailed ? detailed.route : null;
}

/**
 * Check if IP is in network
 */
function isIpInNetwork(ip: string, network: string, subnetMask: string): boolean {
  if (!ip || !network || !subnetMask) {
    return false;
  }
  try {
    const ipNum = ipToNumber(ip);
    const networkNum = ipToNumber(network);
    const maskNum = ipToNumber(subnetMask);

    return (ipNum & maskNum) === (networkNum & maskNum);
  } catch {
    return false;
  }
}

/**
 * Check if address is IPv6
 */
export function isIpv6(address: string): boolean {
  return address.includes(':');
}

/**
 * Expand IPv6 shorthand address
 */
export function expandIpv6(address: string): string {
  if (!address.includes('::')) return address;
  const parts = address.split('::');
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts[1] ? parts[1].split(':') : [];
  const missing = 8 - (left.length + right.length);
  const middle = Array(missing).fill('0');
  return [...left, ...middle, ...right].map(p => p.padStart(4, '0')).join(':');
}

/**
 * Check if IPv6 address is in network
 */
export function isIpv6InNetwork(address: string, network: string, prefixLength: number): boolean {
  if (!address || !network || !isIpv6(address) || !isIpv6(network)) {
    return false;
  }
  try {
    const fullAddress = expandIpv6(address).split(':').map(p => parseInt(p, 16));
    const fullNetwork = expandIpv6(network).split(':').map(p => parseInt(p, 16));

    let bitsRemaining = prefixLength;
    for (let i = 0; i < 8; i++) {
      if (bitsRemaining <= 0) break;
      const bitsInThisGroup = Math.min(bitsRemaining, 16);
      const mask = (0xFFFF << (16 - bitsInThisGroup)) & 0xFFFF;

      if ((fullAddress[i] & mask) !== (fullNetwork[i] & mask)) {
        return false;
      }
      bitsRemaining -= bitsInThisGroup;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert IP string to number
 */
export function ipToNumber(ip: string): number {
  if (!ip) {
    throw new Error('IP address is undefined or empty');
  }
  const octets = ip.split('.');
  if (octets.length !== 4) {
    throw new Error('Invalid IP address format');
  }
  for (const octetStr of octets) {
    const octet = parseInt(octetStr, 10);
    if (isNaN(octet) || octet < 0 || octet > 255) {
      throw new Error('Invalid octet value');
    }
  }
  return octets.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Get prefix length from subnet mask
 */
function getPrefixLength(subnetMask: string): number {
  if (!subnetMask) {
    return 0;
  }
  const maskNum = ipToNumber(subnetMask);
  let count = 0;
  let temp = maskNum;

  while (temp) {
    count += temp & 1;
    temp >>>= 1;
  }

  return count;
}

/**
 * Get routing table for display
 */
export function getRoutingTable(
  deviceId: string,
  deviceStates: Map<string, SwitchState>,
  devices?: CanvasDevice[],
  connections?: CanvasConnection[]
): Route[] {
  const state = deviceStates.get(deviceId);
  if (!state) return [];

  const routes = (devices && connections)
    ? buildRoutingTable(deviceId, deviceStates)
    : buildBasicRoutingTable(state);

  return routes.sort((a, b) => {
    // Sort by type priority: connected < static < dynamic
    const typeOrder = { connected: 0, static: 1, dynamic: 2 };
    const typeDiff = typeOrder[a.type] - typeOrder[b.type];
    if (typeDiff !== 0) return typeDiff;

    // Then by metric
    return (a.metric || 0) - (b.metric || 0);
  });
}

/**
 * Build a basic routing table from just the device state (no topology)
 */
function buildBasicRoutingTable(state: SwitchState): Route[] {
  const routes: Route[] = [];

  // 1. Connected routes
  for (const [portId, port] of Object.entries(state.ports)) {
    if (port.shutdown) continue;

    // Check SVI status if it's a VLAN interface
    if (portId.toLowerCase().startsWith('vlan')) {
      const vlanId = parseInt(portId.replace(/vlan/i, ''), 10);
      if (!isNaN(vlanId)) {
        const sviStatus = validateSviStatus(state, vlanId);
        if (sviStatus.status !== 'up') {
          continue;
        }
      }
    }

    if (port.ipAddress && port.subnetMask) {
      routes.push({
        destination: getNetworkAddress(port.ipAddress, port.subnetMask),
        subnetMask: port.subnetMask,
        nextHop: portId,
        type: 'connected',
        metric: 0
      });
    }
    if (port.ipv6Address && port.ipv6Prefix) {
      routes.push({
        destination: port.ipv6Address,
        prefixLength: port.ipv6Prefix,
        nextHop: portId,
        type: 'connected',
        metric: 0
      });
    }

    // HSRP/VRRP virtual IPs (connected routes if Active)
    if (port.hsrp?.groups) {
      for (const [_, group] of Object.entries(port.hsrp.groups)) {
        if (group.state === 'Active' && group.virtualIp) {
          routes.push({
            destination: group.virtualIp,
            subnetMask: '255.255.255.255',
            nextHop: portId,
            type: 'connected',
            metric: 0
          });
        }
      }
    }
  }

  // 2. Static routes
  if (state.staticRoutes) {
    routes.push(...state.staticRoutes);
  }
  if (state.ipv6StaticRoutes) {
    routes.push(...state.ipv6StaticRoutes);
  }

  // 3. Dynamic routes
  if (state.dynamicRoutes) {
    routes.push(...state.dynamicRoutes);
  }
  if (state.ipv6DynamicRoutes) {
    routes.push(...state.ipv6DynamicRoutes);
  }

  return routes;
}

export interface L3Hop {
  name: string;
  ip: string;
}

/**
 * Calculate RIP (RIP for IPv4) routes for a device
 */
function calculateRipRoutes(
  deviceId: string,
  deviceStates: Map<string, SwitchState>
): Route[] {
  const routes: Route[] = [];
  const state = deviceStates.get(deviceId);
  if (!state || state.routingProtocol !== 'rip') return routes;

  const visitedAds = new Set<string>();

  for (const [otherId, otherState] of deviceStates) {
    if (otherState.routingProtocol !== 'rip') continue;
    if (otherId === deviceId) continue;

    // Check adjacency
    let isAdjacent = false;
    let neighborIp: string | undefined;
    let localPort: Port | undefined;

    for (const otherPort of Object.values(otherState.ports)) {
      if (!otherPort.ipAddress || !otherPort.subnetMask || otherPort.shutdown) continue;

      for (const thisPort of Object.values(state.ports)) {
        if (!thisPort.ipAddress || !thisPort.subnetMask || thisPort.shutdown) continue;

        if (getNetworkAddress(otherPort.ipAddress, otherPort.subnetMask) === getNetworkAddress(thisPort.ipAddress, thisPort.subnetMask)) {
          isAdjacent = true;
          neighborIp = otherPort.ipAddress;
          localPort = thisPort;
          break;
        }
      }
      if (isAdjacent) break;
    }

    if (!isAdjacent || !neighborIp || !localPort) continue;

    // Collect networks from adjacent RIP neighbor
    for (const otherPort of Object.values(otherState.ports)) {
      if (!otherPort.ipAddress || !otherPort.subnetMask || otherPort.shutdown) continue;

      const dest = getNetworkAddress(otherPort.ipAddress, otherPort.subnetMask);
      const routeKey = `${dest}/${otherPort.subnetMask}`;
      if (visitedAds.has(routeKey)) continue;
      visitedAds.add(routeKey);

      const alreadyHas = Object.values(state.ports).some(
        p => p.ipAddress && p.subnetMask && getNetworkAddress(p.ipAddress, p.subnetMask) === dest
      );
      if (alreadyHas) continue;

      routes.push({
        destination: dest,
        subnetMask: otherPort.subnetMask,
        nextHop: neighborIp,
        type: 'dynamic',
        metric: 120,
        code: 'R',
        administrativeDistance: 120
      });
    }

    // Propagate dynamically learned or configured RIP networks
    for (const route of otherState.dynamicRoutes || []) {
      if (route.type !== 'dynamic' || !route.destination || !route.subnetMask) continue;

      const routeKey = `${route.destination}/${route.subnetMask}`;
      if (visitedAds.has(routeKey)) continue;
      visitedAds.add(routeKey);

      const alreadyHas = Object.values(state.ports).some(
        p => p.ipAddress && p.subnetMask && getNetworkAddress(p.ipAddress, p.subnetMask) === route.destination
      );
      if (alreadyHas) continue;

      routes.push({
        destination: route.destination,
        subnetMask: route.subnetMask,
        nextHop: neighborIp,
        type: 'dynamic',
        metric: 120,
        code: 'R',
        administrativeDistance: 120
      });
    }
  }

  return routes;
}

/**
 * Calculate RIPng (RIP for IPv6) routes for a device
 * Shares connected IPv6 networks from RIPng-enabled interfaces
 */
function calculateRipngRoutes(
  deviceId: string,
  deviceStates: Map<string, SwitchState>
): Route[] {
  const routes: Route[] = [];
  const state = deviceStates.get(deviceId);
  if (!state || state.routingProtocol !== 'ripng') return routes;

  const visitedAds = new Set<string>();

  // Collect RIPng routes from all RIPng-enabled devices
  for (const [otherId, otherState] of deviceStates) {
    if (otherState.routingProtocol !== 'ripng') continue;
    if (otherId === deviceId) continue;

    // Check adjacency: both must share a common subnet
    let isAdjacent = false;
    for (const otherPort of Object.values(otherState.ports)) {
      if (!otherPort.ipv6Address || !otherPort.ipv6Prefix) continue;
      if (!otherPort.ipv6Rip?.enabled) continue;
      if (otherPort.shutdown) continue;

      for (const thisPort of Object.values(state.ports)) {
        if (!thisPort.ipv6Address || !thisPort.ipv6Prefix) continue;
        if (!thisPort.ipv6Rip?.enabled) continue;
        if (thisPort.shutdown) continue;

        if (isIpv6InNetwork(otherPort.ipv6Address, thisPort.ipv6Address, Math.min(otherPort.ipv6Prefix, thisPort.ipv6Prefix))) {
          isAdjacent = true;
          break;
        }
      }
      if (isAdjacent) break;
    }

    if (!isAdjacent) continue;

    // Collect networks advertised by the adjacent RIPng neighbor
    for (const otherPort of Object.values(otherState.ports)) {
      if (!otherPort.ipv6Address || !otherPort.ipv6Prefix) continue;
      if (!otherPort.ipv6Rip?.enabled) continue;
      if (otherPort.shutdown) continue;

      const routeKey = `${otherPort.ipv6Address}/${otherPort.ipv6Prefix}`;
      if (visitedAds.has(routeKey)) continue;
      visitedAds.add(routeKey);

      // Don't add route for the same network this device already has
      const alreadyHas = Object.values(state.ports).some(
        p => p.ipv6Address === otherPort.ipv6Address && p.ipv6Prefix === otherPort.ipv6Prefix
      );
      if (alreadyHas) continue;

      routes.push({
        destination: otherPort.ipv6Address,
        prefixLength: otherPort.ipv6Prefix,
        nextHop: otherPort.ipv6Address,
        type: 'dynamic',
        metric: 1
      });
    }
  }

  return routes;
}

export function getL3Hops(
  sourceId: string,
  targetIp: string,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates: Map<string, SwitchState>
): L3Hop[] {
  const hops: L3Hop[] = [];
  const visited = new Set<string>();

  let currentId = sourceId;
  const targetDevice = devices.find(d => d.ip === targetIp || d.ipv6 === targetIp);
  if (!targetDevice) return [];

  // Helper to find a device by IP address
  const findDeviceByIp = (ip: string): CanvasDevice | undefined => {
    // 1. Check direct device properties
    const directMatch = devices.find(d => d.ip === ip || d.ipv6 === ip);
    if (directMatch) return directMatch;
    // 2. Check port configurations in deviceStates
    for (const [devId, state] of deviceStates.entries()) {
      for (const port of Object.values(state.ports || {})) {
        if (port.ipAddress === ip || port.ipv6Address === ip) {
          return devices.find(d => d.id === devId);
        }
      }
    }
    return undefined;
  };

  for (let step = 0; step < 30; step++) {
    if (visited.has(currentId)) {
      break;
    }
    visited.add(currentId);

    if (currentId === targetDevice.id) {
      break;
    }

    const currentDevice = devices.find(d => d.id === currentId);
    if (!currentDevice) break;

    const currentState = deviceStates.get(currentId);

    // Check if targetIp is directly connected (check state ports AND device-level ip)
    let targetIsDirectlyConnected = false;
    if (currentState) {
      for (const port of Object.values(currentState.ports || {})) {
        if (port.ipAddress && port.subnetMask) {
          if (isIpInSubnet(port.ipAddress, targetIp, port.subnetMask)) {
            targetIsDirectlyConnected = true;
            break;
          }
        }
        if (port.ipv6Address && port.ipv6Prefix) {
          if (isIpv6InNetwork(targetIp, port.ipv6Address, port.ipv6Prefix)) {
            targetIsDirectlyConnected = true;
            break;
          }
        }
      }
    }
    if (!targetIsDirectlyConnected && currentDevice.ip && currentDevice.subnet) {
      if (isIpInSubnet(currentDevice.ip, targetIp, currentDevice.subnet)) {
        targetIsDirectlyConnected = true;
      }
    }

    if (targetIsDirectlyConnected) {
      hops.push({
        name: targetDevice.name,
        ip: targetIp
      });
      break;
    }

    // Not directly connected - Route it
    let nextHopIp: string | undefined;

    if (currentDevice.type === 'pc' || currentDevice.type === 'iot') {
      nextHopIp = currentDevice.gateway;
    } else {
      if (currentState && currentState.ipRouting) {
        const routingTable = getRoutingTable(currentId, deviceStates, devices, connections);
        const route = findRoute(targetIp, routingTable);
        if (route) {
          if (route.type === 'connected') {
            const portId = route.nextHop;
            const conn = connections.find(c =>
              (c.sourceDeviceId === currentId && c.sourcePort === portId) ||
              (c.targetDeviceId === currentId && c.targetPort === portId)
            );
            if (conn) {
              const peerId = conn.sourceDeviceId === currentId ? conn.targetDeviceId : conn.sourceDeviceId;
              const peerDevice = devices.find(d => d.id === peerId);
              if (peerDevice) {
                nextHopIp = peerDevice.ip || peerDevice.ipv6;
              }
            }
          } else {
            nextHopIp = route.nextHop;
          }
        }
      }
    }

    if (!nextHopIp) {
      break;
    }

    const nextDevice = findDeviceByIp(nextHopIp);
    if (!nextDevice) {
      break;
    }

    if (nextDevice.id !== sourceId) {
      hops.push({
        name: nextDevice.name,
        ip: nextHopIp
      });
    }

    currentId = nextDevice.id;
  }

  return hops;
}

/**
 * Recalculate BGP neighbor states across devices in the topology.
 * When neighbor remote-as match on both sides, state is 'Established', otherwise 'Idle'.
 */
export function recalculateBgpNeighbors(
  deviceStates: Map<string, SwitchState>
): Map<string, SwitchState> {
  const updatedStates = new Map<string, SwitchState>(deviceStates);

  // Helper to collect all active IP addresses of a device
  const getActiveDeviceIps = (st: SwitchState): string[] => {
    const ips: string[] = [];
    Object.values(st.ports || {}).forEach(port => {
      if (!port.shutdown && port.ipAddress) {
        ips.push(port.ipAddress);
      }
    });
    return ips;
  };

  deviceStates.forEach((state, deviceId) => {
    if (!state.bgpNeighbors || state.bgpNeighbors.length === 0) return;

    const localAs = String(state.bgpAs || '');
    const localIps = getActiveDeviceIps(state);
    const newNeighborStateMap: Record<string, string> = { ...state.bgpNeighborState };

    const newNeighbors = state.bgpNeighbors.map(n => {
      const neighborIp = n.ip;
      const targetAs = String(n.as || '');
      let isEstablished = false;

      // Search for peer router matching targetAs and neighborIp
      deviceStates.forEach((peerState, peerId) => {
        if (peerId === deviceId) return;
        if (String(peerState.bgpAs || '') !== targetAs) return;

        const peerIps = getActiveDeviceIps(peerState);
        if (!peerIps.includes(neighborIp)) return;

        // Peer must have neighbor pointing back to one of localIps with matching localAs
        const peerHasMatchingNeighbor = (peerState.bgpNeighbors || []).some(
          pn => localIps.includes(pn.ip) && String(pn.as || '') === localAs
        );

        if (peerHasMatchingNeighbor) {
          isEstablished = true;
        }
      });

      const nState = n.shutdown
        ? 'Administratively down'
        : (isEstablished ? 'Established' : 'Idle');
      newNeighborStateMap[neighborIp] = nState;

      return {
        ...n,
        state: nState
      };
    });

    updatedStates.set(deviceId, {
      ...state,
      bgpNeighbors: newNeighbors,
      bgpNeighborState: newNeighborStateMap
    });
  });

  return updatedStates;
}

// ============================================================================
// ADVANCED BGP ROUTE EXCHANGE
// ============================================================================

/** Get all active (up) IPv4 addresses of a device state. */
function getActiveBgpDeviceIps(st: SwitchState): string[] {
  const ips: string[] = [];
  Object.values(st.ports || {}).forEach(port => {
    if (!port.shutdown && port.ipAddress) ips.push(port.ipAddress);
  });
  return ips;
}

/**
 * Collect the IPv4 prefixes a BGP speaker would advertise to its peers.
 * Advertised set = `network <ip> mask <mask>` statements + redistributed
 * routes (`redistribute <proto>`) whose target protocol is BGP.
 */
function collectBgpAdvertisedPrefixes(state: SwitchState): Route[] {
  const prefixes: Route[] = [];

  (state.bgpNetworks || []).forEach(n => {
    if (!n.network || !n.mask) return;
    if (!prefixes.some(p => p.destination === n.network && p.subnetMask === n.mask)) {
      prefixes.push({
        destination: n.network,
        subnetMask: n.mask,
        nextHop: '0.0.0.0',
        metric: 0,
        type: 'dynamic',
        code: 'B'
      });
    }
  });

  const bgpRedist = (state.redistributeRules || []).filter(r => r.targetProtocol === 'bgp');
  if (bgpRedist.length > 0) {
    const connected: Route[] = Object.values(state.ports || {})
      .filter(p => !p.shutdown && !!p.ipAddress && !!p.subnetMask)
      .map(p => ({
        destination: getNetworkAddress(p.ipAddress as string, p.subnetMask as string),
        subnetMask: p.subnetMask as string,
        nextHop: '0.0.0.0',
        metric: 0,
        type: 'dynamic',
        code: 'B'
      }));

    const sourceMap: Record<string, Route[]> = {
      connected,
      static: state.staticRoutes || [],
      ospf: (state.dynamicRoutes || []).filter(r => (r.code || '').startsWith('O')),
      eigrp: (state.dynamicRoutes || []).filter(r => (r.code || '').startsWith('D')),
      rip: (state.dynamicRoutes || []).filter(r => (r.code || '').startsWith('R'))
    };

    bgpRedist.forEach(rule => {
      (sourceMap[rule.sourceProtocol] || []).forEach(src => {
        if (!src.destination) return;
        if (!prefixes.some(p => p.destination === src.destination && p.subnetMask === src.subnetMask)) {
          prefixes.push({
            destination: src.destination,
            subnetMask: src.subnetMask,
            nextHop: '0.0.0.0',
            metric: rule.metric ?? 0,
            type: 'dynamic',
            code: 'B'
          });
        }
      });
    });
  }

  return prefixes;
}

/** Parse a stored prefix-list prefix (e.g. '192.168.1.0/24') into { network, length }. */
function parsePrefixListEntry(prefix: string): { network: string; length: number } | null {
  const match = prefix.match(/^([0-9.]+)\/(\d+)$/);
  if (!match) return null;
  return { network: match[1], length: parseInt(match[2], 10) };
}

/** Apply ge/le semantics and test if candidate prefix falls inside a prefix-list entry. */
function bgpPrefixMatchesEntry(
  entry: { action: 'permit' | 'deny'; prefix: string; ge?: number; le?: number },
  candidate: { destination: string; mask?: string; subnetMask?: string }
): boolean {
  const parsed = parsePrefixListEntry(entry.prefix);
  if (!parsed) return false;
  const prefixIp = ipToNumber(parsed.network);
  const destIp = ipToNumber(candidate.destination);
  const destLength = getPrefixLength(candidate.mask || candidate.subnetMask || '255.255.255.0');

  if (!destIp || !prefixIp) return false;

  const prefixMask = maskFromPrefixLength(parsed.length);
  const inSubnet = (destIp & ipToNumber(prefixMask)) === (prefixIp & ipToNumber(prefixMask));
  if (!inSubnet) return false;

  if (entry.ge !== undefined && destLength < entry.ge) return false;
  if (entry.le !== undefined && destLength > entry.le) return false;
  return true;
}

/** Build a subnet mask string from a prefix length (1-31 kept explicit). */
function maskFromPrefixLength(length: number): string {
  if (length <= 0) return '0.0.0.0';
  const num = length >= 32 ? 0xffffffff : (0xffffffff << (32 - length)) >>> 0;
  return [24, 16, 8, 0].map(shift => (num >>> shift) & 0xff).join('.');
}

/**
 * Evaluate a route-map against a candidate prefix. Returns true when the prefix
 * is permitted (allowed to pass the filter). Missing route-maps deny traffic.
 */
function bgpRouteMapAllows(
  state: SwitchState,
  mapName: string,
  candidate: { destination: string; mask?: string; subnetMask?: string }
): boolean {
  const clauses = (state.routeMaps || {})[mapName];
  if (!clauses || clauses.length === 0) return false;

  const sorted = [...clauses].sort((a, b) => (a.seq || 0) - (b.seq || 0));

  for (const clause of sorted) {
    const matchRules = clause.matchRules || {};
    const matchAll = Object.keys(matchRules).length === 0;

    let clauseMatched = matchAll;
    if (!matchAll) {
      if (typeof matchRules.prefixList === 'string') {
        const entries = (state.prefixLists || {})[matchRules.prefixList];
        clauseMatched = (entries || []).some(e => bgpPrefixMatchesEntry(e, candidate));
      } else if (typeof matchRules.acl === 'string') {
        const aclResult = evaluateAcl(matchRules.acl, state, candidate.destination, candidate.destination, 'ip', 'any');
        clauseMatched = aclResult !== 'deny' && aclResult !== 'none';
      } else if (typeof matchRules.interface === 'string') {
        // Interface matching cannot be verified against a learned prefix — treated as no-match.
        clauseMatched = false;
      } else {
        clauseMatched = true;
      }
    }

    if (!clauseMatched) continue;

    // Deny clause terminates the evaluation and drops the route.
    if (clause.action === 'deny') return false;
    // Permit clause terminates and accepts the route.
    return true;
  }

  // No clause matched → implicit deny.
  return false;
}

/** Extract route-map `set` values for a matched inbound policy. */
function bgpRouteMapSetRules(
  state: SwitchState,
  mapName: string,
  candidate: { destination: string; mask?: string; subnetMask?: string }
): { metric?: number; localPreference?: number; nextHop?: string } {

  const clauses = (state.routeMaps || {})[mapName];
  if (!clauses || clauses.length === 0) return {};

  const sorted = [...clauses].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  for (const clause of sorted) {
    const matchRules = clause.matchRules || {};
    const matchAll = Object.keys(matchRules).length === 0;

    let clauseMatched = matchAll;
    if (!matchAll) {
      if (typeof matchRules.prefixList === 'string') {
        const entries = (state.prefixLists || {})[matchRules.prefixList];
        clauseMatched = (entries || []).some(e => bgpPrefixMatchesEntry(e, candidate));
      } else if (typeof matchRules.acl === 'string') {
        const aclResult = evaluateAcl(matchRules.acl, state, candidate.destination, candidate.destination, 'ip', 'any');
        clauseMatched = aclResult !== 'deny' && aclResult !== 'none';
      }
    }

    if (!clauseMatched || clause.action === 'deny') continue;

    const setRules = clause.setRules || {};
    return {
      metric: typeof setRules.metric === 'number' ? setRules.metric : undefined,
      localPreference: typeof setRules.localPreference === 'number' ? setRules.localPreference : undefined,
      nextHop: typeof setRules.nextHop === 'string' ? setRules.nextHop : undefined
    };
  }
  return {};
}

/**
 * Compute BGP-learned routes for a device from all its Established neighbors.
 * Honors advanced features: next-hop-self, ebgp-multihop, allowas-in, shutdown,
 * maximum-prefix, route-map in/out filtering, aggregate-address summarization.
 */
export function calculateBgpRoutes(
  deviceId: string,
  deviceStates: Map<string, SwitchState>
): Route[] {
  const rawState = deviceStates.get(deviceId);
  if (!rawState || rawState.routingProtocol !== 'bgp' || !rawState.bgpAs) return [];

  const updated = recalculateBgpNeighbors(deviceStates);
  const myState = updated.get(deviceId) || rawState;
  const ownAs = String(myState.bgpAs);
  const myIps = getActiveBgpDeviceIps(myState);
  if (myIps.length === 0) return [];

  const learned: Route[] = [];

  updated.forEach((peerState, peerId) => {
    if (peerId === deviceId) return;
    const peerAs = String(peerState.bgpAs || '');
    if (!peerAs) return;

    // My neighbor config pointing at this peer (must be Established)
    const myNeighbor = (myState.bgpNeighbors || []).find(n =>
      getActiveBgpDeviceIps(peerState).includes(n.ip) && n.state === 'Established' && !n.shutdown
    );
    if (!myNeighbor) return;

    // Peer must be configured back toward me (bidirectional peering)
    const peerNeighborCfg = (peerState.bgpNeighbors || []).find(pn => myIps.includes(pn.ip));
    if (!peerNeighborCfg || peerNeighborCfg.shutdown) return;

    const isIBgp = peerAs === ownAs;
    const asPath = isIBgp ? [] : [peerAs];
    const pathString = `${asPath.join(' ')}${asPath.length ? ' ' : ''}i`;

    const advertised = collectBgpAdvertisedPrefixes(peerState);
    let receivedCount = 0;
    advertised.forEach(prefix => {
      // Outbound policy applied on advertising peer
      if (peerNeighborCfg.routeMapOut && !bgpRouteMapAllows(peerState, peerNeighborCfg.routeMapOut, prefix)) return;

      // AS-loop prevention: drop when our AS already appears in the AS_PATH
      if (asPath.includes(ownAs)) {
        const allowedLoops = myNeighbor.allowAsIn ?? 0;
        const loopCount = asPath.filter(a => a === ownAs).length;
        if (loopCount > allowedLoops) return;
      }

      // Inbound policy applied on receiving router
      if (myNeighbor.routeMapIn && !bgpRouteMapAllows(myState, myNeighbor.routeMapIn, prefix)) return;
      const setRules = myNeighbor.routeMapIn
        ? bgpRouteMapSetRules(myState, myNeighbor.routeMapIn, prefix)
        : {};

      // maximum-prefix inbound guard
      receivedCount += 1;
      if (myNeighbor.maximumPrefix !== undefined && receivedCount > myNeighbor.maximumPrefix) return;

      const nextHop = setRules.nextHop || myNeighbor.ip;

      learned.push({
        destination: prefix.destination,
        subnetMask: prefix.subnetMask,
        nextHop,
        metric: setRules.metric ?? prefix.metric ?? 0,
        type: 'dynamic',
        code: 'B',
        administrativeDistance: isIBgp ? 200 : 20,
        asPath: pathString,
        localPreference: setRules.localPreference ?? 100
      });
    });

    // default-originate: the PEER originates a default route toward me when its
    // neighbor config pointing at me has `default-originate` configured.
    if (peerNeighborCfg.defaultOriginate && !learned.some(l => l.destination === '0.0.0.0' && l.subnetMask === '0.0.0.0')) {
      learned.push({
        destination: '0.0.0.0',
        subnetMask: '0.0.0.0',
        nextHop: myNeighbor.ip,
        metric: 0,
        type: 'dynamic',
        code: 'B',
        administrativeDistance: isIBgp ? 200 : 20,
        asPath: isIBgp ? 'i' : `${peerAs} i`,
        localPreference: 100
      });
    }
  });

  // Deduplicate: prefer most specific prefix (longest mask), then lowest AD.
  const bestByKey = new Map<string, Route>();
  learned.forEach(r => {
    const key = `${r.destination}/${getPrefixLength(r.subnetMask || '255.255.255.255')}`;
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, r);
      return;
    }
    const existingLen = getPrefixLength(existing.subnetMask || '255.255.255.255');
    const newLen = getPrefixLength(r.subnetMask || '255.255.255.255');
    if (newLen > existingLen || (newLen === existingLen && (r.administrativeDistance || 200) < (existing.administrativeDistance || 200))) {
      bestByKey.set(key, r);
    }
  });

  const result = Array.from(bestByKey.values());

  // aggregate-address: add summary routes for prefixes covered by aggregates
  (myState.bgpAggregateAddresses || []).forEach(agg => {
    const aggNum = ipToNumber(agg.network);
    const aggMask = ipToNumber(agg.mask);
    const covered = result.some(r => r.subnetMask && (ipToNumber(r.destination) & aggMask) === (aggNum & aggMask));
    if (covered && !result.some(r => r.destination === agg.network && r.subnetMask === agg.mask)) {
      result.push({
        destination: agg.network,
        subnetMask: agg.mask,
        nextHop: '0.0.0.0',
        metric: 0,
        type: 'dynamic',
        code: 'B',
        administrativeDistance: 200,
        asPath: 'i',
        localPreference: 100
      });
    }
  });

  return result;
}

export interface RoutingLoopIssue {
  type: 'ROUTING_LOOP';
  deviceId: string;
  deviceName: string;
  destination: string;
  nextHop: string;
  loopPath: string[];
  message: string;
}

/**
 * Proactively detect routing loops by walking each device's routing table
 * next-hop chain. A loop exists when chasing a destination's next-hop path
 * revisits a device that was already on the path for the same destination.
 * Interface-based next hops are resolved to the connected peer device using
 * the topology connection graph; a next hop pointing back at its own device
 * is treated as a dangling interface and not flagged.
 */
export function detectRoutingLoops(
  devices: CanvasDevice[],
  deviceStates: Map<string, SwitchState>,
  connections: CanvasConnection[] = []
): RoutingLoopIssue[] {
  const issues: RoutingLoopIssue[] = [];
  if (deviceStates.size === 0) return issues;

  // Map every configured IP (device-level + interface) to its owning device id.
  const ipToDevice = new Map<string, string>();
  devices.forEach(d => {
    if (d.ip) ipToDevice.set(d.ip, d.id);
    if (d.ipv6) ipToDevice.set(d.ipv6, d.id);
  });
  deviceStates.forEach((state, devId) => {
    Object.values(state.ports || {}).forEach(port => {
      if (port.ipAddress) ipToDevice.set(port.ipAddress, devId);
      if (port.ipv6Address) ipToDevice.set(port.ipv6Address, devId);
    });
  });

  // Resolve a (device, interface) to the peer device at the other end of the link.
  const interfaceToPeer = new Map<string, string>();
  connections.forEach(conn => {
    interfaceToPeer.set(`${conn.sourceDeviceId}:${conn.sourcePort}`, conn.targetDeviceId);
    interfaceToPeer.set(`${conn.targetDeviceId}:${conn.targetPort}`, conn.sourceDeviceId);
  });

  const resolveNextHop = (deviceId: string, nextHop: string): string | null => {
    const byIp = ipToDevice.get(nextHop);
    if (byIp) return byIp;
    const byInterface = interfaceToPeer.get(`${deviceId}:${nextHop}`);
    if (byInterface) return byInterface;
    if (nextHop === deviceId) return deviceId;
    return null;
  };

  const deviceNameById = (id: string) => devices.find(d => d.id === id)?.name || id;
  const isL3Device = (d: CanvasDevice) => d.type === 'router' || d.type === 'firewall' || d.type === 'switchL3';

  devices
    .filter(isL3Device)
    .forEach(source => {
      const table = buildRoutingTable(source.id, deviceStates);
      table
        .filter(r => r.type !== 'connected' && r.nextHop && r.nextHop !== '0.0.0.0')
        .forEach(route => {
          const dstKey = `${route.destination}/${route.subnetMask || route.prefixLength || ''}`;
          const path: string[] = [];
          const visitedKeys = new Set<string>();

          let currentDeviceId = resolveNextHop(source.id, route.nextHop);
          if (!currentDeviceId) return;

          let guard = 0;
          while (currentDeviceId && guard++ < 64) {
            // A next hop resolving back to the source device itself is not a
            // loop (dangling/interface route); stop the walk for this route.
            if (currentDeviceId === source.id && path.length === 0) break;

            const key = `${currentDeviceId}:${dstKey}`;
            if (visitedKeys.has(key)) {
              const startIdx = path.indexOf(deviceNameById(currentDeviceId));
              const loopPath = startIdx >= 0
                ? [...path.slice(startIdx), deviceNameById(currentDeviceId)]
                : [...path, deviceNameById(currentDeviceId)];
              issues.push({
                type: 'ROUTING_LOOP',
                deviceId: source.id,
                deviceName: source.name,
                destination: dstKey,
                nextHop: route.nextHop,
                loopPath,
                message: `%ROUTING-3-LOOP_DETECTED: Routing loop detected for ${dstKey}: ${loopPath.join(' \u2192 ')}`
              });
              break;
            }
            visitedKeys.add(key);
            path.push(deviceNameById(currentDeviceId));

            const nextState = deviceStates.get(currentDeviceId);
            if (!nextState) break;
            const nextTable = buildRoutingTable(currentDeviceId, deviceStates);
            const decision = findRouteDetailed(route.destination, nextTable);
            if (!decision?.route || decision.route.type === 'connected') break;
            const nextHopTarget = resolveNextHop(currentDeviceId, decision.route.nextHop);
            if (!nextHopTarget) break;
            currentDeviceId = nextHopTarget;
          }
        });
    });

  return issues;
}

