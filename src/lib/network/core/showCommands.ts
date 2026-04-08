import type { CommandHandler } from './commandTypes';

// Show komutları (show running-config, show vlan, show ip route, vs.)

export const showHandlers: Record<string, CommandHandler> = {
  'show': cmdShow,
  'show running-config': cmdShowRunningConfig,
  'show startup-config': cmdShowStartupConfig,
  'show version': cmdShowVersion,
  'show interfaces': cmdShowInterfaces,
  'show interface': cmdShowInterface,
  'show ip interface brief': cmdShowIpInterfaceBrief,
  'show ip interface': cmdShowIpInterfaceBrief,
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
  'show ip dhcp snooping': cmdShowIpDhcpSnooping,
  'show interfaces status': cmdShowInterfacesStatus,
  'show cdp': cmdShowCdp,
  'show vtp status': cmdShowVtpStatus,
  'show vtp': cmdShowVtpStatus,
  'show etherchannel': cmdShowEtherchannel,
  'show arp': cmdShowArp,
  'show ip arp': cmdShowArp,
  'show mls qos': cmdShowMlsQos,
  'show ip arp inspection': cmdShowIpArpInspection,
  'show access-lists': cmdShowAccessLists,
  'show history': cmdShowHistory,
  'show users': cmdShowUsers,
  'show environment': cmdShowEnvironment,
  'show inventory': cmdShowInventory,
  'show errdisable recovery': cmdShowErrdisableRecovery,
  'show errdisable detect': cmdShowErrdisableRecovery,
  'show storm-control': cmdShowStormControl,
  'show udld': cmdShowUdld,
  'show monitor': cmdShowMonitor,
  'show debug': cmdShowDebug,
  'show processes': cmdShowProcesses,
  'show memory': cmdShowMemory,
  'show sdm prefer': cmdShowSdmPrefer,
  'show system mtu': cmdShowSystemMtu,
  'show ip dhcp pool': cmdShowIpDhcpPool,
  'show ip dhcp binding': cmdShowIpDhcpBinding,
};

function getSwitchDisplayProfile(state: any) {
  const switchModel = state.switchModel || 'WS-C2960-24TT-L';
  const isL3 = switchModel === 'WS-C3560-24PS';

  return {
    switchModel,
    isL3,
    bootImage: isL3 ? 'c3560-ipbase-mz.150-2.SE4.bin' : 'c2960-lanbase-mz.150-2.SE4.bin',
    softwareImage: isL3 ? 'C3560 Software (C3560-IPBASE-M), Version 15.0(2)SE4' : 'C2960 Software (C2960-LANBASE-M), Version 15.0(2)SE4',
    rom: isL3 ? 'C3560 boot loader' : 'C2960 boot loader',
    bootldr: isL3 ? 'C3560 Boot Loader (C3560-HBOOT-M) Version 12.2(25)SEE3' : 'C2960 Boot Loader (C2960-HBOOT-M) Version 12.2(25)FX',
    systemImage: isL3 ? 'flash:c3560-ipbase-mz.150-2.SE4.bin' : 'flash:c2960-lanbase-mz.150-2.SE4.bin',
    processor: isL3 ? 'WS-C3560-24PS (PowerPC405) processor (revision 01) with 131072K bytes of memory' : 'WS-C2960-24TT-L (PowerPC405) processor (revision C0) with 65536K bytes of memory',
    gigabitPortCount: isL3 ? 4 : 2,
  };
}

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
  const { systemImage } = getSwitchDisplayProfile(state);
  let output = '\nBuilding configuration...\n\n';
  output += 'Current configuration : 1024 bytes\n\n';

  // Use actual runningConfig if available, otherwise generate fallback
  if (state.runningConfig && state.runningConfig.length > 0) {
    output += state.runningConfig.join('\n');
  } else {
    // Fallback to generated config if runningConfig is empty
    output += '!\n';
    output += `version 15.0\n`;
    output += `hostname ${state.hostname || 'Switch'}\n`;

    // Banner MOTD
    if (state.bannerMOTD) {
      const escapedBanner = state.bannerMOTD.replace(/\n/g, '\\n');
      output += `banner motd #${escapedBanner}#\n`;
      output += '!\n';
    }

    // Boot system
    output += `boot system ${systemImage}\n`;
    output += '!\n';

    // Service passwords-encryption
    if (state.security?.servicePasswordEncryption) {
      output += 'service password-encryption\n';
    }
    output += '!\n';

    // Spanning-tree mode
    output += `spanning-tree mode ${state.spanningTree?.mode || 'pvst'}\n`;
    output += '!\n';

    // Interface configurations
    Object.entries(state.ports || {}).forEach(([portId, port]: [string, any]) => {
      if (port.description || port.ipAddress || port.mode !== 'access' || port.vlan !== 1 || port.shutdown !== false) {
        output += `interface ${portId}\n`;
        if (port.description) {
          output += ` description ${port.description}\n`;
        }
        if (port.mode === 'trunk') {
          output += ` switchport mode trunk\n`;
          if (port.trunkAllowedVlans && port.trunkAllowedVlans !== '1-4094') {
            output += ` switchport trunk allowed vlan ${port.trunkAllowedVlans}\n`;
          }
        } else if (port.vlan && port.vlan !== 1) {
          output += ` switchport access vlan ${port.vlan}\n`;
        }
        if (port.ipAddress) {
          output += ` ip address ${port.ipAddress} ${port.subnetMask || '255.255.255.0'}\n`;
        }
        if (port.shutdown) {
          output += ` shutdown\n`;
        }
        output += '!\n';
      }
    });

    // VLAN configurations
    Object.entries(state.vlans || {}).forEach(([vlanId, vlan]: [string, any]) => {
      if (parseInt(vlanId) !== 1 && vlan.name) {
        output += `vlan ${vlanId}\n`;
        output += ` name ${vlan.name}\n`;
        if (vlan.state === 'suspend') {
          output += ` state suspend\n`;
        }
        output += '!\n';
      }
    });

    // Line configurations
    output += 'line con 0\n';
    if (state.security?.consolePassword) {
      if (state.security?.servicePasswordEncryption) {
        output += ` password 7 ********\n`;
      } else {
        output += ` password ${state.security.consolePassword}\n`;
      }
    }
    output += 'line vty 0 4\n';
    if (state.security?.vtyLines?.transportInput && state.security.vtyLines.transportInput.length > 0) {
      output += ` transport input ${state.security.vtyLines.transportInput.join(' ')}\n`;
    }
    output += ' login\n';
    output += 'line vty 5 15\n';
    output += ' login\n';
    output += '!\n';

    // Enable secret
    if (state.security?.enableSecret) {
      output += `enable secret 5 $1$xxxx$xxxxxxxxxxxxxxxx\n`;
    } else if (state.security?.enablePassword) {
      if (state.security?.servicePasswordEncryption) {
        output += `enable password 7 ********\n`;
      } else {
        output += `enable password ${state.security.enablePassword}\n`;
      }
    }
    output += '!\n';
  }

  output += '\nend\n';
  return { success: true, output };
}

/**
 * Show Startup Configuration
 */
function cmdShowStartupConfig(
  state: any,
  input: string,
  ctx: any
): any {
  const { systemImage } = getSwitchDisplayProfile(state);
  // Check if startup config exists
  if (!state.startupConfig) {
    return {
      success: true,
      output: '\n% No startup configuration available\n'
    };
  }

  let output = '\nBuilding configuration...\n\n';
  output += 'Startup configuration : 1024 bytes\n\n';
  output += '!\n';
  output += `version ${state.startupConfig.version || '15.0'}\n`;
  output += `hostname ${state.startupConfig.hostname || state.hostname || 'Switch'}\n`;

  // Banner MOTD from startup config
  if (state.startupConfig.bannerMOTD) {
    const escapedBanner = state.startupConfig.bannerMOTD.replace(/\n/g, '\\n');
    output += `banner motd #${escapedBanner}#\n`;
    output += '!\n';
  }

  // Boot system from startup config
  output += `boot system ${systemImage}\n`;
  output += '!\n';

  // Service passwords-encryption from startup config
  if (state.startupConfig.security?.servicePasswordEncryption) {
    output += 'service password-encryption\n';
  }
  output += '!\n';

  // Spanning-tree mode from startup config
  output += `spanning-tree mode ${state.startupConfig.spanningTree?.mode || 'pvst'}\n`;
  output += '!\n';

  // VLANs from startup config
  const startupVlans = state.startupConfig.vlans || {};
  const vlanIds = Object.keys(startupVlans).filter(v => v !== '1');
  if (vlanIds.length > 0) {
    vlanIds.forEach(vlanId => {
      const vlan = startupVlans[vlanId];
      output += `vlan ${vlanId}\n`;
      output += ` name ${vlan?.name || `VLAN${vlanId}`}\n`;
      output += ` state ${vlan?.status || 'active'}\n`;
      output += '!\n';
    });
  }

  // Interfaces from startup config
  const startupPorts = state.startupConfig.ports || {};
  Object.keys(startupPorts).forEach(portName => {
    const port = startupPorts[portName];
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

  // Line console from startup config
  output += 'line console 0\n';
  if (state.startupConfig.security?.consoleLine?.password) {
    if (state.startupConfig.security.servicePasswordEncryption) {
      output += ` password 7 ********\n`;
    } else {
      output += ` password ${state.startupConfig.security.consoleLine.password}\n`;
    }
  }
  if (state.startupConfig.security?.consoleLine?.login) {
    output += ' login\n';
  }
  output += '!\n';

  // VTY lines from startup config
  output += 'line vty 0 4\n';
  if (state.startupConfig.security?.vtyLines?.password) {
    if (state.startupConfig.security.servicePasswordEncryption) {
      output += ` password 7 ********\n`;
    } else {
      output += ` password ${state.startupConfig.security.vtyLines.password}\n`;
    }
  }
  if (state.startupConfig.security?.vtyLines?.login) {
    output += ' login\n';
  }
  if (state.startupConfig.security?.vtyLines?.transportInput) {
    output += ` transport input ${state.startupConfig.security.vtyLines.transportInput.join(' ')}\n`;
  }
  output += '!\n';

  // Enable secret from startup config
  if (state.startupConfig.security?.enableSecret) {
    if (state.startupConfig.security.enableSecretEncrypted) {
      output += `enable secret 5 ********\n`;
    } else {
      output += `enable secret ${state.startupConfig.security.enableSecret}\n`;
    }
  } else if (state.startupConfig.security?.enablePassword) {
    if (state.startupConfig.security.servicePasswordEncryption) {
      output += `enable password 7 ********\n`;
    } else {
      output += `enable password ${state.startupConfig.security.enablePassword}\n`;
    }
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
  const { switchModel, softwareImage, rom, bootldr, systemImage, processor, gigabitPortCount } = getSwitchDisplayProfile(state);

  let output = `\nNetwork NOS Software, ${softwareImage}\n`;
  output += 'Technical Support: http://yunus.sf.net\n';
  output += 'Copyright (c) 1986-2024 by Network Systems, Inc.\n\n';
  output += `ROM: Bootstrap program is ${rom}\n`;
  output += `BOOTLDR: ${bootldr}\n\n`;
  output += `Switch uptime is ${state.uptime || '1 day, 2 hours, 3 minutes'}\n`;
  output += `System image file is "${systemImage}"\n\n`;
  output += `${processor}\n`;
  output += 'Processor board ID FOC1234X5YZ\n';
  output += 'Last reload reason: power-on\n\n';
  output += '24 FastEthernet/IEEE 802.3 interface(s)\n';
  output += `${gigabitPortCount} Gigabit Ethernet/IEEE 802.3 interface(s)\n\n`;
  output += '64K bytes of flash-simulated non-volatile configuration memory.\n';
  output += 'Base ethernet MAC Address       : 00:1A:2B:3C:4D:5E\n';
  output += 'Motherboard assembly number   : 73-10000-01\n';
  output += `Model number                  : ${switchModel}\n`;
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
    const description = port.description || '';

    output += `${portName} is ${port.shutdown ? 'administratively down' : 'up'}, line protocol is ${port.shutdown ? 'down' : 'up'}\n`;
    output += `  Hardware is Fast Ethernet, address is ${port.macAddress || '0000.0000.0000'}\n`;
    if (port.ipAddress && port.subnetMask) {
      output += `  Internet address is ${port.ipAddress}/${port.subnetMask}\n`;
    }
    output += `  Description: ${description}\n`;
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
  const match = input.match(/^show\s+interface\s+(.+)$/i);
  if (!match) {
    return cmdShowInterfaces(state, input, ctx);
  }

  let requestedInterface = match[1].trim().toLowerCase();
  if (/^vlan\s+\d+$/i.test(requestedInterface)) {
    requestedInterface = requestedInterface.replace(/\s+/g, '');
  }

  const port = (state.ports || {})[requestedInterface];
  if (!port) {
    return { success: false, error: `% Interface ${match[1].trim()} not found` };
  }

  const description = port.description || '';
  let output = '';
  output += `${requestedInterface} is ${port.shutdown ? 'administratively down' : 'up'}, line protocol is ${port.shutdown ? 'down' : 'up'}\n`;
  output += `  Hardware is Fast Ethernet, address is ${port.macAddress || '0000.0000.0000'}\n`;
  if (port.ipAddress && port.subnetMask) {
    output += `  Internet address is ${port.ipAddress}/${port.subnetMask}\n`;
  }
  output += `  Description: ${description}\n`;
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

  return { success: true, output };
}

/**
 * Show IP Interface Brief
 */
function cmdShowIpInterfaceBrief(
  state: any,
  input: string,
  ctx: any
): any {
  let output = '\nInterface              IP-Address      OK? Method Status                Protocol                 Description\n';

  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    const status = port.shutdown ? 'administratively down' : 'up';
    const protocol = port.shutdown ? 'down' : 'up';
    const description = port.description || '';

    if (port.ipAddress && port.subnetMask) {
      output += `${portName.padEnd(22)} ${port.ipAddress.padEnd(15)} YES manual ${status.padEnd(23)} ${protocol.padEnd(23)} ${description.padEnd(25)}\n`;
    } else {
      output += `${portName.padEnd(22)} unassigned      YES unset  ${status.padEnd(23)} ${protocol.padEnd(23)} ${description.padEnd(25)}\n`;
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
  const { bootImage } = getSwitchDisplayProfile(state);
  let output = '\n-#- --length-- -----date/time------ path\n';
  output += '1     616      Mar 01 2024 00:00:00 +00:00  vlan.dat\n';
  output += '2     1599     Mar 01 2024 00:00:00 +00:00  config.text\n';
  output += '3     1464     Mar 01 2024 00:00:00 +00:00  private-config.text\n';
  output += `4     3024     Mar 01 2024 00:00:00 +00:00  ${bootImage}\n`;
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
  const { systemImage } = getSwitchDisplayProfile(state);
  let output = `\nBOOT path-list      : ${systemImage}\n`;
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
    } else if (subCmd.startsWith('startup-config')) {
      return cmdShowStartupConfig(state, showCommand, ctx);
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

/**
 * Show IP DHCP Snooping
 */
function cmdShowIpDhcpSnooping(state: any, input: string, ctx: any): any {
  const enabled = state.dhcpSnoopingEnabled ?? false;
  const vlans: string[] = state.dhcpSnoopingVlans ?? [];

  let output = '\nDHCP snooping is ' + (enabled ? 'enabled' : 'disabled') + '\n';
  output += 'DHCP snooping is configured on following VLANs:\n';
  output += vlans.length > 0 ? vlans.join(',') + '\n' : 'none\n';
  output += '\nInsertion of option 82 is ' + (state.dhcpOption82 ? 'enabled' : 'disabled') + '\n';
  output += '\nInterface           Trusted   Rate limit (pps)\n';
  output += '-----------         -------   ----------------\n';

  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    if (port?.dhcpSnoopingTrust) {
      output += `${portName.padEnd(20)}yes       unlimited\n`;
    }
  });

  output += '!\n';
  return { success: true, output };
}

/**
 * Show Interfaces Status
 */
function cmdShowInterfacesStatus(state: any, input: string, ctx: any): any {
  let output = '\nPort      Name               Status       Vlan       Duplex  Speed Type\n';
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    const status = port.shutdown ? 'notconnect' : 'connected';
    const vlan = port.accessVlan || port.vlan || 1;
    const duplex = port.duplex || 'a-full';
    const speed = port.speed || 'a-100';
    output += `${portName.padEnd(10)}${(port.description || '').padEnd(19)}${status.padEnd(13)}${String(vlan).padEnd(11)}${duplex.padEnd(8)}${speed.padEnd(6)}10/100BaseTX\n`;
  });
  return { success: true, output };
}

/**
 * Show CDP (brief)
 */
function cmdShowCdp(state: any, input: string, ctx: any): any {
  const enabled = state.cdpEnabled !== false;
  let output = '\nGlobal CDP information:\n';
  output += `  CDP is ${enabled ? 'enabled' : 'disabled'}\n`;
  output += `  Sending CDP packets every 60 seconds\n`;
  output += `  Sending a holdtime value of 180 seconds\n`;
  return { success: true, output };
}

/**
 * Show VTP Status
 */
function cmdShowVtpStatus(state: any, input: string, ctx: any): any {
  let output = '\nVTP Version capable             : 1 to 3\n';
  output += `VTP version running             : 2\n`;
  output += `VTP Domain Name                 : ${state.vtpDomain || ''}\n`;
  output += `VTP Pruning Mode                : Disabled\n`;
  output += `VTP Traps Generation            : Disabled\n`;
  output += `Device ID                       : ${state.macAddress || ''}\n`;
  output += `Configuration last modified by  : 0.0.0.0 at 0-0-00 00:00:00\n`;
  output += `Local updater ID is 0.0.0.0 (no valid interface found)\n\n`;
  output += `Feature VLAN:\n`;
  output += `--------------\n`;
  output += `VTP Operating Mode                : ${(state.vtpMode || 'server').charAt(0).toUpperCase() + (state.vtpMode || 'server').slice(1)}\n`;
  output += `Maximum VLANs supported locally   : 1005\n`;
  output += `Number of existing VLANs          : ${Object.keys(state.vlans || {}).length}\n`;
  output += `Configuration Revision            : ${state.vtpRevision || 0}\n`;
  return { success: true, output };
}

/**
 * Show EtherChannel Summary
 */
function cmdShowEtherchannel(state: any, input: string, ctx: any): any {
  let output = '\nFlags:  D - down        P - bundled in port-channel\n';
  output += '        I - stand-alone s - suspended\n';
  output += '        H - Hot-standby (LACP only)\n';
  output += '        R - Layer3      S - Layer2\n';
  output += '        U - in use      f - failed to allocate aggregator\n\n';
  output += 'Number of channel-groups in use: 0\n';
  output += 'Number of aggregators:           0\n\n';
  output += 'Group  Port-channel  Protocol    Ports\n';
  output += '------+-------------+-----------+-----------------------------------------------\n';

  const groups: Record<number, string[]> = {};
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    if (port.channelGroup) {
      if (!groups[port.channelGroup]) groups[port.channelGroup] = [];
      groups[port.channelGroup].push(portName);
    }
  });

  Object.entries(groups).forEach(([group, ports]) => {
    output += `${group.padEnd(7)}Po${group.padEnd(13)}${(state.ports[ports[0]]?.channelGroupMode || 'on').toUpperCase().padEnd(12)}${ports.join(' ')}\n`;
  });

  return { success: true, output };
}

/**
 * Show ARP / Show IP ARP
 */
function cmdShowArp(state: any, input: string, ctx: any): any {
  let output = '\nProtocol  Address          Age (min)  Hardware Addr   Type   Interface\n';
  // Show static ARP entries from MAC table
  (state.macAddressTable || []).forEach((entry: any) => {
    if (entry.type === 'STATIC') {
      output += `Internet  ${(entry.ip || '').padEnd(17)}  -          ${entry.mac.padEnd(16)}ARPA   Vlan${entry.vlan}\n`;
    }
  });
  return { success: true, output };
}

/**
 * Show MLS QoS
 */
function cmdShowMlsQos(state: any, input: string, ctx: any): any {
  const enabled = state.mlsQosEnabled ?? false;
  return { success: true, output: `\nQoS is ${enabled ? 'enabled' : 'disabled'}\n` };
}

/**
 * Show IP ARP Inspection
 */
function cmdShowIpArpInspection(state: any, input: string, ctx: any): any {
  return { success: true, output: '\nSource Mac Validation      : Disabled\nDestination Mac Validation : Disabled\nIP Address Validation      : Disabled\n\n Vlan     Configuration    Operation   ACL Match          Static ACL\n------   -------------    ---------   ---------          ----------\n' };
}

/**
 * Show Access-Lists
 */
function cmdShowAccessLists(state: any, input: string, ctx: any): any {
  return { success: true, output: '\n% No access lists configured\n' };
}

/**
 * Show History
 */
function cmdShowHistory(state: any, input: string, ctx: any): any {
  const history = state.commandHistory || [];
  let output = '\n';
  history.slice(-20).forEach((cmd: string) => { output += `  ${cmd}\n`; });
  return { success: true, output };
}

/**
 * Show Users
 */
function cmdShowUsers(state: any, input: string, ctx: any): any {
  let output = '\n    Line       User       Host(s)              Idle       Location\n';
  output += '*   0 con 0                idle                 00:00:00\n';
  return { success: true, output };
}

/**
 * Show Environment
 */
function cmdShowEnvironment(state: any, input: string, ctx: any): any {
  return { success: true, output: '\nSystem Temperature Value: 36 Degree Celsius\nSystem Temperature State: GREEN\nYellow Threshold : 46 Degree Celsius\nRed Threshold    : 56 Degree Celsius\n' };
}

/**
 * Show Inventory
 */
function cmdShowInventory(state: any, input: string, ctx: any): any {
  const profile = getSwitchDisplayProfile(state);
  return { success: true, output: `\nNAME: "1", DESCR: "${profile.switchModel}"\nPID: ${profile.switchModel}  , VID: V01, SN: ${state.version?.serialNumber || 'FOC0000X000'}\n` };
}

/**
 * Show Errdisable Recovery
 */
function cmdShowErrdisableRecovery(state: any, input: string, ctx: any): any {
  return { success: true, output: '\nErrDisable Reason            Timer Status\n-----------------            --------------\nbpduguard                    Disabled\npsecure-violation            Disabled\nport-security                Disabled\n\nTimer interval: 300 seconds\n' };
}

/**
 * Show Storm-Control
 */
function cmdShowStormControl(state: any, input: string, ctx: any): any {
  let output = '\nInterface Filter State   Upper        Lower        Current\n';
  output += '---------  ------------ ------------ ------------ ---------\n';
  return { success: true, output };
}

/**
 * Show UDLD
 */
function cmdShowUdld(state: any, input: string, ctx: any): any {
  return { success: true, output: '\nGlobal UDLD information\n  Message interval: 15\n  Time out interval: 5\n' };
}

/**
 * Show Monitor (SPAN)
 */
function cmdShowMonitor(state: any, input: string, ctx: any): any {
  return { success: true, output: '\n% No SPAN sessions configured\n' };
}

/**
 * Show Debug
 */
function cmdShowDebug(state: any, input: string, ctx: any): any {
  return { success: true, output: '\nAll possible debugging has been turned off\n' };
}

/**
 * Show Processes
 */
function cmdShowProcesses(state: any, input: string, ctx: any): any {
  return { success: true, output: '\nCPU utilization for five seconds: 1%/0%; one minute: 1%; five minutes: 1%\n' };
}

/**
 * Show Memory
 */
function cmdShowMemory(state: any, input: string, ctx: any): any {
  return { success: true, output: '\n                Head    Total(b)     Used(b)     Free(b)   Lowest(b)  Largest(b)\nProcessor  65536000    65536000     8192000    57344000    57344000    57344000\n' };
}

/**
 * Show SDM Prefer
 */
function cmdShowSdmPrefer(state: any, input: string, ctx: any): any {
  return { success: true, output: '\nThe current template is "default" template.\n The selected template optimizes the resources in\n the switch to support this level of features for\n 8 routed interfaces and 1024 VLANs.\n' };
}

/**
 * Show System MTU
 */
function cmdShowSystemMtu(state: any, input: string, ctx: any): any {
  return { success: true, output: '\nSystem MTU size is 1500 bytes\nSystem Jumbo MTU size is 1500 bytes\nRouting MTU size is 1500 bytes\n' };
}

function cmdShowIpDhcpPool(state: any, input: string, ctx: any): any {
  const pools = state.dhcpPools || {};
  const poolNames = Object.keys(pools);
  if (poolNames.length === 0) {
    return { success: true, output: '\n% No DHCP pools configured\n' };
  }
  let output = '\n';
  poolNames.forEach(name => {
    const p = pools[name];
    output += `Pool ${name} :\n`;
    output += ` Utilization mark (high/low)    : 100 / 0\n`;
    output += ` Subnet size (first/next)        : 0 / 0\n`;
    output += ` Total addresses                 : 254\n`;
    output += ` Leased addresses                : 0\n`;
    output += ` Pending event                   : none\n`;
    if (p.network && p.subnetMask) {
      output += ` 1 subnet is currently in the pool :\n`;
      output += ` Current index        IP address range                    Leased addresses\n`;
      output += ` ${(p.network + '').padEnd(21)} ${p.network} - ${p.network.replace(/\.\d+$/, '.254')}   0\n`;
    }
    output += `\n`;
    output += `Pool ${name}:\n`;
    output += ` Network             : ${p.network || 'not set'} ${p.subnetMask || ''}\n`;
    output += ` Default router      : ${p.defaultRouter || 'not set'}\n`;
    output += ` DNS server          : ${p.dnsServer || 'not set'}\n`;
    if (p.domainName) output += ` Domain name         : ${p.domainName}\n`;
    if (p.leaseTime) output += ` Lease               : ${p.leaseTime}\n`;
    output += '\n';
  });
  return { success: true, output };
}

function cmdShowIpDhcpBinding(state: any, input: string, ctx: any): any {
  return {
    success: true,
    output: '\nIP address       Client-ID/              Lease expiration        Type\n' +
      '                 Hardware address\n' +
      '% No bindings found\n'
  };
}
