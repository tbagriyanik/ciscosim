'use client';

import { useState } from 'react';
import { AlertTriangle, Info, AlertCircle, Trash2, Filter } from 'lucide-react';
import { useNetworkEventLogs, useAppStore } from '@/lib/store/appStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { DraggableWindowWrapper } from '../DraggableWindowWrapper';
import { useDrag } from '@/hooks/useDrag';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface NetworkEventLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

export function NetworkEventLogPanel({ isOpen, onClose, isDark }: NetworkEventLogPanelProps) {
  const logs = useNetworkEventLogs();
  const clearLogs = useAppStore(state => state.clearNetworkEventLogs);
  const { language } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const dragProps = useDrag({
    storageKey: 'networkEventLog',
    defaultPosition: typeof window !== 'undefined'
      ? { x: Math.max(16, window.innerWidth - 460), y: 80 }
      : { x: 0, y: 0 },
    defaultSize: { width: 420, height: 480 },
    minSize: { width: 320, height: 220 },
    mode: 'drag-resize'
  });

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.level !== filter) return false;
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
    return true;
  });

  const availableCategories = Array.from(new Set(logs.map(l => l.category).filter(Boolean))).sort();

  const getIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
      default: return <Info className="w-5 h-5 text-blue-500 shrink-0" />;
    }
  };

  const getBgColor = (level: string) => {
    if (isDark) {
      switch (level) {
        case 'error': return 'bg-red-500/10 border-red-500/30';
        case 'warning': return 'bg-amber-500/10 border-amber-500/30';
        default: return 'bg-blue-500/10 border-blue-500/30';
      }
    }
    switch (level) {
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-amber-50 border-amber-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <DraggableWindowWrapper
      id="networkEventLog"
      title={
        <div className="flex items-center gap-2">
          <AlertCircle className={cn("w-4 h-4", isDark ? "text-slate-400" : "text-slate-500")} />
          <span>{language === 'tr' ? 'Ağ Olay Günlüğü' : 'Network Event Log'}</span>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full font-normal",
            isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"
          )}>
            {logs.length}
          </span>
        </div>
      }
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      modalPosition={dragProps.position}
      modalSize={dragProps.size}
      handlePointerDown={dragProps.handlePointerDown}
      handleResizeStart={dragProps.handleResizeStart}
      collapsible={true}
      className={cn(
        "shadow-2xl border",
        isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
      )}
    >
      <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
        {/* Filter Bar */}
        <div className={cn(
          "p-2.5 flex items-center justify-between border-b gap-2 shrink-0",
          isDark ? "border-slate-800 bg-slate-800/50" : "border-slate-100 bg-slate-50"
        )}>
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Filter className={cn("w-4 h-4 mr-1 shrink-0", isDark ? "text-slate-400" : "text-slate-500")} />
            <Select value={filter} onValueChange={(val) => setFilter(val as 'all' | 'error' | 'warning' | 'info')}>
              <SelectTrigger className={cn(
                "h-8 text-xs font-medium border px-2.5 py-1 flex-1 min-w-0 cursor-pointer shadow-sm tracking-wide",
                isDark
                  ? "bg-slate-900 border-slate-700 text-slate-100 hover:border-slate-600 focus:ring-1 focus:ring-primary/60"
                  : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 focus:ring-1 focus:ring-primary/60"
              )}>
                <SelectValue placeholder={language === 'tr' ? 'Filtrele...' : 'Filter...'} />
              </SelectTrigger>
              <SelectContent className={cn(
                "z-[10002] text-xs font-medium border shadow-xl rounded-lg overflow-hidden",
                isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
              )}>
                <SelectItem value="all" className="cursor-pointer text-xs py-1.5">{language === 'tr' ? 'Tümü' : 'All'}</SelectItem>
                <SelectItem value="info" className="cursor-pointer text-xs py-1.5">{language === 'tr' ? 'Sadece Bilgilendirme' : 'Info Only'}</SelectItem>
                <SelectItem value="warning" className="cursor-pointer text-xs py-1.5">{language === 'tr' ? 'Sadece Uyarılar' : 'Warnings Only'}</SelectItem>
                <SelectItem value="error" className="cursor-pointer text-xs py-1.5">{language === 'tr' ? 'Sadece Hatalar' : 'Errors Only'}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val as string)}>
              <SelectTrigger className={cn(
                "h-8 text-xs font-medium border px-2.5 py-1 w-[118px] shrink-0 cursor-pointer shadow-sm tracking-wide",
                isDark
                  ? "bg-slate-900 border-slate-700 text-slate-100 hover:border-slate-600 focus:ring-1 focus:ring-primary/60"
                  : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 focus:ring-1 focus:ring-primary/60"
              )}>
                <SelectValue placeholder={language === 'tr' ? 'Kategori...' : 'Category...'} />
              </SelectTrigger>
              <SelectContent className={cn(
                "z-[10002] text-xs font-medium border shadow-xl rounded-lg overflow-hidden",
                isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
              )}>
                <SelectItem value="all" className="cursor-pointer text-xs py-1.5">{language === 'tr' ? 'Tümü' : 'All'}</SelectItem>
                {availableCategories.map(cat => (
                  <SelectItem key={cat} value={cat} className="cursor-pointer text-xs py-1.5">{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={clearLogs}
            disabled={logs.length === 0}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {language === 'tr' ? 'Temizle' : 'Clear'}
          </Button>
        </div>

        {/* Log List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-50 p-4">
              <AlertCircle className="w-10 h-10" />
              <p className="text-xs">
                {logs.length === 0
                  ? (language === 'tr' ? 'Günlükte kayıt yok.' : 'No logs recorded.')
                  : (language === 'tr' ? 'Bu filtreye uygun kayıt yok.' : 'No logs match this filter.')}
              </p>
            </div>
          ) : (
            filteredLogs.map(log => (
              <div
                key={log.id}
                className={cn(
                  "p-2.5 rounded-lg border flex gap-2.5 items-start transition-all",
                  getBgColor(log.level)
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {getIcon(log.level)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider",
                      log.level === 'error' ? (isDark ? "bg-red-500/25 text-red-300 border border-red-500/30" : "bg-red-100 text-red-800 border border-red-200") :
                      log.level === 'warning' ? (isDark ? "bg-amber-500/25 text-amber-300 border border-amber-500/30" : "bg-amber-100 text-amber-900 border border-amber-200") :
                      (isDark ? "bg-blue-500/25 text-blue-300 border border-blue-500/30" : "bg-blue-100 text-blue-800 border border-blue-200")
                    )}>
                      {log.category}
                    </span>
                    <span className={cn(
                      "text-[10px] whitespace-nowrap font-mono opacity-80",
                      isDark ? "text-slate-400" : "text-slate-500"
                    )}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className={cn(
                    "text-xs font-medium leading-snug",
                    isDark ? "text-slate-200" : "text-slate-800"
                  )}>
                    {log.message}
                  </p>
                  {log.detail && (
                    <p className={cn(
                      "text-[11px] mt-1 break-words leading-relaxed font-mono opacity-90",
                      isDark ? "text-slate-300" : "text-slate-600"
                    )}>
                      {log.detail}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DraggableWindowWrapper>
  );
}
