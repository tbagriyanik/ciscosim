'use client';

import { Skeleton } from "./skeleton";

export function AppSkeleton() {
    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden">
            {/* Header Skeleton */}
            <header className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="flex flex-col gap-1">
                        <Skeleton className="w-32 h-4" />
                        <Skeleton className="w-20 h-3" />
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-4">
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                            <Skeleton className="w-16 h-3" />
                            <Skeleton className="w-12 h-5 rounded-full" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full overflow-hidden">
                                <Skeleton className="h-full w-1/2" />
                            </div>
                            <div className="flex items-baseline gap-0.5">
                                <Skeleton className="w-8 h-4" />
                                <Skeleton className="w-6 h-3" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl border">
                        <div className="hidden items-center gap-1 sm:hidden">
                            <Skeleton className="w-8 h-8 rounded-md" />
                            <Skeleton className="w-8 h-8 rounded-md" />
                            <Skeleton className="w-px h-4 mx-1" />
                        </div>
                        <div className="hidden md:flex items-center gap-1">
                            <Skeleton className="w-8 h-8 rounded-md" />
                            <Skeleton className="w-8 h-8 rounded-md" />
                            <Skeleton className="w-8 h-8 rounded-md" />
                        </div>
                        <Skeleton className="w-8 h-8 rounded-md" />
                        <Skeleton className="w-16 h-8" />
                        <Skeleton className="w-8 h-8 rounded-md" />
                    </div>
                </div>
                <Skeleton className="w-10 h-10 md:hidden rounded-md" />
            </header>

            {/* Main Content */}
            <main className="flex-1 flex overflow-hidden gap-4 p-4">
                {/* Center - Topology Canvas */}
                <div className="flex-1 flex flex-col rounded-lg border border-border overflow-hidden bg-slate-900">
                    {/* Toolbar */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/30">
                        <Skeleton className="w-8 h-8 rounded-md" />
                        <Skeleton className="w-8 h-8 rounded-md" />
                        <Skeleton className="w-8 h-8 rounded-md" />
                        <div className="flex-1" />
                        <Skeleton className="w-16 h-6 rounded-md" />
                    </div>

                    {/* Canvas Area */}
                    <div className="flex-1 relative bg-gradient-to-br from-slate-900 to-slate-950">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 to-transparent pointer-events-none animate-pulse" />
                    </div>
                </div>

                {/* Right Sidebar - Panels */}
                <div className="hidden xl:flex w-80 flex-col gap-4">
                    {/* Panel 1 */}
                    <div className="flex-1 rounded-lg border border-border bg-background p-4 space-y-3">
                        <Skeleton className="w-24 h-6" />
                        <Skeleton className="w-full h-4" />
                        <Skeleton className="w-full h-4" />
                        <Skeleton className="w-3/4 h-4" />
                    </div>

                    {/* Panel 2 */}
                    <div className="flex-1 rounded-lg border border-border bg-background p-4 space-y-3">
                        <Skeleton className="w-24 h-6" />
                        <Skeleton className="w-full h-4" />
                        <Skeleton className="w-full h-4" />
                        <Skeleton className="w-3/4 h-4" />
                    </div>
                </div>
            </main>

            {/* Footer Skeleton */}
            <footer className="flex items-center justify-between px-5 py-2 border-t border-border text-xs text-muted-foreground">
                <div className="flex gap-3">
                    <Skeleton className="w-16 h-3" />
                    <Skeleton className="w-20 h-3" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="w-12 h-3" />
                    <Skeleton className="w-16 h-3" />
                </div>
            </footer>
        </div>
    );
}
