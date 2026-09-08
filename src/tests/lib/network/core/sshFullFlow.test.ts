import { describe, it, expect } from 'vitest';
import { executeCommand } from '@/lib/network/executor';
import { createInitialState } from '@/lib/network/initialState';
import type { SwitchState } from '@/lib/network/types';

function run(state: SwitchState, input: string, mode: SwitchState['currentMode'] = 'config'): SwitchState {
  const result = executeCommand({ ...state, currentMode: mode }, input, 'en');
  expect(result.success, `command failed: ${input} -> ${result.error ?? ''}`).toBe(true);
  return { ...state, ...result.newState } as SwitchState;
}

describe('SSH Full Flow (crypto key -> ip ssh version -> line vty -> login local -> transport input ssh)', () => {
  it('produces a device state that allows a simulated SSH connection', () => {
    let state: SwitchState = {
      ...createInitialState(),
      currentMode: 'config',
      hostname: 'R1',
      domainName: 'lab.local',
    } as SwitchState;

    state = run(state, 'crypto key generate rsa modulus 2048');
    state = run(state, 'ip ssh version 2');
    state = run(state, 'username admin privilege 15 secret 1234');
    // enter line mode
    state = run(state, 'line vty 0 4', 'config');
    expect(state.currentMode).toBe('line');
    state = run(state, 'login local', 'line');
    state = run(state, 'transport input ssh', 'line');

    // Device-side requirements for a successful simulated SSH session
    expect(state.rsaKeys?.modulus).toBe(2048);
    expect(state.sshVersion).toBe(2);
    expect(state.security?.vtyLines?.loginLocal).toBe(true);
    expect(state.security?.vtyLines?.transportInput).toContain('ssh');
    const users = state.security?.users;
    type LocalUser = { username: string; password: string; privilege: number };
    const userList: LocalUser[] = Array.isArray(users)
      ? (users as LocalUser[])
      : (Object.values(users ?? {}) as LocalUser[]);
    expect(userList.some((u) => u.username === 'admin' && u.password === '1234')).toBe(true);
  });

  it('reflects the configuration in show ip ssh', () => {
    let state: SwitchState = {
      ...createInitialState(),
      currentMode: 'config',
      hostname: 'R1',
      domainName: 'lab.local',
    } as SwitchState;
    state = run(state, 'crypto key generate rsa modulus 2048');
    state = run(state, 'ip ssh version 2');

    const result = executeCommand({ ...state, currentMode: 'privileged' }, 'show ip ssh', 'en');
    expect(result.success).toBe(true);
    expect(result.output).toContain('SSH');
  });
});

describe('show ip interface brief formatting', () => {
  it('displays IP interface brief standard output for configured interfaces', () => {
    const state = {
      ...createInitialState(),
      currentMode: 'privileged',
      ports: {
        'gi0/0': {
          id: 'gi0/0',
          name: 'gi0/0',
          type: 'gigabitethernet',
          ipAddress: '192.168.1.150',
          subnetMask: '255.255.255.0',
          shutdown: false,
        } as unknown as SwitchState['ports']['gi0/0'],
      },
    } as SwitchState;

    const result = executeCommand({ ...state, currentMode: 'privileged' }, 'show ip interface brief', 'en');
    expect(result.success).toBe(true);
    expect(result.output).toContain('192.168.1.150');
    expect(result.output).toContain('Interface              IP-Address');
    expect(result.output).toContain('manual');
    expect(result.output).toContain('up');
  });
});
