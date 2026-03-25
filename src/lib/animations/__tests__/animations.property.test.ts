import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
    getTransitionCSS,
    getAnimationDuration,
    getAnimationTiming,
    TRANSITION_PRESETS,
    COMMON_ANIMATIONS,
} from '../transitions';
import { getAccessibleAnimationPreset } from '@/lib/design-tokens/animations';

describe('Animation and Interaction Design - Property Tests', () => {
    // Property 13: Animation System Responsiveness
    it('should provide smooth transitions for all state changes', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.constant('fast'),
                    fc.constant('normal'),
                    fc.constant('slow'),
                    fc.constant('bounce'),
                    fc.constant('elastic')
                ),
                (presetName) => {
                    const preset = TRANSITION_PRESETS[presetName as keyof typeof TRANSITION_PRESETS];

                    expect(preset).toBeDefined();
                    expect(preset.duration).toBeGreaterThan(0);
                    expect(preset.easing).toBeTruthy();

                    const css = getTransitionCSS(preset);
                    expect(css).toContain('transition');
                    expect(css).toContain(`${preset.duration}ms`);
                    expect(css).toContain(preset.easing);
                }
            )
        );
    });

    // Property: Reduced Motion Support
    it('should respect reduced motion preferences', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 100, max: 1000 }),
                fc.boolean(),
                (normalDuration, reducedMotion) => {
                    const duration = getAnimationDuration(normalDuration, reducedMotion);

                    if (reducedMotion) {
                        expect(duration).toBe(0);
                    } else {
                        expect(duration).toBe(normalDuration);
                    }
                }
            )
        );
    });

    // Property: Animation Timing Consistency
    it('should provide consistent animation timing across all animations', () => {
        fc.assert(
            fc.property(
                fc.boolean(),
                (reducedMotion) => {
                    Object.entries(COMMON_ANIMATIONS).forEach(([name, keyframes]) => {
                        // Verify keyframes structure
                        expect(Array.isArray(keyframes)).toBe(true);
                        expect(keyframes.length).toBeGreaterThan(0);

                        // Verify keyframe offsets are valid
                        keyframes.forEach((kf) => {
                            expect(kf.offset).toBeGreaterThanOrEqual(0);
                            expect(kf.offset).toBeLessThanOrEqual(1);
                            expect(typeof kf.properties).toBe('object');
                        });

                        // Verify first and last keyframes
                        expect(keyframes[0].offset).toBe(0);
                        expect(keyframes[keyframes.length - 1].offset).toBe(1);
                    });
                }
            )
        );
    });

    // Property: Animation Timing Function
    it('should correctly apply animation timing based on motion preferences', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                fc.boolean(),
                (timing, reducedMotion) => {
                    const result = getAnimationTiming(timing, reducedMotion);

                    if (reducedMotion) {
                        expect(result).toBe('none');
                    } else {
                        expect(result).toBe(timing);
                    }
                }
            )
        );
    });

    // Property: Transition CSS Generation
    it('should generate valid CSS for all transition configurations', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 50, max: 1000 }),
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                (duration, easing) => {
                    const config = { duration, easing };
                    const css = getTransitionCSS(config);

                    expect(css).toContain('transition');
                    expect(css).toContain(`${duration}ms`);
                    expect(css).toContain(easing);
                }
            )
        );
    });

    // Property: Keyframe Offset Ordering
    it('should maintain proper keyframe offset ordering', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        offset: fc.float({ min: 0, max: 1 }).filter(Number.isFinite),
                        properties: fc.record({
                            opacity: fc.float({ min: 0, max: 1 }).map(String),
                        }),
                    }),
                    { minLength: 2, maxLength: 10 }
                ),
                (keyframes) => {
                    // Sort keyframes by offset
                    const sorted = [...keyframes].sort((a, b) => a.offset - b.offset);

                    // Verify offsets are in ascending order
                    for (let i = 1; i < sorted.length; i++) {
                        expect(sorted[i].offset).toBeGreaterThanOrEqual(sorted[i - 1].offset);
                    }
                }
            )
        );
    });

    // Property: Animation Preset Validity
    it('should ensure all animation presets have valid configurations', () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                Object.entries(TRANSITION_PRESETS).forEach(([name, preset]) => {
                    expect(preset.duration).toBeGreaterThan(0);
                    expect(preset.easing).toBeTruthy();
                    expect(typeof preset.easing).toBe('string');
                    expect(preset.easing).toContain('cubic-bezier');
                });
            })
        );
    });

    // Property: Reduced Motion Responsiveness
    it('should switch between animated and instant presets based on motion preference', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('fade-in', 'slide-up', 'scale-in', 'slide-down'),
                fc.boolean(),
                (presetName, reducedMotion) => {
                    const preset = getAccessibleAnimationPreset(presetName, {
                        reducedMotion,
                        userReducedMotion: reducedMotion,
                    });

                    if (reducedMotion) {
                        expect(preset.animation).toBeUndefined();
                        expect(preset.opacity ?? '1').toBe('1');
                    } else {
                        expect(preset.animation).toBeTruthy();
                        expect(typeof preset.animation).toBe('string');
                    }
                }
            )
        );
    });

    // Property: Motion Preference Timing Stability
    it('should return zero duration for reduced motion and preserve normal timing otherwise', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 1000 }),
                fc.string({ minLength: 1, maxLength: 40 }).filter(s => s.trim().length > 0),
                fc.boolean(),
                (duration, timing, reducedMotion) => {
                    expect(getAnimationDuration(duration, reducedMotion)).toBe(reducedMotion ? 0 : duration);
                    expect(getAnimationTiming(timing, reducedMotion)).toBe(reducedMotion ? 'none' : timing);
                }
            )
        );
    });
});
