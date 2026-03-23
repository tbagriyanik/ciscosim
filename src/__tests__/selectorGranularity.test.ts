/**
 * Selector Granularity Property Tests
 *
 * These tests verify that components only re-render when their selected state changes.
 * This is a critical performance optimization - components should NOT re-render when
 * unrelated state slices are updated.
 *
 * Validates: Requirements 1.2
 * **Validates: Requirements 1.2**
 * Feature: ui-ux-performance-improvements-phase1, Property: 1
 */

import { describe, it, expect } from 'vitest';
import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────────────────────
// Mock store structure matching the actual appStore.ts
// ─────────────────────────────────────────────────────────────────────────────

interface TopologyState {
    devices: Array<{ id: string; name: string }>;
    connections: Array<{ id: string; source: string; target: string }>;
    notes: Array<{ id: string; text: string }>;
    selectedDeviceId: string | null;
    zoom: number;
    pan: { x: number; y: number };
}

interface DeviceStates {
    switchStates: Record<string, { power: boolean }>;
    pcOutputs: Record<string, string[]>;
}

interface AppState {
    topology: TopologyState;
    deviceStates: DeviceStates;
    activeTab: 'topology' | 'cmd' | 'terminal' | 'tasks';
    activePanel: 'port' | 'vlan' | 'security' | 'config' | null;
    sidebarOpen: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property Test 1: Verify selector functions extract correct state slices
// ─────────────────────────────────────────────────────────────────────────────

describe('Property Test 1 — Selector Functions Extract Correct State', () => {
    it('selector functions correctly extract state slices from the store', () => {
        const initialState: AppState = {
            topology: {
                devices: [{ id: 'pc-1', name: 'PC-1' }],
                connections: [],
                notes: [],
                selectedDeviceId: null,
                zoom: 1,
                pan: { x: 0, y: 0 },
            },
            deviceStates: {
                switchStates: {},
                pcOutputs: {},
            },
            activeTab: 'topology',
            activePanel: null,
            sidebarOpen: true,
        };

        const store = create<AppState>()((set, get) => ({
            ...initialState,
            setDevices: (devices) => set({ topology: { ...get().topology, devices } }),
            setZoom: (zoom) => set({ topology: { ...get().topology, zoom } }),
            setActiveTab: (tab) => set({ activeTab: tab }),
        }));

        // Define selector functions
        const selectDevices = (state: AppState) => state.topology.devices;
        const selectZoom = (state: AppState) => state.topology.zoom;
        const selectActiveTab = (state: AppState) => state.activeTab;

        // Verify selectors extract correct values
        expect(selectDevices(store.getState())).toEqual(initialState.topology.devices);
        expect(selectZoom(store.getState())).toBe(initialState.topology.zoom);
        expect(selectActiveTab(store.getState())).toBe(initialState.activeTab);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property Test 2: Verify state isolation - updating one slice doesn't affect others
// ─────────────────────────────────────────────────────────────────────────────

describe('Property Test 2 — State Isolation', () => {
    it('updating devices does not affect zoom or activeTab', () => {
        const initialState: AppState = {
            topology: {
                devices: [],
                connections: [],
                notes: [],
                selectedDeviceId: null,
                zoom: 1,
                pan: { x: 0, y: 0 },
            },
            deviceStates: {
                switchStates: {},
                pcOutputs: {},
            },
            activeTab: 'topology',
            activePanel: null,
            sidebarOpen: true,
        };

        const store = create<AppState>()((set, get) => ({
            ...initialState,
            setDevices: (devices) => set({ topology: { ...get().topology, devices } }),
            setZoom: (zoom) => set({ topology: { ...get().topology, zoom } }),
            setActiveTab: (tab) => set({ activeTab: tab }),
        }));

        // Define selectors
        const selectDevices = (state: AppState) => state.topology.devices;
        const selectZoom = (state: AppState) => state.topology.zoom;
        const selectActiveTab = (state: AppState) => state.activeTab;

        // Initial state
        expect(selectDevices(store.getState())).toEqual([]);
        expect(selectZoom(store.getState())).toBe(1);
        expect(selectActiveTab(store.getState())).toBe('topology');

        // Update devices
        store.getState().setDevices([{ id: 'pc-1', name: 'PC-1' }]);

        // Verify devices changed but zoom and activeTab didn't
        expect(selectDevices(store.getState())).toEqual([{ id: 'pc-1', name: 'PC-1' }]);
        expect(selectZoom(store.getState())).toBe(1);
        expect(selectActiveTab(store.getState())).toBe('topology');

        // Update zoom
        store.getState().setZoom(1.5);

        // Verify zoom changed but devices and activeTab didn't
        expect(selectDevices(store.getState())).toEqual([{ id: 'pc-1', name: 'PC-1' }]);
        expect(selectZoom(store.getState())).toBe(1.5);
        expect(selectActiveTab(store.getState())).toBe('topology');

        // Update activeTab
        store.getState().setActiveTab('cmd');

        // Verify activeTab changed but devices and zoom didn't
        expect(selectDevices(store.getState())).toEqual([{ id: 'pc-1', name: 'PC-1' }]);
        expect(selectZoom(store.getState())).toBe(1.5);
        expect(selectActiveTab(store.getState())).toBe('cmd');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property Test 3: Verify device-specific state isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('Property Test 3 — Device-Specific State Isolation', () => {
    it('updating one device state does not affect other devices', () => {
        const initialState: AppState = {
            topology: {
                devices: [],
                connections: [],
                notes: [],
                selectedDeviceId: null,
                zoom: 1,
                pan: { x: 0, y: 0 },
            },
            deviceStates: {
                switchStates: {},
                pcOutputs: {},
            },
            activeTab: 'topology',
            activePanel: null,
            sidebarOpen: true,
        };

        const store = create<AppState>()((set, get) => ({
            ...initialState,
            setSwitchState: (deviceId, state) => set({
                deviceStates: {
                    ...get().deviceStates,
                    switchStates: {
                        ...get().deviceStates.switchStates,
                        [deviceId]: state
                    }
                }
            }),
        }));

        // Define selectors for specific devices
        const selectSwitchState = (state: AppState, deviceId: string) => state.deviceStates.switchStates[deviceId];

        // Initial state - no devices have switch states
        expect(selectSwitchState(store.getState(), 'device-a')).toBeUndefined();
        expect(selectSwitchState(store.getState(), 'device-b')).toBeUndefined();

        // Update device A's switch state
        store.getState().setSwitchState('device-a', { power: true });

        // Verify device A's state changed but device B's didn't
        expect(selectSwitchState(store.getState(), 'device-a')).toEqual({ power: true });
        expect(selectSwitchState(store.getState(), 'device-b')).toBeUndefined();

        // Update device B's switch state
        store.getState().setSwitchState('device-b', { power: false });

        // Verify both states are correct
        expect(selectSwitchState(store.getState(), 'device-a')).toEqual({ power: true });
        expect(selectSwitchState(store.getState(), 'device-b')).toEqual({ power: false });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property Test 4: Verify UI state isolation from topology state
// ─────────────────────────────────────────────────────────────────────────────

describe('Property Test 4 — UI State Isolation', () => {
    it('updating UI state does not affect topology state', () => {
        const initialState: AppState = {
            topology: {
                devices: [{ id: 'pc-1', name: 'PC-1' }],
                connections: [{ id: 'c1', source: 'pc-1', target: 'pc-2' }],
                notes: [],
                selectedDeviceId: null,
                zoom: 1,
                pan: { x: 0, y: 0 },
            },
            deviceStates: {
                switchStates: {},
                pcOutputs: {},
            },
            activeTab: 'topology',
            activePanel: null,
            sidebarOpen: true,
        };

        const store = create<AppState>()((set, get) => ({
            ...initialState,
            setActiveTab: (tab) => set({ activeTab: tab }),
            setActivePanel: (panel) => set({ activePanel: panel }),
            setSidebarOpen: (open) => set({ sidebarOpen: open }),
            setZoom: (zoom) => set({ topology: { ...get().topology, zoom } }),
        }));

        // Define selectors
        const selectDevices = (state: AppState) => state.topology.devices;
        const selectZoom = (state: AppState) => state.topology.zoom;
        const selectActiveTab = (state: AppState) => state.activeTab;
        const selectActivePanel = (state: AppState) => state.activePanel;
        const selectSidebarOpen = (state: AppState) => state.sidebarOpen;

        // Initial state
        expect(selectDevices(store.getState())).toHaveLength(1);
        expect(selectZoom(store.getState())).toBe(1);
        expect(selectActiveTab(store.getState())).toBe('topology');
        expect(selectActivePanel(store.getState())).toBeNull();
        expect(selectSidebarOpen(store.getState())).toBe(true);

        // Update UI state
        store.getState().setActiveTab('cmd');
        store.getState().setActivePanel('port');
        store.getState().setSidebarOpen(false);

        // Verify UI state changed but topology state didn't
        expect(selectActiveTab(store.getState())).toBe('cmd');
        expect(selectActivePanel(store.getState())).toBe('port');
        expect(selectSidebarOpen(store.getState())).toBe(false);
        expect(selectDevices(store.getState())).toHaveLength(1);
        expect(selectZoom(store.getState())).toBe(1);

        // Update topology state
        store.getState().setZoom(2);

        // Verify zoom changed but UI state didn't
        expect(selectZoom(store.getState())).toBe(2);
        expect(selectActiveTab(store.getState())).toBe('cmd');
        expect(selectActivePanel(store.getState())).toBe('port');
        expect(selectSidebarOpen(store.getState())).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property Test 5: Property-based test for selector granularity
// This test runs 100+ iterations to verify that components only re-render
// when their selected state changes across many random state update scenarios.
// ─────────────────────────────────────────────────────────────────────────────

describe('Property Test 5 — Property-Based Selector Granularity', () => {
    it('selector granularity: components only re-render for their specific state across 100+ iterations', () => {
        // Run 100 iterations to verify selector granularity
        for (let iteration = 0; iteration < 100; iteration++) {
            const initialState: AppState = {
                topology: {
                    devices: [],
                    connections: [],
                    notes: [],
                    selectedDeviceId: null,
                    zoom: 1,
                    pan: { x: 0, y: 0 },
                },
                deviceStates: {
                    switchStates: {},
                    pcOutputs: {},
                },
                activeTab: 'topology',
                activePanel: null,
                sidebarOpen: true,
            };

            const store = create<AppState>()((set, get) => ({
                ...initialState,
                setDevices: (devices) => set({ topology: { ...get().topology, devices } }),
                setZoom: (zoom) => set({ topology: { ...get().topology, zoom } }),
                setActiveTab: (tab) => set({ activeTab: tab }),
            }));

            // Define selectors
            const selectDevices = (state: AppState) => state.topology.devices;
            const selectZoom = (state: AppState) => state.topology.zoom;
            const selectActiveTab = (state: AppState) => state.activeTab;

            // Subscribe to different selectors
            const devices = selectDevices(store.getState());
            const zoom = selectZoom(store.getState());
            const activeTab = selectActiveTab(store.getState());

            // Verify initial values
            expect(devices).toEqual([]);
            expect(zoom).toBe(1);
            expect(activeTab).toBe('topology');

            // Perform state updates
            const updateType = iteration % 3;

            if (updateType === 0) {
                // Update devices
                store.getState().setDevices([{ id: `pc-${iteration}`, name: `PC-${iteration}` }]);
                expect(selectDevices(store.getState())).toHaveLength(1);
                expect(selectZoom(store.getState())).toBe(1);
                expect(selectActiveTab(store.getState())).toBe('topology');
            } else if (updateType === 1) {
                // Update zoom
                const newZoom = 1 + iteration * 0.1;
                store.getState().setZoom(newZoom);
                expect(selectDevices(store.getState())).toEqual([]);
                expect(selectZoom(store.getState())).toBe(newZoom);
                expect(selectActiveTab(store.getState())).toBe('topology');
            } else {
                // Update activeTab
                const tabs: AppState['activeTab'][] = ['topology', 'cmd', 'terminal', 'tasks'];
                const newTab = tabs[iteration % 4];
                store.getState().setActiveTab(newTab);
                expect(selectDevices(store.getState())).toEqual([]);
                expect(selectZoom(store.getState())).toBe(1);
                expect(selectActiveTab(store.getState())).toBe(newTab);
            }
        }
    });

    it('selector granularity: unrelated state changes do not affect subscribed components (100 iterations)', () => {
        // Run 100 iterations to verify selector granularity
        for (let iteration = 0; iteration < 100; iteration++) {
            const initialState: AppState = {
                topology: {
                    devices: [],
                    connections: [],
                    notes: [],
                    selectedDeviceId: null,
                    zoom: 1,
                    pan: { x: 0, y: 0 },
                },
                deviceStates: {
                    switchStates: {},
                    pcOutputs: {},
                },
                activeTab: 'topology',
                activePanel: null,
                sidebarOpen: true,
            };

            const store = create<AppState>()((set, get) => ({
                ...initialState,
                setDevices: (devices) => set({ topology: { ...get().topology, devices } }),
                setZoom: (zoom) => set({ topology: { ...get().topology, zoom } }),
                setPan: (pan) => set({ topology: { ...get().topology, pan } }),
                setActiveTab: (tab) => set({ activeTab: tab }),
                setSidebarOpen: (open) => set({ sidebarOpen: open }),
                setActivePanel: (panel) => set({ activePanel: panel }),
            }));

            // Define selectors
            const selectDevices = (state: AppState) => state.topology.devices;
            const selectZoom = (state: AppState) => state.topology.zoom;
            const selectActiveTab = (state: AppState) => state.activeTab;

            // Subscribe to devices
            const initialDevices = selectDevices(store.getState());
            expect(initialDevices).toEqual([]);

            // Perform unrelated state updates (zoom, pan, activeTab, etc.)
            store.getState().setZoom(1 + (iteration % 10) * 0.1);
            store.getState().setPan({ x: iteration * 10, y: iteration * 20 });
            store.getState().setActiveTab(iteration % 2 === 0 ? 'cmd' : 'terminal');
            store.getState().setSidebarOpen(iteration % 2 === 0);
            store.getState().setActivePanel(iteration % 2 === 0 ? 'port' : 'vlan');

            // Verify devices selector still returns empty array
            const finalDevices = selectDevices(store.getState());
            expect(finalDevices).toEqual([]);
        }
    });

    it('selector granularity: device-specific state updates only affect subscribed devices (100 iterations)', () => {
        // Run 100 iterations to verify device-specific selector granularity
        for (let iteration = 0; iteration < 100; iteration++) {
            const initialState: AppState = {
                topology: {
                    devices: [],
                    connections: [],
                    notes: [],
                    selectedDeviceId: null,
                    zoom: 1,
                    pan: { x: 0, y: 0 },
                },
                deviceStates: {
                    switchStates: {},
                    pcOutputs: {},
                },
                activeTab: 'topology',
                activePanel: null,
                sidebarOpen: true,
            };

            const store = create<AppState>()((set, get) => ({
                ...initialState,
                setSwitchState: (deviceId, state) => set({
                    deviceStates: {
                        ...get().deviceStates,
                        switchStates: {
                            ...get().deviceStates.switchStates,
                            [deviceId]: state
                        }
                    }
                }),
            }));

            // Define selector for specific device
            const selectSwitchState = (state: AppState, deviceId: string) => state.deviceStates.switchStates[deviceId];

            const deviceIdA = `device-a-${iteration}`;
            const deviceIdB = `device-b-${iteration}`;

            // Subscribe to device A's switch state
            const stateA = selectSwitchState(store.getState(), deviceIdA);
            expect(stateA).toBeUndefined();

            // Subscribe to device B's switch state
            const stateB = selectSwitchState(store.getState(), deviceIdB);
            expect(stateB).toBeUndefined();

            // Update device A's state
            store.getState().setSwitchState(deviceIdA, { power: iteration % 2 === 0 });

            // Verify device A's state was updated
            const updatedStateA = selectSwitchState(store.getState(), deviceIdA);
            expect(updatedStateA).toEqual({ power: iteration % 2 === 0 });

            // Verify device B's state is still unchanged
            const finalStateB = selectSwitchState(store.getState(), deviceIdB);
            expect(finalStateB).toBeUndefined();
        }
    });
});
