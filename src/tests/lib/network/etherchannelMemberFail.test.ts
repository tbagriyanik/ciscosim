import { describe, it, expect } from 'vitest';
import { detectEtherChannelBundles, computeEtherChannelChanges } from '@/lib/network/etherchannel';
import { CanvasConnection } from '@/components/network/networkTopology.types';
import { SwitchState, Port, SwitchModel, SwitchLayer, SecurityConfig, Vlan, CableType } from '@/lib/network/types';

const createMockSwitchState = (ports: Record<string, Partial<Port>>, overrides: Partial<SwitchState> = {}): SwitchState => {
  const baseState: SwitchState = {
    hostname: 'sw',
    macAddress: '00:00:00:00:00:00',
    switchModel: 'WS-C2960-24TT-L' as SwitchModel,
    switchLayer: 'L2' as SwitchLayer,
    currentMode: 'privileged',
    commandHistory: [],
    ports: Object.fromEntries(
      Object.entries(ports).map(([id, config]) => [
        id,
        {
          id,
          name: id,
          status: 'connected',
          ...config,
        } as Port,
      ])
    ),
    vlans: {} as Record<string, Vlan>,
    security: {} as SecurityConfig,
    runningConfig: [],
    historyIndex: 0,
    bootTime: Date.now(),
    ipRouting: false,
    macAddressTable: [],
    arpCache: [],
    version: { nosVersion: '', modelName: '', serialNumber: '', uptime: '' },
    ...overrides,
  };
  return baseState;
};

const createMockConnection = (
  id: string,
  srcDev: string,
  srcPort: string,
  tgtDev: string,
  tgtPort: string,
  active = true
): CanvasConnection => ({
  id,
  sourceDeviceId: srcDev,
  sourcePort: srcPort,
  targetDeviceId: tgtDev,
  targetPort: tgtPort,
  cableType: 'straight' as CableType,
  active,
});

const activePair = () => {
  const sw1 = createMockSwitchState({
    'Fa0/1': { channelGroup: 1, channelMode: 'active' },
    'Fa0/2': { channelGroup: 1, channelMode: 'active' },
  });
  const sw2 = createMockSwitchState({
    'Fa0/1': { channelGroup: 1, channelMode: 'active' },
    'Fa0/2': { channelGroup: 1, channelMode: 'active' },
  });
  const deviceStates = new Map<string, SwitchState>([
    ['sw1', sw1],
    ['sw2', sw2],
  ]);
  const connections = [
    createMockConnection('c1', 'sw1', 'Fa0/1', 'sw2', 'Fa0/1'),
    createMockConnection('c2', 'sw1', 'Fa0/2', 'sw2', 'Fa0/2'),
  ];
  return { sw1, sw2, deviceStates, connections };
};

describe('EtherChannel member fail / recovery (detection)', () => {
  it('persists the bundle when a member cable is powered off, flagging the dead member', () => {
    const { deviceStates, connections } = activePair();
    connections[1].active = false;

    const bundles = detectEtherChannelBundles(connections, deviceStates);
    expect(bundles).toHaveLength(1);
    const bundle = bundles[0];
    expect(bundle.bundled).toBe(true);
    expect(bundle.upMemberCount).toBe(1);
    expect(bundle.downMemberCount).toBe(1);
    expect(bundle.members.map(m => [m.sourcePort, m.up])).toEqual([
      ['Fa0/1', true],
      ['Fa0/2', false],
    ]);
    expect(bundle.memberConnections.map(c => c.id)).toEqual(['c1']);
  });

  it('drops the bundle entirely when all member cables are powered off', () => {
    const { deviceStates, connections } = activePair();
    connections[0].active = false;
    connections[1].active = false;

    const bundles = detectEtherChannelBundles(connections, deviceStates);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].bundled).toBe(false);
    expect(bundles[0].reason).toContain('No member links are up');
  });

  it('flags a member as down when its port is shut down on either switch', () => {
    const { sw1, deviceStates, connections } = activePair();
    sw1.ports['Fa0/2'] = { ...sw1.ports['Fa0/2'], shutdown: true };

    const bundles = detectEtherChannelBundles(connections, deviceStates);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].bundled).toBe(true);
    expect(bundles[0].upMemberCount).toBe(1);
    expect(bundles[0].downMemberCount).toBe(1);
    expect(bundles[0].memberConnections.map(c => c.id)).toEqual(['c1']);
  });

  it('does not invent a bundle for a single fresh link (config threshold unchanged)', () => {
    const sw1 = createMockSwitchState({ 'Fa0/1': { channelGroup: 1, channelMode: 'active' } });
    const sw2 = createMockSwitchState({ 'Fa0/1': { channelGroup: 1, channelMode: 'active' } });
    const connections = [createMockConnection('c1', 'sw1', 'Fa0/1', 'sw2', 'Fa0/1')];

    const bundles = detectEtherChannelBundles(connections, new Map([['sw1', sw1], ['sw2', sw2]]));
    expect(bundles).toHaveLength(0);
  });
});

describe('EtherChannel change timeline (diff)', () => {
  it('emits member-left (warning) for the dead member when the bundle survives', () => {
    const { deviceStates, connections } = activePair();
    const before = detectEtherChannelBundles(connections, deviceStates);

    const afterConnections = connections.map(c => (c.id === 'c2' ? { ...c, active: false } : c));
    const after = detectEtherChannelBundles(afterConnections, deviceStates);

    const events = computeEtherChannelChanges(before, after);
    expect(events).toHaveLength(2); // one per switch
    for (const ev of events) {
      expect(ev.type).toBe('member-left');
      expect(ev.level).toBe('warning');
      expect(ev.message).toContain('Port Fa0/2 left bundle Po1');
      expect(ev.upMemberCount).toBe(1);
      expect(ev.totalMemberCount).toBe(2);
    }
    expect(new Set(events.map(e => e.deviceId))).toEqual(new Set(['sw1', 'sw2']));
  });

  it('emits member-joined (info) when the member recovers', () => {
    const { deviceStates, connections } = activePair();
    const degraded = connections.map(c => (c.id === 'c2' ? { ...c, active: false } : c));
    const before = detectEtherChannelBundles(degraded, deviceStates);

    const after = detectEtherChannelBundles(connections, deviceStates);

    const events = computeEtherChannelChanges(before, after);
    expect(events).toHaveLength(2);
    for (const ev of events) {
      expect(ev.type).toBe('member-joined');
      expect(ev.level).toBe('info');
      expect(ev.message).toContain('Port Fa0/2 joined bundle Po1');
    }
  });

  it('emits bundle-down (error) when all members go out', () => {
    const { deviceStates, connections } = activePair();
    const before = detectEtherChannelBundles(connections, deviceStates);

    const deadConnections = connections.map(c => ({ ...c, active: false }));
    const after = detectEtherChannelBundles(deadConnections, deviceStates);

    const events = computeEtherChannelChanges(before, after);
    expect(events).toHaveLength(2); // bundle-down per switch only (no per-member noise)
    for (const ev of events) {
      expect(ev.type).toBe('bundle-down');
      expect(ev.level).toBe('error');
      expect(ev.message).toContain('Bundle Po1 is down');
    }
  });

  it('emits bundle-up (info) when a bundle forms', () => {
    const { deviceStates, connections } = activePair();
    const after = detectEtherChannelBundles(connections, deviceStates);

    const events = computeEtherChannelChanges([], after);
    expect(events).toHaveLength(2);
    for (const ev of events) {
      expect(ev.type).toBe('bundle-up');
      expect(ev.level).toBe('info');
      expect(ev.message).toContain('Bundle Po1 is up');
      expect(ev.message).toContain('2 port(s) aggregated');
    }
  });

  it('emits bundle-down when a member cable is deleted (bundle collapses to one link)', () => {
    const { deviceStates, connections } = activePair();
    const before = detectEtherChannelBundles(connections, deviceStates);

    const afterConnections = connections.filter(c => c.id !== 'c2');
    const after = detectEtherChannelBundles(afterConnections, deviceStates);
    expect(after).toHaveLength(0);

    const events = computeEtherChannelChanges(before, after);
    expect(events).toHaveLength(2);
    for (const ev of events) {
      expect(ev.type).toBe('bundle-down');
      expect(ev.level).toBe('error');
    }
  });

  it('emits nothing when the bundle state is unchanged', () => {
    const { deviceStates, connections } = activePair();
    const before = detectEtherChannelBundles(connections, deviceStates);
    const after = detectEtherChannelBundles(connections, deviceStates);

    expect(computeEtherChannelChanges(before, after)).toHaveLength(0);
  });
});