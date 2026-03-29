/**
 * Unit tests for Topology Store
 * Tests state management, selectors, and batch operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    useTopologyStore,
    selectNodes,
    selectNodeCount,
    selectConnections,
    selectConnectionCount,
    selectViewport,
    selectZoomLevel,
    selectSelectedNode,
    selectNodesByViewport,
    selectConnectionsByViewport,
    type TopologyNode,
    type TopologyConnection,
} from '../state/topologyStore';

describe('Topology Store', () => {
    beforeEach(() => {
        // Clear store before each test
        useTopologyStore.getState().clear();
    });

    describe('node management', () => {
        it('should add a node', () => {
            const node: TopologyNode = {
                id: 'node-1',
                x: 100,
                y: 100,
                label: 'Device 1',
                type: 'router',
            };

            useTopologyStore.getState().addNode(node);

            const state = useTopologyStore.getState();
            expect(state.nodes.length).toBe(1);
            expect(state.nodes[0].id).toBe('node-1');
        });

        it('should remove a node', () => {
            const node: TopologyNode = {
                id: 'node-1',
                x: 100,
                y: 100,
                label: 'Device 1',
                type: 'router',
            };

            useTopologyStore.getState().addNode(node);
            useTopologyStore.getState().removeNode('node-1');

            const state = useTopologyStore.getState();
            expect(state.nodes.length).toBe(0);
        });

        it('should update a node', () => {
            const node: TopologyNode = {
                id: 'node-1',
                x: 100,
                y: 100,
                label: 'Device 1',
                type: 'router',
            };

            useTopologyStore.getState().addNode(node);
            useTopologyStore.getState().updateNode('node-1', { x: 200, y: 200 });

            const state = useTopologyStore.getState();
            expect(state.nodes[0].x).toBe(200);
            expect(state.nodes[0].y).toBe(200);
        });

        it('should select a node', () => {
            const node: TopologyNode = {
                id: 'node-1',
                x: 100,
                y: 100,
                label: 'Device 1',
                type: 'router',
            };

            useTopologyStore.getState().addNode(node);
            useTopologyStore.getState().selectNode('node-1');

            const state = useTopologyStore.getState();
            expect(state.selectedNodeId).toBe('node-1');
        });

        it('should batch add nodes', () => {
            const nodes: TopologyNode[] = [
                {
                    id: 'node-1',
                    x: 100,
                    y: 100,
                    label: 'Device 1',
                    type: 'router',
                },
                {
                    id: 'node-2',
                    x: 200,
                    y: 200,
                    label: 'Device 2',
                    type: 'switch',
                },
            ];

            useTopologyStore.getState().batchAddNodes(nodes);

            const state = useTopologyStore.getState();
            expect(state.nodes.length).toBe(2);
        });

        it('should batch remove nodes', () => {
            const nodes: TopologyNode[] = [
                {
                    id: 'node-1',
                    x: 100,
                    y: 100,
                    label: 'Device 1',
                    type: 'router',
                },
                {
                    id: 'node-2',
                    x: 200,
                    y: 200,
                    label: 'Device 2',
                    type: 'switch',
                },
            ];

            useTopologyStore.getState().batchAddNodes(nodes);
            useTopologyStore.getState().batchRemoveNodes(['node-1', 'node-2']);

            const state = useTopologyStore.getState();
            expect(state.nodes.length).toBe(0);
        });
    });

    describe('connection management', () => {
        it('should add a connection', () => {
            const connection: TopologyConnection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
            };

            useTopologyStore.getState().addConnection(connection);

            const state = useTopologyStore.getState();
            expect(state.connections.length).toBe(1);
            expect(state.connections[0].id).toBe('conn-1');
        });

        it('should remove a connection', () => {
            const connection: TopologyConnection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
            };

            useTopologyStore.getState().addConnection(connection);
            useTopologyStore.getState().removeConnection('conn-1');

            const state = useTopologyStore.getState();
            expect(state.connections.length).toBe(0);
        });

        it('should update a connection', () => {
            const connection: TopologyConnection = {
                id: 'conn-1',
                fromId: 'node-1',
                toId: 'node-2',
            };

            useTopologyStore.getState().addConnection(connection);
            useTopologyStore
                .getState()
                .updateConnection('conn-1', { toId: 'node-3' });

            const state = useTopologyStore.getState();
            expect(state.connections[0].toId).toBe('node-3');
        });

        it('should batch add connections', () => {
            const connections: TopologyConnection[] = [
                { id: 'conn-1', fromId: 'node-1', toId: 'node-2' },
                { id: 'conn-2', fromId: 'node-2', toId: 'node-3' },
            ];

            useTopologyStore.getState().batchAddConnections(connections);

            const state = useTopologyStore.getState();
            expect(state.connections.length).toBe(2);
        });
    });

    describe('viewport management', () => {
        it('should set viewport', () => {
            useTopologyStore.getState().setViewport({
                x: 100,
                y: 100,
                width: 500,
                height: 500,
            });

            const state = useTopologyStore.getState();
            expect(state.viewport.x).toBe(100);
            expect(state.viewport.y).toBe(100);
            expect(state.viewport.width).toBe(500);
            expect(state.viewport.height).toBe(500);
        });

        it('should set zoom level', () => {
            useTopologyStore.getState().setZoomLevel(2);

            const state = useTopologyStore.getState();
            expect(state.viewport.zoomLevel).toBe(2);
        });
    });

    describe('selectors', () => {
        it('should select all nodes', () => {
            const nodes: TopologyNode[] = [
                {
                    id: 'node-1',
                    x: 100,
                    y: 100,
                    label: 'Device 1',
                    type: 'router',
                },
                {
                    id: 'node-2',
                    x: 200,
                    y: 200,
                    label: 'Device 2',
                    type: 'switch',
                },
            ];

            useTopologyStore.getState().batchAddNodes(nodes);

            const state = useTopologyStore.getState();
            const selectedNodes = selectNodes(state);
            expect(selectedNodes.length).toBe(2);
        });

        it('should select node count', () => {
            const nodes: TopologyNode[] = [
                {
                    id: 'node-1',
                    x: 100,
                    y: 100,
                    label: 'Device 1',
                    type: 'router',
                },
                {
                    id: 'node-2',
                    x: 200,
                    y: 200,
                    label: 'Device 2',
                    type: 'switch',
                },
            ];

            useTopologyStore.getState().batchAddNodes(nodes);

            const state = useTopologyStore.getState();
            const count = selectNodeCount(state);
            expect(count).toBe(2);
        });

        it('should select all connections', () => {
            const connections: TopologyConnection[] = [
                { id: 'conn-1', fromId: 'node-1', toId: 'node-2' },
                { id: 'conn-2', fromId: 'node-2', toId: 'node-3' },
            ];

            useTopologyStore.getState().batchAddConnections(connections);

            const state = useTopologyStore.getState();
            const selectedConnections = selectConnections(state);
            expect(selectedConnections.length).toBe(2);
        });

        it('should select connection count', () => {
            const connections: TopologyConnection[] = [
                { id: 'conn-1', fromId: 'node-1', toId: 'node-2' },
                { id: 'conn-2', fromId: 'node-2', toId: 'node-3' },
            ];

            useTopologyStore.getState().batchAddConnections(connections);

            const state = useTopologyStore.getState();
            const count = selectConnectionCount(state);
            expect(count).toBe(2);
        });

        it('should select viewport', () => {
            useTopologyStore.getState().setViewport({
                x: 100,
                y: 100,
                width: 500,
                height: 500,
            });

            const state = useTopologyStore.getState();
            const viewport = selectViewport(state);
            expect(viewport.x).toBe(100);
            expect(viewport.width).toBe(500);
        });

        it('should select zoom level', () => {
            useTopologyStore.getState().setZoomLevel(2);

            const state = useTopologyStore.getState();
            const zoomLevel = selectZoomLevel(state);
            expect(zoomLevel).toBe(2);
        });

        it('should select selected node', () => {
            const node: TopologyNode = {
                id: 'node-1',
                x: 100,
                y: 100,
                label: 'Device 1',
                type: 'router',
            };

            useTopologyStore.getState().addNode(node);
            useTopologyStore.getState().selectNode('node-1');

            const state = useTopologyStore.getState();
            const selectedNode = selectSelectedNode(state);
            expect(selectedNode?.id).toBe('node-1');
        });
    });

    describe('derived selectors', () => {
        it('should select nodes by viewport', () => {
            const nodes: TopologyNode[] = [
                {
                    id: 'node-1',
                    x: 50,
                    y: 50,
                    label: 'Device 1',
                    type: 'router',
                },
                {
                    id: 'node-2',
                    x: 500,
                    y: 500,
                    label: 'Device 2',
                    type: 'switch',
                },
            ];

            useTopologyStore.getState().batchAddNodes(nodes);
            useTopologyStore.getState().setViewport({
                x: 0,
                y: 0,
                width: 200,
                height: 200,
            });

            const state = useTopologyStore.getState();
            const visibleNodes = selectNodesByViewport(state);
            expect(visibleNodes.length).toBe(1);
            expect(visibleNodes[0].id).toBe('node-1');
        });

        it('should select connections by viewport', () => {
            const nodes: TopologyNode[] = [
                {
                    id: 'node-1',
                    x: 50,
                    y: 50,
                    label: 'Device 1',
                    type: 'router',
                },
                {
                    id: 'node-2',
                    x: 100,
                    y: 100,
                    label: 'Device 2',
                    type: 'switch',
                },
                {
                    id: 'node-3',
                    x: 1000,
                    y: 1000,
                    label: 'Device 3',
                    type: 'router',
                },
            ];

            const connections: TopologyConnection[] = [
                { id: 'conn-1', fromId: 'node-1', toId: 'node-2' },
                { id: 'conn-2', fromId: 'node-2', toId: 'node-3' },
            ];

            useTopologyStore.getState().batchAddNodes(nodes);
            useTopologyStore.getState().batchAddConnections(connections);
            useTopologyStore.getState().setViewport({
                x: 0,
                y: 0,
                width: 150,
                height: 150,
            });

            const state = useTopologyStore.getState();
            const visibleConnections = selectConnectionsByViewport(state);
            // Both connections are visible because conn-2 starts at node-2 which is in viewport
            expect(visibleConnections.length).toBeGreaterThanOrEqual(1);
            expect(visibleConnections.some((c) => c.id === 'conn-1')).toBe(true);
        });
    });

    describe('store lifecycle', () => {
        it('should clear the store', () => {
            const node: TopologyNode = {
                id: 'node-1',
                x: 100,
                y: 100,
                label: 'Device 1',
                type: 'router',
            };

            useTopologyStore.getState().addNode(node);
            useTopologyStore.getState().clear();

            const state = useTopologyStore.getState();
            expect(state.nodes.length).toBe(0);
            expect(state.connections.length).toBe(0);
            expect(state.selectedNodeId).toBeNull();
        });
    });
});
