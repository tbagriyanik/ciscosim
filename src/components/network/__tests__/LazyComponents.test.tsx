import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { LazyAboutModal } from '../LazyAboutModal';
import LazyNetworkTopologyContextMenu from '../LazyNetworkTopologyContextMenu';
import { LazyNetworkTopologyPortSelectorModal } from '../LazyNetworkTopologyPortSelectorModal';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

const Providers = ({ children }: { children: React.ReactNode }) => (
    <LanguageProvider>
        <ThemeProvider>
            {children}
        </ThemeProvider>
    </LanguageProvider>
);

describe('Lazy-Loaded Components', () => {
    describe('LazyAboutModal', () => {
        it('should not render when isOpen is false', () => {
            const { container } = render(
                <Providers>
                    <LazyAboutModal isOpen={false} onClose={() => { }} />
                </Providers>
            );
            expect(container.querySelector('[role="dialog"]')).toBeNull();
        });

        it('should render when isOpen is true', async () => {
            render(
                <Providers>
                    <Suspense fallback={<div>Loading...</div>}>
                        <LazyAboutModal isOpen={true} onClose={() => { }} />
                    </Suspense>
                </Providers>
            );

            await waitFor(() => {
                const dialog = document.querySelector('[role="dialog"]');
                expect(dialog).toBeTruthy();
            }, { timeout: 3000 });
        });
    });

    describe('LazyNetworkTopologyContextMenu', () => {
        const mockContextMenu = {
            x: 100,
            y: 100,
            deviceId: null,
            noteId: null,
            mode: 'canvas' as const,
        };

        const mockProps = {
            contextMenu: mockContextMenu,
            contextMenuRef: { current: null },
            isDark: true,
            language: 'en',
            noteFonts: ['Arial', 'Helvetica'],
            notes: [],
            devices: [],
            selectedDeviceIds: [],
            clipboardLength: 0,
            noteClipboardLength: 0,
            canUndo: false,
            canRedo: false,
            onClose: vi.fn(),
            onUpdateNoteStyle: vi.fn(),
            onNoteCut: vi.fn(),
            onNoteCopy: vi.fn(),
            onNotePaste: vi.fn(),
            onNoteDeleteText: vi.fn(),
            onNoteSelectAllText: vi.fn(),
            onDuplicateNote: vi.fn(),
            onPasteNotes: vi.fn(),
            onUndo: vi.fn(),
            onRedo: vi.fn(),
            onSelectAll: vi.fn(),
            onOpenDevice: vi.fn(),
            onCutDevices: vi.fn(),
            onCopyDevices: vi.fn(),
            onPasteDevice: vi.fn(),
            onDeleteDevices: vi.fn(),
            onStartConfig: vi.fn(),
            onStartPing: vi.fn(),
            onTogglePowerDevices: vi.fn(),
            onSaveToHistory: vi.fn(),
            onClearDeviceSelection: vi.fn(),
        };

        it('should not render when contextMenu is null', () => {
            const { container } = render(
                <Providers>
                    <LazyNetworkTopologyContextMenu {...mockProps} contextMenu={null} />
                </Providers>
            );
            expect(container.querySelector('.context-menu')).toBeNull();
        });

        it('should render when contextMenu is provided', async () => {
            render(
                <Providers>
                    <Suspense fallback={<div>Loading...</div>}>
                        <LazyNetworkTopologyContextMenu {...mockProps} />
                    </Suspense>
                </Providers>
            );

            await waitFor(() => {
                const menu = document.querySelector('.context-menu');
                expect(menu).toBeTruthy();
            }, { timeout: 3000 });
        });
    });

    describe('LazyNetworkTopologyPortSelectorModal', () => {
        const mockProps = {
            isOpen: true,
            isDark: true,
            devices: [],
            cableType: 'straight' as const,
            portSelectorStep: 'source' as const,
            selectedSourcePort: null,
            onClose: vi.fn(),
            onCableTypeChange: vi.fn(),
            onSelectPort: vi.fn(),
        };

        it('should not render when isOpen is false', () => {
            const { container } = render(
                <Providers>
                    <LazyNetworkTopologyPortSelectorModal {...mockProps} isOpen={false} />
                </Providers>
            );
            expect(container.querySelector('[role="dialog"]')).toBeNull();
        });

        it('should render when isOpen is true', async () => {
            render(
                <Providers>
                    <Suspense fallback={<div>Loading...</div>}>
                        <LazyNetworkTopologyPortSelectorModal {...mockProps} />
                    </Suspense>
                </Providers>
            );

            await waitFor(() => {
                const modal = document.querySelector('.fixed.inset-0');
                expect(modal).toBeTruthy();
            }, { timeout: 3000 });
        });
    });

    describe('Lazy Loading Performance', () => {
        it('should load AboutModal lazily without blocking initial render', async () => {
            const startTime = performance.now();

            render(
                <Providers>
                    <Suspense fallback={<div>Loading...</div>}>
                        <LazyAboutModal isOpen={true} onClose={() => { }} />
                    </Suspense>
                </Providers>
            );

            const endTime = performance.now();
            const loadTime = endTime - startTime;

            expect(loadTime).toBeLessThan(100);
        });

        it('should load PortSelectorModal lazily without blocking initial render', async () => {
            const startTime = performance.now();

            render(
                <Providers>
                    <Suspense fallback={<div>Loading...</div>}>
                        <LazyNetworkTopologyPortSelectorModal
                            isOpen={true}
                            isDark={true}
                            devices={[]}
                            cableType="straight"
                            portSelectorStep="source"
                            selectedSourcePort={null}
                            onClose={() => { }}
                            onCableTypeChange={() => { }}
                            onSelectPort={() => { }}
                        />
                    </Suspense>
                </Providers>
            );

            const endTime = performance.now();
            const loadTime = endTime - startTime;

            expect(loadTime).toBeLessThan(100);
        });
    });
});
