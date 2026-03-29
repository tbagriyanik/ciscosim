/**
 * Testing utilities for property-based tests
 * Provides helpers for performance measurement and mock data generation
 */

import fc from 'fast-check';
import type {
    PerformanceMetrics,
    PerformanceSnapshot,
    WebVitalsMetrics,
    SpatialBounds,
    VirtualListState,
} from '../types';

// ============================================================================
// Performance Measurement Utilities
// ============================================================================

/**
 * Measures the execution time of a function in milliseconds
 */
export function measureExecutionTime(fn: () => void): number {
    const start = performance.now();
    fn();
    const end = performance.now();
    return end - start;
}

/**
 * Measures the execution time of an async function in milliseconds
 */
export async function measureAsyncExecutionTime(
    fn: () => Promise<void>
): Promise<number> {
    const start = performance.now();
    await fn();
    const end = performance.now();
    return end - start;
}

/**
 * Calculates average execution time over multiple runs
 */
export function measureAverageExecutionTime(
    fn: () => void,
    iterations: number = 100
): number {
    let totalTime = 0;
    for (let i = 0; i < iterations; i++) {
        totalTime += measureExecutionTime(fn);
    }
    return totalTime / iterations;
}

/**
 * Simulates FPS measurement using requestAnimationFrame
 */
export async function measureFPS(durationMs: number = 1000): Promise<number> {
    return new Promise((resolve) => {
        let frameCount = 0;
        const startTime = performance.now();

        const countFrame = () => {
            frameCount++;
            const elapsed = performance.now() - startTime;

            if (elapsed < durationMs) {
                requestAnimationFrame(countFrame);
            } else {
                const fps = (frameCount / elapsed) * 1000;
                resolve(fps);
            }
        };

        requestAnimationFrame(countFrame);
    });
}

/**
 * Gets current memory usage (if available)
 */
export function getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
}

/**
 * Measures memory delta for a function execution
 */
export function measureMemoryDelta(fn: () => void): number {
    const before = getMemoryUsage();
    fn();
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    const after = getMemoryUsage();
    return after - before;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Generates mock performance metrics
 */
export function generateMockPerformanceMetrics(
    overrides?: Partial<PerformanceMetrics>
): PerformanceMetrics {
    return {
        fps: 60,
        paintTime: 16.67,
        layoutTime: 8.33,
        nodesRendered: 100,
        memoryUsage: 50000000,
        timestamp: Date.now(),
        ...overrides,
    };
}

/**
 * Generates mock performance snapshot
 */
export function generateMockPerformanceSnapshot(
    overrides?: Partial<PerformanceSnapshot>
): PerformanceSnapshot {
    return {
        timestamp: Date.now(),
        fps: 60,
        paintTime: 16.67,
        layoutTime: 8.33,
        nodesRendered: 100,
        memoryUsage: 50000000,
        frameDrops: 0,
        ...overrides,
    };
}

/**
 * Generates mock Web Vitals metrics
 */
export function generateMockWebVitalsMetrics(
    overrides?: Partial<WebVitalsMetrics>
): WebVitalsMetrics {
    return {
        lcp: 2500,
        fcp: 1800,
        cls: 0.05,
        tti: 3500,
        timestamp: Date.now(),
        ...overrides,
    };
}

/**
 * Generates mock spatial bounds
 */
export function generateMockSpatialBounds(
    overrides?: Partial<SpatialBounds>
): SpatialBounds {
    return {
        x: 0,
        y: 0,
        width: 1024,
        height: 768,
        ...overrides,
    };
}

/**
 * Generates mock virtual list state
 */
export function generateMockVirtualListState(
    overrides?: Partial<VirtualListState>
): VirtualListState {
    return {
        itemCount: 1000,
        itemHeight: 40,
        scrollOffset: 0,
        visibleRange: { start: 0, end: 20 },
        bufferSize: 5,
        ...overrides,
    };
}

// ============================================================================
// Fast-Check Arbitraries for Property-Based Testing
// ============================================================================

/**
 * Arbitrary for generating valid FPS values (0-120)
 */
export const fpsArbitrary = fc.integer({ min: 0, max: 120 });

/**
 * Arbitrary for generating valid paint times (0-100ms)
 */
export const paintTimeArbitrary = fc.float({ min: 0, max: 100 });

/**
 * Arbitrary for generating valid layout times (0-100ms)
 */
export const layoutTimeArbitrary = fc.float({ min: 0, max: 100 });

/**
 * Arbitrary for generating valid node render counts
 */
export const nodeRenderCountArbitrary = fc.integer({ min: 0, max: 10000 });

/**
 * Arbitrary for generating valid memory usage values (0-500MB)
 */
export const memoryUsageArbitrary = fc.integer({
    min: 0,
    max: 500 * 1024 * 1024,
});

/**
 * Arbitrary for generating valid LCP values (0-5000ms)
 */
export const lcpArbitrary = fc.float({ min: 0, max: 5000 });

/**
 * Arbitrary for generating valid FCP values (0-3000ms)
 */
export const fcpArbitrary = fc.float({ min: 0, max: 3000 });

/**
 * Arbitrary for generating valid CLS values (0-1)
 */
export const clsArbitrary = fc.float({ min: 0, max: 1 });

/**
 * Arbitrary for generating valid TTI values (0-10000ms)
 */
export const ttiArbitrary = fc.float({ min: 0, max: 10000 });

/**
 * Arbitrary for generating valid item counts for virtual lists
 */
export const itemCountArbitrary = fc.integer({ min: 1, max: 100000 });

/**
 * Arbitrary for generating valid item heights
 */
export const itemHeightArbitrary = fc.integer({ min: 20, max: 200 });

/**
 * Arbitrary for generating valid scroll offsets
 */
export const scrollOffsetArbitrary = fc.integer({ min: 0, max: 1000000 });

/**
 * Arbitrary for generating valid buffer sizes
 */
export const bufferSizeArbitrary = fc.integer({ min: 1, max: 50 });

/**
 * Arbitrary for generating valid spatial bounds
 */
export const spatialBoundsArbitrary = fc.record({
    x: fc.integer({ min: -10000, max: 10000 }),
    y: fc.integer({ min: -10000, max: 10000 }),
    width: fc.integer({ min: 100, max: 10000 }),
    height: fc.integer({ min: 100, max: 10000 }),
});

/**
 * Arbitrary for generating valid node IDs
 */
export const nodeIdArbitrary = fc.string({
    minLength: 1,
    maxLength: 50,
    unit: fc.integer({ min: 97, max: 122 }).map((code) => String.fromCharCode(code)),
});

/**
 * Arbitrary for generating valid coordinates
 */
export const coordinateArbitrary = fc.record({
    x: fc.float({ min: -10000, max: 10000 }),
    y: fc.float({ min: -10000, max: 10000 }),
});

/**
 * Arbitrary for generating performance metrics
 */
export const performanceMetricsArbitrary = fc.record({
    fps: fpsArbitrary,
    paintTime: paintTimeArbitrary,
    layoutTime: layoutTimeArbitrary,
    nodesRendered: nodeRenderCountArbitrary,
    memoryUsage: memoryUsageArbitrary,
    timestamp: fc.integer({ min: 0, max: Date.now() }),
});

/**
 * Arbitrary for generating Web Vitals metrics
 */
export const webVitalsMetricsArbitrary = fc.record({
    lcp: fc.option(lcpArbitrary),
    fcp: fc.option(fcpArbitrary),
    cls: fc.option(clsArbitrary),
    tti: fc.option(ttiArbitrary),
    timestamp: fc.integer({ min: 0, max: Date.now() }),
});

/**
 * Arbitrary for generating virtual list states
 */
export const virtualListStateArbitrary = fc.record({
    itemCount: itemCountArbitrary,
    itemHeight: itemHeightArbitrary,
    scrollOffset: scrollOffsetArbitrary,
    visibleRange: fc.record({
        start: fc.integer({ min: 0, max: 1000 }),
        end: fc.integer({ min: 0, max: 1000 }),
    }),
    bufferSize: bufferSizeArbitrary,
});

// ============================================================================
// Test Data Builders
// ============================================================================

/**
 * Builder for creating performance metrics with fluent API
 */
export class PerformanceMetricsBuilder {
    private metrics: PerformanceMetrics;

    constructor() {
        this.metrics = generateMockPerformanceMetrics();
    }

    withFps(fps: number): this {
        this.metrics.fps = fps;
        return this;
    }

    withPaintTime(paintTime: number): this {
        this.metrics.paintTime = paintTime;
        return this;
    }

    withLayoutTime(layoutTime: number): this {
        this.metrics.layoutTime = layoutTime;
        return this;
    }

    withNodesRendered(count: number): this {
        this.metrics.nodesRendered = count;
        return this;
    }

    withMemoryUsage(usage: number): this {
        this.metrics.memoryUsage = usage;
        return this;
    }

    build(): PerformanceMetrics {
        return { ...this.metrics };
    }
}

/**
 * Builder for creating Web Vitals metrics with fluent API
 */
export class WebVitalsMetricsBuilder {
    private metrics: WebVitalsMetrics;

    constructor() {
        this.metrics = generateMockWebVitalsMetrics();
    }

    withLcp(lcp: number | null): this {
        this.metrics.lcp = lcp;
        return this;
    }

    withFcp(fcp: number | null): this {
        this.metrics.fcp = fcp;
        return this;
    }

    withCls(cls: number | null): this {
        this.metrics.cls = cls;
        return this;
    }

    withTti(tti: number | null): this {
        this.metrics.tti = tti;
        return this;
    }

    build(): WebVitalsMetrics {
        return { ...this.metrics };
    }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that FPS is within acceptable range
 */
export function assertFpsAcceptable(fps: number, minFps: number = 60): boolean {
    return fps >= minFps;
}

/**
 * Asserts that paint time is within acceptable range
 */
export function assertPaintTimeAcceptable(
    paintTime: number,
    maxPaintTime: number = 50
): boolean {
    return paintTime <= maxPaintTime;
}

/**
 * Asserts that layout time is within acceptable range
 */
export function assertLayoutTimeAcceptable(
    layoutTime: number,
    maxLayoutTime: number = 50
): boolean {
    return layoutTime <= maxLayoutTime;
}

/**
 * Asserts that memory usage is within acceptable range
 */
export function assertMemoryUsageAcceptable(
    memoryUsage: number,
    maxMemoryUsage: number = 150 * 1024 * 1024
): boolean {
    return memoryUsage <= maxMemoryUsage;
}

/**
 * Asserts that LCP is within acceptable range
 */
export function assertLcpAcceptable(
    lcp: number | null,
    maxLcp: number = 2500
): boolean {
    return lcp === null || lcp <= maxLcp;
}

/**
 * Asserts that CLS is within acceptable range
 */
export function assertClsAcceptable(
    cls: number | null,
    maxCls: number = 0.1
): boolean {
    return cls === null || cls <= maxCls;
}
