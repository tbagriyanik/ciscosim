'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SkeletonSecurityPanel() {
    return (
        <Card className="bg-slate-800 border-slate-700 transition-all duration-300 hover:shadow-lg">
            <CardHeader className="py-3 px-5 border-b border-slate-800/50 bg-slate-800/20">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base sm:text-lg">
                        <Skeleton className="w-28 h-6" />
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                <div className="space-y-2">
                    <Skeleton className="w-full h-10" />
                    <Skeleton className="w-full h-10" />
                    <Skeleton className="w-full h-10" />
                    <Skeleton className="w-full h-10" />
                    <Skeleton className="w-full h-10" />
                </div>
            </CardContent>
        </Card>
    );
}
