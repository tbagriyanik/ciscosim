/**
 * Object Pool for Topology Nodes
 * Reuses node objects to reduce garbage collection pressure
 * Implements acquire() and release() methods for efficient memory management
 */

export interface PooledNode {
    id: string;
    x: number;
    y: number;
    label: string;
    type: string;
    data?: Record<string, any>;
    reset(): void;
}

export interface NodePoolConfig {
    initialSize?: number;
    maxSize?: number;
    resetOnRelease?: boolean;
}

/**
 * NodePool - Object pool for topology nodes
 * Manages a pool of reusable node objects to reduce memory allocations
 */
export class NodePool {
    private available: PooledNode[] = [];
    private inUse: Set<PooledNode> = new Set();
    private initialSize: number;
    private maxSize: number;
    private resetOnRelease: boolean;
    private nodeFactory: () => PooledNode;

    constructor(
        nodeFactory: () => PooledNode,
        config: NodePoolConfig = {}
    ) {
        this.nodeFactory = nodeFactory;
        this.initialSize = config.initialSize || 100;
        this.maxSize = config.maxSize || 1000;
        this.resetOnRelease = config.resetOnRelease !== false;

        // Pre-allocate initial pool
        this.preallocate(this.initialSize);
    }

    /**
     * Pre-allocate nodes in the pool
     */
    private preallocate(count: number): void {
        for (let i = 0; i < count; i++) {
            this.available.push(this.nodeFactory());
        }
    }

    /**
     * Acquire a node from the pool
     * Creates a new node if pool is empty and under max size
     */
    public acquire(): PooledNode {
        let node: PooledNode;

        if (this.available.length > 0) {
            node = this.available.pop()!;
        } else if (this.inUse.size < this.maxSize) {
            node = this.nodeFactory();
        } else {
            throw new Error(
                `NodePool: Maximum pool size (${this.maxSize}) reached`
            );
        }

        this.inUse.add(node);
        return node;
    }

    /**
     * Release a node back to the pool
     * Resets the node if configured to do so
     */
    public release(node: PooledNode): void {
        if (!this.inUse.has(node)) {
            console.warn('NodePool: Attempting to release node not in use');
            return;
        }

        this.inUse.delete(node);

        if (this.resetOnRelease) {
            node.reset();
        }

        // Only add back to pool if we haven't exceeded initial size
        if (this.available.length < this.initialSize) {
            this.available.push(node);
        }
    }

    /**
     * Release multiple nodes at once
     */
    public releaseMultiple(nodes: PooledNode[]): void {
        nodes.forEach((node) => this.release(node));
    }

    /**
     * Get the number of available nodes in the pool
     */
    public getAvailableCount(): number {
        return this.available.length;
    }

    /**
     * Get the number of nodes currently in use
     */
    public getInUseCount(): number {
        return this.inUse.size;
    }

    /**
     * Get total pool size (available + in use)
     */
    public getTotalSize(): number {
        return this.available.length + this.inUse.size;
    }

    /**
     * Get pool statistics
     */
    public getStats(): {
        available: number;
        inUse: number;
        total: number;
        maxSize: number;
        utilization: number;
    } {
        const total = this.getTotalSize();
        return {
            available: this.available.length,
            inUse: this.inUse.size,
            total,
            maxSize: this.maxSize,
            utilization: total > 0 ? this.inUse.size / total : 0,
        };
    }

    /**
     * Clear the pool and release all nodes
     */
    public clear(): void {
        this.available = [];
        this.inUse.clear();
    }

    /**
     * Drain the pool - release all in-use nodes
     */
    public drain(): void {
        const inUseArray = Array.from(this.inUse);
        inUseArray.forEach((node) => this.release(node));
    }

    /**
     * Destroy the pool
     */
    public destroy(): void {
        this.clear();
        this.available = [];
        this.inUse.clear();
    }
}

/**
 * Create a default node factory
 */
export function createDefaultNodeFactory(): () => PooledNode {
    return () => ({
        id: '',
        x: 0,
        y: 0,
        label: '',
        type: '',
        data: {},
        reset() {
            this.id = '';
            this.x = 0;
            this.y = 0;
            this.label = '';
            this.type = '';
            this.data = {};
        },
    });
}

/**
 * Create a NodePool with default configuration
 */
export function createNodePool(
    config: NodePoolConfig = {}
): NodePool {
    return new NodePool(createDefaultNodeFactory(), config);
}
