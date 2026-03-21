import type { CommandHandler } from './commandTypes';
import { normalizePortId } from '../initialState';

// Interface-level komutlar (interface, shutdown, speed, duplex, switchport, ip address, vs.)

export const interfaceHandlers: Record<string, CommandHandler> = {
  'interface': cmdInterface,
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
  'spanning-tree portfast': cmdSpanningTreePortfast,
  'spanning-tree bpduguard enable': cmdSpanningTreeBpduguard,
  'ip address': cmdIpAddress,
  'no ip address': cmdNoIpAddress,
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
        currentMode: 'interface',
        currentInterface: selectedInterfaces[0],
        selectedInterfaces
      }
    };
  }

  // Validate interface exists
  const normalized = normalizePortId(interfaceName) || interfaceName.toLowerCase();
  if (!state.ports || !state.ports[normalized]) {
    return { success: false, error: `% Interface ${interfaceName} does not exist` };
  }

  return {
    success: true,
    newState: {
      currentMode: 'interface',
      currentInterface: normalized,
      selectedInterfaces: [normalized]
    }
  };
}

/**
 * Shutdown - Administratively disable interface
 */
function cmdShutdown(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'interface' || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
 * Switchport Mode Access
 */
function cmdSwitchportModeAccess(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^switchport\s+access\s+vlan\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid VLAN ID' };
  }

  const vlanId = match[1];
  const newPorts = applyToSelectedPorts(state, (port: any) => ({
    ...port,
    accessVlan: vlanId,
    vlan: Number(vlanId),
    mode: 'access',
  }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * Switchport Trunk Native VLAN
 */
function cmdSwitchportTrunkNativeVlan(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
  if (state.currentMode !== 'interface' || !state.currentInterface) {
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
 * IP Address - Assign IP to routed port
 */
function cmdIpAddress(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'interface' || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const match = input.match(/^ip\s+address\s+([0-9.]+)\s+([0-9.]+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid input: ip address <ip> <mask>' };
  }

  const [, ip, mask] = match;
  if (!isValidIP(ip) || !isValidIP(mask)) {
    return { success: false, error: '% Invalid IP address format' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, ipAddress: ip, subnetMask: mask, mode: 'routed' }));

  return {
    success: true,
    newState: { ports: newPorts }
  };
}

/**
 * No IP Address - Remove IP from interface
 */
function cmdNoIpAddress(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'interface' || !state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }

  const newPorts = applyToSelectedPorts(state, (port: any) => ({ ...port, ipAddress: undefined, subnetMask: undefined, mode: 'access' }));

  return {
    success: true,
    newState: { ports: newPorts }
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

function expandInterfaceRange(rangeSpec: string, state: any): string[] {
  const normalized = rangeSpec.replace(/\s+/g, '').toLowerCase();
  const match = normalized.match(/^(fa|fastethernet|gi|gig|gigabit|gigabitethernet)(\d+)\/(\d+)(?:-(\d+))?$/);
  if (!match) return [];

  const prefix = match[1].startsWith('f') ? 'fa' : 'gi';
  const moduleNum = match[2];
  const startPort = parseInt(match[3], 10);
  const endPort = match[4] ? parseInt(match[4], 10) : startPort;
  if (Number.isNaN(startPort) || Number.isNaN(endPort) || endPort < startPort) return [];

  const available = Object.keys(state.ports || {});
  const ports: string[] = [];
  for (let port = startPort; port <= endPort; port++) {
    const normalizedId = `${prefix}${moduleNum}/${port}`;
    if (available.includes(normalizedId)) ports.push(normalizedId);
  }
  return ports;
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
