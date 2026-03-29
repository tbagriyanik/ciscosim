# RenderingPerformanceMonitor Usage Guide

## Overview

The `RenderingPerformanceMonitor` tracks rendering performance metrics including:
- **FPS (Frames Per Second)** - Continuous frame rate tracking
- **Paint Time** - Time to first paint and largest contentful paint
- **Layout Time** - Time spent in layout calculations
- **Node Render Count** - Number of nodes rendered in topology
- **Rendering Time** - Total time spent rendering
- **Frame Drops** - Detection and logging of frame drops below 60 FPS

## Requirements Implemented

- **Requirement 7.1**: FPS tracking using requestAnimationFrame
- **Requirement 7.2**: Paint time measurement using Performance API
- **Requirement 7.3**: Layout time measurement and node render tracking
- **Requirement 7.4**: Metrics available for analysis and debugging
- **Requirement 7.5**: Frame drop detection and warning logging
- **Requirement 7.6**: Debug panel and console API for metrics

## Basic Usage

### Using the Hook (Recommended for React Components)

```typescript
import { useRenderingPerformance } from '@/lib/performance/monitoring';

export function MyComponent() {
  const performance = useRenderingPerformance();

  useEffect(() => {
    // Start tracking FPS
    performance.startTracking();

    return () => {
      performance.stopTracking();
    };
  }, [performance]);

  useEffect(() => {
    // Update metrics periodically
    const interval = setInterval(() => {
      const metrics = performance.getMetrics();
      console.log('Current FPS:', metrics.fps);
      console.log('Nodes rendered:', metrics.nodesRendered);
    }, 1000);

    return () => clearInterval(interval);
  }, [performance]);

  return <div>Performance tracking active</div>;
}
```

### Using the Singleton Instance

```typescript
import { getRenderingPerformanceMonitor } from '@/lib/performance/monitoring';

const monitor = getRenderingPerformanceMonitor();

// Start tracking
monitor.startTracking();

// Track rendering
monitor.startRenderMeasurement();
// ... do rendering work ...
monitor.endRenderMeasurement();

// Track nodes
monitor.setNodesRendered(100);

// Get metrics
const metrics = monitor.getMetrics();
console.log(metrics);

// Stop tracking
monitor.stopTracking();
```

## Console API

The console API provides easy access to performance metrics from the browser console.

### Initialization

```typescript
import { initializePerformanceConsoleAPI } from '@/lib/performance/monitoring';

// Call this once during app initialization
initializePerformanceConsoleAPI();
```

### Using the Console API

Once initialized, you can access metrics from the browser console:

```javascript
// Get current metrics
window.performance.getMetrics()

// Get average FPS
window.performance.getAverageFps()

// Get frame drop history
window.performance.getFrameDropHistory()

// Start/stop tracking
window.performance.startTracking()
window.performance.stopTracking()

// Reset metrics
window.performance.resetMetrics()

// Log metrics to console
window.performance.logMetrics()

// Log frame drops to console
window.performance.logFrameDrops()
```

### Alternative Access via __PERFORMANCE__

```javascript
// All methods are also available via window.__PERFORMANCE__
window.__PERFORMANCE__.getMetrics()
window.__PERFORMANCE__.logMetrics()
```

## Debug Panel Component

The `PerformanceDebugPanel` component provides a visual interface for monitoring performance.

### Basic Usage

```typescript
import { PerformanceDebugPanel } from '@/components/performance/PerformanceDebugPanel';

export function App() {
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <>
      <YourApp />
      <PerformanceDebugPanel 
        isOpen={debugOpen}
        onClose={() => setDebugOpen(false)}
        position="top-right"
      />
    </>
  );
}
```

### Props

- `isOpen?: boolean` - Whether the panel is expanded (default: false)
- `onClose?: () => void` - Callback when close button is clicked
- `position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'` - Panel position (default: 'top-right')

### Features

- Real-time FPS display with color coding (green/yellow/red)
- Paint and layout time metrics
- Node render count
- Frame drop tracking and history
- Reset and log buttons
- Collapsible interface

## Metrics Object

The `getMetrics()` method returns an object with the following properties:

```typescript
interface RenderingMetrics {
  fps: number;              // Current frames per second
  paintTime: number;        // Paint time in milliseconds
  layoutTime: number;       // Layout time in milliseconds
  nodesRendered: number;    // Number of nodes rendered
  renderingTime: number;    // Total rendering time in milliseconds
  frameDrops: number;       // Total frame drops detected
  timestamp: number;        // Timestamp of metrics collection
}
```

## Frame Drop Detection

Frame drops are automatically detected when FPS falls below the threshold (default: 60 FPS).

### Accessing Frame Drop History

```typescript
const monitor = getRenderingPerformanceMonitor();
const history = monitor.getFrameDropHistory();

// Each entry contains:
// {
//   fps: number;           // FPS at time of drop
//   timestamp: number;     // When the drop occurred
//   context?: string;      // Optional context information
// }
```

### Frame Drop Warnings

Frame drops are logged to the console with warnings:

```
[PerformanceMonitor] Frame drop detected: FPS 45 below threshold 60
```

## Configuration

You can customize the monitor behavior:

```typescript
import { RenderingPerformanceMonitor } from '@/lib/performance/monitoring';

const monitor = new RenderingPerformanceMonitor({
  fpsThreshold: 45,        // Frame drop threshold (default: 60)
  sampleInterval: 500,     // Sample interval in ms (default: 1000)
  maxHistorySize: 100,     // Max frame drop history size (default: 300)
});
```

## Best Practices

1. **Initialize Console API Early**: Call `initializePerformanceConsoleAPI()` during app initialization for easy debugging.

2. **Use Hooks in React**: Prefer `useRenderingPerformance()` hook in React components for proper cleanup.

3. **Track Rendering Operations**: Wrap rendering operations with `startRenderMeasurement()` and `endRenderMeasurement()`.

4. **Update Node Count**: Call `setNodesRendered()` after rendering topology nodes.

5. **Monitor Frame Drops**: Check frame drop history periodically to identify performance issues.

6. **Use Debug Panel in Development**: Enable the debug panel during development to monitor performance in real-time.

## Example: Topology Rendering

```typescript
import { useRenderingPerformance } from '@/lib/performance/monitoring';

export function TopologyRenderer() {
  const performance = useRenderingPerformance();

  useEffect(() => {
    performance.startTracking();
    return () => performance.stopTracking();
  }, [performance]);

  const renderTopology = (nodes: Node[]) => {
    performance.startRenderMeasurement();

    // Render nodes
    const rendered = nodes.filter(node => isVisible(node));
    rendered.forEach(node => renderNode(node));

    performance.endRenderMeasurement();
    performance.setNodesRendered(rendered.length);
  };

  return (
    <div>
      {/* Topology rendering */}
    </div>
  );
}
```

## Example: Performance Monitoring Dashboard

```typescript
import { useRenderingPerformance } from '@/lib/performance/monitoring';

export function PerformanceDashboard() {
  const performance = useRenderingPerformance();
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    performance.startTracking();

    const interval = setInterval(() => {
      setMetrics(performance.getMetrics());
    }, 500);

    return () => {
      clearInterval(interval);
      performance.stopTracking();
    };
  }, [performance]);

  if (!metrics) return <div>Loading...</div>;

  return (
    <div>
      <h2>Performance Metrics</h2>
      <p>FPS: {metrics.fps}</p>
      <p>Paint Time: {metrics.paintTime.toFixed(2)}ms</p>
      <p>Layout Time: {metrics.layoutTime.toFixed(2)}ms</p>
      <p>Nodes Rendered: {metrics.nodesRendered}</p>
      <p>Frame Drops: {metrics.frameDrops}</p>
    </div>
  );
}
```

## Troubleshooting

### FPS Shows 0 or Very Low

- Ensure `startTracking()` has been called
- Check that `requestAnimationFrame` is supported in your browser
- Verify the component is mounted and active

### Paint/Layout Times Show 0

- These metrics depend on the Performance API
- Some browsers may not support all metrics
- Check browser console for warnings

### Frame Drops Not Detected

- Frame drops are only detected when FPS actually drops below threshold
- System performance may be sufficient to maintain 60 FPS
- Try running more intensive operations

### Console API Not Available

- Ensure `initializePerformanceConsoleAPI()` was called
- Check browser console for initialization message
- Verify you're accessing `window.performance` or `window.__PERFORMANCE__`

## Performance Impact

The monitor has minimal performance impact:
- FPS tracking uses `requestAnimationFrame` (native browser optimization)
- Performance API observers are efficient
- Metrics collection is O(1) operation
- Memory usage is bounded by `maxHistorySize`

## Browser Support

- FPS tracking: All modern browsers (requires `requestAnimationFrame`)
- Performance API: Chrome 25+, Firefox 7+, Safari 11+, Edge 12+
- Paint timing: Chrome 60+, Firefox 97+, Safari 15.4+
- Layout shift: Chrome 77+, Firefox 101+, Safari 15.4+

## See Also

- [PerformanceDebugPanel Component](./PerformanceDebugPanel.tsx)
- [ConsoleAPI](./ConsoleAPI.ts)
- [RenderingPerformanceMonitor](./RenderingPerformanceMonitor.ts)
