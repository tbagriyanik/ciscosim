import { describe, it, expect, beforeEach } from 'vitest';
import { SwitchState } from '../../../lib/network/types';
import { buildEigrpTopologyTable, runEigrpDual, buildEigrp6TopologyTable, calculateEigrp6Routes } from '../../../lib/network/eigrp-dual';
import { eigrpTickHoldTimer } from '../../../lib/network/protocols/protocolStateMachines';


describe('EIGRP DUAL Algorithm', () => {
  let deviceStates: Map<string, SwitchState>;

  beforeEach(() => {
    deviceStates = new Map();
  });

  it('should select a Feasible Successor when Feasibility Condition is met (RD < FD)', () => {
    // Topology: R1 connected to R2 and R3.
    // R1 --- R2 (Successor): RD=0, CD=10000
    // R1 --- R3 (Feasible Successor): RD=5000, CD=15000
    // RD (5000) < FD (10000) => FC met

    const r1 = {
      id: 'r1',
      routingProtocol: 'eigrp',
      eigrpAs: '100',
      ports: {
        'gi0/0': { id: 'gi0/0', ipAddress: '10.0.0.1', subnetMask: '255.255.255.252', type: 'gigabitethernet' },
        'gi0/1': { id: 'gi0/1', ipAddress: '10.0.0.5', subnetMask: '255.255.255.252', type: 'gigabitethernet' }
      }
    } as unknown as SwitchState;

    const r2 = {
      id: 'r2',
      routingProtocol: 'eigrp',
      eigrpAs: '100',
      ports: {
        'gi0/0': { id: 'gi0/0', ipAddress: '10.0.0.2', subnetMask: '255.255.255.252', type: 'gigabitethernet' }
      },
      dynamicRoutes: [
        { destination: '192.168.1.0', subnetMask: '255.255.255.0', type: 'dynamic', metric: 5000 }
      ]
    } as unknown as SwitchState;

    const r3 = {
      id: 'r3',
      routingProtocol: 'eigrp',
      eigrpAs: '100',
      ports: {
        'gi0/1': { id: 'gi0/1', ipAddress: '10.0.0.6', subnetMask: '255.255.255.252', type: 'gigabitethernet' }
      },
      dynamicRoutes: [
        { destination: '192.168.1.0', subnetMask: '255.255.255.0', type: 'dynamic', metric: 5000 }
      ]
    } as unknown as SwitchState;

    // We want to control CD.
    // CD = metric(Link) + RD
    // Let's use custom bandwidth/delay on R1 ports to control link metrics
    r1.ports['gi0/0'].bandwidth = 1000000; // 10^7/10^6 = 10
    r1.ports['gi0/0'].delay = 100; // 100/10 = 10
    // metric = 256 * (10 + 10) = 5120
    // RD = 5000
    // CD = 10120

    r1.ports['gi0/1'].bandwidth = 500000; // 10^7/5*10^5 = 20
    r1.ports['gi0/1'].delay = 200; // 200/10 = 20
    // metric = 256 * (20 + 20) = 10240
    // RD = 5000
    // CD = 15240

    deviceStates.set('r1', r1);
    deviceStates.set('r2', r2);
    deviceStates.set('r3', r3);

    const table = buildEigrpTopologyTable('r1', deviceStates);
    const converged = runEigrpDual(table);

    const entries = converged.filter(e => e.destination === '192.168.1.0');
    expect(entries.length).toBe(2);

    const successor = entries.find(e => e.neighborId === 'r2');
    const feasibleSuccessor = entries.find(e => e.neighborId === 'r3');

    expect(successor?.isSuccessor).toBe(true);
    expect(feasibleSuccessor?.isSuccessor).toBe(false);

    // RD(R3)=5000 < FD(10120)
    expect(feasibleSuccessor?.reportedDistance).toBe(5000);
    expect(successor?.computedDistance).toBe(10120);
    expect(feasibleSuccessor?.isFeasibleSuccessor).toBe(true);
  });

  it('should NOT select a Feasible Successor when Feasibility Condition is rejected (RD >= FD)', () => {
    // Topology: R1 connected to R2 and R3.
    // R1 --- R2 (Successor): RD=1000, CD=6120
    // R1 --- R3 (Not FS): RD=8000, CD=18240
    // RD (8000) >= FD (6120) => FC rejected

    const r1 = {
      id: 'r1',
      routingProtocol: 'eigrp',
      eigrpAs: '100',
      ports: {
        'gi0/0': { id: 'gi0/0', ipAddress: '10.0.0.1', subnetMask: '255.255.255.252', type: 'gigabitethernet' },
        'gi0/1': { id: 'gi0/1', ipAddress: '10.0.0.5', subnetMask: '255.255.255.252', type: 'gigabitethernet' }
      }
    } as unknown as SwitchState;

    const r2 = {
      id: 'r2',
      routingProtocol: 'eigrp',
      eigrpAs: '100',
      ports: {
        'gi0/0': { id: 'gi0/0', ipAddress: '10.0.0.2', subnetMask: '255.255.255.252', type: 'gigabitethernet' }
      },
      dynamicRoutes: [
        { destination: '192.168.1.0', subnetMask: '255.255.255.0', type: 'dynamic', metric: 1000 }
      ]
    } as unknown as SwitchState;

    const r3 = {
      id: 'r3',
      routingProtocol: 'eigrp',
      eigrpAs: '100',
      ports: {
        'gi0/1': { id: 'gi0/1', ipAddress: '10.0.0.6', subnetMask: '255.255.255.252', type: 'gigabitethernet' }
      },
      dynamicRoutes: [
        { destination: '192.168.1.0', subnetMask: '255.255.255.0', type: 'dynamic', metric: 8000 }
      ]
    } as unknown as SwitchState;

    r1.ports['gi0/0'].bandwidth = 1000000;
    r1.ports['gi0/0'].delay = 100;
    // metric = 256 * (10 + 10) = 5120
    // RD = 1000
    // CD = 6120 (FD)

    r1.ports['gi0/1'].bandwidth = 500000;
    r1.ports['gi0/1'].delay = 200;
    // metric = 256 * (20 + 20) = 10240
    // RD = 8000
    // CD = 18240

    deviceStates.set('r1', r1);
    deviceStates.set('r2', r2);
    deviceStates.set('r3', r3);

    const table = buildEigrpTopologyTable('r1', deviceStates);
    const converged = runEigrpDual(table);

    const entries = converged.filter(e => e.destination === '192.168.1.0');
    const successor = entries.find(e => e.neighborId === 'r2');
    const rejectedFs = entries.find(e => e.neighborId === 'r3');

    expect(successor?.isSuccessor).toBe(true);
    expect(rejectedFs?.reportedDistance).toBe(8000);
    expect(successor?.computedDistance).toBe(6120);

    // RD(8000) > FD(6120), so it should NOT be FS
    expect(rejectedFs?.isFeasibleSuccessor).toBe(false);
  });

  it('should build IPv6 EIGRP topology table and compute IPv6 DUAL routes', () => {
    const r1 = {
      id: 'r1',
      eigrp6Config: { as: '100', shutdown: false },
      ports: {
        'gi0/0': {
          id: 'gi0/0',
          ipv6Address: '2001:db8:1::1/64',
          ipv6LinkLocal: 'fe80::1',
          type: 'gigabitethernet',
          ipv6Eigrp: { enabled: true, as: '100' }
        }
      }
    } as unknown as SwitchState;

    const r2 = {
      id: 'r2',
      eigrp6Config: { as: '100', shutdown: false },
      ports: {
        'gi0/0': {
          id: 'gi0/0',
          ipv6Address: '2001:db8:1::2/64',
          ipv6LinkLocal: 'fe80::2',
          type: 'gigabitethernet',
          ipv6Eigrp: { enabled: true, as: '100' }
        },
        'gi0/1': {
          id: 'gi0/1',
          ipv6Address: '2001:db8:2::1/64',
          ipv6LinkLocal: 'fe80::2',
          type: 'gigabitethernet',
          ipv6Eigrp: { enabled: true, as: '100' }
        }
      }
    } as unknown as SwitchState;

    deviceStates.set('r1', r1);
    deviceStates.set('r2', r2);

    const topoTable = buildEigrp6TopologyTable('r1', deviceStates);

    expect(topoTable.length).toBeGreaterThan(0);

    const routes = calculateEigrp6Routes('r1', deviceStates);
    expect(routes.some((r: { destination: string }) => r.destination === '2001:db8:2::1')).toBe(true);
  });

  it('should countdown holdTimer and trigger HoldExpired transition when holdTimer reaches 0', () => {
    const nbrRecord = {
      neighborIp: '10.0.0.2',
      interfaceId: 'gi0/0',
      asNumber: 100,
      state: 'Up' as const,
      holdTime: 15,
      holdTimer: 15,
      kValues: [1, 0, 1, 0, 0] as [number, number, number, number, number],
      srtt: 10,
      rto: 200,
      seqNumber: 1,
      lastHelloAt: Date.now(),
    };

    // Tick 5 seconds -> holdTimer becomes 10
    const tick1 = eigrpTickHoldTimer(nbrRecord, 5, Date.now());
    expect(tick1.nextNeighbor.holdTimer).toBe(10);
    expect(tick1.neighborLost).toBe(false);

    // Tick 10 seconds -> holdTimer becomes 0 and triggers HoldExpired
    const tick2 = eigrpTickHoldTimer(tick1.nextNeighbor, 10, Date.now());
    expect(tick2.nextNeighbor.holdTimer).toBe(0);
    expect(tick2.nextNeighbor.state).toBe('Down');
    expect(tick2.neighborLost).toBe(true);
  });
});

