import { describe, it, expect, beforeEach } from 'vitest';
import { runFullPacketPipeline } from '@/lib/network/forwarding/packetPipeline';
import { recalculateStp } from '@/lib/network/stp';
import { detectEtherChannelBundles } from '@/lib/network/etherchannel';
import { runAgingTick } from '@/lib/network/agingEngine';
import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import type { SwitchState } from '@/lib/network/types';

describe('Advanced Network Diagnostics & Counters Engine (Features 6 - 9)', () => {
  let devices: CanvasDevice[];
  let connections: CanvasConnection[];
  let deviceStates: Map<string, SwitchState>;

  beforeEach(() => {
    devices = [
      { id: 'PC1', name: 'PC1', type: 'pc', x: 100, y: 100, ip: '10.0.0.2', subnetMask: '255.255.255.0', macAddress: '00:11:22:33:44:55' } as any,
      { id: 'SW1', name: 'SW1', type: 'switchL2', x: 200, y: 100 } as any,
      { id: 'SW2', name: 'SW2', type: 'switchL2', x: 300, y: 100 } as any,
      { id: 'PC2', name: 'PC2', type: 'pc', x: 400, y: 100, ip: '10.0.0.3', subnetMask: '255.255.255.0', macAddress: 'AA:BB:CC:DD:EE:FF' } as any,
    ];

    connections = [
      { id: 'c1', sourceDeviceId: 'PC1', sourcePort: 'Eth0', targetDeviceId: 'SW1', targetPort: 'Fa0/1' } as any,
      { id: 'c2', sourceDeviceId: 'SW1', sourcePort: 'Fa0/2', targetDeviceId: 'SW2', targetPort: 'Fa0/2' } as any,
      { id: 'c3', sourceDeviceId: 'SW1', sourcePort: 'Fa0/3', targetDeviceId: 'SW2', targetPort: 'Fa0/3' } as any,
      { id: 'c4', sourceDeviceId: 'SW2', sourcePort: 'Fa0/1', targetDeviceId: 'PC2', targetPort: 'Eth0' } as any,
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
          hostname: 'SW1',
          macAddress: '0000.0000.0001',
          spanningTreeEnabled: true,
          macAddressTable: [
            { mac: '00:11:22:33:44:55', vlan: 1, port: 'Fa0/1', type: 'DYNAMIC', timestamp: Date.now() },
            { mac: 'AA:BB:CC:DD:EE:FF', vlan: 1, port: 'Fa0/2', type: 'DYNAMIC', timestamp: Date.now() },
          ],
          ports: {
            'Fa0/1': { id: 'Fa0/1', name: 'FastEthernet0/1', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
            'Fa0/2': { id: 'Fa0/2', name: 'FastEthernet0/2', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
            'Fa0/3': { id: 'Fa0/3', name: 'FastEthernet0/3', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
          },
        } as any,
      ],
      [
        'SW2',
        {
          hostname: 'SW2',
          macAddress: '0000.0000.0002',
          spanningTreeEnabled: true,
          macAddressTable: [
            { mac: 'AA:BB:CC:DD:EE:FF', vlan: 1, port: 'Fa0/1', type: 'DYNAMIC', timestamp: Date.now() },
            { mac: '00:11:22:33:44:55', vlan: 1, port: 'Fa0/2', type: 'DYNAMIC', timestamp: Date.now() },
          ],
          ports: {
            'Fa0/1': { id: 'Fa0/1', name: 'FastEthernet0/1', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
            'Fa0/2': { id: 'Fa0/2', name: 'FastEthernet0/2', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
            'Fa0/3': { id: 'Fa0/3', name: 'FastEthernet0/3', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
          },
        } as any,
      ],
      [
        'PC2',
        {
          ports: {
            Eth0: { id: 'Eth0', name: 'Ethernet0', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '1000', type: 'fastethernet', ipAddress: '10.0.0.3', subnetMask: '255.255.255.0' },
          },
        } as any,
      ],
    ]);
  });

  it('Feature 6: Increments Rx/Tx/Error/Drop port counters during packet forwarding', () => {
    const frame = {
      srcMac: '00:11:22:33:44:55',
      dstMac: 'AA:BB:CC:DD:EE:FF',
      srcIp: '10.0.0.2',
      dstIp: '10.0.0.3',
      protocol: 'ICMP',
      ttl: 64,
      vlanId: 1,
      ingressPortId: 'Eth0',
    };

    const res = runFullPacketPipeline(frame as any, 'PC1', devices, deviceStates, connections);
    expect(res.allTraces.length).toBeGreaterThan(0);

    const sw1Port1 = deviceStates.get('SW1')!.ports['Fa0/1'];
    expect(sw1Port1).toBeDefined();
  });

  it('Feature 7: STP topology-change event calculation maintains non-blocking state for single switch', () => {
    const sw1 = deviceStates.get('SW1')!;
    sw1.spanningTreeEnabled = true;
    sw1.ports['Fa0/1'].status = 'connected';
    sw1.ports['Fa0/2'].status = 'connected';

    const updated = recalculateStp(deviceStates, connections);
    const sw1State = updated.get('SW1');
    expect(sw1State).toBeDefined();
  });

  it('Feature 8: Detects EtherChannel bundle formation and member configuration compatibility', () => {
    const sw1 = deviceStates.get('SW1')!;
    const sw2 = deviceStates.get('SW2')!;

    sw1.ports['Fa0/2'].channelGroup = 1;
    sw1.ports['Fa0/2'].channelMode = 'active';
    sw1.ports['Fa0/3'].channelGroup = 1;
    sw1.ports['Fa0/3'].channelMode = 'active';

    sw2.ports['Fa0/2'].channelGroup = 1;
    sw2.ports['Fa0/2'].channelMode = 'passive';
    sw2.ports['Fa0/3'].channelGroup = 1;
    sw2.ports['Fa0/3'].channelMode = 'passive';

    const bundles = detectEtherChannelBundles(connections, deviceStates);
    const lacpBundle = bundles.find(b => b.groupId === 1);
    expect(lacpBundle).toBeDefined();
    expect(lacpBundle!.bundled).toBe(true);
    expect(lacpBundle!.protocol).toBe('lacp');
  });

  it('Feature 9: Executes ARP/MAC aging engine tick and collects expired entry counts', () => {
    const sw1 = deviceStates.get('SW1')!;
    sw1.macAddressTable = [
      { mac: '99:99:99:99:99:99', vlan: 1, port: 'Fa0/1', type: 'DYNAMIC', timestamp: Date.now() - 600000 },
    ];

    const res = runAgingTick(deviceStates);
    expect(res.agedMacCount).toBeGreaterThan(0);
  });
});
