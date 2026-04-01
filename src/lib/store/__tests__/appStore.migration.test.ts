import { describe, it, expect } from 'vitest';
import { migrateAndValidatePersistedState } from '../appStore';

describe('appStore persistence migration and validation', () => {
  it('should recover safely from malformed persisted payload', () => {
    const malformed = {
      state: {
        topology: {
          devices: null,
          connections: 'bad',
          notes: 42,
          zoom: '1x',
          pan: { x: '0', y: null },
        },
        deviceStates: 'broken',
        activeTab: 'unknown-tab',
        activePanel: 'invalid-panel',
        sidebarOpen: 'yes',
      },
    };

    const migrated = migrateAndValidatePersistedState(malformed);
    expect(migrated.topology).toBeDefined();
    expect(Array.isArray(migrated.topology?.devices)).toBe(true);
    expect(Array.isArray(migrated.topology?.connections)).toBe(true);
    expect(Array.isArray(migrated.topology?.notes)).toBe(true);
    expect(typeof migrated.topology?.zoom).toBe('number');
    expect(migrated.activeTab).toBe('topology');
    expect(migrated.activePanel).toBe(null);
    expect(typeof migrated.sidebarOpen).toBe('boolean');
  });

  it('should preserve valid payload fields', () => {
    const valid = {
      state: {
        topology: {
          devices: [],
          connections: [],
          notes: [],
          selectedDeviceId: null,
          zoom: 1.25,
          pan: { x: 12, y: -8 },
        },
        deviceStates: {
          switchStates: {},
          pcOutputs: {},
        },
        activeTab: 'tasks',
        activePanel: 'security',
        sidebarOpen: false,
        graphicsQuality: 'low',
      },
    };

    const migrated = migrateAndValidatePersistedState(valid);
    expect(migrated.topology?.zoom).toBe(1.25);
    expect(migrated.topology?.pan).toEqual({ x: 12, y: -8 });
    expect(migrated.activeTab).toBe('tasks');
    expect(migrated.activePanel).toBe('security');
    expect(migrated.sidebarOpen).toBe(false);
    expect(migrated.graphicsQuality).toBe('low');
  });

  it('should reset legacy graphics quality to high during version migration', () => {
    const legacy = {
      state: {
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
        graphicsQuality: 'low',
      },
    };

    const migrated = migrateAndValidatePersistedState(legacy, 2);
    expect(migrated.graphicsQuality).toBe('high');
  });
});
