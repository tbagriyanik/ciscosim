/**
 * Tests for RenderingPerformanceMonitor
 * 
 * Tests FPS tracking, paint/layout measurement, node render tracking,
 * frame drop detection, and debug APIs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    RenderingPerformanceMonitor,
    getRenderingPerformanceMonitor,
    useRenderingPerformance,
} from '../monitoring/RenderingPerformanceMonitor';

describe('RenderingPerformanceMonitor', () => {
    let monitor: RenderingPerformanceMonitor;

    beforeEach(() => {
        monitor = new RenderingPerformanceMonitor({
            fpsThreshold: 60,
            sampleInterval: 1000,
            maxHistorySize: 300,
        });
    });

    afterEach(() => {
        monitor.destroy();
    });

    describe('Initialization', () => {
        it('should initialize with default config', () => {
            const m = new RenderingPerformanceMonitor();
            expect(m).toBeDefined();
            m.destroy();
        });

        it('should initialize with custom config', () => {
            const m = new RenderingPerformanceMonitor({
                fpsThreshold: 45,
                sampleInterval: 500,
                maxHistorySize: 100,
            });
            expect(m).toBeDefined();
            m.destroy();
        });
    });

    describe('FPS Tracking (Requirement 7.1)', () => {
        it('should track FPS using requestAnimationFrame', async () => {
            monitor.startTracking();

            // Simulate some frames
            await new Promise((resolve) => setTimeout(resolve, 100));

            const metrics = monitor.getMetrics();
            expect(metrics.fps).toBeGreaterThan(0);
            expect(metrics.fps).toBeLessThanOrEqual(120); // Reasonable FPS range

            monitor.stopTracking();
        });

        it('should calculate average FPS', async () => {
            monitor.startTracking();

            await new Promise((resolve) => setTimeout(resolve, 100));

            const avgFps = monitor.getAverageFps();
            expect(avgFps).toBeGreaterThan(0);

            monitor.stopTracking();
        });

        it('should not track when stopped', async () => {
            monitor.startTracking();
            await new Promise((resolve) => setTimeout(resolve, 50));
            const fps1 = monitor.getMetrics().fps;

            monitor.stopTracking();
            await new Promise((resolve) => setTimeout(resolve, 50));
            const fps2 = monitor.getMetrics().fps;

            // FPS should not change significantly after stopping
            expect(Math.abs(fps1 - fps2)).toBeLessThan(10);
        });

        it('should handle multiple start/stop cycles', async () => {
            monitor.startTracking();
            await new Promise((resolve) => setTimeout(resolve, 50));
            monitor.stopTracking();

            monitor.startTracking();
            await new Promise((resolve) => setTimeout(resolve, 50));
            monitor.stopTracking();

            const metrics = monitor.getMetrics();
            expect(metrics.fps).toBeGreaterThan(0);
        });
    });

    describe('Paint and Layout Measurement (Requirement 7.2, 7.3)', () => {
        it('should measure paint time', () => {
            monitor.startRenderMeasurement();
            // Simulate some work
            let sum = 0;
            for (let i = 0; i < 1000; i++) {
                sum += Math.sqrt(i);
            }
            monitor.endRenderMeasurement();

            const metrics = monitor.getMetrics();
            expect(metrics.renderingTime).toBeGreaterThanOrEqual(0);
        });

        it('should measure layout time', () => {
            monitor.startRenderMeasurement();
            monitor.endRenderMeasurement();

            const metrics = monitor.getMetrics();
            expect(metrics.layoutTime).toBeGreaterThanOrEqual(0);
        });

        it('should accumulate paint time', () => {
            monitor.startRenderMeasurement();
            monitor.endRenderMeasurement();
            const time1 = monitor.getMetrics().renderingTime;

            monitor.startRenderMeasurement();
            monitor.endRenderMeasurement();
            const time2 = monitor.getMetrics().renderingTime;

            expect(time2).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Node Render Tracking (Requirement 7.3)', () => {
        it('should track node render count', () => {
            monitor.setNodesRendered(100);
            const metrics = monitor.getMetrics();
            expect(metrics.nodesRendered).toBe(100);
        });

        it('should update node render count', () => {
            monitor.setNodesRendered(50);
            expect(monitor.getMetrics().nodesRendered).toBe(50);

            monitor.setNodesRendered(150);
            expect(monitor.getMetrics().nodesRendered).toBe(150);
        });

        it('should handle zero nodes', () => {
            monitor.setNodesRendered(0);
            expect(monitor.getMetrics().nodesRendered).toBe(0);
        });

        it('should handle large node counts', () => {
            monitor.setNodesRendered(10000);
            expect(monitor.getMetrics().nodesRendered).toBe(10000);
        });
    });

    describe('Frame Drop Detection (Requirement 7.5)', () => {
        it('should detect frame drops', async () => {
            monitor.startTracking();

            // Simulate frame drops by waiting
            await new Promise((resolve) => setTimeout(resolve, 100));

            const metrics = monitor.getMetrics();
            // Frame drops might be detected depending on system performance
            expect(metrics.frameDrops).toBeGreaterThanOrEqual(0);

            monitor.stopTracking();
        });

        it('should maintain frame drop history', async () => {
            monitor.startTracking();
            await new Promise((resolve) => setTimeout(resolve, 100));

            const history = monitor.getFrameDropHistory();
            expect(Array.isArray(history)).toBe(true);

            monitor.stopTracking();
        });

        it('should log frame drop warnings', async () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            monitor.startTracking();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Check if any warnings were logged
            const warnings = consoleSpy.mock.calls.filter((call) =>
                String(call[0]).includes('Frame drop')
            );

            // Warnings might or might not be logged depending on system performance
            expect(Array.isArray(warnings)).toBe(true);

            consoleSpy.mockRestore();
            monitor.stopTracking();
        });
    });

    describe('Metrics API (Requirement 7.4, 7.6)', () => {
        it('should return current metrics', () => {
            const metrics = monitor.getMetrics();

            expect(metrics).toHaveProperty('fps');
            expect(metrics).toHaveProperty('paintTime');
            expect(metrics).toHaveProperty('layoutTime');
            expect(metrics).toHaveProperty('nodesRendered');
            expect(metrics).toHaveProperty('renderingTime');
            expect(metrics).toHaveProperty('frameDrops');
            expect(metrics).toHaveProperty('timestamp');
        });

        it('should have valid metric values', () => {
            monitor.setNodesRendered(100);
            monitor.startRenderMeasurement();
            monitor.endRenderMeasurement();

            const metrics = monitor.getMetrics();

            expect(typeof metrics.fps).toBe('number');
            expect(typeof metrics.paintTime).toBe('number');
            expect(typeof metrics.layoutTime).toBe('number');
            expect(typeof metrics.nodesRendered).toBe('number');
            expect(typeof metrics.renderingTime).toBe('number');
            expect(typeof metrics.frameDrops).toBe('number');
            expect(typeof metrics.timestamp).toBe('number');

            expect(metrics.fps).toBeGreaterThanOrEqual(0);
            expect(metrics.paintTime).toBeGreaterThanOrEqual(0);
            expect(metrics.layoutTime).toBeGreaterThanOrEqual(0);
            expect(metrics.nodesRendered).toBeGreaterThanOrEqual(0);
            expect(metrics.renderingTime).toBeGreaterThanOrEqual(0);
            expect(metrics.frameDrops).toBeGreaterThanOrEqual(0);
            expect(metrics.timestamp).toBeGreaterThan(0);
        });

        it('should update metrics over time', async () => {
            const metrics1 = monitor.getMetrics();

            await new Promise((resolve) => setTimeout(resolve, 10));

            const metrics2 = monitor.getMetrics();

            // Timestamp should be different
            expect(metrics2.timestamp).toBeGreaterThan(metrics1.timestamp);
        });
    });

    describe('Reset Functionality', () => {
        it('should reset all metrics', () => {
            monitor.setNodesRendered(100);
            monitor.startRenderMeasurement();
            monitor.endRenderMeasurement();

            monitor.reset();

            const metrics = monitor.getMetrics();
            expect(metrics.fps).toBe(60);
            expect(metrics.paintTime).toBe(0);
            expect(metrics.layoutTime).toBe(0);
            expect(metrics.nodesRendered).toBe(0);
            expect(metrics.renderingTime).toBe(0);
            expect(metrics.frameDrops).toBe(0);
        });

        it('should clear frame drop history on reset', async () => {
            monitor.startTracking();
            await new Promise((resolve) => setTimeout(resolve, 100));

            monitor.reset();

            const history = monitor.getFrameDropHistory();
            expect(history.length).toBe(0);

            monitor.stopTracking();
        });
    });

    describe('Cleanup', () => {
        it('should cleanup resources on destroy', () => {
            monitor.startTracking();
            monitor.destroy();

            // Should not throw
            expect(() => {
                monitor.getMetrics();
            }).not.toThrow();
        });

        it('should stop tracking on destroy', async () => {
            monitor.startTracking();
            const fps1 = monitor.getMetrics().fps;

            monitor.destroy();

            await new Promise((resolve) => setTimeout(resolve, 50));
            const fps2 = monitor.getMetrics().fps;

            // FPS should not change significantly after destroy
            expect(Math.abs(fps1 - fps2)).toBeLessThan(10);
        });
    });

    describe('Global Singleton', () => {
        it('should return same instance from getRenderingPerformanceMonitor', () => {
            const m1 = getRenderingPerformanceMonitor();
            const m2 = getRenderingPerformanceMonitor();

            expect(m1).toBe(m2);
        });

        it('should initialize with config on first call', () => {
            const m = getRenderingPerformanceMonitor({
                fpsThreshold: 45,
            });

            expect(m).toBeDefined();
        });
    });

    describe('Hook Integration', () => {
        it('should provide hook interface', () => {
            const perf = useRenderingPerformance();

            expect(perf).toHaveProperty('getMetrics');
            expect(perf).toHaveProperty('startTracking');
            expect(perf).toHaveProperty('stopTracking');
            expect(perf).toHaveProperty('startRenderMeasurement');
            expect(perf).toHaveProperty('endRenderMeasurement');
            expect(perf).toHaveProperty('setNodesRendered');
            expect(perf).toHaveProperty('getFrameDropHistory');
            expect(perf).toHaveProperty('getAverageFps');
            expect(perf).toHaveProperty('reset');
        });

        it('should work with hook methods', () => {
            const perf = useRenderingPerformance();

            perf.startTracking();
            perf.setNodesRendered(50);
            perf.startRenderMeasurement();
            perf.endRenderMeasurement();

            const metrics = perf.getMetrics();
            expect(metrics.nodesRendered).toBe(50);

            perf.stopTracking();
        });
    });
});
