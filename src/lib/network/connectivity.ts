import { CanvasDevice, CanvasConnection, DeviceType } from '@/components/network/networkTopology.types';
import { CableInfo, SwitchState, isCableCompatible } from './types';
import { findRoute, ipToNumber, getRoutingTable } from './routing';

export type WifiMode = 'ap' | 'client' | 'disabled' | 'sta';

export interface DeviceWifiConfig {
  enabled: boolean;
  ssid: string;
  bssid?: string;
  password?: string;
  security: 'open' | 'wpa' | 'wpa2' | 'wpa3';
  channel: '2.4GHz' | '5GHz';
  mode: WifiMode;
}

const normalizeWifiMode = (mode: string | undefined, fallback: WifiMode): WifiMode => {
  if (!mode) return fallback;
  const words = mode.toLowerCase();
  if (words === 'ap') return 'ap';
  if (words === 'client') return 'client';
  if (words === 'sta') return 'sta';
  if (words === 'disabled') return 'disabled';
  return fallback;
};

const normalizeSecurity = (security: string | undefined): DeviceWifiConfig['security'] => {
  const value = security ? security.toLowerCase() : 'open';
  if (value === 'wpa3') return 'wpa3';
  if (value === 'wpa2') return 'wpa2';
  if (value === 'wpa') return 'wpa';
  return 'open';
};

const normalizeChannel = (channel: string | undefined): DeviceWifiConfig['channel'] => {
  const value = channel ? channel.toLowerCase() : '2.4ghz';
  if (value === '5ghz') return '5GHz';
  return '2.4GHz';
};

export function getDeviceWifiConfig(device: CanvasDevice | undefined, deviceStates?: Map<string, SwitchState>): DeviceWifiConfig | undefined {
  if (!device) return undefined;
  const state = deviceStates?.get(device.id);
  const wlanState = state?.ports['wlan0'];
  const defaultMode: WifiMode = device.type === 'pc' ? 'client' : 'ap';

  if (wlanState?.wifi?.ssid) {
    const mode = normalizeWifiMode(wlanState.wifi.mode, defaultMode);
    const enabled = mode !== 'disabled' && !(wlanState.shutdown ?? false);
    return {
      enabled,
      ssid: wlanState.wifi.ssid,
      password: wlanState.wifi.password,
      security: normalizeSecurity(wlanState.wifi.security),
      channel: normalizeChannel(wlanState.wifi.channel),
      mode,
    };
  }

  if (device.wifi?.ssid) {
    const mode = normalizeWifiMode(device.wifi.mode, defaultMode);
    return {
      enabled: device.wifi.enabled ?? true,
      ssid: device.wifi.ssid,
      password: device.wifi.password,
      security: normalizeSecurity(device.wifi.security),
      channel: normalizeChannel(device.wifi.channel),
      mode,
    };
  }

  const wlanPort = device.ports.find(p => p.id === 'wlan0' && p.wifi?.ssid);
  if (wlanPort && wlanPort.wifi) {
    const mode = normalizeWifiMode(wlanPort.wifi.mode, defaultMode);
    return {
      enabled: mode !== 'disabled' && !(wlanPort.shutdown ?? false),
      ssid: wlanPort.wifi.ssid,
      password: wlanPort.wifi.password,
      security: normalizeSecurity(wlanPort.wifi.security),
      channel: normalizeChannel(wlanPort.wifi.channel),
      mode,
    };
  }

  return undefined;
}

export function getWirelessSignalStrength(
  device: CanvasDevice | undefined,
  devices: CanvasDevice[] = [],
  deviceStates?: Map<string, SwitchState>
): number {
  if (!device) return 0;
  const pcWifi = getDeviceWifiConfig(device, deviceStates);
  if (!pcWifi || !pcWifi.enabled || !pcWifi.ssid) return 0;
  if (pcWifi.mode !== 'client' && pcWifi.mode !== 'sta') return 0;

  const targetSsid = pcWifi.ssid.toLowerCase();
  let minDist = Infinity;

  devices.forEach(dev => {
    if (dev.id === device.id) return;
    const apWifi = getDeviceWifiConfig(dev, deviceStates);
    if (!apWifi || apWifi.mode !== 'ap' || !apWifi.enabled) return;
    if (!apWifi.ssid || apWifi.ssid.toLowerCase() !== targetSsid) return;
    const dx = (device.x || 0) - (dev.x || 0);
    const dy = (device.y || 0) - (dev.y || 0);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) minDist = dist;
  });

  if (minDist === Infinity) return 0;
  if (minDist < 150) return 5;
  if (minDist < 250) return 4;
  if (minDist < 350) return 3;
  if (minDist < 450) return 2;
  if (minDist < 550) return 1;
  return 0;
}

/**
 * Returns the distance (px) to the nearest AP with matching SSID.
 * Returns Infinity if no AP found or device is not a WiFi client.
 */
export function getWirelessDistance(
  device: CanvasDevice | undefined,
  devices: CanvasDevice[] = [],
  deviceStates?: Map<string, SwitchState>
): number {
  if (!device) return Infinity;
  const pcWifi = getDeviceWifiConfig(device, deviceStates);
  if (!pcWifi || !pcWifi.enabled || !pcWifi.ssid) return Infinity;
  if (pcWifi.mode !== 'client' && pcWifi.mode !== 'sta') return Infinity;

  const targetSsid = pcWifi.ssid.toLowerCase();
  let minDist = Infinity;

  devices.forEach(dev => {
    if (dev.id === device.id) return;
    const apWifi = getDeviceWifiConfig(dev, deviceStates);
    if (!apWifi || apWifi.mode !== 'ap' || !apWifi.enabled) return;
    if (!apWifi.ssid || apWifi.ssid.toLowerCase() !== targetSsid) return;
    const dx = (device.x || 0) - (dev.x || 0);
    const dy = (device.y || 0) - (dev.y || 0);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) minDist = dist;
  });

  return minDist;
}

/**
 * Check if a hostname is an external domain (not in local network)
 */
function isExternalDomain(hostname: string, devices: CanvasDevice[], deviceStates?: Map<string, SwitchState>): boolean {
  // Clean hostname
  const cleanHostname = hostname.toLowerCase().replace(/^www\./, '');

  // Check if it's an IP address (not external)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(cleanHostname)) {
    return false;
  }

  // Check if it matches any local device name
  for (const device of devices) {
    const deviceName = device.name?.toLowerCase();
    if (deviceName === cleanHostname) {
      return false;
    }
  }

  // Check if it matches any configured hostname
  if (deviceStates) {
    for (const [deviceId, state] of deviceStates.entries()) {
      const deviceHostname = state.hostname?.toLowerCase();
      if (deviceHostname === cleanHostname) {
        return false;
      }
    }
  }

  // Check if it's a known external domain (has dots and not local)
  if (cleanHostname.includes('.')) {
    const parts = cleanHostname.split('.');
    if (parts.length >= 2) {
      const tld = parts[parts.length - 1];
      // Common TLDs indicate external domains
      const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'co', 'us', 'uk', 'de', 'fr', 'jp', 'cn', 'au', 'ca'];
      return commonTlds.includes(tld);
    }
  }

  return false;
}

/**
 * Simulate external DNS lookup for domain names
 * Generates consistent IP addresses for known domains
 */
function simulateDnsLookup(hostname: string): string | null {
  // Clean hostname
  const cleanHostname = hostname.toLowerCase().replace(/^www\./, '');

  // Known domain mappings (simulated DNS records)
  const knownDomains: Record<string, string> = {
    'google.com': '142.250.185.78',
    'github.com': '140.82.112.4',
    'microsoft.com': '20.112.52.29',
    'amazon.com': '52.94.236.248',
    'facebook.com': '157.240.229.35',
    'twitter.com': '104.244.42.1',
    'linkedin.com': '108.174.10.10',
    'youtube.com': '142.250.185.14',
    'instagram.com': '157.240.229.174',
    'wikipedia.org': '208.80.154.224',
    'stackoverflow.com': '151.101.1.69',
    'a10.com': '52.8.34.123', // Added for the specific case
  };

  // Return known domain IP if exists
  if (knownDomains[cleanHostname]) {
    return knownDomains[cleanHostname];
  }

  // Generate consistent pseudo-random IP for unknown domains
  // This ensures the same domain always gets the same IP
  let hash = 0;
  for (let i = 0; i < cleanHostname.length; i++) {
    const char = cleanHostname.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate IP from hash (ensuring valid public IP ranges)
  const octet1 = Math.abs(hash % 224) + 1; // 1-224 (avoid multicast/reserved)
  const octet2 = Math.abs((hash >> 8) % 256);
  const octet3 = Math.abs((hash >> 16) % 256);
  const octet4 = Math.abs((hash >> 24) % 256);

  // Avoid private IP ranges
  if (octet1 === 10 || (octet1 === 192 && octet2 === 168) || (octet1 === 172 && octet2 >= 16 && octet2 <= 31)) {
    return simulateDnsLookup(cleanHostname + '1'); // Recurse with slight variation
  }

  return `${octet1}.${octet2}.${octet3}.${octet4}`;
}

/**
 * Resolve hostname to IP address
 * Checks device hostnames and domain names to find matching IP
 * Falls back to external DNS lookup for unknown domains
 */
function resolveHostname(
  hostname: string,
  devices: CanvasDevice[],
  deviceStates?: Map<string, SwitchState>
): string | null {
  // Clean hostname (remove www., convert to lowercase)
  const cleanHostname = hostname.toLowerCase().replace(/^www\./, '');

  // 1. Check exact hostname matches against device names
  for (const device of devices) {
    const deviceName = device.name?.toLowerCase();
    if (deviceName === cleanHostname && device.ip) {
      return device.ip;
    }
  }

  // 2. Check against device hostnames in device states
  if (deviceStates) {
    for (const [deviceId, state] of deviceStates.entries()) {
      const deviceHostname = state.hostname?.toLowerCase();
      if (deviceHostname === cleanHostname) {
        // Find the device and get its IP
        const device = devices.find(d => d.id === deviceId);
        if (device?.ip) return device.ip;

        // Check interfaces for IP if device IP is not set
        for (const portId in state.ports) {
          const port = state.ports[portId];
          if (port.ipAddress) {
            return port.ipAddress;
          }
        }
      }
    }
  }

  // 3. Check domain name matches (hostname.domain.com)
  const parts = cleanHostname.split('.');
  if (parts.length > 1) {
    const baseHostname = parts[0];
    const domain = parts.slice(1).join('.');

    // Check devices with matching domain
    if (deviceStates) {
      for (const [deviceId, state] of deviceStates.entries()) {
        const deviceDomain = state.domainName?.toLowerCase();
        const deviceHostname = state.hostname?.toLowerCase();

        if (deviceDomain === domain && deviceHostname === baseHostname) {
          const device = devices.find(d => d.id === deviceId);
          if (device?.ip) return device.ip;

          // Check interfaces for IP
          for (const portId in state.ports) {
            const port = state.ports[portId];
            if (port.ipAddress) {
              return port.ipAddress;
            }
          }
        }
      }
    }
  }

  // 4. Fallback: check if any device name contains the hostname as substring
  for (const device of devices) {
    const deviceName = device.name?.toLowerCase();
    if (deviceName && deviceName.includes(cleanHostname) && device.ip) {
      return device.ip;
    }
  }

  // 5. External DNS lookup for unknown domains
  // This handles external domain names like a10.com, google.com, etc.
  const externalIp = simulateDnsLookup(cleanHostname);
  if (externalIp) {
    return externalIp;
  }

  return null;
}

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
  language: 'tr' | 'en' = 'tr'
): { success: boolean; hops: string[]; hopIds: string[]; targetId?: string; error?: string } {
  const isSwitchDeviceType = (type: DeviceType) => type === 'switchL2' || type === 'switchL3';

  // 1.5. Implicit Wireless Connections
  const connections = [..._connections];
  if (deviceStates) {
    // Get AP devices - routers/switches from topology
    const apDevices = devices.filter(d => isSwitchDeviceType(d.type) || d.type === 'router');
    // Get PC/IoT devices that have WiFi configured - check both device.wifi and deviceStates
    const pcDevices = devices.filter(d => {
      const wifi = getDeviceWifiConfig(d, deviceStates);
      // PC/IoT must have wifi with a non-empty ssid and must be in client mode (not ap)
      return (d.type === 'pc' || d.type === 'iot') && !!wifi && wifi.enabled && !!wifi.ssid && (wifi.mode === 'client' || wifi.mode === 'sta');
    });

    for (const pc of pcDevices) {
      const pcWifi = getDeviceWifiConfig(pc, deviceStates);
      if (!pcWifi || !pcWifi.enabled || !pcWifi.ssid || (pcWifi.mode !== 'client' && pcWifi.mode !== 'sta')) continue;
      for (const ap of apDevices) {
        // Check AP in deviceStates first
        const apState = deviceStates.get(ap.id);
        const wlan = apState?.ports['wlan0'];
        let apWifi = wlan?.wifi;

        // If no wlan in deviceStates, check if AP has WiFi config in topology
        if (!apWifi && ap.wifi && ap.wifi.ssid) {
          apWifi = ap.wifi;
        }

        if (apWifi && (wlan?.shutdown === false || !wlan?.shutdown) && (apWifi.mode || 'ap').toLowerCase() === 'ap' && (apWifi.ssid || '').toLowerCase() === (pcWifi.ssid || '').toLowerCase()) {
          if (!pcWifi.bssid || pcWifi.bssid === ap.id) {
            const apSecurity = (apWifi.security || 'open').toLowerCase();
            const pcSecurity = (pcWifi.security || 'open').toLowerCase();
            if (apSecurity === pcSecurity) {
              if (apSecurity === 'open' || apWifi.password === pcWifi.password) {
                // No signal = no connection
                const signalStrength = getWirelessSignalStrength(pc, devices, deviceStates);
                if (signalStrength > 0) {
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
  }

  // 0. Resolve hostname to IP if necessary
  let resolvedTargetIp = targetIp;
  let isExternal = false;

  // Check if targetIp is a hostname (not an IP address)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(targetIp)) {
    // Check if source device has domain lookup disabled
    const sourceState = deviceStates?.get(sourceId);
    if (sourceState?.domainLookup === false) {
      const dnsServer = sourceState?.dnsServer || '255.255.255.255';
      return { success: false, hops: [], hopIds: [], error: `% Unknown command or domain lookup disabled.\nTranslating "${targetIp}"...domain server (${dnsServer})\n% Unrecognized host or address, or protocol not running.` };
    }

    // Check if this is an external domain
    isExternal = isExternalDomain(targetIp, devices, deviceStates);

    const resolvedIp = resolveHostname(targetIp, devices, deviceStates);
    if (!resolvedIp) {
      return { success: false, hops: [], hopIds: [], error: 'Request timed out.' };
    }
    resolvedTargetIp = resolvedIp;
  }

  // For external domains, simulate successful internet routing
  if (isExternal) {
    const sourceDevice = devices.find(d => d.id === sourceId);
    if (sourceDevice) {
      // Simulate internet routing path
      const hops = ['Internet Gateway', 'ISP Router', 'External Network'];
      const hopIds = [sourceId, 'internet-gateway', 'external-network'];

      return {
        success: true,
        hops,
        hopIds,
        targetId: 'external-domain',
        error: undefined
      };
    }
  }

  // 1. Find target device by IP
  // First check topology devices (PCs usually)
  let targetDevice = devices.find(d => d.ip === resolvedTargetIp);

  // Then check Switch/Router management/interface IPs if not found
  if (!targetDevice && deviceStates) {
    for (const [id, state] of deviceStates.entries()) {
      // Check management IP (SVI)
      if (state.ports['vlan1']?.ipAddress === resolvedTargetIp) {
        targetDevice = devices.find(d => d.id === id);
        break;
      }
      // Check physical interface IPs (for Routers)
      for (const portId in state.ports) {
        if (state.ports[portId].ipAddress === resolvedTargetIp) {
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
    if (device.type === 'pc' || device.type === 'iot') {
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

  // 2.5 Block ping over console-only links (console is management, no ICMP)
  for (let i = 0; i < path.length - 1; i++) {
    const aId = path[i];
    const bId = path[i + 1];
    const conn = connections.find(c =>
      (c.sourceDeviceId === aId && c.targetDeviceId === bId) ||
      (c.sourceDeviceId === bId && c.targetDeviceId === aId)
    );
    if (conn?.cableType === 'console') {
      return {
        success: false,
        hops: path.slice(0, i + 2).map(id => devices.find(d => d.id === id)?.name || id),
        hopIds: path.slice(0, i + 2),
        targetId: targetDevice.id,
        error: language === 'tr'
          ? 'Console bağlantısı üzerinden ping yapılamaz.'
          : 'Ping cannot be sent over a console connection.'
      };
    }
  }

  const hopNames = path.map(id => devices.find(d => d.id === id)?.name || id);

  // 2.5. Check subnet compatibility (Layer 3)
    const sourceDeviceForSubnet = devices.find(d => d.id === sourceId);
  if (sourceDeviceForSubnet && targetDevice) {
    const sourceIp = getPrimaryDeviceIp(sourceId, devices, deviceStates);
    const sourceSubnet = getSubnetForDeviceIp(sourceId, sourceIp, devices, deviceStates) || sourceDeviceForSubnet.subnet || '255.255.255.0';
    const targetIp_check = resolvedTargetIp;

    // Resolve target subnet mask
    let targetSubnet = '255.255.255.0';
    if (targetDevice.type === 'pc') {
      targetSubnet = targetDevice.subnet || '255.255.255.0';
    } else if (deviceStates) {
      const state = deviceStates.get(targetDevice.id);
      if (state) {
        for (const pId in state.ports) {
          if (state.ports[pId].ipAddress === resolvedTargetIp) {
            targetSubnet = state.ports[pId].subnetMask || '255.255.255.0';
            break;
          }
        }
      }
    }

    // Check if source and target are in the same subnet
    const isInSameSubnet = isIpInSubnet(sourceIp, targetIp_check, sourceSubnet);

    if (!isInSameSubnet) {
      // Different subnets - check if there's a Layer-3 routing device in path
      let hasL3Gateway = false;
      for (const deviceId of path) {
        const device = devices.find(d => d.id === deviceId);
        const state = deviceStates?.get(deviceId);
        if ((device?.type === 'router' || device?.type === 'switchL3') && state?.ipRouting) {
          hasL3Gateway = true;
          break;
        }
      }

      if (!hasL3Gateway) {
        return {
          success: false,
          hops: hopNames,
          hopIds: path,
          targetId: targetDevice.id,
          error: `Subnet uyumsuzluğu: Kaynak ${sourceIp}/${sourceSubnet}, Hedef ${targetIp_check}/${targetSubnet}. Layer 3 routing gerekli.`
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
      const sw = isSwitchDeviceType(a.type) ? a : isSwitchDeviceType(b.type) ? b : null;
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
      if (device && isSwitchDeviceType(device.type)) {
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
      const onPhysical = Object.values(state.ports).some((p: any) => p.ipAddress === ip && p.mode === 'routed');
      if (onPhysical) return null;

      return getDeviceVlan(device, state);
    };

    const sourceIp = getPrimaryDeviceIp(sourceId, devices, deviceStates);
    const sourceVlan = sourceIp ? getDeviceVlanForIp(sourceId, sourceIp) : null;
    const targetVlan = getDeviceVlanForIp(targetDevice.id, resolvedTargetIp);

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
      const route = findRoute(resolvedTargetIp, sourceRoutes);

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
        const srcIp = getPrimaryDeviceIp(sourceId, devices, deviceStates);
        const sourceRoute = findRoute(srcIp, routes);
        const targetRoute = findRoute(resolvedTargetIp, routes);

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
  if (!getPrimaryDeviceIp(sourceId, devices, deviceStates) && !isManagementIpSet(sourceId, deviceStates)) {
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
  const sourcePrimaryIp = getPrimaryDeviceIp(sourceId, devices, deviceStates);
  const sourcePrimarySubnet = getSubnetForDeviceIp(sourceId, sourcePrimaryIp, devices, deviceStates) || '255.255.255.0';
  if (!resolvedTargetIp && deviceStates) {
    const targetState = deviceStates.get(targetId);
    if (targetState) {
      for (const pId in targetState.ports) {
        if (targetState.ports[pId].ipAddress) {
          if (sourcePrimaryIp) {
            if (isIpInSubnet(sourcePrimaryIp, targetState.ports[pId].ipAddress, sourcePrimarySubnet)) {
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
  deviceStates?: Map<string, SwitchState>,
  language: 'tr' | 'en' = 'tr'
): { success: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const sourceDevice = devices.find(d => d.id === sourceId);

  // Resolve hostname to IP if necessary
  let resolvedTargetIp = targetIp;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(targetIp)) {
    const resolvedIp = resolveHostname(targetIp, devices, deviceStates);
    if (!resolvedIp) {
      reasons.push('Hostname could not be resolved');
      return { success: false, reasons };
    }
    resolvedTargetIp = resolvedIp;
  }

  let targetDevice = devices.find(d => d.ip === resolvedTargetIp);

  // Resolve target for routers/switches if not found in topology IPs
  if (!targetDevice && deviceStates) {
    for (const [id, state] of deviceStates.entries()) {
      for (const pId in state.ports) {
        if (state.ports[pId].ipAddress === resolvedTargetIp) {
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
  if (!resolvedTargetIp) {
    reasons.push('Hedef cihazın IP adresi yok');
    return { success: false, reasons };
  }

  // 5. Check subnet compatibility
  const sourceSubnet = sourceDevice.subnet || '255.255.255.0';
  const targetSubnet = targetDevice.subnet || '255.255.255.0';

  const isSourceInSameSubnet = isIpInSubnet(sourceIp, resolvedTargetIp, sourceSubnet);
  const isTargetInSameSubnet = isIpInSubnet(resolvedTargetIp, sourceIp, targetSubnet);

  if (!isSourceInSameSubnet && !isTargetInSameSubnet) {
    reasons.push(`Subnet uyumsuzluğu: Kaynak ${sourceIp}/${sourceSubnet}, Hedef ${resolvedTargetIp}/${targetSubnet}. Router ile routing gerekli.`);
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
  const result = checkConnectivity(sourceId, resolvedTargetIp, devices, connections, deviceStates, language);
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

function getPrimaryDeviceIp(
  deviceId: string,
  devices: CanvasDevice[],
  deviceStates?: Map<string, SwitchState>
): string {
  const topologyIp = devices.find(d => d.id === deviceId)?.ip;
  if (topologyIp) return topologyIp;

  const state = deviceStates?.get(deviceId);
  if (!state) return '';

  for (const port of Object.values(state.ports)) {
    if (port.ipAddress) return port.ipAddress;
  }

  return '';
}

function getSubnetForDeviceIp(
  deviceId: string,
  ip: string,
  devices: CanvasDevice[],
  deviceStates?: Map<string, SwitchState>
): string {
  if (!ip) return '';

  const state = deviceStates?.get(deviceId);
  if (state) {
    for (const port of Object.values(state.ports)) {
      if (port.ipAddress === ip && port.subnetMask) {
        return port.subnetMask;
      }
    }
  }

  return devices.find(d => d.id === deviceId)?.subnet || '';
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
  return Object.values(state.ports).some(port => !!port.ipAddress);
}

function isDevicePoweredOn(device: CanvasDevice | undefined): boolean {
  if (!device) return false;
  return device.status !== 'offline';
}

function isConnectionCableCompatible(conn: CanvasConnection, a?: CanvasDevice, b?: CanvasDevice): boolean {
  if (!a || !b) return true;

  const cable: CableInfo = {
    connected: true,
    cableType: conn.cableType,
    sourceDevice: a.type,
    targetDevice: b.type,
    sourcePort: conn.sourceDeviceId === a.id ? conn.sourcePort : conn.targetPort,
    targetPort: conn.sourceDeviceId === a.id ? conn.targetPort : conn.sourcePort,
  };

  return isCableCompatible(cable);
}
