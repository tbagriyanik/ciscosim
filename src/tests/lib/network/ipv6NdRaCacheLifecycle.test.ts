import { describe, it, expect } from 'vitest';

export type NdCacheState = 'INCOMPLETE' | 'REACHABLE' | 'STALE' | 'DELAY' | 'PROBE';

export interface NdCacheEntry {
  ipv6Address: string;
  macAddress?: string;
  interfaceId: string;
  state: NdCacheState;
  updatedAtMs: number;
  reachableTimeMs: number; // default 30,000ms (30s)
  retransTimerMs: number;  // default 1,000ms
  probeCount: number;
}

export class Ipv6NdEngine {
  private cache: Map<string, NdCacheEntry> = new Map();

  public handleSolicitation(ipv6Addr: string, interfaceId: string, now: number): NdCacheEntry {
    let entry = this.cache.get(ipv6Addr);
    if (!entry) {
      entry = {
        ipv6Address: ipv6Addr,
        interfaceId,
        state: 'INCOMPLETE',
        updatedAtMs: now,
        reachableTimeMs: 30000,
        retransTimerMs: 1000,
        probeCount: 0,
      };
      this.cache.set(ipv6Addr, entry);
    }
    return entry;
  }

  public handleAdvertisement(ipv6Addr: string, macAddr: string, now: number): NdCacheEntry {
    let entry = this.cache.get(ipv6Addr);
    if (!entry) {
      entry = {
        ipv6Address: ipv6Addr,
        macAddress: macAddr,
        interfaceId: 'gi0/0',
        state: 'REACHABLE',
        updatedAtMs: now,
        reachableTimeMs: 30000,
        retransTimerMs: 1000,
        probeCount: 0,
      };
    } else {
      entry.macAddress = macAddr;
      entry.state = 'REACHABLE';
      entry.updatedAtMs = now;
      entry.probeCount = 0;
    }
    this.cache.set(ipv6Addr, entry);
    return entry;
  }

  public tick(now: number): void {
    for (const [ip, entry] of this.cache.entries()) {
      const elapsed = now - entry.updatedAtMs;

      switch (entry.state) {
        case 'REACHABLE':
          if (elapsed >= entry.reachableTimeMs) {
            entry.state = 'STALE';
            entry.updatedAtMs = now;
          }
          break;

        case 'STALE':
          // Sent packet while stale -> transition to DELAY
          break;

        case 'DELAY':
          if (elapsed >= 5000) { // 5s delay timer
            entry.state = 'PROBE';
            entry.updatedAtMs = now;
            entry.probeCount = 1;
          }
          break;

        case 'PROBE':
          if (elapsed >= entry.retransTimerMs) {
            if (entry.probeCount >= 3) {
              this.cache.delete(ip);
            } else {
              entry.probeCount++;
              entry.updatedAtMs = now;
            }
          }
          break;
      }
    }
  }

  public touchEntry(ipv6Addr: string, now: number): void {
    const entry = this.cache.get(ipv6Addr);
    if (entry && entry.state === 'STALE') {
      entry.state = 'DELAY';
      entry.updatedAtMs = now;
    }
  }

  public getEntry(ipv6Addr: string): NdCacheEntry | undefined {
    return this.cache.get(ipv6Addr);
  }

  public get CacheSize(): number {
    return this.cache.size;
  }
}

describe('Feature 8: IPv6 ND/RA/Neighbor Cache Lifecycle', () => {
  it('creates INCOMPLETE entry on Neighbor Solicitation', () => {
    const nd = new Ipv6NdEngine();
    const entry = nd.handleSolicitation('2001:db8::2', 'gi0/0', 1000);

    expect(entry.state).toBe('INCOMPLETE');
    expect(entry.macAddress).toBeUndefined();
    expect(nd.CacheSize).toBe(1);
  });

  it('updates entry to REACHABLE on Neighbor Advertisement', () => {
    const nd = new Ipv6NdEngine();
    nd.handleSolicitation('2001:db8::2', 'gi0/0', 1000);

    const updated = nd.handleAdvertisement('2001:db8::2', '0011.2233.4455', 1200);
    expect(updated.state).toBe('REACHABLE');
    expect(updated.macAddress).toBe('0011.2233.4455');
  });

  it('transitions REACHABLE → STALE when reachable timer expires', () => {
    const nd = new Ipv6NdEngine();
    nd.handleAdvertisement('2001:db8::2', '0011.2233.4455', 1000);

    nd.tick(1000 + 30001); // > 30s
    const entry = nd.getEntry('2001:db8::2');
    expect(entry?.state).toBe('STALE');
  });

  it('transitions STALE → DELAY → PROBE → deleted upon failed probes', () => {
    const nd = new Ipv6NdEngine();
    nd.handleAdvertisement('2001:db8::2', '0011.2233.4455', 1000);
    nd.tick(1000 + 30001); // now STALE

    nd.touchEntry('2001:db8::2', 32000); // Send traffic -> DELAY
    expect(nd.getEntry('2001:db8::2')?.state).toBe('DELAY');

    nd.tick(32000 + 5001); // 5s -> PROBE
    expect(nd.getEntry('2001:db8::2')?.state).toBe('PROBE');

    // 3 failed probes
    nd.tick(37001 + 1001);
    nd.tick(38002 + 1001);
    nd.tick(39003 + 1001);

    expect(nd.getEntry('2001:db8::2')).toBeUndefined();
    expect(nd.CacheSize).toBe(0);
  });
});
