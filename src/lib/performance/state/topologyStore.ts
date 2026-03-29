/**
 * Zustand-based Topology State Store
 * Implements efficient state management with granular selectors
 * Ensures components only re-render when their data changes
 */

import { create } from 'zustand';

export interface TopologyNode {
    id: string;
    x: number;
    y: number;
    label: string;
    type: string;
    data?: Record<string, any>;
}

export interface TopologyConnection {
    id: string;
    fromId: string;
    toId: string;
}

export interface ViewportState {
    x: number;
    y: number;
    width: number;
    height: number;
    zoomLevel: number;
}

export interface TopologyState {
    // Node data
    nodes: TopologyNode[];
    selectedNodeId: string | null;
    nodeMap: Map<string, TopologyNode>;

    // Connection data
    connections: TopologyConnection[];
    connectionMap: Map<string, TopologyConnection>;

    // Viewport state
    viewport: ViewportState;

    // Actions
    addNode: (node: TopologyNode) => void;
    removeNode: (nodeId: string) => void;
    updateNode: (nodeId: string, updates: Partial<TopologyNode>) => void;
    selectNode: (nodeId: string | null) => void;

    addConnection: (connection: TopologyConnection) => void;
    removeConnection: (connectionId: string) => void;
    updateConnection: (
        connectionId: string,
        updates: Partial<TopologyConnection>
    ) => void;

    setViewport: (viewport: Partial<ViewportState>) => void;
    setZoomLevel: (zoomLevel: number) => void;

    // Batch operations
    batchAddNodes: (nodes: TopologyNode[]) => void;
    batchRemoveNodes: (nodeIds: string[]) => void;
    batchAddConnections: (connections: TopologyConnection[]) => void;

    // Utility
    clear: () => void;
}

/**
 * Create the topology store with Zustand
 * Uses granular selectors for efficient subscriptions
 */
export const useTopologyStore = create<TopologyState>((set, get) => ({
    // Initial state
    nodes: [],
    selectedNodeId: null,
    nodeMap: new Map(),
    connections: [],
    connectionMap: new Map(),
    viewport: {
        x: 0,
        y: 0,
        width: 1000,
        height: 800,
        zoomLevel: 1,
    },

    // Node actions
    addNode: (node: TopologyNode) => {
        set((state) => {
            const newNodeMap = new Map(state.nodeMap);
            newNodeMap.set(node.id, node);
            return {
                nodes: [...state.nodes, node],
                nodeMap: newNodeMap,
            };
        });
    },

    removeNode: (nodeId: string) => {
        set((state) => {
            const newNodeMap = new Map(state.nodeMap);
            newNodeMap.delete(nodeId);
            return {
                nodes: state.nodes.filter((n) => n.id !== nodeId),
                nodeMap: newNodeMap,
                selectedNodeId:
                    state.selectedNodeId === nodeId
                        ? null
                        : state.selectedNodeId,
            };
        });
    },

    updateNode: (nodeId: string, updates: Partial<TopologyNode>) => {
        set((state) => {
            const node = state.nodeMap.get(nodeId);
            if (!node) return state;

            const updatedNode = { ...node, ...updates };
            const newNodeMap = new Map(state.nodeMap);
            newNodeMap.set(nodeId, updatedNode);

            return {
                nodes: state.nodes.map((n) =>
                    n.id === nodeId ? updatedNode : n
                ),
                nodeMap: newNodeMap,
            };
        });
    },

    selectNode: (nodeId: string | null) => {
        set({ selectedNodeId: nodeId });
    },

    // Connection actions
    addConnection: (connection: TopologyConnection) => {
        set((state) => {
            const newConnectionMap = new Map(state.connectionMap);
            newConnectionMap.set(connection.id, connection);
            return {
                connections: [...state.connections, connection],
                connectionMap: newConnectionMap,
            };
        });
    },

    removeConnection: (connectionId: string) => {
        set((state) => {
            const newConnectionMap = new Map(state.connectionMap);
            newConnectionMap.delete(connectionId);
            return {
                connections: state.connections.filter(
                    (c) => c.id !== connectionId
                ),
                connectionMap: newConnectionMap,
            };
        });
    },

    updateConnection: (
        connectionId: string,
        updates: Partial<TopologyConnection>
    ) => {
        set((state) => {
            const connection = state.connectionMap.get(connectionId);
            if (!connection) return state;

            const updatedConnection = { ...connection, ...updates };
            const newConnectionMap = new Map(state.connectionMap);
            newConnectionMap.set(connectionId, updatedConnection);

            return {
                connections: state.connections.map((c) =>
                    c.id === connectionId ? updatedConnection : c
                ),
                connectionMap: newConnectionMap,
            };
        });
    },

    // Viewport actions
    setViewport: (viewport: Partial<ViewportState>) => {
        set((state) => ({
            viewport: { ...state.viewport, ...viewport },
        }));
    },

    setZoomLevel: (zoomLevel: number) => {
        set((state) => ({
            viewport: { ...state.viewport, zoomLevel },
        }));
    },

    // Batch operations
    batchAddNodes: (nodes: TopologyNode[]) => {
        set((state) => {
            const newNodeMap = new Map(state.nodeMap);
            nodes.forEach((node) => newNodeMap.set(node.id, node));
            return {
                nodes: [...state.nodes, ...nodes],
                nodeMap: newNodeMap,
            };
        });
    },

    batchRemoveNodes: (nodeIds: string[]) => {
        set((state) => {
            const newNodeMap = new Map(state.nodeMap);
            nodeIds.forEach((id) => newNodeMap.delete(id));
            const nodeIdSet = new Set(nodeIds);
            return {
                nodes: state.nodes.filter((n) => !nodeIdSet.has(n.id)),
                nodeMap: newNodeMap,
                selectedNodeId:
                    nodeIdSet.has(state.selectedNodeId || '')
                        ? null
                        : state.selectedNodeId,
            };
        });
    },

    batchAddConnections: (connections: TopologyConnection[]) => {
        set((state) => {
            const newConnectionMap = new Map(state.connectionMap);
            connections.forEach((conn) =>
                newConnectionMap.set(conn.id, conn)
            );
            return {
                connections: [...state.connections, ...connections],
                connectionMap: newConnectionMap,
            };
        });
    },

    // Utility
    clear: () => {
        set({
            nodes: [],
            selectedNodeId: null,
            nodeMap: new Map(),
            connections: [],
            connectionMap: new Map(),
            viewport: {
                x: 0,
                y: 0,
                width: 1000,
                height: 800,
                zoomLevel: 1,
            },
        });
    },
}));

/**
 * Granular selectors for topology state
 * Components use these to subscribe only to relevant data
 */

// Node selectors
export const selectNodes = (state: TopologyState) => state.nodes;
export const selectNodeCount = (state: TopologyState) => state.nodes.length;
export const selectSelectedNodeId = (state: TopologyState) =>
    state.selectedNodeId;
export const selectSelectedNode = (state: TopologyState) => {
    if (!state.selectedNodeId) return null;
    return state.nodeMap.get(state.selectedNodeId) || null;
};
export const selectNodeById = (nodeId: string) => (state: TopologyState) =>
    state.nodeMap.get(nodeId) || null;

// Connection selectors
export const selectConnections = (state: TopologyState) => state.connections;
export const selectConnectionCount = (state: TopologyState) =>
    state.connections.length;
export const selectConnectionById = (connectionId: string) =>
    (state: TopologyState) => state.connectionMap.get(connectionId) || null;

// Viewport selectors
export const selectViewport = (state: TopologyState) => state.viewport;
export const selectZoomLevel = (state: TopologyState) =>
    state.viewport.zoomLevel;
export const selectViewportBounds = (state: TopologyState) => ({
    x: state.viewport.x,
    y: state.viewport.y,
    width: state.viewport.width,
    height: state.viewport.height,
});

// Derived selectors
export const selectNodesByViewport = (state: TopologyState) => {
    const { x, y, width, height } = state.viewport;
    return state.nodes.filter(
        (node) =>
            node.x >= x &&
            node.x <= x + width &&
            node.y >= y &&
            node.y <= y + height
    );
};

export const selectConnectionsByViewport = (state: TopologyState) => {
    const { x, y, width, height } = state.viewport;
    return state.connections.filter((conn) => {
        const fromNode = state.nodeMap.get(conn.fromId);
        const toNode = state.nodeMap.get(conn.toId);
        if (!fromNode || !toNode) return false;

        const minX = Math.min(fromNode.x, toNode.x);
        const maxX = Math.max(fromNode.x, toNode.x);
        const minY = Math.min(fromNode.y, toNode.y);
        const maxY = Math.max(fromNode.y, toNode.y);

        return (
            minX <= x + width &&
            maxX >= x &&
            minY <= y + height &&
            maxY >= y
        );
    });
};

/**
 * Hook for using granular selectors
 * Example: const nodes = useTopologySelector(selectNodes);
 */
export function useTopologySelector<T>(
    selector: (state: TopologyState) => T
): T {
    return useTopologyStore(selector);
}
