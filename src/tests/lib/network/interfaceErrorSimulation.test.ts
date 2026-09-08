import { describe, it, expect } from 'vitest';
import type { Port } from '@/lib/network/types';

export class InterfaceErrorSimulator {
  public static simulateCrcCheck(port: Port, frameCrcValid: boolean): boolean {
    if (!port.statistics) {
      port.statistics = { inputPackets: 0, outputPackets: 0, crcErrors: 0, inputErrors: 0, drops: 0 };
    }

    port.statistics.inputPackets = (port.statistics.inputPackets || 0) + 1;

    if (!frameCrcValid) {
      port.statistics.crcErrors = (port.statistics.crcErrors || 0) + 1;
      port.statistics.inputErrors = (port.statistics.inputErrors || 0) + 1;
      port.statistics.drops = (port.statistics.drops || 0) + 1;
      return false; // Drop packet
    }

    return true;
  }

  public static checkDuplexMismatch(localPort: Port, remotePort: Port): boolean {
    if (
      localPort.duplex !== 'auto' &&
      remotePort.duplex !== 'auto' &&
      localPort.duplex !== remotePort.duplex
    ) {
      if (!localPort.statistics) localPort.statistics = {};
      if (!remotePort.statistics) remotePort.statistics = {};

      // Late collisions and collisions occur on half-duplex side during duplex mismatch
      if (localPort.duplex === 'half') {
        localPort.statistics.collisions = (localPort.statistics.collisions || 0) + 1;
        localPort.statistics.inputErrors = (localPort.statistics.inputErrors || 0) + 1;
      }
      if (remotePort.duplex === 'half') {
        remotePort.statistics.collisions = (remotePort.statistics.collisions || 0) + 1;
        remotePort.statistics.inputErrors = (remotePort.statistics.inputErrors || 0) + 1;
      }
      return true; // Mismatch detected
    }
    return false;
  }

  public static validateFrameSize(port: Port, frameSizeBytes: number): boolean {
    if (!port.statistics) port.statistics = {};

    if (frameSizeBytes < 64) {
      port.statistics.runts = (port.statistics.runts || 0) + 1;
      port.statistics.inputErrors = (port.statistics.inputErrors || 0) + 1;
      port.statistics.drops = (port.statistics.drops || 0) + 1;
      return false;
    }

    const mtu = port.mtu || 1500;
    if (frameSizeBytes > mtu + 18) { // 14 byte Ethernet header + 4 byte FCS
      port.statistics.giants = (port.statistics.giants || 0) + 1;
      port.statistics.inputErrors = (port.statistics.inputErrors || 0) + 1;
      port.statistics.drops = (port.statistics.drops || 0) + 1;
      return false;
    }

    return true;
  }
}

describe('Feature 9: Interface Error Simulation', () => {
  const createMockPort = (overrides?: Partial<Port>): Port => ({
    id: 'gi0/0',
    name: 'GigabitEthernet0/0',
    status: 'connected',
    vlan: 1,
    mode: 'routed',
    duplex: 'full',
    speed: '1000',
    shutdown: false,
    type: 'gigabitethernet',
    mtu: 1500,
    statistics: {
      inputPackets: 0,
      outputPackets: 0,
      crcErrors: 0,
      inputErrors: 0,
      drops: 0,
      collisions: 0,
      runts: 0,
      giants: 0,
    },
    ...overrides,
  });

  it('increments crcErrors, inputErrors, and drops when receiving bad CRC frame', () => {
    const port = createMockPort();
    const passed = InterfaceErrorSimulator.simulateCrcCheck(port, false);

    expect(passed).toBe(false);
    expect(port.statistics?.crcErrors).toBe(1);
    expect(port.statistics?.inputErrors).toBe(1);
    expect(port.statistics?.drops).toBe(1);
  });

  it('detects duplex mismatch between full and half duplex ports and increments collisions on half-duplex side', () => {
    const localPort = createMockPort({ duplex: 'full' });
    const remotePort = createMockPort({ duplex: 'half' });

    const mismatch = InterfaceErrorSimulator.checkDuplexMismatch(localPort, remotePort);

    expect(mismatch).toBe(true);
    expect(localPort.statistics?.collisions).toBe(0);
    expect(remotePort.statistics?.collisions).toBe(1);
    expect(remotePort.statistics?.inputErrors).toBe(1);
  });

  it('flags runt frames (< 64 bytes) and increments runt counters', () => {
    const port = createMockPort();
    const valid = InterfaceErrorSimulator.validateFrameSize(port, 48);

    expect(valid).toBe(false);
    expect(port.statistics?.runts).toBe(1);
    expect(port.statistics?.inputErrors).toBe(1);
    expect(port.statistics?.drops).toBe(1);
  });

  it('flags giant frames (> MTU + header) and increments giant counters', () => {
    const port = createMockPort({ mtu: 1500 });
    const valid = InterfaceErrorSimulator.validateFrameSize(port, 1550);

    expect(valid).toBe(false);
    expect(port.statistics?.giants).toBe(1);
    expect(port.statistics?.inputErrors).toBe(1);
    expect(port.statistics?.drops).toBe(1);
  });
});
