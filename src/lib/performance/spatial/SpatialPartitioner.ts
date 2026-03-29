/**
 * SpatialPartitioner: Grid-based spatial partitioning for topology optimization
 * 
 * Divides the topology into a grid of cells (256x256px) and assigns nodes to cells
 * based on their position. Provides efficient cell lookup and range query methods.
 * 
 * Validates: Requirements 2.1
 */

import { SpatialCell, SpatialBounds, SpatialPartition, SpatialQuery } from '../types';

export interface Node {
    id: string;
    x: number;
    y: number;
}

export interface Connection {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
}

/**
 * SpatialPartitioner manages grid-based spatial partitioning for efficient
 * topology rendering and querying.
 */
export class SpatialPartitioner {
    private cellSize: number;
    private cells: Map<string, SpatialCell>;
    private nodePositions: Map<string, { x: number; y: number }>;
    private bounds: SpatialBounds;

    /**
     * Creates a new SpatialPartitioner instance
     * @param cellSize - Size of each grid cell in pixels (default: 256)
     * @param bounds - Initial bounds of the spatial partition
     */
    constructor(
        cellSize: number = 256,
        bounds: SpatialBounds = { x: 0, y: 0, width: 3000, height: 2000 }
    ) {
        this.cellSize = cellSize;
        this.cells = new Map();
        this.nodePositions = new Map();
        this.bounds = bounds;
    }

    /**
     * Gets the cell key for a given position
     * @param x - X coordinate
     * @param y - Y coordinate
     * @returns Cell key in format "cellX,cellY"
     */
    private getCellKey(x: number, y: number): string {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }

    /**
     * Gets or creates a cell at the given key
     * @param key - Cell key
     * @returns The spatial cell
     */
    private getOrCreateCell(key: string): SpatialCell {
        if (!this.cells.has(key)) {
            const [cellX, cellY] = key.split(',').map(Number);
            this.cells.set(key, {
                x: cellX * this.cellSize,
                y: cellY * this.cellSize,
                nodeIds: [],
                connectionIds: [],
            });
        }
        return this.cells.get(key)!;
    }

    /**
     * Assigns a node to the spatial partition
     * @param node - Node to assign
     */
    assignNode(node: Node): void {
        const cellKey = this.getCellKey(node.x, node.y);
        const cell = this.getOrCreateCell(cellKey);

        // Remove from old cell if it exists
        const oldKey = Array.from(this.cells.entries()).find(
            ([_, c]) => c.nodeIds.includes(node.id)
        )?.[0];
        if (oldKey && oldKey !== cellKey) {
            const oldCell = this.cells.get(oldKey)!;
            oldCell.nodeIds = oldCell.nodeIds.filter(id => id !== node.id);
        }

        // Add to new cell
        if (!cell.nodeIds.includes(node.id)) {
            cell.nodeIds.push(node.id);
        }

        // Update position tracking
        this.nodePositions.set(node.id, { x: node.x, y: node.y });
    }

    /**
     * Assigns multiple nodes to the spatial partition
     * @param nodes - Array of nodes to assign
     */
    assignNodes(nodes: Node[]): void {
        nodes.forEach(node => this.assignNode(node));
    }

    /**
     * Removes a node from the spatial partition
     * @param nodeId - ID of the node to remove
     */
    removeNode(nodeId: string): void {
        // Find and remove from cell
        for (const cell of this.cells.values()) {
            const index = cell.nodeIds.indexOf(nodeId);
            if (index !== -1) {
                cell.nodeIds.splice(index, 1);
            }
        }

        // Remove position tracking
        this.nodePositions.delete(nodeId);
    }

    /**
     * Assigns a connection to cells containing its endpoints
     * @param connection - Connection to assign
     * @param nodes - Map of node IDs to nodes for position lookup
     */
    assignConnection(connection: Connection, nodes: Map<string, Node>): void {
        const sourceNode = nodes.get(connection.sourceNodeId);
        const targetNode = nodes.get(connection.targetNodeId);

        if (!sourceNode || !targetNode) return;

        const sourceCellKey = this.getCellKey(sourceNode.x, sourceNode.y);
        const targetCellKey = this.getCellKey(targetNode.x, targetNode.y);

        // Add to source cell
        const sourceCell = this.getOrCreateCell(sourceCellKey);
        if (!sourceCell.connectionIds.includes(connection.id)) {
            sourceCell.connectionIds.push(connection.id);
        }

        // Add to target cell if different
        if (sourceCellKey !== targetCellKey) {
            const targetCell = this.getOrCreateCell(targetCellKey);
            if (!targetCell.connectionIds.includes(connection.id)) {
                targetCell.connectionIds.push(connection.id);
            }
        }
    }

    /**
     * Removes a connection from the spatial partition
     * @param connectionId - ID of the connection to remove
     */
    removeConnection(connectionId: string): void {
        for (const cell of this.cells.values()) {
            const index = cell.connectionIds.indexOf(connectionId);
            if (index !== -1) {
                cell.connectionIds.splice(index, 1);
            }
        }
    }

    /**
     * Gets a cell by its key
     * @param key - Cell key in format "cellX,cellY"
     * @returns The spatial cell or undefined
     */
    getCell(key: string): SpatialCell | undefined {
        return this.cells.get(key);
    }

    /**
     * Gets all cells that intersect with the given bounds
     * @param bounds - Query bounds
     * @returns Array of cell keys
     */
    getCellsInBounds(bounds: SpatialBounds): string[] {
        const cellKeys: string[] = [];
        const startCellX = Math.floor(bounds.x / this.cellSize);
        const startCellY = Math.floor(bounds.y / this.cellSize);
        const endCellX = Math.ceil((bounds.x + bounds.width) / this.cellSize);
        const endCellY = Math.ceil((bounds.y + bounds.height) / this.cellSize);

        for (let x = startCellX; x < endCellX; x++) {
            for (let y = startCellY; y < endCellY; y++) {
                const key = `${x},${y}`;
                if (this.cells.has(key)) {
                    cellKeys.push(key);
                }
            }
        }

        return cellKeys;
    }

    /**
     * Performs a range query to find nodes within bounds
     * @param query - Query parameters
     * @returns Array of node IDs within the query bounds
     */
    rangeQuery(query: SpatialQuery): string[] {
        const { bounds, includeMargin = false, marginSize = 0 } = query;

        // Expand bounds by margin if requested
        const queryBounds = includeMargin
            ? {
                x: bounds.x - marginSize,
                y: bounds.y - marginSize,
                width: bounds.width + marginSize * 2,
                height: bounds.height + marginSize * 2,
            }
            : bounds;

        const cellKeys = this.getCellsInBounds(queryBounds);
        const nodeIds = new Set<string>();

        for (const key of cellKeys) {
            const cell = this.cells.get(key);
            if (cell) {
                cell.nodeIds.forEach(id => nodeIds.add(id));
            }
        }

        return Array.from(nodeIds);
    }

    /**
     * Performs a range query to find connections within bounds
     * @param query - Query parameters
     * @returns Array of connection IDs within the query bounds
     */
    rangeQueryConnections(query: SpatialQuery): string[] {
        const { bounds, includeMargin = false, marginSize = 0 } = query;

        // Expand bounds by margin if requested
        const queryBounds = includeMargin
            ? {
                x: bounds.x - marginSize,
                y: bounds.y - marginSize,
                width: bounds.width + marginSize * 2,
                height: bounds.height + marginSize * 2,
            }
            : bounds;

        const cellKeys = this.getCellsInBounds(queryBounds);
        const connectionIds = new Set<string>();

        for (const key of cellKeys) {
            const cell = this.cells.get(key);
            if (cell) {
                cell.connectionIds.forEach(id => connectionIds.add(id));
            }
        }

        return Array.from(connectionIds);
    }

    /**
     * Clears all cells and resets the partition
     */
    clear(): void {
        this.cells.clear();
        this.nodePositions.clear();
    }

    /**
     * Gets the current partition state
     * @returns Current spatial partition
     */
    getPartition(): SpatialPartition {
        return {
            cellSize: this.cellSize,
            cells: new Map(this.cells),
            bounds: this.bounds,
            nodePositions: new Map(this.nodePositions),
        };
    }

    /**
     * Updates the bounds of the spatial partition
     * @param bounds - New bounds
     */
    setBounds(bounds: SpatialBounds): void {
        this.bounds = bounds;
    }

    /**
     * Gets the cell size
     * @returns Cell size in pixels
     */
    getCellSize(): number {
        return this.cellSize;
    }

    /**
     * Gets the number of cells
     * @returns Number of cells
     */
    getCellCount(): number {
        return this.cells.size;
    }

    /**
     * Gets the total number of nodes in the partition
     * @returns Total node count
     */
    getNodeCount(): number {
        return this.nodePositions.size;
    }
}
