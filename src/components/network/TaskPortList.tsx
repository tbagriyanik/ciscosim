'use client';

import { SwitchState, Port } from '@/lib/network/types';
import { Translations } from '@/contexts/LanguageContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TaskPortListProps {
  state: SwitchState;
  t: Translations;
  theme: string;
  isDevicePoweredOff?: boolean;
}

export function TaskPortList({ state, t, theme, isDevicePoweredOff = false }: TaskPortListProps) {
  const isDark = theme === 'dark';

  // Get all physical ports (not VLAN interfaces)
  const ports = Object.values(state.ports || {})
    .filter((port: Port) => {
      const id = port.id.toLowerCase();
      return !id.startsWith('vlan') && id !== 'wlan0' && id !== 'console';
    })
    .sort((a: Port, b: Port) => {
      // Sort by port type then by number
      const aIsGigabit = a.id.toLowerCase().startsWith('gi');
      const bIsGigabit = b.id.toLowerCase().startsWith('gi');
      
      if (aIsGigabit && !bIsGigabit) return 1;
      if (!aIsGigabit && bIsGigabit) return -1;
      
      // Extract port numbers
      const aNum = parseInt(a.id.split('/')[1] || '0');
      const bNum = parseInt(b.id.split('/')[1] || '0');
      return aNum - bNum;
    });

  const getPortStatus = (port: Port): { color: string; label: string; status: string } => {
    if (isDevicePoweredOff || port.shutdown) {
      return {
        color: isDark ? 'bg-gray-600' : 'bg-gray-400',
        label: t.closed || 'Closed',
        status: 'closed'
      };
    }

    // Check STP blocking state
    const isSTPBlocked = port.spanningTree?.state === 'blocking' || port.spanningTree?.role === 'alternate';
    if (isSTPBlocked) {
      return {
        color: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]',
        label: t.blocked || 'Blocked',
        status: 'blocked'
      };
    }

    if (port.status === 'connected') {
      return {
        color: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]',
        label: t.connected || 'Connected',
        status: 'connected'
      };
    }

    return {
      color: isDark ? 'bg-slate-600' : 'bg-slate-300',
      label: t.idle || 'Idle',
      status: 'notconnect'
    };
  };

  const getSTPInfo = (port: Port): string | null => {
    if (!port.spanningTree) return null;
    
    const roleMap: Record<string, string> = {
      'root': 'Root',
      'designated': 'Desg',
      'alternate': 'Altn',
      'backup': 'Back',
      'disabled': 'Disa'
    };
    
    const stateMap: Record<string, string> = {
      'forwarding': 'FWD',
      'blocking': 'BLK',
      'listening': 'LIS',
      'learning': 'LRN',
      'disabled': 'DIS'
    };
    
    const role = roleMap[port.spanningTree.role || ''] || '';
    const stpState = stateMap[port.spanningTree.state || ''] || '';
    
    if (role && stpState) {
      return `${role} ${stpState}`;
    }
    return null;
  };

  if (ports.length === 0) return null;

  return (
    <TooltipProvider>
      <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'} border ${isDark ? 'border-slate-700' : 'border-slate-200'} mb-4`}>
        <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          {t.ports || 'Ports'} ({ports.length})
        </h4>
        
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {ports.map((port: Port) => {
            const status = getPortStatus(port);
            const stpInfo = getSTPInfo(port);
            
            return (
              <Tooltip key={port.id}>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center p-1.5 rounded bg-opacity-50 cursor-default hover:bg-opacity-80 transition-all">
                    <div className="relative mb-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${status.color} transition-all duration-300`} />
                      {status.status === 'connected' && (
                        <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-40" />
                      )}
                      {status.status === 'blocked' && (
                        <div className="absolute inset-0 rounded-full bg-orange-400 animate-pulse opacity-60" />
                      )}
                    </div>
                    <span className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {port.id.toUpperCase()}
                    </span>
                    {stpInfo && (
                      <span className={`text-[10px] ${isDark ? 'text-orange-400' : 'text-orange-500'} font-semibold`}>
                        {stpInfo}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent 
                  side="top" 
                  className={`${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} p-2 text-xs rounded-lg shadow-xl`}
                >
                  <div className="space-y-1">
                    <div className="font-bold text-cyan-400">{port.id.toUpperCase()}</div>
                    <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                      <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{t.status}:</span> {status.label}
                    </div>
                    {stpInfo && (
                      <div className={isDark ? 'text-orange-400' : 'text-orange-500'}>
                        <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>STP:</span> {stpInfo}
                      </div>
                    )}
                    {port.mode && (
                      <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                        <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{t.mode}:</span> <span className="capitalize">{port.mode}</span>
                      </div>
                    )}
                    {(port.vlan || port.accessVlan) && port.mode !== 'trunk' && (
                      <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                        <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>VLAN:</span> {port.accessVlan || port.vlan}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 pt-2 border-t border-slate-600/20 flex flex-wrap gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.connected}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.blocked}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
            <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.idle}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.closed}</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
