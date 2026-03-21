'use client';

import { CableType } from '@/lib/network/types';
import { X } from 'lucide-react';
import { CABLE_COLORS, DEVICE_ICONS } from './networkTopology.constants';
import { CanvasDevice, SelectedPortRef } from './networkTopology.types';
import { useLanguage } from '@/contexts/LanguageContext';

type PortSelectorStep = 'source' | 'target';

interface NetworkTopologyPortSelectorModalProps {
  isOpen: boolean;
  isDark: boolean;
  devices: CanvasDevice[];
  cableType: CableType;
  portSelectorStep: PortSelectorStep;
  selectedSourcePort: SelectedPortRef | null;
  onClose: () => void;
  onCableTypeChange: (nextType: CableType) => void;
  onSelectPort: (deviceId: string, portId: string) => void;
}

export function NetworkTopologyPortSelectorModal({
  isOpen,
  isDark,
  devices,
  cableType,
  portSelectorStep,
  selectedSourcePort,
  onClose,
  onCableTypeChange,
  onSelectPort,
}: NetworkTopologyPortSelectorModalProps) {
  const { t, language } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={onClose} />
      <div className={`relative w-full max-w-2xl rounded-[2.5rem] ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'} border shadow-2xl overflow-hidden flex flex-col transition-all duration-500`}>
        <div className={`px-8 py-6 border-b ${isDark ? 'border-slate-800/50 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl shadow-inner ${isDark ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 0 0 -5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0 -5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div>
                <h3 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {portSelectorStep === 'source' ? t.selectSourcePort : t.selectTargetPort}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-all duration-300 ${isDark ? 'hover:bg-slate-700/50 text-slate-500 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${portSelectorStep === 'source' ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'bg-emerald-500/40'}`} />
            <div className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${portSelectorStep === 'target' ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : (isDark ? 'bg-slate-800' : 'bg-slate-200')}`} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {t.cableType.toUpperCase()}:
              </span>
              <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => onCableTypeChange(type)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all duration-300 ${cableType === type
                      ? `${CABLE_COLORS[type].bg} text-white shadow-lg shadow-black/10`
                      : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {type === 'straight' ? t.straight : type === 'crossover' ? t.crossover : t.console}
                  </button>
                ))}
              </div>
            </div>

            {portSelectorStep === 'target' && selectedSourcePort && (
              <div className="flex items-center gap-3 ml-auto px-4 py-2 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-cyan-500">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                <span className="text-[10px] font-black tracking-widest">
                  {t.linkFrom}: {devices.find(d => d.id === selectedSourcePort.deviceId)?.name} ({selectedSourcePort.portId})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 max-h-[50vh]">
          {devices.map((device) => {
            // In the "connect cable" panel, we want to show all ports regardless of cable type
            // But we still separate them by availability for better UX
            const filteredPorts = device.ports.filter((p) => {
              // Only filter out the source device when selecting the target
              if (portSelectorStep === 'target' && selectedSourcePort?.deviceId === device.id) return false;
              return true;
            });
            if (filteredPorts.length === 0) return null;

            return (
              <div key={device.id} className="space-y-4">
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border transition-colors ${device.type === 'pc' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                      device.type === 'switch' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                        'bg-purple-500/10 border-purple-500/20 text-purple-500'
                      }`}>
                      {DEVICE_ICONS[device.type]}
                    </div>
                    <span className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'} group-hover:text-cyan-500 transition-colors`}>
                      {device.name}
                    </span>
                  </div>
                  <div className={`text-xs font-bold tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {device.ports.filter(p => p.status === 'disconnected').length} {t.freePorts}
                  </div>
                </div>

                <div className={`grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 p-4 rounded-3xl border ${isDark ? 'bg-slate-950/40 border-slate-800/50' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="col-span-full flex flex-wrap gap-3 mb-2 pb-2 border-b border-dashed border-slate-700/30 text-xs">
                    {device.type === 'pc' ? (
                      <>
                        <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> ETH</span>
                        <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" /> COM</span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Fa</span>
                        <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Gi</span>
                        <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" /> Con</span>
                      </>
                    )}
                    <span className="flex items-center gap-1 text-slate-500 ml-auto"><span className="w-2 h-2 rounded-full bg-slate-600 inline-block" /> {t.connected}</span>
                  </div>
                  {filteredPorts.map((port) => {
                    const isConnected = port.status === 'connected';
                    const pid = port.id.toLowerCase();
                    const isConsolePrt = pid === 'console' || pid.startsWith('com');
                    const isGigabit = pid.startsWith('gi');
                    const isFastEth = pid.startsWith('fa') || pid.startsWith('eth');
                    let dotCls = 'bg-slate-600';
                    let dotGlow = '';
                    let cardCls = isDark
                      ? 'bg-slate-800 border-slate-700 hover:border-cyan-500/50 hover:bg-slate-700'
                      : 'bg-white border-slate-200 hover:border-cyan-500 shadow-sm';
                    let textCls = isDark ? 'text-slate-500 group-hover:text-white' : 'text-slate-500 group-hover:text-cyan-600';
                    if (!isConnected) {
                      if (isConsolePrt) {
                        dotCls = 'bg-cyan-500';
                        dotGlow = 'shadow-[0_0_7px_rgba(6,182,212,0.8)]';
                        cardCls = isDark
                          ? 'bg-cyan-950/20 border-cyan-800/50 hover:border-cyan-400 hover:bg-cyan-900/30'
                          : 'bg-cyan-50 border-cyan-200 hover:border-cyan-400 shadow-sm';
                        textCls = 'text-cyan-400 group-hover:text-cyan-300';
                      } else if (isGigabit) {
                        dotCls = 'bg-orange-500';
                        dotGlow = 'shadow-[0_0_7px_rgba(249,115,22,0.8)]';
                        cardCls = isDark
                          ? 'bg-orange-950/20 border-orange-800/50 hover:border-orange-400 hover:bg-orange-900/30'
                          : 'bg-orange-50 border-orange-200 hover:border-orange-400 shadow-sm';
                        textCls = 'text-orange-400 group-hover:text-orange-300';
                      } else if (isFastEth) {
                        dotCls = 'bg-blue-500';
                        dotGlow = 'shadow-[0_0_7px_rgba(59,130,246,0.8)]';
                        cardCls = isDark
                          ? 'bg-blue-950/20 border-blue-800/50 hover:border-blue-400 hover:bg-blue-900/30'
                          : 'bg-blue-50 border-blue-200 hover:border-blue-400 shadow-sm';
                        textCls = 'text-blue-400 group-hover:text-blue-300';
                      }
                    }
                    return (
                      <button
                        key={port.id}
                        disabled={isConnected}
                        onClick={() => onSelectPort(device.id, port.id)}
                        className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-300 border ${isConnected
                          ? (isDark ? 'bg-slate-900/40 border-slate-800 cursor-not-allowed opacity-40' : 'bg-slate-200 border-slate-300 cursor-not-allowed opacity-40')
                          : `${cardCls} hover:scale-110`}`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${isConnected ? 'bg-slate-600' : `${dotCls} ${dotGlow}`}`} />
                        <span className={`text-xs font-bold font-mono transition-colors ${isConnected ? 'text-slate-600' : textCls}`}>
                          {port.label.replace('FastEthernet', 'Fa').replace('GigabitEthernet', 'Gi')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {devices.every(d => d.ports.filter(p => p.status === 'disconnected').length === 0) && (
            <div className="flex flex-col items-center py-12 space-y-4">
              <div className={`p-6 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                <svg className={`w-12 h-12 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className={`text-center max-w-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <h4 className="font-bold text-slate-400">{t.noFreePorts}</h4>
                <p className="text-xs mt-1">{t.noFreePortsMessage}</p>
              </div>
            </div>
          )}
        </div>

        <div className={`px-8 py-6 border-t ${isDark ? 'border-slate-800/50 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50'} flex justify-between items-center`}>
          <div className={`text-xs font-bold tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            {portSelectorStep === 'source' ? t.step1 : t.step2}
          </div>
          <button
            onClick={onClose}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black tracking-widest transition-all ${isDark ? 'bg-slate-800 text-slate-400 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
