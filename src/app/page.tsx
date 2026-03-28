'use client';

import { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

import { SwitchState, CableInfo } from '@/lib/network/types';
import { useDeviceManager } from '@/hooks/useDeviceManager';
import useAppStore, { useTopologyDevices, useTopologyConnections, useTopologyNotes, useZoom, usePan, useActiveTab } from '@/lib/store/appStore';
// Duplicate removed
import { NetworkTopology } from '@/components/network/NetworkTopology';
import { CanvasDevice, CanvasConnection, CanvasNote } from '@/components/network/networkTopology.types';
import { getPrompt } from '@/lib/network/executor';
import { formatErrorForUser } from '@/lib/errors/errorHandler';
import type { TerminalOutput } from '@/components/network/Terminal';
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
import { ChevronDown, Menu, Plus, Save, FolderOpen, Languages, Sun, Moon, Network, ShieldCheck, Database, Info, File, Layers, Terminal as TerminalIcon, Undo2, Redo2, Link2, Pencil, StickyNote } from "lucide-react";

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

const PCPanel = dynamic(() => import('@/components/network/PCPanel').then((m) => m.PCPanel), { ssr: false });
const Terminal = dynamic(() => import('@/components/network/Terminal').then((m) => m.Terminal), { ssr: false });
const PortPanel = dynamic(() => import('@/components/network/PortPanel').then((m) => m.PortPanel), { ssr: false });
const VlanPanel = dynamic(() => import('@/components/network/VlanPanel').then((m) => m.VlanPanel), { ssr: false });
const SecurityPanel = dynamic(() => import('@/components/network/SecurityPanel').then((m) => m.SecurityPanel), { ssr: false });
const ConfigPanel = dynamic(() => import('@/components/network/ConfigPanel').then((m) => m.ConfigPanel), { ssr: false });
const QuickCommands = dynamic(() => import('@/components/network/QuickCommands').then((m) => m.QuickCommands), { ssr: false });
const TaskCard = dynamic(() => import('@/components/network/TaskCard').then((m) => m.TaskCard), { ssr: false });
const AboutModal = dynamic(() => import('@/components/network/AboutModal').then((m) => m.AboutModal), { ssr: false });

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
  showFor: string[];
}

const ALL_TABS: TabDefinition[] = [
  {
    id: 'topology',
    labelKey: 'networkTopology',
    icon: <Network className="w-4 h-4" />,
    tasks: topologyTasks,
    color: 'from-cyan-500 to-blue-500',
    showFor: ['pc', 'switch', 'router']
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
    showFor: ['switch', 'router']
  },
  {
    id: 'tasks',
    labelKey: 'tasks',
    icon: <ShieldCheck className="w-4 h-4" />,
    tasks: [...portTasks, ...vlanTasks, ...securityTasks],
    color: 'from-red-500 to-rose-500',
    showFor: ['switch', 'router']
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
      basic: language === 'tr' ? 'Temel komutlar ve ilk topoloji adımları' : 'Core commands and first topology steps',
      intermediate: language === 'tr' ? 'Servisler, VLAN ve yönlendirme senaryoları' : 'Services, VLAN and routing scenarios',
      advanced: language === 'tr' ? 'Kapsamlı kurulum ve doğrulama laboratuvarları' : 'Comprehensive setup and verification labs'
    }),
    [language]
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
  const { setDevices, setConnections, setNotes, setZoom, setPan, setActiveTab } = useAppStore();

  // Helper functions for state setters to maintain compatibility
  const setTopologyDevices = setDevices;
  const setTopologyConnections = setConnections;
  const setTopologyNotes = setNotes;

  // Currently active device in terminal
  const [activeDeviceId, setActiveDeviceId] = useState<string>('switch-1');
  const [activeDeviceType, setActiveDeviceType] = useState<'pc' | 'switch' | 'router'>('switch');

  // Listen for device config updates from PCPanel
  useEffect(() => {
    const handleDeviceUpdate = (event: any) => {
      const { deviceId, config } = event.detail;

      // Update topology devices using functional update to avoid stale closure
      setDevices(prev =>
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
    };

    window.addEventListener('update-topology-device-config', handleDeviceUpdate);
    return () => window.removeEventListener('update-topology-device-config', handleDeviceUpdate);
  }, []); // Actions from useAppStore are stable, and functional updates avoid stale data issues.

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
          id: 'switch-1',
          type: 'switch',
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleDevicePower = useCallback((deviceId: string) => {
    setTopologyDevices((prev) => {
      const current = prev.find(d => d.id === deviceId);
      const nextStatus: 'online' | 'offline' = current?.status === 'offline' ? 'online' : 'offline';
      window.dispatchEvent(new CustomEvent('trigger-topology-toggle-power', { detail: { deviceId, nextStatus } }));

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
  }, []);

  const [cableInfo, setCableInfo] = useState<CableInfo>({
    connected: true,
    cableType: 'straight',
    sourceDevice: 'pc',
    targetDevice: 'switch',
  });

  // Initial App Loading State
  // No longer needed here as it's declared earlier

  // Device manager hook moved to top

  const [topologyKey, setTopologyKey] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<'pc' | 'switch' | 'router' | null>(null);
  const [showPCPanel, setShowPCPanel] = useState(false);
  const [showPCDeviceId, setShowPCDeviceId] = useState<string>('pc-1');

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
    activeDeviceType: activeDeviceType || 'switch',
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
  const state = (() => {
    const activeDevice = (topologyDevices || []).find(d => d.id === activeDeviceId);
    return getOrCreateDeviceState(activeDeviceId, activeDeviceType, activeDevice?.name, activeDevice?.macAddress);
  })();
  const output = activeTab === 'topology' ? [] : getOrCreateDeviceOutputs(activeDeviceId);

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
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalHistoryPushedRef = useRef(false);

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
        setTopologyDevices(projectData.topology.devices || []);
        setTopologyConnections(projectData.topology.connections || []);
        setTopologyNotes(projectData.topology.notes || []);
        if (projectData.topology.zoom) setZoom(projectData.topology.zoom);
        if (projectData.topology.pan) setPan(projectData.topology.pan);
      }

      // Load cable info
      if (projectData.cableInfo) {
        setCableInfo(projectData.cableInfo);
      }

      // Load active device
      if (projectData.activeDeviceId) {
        setActiveDeviceId(projectData.activeDeviceId);
      }
      if (projectData.activeDeviceType) {
        setActiveDeviceType(projectData.activeDeviceType);
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
        topologyDevices: projectData.topology?.devices || [],
        topologyConnections: projectData.topology?.connections || [],
        topologyNotes: projectData.topology?.notes || [],
        deviceStates: new Map(projectData.devices?.map((item: any) => [item.id, item.state]) || []),
        deviceOutputs: new Map(projectData.deviceOutputs?.map((item: any) => [item.id, item.outputs]) || []),
        pcOutputs: new Map(projectData.pcOutputs?.map((item: any) => [item.id, item.outputs]) || []),
        pcHistories: new Map(projectData.pcHistories?.map((item: any) => [item.id, item.history]) || []),
        cableInfo: projectData.cableInfo || { connected: false, cableType: 'straight', sourceDevice: 'pc', targetDevice: 'switch' },
        activeDeviceId: projectData.activeDeviceId || 'switch-1',
        activeDeviceType: projectData.activeDeviceType || 'switch',
        zoom: projectData.zoom || 1.0,
        pan: projectData.pan || { x: 0, y: 0 },
        activeTab: projectData.activeTab || 'topology'
      });

      return true;
    } catch (error) {
      console.error("Error loading project data", error);
      toast({
        title: language === 'tr' ? 'Hata' : 'Error',
        description: language === 'tr' ? 'Proje dosyası bozuk veya uyumsuz!' : 'Project file is corrupted or incompatible!',
        variant: 'destructive',
      });
      return false;
    }
  }, [setDeviceStates, setDeviceOutputs, setPcOutputs, setPcHistories, setTopologyDevices, setTopologyConnections, setTopologyNotes, setCableInfo, setActiveDeviceId, setActiveDeviceType, setActiveTab, setTopologyKey, setHasUnsavedChanges, resetHistory, toast]);

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
      // Current tab is not supported by new device type
      if (activeDeviceType === 'pc') {
        setActiveTab('cmd');
      } else if (activeDeviceType === 'switch' || activeDeviceType === 'router') {
        setActiveTab('terminal');
      } else {
        setActiveTab('topology');
      }
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
  }, [topologyDevices, zoom]);

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
  }, [topologyDevices, topologyNotes]);

  const switchTabOrTopology = useCallback((tabId: TabType) => {
    const targetTab = ALL_TABS.find(tab => tab.id === tabId);
    if (!targetTab) return;

    const deviceVisible = activeDeviceId && topologyDevices.some(d => d.id === activeDeviceId);
    const isCompatible = tabId === 'topology' || (deviceVisible && targetTab.showFor.includes(activeDeviceType));

    setActiveTab(isCompatible ? tabId : 'topology');
  }, [activeDeviceId, activeDeviceType, topologyDevices, setActiveTab]);

  const applyDeviceSelection = useCallback((device: 'pc' | 'switch' | 'router', deviceId?: string) => {
    setSelectedDevice(device);
    if (!deviceId) return;

    const actualDeviceType = deviceId.includes('router') ? 'router' : deviceId.includes('pc') ? 'pc' : 'switch';
    setActiveDeviceId(deviceId);
    setActiveDeviceType(actualDeviceType);

    if (actualDeviceType !== 'pc') {
      const deviceObj = topologyDevices?.find(d => d.id === deviceId);
      getOrCreateDeviceState(deviceId, actualDeviceType, deviceObj?.name, deviceObj?.macAddress);
      getOrCreateDeviceOutputs(deviceId);
    }
  }, [getOrCreateDeviceState, getOrCreateDeviceOutputs, topologyDevices, setSelectedDevice, setActiveDeviceId, setActiveDeviceType]);

  // Topology canvas click: selects device only (no zoom/pan).
  const handleDeviceSelectFromCanvas = useCallback((device: 'pc' | 'switch' | 'router', deviceId?: string) => {
    applyDeviceSelection(device, deviceId);
  }, [applyDeviceSelection]);

  // Device dropdown/menu click: focus the selected device at 100% zoom.
  const handleDeviceSelectFromMenu = useCallback((device: 'pc' | 'switch' | 'router', deviceId?: string) => {
    applyDeviceSelection(device, deviceId);
    if (!deviceId) return;

    switchTabOrTopology('topology');
    if (topologyContainerRef.current) {
      resetTopologyView();
      focusDeviceInTopology(deviceId);
      pendingFocusDeviceRef.current = null;
    } else {
      pendingFocusDeviceRef.current = deviceId;
    }
  }, [applyDeviceSelection, focusDeviceInTopology, resetTopologyView, switchTabOrTopology]);

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
  }, [activeDeviceId, handleCommandForDevice, topologyDevices, topologyConnections, setActiveDeviceId, setActiveDeviceType]);

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
  const handleDeviceDoubleClick = useCallback((device: 'pc' | 'switch' | 'router', deviceId: string) => {
    // Determine actual device type
    const actualDeviceType = deviceId.includes('router') ? 'router' : deviceId.includes('pc') ? 'pc' : 'switch';

    if (actualDeviceType === 'pc') {
      // PC - open CMD tab directly
      setActiveTab('cmd');
      setShowPCDeviceId(deviceId);
      setShowPCPanel(true);
      setActiveDeviceId(deviceId);
      setActiveDeviceType('pc');
    } else {
      // Switch or Router - set as CLI device and switch to terminal
      setActiveDeviceId(deviceId);
      const actualType = actualDeviceType as 'switch' | 'router';
      setActiveDeviceType(actualType);

      const deviceObj = topologyDevices?.find(d => d.id === deviceId);
      getOrCreateDeviceState(deviceId, actualType, deviceObj?.name, deviceObj?.macAddress);
      getOrCreateDeviceOutputs(deviceId);
      setActiveTab('terminal');
    }
  }, [getOrCreateDeviceState, getOrCreateDeviceOutputs, topologyDevices, setActiveTab, setShowPCDeviceId, setShowPCPanel, setActiveDeviceId, setActiveDeviceType]);

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
          setActiveDeviceType(nextDevice.type as 'pc' | 'switch' | 'router');
          setActiveTab('topology');
        } else {
          setActiveDeviceId('');
          setActiveDeviceType('switch');
          setActiveTab('topology');
        }
        return prev;
      });
    }
    setHasUnsavedChanges(true);
  }, [activeDeviceId, showPCDeviceId, selectedDevice, setDeviceStates, setDeviceOutputs, setPcOutputs, setShowPCPanel, setShowPCDeviceId, setSelectedDevice, setActiveDeviceId, setActiveDeviceType, setActiveTab, setHasUnsavedChanges]);

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
      devices: Array.from(deviceStates.entries()).map(([id, state]) => ({
        id,
        state
      })),
      deviceOutputs: Array.from(deviceOutputs.entries()).map(([id, outputs]) => ({
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
      title: language === 'tr' ? 'Proje kaydedildi' : 'Project saved',
      description: language === 'tr' ? 'JSON dosyası indirildi.' : 'JSON file downloaded.',
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
        id: 'switch-1',
        type: 'switch',
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
    setActiveDeviceType('switch');
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
          type: 'switch',
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
      ],
      topologyConnections: [],
      topologyNotes: [],
      deviceStates: new Map(),
      deviceOutputs: new Map(),
      pcOutputs: new Map(),
      pcHistories: new Map(),
      cableInfo: { connected: false, cableType: 'straight', sourceDevice: 'pc', targetDevice: 'switch' },
      activeDeviceId: 'switch-1',
      activeDeviceType: 'switch',
      zoom: 1.0,
      pan: { x: 0, y: 0 },
      activeTab: 'topology'
    });
  }, [resetHistory, setDeviceStates, setDeviceOutputs, setPcOutputs, setPcHistories, setTopologyDevices, setTopologyConnections, setTopologyNotes, setActiveDeviceId, setActiveDeviceType, setSelectedDevice, setShowPCPanel, setActiveTab, setHasUnsavedChanges, setTopologyKey]);

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

  // Handle back button on mobile: popstate shuts down everything
  useEffect(() => {
    const handlePopState = () => {
      setShowMobileMenu(false);
      setConfirmDialog(null);
      setSaveDialog(null);
      setShowPCPanel(false);
      setShowProjectPicker(false);
      setShowOnboarding(false);
      window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source: 'back' } }));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setShowMobileMenu, setConfirmDialog, setSaveDialog, setShowPCPanel, setShowProjectPicker, setShowOnboarding]);

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
      }
    }
  }, [language]);

  // Onboarding content + controls
  const onboardingSteps = [
    {
      title: language === 'tr' ? 'Hoş geldin' : 'Welcome',
      description:
        language === 'tr'
          ? 'Bu kısa turla temel kontrolleri 30 saniyede öğren.'
          : 'This quick tour shows the essentials in ~30 seconds.',
    },
    {
      title: language === 'tr' ? 'Topoloji' : 'Topology',
      description:
        language === 'tr'
          ? 'Cihazları ekle, bağla ve sürükleyerek konumlandır. Çift tıkla: PC için CMD, Switch/Router için CLI.'
          : 'Add/connect devices and drag to position. Double-click: CMD for PC, CLI for Switch/Router.',
    },
    {
      title: language === 'tr' ? 'Cihaz seçimi' : 'Device selection',
      description:
        language === 'tr'
          ? 'Üstteki cihaz menüsünden aktif cihazı seç. Nokta rengi cihazın online/offline durumunu gösterir.'
          : 'Use the device menu in the header. The colored dot shows online/offline status.',
    },
    {
      title: language === 'tr' ? 'Görev ilerlemesi' : 'Task progress',
      description:
        language === 'tr'
          ? 'Sekmelerdeki rozetler (ör. 2/6) o alandaki görev ilerlemeni gösterir.'
          : 'Badges on tabs (e.g., 2/6) show your progress for that area.',
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

  // Handle key events: ESC to close, ENTER to confirm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        if (key === 'z') {
          if (activeTabRef.current === 'topology') {
            e.preventDefault();
            handleUndo();
          }
        }
        if (key === 'y') {
          if (activeTabRef.current === 'topology') {
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMobileMenu, confirmDialog, saveDialog, showPCPanel, showProjectPicker, handleSaveProject, handleNewProject, handleUndo, handleRedo, tabs, setShowMobileMenu, setConfirmDialog, setSaveDialog, setShowPCPanel, setShowProjectPicker, isTopologyFullscreen]);

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
  }, [loadProjectData, setHasUnsavedChanges, t.invalidProjectFile, t.failedLoadProject, language]);

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
  }, [loadProjectData, setShowProjectPicker]);

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
      <div className={`min-h-screen w-full flex flex-col relative overflow-hidden transition-colors duration-700 ${isAppLoading ? 'bg-slate-950 overflow-hidden' : (isDark ? 'bg-slate-950' : 'bg-slate-50')}`}>
        {!isAppLoading && (
          <div className="fixed inset-0 pointer-events-none z-0 opacity-40 dark:opacity-20 transition-opacity duration-1000">
            <div className="absolute inset-0 mesh-gradient animate-liquid blur-[100px] scale-150 rotate-12" />
            <div className={`absolute inset-0 ${isDark ? 'bg-slate-950/40' : 'bg-white/40'}`} />
          </div>
        )}
        {/* App Loading Screen */}
        {isAppLoading && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
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
            </motion.div>

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showContent ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col flex-1"
        >
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
                      <motion.span
                        key={totalScore}
                        initial={{ opacity: 0.5, y: -2 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-full ${totalScore >= maxScore * 0.7 ? 'bg-emerald-500/10 text-emerald-400' :
                          totalScore >= maxScore * 0.4 ? 'bg-amber-500/10 text-amber-400' :
                            'bg-rose-500/10 text-rose-400'
                          }`}
                      >
                        {Math.round((totalScore / maxScore) * 100)}%
                      </motion.span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-24 rounded-full overflow-hidden p-[px] ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(totalScore / maxScore) * 100}%` }}
                          transition={{ type: "spring", stiffness: 50, damping: 15 }}
                          className={`h-full rounded-full bg-gradient-to-r shadow-[0_0_8px_rgba(0,0,0,0.2)] ${totalScore >= maxScore * 0.7 ? 'from-emerald-500 via-teal-400 to-emerald-400' :
                            totalScore >= maxScore * 0.4 ? 'from-amber-500 via-orange-400 to-amber-400' :
                              'from-rose-500 via-pink-500 to-rose-400'
                            }`}
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
                    <div className="hidden md:flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ui-hover-surface ${isDark ? 'text-slate-300 hover:text-green-400' : 'text-slate-600 hover:text-green-600'}`}
                            onClick={handleNewProject}
                          >
                            <File className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t.newProject} {!isMobile && '(Alt+N)'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ui-hover-surface ${isDark ? 'text-slate-300 hover:text-amber-400' : 'text-slate-600 hover:text-amber-600'}`}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <FolderOpen className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t.loadProject} {!isMobile && '(Ctrl+O)'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ui-hover-surface ${isDark ? 'text-slate-300 hover:text-blue-400' : 'text-slate-600 hover:text-blue-600'}`}
                            onClick={handleSaveProject}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t.saveProject} {!isMobile && '(Ctrl+S)'}</TooltipContent>
                      </Tooltip>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoadProject} className="hidden" />
                    {(activeTab === 'topology') && (
                      <div className={`w-px h-4 mx-1 ${isDark ? 'bg-slate-700' : 'bg-slate-300'} hidden md:block`} />
                    )}

                    {/* Info & Settings */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className={`h-8 w-8 ui-hover-surface ${isDark ? 'text-slate-300 hover:text-sky-400' : 'text-slate-600 hover:text-sky-600'}`} onClick={() => setShowAboutModal(true)}>
                          <Info className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t.about}</TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
                      className={`text-xs font-bold h-8 px-2 ui-hover-surface ${isDark ? 'text-slate-300 hover:text-purple-400' : 'text-slate-600 hover:text-purple-600'}`}
                    >
                      <Languages className="w-4 h-4 mr-1" />
                      {language.toUpperCase()}
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ui-hover-surface ${isDark ? 'text-slate-300 hover:text-yellow-400' : 'text-slate-600 hover:text-yellow-600'}`}
                          onClick={() => setTheme(isDark ? 'light' : 'dark')}
                        >
                          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isDark ? (language === 'tr' ? 'Açık Tema' : 'Light Mode') : (language === 'tr' ? 'Koyu Tema' : 'Dark Mode')}</TooltipContent>
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
                    <ScrollArea className="h-[calc(100vh-4rem)]">
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
                              <Info className="w-3.5 h-3.5" /> {language === 'tr' ? 'Tur' : 'Tour'}
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
                                  className={`w-full justify-start gap-3 h-9 px-3 text-xs font-bold ui-hover-surface ${isActive ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400'}`}
                                  onClick={() => {
                                    switchTabOrTopology(tab.id);
                                    setShowMobileMenu(false);
                                  }}
                                >
                                  <span className={`w-4 h-4 flex items-center justify-center ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
                                    {tab.icon}
                                  </span>
                                  {label}
                                </Button>
                              );
                            })}
                          </div>
                        </div>

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all ${isDark
                      ? 'bg-slate-900 border-slate-800 text-cyan-400 hover:text-cyan-300'
                      : 'bg-white border-slate-200 text-cyan-700 hover:text-cyan-800'
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
                              <span
                                className="w-2 h-2 rounded-full mr-0.5"
                                title={statusLabel}
                              >
                                <span className={`block w-2 h-2 rounded-full ${statusColor} shadow-[0_0_6px_rgba(45,212,191,0.8)]`} />
                              </span>
                            );
                          })()}
                          <DeviceIcon
                            type={activeDeviceType}
                            className={`${activeDeviceType === 'pc' ? 'text-blue-500' : activeDeviceType === 'router' ? 'text-purple-500' : 'text-emerald-500'} w-5 h-5`}
                          />
                          <span className="text-xs font-bold">
                            {truncateWithEllipsis(deviceStates.get(activeDeviceId)?.hostname || activeDeviceId, 15)}
                          </span>
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
                  <ScrollArea className={topologyDevices.length > 0 ? "h-56" : "h-auto"}>
                    {topologyDevices.length > 0 ? (
                      topologyDevices.map((device) => {
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
                            className={`flex items-center gap-2 py-1.5 cursor-pointer ${activeDeviceId === device.id ? 'bg-cyan-500/10 text-cyan-400' : ''}`}
                            onClick={() => handleDeviceSelectFromMenu(device.type, device.id)}
                          >
                            <div className="flex items-center gap-2 cursor-pointer">
                              <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                              <DeviceIcon
                                type={device.type}
                                className={`${device.type === 'pc' ? 'text-blue-500' : device.type === 'router' ? 'text-purple-500' : 'text-emerald-500'} w-5 h-5`}
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
                    topology: 'text-blue-500 hover:text-blue-500',
                    cmd: 'text-emerald-500 hover:text-emerald-500',
                    terminal: 'text-emerald-500 hover:text-emerald-600',
                    tasks: 'text-red-500 hover:text-red-600',
                  }; const colorClass = tabColors[tab.id] || 'text-slate-500 hover:text-slate-600';

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
                        <motion.div
                          layoutId="mobileTabActive"
                          className="absolute inset-0 bg-blue-500/10 rounded-xl"
                          transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                        />
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

          <Dialog open={showProjectPicker} onOpenChange={setShowProjectPicker}>
            <DialogContent className={`liquid-glass-strong w-[98vw] max-w-[1400px] h-[95vh] max-h-[1000px] p-0 overflow-hidden flex flex-col shadow-2xl rounded-none md:rounded-3xl`}>
              <div className='flex flex-col flex-1 overflow-hidden h-full max-w-full'>
                <div className='p-4 md:p-8 pb-2 md:pb-4'>
                  <div className='rounded-2xl md:rounded-3xl border border-transparent bg-gradient-to-r  p-4 md:p-6 '>
                    <DialogTitle className='text-xl md:text-3xl lg:text-4xl  bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent break-words'>{language === 'tr' ? 'Yeni Proje Aç' : 'Open a New Project'}</DialogTitle>
                    <DialogDescription className="sr-only">
                      {language === 'tr'
                        ? 'Yeni proje penceresi: boş projeyle başlayın veya hazır örneklerden birini seçin.'
                        : 'New project dialog: start with an empty project or choose one of the ready examples.'}
                    </DialogDescription>
                    <p className={`text-xs md:text-base mt-1 md:mt-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'} break-words`}>
                      {language === 'tr'
                        ? 'Yeni laboratuvar akışına göre boş projeyle başlayın ya da seviyelendirilmiş hazır senaryolardan birini seçin.'
                        : 'Start with an empty lab or choose one of the level-based ready scenarios in the new workflow.'}
                    </p>
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
                              {projects.map((example) => (
                                <Button
                                  key={example.id}
                                  variant='ghost'
                                  className={`group h-auto min-h-[120px] md:min-h-[160px] flex-col items-start gap-3 md:gap-5 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border-2 text-left transition-all duration-300 hover:translate-y-[-4px] active:scale-[0.98] ${isDark ? 'border-slate-800/40 bg-slate-900/20 hover:bg-slate-900/80 hover:border-cyan-500/30' : 'border-slate-200/50 bg-white hover:bg-slate-50 hover:border-blue-500/20'} w-full overflow-hidden shadow-sm hover:shadow-2xl`}
                                  onClick={() => { setShowProjectPicker(false); runWithSaveGuard(() => applyExampleProject(example.data)); }}
                                >
                                  <div className='flex items-start justify-between w-full gap-4 overflow-hidden'>
                                    <span className='font-black text-base md:text-2xl leading-none group-hover:text-cyan-400 transition-colors duration-300 break-words flex-1'>{example.title}</span>
                                    <span className={`text-[8px] md:text-[10px] font-black  tracking-[0.2em] px-3 py-1.5 rounded-full whitespace-nowrap border shrink-0 ${isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{example.tag}</span>
                                  </div>
                                  <p className={`text-[11px] md:text-sm leading-relaxed ${isDark ? 'text-slate-400/80' : 'text-slate-600'} font-medium italic group-hover:text-slate-200 transition-colors whitespace-normal break-words break-all w-full`}>{example.description}</p>
                                  {example.detail && (
                                    <div className='mt-auto pt-2 md:pt-4 flex items-center gap-2 md:gap-3 w-full border-t border-slate-800/10 dark:border-slate-800/50'>
                                      <div className='w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-amber-500 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.5)]' />
                                      <span className={`text-[8px] md:text-[11px] font-bold tracking-wide  ${isDark ? 'text-amber-400/80' : 'text-amber-700/80'} whitespace-normal break-words break-all w-full`}>{example.detail}</span>
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
            <DialogContent className={`liquid-glass-strong sm:max-w-lg`}>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span>{onboardingSteps[onboardingStep]?.title}</span>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {onboardingStep + 1}/{onboardingSteps.length}
                  </span>
                </DialogTitle>
                <DialogDescription className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  {onboardingSteps[onboardingStep]?.description}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between gap-2 pt-2">
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

          {/* Main Content with matching top background */}
          <main className={`flex-1 overflow-hidden flex flex-col min-h-0 md:pb-[68px] ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
            <div className={`${activeTab === 'topology' ? 'p-0 pb-0 sm:pb-0' : 'p-4 sm:p-5'} w-full flex-1 flex flex-col min-h-0 overflow-hidden`}>
              {/* Tab Content */}
              {activeTab === 'topology' && (
                <div className="flex-1 flex flex-col min-h-0 h-full">
                  {/* Topology Header */}
                  <div className={`hidden md:flex items-center justify-between px-4 py-2 border-b ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                    <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {language === 'tr' ? 'Ağ Topolojisi' : 'Network Topology'}
                    </h2>
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {topologyDevices?.length || 0} {language === 'tr' ? 'cihaz' : 'devices'}
                    </span>
                  </div>
                  {/* Network Topology fills remaining space */}
                  <div ref={topologyContainerRef} className="flex-1 w-full h-full min-h-0">
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
                    />
                  </div>
                </div>
              )}

              {/* CMD Terminal Sekmesi */}
              {/* CMD Terminal Sekmesi - Always mounted, hidden via CSS */}
              <div className={`w-full flex-1 min-h-0 overflow-hidden flex flex-col ${activeTab === 'cmd' ? 'flex' : 'hidden'}`}>
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
                />
              </div>

              {/* Terminal Sekmesi - Always mounted, hidden via CSS */}
              <div className={`flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto xl:overflow-hidden custom-scrollbar ${activeTab === 'terminal' ? 'flex' : 'hidden'}`}>
                {isMobile ? (
                  /* Mobile Layout: Only CLI - Full screen with scroll */
                  <div className="flex flex-col h-[300px] min-h-[300px]">
                    <div className="flex-1 min-h-0">
                      <Terminal
                        key={`terminal-${activeDeviceId}`}
                        title="CLI"
                        className="h-full"
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
                        onRequestFocus={() => {
                          requestAnimationFrame(() => {
                            const el = document.querySelector('input[placeholder="' + t.typeCommand + '"]') as HTMLInputElement | null;
                            el?.focus();
                          });
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  /* Desktop Layout: Terminal + QuickCommands üstte, Running Config en altta */
                  <div className="flex flex-col gap-4 flex-1 min-h-0 xl:overflow-hidden">
                    <div className="flex flex-col min-h-[400px] xl:min-h-0 ">
                      <Terminal
                        key={`terminal-${activeDeviceId}`}
                        title={isMobile ? "CLI" : undefined}
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
                        onRequestFocus={() => {
                          requestAnimationFrame(() => {
                            const el = document.querySelector('input[placeholder="' + t.typeCommand + '"]') as HTMLInputElement | null;
                            el?.focus();
                          });
                        }}
                      />
                    </div>
                    <div className="flex flex-col min-h-[400px] xl:min-h-0">
                      <ConfigPanel
                        state={state}
                        title={isMobile ? (language === "tr" ? "Çalışan Config" : "Running Config") : undefined}
                        className="flex-1"
                        onExecuteCommand={handleCommand}
                        isDevicePoweredOff={topologyDevices.some(d => d.id === activeDeviceId && d.status === 'offline')}
                        t={t}
                        theme={theme}
                      />
                    </div>
                  </div>
                )}
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
                      deviceModel={activeDeviceType === 'router' ? 'NETWORK-1941' : 'WS-C2960-24TT-L'}
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
                      deviceModel={activeDeviceType === 'router' ? 'NETWORK-1941' : 'WS-C2960-24TT-L'}
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
                        </>
                      )}
                      {(activeTab === 'cmd' || activeTab === 'terminal') && (
                        <>
                          <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                            }`}>Ctrl+L</kbd>
                          <span className="mx-1">{language === 'tr' ? 'Temizle' : 'Clear'}</span>
                          <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                            }`}>↑↓</kbd>
                          <span className="mx-1">{language === 'tr' ? 'Geçmiş' : 'History'}</span>
                        </>
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

          <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />
        </motion.div>
      </div>
    </AppErrorBoundary>
  );
}
