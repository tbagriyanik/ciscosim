import { describe, it, expect } from 'vitest';
import { runAgingTick } from '@/lib/network/agingEngine';
import { runNetworkEventPipeline } from '@/lib/network/forwarding/eventPipeline';
import type { SwitchState } from '@/lib/network/types';
import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';

const baseSwitchState = (id: string): SwitchState => ({
  hostname: id,
  macAddress: '0000.0000.0001',
  deviceType: 'switch',
  switchModel: 'WS-C2960-24TT-L',
  switchLayer: 'L2',
  currentMode: 'privileged',
  ports: {
    'fa0/1': { id: 'fa0/1', name: 'Fa0/1', status: 'connected', shutdown: false, mode: 'access', vlan: 1, duplex: 'full', speed: '100', type: 'fastethernet' },
    'fa0/2': { id: 'fa0/2', name: 'Fa0/2', status: 'connected', shutdown: false, mode: 'access', vlan: 1, duplex: 'full', speed: '100', type: 'fastethernet' },
  },
  vlans: {},
  security: { users: [], consoleLine: { login: false, transportInput: [] }, vtyLines: { login: false, transportInput: [] } },
  runningConfig: [],
  commandHistory: [],
  version: { nosVersion: '1.0', modelName: 'Mock', serialNumber: 'SN', uptime: '1d' },
  macAddressTable: [],
  arpCache: [],
  ipRouting: false,
  bootTime: Date.now(),
} as any);

describe('ARP/MAC aging event timeline', () => {
  it('runAgingTick reports expired ARP entries with device attribution', () => {
    const stale = Date.now() - 200000; // > 120s ARP timeout
    const state = baseSwitchState('SW1');
    state.arpCache = [
      { ip: '192.168.1.2', mac: 'aabb.ccdd.0011', interface: 'Vlan1', timestamp: stale },
      { ip: '192.168.1.3', mac: 'aabb.ccdd.0022', interface: 'Vlan1', timestamp: Date.now() },
    ];
    const states = new Map<string, SwitchState>([['SW1', state]]);

    const result = runAgingTick(states);
    expect(result.agedArpCount).toBe(1);
    expect(result.arpEvents).toHaveLength(1);
    expect(result.arpEvents[0]).toMatchObject({ deviceId: 'SW1', ip: '192.168.1.2', mac: 'aabb.ccdd.0011' });
    expect(states.get('SW1')!.arpCache).toHaveLength(1);
  });

  it('runAgingTick keeps NAT entries that carry no timestamp', () => {
    const state = baseSwitchState('SW1');
    state.natTranslations = [{ protocol: 'tcp', localIp: '10.0.0.1', localPort: 1234, globalIp: '203.0.113.1', globalPort: 1024 }];
    const states = new Map<string, SwitchState>([['SW1', state]]);

    const result = runAgingTick(states);
    expect(result.agedNatCount).toBe(0);
    expect(states.get('SW1')!.natTranslations).toHaveLength(1);
  });

  it('integration: pipeline emits [MAC AGE] + %ARP-6-AGE events and prunes entries', () => {
    const staleMac = Date.now() - 400000; // > 300s MAC aging
    const staleArp = Date.now() - 200000; // > 120s ARP timeout
    const state = baseSwitchState('SW1');
    state.macAddressTable = [
      { mac: 'aabb.ccdd.0011', vlan: 1, port: 'fa0/1', type: 'DYNAMIC', timestamp: staleMac },
      { mac: 'aabb.ccdd.0022', vlan: 1, port: 'fa0/2', type: 'DYNAMIC', timestamp: Date.now() },
    ];
    state.arpCache = [
      { ip: '192.168.1.2', mac: 'aabb.ccdd.0011', interface: 'Vlan1', timestamp: staleArp },
      { ip: '192.168.1.3', mac: 'aabb.ccdd.0022', interface: 'Vlan1', timestamp: Date.now() },
    ];
    const states = new Map<string, SwitchState>([['SW1', state]]);
    const devices: CanvasDevice[] = [
      { id: 'SW1', name: 'SW1', type: 'switchL2', x: 0, y: 0, ip: '192.168.1.1', macAddress: '00:00:00:00:00:01' } as any,
    ];
    const connections: CanvasConnection[] = [];

    const res = runNetworkEventPipeline(states, devices, connections, 1000);
    const aging = res.agingEvents || [];

    const macAges = aging.filter(e => e.category === 'MAC');
    const arpAges = aging.filter(e => e.category === 'ARP');
    expect(macAges).toHaveLength(1);
    expect(macAges[0]).toMatchObject({ deviceId: 'SW1', category: 'MAC', level: 'info' });
    expect(macAges[0].message).toContain('[MAC AGE]');
    expect(macAges[0].message).toContain('aabb.ccdd.0011');

    expect(arpAges).toHaveLength(1);
    expect(arpAges[0]).toMatchObject({ deviceId: 'SW1', category: 'ARP', level: 'info' });
    expect(arpAges[0].message).toContain('%ARP-6-AGE');
    expect(arpAges[0].message).toContain('192.168.1.2');

    const updated = res.updatedStates.get('SW1')!;
    expect(updated.macAddressTable.map(e => e.mac)).toEqual(['aabb.ccdd.0022']);
    expect(updated.arpCache.map(e => e.ip)).toEqual(['192.168.1.3']);
  });

  it('integration: pipeline emits no aging events when all timestamps are fresh', () => {
    const state = baseSwitchState('SW1');
    state.macAddressTable = [
      { mac: 'aabb.ccdd.0011', vlan: 1, port: 'fa0/1', type: 'DYNAMIC', timestamp: Date.now() },
    ];
    state.arpCache = [
      { ip: '192.168.1.2', mac: 'aabb.ccdd.0011', interface: 'Vlan1', timestamp: Date.now() },
    ];
    const states = new Map<string, SwitchState>([['SW1', state]]);
    const devices: CanvasDevice[] = [
      { id: 'SW1', name: 'SW1', type: 'switchL2', x: 0, y: 0, ip: '192.168.1.1', macAddress: '00:00:00:00:00:01' } as any,
    ];

    const res = runNetworkEventPipeline(states, devices, [], 1000);
    expect(res.agingEvents || []).toHaveLength(0);
  });

  it('integration: agingEvents is undefined when nothing aged', () => {
    const state = baseSwitchState('SW1');
    state.macAddressTable = [
      { mac: 'aabb.ccdd.0011', vlan: 1, port: 'fa0/1', type: 'DYNAMIC', timestamp: Date.now() },
    ];
    const res = runNetworkEventPipeline(new Map([['SW1', state]]), [], [], 1000);
    expect(res.agingEvents).toBeUndefined();
  });
});