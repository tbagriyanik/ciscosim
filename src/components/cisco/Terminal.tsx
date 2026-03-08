'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SwitchState } from '@/lib/cisco/types';
import { Translations } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { CornerDownLeft, Terminal as TerminalIcon, Trash2, Command, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { QuickCommands } from './QuickCommands';

interface TerminalProps {
  deviceId: string;
  deviceName: string;
  prompt: string;
  state: SwitchState;
  onCommand: (command: string) => Promise<void>;
  onClear: () => void;
  output: any[];
  isLoading: boolean;
  t: Translations;
  theme: string;
  language: string;
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
  t,
  theme,
  language
}: TerminalProps) {
  const [input, setInput] = useState('');
  const [showHelper, setShowHelper] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';

  // Otomatik odaklanma ve kaydırma
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
    inputRef.current?.focus();
  }, [output, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const command = input.trim();
    setInput('');
    await onCommand(command);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const terminalBg = isDark ? 'bg-black shadow-inner' : 'bg-slate-950 shadow-lg';

  return (
    <div className="flex flex-col flex-1 gap-4 overflow-hidden">
      <Card className={`${cardBg} shadow-xl border-t-4 border-t-cyan-500 rounded-xl overflow-hidden flex flex-col flex-1`}>
        <CardHeader className="py-3 px-5 border-b border-slate-800/50 bg-slate-800/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
                <TerminalIcon className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm font-black tracking-tight flex items-center gap-2">
                <span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{deviceName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">CLI</span>
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowHelper(!showHelper)}
                className={`h-8 px-2.5 text-[11px] font-bold transition-colors gap-1.5 ${showHelper ? 'text-cyan-400' : 'text-slate-500'}`}
              >
                <Info className="w-3.5 h-3.5" />
                {showHelper ? (language === 'tr' ? 'Yardımı Gizle' : 'Hide Help') : (language === 'tr' ? 'Yardım' : 'Help')}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClear}
                className="h-8 px-2.5 text-[11px] font-bold text-slate-500 hover:text-rose-400 transition-colors gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.clearTerminalBtn}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden relative min-h-0">
          <div
            ref={terminalRef}
            className={`flex-1 overflow-y-auto p-5 font-mono text-[13px] leading-relaxed scroll-smooth custom-scrollbar ${terminalBg}`}
          >
            <div className="space-y-1.5">
              {output.map((line, index) => (
                <div key={line.id || index} className="animate-in fade-in slide-in-from-left-1 duration-200">
                  {line.type === 'command' ? (
                    <div className="flex gap-2.5 text-cyan-400 font-bold group">
                      <span className="shrink-0 opacity-50 select-none">{line.prompt || prompt}</span>
                      <span className="text-slate-100">{line.content}</span>
                    </div>
                  ) : (
                    <div className={`whitespace-pre-wrap ${
                      line.type === 'error' ? 'text-rose-400 font-medium' : 
                      line.type === 'success' ? 'text-emerald-400' : 
                      'text-slate-300'
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
          <div className={`p-3 border-t ${isDark ? 'border-slate-800 bg-slate-900/50' : 'bg-slate-100/50 border-slate-200'}`}>
            <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-full">
              <div className="flex items-center gap-2 px-3 py-2 bg-black/40 rounded-lg border border-slate-700/50 flex-1 group focus-within:border-cyan-500/50 transition-all">
                <span className="text-cyan-500 font-bold text-xs select-none shrink-0 group-focus-within:opacity-100 transition-opacity">
                  {prompt}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="flex-1 bg-transparent border-none outline-none text-slate-100 font-mono text-[13px] placeholder:text-slate-700 w-full"
                  placeholder={t.typeCommand}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                />
                <div className="hidden sm:flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-slate-800 bg-slate-800/50 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                  <Command className="w-2.5 h-3.5" />
                  Enter
                </div>
              </div>
              
              <Button 
                type="submit"
                disabled={isLoading || !input.trim()}
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

      {showHelper && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <QuickCommands
            currentMode={state.currentMode}
            onExecuteCommand={onCommand}
            t={t}
            theme={theme}
            language={language}
          />
        </motion.div>
      )}
    </div>
  );
}
