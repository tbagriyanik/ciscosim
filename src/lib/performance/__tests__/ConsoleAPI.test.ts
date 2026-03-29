/**
 * Tests for ConsoleAPI
 * 
 * Tests the console API for accessing performance metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializePerformanceConsoleAPI } from '../monitoring/ConsoleAPI';

describe('ConsoleAPI', () => {
    beforeEach(() => {
        // Clear any previous API
        delete (window as any).__PERFORMANCE__;
        Object.keys(window.performance).forEach((key) => {
            if (
                key.startsWith('get') ||
                key.startsWith('start') ||
                key.startsWith('stop') ||
                key.startsWith('reset') ||
                key.startsWith('log')
            ) {
                delete (window.performance as any)[key];
            }
        });
    });

    afterEach(() => {
        delete (window as any).__PERFORMANCE__;
    });

    describe('Initialization', () => {
        it('should initialize console API', () => {
            initializePerformanceConsoleAPI();

            expect(window.performance.getMetrics).toBeDefined();
            expect(typeof window.performance.getMetrics).toBe('function');
        });

        it('should expose API via window.__PERFORMANCE__', () => {
            initializePerformanceConsoleAPI();

            expect((window as any).__PERFORMANCE__).toBeDefined();
            expect((window as any).__PERFORMANCE__.getMetrics).toBeDefined();
        });

        it('should log initialization message', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            initializePerformanceConsoleAPI();

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Console API initialized')
            );

            consoleSpy.mockRestore();
        });
    });

    describe('API Methods', () => {
        beforeEach(() => {
            initializePerformanceConsoleAPI();
        });

        it('should provide getMetrics method', () => {
            expect(window.performance.getMetrics).toBeDefined();

            const metrics = window.performance.getMetrics!();
            expect(metrics).toHaveProperty('fps');
            expect(metrics).toHaveProperty('paintTime');
            expect(metrics).toHaveProperty('layoutTime');
            expect(metrics).toHaveProperty('nodesRendered');
            expect(metrics).toHaveProperty('renderingTime');
            expect(metrics).toHaveProperty('frameDrops');
            expect(metrics).toHaveProperty('timestamp');
        });

        it('should provide getFrameDropHistory method', () => {
            expect(window.performance.getFrameDropHistory).toBeDefined();

            const history = window.performance.getFrameDropHistory!();
            expect(Array.isArray(history)).toBe(true);
        });

        it('should provide getAverageFps method', () => {
            expect(window.performance.getAverageFps).toBeDefined();

            const avgFps = window.performance.getAverageFps!();
            expect(typeof avgFps).toBe('number');
            expect(avgFps).toBeGreaterThanOrEqual(0);
        });

        it('should provide startTracking method', () => {
            expect(window.performance.startTracking).toBeDefined();

            expect(() => {
                window.performance.startTracking!();
            }).not.toThrow();
        });

        it('should provide stopTracking method', () => {
            expect(window.performance.stopTracking).toBeDefined();

            expect(() => {
                window.performance.stopTracking!();
            }).not.toThrow();
        });

        it('should provide resetMetrics method', () => {
            expect(window.performance.resetMetrics).toBeDefined();

            expect(() => {
                window.performance.resetMetrics!();
            }).not.toThrow();
        });

        it('should provide logMetrics method', () => {
            expect(window.performance.logMetrics).toBeDefined();

            const consoleSpy = vi.spyOn(console, 'table').mockImplementation(() => { });

            const metrics = window.performance.logMetrics!();
            expect(metrics).toBeDefined();
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should provide logFrameDrops method', () => {
            expect(window.performance.logFrameDrops).toBeDefined();

            const consoleSpy = vi.spyOn(console, 'table').mockImplementation(() => { });

            const history = window.performance.logFrameDrops!();
            expect(Array.isArray(history)).toBe(true);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('API via window.__PERFORMANCE__', () => {
        beforeEach(() => {
            initializePerformanceConsoleAPI();
        });

        it('should access getMetrics via __PERFORMANCE__', () => {
            const metrics = (window as any).__PERFORMANCE__.getMetrics();
            expect(metrics).toHaveProperty('fps');
        });

        it('should access getFrameDropHistory via __PERFORMANCE__', () => {
            const history = (window as any).__PERFORMANCE__.getFrameDropHistory();
            expect(Array.isArray(history)).toBe(true);
        });

        it('should access getAverageFps via __PERFORMANCE__', () => {
            const avgFps = (window as any).__PERFORMANCE__.getAverageFps();
            expect(typeof avgFps).toBe('number');
        });

        it('should access startTracking via __PERFORMANCE__', () => {
            expect(() => {
                (window as any).__PERFORMANCE__.startTracking();
            }).not.toThrow();
        });

        it('should access stopTracking via __PERFORMANCE__', () => {
            expect(() => {
                (window as any).__PERFORMANCE__.stopTracking();
            }).not.toThrow();
        });

        it('should access resetMetrics via __PERFORMANCE__', () => {
            expect(() => {
                (window as any).__PERFORMANCE__.resetMetrics();
            }).not.toThrow();
        });

        it('should access logMetrics via __PERFORMANCE__', () => {
            const consoleSpy = vi.spyOn(console, 'table').mockImplementation(() => { });

            const metrics = (window as any).__PERFORMANCE__.logMetrics();
            expect(metrics).toBeDefined();

            consoleSpy.mockRestore();
        });

        it('should access logFrameDrops via __PERFORMANCE__', () => {
            const consoleSpy = vi.spyOn(console, 'table').mockImplementation(() => { });

            const history = (window as any).__PERFORMANCE__.logFrameDrops();
            expect(Array.isArray(history)).toBe(true);

            consoleSpy.mockRestore();
        });
    });

    describe('API Functionality', () => {
        beforeEach(() => {
            initializePerformanceConsoleAPI();
        });

        it('should track metrics correctly', () => {
            window.performance.startTracking!();

            const metrics1 = window.performance.getMetrics!();
            expect(metrics1.fps).toBeGreaterThanOrEqual(0);

            window.performance.stopTracking!();
        });

        it('should reset metrics', () => {
            window.performance.resetMetrics!();

            const metrics = window.performance.getMetrics!();
            expect(metrics.fps).toBe(60);
            expect(metrics.frameDrops).toBe(0);
        });

        it('should log metrics to console', () => {
            const consoleSpy = vi.spyOn(console, 'table').mockImplementation(() => { });

            window.performance.logMetrics!();

            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should log frame drops to console', () => {
            const consoleSpy = vi.spyOn(console, 'table').mockImplementation(() => { });

            window.performance.logFrameDrops!();

            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });
});
