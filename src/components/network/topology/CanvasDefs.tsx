import React from 'react';
import { colors } from '@/lib/design-tokens/colors';

interface CanvasDefsProps {
  isDark: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export const CanvasDefs: React.FC<CanvasDefsProps> = ({
  isDark,
  canvasWidth,
  canvasHeight
}) => {
  return (
    <defs>
      <clipPath id="canvasClip">
        <rect x="0" y="0" width={canvasWidth} height={canvasHeight} />
      </clipPath>
      {/* Device Shadow Filter */}
      <filter id="deviceShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity={isDark ? "0.15" : "0.1"} />
      </filter>
      {/* WiFi Icon Shadow Filter */}
      <filter id="wifiIconShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0.5" dy="1" stdDeviation="1" floodOpacity={isDark ? "0.4" : "0.25"} />
      </filter>
      {/* Canvas background gradient */}
      <radialGradient id="canvasBgGradient" cx="44%" cy="28%" r="90%">
        <stop offset="0%" stopColor="var(--canvas-bg-0)" />
        <stop offset="26%" stopColor="var(--canvas-bg-1)" />
        <stop offset="52%" stopColor="var(--canvas-bg-2)" />
        <stop offset="76%" stopColor="var(--canvas-bg-3)" />
        <stop offset="100%" stopColor="var(--canvas-bg-4)" />
      </radialGradient>
      {/* Subtle top-right ambient accent glow */}
      <radialGradient id="canvasAmbientGlow" cx="82%" cy="18%" r="65%">
        {isDark ? (
          <>
            <stop offset="0%" stopColor={colors.indigo['500']} stopOpacity="0.16" />
            <stop offset="45%" stopColor={colors.sky['500']} stopOpacity="0.08" />
            <stop offset="85%" stopColor={colors.status.info} stopOpacity="0.02" />
            <stop offset="100%" stopColor={colors.common.black} stopOpacity="0" />
          </>
        ) : (
          <>
            <stop offset="0%" stopColor={colors.indigo['400']} stopOpacity="0.14" />
            <stop offset="45%" stopColor={colors.cables.selected} stopOpacity="0.07" />
            <stop offset="85%" stopColor={colors.cables.hover} stopOpacity="0.02" />
            <stop offset="100%" stopColor={colors.common.white} stopOpacity="0" />
          </>
        )}
      </radialGradient>
      {/* Subtle bottom-left warmth ambient glow */}
      <radialGradient id="canvasAmbientGlowSecondary" cx="15%" cy="85%" r="60%">
        {isDark ? (
          <>
            <stop offset="0%" stopColor={colors.purple['500']} stopOpacity="0.10" />
            <stop offset="50%" stopColor={colors.indigo['500']} stopOpacity="0.04" />
            <stop offset="100%" stopColor={colors.common.black} stopOpacity="0" />
          </>
        ) : (
          <>
            <stop offset="0%" stopColor={colors.purple['400']} stopOpacity="0.08" />
            <stop offset="50%" stopColor={colors.indigo['400']} stopOpacity="0.03" />
            <stop offset="100%" stopColor={colors.common.white} stopOpacity="0" />
          </>
        )}
      </radialGradient>
      {/* Grid pattern with improved visibility */}
      <pattern id="gridPattern" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="8" cy="8" r="1" style={{ fill: isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-500)', shapeRendering: 'geometricPrecision' }} opacity="0.6" />
      </pattern>
      {/* Major grid lines pattern */}
      <pattern id="majorGridPattern" width="80" height="80" patternUnits="userSpaceOnUse">
        <rect width="80" height="80" fill="none" style={{ stroke: isDark ? 'var(--color-secondary-700)' : 'var(--color-secondary-300)', shapeRendering: 'crispEdges' }} strokeWidth="0.5" opacity="0.3" />
      </pattern>
      {/* Device 3D Gradients for Dark Mode */}
      <linearGradient id="pcGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-primary-600)" />
        <stop offset="30%" stopColor="var(--color-primary-800)" />
        <stop offset="100%" stopColor="var(--color-primary-900)" />
      </linearGradient>
      <linearGradient id="switchGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-accent-400)" />
        <stop offset="30%" stopColor="var(--color-accent-600)" />
        <stop offset="100%" stopColor="var(--color-accent-800)" />
      </linearGradient>
      <linearGradient id="routerGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-purple-500)" />
        <stop offset="30%" stopColor="var(--color-purple-700)" />
        <stop offset="100%" stopColor="var(--color-purple-900)" />
      </linearGradient>
      <linearGradient id="hubGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#14b8a6" />
        <stop offset="30%" stopColor="#0f766e" />
        <stop offset="100%" stopColor="#134e4a" />
      </linearGradient>
      <linearGradient id="cloudGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-sky-400)" />
        <stop offset="30%" stopColor="var(--color-sky-600)" />
        <stop offset="100%" stopColor="var(--color-sky-800)" />
      </linearGradient>
      <linearGradient id="firewallGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-error-500)" />
        <stop offset="30%" stopColor="var(--color-error-600)" />
        <stop offset="100%" stopColor="var(--color-error-800)" />
      </linearGradient>
      <linearGradient id="iotGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-warning-400)" />
        <stop offset="30%" stopColor="var(--color-warning-600)" />
        <stop offset="100%" stopColor="var(--color-warning-700)" />
      </linearGradient>
      <linearGradient id="mobileGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-sky-500)" />
        <stop offset="30%" stopColor="var(--color-sky-700)" />
        <stop offset="100%" stopColor="var(--color-sky-900)" />
      </linearGradient>
      <linearGradient id="printerGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ec4899" />
        <stop offset="30%" stopColor="#be185d" />
        <stop offset="100%" stopColor="#831843" />
      </linearGradient>
      {/* Device 3D Gradients for Light Mode */}
      <linearGradient id="pcGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-primary-50)" />
        <stop offset="100%" stopColor="var(--color-primary-100)" />
      </linearGradient>
      <linearGradient id="switchGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-accent-50)" />
        <stop offset="100%" stopColor="var(--color-accent-200)" />
      </linearGradient>
      <linearGradient id="routerGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-purple-50)" />
        <stop offset="100%" stopColor="var(--color-purple-100)" />
      </linearGradient>
      <linearGradient id="hubGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ccfbf1" />
        <stop offset="100%" stopColor="#99f6e4" />
      </linearGradient>
      <linearGradient id="cloudGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-sky-50)" />
        <stop offset="100%" stopColor="var(--color-sky-200)" />
      </linearGradient>
      <linearGradient id="firewallGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-error-100)" />
        <stop offset="100%" stopColor="var(--color-error-200)" />
      </linearGradient>
      <linearGradient id="iotGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-warning-50)" />
        <stop offset="100%" stopColor="var(--color-warning-200)" />
      </linearGradient>
      <linearGradient id="mobileGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-sky-50)" />
        <stop offset="100%" stopColor="var(--color-sky-100)" />
      </linearGradient>
      <linearGradient id="printerGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fce7f3" />
        <stop offset="100%" stopColor="#fbcfe8" />
      </linearGradient>
      <linearGradient id="wlcGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-indigo-500)" />
        <stop offset="30%" stopColor="var(--color-indigo-700)" />
        <stop offset="100%" stopColor="var(--color-indigo-900)" />
      </linearGradient>
      <linearGradient id="wlcGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#e0e7ff" />
        <stop offset="100%" stopColor="#c7d2fe" />
      </linearGradient>
      {/* Note Gradients for Dark Mode */}
      <linearGradient id="noteBlueDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-primary-500)" />
        <stop offset="100%" stopColor="var(--color-primary-700)" />
      </linearGradient>
      <linearGradient id="noteEmeraldDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-success-500)" />
        <stop offset="100%" stopColor="var(--color-success-700)" />
      </linearGradient>
      <linearGradient id="noteVioletDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-purple-500)" />
        <stop offset="100%" stopColor="var(--color-purple-700)" />
      </linearGradient>
      <linearGradient id="noteAmberDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-warning-500)" />
        <stop offset="100%" stopColor="var(--color-warning-700)" />
      </linearGradient>
      <linearGradient id="noteRedDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-error-500)" />
        <stop offset="100%" stopColor="var(--color-error-700)" />
      </linearGradient>
      <linearGradient id="noteCyanDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-accent-500)" />
        <stop offset="100%" stopColor="var(--color-accent-700)" />
      </linearGradient>
      <linearGradient id="notePinkDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-pink-500)" />
        <stop offset="100%" stopColor="var(--color-pink-700)" />
      </linearGradient>
      <linearGradient id="noteOrangeDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-warning-400)" />
        <stop offset="100%" stopColor="var(--color-warning-700)" />
      </linearGradient>
      <linearGradient id="noteLimeDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-success-500)" />
        <stop offset="100%" stopColor="var(--color-success-700)" />
      </linearGradient>
      <linearGradient id="noteSlateDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-secondary-500)" />
        <stop offset="100%" stopColor="var(--color-secondary-700)" />
      </linearGradient>
      <linearGradient id="notePurpleDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-purple-400)" />
        <stop offset="100%" stopColor="var(--color-purple-600)" />
      </linearGradient>
      <linearGradient id="noteLightBlueDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-primary-400)" />
        <stop offset="100%" stopColor="var(--color-primary-600)" />
      </linearGradient>
      <linearGradient id="noteLightGreenDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-success-400)" />
        <stop offset="100%" stopColor="var(--color-success-600)" />
      </linearGradient>
      {/* Note Gradients for Light Mode */}
      <linearGradient id="noteBlueLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-primary-100)" />
        <stop offset="100%" stopColor="var(--color-primary-200)" />
      </linearGradient>
      <linearGradient id="noteEmeraldLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-success-100)" />
        <stop offset="100%" stopColor="var(--color-success-200)" />
      </linearGradient>
      <linearGradient id="noteVioletLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-purple-100)" />
        <stop offset="100%" stopColor="var(--color-purple-200)" />
      </linearGradient>
      <linearGradient id="noteAmberLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-warning-100)" />
        <stop offset="100%" stopColor="var(--color-warning-200)" />
      </linearGradient>
      <linearGradient id="noteRedLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-error-100)" />
        <stop offset="100%" stopColor="var(--color-error-200)" />
      </linearGradient>
      <linearGradient id="noteCyanLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-accent-100)" />
        <stop offset="100%" stopColor="var(--color-accent-200)" />
      </linearGradient>
      <linearGradient id="notePinkLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-pink-100)" />
        <stop offset="100%" stopColor="var(--color-pink-200)" />
      </linearGradient>
      <linearGradient id="noteOrangeLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-warning-50)" />
        <stop offset="100%" stopColor="var(--color-warning-200)" />
      </linearGradient>
      <linearGradient id="noteLimeLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-success-50)" />
        <stop offset="100%" stopColor="var(--color-success-200)" />
      </linearGradient>
      <linearGradient id="noteSlateLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-secondary-100)" />
        <stop offset="100%" stopColor="var(--color-secondary-200)" />
      </linearGradient>
      <linearGradient id="notePurpleLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-purple-100)" />
        <stop offset="100%" stopColor="var(--color-purple-200)" />
      </linearGradient>
      <linearGradient id="noteLightBlueLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-primary-100)" />
        <stop offset="100%" stopColor="var(--color-primary-200)" />
      </linearGradient>
      <linearGradient id="noteLightGreenLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="var(--color-success-100)" />
        <stop offset="100%" stopColor="var(--color-success-200)" />
      </linearGradient>
    </defs>
  );
};
