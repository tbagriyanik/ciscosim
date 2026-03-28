import type { CommandHandler } from './commandTypes';

// Show komutları (show running-config, show vlan, show ip route, vs.)

export const showHandlers: Record<string, CommandHandler> = {
  'show': cmdShow,
  'show running-config': cmdShowRunningConfig,
  'show version': cmdShowVersion,
  'show interfaces': cmdShowInterfaces,
  'show interface': cmdShowInterface,
  'show ip interface brief': cmdShowIpInterfaceBrief,
  'show vlan brief': cmdShowVlan,
  'show vlan': cmdShowVlan,
  'show mac address-table': cmdShowMacAddressTable,
  'show cdp neighbors': cmdShowCdpNeighbors,
  'show ip route': cmdShowIpRoute,
  'show clock': cmdShowClock,
  'show flash': cmdShowFlash,
  'show boot': cmdShowBoot,
  'show spanning-tree': cmdShowSpanningTree,
  'show port-security': cmdShowPortSecurity,
  'show wireless': cmdShowWireless,
  'do show': cmdDoShow,
};

/**
 * Show - Display summary information
 */
function cmdShow(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\n';
  output += `Switch Name: ${state.hostname}\n`;
  output += `MAC Address: ${state.macAddress}\n`;
  output += `IP Routing: ${state.ipRouting ? 'enabled' : 'disabled'}\n`;
  output += `Spanning Tree Mode: ${state.spanningTreeMode || 'pvst'}\n`;
  output += `CDP: ${state.cdpEnabled ? 'enabled' : 'disabled'}\n`;
  output += `VTP Mode: ${state.vtpMode || 'server'}\n`;
  if (state.vtpDomain) {
    output += `VTP Domain: ${state.vtpDomain}\n`;
  }
  output += `\nVLANs: ${Object.keys(state.vlans || {}).length}\n`;
  output += `Ports: ${Object.keys(state.ports || {}).filter((p: string) => !p.toLowerCase().startsWith('vlan')).length}\n`;
  output += `\n!\n`;
  return { success: true, output };
}

/**
 * Show Running Configuration
 */
function cmdShowRunningConfig(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\nBuilding configuration...\n\n';
  output += 'Current configuration : 1024 bytes\n\n';
  output += '!\n';
  output += `version 15.0\n`;
  output += `hostname ${state.hostname || 'Switch'}\n`;

  // Boot system
  output += 'boot system flash:c2960-lanbase-mz.150-2.SE4.bin\n';
  output += '!\n';

  // Service passwords-encryption
  if (state.security?.passwordEncryption) {
    output += 'service password-encryption\n';
  }
  output += '!\n';

  // Spanning-tree mode
  output += `spanning-tree mode ${state.spanningTree?.mode || 'pvst'}\n`;
  output += '!\n';

  // VLANs
  const vlanIds = Object.keys(state.vlans || {}).filter(v => v !== '1');
  if (vlanIds.length > 0) {
    vlanIds.forEach(vlanId => {
      const vlan = state.vlans[vlanId];
      output += `vlan ${vlanId}\n`;
      output += ` name ${vlan?.name || `VLAN${vlanId}`}\n`;
      output += ` state ${vlan?.status || 'active'}\n`;
      output += '!\n';
    });
  }

  // Interfaces
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    output += `interface ${portName}\n`;

    if (port.description) {
      output += ` description ${port.description}\n`;
    }

    if (port.mode === 'trunk') {
      output += ' switchport mode trunk\n';
      if (port.nativeVlan) {
        output += ` switchport trunk native vlan ${port.nativeVlan}\n`;
      }
      if (port.allowedVlans) {
        output += ` switchport trunk allowed vlan ${port.allowedVlans}\n`;
      }
    } else {
      output += ` switchport access vlan ${port.accessVlan || 1}\n`;
    }

    if (port.speed && port.speed !== 'auto') {
      output += ` speed ${port.speed}\n`;
    }

    if (port.duplex && port.duplex !== 'auto') {
      output += ` duplex ${port.duplex}\n`;
    }

    if (port.shutdown) {
      output += ' shutdown\n';
    }

    if (port.ipAddress && port.subnetMask) {
      output += ` ip address ${port.ipAddress} ${port.subnetMask}\n`;
    }

    if (port.spanningTree?.portfast) {
      output += ' spanning-tree portfast\n';
    }

    if (port.spanningTree?.bpduguard) {
      output += ' spanning-tree bpduguard enable\n';
    }

    output += '!\n';
  });

  // Line console
  output += 'line console 0\n';
  if (state.security?.consoleLine?.password) {
    output += ` password ${state.security.consoleLine.password}\n`;
  }
  if (state.security?.consoleLine?.login) {
    output += ' login\n';
  }
  output += '!\n';

  // Line vty
  output += 'line vty 0 15\n';
  if (state.security?.vtyLines?.password) {
    output += ` password ${state.security.vtyLines.password}\n`;
  }
  if (state.security?.vtyLines?.login) {
    output += ` login\n`;
  }
  if (state.security?.vtyLines?.transportInput && state.security.vtyLines.transportInput.length > 0) {
    output += ` transport input ${state.security.vtyLines.transportInput.join(' ')}\n`;
  }
  output += '!\n';

  // Enable secret
  if (state.security?.enableSecret) {
    output += `enable secret ${state.security.enableSecret}\n`;
  } else if (state.security?.enablePassword) {
    output += `enable password ${state.security.enablePassword}\n`;
  }

  output += 'end\n';

  return { success: true, output };
}

/**
 * Show Version
 */
function cmdShowVersion(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\Network NOS Software, C2960 Software (C2960-LANBASE-M), Version 15.0(2)SE4\n';
  output += 'Technical Support: http://yunus.sf.net\n';
  output += 'Copyright (c) 1986-2024 by Network Systems, Inc.\n\n';
  output += 'ROM: Bootstrap program is C2960 boot loader\n';
  output += 'BOOTLDR: C2960 Boot Loader (C2960-HBOOT-M) Version 12.2(25)FX\n\n';
  output += `Switch uptime is ${state.uptime || '1 day, 2 hours, 3 minutes'}\n`;
  output += 'System image file is "flash:c2960-lanbase-mz.150-2.SE4.bin"\n\n';
  output += 'WS-C2960-24TT-L (PowerPC405) processor (revision C0) with 65536K bytes of memory.\n';
  output += 'Processor board ID FOC1234X5YZ\n';
  output += 'Last reload reason: power-on\n\n';
  output += '24 FastEthernet/IEEE 802.3 interface(s)\n';
  output += '2 Gigabit Ethernet/IEEE 802.3 interface(s)\n\n';
  output += '64K bytes of flash-simulated non-volatile configuration memory.\n';
  output += 'Base ethernet MAC Address       : 00:1A:2B:3C:4D:5E\n';
  output += 'Motherboard assembly number   : 73-10000-01\n';
  output += 'Model number                  : WS-C2960-24TT-L\n';
  output += '!\n';

  return { success: true, output };
}

/**
 * Show Interfaces
 */
function cmdShowInterfaces(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '';

  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    output += `${portName} is ${port.shutdown ? 'administratively down' : 'up'}, line protocol is ${port.shutdown ? 'down' : 'up'}\n`;
    output += `  Hardware is Fast Ethernet, address is ${port.macAddress || '0000.0000.0000'}\n`;
    if (port.ipAddress && port.subnetMask) {
      output += `  Internet address is ${port.ipAddress}/${port.subnetMask}\n`;
    }
    output += `  Description: ${port.description || ''}\n`;
    output += `  MTU 1500 bytes, BW 100000 Kbit/sec\n`;
    output += `  Full-duplex, ${port.speed || 'auto'}Mb/s\n`;
    output += `  input flow-control is off, output flow-control is unsupported\n`;
    output += `  ARP type: ARPA, ARP Timeout ${port.arpTimeout || '04:00:00'}\n`;
    output += `  Last input never, last output never, output hang never\n`;
    output += `  Queueing strategy: fifo\n`;
    output += `  Output queue 0/40, 0 drops; input queue 0/75, 0 drops\n`;
    output += `  5 minute input rate 0 bits/sec, 0 packets/sec\n`;
    output += `  5 minute output rate 0 bits/sec, 0 packets/sec\n`;
    output += `     0 packets input, 0 bytes, 0 no buffer\n`;
    output += `     Received 0 broadcasts, 0 runts, 0 giants, 0 throttles\n`;
    output += `     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n`;
    output += `     0 watchdog, 0 multicast, 0 pause input\n`;
    output += `     0 packets output, 0 bytes, 0 underruns\n`;
    output += `     0 output errors, 0 collisions, 1 interface resets\n`;
    output += `     0 unknown protocol, 0 dropped\n`;
    output += `     0 babbles, 0 late collision, 0 deferred\n`;
    output += `     0 lost carrier, 0 no carrier, 0 PAUSE output\n`;
    output += '!\n\n';
  });

  return { success: true, output };
}

/**
 * Show Interface (specific)
 */
function cmdShowInterface(
  state: any,
  input: string,
  ctx: any
): any {
  // This would need to parse the interface name from input
  // For now, delegate to show interfaces
  return cmdShowInterfaces(state, input, ctx);
}

/**
 * Show IP Interface Brief
 */
function cmdShowIpInterfaceBrief(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\nInterface              IP-Address      OK? Method Status                Protocol\n';

  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    const status = port.shutdown ? 'administratively down' : 'up';
    const protocol = port.shutdown ? 'down' : 'up';

    if (port.ipAddress && port.subnetMask) {
      output += `${portName.padEnd(22)} ${port.ipAddress.padEnd(15)} YES manual ${status.padEnd(23)} ${protocol}\n`;
    } else {
      output += `${portName.padEnd(22)} unassigned      YES unset  ${status.padEnd(23)} ${protocol}\n`;
    }
  });

  output += '!\n';
  return { success: true, output };
}

/**
 * Show VLAN
 */
function cmdShowVlan(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\n\nVLAN Name                             Status    Ports\n';
  output += '---- -------------------------------- --------- -------------------------------\n';

  // Default VLAN 1
  output += '1    default                          active    ';
  const vlan1Ports = Object.keys(state.ports || {}).filter(p => {
    const port = state.ports[p];
    return String(port.accessVlan || port.vlan || 1) === '1';
  });
  output += vlan1Ports.join(', ') || '-';
  output += '\n';

  // Other VLANs
  Object.keys(state.vlans || {}).forEach(vlanId => {
    if (vlanId !== '1') {
      const vlan = state.vlans[vlanId];
      const vlanName = (vlan?.name || `VLAN${vlanId}`).padEnd(32);
      const vlanStatus = vlan?.status || 'active';
      const vlanPorts = Object.keys(state.ports || {}).filter(p => {
        const port = state.ports[p];
        return String(port.accessVlan || port.vlan || 1) === vlanId;
      });

      output += `${vlanId.padEnd(4)}${vlanName}${vlanStatus.padEnd(10)}${vlanPorts.join(', ') || '-'}\n`;
    }
  });

  const knownVlanIds = Object.keys(state.vlans || {});
  Object.values(state.ports || {}).forEach((port: any) => {
    const vlanId = String(port.accessVlan || port.vlan || 1);
    if (!knownVlanIds.includes(vlanId) && vlanId !== '1') {
      const vlanName = `VLAN${vlanId}`.padEnd(32);
      output += `${vlanId.padEnd(4)}${vlanName}${'active'.padEnd(10)}${port.id}\n`;
    }
  });

  output += '\n\nVLAN Type  SAID       MTU   Parent RingNo BridgeNo Stp  BrdgMode Trans1 Trans2\n';
  output += '---- ----- ---------- ----- ------ ------ -------- ---- -------- ------ ------\n';
  output += '1    enet  100001     1500  -      -      -        -    -        0      0\n';

  Object.keys(state.vlans || {}).forEach(vlanId => {
    if (vlanId !== '1') {
      output += `${vlanId.padEnd(4)}enet  ${100000 + parseInt(vlanId)}         1500  -      -      -        -    -        0      0\n`;
    }
  });

  output += '!\n';
  return { success: true, output };
}

/**
 * Show MAC Address Table
 */
function cmdShowMacAddressTable(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\n\nMac Address Table\n';
  output += '-------------------------------------------\n\n';
  output += 'Vlan    Mac Address       Type        Ports\n';
  output += '----    -----------       --------    -----\n';

  // Build MAC table from real connections (topologyConnections)
  const connections = ctx.connections || [];
  const sourceDeviceId = ctx.sourceDeviceId;

  // Collect MAC entries from connections only - no legacy data
  const macTable: { vlan: number; mac: string; port: string; type: string }[] = [];

  if (connections && connections.length > 0) {
    // Find all connections to this device using CanvasConnection format
    const deviceConnections = connections.filter(
      (conn: any) => conn.sourceDeviceId === sourceDeviceId || conn.targetDeviceId === sourceDeviceId
    );

    deviceConnections.forEach((conn: any) => {
      // Determine which port on the device is connected
      const isSource = conn.sourceDeviceId === sourceDeviceId;
      const portId = isSource ? conn.sourcePort : conn.targetPort;

      // Get the connected device's MAC address
      const connectedDeviceId = isSource ? conn.targetDeviceId : conn.sourceDeviceId;
      const connectedDevice = ctx.devices?.find((d: any) => d.id === connectedDeviceId);

      if (connectedDevice?.macAddress) {
        // Format MAC address: 0000.0000.0000
        const mac = formatMacAddressSimple(connectedDevice.macAddress);

        // Get VLAN from the port - check if trunk mode
        const portState = state.ports?.[portId];

        if (portState?.mode === 'trunk') {
          // For trunk ports, show all VLANs
          const vlans = Object.keys(state.vlans || {}).filter(v => v !== '1').slice(0, 5);
          if (vlans.length === 0) {
            // Default VLAN 1 for trunk
            macTable.push({
              vlan: 1,
              mac: mac,
              port: portId,
              type: 'DYNAMIC'
            });
          } else {
            // Add entries for each VLAN on trunk
            vlans.forEach((vlanId) => {
              macTable.push({
                vlan: parseInt(vlanId),
                mac: mac,
                port: portId,
                type: 'DYNAMIC'
              });
            });
          }
        } else {
          // Access port - get VLAN from accessVlan or default to 1
          const vlan = portState?.accessVlan || portState?.vlan || 1;
          macTable.push({
            vlan: vlan,
            mac: mac,
            port: portId,
            type: 'DYNAMIC'
          });
        }
      }
    });
  }

  // Remove duplicates based on VLAN + MAC + Port
  const uniqueMacTable = macTable.filter((entry, index, self) =>
    index === self.findIndex(e => e.vlan === entry.vlan && e.mac === entry.mac && e.port === entry.port)
  );

  // Show learned MAC addresses from connections
  if (uniqueMacTable.length > 0) {
    uniqueMacTable.forEach((entry) => {
      output += `${String(entry.vlan).padEnd(8)}${entry.mac.padEnd(18)}${entry.type.padEnd(11)}${entry.port}\n`;
    });
  }

  // If no MAC addresses found, show default
  if (uniqueMacTable.length === 0) {
    output += 'All    0000.0000.0000    STATIC      CPU\n';
  }

  output += '!\n';
  return { success: true, output };
}

// Helper function to format MAC address: xxxx.xxxx.xxxx
function formatMacAddressSimple(mac: string): string {
  if (!mac) return '0000.0000.0000';
  // Keep only the dots, remove any dashes or colons
  const cleanMac = mac.replace(/[-:]/g, '').toUpperCase();
  // Pad with zeros to ensure 12 characters
  const padded = cleanMac.padStart(12, '0').slice(0, 12);
  // Add dots every 4 characters for format
  return padded.match(/.{1,4}/g)?.join('.') || padded;
}

/**
 * Show CDP Neighbors
 */
function cmdShowCdpNeighbors(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\nCapability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge\n';
  output += '                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone\n\n';
  output += 'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\n';

  // Show CDP neighbors if available
  if (state.cdpNeighbors && state.cdpNeighbors.length > 0) {
    state.cdpNeighbors.forEach((neighbor: any) => {
      output += `${neighbor.deviceId.padEnd(16)}${neighbor.localInterface.padEnd(18)}${String(neighbor.holdTime).padEnd(12)}${neighbor.capability.padEnd(12)}${neighbor.platform.padEnd(11)}${neighbor.remoteInterface}\n`;
    });
  } else {
    output += 'No CDP neighbors found\n';
  }

  output += '!\n';
  return { success: true, output };
}

/**
 * Show IP Route
 */
function cmdShowIpRoute(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\n';

  if (!state.ipRouting) {
    output += '% IP routing is not enabled\n';
    return { success: true, output };
  }

  output += 'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP\n';
  output += '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area\n';
  output += '       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2\n';
  output += 'Gateway of last resort is not set\n\n';

  // Connected routes
  const hasConnectedRoutes = false;
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    if (port.ipAddress && port.subnetMask) {
      output += `C     ${port.ipAddress}/${getPrefixLength(port.subnetMask)} is directly connected, ${portName}\n`;
    }
  });

  // Static routes
  if (state.staticRoutes && state.staticRoutes.length > 0) {
    state.staticRoutes.forEach((route: any) => {
      output += `S*    ${route.network}/${route.mask} [1/0] via ${route.nextHop}${route.interface ? ` ${route.interface}` : ''}\n`;
    });
  }

  if (!hasConnectedRoutes && (!state.staticRoutes || state.staticRoutes.length === 0)) {
    output += 'No routes in routing table\n';
  }

  output += '!\n';
  return { success: true, output };
}

/**
 * Show Clock
 */
function cmdShowClock(
  state: any,
  input: string,
  ctx: any
): any {
  const now = new Date();
  return {
    success: true,
    output: `\n*${now.toTimeString().split(' ')[0]} UTC ${now.toLocaleDateString()}\n`
  };
}

/**
 * Show Flash
 */
function cmdShowFlash(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\n-#- --length-- -----date/time------ path\n';
  output += '1     616      Mar 01 2024 00:00:00 +00:00  vlan.dat\n';
  output += '2     1599     Mar 01 2024 00:00:00 +00:00  config.text\n';
  output += '3     1464     Mar 01 2024 00:00:00 +00:00  private-config.text\n';
  output += '4     3024     Mar 01 2024 00:00:00 +00:00  c2960-lanbase-mz.150-2.SE4.bin\n';
  output += '\n32505856 bytes available (29720576 bytes used)\n';

  return { success: true, output };
}

/**
 * Show Boot
 */
function cmdShowBoot(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\nBOOT path-list      : flash:c2960-lanbase-mz.150-2.SE4.bin\n';
  output += 'Config file         : flash:config.text\n';
  output += 'Private Config file : flash:private-config.text\n';
  output += 'Enable Break        : no\n';
  output += 'Manual Boot         : no\n';
  output += 'Allow new Feature   : yes\n';
  output += 'Auto Boot           : no\n';

  return { success: true, output };
}

/**
 * Show Spanning Tree
 */
function cmdShowSpanningTree(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '';

  // Get spanning tree mode
  const stpMode = state.spanningTreeMode || 'pvst';

  // Show for each VLAN
  const vlans = Object.keys(state.vlans || {});
  if (vlans.length === 0) {
    vlans.push('1'); // Default VLAN
  }

  vlans.forEach((vlanId: string) => {
    const vlan = state.vlans?.[vlanId];
    const vlanName = vlan?.name || `VLAN${vlanId}`;

    output += `\nVLAN${String(vlanId).padStart(4, '0')}\n`;
    output += `  Spanning tree enabled protocol ${stpMode === 'mst' ? 'mstp' : 'ieee'}\n`;
    output += `  Root ID    Priority    32769\n`;
    output += `             Address     ${state.macAddress || '0000.0000.0000'}\n`;
    output += `             Cost        19\n`;
    output += `             Port        1 (FastEthernet0/1)\n`;
    output += `             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n\n`;
    output += `  Bridge ID  Priority    32769  (priority 32768 sys-id-ext ${vlanId})\n`;
    output += `             Address     ${state.macAddress || '001A.2B3C.4D5E'}\n`;
    output += `             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n`;
    output += `             Aging Time  300\n\n`;

    output += `Interface           Role Sts Cost      Prio.Nbr Type\n`;
    output += `------------------- ---- --- --------- -------- --------------------------------\n`;

    Object.keys(state.ports || {}).forEach((portName: string) => {
      const port = state.ports[portName];
      // Skip VLAN interfaces
      if (portName.toLowerCase().startsWith('vlan')) {
        return;
      }

      const portVlan = port.vlan || port.accessVlan || 1;
      if (String(portVlan) === String(vlanId)) {
        const status = port.shutdown ? 'DIS' : 'FWD';
        const role = port.shutdown ? 'Desg' : 'Desg';
        output += `${portName.padEnd(19)}${role} ${status} 19         128.1    Shr P2p\n`;
      }
    });
  });

  output += '!\n';
  return { success: true, output };
}

/**
 * Show Port Security
 */
function cmdShowPortSecurity(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\nSecure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action\n';
  output += '-----------------------------------------------------------------------\n';

  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    if (port.portSecurity?.enabled) {
      output += `${portName.padEnd(12)}${String(port.portSecurity.maxAddresses).padEnd(15)}${String(port.portSecurity.currentAddresses).padEnd(13)}${String(port.portSecurity.violations).padEnd(20)}${port.portSecurity.violationAction || 'Shutdown'}\n`;
    }
  });

  output += '!\n';
  return { success: true, output };
}

/**
 * Helper function to get prefix length from subnet mask
 */
function getPrefixLength(subnetMask: string): number {
  const parts = subnetMask.split('.').map(Number);
  let count = 0;

  for (const part of parts) {
    if (part === 255) count += 8;
    else if (part === 254) { count += 7; break; }
    else if (part === 252) { count += 6; break; }
    else if (part === 248) { count += 5; break; }
    else if (part === 240) { count += 4; break; }
    else if (part === 224) { count += 3; break; }
    else if (part === 192) { count += 2; break; }
    else if (part === 128) { count += 1; break; }
    else break;
  }

  return count;
}

/**
 * Do Show - Execute show command from config mode
 */
function cmdDoShow(
  state: any,
  input: string,
  ctx: any
): any {
  // Extract the show command from "do show ..."
  const match = input.match(/^do\s+(show\s+.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid command' };
  }

  const showCommand = match[1];

  // Parse the show command
  const parts = showCommand.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const subCmd = parts.slice(1).join(' ').toLowerCase();

  // Route to appropriate show handler
  if (cmd === 'show') {
    if (subCmd.startsWith('running-config')) {
      return cmdShowRunningConfig(state, showCommand, ctx);
    } else if (subCmd.startsWith('version')) {
      return cmdShowVersion(state, showCommand, ctx);
    } else if (subCmd.startsWith('interfaces')) {
      return cmdShowInterfaces(state, showCommand, ctx);
    } else if (subCmd.startsWith('interface')) {
      return cmdShowInterface(state, showCommand, ctx);
    } else if (subCmd.startsWith('ip interface brief')) {
      return cmdShowIpInterfaceBrief(state, showCommand, ctx);
    } else if (subCmd.startsWith('vlan')) {
      return cmdShowVlan(state, showCommand, ctx);
    } else if (subCmd.startsWith('mac address-table')) {
      return cmdShowMacAddressTable(state, showCommand, ctx);
    } else if (subCmd.startsWith('cdp neighbors')) {
      return cmdShowCdpNeighbors(state, showCommand, ctx);
    } else if (subCmd.startsWith('ip route')) {
      return cmdShowIpRoute(state, showCommand, ctx);
    } else if (subCmd.startsWith('clock')) {
      return cmdShowClock(state, showCommand, ctx);
    } else if (subCmd.startsWith('flash')) {
      return cmdShowFlash(state, showCommand, ctx);
    } else if (subCmd.startsWith('boot')) {
      return cmdShowBoot(state, showCommand, ctx);
    } else if (subCmd.startsWith('spanning-tree')) {
      return cmdShowSpanningTree(state, showCommand, ctx);
    } else if (subCmd.startsWith('port-security')) {
      return cmdShowPortSecurity(state, showCommand, ctx);
    } else if (subCmd.startsWith('wireless')) {
      return cmdShowWireless(state, showCommand, ctx);
    } else {
      return cmdShow(state, showCommand, ctx);
    }
  }

  return { success: false, error: '% Invalid command' };
}

/**
 * Show Wireless - Display WiFi settings
 */
function cmdShowWireless(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\nWireless Configuration & Status\n';
  output += '-------------------------------------------\n';
  output += 'Interface   Mode     SSID           Security   Channel  Status\n';
  output += '---------   ------   -------------  ---------  -------  ----------\n';

  let found = false;
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    if (portName.toLowerCase().startsWith('wlan')) {
      found = true;
      const wifi = port.wifi || {};
      const mode = (wifi.mode || 'disabled').padEnd(8);
      const ssid = (wifi.ssid || '-').padEnd(14);
      const security = (wifi.security || 'open').padEnd(10);
      const channel = (wifi.channel || '2.4GHz').padEnd(8);
      const status = (port.shutdown ? 'Down' : 'Up');
      
      output += `${portName.padEnd(11)} ${mode}${ssid}${security}${channel}${status}\n`;
    }
  });

  if (!found) {
    output += 'No wireless interfaces found on this device.\n';
  }

  output += '!\n';
  return { success: true, output };
}

