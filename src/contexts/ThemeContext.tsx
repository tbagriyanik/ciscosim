'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';

type Theme = 'dark' | 'light' | 'high-contrast' | 'auto';

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: 'dark' | 'light' | 'high-contrast';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isTransitioning: boolean;
  systemThemePreference: 'dark' | 'light' | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'network-sim-theme';
const TRANSITION_DURATION = 300; // ms

/**
 * Detects the system theme preference using prefers-color-scheme media query
 */
function detectSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';

  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  } catch {
    return 'light';
  }
}

/**
 * Detects if the user prefers reduced motion
 */
function detectReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Applies theme to the DOM with smooth transition
 * Respects reduced motion preferences for accessibility
 */
function applyTheme(
  theme: 'dark' | 'light' | 'high-contrast',
  onTransitionStart?: () => void,
  onTransitionEnd?: () => void
) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const prefersReducedMotion = detectReducedMotion();
  const duration = prefersReducedMotion ? 0 : TRANSITION_DURATION;

  // Start transition
  onTransitionStart?.();

  // Add transition class for smooth animation (unless reduced motion is preferred)
  if (!prefersReducedMotion) {
    root.style.transition = `background-color ${duration}ms ease-in-out, color ${duration}ms ease-in-out`;
  }

  // Remove all theme classes
  root.classList.remove('dark', 'light', 'high-contrast');

  // Add new theme class
  if (theme !== 'light') {
    root.classList.add(theme);
  }

  // Trigger reflow to ensure transition is applied
  void root.offsetHeight;

  // Remove transition class after animation completes
  setTimeout(() => {
    root.style.transition = '';
    onTransitionEnd?.();
  }, duration);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('auto');
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light' | 'high-contrast'>('dark');
  const [systemThemePreference, setSystemThemePreference] = useState<'dark' | 'light' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const mediaQueryListRef = useRef<MediaQueryList | null>(null);

  // Initialize theme from storage and system preferences
  useEffect(() => {
    if (initialized) return;

    try {
      // Load saved theme preference
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      
      // If no saved theme, default to dark for new visitors
      const validTheme = saved && ['dark', 'light', 'high-contrast', 'auto'].includes(saved) ? saved : 'dark';

      // Detect system theme
      const systemTheme = detectSystemTheme();
      setSystemThemePreference(systemTheme);

      // Determine effective theme (only use system theme if explicitly set to 'auto')
      const effective = validTheme === 'auto' ? systemTheme : validTheme;
      setEffectiveTheme(effective);
      setThemeState(validTheme);

      // Apply theme immediately without transition on first load
      applyTheme(effective);
    } catch {
      // Fallback to dark theme
      setEffectiveTheme('dark');
      setThemeState('dark');
      applyTheme('dark');
    }

    setInitialized(true);
  }, [initialized]);

  // Setup system theme change listener
  useEffect(() => {
    if (!initialized) return;

    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQueryListRef.current = mediaQuery;

      const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
        const newSystemTheme = e.matches ? 'dark' : 'light';
        setSystemThemePreference(newSystemTheme);

        // If auto theme is enabled, update effective theme
        if (theme === 'auto') {
          setEffectiveTheme(newSystemTheme);
          applyTheme(newSystemTheme, () => setIsTransitioning(true), () => setIsTransitioning(false));
        }
      };

      // Use addEventListener for better compatibility
      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    } catch {
      // System theme detection not supported
    }
  }, [initialized, theme]);

  // Apply theme when it changes
  useEffect(() => {
    if (!initialized) return;

    try {
      // Determine effective theme
      const effective = theme === 'auto' ? (systemThemePreference || 'light') : theme;

      // Only apply if effective theme changed
      if (effective !== effectiveTheme) {
        setEffectiveTheme(effective);
        applyTheme(effective, () => setIsTransitioning(true), () => setIsTransitioning(false));
      }

      // Persist theme preference
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // localStorage not available
    }
  }, [theme, initialized, systemThemePreference, effectiveTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      if (prev === 'auto') return 'light';
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'high-contrast';
      return 'auto';
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        effectiveTheme,
        setTheme,
        toggleTheme,
        isTransitioning,
        systemThemePreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};