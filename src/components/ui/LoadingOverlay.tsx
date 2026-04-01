'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface LoadingOverlayProps {
    message?: string;
    className?: string;
}

export function LoadingOverlay({ message, className }: LoadingOverlayProps) {
    return (
        <div
            className={cn(
                'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-background/60',
                className
            )}
            role="status"
            aria-live="polite"
        >
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                {message && (
                    <p className="text-sm text-muted-foreground">{message}</p>
                )}
            </div>
        </div>
    );
}
