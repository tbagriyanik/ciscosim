'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CableInfo, isCableCompatible, SwitchState } from '@/lib/cisco/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { TerminalOutput } from './Terminal';

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
  deviceOutputs?: Map<string, TerminalOutput[]>;
  onExecuteDeviceCommand?: (deviceId: string, command: string) => Promise<any>;
}

type PCActiveTab = 'desktop' | 'terminal';

// Advanced Command Help Tree for Cisco (Reused from Terminal.tsx concept but more compact)
const ciscoHelp: Record<string, Record<string, string[]>> = {
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
  }
};

export function PCPanel({ 
  deviceId, 
  cableInfo, 
  isVisible, 
  onClose, 
  topologyDevices = [], 
  topologyConnections = [],
  deviceStates,
  deviceOutputs,
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

  // Local output for Desktop (Local)
  const [pcOutput, setPcOutput] = useState<OutputLine[]>(() => [
    {
      id: '1',
      type: 'output',
      content: 'Microsoft Windows [Version 10.0.19045.4412]\n(c) Microsoft Corporation. All rights reserved.\n'
    }
  ]);
  
  // Tab cycle state
  const [tabCycleIndex, setTabCycleIndex] = useState(-1);
  const [lastTabInput, setLastTabInput] = useState('');

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

  // Synchronized Console Output from Global State
  const activeConsoleOutput = useMemo(() => {
    if (!isConsoleConnected || !connectedDeviceId || !deviceOutputs) return [];
    return deviceOutputs.get(connectedDeviceId) || [];
  }, [isConsoleConnected, connectedDeviceId, deviceOutputs]);

  const addLocalOutput = useCallback((type: OutputLine['type'], content: string, prompt?: string) => {
    const newLine: OutputLine = { id: Math.random().toString(36).substr(2, 9), type, content, prompt };
    setPcOutput(prev => [...prev, newLine]);
    
    setTimeout(() => {
      if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }, 0);
  }, [setPcOutput]);

  const handleConnect = () => {
    if (!consoleDevice) return;
    
    setIsConsoleConnected(true);
    setConnectedDeviceId(consoleDevice.id);
    
    // Initial sync - global terminal already has content, so we just show it.
    
    // Send initial empty command to get prompt if needed
    if (onExecuteDeviceCommand) {
      onExecuteDeviceCommand(consoleDevice.id, '').then(res => {
        // Results will be automatically added to global deviceOutputs and synced back to us via memo
      });
    }
  };

  const handleDisconnect = () => {
    setIsConsoleConnected(false);
    setConnectedDeviceId(null);
  };

  const executeCommand = async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    if (activeTab === 'desktop') {
      addLocalOutput('command', trimmedCommand);
      
      const cmd = trimmedCommand.toLowerCase();
      if (cmd === 'ipconfig') {
        addLocalOutput('output', `Windows IP Configuration\n\nEthernet adapter Ethernet0:\n   Connection-specific DNS Suffix  . : \n   Link-local IPv6 Address . . . . . : fe80::a1b2:c3d4:e5f6%12\n   IPv4 Address. . . . . . . . . . . : ${pcIP}\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.1.1`);
      } else if (cmd.startsWith('ping ')) {
        const target = trimmedCommand.split(' ')[1];
        addLocalOutput('output', `Pinging ${target} with 32 bytes of data:\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\n\nPing statistics for ${target}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = 0ms, Maximum = 0ms, Average = 0ms`);
      } else if (cmd === 'help') {
        addLocalOutput('output', 'Available commands:\n  ipconfig - Display IP configuration\n  ping <ip> - Ping a network host\n  cls - Clear screen\n  help - Display this help message\n  exit - Close terminal');
      } else if (cmd === 'cls') {
        setPcOutput([]);
      } else if (cmd === 'exit') {
        onClose();
      } else {
        addLocalOutput('error', `'${trimmedCommand}' is not recognized as an internal or external command, operable program or batch file.`);
      }
    } else {
      // Terminal mode
      if (!isConsoleConnected) {
        return;
      }

      if (onExecuteDeviceCommand && connectedDeviceId) {
        try {
          await onExecuteDeviceCommand(connectedDeviceId, trimmedCommand);
          // Global state handles the output, we sync via activeConsoleOutput
        } catch (err) {
          // Errors could also be added to global state
        }
      }
    }
  };

  // Keyboard handlers
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const command = e.currentTarget.value;
      executeCommand(command);
      e.currentTarget.value = '';
      setTabCycleIndex(-1);
      setLastTabInput('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabComplete(e.currentTarget);
    }
  };

  const handleTabComplete = (input: HTMLInputElement) => {
    const value = input.value;
    if (!value && tabCycleIndex === -1) return;

    if (activeTab === 'desktop') {
      const pcCmds = ['ipconfig', 'ping', 'help', 'cls', 'exit'];
      const matches = pcCmds.filter(c => c.startsWith(value.toLowerCase()));
      if (matches.length > 0) {
        input.value = matches[0];
      }
    } else if (isConsoleConnected && connectedDeviceId && deviceStates) {
      // Get device state for context-aware completion
      const state = deviceStates.get(connectedDeviceId);
      if (!state) return;

      const mode = state.currentMode;
      const helpTree = ciscoHelp[mode] || ciscoHelp.user;
      
      const parts = value.split(' ');
      const currentWord = parts[parts.length - 1].toLowerCase();
      const previousContext = parts.slice(0, -1).join(' ');
      
      let options: string[] = [];
      if (parts.length === 1) {
        options = helpTree[''];
      } else {
        const contextCmd = parts.slice(0, -1).join(' ').toLowerCase();
        options = helpTree[contextCmd] || [];
      }

      const matches = options.filter(opt => opt.toLowerCase().startsWith(currentWord));
      
      if (matches.length > 0) {
        if (tabCycleIndex === -1) {
          setLastTabInput(value);
          const nextIndex = 0;
          setTabCycleIndex(nextIndex);
          input.value = previousContext ? `${previousContext} ${matches[nextIndex]}` : matches[nextIndex];
        } else {
          const nextIndex = (tabCycleIndex + 1) % matches.length;
          setTabCycleIndex(nextIndex);
          const originalParts = lastTabInput.split(' ');
          const originalContext = originalParts.slice(0, -1).join(' ');
          input.value = originalContext ? `${originalContext} ${matches[nextIndex]}` : matches[nextIndex];
        }
      }
    }
  };

  // Scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [pcOutput, activeConsoleOutput]);

  if (!isVisible) return null;

  return (
    <div className={`w-full h-full flex flex-col flex-1 overflow-hidden`}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full h-full flex flex-col rounded-2xl overflow-hidden border ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-none">PC - {deviceFromTopology?.name || deviceId}</h2>
              <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase tracking-wider">{pcIP} • {pcMAC}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`px-6 py-2 flex items-center gap-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button 
            onClick={() => setActiveTab('desktop')}
            className={`px-3 py-2 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'desktop' 
                ? 'border-blue-500 text-blue-500' 
                : 'border-transparent text-slate-500 hover:text-slate-400'
            }`}
          >
            Desktop
          </button>
          <button 
            onClick={() => setActiveTab('terminal')}
            className={`px-3 py-2 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'terminal' 
                ? 'border-blue-500 text-blue-500' 
                : 'border-transparent text-slate-500 hover:text-slate-400'
            }`}
          >
            Terminal (Console)
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black p-4 font-mono relative">
          {activeTab === 'terminal' && !isConsoleConnected && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm gap-6 p-8 text-center">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 border border-slate-700">
                  <Monitor className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Console Terminal</h3>
                <p className="text-sm text-slate-400 mb-6">
                  {consoleDevice 
                    ? `Physical connection detected to ${consoleDevice.name}. Port: 9600-8-N-1`
                    : 'No console cable detected. Connect a console cable from the PC to a network device.'}
                </p>
                <div className="flex flex-col gap-2">
                  <button 
                    disabled={!consoleDevice}
                    onClick={handleConnect}
                    className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                      consoleDevice 
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95' 
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <TerminalIcon className="w-4 h-4" />
                    Connect to Device
                  </button>
                  <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold mt-2">Configuration: 9600 bits/s, 8 data bits, no parity</p>
                </div>
              </div>
            </div>
          )}

          <div 
            ref={outputRef}
            className="flex-1 overflow-y-auto custom-scrollbar mb-4 space-y-1 pr-2"
          >
            {(activeTab === 'desktop' ? pcOutput : activeConsoleOutput).map((line) => (
              <div key={line.id} className="break-all whitespace-pre-wrap leading-relaxed">
                {line.type === 'command' && (
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-500 shrink-0 font-bold">{activeTab === 'desktop' ? 'C:\\>' : (line.prompt || '>')}</span>
                    <span className="text-white">{line.content}</span>
                  </div>
                )}
                {line.type === 'prompt' && (
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-500 shrink-0 font-bold">{line.prompt}</span>
                  </div>
                )}
                {line.type === 'output' && <span className="text-slate-300">{line.content}</span>}
                {line.type === 'error' && <span className="text-rose-400 font-medium">{line.content}</span>}
                {line.type === 'success' && <span className="text-cyan-400 font-medium italic opacity-80">{line.content}</span>}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-800 pt-4">
            <span className="text-emerald-500 font-bold shrink-0">
              {activeTab === 'desktop' 
                ? 'C:\\>' 
                : (isConsoleConnected ? (activeConsoleOutput.findLast(l => l.type === 'prompt')?.prompt || '>') : 'OFFLINE>')}
            </span>
            <input
              ref={inputRef}
              type="text"
              autoFocus
              disabled={activeTab === 'terminal' && !isConsoleConnected}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-slate-800"
              placeholder={activeTab === 'terminal' && !isConsoleConnected ? "Waiting for connection..." : "Type command..."}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Internal icons
function Laptop({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m2 16 20 0" /><path d="M20 16V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11" /><path d="M2 16h20v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2Z" />
    </svg>
  );
}

function Monitor({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function getPCConfigDefaults(id: string) {
  const num = id.split('-')[1] || '1';
  return {
    ip: `192.168.1.${10 + parseInt(num)}`,
    mac: `00E0.F7${num.padStart(2, '0')}.A${num}B${num}`
  };
}
