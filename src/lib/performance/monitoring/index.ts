/**
 * Performance monitoring utilities
 * Exports rendering performance monitoring and debug APIs
 */

export {
    RenderingPerformanceMonitor,
    getRenderingPerformanceMonitor,
    useRenderingPerformance,
    type RenderingMetrics,
    type FrameDropEvent,
    type RenderingPerformanceConfig,
} from './RenderingPerformanceMonitor';

export {
    WebVitalsTracker,
    getWebVitalsTracker,
    useWebVitals,
    type WebVitalsConfig,
    type WebVitalsSnapshot,
} from './WebVitalsTracker';

export { initializePerformanceConsoleAPI } from './ConsoleAPI';
