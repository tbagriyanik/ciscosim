import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SpatialPartitioner, Node } from '../spatial/SpatialPartitioner';
import type { SpatialBounds } from '../types';

/**
 * Property-Based Tests for Spatial Partitioning
 * 
 * **Validates: Requirements 2.1**
 * Feature: ui-ux-performance-improvements-phase2
 * Property 5: Topology Spatial Partitioning
 * 
 * These tests validate that nodes are correctly assigned to spatial cells
 * and that the spatial partitioning system maintains correctness invariants.
 */

// Arbitraries for generating test data
const nodeIdArbitrary = fc.string({
    minLength: 1,
    maxLength: 20,
    unit: fc.integer({ min: 97, max: 122 }).map((code) => String.fromCharCode(code)),
});

const nodeArbitrary = fc.record({
    id: nodeIdArbitrary,
    x: fc.float({ min: 0, max: 3000, noNaN: true }),
    y: fc.float({ min: 0, max: 2000, noNaN: true }),
});

// Generate unique nodes by index to avoid duplicate IDs
const nodesArbitrary = fc
    .array(fc.record({ x: fc.float({ min: 0, max: 3000, noNaN: true }), y: fc.float({ min: 0, max: 2000, noNaN: true }) }), { minLength: 1, maxLength: 100 })
    .map((nodes) => nodes.map((node, idx) => ({ id: `node-${idx}`, ...node })));

const cellSizeArbitrary = fc.integer({ min: 64, max: 512 });

const spatialBoundsArbitrary = fc.record({
    x: fc.integer({ min: 0, max: 1000 }),
    y: fc.integer({ min: 0, max: 1000 }),
    width: fc.integer({ min: 100, max: 2000 }),
    height: fc.integer({ min: 100, max: 2000 }),
});

describe('SpatialPartitioner - Property Tests', () => {
    describe('Property 5: Topology Spatial Partitioning', () => {
        /**
         * **Validates: Requirements 2.1**
         * 
         * For any topology with nodes at various positions, each node SHALL be
         * assigned to exactly one cell based on its position, and the cell assignment
         * SHALL be deterministic (same input produces same output).
         * 
         * Property: For all nodes, node_cell = floor(node.x / cellSize), floor(node.y / cellSize)
         * Property: Cell assignment is deterministic
         */
        it('should assign nodes to correct cells based on position', () => {
            fc.assert(
                fc.property(nodesArbitrary, cellSizeArbitrary, (nodes, cellSize) => {
                    const partitioner = new SpatialPartitioner(cellSize);
                    partitioner.assignNodes(nodes);

                    // Verify each node is in the correct cell
                    nodes.forEach((node) => {
                        const expectedCellX = Math.floor(node.x / cellSize);
                        const expectedCellY = Math.floor(node.y / cellSize);
                        const expectedCellKey = `${expectedCellX},${expectedCellY}`;

                        // Get the cell and verify the node is in it
                        const cell = partitioner.getCell(expectedCellKey);
                        expect(cell).toBeDefined();
                        expect(cell!.nodeIds).toContain(node.id);
                    });
                })
            );
        });

        /**
         * **Validates: Requirements 2.1**
         * 
         * For any set of nodes assigned to a spatial partitioner, all nodes in a cell
         * SHALL be within the cell bounds (x, y) to (x + cellSize, y + cellSize).
         * 
         * Property: For all nodes in cell, cell.x <= node.x < cell.x + cellSize AND
         *           cell.y <= node.y < cell.y + cellSize
         */
        it('should ensure all nodes in a cell are within cell bounds', () => {
            fc.assert(
                fc.property(nodesArbitrary, cellSizeArbitrary, (nodes, cellSize) => {
                    const partitioner = new SpatialPartitioner(cellSize);
                    partitioner.assignNodes(nodes);

                    const partition = partitioner.getPartition();

                    // Verify all nodes in each cell are within bounds
                    partition.cells.forEach((cell) => {
                        cell.nodeIds.forEach((nodeId) => {
                            const nodePos = partition.nodePositions.get(nodeId);
                            expect(nodePos).toBeDefined();

                            const node = nodePos!;
                            expect(node.x).toBeGreaterThanOrEqual(cell.x);
                            expect(node.x).toBeLessThan(cell.x + cellSize);
                            expect(node.y).toBeGreaterThanOrEqual(cell.y);
                            expect(node.y).toBeLessThan(cell.y + cellSize);
                        });
                    });
                })
            );
        });

        /**
         * **Validates: Requirements 2.1**
         * 
         * For any set of nodes assigned to a spatial partitioner, no nodes SHALL be
         * missed or duplicated across cells. Each node SHALL appear in exactly one cell.
         * 
         * Property: For all nodes, count(node in cells) = 1
         * Property: sum(cell.nodeIds.length) = total_nodes
         */
        it('should not miss or duplicate nodes across cells', () => {
            fc.assert(
                fc.property(nodesArbitrary, cellSizeArbitrary, (nodes, cellSize) => {
                    const partitioner = new SpatialPartitioner(cellSize);
                    partitioner.assignNodes(nodes);

                    const partition = partitioner.getPartition();

                    // Count total nodes across all cells
                    let totalNodesInCells = 0;
                    const nodeIdsSeen = new Set<string>();

                    partition.cells.forEach((cell) => {
                        cell.nodeIds.forEach((nodeId) => {
                            totalNodesInCells++;
                            nodeIdsSeen.add(nodeId);
                        });
                    });

                    // Verify no duplicates (each node appears exactly once)
                    expect(nodeIdsSeen.size).toBe(totalNodesInCells);

                    // Verify all nodes are accounted for
                    expect(totalNodesInCells).toBe(nodes.length);

                    // Verify all node IDs are present
                    nodes.forEach((node) => {
                        expect(nodeIdsSeen).toContain(node.id);
                    });
                })
            );
        });

        /**
         * **Validates: Requirements 2.1**
         * 
         * For any set of nodes assigned to a spatial partitioner, the cell assignment
         * SHALL be deterministic. Assigning the same nodes twice SHALL produce the same
         * cell assignments.
         * 
         * Property: assign(nodes) = assign(nodes) (deterministic)
         */
        it('should maintain deterministic cell assignment', () => {
            fc.assert(
                fc.property(nodesArbitrary, cellSizeArbitrary, (nodes, cellSize) => {
                    // First assignment
                    const partitioner1 = new SpatialPartitioner(cellSize);
                    partitioner1.assignNodes(nodes);
                    const partition1 = partitioner1.getPartition();

                    // Second assignment with same data
                    const partitioner2 = new SpatialPartitioner(cellSize);
                    partitioner2.assignNodes(nodes);
                    const partition2 = partitioner2.getPartition();

                    // Verify cell assignments are identical
                    expect(partition1.cells.size).toBe(partition2.cells.size);

                    partition1.cells.forEach((cell1, key) => {
                        const cell2 = partition2.cells.get(key);
                        expect(cell2).toBeDefined();
                        expect(cell2!.nodeIds).toEqual(cell1.nodeIds);
                        expect(cell2!.x).toBe(cell1.x);
                        expect(cell2!.y).toBe(cell1.y);
                    });
                })
            );
        });

        /**
         * **Validates: Requirements 2.1**
         * 
         * For any node that is moved to a new position, it SHALL be reassigned to the
         * correct cell based on its new position, and SHALL be removed from its old cell.
         * 
         * Property: When node position changes, node moves to correct new cell
         * Property: Node is removed from old cell
         */
        it('should correctly reassign nodes when position changes', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    fc.array(
                        fc.record({
                            x: fc.float({ min: 0, max: 3000, noNaN: true }),
                            y: fc.float({ min: 0, max: 2000, noNaN: true }),
                        }),
                        { minLength: 1, maxLength: 50 }
                    ),
                    (initialNodes, cellSize, updatedPositions) => {
                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(initialNodes);

                        // Update positions of some nodes
                        updatedPositions.forEach((pos, idx) => {
                            if (idx < initialNodes.length) {
                                partitioner.assignNode({
                                    id: initialNodes[idx].id,
                                    ...pos,
                                });
                            }
                        });

                        const partition = partitioner.getPartition();

                        // Verify updated nodes are in correct cells
                        updatedPositions.forEach((pos, idx) => {
                            if (idx < initialNodes.length) {
                                const nodeId = initialNodes[idx].id;
                                const expectedCellX = Math.floor(pos.x / cellSize);
                                const expectedCellY = Math.floor(pos.y / cellSize);
                                const expectedCellKey = `${expectedCellX},${expectedCellY}`;

                                const cell = partitioner.getCell(expectedCellKey);
                                expect(cell).toBeDefined();
                                expect(cell!.nodeIds).toContain(nodeId);
                            }
                        });

                        // Verify no node appears in multiple cells
                        const nodeIdCounts = new Map<string, number>();
                        partition.cells.forEach((cell) => {
                            cell.nodeIds.forEach((nodeId) => {
                                nodeIdCounts.set(nodeId, (nodeIdCounts.get(nodeId) || 0) + 1);
                            });
                        });

                        nodeIdCounts.forEach((count) => {
                            expect(count).toBe(1);
                        });
                    }
                )
            );
        });

        /**
         * **Validates: Requirements 2.1**
         * 
         * For any spatial partitioner, the range query SHALL return all nodes within
         * the specified bounds, and SHALL not return nodes outside the bounds.
         * 
         * Property: For all nodes in rangeQuery(bounds), node is within bounds
         * Property: For all nodes within bounds, node is in rangeQuery(bounds)
         */
        it('should correctly query nodes within spatial bounds', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    (nodes, cellSize) => {
                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(nodes);

                        // Create query bounds that encompass all nodes
                        let minX = Infinity,
                            minY = Infinity,
                            maxX = -Infinity,
                            maxY = -Infinity;
                        nodes.forEach((node) => {
                            minX = Math.min(minX, node.x);
                            minY = Math.min(minY, node.y);
                            maxX = Math.max(maxX, node.x);
                            maxY = Math.max(maxY, node.y);
                        });

                        // Create query bounds that include all nodes with some padding
                        const queryBounds = {
                            x: minX - 10,
                            y: minY - 10,
                            width: maxX - minX + 20,
                            height: maxY - minY + 20,
                        };

                        // Perform range query
                        const queryResult = partitioner.rangeQuery({ bounds: queryBounds });

                        // Get the actual nodes from the result
                        const partition = partitioner.getPartition();
                        const queriedNodes = queryResult
                            .map((nodeId) => {
                                const pos = partition.nodePositions.get(nodeId);
                                return pos ? { id: nodeId, ...pos } : null;
                            })
                            .filter((n) => n !== null) as Node[];

                        // Verify all queried nodes are within bounds
                        queriedNodes.forEach((node) => {
                            expect(node.x).toBeGreaterThanOrEqual(queryBounds.x);
                            expect(node.x).toBeLessThanOrEqual(queryBounds.x + queryBounds.width);
                            expect(node.y).toBeGreaterThanOrEqual(queryBounds.y);
                            expect(node.y).toBeLessThanOrEqual(queryBounds.y + queryBounds.height);
                        });

                        // Verify all nodes are in the query result (since bounds encompass all)
                        nodes.forEach((node) => {
                            expect(queryResult).toContain(node.id);
                        });
                    }
                )
            );
        });

        /**
         * **Validates: Requirements 2.1**
         * 
         * For any spatial partitioner with nodes, removing a node SHALL remove it from
         * its cell and from the node position tracking, and SHALL not affect other nodes.
         * 
         * Property: After removeNode(id), node is not in any cell
         * Property: After removeNode(id), other nodes remain in their cells
         */
        it('should correctly remove nodes from cells', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    fc.integer({ min: 0, max: 100 }),
                    (nodes, cellSize, removeCount) => {
                        if (nodes.length === 0) return;

                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(nodes);

                        // Remove some nodes
                        const nodesToRemove = nodes.slice(0, Math.min(removeCount, nodes.length));
                        nodesToRemove.forEach((node) => {
                            partitioner.removeNode(node.id);
                        });

                        const partition = partitioner.getPartition();

                        // Verify removed nodes are not in any cell
                        nodesToRemove.forEach((node) => {
                            partition.cells.forEach((cell) => {
                                expect(cell.nodeIds).not.toContain(node.id);
                            });
                        });

                        // Verify remaining nodes are still in their cells
                        const remainingNodes = nodes.slice(Math.min(removeCount, nodes.length));
                        remainingNodes.forEach((node) => {
                            const expectedCellX = Math.floor(node.x / cellSize);
                            const expectedCellY = Math.floor(node.y / cellSize);
                            const expectedCellKey = `${expectedCellX},${expectedCellY}`;

                            const cell = partitioner.getCell(expectedCellKey);
                            expect(cell).toBeDefined();
                            expect(cell!.nodeIds).toContain(node.id);
                        });
                    }
                )
            );
        });

        /**
         * **Validates: Requirements 2.1**
         * 
         * For any spatial partitioner, the cell size SHALL remain constant and
         * SHALL correctly determine cell boundaries for all positions.
         * 
         * Property: cellSize is constant throughout partitioner lifetime
         * Property: Cell boundaries are correctly calculated: cell_x = floor(pos_x / cellSize)
         */
        it('should maintain consistent cell size and boundaries', () => {
            fc.assert(
                fc.property(nodesArbitrary, cellSizeArbitrary, (nodes, cellSize) => {
                    const partitioner = new SpatialPartitioner(cellSize);
                    partitioner.assignNodes(nodes);

                    // Verify cell size is consistent
                    expect(partitioner.getCellSize()).toBe(cellSize);

                    // Verify cell boundaries are correct
                    const partition = partitioner.getPartition();
                    partition.cells.forEach((cell) => {
                        // Cell coordinates should be multiples of cellSize
                        expect(cell.x % cellSize).toBe(0);
                        expect(cell.y % cellSize).toBe(0);

                        // Cell boundaries should be correct
                        const cellEndX = cell.x + cellSize;
                        const cellEndY = cell.y + cellSize;

                        cell.nodeIds.forEach((nodeId) => {
                            const nodePos = partition.nodePositions.get(nodeId);
                            expect(nodePos).toBeDefined();

                            const node = nodePos!;
                            expect(node.x).toBeGreaterThanOrEqual(cell.x);
                            expect(node.x).toBeLessThan(cellEndX);
                            expect(node.y).toBeGreaterThanOrEqual(cell.y);
                            expect(node.y).toBeLessThan(cellEndY);
                        });
                    });
                })
            );
        });
    });
});
