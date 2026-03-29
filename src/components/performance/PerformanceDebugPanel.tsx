/**
 * PerformanceDebugPanel - Debug panel for displaying rendering performance metrics
 * 
 * Requirement 7.6: Create debug panel and console API for metrics
 * Exposes getMetrics() method for accessing current metrics
 * Creates debug panel component to display metrics
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRenderingPerformance } from '@/lib/performance/monitoring/RenderingPerformanceMonitor';
import { RenderingMetrics, FrameDropEvent } from '@/lib/performance/monitoring/RenderingPerformanceMonitor';

interface PerformanceDebugPanelProps {
    isOpen?: boolean;
    onClose?: () => void;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * Debug panel component that displays rendering performance metrics
 */
export const PerformanceDebugPanel: React.FC<PerformanceDebugPanelProps> = ({
    isOpen = false,
    onClose,
    position = 'top-right',
}) => {
    const performance = useRenderingPerformance();
    const [metrics, setMetrics] = useState<RenderingMetrics | null>(null);
    const [frameDropHistory, setFrameDropHistory] = useState<FrameDropEvent[]>([]);
    const [averageFps, setAverageFps] = useState<number>(60);
    const [isExpanded, setIsExpanded] = useState(isOpen);

    // Update metrics periodically
    useEffect(() => {
        if (!isExpanded) return;

        const interval = setInterval(() => {
            setMetrics(performance.getMetrics());
            setFrameDropHistory(performance.getFrameDropHistory());
            setAverageFps(performance.getAverageFps());
        }, 500); // Update every 500ms

        return () => clearInterval(interval);
    }, [isExpanded, performance]);

    // Start tracking on mount
    useEffect(() => {
        performance.startTracking();
        return () => {
            performance.stopTracking();
        };
    }, [performance]);

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="fixed p-2 bg-gray-800 text-white text-xs rounded cursor-pointer hover:bg-gray-700 z-50"
                style={{
                    [position.includes('top') ? 'top' : 'bottom']: '10px',
                    [position.includes('right') ? 'right' : 'left']: '10px',
                }}
                title="Open Performance Debug Panel"
            >
                Perf
            </button>
        );
    }

    const positionClasses = {
        'top-right': 'top-0 right-0',
        'top-left': 'top-0 left-0',
        'bottom-right': 'bottom-0 right-0',
        'bottom-left': 'bottom-0 left-0',
    };

    const fpsColor = metrics
        ? metrics.fps >= 60
            ? 'text-green-400'
            : metrics.fps >= 45
                ? 'text-yellow-400'
                : 'text-red-400'
        : 'text-gray-400';

    return (
        <div
            className={`fixed ${positionClasses[position]} bg-gray-900 text-white text-xs border border-gray-700 rounded shadow-lg z-50 max-w-sm`}
            style={{
                maxHeight: '400px',
                overflow: 'auto',
            }}
        >
            {/* Header */}
            <div className="sticky top-0 bg-gray-800 px-3 py-2 border-b border-gray-700 flex justify-between items-center">
                <span className="font-bold">Performance Monitor</span>
                <button
                    onClick={() => {
                        setIsExpanded(false);
                        onClose?.();
                    }}
                    className="text-gray-400 hover:text-white cursor-pointer"
                >
                    ✕
                </button>
            </div>

            {/* Content */}
            <div className="p-3 space-y-3">
                {/* FPS Section */}
                <div className="border-b border-gray-700 pb-2">
                    <div className="font-semibold mb-1">Frame Rate</div>
                    <div className={`text-lg font-bold ${fpsColor}`}>
                        {metrics?.fps ?? 'N/A'} FPS
                    </div>
                    <div className="text-gray-400 text-xs mt-1">
                        Avg: {averageFps} FPS
                    </div>
                </div>

                {/* Rendering Metrics */}
                <div className="border-b border-gray-700 pb-2">
                    <div className="font-semibold mb-1">Rendering</div>
                    <div className="space-y-1 text-gray-300">
                        <div>Paint Time: {metrics?.paintTime.toFixed(2) ?? 'N/A'} ms</div>
                        <div>Layout Time: {metrics?.layoutTime.toFixed(2) ?? 'N/A'} ms</div>
                        <div>Render Time: {metrics?.renderingTime.toFixed(2) ?? 'N/A'} ms</div>
                    </div>
                </div>

                {/* Node Rendering */}
                <div className="border-b border-gray-700 pb-2">
                    <div className="font-semibold mb-1">Nodes</div>
                    <div className="text-gray-300">
                        Rendered: {metrics?.nodesRendered ?? 'N/A'}
                    </div>
                </div>

                {/* Frame Drops */}
                <div className="border-b border-gray-700 pb-2">
                    <div className="font-semibold mb-1">Frame Drops</div>
                    <div className="text-red-400">
                        Total: {metrics?.frameDrops ?? 0}
                    </div>
                    {frameDropHistory.length > 0 && (
                        <div className="mt-2 max-h-32 overflow-y-auto">
                            <div className="text-gray-400 text-xs mb-1">Recent drops:</div>
                            {frameDropHistory.slice(-5).map((event, idx) => (
                                <div key={idx} className="text-gray-400 text-xs">
                                    {event.fps} FPS @ {new Date(event.timestamp).toLocaleTimeString()}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Memory */}
                <div className="pb-2">
                    <div className="font-semibold mb-1">Memory</div>
                    <div className="text-gray-300">
                        {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : 'N/A'}
                    </div>
                </div>

                {/* Controls */}
                <div className="border-t border-gray-700 pt-2 flex gap-2">
                    <button
                        onClick={() => performance.reset()}
                        className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs cursor-pointer"
                    >
                        Reset
                    </button>
                    <button
                        onClick={() => {
                            const metricsData = performance.getMetrics();
                            console.log('Performance Metrics:', metricsData);
                        }}
                        className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs cursor-pointer"
                    >
                        Log
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PerformanceDebugPanel;
