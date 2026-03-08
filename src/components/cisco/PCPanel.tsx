'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback, useMemo } from 'react';
import { CableInfo, isCableCompatible, SwitchState } from '@/lib/cisco/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface OutputLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'success' | 'prompt';
  content: string;
  prompt?: string;
}

interface PCPanelProps {
  deviceId: string;
  cableInfo: CableInfo;
  isVisible: boolean;
  onClose: () => void;
  topologyDevices?: { id: string; type: string; name: string; ip: string; subnet?: string; gateway?: string; dns?: string; macAddress?: string; ports: { id: string; status: string }[] }[];
  topologyConnections?: { 
    sourceDeviceId: string; 
    sourcePort: string; 
    targetDeviceId: string; 
    targetPort: string; 
    cableType?: string;
    active?: boolean 
  }[];
  deviceStates?: Map<string, SwitchState>;
  onExecuteDeviceCommand?: (deviceId: string, command: string) => Promise<any>;
}

type PCActiveTab = 'desktop' | 'terminal';

export function PCPanel({ 
  deviceId, 
  cableInfo, 
  isVisible, 
  onClose, 
  topologyDevices = [], 
  topologyConnections = [],
  deviceStates,
  onExecuteDeviceCommand
}: PCPanelProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [activeTab, setActiveTab] = useState<PCActiveTab>('desktop');
  
  // Terminal settings state
  const [terminalSettings, setTerminalSettings] = useState({
    bitsPerSecond: '9600',
    dataBits: '8',
    parity: 'None',
    stopBits: '1',
    flowControl: 'None'
  });

  // Get device from topology
  const deviceFromTopology = topologyDevices.find(d => d.id === deviceId);
  const defaultConfig = getPCConfigDefaults(deviceId);
  
  const pcIP = deviceFromTopology?.ip || defaultConfig.ip;
  const pcMAC = deviceFromTopology?.macAddress || defaultConfig.mac;

  // Separate outputs for Desktop (Local) and Terminal (Console)
  const [pcOutput, setPcOutput] = useState<OutputLine[]>(() => [
    {
      id: '1',
      type: 'output',
      content: language === 'tr' 
        ? '\nEthernet adapter Ethernet bağlantısı:\n' 
        : '\nEthernet adapter Ethernet connection:\n'
    }
  ]);
  const [consoleOutput, setConsoleOutput] = useState<OutputLine[]>([]);
  
  const [currentCommand, setCurrentCommand] = useState('');
  const [pcHistory, setPcHistory] = useState<string[]>([]);
  const [consoleHistory, setConsoleHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showCompletionBar, setShowCompletionBar] = useState(true);
  
  // Console connection state
  const [isConsoleConnected, setIsConsoleConnected] = useState(false);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find connected console device
  const getConsoleDevice = useCallback(() => {
    if (!topologyConnections || !deviceId) return null;
    const connection = topologyConnections.find(conn => {
      const isSource = conn.sourceDeviceId === deviceId;
      const isTarget = conn.targetDeviceId === deviceId;
      if (isSource) return conn.sourcePort.toLowerCase().startsWith('com') || conn.sourcePort.toLowerCase() === 'console';
      if (isTarget) return conn.targetPort.toLowerCase().startsWith('com') || conn.targetPort.toLowerCase() === 'console';
      return false;
    });
    if (!connection) return null;
    const otherId = connection.sourceDeviceId === deviceId ? connection.targetDeviceId : connection.sourceDeviceId;
    return topologyDevices.find(d => d.id === otherId && (d.type === 'switch' || d.type === 'router')) || null;
  }, [deviceId, topologyConnections, topologyDevices]);

  const consoleDevice = getConsoleDevice();

  const addOutput = useCallback((tab: PCActiveTab, type: OutputLine['type'], content: string, prompt?: string) => {
    const newLine: OutputLine = { id: Math.random().toString(36).substr(2, 9), type, content, prompt };
    if (tab === 'desktop') setPcOutput(prev => [...prev, newLine]);
    else setConsoleOutput(prev => [...prev, newLine]);
    
    setTimeout(() => {
      if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }, 0);
  }, []);
const handleConnect = () => {
  if (!consoleDevice) return;
  setIsConsoleConnected(true);
  setConnectedDeviceId(consoleDevice.id);
  addOutput('terminal', 'output', language === 'tr' ? 'Konsol bağlantısı kuruluyor...\n' : 'Establishing console connection...\n');

  // Ensure state exists for the target device
  if (onExecuteDeviceCommand) {
    // Just sending an empty command or a special trigger could work, 
    // but let's assume getOrCreateDeviceState should have been called.
    // Since we don't have direct access to getOrCreateDeviceState here, 
    // we rely on the prompt logic using consoleDevice as fallback.
  }

  setTimeout(() => {
    addOutput('terminal', 'success', (language === 'tr' ? 'Bağlantı başarılı: ' : 'Connected to: ') + consoleDevice.name + '\n');
    // Get target device state
    const targetState = deviceStates?.get(consoleDevice.id);
    if (targetState) {
      if (targetState.bannerMOTD) addOutput('terminal', 'output', targetState.bannerMOTD + '\n');
      const prompt = getModePrompt(targetState.currentMode || 'user', targetState.hostname || consoleDevice.name, targetState.currentInterface);
      addOutput('terminal', 'prompt', '', prompt);
    } else {
      // Fallback if state not yet initialized
      const fallbackHostname = consoleDevice.name || (consoleDevice.type === 'router' ? 'Router' : 'Switch');
      addOutput('terminal', 'prompt', '', `${fallbackHostname}>`);
    }
  }, 600);
};

const executePCCommand = (fullCommand: string) => {
    const trimmed = fullCommand.trim();
    addOutput('desktop', 'command', trimmed, 'C:\\>');
    if (!trimmed) return;

    const [command, ...args] = trimmed.toLowerCase().split(/\s+/);
    switch (command) {
      case 'cls': setPcOutput([]); break;
      case 'ipconfig': addOutput('desktop', 'output', `\nEthernet adapter Ethernet:\n   IPv4 Address. . . : ${pcIP}\n   Subnet Mask . . . : 255.255.255.0\n   MAC Address . . . : ${pcMAC}\n`); break;
      case 'getmac': addOutput('desktop', 'output', `\nPhysical Address    Transport Name\n==================  =========================================================\n${pcMAC.toUpperCase().replace(/\./g, '-')}  \\Device\\Tcpip_{${Math.random().toString(16).substr(2, 8).toUpperCase()}}\n`); break;
      case 'ping': addOutput('desktop', 'output', args.length ? `Pinging ${args[0]} with 32 bytes of data...\nReply from ${args[0]}: bytes=32 time=1ms TTL=128\n` : 'Usage: ping <ip>\n'); break;
      case 'help': addOutput('desktop', 'output', 'Commands: ipconfig, getmac, ping, cls, exit, help\n'); break;
      case 'exit': onClose(); break;
      default: addOutput('desktop', 'error', `'${command}' is not recognized.\n`);
    }
  };

  const handleExecute = async (cmd: string) => {
    if (activeTab === 'terminal' && isConsoleConnected && connectedDeviceId && onExecuteDeviceCommand) {
      addOutput('terminal', 'command', cmd, getConsolePrompt());
      const result = await onExecuteDeviceCommand(connectedDeviceId, cmd);
      if (result?.output) addOutput('terminal', 'output', result.output);
      setConsoleHistory(prev => [cmd, ...prev.filter(c => c !== cmd)].slice(0, 20));
    } else if (activeTab === 'desktop') {
      executePCCommand(cmd);
      setPcHistory(prev => [cmd, ...prev.filter(c => c !== cmd)].slice(0, 20));
    }
    setCurrentCommand('');
    setHistoryIndex(-1);
  };

  const getConsolePrompt = () => {
    if (connectedDeviceId && deviceStates) {
      const state = deviceStates.get(connectedDeviceId);
      if (state) return getModePrompt(state.currentMode, state.hostname, state.currentInterface);
    }
    
    // Fallback to topology device info if simulator state is not yet available
    if (consoleDevice) {
      return `${consoleDevice.name}>`;
    }
    
    return 'Switch>';
  };

  const activePrompt = activeTab === 'desktop' ? 'C:\\>' : getConsolePrompt();

  const getSuggestions = useCallback((cmd: string): string[] => {
    const lastWord = cmd.split(' ').pop()?.toLowerCase() || '';
    if (!lastWord) return [];

    const pcCommands = ['ipconfig', 'getmac', 'ping', 'cls', 'exit', 'help'];
    const ciscoCommands = ['show', 'configure', 'interface', 'vlan', 'ip', 'no', 'exit', 'end', 'write', 'copy', 'reload', 'ping'];
    
    const baseList = (activeTab === 'terminal' && isConsoleConnected) ? ciscoCommands : pcCommands;
    return baseList.filter(c => c.startsWith(lastWord));
  }, [activeTab, isConsoleConnected]);

  const currentSuggestions = useMemo(() => getSuggestions(currentCommand), [currentCommand, getSuggestions]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExecute(currentCommand);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const history = activeTab === 'desktop' ? pcHistory : consoleHistory;
      if (history.length > 0) {
        const nextIndex = historyIndex === -1 ? 0 : Math.min(history.length - 1, historyIndex + 1);
        setHistoryIndex(nextIndex);
        setCurrentCommand(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const history = activeTab === 'desktop' ? pcHistory : consoleHistory;
      if (historyIndex !== -1) {
        const nextIndex = historyIndex === 0 ? -1 : historyIndex - 1;
        setHistoryIndex(nextIndex);
        setCurrentCommand(nextIndex === -1 ? '' : history[nextIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (currentSuggestions.length > 0) {
        const words = currentCommand.split(' ');
        words[words.length - 1] = currentSuggestions[0];
        setCurrentCommand(words.join(' '));
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    const words = currentCommand.split(' ');
    words[words.length - 1] = suggestion;
    setCurrentCommand(words.join(' '));
    inputRef.current?.focus();
  };

  const handleHistoryClick = (cmd: string) => {
    setCurrentCommand(cmd);
    inputRef.current?.focus();
  };

  return (
    <div className={`flex flex-col h-full rounded-[2.5rem] border transition-all shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className={`px-8 py-5 border-b flex items-center justify-between flex-shrink-0 ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h3 className="text-lg font-black">{deviceId.toUpperCase()}</h3>
            <div className="text-[10px] font-bold opacity-60">{pcIP} • {pcMAC}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/50">
          <button onClick={() => setActiveTab('desktop')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'desktop' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>
            {language === 'tr' ? 'Masaüstü' : 'Desktop'}
          </button>
          <button onClick={() => setActiveTab('terminal')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'terminal' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>
            Terminal
          </button>
          <button onClick={onClose} className="p-2 ml-4 text-slate-400 hover:text-rose-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
      </div>
      
      {/* Content */}
      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
        {activeTab === 'desktop' ? (
          <div className="flex-1 flex flex-col p-6 min-h-0">
            <div className={`flex-1 flex flex-col border rounded-2xl overflow-hidden shadow-2xl ${
              isDark ? 'border-slate-800 bg-black' : 'border-slate-300 bg-white'
            }`}>
              <div className={`px-4 py-2 border-b flex items-center gap-2 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-200 border-slate-300'
              }`}>
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>Command Prompt</span>
              </div>
              <div ref={outputRef} onClick={() => inputRef.current?.focus()} className="flex-1 overflow-y-auto p-6 font-mono text-sm custom-scrollbar">
                {pcOutput.map(line => (
                  <div key={line.id} className="mb-1">
                    {line.type === 'command' && <div className="flex"><span className="text-blue-500 font-bold">{line.prompt}</span><span className={`ml-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{line.content}</span></div>}
                    {(line.type === 'output' || line.type === 'prompt') && <pre className={`whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{line.prompt && <span className="text-blue-500 font-bold">{line.prompt}</span>}{line.content}</pre>}
                    {line.type === 'error' && <pre className="text-rose-500 font-bold">{line.content}</pre>}
                    {line.type === 'success' && <pre className="text-emerald-500">{line.content}</pre>}
                  </div>
                ))}
                <div className="flex items-center min-h-[24px]">
                  <span className="text-blue-500 font-bold mr-2">{activePrompt}</span>
                  <input ref={inputRef} type="text" value={currentCommand} onChange={e => setCurrentCommand(e.target.value)} onKeyDown={handleKeyDown} className={`flex-1 bg-transparent outline-none font-mono ${isDark ? 'text-white' : 'text-slate-900'}`} autoComplete="off" autoFocus />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-6 min-h-0">
            {!isConsoleConnected ? (
              <div className="flex-1 flex items-center justify-center">
                <div className={`w-full max-w-sm p-8 rounded-3xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-2xl`}>
                  <h3 className="text-center text-xl font-black mb-6">{language === 'tr' ? 'Terminal Ayarları' : 'Terminal Config'}</h3>
                  <div className="space-y-4 mb-8">
                    {[
                      ['Baud Rate', terminalSettings.bitsPerSecond],
                      ['Data Bits', terminalSettings.dataBits],
                      ['Parity', terminalSettings.parity],
                      ['Stop Bits', terminalSettings.stopBits],
                      ['Flow Control', terminalSettings.flowControl]
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between items-center text-sm font-bold opacity-70">
                        <span>{label}</span>
                        <span className={`px-3 py-1 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleConnect} disabled={!consoleDevice} className={`w-full py-4 rounded-2xl font-black transition-all ${consoleDevice ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}>
                    {language === 'tr' ? 'Bağlan' : 'Connect'}
                  </button>
                  <div className="mt-4 text-center text-[10px] font-bold opacity-40 uppercase tracking-widest flex items-center justify-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${consoleDevice ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    {consoleDevice ? 'Console Ready' : 'No Console Cable'}
                  </div>
                </div>
              </div>
            ) : (
              <div className={`flex-1 flex flex-col border rounded-2xl overflow-hidden shadow-2xl ${
                isDark ? 'border-emerald-900/30 bg-black' : 'border-slate-300 bg-white'
              }`}>
                <div className={`px-4 py-2 border-b flex items-center justify-between ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-200 border-slate-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${
                      isDark ? 'text-emerald-500' : 'text-emerald-700'
                    }`}>Console: {consoleDevice?.name}</span>
                  </div>
                  <button onClick={() => setIsConsoleConnected(false)} className={`${isDark ? 'text-slate-500 hover:text-rose-500' : 'text-slate-400 hover:text-rose-600'}`}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
                </div>
                <div ref={outputRef} onClick={() => inputRef.current?.focus()} className="flex-1 overflow-y-auto p-6 font-mono text-sm custom-scrollbar">
                  {consoleOutput.map(line => (
                    <div key={line.id} className="mb-1">
                      {(line.type === 'output' || line.type === 'prompt' || line.type === 'command') && <pre className={`whitespace-pre-wrap ${isDark ? 'text-emerald-500' : 'text-emerald-700'}`}>{line.prompt && <span className="font-bold">{line.prompt}</span>}{line.content}</pre>}
                      {line.type === 'error' && <pre className="text-rose-400 font-bold">{line.content}</pre>}
                      {line.type === 'success' && <pre className="text-emerald-400">{line.content}</pre>}
                    </div>
                  ))}
                  <div className="flex items-center min-h-[24px]">
                    <span className={`font-bold mr-2 ${isDark ? 'text-emerald-500' : 'text-emerald-700'}`}>{activePrompt}</span>
                    <input ref={inputRef} type="text" value={currentCommand} onChange={e => setCurrentCommand(e.target.value)} onKeyDown={handleKeyDown} className={`flex-1 bg-transparent outline-none font-mono ${isDark ? 'text-emerald-50' : 'text-emerald-900'}`} autoComplete="off" autoFocus />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helper Bar */}
      {showCompletionBar && (
        <div className={`border-t px-6 py-4 flex flex-col gap-3 transition-all duration-500 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          {/* Suggestions */}
          {currentSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentSuggestions.map((s, idx) => (
                <button key={idx} onClick={() => handleSuggestionClick(s)} className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${isDark ? 'bg-slate-800 text-blue-400 hover:bg-slate-700 border border-slate-700' : 'bg-white text-blue-600 hover:bg-slate-50 border border-slate-200 shadow-sm'}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
          
          {/* History */}
          {(activeTab === 'desktop' ? pcHistory : consoleHistory).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(activeTab === 'desktop' ? pcHistory : consoleHistory).slice(0, 8).map((cmd, idx) => (
                <button key={idx} onClick={() => handleHistoryClick(cmd)} className={`px-3 py-1 rounded-lg text-[10px] font-mono transition-all ${isDark ? 'bg-slate-900/50 text-slate-500 hover:text-slate-300' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                  {cmd}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowCompletionBar(false)} className="text-[10px] font-bold tracking-widest uppercase opacity-30 hover:opacity-100 transition-opacity">Hide Panel</button>
        </div>
      )}
      {!showCompletionBar && (
        <button onClick={() => setShowCompletionBar(true)} className={`border-t py-2 text-[10px] font-bold tracking-widest uppercase opacity-30 hover:opacity-100 transition-opacity ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>Show Helper</button>
      )}
    </div>
  );
}

function getModePrompt(mode: string = 'user', hostname: string = 'Switch', context?: string): string {
  switch (mode) {
    case 'privileged': return `${hostname}#`;
    case 'config': return `${hostname}(config)#`;
    case 'interface': return `${hostname}(config-if)#`;
    case 'line': return `${hostname}(config-line)#`;
    case 'vlan': return `${hostname}(config-vlan)#`;
    default: return `${hostname}>`;
  }
}

function getPCConfigDefaults(deviceId: string) {
  const num = deviceId.split('-')[1] || '1';
  return { 
    ip: `192.168.1.${10 + parseInt(num)}`, 
    subnet: '255.255.255.0', 
    gateway: '192.168.1.1', 
    dns: '8.8.8.8', 
    mac: `0001.42${num.padStart(2, '0')}.5566` 
  };
}
