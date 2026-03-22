'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SwitchState } from '@/lib/network/types';
import { Translations } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CornerDownLeft, Terminal as TerminalIcon, Trash2, Command, Info, History, ChevronRight, X, Copy, Search } from 'lucide-react';
import { QuickCommands } from './QuickCommands';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from "@/hooks/use-toast";

export interface TerminalOutput {
  id: string;
  type: 'command' | 'output' | 'error' | 'success' | 'password-prompt';
  content: string;
  prompt?: string;
  timestamp?: number;
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
  isPoweredOff?: boolean;
  onTogglePower?: (deviceId: string) => void;
  onClose?: () => void;
  t: Translations;
  theme: string;
  language: string;
  onUpdateHistory?: (deviceId: string, history: string[]) => void;
  confirmDialog?: { show: boolean; onConfirm: () => void } | null;
  onRequestFocus?: () => void;
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
  isPoweredOff = false,
  onTogglePower,
  onClose,
  t,
  theme,
  language,
  onUpdateHistory,
  confirmDialog,
  onRequestFocus
}: TerminalProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(() => state.commandHistory || []);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
  const passwordRef = useRef<HTMLInputElement>(null);
  const isInputDisabled = isLoading || isConnectionError || state.awaitingPassword;
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const commandQueueRef = useRef<string[]>([]);
  const isProcessingQueueRef = useRef(false);
  const isReloadConfirmationPending = output.some(
    (line) => line.type === 'output' && /Proceed with reload\? \[confirm\]/i.test(line.content)
  );

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

  useEffect(() => {
    setInput('');
    setHistoryIndex(-1);
    setTabCycleIndex(-1);
    setLastTabInput('');
    setSearchOpen(false);
    setSearchQuery('');
    setPasswordInput('');
    setShowPasswordPrompt(false);
    commandQueueRef.current = [];
    isProcessingQueueRef.current = false;
  }, [deviceId]);

  useEffect(() => {
    if (state.awaitingPassword) {
      setShowPasswordPrompt(true);
      setPasswordInput('');
      setTimeout(() => passwordRef.current?.focus(), 0);
    } else {
      setShowPasswordPrompt(false);
      setPasswordInput('');
    }
  }, [state.awaitingPassword]);

  const handleSubmit = async (cmdToExecute?: string) => {
    const command = (cmdToExecute || input).trim();
    if (!command || isInputDisabled) {
      if (isReloadConfirmationPending && !isInputDisabled) {
        await onCommand('confirm');
      }
      return;
    }

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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmit();
  };

  const focusTerminalInput = useCallback(() => {
    requestAnimationFrame(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
      inputRef.current?.focus();
    });
    onRequestFocus?.();
  }, [onRequestFocus]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = passwordInput.trim();
    if (!value) return;
    await onCommand(value);
    setPasswordInput('');
  };

  const processCommandQueue = async () => {
    // Eğer zaten işleniyor veya queue boşsa, çık
    if (isProcessingQueueRef.current || commandQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;

    while (commandQueueRef.current.length > 0) {
      const command = commandQueueRef.current.shift();
      if (command) {
        // History'ye ekle
        if (history[0] !== command) {
          const newHistory = [command, ...history].slice(0, 50);
          setHistory(newHistory);
          if (onUpdateHistory) {
            onUpdateHistory(deviceId, newHistory);
          }
        }

        await handleSubmit(command);
        // Komut tamamlanana kadar bekle (isLoading false olana kadar)
        await new Promise(resolve => {
          const checkInterval = setInterval(() => {
            // isLoading prop'u kontrol et
            if (!isLoading) {
              clearInterval(checkInterval);
              resolve(null);
            }
          }, 100);
          // Maksimum 10 saniye bekle
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve(null);
          }, 10000);
        });
      }
    }

    isProcessingQueueRef.current = false;
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
      // If confirm dialog is showing, pressing Enter confirms it
      if (confirmDialog?.show) {
        e.preventDefault();
        confirmDialog.onConfirm();
        return;
      }
      e.preventDefault();
      if (isReloadConfirmationPending && !input.trim()) {
        onCommand('confirm');
        return;
      }
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
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      onClear();
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

  const highlightText = useCallback((text: string) => {
    const q = searchQuery.trim();
    if (!q) return text;
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safe, 'gi');
    const parts = text.split(re);
    const matches = text.match(re);
    if (!matches) return text;
    const out: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) out.push(<span key={`p-${i}`}>{parts[i]}</span>);
      if (matches[i]) {
        out.push(
          <mark
            key={`m-${i}`}
            className={`px-0.5 rounded ${isDark ? 'bg-cyan-500/20 text-cyan-200' : 'bg-cyan-200 text-slate-900'}`}
          >
            {matches[i]}
          </mark>
        );
      }
    }
    return <>{out}</>;
  }, [searchQuery, isDark]);

  const handleCopyAll = useCallback(async () => {
    try {
      const allText = output.map((line) => {
        if (line.type === 'command') return `${line.prompt || prompt}${line.content}`;
        return line.content;
      }).join('\n');
      await navigator.clipboard.writeText(allText);
      toast({
        title: language === 'tr' ? 'Kopyalandı' : 'Copied',
        description: language === 'tr' ? 'Terminal çıktısı panoya kopyalandı.' : 'Terminal output copied to clipboard.',
      });
    } catch {
      toast({
        title: language === 'tr' ? 'Kopyalama başarısız' : 'Copy failed',
        description: language === 'tr' ? 'Panoya erişilemedi.' : 'Clipboard access was blocked.',
        variant: "destructive",
      });
    }
  }, [output, prompt, language]);

  return (
    <TooltipProvider>
      <Dialog open={searchOpen} onOpenChange={(open) => {
        setSearchOpen(open);
        if (!open) focusTerminalInput();
      }}>
        <DialogContent className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white'} sm:max-w-md`}>
          <DialogHeader>
            <DialogTitle>{language === 'tr' ? 'Terminalde ara' : 'Search terminal'}</DialogTitle>
            <DialogDescription className={isDark ? 'text-slate-400' : 'text-slate-600'}>
              {language === 'tr' ? 'Eşleşmeler terminal içinde vurgulanır.' : 'Matches will be highlighted in the terminal.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'tr' ? 'Arama...' : 'Search...'}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold"
              disabled={!searchQuery.trim()}
            >
              {language === 'tr' ? 'Temizle' : 'Clear'}
            </Button>
            <Button
              onClick={() => setSearchOpen(false)}
              className="text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {language === 'tr' ? 'Kapat' : 'Close'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showPasswordPrompt}
        onOpenChange={(open) => {
          if (!open && state.awaitingPassword) return;
          setShowPasswordPrompt(open);
          if (!open) focusTerminalInput();
        }}
      >
        <DialogContent showCloseButton={false} className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white'} sm:max-w-sm`}>
          <DialogHeader>
            <DialogTitle>{language === 'tr' ? 'Parola Gerekli' : 'Password Required'}</DialogTitle>
            <DialogDescription className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {language === 'tr' ? 'Lütfen, devam etmek için parolayı girin.' : 'Enter the password to continue.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
            <Input
              ref={passwordRef}
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder={language === 'tr' ? 'Parola' : 'Password'}
              autoComplete="current-password"
            />
            <Button type="submit" disabled={!passwordInput.trim()} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white">
              {language === 'tr' ? 'Gönder' : 'Submit'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col flex-1 gap-4 overflow-hidden h-full">
        <Card className={`${cardBg} shadow-xl rounded-xl overflow-hidden flex flex-col flex-1 min-h-0`}>
          <CardHeader className={`py-3 px-5 border-b ${isDark ? 'border-slate-800/50 bg-slate-800/20' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <TerminalIcon className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm font-black tracking-tight flex items-center gap-2">
                  <span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{deviceName}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">{t.cli}</span>
                </CardTitle>
              </div>
              <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSearchOpen(true)}
                      className={`h-8 w-8 rounded-lg ui-hover-surface ${isDark ? 'text-slate-300 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'}`}
                      aria-label={t.search}
                      title={t.search}
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent hideArrow side="bottom" className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} ${isDark ? 'text-white' : 'text-slate-900'} p-2 text-xs`}>
                    {language === 'tr' ? 'Ara' : 'Search'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyAll}
                      className={`h-8 w-8 rounded-lg ui-hover-surface ${isDark ? 'text-slate-300 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'}`}
                      aria-label={t.copy}
                      title={t.copy}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent hideArrow side="bottom" className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} ${isDark ? 'text-white' : 'text-slate-900'} p-2 text-xs`}>
                    {language === 'tr' ? 'Çıktıyı kopyala' : 'Copy output'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onTogglePower?.(deviceId)}
                      className={`h-8 w-8 rounded-lg ui-hover-surface transition-all ${isPoweredOff ? 'text-rose-500 hover:text-rose-400' : 'text-emerald-500 hover:text-emerald-400'}`}
                      aria-label={language === 'tr' ? 'Güç' : 'Power'}
                      disabled={!onTogglePower}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 1 1-12.728 0" />
                      </svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent hideArrow side="bottom" className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} ${isDark ? 'text-white' : 'text-slate-900'} p-2 text-xs`}>
                    {language === 'tr'
                      ? `Güç: ${isPoweredOff ? 'Kapalı' : 'Açık'}`
                      : `Power: ${isPoweredOff ? 'Off' : 'On'}`}
                  </TooltipContent>
                </Tooltip>
                {onClose && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className={`h-8 w-8 rounded-lg ui-hover-surface ${isDark ? 'text-slate-300 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'}`}
                    aria-label={t.close}
                    title={t.close}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  className={`h-8 px-2.5 text-xs font-bold ui-hover-surface gap-1.5 ${isDark ? 'text-slate-300 hover:text-rose-400' : 'text-slate-600 hover:text-rose-600'}`}
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
              data-terminal-scroll
              className={`flex-1 overflow-y-auto p-6 font-mono text-sm leading-relaxed scroll-smooth custom-scrollbar ${isPoweredOff ? 'bg-black' : terminalBg}`}
            >
              {!isPoweredOff && <div className="space-y-2">
                {output.map((line, index) => (
                  <div key={line.id || index} className="animate-in fade-in slide-in-from-left-1 duration-200">
                    {line.type === 'command' ? (
                      <div className="flex gap-2.5 text-cyan-500 font-bold group">
                        <span className="shrink-0 opacity-50 select-none">{line.prompt || prompt}</span>
                        <span className={cmdColor}>{highlightText(line.content)}</span>
                      </div>
                    ) : (
                      <div className={`whitespace-pre-wrap ${line.type === 'error' ? 'text-rose-500 font-medium' :
                        line.type === 'success' ? 'text-emerald-600' :
                          textColor
                        }`}>
                        {highlightText(line.content)}
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
              </div>}
            </div>

            {/* Input Area - Always Visible */}
            {!isPoweredOff && <div className={`shrink-0 p-3 border-t ${isDark ? 'border-slate-800 bg-slate-900/50' : 'bg-slate-50 border-slate-200'}`}>
              {isConnectionError && (
                <div className="mb-2 px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs font-bold tracking-wider">
                  {connectionErrorMessage || (language === 'tr' ? 'Bağlantı hatası' : 'Connection error')}
                </div>
              )}
              <form onSubmit={handleFormSubmit} className="flex items-center gap-2 max-w-full">
                <div className={`flex items-center gap-2 px-3 py-2 ${inputBg} rounded-lg border ${inputBorder} flex-1 group focus-within:border-cyan-500/50 transition-all`}>
                  <span className="text-cyan-500 font-bold text-xs select-none shrink-0 group-focus-within:opacity-100 transition-opacity">
                    {prompt}
                  </span>
                    <input
                      data-terminal-input
                      ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pastedText = e.clipboardData.getData('text');
                      // Yapıştırılan metinde CR LF (\r\n) veya LF (\n) varsa, komutları ayrı ayrı işle
                      if (pastedText.includes('\n') || pastedText.includes('\r')) {
                        // CR LF (\r\n) ve LF (\n) her ikisini de ayırıcı olarak kullan
                        const lines = pastedText.split(/\r\n|\r|\n/).filter(line => line.trim());
                        if (lines.length > 0) {
                          // Input'u temizle
                          setInput('');
                          // Komutları queue'ye ekle
                          commandQueueRef.current.push(...lines);
                          // Queue işlemeyi başlat
                          processCommandQueue();
                        }
                      } else {
                        // Tek satırlı metin ise input'a yaz
                        setInput(pastedText);
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isInputDisabled}
                    className={`flex-1 bg-transparent border-none outline-none ${cmdColor} font-mono text-[13px] placeholder:text-slate-500 w-full`}
                    placeholder={t.typeCommand}
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isInputDisabled || !input.trim()}
                  size="icon"
                  className={`shrink-0 h-10 w-10 rounded-lg transition-all shadow-lg ${input.trim()
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20 active:scale-95 cursor-pointer'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                    }`}
                >
                  <CornerDownLeft className="w-5 h-5" />
                </Button>
              </form>
            </div>}
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${isDark
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
    </TooltipProvider>
  );
}
