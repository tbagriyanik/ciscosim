'use client';

import { CommandMode } from '@/lib/network/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Translations } from '@/contexts/LanguageContext';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useIsMobile, useIsTablet, useIsDesktop } from '@/hooks/use-breakpoint';
import { ModernPanel } from '@/components/ui/ModernPanel';
import { cn } from '@/lib/utils';

interface QuickCommandsProps {
  currentMode: CommandMode;
  onExecuteCommand: (command: string) => Promise<void>;
  t: Translations;
  theme: string;
  language: 'tr' | 'en';
  isDevicePoweredOff?: boolean;
}

interface QuickCommand {
  command: string;
  label: string;
  modes: CommandMode[];
  color: string;
}

const quickCommands: QuickCommand[] = [
  { command: 'enable', label: 'enable', modes: ['user'], color: 'bg-green-600 hover:bg-green-700' },
  { command: 'disable', label: 'disable', modes: ['privileged'], color: 'bg-gray-600 hover:bg-gray-700' },
  { command: 'configure terminal', label: 'conf t', modes: ['privileged'], color: 'bg-blue-600 hover:bg-blue-700' },
  { command: 'exit', label: 'exit', modes: ['privileged', 'config', 'interface', 'line', 'vlan'], color: 'bg-orange-600 hover:bg-orange-700' },
  { command: 'end', label: 'end', modes: ['config', 'interface', 'line', 'vlan'], color: 'bg-red-600 hover:bg-red-700' },
  { command: 'show running-config', label: 'sh run', modes: ['privileged'], color: 'bg-slate-600 hover:bg-slate-700' },
  { command: 'show vlan brief', label: 'sh vlan', modes: ['privileged'], color: 'bg-gray-600 hover:bg-gray-700' },
  { command: 'show interfaces', label: 'sh int', modes: ['privileged'], color: 'bg-gray-600 hover:bg-gray-700' },
  { command: 'show version', label: 'sh ver', modes: ['privileged'], color: 'bg-gray-600 hover:bg-gray-700' },
  { command: 'show mac address-table', label: 'sh mac', modes: ['privileged'], color: 'bg-gray-600 hover:bg-gray-700' },
  { command: 'write memory', label: 'wr', modes: ['privileged'], color: 'bg-yellow-600 hover:bg-yellow-700' },
  { command: 'no shutdown', label: 'no shut', modes: ['interface'], color: 'bg-green-600 hover:bg-green-700' },
  { command: 'shutdown', label: 'shut', modes: ['interface'], color: 'bg-red-600 hover:bg-red-700' },
];

export function QuickCommands({ currentMode, onExecuteCommand, t, theme, language, isDevicePoweredOff = false }: QuickCommandsProps) {
  const isDark = theme === 'dark';
  
  // Responsive hooks
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();
  
  const availableCommands = quickCommands.filter(cmd => 
    cmd.modes.includes(currentMode)
  );

  const modeLabels: Record<CommandMode, string> = {
    user: t.modeUser,
    privileged: t.modePrivileged,
    config: t.modeConfig,
    interface: t.modeInterface,
    line: t.modeLine,
    vlan: t.modeVlanLabel,
    'router-config': t.modeConfig,
  };

  const cardBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-slate-300' : 'text-slate-700';
  const textMuted = isDark ? 'text-slate-500' : 'text-slate-400';
  const kbdBg = isDark ? 'bg-slate-700' : 'bg-slate-200';

  return (
    <ModernPanel
      id="quickcommands"
      title={t.quickCommands}
      headerAction={
        <Badge variant="outline" className={`text-xs ${isMobile ? 'text-[10px] px-1' : 'sm:text-xs'}`}>
          <span className="truncate">{modeLabels[currentMode]}</span>
        </Badge>
      }
      collapsible={false}
      className={cn("w-full max-w-none", cardBg)}
    >
      <div className="space-y-2">
        {isDevicePoweredOff ? (
          <div className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs font-bold tracking-wider text-center">
            {language === 'tr' ? 'Bağlantı hatası' : 'Connection error'}
          </div>
        ) : availableCommands.length > 0 ? (
          <div className={`grid gap-1 ${isMobile ? 'grid-cols-2' : 'sm:flex sm:flex-wrap sm:gap-1'}`}>
            {availableCommands.map((cmd) => (
              <Tooltip key={cmd.command}>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => onExecuteCommand(cmd.command)}
                    className={`text-xs px-2 py-1 h-auto min-h-[28px] ${cmd.color} transition-transform hover:scale-105 ${isMobile ? 'text-[9px] leading-tight' : 'sm:text-xs sm:px-2 sm:h-6'}`}
                  >
                    <span className="truncate">{cmd.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <span className="truncate">{cmd.command}</span>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ) : (
          <div className={`text-xs ${textMuted} text-center py-2 ${isMobile ? 'text-[9px]' : ''}`}>
            {t.noCommandsAvailable}
          </div>
        )}
      </div>
    </ModernPanel>
  );
}
