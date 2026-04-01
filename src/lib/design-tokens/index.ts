/**
 * Design Tokens System
 * 
 * Central export for all design tokens including colors, typography,
 * spacing, animations, and theme definitions.
 */

export * from './types';
export * from './colors';
export * from './typography';
export * from './spacing';
export * from './animations';
export * from './breakpoints';

import type { DesignTokens, ThemeDefinition, ThemeConfig, ThemeVariant } from './types';
import {
    primaryColors,
    secondaryColors,
    accentColors,
    semanticColors,
    lightSurfaceColors,
    darkSurfaceColors,
    highContrastSurfaceColors,
    generateColorVariables,
    generateSurfaceVariables,
} from './colors';
import {
    fontFamilies,
    fontSizes,
    lineHeights,
    fontWeights,
    generateTypographyVariables,
} from './typography';
import {
    spacing,
    borderRadius,
    shadows,
    darkShadows,
    highContrastShadows,
    generateSpacingVariables,
    generateShadowVariables,
} from './spacing';
import {
    animations,
    generateAnimationVariables,
    keyframesCSS,
    reducedMotionMediaQuery,
} from './animations';
import {
    breakpoints,
} from './breakpoints';

// Base design tokens (theme-agnostic)
export const baseDesignTokens: Omit<DesignTokens, 'colors'> = {
    typography: {
        fontFamilies,
        fontSizes,
        lineHeights,
        fontWeights,
    },
    spacing,
    borderRadius,
    shadows,
    animations,
};

// Light Theme Definition
export const lightTheme: ThemeDefinition = {
    id: 'light',
    name: 'Light',
    variant: 'light',
    tokens: {
        ...baseDesignTokens,
        colors: {
            primary: primaryColors,
            secondary: secondaryColors,
            accent: accentColors,
            semantic: semanticColors,
            surface: lightSurfaceColors,
        },
    },
    cssVariables: {
        ...generateColorVariables('primary', primaryColors),
        ...generateColorVariables('secondary', secondaryColors),
        ...generateColorVariables('accent', accentColors),
        ...generateColorVariables('success', semanticColors.success),
        ...generateColorVariables('warning', semanticColors.warning),
        ...generateColorVariables('error', semanticColors.error),
        ...generateColorVariables('info', semanticColors.info),
        ...generateSurfaceVariables(lightSurfaceColors),
        ...generateTypographyVariables(),
        ...generateSpacingVariables(),
        ...generateShadowVariables('light'),
        ...generateAnimationVariables(),
    },
};

// Dark Theme Definition
export const darkTheme: ThemeDefinition = {
    id: 'dark',
    name: 'Dark',
    variant: 'dark',
    tokens: {
        ...baseDesignTokens,
        shadows: darkShadows,
        colors: {
            primary: primaryColors,
            secondary: secondaryColors,
            accent: accentColors,
            semantic: semanticColors,
            surface: darkSurfaceColors,
        },
    },
    cssVariables: {
        ...generateColorVariables('primary', primaryColors),
        ...generateColorVariables('secondary', secondaryColors),
        ...generateColorVariables('accent', accentColors),
        ...generateColorVariables('success', semanticColors.success),
        ...generateColorVariables('warning', semanticColors.warning),
        ...generateColorVariables('error', semanticColors.error),
        ...generateColorVariables('info', semanticColors.info),
        ...generateSurfaceVariables(darkSurfaceColors),
        ...generateTypographyVariables(),
        ...generateSpacingVariables(),
        ...generateShadowVariables('dark'),
        ...generateAnimationVariables(),
    },
};

// High Contrast Theme Definition
export const highContrastTheme: ThemeDefinition = {
    id: 'high-contrast',
    name: 'High Contrast',
    variant: 'high-contrast',
    tokens: {
        ...baseDesignTokens,
        shadows: highContrastShadows,
        colors: {
            primary: primaryColors,
            secondary: secondaryColors,
            accent: accentColors,
            semantic: semanticColors,
            surface: highContrastSurfaceColors,
        },
    },
    cssVariables: {
        ...generateColorVariables('primary', primaryColors),
        ...generateColorVariables('secondary', secondaryColors),
        ...generateColorVariables('accent', accentColors),
        ...generateColorVariables('success', semanticColors.success),
        ...generateColorVariables('warning', semanticColors.warning),
        ...generateColorVariables('error', semanticColors.error),
        ...generateColorVariables('info', semanticColors.info),
        ...generateSurfaceVariables(highContrastSurfaceColors),
        ...generateTypographyVariables(),
        ...generateSpacingVariables(),
        ...generateShadowVariables('high-contrast'),
        ...generateAnimationVariables(),
    },
};

// Theme Configuration
export const themeConfig: ThemeConfig = {
    themes: {
        light: lightTheme,
        dark: darkTheme,
        'high-contrast': highContrastTheme,
    },
    defaultTheme: 'light',
    systemThemeDetection: true,
    transitionDuration: '300ms',
};

// Utility function to get theme by variant
export function getTheme(variant: ThemeVariant): ThemeDefinition {
    return themeConfig.themes[variant];
}

// Utility function to generate CSS custom properties for a theme
export function generateThemeCSS(theme: ThemeDefinition): string {
    const variables = Object.entries(theme.cssVariables)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n');

    return `
:root {
${variables}
}

${keyframesCSS}

${reducedMotionMediaQuery}
  `.trim();
}

// Utility function to generate CSS for all themes
export function generateAllThemesCSS(): string {
    const lightCSS = generateThemeCSS(lightTheme);

    const darkVariables = Object.entries(darkTheme.cssVariables)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n');

    const highContrastVariables = Object.entries(highContrastTheme.cssVariables)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n');

    return `
${lightCSS}

.dark {
${darkVariables}
}

.high-contrast {
${highContrastVariables}
}
  `.trim();
}

// Export commonly used tokens for convenience
export const tokens = {
    colors: {
        primary: primaryColors,
        secondary: secondaryColors,
        accent: accentColors,
        semantic: semanticColors,
    },
    typography: {
        fontFamilies,
        fontSizes,
        lineHeights,
        fontWeights,
    },
    spacing,
    borderRadius,
    shadows,
    animations,
    breakpoints,
};

// Export theme utilities
export const themeUtils = {
    getTheme,
    generateThemeCSS,
    generateAllThemesCSS,
    themeConfig,
};