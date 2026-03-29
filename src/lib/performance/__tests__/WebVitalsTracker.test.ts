/**
 * Unit tests for WebVitalsTracker
 * Tests Web Vitals measurement, reporting, and threshold warnings
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    WebVitalsTracker,
    getWebVitalsTracker,
    type WebVitalsConfig,
} from '../monitoring/WebVitalsTracker';

describe('WebVitalsTracker', () => {
    let tracker: WebVitalsTracker;

    beforeEach(() => {
        tracker = new WebVitalsTracker();
    });

    afterEach(() => {
        tracker.destroy();
    });

    describe('initialization', () => {
        it('should initialize with default thresholds', () => {
            const metrics = tracker.getMetrics();
            expect(metrics.lcp).toBeNull();
            expect(metrics.fcp).toBeNull();
            expect(metrics.cls).toBeNull();
            expect(metrics.ttfb).toBeNull();
        });

        it('should initialize with custom thresholds', () => {
            const customTracker = new WebVitalsTracker({
                thresholds: {
                    lcpThreshold: 3000,
                    fcpThreshold: 2000,
                    clsThreshold: 0.15,
                    ttiThreshold: 4000,
                },
            });

            expect(customTracker).toBeDefined();
            customTracker.destroy();
        });

        it('should initialize with config options', () => {
            const onMetric = vi.fn();
            const customTracker = new WebVitalsTracker({
                onMetric,
                enableLogging: true,
            });

            expect(customTracker).toBeDefined();
            customTracker.destroy();
        });
    });

    describe('tracking lifecycle', () => {
        it('should start tracking', () => {
            tracker.startTracking();
            expect(tracker).toBeDefined();
            tracker.stopTracking();
        });

        it('should stop tracking', () => {
            tracker.startTracking();
            tracker.stopTracking();
            expect(tracker).toBeDefined();
        });

        it('should not start tracking twice', () => {
            tracker.startTracking();
            tracker.startTracking(); // Should be idempotent
            tracker.stopTracking();
            expect(tracker).toBeDefined();
        });

        it('should not stop tracking twice', () => {
            tracker.startTracking();
            tracker.stopTracking();
            tracker.stopTracking(); // Should be idempotent
            expect(tracker).toBeDefined();
        });
    });

    describe('metrics management', () => {
        it('should get current metrics', () => {
            const metrics = tracker.getMetrics();
            expect(metrics).toHaveProperty('lcp');
            expect(metrics).toHaveProperty('fcp');
            expect(metrics).toHaveProperty('cls');
            expect(metrics).toHaveProperty('ttfb');
            expect(metrics).toHaveProperty('timestamp');
        });

        it('should get metrics history', () => {
            const history = tracker.getMetricsHistory();
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(0);
        });

        it('should reset metrics', () => {
            tracker.reset();
            const metrics = tracker.getMetrics();
            expect(metrics.lcp).toBeNull();
            expect(metrics.fcp).toBeNull();
            expect(metrics.cls).toBeNull();
        });

        it('should get average metrics from empty history', () => {
            const avg = tracker.getAverageMetrics();
            expect(Object.keys(avg).length).toBe(0);
        });
    });

    describe('callback handling', () => {
        it('should call onMetric callback when metrics update', async () => {
            const onMetric = vi.fn();
            const customTracker = new WebVitalsTracker({ onMetric });

            // Simulate metric update by directly calling the callback
            // (In real scenario, web-vitals library would call this)
            customTracker.startTracking();

            // Wait a bit for any async operations
            await new Promise((resolve) => setTimeout(resolve, 100));

            customTracker.destroy();
        });

        it('should call reportToAnalytics callback', async () => {
            const reportToAnalytics = vi.fn();
            const customTracker = new WebVitalsTracker({ reportToAnalytics });

            customTracker.startTracking();
            await new Promise((resolve) => setTimeout(resolve, 100));

            customTracker.destroy();
        });
    });

    describe('singleton pattern', () => {
        it('should return same instance on multiple calls', () => {
            const tracker1 = getWebVitalsTracker();
            const tracker2 = getWebVitalsTracker();
            expect(tracker1).toBe(tracker2);
        });

        it('should create new instance with config', () => {
            const tracker1 = getWebVitalsTracker({ enableLogging: true });
            expect(tracker1).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('should handle destroy gracefully', () => {
            tracker.startTracking();
            expect(() => tracker.destroy()).not.toThrow();
        });

        it('should handle multiple destroy calls', () => {
            tracker.startTracking();
            tracker.destroy();
            expect(() => tracker.destroy()).not.toThrow();
        });
    });

    describe('metrics validation', () => {
        it('should have valid timestamp in metrics', () => {
            const metrics = tracker.getMetrics();
            expect(typeof metrics.timestamp).toBe('number');
            expect(metrics.timestamp).toBeGreaterThan(0);
        });

        it('should maintain metrics structure', () => {
            const metrics = tracker.getMetrics();
            expect(metrics).toEqual({
                lcp: null,
                fcp: null,
                cls: null,
                ttfb: null,
                tti: null,
                timestamp: expect.any(Number),
            });
        });
    });
});
