'use client';

import React from 'react';
import { TooltipWrapper } from '@/components/ui/TooltipWrapper';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ShortcutBadge } from '@/components/ui/ShortcutBadge';
import { AlertCircle, Map } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface CanvasToolbarProps {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  resetView: () => void;
  zoomToFit: () => void;
  handleZoomMouseDown: (e: React.MouseEvent) => void;
  handleZoomWheel: (e: React.WheelEvent) => void;
  isDraggingZoom: boolean;
  isDark: boolean;
  t: Record<string, string>;
  MIN_ZOOM: number;
  MAX_ZOOM: number;
  onToggleLogPanel: () => void;
  logCount: number;
  onToggleMinimap?: () => void;
  isMinimapOpen?: boolean;
}

export function CanvasToolbar({
  zoom,
  setZoom,
  setPan,
  canvasRef,
  resetView,
  zoomToFit,
  handleZoomMouseDown,
  handleZoomWheel,
  isDraggingZoom,
  isDark,
  t,
  MIN_ZOOM,
  MAX_ZOOM,
  onToggleLogPanel,
  logCount,
  onToggleMinimap,
  isMinimapOpen = false,
}: CanvasToolbarProps) {
  const { language } = useLanguage();
  return (
    <div
      className={`fixed bottom-[50px] right-[10px] items-center gap-1 px-2 py-1 rounded-xl border ${isDark ? 'bg-secondary-800/90 border-secondary-700/50 shadow-lg' : 'bg-white/95 border-secondary-200/60 shadow-md'
        } flex z-40`}
    >
      <TooltipWrapper
        title={
          <div className="flex items-center gap-2">
            <span>{t.zoomOut}</span>
            <ShortcutBadge shortcut="-" variant="primary" />
          </div>
        }
      >
        <button
          aria-label={t.zoomOut}
          onClick={() =>
            setZoom((z) => {
              const newZoom = Math.max(MIN_ZOOM, z - 0.25);
              if (!canvasRef.current) return newZoom;
              const rect = canvasRef.current.getBoundingClientRect();
              const cursorX = rect.width / 2;
              const cursorY = rect.height / 2;
              setPan((prevPan) => ({
                x: cursorX - (cursorX - prevPan.x) * (newZoom / z),
                y: cursorY - (cursorY - prevPan.y) * (newZoom / z),
              }));
              return newZoom;
            })
          }
          className={`w-8 h-8 flex items-center justify-center rounded text-lg font-bold ${isDark ? 'hover:bg-secondary-700 text-secondary-300' : 'hover:bg-secondary-100 text-secondary-600'
            }`}
        >
          −
        </button>
      </TooltipWrapper>

      <button
        type="button"
        onClick={resetView}
        onMouseDown={handleZoomMouseDown}
        onWheel={handleZoomWheel}
        className={`text-xs font-mono w-12 text-center cursor-pointer select-none rounded transition-colors ${isDraggingZoom
            ? 'text-primary-400'
            : isDark
              ? 'text-secondary-300 hover:bg-secondary-700'
              : 'text-secondary-600 hover:bg-secondary-100'
          }`}
        title={t.dragToZoomOrScroll}
      >
        {Math.round(zoom * 100)}%
      </button>

      <TooltipWrapper
        title={
          <div className="flex items-center gap-2">
            <span>{t.zoomIn}</span>
            <ShortcutBadge shortcut="+" variant="primary" />
          </div>
        }
      >
        <button
          aria-label={t.zoomIn}
          onClick={() =>
            setZoom((z) => {
              const newZoom = Math.min(MAX_ZOOM, z + 0.25);
              if (!canvasRef.current) return newZoom;
              const rect = canvasRef.current.getBoundingClientRect();
              const cursorX = rect.width / 2;
              const cursorY = rect.height / 2;
              setPan((prevPan) => ({
                x: cursorX - (cursorX - prevPan.x) * (newZoom / z),
                y: cursorY - (cursorY - prevPan.y) * (newZoom / z),
              }));
              return newZoom;
            })
          }
          className={`w-8 h-8 flex items-center justify-center rounded text-lg font-bold ${isDark ? 'hover:bg-secondary-700 text-secondary-300' : 'hover:bg-secondary-100 text-secondary-600'
            }`}
        >
          +
        </button>
      </TooltipWrapper>

      <div className={`w-px h-5 ${isDark ? 'bg-secondary-600' : 'bg-secondary-300'} mx-1`} />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={resetView}
            className={`px-2 py-1 text-xs rounded ui-hover-surface ${isDark ? 'text-secondary-300 hover:text-secondary-100' : 'text-secondary-600 hover:text-secondary-900'
              }`}
          >
            {t.reset}
          </button>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          <span>{t.reset}</span>
          <ShortcutBadge shortcut="Alt+R" variant="primary" />
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={language === 'tr' ? 'Tümünü Ekrana Sığdır' : 'Zoom to Fit'}
            onClick={zoomToFit}
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${isDark ? 'hover:bg-secondary-700 text-secondary-300' : 'hover:bg-secondary-100 text-secondary-600'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          <span>{language === 'tr' ? 'Tümünü Ekrana Sığdır' : 'Zoom to Fit'}</span>
          <ShortcutBadge shortcut="Alt+F" variant="primary" />
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={language === 'tr' ? 'Mini Haritayı Aç/Kapat' : 'Toggle Mini-map'}
            onClick={onToggleMinimap}
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${isMinimapOpen
                ? 'bg-primary-500 text-white'
                : isDark
                  ? 'hover:bg-secondary-700 text-secondary-300'
                  : 'hover:bg-secondary-100 text-secondary-600'
              }`}
          >
            <Map className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          <span>{language === 'tr' ? 'Mini Haritayı Aç/Kapat' : 'Toggle Mini-map'}</span>
          <ShortcutBadge shortcut="Alt+M" variant="primary" />
        </TooltipContent>
      </Tooltip>

      <div className={`w-px h-5 ${isDark ? 'bg-secondary-600' : 'bg-secondary-300'} mx-1`} />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={language === 'tr' ? 'Ağ Olay Günlüğü' : 'Network Event Log'}
            onClick={onToggleLogPanel}
            className={`relative px-2 py-1 flex items-center justify-center rounded ui-hover-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isDark ? 'text-secondary-300 hover:text-secondary-100' : 'text-secondary-600 hover:text-secondary-900'
              }`}
          >
            <AlertCircle className="w-4 h-4" />
            {logCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm min-w-[16px] flex items-center justify-center">
                {logCount > 99 ? '99+' : logCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          <span>{language === 'tr' ? 'Ağ Olay Günlüğü' : 'Network Event Log'}</span>
          <ShortcutBadge shortcut="Alt+L" variant="primary" />
        </TooltipContent>
      </Tooltip>

    </div>
  );
}
