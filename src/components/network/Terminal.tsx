'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback, useMemo } from 'react';
import { SwitchState } from '@/lib/network/types';
import { Translations } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CornerDownLeft, Terminal as TerminalIcon, Trash2, History, X, Copy, Search, Download, Settings as SettingsIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from "@/hooks/use-toast";
import { commandHelp } from '@/lib/network/executor';
import { ModernPanel } from '@/components/ui/ModernPanel';
import { cn } from '@/lib/utils';

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
  confirmDialog?: { show: boolean; message?: string; onConfirm: () => void } | null;
  setConfirmDialog?: (dialog: { show: boolean; message: string; action: string; onConfirm: () => void } | null) => void;
  onRequestFocus?: () => void;
  className?: string;
  title?: string;
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
  setConfirmDialog,
  onRequestFocus,
  className,
  title
}: TerminalProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(() => state.commandHistory || []);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(13);

  const isDark = theme === 'dark';

  // Sync with global history
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

  // Command Context for Autocomplete
  const expandCommandContext = useCallback((mode: keyof typeof commandHelp, rawValue: string) => {
    const helpTree = commandHelp[mode] || commandHelp.user;
    const tokens = rawValue.trim().split(/\s+/).filter(Boolean);
    const hasTrailingSpace = rawValue.endsWith(' ');
    const contextTokens = hasTrailingSpace ? tokens : tokens.slice(0, -1);
    const currentWord = hasTrailingSpace ? '' : (tokens[tokens.length - 1] || '').toLowerCase();
    const contextKey = contextTokens.join(' ').toLowerCase();
    const candidates = contextTokens.length === 0 ? helpTree[''] || [] : helpTree[contextKey] || [];
    return { candidates, currentWord, contextTokens, hasTrailingSpace };
  }, []);

  // Syntax Highlighting for Commands
  const highlightCommand = useCallback((text: string) => {
    if (!text) return text;
    const parts = text.split(/\s+/);
    if (parts.length === 0) return text;

    return (
      <>
        <span className="text-cyan-400 font-bold">{parts[0]}</span>
        {parts.length > 1 && (
          <span className="text-slate-300"> {parts.slice(1).join(' ')}</span>
        )}
      </>
    );
  }, []);

  // Text search highlight
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
          <mark key={`m-${i}`} className={cn('px-0.5 rounded', isDark ? 'bg-cyan-500/30 text-cyan-200' : 'bg-cyan-200 text-slate-900')}>
            {matches[i]}
          </mark>
        );
      }
    }
    return <>{out}</>;
  }, [searchQuery, isDark]);

  // Auto-scroll and focus
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
    inputRef.current?.focus();
  }, [output, isLoading, deviceId]);

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

    if (history[0] !== command) {
      const newHistory = [command, ...history].slice(0, 50);
      setHistory(newHistory);
      if (onUpdateHistory) onUpdateHistory(deviceId, newHistory);
    }
    setHistoryIndex(-1);
    setTabCycleIndex(-1);
    setInput('');
    await onCommand(command);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleSubmit();
  };

  const handleTabComplete = useCallback(() => {
    const value = input;
    if (!value && tabCycleIndex === -1) return;
    const mode = state.currentMode;
    const { candidates, currentWord, contextTokens } = expandCommandContext(mode, value);
    const matches = candidates.filter(opt => opt.toLowerCase().startsWith(currentWord));

    if (matches.length > 0) {
      if (tabCycleIndex === -1) {
        setLastTabInput(value);
        setTabCycleIndex(0);
        const completion = matches[0];
        const prefix = contextTokens.join(' ');
        setInput(prefix ? `${prefix} ${completion}` : completion);
      } else {
        const nextIndex = (tabCycleIndex + 1) % matches.length;
        setTabCycleIndex(nextIndex);
        const originalParts = lastTabInput.split(/\s+/);
        const originalContext = lastTabInput.endsWith(' ') ? lastTabInput.trim() : originalParts.slice(0, -1).join(' ');
        const completion = matches[nextIndex];
        setInput(originalContext ? `${originalContext} ${completion}` : completion);
      }
    }
  }, [input, tabCycleIndex, lastTabInput, state.currentMode, expandCommandContext]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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
        const ni = historyIndex + 1;
        setHistoryIndex(ni);
        setInput(history[ni]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const ni = historyIndex - 1;
        setHistoryIndex(ni);
        setInput(history[ni]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabComplete();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      onClear();
    } else {
      setTabCycleIndex(-1);
    }
  };

  const handleCopyAll = useCallback(async () => {
    try {
      const allText = output.map(line => line.type === 'command' ? `${line.prompt || prompt}${line.content}` : line.content).join('\n');
      await navigator.clipboard.writeText(allText);
      toast({ title: t.copy, description: 'Terminal output copied to clipboard.' });
    } catch {
      toast({ title: t.copy, description: 'Clipboard access was blocked.', variant: "destructive" });
    }
  }, [output, prompt, t]);

  const exportTerminal = () => {
    const text = output.map(line => `${line.prompt || (line.type === 'command' ? prompt : '')}${line.content}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deviceName}-cli-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const headerAction = (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="h-8 w-8 rounded-lg">
            <Search className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t.search}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleCopyAll} className="h-8 w-8 rounded-lg">
            <Copy className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t.copy}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={exportTerminal} className="h-8 w-8 rounded-lg">
            <Download className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{language === 'tr' ? 'Dışa Aktar' : 'Export'}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)} className={cn("h-8 w-8 rounded-lg", showSettings && "bg-accent")}>
            <SettingsIcon className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t.settings}</TooltipContent>
      </Tooltip>
      <div className="w-px h-4 bg-border mx-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => onTogglePower?.(deviceId)} className={cn("h-8 w-8 rounded-lg", isPoweredOff ? "text-rose-500" : "text-emerald-500")}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 1 1-12.728 0" />
            </svg>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t.power}</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <ModernPanel
      id={`terminal-${deviceId}`}
      title={title || deviceName}
      onClose={onClose}
      headerAction={headerAction}
      mobileAutoHeight
      className={cn("flex flex-col min-h-0 lg:flex-1", className)}
    >
      <div className="flex flex-col h-full overflow-hidden bg-background">
        {/* Settings Bar */}
        {showSettings && (
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-4 animate-in slide-in-from-top-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              {language === 'tr' ? 'Yazı Boyutu' : 'Font Size'}: {fontSize}px
            </label>
            <input
              type="range" min="10" max="20" value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="flex-1 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-[10px] font-black uppercase tracking-widest text-rose-500">
              <Trash2 className="w-3 h-3 mr-1" /> {t.clearTerminalBtn}
            </Button>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 relative">
          <div
            ref={terminalRef}
            className={cn(
              "flex-1 overflow-y-auto p-6 font-mono leading-relaxed custom-scrollbar",
              isPoweredOff ? "bg-black" : (isDark ? "bg-slate-950" : "bg-slate-50")
            )}
            style={{ fontSize: `${fontSize}px` }}
          >
            {isPoweredOff ? (
              <div className="h-full flex items-center justify-center text-slate-800 font-black tracking-tighter text-2xl uppercase italic">Powered Offline</div>
            ) : (
              <div className="space-y-1.5">
                {output.map((line, i) => (
                  <div key={line.id || i} className="animate-in fade-in slide-in-from-left-1 duration-200">
                    {line.type === 'command' ? (
                      <div className="flex gap-2 text-cyan-500 font-bold group">
                        <span className="shrink-0 opacity-40 select-none">{line.prompt || prompt}</span>
                        <span className={isDark ? "text-slate-100" : "text-slate-900"}>{highlightCommand(line.content)}</span>
                      </div>
                    ) : (
                      <div className={cn(
                        "whitespace-pre-wrap",
                        line.type === 'error' ? "text-rose-500" : (line.type === 'success' ? "text-emerald-500" : (isDark ? "text-slate-300" : "text-slate-700"))
                      )}>
                        {highlightText(line.content)}
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-primary/50 italic py-1 animate-pulse">
                    <span className="text-[10px] font-black uppercase tracking-widest">{t.processing}...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isPoweredOff && (
            <div className="p-4 border-t bg-muted/20">
              <form onSubmit={handleFormSubmit} className="flex items-center gap-3">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-background rounded-xl border border-input flex-1 group focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-inner">
                  <span className="text-primary font-bold text-xs select-none opacity-40 group-focus-within:opacity-100 transition-opacity">{prompt}</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isInputDisabled}
                    className="flex-1 bg-transparent border-none outline-none font-mono text-[13px] placeholder:text-muted-foreground/50"
                    placeholder={t.typeCommand}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button type="submit" disabled={isInputDisabled || !input.trim()} size="icon" className="shrink-0 h-11 w-11 rounded-xl shadow-lg">
                  <CornerDownLeft className="w-5 h-5" />
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.search}</DialogTitle></DialogHeader>
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t.search + "..."} autoFocus />
        </DialogContent>
      </Dialog>
      {/* ... Password and Confirm Dialogs ... */}
    </ModernPanel>
  );
}
