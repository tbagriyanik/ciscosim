'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { SkeletonTerminal } from './SkeletonTerminal';
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';
import type { TerminalProps } from './Terminal';

const TerminalComponent = dynamic(() => import('./Terminal').then(mod => ({ default: mod.Terminal })), {
    loading: () => <SkeletonTerminal />,
    ssr: false
});

export function DynamicTerminal(props: TerminalProps) {
    return (
        <AppErrorBoundary
            fallbackTitle="Terminal Module Error"
            fallbackDescription="Failed to load the terminal module. Please reload the page."
        >
            <Suspense fallback={<SkeletonTerminal />}>
                <TerminalComponent {...props} />
            </Suspense>
        </AppErrorBoundary>
    );
}
