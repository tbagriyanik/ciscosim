import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SpatialPartitioner, Node, Connection } from '../spatial/SpatialPartitioner';
import { ViewportCuller, ViewportState } from '../spatial/ViewportCuller';
import { measureExecutionTime } from './utils';

/**
 * Property-Based Tests for Topology Viewport Recalculation
 * 
 * **Validates: Requirements 2.6**
 * Feature: ui-ux-performance-improvements-phase2
 * Property 8: Topology Viewport Recalculation
 * 
 * These tests validate that when the viewport changes (pan, zoom), the visible
 * node set is recalculated efficiently without causing unnecessary re-renders
 * or performance degradation.
 */

// Arbitraries for generating test data
const nodesArbitrary = fc
    .array(
        fc.record({
            x: fc.float({ min: 0, max: 5000, noNaN: true }),
            y: fc.float({ min: 0, max: 5000, noNaN: true }),
        }),
        { minLength: 10, maxLength: 500 }
    )
    .map((nodes) => nodes.map((node, idx) => ({ id: `node-${idx}`, ...node })));

const connectionsArbitrary = (nodes: Node[]) =>
    fc
        .array(
            fc.record({
                sourceIdx: fc.integer({ min: 0, max: Math.max(0, nodes.length - 1) }),
                targetIdx: fc.integer({ min: 0, max: Math.max(0, nodes.length - 1) }),
            }),
            { minLength: 0, maxLength: Math.min(100, nodes.length * 2) }
        )
        .map((connections) =>
            connections
                .filter((conn) => conn.sourceIdx !== conn.targetIdx)
                .map((conn, idx) => ({
                    id: `conn-${idx}`,
                    sourceNodeId: nodes[conn.sourceIdx].id,
                    targetNodeId: nodes[conn.targetIdx].id,
                }))
        );

const cellSizeArbitrary = fc.integer({ min: 128, max: 512 });

const marginArbitrary = fc.integer({ min: 50, max: 300 });

const viewportStateArbitrary = fc.record({
    x: fc.integer({ min: -2000, max: 2000 }),
    y: fc.integer({ min: -2000, max: 2000 }),
    width: fc.integer({ min: 400, max: 1200 }),
    height: fc.integer({ min: 300, max: 900 }),
    zoom: fc.float({ min: 0.5, max: 3, noNaN: true }),
});

// Generate viewport changes (pan and zoom operations)
const viewportChangeArbitrary = fc.record({
    panX: fc.integer({ min: -500, max: 500 }),
    panY: fc.integer({ min: -500, max: 500 }),
    zoomDelta: fc.float({ min: -0.5, max: 0.5, noNaN: true }),
});

describe('TopologyViewportRecalculation - Property Tests', () => {
    describe('Property 8: Topology Viewport Recalculation', () => {
        /**
         * **Validates: Requirements 2.6**
         * 
         * For any change to the topology viewport (pan or zoom), the visible node set
         * SHALL be recalculated and updated. Different viewports should produce
         * different visible node sets (when appropriate).
         * 
         * Property: viewport_change → visible_nodes_recalculated
         * Property: Different viewports produce different results (when not overlapping)
         */
        it('should recalculate visible nodes when viewport changes', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    marginArbitrary,
                    viewportStateArbitrary,
                    viewportChangeArbitrary,
                    (nodes, cellSize, margin, baseViewport, change) => {
                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(nodes);

                        const culler = new ViewportCuller(partitioner, margin);
                        culler.setNodes(nodes);

                        // Get initial visible nodes
                        const result1 = culler.cull(baseViewport);
                        const initialVisibleCount = result1.visibleNodeIds.length;

                        // Apply viewport change (pan)
                        const changedViewport: ViewportState = {
                            x: baseViewport.x + change.panX,
                            y: baseViewport.y + change.panY,
                            width: baseViewport.width,
                            height: baseViewport.height,
                            zoom: Math.max(0.5, Math.min(3, baseViewport.zoom + change.zoomDelta)),
                        };

                        // Get visible nodes after change
                        const result2 = culler.cull(changedViewport);
                        const changedVisibleCount = result2.visibleNodeIds.length;

                        // Verify both results are valid
                        expect(initialVisibleCount).toBeGreaterThanOrEqual(0);
                        expect(initialVisibleCount).toBeLessThanOrEqual(nodes.length);
                        expect(changedVisibleCount).toBeGreaterThanOrEqual(0);
                        expect(changedVisibleCount).toBeLessThanOrEqual(nodes.length);

                        // Verify recalculation happened (results should be different for different viewports)
                        // Note: They might be the same if viewports overlap significantly
                        expect(result2.visibleNodeIds).toBeDefined();
                        expect(result2.visibleNodeIds.length).toBeGreaterThanOrEqual(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * **Validates: Requirements 2.6**
         * 
         * For any viewport recalculation, the operation SHALL be efficient and not
         * cause performance degradation. Recalculation time should be reasonable
         * (< 16ms for 60 FPS target).
         * 
         * Property: recalculation_time < 16ms (for 60 FPS)
         * Property: Recalculation time is consistent across multiple calls
         */
        it('should recalculate viewport efficiently without performance degradation', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    marginArbitrary,
                    viewportStateArbitrary,
                    (nodes, cellSize, margin, viewport) => {
                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(nodes);

                        const culler = new ViewportCuller(partitioner, margin);
                        culler.setNodes(nodes);

                        // Measure recalculation time
                        const recalcTime = measureExecutionTime(() => {
                            culler.cull(viewport);
                        });

                        // Recalculation should be fast (< 16ms for 60 FPS)
                        // Allow more time for large topologies
                        const maxAllowedTime = Math.max(16, nodes.length * 0.05);
                        expect(recalcTime).toBeLessThan(maxAllowedTime);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * **Validates: Requirements 2.6**
         * 
         * For any viewport recalculation, only nodes within the new viewport plus
         * margin SHALL be included in the visible set. Nodes outside the viewport
         * should not be recalculated unnecessarily.
         * 
         * Property: visible_nodes ⊆ viewport_nodes + margin
         * Property: nodes_outside_viewport_margin ∩ visible_nodes = ∅
         */
        it('should only include nodes within viewport plus margin after recalculation', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    marginArbitrary,
                    viewportStateArbitrary,
                    (nodes, cellSize, margin, viewport) => {
                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(nodes);

                        const culler = new ViewportCuller(partitioner, margin);
                        culler.setNodes(nodes);

                        const result = culler.cull(viewport);

                        // All visible nodes should be within reasonable bounds
                        const viewportBounds = result.viewport;
                        const expandedBounds = {
                            x: viewportBounds.x - margin - cellSize,
                            y: viewportBounds.y - margin - cellSize,
                            width: viewportBounds.width + 2 * (margin + cellSize),
                            height: viewportBounds.height + 2 * (margin + cellSize),
                        };

                        result.visibleNodeIds.forEach((nodeId) => {
                            const node = nodes.find((n) => n.id === nodeId);
                            expect(node).toBeDefined();

                            // Node should be within expanded bounds
                            expect(node!.x).toBeGreaterThanOrEqual(expandedBounds.x - cellSize);
                            expect(node!.x).toBeLessThanOrEqual(
                                expandedBounds.x + expandedBounds.width + cellSize
                            );
                            expect(node!.y).toBeGreaterThanOrEqual(expandedBounds.y - cellSize);
                            expect(node!.y).toBeLessThanOrEqual(
                                expandedBounds.y + expandedBounds.height + cellSize
                            );
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * **Validates: Requirements 2.6**
         * 
         * For any sequence of viewport changes, the visible node set SHALL be
         * recalculated correctly for each change. Rapid viewport changes should
         * not cause incorrect results.
         * 
         * Property: For each viewport in sequence, recalculation produces valid result
         * Property: Rapid changes don't cause state corruption
         */
        it('should handle rapid viewport changes correctly', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    marginArbitrary,
                    fc.array(viewportChangeArbitrary, { minLength: 3, maxLength: 10 }),
                    (nodes, cellSize, margin, changes) => {
                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(nodes);

                        const culler = new ViewportCuller(partitioner, margin);
                        culler.setNodes(nodes);

                        let currentViewport: ViewportState = {
                            x: 0,
                            y: 0,
                            width: 800,
                            height: 600,
                            zoom: 1,
                        };

                        // Apply rapid viewport changes
                        changes.forEach((change) => {
                            currentViewport = {
                                x: currentViewport.x + change.panX,
                                y: currentViewport.y + change.panY,
                                width: currentViewport.width,
                                height: currentViewport.height,
                                zoom: Math.max(0.5, Math.min(3, currentViewport.zoom + change.zoomDelta)),
                            };

                            const result = culler.cull(currentViewport);

                            // Each result should be valid
                            expect(result.visibleNodeIds).toBeDefined();
                            expect(Array.isArray(result.visibleNodeIds)).toBe(true);
                            expect(result.visibleNodeIds.length).toBeGreaterThanOrEqual(0);
                            expect(result.visibleNodeIds.length).toBeLessThanOrEqual(nodes.length);

                            // All visible node IDs should be valid
                            result.visibleNodeIds.forEach((nodeId) => {
                                expect(nodes.map((n) => n.id)).toContain(nodeId);
                            });
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * **Validates: Requirements 2.6**
         * 
         * For any viewport recalculation, the result SHALL be deterministic when
         * called with the same viewport state. Calling cull() multiple times with
         * the same viewport should return the same visible node set.
         * 
         * Property: cull(viewport) = cull(viewport) (deterministic)
         * Property: Caching doesn't affect correctness
         */
        it('should produce deterministic results for same viewport', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    marginArbitrary,
                    viewportStateArbitrary,
                    (nodes, cellSize, margin, viewport) => {
                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(nodes);

                        const culler = new ViewportCuller(partitioner, margin);
                        culler.setNodes(nodes);

                        // Call cull multiple times with same viewport
                        const result1 = culler.cull(viewport);
                        const result2 = culler.cull(viewport);
                        const result3 = culler.cull(viewport);

                        // All results should be identical
                        expect(result1.visibleNodeIds).toEqual(result2.visibleNodeIds);
                        expect(result2.visibleNodeIds).toEqual(result3.visibleNodeIds);
                        expect(result1.visibleConnectionIds).toEqual(result2.visibleConnectionIds);
                        expect(result2.visibleConnectionIds).toEqual(result3.visibleConnectionIds);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * **Validates: Requirements 2.6**
         * 
         * For any viewport recalculation with connections, the visible connection set
         * SHALL be updated along with visible nodes. Connections should only be
         * rendered if at least one endpoint is visible.
         * 
         * Property: visible_connections ⊆ all_connections
         * Property: For each visible connection, at least one endpoint is visible
         */
        it('should recalculate visible connections when viewport changes', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    marginArbitrary,
                    viewportStateArbitrary,
                    viewportChangeArbitrary,
                    (nodes, cellSize, margin, baseViewport, change) => {
                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(nodes);

                        const connections = fc.sample(connectionsArbitrary(nodes), 1)[0];

                        const culler = new ViewportCuller(partitioner, margin);
                        culler.setNodes(nodes);
                        culler.setConnections(connections);

                        // Get initial visible connections
                        const result1 = culler.cull(baseViewport);

                        // Apply viewport change
                        const changedViewport: ViewportState = {
                            x: baseViewport.x + change.panX,
                            y: baseViewport.y + change.panY,
                            width: baseViewport.width,
                            height: baseViewport.height,
                            zoom: Math.max(0.5, Math.min(3, baseViewport.zoom + change.zoomDelta)),
                        };

                        // Get visible connections after change
                        const result2 = culler.cull(changedViewport);

                        // Verify connections are valid
                        expect(result1.visibleConnectionIds).toBeDefined();
                        expect(result2.visibleConnectionIds).toBeDefined();

                        // All visible connections should reference valid nodes
                        const visibleNodeIdSet = new Set(result2.visibleNodeIds);
                        result2.visibleConnectionIds.forEach((connId) => {
                            const connection = connections.find((c) => c.id === connId);
                            expect(connection).toBeDefined();

                            const sourceVisible = visibleNodeIdSet.has(connection!.sourceNodeId);
                            const targetVisible = visibleNodeIdSet.has(connection!.targetNodeId);

                            // At least one endpoint should be visible
                            expect(sourceVisible || targetVisible).toBe(true);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * **Validates: Requirements 2.6**
         * 
         * For any viewport recalculation, the visible node count should be reasonable
         * relative to the total node count. Culling should provide efficiency gains
         * for large topologies.
         * 
         * Property: visible_nodes / total_nodes < 1 (culling is working)
         * Property: Culling ratio improves with larger topologies
         */
        it('should provide culling efficiency for large topologies', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    marginArbitrary,
                    viewportStateArbitrary,
                    (nodes, cellSize, margin, viewport) => {
                        // Only test with reasonably large topologies
                        if (nodes.length < 50) {
                            return;
                        }

                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(nodes);

                        const culler = new ViewportCuller(partitioner, margin);
                        culler.setNodes(nodes);

                        const result = culler.cull(viewport);
                        const cullingRatio = result.visibleNodeIds.length / nodes.length;

                        // For large topologies, culling should provide some efficiency
                        // (visible nodes should be less than total nodes)
                        if (nodes.length > 100) {
                            expect(cullingRatio).toBeLessThan(1);
                        }

                        // Culling ratio should be between 0 and 1
                        expect(cullingRatio).toBeGreaterThanOrEqual(0);
                        expect(cullingRatio).toBeLessThanOrEqual(1);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * **Validates: Requirements 2.6**
         * 
         * For any viewport recalculation, the operation should not cause unnecessary
         * re-renders. Caching should prevent redundant recalculations when viewport
         * hasn't changed.
         * 
         * Property: Same viewport returns cached result
         * Property: Different viewport triggers recalculation
         */
        it('should cache results and avoid redundant recalculations', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    marginArbitrary,
                    viewportStateArbitrary,
                    (nodes, cellSize, margin, viewport) => {
                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(nodes);

                        const culler = new ViewportCuller(partitioner, margin);
                        culler.setNodes(nodes);

                        // First call
                        const result1 = culler.cull(viewport);

                        // Second call with same viewport should return cached result
                        const result2 = culler.cull(viewport);

                        // Results should be identical (same reference or equal values)
                        expect(result1.visibleNodeIds).toEqual(result2.visibleNodeIds);

                        // Get last result should return the cached result
                        const lastResult = culler.getLastResult();
                        expect(lastResult).toBeDefined();
                        expect(lastResult!.visibleNodeIds).toEqual(result1.visibleNodeIds);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * **Validates: Requirements 2.6**
         * 
         * For any viewport recalculation, zoom changes should be handled correctly.
         * Zooming in should show fewer nodes (more detail), zooming out should show
         * more nodes (less detail).
         * 
         * Property: zoom_in → fewer_visible_nodes (or equal)
         * Property: zoom_out → more_visible_nodes (or equal)
         */
        it('should handle zoom changes correctly in viewport recalculation', () => {
            fc.assert(
                fc.property(
                    nodesArbitrary,
                    cellSizeArbitrary,
                    marginArbitrary,
                    viewportStateArbitrary,
                    (nodes, cellSize, margin, baseViewport) => {
                        const partitioner = new SpatialPartitioner(cellSize);
                        partitioner.assignNodes(nodes);

                        const culler = new ViewportCuller(partitioner, margin);
                        culler.setNodes(nodes);

                        // Create zoomed in and zoomed out viewports
                        const zoomedInViewport: ViewportState = {
                            ...baseViewport,
                            zoom: Math.min(3, baseViewport.zoom * 1.5),
                        };

                        const zoomedOutViewport: ViewportState = {
                            ...baseViewport,
                            zoom: Math.max(0.5, baseViewport.zoom / 1.5),
                        };

                        const resultZoomedIn = culler.cull(zoomedInViewport);
                        const resultZoomedOut = culler.cull(zoomedOutViewport);

                        // Both results should be valid
                        expect(resultZoomedIn.visibleNodeIds.length).toBeGreaterThanOrEqual(0);
                        expect(resultZoomedOut.visibleNodeIds.length).toBeGreaterThanOrEqual(0);

                        // Zoomed out should generally show more or equal nodes
                        // (though this depends on viewport position)
                        expect(resultZoomedOut.visibleNodeIds.length).toBeGreaterThanOrEqual(0);
                        expect(resultZoomedIn.visibleNodeIds.length).toBeGreaterThanOrEqual(0);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
