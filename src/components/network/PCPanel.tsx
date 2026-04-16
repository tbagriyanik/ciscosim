'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback, useMemo, type CSSProperties } from 'react';
import { useSwitchState, useAppStore, useEnvironment } from '@/lib/store/appStore';
import { CableInfo, isCableCompatible, SwitchState } from '@/lib/network/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TerminalOutput } from './Terminal';
import type { CanvasDevice } from './networkTopology.types';
import { checkConnectivity, getWirelessSignalStrength, getWirelessDistance, getDeviceWifiConfig } from '@/lib/network/connectivity';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Laptop, Monitor, Terminal as TerminalIcon, X, CornerDownLeft, Command, Globe, Network, ShieldCheck, History, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Copy, Save, Trash2, Download, Settings, Wifi, Eye, EyeOff, Radio, LayoutGrid } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from "@/hooks/use-toast";
import { isValidMAC, normalizeMAC, cn } from "@/lib/utils";
import { ModernPanel } from '@/components/ui/ModernPanel';
import { useIsMobile, useIsDesktop } from '@/hooks/use-breakpoint';
import { sanitizeHTTPContent } from '@/lib/security/sanitizer';
import { generateRouterAdminPage, isRouterDevice } from '@/components/network/WifiControlPanel';
import { generateIotWebPanelContent, generateIotDevicePageContent } from '@/lib/network/iotWebPanel';
import { generateRandomLinkLocalIpv4 } from '@/lib/network/linkLocal';
import { PCIcon, WifiSignalMeter, IoTSensorDisplay } from './PCPanelWidgets';
import { expandCommandContext, DESKTOP_COMMANDS } from './pcPanel.utils';


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
  onDeleteDevice?: (deviceId: string) => void;
}


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
  onNavigate,
  onDeleteDevice
}: PCPanelProps) {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const environment = useEnvironment();

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
  const activeTabRef = useRef<PCActiveTab>(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const [activeServiceTab, setActiveServiceTab] = useState<'dns' | 'http' | 'dhcp'>('dns');
  const tabletHistoryRef = useRef<PCActiveTab[]>(['home']);
  const tabletHistoryIndexRef = useRef(0);
  const isInternalTabletNavRef = useRef(false);
  const mobileVerticalScrollStyle: CSSProperties | undefined = isMobile
    ? {
      overflowY: 'auto' as const,
      WebkitOverflowScrolling: 'touch' as const,
      overscrollBehaviorY: 'contain' as const,
      touchAction: 'pan-y' as const,
    }
    : undefined;

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
  const [fontSize, setFontSize] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('terminal-font-size') || '13', 10); } catch { return 13; }
  });
  const [showCmdSettings, setShowCmdSettings] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFontSizeChange = (val: number) => {
    setFontSize(val);
    try { localStorage.setItem('terminal-font-size', String(val)); } catch { }
  };
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
  const wifiSignalStrength = useMemo(
    () => getWirelessSignalStrength(deviceFromTopology, topologyDevices, deviceStates),
    [deviceFromTopology, topologyDevices, deviceStates]
  );

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
  const isDhcpEditingRef = useRef(false); // Track if user is actively editing DHCP pools
  const isDnsEditingRef = useRef(false); // Track if user is actively editing DNS records
  const checkDhcpAvailabilityRef = useRef<() => { available: boolean; reason: string }>(() => ({ available: true, reason: '' }));
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
  const [ssidDropdownOpen, setSsidDropdownOpen] = useState(false);
  const [wifiSecurity, setWifiSecurity] = useState(deviceFromTopology?.wifi?.security ?? 'open');
  const [wifiPassword, setWifiPassword] = useState(deviceFromTopology?.wifi?.password ?? '');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [wifiChannel, setWifiChannel] = useState(deviceFromTopology?.wifi?.channel ?? '2.4GHz');
  const [wifiBSSID, setWifiBSSID] = useState(deviceFromTopology?.wifi?.bssid ?? '');
  const iotDevices = useMemo(
    () => {
      const allIotDevices = topologyDevices.filter((d) => d.type === 'iot');
      // Filter IoT devices that are reachable from the PC
      return allIotDevices.filter(device => {
        // Check if device has an IP and is in the same subnet or reachable via gateway
        if (device.ip && pcIP && pcSubnet && pcGateway) {
          try {
            const a = pcIP.split('.').map(Number);
            const b = device.ip.split('.').map(Number);
            const m = pcSubnet.split('.').map(Number);
            if (a.length === 4 && b.length === 4 && m.length === 4) {
              let sameSubnet = true;
              for (let i = 0; i < 4; i++) {
                if ((a[i] & m[i]) !== (b[i] & m[i])) {
                  sameSubnet = false;
                  break;
                }
              }
              if (sameSubnet) return true;
            }
          } catch {
            // Invalid IP format, skip
          }
          
          // Check if device is reachable via gateway
          if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(pcGateway.trim())) return true;
        }

        // Check if device is connected via WiFi to the same AP as PC
        if (device.wifi?.enabled && device.wifi?.ssid && wifiEnabled && wifiSSID) {
          if (device.wifi.ssid === wifiSSID) return true;
        }

        // Check if device is connected via cable to the PC or in the same network
        if (topologyConnections.some(c => 
          (c.sourceDeviceId === deviceId && c.targetDeviceId === device.id) ||
          (c.targetDeviceId === deviceId && c.sourceDeviceId === device.id)
        )) {
          return true;
        }

        // Check if device is connected to the same router/AP as PC
        const connectedToSameRouter = topologyConnections.some(c => {
          const otherDeviceId = c.sourceDeviceId === deviceId ? c.targetDeviceId : c.sourceDeviceId === deviceId ? c.sourceDeviceId : null;
          if (!otherDeviceId) return false;
          
          const otherDevice = topologyDevices.find(d => d.id === otherDeviceId);
          if (!otherDevice || (otherDevice.type !== 'router' && otherDevice.type !== 'switchL2' && otherDevice.type !== 'switchL3')) return false;

          // Check if the router/switch is in the PC's network
          if (otherDevice.ip && pcIP && pcSubnet) {
            try {
              const a = pcIP.split('.').map(Number);
              const r = otherDevice.ip.split('.').map(Number);
              const m = pcSubnet.split('.').map(Number);
              if (a.length === 4 && r.length === 4 && m.length === 4) {
                let routerInSameSubnet = true;
                for (let i = 0; i < 4; i++) {
                  if ((a[i] & m[i]) !== (r[i] & m[i])) {
                    routerInSameSubnet = false;
                    break;
                  }
                }
                if (!routerInSameSubnet) return false;
              }
            } catch {
              // Invalid IP format, skip
            }
          } else if (!otherDevice.ip) {
            // Router has no IP, cannot verify network - skip
            return false;
          }

          return topologyConnections.some(c2 =>
            (c2.sourceDeviceId === otherDeviceId && c2.targetDeviceId === device.id) ||
            (c2.targetDeviceId === otherDeviceId && c2.sourceDeviceId === device.id)
          );
        });

        if (connectedToSameRouter) return true;

        return false;
      });
    },
    [topologyDevices, pcIP, pcSubnet, pcGateway, wifiEnabled, wifiSSID, deviceId, topologyConnections]
  );
  const [selectedIotDeviceId, setSelectedIotDeviceId] = useState<string>('');
  const selectedIotDevice = useMemo(
    () => iotDevices.find((d) => d.id === selectedIotDeviceId) || null,
    [iotDevices, selectedIotDeviceId]
  );

  const [iotSensorType, setIotSensorType] = useState<'temperature' | 'sound' | 'motion' | 'humidity' | 'light'>('temperature');
  const [iotCollaborationEnabled, setIotCollaborationEnabled] = useState(false);
  const [iotDataStore, setIotDataStore] = useState('');

  // Scan for available APs in the network topology dynamically - returns one entry per AP (allows duplicates)
  const availableSSIDs = useMemo(() => {
    const results: { ssid: string; deviceId: string; deviceName: string }[] = [];
    const addedSSIDs = new Set<string>();

    // First check deviceStates (router/switch runtime state) - only AP mode
    if (deviceStates) {
      deviceStates.forEach((state, stateId) => {
        if (stateId === deviceId) return; // skip self
        const stateDevice = topologyDevices.find(d => d.id === stateId);
        // Only router/switch can be AP, not PC
        if (!stateDevice || (stateDevice.type !== 'router' && stateDevice.type !== 'switchL2' && stateDevice.type !== 'switchL3')) return;
        const wlanPort = state.ports['wlan0'];
        const wifiMode = (wlanPort?.wifi?.mode || '').toLowerCase();
        // Only show devices in AP mode
        if (wlanPort && !wlanPort.shutdown && wifiMode === 'ap' && wlanPort.wifi?.ssid) {
          const ssidKey = wlanPort.wifi.ssid;
          if (!addedSSIDs.has(ssidKey)) {
            addedSSIDs.add(ssidKey);
            results.push({
              ssid: wlanPort.wifi.ssid,
              deviceId: stateId,
              deviceName: stateDevice?.name || stateId,
            });
          }
        }
      });
    }
    // Also check topologyDevices for web-admin saved WiFi settings (router/switch only)
    if (results.length === 0) {
      topologyDevices.forEach((device) => {
        if (device.id === deviceId) return;
        // Only router/switch can be AP, not PC
        if (device.type !== 'router' && device.type !== 'switchL2' && device.type !== 'switchL3') return;
        const wifi = device.wifi;
        // Check if WiFi is enabled and in AP mode
        if (wifi?.enabled && wifi.mode === 'ap' && wifi.ssid) {
          const ssidKey = wifi.ssid;
          if (!addedSSIDs.has(ssidKey)) {
            addedSSIDs.add(ssidKey);
            results.push({
              ssid: wifi.ssid,
              deviceId: device.id,
              deviceName: device.name,
            });
          }
        }
      });
    }
    return results;
  }, [deviceStates, deviceId, topologyDevices]);
  const [errors, setErrors] = useState<Record<string, string>>({});


  // Track previous device ID and services to detect changes
  const prevDeviceIdRef = useRef<string | null>(null);
  const prevServicesRef = useRef<any>(null);

  // Reset services state only when device changes or first entering services tab
  useEffect(() => {
    const deviceChanged = prevDeviceIdRef.current !== deviceId;
    const servicesChanged = JSON.stringify(deviceFromTopology?.services) !== JSON.stringify(prevServicesRef.current);

    // Reset if device changed (user switched to different PC)
    // OR if this is first load (prevDeviceIdRef.current is null)
    if (deviceChanged || prevDeviceIdRef.current === null) {
      prevDeviceIdRef.current = deviceId;
      prevServicesRef.current = deviceFromTopology?.services;

      setServiceDnsEnabled(deviceFromTopology?.services?.dns?.enabled ?? false);
      setServiceDnsRecords(deviceFromTopology?.services?.dns?.records || []);
      setServiceHttpEnabled(deviceFromTopology?.services?.http?.enabled ?? false);
      setServiceHttpContent(deviceFromTopology?.services?.http?.content || 'Merhaba Dünya!');
      setServiceDhcpEnabled(deviceFromTopology?.services?.dhcp?.enabled ?? false);
      setServiceDhcpPools(deviceFromTopology?.services?.dhcp?.pools || []);

      setDnsFormDomain('');
      setDnsFormAddress('');
      setEditingDnsIndex(null);
      setDhcpForm({
        poolName: '',
        defaultGateway: '',
        dnsServer: '',
        startIp: '',
        subnetMask: '255.255.255.0',
        maxUsers: 50,
      });
      setEditingDhcpIndex(null);
    }

    setIpConfigMode(deviceFromTopology?.ipConfigMode || 'static');
    setWifiEnabled(deviceFromTopology?.wifi?.enabled ?? false);
    setWifiSSID(deviceFromTopology?.wifi?.ssid ?? '');
    setWifiSecurity(deviceFromTopology?.wifi?.security ?? 'open');
    setWifiPassword(deviceFromTopology?.wifi?.password ?? '');
    setWifiChannel(deviceFromTopology?.wifi?.channel ?? '2.4GHz');
  }, [deviceId]);

  useEffect(() => {
    if (!iotDevices.length) {
      setSelectedIotDeviceId('');
      return;
    }
    if (!selectedIotDeviceId || !iotDevices.some((d) => d.id === selectedIotDeviceId)) {
      setSelectedIotDeviceId(iotDevices[0].id);
    }
  }, [iotDevices, selectedIotDeviceId]);

  useEffect(() => {
    if (!selectedIotDevice) return;
    setIotSensorType(selectedIotDevice.iot?.sensorType || 'temperature');
    setIotCollaborationEnabled(!!selectedIotDevice.iot?.collaborationEnabled);
    setIotDataStore(selectedIotDevice.iot?.dataStore || '');
  }, [selectedIotDevice]);

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
      // Only sync wifi config for PC devices - router/switch wifi is managed via CLI
      const deviceType = topologyDevices.find(d => d.id === deviceId)?.type;
      if (deviceType !== 'pc') return;

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
  }, [internalPcHostname, ipConfigMode, pcIP, pcMAC, pcSubnet, pcGateway, pcDNS, pcIPv6, pcIPv6Prefix, serviceDnsEnabled, serviceDnsRecords, serviceHttpEnabled, serviceHttpContent, serviceDhcpEnabled, serviceDhcpPools, wifiEnabled, wifiSSID, wifiBSSID, wifiSecurity, wifiPassword, wifiChannel, deviceId, topologyDevices]);

  const saveIotConfig = useCallback((showToast: boolean = true) => {
    if (!selectedIotDeviceId) return;
    window.dispatchEvent(new CustomEvent('update-topology-device-config', {
      detail: {
        deviceId: selectedIotDeviceId,
        config: {
          iot: {
            sensorType: iotSensorType,
            collaborationEnabled: iotCollaborationEnabled,
            dataStore: iotDataStore,
          }
        }
      }
    }));
    if (showToast) {
      toast({
        title: language === 'tr' ? 'IoT kaydedildi' : 'IoT saved',
        description: language === 'tr' ? 'Secili IoT nesnesi guncellendi.' : 'Selected IoT object updated.',
      });
    }
  }, [selectedIotDeviceId, iotSensorType, iotCollaborationEnabled, iotDataStore, language]);

  // Auto-save IoT config on change (debounced)
  useEffect(() => {
    if (!selectedIotDeviceId) return;
    const handler = setTimeout(() => {
      saveIotConfig(false);
    }, 500);
    return () => clearTimeout(handler);
  }, [selectedIotDeviceId, iotSensorType, iotCollaborationEnabled, iotDataStore, saveIotConfig]);

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
      content: 'OS [Version 10.0.26200.8037]\n(c) OS Corporation. All rights reserved.\n'
    }];
  };

  const [pcOutput, setPcOutput] = useState<OutputLine[]>(() => getInitialPcOutput());
  const [httpAppContent, setHttpAppContent] = useState<string | null>(null);
  const [httpAppUrl, setHttpAppUrl] = useState<string>('');
  const [httpAppTitle, setHttpAppTitle] = useState<string>('HTTP Page');
  const [httpAppDeviceId, setHttpAppDeviceId] = useState<string | null>(null);
  const [browserWindow, setBrowserWindow] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pc-browser-window-state') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          x: typeof parsed.x === 'number' ? parsed.x : 40,
          y: typeof parsed.y === 'number' ? parsed.y : 140,
          width: typeof parsed.width === 'number' ? parsed.width : 960,
          height: typeof parsed.height === 'number' ? parsed.height : 400,
        };
      } catch {
        return { x: 40, y: 140, width: 960, height: 400 };
      }
    }
    return { x: 40, y: 140, width: 960, height: 400 };
  });

  useEffect(() => {
    localStorage.setItem('pc-browser-window-state', JSON.stringify(browserWindow));
  }, [browserWindow]);

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
        content: 'OS [Version 10.0.26200.8037]\n(c) OS Corporation. All rights reserved.\n'
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

  // Auto-focus input when visible, tab changes, or command completes
  useEffect(() => {
    if (isVisible && (activeTab === 'desktop' || activeTab === 'terminal')) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, activeTab, pcOutput, activeConsoleOutput]);

  // Always keep CMD/Console views pinned to the latest output
  useEffect(() => {
    if (!outputRef.current) return;
    const el = outputRef.current;
    requestAnimationFrame(() => {
      if (!el) return;
      el.scrollTop = el.scrollHeight;
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

  const consoleReloadPending = false;

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

  // Keep password prompts focused so SSH/Telnet input is immediately usable.
  useEffect(() => {
    if (activeTab !== 'terminal' || !isConsoleConnected) return;
    if (!consoleNeedsPassword && !consoleConfirmDialog?.show && !consoleReloadPending) return;
    const timer = setTimeout(() => {
      if (consoleNeedsPassword) setInput('');
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }, 50);
    return () => clearTimeout(timer);
  }, [activeTab, isConsoleConnected, consoleNeedsPassword, consoleConfirmDialog?.show, consoleReloadPending]);

  const getCommandMode = useCallback((): string => {
    if (activeTab === 'terminal' && isConsoleConnected && connectedDeviceId && deviceStates) {
      const state = deviceStates.get(connectedDeviceId);
      const mode = state?.currentMode || 'user';
      if (mode === 'config-if-range') return 'interface';
      return mode;
    }
    return 'user';
  }, [activeTab, isConsoleConnected, connectedDeviceId, deviceStates]);

  const getAutocompleteSuggestions = useCallback((value: string) => {
    const isIpv4 = (raw: string) => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(raw);
    const collectKnownIps = () => {
      const fromDevices = (topologyDevices || [])
        .map((d) => d.ip)
        .filter((ip): ip is string => !!ip && isIpv4(ip) && ip !== '0.0.0.0' && ip !== '169.254.0.0');
      const fromStates = Array.from(deviceStates?.values() || [])
        .flatMap((s) => Object.values(s.ports || {}).map((p: any) => p?.ipAddress))
        .filter((ip): ip is string => !!ip && isIpv4(ip) && ip !== '0.0.0.0' && ip !== '169.254.0.0');
      return Array.from(new Set([...fromDevices, ...fromStates]));
    };

    const trimmed = value.trim();
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const currentWord = value.endsWith(' ') ? '' : (tokens[tokens.length - 1] || '').toLowerCase();
    const expectsIpArg = /^(?:telnet|ssh|ping|http|ip\s+default-gateway|default-router|dns-server)\s+\S*$/i.test(trimmed)
      || /^(?:telnet|ssh|ping|http|ip\s+default-gateway|default-router|dns-server)\s*$/i.test(trimmed);

    if (activeTab === 'desktop') {
      const base = DESKTOP_COMMANDS
        .filter((cmd) => cmd !== '?' && cmd.startsWith(currentWord))
        .slice(0, 8);
      if (!expectsIpArg) return base;
      const ipSuggestions = collectKnownIps().filter((ip) => ip.toLowerCase().startsWith(currentWord));
      return Array.from(new Set([...ipSuggestions, ...base])).slice(0, 8);
    }

    const mode = getCommandMode();
    const { candidates, currentWord: ctxCurrentWord } = expandCommandContext(mode as any, value);
    const suggestions = candidates.filter(
      (opt: string) => opt !== '?' && opt.toLowerCase().startsWith(ctxCurrentWord)
    );
    if (!expectsIpArg) return suggestions.slice(0, 8);
    const ipSuggestions = collectKnownIps().filter((ip) => ip.toLowerCase().startsWith(ctxCurrentWord || currentWord));
    return Array.from(new Set([...ipSuggestions, ...suggestions])).slice(0, 8);
  }, [activeTab, getCommandMode, topologyDevices, deviceStates]);

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
    } else if (consolePasswordAttempted && !consoleAwaitingPassword && !consoleAuthenticated) {
      setConsolePasswordAttempted(false);
      setIsConsoleConnected(false);
      setConnectedDeviceId(null);
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

  // Get connected IoT devices for a router/AP
  const getConnectedIotDevices = useCallback((routerId: string) => {
    const routerDevice = topologyDevices.find(d => d.id === routerId);
    if (!routerDevice) return [];

    const routerSsid = routerDevice.wifi?.ssid || '';
    const routerSecurity = routerDevice.wifi?.security || 'open';

    return topologyDevices
      .filter(d => {
        if (d.type !== 'iot') return false;

        let isWifiConnected = false;
        if (routerSsid) {
          isWifiConnected = d.wifi?.bssid === routerId ||
            (d.wifi?.ssid === routerSsid && d.wifi?.security === routerSecurity);
        }

        const isWiredConnected = topologyConnections.some(c =>
          (c.sourceDeviceId === routerId && c.targetDeviceId === d.id) ||
          (c.targetDeviceId === routerId && c.sourceDeviceId === d.id)
        );

        return isWifiConnected || isWiredConnected;
      })
      .map(d => {
        const isWiredConnected = topologyConnections.some(c =>
          (c.sourceDeviceId === routerId && c.targetDeviceId === d.id) ||
          (c.targetDeviceId === routerId && c.sourceDeviceId === d.id)
        );

        let deviceIp = d.ip;
        if (isWiredConnected && !deviceIp) {
          const routerIp = routerDevice?.ip || '192.168.1.1';
          const baseIpParts = routerIp.split('.');
          const usedIps = new Set<string>();
          topologyDevices.forEach(td => {
            if (td.ip && td.ip.startsWith(baseIpParts[0] + '.' + baseIpParts[1] + '.' + baseIpParts[2])) {
              usedIps.add(td.ip);
            }
          });
          for (let i = 100; i <= 254; i++) {
            const testIp = `${baseIpParts[0]}.${baseIpParts[1]}.${baseIpParts[2]}.${i}`;
            if (!usedIps.has(testIp)) {
              deviceIp = testIp;
              break;
            }
          }
          if (!deviceIp) deviceIp = `${baseIpParts[0]}.${baseIpParts[1]}.${baseIpParts[2]}.150`;

          // Assign IP asynchronously to avoid state mutation during render
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('update-topology-device-config', {
              detail: {
                deviceId: d.id,
                config: {
                  ip: deviceIp,
                  ipConfigMode: 'dhcp',
                  gateway: routerIp,
                  subnet: routerDevice?.subnet || '255.255.255.0',
                  dns: routerIp,
                },
              },
            }));
          }, 0);
        }

        return {
          id: d.id,
          name: d.name,
          sensorType: d.iot?.sensorType || 'temperature',
          connected: !!(isWiredConnected || (d.status === 'online' && d.wifi?.enabled)),
          ip: deviceIp,
          isWired: isWiredConnected,
        };
      });
  }, [topologyDevices, topologyConnections]);

  // Get available IoT devices that can be connected (not connected to this AP)
  const getAvailableIotDevices = useCallback((routerId: string) => {
    const routerDevice = topologyDevices.find(d => d.id === routerId);
    if (!routerDevice) return [];

    const routerSsid = routerDevice.wifi?.ssid || '';

    return topologyDevices
      .filter(d => {
        if (d.type !== 'iot') return false;

        const isWiredConnected = topologyConnections.some(c =>
          (c.sourceDeviceId === routerId && c.targetDeviceId === d.id) ||
          (c.targetDeviceId === routerId && c.sourceDeviceId === d.id)
        );

        if (isWiredConnected) return false;

        if (!routerSsid) return true;
        const isConnectedToThisAp = d.wifi?.bssid === routerId || d.wifi?.ssid === routerSsid;
        return !isConnectedToThisAp;
      })
      .map(d => ({
        id: d.id,
        name: d.name,
        sensorType: d.iot?.sensorType || 'temperature',
        currentSsid: d.wifi?.ssid || undefined,
      }));
  }, [topologyDevices, topologyConnections]);

  const canReachTargetIp = useCallback((targetIp: string) => {
    const result = checkConnectivity(deviceId, targetIp, topologyDevices as any, topologyConnections as any, deviceStates || new Map(), t.language as 'tr' | 'en');
    return result.success;
  }, [deviceId, topologyDevices, topologyConnections, deviceStates, t.language]);

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
  }, [pcGateway, pcIP, pcSubnet]);

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

  const openHttpTarget = useCallback((rawTarget?: string, rawUrl?: string) => {
    const rawInput = (rawTarget || '').trim();
    const normalizedInput = rawInput || '192.168.1.10';
    let lookupTarget = normalizeLookupTarget(normalizedInput);
    let displayUrl = normalizedInput.startsWith('http://') || normalizedInput.startsWith('https://')
      ? normalizedInput
      : `http://${normalizedInput}`;
    if (rawUrl && rawUrl.trim().length > 0) {
      const candidate = rawUrl.trim();
      displayUrl = candidate.startsWith('http://') || candidate.startsWith('https://') ? candidate : `http://${candidate}`;
      lookupTarget = normalizeLookupTarget(candidate);
    }

  // Handle special IoT Web Panel URL
  if (rawTarget === 'http://iot-panel' || rawTarget === 'iot-panel') {
    // Global IoT panel always shows all devices (not filtered by router)
    const iotPanelContent = generateIotWebPanelContent(iotDevices, language, undefined, undefined, topologyConnections);
    setHttpAppContent(iotPanelContent);
    setHttpAppTitle(language === 'tr' ? 'IoT Web Paneli' : 'IoT Web Panel');
    setHttpAppDeviceId(null);
    addLocalOutput('success', language === 'tr' ? 'IoT Web Paneli açıldı.' : 'IoT Web Panel opened.');
    return;
  }

    // Handle special IoT Device URL
    if (rawTarget?.startsWith('iot://iot-device/')) {
      const targetDeviceId = rawTarget.split('iot://iot-device/')[1];
      const targetDevice = topologyDevices.find(d => d.id === targetDeviceId);
      if (targetDevice && targetDevice.type === 'iot') {
        const isActive = targetDevice.iot?.collaborationEnabled ?? true;
        const isPoweredOff = targetDevice.status === 'offline';
        const iotDevicePage = generateIotDevicePageContent(targetDevice.id, targetDevice.name || targetDevice.id, language, isActive, isPoweredOff);
        setHttpAppContent(iotDevicePage);
        setHttpAppTitle(`${targetDevice.name || targetDevice.id} ${language === 'tr' ? 'Yönetimi' : 'Management'}`);
        setHttpAppDeviceId(targetDevice.id);
        addLocalOutput('success', language === 'tr' ? `IoT cihazı '${targetDevice.name}' yönetim sayfası açıldı.` : `IoT device '${targetDevice.name}' management page opened.`);
        return;
      } else {
        addLocalOutput('error', language === 'tr' ? 'Geçersiz IoT cihazı.' : 'Invalid IoT device.');
        return;
      }
    }

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
      const connectedIot = getConnectedIotDevices(httpServer.id);
      const availableIot = getAvailableIotDevices(httpServer.id);
      const adminPage = generateRouterAdminPage(httpServer, runtimeState, connectedIot, availableIot);
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
  }, [addLocalOutput, deviceStates, findHttpServerByTarget, getAvailableIotDevices, getConnectedIotDevices, hasGatewayForTarget, isLoopbackTarget, isValidIpv4, language, normalizeLookupTarget, pcDNS, resolveDeviceNameTarget, t, iotDevices, topologyDevices, generateIotWebPanelContent, generateIotDevicePageContent, httpAppDeviceId, topologyConnections]);

  useEffect(() => {
    const handleRouterAdminMessage = (event: MessageEvent) => {
      const data = event.data;
      console.log('=== MESSAGE RECEIVED ===');
      console.log('Message type:', data?.type);
      console.log('Full message data:', data);
      console.log('httpAppDeviceId:', httpAppDeviceId);
      console.log('========================');

      if (!data) {
        console.log('⚠️ No data in message, ignoring');
        return;
      }

      // For WiFi save operations, require httpAppDeviceId match
      const isRouterSpecificMessage = data.type === 'router-admin-save-wifi';
      if (isRouterSpecificMessage && httpAppDeviceId && data.deviceId && data.deviceId !== httpAppDeviceId) {
        console.log('⚠️ Ignoring message - deviceId mismatch for router-specific operation');
        return;
      }

      // IoT messages are always accepted (deviceId in payload)
      const isIoTMessage = data.type === 'router-admin-connect-iot' || data.type === 'router-admin-disconnect-iot' || data.type === 'router-admin-renew-iot';
      console.log('Is IoT message:', isIoTMessage);

      const allocateIotIpConfig = (routerDeviceId: string, excludeDeviceId?: string) => {
        const routerDevice = topologyDevices.find((d) => d.id === routerDeviceId);
        const routerState = routerDeviceId ? deviceStates?.get(routerDeviceId) : undefined;
        let routerIp = routerDevice?.ip || '';
        let routerSubnet = routerDevice?.subnet || '';

        // Prefer the actual configured interface IP/subnet when the topology card is stale.
        if (routerState?.ports) {
          for (const port of Object.values(routerState.ports)) {
            if (!port.shutdown && port.ipAddress) {
              routerIp = port.ipAddress;
              routerSubnet = port.subnetMask || routerSubnet;
              break;
            }
          }
        }

        if (!routerIp) routerIp = '192.168.1.1';
        if (!routerSubnet) routerSubnet = '255.255.255.0';
        const baseIpParts = routerIp.split('.');
        let newIp = '';

        const usedIps = new Set<string>();
        topologyDevices.forEach((d) => {
          if (d.id === excludeDeviceId) return;
          if (d.ip && d.ip.startsWith(baseIpParts[0] + '.' + baseIpParts[1] + '.' + baseIpParts[2])) {
            usedIps.add(d.ip);
          }
        });

        for (let i = 100; i <= 254; i++) {
          const testIp = `${baseIpParts[0]}.${baseIpParts[1]}.${baseIpParts[2]}.${i}`;
          if (!usedIps.has(testIp)) {
            newIp = testIp;
            break;
          }
        }

        if (!newIp) {
          for (let i = 2; i < 100; i++) {
            const testIp = `${baseIpParts[0]}.${baseIpParts[1]}.${baseIpParts[2]}.${i}`;
            if (!usedIps.has(testIp) && testIp !== routerIp) {
              newIp = testIp;
              break;
            }
          }
        }

        if (!newIp) {
          const fallbackUsedIps = new Set<string>();
          topologyDevices.forEach((d) => {
            if (d.id !== excludeDeviceId && d.ip) fallbackUsedIps.add(d.ip);
          });
          return {
            ip: generateRandomLinkLocalIpv4(fallbackUsedIps),
            gateway: '0.0.0.0',
            subnet: '255.255.0.0',
            dns: '0.0.0.0',
            source: 'apipa' as const,
          };
        }

        return {
          ip: newIp,
          gateway: routerIp,
          subnet: routerSubnet,
          dns: routerIp,
          source: 'dhcp' as const,
        };
      };

      // Handle WiFi settings save
      if (data.type === 'router-admin-save-wifi') {
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
      }

      // Handle IoT device connect (existing device)
      if (data.type === 'router-admin-connect-iot') {
        console.log('Handling connect-iot, payload:', data.payload);
        const payload = data.payload || {};
        const iotDeviceId = payload.iotDeviceId;

        if (!iotDeviceId) {
          console.warn('No iotDeviceId provided');
          return;
        }

        // Find the existing IoT device in topology
        const iotDevice = topologyDevices.find((d) => d.id === iotDeviceId);
        console.log('Found IoT device:', iotDevice);
        if (!iotDevice || iotDevice.type !== 'iot') {
          console.warn('IoT device not found or wrong type:', iotDeviceId);
          return;
        }

        const ipConfig = allocateIotIpConfig(httpAppDeviceId || '', iotDeviceId);

        // Update the IoT device's WiFi config to connect to this AP
        const updatedWifi = {
          enabled: true,
          ssid: payload.ssid || '',
          security: payload.security || 'open',
          password: payload.password || '',
          channel: payload.channel || '2.4GHz',
          mode: 'client' as const,
          bssid: httpAppDeviceId,
        };

        // Dispatch event to update the IoT device with IP
        window.dispatchEvent(new CustomEvent('update-topology-device-config', {
          detail: {
            deviceId: iotDeviceId,
            config: {
              wifi: updatedWifi,
              status: 'online',
              ip: ipConfig.ip,
              ipConfigMode: 'dhcp' as const,
              gateway: ipConfig.gateway,
              subnet: ipConfig.subnet,
              dns: ipConfig.dns,
            },
          },
        }));

        addLocalOutput(
          'success',
          language === 'tr'
            ? `IoT cihaz "${iotDevice.name}" aga baglandi. IP: ${ipConfig.ip}`
            : `IoT device "${iotDevice.name}" connected to the network. IP: ${ipConfig.ip}`
        );
      }

      if (data.type === 'router-admin-renew-iot') {
        const payload = data.payload || {};
        const iotDeviceId = payload.iotDeviceId;

        if (!iotDeviceId) return;

        const iotDevice = topologyDevices.find((d) => d.id === iotDeviceId);
        if (!iotDevice || iotDevice.type !== 'iot') return;

        const ipConfig = allocateIotIpConfig(httpAppDeviceId || '', iotDeviceId);

        window.dispatchEvent(new CustomEvent('update-topology-device-config', {
          detail: {
            deviceId: iotDeviceId,
            config: {
              ip: ipConfig.ip,
              ipConfigMode: 'dhcp' as const,
              gateway: ipConfig.gateway,
              subnet: ipConfig.subnet,
              dns: ipConfig.dns,
            },
          },
        }));

        addLocalOutput(
          'success',
          language === 'tr'
            ? `IoT cihaz "${iotDevice.name}" icin IP yenilendi: ${ipConfig.ip}`
            : `Renewed IP for IoT device "${iotDevice.name}": ${ipConfig.ip}`
        );

        if (httpAppDeviceId) {
          const targetDevice = topologyDevices.find((d) => d.id === httpAppDeviceId);
          if (targetDevice && isRouterDevice(targetDevice)) {
            const runtimeState = deviceStates?.get(httpAppDeviceId);
            const connectedIot = getConnectedIotDevices(httpAppDeviceId);
            const availableIot = getAvailableIotDevices(httpAppDeviceId);
            const refreshed = generateRouterAdminPage(targetDevice, runtimeState, connectedIot, availableIot);
            setHttpAppContent(refreshed);
          }
        }
      }

      // Handle IoT device delete
      if (data.type === 'router-admin-delete-iot') {
        const payload = data.payload || {};
        const iotDeviceId = payload.iotDeviceId;

        if (!iotDeviceId) return;

        if (onDeleteDevice) {
          onDeleteDevice(iotDeviceId);
        }
      }

      // Handle IoT device disconnect
      if (data.type === 'router-admin-disconnect-iot') {
        console.log('Handling disconnect-iot, payload:', data.payload);
        const payload = data.payload || {};
        const iotDeviceId = payload.iotDeviceId;

        if (!iotDeviceId) {
          console.warn('No iotDeviceId provided for disconnect');
          return;
        }

        // Find the existing IoT device in topology
        const iotDevice = topologyDevices.find((d) => d.id === iotDeviceId);
        console.log('Found IoT device for disconnect:', iotDevice);
        if (!iotDevice || iotDevice.type !== 'iot') {
          console.warn('IoT device not found or wrong type for disconnect:', iotDeviceId);
          return;
        }

        // Update the IoT device's WiFi config to disconnect (disable WiFi)
        const updatedWifi = {
          enabled: false,
          ssid: '',
          security: 'open' as const,
          password: '',
          channel: '2.4GHz' as const,
          mode: 'client' as const,
          bssid: undefined,
        };

        // Update ports to clear WiFi connection
        const updatedPorts = iotDevice.ports.map(p =>
          p.id === 'wlan0'
            ? { ...p, status: 'disconnected' as const, ipAddress: undefined, subnetMask: undefined, wifi: { ssid: '', security: 'open' as const, channel: '2.4GHz' as const, mode: 'client' as const } }
            : p
        );

        // Dispatch event to update the IoT device
        console.log('Dispatching update-topology-device-config for disconnect:', iotDeviceId);
        window.dispatchEvent(new CustomEvent('update-topology-device-config', {
          detail: {
            deviceId: iotDeviceId,
            config: {
              wifi: updatedWifi,
              ip: '',
              subnet: '',
              gateway: '',
              ports: updatedPorts,
            },
          },
        }));

        // Delete any physical cable connections between this AP and the IoT device
        if (topologyConnections) {
          topologyConnections.forEach(conn => {
            if ((conn.sourceDeviceId === httpAppDeviceId && conn.targetDeviceId === iotDeviceId) ||
              (conn.targetDeviceId === httpAppDeviceId && conn.sourceDeviceId === iotDeviceId)) {
              window.dispatchEvent(new CustomEvent('delete-topology-connection', {
                detail: { connectionId: (conn as any).id }
              }));
            }
          });
        }

        console.log('Calling addLocalOutput for disconnect');
        addLocalOutput(
          'success',
          language === 'tr'
            ? `IoT cihaz "${iotDevice.name}" agdan cikarildi.`
            : `IoT device "${iotDevice.name}" disconnected from the network.`
        );
        console.log('addLocalOutput called for disconnect');

        // Refresh router admin page to update device list
        if (httpAppDeviceId) {
          const targetDevice = topologyDevices.find((d) => d.id === httpAppDeviceId);
          if (targetDevice && isRouterDevice(targetDevice)) {
            const runtimeState = deviceStates?.get(httpAppDeviceId);
            const connectedIot = getConnectedIotDevices(httpAppDeviceId);
            const availableIot = getAvailableIotDevices(httpAppDeviceId);
            const refreshed = generateRouterAdminPage(targetDevice, runtimeState, connectedIot, availableIot);
            setHttpAppContent(refreshed);
          }
        }
      }

      // Handle refresh devices request (after bulk operations)
      if (data.type === 'router-admin-refresh-devices') {
        if (httpAppDeviceId) {
          const targetDevice = topologyDevices.find((d) => d.id === httpAppDeviceId);
          if (targetDevice && isRouterDevice(targetDevice)) {
            const runtimeState = deviceStates?.get(httpAppDeviceId);
            const connectedIot = getConnectedIotDevices(httpAppDeviceId);
            const availableIot = getAvailableIotDevices(httpAppDeviceId);
            const refreshed = generateRouterAdminPage(targetDevice, runtimeState, connectedIot, availableIot);
            setHttpAppContent(refreshed);
          }
        }
      }

      // Handle messages from IoT Web Panel
      if (data.type === 'open-iot-device') {
        const { deviceId } = data;
        openHttpTarget(`iot://iot-device/${deviceId}`);
      }

      // Handle back to IoT list message
      if (data.type === 'back-to-iot-list') {
        setHttpAppDeviceId(null);
        openHttpTarget('http://iot-panel');
      }

      // Handle toggle IoT device status message
      if (data.type === 'toggle-iot-device') {
        const { deviceId, active } = data;
        const targetDevice = topologyDevices.find((d) => d.id === deviceId);
        if (targetDevice && targetDevice.type === 'iot') {
          window.dispatchEvent(new CustomEvent('update-topology-device-config', {
            detail: {
              deviceId: deviceId,
              config: {
                iot: {
                  ...targetDevice.iot,
                  collaborationEnabled: active,
                },
              },
            },
          }));
          addLocalOutput(
            'success',
            language === 'tr'
              ? `IoT cihaz "${targetDevice.name || deviceId}" okuma ${active ? 'aktif edildi.' : 'pasif edildi.'}`
              : `IoT device "${targetDevice.name || deviceId}" reading ${active ? 'activated.' : 'deactivated.'}`
          );
        }
      }
    };

    window.addEventListener('message', handleRouterAdminMessage);
    return () => window.removeEventListener('message', handleRouterAdminMessage);
  }, [addLocalOutput, httpAppDeviceId, language, topologyDevices, topologyConnections, getConnectedIotDevices, getAvailableIotDevices, openHttpTarget]);

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
    if (!httpAppContent || typeof window === 'undefined') return;

    const handlePopState = () => {
      if (httpAppContent) {
        setHttpAppContent(null);
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [httpAppContent]);

  useEffect(() => {
    if (!httpAppDeviceId) return;
    const targetDevice = topologyDevices.find((d) => d.id === httpAppDeviceId);
    if (!targetDevice || !isRouterDevice(targetDevice)) return;

    const runtimeState = deviceStates?.get(httpAppDeviceId);
    const connectedIot = getConnectedIotDevices(httpAppDeviceId);
    const availableIot = getAvailableIotDevices(httpAppDeviceId);
    const refreshed = generateRouterAdminPage(targetDevice, runtimeState, connectedIot, availableIot);
    setHttpAppContent(refreshed);
  }, [httpAppDeviceId, topologyDevices, deviceStates, getConnectedIotDevices, getAvailableIotDevices]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (dragStateRef.current) {
        const dragState = dragStateRef.current;
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        setBrowserWindow((prev) => ({
          ...prev,
          x: Math.max(0, dragState.originX + dx),
          y: Math.max(0, dragState.originY + dy),
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


  const hasPhysicalPathToDevice = useCallback((targetDeviceId: string) => {
    if (!targetDeviceId || targetDeviceId === deviceId) return false;
    const sourceDevice = topologyDevices.find((d) => d.id === deviceId);
    const targetDevice = topologyDevices.find((d) => d.id === targetDeviceId);
    if (!sourceDevice || !targetDevice) return false;
    if (sourceDevice.status === 'offline' || targetDevice.status === 'offline') return false;

    // DHCP discover can also traverse an implicit Wi-Fi link.
    const sourceWifi = getDeviceWifiConfig(sourceDevice as any, deviceStates);
    const targetWifi = getDeviceWifiConfig(targetDevice as any, deviceStates);
    if (
      sourceDevice.type === 'pc' &&
      sourceWifi?.enabled &&
      (sourceWifi.mode === 'client' || sourceWifi.mode === 'sta') &&
      sourceWifi.ssid &&
      targetWifi?.enabled &&
      targetWifi.mode === 'ap' &&
      targetWifi.ssid &&
      sourceWifi.ssid.toLowerCase() === targetWifi.ssid.toLowerCase() &&
      getWirelessSignalStrength(sourceDevice as any, topologyDevices as any, deviceStates) > 0
    ) {
      return true;
    }

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
  }, [deviceId, topologyConnections, topologyDevices, deviceStates]);







  const formatMacForArp = useCallback((mac?: string) => {
    if (!mac) return '';
    const hex = mac.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
    if (hex.length !== 12) return mac.toLowerCase();
    return hex.match(/.{1,2}/g)?.join('-') || mac.toLowerCase();
  }, []);

  const buildArpTableOutput = useCallback(() => {
    // Get all devices including IoT that have IP and MAC
    const allDevices = topologyDevices.filter((d) => 
      d.id !== deviceId && !!d.ip && !!d.macAddress && canReachTargetIp(d.ip)
    );
    
    // Also include IoT devices that are connected to the same network
    const connectedIoTDevices = topologyDevices.filter((d) => {
      if (d.type !== 'iot') return false;
      if (!d.ip || !d.macAddress) return false;
      if (d.id === deviceId) return false;
      // Check if IoT is reachable (same subnet or through gateway)
      return canReachTargetIp(d.ip);
    });
    
    // Combine and deduplicate
    const combinedDevices = [...allDevices, ...connectedIoTDevices];
    const uniqueDevices = Array.from(new Map(combinedDevices.map(d => [d.id, d])).values());
    
    const reachableHosts = uniqueDevices.map((d) => ({
      ip: d.ip,
      mac: formatMacForArp(d.macAddress),
      type: d.type === 'iot' ? 'dynamic (IoT)' : 'dynamic',
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
    isDhcpEditingRef.current = false;
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

    isDhcpEditingRef.current = true;
    setServiceDhcpPools((prev) => {
      if (editingDhcpIndex === null) {
        return [...prev, cleaned];
      }
      return prev.map((pool, idx) => (idx === editingDhcpIndex ? cleaned : pool));
    });

    // Reset editing flag after a delay to allow useEffect to sync
    setTimeout(() => {
      isDhcpEditingRef.current = false;
    }, 1000);
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

  const getDhcpLease = useCallback((): { ip: string; subnetMask: string; gateway: string; dns: string; serverName: string; poolName: string } | null => {
    const usedIps = new Set(
      topologyDevices
        .filter((d) => d.id !== deviceId && validateIP(d.ip || ''))
        .map((d) => d.ip)
    );

    // 1. Check PC DHCP servers from topology
    const pcServers = topologyDevices.filter(
      (d) =>
        d.id !== deviceId &&
        d.type === 'pc' &&
        d.services?.dhcp?.enabled &&
        (d.services?.dhcp?.pools?.length || 0) > 0 &&
        !!d.ip &&
        (hasPhysicalPathToDevice(d.id) || canReachTargetIp(d.ip))
    );

    for (const server of pcServers) {
      const pools = server.services?.dhcp?.pools || [];
      for (const pool of pools) {
        if (!validateIP(pool.startIp) || !validateIP(pool.subnetMask) || !validateIP(pool.defaultGateway) || !validateIP(pool.dnsServer)) {
          continue;
        }
        const start = ipToNumber(pool.startIp);
        if (start === null) continue;
        const maxUsers = Math.max(1, Number(pool.maxUsers || 1));

        // Check if pool is full
        let availableCount = 0;
        for (let i = 0; i < maxUsers; i += 1) {
          const candidate = numberToIp(start + i);
          if (!usedIps.has(candidate)) {
            availableCount++;
          }
        }

        // Skip full pools
        if (availableCount === 0) {
          continue;
        }

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

    // 2. Check Router/Switch DHCP servers from deviceStates (CLI-configured pools)
    if (deviceStates) {
      for (const [deviceId_, state] of deviceStates.entries()) {
        if (deviceId_ === deviceId) continue;
        const device = topologyDevices.find(d => d.id === deviceId_);
        if (!device || (device.type !== 'router' && device.type !== 'switchL2' && device.type !== 'switchL3')) continue;

        // Check DHCP pools from both runtime services mirror and raw CLI state.
        // Some flows may have dhcpPools populated while services mirror is stale.
        const mirroredPools = state.services?.dhcp?.pools || [];
        const cliPools = Object.entries(state.dhcpPools || {}).map(([poolName, pool]: [string, any]) => {
          const networkBase = typeof pool?.network === 'string' ? pool.network : '';
          const networkPrefix = networkBase.split('.').slice(0, 3).join('.');
          const fallbackStart = networkPrefix ? `${networkPrefix}.100` : '192.168.1.100';
          const fallbackGateway = networkPrefix ? `${networkPrefix}.1` : '192.168.1.1';
          return {
            poolName,
            subnetMask: pool?.subnetMask || '255.255.255.0',
            startIp: pool?.startIp || fallbackStart,
            defaultGateway: pool?.defaultRouter || fallbackGateway,
            dnsServer: pool?.dnsServer || '8.8.8.8',
            maxUsers: Number(pool?.maxUsers || 50),
          };
        });
        const dhcpPools = [...mirroredPools];
        for (const pool of cliPools) {
          if (!dhcpPools.some((p: any) => p.poolName === pool.poolName)) {
            dhcpPools.push(pool as any);
          }
        }
        if (dhcpPools.length === 0) continue;

        // DHCP DISCOVER is L2 broadcast; client has no usable IP yet.
        // In that case, only physical path is required (no server IP prerequisite).
        let deviceIp = device.ip;
        if (!deviceIp && state.ports) {
          for (const portId in state.ports) {
            const port = state.ports[portId];
            if (port.ipAddress && !port.shutdown) {
              deviceIp = port.ipAddress;
              break;
            }
          }
        }

        // Check if PC can reach this DHCP server:
        // - no client IP yet => physical path is enough
        // - client already has IP => normal reachability check by server IP
        const canReach = hasPhysicalPathToDevice(deviceId_) || (!!deviceIp && canReachTargetIp(deviceIp));
        if (!canReach) continue;

        // Use this device's DHCP pools
        for (const pool of dhcpPools) {
          if (!validateIP(pool.startIp) || !validateIP(pool.subnetMask) || !validateIP(pool.defaultGateway) || !validateIP(pool.dnsServer)) {
            continue;
          }
          const start = ipToNumber(pool.startIp);
          if (start === null) continue;
          const maxUsers = Math.max(1, Number(pool.maxUsers || 50));

          // Check if pool is full
          let availableCount = 0;
          for (let i = 0; i < maxUsers; i += 1) {
            const candidate = numberToIp(start + i);
            if (!usedIps.has(candidate)) {
              availableCount++;
            }
          }

          // Skip full pools
          if (availableCount === 0) {
            continue;
          }

          for (let i = 0; i < maxUsers; i += 1) {
            const candidate = numberToIp(start + i);
            if (!usedIps.has(candidate)) {
              return {
                ip: candidate,
                subnetMask: pool.subnetMask,
                gateway: pool.defaultGateway,
                dns: pool.dnsServer,
                serverName: device.name || state.hostname || deviceId_,
                poolName: pool.poolName,
              };
            }
          }
        }
      }
    }

    return null;
  }, [canReachTargetIp, deviceId, deviceStates, hasPhysicalPathToDevice, ipToNumber, numberToIp, topologyDevices, validateIP]);

  // Check if DHCP pools are available and get failure reason
  const checkDhcpAvailability = useCallback((): { available: boolean; reason: string } => {
    const usedIps = new Set(
      topologyDevices
        .filter((d) => d.id !== deviceId && validateIP(d.ip || ''))
        .map((d) => d.ip)
    );

    // Check PC DHCP servers
    const pcServers = topologyDevices.filter(
      (d) =>
        d.id !== deviceId &&
        d.type === 'pc' &&
        d.services?.dhcp?.enabled &&
        (d.services?.dhcp?.pools?.length || 0) > 0 &&
        !!d.ip &&
        (hasPhysicalPathToDevice(d.id) || canReachTargetIp(d.ip))
    );

    // Check Router/Switch DHCP servers availability
    let hasAnyDhcpService = pcServers.length > 0;

    if (!hasAnyDhcpService && deviceStates) {
      for (const [deviceId_, state] of deviceStates.entries()) {
        if (deviceId_ === deviceId) continue;
        const device = topologyDevices.find(d => d.id === deviceId_);
        if (!device || (device.type !== 'router' && device.type !== 'switchL2' && device.type !== 'switchL3')) continue;

        const mirroredPools = state.services?.dhcp?.pools || [];
        const cliPools = Object.entries(state.dhcpPools || {}).length;
        if (mirroredPools.length > 0 || cliPools > 0) {
          hasAnyDhcpService = true;
          break;
        }
      }
    }

    // If no DHCP service available at all
    if (!hasAnyDhcpService) {
      return { available: false, reason: 'no_dhcp_service' };
    }

    for (const server of pcServers) {
      const pools = server.services?.dhcp?.pools || [];
      for (const pool of pools) {
        if (!validateIP(pool.startIp) || !validateIP(pool.subnetMask) || !validateIP(pool.defaultGateway) || !validateIP(pool.dnsServer)) {
          continue;
        }
        const start = ipToNumber(pool.startIp);
        if (start === null) continue;
        const maxUsers = Math.max(1, Number(pool.maxUsers || 1));

        let availableCount = 0;
        for (let i = 0; i < maxUsers; i += 1) {
          const candidate = numberToIp(start + i);
          if (!usedIps.has(candidate)) {
            availableCount++;
          }
        }

        if (availableCount > 0) {
          return { available: true, reason: '' };
        }
      }
    }

    // Check Router/Switch DHCP servers
    if (deviceStates) {
      for (const [deviceId_, state] of deviceStates.entries()) {
        if (deviceId_ === deviceId) continue;
        const device = topologyDevices.find(d => d.id === deviceId_);
        if (!device || (device.type !== 'router' && device.type !== 'switchL2' && device.type !== 'switchL3')) continue;

        const mirroredPools = state.services?.dhcp?.pools || [];
        const cliPools = Object.entries(state.dhcpPools || {}).map(([poolName, pool]: [string, any]) => {
          const networkBase = typeof pool?.network === 'string' ? pool.network : '';
          const networkPrefix = networkBase.split('.').slice(0, 3).join('.');
          const fallbackStart = networkPrefix ? `${networkPrefix}.100` : '192.168.1.100';
          const fallbackGateway = networkPrefix ? `${networkPrefix}.1` : '192.168.1.1';
          return {
            poolName,
            subnetMask: pool?.subnetMask || '255.255.255.0',
            startIp: pool?.startIp || fallbackStart,
            defaultGateway: pool?.defaultRouter || fallbackGateway,
            dnsServer: pool?.dnsServer || '8.8.8.8',
            maxUsers: Number(pool?.maxUsers || 50),
          };
        });
        const dhcpPools = [...mirroredPools];
        for (const pool of cliPools) {
          if (!dhcpPools.some((p: any) => p.poolName === pool.poolName)) {
            dhcpPools.push(pool as any);
          }
        }
        if (dhcpPools.length === 0) continue;

        let deviceIp = device.ip;
        if (!deviceIp && state.ports) {
          for (const portId in state.ports) {
            const port = state.ports[portId];
            if (port.ipAddress && !port.shutdown) {
              deviceIp = port.ipAddress;
              break;
            }
          }
        }

        const canReach = hasPhysicalPathToDevice(deviceId_) || (!!deviceIp && canReachTargetIp(deviceIp));
        if (!canReach) continue;

        for (const pool of dhcpPools) {
          if (!validateIP(pool.startIp) || !validateIP(pool.subnetMask) || !validateIP(pool.defaultGateway) || !validateIP(pool.dnsServer)) {
            continue;
          }
          const start = ipToNumber(pool.startIp);
          if (start === null) continue;
          const maxUsers = Math.max(1, Number(pool.maxUsers || 50));

          let availableCount = 0;
          for (let i = 0; i < maxUsers; i += 1) {
            const candidate = numberToIp(start + i);
            if (!usedIps.has(candidate)) {
              availableCount++;
            }
          }

          if (availableCount > 0) {
            return { available: true, reason: '' };
          }
        }
      }
    }

    return { available: false, reason: 'all_pools_full' };
  }, [canReachTargetIp, deviceId, deviceStates, hasPhysicalPathToDevice, ipToNumber, numberToIp, topologyDevices, validateIP]);

  // Keep ref in sync with callback
  useEffect(() => {
    checkDhcpAvailabilityRef.current = checkDhcpAvailability;
  }, [checkDhcpAvailability]);

  const applyDhcpLease = useCallback((force = false) => {
    const lease = getDhcpLease();
    if (!lease) {
      const usedIps = new Set(
        topologyDevices
          .filter((d) => d.id !== deviceId && validateIP(d.ip || ''))
          .map((d) => d.ip)
      );
      const linkLocalIp = generateRandomLinkLocalIpv4(usedIps);
      const linkLocalLease = {
        ip: linkLocalIp,
        subnetMask: '255.255.0.0',
        gateway: '0.0.0.0',
        dns: '0.0.0.0',
        serverName: 'link-local',
        poolName: 'APIPA',
      };
      if (!force &&
        linkLocalLease.ip === pcIP &&
        linkLocalLease.subnetMask === pcSubnet &&
        linkLocalLease.gateway === pcGateway &&
        linkLocalLease.dns === pcDNS
      ) {
        return linkLocalLease;
      }
      setPcIP(linkLocalLease.ip);
      setPcSubnet(linkLocalLease.subnetMask);
      setPcGateway(linkLocalLease.gateway);
      setPcDNS(linkLocalLease.dns);
      return linkLocalLease;
    }
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
  }, [getDhcpLease, pcDNS, pcGateway, pcIP, pcSubnet, deviceId, topologyDevices, validateIP]);

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
    if (lease && lease.serverName !== 'link-local') {
      toast({
        title: t.dhcpSuccessTitle,
        description: t.dhcpSuccessDescription.replace('{ip}', lease.ip),
      });
    } else {
      // DHCP bulunamadıysa otomatik link-local (APIPA) atandı.
      if (lease && lease.serverName === 'link-local' && prevIpConfigModeRef.current !== 'dhcp') {
        toast({
          title: language === 'tr' ? 'DHCP bulunamadı' : 'DHCP not found',
          description: language === 'tr'
            ? `Link-local IP atandı: ${lease.ip}`
            : `Assigned link-local IP: ${lease.ip}`,
        });
      } else if (prevIpConfigModeRef.current !== 'dhcp') {
        // Legacy failure toast (should be rare now; kept for safety)
        const dhcpCheck = checkDhcpAvailabilityRef.current();
        let errorMessage = t.dhcpFailureDescription;
        if (dhcpCheck.reason === 'all_pools_full') {
          errorMessage = language === 'tr'
            ? 'DHCP havuzları dolu! Maksimum IP sayısına ulaşıldı.'
            : 'All DHCP pools are full! Maximum number of IP addresses reached.';
        } else if (dhcpCheck.reason === 'no_dhcp_service') {
          errorMessage = language === 'tr'
            ? 'Ağda DHCP hizmeti bulunamadı! Lütfen bir DHCP sunucusu yapılandırın.'
            : 'No DHCP service found on the network! Please configure a DHCP server.';
        }
        toast({
          title: t.dhcpFailureTitle,
          description: errorMessage,
          variant: 'destructive',
        });
      }
    }

    prevIpConfigModeRef.current = ipConfigMode;
  }, [applyDhcpLease, ipConfigMode, t, topologyConnections, pcIP, language]);

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
    if ((activeTabRef.current === 'desktop' && isCmdInputDisabled) || (activeTabRef.current === 'terminal' && isConsoleInputDisabled)) {
      addLocalOutput('error', connectionErrorText || t.pcConnectionError);
      setInput('');
      return;
    }

    if (activeTabRef.current === 'desktop') {
      if (desktopHistory[0] !== command) {
        const newHistory = [command, ...desktopHistory].slice(0, 50);
        setDesktopHistory(newHistory);
        if (onUpdatePCHistory) onUpdatePCHistory(deviceId, newHistory);
      }
      setDesktopHistoryIndex(-1);
    } else if (activeTabRef.current === 'terminal') {
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
    if (activeTabRef.current === 'desktop') {
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
          if (lease && lease.serverName !== 'link-local') {
            addLocalOutput(
              'success',
              `DHCP lease acquired from ${lease.serverName}/${lease.poolName}. New IP: ${lease.ip}`
            );
          } else {
            addLocalOutput('success', `No DHCP server/pool found. Assigned link-local IP: ${lease?.ip || '(pending)'}`);
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

            // Calculate ping latency from both source and target WiFi distances
            const srcDist = getWirelessDistance(deviceFromTopology, topologyDevices, deviceStates);
            const targetDevice = result.targetId ? topologyDevices.find(d => d.id === result.targetId) : undefined;
            const dstDist = getWirelessDistance(targetDevice, topologyDevices, deviceStates);

            const srcWired = srcDist === Infinity;
            const dstWired = dstDist === Infinity;
            const effectiveDist = (srcWired ? 0 : srcDist) + (dstWired ? 0 : dstDist);
            const allWired = srcWired && dstWired;

            const generatePingTime = () => {
              if (allWired) return 0; // <1ms
              // Exponential curve over combined distance
              const base = Math.exp(effectiveDist / 130);
              return Math.max(1, Math.round(base * (1 + (Math.random() * 0.16 - 0.08))));
            };

            const time1 = generatePingTime();
            const time2 = generatePingTime();
            const time3 = generatePingTime();
            const time4 = generatePingTime();

            const formatTime = (ms: number) => ms === 0 ? '<1ms' : `${ms}ms`;

            await addMultilineOutput('output', `Pinging ${pingTargetDisplay} with 32 bytes of data:\nReply from ${targetIp}: bytes=32 time=${formatTime(time1)} TTL=128\nReply from ${targetIp}: bytes=32 time=${formatTime(time2)} TTL=128\nReply from ${targetIp}: bytes=32 time=${formatTime(time3)} TTL=128\nReply from ${targetIp}: bytes=32 time=${formatTime(time4)} TTL=128\n\nPing statistics for ${pingTargetDisplay}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`, 100);
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
        openHttpTarget(args[0], args[1]);
      } else if (cmd === 'telnet' || cmd === 'ssh') {
        const isSsh = cmd === 'ssh';
        const targetSpec = args[0];
        const extraPort = args[1];

        const isSshLoginFlag = isSsh && targetSpec === '-l';
        const sshUserFromFlag = isSshLoginFlag ? (args[1] || '') : '';
        const sshTargetFromFlag = isSshLoginFlag ? (args[2] || '') : '';
        const sshPortFromFlag = isSshLoginFlag ? args[3] : undefined;

        const sshUserFromSpec = isSsh && !isSshLoginFlag && targetSpec?.includes('@')
          ? targetSpec.split('@')[0].trim()
          : '';
        const targetFromSpec = isSsh && !isSshLoginFlag && targetSpec?.includes('@')
          ? targetSpec.split('@').slice(1).join('@').trim()
          : targetSpec;

        const username = isSsh ? ((sshUserFromFlag || sshUserFromSpec) || 'admin') : '';
        const target = isSshLoginFlag ? sshTargetFromFlag : targetFromSpec;
        const port = isSsh
          ? ((sshPortFromFlag || (isSshLoginFlag ? undefined : extraPort)) || '22')
          : (extraPort || '23');
        if (!target) {
          addLocalOutput('output', isSsh
            ? 'Usage: ssh -l <username> <ip> [port]\n       ssh <username>@<ip> [port]'
            : 'Usage: telnet <ip_or_domain> [port]');
          return;
        } else if (isSsh) {
          const isValidUsername = /^[A-Za-z0-9._-]+$/.test(username);
          const isValidTargetIp = isValidIpv4(target);
          if (!isValidUsername) {
            addLocalOutput('error', 'Invalid SSH username format');
            return;
          }
          if (!isValidTargetIp) {
            addLocalOutput('error', `Invalid SSH target IP: ${target}`);
            return;
          }
        }

        // Resolve target IP (telnet supports hostnames; ssh path already validated an IPv4).
        let targetIp = target;
        if (!isSsh) {
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
        }

        if (isLoopbackTarget(targetIp)) {
          addLocalOutput('success', isSsh
            ? `Trying ${username}@127.0.0.1 ${port} ...\nConnected to 127.0.0.1 as ${username}.`
            : `Trying 127.0.0.1 ${port} ...\nConnected to 127.0.0.1.`);
          return;
        }

        // Check connectivity
        const result = checkConnectivity(deviceId, targetIp, topologyDevices as any, topologyConnections as any, deviceStates || new Map(), t.language as 'tr' | 'en');

        if (result.success && result.targetId) {
          // Find target device to see if it's a switch or router
          const targetDevice = topologyDevices.find(d => d.id === result.targetId);
          if (targetDevice && ((targetDevice.type === 'switchL2' || targetDevice.type === 'switchL3') || targetDevice.type === 'router')) {
            // Check target device's transport input configuration
            if (deviceStates) {
              const targetState = deviceStates.get(result.targetId);
              if (targetState?.security?.vtyLines) {
                const transportInput = targetState.security.vtyLines.transportInput || [];
                if (isSsh) {
                  const isSshActive = transportInput.includes('all') || transportInput.includes('ssh');
                  if (!isSshActive) {
                    addLocalOutput('error', `Connecting to ${targetIp}...Could not open connection to the host, on port 22: Connect failed`);
                    return;
                  }
                } else {
                  const isTelnetActive = transportInput.includes('all') || transportInput.includes('telnet');
                  if (!isTelnetActive) {
                    addLocalOutput('error', `Connecting to ${targetIp}...Could not open connection to the host, on port 23: Connect failed`);
                    return;
                  }
                }
              }
            }

            // Successfully connected - switch to terminal tab and connect
            addLocalOutput('success', isSsh
              ? `Trying ${username}@${targetIp} ${port} ...\nConnected to ${targetIp} as ${username}.`
              : `Trying ${targetIp} ${port} ...\nConnected to ${targetIp}.`);

            // Give it a tiny delay for the user to see the "Connected" message before switching
            setTimeout(() => {
              setConnectedDeviceId(result.targetId!);
              setConsoleConnectionTime(Date.now());
              setIsConsoleConnected(true);

              // Trigger remote VTY session bootstrap so password/login policy is applied.
              if (onExecuteDeviceCommand) {
                void onExecuteDeviceCommand(
                  result.targetId!,
                  isSsh ? `__SSH_CONNECT__:${username}` : '__TELNET_CONNECT__'
                );
              }

              setActiveTab('terminal');
              onNavigate?.('terminal');
            }, 500);
          } else {
            addLocalOutput('error', `Connection refused by ${targetIp}`);
          }
        } else {
          addLocalOutput('error', `Connecting to ${targetIp}... failed: ${result.error || 'Destination unreachable'}`);
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
      } else if (cmd === 'getmac') {
        const mac = formatMacForArp(pcMAC).toUpperCase();
        await addMultilineOutput(
          'output',
          `Physical Address    Transport Name\n=================== ============================================\n${mac.padEnd(19)} \\Device\\Tcpip_{${deviceId.toUpperCase()}}`,
          60
        );
      } else if (cmd === 'help' || cmd === '?') {
        addLocalOutput('output', `Available commands: ipconfig, ping, tracert, telnet, ssh, netstat, nbtstat, getmac, nslookup, http, arp, hostname, dir, ver, cls, exit, quit, snake`);
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
        addLocalOutput('output', `OS [Version 10.0.26200.8037]`);
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

    let matches: string[] = [];
    let contextTokens: string[] = [];

    if (activeTab === 'desktop') {
      const tokens = value.trim().split(/\s+/).filter(Boolean);
      const currentWord = value.endsWith(' ') ? '' : (tokens[tokens.length - 1] || '').toLowerCase();
      contextTokens = [];
      matches = DESKTOP_COMMANDS.filter(opt => opt !== '?' && opt.toLowerCase().startsWith(currentWord));
    } else {
      const mode = getCommandMode();
      const context = expandCommandContext(mode as any, value);
      contextTokens = context.contextTokens;
      matches = context.candidates.filter(opt => opt !== '?' && opt.toLowerCase().startsWith(context.currentWord));
    }

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
      if (activeTab === 'desktop') {
        setPcOutput([]);
      } else if (activeTab === 'terminal') {
        // Reset console view by moving the window start time forward
        setConsoleConnectionTime(Date.now());
      }
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
        if (consoleNeedsPassword) {
          setConsolePasswordAttempted(false);
          setIsConsoleConnected(false);
          setConnectedDeviceId(null);
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
      {(activeTab === 'desktop' || activeTab === 'terminal') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCmdSettings(v => !v)}
              className={`h-8 w-8 rounded-lg ui-hover-surface ${showCmdSettings ? 'bg-accent' : ''} ${isDark ? 'text-slate-300 hover:text-amber-400' : 'text-slate-600 hover:text-amber-600'}`}
              aria-label={language === 'tr' ? 'Yazı Boyutu' : 'Font Size'}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{language === 'tr' ? 'Yazı Boyutu' : 'Font Size'}</TooltipContent>
        </Tooltip>
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
        w-full
        ${isDark ? 'bg-slate-900' : 'bg-slate-100'}
      `}>
        {/* External Toolbar - Above Tablet Frame */}
        <div className={`
        w-full max-w-full md:max-w-4xl mx-auto mb-2 px-3 py-1.5 flex items-center justify-between sticky top-2 z-[30]
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setActiveTab('iot')}
                    disabled={isPcPoweredOff}
                    className={`h-6 w-6 rounded-md ${isPcPoweredOff ? 'opacity-30' : activeTab === 'iot' ? (isDark ? 'bg-cyan-500/30 text-cyan-300' : 'bg-cyan-500/30 text-cyan-700') : (isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-500')}`}
                    aria-label="IoT"
                  >
                    <Radio className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>IoT</TooltipContent>
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
                  className={`relative h-6 w-6 rounded-md ${isPcPoweredOff ? 'opacity-30' : activeTab === 'wireless' ? (isDark ? 'bg-cyan-500/30 text-cyan-300' : 'bg-cyan-500/30 text-cyan-700') : (isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-500')}`}
                  aria-label={language === 'tr' ? 'Kablosuz' : 'Wireless'}
                >
                  <span className="pointer-events-none w-4 h-4">
                    <WifiSignalMeter strength={wifiSignalStrength} />
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {(() => {
                  const percentMap: Record<number, number> = { 0: 0, 1: 1, 2: 25, 3: 50, 4: 75, 5: 100 };
                  const percentage = percentMap[wifiSignalStrength] || 0;
                  const label = language === 'tr' ? 'Kablosuz' : 'Wireless';
                  return wifiEnabled && wifiSignalStrength > 0 ? `${label} - ${percentage}%` : label;
                })()}
              </TooltipContent>
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
            {/* Clock - hidden on mobile */}
            <div className={`hidden sm:block ml-2 text-xs font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
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
        <div className={`w-full
           ${isDark ? 'bg-slate-900' : 'bg-slate-100'}
           `}>
          {/* Screen Area - Clean and simple */}
          <div className={`
          relative
          
          ${isDark
              ? 'bg-slate-900'
              : 'bg-white'
            }
        `}>
            {/* Power Off Overlay - Tablet ekranını tamamen karartır */}
            {isPcPoweredOff && (
              <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center">
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
              <div className="bg-transparent">
                <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
                  <DialogContent className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white'} sm:max-w-md`}>
                    <DialogHeader>
                      <DialogTitle>{t.searchOutputTitle}</DialogTitle>
                      <DialogDescription className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                        {t.searchOutputDescription}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="relative">
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.searchPlaceholder}
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
                    <div className="flex justify-end gap-2 pt-1">
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
                  {/* New IoT Web Panel Button */}
                  <Button
                    variant={httpAppDeviceId ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      if (!httpAppDeviceId) {
                        openHttpTarget('http://iot-panel');
                      }
                      setActiveTab('desktop'); // Ensure desktop tab is active when IoT panel is opened
                    }}
                    className={`h-9 px-4 text-xs font-black tracking-wider transition-all gap-2 ${activeTab === 'desktop' && httpAppContent && !httpAppDeviceId ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-500'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className={isMobile ? 'sr-only' : 'hidden md:inline'}>{language === 'tr' ? 'IoT Paneli' : 'IoT Panel'}</span>
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
                      {t.servicesTab}
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
                  <Button
                    variant={activeTab === 'iot' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('iot')}
                    className={`h-9 px-4 text-xs font-black tracking-wider transition-all gap-2 ${activeTab === 'iot' ? 'bg-cyan-500/10 text-cyan-500' : 'text-slate-500 hover:text-cyan-500'} ${isMobile ? 'flex-1 min-w-0' : ''}`}
                  >
                    <Radio className="w-4 h-4" />
                    <span className={isMobile ? 'sr-only' : 'hidden md:inline'}>IoT</span>
                  </Button>
                </div>

                {/* Content Area */}
                <div className={`flex-1 min-h-0 h-full max-h-[70vh] sm:max-h-[72vh] lg:max-h-[74vh] flex flex-col ${terminalBg} relative pt-2.5 overflow-hidden overflow-y-auto`}>
                  {activeTab === 'home' && (
                    <div
                      className="flex-1 min-h-0 flex items-center justify-center p-2.5 pt-0"
                      style={mobileVerticalScrollStyle}
                    >
                      <div className="w-full max-w-[700px] flex flex-row overflow-x-auto gap-2 rounded-xl p-2.5 bg-slate-800/30 border border-slate-700/30 shadow-sm md:grid md:grid-cols-5 md:place-items-center scrollbar-hide"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                      >
                        <button
                          onClick={() => navigateToProgram('desktop')}
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10 shrink-0 min-w-[64px]"
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
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10 shrink-0 min-w-[64px]"
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
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10 shrink-0 min-w-[64px]"
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
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10 shrink-0 min-w-[64px]"
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
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10 shrink-0 min-w-[64px]"
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-600">
                            <Wifi className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-xs font-medium text-slate-300">
                            {language === 'tr' ? 'Kablosuz' : 'Wireless'}
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveTab('iot')}
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10 shrink-0 min-w-[64px]"
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-700">
                            <Radio className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-xs font-medium text-slate-300">
                            IoT
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'settings' && (
                    <div
                      className="flex-1 min-h-0 p-3 overflow-y-auto"
                      style={mobileVerticalScrollStyle}
                    >
                      <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1.5 flex-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t.hostname}</label>
                            <Input value={internalPcHostname} onChange={(e) => setPcHostname(e.target.value)} className="h-9" />
                          </div>
                          <div className="space-y-1.5 flex-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">MAC Address</label>
                            <Input value={pcMAC} onChange={(e) => setPcMAC(e.target.value)} placeholder="00:1A:2B:3C:4D:5E" className={`h-9 ${errors.mac ? 'border-rose-500' : ''}`} />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 py-2 border-y border-slate-800/10 dark:border-slate-800/50">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 whitespace-nowrap">
                            {t.ipConfigurationLabel}
                          </label>
                          <div className={`inline-flex p-1 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={ipConfigMode === 'dhcp'}
                              onClick={() => {
                                setIpConfigMode('dhcp');
                                applyDhcpLease(true);
                              }}
                              className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${ipConfigMode === 'dhcp'
                                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                                : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
                                }`}
                            >
                              DHCP
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={ipConfigMode === 'static'}
                              onClick={() => setIpConfigMode('static')}
                              className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${ipConfigMode === 'static'
                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
                                }`}
                            >
                              {t.staticLabel.toUpperCase()}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">IP Address</label>
                            <Input value={pcIP} onChange={(e) => setPcIP(e.target.value)} placeholder="192.168.1.100" className={`h-9 ${errors.ip ? 'border-rose-500' : ''}`} disabled={ipConfigMode === 'dhcp'} />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Subnet Mask</label>
                            <Input value={pcSubnet} onChange={(e) => setPcSubnet(e.target.value)} placeholder="255.255.255.0" className={`h-9 ${errors.subnet ? 'border-rose-500' : ''}`} disabled={ipConfigMode === 'dhcp'} />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Gateway</label>
                            <Input value={pcGateway} onChange={(e) => setPcGateway(e.target.value)} placeholder="192.168.1.1" className={`h-9 ${errors.gateway ? 'border-rose-500' : ''}`} disabled={ipConfigMode === 'dhcp'} />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">DNS Server</label>
                            <Input value={pcDNS} onChange={(e) => setPcDNS(e.target.value)} placeholder="8.8.8.8" className={`h-9 ${errors.dns ? 'border-rose-500' : ''}`} disabled={ipConfigMode === 'dhcp'} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 pt-2 border-t border-slate-800/10 dark:border-slate-800/50">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">IPv6 Address</label>
                            <Input value={pcIPv6} onChange={(e) => setPcIPv6(e.target.value)} placeholder="2001:db8:acad:1::10" className={`h-9 ${errors.ipv6 ? 'border-rose-500' : ''}`} />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">IPv6 Prefix</label>
                            <Input value={pcIPv6Prefix} onChange={(e) => setPcIPv6Prefix(e.target.value)} placeholder="64" className="h-9" />
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {activeTab === 'services' && (
                    <div
                      className="flex-1 min-h-0 flex flex-col"
                      style={mobileVerticalScrollStyle}
                    >
                      {/* Inner Tabs for Services */}
                      <div className={`flex items-center gap-1 px-3 py-2 border-b ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                        <Button
                          variant={activeServiceTab === 'dns' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setActiveServiceTab('dns')}
                          className={`h-8 px-3 text-xs font-medium transition-all ${activeServiceTab === 'dns'
                            ? 'bg-purple-500/15 text-purple-600 border-purple-500/30'
                            : serviceDnsEnabled
                              ? 'bg-purple-500/10 text-purple-600 border border-purple-500/25 hover:bg-purple-500/15'
                              : 'text-slate-500 hover:text-purple-500'
                            }`}
                        >
                          DNS{serviceDnsEnabled ? ' (Açık)' : ''}
                        </Button>
                        <Button
                          variant={activeServiceTab === 'http' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setActiveServiceTab('http')}
                          className={`h-8 px-3 text-xs font-medium transition-all ${activeServiceTab === 'http'
                            ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                            : serviceHttpEnabled
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 hover:bg-emerald-500/15'
                              : 'text-slate-500 hover:text-emerald-500'
                            }`}
                        >
                          HTTP{serviceHttpEnabled ? ' (Açık)' : ''}
                        </Button>
                        <Button
                          variant={activeServiceTab === 'dhcp' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setActiveServiceTab('dhcp')}
                          className={`h-8 px-3 text-xs font-medium transition-all ${activeServiceTab === 'dhcp'
                            ? 'bg-sky-500/15 text-sky-600 border-sky-500/30'
                            : serviceDhcpEnabled
                              ? 'bg-sky-500/10 text-sky-600 border border-sky-500/25 hover:bg-sky-500/15'
                              : 'text-slate-500 hover:text-sky-500'
                            }`}
                        >
                          DHCP{serviceDhcpEnabled ? ' (Açık)' : ''}
                        </Button>
                      </div>

                      {/* Service Content */}
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        {activeServiceTab === 'dns' && (
                          <div className="p-3">
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
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${serviceDnsEnabled ? 'bg-purple-500/15 text-purple-600 border border-purple-500/30' : 'bg-slate-200 text-slate-500 border border-slate-300'}`}>
                                    {serviceDnsEnabled ? 'ON' : 'OFF'}
                                  </span>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={serviceDnsEnabled}
                                    onClick={() => setServiceDnsEnabled((prev) => !prev)}
                                    className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 ${serviceDnsEnabled
                                      ? 'bg-purple-500/90 border-purple-400'
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
                                    isDnsEditingRef.current = true;
                                    const domain = dnsFormDomain.trim().toLowerCase();
                                    const address = dnsFormAddress.trim();
                                    if (!domain || !address) return;
                                    setServiceDnsRecords((prev) => {
                                      const withoutSame = prev.filter((r) => r.domain.toLowerCase() !== domain);
                                      return [...withoutSame, { domain, address }];
                                    });
                                    setDnsFormDomain('');
                                    setDnsFormAddress('');
                                    // Reset editing flag after a delay
                                    setTimeout(() => { isDnsEditingRef.current = false; }, 1000);
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
                                      onClick={() => {
                                        isDnsEditingRef.current = true;
                                        setServiceDnsRecords((prev) => prev.filter((r) => !(r.domain === record.domain && r.address === record.address)));
                                        // Reset editing flag after a delay
                                        setTimeout(() => { isDnsEditingRef.current = false; }, 1000);
                                      }}
                                    >
                                      {t.delete}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {activeServiceTab === 'http' && (
                          <div className="p-3">
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
                          </div>
                        )}

                        {activeServiceTab === 'dhcp' && (
                          <div className="p-3">
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
                                          isDhcpEditingRef.current = true;
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
                                          isDhcpEditingRef.current = true;
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
                      </div>
                    </div>
                  )}

                  {activeTab === 'iot' && (
                    <div className="flex-1 min-h-0 p-3 overflow-y-auto" style={mobileVerticalScrollStyle}>
                      <div className={`rounded-2xl border p-4 space-y-4 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center justify-between gap-2 text-cyan-500">
                          <div className="flex items-center gap-2">
                            <Radio className="w-5 h-5" />
                            <h3 className="text-sm font-black tracking-widest">
                              {language === 'tr' ? 'IoT Yönetimi' : 'IoT Management'}
                            </h3>
                          </div>
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white"
                            onClick={() => {
                              navigateToProgram('desktop');
                              setTimeout(() => {
                                setInput('http http://iot-panel');
                                void executeCommand('http http://iot-panel');
                              }, 300);
                            }}
                          >
                            {language === 'tr' ? 'Web Paneli Aç' : 'Open Web Panel'}
                          </Button>
                        </div>

                        {iotDevices.length === 0 ? (
                          <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {language === 'tr' ? 'Topolojide IoT nesnesi yoktur. Önce topolojiye IoT nesnesi ekleyiniz.' : 'No IoT object in topology. Add one first.'}
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500">{language === 'tr' ? 'Nesne Seçimi' : 'Object Selection'}</label>
                              <Select value={selectedIotDeviceId} onValueChange={setSelectedIotDeviceId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="IoT" />
                                </SelectTrigger>
                                <SelectContent>
                                  {iotDevices.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500">{language === 'tr' ? 'Cihaz Adı' : 'Device Name'}</label>
                              <Input
                                value={selectedIotDevice?.name || ''}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  window.dispatchEvent(new CustomEvent('update-topology-device-config', {
                                    detail: {
                                      deviceId: selectedIotDeviceId,
                                      config: { name: newName }
                                    }
                                  }));
                                }}
                                placeholder={language === 'tr' ? 'Cihaz adı...' : 'Device name...'}
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500">{language === 'tr' ? 'Sensör Tipi' : 'Sensor Type'}</label>
                              <Select value={iotSensorType} onValueChange={(v) => setIotSensorType(v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="temperature">{language === 'tr' ? 'Isı' : 'Temperature'}</SelectItem>
                                  <SelectItem value="sound">{language === 'tr' ? 'Ses' : 'Sound'}</SelectItem>
                                  <SelectItem value="motion">{language === 'tr' ? 'Hareket' : 'Motion'}</SelectItem>
                                  <SelectItem value="humidity">{language === 'tr' ? 'Nem' : 'Humidity'}</SelectItem>
                                  <SelectItem value="light">{language === 'tr' ? 'Işık' : 'Light'}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500">MAC Address</label>
                              <div className="text-sm font-mono bg-slate-100 px-3 py-2 rounded border">
                                {selectedIotDevice?.macAddress || 'N/A'}
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">
                                {language === 'tr' ? 'Cihaz Durumu (Aktif/Pasif)' : 'Device Status (Active/Passive)'}
                              </label>
                              <span className={`text-[9px] font-bold ${!iotCollaborationEnabled ? 'text-rose-500' : 'text-slate-400'}`}>
                                {language === 'tr' ? 'PASİF' : 'PASSIVE'}
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={iotCollaborationEnabled}
                                onClick={() => setIotCollaborationEnabled((prev) => !prev)}
                                className={`relative inline-flex h-7 w-14 items-center rounded-full border transition-all duration-300 shrink-0 ${iotCollaborationEnabled ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300')}`}
                              >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${iotCollaborationEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                              </button>
                              <span className={`text-[9px] font-bold ${iotCollaborationEnabled ? 'text-cyan-500' : 'text-slate-400'}`}>
                                {language === 'tr' ? 'AKTİF' : 'ACTIVE'}
                              </span>
                            </div>

                            <div className="flex items-center gap-4">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">
                                {language === 'tr' ? 'Güç Durumu (Açık/Kapalı)' : 'Power Status (On/Off)'}
                              </label>
                              <span className={`text-[9px] font-bold ${selectedIotDevice?.status === 'offline' ? 'text-rose-500' : 'text-slate-400'}`}>
                                {language === 'tr' ? 'KAPALI' : 'OFF'}
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={selectedIotDevice?.status !== 'offline'}
                                onClick={() => {
                                  if (selectedIotDevice) {
                                    const newStatus = selectedIotDevice.status === 'offline' ? 'online' : 'offline';
                                    window.dispatchEvent(new CustomEvent('update-topology-device-config', {
                                      detail: {
                                        deviceId: selectedIotDeviceId,
                                        config: { status: newStatus }
                                      }
                                    }));
                                  }
                                }}
                                className={`relative inline-flex h-7 w-14 items-center rounded-full border transition-all duration-300 shrink-0 ${selectedIotDevice?.status !== 'offline' ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300')}`}
                              >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${selectedIotDevice?.status !== 'offline' ? 'translate-x-8' : 'translate-x-1'}`} />
                              </button>
                              <span className={`text-[9px] font-bold ${selectedIotDevice?.status !== 'offline' ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {language === 'tr' ? 'AÇIK' : 'ON'}
                              </span>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500">{language === 'tr' ? 'Veri Saklama (not/json/metin)' : 'Data Storage (note/json/text)'}</label>
                              <textarea
                                value={iotDataStore}
                                onChange={(e) => setIotDataStore(e.target.value)}
                                rows={5}
                                className={`w-full rounded-md border px-3 py-2 text-sm ${isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                                placeholder={language === 'tr' ? 'Sensör verisi veya notlar...' : 'Sensor data or notes...'}
                              />
                            </div>

                            {(() => {
                              const wifiStrength = selectedIotDevice ? getWirelessSignalStrength(selectedIotDevice, topologyDevices, deviceStates) : 0;
                              const isWired = topologyConnections.some(c =>
                                (c.sourceDeviceId === selectedIotDeviceId || c.targetDeviceId === selectedIotDeviceId) && c.active !== false
                              );
                              const isIotConnected = wifiStrength > 0 || isWired;

                              return (
                                <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-slate-500">IP:</span>
                                      <span className={`ml-1 font-mono ${selectedIotDevice?.ip ? 'text-cyan-500' : 'text-slate-400'}`}>
                                        {selectedIotDevice?.ip || 'Not assigned'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Gateway:</span>
                                      <span className="ml-1 font-mono text-slate-400">{selectedIotDevice?.gateway || '-'}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Subnet:</span>
                                      <span className="ml-1 font-mono text-slate-400">{selectedIotDevice?.subnet || '-'}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Status:</span>
                                      <span className={`ml-1 ${isIotConnected ? 'text-green-500' : 'text-red-500'}`}>
                                        {isIotConnected ? '● Online' : 'No Connection'}
                                      </span>
                                    </div>
                                  </div>
                                  {selectedIotDevice?.ip && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={`mt-2 w-fit px-6 shadow-sm hover:shadow-md transition-all active:scale-95 ${isDark
                                        ? 'border-slate-800 bg-slate-900/50 text-slate-300 hover:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/30'
                                        : 'hover:text-cyan-600 hover:bg-cyan-50 hover:border-cyan-200'
                                        }`}
                                      onClick={() => {
                                        const targetIp = selectedIotDevice?.ip;
                                        if (targetIp) {
                                          // Switch to CMD tab
                                          navigateToProgram('desktop');
                                          // Execute ping command after a short delay to allow tab transition
                                          setTimeout(() => {
                                            executeCommand(`ping ${targetIp}`);
                                          }, 300);
                                        }
                                      }}
                                    >
                                      <Globe className="w-4 h-4 mr-2" />
                                      Ping {selectedIotDevice?.ip}
                                    </Button>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Sensor Value & Graph Display */}
                            {selectedIotDevice && (
                              <IoTSensorDisplay
                                device={selectedIotDevice}
                                environment={environment}
                                language={language}
                                isDark={isDark}
                              />
                            )}

                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-1`}>
                              <Save className="w-3 h-3" />
                              {language === 'tr' ? 'Değişiklikler otomatik kaydediliyor' : 'Changes are auto-saved'}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'wireless' && (
                    <div
                      className="flex-1 min-h-0 p-3 overflow-y-auto"
                      style={mobileVerticalScrollStyle}
                    >
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
                            {(() => {
                              const filtered = availableSSIDs.filter(e =>
                                e.ssid.toLowerCase().includes(wifiSSID.toLowerCase())
                              );
                              return (
                                <div className="relative">
                                  <div className={`flex items-center border rounded-md px-3 h-9 gap-2 ${!wifiEnabled ? 'opacity-50 pointer-events-none' : ''} ${isDark ? 'bg-background border-slate-800' : 'bg-white border-slate-200'}`}>
                                    <input
                                      type="text"
                                      value={wifiSSID}
                                      onChange={e => { setWifiSSID(e.target.value); setWifiBSSID(''); setSsidDropdownOpen(true); }}
                                      onFocus={() => setSsidDropdownOpen(true)}
                                      onBlur={() => setTimeout(() => setSsidDropdownOpen(false), 150)}
                                      placeholder={language === 'tr' ? 'Ağ seçin veya yazın...' : 'Select or type SSID...'}
                                      className={`flex-1 bg-transparent outline-none text-sm ${isDark ? 'text-white placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'}`}
                                    />
                                    {wifiSSID && (
                                      <button type="button" onClick={() => { setWifiSSID(''); setWifiBSSID(''); }} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                                    )}
                                    <button type="button" onClick={() => setSsidDropdownOpen(o => !o)} className="text-slate-400 hover:text-slate-600 text-xs">▾</button>
                                  </div>
                                  {ssidDropdownOpen && (
                                    <div className={`absolute z-50 w-full mt-1 rounded-md border shadow-lg max-h-48 overflow-y-auto ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                      {filtered.length === 0 && (
                                        <div className={`px-3 py-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                          {language === 'tr' ? 'Ağ bulunamadı' : 'No networks found'}
                                        </div>
                                      )}
                                      {filtered.map(entry => {
                                        const hasDupe = availableSSIDs.filter(e => e.ssid === entry.ssid).length > 1;
                                        const label = hasDupe ? `${entry.ssid} (${entry.deviceName})` : entry.ssid;
                                        return (
                                          <button
                                            key={`${entry.deviceId}-${entry.ssid}`}
                                            type="button"
                                            onMouseDown={() => { setWifiSSID(entry.ssid); setWifiBSSID(entry.deviceId); setSsidDropdownOpen(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-purple-500/20 ${isDark ? 'text-white' : 'text-slate-900'}`}
                                          >
                                            📶 {label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
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
                              <div className="relative">
                                <Input
                                  type={showWifiPassword ? 'text' : 'password'}
                                  value={wifiPassword}
                                  onChange={(e) => setWifiPassword(e.target.value)}
                                  placeholder="Security Key"
                                  disabled={!wifiEnabled}
                                  className="bg-background pr-9"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowWifiPassword(v => !v)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                  tabIndex={-1}
                                >
                                  {showWifiPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
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
                          if (!wifiSSID) return 'text-amber-500 bg-amber-500/10';
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
                            if (!wifiSSID) return 'bg-amber-500/20';
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
                                  // No SSID configured - cannot be connected
                                  if (!wifiSSID) return language === 'tr' ? 'WLAN0 aktif, ağ seçilmedi' : 'WLAN0 active, no network selected';

                                  // First check deviceStates (router/switch runtime state)
                                  const foundInStates = !!deviceStates && Array.from(deviceStates.entries()).find(([id, state]) => {
                                    const wlan = state.ports['wlan0'];
                                    if (!wlan || wlan.shutdown || wlan.wifi?.mode !== 'ap') return false;
                                    if (wifiBSSID && wifiBSSID !== id) return false;
                                    if (wlan.wifi?.ssid !== wifiSSID) return false;
                                    const apSecurity = wlan.wifi?.security || 'open';
                                    if (apSecurity !== wifiSecurity) return false;
                                    if (apSecurity !== 'open' && wlan.wifi?.password !== wifiPassword) return false;
                                    return true;
                                  });

                                  // If not found in deviceStates, also check topologyDevices
                                  const foundInTopology = !foundInStates && topologyDevices.find((apDevice) => {
                                    if (apDevice.id === deviceId) return false;
                                    if (apDevice.type !== 'router' && apDevice.type !== 'switchL2' && apDevice.type !== 'switchL3') return false;
                                    const apWifi = apDevice.wifi;
                                    if (!apWifi || apWifi.mode !== 'ap' || !apWifi.ssid) return false;
                                    if (apWifi.ssid !== wifiSSID) return false;
                                    const apSecurity = apWifi.security || 'open';
                                    if (apSecurity !== wifiSecurity) return false;
                                    if (apSecurity !== 'open' && apWifi.password !== wifiPassword) return false;
                                    return true;
                                  });

                                  const isConnected = !!foundInStates || !!foundInTopology;
                                  if (isConnected && wifiSSID) return language === 'tr' ? `Bağlı • SSID: ${wifiSSID}` : `Connected • SSID: ${wifiSSID}`;
                                  return wifiSSID
                                    ? (language === 'tr' ? `Ağ bulunamadı: ${wifiSSID}` : `Network not found: ${wifiSSID}`)
                                    : (language === 'tr' ? 'WLAN0 aktif, ağ seçilmedi' : 'WLAN0 active, no network selected');
                                })()
                              }
                            </div>
                          </div>
                        </div>

                        {/* Signal Strength Display */}
                        {wifiEnabled && wifiSSID && (
                          <div className={`p-4 rounded-xl text-xs flex items-center gap-3 ${isDark ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                            <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                              <Wifi className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold tracking-wider mb-0.5">
                                {language === 'tr' ? 'Sinyal Gücü' : 'Signal Strength'}
                              </div>
                              <div className="opacity-90">
                                {(() => {
                                  const strength = wifiSignalStrength;
                                  const percentMap: Record<number, number> = { 0: 0, 1: 1, 2: 25, 3: 50, 4: 75, 5: 100 };
                                  const percentage = percentMap[strength] || 0;
                                  const levelMap = {
                                    tr: { 0: 'Sinyal yok', 1: 'Çok Zayıf', 2: 'Zayıf', 3: 'Orta', 4: 'İyi', 5: 'Mükemmel' },
                                    en: { 0: 'No signal', 1: 'Very Weak', 2: 'Weak', 3: 'Fair', 4: 'Good', 5: 'Excellent' }
                                  };
                                  const level = levelMap[language === 'tr' ? 'tr' : 'en'][strength as keyof typeof levelMap['en']] || 'Unknown';
                                  return `${level} (${percentage}%)`;
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
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
                      {showCmdSettings && (
                        <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-4 animate-in slide-in-from-top-2">
                          <label className="text-[10px] font-black tracking-widest text-muted-foreground whitespace-nowrap">
                            {language === 'tr' ? 'Yazı Boyutu' : 'Font Size'}: {fontSize}px
                          </label>
                          <input
                            type="range" min="10" max="20" value={fontSize}
                            onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
                            className="flex-1 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => {
                              if (activeTab === 'desktop') setPcOutput([]);
                              else setConsoleConnectionTime(Date.now());
                            }}
                            className="h-7 text-[10px] font-black tracking-widest text-rose-500 shrink-0"
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> {t.clearTerminalBtn}
                          </Button>
                        </div>
                      )}
                      <div
                        ref={outputRef}
                        className={`flex-1 min-h-0 overflow-y-auto scroll-smooth p-2 md:p-3 pb-24 md:pb-28 space-y-2 font-mono ${isPcPoweredOff ? 'bg-red-500' : ''}`}
                        style={{ ...mobileVerticalScrollStyle, fontSize: `${fontSize}px` }}
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
                    <div className={`shrink-0 z-10 p-3 sm:p-4 border-t sticky bottom-0 bg-inherit ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
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
                              <div className="max-h-40 overflow-y-auto mobile-scroll">
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
                              setConsolePasswordAttempted(false);
                              setIsConsoleConnected(false);
                              setConnectedDeviceId(null);
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
        <div
          className="fixed inset-0 z-[999] pointer-events-auto backdrop-blur-sm bg-black/20"
          onClick={() => setHttpAppContent(null)}
        >
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
            onClick={(e) => e.stopPropagation()}
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
                  sandbox="allow-forms allow-scripts allow-same-origin allow-modals"
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

type PCActiveTab = 'home' | 'desktop' | 'terminal' | 'settings' | 'services' | 'wireless' | 'iot';

function getPCConfigDefaults(id: string) {
  const num = id.split('-')[1] || '1';
  return {
    ip: `192.168.1.${10 + parseInt(num)}`,
    mac: `00-40-96-99-88-7${num}`
  };
}
