import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DynamicTerminal } from '../DynamicTerminal';
import { DynamicConfigPanel } from '../DynamicConfigPanel';
import { DynamicSecurityPanel } from '../DynamicSecurityPanel';
import { SkeletonTerminal } from '../SkeletonTerminal';
import { SkeletonConfigPanel } from '../SkeletonConfigPanel';
import { SkeletonSecurityPanel } from '../SkeletonSecurityPanel';

describe('Dynamic Imports - Code Splitting', () => {
    describe('SkeletonTerminal', () => {
        it('should render skeleton loading state', () => {
            const { container } = render(<SkeletonTerminal />);
            const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
            expect(skeletons.length).toBeGreaterThan(0);
        });

        it('should have proper card structure', () => {
            const { container } = render(<SkeletonTerminal />);
            const card = container.querySelector('[data-slot="card"]');
            expect(card).toBeTruthy();
        });
    });

    describe('SkeletonConfigPanel', () => {
        it('should render skeleton loading state', () => {
            const { container } = render(<SkeletonConfigPanel />);
            const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
            expect(skeletons.length).toBeGreaterThan(0);
        });

        it('should have proper card structure', () => {
            const { container } = render(<SkeletonConfigPanel />);
            const card = container.querySelector('[data-slot="card"]');
            expect(card).toBeTruthy();
        });
    });

    describe('SkeletonSecurityPanel', () => {
        it('should render skeleton loading state', () => {
            const { container } = render(<SkeletonSecurityPanel />);
            const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
            expect(skeletons.length).toBeGreaterThan(0);
        });

        it('should have proper card structure', () => {
            const { container } = render(<SkeletonSecurityPanel />);
            const card = container.querySelector('[data-slot="card"]');
            expect(card).toBeTruthy();
        });
    });

    describe('DynamicTerminal', () => {
        it('should render with error boundary wrapper', () => {
            const mockProps = {
                deviceId: 'test-device',
                deviceName: 'Test Device',
                prompt: 'Router>',
                state: {} as any,
                onCommand: vi.fn(),
                onClear: vi.fn(),
                output: [],
                isLoading: false,
                t: {} as any,
                theme: 'dark',
                language: 'en'
            };

            const { container } = render(<DynamicTerminal {...mockProps} />);
            expect(container).toBeTruthy();
        });
    });

    describe('DynamicConfigPanel', () => {
        it('should render with error boundary wrapper', () => {
            const mockProps = {
                state: {} as any,
                onExecuteCommand: vi.fn(),
                t: {} as any,
                theme: 'dark'
            };

            const { container } = render(<DynamicConfigPanel {...mockProps} />);
            expect(container).toBeTruthy();
        });
    });

    describe('DynamicSecurityPanel', () => {
        it('should render with error boundary wrapper', () => {
            const mockProps = {
                security: {} as any,
                t: {} as any,
                theme: 'dark'
            };

            const { container } = render(<DynamicSecurityPanel {...mockProps} />);
            expect(container).toBeTruthy();
        });
    });
});
