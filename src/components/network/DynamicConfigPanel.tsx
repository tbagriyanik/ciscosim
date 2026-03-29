'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { SkeletonConfigPanel } from './SkeletonConfigPanel';
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';
import { ConfigPanel, type ConfigPanelProps } from './ConfigPanel';

const ConfigPanelComponent = dynamic(() => import('./ConfigPanel').then(mod => ({ default: mod.ConfigPanel })), {
    loading: () => <SkeletonConfigPanel />,
    ssr: false
});

export function DynamicConfigPanel(props: ConfigPanelProps) {
    return (
        <AppErrorBoundary
            fallbackTitle="Configuration Panel Error"
            fallbackDescription="Failed to load the configuration panel. Please reload the page."
        >
            <Suspense fallback={<SkeletonConfigPanel />}>
                <ConfigPanelComponent {...props} />
            </Suspense>
        </AppErrorBoundary>
    );
}
