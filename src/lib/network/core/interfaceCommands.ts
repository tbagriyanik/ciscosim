import type { CommandHandler } from './commandTypes';
import { normalizePortId } from '../initialState';
import { canAssignIPToPhysicalPort } from '../switchModels';
import { buildRunningConfig } from './configBuilder';

// Helper function to check if in interface mode (single or range)
function isInInterfaceMode(state: any): boolean {
  return state.currentMode === 'interface' || state.currentMode === 'config-if-range';
}

function isVlanInterfaceName(interfaceName: string | undefined): boolean {
  return !!interfaceName && /^vlan\d+$/i.test(interfaceName);
}

function normalizeWifiMode(mode: string | undefined): 'ap' | 'client' | 'disabled' {
  const normalized = (mode || 'disabled').toLowerCase();
  if (normalized === 'sta') return 'client';
  if (normalized === 'ap' || normalized === 'client' || normalized === 'disabled') return normalized;
  return 'disabled';
}

function getVlanPortKey(interfaceName: string): string {
  return interfaceName.toLowerCase();
}

// Interface-level komutlar (interface, shutdown, speed, duplex, switchport, ip address, vs.)

export const interfaceHandlers: Record<string, CommandHandler> = {
  'interface': cmdInterface,
  'interface range': cmdInterface,
  'shutdown': cmdShutdown,
  'no shutdown': cmdNoShutdown,
  'speed': cmdSpeed,
  'duplex': cmdDuplex,
  'description': cmdDescription,
  'switchport mode access': cmdSwitchportModeAccess,
  'switchport mode trunk': cmdSwitchportModeTrunk,
  'switchport access vlan': cmdSwitchportAccessVlan,
  'switchport trunk native vlan': cmdSwitchportTrunkNativeVlan,
  'switchport trunk allowed vlan': cmdSwitchportTrunkAllowedVlan,
  'switchport port-security': cmdSwitchportPortSecurity,
  'switchport port-security maximum': cmdSwitchportPortSecurityMaximum,
  'switchport port-security violation': cmdSwitchportPortSecurityViolation,
  'switchport port-security mac-address sticky': cmdSwitchportPortSecuritySticky,
  'no switchport': cmdNoSwitchport,
  'spanning-tree portfast': cmdSpanningTreePortfast,
  'spanning-tree bpduguard enable': cmdSpanningTreeBpduguard,
  'ip address': cmdIpAddress,
  'no ip address': cmdNoIpAddress,
  'ip default-gateway': cmdIpDefaultGateway,
  'no ip default-gateway': cmdNoIpDefaultGateway,
  'ssid': cmdSsid,
  'encryption': cmdEncryption,
  'wifi-password': cmdWifiPassword,
  'wifi-channel': cmdWifiChannel,
  'wifi-mode': cmdWifiMode,
  // No commands for interface
  'no description': cmdNoDescription,
  'no switchport mode': cmdNoSwitchportMode,
  'no switchport access vlan': cmdNoSwitchportAccessVlan,
  'no switchport port-security': cmdNoSwitchportPortSecurity,
  'no cdp enable': cmdNoCdpEnable,
  'no udld': cmdNoUdld,
  'no ip proxy-arp': cmdNoIpProxyArp,
  'no keepalive': cmdNoKeepalive,
  'no name': cmdNoName,
  'no spanning-tree': cmdNoSpanningTree,
  // Debug and monitor
  'debug': cmdDebug,
  'no debug': cmdNoDebug,
  'monitor session': cmdMonitorSession,
  'no monitor session': cmdNoMonitorSession,
  // Access-list
  'access-list': cmdAccessList,
  'no access-list': cmdNoAccessList,
  // EtherChannel
  'channel-group': cmdChannelGroup,
  'no channel-group': cmdNoChannelGroup,
  // DHCP relay
  'ip helper-address': cmdIpHelperAddress,
  'no ip helper-address': cmdNoIpHelperAddress,
  // Switchport extras
  'switchport nonegotiate': cmdSwitchportNonegotiate,
  'switchport voice vlan': cmdSwitchportVoiceVlan,
  // CDP
  'cdp enable': cmdCdpEnable,
  // Spanning-tree extras
  'spanning-tree bpduguard disable': cmdSpanningTreeBpduguardDisable,
  'spanning-tree cost': cmdSpanningTreeCost,
  'spanning-tree priority': cmdSpanningTreePriority,
};

/**
 * Interface - Enter interface configuration mode
 */
function cmdInterface(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^interface\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid interface command' };
  }

  const interfaceName = match[1].trim();

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
        status: 'up',
        shutdown: false,
        mode: 'routed'
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

  // Validate interface exists or create subinterface
  const normalized = normalizePortId(interfaceName) || interfaceName.toLowerCase();

  // Check if it's a subinterface (contains a dot)
  const isSubinterface = normalized.includes('.');

  if (!isSubinterface && (!state.ports || !state.ports[normalized])) {
    return { success: false, error: `% Interface ${interfaceName} does not exist` };
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
      status: 'up',
      shutdown: false,
      mode: 'routed',
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
function cmdShutdown(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  // VLAN interface'i için shutdown
  if (isVlanInterfaceName(state.currentInterface)) {
    const vlanPortKey = getVlanPortKey(state.currentInterface);
    const newPorts = { ...state.ports };
    if (newPorts[vlanPortKey]) {
      newPorts[vlanPortKey] = { ...newPorts[vlanPortKey], shutdown: true };
    }
    return {
      success: true,
      newState: { ports: newPorts }
    };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, shutdown: true }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * No Shutdown - Enable interface
 */
function cmdNoShutdown(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  // VLAN interface'i için no shutdown
  if (isVlanInterfaceName(state.currentInterface)) {
    const vlanPortKey = getVlanPortKey(state.currentInterface);
    const newPorts = { ...state.ports };
    if (newPorts[vlanPortKey]) {
      newPorts[vlanPortKey] = { ...newPorts[vlanPortKey], shutdown: false };
    }
    return {
      success: true,
      newState: { ports: newPorts }
    };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, shutdown: false }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Speed - Set interface speed
 */
function cmdSpeed(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^speed\s+(10|100|1000|auto)$/i);
  if (!match) {
    return { success: false, error: '% Invalid speed value (10, 100, 1000, auto)' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, speed: match[1].toLowerCase() }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Duplex - Set duplex mode
 */
function cmdDuplex(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^duplex\s+(half|full|auto)$/i);
  if (!match) {
    return { success: false, error: '% Invalid duplex value (half, full, auto)' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, duplex: match[1].toLowerCase() }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Description - Set interface description
 */
function cmdDescription(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^description\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid description command' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, description: match[1] }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * No Switchport - Convert physical port to routed port (L3 switch only)
 */
function cmdNoSwitchport(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  // Check if device supports L3 routing
  if (!canAssignIPToPhysicalPort(state.switchModel)) {
    return {
      success: false,
      error: `% Invalid command. Layer 2 switch (${state.switchModel}) does not support routed ports.\nno switchport is only available on Layer 3 switches.`
    };
  }

  // Don't allow on VLAN interfaces
  if (isVlanInterfaceName(state.currentInterface)) {
    return { success: false, error: '% Invalid command on VLAN interface' };
  }

  // Don't allow on WLAN interface
  if (state.currentInterface.toLowerCase().startsWith('wlan')) {
    return { success: false, error: '% Invalid command on WLAN interface' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    mode: 'routed',
    // Clear Layer 2 specific settings
    accessVlan: undefined,
    nativeVlan: undefined,
    allowedVlans: undefined,
    portSecurity: undefined,
    spanningTree: undefined,
  }));

  return {
    success: true,
    output: `Interface ${state.currentInterface} converted to routed port`,
    newState: { ports: newPorts }
  };
}

/**
 * Switchport Mode Access
 */
function cmdSwitchportModeAccess(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, mode: 'access' }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Switchport Mode Trunk
 */
function cmdSwitchportModeTrunk(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, mode: 'trunk' }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Switchport Access VLAN
 */
function cmdSwitchportAccessVlan(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^switchport\s+access\s+vlan\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid VLAN ID' };
  }

  const vlanId = match[1];
  const vlanIdNum = Number(vlanId);
  const targets = Array.isArray(state.selectedInterfaces) && state.selectedInterfaces.length > 0
    ? state.selectedInterfaces
    : state.currentInterface
      ? [state.currentInterface]
      : [];

  const newPorts = { ...state.ports };
  const newVlans = { ...state.vlans };
  if (!newVlans[vlanIdNum]) {
    newVlans[vlanIdNum] = { id: vlanIdNum, name: `VLAN${vlanIdNum}`, status: 'active', ports: [] };
  }

  targets.forEach((portId: string) => {
    const port = newPorts[portId];
    if (!port) return;

    const oldVlanId = Number((port as any).accessVlan || port.vlan || 1);
    const targetVlanId = vlanIdNum;

    // Remove port from previous VLAN membership
    if (newVlans[oldVlanId]) {
      newVlans[oldVlanId] = {
        ...newVlans[oldVlanId],
        ports: newVlans[oldVlanId].ports.filter((p: string) => p.toLowerCase() !== port.id.toLowerCase())
      };
    }

    // Add port to new VLAN membership
    if (!newVlans[targetVlanId]) {
      newVlans[targetVlanId] = { id: targetVlanId, name: `VLAN${targetVlanId}`, status: 'active', ports: [] };
    }
    const upperPortId = port.id.toUpperCase();
    if (!newVlans[targetVlanId].ports.includes(upperPortId)) {
      newVlans[targetVlanId] = {
        ...newVlans[targetVlanId],
        ports: [...newVlans[targetVlanId].ports, upperPortId]
      };
    }

    newPorts[portId] = {
      ...port,
      accessVlan: vlanId,
      vlan: targetVlanId,
      mode: 'access',
    };
  });

  return {
    success: true,
    newState: { ports: newPorts, vlans: newVlans }
  };
}

/**
 * Switchport Trunk Native VLAN
 */
function cmdSwitchportTrunkNativeVlan(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^switchport\s+trunk\s+native\s+vlan\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid VLAN ID' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, nativeVlan: match[1] }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Switchport Trunk Allowed VLAN
 */
function cmdSwitchportTrunkAllowedVlan(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^switchport\s+trunk\s+allowed\s+vlan\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid VLAN list' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, allowedVlans: match[1] }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Switchport Port-Security
 */
function cmdSwitchportPortSecurity(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newPorts = { ...state.ports };
  if (!newPorts[state.currentInterface].portSecurity) {
    newPorts[state.currentInterface].portSecurity = {};
  }
  newPorts[state.currentInterface].portSecurity.enabled = true;

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Switchport Port-Security Maximum
 */
function cmdSwitchportPortSecurityMaximum(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^switchport\s+port-security\s+maximum\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid maximum value' };
  }

  const newPorts = { ...state.ports };
  if (!newPorts[state.currentInterface].portSecurity) {
    newPorts[state.currentInterface].portSecurity = {};
  }
  newPorts[state.currentInterface].portSecurity.maxAddresses = parseInt(match[1]);

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Switchport Port-Security Violation
 */
function cmdSwitchportPortSecurityViolation(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^switchport\s+port-security\s+violation\s+(protect|restrict|shutdown)$/i);
  if (!match) {
    return { success: false, error: '% Invalid violation mode (protect, restrict, shutdown)' };
  }

  const newPorts = { ...state.ports };
  if (!newPorts[state.currentInterface].portSecurity) {
    newPorts[state.currentInterface].portSecurity = {};
  }
  newPorts[state.currentInterface].portSecurity.violationAction = match[1].toLowerCase();

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Switchport Port-Security MAC-Address Sticky
 */
function cmdSwitchportPortSecuritySticky(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newPorts = { ...state.ports };
  if (!newPorts[state.currentInterface].portSecurity) {
    newPorts[state.currentInterface].portSecurity = {};
  }
  newPorts[state.currentInterface].portSecurity.sticky = true;

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Spanning-Tree Portfast
 */
function cmdSpanningTreePortfast(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newPorts = { ...state.ports };
  if (!newPorts[state.currentInterface].spanningTree) {
    newPorts[state.currentInterface].spanningTree = {};
  }
  newPorts[state.currentInterface].spanningTree.portfast = true;

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Spanning-Tree BPDU Guard
 */
function cmdSpanningTreeBpduguard(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newPorts = { ...state.ports };
  if (!newPorts[state.currentInterface].spanningTree) {
    newPorts[state.currentInterface].spanningTree = {};
  }
  newPorts[state.currentInterface].spanningTree.bpduguard = true;

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * IP Address - Assign IP to routed port or VLAN interface
 */
function cmdIpAddress(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const match = input.match(/^ip\s+address\s+(\d{1,3}(?:\.\d{1,3}){3})(?:\s+(\d{1,3}(?:\.\d{1,3}){3})|\/(\d|[12]\d|3[0-2]))$/i);
  if (!match) {
    return { success: false, error: '% Invalid input: ip address <ip> <mask> or ip address <ip>/<prefix>' };
  }

  const [, ip, dottedMask, prefixLength] = match;
  const mask = dottedMask || prefixToSubnetMask(parseInt(prefixLength, 10));

  if (!isValidIP(ip) || !mask || !isValidIP(mask)) {
    return { success: false, error: '% Invalid IP address format' };
  }

  // VLAN interface'i için IP atama
  if (isVlanInterfaceName(state.currentInterface)) {
    const vlanPortKey = getVlanPortKey(state.currentInterface);
    const vlanId = parseInt(vlanPortKey.replace(/^vlan/, ''), 10);
    const newPorts = { ...state.ports };

    if (newPorts[vlanPortKey]) {
      newPorts[vlanPortKey] = {
        ...newPorts[vlanPortKey],
        ipAddress: ip,
        subnetMask: mask,
        mode: 'routed'
      };
    }

    const updatedState = { ...state, ports: newPorts };
    return {
      success: true,
      output: `Interface Vlan${vlanId} configured with IP ${ip} ${mask}`,
      newState: { ports: newPorts, runningConfig: buildRunningConfig(updatedState) }
    };
  }

  // Layer 2 switch kontrolü - fastethernet portlarına IP ataması engelle
  if (!canAssignIPToPhysicalPort(state.switchModel)) {
    const port = state.ports[state.currentInterface];
    if (port && (port.type === 'fastethernet' || port.type === 'gigabitethernet')) {
      return {
        success: false,
        error: `% Invalid command. Layer 2 switch (${state.switchModel}) does not support IP addressing on physical ports.\nUse VLAN interface instead: interface vlan <vlan-id>`
      };
    }
  }

  // Fiziksel port'a IP atama (Layer 3 switch veya routed port)
  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, ipAddress: ip, subnetMask: mask, mode: 'routed' }));

  const updatedState = { ...state, ports: newPorts };
  return {
    success: true,
    newState: { ports: newPorts, runningConfig: buildRunningConfig(updatedState) }
  };
}

/**
 * No IP Address - Remove IP from interface
 */
function cmdNoIpAddress(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  // VLAN interface'i için IP kaldırma
  if (isVlanInterfaceName(state.currentInterface)) {
    const vlanPortKey = getVlanPortKey(state.currentInterface);
    const newPorts = { ...state.ports };

    if (newPorts[vlanPortKey]) {
      newPorts[vlanPortKey] = {
        ...newPorts[vlanPortKey],
        ipAddress: undefined,
        subnetMask: undefined
      };
    }

    const updatedState = { ...state, ports: newPorts };
    return {
      success: true,
      newState: { ports: newPorts, runningConfig: buildRunningConfig(updatedState) }
    };
  }

  // Fiziksel port'tan IP kaldırma
  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, ipAddress: undefined, subnetMask: undefined, mode: 'access' }));

  const updatedState = { ...state, ports: newPorts };
  return {
    success: true,
    newState: { ports: newPorts, runningConfig: buildRunningConfig(updatedState) }
  };
}

/**
 * IP Default-Gateway - Configured from interface mode
 */
function cmdIpDefaultGateway(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const match = input.match(/^ip\s+default-gateway\s+([0-9.]+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid default-gateway command' };
  }

  return {
    success: true,
    newState: { defaultGateway: match[1] }
  };
}

/**
 * No IP Default-Gateway - Configured from interface mode
 */
function cmdNoIpDefaultGateway(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  return {
    success: true,
    newState: { defaultGateway: undefined }
  };
}

/**
 * Helper function to validate IP address
 */
function isValidIP(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    const num = parseInt(part);
    if (isNaN(num) || num < 0 || num > 255) return false;
  }
  return true;
}

function prefixToSubnetMask(prefixLength: number): string | null {
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    return null;
  }

  const mask = [0, 0, 0, 0];
  let remaining = prefixLength;
  for (let i = 0; i < 4; i++) {
    const bits = Math.min(8, Math.max(0, remaining));
    mask[i] = bits === 0 ? 0 : (0xff << (8 - bits)) & 0xff;
    remaining -= bits;
  }
  return mask.join('.');
}

function expandInterfaceRange(rangeSpec: string, state: any): string[] {
  const normalized = rangeSpec.replace(/\s+/g, '').toLowerCase();

  // Handle comma-separated ranges: fa0/1,3,6 or fa0/1-4,7-9
  const parts = normalized.split(',');
  const allPorts: string[] = [];

  for (const part of parts) {
    const match = part.match(/^(fastethernet|gigabitethernet|gigabit|fastethernet|fa|gig|gi)(\d+)\/(\d+)(?:-(\d+))?$/);
    if (!match) continue;

    const prefix = match[1].startsWith('f') ? 'fa' : 'gi';
    const moduleNum = match[2];
    const startPort = parseInt(match[3], 10);
    const endPort = match[4] ? parseInt(match[4], 10) : startPort;

    if (Number.isNaN(startPort) || Number.isNaN(endPort) || endPort < startPort) continue;

    const available = Object.keys(state.ports || {});
    const modulePorts = available
      .filter(portId => portId.startsWith(`${prefix}${moduleNum}/`))
      .map(portId => parseInt(portId.split('/')[1] || '', 10))
      .filter(n => !Number.isNaN(n))
      .sort((a, b) => a - b);

    if (modulePorts.length === 0) return [];
    const minPort = modulePorts[0];
    const maxPort = modulePorts[modulePorts.length - 1];
    if (startPort < minPort || endPort > maxPort) return [];

    for (let port = startPort; port <= endPort; port++) {
      const normalizedId = `${prefix}${moduleNum}/${port}`;
      if (available.includes(normalizedId) && !allPorts.includes(normalizedId)) {
        allPorts.push(normalizedId);
      }
    }
  }

  return allPorts;
}

function applyToSelectedPorts(state: any, updater: (port: any) => any) {
  const newPorts = { ...state.ports };
  const targets = Array.isArray(state.selectedInterfaces) && state.selectedInterfaces.length > 0
    ? state.selectedInterfaces
    : state.currentInterface
      ? [state.currentInterface]
      : [];

  targets.forEach((portId: string) => {
    if (newPorts[portId]) {
      newPorts[portId] = updater(newPorts[portId]);
    }
  });

  return newPorts;
}

/**
 * SSID - Set Wireless SSID
 */
function cmdSsid(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }
  if (!state.currentInterface.toLowerCase().startsWith('wlan')) {
    return { success: false, error: '% Wireless commands are only valid on WLAN interfaces' };
  }

  const match = input.match(/^ssid\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid SSID' };

  const ssid = match[1].trim();
  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    wifi: { ...port.wifi, ssid }
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * Encryption - Set Wireless Security
 */
function cmdEncryption(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }
  if (!state.currentInterface.toLowerCase().startsWith('wlan')) {
    return { success: false, error: '% Wireless commands are only valid on WLAN interfaces' };
  }

  const match = input.match(/^encryption\s+(open|wpa|wpa2|wpa3)$/i);
  if (!match) return { success: false, error: '% Invalid encryption (open, wpa, wpa2, wpa3)' };

  const security = match[1].toLowerCase();
  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    wifi: { ...port.wifi, security }
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * Wifi-Password - Set Wireless Key
 */
function cmdWifiPassword(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }
  if (!state.currentInterface.toLowerCase().startsWith('wlan')) {
    return { success: false, error: '% Wireless commands are only valid on WLAN interfaces' };
  }

  const match = input.match(/^wifi-password\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid password' };

  const password = match[1].trim();
  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    wifi: { ...port.wifi, password }
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * Channel - Set Wireless Channel/Band
 */
function cmdWifiChannel(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }
  if (!state.currentInterface.toLowerCase().startsWith('wlan')) {
    return { success: false, error: '% Wireless commands are only valid on WLAN interfaces' };
  }

  const match = input.match(/^wifi-channel\s+(2\.4ghz|5ghz)$/i);
  if (!match) return { success: false, error: '% Invalid channel (2.4ghz, 5ghz)' };

  const channel = match[1].toLowerCase() === '2.4ghz' ? '2.4GHz' : '5GHz';
  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    wifi: { ...port.wifi, channel }
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * Wifi-Mode - Set Wireless Mode
 */
function cmdWifiMode(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }
  if (!state.currentInterface.toLowerCase().startsWith('wlan')) {
    return { success: false, error: '% Wireless commands are only valid on WLAN interfaces' };
  }

  const match = input.match(/^wifi-mode\s+(ap|client|disabled)$/i);
  if (!match) return { success: false, error: '% Invalid mode (ap, client, disabled)' };

  const mode = match[1].toLowerCase();
  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    wifi: { ...port.wifi, mode: normalizeWifiMode(mode) }
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * No Description - Clear interface description
 */
function cmdNoDescription(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    description: ''
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * No Switchport Mode - Reset switchport mode
 */
function cmdNoSwitchportMode(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    switchportMode: 'auto'
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * No Switchport Access VLAN - Reset access VLAN
 */
function cmdNoSwitchportAccessVlan(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const targets = Array.isArray(state.selectedInterfaces) && state.selectedInterfaces.length > 0
    ? state.selectedInterfaces
    : state.currentInterface
      ? [state.currentInterface]
      : [];

  const newPorts = { ...state.ports };
  const newVlans = { ...state.vlans };

  targets.forEach((portId: string) => {
    const port = newPorts[portId];
    if (!port) return;

    const oldVlanId = Number((port as any).accessVlan || port.vlan || 1);
    const targetVlanId = 1;

    if (newVlans[oldVlanId]) {
      newVlans[oldVlanId] = {
        ...newVlans[oldVlanId],
        ports: newVlans[oldVlanId].ports.filter((p: string) => p.toLowerCase() !== port.id.toLowerCase())
      };
    }

    const upperPortId = port.id.toUpperCase();
    if (!newVlans[targetVlanId]) {
      newVlans[targetVlanId] = { id: 1, name: 'default', status: 'active', ports: [] };
    }
    if (!newVlans[targetVlanId].ports.includes(upperPortId)) {
      newVlans[targetVlanId] = {
        ...newVlans[targetVlanId],
        ports: [...newVlans[targetVlanId].ports, upperPortId]
      };
    }

    newPorts[portId] = {
      ...port,
      accessVlan: targetVlanId,
      vlan: targetVlanId
    };
  });

  return { success: true, newState: { ports: newPorts, vlans: newVlans } };
}

/**
 * No Switchport Port-Security - Disable port security
 */
function cmdNoSwitchportPortSecurity(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    portSecurity: undefined
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * No CDP Enable - Disable CDP on interface
 */
function cmdNoCdpEnable(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    cdpEnabled: false
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * No Channel-Group - Remove EtherChannel
 */
function cmdNoChannelGroup(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    channelGroup: undefined,
    channelProtocol: undefined
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * No UDLD - Disable UDLD on interface
 */
function cmdNoUdld(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    udldEnabled: false
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * No IP Proxy-ARP - Disable proxy ARP
 */
function cmdNoIpProxyArp(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    ipProxyArp: false
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * No Keepalive - Disable keepalive
 */
function cmdNoKeepalive(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    keepalive: false
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * No Name - Clear interface name
 */
function cmdNoName(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const iface = state.currentInterface.toLowerCase();
  if (iface.startsWith('vlan')) {
    const vlanId = iface.replace('vlan', '');
    const newVlans = { ...state.vlans };
    if (newVlans[vlanId]) {
      newVlans[vlanId] = { ...newVlans[vlanId], name: `VLAN${vlanId}` };
    }
    return { success: true, newState: { vlans: newVlans } };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, name: '' }));
  return { success: true, newState: { ports: newPorts } };
}

/**
 * No Spanning-Tree - Disable spanning-tree on interface
 */
function cmdNoSpanningTree(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state) || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    spanningTreeEnabled: false
  }));

  return { success: true, newState: { ports: newPorts } };
}

/**
 * Debug - Enable debug
 */
function cmdDebug(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'privileged') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^debug\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid debug command' };
  }

  return { success: true, output: `Debug ${match[1]} enabled` };
}

/**
 * No Debug - Disable debug
 */
function cmdNoDebug(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'privileged' && state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^no\s+debug\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid debug command' };
  }

  return { success: true, output: `Debug ${match[1]} disabled` };
}

/**
 * Monitor Session - Configure port monitoring
 */
function cmdMonitorSession(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^monitor\s+session\s+(\d+)\s+(source|destination)\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid monitor session command' };
  }

  return { success: true, output: `Monitor session ${match[1]} configured` };
}

/**
 * No Monitor Session - Remove port monitoring
 */
function cmdNoMonitorSession(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^no\s+monitor\s+session\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid monitor session command' };
  }

  return { success: true, output: `Monitor session ${match[1]} removed` };
}

/**
 * Access-List - Configure ACL
 */
function cmdAccessList(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^access-list\s+(\d+)\s+(permit|deny)\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid access-list command' };
  }

  return { success: true, output: `Access-list ${match[1]} configured` };
}

/**
 * No Access-List - Remove ACL
 */
function cmdNoAccessList(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^no\s+access-list\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid access-list command' };
  }

  return { success: true, output: `Access-list ${match[1]} removed` };
}

/**
 * Channel-Group - Assign interface to EtherChannel
 */
function cmdChannelGroup(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^channel-group\s+(\d+)\s+mode\s+(active|passive|on|desirable|auto)$/i);
  if (!match) {
    return { success: false, error: '% Invalid channel-group command. Use: channel-group <1-48> mode {active|passive|on|desirable|auto}' };
  }

  const group = parseInt(match[1]);
  const mode = match[2].toLowerCase();

  const updatePort = (port: any) => ({ ...port, channelGroup: group, channelGroupMode: mode });

  if (state.selectedInterfaces?.length) {
    return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  }

  if (!state.currentInterface) return { success: false, error: '% No interface selected' };

  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: `Channel-group ${group} mode ${mode} configured`, newState: { ports: newPorts } };
}

/**
 * IP Helper-Address - Set DHCP relay address
 */
function cmdIpHelperAddress(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^ip\s+helper-address\s+(\d+\.\d+\.\d+\.\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid ip helper-address command. Use: ip helper-address <ip>' };
  }

  const helperIp = match[1];
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };

  const newPorts = { ...state.ports };
  const port = newPorts[state.currentInterface] || {};
  const helpers: string[] = [...(port.helperAddresses || [])];
  if (!helpers.includes(helperIp)) helpers.push(helperIp);
  newPorts[state.currentInterface] = { ...port, helperAddresses: helpers };

  return { success: true, output: `Helper address ${helperIp} added`, newState: { ports: newPorts } };
}

/**
 * No IP Helper-Address - Remove DHCP relay address
 */
function cmdNoIpHelperAddress(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^no\s+ip\s+helper-address(?:\s+(\d+\.\d+\.\d+\.\d+))?$/i);
  if (!match) {
    return { success: false, error: '% Invalid command' };
  }

  if (!state.currentInterface) return { success: false, error: '% No interface selected' };

  const newPorts = { ...state.ports };
  const port = newPorts[state.currentInterface] || {};
  newPorts[state.currentInterface] = { ...port, helperAddresses: [] };

  return { success: true, output: 'Helper address(es) removed', newState: { ports: newPorts } };
}

/**
 * Switchport Nonegotiate - Disable DTP negotiation
 */
function cmdSwitchportNonegotiate(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const updatePort = (port: any) => ({ ...port, nonegotiate: true });

  if (state.selectedInterfaces?.length) {
    return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  }

  if (!state.currentInterface) return { success: false, error: '% No interface selected' };

  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: 'DTP negotiation disabled', newState: { ports: newPorts } };
}

/**
 * Switchport Voice VLAN - Set voice VLAN
 */
function cmdSwitchportVoiceVlan(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^switchport\s+voice\s+vlan\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid switchport voice vlan command' };
  }

  const vlanId = parseInt(match[1]);
  const updatePort = (port: any) => ({ ...port, voiceVlan: vlanId });

  if (state.selectedInterfaces?.length) {
    return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  }

  if (!state.currentInterface) return { success: false, error: '% No interface selected' };

  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: `Voice VLAN ${vlanId} configured`, newState: { ports: newPorts } };
}

/**
 * CDP Enable - Enable CDP on interface
 */
function cmdCdpEnable(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const updatePort = (port: any) => ({ ...port, cdpEnabled: true });

  if (state.selectedInterfaces?.length) {
    return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  }

  if (!state.currentInterface) return { success: false, error: '% No interface selected' };

  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: 'CDP enabled on interface', newState: { ports: newPorts } };
}

/**
 * Spanning-Tree BPDUGuard Disable
 */
function cmdSpanningTreeBpduguardDisable(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const updatePort = (port: any) => ({ ...port, bpduguard: false });

  if (state.selectedInterfaces?.length) {
    return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  }

  if (!state.currentInterface) return { success: false, error: '% No interface selected' };

  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: 'BPDU guard disabled', newState: { ports: newPorts } };
}

/**
 * Spanning-Tree Cost - Set STP path cost
 */
function cmdSpanningTreeCost(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^spanning-tree\s+cost\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid spanning-tree cost command. Use: spanning-tree cost <1-200000000>' };
  }

  const cost = parseInt(match[1]);
  const updatePort = (port: any) => ({ ...port, stpCost: cost });

  if (state.selectedInterfaces?.length) {
    return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  }

  if (!state.currentInterface) return { success: false, error: '% No interface selected' };

  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: `STP cost set to ${cost}`, newState: { ports: newPorts } };
}

/**
 * Spanning-Tree Priority - Set STP port priority
 */
function cmdSpanningTreePriority(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^spanning-tree\s+priority\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid spanning-tree priority command. Use: spanning-tree priority <0-240>' };
  }

  const priority = parseInt(match[1]);
  if (priority < 0 || priority > 240 || priority % 16 !== 0) {
    return { success: false, error: '% Priority must be a multiple of 16 between 0 and 240' };
  }

  const updatePort = (port: any) => ({ ...port, stpPriority: priority });

  if (state.selectedInterfaces?.length) {
    return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  }

  if (!state.currentInterface) return { success: false, error: '% No interface selected' };

  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: `STP port priority set to ${priority}`, newState: { ports: newPorts } };
}



/**
 * Switchport Trunk Encapsulation
 */
function cmdSwitchportTrunkEncapsulation(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const match = input.match(/^switchport\s+trunk\s+encapsulation\s+(dot1q|isl|negotiate)$/i);
  if (!match) return { success: false, error: '% Invalid encapsulation command' };
  const updatePort = (port: any) => ({ ...port, trunkEncapsulation: match[1].toLowerCase() });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: `Trunk encapsulation set to ${match[1]}`, newState: { ports: newPorts } };
}

/**
 * Encapsulation dot1Q (subinterface)
 */
function cmdEncapsulationDot1q(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const match = input.match(/^encapsulation\s+dot1[qQ]\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid encapsulation command' };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = { ...(newPorts[state.currentInterface] || {}), dot1qVlan: parseInt(match[1]) };
  return { success: true, output: `Encapsulation dot1Q VLAN ${match[1]} configured`, newState: { ports: newPorts } };
}

/**
 * Switchport Protected
 */
function cmdSwitchportProtected(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const updatePort = (port: any) => ({ ...port, protected: true });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: 'Port protected mode enabled', newState: { ports: newPorts } };
}

/**
 * Switchport Block (unicast/multicast)
 */
function cmdSwitchportBlock(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const match = input.match(/^switchport\s+block\s+(unicast|multicast)$/i);
  if (!match) return { success: false, error: '% Invalid switchport block command' };
  const updatePort = (port: any) => ({ ...port, [`block${match[1]}`]: true });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: `${match[1]} blocking enabled`, newState: { ports: newPorts } };
}

/**
 * Switchport Port-Security MAC-Address (static)
 */
function cmdSwitchportPortSecurityMacAddress(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const match = input.match(/^switchport\s+port-security\s+mac-address\s+([0-9a-fA-F.:-]+)$/i);
  if (!match) return { success: false, error: '% Invalid mac-address command' };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  const port = newPorts[state.currentInterface] || {};
  const staticMacs = [...(port.staticMacs || [])];
  if (!staticMacs.includes(match[1])) staticMacs.push(match[1]);
  newPorts[state.currentInterface] = { ...port, staticMacs };
  return { success: true, output: `Static MAC ${match[1]} configured`, newState: { ports: newPorts } };
}

/**
 * Storm-Control
 */
function cmdStormControl(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const match = input.match(/^storm-control\s+(broadcast|multicast|unicast)\s+level\s+([\d.]+)(?:\s+([\d.]+))?$/i);
  if (!match) return { success: false, error: '% Invalid storm-control command. Use: storm-control {broadcast|multicast|unicast} level <rising> [falling]' };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = { ...(newPorts[state.currentInterface] || {}), stormControl: { type: match[1], rising: match[2], falling: match[3] } };
  return { success: true, output: `Storm-control ${match[1]} level ${match[2]} configured`, newState: { ports: newPorts } };
}

/**
 * Storm-Control Action
 */
function cmdStormControlAction(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const match = input.match(/^storm-control\s+action\s+(shutdown|trap)$/i);
  if (!match) return { success: false, error: '% Invalid storm-control action command' };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = { ...(newPorts[state.currentInterface] || {}), stormControlAction: match[1] };
  return { success: true, output: `Storm-control action ${match[1]} configured`, newState: { ports: newPorts } };
}

/**
 * MLS QoS Trust
 */
function cmdMlsQosTrust(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const match = input.match(/^mls\s+qos\s+trust\s+(cos|dscp|ip-precedence)$/i);
  if (!match) return { success: false, error: '% Invalid mls qos trust command' };
  const updatePort = (port: any) => ({ ...port, qosTrust: match[1] });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: `QoS trust ${match[1]} configured`, newState: { ports: newPorts } };
}

/**
 * MLS QoS CoS
 */
function cmdMlsQosCos(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const match = input.match(/^mls\s+qos\s+cos\s+(\d)$/i);
  if (!match) return { success: false, error: '% Invalid mls qos cos command' };
  const updatePort = (port: any) => ({ ...port, qosCos: parseInt(match[1]) });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: `QoS CoS ${match[1]} configured`, newState: { ports: newPorts } };
}

/**
 * IP DHCP Snooping Trust
 */
function cmdIpDhcpSnoopingTrust(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const updatePort = (port: any) => ({ ...port, dhcpSnoopingTrust: true });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: 'DHCP snooping trust configured', newState: { ports: newPorts } };
}

/**
 * No IP DHCP Snooping Trust
 */
function cmdNoIpDhcpSnoopingTrust(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const updatePort = (port: any) => ({ ...port, dhcpSnoopingTrust: false });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: 'DHCP snooping trust removed', newState: { ports: newPorts } };
}

/**
 * IP ARP Inspection Trust
 */
function cmdIpArpInspectionTrust(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const updatePort = (port: any) => ({ ...port, arpInspectionTrust: true });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: 'ARP inspection trust configured', newState: { ports: newPorts } };
}

/**
 * No IP ARP Inspection Trust
 */
function cmdNoIpArpInspectionTrust(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const updatePort = (port: any) => ({ ...port, arpInspectionTrust: false });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: 'ARP inspection trust removed', newState: { ports: newPorts } };
}

/**
 * Bandwidth
 */
function cmdBandwidth(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const match = input.match(/^bandwidth\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid bandwidth command' };
  const updatePort = (port: any) => ({ ...port, bandwidth: parseInt(match[1]) });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: `Bandwidth set to ${match[1]} kbps`, newState: { ports: newPorts } };
}

/**
 * Keepalive
 */
function cmdKeepalive(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const match = input.match(/^keepalive(?:\s+(\d+))?$/i);
  const interval = match?.[1] ? parseInt(match[1]) : 10;
  const updatePort = (port: any) => ({ ...port, keepalive: interval });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: `Keepalive set to ${interval} seconds`, newState: { ports: newPorts } };
}

/**
 * IP Proxy-ARP (enable)
 */
function cmdIpProxyArp(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const updatePort = (port: any) => ({ ...port, proxyArp: true });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: 'Proxy ARP enabled', newState: { ports: newPorts } };
}

/**
 * IP Verify Source
 */
function cmdIpVerifySource(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const updatePort = (port: any) => ({ ...port, ipVerifySource: true });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: 'IP verify source configured', newState: { ports: newPorts } };
}

/**
 * UDLD Enable / Port
 */
function cmdUdldEnable(state: any, input: string, ctx: any): any {
  if (!isInInterfaceMode(state)) return { success: false, error: '% Invalid command at this mode' };
  const updatePort = (port: any) => ({ ...port, udld: true });
  if (state.selectedInterfaces?.length) return { success: true, newState: applyToSelectedPorts(state, updatePort) };
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = updatePort(newPorts[state.currentInterface] || {});
  return { success: true, output: 'UDLD enabled', newState: { ports: newPorts } };
}

// Register new interface handlers
Object.assign(interfaceHandlers, {
  'switchport trunk encapsulation': cmdSwitchportTrunkEncapsulation,
  'encapsulation dot1q': cmdEncapsulationDot1q,
  'switchport protected': cmdSwitchportProtected,
  'switchport block': cmdSwitchportBlock,
  'switchport port-security mac-address': cmdSwitchportPortSecurityMacAddress,
  'storm-control': cmdStormControl,
  'storm-control action': cmdStormControlAction,
  'mls qos trust': cmdMlsQosTrust,
  'mls qos cos': cmdMlsQosCos,
  'ip dhcp snooping trust': cmdIpDhcpSnoopingTrust,
  'no ip dhcp snooping trust': cmdNoIpDhcpSnoopingTrust,
  'ip arp inspection trust': cmdIpArpInspectionTrust,
  'no ip arp inspection trust': cmdNoIpArpInspectionTrust,
  'bandwidth': cmdBandwidth,
  'keepalive': cmdKeepalive,
  'ip proxy-arp': cmdIpProxyArp,
  'ip verify source': cmdIpVerifySource,
  'udld enable': cmdUdldEnable,
  'udld port': cmdUdldEnable,
});
