import { describe, it, expect } from 'vitest';

export type FirewallTcpState = 'SYN_SENT' | 'SYN_RCVD' | 'ESTABLISHED' | 'FIN_WAIT' | 'CLOSED';

export interface FirewallSession {
  sessionId: string;
  protocol: 'TCP' | 'UDP' | 'ICMP';
  srcIp: string;
  dstIp: string;
  srcPort: number;
  dstPort: number;
  state: FirewallTcpState | 'ACTIVE';
  lastSeenMs: number;
  timeoutMs: number;
}

export class StatefulFirewallEngine {
  private sessionTable: Map<string, FirewallSession> = new Map();
  public tcpEstablishedTimeoutMs = 3600000; // 1 hour
  public tcpSynTimeoutMs = 120000;         // 2 min
  public udpTimeoutMs = 300000;            // 5 min

  private buildKey(protocol: string, srcIp: string, srcPort: number, dstIp: string, dstPort: number): string {
    return `${protocol}:${srcIp}:${srcPort}->${dstIp}:${dstPort}`;
  }

  private buildReverseKey(protocol: string, srcIp: string, srcPort: number, dstIp: string, dstPort: number): string {
    return `${protocol}:${dstIp}:${dstPort}->${srcIp}:${srcPort}`;
  }

  public inspectPacket(
    protocol: 'TCP' | 'UDP' | 'ICMP',
    srcIp: string,
    srcPort: number,
    dstIp: string,
    dstPort: number,
    tcpFlags: { syn?: boolean; ack?: boolean; fin?: boolean; rst?: boolean } = {},
    now: number,
    isOutbound: boolean
  ): { permitted: boolean; sessionCreated?: boolean; state?: string } {
    const forwardKey = this.buildKey(protocol, srcIp, srcPort, dstIp, dstPort);
    const reverseKey = this.buildReverseKey(protocol, srcIp, srcPort, dstIp, dstPort);

    const existingSession = this.sessionTable.get(forwardKey) || this.sessionTable.get(reverseKey);

    if (existingSession) {
      existingSession.lastSeenMs = now;

      if (protocol === 'TCP') {
        if (tcpFlags.fin || tcpFlags.rst) {
          existingSession.state = 'CLOSED';
          this.sessionTable.delete(existingSession.sessionId);
          return { permitted: true, state: 'CLOSED' };
        }
        if (tcpFlags.syn && tcpFlags.ack && existingSession.state === 'SYN_SENT') {
          existingSession.state = 'ESTABLISHED';
          existingSession.timeoutMs = this.tcpEstablishedTimeoutMs;
          return { permitted: true, state: 'ESTABLISHED' };
        }
        if (tcpFlags.ack && existingSession.state === 'SYN_RCVD') {
          existingSession.state = 'ESTABLISHED';
          existingSession.timeoutMs = this.tcpEstablishedTimeoutMs;
          return { permitted: true, state: 'ESTABLISHED' };
        }
      }

      return { permitted: true, state: existingSession.state };
    }

    if (!isOutbound) {
      return { permitted: false };
    }

    if (protocol === 'TCP' && !tcpFlags.syn) {
      return { permitted: false };
    }

    const newSession: FirewallSession = {
      sessionId: forwardKey,
      protocol,
      srcIp,
      dstIp,
      srcPort,
      dstPort,
      state: protocol === 'TCP' ? 'SYN_SENT' : 'ACTIVE',
      lastSeenMs: now,
      timeoutMs: protocol === 'TCP' ? this.tcpSynTimeoutMs : this.udpTimeoutMs,
    };

    this.sessionTable.set(forwardKey, newSession);
    return { permitted: true, sessionCreated: true, state: newSession.state };
  }

  public purgeExpiredSessions(now: number): number {
    let expired = 0;
    for (const [key, session] of this.sessionTable.entries()) {
      if (now - session.lastSeenMs >= session.timeoutMs) {
        this.sessionTable.delete(key);
        expired++;
      }
    }
    return expired;
  }

  public get ActiveSessionCount(): number {
    return this.sessionTable.size;
  }
}

describe('Feature 7: Firewall Stateful Session Lifecycle', () => {
  it('allows initial outbound TCP SYN packet and initializes stateful session', () => {
    const fw = new StatefulFirewallEngine();
    const res = fw.inspectPacket('TCP', '10.0.0.5', 49152, '1.1.1.1', 80, { syn: true }, 1000, true);

    expect(res.permitted).toBe(true);
    expect(res.sessionCreated).toBe(true);
    expect(res.state).toBe('SYN_SENT');
    expect(fw.ActiveSessionCount).toBe(1);
  });

  it('blocks inbound TCP SYN-ACK if no prior outbound session exists', () => {
    const fw = new StatefulFirewallEngine();
    const res = fw.inspectPacket('TCP', '1.1.1.1', 80, '10.0.0.5', 49152, { syn: true, ack: true }, 1000, false);

    expect(res.permitted).toBe(false);
    expect(fw.ActiveSessionCount).toBe(0);
  });

  it('transitions state to ESTABLISHED upon receiving inbound SYN-ACK reply for outbound session', () => {
    const fw = new StatefulFirewallEngine();
    fw.inspectPacket('TCP', '10.0.0.5', 49152, '1.1.1.1', 80, { syn: true }, 1000, true);

    const resReply = fw.inspectPacket('TCP', '1.1.1.1', 80, '10.0.0.5', 49152, { syn: true, ack: true }, 1050, false);
    expect(resReply.permitted).toBe(true);
    expect(resReply.state).toBe('ESTABLISHED');
  });

  it('terminates session immediately upon FIN/RST packet', () => {
    const fw = new StatefulFirewallEngine();
    fw.inspectPacket('TCP', '10.0.0.5', 49152, '1.1.1.1', 80, { syn: true }, 1000, true);
    fw.inspectPacket('TCP', '1.1.1.1', 80, '10.0.0.5', 49152, { syn: true, ack: true }, 1050, false);

    const resFin = fw.inspectPacket('TCP', '10.0.0.5', 49152, '1.1.1.1', 80, { fin: true, ack: true }, 2000, true);
    expect(resFin.permitted).toBe(true);
    expect(resFin.state).toBe('CLOSED');
    expect(fw.ActiveSessionCount).toBe(0);
  });

  it('purges idle sessions after timeout expiry', () => {
    const fw = new StatefulFirewallEngine();
    fw.udpTimeoutMs = 300000; // 5 min
    fw.inspectPacket('UDP', '10.0.0.5', 5000, '8.8.8.8', 53, {}, 1000, true);

    expect(fw.ActiveSessionCount).toBe(1);

    const purged = fw.purgeExpiredSessions(1000 + 300001);
    expect(purged).toBe(1);
    expect(fw.ActiveSessionCount).toBe(0);
  });
});
