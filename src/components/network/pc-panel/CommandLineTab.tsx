'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Laptop, Terminal as TerminalIcon, CornerDownLeft, Trash2, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShortcutBadge } from '@/components/ui/ShortcutBadge';
import { cn, triggerHapticFeedback } from '@/lib/utils';
import { secureStorage } from '@/lib/storage/secureStorage';
import type { OutputLine, FtpSession, PythonSession } from './PCPanel.types';
import { executeLinuxCommand, formatLinuxPath, getLinuxSuggestions } from './pcLinuxExecutor';

interface CommandLineTabProps {
  isDark: boolean;
  language: string;
  isPcPoweredOff: boolean;
  isCmdInputDisabled: boolean;
  fontSize: number;
  terminalBg: string;
  textColor: string;
  mobileVerticalScrollStyle?: React.CSSProperties;
  pcOutput: OutputLine[];
  setPcOutput: (output: OutputLine[]) => void;
  internalPcHostname: string;
  setPcHostname?: (name: string) => void;
  setEditingFile?: (file: { path: string; content: string } | null) => void;
  currentPath?: string;
  ftpSession: FtpSession | null;
  pythonSession?: PythonSession | null;
  input: string;
  setInput: (val: string) => void;
  shouldShowAutocomplete: boolean;
  renderAutocompleteSuggestions: React.ReactNode;
  autocompleteIndex: number;
  autocompleteRef: React.RefObject<HTMLDivElement | null>;
  completeAutocompleteSelection: (selected: string) => void;
  executeCommand: (cmdToExecute?: string) => Promise<void>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  outputRef: React.RefObject<HTMLDivElement | null>;
  handleInputChange: (val: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  showCmdSettings: boolean;
  handleFontSizeChange: (val: number) => void;
  handleResizeStart?: (e: React.PointerEvent, direction: string, id: string) => void;
  highlightText: (text: string) => React.ReactNode;
  isMobile: boolean;
  t: Record<string, string>;
  // Optional Linux network props
  deviceId?: string;
  pcIP?: string;
  setPcIP?: (ip: string) => void;
  applyDhcpLease?: (force?: boolean) => { ip: string; subnetMask: string; gateway: string; dns: string; serverName: string; poolName: string } | null;
  pcSubnet?: string;
  pcMAC?: string;
  pcGateway?: string;
  pcDNS?: string;
  pcIPv6?: string;
  wifiEnabled?: boolean;
  setCurrentPath?: (path: string) => void;
  canReachTargetIp?: (targetIp: string) => boolean;
  resolveDeviceNameTargetCallback?: (raw: string) => { ip: string; label?: string } | null;
  openWebPage?: (url: string, target?: string) => void;
  buildArpTableOutput?: () => string;
  getNtpNow?: () => Date | null;
}

export function CommandLineTab({
  isDark,
  language,
  isPcPoweredOff,
  isCmdInputDisabled,
  fontSize,
  terminalBg,
  textColor,
  mobileVerticalScrollStyle,
  pcOutput,
  setPcOutput,
  internalPcHostname,
  setPcHostname,
  setEditingFile,
  currentPath = 'C:\\',
  ftpSession,
  pythonSession,
  input,
  setInput,
  shouldShowAutocomplete,
  renderAutocompleteSuggestions,
  autocompleteIndex = 0,
  completeAutocompleteSelection = () => {},
  executeCommand,
  handleInputChange,
  handleKeyDown,
  highlightText,
  showCmdSettings,
  handleFontSizeChange,
  isMobile,
  t,
  inputRef: externalInputRef,
  outputRef,
  deviceId = 'pc-1',
  pcIP = '192.168.1.10',
  setPcIP,
  applyDhcpLease,
  pcSubnet = '255.255.255.0',
  pcMAC = '00:50:79:66:68:00',
  pcGateway = '192.168.1.1',
  pcDNS = '8.8.8.8',
  pcIPv6 = 'fe80::1',
  wifiEnabled = false,
  setCurrentPath = () => { },
  canReachTargetIp = () => true,
  resolveDeviceNameTargetCallback = () => null,
  openWebPage,
  buildArpTableOutput,
  getNtpNow,
}: CommandLineTabProps) {
  const inputRef = externalInputRef;
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Pinned terminal tab state (persist in localStorage per device and globally)
  const [pinnedTerminalTab, setPinnedTerminalTab] = useState<'cmd' | 'linux' | null>(() => {
    if (typeof localStorage !== 'undefined') {
      const pinned = localStorage.getItem(`pc_pinned_terminal_tab_${deviceId}`) || localStorage.getItem('pc_pinned_terminal_tab');
      if (pinned === 'cmd' || pinned === 'linux') return pinned;
    }
    return null;
  });

  // Terminal active tab state: 'cmd' vs 'linux' (loads pinned or last used terminal tab)
  const [activeTerminalTab, setActiveTerminalTab] = useState<'cmd' | 'linux'>(() => {
    if (typeof localStorage !== 'undefined') {
      const pinned = localStorage.getItem(`pc_pinned_terminal_tab_${deviceId}`) || localStorage.getItem('pc_pinned_terminal_tab');
      if (pinned === 'cmd' || pinned === 'linux') return pinned;
      const last = localStorage.getItem(`pc_last_terminal_tab_${deviceId}`);
      if (last === 'cmd' || last === 'linux') return last;
    }
    return 'cmd';
  });

  const [linuxAutocompleteIndex, setLinuxAutocompleteIndex] = useState(-1);
  const [linuxAutocompleteNavigated, setLinuxAutocompleteNavigated] = useState(false);
  const [isLinuxAutocompleteDismissed, setIsLinuxAutocompleteDismissed] = useState(false);
  const [linuxTabCycleIndex, setLinuxTabCycleIndex] = useState(-1);

  // Separate Linux output state & history (persisted per device in localStorage)
  const [linuxOutput, setLinuxOutput] = useState<OutputLine[]>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = secureStorage.getItem(`pc_linux_output_${deviceId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch { }
    }
    return [
      {
        id: 'linux-welcome',
        type: 'output',
        content: `Linux ${internalPcHostname.toLowerCase()}\nType 'help' for available commands.\n`,
      },
    ];
  });

  const [linuxHistory, setLinuxHistory] = useState<string[]>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = secureStorage.getItem(`pc_linux_history_${deviceId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch { }
    }
    return [];
  });

  const [linuxHistoryIndex, setLinuxHistoryIndex] = useState(-1);

  // Reset Linux terminal output when PC powers back on (reboots)
  const prevPoweredOffRef = useRef<boolean>(isPcPoweredOff);
  useEffect(() => {
    if (prevPoweredOffRef.current && !isPcPoweredOff) {
      const defaultOutput: OutputLine[] = [
        {
          id: 'linux-welcome',
          type: 'output',
          content: `Linux ${internalPcHostname.toLowerCase()}\nType 'help' for available commands.\n`,
        },
      ];
      setLinuxOutput(defaultOutput);
      if (typeof localStorage !== 'undefined') {
        try {
          secureStorage.removeItem(`pc_linux_output_${deviceId}`);
        } catch { }
      }
    }
    prevPoweredOffRef.current = isPcPoweredOff;
  }, [isPcPoweredOff, internalPcHostname, deviceId]);

  // Persist Linux output history to localStorage when changed
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        secureStorage.setItem(`pc_linux_output_${deviceId}`, JSON.stringify(linuxOutput.slice(-200)));
      } catch { }
    }
  }, [linuxOutput, deviceId]);

  // Persist Linux command history to localStorage when changed
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        secureStorage.setItem(`pc_linux_history_${deviceId}`, JSON.stringify(linuxHistory.slice(0, 50)));
      } catch { }
    }
  }, [linuxHistory, deviceId]);

  // A project reset can happen while the PC panel is still mounted. Reset
  // the in-memory Linux session too, otherwise its persistence effects can
  // immediately write the old output/history back to localStorage.
  useEffect(() => {
    const handleNewProjectReset = () => {
      const defaultOutput: OutputLine[] = [{
        id: 'linux-welcome',
        type: 'output',
        content: `Linux ${internalPcHostname.toLowerCase()}\nType 'help' for available commands.\n`,
      }];
      setLinuxOutput(defaultOutput);
      setLinuxHistory([]);
      setLinuxHistoryIndex(-1);
      setInput('');
      try {
        localStorage.removeItem(`pc_linux_output_${deviceId}`);
        localStorage.removeItem(`pc_linux_history_${deviceId}`);
      } catch { }
    };

    window.addEventListener('new-project-reset', handleNewProjectReset);
    return () => window.removeEventListener('new-project-reset', handleNewProjectReset);
  }, [deviceId, internalPcHostname, setInput]);

  // Switch tab and persist choice
  const handleTabSwitch = useCallback((tab: 'cmd' | 'linux') => {
    setActiveTerminalTab(tab);
    setInput('');
    setLinuxAutocompleteIndex(-1);
    setIsLinuxAutocompleteDismissed(false);
    setLinuxHistoryIndex(-1);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`pc_last_terminal_tab_${deviceId}`, tab);
      } catch { }
    }
  }, [deviceId, setInput]);

  // Toggle pin/unpin for a tab
  const togglePinTab = useCallback((tab: 'cmd' | 'linux', e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedTerminalTab(prev => {
      const next = prev === tab ? null : tab;
      if (typeof localStorage !== 'undefined') {
        try {
          if (next) {
            localStorage.setItem(`pc_pinned_terminal_tab_${deviceId}`, next);
            localStorage.setItem('pc_pinned_terminal_tab', next);
          } else {
            localStorage.removeItem(`pc_pinned_terminal_tab_${deviceId}`);
            localStorage.removeItem('pc_pinned_terminal_tab');
          }
        } catch { }
      }
      return next;
    });
  }, [deviceId]);

  // Current displayed output based on active tab
  const activeOutput = activeTerminalTab === 'cmd' ? pcOutput : linuxOutput;

  // Auto-scroll output area
  useEffect(() => {
    if (!outputRef?.current) return;
    requestAnimationFrame(() => {
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    });
    const timer = setTimeout(() => {
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeOutput, outputRef]);

  // Focus input when container clicked
  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  // Focus input immediately on mount or tab switch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (document.activeElement?.closest('[data-portal-window="true"], [data-code-editor="true"]')) return;
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTerminalTab, inputRef]);

  // Add local output for Linux mode
  const addLinuxOutput = useCallback((type: OutputLine['type'], content: string, prompt?: string) => {
    const newLine: OutputLine = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      content,
      prompt,
    };
    setLinuxOutput(prev => [...prev, newLine]);
  }, []);

  // Filter Linux suggestions
  const linuxFilteredSuggestions = getLinuxSuggestions(input, currentPath, deviceId);

  const isAutocompleteVisible = activeTerminalTab === 'cmd'
    ? shouldShowAutocomplete
    : (!isLinuxAutocompleteDismissed && input.trim().length > 0 && linuxFilteredSuggestions.length > 0);

  // Auto-scroll active suggestion into view when navigating with Arrow keys in Linux mode
  useEffect(() => {
    if (activeTerminalTab === 'linux' && isAutocompleteVisible && linuxAutocompleteIndex >= 0 && autocompleteRef.current) {
      const activeEl = autocompleteRef.current.querySelector(`[data-autocomplete-index="${linuxAutocompleteIndex}"]`) as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTerminalTab, isAutocompleteVisible, linuxAutocompleteIndex]);

  // Helper to complete selection in Linux mode (matching CMD mode buildCompletedInput)
  const completeLinuxSelection = useCallback((selected: string) => {
    const trimmed = input.trimStart();
    const parts = trimmed.split(/\s+/);
    const suffix = selected.endsWith('/') ? '' : ' ';
    let completed = '';
    if (parts.length <= 1 && !input.endsWith(' ')) {
      completed = selected + suffix;
    } else {
      const tokens = input.endsWith(' ') ? parts.filter(Boolean) : parts.slice(0, -1).filter(Boolean);
      const commandPrefix = tokens.join(' ');
      completed = commandPrefix ? `${commandPrefix} ${selected}${suffix}` : `${parts[0]} ${selected}${suffix}`;
    }
    setInput(completed);
    setIsLinuxAutocompleteDismissed(true);
    setLinuxAutocompleteIndex(-1);
    setLinuxAutocompleteNavigated(false);
    return completed;
  }, [input, setInput]);

  // Submit command based on active tab
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isCmdInputDisabled) return;

    if (activeTerminalTab === 'cmd') {
      await executeCommand();
    } else {
      const cmdToRun = input.trim();
      setInput('');
      setLinuxAutocompleteIndex(-1);
      setIsLinuxAutocompleteDismissed(false);
      // Save ALL commands (valid or invalid) to Linux history for recall with Arrow keys
      setLinuxHistory(prev => [cmdToRun, ...prev.filter(c => c !== cmdToRun)].slice(0, 50));
      setLinuxHistoryIndex(-1);

      await executeLinuxCommand(cmdToRun, {
        deviceId,
        internalPcHostname,
        setPcHostname,
        setEditingFile,
        pcIP,
        setPcIP,
        applyDhcpLease,
        pcSubnet,
        pcMAC,
        pcGateway,
        pcDNS,
        pcIPv6,
        wifiEnabled,
        currentPath,
        setCurrentPath,
        canReachTargetIp,
        resolveDeviceNameTargetCallback,
        openWebPage,
        addLocalOutput: addLinuxOutput,
        setLinuxOutput,
        executeCommand,
        linuxHistory: [cmdToRun, ...linuxHistory.filter(c => c !== cmdToRun)].slice(0, 50),
        buildArpTableOutput,
        getNtpNow,
      });
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden relative">
      {/* 2-Tab Selection Header with Pin / Default Support */}
      <div className={cn(
        "flex items-center justify-between px-3 py-1.5 border-b shrink-0 z-10",
        isDark ? "bg-secondary-900/90 border-secondary-800" : "bg-secondary-100/90 border-secondary-200"
      )}>
        <div className="flex items-center gap-2">
          {/* CMD Tab Button with Pin */}
          <div className="relative flex items-center group">
            <button
              type="button"
              onClick={() => handleTabSwitch('cmd')}
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm pr-7 relative",
                activeTerminalTab === 'cmd'
                  ? (isDark ? "bg-orange-500/20 text-orange-300 border border-orange-500/40" : "bg-white text-orange-700 border border-orange-200 shadow")
                  : (isDark ? "text-secondary-400 hover:text-secondary-200 hover:bg-white/5" : "text-secondary-600 hover:text-secondary-900 hover:bg-secondary-200/60")
              )}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>Command Prompt</span>
            </button>

            {/* Pin Toggle Button */}
            <button
              type="button"
              title={pinnedTerminalTab === 'cmd' ? (language === 'tr' ? 'Varsayılan terminal (Sabitlendi). Kaldırmak için tıklayın.' : 'Default terminal (Pinned). Click to unpin.') : (language === 'tr' ? 'Varsayılan Terminal Olarak Sabitle' : 'Pin as Default Terminal')}
              onClick={(e) => togglePinTab('cmd', e)}
              className={cn(
                "absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-all z-10",
                pinnedTerminalTab === 'cmd'
                  ? "text-orange-500 opacity-100 scale-110"
                  : "text-muted-foreground opacity-30 hover:opacity-100 hover:text-orange-400"
              )}
            >
              <Pin className={cn("w-3 h-3 transition-transform", pinnedTerminalTab === 'cmd' && "fill-orange-500/40 rotate-45")} />
            </button>
          </div>

          {/* Linux Tab Button with Pin */}
          <div className="relative flex items-center group">
            <button
              type="button"
              onClick={() => handleTabSwitch('linux')}
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm pr-7 relative",
                activeTerminalTab === 'linux'
                  ? (isDark ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-white text-emerald-700 border border-emerald-200 shadow")
                  : (isDark ? "text-secondary-400 hover:text-secondary-200 hover:bg-white/5" : "text-secondary-600 hover:text-secondary-900 hover:bg-secondary-200/60")
              )}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>{language === 'tr' ? 'Linux Terminali' : 'Linux Terminal'}</span>
            </button>

            {/* Pin Toggle Button */}
            <button
              type="button"
              title={pinnedTerminalTab === 'linux' ? (language === 'tr' ? 'Varsayılan terminal (Sabitlendi). Kaldırmak için tıklayın.' : 'Default terminal (Pinned). Click to unpin.') : (language === 'tr' ? 'Varsayılan Terminal Olarak Sabitle' : 'Pin as Default Terminal')}
              onClick={(e) => togglePinTab('linux', e)}
              className={cn(
                "absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-all z-10",
                pinnedTerminalTab === 'linux'
                  ? "text-emerald-500 opacity-100 scale-110"
                  : "text-muted-foreground opacity-30 hover:opacity-100 hover:text-emerald-400"
              )}
            >
              <Pin className={cn("w-3 h-3 transition-transform", pinnedTerminalTab === 'linux' && "fill-emerald-500/40 rotate-45")} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pinnedTerminalTab && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <Pin className="w-2.5 h-2.5 fill-primary/30 rotate-45" />
              <span>{pinnedTerminalTab === 'cmd' ? 'CMD Default' : 'Linux Default'}</span>
            </span>
          )}
          <div className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-muted/50 text-muted-foreground hidden sm:block">
            {activeTerminalTab === 'cmd' ? 'CMD Command Prompt' : 'Linux Bash Terminal'}
          </div>
        </div>
      </div>

      {/* Settings Bar */}
      {showCmdSettings && (
        <div className="px-3 md:px-4 py-2 border-b bg-muted/30 flex items-center gap-4 animate-in slide-in-from-top-2 shrink-0">
          <label className="text-[10px] font-black tracking-widest text-muted-foreground whitespace-nowrap">
            {t.fontSizeLabel}: {fontSize}px
          </label>
          <input
            type="range" min="10" max="20" value={fontSize}
            aria-label={t.fontSizeLabel}
            onChange={(e) => handleFontSizeChange(parseInt(e.target.value, 10))}
            className="flex-1 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              triggerHapticFeedback('light');
              if (activeTerminalTab === 'cmd') {
                setPcOutput([]);
              } else {
                setLinuxOutput([]);
              }
            }}
            className="h-7 text-[10px] font-black tracking-widest text-error-500 gap-1.5"
          >
            <Trash2 className="w-3 h-3" />
            {t.clearTerminalBtn}
            <ShortcutBadge shortcut="Ctrl+L" variant="danger" className="scale-75 origin-right" />
          </Button>
        </div>
      )}

      {/* Output History Area - Font size slider applies HERE ONLY */}
      <div
        ref={outputRef}
        role="log"
        aria-live="polite"
        onClick={handleContainerClick}
        onMouseUp={() => {
          const selectedText = window.getSelection()?.toString();
          if (selectedText && selectedText.trim().length > 0) {
            navigator.clipboard?.writeText(selectedText)?.catch?.(() => {});
          }
        }}
        onWheel={(event) => {
          event.stopPropagation();
          event.currentTarget.scrollTop += event.deltaY;
        }}
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y scroll-smooth font-geist-mono leading-relaxed custom-scrollbar min-h-0 cursor-text",
          isMobile ? "mobile-scroll p-3" : "p-6",
          isPcPoweredOff ? "bg-black" : terminalBg
        )}
        style={{ ...mobileVerticalScrollStyle, fontSize: `${fontSize}px`, contain: 'layout style paint' }}
      >
        {isPcPoweredOff ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <svg className="w-16 h-16 text-error-600 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 1 1-12.728 0" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.36 5.64a9 9 0 1 1-12.73 0" />
            </svg>
          </div>
        ) : (
          activeOutput.map((line) => (
            <div key={line.id} style={{ fontSize: `${fontSize}px` }} className="break-all animate-in fade-in slide-in-from-left-1 duration-200">
              {line.type === 'command' && (
                <div style={{ fontSize: `${fontSize}px` }} className="flex items-start gap-2 font-bold">
                  {activeTerminalTab === 'cmd' ? (
                    <>
                      <Laptop className="w-4 h-4 shrink-0 text-orange-400 mt-0.5" />
                      <span style={{ fontSize: `${fontSize}px` }} className="shrink-0 opacity-40 select-none font-geist-mono">
                        {line.prompt || `${internalPcHostname} C:\\>`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Laptop className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                      <span style={{ fontSize: `${fontSize}px` }} className="shrink-0 font-geist-mono select-none">
                        <span className="text-emerald-400 font-bold">{line.prompt?.split(':')[0] || `user@${internalPcHostname.toLowerCase()}`}</span>
                        <span className="text-secondary-400">:</span>
                        <span className="text-sky-400">{line.prompt?.split(':')[1] || `~$`}</span>{' '}
                      </span>
                    </>
                  )}
                  <span style={{ fontSize: `${fontSize}px` }} className={isDark ? "text-secondary-100" : "text-secondary-900"}>{highlightText(line.content)}</span>
                </div>
              )}
              {line.type === 'output' && (
                <div style={{ fontSize: `${fontSize}px` }} className={cn(textColor, "whitespace-pre-wrap")}>
                  <span>{highlightText(line.content)}</span>
                </div>
              )}
              {line.type === 'error' && <span style={{ fontSize: `${fontSize}px` }} className="text-error-500 font-bold italic">{highlightText(line.content)}</span>}
              {line.type === 'success' && <span style={{ fontSize: `${fontSize}px` }} className="text-emerald-500 font-bold tracking-widest opacity-90">{highlightText(line.content)}</span>}
            </div>
          ))
        )}
      </div>

      {/* Input Entry Prompt Area - Standard Fixed Size */}
      {!isPcPoweredOff && (
        <div onClick={handleContainerClick} className={cn("shrink-0 border-t bg-muted/95 backdrop-blur-sm z-20", isMobile ? "p-2 pb-safe" : "p-3")}>
          <form onSubmit={handleSubmitForm} className="flex items-center gap-3 relative">
            <div
              className={cn(
                "flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 bg-background rounded-lg border flex-1 group focus-within:ring-1 transition-all shadow-inner overflow-hidden",
                activeTerminalTab === 'cmd' ? "focus-within:ring-orange-500/50" : "focus-within:ring-emerald-500/50",
                isMobile && "px-3 py-2"
              )}
            >
              <span className="shrink-0">
                {activeTerminalTab === 'cmd' ? (
                  <Laptop className="w-4 h-4 text-orange-400" />
                ) : (
                  <Laptop className="w-4 h-4 text-emerald-400" />
                )}
              </span>
              <span className="font-geist-mono font-bold text-[10px] sm:text-xs select-none opacity-60 group-focus-within:opacity-100 transition-opacity shrink-0 truncate max-w-[140px] sm:max-w-none md:max-w-[240px]">
                {activeTerminalTab === 'cmd' ? (
                  pythonSession ? (pythonSession.currentPrompt || '>>> ') : ftpSession ? 'ftp>' : `${internalPcHostname} ${currentPath || 'C:\\'}>`
                ) : (
                  <span className="text-emerald-400">user@{internalPcHostname.toLowerCase()}:<span className="text-sky-400">{formatLinuxPath(currentPath)}</span>$</span>
                )}
              </span>
              <input
                ref={inputRef}
                data-terminal-input
                type="text"
                value={input}
                onChange={(e) => {
                  handleInputChange(e.target.value);
                  setLinuxAutocompleteIndex(-1);
                  setLinuxAutocompleteNavigated(false);
                  setLinuxTabCycleIndex(-1);
                  setIsLinuxAutocompleteDismissed(false);
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
                    e.preventDefault();
                    if (activeTerminalTab === 'cmd') {
                      setPcOutput([]);
                    } else {
                      setLinuxOutput([]);
                    }
                    setInput('');
                    setLinuxAutocompleteIndex(-1);
                    setIsLinuxAutocompleteDismissed(false);
                    return;
                  }

                  if (activeTerminalTab === 'cmd') {
                    handleKeyDown(e);
                  } else {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (isAutocompleteVisible && linuxAutocompleteNavigated && linuxFilteredSuggestions.length > 0) {
                        const targetIdx = linuxAutocompleteIndex >= 0 ? linuxAutocompleteIndex : 0;
                        const selected = linuxFilteredSuggestions[targetIdx];
                        if (selected) {
                          const completed = completeLinuxSelection(selected);
                          void (async () => {
                            const cmdToRun = completed.trim();
                            if (!cmdToRun || isCmdInputDisabled) return;
                            setInput('');
                            setLinuxAutocompleteIndex(-1);
                            setLinuxAutocompleteNavigated(false);
                            setIsLinuxAutocompleteDismissed(false);
                            setLinuxHistory(prev => [cmdToRun, ...prev.filter(c => c !== cmdToRun)].slice(0, 50));
                            setLinuxHistoryIndex(-1);

                            await executeLinuxCommand(cmdToRun, {
                              deviceId,
                              internalPcHostname,
                              setPcHostname,
                              setEditingFile,
                              pcIP,
                              setPcIP,
                              applyDhcpLease,
                              pcSubnet,
                              pcMAC,
                              pcGateway,
                              pcDNS,
                              pcIPv6,
                              wifiEnabled,
                              currentPath,
                              setCurrentPath,
                              canReachTargetIp,
                              resolveDeviceNameTargetCallback,
                              openWebPage,
                              addLocalOutput: addLinuxOutput,
                              setLinuxOutput,
                              buildArpTableOutput,
                              getNtpNow,
                            });
                          })();
                          return;
                        }
                      }
                      void (async () => {
                        const cmdToRun = input.trim();
                        if (!cmdToRun || isCmdInputDisabled) return;
                        setInput('');
                        setLinuxAutocompleteIndex(-1);
                        setLinuxAutocompleteNavigated(false);
                        setIsLinuxAutocompleteDismissed(false);
                        setLinuxHistory(prev => [cmdToRun, ...prev.filter(c => c !== cmdToRun)].slice(0, 50));
                        setLinuxHistoryIndex(-1);

                        await executeLinuxCommand(cmdToRun, {
                          deviceId,
                          internalPcHostname,
                          setPcHostname,
                          setEditingFile,
                          pcIP,
                          setPcIP,
                          applyDhcpLease,
                          pcSubnet,
                          pcMAC,
                          pcGateway,
                          pcDNS,
                          pcIPv6,
                          wifiEnabled,
                          currentPath,
                          setCurrentPath,
                          canReachTargetIp,
                          resolveDeviceNameTargetCallback,
                          openWebPage,
                          addLocalOutput: addLinuxOutput,
                          setLinuxOutput,
                          buildArpTableOutput,
                          getNtpNow,
                        });
                      })();
                      return;
                    } else if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                      const currentInput = input;
                      const suggestions = getLinuxSuggestions(currentInput, currentPath, deviceId);
                      if (suggestions.length > 0) {
                        const nextIndex = (linuxTabCycleIndex + 1) % suggestions.length;
                        setLinuxTabCycleIndex(nextIndex);
                        const selected = suggestions[nextIndex];
                        completeLinuxSelection(selected);
                      }
                      return;
                    } else if (e.key === 'Escape') {
                      if (isAutocompleteVisible) {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsLinuxAutocompleteDismissed(true);
                        setLinuxAutocompleteIndex(-1);
                        setLinuxAutocompleteNavigated(false);
                        return;
                      }
                    } else if (e.key === 'ArrowUp') {
                      if (isAutocompleteVisible && linuxFilteredSuggestions.length > 0) {
                        e.preventDefault();
                        setLinuxAutocompleteIndex(prev => {
                          if (prev <= 0) return linuxFilteredSuggestions.length - 1;
                          return prev - 1;
                        });
                        setLinuxAutocompleteNavigated(true);
                        return;
                      }
                      e.preventDefault();
                      setIsLinuxAutocompleteDismissed(true);
                      setLinuxAutocompleteIndex(-1);
                      setLinuxAutocompleteNavigated(false);
                      if (linuxHistory.length > 0 && linuxHistoryIndex < linuxHistory.length - 1) {
                        const nextIdx = linuxHistoryIndex + 1;
                        setLinuxHistoryIndex(nextIdx);
                        setInput(linuxHistory[nextIdx] || '');
                      }
                      return;
                    } else if (e.key === 'ArrowDown') {
                      if (isAutocompleteVisible && linuxFilteredSuggestions.length > 0) {
                        e.preventDefault();
                        setLinuxAutocompleteIndex(prev => {
                          if (prev === -1) return 0;
                          return (prev + 1) % linuxFilteredSuggestions.length;
                        });
                        setLinuxAutocompleteNavigated(true);
                        return;
                      }
                      e.preventDefault();
                      setIsLinuxAutocompleteDismissed(true);
                      setLinuxAutocompleteIndex(-1);
                      setLinuxAutocompleteNavigated(false);
                      if (linuxHistoryIndex > 0) {
                        const nextIdx = linuxHistoryIndex - 1;
                        setLinuxHistoryIndex(nextIdx);
                        setInput(linuxHistory[nextIdx] || '');
                      } else if (linuxHistoryIndex === 0) {
                        setLinuxHistoryIndex(-1);
                        setInput('');
                      }
                      return;
                    }
                  }
                }}
                onPaste={(e) => {
                  const pastedData = e.clipboardData.getData('text');
                  if (pastedData && pastedData.includes('\n')) {
                    e.preventDefault();
                    const lines = pastedData.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    void (async () => {
                      for (const line of lines) {
                        if (activeTerminalTab === 'cmd') {
                          await executeCommand(line);
                        } else {
                          await executeLinuxCommand(line, {
                            deviceId,
                            internalPcHostname,
                            setPcHostname,
                            setEditingFile,
                            pcIP,
                            setPcIP,
                            applyDhcpLease,
                            pcSubnet,
                            pcMAC,
                            pcGateway,
                            pcDNS,
                            pcIPv6,
                            wifiEnabled,
                            currentPath,
                            setCurrentPath,
                            canReachTargetIp,
                            resolveDeviceNameTargetCallback,
                            openWebPage,
                            addLocalOutput: addLinuxOutput,
                            setLinuxOutput,
                            buildArpTableOutput,
                          });
                        }
                      }
                    })();
                  }
                }}
                className="flex-1 bg-transparent border-none outline-none font-geist-mono text-[16px] sm:text-[13px] placeholder:text-muted-foreground/50 min-w-0"
                placeholder={activeTerminalTab === 'cmd' ? t.typeCommand : (language === 'tr' ? 'Linux komutu yazın... (örn: ls, ifconfig, ping)' : 'Type linux command... (e.g. ls, ifconfig, ping)')}
                aria-label={t.typeCommand}
                autoComplete="off"
                spellCheck={false}
                disabled={isCmdInputDisabled}
              />
            </div>

            {isAutocompleteVisible && (
              <div
                ref={autocompleteRef}
                className="absolute bottom-20 left-4 z-20 w-[min(420px,calc(100%-2rem))]"
              >
                <div className={cn(
                  "rounded-lg border shadow-xl overflow-hidden",
                  isDark ? "bg-secondary-800 border-secondary-700" : "bg-white border-secondary-200"
                )}>
                  <div className={cn(
                    "flex items-center justify-between px-3 py-2 text-[11px] font-geist-mono font-semibold",
                    isDark ? 'text-secondary-200 bg-secondary-900/60' : 'text-secondary-700 bg-secondary-50'
                  )}>
                    <span>{activeTerminalTab === 'cmd' ? t.cmdSuggestions : (language === 'tr' ? 'Linux Komut ve Dosya Önerileri' : 'Linux Suggestions')}</span>
                    <span className={cn("text-[10px] font-bold", isDark ? 'text-accent-300' : 'text-accent-700')}>
                      ↑↓ {language === 'tr' ? 'Seç' : 'Navigate'} | Tab ↹ {t.completeWithTab}
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto overflow-x-hidden mobile-scroll custom-scrollbar font-geist-mono flex flex-col">
                    {activeTerminalTab === 'cmd' ? (
                      Array.isArray(renderAutocompleteSuggestions) ? (
                        (renderAutocompleteSuggestions as string[]).map((cmd, idx) => (
                          <button
                            key={`${cmd}-${idx}`}
                            type="button"
                            data-autocomplete-index={idx}
                            onClick={() => {
                              completeAutocompleteSelection(cmd);
                              inputRef.current?.focus();
                            }}
                            className={cn(
                              "w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between font-geist-mono",
                              idx === autocompleteIndex
                                ? (isDark ? "bg-accent-500/20 text-accent-300 font-semibold" : "bg-accent-50 text-accent-700 font-semibold")
                                : (isDark ? "text-secondary-300 hover:bg-secondary-700/50" : "text-secondary-700 hover:bg-secondary-100")
                            )}
                          >
                            <span>{cmd}</span>
                            {idx === autocompleteIndex && (
                              <span className="text-[10px] opacity-75">{language === 'tr' ? 'Seçildi' : 'Selected'}</span>
                            )}
                          </button>
                        ))
                      ) : (
                        renderAutocompleteSuggestions
                      )
                    ) : (
                      linuxFilteredSuggestions.map((cmd, idx) => (
                        <button
                          key={`${cmd}-${idx}`}
                          type="button"
                          data-autocomplete-index={idx}
                          onMouseEnter={() => setLinuxAutocompleteIndex(idx)}
                          onClick={() => {
                            let completedText = cmd;
                            if (cmd.includes(' ')) {
                              const parts = input.trim().split(/\s+/);
                              parts[parts.length - 1] = cmd;
                              completedText = parts.join(' ');
                            }
                            setInput(completedText + ' ');
                            setIsLinuxAutocompleteDismissed(true);
                            setLinuxAutocompleteIndex(-1);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between font-geist-mono",
                            idx === linuxAutocompleteIndex
                              ? (isDark ? "bg-accent-500/20 text-accent-300 font-semibold" : "bg-accent-50 text-accent-700 font-semibold")
                              : (isDark ? "text-secondary-300 hover:bg-secondary-700/50" : "text-secondary-700 hover:bg-secondary-100")
                          )}
                        >
                          <span>{cmd}</span>
                          {idx === linuxAutocompleteIndex && (
                            <span className="text-[10px] opacity-75">{language === 'tr' ? 'Seçildi' : 'Selected'}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isCmdInputDisabled}
              aria-label={t.typeCommand}
              className={cn(
                "shrink-0 rounded-xl shadow-lg px-3 text-white transition-colors",
                activeTerminalTab === 'cmd'
                  ? "bg-secondary-800 hover:bg-secondary-700 dark:bg-orange-600 dark:hover:bg-orange-500"
                  : "bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500",
                isMobile ? "h-9 text-xs" : "h-11 text-sm"
              )}
            >
              <span className="rounded-md p-1">
                <CornerDownLeft className={cn("w-4 h-4 text-white", isMobile && "w-3 h-3")} />
              </span>
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
