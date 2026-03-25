import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createAppSession, isSessionValid } from '../sessionManager';

describe('Session management - Property Tests', () => {
  it('creates valid sessions with bounded expiry', () => {
    fc.assert(
      fc.property(
        fc.record({
          language: fc.constantFrom<'tr' | 'en'>('tr', 'en'),
          theme: fc.constantFrom<'dark' | 'light'>('dark', 'light'),
          autoSave: fc.boolean(),
        }),
        (overrides) => {
          const session = createAppSession(overrides);
          expect(isSessionValid(session)).toBe(true);
          expect(session.expiresAt).toBeGreaterThan(session.createdAt);
          expect(session.language).toBe(overrides.language);
          expect(session.theme).toBe(overrides.theme);
          expect(session.autoSave).toBe(overrides.autoSave);
        }
      )
    );
  });

  it('rejects expired sessions', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), (delta) => {
        const now = Date.now();
        const session = {
          id: 'session-id',
          createdAt: now - delta,
          expiresAt: now - 1,
          language: 'tr' as const,
          theme: 'dark' as const,
          autoSave: true,
        };
        expect(isSessionValid(session)).toBe(false);
      })
    );
  });
});
