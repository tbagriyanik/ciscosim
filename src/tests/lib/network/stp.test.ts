import { describe, it, expect } from 'vitest';
import { recalculateStp, computeStpTopologyChanges } from '@/lib/network/stp';
import { SwitchState, StpVlanState } from '@/lib/network/types';
import { CanvasConnection } from '@/components/network/networkTopology.types';

describe('STP Algorithm', () => {
  const createMockSwitch = (id: string, mac: string, priority: number = 32768): SwitchState => ({
    hostname: id,
    macAddress: mac,
    switchModel: 'WS-C2960-24TT-L',
    switchLayer: 'L2',
    deviceType: 'switch',
    currentMode: 'user',
    ports: {
      'fa0/1': { id: 'fa0/1', name: 'Fa0/1', status: 'notconnect', vlan: 1, mode: 'access', duplex: 'auto', speed: '100', shutdown: false, type: 'fastethernet' },
      'fa0/2': { id: 'fa0/2', name: 'Fa0/2', status: 'notconnect', vlan: 1, mode: 'access', duplex: 'auto', speed: '100', shutdown: false, type: 'fastethernet' },
    },
    vlans: { 1: { id: 1, name: 'default', status: 'active', ports: ['fa0/1', 'fa0/2'] } },
    security: { enableSecretEncrypted: false, servicePasswordEncryption: false, users: [], consoleLine: { login: false, transportInput: [] }, vtyLines: { login: false, transportInput: [] } },
    runningConfig: [],
    commandHistory: [],
    historyIndex: -1,
    version: { nosVersion: '1.0', modelName: 'Mock', serialNumber: 'SN', uptime: '1d' },
    macAddressTable: [],
    arpCache: [],
    bootTime: Date.now(),
    ipRouting: false,
    spanningTreePriority: priority,
  });

  it('should elect the switch with the lowest priority as root', () => {
    const sw1 = createMockSwitch('SW1', '0000.0000.0001', 32768);
    const sw2 = createMockSwitch('SW2', '0000.0000.0002', 4096); // Lowest priority
    const sw3 = createMockSwitch('SW3', '0000.0000.0003', 32768);

    const deviceStates = new Map<string, SwitchState>([
      ['sw1', sw1],
      ['sw2', sw2],
      ['sw3', sw3],
    ]);

    const connections: CanvasConnection[] = [
      { id: 'c1', sourceDeviceId: 'sw1', sourcePort: 'fa0/1', targetDeviceId: 'sw2', targetPort: 'fa0/1', cableType: 'straight', active: true },
      { id: 'c2', sourceDeviceId: 'sw2', sourcePort: 'fa0/2', targetDeviceId: 'sw3', targetPort: 'fa0/1', cableType: 'straight', active: true },
      { id: 'c3', sourceDeviceId: 'sw3', sourcePort: 'fa0/2', targetDeviceId: 'sw1', targetPort: 'fa0/2', cableType: 'straight', active: true },
    ];

    const updatedStates = recalculateStp(deviceStates, connections);

    expect(updatedStates.get('sw2')?.stpState?.[1].isRoot).toBe(true);
    expect(updatedStates.get('sw1')?.stpState?.[1].isRoot).toBe(false);
    expect(updatedStates.get('sw3')?.stpState?.[1].isRoot).toBe(false);
  });

  it('should elect the switch with the lowest MAC as root when priorities are equal', () => {
    const sw1 = createMockSwitch('SW1', '0000.0000.0003');
    const sw2 = createMockSwitch('SW2', '0000.0000.0001'); // Lowest MAC
    const sw3 = createMockSwitch('SW3', '0000.0000.0002');

    const deviceStates = new Map<string, SwitchState>([
      ['sw1', sw1],
      ['sw2', sw2],
      ['sw3', sw3],
    ]);

    const connections: CanvasConnection[] = [
      { id: 'c1', sourceDeviceId: 'sw1', sourcePort: 'fa0/1', targetDeviceId: 'sw2', targetPort: 'fa0/1', cableType: 'straight', active: true },
    ];

    const updatedStates = recalculateStp(deviceStates, connections);

    expect(updatedStates.get('sw2')?.stpState?.[1].isRoot).toBe(true);
  });

  it('should block one port in a triangle topology to prevent loops', () => {
    const sw1 = createMockSwitch('SW1', '0000.0000.0001', 4096); // Root
    const sw2 = createMockSwitch('SW2', '0000.0000.0002', 32768);
    const sw3 = createMockSwitch('SW3', '0000.0000.0003', 32768);

    const deviceStates = new Map<string, SwitchState>([
      ['sw1', sw1],
      ['sw2', sw2],
      ['sw3', sw3],
    ]);

    const connections: CanvasConnection[] = [
      { id: 'c1-2', sourceDeviceId: 'sw1', sourcePort: 'fa0/1', targetDeviceId: 'sw2', targetPort: 'fa0/1', cableType: 'straight', active: true },
      { id: 'c1-3', sourceDeviceId: 'sw1', sourcePort: 'fa0/2', targetDeviceId: 'sw3', targetPort: 'fa0/1', cableType: 'straight', active: true },
      { id: 'c2-3', sourceDeviceId: 'sw2', sourcePort: 'fa0/2', targetDeviceId: 'sw3', targetPort: 'fa0/2', cableType: 'straight', active: true },
    ];

    const updatedStates = recalculateStp(deviceStates, connections);

    // SW1 is root, all ports should be designated/forwarding
    const stp1 = updatedStates.get('sw1')?.stpState?.[1];
    expect(stp1?.ports['fa0/1'].role).toBe('designated');
    expect(stp1?.ports['fa0/2'].role).toBe('designated');

    // SW2 and SW3 should have one root port each
    const stp2 = updatedStates.get('sw2')?.stpState?.[1];
    const stp3 = updatedStates.get('sw3')?.stpState?.[1];

    expect(stp2?.ports['fa0/1'].role).toBe('root');
    expect(stp3?.ports['fa0/1'].role).toBe('root');

    // The link between SW2 and SW3 should have one Designated and one Alternate (Blocking) port
    // SW2 has lower MAC than SW3, so SW2 fa0/2 should be Designated, SW3 fa0/2 should be Alternate
    expect(stp2?.ports['fa0/2'].role).toBe('designated');
    expect(stp2?.ports['fa0/2'].state).toBe('forwarding');

    expect(stp3?.ports['fa0/2'].role).toBe('alternate');
    expect(stp3?.ports['fa0/2'].state).toBe('blocking');
  });

  it('should handle port speed and path costs correctly', () => {
    const sw1 = createMockSwitch('SW1', '0000.0000.0001', 4096); // Root
    const sw2 = createMockSwitch('SW2', '0000.0000.0002', 32768);

    // Add a Gig port to sw1 and sw2
    sw1.ports['gi0/1'] = { id: 'gi0/1', name: 'Gi0/1', status: 'notconnect', vlan: 1, mode: 'access', duplex: 'auto', speed: '1000', shutdown: false, type: 'gigabitethernet' };
    sw2.ports['gi0/1'] = { id: 'gi0/1', name: 'Gi0/1', status: 'notconnect', vlan: 1, mode: 'access', duplex: 'auto', speed: '1000', shutdown: false, type: 'gigabitethernet' };

    const deviceStates = new Map<string, SwitchState>([
      ['sw1', sw1],
      ['sw2', sw2],
    ]);

    // Connect via FastEthernet (Cost 19) AND GigabitEthernet (Cost 4)
    const connections: CanvasConnection[] = [
      { id: 'c-fa', sourceDeviceId: 'sw1', sourcePort: 'fa0/1', targetDeviceId: 'sw2', targetPort: 'fa0/1', cableType: 'straight', active: true },
      { id: 'c-gi', sourceDeviceId: 'sw1', sourcePort: 'gi0/1', targetDeviceId: 'sw2', targetPort: 'gi0/1', cableType: 'straight', active: true },
    ];

    const updatedStates = recalculateStp(deviceStates, connections);
    const stp2 = updatedStates.get('sw2')?.stpState?.[1];

    // SW2 should pick Gigabit port as root port because cost is 4 vs 19
    expect(stp2?.ports['gi0/1'].role).toBe('root');
    expect(stp2?.ports['fa0/1'].role).toBe('alternate');
    expect(stp2?.rootCost).toBe(4);
  });

  it('should use sender port ID as a tie-breaker for root port selection', () => {
    const sw1 = createMockSwitch('SW1', '0000.0000.0001', 4096); // Root
    const sw2 = createMockSwitch('SW2', '0000.0000.0002', 32768);

    const deviceStates = new Map<string, SwitchState>([
      ['sw1', sw1],
      ['sw2', sw2],
    ]);

    // Two identical cost links between SW1 and SW2
    // Link 1: SW1 fa0/1 <-> SW2 fa0/1
    // Link 2: SW1 fa0/2 <-> SW2 fa0/2
    const connections: CanvasConnection[] = [
      { id: 'c1', sourceDeviceId: 'sw1', sourcePort: 'fa0/1', targetDeviceId: 'sw2', targetPort: 'fa0/1', cableType: 'straight', active: true },
      { id: 'c2', sourceDeviceId: 'sw1', sourcePort: 'fa0/2', targetDeviceId: 'sw2', targetPort: 'fa0/2', cableType: 'straight', active: true },
    ];

    const updatedStates = recalculateStp(deviceStates, connections);
    const stp2 = updatedStates.get('sw2')?.stpState?.[1];

    // SW2 should pick fa0/1 as root port because SW1's fa0/1 is lower than fa0/2
    expect(stp2?.ports['fa0/1'].role).toBe('root');
    expect(stp2?.ports['fa0/2'].role).toBe('alternate');
  });

  it('should simulate Rapid-PVST proposal/agreement on a converged link', () => {
    const sw1 = { ...createMockSwitch('SW1', '0000.0000.0001', 4096), spanningTreeMode: 'rapid-pvst' as const };
    const sw2 = { ...createMockSwitch('SW2', '0000.0000.0002'), spanningTreeMode: 'rapid-pvst' as const };
    const states = new Map<string, SwitchState>([['sw1', sw1], ['sw2', sw2]]);
    const connections: CanvasConnection[] = [{ id: 'c1', sourceDeviceId: 'sw1', sourcePort: 'fa0/1', targetDeviceId: 'sw2', targetPort: 'fa0/1', cableType: 'straight', active: true }];

    const updatedStates = recalculateStp(states, connections);

    expect(updatedStates.get('sw1')?.stpState?.[1].ports['fa0/1']).toMatchObject({ role: 'designated', proposal: true });
    expect(updatedStates.get('sw2')?.stpState?.[1].ports['fa0/1']).toMatchObject({ role: 'root', agreement: true });
  });

  it('should not use proposal/agreement for classic PVST', () => {
    const sw1 = createMockSwitch('SW1', '0000.0000.0001', 4096);
    const sw2 = createMockSwitch('SW2', '0000.0000.0002');
    const states = new Map<string, SwitchState>([['sw1', sw1], ['sw2', sw2]]);
    const connections: CanvasConnection[] = [{ id: 'c1', sourceDeviceId: 'sw1', sourcePort: 'fa0/1', targetDeviceId: 'sw2', targetPort: 'fa0/1', cableType: 'straight', active: true }];

    const updatedStates = recalculateStp(states, connections);

    expect(updatedStates.get('sw1')?.stpState?.[1].ports['fa0/1']).not.toHaveProperty('proposal');
    expect(updatedStates.get('sw2')?.stpState?.[1].ports['fa0/1']).not.toHaveProperty('agreement');
  });

  it('should never include PCs in STP calculation even if they have superior Bridge IDs', () => {
    const sw1 = createMockSwitch('sw-1', '0000.0000.0010', 32768);
    const sw2 = createMockSwitch('sw-2', '0000.0000.0020', 32768);

    // PC with very low priority (would be root if it were a switch)
    const pc1 = createMockSwitch('pc-1', '0000.0000.0001', 4096);
    pc1.deviceType = 'pc';

    const deviceStates = new Map<string, SwitchState>([
      ['sw-1', sw1],
      ['sw-2', sw2],
      ['pc-1', pc1],
    ]);

    const connections: CanvasConnection[] = [
      { id: 'c1', sourceDeviceId: 'sw-1', sourcePort: 'fa0/1', targetDeviceId: 'sw-2', targetPort: 'fa0/1', cableType: 'straight', active: true },
      { id: 'c2', sourceDeviceId: 'sw-1', sourcePort: 'fa0/2', targetDeviceId: 'pc-1', targetPort: 'eth0', cableType: 'straight', active: true },
      { id: 'c3', sourceDeviceId: 'sw-2', sourcePort: 'fa0/2', targetDeviceId: 'pc-1', targetPort: 'eth0', cableType: 'straight', active: true },
    ];

    const updatedStates = recalculateStp(deviceStates, connections);

    // SW1 should be root (between the two switches), not the PC
    expect(updatedStates.get('sw-1')?.stpState?.[1].isRoot).toBe(true);
    expect(updatedStates.get('sw-2')?.stpState?.[1].isRoot).toBe(false);
    expect(updatedStates.get('pc-1')?.stpState).toBeUndefined();

    // The port to the PC should NEVER be blocked by STP
    const stp1 = updatedStates.get('sw-1')?.stpState?.[1];
    expect(stp1?.ports['fa0/2'].role).toBe('designated');
    expect(stp1?.ports['fa0/2'].state).toBe('forwarding');

    const stp2 = updatedStates.get('sw-2')?.stpState?.[1];
    expect(stp2?.ports['fa0/2'].role).toBe('designated');
    expect(stp2?.ports['fa0/2'].state).toBe('forwarding');
  });

  it('should ignore devices with pc- prefix even if deviceType is missing', () => {
    const sw1 = createMockSwitch('sw-1', '0000.0000.0010', 32768);
    const pc1 = createMockSwitch('pc-1', '0000.0000.0001', 4096);
    // @ts-ignore - simulating missing metadata
    delete pc1.deviceType;

    const deviceStates = new Map<string, SwitchState>([
      ['sw-1', sw1],
      ['pc-1', pc1],
    ]);

    const connections: CanvasConnection[] = [
      { id: 'c1', sourceDeviceId: 'sw-1', sourcePort: 'fa0/1', targetDeviceId: 'pc-1', targetPort: 'eth0', cableType: 'straight', active: true },
    ];

    const updatedStates = recalculateStp(deviceStates, connections);

    // Should NOT treat pc-1 as a switch, so hasInterSwitchLinks should be false
    // and sw-1 should have all ports as designated
    const stp1 = updatedStates.get('sw-1')?.stpState?.[1];
    expect(stp1?.isRoot).toBe(true);
    expect(stp1?.ports['fa0/1'].role).toBe('designated');
    expect(stp1?.ports['fa0/1'].state).toBe('forwarding');
  });
});

describe('STP Topology-Change Detection', () => {
  const baseSwitch = (id: string, mac: string, priority: number = 32768): SwitchState =>
    createMockSwitchFactory(id, mac, priority);

  // createMockSwitch lives in the describe above; alias to it for reuse
  function createMockSwitchFactory(id: string, mac: string, priority: number): SwitchState {
    return {
      hostname: id,
      macAddress: mac,
      switchModel: 'WS-C2960-24TT-L',
      switchLayer: 'L2',
      deviceType: 'switch',
      currentMode: 'user',
      ports: {
        'fa0/1': { id: 'fa0/1', name: 'Fa0/1', status: 'notconnect', vlan: 1, mode: 'access', duplex: 'auto', speed: '100', shutdown: false, type: 'fastethernet' },
        'fa0/2': { id: 'fa0/2', name: 'Fa0/2', status: 'notconnect', vlan: 1, mode: 'access', duplex: 'auto', speed: '100', shutdown: false, type: 'fastethernet' },
      },
      vlans: { 1: { id: 1, name: 'default', status: 'active', ports: ['fa0/1', 'fa0/2'] } },
      security: { enableSecretEncrypted: false, servicePasswordEncryption: false, users: [], consoleLine: { login: false, transportInput: [] }, vtyLines: { login: false, transportInput: [] } },
      runningConfig: [],
      commandHistory: [],
      historyIndex: -1,
      version: { nosVersion: '1.0', modelName: 'Mock', serialNumber: 'SN', uptime: '1d' },
      macAddressTable: [],
      arpCache: [],
      bootTime: Date.now(),
      ipRouting: false,
      spanningTreePriority: priority,
    };
  }

  const vlanState = (over: Partial<StpVlanState> = {}): StpVlanState => ({
    vlanId: 1,
    bridgeId: '32768.0000.0000.0001',
    rootBridgeId: '4096.0000.0000.0001',
    isRoot: false,
    rootCost: 19,
    ports: {
      'fa0/1': { role: 'root', state: 'forwarding', cost: 19 },
      'fa0/2': { role: 'alternate', state: 'blocking', cost: 19 },
    },
    ...over,
  });

  const withStp = (state: SwitchState, v: StpVlanState): SwitchState => ({
    ...state,
    stpState: { [v.vlanId]: v },
  });

  it('reports a port blocking -> forwarding transition as a topology change', () => {
    const sw = baseSwitch('sw1', '0000.0000.0001');
    const prevState = withStp(sw, vlanState());
    const nextState = withStp(sw, vlanState({
      ports: { 'fa0/2': { role: 'designated', state: 'forwarding', cost: 19 } },
    }));

    const changes = computeStpTopologyChanges(
      new Map([['sw1', prevState]]),
      new Map([['sw1', nextState]])
    );

    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('port-state-change');
    expect(changes[0].portId).toBe('fa0/2');
    expect(changes[0].oldState).toBe('blocking');
    expect(changes[0].newState).toBe('forwarding');
    expect(changes[0].message).toContain('%STP-1-TOPOLOGYCHANGE');
    expect(changes[0].message).toContain('fa0/2 changed state from blocking to forwarding');
  });

  it('reports a root bridge change with previous and new root IDs', () => {
    const sw = baseSwitch('sw1', '0000.0000.0001');
    const prevState = withStp(sw, vlanState({ isRoot: false, rootBridgeId: '4096.0000.0000.0001' }));
    const nextState = withStp(sw, vlanState({ isRoot: true, rootBridgeId: '32768.0000.0000.0001' }));

    const changes = computeStpTopologyChanges(
      new Map([['sw1', prevState]]),
      new Map([['sw1', nextState]])
    );

    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('root-bridge-change');
    expect(changes[0].previousRootBridgeId).toBe('4096.0000.0000.0001');
    expect(changes[0].rootBridgeId).toBe('32768.0000.0000.0001');
    expect(changes[0].isRoot).toBe(true);
    expect(changes[0].message).toContain('root bridge for VLAN 1 is now 32768.0000.0000.0001 (this switch)');
    expect(changes[0].detail).toContain('Previous root: 4096.0000.0000.0001');
  });

  it('reports no changes for an identical STP state', () => {
    const sw = baseSwitch('sw1', '0000.0000.0001');
    const state = withStp(sw, vlanState());
    const changes = computeStpTopologyChanges(
      new Map([['sw1', state]]),
      new Map([['sw1', { ...state, stpState: { ...state.stpState } }]])
    );
    expect(changes).toHaveLength(0);
  });

  it('skips devices that had no prior STP state (first calculation)', () => {
    const sw = baseSwitch('sw1', '0000.0000.0001');
    const prevState: SwitchState = { ...sw, stpState: undefined };
    const nextState = withStp(sw, vlanState());
    const changes = computeStpTopologyChanges(
      new Map([['sw1', prevState]]),
      new Map([['sw1', nextState]])
    );
    expect(changes).toHaveLength(0);
  });

  it('emits changes for multiple devices/VLANs in one diff', () => {
    const sw1 = baseSwitch('sw1', '0000.0000.0001');
    const sw2 = baseSwitch('sw2', '0000.0000.0002');
    const prevMap = new Map<string, SwitchState>([
      ['sw1', withStp(sw1, vlanState())],
      ['sw2', withStp(sw2, vlanState())],
    ]);
    const nextMap = new Map<string, SwitchState>([
      ['sw1', withStp(sw1, vlanState({
        ports: { 'fa0/2': { role: 'designated', state: 'forwarding', cost: 19 } },
      }))],
      ['sw2', withStp(sw2, vlanState({ isRoot: true, rootBridgeId: '32768.0000.0000.0002' }))],
    ]);

    const changes = computeStpTopologyChanges(prevMap, nextMap);
    expect(changes.length).toBe(2);
    expect(changes.find(c => c.deviceId === 'sw1')?.type).toBe('port-state-change');
    expect(changes.find(c => c.deviceId === 'sw2')?.type).toBe('root-bridge-change');
    expect(changes.every(c => c.vlanId === 1)).toBe(true);
  });
});
