'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SwitchState } from '@/lib/network/types';
import { Translations } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { CornerDownLeft, Terminal as TerminalIcon, Trash2, Command, Info, History, ChevronRight } from 'lucide-react';
import { QuickCommands } from './QuickCommands';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface TerminalOutput {
  id: string;
  type: 'command' | 'output' | 'error' | 'success' | 'password-prompt';
  content: string;
  prompt?: string;
}

interface TerminalProps {
  deviceId: string;
  deviceName: string;
  prompt: string;
  state: SwitchState;
  onCommand: (command: string) => Promise<void>;
  onClear: () => void;
  output: TerminalOutput[];
  isLoading: boolean;
  isConnectionError?: boolean;
  connectionErrorMessage?: string;
  t: Translations;
  theme: string;
  language: string;
  onUpdateHistory?: (deviceId: string, history: string[]) => void;
}

export function Terminal({
  deviceId,
  deviceName,
  prompt,
  state,
  onCommand,
  onClear,
  output,
  isLoading,
  isConnectionError = false,
  connectionErrorMessage,
  t,
  theme,
  language,
  onUpdateHistory
}: TerminalProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(() => state.commandHistory || []);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Sync with global history if it changes externally
  useEffect(() => {
    const globalHistory = state.commandHistory || [];
    if (JSON.stringify(globalHistory) !== JSON.stringify(history)) {
      setHistory(globalHistory);
      setHistoryIndex(-1);
    }
  }, [state.commandHistory, deviceId]);
  const [tabCycleIndex, setTabCycleIndex] = useState(-1);
  const [lastTabInput, setLastTabInput] = useState('');
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInputDisabled = isLoading || isConnectionError;

  // Advanced Command Help Tree for Network
  const networkHelp: Record<string, Record<string, string[]>> = {
    user: {
      '': ['enable', 'exit', 'show', 'ping', 'telnet', 'ssh'],
      'sh': ['version', 'ip', 'interfaces', 'vlan'],
      'show ip': ['interface', 'route', 'arp'],
      'show ip interface': ['brief'],
    },
    privileged: {
      '': ['configure', 'disable', 'show', 'write', 'ping', 'telnet', 'reload', 'exit', 'copy', 'erase'],
      'sh': ['running-config', 'startup-config', 'interfaces', 'vlan', 'version', 'mac', 'ip'],
      'show ip': ['interface', 'route', 'arp', 'dhcp'],
      'show ip interface': ['brief'],
      'conf': ['terminal'],
      'copy': ['running-config', 'startup-config'],
      'write': ['memory'],
    },
    config: {
      '': ['hostname', 'interface', 'vlan', 'enable', 'line', 'banner', 'ip', 'no', 'exit', 'end', 'do'],
      'int': ['FastEthernet0/', 'GigabitEthernet0/', 'Vlan'],
      'line': ['console 0', 'vty 0 4'],
      'banner': ['motd'],
      'ip': ['address', 'default-gateway', 'domain-name', 'route'],
      'no': ['shutdown', 'ip', 'vlan'],
    },
    interface: {
      '': ['ip', 'no', 'shutdown', 'description', 'exit', 'end'],
      'ip': ['address', 'ipv6'],
      'no': ['shutdown', 'ip', 'description'],
    },
    line: {
      '': ['password', 'login', 'exit', 'end'],
    },
    vlan: {
      '': ['name', 'exit', 'end'],
    }
  };

  // Auto-scroll and focus
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
    inputRef.current?.focus();
  }, [output, isLoading, deviceId]);

  // Focus on mount (when tab is clicked)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (cmdToExecute?: string) => {
    const command = (cmdToExecute || input).trim();
    if (!command || isInputDisabled) return;

    // Add to history if not duplicate of last
    if (history[0] !== command) {
      const newHistory = [command, ...history].slice(0, 50);
      setHistory(newHistory);
      if (onUpdateHistory) {
        onUpdateHistory(deviceId, newHistory);
      }
    }
    setHistoryIndex(-1);
    setTabCycleIndex(-1);
    
    setInput('');
    await onCommand(command);
  };

  const handleTabComplete = useCallback(() => {
    const value = input;
    if (!value && tabCycleIndex === -1) return;

    const mode = state.currentMode;
    const helpTree = networkHelp[mode] || networkHelp.user;
    
    // Split input but handle multiple spaces carefully
    const parts = value.split(/\s+/);
    const hasTrailingSpace = value.endsWith(' ');
    
    // If it ends with space, we're looking for sub-commands of the current input
    const currentWord = hasTrailingSpace ? '' : parts[parts.length - 1].toLowerCase();
    const previousContext = hasTrailingSpace ? value.trim() : parts.slice(0, -1).join(' ');
    const contextKey = previousContext.toLowerCase();
    
    let options: string[] = [];
    if (!previousContext) {
      options = helpTree[''];
    } else {
      options = helpTree[contextKey] || [];
    }

    const matches = options.filter(opt => opt.toLowerCase().startsWith(currentWord));
    
    if (matches.length > 0) {
      if (tabCycleIndex === -1) {
        setLastTabInput(value);
        const nextIndex = 0;
        setTabCycleIndex(nextIndex);
        const completion = matches[nextIndex];
        setInput(previousContext ? `${previousContext} ${completion}` : completion);
      } else {
        const nextIndex = (tabCycleIndex + 1) % matches.length;
        setTabCycleIndex(nextIndex);
        
        // Use the original input's parts to preserve casing if possible
        const originalParts = lastTabInput.split(/\s+/);
        const originalContext = lastTabInput.endsWith(' ') ? lastTabInput.trim() : originalParts.slice(0, -1).join(' ');
        const completion = matches[nextIndex];
        setInput(originalContext ? `${originalContext} ${completion}` : completion);
      }
    }
  }, [input, tabCycleIndex, lastTabInput, state.currentMode]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
        setTabCycleIndex(-1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
        setTabCycleIndex(-1);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
        setTabCycleIndex(-1);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabComplete();
    } else {
      // Reset tab cycle on any other key
      setTabCycleIndex(-1);
    }
  };

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const terminalBg = isDark ? 'bg-black shadow-inner' : 'bg-slate-50 shadow-inner border border-slate-200';
  const textColor = isDark ? 'text-slate-300' : 'text-slate-700';
  const cmdColor = isDark ? 'text-slate-100' : 'text-slate-900';
  const inputBg = isDark ? 'bg-black/40' : 'bg-white';
  const inputBorder = isDark ? 'border-slate-700/50' : 'border-slate-300';

  // Last 10 unique commands for mobile
  const recentCommands = history.slice(0, 10);

  return (
    <div className="flex flex-col flex-1 gap-4 overflow-hidden h-full">
      <Card className={`${cardBg} shadow-xl border-t-4 border-t-cyan-500 rounded-xl overflow-hidden flex flex-col flex-1 min-h-0`}>
        <CardHeader className={`py-3 px-5 border-b ${isDark ? 'border-slate-800/50 bg-slate-800/20' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
                <TerminalIcon className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm font-black tracking-tight flex items-center gap-2">
                <span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{deviceName}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">{t.cli}</span>
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClear}
                className="h-8 px-2.5 text-xs font-bold text-slate-500 hover:text-rose-400 transition-colors gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.clearTerminalBtn}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden relative min-h-0">
          <div
            ref={terminalRef}
            className={`flex-1 overflow-y-auto p-6 font-mono text-sm leading-relaxed scroll-smooth custom-scrollbar ${terminalBg}`}
          >
            <div className="space-y-2">
              {output.map((line, index) => (
                <div key={line.id || index} className="animate-in fade-in slide-in-from-left-1 duration-200">
                  {line.type === 'command' ? (
                    <div className="flex gap-2.5 text-cyan-500 font-bold group">
                      <span className="shrink-0 opacity-50 select-none">{line.prompt || prompt}</span>
                      <span className={cmdColor}>{line.content}</span>
                    </div>
                  ) : (
                    <div className={`whitespace-pre-wrap ${
                      line.type === 'error' ? 'text-rose-500 font-medium' : 
                      line.type === 'success' ? 'text-emerald-600' : 
                      textColor
                    }`}>
                      {line.content}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-cyan-500/50 italic py-1">
                  <div className="w-1 h-1 rounded-full bg-cyan-500 animate-ping" />
                  <span className="text-xs font-bold tracking-wider">{t.processing}</span>
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className={`p-3 border-t ${isDark ? 'border-slate-800 bg-slate-900/50' : 'bg-slate-50 border-slate-200'}`}>
            {isConnectionError && (
              <div className="mb-2 px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs font-bold tracking-wider">
                {connectionErrorMessage || (language === 'tr' ? 'Bağlantı hatası' : 'Connection error')}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex items-center gap-2 max-w-full">
              <div className={`flex items-center gap-2 px-3 py-2 ${inputBg} rounded-lg border ${inputBorder} flex-1 group focus-within:border-cyan-500/50 transition-all`}>
                <span className="text-cyan-500 font-bold text-xs select-none shrink-0 group-focus-within:opacity-100 transition-opacity">
                  {prompt}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isInputDisabled}
                  className={`flex-1 bg-transparent border-none outline-none ${cmdColor} font-mono text-[13px] placeholder:text-slate-500 w-full`}
                  placeholder={t.typeCommand}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                />
                <div className="hidden sm:flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-slate-800 bg-slate-800/50 text-xs text-slate-500 font-bold uppercase tracking-wider">
                  <Command className="w-2.5 h-3.5" />
                  Enter
                </div>
              </div>
              
              <Button 
                type="submit"
                disabled={isInputDisabled || !input.trim()}
                size="icon"
                className={`shrink-0 h-10 w-10 rounded-lg transition-all shadow-lg ${
                  input.trim() 
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20 active:scale-95' 
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                <CornerDownLeft className="w-5 h-5" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Mobile History Area */}
      <div className="flex flex-col gap-2">
        {/* Mobile History List (Visible only on small screens) */}
        {recentCommands.length > 0 && (
          <div className="sm:hidden flex flex-col gap-1 px-1">
            <div className="flex items-center gap-2 mb-1">
              <History className="w-3 h-3 text-slate-500" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                {language === 'tr' ? 'Son Komutlar' : 'Recent Commands'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentCommands.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => handleSubmit(cmd)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                    isDark 
                      ? 'bg-slate-800 border-slate-700 text-slate-300 active:bg-cyan-500/20 active:text-cyan-400' 
                      : 'bg-white border-slate-200 text-slate-600 active:bg-cyan-50'
                  }`}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
