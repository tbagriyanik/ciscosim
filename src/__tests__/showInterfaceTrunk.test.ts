import { describe, it, expect } from 'vitest';
import { createInitialState } from '@/lib/network/initialState';
import { executeCommand } from '@/lib/network/executor';

describe('Show interfaces trunk command', () => {
    it('renders port, mode and encapsulation columns for trunk ports', () => {
        let state = createInitialState();
        state = {
            ...state,
            currentMode: 'privileged',
            ports: {
                ...state.ports,
                'gi0/1': {
                    ...state.ports['gi0/1'],
                    mode: 'trunk',
                    status: 'connected',
                },
            },
        };

        const result = executeCommand(state, 'show interfaces trunk', 'en');

        expect(result.success).toBe(true);
        expect(result.output).toContain('Port        Mode         Encapsulation');
        expect(result.output).toContain('gi0/1       on           802.1q');
        expect(result.output).toContain('Native vlan');
    });
});
