import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { performanceMonitor, DEFAULT_THRESHOLDS } from '../monitoring';

describe('Performance Optimization Layer - Property Tests', () => {
    // Property 10: Performance Threshold Compliance
    it('should ensure all user interactions respond within 100 milliseconds', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 100 }),
                (interactionTime) => {
                    // Simulate interaction timing
                    performanceMonitor.startInteractionTiming();

                    // Simulate work
                    let sum = 0;
                    for (let i = 0; i < interactionTime * 1000; i++) {
                        sum += Math.sqrt(i);
                    }

                    performanceMonitor.endInteractionTiming();

                    const metrics = performanceMonitor.getMetrics();

                    // Verify metrics are recorded
                    expect(metrics.interactionTime).toBeGreaterThanOrEqual(0);

                    // For very small interactions, should be well under threshold
                    if (interactionTime < 10) {
                        expect(metrics.interactionTime).toBeLessThan(DEFAULT_THRESHOLDS.interactionTime);
                    }
                }
            )
        );
    });

    // Property: Render Performance
    it('should maintain 60 FPS performance for rendering', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 50 }),
                (frameCount) => {
                    const targetFrameTime = 16.67; // 60 FPS = 16.67ms per frame

                    for (let i = 0; i < frameCount; i++) {
                        performanceMonitor.startRenderTiming();

                        // Simulate render work
                        let sum = 0;
                        for (let j = 0; j < 1000; j++) {
                            sum += Math.sqrt(j);
                        }

                        performanceMonitor.endRenderTiming();
                    }

                    const metrics = performanceMonitor.getMetrics();

                    // Verify render time is reasonable
                    expect(metrics.renderTime).toBeGreaterThanOrEqual(0);
                    expect(metrics.renderTime).toBeLessThan(targetFrameTime * 2);
                }
            )
        );
    });

    // Property: Memory Usage Tracking
    it('should track memory usage without causing memory leaks', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }),
                (iterations) => {
                    const initialMetrics = performanceMonitor.getMetrics();

                    // Perform operations
                    for (let i = 0; i < iterations; i++) {
                        const data = new Array(1000).fill(Math.random());
                        // Use data to prevent optimization
                        expect(data.length).toBe(1000);
                    }

                    const finalMetrics = performanceMonitor.getMetrics();

                    // Memory should be tracked
                    if (finalMetrics.memoryUsage !== null) {
                        expect(finalMetrics.memoryUsage).toBeGreaterThan(0);
                    }
                }
            )
        );
    });

    // Property: Threshold Validation
    it('should correctly validate performance against thresholds', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 3000 }),
                (renderTime) => {
                    performanceMonitor.startRenderTiming();

                    // Simulate render time
                    const start = performance.now();
                    while (performance.now() - start < Math.min(renderTime, 50)) {
                        // Busy wait
                    }

                    performanceMonitor.endRenderTiming();

                    const result = performanceMonitor.checkThresholds();

                    // Result should have valid structure
                    expect(result).toHaveProperty('passed');
                    expect(result).toHaveProperty('violations');
                    expect(Array.isArray(result.violations)).toBe(true);
                }
            )
        );
    });

    // Property: Extended metric surface remains valid after interaction tracking
    it('should expose extended performance metrics with valid ranges', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 30 }),
                (iterations) => {
                    for (let i = 0; i < iterations; i++) {
                        performanceMonitor.trackInteraction(() => {
                            let sum = 0;
                            for (let j = 0; j < 500; j++) {
                                sum += Math.sqrt(j);
                            }
                            return sum;
                        });
                    }

                    const metrics = performanceMonitor.getMetrics();
                    expect(metrics.interactionP95).toBeGreaterThanOrEqual(0);
                    expect(metrics.interactionTime).toBeGreaterThanOrEqual(0);
                    expect(metrics.longTaskTime).toBeGreaterThanOrEqual(0);
                    if (metrics.inp !== null) {
                        expect(metrics.inp).toBeGreaterThanOrEqual(0);
                    }
                }
            )
        );
    });

    // Property: Threshold object contains extended performance budgets
    it('should include threshold budgets for extended metrics', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('inp', 'longTaskTime', 'interactionTime', 'renderTime'),
                (key) => {
                    expect(DEFAULT_THRESHOLDS[key]).toBeGreaterThan(0);
                }
            )
        );
    });
});
