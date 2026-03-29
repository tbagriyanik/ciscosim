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

// Memory Optimization
export {
    NodePool,
    createNodePool,
    createDefaultNodeFactory,
    type PooledNode,
    type NodePoolConfig,
} from './memory/NodePool';

// Connection Rendering
export {
    ConnectionRenderer,
    createConnectionRenderer,
    type Connection,
    type ConnectionRenderBatch,
    type ConnectionRendererConfig,
} from './rendering/ConnectionRenderer';

// State Management
export {
    useTopologyStore,
    selectNodes,
    selectNodeCount,
    selectSelectedNodeId,
    selectSelectedNode,
    selectNodeById,
    selectConnections,
    selectConnectionCount,
    selectConnectionById,
    selectViewport,
    selectZoomLevel,
    selectViewportBounds,
    selectNodesByViewport,
    selectConnectionsByViewport,
    useTopologySelector,
    type TopologyNode,
    type TopologyConnection,
    type ViewportState,
    type TopologyState,
} from './state/topologyStore';

// Types
export * from './types';
