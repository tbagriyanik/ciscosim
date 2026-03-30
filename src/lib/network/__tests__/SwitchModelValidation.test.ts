import { describe, it, expect } from 'vitest';
import { createInitialState } from '../initialState';
import { SWITCH_MODELS, isLayer2Switch, isLayer3Switch, canAssignIPToPhysicalPort } from '../switchModels';

describe('Switch Model Validation', () => {
    describe('Switch Model Definitions', () => {
        it('should have correct layer for WS-C2960-24TT-L', () => {
            expect(SWITCH_MODELS['WS-C2960-24TT-L'].layer).toBe('L2');
        });

        it('should have correct layer for WS-C3560-24PS', () => {
            expect(SWITCH_MODELS['WS-C3560-24PS'].layer).toBe('L3');
        });

        it('should identify Layer 2 switches correctly', () => {
            expect(isLayer2Switch('WS-C2960-24TT-L')).toBe(true);
            expect(isLayer2Switch('WS-C3560-24PS')).toBe(false);
        });

        it('should identify Layer 3 switches correctly', () => {
            expect(isLayer3Switch('WS-C3560-24PS')).toBe(true);
            expect(isLayer3Switch('WS-C2960-24TT-L')).toBe(false);
        });

        it('should check IP assignment capability correctly', () => {
            expect(canAssignIPToPhysicalPort('WS-C2960-24TT-L')).toBe(false);
            expect(canAssignIPToPhysicalPort('WS-C3560-24PS')).toBe(true);
        });
    });

    describe('Switch Model State', () => {
        it('should initialize with correct switch model for Layer 2', () => {
            const state = createInitialState(undefined, 'WS-C2960-24TT-L');
            expect(state.switchModel).toBe('WS-C2960-24TT-L');
            expect(state.switchLayer).toBe('L2');
        });

        it('should initialize with correct switch model for Layer 3', () => {
            const state = createInitialState(undefined, 'WS-C3560-24PS');
            expect(state.switchModel).toBe('WS-C3560-24PS');
            expect(state.switchLayer).toBe('L3');
        });

        it('should have ports initialized correctly', () => {
            const state = createInitialState(undefined, 'WS-C2960-24TT-L');
            expect(Object.keys(state.ports).length).toBeGreaterThan(0);
            expect(state.ports['fa0/1']).toBeDefined();
            expect(state.ports['fa0/1'].type).toBe('fastethernet');
        });

        it('should not have vlan1 port by default (created via CLI)', () => {
            const state = createInitialState(undefined, 'WS-C2960-24TT-L');
            expect(state.ports['vlan1']).toBeUndefined();
        });
    });

    describe('Switch Model Features', () => {
        it('should have correct features for Layer 2 switch', () => {
            const info = SWITCH_MODELS['WS-C2960-24TT-L'];
            expect(info.features).toContain('Layer 2 Switching');
            expect(info.features).toContain('VLAN Support');
            expect(info.features).not.toContain('Layer 3 Routing');
        });

        it('should have correct features for Layer 3 switch', () => {
            const info = SWITCH_MODELS['WS-C3560-24PS'];
            expect(info.features).toContain('Layer 3 Routing');
            expect(info.features).toContain('IP Routing');
            expect(info.features).toContain('Routed Ports');
        });
    });
});
