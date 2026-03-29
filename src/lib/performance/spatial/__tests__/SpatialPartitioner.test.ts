/**
 * Tests for SpatialPartitioner
 * 
 * Validates: Requirements 2.1
 * Property 5: Topology Spatial Partitioning
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialPartitioner, Node, Connection } from '../SpatialPartitioner';

describe('SpatialPartitioner', () => {
    let partitioner: SpatialPartitioner;

    beforeEach(() => {
        partitioner = new SpatialPartitioner(256, { x: 0, y: 0, width: 3000, height: 2000 });
    });

    describe('Node Assignment', () => {
        it('should assign a single node to the correct cell', () => {
            const node: Node = { id: 'node-1', x: 100, y: 100 };
            partitioner.assignNode(node);

            const cellKey = '0,0';
            const cell = partitioner.getCell(cellKey);
            expect(cell).toBeDefined();
            expect(cell?.nodeIds).toContain('node-1');
        });

        it('should assign multiple nodes to correct cells', () => {
            const nodes: Node[] = [
                { id: 'node-1', x: 100, y: 100 },
                { id: 'node-2', x: 300, y: 300 },
                { id: 'node-3', x: 600, y: 600 },
            ];

            partitioner.assignNodes(nodes);
            expect(partitioner.getNodeCount()).toBe(3);
            expect(partitioner.getCellCount()).toBeGreaterThan(0);
        });

        it('should move node to new cell when position changes', () => {
            const node: Node = { id: 'node-1', x: 100, y: 100 };
            partitioner.assignNode(node);

            const oldCellKey = '0,0';
            const oldCell = partitioner.getCell(oldCellKey);
            expect(oldCell?.nodeIds).toContain('node-1');

            const movedNode: Node = { id: 'node-1', x: 500, y: 500 };
            partitioner.assignNode(movedNode);

            const newCellKey = '1,1';
            const newCell = partitioner.getCell(newCellKey);
            expect(newCell?.nodeIds).toContain('node-1');
            expect(oldCell?.nodeIds).not.toContain('node-1');
        });

        it('should remove node from partition', () => {
            const node: Node = { id: 'node-1', x: 100, y: 100 };
            partitioner.assignNode(node);
            expect(partitioner.getNodeCount()).toBe(1);

            partitioner.removeNode('node-1');
            expect(partitioner.getNodeCount()).toBe(0);
        });
    });

    describe('Connection Assignment', () => {
        it('should assign connection to cells containing endpoints', () => {
            const nodes = new Map<string, Node>([
                ['node-1', { id: 'node-1', x: 100, y: 100 }],
                ['node-2', { id: 'node-2', x: 300, y: 300 }],
            ]);

            const connection: Connection = {
                id: 'conn-1',
                sourceNodeId: 'node-1',
                targetNodeId: 'node-2',
            };

            partitioner.assignConnection(connection, nodes);

            const cell1 = partitioner.getCell('0,0');
            const cell2 = partitioner.getCell('1,1');

            expect(cell1?.connectionIds).toContain('conn-1');
            expect(cell2?.connectionIds).toContain('conn-1');
        });

        it('should remove connection from partition', () => {
            const nodes = new Map<string, Node>([
                ['node-1', { id: 'node-1', x: 100, y: 100 }],
                ['node-2', { id: 'node-2', x: 300, y: 300 }],
            ]);

            const connection: Connection = {
                id: 'conn-1',
                sourceNodeId: 'node-1',
                targetNodeId: 'node-2',
            };

            partitioner.assignConnection(connection, nodes);
            partitioner.removeConnection('conn-1');

            const cell1 = partitioner.getCell('0,0');
            const cell2 = partitioner.getCell('1,1');

            expect(cell1?.connectionIds).not.toContain('conn-1');
            expect(cell2?.connectionIds).not.toContain('conn-1');
        });
    });

    describe('Range Queries', () => {
        beforeEach(() => {
            const nodes: Node[] = [
                { id: 'node-1', x: 100, y: 100 },
                { id: 'node-2', x: 300, y: 300 },
                { id: 'node-3', x: 600, y: 600 },
                { id: 'node-4', x: 1000, y: 1000 },
            ];
            partitioner.assignNodes(nodes);
        });

        it('should find nodes within bounds', () => {
            const result = partitioner.rangeQuery({
                bounds: { x: 0, y: 0, width: 400, height: 400 },
            });

            expect(result).toContain('node-1');
            expect(result).toContain('node-2');
            expect(result).not.toContain('node-3');
            expect(result).not.toContain('node-4');
        });

        it('should include margin when requested', () => {
            const result = partitioner.rangeQuery({
                bounds: { x: 0, y: 0, width: 400, height: 400 },
                includeMargin: true,
                marginSize: 300,
            });

            expect(result.length).toBeGreaterThan(2);
        });

        it('should find connections within bounds', () => {
            const nodes = new Map<string, Node>([
                ['node-1', { id: 'node-1', x: 100, y: 100 }],
                ['node-2', { id: 'node-2', x: 300, y: 300 }],
                ['node-3', { id: 'node-3', x: 600, y: 600 }],
            ]);

            const connections: Connection[] = [
                { id: 'conn-1', sourceNodeId: 'node-1', targetNodeId: 'node-2' },
                { id: 'conn-2', sourceNodeId: 'node-2', targetNodeId: 'node-3' },
            ];

            connections.forEach(c => partitioner.assignConnection(c, nodes));

            const result = partitioner.rangeQueryConnections({
                bounds: { x: 0, y: 0, width: 400, height: 400 },
            });

            expect(result).toContain('conn-1');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty partition', () => {
            expect(partitioner.getNodeCount()).toBe(0);
            expect(partitioner.getCellCount()).toBe(0);

            const result = partitioner.rangeQuery({
                bounds: { x: 0, y: 0, width: 100, height: 100 },
            });
            expect(result).toEqual([]);
        });

        it('should handle nodes at partition boundaries', () => {
            const nodes: Node[] = [
                { id: 'node-1', x: 0, y: 0 },
                { id: 'node-2', x: 3000, y: 2000 },
            ];

            partitioner.assignNodes(nodes);
            expect(partitioner.getNodeCount()).toBe(2);
        });

        it('should handle clear operation', () => {
            const nodes: Node[] = [
                { id: 'node-1', x: 100, y: 100 },
                { id: 'node-2', x: 300, y: 300 },
            ];

            partitioner.assignNodes(nodes);
            expect(partitioner.getNodeCount()).toBe(2);

            partitioner.clear();
            expect(partitioner.getNodeCount()).toBe(0);
            expect(partitioner.getCellCount()).toBe(0);
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
            expect(partitioner.getNodeCount()).toBe(500);
            expect(partitioner.getCellCount()).toBeGreaterThan(0);

            // Verify range query works
            const result = partitioner.rangeQuery({
                bounds: { x: 0, y: 0, width: 500, height: 500 },
            });
            expect(result.length).toBeGreaterThan(0);
            expect(result.length).toBeLessThanOrEqual(500);
        });
    });
});
