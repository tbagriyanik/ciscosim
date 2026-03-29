'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SkeletonDeviceList() {
    return (
        <Card className="bg-background border-border transition-all duration-300 hover:shadow-lg h-full flex flex-col">
            <CardHeader className="py-3 px-5 border-b border-border/50 bg-muted/30">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base sm:text-lg">
                        <Skeleton className="w-32 h-6" />
                    </CardTitle>
                    <Skeleton className="w-20 h-8" />
                </div>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
                {/* Skeleton list items - matching typical device list layout */}
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        {/* Device icon */}
                        <Skeleton className="w-8 h-8 rounded-md flex-shrink-0" />

                        {/* Device info */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                            <Skeleton className="w-24 h-4" />
                            <Skeleton className="w-32 h-3" />
                        </div>

                        {/* Status indicator */}
                        <Skeleton className="w-3 h-3 rounded-full flex-shrink-0" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
