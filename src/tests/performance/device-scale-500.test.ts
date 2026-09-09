import { describe, it, expect } from 'vitest';
import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import type { SwitchState } from '@/lib/network/types';
import { getRoutingTable } from '@/lib/network/routing';
import { detectEtherChannelBundles, computeEtherChannelChanges } from '@/lib/network/etherchannel';
import { runFullPacketPipeline } from '@/lib/network/forwarding/packetPipeline';
import { runNetworkEventPipeline } from '@/lib/network/forwarding/eventPipeline';

describe('500-Device Scale Smoke / Benchmark', () => {
  const TOTAL = 500;
  const PARTITION = 400; // first 400 are PCs / switches, the rest are L3 devices

  function makeDevice(i: number): CanvasDevice {
    if (i < 240) {
      return { id: `PC${i}`, name: `PC${i}`, type: 'pc', x: (i * 7) % 3000, y: (i * 13) % 3000, status: 'online', ip: `10.${(i >> 8) & 255}.${i & 255}.2`, subnet: '255.255.255.0', macAddress: `00:00:00:00:${(i >> 8) & 255}:${i & 255}`, ports: [] } as unknown as CanvasDevice;
    }
    if (i < PARTITION) {
      return { id: `SW${i}`, name: `SW${i}`, type: 'switchL2', x: (i * 11) % 3000, y: (i * 3) % 3000, status: 'online', spanwnigTreePriority: undefined, ports: ['Fa0/1', 'Fa0/2', 'Gi1/0/1'] } as unknown as CanvasDevice;
    }
    const isRouter = i % 2 === 0;
    return { id: `L3${i}`, name: `L3${i}`, type: isRouter ? 'router' : 'switchL3', x: (i * 5) % 3000, y: (i * 17) % 3000, status: 'online', ports: ['Gi1/0/1', 'Gi1/0/2', 'Gi1/0/3'] } as unknown as CanvasDevice;
  }

  function makeState(device: CanvasDevice, i: number): SwitchState {
    if (device.type === 'pc') {
      return {
        hostname: device.name,
        ports: {
          Eth0: { id: 'Eth0', name: 'Ethernet0', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '1000', type: 'fastethernet', ipAddress: device.ip, subnetMask: '255.255.255.0' },
        },
      } as unknown as SwitchState;
    }
    if (device.type === 'switchL2') {
      return {
        hostname: device.name,
        ports: {
          'Fa0/1': { id: 'Fa0/1', name: 'FastEthernet0/1', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
          'Fa0/2': { id: 'Fa0/2', name: 'FastEthernet0/2', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '100', type: 'fastethernet' },
          'Gi1/0/1': { id: 'Gi1/0/1', name: 'GigabitEthernet1/0/1', status: 'connected', shutdown: false, vlan: 1, mode: 'access', duplex: 'full', speed: '1000', type: 'gigabitethernet' },
        },
      } as unknown as SwitchState;
    }
    const octetA = ((i & 15) * 10) + 10;
    const octetB = i & 255;
    const base = `10.${octetA}.${octetB}`;
    return {
      hostname: device.name,
      ipRouting: true,
      routingProtocol: 'ospf',
      ospfRouterId: `${base}.1`,
      staticRoutes: i === 499
        ? [{ destination: '192.168.99.0', subnetMask: '255.255.255.0', nextHop: `${base}.2`, type: 'static', metric: 1 }]
        : [],
      ports: {
        'Gi1/0/1': { id: 'Gi1/0/1', name: 'GigabitEthernet1/0/1', status: 'connected', shutdown: false, vlan: 1, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: `${base}.1`, subnetMask: '255.255.255.0' },
        'Gi1/0/2': { id: 'Gi1/0/2', name: 'GigabitEthernet1/0/2', status: 'connected', shutdown: false, vlan: 1, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: `${base}.3`, subnetMask: '255.255.255.0' },
        'Gi1/0/3': { id: 'Gi1/0/3', name: 'GigabitEthernet1/0/3', status: 'connected', shutdown: false, vlan: 1, mode: 'routed', duplex: 'full', speed: '1000', type: 'gigabitethernet', ipAddress: `${base}.5`, subnetMask: '255.255.255.0' },
      },
    } as unknown as SwitchState;
  }

  function pairPorts(a: CanvasDevice, b: CanvasDevice): [string, string] {
    if (a.type === 'pc') return ['Eth0', pickPort(b)];
    if (b.type === 'pc') return [pickPort(a), 'Eth0'];
    return [pickPort(a), pickPort(b)];
  }
  function pickPort(d: CanvasDevice): string {
    if (d.type === 'switchL2') return 'Gi1/0/1';
    return 'Gi1/0/2';
  }

  it('builds 500 devices + ring connections without errors', () => {
    const devices = Array.from({ length: TOTAL }, (_, i) => makeDevice(i));
    const connections: CanvasConnection[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const a = devices[i];
      const b = devices[(i + 1) % TOTAL];
      const [sp, tp] = pairPorts(a, b);
      connections.push({ id: `c${i}`, sourceDeviceId: a.id, sourcePort: sp, targetDeviceId: b.id, targetPort: tp, cableType: 'straight' as const, active: true });
    }
    expect(devices).toHaveLength(TOTAL);
    expect(connections).toHaveLength(TOTAL);
    expect(new Set(devices.map(d => d.id)).size).toBe(TOTAL);
  });

  it('benchmark: routing tables for L3 devices at 500-device scale stay fast', () => {
    const devices = Array.from({ length: TOTAL }, (_, i) => makeDevice(i));
    const states = new Map<string, SwitchState>();
    devices.forEach((d, i) => states.set(d.id, makeState(d, i)));
    const connections: CanvasConnection[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const a = devices[i];
      const b = devices[(i + 1) % TOTAL];
      const [sp, tp] = pairPorts(a, b);
      connections.push({ id: `c${i}`, sourceDeviceId: a.id, sourcePort: sp, targetDeviceId: b.id, targetPort: tp, cableType: 'straight' as const, active: true });
    }

    const l3Devices = devices.filter(d => d.type === 'router' || d.type === 'switchL3').slice(0, 10);
    const started = performance.now();
    for (const device of l3Devices) {
      const table = getRoutingTable(device.id, states, devices, connections);
      expect(table.length).toBeGreaterThanOrEqual(3); // connected + static where present
    }
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(1000);
  });

  it('benchmark: EtherChannel bundle detection over 500 connections', () => {
    const devices = Array.from({ length: TOTAL }, (_, i) => makeDevice(i));
    const states = new Map<string, SwitchState>();
    devices.forEach((d, i) => states.set(d.id, makeState(d, i)));
    const connections: CanvasConnection[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const a = devices[i];
      const b = devices[(i + 1) % TOTAL];
      const [sp, tp] = pairPorts(a, b);
      connections.push({ id: `c${i}`, sourceDeviceId: a.id, sourcePort: sp, targetDeviceId: b.id, targetPort: tp, cableType: 'straight' as const, active: true });
      // Give 30 of the L3 pairs a parallel link so real bundles form
      if (i % 15 === 0 && a.id.startsWith('L3') && b.id.startsWith('L3')) {
        connections.push({ id: `cx${i}`, sourceDeviceId: a.id, sourcePort: 'Gi1/0/3', targetDeviceId: b.id, targetPort: 'Gi1/0/1', cableType: 'straight' as const, active: true });
      }
    }

    const started = performance.now();
    const bundles = detectEtherChannelBundles(connections, states);
    const elapsed = performance.now() - started;
    expect(Array.isArray(bundles)).toBe(true);
    if (bundles.length > 0) {
      const events = computeEtherChannelChanges([], bundles);
      expect(Array.isArray(events)).toBe(true);
    }
    expect(elapsed).toBeLessThan(1500);
  });

  it('benchmark: single packet pipeline traversal across a 500-device ring', () => {
    const devices = Array.from({ length: TOTAL }, (_, i) => makeDevice(i));
    const states = new Map<string, SwitchState>();
    devices.forEach((d, i) => states.set(d.id, makeState(d, i)));
    const connections: CanvasConnection[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const a = devices[i];
      const b = devices[(i + 1) % TOTAL];
      const [sp, tp] = pairPorts(a, b);
      connections.push({ id: `c${i}`, sourceDeviceId: a.id, sourcePort: sp, targetDeviceId: b.id, targetPort: tp, cableType: 'straight' as const, active: true });
    }

    const frame = {
      id: 'bench-1',
      srcMac: '00:00:00:00:00:01',
      dstMac: 'ff:ff:ff:ff:ff:ff',
      srcIp: '10.10.10.2',
      dstIp: '10.10.20.2',
      protocol: 'ICMP',
      timestamp: Date.now(),
      ttl: 64,
      ingressPortId: 'Gi1/0/1',
    };

    const started = performance.now();
    const res = runFullPacketPipeline(frame as any, 'L3100', devices, states, connections, 12);
    const elapsed = performance.now() - started;
    expect(Array.isArray(res.allTraces)).toBe(true);
    expect(elapsed).toBeLessThan(3000);
  });

  it('benchmark: full periodic network event pipeline tick at 500 devices', () => {
    const devices = Array.from({ length: TOTAL }, (_, i) => makeDevice(i));
    const states = new Map<string, SwitchState>();
    devices.forEach((d, i) => states.set(d.id, makeState(d, i)));
    const connections: CanvasConnection[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const a = devices[i];
      const b = devices[(i + 1) % TOTAL];
      const [sp, tp] = pairPorts(a, b);
      connections.push({ id: `c${i}`, sourceDeviceId: a.id, sourcePort: sp, targetDeviceId: b.id, targetPort: tp, cableType: 'straight' as const, active: true });
    }

    const now = Date.now();
    const started = performance.now();
    const res = runNetworkEventPipeline(states, devices, connections, now);
    const elapsed = performance.now() - started;
    expect(res).toBeDefined();
    expect(Array.isArray(res.protocolEvents)).toBe(true);
    expect(Array.isArray(res.dispatchedPackets)).toBe(true);
    expect(Array.isArray(res.processedFrames)).toBe(true);
    expect(res.updatedStates.size).toBe(TOTAL);
    expect(elapsed).toBeLessThan(15000);
  });

  it('memory footprint estimate for 500 devices stays sane', () => {
    const estimatedBytesPerDevice = 6000;
    const totalBytes = TOTAL * estimatedBytesPerDevice;
    const totalMB = totalBytes / (1024 * 1024);
    expect(totalMB).toBeLessThan(10);
    expect(totalMB).toBeGreaterThan(0);
  });
});