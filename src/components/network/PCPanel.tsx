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
import { sanitizeHTTPContent } from '@/lib/security/sanitizer';
import { generateRouterAdminPage, isRouterDevice } from '@/components/network/WifiControlPanel';

// PC Icon component matching the main screen
const PCIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z" />
  </svg>
);

interface OutputLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'success' | 'prompt' | 'html';
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
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(-1);
  const [autocompleteNavigated, setAutocompleteNavigated] = useState(false);

  // Keep desktop CMD and console histories separate.
  const [desktopHistory, setDesktopHistory] = useState<string[]>(() => {
    return pcHistories?.get(deviceId) || [];
  });
  const [desktopHistoryIndex, setDesktopHistoryIndex] = useState(-1);
  const [consoleHistory, setConsoleHistory] = useState<string[]>([]);
  const [consoleHistoryIndex, setConsoleHistoryIndex] = useState(-1);

  // Undo/Redo state
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Sync with global history if it changes externally
  useEffect(() => {
    const globalHistory = pcHistories?.get(deviceId) || [];
    if (JSON.stringify(globalHistory) !== JSON.stringify(desktopHistory)) {
      setDesktopHistory(globalHistory);
      setDesktopHistoryIndex(-1);
    }
  }, [pcHistories, deviceId, desktopHistory]);

  // Reset per-tab command cursor when tab changes.
  useEffect(() => {
    if (activeTab === 'desktop') setDesktopHistoryIndex(-1);
    if (activeTab === 'terminal') setConsoleHistoryIndex(-1);
  }, [activeTab]);

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

  // When tablet powers on, navigate to CMD screen
  useEffect(() => {
    if (!isPcPoweredOff) {
      setActiveTab('desktop');
      tabletHistoryRef.current = ['desktop'];
      tabletHistoryIndexRef.current = 0;
      onNavigate?.('desktop');
    }
  }, [isPcPoweredOff, onNavigate]);

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
  const [httpAppContent, setHttpAppContent] = useState<string | null>(null);
  const [httpAppUrl, setHttpAppUrl] = useState<string>('');
  const [httpAppTitle, setHttpAppTitle] = useState<string>('HTTP Page');
  const [httpAppDeviceId, setHttpAppDeviceId] = useState<string | null>(null);
  const [browserWindow, setBrowserWindow] = useState({ x: 40, y: 140, width: 960, height: 400 });
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeStateRef = useRef<{
    side: 'left' | 'right' | 'bottom';
    startX: number;
    startY: number;
    originX: number;
    originW: number;
    originH: number;
  } | null>(null);

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
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const httpContentRef = useRef<HTMLTextAreaElement>(null);
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

  // Always keep CMD/Console views pinned to the latest output
  useEffect(() => {
    if (!outputRef.current) return;
    requestAnimationFrame(() => {
      outputRef.current!.scrollTop = outputRef.current!.scrollHeight;
    });
  }, [pcOutput, activeConsoleOutput, activeTab]);

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

  const getCommandMode = useCallback((): string => {
    if (activeTab === 'terminal' && isConsoleConnected && connectedDeviceId && deviceStates) {
      const state = deviceStates.get(connectedDeviceId);
      return state?.currentMode || 'user';
    }
    return 'user';
  }, [activeTab, isConsoleConnected, connectedDeviceId, deviceStates]);

  const getAutocompleteSuggestions = useCallback((value: string) => {
    const mode = getCommandMode();
    const { candidates, currentWord } = expandCommandContext(mode as any, value);
    const suggestions = candidates.filter(
      opt => opt !== '?' && opt.toLowerCase().startsWith(currentWord)
    );
    return suggestions.slice(0, 8);
  }, [getCommandMode]);

  const renderAutocompleteSuggestions = useMemo(
    () => getAutocompleteSuggestions(input),
    [getAutocompleteSuggestions, input]
  );

  const shouldShowAutocomplete = useMemo(
    () => showAutocomplete && input.trim().length > 0 && renderAutocompleteSuggestions.length > 0,
    [showAutocomplete, input, renderAutocompleteSuggestions]
  );
  const httpAppSrcDoc = useMemo(() => {
    if (!httpAppContent) return '';
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; }
      body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    </style>
  </head>
  <body>${httpAppContent}</body>
</html>`;
  }, [httpAppContent]);

  const buildCompletedInput = useCallback((selected: string) => {
    const mode = getCommandMode();
    const { contextTokens } = expandCommandContext(mode as any, input);
    const prefix = contextTokens.join(' ');
    return prefix ? `${prefix} ${selected}` : selected;
  }, [input, getCommandMode]);

  const completeAutocompleteSelection = useCallback((selected: string) => {
    const completed = buildCompletedInput(selected);
    setInput(completed);
    setShowAutocomplete(false);
    setAutocompleteIndex(-1);
    setAutocompleteNavigated(false);
    return completed;
  }, [buildCompletedInput]);

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
    // HTML çıktısını pop-up (modal) içinde aç
    if (type === 'html') {
      const safe = sanitizeHTTPContent(content || '') || ' ';
      const withLineBreaks = safe.replace(/\r?\n/g, '<br />');
      setHttpAppContent(withLineBreaks.trim() ? withLineBreaks : '<em>No HTTP content</em>');
      setHttpAppTitle(language === 'tr' ? 'HTTP Yönetim Sayfası' : 'HTTP Management Page');

      // Terminalde bilgilendir
      setPcOutput(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        type: 'success',
        content: language === 'tr'
          ? 'HTTP sayfası yeni pencerede açıldı.'
          : 'HTTP page opened in a new window.'
      }]);
      setTimeout(() => {
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }, 0);
      return;
    }

    const newLine: OutputLine = { id: Math.random().toString(36).substr(2, 9), type, content, prompt };
    setPcOutput(prev => [...prev, newLine]);
    setTimeout(() => {
      if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }, 0);
  }, [language]);

  useEffect(() => {
    if (!httpAppDeviceId) return;

    const handleRouterAdminMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'router-admin-save-wifi') return;
      if (data.deviceId !== httpAppDeviceId) return;

      const device = topologyDevices.find((d) => d.id === httpAppDeviceId);
      const payload = data.payload || {};
      const nextWifi = {
        enabled: Boolean(payload.enabled),
        ssid: String(payload.ssid || ''),
        security: payload.security || 'open',
        password: String(payload.password || ''),
        channel: payload.channel || '2.4GHz',
        mode: payload.mode || 'ap',
        hidden: Boolean(payload.hidden),
        maxClients: Number(payload.maxClients || 32),
        bssid: device?.wifi?.bssid || '',
      };

      window.dispatchEvent(new CustomEvent('update-topology-device-config', {
        detail: {
          deviceId: httpAppDeviceId,
          config: {
            wifi: nextWifi,
          },
        },
      }));

      addLocalOutput(
        'success',
        language === 'tr'
          ? `${device?.name || 'Cihaz'} WiFi ayarlari uygulandi.`
          : `${device?.name || 'Device'} WiFi settings applied.`
      );
    };

    window.addEventListener('message', handleRouterAdminMessage);
    return () => window.removeEventListener('message', handleRouterAdminMessage);
  }, [addLocalOutput, httpAppDeviceId, language, topologyDevices]);

  useEffect(() => {
    if (!httpAppContent || !isMobile || typeof window === 'undefined') return;
    setBrowserWindow((prev) => ({
      ...prev,
      x: 8,
      y: Math.max(80, prev.y),
      width: Math.max(280, window.innerWidth - 16),
    }));
  }, [httpAppContent, isMobile]);

  useEffect(() => {
    if (!httpAppDeviceId) return;
    const targetDevice = topologyDevices.find((d) => d.id === httpAppDeviceId);
    if (!targetDevice || !isRouterDevice(targetDevice)) return;

    const runtimeState = deviceStates?.get(httpAppDeviceId);
    const refreshed = generateRouterAdminPage(targetDevice, runtimeState);
    setHttpAppContent(refreshed);
  }, [httpAppDeviceId, topologyDevices, deviceStates]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (dragStateRef.current) {
        const dx = event.clientX - dragStateRef.current.startX;
        const dy = event.clientY - dragStateRef.current.startY;
        setBrowserWindow((prev) => ({
          ...prev,
          x: Math.max(0, dragStateRef.current!.originX + dx),
          y: Math.max(0, dragStateRef.current!.originY + dy),
        }));
      } else if (resizeStateRef.current) {
        const state = resizeStateRef.current;
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        setBrowserWindow((prev) => {
          if (state.side === 'bottom') {
            return {
              ...prev,
              height: Math.max(260, state.originH + dy),
            };
          }
          if (state.side === 'right') {
            return {
              ...prev,
              width: Math.max(420, state.originW + dx),
            };
          }

          const nextWidth = Math.max(420, state.originW - dx);
          const widthDiff = nextWidth - state.originW;
          return {
            ...prev,
            width: nextWidth,
            x: Math.max(0, state.originX - widthDiff),
          };
        });
      }
    };

    const handlePointerEnd = () => {
      dragStateRef.current = null;
      resizeStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, []);

  // Add multi-line output with delay between each line for realistic typing effect
  const addMultilineOutput = useCallback(async (type: OutputLine['type'], content: string, delayMs: number = 50) => {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLast = i === lines.length - 1;

      const newLine: OutputLine = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        content: line,
        prompt: i === 0 ? undefined : '' // Empty prompt for continuation lines
      };

      setPcOutput(prev => [...prev, newLine]);

      // Scroll after each line
      setTimeout(() => {
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }, 0);

      // Wait before next line (except for last)
      if (!isLast && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }, []);

  const applyHttpFormatting = useCallback((tag: 'b' | 'u' | 'i') => {
    const textarea = httpContentRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd, value } = textarea;
    if (selectionStart === null || selectionEnd === null || selectionStart === selectionEnd) return;

    const selected = value.slice(selectionStart, selectionEnd);
    const wrapped = `<${tag}>${selected}</${tag}>`;
    const nextValue = value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd);
    setServiceHttpContent(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const caret = selectionStart + wrapped.length;
      textarea.setSelectionRange(caret, caret);
    });
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

  const isLoopbackTarget = useCallback((target: string) => target.trim() === '127.0.0.1', []);

  const normalizeLookupTarget = useCallback((raw: string) => {
    const value = (raw || '').trim();
    if (!value) return '';
    try {
      const withScheme = value.startsWith('http://') || value.startsWith('https://')
        ? value
        : `http://${value}`;
      const parsed = new URL(withScheme);
      return parsed.hostname || value;
    } catch {
      return value.split('/')[0].split('?')[0].trim();
    }
  }, []);

  const resolveDeviceNameTarget = useCallback((raw: string) => {
    const normalized = (raw || '').trim().toLowerCase();
    if (!normalized) return null;

    if (normalized === 'localhost' || normalized === internalPcHostname.toLowerCase() || normalized === deviceId.toLowerCase()) {
      return { ip: '127.0.0.1', label: internalPcHostname };
    }

    const matched = topologyDevices.find((d) =>
      d.name?.toLowerCase() === normalized || d.id?.toLowerCase() === normalized
    );
    if (!matched) return null;

    if (matched.ip && isValidIpv4(matched.ip)) {
      return { ip: matched.ip, label: matched.name || matched.id };
    }

    const state = deviceStates?.get(matched.id);
    if (state?.ports) {
      for (const port of Object.values(state.ports)) {
        if (port?.ipAddress && isValidIpv4(port.ipAddress)) {
          return { ip: port.ipAddress, label: matched.name || matched.id };
        }
      }
    }

    return null;
  }, [deviceId, deviceStates, internalPcHostname, isValidIpv4, topologyDevices]);

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

    // Localhost should always resolve to the current PC first.
    if (normalizedTarget === '127.0.0.1') {
      const selfDevice = topologyDevices.find((d) => d.id === deviceId);
      if (selfDevice && selfDevice.services?.http?.enabled) return selfDevice;
    }

    // Check for PC HTTP servers
    const pcByIp = topologyDevices.find(
      (d) => d.type === 'pc' && d.ip === target && d.services?.http?.enabled
    );
    if (pcByIp && pcByIp.ip && canReachTargetIp(pcByIp.ip)) return pcByIp;

    // Check for router/switch devices with HTTP service enabled
    const routerByIp = topologyDevices.find(
      (d) => (d.type === 'router' || d.type === 'switchL2' || d.type === 'switchL3') && d.ip === target && d.services?.http?.enabled
    );
    if (routerByIp && routerByIp.ip && canReachTargetIp(routerByIp.ip)) return routerByIp;

    // Fallback: look into deviceStates interface IPs (e.g., VLAN/SVI, routed ports) for devices that have HTTP enabled
    if (deviceStates) {
      for (const [stateId, state] of deviceStates.entries()) {
        if (!state?.services?.http?.enabled) continue;
        const topoDevice = topologyDevices.find(d => d.id === stateId);
        if (!topoDevice || (topoDevice.type !== 'router' && topoDevice.type !== 'switchL2' && topoDevice.type !== 'switchL3')) continue;
        const ports = state.ports || {};
        const match = Object.values(ports).find((port: any) => port?.ipAddress === target);
        if (match && canReachTargetIp(target)) {
          return {
            ...topoDevice,
            ip: target
          };
        }
      }
    }

    // Try DNS resolution
    const dnsResult = resolveDomainWithDnsServices(normalizedTarget);
    if (!dnsResult) return null;

    // Check resolved address for PC HTTP server
    const resolvedPc = topologyDevices.find(
      (d) => d.type === 'pc' && d.ip === dnsResult.address && d.services?.http?.enabled
    ) || null;
    if (resolvedPc?.ip && canReachTargetIp(resolvedPc.ip)) return resolvedPc;

    // Check resolved address for router/switch with HTTP service enabled
    const resolvedRouter = topologyDevices.find(
      (d) => (d.type === 'router' || d.type === 'switchL2' || d.type === 'switchL3') && d.ip === dnsResult.address && d.services?.http?.enabled
    ) || null;
    if (resolvedRouter?.ip && canReachTargetIp(resolvedRouter.ip)) return resolvedRouter;

    // DNS fallback via deviceStates interfaces
    if (deviceStates) {
      for (const [stateId, state] of deviceStates.entries()) {
        if (!state?.services?.http?.enabled) continue;
        const topoDevice = topologyDevices.find(d => d.id === stateId);
        if (!topoDevice || (topoDevice.type !== 'router' && topoDevice.type !== 'switchL2' && topoDevice.type !== 'switchL3')) continue;
        const ports = state.ports || {};
        const match = Object.values(ports).find((port: any) => port?.ipAddress === dnsResult.address);
        if (match && canReachTargetIp(match.ipAddress || dnsResult.address)) {
          return {
            ...topoDevice,
            ip: match.ipAddress || dnsResult.address
          };
        }
      }
    }

    return null;
  }, [canReachTargetIp, resolveDomainWithDnsServices, topologyDevices, deviceStates, deviceId]);

  const openHttpTarget = useCallback((rawTarget?: string) => {
    const rawInput = (rawTarget || '').trim();
    const normalizedInput = rawInput || '192.168.1.10';
    let lookupTarget = normalizeLookupTarget(normalizedInput);
    let displayUrl = normalizedInput.startsWith('http://') || normalizedInput.startsWith('https://')
      ? normalizedInput
      : `http://${normalizedInput}`;

    // Browser-style inputs can include protocol/path/query. We only resolve host/IP.
    try {
      const parsed = new URL(displayUrl);
      lookupTarget = parsed.hostname || lookupTarget;
      displayUrl = parsed.toString();
    } catch {
      // Keep raw fallback and continue with existing validation flow.
    }

    const target = lookupTarget.trim() || '192.168.1.10';
    const namedTarget = resolveDeviceNameTarget(target);
    const resolvedTargetIp = namedTarget?.ip || target;
    if (!isLoopbackTarget(resolvedTargetIp) && isValidIpv4(resolvedTargetIp) && !hasGatewayForTarget(resolvedTargetIp)) {
      addLocalOutput('error', t.targetGatewayRequired);
      return;
    }
    if (!isValidIpv4(resolvedTargetIp)) {
      if (!isValidIpv4(pcDNS)) {
        addLocalOutput('error', t.dnsAddressRequired);
        return;
      }
      if (!hasGatewayForTarget(pcDNS)) {
        addLocalOutput('error', t.dnsGatewayRequired);
        return;
      }
    }

    const httpServer = findHttpServerByTarget(resolvedTargetIp);
    setHttpAppUrl(displayUrl);

    if (!httpServer) {
      setHttpAppDeviceId(null);
      setHttpAppTitle('404 Not Found');
      setHttpAppContent(`
        <main style="padding:32px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
          <h1 style="margin:0 0 8px;font-size:28px;">404</h1>
          <p style="margin:0 0 12px;font-size:16px;">Sayfa bulunamadi / Page not found</p>
          <code style="display:inline-block;padding:6px 10px;border-radius:8px;background:#f1f5f9;color:#0f172a;">${displayUrl}</code>
        </main>
      `);
      addLocalOutput('error', `404 Not Found: ${target}`);
    } else if (isRouterDevice(httpServer)) {
      const runtimeState = deviceStates?.get(httpServer.id);
      const adminPage = generateRouterAdminPage(httpServer, runtimeState);
      setHttpAppDeviceId(httpServer.id);
      setHttpAppContent(adminPage);
      setHttpAppTitle(language === 'tr' ? 'Yönlendirici Yönetimi' : 'Router Management');
      addLocalOutput('success', language === 'tr'
        ? 'HTTP sayfası yeni pencerede açıldı.'
        : 'HTTP page opened in a new window.');
    } else {
      setHttpAppDeviceId(null);
      addLocalOutput('html', httpServer.services?.http?.content || 'Merhaba Dünya!');
    }
  }, [addLocalOutput, deviceStates, findHttpServerByTarget, hasGatewayForTarget, isLoopbackTarget, isValidIpv4, language, normalizeLookupTarget, pcDNS, resolveDeviceNameTarget, t]);

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
    const clientHasUsableIp = validateIP(pcIP) && pcIP !== '0.0.0.0' && !pcIP.startsWith('169.254.');
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
  // Also retry if topology connections change, in case we were waiting for a cable.
  useEffect(() => {
    // If we already have a non-zero IP and we didn't just switch to DHCP mode,
    // don't try to get a new lease automatically on every connection change.
    const hasValidIp = pcIP && pcIP !== '0.0.0.0' && pcIP !== '169.254.0.0'; // basic check

    if (ipConfigMode !== 'dhcp') {
      prevIpConfigModeRef.current = ipConfigMode;
      return;
    }

    // If mode hasn't changed AND we already have an IP, don't re-trigger on connection changes
    // to avoid spamming the user with success toasts.
    if (prevIpConfigModeRef.current === 'dhcp' && hasValidIp) {
      return;
    }

    const lease = applyDhcpLease(true);
    if (lease) {
      toast({
        title: t.dhcpSuccessTitle,
        description: t.dhcpSuccessDescription.replace('{ip}', lease.ip),
      });
    } else {
      // Only show failure toast if we actually switched TO dhcp mode
      // or if we explicitly want to notify about continued failure.
      if (prevIpConfigModeRef.current !== 'dhcp') {
        toast({
          title: t.dhcpFailureTitle,
          description: t.dhcpFailureDescription,
          variant: 'destructive',
        });
      }
    }

    prevIpConfigModeRef.current = ipConfigMode;
  }, [applyDhcpLease, ipConfigMode, t, topologyConnections, pcIP]);

  const handleConnect = async () => {
    if (!consoleDevice) return;

    // Clear previous console output before connecting
    setPcOutput([]);

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

    if (activeTab === 'desktop') {
      if (desktopHistory[0] !== command) {
        const newHistory = [command, ...desktopHistory].slice(0, 50);
        setDesktopHistory(newHistory);
        if (onUpdatePCHistory) onUpdatePCHistory(deviceId, newHistory);
      }
      setDesktopHistoryIndex(-1);
    } else if (activeTab === 'terminal') {
      if (consoleHistory[0] !== command) {
        const newHistory = [command, ...consoleHistory].slice(0, 50);
        setConsoleHistory(newHistory);
      }
      setConsoleHistoryIndex(-1);
    }
    setInput('');
    setShowAutocomplete(false);
    setAutocompleteIndex(-1);
    setAutocompleteNavigated(false);
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
          await addMultilineOutput('output', `OS IP Configuration\n\n   Host Name . . . . . . . . . . . . : ${internalPcHostname}\n   Physical Address. . . . . . . . . : ${pcMAC}\n   DHCP Enabled. . . . . . . . . . . : No\n   IPv4 Address. . . . . . . . . . . : ${pcIP}(Preferred)\n   Subnet Mask . . . . . . . . . . . : ${pcSubnet}\n   Default Gateway . . . . . . . . . : ${pcGateway}\n   DNS Servers . . . . . . . . . . . : ${pcDNS}`, 80);
        } else {
          await addMultilineOutput('output', `OS IP Configuration\n\nEthernet adapter Ethernet0:\n   IPv4 Address. . . . . . . . . . . : ${pcIP}\n   Subnet Mask . . . . . . . . . . . : ${pcSubnet}\n   Default Gateway . . . . . . . . . : ${pcGateway}`, 80);
        }
      } else if (cmd === 'ping') {
        const target = args[0];
        if (!target) {
          addLocalOutput('output', 'Usage: ping <target_name_or_address>');
        } else {
          let targetIp = target;
          let dnsResolved = false;

          const namedResult = resolveDeviceNameTarget(target);
          if (namedResult) {
            targetIp = namedResult.ip;
            dnsResolved = true;
          }

          // If target is not an IP, try to resolve it via DNS
          if (!isValidIpv4(targetIp)) {
            const dnsResult = resolveDomainWithDnsServices(target);
            if (dnsResult) {
              targetIp = dnsResult.address;
              dnsResolved = true;
            } else {
              addLocalOutput('output', `Ping request could not find host ${target}. Please check the name and try again.`);
              return;
            }
          }

          if (isLoopbackTarget(targetIp)) {
            const pingTargetDisplay = dnsResolved ? `${target} [127.0.0.1]` : '127.0.0.1';
            await addMultilineOutput('output', `Pinging ${pingTargetDisplay} with 32 bytes of data:\nReply from 127.0.0.1: bytes=32 time<1ms TTL=128\nReply from 127.0.0.1: bytes=32 time<1ms TTL=128\nReply from 127.0.0.1: bytes=32 time<1ms TTL=128\nReply from 127.0.0.1: bytes=32 time<1ms TTL=128\n\nPing statistics for ${pingTargetDisplay}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`, 100);
            return;
          }

          const result = checkConnectivity(deviceId, targetIp, topologyDevices as any, topologyConnections as any, deviceStates || new Map(), t.language as 'tr' | 'en');
          if (result.success) {
            if (result.targetId) {
              window.dispatchEvent(new CustomEvent('trigger-ping-animation', {
                detail: { sourceId: deviceId, targetId: result.targetId }
              }));
            }
            const pingTargetDisplay = dnsResolved ? `${target} [${targetIp}]` : targetIp;
            await addMultilineOutput('output', `Pinging ${pingTargetDisplay} with 32 bytes of data:\nReply from ${targetIp}: bytes=32 time<1ms TTL=128\nReply from ${targetIp}: bytes=32 time<1ms TTL=128\nReply from ${targetIp}: bytes=32 time<1ms TTL=128\nReply from ${targetIp}: bytes=32 time<1ms TTL=128\n\nPing statistics for ${pingTargetDisplay}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`, 100);
          } else {
            const pingTargetDisplay = dnsResolved ? `${target} [${targetIp}]` : targetIp;
            await addMultilineOutput('output', `Pinging ${pingTargetDisplay} with 32 bytes of data:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\n\nPing statistics for ${pingTargetDisplay}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)`, 100);
          }
        }
      } else if (cmd === 'nslookup') {
        const rawTargetDomain = args[0];
        const targetDomain = rawTargetDomain ? normalizeLookupTarget(rawTargetDomain) : '';
        if (!targetDomain) {
          addLocalOutput('output', 'Usage: nslookup <domain>');
        } else if (resolveDeviceNameTarget(targetDomain)) {
          const resolved = resolveDeviceNameTarget(targetDomain)!;
          await addMultilineOutput(
            'output',
            `Server: local-device\nAddress: 127.0.0.1\n\nName: ${targetDomain}\nAddress: ${resolved.ip}`,
            80
          );
        } else if (!isValidIpv4(pcDNS)) {
          addLocalOutput('error', t.dnsInvalidAddress);
        } else if (!hasGatewayForTarget(pcDNS)) {
          addLocalOutput('error', t.dnsGatewayRequired);
        } else {
          const dnsResult = resolveDomainWithDnsServices(targetDomain);
          if (!dnsResult) {
            await addMultilineOutput('output', `*** DNS request timed out\n*** Can't find ${targetDomain}: Non-existent domain`, 80);
          } else {
            await addMultilineOutput(
              'output',
              `Server: ${dnsResult.server.name}\nAddress: ${dnsResult.server.ip}\n\nName: ${targetDomain}\nAddress: ${dnsResult.address}`,
              80
            );
          }
        }
      } else if (cmd === 'http') {
        openHttpTarget(args[0]);
      } else if (cmd === 'telnet') {
        const target = args[0];
        const port = args[1] || '23';
        if (!target) {
          addLocalOutput('output', 'Usage: telnet <ip_or_domain> [port]');
        } else {
          // Check if target is a domain and resolve it
          let targetIp = target;
          const namedResult = resolveDeviceNameTarget(target);
          if (namedResult) {
            targetIp = namedResult.ip;
          }
          if (!isValidIpv4(targetIp)) {
            const dnsResult = resolveDomainWithDnsServices(target);
            if (dnsResult) {
              targetIp = dnsResult.address;
            } else {
              addLocalOutput('error', `Could not resolve hostname ${target}`);
              return;
            }
          }

          if (isLoopbackTarget(targetIp)) {
            addLocalOutput('success', `Trying 127.0.0.1 ${port} ...\nConnected to 127.0.0.1.`);
            return;
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

                // Trigger remote VTY session bootstrap so password/login policy is applied.
                if (onExecuteDeviceCommand) {
                  void onExecuteDeviceCommand(result.targetId!, '__TELNET_CONNECT__');
                }
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
          const resolvedTarget = resolveDeviceNameTarget(target)?.ip || target;
          if (isLoopbackTarget(resolvedTarget)) {
            await addMultilineOutput('output', `Tracing route to 127.0.0.1 over a maximum of 30 hops:\n\n  1    <1 ms    <1 ms    <1 ms  localhost [127.0.0.1]\n\nTrace complete.`, 80);
            return;
          }
          addLocalOutput('output', `Tracing route to ${target} over a maximum of 30 hops:\n`);
          const result = checkConnectivity(deviceId, resolvedTarget, topologyDevices as any, topologyConnections as any, deviceStates || new Map(), t.language as 'tr' | 'en');

          if (result.hops && result.hops.length > 0) {
            let hopOutput = '';
            result.hops.forEach((hop, index) => {
              // Simulate some variation in hop display
              const hopName = hop;
              const hopIp = topologyDevices.find(d => d.name === hop || d.id === hop)?.ip || '?.?.?.?';
              hopOutput += `  ${index + 1}    <1 ms    <1 ms    <1 ms  ${hopName} [${hopIp}]\n`;
            });
            await addMultilineOutput('output', hopOutput + '\nTrace complete.', 80);
          } else {
            await addMultilineOutput('output', `  1    *        *        *     Request timed out.\n\nTrace complete.`, 80);
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
        await addMultilineOutput('output', output, 60);
      } else if (cmd === 'nbtstat') {
        if (args.includes('-n')) {
          await addMultilineOutput('output', `\nNetBIOS Local Name Table\n\n       Name               Type         Status\n    ---------------------------------------------\n    ${internalPcHostname.toUpperCase().padEnd(15)}  <00>  UNIQUE      Registered\n    WORKGROUP        <00>  GROUP       Registered\n    ${internalPcHostname.toUpperCase().padEnd(15)}  <20>  UNIQUE      Registered\n`, 80);
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

      // Console tab: do not mirror remote commands into local PC CMD output.
      if (onExecuteDeviceCommand && connectedDeviceId) {
        try { await onExecuteDeviceCommand(connectedDeviceId, command); } catch (err) { }
      }
    }
  };

  const handleTabComplete = useCallback(() => {
    const value = input;
    if (!value && tabCycleIndex === -1) return;

    const mode = getCommandMode();
    const { candidates, currentWord, contextTokens } = expandCommandContext(mode as any, value);
    const matches = candidates.filter(opt => opt !== '?' && opt.toLowerCase().startsWith(currentWord));

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
  }, [input, tabCycleIndex, lastTabInput, getCommandMode, executeCommand, isConsoleConnected, activeTab]);

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
    setAutocompleteNavigated(false);

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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const autocompleteSuggestions = renderAutocompleteSuggestions;
    const canUseAutocomplete = showAutocomplete && autocompleteSuggestions.length > 0;

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
      if (showAutocomplete) {
        e.preventDefault();
        setShowAutocomplete(false);
        setAutocompleteIndex(-1);
        setAutocompleteNavigated(false);
        return;
      }
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

    // Handle Ctrl+A (Select All) - Let browser handle natively
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      // Don't preventDefault - let browser handle select all
      return;
    }

    // Handle Ctrl+X (Cut) - Let browser handle natively
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
      // Don't preventDefault - let browser handle cut
      return;
    }

    // Handle Ctrl+C (Copy) - Let browser handle natively
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      // Don't preventDefault - let browser handle copy
      return;
    }

    // Handle Ctrl+V (Paste) - Let browser handle natively
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
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

    // Handle Ctrl+V (Paste) - Let browser handle it naturally, just prevent default to stop any global handlers
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      // Don't prevent default - let the browser handle paste natively
      // The only reason we had custom handling was to control cursor position
      // But browser default is more reliable
      return;
    }

    if (e.key === 'Enter') {
      if (canUseAutocomplete && autocompleteNavigated) {
        e.preventDefault();
        const completed = completeAutocompleteSelection(autocompleteSuggestions[autocompleteIndex] || autocompleteSuggestions[0]);
        executeCommand(completed);
        return;
      }
      executeCommand();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (canUseAutocomplete) {
        completeAutocompleteSelection(autocompleteSuggestions[autocompleteIndex] || autocompleteSuggestions[0]);
        return;
      }
      handleTabComplete();
    } else if (e.key === 'ArrowUp') {
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
      if (activeTab === 'desktop') {
        if (desktopHistory.length > 0 && desktopHistoryIndex < desktopHistory.length - 1) {
          const ni = desktopHistoryIndex + 1;
          setDesktopHistoryIndex(ni);
          setInput(desktopHistory[ni]);
        }
      } else if (activeTab === 'terminal') {
        if (consoleHistory.length > 0 && consoleHistoryIndex < consoleHistory.length - 1) {
          const ni = consoleHistoryIndex + 1;
          setConsoleHistoryIndex(ni);
          setInput(consoleHistory[ni]);
        }
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
      if (activeTab === 'desktop') {
        if (desktopHistoryIndex > 0) {
          const ni = desktopHistoryIndex - 1;
          setDesktopHistoryIndex(ni);
          setInput(desktopHistory[ni]);
        } else if (desktopHistoryIndex === 0) {
          setDesktopHistoryIndex(-1);
          setInput('');
        }
      } else if (activeTab === 'terminal') {
        if (consoleHistoryIndex > 0) {
          const ni = consoleHistoryIndex - 1;
          setConsoleHistoryIndex(ni);
          setInput(consoleHistory[ni]);
        } else if (consoleHistoryIndex === 0) {
          setConsoleHistoryIndex(-1);
          setInput('');
        }
      }
    }
  };

  const recentCommands = (activeTab === 'terminal' ? consoleHistory : desktopHistory).slice(0, 10);

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
    <>
      <div className={`
        w-full h-full flex flex-col items-center justify-center p-0 md:p-4
        ${isDark ? 'bg-slate-900' : 'bg-slate-100'}
      `}>
        {/* External Toolbar - Above Tablet Frame */}
        <div className={`
        w-full max-w-full lg:max-w-4xl mx-auto mb-2 px-3 py-1.5 flex items-center justify-between relative z-50
        rounded-lg border
        ${isDark
            ? 'bg-slate-800/90 border-slate-700 shadow-md'
            : 'bg-white/90 border-slate-200 shadow-md'
          }
      `}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isPcPoweredOff ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
            <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {internalPcHostname}
            </span>
            <span className={`text-xs font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {pcIP}
            </span>
            {/* Program Buttons - Left of Power */}
            <div className="flex items-center gap-1 ml-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigateToProgram('desktop')}
                    disabled={isPcPoweredOff}
                    className={`h-6 w-6 rounded-md ${isPcPoweredOff ? 'opacity-30' : activeTab === 'desktop' ? (isDark ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-500/30 text-blue-700') : (isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500')}`}
                    aria-label="CMD"
                  >
                    <TerminalIcon className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>CMD</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigateToProgram('terminal')}
                    disabled={isPcPoweredOff}
                    className={`h-6 w-6 rounded-md ${isPcPoweredOff ? 'opacity-30' : activeTab === 'terminal' ? (isDark ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-500/30 text-emerald-700') : (isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500')}`}
                    aria-label={language === 'tr' ? 'Konsol' : 'Console'}
                  >
                    <Laptop className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{language === 'tr' ? 'Konsol' : 'Console'}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setActiveTab('services')}
                    disabled={isPcPoweredOff}
                    className={`h-6 w-6 rounded-md ${isPcPoweredOff ? 'opacity-30' : activeTab === 'services' ? (isDark ? 'bg-amber-500/30 text-amber-300' : 'bg-amber-500/30 text-amber-700') : (isDark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-600 hover:text-amber-500')}`}
                    aria-label={language === 'tr' ? 'Servisler' : 'Services'}
                  >
                    <Globe className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{language === 'tr' ? 'Servisler' : 'Services'}</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Settings - Left of Power */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateToProgram('settings')}
                  disabled={isPcPoweredOff}
                  className={`h-6 w-6 rounded-md ${isPcPoweredOff ? 'opacity-30' : activeTab === 'settings' ? (isDark ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-500/30 text-purple-700') : (isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500')}`}
                  aria-label={language === 'tr' ? 'Ayarlar' : 'Settings'}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{language === 'tr' ? 'Ayarlar' : 'Settings'}</TooltipContent>
            </Tooltip>
            {/* WiFi */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveTab('wireless')}
                  disabled={isPcPoweredOff}
                  className={`h-6 w-6 rounded-md ${isPcPoweredOff ? 'opacity-30' : activeTab === 'wireless' ? (isDark ? 'bg-cyan-500/30 text-cyan-300' : 'bg-cyan-500/30 text-cyan-700') : (isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-500')}`}
                  aria-label={language === 'tr' ? 'Kablosuz' : 'Wireless'}
                >
                  <Wifi className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{language === 'tr' ? 'Kablosuz' : 'Wireless'}</TooltipContent>
            </Tooltip>
            {/* Power Button - Always visible */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    goHome();
                    onTogglePower?.(deviceId);
                  }}
                  className={`h-6 w-6 rounded-md ui-hover-surface transition-all ${isPcPoweredOff ? 'text-rose-500 hover:text-rose-400' : 'text-emerald-500 hover:text-emerald-400'}`}
                  aria-label={t.power}
                  disabled={!onTogglePower}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 1 1-12.728 0" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.power}</TooltipContent>
            </Tooltip>
            {/* Clock */}
            <div className={`ml-2 text-xs font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {formatTime(currentTime)}
            </div>
            {/* Close Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className={`h-6 w-6 rounded-md ui-hover-surface ${isDark ? 'text-slate-300 hover:text-red-400' : 'text-slate-600 hover:text-red-600'}`}
                  aria-label={language === 'tr' ? 'Kapat' : 'Close'}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{language === 'tr' ? 'Kapat' : 'Close'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Tablet Frame - Simple modern tablet design */}
        <div className={`
        w-full max-w-full lg:max-w-4xl mx-auto overflow-hidden self-center
        relative flex flex-col h-[500px]
        ${isDark
            ? 'bg-slate-800 md:border-2 md:border-slate-600 md:rounded-2xl md:shadow-xl'
            : 'bg-slate-200 md:border-2 md:border-slate-300 md:rounded-2xl md:shadow-xl'
          }
      `}>
          {/* Screen Area - Clean and simple */}
          <div className={`
          flex-1 relative overflow-hidden
          ${isDark
              ? 'bg-slate-900'
              : 'bg-white'
            }
        `}>
            {/* Power Off Overlay - Tablet ekranını tamamen karartır */}
            {isPcPoweredOff && (
              <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full animate-pulse" />
                  <svg className="w-16 h-16 text-red-600 drop-shadow-xl relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 1 1-12.728 0" />
                  </svg>
                </div>
              </div>
            )}
            <ModernPanel
              id={deviceId}
              title={internalPcHostname}
              onClose={onClose}
              collapsible={false}
              hideTitle
              hideHeader
              className={cn(
                "w-full min-w-0 h-full flex flex-col",
                isDark
                  ? "bg-slate-900/40 border border-slate-700/40 backdrop-blur-xl"
                  : "bg-white/25 border border-white/40 backdrop-blur-xl shadow-lg shadow-white/10"
              )}
            >
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-transparent">
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
                <div className={`flex-1 min-h-0 flex flex-col ${terminalBg} relative overflow-hidden pt-2.5`}>
                  {activeTab === 'home' && (
                    <div className="flex-1 flex items-center justify-center p-2.5 pt-0">
                      <div className="w-full h-full max-w-[700px] grid grid-cols-5 gap-2 rounded-xl p-2.5 bg-slate-800/30 border border-slate-700/30 shadow-sm place-items-center">
                        <button
                          onClick={() => navigateToProgram('desktop')}
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10"
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-600">
                            <TerminalIcon className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-xs font-medium text-slate-300">
                            CMD
                          </span>
                        </button>
                        <button
                          onClick={() => navigateToProgram('terminal')}
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10"
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-600">
                            <Laptop className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-xs font-medium text-slate-300">
                            {language === 'tr' ? 'Konsol' : 'Console'}
                          </span>
                        </button>
                        <button
                          onClick={() => navigateToProgram('settings')}
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10"
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-600">
                            <Settings className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-xs font-medium text-slate-300">
                            {language === 'tr' ? 'Ayarlar' : 'Settings'}
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveTab('services')}
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10"
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-600">
                            <Globe className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-xs font-medium text-slate-300">
                            {language === 'tr' ? 'Servisler' : 'Services'}
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveTab('wireless')}
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10"
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-600">
                            <Wifi className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-xs font-medium text-slate-300">
                            {language === 'tr' ? 'Kablosuz' : 'Wireless'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'settings' && (
                    <div className="flex-1 min-h-0 p-3 md:p-4 space-y-3 md:space-y-4 overflow-y-auto custom-scrollbar overflow-x-hidden pt-2.5">
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
                  )}

                  {activeTab === 'services' && (
                    <div className="flex-1 min-h-0 p-3 md:p-4 space-y-3 md:space-y-4 overflow-y-auto custom-scrollbar overflow-x-hidden">
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
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${serviceDnsEnabled ? 'bg-cyan-500/15 text-cyan-600 border border-cyan-500/30' : 'bg-slate-200 text-slate-500 border border-slate-300'}`}>
                              {serviceDnsEnabled ? 'ON' : 'OFF'}
                            </span>
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
                                <span className="mx-2 opacity-30">-&gt;</span>
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
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${serviceHttpEnabled ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-slate-200 text-slate-500 border border-slate-300'}`}>
                              {serviceHttpEnabled ? 'ON' : 'OFF'}
                            </span>
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
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold  tracking-wide text-slate-500">HTTP Content</label>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <Button type="button" size="icon" variant="outline" className="h-8 w-8 text-xs font-black" onClick={() => applyHttpFormatting('b')}>B</Button>
                              <Button type="button" size="icon" variant="outline" className="h-8 w-8 text-xs font-black italic" onClick={() => applyHttpFormatting('i')}>I</Button>
                              <Button type="button" size="icon" variant="outline" className="h-8 w-8 text-xs font-black underline" onClick={() => applyHttpFormatting('u')}>U</Button>
                            </div>
                            <span className="text-[10px] text-slate-500">{t.language === 'tr' ? 'Seçili metni biçimlendir' : 'Format selected text'}</span>
                          </div>
                          <textarea
                            ref={httpContentRef}
                            value={serviceHttpContent}
                            onChange={(e) => setServiceHttpContent(e.target.value)}
                            placeholder="Merhaba Dünya!"
                            rows={6}
                            className={`w-full rounded-lg border px-3 py-2 text-sm font-mono resize-y ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
                          />
                          {serviceHttpEnabled && (
                            <div className={`text-xs rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>
                              <span dangerouslySetInnerHTML={{ __html: sanitizeHTTPContent(serviceHttpContent || 'Merhaba Dünya!') }} />
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
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${serviceDhcpEnabled ? 'bg-sky-500/15 text-sky-600 border border-sky-500/30' : 'bg-slate-200 text-slate-500 border border-slate-300'}`}>
                              {serviceDhcpEnabled ? 'ON' : 'OFF'}
                            </span>
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
                  )}

                  {activeTab === 'wireless' && (
                    <div className="flex-1 min-h-0 p-3 md:p-4 space-y-3 md:space-y-4 overflow-y-auto custom-scrollbar overflow-x-hidden">
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
                  )}

                  {(activeTab === 'desktop' || activeTab === 'terminal') && (
                    <>
                      {activeTab === 'terminal' && (
                        <div className={`px-3 md:px-4 py-2 border-b ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'} flex items-center justify-between gap-3`}>
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
                        className={`flex-1 min-h-0 overflow-y-auto scroll-smooth custom-scrollbar p-2 md:p-3 space-y-2 font-mono text-sm leading-relaxed flex flex-col overflow-x-hidden ${isPcPoweredOff ? 'bg-red-500' : ''}`}
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
                              {/* HTML çıktıları pop-up içinde gösteriliyor */}
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
                    <div className={`shrink-0 z-10 p-3 sm:p-4 border-t ${isDark ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-slate-50/95'}`}>
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
                        {shouldShowAutocomplete && (
                          <div
                            ref={autocompleteRef}
                            className="absolute bottom-16 left-3 right-3 z-20 sm:left-4 sm:right-4"
                          >
                            <div className={cn(
                              "rounded-lg border shadow-xl overflow-hidden",
                              isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                            )}>
                              <div className={`flex items-center justify-between px-3 py-2 text-[11px] font-semibold ${isDark ? 'text-slate-200 bg-slate-900/60' : 'text-slate-700 bg-slate-50'}`}>
                                <span>{language === 'tr' ? 'Komut önerileri' : 'Command suggestions'}</span>
                                <span className={`text-[10px] font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                                  Tab ↹ {language === 'tr' ? 'ile tamamla' : 'to complete'}
                                </span>
                              </div>
                              <div className="max-h-40 overflow-y-auto">
                                {renderAutocompleteSuggestions.map((cmd, idx) => (
                                  <button
                                    key={`${cmd}-${idx}`}
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

                    </div>
                  )}
                </div>
              </div>
            </ModernPanel>
          </div>
        </div>
      </div>

      {/* HTTP content in-tablet viewer */}
      {httpAppContent && (
        <div className="fixed inset-0 z-[999] pointer-events-auto">
          <div
            className="absolute"
            style={isMobile
              ? {
                left: 8,
                right: 8,
                top: browserWindow.y,
                width: 'auto',
                height: browserWindow.height,
              }
              : {
                left: browserWindow.x,
                top: browserWindow.y,
                width: browserWindow.width,
                height: browserWindow.height,
              }}
          >
            <div
              className={`h-full w-full rounded-2xl shadow-2xl border ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} flex flex-col overflow-hidden`}
              style={{ borderWidth: 3 }}
            >
              <div
                className={`flex items-center justify-between px-4 py-2 border-b cursor-move select-none touch-none ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-100'}`}
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('input, textarea, select, button')) return;
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dragStateRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    originX: browserWindow.x,
                    originY: browserWindow.y,
                  };
                }}
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openHttpTarget(httpAppUrl);
                    }}
                    onKeyDown={(e) => {
                      // Prevent browser keys from bubbling into underlying CMD handlers.
                      e.stopPropagation();
                    }}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-semibold truncate">{httpAppTitle}</span>
                      <input
                        value={httpAppUrl || ''}
                        onChange={(e) => setHttpAppUrl(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            openHttpTarget(httpAppUrl);
                          }
                        }}
                        placeholder="http://"
                        className={`mt-1 w-full text-xs rounded-md px-2 py-1 border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
                      />
                    </div>
                    <Button size="sm" type="submit" className="shrink-0">
                      {language === 'tr' ? 'Git' : 'Go'}
                    </Button>
                  </form>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    setHttpAppContent(null);
                    setHttpAppDeviceId(null);
                  }}
                  className="ml-3 shrink-0"
                  aria-label={language === 'tr' ? 'Kapat' : 'Close'}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-900">
                <iframe
                  title={httpAppTitle}
                  srcDoc={httpAppSrcDoc}
                  sandbox="allow-forms allow-scripts"
                  className="h-full w-full border-0 bg-white"
                />
              </div>
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize select-none touch-none"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  resizeStateRef.current = {
                    side: 'left',
                    startX: e.clientX,
                    startY: e.clientY,
                    originX: browserWindow.x,
                    originW: browserWindow.width,
                    originH: browserWindow.height,
                  };
                }}
              />
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize select-none touch-none"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  resizeStateRef.current = {
                    side: 'right',
                    startX: e.clientX,
                    startY: e.clientY,
                    originX: browserWindow.x,
                    originW: browserWindow.width,
                    originH: browserWindow.height,
                  };
                }}
              />
              <div
                className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize select-none touch-none"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  resizeStateRef.current = {
                    side: 'bottom',
                    startX: e.clientX,
                    startY: e.clientY,
                    originX: browserWindow.x,
                    originW: browserWindow.width,
                    originH: browserWindow.height,
                  };
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
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





