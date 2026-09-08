import React from 'react';
import { X, Trash2 } from "lucide-react";
import { TooltipWrapper } from "@/components/ui/TooltipWrapper";
import { logger } from '@/lib/logger';
import { triggerHapticFeedback } from '@/lib/utils';
import { CanvasDevice, DeviceType } from '../networkTopology.types';

export interface TopologySelectionToolbarProps {
  isDark: boolean;
  t: Record<string, string>;
  selectedDeviceIds: string[];
  deviceMap: Map<string, CanvasDevice>;
  handleAlign: (alignment: 'left' | 'right' | 'top' | 'bottom' | 'h-center' | 'v-center') => void;
  setSelectedDeviceIds: (ids: string[]) => void;
  onDeviceSelect: (type: DeviceType, id: string | undefined, model: string | undefined, name: string | undefined) => void;
  saveToHistory: () => void;
  deleteDevice: (id: string) => void;
}

export const TopologySelectionToolbar: React.FC<TopologySelectionToolbarProps> = ({
  isDark,
  t,
  selectedDeviceIds,
  deviceMap,
  handleAlign,
  setSelectedDeviceIds,
  onDeviceSelect,
  saveToHistory,
  deleteDevice
}) => {
  if (selectedDeviceIds.length <= 1) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'auto'
      }}
      className={`px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-2 selection-toolbar panel-ambient-glow ${isDark ? 'bg-secondary-800/95 text-white border border-secondary-700' : 'bg-white text-secondary-900 border border-secondary-200'
        } backdrop-blur-md`}
      onClick={(e) => {
        e.stopPropagation();
        logger.debug('[Toolbar] Container clicked');
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onMouseUp={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Sola Hizala (Align Left) */}
      <TooltipWrapper title={t.alignLeft || 'Sola Hizala'}>
        <button
          aria-label={t.alignLeft || 'Sola Hizala'}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            logger.debug('[Toolbar] Align left clicked');
            saveToHistory();
            handleAlign('left');
          }}
          className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isDark ? 'hover:bg-secondary-700 text-secondary-300' : 'hover:bg-secondary-100 text-secondary-600'}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="2" x2="4" y2="22" />
            <rect x="8" y="4" width="12" height="6" rx="1" />
            <rect x="8" y="14" width="8" height="6" rx="1" />
          </svg>
        </button>
      </TooltipWrapper>

      {/* Yatayda Ortala (Align Horizontal Center) */}
      <TooltipWrapper title={t.alignHCenter || 'Yatayda Ortala'}>
        <button
          aria-label={t.alignHCenter || 'Yatayda Ortala'}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            logger.debug('[Toolbar] Align horizontal center clicked');
            saveToHistory();
            handleAlign('h-center');
          }}
          className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isDark ? 'hover:bg-secondary-700 text-secondary-300' : 'hover:bg-secondary-100 text-secondary-600'}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 2" />
            <rect x="5" y="4" width="14" height="6" rx="1" />
            <rect x="7" y="14" width="10" height="6" rx="1" />
          </svg>
        </button>
      </TooltipWrapper>

      {/* Sağa Hizala (Align Right) */}
      <TooltipWrapper title={t.alignRight || 'Sağa Hizala'}>
        <button
          aria-label={t.alignRight || 'Sağa Hizala'}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            logger.debug('[Toolbar] Align right clicked');
            saveToHistory();
            handleAlign('right');
          }}
          className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isDark ? 'hover:bg-secondary-700 text-secondary-300' : 'hover:bg-secondary-100 text-secondary-600'}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="20" y1="2" x2="20" y2="22" />
            <rect x="4" y="4" width="12" height="6" rx="1" />
            <rect x="8" y="14" width="8" height="6" rx="1" />
          </svg>
        </button>
      </TooltipWrapper>

      {/* Üste Hizala (Align Top) */}
      <TooltipWrapper title={t.alignTop || 'Üste Hizala'}>
        <button
          aria-label={t.alignTop || 'Üste Hizala'}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            logger.debug('[Toolbar] Align top clicked');
            saveToHistory();
            handleAlign('top');
          }}
          className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isDark ? 'hover:bg-secondary-700 text-secondary-300' : 'hover:bg-secondary-100 text-secondary-600'}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="2" y1="4" x2="22" y2="4" />
            <rect x="4" y="8" width="6" height="12" rx="1" />
            <rect x="14" y="8" width="6" height="8" rx="1" />
          </svg>
        </button>
      </TooltipWrapper>

      {/* Dikeyde Ortala (Align Vertical Center) */}
      <TooltipWrapper title={t.alignVCenter || 'Dikeyde Ortala'}>
        <button
          aria-label={t.alignVCenter || 'Dikeyde Ortala'}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            logger.debug('[Toolbar] Align vertical center clicked');
            saveToHistory();
            handleAlign('v-center');
          }}
          className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isDark ? 'hover:bg-secondary-700 text-secondary-300' : 'hover:bg-secondary-100 text-secondary-600'}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="2" y1="12" x2="22" y2="12" strokeDasharray="2 2" />
            <rect x="4" y="5" width="6" height="14" rx="1" />
            <rect x="14" y="7" width="6" height="10" rx="1" />
          </svg>
        </button>
      </TooltipWrapper>
      <div className="w-px h-4 bg-secondary-700/30 mx-1" />
      <span className="text-xs font-semibold whitespace-nowrap bg-secondary-700/30 px-2 py-0.5 rounded">
        {selectedDeviceIds.length}
      </span>
      <TooltipWrapper title={t.cancel}>
        <button
          aria-label={t.cancel || 'Clear Selection'}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            logger.debug('[Toolbar] Cancel clicked');
            const firstId = selectedDeviceIds[0];
            const firstDevice = deviceMap.get(firstId);
            setSelectedDeviceIds(firstId ? [firstId] : []);
            if (firstDevice) onDeviceSelect(firstDevice.type === 'router' ? 'router' : firstDevice.type, firstId, undefined, firstDevice.name);
          }}
          className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isDark ? 'hover:bg-secondary-700 text-secondary-200' : 'hover:bg-secondary-100 text-secondary-600'}`}
        >
          <X className="w-4 h-4" />
        </button>
      </TooltipWrapper>
      <TooltipWrapper title={t.delete}>
        <button
          aria-label={t.delete || 'Delete Selected'}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            logger.debug('[Toolbar] Delete clicked');
            triggerHapticFeedback('medium');
            saveToHistory();
            selectedDeviceIds.forEach(id => deleteDevice(id));
            setSelectedDeviceIds([]);
          }}
          className="p-2 rounded-lg hover:bg-error-500/20 text-error-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </TooltipWrapper>
    </div>
  );
};
