import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sanitizeInput, sanitizeObject, safeParseJSON, validateIPAddress } from '../sanitizer';

describe('Security input validation - Property Tests', () => {
  it('sanitizes script-like input without introducing unsafe characters', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const sanitized = sanitizeInput(value);
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).not.toMatch(/javascript:/i);
      })
    );
  });

  it('sanitizes nested objects recursively', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string(),
          nested: fc.record({ payload: fc.string() }),
        }),
        (value) => {
          const sanitized = sanitizeObject(value);
          expect(sanitized.name).toBe(sanitizeInput(value.name));
          expect(sanitized.nested.payload).toBe(sanitizeInput(value.nested.payload));
        }
      )
    );
  });

  it('parses invalid json safely with fallback', () => {
    fc.assert(
      fc.property(
        fc.string().filter(value => {
          try {
            JSON.parse(value);
            return false;
          } catch {
            return true;
          }
        }),
        (value) => {
        const fallback = { ok: true };
        const parsed = safeParseJSON(value, fallback);
        expect(parsed).toEqual(fallback);
      })
    );
  });

  it('keeps valid IP validation stable', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 })),
        ([a, b, c, d]) => {
          expect(validateIPAddress(`${a}.${b}.${c}.${d}`)).toBe(true);
        }
      )
    );
  });
});
