# Performance Monitoring Integration Examples

## Quick Start

### 1. Initialize Console API (App Root)

```typescript
// src/app/layout.tsx or src/app/page.tsx
import { initializePerformanceConsoleAPI } from '@/lib/performance/monitoring';

export default function RootLayout({ children }) {
  // Initialize console API for debugging
  useEffect(() => {
    initializePerformanceConsoleAPI();
  }, []);

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

### 2. Add Debug Panel to App

```typescript
// src/app/page.tsx
import { PerformanceDebugPanel } from '@/components/performance/PerformanceDebugPanel';

export default function Page() {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <>
      <YourMainContent />
      {isDevelopment && (
        <PerformanceDebugPanel 
          isOpen={true}
          position="top-right"
        />
      )}
    </>
  );
}
```

## Integration with Topology Renderer

### Example: Track Topology Rendering Performance

```typescript
// src/components/network/NetworkTopology.tsx
import { useRenderingPerformance } from '@/lib/performance/monitoring';

export function NetworkTopology() {
  const performance = useRenderingPerformance();
  const [nodes, setNodes] = useState<Node[]>([]);

  // Start tracking on mount
  useEffect(() => {
    performance.startTracking();
    return () => performance.stopTracking();
  }, [performance]);

  // Render topology
  const renderTopology = useCallback(() => {
    performance.startRenderMeasurement();

    // Filter visible nodes
    const visibleNodes = nodes.filter(node => isInViewport(node));

    // Render nodes
    visibleNodes.forEach(node => {
      renderNode(node);
    });

    performance.endRenderMeasurement();
    performance.setNodesRendered(visibleNodes.length);
  }, [nodes, performance]);

  useEffect(() => {
    renderTopology();
  }, [nodes, renderTopology]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
    />
  );
}
```

## Integration with Device List

### Example: Track Virtual List Performance

```typescript
// src/components/network/VirtualDeviceList.tsx
import { useRenderingPerformance } from '@/lib/performance/monitoring';

export function VirtualDeviceList({ items }) {
  const performance = useRenderingPerformance();
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  useEffect(() => {
    performance.startTracking();
    return () => performance.stopTracking();
  }, [performance]);

  const handleScroll = useCallback((e) => {
    performance.startRenderMeasurement();

    // Calculate visible range
    const newRange = calculateVisibleRange(e);
    setVisibleRange(newRange);

    performance.endRenderMeasurement();
    performance.setNodesRendered(newRange.end - newRange.start);
  }, [performance]);

  return (
    <div onScroll={handleScroll}>
      {items.slice(visibleRange.start, visibleRange.end).map(item => (
        <DeviceItem key={item.id} item={item} />
      ))}
    </div>
  );
}
```

## Performance Monitoring Hook

### Example: Custom Hook for Performance Tracking

```typescript
// src/hooks/usePerformanceTracking.ts
import { useEffect, useCallback } from 'react';
import { useRenderingPerformance } from '@/lib/performance/monitoring';

interface PerformanceThresholds {
  maxFps?: number;
  minFps?: number;
  maxRenderTime?: number;
}

export function usePerformanceTracking(
  componentName: string,
  thresholds?: PerformanceThresholds
) {
  const performance = useRenderingPerformance();

  useEffect(() => {
    performance.startTracking();
    return () => performance.stopTracking();
  }, [performance]);

  const trackRender = useCallback(
    (renderFn: () => void) => {
      performance.startRenderMeasurement();
      renderFn();
      performance.endRenderMeasurement();

      const metrics = performance.getMetrics();

      // Check thresholds
      if (thresholds?.minFps && metrics.fps < thresholds.minFps) {
        console.warn(
          `[${componentName}] FPS below threshold: ${metrics.fps} < ${thresholds.minFps}`
        );
      }

      if (thresholds?.maxRenderTime && metrics.renderingTime > thresholds.maxRenderTime) {
        console.warn(
          `[${componentName}] Render time exceeded: ${metrics.renderingTime} > ${thresholds.maxRenderTime}`
        );
      }

      return metrics;
    },
    [performance, componentName, thresholds]
  );

  return {
    trackRender,
    getMetrics: () => performance.getMetrics(),
    getFrameDrops: () => performance.getFrameDropHistory(),
  };
}

// Usage
export function MyComponent() {
  const { trackRender, getMetrics } = usePerformanceTracking('MyComponent', {
    minFps: 60,
    maxRenderTime: 16.67, // 60 FPS budget
  });

  const handleRender = () => {
    trackRender(() => {
      // Rendering code
    });
  };

  return <div onClick={handleRender}>Render</div>;
}
```

## Performance Monitoring Dashboard

### Example: Real-time Performance Dashboard

```typescript
// src/components/performance/PerformanceDashboard.tsx
import { useEffect, useState } from 'react';
import { useRenderingPerformance } from '@/lib/performance/monitoring';
import { RenderingMetrics } from '@/lib/performance/monitoring';

export function PerformanceDashboard() {
  const performance = useRenderingPerformance();
  const [metrics, setMetrics] = useState<RenderingMetrics | null>(null);
  const [history, setHistory] = useState<RenderingMetrics[]>([]);

  useEffect(() => {
    performance.startTracking();

    const interval = setInterval(() => {
      const currentMetrics = performance.getMetrics();
      setMetrics(currentMetrics);
      setHistory(prev => [...prev.slice(-59), currentMetrics]); // Keep last 60 samples
    }, 1000);

    return () => {
      clearInterval(interval);
      performance.stopTracking();
    };
  }, [performance]);

  if (!metrics) return <div>Loading...</div>;

  const avgFps = history.length > 0
    ? Math.round(history.reduce((sum, m) => sum + m.fps, 0) / history.length)
    : 0;

  const maxFrameDrops = Math.max(...history.map(m => m.frameDrops), 0);

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h2 className="text-xl font-bold mb-4">Performance Dashboard</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Current FPS */}
        <div className="bg-white p-4 rounded">
          <div className="text-gray-600">Current FPS</div>
          <div className={`text-3xl font-bold ${
            metrics.fps >= 60 ? 'text-green-600' :
            metrics.fps >= 45 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {metrics.fps}
          </div>
        </div>

        {/* Average FPS */}
        <div className="bg-white p-4 rounded">
          <div className="text-gray-600">Average FPS</div>
          <div className="text-3xl font-bold text-blue-600">
            {avgFps}
          </div>
        </div>

        {/* Render Time */}
        <div className="bg-white p-4 rounded">
          <div className="text-gray-600">Render Time</div>
          <div className="text-2xl font-bold">
            {metrics.renderingTime.toFixed(2)}ms
          </div>
        </div>

        {/* Nodes Rendered */}
        <div className="bg-white p-4 rounded">
          <div className="text-gray-600">Nodes Rendered</div>
          <div className="text-2xl font-bold">
            {metrics.nodesRendered}
          </div>
        </div>

        {/* Frame Drops */}
        <div className="bg-white p-4 rounded">
          <div className="text-gray-600">Frame Drops</div>
          <div className="text-2xl font-bold text-red-600">
            {metrics.frameDrops}
          </div>
        </div>

        {/* Paint Time */}
        <div className="bg-white p-4 rounded">
          <div className="text-gray-600">Paint Time</div>
          <div className="text-2xl font-bold">
            {metrics.paintTime.toFixed(2)}ms
          </div>
        </div>
      </div>

      {/* FPS Chart */}
      <div className="mt-4 bg-white p-4 rounded">
        <div className="text-gray-600 mb-2">FPS History</div>
        <div className="flex items-end gap-1 h-32">
          {history.map((m, i) => (
            <div
              key={i}
              className={`flex-1 ${
                m.fps >= 60 ? 'bg-green-500' :
                m.fps >= 45 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ height: `${(m.fps / 120) * 100}%` }}
              title={`${m.fps} FPS`}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => performance.reset()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Reset
        </button>
        <button
          onClick={() => {
            console.log('Metrics:', metrics);
            console.log('History:', history);
          }}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Log Data
        </button>
      </div>
    </div>
  );
}
```

## Console Usage Examples

### From Browser Console

```javascript
// Get current metrics
const metrics = window.performance.getMetrics();
console.log(metrics);
// Output: {
//   fps: 58,
//   paintTime: 1234.5,
//   layoutTime: 567.8,
//   nodesRendered: 150,
//   renderingTime: 12.3,
//   frameDrops: 2,
//   timestamp: 1234567890
// }

// Get average FPS
window.performance.getAverageFps();
// Output: 59

// Get frame drop history
window.performance.getFrameDropHistory();
// Output: [
//   { fps: 45, timestamp: 1234567800 },
//   { fps: 50, timestamp: 1234567850 }
// ]

// Log metrics to console table
window.performance.logMetrics();

// Log frame drops to console table
window.performance.logFrameDrops();

// Start/stop tracking
window.performance.startTracking();
window.performance.stopTracking();

// Reset metrics
window.performance.resetMetrics();
```

## Performance Alerts

### Example: Alert on Performance Issues

```typescript
// src/hooks/usePerformanceAlerts.ts
import { useEffect } from 'react';
import { useRenderingPerformance } from '@/lib/performance/monitoring';

export function usePerformanceAlerts() {
  const performance = useRenderingPerformance();

  useEffect(() => {
    performance.startTracking();

    const interval = setInterval(() => {
      const metrics = performance.getMetrics();

      // Alert on low FPS
      if (metrics.fps < 45) {
        console.error(`⚠️ Critical: FPS dropped to ${metrics.fps}`);
      }

      // Alert on high render time
      if (metrics.renderingTime > 33.33) { // 30 FPS budget
        console.warn(`⚠️ Warning: Render time ${metrics.renderingTime.toFixed(2)}ms`);
      }

      // Alert on many frame drops
      if (metrics.frameDrops > 10) {
        console.error(`⚠️ Critical: ${metrics.frameDrops} frame drops detected`);
      }
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(interval);
      performance.stopTracking();
    };
  }, [performance]);
}

// Usage in app
export function App() {
  usePerformanceAlerts();
  return <YourApp />;
}
```

## Testing Performance

### Example: Performance Test

```typescript
// src/components/network/__tests__/TopologyPerformance.test.ts
import { describe, it, expect } from 'vitest';
import { getRenderingPerformanceMonitor } from '@/lib/performance/monitoring';

describe('Topology Performance', () => {
  it('should render 1000 nodes at 60 FPS', async () => {
    const monitor = getRenderingPerformanceMonitor();
    monitor.startTracking();

    // Simulate rendering 1000 nodes
    monitor.setNodesRendered(1000);
    monitor.startRenderMeasurement();
    // ... rendering code ...
    monitor.endRenderMeasurement();

    const metrics = monitor.getMetrics();

    expect(metrics.fps).toBeGreaterThanOrEqual(60);
    expect(metrics.renderingTime).toBeLessThan(16.67); // 60 FPS budget
    expect(metrics.nodesRendered).toBe(1000);

    monitor.stopTracking();
  });
});
```

## Conclusion

These examples demonstrate how to integrate the RenderingPerformanceMonitor into various parts of the application for comprehensive performance monitoring and debugging.
