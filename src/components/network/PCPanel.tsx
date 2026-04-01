'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback, useMemo } from 'react';
import { useSwitchState, useAppStore } from '@/lib/store/appStore';
import { CableInfo, isCableCompatible, SwitchState } from '@/lib/network/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TerminalOutput } from './Terminal';
import type { CanvasDevice } from './networkTopology.types';
import { checkConnectivity } from '@/lib/network/connectivity';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Laptop, Monitor, Terminal as TerminalIcon, X, CornerDownLeft, Command, Globe, Network, ShieldCheck, History, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Copy, Save, Trash2, Download, Settings, Wifi } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from "@/hooks/use-toast";
import { isValidMAC, normalizeMAC, cn } from "@/lib/utils";
import { commandHelp } from '@/lib/network/executor';
import { ModernPanel } from '@/components/ui/ModernPanel';
import { useIsMobile, useIsDesktop } from '@/hooks/use-breakpoint';

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

interface DhcpPoolConfig {
  poolName: string;
  defaultGateway: string;
  dnsServer: string;
  startIp: string;
  subnetMask: string;
  maxUsers: number;
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
  onNavigate?: (program: string) => void;
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
  onExecuteDeviceCommand,
  onNavigate
}: PCPanelProps) {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Responsive hooks
  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();

  // Use granular selector for device state to prevent cascading re-renders
  const deviceState = useSwitchState(deviceId);

  const terminalBg = isDark ? 'bg-black shadow-inner' : 'bg-slate-50 shadow-inner border border-slate-200';
  const textColor = isDark ? 'text-slate-400' : 'text-slate-600';
  const cmdColor = isDark ? 'text-slate-100' : 'text-slate-900';
  const inputBg = isDark ? 'bg-black/50' : 'bg-white';
  const inputBorder = isDark ? 'border-slate-800' : 'border-slate-300';

  const [activeTab, setActiveTab] = useState<PCActiveTab>('home');
  const tabletHistoryRef = useRef<PCActiveTab[]>(['home']);
  const tabletHistoryIndexRef = useRef(0);
  const isInternalTabletNavRef = useRef(false);

  const goHome = useCallback(() => {
    setActiveTab('home');
    tabletHistoryRef.current = ['home'];
    tabletHistoryIndexRef.current = 0;
    onNavigate?.('home');
  }, [onNavigate]);

  const navigateToProgram = useCallback((program: PCActiveTab) => {
    if (program === 'home') {
      // Going home - pop from history
      if (tabletHistoryIndexRef.current > 0) {
        tabletHistoryIndexRef.current--;
        isInternalTabletNavRef.current = true;
        setActiveTab(tabletHistoryRef.current[tabletHistoryIndexRef.current]);
        onNavigate?.('home');
      } else {
        setActiveTab('home');
        onNavigate?.('home');
      }
    } else {
      // Going to a program - push to history
      tabletHistoryRef.current = tabletHistoryRef.current.slice(0, tabletHistoryIndexRef.current + 1);
      tabletHistoryRef.current.push(program);
      tabletHistoryIndexRef.current = tabletHistoryRef.current.length - 1;
      setActiveTab(program);
      onNavigate?.(program);
    }
  }, [onNavigate]);

  // Handle browser back button for tablet navigation
  useEffect(() => {
    const handleTabletPopState = (e: CustomEvent) => {
      const { program } = e.detail || {};
      if (program === 'home' && tabletHistoryIndexRef.current > 0) {
        tabletHistoryIndexRef.current--;
        isInternalTabletNavRef.current = true;
        setActiveTab(tabletHistoryRef.current[tabletHistoryIndexRef.current]);
      }
    };
    window.addEventListener('tablet-back', handleTabletPopState as EventListener);
    return () => window.removeEventListener('tablet-back', handleTabletPopState as EventListener);
  }, []);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [input, setInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // History State
  const [history, setHistory] = useState<string[]>(() => {
    return pcHistories?.get(deviceId) || [];
  });
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Undo/Redo state
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

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
  const [ipConfigMode, setIpConfigMode] = useState<'static' | 'dhcp'>(deviceFromTopology?.ipConfigMode || 'static');
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
  const [editingDnsIndex, setEditingDnsIndex] = useState<number | null>(null);
  const [serviceHttpEnabled, setServiceHttpEnabled] = useState(deviceFromTopology?.services?.http?.enabled ?? false);
  const [serviceHttpContent, setServiceHttpContent] = useState(deviceFromTopology?.services?.http?.content || 'Merhaba Dünya!');
  const [serviceDhcpEnabled, setServiceDhcpEnabled] = useState(deviceFromTopology?.services?.dhcp?.enabled ?? false);
  const [serviceDhcpPools, setServiceDhcpPools] = useState<DhcpPoolConfig[]>(deviceFromTopology?.services?.dhcp?.pools || []);
  const [dhcpForm, setDhcpForm] = useState<DhcpPoolConfig>({
    poolName: '',
    defaultGateway: '',
    dnsServer: '',
    startIp: '',
    subnetMask: '255.255.255.0',
    maxUsers: 50,
  });
  const [editingDhcpIndex, setEditingDhcpIndex] = useState<number | null>(null);
  const [wifiEnabled, setWifiEnabled] = useState(deviceFromTopology?.wifi?.enabled ?? false);
  const [wifiSSID, setWifiSSID] = useState(deviceFromTopology?.wifi?.ssid ?? '');
  const [wifiSecurity, setWifiSecurity] = useState(deviceFromTopology?.wifi?.security ?? 'open');
  const [wifiPassword, setWifiPassword] = useState(deviceFromTopology?.wifi?.password ?? '');
  const [wifiChannel, setWifiChannel] = useState(deviceFromTopology?.wifi?.channel ?? '2.4GHz');
  const [wifiBSSID, setWifiBSSID] = useState(deviceFromTopology?.wifi?.bssid ?? '');

  // Scan for available APs in the network topology dynamically - returns one entry per AP (allows duplicates)
  const availableSSIDs = useMemo(() => {
    const results: { ssid: string; deviceId: string; deviceName: string }[] = [];
    if (deviceStates) {
      deviceStates.forEach((state, stateId) => {
        if (stateId === deviceId) return; // skip self
        const wlanPort = state.ports['wlan0'];
        if (wlanPort && !wlanPort.shutdown && wlanPort.wifi?.mode === 'ap' && wlanPort.wifi?.ssid) {
          const apDevice = topologyDevices.find(d => d.id === stateId);
          results.push({
            ssid: wlanPort.wifi.ssid,
            deviceId: stateId,
            deviceName: apDevice?.name || stateId,
          });
        }
      });
    }
    return results;
  }, [deviceStates, deviceId, topologyDevices]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const activeServiceCount = Number(serviceDnsEnabled) + Number(serviceHttpEnabled) + Number(serviceDhcpEnabled);

  useEffect(() => {
    setIpConfigMode(deviceFromTopology?.ipConfigMode || 'static');
    setServiceDnsEnabled(deviceFromTopology?.services?.dns?.enabled ?? false);
    setServiceDnsRecords(deviceFromTopology?.services?.dns?.records || []);
    setDnsFormDomain('');
    setDnsFormAddress('');
    setEditingDnsIndex(null);
    setServiceHttpEnabled(deviceFromTopology?.services?.http?.enabled ?? false);
    setServiceHttpContent(deviceFromTopology?.services?.http?.content || 'Merhaba Dünya!');
    setServiceDhcpEnabled(deviceFromTopology?.services?.dhcp?.enabled ?? false);
    setServiceDhcpPools(deviceFromTopology?.services?.dhcp?.pools || []);
    setDhcpForm({
      poolName: '',
      defaultGateway: '',
      dnsServer: '',
      startIp: '',
      subnetMask: '255.255.255.0',
      maxUsers: 50,
    });
    setEditingDhcpIndex(null);
    setWifiEnabled(deviceFromTopology?.wifi?.enabled ?? false);
    setWifiSSID(deviceFromTopology?.wifi?.ssid ?? '');
    setWifiSecurity(deviceFromTopology?.wifi?.security ?? 'open');
    setWifiPassword(deviceFromTopology?.wifi?.password ?? '');
    setWifiChannel(deviceFromTopology?.wifi?.channel ?? '2.4GHz');
  }, [deviceId, deviceFromTopology?.services, deviceFromTopology?.wifi]);

  // When tablet powers on, navigate to home screen
  useEffect(() => {
    if (!isPcPoweredOff) {
      goHome();
    }
  }, [isPcPoweredOff, goHome]);

  const validateIP = (ip: string) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);

  const validateIPv6 = (ipv6: string) => {
    // Basic IPv6 validation - allows compressed and full formats
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv6Regex.test(ipv6);
  };

  // Validate and sync global state
  const syncToGlobal = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!validateIP(pcIP)) newErrors.ip = 'Geçersiz IP';
    if (!isValidMAC(pcMAC)) newErrors.mac = 'Geçersiz MAC';
    if (ipConfigMode === 'static') {
      if (pcSubnet && !validateIP(pcSubnet)) newErrors.subnet = 'Geçersiz Subnet';
      if (pcGateway && !validateIP(pcGateway)) newErrors.gateway = 'Geçersiz Gateway';
      if (pcDNS && !validateIP(pcDNS)) newErrors.dns = 'Geçersiz DNS';
    }
    if (pcIPv6 && !validateIPv6(pcIPv6)) newErrors.ipv6 = 'Geçersiz IPv6';

    setErrors(newErrors);

    if (deviceId) {
      window.dispatchEvent(new CustomEvent('update-topology-device-config', {
        detail: {
          deviceId: deviceId,
          config: {
            name: internalPcHostname,
            ipConfigMode,
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
              },
              dhcp: {
                enabled: serviceDhcpEnabled,
                pools: serviceDhcpPools
              }
            },
            wifi: {
              enabled: wifiEnabled,
              ssid: wifiSSID,
              bssid: wifiBSSID,
              security: wifiSecurity,
              password: wifiPassword,
              channel: wifiChannel,
              mode: 'client'
            }
          }
        }
      }));
    }
  }, [internalPcHostname, ipConfigMode, pcIP, pcMAC, pcSubnet, pcGateway, pcDNS, pcIPv6, pcIPv6Prefix, serviceDnsEnabled, serviceDnsRecords, serviceHttpEnabled, serviceHttpContent, serviceDhcpEnabled, serviceDhcpPools, wifiEnabled, wifiSSID, wifiBSSID, wifiSecurity, wifiPassword, wifiChannel, deviceId]);

  // Trigger sync on change (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      syncToGlobal();
    }, 500);
    return () => clearTimeout(handler);
  }, [pcIP, pcMAC, pcSubnet, pcGateway, pcDNS, pcIPv6, pcIPv6Prefix, internalPcHostname, ipConfigMode, serviceDnsEnabled, serviceDnsRecords, serviceHttpEnabled, serviceHttpContent, serviceDhcpEnabled, serviceDhcpPools, wifiEnabled, wifiSSID, wifiBSSID, wifiSecurity, wifiPassword, wifiChannel, syncToGlobal]);

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
  const prevIpConfigModeRef = useRef(ipConfigMode);

  // Auto-focus input when visible, tab changes, or command completes
  useEffect(() => {
    if (isVisible && activeTab === 'desktop') {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, activeTab, pcOutput]);

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
    return topologyDevices.find(d => d.id === otherId && ((d.type === 'switchL2' || d.type === 'switchL3') || d.type === 'router')) || null;
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
        case 'ArrowUp':
          e.preventDefault();
          if (direction.y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (direction.y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (direction.x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (direction.x === 0) setDirection({ x: 1, y: 0 });
          break;
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
        title: t.copyToastSuccessTitle,
        description: t.copyToastSuccessDescription,
      });
    } catch {
      toast({
        title: t.copyToastFailureTitle,
        description: t.copyToastFailureDescription,
        variant: "destructive",
      });
    }
  }, [activeTab, pcOutput, activeConsoleOutput, t]);

  const connectedConsoleDevice = useMemo(() => {
    if (!connectedDeviceId) return null;
    return topologyDevices.find(d => d.id === connectedDeviceId) || null;
  }, [connectedDeviceId, topologyDevices]);

  const isConsoleTargetPoweredOff = isConsoleConnected && !!connectedConsoleDevice && connectedConsoleDevice.status === 'offline';
  const isCmdInputDisabled = isPcPoweredOff;
  const consoleAwaitingPassword = !!(connectedDeviceId && deviceStates?.get(connectedDeviceId)?.awaitingPassword);
  const isConsoleInputDisabled = isPcPoweredOff || !isConsoleConnected || isConsoleTargetPoweredOff;

  // Detect password/confirm states from device state
  const consoleNeedsPassword = useMemo(() => {
    if (!isConsoleConnected || !connectedDeviceId) return false;
    const state = deviceStates?.get(connectedDeviceId);
    // Only show password prompt if explicitly awaiting password
    return state?.awaitingPassword === true;
  }, [isConsoleConnected, connectedDeviceId, deviceStates]);

  const consoleReloadPending = useMemo(() => {
    if (!isConsoleConnected || !connectedDeviceId) return false;
    const output = deviceOutputs?.get(connectedDeviceId) || [];
    return output.some((line: any) => line.type === 'output' && /Proceed with reload\? \[confirm\]/i.test(line.content));
  }, [isConsoleConnected, connectedDeviceId, deviceOutputs]);

  const consoleConfirmDialog = useMemo(() => {
    if (!isConsoleConnected || !connectedDeviceId) return null;
    // Don't show confirm dialog if password is still being entered
    if (consoleNeedsPassword) return null;
    const output = deviceOutputs?.get(connectedDeviceId) || [];
    const confirmLine = output.find((line: any) => line.type === 'output' && /\[confirm\]/i.test(line.content));
    if (confirmLine) {
      return { show: true, message: confirmLine.content };
    }
    return null;
  }, [isConsoleConnected, connectedDeviceId, deviceOutputs, consoleNeedsPassword]);

  const [consolePasswordAttempted, setConsolePasswordAttempted] = useState(false);

  const consoleAuthenticated = useMemo(() => {
    if (!connectedDeviceId) return true;
    return deviceStates?.get(connectedDeviceId)?.consoleAuthenticated !== false;
  }, [connectedDeviceId, deviceStates]);

  useEffect(() => {
    if (!connectedDeviceId) return;
    if (consolePasswordAttempted && consoleAwaitingPassword) {
      toast({
        title: t.consolePasswordErrorTitle,
        description: t.consolePasswordErrorDescription,
        variant: 'destructive',
      });
      setConsolePasswordAttempted(false);
      setIsConsoleConnected(false);
      setConnectedDeviceId(null);
    } else if (consolePasswordAttempted && !consoleAwaitingPassword && consoleAuthenticated) {
      setIsConsoleConnected(true);
      setConsolePasswordAttempted(false);
    }
  }, [consoleAuthenticated, consoleAwaitingPassword, consolePasswordAttempted, connectedDeviceId, t]);

  const connectionErrorText = useMemo(() => {
    if (!isPcPoweredOff && !isConsoleTargetPoweredOff) return '';
    return t.pcConnectionError;
  }, [isPcPoweredOff, isConsoleTargetPoweredOff, t]);

  const addLocalOutput = useCallback((type: OutputLine['type'], content: string, prompt?: string) => {
    const newLine: OutputLine = { id: Math.random().toString(36).substr(2, 9), type, content, prompt };
    setPcOutput(prev => [...prev, newLine]);
    setTimeout(() => {
      if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }, 0);
  }, []);

  const canReachTargetIp = useCallback((targetIp: string) => {
    const result = checkConnectivity(deviceId, targetIp, topologyDevices as any, topologyConnections as any, deviceStates || new Map(), t.language as 'tr' | 'en');
    return result.success;
  }, [deviceId, topologyDevices, topologyConnections, deviceStates, t.language]);

  const hasPhysicalPathToDevice = useCallback((targetDeviceId: string) => {
    if (!targetDeviceId || targetDeviceId === deviceId) return false;
    const sourceDevice = topologyDevices.find((d) => d.id === deviceId);
    const targetDevice = topologyDevices.find((d) => d.id === targetDeviceId);
    if (!sourceDevice || !targetDevice) return false;
    if (sourceDevice.status === 'offline' || targetDevice.status === 'offline') return false;

    const queue: string[] = [deviceId];
    const visited = new Set<string>([deviceId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetDeviceId) return true;

      const neighbors = topologyConnections
        .filter((c) => c.active !== false && (c.sourceDeviceId === current || c.targetDeviceId === current))
        .map((c) => (c.sourceDeviceId === current ? c.targetDeviceId : c.sourceDeviceId));

      for (const next of neighbors) {
        if (visited.has(next)) continue;
        const nextDevice = topologyDevices.find((d) => d.id === next);
        if (!nextDevice || nextDevice.status === 'offline') continue;
        visited.add(next);
        queue.push(next);
      }
    }

    return false;
  }, [deviceId, topologyConnections, topologyDevices]);

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

  const resetDhcpForm = useCallback(() => {
    setDhcpForm({
      poolName: '',
      defaultGateway: '',
      dnsServer: '',
      startIp: '',
      subnetMask: '255.255.255.0',
      maxUsers: 50,
    });
    setEditingDhcpIndex(null);
  }, []);

  const saveDhcpPool = useCallback(() => {
    const cleaned: DhcpPoolConfig = {
      poolName: dhcpForm.poolName.trim(),
      defaultGateway: dhcpForm.defaultGateway.trim(),
      dnsServer: dhcpForm.dnsServer.trim(),
      startIp: dhcpForm.startIp.trim(),
      subnetMask: dhcpForm.subnetMask.trim(),
      maxUsers: Number.isFinite(dhcpForm.maxUsers) ? Math.max(1, Number(dhcpForm.maxUsers)) : 1,
    };

    if (!cleaned.poolName || !cleaned.defaultGateway || !cleaned.dnsServer || !cleaned.startIp || !cleaned.subnetMask) {
      return;
    }

    setServiceDhcpPools((prev) => {
      if (editingDhcpIndex === null) {
        return [...prev, cleaned];
      }
      return prev.map((pool, idx) => (idx === editingDhcpIndex ? cleaned : pool));
    });

    resetDhcpForm();
  }, [dhcpForm, editingDhcpIndex, resetDhcpForm]);

  const ipToNumber = useCallback((ip: string) => {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
    return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
  }, []);

  const numberToIp = useCallback((num: number) => {
    const a = (num >>> 24) & 255;
    const b = (num >>> 16) & 255;
    const c = (num >>> 8) & 255;
    const d = num & 255;
    return `${a}.${b}.${c}.${d}`;
  }, []);

  const getDhcpLease = useCallback(() => {
    const clientHasUsableIp = validateIP(pcIP) && pcIP !== '0.0.0.0';
    const usedIps = new Set(
      topologyDevices
        .filter((d) => d.id !== deviceId && validateIP(d.ip || ''))
        .map((d) => d.ip)
    );

    const servers = topologyDevices.filter(
      (d) =>
        d.id !== deviceId &&
        d.type === 'pc' &&
        d.services?.dhcp?.enabled &&
        (d.services?.dhcp?.pools?.length || 0) > 0 &&
        !!d.ip &&
        (clientHasUsableIp ? canReachTargetIp(d.ip) : hasPhysicalPathToDevice(d.id))
    );

    for (const server of servers) {
      const pools = server.services?.dhcp?.pools || [];
      for (const pool of pools) {
        if (!validateIP(pool.startIp) || !validateIP(pool.subnetMask) || !validateIP(pool.defaultGateway) || !validateIP(pool.dnsServer)) {
          continue;
        }
        const start = ipToNumber(pool.startIp);
        if (start === null) continue;
        const maxUsers = Math.max(1, Number(pool.maxUsers || 1));
        for (let i = 0; i < maxUsers; i += 1) {
          const candidate = numberToIp(start + i);
          if (!usedIps.has(candidate)) {
            return {
              ip: candidate,
              subnetMask: pool.subnetMask,
              gateway: pool.defaultGateway,
              dns: pool.dnsServer,
              serverName: server.name,
              poolName: pool.poolName,
            };
          }
        }
      }
    }

    return null;
  }, [canReachTargetIp, deviceId, hasPhysicalPathToDevice, ipToNumber, numberToIp, pcIP, topologyDevices, validateIP]);

  const applyDhcpLease = useCallback((force = false) => {
    const lease = getDhcpLease();
    if (!lease) return null;
    if (!force &&
      lease.ip === pcIP &&
      lease.subnetMask === pcSubnet &&
      lease.gateway === pcGateway &&
      lease.dns === pcDNS
    ) {
      return lease;
    }
    setPcIP(lease.ip);
    setPcSubnet(lease.subnetMask);
    setPcGateway(lease.gateway);
    setPcDNS(lease.dns);
    return lease;
  }, [getDhcpLease, pcDNS, pcGateway, pcIP, pcSubnet]);

  // When DHCP mode is selected, request a lease immediately and notify the user.
  useEffect(() => {
    if (prevIpConfigModeRef.current === 'dhcp') {
      prevIpConfigModeRef.current = ipConfigMode;
      return;
    }

    if (ipConfigMode !== 'dhcp') {
      prevIpConfigModeRef.current = ipConfigMode;
      return;
    }

    const lease = applyDhcpLease(true);
    if (lease) {
      toast({
        title: t.dhcpSuccessTitle,
        description: t.dhcpSuccessDescription.replace('{ip}', lease.ip),
      });
    } else {
      toast({
        title: t.dhcpFailureTitle,
        description: t.dhcpFailureDescription,
        variant: 'destructive',
      });
    }

    prevIpConfigModeRef.current = ipConfigMode;
  }, [applyDhcpLease, ipConfigMode, t]);

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
      addLocalOutput('error', connectionErrorText || t.pcConnectionError);
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
          const lease = applyDhcpLease();
          if (lease) {
            addLocalOutput(
              'success',
              `DHCP lease acquired from ${lease.serverName}/${lease.poolName}. New IP: ${lease.ip}`
            );
          } else {
            const restoredIP = deviceFromTopology?.ip || defaultConfig.ip;
            setPcIP(restoredIP);
            addLocalOutput('error', 'No reachable DHCP server/pool found. Using existing IP.');
          }
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
          const result = checkConnectivity(deviceId, target, topologyDevices as any, topologyConnections as any, deviceStates || new Map(), t.language as 'tr' | 'en');
          if (result.success) {
            if (result.targetId) {
              window.dispatchEvent(new CustomEvent('trigger-ping-animation', {
                detail: { sourceId: deviceId, targetId: result.targetId }
              }));
            }
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
          addLocalOutput('error', t.dnsInvalidAddress);
        } else if (!hasGatewayForTarget(pcDNS)) {
          addLocalOutput('error', t.dnsGatewayRequired);
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
          addLocalOutput('error', t.targetGatewayRequired);
        } else if (!isValidIpv4(target) && !isValidIpv4(pcDNS)) {
          addLocalOutput('error', t.dnsAddressRequired);
        } else if (!isValidIpv4(target) && !hasGatewayForTarget(pcDNS)) {
          addLocalOutput('error', t.dnsGatewayRequired);
        } else {
          const httpServer = findHttpServerByTarget(target);
          if (!httpServer) {
            addLocalOutput('error', `HTTP service is unavailable for ${target}`);
          } else {
            addLocalOutput('output', httpServer.services?.http?.content || 'Merhaba Dünya!');
          }
        }
      } else if (cmd === 'telnet') {
        const target = args[0];
        const port = args[1] || '23';
        if (!target) {
          addLocalOutput('output', 'Usage: telnet <ip_or_domain> [port]');
        } else {
          // Check if target is a domain and resolve it
          let targetIp = target;
          if (!isValidIpv4(target)) {
            const dnsResult = resolveDomainWithDnsServices(target);
            if (dnsResult) {
              targetIp = dnsResult.address;
            } else {
              addLocalOutput('error', `Could not resolve hostname ${target}`);
              return;
            }
          }

          // Check connectivity
          const result = checkConnectivity(deviceId, targetIp, topologyDevices as any, topologyConnections as any, deviceStates || new Map(), t.language as 'tr' | 'en');

          if (result.success && result.targetId) {
            // Find target device to see if it's a switch or router
            const targetDevice = topologyDevices.find(d => d.id === result.targetId);
            if (targetDevice && ((targetDevice.type === 'switchL2' || targetDevice.type === 'switchL3') || targetDevice.type === 'router')) {
              // Successfully connected - switch to terminal tab and connect
              addLocalOutput('success', `Trying ${targetIp} ${port} ...\nConnected to ${targetIp}.`);

              // Give it a tiny delay for the user to see the "Connected" message before switching
              setTimeout(() => {
                setConnectedDeviceId(result.targetId!);
                setConsoleConnectionTime(Date.now());
                setIsConsoleConnected(true);
                setActiveTab('terminal');
                onNavigate?.('terminal');
              }, 500);
            } else {
              addLocalOutput('error', `Connection refused by ${targetIp}`);
            }
          } else {
            addLocalOutput('error', `Connecting to ${targetIp}... failed: ${result.error || 'Destination unreachable'}`);
          }
        }
      } else if (cmd === 'arp') {
        if (args.length === 0 || (args.length === 1 && args[0].toLowerCase() === '-a')) {
          addLocalOutput('output', buildArpTableOutput());
        } else {
          addLocalOutput('output', 'Usage: arp -a');
        }
      } else if (cmd === 'tracert') {
        const target = args[0];
        if (!target) {
          addLocalOutput('output', 'Usage: tracert <target_name_or_address>');
        } else {
          addLocalOutput('output', `Tracing route to ${target} over a maximum of 30 hops:\n`);
          const result = checkConnectivity(deviceId, target, topologyDevices as any, topologyConnections as any, deviceStates || new Map(), t.language as 'tr' | 'en');

          if (result.hops && result.hops.length > 0) {
            let hopOutput = '';
            result.hops.forEach((hop, index) => {
              // Simulate some variation in hop display
              const hopName = hop;
              const hopIp = topologyDevices.find(d => d.name === hop || d.id === hop)?.ip || '?.?.?.?';
              hopOutput += `  ${index + 1}    <1 ms    <1 ms    <1 ms  ${hopName} [${hopIp}]\n`;
            });
            addLocalOutput('output', hopOutput + '\nTrace complete.');
          } else {
            addLocalOutput('output', `  1    *        *        *     Request timed out.\n\nTrace complete.`);
          }
        }
      } else if (cmd === 'netstat') {
        let output = '\nActive Connections\n\n  Proto  Local Address          Foreign Address        State\n';
        output += `  TCP    ${pcIP}:135            0.0.0.0:0              LISTENING\n`;
        output += `  TCP    ${pcIP}:445            0.0.0.0:0              LISTENING\n`;

        if (serviceHttpEnabled) output += `  TCP    ${pcIP}:80             0.0.0.0:0              LISTENING\n`;
        if (serviceDnsEnabled) output += `  UDP    ${pcIP}:53             *:*                    \n`;
        if (serviceDhcpEnabled) output += `  UDP    ${pcIP}:67             *:*                    \n`;

        output += `  TCP    ${pcIP}:49664          0.0.0.0:0              LISTENING\n`;
        output += `  TCP    ${pcIP}:49665          0.0.0.0:0              LISTENING\n`;
        addLocalOutput('output', output);
      } else if (cmd === 'nbtstat') {
        if (args.includes('-n')) {
          addLocalOutput('output', `\nNetBIOS Local Name Table\n\n       Name               Type         Status\n    ---------------------------------------------\n    ${internalPcHostname.toUpperCase().padEnd(15)}  <00>  UNIQUE      Registered\n    WORKGROUP        <00>  GROUP       Registered\n    ${internalPcHostname.toUpperCase().padEnd(15)}  <20>  UNIQUE      Registered\n`);
        } else {
          addLocalOutput('output', 'Usage: nbtstat [-n]');
        }
      } else if (cmd === 'help' || cmd === '?') {
        addLocalOutput('output', `Available commands: ipconfig, ping, tracert, telnet, netstat, nbtstat, nslookup, http, arp, hostname, dir, ver, cls, exit, quit, snake`);
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
      } else if (cmd === 'ver') {
        addLocalOutput('output', `OS Windows [Version 10.0.19045.4412]`);
      } else if (cmd === 'dir') {
        addLocalOutput('output', ` Volume in drive C is OS
 Volume Serial Number is 1234-5678

 Directory of C:\\n
03/27/2026  10:00 AM    <DIR>          .
03/27/2026  10:00 AM    <DIR>          ..
               0 File(s)              0 bytes
               2 Dir(s)  100,000,000,000 bytes free`);
      } else {
        addLocalOutput('error', `'${command}' is not recognized as an internal or external command.`);
      }
    } else {
      // Console (terminal) tab
      if (!isConsoleConnected) {
        addLocalOutput('error', t.pcNoDeviceConnected);
        return;
      }

      // Handle password input
      if (consoleNeedsPassword) {
        if (onExecuteDeviceCommand && connectedDeviceId) {
          try { await onExecuteDeviceCommand(connectedDeviceId, input); } catch (err) { }
        }
        setInput('');
        return;
      }

      // After password is correct, check for confirm states
      // Handle confirm dialog (reload confirmation, etc.)
      // Only send "confirm" if input is empty (Enter pressed with no text)
      if ((consoleConfirmDialog?.show || consoleReloadPending)) {
        if (!command) {
          // Empty input = confirm
          if (onExecuteDeviceCommand && connectedDeviceId) {
            try { await onExecuteDeviceCommand(connectedDeviceId, 'confirm'); } catch (err) { }
          }
          setInput('');
          return;
        }
        // User typed something - check if it's a known confirmation response
        const lowerCmd = command.toLowerCase().trim();
        if (lowerCmd === 'confirm' || lowerCmd === 'y' || lowerCmd === 'yes') {
          // These are valid confirm responses
          if (onExecuteDeviceCommand && connectedDeviceId) {
            try { await onExecuteDeviceCommand(connectedDeviceId, 'confirm'); } catch (err) { }
          }
          setInput('');
          return;
        }
        // User typed something else - send as command (will fail on switch)
      }

      const parts = command.split(' ');
      const cmd = parts[0].toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Console tab: forward all commands to remote device
      addLocalOutput('command', command);
      if (onExecuteDeviceCommand && connectedDeviceId) {
        try { await onExecuteDeviceCommand(connectedDeviceId, command); } catch (err) { }
      }
    }
  };

  const handleTabComplete = useCallback(() => {
    const value = input;
    if (!value && tabCycleIndex === -1) return;

    // Determine mode: PC tab always uses 'user', Console tab uses connected device's mode
    let mode: string = 'user';
    if (activeTab === 'terminal' && isConsoleConnected && connectedDeviceId && deviceStates) {
      const state = deviceStates.get(connectedDeviceId);
      mode = state?.currentMode || 'user';
    }

    const { candidates, currentWord, contextTokens } = expandCommandContext(mode as any, value);
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
  }, [input, tabCycleIndex, lastTabInput, activeTab, isConsoleConnected, connectedDeviceId, deviceStates, executeCommand]);

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

  const handleInputChange = useCallback((newValue: string) => {
    setUndoStack([...undoStack, input]);
    setRedoStack([]);
    setInput(newValue);
  }, [input, undoStack]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setPcOutput([]);
      return;
    }

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

    // Escape cancels password/confirm and returns to normal input
    if (e.key === 'Escape') {
      if (activeTab === 'terminal' && isConsoleConnected && (consoleNeedsPassword || consoleConfirmDialog?.show || consoleReloadPending)) {
        e.preventDefault();
        if (onExecuteDeviceCommand && connectedDeviceId) {
          if (consoleNeedsPassword) {
            onExecuteDeviceCommand(connectedDeviceId, '__PASSWORD_CANCELLED__');
          } else if (consoleReloadPending) {
            // For reload, send 'n' to cancel
            onExecuteDeviceCommand(connectedDeviceId, 'n');
          }
        }
        setInput('');
        return;
      }
    }

    // Handle Ctrl+A (Select All)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      const inputElement = e.currentTarget as HTMLInputElement;
      inputElement.select();
      return;
    }

    // Handle Ctrl+X (Cut)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      const inputElement = e.currentTarget as HTMLInputElement;
      if (input) {
        const start = inputElement.selectionStart || 0;
        const end = inputElement.selectionEnd || 0;
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
      const inputElement = e.currentTarget as HTMLInputElement;
      if (input) {
        const start = inputElement.selectionStart || 0;
        const end = inputElement.selectionEnd || 0;
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
        const inputElement = e.currentTarget as HTMLInputElement;
        const start = inputElement.selectionStart || 0;
        const end = inputElement.selectionEnd || 0;
        const newInput = input.substring(0, start) + text + input.substring(end);
        setInput(newInput);
        // Move cursor to end of pasted text
        setTimeout(() => {
          inputElement.setSelectionRange(start + text.length, start + text.length);
        }, 0);
      }).catch(() => {
        // Clipboard access denied, silently fail
      });
      return;
    }

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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

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
      {/* Home Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={goHome}
            className={`h-8 w-8 rounded-lg ui-hover-surface ${isDark ? 'text-slate-300 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'}`}
            aria-label={language === 'tr' ? 'Ana Ekran' : 'Home'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{language === 'tr' ? 'Ana Ekran' : 'Home'}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              goHome();
              onTogglePower?.(deviceId);
            }}
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
    <div className={`
      w-full h-full flex items-center justify-center p-0 md:p-4
      ${isDark ? 'bg-slate-900' : 'bg-slate-100'}
    `}>
      {/* Tablet Frame - Full screen on mobile */}
      <div className={`
        w-full h-full max-w-full lg:max-w-4xl mx-auto overflow-hidden
        relative
        ${isDark
          ? 'bg-gradient-to-br from-slate-900 via-indigo-900/50 via-violet-900/40 to-slate-900 md:border-4 md:border-slate-600 md:shadow-2xl md:shadow-purple-500/20 md:rounded-3xl'
          : 'bg-gradient-to-br from-blue-200 via-indigo-100 to-purple-200 md:border-4 md:border-slate-300 md:shadow-2xl md:shadow-purple-300/30 md:rounded-3xl'
        }
      `}>
        {/* Animated colorful overlay */}
        <div className="absolute inset-0 overflow-hidden -z-10">
          {/* Moving gradient */}
          <div className={`
            absolute -top-1/2 -left-1/2 w-[200%] h-[200%] 
            ${isDark
              ? 'bg-gradient-to-br from-blue-600/30 via-purple-600/30 via-pink-500/20 to-cyan-500/30 animate-gradient'
              : 'bg-gradient-to-br from-blue-400/40 via-purple-400/40 to-pink-400/40 animate-gradient'
            }
          `} />
          {/* Colorful orbs */}
          <div className={`
            absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl
            ${isDark ? 'bg-purple-600/40' : 'bg-purple-400/50'}
          `} />
          <div className={`
            absolute bottom-0 left-0 w-48 h-48 rounded-full blur-3xl
            ${isDark ? 'bg-cyan-600/30' : 'bg-cyan-400/40'}
          `} />
          <div className={`
            absolute top-1/3 left-1/3 w-32 h-32 rounded-full blur-3xl
            ${isDark ? 'bg-pink-600/30' : 'bg-pink-400/40'}
          `} />
          <div className={`
            absolute bottom-1/4 right-1/4 w-36 h-36 rounded-full blur-3xl
            ${isDark ? 'bg-blue-600/25' : 'bg-blue-400/35'}
          `} />
          <div className={`
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full blur-3xl
            ${isDark ? 'bg-violet-600/20' : 'bg-violet-400/30'}
          `} />
        </div>
        {/* Tablet Header / Status Bar */}
        <div className={`
          px-4 py-2 flex items-center justify-between relative z-50
          ${isDark ? 'bg-slate-900' : 'bg-white'}
        `}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isPcPoweredOff ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
            <span className={`text-xs font-medium  ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {internalPcHostname} - {pcIP}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Home Button - Disabled when PC is off */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goHome}
                  disabled={isPcPoweredOff}
                  className={`h-7 w-7 rounded-lg ui-hover-surface ${isPcPoweredOff ? 'opacity-30 cursor-not-allowed' : isDark ? 'text-slate-300 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'}`}
                  aria-label={language === 'tr' ? 'Ana Ekran' : 'Home'}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{language === 'tr' ? 'Ana Ekran' : 'Home'}</TooltipContent>
            </Tooltip>
            {/* Power Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    goHome();
                    onTogglePower?.(deviceId);
                  }}
                  className={`h-7 w-7 rounded-lg ui-hover-surface transition-all ${isPcPoweredOff ? 'text-rose-500 hover:text-rose-400' : 'text-emerald-500 hover:text-emerald-400'}`}
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
            {/* Close Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className={`h-7 w-7 rounded-lg ui-hover-surface ${isDark ? 'text-slate-300 hover:text-red-400' : 'text-slate-600 hover:text-red-600'}`}
                  aria-label={language === 'tr' ? 'Kapat' : 'Close'}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{language === 'tr' ? 'Kapat' : 'Close'}</TooltipContent>
            </Tooltip>
            {/* Clock */}
            <div className={`ml-2 text-xs font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {formatTime(currentTime)}
            </div>
          </div>
        </div>
        {/* Screen Bezel */}
        <div className={`
          h-[calc(100%-40px)] overflow-hidden relative
          ${isDark
            ? 'bg-gradient-to-br from-slate-900/95 via-blue-900/20 to-purple-900/20 border border-slate-800/50'
            : 'bg-gradient-to-br from-white/70 via-blue-50/50 to-purple-50/50 border border-slate-200/50'
          }
        `}>
          {/* Power Off Overlay */}
          {isPcPoweredOff && (
            <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center">
              <svg className="w-16 h-16 text-red-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 1 1-12.728 0" />
              </svg>
              <span className="text-red-500 text-sm font-medium">{language === 'tr' ? 'KAPALI' : 'OFF'}</span>
            </div>
          )}
          <ModernPanel
            id={deviceId}
            title={internalPcHostname}
            onClose={onClose}
            collapsible={false}
            hideTitle
            hideHeader
            className="w-full h-full min-w-0"
          >
            <div className={`flex flex-col h-full overflow-hidden ${isDark ? 'bg-transparent' : 'bg-white/30'}`}>
              <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
                <DialogContent className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white'} sm:max-w-md`}>
                  <DialogHeader>
                    <DialogTitle>{t.searchOutputTitle}</DialogTitle>
                    <DialogDescription className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                      {t.searchOutputDescription}
                    </DialogDescription>
                  </DialogHeader>
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t.searchPlaceholder} autoFocus />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => setSearchQuery('')} className="text-xs font-semibold" disabled={!searchQuery.trim()}>
                      {t.clearTerminalBtn}
                    </Button>
                    <Button onClick={() => setSearchOpen(false)} className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white">
                      {t.close}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Navigation Tabs - Hide on mobile, use main app tabs */}
              <div className="hidden">
                <Button
                  variant={activeTab === 'home' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('home')}
                  className={`h-9 px-4 text-xs font-black tracking-wider transition-all gap-2 ${activeTab === 'home' ? 'bg-slate-500/10 text-slate-300' : 'text-slate-500 hover:text-slate-300'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
                >
                  <Monitor className="w-4 h-4" />
                  <span className={isMobile ? 'sr-only' : 'hidden md:inline'}>{language === 'tr' ? 'Ana Ekran' : 'Home'}</span>
                </Button>
                <Button
                  variant={activeTab === 'desktop' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('desktop')}
                  className={`h-9 px-4 text-xs font-black tracking-wider transition-all gap-2 ${activeTab === 'desktop' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
                >
                  <Command className="w-4 h-4" />
                  <span className={isMobile ? 'sr-only' : 'hidden md:inline'}>{t.commandPromptTab}</span>
                </Button>
                <Button
                  variant={activeTab === 'terminal' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('terminal')}
                  className={`h-9 px-4 text-xs font-black tracking-wider  transition-all gap-2 ${activeTab === 'terminal' ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-500 hover:text-emerald-500'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
                >
                  <TerminalIcon className="w-4 h-4" />
                  <span className={isMobile ? 'sr-only' : 'hidden md:inline'}>{t.consoleTab}</span>
                </Button>
                <Button
                  variant={activeTab === 'settings' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('settings')}
                  className={`h-9 px-4 text-xs font-black tracking-wider  transition-all gap-2 ${activeTab === 'settings' ? 'bg-purple-500/10 text-purple-500' : 'text-slate-500 hover:text-purple-500'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className={isMobile ? 'sr-only' : 'hidden md:inline'}>{t.settingsTab}</span>
                </Button>
                <Button
                  variant={activeTab === 'services' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('services')}
                  className={`h-9 px-4 text-xs font-black tracking-wider transition-all gap-2 ${activeTab === 'services' ? 'bg-amber-500/10 text-amber-500' : 'text-slate-500 hover:text-amber-500'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
                >
                  <Globe className="w-4 h-4" />
                  <span className={isMobile ? 'sr-only' : 'hidden md:inline'}>
                    {`${t.servicesTab} (${activeServiceCount}/3)`}
                  </span>
                </Button>
                <Button
                  variant={activeTab === 'wireless' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('wireless')}
                  className={`h-9 px-4 text-xs font-black tracking-wider transition-all gap-2 ${activeTab === 'wireless' ? 'bg-purple-500/10 text-purple-500' : 'text-slate-500 hover:text-purple-500'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
                >
                  <Network className="w-4 h-4" />
                  <span className={isMobile ? 'sr-only' : 'hidden md:inline'}>{language === 'tr' ? 'Kablosuz' : 'Wireless'}</span>
                </Button>
              </div>

              {/* Content Area */}
              <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${terminalBg} relative`}>
                {activeTab === 'home' ? (
                  <div className="flex-1 p-4 md:p-8 overflow-auto custom-scrollbar">
                    <div className="min-h-full flex items-center justify-center">
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-4 md:gap-8 rounded-3xl p-6 md:p-8 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl">
                        <button
                          onClick={() => navigateToProgram('desktop')}
                          className="flex flex-col items-center gap-2 md:gap-3 p-2 md:p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-white/5"
                        >
                          <div className={`w-12 h-12 md:w-20 md:h-20 rounded-2xl flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-blue-500/40 to-blue-600/30 border border-blue-400/30 shadow-lg shadow-blue-500/20' : 'bg-gradient-to-br from-blue-400 to-blue-500 shadow-lg shadow-blue-400/30'}`}>
                            <TerminalIcon className={`w-6 h-6 md:w-10 md:h-10 ${isDark ? 'text-blue-200' : 'text-white'}`} />
                          </div>
                          <span className={`text-[10px] md:text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {language === 'tr' ? 'Komut İstemi' : 'Command Prompt'}
                          </span>
                        </button>
                        <button
                          onClick={() => navigateToProgram('terminal')}
                          className="flex flex-col items-center gap-2 md:gap-3 p-2 md:p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-white/5"
                        >
                          <div className={`w-12 h-12 md:w-20 md:h-20 rounded-2xl flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-emerald-500/40 to-emerald-600/30 border border-emerald-400/30 shadow-lg shadow-emerald-500/20' : 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-400/30'}`}>
                            <Laptop className={`w-6 h-6 md:w-10 md:h-10 ${isDark ? 'text-emerald-200' : 'text-white'}`} />
                          </div>
                          <span className={`text-[10px] md:text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {language === 'tr' ? 'Konsol' : 'Console'}
                          </span>
                        </button>
                        <button
                          onClick={() => navigateToProgram('settings')}
                          className="flex flex-col items-center gap-2 md:gap-3 p-2 md:p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-white/5"
                        >
                          <div className={`w-12 h-12 md:w-20 md:h-20 rounded-2xl flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-purple-500/40 to-purple-600/30 border border-purple-400/30 shadow-lg shadow-purple-500/20' : 'bg-gradient-to-br from-purple-400 to-purple-500 shadow-lg shadow-purple-400/30'}`}>
                            <Settings className={`w-6 h-6 md:w-10 md:h-10 ${isDark ? 'text-purple-200' : 'text-white'}`} />
                          </div>
                          <span className={`text-[10px] md:text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {language === 'tr' ? 'Ayarlar' : 'Settings'}
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveTab('services')}
                          className="flex flex-col items-center gap-2 md:gap-3 p-2 md:p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-white/5"
                        >
                          <div className={`w-12 h-12 md:w-20 md:h-20 rounded-2xl flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-amber-500/40 to-amber-600/30 border border-amber-400/30 shadow-lg shadow-amber-500/20' : 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-400/30'}`}>
                            <Globe className={`w-6 h-6 md:w-10 md:h-10 ${isDark ? 'text-amber-200' : 'text-white'}`} />
                          </div>
                          <span className={`text-[10px] md:text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {language === 'tr' ? 'Servisler' : 'Services'}
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveTab('wireless')}
                          className="flex flex-col items-center gap-2 md:gap-3 p-2 md:p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-white/5"
                        >
                          <div className={`w-12 h-12 md:w-20 md:h-20 rounded-2xl flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-cyan-500/40 to-cyan-600/30 border border-cyan-400/30 shadow-lg shadow-cyan-500/20' : 'bg-gradient-to-br from-cyan-400 to-cyan-500 shadow-lg shadow-cyan-400/30'}`}>
                            <Wifi className={`w-6 h-6 md:w-10 md:h-10 ${isDark ? 'text-cyan-200' : 'text-white'}`} />
                          </div>
                          <span className={`text-[10px] md:text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {language === 'tr' ? 'Kablosuz' : 'Wireless'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : activeTab === 'settings' ? (
                  <div className="flex-1 min-h-0 p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 ">
                        {t.ipConfigurationLabel}
                      </label>&nbsp;
                      <div className={`inline-flex p-1 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={ipConfigMode === 'dhcp'}
                          onClick={() => {
                            setIpConfigMode('dhcp');
                            applyDhcpLease(true);
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${ipConfigMode === 'dhcp'
                            ? 'bg-cyan-500 text-white shadow-sm'
                            : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200')
                            }`}
                        >
                          DHCP
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={ipConfigMode === 'static'}
                          onClick={() => setIpConfigMode('static')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${ipConfigMode === 'static'
                            ? 'bg-blue-500 text-white shadow-sm'
                            : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200')
                            }`}
                        >
                          {t.staticLabel}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 ">{t.hostname}</label>
                      <Input value={internalPcHostname} onChange={(e) => setPcHostname(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 ">MAC Address</label>
                      <Input value={pcMAC} onChange={(e) => setPcMAC(e.target.value)} placeholder="00:1A:2B:3C:4D:5E" className={errors.mac ? 'border-rose-500' : ''} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 ">IP Address</label>
                        <Input value={pcIP} onChange={(e) => setPcIP(e.target.value)} placeholder="192.168.1.100" className={errors.ip ? 'border-rose-500' : ''} disabled={ipConfigMode === 'dhcp'} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 ">Subnet Mask</label>
                        <Input value={pcSubnet} onChange={(e) => setPcSubnet(e.target.value)} placeholder="255.255.255.0" className={errors.subnet ? 'border-rose-500' : ''} disabled={ipConfigMode === 'dhcp'} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 ">Gateway</label>
                        <Input value={pcGateway} onChange={(e) => setPcGateway(e.target.value)} placeholder="192.168.1.1" className={errors.gateway ? 'border-rose-500' : ''} disabled={ipConfigMode === 'dhcp'} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 ">DNS</label>
                        <Input value={pcDNS} onChange={(e) => setPcDNS(e.target.value)} placeholder="8.8.8.8" className={errors.dns ? 'border-rose-500' : ''} disabled={ipConfigMode === 'dhcp'} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 ">IPv6 Address</label>
                        <Input value={pcIPv6} onChange={(e) => setPcIPv6(e.target.value)} placeholder="2001:db8:acad:1::10" className={errors.ipv6 ? 'border-rose-500' : ''} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 ">IPv6 Prefix</label>
                        <Input value={pcIPv6Prefix} onChange={(e) => setPcIPv6Prefix(e.target.value)} placeholder="64" />
                      </div>
                    </div>
                  </div>
                ) : activeTab === 'services' ? (
                  <div className="flex-1 min-h-0 p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    <div className={`rounded-xl border p-4 space-y-4 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold">
                            {t.language === 'tr'
                              ? 'DNS (Domain Name System - isim çözümleme)'
                              : 'DNS (Domain Name System - name resolution)'}
                          </h3>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {t.dnsRecordManagerTip}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={serviceDnsEnabled}
                          onClick={() => setServiceDnsEnabled((prev) => !prev)}
                          className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${serviceDnsEnabled
                            ? 'bg-cyan-500/90 border-cyan-400'
                            : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300')
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${serviceDnsEnabled ? 'translate-x-8' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Input
                          value={dnsFormDomain}
                          onChange={(e) => setDnsFormDomain(e.target.value)}
                          placeholder={t.dnsDomainPlaceholder}
                        />
                        <Input
                          value={dnsFormAddress}
                          onChange={(e) => setDnsFormAddress(e.target.value)}
                          placeholder={t.dnsAddressPlaceholder}
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
                          {t.addDnsRecord}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {serviceDnsRecords.length === 0 && (
                          <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            {t.dnsNoRecords}
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
                              {t.delete}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={`rounded-xl border p-4 space-y-4 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold">
                            {t.language === 'tr'
                              ? 'HTTP (Hypertext Transfer Protocol - web içeriği)'
                              : 'HTTP (Hypertext Transfer Protocol - web content)'}
                          </h3>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {t.httpServiceDescription}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={serviceHttpEnabled}
                          onClick={() => setServiceHttpEnabled((prev) => !prev)}
                          className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${serviceHttpEnabled
                            ? 'bg-emerald-500/90 border-emerald-400'
                            : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300')
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${serviceHttpEnabled ? 'translate-x-8' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold  tracking-wide text-slate-500">HTTP Content</label>
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

                    <div className={`rounded-xl border p-4 space-y-4 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold">
                            {t.language === 'tr'
                              ? 'DHCP (Dynamic Host Configuration Protocol - otomatik IP)'
                              : 'DHCP (Dynamic Host Configuration Protocol - auto IP)'}
                          </h3>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {t.dhcpPoolsDescription}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={serviceDhcpEnabled}
                          onClick={() => setServiceDhcpEnabled((prev) => !prev)}
                          className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${serviceDhcpEnabled
                            ? 'bg-sky-500/90 border-sky-400'
                            : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300')
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${serviceDhcpEnabled ? 'translate-x-8' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          value={dhcpForm.poolName}
                          onChange={(e) => setDhcpForm((prev) => ({ ...prev, poolName: e.target.value }))}
                          placeholder={t.dhcpPoolNamePlaceholder}
                        />
                        <Input
                          value={dhcpForm.defaultGateway}
                          onChange={(e) => setDhcpForm((prev) => ({ ...prev, defaultGateway: e.target.value }))}
                          placeholder={t.dhcpPoolGatewayPlaceholder}
                        />
                        <Input
                          value={dhcpForm.dnsServer}
                          onChange={(e) => setDhcpForm((prev) => ({ ...prev, dnsServer: e.target.value }))}
                          placeholder={t.dhcpPoolDnsPlaceholder}
                        />
                        <Input
                          value={dhcpForm.startIp}
                          onChange={(e) => setDhcpForm((prev) => ({ ...prev, startIp: e.target.value }))}
                          placeholder={t.dhcpPoolStartIpPlaceholder}
                        />
                        <Input
                          value={dhcpForm.subnetMask}
                          onChange={(e) => setDhcpForm((prev) => ({ ...prev, subnetMask: e.target.value }))}
                          placeholder={t.dhcpPoolSubnetPlaceholder}
                        />
                        <Input
                          type="number"
                          min={1}
                          value={dhcpForm.maxUsers}
                          onChange={(e) => setDhcpForm((prev) => ({ ...prev, maxUsers: Number(e.target.value || 1) }))}
                          placeholder={t.dhcpPoolMaxUsersPlaceholder}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Button onClick={saveDhcpPool}>
                          {editingDhcpIndex === null ? t.addPool : t.updatePool}
                        </Button>
                        {editingDhcpIndex !== null && (
                          <Button variant="outline" onClick={resetDhcpForm}>
                            {t.cancel}
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {serviceDhcpPools.length === 0 && (
                          <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            {t.noDhcpPools}
                          </div>
                        )}
                        {serviceDhcpPools.map((pool, index) => (
                          <div key={`${pool.poolName}-${index}`} className={`rounded-lg px-3 py-2 space-y-2 ${isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-50 border border-slate-200'}`}>
                            <div className="text-xs font-mono">
                              <div>{pool.poolName}</div>
                              <div>GW: {pool.defaultGateway} | DNS: {pool.dnsServer}</div>
                              <div>Start: {pool.startIp} | Mask: {pool.subnetMask} | Max: {pool.maxUsers}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setDhcpForm(pool);
                                  setEditingDhcpIndex(index);
                                }}
                              >
                                {t.edit}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setServiceDhcpPools((prev) => prev.filter((_, i) => i !== index));
                                  if (editingDhcpIndex === index) {
                                    resetDhcpForm();
                                  }
                                }}
                              >
                                {t.delete}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : activeTab === 'wireless' ? (
                  <div className="flex-1 min-h-0 p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    <div className={`rounded-2xl border p-5 space-y-5 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-purple-500">
                          <Network className="w-5 h-5" />
                          <h3 className="text-sm font-black tracking-widest ">
                            {language === 'tr' ? 'Wi-Fi (Wireless Fidelity) Bağlantısı' : 'Wi-Fi (Wireless Fidelity) Connection'}
                          </h3>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={wifiEnabled}
                          onClick={() => setWifiEnabled(!wifiEnabled)}
                          className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 ${wifiEnabled
                            ? 'bg-purple-500 border-purple-400'
                            : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300')
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${wifiEnabled ? 'translate-x-8' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black tracking-widest text-slate-500 ml-1">SSID (Service Set Identifier)</label>
                          <Select value={wifiBSSID ? `${wifiBSSID}|${wifiSSID}` : wifiSSID} onValueChange={(val) => {
                            if (val.includes('|')) {
                              const [bssid, ssid] = val.split('|');
                              setWifiBSSID(bssid);
                              setWifiSSID(ssid);
                            } else {
                              setWifiBSSID('');
                              setWifiSSID(val);
                            }
                          }} disabled={!wifiEnabled}>
                            <SelectTrigger className={`w-full ${isDark ? 'bg-background border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                              <SelectValue placeholder={language === 'tr' ? 'Ağ Seçiniz...' : 'Select Network...'} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSSIDs.length === 0 && <SelectItem value="no-networks" disabled>{language === 'tr' ? 'Çevrede Ağ Bulunamadı' : 'No Networks Found'}</SelectItem>}
                              {availableSSIDs.map((entry) => {
                                const hasDupe = availableSSIDs.filter(e => e.ssid === entry.ssid).length > 1;
                                const label = hasDupe ? `${entry.ssid} (${entry.deviceName})` : entry.ssid;
                                return (
                                  <SelectItem key={`${entry.deviceId}-${entry.ssid}`} value={`${entry.deviceId}|${entry.ssid}`}>
                                    {label}
                                  </SelectItem>
                                );
                              })}
                              {wifiSSID && !availableSSIDs.some(e => e.ssid === wifiSSID && (!wifiBSSID || e.deviceId === wifiBSSID)) && (
                                <SelectItem value={wifiBSSID ? `${wifiBSSID}|${wifiSSID}` : wifiSSID}>{wifiSSID} ({language === 'tr' ? 'Kaydedildi' : 'Saved'})</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black tracking-widest  text-slate-500 ml-1">
                            {language === 'tr' ? 'Güvenlik' : 'Security'}
                          </label>
                          <Select value={wifiSecurity} onValueChange={(val) => setWifiSecurity(val as any)} disabled={!wifiEnabled}>
                            <SelectTrigger className={`w-full ${isDark ? 'bg-background border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="wpa">WPA</SelectItem>
                              <SelectItem value="wpa2">WPA2 Personal</SelectItem>
                              <SelectItem value="wpa3">WPA3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {wifiSecurity !== 'open' && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black tracking-widest  text-slate-500 ml-1">
                              {language === 'tr' ? 'Parola' : 'Password'}
                            </label>
                            <Input
                              type="password"
                              value={wifiPassword}
                              onChange={(e) => setWifiPassword(e.target.value)}
                              placeholder="Security Key"
                              disabled={!wifiEnabled}
                              className="bg-background"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-[10px] font-black tracking-widest  text-slate-500 ml-1">
                            {language === 'tr' ? 'Kanal' : 'Channel'}
                          </label>
                          <Select value={wifiChannel} onValueChange={(val) => setWifiChannel(val as any)} disabled={!wifiEnabled}>
                            <SelectTrigger className={`w-full ${isDark ? 'bg-background border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2.4GHz">2.4 GHz</SelectItem>
                              <SelectItem value="5GHz">5 GHz</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className={`p-4 rounded-xl text-xs flex items-center gap-3 ${(() => {
                        if (!wifiEnabled) return 'text-slate-500 bg-slate-500/5';
                        // Check if connected: SSID matches an active AP
                        const isConnected = !!deviceStates && Array.from(deviceStates.entries()).some(([id, state]) => {
                          const wlan = state.ports['wlan0'];
                          if (!wlan || wlan.shutdown || wlan.wifi?.mode !== 'ap') return false;
                          if (wifiBSSID && wifiBSSID !== id) return false;
                          if (wlan.wifi?.ssid !== wifiSSID) return false;
                          const apSecurity = wlan.wifi?.security || 'open';
                          if (apSecurity !== wifiSecurity) return false;
                          if (apSecurity !== 'open' && wlan.wifi?.password !== wifiPassword) return false;
                          return true;
                        });
                        return isConnected ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10';
                      })()
                        }`}>
                        <div className={`p-2 rounded-lg ${(() => {
                          if (!wifiEnabled) return 'bg-slate-500/10';
                          const isConnected = !!deviceStates && Array.from(deviceStates.entries()).some(([id, state]) => {
                            const wlan = state.ports['wlan0'];
                            if (!wlan || wlan.shutdown || wlan.wifi?.mode !== 'ap') return false;
                            if (wifiBSSID && wifiBSSID !== id) return false;
                            if (wlan.wifi?.ssid !== wifiSSID) return false;
                            const apSecurity = wlan.wifi?.security || 'open';
                            if (apSecurity !== wifiSecurity) return false;
                            if (apSecurity !== 'open' && wlan.wifi?.password !== wifiPassword) return false;
                            return true;
                          });
                          return isConnected ? 'bg-emerald-500/20' : 'bg-amber-500/20';
                        })()
                          }`}>
                          <Monitor className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold  tracking-wider mb-0.5">
                            {language === 'tr' ? 'Durum' : 'Status'}
                          </div>
                          <div className="opacity-80">
                            {!wifiEnabled
                              ? (language === 'tr' ? 'Kablosuz alıcı kapalı' : 'Wireless receiver disabled')
                              : (() => {
                                const apEntry = !!deviceStates && Array.from(deviceStates.entries()).find(([id, state]) => {
                                  const wlan = state.ports['wlan0'];
                                  if (!wlan || wlan.shutdown || wlan.wifi?.mode !== 'ap') return false;
                                  if (wifiBSSID && wifiBSSID !== id) return false;
                                  if (wlan.wifi?.ssid !== wifiSSID) return false;
                                  const apSecurity = wlan.wifi?.security || 'open';
                                  if (apSecurity !== wifiSecurity) return false;
                                  if (apSecurity !== 'open' && wlan.wifi?.password !== wifiPassword) return false;
                                  return true;
                                });
                                if (apEntry) return language === 'tr' ? `Bağlı • SSID: ${wifiSSID}` : `Connected • SSID: ${wifiSSID}`;
                                return wifiSSID
                                  ? (language === 'tr' ? `Ağ bulunamadı: ${wifiSSID}` : `Network not found: ${wifiSSID}`)
                                  : (language === 'tr' ? 'WLAN0 aktif, ağ seçilmedi' : 'WLAN0 active, no network selected');
                              })()
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {activeTab === 'terminal' && (
                      <div className={`px-4 py-2 border-b ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'} flex items-center justify-between gap-3`}>
                        <div className="flex flex-col gap-1">
                          <div className="text-xs">
                            {isConsoleConnected && connectedDeviceId ? (
                              <span className="text-emerald-500 font-medium">
                                {t.physicalConnectionDetected} {topologyDevices.find((d: any) => d.id === connectedDeviceId)?.name || connectedDeviceId}
                              </span>
                            ) : (
                              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.noConsoleCableDetected}</span>
                            )}
                          </div>
                          <div className={`text-[10px] opacity-70 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {t.consoleConfiguration}
                          </div>
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
                      className={`flex-1 overflow-y-auto scroll-smooth custom-scrollbar p-4 md:p-6 space-y-2 font-mono text-sm leading-relaxed flex flex-col ${isPcPoweredOff ? 'bg-red-500' : ''}`}
                    >
                      {isPcPoweredOff ? (
                        <div className="flex-1 flex items-center justify-center text-slate-700">OFFLINE</div>
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
                                  className={`w-[10px] h-[10px] ${isHead
                                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                                    : isBody
                                      ? 'bg-emerald-600'
                                      : isFood
                                        ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)] animate-pulse'
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
                          {/* Mobile Touch Controls */}
                          <div className="grid grid-cols-3 gap-1 mt-2 md:hidden">
                            <div />
                            <button
                              onClick={() => direction.y === 0 && setDirection({ x: 0, y: -1 })}
                              className={`w-12 h-12 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-700 active:bg-slate-600' : 'bg-slate-200 active:bg-slate-300'}`}
                            >
                              <ChevronUp className="w-6 h-6" />
                            </button>
                            <div />
                            <button
                              onClick={() => direction.x === 0 && setDirection({ x: -1, y: 0 })}
                              className={`w-12 h-12 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-700 active:bg-slate-600' : 'bg-slate-200 active:bg-slate-300'}`}
                            >
                              <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button
                              onClick={() => gameOver && (() => { setSnake([{ x: 10, y: 10 }]); setFood({ x: 15, y: 15 }); setDirection({ x: 1, y: 0 }); setGameScore(0); setGameOver(false); })()}
                              className={`w-12 h-12 rounded-lg flex items-center justify-center text-xs font-bold ${gameOver ? 'bg-emerald-500 text-white' : (isDark ? 'bg-slate-800' : 'bg-slate-100')}`}
                            >
                              {gameOver ? (gameLanguage === 'tr' ? 'YENİ' : 'NEW') : ''}
                            </button>
                            <button
                              onClick={() => direction.x === 0 && setDirection({ x: 1, y: 0 })}
                              className={`w-12 h-12 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-700 active:bg-slate-600' : 'bg-slate-200 active:bg-slate-300'}`}
                            >
                              <ChevronRight className="w-6 h-6" />
                            </button>
                            <div />
                            <button
                              onClick={() => direction.y === 0 && setDirection({ x: 0, y: 1 })}
                              className={`w-12 h-12 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-700 active:bg-slate-600' : 'bg-slate-200 active:bg-slate-300'}`}
                            >
                              <ChevronDown className="w-6 h-6" />
                            </button>
                            <div />
                          </div>
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
                            {line.type === 'success' && <span className="text-cyan-500 font-bold  text-xs tracking-widest opacity-80">{highlightText(line.content)}</span>}
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
                    <div className={`flex items-center gap-2 sm:gap-3 relative ${isMobile ? 'flex-col' : ''}`}>
                      {/* Context hint for password/confirm in console mode */}
                      {activeTab === 'terminal' && isConsoleConnected && (consoleNeedsPassword || consoleConfirmDialog?.show || consoleReloadPending) && (
                        <div className="absolute -top-7 left-0 right-0 text-[10px] font-black tracking-widest text-amber-400 animate-pulse text-center">
                          {consoleNeedsPassword
                            ? (language === 'tr' ? 'Parola girin ve Enter\'a basın' : 'Enter password and press Enter')
                            : (language === 'tr' ? 'Onaylamak için Enter\'a basın' : 'Press Enter to confirm')}
                        </div>
                      )}
                      <div className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 ${inputBg} rounded-xl border flex-1 group ${isMobile ? 'w-full' : ''} ${activeTab === 'terminal' && isConsoleConnected && (consoleNeedsPassword || consoleConfirmDialog?.show || consoleReloadPending)
                        ? 'border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/50'
                        : inputBorder
                        }`}>
                        <span className={`font-black text-xs select-none shrink-0 opacity-50 ${activeTab === 'terminal' && isConsoleConnected && (consoleNeedsPassword || consoleConfirmDialog?.show || consoleReloadPending)
                          ? 'text-amber-400'
                          : 'text-emerald-500'
                          }`}>
                          {activeTab === 'desktop' ? `${internalPcHostname} C:\\>` : (() => {
                            if (consoleNeedsPassword) return 'Password:';
                            if (!connectedDeviceId || !deviceStates) return '>';
                            const state = deviceStates.get(connectedDeviceId);
                            const hostname = state?.hostname || 'Device';
                            const mode = state?.currentMode || 'user';
                            // Map CommandMode to prompt suffix
                            const modeSuffix: Record<string, string> = {
                              'user': '>',
                              'privileged': '#',
                              'config': '(config)#',
                              'interface': '(config-if)#',
                              'line': '(config-line)#',
                              'vlan': '(config-vlan)#',
                              'router-config': '(config)#'
                            };
                            const suffix = modeSuffix[mode] || '>';
                            return `${hostname}${suffix}`;
                          })()}
                        </span>
                        <input
                          ref={inputRef}
                          type={activeTab === 'terminal' && isConsoleConnected && consoleNeedsPassword ? 'password' : 'text'}
                          value={input}
                          onChange={(e) => handleInputChange(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onFocus={() => {
                            // Scroll input into view on mobile when keyboard opens
                            if (typeof window !== 'undefined' && window.innerWidth < 768) {
                              setTimeout(() => {
                                inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                              }, 300);
                            }
                          }}
                          className="flex-1 bg-transparent border-none outline-none font-mono text-[13px]"
                          placeholder={
                            activeTab === 'terminal' && isConsoleConnected && (consoleNeedsPassword || consoleConfirmDialog?.show || consoleReloadPending)
                              ? (consoleNeedsPassword
                                ? (language === 'tr' ? 'Parolayı girin...' : 'Enter password...')
                                : (language === 'tr' ? 'Enter\'a basın veya yazın...' : 'Press Enter or type...'))
                              : t.typeCommand
                          }
                          autoComplete="off"
                          disabled={activeTab === 'desktop' ? isCmdInputDisabled : isConsoleInputDisabled}
                        />
                      </div>
                      {activeTab === 'terminal' && isConsoleConnected && (consoleNeedsPassword || consoleConfirmDialog?.show || consoleReloadPending) && (
                        <Button
                          type="button"
                          disabled={isConsoleInputDisabled}
                          size="icon"
                          variant="ghost"
                          className="shrink-0 rounded-xl hover:bg-rose-500/20 text-rose-500"
                          onClick={() => {
                            if (onExecuteDeviceCommand && connectedDeviceId) {
                              if (consoleNeedsPassword) {
                                onExecuteDeviceCommand(connectedDeviceId, '__PASSWORD_CANCELLED__');
                              } else if (consoleReloadPending) {
                                // For reload, send 'n' to cancel
                                onExecuteDeviceCommand(connectedDeviceId, 'n');
                              }
                            }
                            setInput('');
                          }}
                          title={language === 'tr' ? 'İptal' : 'Cancel'}
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      )}
                      <Button
                        onClick={() => executeCommand()}
                        disabled={activeTab === 'desktop' ? (!input.trim() || isCmdInputDisabled) : isConsoleInputDisabled}
                        size="icon"
                        className={`shrink-0 h-11 w-11 rounded-xl text-white ${isMobile ? 'w-full' : ''} ${activeTab === 'terminal' && isConsoleConnected && (consoleNeedsPassword || consoleConfirmDialog?.show || consoleReloadPending)
                          ? 'bg-amber-500 hover:bg-amber-600'
                          : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                      >
                        <CornerDownLeft className={cn("w-6 h-6", isMobile && "w-8 h-8")} />
                      </Button>
                    </div>

                    {/* Quick Command Buttons */}
                    {activeTab === 'desktop' && !isPcPoweredOff && (
                      <div className={`px-1 sm:px-4 pb-1 sm:pb-3 border-t ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                        {isMobile ? (
                          <div className="grid grid-cols-2 gap-1">
                            <div className="col-span-2 space-y-2">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setInput('ipconfig');
                                    executeCommand('ipconfig');
                                  }}
                                  className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                                >
                                  ipconfig
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setInput('ping 8.8.8.8');
                                    //executeCommand('ping 8.8.8.8');
                                  }}
                                  className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                                >
                                  ping
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setInput('tracert 8.8.8.8');
                                    //executeCommand('tracert 8.8.8.8');
                                  }}
                                  className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                                >
                                  tracert
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setInput('nslookup test.com');
                                    //executeCommand('nslookup test.com');
                                  }}
                                  className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                                >
                                  nslookup
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setInput('arp -a');
                                    executeCommand('arp -a');
                                  }}
                                  className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                                >
                                  arp -a
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setInput('netstat -an');
                                    executeCommand('netstat -an');
                                  }}
                                  className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                                >
                                  netstat
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setInput('dir');
                                    executeCommand('dir');
                                  }}
                                  className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                                >
                                  dir
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setInput('ver');
                                    executeCommand('ver');
                                  }}
                                  className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                                >
                                  ver
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInput('ipconfig');
                                executeCommand('ipconfig');
                              }}
                              className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                            >
                              ipconfig
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInput('ping 8.8.8.8');
                                //executeCommand('ping 8.8.8.8');
                              }}
                              className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                            >
                              ping
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInput('tracert 8.8.8.8');
                                //executeCommand('tracert 8.8.8.8');
                              }}
                              className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                            >
                              tracert
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInput('nslookup test.com');
                                //executeCommand('nslookup test.com');
                              }}
                              className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                            >
                              nslookup
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInput('arp -a');
                                executeCommand('arp -a');
                              }}
                              className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                            >
                              arp -a
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInput('netstat -an');
                                executeCommand('netstat -an');
                              }}
                              className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                            >
                              netstat
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInput('dir');
                                executeCommand('dir');
                              }}
                              className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                            >
                              dir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInput('ver');
                                executeCommand('ver');
                              }}
                              className="text-[10px] sm:text-xs font-mono h-6 sm:h-8"
                            >
                              ver
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ModernPanel>
        </div>
      </div>
    </div>
  );
}

type PCActiveTab = 'home' | 'desktop' | 'terminal' | 'settings' | 'services' | 'wireless';

function getPCConfigDefaults(id: string) {
  const num = id.split('-')[1] || '1';
  return {
    ip: `192.168.1.${10 + parseInt(num)}`,
    mac: `00-40-96-99-88-7${num}`
  };
}





