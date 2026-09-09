/**
 * agingEngine.ts — Real-time ARP and MAC Aging Engine
 *
 * Runs background aging checks to prune expired ARP cache entries and dynamic MAC entries.
 */

import { SwitchState } from './types';
import { cleanExpiredMacEntries, MacLifecycleEvent } from './macLearning';
import { cleanExpiredArpEntries } from './arp';

export interface AgingArpEvent {
  deviceId: string;
  ip: string;
  mac: string;
  interface: string;
}

export interface AgingResult {
  agedMacCount: number;
  agedArpCount: number;
  agedNatCount: number;
  events: MacLifecycleEvent[];
  arpEvents: AgingArpEvent[];
}

const NAT_SESSION_TIMEOUT = 300000; // 5 minutes in ms

/**
 * Execute real-time aging tick across all device states.
 */
export function runAgingTick(deviceStates: Map<string, SwitchState>): AgingResult {
  let agedMacCount = 0;
  let agedArpCount = 0;
  let agedNatCount = 0;
  const events: MacLifecycleEvent[] = [];
  const arpEvents: AgingArpEvent[] = [];

  for (const [deviceId, state] of deviceStates.entries()) {
    if (!state) continue;

    // MAC aging
    if (state.macAddressTable && state.macAddressTable.length > 0) {
      const prevCount = state.macAddressTable.length;
      const macEvents = cleanExpiredMacEntries(state, deviceId);
      const afterCount = state.macAddressTable.length;
      const removed = prevCount - afterCount;
      if (removed > 0) {
        agedMacCount += removed;
        events.push(...macEvents);
      }
    }

    // ARP aging
    if (state.arpCache && state.arpCache.length > 0) {
      const expiredArp = cleanExpiredArpEntries(state);
      if (expiredArp.length > 0) {
        agedArpCount += expiredArp.length;
        arpEvents.push(...expiredArp.map(e => ({ deviceId, ip: e.ip, mac: e.mac, interface: e.interface })));
      }
    }

    // NAT translation session aging
    if (state.natTranslations && state.natTranslations.length > 0) {
      const now = Date.now();
      const initialNatCount = state.natTranslations.length;
      state.natTranslations = state.natTranslations.filter(t => {
        // Entries without an explicit timestamp are never aged (they carry no
        // session clock); only timestamped dynamic sessions expire.
        const entryTime = (t as { timestamp?: number }).timestamp;
        if (entryTime == null) return true;
        return (now - entryTime) < NAT_SESSION_TIMEOUT;
      });
      const removedNat = initialNatCount - state.natTranslations.length;
      if (removedNat > 0) {
        agedNatCount += removedNat;
      }
    }
  }

  return { agedMacCount, agedArpCount, agedNatCount, events, arpEvents };
}
