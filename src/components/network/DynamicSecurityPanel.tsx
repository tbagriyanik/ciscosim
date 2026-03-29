'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { SkeletonSecurityPanel } from './SkeletonSecurityPanel';
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';
import type { SecurityPanelProps } from './SecurityPanel';

const SecurityPanelComponent = dynamic(() => import('./SecurityPanel').then(mod => ({ default: mod.SecurityPanel })), {
    loading: () => <SkeletonSecurityPanel />,
    ssr: false
});

export function DynamicSecurityPanel(props: SecurityPanelProps) {
    return (
        <AppErrorBoundary
            fallbackTitle="Security Panel Error"
            fallbackDescription="Failed to load the security panel. Please reload the page."
        >
            <Suspense fallback={<SkeletonSecurityPanel />}>
                <SecurityPanelComponent {...props} />
            </Suspense>
        </AppErrorBoundary>
    );
}
