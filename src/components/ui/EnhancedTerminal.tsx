'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Copy, Download, Settings } from 'lucide-react';

export interface TerminalCommand {
    id: string;
    command: string;
    output: string;
    timestamp: number;
    type: 'command' | 'output' | 'error' | 'success';
}

export interface EnhancedTerminalProps {
    onCommand?: (command: string) => Promise<string>;
    theme?: 'dark' | 'light';
    fontSize?: number;
    fontFamily?: string;
    className?: string;
}

const COMMAND_HISTORY_KEY = 'terminal-command-history';
const MAX_HISTORY = 100;

export function EnhancedTerminal({
    onCommand,
    theme = 'dark',
    fontSize = 14,
    fontFamily = 'monospace',
    className,
}: EnhancedTerminalProps) {
    const [commands, setCommands] = useState<TerminalCommand[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [history, setHistory] = useState<string[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [fontSize_, setFontSize_] = useState(fontSize);
    const inputRef = useRef<HTMLInputElement>(null);
    const terminalRef = useRef<HTMLDivElement>(null);

    // Load command history from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(COMMAND_HISTORY_KEY);
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load command history:', e);
            }
        }
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [commands]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const saveToHistory = useCallback((command: string) => {
        setHistory((prev) => {
            const updated = [command, ...prev.filter((c) => c !== command)].slice(0, MAX_HISTORY);
            localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    const executeCommand = useCallback(
        async (command: string) => {
            if (!command.trim()) return;

            setIsExecuting(true);
            saveToHistory(command);

            const commandId = `cmd-${Date.now()}`;
            setCommands((prev) => [
                ...prev,
                {
                    id: commandId,
                    command,
                    output: '',
                    timestamp: Date.now(),
                    type: 'command',
                },
            ]);

            try {
                let output = '';
                if (onCommand) {
                    output = await onCommand(command);
                } else {
                    output = `Command executed: ${command}`;
                }

                setCommands((prev) =>
                    prev.map((c) =>
                        c.id === commandId
                            ? {
                                ...c,
                                output,
                                type: output.includes('error') ? 'error' : 'success',
                            }
                            : c
                    )
                );
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                setCommands((prev) =>
                    prev.map((c) =>
                        c.id === commandId
                            ? {
                                ...c,
                                output: errorMsg,
                                type: 'error',
                            }
                            : c
                    )
                );
            } finally {
                setIsExecuting(false);
                setCurrentInput('');
                setHistoryIndex(-1);
            }
        },
        [onCommand, saveToHistory]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeCommand(currentInput);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const newIndex = Math.min(historyIndex + 1, history.length - 1);
            setHistoryIndex(newIndex);
            if (newIndex >= 0) {
                setCurrentInput(history[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            if (newIndex >= 0) {
                setCurrentInput(history[newIndex]);
            } else {
                setCurrentInput('');
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            // Simple autocompletion - suggest commands from history
            const matches = history.filter((h) => h.startsWith(currentInput));
            if (matches.length > 0) {
                setCurrentInput(matches[0]);
            }
        }
    };

    const copyToClipboard = () => {
        const text = commands.map((c) => `${c.command}\n${c.output}`).join('\n\n');
        navigator.clipboard.writeText(text);
    };

    const exportTerminal = () => {
        const text = commands.map((c) => `${c.command}\n${c.output}`).join('\n\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `terminal-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const clearTerminal = () => {
        setCommands([]);
    };

    const isDark = theme === 'dark';

    return (
        <div
            className={cn(
                'flex flex-col h-full rounded-lg border',
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200',
                className
            )}
        >
            {/* Toolbar */}
            <div className={cn('flex items-center gap-2 p-3 border-b', isDark ? 'border-slate-700' : 'border-slate-200')}>
                <button
                    onClick={copyToClipboard}
                    className={cn(
                        'p-1 rounded hover:bg-opacity-20 hover:bg-white transition-colors',
                        isDark ? 'text-slate-300' : 'text-slate-700'
                    )}
                    title="Copy output"
                >
                    <Copy className="w-4 h-4" />
                </button>
                <button
                    onClick={exportTerminal}
                    className={cn(
                        'p-1 rounded hover:bg-opacity-20 hover:bg-white transition-colors',
                        isDark ? 'text-slate-300' : 'text-slate-700'
                    )}
                    title="Export terminal"
                >
                    <Download className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={cn(
                        'p-1 rounded hover:bg-opacity-20 hover:bg-white transition-colors',
                        isDark ? 'text-slate-300' : 'text-slate-700'
                    )}
                    title="Settings"
                >
                    <Settings className="w-4 h-4" />
                </button>
                <div className="flex-1" />
                <button
                    onClick={clearTerminal}
                    className={cn(
                        'px-2 py-1 text-xs rounded hover:bg-opacity-20 hover:bg-white transition-colors',
                        isDark ? 'text-slate-300' : 'text-slate-700'
                    )}
                >
                    Clear
                </button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className={cn('p-3 border-b', isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                    <div className="flex items-center gap-2">
                        <label className={cn('text-sm', isDark ? 'text-slate-300' : 'text-slate-700')}>
                            Font Size:
                        </label>
                        <input
                            type="range"
                            min="10"
                            max="20"
                            value={fontSize_}
                            onChange={(e) => setFontSize_(parseInt(e.target.value))}
                            className="flex-1"
                        />
                        <span className={cn('text-sm', isDark ? 'text-slate-300' : 'text-slate-700')}>
                            {fontSize_}px
                        </span>
                    </div>
                </div>
            )}

            {/* Terminal Output */}
            <div
                ref={terminalRef}
                className={cn(
                    'flex-1 overflow-y-auto p-3 font-mono text-sm',
                    isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'
                )}
                style={{ fontSize: `${fontSize_}px`, fontFamily }}
            >
                {commands.length === 0 ? (
                    <div className={cn('text-center py-8', isDark ? 'text-slate-500' : 'text-slate-400')}>
                        Terminal ready. Type a command and press Enter.
                    </div>
                ) : (
                    commands.map((cmd) => (
                        <div key={cmd.id} className="mb-2">
                            <div className={cn('flex items-center gap-2', isDark ? 'text-green-400' : 'text-green-600')}>
                                <span>$</span>
                                <span>{cmd.command}</span>
                            </div>
                            <div
                                className={cn(
                                    'ml-4 whitespace-pre-wrap break-words',
                                    cmd.type === 'error'
                                        ? isDark
                                            ? 'text-red-400'
                                            : 'text-red-600'
                                        : isDark
                                            ? 'text-slate-300'
                                            : 'text-slate-700'
                                )}
                            >
                                {cmd.output}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Input */}
            <div
                className={cn(
                    'sticky bottom-0 flex items-center gap-2 p-3 border-t backdrop-blur-sm',
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                )}
            >
                <span className={cn('font-mono', isDark ? 'text-green-400' : 'text-green-600')}>$</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isExecuting}
                    className={cn(
                        'flex-1 bg-transparent outline-none font-mono text-sm',
                        isDark ? 'text-slate-100' : 'text-slate-900'
                    )}
                    placeholder="Enter command..."
                />
                {isExecuting && (
                    <div className="animate-spin">
                        <ChevronDown className="w-4 h-4" />
                    </div>
                )}
            </div>
        </div>
    );
}
