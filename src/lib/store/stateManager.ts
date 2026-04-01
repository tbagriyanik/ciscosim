export interface StateSnapshot<T> {
    state: T;
    timestamp: number;
    id: string;
}

export interface StateManagerOptions {
    maxHistory?: number;
    persistKey?: string;
    autoSave?: boolean;
    autoSaveInterval?: number;
}

export class StateManager<T> {
    private history: StateSnapshot<T>[] = [];
    private currentIndex: number = -1;
    private options: Required<StateManagerOptions>;
    private autoSaveTimer: NodeJS.Timeout | null = null;
    private listeners: Set<(state: T) => void> = new Set();

    constructor(initialState: T, options: StateManagerOptions = {}) {
        this.options = {
            maxHistory: options.maxHistory ?? 100,
            persistKey: options.persistKey ?? 'app-state',
            autoSave: options.autoSave ?? true,
            autoSaveInterval: options.autoSaveInterval ?? 5000,
        };

        const snapshot: StateSnapshot<T> = {
            state: JSON.parse(JSON.stringify(initialState)),
            timestamp: Date.now(),
            id: this.generateId(),
        };

        this.history.push(snapshot);
        this.currentIndex = 0;

        if (this.options.autoSave) {
            this.startAutoSave();
        }
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    private startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            this.persist();
        }, this.options.autoSaveInterval);
    }

    private stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    setState(newState: T) {
        // Truncate redo stack
        this.history = this.history.slice(0, this.currentIndex + 1);

        // Check if state actually changed (deduplication for consecutive identical states)
        const currentState = this.history[this.currentIndex]?.state;
        if (JSON.stringify(currentState) === JSON.stringify(newState)) {
            // Same state - still notify listeners
            this.notifyListeners();
            return;
        }

        const snapshot: StateSnapshot<T> = {
            state: JSON.parse(JSON.stringify(newState)),
            timestamp: Date.now(),
            id: this.generateId(),
        };

        this.history.push(snapshot);
        this.currentIndex++;

        // Limit history size
        if (this.history.length > this.options.maxHistory) {
            this.history.shift();
            this.currentIndex--;
        }

        this.notifyListeners();
    }

    getState(): T {
        return JSON.parse(JSON.stringify(this.history[this.currentIndex]?.state));
    }

    undo(): boolean {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.notifyListeners();
            return true;
        }
        return false;
    }

    redo(): boolean {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            this.notifyListeners();
            return true;
        }
        return false;
    }

    canUndo(): boolean {
        return this.currentIndex > 0;
    }

    canRedo(): boolean {
        return this.currentIndex < this.history.length - 1;
    }

    getHistory() {
        return this.history.map((s) => ({ ...s }));
    }

    clearHistory() {
        const currentState = this.history[this.currentIndex];
        this.history = [currentState];
        this.currentIndex = 0;
    }

    persist() {
        if (typeof window === 'undefined') return;

        try {
            const data = {
                history: this.history,
                currentIndex: this.currentIndex,
            };
            localStorage.setItem(this.options.persistKey, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to persist state:', e);
        }
    }

    restore(): boolean {
        if (typeof window === 'undefined') return false;

        try {
            const data = localStorage.getItem(this.options.persistKey);
            if (!data) return false;

            const parsed = safeParseJSON(data, null as any);
            if (!parsed) return false;
            this.history = parsed.history || [];
            this.currentIndex = parsed.currentIndex ?? -1;

            if (this.history.length === 0) return false;

            this.notifyListeners();
            return true;
        } catch (e) {
            console.error('Failed to restore state:', e);
            return false;
        }
    }

    subscribe(listener: (state: T) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners() {
        const state = this.getState();
        this.listeners.forEach((listener) => listener(state));
    }

    destroy() {
        this.stopAutoSave();
        this.listeners.clear();
        this.persist();
    }
}

export function createStateManager<T>(
    initialState: T,
    options?: StateManagerOptions
) {
    return new StateManager(initialState, options);
}
import { safeParseJSON } from '@/lib/security/sanitizer';
