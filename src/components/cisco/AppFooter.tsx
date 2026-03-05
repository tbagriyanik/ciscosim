'use client';

import { SwitchState } from '@/lib/cisco/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface AppFooterProps {
  state: SwitchState;
  selectedDevice: 'pc' | 'switch' | null;
  activeDeviceId: string;
  activeDeviceName?: string;
  isDark: boolean;
  isCLIActive?: boolean;
}

export function AppFooter({ state, selectedDevice, activeDeviceId, activeDeviceName, isDark, isCLIActive = true }: AppFooterProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const dark = isDark;

  // Get device info
  const deviceName = activeDeviceName || state.hostname;
  const deviceType = activeDeviceId.includes('pc') ? 'PC' : activeDeviceId.includes('router') ? 'Router' : 'Switch';

  return (
    <footer className={`mt-4 rounded-xl p-3 ${dark ? 'bg-slate-800/50' : 'bg-white/80'} backdrop-blur-sm border ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Selected Device Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${
              deviceType === 'PC' ? 'bg-blue-500/20 text-blue-400' : 
              deviceType === 'Router' ? 'bg-purple-500/20 text-purple-400' : 
              'bg-emerald-500/20 text-emerald-400'
            }`}>
              {deviceType === 'PC' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              ) : deviceType === 'Router' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              )}
            </div>
            <div>
              <div className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'tr' ? 'Aktif Cihaz' : 'Active Device'}
              </div>
              <div className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>
                {deviceName}
              </div>
            </div>
          </div>
          
          <div className={`h-8 w-px ${dark ? 'bg-slate-700' : 'bg-slate-200'}`} />
          
          <div className="text-center">
            <div className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{t.iosVersion}</div>
            <div className="text-sm font-mono text-cyan-400">{state.version.iosVersion}</div>
          </div>
          
          <div className="text-center">
            <div className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{t.model}</div>
            <div className={`text-sm font-mono ${dark ? 'text-white' : 'text-slate-800'}`}>{state.version.modelName}</div>
          </div>
          
          <div className="text-center">
            <div className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{t.activePorts}</div>
            <div className="text-sm font-mono text-yellow-400">
              {Object.values(state.ports).filter(p => p.status === 'connected' && !p.shutdown).length} / {Object.keys(state.ports).length}
            </div>
          </div>
        </div>

        {/* Tips - Only show when CLI is active */}
        {isCLIActive && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${dark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
            <span className="text-cyan-400 text-xs font-semibold">{t.tips}:</span>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <kbd className={`px-1.5 py-0.5 rounded text-[10px] ${dark ? 'bg-slate-600' : 'bg-slate-200'}`}>TAB</kbd>
                <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{t.tabComplete}</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className={`px-1.5 py-0.5 rounded text-[10px] ${dark ? 'bg-slate-600' : 'bg-slate-200'}`}>↑↓</kbd>
                <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{t.commandHistory}</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className={`px-1.5 py-0.5 rounded text-[10px] ${dark ? 'bg-slate-600' : 'bg-slate-200'}`}>?</kbd>
                <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{t.help}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}
