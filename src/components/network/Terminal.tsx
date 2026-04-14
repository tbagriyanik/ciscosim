'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback, useMemo, ClipboardEvent } from 'react';
import { useSwitchState } from '@/lib/store/appStore';
import { SwitchState } from '@/lib/network/types';
import { useLanguage, Translations } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TerminalOutput as TerminalOutputType } from './Terminal';
import { checkConnectivity, getWirelessSignalStrength, getDeviceWifiConfig } from '@/lib/network/connectivity';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Laptop, Monitor, Terminal as TerminalIcon, X, CornerDownLeft, Command, Globe, Network, ShieldCheck, History, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Copy, Save, Trash2, Download, Settings, Wifi } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from "@/hooks/use-toast";
import { commandHelp } from '@/lib/network/executor';
import { commandPatterns } from '@/lib/network/parser';
import { ModernPanel } from '@/components/ui/ModernPanel';
import { cn } from '@/lib/utils';
import { useIsMobile, useIsTablet, useIsDesktop } from '@/hooks/use-breakpoint';
import { QuickCommands } from './QuickCommands';
import type { CanvasDevice } from './networkTopology.types';

export interface TerminalOutput {
  id: string;
  type: 'command' | 'output' | 'error' | 'success' | 'password-prompt';
  content: string;
  prompt?: string;
  timestamp?: number;
}

export const BOOT_PROGRESS_MARKER = '\x00BOOT_PROGRESS\x00';

// Global set — animasyon tamamlanan boot id'lerini tutar, tab değişiminde sıfırlanmaz
const completedBootIds = new Set<string>();

function BootProgressBar({ id, isDark, onDone }: { id: string; isDark: boolean; onDone: (id: string) => void }) {
  const [filled, setFilled] = useState(0);
  const [done, setDone] = useState(false);
  const total = 9;

  useEffect(() => {
    if (filled < total) {
      const t = setTimeout(() => setFilled(f => f + 1), 220);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setDone(true);
        onDone(id);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [filled]);

  return (
    <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>
      {done ? (
        <span className="font-bold">{'#'.repeat(total)} Ready!</span>
      ) : (
        <span>{'#'.repeat(filled)}<span className="opacity-30">{'#'.repeat(total - filled)}</span></span>
      )}
    </span>
  );
}

interface TerminalProps {
  deviceId: string;
  deviceName: string;
  prompt: string;
  state: SwitchState;
  onCommand: (command: string) => Promise<void>;
  onClear: () => void;
  output: TerminalOutputType[];
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
  device?: CanvasDevice;
  devices?: CanvasDevice[];
  deviceStates?: Map<string, SwitchState>;
}

export type { TerminalProps };

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
  title,
  device,
  devices = [],
  deviceStates
}: TerminalProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(() => state.commandHistory || []);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('terminal-font-size') || '13', 10); } catch { return 13; }
  });

  // State for displaying output
  const [displayedLines, setDisplayedLines] = useState<Array<{ id: string, type: string, content: string, prompt?: string }>>([]);
  const processedOutputIdsRef = useRef<Set<string>>(new Set());
  const cancelOutputRef = useRef(false);

  // Undo/Redo state
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(-1);
  const [autocompleteNavigated, setAutocompleteNavigated] = useState(false);
  const [localPasswordPrompt, setLocalPasswordPrompt] = useState(false);

  const isDark = theme === 'dark';
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();

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
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const wasWifiConnectedRef = useRef<boolean>(true);

  const isInputDisabled = isLoading || isConnectionError;

  const commandQueueRef = useRef<string[]>([]);
  const isProcessingQueueRef = useRef(false);
  const historyRef = useRef<string[]>(state.commandHistory || []);
  const isLoadingRef = useRef<boolean>(isLoading);
  const awaitingPasswordRef = useRef<boolean>(!!state.awaitingPassword);
  const confirmDialogOpenRef = useRef<boolean>(!!confirmDialog?.show);
  const reloadConfirmPendingRef = useRef<boolean>(false);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    awaitingPasswordRef.current = !!state.awaitingPassword;
  }, [state.awaitingPassword]);

  useEffect(() => {
    confirmDialogOpenRef.current = !!confirmDialog?.show;
  }, [confirmDialog?.show]);

  // Check WiFi connectivity and close terminal if connection is lost
  useEffect(() => {
    if (!device || !devices || !deviceStates || !onClose) return;

    // Check if this device has WiFi and if it's connected
    if (device.type !== 'pc') return;

    // For PC devices, check WiFi signal strength
    const signalStrength = getWirelessSignalStrength(device, devices, deviceStates);
    const isCurrentlyConnected = signalStrength > 0;

    // If WiFi was connected before but is now disconnected, close terminal
    if (wasWifiConnectedRef.current && !isCurrentlyConnected) {
      onClose();
    }

    // Update the ref for next check
    wasWifiConnectedRef.current = isCurrentlyConnected;
  }, [device?.id, device?.type, devices?.length, deviceStates?.size]);

  const clearTerminalView = useCallback(() => {
    cancelOutputRef.current = true;
    processedOutputIdsRef.current.clear();
    setDisplayedLines([]);
    onClear();
  }, [onClear]);

  const queueCommands = useCallback((commands: string[]) => {
    const sanitized = commands
      .map((line) => line.replace(/\r/g, '').trim())
      .filter((line) => line.length > 0);

    if (sanitized.length === 0) return;
    commandQueueRef.current.push(...sanitized);
  }, []);

  const processCommandQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    try {
      while (commandQueueRef.current.length > 0) {
        const nextCommand = commandQueueRef.current.shift();
        if (!nextCommand) continue;

        const currentHistory = historyRef.current;
        if (currentHistory[0] !== nextCommand) {
          const newHistory = [nextCommand, ...currentHistory].slice(0, 50);
          historyRef.current = newHistory;
          setHistory(newHistory);
          if (onUpdateHistory) onUpdateHistory(deviceId, newHistory);
        }
        setHistoryIndex(-1);
        setTabCycleIndex(-1);
        setShowAutocomplete(false);
        setAutocompleteIndex(-1);

        await onCommand(nextCommand);

        // Wait until the command lifecycle is fully settled before next command.
        // This prevents pasted commands from overlapping.
        await new Promise((resolve) => setTimeout(resolve, 20));
        let guard = 0;
        while (isLoadingRef.current && guard < 600) {
          await new Promise((resolve) => setTimeout(resolve, 25));
          guard += 1;
        }

        // If command triggered an interactive mode, pause the queue.
        if (awaitingPasswordRef.current || confirmDialogOpenRef.current) {
          break;
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, [deviceId, onCommand, onUpdateHistory]);

  useEffect(() => {
    if (!showAutocomplete) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (autocompleteRef.current && target && !autocompleteRef.current.contains(target)) {
        setShowAutocomplete(false);
        setAutocompleteIndex(-1);
        setAutocompleteNavigated(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAutocomplete]);

  // Process output lines — show all at once, no artificial delays
  const prevFirstOutputIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (output.length === 0) {
      setDisplayedLines([]);
      processedOutputIdsRef.current.clear();
      prevFirstOutputIdRef.current = null;
      return;
    }

    // Detect a full output reset (boot/reload): first item id changed
    const firstId = output[0]?.id ?? null;
    if (firstId !== prevFirstOutputIdRef.current) {
      prevFirstOutputIdRef.current = firstId;
      setDisplayedLines([]);
      processedOutputIdsRef.current.clear();
      cancelOutputRef.current = false;
    }

    const newLines: Array<{ id: string; type: string; content: string; prompt?: string }> = [];

    for (const outputItem of output) {
      if (!outputItem || !outputItem.id) continue;
      if (processedOutputIdsRef.current.has(outputItem.id)) continue;
      processedOutputIdsRef.current.add(outputItem.id);

      if (outputItem.content && outputItem.content.includes('\n')) {
        const lines = outputItem.content.split('\n');
        lines.forEach((line, index) => {
          newLines.push({
            id: `${outputItem.id}-line-${index}`,
            type: outputItem.type,
            content: line,
            prompt: index === 0 ? outputItem.prompt : ''
          });
        });
      } else {
        newLines.push({
          id: outputItem.id,
          type: outputItem.type,
          content: outputItem.content,
          prompt: outputItem.prompt
        });
      }
    }

    if (newLines.length > 0) {
      setDisplayedLines(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        const toAdd = newLines.filter(l => !existingIds.has(l.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }
  }, [output]);

  // Clear displayed lines when switching devices
  useEffect(() => {
    setDisplayedLines([]);
    processedOutputIdsRef.current.clear();
    prevFirstOutputIdRef.current = null;
    commandQueueRef.current = [];
    isProcessingQueueRef.current = false;
  }, [deviceId]);

  const isReloadConfirmationPending = false;

  // Command Context for Autocomplete
  const expandCommandContext = useCallback((mode: keyof typeof commandHelp, rawValue: string) => {
    const helpTree = commandHelp[mode] || commandHelp.user;
    const tokens = rawValue.trim().split(/\s+/).filter(Boolean);
    const hasTrailingSpace = rawValue.endsWith(' ');
    const contextTokens = hasTrailingSpace ? tokens : tokens.slice(0, -1);
    const currentWord = hasTrailingSpace ? '' : (tokens[tokens.length - 1] || '').toLowerCase();
    const contextKey = contextTokens.join(' ').toLowerCase();

    // 1. Try commandHelp tree first
    let candidates: string[] = contextTokens.length === 0
      ? helpTree[''] || []
      : helpTree[contextKey] || [];

    // 2. Fallback: derive from commandPatterns for multi-word prefixes (e.g. "no ip", "do ping")
    if (candidates.length === 0 && contextKey) {
      const patternCandidates: string[] = [];
      for (const [name, pattern] of Object.entries(commandPatterns)) {
        if (!pattern.modes.includes(mode as any)) continue;
        const nameLower = name.toLowerCase();
        const prefix = contextKey + ' ';
        if (!nameLower.startsWith(prefix)) continue;
        const remaining = nameLower.substring(prefix.length).trim();
        if (!remaining) continue;
        const nextWord = remaining.split(' ')[0];
        if (nextWord && !patternCandidates.includes(nextWord)) {
          patternCandidates.push(nextWord);
        }
      }
      candidates = patternCandidates;
    }

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
      requestAnimationFrame(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      });
    }
    inputRef.current?.focus();
  }, [output, isLoading, deviceId]);

  // Auto-scroll when displayedLines updates (handles async content rendering)
  useEffect(() => {
    requestAnimationFrame(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    });
    // Additional scroll to ensure it reaches the end
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, 50);
  }, [displayedLines]);

  useEffect(() => {
    if (state.awaitingPassword || confirmDialog?.show || isReloadConfirmationPending) {
      setInput('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [state.awaitingPassword, confirmDialog?.show, isReloadConfirmationPending]);

  useEffect(() => {
    // Keep password mode strictly tied to live device state.
    // Old password-prompt lines can remain in output history and must not lock input.
    setLocalPasswordPrompt(!!state.awaitingPassword);
  }, [state.awaitingPassword]);

  const handleSubmit = async (cmdToExecute?: string) => {
    // Password mode: send whatever is typed (including empty) as password
    if (state.awaitingPassword || localPasswordPrompt) {
      const pwd = cmdToExecute ?? input;
      setInput('');
      await onCommand(pwd);
      return;
    }

    // Handle confirmation dialog - trigger inline confirmation or cancel
    if (confirmDialog?.show) {
      const trimmedInput = (cmdToExecute || input).trim().toLowerCase();
      setInput('');
      // 'n' or 'no' cancels the operation
      if (trimmedInput === 'n' || trimmedInput === 'no') {
        if (setConfirmDialog) {
          setConfirmDialog(null);
        }
        return;
      }
      // Any other input (including empty, 'confirm', 'y', 'yes') confirms
      if (confirmDialog.onConfirm) {
        confirmDialog.onConfirm();
      }
      return;
    }

    const command = (cmdToExecute || input).trim();
    if (!command || isInputDisabled) return;

    if (history[0] !== command) {
      const newHistory = [command, ...history].slice(0, 50);
      setHistory(newHistory);
      if (onUpdateHistory) onUpdateHistory(deviceId, newHistory);
    }
    setHistoryIndex(-1);
    setTabCycleIndex(-1);
    setInput('');
    setShowAutocomplete(false);
    setAutocompleteIndex(-1);
    await onCommand(command);
    // Scroll to input field after command execution
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleSubmit();
  };

  const handlePaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText || !pastedText.includes('\n')) return;

    e.preventDefault();
    queueCommands(pastedText.split('\n'));
    setInput('');
    void processCommandQueue();
  }, [processCommandQueue, queueCommands]);

  const getAutocompleteContext = useCallback((value: string) => {
    const mode = state.currentMode;
    const base = expandCommandContext(mode, value);
    const helpTree = commandHelp[mode] || commandHelp.user || {};
    const contextKey = base.contextTokens.join(' ').toLowerCase();

    if (contextKey === 'conf' && helpTree['configure']) {
      return {
        ...base,
        candidates: helpTree['configure'],
        contextTokens: ['configure']
      };
    }

    return base;
  }, [state.currentMode, expandCommandContext]);

  const handleTabComplete = useCallback(() => {
    const value = input;
    if (!value && tabCycleIndex === -1) return;

    const isIpv4 = (raw: string) => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(raw);
    const trimmed = value.trim();
    const hasTrailingSpace = /\s$/.test(value);

    const ipAddressMatch = trimmed.match(/^ip\s+address\s+(\S+)(?:\s+(\S+))?$/i);
    if (ipAddressMatch) {
      const ip = ipAddressMatch[1];
      const mask = ipAddressMatch[2];
      if (isIpv4(ip) && !mask) {
        setInput(`ip address ${ip} 255.255.255.0`);
        setTabCycleIndex(-1);
        return;
      }
      if (isIpv4(ip) && mask && isIpv4(mask) && !hasTrailingSpace) {
        setInput(`${trimmed} `);
        setTabCycleIndex(-1);
        return;
      }
    }

    const singleIpArgMatch = trimmed.match(/^(?:ip\s+default-gateway|ping|http|telnet|ssh)\s+(\S+)$/i);
    if (singleIpArgMatch && isIpv4(singleIpArgMatch[1]) && !hasTrailingSpace) {
      setInput(`${trimmed} `);
      setTabCycleIndex(-1);
      return;
    }

    const networkMatch = trimmed.match(/^network\s+(\S+)(?:\s+(\S+))?$/i);
    if (networkMatch) {
      const netIp = networkMatch[1];
      const mask = networkMatch[2];
      if (isIpv4(netIp) && !mask) {
        setInput(`network ${netIp} 255.255.255.0`);
        setTabCycleIndex(-1);
        return;
      }
      if (isIpv4(netIp) && mask && isIpv4(mask) && !hasTrailingSpace) {
        setInput(`${trimmed} `);
        setTabCycleIndex(-1);
        return;
      }
    }

    const dhcpSingleIpArgMatch = trimmed.match(/^(?:default-router|dns-server)\s+(\S+)$/i);
    if (dhcpSingleIpArgMatch && isIpv4(dhcpSingleIpArgMatch[1]) && !hasTrailingSpace) {
      setInput(`${trimmed} `);
      setTabCycleIndex(-1);
      return;
    }

    const { candidates, currentWord, contextTokens } = getAutocompleteContext(value);
    const matches = candidates.filter(
      opt => opt !== '?' && opt.toLowerCase().startsWith(currentWord)
    );

    if (matches.length > 0) {
      if (tabCycleIndex === -1) {
        setLastTabInput(value);
        setTabCycleIndex(0);
        const completion = matches[0];
        const prefix = contextTokens.join(' ');
        setInput(prefix ? `${prefix} ${completion} ` : `${completion} `);
      } else {
        const nextIndex = (tabCycleIndex + 1) % matches.length;
        setTabCycleIndex(nextIndex);
        const originalParts = lastTabInput.split(/\s+/);
        const originalContext = lastTabInput.endsWith(' ') ? lastTabInput.trim() : originalParts.slice(0, -1).join(' ');
        const completion = matches[nextIndex];
        setInput(originalContext ? `${originalContext} ${completion} ` : `${completion} `);
      }
    } else if (value.trim()) {
      // No matches - trigger help by appending ?
      onCommand(value.trim() + ' ?');
    }
  }, [input, tabCycleIndex, lastTabInput, getAutocompleteContext, onCommand]);

  // Undo/Redo helpers
  const handleUndo = useCallback(() => {
    if (undoStack.length > 0) {
      const newUndoStack = [...undoStack];
      const previousInput = newUndoStack.pop() || '';
      setRedoStack([input, ...redoStack]);
      setInput(previousInput);
      setUndoStack(newUndoStack);
    }
  }, [input, undoStack, redoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length > 0) {
      const newRedoStack = [...redoStack];
      const nextInput = newRedoStack.shift() || '';
      setUndoStack([...undoStack, input]);
      setInput(nextInput);
      setRedoStack(newRedoStack);
    }
  }, [input, undoStack, redoStack]);

  const getAutocompleteSuggestions = useCallback((value: string) => {
    const isIpv4 = (raw: string) => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(raw);
    const collectKnownIps = () => {
      const fromDevices = (devices || [])
        .map((d) => d.ip)
        .filter((ip): ip is string => !!ip && isIpv4(ip) && ip !== '0.0.0.0' && ip !== '169.254.0.0');
      const fromStates = Array.from(deviceStates?.values() || [])
        .flatMap((s) => Object.values(s.ports || {}).map((p: any) => p?.ipAddress))
        .filter((ip): ip is string => !!ip && isIpv4(ip) && ip !== '0.0.0.0' && ip !== '169.254.0.0');
      return Array.from(new Set([...fromDevices, ...fromStates]));
    };

    const { candidates, currentWord } = getAutocompleteContext(value);
    const baseSuggestions = candidates.filter(
      opt => opt !== '?' && opt.toLowerCase().startsWith(currentWord)
    );

    const trimmed = value.trim();
    const expectsIpArg = /^(?:telnet|ssh|ping|http|ip\s+default-gateway|default-router|dns-server)\s+\S*$/i.test(trimmed)
      || /^(?:telnet|ssh|ping|http|ip\s+default-gateway|default-router|dns-server)\s*$/i.test(trimmed);

    if (!expectsIpArg) {
      return baseSuggestions.slice(0, 8);
    }

    const knownIps = collectKnownIps().filter((ip) => ip.toLowerCase().startsWith(currentWord));
    const merged = Array.from(new Set([...knownIps, ...baseSuggestions]));
    return merged.slice(0, 8);
  }, [getAutocompleteContext, devices, deviceStates]);

  const renderAutocompleteSuggestions = useMemo(
    () => getAutocompleteSuggestions(input),
    [getAutocompleteSuggestions, input]
  );

  const shouldShowAutocomplete = useMemo(
    () => showAutocomplete && input.trim().length > 0 && renderAutocompleteSuggestions.length > 0,
    [showAutocomplete, input, renderAutocompleteSuggestions]
  );

  const handleInputChange = useCallback((newValue: string) => {
    setUndoStack([...undoStack, input]);
    setRedoStack([]);
    setInput(newValue);
    setAutocompleteNavigated(false);

    // Autocomplete logic
    if (newValue.trim().length > 0) {
      const suggestions = getAutocompleteSuggestions(newValue);
      if (suggestions.length > 0) {
        setShowAutocomplete(true);
        setAutocompleteIndex(-1);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  }, [input, undoStack, getAutocompleteSuggestions]);

  const buildCompletedInput = useCallback((selected: string) => {
    const { contextTokens } = getAutocompleteContext(input);
    const prefix = contextTokens.join(' ');
    return prefix ? `${prefix} ${selected} ` : `${selected} `;
  }, [input, getAutocompleteContext]);

  const completeAutocompleteSelection = useCallback((selected: string) => {
    const completed = buildCompletedInput(selected);
    setInput(completed);
    setShowAutocomplete(false);
    setAutocompleteIndex(-1);
    setAutocompleteNavigated(false);
    return completed;
  }, [buildCompletedInput]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const autocompleteSuggestions = renderAutocompleteSuggestions;
    const canUseAutocomplete = showAutocomplete && autocompleteSuggestions.length > 0;

    // Terminal clear shortcut
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setInput('');
      setShowAutocomplete(false);
      setAutocompleteIndex(-1);
      setAutocompleteNavigated(false);
      clearTerminalView();
      return;
    }

    if (e.key === 'Enter') {
      if (canUseAutocomplete && autocompleteNavigated) {
        e.preventDefault();
        const completed = completeAutocompleteSelection(autocompleteSuggestions[autocompleteIndex] || autocompleteSuggestions[0]);
        void handleSubmit(completed);
        return;
      }
      e.preventDefault();
      void handleSubmit();
      return;
    }
    // Escape cancels password/confirm and returns to normal input
    if (e.key === 'Escape') {
      if (state.awaitingPassword || confirmDialog?.show || isReloadConfirmationPending) {
        e.preventDefault();
        if (onCommand) {
          if (state.awaitingPassword) {
            onCommand('__PASSWORD_CANCELLED__');
          } else if (isReloadConfirmationPending) {
            // Send 'n' to cancel reload
            onCommand('n');
          }
        }
        if (state.awaitingPassword || localPasswordPrompt) {
          setLocalPasswordPrompt(false);
        }
        setInput('');
        return;
      }
    }
    // Block history/tab navigation during password/confirm modes
    if (state.awaitingPassword || localPasswordPrompt || confirmDialog?.show) return;

    // Handle Ctrl+Z (Undo)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }

    // Handle Ctrl+Y (Redo)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Handle Ctrl+A (Select All)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      if (inputRef.current) {
        inputRef.current.select();
      }
      return;
    }

    // Handle Ctrl+X (Cut)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      if (inputRef.current && input) {
        const start = inputRef.current.selectionStart || 0;
        const end = inputRef.current.selectionEnd || 0;
        if (start !== end) {
          const selectedText = input.substring(start, end);
          navigator.clipboard.writeText(selectedText).then(() => {
            const newInput = input.substring(0, start) + input.substring(end);
            setInput(newInput);
          });
        }
      }
      return;
    }

    // Handle Ctrl+C (Copy)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      if (inputRef.current && input) {
        const start = inputRef.current.selectionStart || 0;
        const end = inputRef.current.selectionEnd || 0;
        if (start !== end) {
          const selectedText = input.substring(start, end);
          navigator.clipboard.writeText(selectedText);
        } else if (input) {
          // If no selection, copy all
          navigator.clipboard.writeText(input);
        }
      }
      return;
    }

    // Handle Ctrl+V (Paste)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        if (text && text.includes('\n')) {
          queueCommands(text.split('\n'));
          setInput('');
          void processCommandQueue();
          return;
        }

        if (inputRef.current) {
          const start = inputRef.current.selectionStart || 0;
          const end = inputRef.current.selectionEnd || 0;
          const newInput = input.substring(0, start) + text + input.substring(end);
          setInput(newInput);
          // Move cursor to end of pasted text
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(start + text.length, start + text.length);
            }
          }, 0);
        }
      }).catch(() => {
        // Clipboard access denied, silently fail
      });
      return;
    }

    if (e.key === 'ArrowUp') {
      if (canUseAutocomplete) {
        e.preventDefault();
        setAutocompleteIndex(prev => {
          if (prev === -1) return autocompleteSuggestions.length - 1;
          return prev <= 0 ? autocompleteSuggestions.length - 1 : prev - 1;
        });
        setAutocompleteNavigated(true);
        return;
      }
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const ni = historyIndex + 1;
        setHistoryIndex(ni);
        setInput(history[ni]);
      }
    } else if (e.key === 'ArrowDown') {
      if (canUseAutocomplete) {
        e.preventDefault();
        setAutocompleteIndex(prev => {
          if (prev === -1) return 0;
          return (prev + 1) % autocompleteSuggestions.length;
        });
        setAutocompleteNavigated(true);
        return;
      }
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
      if (canUseAutocomplete) {
        completeAutocompleteSelection(autocompleteSuggestions[autocompleteIndex] || autocompleteSuggestions[0]);
        return;
      }
      handleTabComplete();
    } else if (e.key === 'Escape') {
      if (showAutocomplete) {
        e.preventDefault();
        setShowAutocomplete(false);
        setAutocompleteIndex(-1);
        setAutocompleteNavigated(false);
        return;
      }
      e.preventDefault();
      clearTerminalView();
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

  // Calculate WiFi signal strength for devices with WiFi
  const wifiSignalStrength = useMemo(() => {
    if (!device) return null;
    const wifi = getDeviceWifiConfig(device, deviceStates);
    if (!wifi || !wifi.enabled) return null;

    // AP mode devices always show full signal (they are broadcasting)
    if (wifi.mode === 'ap') return 5;

    // Client mode devices show signal based on distance to AP
    if (device.type === 'pc' && (wifi.mode === 'client' || wifi.mode === 'sta')) {
      return getWirelessSignalStrength(device, devices, deviceStates);
    }

    return null;
  }, [device, devices, deviceStates]);

  const getSignalIcon = (strength: number) => {
    if (strength === 0) return null;
    const bars = Math.ceil(strength);
    return (
      <div className="flex items-center gap-1">
        <Wifi className={cn(
          "w-4 h-4",
          strength >= 4 ? "text-emerald-500" :
            strength >= 3 ? "text-yellow-500" :
              strength >= 2 ? "text-orange-500" :
                "text-rose-500"
        )} />
        <span className={cn(
          "text-[10px] font-black tracking-wider",
          strength >= 4 ? "text-emerald-500" :
            strength >= 3 ? "text-yellow-500" :
              strength >= 2 ? "text-orange-500" :
                "text-rose-500"
        )}>
          {strength === 5 ? "100%" :
            strength === 4 ? "75%" :
              strength === 3 ? "50%" :
                strength === 2 ? "25%" :
                  "1%"}
        </span>
      </div>
    );
  };

  const headerAction = (
    <div className="flex items-center gap-1">
      {wifiSignalStrength !== null && wifiSignalStrength > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="h-8 px-2 flex items-center rounded-lg">
              {getSignalIcon(wifiSignalStrength)}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {t.wifiSignal}
          </TooltipContent>
        </Tooltip>
      )}
      {wifiSignalStrength !== null && wifiSignalStrength > 0 && (
        <div className="w-px h-4 bg-border mx-1" />
      )}
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
        <TooltipContent>{t.exportLabel}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)} className={cn("h-8 w-8 rounded-lg", showSettings && "bg-accent")}>
            <Settings className="w-4 h-4" />
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
      collapsible={false}
      noPadding
      className={cn("flex flex-col h-full", className)}
    >
      <div className="flex flex-col h-full overflow-hidden bg-background">
        {/* Settings Bar */}
        {showSettings && (
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-4 animate-in slide-in-from-top-2">
            <label className="text-[10px] font-black tracking-widest text-muted-foreground whitespace-nowrap">
              {t.fontSizeLabel}: {fontSize}px
            </label>
            <input
              type="range" min="10" max="20" value={fontSize}
              onChange={(e) => { const v = parseInt(e.target.value); setFontSize(v); try { localStorage.setItem('terminal-font-size', String(v)); } catch { } }}
              className="flex-1 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <Button variant="ghost" size="sm" onClick={clearTerminalView} className="h-7 text-[10px] font-black  tracking-widest text-rose-500">
              <Trash2 className="w-3 h-3 mr-1" /> {t.clearTerminalBtn}
            </Button>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 relative">
          <div
            ref={terminalRef}
            className={cn(
              "flex-1 overflow-y-auto font-mono leading-relaxed custom-scrollbar mobile-scroll",
              isMobile ? "p-3 pb-32" : "p-6 pb-32",
              isPoweredOff ? "bg-black" : (isDark ? "bg-slate-950" : "bg-slate-50")
            )}
            style={{ fontSize: `${fontSize}px` }}
          >
            {isPoweredOff ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <svg className="w-16 h-16 text-red-600 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.36 5.64a9 9 0 1 1-12.73 0" />
                </svg>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Show all output with natural scrolling */}
                {displayedLines.filter(line => line != null).map((line, i) => (
                  <div key={line.id} className="animate-in fade-in slide-in-from-left-1 duration-200">
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
                        {line.content === BOOT_PROGRESS_MARKER
                          ? (completedBootIds.has(line.id)
                            ? <span className={isDark ? 'text-emerald-400 font-bold' : 'text-emerald-600 font-bold'}>{'#'.repeat(10)} Ready!</span>
                            : <BootProgressBar key={line.id} id={line.id} isDark={isDark} onDone={(id) => { completedBootIds.add(id); }} />)
                          : highlightText(line.content)}
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-primary/50 italic py-1 animate-pulse">
                    <span className="text-[10px] font-black tracking-widest">{t.processing}...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isPoweredOff && (
            <div className={cn(
              "shrink-0 z-10 border-t bg-muted/95 backdrop-blur-sm sticky bottom-0",
              isMobile ? "p-2" : "p-3"
            )}>
              <form onSubmit={handleFormSubmit} className="flex items-center gap-3 relative">
                {/* Contextual hint above input for confirm/reload states */}
                {(confirmDialog?.show || isReloadConfirmationPending) && (
                  <div className="absolute -top-7 left-4 right-4 text-[10px] font-black tracking-widest text-amber-400 animate-pulse">
                    {confirmDialog?.show
                      ? (confirmDialog.message || t.pressEnterToConfirm)
                      : `${t.pressEnterToConfirm} [confirm]`}
                  </div>
                )}
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 bg-background rounded-lg border flex-1 group focus-within:ring-1 transition-all shadow-inner",
                  state.awaitingPassword || localPasswordPrompt
                    ? "border-amber-500/50 focus-within:ring-amber-500/50"
                    : confirmDialog?.show || isReloadConfirmationPending
                      ? "border-amber-500/50 focus-within:ring-amber-500/50"
                      : "border-input focus-within:ring-primary/50",
                  isMobile && "px-3 py-2"
                )}>
                  <span className={cn(
                    "font-bold text-xs select-none opacity-40 group-focus-within:opacity-100 transition-opacity shrink-0",
                    state.awaitingPassword || localPasswordPrompt || confirmDialog?.show || isReloadConfirmationPending
                      ? "text-amber-400"
                      : "text-primary"
                  )}>
                    {state.awaitingPassword || localPasswordPrompt
                      ? (language === 'tr' ? 'Parola:' : 'Password:')
                      : confirmDialog?.show || isReloadConfirmationPending
                        ? '[confirm]'
                        : prompt}
                  </span>
                  <input
                    ref={inputRef}
                    type={state.awaitingPassword || localPasswordPrompt ? 'password' : 'text'}
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      // Scroll input into view on mobile when keyboard opens
                      if (isMobile) {
                        setTimeout(() => {
                          inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }, 300);
                      }
                    }}
                    disabled={isInputDisabled}
                    className="flex-1 bg-transparent border-none outline-none font-mono text-[13px] placeholder:text-muted-foreground/50"
                    placeholder={
                      state.awaitingPassword || localPasswordPrompt
                        ? t.enterPassword
                        : confirmDialog?.show || isReloadConfirmationPending
                          ? t.typeCommandPlaceholder
                          : t.typeCommand
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                {(state.awaitingPassword || localPasswordPrompt || confirmDialog?.show || isReloadConfirmationPending) && (
                  <Button
                    type="button"
                    disabled={isInputDisabled}
                    size="icon"
                    variant="ghost"
                    className="shrink-0 rounded-xl hover:bg-rose-500/20 text-rose-500"
                    onClick={() => {
                      if (onCommand) {
                        if (state.awaitingPassword || localPasswordPrompt) {
                          onCommand('__PASSWORD_CANCELLED__');
                        } else if (isReloadConfirmationPending) {
                          // Send 'n' to cancel reload
                          onCommand('n');
                        }
                      }
                      if (state.awaitingPassword || localPasswordPrompt) {
                        setLocalPasswordPrompt(false);
                      }
                      setInput('');
                    }}
                    title={t.cancel}
                  >
                    <X className={cn("w-5 h-5", isMobile && "w-4 h-4")} />
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isInputDisabled}
                  size="icon"
                  className={cn(
                    "shrink-0 rounded-xl shadow-lg",
                    isMobile ? "h-9 w-9" : "h-11 w-11",
                    (state.awaitingPassword || localPasswordPrompt || confirmDialog?.show || isReloadConfirmationPending) && "bg-amber-500 hover:bg-amber-600"
                  )}
                >
                  <CornerDownLeft className={cn("w-5 h-5", isMobile && "w-4 h-4")} />
                </Button>
              </form>

              {/* Autocomplete Dropdown */}
              {shouldShowAutocomplete && (
                <div
                  ref={autocompleteRef}
                  className="absolute bottom-20 left-4 z-20 w-[min(420px,calc(100%-2rem))]"
                >
                  <div className={cn(
                    "rounded-lg border shadow-xl overflow-hidden",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                  )}>
                    <div className="max-h-40 overflow-y-auto">
                      {renderAutocompleteSuggestions.map((cmd, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            completeAutocompleteSelection(cmd);
                            inputRef.current?.focus();
                          }}
                          className={cn(
                            "w-full text-left px-2.5 py-1 text-[11px] font-mono transition-colors",
                            autocompleteIndex >= 0 && idx === autocompleteIndex
                              ? (isDark ? "bg-cyan-500/20 text-cyan-200" : "bg-cyan-50 text-cyan-900")
                              : (isDark ? "text-slate-300 hover:bg-primary/10" : "text-slate-700 hover:bg-primary/10")
                          )}
                        >
                          {cmd}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.search}</DialogTitle>
            <DialogDescription>
              {t.searchTerminal}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search + "..."}
              className="pr-9"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* ... Password and Confirm Dialogs ... */}
    </ModernPanel>
  );
}
