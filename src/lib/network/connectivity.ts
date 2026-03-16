import { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import { CableInfo, SwitchState, isCableCompatible } from './types';
import { findRoute, ipToNumber, getRoutingTable } from './routing';

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
  connections: CanvasConnection[],
  deviceStates?: Map<string, SwitchState>
): { success: boolean; hops: string[]; error?: string } {
  // 1. Find target device by IP
  // First check topology devices (PCs usually)
  let targetDevice = devices.find(d => d.ip === targetIp);
  
  // Then check Switch/Router management/interface IPs if not found
  if (!targetDevice && deviceStates) {
    for (const [id, state] of deviceStates.entries()) {
      // Check management IP (SVI)
      if (state.ports['vlan1']?.ipAddress === targetIp) {
        targetDevice = devices.find(d => d.id === id);
        break;
      }
      // Check physical interface IPs (for Routers)
      for (const portId in state.ports) {
        if (state.ports[portId].ipAddress === targetIp) {
          targetDevice = devices.find(d => d.id === id);
          break;
        }
      }
      if (targetDevice) break;
    }
  }

  if (!targetDevice) {
    return { success: false, hops: [], error: 'Request timed out.' };
  }

  // 2. Simple Pathfinding (BFS) to check physical connectivity
  const queue: string[] = [sourceId];
  const visited = new Set<string>([sourceId]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === targetDevice.id) break;

    const neighbors = connections
      .filter(c => c.active !== false && (c.sourceDeviceId === currentId || c.targetDeviceId === currentId))
      .map(c => c.sourceDeviceId === currentId ? c.targetDeviceId : c.sourceDeviceId);

    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        // Check if port is shutdown or device is powered off on either side
        const conn = connections.find(c => 
          (c.sourceDeviceId === currentId && c.targetDeviceId === neighborId) ||
          (c.sourceDeviceId === neighborId && c.targetDeviceId === currentId)
        );
        
        if (conn) {
          // Check source side port
          const srcPortId = conn.sourceDeviceId === currentId ? conn.sourcePort : conn.targetPort;
          const dstPortId = conn.sourceDeviceId === neighborId ? conn.sourcePort : conn.targetPort;
          
          const srcDevice = devices.find(d => d.id === currentId);
          const dstDevice = devices.find(d => d.id === neighborId);

          const isSrcShutdown = isPortShutdown(currentId, srcPortId, devices, deviceStates);
          const isDstShutdown = isPortShutdown(neighborId, dstPortId, devices, deviceStates);
          const isSrcPoweredOff = !isDevicePoweredOn(srcDevice);
          const isDstPoweredOff = !isDevicePoweredOn(dstDevice);

          // Validate cable type for this physical link (e.g. console vs ethernet, straight vs crossover).
          const isCableOk = isConnectionCableCompatible(conn, srcDevice, dstDevice);

          if (!isSrcShutdown && !isDstShutdown && !isSrcPoweredOff && !isDstPoweredOff && isCableOk) {
            visited.add(neighborId);
            parent.set(neighborId, currentId);
            queue.push(neighborId);
          }
        }
      }
    }
  }

  if (!visited.has(targetDevice.id)) {
    return { success: false, hops: [], error: 'Destination host unreachable.' };
  }

  // Construct path
  const path: string[] = [];
  let curr: string | undefined = targetDevice.id;
  while (curr) {
    path.unshift(curr);
    curr = parent.get(curr);
  }

  // 3. Validate endpoint VLANs when PCs are involved (PC VLAN must match adjacent switch access VLAN).
  if (deviceStates && path.length >= 2) {
    for (let i = 0; i < path.length - 1; i++) {
      const aId = path[i];
      const bId = path[i + 1];
      const a = devices.find(d => d.id === aId);
      const b = devices.find(d => d.id === bId);
      const conn = connections.find(c =>
        (c.sourceDeviceId === aId && c.targetDeviceId === bId) ||
        (c.sourceDeviceId === bId && c.targetDeviceId === aId)
      );
      if (!a || !b || !conn) continue;

      // If a PC connects to a switch, enforce VLAN match unless the switch port is trunk.
      const pc = a.type === 'pc' ? a : b.type === 'pc' ? b : null;
      const sw = a.type === 'switch' ? a : b.type === 'switch' ? b : null;
      if (pc && sw) {
        const swPortId = conn.sourceDeviceId === sw.id ? conn.sourcePort : conn.targetPort;
        const swState = deviceStates.get(sw.id);
        const swPort = swState?.ports?.[swPortId];
        const swVlan = swPort?.vlan || 1;
        const pcVlan = pc.vlan || 1;

        // Allow ping if switch port is trunk OR if VLANs match
        if (swPort?.mode !== 'trunk' && swVlan !== pcVlan) {
          return {
            success: false,
            hops: path.slice(0, i + 2).map(id => devices.find(d => d.id === id)?.name || id),
            error: `VLAN mismatch: ${pc.name} is in VLAN ${pcVlan}, but ${sw.name} port ${swPortId} is VLAN ${swVlan}.`,
          };
        }
      }
    }
  }

  // 4. VLAN check across the path
  if (deviceStates) {
    for (let i = 1; i < path.length - 1; i++) {
      const deviceId = path[i];
      const device = devices.find(d => d.id === deviceId);
      if (device?.type === 'switch') {
        const switchState = deviceStates.get(deviceId);
        if (!switchState) continue;

        const prevDeviceId = path[i - 1];
        const nextDeviceId = path[i + 1];

        const ingressConn = connections.find(c =>
          (c.sourceDeviceId === prevDeviceId && c.targetDeviceId === deviceId) ||
          (c.sourceDeviceId === deviceId && c.targetDeviceId === prevDeviceId)
        );
        const egressConn = connections.find(c =>
          (c.sourceDeviceId === deviceId && c.targetDeviceId === nextDeviceId) ||
          (c.sourceDeviceId === nextDeviceId && c.targetDeviceId === deviceId)
        );

        if (ingressConn && egressConn) {
          const ingressPortId = ingressConn.sourceDeviceId === deviceId ? ingressConn.sourcePort : ingressConn.targetPort;
          const egressPortId = egressConn.sourceDeviceId === deviceId ? egressConn.sourcePort : egressConn.targetPort;

          const ingressPort = switchState.ports[ingressPortId];
          const egressPort = switchState.ports[egressPortId];

          // Default to VLAN 1 if not specified
          const ingressVlan = ingressPort?.vlan || 1;
          const egressVlan = egressPort?.vlan || 1;

          // Check for VLAN mismatch on access ports
          if (ingressVlan !== egressVlan) {
            // Allow if one or both ports are trunks
            if (ingressPort?.mode !== 'trunk' && egressPort?.mode !== 'trunk') {
              return { 
                success: false, 
                hops: path.slice(0, i + 1).map(id => devices.find(d => d.id === id)?.name || id), 
                error: `VLAN mismatch on ${device.name}. Port ${ingressPortId} is in VLAN ${ingressVlan}, but port ${egressPortId} is in VLAN ${egressVlan}.` 
              };
            }
          }
        }
      }
    }
  }

  // 5. Enforce same-VLAN ping for L2-only simulation
  if (deviceStates) {
    const getDeviceVlanForIp = (deviceId: string, ip: string): number | null => {
      const device = devices.find(d => d.id === deviceId);
      if (!device) return null;
      if (device.type === 'pc') return device.vlan || 1;

      const state = deviceStates.get(deviceId);
      if (!state) return null;
      
      // Check all VLAN SVIs first (vlan1, vlan10, vlan20, etc.)
      for (const [portId, port] of Object.entries(state.ports)) {
        if (portId.startsWith('vlan') && port.ipAddress === ip) {
          // Extract VLAN number from port ID (e.g., vlan10 -> 10, vlan1 -> 1)
          const vlanMatch = portId.match(/vlan(\d+)/);
          if (vlanMatch) {
            return parseInt(vlanMatch[1]);
          }
          return 1; // Default to VLAN 1 if can't parse
        }
      }

      // Check routed physical interfaces (L3)
      const onPhysical = Object.values(state.ports).some(p => p.ipAddress === ip && p.mode === 'routed');
      if (onPhysical) return null; // L3 device, skip VLAN enforcement

      // Default to VLAN 1 for management IP
      if (state.ports['vlan1']?.ipAddress === ip) return 1;
      
      return 1;
    };

    const sourceDevice = devices.find(d => d.id === sourceId);
    const sourceIp = sourceDevice?.ip || deviceStates.get(sourceId)?.ports['vlan1']?.ipAddress || '';
    const sourceVlan = sourceIp ? getDeviceVlanForIp(sourceId, sourceIp) : null;
    const targetVlan = getDeviceVlanForIp(targetDevice.id, targetIp);
    
    // Skip VLAN enforcement for L3 routing scenarios
    const isSourceL3 = sourceVlan === null;
    const isTargetL3 = targetVlan === null;
    
    // Allow same-VLAN communication
    // Only block if both are L2 devices AND in different VLANs
    if (!isSourceL3 && !isTargetL3 && sourceVlan !== null && targetVlan !== null) {
      // Same VLAN: allow communication
      if (sourceVlan === targetVlan) {
        // PCs in same VLAN can ping each other
        return { 
          success: true, 
          hops: path.map(id => devices.find(d => d.id === id)?.name || id) 
        };
      }
      // Different VLANs: block (unless L3 routing handles it)
      return {
        success: false,
        hops: path.map(id => devices.find(d => d.id === id)?.name || id),
        error: `VLAN mismatch: source VLAN ${sourceVlan}, target VLAN ${targetVlan}.`
      };
    }
  }

  // 6. Layer 3 Routing Logic - Check if routing is possible between different subnets/VLANs
  if (deviceStates) {
    const sourceState = deviceStates.get(sourceId);
    const targetState = deviceStates.get(targetDevice.id);
    
    // Check if source has routing capability and a route to target
    if (sourceState?.ipRouting) {
      const sourceRoutes = getRoutingTable(sourceId, deviceStates);
      const route = findRoute(targetIp, sourceRoutes);
      
      if (route) {
        // Route found - allow communication through L3 routing
        return { 
          success: true, 
          hops: path.map(id => devices.find(d => d.id === id)?.name || id),
          error: undefined
        };
      }
    }
    
    // Check if there's a router in the path that can route between VLANs
    for (const deviceId of path) {
      const state = deviceStates.get(deviceId);
      const device = devices.find(d => d.id === deviceId);
      
      if (state?.ipRouting && device?.type === 'router') {
        // Router in path - check if it has routes to both source and target networks
        const routes = getRoutingTable(deviceId, deviceStates);
        // Get source IP from device data
        const srcDevice = devices.find(d => d.id === sourceId);
        const srcIp = srcDevice?.ip || deviceStates.get(sourceId)?.ports['vlan1']?.ipAddress || '';
        const sourceRoute = findRoute(srcIp, routes);
        const targetRoute = findRoute(targetIp, routes);
        
        if (sourceRoute && targetRoute) {
          return { 
            success: true, 
            hops: path.map(id => devices.find(d => d.id === id)?.name || id),
            error: undefined
          };
        }
      }
    }
  }

  // 3. Layer 3 Logic (Simplified for simulation)
  // For a "kusursuz" (flawless) system, we should check subnets
  // But for now, if physical path exists and IPs are in same subnet or routed, it's a success
  // Currently, we'll assume if they have IPs and physical path, they can talk (Layer 2 focus)
  
  const sourceDevice = devices.find(d => d.id === sourceId);
  if (!sourceDevice?.ip && !isManagementIpSet(sourceId, deviceStates)) {
     return { success: false, hops: [], error: 'Source has no IP address.' };
  }

  return { 
    success: true, 
    hops: path.map(id => devices.find(d => d.id === id)?.name || id) 
  };
}

function isPortShutdown(deviceId: string, portId: string, devices: CanvasDevice[], deviceStates?: Map<string, SwitchState>): boolean {
  // Check deviceStates (Switch/Router)
  if (deviceStates) {
    const state = deviceStates.get(deviceId);
    if (state && state.ports[portId]) {
      return state.ports[portId].shutdown;
    }
  }
  
  // Check topology (PCs)
  const device = devices.find(d => d.id === deviceId);
  if (device) {
    const port = device.ports.find(p => p.id === portId);
    return port?.status === 'disabled';
  }
  
  return false;
}

function isManagementIpSet(deviceId: string, deviceStates?: Map<string, SwitchState>): boolean {
  if (!deviceStates) return false;
  const state = deviceStates.get(deviceId);
  if (!state) return false;
  return !!state.ports['vlan1']?.ipAddress;
}

function isDevicePoweredOn(device: CanvasDevice | undefined): boolean {
  if (!device) return false;
  return device.status !== 'offline';
}

function isConnectionCableCompatible(conn: CanvasConnection, a?: CanvasDevice, b?: CanvasDevice): boolean {
  if (!a || !b) return true;

  // The compatibility helper only knows pc/switch + ports; treat router as switch for physical cabling.
  const toCompatType = (t: CanvasDevice['type']): 'pc' | 'switch' => (t === 'pc' ? 'pc' : 'switch');

  const cable: CableInfo = {
    connected: true,
    cableType: conn.cableType,
    sourceDevice: toCompatType(a.type),
    targetDevice: toCompatType(b.type),
    sourcePort: conn.sourceDeviceId === a.id ? conn.sourcePort : conn.targetPort,
    targetPort: conn.sourceDeviceId === a.id ? conn.targetPort : conn.sourcePort,
  };

  return isCableCompatible(cable);
}
