import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CanvasDevice, CanvasConnection, CanvasNote } from '@/components/network/networkTopology.types';
import { SwitchState } from '@/lib/network/types';
import { createTabSpecificStorage } from './tabStorage';
import { errorHandler, STORAGE_ERRORS } from '@/lib/errors/errorHandler';
import { secureStorage } from '@/lib/storage/secureStorage';

// Environment settings types
export type EnvironmentBackground = 'none' | 'house' | 'twoStoryGarage' | 'greenhouse';

export interface EnvironmentSettings {
    background: EnvironmentBackground;
    temperature: number; // Celsius
    humidity: number; // Percentage 0-100
    light: number; // Percentage 0-100
}

const VALID_DEVICE_TYPES = new Set(['pc', 'iot', 'switchL2', 'switchL3', 'router', 'firewall', 'wlc']);
const VALID_NOTE_SIZES = new Set([10, 12, 16, 20]);
const VALID_NOTE_OPACITIES = new Set([0.25, 0.5, 0.75, 1]);

function isValidCanvasDevice(value: unknown): value is CanvasDevice {
    if (!value || typeof value !== 'object') return false;
    const d = value as Record<string, unknown>;
    return typeof d.id === 'string' &&
        VALID_DEVICE_TYPES.has(d.type as string) &&
        typeof d.name === 'string' &&
        typeof d.x === 'number' &&
        typeof d.y === 'number' &&
        typeof d.ip === 'string' &&
        Array.isArray(d.ports);
}

function isValidCanvasConnection(value: unknown): value is CanvasConnection {
    if (!value || typeof value !== 'object') return false;
    const c = value as Record<string, unknown>;
    return typeof c.id === 'string' &&
        typeof c.sourceDeviceId === 'string' &&
        typeof c.sourcePort === 'string' &&
        typeof c.targetDeviceId === 'string' &&
        typeof c.targetPort === 'string' &&
        typeof c.cableType === 'string' &&
        typeof c.active === 'boolean';
}

function isValidCanvasNote(value: unknown): value is CanvasNote {
    if (!value || typeof value !== 'object') return false;
    const n = value as Record<string, unknown>;
    return typeof n.id === 'string' &&
        typeof n.text === 'string' &&
        typeof n.x === 'number' &&
        typeof n.y === 'number' &&
        typeof n.width === 'number' &&
        typeof n.height === 'number' &&
        typeof n.color === 'string' &&
        (n.font === undefined || typeof n.font === 'string') &&
        (n.fontSize === undefined || VALID_NOTE_SIZES.has(n.fontSize as number)) &&
        (n.opacity === undefined || VALID_NOTE_OPACITIES.has(n.opacity as number));
}

// Types for the store
export interface CapturedPacket {
    id: string;
    timestamp: number;
    connectionId: string;
    sourceIp: string;
    targetIp: string;
    protocol: string;
    length: number;
    info: string;
}

export interface NetworkEventLog {
    id: string;
    timestamp: number;
    level: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    detail?: string;
}

interface TopologyState {
    devices: CanvasDevice[];
    connections: CanvasConnection[];
    notes: CanvasNote[];
    selectedDeviceId: string | null;
    activeCaptureConnectionId: string | null;
    capturedPackets: Record<string, CapturedPacket[]>;
    networkEventLogs: NetworkEventLog[];
    zoom: number;
    pan: { x: number; y: number };
    environment: EnvironmentSettings;
    isSimulationMode: boolean;
    showSTPOverlay: boolean;
}

interface DeviceStates {
    switchStates: Record<string, SwitchState>;
    pcOutputs: Record<string, string[]>;
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
    helpLevel: 'beginner' | 'intermediate' | 'exam';

    // Actions
    setDevices: (devices: CanvasDevice[] | ((prev: CanvasDevice[]) => CanvasDevice[])) => void;
    setConnections: (connections: CanvasConnection[] | ((prev: CanvasConnection[]) => CanvasConnection[])) => void;
    setActiveCaptureConnection: (connectionId: string | null) => void;
    addCapturedPacket: (packet: Omit<CapturedPacket, 'id' | 'timestamp'>) => void;
    clearCapturedPackets: (connectionId: string) => void;
    clearAllCapturedPackets: () => void;
    addNetworkEventLog: (log: Omit<NetworkEventLog, 'id' | 'timestamp'>) => void;
    removeNetworkEventLog: (logId: string) => void;
    clearNetworkEventLogs: () => void;
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
    setEnvironment: (settings: EnvironmentSettings | ((prev: EnvironmentSettings) => EnvironmentSettings)) => void;
    setSimulationMode: (enabled: boolean) => void;
    setSTPOverlay: (enabled: boolean) => void;

    // Device state management
    setSwitchState: (deviceId: string, state: SwitchState) => void;
    getSwitchState: (deviceId: string) => SwitchState | undefined;
    setPCOutput: (deviceId: string, output: string[]) => void;
    getPCOutput: (deviceId: string) => string[];

    // UI actions
    setActiveTab: (tab: 'topology' | 'cmd' | 'terminal' | 'tasks') => void;
    setActivePanel: (panel: 'port' | 'vlan' | 'security' | 'config' | null) => void;
    setSidebarOpen: (open: boolean) => void;
    setGraphicsQuality: (quality: 'high' | 'low') => void;
    setHelpLevel: (level: 'beginner' | 'intermediate' | 'exam') => void;

    // Reset
    resetAll: () => void;
}

// Initial state
const initialEnvironmentSettings: EnvironmentSettings = {
    background: 'none',
    temperature: 22,
    humidity: 50,
    light: 70,
};

const initialTopologyState: TopologyState = {
    devices: [],
    connections: [],
    notes: [],
    selectedDeviceId: null,
    activeCaptureConnectionId: null,
    capturedPackets: {},
    networkEventLogs: [],
    zoom: 1,
    pan: { x: 0, y: 0 },
    environment: initialEnvironmentSettings,
    isSimulationMode: true,
    showSTPOverlay: false,
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
    helpLevel: 'beginner',
};

const STORE_KEY = 'network-simulator-storage';
const STORE_VERSION = 4;
const STORE_BACKUP_KEY = `${STORE_KEY}-backup`;

function isValidTopologyState(value: Record<string, unknown> | undefined): boolean {
    if (!value) return false;
    return Array.isArray(value.devices) &&
        Array.isArray(value.connections) &&
        Array.isArray(value.notes) &&
        typeof value.zoom === 'number' &&
        !!value.pan &&
        typeof (value.pan as Record<string, unknown>)?.x === 'number' &&
        typeof (value.pan as Record<string, unknown>)?.y === 'number' &&
        !!value.environment &&
        typeof (value.environment as Record<string, unknown>)?.background === 'string' &&
        typeof (value.environment as Record<string, unknown>)?.temperature === 'number' &&
        typeof (value.environment as Record<string, unknown>)?.humidity === 'number' &&
        typeof (value.environment as Record<string, unknown>)?.light === 'number';
}

function isValidDeviceStates(value: Record<string, unknown> | undefined): boolean {
    if (!value) return false;
    return typeof value.switchStates === 'object' &&
        !Array.isArray(value.switchStates) &&
        typeof value.pcOutputs === 'object' &&
        !Array.isArray(value.pcOutputs);
}

function sanitizePersistedState(input: Record<string, unknown> | undefined): Partial<AppState> {
    const safe: Partial<AppState> = {};

    if (isValidTopologyState(input?.topology as Record<string, unknown> | undefined)) {
        const top = (input as NonNullable<typeof input>).topology as Record<string, unknown>;
        safe.topology = {
            devices: (top.devices as unknown[]).filter(isValidCanvasDevice),
            connections: (top.connections as unknown[]).filter(isValidCanvasConnection),
            notes: (top.notes as unknown[]).filter(isValidCanvasNote),
            selectedDeviceId: typeof top.selectedDeviceId === 'string' ? top.selectedDeviceId as string : null,
            activeCaptureConnectionId: typeof top.activeCaptureConnectionId === 'string' ? top.activeCaptureConnectionId : null,
            capturedPackets: (top.capturedPackets as Record<string, CapturedPacket[]>) || {},
            networkEventLogs: Array.isArray(top.networkEventLogs) ? top.networkEventLogs as NetworkEventLog[] : [],
            isSimulationMode: top.isSimulationMode !== undefined ? !!top.isSimulationMode : true,
            showSTPOverlay: !!top.showSTPOverlay,
            zoom: typeof top.zoom === 'number' ? top.zoom as number : 1,
            pan: { x: Number((top.pan as Record<string, unknown>)?.x ?? 0), y: Number((top.pan as Record<string, unknown>)?.y ?? 0) },
            environment: {
                background: (top.environment as Record<string, unknown>)?.background as EnvironmentBackground || 'none',
                temperature: Number((top.environment as Record<string, unknown>)?.temperature ?? 22),
                humidity: Number((top.environment as Record<string, unknown>)?.humidity ?? 50),
                light: Number((top.environment as Record<string, unknown>)?.light ?? 70),
            },
        };
    } else {
        const topology = input?.topology as Record<string, unknown> | undefined || {};
        safe.topology = {
            ...initialTopologyState,
            devices: Array.isArray(topology.devices) ? (topology.devices as unknown[]).filter(isValidCanvasDevice) : [],
            connections: Array.isArray(topology.connections) ? (topology.connections as unknown[]).filter(isValidCanvasConnection) : [],
            notes: Array.isArray(topology.notes) ? (topology.notes as unknown[]).filter(isValidCanvasNote) : [],
            activeCaptureConnectionId: typeof topology.activeCaptureConnectionId === 'string' ? topology.activeCaptureConnectionId : null,
            capturedPackets: (topology.capturedPackets as Record<string, CapturedPacket[]>) || {},
            networkEventLogs: Array.isArray(topology.networkEventLogs) ? topology.networkEventLogs as NetworkEventLog[] : [],
            isSimulationMode: topology.isSimulationMode !== undefined ? !!topology.isSimulationMode : true,
            showSTPOverlay: !!topology.showSTPOverlay,
            environment: {
                ...initialEnvironmentSettings,
                ...(topology.environment as Record<string, unknown>)
            }
        };
    }

    if (isValidDeviceStates(input?.deviceStates as Record<string, unknown> | undefined)) {
        safe.deviceStates = (input as NonNullable<typeof input>).deviceStates as DeviceStates;
    } else {
        safe.deviceStates = initialDeviceStates;
    }

    if (input?.activeTab === 'topology' || input?.activeTab === 'cmd' || input?.activeTab === 'terminal' || input?.activeTab === 'tasks') {
        safe.activeTab = input.activeTab as 'topology' | 'cmd' | 'terminal' | 'tasks';
    } else {
        safe.activeTab = 'topology';
    }

    if (input?.activePanel === 'port' || input?.activePanel === 'vlan' || input?.activePanel === 'security' || input?.activePanel === 'config' || input?.activePanel === null) {
        safe.activePanel = input.activePanel as 'port' | 'vlan' | 'security' | 'config' | null;
    } else {
        safe.activePanel = null;
    }

    safe.sidebarOpen = typeof input?.sidebarOpen === 'boolean' ? input.sidebarOpen as boolean : true;

    if (input?.graphicsQuality === 'high' || input?.graphicsQuality === 'low') {
        safe.graphicsQuality = input.graphicsQuality as 'high' | 'low';
    } else {
        safe.graphicsQuality = 'high';
    }

    return safe;
}

export function migrateAndValidatePersistedState(persistedState: unknown, persistedVersion?: number): Partial<AppState> {
    const stateCandidate = (persistedState as Record<string, unknown>)?.state ?? persistedState ?? {};
    const sanitized = sanitizePersistedState(stateCandidate as Record<string, unknown>);

    // Reset legacy saved graphics preference so new default opens in high quality.
    if (typeof persistedVersion === 'number' && persistedVersion < STORE_VERSION) {
        sanitized.graphicsQuality = 'high';
        if (sanitized.topology) {
            sanitized.topology.isSimulationMode = true;
        }
    }

    return sanitized;
}

// Helper to create actions
const createActions = (set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void, get: () => AppState) => ({
    // Topology actions
    setDevices: (devices: CanvasDevice[] | ((prev: CanvasDevice[]) => CanvasDevice[])) => {
        const nextDevices = typeof devices === 'function' ? devices(get().topology.devices) : devices;
        set({ topology: { ...get().topology, devices: nextDevices } });
    },
    setConnections: (connections: CanvasConnection[] | ((prev: CanvasConnection[]) => CanvasConnection[])) => {
        const nextConnections = typeof connections === 'function' ? connections(get().topology.connections) : connections;
        set({ topology: { ...get().topology, connections: nextConnections } });
    },
    setActiveCaptureConnection: (connectionId: string | null) => {
        set({ topology: { ...get().topology, activeCaptureConnectionId: connectionId } });
    },
    addCapturedPacket: (packet: Omit<CapturedPacket, 'id' | 'timestamp'>) => {
        const { connectionId } = packet;
        const currentPackets = get().topology.capturedPackets[connectionId] || [];

        // Deduplicate logic: if the exact same packet (source, target, protocol, info) was added in the last 100ms, ignore it (Strict Mode mitigation)
        const lastPacket = currentPackets[currentPackets.length - 1];
        if (lastPacket &&
            lastPacket.sourceIp === packet.sourceIp &&
            lastPacket.targetIp === packet.targetIp &&
            lastPacket.protocol === packet.protocol &&
            lastPacket.info === packet.info &&
            (Date.now() - lastPacket.timestamp < 100)) {
            return;
        }

        const newPacket: CapturedPacket = {
            ...packet,
            id: `pkt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
        };

        set({
            topology: {
                ...get().topology,
                capturedPackets: {
                    ...get().topology.capturedPackets,
                    [connectionId]: [...currentPackets, newPacket].slice(-50), // Keep last 50
                }
            }
        });
    },
    clearCapturedPackets: (connectionId: string) => {
        const nextPackets = { ...get().topology.capturedPackets };
        delete nextPackets[connectionId];
        set({ topology: { ...get().topology, capturedPackets: nextPackets } });
    },
    clearAllCapturedPackets: () => {
        set({ topology: { ...get().topology, capturedPackets: {} } });
    },
    addNetworkEventLog: (log: Omit<NetworkEventLog, 'id' | 'timestamp'>) => {
        const newLog: NetworkEventLog = {
            ...log,
            id: `nel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
        };
        set({
            topology: {
                ...get().topology,
                networkEventLogs: [newLog, ...get().topology.networkEventLogs].slice(0, 200),
            }
        });
    },
    removeNetworkEventLog: (logId: string) => {
        set({
            topology: {
                ...get().topology,
                networkEventLogs: get().topology.networkEventLogs.filter(log => log.id !== logId),
            }
        });
    },
    clearNetworkEventLogs: () => {
        set({ topology: { ...get().topology, networkEventLogs: [] } });
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

    setEnvironment: (settings: EnvironmentSettings | ((prev: EnvironmentSettings) => EnvironmentSettings)) => {
        const nextSettings = typeof settings === 'function' ? settings(get().topology.environment) : settings;
        set({ topology: { ...get().topology, environment: nextSettings } });
    },
    setSimulationMode: (enabled: boolean) => {
        set({ topology: { ...get().topology, isSimulationMode: enabled } });
    },
    setSTPOverlay: (enabled: boolean) => {
        set({ topology: { ...get().topology, showSTPOverlay: enabled } });
    },

    // Device state management
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

    setPCOutput: (deviceId: string, output: string[]) =>
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
    setHelpLevel: (level: 'beginner' | 'intermediate' | 'exam') => set({ helpLevel: level }),

    // Reset
    resetAll: () => set({
        topology: initialTopologyState,
        deviceStates: initialDeviceStates,
        activeTab: 'topology',
        activePanel: null,
        graphicsQuality: 'high',
        helpLevel: 'beginner',
    }),
});

// Create the store with persistence
export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            ...initialState,
            ...createActions(set as Parameters<typeof createActions>[0], get),
        }),
        {
            name: STORE_KEY,
            version: STORE_VERSION,
            storage: createTabSpecificStorage(),
            partialize: (state: AppState) => ({
                topology: state.topology,
                deviceStates: state.deviceStates,
                activeTab: state.activeTab,
                activePanel: state.activePanel,
                sidebarOpen: state.sidebarOpen,
                graphicsQuality: state.graphicsQuality,
                helpLevel: state.helpLevel,
            }),
            merge: (persistedState: unknown, currentState: AppState): AppState => {
                const persisted = (persistedState ?? {}) as Partial<AppState>;
                const persistedTopology = (persisted.topology ?? {}) as Partial<TopologyState>;

                return {
                    ...currentState,
                    ...persisted,
                    topology: {
                        ...initialTopologyState,
                        ...currentState.topology,
                        ...persistedTopology,
                        networkEventLogs: Array.isArray(persistedTopology.networkEventLogs)
                            ? persistedTopology.networkEventLogs as NetworkEventLog[]
                            : currentState.topology.networkEventLogs,
                    },
                };
            },
            migrate: (persistedState: unknown, version: number) => {
                try {
                    return migrateAndValidatePersistedState(persistedState, version) as AppState;
                } catch (e) {
                    errorHandler.logError(STORAGE_ERRORS.LOAD_FAILED({ operation: 'migrate', version, error: String(e) }));
                    return {
                        ...initialState,
                        ...createActions(() => { }, () => initialState as AppState),
                    } as AppState;
                }
            },
            onRehydrateStorage: () => (_state, error) => {
                if (typeof window === 'undefined') return;

                if (error) {
                    try {
                        const raw = secureStorage.getItem(STORE_KEY);
                        if (raw) {
                            secureStorage.setItem(STORE_BACKUP_KEY, raw);
                        }
                        secureStorage.removeItem(STORE_KEY);
                    } catch (e) {
                        errorHandler.logError(STORAGE_ERRORS.SAVE_FAILED({ operation: 'onRehydrateStorage-backup', error: String(e) }));
                    }
                    return;
                }

                try {
                    const raw = secureStorage.getItem(STORE_KEY);
                    if (!raw) return;
                    const parsed = JSON.parse(raw);
                    const sanitized = migrateAndValidatePersistedState(parsed);
                    const sanitizedPayload = {
                        ...parsed,
                        state: sanitized,
                        version: STORE_VERSION,
                    };
                    secureStorage.setItem(STORE_KEY, JSON.stringify(sanitizedPayload));
                    secureStorage.setItem(STORE_BACKUP_KEY, JSON.stringify(sanitizedPayload));
                } catch (e) {
                    try {
                        const raw = secureStorage.getItem(STORE_KEY);
                        if (raw) {
                            secureStorage.setItem(STORE_BACKUP_KEY, raw);
                            secureStorage.removeItem(STORE_KEY);
                        }
                    } catch (e2) {
                        errorHandler.logError(STORAGE_ERRORS.LOAD_FAILED({ operation: 'onRehydrateStorage-reset', error: String(e2) }));
                    }
                    errorHandler.logError(STORAGE_ERRORS.LOAD_FAILED({ operation: 'onRehydrateStorage', error: String(e) }));
                }
            }
        }
    )
);

// Cross-tab synchronization disabled for tab-specific storage.
// Each tab now maintains its own isolated data to prevent conflicts.
// If cross-tab sync is needed in the future, implement a separate mechanism.

// ─── Selectors for granular state access ───
// These selectors prevent cascading re-renders by allowing components to subscribe to specific state slices

// Topology selectors
export const useTopologyDevices = () => useAppStore(state => state.topology.devices);
export const useTopologyConnections = () => useAppStore(state => state.topology.connections);
export const useTopologyNotes = () => useAppStore(state => state.topology.notes);


// Environment selector
export const useEnvironment = () => useAppStore(state => state.topology.environment);
export const useZoom = () => useAppStore(state => state.topology.zoom);
export const usePan = () => useAppStore(state => state.topology.pan);
export const useActiveTab = () => useAppStore(state => state.activeTab);
export const useGraphicsQuality = () => useAppStore(state => state.graphicsQuality);
export const useIsSimulationMode = () => useAppStore(state => state.topology.isSimulationMode);
export const useShowSTPOverlay = () => useAppStore(state => state.topology.showSTPOverlay);
export const useNetworkEventLogs = () => useAppStore(state => state.topology.networkEventLogs);
