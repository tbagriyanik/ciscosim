'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonTopology() {
    return (
        <div className="w-full h-full flex flex-col bg-background">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="flex-1" />
                <Skeleton className="w-20 h-8 rounded-lg" />
                <Skeleton className="w-20 h-8 rounded-lg" />
            </div>

            {/* Main Canvas Area - Empty like blank topology */}
            <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950">
                {/* Animated pulse overlay to indicate loading */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 to-transparent pointer-events-none animate-pulse" />
            </div>
        </div>
    );
}
