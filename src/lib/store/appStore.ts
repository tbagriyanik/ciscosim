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

    // Actions
    setDevices: (devices: CanvasDevice[]) => void;
    setConnections: (connections: CanvasConnection[]) => void;
    setNotes: (notes: CanvasNote[]) => void;
    addDevice: (device: CanvasDevice) => void;
    removeDevice: (deviceId: string) => void;
    updateDevice: (deviceId: string, updates: Partial<CanvasDevice>) => void;
    addConnection: (connection: CanvasConnection) => void;
    removeConnection: (connectionId: string) => void;
    addNote: (note: CanvasNote) => void;
    removeNote: (noteId: string) => void;
    updateNote: (noteId: string, updates: Partial<CanvasNote>) => void;
    setSelectedDevice: (deviceId: string | null) => void;
    setZoom: (zoom: number) => void;
    setPan: (pan: { x: number; y: number }) => void;

    // Device state management
    setSwitchState: (deviceId: string, state: SwitchState) => void;
    getSwitchState: (deviceId: string) => SwitchState | undefined;
    setPCOutput: (deviceId: string, output: any[]) => void;
    getPCOutput: (deviceId: string) => any[];

    // UI actions
    setActiveTab: (tab: 'topology' | 'cmd' | 'terminal' | 'tasks') => void;
    setActivePanel: (panel: 'port' | 'vlan' | 'security' | 'config' | null) => void;
    setSidebarOpen: (open: boolean) => void;

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
};

// Helper to create actions
const createActions = (set: any, get: any) => ({
    // Topology actions
    setDevices: (devices: CanvasDevice[]) => set({ topology: { ...get().topology, devices } }),
    setConnections: (connections: CanvasConnection[]) => set({ topology: { ...get().topology, connections } }),
    setNotes: (notes: CanvasNote[]) => set({ topology: { ...get().topology, notes } }),

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
        const devices = get().topology.devices.map(d =>
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
        const connections = get().topology.connections.filter(c => c.id !== connectionId);
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
        const notes = get().topology.notes.filter(n => n.id !== noteId);
        set({ topology: { ...get().topology, notes } });
    },

    updateNote: (noteId: string, updates: Partial<CanvasNote>) => {
        const notes = get().topology.notes.map(n =>
            n.id === noteId ? { ...n, ...updates } : n
        );
        set({ topology: { ...get().topology, notes } });
    },

    setSelectedDevice: (deviceId: string | null) =>
        set({ topology: { ...get().topology, selectedDeviceId: deviceId } }),

    setZoom: (zoom: number) =>
        set({ topology: { ...get().topology, zoom } }),

    setPan: (pan: { x: number; y: number }) =>
        set({ topology: { ...get().topology, pan } }),

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

    // Reset
    resetAll: () => set({
        topology: initialTopologyState,
        deviceStates: initialDeviceStates,
        activeTab: 'topology',
        activePanel: null,
    }),
});

// Create the store with persistence
export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            ...initialState,
            ...createActions(set, get),
        }),
        {
            name: 'network-simulator-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state: AppState) => ({
                topology: state.topology,
                deviceStates: state.deviceStates,
            }),
        }
    )
);

export default useAppStore;
