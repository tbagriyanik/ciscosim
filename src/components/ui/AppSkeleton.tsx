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
            <main className="flex-1 flex overflow-hidden">



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
