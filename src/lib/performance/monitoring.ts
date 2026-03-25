export interface PerformanceMetrics {
    fcp: number | null; // First Contentful Paint
    lcp: number | null; // Largest Contentful Paint
    cls: number | null; // Cumulative Layout Shift
    fid: number | null; // First Input Delay
    inp: number | null; // Interaction to Next Paint (best effort)
    ttfb: number | null; // Time to First Byte
    renderTime: number;
    interactionTime: number;
    interactionP95: number;
    longTaskTime: number;
    memoryUsage: number | null;
}

export interface PerformanceThresholds {
    fcp: number; // milliseconds
    lcp: number; // milliseconds
    cls: number; // unitless
    fid: number; // milliseconds
    inp: number; // milliseconds
    ttfb: number; // milliseconds
    renderTime: number; // milliseconds
    interactionTime: number; // milliseconds
    longTaskTime: number; // milliseconds
}

export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
    fcp: 1800, // 1.8 seconds
    lcp: 2500, // 2.5 seconds
    cls: 0.1, // 0.1 unitless
    fid: 100, // 100 milliseconds
    inp: 200, // 200 milliseconds
    ttfb: 600, // 600 milliseconds
    renderTime: 16.67, // 60 FPS = 16.67ms per frame
    interactionTime: 100, // 100 milliseconds
    longTaskTime: 50, // long task budget
};

class PerformanceMonitor {
    private metrics: PerformanceMetrics = {
        fcp: null,
        lcp: null,
        cls: null,
        fid: null,
        inp: null,
        ttfb: null,
        renderTime: 0,
        interactionTime: 0,
        interactionP95: 0,
        longTaskTime: 0,
        memoryUsage: null,
    };

    private thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS;
    private observers: Map<string, PerformanceObserver> = new Map();
    private interactionStartTime: number | null = null;
    private renderStartTime: number | null = null;
    private interactionSamples: number[] = [];
    private readonly maxSamples = 120;

    constructor(thresholds?: Partial<PerformanceThresholds>) {
        if (thresholds) {
            this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
        }
        this.initializeObservers();
    }

    private initializeObservers() {
        if (typeof window === 'undefined') return;

        // Observe Paint Timing (FCP)
        if ('PerformanceObserver' in window) {
            try {
                const paintObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.name === 'first-contentful-paint') {
                            this.metrics.fcp = entry.startTime;
                        }
                    }
                });
                paintObserver.observe({ entryTypes: ['paint'] });
                this.observers.set('paint', paintObserver);
            } catch (e) {
                console.warn('Paint observer not supported:', e);
            }

            // Observe Largest Contentful Paint (LCP)
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    if (entries.length > 0) {
                        this.metrics.lcp = entries[entries.length - 1].startTime;
                    }
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                this.observers.set('lcp', lcpObserver);
            } catch (e) {
                console.warn('LCP observer not supported:', e);
            }

            // Observe Layout Shift (CLS)
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!(entry as any).hadRecentInput) {
                            clsValue += (entry as any).value;
                            this.metrics.cls = clsValue;
                        }
                    }
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
                this.observers.set('cls', clsObserver);
            } catch (e) {
                console.warn('CLS observer not supported:', e);
            }

            // Observe First Input Delay (FID)
            try {
                const fidObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.metrics.fid = (entry as any).processingDuration;
                    }
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
                this.observers.set('fid', fidObserver);
            } catch (e) {
                console.warn('FID observer not supported:', e);
            }

            // Observe interaction timing (INP approximation)
            try {
                const inpObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries() as any[]) {
                        const duration = Number(entry.duration || 0);
                        if (duration > 0) {
                            this.metrics.inp = Math.max(this.metrics.inp ?? 0, duration);
                        }
                    }
                });
                inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 } as any);
                this.observers.set('inp', inpObserver);
            } catch (e) {
                console.warn('INP observer not supported:', e);
            }

            // Observe Long Tasks for responsiveness budget
            try {
                const longTaskObserver = new PerformanceObserver((list) => {
                    let total = this.metrics.longTaskTime;
                    for (const entry of list.getEntries()) {
                        total += entry.duration;
                    }
                    this.metrics.longTaskTime = total;
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.set('longtask', longTaskObserver);
            } catch (e) {
                console.warn('Long task observer not supported:', e);
            }
        }

        // Get TTFB from navigation timing
        if ('performance' in window && 'getEntriesByType' in window.performance) {
            const navigationTiming = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            if (navigationTiming) {
                this.metrics.ttfb = navigationTiming.responseStart - navigationTiming.fetchStart;
            }
        }
    }

    startInteractionTiming() {
        this.interactionStartTime = performance.now();
    }

    endInteractionTiming() {
        if (this.interactionStartTime !== null) {
            this.metrics.interactionTime = performance.now() - this.interactionStartTime;
            this.interactionSamples.push(this.metrics.interactionTime);
            if (this.interactionSamples.length > this.maxSamples) {
                this.interactionSamples.shift();
            }
            const sorted = [...this.interactionSamples].sort((a, b) => a - b);
            const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
            this.metrics.interactionP95 = sorted[p95Index] ?? this.metrics.interactionTime;
            this.interactionStartTime = null;
        }
    }

    startRenderTiming() {
        this.renderStartTime = performance.now();
    }

    endRenderTiming() {
        if (this.renderStartTime !== null) {
            this.metrics.renderTime = performance.now() - this.renderStartTime;
            this.renderStartTime = null;
        }
    }

    updateMemoryUsage() {
        if ('memory' in performance) {
            this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
        }
    }

    getMetrics(): PerformanceMetrics {
        this.updateMemoryUsage();
        return { ...this.metrics };
    }

    trackInteraction<T>(work: () => T): T {
        this.startInteractionTiming();
        try {
            return work();
        } finally {
            this.endInteractionTiming();
        }
    }

    checkThresholds(): { passed: boolean; violations: string[] } {
        const violations: string[] = [];

        if (this.metrics.fcp !== null && this.metrics.fcp > this.thresholds.fcp) {
            violations.push(`FCP exceeded: ${this.metrics.fcp.toFixed(2)}ms > ${this.thresholds.fcp}ms`);
        }

        if (this.metrics.lcp !== null && this.metrics.lcp > this.thresholds.lcp) {
            violations.push(`LCP exceeded: ${this.metrics.lcp.toFixed(2)}ms > ${this.thresholds.lcp}ms`);
        }

        if (this.metrics.cls !== null && this.metrics.cls > this.thresholds.cls) {
            violations.push(`CLS exceeded: ${this.metrics.cls.toFixed(3)} > ${this.thresholds.cls}`);
        }

        if (this.metrics.fid !== null && this.metrics.fid > this.thresholds.fid) {
            violations.push(`FID exceeded: ${this.metrics.fid.toFixed(2)}ms > ${this.thresholds.fid}ms`);
        }

        if (this.metrics.inp !== null && this.metrics.inp > this.thresholds.inp) {
            violations.push(`INP exceeded: ${this.metrics.inp.toFixed(2)}ms > ${this.thresholds.inp}ms`);
        }

        if (this.metrics.ttfb !== null && this.metrics.ttfb > this.thresholds.ttfb) {
            violations.push(`TTFB exceeded: ${this.metrics.ttfb.toFixed(2)}ms > ${this.thresholds.ttfb}ms`);
        }

        if (this.metrics.renderTime > this.thresholds.renderTime) {
            violations.push(`Render time exceeded: ${this.metrics.renderTime.toFixed(2)}ms > ${this.thresholds.renderTime}ms`);
        }

        if (this.metrics.interactionTime > this.thresholds.interactionTime) {
            violations.push(`Interaction time exceeded: ${this.metrics.interactionTime.toFixed(2)}ms > ${this.thresholds.interactionTime}ms`);
        }

        if (this.metrics.longTaskTime > this.thresholds.longTaskTime) {
            violations.push(`Long task time exceeded: ${this.metrics.longTaskTime.toFixed(2)}ms > ${this.thresholds.longTaskTime}ms`);
        }

        return {
            passed: violations.length === 0,
            violations,
        };
    }

    destroy() {
        this.observers.forEach((observer) => observer.disconnect());
        this.observers.clear();
    }
}

export const performanceMonitor = new PerformanceMonitor();

export function usePerformanceMonitoring() {
    return {
        getMetrics: () => performanceMonitor.getMetrics(),
        checkThresholds: () => performanceMonitor.checkThresholds(),
        startInteraction: () => performanceMonitor.startInteractionTiming(),
        endInteraction: () => performanceMonitor.endInteractionTiming(),
        trackInteraction: <T>(work: () => T) => performanceMonitor.trackInteraction(work),
        startRender: () => performanceMonitor.startRenderTiming(),
        endRender: () => performanceMonitor.endRenderTiming(),
    };
}
