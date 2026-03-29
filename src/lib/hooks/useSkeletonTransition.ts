import { useEffect, useState } from 'react';

/**
 * Hook to manage skeleton screen transitions
 * Ensures smooth fade-out of skeleton and fade-in of content
 * Prevents layout shift by maintaining consistent dimensions
 */
export function useSkeletonTransition(isLoading: boolean, minDisplayTime: number = 300) {
    const [showSkeleton, setShowSkeleton] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        if (isLoading) {
            // Show skeleton immediately
            setShowSkeleton(true);
            setIsTransitioning(false);
        } else {
            // Ensure skeleton shows for minimum time to avoid flashing
            const timer = setTimeout(() => {
                setIsTransitioning(true);
                // After fade-out animation completes, hide skeleton
                const fadeOutTimer = setTimeout(() => {
                    setShowSkeleton(false);
                    setIsTransitioning(false);
                }, 400); // Match the fade-out animation duration

                return () => clearTimeout(fadeOutTimer);
            }, minDisplayTime);

            return () => clearTimeout(timer);
        }
    }, [isLoading, minDisplayTime]);

    return {
        showSkeleton,
        isTransitioning,
        skeletonClassName: isTransitioning ? 'animate-skeleton-fade-out' : '',
        contentClassName: !showSkeleton ? 'animate-content-fade-in' : 'opacity-0 pointer-events-none'
    };
}
