/**
 * ViewportCuller: Viewport-based culling for topology rendering
 * 
 * Determines which nodes and connections are visible within the current viewport
 * plus a margin, enabling efficient rendering of large topologies.
 * 
 * Validates: Requirements 2.3, 2.5
 */

import { SpatialBounds, SpatialQuery } from '../types';
import { SpatialPartitioner, Node, Connection } from './SpatialPartitioner';

export interface ViewportState {
    x: number;
    y: number;
    width: number;
    height: number;
    zoom: number;
}

export interface CullingResult {
    visibleNodeIds: string[];
    visibleConnectionIds: string[];
    viewport: SpatialBounds;
    margin: number;
}

/**
 * ViewportCuller manages viewport-based culling for efficient topology rendering
 */
export class ViewportCuller {
    private spatialPartitioner: SpatialPartitioner;
    private margin: number;
    private lastViewport: ViewportState | null = null;
    private lastCullingResult: CullingResult | null = null;
    private nodeMap: Map<string, Node>;
    private connectionMap: Map<string, Connection>;

    /**
     * Creates a new ViewportCuller instance
     * @param spatialPartitioner - The spatial partitioner to use for queries
     * @param margin - Margin around viewport to include in culling (default: 100px)
     */
    constructor(spatialPartitioner: SpatialPartitioner, margin: number = 100) {
        this.spatialPartitioner = spatialPartitioner;
        this.margin = margin;
        this.nodeMap = new Map();
        this.connectionMap = new Map();
    }

    /**
     * Updates the node map for connection visibility queries
     * @param nodes - Array of nodes
     */
    setNodes(nodes: Node[]): void {
        this.nodeMap.clear();
        nodes.forEach(node => this.nodeMap.set(node.id, node));
    }

    /**
     * Updates the connection map for visibility queries
     * @param connections - Array of connections
     */
    setConnections(connections: Connection[]): void {
        this.connectionMap.clear();
        connections.forEach(conn => this.connectionMap.set(conn.id, conn));
    }

    /**
     * Converts viewport state to spatial bounds
     * @param viewport - Current viewport state
     * @returns Spatial bounds in world coordinates
     */
    private viewportToBounds(viewport: ViewportState): SpatialBounds {
        // Convert screen coordinates to world coordinates
        const x = -viewport.x / viewport.zoom;
        const y = -viewport.y / viewport.zoom;
        const width = viewport.width / viewport.zoom;
        const height = viewport.height / viewport.zoom;

        return { x, y, width, height };
    }

    /**
     * Checks if viewport has changed significantly
     * @param viewport - Current viewport state
     * @returns True if viewport has changed
     */
    private hasViewportChanged(viewport: ViewportState): boolean {
        if (!this.lastViewport) return true;

        // Check if any viewport parameter changed
        return (
            this.lastViewport.x !== viewport.x ||
            this.lastViewport.y !== viewport.y ||
            this.lastViewport.width !== viewport.width ||
            this.lastViewport.height !== viewport.height ||
            this.lastViewport.zoom !== viewport.zoom
        );
    }

    /**
     * Determines which connections are visible based on node visibility
     * @param visibleNodeIds - Set of visible node IDs
     * @returns Array of visible connection IDs
     */
    private getVisibleConnections(visibleNodeIds: Set<string>): string[] {
        const visibleConnections: string[] = [];

        for (const [connId, connection] of this.connectionMap) {
            const sourceVisible = visibleNodeIds.has(connection.sourceNodeId);
            const targetVisible = visibleNodeIds.has(connection.targetNodeId);

            // Include connection if at least one endpoint is visible
            if (sourceVisible || targetVisible) {
                visibleConnections.push(connId);
            }
        }

        return visibleConnections;
    }

    /**
     * Performs viewport culling to determine visible nodes and connections
     * @param viewport - Current viewport state
     * @returns Culling result with visible nodes and connections
     */
    cull(viewport: ViewportState): CullingResult {
        // Return cached result if viewport hasn't changed
        if (!this.hasViewportChanged(viewport) && this.lastCullingResult) {
            return this.lastCullingResult;
        }

        // Convert viewport to world bounds
        const bounds = this.viewportToBounds(viewport);

        // Query spatial partitioner for visible nodes
        const query: SpatialQuery = {
            bounds,
            includeMargin: true,
            marginSize: this.margin,
        };

        const visibleNodeIds = this.spatialPartitioner.rangeQuery(query);
        const visibleNodeIdSet = new Set(visibleNodeIds);

        // Determine visible connections
        const visibleConnectionIds = this.getVisibleConnections(visibleNodeIdSet);

        // Create culling result
        const result: CullingResult = {
            visibleNodeIds,
            visibleConnectionIds,
            viewport: bounds,
            margin: this.margin,
        };

        // Cache result
        this.lastCullingResult = result;
        this.lastViewport = { ...viewport };

        return result;
    }

    /**
     * Performs viewport culling with explicit bounds (for testing)
     * @param bounds - Explicit bounds to query
     * @returns Culling result with visible nodes and connections
     */
    cullWithBounds(bounds: SpatialBounds): CullingResult {
        const query: SpatialQuery = {
            bounds,
            includeMargin: true,
            marginSize: this.margin,
        };

        const visibleNodeIds = this.spatialPartitioner.rangeQuery(query);
        const visibleNodeIdSet = new Set(visibleNodeIds);

        // Determine visible connections
        const visibleConnectionIds = this.getVisibleConnections(visibleNodeIdSet);

        return {
            visibleNodeIds,
            visibleConnectionIds,
            viewport: bounds,
            margin: this.margin,
        };
    }

    /**
     * Checks if a node is visible in the current viewport
     * @param nodeId - Node ID to check
     * @param viewport - Current viewport state
     * @returns True if node is visible
     */
    isNodeVisible(nodeId: string, viewport: ViewportState): boolean {
        const result = this.cull(viewport);
        return result.visibleNodeIds.includes(nodeId);
    }

    /**
     * Checks if a connection is visible in the current viewport
     * @param connectionId - Connection ID to check
     * @param viewport - Current viewport state
     * @returns True if connection is visible
     */
    isConnectionVisible(connectionId: string, viewport: ViewportState): boolean {
        const result = this.cull(viewport);
        return result.visibleConnectionIds.includes(connectionId);
    }

    /**
     * Gets the current margin size
     * @returns Margin size in pixels
     */
    getMargin(): number {
        return this.margin;
    }

    /**
     * Sets the margin size
     * @param margin - New margin size in pixels
     */
    setMargin(margin: number): void {
        this.margin = margin;
        // Invalidate cache
        this.lastCullingResult = null;
    }

    /**
     * Invalidates the culling cache
     */
    invalidateCache(): void {
        this.lastCullingResult = null;
        this.lastViewport = null;
    }

    /**
     * Gets the last culling result
     * @returns Last culling result or null
     */
    getLastResult(): CullingResult | null {
        return this.lastCullingResult;
    }

    /**
     * Gets statistics about the last culling operation
     * @returns Culling statistics
     */
    getStats(): {
        visibleNodeCount: number;
        visibleConnectionCount: number;
        totalNodeCount: number;
        totalConnectionCount: number;
        cullingRatio: number;
    } | null {
        if (!this.lastCullingResult) return null;

        const totalNodeCount = this.nodeMap.size;
        const totalConnectionCount = this.connectionMap.size;
        const visibleNodeCount = this.lastCullingResult.visibleNodeIds.length;
        const visibleConnectionCount = this.lastCullingResult.visibleConnectionIds.length;

        return {
            visibleNodeCount,
            visibleConnectionCount,
            totalNodeCount,
            totalConnectionCount,
            cullingRatio: totalNodeCount > 0 ? visibleNodeCount / totalNodeCount : 0,
        };
    }
}
