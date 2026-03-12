import { CableType } from '@/lib/network/types';
import { CanvasNote } from './networkTopology.types';

export const DEVICE_ICONS = {
  pc: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z" />
    </svg>
  ),
  switch: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 0 1 -2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2M5 12a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 -2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
  router: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14M5 12h14M12 5l-2 2m2-2l2 2m-2 12l-2-2m2 2l2-2M5 12l2-2m-2 2l2 2M19 12l-2-2m2 2l-2 2" />
    </svg>
  ),
};

export const CABLE_COLORS: Record<CableType | 'error', { primary: string; bg: string; text: string; border: string }> = {
  straight: { primary: '#3b82f6', bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30' },
  crossover: { primary: '#f97316', bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30' },
  console: { primary: '#06b6d4', bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/30' },
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
  '#FAE3E7',
  '#F7EAD7',
  '#F6EDC6',
  '#E3F2D3',
  '#D7F1EA',
  '#D1E2FF',
  '#CDB8FF',
  '#E3B3F1',
  '#F2B4C3',
  '#D7D0D0'
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
