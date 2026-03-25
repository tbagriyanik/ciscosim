import { describe, it, expect } from 'vitest';
import { getAccessibleAnimationPreset } from '../animations';

describe('Accessible animation presets', () => {
  it('should return instant preset when user reduced motion is enabled', () => {
    const preset = getAccessibleAnimationPreset('fade-in', { userReducedMotion: true });
    expect(preset.opacity).toBe('1');
  });

  it('should honor system reduced motion when no user preference is set', () => {
    const preset = getAccessibleAnimationPreset('scale-in', { reducedMotion: true });
    expect(preset.opacity).toBe('1');
    expect(preset.transform).toBe('scale(1)');
  });

  it('should return animated preset when motion is allowed', () => {
    const preset = getAccessibleAnimationPreset('slide-up', { reducedMotion: false, userReducedMotion: false });
    expect(preset.animation).toContain('slideUp');
  });
});

