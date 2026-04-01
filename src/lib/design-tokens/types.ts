/**
 * Design Tokens Type Definitions
 * 
 * Comprehensive type system for the modernized design tokens
 * supporting multiple themes and consistent design values.
 */

export interface ColorScale {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string; // Base color
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
}

export interface SemanticColors {
    success: ColorScale;
    warning: ColorScale;
    error: ColorScale;
    info: ColorScale;
}

export interface SurfaceColors {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    input: string;
    ring: string;
}

export interface FontFamilyTokens {
    sans: string[];
    mono: string[];
    display: string[];
}

export interface FontSizeScale {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
    '5xl': string;
    '6xl': string;
    '7xl': string;
    '8xl': string;
    '9xl': string;
}

export interface LineHeightScale {
    none: string;
    tight: string;
    snug: string;
    normal: string;
    relaxed: string;
    loose: string;
}

export interface FontWeightScale {
    thin: string;
    extralight: string;
    light: string;
    normal: string;
    medium: string;
    semibold: string;
    bold: string;
    extrabold: string;
    black: string;
}

export interface SpacingScale {
    0: string;
    px: string;
    0.5: string;
    1: string;
    1.5: string;
    2: string;
    2.5: string;
    3: string;
    3.5: string;
    4: string;
    5: string;
    6: string;
    7: string;
    8: string;
    9: string;
    10: string;
    11: string;
    12: string;
    14: string;
    16: string;
    20: string;
    24: string;
    28: string;
    32: string;
    36: string;
    40: string;
    44: string;
    48: string;
    52: string;
    56: string;
    60: string;
    64: string;
    72: string;
    80: string;
    96: string;
}

export interface RadiusScale {
    none: string;
    sm: string;
    base: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    full: string;
}

export interface ShadowScale {
    sm: string;
    base: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    inner: string;
    none: string;
}

export interface AnimationTokens {
    duration: {
        instant: string;
        fast: string;
        normal: string;
        slow: string;
        slower: string;
    };
    easing: {
        linear: string;
        ease: string;
        easeIn: string;
        easeOut: string;
        easeInOut: string;
        bounce: string;
        elastic: string;
    };
    keyframes: {
        fadeIn: string;
        fadeOut: string;
        slideUp: string;
        slideDown: string;
        slideLeft: string;
        slideRight: string;
        scaleIn: string;
        scaleOut: string;
        spin: string;
        pulse: string;
        bounce: string;
    };
}

export interface DesignTokens {
    colors: {
        primary: ColorScale;
        secondary: ColorScale;
        accent: ColorScale;
        semantic: SemanticColors;
        surface: SurfaceColors;
    };
    typography: {
        fontFamilies: FontFamilyTokens;
        fontSizes: FontSizeScale;
        lineHeights: LineHeightScale;
        fontWeights: FontWeightScale;
    };
    spacing: SpacingScale;
    borderRadius: RadiusScale;
    shadows: ShadowScale;
    animations: AnimationTokens;
}

export type ThemeVariant = 'light' | 'dark' | 'high-contrast';

export interface ThemeDefinition {
    id: string;
    name: string;
    variant: ThemeVariant;
    tokens: DesignTokens;
    cssVariables: Record<string, string>;
}

export interface ThemeConfig {
    themes: Record<ThemeVariant, ThemeDefinition>;
    defaultTheme: ThemeVariant;
    systemThemeDetection: boolean;
    transitionDuration: string;
}