'use client';

import { Suspense, lazy } from 'react';
import { CableType } from '@/lib/network/types';
import { CanvasDevice, SelectedPortRef } from './networkTopology.types';

type PortSelectorStep = 'source' | 'target';

const PortSelectorComponent = lazy(() =>
    import('./NetworkTopologyPortSelectorModal').then((m) => ({
        default: m.NetworkTopologyPortSelectorModal,
    }))
);

interface LazyNetworkTopologyPortSelectorModalProps {
    isOpen: boolean;
    isDark: boolean;
    devices: CanvasDevice[];
    cableType: CableType;
    portSelectorStep: PortSelectorStep;
    selectedSourcePort: SelectedPortRef | null;
    onClose: () => void;
    onCableTypeChange: (nextType: CableType) => void;
    onSelectPort: (deviceId: string, portId: string) => void;
}

function PortSelectorFallback() {
    return (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" />
            <div className="relative w-full max-w-2xl rounded-[2.5rem] bg-slate-900/90 border-slate-800 border shadow-2xl overflow-hidden flex flex-col transition-all duration-500">
                <div className="px-8 py-6 border-b border-slate-800/50 bg-slate-800/30">
                    <div className="h-8 bg-slate-700 rounded animate-pulse mb-4" />
                    <div className="h-6 bg-slate-700 rounded animate-pulse" />
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-8 max-h-[50vh]">
                    <div className="h-32 bg-slate-700 rounded animate-pulse" />
                    <div className="h-32 bg-slate-700 rounded animate-pulse" />
                </div>
                <div className="px-8 py-6 border-t border-slate-800/50 bg-slate-800/30">
                    <div className="h-10 bg-slate-700 rounded animate-pulse w-24 ml-auto" />
                </div>
            </div>
        </div>
    );
}

export function LazyNetworkTopologyPortSelectorModal(
    props: LazyNetworkTopologyPortSelectorModalProps
) {
    if (!props.isOpen) return null;

    return (
        <Suspense fallback={<PortSelectorFallback />}>
            <PortSelectorComponent {...props} />
        </Suspense>
    );
}
