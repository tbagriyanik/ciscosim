import { CableType } from '@/lib/network/types';
import { CanvasNote } from './networkTopology.types';

export const DEVICE_ICON_PATHS = {
  pc: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z',
  iot: {
    center: { cx: 12, cy: 12, r: 2 },
    ring1: { cx: 12, cy: 12, r: 5 },
    ring2: { cx: 12, cy: 12, r: 8 },
  },
  switch: 'M5 12h14M5 12a2 2 0 0 1 -2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2M5 12a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 -2-2m-2-4h.01M17 16h.01',
  router: {
    circle: { cx: 12, cy: 12, r: 9 },
    paths: 'M12 5v14M5 12h14M12 5l-2 2m2-2l2 2m-2 12l-2-2m2 2l2-2M5 12l2-2m-2 2l2 2M19 12l-2-2m2 2l-2 2'
  }
};

export const DEVICE_ICON_COLORS = {
  pc: '#3b82f6',
  iot: '#16cbf9',
  switch: '#22c55e',
  router: '#a855f7',
} as const;

export const DEVICE_ICONS = {
  pc: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke={DEVICE_ICON_COLORS.pc} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={DEVICE_ICON_PATHS.pc} />
    </svg>
  ),
  iot: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke={DEVICE_ICON_COLORS.iot} viewBox="0 0 24 24">
      <path d="M16.247 7.761a6 6 0 0 1 0 8.478" />
      <path d="M19.075 4.933a10 10 0 0 1 0 14.134" />
      <path d="M4.925 19.067a10 10 0 0 1 0-14.134" />
      <path d="M7.753 16.239a6 6 0 0 1 0-8.478" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  switch: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke={DEVICE_ICON_COLORS.switch} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={DEVICE_ICON_PATHS.switch} />
    </svg>
  ),
  switchL2: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke={DEVICE_ICON_COLORS.switch} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={DEVICE_ICON_PATHS.switch} />
    </svg>
  ),
  switchL3: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke={DEVICE_ICON_COLORS.switch} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={DEVICE_ICON_PATHS.switch} />
    </svg>
  ),
  router: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke={DEVICE_ICON_COLORS.router} viewBox="0 0 24 24">
      <circle cx={DEVICE_ICON_PATHS.router.circle.cx} cy={DEVICE_ICON_PATHS.router.circle.cy} r={DEVICE_ICON_PATHS.router.circle.r} strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={DEVICE_ICON_PATHS.router.paths} />
    </svg>
  ),
};

export const CABLE_COLORS: Record<CableType | 'error', { primary: string; bg: string; text: string; border: string }> = {
  straight: { primary: '#3b82f6', bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30' },
  crossover: { primary: '#f97316', bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30' },
  console: { primary: '#06b6d4', bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  wireless: { primary: '#a855f7', bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/30' },
  error: { primary: '#ec4899', bg: 'bg-pink-500', text: 'text-pink-400', border: 'border-pink-500/30' },
};

export const DRAG_THRESHOLD = 5;
export const LONG_PRESS_DURATION = 500; // ms

export const VIRTUAL_CANVAS_WIDTH_MOBILE = 3000;
export const VIRTUAL_CANVAS_HEIGHT_MOBILE = 2000;
export const VIRTUAL_CANVAS_WIDTH_DESKTOP = 3000;
export const VIRTUAL_CANVAS_HEIGHT_DESKTOP = 2000;

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 4.0;
export const DEFAULT_ZOOM = 1.0;
export const NOTE_DEFAULT_WIDTH = 180;
export const NOTE_DEFAULT_HEIGHT = 120;
export const NOTE_HEADER_HEIGHT = 22;
export const NOTE_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#f97316', // Orange
  '#84cc16', // Lime
  '#64748b', // Slate
  '#a78bfa', // Purple
  '#60a5fa', // Light Blue
  '#4ade80'  // Light Green
];
export const NOTE_FONTS_DESKTOP = [
  'Roboto',
  'Impact',
  'Verdana',
  'Trebuchet MS',
  'Courier New'
];
export const NOTE_FONTS_MOBILE = [
  'Roboto',
  'Verdana',
  'Trebuchet MS',
  'Courier New',
  'Arial'
];
export const NOTE_FONT_SIZES: Array<CanvasNote['fontSize']> = [10, 12, 16, 20];
export const NOTE_OPACITY: Array<CanvasNote['opacity']> = [0.25, 0.5, 0.75, 1];

// Port spacing constants
export const PC_PORT_SPACING = 18;
export const PORT_SPACING = 14;
export const PORT_ROW_SPACING = 14;
export const PORT_START_X = 14;
export const PORT_START_Y = 80;

// Port colors
export const PORT_COLORS = {
  ethernet: {
    connected: '#3b82f6',
    disconnected: '#1d4ed8',
    shutdown: '#ef4444',
    blocked: '#f59e0b',  // Amber for STP blocked
  },
  console: {
    connected: '#06b6d4',
    disconnected: '#0891b2',
    shutdown: '#ef4444',
    blocked: '#f59e0b',
  },
  gigabit: {
    connected: '#f97316',
    disconnected: '#ea580c',
    shutdown: '#ef4444',
    blocked: '#f59e0b',  // Amber for STP blocked
  },
} as const;

// Device status colors
export const STATUS_COLORS = {
  online: '#22c55e',
  offline: '#ef4444',
  error: '#ef4444',
} as const;

// Stroke colors for device selection
export const STROKE_COLORS = {
  cyan: '#06b6d4',
  green: '#22c55e',
  purple: '#a855f7',
  orange: '#f97316',
  blue: '#3b82f6',
  slateLight: '#cbd5e1',
  slateDark: '#0f172a',
} as const;
