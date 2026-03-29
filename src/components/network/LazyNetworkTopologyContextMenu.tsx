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
}

function ContextMenuFallback() {
    return (
        <div className="fixed z-50 py-1 rounded-lg shadow-xl min-w-[140px] max-w-[240px] bg-slate-800 border border-slate-700 animate-pulse">
            <div className="px-2 py-2 space-y-2">
                <div className="h-6 bg-slate-700 rounded" />
                <div className="h-6 bg-slate-700 rounded" />
                <div className="h-6 bg-slate-700 rounded" />
            </div>
        </div>
    );
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
