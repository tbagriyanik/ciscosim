import { describe, it, expect } from 'vitest';

interface NatTranslationEntry {
  protocol: 'tcp' | 'udp' | 'icmp';
  insideLocalIp: string;
  insideLocalPort: number;
  insideGlobalIp: string;
  insideGlobalPort: number;
  outsideLocalIp: string;
  outsideLocalPort: number;
  outsideGlobalIp: string;
  outsideGlobalPort: number;
  lastUsed: number;
  timeout: number; // in milliseconds
  isDynamic: boolean;
}

class NatPatTableEngine {
  private translations: NatTranslationEntry[] = [];
  public tcpTimeoutMs: number = 86400000; // 24h default
  public udpTimeoutMs: number = 300000;   // 5 min default

  public addStaticTranslation(insideLocal: string, insideGlobal: string): void {
    this.translations.push({
      protocol: 'tcp',
      insideLocalIp: insideLocal,
      insideLocalPort: 0,
      insideGlobalIp: insideGlobal,
      insideGlobalPort: 0,
      outsideLocalIp: '*',
      outsideLocalPort: 0,
      outsideGlobalIp: '*',
      outsideGlobalPort: 0,
      lastUsed: Date.now(),
      timeout: Infinity,
      isDynamic: false,
    });
  }

  public allocatePatTranslation(
    protocol: 'tcp' | 'udp' | 'icmp',
    insideLocalIp: string,
    insideLocalPort: number,
    insideGlobalIp: string,
    outsideGlobalIp: string,
    outsideGlobalPort: number,
    now: number
  ): NatTranslationEntry {
    const existing = this.translations.find(
      t =>
        t.protocol === protocol &&
        t.insideLocalIp === insideLocalIp &&
        t.insideLocalPort === insideLocalPort &&
        t.outsideGlobalIp === outsideGlobalIp &&
        t.outsideGlobalPort === outsideGlobalPort
    );

    if (existing) {
      existing.lastUsed = now;
      return existing;
    }

    const usedPorts = new Set(
      this.translations
        .filter(t => t.insideGlobalIp === insideGlobalIp && t.protocol === protocol)
        .map(t => t.insideGlobalPort)
    );

    let allocatedPort = 1024;
    while (usedPorts.has(allocatedPort)) {
      allocatedPort++;
    }

    const timeout = protocol === 'tcp' ? this.tcpTimeoutMs : this.udpTimeoutMs;

    const entry: NatTranslationEntry = {
      protocol,
      insideLocalIp,
      insideLocalPort,
      insideGlobalIp,
      insideGlobalPort: allocatedPort,
      outsideLocalIp: outsideGlobalIp,
      outsideLocalPort: outsideGlobalPort,
      outsideGlobalIp,
      outsideGlobalPort,
      lastUsed: now,
      timeout,
      isDynamic: true,
    };

    this.translations.push(entry);
    return entry;
  }

  public ageTranslations(now: number): number {
    const initialCount = this.translations.length;
    this.translations = this.translations.filter(entry => {
      if (!entry.isDynamic || entry.timeout === Infinity) return true;
      return now - entry.lastUsed < entry.timeout;
    });
    return initialCount - this.translations.length;
  }

  public get ActiveCount(): number {
    return this.translations.length;
  }

  public get Entries(): readonly NatTranslationEntry[] {
    return this.translations;
  }
}

describe('Feature 6: NAT/PAT Session Aging + Timeout Lifecycle', () => {
  it('allocates PAT port translations dynamically for unique inside local sockets', () => {
    const engine = new NatPatTableEngine();
    const now = Date.now();

    const t1 = engine.allocatePatTranslation('tcp', '192.168.1.10', 50000, '203.0.113.1', '8.8.8.8', 80, now);
    const t2 = engine.allocatePatTranslation('tcp', '192.168.1.11', 50000, '203.0.113.1', '8.8.8.8', 80, now);

    expect(t1.insideGlobalPort).toBe(1024);
    expect(t2.insideGlobalPort).toBe(1025);
    expect(engine.ActiveCount).toBe(2);
  });

  it('updates lastUsed timestamp when matching existing PAT session', () => {
    const engine = new NatPatTableEngine();
    const t1 = Date.now();
    const t2 = t1 + 1000;

    engine.allocatePatTranslation('udp', '192.168.1.10', 5353, '203.0.113.1', '1.1.1.1', 53, t1);
    const updated = engine.allocatePatTranslation('udp', '192.168.1.10', 5353, '203.0.113.1', '1.1.1.1', 53, t2);

    expect(updated.lastUsed).toBe(t2);
    expect(engine.ActiveCount).toBe(1);
  });

  it('ages out expired UDP session entries while keeping active sessions', () => {
    const engine = new NatPatTableEngine();
    engine.udpTimeoutMs = 60000; // 60s
    const startTime = 100000;

    engine.allocatePatTranslation('udp', '192.168.1.10', 5000, '203.0.113.1', '8.8.8.8', 53, startTime);
    engine.allocatePatTranslation('udp', '192.168.1.20', 5000, '203.0.113.1', '8.8.8.8', 53, startTime + 40000);

    // At startTime + 70000 (70s after entry 1, 30s after entry 2)
    const removedCount = engine.ageTranslations(startTime + 70000);

    expect(removedCount).toBe(1);
    expect(engine.ActiveCount).toBe(1);
    expect(engine.Entries[0].insideLocalIp).toBe('192.168.1.20');
  });

  it('preserves static NAT mappings during aging ticks', () => {
    const engine = new NatPatTableEngine();
    engine.addStaticTranslation('192.168.1.100', '203.0.113.100');

    const removedCount = engine.ageTranslations(Date.now() + 999999999);
    expect(removedCount).toBe(0);
    expect(engine.ActiveCount).toBe(1);
  });
});
