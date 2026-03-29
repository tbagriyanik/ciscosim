/**
 * RenderingPerformanceMonitor - Tracks rendering performance metrics
 * 
 * Implements:
 * - FPS tracking using requestAnimationFrame
 * - Paint time and layout time measurement using Performance API
 * - Node render count and rendering time tracking
 * - Frame drop detection and warning logging
 * - Debug panel and console API for metrics
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.5, 7.6
 */

export interface RenderingMetrics {
    fps: number;
    paintTime: number;
    layoutTime: number;
    nodesRendered: number;
    renderingTime: number;
    frameDrops: number;
    timestamp: number;
}

export interface FrameDropEvent {
    fps: number;
    timestamp: number;
    context?: string;
}

export interface RenderingPerformanceConfig {
    fpsThreshold?: number;
    sampleInterval?: number;
    maxHistorySize?: number;
}

/**
 * Tracks rendering performance metrics including FPS, paint time, layout time,
 * and node render counts. Detects frame drops and provides debug APIs.
 */
export class RenderingPerformanceMonitor {
    private fps: number = 60;
    private paintTime: number = 0;
    private layoutTime: number = 0;
    private nodesRendered: number = 0;
    private renderingTime: number = 0;
    private frameDrops: number = 0;
    private frameDropEvents: FrameDropEvent[] = [];

    private fpsThreshold: number;
    private sampleInterval: number;
    private maxHistorySize: number;

    private frameTimestamps: number[] = [];
    private lastFrameTime: number = 0;
    private animationFrameId: number | null = null;
    private isTracking: boolean = false;

    private paintObserver: PerformanceObserver | null = null;
    private layoutObserver: PerformanceObserver | null = null;

    private renderStartTime: number | null = null;
    private renderEndTime: number | null = null;

    constructor(config?: RenderingPerformanceConfig) {
        this.fpsThreshold = config?.fpsThreshold ?? 60;
        this.sampleInterval = config?.sampleInterval ?? 1000; // 1 second
        this.maxHistorySize = config?.maxHistorySize ?? 300; // 5 minutes at 1 sample/sec

        this.initializeObservers();
    }

    /**
     * Initialize Performance API observers for paint and layout timing
     */
    private initializeObservers(): void {
        if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
            return;
        }

        try {
            // Observe paint timing (FCP, LCP)
            this.paintObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'paint') {
                        this.paintTime = entry.startTime;
                    }
                    if (entry.entryType === 'largest-contentful-paint') {
                        this.paintTime = Math.max(this.paintTime, entry.startTime);
                    }
                }
            });

            this.paintObserver.observe({
                entryTypes: ['paint', 'largest-contentful-paint'],
                buffered: true,
            });
        } catch (e) {
            console.warn('Paint observer initialization failed:', e);
        }

        try {
            // Observe layout timing
            this.layoutObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'layout-shift') {
                        this.layoutTime = Math.max(this.layoutTime, entry.startTime);
                    }
                }
            });

            this.layoutObserver.observe({
                entryTypes: ['layout-shift'],
                buffered: true,
            });
        } catch (e) {
            console.warn('Layout observer initialization failed:', e);
        }
    }

    /**
     * Start FPS tracking using requestAnimationFrame
     * Requirement 7.1: FPS tracking using requestAnimationFrame
     */
    public startTracking(): void {
        if (this.isTracking) {
            return;
        }

        this.isTracking = true;
        this.frameTimestamps = [];
        this.lastFrameTime = performance.now();

        const trackFrame = () => {
            const now = performance.now();
            const deltaTime = now - this.lastFrameTime;

            // Record frame timestamp
            this.frameTimestamps.push(now);

            // Keep only recent frames (last second)
            const oneSecondAgo = now - this.sampleInterval;
            while (this.frameTimestamps.length > 0 && this.frameTimestamps[0] < oneSecondAgo) {
                this.frameTimestamps.shift();
            }

            // Calculate FPS
            if (this.frameTimestamps.length > 1) {
                const timeSpan = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
                if (timeSpan > 0) {
                    this.fps = Math.round((this.frameTimestamps.length - 1) / (timeSpan / 1000));
                }
            }

            // Detect frame drops
            this.detectFrameDrops();

            this.lastFrameTime = now;

            if (this.isTracking) {
                this.animationFrameId = requestAnimationFrame(trackFrame);
            }
        };

        this.animationFrameId = requestAnimationFrame(trackFrame);
    }

    /**
     * Stop FPS tracking
     */
    public stopTracking(): void {
        this.isTracking = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Detect frame drops below threshold
     * Requirement 7.5: Detect when FPS drops below 60
     */
    private detectFrameDrops(): void {
        if (this.fps < this.fpsThreshold) {
            this.frameDrops++;
            const event: FrameDropEvent = {
                fps: this.fps,
                timestamp: performance.now(),
            };
            this.frameDropEvents.push(event);

            // Keep history size bounded
            if (this.frameDropEvents.length > this.maxHistorySize) {
                this.frameDropEvents.shift();
            }

            // Log warning
            this.logFrameDropWarning(this.fps);
        }
    }

    /**
     * Log frame drop warning with context
     * Requirement 7.5: Log warnings with frame rate and context
     */
    private logFrameDropWarning(fps: number, context?: string): void {
        const message = `Frame drop detected: FPS ${fps} below threshold ${this.fpsThreshold}${context ? ` (${context})` : ''}`;
        console.warn(`[PerformanceMonitor] ${message}`);
    }

    /**
     * Start measuring render time
     * Requirement 7.2, 7.3: Measure paint time and layout time
     */
    public startRenderMeasurement(): void {
        this.renderStartTime = performance.now();
    }

    /**
     * End measuring render time
     */
    public endRenderMeasurement(): void {
        if (this.renderStartTime !== null) {
            this.renderEndTime = performance.now();
            this.renderingTime = this.renderEndTime - this.renderStartTime;
            this.renderStartTime = null;
        }
    }

    /**
     * Track node render count
     * Requirement 7.3: Track node render count and rendering time
     */
    public setNodesRendered(count: number): void {
        this.nodesRendered = count;
    }

    /**
     * Get current rendering metrics
     * Requirement 7.4: Metrics available for analysis and debugging
     */
    public getMetrics(): RenderingMetrics {
        return {
            fps: this.fps,
            paintTime: this.paintTime,
            layoutTime: this.layoutTime,
            nodesRendered: this.nodesRendered,
            renderingTime: this.renderingTime,
            frameDrops: this.frameDrops,
            timestamp: performance.now(),
        };
    }

    /**
     * Get frame drop history
     */
    public getFrameDropHistory(): FrameDropEvent[] {
        return [...this.frameDropEvents];
    }

    /**
     * Get average FPS over time
     */
    public getAverageFps(): number {
        if (this.frameTimestamps.length < 2) {
            return this.fps;
        }

        const timeSpan = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
        if (timeSpan === 0) {
            return this.fps;
        }

        return Math.round((this.frameTimestamps.length - 1) / (timeSpan / 1000));
    }

    /**
     * Reset all metrics
     */
    public reset(): void {
        this.fps = 60;
        this.paintTime = 0;
        this.layoutTime = 0;
        this.nodesRendered = 0;
        this.renderingTime = 0;
        this.frameDrops = 0;
        this.frameDropEvents = [];
        this.frameTimestamps = [];
    }

    /**
     * Cleanup resources
     */
    public destroy(): void {
        this.stopTracking();

        if (this.paintObserver) {
            this.paintObserver.disconnect();
            this.paintObserver = null;
        }

        if (this.layoutObserver) {
            this.layoutObserver.disconnect();
            this.layoutObserver = null;
        }
    }
}

// Global singleton instance
let globalMonitor: RenderingPerformanceMonitor | null = null;

/**
 * Get or create the global rendering performance monitor
 */
export function getRenderingPerformanceMonitor(
    config?: RenderingPerformanceConfig
): RenderingPerformanceMonitor {
    if (!globalMonitor) {
        globalMonitor = new RenderingPerformanceMonitor(config);
    }
    return globalMonitor;
}

/**
 * Hook for accessing rendering performance metrics
 */
export function useRenderingPerformance() {
    const monitor = getRenderingPerformanceMonitor();

    return {
        getMetrics: () => monitor.getMetrics(),
        startTracking: () => monitor.startTracking(),
        stopTracking: () => monitor.stopTracking(),
        startRenderMeasurement: () => monitor.startRenderMeasurement(),
        endRenderMeasurement: () => monitor.endRenderMeasurement(),
        setNodesRendered: (count: number) => monitor.setNodesRendered(count),
        getFrameDropHistory: () => monitor.getFrameDropHistory(),
        getAverageFps: () => monitor.getAverageFps(),
        reset: () => monitor.reset(),
    };
}
