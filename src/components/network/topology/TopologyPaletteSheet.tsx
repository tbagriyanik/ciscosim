import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Cable, LineSquiggle, Plug, TrendingUpDown, Wifi, Plus } from "lucide-react";
import { CableInfo } from '@/lib/network/types';

interface TopologyPaletteSheetProps {
  isPaletteOpen: boolean;
  setIsPaletteOpen: (open: boolean) => void;
  isDark: boolean;
  isTR: boolean;
  t: Record<string, string>;
  addDevice: (type: 'pc' | 'iot' | 'switch' | 'router' | 'firewall' | 'wlc', layer?: 'L2' | 'L3') => void;
  cableInfo: CableInfo;
  onCableChange: (cableInfo: CableInfo) => void;
  DEVICE_ICONS: Record<string, React.ReactNode>;
}

/** Toolbar ile birebir aynı renk haritası */
const CABLE_COLOR_MAP: Record<string, string> = {
  straight: 'text-primary-500',
  crossover: 'text-warning-500',
  serial: 'text-success-500',
  console: 'text-accent-500',
  wireless: 'text-purple-500',
};

const CABLE_COLOR_ACTIVE_MAP: Record<string, string> = {
  straight: 'text-primary-400',
  crossover: 'text-warning-400',
  serial: 'text-success-400',
  console: 'text-accent-400',
  wireless: 'text-purple-400',
};

/** Toolbar ile birebir aynı Lucide simgeler */
function CableIconEl({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'straight': return <Cable className={className} />;
    case 'crossover': return <LineSquiggle className={className} />;
    case 'serial': return <Plug className={className} />;
    case 'wireless': return <Wifi className={className} />;
    case 'console':
    default: return <TrendingUpDown className={className} />;
  }
}

export const TopologyPaletteSheet: React.FC<TopologyPaletteSheetProps> = ({
  isPaletteOpen,
  setIsPaletteOpen,
  isDark,
  isTR,
  t,
  addDevice,
  cableInfo,
  onCableChange,
  DEVICE_ICONS
}) => {
  const cableTypes = ['straight', 'crossover', 'serial', 'console'] as const;

  const getCableLabel = (type: string): string => {
    if (type === 'straight') return isTR ? 'Düz Kablo' : 'Straight';
    if (type === 'crossover') return isTR ? 'Çapraz Kablo' : 'Crossover';
    if (type === 'serial') return isTR ? 'Seri Kablo' : 'Serial';
    if (type === 'console') return isTR ? 'Konsol' : 'Console';
    return type;
  };

  const getCableTooltip = (type: string): string => {
    if (type === 'straight') return isTR ? 'Farklı cihaz türleri arasında kullanılır' : 'Used between different device types';
    if (type === 'crossover') return isTR ? 'Aynı tür cihazlar arasında kullanılır' : 'Used between same device types';
    if (type === 'serial') return isTR ? 'Seri bağlantı için kullanılır' : 'Used for serial connection';
    if (type === 'console') return isTR ? 'Yönetim bağlantısı için kullanılır' : 'Used for management connection';
    return type;
  };

  const getDeviceLabel = (type: string): string => (t[type] || type).toUpperCase();

  const getDeviceTooltip = (type: string): string =>
    t[`${type}Desc`] || `${t.add || 'Add'} ${getDeviceLabel(type)}`;

  return (
    <Sheet open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
      <SheetContent
        side="left"
        className={`w-80 border-r ${isDark ? 'border-secondary-800 bg-secondary-900/95' : 'border-secondary-200 bg-white/95'} backdrop-blur-xl p-0`}
      >
        <SheetHeader className={`p-4 border-b ${isDark ? 'border-secondary-800' : 'border-secondary-200'}`}>
          <SheetTitle className={isDark ? 'text-white' : 'text-secondary-900'}>
            {isTR ? 'Palet' : 'Palette'}
          </SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100dvh-5rem-env(safe-area-inset-bottom,0px))]">

          {/* ── Devices Section ── */}
          <div className="space-y-3">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-secondary-400' : 'text-secondary-500'}`}>
              {isTR ? 'Cihazlar' : 'Devices'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(['pc', 'switchL2', 'switchL3', 'router', 'firewall', 'wlc', 'hub', 'cloud', 'mobile', 'printer', 'iot'] as const).map((type) => (
                <Tooltip key={type}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (type === 'switchL2') { addDevice('switch', 'L2'); return; }
                        if (type === 'switchL3') { addDevice('switch', 'L3'); return; }
                        addDevice(type as any);
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 group ${isDark
                        ? 'border-secondary-800 bg-secondary-800/30 hover:bg-secondary-800/60 hover:border-secondary-700'
                        : 'border-secondary-200 bg-secondary-50 hover:bg-secondary-100 hover:border-secondary-300'
                        }`}
                    >
                      <div className="relative mb-2 transition-transform duration-200 group-hover:scale-110 w-8 h-8 flex items-center justify-center">
                        <div className="absolute inset-0 blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-200" />
                        {DEVICE_ICONS[type] ?? DEVICE_ICONS['switch']}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-200">
                          <Plus className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <span className={`text-xs font-medium text-center uppercase ${isDark ? 'text-secondary-300 group-hover:text-white' : 'text-secondary-600 group-hover:text-secondary-900'}`}>
                        {type === 'switchL2'
                          ? 'L2 SWITCH'
                          : type === 'switchL3'
                            ? 'L3 SWITCH'
                            : getDeviceLabel(type)}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className={isDark ? 'bg-secondary-800 border-secondary-700 text-secondary-100' : 'bg-white border-secondary-200 text-secondary-900'}>
                    <p className="text-xs font-medium">
                      {type === 'switchL2'
                        ? (isTR ? 'Katman 2 Switch ekle' : 'Add Layer 2 Switch')
                        : type === 'switchL3'
                          ? (isTR ? 'Katman 3 Switch ekle' : 'Add Layer 3 Switch')
                          : getDeviceTooltip(type)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

          </div>

          {/* ── Cables Section ── */}
          <div className="space-y-3">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-secondary-400' : 'text-secondary-500'}`}>
              {isTR ? 'Kablolar' : 'Cables'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {cableTypes.map((type) => {
                const isActive = cableInfo.cableType === type;
                const colorClass = isActive ? CABLE_COLOR_ACTIVE_MAP[type] : CABLE_COLOR_MAP[type];
                return (
                  <Tooltip key={type}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onCableChange({ ...cableInfo, cableType: type })}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 group ${isActive
                            ? isDark
                              ? 'border-secondary-600 bg-secondary-700/60'
                              : 'border-secondary-300 bg-secondary-200/80'
                            : isDark
                              ? 'border-secondary-800 bg-secondary-800/30 hover:bg-secondary-800/60 hover:border-secondary-700'
                              : 'border-secondary-200 bg-secondary-50 hover:bg-secondary-100 hover:border-secondary-300'
                          }`}
                      >
                        <div className="relative mb-2 transition-transform duration-200 group-hover:scale-110 w-8 h-8 flex items-center justify-center">
                          <CableIconEl type={type} className={`w-6 h-6 ${colorClass}`} />
                          {isActive && (
                            <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-primary-500 rounded-full border-2 border-white dark:border-secondary-900" />
                          )}
                        </div>
                        <span className={`text-[10px] font-medium text-center ${colorClass}`}>
                          {getCableLabel(type)}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className={isDark ? 'bg-secondary-800 border-secondary-700 text-secondary-100' : 'bg-white border-secondary-200 text-secondary-900'}>
                      <p className="text-xs font-medium">{getCableTooltip(type)}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
};
