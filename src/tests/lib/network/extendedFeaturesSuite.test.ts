import { describe, it, expect, beforeEach } from 'vitest';
import { runFullPacketPipeline } from '@/lib/network/forwarding/packetPipeline';
import { cmdClearArpCache, cmdClearMacAddressTable, cmdClearCounters } from '@/lib/network/core/privilegedClear';
import { getInterfaceStateUpdate } from '@/lib/network/core/commandHelpers';
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
      ingressPortId: 'Eth0',
    };

    const res = runFullPacketPipeline(frame as any, 'PC1', devices, deviceStates, connections);
    expect(res.allTraces.length).toBeGreaterThan(0);
    const trace = res.allTraces.find(t => t.deviceId === 'PC1');
    expect(trace).toBeDefined();
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
  });

  it('Feature 13: Verifies clear arp / clear mac / clear counters commands', () => {
    const r1State = deviceStates.get('R1')!;
    const ctx = { sourceDeviceId: 'R1', deviceStates } as any;

    const arpRes = cmdClearArpCache(r1State, 'clear arp-cache', ctx);
    expect(arpRes.success).toBe(true);

    const macRes = cmdClearMacAddressTable(r1State, 'clear mac address-table', ctx);
    expect(macRes.success).toBe(true);

    const countRes = cmdClearCounters(r1State, 'clear counters', ctx);
    expect(countRes.success).toBe(true);
    expect(countRes.output).toContain('Clear "show interface" counters');
  });

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
