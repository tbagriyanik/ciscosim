import React, { useEffect, useRef } from 'react';
import { RefreshCw, X, ChevronUp, ChevronDown } from 'lucide-react';
import { TooltipWrapper } from '@/components/ui/TooltipWrapper';

interface RefreshHeaderProps {
  title: string;
  isDark: boolean;
  isCollapsed: boolean;
  onRefresh: () => void;
  onClose: () => void;
  onToggleCollapse: () => void;
  setFocusedOverlay: (overlay: 'refresh' | 'packet' | 'pc-info' | 'router-info' | 'switch-info') => void;
  language: 'tr' | 'en';
}

export const RefreshHeader: React.FC<RefreshHeaderProps> = ({
  title,
  isDark,
  isCollapsed,
  onRefresh,
  onClose,
  onToggleCollapse,
  setFocusedOverlay: _setFocusedOverlay,
  language,
}) => {
  const headerRef = useRef<HTMLDivElement>(null);

  // Focus management – focus on first button when panel opens
  useEffect(() => {
    if (headerRef.current) {
      const firstBtn = headerRef.current.querySelector('button');
      (firstBtn as HTMLElement | null)?.focus();
    }
  }, []);

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 border-b rounded-t-xl select-none cursor-grab active:cursor-grabbing ${isDark ? 'bg-white/5 border-success-500/20' : 'bg-black/5 border-success-500/30'}`}
      ref={headerRef}
      data-drag-handle="true"
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, select, textarea, .no-drag')) return;
        onToggleCollapse();
      }}
    >
      <h3 className="text-sm font-bold flex items-center gap-2 pointer-events-none" aria-live="polite">
        {title}
      </h3>
      <div className="flex items-center gap-1 no-drag">
        <TooltipWrapper title={language === 'tr' ? 'Ağı Yenile' : 'Refresh Network'}>
          <button
            type="button"
            aria-label={language === 'tr' ? 'Ağı Yenile' : 'Refresh Network'}
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            className="w-6 h-6 rounded-md bg-primary-500 hover:bg-primary-600 active:bg-primary-700 cursor-pointer transition-colors inline-flex items-center justify-center shrink-0 touch-manipulation"
          >
            <RefreshCw className="w-3.5 h-3.5 text-white pointer-events-none" />
          </button>
        </TooltipWrapper>
        <TooltipWrapper title={language === 'tr' ? 'Kapat' : 'Close'}>
          <button
            type="button"
            aria-label={language === 'tr' ? 'Kapat' : 'Close'}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-6 h-6 rounded-md bg-error-500 hover:bg-error-600 active:bg-error-700 cursor-pointer transition-colors inline-flex items-center justify-center shrink-0 touch-manipulation"
          >
            <X className="w-3.5 h-3.5 text-white pointer-events-none" />
          </button>
        </TooltipWrapper>
        <TooltipWrapper title={isCollapsed ? (language === 'tr' ? 'Genişlet' : 'Expand') : (language === 'tr' ? 'Daralt' : 'Collapse')}>
          <button
            type="button"
            aria-label={isCollapsed ? (language === 'tr' ? 'Genişlet' : 'Expand') : (language === 'tr' ? 'Daralt' : 'Collapse')}
            className="w-6 h-6 rounded-md hover:bg-secondary-100/50 dark:hover:bg-secondary-800/50 active:bg-secondary-200/50 transition-colors inline-flex items-center justify-center shrink-0 touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4 text-secondary-500 dark:text-secondary-400 pointer-events-none" /> : <ChevronUp className="w-4 h-4 text-secondary-500 dark:text-secondary-400 pointer-events-none" />}
          </button>
        </TooltipWrapper>
      </div>
    </div>
  );
};
