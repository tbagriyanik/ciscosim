import { CanvasDevice, CanvasConnection, DeviceType } from '@/components/network/networkTopology.types';
import { SwitchState } from './types';

export interface Route {
  destination: string;      // e.g., "192.168.2.0"
  subnetMask: string;       // e.g., "255.255.255.0"
  nextHop: string;          // e.g., "192.168.1.1" or interface name
  metric?: number;          // Administrative distance/metric
  type: 'connected' | 'static' | 'dynamic'; // Route type
}

export interface RoutingTable {
  [deviceId: string]: Route[];
}

/**
 * Enhanced connectivity checker with routing support
 */
export function checkConnectivityWithRouting(
  sourceId: string,
  targetIp: string,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates?: Map<string, SwitchState>
): { success: boolean; hops: string[]; error?: string; route?: Route[] } {
  // First, try basic L2 connectivity
  const basicCheck = checkBasicConnectivity(sourceId, targetIp, devices, connections, deviceStates);
  if (basicCheck.success) {
    return basicCheck;
  }

  // If L2 fails, try L3 routing
  if (deviceStates) {
    const routingResult = checkL3Routing(sourceId, targetIp, devices, connections, deviceStates);
    if (routingResult.success) {
      return routingResult;
    }
  }

  return basicCheck; // Return the original L2 failure
}

/**
 * Basic L2 connectivity check (existing logic)
 */
function checkBasicConnectivity(
  sourceId: string,
  targetIp: string,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates?: Map<string, SwitchState>
): { success: boolean; hops: string[]; error?: string } {
  // Import and use existing connectivity logic
  // This would be the existing checkConnectivity function
  // For now, return failure to trigger L3 routing
  return { success: false, hops: [], error: 'L2 connectivity failed' };
}

/**
 * L3 Routing connectivity check
 */
function checkL3Routing(
  sourceId: string,
  targetIp: string,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates: Map<string, SwitchState>
): { success: boolean; hops: string[]; error?: string; route?: Route[] } {
  const sourceDevice = devices.find(d => d.id === sourceId);
  const targetDevice = devices.find(d => d.ip === targetIp);

  if (!sourceDevice || !targetDevice) {
    return { success: false, hops: [], error: 'Device not found' };
  }

  // Check if source has routing capabilities (Router or L3 Switch)
  const sourceState = deviceStates.get(sourceId);
  if (!sourceState || !hasRoutingCapability(sourceDevice, sourceState)) {
    return { success: false, hops: [], error: 'Source device has no routing capability' };
  }

  // Build routing table for source device
  const routingTable = buildRoutingTable(sourceId, devices, connections, deviceStates);

  // Find route to target
  const route = findRoute(targetIp, routingTable);
  if (!route) {
    return { success: false, hops: [], error: 'No route to destination' };
  }

  // Verify path to next hop
  const pathToNextHop = findPathToNextHop(sourceId, route.nextHop, devices, connections, deviceStates);
  if (!pathToNextHop.success) {
    return { success: false, hops: [], error: `Cannot reach next hop: ${route.nextHop}` };
  }

  return {
    success: true,
    hops: [sourceDevice.name, ...pathToNextHop.hops, targetDevice.name],
    route: [route]
  };
}

/**
 * Check if device has routing capability
 */
function hasRoutingCapability(device: CanvasDevice, state: SwitchState): boolean {
  const isSwitchDeviceType = (type: DeviceType) => type === 'switchL2' || type === 'switchL3';
  if (device.type === 'router') return true;
  if (isSwitchDeviceType(device.type) && state.switchLayer === 'L3') return true;
  return false;
}

/**
 * Build routing table for a device
 */
function buildRoutingTable(
  deviceId: string,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates: Map<string, SwitchState>
): Route[] {
  const routes: Route[] = [];
  const state = deviceStates.get(deviceId);
  if (!state) return routes;

  // Connected routes (directly connected networks)
  for (const [portId, port] of Object.entries(state.ports)) {
    if (port.ipAddress && port.subnetMask) {
      routes.push({
        destination: getNetworkAddress(port.ipAddress, port.subnetMask),
        subnetMask: port.subnetMask,
        nextHop: portId, // Directly connected
        type: 'connected'
      });
    }
  }

  // Static routes
  if (state.staticRoutes) {
    routes.push(...state.staticRoutes);
  }

  // Dynamic routes (simplified OSPF/RIP)
  if (state.dynamicRoutes) {
    routes.push(...state.dynamicRoutes);
  }

  return routes;
}

/**
 * Find best route to destination IP
 */
export function findRoute(destinationIp: string, routingTable: Route[]): Route | null {
  let bestRoute: Route | null = null;
  let bestPrefixLength = -1;

  for (const route of routingTable) {
    if (isIpInNetwork(destinationIp, route.destination, route.subnetMask)) {
      const prefixLength = getPrefixLength(route.subnetMask);
      if (prefixLength > bestPrefixLength) {
        bestPrefixLength = prefixLength;
        bestRoute = route;
      }
    }
  }

  return bestRoute;
}

/**
 * Check if IP is in network
 */
function isIpInNetwork(ip: string, network: string, subnetMask: string): boolean {
  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);
  const maskNum = ipToNumber(subnetMask);

  return (ipNum & maskNum) === (networkNum & maskNum);
}

/**
 * Convert IP string to number
 */
export function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

/**
 * Get network address from IP and subnet mask
 */
function getNetworkAddress(ip: string, subnetMask: string): string {
  const ipNum = ipToNumber(ip);
  const maskNum = ipToNumber(subnetMask);
  const networkNum = ipNum & maskNum;

  return numberToIp(networkNum);
}

/**
 * Convert number to IP string
 */
function numberToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.');
}

/**
 * Get prefix length from subnet mask
 */
function getPrefixLength(subnetMask: string): number {
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
 * Find path to next hop
 */
function findPathToNextHop(
  sourceId: string,
  nextHop: string,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates: Map<string, SwitchState>
): { success: boolean; hops: string[] } {
  // Simplified path finding - in reality, this would be more complex
  // For now, assume we can reach the next hop if it's directly connected

  const sourceConnections = connections.filter(c =>
    (c.sourceDeviceId === sourceId || c.targetDeviceId === sourceId) && c.active !== false
  );

  for (const conn of sourceConnections) {
    const neighborId = conn.sourceDeviceId === sourceId ? conn.targetDeviceId : conn.sourceDeviceId;
    const neighborDevice = devices.find(d => d.id === neighborId);

    if (neighborDevice && (neighborDevice.ip === nextHop || neighborDevice.name === nextHop)) {
      return { success: true, hops: [neighborDevice.name] };
    }
  }

  return { success: false, hops: [] };
}

/**
 * Add static route to device
 */
export function addStaticRoute(
  deviceId: string,
  destination: string,
  subnetMask: string,
  nextHop: string,
  deviceStates: Map<string, SwitchState>
): boolean {
  const state = deviceStates.get(deviceId);
  if (!state) return false;

  if (!state.staticRoutes) {
    state.staticRoutes = [];
  }

  // Remove existing route to same destination if exists
  state.staticRoutes = state.staticRoutes.filter(
    route => !(route.destination === destination && route.subnetMask === subnetMask)
  );

  // Add new route
  state.staticRoutes.push({
    destination,
    subnetMask,
    nextHop,
    metric: 1,
    type: 'static'
  });

  return true;
}

/**
 * Remove static route from device
 */
export function removeStaticRoute(
  deviceId: string,
  destination: string,
  subnetMask: string,
  deviceStates: Map<string, SwitchState>
): boolean {
  const state = deviceStates.get(deviceId);
  if (!state || !state.staticRoutes) return false;

  const initialLength = state.staticRoutes.length;
  state.staticRoutes = state.staticRoutes.filter(
    route => !(route.destination === destination && route.subnetMask === subnetMask)
  );

  return state.staticRoutes.length < initialLength;
}

/**
 * Get routing table for display
 */
export function getRoutingTable(
  deviceId: string,
  deviceStates: Map<string, SwitchState>
): Route[] {
  const state = deviceStates.get(deviceId);
  if (!state) return [];

  const routes: Route[] = [];

  // Connected routes
  for (const [portId, port] of Object.entries(state.ports)) {
    if (port.ipAddress && port.subnetMask) {
      routes.push({
        destination: getNetworkAddress(port.ipAddress, port.subnetMask),
        subnetMask: port.subnetMask,
        nextHop: portId,
        metric: 0,
        type: 'connected'
      });
    }
  }

  // Static routes
  if (state.staticRoutes) {
    routes.push(...state.staticRoutes);
  }

  // Dynamic routes
  if (state.dynamicRoutes) {
    routes.push(...state.dynamicRoutes);
  }

  return routes.sort((a, b) => {
    // Sort by type priority: connected < static < dynamic
    const typeOrder = { connected: 0, static: 1, dynamic: 2 };
    const typeDiff = typeOrder[a.type] - typeOrder[b.type];
    if (typeDiff !== 0) return typeDiff;

    // Then by metric
    return (a.metric || 0) - (b.metric || 0);
  });
}
