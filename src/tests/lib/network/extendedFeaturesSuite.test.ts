import { describe, it, expect, beforeEach } from 'vitest';
import { runFullPacketPipeline } from '@/lib/network/forwarding/packetPipeline';
import { cmdClearArpCache, cmdClearMacAddressTable, cmdClearCounters } from '@/lib/network/core/privilegedClear';
import { getInterfaceStateUpdate } from '@/lib/network/core/commandHelpers';
import { cmdShowIpRoute } from '@/lib/network/core/showRoutingDisplay';
import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import type { SwitchState } from '@/lib/network/types';

describe('Features 11 - 15: Decision Explanations, ACL Trace, Clear Commands & Interface State Updates', () => {
  let devices: CanvasDevice[];
  let connections: CanvasConnection[];
  let deviceStates: Map<string, SwitchState>;

  beforeEach(() => {
    devices = [
      { id: 'PC1', name: 'PC1', type: 'pc', x: 100, y: 100, ip: '10.0.0.2', subnetMask: '255.255.255.0', macAddress: '00:11:22:33:44:55' } as any,
      { id: 'R1', name: 'R1', type: 'router', x: 200, y: 100 } as any,
      { id: 'PC2', name: 'PC2', type: 'pc', x: 300, y: 100, ip: '192.168.1.2', subnetMask: '255.255.255.0', macAddress: 'AA:BB:CC:DD:EE:FF' } as any,
    ];

    connections = [
      { id: 'c1', sourceDeviceId: 'PC1', sourcePort: 'Eth0', targetDeviceId: 'R1', targetPort: 'Gi0/0' } as any,
      { id: 'c2', sourceDeviceId: 'R1', sourcePort: 'Gi0/1', targetDeviceId: 'PC2', targetPort: 'Eth0' } as any,
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
        'R1',
        {
          hostname: 'R1',
          ipRouting: true,
          ports: {
            'Gi0/0': { id: 'Gi0/0', name: 'GigabitEthernet0/0', status: 'connected', shutdown: false, vlan: 1, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: '10.0.0.1', subnetMask: '255.255.255.0' },
            'Gi0/1': { id: 'Gi0/1', name: 'GigabitEthernet0/1', status: 'connected', shutdown: false, vlan: 1, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: '192.168.1.1', subnetMask: '255.255.255.0' },
          },
          staticRoutes: [
            { destination: '192.168.1.0', subnetMask: '255.255.255.0', nextHop: 'Gi0/1', type: 'static', metric: 1 },
          ],
          arpCache: [
            { ip: '10.0.0.2', mac: '00:11:22:33:44:55', interface: 'Gi0/0', timestamp: Date.now() },
          ],
          macAddressTable: [
            { mac: '00:11:22:33:44:55', vlan: 1, port: 'Gi0/0', type: 'DYNAMIC' },
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

  it('Feature 11: Route lookup provides decision explanation in pipeline trace', () => {
    const frame = {
      srcMac: '00:11:22:33:44:55',
      dstMac: 'AA:BB:CC:DD:EE:FF',
      srcIp: '10.0.0.2',
      dstIp: '192.168.1.2',
      protocol: 'ICMP',
      ttl: 64,
      vlanId: 1,
      ingressPortId: 'Gi0/0',
    };

    // The routed hop's forward trace must carry the route decision explanation
    const res = runFullPacketPipeline(frame as any, 'R1', devices, deviceStates, connections);
    expect(res.allTraces.length).toBeGreaterThan(0);
    const routedTrace = res.allTraces.find(t => t.deviceId === 'R1' && /LPM 192\.168\.1\.0\/24 \[AD:0\/Metric:0\] via Gi0\/1/.test(t.reason));
    expect(routedTrace).toBeDefined();

    // CLI: show ip route <destination> exposes the same decision 
    const r1State = deviceStates.get('R1')!;
    const ctx = { sourceDeviceId: 'R1', devices, connections } as any;
    const lookup = cmdShowIpRoute(r1State, 'show ip route 192.168.1.2', ctx);
    expect(lookup.success).toBe(true);
    expect(lookup.output).toContain('Routing entry for 192.168.1.0/24');
    expect(lookup.output).toContain('Decision: longest-prefix match');
    expect(lookup.output).toMatch(/source "connected", AD 0/);

    // Longest-prefix beats static for the same prefix (AD 0 < 1)
    expect(lookup.output).toContain('Known via "connected", distance 0');

    // show ip route <network> <mask> shows the exact prefix entry
    const exact = cmdShowIpRoute(r1State, 'show ip route 192.168.1.0 255.255.255.0', ctx);
    expect(exact.output).toContain('Routing entry for 192.168.1.0/24');
    expect(exact.output).toContain('Decision: exact match on 192.168.1.0/24');

    // Unreachable destination reports no match with a reasoning line
    const miss = cmdShowIpRoute(r1State, 'show ip route 172.16.0.1', ctx);
    expect(miss.output).toContain('% Network not in table');
    expect(miss.output).toContain('no match');
  });

  it('Feature 12: ACL deny produces Packet Trace drop entry with ACL category', () => {
    const r1State = deviceStates.get('R1')!;
    r1State.accessLists = {
      '100': ['deny ip 10.0.0.0 0.0.0.255 192.168.1.0 0.0.0.255', 'permit ip any any'],
    };
    r1State.ports['Gi0/0'].accessGroupIn = '100';

    const frame = {
      srcMac: '00:11:22:33:44:55',
      dstMac: 'AA:BB:CC:DD:EE:FF',
      srcIp: '10.0.0.2',
      dstIp: '192.168.1.2',
      protocol: 'ICMP',
      ttl: 64,
      vlanId: 1,
      ingressPortId: 'Gi0/0',
    };

    const res = runFullPacketPipeline(frame as any, 'R1', devices, deviceStates, connections);
    expect(res.allTraces.length).toBeGreaterThan(0);
    // The packet must be stopped by the ingress ACL with an ACL-category drop trace
    const aclDrop = res.allTraces.find(t => t.stage === 'acl-ingress' && t.action === 'drop');
    expect(aclDrop).toBeDefined();
    expect(aclDrop!.reason).toContain('[ACL]');
    expect(aclDrop!.reason).toMatch(/ACL 100 denied 10\.0\.0\.2→192\.168\.1\.2/);
    expect(res.dropReason).toMatch(/Dropped at R1/);
  });

  it('Feature 13: Verifies clear arp / clear mac / clear counters commands', () => {
    const r1State = deviceStates.get('R1')!;
    const ctx = { sourceDeviceId: 'R1', deviceStates } as any;

    // Seed counters on both stat systems so the reset is observable
    r1State.ports['Gi0/0'].statistics = { inputPackets: 42, outputPackets: 17, drops: 3, lastCleared: 0 };
    r1State.ports['Gi0/0'].stats = { rxPackets: 42, rxBytes: 2688, txPackets: 17, txBytes: 1088, rxDrops: 2, txDrops: 3, rxErrors: 0, txErrors: 0 };
    r1State.macAddressTable = [
      { mac: '00:11:22:33:44:55', vlan: 1, port: 'Gi0/0', type: 'DYNAMIC' },
      { mac: '00:AA:BB:CC:DD:EE', vlan: 1, port: 'Gi0/0', type: 'STATIC' },
    ];

    const arpRes = cmdClearArpCache(r1State, 'clear arp-cache', ctx);
    expect(arpRes.success).toBe(true);
    expect(newStateFrom(arpRes).arpCache).toHaveLength(0);
    expect(deviceStates.get('R1')!.arpCache).toHaveLength(0);

    // clear mac address-table dynamic must keep STATIC entries (case-insensitive type)
    const macDynamicRes = cmdClearMacAddressTable(newStateFrom(arpRes), 'clear mac address-table dynamic', ctx);
    expect(macDynamicRes.success).toBe(true);
    expect(newStateFrom(macDynamicRes).macAddressTable.map(e => e.type)).toEqual(['STATIC']);

    // clear mac address-table static must keep DYNAMIC entries
    const macStaticRes = cmdClearMacAddressTable(newStateFrom(arpRes), 'clear mac address-table static', ctx);
    expect(macStaticRes.success).toBe(true);
    expect(newStateFrom(macStaticRes).macAddressTable.map(e => e.type)).toEqual(['DYNAMIC']);

    // clear mac address-table (all) empties everything
    const macAllRes = cmdClearMacAddressTable(newStateFrom(arpRes), 'clear mac address-table', ctx);
    expect(macAllRes.success).toBe(true);
    expect(newStateFrom(macAllRes).macAddressTable).toHaveLength(0);

    const countRes = cmdClearCounters(r1State, 'clear counters', ctx);
    expect(countRes.success).toBe(true);
    expect(countRes.output).toContain('Clear "show interface" counters');
    const clearedR1 = newStateFrom(countRes);
    const clearedGi0 = clearedR1.ports['Gi0/0'];
    expect(clearedGi0.statistics?.inputPackets).toBe(0);
    expect(clearedGi0.statistics?.drops).toBe(0);
    expect(clearedGi0.stats?.rxPackets).toBe(0);
    expect(clearedGi0.stats?.txDrops).toBe(0);
    expect(clearedGi0.statistics?.resets).toBe(1);
    expect(clearedGi0.statistics?.lastCleared).toBeGreaterThan(0);

    // Case-insensitive per-interface clear — only the named interface is reset
    r1State.ports['Gi0/1'].statistics = { inputPackets: 9, outputPackets: 9, lastCleared: 0 };
    r1State.ports['Gi0/1'].stats = { rxPackets: 9, rxBytes: 576, txPackets: 9, txBytes: 576, rxDrops: 0, txDrops: 0, rxErrors: 0, txErrors: 0 };
    const intfRes = cmdClearCounters(r1State, 'clear counters gi0/0', ctx);
    expect(intfRes.success).toBe(true);
    expect(intfRes.output).toContain('Gi0/0');
    const clearedIntf = newStateFrom(intfRes);
    expect(clearedIntf.ports['Gi0/0'].stats?.txPackets).toBe(0);
    expect(clearedIntf.ports['Gi0/1'].stats?.rxPackets).toBe(9);
  });

  const newStateFrom = (res: { newState?: Partial<SwitchState> }): SwitchState => res.newState as SwitchState;

  it('Feature 14: Recalculates topology and flushes stale entries on interface shutdown/no shutdown', () => {
    const ctx = { sourceDeviceId: 'R1', deviceStates, connections } as any;
    const r1State = deviceStates.get('R1')!;
    const updatedState = {
      ...r1State,
      ports: { ...r1State.ports, 'Gi0/0': { ...r1State.ports['Gi0/0'], shutdown: true } },
    };

    const res = getInterfaceStateUpdate(updatedState, ctx, ['Gi0/0']);
    expect('allUpdatedStates' in res).toBe(true);
    if ('allUpdatedStates' in res) {
      const r1Next = res.allUpdatedStates.get('R1');
      expect(r1Next?.arpCache?.map(a => a.interface)).not.toContain('Gi0/0');
    }
  });
});
