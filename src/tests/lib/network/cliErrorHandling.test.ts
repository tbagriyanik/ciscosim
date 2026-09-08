import { describe, it, expect, vi } from 'vitest';
import { parseCommand, validateCommand } from '@/lib/network/parser';

vi.mock('@/lib/network/capabilities', () => ({
  getDeviceCapabilities: vi.fn(() => undefined),
}));

describe('Cisco CLI Error Handling (Invalid / Incomplete / Ambiguous)', () => {
  const privilegedState = {
    switchModel: 'WS-C2960-24TT-L' as const,
    switchLayer: 'L2' as const,
    isLayer3Switch: false,
    currentMode: 'privileged' as const,
  };

  const configState = {
    switchModel: 'WS-C2960-24TT-L' as const,
    switchLayer: 'L2' as const,
    isLayer3Switch: false,
    currentMode: 'config' as const,
  };

  function validate(cmd: string, mode: 'privileged' | 'config' | 'user') {
    const state = mode === 'config' ? configState : privilegedState;
    const parsed = parseCommand(cmd, mode, state);
    expect(parsed).not.toBeNull();
    return validateCommand(parsed!, mode, state);
  }

  it('flags "co" as ambiguous (configure/copy/connect) with the caret-free Cisco message', () => {
    const res = validate('co', 'privileged');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('ambiguous');
    expect(res.error).toContain('Ambiguous command');
    expect(res.error).toContain('"co"');
  });

  it('flags "cl" as ambiguous (clear/clock) instead of incomplete', () => {
    const res = validate('cl', 'privileged');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('ambiguous');
    expect(res.error).toContain('"cl"');
  });

  it('flags "e" as ambiguous (enable/exit) and "s" as ambiguous (setup/show)', () => {
    expect(validate('e', 'privileged').reason).toBe('ambiguous');
    expect(validate('s', 'privileged').reason).toBe('ambiguous');
  });

  it('flags an ambiguous keyword in the middle of a command (ip ro -> route/routing)', () => {
    const res = validate('ip ro', 'config');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('ambiguous');
    expect(res.error).toContain('"ro"');
  });

  it('flags an ambiguous parameter keyword (spanning-tree m)', () => {
    const res = validate('spanning-tree m', 'config');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('ambiguous');
    expect(res.error).toContain('"m"');
  });

  it('reports "show ip" as an incomplete command', () => {
    const res = validate('show ip', 'privileged');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('incomplete');
    expect(res.error).toBe('% Incomplete command.');
  });

  it('reports "interface" in config as an incomplete command', () => {
    const res = validate('interface', 'config');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('incomplete');
  });

  it('reports bare "no" in config as incomplete', () => {
    const res = validate('no', 'config');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('incomplete');
  });

  it('reports an invalid trailing token with a caret pointing at the failing word', () => {
    const res = validate('show ip route 1.2.3.4 extraarg', 'privileged');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('unknown-command');
    expect(res.error).toContain('Invalid input detected');
    const [, caretLine] = res.error!.split('\n');
    expect(caretLine).toMatch(/^\s*\^/);
    // The invalid command prints the input line followed by a caret marker
    const caretPos = caretLine!.indexOf('^');
    expect(caretPos).toBeGreaterThan(0);
    expect(caretPos).toBeLessThan(25);
  });

  it('still accepts valid and abbreviated commands', () => {
    expect(validate('show ip route', 'privileged').valid).toBe(true);
    expect(validate('show running-config', 'privileged').valid).toBe(true);
    expect(validate('sh ip ro', 'privileged').valid).toBe(true);
    expect(validate('conf t', 'privileged').valid).toBe(true);
    expect(validate('exit', 'privileged').valid).toBe(true);
  });
});