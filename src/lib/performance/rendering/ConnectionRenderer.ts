/**
 * Efficient Connection Line Rendering System
 * Implements batch rendering, incremental updates, and spatial indexing
 * for optimized topology connection rendering
 */

export interface Connection {
    id: string;
    fromId: string;
    toId: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    visible: boolean;
    changed?: boolean;
}

export interface ConnectionRenderBatch {
    connections: Connection[];
    timestamp: number;
    batchId: string;
}

export interface ConnectionRendererConfig {
    batchSize?: number;
    useCanvas?: boolean;
    useSVG?: boolean;
    zoomLevel?: number;
    enableSpatialIndexing?: boolean;
}

/**
 * Spatial index for quick connection visibility determination
 */
class ConnectionSpatialIndex {
    private cellSize: number;
    private cells: Map<string, Set<string>> = new Map();
    private connectionBounds: Map<string, { minX: number; maxX: number; minY: number; maxY: number }> = new Map();

    constructor(cellSize: number = 256) {
        this.cellSize = cellSize;
    }

    /**
     * Add connection to spatial index
     */
    public addConnection(connection: Connection): void {
        const bounds = this.calculateBounds(connection);
        this.connectionBounds.set(connection.id, bounds);

        // Add to all cells that the connection spans
        const minCellX = Math.floor(bounds.minX / this.cellSize);
        const maxCellX = Math.floor(bounds.maxX / this.cellSize);
        const minCellY = Math.floor(bounds.minY / this.cellSize);
        const maxCellY = Math.floor(bounds.maxY / this.cellSize);

        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                const cellKey = `${x},${y}`;
                if (!this.cells.has(cellKey)) {
                    this.cells.set(cellKey, new Set());
                }
                this.cells.get(cellKey)!.add(connection.id);
            }
        }
    }

    /**
     * Remove connection from spatial index
     */
    public removeConnection(connectionId: string): void {
        const bounds = this.connectionBounds.get(connectionId);
        if (!bounds) return;

        const minCellX = Math.floor(bounds.minX / this.cellSize);
        const maxCellX = Math.floor(bounds.maxX / this.cellSize);
        const minCellY = Math.floor(bounds.minY / this.cellSize);
        const maxCellY = Math.floor(bounds.maxY / this.cellSize);

        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                const cellKey = `${x},${y}`;
                this.cells.get(cellKey)?.delete(connectionId);
            }
        }

        this.connectionBounds.delete(connectionId);
    }

    /**
     * Query connections in viewport
     */
    public queryViewport(
        viewportX: number,
        viewportY: number,
        viewportWidth: number,
        viewportHeight: number
    ): Set<string> {
        const result = new Set<string>();

        const minCellX = Math.floor(viewportX / this.cellSize);
        const maxCellX = Math.floor((viewportX + viewportWidth) / this.cellSize);
        const minCellY = Math.floor(viewportY / this.cellSize);
        const maxCellY = Math.floor((viewportY + viewportHeight) / this.cellSize);

        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                const cellKey = `${x},${y}`;
                const cellConnections = this.cells.get(cellKey);
                if (cellConnections) {
                    cellConnections.forEach((id) => result.add(id));
                }
            }
        }

        return result;
    }

    /**
     * Calculate bounds of a connection
     */
    private calculateBounds(connection: Connection): {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    } {
        return {
            minX: Math.min(connection.from.x, connection.to.x),
            maxX: Math.max(connection.from.x, connection.to.x),
            minY: Math.min(connection.from.y, connection.to.y),
            maxY: Math.max(connection.from.y, connection.to.y),
        };
    }

    /**
     * Clear the index
     */
    public clear(): void {
        this.cells.clear();
        this.connectionBounds.clear();
    }
}

/**
 * ConnectionRenderer - Efficiently renders topology connections
 * Implements batch rendering, incremental updates, and spatial indexing
 */
export class ConnectionRenderer {
    private connections: Map<string, Connection> = new Map();
    private changedConnections: Set<string> = new Set();
    private batchQueue: Connection[] = [];
    private batchSize: number;
    private useCanvas: boolean;
    private useSVG: boolean;
    private zoomLevel: number;
    private spatialIndex: ConnectionSpatialIndex;
    private enableSpatialIndexing: boolean;
    private lastRenderTime: number = 0;
    private renderBatches: ConnectionRenderBatch[] = [];
    private maxBatchHistory: number = 100;

    constructor(config: ConnectionRendererConfig = {}) {
        this.batchSize = config.batchSize || 100;
        this.useCanvas = config.useCanvas !== false;
        this.useSVG = config.useSVG !== false;
        this.zoomLevel = config.zoomLevel || 1;
        this.enableSpatialIndexing = config.enableSpatialIndexing !== false;
        this.spatialIndex = new ConnectionSpatialIndex();
    }

    /**
     * Add a connection to the renderer
     */
    public addConnection(connection: Connection): void {
        this.connections.set(connection.id, connection);
        this.changedConnections.add(connection.id);

        if (this.enableSpatialIndexing) {
            this.spatialIndex.addConnection(connection);
        }
    }

    /**
     * Remove a connection from the renderer
     */
    public removeConnection(connectionId: string): void {
        this.connections.delete(connectionId);
        this.changedConnections.delete(connectionId);

        if (this.enableSpatialIndexing) {
            this.spatialIndex.removeConnection(connectionId);
        }
    }

    /**
     * Update a connection
     */
    public updateConnection(connection: Connection): void {
        this.connections.set(connection.id, connection);
        this.changedConnections.add(connection.id);

        if (this.enableSpatialIndexing) {
            this.spatialIndex.removeConnection(connection.id);
            this.spatialIndex.addConnection(connection);
        }
    }

    /**
     * Get visible connections for a viewport
     */
    public getVisibleConnections(
        viewportX: number,
        viewportY: number,
        viewportWidth: number,
        viewportHeight: number
    ): Connection[] {
        if (!this.enableSpatialIndexing) {
            // Fallback: return all visible connections
            return Array.from(this.connections.values()).filter(
                (c) => c.visible
            );
        }

        const visibleIds = this.spatialIndex.queryViewport(
            viewportX,
            viewportY,
            viewportWidth,
            viewportHeight
        );

        return Array.from(visibleIds)
            .map((id) => this.connections.get(id))
            .filter((c) => c && c.visible) as Connection[];
    }

    /**
     * Batch render operations
     * Collects changed connections and prepares them for rendering
     */
    public batchRender(): ConnectionRenderBatch {
        const batch: ConnectionRenderBatch = {
            connections: Array.from(this.changedConnections)
                .map((id) => this.connections.get(id))
                .filter((c) => c !== undefined) as Connection[],
            timestamp: Date.now(),
            batchId: `batch-${Date.now()}-${Math.random()}`,
        };

        // Store batch in history
        this.renderBatches.push(batch);
        if (this.renderBatches.length > this.maxBatchHistory) {
            this.renderBatches.shift();
        }

        // Clear changed connections
        this.changedConnections.clear();
        this.lastRenderTime = Date.now();

        return batch;
    }

    /**
     * Mark all connections as changed (full redraw)
     */
    public markAllChanged(): void {
        this.connections.forEach((_, id) => {
            this.changedConnections.add(id);
        });
    }

    /**
     * Get the number of changed connections
     */
    public getChangedCount(): number {
        return this.changedConnections.size;
    }

    /**
     * Get the total number of connections
     */
    public getTotalCount(): number {
        return this.connections.size;
    }

    /**
     * Get visible connection count for a viewport
     */
    public getVisibleCount(
        viewportX: number,
        viewportY: number,
        viewportWidth: number,
        viewportHeight: number
    ): number {
        return this.getVisibleConnections(
            viewportX,
            viewportY,
            viewportWidth,
            viewportHeight
        ).length;
    }

    /**
     * Set zoom level and adapt rendering
     */
    public setZoomLevel(zoomLevel: number): void {
        this.zoomLevel = zoomLevel;
        // Mark all as changed to trigger re-render with new zoom
        this.markAllChanged();
    }

    /**
     * Get rendering statistics
     */
    public getStats(): {
        totalConnections: number;
        changedConnections: number;
        lastRenderTime: number;
        zoomLevel: number;
        batchesRendered: number;
    } {
        return {
            totalConnections: this.getTotalCount(),
            changedConnections: this.getChangedCount(),
            lastRenderTime: this.lastRenderTime,
            zoomLevel: this.zoomLevel,
            batchesRendered: this.renderBatches.length,
        };
    }

    /**
     * Get render batch history
     */
    public getBatchHistory(): ConnectionRenderBatch[] {
        return [...this.renderBatches];
    }

    /**
     * Clear all connections
     */
    public clear(): void {
        this.connections.clear();
        this.changedConnections.clear();
        this.batchQueue = [];
        this.spatialIndex.clear();
        this.renderBatches = [];
    }

    /**
     * Destroy the renderer
     */
    public destroy(): void {
        this.clear();
    }
}

/**
 * Create a ConnectionRenderer with default configuration
 */
export function createConnectionRenderer(
    config?: ConnectionRendererConfig
): ConnectionRenderer {
    return new ConnectionRenderer(config);
}
