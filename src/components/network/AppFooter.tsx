'use client';

import { SwitchState } from '@/lib/network/types';
import type { DeviceType } from './networkTopology.types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface AppFooterProps {
  state: SwitchState;
  selectedDevice: DeviceType | null;
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
  const deviceType = activeDeviceId.includes('pc') ? 'PC' : activeDeviceId.includes('router') ? 'Router' : 
    (state.switchModel === 'WS-C3560-24PS' ? 'C3560' : 'Switch');

  return (
    <footer
      className={`mt-6 rounded-[2.5rem] p-6 animate-slide-up ${dark ? 'bg-slate-900/60 border-slate-800/50' : 'bg-white/70 border-slate-200/50'} backdrop-blur-xl border shadow-2xl transition-all duration-500`}
    >
      <div className="flex flex-wrap items-center justify-between gap-8">
        {/* Selected Device Info */}
        <div className="flex items-center gap-8">
          <div
            className="flex items-center gap-4 group transition-transform duration-300 hover:scale-105"
          >
            <div className={`p-2 rounded-xl shadow-inner ${deviceType === 'PC' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
              deviceType === 'Router' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                deviceType === 'C3560' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
              {deviceType === 'PC' ? (
                <svg className="w-5 h-5 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              ) : deviceType === 'Router' ? (
                <svg className="w-5 h-5 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              ) : (
                <svg className="w-5 h-5 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              )}
            </div>
            <div>
              <div className={`text-[10px] font-bold tracking-wider ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                {t.activeSystem}
              </div>
              <div className={`text-base font-black tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
                {deviceName}
              </div>
            </div>
          </div>

          <div className={`h-10 w-px ${dark ? 'bg-slate-800' : 'bg-slate-200'}`} />

          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <div className={`text-[10px] font-bold tracking-wider ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{t.nosVersion}</div>
              <div className="text-sm font-bold font-mono text-cyan-500 bg-cyan-500/5 px-1.5 py-0.5 rounded border border-cyan-500/10">{state.version.nosVersion}</div>
            </div>

            <div className="flex flex-col">
              <div className={`text-[10px] font-bold tracking-wider ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{t.model}</div>
              <div className={`text-sm font-bold ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{state.version.modelName}</div>
            </div>

            <div className="flex flex-col">
              <div className={`text-[10px] font-bold tracking-wider ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{t.activePorts}</div>
              <div className={`text-sm font-bold font-mono ${dark ? 'text-amber-400' : 'text-amber-600'}`}>
                <span className="text-lg">{Object.values(state.ports).filter(p => p.status === 'connected' && !p.shutdown).length}</span>
                <span className="opacity-30 mx-1">/</span>
                <span className="opacity-60">{Object.keys(state.ports).length}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
