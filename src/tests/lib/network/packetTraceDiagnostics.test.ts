import { describe, it, expect, beforeEach } from 'vitest';
import { runFullPacketPipeline } from '@/lib/network/forwarding/packetPipeline';
import { generateIcmpUnreachable, getIcmpCodeDetails } from '@/lib/network/forwarding/icmpUtils';
import { findRouteDetailed, detectRoutingLoops, Route } from '@/lib/network/routing';
import { learnMacAddress, onMacLifecycleEvent, MacLifecycleEvent } from '@/lib/network/macLearning';
import { diagnoseVlanMismatches, diagnoseDuplicateAddresses } from '@/lib/network/vlanDiagnostics';
import { runAgingTick } from '@/lib/network/agingEngine';
import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import type { SwitchState } from '@/lib/network/types';

describe('Advanced Packet Forwarding & Diagnostics Engine', () => {
  let devices: CanvasDevice[];
  let connections: CanvasConnection[];
  let deviceStates: Map<string, SwitchState>;

  beforeEach(() => {
    devices = [
      { id: 'PC1', name: 'PC1', type: 'pc', x: 100, y: 100, ip: '10.0.0.2', subnetMask: '255.255.255.0', macAddress: '00:11:22:33:44:55' } as any,
      { id: 'SW1', name: 'SW1', type: 'switchL2', x: 200, y: 100 } as any,
      { id: 'R1', name: 'R1', type: 'router', x: 300, y: 100 } as any,
      { id: 'R2', name: 'R2', type: 'router', x: 400, y: 100 } as any,
      { id: 'PC2', name: 'PC2', type: 'pc', x: 500, y: 100, ip: '192.168.1.2', subnetMask: '255.255.255.0', macAddress: 'AA:BB:CC:DD:EE:FF' } as any,
    ];

    connections = [
      { id: 'c1', sourceDeviceId: 'PC1', sourcePort: 'Eth0', targetDeviceId: 'SW1', targetPort: 'Fa0/1' } as any,
      { id: 'c2', sourceDeviceId: 'SW1', sourcePort: 'Fa0/2', targetDeviceId: 'R1', targetPort: 'Gi0/0' } as any,
      { id: 'c3', sourceDeviceId: 'R1', sourcePort: 'Gi0/1', targetDeviceId: 'R2', targetPort: 'Gi0/0' } as any,
      { id: 'c4', sourceDeviceId: 'R2', sourcePort: 'Gi0/1', targetDeviceId: 'PC2', targetPort: 'Eth0' } as any,
    ];

    deviceStates = new Map<string, SwitchState>([
      [
        'PC1',
        {
          ports: {
            Eth0: { id: 'Eth0', name: 'Ethernet0', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '1000', type: 'fastethernet', ipAddress: '10.0.0.2', subnetMask: '255.255.255.0' },
          },
        } as any,
      ],
      [
        'SW1',
        {
          macAddressTable: [
            { mac: '00:11:22:33:44:55', vlan: 1, port: 'Fa0/1', type: 'DYNAMIC', timestamp: Date.now() },
            { mac: 'AA:BB:CC:DD:EE:FF', vlan: 1, port: 'Fa0/2', type: 'DYNAMIC', timestamp: Date.now() },
          ],
          ports: {
            'Fa0/1': { id: 'Fa0/1', name: 'FastEthernet0/1', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
            'Fa0/2': { id: 'Fa0/2', name: 'FastEthernet0/2', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
          },
        } as any,
      ],
      [
        'R1',
        {
          ports: {
            'Gi0/0': { id: 'Gi0/0', name: 'GigabitEthernet0/0', status: 'connected', shutdown: false, vlan: 1, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: '10.0.0.1', subnetMask: '255.255.255.0' },
            'Gi0/1': { id: 'Gi0/1', name: 'GigabitEthernet0/1', status: 'connected', shutdown: false, vlan: 1, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: '172.16.0.1', subnetMask: '255.255.255.0' },
          },
          staticRoutes: [
            { destination: '192.168.1.0', subnetMask: '255.255.255.0', nextHop: 'Gi0/1', type: 'static', metric: 1 },
          ],
        } as any,
      ],
      [
        'R2',
        {
          ports: {
            'Gi0/0': { id: 'Gi0/0', name: 'GigabitEthernet0/0', status: 'connected', shutdown: false, vlan: 1, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: '172.16.0.2', subnetMask: '255.255.255.0' },
            'Gi0/1': { id: 'Gi0/1', name: 'GigabitEthernet0/1', status: 'connected', shutdown: false, vlan: 1, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: '192.168.1.1', subnetMask: '255.255.255.0' },
          },
          staticRoutes: [
            { destination: '10.0.0.0', subnetMask: '255.255.255.0', nextHop: 'Gi0/0', type: 'static', metric: 1 },
          ],
        } as any,
      ],
      [
        'PC2',
        {
          ports: {
            Eth0: { id: 'Eth0', name: 'Ethernet0', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '1000', type: 'fastethernet', ipAddress: '192.168.1.2', subnetMask: '255.255.255.0' },
          },
        } as any,
      ],
    ]);
  });

  it('Feature 1 & 10: Runs full packet pipeline with traces and standardized drop reasons', () => {
    const frame = {
      srcMac: '00:11:22:33:44:55',
      dstMac: 'AA:BB:CC:DD:EE:FF',
      srcIp: '10.0.0.2',
      dstIp: '192.168.1.2',
      protocol: 'ICMP',
      ttl: 64,
      vlanId: 1,
      ingressPortId: 'Eth0',
    };

    const res = runFullPacketPipeline(frame as any, 'PC1', devices, deviceStates, connections);
    expect(res.allTraces.length).toBeGreaterThan(0);
    expect(res.hopResults.length).toBeGreaterThan(0);
  });

  it('Feature 2: Generates RFC-compliant ICMP error frames with codes', () => {
    const frame = {
      srcIp: '10.0.0.2',
      dstIp: '192.168.1.2',
      srcMac: '00:11:22:33:44:55',
      dstMac: 'AA:BB:CC:DD:EE:FF',
      protocol: 'UDP',
      ttl: 64,
    };

    const icmpUnreach = generateIcmpUnreachable(frame as any, 'destination-unreachable', 'ACL Denied', 13, '10.0.0.1');
    expect(icmpUnreach.protocol).toBe('ICMP');
    expect(icmpUnreach.srcIp).toBe('10.0.0.1');
    expect(icmpUnreach.dstIp).toBe('10.0.0.2');
    expect(icmpUnreach.info).toContain('Code 13');
    expect(icmpUnreach.info).toContain('Communication Administratively Prohibited');

    const details = getIcmpCodeDetails('time-exceeded', 0);
    expect(details.icmpType).toBe(11);
    expect(details.codeName).toBe('TTL Exceeded in Transit');
  });

  it('Feature 3: Standardizes TTL decrementing across L3 hops and drops on TTL 0', () => {
    const frame = {
      srcMac: '00:11:22:33:44:55',
      dstMac: 'AA:BB:CC:DD:EE:FF',
      srcIp: '10.0.0.2',
      dstIp: '192.168.1.2',
      protocol: 'ICMP',
      ttl: 1, // Only 1 hop allowed before router drops
      vlanId: 1,
      ingressPortId: 'Gi0/0',
    };

    const res = runFullPacketPipeline(frame as any, 'R1', devices, deviceStates, connections);
    expect(res.success).toBe(false);
    expect(res.dropReason).toContain('Time to Live (TTL) Exceeded');
    expect(res.finalFrame?.protocol).toBe('ICMP');
  });

  it('Feature 4: Executes real-time ARP and MAC aging tick', () => {
    const state = deviceStates.get('SW1')!;
    state.macAddressTable![0].timestamp = Date.now() - 400000; // Older than 300s

    const result = runAgingTick(deviceStates);
    expect(result.agedMacCount).toBe(1);
    expect(state.macAddressTable?.length).toBe(1);
  });

  it('Feature 6: Diagnoses VLAN native and allowed mismatches', () => {
    const sw1State = deviceStates.get('SW1')!;
    const r1State = deviceStates.get('R1')!;

    sw1State.ports['Fa0/2'].mode = 'trunk';
    sw1State.ports['Fa0/2'].nativeVlan = 10;

    r1State.ports['Gi0/0'].mode = 'trunk';
    r1State.ports['Gi0/0'].nativeVlan = 20;

    const issues = diagnoseVlanMismatches(devices, connections, deviceStates);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe('NATIVE_VLAN_MISMATCH');
    expect(issues[0].sourceVlan).toBe(10);
    expect(issues[0].targetVlan).toBe(20);
  });

  it('Feature 7: Detailed routing decisions (Longest Prefix Match, AD, Metric)', () => {
    const routingTable: Route[] = [
      { destination: '10.0.0.0', subnetMask: '255.0.0.0', nextHop: 'Gi0/0', type: 'dynamic', code: 'O', metric: 110 },
      { destination: '10.0.0.0', subnetMask: '255.255.255.0', nextHop: 'Gi0/1', type: 'static', metric: 1 },
    ];

    const decision = findRouteDetailed('10.0.0.5', routingTable);
    expect(decision).not.toBeNull();
    expect(decision?.matchedPrefix).toBe('10.0.0.0/24');
    expect(decision?.administrativeDistance).toBe(1);
    expect(decision?.explanation).toContain('LPM 10.0.0.0/24');
  });

  it('Feature 8: Emits MAC lifecycle events (LEARN, MOVE, AGE)', () => {
    const events: MacLifecycleEvent[] = [];
    const unsubscribe = onMacLifecycleEvent(e => events.push(e));

    learnMacAddress('SW1', 'AA:BB:CC:11:22:33', 'Fa0/3', 1, deviceStates);
    expect(events.some(e => e.type === 'LEARN')).toBe(true);

    learnMacAddress('SW1', 'AA:BB:CC:11:22:33', 'Fa0/4', 1, deviceStates);
    expect(events.some(e => e.type === 'MOVE')).toBe(true);

    unsubscribe();
  });

  it('Feature 9: Updates interface rx/tx/drop counters on real traffic', () => {
    const frame = {
      srcMac: '00:11:22:33:44:55',
      dstMac: 'AA:BB:CC:DD:EE:FF',
      srcIp: '10.0.0.2',
      dstIp: '192.168.1.2',
      protocol: 'ICMP',
      ttl: 64,
      length: 128,
      vlanId: 1,
      ingressPortId: 'Fa0/1',
    };

    runFullPacketPipeline(frame as any, 'SW1', devices, deviceStates, connections);

    const sw1Port = deviceStates.get('SW1')?.ports['Fa0/1'];
    expect(sw1Port?.stats).toBeDefined();
    expect(sw1Port?.stats?.rxPackets).toBeGreaterThan(0);
    expect(sw1Port?.stats?.rxBytes).toBeGreaterThan(0);
  });

  it('Feature 10: Detects duplicate device IPs across devices', () => {
    const dupDevices = [
      ...devices,
      { id: 'PC3', name: 'PC3', type: 'pc', x: 600, y: 100, ip: '10.0.0.2', subnetMask: '255.255.255.0', macAddress: '11:11:11:11:11:11' } as any,
    ];
    const dupStates = new Map(deviceStates);
    dupStates.set('PC3', {
      ports: { Eth0: { id: 'Eth0', name: 'Ethernet0', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '1000', type: 'fastethernet', ipAddress: '10.0.0.2', subnetMask: '255.255.255.0' } },
    } as any);

    const issues = diagnoseDuplicateAddresses(dupDevices, dupStates);
    const ipIssue = issues.find(i => i.type === 'DUPLICATE_IP');
    expect(ipIssue).toBeDefined();
    expect(ipIssue!.address).toBe('10.0.0.2');
    expect(ipIssue!.devices.map(d => d.deviceName)).toContain('PC1');
    expect(ipIssue!.devices.map(d => d.deviceName)).toContain('PC3');
  });

  it('Feature 11: Detects duplicate MACs via macAddress field (not old mac field)', () => {
    const dupDevices = [
      ...devices,
      { id: 'PC3', name: 'PC3', type: 'pc', x: 600, y: 100, ip: '10.0.0.5', subnetMask: '255.255.255.0', macAddress: '00:11:22:33:44:55' } as any,
    ];
    const dupStates = new Map(deviceStates);
    dupStates.set('PC3', {
      ports: { Eth0: { id: 'Eth0', name: 'Ethernet0', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '1000', type: 'fastethernet', ipAddress: '10.0.0.5', subnetMask: '255.255.255.0', macAddress: '11:11:11:11:11:11' } },
    } as any);

    const issues = diagnoseDuplicateAddresses(dupDevices, dupStates);
    const macIssue = issues.find(i => i.type === 'DUPLICATE_MAC');
    expect(macIssue).toBeDefined();
    expect(macIssue!.address).toBe('00-11-22-33-44-55');
    expect(macIssue!.devices.map(d => d.deviceName)).toContain('PC1');
    expect(macIssue!.devices.map(d => d.deviceName)).toContain('PC3');
  });

  it('Feature 12: Does not flag device IP vs same-device port IP as duplicate', () => {
    // PC1 has device-level IP 10.0.0.2 AND its Eth0 port has the same IP.
    // Same device -> not a conflict. Ensure no DUPLICATE_IP issue for this alone.
    const r1State = deviceStates.get('R1');
    if (r1State?.ports) {
      // Give R1 an otherwise-unique IP that matches ONLY one of PC1's identities
      r1State.ports['Gi0/1'].ipAddress = '172.16.0.1';
    }
    // Remove PC2 to avoid its existing relationship with the pipeline devices
    const singleDeviceTopo = [devices[0]]; // only PC1
    const issues = diagnoseDuplicateAddresses(singleDeviceTopo, deviceStates);
    const selfIssues = issues.filter(i => i.devices.every(d => d.deviceId === 'PC1'));
    expect(selfIssues.length).toBe(0);
  });

  it('Feature 13: Proactive routing loop detection flags a two-device next-hop cycle', () => {
    // R1 -> R2 -> R1 cycle for destination 192.168.1.0
    const loopStates = new Map<string, SwitchState>();
    loopStates.set('R1', {
      ports: {
        'Gi0/0': { id: 'Gi0/0', name: 'GigabitEthernet0/0', status: 'connected', shutdown: false, vlan: 1, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: '172.16.0.1', subnetMask: '255.255.255.0' },
      },
      staticRoutes: [
        { destination: '192.168.1.0', subnetMask: '255.255.255.0', nextHop: '172.16.0.2', type: 'static', metric: 1 },
      ],
    } as any);
    loopStates.set('R2', {
      ports: {
        'Gi0/0': { id: 'Gi0/0', name: 'GigabitEthernet0/0', status: 'connected', shutdown: false, vlan: 1, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: '172.16.0.2', subnetMask: '255.255.255.0' },
      },
      staticRoutes: [
        { destination: '192.168.1.0', subnetMask: '255.255.255.0', nextHop: '172.16.0.1', type: 'static', metric: 1 },
      ],
    } as any);

    const loopDevices = [
      { id: 'R1', name: 'R1', type: 'router', x: 100, y: 100, ip: '172.16.0.1', subnet: '255.255.255.0' } as any,
      { id: 'R2', name: 'R2', type: 'router', x: 200, y: 100, ip: '172.16.0.2', subnet: '255.255.255.0' } as any,
    ];
    const loopConnections = [
      { id: 'l1', sourceDeviceId: 'R1', sourcePort: 'Gi0/0', targetDeviceId: 'R2', targetPort: 'Gi0/0' } as any,
    ];

    const issues = detectRoutingLoops(loopDevices, loopStates, loopConnections);
    expect(issues.length).toBeGreaterThan(0);
    const first = issues[0];
    expect(first.type).toBe('ROUTING_LOOP');
    expect(first.message).toContain('192.168.1.0');
    expect(first.loopPath.join(' -> ')).toBe('R2 -> R1 -> R2');
  });

  it('Feature 14: Proactive detector does not flag normal interface-based static routes', () => {
    // R1 has a normal static route via its own interface Gi0/1. That is not a loop.
    const issues = detectRoutingLoops(devices, deviceStates, connections);
    const r1Loops = issues.filter(i => i.deviceId === 'R1');
    expect(r1Loops.length).toBe(0);
  });

  it('Feature 15: Diagnoses trunk-to-access mode mismatch on switch links', () => {
    const sw1State = deviceStates.get('SW1')!;

    // Add SW2 for a switch-to-switch link
    devices.push({ id: 'SW2', name: 'SW2', type: 'switchL2', x: 250, y: 100 } as any);
    deviceStates.set('SW2', {
      hostname: 'SW2',
      ports: {
        'Fa0/1': { id: 'Fa0/1', name: 'FastEthernet0/1', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
      },
    } as any);
    connections.push({ id: 'c5', sourceDeviceId: 'SW1', sourcePort: 'Fa0/1', targetDeviceId: 'SW2', targetPort: 'Fa0/1' } as any);

    // SW1 side is trunk, SW2 side is access -> mode mismatch
    sw1State.ports['Fa0/1'].mode = 'trunk';
    sw1State.ports['Fa0/1'].allowedVlans = 'all';

    const issues = diagnoseVlanMismatches(devices, connections, deviceStates);
    const modeIssue = issues.find(i => i.type === 'TRUNK_ACCESS_MODE_MISMATCH' && i.connectionId === 'c5');
    expect(modeIssue).toBeDefined();
    expect(modeIssue!.severity).toBe('error');
  });

  it('Feature 16: Does not flag allowed-VLAN when one side is "all"', () => {
    const sw1State = deviceStates.get('SW1')!;
    devices.push({ id: 'SW2', name: 'SW2', type: 'switchL2', x: 250, y: 100 } as any);
    deviceStates.set('SW2', {
      hostname: 'SW2',
      ports: {
        'Fa0/1': { id: 'Fa0/1', name: 'FastEthernet0/1', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
      },
    } as any);
    connections.push({ id: 'c5', sourceDeviceId: 'SW1', sourcePort: 'Fa0/1', targetDeviceId: 'SW2', targetPort: 'Fa0/1' } as any);
    const sw2State = deviceStates.get('SW2')!;

    sw1State.ports['Fa0/1'].mode = 'trunk';
    sw1State.ports['Fa0/1'].allowedVlans = [10, 20];
    sw2State.ports['Fa0/1'].mode = 'trunk';
    sw2State.ports['Fa0/1'].allowedVlans = 'all';

    const issues = diagnoseVlanMismatches(devices, connections, deviceStates);
    const allowedIssue = issues.find(i => i.type === 'TRUNK_ALLOWED_MISMATCH' && i.connectionId === 'c5');
    const modeIssue = issues.find(i => i.type === 'TRUNK_ACCESS_MODE_MISMATCH' && i.connectionId === 'c5');
    expect(allowedIssue).toBeUndefined();
    expect(modeIssue).toBeUndefined();
  });

  it('Feature 17: Pipeline drops with L1_PORT_SHUTDOWN when route egress interface is shutdown', () => {
    const r1State = deviceStates.get('R1')!;
    // Route for 192.168.1.0/24 points out Gi0/1
    r1State.ports['Gi0/1'].shutdown = true;
    // Simulate a frame arriving at R1 from SW1 (ingress Gi0/0)
    const frame = {
      srcMac: '00:11:22:33:44:55',
      dstMac: '00:00:00:00:00:01',
      srcIp: '10.0.0.2',
      dstIp: '192.168.1.2',
      protocol: 'ICMP',
      ttl: 64,
      vlanId: 1,
      ingressPortId: 'Gi0/0',
    };

    const res = runFullPacketPipeline(frame as any, 'R1', devices, deviceStates, connections);
    const r1Hop = res.allTraces.find(t => t.deviceId === 'R1');
    const dropTrace = res.allTraces.find(t => t.deviceId === 'R1' && t.action === 'drop');
    expect(r1Hop).toBeDefined();
    expect(dropTrace).toBeDefined();
    expect(dropTrace!.stage).toBe('egress');
    expect(dropTrace!.reason).toContain('administratively down');
  });

  it('Feature 18: Interface shutdown flushes stale ARP/MAC/NDP entries for the port', async () => {
    const { getInterfaceStateUpdate } = await import('@/lib/network/core/commandHelpers');
    const ctx = {
      sourceDeviceId: 'R1',
      deviceStates,
      connections,
    } as any;

    const r1State = deviceStates.get('R1')!;
    r1State.arpCache = [
      { ip: '172.16.0.2', mac: '11:11:11:11:11:11', interface: 'Gi0/1', timestamp: Date.now() },
      { ip: '10.0.0.2', mac: '22:22:22:22:22:22', interface: 'Gi0/0', timestamp: Date.now() },
    ];
    r1State.macAddressTable = [
      { mac: '33:33:33:33:33:33', vlan: 1, port: 'Gi0/1', type: 'DYNAMIC' },
      { mac: '44:44:44:44:44:44', vlan: 1, port: 'Gi0/0', type: 'DYNAMIC' },
    ];
    // R2 learned the switch MAC via Gi0/0 (peer of R1 Gi0/1)
    const r2State = deviceStates.get('R2')!;
    r2State.macAddressTable = [
      { mac: '55:55:55:55:55:55', vlan: 1, port: 'Gi0/0', type: 'DYNAMIC' },
      { mac: '66:66:66:66:66:66', vlan: 1, port: 'Gi0/1', type: 'DYNAMIC' },
    ];

    const updated = { ...r1State, ports: { ...r1State.ports, 'Gi0/1': { ...r1State.ports['Gi0/1'], shutdown: true } } };
    const res = getInterfaceStateUpdate(updated, ctx, ['Gi0/1']);
    // 'error' branch not returned
    expect('allUpdatedStates' in res).toBe(true);
    const { allUpdatedStates } = res as { allUpdatedStates: Map<string, SwitchState> };

    const updatedR1 = allUpdatedStates.get('R1');
    expect(updatedR1!.arpCache!.map(a => a.interface)).not.toContain('Gi0/1');
    expect(updatedR1!.arpCache!.map(a => a.interface)).toContain('Gi0/0');
    expect(updatedR1!.macAddressTable!.map(m2 => m2.port)).not.toContain('Gi0/1');
    expect(updatedR1!.macAddressTable!.map(m2 => m2.port)).toContain('Gi0/0');

    // Peer (R2) MAC entry pointing out the far end of the shutdown link is flushed
    const updatedR2 = allUpdatedStates.get('R2');
    expect(updatedR2!.macAddressTable!.map(m2 => m2.port)).not.toContain('Gi0/0');
    expect(updatedR2!.macAddressTable!.map(m2 => m2.port)).toContain('Gi0/1');
  });

  it('Feature 19: Network health check reports PASSED on a healthy topology', async () => {
    const { cmdShowNetworkHealth } = await import('@/lib/network/core/showCommands');
    // Give SW1 a spanning-tree forwarding port so STP isolation is not flagged
    const sw1 = deviceStates.get('SW1')!;
    sw1.spanningTreeEnabled = true;
    sw1.ports['Fa0/1'].spanningTree = { role: 'designated', state: 'forwarding' };
    sw1.ports['Fa0/2'].spanningTree = { role: 'root', state: 'forwarding' };

    const ctx = { devices, connections, deviceStates } as any;
    const res = cmdShowNetworkHealth({} as any, '', ctx);

    expect(res.success).toBe(true);
    expect(res.output).toContain('NETWORK HEALTH CHECK REPORT');
    expect(res.output).toContain('Overall Status : PASSED');
    expect(res.output).toContain('1. VLAN & Trunk Configuration:');
    expect(res.output).toContain('2. IP & MAC Address Integrity:');
    expect(res.output).toContain('3. Device & Port Connectivity:');
    expect(res.output).toContain('4. Routing Loops:');
    expect(res.output).toContain('5. Interface Health (shutdown / down):');
    expect(res.output).toContain('6. Spanning-Tree Isolation:');
    expect(res.output).toContain('7. Route Reachability:');
    // All sections show [OK]
    expect(res.output?.match(/\[OK\]/g) || []).toHaveLength(7);
  });

  it('Feature 20: Network health check flags shutdown interfaces, STP isolation and unreachable networks', async () => {
    const { cmdShowNetworkHealth } = await import('@/lib/network/core/showCommands');
    const r1 = deviceStates.get('R1')!;
    const sw1 = deviceStates.get('SW1')!;

    // 1. Interface health: shutdown one of two R1 interfaces (warning)
    r1.ports['Gi0/1'].shutdown = true;

    // 2. STP isolation: SW1 has STP but no forwarding port
    sw1.spanningTreeEnabled = true;
    sw1.ports['Fa0/1'].spanningTree = { role: 'designated', state: 'listening' };
    sw1.ports['Fa0/2'].spanningTree = { role: 'root', state: 'blocking' };

    const ctx = { devices, connections, deviceStates } as any;
    const res = cmdShowNetworkHealth({} as any, '', ctx);

    expect(res.success).toBe(true);
    // Interface health section flagged the shutdown port
    expect(res.output).toContain('5. Interface Health (shutdown / down):');
    expect(res.output).toMatch(/R1: interfaces shutdown: Gi0\/1/);
    // STP isolation flagged SW1
    expect(res.output).toMatch(/Switch SW1: STP is enabled but no port is in forwarding state/);
  });
});
