import { isRouterModel } from '../switchModels';
import type { CommandContext } from './commandTypes';
import type { CanvasConnection } from '@/components/network/networkTopology.types';
import type { SwitchState, CommandResult, Port } from '../types';
import { normalizePortId } from '../initialState';
import { portsFormTrunk } from '../connectivity';
import {
  formatPortName, isPhysicalEthernetPort, getAllowedVlansString, getNativeVlanString,
} from './showHelpers';
import { calculateSubnet } from '@/lib/network/subnetting';

/**
 * Show Interfaces
 */
export function cmdShowInterfaces(
  state: SwitchState,
  _input: string,
  _ctx: CommandContext
): CommandResult {
  let output = '';

  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    const description = port.description || port.name || '';
    const stats = port.statistics || {};
    const s = port.stats || {};
    const displayName = formatPortName(portName);

    // Admin and operational status
    const adminStatus = port.adminStatus || (port.shutdown ? 'down' : 'up');
    const lineProtocol = port.lineProtocol || (port.shutdown ? 'down' : 'up');

    output += `${displayName} is ${adminStatus}, line protocol is ${lineProtocol}\n`;

    if ((port.type as string) === 'tunnel' || port.tunnel || portName.toLowerCase().startsWith('tunnel')) {
      output += `  Hardware is Tunnel\n`;
      if (port.ipAddress && port.subnetMask) {
        output += `  Internet address is ${port.ipAddress}/${port.subnetMask}\n`;
      }
      output += `  Description: ${description}\n`;
      output += `  MTU ${port.mtu || 1514} bytes, BW ${port.bandwidth || 9} Kbit/sec\n`;
      output += `  Tunnel source ${port.tunnel?.source || 'not set'}, destination ${port.tunnel?.destination || 'not set'}\n`;
      output += `  Tunnel protocol/transport ${port.tunnel?.protocol ? port.tunnel.protocol.toUpperCase() : 'GRE'}/IP\n`;
    } else if (port.type === 'serial') {
      const serialEncapsulation = (port.serialEncapsulation || 'hdlc').toUpperCase();
      const dceDte = port.dce ? 'DCE' : 'DTE';
      output += `  Hardware is Serial, address is ${port.macAddress || '0000.0000.0000'}\n`;
      output += `  Internet address is ${port.ipAddress || 'not set'}/${port.subnetMask || '255.255.255.252'}\n`;
      output += `  Description: ${description}\n`;
      output += `  MTU ${port.mtu || 1500} bytes, BW ${port.bandwidth || 1544} Kbit/sec\n`;
      output += `  ${dceDte}, clock rate ${port.clockRate || '2000000'} bps\n`;
      output += `  Encapsulation ${serialEncapsulation}`;
      if (port.serialEncapsulation === 'ppp' && port.pppAuth && port.pppAuth !== 'none') {
        output += `, PPP auth: ${port.pppAuth.toUpperCase()}`;
      }
      output += '\n';
    } else {
      const hardwareType = port.type === 'gigabitethernet' ? 'Gigabit Ethernet' : 'Fast Ethernet';
      output += `  Hardware is ${hardwareType}, address is ${port.macAddress || '0000.0000.0000'}\n`;

      if (port.ipAddress && port.subnetMask) {
        output += `  Internet address is ${port.ipAddress}/${port.subnetMask}\n`;
      }

      output += `  Description: ${description}\n`;

      // MTU and Bandwidth
      const mtu = port.mtu || 1500;
      const bandwidth = port.bandwidth || (port.type === 'gigabitethernet' ? 1000000 : 100000);
      output += `  MTU ${mtu} bytes, BW ${bandwidth} Kbit/sec\n`;

      // Speed and Duplex
      const actualSpeed = port.speed === 'auto' ? (port.type === 'gigabitethernet' ? '1000' : '100') : port.speed;
      const duplexMode = port.duplex === 'half' ? 'Half' : 'Full';
      output += `  ${duplexMode}-duplex, ${actualSpeed}Mb/s\n`;

      // Encapsulation for trunks
      if (port.mode === 'trunk' && port.encapsulation) {
        output += `  Encapsulation ${port.encapsulation}\n`;
      }
    }

    output += `  input flow-control is off, output flow-control is unsupported\n`;
    output += `  ARP type: ARPA, ARP Timeout ${port.arpTimeout || '04:00:00'}\n`;

    // Last input/output times - nOS uses elapsed HH:MM:SS format, not locale time
    const fmtElapsed = (ts: number | undefined): string => {
      if (!ts) return 'never';
      const elapsed = Math.floor((Date.now() - ts) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    const lastInput = fmtElapsed(stats.lastInput);
    const lastOutput = fmtElapsed(stats.lastOutput);
    output += `  Last input ${lastInput}, last output ${lastOutput}, output hang never\n`;

    // Queueing strategy
    const ingressQ = port.qos?.ingressQueue || 75;
    const egressQ = port.qos?.egressQueue || 40;
    output += `  Queueing strategy: fifo\n`;
output += `  Output queue 0/${egressQ}, ${s.txDrops || 0} drops; input queue 0/${ingressQ}, ${s.rxDrops || 0} drops\n`;

    output += `  5 minute input rate ${stats.inputBytes || 0} bits/sec, ${stats.inputPackets || 0} packets/sec\n`;
    output += `  5 minute output rate ${stats.outputBytes || 0} bits/sec, ${stats.outputPackets || 0} packets/sec\n`;

    // Statistics section
    output += `     ${stats.inputPackets || 0} packets input, ${stats.inputBytes || 0} bytes, 0 no buffer\n`;
    output += `     Received 0 broadcasts, ${stats.runts || 0} runts, ${stats.giants || 0} giants, ${stats.throttles || 0} throttles\n`;
    output += `     ${stats.inputErrors || 0} input errors, ${stats.crcErrors || 0} CRC, 0 frame, ${stats.overruns || 0} overrun, 0 ignored\n`;
    output += `     0 watchdog, 0 multicast, 0 pause input\n`;
    output += `     ${stats.outputPackets || 0} packets output, ${stats.outputBytes || 0} bytes, ${stats.underruns || 0} underruns\n`;
    output += `     ${stats.outputErrors || 0} output errors, ${stats.collisions || 0} collisions, ${stats.resets || 1} interface resets\n`;
    output += `     0 unknown protocol, ${stats.drops || 0} dropped\n`;
    output += `     0 babbles, 0 late collision, 0 deferred\n`;
    output += `     0 lost carrier, 0 no carrier, 0 PAUSE output\n`;
    output += '!\n\n';
  });

  return { success: true, output };
}

/**
 * Show Interface (specific)
 */
export function cmdShowInterface(
  state: SwitchState,
  input: string,
  ctx: CommandContext
): CommandResult {
  const match = input.match(/^show\s+interface\s+(.+)$/i);
  if (!match) {
    return cmdShowInterfaces(state, input, ctx);
  }

  let requestedInterface = match[1].trim().toLowerCase();
  const originalInterface = match[1].trim();

  // Handle VLAN interfaces (SVI)
  if (/^vlan\s+\d+$/i.test(requestedInterface)) {
    const vlanId = parseInt(requestedInterface.replace(/\D/g, ''));
    const vlan = (state.vlans || {})[vlanId];

    if (!vlan) {
      return { success: false, error: `% Interface ${originalInterface} not found` };
    }

    // Extract IP address from running config if available
    let ipAddress = '';
    let subnetMask = '';
    const runningConfig = state.runningConfig || [];
    let inVlanInterface = false;

    for (const line of runningConfig) {
      if (line.toLowerCase().startsWith('interface vlan')) {
        const configVlanId = parseInt(line.replace(/\D/g, ''));
        inVlanInterface = (configVlanId === vlanId);
      } else if (inVlanInterface) {
        if (line.toLowerCase().startsWith('ip address')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 4) {
            ipAddress = parts[2];
            subnetMask = parts[3];
          }
        } else if (line === '!') {
          inVlanInterface = false;
        }
      }
    }

    let output = '';
    const isUp = vlan.status === 'active' && ipAddress;
    output += `Vlan${vlanId} is ${isUp ? 'up' : 'administratively down'}, line protocol is ${isUp ? 'up' : 'down'}\n`;
    output += `  Hardware is EtherSVI, address is ${state.macAddress || '0000.0000.0000'}\n`;
    if (ipAddress && subnetMask) {
      output += `  Internet address is ${ipAddress}/${subnetMask}\n`;
    }
    output += `  Description: ${vlan.name}\n`;
    const mtu = 1500;
    const bandwidth = 1000000;
    output += `  MTU ${mtu} bytes, BW ${bandwidth} Kbit/sec\n`;
    output += `  ARP type: ARPA, ARP Timeout 04:00:00\n`;
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

  // Handle physical interfaces - resolve both short (fa0/1) and long (FastEthernet0/1) port names
  if (/^vlan\s+\d+$/i.test(requestedInterface)) {
    requestedInterface = requestedInterface.replace(/\s+/g, '');
  }

  let port = (state.ports || {})[requestedInterface];
  if (!port) {
    // Try looking up by stripping the full prefix (FastEthernet -> f, GigabitEthernet -> g)
    const shortMatch = requestedInterface.match(/^(fastethernet|gigabitethernet|ethernet)(\d.*)$/i);
    if (shortMatch) {
      const prefix = shortMatch[1].toLowerCase();
      const suffix = shortMatch[2];
      const shortPrefix = prefix === 'fastethernet' ? 'fa' : prefix === 'gigabitethernet' ? 'gi' : 'eth';
      const shortName = shortPrefix + suffix;
      port = (state.ports || {})[shortName];
    }
  }
  if (!port) {
    return { success: false, error: `% Interface ${originalInterface} not found` };
  }

  const description = port.description || port.name || '';
  let output = '';
  const ifaceDisplay = formatPortName(requestedInterface);
  output += `${ifaceDisplay} is ${port.shutdown ? 'administratively down' : 'up'}, line protocol is ${port.shutdown ? 'down' : 'up'}\n`;
  if ((port.type as string) === 'tunnel' || port.tunnel || requestedInterface.toLowerCase().startsWith('tunnel')) {
    output += `  Hardware is Tunnel\n`;
    if (port.ipAddress && port.subnetMask) {
      output += `  Internet address is ${port.ipAddress}/${port.subnetMask}\n`;
    }
    output += `  Description: ${description}\n`;
    output += `  MTU ${port.mtu || 1514} bytes, BW ${port.bandwidth || 9} Kbit/sec\n`;
    output += `  Tunnel source ${port.tunnel?.source || 'not set'}, destination ${port.tunnel?.destination || 'not set'}\n`;
    output += `  Tunnel protocol/transport ${port.tunnel?.protocol ? port.tunnel.protocol.toUpperCase() : 'GRE'}/IP\n`;
  } else {
    const hardwareType = port.type === 'gigabitethernet' ? 'Gigabit Ethernet' : 'Fast Ethernet';
    output += `  Hardware is ${hardwareType}, address is ${port.macAddress || '0000.0000.0000'}\n`;
    if (port.ipAddress && port.subnetMask) {
      output += `  Internet address is ${port.ipAddress}/${port.subnetMask}\n`;
    }
    output += `  Description: ${description}\n`;

    const mtu = port.mtu || 1500;
    const bandwidth = port.bandwidth || (port.type === 'gigabitethernet' ? 1000000 : 100000);
    output += `  MTU ${mtu} bytes, BW ${bandwidth} Kbit/sec\n`;

    const actualSpeed = port.speed === 'auto' ? (port.type === 'gigabitethernet' ? '1000' : '100') : port.speed;
    const duplexMode = port.duplex === 'half' ? 'Half' : 'Full';
    output += `  ${duplexMode}-duplex, ${actualSpeed}Mb/s\n`;
  }

  const stats = port.statistics || {};
  const s = port.stats || {};

  if (port.mode === 'trunk' && port.encapsulation) {
    output += `  Encapsulation ${port.encapsulation}\n`;
  }

  output += `  input flow-control is off, output flow-control is unsupported\n`;
  output += `  ARP type: ARPA, ARP Timeout ${port.arpTimeout || '04:00:00'}\n`;

  const fmtElapsedIface = (ts: number | undefined): string => {
    if (!ts) return 'never';
    const elapsed = Math.floor((Date.now() - ts) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const lastInput = fmtElapsedIface(stats.lastInput);
  const lastOutput = fmtElapsedIface(stats.lastOutput);
  output += `  Last input ${lastInput}, last output ${lastOutput}, output hang never\n`;

  const ingressQ = port.qos?.ingressQueue || 75;
  const egressQ = port.qos?.egressQueue || 40;
  output += `  Queueing strategy: fifo\n`;
  output += `  Output queue 0/${egressQ}, ${s.txDrops || 0} drops; input queue 0/${ingressQ}, ${s.rxDrops || 0} drops\n`;

  output += `  5 minute input rate ${stats.inputBytes || 0} bits/sec, ${stats.inputPackets || 0} packets/sec\n`;
  output += `  5 minute output rate ${stats.outputBytes || 0} bits/sec, ${stats.outputPackets || 0} packets/sec\n`;

  output += `     ${stats.inputPackets || 0} packets input, ${stats.inputBytes || 0} bytes, 0 no buffer\n`;
  output += `     Received 0 broadcasts, ${stats.runts || 0} runts, ${stats.giants || 0} giants, ${stats.throttles || 0} throttles\n`;
  output += `     ${stats.inputErrors || 0} input errors, ${stats.crcErrors || 0} CRC, 0 frame, ${stats.overruns || 0} overrun, 0 ignored\n`;
  output += `     0 watchdog, 0 multicast, 0 pause input\n`;
  output += `     ${stats.outputPackets || 0} packets output, ${stats.outputBytes || 0} bytes, ${stats.underruns || 0} underruns\n`;
  output += `     ${stats.outputErrors || 0} output errors, ${stats.collisions || 0} collisions, ${stats.resets || 1} interface resets\n`;
  output += `     0 unknown protocol, ${stats.drops || 0} dropped\n`;
  output += `     0 babbles, 0 late collision, 0 deferred\n`;
  output += `     0 lost carrier, 0 no carrier, 0 PAUSE output\n`;
  output += '!\n\n';

  return { success: true, output };
}

/**
 * Show Interface Trunk
 */
export function cmdShowInterfaceTrunk(
  state: SwitchState,
  _input: string,
  ctx: CommandContext
): CommandResult {
  const connections = ctx.connections || [];
  const sourceDeviceId = ctx.sourceDeviceId as string;

  const portIds = Object.keys(state.ports || {}).filter(isPhysicalEthernetPort);

  const hasActiveConnection = (portId: string) =>
    connections.some((conn: CanvasConnection) =>
      (conn.sourceDeviceId === sourceDeviceId && conn.sourcePort === portId) ||
      (conn.targetDeviceId === sourceDeviceId && conn.targetPort === portId)
    );

  const getPeerPortState = (portId: string) => {
    const conn = connections.find((c: CanvasConnection) =>
      (c.sourceDeviceId === sourceDeviceId && c.sourcePort === portId) ||
      (c.targetDeviceId === sourceDeviceId && c.targetPort === portId)
    );
    if (!conn) return null;
    const peerDeviceId = conn.sourceDeviceId === sourceDeviceId ? conn.targetDeviceId : conn.sourceDeviceId;
    const peerPortId = conn.sourceDeviceId === sourceDeviceId ? conn.targetPort : conn.sourcePort;
    const peerState = ctx.deviceStates?.get(peerDeviceId);
    const peerPort = peerState?.ports?.[peerPortId];
    return { peerPortId, peerPort };
  };

  // A trunk is operational when both connected switch ports form a trunk (explicit or DTP-negotiated).
  const trunkPorts = portIds.filter((portId) => {
    const port = state.ports?.[portId];

    const connected = hasActiveConnection(portId);
    const peer = connected ? getPeerPortState(portId) : null;
    const isActuallyTrunking = connected && peer && portsFormTrunk(port?.mode, peer.peerPort?.mode);

    return isActuallyTrunking;
  });

  if (trunkPorts.length === 0) {
    return { success: true, output: '\nNo trunking ports found\n!\n' };
  }

  let output = '\nPort        Mode         Encapsulation  Status        Native vlan\n';

  trunkPorts.forEach((portId) => {
    const port = state.ports?.[portId] || {};
    const connected = hasActiveConnection(portId);
    const peer = connected ? getPeerPortState(portId) : null;

    // Mode column : on/auto/desirable
    const mode =
      port.mode === 'trunk' ? 'on' :
        port.mode === 'dynamic-auto' ? 'auto' :
          port.mode === 'dynamic-desirable' ? 'desirable' :
            'on';

    const status = connected && peer && portsFormTrunk(port.mode, peer.peerPort?.mode) ? 'trunking' : 'not-trunking';
    const nativeVlan = getNativeVlanString(port);

    output += `${String(portId).padEnd(11)} ${String(mode).padEnd(12)} ${'802.1q'.padEnd(13)} ${String(status).padEnd(12)} ${nativeVlan}\n`;
  });

  output += '\nPort        Vlans allowed on trunk\n';
  trunkPorts.forEach((portId) => {
    const port = state.ports?.[portId] || {};
    output += `${String(portId).padEnd(11)} ${getAllowedVlansString(port)}\n`;
  });

  output += '\nPort        Vlans allowed and active in management domain\n';
  const activeVlans = Object.keys(state.vlans || {}).length > 0
    ? Object.keys(state.vlans || {}).sort((a, b) => Number(a) - Number(b)).join(',')
    : '1';
  trunkPorts.forEach((portId) => {
    output += `${String(portId).padEnd(11)} ${activeVlans}\n`;
  });

  output += '\nPort        Vlans in spanning tree forwarding state and not pruned\n';
  trunkPorts.forEach((portId) => {
    output += `${String(portId).padEnd(11)} ${activeVlans}\n`;
  });

  output += '!\n';
  return { success: true, output };
}

/**
 * Show IP Interface Brief
 */
export function cmdShowIpInterfaceBrief(
  state: SwitchState,
  input: string,
  ctx: CommandContext
): CommandResult {
  // Check if specific interface requested instead of brief
  const match = input.match(/show\s+ip\s+interface\s+(?!brief|br)(\S+)/i);
  if (match) {
    return cmdShowIpInterface(state, input, ctx);
  }

  let output = '\nInterface              IP-Address      OK? Method Status                Protocol \n';
  const modelName = String(state?.version?.modelName || '');
  const isRouter = isRouterModel(modelName) || isRouterModel(state?.switchModel) || state?.deviceType === 'router';
  const toDisplayName = (portName: string) => {
    if (!isRouter) return portName;
    const p = String(portName);
    if (/^gi\d+\/\d+$/i.test(p)) return `GigabitEthernet${p.slice(2)}`;
    if (/^fa\d+\/\d+$/i.test(p)) return `FastEthernet${p.slice(2)}`;
    if (/^vlan\d+$/i.test(p)) return `Vlan${p.slice(4)}`;
    return p;
  };

  // Build channel groups map
  const channelGroups: Record<number, string[]> = {};
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    if (port.channelGroup) {
      if (!channelGroups[port.channelGroup]) channelGroups[port.channelGroup] = [];
      channelGroups[port.channelGroup].push(portName);
    }
  });

  // Show port-channel interfaces first
  Object.entries(channelGroups).forEach(([group, ports]) => {
    const poName = `Po${group}`;
    const poPort = state.ports[`po${group}`];
    const status = poPort?.shutdown ? 'administratively down' : 'up';
    const protocol = ports.every(p => !state.ports[p]?.shutdown) ? 'up' : 'down';
    const ipStr = (poPort?.ipAddress && poPort?.subnetMask) ? poPort.ipAddress : 'unassigned';
    const ipMethod = (poPort?.ipAddress && poPort?.subnetMask) ? 'manual' : 'unset';
    output += `${poName.padEnd(22)} ${ipStr.padEnd(15)} YES ${ipMethod.padEnd(6)} ${status.padEnd(23)} ${protocol.padEnd(8)} \n`;
  });

  // Show regular interfaces
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    // Skip ports that are part of a channel group (show in PoX instead)
    if (port.channelGroup) return;

    const status = port.shutdown ? 'administratively down' : 'up';
    const protocol = port.shutdown ? 'down' : 'up';
    const displayPortName = toDisplayName(portName);

    if (port.ipAddress && port.subnetMask) {
      output += `${displayPortName.padEnd(22)} ${port.ipAddress.padEnd(15)} YES manual ${status.padEnd(23)} ${protocol.padEnd(8)} \n`;
      const subnet = calculateSubnet(port.ipAddress, port.subnetMask);
      if (subnet) {
        output += `  Subnet: ${subnet.network}/${subnet.prefixLength}  Broadcast: ${subnet.broadcast}  Hosts: ${subnet.firstHost}-${subnet.lastHost} (${subnet.usableHosts})\n`;
      }
    } else {
      output += `${displayPortName.padEnd(22)} unassigned      YES unset  ${status.padEnd(23)} ${protocol.padEnd(8)} \n`;
    }
  });

  // Add summary lines for better compatibility
  const totalInterfaces = Object.keys(state.ports || {}).length;
  const upInterfaces = Object.values(state.ports || {}).filter(p => !p.shutdown).length;
  output += `   ${totalInterfaces} total, ${upInterfaces} ${upInterfaces === 1 ? 'up' : 'up'}, ${totalInterfaces - upInterfaces} ${totalInterfaces - upInterfaces === 1 ? 'down' : 'down'}\n`;

  output += '!\n';
  return { success: true, output };
}

/**
 * Show Interfaces Status
 */
export function cmdShowInterfacesStatus(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\nPort      Name               Status       Vlan       Duplex  Speed  Type\n';
  output += '-------- ------------------ ------------ ---------- ------- ------ --------------------\n';
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    const status = port.shutdown ? 'disabled' : (port.status === 'notconnect' ? 'notconnect' : 'connected');
    const vlan = port.mode === 'trunk' ? 'trunk' : (port.accessVlan || port.vlan || 1);
    const duplex = port.duplex === 'half' ? 'half' : (port.duplex === 'full' ? 'full' : 'a-full');
    const speedVal = port.speed === 'auto' ? (port.type === 'gigabitethernet' ? 'a-1000' : 'a-100') : port.speed;
    const typeStr = port.type === 'gigabitethernet' ? '10/100/1000BaseTX' : '10/100BaseTX';
    const name = (port.description || '').substring(0, 18);

    output += `${portName.padEnd(10)}${name.padEnd(19)}${String(status).padEnd(13)}${String(vlan).padEnd(11)}${duplex.padEnd(8)}${speedVal.padEnd(7)}${typeStr}\n`;
  });
  output += '!\n';
  return { success: true, output };
}

/**
 * Show IP Interface (specific)
 */
export function cmdShowIpInterface(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/show\s+ip\s+interface\s*(\S+)?/i);
  const interfaceName = match?.[1];

  const renderInterfaceIPInfo = (name: string, port: Port) => {
    let out = `${name} is ${port.shutdown ? 'administratively down' : 'up'}, line protocol is ${port.shutdown ? 'down' : 'up'}\n`;
    out += `  Internet address is ${port.ipAddress || 'unassigned'}/${port.subnetMask || ''}\n`;
    out += `  Broadcast address is 255.255.255.255\n`;
    out += `  Address determined by setup command\n`;
    out += `  MTU is 1500 bytes\n`;
    out += `  Helper address is ${(port as (typeof port & { helperAddresses?: string[] })).helperAddresses?.join(', ') || 'not set'}\n`;
    out += `  Directed broadcast forwarding is disabled\n`;
    out += `  Outgoing access list is ${port.accessGroupOut || 'not set'}\n`;
    out += `  Inbound  access list is ${port.accessGroupIn || 'not set'}\n`;
    out += `  Proxy ARP is ${(port as (typeof port & { proxyArp?: boolean })).proxyArp ? 'enabled' : 'disabled'}\n`;
    out += `  Local Proxy ARP is disabled\n`;
    out += `  Security level is not set\n`;
    out += `  Split horizon is enabled\n`;
    out += `  ICMP redirects are always sent\n`;
    out += `  ICMP unreachables are always sent\n`;
    out += `  ICMP mask replies are never sent\n`;
    out += `  IP fast switching is enabled\n`;
    out += `  IP flow switching is disabled\n`;
    out += `  IP CEF switching is enabled\n`;
    return out;
  };

  if (!interfaceName) {
    let output = '\n';
    Object.entries(state.ports || {}).forEach(([name, port]) => {
      output += renderInterfaceIPInfo(name, port) + '!\n';
    });
    return { success: true, output };
  }

  const normalized = interfaceName.toLowerCase();
  const port = state.ports?.[normalized];

  if (!port) {
    return { success: false, error: `% Interface ${interfaceName} not found` };
  }

  return { success: true, output: '\n' + renderInterfaceIPInfo(interfaceName, port) };
}

/**
 * Show IPv6 Interface Brief
 */
export function cmdShowIpv6InterfaceBrief(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\nInterface              IPv6-Address                                Status                Protocol\n';

  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    const status = port.shutdown ? 'administratively down' : 'up';
    const protocol = port.shutdown ? 'down' : 'up';

    if (port.ipv6Address && port.ipv6Prefix) {
      const addr = `${port.ipv6Address}/${port.ipv6Prefix}`;
      output += `${portName.padEnd(22)} ${addr.padEnd(43)} ${status.padEnd(21)} ${protocol}\n`;
    } else {
      output += `${portName.padEnd(22)} unassigned                                  ${status.padEnd(21)} ${protocol}\n`;
    }
  });

  return { success: true, output };
}

/**
 * Show Controllers
 */
export function cmdShowControllers(state: SwitchState, input: string, ctx: CommandContext): CommandResult {
  const ifaceMatch = input.match(/^show\s+controllers\s+(.+)$/i);
  if (!ifaceMatch) {
    return { success: true, output: '\n% Incomplete command.\n' };
  }

  const requestedInterface = ifaceMatch[1].trim();
  const normalized = normalizePortId(requestedInterface) || requestedInterface.toLowerCase().replace(/\s+/g, '');
  const port = (state.ports || {})[normalized];

  if (!port) {
    return { success: false, error: `% Interface ${requestedInterface} not found` };
  }

  if (port.type !== 'serial') {
    return { success: true, output: `\nInterface ${requestedInterface}\nHardware is QUICC Ethernet\n` };
  }

  const connections = ctx.connections || [];
  const sourceDeviceId = ctx.sourceDeviceId;
  const conn = sourceDeviceId
    ? connections.find(c =>
      c.active !== false &&
      ((c.sourceDeviceId === sourceDeviceId && c.sourcePort === normalized) ||
        (c.targetDeviceId === sourceDeviceId && c.targetPort === normalized))
    )
    : undefined;

  if (!conn) {
    return { success: true, output: `\nInterface ${requestedInterface}\nNo cable attached\n` };
  }

  const isSourcePort = conn.sourceDeviceId === sourceDeviceId && conn.sourcePort === normalized;
  const clockRate = port.clockRate || 2000000;

  if (isSourcePort) {
    return { success: true, output: `\nInterface ${requestedInterface}\nDCE V.35, clock rate ${clockRate}\nCable type : V.35 DCE cable\n` };
  }

  return { success: true, output: `\nInterface ${requestedInterface}\nDTE V.35 serial cable attached\nCable type : V.35 DTE cable\n` };
}

/**
 * Show Nameif (firewall)
 */
export function cmdShowNameif(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\nInterface                Name                    Security Level\n';
  output += '----------------        --------------------    ---------------\n';
  Object.keys(state.ports || {}).forEach(portName => {
    const port = (state.ports || {})[portName];
    const name = port.nameif || 'not set';
    const level = port.securityLevel !== undefined ? String(port.securityLevel) : '-';
    output += `${portName.padEnd(24)}${name.padEnd(24)}${level}\n`;
  });
  output += '!\n';
  return { success: true, output };
}

/**
 * Show IP Access-Group (firewall)
 */
export function cmdShowIpAccessGroup(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\nInterface                Applied ACL           Direction\n';
  output += '----------------        --------------------    ---------\n';
  Object.keys(state.ports || {}).forEach(portName => {
    const port = (state.ports || {})[portName];
    if (port.accessGroupIn) {
      output += `${portName.padEnd(24)}${port.accessGroupIn.padEnd(24)}in\n`;
    }
    if (port.accessGroupOut) {
      output += `${portName.padEnd(24)}${port.accessGroupOut.padEnd(24)}out\n`;
    }
  });
  output += '!\n';
  return { success: true, output };
}
