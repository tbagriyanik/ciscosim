'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { ResponsiveImageConfig } from '../types';

/**
 * ResponsiveImage component for serving appropriately sized images based on viewport.
 * 
 * Features:
 * - Multiple image sizes for different breakpoints
 * - Responsive sizing based on viewport
 * - WebP format support with fallbacks
 * - Proper alt text and accessibility
 * 
 * Validates: Requirements 6.2, 6.3
 */

export interface ResponsiveImageProps {
    src: string;
    alt: string;
    width: number;
    height: number;
    sizes?: string;
    priority?: boolean;
    loading?: 'lazy' | 'eager';
    quality?: number;
    className?: string;
    containerClassName?: string;
    breakpoints?: Array<{
        breakpoint: number;
        width: number;
    }>;
    formats?: string[];
}

/**
 * Generates a sizes attribute string for responsive images.
 * 
 * @param breakpoints - Array of breakpoint configurations
 * @returns Sizes attribute string for use with Next.js Image
 */
function generateSizesAttribute(
    breakpoints: Array<{ breakpoint: number; width: number }>
): string {
    if (breakpoints.length === 0) {
        return '100vw';
    }

    // Sort breakpoints in ascending order
    const sorted = [...breakpoints].sort((a, b) => a.breakpoint - b.breakpoint);

    // Generate sizes string: (max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw
    const sizes = sorted
        .map((bp, idx) => {
            const isLast = idx === sorted.length - 1;
            const maxWidth = isLast ? '' : `(max-width: ${bp.breakpoint}px) `;
            const width = `${bp.width}px`;
            return `${maxWidth}${width}`;
        })
        .join(', ');

    return sizes;
}

/**
 * Renders a responsive image that adapts to different screen sizes.
 * Serves appropriately sized images based on device viewport.
 * 
 * @param props - Component props
 * @returns Responsive image component
 */
export function ResponsiveImage({
    src,
    alt,
    width,
    height,
    sizes,
    priority = false,
    loading = 'lazy',
    quality = 80,
    className,
    containerClassName,
    breakpoints = [
        { breakpoint: 640, width: 320 },
        { breakpoint: 1024, width: 512 },
        { breakpoint: 1280, width: 640 },
    ],
    formats = ['image/webp', 'image/jpeg'],
}: ResponsiveImageProps) {
    // Generate sizes attribute if not provided
    const computedSizes = useMemo(() => {
        return sizes || generateSizesAttribute(breakpoints);
    }, [sizes, breakpoints]);

    // Calculate aspect ratio for responsive container
    const aspectRatio = useMemo(() => {
        return (height / width) * 100;
    }, [width, height]);

    // Determine loading strategy: priority takes precedence
    const computedLoading = priority ? 'eager' : loading;

    return (
        <div
            className={cn(
                'relative overflow-hidden',
                containerClassName
            )}
            style={{
                paddingBottom: `${aspectRatio}%`,
            }}
        >
            <Image
                src={src}
                alt={alt}
                width={width}
                height={height}
                sizes={computedSizes}
                priority={priority}
                loading={computedLoading}
                quality={quality}
                className={cn(
                    'absolute inset-0 w-full h-full object-cover',
                    className
                )}
            />
        </div>
    );
}

/**
 * Responsive image with lazy loading (default).
 * Defers loading until the image enters the viewport.
 */
export function LazyResponsiveImage(
    props: Omit<ResponsiveImageProps, 'loading'>
) {
    return (
        <ResponsiveImage
            {...props}
            loading="lazy"
        />
    );
}

/**
 * Responsive image with eager loading.
 * Loads immediately without waiting for viewport intersection.
 */
export function EagerResponsiveImage(
    props: Omit<ResponsiveImageProps, 'loading'>
) {
    return (
        <ResponsiveImage
            {...props}
            loading="eager"
        />
    );
}

/**
 * Responsive image with custom breakpoints.
 * Allows fine-grained control over image sizes at different viewport widths.
 */
export function ResponsiveImageWithBreakpoints({
    breakpoints,
    ...props
}: ResponsiveImageProps) {
    return (
        <ResponsiveImage
            {...props}
            breakpoints={breakpoints}
        />
    );
}
