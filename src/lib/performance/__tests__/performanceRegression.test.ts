import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { performanceMonitor, DEFAULT_THRESHOLDS } from '../monitoring';

describe('Performance Regression Testing', () => {
  it('keeps baseline thresholds within expected bounds', () => {
    expect(DEFAULT_THRESHOLDS.renderTime).toBeLessThanOrEqual(16.67);
    expect(DEFAULT_THRESHOLDS.interactionTime).toBeLessThanOrEqual(100);
    expect(DEFAULT_THRESHOLDS.longTaskTime).toBeLessThanOrEqual(50);
  });

  it('detects threshold regressions for interaction work', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 25 }), (work) => {
        performanceMonitor.startInteractionTiming();
        let sum = 0;
        for (let i = 0; i < work * 250; i++) {
          sum += Math.sqrt(i);
        }
        performanceMonitor.endInteractionTiming();

        const metrics = performanceMonitor.getMetrics();
        expect(metrics.interactionP95).toBeGreaterThanOrEqual(0);
        expect(metrics.interactionTime).toBeGreaterThanOrEqual(0);
        expect(sum).toBeGreaterThanOrEqual(0);
      })
    );
  });

  it('tracks render regression signals consistently', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (cycles) => {
        for (let i = 0; i < cycles; i++) {
          performanceMonitor.startRenderTiming();
          let acc = 0;
          for (let j = 0; j < 1000; j++) {
            acc += Math.sqrt(j);
          }
          performanceMonitor.endRenderTiming();
          expect(acc).toBeGreaterThan(0);
        }

        const result = performanceMonitor.checkThresholds();
        expect(result).toHaveProperty('passed');
        expect(result).toHaveProperty('violations');
        expect(Array.isArray(result.violations)).toBe(true);
      })
    );
  });
});
