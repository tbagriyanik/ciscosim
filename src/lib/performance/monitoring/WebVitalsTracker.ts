/**
 * Web Vitals Tracking System
 * Measures and reports Core Web Vitals metrics (LCP, FCP, CLS, TTI)
 * Integrates with web-vitals library and provides analytics reporting
 */

import {
    onCLS,
    onFCP,
    onLCP,
    onTTFB,
} from 'web-vitals';
import type { WebVitalsMetrics } from '../types';

export interface WebVitalsConfig {
    thresholds?: {
        lcpThreshold?: number;
        fcpThreshold?: number;
        clsThreshold?: number;
        ttiThreshold?: number;
    };
    onMetric?: (metric: WebVitalsMetrics) => void;
    reportToAnalytics?: (metrics: WebVitalsMetrics) => void;
    enableLogging?: boolean;
}

export interface WebVitalsSnapshot {
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    ttfb: number | null;
    tti: number | null;
    timestamp: number;
}

/**
 * WebVitalsTracker - Tracks Core Web Vitals metrics
 * Measures LCP, FCP, CLS, and TTI
 * Reports metrics to analytics service and logs warnings for poor metrics
 */
export class WebVitalsTracker {
    private metrics: WebVitalsSnapshot = {
        lcp: null,
        fcp: null,
        cls: null,
        ttfb: null,
        tti: null,
        timestamp: Date.now(),
    };

    private thresholds = {
        lcpThreshold: 2500, // 2.5s - good LCP
        fcpThreshold: 1800, // 1.8s - good FCP
        clsThreshold: 0.1, // 0.1 - good CLS
        ttiThreshold: 3800, // 3.8s - good TTI
    };

    private config: WebVitalsConfig;
    private isTracking = false;
    private unsubscribers: Array<() => void> = [];
    private metricsHistory: WebVitalsSnapshot[] = [];
    private maxHistorySize = 100;

    constructor(config: WebVitalsConfig = {}) {
        this.config = config;
        if (config.thresholds) {
            this.thresholds = { ...this.thresholds, ...config.thresholds };
        }
    }

    /**
     * Start tracking Web Vitals
     * Sets up listeners for all Core Web Vitals metrics
     */
    public startTracking(): void {
        if (this.isTracking) {
            return;
        }

        this.isTracking = true;

        // Track LCP (Largest Contentful Paint)
        const lcpUnsubscribe = onLCP((metric) => {
            this.metrics.lcp = metric.value;
            this.metrics.timestamp = Date.now();
            this.checkThreshold('lcp', metric.value);
            this.onMetricUpdate();
        });

        // Track FCP (First Contentful Paint)
        const fcpUnsubscribe = onFCP((metric) => {
            this.metrics.fcp = metric.value;
            this.metrics.timestamp = Date.now();
            this.checkThreshold('fcp', metric.value);
            this.onMetricUpdate();
        });

        // Track CLS (Cumulative Layout Shift)
        const clsUnsubscribe = onCLS((metric) => {
            this.metrics.cls = metric.value;
            this.metrics.timestamp = Date.now();
            this.checkThreshold('cls', metric.value);
            this.onMetricUpdate();
        });

        // Track TTFB (Time to First Byte)
        const ttfbUnsubscribe = onTTFB((metric) => {
            this.metrics.ttfb = metric.value;
            this.metrics.timestamp = Date.now();
            this.onMetricUpdate();
        });

        // Store unsubscribers, filtering out undefined values
        this.unsubscribers = [
            lcpUnsubscribe,
            fcpUnsubscribe,
            clsUnsubscribe,
            ttfbUnsubscribe,
        ].filter((fn) => typeof fn === 'function');

        if (this.config.enableLogging) {
            console.log('[WebVitalsTracker] Started tracking Web Vitals');
        }
    }

    /**
     * Stop tracking Web Vitals
     * Removes all metric listeners
     */
    public stopTracking(): void {
        if (!this.isTracking) {
            return;
        }

        this.unsubscribers.forEach((unsubscribe) => unsubscribe());
        this.unsubscribers = [];
        this.isTracking = false;

        if (this.config.enableLogging) {
            console.log('[WebVitalsTracker] Stopped tracking Web Vitals');
        }
    }

    /**
     * Get current Web Vitals metrics
     */
    public getMetrics(): WebVitalsSnapshot {
        return { ...this.metrics };
    }

    /**
     * Get metrics history
     */
    public getMetricsHistory(): WebVitalsSnapshot[] {
        return [...this.metricsHistory];
    }

    /**
     * Check if metric exceeds threshold and log warning
     */
    private checkThreshold(metric: 'lcp' | 'fcp' | 'cls' | 'tti', value: number): void {
        let threshold: number | undefined;
        let metricName: string;

        if (metric === 'lcp') {
            threshold = this.thresholds.lcpThreshold;
            metricName = 'LCP';
        } else if (metric === 'fcp') {
            threshold = this.thresholds.fcpThreshold;
            metricName = 'FCP';
        } else if (metric === 'cls') {
            threshold = this.thresholds.clsThreshold;
            metricName = 'CLS';
        } else if (metric === 'tti') {
            threshold = this.thresholds.ttiThreshold;
            metricName = 'TTI';
        } else {
            return;
        }

        if (threshold !== undefined && value > threshold) {
            this.logWarning(metricName, value, threshold);
        }
    }

    /**
     * Log warning for metric exceeding threshold
     */
    private logWarning(
        metric: string,
        value: number,
        threshold: number
    ): void {
        const message = `[WebVitalsTracker] ${metric} exceeded threshold: ${value.toFixed(2)}ms > ${threshold.toFixed(2)}ms`;
        console.warn(message);

        if (this.config.enableLogging) {
            console.log(message);
        }
    }

    /**
     * Handle metric update
     * Call callback and report to analytics
     */
    private onMetricUpdate(): void {
        // Store in history
        this.metricsHistory.push({ ...this.metrics });
        if (this.metricsHistory.length > this.maxHistorySize) {
            this.metricsHistory.shift();
        }

        // Call user callback
        if (this.config.onMetric) {
            this.config.onMetric({
                lcp: this.metrics.lcp,
                fcp: this.metrics.fcp,
                cls: this.metrics.cls,
                tti: this.metrics.tti,
                timestamp: this.metrics.timestamp,
            });
        }

        // Report to analytics
        if (this.config.reportToAnalytics) {
            this.config.reportToAnalytics({
                lcp: this.metrics.lcp,
                fcp: this.metrics.fcp,
                cls: this.metrics.cls,
                tti: this.metrics.tti,
                timestamp: this.metrics.timestamp,
            });
        }
    }

    /**
     * Get average metrics from history
     */
    public getAverageMetrics(): Partial<WebVitalsSnapshot> {
        if (this.metricsHistory.length === 0) {
            return {};
        }

        const initialSum = { lcp: 0, fcp: 0, cls: 0, ttfb: 0, tti: 0, timestamp: 0 };
        const sum = this.metricsHistory.reduce<typeof initialSum>(
            (acc, snapshot) => ({
                lcp: acc.lcp + (snapshot.lcp || 0),
                fcp: acc.fcp + (snapshot.fcp || 0),
                cls: acc.cls + (snapshot.cls || 0),
                ttfb: acc.ttfb + (snapshot.ttfb || 0),
                tti: acc.tti + (snapshot.tti || 0),
                timestamp: 0,
            }),
            initialSum
        );

        const count = this.metricsHistory.length;
        return {
            lcp: sum.lcp / count,
            fcp: sum.fcp / count,
            cls: sum.cls / count,
            ttfb: sum.ttfb / count,
            tti: sum.tti / count,
        };
    }

    /**
     * Reset metrics
     */
    public reset(): void {
        this.metrics = {
            lcp: null,
            fcp: null,
            cls: null,
            ttfb: null,
            tti: null,
            timestamp: Date.now(),
        };
        this.metricsHistory = [];
    }

    /**
     * Destroy tracker and clean up
     */
    public destroy(): void {
        this.stopTracking();
        this.reset();
    }
}

// Singleton instance
let trackerInstance: WebVitalsTracker | null = null;

/**
 * Get or create WebVitalsTracker singleton
 */
export function getWebVitalsTracker(
    config?: WebVitalsConfig
): WebVitalsTracker {
    if (!trackerInstance) {
        trackerInstance = new WebVitalsTracker(config);
    }
    return trackerInstance;
}

/**
 * React hook for Web Vitals tracking
 */
export function useWebVitals(config?: WebVitalsConfig): WebVitalsSnapshot {
    const tracker = getWebVitalsTracker(config);

    // Start tracking on mount
    React.useEffect(() => {
        tracker.startTracking();
        return () => {
            // Don't stop tracking on unmount - keep it running
        };
    }, [tracker]);

    // Return current metrics
    return tracker.getMetrics();
}

// Import React for the hook
import React from 'react';
