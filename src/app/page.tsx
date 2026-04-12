'use client';

import { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';

import { SwitchState, CableInfo } from '@/lib/network/types';
import { useDeviceManager } from '@/hooks/useDeviceManager';
import useAppStore, { useTopologyDevices, useTopologyConnections, useTopologyNotes, useZoom, usePan, useActiveTab } from '@/lib/store/appStore';
// Duplicate removed
import { NetworkTopology } from '@/components/network/NetworkTopology';
import { cn } from '@/lib/utils';
import { CanvasDevice, CanvasConnection, CanvasNote, DeviceType } from '@/components/network/networkTopology.types';
import { getPrompt } from '@/lib/network/executor';
import { formatErrorForUser } from '@/lib/errors/errorHandler';
import { checkDeviceConnectivity, getWirelessSignalStrength } from '@/lib/network/connectivity';
import type { TerminalOutput } from '@/components/network/Terminal';
import { BOOT_PROGRESS_MARKER } from '@/components/network/Terminal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ChevronDown, Menu, Plus, Save, FolderOpen, Languages, Sun, Moon, Network, ShieldCheck, Database, Info, File, Layers, Terminal as TerminalIcon, Undo2, Redo2, Link2, Pencil, StickyNote, Sparkles, Cloud, Search, Monitor, X, Compass, Leaf } from "lucide-react";

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useLanguage, Translations } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from "@/hooks/use-toast";

import {
  topologyTasks,
  portTasks,
  vlanTasks,
  securityTasks,
  wirelessTasks,
  routingTasks,
  calculateTaskScore,
  TaskContext,
  getTaskStatus
} from '@/lib/network/taskDefinitions';
import { exampleProjects, type ExampleProject, type ExampleProjectLevel } from '@/lib/network/exampleProjects';
import { buildRunningConfig } from '@/lib/network/core/configBuilder';
import { performanceMonitor } from '@/lib/performance/monitoring';

import { DeviceIcon } from '@/components/network/DeviceIcon';
import { AppSkeleton } from '@/components/ui/AppSkeleton';
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';
import { SwitchModel } from '@/lib/network/switchModels';
import { EnvironmentSettingsPanel } from '@/components/network/EnvironmentSettingsPanel';

const PCPanel = dynamic(() => import('@/components/network/PCPanel').then((m) => m.PCPanel), { ssr: false });
const Terminal = dynamic(() => import('@/components/network/Terminal').then((m) => m.Terminal), { ssr: false });
const PortPanel = dynamic(() => import('@/components/network/PortPanel').then((m) => m.PortPanel), { ssr: false });
const VlanPanel = dynamic(() => import('@/components/network/VlanPanel').then((m) => m.VlanPanel), { ssr: false });
const SecurityPanel = dynamic(() => import('@/components/network/SecurityPanel').then((m) => m.SecurityPanel), { ssr: false });
const ConfigPanel = dynamic(() => import('@/components/network/ConfigPanel').then((m) => m.ConfigPanel), { ssr: false });
const QuickCommands = dynamic(() => import('@/components/network/QuickCommands').then((m) => m.QuickCommands), { ssr: false });
const TaskCard = dynamic(() => import('@/components/network/TaskCard').then((m) => m.TaskCard), { ssr: false });
const LazyAboutModal = dynamic(() => import('@/components/network/LazyAboutModal').then((m) => m.LazyAboutModal), { ssr: false });

type TabType = 'topology' | 'cmd' | 'terminal' | 'tasks';

// PC Output type for PCPanel
interface PCOutputLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'success';
  content: string;
}

interface TabDefinition {
  id: TabType;
  labelKey: keyof Translations;
  icon: React.ReactNode;
  tasks: any[];
  color: string;
  showFor: DeviceType[];
}

const SWITCH_DEVICE_TYPES: DeviceType[] = ['switchL2', 'switchL3'];
const isSwitchDeviceType = (type?: DeviceType) => type === 'switchL2' || type === 'switchL3';

const ALL_TABS: TabDefinition[] = [
  {
    id: 'topology',
    labelKey: 'networkTopology',
    icon: <Network className="w-4 h-4" />,
    tasks: topologyTasks,
    color: 'from-cyan-500 to-blue-500',
    showFor: ['pc', 'iot', ...SWITCH_DEVICE_TYPES, 'router']
  },
  {
    id: 'cmd',
    labelKey: 'pcTerminal',
    icon: <TerminalIcon className="w-4 h-4" />,
    tasks: [],
    color: 'from-blue-500 to-indigo-500',
    showFor: ['pc']
  },
  {
    id: 'terminal',
    labelKey: 'cliTerminal',
    icon: <TerminalIcon className="w-4 h-4" />,
    tasks: [],
    color: 'from-emerald-500 to-teal-500',
    showFor: [...SWITCH_DEVICE_TYPES, 'router']
  },
  {
    id: 'tasks',
    labelKey: 'tasks',
    icon: <ShieldCheck className="w-4 h-4" />,
    tasks: [...portTasks, ...vlanTasks, ...securityTasks, ...routingTasks],
    color: 'from-red-500 to-rose-500',
    showFor: [...SWITCH_DEVICE_TYPES, 'router']
  },
];

const exampleLevelOrder: ExampleProjectLevel[] = ['basic', 'intermediate', 'advanced'];

import { useHistory, ProjectState } from '@/hooks/useHistory';

export default function Home() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, effectiveTheme, setTheme } = useTheme();

  const exampleLevelLabels = useMemo(
    () => ({
      basic: t.levelBasic,
      intermediate: t.levelIntermediate,
      advanced: t.levelAdvanced
    }),
    [t]
  );

  const exampleLevelHints = useMemo(
    () => ({
      basic: t.basicHint,
      intermediate: t.intermediateHint,
      advanced: t.advancedHint
    }),
    [t]
  );

  const groupedExampleProjects = useMemo(() => {
    const grouping: Record<ExampleProjectLevel, ExampleProject[]> = {
      basic: [],
      intermediate: [],
      advanced: []
    };

    exampleProjects(language).forEach((project) => grouping[project.level].push(project));
    return grouping;
  }, [language]);

  const {
    deviceStates,
    setDeviceStates,
    deviceOutputs,
    setDeviceOutputs,
    pcOutputs,
    setPcOutputs,
    pcHistories,
    setPcHistories,
    isLoading: isExecutingCommand,
    confirmDialog,
    setConfirmDialog,
    getOrCreateDeviceState,
    getOrCreateDeviceOutputs,
    getOrCreatePCOutputs,
    handleCommandForDevice,
    resetAll
  } = useDeviceManager();

  const [isAppLoading, setIsLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);
  const [showContent, setShowContent] = useState(false);

  // Bootstrap performance monitoring in development without affecting production UX.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const intervalId = window.setInterval(() => {
      const metrics = performanceMonitor.getMetrics();
      const thresholdStatus = performanceMonitor.checkThresholds();
      (window as any).__netsimPerformance = {
        metrics,
        thresholdStatus,
        timestamp: Date.now(),
      };
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  // Zustand store state - using granular selectors to prevent cascading re-renders
  const topologyDevices = useTopologyDevices();
  const topologyConnections = useTopologyConnections();
  const topologyNotes = useTopologyNotes();
  const zoom = useZoom();
  const pan = usePan();
  const activeTab = useActiveTab();
  const { setDevices, setConnections, setNotes, setZoom, setPan, setActiveTab, graphicsQuality, setGraphicsQuality } = useAppStore();

  // Apply graphics quality class to body
  useEffect(() => {
    const body = document.body;

    if (graphicsQuality === 'low') {
      body.classList.add('graphics-low');
      body.classList.remove('graphics-high');
    } else {
      body.classList.add('graphics-high');
      body.classList.remove('graphics-low');
    }
  }, [graphicsQuality]);

  // Helper functions for state setters to maintain compatibility
  const setTopologyDevices = setDevices;
  const setTopologyConnections = setConnections;
  const setTopologyNotes = setNotes;

  // Currently active device in terminal
  const [activeDeviceId, setActiveDeviceId] = useState<string>('switch-1');
  const [activeDeviceType, setActiveDeviceType] = useState<DeviceType>('switchL2');

  // Navigation history for back/forward support
  const navigationHistoryRef = useRef<{ tab: TabType; deviceId?: string; program?: string }[]>([{ tab: 'topology' }]);
  const currentNavIndexRef = useRef(0);
  const isInternalNavRef = useRef(false);

  // Custom tab setter with navigation history
  const setActiveTabWithHistory = useCallback((tab: TabType) => {
    if (isInternalNavRef.current) {
      isInternalNavRef.current = false;
      setActiveTab(tab);
      return;
    }

    // Add to history
    const newState = { tab, deviceId: undefined, program: undefined };
    const currentIndex = currentNavIndexRef.current;

    // Remove any forward history
    if (currentIndex < navigationHistoryRef.current.length - 1) {
      navigationHistoryRef.current = navigationHistoryRef.current.slice(0, currentIndex + 1);
    }

    // Don't add duplicate consecutive states
    const lastState = navigationHistoryRef.current[navigationHistoryRef.current.length - 1];
    if (lastState && lastState.tab === tab) {
      setActiveTab(tab);
      return;
    }

    navigationHistoryRef.current.push(newState);
    currentNavIndexRef.current = navigationHistoryRef.current.length - 1;

    // Push to browser history
    window.history.pushState({ tab }, '');
    setActiveTab(tab);
  }, [setActiveTab]);

  // Custom device tab setter with navigation history (for PC terminal)
  const setDeviceTabWithHistory = useCallback((tab: TabType, deviceId: string, deviceType: DeviceType) => {
    if (isInternalNavRef.current) {
      isInternalNavRef.current = false;
      setActiveDeviceId(deviceId);
      setActiveDeviceType(deviceType);
      setActiveTab(tab);
      return;
    }

    // Add to history
    const newState = { tab, deviceId, program: undefined };
    const currentIndex = currentNavIndexRef.current;

    // Remove any forward history
    if (currentIndex < navigationHistoryRef.current.length - 1) {
      navigationHistoryRef.current = navigationHistoryRef.current.slice(0, currentIndex + 1);
    }

    navigationHistoryRef.current.push(newState);
    currentNavIndexRef.current = navigationHistoryRef.current.length - 1;

    // Push to browser history
    window.history.pushState({ tab, deviceId }, '');

    setActiveDeviceId(deviceId);
    setActiveDeviceType(deviceType);
    setActiveTab(tab);
  }, [setActiveTab, setActiveDeviceId, setActiveDeviceType]);

  // Handle PCPanel tablet program navigation
  const handlePCPanelNavigate = useCallback((program: string) => {
    if (program === 'home') {
      // Navigate back to topology when going home from tablet
      if (isInternalNavRef.current) {
        isInternalNavRef.current = false;
        return;
      }
      window.history.pushState({ tab: 'topology', deviceId: activeDeviceId }, '');
    } else if (program === 'terminal' || program === 'desktop') {
      // Navigate to CMD terminal tab
      if (isInternalNavRef.current) {
        isInternalNavRef.current = false;
        return;
      }
      window.history.pushState({ tab: 'cmd', deviceId: activeDeviceId, program }, '');
    }
  }, [activeDeviceId]);

  // Listen for device config updates from PCPanel
  useEffect(() => {
    const handleDeviceUpdate = (event: any) => {
      const { deviceId, config } = event.detail;

      // Update topology devices using functional update to avoid stale closure
      setTopologyDevices(prev =>
        prev.map((d) =>
          d.id === deviceId
            ? { ...d, ...config }
            : d
        )
      );

      // Update deviceStates (CLI hostname)
      if (config.name) {
        setDeviceStates((prev) => {
          const state = prev.get(deviceId);
          if (state) {
            const next = new Map(prev);
            next.set(deviceId, { ...state, hostname: config.name });
            return next;
          }
          return prev;
        });
      }

      // Keep router/switch wlan0 runtime state in sync with web-admin WiFi saves
      if (config.wifi) {
        setDeviceStates((prev) => {
          const state = prev.get(deviceId);
          if (!state || !state.ports?.['wlan0']) return prev;
          const next = new Map(prev);
          next.set(deviceId, {
            ...state,
            ports: {
              ...state.ports,
              wlan0: {
                ...state.ports['wlan0'],
                shutdown: !config.wifi.enabled,
                wifi: {
                  ssid: config.wifi.ssid || '',
                  security: config.wifi.security || 'open',
                  password: config.wifi.password || '',
                  channel: config.wifi.channel || '2.4GHz',
                  // Keep selected mode even when disabled; shutdown controls operational state.
                  mode: config.wifi.mode || 'ap',
                },
              },
            },
          });
          return next;
        });
      }

      // Handle IoT device disconnect - clear IP and WiFi state
      if (config.ip === '' && config.wifi?.enabled === false) {
        setDeviceStates((prev) => {
          const state = prev.get(deviceId);
          if (!state) return prev;
          const next = new Map(prev);
          next.set(deviceId, {
            ...state,
            ports: {
              ...state.ports,
              wlan0: {
                ...state.ports?.['wlan0'],
                shutdown: true,
                wifi: {
                  ssid: '',
                  security: 'open',
                  password: '',
                  channel: '2.4GHz',
                  mode: 'client',
                },
              },
            },
          });
          return next;
        });
      }
    };

    window.addEventListener('update-topology-device-config', handleDeviceUpdate);
    return () => window.removeEventListener('update-topology-device-config', handleDeviceUpdate);
  }, []);

  // Listen for add-topology-device event (from router admin panel IoT add)
  useEffect(() => {
    const handleAddDevice = (event: any) => {
      const { device } = event.detail;
      if (!device) return;

      setTopologyDevices(prev => [...prev, device]);

      // Also add device state for IoT devices
      if (device.type === 'iot') {
        setDeviceStates(prev => {
          const next = new Map(prev);
          // Create initial IoT device state with minimal required fields
          const iotState: any = {
            hostname: device.name,
            macAddress: device.macAddress || '00:00:00:00:00:00',
            switchModel: 'WS-C2960-24TT-L',
            switchLayer: 'L2' as const,
            currentMode: 'user' as const,
            ports: {
              eth0: {
                id: 'eth0',
                label: 'Eth0',
                status: 'disconnected' as const,
                shutdown: false,
              },
              wlan0: {
                id: 'wlan0',
                label: 'Wlan0',
                status: 'connected' as const,
                shutdown: false,
                wifi: {
                  ssid: device.wifi?.ssid || '',
                  security: device.wifi?.security || 'open',
                  password: device.wifi?.password || '',
                  channel: device.wifi?.channel || '2.4GHz',
                  mode: 'client' as const,
                },
              },
            },
            vlans: {},
            security: {},
            runningConfig: [],
            commandHistory: [],
            historyIndex: -1,
            version: {
              nosVersion: '1.0',
              modelName: 'IoT Device',
              serialNumber: 'N/A',
              uptime: '0d 0h 0m',
            },
            macAddressTable: [],
          };
          next.set(device.id, iotState);
          return next;
        });
      }
    };

    window.addEventListener('add-topology-device', handleAddDevice);
    return () => window.removeEventListener('add-topology-device', handleAddDevice);
  }, []); // Actions from useAppStore are stable, and functional updates avoid stale data issues.

  // Initialize graphics quality to 'high' for first-time visitors
  useEffect(() => {
    const appStoreData = localStorage.getItem('network-simulator-storage');
    if (!appStoreData) {
      // First-time visitor: ensure graphics quality is set to high
      setGraphicsQuality('high');
    }
  }, [setGraphicsQuality]);

  // Initialize defaults on mount to avoid hydration mismatch
  useEffect(() => {
    const savedData = localStorage.getItem('netsim_autosave');
    if (!savedData) {
      setTopologyDevices([
        {
          id: 'pc-1',
          type: 'pc',
          name: 'PC-1',
          x: 50,
          y: 50,
          ip: '192.168.1.10',
          macAddress: '00E0.F701.A1B1',
          status: 'online',
          ports: [
            { id: 'eth0', label: 'Eth0', status: 'disconnected' as const },
            { id: 'com1', label: 'COM1', status: 'disconnected' as const }
          ]
        },
        {
          id: 'pc-2',
          type: 'pc',
          name: 'PC-2',
          x: 50,
          y: 150,
          ip: '192.168.1.20',
          macAddress: '00E0.F701.A1B2',
          status: 'online',
          ports: [
            { id: 'eth0', label: 'Eth0', status: 'disconnected' as const },
            { id: 'com1', label: 'COM1', status: 'disconnected' as const }
          ]
        },
        {
          id: 'switch-1',
          type: 'switchL2',
          name: 'SWITCH-1',
          x: 200,
          y: 50,
          macAddress: '0011.2233.4401',
          ip: '',
          status: 'online',
          ports: [
            { id: 'console', label: 'Console', status: 'disconnected' as const },
            ...Array.from({ length: 24 }, (_, i) => ({ id: `fa0/${i + 1}`, label: `Fa0/${i + 1}`, status: 'disconnected' as const })),
            { id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const },
            { id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const }
          ]
        }
      ]);
    }
  }, []);

  const toggleDevicePower = useCallback((deviceId: string) => {
    setTopologyDevices((prev) => {
      const current = prev.find(d => d.id === deviceId);
      const nextStatus: 'online' | 'offline' = current?.status === 'offline' ? 'online' : 'offline';
      window.dispatchEvent(new CustomEvent('trigger-topology-toggle-power', {
        detail: {
          deviceId,
          nextStatus,
          deviceType: current?.type,
          switchModel: current?.switchModel
        }
      }));

      // Clear previous outputs/history so fresh boot output is visible
      setDeviceOutputs(prevOutputs => {
        const next = new Map(prevOutputs);
        next.set(deviceId, []);
        return next;
      });
      setPcOutputs(prevOutputs => {
        const next = new Map(prevOutputs);
        next.set(deviceId, []);
        return next;
      });
      setPcHistories(prevHistories => {
        const next = new Map(prevHistories);
        next.set(deviceId, []);
        return next;
      });

      const nextDevices = prev.map((d) => (d.id === deviceId ? { ...d, status: nextStatus } : d));
      const byId = new Map(nextDevices.map(d => [d.id, d] as const));

      setTopologyConnections((prevConnections) =>
        prevConnections.map((c) => {
          if (c.sourceDeviceId !== deviceId && c.targetDeviceId !== deviceId) return c;
          if (nextStatus === 'offline') return { ...c, active: false };
          const peerId = c.sourceDeviceId === deviceId ? c.targetDeviceId : c.sourceDeviceId;
          const peer = byId.get(peerId);
          return { ...c, active: peer?.status !== 'offline' };
        })
      );

      return nextDevices;
    });
  }, [setTopologyDevices, setTopologyConnections]);

  const [cableInfo, setCableInfo] = useState<CableInfo>({
    connected: true,
    cableType: 'straight',
    sourceDevice: 'pc',
    targetDevice: 'switchL2',
  });

  // Initial App Loading State
  // No longer needed here as it's declared earlier

  // Device manager hook moved to top

  const [topologyKey, setTopologyKey] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<DeviceType | null>(null);
  const [showPCPanel, setShowPCPanel] = useState(false);
  const [showPCDeviceId, setShowPCDeviceId] = useState<string>('pc-1');
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');

  // Get current state helper
  const getCurrentState = useCallback((): ProjectState => ({
    topologyDevices: Array.isArray(topologyDevices) ? [...topologyDevices] : [],
    topologyConnections: Array.isArray(topologyConnections) ? [...topologyConnections] : [],
    topologyNotes: Array.isArray(topologyNotes) ? [...topologyNotes] : [],
    deviceStates: new Map(deviceStates || []),
    deviceOutputs: new Map(deviceOutputs || []),
    pcOutputs: new Map(pcOutputs || []),
    pcHistories: new Map(pcHistories || []),
    cableInfo: { ...cableInfo },
    activeDeviceId: activeDeviceId || '',
    activeDeviceType: activeDeviceType || 'switchL2',
    zoom,
    pan: { ...pan },
    activeTab
  }), [topologyDevices, topologyConnections, topologyNotes, deviceStates, deviceOutputs, pcOutputs, pcHistories, cableInfo, activeDeviceId, activeDeviceType, zoom, pan, activeTab]);

  const { pushState, undo, redo, canUndo, canRedo, resetHistory, currentState } = useHistory(getCurrentState());

  // Undo/redo must only work while topology tab is active.
  const activeTabRef = useRef<TabType>('topology');

  // Handle undo/redo execution
  const applyProjectState = useCallback((state: ProjectState) => {
    // We use functional updates to ensure we're using latest state and prevent loops if possible
    // but here we just want to set EVERYTHING at once.
    setTopologyDevices(state.topologyDevices);
    setTopologyConnections(state.topologyConnections);
    setTopologyNotes(state.topologyNotes || []);
    setDeviceStates(new Map(state.deviceStates));
    setDeviceOutputs(new Map(state.deviceOutputs));
    setPcOutputs(new Map(state.pcOutputs));
    setPcHistories(new Map(state.pcHistories || []));
    setCableInfo(state.cableInfo);
    setActiveDeviceId(state.activeDeviceId);
    setActiveDeviceType(state.activeDeviceType);
    setZoom(state.zoom);
    setPan(state.pan);
    if (state.activeTab) {
      setActiveTab(state.activeTab as TabType);
    }
    // setTopologyKey(prev => prev + 1); // Only for resets
  }, [setTopologyDevices, setTopologyConnections, setTopologyNotes, setDeviceStates, setDeviceOutputs, setPcOutputs, setPcHistories, setCableInfo, setActiveDeviceId, setActiveDeviceType, setZoom, setPan, setActiveTab]);

  const isApplyingHistoryRef = useRef(false);
  const pendingHistoryActionRef = useRef<'undo' | 'redo' | null>(null);
  const lastAppliedHistoryStateRef = useRef<ProjectState | null>(null);

  const handleUndo = useCallback(() => {
    if (activeTabRef.current !== 'topology') return;
    isApplyingHistoryRef.current = true;
    pendingHistoryActionRef.current = 'undo';
    undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    if (activeTabRef.current !== 'topology') return;
    isApplyingHistoryRef.current = true;
    pendingHistoryActionRef.current = 'redo';
    redo();
  }, [redo]);

  useEffect(() => {
    if (!isApplyingHistoryRef.current) return;
    if (!currentState) return;
    if (lastAppliedHistoryStateRef.current === currentState) return;

    applyProjectState(currentState);
    lastAppliedHistoryStateRef.current = currentState;
    isApplyingHistoryRef.current = false;
    pendingHistoryActionRef.current = null;
  }, [currentState, applyProjectState]);

  // Track changes and push to history
  // We need to debouncing this or use a ref to track if we're in the middle of an undo/redo
  const lastPushedStateRef = useRef<string>('');

  // Initialize lastPushedStateRef with initial state to avoid redundant first push
  useEffect(() => {
    const initialState = getCurrentState();
    lastPushedStateRef.current = JSON.stringify({
      t: initialState.topologyDevices,
      c: initialState.topologyConnections,
      n: initialState.topologyNotes,
      s: Array.from(initialState.deviceStates.keys()),
      id: initialState.activeDeviceId,
      tab: initialState.activeTab
    });
  }, []); // Run once on mount

  useEffect(() => {
    if (isAppLoading) return;

    const currentState = getCurrentState();
    const stateString = JSON.stringify({
      t: currentState.topologyDevices,
      c: currentState.topologyConnections,
      n: currentState.topologyNotes,
      s: Array.from(currentState.deviceStates.keys()),
      id: currentState.activeDeviceId,
      tab: currentState.activeTab
    });

    if (stateString !== lastPushedStateRef.current) {
      if (isApplyingHistoryRef.current) {
        lastPushedStateRef.current = stateString;
        isApplyingHistoryRef.current = false;
        return;
      }

      // Debounce history pushes
      const timer = setTimeout(() => {
        pushState(currentState, activeTab === 'topology' ? 'topology' : 'ui');
        lastPushedStateRef.current = stateString;
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // If state didn't change but we were applying history, 
      // we still need to clear the flag
      if (isApplyingHistoryRef.current) {
        isApplyingHistoryRef.current = false;
      }
    }
  }, [topologyDevices, topologyConnections, topologyNotes, deviceStates, deviceOutputs, pcOutputs, pcHistories, cableInfo, activeDeviceId, activeDeviceType, zoom, pan, activeTab, isAppLoading, pushState]);

  // Initial App Loading State
  // No longer needed here as it's declared earlier

  useEffect(() => {
    // Initial loading sequence: short splash, then skeleton, then content.
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const splashMs = prefersReducedMotion ? 300 : 700;
    const skeletonMs = splashMs + 400;

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, splashMs);

    const skeletonTimer = setTimeout(() => {
      setShowSkeleton(false);
      setTimeout(() => setShowContent(true), 100);
    }, skeletonMs);

    return () => {
      clearTimeout(timer);
      clearTimeout(skeletonTimer);
    };
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const topologyContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingFocusDeviceRef = useRef<string | null>(null);

  // Initialize with empty Map if undefined to prevent SSR errors
  const safeDeviceStates = deviceStates || new Map();
  const safeDeviceOutputs = deviceOutputs || new Map();
  const safePcOutputs = pcOutputs || new Map();
  const safePcHistories = pcHistories || new Map();

  // Legacy state for compatibility with other panels (uses active device's state)
  const state = useMemo(() => {
    const activeDevice = (topologyDevices || []).find(d => d.id === activeDeviceId);
    const resolvedType = activeDevice?.type ?? activeDeviceType;
    return getOrCreateDeviceState(activeDeviceId, resolvedType, activeDevice?.name, activeDevice?.macAddress, activeDevice?.switchModel);
  }, [activeDeviceId, activeDeviceType, topologyDevices, deviceStates, getOrCreateDeviceState]);
  const output = activeTab === 'topology' ? [] : getOrCreateDeviceOutputs(activeDeviceId, state);

  // Redundant declaration of activeTab removed (moved higher)
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Task context for task calculations
  const taskContext: TaskContext = {
    cableInfo,
    showPCPanel,
    selectedDevice,
    language,
    deviceStates,
    topologyConnections,
  };

  // Track task completion changes globally
  const prevTaskStatusRef = useRef<Map<string, boolean>>(new Map());
  const shownToastsRef = useRef<Set<string>>(new Set());
  const [lastTaskEvent, setLastTaskEvent] = useState<{ type: 'completed' | 'failed'; taskName: string; timestamp: number } | null>(null);

  useEffect(() => {
    const allTasks = [...topologyTasks, ...portTasks, ...vlanTasks, ...securityTasks, ...wirelessTasks];

    allTasks.forEach(task => {
      const currentStatus = getTaskStatus(task, state, taskContext);
      const previousStatus = prevTaskStatusRef.current.get(task.id) ?? false;
      const toastKey = `${task.id}-${currentStatus}`;

      // Task completed - show in footer only once
      if (currentStatus && !previousStatus && !shownToastsRef.current.has(toastKey)) {
        const taskName = task.name[language];
        setLastTaskEvent({ type: 'completed', taskName, timestamp: Date.now() });
        shownToastsRef.current.add(toastKey);
        // Remove the failed toast key if it exists
        shownToastsRef.current.delete(`${task.id}-false`);
      }
      // Task failed (was completed but now it's not) - show in footer only once
      else if (!currentStatus && previousStatus && !shownToastsRef.current.has(toastKey)) {
        const taskName = task.name[language];
        setLastTaskEvent({ type: 'failed', taskName, timestamp: Date.now() });
        shownToastsRef.current.add(toastKey);
        // Remove the completed toast key if it exists
        shownToastsRef.current.delete(`${task.id}-true`);
      }

      // Update previous status
      prevTaskStatusRef.current.set(task.id, currentStatus);
    });
  }, [state, taskContext, language]);

  // Calculate total score
  const totalScore = calculateTaskScore([...topologyTasks, ...portTasks, ...vlanTasks, ...securityTasks, ...wirelessTasks], state, taskContext);

  // Calculate max possible score
  const maxScore = [...topologyTasks, ...portTasks, ...vlanTasks, ...securityTasks, ...wirelessTasks].reduce((acc, task) => acc + task.weight, 0);

  // Per-tab task completion counts for badges
  const completedTasks = portTasks.filter(task => getTaskStatus(task, state, taskContext)).length +
    vlanTasks.filter(task => getTaskStatus(task, state, taskContext)).length +
    securityTasks.filter(task => getTaskStatus(task, state, taskContext)).length +
    wirelessTasks.filter(task => getTaskStatus(task, state, taskContext)).length;

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null);
  const [saveDialog, setSaveDialog] = useState<{
    show: boolean;
    message: string;
    onConfirm: (save: boolean) => void;
  } | null>(null);

  // UI state for dropdowns
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isEnvironmentPanelOpen, setIsEnvironmentPanelOpen] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalHistoryPushedRef = useRef(false);

  const normalizeDeviceType = useCallback((type: string): DeviceType => {
    if (type === 'switch') return 'switchL2';
    if (type === 'switchL2' || type === 'switchL3' || type === 'pc' || type === 'iot' || type === 'router') return type;
    return 'pc';
  }, []);

  // Persistence: Save to localStorage
  useEffect(() => {
    if (isAppLoading) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      const projectData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        devices: Array.from(deviceStates.entries()).map(([id, state]) => ({ id, state })),
        deviceOutputs: Array.from(deviceOutputs.entries()).map(([id, outputs]) => ({ id, outputs })),
        pcOutputs: Array.from(pcOutputs.entries()).map(([id, outputs]) => ({ id, outputs })),
        pcHistories: Array.from(pcHistories.entries()).map(([id, history]) => ({ id, history })),
        topology: {
          devices: topologyDevices,
          connections: topologyConnections,
          notes: topologyNotes,
          zoom,
          pan,
        },
        cableInfo,
        activeDeviceId,
        activeDeviceType,
        activeTab
      };

      localStorage.setItem('netsim_autosave', JSON.stringify(projectData));
      autosaveTimerRef.current = null;
      setLastSaveTime(new Date().toLocaleTimeString());
      setHasUnsavedChanges(false);
    }, 800);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [deviceStates, deviceOutputs, pcOutputs, pcHistories, topologyDevices, topologyConnections, topologyNotes, cableInfo, activeDeviceId, activeDeviceType, activeTab, isAppLoading, zoom, pan]);

  // Load project from JSON data
  const loadProjectData = useCallback((projectData: any) => {
    try {
      // Load device states
      if (projectData.devices && Array.isArray(projectData.devices)) {
        const newDeviceStates = new Map<string, SwitchState>();
        projectData.devices.forEach((item: { id: string; state: SwitchState }) => {
          newDeviceStates.set(item.id, item.state);
        });
        setDeviceStates(newDeviceStates);
      }

      // Load device outputs
      if (projectData.deviceOutputs && Array.isArray(projectData.deviceOutputs)) {
        const newDeviceOutputs = new Map<string, TerminalOutput[]>();
        projectData.deviceOutputs.forEach((item: { id: string; outputs: TerminalOutput[] }) => {
          let outputs = item.outputs || [];

          // If banner is in state but not in outputs, prepend it (only for switches/routers)
          const stateItem = projectData.devices?.find((d: any) => d.id === item.id);
          if (stateItem?.state?.bannerMOTD && !outputs.some(o => o.content?.includes(stateItem.state.bannerMOTD))) {
            outputs = [
              {
                id: 'banner-load-static',
                type: 'output',
                content: stateItem.state.bannerMOTD + '\n'
              },
              ...outputs
            ];
          }

          newDeviceOutputs.set(item.id, outputs);
        });
        setDeviceOutputs(newDeviceOutputs);
      } else if (projectData.devices && Array.isArray(projectData.devices)) {
        // If no device outputs provided, generate boot messages for all devices
        const newDeviceOutputs = new Map<string, TerminalOutput[]>();
        projectData.devices.forEach((item: { id: string; state: SwitchState }) => {
          const deviceId = item.id;
          const state = item.state;
          const isRouter = deviceId.includes('router');
          const isL3Switch = state?.switchLayer === 'L3' || state?.switchModel?.includes('3560');

          // Generate boot messages based on device type
          let bootMessages: TerminalOutput[] = [];
          const suffix = state?.macAddress || deviceId;

          if (isRouter) {
            const syslog = t.syslogStarted;
            bootMessages = [
              { id: `boot-1-${suffix}`, type: 'output', content: `\n\nSystem Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)\nTechnical Support: http://yunus.sf.net\nCopyright (c) 1994-2011 by Network Systems, Inc.\n` },
              { id: `boot-2-${suffix}`, type: 'output', content: `ISR4451/K9 platform with 4096 K bytes of memory\n\n${syslog}\nLoad/bootstrap symbols loaded, GOXR initialization\nReading all bootflash vectors\nPOST: CPU PCIe port Check PASS\nCPU memory test . . . . . . . . . . . . . OK\nBoard initialization completed\nInitializing flash file system\n` },
              { id: `boot-3-${suffix}`, type: 'output', content: `\nBooting flash:c1900-universalk9-mz.SPA.154-3.M.bin...OK!\nExtracting files from flash:c1900-universalk9-mz.SPA.154-3.M.bin...\n  ########## [OK]\n  0 bytes remaining in flash device\n` },
              ...(state?.bannerMOTD ? [{ id: `banner-${suffix}`, type: 'output' as const, content: `\n${state.bannerMOTD}\n` }] : []),
              { id: `boot-ready-${suffix}`, type: 'output', content: BOOT_PROGRESS_MARKER }
            ];
          } else if (isL3Switch) {
            const syslog = t.syslogStarted;
            bootMessages = [
              { id: `boot-1-${suffix}`, type: 'output', content: `\n\nSystem Bootstrap, Version 12.2(55r)SE, RELEASE SOFTWARE (fc1)\nTechnical Support: http://yunus.sf.net\nCopyright (c) 1994-2011 by Network Systems, Inc.\n` },
              { id: `boot-2-${suffix}`, type: 'output', content: `C3560 platform with 131072 K bytes of memory\n\n${syslog}\nLoad/bootstrap symbols loaded\nReading all bootflash vectors\nPOST: CPU PCIe port Check PASS\nCPU memory test . . . . . . . . . . . . . OK\nBoard initialization completed\nInitializing flash file system\n` },
              { id: `boot-3-${suffix}`, type: 'output', content: `\nBooting flash:c3560-ipbase-mz.152-2.SE4.bin...OK!\nExtracting files from flash:c3560-ipbase-mz.152-2.SE4.bin...\n  ########## [OK]\n  0 bytes remaining in flash device\n` },
              ...(state?.bannerMOTD ? [{ id: `banner-${suffix}`, type: 'output' as const, content: `\n${state.bannerMOTD}\n` }] : []),
              { id: `boot-ready-${suffix}`, type: 'output', content: BOOT_PROGRESS_MARKER }
            ];
          } else {
            const syslog = t.syslogStarted;
            bootMessages = [
              { id: `boot-1-${suffix}`, type: 'output', content: `\n\nSystem Bootstrap, Version 12.2(11r)EA1, RELEASE SOFTWARE (fc1)\nTechnical Support: http://yunus.sf.net\nCopyright (c) 1994-2010 by Network Systems, Inc.\n` },
              { id: `boot-2-${suffix}`, type: 'output', content: `C2960 platform with 65536 K bytes of memory\n\n${syslog}\nLoad/bootstrap symbols loaded\nReading all bootflash vectors\nPOST: CPU Ethernet port Check PASS\nCPU memory test . . . . . . . . . . . . . OK\nBoard initialization completed\nInitializing flash file system\n` },
              { id: `boot-3-${suffix}`, type: 'output', content: `\nBooting flash:c2960-lanbase-mz.152-2.E6.bin...OK!\nExtracting files from flash:c2960-lanbase-mz.152-2.E6.bin...\n  ########## [OK]\n  0 bytes remaining in flash device\n` },
              ...(state?.bannerMOTD ? [{ id: `banner-${suffix}`, type: 'output' as const, content: `\n${state.bannerMOTD}\n` }] : []),
              { id: `boot-ready-${suffix}`, type: 'output', content: BOOT_PROGRESS_MARKER }
            ];
          }

          newDeviceOutputs.set(deviceId, bootMessages);
        });
        setDeviceOutputs(newDeviceOutputs);
      }

      // Load PC outputs
      if (projectData.pcOutputs && Array.isArray(projectData.pcOutputs)) {
        const newPcOutputs = new Map<string, PCOutputLine[]>();
        projectData.pcOutputs.forEach((item: { id: string; outputs: PCOutputLine[] }) => {
          newPcOutputs.set(item.id, item.outputs || []);
        });
        setPcOutputs(newPcOutputs);
      }

      // Load PC histories
      if (projectData.pcHistories && Array.isArray(projectData.pcHistories)) {
        const newPcHistories = new Map<string, string[]>();
        projectData.pcHistories.forEach((item: { id: string; history: string[] }) => {
          newPcHistories.set(item.id, item.history || []);
        });
        setPcHistories(newPcHistories);
      }

      // Load topology
      if (projectData.topology) {
        const normalizedDevices = (projectData.topology.devices || []).map((device: CanvasDevice) => ({
          ...device,
          type: normalizeDeviceType(device.type),
        }));
        setTopologyDevices(normalizedDevices);
        setTopologyConnections(projectData.topology.connections || []);
        setTopologyNotes(projectData.topology.notes || []);
        if (projectData.topology.zoom) setZoom(projectData.topology.zoom);
        if (projectData.topology.pan) setPan(projectData.topology.pan);
      }

      // Load cable info
      if (projectData.cableInfo) {
        setCableInfo({
          ...projectData.cableInfo,
          sourceDevice: normalizeDeviceType(projectData.cableInfo.sourceDevice),
          targetDevice: normalizeDeviceType(projectData.cableInfo.targetDevice),
        });
      }

      // Load active device
      if (projectData.activeDeviceId) {
        setActiveDeviceId(projectData.activeDeviceId);
      }
      if (projectData.activeDeviceType) {
        setActiveDeviceType(normalizeDeviceType(projectData.activeDeviceType));
      }

      // Load active tab
      if (projectData.activeTab) {
        setActiveTab(projectData.activeTab);
      }

      // Increment topology key to force remount
      setTopologyKey(prev => prev + 1);
      setHasUnsavedChanges(false);

      // Reset history with the loaded state
      resetHistory({
        topologyDevices: (projectData.topology?.devices || []).map((device: CanvasDevice) => ({
          ...device,
          type: normalizeDeviceType(device.type),
        })),
        topologyConnections: projectData.topology?.connections || [],
        topologyNotes: projectData.topology?.notes || [],
        deviceStates: new Map(projectData.devices?.map((item: any) => [item.id, item.state]) || []),
        deviceOutputs: new Map(projectData.deviceOutputs?.map((item: any) => [item.id, item.outputs]) || []),
        pcOutputs: new Map(projectData.pcOutputs?.map((item: any) => [item.id, item.outputs]) || []),
        pcHistories: new Map(projectData.pcHistories?.map((item: any) => [item.id, item.history]) || []),
        cableInfo: projectData.cableInfo
          ? {
            ...projectData.cableInfo,
            sourceDevice: normalizeDeviceType(projectData.cableInfo.sourceDevice),
            targetDevice: normalizeDeviceType(projectData.cableInfo.targetDevice),
          }
          : { connected: false, cableType: 'straight', sourceDevice: 'pc', targetDevice: 'switchL2' },
        activeDeviceId: projectData.activeDeviceId || 'switch-1',
        activeDeviceType: normalizeDeviceType(projectData.activeDeviceType || 'switchL2'),
        zoom: projectData.zoom || 1.0,
        pan: projectData.pan || { x: 0, y: 0 },
        activeTab: projectData.activeTab || 'topology'
      });

      return true;
    } catch (error) {
      console.error("Error loading project data", error);
      toast({
        variant: 'destructive',
        title: t.invalidProject,
        description: t.corruptedProject,
      });
      return false;
    }
  }, [setDeviceStates, setDeviceOutputs, setPcOutputs, setPcHistories, setTopologyDevices, setTopologyConnections, setTopologyNotes, setCableInfo, setActiveDeviceId, setActiveDeviceType, setActiveTab, setTopologyKey, setHasUnsavedChanges, resetHistory, toast, setZoom, setPan, language, normalizeDeviceType]);

  // Persistence: Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('netsim_autosave');
    if (savedData) {
      try {
        const projectData = JSON.parse(savedData);
        loadProjectData(projectData);
        // Load last save time from timestamp
        if (projectData.timestamp) {
          const date = new Date(projectData.timestamp);
          setLastSaveTime(date.toLocaleTimeString());
        } else {
          setLastSaveTime(new Date().toLocaleTimeString());
        }
      } catch (e) {
        console.error("Failed to load autosave", e);
      }
    }
  }, [loadProjectData]);

  // Onboarding: show once per browser
  useEffect(() => {
    try {
      const seen = localStorage.getItem('netsim_onboarding_seen');
      if (!seen) {
        setShowOnboarding(true);
        setOnboardingStep(0);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  // Sync active tab when device type changes
  useEffect(() => {
    const currentTabDef = ALL_TABS.find(t => t.id === activeTab);
    if (currentTabDef && !currentTabDef.showFor.includes(activeDeviceType)) {
      // Keep current tab when possible; otherwise fallback to topology
      setActiveTabWithHistory('topology');
    }
  }, [activeDeviceType, activeTab]);

  // Broadcast to other components (like NetworkTopology)
  const broadcastCloseMenus = useCallback((source: string) => {
    window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source } }));
  }, []);

  const closeLocalMenus = useCallback((exclude?: string) => {
    if (exclude !== 'mobile') setShowMobileMenu(false);
    if (exclude !== 'modal') {
      setConfirmDialog(null);
      setSaveDialog(null);
    }
  }, [setShowMobileMenu, setConfirmDialog, setSaveDialog]);

  const openMobileMenu = useCallback(() => {
    const nextState = !showMobileMenu;
    if (nextState) {
      closeLocalMenus('mobile');
      broadcastCloseMenus('mobile');
    }
    setShowMobileMenu(nextState);
  }, [showMobileMenu, closeLocalMenus, broadcastCloseMenus]);

  const focusDeviceInTopology = useCallback((deviceId?: string) => {
    if (!deviceId) return;
    // Pan after any programmatic zoom/pan changes so centering uses fresh layout.
    requestAnimationFrame(() => {
      const rect = topologyContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const targetDevice = topologyDevices.find((device) => device.id === deviceId);
      if (!targetDevice) return;
      setPan({
        x: rect.width / 2 - targetDevice.x * zoom,
        y: rect.height / 2 - targetDevice.y * zoom,
      });
    });
  }, [topologyDevices, zoom, setPan]);

  const resetTopologyView = useCallback(() => {
    const nextZoom = 1.0;
    const PADDING = 10;
    setZoom(nextZoom);

    if (topologyDevices.length === 0 && topologyNotes.length === 0) {
      setPan({ x: 0, y: 0 });
      return;
    }

    const minDeviceX = topologyDevices.reduce((acc, d) => Math.min(acc, d.x), Infinity);
    const minDeviceY = topologyDevices.reduce((acc, d) => Math.min(acc, d.y), Infinity);
    const minNoteX = topologyNotes.reduce((acc, n) => Math.min(acc, n.x), Infinity);
    const minNoteY = topologyNotes.reduce((acc, n) => Math.min(acc, n.y), Infinity);
    const minX = Math.min(minDeviceX, minNoteX);
    const minY = Math.min(minDeviceY, minNoteY);

    setPan({ x: PADDING - minX * nextZoom, y: PADDING - minY * nextZoom });
  }, [topologyDevices, topologyNotes, setZoom, setPan]);

  const switchTabOrTopology = useCallback((tabId: TabType) => {
    const targetTab = ALL_TABS.find(tab => tab.id === tabId);
    if (!targetTab) return;

    const deviceVisible = activeDeviceId && topologyDevices.some(d => d.id === activeDeviceId);
    const isCompatible = tabId === 'topology' || (deviceVisible && targetTab.showFor.includes(activeDeviceType));

    setActiveTab(isCompatible ? tabId : 'topology');
  }, [activeDeviceId, activeDeviceType, topologyDevices, setActiveTab]);

  const pendingDeviceSelectionRef = useRef<{ device: DeviceType; deviceId: string; switchModel?: string; deviceName?: string } | null>(null);

  const applyDeviceSelection = useCallback((device: DeviceType, deviceId?: string, switchModel?: string, deviceName?: string) => {
    if (!deviceId) return;

    // Immediately create device state so sync effects have correct data
    if (device !== 'pc') {
      const deviceObj = topologyDevices?.find(d => d.id === deviceId);
      const modelToUse = switchModel || deviceObj?.switchModel;
      const initialHostname = deviceObj?.name || deviceName;
      const deviceState = getOrCreateDeviceState(deviceId, device, initialHostname, deviceObj?.macAddress, modelToUse);
      getOrCreateDeviceOutputs(deviceId, deviceState);
    }

    // Schedule UI-only state updates outside render cycle
    pendingDeviceSelectionRef.current = { device, deviceId, switchModel, deviceName };
    queueMicrotask(() => {
      const pending = pendingDeviceSelectionRef.current;
      if (!pending) return;
      pendingDeviceSelectionRef.current = null;

      const currentTab = activeTabRef.current;
      const currentTabDef = ALL_TABS.find(t => t.id === currentTab);
      const nextTab: TabType =
        currentTabDef && currentTabDef.showFor.includes(pending.device)
          ? currentTab
          : 'topology';

      setSelectedDevice(pending.device);
      setActiveDeviceId(pending.deviceId);
      setActiveDeviceType(pending.device);
      if (nextTab !== currentTab) {
        setActiveTabWithHistory(nextTab);
      }
    });
  }, [topologyDevices, getOrCreateDeviceState, getOrCreateDeviceOutputs, setSelectedDevice, setActiveDeviceId, setActiveDeviceType, setActiveTabWithHistory]);

  // Topology canvas click: selects device only (no zoom/pan).
  const handleDeviceSelectFromCanvas = useCallback((device: DeviceType, deviceId?: string, switchModel?: string, deviceName?: string) => {
    applyDeviceSelection(device, deviceId, switchModel, deviceName);
  }, [applyDeviceSelection]);

  // Device dropdown/menu click: focus the selected device at 100% zoom.
  const handleDeviceSelectFromMenu = useCallback((device: DeviceType, deviceId?: string, switchModel?: string, deviceName?: string) => {
    applyDeviceSelection(device, deviceId, switchModel, deviceName);
    if (!deviceId) return;

    if (activeTab === 'topology' && topologyContainerRef.current) {
      resetTopologyView();
      focusDeviceInTopology(deviceId);
      pendingFocusDeviceRef.current = null;
    } else if (activeTab === 'topology') {
      pendingFocusDeviceRef.current = deviceId;
    }
  }, [activeTab, applyDeviceSelection, focusDeviceInTopology, resetTopologyView]);

  useLayoutEffect(() => {
    if (activeTab !== 'topology') return;
    if (!pendingFocusDeviceRef.current) return;
    if (!topologyContainerRef.current) return;
    resetTopologyView();
    focusDeviceInTopology(pendingFocusDeviceRef.current);
    pendingFocusDeviceRef.current = null;
  }, [activeTab, focusDeviceInTopology, resetTopologyView]);

  // Handle command using active device
  const handleCommand = useCallback(async (command: string) => {
    const result = await handleCommandForDevice(
      activeDeviceId,
      command,
      topologyDevices,
      setActiveDeviceId,
      setActiveDeviceType,
      topologyConnections
    );
    if (result?.exitSession) {
      setActiveTab('topology');
    }
  }, [activeDeviceId, handleCommandForDevice, topologyDevices, topologyConnections, setActiveDeviceId, setActiveDeviceType, setActiveTab]);

  const prompt = getPrompt(state);

  const handleExecuteCommand = useCallback(async (deviceId: string, command: string) => {
    return handleCommandForDevice(
      deviceId,
      command,
      topologyDevices,
      setActiveDeviceId,
      setActiveDeviceType,
      topologyConnections
    );
  }, [handleCommandForDevice, topologyDevices, topologyConnections, setActiveDeviceId, setActiveDeviceType]);

  const handleReset = () => {
    setConfirmDialog({
      show: true,
      message: t.resetConfirm,
      action: 'reset',
      onConfirm: () => {
        setConfirmDialog(null);
        resetAll();
        window.location.reload();
      }
    });
  };

  const handleClearTerminal = () => {
    setDeviceOutputs(prev => {
      const newMap = new Map(prev);
      newMap.set(activeDeviceId, []);
      return newMap;
    });
  };

  const focusActiveTerminalInput = useCallback(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector('[data-terminal-input]') as HTMLInputElement | null;
      const terminal = document.querySelector('[data-terminal-scroll]') as HTMLDivElement | null;
      if (terminal) {
        terminal.scrollTop = terminal.scrollHeight;
      }
      el?.focus();
    });
  }, []);

  // Handle device double click (Open terminal or PC panel)
  const handleDeviceDoubleClick = useCallback((device: DeviceType, deviceId: string) => {
    if (device === 'pc') {
      // PC - open CMD tab directly
      setDeviceTabWithHistory('cmd', deviceId, 'pc');
      setShowPCDeviceId(deviceId);
    } else {
      // Switch or Router - set as CLI device and switch to terminal
      const deviceObj = topologyDevices?.find(d => d.id === deviceId);
      getOrCreateDeviceState(deviceId, device, deviceObj?.name, deviceObj?.macAddress, deviceObj?.switchModel);
      getOrCreateDeviceOutputs(deviceId);

      setDeviceTabWithHistory('terminal', deviceId, device);
    }
  }, [getOrCreateDeviceState, getOrCreateDeviceOutputs, topologyDevices, setDeviceTabWithHistory, setShowPCDeviceId]);

  // Handle topology change from NetworkTopology component
  const handleTopologyChange = useCallback((devices: CanvasDevice[], connections: CanvasConnection[], notes: CanvasNote[]) => {
    setTopologyDevices(devices);
    setTopologyConnections(connections);
    setTopologyNotes(notes);
    setHasUnsavedChanges(true);

    // Sync port status from topology to deviceStates
    setDeviceStates(prev => {
      const newMap = new Map(prev);
      let changed = false;

      devices.forEach(topoDevice => {
        const state = newMap.get(topoDevice.id);
        if (state && state.ports) {
          const updatedPorts = { ...state.ports };
          let portChanged = false;

          topoDevice.ports.forEach(topoPort => {
            const statePort = updatedPorts[topoPort.id];
            if (statePort) {
              // Translate UI status → simulator status
              // UI 'connected' → simulator 'connected'
              // UI 'disconnected' → simulator 'notconnect'
              const targetSimStatus = topoPort.status === 'connected' ? 'connected' : 'notconnect';
              if (statePort.status !== targetSimStatus) {
                updatedPorts[topoPort.id] = {
                  ...statePort,
                  status: targetSimStatus
                };
                portChanged = true;
              }
            }
          });

          if (portChanged) {
            newMap.set(topoDevice.id, {
              ...state,
              ports: updatedPorts
            });
            changed = true;
          }
        }
      });

      return changed ? newMap : prev;
    });
  }, [setTopologyDevices, setTopologyConnections, setTopologyNotes, setHasUnsavedChanges, setDeviceStates]);

  // Handle device deletion - update active device if needed
  const handleDeviceDelete = useCallback((deviceId: string) => {
    // Close PC panel if showing the deleted device
    if (showPCDeviceId === deviceId) {
      setShowPCPanel(false);
      setShowPCDeviceId('pc-1');
    }

    // Reset selected device if deleted
    if (selectedDevice) {
      setSelectedDevice(null);
    }

    // 1. Identify connections and ports to disconnect FIRST (capture current state)
    setTopologyConnections(prevConnections => {
      const connectionsToRemove = prevConnections.filter(conn =>
        conn.sourceDeviceId === deviceId || conn.targetDeviceId === deviceId
      );

      const portsToDisconnect = connectionsToRemove.map(conn => {
        if (conn.sourceDeviceId === deviceId) {
          return { deviceId: conn.targetDeviceId, portId: conn.targetPort };
        } else {
          return { deviceId: conn.sourceDeviceId, portId: conn.sourcePort };
        }
      });

      const remainingConnections = prevConnections.filter(conn =>
        conn.sourceDeviceId !== deviceId && conn.targetDeviceId !== deviceId
      );

      // 2. Release ports on OTHER devices in simulation state (deviceStates)
      setDeviceStates(prev => {
        const newMap = new Map(prev);
        portsToDisconnect.forEach(p => {
          const targetState = newMap.get(p.deviceId);
          if (targetState && targetState.ports) {
            const updatedPorts = { ...targetState.ports };
            const portToReset = updatedPorts[p.portId];
            if (portToReset) {
              updatedPorts[p.portId] = {
                ...portToReset,
                status: 'notconnect'
              };
              newMap.set(p.deviceId, {
                ...targetState,
                ports: updatedPorts
              });
            }
          }
        });
        newMap.delete(deviceId);
        return newMap;
      });

      // 3. Clear other state maps
      setDeviceOutputs(prev => {
        const newMap = new Map(prev);
        newMap.delete(deviceId);
        return newMap;
      });

      setPcOutputs(prev => {
        const newMap = new Map(prev);
        newMap.delete(deviceId);
        return newMap;
      });

      // 4. Update topology: Update ports on remaining devices based on remaining connections
      setTopologyDevices(prev => {
        return prev.filter(d => d.id !== deviceId).map(device => {
          const updatedPorts = device.ports.map(port => {
            const isActuallyConnected = remainingConnections.some(conn =>
              (conn.sourceDeviceId === device.id && conn.sourcePort === port.id) ||
              (conn.targetDeviceId === device.id && conn.targetPort === port.id)
            );
            return {
              ...port,
              status: isActuallyConnected ? 'connected' as const : 'disconnected' as const
            };
          });
          return { ...device, ports: updatedPorts };
        });
      });

      return remainingConnections;
    });

    // If the deleted device was the active one, switch to another device
    if (activeDeviceId === deviceId) {
      setTopologyDevices(prev => {
        const currentDevices = prev.filter(d => d.id !== deviceId);
        if (currentDevices.length > 0) {
          const nextDevice = currentDevices[0];
          setActiveDeviceId(nextDevice.id);
          setActiveDeviceType(nextDevice.type as DeviceType);
          setActiveTab('topology');
        } else {
          setActiveDeviceId('');
          setActiveDeviceType('switchL2');
          setActiveTab('topology');
        }
        return prev;
      });
    }
    setHasUnsavedChanges(true);
  }, [activeDeviceId, showPCDeviceId, selectedDevice, setDeviceStates, setDeviceOutputs, setPcOutputs, setShowPCPanel, setShowPCDeviceId, setSelectedDevice, setActiveDeviceId, setActiveDeviceType, setActiveTab, setHasUnsavedChanges, setTopologyConnections, setTopologyDevices]);

  // Handle device rename - propagate topology label change to deviceStates hostname
  const handleDeviceRename = useCallback((deviceId: string, newName: string) => {
    setDeviceStates(prev => {
      const state = prev.get(deviceId);
      if (!state) return prev;
      const updated = { ...state, hostname: newName };
      updated.runningConfig = buildRunningConfig(updated);
      return new Map(prev).set(deviceId, updated);
    });
  }, [setDeviceStates]);

  const handleUpdateHistory = useCallback((deviceId: string, history: string[]) => {
    setDeviceStates(prev => {
      const state = prev.get(deviceId);
      if (state) {
        return new Map(prev).set(deviceId, { ...state, commandHistory: history });
      }
      return prev;
    });
  }, [setDeviceStates]);

  const handleUpdatePCHistory = useCallback((deviceId: string, history: string[]) => {
    setPcHistories(prev => new Map(prev).set(deviceId, history));
  }, [setPcHistories]);

  // Save project to JSON file
  const handleSaveProjectInternal = useCallback(() => {
    const projectData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      devices: Array.from(deviceStates.entries())
        .filter(([id]) => {
          const d = topologyDevices.find(td => td.id === id);
          return d && d.type !== 'pc' && d.type !== 'iot';
        })
        .map(([id, state]) => ({
          id,
          state
        })),
      deviceOutputs: Array.from(deviceOutputs.entries())
        .filter(([id]) => {
          const d = topologyDevices.find(td => td.id === id);
          return d && d.type !== 'pc' && d.type !== 'iot';
        })
        .map(([id, outputs]) => ({
          id,
          outputs
        })),
      pcOutputs: Array.from(pcOutputs.entries()).map(([id, outputs]) => ({
        id,
        outputs
      })),
      pcHistories: Array.from(pcHistories.entries()).map(([id, history]) => ({
        id,
        history
      })),
      topology: {
        devices: topologyDevices,
        connections: topologyConnections,
        notes: topologyNotes
      },
      cableInfo,
      activeDeviceId,
      activeDeviceType
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-project-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setHasUnsavedChanges(false);
    setLastSaveTime(new Date().toLocaleTimeString());
    toast({
      title: t.projectSaved,
      description: t.jsonDownloaded,
    });
  }, [deviceStates, deviceOutputs, pcOutputs, pcHistories, topologyDevices, topologyConnections, topologyNotes, cableInfo, activeDeviceId, activeDeviceType, setHasUnsavedChanges, setLastSaveTime, language]);

  // Handle Project Saving (Wrapper)
  function handleSaveProject() {
    handleSaveProjectInternal();
  }

  // New project - reset everything
  const resetToEmptyProject = useCallback(() => {
    // Clear all states and set defaults
    setDeviceStates(new Map());
    setDeviceOutputs(new Map());
    setPcOutputs(new Map());
    setTopologyDevices([
      {
        id: 'pc-1',
        type: 'pc',
        name: 'PC-1',
        x: 50,
        y: 50,
        ip: '192.168.1.10',
        macAddress: '00E0.F701.A1B1',
        status: 'online',
        ports: [
          { id: 'eth0', label: 'Eth0', status: 'disconnected' as const },
          { id: 'com1', label: 'COM1', status: 'disconnected' as const }
        ]
      },
      {
        id: 'pc-2',
        type: 'pc',
        name: 'PC-2',
        x: 50,
        y: 150,
        ip: '192.168.1.20',
        macAddress: '00E0.F701.A1B2',
        status: 'online',
        ports: [
          { id: 'eth0', label: 'Eth0', status: 'disconnected' as const },
          { id: 'com1', label: 'COM1', status: 'disconnected' as const }
        ]
      },
      {
        id: 'switch-1',
        type: 'switchL2',
        name: 'SWITCH-1',
        x: 200,
        y: 50,
        macAddress: '0011.2233.4401',
        ip: '',
        status: 'online',
        switchModel: 'WS-C2960-24TT-L',
        ports: [
          { id: 'console', label: 'Console', status: 'disconnected' as const },
          ...Array.from({ length: 24 }, (_, i) => ({ id: `fa0/${i + 1}`, label: `Fa0/${i + 1}`, status: 'disconnected' as const })),
          { id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const },
          { id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const }
        ]
      }
    ]);
    setTopologyConnections([]);
    setTopologyNotes([]);

    // Reset zoom and pan to top-left
    setZoom(1.0);
    setPan({ x: 0, y: 0 });

    // Scroll to top
    if (topologyContainerRef.current) {
      topologyContainerRef.current.scrollTop = 0;
      topologyContainerRef.current.scrollLeft = 0;
    }
    window.scrollTo(0, 0);

    // Reset active selections
    setActiveDeviceId('switch-1');
    setActiveDeviceType('switchL2');
    setSelectedDevice(null);
    setShowPCPanel(false);

    // Force return to topology
    setActiveTab('topology');
    setHasUnsavedChanges(false);

    // Increment key to force NetworkTopology remount
    setTopologyKey(prev => prev + 1);

    // Reset history with the new initial state
    resetHistory({
      topologyDevices: [
        {
          id: 'pc-1',
          type: 'pc',
          name: 'PC-1',
          x: 50,
          y: 50,
          ip: '192.168.1.10',
          macAddress: '00E0.F701.A1B1',
          status: 'online',
          ports: [
            { id: 'eth0', label: 'Eth0', status: 'disconnected' as const },
            { id: 'com1', label: 'COM1', status: 'disconnected' as const }
          ]
        },
        {
          id: 'switch-1',
          type: 'switchL2',
          name: 'SWITCH-1',
          x: 200,
          y: 50,
          macAddress: '0011.2233.4401',
          ip: '',
          status: 'online',
          switchModel: 'WS-C2960-24TT-L',
          ports: [
            { id: 'console', label: 'Console', status: 'disconnected' as const },
            ...Array.from({ length: 24 }, (_, i) => ({ id: `fa0/${i + 1}`, label: `Fa0/${i + 1}`, status: 'disconnected' as const })),
            { id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const },
            { id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const }
          ]
        }
      ],
      topologyConnections: [],
      topologyNotes: [],
      deviceStates: new Map(),
      deviceOutputs: new Map(),
      pcOutputs: new Map(),
      pcHistories: new Map(),
      cableInfo: { connected: false, cableType: 'straight', sourceDevice: 'pc', targetDevice: 'switchL2' },
      activeDeviceId: 'switch-1',
      activeDeviceType: 'switchL2',
      zoom: 1.0,
      pan: { x: 0, y: 0 },
      activeTab: 'topology'
    });
  }, [resetHistory, setDeviceStates, setDeviceOutputs, setPcOutputs, setPcHistories, setTopologyDevices, setTopologyConnections, setTopologyNotes, setActiveDeviceId, setActiveDeviceType, setSelectedDevice, setShowPCPanel, setActiveTab, setHasUnsavedChanges, setTopologyKey, setZoom, setPan]);

  const runWithSaveGuard = useCallback((action: () => void) => {
    if (hasUnsavedChanges) {
      setSaveDialog({
        show: true,
        message: t.unsavedChangesConfirm,
        onConfirm: (save: boolean) => {
          setSaveDialog(null);
          if (save) {
            handleSaveProject();
          }
          action();
        }
      });
      return;
    }
    setConfirmDialog({
      show: true,
      message: t.newProjectConfirm,
      action: 'new-project',
      onConfirm: () => {
        setConfirmDialog(null);
        action();
      }
    });
  }, [hasUnsavedChanges, handleSaveProject, setSaveDialog, setConfirmDialog, t.unsavedChangesConfirm, t.newProjectConfirm]);

  function handleNewProject() {
    if (isTopologyFullscreen) return; // Prevent new project in fullscreen
    setProjectSearchQuery(''); // Reset search when opening new project dialog
    setShowProjectPicker(true);
  }

  // Sync hostname changes between Topology and Simulator
  useEffect(() => {
    if (!topologyDevices) return;

    let topologyChanged = false;
    let simulatorChanged = false;
    const newDeviceStates = new Map(deviceStates);

    const updatedTopologyDevices = topologyDevices.map(device => {
      if (device.type === 'pc') return device;

      const deviceState = deviceStates.get(device.id);
      if (!deviceState) return device;

      // If simulator has a different hostname than topology, simulator wins (manual change via CLI/Panel)
      if (deviceState.hostname !== device.name) {
        // Special case: if simulator has default generic name and topology has specific name (initial load/create)
        const isDefaultCLIHostname = deviceState.hostname === 'Switch' || deviceState.hostname === 'Router';

        if (isDefaultCLIHostname && !device.name.includes('Router') && !device.name.includes('Switch')) {
          // This shouldn't really happen with current logic but keeping for safety
          // Usually topology has names like Switch-1, Router-1 which are also defaults
        }

        // If the simulator name changed, update topology
        topologyChanged = true;
        return { ...device, name: deviceState.hostname };
      }
      return device;
    });

    if (simulatorChanged) {
      setDeviceStates(newDeviceStates);
    }

    if (topologyChanged) {
      setTopologyDevices(updatedTopologyDevices);
      setHasUnsavedChanges(true);
    }
  }, [deviceStates, topologyDevices, setDeviceStates, setTopologyDevices, setHasUnsavedChanges]);

  // Sync services (HTTP, etc.) from deviceStates to topologyDevices
  useEffect(() => {
    if (!topologyDevices) return;

    let topologyChanged = false;

    const updatedTopologyDevices = topologyDevices.map(device => {
      const deviceState = deviceStates.get(device.id);
      if (!deviceState) return device;

      // Check if services state differs
      const currentServices = device.services || {};
      const stateServices = deviceState.services || {};

      // Check HTTP service
      const httpEnabledFromState = stateServices.http?.enabled;
      const httpEnabled = typeof httpEnabledFromState === 'boolean' ? httpEnabledFromState : currentServices.http?.enabled;
      const currentHttpEnabled = currentServices.http?.enabled || false;

      // Only sync when the simulator actually has an opinion; avoid forcing false when state is undefined
      if (typeof httpEnabled === 'boolean' && httpEnabled !== currentHttpEnabled) {
        topologyChanged = true;
        return {
          ...device,
          services: {
            ...currentServices,
            http: {
              ...currentServices.http,
              enabled: httpEnabled,
              content: currentServices.http?.content || ''
            }
          }
        };
      }

      return device;
    });

    if (topologyChanged) {
      setTopologyDevices(updatedTopologyDevices);
      setHasUnsavedChanges(true);
    }
  }, [deviceStates, topologyDevices, setTopologyDevices, setHasUnsavedChanges]);

  // Beforeunload event for unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle back/forward navigation
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as { tab?: TabType; deviceId?: string; program?: string; modal?: boolean } | null;

      // Close modals first
      setShowMobileMenu(false);
      setConfirmDialog(null);
      setSaveDialog(null);
      setShowPCPanel(false);
      setShowProjectPicker(false);
      setShowOnboarding(false);
      window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source: 'back' } }));

      // Handle navigation state
      if (state && state.tab) {
        isInternalNavRef.current = true;

        // Update history index
        currentNavIndexRef.current = Math.max(0, currentNavIndexRef.current - 1);

        // Navigate to the state
        if (state.tab === 'cmd' || state.tab === 'terminal') {
          if (state.deviceId) {
            setActiveDeviceId(state.deviceId);
            setActiveDeviceType(state.deviceId.startsWith('pc') ? 'pc' : state.deviceId.startsWith('router') ? 'router' : 'switchL2');
          }
          setActiveTab(state.tab);
        } else {
          setActiveTab(state.tab);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setShowMobileMenu, setConfirmDialog, setSaveDialog, setShowPCPanel, setShowProjectPicker, setShowOnboarding, setActiveTab, setActiveDeviceId, setActiveDeviceType]);

  // History pushState for back button tracking
  useEffect(() => {
    const anyModalOpen = showMobileMenu || !!confirmDialog || !!saveDialog || showPCPanel || showProjectPicker || showOnboarding;
    if (anyModalOpen && !modalHistoryPushedRef.current) {
      window.history.pushState({ modal: true }, '');
      modalHistoryPushedRef.current = true;
    }
    if (!anyModalOpen) {
      modalHistoryPushedRef.current = false;
    }
  }, [showMobileMenu, confirmDialog, saveDialog, showPCPanel, showProjectPicker, showOnboarding]);

  const [isTopologyFullscreen, setIsTopologyFullscreen] = useState(false);

  // Helper: tab açıklamaları (tooltip için)
  const getTabDescription = useCallback((tabId: TabType): string => {
    if (language === 'tr') {
      switch (tabId) {
        case 'topology':
          return 'Cihazları sürükleyip bırakarak ağ topolojisini tasarla.';
        case 'cmd':
          return 'PC komut satırı ile ping, ipconfig vb. komutları çalıştır.';
        case 'terminal':
          return 'Switch / router CLI üzerinden yapılandırma komutlarını çalıştır.';
        case 'tasks':
          return 'Port, VLAN ve güvenlik görevlerini tamamlayarak puan kazan.';
        default:
          return '';
      }
    } else {
      switch (tabId) {
        case 'topology':
          return 'Design your network by dragging and connecting devices.';
        case 'cmd':
          return 'Use the PC command line to run ping, ipconfig and more.';
        case 'terminal':
          return 'Configure switches/routers using the CLI terminal.';
        case 'tasks':
          return 'Complete port, VLAN, and security tasks to earn points.';
        default:
          return '';
      }
    }
  }, [language]);

  // Onboarding content + controls
  const onboardingSteps = [
    {
      title: t.tutorialWelcomeTitle,
      description: t.tutorialWelcomeDesc,
    },
    {
      title: t.tutorialTopologyTitle,
      description: t.tutorialTopologyDesc,
    },
    {
      title: t.tutorialCablesTitle,
      description: t.tutorialCablesDesc,
    },
    {
      title: t.tutorialDevicesTitle,
      description: t.tutorialDevicesDesc,
    },
    {
      title: t.tutorialPingTitle,
      description: t.tutorialPingDesc,
    },
    {
      title: t.tutorialWifiTitle,
      description: t.tutorialWifiDesc,
    },
    {
      title: t.tutorialProjectTitle,
      description: t.tutorialProjectDesc,
    },
    {
      title: t.tutorialThemeTitle,
      description: t.tutorialThemeDesc,
    },
    {
      title: t.tutorialReadyTitle,
      description: t.tutorialReadyDesc,
    },
  ];

  const closeOnboardingForever = useCallback(() => {
    try {
      localStorage.setItem('netsim_onboarding_seen', '1');
    } catch {
      // ignore
    }
    setShowOnboarding(false);
  }, [setShowOnboarding]);

  const nextOnboarding = useCallback(() => {
    if (onboardingStep >= onboardingSteps.length - 1) {
      closeOnboardingForever();
      return;
    }
    setOnboardingStep((s) => Math.min(s + 1, onboardingSteps.length - 1));
  }, [onboardingStep, onboardingSteps.length, closeOnboardingForever, setOnboardingStep]);

  const prevOnboarding = useCallback(() => {
    setOnboardingStep((s) => Math.max(0, s - 1));
  }, [setOnboardingStep]);

  // Derive visible tabs based on current state
  const tabs = ALL_TABS.filter(tab => {
    // Topology tab always visible
    if (tab.id === 'topology') return true;

    // Show other tabs only if a device is active and compatible
    return activeDeviceId && (topologyDevices.some(d => d.id === activeDeviceId)) && tab.showFor.includes(activeDeviceType);
  }).map(tab => ({
    ...tab,
    label: t[tab.labelKey as keyof typeof t] as string
  }));

  const handleTabHoverGlow = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }, []);

  // Refresh network connections and WiFi status
  const handleRefreshNetwork = useCallback(() => {
    const isSwitchDeviceType = (type: string) => type === 'switchL2' || type === 'switchL3';
    const normalizeWifiMode = (mode: string | undefined): 'ap' | 'client' | 'disabled' => {
      if (!mode) return 'disabled';
      const normalized = mode.toLowerCase().replace(/^wifi-/, '');
      if (normalized === 'client' || normalized === 'sta') return 'client';
      if (normalized === 'ap') return 'ap';
      return 'disabled';
    };
    const hasValidIp = (ip: string | undefined) => !!ip && ip !== '0.0.0.0' && ip !== '169.254.0.0';
    const ipToNumber = (ip: string): number | null => {
      const parts = ip.split('.').map((p) => Number(p));
      if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
      return ((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0);
    };
    const isIpInPoolRange = (ip: string, pool: { startIp: string; maxUsers: number }) => {
      const ipNum = ipToNumber(ip);
      const startNum = ipToNumber(pool.startIp);
      if (ipNum === null || startNum === null) return false;
      const maxUsers = Math.max(1, Number(pool.maxUsers || 1));
      return ipNum >= startNum && ipNum < (startNum + maxUsers);
    };
    const getEffectiveWifi = (device: CanvasDevice): CanvasDevice['wifi'] => {
      const state = deviceStates?.get(device.id);
      const wlan = state?.ports?.['wlan0'];
      const runtimeWifi = wlan?.wifi;
      if (!runtimeWifi) return device.wifi;

      const normalizedMode = normalizeWifiMode(runtimeWifi.mode);
      const enabled = !wlan.shutdown && normalizedMode !== 'disabled';
      const fallbackMode: 'ap' | 'client' = device.type === 'pc' ? 'client' : 'ap';
      const resolvedMode: 'ap' | 'client' = normalizedMode === 'disabled'
        ? (device.wifi?.mode || fallbackMode)
        : (normalizedMode === 'client' ? 'client' : 'ap');
      return {
        enabled,
        ssid: runtimeWifi.ssid || device.wifi?.ssid || '',
        security: runtimeWifi.security || device.wifi?.security || 'open',
        password: runtimeWifi.password || device.wifi?.password,
        channel: runtimeWifi.channel || device.wifi?.channel || '2.4GHz',
        mode: resolvedMode,
      };
    };

    let refreshCount = 0;
    let disconnectedPCs: string[] = [];
    let disconnectedAPs: string[] = [];
    let connectedPCs: string[] = [];
    let activeAPs: string[] = [];
    let dhcpServerActiveCount = 0;
    let dhcpServerNoPoolCount = 0;
    let dhcpClientWithLeaseCount = 0;
    let dhcpClientNoLeaseCount = 0;

    if (topologyDevices && deviceStates) {
      const refreshedDevices = topologyDevices.map((device) => ({
        ...device,
        wifi: getEffectiveWifi(device),
      }));

      // 1. Check and update PC connections to APs
      refreshedDevices.filter(d => d.type === 'pc').forEach(pc => {
        const pcWifi = pc.wifi;
        if (!pcWifi?.enabled || !pcWifi.ssid) return;

        let isConnected = false;

        // Check router/switch APs
        refreshedDevices.forEach(ap => {
          if (ap.id === pc.id) return;
          if (ap.type !== 'router' && !isSwitchDeviceType(ap.type)) return;

          const apWifi = ap.wifi;
          if (!apWifi || apWifi.mode !== 'ap' || !apWifi.ssid) return;
          if (apWifi.ssid !== pcWifi.ssid) return;

          const apSecurity = apWifi.security || 'open';
          const pcSecurity = pcWifi.security || 'open';
          if (apSecurity !== pcSecurity) return;
          if (apSecurity !== 'open' && apWifi.password !== pcWifi.password) return;

          isConnected = true;
        });

        if (isConnected) {
          connectedPCs.push(pc.name || pc.id);
        } else {
          disconnectedPCs.push(pc.name || pc.id);
        }
        refreshCount++;
      });

      // 2. Check and update AP connections (router/switch)
      refreshedDevices.filter(d => d.type === 'router' || isSwitchDeviceType(d.type)).forEach(ap => {
        const apWifi = ap.wifi;
        if (!apWifi || apWifi.mode !== 'ap' || !apWifi.ssid) return;

        let hasClient = false;

        // Check if any PC is connected to this AP
        refreshedDevices.forEach(pc => {
          if (pc.type !== 'pc') return;
          const pcWifi = pc.wifi;
          if (!pcWifi?.enabled || !pcWifi.ssid) return;
          if (pcWifi.ssid !== apWifi.ssid) return;

          const apSecurity = apWifi.security || 'open';
          const pcSecurity = pcWifi.security || 'open';
          if (apSecurity !== pcSecurity) return;
          if (apSecurity !== 'open' && apWifi.password !== pcWifi.password) return;

          hasClient = true;
        });

        if (hasClient) {
          activeAPs.push(ap.name || ap.id);
        } else {
          disconnectedAPs.push(ap.name || ap.id);
        }
        refreshCount++;
      });

      // 3. Build deterministic DHCP pool table across topology + runtime states
      const allDhcpPools: Array<{ startIp: string; maxUsers: number }> = [];
      refreshedDevices.forEach((device) => {
        const state = deviceStates.get(device.id);
        const topologyPools = device.services?.dhcp?.pools || [];
        const runtimePools = state?.services?.dhcp?.pools || [];
        const cliPools = Object.values(state?.dhcpPools || {}).map((pool: any) => {
          const networkPrefix = (pool?.network || '').split('.').slice(0, 3).join('.');
          return {
            startIp: pool?.startIp || (networkPrefix ? `${networkPrefix}.100` : ''),
            maxUsers: Number(pool?.maxUsers || 50),
          };
        }).filter((p: any) => p.startIp);

        topologyPools.forEach((p) => allDhcpPools.push({ startIp: p.startIp, maxUsers: Number(p.maxUsers || 50) }));
        runtimePools.forEach((p) => allDhcpPools.push({ startIp: p.startIp, maxUsers: Number(p.maxUsers || 50) }));
        cliPools.forEach((p: any) => allDhcpPools.push({ startIp: p.startIp, maxUsers: Number(p.maxUsers || 50) }));
      });

      // 4. Scan DHCP status across all devices
      refreshedDevices.forEach((device) => {
        const state = deviceStates.get(device.id);
        const topologyPools = device.services?.dhcp?.pools || [];
        const runtimePools = state?.services?.dhcp?.pools || [];
        const cliPools = state?.dhcpPools ? Object.keys(state.dhcpPools).length : 0;
        const dhcpEnabled = !!(device.services?.dhcp?.enabled || state?.services?.dhcp?.enabled);
        const poolCount = Math.max(topologyPools.length, runtimePools.length, cliPools);

        if (dhcpEnabled) {
          if (poolCount > 0) dhcpServerActiveCount++;
          else dhcpServerNoPoolCount++;
        }

        if (device.type === 'pc' && device.ipConfigMode === 'dhcp') {
          const runtimeIp = state?.ports?.['eth0']?.ipAddress || state?.ports?.['wlan0']?.ipAddress || '';
          const candidateIp = hasValidIp(device.ip) ? device.ip : runtimeIp;
          const hasDeterministicLease = hasValidIp(candidateIp) && allDhcpPools.some((pool) => isIpInPoolRange(candidateIp, pool));
          if (hasDeterministicLease) dhcpClientWithLeaseCount++;
          else dhcpClientNoLeaseCount++;
        }
      });

      // 5. Force update deviceStates to trigger re-render of all terminals and WiFi indicators
      const updatedDeviceStates = new Map(deviceStates);
      refreshedDevices.forEach(device => {
        const deviceState = updatedDeviceStates.get(device.id);
        if (deviceState) {
          updatedDeviceStates.set(device.id, { ...deviceState });
        }
      });
      setDeviceStates(updatedDeviceStates);

      // 6. Force update topology devices — each device gets a new object reference
      //    so NetworkTopology's WiFi signal useMemo re-evaluates for every device
      setTopologyDevices(refreshedDevices);

      // 7. Show detailed notification
      const totalDevices = connectedPCs.length + activeAPs.length + disconnectedPCs.length + disconnectedAPs.length;
      if (totalDevices > 0) {
        const wifiMessages = [];
        if (connectedPCs.length > 0) {
          wifiMessages.push(language === 'tr'
            ? `✓ ${connectedPCs.length} PC bağlı`
            : `✓ ${connectedPCs.length} PC connected`);
        }
        if (activeAPs.length > 0) {
          wifiMessages.push(language === 'tr'
            ? `✓ ${activeAPs.length} AP aktif`
            : `✓ ${activeAPs.length} AP active`);
        }
        if (disconnectedPCs.length > 0) {
          wifiMessages.push(language === 'tr'
            ? `⚠ ${disconnectedPCs.length} PC bağlantısız`
            : `⚠ ${disconnectedPCs.length} PC disconnected`);
        }
        if (disconnectedAPs.length > 0) {
          wifiMessages.push(language === 'tr'
            ? `⚠ ${disconnectedAPs.length} AP istemcisiz`
            : `⚠ ${disconnectedAPs.length} AP no clients`);
        }
        const dhcpMessages = [
          language === 'tr'
            ? `DHCP: ${dhcpServerActiveCount} sunucu aktif`
            : `DHCP: ${dhcpServerActiveCount} active servers`,
          language === 'tr'
            ? `${dhcpClientWithLeaseCount} istemci lease aldı`
            : `${dhcpClientWithLeaseCount} clients leased`,
        ];
        if (dhcpServerNoPoolCount > 0) {
          dhcpMessages.push(language === 'tr'
            ? `⚠ ${dhcpServerNoPoolCount} sunucuda havuz yok`
            : `⚠ ${dhcpServerNoPoolCount} servers no pool`);
        }
        if (dhcpClientNoLeaseCount > 0) {
          dhcpMessages.push(language === 'tr'
            ? `⚠ ${dhcpClientNoLeaseCount} istemci lease alamadı`
            : `⚠ ${dhcpClientNoLeaseCount} clients no lease`);
        }

        toast({
          title: language === 'tr' ? '🔄 WiFi + DHCP Durumu Güncellendi' : '🔄 WiFi + DHCP Status Updated',
          description: (
            <div className="space-y-1">
              {wifiMessages.length > 0 && <div>{wifiMessages.join(' • ')}</div>}
              <div>{dhcpMessages.join(' • ')}</div>
            </div>
          ),
          variant: 'default'
        });
      } else {
        const isDhcpMissing = dhcpServerActiveCount === 0 && dhcpClientWithLeaseCount === 0;
        const dhcpSummary = isDhcpMissing
          ? (language === 'tr' ? 'DHCP bulunamadı' : 'No DHCP found')
          : (language === 'tr'
            ? `DHCP: ${dhcpServerActiveCount} sunucu aktif, ${dhcpClientWithLeaseCount} lease`
            : `DHCP: ${dhcpServerActiveCount} active servers, ${dhcpClientWithLeaseCount} leases`);
        toast({
          title: language === 'tr' ? '🔄 Ağ Yenilendi' : '🔄 Network Refreshed',
          description: isDhcpMissing
            ? dhcpSummary
            : `${language === 'tr' ? 'WiFi cihazı bulunamadı' : 'No WiFi devices found'} • ${dhcpSummary}`,
          variant: 'default'
        });
      }
    }
  }, [topologyDevices, deviceStates, setDeviceStates, setTopologyDevices, toast, language]);

  // Handle key events: ESC to close, ENTER to confirm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F5 - Refresh network connections and WiFi status
      if (e.key === 'F5') {
        e.preventDefault();
        handleRefreshNetwork();
        return;
      }

      if (e.key === 'Escape') {
        setShowMobileMenu(false);
        setConfirmDialog(null);
        setSaveDialog(null);
        setShowPCPanel(false);
        setShowProjectPicker(false);
        setShowOnboarding(false);
        window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source: 'escape' } }));
      }

      // Ctrl Shortcuts
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();

        // Check if an input element is focused
        const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
        const isEditable = tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;

        // Print - switch to topology tab first
        if (key === 'p') {
          e.preventDefault();
          if (activeTabRef.current !== 'topology') {
            setActiveTab('topology');
            setTimeout(() => window.print(), 150);
          } else {
            window.print();
          }
        }

        // Only handle undo/redo in topology tab if no input is focused
        if (key === 'z') {
          if (activeTabRef.current === 'topology' && !isEditable) {
            e.preventDefault();
            handleUndo();
          }
        }
        if (key === 'y') {
          if (activeTabRef.current === 'topology' && !isEditable) {
            e.preventDefault();
            handleRedo();
          }
        }
        if (key === 's') {
          e.preventDefault();
          handleSaveProject();
        }
        if (key === 'o') {
          e.preventDefault();
          fileInputRef.current?.click();
        }
        if (key === 'n' && !e.shiftKey) {
          e.preventDefault();
          handleNewProject();
        }

        // Tab shortcuts Ctrl+1 to Ctrl+5
        if (['1', '2', '3', '4', '5'].includes(key)) {
          const index = parseInt(key) - 1;
          if (tabs[index]) {
            e.preventDefault();
            switchTabOrTopology(tabs[index].id);
          }
        }
      }

      // Shift Shortcuts
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'n') {
          e.preventDefault();
          if (!isTopologyFullscreen) {
            handleNewProject();
          }
        }
      }
      if (e.key === 'Enter') {
        if (confirmDialog?.show) {
          e.preventDefault();
          confirmDialog.onConfirm();
        } else if (saveDialog?.show) {
          e.preventDefault();
          saveDialog.onConfirm(true);
        } else if (activeTab === 'topology' && activeDeviceId && !activeDeviceId.startsWith('note-')) {
          // Open selected device with Enter key
          e.preventDefault();
          const device = topologyDevices.find(d => d.id === activeDeviceId);
          if (device) {
            handleDeviceDoubleClick(device.type, device.id);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Handle print dialog (from browser menu or Ctrl+P)
    const handleBeforePrint = () => {
      if (activeTabRef.current !== 'topology') {
        setActiveTab('topology');
      }
    };
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [showMobileMenu, confirmDialog, saveDialog, showPCPanel, showProjectPicker, handleSaveProject, handleNewProject, handleUndo, handleRedo, tabs, setShowMobileMenu, setConfirmDialog, setSaveDialog, setShowPCPanel, setShowProjectPicker, isTopologyFullscreen, setActiveTab, activeTab, topologyDevices, topologyConnections, deviceStates, setDeviceStates, handleDeviceDoubleClick, handleRefreshNetwork]);

  // Load project from JSON file
  const handleLoadProject = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const projectData = JSON.parse(e.target?.result as string);
        if (loadProjectData(projectData)) {
          setHasUnsavedChanges(false);
          toast({
            title: language === 'tr' ? 'Proje yüklendi' : 'Project loaded',
            description: language === 'tr' ? 'Dosya başarıyla içe aktarıldı.' : 'File imported successfully.',
          });
          // Reset zoom and pan to top-left
          setZoom(1.0);
          setPan({ x: 0, y: 0 });
          // Scroll to top
          if (topologyContainerRef.current) {
            topologyContainerRef.current.scrollTop = 0;
            topologyContainerRef.current.scrollLeft = 0;
          }
          window.scrollTo(0, 0);
        } else {
          toast({
            title: language === 'tr' ? 'Geçersiz proje dosyası' : 'Invalid project file',
            description: t.invalidProjectFile,
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: language === 'tr' ? 'Yükleme başarısız' : 'Load failed',
          description: formatErrorForUser(error as Error, t.failedLoadProject).userMessage,
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  }, [loadProjectData, setHasUnsavedChanges, t.invalidProjectFile, t.failedLoadProject, language, setZoom, setPan]);

  const applyExampleProject = useCallback((projectData: any) => {
    loadProjectData(projectData);
    setShowProjectPicker(false);

    // Reset zoom and pan to top-left
    setZoom(1.0);
    setPan({ x: 0, y: 0 });

    // Scroll to top
    if (topologyContainerRef.current) {
      topologyContainerRef.current.scrollTop = 0;
      topologyContainerRef.current.scrollLeft = 0;
    }
    window.scrollTo(0, 0);
  }, [loadProjectData, setShowProjectPicker, setZoom, setPan]);

  const isDark = (effectiveTheme ?? theme) === 'dark';

  // Helper function to truncate long names with an ellipsis
  const truncateWithEllipsis = useCallback((text: string, maxLength: number) => {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }, []);

  return (
    <AppErrorBoundary fallbackTitle={language === 'tr' ? 'Uygulama hatası' : 'Application error'}>
      <div className={`min-h-screen w-full flex flex-col relative transition-colors duration-700 ${isAppLoading ? 'bg-slate-950 overflow-hidden' : (isDark ? 'bg-slate-950' : 'bg-slate-50')}`}>
        {!isAppLoading && (
          <div className="fixed inset-0 pointer-events-none z-0 opacity-40 dark:opacity-20 transition-opacity duration-1000">
            <div className="absolute inset-0 mesh-gradient animate-liquid blur-[100px] scale-150 rotate-12" />
            <div className={`absolute inset-0 ${isDark ? 'bg-slate-950/40' : 'bg-white/40'}`} />
          </div>
        )}
        {/* App Loading Screen */}
        {isAppLoading && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950">
            <div className="flex flex-col items-center animate-scale-in">
              <div className="relative mb-8">
                <div className="p-2 animate-glitch">
                  <img src="/favicon.png" alt="Logo" className="w-16 h-16 object-contain" />
                </div>
                {/* Glitch overlays */}
                <div className="absolute inset-0 p-4 rounded-2xl bg-red-500/30 animate-glitch-skew mix-blend-screen" />
                <div className="absolute inset-0 p-4 rounded-2xl bg-blue-500/30 animate-glitch mix-blend-screen" style={{ animationDelay: '0.1s' }} />
              </div>

              <h2
                className="text-3xl font-black tracking-tighter text-white glitch-text mb-2 text-center"
                data-text="NETWORK SIMULATOR 2026"
              >
                NETWORK SIMULATOR 2026
              </h2>

              <div className="flex items-center gap-2 mt-4">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                <span className="text-xs font-bold tracking-[0.3em] text-cyan-500 ">
                  {t.initializingSystem}
                </span>
              </div>
            </div>

            {/* Background scanline effect */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%]" />
          </div>
        )}

        {/* Skeleton Loading State */}
        {showSkeleton && !isAppLoading && (
          <div className="fixed inset-0 z-[9998] bg-background">
            <AppSkeleton />
          </div>
        )}

        {/* Main Content with transition */}
        <div className="flex flex-col flex-1 animate-fade-in">
          {/* Header */}
          <header className={`liquid-glass sticky top-0 z-50 border-b px-5 py-3 pb-0`}>
            <div className="w-full">
              <div className="flex items-center justify-between">
                {/* Logo & Title */}
                <Button
                  variant="ghost"
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-3 p-2"
                  title={t.reloadPage}
                >
                  <div className="p-1 flex items-center justify-center">
                    <img src="/favicon.png" alt="Logo" className="w-7 h-7 object-contain" />
                  </div>
                  <div className="hidden md:flex flex-col">
                    <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent leading-none">
                      {t.title}
                    </h1>
                    <p className={`text-xs font-medium mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.subtitle}</p>
                  </div>
                </Button>

                {/* Total Score - Desktop */}
                <div className="hidden md:flex items-center gap-4">
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t.labProgress}
                      </span>
                      <span
                        key={totalScore}
                        className={`text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-full animate-scale-in ${totalScore >= maxScore * 0.7 ? 'bg-emerald-500/10 text-emerald-400' :
                          totalScore >= maxScore * 0.4 ? 'bg-amber-500/10 text-amber-400' :
                            'bg-rose-500/10 text-rose-400'
                          }`}
                      >
                        {Math.round((totalScore / maxScore) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-24 rounded-full overflow-hidden p-[px] ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full progress-fill"
                          style={{ '--progress-width': `${(totalScore / maxScore) * 100}%` } as React.CSSProperties}
                        />
                      </div>
                      <div className="flex items-baseline gap-0.5">
                        <span className={`text-xs font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {totalScore}
                        </span>
                        <span className={`text-[10px] font-bold opacity-30 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          /{maxScore}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Controls - Integrated Toolbar */}
                <div className="flex items-center gap-2">
                  {/* Unified Toolbar */}
                  <div className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                    {/* Undo/Redo Group */}
                    {activeTab === 'topology' && (
                      <div className="hidden items-center gap-1 sm:hidden">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className={`h-8 w-8 ui-hover-surface ${isDark ? 'text-slate-300 hover:text-blue-400' : 'text-slate-600 hover:text-blue-600'}`} onClick={handleUndo} disabled={hasHydrated && !canUndo}>
                              <Undo2 className={`w-4 h-4 ${!canUndo ? 'opacity-30' : ''}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t.undo}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className={`h-8 w-8 ui-hover-surface ${isDark ? 'text-slate-300 hover:text-blue-400' : 'text-slate-600 hover:text-blue-600'}`} onClick={handleRedo} disabled={hasHydrated && !canRedo}>
                              <Redo2 className={`w-4 h-4 ${!canRedo ? 'opacity-30' : ''}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t.redo}</TooltipContent>
                        </Tooltip>
                        <div className={`w-px h-4 mx-1 ${isDark ? 'bg-slate-700' : 'bg-slate-300'} hidden md:block`} />
                      </div>
                    )}

                    {/* Project Controls - Desktop only */}
                    <div className="hidden md:flex items-center">
                      <div className={cn("flex items-center rounded-lg border overflow-hidden", isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200')}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={cn("h-8 w-8 flex items-center justify-center transition-all hover:bg-slate-200/50", isDark ? 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50' : 'text-slate-600 hover:text-slate-900')}
                              onClick={handleNewProject}
                            >
                              <File className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t.newProject} (Alt+N)</TooltipContent>
                        </Tooltip>
                        <div className={cn("w-px h-4", isDark ? 'bg-slate-700' : 'bg-slate-200')} />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={cn("h-8 w-8 flex items-center justify-center transition-all hover:bg-slate-200/50", isDark ? 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50' : 'text-slate-600 hover:text-slate-900')}
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <FolderOpen className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t.loadProject} (Ctrl+O)</TooltipContent>
                        </Tooltip>
                        <div className={cn("w-px h-4", isDark ? 'bg-slate-700' : 'bg-slate-200')} />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={cn("h-8 w-8 flex items-center justify-center transition-all hover:bg-slate-200/50", isDark ? 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50' : 'text-slate-600 hover:text-slate-900')}
                              onClick={handleSaveProject}
                            >
                              <Save className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t.saveProject} (Ctrl+S)</TooltipContent>
                        </Tooltip>
                        <div className={cn("w-px h-4", isDark ? 'bg-slate-700' : 'bg-slate-200')} />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className={cn("h-8 w-8 flex items-center justify-center transition-all hover:bg-slate-200/50", isDark ? 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50' : 'text-slate-600 hover:text-slate-900')} onClick={() => setShowAboutModal(true)}>
                              <Info className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t.about}</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoadProject} className="hidden" />

                    {/* Info & Settings - Info button moved to Project Controls group */}
                    <div className={`w-px h-4 mx-1 ${isDark ? 'bg-slate-700' : 'bg-slate-300'} hidden md:block`} />
                    <button
                      onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
                      className={cn("text-xs font-black tracking-widest h-8 px-2 flex items-center gap-1 rounded-lg transition-all ui-hover-surface", isDark ? 'text-slate-300 hover:text-purple-400' : 'text-slate-600 hover:text-purple-600')}
                    >
                      <Languages className="w-4 h-4" />
                      {language.toUpperCase()}
                    </button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-all ui-hover-surface", isDark ? 'text-slate-300 hover:text-yellow-400' : 'text-slate-600 hover:text-yellow-600')}
                          onClick={() => setTheme(isDark ? 'light' : 'dark')}
                        >
                          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{isDark ? (language === 'tr' ? 'Açık Tema' : 'Light Mode') : (language === 'tr' ? 'Koyu Tema' : 'Dark Mode')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-all ui-hover-surface", graphicsQuality === 'high' ? (isDark ? 'text-slate-300 hover:text-green-400' : 'text-slate-600 hover:text-green-600') : (isDark ? 'text-slate-300 hover:text-orange-400' : 'text-slate-600 hover:text-orange-600'))}
                          onClick={() => setGraphicsQuality(graphicsQuality === 'high' ? 'low' : 'high')}
                        >
                          {graphicsQuality === 'high' ? <Sparkles className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{graphicsQuality !== 'high' ? (language === 'tr' ? 'Yüksek Çözünürlük' : 'High Resolution') : (language === 'tr' ? 'Düşük Çözünürlük' : 'Low Resolution')}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Mobile Menu */}
                <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="md:hidden">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'} p-0 w-72`}>
                    <SheetHeader className="p-4 text-left border-b border-slate-800/50">
                      <SheetTitle className="text-lg font-black flex items-center gap-2">
                        <div className="p-1 flex items-center justify-center">
                          <img src="/favicon.png" alt="Logo" className="w-5 h-5 object-contain" />
                        </div>
                        {t.title}
                      </SheetTitle>
                      <SheetDescription className="sr-only">
                        Main navigation and project controls
                      </SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-80px)]">
                      <div className="p-3 space-y-4">
                        {/* Quick actions (primary) */}
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/30 border-slate-800/50' : 'bg-slate-50 border-slate-200'}`}>
                          <p className="text-xs font-bold tracking-widest text-slate-500 mb-2 px-1">
                            {language === 'tr' ? 'Hızlı işlemler' : 'Quick actions'}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="secondary"
                              className="justify-start gap-2 h-9 text-xs font-bold"
                              onClick={() => { setShowProjectPicker(true); setShowMobileMenu(false); }}
                            >
                              <File className="w-3.5 h-3.5" /> {language === 'tr' ? 'Yeni' : 'New'}
                            </Button>
                            <Button
                              variant="secondary"
                              className="justify-start gap-2 h-9 text-xs font-bold"
                              onClick={() => { handleSaveProject(); setShowMobileMenu(false); }}
                            >
                              <Save className="w-3.5 h-3.5" /> {language === 'tr' ? 'Kaydet' : 'Save'}
                            </Button>
                            <Button
                              variant="secondary"
                              className="justify-start gap-2 h-9 text-xs font-bold"
                              onClick={() => { fileInputRef.current?.click(); setShowMobileMenu(false); }}
                            >
                              <FolderOpen className="w-3.5 h-3.5" /> {language === 'tr' ? 'Yükle' : 'Load'}
                            </Button>
                            <Button
                              variant="secondary"
                              className="justify-start gap-2 h-9 text-xs font-bold"
                              onClick={() => { setShowOnboarding(true); setOnboardingStep(0); setShowMobileMenu(false); }}
                            >
                              <Compass className="w-3.5 h-3.5" /> {language === 'tr' ? 'Tur' : 'Tour'}
                            </Button>
                          </div>
                        </div>

                        {/* Navigation Sections */}
                        <div className="space-y-1">
                          <p className="text-xs font-bold  tracking-widest text-slate-500 px-2 mb-1">{t.navigation}</p>
                          <div className="grid gap-0.5">
                            {ALL_TABS.map((tab) => {
                              const isTabVisible = tab.id === 'topology' || (activeDeviceId && tab.showFor.includes(activeDeviceType));
                              if (!isTabVisible) return null;

                              const isActive = activeTab === tab.id;
                              const label = t[tab.labelKey as keyof typeof t] as string;
                              return (
                                <Button
                                  key={tab.id}
                                  variant={isActive ? "secondary" : "ghost"}
                                  className={`w-full justify-start gap-3 h-9 px-3 text-xs font-bold ui-hover-surface ${isActive ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400'}`}
                                  onClick={() => {
                                    switchTabOrTopology(tab.id);
                                    setShowMobileMenu(false);
                                  }}
                                >
                                  <span className={`w-4 h-4 flex items-center justify-center ${isActive ? 'text-violet-400' : 'text-slate-500'}`}>
                                    {tab.icon}
                                  </span>
                                  {label}
                                </Button>
                              );
                            })}
                          </div>
                        </div>

                        <Separator className="bg-slate-800/30" />

                        {/* Language & Theme Controls - Mobile */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            className="justify-start gap-2 h-9 text-xs font-bold"
                            onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
                          >
                            <Languages className="w-3.5 h-3.5" />
                            {language === 'tr' ? 'English' : 'Türkçe'}
                          </Button>
                          <Button
                            variant="outline"
                            className="justify-start gap-2 h-9 text-xs font-bold"
                            onClick={() => setTheme(isDark ? 'light' : 'dark')}
                          >
                            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                            {isDark ? (language === 'tr' ? 'Açık Tema' : 'Light') : (language === 'tr' ? 'Koyu Tema' : 'Dark')}
                          </Button>
                        </div>

                        <Separator className="bg-slate-800/30" />

                        {/* Help Button */}
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-9 text-xs font-bold"
                          onClick={() => { setShowAboutModal(true); setShowMobileMenu(false); }}
                        >
                          <Info className="w-3.5 h-3.5" />
                          {language === 'tr' ? 'Yardım' : 'Help'}
                        </Button>

                        <Separator className="bg-slate-800/30" />

                        {/* Lab Progress Mobile */}
                        <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-800/30' : 'bg-slate-50'} border ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold tracking-[0.15em] text-slate-500">{t.labProgress}</span>
                            <span className="text-xs font-bold text-cyan-400">{Math.round((totalScore / maxScore) * 100)}%</span>
                          </div>
                          <div className={`h-1.5 w-full rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'} overflow-hidden mb-1.5`}>
                            <div
                              className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-all duration-500"
                              style={{ width: `${(totalScore / maxScore) * 100}%` }}
                            />
                          </div>
                          <p className={`text-center text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalScore} / {maxScore} {t.pts}</p>
                        </div>
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Desktop Tabs & Device Selector */}
            <div className="flex items-end gap-1 mt-4 pt-1 overflow-x-auto no-scrollbar">
              {/* Mobile-only Quick Action Tools (Add, Zoom & Connect) */}
              <div className="flex md:hidden items-center gap-1.5 mr-auto">
                {activeTab === 'topology' && (
                  <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                    {/* Add Button (Device, Cable, Note) */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="px-2.5 py-1.5 h-auto text-emerald-500 hover:bg-emerald-500/10"
                          onClick={() => {
                            const event = new CustomEvent('trigger-topology-palette');
                            window.dispatchEvent(event);
                          }}
                        >
                          <Plus className="w-5 h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{language === 'tr' ? 'Cihaz veya Kablo Ekle' : 'Add Device or Cable'}</TooltipContent>
                    </Tooltip>

                    <div className={`w-px h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} mx-0.5`} />

                    {/* Refresh Network Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-emerald-500 hover:bg-emerald-500/10"
                          onClick={handleRefreshNetwork}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{language === 'tr' ? 'Ağı Yenile (F5)' : 'Refresh Network (F5)'}</TooltipContent>
                    </Tooltip>

                    <div className={`w-px h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} mx-0.5`} />

                    {/* Connect Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-cyan-500 hover:bg-cyan-500/10"
                          onClick={() => {
                            const event = new CustomEvent('trigger-topology-connect');
                            window.dispatchEvent(event);
                          }}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 0 0 -5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0 -5.656-5.656l-1.1 1.1" />
                          </svg>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{language === 'tr' ? 'Cihazları Bagla' : 'Connect Devices'}</TooltipContent>
                    </Tooltip>

                    <div className={`w-px h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} mx-0.5`} />

                    {/* Environment Settings Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-emerald-500 hover:bg-emerald-500/10"
                          onClick={() => setIsEnvironmentPanelOpen(true)}
                        >
                          <Leaf className="w-5 h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{language === 'tr' ? 'Çevresel Ayarlar' : 'Environment Settings'}</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>

              {/* Desktop-only Quick Action Tools (Add, Refresh & Connect) */}
              <div className="hidden items-center gap-1.5 ml-auto">
                {activeTab === 'topology' && (
                  <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                    {/* Add Button (Device, Cable, Note) */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="px-2.5 py-1.5 h-auto text-emerald-500 hover:bg-emerald-500/10"
                          onClick={() => {
                            const event = new CustomEvent('trigger-topology-palette');
                            window.dispatchEvent(event);
                          }}
                        >
                          <Plus className="w-5 h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{language === 'tr' ? 'Cihaz veya Kablo Ekle' : 'Add Device or Cable'}</TooltipContent>
                    </Tooltip>

                    <div className={`w-px h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} mx-0.5`} />

                    {/* Refresh Network Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-emerald-500 hover:bg-emerald-500/10"
                          onClick={handleRefreshNetwork}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{language === 'tr' ? 'Ağı Yenile (F5)' : 'Refresh Network (F5)'}</TooltipContent>
                    </Tooltip>

                    <div className={`w-px h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} mx-0.5`} />

                    {/* Connect Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-cyan-500 hover:bg-cyan-500/10"
                          onClick={() => {
                            const event = new CustomEvent('trigger-topology-connect');
                            window.dispatchEvent(event);
                          }}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 0 0 -5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0 -5.656-5.656l-1.1 1.1" />
                          </svg>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{language === 'tr' ? 'Cihazları Bagla' : 'Connect Devices'}</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>

              {/* Active Device Dropdown - Always show if component is rendered */}
              <DropdownMenu onOpenChange={(open) => { if (!open) setDeviceSearchQuery(''); }}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all ${isDark
                      ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-600'
                      : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-400'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      {activeDeviceId && (topologyDevices.some(d => d.id === activeDeviceId)) ? (
                        <>
                          {(() => {
                            const activeTopologyDevice = topologyDevices.find(d => d.id === activeDeviceId);
                            const status = activeTopologyDevice?.status || 'online';
                            const statusColor =
                              status === 'offline'
                                ? 'bg-rose-500'
                                : status === 'online'
                                  ? 'bg-emerald-400'
                                  : 'bg-amber-400';
                            const statusLabel =
                              language === 'tr'
                                ? status === 'offline'
                                  ? 'Kapalı'
                                  : status === 'online'
                                    ? 'Çevrimiçi'
                                    : 'Bilinmeyen'
                                : status === 'offline'
                                  ? 'Offline'
                                  : status === 'online'
                                    ? 'Online'
                                    : 'Unknown';
                            return (
                              <>
                                <span
                                  className="w-2 h-2 rounded-full mr-0.5"
                                  title={statusLabel}
                                >
                                  <span className={`block w-2 h-2 rounded-full ${statusColor} shadow-[0_0_6px_rgba(45,212,191,0.8)]`} />
                                </span>
                                <DeviceIcon
                                  type={activeDeviceType}
                                  switchModel={activeTopologyDevice?.switchModel}
                                  className="w-5 h-5"
                                />
                                <span className="text-xs font-bold">
                                  {truncateWithEllipsis(deviceStates.get(activeDeviceId)?.hostname || activeDeviceId, 15)}
                                </span>
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-bold text-slate-500">
                            {t.selectDeviceDropdown}
                          </span>
                        </>
                      )}
                    </div>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'} w-48`}>
                  <DropdownMenuLabel className="text-[11px] font-bold  tracking-widest text-slate-500 py-2">
                    {topologyDevices.length > 0 ? t.selectDevice : t.addDevicesFirst}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {topologyDevices.length > 0 && (
                    <div className="px-2 pb-1.5">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                        <Input
                          value={deviceSearchQuery}
                          onChange={e => setDeviceSearchQuery(e.target.value)}
                          placeholder={language === 'tr' ? 'Ara...' : 'Search...'}
                          className="h-7 pl-6 pr-7 text-xs"
                          autoFocus
                          onKeyDown={e => e.stopPropagation()}
                        />
                        {deviceSearchQuery && (
                          <button
                            onClick={() => setDeviceSearchQuery('')}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <ScrollArea className={topologyDevices.length > 0 ? "h-56" : "h-auto"}>
                    {topologyDevices.length > 0 ? (
                      topologyDevices
                        .filter(device => {
                          if (!deviceSearchQuery.trim()) return true;
                          const q = deviceSearchQuery.toLowerCase();
                          const name = (deviceStates.get(device.id)?.hostname || device.name).toLowerCase();
                          return name.includes(q) || device.type.toLowerCase().includes(q);
                        })
                        .map((device) => {
                          const currentDeviceState = deviceStates.get(device.id);
                          const displayName = currentDeviceState?.hostname || device.name;
                          const status = device.status || 'online';
                          const statusColor =
                            status === 'offline'
                              ? 'bg-rose-500'
                              : status === 'online'
                                ? 'bg-emerald-400'
                                : 'bg-amber-400';

                          return (
                            <DropdownMenuItem
                              key={device.id}
                              className={`flex items-center gap-2 py-1.5 cursor-pointer ${activeDeviceId === device.id ? 'bg-violet-500/10 text-violet-400' : ''}`}
                              onClick={() => { handleDeviceSelectFromMenu(device.type, device.id, device.switchModel, device.name); setDeviceSearchQuery(''); }}
                            >
                              <div className="flex items-center gap-2 cursor-pointer">
                                <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                                <DeviceIcon
                                  type={device.type}
                                  switchModel={device.switchModel}
                                  className="w-5 h-5"
                                />
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold leading-none">{truncateWithEllipsis(displayName, 12)}</span>
                                  <span className="text-[10px] opacity-50 capitalize">{device.type}</span>
                                </div>
                              </div>
                            </DropdownMenuItem>
                          );
                        })
                    ) : (
                      <div className="p-3 text-center text-[11px] text-slate-500 italic">
                        {t.noDevicesInTopology}
                      </div>
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Main Tabs (Adaptive: Icons on small, Icon+Text on large) */}
              <div className="hidden md:flex items-end gap-1">
                {tabs.map((tab, index) => {
                  const isActive = activeTab === tab.id;
                  // Unified Color Mapping
                  const tabColors: Record<string, string> = {
                    topology: 'text-blue-500 hover:text-blue-400',
                    cmd: 'text-emerald-500 hover:text-emerald-400',
                    terminal: 'text-emerald-500 hover:text-emerald-400',
                    tasks: 'text-red-500 hover:text-red-400',
                  }; const colorClass = tabColors[tab.id] || 'text-slate-500 hover:text-slate-400';

                  return (
                    <Tooltip key={tab.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => switchTabOrTopology(tab.id)}
                          onMouseMove={handleTabHoverGlow}
                          style={{ ['--mx' as any]: '50%', ['--my' as any]: '50%' }}
                          className={`group relative overflow-hidden flex items-center gap-2 px-3 lg:px-5 py-3 rounded-t-xl text-sm font-semibold transition-all border-x border-t min-w-[50px] lg:min-w-[120px] justify-center ui-hover-surface ${isActive
                            ? `${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'} ${colorClass.split(' ')[0]} shadow-[0_-4px_0_0_currentColor]`
                            : `${isDark ? 'bg-slate-900/50 border-transparent' : 'bg-slate-200/50 border-transparent'} ${colorClass}`
                            }`}
                        >
                          <span
                            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            style={{
                              background: `radial-gradient(130px circle at var(--mx) var(--my), ${isDark ? 'rgba(34,211,238,0.2)' : 'rgba(14,165,233,0.18)'}, transparent 65%)`
                            }}
                          />
                          <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                            {tab.id === 'topology' ? <Network className="w-4 h-4" /> :
                              (tab.id === 'cmd' || tab.id === 'terminal') ? <TerminalIcon className="w-4 h-4" /> :
                                <ShieldCheck className="w-4 h-4" />}
                          </span>
                          <span className="hidden md:inline-flex items-center gap-1.5">
                            {tab.label}
                            {tab.id === 'tasks' && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-300">
                                {completedTasks}/{ALL_TABS.find(t => t.id === 'tasks')?.tasks.length}
                              </span>
                            )}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="flex flex-col gap-1">
                        <span>{tab.label} (Ctrl+{index + 1})</span>
                        <span className="font-normal text-xs opacity-75">{getTabDescription(tab.id)}</span>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </header>
          {/* Mobile Bottom Tab Bar (Icons Only) */}
          <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl flex items-center justify-around px-2 py-1 mobile-top-nav ${isDark ? 'bg-slate-900/95 border-slate-800 text-slate-400' : 'bg-white/95 border-slate-200 text-slate-500'
            } ${showProjectPicker || showOnboarding ? 'hidden' : ''}`}>
            {tabs.map((tab, index) => {
              const isActive = activeTab === tab.id;

              const tabColors: Record<string, string> = {
                topology: 'text-blue-500 hover:text-blue-500',
                cmd: 'text-blue-500 hover:text-blue-500',
                terminal: 'text-emerald-500 hover:text-emerald-600',
                tasks: 'text-red-500 hover:text-red-600',
              };
              const colorClass = tabColors[tab.id] || 'text-slate-500 hover:text-slate-600';

              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => switchTabOrTopology(tab.id)}
                      onMouseMove={handleTabHoverGlow}
                      style={{ ['--mx' as any]: '50%', ['--my' as any]: '50%' }}
                      className={`group flex flex-col items-center justify-center min-h-[40px] flex-1 px-3 py-1.5 rounded-xl transition-all relative overflow-hidden ui-hover-surface ${isActive ? 'text-blue-500' : `${colorClass} active:scale-95`
                        }`}
                    >
                      <span
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{
                          background: `radial-gradient(90px circle at var(--mx) var(--my), ${isDark ? 'rgba(34,211,238,0.24)' : 'rgba(14,165,233,0.2)'}, transparent 68%)`
                        }}
                      />
                      {isActive && (
                        <div className="absolute inset-0 bg-blue-500/10 rounded-xl animate-scale-in" />
                      )}
                      <div className={`relative z-10 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                        {tab.id === 'topology' ? <Network className="w-4 h-4" /> :
                          (tab.id === 'cmd' || tab.id === 'terminal') ? <TerminalIcon className="w-4 h-4" /> :
                            <ShieldCheck className="w-4 h-4" />}
                      </div>
                      <span className="mt-0.5 text-[9px] font-semibold leading-tight relative z-10 md:inline">
                        {tab.label}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{tab.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <Dialog open={showProjectPicker} onOpenChange={(open) => { setShowProjectPicker(open); if (!open) setProjectSearchQuery(''); }}>
            <DialogContent className={`liquid-glass-strong w-[98vw] max-w-[1400px] h-[95vh] max-h-[1000px] p-0 overflow-hidden flex flex-col shadow-2xl rounded-none md:rounded-3xl`}>
              <div className='flex flex-col flex-1 overflow-hidden h-full max-w-full'>
                <div className='p-4 md:p-8 pb-2 md:pb-4 space-y-4'>
                  <div className='rounded-2xl md:rounded-3xl border border-transparent bg-gradient-to-r  p-4 md:p-6 '>
                    <DialogTitle className='text-xl bg-gradient-to-br from-white to-slate-900 bg-clip-text text-transparent break-words'>{language === 'tr' ? 'Yeni Proje Aç' : 'Open a New Project'}</DialogTitle>
                    <DialogDescription className="sr-only">
                      {language === 'tr'
                        ? 'Yeni proje penceresi: boş projeyle başlayın veya hazır örneklerden birini seçin.'
                        : 'New project dialog: start with an empty project or choose one of the ready examples.'}
                    </DialogDescription>
                  </div>

                  {/* Search Box */}
                  <div className={`relative rounded-xl border px-4 py-2.5 flex items-center gap-2 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white/50 border-slate-200/60'}`}>
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={projectSearchQuery}
                      placeholder={language === 'tr' ? 'Proje ara...' : 'Search projects...'}
                      onChange={(e) => setProjectSearchQuery(e.target.value)}
                      autoFocus
                      className={`flex-1 bg-transparent outline-none text-sm ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (!projectSearchQuery.trim()) {
                            setShowProjectPicker(false);
                            runWithSaveGuard(() => { resetToEmptyProject(); });
                          } else {
                            // Find the first filtered project across all levels
                            let firstProject: any = null;
                            for (const level of exampleLevelOrder) {
                              const projects = groupedExampleProjects[level] || [];
                              const filtered = projects.filter(project =>
                                project.title.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                                project.description.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                                project.tag.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                                (project.detail && project.detail.toLowerCase().includes(projectSearchQuery.toLowerCase()))
                              );
                              if (filtered.length > 0) {
                                firstProject = filtered[0];
                                break;
                              }
                            }

                            if (firstProject) {
                              setShowProjectPicker(false);
                              runWithSaveGuard(() => applyExampleProject(firstProject.data));
                            }
                          }
                        }
                      }}
                    />
                    {projectSearchQuery && (
                      <button
                        onClick={() => setProjectSearchQuery('')}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className='flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-12 pb-12 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent'>
                  <div className='flex flex-col gap-12 max-w-full'>
                    {/* Top Section: Start from Scratch */}
                    <div className='w-full'>
                      <div className='rounded-[2.5rem] border border-slate-200/70 bg-white/70 p-1 shadow-xl shadow-slate-900/5 dark:border-slate-800/60 dark:bg-slate-900/60'>
                        <Button
                          variant='outline'
                          className={`group relative flex h-auto min-h-[110px] md:h-[160px] w-full flex-col md:flex-row items-center justify-between gap-4 md:gap-8 rounded-[2.2rem] border-0 px-6 md:px-10 py-6 text-left transition-all hover:scale-[1.005] active:scale-95 duration-500 ${isDark ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl' : 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-xl shadow-blue-500/20'}`}
                          onClick={() => { setShowProjectPicker(false); runWithSaveGuard(() => { resetToEmptyProject(); }); }}
                        >
                          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 flex-1">
                            <div className="w-12 h-12 md:w-20 md:h-20 rounded-3xl bg-white/10 flex items-center justify-center group-hover:rotate-12 transition-transform duration-700 backdrop-blur-md shrink-0">
                              <Plus className="w-6 h-6 md:w-10 md:h-10" />
                            </div>
                            <div className="text-center md:text-left">
                              <p className='text-xl md:text-3xl font-black mb-1 md:mb-3 tracking-tighter'>{language === 'tr' ? 'Boş Proje' : 'Empty Project'}</p>
                              <p className={`text-[11px] md:text-sm ${isDark ? 'text-slate-300/80' : 'text-white/80'} break-words`}>
                                {language === 'tr'
                                  ? 'Topolojini kur, senaryonu tasarla.'
                                  : 'Build your topology, design a scenario.'}
                              </p>
                            </div>
                          </div>

                          <div className="absolute bottom-0 left-10 right-10 h-1.5 bg-white/5 rounded-t-full overflow-hidden">
                            <div className="w-0 group-hover:w-full h-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(34,211,238,0.6)]" />
                          </div>
                        </Button>
                      </div>
                    </div>

                    {/* Bottom Section: Examples organized in levels */}
                    <div className='flex flex-col gap-16'>
                      {exampleLevelOrder.map((level) => {
                        const projects = groupedExampleProjects[level];
                        if (!projects || projects.length === 0) return null;

                        // Filter projects based on search query
                        const filteredProjects = projectSearchQuery.trim() === ''
                          ? projects
                          : projects.filter(project =>
                            project.title.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                            project.description.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                            project.tag.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                            (project.detail && project.detail.toLowerCase().includes(projectSearchQuery.toLowerCase()))
                          );

                        if (filteredProjects.length === 0) return null;

                        return (
                          <section key={level} className='space-y-4 md:space-y-6 w-full'>
                            <div className='flex items-center gap-3 md:gap-4 px-1 md:px-2'>
                              <p className='text-[10px] md:text-xs font-black  tracking-[0.3em] md:tracking-[0.4em] text-slate-500 dark:text-slate-400 whitespace-nowrap'>
                                {exampleLevelLabels[level]}
                              </p>
                              <p className={`text-[10px] md:text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'} truncate`}>
                                {exampleLevelHints[level]}
                              </p>
                              <div className={`h-px flex-1 ${isDark ? 'bg-slate-800/60' : 'bg-slate-200'}`} />
                            </div>

                            <div className='grid grid-cols-1 gap-6 w-full max-w-full'>
                              {filteredProjects.map((example) => (
                                <Button
                                  key={example.id}
                                  variant='ghost'
                                  className={`group h-auto min-h-[120px] md:min-h-[160px] flex-col items-start gap-3 md:gap-5 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border-2 text-left transition-all duration-300 hover:translate-y-[-4px] active:scale-[0.98] ${isDark ? 'border-slate-800/40 bg-slate-900/20 hover:bg-slate-900/80 hover:border-cyan-500/30' : 'border-slate-200/50 bg-white hover:bg-slate-50 hover:border-blue-500/20'} w-full overflow-hidden shadow-sm hover:shadow-2xl`}
                                  onClick={() => { setShowProjectPicker(false); runWithSaveGuard(() => applyExampleProject(example.data)); }}
                                >
                                  <div className='flex items-center justify-between w-full gap-4 overflow-hidden flex-nowrap'>
                                    <span className={`font-black text-base md:text-2xl leading-none transition-colors duration-300 break-words flex-1 min-w-0 ${isDark ? 'group-hover:text-cyan-400' : 'group-hover:text-blue-600'}`}>{example.title}</span>
                                    <span className={`text-[8px] md:text-[10px] font-black  tracking-[0.2em] px-3 py-1.5 rounded-full whitespace-nowrap border shrink-0 flex-shrink-0 ${isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{example.tag}</span>
                                  </div>
                                  <p className={`text-[11px] md:text-sm leading-relaxed font-medium italic transition-colors whitespace-normal break-words break-all w-full ${isDark ? 'text-slate-400/80 group-hover:text-slate-200' : 'text-slate-600 group-hover:text-slate-800'}`}>{example.description}</p>
                                  {example.detail && (
                                    <div className='mt-auto pt-2 md:pt-4 flex items-center gap-2 md:gap-3 w-full border-t border-slate-800/10 dark:border-slate-800/50'>
                                      <div className='w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-amber-500 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.5)]' />
                                      <span className={`text-[8px] md:text-[11px] font-bold tracking-wide whitespace-normal break-words break-all w-full ${isDark ? 'text-amber-400/80' : 'text-amber-700/80'}`}>{example.detail}</span>
                                    </div>
                                  )}
                                </Button>
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>


          <Dialog
            open={showOnboarding}
            onOpenChange={(open) => {
              if (!open) closeOnboardingForever();
              else setShowOnboarding(true);
            }}
          >
            <DialogContent className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} sm:max-w-2xl md:max-w-3xl p-0 overflow-hidden`}>
              {/* Progress Bar */}
              <div className="w-full h-1 bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${((onboardingStep + 1) / onboardingSteps.length) * 100}%` }}
                />
              </div>

              <DialogHeader className="px-8 pt-6 pb-2">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <DialogTitle className={`text-2xl md:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {onboardingSteps[onboardingStep]?.title}
                  </DialogTitle>
                  <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${isDark ? 'bg-slate-800 text-cyan-400 border border-slate-700' : 'bg-slate-100 text-cyan-600 border border-slate-200'}`}>
                    {onboardingStep + 1} / {onboardingSteps.length}
                  </span>
                </div>
                <DialogDescription className={`text-base md:text-lg leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {onboardingSteps[onboardingStep]?.description}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between gap-4 px-8 py-6 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 mt-4">
                <Button variant="ghost" onClick={closeOnboardingForever} className="text-xs font-semibold">
                  {language === 'tr' ? 'Geç' : 'Skip'}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={prevOnboarding}
                    disabled={onboardingStep === 0}
                    className="text-xs font-semibold"
                  >
                    {language === 'tr' ? 'Geri' : 'Back'}
                  </Button>
                  <Button onClick={nextOnboarding} className="text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white">
                    {onboardingStep >= onboardingSteps.length - 1
                      ? (language === 'tr' ? 'Bitir' : 'Finish')
                      : (language === 'tr' ? 'İleri' : 'Next')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Global Dialogs (AlertDialog for better z-index and standard behavior) */}
          <AlertDialog open={!!confirmDialog} onOpenChange={(open) => {
            if (!open) {
              setConfirmDialog(null);
              focusActiveTerminalInput();
            }
          }}>
            <AlertDialogContent className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
              <AlertDialogHeader>
                <AlertDialogTitle className={isDark ? 'text-white' : 'text-slate-900'}>
                  {t.confirmationRequired}
                </AlertDialogTitle>
                <AlertDialogDescription className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  {confirmDialog?.message}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className={isDark ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : ''}>
                  {t.cancel}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    confirmDialog?.onConfirm();
                    focusActiveTerminalInput();
                  }}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {t.continue}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={!!saveDialog} onOpenChange={(open) => {
            if (!open) {
              setSaveDialog(null);
              focusActiveTerminalInput();
            }
          }}>
            <AlertDialogContent className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
              <AlertDialogHeader>
                <AlertDialogTitle className={isDark ? 'text-white' : 'text-slate-900'}>
                  {language === 'tr' ? 'Projeyi Kaydet' : 'Save Project'}
                </AlertDialogTitle>
                <AlertDialogDescription className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  {saveDialog?.message}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    saveDialog?.onConfirm(false);
                    focusActiveTerminalInput();
                  }}
                  className={isDark ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : ''}
                >
                  {t.dontSave}
                </Button>
                <AlertDialogAction
                  onClick={() => {
                    saveDialog?.onConfirm(true);
                    focusActiveTerminalInput();
                  }}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {t.saveLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col min-h-0 md:pb-[68px] md:overflow-hidden">
            <div className={`${activeTab === 'topology' ? 'p-0 pb-0 sm:pb-0' : 'p-0'} w-full flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden md:overflow-hidden`}>
              {/* Tab Content - Always render but hide non-active */}
              <div className={`flex-1 flex flex-col min-h-0 h-full ${activeTab === 'topology' ? 'block' : 'hidden'} print:block`}>
                {/* Network Topology fills remaining space */}
                <div ref={topologyContainerRef} className="flex-1 w-full h-full min-h-0 print:hidden">
                  <NetworkTopology
                    key={topologyKey}
                    cableInfo={cableInfo}
                    onCableChange={setCableInfo}
                    selectedDevice={selectedDevice}
                    onDeviceSelect={handleDeviceSelectFromCanvas}
                    onDeviceDoubleClick={handleDeviceDoubleClick}
                    onDeviceDelete={handleDeviceDelete}
                    onDeviceRename={handleDeviceRename}
                    initialDevices={topologyDevices || undefined}
                    initialConnections={topologyConnections || undefined}
                    initialNotes={topologyNotes || undefined}
                    isActive={activeTab === 'topology'}
                    activeDeviceId={activeDeviceId}
                    deviceStates={deviceStates}
                    isFullscreen={isTopologyFullscreen}
                    onFullscreenChange={setIsTopologyFullscreen}
                    zoom={zoom}
                    onZoomChange={setZoom}
                    pan={pan}
                    onPanChange={setPan}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onRefreshNetwork={handleRefreshNetwork}
                  />

                  {/* PC Info Popover - Bottom Right Mini Panel */}
                  {activeDeviceId && activeDeviceId.startsWith('pc-') && topologyDevices && (() => {
                    const pc = topologyDevices.find(d => d.id === activeDeviceId);
                    if (!pc) return null;
                    return (
                      <div className="hidden md:block fixed bottom-24 right-4 z-50 animate-scale-in">
                        <div className={`rounded-2xl border shadow-2xl backdrop-blur-xl min-w-[200px] max-w-[260px] liquid-glass-strong ${isDark ? 'border-slate-700/50 text-white shadow-cyan-500/10' : 'border-slate-200/50 text-slate-900 shadow-slate-200/50'}`}>
                          <div className={`flex items-center justify-between px-2 py-1.5 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200/50'}`}>
                            <div className="flex items-center gap-1.5">
                              <Monitor className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-[10px] font-black tracking-wider uppercase opacity-30">{pc.name || pc.id}</span>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedDevice(null);
                                setActiveDeviceId('');
                              }}
                              className={`p-0.5 rounded hover:bg-slate-500/20 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="p-2 space-y-1 text-[10px]">
                            <div className="flex justify-between items-center">
                              <span className="opacity-50">IP</span>
                              <span className="font-mono text-blue-500">{pc.ip || '0.0.0.0'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="opacity-50">Subnet</span>
                              <span className="font-mono opacity-80">{pc.subnet || '255.255.255.0'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="opacity-50">GW</span>
                              <span className="font-mono opacity-80">{pc.gateway || '0.0.0.0'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="opacity-50">MAC</span>
                              <span className="font-mono opacity-30 text-[9px]">{pc.macAddress || 'N/A'}</span>
                            </div>
                            {pc.wifi && pc.wifi.enabled && (
                              <div className="pt-1 border-t border-slate-500/20">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="opacity-50">WiFi</span>
                                  <span className="text-[8px] font-bold text-purple-500">{language === 'tr' ? 'Aktif' : 'Active'}</span>
                                </div>
                                <div className="flex gap-2 text-[9px]">
                                  <span className="opacity-50">SSID:</span>
                                  <span className="font-mono">{pc.wifi.ssid || '-'}</span>
                                </div>
                                <div className="flex gap-2 text-[9px]">
                                  <span className="opacity-50">{language === 'tr' ? 'Kanal' : 'Ch'}</span>
                                  <span className="font-mono">{pc.wifi.channel || '-'}</span>
                                  <span className="opacity-50">|</span>
                                  <span className="font-mono uppercase">{pc.wifi.security || '-'}</span>
                                </div>
                                {(() => {
                                  const strength = getWirelessSignalStrength(pc, topologyDevices, deviceStates);
                                  const pctMap: Record<number, string> = { 0: '0%', 1: '1%', 2: '25%', 3: '50%', 4: '75%', 5: '100%' };
                                  const colorMap: Record<number, string> = { 0: 'text-slate-400', 1: 'text-rose-500', 2: 'text-orange-500', 3: 'text-yellow-500', 4: 'text-emerald-500', 5: 'text-emerald-500' };
                                  if (strength === 0) return null;
                                  return (
                                    <div className="flex justify-between items-center text-[9px] mt-0.5">
                                      <span className="opacity-50">{language === 'tr' ? 'Sinyal' : 'Signal'}</span>
                                      <span className={`font-bold ${colorMap[strength]}`}>{pctMap[strength]}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                            {pc.services && (
                              <div className="pt-1 border-t border-slate-500/20">
                                <div className="flex justify-between items-center mb-0.5">
                                  <span className="opacity-50">{language === 'tr' ? 'Servisler' : 'Services'}</span>
                                  <div className="flex flex-wrap gap-0.5">
                                    {pc.services.http?.enabled && (
                                      <span className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[8px] font-bold border border-amber-500/20">HTTP</span>
                                    )}
                                    {pc.services.dns?.enabled && (
                                      <span className="px-1 py-0.5 rounded bg-blue-500/20 text-blue-500 text-[8px] font-bold border border-blue-500/20">DNS</span>
                                    )}
                                    {pc.services.dhcp?.enabled && (
                                      <span className="px-1 py-0.5 rounded bg-purple-500/20 text-purple-500 text-[8px] font-bold border border-purple-500/20">DHCP</span>
                                    )}
                                    {!pc.services.http?.enabled && !pc.services.dns?.enabled && !pc.services.dhcp?.enabled && (
                                      <span className="text-[8px] opacity-40 italic">{language === 'tr' ? 'Yok' : 'None'}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="pt-1 border-t border-slate-500/20">
                              <div className="flex justify-between items-center">
                                <span className="opacity-50">{language === 'tr' ? 'IP Modu' : 'IP Mode'}</span>
                                <span className={`text-[8px] font-bold tracking-wider ${pc.ipConfigMode === 'dhcp' ? 'text-green-500' : 'opacity-60'}`}>
                                  {pc.ipConfigMode === 'dhcp' ? 'DHCP' : (language === 'tr' ? 'STATIK' : 'STATIC')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className={`px-2 py-1.5 border-t ${isDark ? 'border-slate-700/50' : 'border-slate-200/50'}`}>
                            <button
                              onClick={() => {
                                handleDeviceDoubleClick(pc.type, pc.id);
                              }}
                              className={`w-full py-1 rounded-lg text-[10px] font-bold transition-colors ${isDark ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                            >
                              {language === 'tr' ? 'CMD Aç' : 'Open CMD'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* CMD Terminal Sekmesi */}
              {/* CMD Terminal Sekmesi - Always mounted, hidden via CSS */}
              <div className={`w-full animate-fade-in ${activeTab === 'cmd' ? 'flex' : 'hidden'}`}>
                <PCPanel
                  key={`pc-panel-${activeDeviceId}`}
                  deviceId={activeDeviceId}
                  cableInfo={cableInfo}
                  isVisible={activeTab === 'cmd'}
                  onClose={() => setActiveTab('topology')}
                  onTogglePower={toggleDevicePower}
                  topologyDevices={topologyDevices || undefined}
                  topologyConnections={topologyConnections || undefined}
                  deviceStates={deviceStates}
                  deviceOutputs={deviceOutputs}
                  pcOutputs={pcOutputs}
                  pcHistories={pcHistories}
                  onUpdatePCHistory={handleUpdatePCHistory}
                  onExecuteDeviceCommand={handleExecuteCommand}
                  onNavigate={handlePCPanelNavigate}
                  onDeleteDevice={handleDeviceDelete}
                />
              </div>

              {/* Terminal Sekmesi - Always mounted, hidden via CSS */}
              <div className={`flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar animate-fade-in ${activeTab === 'terminal' ? 'flex' : 'hidden'}`}>
                {/* Desktop Layout: Terminal sol, Running Config sağda sabit */}
                <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                  {/* Terminal - Simplified: small (<640px no constraints), medium+ (640px+ 300px margin), 640-770px (50px less) */}
                  <div className="flex flex-col h-full md:flex-1">
                    <div className="flex flex-col h-full">
                      <Terminal
                        key={`terminal-${activeDeviceId}`}
                        className="flex-1"
                        deviceId={activeDeviceId}
                        deviceName={
                          (() => {
                            const deviceState = deviceStates.get(activeDeviceId);
                            return deviceState?.hostname || activeDeviceId;
                          })()
                        }
                        prompt={prompt}
                        state={state}
                        onCommand={handleCommand}
                        onClear={handleClearTerminal}
                        output={output}
                        isLoading={isExecutingCommand}
                        isConnectionError={topologyDevices.some(d => d.id === activeDeviceId && d.status === 'offline')}
                        connectionErrorMessage={language === 'tr' ? 'Bağlantı hatası' : 'Connection error'}
                        isPoweredOff={topologyDevices.some(d => d.id === activeDeviceId && d.status === 'offline')}
                        onTogglePower={toggleDevicePower}
                        onClose={() => setActiveTab('topology')}
                        t={t}
                        theme={theme}
                        language={language}
                        onUpdateHistory={handleUpdateHistory}
                        confirmDialog={confirmDialog}
                        setConfirmDialog={setConfirmDialog}
                        device={topologyDevices.find(d => d.id === activeDeviceId)}
                        devices={topologyDevices}
                        deviceStates={deviceStates}
                        onRequestFocus={() => {
                          requestAnimationFrame(() => {
                            const el = document.querySelector('input[placeholder="' + t.typeCommand + '"]') as HTMLInputElement | null;
                            el?.focus();
                          });
                        }}
                      />
                    </div>
                  </div>
                  {/* ConfigPanel - Simplified: hidden on small (<640px), visible on medium+ (640px+ 300px margin), 640-770px (50px less) */}
                  <div className="hidden md:flex flex-col md:min-h-0 md:w-96 md:flex-shrink-0 md:h-full md:overflow-y-auto custom-scrollbar">
                    <ConfigPanel
                      state={state}
                      className="flex-1"
                      onExecuteCommand={handleCommand}
                      isDevicePoweredOff={topologyDevices.some(d => d.id === activeDeviceId && d.status === 'offline')}
                      t={t}
                      theme={theme}
                    />
                  </div>
                </div>
              </div>

              {/* Tasks Sekmesi */}
              {activeTab === 'tasks' && (
                <div className="grid lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                  <div className="lg:col-span-2">
                    <PortPanel
                      ports={state.ports}
                      t={t}
                      theme={theme}
                      deviceName={state.hostname}
                      deviceModel={activeDeviceType === 'router' ? 'NETWORK-1941' : (state.switchModel || 'WS-C2960-24TT-L')}
                      activeDeviceId={activeDeviceId}
                      isDevicePoweredOff={topologyDevices.some(d => d.id === activeDeviceId && d.status === 'offline')}
                      topologyDevices={topologyDevices}
                      onTogglePower={toggleDevicePower}
                      topologyConnections={topologyConnections || undefined}
                    />
                    <VlanPanel
                      vlans={state.vlans}
                      ports={state.ports}
                      deviceName={state.hostname}
                      deviceModel={activeDeviceType === 'router' ? 'NETWORK-1941' : (state.switchModel || 'WS-C2960-24TT-L')}
                      deviceId={activeDeviceId}
                      onTogglePower={toggleDevicePower}
                      onExecuteCommand={handleCommand}
                      t={t}
                      theme={theme}
                      activeDeviceType={activeDeviceType}
                      isDevicePoweredOff={topologyDevices.some(d => d.id === activeDeviceId && d.status === 'offline')}
                    />
                    <SecurityPanel
                      security={state.security}
                      t={t}
                      theme={theme}
                      deviceId={activeDeviceId}
                      isDevicePoweredOff={topologyDevices.some(d => d.id === activeDeviceId && d.status === 'offline')}
                      onTogglePower={toggleDevicePower}
                    />
                  </div>
                  <div>
                    <TaskCard
                      tasks={[...portTasks, ...vlanTasks, ...securityTasks, ...wirelessTasks]}
                      state={state}
                      context={taskContext}
                      color="from-red-500 to-rose-500"
                      isDark={isDark}
                    />
                  </div>
                </div>
              )}

            </div>
          </main>

          {/* Footer - Save Status & Hints */}
          <footer className={`hidden md:block fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-xl transition-all ${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
            } ${showProjectPicker || showOnboarding ? 'hidden' : ''}`}>
            <div className="w-full px-5 py-2">
              <div className="flex items-center justify-between gap-4">
                {/* Save Status */}
                <div className="flex items-center gap-3">
                  <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-100 border-slate-200'
                    }`}>
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${hasUnsavedChanges ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                      <span className={`w-2 h-2 rounded-full ${hasUnsavedChanges ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                        }`} />
                      {hasUnsavedChanges
                        ? (language === 'tr' ? 'Kaydedilmedi' : 'Unsaved')
                        : (language === 'tr' ? 'Kaydedildi' : 'Saved')}
                    </span>
                    {lastSaveTime && (
                      <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        {(language === 'tr' ? 'Son kaydedilme: ' : 'Last saved: ') + lastSaveTime}
                      </span>
                    )}
                  </div>

                  {/* Quick Hints */}
                  <div className={`hidden md:flex items-center gap-2`}>
                    <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {language === 'tr' ? 'İpuçları:' : 'Tips:'}
                    </span>
                    <span className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {activeTab === 'topology' && (
                        <>
                          <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                            }`}>Ctrl+F</kbd>
                          <span className="mx-1">{language === 'tr' ? 'Tam Ekran' : 'Fullscreen'}</span>
                          <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                            }`}>Ctrl+S</kbd>
                          <span className="mx-1">{language === 'tr' ? 'Kaydet' : 'Save'}</span>
                          <span className={`mx-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>|</span>
                          <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {topologyDevices?.length || 0} {language === 'tr' ? 'cihaz' : 'devices'}
                          </span>
                        </>
                      )}
                      {(activeTab === 'cmd' || activeTab === 'terminal') && (
                        <span className="text-[11px] italic">{language === 'tr' ? 'Program çalıştırmak için simgeleri tıklayınız' : 'Click icons to run programs'}</span>
                      )}
                      {activeTab !== 'topology' && activeTab !== 'cmd' && activeTab !== 'terminal' && (
                        <>
                          <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                            }`}>Ctrl+1-3</kbd>
                          <span className="mx-1">{language === 'tr' ? 'Sekmeler' : 'Tabs'}</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Task Event Notification - Positioned at top-left of footer */}
                  {lastTaskEvent && Date.now() - lastTaskEvent.timestamp < 5000 && (
                    <div className={`absolute -top-12 left-4 md:flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-lg animate-slide-up z-50 ${lastTaskEvent.type === 'completed'
                      ? isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'
                      : isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'
                      }`}>
                      <span className={`text-xs font-semibold flex items-center gap-1.5 ${lastTaskEvent.type === 'completed'
                        ? 'text-green-500'
                        : 'text-orange-500'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${lastTaskEvent.type === 'completed'
                          ? 'bg-green-500'
                          : 'bg-orange-500'
                          }`} />
                        {lastTaskEvent.type === 'completed'
                          ? (language === 'tr' ? '✓ Görev Tamamlandı' : '✓ Task Completed')
                          : (language === 'tr' ? '⚠ Görev Başarısız' : '⚠ Task Failed')}
                      </span>
                      <span className={`text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {lastTaskEvent.taskName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Lab Progress */}
                {totalScore > 0 && (
                  <div className={`hidden md:flex items-center gap-2`}>
                    <span className={`text-[11px] font-bold  tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                      {t.labProgress}
                    </span>
                    <div className={`w-20 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} overflow-hidden`}>
                      <div
                        className="h-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)] transition-all duration-300"
                        style={{ width: `${(totalScore / maxScore) * 100}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                      {Math.round((totalScore / maxScore) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </footer>

          <LazyAboutModal
            isOpen={showAboutModal}
            onClose={() => setShowAboutModal(false)}
            onStartTour={() => {
              setShowAboutModal(false);
              setShowOnboarding(true);
              setOnboardingStep(0);
            }}
          />

          <EnvironmentSettingsPanel
            isOpen={isEnvironmentPanelOpen}
            onOpenChange={setIsEnvironmentPanelOpen}
          />
        </div>
      </div >
    </AppErrorBoundary >
  );
}
