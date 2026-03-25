/**
 * Animation Design Tokens
 * 
 * Comprehensive animation system with durations, easing functions,
 * and keyframes for consistent motion design across the application.
 */

import type { AnimationTokens } from './types';

// Animation Durations
export const animationDurations = {
    instant: '0ms',
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
    slower: '750ms',
};

// Easing Functions
export const easingFunctions = {
    linear: 'linear',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
};

// Keyframe Definitions
export const keyframes = {
    fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
    fadeOut: `
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `,
    slideUp: `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
    slideDown: `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
    slideLeft: `
    @keyframes slideLeft {
      from {
        opacity: 0;
        transform: translateX(10px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `,
    slideRight: `
    @keyframes slideRight {
      from {
        opacity: 0;
        transform: translateX(-10px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `,
    scaleIn: `
    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `,
    scaleOut: `
    @keyframes scaleOut {
      from {
        opacity: 1;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(0.95);
      }
    }
  `,
    spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
    pulse: `
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.8;
        transform: scale(1.05);
      }
    }
  `,
    bounce: `
    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
        animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
      }
      50% {
        transform: translateY(-25%);
        animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
      }
    }
  `,
};

// Complete animation tokens object
export const animations: AnimationTokens = {
    duration: animationDurations,
    easing: easingFunctions,
    keyframes,
};

// Predefined Animation Combinations
export const animationPresets = {
    // Entrance animations
    'fade-in': {
        animation: `fadeIn ${animationDurations.normal} ${easingFunctions.easeOut} forwards`,
        opacity: '0',
    },
    'slide-up': {
        animation: `slideUp ${animationDurations.normal} ${easingFunctions.easeOut} forwards`,
        opacity: '0',
    },
    'slide-down': {
        animation: `slideDown ${animationDurations.normal} ${easingFunctions.easeOut} forwards`,
        opacity: '0',
    },
    'slide-left': {
        animation: `slideLeft ${animationDurations.normal} ${easingFunctions.easeOut} forwards`,
        opacity: '0',
    },
    'slide-right': {
        animation: `slideRight ${animationDurations.normal} ${easingFunctions.easeOut} forwards`,
        opacity: '0',
    },
    'scale-in': {
        animation: `scaleIn ${animationDurations.fast} ${easingFunctions.easeOut} forwards`,
        opacity: '0',
    },

    // Exit animations
    'fade-out': {
        animation: `fadeOut ${animationDurations.fast} ${easingFunctions.easeIn} forwards`,
    },
    'scale-out': {
        animation: `scaleOut ${animationDurations.fast} ${easingFunctions.easeIn} forwards`,
    },

    // Continuous animations
    'spin': {
        animation: `spin ${animationDurations.slower} ${easingFunctions.linear} infinite`,
    },
    'pulse': {
        animation: `pulse ${animationDurations.slow} ${easingFunctions.easeInOut} infinite`,
    },
    'bounce': {
        animation: `bounce ${animationDurations.slower} ${easingFunctions.bounce} infinite`,
    },

    // Interaction animations
    'hover-lift': {
        transition: `transform ${animationDurations.fast} ${easingFunctions.easeOut}`,
        transform: 'translateY(-2px)',
    },
    'hover-scale': {
        transition: `transform ${animationDurations.fast} ${easingFunctions.easeOut}`,
        transform: 'scale(1.05)',
    },
    'press-scale': {
        transition: `transform ${animationDurations.fast} ${easingFunctions.easeOut}`,
        transform: 'scale(0.95)',
    },

    // Focus animations
    'focus-ring': {
        transition: `box-shadow ${animationDurations.fast} ${easingFunctions.easeOut}`,
        boxShadow: '0 0 0 2px var(--color-ring)',
    },
    'focus-glow': {
        transition: `box-shadow ${animationDurations.fast} ${easingFunctions.easeOut}`,
        boxShadow: '0 0 0 3px var(--color-ring), 0 0 20px var(--color-ring)',
    },
};

// Reduced Motion Alternatives
export const reducedMotionPresets = {
    // Instant alternatives for entrance animations
    'fade-in-instant': {
        opacity: '1',
    },
    'slide-up-instant': {
        opacity: '1',
        transform: 'translateY(0)',
    },
    'slide-down-instant': {
        opacity: '1',
        transform: 'translateY(0)',
    },
    'slide-left-instant': {
        opacity: '1',
        transform: 'translateX(0)',
    },
    'slide-right-instant': {
        opacity: '1',
        transform: 'translateX(0)',
    },
    'scale-in-instant': {
        opacity: '1',
        transform: 'scale(1)',
    },

    // Instant alternatives for interaction animations
    'hover-lift-instant': {
        transform: 'translateY(-2px)',
    },
    'hover-scale-instant': {
        transform: 'scale(1.05)',
    },
    'press-scale-instant': {
        transform: 'scale(0.95)',
    },

    // Focus alternatives (keep these as they're important for accessibility)
    'focus-ring-instant': {
        boxShadow: '0 0 0 2px var(--color-ring)',
    },
    'focus-glow-instant': {
        boxShadow: '0 0 0 3px var(--color-ring)',
    },
};

// Utility function to generate animation CSS variables
export function generateAnimationVariables(): Record<string, string> {
    const variables: Record<string, string> = {};

    // Durations
    Object.entries(animationDurations).forEach(([key, value]) => {
        variables[`--duration-${key}`] = value;
    });

    // Easing functions
    Object.entries(easingFunctions).forEach(([key, value]) => {
        variables[`--easing-${key}`] = value;
    });

    return variables;
}

// Utility function to get animation preset based on reduced motion preference
export function getAnimationPreset(
    presetName: string,
    reducedMotion: boolean = false
): Record<string, string> {
    if (reducedMotion) {
        const instantPresetName = `${presetName}-instant`;
        return reducedMotionPresets[instantPresetName as keyof typeof reducedMotionPresets] || {};
    }

    return animationPresets[presetName as keyof typeof animationPresets] || {};
}

/**
 * Resolve animation preset using both system reduced motion and user preference.
 * User preference wins when explicitly enabled, otherwise system preference is honored.
 */
export function getAccessibleAnimationPreset(
    presetName: string,
    options?: { reducedMotion?: boolean; userReducedMotion?: boolean }
): Record<string, string> {
    const shouldReduce = options?.userReducedMotion ?? options?.reducedMotion ?? false;
    return getAnimationPreset(presetName, shouldReduce);
}

// CSS string containing all keyframes
export const keyframesCSS = Object.values(keyframes).join('\n');

// Media query for reduced motion
export const reducedMotionMediaQuery = `
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;
