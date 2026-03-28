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
  _connections: CanvasConnection[],
  deviceStates?: Map<string, SwitchState>
): { success: boolean; hops: string[]; hopIds: string[]; targetId?: string; error?: string } {

  // 1.5. Implicit Wireless Connections
  const connections = [..._connections];
  if (deviceStates) {
    const apDevices = devices.filter(d => ['switch', 'router'].includes(d.type));
    const pcDevices = devices.filter(d => d.type === 'pc' && d.wifi && d.wifi.enabled && d.wifi.ssid);

    for (const pc of pcDevices) {
      const pcWifi = pc.wifi!;
      for (const ap of apDevices) {
        const apState = deviceStates.get(ap.id);
        const wlan = apState?.ports['wlan0'];
        if (wlan && !wlan.shutdown && wlan.wifi?.mode === 'ap' && wlan.wifi?.ssid === pcWifi.ssid) {
          if (!pcWifi.bssid || pcWifi.bssid === ap.id) {
            const apSecurity = wlan.wifi.security || 'open';
            const pcSecurity = pcWifi.security || 'open';
            if (apSecurity === pcSecurity) {
              if (apSecurity === 'open' || wlan.wifi.password === pcWifi.password) {
                connections.push({
                  id: `wireless-${pc.id}-${ap.id}`,
                  sourceDeviceId: pc.id,
                  sourcePort: 'wlan0',
                  targetDeviceId: ap.id,
                  targetPort: 'wlan0',
                  cableType: 'wireless',
                  active: true
                } as CanvasConnection);
              }
            }
          }
        }
      }
    }
  }

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
    return { success: false, hops: [], hopIds: [], error: 'Request timed out.' };
  }

  const getPortVlan = (port: any): number => {
    return Number(port?.accessVlan || port?.vlan || 1);
  };

  const getDeviceVlan = (device: CanvasDevice, state?: SwitchState): number | null => {
    if (device.type === 'pc') {
      const connectedConn = connections.find(conn =>
        conn.sourceDeviceId === device.id || conn.targetDeviceId === device.id
      );
      if (connectedConn && deviceStates) {
        const peerDeviceId = connectedConn.sourceDeviceId === device.id ? connectedConn.targetDeviceId : connectedConn.sourceDeviceId;
        const peerPortId = connectedConn.sourceDeviceId === device.id ? connectedConn.targetPort : connectedConn.sourcePort;
        const peerState = deviceStates.get(peerDeviceId);
        const peerPort = peerState?.ports?.[peerPortId];
        if (peerPort) {
          if (peerPort.mode === 'trunk') return 1;
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
    const accessPort = Object.values(state.ports).find((port: any) => !port.shutdown && port.mode === 'access' && getPortVlan(port) !== 1);
    if (accessPort) return getPortVlan(accessPort);

    return 1;
  };

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
    return { success: false, hops: [], hopIds: [], error: 'Destination host unreachable.' };
  }

  // Construct path
  const path: string[] = [];
  let curr: string | undefined = targetDevice.id;
  while (curr) {
    path.unshift(curr);
    curr = parent.get(curr);
  }

  const hopNames = path.map(id => devices.find(d => d.id === id)?.name || id);

  // 2.5. Check subnet compatibility (Layer 3)
  const sourceDeviceForSubnet = devices.find(d => d.id === sourceId);
  if (sourceDeviceForSubnet && targetDevice) {
    const sourceIp = sourceDeviceForSubnet.ip || '';
    const sourceSubnet = sourceDeviceForSubnet.subnet || '255.255.255.0';
    const targetIp_check = targetIp;
    
    // Resolve target subnet mask
    let targetSubnet = '255.255.255.0';
    if (targetDevice.type === 'pc') {
      targetSubnet = targetDevice.subnet || '255.255.255.0';
    } else if (deviceStates) {
      const state = deviceStates.get(targetDevice.id);
      if (state) {
        for (const pId in state.ports) {
          if (state.ports[pId].ipAddress === targetIp) {
            targetSubnet = state.ports[pId].subnetMask || '255.255.255.0';
            break;
          }
        }
      }
    }

    // Check if source and target are in the same subnet
    const isInSameSubnet = isIpInSubnet(sourceIp, targetIp_check, sourceSubnet);

    if (!isInSameSubnet) {
      // Different subnets - check if there's a router with routing enabled
      let hasRouter = false;
      for (const deviceId of path) {
        const device = devices.find(d => d.id === deviceId);
        const state = deviceStates?.get(deviceId);
        if (device?.type === 'router' && state?.ipRouting) {
          hasRouter = true;
          break;
        }
      }

      if (!hasRouter) {
        return {
          success: false,
          hops: hopNames,
          hopIds: path,
          targetId: targetDevice.id,
          error: `Subnet uyumsuzluğu: Kaynak ${sourceIp}/${sourceSubnet}, Hedef ${targetIp_check}/${targetSubnet}. Router ile routing gerekli.`
        };
      }
    }
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
        const swVlan = getPortVlan(swPort);
        const pcVlan = Number(pc.vlan || 1);

        // Allow ping if switch port is trunk OR if VLANs match
        if (swPort?.mode !== 'trunk' && swVlan !== pcVlan) {
          return {
            success: false,
            hops: hopNames.slice(0, i + 2),
            hopIds: path.slice(0, i + 2),
            targetId: targetDevice.id,
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
          const ingressVlan = getPortVlan(ingressPort);
          const egressVlan = getPortVlan(egressPort);

          // Check for VLAN mismatch on access ports
          if (ingressVlan !== egressVlan) {
            // Allow if one or both ports are trunks
            if (ingressPort?.mode !== 'trunk' && egressPort?.mode !== 'trunk') {
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

  // 5. Enforce same-VLAN ping for L2-only simulation
  if (deviceStates) {
    const getDeviceVlanForIp = (deviceId: string, ip: string): number | null => {
      const device = devices.find(d => d.id === deviceId);
      if (!device) return null;
      const state = deviceStates.get(deviceId);
      if (!state) return device.type === 'pc' ? Number(device.vlan || 1) : 1;

      if (device.type === 'pc') return getDeviceVlan(device, state);

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
      const onPhysical = Object.values(state.ports).some((p: any) => p.ipAddress === ip && p.mode === 'routed');
      if (onPhysical) return null;

      return getDeviceVlan(device, state);
    };

    const sourceDevice = devices.find(d => d.id === sourceId);
    let resolvedSourceIp = sourceDevice?.ip || '';
    if (!resolvedSourceIp && deviceStates) {
      const state = deviceStates.get(sourceId);
      if (state) {
        for (const pId in state.ports) {
          if (state.ports[pId].ipAddress) {
            resolvedSourceIp = state.ports[pId].ipAddress!;
            break;
          }
        }
      }
    }
    const sourceIp = resolvedSourceIp;
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
          hops: hopNames,
          hopIds: path,
          targetId: targetDevice.id
        };
      }
      // Different VLANs: block (unless L3 routing handles it)
      return {
        success: false,
        hops: hopNames,
        hopIds: path,
        targetId: targetDevice.id,
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
          hops: hopNames,
          hopIds: path,
          targetId: targetDevice.id,
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
            hops: hopNames,
            hopIds: path,
            targetId: targetDevice.id,
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
    return { success: false, hops: [], hopIds: [], error: 'Source has no IP address.' };
  }

  return {
    success: true,
    hops: hopNames,
    hopIds: path,
    targetId: targetDevice.id
  };
}

export function checkDeviceConnectivity(
  sourceId: string,
  targetId: string,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates?: Map<string, SwitchState>
): { success: boolean; hops: string[]; hopIds: string[]; targetId?: string; error?: string } {
  const sourceDevice = devices.find(d => d.id === sourceId);
  const targetDevice = devices.find(d => d.id === targetId);

  if (!sourceDevice || !targetDevice) {
    return { success: false, hops: [], hopIds: [], error: 'Destination host unreachable.' };
  }

  let resolvedTargetIp = targetDevice.ip;
  if (!resolvedTargetIp && deviceStates) {
    const targetState = deviceStates.get(targetId);
    if (targetState) {
      for (const pId in targetState.ports) {
        if (targetState.ports[pId].ipAddress) {
          if (sourceDevice.ip) {
            const subnet = sourceDevice.subnet || '255.255.255.0';
            if (isIpInSubnet(sourceDevice.ip, targetState.ports[pId].ipAddress, subnet)) {
              resolvedTargetIp = targetState.ports[pId].ipAddress;
              break;
            }
          }
          if (!resolvedTargetIp) resolvedTargetIp = targetState.ports[pId].ipAddress;
        }
      }
    }
  }
  const targetIp = resolvedTargetIp || '';
  if (!targetIp) {
    return { success: false, hops: [], hopIds: [], error: 'Request timed out.' };
  }

  return checkConnectivity(sourceId, targetIp, devices, connections, deviceStates);
}

/**
 * Detailed ping diagnostics - checks all conditions and returns specific failure reasons
 */
export function getPingDiagnostics(
  sourceId: string,
  targetIp: string,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates?: Map<string, SwitchState>
): { success: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const sourceDevice = devices.find(d => d.id === sourceId);
  let targetDevice = devices.find(d => d.ip === targetIp);
  
  // Resolve target for routers/switches if not found in topology IPs
  if (!targetDevice && deviceStates) {
    for (const [id, state] of deviceStates.entries()) {
      for (const pId in state.ports) {
        if (state.ports[pId].ipAddress === targetIp) {
          targetDevice = devices.find(d => d.id === id);
          break;
        }
      }
      if (targetDevice) break;
    }
  }

  // 1. Check source device exists and is powered on
  if (!sourceDevice) {
    reasons.push('Kaynak cihaz bulunamadı');
    return { success: false, reasons };
  }

  if (sourceDevice.status === 'offline') {
    reasons.push('Kaynak cihaz kapalı (offline)');
    return { success: false, reasons };
  }

  // 2. Check source has IP address
  let sourceIp = sourceDevice.ip || '';
  if (!sourceIp && deviceStates) {
    const state = deviceStates.get(sourceId);
    if (state) {
      for (const pId in state.ports) {
        if (state.ports[pId].ipAddress) {
          sourceIp = state.ports[pId].ipAddress!;
          break;
        }
      }
    }
  }
  if (!sourceIp) {
    reasons.push('Kaynak cihazın IP adresi yok');
    return { success: false, reasons };
  }

  // 3. Check target device exists
  if (!targetDevice) {
    reasons.push('Hedef IP adresi bulunamadı');
    return { success: false, reasons };
  }

  if (targetDevice.status === 'offline') {
    reasons.push('Hedef cihaz kapalı (offline)');
    return { success: false, reasons };
  }

  // 4. Check target has IP address
  if (!targetIp) {
    reasons.push('Hedef cihazın IP adresi yok');
    return { success: false, reasons };
  }

  // 5. Check subnet compatibility
  const sourceSubnet = sourceDevice.subnet || '255.255.255.0';
  const targetSubnet = targetDevice.subnet || '255.255.255.0';

  const isSourceInSameSubnet = isIpInSubnet(sourceIp, targetIp, sourceSubnet);
  const isTargetInSameSubnet = isIpInSubnet(targetIp, sourceIp, targetSubnet);

  if (!isSourceInSameSubnet && !isTargetInSameSubnet) {
    reasons.push(`Subnet uyumsuzluğu: Kaynak ${sourceIp}/${sourceSubnet}, Hedef ${targetIp}/${targetSubnet}. Router ile routing gerekli.`);
    return { success: false, reasons };
  }

  // 6. Check gateway configuration if different subnets
  if (!isSourceInSameSubnet) {
    if (!sourceDevice.gateway) {
      reasons.push("Kaynak cihazın gateway'i yok (farklı subnet)");
    }
  }

  if (!isTargetInSameSubnet) {
    if (!targetDevice.gateway) {
      reasons.push("Hedef cihazın gateway'i yok (farklı subnet)");
    }
  }

  // 7. Check physical connectivity
  const result = checkConnectivity(sourceId, targetIp, devices, connections, deviceStates);
  if (!result.success) {
    if (result.error) {
      reasons.push(result.error);
    } else {
      reasons.push('Fiziksel bağlantı yok');
    }
    return { success: false, reasons };
  }

  // 8. Check interfaces are up
  const sourceConn = connections.find(c => c.sourceDeviceId === sourceId || c.targetDeviceId === sourceId);
  if (sourceConn) {
    const sourcePortId = sourceConn.sourceDeviceId === sourceId ? sourceConn.sourcePort : sourceConn.targetPort;
    if (isPortShutdown(sourceId, sourcePortId, devices, deviceStates)) {
      reasons.push(`Kaynak interface kapalı: ${sourcePortId}`);
      return { success: false, reasons };
    }
  }

  const targetConn = connections.find(c => c.sourceDeviceId === targetDevice.id || c.targetDeviceId === targetDevice.id);
  if (targetConn) {
    const targetPortId = targetConn.sourceDeviceId === targetDevice.id ? targetConn.targetPort : targetConn.sourcePort;
    if (isPortShutdown(targetDevice.id, targetPortId, devices, deviceStates)) {
      reasons.push(`Hedef interface kapalı: ${targetPortId}`);
      return { success: false, reasons };
    }
  }

  // 9. Check VLAN configuration
  if (sourceDevice.vlan && targetDevice.vlan && sourceDevice.vlan !== targetDevice.vlan) {
    reasons.push(`VLAN uyumsuzluğu: Kaynak VLAN ${sourceDevice.vlan}, Hedef VLAN ${targetDevice.vlan}`);
    return { success: false, reasons };
  }

  // 10. Check routing if needed
  if (!isSourceInSameSubnet || !isTargetInSameSubnet) {
    const sourceState = deviceStates?.get(sourceId);
    if (!sourceState?.ipRouting) {
      reasons.push('Kaynak cihazda IP routing etkin değil');
      return { success: false, reasons };
    }
  }

  return { success: true, reasons };
}

/**
 * Check if an IP is in a subnet
 */
function isIpInSubnet(ip: string, targetIp: string, subnet: string): boolean {
  try {
    const ipParts = ip.split('.').map(Number);
    const targetParts = targetIp.split('.').map(Number);
    const subnetParts = subnet.split('.').map(Number);

    for (let i = 0; i < 4; i++) {
      const ipMasked = ipParts[i] & subnetParts[i];
      const targetMasked = targetParts[i] & subnetParts[i];
      if (ipMasked !== targetMasked) return false;
    }
    return true;
  } catch {
    return false;
  }
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
    if (portId === 'wlan0' && device.type === 'pc') {
      return !device.wifi?.enabled;
    }
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
