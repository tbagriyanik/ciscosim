'use client';

import { Port, getPortLEDColor, PortLEDColor } from '@/lib/network/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Translations } from '@/contexts/LanguageContext';
import { Database } from 'lucide-react';

// Connection type for topology
interface TopologyConnection {
  id: string;
  sourceDeviceId: string;
  sourcePort: string;
  targetDeviceId: string;
  targetPort: string;
  active: boolean;
}

interface PortPanelProps {
  ports: Record<string, Port>;
  t: Translations;
  theme: string;
  deviceName?: string;
  deviceModel?: string;
  activeDeviceId?: string;
  topologyConnections?: TopologyConnection[];
}

const ledColorClasses: Record<PortLEDColor, string> = {
  green: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse',
  gray: 'bg-gray-500 transition-colors',
  orange: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] led-blink',
  white: 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)] border border-slate-300 transition-all',
  off: 'bg-gray-700 transition-colors'
};

const statusTextEn: Record<string, string> = {
  connected: 'Connected',
  notconnect: 'Not Connected',
  disabled: 'Disabled',
  blocked: 'Blocked'
};

export function PortPanel({ ports, t, theme, deviceName, deviceModel, activeDeviceId, topologyConnections }: PortPanelProps) {
  const isDark = theme === 'dark';
  
  // Count open/closed ports
  const openPortsCount = Object.values(ports).filter(p => !p.shutdown).length;
  const totalPortsCount = Object.keys(ports).length;
  
  // Check if a port is connected in topology
  const isPortConnectedInTopology = (portId: string): boolean => {
    if (!topologyConnections || !activeDeviceId) return false;
    const lowerPortId = portId.toLowerCase();
    const lowerDeviceId = activeDeviceId.toLowerCase();
    
    return topologyConnections.some(conn => {
      const connSourceId = conn.sourceDeviceId.toLowerCase();
      const connTargetId = conn.targetDeviceId.toLowerCase();
      const connSourcePort = conn.sourcePort.toLowerCase();
      const connTargetPort = conn.targetPort.toLowerCase();
      
      return (connSourceId === lowerDeviceId && connSourcePort === lowerPortId) ||
             (connTargetId === lowerDeviceId && connTargetPort === lowerPortId);
    });
  };
  
  const faPorts = Object.values(ports)
    .filter(p => p.type === 'fastethernet' && p.id !== 'vlan1')
    .sort((a, b) => {
      const aNum = parseInt(a.id.split('/')[1]);
      const bNum = parseInt(b.id.split('/')[1]);
      return aNum - bNum;
    });

  const giPorts = Object.values(ports)
    .filter(p => p.type === 'gigabitethernet' && p.id !== 'vlan1')
    .sort((a, b) => {
      const aNum = parseInt(a.id.split('/')[1]);
      const bNum = parseInt(b.id.split('/')[1]);
      return aNum - bNum;
    });

  const renderPort = (port: Port) => {
    const isConnectedInTopology = isPortConnectedInTopology(port.id);
    
    // Determine LED color based on topology connection and port state
    let ledColor: PortLEDColor;
    let statusLabel: string;
    
    // Router/Switch ports should only be green if physically connected in topology
    if (isConnectedInTopology) {
      ledColor = 'green';
      statusLabel = t.connected;
    } else if (port.shutdown) {
      ledColor = 'gray';
      statusLabel = t.closed;
    } else if (port.status === 'blocked') {
      ledColor = 'orange';
      statusLabel = t.blocked;
    } else if (port.status === 'connected' && !topologyConnections) {
      // Fallback for when topology isn't provided (standalone view)
      ledColor = 'green';
      statusLabel = t.connected;
    } else {
      ledColor = 'white';
      statusLabel = t.idle;
    }
    
    return (
      <Tooltip key={port.id}>
        <TooltipTrigger asChild>
          <div
            className={`flex flex-col items-center p-1.5 sm:p-2 rounded-lg transition-all duration-200 cursor-default min-w-[45px] sm:min-w-[60px] hover:bg-slate-700/30 ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-200'}`}
          >
            <div className="relative mb-1">
              <div 
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${ledColorClasses[ledColor]} transition-all duration-300`}
              />
              {ledColor === 'green' && (
                <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-50" />
              )}
            </div>
            <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'} transition-colors`}>
              {port.id}
            </span>
            <Badge 
              variant={port.mode === 'trunk' ? 'default' : 'secondary'}
              className={`text-sm px-2 py-0.5 h-auto mt-0.5 transition-all duration-200 ${port.mode === 'trunk' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : ''}`}
            >
              {port.mode === 'trunk' ? 'Trunk' : (port.vlan ? `V${port.vlan}` : t.unassigned)}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} ${isDark ? 'text-white' : 'text-slate-900'} p-3 max-w-xs`}
        >
          <div className="space-y-1 text-xs">
            <div className="font-bold text-cyan-400">{port.id.toUpperCase()}</div>
            <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{t.status}:</span> {statusLabel}
            </div>
            <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{t.mode}:</span> <span className="capitalize">{port.mode}</span>
            </div>
            <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>VLAN:</span> {port.mode === 'trunk' ? 'Trunk' : port.vlan || t.unassigned}
            </div>
            <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{t.speed}:</span> {port.speed === 'auto' ? 'Auto' : port.speed + ' Mbps'}
            </div>
            <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{t.duplex}:</span> {port.duplex === 'auto' ? 'Auto' : <span className="capitalize">{port.duplex}</span>}
            </div>
            {port.name && (
              <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{t.description}:</span> {port.name}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  const cardBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const innerBg = isDark ? 'bg-slate-900' : 'bg-slate-100';
  const innerBorder = isDark ? 'border-slate-600' : 'border-slate-300';

  return (
    <TooltipProvider>
      <Card className={`${cardBg}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-cyan-400 text-base sm:text-lg flex items-center gap-2">
              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
              {deviceName || t.switchTitle}
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'} ml-2`}>
                {deviceModel}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {openPortsCount}/{totalPortsCount} {t.on.toLowerCase()}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={`${innerBg} rounded-lg p-2 sm:p-4 border ${innerBorder}`}>
            <div className={`flex items-center justify-between mb-3 sm:mb-4 pb-2 border-b ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{deviceModel || 'WS-C2960-24TT-L'}</span>
              </div>
              <div className="flex gap-2">
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>PWR</span>
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>SYST</span>
              </div>
            </div>
            
            {faPorts.length > 0 && (
              <div className="mb-3 sm:mb-4">
                <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'} mb-2`}>{t.fastEthernetPorts}</div>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-0.5 sm:gap-1">
                  {faPorts.map(renderPort)}
                </div>
              </div>
            )}
            
            {giPorts.length > 0 && (
              <div className={`pt-2 ${faPorts.length > 0 ? 'border-t' : ''} ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'} mb-2`}>{t.gigabitPorts}</div>
                <div className="flex gap-2 justify-center flex-wrap">
                  {giPorts.map(renderPort)}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-3 sm:mt-4 flex flex-wrap gap-3 sm:gap-4 justify-center text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-green-500" />
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.connected} (Green)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-gray-500" />
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.closed} (Gray)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-orange-500" />
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.blocked} (Orange)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-white border border-slate-300" />
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.idle} (White)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
