import { describe, it, expect } from 'vitest';
import {
  lacpPortTransition,
  lacpTickTimer,
  type LacpPortRecord,
} from '@/lib/network/protocols/protocolStateMachines';

describe('Feature 5: LACP Failure / Recovery Real-Time Tests', () => {
  const createBaseLacpPort = (): LacpPortRecord => ({
    portId: 'Fa0/1',
    channelGroupId: 1,
    actorKey: 1,
    actorPriority: 32768,
    actorSystemId: '0000.0000.0001',
    actorState: 0x3d, // Active, Fast, Aggregatable, Sync, Collecting, Distributing
    state: 'Detached',
    lacpduTimer: 0,
    lacpduTimeout: 3, // Fast rate 3s
    isActive: true,
  });

  it('transitions Detached → Waiting → Attached upon receiving valid LACPDU with matching key', () => {
    let port = createBaseLacpPort();
    const partner = { key: 1, priority: 32768, systemId: '0000.0000.0002', state: 0x3d };

    let res = lacpPortTransition(port, 'LacpduReceived', partner);
    expect(res.nextPort.state).toBe('Waiting');
    expect(res.nextPort.partnerSystemId).toBe('0000.0000.0002');
    port = res.nextPort;

    res = lacpPortTransition(port, 'LacpduReceived', partner);
    expect(res.nextPort.state).toBe('Attached');
  });

  it('transitions Attached → Collecting → Distributing when Selected for bundle', () => {
    let port: LacpPortRecord = { ...createBaseLacpPort(), state: 'Attached' };

    let res = lacpPortTransition(port, 'Selected');
    expect(res.nextPort.state).toBe('Collecting');
    expect(res.inBundle).toBe(false);
    port = res.nextPort;

    res = lacpPortTransition(port, 'Selected');
    expect(res.nextPort.state).toBe('Distributing');
    expect(res.inBundle).toBe(true);
  });

  it('triggers LacpduTimeout when timer exceeds timeout threshold', () => {
    const port: LacpPortRecord = {
      ...createBaseLacpPort(),
      state: 'Distributing',
      lacpduTimer: 2.5,
      lacpduTimeout: 3,
    };

    const res = lacpTickTimer(port, 1.0); // 2.5 + 1 = 3.5s >= 3s
    expect(res.nextPort.state).toBe('Expired');
    expect(res.inBundle).toBe(false);
    expect(res.logMessage).toContain('Expired');
  });

  it('handles PortDisabled or PortMoved by detaching port and resetting partner details', () => {
    const port: LacpPortRecord = {
      ...createBaseLacpPort(),
      state: 'Distributing',
      partnerKey: 1,
      partnerSystemId: '0000.0000.0002',
    };

    const resDisabled = lacpPortTransition(port, 'PortDisabled');
    expect(resDisabled.nextPort.state).toBe('Detached');
    expect(resDisabled.inBundle).toBe(false);
    expect(resDisabled.nextPort.partnerKey).toBeUndefined();

    const resMoved = lacpPortTransition(port, 'PortMoved');
    expect(resMoved.nextPort.state).toBe('Detached');
    expect(resMoved.inBundle).toBe(false);
  });

  it('recovers from Expired/Detached state upon new LACPDU reception', () => {
    const port: LacpPortRecord = { ...createBaseLacpPort(), state: 'Expired' };
    const partner = { key: 1, priority: 32768, systemId: '0000.0000.0002', state: 0x3d };

    const res = lacpPortTransition(port, 'LacpduReceived', partner);
    expect(res.nextPort.lacpduTimer).toBe(0);
    expect(res.nextPort.partnerSystemId).toBe('0000.0000.0002');
  });
});
