import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CanvasDevice, CanvasConnection, CanvasNote } from '@/components/network/networkTopology.types';
import { SwitchState } from '@/lib/network/types';

// Types for the store
interface TopologyState {
    devices: CanvasDevice[];
    connections: CanvasConnection[];
    notes: CanvasNote[];
    selectedDeviceId: string | null;
    zoom: number;
    pan: { x: number; y: number };
}

interface DeviceStates {
    switchStates: Record<string, SwitchState>;
    pcOutputs: Record<string, any[]>;
}

interface AppState {
    // Topology state
    topology: TopologyState;

    // Device states (CLI states, PC outputs, etc.)
    deviceStates: DeviceStates;

    // UI state
    activeTab: 'topology' | 'cmd' | 'terminal' | 'tasks';
    activePanel: 'port' | 'vlan' | 'security' | 'config' | null;
    sidebarOpen: boolean;
    graphicsQuality: 'high' | 'low';

    // Actions
    setDevices: (devices: CanvasDevice[] | ((prev: CanvasDevice[]) => CanvasDevice[])) => void;
    setConnections: (connections: CanvasConnection[] | ((prev: CanvasConnection[]) => CanvasConnection[])) => void;
    setNotes: (notes: CanvasNote[] | ((prev: CanvasNote[]) => CanvasNote[])) => void;
    addDevice: (device: CanvasDevice) => void;
    removeDevice: (deviceId: string) => void;
    updateDevice: (deviceId: string, updates: Partial<CanvasDevice>) => void;
    addConnection: (connection: CanvasConnection) => void;
    removeConnection: (connectionId: string) => void;
    addNote: (note: CanvasNote) => void;
    removeNote: (noteId: string) => void;
    updateNote: (noteId: string, updates: Partial<CanvasNote>) => void;
    setSelectedDevice: (deviceId: string | null) => void;
    setZoom: (zoom: number | ((prev: number) => number)) => void;
    setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;

    // Device state management
    setSwitchState: (deviceId: string, state: SwitchState) => void;
    getSwitchState: (deviceId: string) => SwitchState | undefined;
    setPCOutput: (deviceId: string, output: any[]) => void;
    getPCOutput: (deviceId: string) => any[];

    // UI actions
    setActiveTab: (tab: 'topology' | 'cmd' | 'terminal' | 'tasks') => void;
    setActivePanel: (panel: 'port' | 'vlan' | 'security' | 'config' | null) => void;
    setSidebarOpen: (open: boolean) => void;
    setGraphicsQuality: (quality: 'high' | 'low') => void;

    // Reset
    resetAll: () => void;
}

// Initial state
const initialTopologyState: TopologyState = {
    devices: [],
    connections: [],
    notes: [],
    selectedDeviceId: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
};

const initialDeviceStates: DeviceStates = {
    switchStates: {},
    pcOutputs: {},
};

const initialState: Omit<AppState, keyof ReturnType<typeof createActions>> = {
    topology: initialTopologyState,
    deviceStates: initialDeviceStates,
    activeTab: 'topology',
    activePanel: null,
    sidebarOpen: true,
    graphicsQuality: 'high',
};

const STORE_KEY = 'network-simulator-storage';
const STORE_VERSION = 3;
const STORE_BACKUP_KEY = `${STORE_KEY}-backup`;

function isValidTopologyState(value: any): value is TopologyState {
    return !!value &&
        Array.isArray(value.devices) &&
        Array.isArray(value.connections) &&
        Array.isArray(value.notes) &&
        typeof value.zoom === 'number' &&
        !!value.pan &&
        typeof value.pan.x === 'number' &&
        typeof value.pan.y === 'number';
}

function isValidDeviceStates(value: any): value is DeviceStates {
    return !!value &&
        typeof value.switchStates === 'object' &&
        !Array.isArray(value.switchStates) &&
        typeof value.pcOutputs === 'object' &&
        !Array.isArray(value.pcOutputs);
}

function sanitizePersistedState(input: any): Partial<AppState> {
    const safe: Partial<AppState> = {};

    if (isValidTopologyState(input?.topology)) {
        safe.topology = input.topology;
    } else {
        safe.topology = initialTopologyState;
    }

    if (isValidDeviceStates(input?.deviceStates)) {
        safe.deviceStates = input.deviceStates;
    } else {
        safe.deviceStates = initialDeviceStates;
    }

    if (input?.activeTab === 'topology' || input?.activeTab === 'cmd' || input?.activeTab === 'terminal' || input?.activeTab === 'tasks') {
        safe.activeTab = input.activeTab;
    } else {
        safe.activeTab = 'topology';
    }

    if (input?.activePanel === 'port' || input?.activePanel === 'vlan' || input?.activePanel === 'security' || input?.activePanel === 'config' || input?.activePanel === null) {
        safe.activePanel = input.activePanel;
    } else {
        safe.activePanel = null;
    }

    safe.sidebarOpen = typeof input?.sidebarOpen === 'boolean' ? input.sidebarOpen : true;

    if (input?.graphicsQuality === 'high' || input?.graphicsQuality === 'low') {
        safe.graphicsQuality = input.graphicsQuality;
    } else {
        safe.graphicsQuality = 'high';
    }

    return safe;
}

export function migrateAndValidatePersistedState(persistedState: any, persistedVersion?: number): Partial<AppState> {
    const stateCandidate = persistedState?.state ?? persistedState ?? {};
    const sanitized = sanitizePersistedState(stateCandidate);

    // Reset legacy saved graphics preference so new default opens in high quality.
    if (typeof persistedVersion === 'number' && persistedVersion < STORE_VERSION) {
        sanitized.graphicsQuality = 'high';
    }

    return sanitized;
}

// Helper to create actions
const createActions = (set: any, get: any) => ({
    // Topology actions
    setDevices: (devices: CanvasDevice[] | ((prev: CanvasDevice[]) => CanvasDevice[])) => {
        const nextDevices = typeof devices === 'function' ? devices(get().topology.devices) : devices;
        set({ topology: { ...get().topology, devices: nextDevices } });
    },
    setConnections: (connections: CanvasConnection[] | ((prev: CanvasConnection[]) => CanvasConnection[])) => {
        const nextConnections = typeof connections === 'function' ? connections(get().topology.connections) : connections;
        set({ topology: { ...get().topology, connections: nextConnections } });
    },
    setNotes: (notes: CanvasNote[] | ((prev: CanvasNote[]) => CanvasNote[])) => {
        const nextNotes = typeof notes === 'function' ? notes(get().topology.notes) : notes;
        set({ topology: { ...get().topology, notes: nextNotes } });
    },

    addDevice: (device: CanvasDevice) =>
        set({
            topology: {
                ...get().topology,
                devices: [...get().topology.devices, device]
            }
        }),

    removeDevice: (deviceId: string) => {
        const { devices, connections } = get().topology;
        set({
            topology: {
                ...get().topology,
                devices: devices.filter((d: CanvasDevice) => d.id !== deviceId),
                connections: connections.filter((c: CanvasConnection) => c.sourceDeviceId !== deviceId && c.targetDeviceId !== deviceId),
            }
        });
    },

    updateDevice: (deviceId: string, updates: Partial<CanvasDevice>) => {
        const devices = get().topology.devices.map((d: CanvasDevice) =>
            d.id === deviceId ? { ...d, ...updates } : d
        );
        set({ topology: { ...get().topology, devices } });
    },

    addConnection: (connection: CanvasConnection) =>
        set({
            topology: {
                ...get().topology,
                connections: [...get().topology.connections, connection]
            }
        }),

    removeConnection: (connectionId: string) => {
        const connections = get().topology.connections.filter((c: CanvasConnection) => c.id !== connectionId);
        set({ topology: { ...get().topology, connections } });
    },

    addNote: (note: CanvasNote) =>
        set({
            topology: {
                ...get().topology,
                notes: [...get().topology.notes, note]
            }
        }),

    removeNote: (noteId: string) => {
        const notes = get().topology.notes.filter((n: CanvasNote) => n.id !== noteId);
        set({ topology: { ...get().topology, notes } });
    },

    updateNote: (noteId: string, updates: Partial<CanvasNote>) => {
        const notes = get().topology.notes.map((n: CanvasNote) =>
            n.id === noteId ? { ...n, ...updates } : n
        );
        set({ topology: { ...get().topology, notes } });
    },

    setSelectedDevice: (deviceId: string | null) =>
        set({ topology: { ...get().topology, selectedDeviceId: deviceId } }),

    setZoom: (zoom: number | ((prev: number) => number)) => {
        const nextZoom = typeof zoom === 'function' ? zoom(get().topology.zoom) : zoom;
        set({ topology: { ...get().topology, zoom: nextZoom } });
    },

    setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
        const nextPan = typeof pan === 'function' ? pan(get().topology.pan) : pan;
        set({ topology: { ...get().topology, pan: nextPan } });
    },

    // Device state actions
    setSwitchState: (deviceId: string, state: SwitchState) =>
        set({
            deviceStates: {
                ...get().deviceStates,
                switchStates: {
                    ...get().deviceStates.switchStates,
                    [deviceId]: state
                }
            }
        }),

    getSwitchState: (deviceId: string) => get().deviceStates.switchStates[deviceId],

    setPCOutput: (deviceId: string, output: any[]) =>
        set({
            deviceStates: {
                ...get().deviceStates,
                pcOutputs: {
                    ...get().deviceStates.pcOutputs,
                    [deviceId]: output
                }
            }
        }),

    getPCOutput: (deviceId: string) => get().deviceStates.pcOutputs[deviceId],

    // UI actions
    setActiveTab: (tab: 'topology' | 'cmd' | 'terminal' | 'tasks') => set({ activeTab: tab }),
    setActivePanel: (panel: 'port' | 'vlan' | 'security' | 'config' | null) => set({ activePanel: panel }),
    setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
    setGraphicsQuality: (quality: 'high' | 'low') => set({ graphicsQuality: quality }),

    // Reset
    resetAll: () => set({
        topology: initialTopologyState,
        deviceStates: initialDeviceStates,
        activeTab: 'topology',
        activePanel: null,
        graphicsQuality: 'high',
    }),
});

// Create the store with persistence
export const useAppStore = create<AppState>()(
    persist(
        (set: any, get: any) => ({
            ...initialState,
            ...createActions(set, get),
        }),
        {
            name: STORE_KEY,
            version: STORE_VERSION,
            storage: createJSONStorage(() => localStorage),
            partialize: (state: AppState) => ({
                topology: state.topology,
                deviceStates: state.deviceStates,
                activeTab: state.activeTab,
                activePanel: state.activePanel,
                sidebarOpen: state.sidebarOpen,
                graphicsQuality: state.graphicsQuality,
            }),
            migrate: (persistedState: any, version: number) => {
                try {
                    return migrateAndValidatePersistedState(persistedState, version) as AppState;
                } catch {
                    return {
                        ...initialState,
                        ...createActions(() => { }, () => initialState),
                    } as AppState;
                }
            },
            onRehydrateStorage: () => (state, error) => {
                if (typeof window === 'undefined') return;

                if (error) {
                    try {
                        const raw = localStorage.getItem(STORE_KEY);
                        if (raw) {
                            localStorage.setItem(STORE_BACKUP_KEY, raw);
                        }
                        localStorage.removeItem(STORE_KEY);
                    } catch {
                        // noop
                    }
                    return;
                }

                try {
                    const raw = localStorage.getItem(STORE_KEY);
                    if (!raw) return;
                    const parsed = JSON.parse(raw);
                    const sanitized = migrateAndValidatePersistedState(parsed);
                    const sanitizedPayload = {
                        ...parsed,
                        state: sanitized,
                        version: STORE_VERSION,
                    };
                    localStorage.setItem(STORE_KEY, JSON.stringify(sanitizedPayload));
                    localStorage.setItem(STORE_BACKUP_KEY, JSON.stringify(sanitizedPayload));
                } catch {
                    // If we cannot parse persisted value, preserve raw payload and reset.
                    try {
                        const raw = localStorage.getItem(STORE_KEY);
                        if (raw) {
                            localStorage.setItem(STORE_BACKUP_KEY, raw);
                            localStorage.removeItem(STORE_KEY);
                        }
                    } catch {
                        // noop
                    }
                }
            }
        }
    )
);

// Cross-tab synchronization for persisted Zustand state.
// When another tab writes to the same storage key, hydrate current tab store snapshot.
if (typeof window !== 'undefined') {
    const syncFlag = '__netsim_store_sync_initialized__';
    const globalRef = window as unknown as Record<string, unknown>;

    if (!globalRef[syncFlag]) {
        window.addEventListener('storage', (event: StorageEvent) => {
            if (event.key !== 'network-simulator-storage' || !event.newValue) return;

            try {
                const parsed = JSON.parse(event.newValue) as {
                    state?: Partial<AppState>;
                };
                const nextState = parsed.state;
                if (!nextState) return;

                useAppStore.setState((prev) => ({
                    ...prev,
                    ...(nextState.topology ? { topology: nextState.topology } : {}),
                    ...(nextState.deviceStates ? { deviceStates: nextState.deviceStates } : {}),
                    ...(nextState.activeTab ? { activeTab: nextState.activeTab } : {}),
                    ...(typeof nextState.activePanel !== 'undefined' ? { activePanel: nextState.activePanel } : {}),
                    ...(typeof nextState.sidebarOpen === 'boolean' ? { sidebarOpen: nextState.sidebarOpen } : {}),
                    ...(nextState.graphicsQuality ? { graphicsQuality: nextState.graphicsQuality } : {}),
                }));
            } catch {
                // Ignore malformed payloads from storage.
            }
        });

        globalRef[syncFlag] = true;
    }
}

// ─── Selectors for granular state access ───
// These selectors prevent cascading re-renders by allowing components to subscribe to specific state slices

// Topology selectors
export const useTopologyDevices = () => useAppStore(state => state.topology.devices);
export const useTopologyConnections = () => useAppStore(state => state.topology.connections);
export const useTopologyNotes = () => useAppStore(state => state.topology.notes);
export const useSelectedDeviceId = () => useAppStore(state => state.topology.selectedDeviceId);
export const useZoom = () => useAppStore(state => state.topology.zoom);
export const usePan = () => useAppStore(state => state.topology.pan);

// Device state selectors
export const useSwitchState = (deviceId: string) => useAppStore(state => state.deviceStates.switchStates[deviceId]);
export const usePCOutput = (deviceId: string) => useAppStore(state => state.deviceStates.pcOutputs[deviceId]);

// UI state selectors
export const useActiveTab = () => useAppStore(state => state.activeTab);
export const useActivePanel = () => useAppStore(state => state.activePanel);
export const useSidebarOpen = () => useAppStore(state => state.sidebarOpen);

// Combined selectors for common use cases
export const useTopologyState = () => useAppStore(state => state.topology);
export const useDeviceStates = () => useAppStore(state => state.deviceStates);
export const useUIState = () => useAppStore(state => ({
    activeTab: state.activeTab,
    activePanel: state.activePanel,
    sidebarOpen: state.sidebarOpen,
}));

export default useAppStore;
