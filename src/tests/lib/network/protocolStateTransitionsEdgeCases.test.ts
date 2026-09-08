import { describe, it, expect } from 'vitest';
import {
  ospfNeighborTransition,
  ospfTickDeadTimer,
  eigrpNeighborTransition,
  eigrpTickHoldTimer,
  type OspfNeighborRecord,
  type EigrpNeighborRecord,
} from '@/lib/network/protocols/protocolStateMachines';

describe('Feature 4: OSPF & EIGRP Real State-Transition Edge Cases', () => {
  describe('OSPF State Machine Edge Cases', () => {
    const createBaseOspfRecord = (): OspfNeighborRecord => ({
      neighborId: '2.2.2.2',
      neighborIp: '10.0.0.2',
      interfaceId: 'gi0/0',
      areaId: '0',
      state: 'Down',
      priority: 1,
      deadTimer: 40,
      helloInterval: 10,
      deadInterval: 40,
      lastHelloAt: Date.now(),
    });

    it('transitions from Down to Init upon receiving Hello packet', () => {
      const initial = createBaseOspfRecord();
      const res = ospfNeighborTransition(initial, 'HelloReceived', Date.now(), '1.1.1.1');
      expect(res.nextState.state).toBe('Init');
      expect(res.nextState.deadTimer).toBe(40);
      expect(res.events).toContainEqual(expect.objectContaining({ type: 'LogEvent' }));
    });

    it('transitions from Init to ExStart upon 2-WayReceived event and generates DD packet', () => {
      const initial: OspfNeighborRecord = { ...createBaseOspfRecord(), state: 'Init' };
      const res = ospfNeighborTransition(initial, '2-WayReceived', Date.now(), '1.1.1.1');
      expect(res.nextState.state).toBe('ExStart');
      expect(res.nextState.ddSeq).toBeDefined();
      expect(res.events).toContainEqual(expect.objectContaining({ type: 'SendDD' }));
    });

    it('handles NegotiationDone and ExchangeDone to transition to Full state', () => {
      let current: OspfNeighborRecord = { ...createBaseOspfRecord(), state: 'ExStart', lsaCount: 0 };
      
      let res = ospfNeighborTransition(current, 'NegotiationDone', Date.now(), '1.1.1.1');
      expect(res.nextState.state).toBe('Exchange');
      current = res.nextState;

      res = ospfNeighborTransition(current, 'ExchangeDone', Date.now(), '1.1.1.1');
      expect(res.nextState.state).toBe('Full');
      expect(res.events).toContainEqual(expect.objectContaining({ type: 'RouteUpdate', removed: false }));
    });

    it('transitions to Loading state when ExchangeDone has outstanding LSAs', () => {
      const current: OspfNeighborRecord = { ...createBaseOspfRecord(), state: 'Exchange', lsaCount: 3 };
      const res = ospfNeighborTransition(current, 'ExchangeDone', Date.now(), '1.1.1.1');
      expect(res.nextState.state).toBe('Loading');
      expect(res.events).toContainEqual(expect.objectContaining({ type: 'SendLsRequest' }));

      const loadDoneRes = ospfNeighborTransition(res.nextState, 'LoadingDone', Date.now(), '1.1.1.1');
      expect(loadDoneRes.nextState.state).toBe('Full');
    });

    it('resets to ExStart on SeqNumberMismatch or BadLSReq', () => {
      const current: OspfNeighborRecord = { ...createBaseOspfRecord(), state: 'Full', ddSeq: 100 };
      const res = ospfNeighborTransition(current, 'SeqNumberMismatch', Date.now(), '1.1.1.1');
      expect(res.nextState.state).toBe('ExStart');
      expect(res.nextState.ddSeq).toBe(101);
    });

    it('resets to Init on 1-WayReceived event', () => {
      const current: OspfNeighborRecord = { ...createBaseOspfRecord(), state: 'Full' };
      const res = ospfNeighborTransition(current, '1-WayReceived', Date.now(), '1.1.1.1');
      expect(res.nextState.state).toBe('Init');
      expect(res.events).toContainEqual(expect.objectContaining({ type: 'RouteUpdate', removed: true }));
    });

    it('expires dead timer and transitions to Down with route removal event', () => {
      const current: OspfNeighborRecord = { ...createBaseOspfRecord(), state: 'Full', deadTimer: 2 };
      const ticked = ospfTickDeadTimer(current, 2, Date.now(), '1.1.1.1');
      expect(ticked.nextState.state).toBe('Down');
      expect(ticked.nextState.deadTimer).toBe(0);
      expect(ticked.events).toContainEqual(expect.objectContaining({ type: 'RouteUpdate', removed: true }));
    });
  });

  describe('EIGRP State Machine Edge Cases', () => {
    const createBaseEigrpRecord = (): EigrpNeighborRecord => ({
      neighborIp: '192.168.1.2',
      interfaceId: 'gi0/1',
      asNumber: 100,
      state: 'Down',
      holdTime: 15,
      holdTimer: 15,
      kValues: [1, 0, 1, 0, 0],
      srtt: 10,
      rto: 200,
      seqNumber: 1,
      lastHelloAt: Date.now(),
    });

    it('transitions to Up upon receiving valid Hello with matching K-values', () => {
      const initial = createBaseEigrpRecord();
      const res = eigrpNeighborTransition(initial, 'HelloReceived', Date.now(), [1, 0, 1, 0, 0]);
      expect(res.nextNeighbor.state).toBe('Up');
      expect(res.neighborGained).toBe(true);
      expect(res.neighborLost).toBe(false);
    });

    it('drops neighbor to Down on K-value mismatch', () => {
      const initial: EigrpNeighborRecord = { ...createBaseEigrpRecord(), state: 'Up' };
      const res = eigrpNeighborTransition(initial, 'HelloReceived', Date.now(), [1, 1, 1, 0, 0]);
      expect(res.nextNeighbor.state).toBe('Down');
      expect(res.neighborLost).toBe(true);
    });

    it('drops neighbor on AS mismatch or interface down', () => {
      const initial: EigrpNeighborRecord = { ...createBaseEigrpRecord(), state: 'Up' };
      const resAs = eigrpNeighborTransition(initial, 'AsMismatch', Date.now());
      expect(resAs.nextNeighbor.state).toBe('Down');
      expect(resAs.neighborLost).toBe(true);

      const resIf = eigrpNeighborTransition(initial, 'InterfaceDown', Date.now());
      expect(resIf.nextNeighbor.state).toBe('Down');
      expect(resIf.neighborLost).toBe(true);
    });

    it('expires hold timer and sets neighbor state to Down', () => {
      const initial: EigrpNeighborRecord = { ...createBaseEigrpRecord(), state: 'Up', holdTimer: 3 };
      const ticked = eigrpTickHoldTimer(initial, 3, Date.now());
      expect(ticked.nextNeighbor.state).toBe('Down');
      expect(ticked.neighborLost).toBe(true);
    });
  });
});
