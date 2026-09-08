import { describe, it, expect } from 'vitest';
import { parseCommand, validateCommand } from '@/lib/network/parser';
import { IOS_ERRORS } from '@/lib/network/core/iosErrors';

describe('CLI Error Messages Completeness & Caret Accuracy', () => {
  it('detects invalid input with ^ marker for unrecognized command', () => {
    const parsed = parseCommand('invalidcommand123', 'privileged');
    expect(parsed).not.toBeNull();
    const res = validateCommand(parsed!, 'privileged');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('unknown-command');
    expect(res.error).toContain(IOS_ERRORS.invalidInput);
    expect(res.error).toContain('^');
  });

  it('detects incomplete command when minimum arguments are missing', () => {
    // 'show' alone in privileged mode is incomplete or requires subcommands
    const parsedIp = parseCommand('ip route', 'config');
    expect(parsedIp).not.toBeNull();
    const res = validateCommand(parsedIp!, 'config');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('incomplete');
    expect(res.error).toContain(IOS_ERRORS.incomplete);
  });

  it('detects ambiguous command when prefix matches multiple candidates', () => {
    const parsed = parseCommand('co', 'privileged');
    expect(parsed).not.toBeNull();
    const res = validateCommand(parsed!, 'privileged');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('ambiguous');
    expect(res.error).toContain(IOS_ERRORS.ambiguous);
    expect(res.error).toContain('co');
  });
});
