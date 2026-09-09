import { describe, it, expect } from 'vitest';
import { computeProtocolNeighborChanges, runNetworkEventPipeline } from '@/lib/network/forwarding/eventPipeline';
import type { SwitchState } from '@/lib/network/types';
import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import type { OspfNeighborRecord, EigrpNeighborRecord } from '@/lib/network/protocols';

describe('computeProtocolNeighborChanges (OSPF/EIGRP state-change timeline)', () => {
  const baseState = (id: string): SwitchState => ({
    hostname: id,
    macAddress: '0000.0000.0001',
    deviceType: 'router',
    currentMode: 'privileged',
    ports: {
      'gi0/0': { id: 'gi0/0', name: 'Gi0/0', status: 'connected', shutdown: false, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: '10.0.0.1', subnetMask: '255.255.255.0' },
      'gi0/1': { id: 'gi0/1', name: 'Gi0/1', status: 'connected', shutdown: false, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: '10.0.1.1', subnetMask: '255.255.255.0' },
    },
    vlans: {},
    security: { users: [], consoleLine: { login: false, transportInput: [] }, vtyLines: { login: false, transportInput: [] } },
    runningConfig: [],
    commandHistory: [],
    version: { nosVersion: '1.0', modelName: 'Mock', serialNumber: 'SN', uptime: '1d' },
    macAddressTable: [],
    arpCache: [],
    bootTime: Date.now(),
    ipRouting: true,
  } as any);

  const ospfRecord = (over: Partial<OspfNeighborRecord> = {}): OspfNeighborRecord => ({
    neighborId: '2.2.2.2',
    neighborIp: '10.0.0.2',
    interfaceId: 'gi0/0',
    areaId: '0.0.0.0',
    state: 'Full',
    priority: 1,
    deadTimer: 40,
    helloInterval: 10,
    deadInterval: 40,
    lastHelloAt: 0,
    ...over,
  });

  const eigrpRecord = (over: Partial<EigrpNeighborRecord> = {}): EigrpNeighborRecord => ({
    neighborIp: '10.0.0.2',
    interfaceId: 'gi0/0',
    asNumber: 100,
    state: 'Up',
    holdTime: 15,
    holdTimer: 15,
    kValues: [1, 0, 1, 0, 0],
    srtt: 2,
    rto: 200,
    seqNumber: 0,
    lastHelloAt: 0,
    ...over,
  });

  const withNeighbors = (
    state: SwitchState,
    ospf?: Record<string, OspfNeighborRecord>,
    eigrp?: Record<string, EigrpNeighborRecord>
  ): SwitchState => ({ ...state, ospfNeighborStates: ospf, eigrpNeighborStates: eigrp });

  it('reports a newly established OSPF adjacency (Down -> Full) as an info event', () => {
    const r1 = withNeighbors(baseState('R1'));
    const r2 = withNeighbors(baseState('R2'), { '2.2.2.2': ospfRecord({ neighborId: '2.2.2.2' }) });
    const events = computeProtocolNeighborChanges(
      new Map([['R1', r1]]),
      new Map([['R1', r2]])
    );

    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.protocol).toBe('OSPF');
    expect(ev.oldState).toBe('Down');
    expect(ev.newState).toBe('Full');
    expect(ev.level).toBe('info');
    expect(ev.message).toContain('%OSPF-5-ADJCHG');
    expect(ev.message).toContain('from DOWN to FULL');
  });

  it('reports an OSPF adjacency loss (Full -> Down) as a warning', () => {
    const r1 = withNeighbors(baseState('R1'), { '2.2.2.2': ospfRecord() });
    const r2 = withNeighbors(baseState('R1'), { '2.2.2.2': ospfRecord({ state: 'Down', deadTimer: 0 }) });
    const events = computeProtocolNeighborChanges(
      new Map([['R1', r1]]),
      new Map([['R1', r2]])
    );

    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.protocol).toBe('OSPF');
    expect(ev.oldState).toBe('Full');
    expect(ev.newState).toBe('Down');
    expect(ev.level).toBe('warning');
    expect(ev.message).toContain('from FULL to DOWN');
  });

  it('reports a removed OSPF neighbor as Down (warning)', () => {
    const r1 = withNeighbors(baseState('R1'), { '2.2.2.2': ospfRecord() });
    const r2 = withNeighbors(baseState('R1'));
    const events = computeProtocolNeighborChanges(
      new Map([['R1', r1]]),
      new Map([['R1', r2]])
    );
    expect(events).toHaveLength(1);
    expect(events[0].newState).toBe('Down');
    expect(events[0].level).toBe('warning');
  });

  it('reports an EIGRP adjacency up with DUAL format', () => {
    const r1 = withNeighbors(baseState('R1'));
    const r2 = withNeighbors(baseState('R1'), undefined, { '10.0.0.2': eigrpRecord() });
    const events = computeProtocolNeighborChanges(
      new Map([['R1', r1]]),
      new Map([['R1', r2]])
    );

    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.protocol).toBe('EIGRP');
    expect(ev.oldState).toBe('Down');
    expect(ev.newState).toBe('Up');
    expect(ev.level).toBe('info');
    expect(ev.message).toContain('%DUAL-5-NBRCHANGE');
    expect(ev.message).toContain('is up: new adjacency');
    expect(ev.message).toContain('AS 100');
  });

  it('reports an EIGRP adjacency loss (Up -> Down) as a warning', () => {
    const r1 = withNeighbors(baseState('R1'), undefined, { '10.0.0.2': eigrpRecord() });
    const r2 = withNeighbors(baseState('R1'), undefined, { '10.0.0.2': eigrpRecord({ state: 'Down', holdTimer: 0 }) });
    const events = computeProtocolNeighborChanges(
      new Map([['R1', r1]]),
      new Map([['R1', r2]])
    );

    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.protocol).toBe('EIGRP');
    expect(ev.newState).toBe('Down');
    expect(ev.level).toBe('warning');
    expect(ev.message).toContain('is down: state change');
  });

  it('reports no events when neighbor states are unchanged', () => {
    const r1 = withNeighbors(baseState('R1'), { '2.2.2.2': ospfRecord() }, { '10.0.0.2': eigrpRecord() });
    const events = computeProtocolNeighborChanges(
      new Map([['R1', r1]]),
      new Map([['R1', withNeighbors({ ...r1 }, { '2.2.2.2': ospfRecord() }, { '10.0.0.2': eigrpRecord() })]])
    );
    expect(events).toHaveLength(0);
  });

  it('emits per-device events across multiple devices in one diff', () => {
    const prev = new Map<string, SwitchState>([
      ['R1', withNeighbors(baseState('R1'))],
      ['R2', withNeighbors(baseState('R2'))],
    ]);
    const next = new Map<string, SwitchState>([
      ['R1', withNeighbors(baseState('R1'), { '2.2.2.2': ospfRecord({ neighborId: '2.2.2.2' }) })],
      ['R2', withNeighbors(baseState('R2'), { '1.1.1.1': ospfRecord({ neighborId: '1.1.1.1', neighborIp: '10.0.0.1' }) })],
    ]);
    const events = computeProtocolNeighborChanges(prev, next);

    expect(events).toHaveLength(2);
    expect(events.filter(e => e.deviceId === 'R1')).toHaveLength(1);
    expect(events.filter(e => e.deviceId === 'R2')).toHaveLength(1);
    expect(events.every(e => e.protocol === 'OSPF')).toBe(true);
  });

  it('integration: runNetworkEventPipeline surfaces OSPF adjacency establishment via protocolEvents', () => {
    const devices: CanvasDevice[] = [
      { id: 'R1', name: 'R1', type: 'router', x: 0, y: 0, ip: '10.0.0.1', macAddress: '00:11:11:11:11:11' } as any,
      { id: 'R2', name: 'R2', type: 'router', x: 100, y: 0, ip: '10.0.0.2', macAddress: '00:22:22:22:22:22' } as any,
    ];
    const connections: CanvasConnection[] = [
      { id: 'c1', sourceDeviceId: 'R1', sourcePort: 'gi0/0', targetDeviceId: 'R2', targetPort: 'gi0/0', cableType: 'straight', active: true },
    ];
    const states = new Map<string, SwitchState>([
      ['R1', { ...withNeighbors(baseState('R1'), undefined, undefined), ospfRouterId: '1.1.1.1', routingProtocol: 'ospf' } as any],
      ['R2', { ...withNeighbors(baseState('R2'), undefined, undefined), ospfRouterId: '2.2.2.2', routingProtocol: 'ospf' } as any],
    ]);

    const res = runNetworkEventPipeline(states, devices, connections, 1000);
    const ospfEvents = (res.protocolEvents || []).filter(e => e.protocol === 'OSPF');

    expect(ospfEvents.length).toBeGreaterThanOrEqual(1);
    expect(ospfEvents.every(e => e.newState === 'Full')).toBe(true);
    expect(ospfEvents[0].message).toContain('%OSPF-5-ADJCHG');
    expect(res.updatedStates.get('R1')?.ospfNeighborStates?.['2.2.2.2']?.state).toBe('Full');
  });
});