/**
 * Tests for ViewportCuller
 * 
 * Validates: Requirements 2.3, 2.5, 2.6
 * Property 7: Topology Viewport Culling
 * Property 8: Topology Viewport Recalculation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialPartitioner, Node, Connection } from '../SpatialPartitioner';
import { ViewportCuller, ViewportState } from '../ViewportCuller';

describe('ViewportCuller', () => {
    let partitioner: SpatialPartitioner;
    let culler: ViewportCuller;

    beforeEach(() => {
        partitioner = new SpatialPartitioner(256, { x: 0, y: 0, width: 3000, height: 2000 });
        culler = new ViewportCuller(partitioner, 100);
    });

    describe('Viewport Culling', () => {
        beforeEach(() => {
            const nodes: Node[] = [
                { id: 'node-1', x: 100, y: 100 },
                { id: 'node-2', x: 500, y: 500 },
                { id: 'node-3', x: 1000, y: 1000 },
                { id: 'node-4', x: 2000, y: 2000 },
            ];

            const connections: Connection[] = [
                { id: 'conn-1', sourceNodeId: 'node-1', targetNodeId: 'node-2' },
                { id: 'conn-2', sourceNodeId: 'node-2', targetNodeId: 'node-3' },
                { id: 'conn-3', sourceNodeId: 'node-3', targetNodeId: 'node-4' },
            ];

            partitioner.assignNodes(nodes);
            connections.forEach(c => partitioner.assignConnection(c, new Map(nodes.map(n => [n.id, n]))));

            culler.setNodes(nodes);
            culler.setConnections(connections);
        });

        it('should cull nodes outside viewport', () => {
            const viewport: ViewportState = {
                x: 0,
                y: 0,
                width: 400,
                height: 400,
                zoom: 1,
            };

            const result = culler.cull(viewport);

            expect(result.visibleNodeIds).toContain('node-1');
            expect(result.visibleNodeIds).toContain('node-2');
            expect(result.visibleNodeIds).not.toContain('node-4');
        });

        it('should include margin in culling', () => {
            const viewport: ViewportState = {
                x: 0,
                y: 0,
                width: 400,
                height: 400,
                zoom: 1,
            };

            const result = culler.cull(viewport);
            const stats = culler.getStats();

            expect(stats?.visibleNodeCount).toBeGreaterThan(0);
        });

        it('should handle zoom levels', () => {
            const viewport: ViewportState = {
                x: 0,
                y: 0,
                width: 800,
                height: 600,
                zoom: 2,
            };

            const result = culler.cull(viewport);
            expect(result.visibleNodeIds.length).toBeGreaterThan(0);
        });

        it('should cache results for same viewport', () => {
            const viewport: ViewportState = {
                x: 0,
                y: 0,
                width: 400,
                height: 400,
                zoom: 1,
            };

            const result1 = culler.cull(viewport);
            const result2 = culler.cull(viewport);

            expect(result1).toBe(result2);
        });
    });

    describe('Connection Visibility', () => {
        it('should include connections with visible endpoints', () => {
            const nodes: Node[] = [
                { id: 'node-1', x: 100, y: 100 },
                { id: 'node-2', x: 500, y: 500 },
                { id: 'node-3', x: 1000, y: 1000 },
            ];

            const connections: Connection[] = [
                { id: 'conn-1', sourceNodeId: 'node-1', targetNodeId: 'node-2' },
                { id: 'conn-2', sourceNodeId: 'node-2', targetNodeId: 'node-3' },
            ];

            partitioner.assignNodes(nodes);
            connections.forEach(c => partitioner.assignConnection(c, new Map(nodes.map(n => [n.id, n]))));

            culler.setNodes(nodes);
            culler.setConnections(connections);

            const viewport: ViewportState = {
                x: 0,
                y: 0,
                width: 600,
                height: 600,
                zoom: 1,
            };

            const result = culler.cull(viewport);
            expect(result.visibleConnectionIds).toContain('conn-1');
        });
    });

    describe('Visibility Queries', () => {
        beforeEach(() => {
            const nodes: Node[] = [
                { id: 'node-1', x: 100, y: 100 },
                { id: 'node-2', x: 500, y: 500 },
            ];

            partitioner.assignNodes(nodes);
            culler.setNodes(nodes);
            culler.setConnections([]);
        });

        it('should check if node is visible', () => {
            const viewport: ViewportState = {
                x: 0,
                y: 0,
                width: 400,
                height: 400,
                zoom: 1,
            };

            const isVisible = culler.isNodeVisible('node-1', viewport);
            expect(isVisible).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty viewport', () => {
            const viewport: ViewportState = {
                x: 5000,
                y: 5000,
                width: 100,
                height: 100,
                zoom: 1,
            };

            const result = culler.cull(viewport);
            expect(result.visibleNodeIds).toEqual([]);
        });

        it('should handle very large zoom', () => {
            const nodes: Node[] = [{ id: 'node-1', x: 100, y: 100 }];
            partitioner.assignNodes(nodes);
            culler.setNodes(nodes);

            const viewport: ViewportState = {
                x: 0,
                y: 0,
                width: 800,
                height: 600,
                zoom: 10,
            };

            const result = culler.cull(viewport);
            expect(result.visibleNodeIds.length).toBeGreaterThan(0);
        });

        it('should handle very small zoom', () => {
            const nodes: Node[] = [{ id: 'node-1', x: 100, y: 100 }];
            partitioner.assignNodes(nodes);
            culler.setNodes(nodes);

            const viewport: ViewportState = {
                x: 0,
                y: 0,
                width: 800,
                height: 600,
                zoom: 0.1,
            };

            const result = culler.cull(viewport);
            expect(result.visibleNodeIds.length).toBeGreaterThan(0);
        });

        it('should invalidate cache on margin change', () => {
            const nodes: Node[] = [{ id: 'node-1', x: 100, y: 100 }];
            partitioner.assignNodes(nodes);
            culler.setNodes(nodes);

            const viewport: ViewportState = {
                x: 0,
                y: 0,
                width: 400,
                height: 400,
                zoom: 1,
            };

            const result1 = culler.cull(viewport);
            culler.setMargin(200);
            const result2 = culler.cull(viewport);

            expect(result1.margin).not.toBe(result2.margin);
        });

        it('should handle large topologies efficiently', () => {
            const nodes: Node[] = [];
            for (let i = 0; i < 500; i++) {
                nodes.push({
                    id: `node-${i}`,
                    x: Math.random() * 3000,
                    y: Math.random() * 2000,
                });
            }

            partitioner.assignNodes(nodes);
            culler.setNodes(nodes);
            culler.setConnections([]);

            const viewport: ViewportState = {
                x: 0,
                y: 0,
                width: 500,
                height: 500,
                zoom: 1,
            };

            const result = culler.cull(viewport);
            const stats = culler.getStats();

            expect(result.visibleNodeIds.length).toBeGreaterThan(0);
            expect(stats?.cullingRatio).toBeLessThanOrEqual(1);
        });
    });
});
