/**
 * Unit tests for ConnectionRenderer
 * Tests batch rendering, incremental updates, and spatial indexing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    ConnectionRenderer,
    createConnectionRenderer,
    type Connection,
} from '../rendering/ConnectionRenderer';

describe('ConnectionRenderer', () => {
    let renderer: ConnectionRenderer;

    beforeEach(() => {
        renderer = createConnectionRenderer({
            batchSize: 100,
            enableSpatialIndexing: true,
        });
    });

    describe('initialization', () => {
        it('should initialize with default configuration', () => {
            const defaultRenderer = createConnectionRenderer();
            expect(defaultRenderer).toBeDefined();
            expect(defaultRenderer.getTotalCount()).toBe(0);
        });

        it('should initialize with custom configuration', () => {
            const customRenderer = createConnectionRenderer({
                batchSize: 50,
                zoomLevel: 2,
            });
            expect(customRenderer).toBeDefined();
        });
    });

    describe('connection management', () => {
        it('should add a connection', () => {
            const connection: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            renderer.addConnection(connection);
            expect(renderer.getTotalCount()).toBe(1);
        });

        it('should remove a connection', () => {
            const connection: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            renderer.addConnection(connection);
            renderer.removeConnection('conn-1');
            expect(renderer.getTotalCount()).toBe(0);
        });

        it('should update a connection', () => {
            const connection: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            renderer.addConnection(connection);

            const updated: Connection = {
                ...connection,
                to: { x: 200, y: 200 },
            };

            renderer.updateConnection(updated);
            expect(renderer.getTotalCount()).toBe(1);
        });
    });

    describe('batch rendering', () => {
        it('should batch render changed connections', () => {
            const conn1: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            const conn2: Connection = {
                id: 'conn-2',
                fromId: 'node-2',
                toId: 'node-3',
                from: { x: 100, y: 100 },
                to: { x: 200, y: 200 },
                visible: true,
            };

            renderer.addConnection(conn1);
            renderer.addConnection(conn2);

            expect(renderer.getChangedCount()).toBe(2);

            const batch = renderer.batchRender();
            expect(batch.connections.length).toBe(2);
            expect(renderer.getChangedCount()).toBe(0);
        });

        it('should track changed connections', () => {
            const connection: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            renderer.addConnection(connection);
            expect(renderer.getChangedCount()).toBe(1);

            renderer.batchRender();
            expect(renderer.getChangedCount()).toBe(0);

            renderer.updateConnection(connection);
            expect(renderer.getChangedCount()).toBe(1);
        });

        it('should mark all connections as changed', () => {
            const conn1: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            const conn2: Connection = {
                id: 'conn-2',
                fromId: 'node-2',
                toId: 'node-3',
                from: { x: 100, y: 100 },
                to: { x: 200, y: 200 },
                visible: true,
            };

            renderer.addConnection(conn1);
            renderer.addConnection(conn2);
            renderer.batchRender();

            expect(renderer.getChangedCount()).toBe(0);

            renderer.markAllChanged();
            expect(renderer.getChangedCount()).toBe(2);
        });
    });

    describe('spatial indexing', () => {
        it('should query visible connections in viewport', () => {
            const conn1: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 50, y: 50 },
                to: { x: 150, y: 150 },
                visible: true,
            };

            const conn2: Connection = {
                id: 'conn-2',
                fromId: 'node-2',
                toId: 'node-3',
                from: { x: 1000, y: 1000 },
                to: { x: 1100, y: 1100 },
                visible: true,
            };

            renderer.addConnection(conn1);
            renderer.addConnection(conn2);

            const visible = renderer.getVisibleConnections(0, 0, 300, 300);
            expect(visible.length).toBe(1);
            expect(visible[0].id).toBe('conn-1');
        });

        it('should return all visible connections when spatial indexing disabled', () => {
            const noIndexRenderer = createConnectionRenderer({
                enableSpatialIndexing: false,
            });

            const conn1: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 50, y: 50 },
                to: { x: 150, y: 150 },
                visible: true,
            };

            const conn2: Connection = {
                id: 'conn-2',
                fromId: 'node-2',
                toId: 'node-3',
                from: { x: 500, y: 500 },
                to: { x: 600, y: 600 },
                visible: true,
            };

            noIndexRenderer.addConnection(conn1);
            noIndexRenderer.addConnection(conn2);

            const visible = noIndexRenderer.getVisibleConnections(0, 0, 300, 300);
            expect(visible.length).toBe(2);
        });

        it('should get visible connection count', () => {
            const conn1: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 50, y: 50 },
                to: { x: 150, y: 150 },
                visible: true,
            };

            renderer.addConnection(conn1);

            const count = renderer.getVisibleCount(0, 0, 300, 300);
            expect(count).toBe(1);
        });
    });

    describe('zoom handling', () => {
        it('should set zoom level', () => {
            renderer.setZoomLevel(2);
            const stats = renderer.getStats();
            expect(stats.zoomLevel).toBe(2);
        });

        it('should mark all as changed when zoom changes', () => {
            const connection: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            renderer.addConnection(connection);
            renderer.batchRender();

            expect(renderer.getChangedCount()).toBe(0);

            renderer.setZoomLevel(2);
            expect(renderer.getChangedCount()).toBe(1);
        });
    });

    describe('statistics', () => {
        it('should return correct statistics', () => {
            const conn1: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            renderer.addConnection(conn1);

            const stats = renderer.getStats();
            expect(stats.totalConnections).toBe(1);
            expect(stats.changedConnections).toBe(1);
            expect(stats.zoomLevel).toBe(1);
        });

        it('should track batch history', () => {
            const connection: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            renderer.addConnection(connection);
            renderer.batchRender();

            const history = renderer.getBatchHistory();
            expect(history.length).toBe(1);
            expect(history[0].connections.length).toBe(1);
        });
    });

    describe('lifecycle', () => {
        it('should clear all connections', () => {
            const connection: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            renderer.addConnection(connection);
            renderer.clear();

            expect(renderer.getTotalCount()).toBe(0);
            expect(renderer.getChangedCount()).toBe(0);
        });

        it('should destroy the renderer', () => {
            const connection: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            renderer.addConnection(connection);
            renderer.destroy();

            expect(renderer.getTotalCount()).toBe(0);
        });
    });

    describe('incremental updates', () => {
        it('should only include changed connections in batch', () => {
            const conn1: Connection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
                from: { x: 0, y: 0 },
                to: { x: 100, y: 100 },
                visible: true,
            };

            const conn2: Connection = {
                id: 'conn-2',
                fromId: 'node-2',
                toId: 'node-3',
                from: { x: 100, y: 100 },
                to: { x: 200, y: 200 },
                visible: true,
            };

            renderer.addConnection(conn1);
            renderer.addConnection(conn2);
            renderer.batchRender();

            // Update only conn1
            renderer.updateConnection({
                ...conn1,
                to: { x: 150, y: 150 },
            });

            const batch = renderer.batchRender();
            expect(batch.connections.length).toBe(1);
            expect(batch.connections[0].id).toBe('conn-1');
        });
    });
});
