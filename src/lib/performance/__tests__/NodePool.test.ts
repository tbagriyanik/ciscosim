/**
 * Unit tests for NodePool
 * Tests object pooling, acquire/release, and memory management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    NodePool,
    createNodePool,
    createDefaultNodeFactory,
    type PooledNode,
} from '../memory/NodePool';

describe('NodePool', () => {
    let pool: NodePool;

    beforeEach(() => {
        pool = createNodePool({ initialSize: 10, maxSize: 100 });
    });

    describe('initialization', () => {
        it('should initialize with default configuration', () => {
            const defaultPool = createNodePool();
            expect(defaultPool).toBeDefined();
            expect(defaultPool.getAvailableCount()).toBeGreaterThan(0);
        });

        it('should pre-allocate nodes', () => {
            const stats = pool.getStats();
            expect(stats.available).toBe(10);
            expect(stats.inUse).toBe(0);
            expect(stats.total).toBe(10);
        });

        it('should respect max size configuration', () => {
            const stats = pool.getStats();
            expect(stats.maxSize).toBe(100);
        });
    });

    describe('acquire and release', () => {
        it('should acquire a node from the pool', () => {
            const node = pool.acquire();
            expect(node).toBeDefined();
            expect(node).toHaveProperty('id');
            expect(node).toHaveProperty('x');
            expect(node).toHaveProperty('y');
        });

        it('should decrease available count on acquire', () => {
            const before = pool.getAvailableCount();
            pool.acquire();
            const after = pool.getAvailableCount();
            expect(after).toBe(before - 1);
        });

        it('should increase in-use count on acquire', () => {
            const before = pool.getInUseCount();
            pool.acquire();
            const after = pool.getInUseCount();
            expect(after).toBe(before + 1);
        });

        it('should release a node back to the pool', () => {
            const node = pool.acquire();
            const before = pool.getAvailableCount();
            pool.release(node);
            const after = pool.getAvailableCount();
            expect(after).toBe(before + 1);
        });

        it('should decrease in-use count on release', () => {
            const node = pool.acquire();
            const before = pool.getInUseCount();
            pool.release(node);
            const after = pool.getInUseCount();
            expect(after).toBe(before - 1);
        });

        it('should reset node on release', () => {
            const node = pool.acquire();
            node.id = 'test-id';
            node.x = 100;
            node.y = 200;
            node.label = 'Test Node';

            pool.release(node);

            expect(node.id).toBe('');
            expect(node.x).toBe(0);
            expect(node.y).toBe(0);
            expect(node.label).toBe('');
        });

        it('should reuse released nodes', () => {
            const node1 = pool.acquire();
            node1.id = 'node-1';
            pool.release(node1);

            const node2 = pool.acquire();
            expect(node2).toBe(node1);
            expect(node2.id).toBe('');
        });
    });

    describe('multiple operations', () => {
        it('should handle multiple acquire operations', () => {
            const nodes = [];
            for (let i = 0; i < 5; i++) {
                nodes.push(pool.acquire());
            }
            expect(pool.getInUseCount()).toBe(5);
            expect(pool.getAvailableCount()).toBe(5);
        });

        it('should handle multiple release operations', () => {
            const nodes = [];
            for (let i = 0; i < 5; i++) {
                nodes.push(pool.acquire());
            }
            nodes.forEach((node) => pool.release(node));
            expect(pool.getInUseCount()).toBe(0);
            expect(pool.getAvailableCount()).toBe(10);
        });

        it('should release multiple nodes at once', () => {
            const nodes = [pool.acquire(), pool.acquire(), pool.acquire()];
            pool.releaseMultiple(nodes);
            expect(pool.getInUseCount()).toBe(0);
        });
    });

    describe('pool statistics', () => {
        it('should return correct statistics', () => {
            const node1 = pool.acquire();
            const node2 = pool.acquire();

            const stats = pool.getStats();
            expect(stats.available).toBe(8);
            expect(stats.inUse).toBe(2);
            expect(stats.total).toBe(10);
            expect(stats.utilization).toBe(0.2);

            pool.release(node1);
            pool.release(node2);
        });

        it('should calculate utilization correctly', () => {
            pool.acquire();
            pool.acquire();
            pool.acquire();

            const stats = pool.getStats();
            expect(stats.utilization).toBe(0.3);
        });
    });

    describe('pool limits', () => {
        it('should create new nodes when pool is empty', () => {
            const smallPool = createNodePool({
                initialSize: 2,
                maxSize: 10,
            });

            const node1 = smallPool.acquire();
            const node2 = smallPool.acquire();
            const node3 = smallPool.acquire();

            expect(node1).toBeDefined();
            expect(node2).toBeDefined();
            expect(node3).toBeDefined();
            expect(smallPool.getInUseCount()).toBe(3);
        });

        it('should throw error when max size is exceeded', () => {
            const smallPool = createNodePool({
                initialSize: 2,
                maxSize: 3,
            });

            smallPool.acquire();
            smallPool.acquire();
            smallPool.acquire();

            expect(() => smallPool.acquire()).toThrow();
        });
    });

    describe('pool management', () => {
        it('should clear the pool', () => {
            pool.acquire();
            pool.acquire();
            pool.clear();

            expect(pool.getAvailableCount()).toBe(0);
            expect(pool.getInUseCount()).toBe(0);
            expect(pool.getTotalSize()).toBe(0);
        });

        it('should drain in-use nodes', () => {
            pool.acquire();
            pool.acquire();
            pool.acquire();

            pool.drain();

            expect(pool.getInUseCount()).toBe(0);
            expect(pool.getAvailableCount()).toBe(10);
        });

        it('should destroy the pool', () => {
            pool.acquire();
            pool.destroy();

            expect(pool.getAvailableCount()).toBe(0);
            expect(pool.getInUseCount()).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should warn when releasing node not in use', () => {
            const node = pool.acquire();
            pool.release(node);

            // Just verify that releasing again doesn't throw
            expect(() => pool.release(node)).not.toThrow();
        });

        it('should handle node factory correctly', () => {
            const factory = createDefaultNodeFactory();
            const node = factory();

            expect(node.id).toBe('');
            expect(node.x).toBe(0);
            expect(node.y).toBe(0);
        });
    });

    describe('node reuse', () => {
        it('should maintain node identity through acquire/release cycle', () => {
            const node1 = pool.acquire();
            const nodeId = node1;

            pool.release(node1);
            const node2 = pool.acquire();

            expect(node2).toBe(nodeId);
        });

        it('should properly reset node data on release', () => {
            const node = pool.acquire();
            node.id = 'test-123';
            node.x = 500;
            node.y = 600;
            node.label = 'Device A';
            node.type = 'router';
            node.data = { custom: 'value' };

            pool.release(node);

            expect(node.id).toBe('');
            expect(node.x).toBe(0);
            expect(node.y).toBe(0);
            expect(node.label).toBe('');
            expect(node.type).toBe('');
            expect(node.data).toEqual({});
        });
    });
});
