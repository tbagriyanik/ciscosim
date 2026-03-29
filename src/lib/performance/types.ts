/**
 * Core TypeScript interfaces for performance optimization modules
 * Defines types for virtualization, spatial partitioning, and performance monitoring
 */

// ============================================================================
// Virtual List Types
// ============================================================================

export interface VirtualListState {
    itemCount: number;
    itemHeight: number;
    scrollOffset: number;
    visibleRange: { start: number; end: number };
    bufferSize: number;
}

export interface VirtualListConfig {
    itemHeight: number;
    bufferSize?: number;
    overscanCount?: number;
    width?: number | string;
    height?: number | string;
}

export interface VirtualListItem<T = any> {
    index: number;
    data: T;
    style: React.CSSProperties;
}

// ============================================================================
// Spatial Partitioning Types
// ============================================================================

export interface SpatialBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SpatialCell {
    x: number;
    y: number;
    nodeIds: string[];
    connectionIds: string[];
}

export interface SpatialPartition {
    cellSize: number;
    cells: Map<string, SpatialCell>;
    bounds: SpatialBounds;
    nodePositions: Map<string, { x: number; y: number }>;
}

export interface SpatialQuery {
    bounds: SpatialBounds;
    includeMargin?: boolean;
    marginSize?: number;
}

// ============================================================================
// Performance Monitoring Types
// ============================================================================

export interface PerformanceMetrics {
    fps: number;
    paintTime: number;
    layoutTime: number;
    nodesRendered: number;
    memoryUsage: number;
    timestamp: number;
}

export interface PerformanceSnapshot {
    timestamp: number;
    fps: number;
    paintTime: number;
    layoutTime: number;
    nodesRendered: number;
    memoryUsage: number;
    frameDrops: number;
}

export interface PerformanceThresholds {
    minFps?: number;
    maxPaintTime?: number;
    maxLayoutTime?: number;
    maxMemoryUsage?: number;
}

// ============================================================================
// Web Vitals Types
// ============================================================================

export interface WebVitalsMetrics {
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    tti: number | null;
    timestamp: number;
}

export interface WebVitalsThresholds {
    lcpThreshold?: number;
    fcpThreshold?: number;
    clsThreshold?: number;
    ttiThreshold?: number;
}

// ============================================================================
// Lazy Loading Types
// ============================================================================

export interface LazyLoadConfig {
    fallback?: React.ReactNode;
    ssr?: boolean;
    loading?: React.ComponentType<any>;
}

export interface LazyLoadState {
    isLoading: boolean;
    error: Error | null;
    isLoaded: boolean;
}

// ============================================================================
// Skeleton Screen Types
// ============================================================================

export interface SkeletonConfig {
    width?: number | string;
    height?: number | string;
    borderRadius?: number | string;
    animated?: boolean;
    baseColor?: string;
    highlightColor?: string;
}

export interface SkeletonLayoutConfig {
    matchFinalLayout: boolean;
    preventCLS: boolean;
    transitionDuration?: number;
}

// ============================================================================
// Image Optimization Types
// ============================================================================

export interface OptimizedImageConfig {
    width: number;
    height: number;
    alt: string;
    priority?: boolean;
    loading?: 'lazy' | 'eager';
    sizes?: string;
    quality?: number;
}

export interface ResponsiveImageConfig {
    sizes: Array<{
        breakpoint: number;
        width: number;
    }>;
    formats?: string[];
    quality?: number;
}

// ============================================================================
// Memory Optimization Types
// ============================================================================

export interface PooledObject {
    reset(): void;
    acquire(): void;
    release(): void;
}

export interface ObjectPoolConfig {
    initialSize?: number;
    maxSize?: number;
    resetOnRelease?: boolean;
}

export interface MemoryProfile {
    heapUsed: number;
    heapTotal: number;
    external: number;
    timestamp: number;
}

// ============================================================================
// Connection Rendering Types
// ============================================================================

export interface ConnectionRenderBatch {
    connections: Array<{
        id: string;
        from: { x: number; y: number };
        to: { x: number; y: number };
        visible: boolean;
    }>;
    timestamp: number;
}

export interface ConnectionRenderConfig {
    batchSize?: number;
    useCanvas?: boolean;
    useSVG?: boolean;
    zoomLevel?: number;
}

// ============================================================================
// State Update Types
// ============================================================================

export interface StateUpdateBatch {
    updates: Array<{
        key: string;
        value: any;
        timestamp: number;
    }>;
    batchId: string;
    timestamp: number;
}

export interface SelectorConfig {
    memoize?: boolean;
    equalityFn?: (a: any, b: any) => boolean;
}
