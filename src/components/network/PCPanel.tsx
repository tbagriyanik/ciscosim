'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CableInfo, isCableCompatible, SwitchState } from '@/lib/network/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TerminalOutput } from './Terminal';
import { checkConnectivity } from '@/lib/network/connectivity';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Laptop, Monitor, Terminal as TerminalIcon, X, CornerDownLeft, Command, Globe, Network, ShieldCheck, History, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from "@/hooks/use-toast";

// PC Icon component matching the main screen
const PCIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z" />
  </svg>
);

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
  onTogglePower?: (deviceId: string) => void;
  topologyDevices?: { id: string; type: string; name: string; ip: string; subnet?: string; gateway?: string; dns?: string; macAddress?: string; status?: string; vlan?: number; ports: { id: string; status: string }[] }[];
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
  pcOutputs?: Map<string, OutputLine[]>;
  pcHistories?: Map<string, string[]>;
  onUpdatePCHistory?: (deviceId: string, history: string[]) => void;
  onExecuteDeviceCommand?: (deviceId: string, command: string) => Promise<any>;
}

type PCActiveTab = 'desktop' | 'terminal';

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
  }
};

export function PCPanel({
  deviceId,
  cableInfo,
  isVisible,
  onClose,
  onTogglePower,
  topologyDevices = [],
  topologyConnections = [],
  deviceStates,
  deviceOutputs,
  pcOutputs,
  pcHistories,
  onUpdatePCHistory,
  onExecuteDeviceCommand
}: PCPanelProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const terminalBg = isDark ? 'bg-black shadow-inner' : 'bg-slate-50 shadow-inner border border-slate-200';
  const textColor = isDark ? 'text-slate-400' : 'text-slate-600';
  const cmdColor = isDark ? 'text-slate-100' : 'text-slate-900';
  const inputBg = isDark ? 'bg-black/50' : 'bg-white';
  const inputBorder = isDark ? 'border-slate-800' : 'border-slate-300';

  const [activeTab, setActiveTab] = useState<PCActiveTab>('desktop');
  const [input, setInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // History State
  const [history, setHistory] = useState<string[]>(() => {
    return pcHistories?.get(deviceId) || [];
  });
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Sync with global history if it changes externally
  useEffect(() => {
    const globalHistory = pcHistories?.get(deviceId) || [];
    if (JSON.stringify(globalHistory) !== JSON.stringify(history)) {
      setHistory(globalHistory);
      setHistoryIndex(-1);
    }
  }, [pcHistories, deviceId]);

  // Get device from topology
  const deviceFromTopology = topologyDevices.find(d => d.id === deviceId);
  const defaultConfig = getPCConfigDefaults(deviceId);
  const isPcPoweredOff = deviceFromTopology?.status === 'offline';

  // Sync state with topology if it changes
  useEffect(() => {
    if (deviceFromTopology) {
      setPcHostname(deviceFromTopology.name);
      setPcIP(deviceFromTopology.ip);
      setPcMAC(deviceFromTopology.macAddress || defaultConfig.mac);
    }
  }, [deviceFromTopology, defaultConfig.mac]);

  const [pcIP, setPcIP] = useState(deviceFromTopology?.ip || defaultConfig.ip);
  const [pcHostname, setPcHostname] = useState(deviceFromTopology?.name || deviceId);
  const [pcMAC, setPcMAC] = useState(deviceFromTopology?.macAddress || defaultConfig.mac);

  // Local output for Desktop (Local) - initialize from prop if available
  const getInitialPcOutput = (): OutputLine[] => {
    if (pcOutputs?.has('pc-desktop')) {
      return pcOutputs.get('pc-desktop')!;
    }
    return [{
      id: '1',
      type: 'output',
      content: 'OS Windows [Version 10.0.19045.4412]\n(c) OS Corporation. All rights reserved.\n'
    }];
  };
  const [pcOutput, setPcOutput] = useState<OutputLine[]>(() => getInitialPcOutput());

  // Sync pcOutput changes back to parent when it changes
  const prevPcOutputRef = useRef(pcOutput);
  useEffect(() => {
    if (pcOutput !== prevPcOutputRef.current && pcOutput.length > 0) {
      prevPcOutputRef.current = pcOutput;
      // Parent can subscribe to this via a callback if needed
      // For now, we keep local state in sync
    }
  }, [pcOutput]);

  // Tab cycle state
  const [tabCycleIndex, setTabCycleIndex] = useState(-1);
  const [lastTabInput, setLastTabInput] = useState('');

  // Game state
  const [gameActive, setGameActive] = useState(false);
  const [snake, setSnake] = useState<{ x: number, y: number }[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [direction, setDirection] = useState({ x: 1, y: 0 });
  const [gameScore, setGameScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameLanguage, setGameLanguage] = useState<'en' | 'tr'>('en');

  // Console connection state
  const [isConsoleConnected, setIsConsoleConnected] = useState(false);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Find connected console device
  const getConsoleDevice = useCallback(() => {
    if (!topologyConnections || !deviceId) return null;
    const connection = topologyConnections.find(conn => {
      // Must be an active console cable
      if (conn.cableType !== 'console' || conn.active === false) return false;

      const isSource = conn.sourceDeviceId === deviceId;
      const isTarget = conn.targetDeviceId === deviceId;

      // Port name checks (case insensitive)
      if (isSource) {
        const port = conn.sourcePort.toLowerCase();
        return port.startsWith('com') || port === 'console' || port === 'rs232';
      }
      if (isTarget) {
        const port = conn.targetPort.toLowerCase();
        return port.startsWith('com') || port === 'console' || port === 'rs232';
      }
      return false;
    });
    if (!connection) return null;
    const otherId = connection.sourceDeviceId === deviceId ? connection.targetDeviceId : connection.sourceDeviceId;
    return topologyDevices.find(d => d.id === otherId && (d.type === 'switch' || d.type === 'router')) || null;
  }, [deviceId, topologyConnections, topologyDevices]);

  const consoleDevice = getConsoleDevice();

  // Game loop
  useEffect(() => {
    if (!gameActive || gameOver) return;

    const gameInterval = setInterval(() => {
      setSnake(currentSnake => {
        const newSnake = [...currentSnake];
        const head = { ...newSnake[0] };

        head.x += direction.x;
        head.y += direction.y;

        // Check walls
        if (head.x < 0 || head.x >= 30 || head.y < 0 || head.y >= 20) {
          setGameOver(true);
          return currentSnake;
        }

        // Check self collision
        if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
          setGameOver(true);
          return currentSnake;
        }

        newSnake.unshift(head);

        // Check food
        if (head.x === food.x && head.y === food.y) {
          setGameScore(prev => prev + 10);
          setFood({
            x: Math.floor(Math.random() * 30),
            y: Math.floor(Math.random() * 20)
          });
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, 150);

    return () => clearInterval(gameInterval);
  }, [gameActive, direction, food, gameOver]);

  // Game controls
  useEffect(() => {
    if (!gameActive) return;

    const handleGameKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGameActive(false);
        return;
      }

      if (gameOver && e.key === ' ') {
        setSnake([{ x: 10, y: 10 }]);
        setFood({ x: 15, y: 15 });
        setDirection({ x: 1, y: 0 });
        setGameScore(0);
        setGameOver(false);
        return;
      }

      // Prevent reverse direction
      switch (e.key) {
        case 'ArrowUp':
          if (direction.y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          if (direction.y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          if (direction.x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          if (direction.x === 0) setDirection({ x: 1, y: 0 });
          break;
      }
    };

    window.addEventListener('keydown', handleGameKey);
    return () => window.removeEventListener('keydown', handleGameKey);
  }, [gameActive, direction, gameOver]);

  // Synchronized Console Output from Global State
  const activeConsoleOutput = useMemo(() => {
    if (!isConsoleConnected || !connectedDeviceId || !deviceOutputs) return [];
    return deviceOutputs.get(connectedDeviceId) || [];
  }, [isConsoleConnected, connectedDeviceId, deviceOutputs]);

  const handleCopyAll = useCallback(async () => {
    try {
      const lines = (activeTab === 'desktop' ? pcOutput : activeConsoleOutput).map((line: any) => {
        if (line.type === 'command') return `${activeTab === 'desktop' ? 'C:\\>' : (line.prompt || '>')}${line.content}`;
        return line.content;
      });
      await navigator.clipboard.writeText(lines.join('\n'));
      toast({
        title: language === 'tr' ? 'Kopyalandı' : 'Copied',
        description: language === 'tr' ? 'Çıktı panoya kopyalandı.' : 'Output copied to clipboard.',
      });
    } catch {
      toast({
        title: language === 'tr' ? 'Kopyalama başarısız' : 'Copy failed',
        description: language === 'tr' ? 'Panoya erişilemedi.' : 'Clipboard access was blocked.',
        variant: "destructive",
      });
    }
  }, [activeTab, pcOutput, activeConsoleOutput, language]);

  const connectedConsoleDevice = useMemo(() => {
    if (!connectedDeviceId) return null;
    return topologyDevices.find(d => d.id === connectedDeviceId) || null;
  }, [connectedDeviceId, topologyDevices]);

  const isConsoleTargetPoweredOff = isConsoleConnected && !!connectedConsoleDevice && connectedConsoleDevice.status === 'offline';
  const isCmdInputDisabled = isPcPoweredOff;
  const consoleAwaitingPassword = !!(connectedDeviceId && deviceStates?.get(connectedDeviceId)?.awaitingPassword);
  const isConsoleInputDisabled = isPcPoweredOff || !isConsoleConnected || isConsoleTargetPoweredOff || consoleAwaitingPassword;
  const [showConsolePasswordPrompt, setShowConsolePasswordPrompt] = useState(false);
  const [consolePasswordInput, setConsolePasswordInput] = useState('');
  const [consolePasswordAttempted, setConsolePasswordAttempted] = useState(false);
  const consolePasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'terminal' && consoleAwaitingPassword) {
      setShowConsolePasswordPrompt(true);
      setConsolePasswordInput('');
      setConsolePasswordAttempted(false);
      setTimeout(() => consolePasswordRef.current?.focus(), 0);
    } else {
      setShowConsolePasswordPrompt(false);
      setConsolePasswordInput('');
    }
  }, [activeTab, consoleAwaitingPassword]);

  const consoleAuthenticated = useMemo(() => {
    if (!connectedDeviceId) return true;
    return deviceStates?.get(connectedDeviceId)?.consoleAuthenticated !== false;
  }, [connectedDeviceId, deviceStates]);

  useEffect(() => {
    if (!isConsoleConnected || !connectedDeviceId) return;

    // If a console password was attempted and the device is no longer awaiting a password,
    // but still isn't authenticated, bounce back to the connection screen.
    if (consolePasswordAttempted && !consoleAwaitingPassword && !consoleAuthenticated) {
      setIsConsoleConnected(false);
      setConnectedDeviceId(null);
      setShowConsolePasswordPrompt(false);
      setConsolePasswordAttempted(false);
      setConsolePasswordInput('');
    }

    if (consoleAuthenticated) {
      setConsolePasswordAttempted(false);
    }
  }, [consoleAuthenticated, consoleAwaitingPassword, consolePasswordAttempted, connectedDeviceId, isConsoleConnected]);

  const connectionErrorText = useMemo(() => {
    if (!isPcPoweredOff && !isConsoleTargetPoweredOff) return '';
    return language === 'tr' ? 'Bağlantı hatası' : 'Connection error';
  }, [isPcPoweredOff, isConsoleTargetPoweredOff, language]);

  const addLocalOutput = useCallback((type: OutputLine['type'], content: string, prompt?: string) => {
    const newLine: OutputLine = { id: Math.random().toString(36).substr(2, 9), type, content, prompt };
    setPcOutput(prev => [...prev, newLine]);

    setTimeout(() => {
      if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }, 0);
  }, []);

  const handleConnect = () => {
    if (!consoleDevice) return;

    setIsConsoleConnected(true);
    setConnectedDeviceId(consoleDevice.id);

    if (onExecuteDeviceCommand) {
      // Internal "connect" signal to trigger console authentication flow if configured.
      onExecuteDeviceCommand(consoleDevice.id, '__CONSOLE_CONNECT__').then(() => { });
    }
  };

  const executeCommand = async (cmdToExecute?: string) => {
    const command = (cmdToExecute || input).trim();
    if (!command) return;

    if ((activeTab === 'desktop' && isCmdInputDisabled) || (activeTab === 'terminal' && isConsoleInputDisabled)) {
      addLocalOutput('error', connectionErrorText || (language === 'tr' ? 'Bağlantı hatası' : 'Connection error'));
      setInput('');
      return;
    }

    // Add to history
    if (history[0] !== command) {
      const newHistory = [command, ...history].slice(0, 50);
      setHistory(newHistory);
      if (onUpdatePCHistory) {
        onUpdatePCHistory(deviceId, newHistory);
      }
    }
    setHistoryIndex(-1);
    setInput('');

    if (activeTab === 'desktop') {
      addLocalOutput('command', command);

      const parts = command.split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      // Check for secret game command
      if (cmd === 'snake' || cmd === 'yilan') {
        setGameActive(true);
        setSnake([{ x: 10, y: 10 }]);
        setFood({ x: 15, y: 15 });
        setDirection({ x: 1, y: 0 });
        setGameScore(0);
        setGameOver(false);
        setGameLanguage(cmd === 'yilan' ? 'tr' : 'en');
        return;
      }

      if (cmd === 'ipconfig') {
        if (args.includes('/release')) {
          setPcIP('0.0.0.0');
          addLocalOutput('success', 'IP address released successfully.');
        } else if (args.includes('/renew')) {
          const restoredIP = deviceFromTopology?.ip || defaultConfig.ip;
          setPcIP(restoredIP);
          addLocalOutput('success', `IP address renewed successfully. New IP: ${restoredIP}`);
        } else if (args.includes('/all')) {
          addLocalOutput('output', `OS IP Configuration\n\n   Host Name . . . . . . . . . . . . : ${pcHostname}\n   Primary Dns Suffix  . . . . . . . : \n   Node Type . . . . . . . . . . . . : Hybrid\n   IP Routing Enabled. . . . . . . . : No\n   WINS Proxy Enabled. . . . . . . . : No\n\nEthernet adapter Ethernet0:\n   Connection-specific DNS Suffix  . : \n   Description . . . . . . . . . . . : Generic Gigabit Network Connection\n   Physical Address. . . . . . . . . : ${pcMAC}\n   DHCP Enabled. . . . . . . . . . . : No\n   Autoconfiguration Enabled . . . . : Yes\n   IPv4 Address. . . . . . . . . . . : ${pcIP}(Preferred)\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.1.1\n   DNS Servers . . . . . . . . . . . : 8.8.8.8`);
        } else {
          addLocalOutput('output', `OS IP Configuration\n\nEthernet adapter Ethernet0:\n   Connection-specific DNS Suffix  . : \n   Link-local IPv6 Address . . . . . : fe80::a1b2:c3d4:e5f6%12\n   IPv4 Address. . . . . . . . . . . : ${pcIP}\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.1.1`);
        }
      } else if (cmd === 'ipv6config') {
        addLocalOutput('output', `OS IPv6 Configuration\n\nEthernet adapter Ethernet0:\n   IPv6 Address. . . . . . . . . . . : 2001:db8:acad:1::10\n   Link-local IPv6 Address . . . . . : fe80::a1b2:c3d4:e5f6%12\n   Default Gateway . . . . . . . . . : fe80::1`);
      } else if (cmd === 'ping') {
        const target = args[0];
        if (!target) {
          addLocalOutput('output', 'Usage: ping <target_name_or_address>');
        } else if (pcIP === '0.0.0.0') {
          addLocalOutput('error', 'Ping transmit failed. General failure.');
        } else {
          const result = checkConnectivity(deviceId, target, topologyDevices as any, topologyConnections as any, deviceStates);
          if (result.success) {
            addLocalOutput('output', `Pinging ${target} with 32 bytes of data:\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\n\nPing statistics for ${target}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = 0ms, Maximum = 0ms, Average = 0ms`);
          } else {
            addLocalOutput('output', `Pinging ${target} with 32 bytes of data:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\n\nPing statistics for ${target}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)`);
          }
        }
      } else if (cmd === 'tracert') {
        const target = args[0];
        if (!target) {
          addLocalOutput('output', 'Usage: tracert <target_name_or_address>');
        } else if (pcIP === '0.0.0.0') {
          addLocalOutput('error', 'Unable to resolve target system name.');
        } else {
          const result = checkConnectivity(deviceId, target, topologyDevices as any, topologyConnections as any, deviceStates);
          if (result.success) {
            let output = `Tracing route to ${target} over a maximum of 30 hops:\n\n`;
            result.hops.forEach((hop, index) => {
              output += `  ${index + 1}    <1 ms    <1 ms    <1 ms  ${hop}\n`;
            });
            output += `\nTrace complete.`;
            addLocalOutput('output', output);
          } else {
            addLocalOutput('output', `Tracing route to ${target} over a maximum of 30 hops:\n\n  1    *        *        *     Request timed out.\n\nTrace complete.`);
          }
        }
      } else if (cmd === 'nslookup') {
        const target = args[0] || 'yunus.sf.net';
        addLocalOutput('output', `Server:  public-dns.yunus.sf.net\nAddress:  8.8.8.8\n\nNon-authoritative answer:\nName:    ${target}\nAddresses:  93.184.216.34`);
      } else if (cmd === 'arp') {
        if (args[0] === '-a' || !args[0]) {
          addLocalOutput('output', `Interface: ${pcIP} --- 0x2\n  Internet Address      Physical Address      Type\n  192.168.1.1           00-15-2b-e4-9b-60     dynamic\n  192.168.1.255         ff-ff-ff-ff-ff-ff     static`);
        } else {
          addLocalOutput('output', 'Usage: arp -a');
        }
      } else if (cmd === 'netstat') {
        addLocalOutput('output', `Active Connections\n\n  Proto  Local Address          Foreign Address        State\n  TCP    ${pcIP}:49674        142.250.185.78:443     ESTABLISHED\n  TCP    ${pcIP}:49675        172.217.17.142:443     ESTABLISHED`);
      } else if (cmd === 'netsh') {
        addLocalOutput('output', 'netsh> usage: interface, wlan, firewalls, routing, etc.\nFor simulation purposes, netsh is in interactive mode.');
      } else if (cmd === 'dir') {
        addLocalOutput('output', ` Volume in drive C has no label.\n Volume Serial Number is 4C32-8B1F\n\n Directory of C:\\\n\n26/02/2026  22:00    <DIR>          Users\n26/02/2026  22:00    <DIR>          Program Files\n26/02/2026  22:00    <DIR>          System\n26/02/2026  22:05               124 notes.txt\n               1 File(s)            124 bytes\n               3 Dir(s)  45,234,122,752 bytes free`);
      } else if (cmd === 'cd') {
        addLocalOutput('output', `C:\\${args[0] || ''}`);
      } else if (cmd === 'mkdir') {
        addLocalOutput('success', `Directory '${args[0] || 'new_folder'}' created.`);
      } else if (cmd === 'rmdir') {
        addLocalOutput('success', `Directory '${args[0] || 'folder'}' removed.`);
      } else if (cmd === 'delete') {
        addLocalOutput('success', `File '${args[0] || 'file'}' deleted.`);
      } else if (cmd === 'ftp') {
        addLocalOutput('output', `Connected to ${args[0] || 'server'}.\n220 OS FTP Service\nUser (anonymous):`);
      } else if (cmd === 'ssh') {
        addLocalOutput('output', `OpenSSH_9.2p1, OpenSSL 3.0.8\nusage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address]...`);
      } else if (cmd === 'telnet') {
        addLocalOutput('output', `Connecting To ${args[0] || 'host'}...Could not open connection to the host, on port 23: Connect failed`);
      } else if (cmd === 'python') {
        addLocalOutput('output', 'Python 3.11.2 (main, Feb 12 2026, 11:00:00)\n[MSC v.1934 64 bit (AMD64)] on win32\nType "help", "copyright", "credits" or "license" for more information.\n>>> ');
      } else if (cmd === 'js') {
        addLocalOutput('output', 'Node.js v18.16.0 Interactive Interpreter\n> ');
      } else if (cmd === 'ide') {
        addLocalOutput('output', 'Starting Network IOx Development Environment...');
      } else if (cmd === 'ioxclient') {
        addLocalOutput('output', 'Network IOx Client v1.15.0.0\nUsage: ioxclient [options] command [command options] [arguments...]');
      } else if (cmd === 'snmpget' || cmd === 'snmpset' || cmd === 'snmpgetbulk') {
        addLocalOutput('output', `${cmd.toUpperCase()}: usage: ${cmd} [common options] [-protocol specific options] agent [OID [OID]...]`);
      } else if (cmd === 'hostname') {
        if (args[0]) {
          let name = args[0];
          if ((name.startsWith('"') && name.endsWith('"')) ||
            (name.startsWith("'") && name.endsWith("'"))) {
            name = name.substring(1, name.length - 1);
          }
          setPcHostname(name);
          addLocalOutput('success', `Hostname changed to ${name}`);
        } else {
          addLocalOutput('output', pcHostname);
        }
      } else if (cmd === 'ver') {
        addLocalOutput('output', 'OS Windows [Version 10.0.19045.4412]');
      } else if (cmd === 'help' || cmd === '?') {
        addLocalOutput('output', `?            Display the list of available commands
  arp          Display the arp table
  cd           Displays the name of or changes the current directory.
  delete       Deletes the specified file from C: directory.
  dir          Displays the list of files  in C: directory.
  exit         Quits the CMD.EXE program (command interpreter)
  ftp          Transfers files to and from a computer running an FTP server.
  help         Display the list of available commands
  ide          Starts IoX development environment
  ioxclient    Command line tool to assist in app development for Network IOx
               platforms
  ipconfig     Display network configuration for each network adapter
  ipv6config   Display network configuration for each network adapter
  js           JavaScript Interactive Interpreter
  mkdir        Creates a directory.
  netsh        
  netstat      Displays protocol statistics and current TCP/IP network
               connections
  nslookup     DNS Lookup
  ping         Send echo messages
  python       Python Interactive Interpreter
  quit         Exit Telnet/SSH
  rmdir        Removes a directory.
  snake        Play Snake game
  yilan        Play Snake game (Turkish)
  snmpget      SNMP GET
  snmpgetbulk  SNMP GET BULK
  snmpset      SNMP SET
  ssh          ssh client
  telnet       Telnet client
  tracert      Trace route to destination`);
      } else if (cmd === 'cls') {
        setPcOutput([]);
      } else if (cmd === 'exit' || cmd === 'quit') {
        onClose();
      } else {
        addLocalOutput('error', `'${command}' is not recognized as an internal or external command, operable program or batch file.`);
      }
    } else {
      if (!isConsoleConnected) return;
      if (onExecuteDeviceCommand && connectedDeviceId) {
        try {
          await onExecuteDeviceCommand(connectedDeviceId, command);
        } catch (err) { }
      }
    }
  };

  const handleConsolePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = consolePasswordInput.trim();
    if (!value || !connectedDeviceId || !onExecuteDeviceCommand) return;
    setConsolePasswordAttempted(true);
    await onExecuteDeviceCommand(connectedDeviceId, value);
    setConsolePasswordInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand();
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
      handleTabComplete(e.currentTarget);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      if (activeTab === 'desktop') {
        setPcOutput([]);
      } else if (activeTab === 'terminal' && connectedDeviceId && onExecuteDeviceCommand) {
        // For terminal, execute 'clear' command to clear the output
        onExecuteDeviceCommand(connectedDeviceId, 'clear');
      }
    } else {
      // Reset tab cycle on any other key press
      setTabCycleIndex(-1);
    }
  };

  const handleTabComplete = (inputEl: HTMLInputElement) => {
    const value = inputEl.value;
    if (!value && tabCycleIndex === -1) return;

    if (activeTab === 'desktop') {
      const pcCmds = ['ipconfig', 'ipv6config', 'ping', 'tracert', 'nslookup', 'arp', 'netstat', 'hostname', 'dir', 'ver', 'help', 'cls', 'exit', 'quit', 'mkdir', 'rmdir', 'delete', 'ftp', 'ssh', 'telnet', 'python', 'js', 'ide', 'ioxclient', 'snake', 'yilan'];
      const matches = pcCmds.filter(c => c.toLowerCase().startsWith(value.toLowerCase()));

      if (matches.length > 0) {
        if (tabCycleIndex === -1) {
          setLastTabInput(value);
          setTabCycleIndex(0);
          setInput(matches[0]);
        } else {
          const nextIndex = (tabCycleIndex + 1) % matches.length;
          setTabCycleIndex(nextIndex);
          setInput(matches[nextIndex]);
        }
      }
    } else if (isConsoleConnected && connectedDeviceId && deviceStates) {
      const state = deviceStates.get(connectedDeviceId);
      if (!state) return;

      const mode = state.currentMode;
      const helpTree = networkHelp[mode] || networkHelp.user;

      const parts = value.split(/\s+/);
      const hasTrailingSpace = value.endsWith(' ');

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
          const originalParts = lastTabInput.split(/\s+/);
          const originalContext = lastTabInput.endsWith(' ') ? lastTabInput.trim() : originalParts.slice(0, -1).join(' ');
          const completion = matches[nextIndex];
          setInput(originalContext ? `${originalContext} ${completion}` : completion);
        }
      }
    }
  };

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
    inputRef.current?.focus();
  }, [pcOutput, activeConsoleOutput, activeTab, deviceId]);

  // Focus on mount (when tab is clicked in main app)
  useEffect(() => {
    inputRef.current?.focus();
  }, [isVisible]);

  if (!isVisible) return null;

  // Last 10 unique commands for mobile
  const recentCommands = history.slice(0, 10);

  return (
    <div className={`w-full h-full flex flex-col flex-1 overflow-hidden h-full min-h-0`}>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white'} sm:max-w-md`}>
          <DialogHeader>
            <DialogTitle>{language === 'tr' ? 'Çıktıda ara' : 'Search output'}</DialogTitle>
            <DialogDescription className={isDark ? 'text-slate-400' : 'text-slate-600'}>
              {language === 'tr' ? 'Eşleşmeler çıktı alanında vurgulanır.' : 'Matches will be highlighted in the output.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'tr' ? 'Arama...' : 'Search...'}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setSearchQuery('')} className="text-xs font-semibold" disabled={!searchQuery.trim()}>
              {language === 'tr' ? 'Temizle' : 'Clear'}
            </Button>
            <Button onClick={() => setSearchOpen(false)} className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white">
              {language === 'tr' ? 'Kapat' : 'Close'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showConsolePasswordPrompt}
        onOpenChange={(open) => {
          if (!open && consoleAwaitingPassword) return;
          setShowConsolePasswordPrompt(open);
        }}
      >
        <DialogContent showCloseButton={false} className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white'} sm:max-w-sm`}>
          <DialogHeader>
            <DialogTitle>{language === 'tr' ? 'Parola Gerekli' : 'Password Required'}</DialogTitle>
            <DialogDescription className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {language === 'tr' ? 'Konsol erişimi için parolayı girin.' : 'Enter the console password to continue.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConsolePasswordSubmit} className="flex flex-col gap-3">
            <Input
              ref={consolePasswordRef}
              type="password"
              value={consolePasswordInput}
              onChange={(e) => setConsolePasswordInput(e.target.value)}
              placeholder={language === 'tr' ? 'Parola' : 'Password'}
              autoComplete="current-password"
            />
            <Button type="submit" disabled={!consolePasswordInput.trim()} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
              {language === 'tr' ? 'Gönder' : 'Submit'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full h-full flex flex-col flex-1 rounded-2xl overflow-hidden border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          } shadow-2xl min-h-0`}
      >
        {/* Header */}
        <div className={`px-5 py-3 flex items-center justify-between border-b ${isDark ? 'border-slate-800/50 bg-slate-800/20' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <PCIcon />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight leading-none uppercase">{pcHostname}</h2>
              <p className="text-xs font-bold text-slate-500 mt-1.5 uppercase tracking-widest">{pcIP} • {pcMAC}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchOpen(true)}
                  className="h-8 w-8 rounded-lg text-slate-500 hover:text-emerald-400 transition-colors"
                  aria-label={t.search}
                >
                  <Search className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.search}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyAll}
                  className="h-8 w-8 rounded-lg text-slate-500 hover:text-emerald-400 transition-colors"
                  aria-label={t.copy}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.copy}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onTogglePower?.(deviceId)}
                  className={`h-8 w-8 rounded-lg transition-all ${isPcPoweredOff ? 'text-rose-500 hover:bg-rose-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'}`}
                  aria-label={t.power}
                  disabled={!onTogglePower}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 1 1-12.728 0" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.power}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-all"
                >
                  <X className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.close}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={`px-4 py-1.5 flex items-center gap-1 border-b ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <Button
            variant={activeTab === 'desktop' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('desktop')}
            className={`h-9 px-4 text-xs font-black tracking-wider uppercase transition-all gap-2 ${activeTab === 'desktop' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500'
              }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Desktop
          </Button>
          <Button
            variant={activeTab === 'terminal' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('terminal')}
            className={`h-9 px-4 text-xs font-black tracking-wider uppercase transition-all gap-2 ${activeTab === 'terminal' ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-500 hover:text-emerald-500'
              }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            Console
          </Button>
        </div>

        {/* Content Area */}
        <div className={`flex-1 flex flex-col overflow-hidden ${terminalBg} relative min-h-0`}>
          {activeTab === 'terminal' && !isConsoleConnected && (
            <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center ${isDark ? 'bg-black/90' : 'bg-white/90'} backdrop-blur-md gap-2 p-2 text-center animate-in fade-in duration-500 overflow-y-auto`}>
              <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl'} border max-w-xs w-full border-t-2 border-t-emerald-500 my-auto`}>
                <div className={`w-10 h-10 rounded-lg ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} flex items-center justify-center mx-auto mb-2 border shadow-inner group`}>
                  <PCIcon className="w-5 h-5 text-emerald-500 transition-transform group-hover:scale-110" />
                </div>
                <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'} mb-1 uppercase tracking-tight`}>{t.consoleTerminal}</h3>
                <p className={`text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'} mb-3 leading-relaxed px-1`}>
                  {consoleDevice
                    ? `${t.physicalConnectionDetected} ${consoleDevice.name}. Port: 9600-8-N-1`
                    : t.noConsoleCableDetected}
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    disabled={!consoleDevice}
                    onClick={handleConnect}
                    size="sm"
                    className={`rounded-lg font-black uppercase tracking-widest gap-2 h-8 ${consoleDevice
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95'
                        : isDark ? 'bg-slate-800 text-slate-600' : 'bg-slate-200 text-slate-400'
                      } cursor-not-allowed`}
                  >
                    <TerminalIcon className="w-4 h-4" />
                    {t.connect}
                  </Button>
                  <p className={`text-xs ${isDark ? 'text-slate-700' : 'text-slate-400'} uppercase tracking-[0.1em] font-black`}>
                    {t.consoleConfiguration}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar p-6 space-y-2 font-mono text-sm leading-relaxed flex flex-col"
          >
            <div className="flex-1" /> {/* Spacer to push content down if small */}
            {(activeTab === 'desktop' ? pcOutput : activeConsoleOutput).map((line) => (
              <div key={line.id} className="break-all animate-in fade-in slide-in-from-left-1 duration-200">
                {line.type === 'command' && (
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-500 shrink-0 font-black opacity-50 select-none">
                      {activeTab === 'desktop' ? 'C:\\>' : (line.prompt || '>')}
                    </span>
                    <span className={cmdColor}>{highlightText(line.content)}</span>
                  </div>
                )}
                {line.type === 'prompt' && (
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-500 shrink-0 font-black">{line.prompt}</span>
                  </div>
                )}
                {line.type === 'output' && <span className={`${textColor} whitespace-pre-wrap`}>{highlightText(line.content)}</span>}
                {line.type === 'error' && <span className="text-rose-500 font-bold italic">{highlightText(line.content)}</span>}
                {line.type === 'success' && <span className="text-cyan-500 font-bold uppercase text-xs tracking-widest opacity-80">{highlightText(line.content)}</span>}
              </div>
            ))}
          </div>

          {/* History / Mobile Helpers */}
          {recentCommands.length > 0 && (
            <div className={`md:hidden flex flex-col gap-1 px-4 py-2 border-t ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-100/50'}`}>
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
                    onClick={() => executeCommand(cmd)}
                    disabled={activeTab === 'desktop' ? isCmdInputDisabled : isConsoleInputDisabled}
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

          <div className={`p-4 border-t ${isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
            {((activeTab === 'desktop' && isCmdInputDisabled) || (activeTab === 'terminal' && (isPcPoweredOff || isConsoleTargetPoweredOff))) && (
              <div className="mb-2 px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs font-bold tracking-wider">
                {connectionErrorText || (language === 'tr' ? 'Bağlantı hatası' : 'Connection error')}
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-full">
              <div className={`flex items-center gap-3 px-4 py-2.5 ${inputBg} rounded-xl border ${inputBorder} flex-1 focus-within:border-blue-500/50 transition-all group`}>
                <span className="text-emerald-500 font-black text-xs select-none shrink-0 opacity-50 group-focus-within:opacity-100 transition-opacity">
                  {activeTab === 'desktop'
                    ? 'C:\\>'
                    : (isConsoleConnected ? (activeConsoleOutput.findLast(l => l.prompt !== undefined)?.prompt || '>') : 'OFFLINE>')}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={activeTab === 'desktop' ? isCmdInputDisabled : isConsoleInputDisabled}
                  className={`flex-1 bg-transparent border-none outline-none ${cmdColor} font-mono text-[13px] placeholder:text-slate-500 w-full`}
                  placeholder={activeTab === 'terminal' && !isConsoleConnected ? t.waitingForConnection : (activeTab === 'desktop' ? (isCmdInputDisabled ? connectionErrorText : t.typeCommand) : (isConsoleInputDisabled && isConsoleConnected ? connectionErrorText : t.typeCommand))}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className={`hidden md:flex items-center gap-1.5 px-1.5 py-0.5 rounded border ${isDark ? 'border-slate-800 bg-slate-800/50' : 'border-slate-200 bg-slate-100'} text-[10px] text-slate-500 font-black uppercase tracking-widest`}>
                  <Command className="w-2.5 h-3.5" />
                  Enter
                </div>
              </div>

              <Button
                onClick={() => executeCommand()}
                disabled={(activeTab === 'desktop' ? isCmdInputDisabled : isConsoleInputDisabled) || !input.trim()}
                size="icon"
                className={`shrink-0 h-11 w-full sm:w-11 rounded-xl transition-all shadow-lg ${input.trim()
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-95'
                    : isDark ? 'bg-slate-800 text-slate-700' : 'bg-slate-200 text-slate-400'
                  } cursor-not-allowed opacity-50`}
              >
                <CornerDownLeft className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Snake Game Overlay */}
      <AnimatePresence>
        {gameActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setGameActive(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-cyan-500/20`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  🐍 {gameLanguage === 'tr' ? 'Yılan Oyunu' : 'Snake Game'}
                </h2>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {gameLanguage === 'tr' ? 'Skor' : 'Score'}: <span className="text-cyan-500">{gameScore}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGameActive(false)}
                    className="text-slate-500 hover:text-rose-400"
                  >
                    ✕
                  </Button>
                </div>
              </div>

              <div className="relative bg-black rounded-lg p-4 mb-4 overflow-hidden">
                <div className="grid grid-cols-30 gap-0" style={{ gridTemplateColumns: 'repeat(30, 1fr)' }}>
                  {Array.from({ length: 600 }).map((_, index) => {
                    const x = index % 30;
                    const y = Math.floor(index / 30);
                    const isSnake = snake.some(s => s.x === x && s.y === y);
                    const isFood = food.x === x && food.y === y;
                    const isHead = snake[0]?.x === x && snake[0]?.y === y;

                    return (
                      <div
                        key={index}
                        className={`aspect-square ${isHead ? 'bg-cyan-400' :
                            isSnake ? 'bg-cyan-600' :
                              isFood ? 'bg-red-500' :
                                'border border-slate-800/30'
                          }`}
                      />
                    );
                  })}
                </div>

                {gameOver && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-red-500 mb-2">
                        {gameLanguage === 'tr' ? 'Oyun Bitti!' : 'Game Over!'}
                      </h3>
                      <p className="text-slate-300 mb-4">
                        {gameLanguage === 'tr' ? 'Final Skor' : 'Final Score'}: {gameScore}
                      </p>
                      <button
                        onClick={() => {
                          setSnake([{ x: 10, y: 10 }]);
                          setFood({ x: 15, y: 15 });
                          setDirection({ x: 1, y: 0 });
                          setGameScore(0);
                          setGameOver(false);
                        }}
                        className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
                      >
                        {gameLanguage === 'tr' ? 'Tekrar Oyna (Boşluk)' : 'Play Again (Space)'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Controls */}
              <div className="flex flex-col items-center gap-4 mt-4 sm:hidden">
                <div className="grid grid-cols-3 gap-2">
                  <div />
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-14 h-14 rounded-full border-cyan-500/30 bg-cyan-500/5"
                    onClick={() => direction.y === 0 && setDirection({ x: 0, y: -1 })}
                  >
                    <ChevronUp className="w-8 h-8 text-cyan-500" />
                  </Button>
                  <div />

                  <Button
                    variant="outline"
                    size="icon"
                    className="w-14 h-14 rounded-full border-cyan-500/30 bg-cyan-500/5"
                    onClick={() => direction.x === 0 && setDirection({ x: -1, y: 0 })}
                  >
                    <ChevronLeft className="w-8 h-8 text-cyan-500" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-14 h-14 rounded-full border-cyan-500/30 bg-cyan-500/5"
                    onClick={() => {
                      if (gameOver) {
                        setSnake([{ x: 10, y: 10 }]);
                        setFood({ x: 15, y: 15 });
                        setDirection({ x: 1, y: 0 });
                        setGameScore(0);
                        setGameOver(false);
                      }
                    }}
                  >
                    <div className="w-4 h-4 rounded-full bg-cyan-500 animate-pulse" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-14 h-14 rounded-full border-cyan-500/30 bg-cyan-500/5"
                    onClick={() => direction.x === 0 && setDirection({ x: 1, y: 0 })}
                  >
                    <ChevronRight className="w-8 h-8 text-cyan-500" />
                  </Button>

                  <div />
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-14 h-14 rounded-full border-cyan-500/30 bg-cyan-500/5"
                    onClick={() => direction.y === 0 && setDirection({ x: 0, y: 1 })}
                  >
                    <ChevronDown className="w-8 h-8 text-cyan-500" />
                  </Button>
                  <div />
                </div>
              </div>

              <div className="flex flex-col gap-2 text-sm text-slate-500 mt-4">
                <p className="font-semibold">{gameLanguage === 'tr' ? 'Kontroller:' : 'Controls:'}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>↑↓←→ {gameLanguage === 'tr' ? 'Yön Tuşları - Yılanı hareket ettir' : 'Arrow Keys - Move snake'}</div>
                  <div>{gameLanguage === 'tr' ? 'Boşluk - Oyunu yeniden başlat' : 'Space - Restart game'}</div>
                  <div>{gameLanguage === 'tr' ? 'Escape - Oyundan çık' : 'Escape - Exit game'}</div>
                  <div className="hidden sm:block">{gameLanguage === 'tr' ? 'Kırmızı yemeyi ye ve büyü!' : 'Eat red food to grow!'}</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getPCConfigDefaults(id: string) {
  const num = id.split('-')[1] || '1';
  return {
    ip: `192.168.1.${10 + parseInt(num)}`,
    mac: `00E0.F7${num.padStart(2, '0')}.A${num}B${num}`
  };
}
