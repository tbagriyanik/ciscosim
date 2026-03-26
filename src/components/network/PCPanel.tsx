'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwitchState } from '@/lib/store/appStore';
import { CableInfo, isCableCompatible, SwitchState } from '@/lib/network/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TerminalOutput } from './Terminal';
import type { CanvasDevice } from './networkTopology.types';
import { checkConnectivity } from '@/lib/network/connectivity';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Laptop, Monitor, Terminal as TerminalIcon, X, CornerDownLeft, Command, Globe, Network, ShieldCheck, History, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Copy, Save } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from "@/hooks/use-toast";
import { isValidMAC, normalizeMAC } from "@/lib/utils";
import { commandHelp } from '@/lib/network/executor';
import { ModernPanel } from '@/components/ui/ModernPanel';
import { useIsMobile, useIsTablet, useIsDesktop } from '@/hooks/use-breakpoint';

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
  topologyDevices?: CanvasDevice[];
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

const expandCommandContext = (mode: keyof typeof commandHelp, rawValue: string) => {
  const helpTree = commandHelp[mode] || commandHelp.user;
  const tokens = rawValue.trim().split(/\s+/).filter(Boolean);
  const hasTrailingSpace = rawValue.endsWith(' ');
  const contextTokens = hasTrailingSpace ? tokens : tokens.slice(0, -1);
  const currentWord = hasTrailingSpace ? '' : (tokens[tokens.length - 1] || '').toLowerCase();
  const contextKey = contextTokens.join(' ').toLowerCase();
  const candidates = contextTokens.length === 0 ? (helpTree[''] || []) : (helpTree[contextKey] || []);
  return { candidates, currentWord, contextTokens };
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

  // Responsive hooks
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();

  // Use granular selector for device state to prevent cascading re-renders
  const deviceState = useSwitchState(deviceId);

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

  // Local settings state
  const [pcIP, setPcIP] = useState(deviceFromTopology?.ip || defaultConfig.ip);
  const [internalPcHostname, setInternalPcHostname] = useState(deviceFromTopology?.name || deviceId);

  const setPcHostname = useCallback((hostname: string) => {
    let processedHostname = hostname.trim();
    if (processedHostname.length > 20) {
      processedHostname = processedHostname.substring(0, 20);
    }
    setInternalPcHostname(processedHostname);
  }, []);

  // Use internalPcHostname for rendering and effects
  useEffect(() => {
    setPcHostname(deviceFromTopology?.name || deviceId);
  }, [deviceFromTopology?.name, deviceId, setPcHostname]);

  const [pcMAC, setPcMAC] = useState(deviceFromTopology?.macAddress || defaultConfig.mac);
  const [pcGateway, setPcGateway] = useState(deviceFromTopology?.gateway || '192.168.1.1');
  const [pcDNS, setPcDNS] = useState(deviceFromTopology?.dns || '8.8.8.8');
  const [pcSubnet, setPcSubnet] = useState(deviceFromTopology?.subnet || '255.255.255.0');
  const [pcIPv6, setPcIPv6] = useState(deviceFromTopology?.ipv6 || '2001:db8:acad:1::10');
  const [pcIPv6Prefix, setPcIPv6Prefix] = useState(deviceFromTopology?.ipv6Prefix || '64');
  const [serviceDnsEnabled, setServiceDnsEnabled] = useState(deviceFromTopology?.services?.dns?.enabled ?? false);
  const [serviceDnsRecords, setServiceDnsRecords] = useState<Array<{ domain: string; address: string }>>(
    deviceFromTopology?.services?.dns?.records || []
  );
  const [dnsFormDomain, setDnsFormDomain] = useState('');
  const [dnsFormAddress, setDnsFormAddress] = useState('');
  const [serviceHttpEnabled, setServiceHttpEnabled] = useState(deviceFromTopology?.services?.http?.enabled ?? false);
  const [serviceHttpContent, setServiceHttpContent] = useState(deviceFromTopology?.services?.http?.content || 'Merhaba Dünya!');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const activeServiceCount = Number(serviceDnsEnabled) + Number(serviceHttpEnabled);

  useEffect(() => {
    setServiceDnsEnabled(deviceFromTopology?.services?.dns?.enabled ?? false);
    setServiceDnsRecords(deviceFromTopology?.services?.dns?.records || []);
    setServiceHttpEnabled(deviceFromTopology?.services?.http?.enabled ?? false);
    setServiceHttpContent(deviceFromTopology?.services?.http?.content || 'Merhaba Dünya!');
  }, [deviceId, deviceFromTopology?.services]);

  const validateIP = (ip: string) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);

  // Validate and sync global state
  const syncToGlobal = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!validateIP(pcIP)) newErrors.ip = 'Geçersiz IP';
    if (!isValidMAC(pcMAC)) newErrors.mac = 'Geçersiz MAC';
    if (pcSubnet && !validateIP(pcSubnet)) newErrors.subnet = 'Geçersiz Subnet';
    if (pcGateway && !validateIP(pcGateway)) newErrors.gateway = 'Geçersiz Gateway';
    if (pcDNS && !validateIP(pcDNS)) newErrors.dns = 'Geçersiz DNS';

    setErrors(newErrors);

    if (deviceId) {
      window.dispatchEvent(new CustomEvent('update-topology-device-config', {
        detail: {
          deviceId: deviceId,
          config: {
            name: internalPcHostname,
            ip: pcIP,
            macAddress: isValidMAC(pcMAC) ? normalizeMAC(pcMAC) : pcMAC,
            subnet: pcSubnet,
            gateway: pcGateway,
            dns: pcDNS,
            ipv6: pcIPv6,
            ipv6Prefix: pcIPv6Prefix,
            services: {
              dns: {
                enabled: serviceDnsEnabled,
                records: serviceDnsRecords
              },
              http: {
                enabled: serviceHttpEnabled,
                content: serviceHttpContent || 'Merhaba Dünya!'
              }
            }
          }
        }
      }));
    }
  }, [internalPcHostname, pcIP, pcMAC, pcSubnet, pcGateway, pcDNS, pcIPv6, pcIPv6Prefix, serviceDnsEnabled, serviceDnsRecords, serviceHttpEnabled, serviceHttpContent, deviceId]);

  // Trigger sync on change (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      syncToGlobal();
    }, 500);
    return () => clearTimeout(handler);
  }, [pcIP, pcMAC, pcSubnet, pcGateway, pcDNS, pcIPv6, pcIPv6Prefix, internalPcHostname, serviceDnsEnabled, serviceDnsRecords, serviceHttpEnabled, serviceHttpContent, syncToGlobal]);

  // Local output for Desktop (Local) - initialize from prop if available
  const getInitialPcOutput = (): OutputLine[] => {
    if (pcOutputs?.has(deviceId)) {
      return pcOutputs.get(deviceId)!;
    }
    return [{
      id: '1',
      type: 'output',
      content: 'OS Windows [Version 10.0.19045.4412]\n(c) OS Corporation. All rights reserved.\n'
    }];
  };

  const [pcOutput, setPcOutput] = useState<OutputLine[]>(() => getInitialPcOutput());

  // Sync pcOutput when deviceId changes or pcOutputs prop updates
  useEffect(() => {
    if (pcOutputs?.has(deviceId)) {
      setPcOutput(pcOutputs.get(deviceId)!);
    } else {
      setPcOutput([{
        id: '1',
        type: 'output',
        content: 'OS Windows [Version 10.0.19045.4412]\n(c) OS Corporation. All rights reserved.\n'
      }]);
    }
  }, [deviceId, pcOutputs]);

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
  const [consoleConnectionTime, setConsoleConnectionTime] = useState<number>(0);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandQueueRef = useRef<string[]>([]);
  const isProcessingQueueRef = useRef(false);

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
      if (conn.cableType !== 'console' || conn.active === false) return false;
      const isSource = conn.sourceDeviceId === deviceId;
      const isTarget = conn.targetDeviceId === deviceId;
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
        if (head.x < 0 || head.x >= 30 || head.y < 0 || head.y >= 20) {
          setGameOver(true);
          return currentSnake;
        }
        if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
          setGameOver(true);
          return currentSnake;
        }
        newSnake.unshift(head);
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
      switch (e.key) {
        case 'ArrowUp': if (direction.y === 0) setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (direction.y === 0) setDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (direction.x === 0) setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (direction.x === 0) setDirection({ x: 1, y: 0 }); break;
      }
    };
    window.addEventListener('keydown', handleGameKey);
    return () => window.removeEventListener('keydown', handleGameKey);
  }, [gameActive, direction, gameOver]);

  // Synchronized Console Output from Global State
  const activeConsoleOutput = useMemo(() => {
    if (!isConsoleConnected || !connectedDeviceId) return [];
    const allOutput = deviceOutputs?.get(connectedDeviceId) || [];
    return allOutput.filter((line: any) => (line.timestamp || 0) >= consoleConnectionTime);
  }, [isConsoleConnected, connectedDeviceId, deviceOutputs, consoleConnectionTime]);

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
    if (consoleAwaitingPassword) {
      setShowConsolePasswordPrompt(true);
      setConsolePasswordInput('');
      setTimeout(() => consolePasswordRef.current?.focus(), 0);
    } else {
      setShowConsolePasswordPrompt(false);
      setConsolePasswordInput('');
    }
  }, [consoleAwaitingPassword]);

  const consoleAuthenticated = useMemo(() => {
    if (!connectedDeviceId) return true;
    return deviceStates?.get(connectedDeviceId)?.consoleAuthenticated !== false;
  }, [connectedDeviceId, deviceStates]);

  useEffect(() => {
    if (!connectedDeviceId) return;
    if (consolePasswordAttempted && consoleAwaitingPassword) {
      toast({
        title: language === 'tr' ? 'Parola Hatalı' : 'Incorrect Password',
        description: language === 'tr' ? 'Lütfen doğru parolayı girin.' : 'Please enter the correct password.',
        variant: 'destructive',
      });
      setConsolePasswordAttempted(false);
      setIsConsoleConnected(false);
      setConnectedDeviceId(null);
    } else if (consolePasswordAttempted && !consoleAwaitingPassword && consoleAuthenticated) {
      setIsConsoleConnected(true);
      setConsolePasswordAttempted(false);
    }
  }, [consoleAuthenticated, consoleAwaitingPassword, consolePasswordAttempted, connectedDeviceId, language]);

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

  const canReachTargetIp = useCallback((targetIp: string) => {
    const result = checkConnectivity(deviceId, targetIp, topologyDevices as any, topologyConnections as any, deviceStates || new Map());
    return result.success;
  }, [deviceId, topologyDevices, topologyConnections, deviceStates]);

  const isValidIpv4 = useCallback((value: string) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value.trim()), []);

  const isSameSubnet = useCallback((sourceIp: string, targetIp: string, subnetMask: string) => {
    try {
      const a = sourceIp.split('.').map(Number);
      const b = targetIp.split('.').map(Number);
      const m = subnetMask.split('.').map(Number);
      if (a.length !== 4 || b.length !== 4 || m.length !== 4) return false;
      for (let i = 0; i < 4; i += 1) {
        if ((a[i] & m[i]) !== (b[i] & m[i])) return false;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const hasGatewayForTarget = useCallback((targetIp: string) => {
    if (!isValidIpv4(pcIP) || !isValidIpv4(targetIp) || !isValidIpv4(pcSubnet)) return false;
    if (isSameSubnet(pcIP, targetIp, pcSubnet)) return true;
    return isValidIpv4(pcGateway);
  }, [isSameSubnet, isValidIpv4, pcGateway, pcIP, pcSubnet]);

  const resolveDomainWithDnsServices = useCallback((domain: string) => {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) return null;

    if (!isValidIpv4(pcDNS)) return null;
    const configuredDnsServer = topologyDevices.find(
      (d) => d.type === 'pc' && d.ip === pcDNS && d.services?.dns?.enabled && (d.services?.dns?.records?.length || 0) > 0
    );
    if (!configuredDnsServer?.ip || !canReachTargetIp(configuredDnsServer.ip)) return null;

    const record = configuredDnsServer.services?.dns?.records?.find((r) => r.domain.toLowerCase() === normalized);
    if (!record) return null;

    return { address: record.address, server: configuredDnsServer };
  }, [canReachTargetIp, isValidIpv4, pcDNS, topologyDevices]);

  const findHttpServerByTarget = useCallback((target: string) => {
    const normalizedTarget = target.trim().toLowerCase();
    if (!normalizedTarget) return null;

    const byIp = topologyDevices.find(
      (d) => d.type === 'pc' && d.ip === target && d.services?.http?.enabled
    );
    if (byIp && byIp.ip && canReachTargetIp(byIp.ip)) return byIp;

    const dnsResult = resolveDomainWithDnsServices(normalizedTarget);
    if (!dnsResult) return null;

    const resolvedServer = topologyDevices.find(
      (d) => d.type === 'pc' && d.ip === dnsResult.address && d.services?.http?.enabled
    ) || null;

    if (!resolvedServer?.ip || !canReachTargetIp(resolvedServer.ip)) return null;
    return resolvedServer;
  }, [canReachTargetIp, resolveDomainWithDnsServices, topologyDevices]);

  const formatMacForArp = useCallback((mac?: string) => {
    if (!mac) return '';
    const hex = mac.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
    if (hex.length !== 12) return mac.toLowerCase();
    return hex.match(/.{1,2}/g)?.join('-') || mac.toLowerCase();
  }, []);

  const buildArpTableOutput = useCallback(() => {
    const reachableHosts = topologyDevices
      .filter((d) => d.id !== deviceId && !!d.ip && !!d.macAddress)
      .filter((d) => canReachTargetIp(d.ip))
      .map((d) => ({
        ip: d.ip,
        mac: formatMacForArp(d.macAddress),
        type: 'dynamic',
      }));

    if (reachableHosts.length === 0) {
      return `Interface: ${pcIP} --- 0x3\n  Internet Address      Physical Address      Type`;
    }

    const rows = reachableHosts
      .map((h) => `  ${h.ip.padEnd(20)} ${h.mac.padEnd(21)} ${h.type}`)
      .join('\n');

    return `Interface: ${pcIP} --- 0x3\n  Internet Address      Physical Address      Type\n${rows}`;
  }, [canReachTargetIp, deviceId, formatMacForArp, pcIP, topologyDevices]);

  const handleConnect = async () => {
    if (!consoleDevice) return;
    setConnectedDeviceId(consoleDevice.id);
    setConsoleConnectionTime(Date.now());
    if (onExecuteDeviceCommand) {
      await onExecuteDeviceCommand(consoleDevice.id, '__CONSOLE_CONNECT__');
      const deviceState = deviceStates?.get(consoleDevice.id);
      if (!deviceState?.awaitingPassword) {
        setIsConsoleConnected(true);
      }
    } else {
      setIsConsoleConnected(true);
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
    if (history[0] !== command) {
      const newHistory = [command, ...history].slice(0, 50);
      setHistory(newHistory);
      if (onUpdatePCHistory) onUpdatePCHistory(deviceId, newHistory);
    }
    setHistoryIndex(-1);
    setInput('');
    if (activeTab === 'desktop') {
      addLocalOutput('command', command);
      const parts = command.split(' ');
      const cmd = parts[0].toLowerCase();
      const normalizedCmd = cmd
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const args = parts.slice(1);
      if (normalizedCmd === 'snake' || normalizedCmd === 'yilan') {
        setGameActive(true);
        setSnake([{ x: 10, y: 10 }]);
        setFood({ x: 15, y: 15 });
        setDirection({ x: 1, y: 0 });
        setGameScore(0);
        setGameOver(false);
        setGameLanguage(normalizedCmd === 'yilan' ? 'tr' : 'en');
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
          addLocalOutput('output', `OS IP Configuration\n\n   Host Name . . . . . . . . . . . . : ${internalPcHostname}\n   Physical Address. . . . . . . . . : ${pcMAC}\n   DHCP Enabled. . . . . . . . . . . : No\n   IPv4 Address. . . . . . . . . . . : ${pcIP}(Preferred)\n   Subnet Mask . . . . . . . . . . . : ${pcSubnet}\n   Default Gateway . . . . . . . . . : ${pcGateway}\n   DNS Servers . . . . . . . . . . . : ${pcDNS}`);
        } else {
          addLocalOutput('output', `OS IP Configuration\n\nEthernet adapter Ethernet0:\n   IPv4 Address. . . . . . . . . . . : ${pcIP}\n   Subnet Mask . . . . . . . . . . . : ${pcSubnet}\n   Default Gateway . . . . . . . . . : ${pcGateway}`);
        }
      } else if (cmd === 'ping') {
        const target = args[0];
        if (!target) {
          addLocalOutput('output', 'Usage: ping <target_name_or_address>');
        } else {
          const result = checkConnectivity(deviceId, target, topologyDevices as any, topologyConnections as any, deviceStates || new Map());
          if (result.success) {
            addLocalOutput('output', `Pinging ${target} with 32 bytes of data:\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\n\nPing statistics for ${target}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`);
          } else {
            addLocalOutput('output', `Pinging ${target} with 32 bytes of data:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\n\nPing statistics for ${target}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)`);
          }
        }
      } else if (cmd === 'nslookup') {
        const targetDomain = args[0];
        if (!targetDomain) {
          addLocalOutput('output', 'Usage: nslookup <domain>');
        } else if (!isValidIpv4(pcDNS)) {
          addLocalOutput('error', language === 'tr' ? 'DNS adresi geçersiz veya eksik.' : 'DNS address is missing or invalid.');
        } else if (!hasGatewayForTarget(pcDNS)) {
          addLocalOutput('error', language === 'tr' ? 'DNS sunucusuna erişim için gateway gerekli.' : 'Gateway is required to reach DNS server.');
        } else {
          const dnsResult = resolveDomainWithDnsServices(targetDomain);
          if (!dnsResult) {
            addLocalOutput('output', `*** DNS request timed out\n*** Can't find ${targetDomain}: Non-existent domain`);
          } else {
            addLocalOutput(
              'output',
              `Server: ${dnsResult.server.name}\nAddress: ${dnsResult.server.ip}\n\nName: ${targetDomain}\nAddress: ${dnsResult.address}`
            );
          }
        }
      } else if (cmd === 'http') {
        const target = args[0];
        if (!target) {
          addLocalOutput('output', 'Usage: http <ip_or_domain>');
        } else if (isValidIpv4(target) && !hasGatewayForTarget(target)) {
          addLocalOutput('error', language === 'tr' ? 'Hedefe erişim için gateway gerekli.' : 'Gateway is required to reach target.');
        } else if (!isValidIpv4(target) && !isValidIpv4(pcDNS)) {
          addLocalOutput('error', language === 'tr' ? 'Alan adı çözümlemek için DNS adresi gerekli.' : 'A valid DNS address is required to resolve domain.');
        } else if (!isValidIpv4(target) && !hasGatewayForTarget(pcDNS)) {
          addLocalOutput('error', language === 'tr' ? 'DNS sunucusuna erişim için gateway gerekli.' : 'Gateway is required to reach DNS server.');
        } else {
          const httpServer = findHttpServerByTarget(target);
          if (!httpServer) {
            addLocalOutput('error', `HTTP service is unavailable for ${target}`);
          } else {
            addLocalOutput('output', httpServer.services?.http?.content || 'Merhaba Dünya!');
          }
        }
      } else if (cmd === 'arp') {
        if (args.length === 0 || (args.length === 1 && args[0].toLowerCase() === '-a')) {
          addLocalOutput('output', buildArpTableOutput());
        } else {
          addLocalOutput('output', 'Usage: arp -a');
        }
      } else if (cmd === 'help' || cmd === '?') {
        addLocalOutput('output', `Available commands: ipconfig, ping, nslookup, http, tracert, arp, netstat, hostname, dir, ver, cls, exit, quit, snake`);
      } else if (cmd === 'cls') {
        setPcOutput([]);
      } else if (cmd === 'exit' || cmd === 'quit') {
        onClose();
      } else if (cmd === 'hostname') {
        if (args[0]) {
          setPcHostname(args[0]);
          addLocalOutput('success', `Hostname set to ${args[0]}`);
        } else {
          addLocalOutput('output', internalPcHostname);
        }
      } else {
        addLocalOutput('error', `'${command}' is not recognized as an internal or external command.`);
      }
    } else {
      // Console mode - send to connected device
      if (!isConsoleConnected) {
        addLocalOutput('error', language === 'tr' ? 'Bağlı bir cihaz yok' : 'No device connected');
        return;
      }
      const trimmedCmd = command.trim().toLowerCase();
      // Handle help command
      if (trimmedCmd === '?' || trimmedCmd === 'help') {
        const helpOutput = language === 'tr'
          ? 'Mevcut komutlar:\n  enable   - Privileged mode\n  exit     - Konsoldan çık\n  show     - Bilgi göster\n  ?        - Yardım\n'
          : 'Available commands:\n  enable   - Enter privileged mode\n  exit     - Disconnect from console\n  show     - Show information\n  ?        - Help\n';
        addLocalOutput('output', helpOutput);
        return;
      }
      if (onExecuteDeviceCommand && connectedDeviceId) {
        try { await onExecuteDeviceCommand(connectedDeviceId, command); } catch (err) { }
      }
    }
  };

  const handleTabComplete = useCallback(() => {
    const value = input;
    if (!value && tabCycleIndex === -1) return;
    const mode = activeTab === 'desktop' ? 'user' : 'user';
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
    } else if (value.trim() && activeTab === 'terminal' && isConsoleConnected) {
      // No matches in console mode - trigger help
      executeCommand(value.trim() + ' ?');
    }
  }, [input, tabCycleIndex, lastTabInput, activeTab, isConsoleConnected]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') executeCommand();
    else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabComplete();
    }
    else if (e.key === 'ArrowUp') {
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
    }
  };

  const recentCommands = history.slice(0, 10);

  const headerAction = (
    <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
      {activeTab === 'desktop' && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                className={`h-8 w-8 rounded-lg ui-hover-surface ${isDark ? 'text-slate-300 hover:text-emerald-400' : 'text-slate-600 hover:text-emerald-600'}`}
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
                className={`h-8 w-8 rounded-lg ui-hover-surface ${isDark ? 'text-slate-300 hover:text-emerald-400' : 'text-slate-600 hover:text-emerald-600'}`}
                aria-label={t.copy}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.copy}</TooltipContent>
          </Tooltip>
        </>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onTogglePower?.(deviceId)}
            className={`h-8 w-8 rounded-lg ui-hover-surface transition-all ${isPcPoweredOff ? 'text-rose-500 hover:text-rose-400' : 'text-emerald-500 hover:text-emerald-400'}`}
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
    </div>
  );

  if (!isVisible) return null;

  return (
    <ModernPanel
      id={deviceId}
      title={`${internalPcHostname} (${pcIP})`}
      onClose={onClose}
      headerAction={headerAction}
      className={`
        w-full h-full min-w-0 
        ${isMobile ? 'max-w-none' : 'max-w-none'} 
        ${isDesktop ? '2xl:max-w-[1400px] 2xl:mx-auto' : ''}
      `}
    >
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogContent className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white'} sm:max-w-md`}>
            <DialogHeader>
              <DialogTitle>{language === 'tr' ? 'Çıktıda ara' : 'Search output'}</DialogTitle>
              <DialogDescription className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                {language === 'tr' ? 'Eşleşmeler çıktı alanında vurgulanır.' : 'Matches will be highlighted in the output.'}
              </DialogDescription>
            </DialogHeader>
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={language === 'tr' ? 'Arama...' : 'Search...'} autoFocus />
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

        {/* Navigation Tabs */}
        <div className={`px-4 py-1.5 flex items-center gap-1 border-b ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} ${isMobile ? 'flex-wrap' : ''}`}>
          <Button
            variant={activeTab === 'desktop' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('desktop')}
            className={`h-9 px-4 text-xs font-black tracking-wider transition-all gap-2 ${activeTab === 'desktop' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
          >
            <Command className="w-4 h-4" />
            <span className={isMobile ? 'text-[10px]' : 'hidden sm:inline'}>{language === 'tr' ? 'Komut İstemi' : 'Command Prompt'}</span>
          </Button>
          <Button
            variant={activeTab === 'terminal' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('terminal')}
            className={`h-9 px-4 text-xs font-black tracking-wider  transition-all gap-2 ${activeTab === 'terminal' ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-500 hover:text-emerald-500'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
          >
            <TerminalIcon className="w-4 h-4" />
            <span className={isMobile ? 'text-[10px]' : 'hidden sm:inline'}>{language === 'tr' ? 'Konsol' : 'Console'}</span>
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('settings')}
            className={`h-9 px-4 text-xs font-black tracking-wider  transition-all gap-2 ${activeTab === 'settings' ? 'bg-purple-500/10 text-purple-500' : 'text-slate-500 hover:text-purple-500'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className={isMobile ? 'text-[10px]' : 'hidden sm:inline'}>{language === 'tr' ? 'Ayarlar' : 'Settings'}</span>
          </Button>
          <Button
            variant={activeTab === 'services' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('services')}
            className={`h-9 px-4 text-xs font-black tracking-wider transition-all gap-2 ${activeTab === 'services' ? 'bg-amber-500/10 text-amber-500' : 'text-slate-500 hover:text-amber-500'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
          >
            <Globe className="w-4 h-4" />
            <span className={isMobile ? 'text-[10px]' : 'hidden sm:inline'}>
              {(language === 'tr' ? 'Servisler' : 'Services') + ` (${activeServiceCount}/2)`}
            </span>
          </Button>
        </div>

        {/* Content Area */}
        <div className={`flex-1 flex flex-col overflow-hidden ${terminalBg} relative min-h-0`}>
          {activeTab === 'settings' ? (
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{language === 'tr' ? 'Cihaz Adı' : 'Hostname'}</label>
                <Input value={internalPcHostname} onChange={(e) => setPcHostname(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">MAC Address</label>
                <Input value={pcMAC} onChange={(e) => setPcMAC(e.target.value)} className={errors.mac ? 'border-rose-500' : ''} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">IP Address</label>
                  <Input value={pcIP} onChange={(e) => setPcIP(e.target.value)} className={errors.ip ? 'border-rose-500' : ''} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Subnet Mask</label>
                  <Input value={pcSubnet} onChange={(e) => setPcSubnet(e.target.value)} className={errors.subnet ? 'border-rose-500' : ''} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Gateway</label>
                  <Input value={pcGateway} onChange={(e) => setPcGateway(e.target.value)} className={errors.gateway ? 'border-rose-500' : ''} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">DNS</label>
                  <Input value={pcDNS} onChange={(e) => setPcDNS(e.target.value)} className={errors.dns ? 'border-rose-500' : ''} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">IPv6 Address</label>
                  <Input value={pcIPv6} onChange={(e) => setPcIPv6(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">IPv6 Prefix</label>
                  <Input value={pcIPv6Prefix} onChange={(e) => setPcIPv6Prefix(e.target.value)} />
                </div>
              </div>
            </div>
          ) : activeTab === 'services' ? (
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              <div className={`rounded-xl border p-4 space-y-4 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold">DNS</h3>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {language === 'tr' ? 'Alan adı -> IP adresi kayıtlarını yönet.' : 'Manage domain to IP address records.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={serviceDnsEnabled}
                    onClick={() => setServiceDnsEnabled((prev) => !prev)}
                    className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
                      serviceDnsEnabled
                        ? 'bg-cyan-500/90 border-cyan-400'
                        : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300')
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        serviceDnsEnabled ? 'translate-x-8' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    value={dnsFormDomain}
                    onChange={(e) => setDnsFormDomain(e.target.value)}
                    placeholder={language === 'tr' ? 'Alan adı (or: site.local)' : 'Domain (ex: site.local)'}
                  />
                  <Input
                    value={dnsFormAddress}
                    onChange={(e) => setDnsFormAddress(e.target.value)}
                    placeholder={language === 'tr' ? 'Adres (or: 192.168.1.10)' : 'Address (ex: 192.168.1.10)'}
                  />
                  <Button
                    onClick={() => {
                      const domain = dnsFormDomain.trim().toLowerCase();
                      const address = dnsFormAddress.trim();
                      if (!domain || !address) return;
                      setServiceDnsRecords((prev) => {
                        const withoutSame = prev.filter((r) => r.domain.toLowerCase() !== domain);
                        return [...withoutSame, { domain, address }];
                      });
                      setDnsFormDomain('');
                      setDnsFormAddress('');
                    }}
                  >
                    {language === 'tr' ? 'Kayıt Ekle' : 'Add Record'}
                  </Button>
                </div>

                <div className="space-y-2">
                  {serviceDnsRecords.length === 0 && (
                    <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      {language === 'tr' ? 'Henüz DNS kaydı yok.' : 'No DNS records yet.'}
                    </div>
                  )}
                  {serviceDnsRecords.map((record) => (
                    <div key={`${record.domain}-${record.address}`} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-50 border border-slate-200'}`}>
                      <div className="text-xs font-mono">
                        <span>{record.domain}</span>
                        <span className="mx-2 opacity-60">-&gt;</span>
                        <span>{record.address}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setServiceDnsRecords((prev) => prev.filter((r) => !(r.domain === record.domain && r.address === record.address)))}
                      >
                        {language === 'tr' ? 'Sil' : 'Delete'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-xl border p-4 space-y-4 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold">HTTP</h3>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {language === 'tr' ? 'HTTP açıkken bu cihazın web içeriği yayınlanır.' : 'When enabled, this PC serves web content.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={serviceHttpEnabled}
                    onClick={() => setServiceHttpEnabled((prev) => !prev)}
                    className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                      serviceHttpEnabled
                        ? 'bg-emerald-500/90 border-emerald-400'
                        : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300')
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        serviceHttpEnabled ? 'translate-x-8' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">HTTP Content</label>
                  <Input
                    value={serviceHttpContent}
                    onChange={(e) => setServiceHttpContent(e.target.value)}
                    placeholder="Merhaba Dünya!"
                  />
                  {serviceHttpEnabled && (
                    <div className={`text-xs rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>
                      {serviceHttpContent || 'Merhaba Dünya!'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'terminal' && (
                <div className={`px-4 py-2 border-b ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'} flex items-center justify-between gap-3`}>
                  <div className="text-xs">
                    {isConsoleConnected && connectedDeviceId ? (
                      <span className="text-emerald-500">
                        {t.physicalConnectionDetected} {topologyDevices.find(d => d.id === connectedDeviceId)?.name || connectedDeviceId}
                      </span>
                    ) : (
                      <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.noConsoleCableDetected}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={isConsoleConnected ? () => { setIsConsoleConnected(false); setConnectedDeviceId(null); } : handleConnect}
                    disabled={isPcPoweredOff || (!consoleDevice && !isConsoleConnected)}
                    className={isConsoleConnected ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
                  >
                    {isConsoleConnected ? t.disconnect : t.connect}
                  </Button>
                </div>
              )}
              <div
                ref={outputRef}
                className={`flex-1 overflow-y-auto scroll-smooth custom-scrollbar p-4 sm:p-6 space-y-2 font-mono text-sm leading-relaxed flex flex-col ${isPcPoweredOff ? 'bg-black' : ''}`}
              >
                {isPcPoweredOff ? (
                  <div className="flex-1 flex items-center justify-center text-slate-700">POWERED OFFLINE</div>
                ) : gameActive && activeTab === 'desktop' ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {gameLanguage === 'tr'
                        ? `Skor: ${gameScore} | Çıkış: ESC | Yeniden: SPACE`
                        : `Score: ${gameScore} | Exit: ESC | Restart: SPACE`}
                    </div>
                    <div
                      className={`grid border rounded-md p-1 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'}`}
                      style={{ gridTemplateColumns: 'repeat(30, minmax(0, 10px))', gridTemplateRows: 'repeat(20, minmax(0, 10px))', gap: '1px' }}
                    >
                      {Array.from({ length: 30 * 20 }).map((_, idx) => {
                        const x = idx % 30;
                        const y = Math.floor(idx / 30);
                        const isHead = snake[0]?.x === x && snake[0]?.y === y;
                        const isBody = snake.slice(1).some((s) => s.x === x && s.y === y);
                        const isFood = food.x === x && food.y === y;

                        return (
                          <div
                            key={idx}
                            className={`w-[10px] h-[10px] ${
                              isHead
                                ? 'bg-emerald-400'
                                : isBody
                                  ? 'bg-emerald-600'
                                  : isFood
                                    ? 'bg-rose-500'
                                    : (isDark ? 'bg-slate-800' : 'bg-slate-100')
                            }`}
                          />
                        );
                      })}
                    </div>
                    {gameOver && (
                      <div className="text-rose-500 font-bold text-sm">
                        {gameLanguage === 'tr' ? 'Oyun Bitti!' : 'Game Over!'}
                      </div>
                    )}
                  </div>
                ) : (
                  (activeTab === 'desktop' ? pcOutput : activeConsoleOutput).map((line) => (
                    <div key={line.id} className="break-all animate-in fade-in slide-in-from-left-1 duration-200">
                      {line.type === 'command' && (
                        <div className="flex items-start gap-3">
                          <span className="text-emerald-500 shrink-0 font-black opacity-50 select-none">
                            {activeTab === 'desktop' ? `${internalPcHostname} C:\\>` : (line.prompt || '>')}
                          </span>
                          <span className={cmdColor}>{highlightText(line.content)}</span>
                        </div>
                      )}
                      {line.type === 'output' && <span className={`${textColor} whitespace-pre-wrap`}>{highlightText(line.content)}</span>}
                      {line.type === 'error' && <span className="text-rose-500 font-bold italic">{highlightText(line.content)}</span>}
                      {line.type === 'success' && <span className="text-cyan-500 font-bold uppercase text-xs tracking-widest opacity-80">{highlightText(line.content)}</span>}
                    </div>
                  ))
                )}
                {activeTab === 'terminal' && !isPcPoweredOff && !isConsoleConnected && (
                  <div className={`mt-auto text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    {t.waitingForConnection}
                  </div>
                )}
              </div>
            </>
          )}

          {(activeTab === 'desktop' || activeTab === 'terminal') && !isPcPoweredOff && (
            <div className={`sticky bottom-0 inset-x-0 z-10 p-3 sm:p-4 border-t ${isDark ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-slate-50/95'}`}>
              <div className={`flex items-center gap-2 sm:gap-3 ${isMobile ? 'flex-col' : ''}`}>
                <div className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 ${inputBg} rounded-xl border ${inputBorder} flex-1 group ${isMobile ? 'w-full' : ''}`}>
                  <span className="text-emerald-500 font-black text-xs select-none shrink-0 opacity-50">
                    {activeTab === 'desktop' ? `${internalPcHostname} C:\\>` : '>'}
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent border-none outline-none font-mono text-[13px]"
                    placeholder={t.typeCommand}
                    autoComplete="off"
                    disabled={activeTab === 'desktop' ? isCmdInputDisabled : isConsoleInputDisabled}
                  />
                </div>
                <Button
                  onClick={() => executeCommand()}
                  disabled={!input.trim() || (activeTab === 'desktop' ? isCmdInputDisabled : isConsoleInputDisabled)}
                  size="icon"
                  className={`shrink-0 h-11 w-11 rounded-xl bg-blue-600 text-white ${isMobile ? 'w-full' : ''}`}
                >
                  <CornerDownLeft className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModernPanel>
  );
}

type PCActiveTab = 'desktop' | 'terminal' | 'settings' | 'services';

function getPCConfigDefaults(id: string) {
  const num = id.split('-')[1] || '1';
  return {
    ip: `192.168.1.${10 + parseInt(num)}`,
    mac: `00-40-96-99-88-7${num}`
  };
}
