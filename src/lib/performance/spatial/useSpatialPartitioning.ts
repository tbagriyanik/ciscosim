/**
 * useSpatialPartitioning: React hook for managing spatial partitioning in topology
 * 
 * Manages SpatialPartitioner and ViewportCuller instances, handles viewport changes,
 * and provides efficient visibility queries for topology rendering.
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { SpatialPartitioner, ViewportCuller, ViewportState, CullingResult } from './index';
import { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';

export interface UseSpatialPartitioningOptions {
    cellSize?: number;
    margin?: number;
    enabled?: boolean;
}

export interface UseSpatialPartitioningResult {
    visibleDeviceIds: string[];
    visibleConnectionIds: string[];
    updateViewport: (viewport: ViewportState) => void;
    invalidateCache: () => void;
    getStats: () => any;
}

/**
 * Hook for managing spatial partitioning in topology rendering
 */
export function useSpatialPartitioning(
    devices: CanvasDevice[],
    connections: CanvasConnection[],
    options: UseSpatialPartitioningOptions = {}
): UseSpatialPartitioningResult {
    const { cellSize = 256, margin = 100, enabled = true } = options;

    // Initialize partitioner and culler
    const partitionerRef = useRef<SpatialPartitioner | null>(null);
    const cullerRef = useRef<ViewportCuller | null>(null);
    const viewportRef = useRef<ViewportState | null>(null);

    // Use state to track culling result (safe to access during render)
    const [cullingResult, setCullingResult] = useState<CullingResult | null>(null);

    // Initialize spatial partitioning
    useEffect(() => {
        if (!enabled) return;

        // Create partitioner if not exists
        if (!partitionerRef.current) {
            partitionerRef.current = new SpatialPartitioner(cellSize);
        }

        // Create culler if not exists
        if (!cullerRef.current && partitionerRef.current) {
            cullerRef.current = new ViewportCuller(partitionerRef.current, margin);
        }

        // Update partitioner with current devices
        if (partitionerRef.current) {
            partitionerRef.current.clear();

            // Assign nodes
            const nodes = devices.map(d => ({
                id: d.id,
                x: d.x,
                y: d.y,
            }));
            partitionerRef.current.assignNodes(nodes);

            // Assign connections
            const nodeMap = new Map(nodes.map(n => [n.id, n]));
            connections.forEach(conn => {
                partitionerRef.current!.assignConnection(
                    {
                        id: conn.id,
                        sourceNodeId: conn.sourceDeviceId,
                        targetNodeId: conn.targetDeviceId,
                    },
                    nodeMap
                );
            });
        }

        // Update culler with current devices and connections
        if (cullerRef.current) {
            cullerRef.current.setNodes(
                devices.map(d => ({
                    id: d.id,
                    x: d.x,
                    y: d.y,
                }))
            );

            cullerRef.current.setConnections(
                connections.map(c => ({
                    id: c.id,
                    sourceNodeId: c.sourceDeviceId,
                    targetNodeId: c.targetDeviceId,
                }))
            );
        }
    }, [devices, connections, cellSize, margin, enabled]);

    // Update viewport and perform culling
    const updateViewport = useCallback((viewport: ViewportState) => {
        if (!enabled || !cullerRef.current) return;

        viewportRef.current = viewport;
        setCullingResult(cullerRef.current.cull(viewport));
    }, [enabled]);

    // Get visible device IDs
    const visibleDeviceIds = useMemo(() => {
        if (!enabled || !cullingResult) {
            return devices.map(d => d.id);
        }
        return cullingResult.visibleNodeIds;
    }, [devices, enabled, cullingResult]);

    // Get visible connection IDs
    const visibleConnectionIds = useMemo(() => {
        if (!enabled || !cullingResult) {
            return connections.map(c => c.id);
        }
        return cullingResult.visibleConnectionIds;
    }, [connections, enabled, cullingResult]);

    // Invalidate cache
    const invalidateCache = useCallback(() => {
        if (cullerRef.current) {
            cullerRef.current.invalidateCache();
        }
    }, []);

    // Get statistics
    const getStats = useCallback(() => {
        if (!cullerRef.current) return null;
        return cullerRef.current.getStats();
    }, []);

    return {
        visibleDeviceIds,
        visibleConnectionIds,
        updateViewport,
        invalidateCache,
        getStats,
    };
}
