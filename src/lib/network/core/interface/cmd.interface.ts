import { iosModeError } from '../iosErrors';
import type { CommandContext } from '../commandTypes';
import type { SwitchState, CommandResult, Port, SpeedMode, DuplexMode } from '../../types';
import { normalizePortId } from '../../initialState';
import { getPvstUpdate, getInterfaceStateUpdate } from '../commandHelpers';
import {
  isInInterfaceMode,
  isVlanInterfaceName,
  getVlanPortKey,
  expandInterfaceRange,
  applyToSelectedPorts
} from './helpers';

/**
 * Interface - Enter interface configuration mode
 */
export function cmdInterface(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^interface\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid interface command' };
  }

  const interfaceName = match[1].trim();

  // GRE tunnel interface (virtual routed interface)
  const tunnelMatch = interfaceName.match(/^tunnel\s*(\d+)$/i);
  if (tunnelMatch) {
    const tunnelId = tunnelMatch[1];
    const tunnelPortId = `tunnel${tunnelId}`;
    const newPorts = { ...state.ports };
    if (!newPorts[tunnelPortId]) {
      newPorts[tunnelPortId] = {
        id: tunnelPortId, name: `Tunnel${tunnelId}`, type: 'gigabitethernet', vlan: 1,
        status: 'notconnect', shutdown: false, mode: 'routed', duplex: 'auto', speed: 'auto',
        isRoutedPort: true, tunnel: { protocol: 'gre' }
      } as Port;
    }
    return { success: true, newState: { currentMode: 'interface', currentInterface: tunnelPortId, selectedInterfaces: [tunnelPortId], ports: newPorts } };
  }

  if (/^range\s+/i.test(interfaceName)) {
    const rangeSpec = interfaceName.replace(/^range\s+/i, '').trim();
    const selectedInterfaces = expandInterfaceRange(rangeSpec, state);
    if (selectedInterfaces.length === 0) {
      return { success: false, error: `% Invalid interface range: ${rangeSpec}` };
    }

    return {
      success: true,
      newState: {
        currentMode: 'config-if-range',
        currentInterface: selectedInterfaces[0],
        selectedInterfaces
      }
    };
  }

  // VLAN interface kontrolü (vlan 10, vlan 20, etc.)
  const vlanMatch = interfaceName.match(/^vlan\s+(\d+)$/i);
  if (vlanMatch) {
    const vlanId = parseInt(vlanMatch[1], 10);
    const vlanPortId = `vlan${vlanId}`;

    // VLAN port'u ve VLAN'ı oluştur (eğer yoksa)
    const newPorts = { ...state.ports };
    const newVlans = { ...state.vlans };
    if (!newPorts[vlanPortId]) {
      newPorts[vlanPortId] = {
        id: vlanPortId,
        name: `Vlan${vlanId}`,
        type: 'vlan',
        vlan: vlanId,
        status: 'notconnect',
        shutdown: false,
        mode: 'routed',
        duplex: 'auto',
        speed: 'auto'
      };
    }
    if (!newVlans[vlanId]) {
      newVlans[vlanId] = {
        id: vlanId,
        name: `VLAN${vlanId}`,
        status: 'active',
        ports: []
      };
    }

    return {
      success: true,
      newState: {
        currentMode: 'interface',
        currentInterface: vlanPortId,
        selectedInterfaces: [vlanPortId],
        ports: newPorts,
        vlans: newVlans
      }
    };
  }

  // Loopback interface - always create virtual interface
  const loopbackMatch = interfaceName.match(/^(?:loopback|lo)\s*(\d+)$/i);
  if (loopbackMatch) {
    const loopbackId = loopbackMatch[1];
    const normalizedLoopback = `loopback${loopbackId}`;
    const newPorts = { ...state.ports };
    if (!newPorts[normalizedLoopback]) {
      newPorts[normalizedLoopback] = {
        id: normalizedLoopback,
        name: `Loopback${loopbackId}`,
        type: 'gigabitethernet',
        vlan: 1,
        status: 'connected',
        shutdown: false,
        mode: 'routed',
        duplex: 'auto',
        speed: 'auto',
        isRoutedPort: true
      };
    }
    return {
      success: true,
      newState: {
        currentMode: 'interface',
        currentInterface: normalizedLoopback,
        selectedInterfaces: [normalizedLoopback],
        ports: newPorts
      }
    };
  }

  // Port-channel interface (port-channel 1, po 1, etc.)
  const poMatch = interfaceName.match(/^(?:port-channel|po)\s*(\d+)$/i);
  if (poMatch) {
    const groupId = parseInt(poMatch[1], 10);
    const poPortId = `po${groupId}`;

    const memberPorts = Object.keys(state.ports || {}).filter(
      pId => state.ports[pId]?.channelGroup === groupId
    );

    const newPorts = { ...state.ports };
    if (!newPorts[poPortId]) {
      newPorts[poPortId] = {
        id: poPortId,
        name: `Port-channel${groupId}`,
        type: 'gigabitethernet',
        vlan: 1,
        status: memberPorts.length > 0 ? 'connected' : 'notconnect',
        shutdown: false,
        mode: 'trunk',
        duplex: 'auto',
        speed: 'auto',
        channelGroup: groupId
      } as Port;
    }

    const selectedInterfaces = [poPortId, ...memberPorts];

    return {
      success: true,
      newState: {
        currentMode: 'interface',
        currentInterface: poPortId,
        selectedInterfaces,
        ports: newPorts
      }
    };
  }

  // PPPoE Client interface (pppoe-client, dialer 1, etc.)
  const pppoeMatch = interfaceName.match(/^(?:pppoe-client|dialer)\s*(\d+)$/i);
  if (pppoeMatch) {
    const dialerId = pppoeMatch[1];
    const normalizedDialer = `dialer${dialerId}`;
    const newPorts = { ...state.ports };
    if (!newPorts[normalizedDialer]) {
      newPorts[normalizedDialer] = {
        id: normalizedDialer,
        name: `Dialer${dialerId}`,
        type: 'gigabitethernet',
        vlan: 1,
        status: 'connected',
        shutdown: false,
        mode: 'routed',
        duplex: 'auto',
        speed: 'auto',
        isRoutedPort: true
      } as Port;
    }
    return {
      success: true,
      newState: {
        currentMode: 'interface',
        currentInterface: normalizedDialer,
        selectedInterfaces: [normalizedDialer],
        ports: newPorts
      }
    };
  }

  // Dot11Radio interface (Dot11Radio 0, Dot11Radio 1, dot11radio 0, etc.)
  const dot11Match = interfaceName.match(/^(?:dot11radio)\s*(\d+)$/i);
  if (dot11Match) {
    const radioId = dot11Match[1];
    const normalizedRadio = `dot11radio${radioId}`;
    const newPorts = { ...state.ports };
    if (!newPorts[normalizedRadio]) {
      newPorts[normalizedRadio] = {
        id: normalizedRadio,
        name: `Dot11Radio${radioId}`,
        type: 'gigabitethernet',
        vlan: 1,
        status: 'connected',
        shutdown: false,
        mode: 'routed',
        duplex: 'auto',
        speed: 'auto',
        isWirelessPort: true
      } as Port;
    }

    const newWirelessRadios = { ...state.wirelessRadios };
    if (!newWirelessRadios[radioId]) {
      newWirelessRadios[radioId] = {
        id: radioId,
        frequency: radioId === '0' ? '2.4GHz' : '5GHz',
        channel: radioId === '0' ? 6 : 36,
        power: 'full',
        ssid: '',
        encryption: 'none',
        stationRole: 'root' as const,
        shutdown: false,
      };
    }

    return {
      success: true,
      newState: {
        currentMode: 'dot11-config',
        currentInterface: normalizedRadio,
        currentRadio: radioId,
        selectedInterfaces: [normalizedRadio],
        ports: newPorts,
        wirelessRadios: newWirelessRadios
      }
    };
  }

  // Validate interface exists or create subinterface
  const normalized = normalizePortId(interfaceName) || interfaceName.toLowerCase();

  // Console is not a configurable switchport interface in CLI
  if (normalized === 'console') {
    return { success: false, error: "% Invalid interface type and number" };
  }

  // Check if it's a subinterface (contains a dot)
  const isSubinterface = normalized.includes('.');

  // For physical interfaces (not subinterfaces), validate the port exists
  if (!isSubinterface) {
    if (!state.ports || !state.ports[normalized]) {
      return { success: false, error: `% Interface ${interfaceName} does not exist` };
    }
  }

  // For subinterfaces, create them if they don't exist
  let newPorts = state.ports;
  if (isSubinterface && (!state.ports || !state.ports[normalized])) {
    newPorts = { ...state.ports };
    // Extract base interface and subinterface number
    const parts = normalized.split('.');
    const baseInterface = parts[0];
    const subinterfaceNum = parts[1];

    // Create the subinterface
    newPorts[normalized] = {
      id: normalized,
      name: `${normalized}`,
      type: normalized.startsWith('fa') ? 'fastethernet' : 'gigabitethernet',
      vlan: parseInt(subinterfaceNum) || 1,
      status: 'notconnect',
      shutdown: false,
      mode: 'routed',
      duplex: 'auto',
      speed: 'auto',
      isSubinterface: true,
      parentInterface: baseInterface
    };
  }

  return {
    success: true,
    newState: {
      currentMode: 'interface',
      currentInterface: normalized,
      selectedInterfaces: [normalized],
      ...(isSubinterface && newPorts !== state.ports ? { ports: newPorts } : {})
    }
  };
}

/**
 * Shutdown - Administratively disable interface
 */
export function cmdShutdown(state: SwitchState, _input: string, ctx: CommandContext): CommandResult {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: iosModeError() };
  }

  // VLAN interface'i için shutdown
  if (isVlanInterfaceName(state.currentInterface)) {
    const vlanPortKey = getVlanPortKey(state.currentInterface);
    const newPorts = { ...state.ports };
    if (newPorts[vlanPortKey]) {
      newPorts[vlanPortKey] = { ...newPorts[vlanPortKey], shutdown: true };
    }
    const updatedCurrentState = { ...state, ports: newPorts };
    const pvst = getPvstUpdate(updatedCurrentState, ctx);
    const allUpdatedStates = 'error' in pvst ? undefined : pvst.allUpdatedStates;
    const portName = state.currentInterface;
    return {
      success: true,
      output: `%LINK-5-CHANGED: Interface ${portName}, changed state to administratively down\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${portName}, changed state to down\n`,
      newState: { ports: newPorts },
      deviceStates: allUpdatedStates
    };
  }

  const newPorts = applyToSelectedPorts(state, (port: Port) => ({ ...port, shutdown: true }));

  // Recalculate STP, flush ARP/MAC tables and recalc topology-wide state
  const changedPortIds = Object.entries(newPorts)
    .filter(([id, p]) => p.shutdown && (!state.ports[id] || !state.ports[id].shutdown))
    .map(([id]) => id);
  const updatedCurrentState = { ...state, ports: newPorts };
  const pvst = getInterfaceStateUpdate(updatedCurrentState, ctx, changedPortIds);
  if ('error' in pvst) return pvst.error;
  const { allUpdatedStates, myUpdatedState } = pvst;

  // Return the new ports for the current device and the updated states for all switches
  const finalPorts = myUpdatedState ? myUpdatedState.ports : newPorts;
  const portName = state.currentInterface;

  return {
    success: true,
    output: `%LINK-5-CHANGED: Interface ${portName}, changed state to administratively down\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${portName}, changed state to down\n`,
    newState: { ports: finalPorts },
    deviceStates: allUpdatedStates
  };
}

/**
 * No Shutdown - Enable interface
 */
export function cmdNoShutdown(state: SwitchState, _input: string, ctx: CommandContext): CommandResult {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: iosModeError() };
  }

  // VLAN interface'i için no shutdown
  if (isVlanInterfaceName(state.currentInterface)) {
    const vlanPortKey = getVlanPortKey(state.currentInterface);
    const newPorts = { ...state.ports };
    if (newPorts[vlanPortKey]) {
      newPorts[vlanPortKey] = { ...newPorts[vlanPortKey], shutdown: false };
    }
    const updatedCurrentState = { ...state, ports: newPorts };
    const pvst = getPvstUpdate(updatedCurrentState, ctx);
    const allUpdatedStates = 'error' in pvst ? undefined : pvst.allUpdatedStates;
    const portName = state.currentInterface;
    return {
      success: true,
      output: `%LINK-3-UPDOWN: Interface ${portName}, changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${portName}, changed state to up\n`,
      newState: { ports: newPorts },
      deviceStates: allUpdatedStates
    };
  }

  const newPorts = applyToSelectedPorts(state, (port: Port) => ({ ...port, shutdown: false }));

  // Recalculate STP, flush ARP/MAC tables and recalc topology-wide state
  const changedPortIds = Object.entries(state.ports)
    .filter(([id, p]) => p.shutdown && (!newPorts[id] || !newPorts[id].shutdown))
    .map(([id]) => id);
  const updatedCurrentState = { ...state, ports: newPorts };
  const pvst = getInterfaceStateUpdate(updatedCurrentState, ctx, changedPortIds);
  if ('error' in pvst) return pvst.error;
  const { allUpdatedStates, myUpdatedState } = pvst;

  // Return the new ports for the current device and the updated states for all switches
  const finalPorts = myUpdatedState ? myUpdatedState.ports : newPorts;
  const portName = state.currentInterface;

  return {
    success: true,
    output: `%LINK-3-UPDOWN: Interface ${portName}, changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${portName}, changed state to up\n`,
    newState: { ports: finalPorts },
    deviceStates: allUpdatedStates,
    hint: {
      tr: '💡 Gerçek dünyada: "no shutdown" komutu arayüzü fiziksel olarak aktif hale getirir. Yeni cihazlarda portlar genelde "shutdown" durumundadır.',
      en: '💡 In the real world: The "no shutdown" command physically activates the interface. On new devices, ports are usually in "shutdown" state by default.'
    }
  };
}

/**
 * Speed - Set interface speed
 */
export function cmdSpeed(state: SwitchState, input: string, ctx: CommandContext): CommandResult {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^speed\s+(10|100|1000|10000|auto)$/i);
  if (!match) {
    return { success: false, error: "% Invalid input detected at '^' marker." };
  }

  const newPorts = applyToSelectedPorts(state, (port: Port) => ({ ...port, speed: match[1].toLowerCase() as SpeedMode }));
  const updatedCurrentState = { ...state, ports: newPorts };
  const pvst = getPvstUpdate(updatedCurrentState, ctx);
  if ('error' in pvst) return pvst.error;
  const { allUpdatedStates, myUpdatedState } = pvst;

  return {
    success: true,
    newState: myUpdatedState || ({ ports: newPorts } as Partial<SwitchState>),
    deviceStates: allUpdatedStates
  };
}

/**
 * Duplex - Set duplex mode
 */
export function cmdDuplex(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^duplex\s+(half|full|auto)$/i);
  if (!match) {
    return { success: false, error: "% Invalid input detected at '^' marker." };
  }

  const duplex = match[1].toLowerCase() as DuplexMode;

  // Reject half duplex on GigabitEthernet interfaces
  if (duplex === 'half') {
    const port = state.ports[state.currentInterface];
    const isGigabit = port?.type === 'gigabitethernet' || /^gi/i.test(state.currentInterface);
    if (isGigabit) {
      return { success: false, error: '% GigabitEthernet interfaces do not support half duplex.' };
    }
  }

  const newPorts = applyToSelectedPorts(state, (port: Port) => ({ ...port, duplex }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * standby <group> ip <virtual-ip>
 */
export function cmdStandbyIp(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (!isInInterfaceMode(state) || !state.currentInterface) return { success: false, error: iosModeError() };
  const match = input.match(/^standby\s+(\d+)\s+ip\s+([0-9.]+)$/i);
  if (!match) return { success: false, error: '% Invalid standby command' };

  const group = parseInt(match[1]);
  const virtualIp = match[2];

  const updatePort = (port: Port) => {
    const hsrp = port.hsrp || { groups: {} };
    const groups = hsrp.groups || {};
    groups[group] = { ...groups[group], virtualIp, state: 'Active' };
    return { ...port, hsrp: { ...hsrp, groups } };
  };

  const newPorts = applyToSelectedPorts(state, updatePort);
  return { success: true, newState: { ports: newPorts } };
}

/**
 * standby <group> priority <priority>
 */
export function cmdStandbyPriority(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (!isInInterfaceMode(state) || !state.currentInterface) return { success: false, error: iosModeError() };
  const match = input.match(/^standby\s+(\d+)\s+priority\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid standby command' };

  const group = parseInt(match[1]);
  const priority = parseInt(match[2]);

  const updatePort = (port: Port) => {
    const hsrp = port.hsrp || { groups: {} };
    const groups = hsrp.groups || {};
    groups[group] = { ...groups[group], priority };
    return { ...port, hsrp: { ...hsrp, groups } };
  };

  const newPorts = applyToSelectedPorts(state, updatePort);
  return { success: true, newState: { ports: newPorts } };
}

/**
 * standby <group> ipv6 <virtual-ipv6>
 */
export function cmdStandbyIpv6(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (!isInInterfaceMode(state) || !state.currentInterface) return { success: false, error: iosModeError() };
  const match = input.match(/^standby\s+(\d+)\s+ipv6\s+([0-9a-fA-F:]+)$/i);
  if (!match) return { success: false, error: '% Invalid standby command' };

  const group = parseInt(match[1]);
  const ipv6VirtualIp = match[2];

  const updatePort = (port: Port) => {
    const hsrp = port.hsrp || { groups: {} };
    const groups = hsrp.groups || {};
    (groups[group] as Record<string, unknown>).ipv6VirtualIp = ipv6VirtualIp;
    (groups[group] as Record<string, unknown>).state = 'Active';
    return { ...port, hsrp: { ...hsrp, groups } };
  };

  const newPorts = applyToSelectedPorts(state, updatePort);
  return { success: true, newState: { ports: newPorts } };
}

export function cmdStandbyPreempt(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (!isInInterfaceMode(state) || !state.currentInterface) return { success: false, error: iosModeError() };
  const match = input.match(/^standby\s+(\d+)\s+preempt$/i);
  if (!match) return { success: false, error: '% Invalid standby command' };

  const group = parseInt(match[1]);

  const updatePort = (port: Port) => {
    const hsrp = port.hsrp || { groups: {} };
    const groups = hsrp.groups || {};
    groups[group] = { ...groups[group], preempt: true };
    return { ...port, hsrp: { ...hsrp, groups } };
  };

  const newPorts = applyToSelectedPorts(state, updatePort);
  return { success: true, newState: { ports: newPorts } };
}

/**
 * Description - Set interface description
 */
export function cmdDescription(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^description\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid description command' };
  }

  const newPorts = applyToSelectedPorts(state, (port: Port) => ({ ...port, description: match[1] }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}
export function cmdNoDescription(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const newPorts = applyToSelectedPorts(state, (port: Port) => ({
    ...port,
    description: ''
  }));

  return { success: true, newState: { ports: newPorts } };
}
