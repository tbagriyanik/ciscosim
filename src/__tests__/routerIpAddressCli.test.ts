import { describe, it, expect } from 'vitest';
import { createInitialRouterState } from '@/lib/network/initialState';
import { executeCommand } from '@/lib/network/executor';

describe('Router CLI ip address command', () => {
  it('accepts dotted subnet mask format', () => {
    let state = createInitialRouterState();

    const toPriv = executeCommand(state, 'enable', 'en');
    state = { ...state, ...(toPriv.newState || {}) };
    const toConfig = executeCommand(state, 'configure terminal', 'en');
    state = { ...state, ...(toConfig.newState || {}) };
    const toInt = executeCommand(state, 'interface gi0/0', 'en');
    state = { ...state, ...(toInt.newState || {}) };

    const result = executeCommand(state, 'ip address 10.10.10.1 255.255.255.0', 'en');
    const merged = { ...state, ...(result.newState || {}) };

    expect(result.success).toBe(true);
    expect(merged.ports['gi0/0']?.ipAddress).toBe('10.10.10.1');
    expect(merged.ports['gi0/0']?.subnetMask).toBe('255.255.255.0');
  });

  it('accepts CIDR prefix format', () => {
    let state = createInitialRouterState();

    const toPriv = executeCommand(state, 'enable', 'en');
    state = { ...state, ...(toPriv.newState || {}) };
    const toConfig = executeCommand(state, 'configure terminal', 'en');
    state = { ...state, ...(toConfig.newState || {}) };
    const toInt = executeCommand(state, 'interface gi0/1', 'en');
    state = { ...state, ...(toInt.newState || {}) };

    const result = executeCommand(state, 'ip address 192.168.50.1/24', 'en');
    const merged = { ...state, ...(result.newState || {}) };

    expect(result.success).toBe(true);
    expect(merged.ports['gi0/1']?.ipAddress).toBe('192.168.50.1');
    expect(merged.ports['gi0/1']?.subnetMask).toBe('255.255.255.0');
  });
});
