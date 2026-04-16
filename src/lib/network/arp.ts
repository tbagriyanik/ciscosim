// ARP (Address Resolution Protocol) Simulation
import { SwitchState } from './types';

export interface ArpEntry {
  ip: string;
  mac: string;
  interface: string;
  timestamp: number;
}

const ARP_TIMEOUT = 14400000; // 4 hours in milliseconds 

/**
 * Get MAC address for an IP from ARP cache
 */
export function getMacFromArpCache(
  deviceId: string,
  targetIp: string,
  deviceStates: Map<string, SwitchState>
): string | null {
  const state = deviceStates.get(deviceId);
  if (!state || !state.arpCache) return null;

  // Clean expired entries
  cleanExpiredArpEntries(state);

  const entry = state.arpCache.find(e => e.ip === targetIp);
  return entry ? entry.mac : null;
}

/**
 * Add or update ARP entry
 */
export function updateArpCache(
  deviceId: string,
  ip: string,
  mac: string,
  interfaceName: string,
  deviceStates: Map<string, SwitchState>
): void {
  const state = deviceStates.get(deviceId);
  if (!state) return;

  if (!state.arpCache) {
    state.arpCache = [];
  }

  // Remove existing entry for this IP if exists
  state.arpCache = state.arpCache.filter(e => e.ip !== ip);

  // Add new entry
  state.arpCache.push({
    ip,
    mac,
    interface: interfaceName,
    timestamp: Date.now()
  });
}

/**
 * Remove expired ARP entries (older than ARP_TIMEOUT)
 */
export function cleanExpiredArpEntries(state: SwitchState): void {
  if (!state.arpCache) return;

  const now = Date.now();
  state.arpCache = state.arpCache.filter(entry => {
    return (now - entry.timestamp) < ARP_TIMEOUT;
  });
}

/**
 * Clear entire ARP cache
 */
export function clearArpCache(deviceId: string, deviceStates: Map<string, SwitchState>): void {
  const state = deviceStates.get(deviceId);
  if (!state) return;

  state.arpCache = [];
}

/**
 * Simulate ARP request/reply process
 * Returns the MAC address if successful, null otherwise
 */
export function performArpResolution(
  sourceDeviceId: string,
  targetIp: string,
  targetDeviceId: string,
  targetMac: string,
  interfaceName: string,
  deviceStates: Map<string, SwitchState>
): string | null {
  // Check if already in cache
  const cachedMac = getMacFromArpCache(sourceDeviceId, targetIp, deviceStates);
  if (cachedMac) {
    return cachedMac;
  }

  // Simulate ARP request/reply (instant in simulation)
  // In real network, this would involve:
  // 1. Send ARP broadcast request
  // 2. Target replies with its MAC
  // 3. Cache the result

  // Add to cache
  updateArpCache(sourceDeviceId, targetIp, targetMac, interfaceName, deviceStates);

  return targetMac;
}

/**
 * Get ARP cache for display (show arp command)
 */
export function getArpCacheForDisplay(
  deviceId: string,
  deviceStates: Map<string, SwitchState>
): ArpEntry[] {
  const state = deviceStates.get(deviceId);
  if (!state || !state.arpCache) return [];

  // Clean expired entries before display
  cleanExpiredArpEntries(state);

  return state.arpCache;
}

/**
 * Remove specific ARP entry
 */
export function removeArpEntry(
  deviceId: string,
  ip: string,
  deviceStates: Map<string, SwitchState>
): void {
  const state = deviceStates.get(deviceId);
  if (!state || !state.arpCache) return;

  state.arpCache = state.arpCache.filter(e => e.ip !== ip);
}
