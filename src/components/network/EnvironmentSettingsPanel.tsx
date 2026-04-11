'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useEnvironment } from '@/lib/store/appStore';
import useAppStore, { EnvironmentBackground } from '@/lib/store/appStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Leaf, Sun, Droplets, Thermometer, Home, Building2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnvironmentSettingsPanelProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const BACKGROUND_OPTIONS: { value: EnvironmentBackground; icon: React.ReactNode; labelKey: 'backgroundNone' | 'backgroundHouse' | 'backgroundTwoStoryGarage' }[] = [
  { value: 'none', icon: <X className="w-4 h-4" />, labelKey: 'backgroundNone' },
  { value: 'house', icon: <Home className="w-4 h-4" />, labelKey: 'backgroundHouse' },
  { value: 'twoStoryGarage', icon: <Building2 className="w-4 h-4" />, labelKey: 'backgroundTwoStoryGarage' },
];

export function EnvironmentSettingsPanel({ isOpen, onOpenChange }: EnvironmentSettingsPanelProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { setEnvironment } = useAppStore();
  const environment = useEnvironment();

  const isDark = theme === 'dark';

  const handleBackgroundChange = (background: EnvironmentBackground) => {
    setEnvironment((prev) => ({ ...prev, background }));
  };

  const handleTemperatureChange = (value: number) => {
    setEnvironment((prev) => ({ ...prev, temperature: value }));
  };

  const handleHumidityChange = (value: number) => {
    setEnvironment((prev) => ({ ...prev, humidity: value }));
  };

  const handleLightChange = (value: number) => {
    setEnvironment((prev) => ({ ...prev, light: value }));
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onOpenChange?.(true)}
            className={cn(
              'h-8 px-3 flex items-center gap-1.5 transition-all',
              isDark
                ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-700/50'
                : 'text-emerald-600 hover:text-emerald-700 hover:bg-slate-200/50'
            )}
          >
            <Leaf className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">{t.environmentSettings}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t.environmentSettings}</TooltipContent>
      </Tooltip>
      <SheetContent side="right" className={cn(
        'w-[320px] p-0',
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      )}>
        <SheetHeader className={cn(
          'p-4 border-b',
          isDark ? 'border-slate-800' : 'border-slate-200'
        )}>
          <SheetTitle className={cn(
            'text-lg font-bold flex items-center gap-2',
            isDark ? 'text-slate-100' : 'text-slate-900'
          )}>
            <Leaf className="w-5 h-5 text-emerald-500" />
            {t.environmentSettings}
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-6">
          {/* Background Selection */}
          <div className="space-y-3">
            <label className={cn(
              'text-sm font-semibold flex items-center gap-2',
              isDark ? 'text-slate-300' : 'text-slate-700'
            )}>
              <Home className="w-4 h-4" />
              {t.environmentBackground}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BACKGROUND_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleBackgroundChange(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all',
                    environment?.background === option.value
                      ? isDark
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {option.icon}
                  <span className="text-xs font-medium text-center">
                    {t[option.labelKey]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-3">
            <label className={cn(
              'text-sm font-semibold flex items-center gap-2',
              isDark ? 'text-slate-300' : 'text-slate-700'
            )}>
              <Thermometer className="w-4 h-4 text-orange-500" />
              {t.temperature}
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="-20"
                max="50"
                value={environment?.temperature ?? 22}
                onChange={(e) => handleTemperatureChange(Number(e.target.value))}
                className={cn(
                  'w-full h-2 rounded-lg appearance-none cursor-pointer',
                  isDark ? 'bg-slate-700' : 'bg-slate-200'
                )}
                style={{
                  background: `linear-gradient(to right, 
                    ${isDark ? '#3b82f6' : '#60a5fa'} 0%, 
                    ${isDark ? '#3b82f6' : '#60a5fa'} ${((environment?.temperature ?? 22 + 20) / 70) * 100}%, 
                    ${isDark ? '#334155' : '#e2e8f0'} ${((environment?.temperature ?? 22 + 20) / 70) * 100}%, 
                    ${isDark ? '#334155' : '#e2e8f0'} 100%)`
                }}
              />
              <div className={cn(
                'flex justify-between text-xs',
                isDark ? 'text-slate-500' : 'text-slate-400'
              )}>
                <span>-20{t.celsius}</span>
                <span className={cn(
                  'font-bold text-base',
                  isDark ? 'text-orange-400' : 'text-orange-600'
                )}>
                  {environment?.temperature ?? 22}{t.celsius}
                </span>
                <span>50{t.celsius}</span>
              </div>
            </div>
          </div>

          {/* Humidity */}
          <div className="space-y-3">
            <label className={cn(
              'text-sm font-semibold flex items-center gap-2',
              isDark ? 'text-slate-300' : 'text-slate-700'
            )}>
              <Droplets className="w-4 h-4 text-blue-500" />
              {t.humidity}
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="100"
                value={environment?.humidity ?? 50}
                onChange={(e) => handleHumidityChange(Number(e.target.value))}
                className={cn(
                  'w-full h-2 rounded-lg appearance-none cursor-pointer',
                  isDark ? 'bg-slate-700' : 'bg-slate-200'
                )}
                style={{
                  background: `linear-gradient(to right, 
                    ${isDark ? '#3b82f6' : '#60a5fa'} 0%, 
                    ${isDark ? '#3b82f6' : '#60a5fa'} ${environment?.humidity ?? 50}%, 
                    ${isDark ? '#334155' : '#e2e8f0'} ${environment?.humidity ?? 50}%, 
                    ${isDark ? '#334155' : '#e2e8f0'} 100%)`
                }}
              />
              <div className={cn(
                'flex justify-between text-xs',
                isDark ? 'text-slate-500' : 'text-slate-400'
              )}>
                <span>0{t.percent}</span>
                <span className={cn(
                  'font-bold text-base',
                  isDark ? 'text-blue-400' : 'text-blue-600'
                )}>
                  {environment?.humidity ?? 50}{t.percent}
                </span>
                <span>100{t.percent}</span>
              </div>
            </div>
          </div>

          {/* Light */}
          <div className="space-y-3">
            <label className={cn(
              'text-sm font-semibold flex items-center gap-2',
              isDark ? 'text-slate-300' : 'text-slate-700'
            )}>
              <Sun className="w-4 h-4 text-yellow-500" />
              {t.lightLevel}
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="100"
                value={environment?.light ?? 70}
                onChange={(e) => handleLightChange(Number(e.target.value))}
                className={cn(
                  'w-full h-2 rounded-lg appearance-none cursor-pointer',
                  isDark ? 'bg-slate-700' : 'bg-slate-200'
                )}
                style={{
                  background: `linear-gradient(to right, 
                    ${isDark ? '#eab308' : '#facc15'} 0%, 
                    ${isDark ? '#eab308' : '#facc15'} ${environment?.light ?? 70}%, 
                    ${isDark ? '#334155' : '#e2e8f0'} ${environment?.light ?? 70}%, 
                    ${isDark ? '#334155' : '#e2e8f0'} 100%)`
                }}
              />
              <div className={cn(
                'flex justify-between text-xs',
                isDark ? 'text-slate-500' : 'text-slate-400'
              )}>
                <span>0{t.percent}</span>
                <span className={cn(
                  'font-bold text-base',
                  isDark ? 'text-yellow-400' : 'text-yellow-600'
                )}>
                  {environment?.light ?? 70}{t.percent}
                </span>
                <span>100{t.percent}</span>
              </div>
            </div>
          </div>

          {/* Environment Info Card */}
          <div className={cn(
            'p-4 rounded-xl border',
            isDark
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-slate-50 border-slate-200'
          )}>
            <div className={cn(
              'text-xs font-medium mb-3',
              isDark ? 'text-slate-400' : 'text-slate-600'
            )}>
              {t.environmentSettings}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={cn(
                'p-2 rounded-lg',
                isDark ? 'bg-slate-700/50' : 'bg-white'
              )}>
                <Thermometer className={cn(
                  'w-4 h-4 mx-auto mb-1',
                  isDark ? 'text-orange-400' : 'text-orange-500'
                )} />
                <span className={cn(
                  'text-xs font-bold',
                  isDark ? 'text-slate-200' : 'text-slate-700'
                )}>
                  {environment?.temperature ?? 22}{t.celsius}
                </span>
              </div>
              <div className={cn(
                'p-2 rounded-lg',
                isDark ? 'bg-slate-700/50' : 'bg-white'
              )}>
                <Droplets className={cn(
                  'w-4 h-4 mx-auto mb-1',
                  isDark ? 'text-blue-400' : 'text-blue-500'
                )} />
                <span className={cn(
                  'text-xs font-bold',
                  isDark ? 'text-slate-200' : 'text-slate-700'
                )}>
                  {environment?.humidity ?? 50}{t.percent}
                </span>
              </div>
              <div className={cn(
                'p-2 rounded-lg',
                isDark ? 'bg-slate-700/50' : 'bg-white'
              )}>
                <Sun className={cn(
                  'w-4 h-4 mx-auto mb-1',
                  isDark ? 'text-yellow-400' : 'text-yellow-500'
                )} />
                <span className={cn(
                  'text-xs font-bold',
                  isDark ? 'text-slate-200' : 'text-slate-700'
                )}>
                  {environment?.light ?? 70}{t.percent}
                </span>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
