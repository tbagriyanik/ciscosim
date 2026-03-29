/**
 * Console API for accessing performance metrics
 * 
 * Requirement 7.6: Expose getMetrics() method for accessing current metrics
 * Provides window.performance.getMetrics() API for debugging
 */

import { getRenderingPerformanceMonitor } from './RenderingPerformanceMonitor';

/**
 * Initialize the console API for performance metrics
 * Exposes window.performance.getMetrics() for debugging
 */
export function initializePerformanceConsoleAPI(): void {
    if (typeof window === 'undefined') {
        return;
    }

    // Extend the performance object with custom methods
    const monitor = getRenderingPerformanceMonitor();

    // Create a namespace for custom performance APIs
    const customPerformance = {
        /**
         * Get current rendering metrics
         * Usage: window.performance.getMetrics()
         */
        getMetrics: () => monitor.getMetrics(),

        /**
         * Get frame drop history
         * Usage: window.performance.getFrameDropHistory()
         */
        getFrameDropHistory: () => monitor.getFrameDropHistory(),

        /**
         * Get average FPS
         * Usage: window.performance.getAverageFps()
         */
        getAverageFps: () => monitor.getAverageFps(),

        /**
         * Start performance tracking
         * Usage: window.performance.startTracking()
         */
        startTracking: () => monitor.startTracking(),

        /**
         * Stop performance tracking
         * Usage: window.performance.stopTracking()
         */
        stopTracking: () => monitor.stopTracking(),

        /**
         * Reset all metrics
         * Usage: window.performance.resetMetrics()
         */
        resetMetrics: () => monitor.reset(),

        /**
         * Log current metrics to console
         * Usage: window.performance.logMetrics()
         */
        logMetrics: () => {
            const metrics = monitor.getMetrics();
            console.table(metrics);
            return metrics;
        },

        /**
         * Log frame drop history to console
         * Usage: window.performance.logFrameDrops()
         */
        logFrameDrops: () => {
            const history = monitor.getFrameDropHistory();
            console.table(history);
            return history;
        },
    };

    // Attach to window.performance
    Object.assign(window.performance, customPerformance);

    // Also expose via window.__PERFORMANCE__ for easier access
    (window as any).__PERFORMANCE__ = customPerformance;

    console.log(
        '[PerformanceMonitor] Console API initialized. Use window.performance.getMetrics() or window.__PERFORMANCE__.getMetrics()'
    );
}

/**
 * Type augmentation for window.performance
 */
declare global {
    interface Performance {
        getMetrics?: () => any;
        getFrameDropHistory?: () => any;
        getAverageFps?: () => number;
        startTracking?: () => void;
        stopTracking?: () => void;
        resetMetrics?: () => void;
        logMetrics?: () => any;
        logFrameDrops?: () => any;
    }

    interface Window {
        __PERFORMANCE__?: {
            getMetrics: () => any;
            getFrameDropHistory: () => any;
            getAverageFps: () => number;
            startTracking: () => void;
            stopTracking: () => void;
            resetMetrics: () => void;
            logMetrics: () => any;
            logFrameDrops: () => any;
        };
    }
}
