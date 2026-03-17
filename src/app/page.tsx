'use client';

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { SwitchState, CableInfo } from '@/lib/network/types';
import { useDeviceManager } from '@/hooks/useDeviceManager';
// Duplicate removed
import { NetworkTopology } from '@/components/network/NetworkTopology';
import { CanvasDevice, CanvasConnection, CanvasNote } from '@/components/network/networkTopology.types';
import { PCPanel } from '@/components/network/PCPanel';
import { getPrompt } from '@/lib/network/executor';
import { Terminal } from '@/components/network/Terminal';
import type { TerminalOutput } from '@/components/network/Terminal';
import { PortPanel } from '@/components/network/PortPanel';
import { VlanPanel } from '@/components/network/VlanPanel';
import { SecurityPanel } from '@/components/network/SecurityPanel';
import { ConfigPanel } from '@/components/network/ConfigPanel';
import { QuickCommands } from '@/components/network/QuickCommands';
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
import { TaskCard } from '@/components/network/TaskCard';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, Menu, Plus, Save, FolderOpen, Languages, Sun, Moon, Network, ShieldCheck, Database, Info, File, Layers, Terminal as TerminalIcon, Undo2, Redo2, Link2 } from "lucide-react";

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useLanguage, Translations } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from "@/hooks/use-toast";
import { AboutModal } from '@/components/network/AboutModal';
import {
  topologyTasks,
  portTasks,
  vlanTasks,
  securityTasks,
  calculateTaskScore,
  TaskContext,
  getTaskStatus
} from '@/lib/network/taskDefinitions';
import { exampleProjects } from '@/lib/network/exampleProjects';

import { DeviceIcon } from '@/components/network/DeviceIcon';

type TabType = 'topology' | 'cmd' | 'terminal' | 'ports' | 'vlan' | 'security';

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
    color: 'from-green-500 to-emerald-500',
    showFor: ['switch', 'router']
  },
  {
    id: 'ports',
    labelKey: 'ports',
    icon: <Database className="w-4 h-4" />,
    tasks: portTasks,
    color: 'from-yellow-500 to-orange-500',
    showFor: ['switch', 'router']
  },
  {
    id: 'vlan',
    labelKey: 'vlanStatus',
    icon: <Layers className="w-4 h-4" />,
    tasks: vlanTasks,
    color: 'from-purple-500 to-pink-500',
    showFor: ['switch', 'router']
  },
  {
    id: 'security',
    labelKey: 'securityControls',
    icon: <ShieldCheck className="w-4 h-4" />,
    tasks: securityTasks,
    color: 'from-red-500 to-rose-500',
    showFor: ['switch', 'router']
  },
];

import { useHistory, ProjectState } from '@/hooks/useHistory';

export default function Home() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [isAppLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);

  // Define tab state first to avoid temporal deadzone errors in callbacks
  const [activeTab, setActiveTab] = useState<TabType>('topology');

  // Currently active device in terminal
  const [activeDeviceId, setActiveDeviceId] = useState<string>('switch-1');
  const [activeDeviceType, setActiveDeviceType] = useState<'pc' | 'switch' | 'router'>('switch');

  // Topology state - managed in page.tsx for save/load functionality
  const [topologyDevices, setTopologyDevices] = useState<CanvasDevice[]>([]);
  const [topologyConnections, setTopologyConnections] = useState<CanvasConnection[]>([]);
  const [topologyNotes, setTopologyNotes] = useState<CanvasNote[]>([]);

  // Listen for device config updates from PCPanel
  useEffect(() => {
    const handleDeviceUpdate = (event: any) => {
      const { deviceId, config } = event.detail;

      // Update topology devices
      setTopologyDevices((prev) =>
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
            return new Map(prev).set(deviceId, { ...state, hostname: config.name });
          }
          return prev;
        });
      }
    };

    window.addEventListener('update-topology-device-config', handleDeviceUpdate);
    return () => window.removeEventListener('update-topology-device-config', handleDeviceUpdate);
  }, []);

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
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
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
      const nextStatus = current?.status === 'offline' ? 'online' : 'offline';
      // Keep the topology canvas in sync without forcing a full remount.
      window.dispatchEvent(new CustomEvent('trigger-topology-toggle-power', { detail: { deviceId, nextStatus } }));

      // Keep sidebar/panels in sync too: links touching an offline device are inactive.
      // Otherwise panels may keep showing stale "connected" LEDs after power toggles.
      setTopologyConnections((prevConnections) => {
        const nextDevices = prev.map((d) => (d.id === deviceId ? { ...d, status: nextStatus } : d));
        const byId = new Map(nextDevices.map(d => [d.id, d] as const));
        return prevConnections.map((c) => {
          if (c.sourceDeviceId !== deviceId && c.targetDeviceId !== deviceId) return c;
          if (nextStatus === 'offline') return { ...c, active: false };
          const peerId = c.sourceDeviceId === deviceId ? c.targetDeviceId : c.sourceDeviceId;
          const peer = byId.get(peerId);
          return { ...c, active: peer?.status !== 'offline' };
        });
      });
      return prev.map((d) => (d.id === deviceId ? { ...d, status: nextStatus } : d));
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
  } = useDeviceManager(language);

  const [topologyKey, setTopologyKey] = useState(0);

  // Get current state helper
  const getCurrentState = useCallback((): ProjectState => ({
    topologyDevices: JSON.parse(JSON.stringify(topologyDevices || [])),
    topologyConnections: JSON.parse(JSON.stringify(topologyConnections || [])),
    topologyNotes: JSON.parse(JSON.stringify(topologyNotes || [])),
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

  const { pushState, undo, redo, canUndo, canRedo, resetHistory } = useHistory(getCurrentState());

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

  const handleUndo = useCallback(() => {
    if (activeTabRef.current !== 'topology') return;
    isApplyingHistoryRef.current = true;
    const prevState = undo();
    if (prevState) applyProjectState(prevState);
  }, [undo, applyProjectState]);

  const handleRedo = useCallback(() => {
    if (activeTabRef.current !== 'topology') return;
    isApplyingHistoryRef.current = true;
    const nextState = redo();
    if (nextState) applyProjectState(nextState);
  }, [redo, applyProjectState]);

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
        pushState(currentState);
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
  }, [topologyDevices, topologyConnections, topologyNotes, deviceStates, activeDeviceId, isAppLoading, pushState]); // Removed getCurrentState from deps as it's not stable

  // Initial App Loading State
  // No longer needed here as it's declared earlier

  useEffect(() => {
    // Initial loading sequence: short splash, then reveal content.
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const splashMs = prefersReducedMotion ? 300 : 700;
    const timer = setTimeout(() => {
      setIsLoading(false);
      setTimeout(() => setShowContent(true), 100);
    }, splashMs);
    return () => clearTimeout(timer);
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
    const activeDevice = topologyDevices?.find(d => d.id === activeDeviceId);
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
    showPCPanel: false, // Updated later
    selectedDevice: null, // Updated later
    language,
  };

  // Calculate total score
  const totalScore = calculateTaskScore([...topologyTasks, ...portTasks, ...vlanTasks, ...securityTasks], state, taskContext);

  // Calculate max possible score
  const maxScore = [...topologyTasks, ...portTasks, ...vlanTasks, ...securityTasks].reduce((acc, task) => acc + task.weight, 0);

  // Per-tab task completion counts for badges
  const completedPortTasks = portTasks.filter(task => getTaskStatus(task, state, taskContext)).length;
  const completedVlanTasks = vlanTasks.filter(task => getTaskStatus(task, state, taskContext)).length;
  const completedSecurityTasks = securityTasks.filter(task => getTaskStatus(task, state, taskContext)).length;

  const [selectedDevice, setSelectedDevice] = useState<'pc' | 'switch' | 'router' | null>(null);
  const [showPCPanel, setShowPCPanel] = useState(false);
  const [showPCDeviceId, setShowPCDeviceId] = useState<string>('pc-1');

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
        topology: {
          devices: topologyDevices,
          connections: topologyConnections,
          notes: topologyNotes
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
  }, [deviceStates, deviceOutputs, pcOutputs, topologyDevices, topologyConnections, topologyNotes, cableInfo, activeDeviceId, activeDeviceType, activeTab, isAppLoading]);

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
  }, [setDeviceStates, setDeviceOutputs, setPcOutputs, setPcHistories, setTopologyDevices, setTopologyConnections, setTopologyNotes, setCableInfo, setActiveDeviceId, setActiveDeviceType, setActiveTab, setTopologyKey, setHasUnsavedChanges, resetHistory, language, toast]);

  // Persistence: Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('netsim_autosave');
    if (savedData) {
      try {
        const projectData = JSON.parse(savedData);
        loadProjectData(projectData);
        setLastSaveTime(new Date().toLocaleTimeString());
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
    const PADDING = 40;
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

    setActiveTab('topology');
    if (topologyContainerRef.current) {
      resetTopologyView();
      focusDeviceInTopology(deviceId);
      pendingFocusDeviceRef.current = null;
    } else {
      pendingFocusDeviceRef.current = deviceId;
    }
  }, [applyDeviceSelection, focusDeviceInTopology, resetTopologyView, setActiveTab]);

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
    await handleCommandForDevice(
      activeDeviceId,
      command,
      topologyDevices,
      setActiveDeviceId,
      setActiveDeviceType,
      topologyConnections
    );
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
    setConfirmDialog({
      show: true,
      message: t.clearTerminalConfirm,
      action: 'clear',
      onConfirm: () => {
        setConfirmDialog(null);
        setDeviceOutputs(prev => {
          const newMap = new Map(prev);
          newMap.set(activeDeviceId, []);
          return newMap;
        });
      }
    });
  };

  // Handle device double click (Open terminal or PC panel)
  const handleDeviceDoubleClick = useCallback((device: 'pc' | 'switch' | 'router', deviceId: string) => {
    // Determine actual device type
    const actualDeviceType = deviceId.includes('router') ? 'router' : deviceId.includes('pc') ? 'pc' : 'switch';

    if (actualDeviceType === 'pc') {
      // PC - open CMD tab
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
            if (statePort && statePort.status !== topoPort.status) {
              // Ensure we translate correctly between Canvas status and Simulator status
              const newStatus = topoPort.status === 'disconnected' || (topoPort.status as any) === 'notconnect'
                ? 'notconnect'
                : topoPort.status as 'connected' | 'disabled' | 'blocked';

              updatedPorts[topoPort.id] = {
                ...statePort,
                status: newStatus
              };
              portChanged = true;
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

    // 1. Identify connections and ports to disconnect FIRST
    const connectionsToRemove = topologyConnections.filter(conn =>
      conn.sourceDeviceId === deviceId || conn.targetDeviceId === deviceId
    );

    const portsToDisconnect = connectionsToRemove.map(conn => {
      if (conn.sourceDeviceId === deviceId) {
        return { deviceId: conn.targetDeviceId, portId: conn.targetPort };
      } else {
        return { deviceId: conn.sourceDeviceId, portId: conn.sourcePort };
      }
    });

    // 2. Release ports on OTHER devices in simulation state (deviceStates)
    setDeviceStates(prev => {
      const newMap = new Map(prev);

      // Reset ports on other devices that were connected to the one being deleted
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

      // Delete the device itself
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

    // 4. Update topology: Remove connections
    const remainingConnections = topologyConnections.filter(conn =>
      conn.sourceDeviceId !== deviceId && conn.targetDeviceId !== deviceId
    );
    setTopologyConnections(remainingConnections);

    // 5. Update EVERYTHING: Full sync of all ports on all remaining devices
    setTopologyDevices(prev => {
      const remainingDevices = prev.filter(d => d.id !== deviceId);

      return remainingDevices.map(device => {
        const updatedPorts = device.ports.map(port => {
          // Check if this port is used in ANY remaining connection
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

    // Also sync the internal simulation state (deviceStates) for ALL devices
    setDeviceStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(deviceId); // Remove deleted device

      // Update all remaining devices
      newMap.forEach((state, id) => {
        if (state.ports) {
          const updatedPorts = { ...state.ports };
          let changed = false;

          Object.keys(updatedPorts).forEach(portId => {
            const isActuallyConnected = remainingConnections.some(conn =>
              (conn.sourceDeviceId === id && conn.sourcePort === portId) ||
              (conn.targetDeviceId === id && conn.targetPort === portId)
            );

            const expectedStatus = isActuallyConnected ? 'connected' : 'notconnect';
            if (updatedPorts[portId].status !== expectedStatus) {
              updatedPorts[portId] = {
                ...updatedPorts[portId],
                status: expectedStatus as any
              };
              changed = true;
            }
          });

          if (changed) {
            newMap.set(id, { ...state, ports: updatedPorts });
          }
        }
      });

      return newMap;
    });

    // If the deleted device was the active one, switch to another device
    if (activeDeviceId === deviceId) {
      // Find another device to switch to (from current topologyDevices)
      const currentDevices = topologyDevices?.filter(d => d.id !== deviceId) || [];
      if (currentDevices.length > 0) {
        const nextDevice = currentDevices[0];
        setActiveDeviceId(nextDevice.id);
        setActiveDeviceType(nextDevice.type as 'pc' | 'switch' | 'router');

        // Switch to topology tab when device changes
        setActiveTab('topology');
      } else {
        // No devices left, reset to default state
        setActiveDeviceId('');
        setActiveDeviceType('switch');
        // Reset to topology tab
        setActiveTab('topology');
      }
    }
    setHasUnsavedChanges(true);
  }, [activeDeviceId, topologyDevices, topologyConnections, showPCDeviceId, selectedDevice, setDeviceStates, setDeviceOutputs, setPcOutputs, setShowPCPanel, setShowPCDeviceId, setSelectedDevice, setActiveDeviceId, setActiveDeviceType, setActiveTab, setHasUnsavedChanges]);

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
        case 'ports':
          return 'Port durumlarını ve bağlantıları incele, fiziksel katmanı gör.';
        case 'vlan':
          return 'VLAN ekle, ata ve VLAN yapılandırmasını yönet.';
        case 'security':
          return 'Şifreler, güvenlik özellikleri ve erişim kontrollerini yönet.';
      }
    } else {
      switch (tabId) {
        case 'topology':
          return 'Design your network by dragging and connecting devices.';
        case 'cmd':
          return 'Use the PC command line to run ping, ipconfig and more.';
        case 'terminal':
          return 'Configure switches/routers using the CLI terminal.';
        case 'ports':
          return 'Inspect port status and physical layer connections.';
        case 'vlan':
          return 'Create and assign VLANs, manage VLAN configuration.';
        case 'security':
          return 'Manage passwords, security features and access control.';
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
            setActiveTab(tabs[index].id);
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
          description: t.failedLoadProject,
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
  }, [loadProjectData, setShowProjectPicker]);

  const isDark = theme === 'dark';

  // Helper function to truncate long names with an ellipsis
  const truncateWithEllipsis = useCallback((text: string, maxLength: number) => {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }, []);

  return (
    <div className={`min-h-screen flex flex-col ${isAppLoading ? 'bg-slate-950 overflow-hidden' : (isDark ? 'bg-slate-950' : 'bg-slate-50')} transition-colors duration-700`}>
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
              <span className="text-xs font-bold tracking-[0.3em] text-cyan-500 uppercase">
                {t.initializingSystem}
              </span>
            </div>
          </motion.div>

          {/* Background scanline effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%]" />
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
        <header className={`${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/90 border-slate-200'} backdrop-blur-xl border-b px-5 py-3 sticky top-0 z-50 pb-0`}>
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
                <div className="hidden sm:flex flex-col">
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
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
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
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-500 transition-colors" onClick={handleUndo} disabled={!canUndo} title={t.undo}>
                        <Undo2 className={`w-4 h-4 ${!canUndo ? 'opacity-30' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-500 transition-colors" onClick={handleRedo} disabled={!canRedo} title={t.redo}>
                        <Redo2 className={`w-4 h-4 ${!canRedo ? 'opacity-30' : ''}`} />
                      </Button>
                      <div className={`w-px h-4 mx-1 ${isDark ? 'bg-slate-700' : 'bg-slate-300'} hidden md:block`} />
                    </>
                  )}

                  {/* Project Controls - Desktop only */}
                  <div className="hidden md:flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:text-green-500 transition-colors"
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
                          className="h-8 w-8 hover:text-amber-500 transition-colors"
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
                          className="h-8 w-8 hover:text-blue-500 transition-colors"
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-sky-500 transition-colors" onClick={() => setShowAboutModal(true)}>
                        <Info className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t.about}</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
                    className="text-xs font-bold h-8 px-2 hover:text-purple-500 transition-colors"
                  >
                    <Languages className="w-4 h-4 mr-1" />
                    {language.toUpperCase()}
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-yellow-500 transition-colors" onClick={toggleTheme}>
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
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">
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
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 px-2 mb-1">{t.navigation}</p>
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
                                className={`w-full justify-start gap-3 h-9 px-3 text-xs font-bold ${isActive ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20' : 'text-slate-400'}`}
                                onClick={() => {
                                  setActiveTab(tab.id);
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
                          <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">{t.labProgress}</span>
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
            <div className="flex sm:hidden items-center gap-1.5 mr-auto">
              {activeTab === 'topology' && (
                <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  {/* Add Button (Device, Cable, Note) */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-emerald-500 hover:bg-emerald-500/10"
                    onClick={() => {
                      const event = new CustomEvent('trigger-topology-palette');
                      window.dispatchEvent(event);
                    }}
                    title={t.add}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>

                  <div className={`w-px h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} mx-0.5`} />

                  {/* Connect Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-cyan-500 hover:bg-cyan-500/10"
                    onClick={() => {
                      const event = new CustomEvent('trigger-topology-connect');
                      window.dispatchEvent(event);
                    }}
                    title={t.connect}
                  >
                    <Link2 className="w-5 h-5" />
                  </Button>
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
                <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 py-2">
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
            <div className="hidden sm:flex items-end gap-1">
              {tabs.map((tab, index) => {
                const isActive = activeTab === tab.id;
                // Unified Color Mapping
                const tabColors: Record<string, string> = {
                  topology: 'text-blue-500 hover:text-blue-500',
                  cmd: 'text-emerald-500 hover:text-emerald-500',
                  terminal: 'text-emerald-500 hover:text-emerald-600',
                  ports: 'text-cyan-500 hover:text-cyan-600',
                  vlan: 'text-purple-500 hover:text-purple-600',
                  security: 'text-amber-500 hover:text-amber-600',
                }; const colorClass = tabColors[tab.id] || 'text-slate-500 hover:text-slate-600';

                return (
                  <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-3 lg:px-5 py-3 rounded-t-xl text-sm font-semibold transition-all border-x border-t min-w-[50px] lg:min-w-[120px] justify-center ${isActive
                          ? `${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'} ${colorClass.split(' ')[0]} shadow-[0_-4px_0_0_currentColor]`
                          : `${isDark ? 'bg-slate-900/50 border-transparent' : 'bg-slate-200/50 border-transparent'} ${colorClass} hover:bg-slate-200/30`
                          }`}
                      >
                        <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                          {tab.id === 'topology' ? <Network className="w-4 h-4" /> :
                            (tab.id === 'cmd' || tab.id === 'terminal') ? <TerminalIcon className="w-4 h-4" /> :
                              tab.id === 'ports' ? <Database className="w-4 h-4" /> :
                                tab.id === 'vlan' ? <Layers className="w-4 h-4" /> :
                                  <ShieldCheck className="w-4 h-4" />}
                        </span>
                        <span className="hidden lg:inline flex items-center gap-1.5">
                          {tab.label}
                          {tab.id === 'ports' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">
                              {completedPortTasks}/{portTasks.length}
                            </span>
                          )}
                          {tab.id === 'vlan' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300">
                              {completedVlanTasks}/{vlanTasks.length}
                            </span>
                          )}
                          {tab.id === 'security' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                              {completedSecurityTasks}/{securityTasks.length}
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
        <div className={`sm:hidden fixed bottom-0 left-0 right-0 z-[100] border-t backdrop-blur-xl flex items-center justify-around px-2 mobile-bottom-nav ${isDark ? 'bg-slate-900/95 border-slate-800 text-slate-400' : 'bg-white/95 border-slate-200 text-slate-500'
          } ${showProjectPicker || showOnboarding ? 'hidden' : ''}`}>
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;

            // Shared Color Mapping
            const tabColors: Record<string, string> = {
              topology: 'text-blue-500 hover:text-blue-500',
              cmd: 'text-blue-500 hover:text-blue-500',
              terminal: 'text-emerald-500 hover:text-emerald-600',
              ports: 'text-cyan-500 hover:text-cyan-600',
              vlan: 'text-purple-500 hover:text-purple-600',
              security: 'text-amber-500 hover:text-amber-600',
            };
            const colorClass = tabColors[tab.id] || 'text-slate-500 hover:text-slate-600';

            return (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-col items-center justify-center min-h-[44px] flex-1 px-3 py-2 rounded-xl transition-all relative ${isActive ? 'text-blue-500' : `${colorClass} active:scale-95`
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="mobileTabActive"
                        className="absolute inset-0 bg-blue-500/10 rounded-xl"
                        transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                      />
                    )}
                    <div className={`relative z-10 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                      {tab.id === 'topology' ? <Network className="w-5 h-5" /> :
                        (tab.id === 'cmd' || tab.id === 'terminal') ? <TerminalIcon className="w-5 h-5" /> :
                          tab.id === 'ports' ? <Database className="w-5 h-5" /> :
                            tab.id === 'vlan' ? <Layers className="w-5 h-5" /> :
                              <ShieldCheck className="w-5 h-5" />}
                    </div>
                    <span className="mt-0.5 text-[10px] font-semibold leading-tight relative z-10">
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
          <DialogContent className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white'} w-screen h-screen max-w-none m-0 rounded-none`}>
            <DialogHeader>
              <DialogTitle>{language === 'tr' ? 'Yeni Proje' : 'New Project'}</DialogTitle>
              <DialogDescription className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                {language === 'tr' ? 'Boş bir proje başlat veya hazır örneklerden birini seç.' : 'Start with an empty project or choose a ready-made example.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 h-[calc(100vh-8rem)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 hover:scrollbar-thumb-slate-500 transition-colors">
              <Button
                variant="outline"
                className={`justify-between ${isDark ? 'border-slate-800 hover:bg-slate-800/60' : ''}`}
                onClick={() => { setShowProjectPicker(false); runWithSaveGuard(() => { resetToEmptyProject(); }); }}
              >
                <span className="font-semibold">{language === 'tr' ? 'Boş Proje' : 'Empty Project'}</span>
                <span className="text-xs opacity-70">{language === 'tr' ? 'Sıfırdan başla' : 'Start from scratch'}</span>
              </Button>
              {exampleProjects(language).map((example) => (
                <Button
                  key={example.id}
                  variant="ghost"
                  className={`h-auto flex-col items-start gap-1 px-4 py-3 text-left border ${isDark ? 'border-slate-800 hover:bg-slate-800/60' : 'border-slate-200 hover:bg-slate-100'}`}
                  onClick={() => { setShowProjectPicker(false); runWithSaveGuard(() => applyExampleProject(example.data)); }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold">{example.title}</span>
                    <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{example.tag}</span>
                  </div>
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{example.description}</span>
                  {example.detail && (
                    <span className={`text-[11px] ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{example.detail}</span>
                  )}
                </Button>
              ))}
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
          <DialogContent className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white'} sm:max-w-lg`}>
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
        <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
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
                onClick={() => confirmDialog?.onConfirm()}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {t.continue}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!saveDialog} onOpenChange={(open) => !open && setSaveDialog(null)}>
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
                onClick={() => saveDialog?.onConfirm(false)}
                className={isDark ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : ''}
              >
                {t.dontSave}
              </Button>
              <AlertDialogAction
                onClick={() => saveDialog?.onConfirm(true)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {t.saveLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Main Content with matching top background */}
        <main className={`flex-1 overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
          <div className="w-full p-5 pb-20 sm:pb-5 h-full flex flex-col">
            {/* Tab Content */}
            {activeTab === 'topology' && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Network Topology fills remaining space */}
                <div ref={topologyContainerRef} className="flex-1 w-full flex flex-col min-h-[500px]">
                  <NetworkTopology
                    key={topologyKey}
                    cableInfo={cableInfo}
                    onCableChange={setCableInfo}
                    selectedDevice={selectedDevice}
                    onDeviceSelect={handleDeviceSelectFromCanvas}
                    onDeviceDoubleClick={handleDeviceDoubleClick}
                    onTopologyChange={handleTopologyChange}
                    onDeviceDelete={handleDeviceDelete}
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
            <div className={`w-full h-full overflow-hidden flex flex-col min-h-[calc(100vh-8rem)] sm:min-h-[450px] ${activeTab === 'cmd' ? 'block' : 'hidden'}`}>
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
            <div className={`flex-1 flex flex-col gap-4 overflow-hidden min-h-[450px] ${activeTab === 'terminal' ? 'flex' : 'hidden'}`}>
              <div className="grid lg:grid-cols-4 gap-4 flex-1 overflow-hidden">
                <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
                  <Terminal
                    key="terminal"
                    deviceId={activeDeviceId}
                    // use same display name as the dropdown (hostname or topology name)
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
                  />
                  <QuickCommands
                    currentMode={state.currentMode}
                    onExecuteCommand={handleCommand}
                    isDevicePoweredOff={topologyDevices.some(d => d.id === activeDeviceId && d.status === 'offline')}
                    t={t}
                    theme={theme}
                    language={language}
                  />
                </div>
                <div className="space-y-4">
                  <ConfigPanel
                    state={state}
                    onExecuteCommand={handleCommand}
                    isDevicePoweredOff={topologyDevices.some(d => d.id === activeDeviceId && d.status === 'offline')}
                    t={t}
                    theme={theme}
                  />
                </div>
              </div>
            </div>

            {/* Portlar Sekmesi */}
            {activeTab === 'ports' && (
              <div className="grid lg:grid-cols-3 gap-4 flex-1 overflow-y-auto custom-scrollbar">
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
                </div>
                <div>
                  <TaskCard
                    tasks={portTasks}
                    state={state}
                    context={taskContext}
                    color="from-yellow-500 to-orange-500"
                    isDark={isDark}
                  />
                </div>
              </div>
            )}

            {/* VLAN Sekmesi */}
            {activeTab === 'vlan' && (
              <div className="grid lg:grid-cols-3 gap-4 flex-1 overflow-y-auto custom-scrollbar">
                <div className="lg:col-span-2">
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
                </div>
                <div>
                  <TaskCard
                    tasks={vlanTasks}
                    state={state}
                    context={taskContext}
                    color="from-purple-500 to-pink-500"
                    isDark={isDark}
                  />
                </div>
              </div>
            )}

            {/* Güvenlik Sekmesi */}
            {activeTab === 'security' && (
              <div className="grid lg:grid-cols-3 gap-4 flex-1 overflow-y-auto custom-scrollbar">
                <div className="lg:col-span-2">
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
                    tasks={securityTasks}
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
        <footer className={`fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl transition-all ${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
          } ${showProjectPicker || showOnboarding ? 'hidden' : ''}`}>
          <div className="w-full px-5 py-2">
            <div className="flex items-center justify-between gap-4">
              {/* Save Status */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-100 border-slate-200'
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
                      {(language === 'tr' ? 'Son: ' : 'Last: ') + lastSaveTime}
                    </span>
                  )}
                </div>

                {/* Quick Hints */}
                <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-100 border-slate-200'
                  }`}>
                  <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {language === 'tr' ? 'İpuçları:' : 'Tips:'}
                  </span>
                  <span className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {activeTab === 'topology' && (
                      <>
                        <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                          }`}>Ctrl+Z</kbd>
                        <span className="mx-1">{language === 'tr' ? 'Geri' : 'Undo'}</span>
                        <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                          }`}>Ctrl+Y</kbd>
                        <span className="mx-1">{language === 'tr' ? 'İleri' : 'Redo'}</span>
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
                          }`}>Ctrl+1-5</kbd>
                        <span className="mx-1">{language === 'tr' ? 'Sekmeler' : 'Tabs'}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Lab Progress */}
              {totalScore > 0 && (
                <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-100 border-slate-200'
                  }`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
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
  );
}
