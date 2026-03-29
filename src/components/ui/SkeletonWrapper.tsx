'use client';

import React from 'react';
import { useSkeletonTransition } from '@/lib/hooks/useSkeletonTransition';

interface SkeletonWrapperProps {
    isLoading: boolean;
    skeleton: React.ReactNode;
    children: React.ReactNode;
    minDisplayTime?: number;
    className?: string;
}

/**
 * Wrapper component that manages smooth transitions between skeleton and content
 * Prevents layout shift by maintaining consistent dimensions
 * Ensures skeleton displays for minimum time to avoid flashing
 */
export function SkeletonWrapper({
    isLoading,
    skeleton,
    children,
    minDisplayTime = 300,
    className = ''
}: SkeletonWrapperProps) {
    const { showSkeleton, isTransitioning, skeletonClassName, contentClassName } =
        useSkeletonTransition(isLoading, minDisplayTime);

    return (
        <div className={className}>
            {/* Skeleton Layer */}
            {showSkeleton && (
                <div className={`transition-opacity duration-300 ${skeletonClassName}`}>
                    {skeleton}
                </div>
            )}

            {/* Content Layer */}
            {!showSkeleton && (
                <div className={`transition-opacity duration-500 ${contentClassName}`}>
                    {children}
                </div>
            )}
        </div>
    );
}
