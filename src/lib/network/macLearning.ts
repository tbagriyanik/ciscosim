// MAC Address Learning Simulation
import { SwitchState } from './types';

export interface MacTableEntry {
  mac: string;
  vlan: number;
  port: string;
  type: string; // Changed to string for compatibility with existing type
  timestamp?: number;
}

const MAC_AGING_TIME = 300000; // 5 minutes in milliseconds 

/**
 * Learn MAC address on a switch port
 * Called when a frame is received on a port
 */
export function learnMacAddress(
  deviceId: string,
  mac: string,
  portId: string,
  vlan: number,
  deviceStates: Map<string, SwitchState>,
  type: string = 'DYNAMIC'
): void {
  const state = deviceStates.get(deviceId);
  if (!state) return;

  if (!state.macAddressTable) {
    state.macAddressTable = [];
  }

  // Check if MAC already exists in table
  const existingIndex = state.macAddressTable.findIndex(
    entry => entry.mac.toLowerCase() === mac.toLowerCase() && entry.vlan === vlan
  );

  if (existingIndex !== -1) {
    // Update existing entry (move to new port if changed, refresh timestamp)
    state.macAddressTable[existingIndex] = {
      mac,
      vlan,
      port: portId,
      type,
      timestamp: Date.now()
    };
  } else {
    // Add new entry
    state.macAddressTable.push({
      mac,
      vlan,
      port: portId,
      type,
      timestamp: Date.now()
    });
  }
}

/**
 * Clean expired MAC entries (older than MAC_AGING_TIME)
 * Only affects dynamic entries, static entries are permanent
 */
export function cleanExpiredMacEntries(state: SwitchState): void {
  if (!state.macAddressTable) return;

  const now = Date.now();
  state.macAddressTable = state.macAddressTable.filter(entry => {
    // Static entries never expire
    if (entry.type === 'STATIC') return true;
    // Dynamic entries expire after aging time (only if timestamp exists)
    if (!entry.timestamp) return true; // Keep entries without timestamp (backward compatibility)
    return (now - entry.timestamp) < MAC_AGING_TIME;
  });
}

/**
 * Find which port a MAC address is learned on
 */
export function findMacPort(
  deviceId: string,
  mac: string,
  vlan: number,
  deviceStates: Map<string, SwitchState>
): string | null {
  const state = deviceStates.get(deviceId);
  if (!state || !state.macAddressTable) return null;

  // Clean expired entries first
  cleanExpiredMacEntries(state);

  const entry = state.macAddressTable.find(
    e => e.mac.toLowerCase() === mac.toLowerCase() && e.vlan === vlan
  );

  return entry ? entry.port : null;
}

/**
 * Clear MAC address table
 */
export function clearMacTable(deviceId: string, deviceStates: Map<string, SwitchState>): void {
  const state = deviceStates.get(deviceId);
  if (!state) return;

  state.macAddressTable = [];
}

/**
 * Clear dynamic MAC entries only (keep static entries)
 */
export function clearDynamicMacEntries(deviceId: string, deviceStates: Map<string, SwitchState>): void {
  const state = deviceStates.get(deviceId);
  if (!state || !state.macAddressTable) return;

  state.macAddressTable = state.macAddressTable.filter(entry => entry.type === 'STATIC');
}

/**
 * Add static MAC address entry
 */
export function addStaticMacEntry(
  deviceId: string,
  mac: string,
  portId: string,
  vlan: number,
  deviceStates: Map<string, SwitchState>
): void {
  learnMacAddress(deviceId, mac, portId, vlan, deviceStates, 'STATIC');
}

/**
 * Remove specific MAC entry
 */
export function removeMacEntry(
  deviceId: string,
  mac: string,
  vlan: number,
  deviceStates: Map<string, SwitchState>
): void {
  const state = deviceStates.get(deviceId);
  if (!state || !state.macAddressTable) return;

  state.macAddressTable = state.macAddressTable.filter(
    entry => !(entry.mac.toLowerCase() === mac.toLowerCase() && entry.vlan === vlan)
  );
}

/**
 * Get MAC address table for display
 */
export function getMacTableForDisplay(
  deviceId: string,
  deviceStates: Map<string, SwitchState>
): MacTableEntry[] {
  const state = deviceStates.get(deviceId);
  if (!state || !state.macAddressTable) return [];

  // Clean expired entries before display
  cleanExpiredMacEntries(state);

  return state.macAddressTable;
}

/**
 * Simulate MAC learning when a device sends a frame
 * This should be called when:
 * - A device sends a packet (learn source MAC)
 * - A device receives a packet on a port (learn source MAC from incoming frame)
 */
export function processFrameMacLearning(
  switchDeviceId: string,
  sourceMac: string,
  ingressPort: string,
  vlan: number,
  deviceStates: Map<string, SwitchState>
): void {
  // Learn the source MAC address on the ingress port
  learnMacAddress(switchDeviceId, sourceMac, ingressPort, vlan, deviceStates, 'DYNAMIC');
}
