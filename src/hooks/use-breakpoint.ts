'use client';

import { useState, useEffect } from 'react';
import { breakpointValues, deviceCategories } from '@/lib/design-system/breakpoints';

export type Breakpoint = keyof typeof breakpointValues;
export type DeviceCategory = 'mobile' | 'tablet' | 'desktop';

export interface BreakpointState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  currentBreakpoint: Breakpoint | null;
  deviceCategory: DeviceCategory;
}

/**
 * Hook for responsive breakpoint detection
 * Returns current screen size and breakpoint information
 */
export function useBreakpoint(): BreakpointState {
  const [state, setState] = useState<BreakpointState>(() => {
    // Initialize with server-side default values
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        currentBreakpoint: 'lg',
        deviceCategory: 'desktop'
      };
    }

    // Get initial values from window
    const width = window.innerWidth;
    const height = window.innerHeight;
    const { isMobile, isTablet, isDesktop, currentBreakpoint, deviceCategory } = getBreakpointInfo(width);
    
    return {
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
      currentBreakpoint,
      deviceCategory
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const { isMobile, isTablet, isDesktop, currentBreakpoint, deviceCategory } = getBreakpointInfo(width);
      
      setState(prev => ({
        ...prev,
        width,
        height,
        isMobile,
        isTablet,
        isDesktop,
        currentBreakpoint,
        deviceCategory
      }));
    };

    // Add event listener with passive option for better performance
    window.addEventListener('resize', handleResize, { passive: true });
    
    // Initial check
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return state;
}

/**
 * Get breakpoint information from width
 */
function getBreakpointInfo(width: number): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  currentBreakpoint: Breakpoint | null;
  deviceCategory: DeviceCategory;
} {
  // Find current breakpoint
  const sortedBreakpoints = Object.entries(breakpointValues)
    .sort(([, a], [, b]) => parseInt(a) - parseInt(b));

  let currentBreakpoint: Breakpoint | null = null;
  for (const [key, value] of sortedBreakpoints) {
    if (width >= parseInt(value)) {
      currentBreakpoint = key as Breakpoint;
    } else {
      break;
    }
  }

  // Determine device category
  let isMobile = false;
  let isTablet = false;
  let isDesktop = false;
  let deviceCategory: DeviceCategory = 'desktop';

  if (width < 640) { // tablet.sm
    isMobile = true;
    deviceCategory = 'mobile';
  } else if (width < 1200) { // desktop.sm
    isTablet = true;
    deviceCategory = 'tablet';
  } else {
    isDesktop = true;
    deviceCategory = 'desktop';
  }

  return {
    isMobile,
    isTablet,
    isDesktop,
    currentBreakpoint,
    deviceCategory
  };
}

/**
 * Hook for checking if current breakpoint matches criteria
 */
export function useBreakpointMatch(breakpoint: Breakpoint, operator: 'up' | 'down' | 'only' = 'up'): boolean {
  const { width } = useBreakpoint();
  const breakpointValue = parseInt(breakpointValues[breakpoint]);

  switch (operator) {
    case 'up':
      return width >= breakpointValue;
    case 'down':
      return width < breakpointValue;
    case 'only':
      // For 'only', we need to check if we're in this specific breakpoint range
      const sortedBreakpoints = Object.entries(breakpointValues)
        .sort(([, a], [, b]) => parseInt(a) - parseInt(b));
      
      const currentIndex = sortedBreakpoints.findIndex(([key]) => key === breakpoint);
      if (currentIndex === -1) return false;
      
      const minValue = breakpointValue;
      const maxValue = currentIndex < sortedBreakpoints.length - 1 
        ? parseInt(sortedBreakpoints[currentIndex + 1][1]) 
        : Infinity;
      
      return width >= minValue && width < maxValue;
    default:
      return false;
  }
}

/**
 * Hook for device category detection
 */
export function useDeviceCategory(): DeviceCategory {
  const { deviceCategory } = useBreakpoint();
  return deviceCategory;
}

/**
 * Hook for mobile detection
 */
export function useIsMobile(): boolean {
  const { isMobile } = useBreakpoint();
  return isMobile;
}

/**
 * Hook for tablet detection
 */
export function useIsTablet(): boolean {
  const { isTablet } = useBreakpoint();
  return isTablet;
}

/**
 * Hook for desktop detection
 */
export function useIsDesktop(): boolean {
  const { isDesktop } = useBreakpoint();
  return isDesktop;
}

export function useIsSmall(): boolean {
  const { isMobile, isTablet } = useBreakpoint();
  return isMobile || isTablet;
}

export function useIsMedium(): boolean {
  const { width } = useBreakpoint();
  return width >= 768 && width < 1280;
}

export function useIsLarge(): boolean {
  const { isDesktop } = useBreakpoint();
  return isDesktop;
}

/**
 * Hook for responsive style - returns different values based on screen size
 * Use: useResponsiveStyle({ small: 'text-sm', medium: 'text-base', large: 'text-lg' })
 */
export function useResponsiveStyle<T>(styles: {
  small?: T;
  medium?: T;
  large?: T;
}): T | undefined {
  const { width } = useBreakpoint();
  
  if (width < 768) {
    return styles.small;
  } else if (width < 1280) {
    return styles.medium;
  } else {
    return styles.large;
  }
}

/**
 * Hook for responsive values - returns different values based on breakpoint
 */
export function useResponsiveValue<T>(values: {
  mobile?: T;
  tablet?: T;
  desktop?: T;
}): T | undefined {
  const { deviceCategory } = useBreakpoint();
  return values[deviceCategory];
}

/**
 * Hook for responsive array values - returns values based on breakpoint index
 */
export function useResponsiveArray<T>(values: [T, T?, T?]): T {
  const { deviceCategory } = useBreakpoint();
  
  switch (deviceCategory) {
    case 'mobile':
      return values[0];
    case 'tablet':
      return values[1] ?? values[0];
    case 'desktop':
      return values[2] ?? values[1] ?? values[0];
    default:
      return values[0];
  }
}
