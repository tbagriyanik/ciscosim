/**
 * Responsive Breakpoint System
 * Defines mobile, tablet, and desktop breakpoints for consistent responsive design
 */

export const breakpoints = {
  // Mobile breakpoints
  mobile: {
    xs: '320px',   // Extra small mobile
    sm: '375px',   // Small mobile (iPhone SE)
    md: '414px',   // Medium mobile (iPhone 12/13)
    lg: '480px',   // Large mobile
  },
  
  // Tablet breakpoints
  tablet: {
    sm: '640px',   // Small tablet (iPad Mini)
    md: '768px',   // Medium tablet (iPad)
    lg: '896px',   // Large tablet (iPad Pro 11")
    xl: '1024px',  // Extra large tablet (iPad Pro 12.9")
  },
  
  // Desktop breakpoints
  desktop: {
    sm: '1200px',  // Small desktop
    md: '1366px',  // Medium desktop (MacBook Air)
    lg: '1440px',  // Large desktop (MacBook Pro)
    xl: '1600px',  // Extra large desktop
    '2xl': '1920px', // 2K desktop
  }
} as const;

export type BreakpointKey = keyof typeof breakpoints.mobile | keyof typeof breakpoints.tablet | keyof typeof breakpoints.desktop;

export const breakpointValues = {
  ...breakpoints.mobile,
  ...breakpoints.tablet,
  ...breakpoints.desktop,
} as const;

// Media query utilities
export const mediaQueries = {
  // Mobile-first approach
  mobile: {
    up: (size: keyof typeof breakpoints.mobile) => `@media (min-width: ${breakpoints.mobile[size]})`,
    down: (size: keyof typeof breakpoints.mobile) => `@media (max-width: ${Number(breakpoints.mobile[size]) - 1}px)`,
    only: (size: keyof typeof breakpoints.mobile) => {
      const sizes = Object.keys(breakpoints.mobile) as (keyof typeof breakpoints.mobile)[];
      const index = sizes.indexOf(size);
      const minWidth = breakpoints.mobile[size];
      const maxWidth = index < sizes.length - 1 ? breakpoints.mobile[sizes[index + 1]] : breakpoints.tablet.sm;
      return `@media (min-width: ${minWidth}) and (max-width: ${Number(maxWidth) - 1}px)`;
    }
  },
  
  tablet: {
    up: (size: keyof typeof breakpoints.tablet) => `@media (min-width: ${breakpoints.tablet[size]})`,
    down: (size: keyof typeof breakpoints.tablet) => `@media (max-width: ${Number(breakpoints.tablet[size]) - 1}px)`,
    only: (size: keyof typeof breakpoints.tablet) => {
      const sizes = Object.keys(breakpoints.tablet) as (keyof typeof breakpoints.tablet)[];
      const index = sizes.indexOf(size);
      const minWidth = breakpoints.tablet[size];
      const maxWidth = index < sizes.length - 1 ? breakpoints.tablet[sizes[index + 1]] : breakpoints.desktop.sm;
      return `@media (min-width: ${minWidth}) and (max-width: ${Number(maxWidth) - 1}px)`;
    }
  },
  
  desktop: {
    up: (size: keyof typeof breakpoints.desktop) => `@media (min-width: ${breakpoints.desktop[size]})`,
    down: (size: keyof typeof breakpoints.desktop) => `@media (max-width: ${Number(breakpoints.desktop[size]) - 1}px)`,
    only: (size: keyof typeof breakpoints.desktop) => {
      const sizes = Object.keys(breakpoints.desktop) as (keyof typeof breakpoints.desktop)[];
      const index = sizes.indexOf(size);
      const minWidth = breakpoints.desktop[size];
      const maxWidth = index < sizes.length - 1 ? breakpoints.desktop[sizes[index + 1]] : '9999px';
      return `@media (min-width: ${minWidth}) and (max-width: ${Number(maxWidth) - 1}px)`;
    }
  },
  
  // Range queries
  between: (min: keyof typeof breakpointValues, max: keyof typeof breakpointValues) => 
    `@media (min-width: ${breakpointValues[min]}) and (max-width: ${Number(breakpointValues[max]) - 1}px)`,
} as const;

// Device category detection
export const deviceCategories = {
  mobile: `@media (max-width: ${Number(breakpoints.tablet.sm) - 1}px)`,
  tablet: `@media (min-width: ${breakpoints.tablet.sm}) and (max-width: ${Number(breakpoints.desktop.sm) - 1}px)`,
  desktop: `@media (min-width: ${breakpoints.desktop.sm})`,
} as const;

// Breakpoint names for utilities
export const breakpointNames = {
  mobile: Object.keys(breakpoints.mobile) as (keyof typeof breakpoints.mobile)[],
  tablet: Object.keys(breakpoints.tablet) as (keyof typeof breakpoints.tablet)[],
  desktop: Object.keys(breakpoints.desktop) as (keyof typeof breakpoints.desktop)[],
} as const;
