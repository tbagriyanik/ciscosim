'use client';

import { CommandMode } from '@/lib/network/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Translations } from '@/contexts/LanguageContext';

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
  { command: 'show running-config', label: 'sh run', modes: ['privileged'], color: 'bg-purple-600 hover:bg-purple-700' },
  { command: 'show vlan brief', label: 'sh vlan', modes: ['privileged'], color: 'bg-cyan-600 hover:bg-cyan-700' },
  { command: 'show interfaces', label: 'sh int', modes: ['privileged'], color: 'bg-teal-600 hover:bg-teal-700' },
  { command: 'show version', label: 'sh ver', modes: ['privileged'], color: 'bg-indigo-600 hover:bg-indigo-700' },
  { command: 'show mac address-table', label: 'sh mac', modes: ['privileged'], color: 'bg-pink-600 hover:bg-pink-700' },
  { command: 'write memory', label: 'wr', modes: ['privileged'], color: 'bg-yellow-600 hover:bg-yellow-700' },
  { command: 'no shutdown', label: 'no shut', modes: ['interface'], color: 'bg-green-600 hover:bg-green-700' },
  { command: 'shutdown', label: 'shut', modes: ['interface'], color: 'bg-red-600 hover:bg-red-700' },
];

export function QuickCommands({ currentMode, onExecuteCommand, t, theme, language, isDevicePoweredOff = false }: QuickCommandsProps) {
  const isDark = theme === 'dark';
  
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
    <Card className={`${cardBg}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className={`${textPrimary} text-sm flex items-center gap-2`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {t.quickCommands}
          </CardTitle>
          <Badge variant="outline" className="text-xs sm:text-xs">
            {modeLabels[currentMode]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isDevicePoweredOff ? (
          <div className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs font-bold tracking-wider text-center">
            {language === 'tr' ? 'Bağlantı hatası' : 'Connection error'}
          </div>
        ) : availableCommands.length > 0 ? (
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 sm:gap-2">
            {availableCommands.map((cmd) => (
              <Button
                key={cmd.command}
                size="sm"
                onClick={() => onExecuteCommand(cmd.command)}
                className={`text-xs sm:text-xs px-2 sm:px-3 h-10 sm:h-8 ${cmd.color}`}
              >
                {cmd.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className={`text-xs ${textMuted} text-center py-2`}>
            {t.noCommandsAvailable}
          </div>
        )}
        
        <div className={`hidden sm:block mt-2 sm:mt-3 pt-2 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} text-xs sm:text-xs ${textMuted}`}>
          <div className="flex items-center gap-1 mb-1">
            <kbd className={`px-1 py-0.5 ${kbdBg} rounded text-xs`}>TAB</kbd>
            <span>- {t.tabComplete}</span>
          </div>
          <div className="flex items-center gap-1 mb-1">
            <kbd className={`px-1 py-0.5 ${kbdBg} rounded text-xs`}>↑</kbd>
            <kbd className={`px-1 py-0.5 ${kbdBg} rounded text-xs`}>↓</kbd>
            <span>- {t.commandHistory}</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className={`px-1 py-0.5 ${kbdBg} rounded text-xs`}>?</kbd>
            <span>- {t.help}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
