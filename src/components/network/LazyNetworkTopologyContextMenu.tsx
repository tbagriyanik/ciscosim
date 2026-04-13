'use client';

import { Suspense, lazy, RefObject } from 'react';
import { ContextMenuState, CanvasDevice, CanvasNote } from './networkTopology.types';

const ContextMenuComponent = lazy(() =>
    import('./NetworkTopologyContextMenu').then((m) => ({ default: m.default }))
);

interface LazyNetworkTopologyContextMenuProps {
    contextMenu: ContextMenuState | null;
    contextMenuRef: RefObject<HTMLDivElement | null>;
    isDark: boolean;
    language: string;
    noteFonts: string[];
    notes: CanvasNote[];
    devices: CanvasDevice[];
    note?: CanvasNote;
    selectedDeviceIds: string[];
    clipboardLength: number;
    noteClipboardLength: number;
    canUndo: boolean;
    canRedo: boolean;
    onClose: () => void;
    onUpdateNoteStyle: (id: string, style: any) => void;
    onNoteCut: (id: string) => void;
    onNoteCopy: (id: string) => void;
    onNotePaste: (id: string) => void;
    onNoteDeleteText: (id: string) => void;
    onNoteSelectAllText: (id: string) => void;
    onDuplicateNote: (id: string) => void;
    onPasteNotes: (x: number, y: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    onSelectAll: () => void;
    onOpenDevice: (d: CanvasDevice) => void;
    onCutDevices: (ids: string[]) => void;
    onCopyDevices: (ids: string[]) => void;
    onPasteDevice?: () => void;
    onDeleteDevices: (ids: string[]) => void;
    onStartConfig: (id: string) => void;
    onStartPing: (id: string) => void;
    onTogglePowerDevices: (ids: string[]) => void;
    onSaveToHistory: () => void;
    onClearDeviceSelection: () => void;
    onOpenTasks?: (deviceId: string) => void;
}

function ContextMenuFallback() {
    return null; // Don't show any fallback to prevent top-left corner box
}

export default function LazyNetworkTopologyContextMenu(
    props: LazyNetworkTopologyContextMenuProps
) {
    if (!props.contextMenu) return null;

    return (
        <Suspense fallback={<ContextMenuFallback />}>
            <ContextMenuComponent {...props} />
        </Suspense>
    );
}
