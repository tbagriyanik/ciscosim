/**
 * Performance Optimization Library
 * Exports all performance monitoring, optimization, and state management modules
 */

// Monitoring
export {
    RenderingPerformanceMonitor,
    getRenderingPerformanceMonitor,
    useRenderingPerformance,
    type RenderingMetrics,
    type FrameDropEvent,
    type RenderingPerformanceConfig,
} from './monitoring/RenderingPerformanceMonitor';

export {
    WebVitalsTracker,
    getWebVitalsTracker,
    useWebVitals,
    type WebVitalsConfig,
    type WebVitalsSnapshot,
} from './monitoring/WebVitalsTracker';

export { initializePerformanceConsoleAPI } from './monitoring/ConsoleAPI';

// Types
export * from './types';
