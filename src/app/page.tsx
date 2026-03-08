'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SwitchState, CableInfo } from '@/lib/cisco/types';
import { createInitialState } from '@/lib/cisco/initialState';
import { useDeviceManager } from '@/hooks/useDeviceManager';
// Duplicate removed
import { NetworkTopology, CanvasDevice, CanvasConnection } from '@/components/cisco/NetworkTopology';
import { PCPanel } from '@/components/cisco/PCPanel';
import { getPrompt } from '@/lib/cisco/executor';
import { Terminal, TerminalOutput } from '@/components/cisco/Terminal';
import { PortPanel } from '@/components/cisco/PortPanel';
import { VlanPanel } from '@/components/cisco/VlanPanel';
import { SecurityPanel } from '@/components/cisco/SecurityPanel';
import { ConfigPanel } from '@/components/cisco/ConfigPanel';
import { QuickCommands } from '@/components/cisco/QuickCommands';
import { TaskCard } from '@/components/cisco/TaskCard';

import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  topologyTasks,
  portTasks,
  vlanTasks,
  securityTasks,
  calculateTaskScore,
  TaskContext
} from '@/lib/cisco/taskDefinitions';

type TabType = 'topology' | 'cmd' | 'terminal' | 'ports' | 'vlan' | 'security';

// PC Output type for PCPanel
interface PCOutputLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'success';
  content: string;
}

export default function Home() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const {
    deviceStates,
    setDeviceStates,
    deviceOutputs,
    setDeviceOutputs,
    pcOutputs,
    setPcOutputs,
    isLoading,
    confirmDialog,
    setConfirmDialog,
    getOrCreateDeviceState,
    getOrCreateDeviceOutputs,
    getOrCreatePCOutputs,
    handleCommandForDevice,
    resetAll
  } = useDeviceManager(language);

  // Currently active device in terminal
  const [activeDeviceId, setActiveDeviceId] = useState<string>('switch-1');
  const [activeDeviceType, setActiveDeviceType] = useState<'pc' | 'switch' | 'router'>('switch');

  // Topology state - managed in page.tsx for save/load functionality
  const [topologyDevices, setTopologyDevices] = useState<CanvasDevice[] | null>(null);
  const [topologyConnections, setTopologyConnections] = useState<CanvasConnection[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Legacy state for compatibility with other panels (uses active device's state)
  // MOVED AFTER topologyDevices initialization
  const state = (() => {
    const activeDevice = topologyDevices?.find(d => d.id === activeDeviceId);
    return getOrCreateDeviceState(activeDeviceId, activeDeviceType, activeDevice?.name);
  })();
  const output = getOrCreateDeviceOutputs(activeDeviceId);

  const [activeTab, setActiveTab] = useState<TabType>('topology');
  const [cableInfo, setCableInfo] = useState<CableInfo>({
    connected: true,
    cableType: 'straight',
    sourceDevice: 'pc',
    targetDevice: 'switch',
  });

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

  // Score animation state
  const [scoreAnimation, setScoreAnimation] = useState<{ 
    change: number; 
    isIncreasing: boolean; 
    showAnimation: boolean 
  }>({ change: 0, isIncreasing: true, showAnimation: false });

  const [selectedDevice, setSelectedDevice] = useState<'pc' | 'switch' | 'router' | null>(null);
  const [showPCPanel, setShowPCPanel] = useState(false);
  const [showPCDeviceId, setShowPCDeviceId] = useState<string>('pc-1');

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveDialog, setSaveDialog] = useState<{
    show: boolean;
    message: string;
    onConfirm: (save: boolean) => void;
  } | null>(null);

  // Topology reset key - changes when creating new project to force component remount
  const [topologyKey, setTopologyKey] = useState(0);

  // UI state for dropdowns
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showActiveDeviceDropdown, setShowActiveDeviceDropdown] = useState(false);
  const dropdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Broadcast to other components (like NetworkTopology)
  const broadcastCloseMenus = useCallback((source: string) => {
    window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source } }));
  }, []);

  const closeLocalMenus = useCallback((exclude?: string) => {
    if (exclude !== 'mobile') setShowMobileMenu(false);
    if (exclude !== 'device') setShowActiveDeviceDropdown(false);
    if (exclude !== 'modal') {
      setConfirmDialog(null);
      setSaveDialog(null);
    }
  }, [setConfirmDialog, setSaveDialog]);

  const openMobileMenu = useCallback(() => {
    const nextState = !showMobileMenu;
    if (nextState) {
      closeLocalMenus('mobile');
      broadcastCloseMenus('mobile');
    }
    setShowMobileMenu(nextState);
  }, [showMobileMenu, closeLocalMenus, broadcastCloseMenus]);

  const openDeviceDropdown = useCallback(() => {
    if (!topologyDevices || topologyDevices.length === 0) return;
    const nextState = !showActiveDeviceDropdown;
    
    if (dropdownTimerRef.current) {
      clearTimeout(dropdownTimerRef.current);
    }

    if (nextState) {
      closeLocalMenus('device');
      broadcastCloseMenus('device');
      
      // Auto-close after 3 seconds
      dropdownTimerRef.current = setTimeout(() => {
        setShowActiveDeviceDropdown(false);
      }, 3000);
    }
    
    setShowActiveDeviceDropdown(nextState);
  }, [showActiveDeviceDropdown, closeLocalMenus, broadcastCloseMenus, topologyDevices]);

  // Handle device selection (single click) - just select the device, don't change tabs
  const handleDeviceSelect = useCallback((device: 'pc' | 'switch' | 'router', deviceId?: string) => {
    setSelectedDevice(device);
    if (deviceId) {
      // Determine actual device type from deviceId or use the passed type
      const actualDeviceType = deviceId.includes('router') ? 'router' : deviceId.includes('pc') ? 'pc' : 'switch';

      // Set the active device but DON'T switch tabs
      setActiveDeviceId(deviceId);
      setActiveDeviceType(actualDeviceType);

      // Initialize device state if needed (for switches/routers)
      if (actualDeviceType !== 'pc') {
        const deviceObj = topologyDevices?.find(d => d.id === deviceId);
        getOrCreateDeviceState(deviceId, actualDeviceType, deviceObj?.name);
        getOrCreateDeviceOutputs(deviceId);
      }
    }
  }, [getOrCreateDeviceState, getOrCreateDeviceOutputs, topologyDevices]);

  // Handle command using active device
  const handleCommand = useCallback(async (command: string) => {
    await handleCommandForDevice(
      activeDeviceId, 
      command, 
      topologyDevices, 
      setActiveDeviceId, 
      setActiveDeviceType
    );
  }, [activeDeviceId, handleCommandForDevice, topologyDevices]);

  const prompt = getPrompt(state);

  const handleExecuteCommand = useCallback(async (deviceId: string, command: string) => {
    return handleCommandForDevice(
      deviceId,
      command,
      topologyDevices,
      setActiveDeviceId,
      setActiveDeviceType
    );
  }, [handleCommandForDevice, topologyDevices]);

  const handleReset = () => {
    setConfirmDialog({
      show: true,
      message: language === 'tr' 
        ? 'Tüm yapılandırma sıfırlanacak. Devam etmek istiyor musunuz?'
        : 'All configuration will be reset. Do you want to continue?',
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
      message: language === 'tr'
        ? 'Terminal çıktısı temizlenecek. Devam etmek istiyor musunuz?'
        : 'Terminal output will be cleared. Do you want to continue?',
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
      getOrCreateDeviceState(deviceId, actualType, deviceObj?.name);
      getOrCreateDeviceOutputs(deviceId);
      setActiveTab('terminal');
    }
  }, [getOrCreateDeviceState, getOrCreateDeviceOutputs, topologyDevices]);

  // Handle topology change from NetworkTopology component
  const handleTopologyChange = useCallback((devices: CanvasDevice[], connections: CanvasConnection[]) => {
    setTopologyDevices(devices);
    setTopologyConnections(connections);
    setHasUnsavedChanges(true);
  }, []);

  // Handle device deletion - update active device if needed
  const handleDeviceDelete = useCallback((deviceId: string) => {
    // Close PC panel if showing the deleted device
    if (showPCDeviceId === deviceId) {
      setShowPCPanel(false);
      setShowPCDeviceId('pc-1');
    }
    
    // Close device dropdown if open
    setShowActiveDeviceDropdown(false);

    // Reset selected device if deleted
    if (selectedDevice) {
      setSelectedDevice(null);
    }
    
    // Clear device state from maps
    setDeviceStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(deviceId);
      return newMap;
    });
    
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
  }, [activeDeviceId, topologyDevices, showPCDeviceId, selectedDevice, setDeviceStates, setDeviceOutputs, setPcOutputs]);

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
      topology: {
        devices: topologyDevices,
        connections: topologyConnections
      },
      cableInfo,
      activeDeviceId,
      activeDeviceType
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cisco-project-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setHasUnsavedChanges(false);
  }, [deviceStates, deviceOutputs, pcOutputs, topologyDevices, topologyConnections, cableInfo, activeDeviceId, activeDeviceType]);

  // Handle Project Saving (Wrapper)
  function handleSaveProject() {
    handleSaveProjectInternal();
  }

  // New project - reset everything
  const handleNewProjectInternal = useCallback(() => {
    const doNewProject = () => {
      setDeviceStates(new Map([['switch-1', createInitialState()]]));
      setDeviceOutputs(new Map([['switch-1', []]]));
      setTopologyDevices(null);
      setTopologyConnections(null);
      setActiveDeviceId('switch-1');
      setActiveDeviceType('switch');
      setActiveTab('topology');
      setHasUnsavedChanges(false);
      // Increment key to force NetworkTopology remount
      setTopologyKey(prev => prev + 1);
    };

    if (hasUnsavedChanges) {
      setSaveDialog({
        show: true,
        message: language === 'tr'
          ? 'Kaydedilmemiş değişiklikler var. Kaydetmek istiyor musunuz?'
          : 'You have unsaved changes. Do you want to save?',
        onConfirm: (save: boolean) => {
          setSaveDialog(null);
          if (save) {
            handleSaveProject();
          }
          doNewProject();
        }
      });
    } else {
      setConfirmDialog({
        show: true,
        message: language === 'tr' 
          ? 'Tüm yapılandırma ve topoloji sıfırlanacak. Devam etmek istiyor musunuz?'
          : 'All configuration and topology will be reset. Do you want to continue?',
        action: 'new-project',
        onConfirm: () => {
          setConfirmDialog(null);
          doNewProject();
        }
      });
    }
  }, [language, hasUnsavedChanges, handleSaveProject, setDeviceStates, setDeviceOutputs]);

  function handleNewProject() {
    handleNewProjectInternal();
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

      const isDefaultCLIHostname = deviceState.hostname === 'Switch' || deviceState.hostname === 'Router';
      
      if (deviceState.hostname !== device.name) {
        if (isDefaultCLIHostname) {
          // Simulator has generic default name, Topology has specific name (like Switch-1)
          // -> Sync Topology name to Simulator
          simulatorChanged = true;
          newDeviceStates.set(device.id, { ...deviceState, hostname: device.name });
          return device;
        } else {
          // Simulator has custom name (manually changed via CLI) 
          // -> Sync Simulator name to Topology
          topologyChanged = true;
          return { ...device, name: deviceState.hostname };
        }
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
  }, [deviceStates, topologyDevices, setDeviceStates]);

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

  // Position device dropdown when it opens
  useEffect(() => {
    if (showActiveDeviceDropdown) {
      const menu = document.getElementById('device-dropdown-menu');
      const container = document.querySelector('.device-dropdown-container');
      if (menu && container) {
        const btn = container.querySelector('button');
        if (btn) {
          const rect = btn.getBoundingClientRect();
          menu.style.top = `${rect.bottom + 4}px`;
          menu.style.left = `${rect.left}px`;
        }
      }
    }
  }, [showActiveDeviceDropdown]);

  // Handle back button on mobile: popstate shuts down everything
  useEffect(() => {
    const handlePopState = () => {
      setShowActiveDeviceDropdown(false);
      setShowMobileMenu(false);
      setConfirmDialog(null);
      setSaveDialog(null);
      setShowPCPanel(false);
      window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source: 'back' } }));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // History pushState for back button tracking
  useEffect(() => {
    const anyModalOpen = showActiveDeviceDropdown || showMobileMenu || !!confirmDialog || !!saveDialog || showPCPanel;
    if (anyModalOpen) {
      window.history.pushState({ modal: true }, '');
    }
  }, [showActiveDeviceDropdown, showMobileMenu, confirmDialog, saveDialog, showPCPanel]);

  // Handle key events: ESC to close, ENTER to confirm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowActiveDeviceDropdown(false);
        setShowMobileMenu(false);
        setConfirmDialog(null);
        setSaveDialog(null);
        setShowPCPanel(false);
        window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source: 'escape' } }));
      }
      
      // Ctrl Shortcuts
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
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
      }

      // Shift Shortcuts
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'n') {
          e.preventDefault();
          handleNewProject();
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
  }, [showActiveDeviceDropdown, showMobileMenu, confirmDialog, saveDialog, showPCPanel, handleSaveProject, handleNewProject]);

  // Load project from JSON file
  const handleLoadProject = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const projectData = JSON.parse(e.target?.result as string);
        
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
            newDeviceOutputs.set(item.id, item.outputs || []);
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

        // Load topology
        if (projectData.topology) {
          setTopologyDevices(projectData.topology.devices || null);
          setTopologyConnections(projectData.topology.connections || null);
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

        // Increment topology key to force remount with new data
        setTopologyKey(prev => prev + 1);
        setHasUnsavedChanges(false);

      } catch (error) {
        alert(language === 'tr' ? 'Proje dosyası yüklenemedi!' : 'Failed to load project file!');
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  }, [language, setDeviceStates, setDeviceOutputs, setPcOutputs]);

  const isDark = theme === 'dark';

  // Tab definitions
  const allTabs: { id: TabType; label: string; icon: React.ReactNode; tasks: typeof topologyTasks; color: string; showFor: string[] }[] = [
    {
      id: 'topology',
      label: language === 'tr' ? 'Ağ Topolojisi' : 'Network Topology',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="16" y="16" width="6" height="6" rx="1" />
          <rect x="2" y="16" width="6" height="6" rx="1" />
          <rect x="9" y="2" width="6" height="6" rx="1" />
          <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
          <path d="M12 12V8" />
        </svg>
      ),
      tasks: topologyTasks,
      color: 'from-cyan-500 to-blue-500',
      showFor: ['pc', 'switch', 'router']
    },
    {
      id: 'cmd',
      label: language === 'tr' ? 'CMD Terminali' : 'CMD Terminal',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      ),
      tasks: [],
      color: 'from-blue-500 to-indigo-500',
      showFor: ['pc']
    },
    {
      id: 'terminal',
      label: language === 'tr' ? 'Terminal' : 'Terminal',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      tasks: [],
      color: 'from-green-500 to-emerald-500',
      showFor: ['switch', 'router']
    },
    {
      id: 'ports',
      label: language === 'tr' ? 'Portlar' : 'Ports',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="6" cy="12" r="1" />
          <circle cx="10" cy="12" r="1" />
          <circle cx="14" cy="12" r="1" />
          <circle cx="18" cy="12" r="1" />
        </svg>
      ),
      tasks: portTasks,
      color: 'from-yellow-500 to-orange-500',
      showFor: ['switch', 'router']
    },
    {
      id: 'vlan',
      label: language === 'tr' ? 'VLAN' : 'VLAN',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 12-8.5 8.5" />
          <path d="m9 12-8.5 8.5" />
          <circle cx="18" cy="11" r="3" />
          <circle cx="14" cy="5" r="3" />
          <circle cx="10" cy="11" r="3" />
        </svg>
      ),
      tasks: vlanTasks,
      color: 'from-purple-500 to-pink-500',
      showFor: ['switch', 'router']
    },
    {
      id: 'security',
      label: language === 'tr' ? 'Güvenlik' : 'Security',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      tasks: securityTasks,
      color: 'from-red-500 to-rose-500',
      showFor: ['switch', 'router']
    },
  ];

  const tabs = allTabs.filter(tab => {
    // Topoloji sekmesi her zaman görünür
    if (tab.id === 'topology') return true;
    
    // Ekranda nesne yoksa diğer sekmeleri gizle
    if (!topologyDevices || topologyDevices.length === 0) return false;
    
    // Nesne varsa tipe göre filtrele
    return tab.showFor.includes(activeDeviceType);
  });
  
  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100'}`}>
      {/* Header */}
      <header className={`${isDark ? 'bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95' : 'bg-gradient-to-r from-white/90 via-blue-50/80 to-white/90'} backdrop-blur-xl border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200/50'} px-4 py-3 sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <a href="/" className="flex items-center gap-4 hover:opacity-90 transition-all cursor-pointer group">
              <div className={`p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-xl shadow-cyan-500/30 group-hover:scale-110 group-active:scale-95 transition-transform duration-300`}>
                <svg className="w-6 h-6 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500 bg-clip-text text-transparent drop-shadow-sm">
                  {t.title}
                </h1>
                <p className={`text-[10px] tracking-widest font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.subtitle}</p>
              </div>
            </a>

            {/* Total Score - Desktop */}
            <div className="hidden lg:flex items-center gap-4">
              <div className={`px-5 py-2.5 rounded-2xl ${isDark ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-md border ${isDark ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-lg shadow-black/5 relative group transition-all`}>
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <span className={`text-[10px] font-bold tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {language === 'tr' ? 'Lab İlerlemesi' : 'Lab Progress'}
                  </span>
                  <span className={`text-xs font-bold ${totalScore >= maxScore * 0.7 ? 'text-emerald-400' : totalScore >= maxScore * 0.4 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {Math.round((totalScore / maxScore) * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-32 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'} shadow-inner`}>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(totalScore / maxScore) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 50, damping: 15 }}
                      className={`h-full bg-gradient-to-r ${totalScore >= maxScore * 0.7 ? 'from-emerald-500 to-teal-400' : totalScore >= maxScore * 0.4 ? 'from-amber-500 to-orange-400' : 'from-rose-500 to-pink-500'}`} 
                    />
                  </div>
                  <span className={`text-sm font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {totalScore}<span className={`font-medium opacity-40 ml-0.5`}>/{maxScore}</span>
                  </span>
                </div>
                {/* Score animation overlay */}
                {scoreAnimation.showAnimation && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={`absolute inset-0 flex items-center justify-center rounded-2xl pointer-events-none z-10 ${
                      scoreAnimation.isIncreasing 
                        ? 'bg-emerald-500/10' 
                        : 'bg-rose-500/10'
                    }`}
                  >
                    <span className={`text-2xl font-black drop-shadow-sm ${scoreAnimation.isIncreasing ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {scoreAnimation.isIncreasing ? '↑' : '↓'}
                      {scoreAnimation.change}
                    </span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={openMobileMenu}
              className={`md:hidden p-2 rounded-lg ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-200 hover:bg-slate-300'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Controls - Desktop */}
            <div className="hidden md:flex items-center gap-2">
              <div className={`flex items-center gap-1 rounded-lg p-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewProject}
                  className={`text-xs px-2 h-7 ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  title={language === 'tr' ? 'Yeni Proje (Shift+N)' : 'New Project (Shift+N)'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveProject}
                  className={`text-xs px-2 h-7 ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  title={language === 'tr' ? 'Projeyi Kaydet (Ctrl+S)' : 'Save Project (Ctrl+S)'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className={`text-xs px-2 h-7 ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  title={language === 'tr' ? 'Proje Yükle (Ctrl+O)' : 'Load Project (Ctrl+O)'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleLoadProject}
                  className="hidden"
                />
              </div>

              <div className={`flex items-center gap-1 rounded-lg p-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <Button
                  variant={language === 'tr' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setLanguage('tr')}
                  className={`text-xs px-2 h-7 ${language === 'tr' ? 'bg-cyan-600 text-white' : isDark ? 'text-slate-300' : 'text-slate-600'}`}
                >
                  TR
                </Button>
                <Button
                  variant={language === 'en' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setLanguage('en')}
                  className={`text-xs px-2 h-7 ${language === 'en' ? 'bg-cyan-600 text-white' : isDark ? 'text-slate-300' : 'text-slate-600'}`}
                >
                  EN
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="h-8 w-8 p-0"
              >
                {isDark ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </Button>
            </div>
          </div>
          <div className="flex-1 min-w-0 mt-4">
            <div className="flex items-end gap-1 flex-wrap lg:flex-nowrap">
              {/* Active Device Selector Dropdown as a Tab */}
              {activeDeviceId && topologyDevices && topologyDevices.length > 0 && (() => {
                const activeDevice = topologyDevices?.find(d => d.id === activeDeviceId);
                const hostname = deviceStates.get(activeDeviceId)?.hostname || activeDevice?.name || 'Device';
                const currentType = activeDevice?.type || activeDeviceType;
                const typeLabel = currentType === 'pc' ? 'PC' : currentType === 'router' ? 'Router' : 'Switch';
                
                return (
                <div className="relative device-dropdown-container">
                  <button
                    onClick={openDeviceDropdown}
                    className={`flex items-center gap-2 pl-4 pr-3 py-2.5 text-sm font-semibold transition-all rounded-t-lg border-b-0 ${
                      !topologyDevices || topologyDevices.length === 0
                        ? isDark 
                          ? 'bg-slate-800/30 text-slate-500 border-slate-700/50 cursor-not-allowed opacity-50'
                          : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed opacity-50'
                        : isDark 
                          ? 'bg-slate-800 text-cyan-400 border-slate-700 hover:bg-slate-700/50' 
                          : 'bg-white text-cyan-700 border-slate-200 hover:bg-slate-50'
                    } shadow-sm`}
                  >
                  </button>
                </div>
              )})()}

              {/* Standard Tabs */}
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-t-xl text-sm font-semibold transition-all border-x border-t ${
                      isActive
                        ? isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
                        : isDark ? 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with matching top background */}
      <main className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
        <div className="max-w-7xl w-full mx-auto p-4 pb-6 h-full">
        {/* Tab Content */}
        {activeTab === 'topology' && (
          <div className="space-y-4">
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Network Topology */}
              <div className="lg:col-span-2 w-full flex flex-col min-h-[450px]">
                <NetworkTopology
                  key={topologyKey}
                  cableInfo={cableInfo}
                  onCableChange={setCableInfo}
                  selectedDevice={selectedDevice}
                  onDeviceSelect={handleDeviceSelect}
                  onDeviceDoubleClick={handleDeviceDoubleClick}
                  onTopologyChange={handleTopologyChange}
                  onDeviceDelete={handleDeviceDelete}
                  initialDevices={topologyDevices || undefined}
                  initialConnections={topologyConnections || undefined}
                  isActive={activeTab === 'topology'}
                  activeDeviceId={activeDeviceId}
                  deviceStates={deviceStates}
                />
              </div>
              
              {/* Task Card */}
              <div className="w-full">
                <TaskCard
                  tasks={topologyTasks}
                  state={state}
                  context={taskContext}
                  color="from-cyan-500 to-blue-500"
                  isDark={isDark}
                />
              </div>
            </div>
          </div>
        )}

        {/* CMD Terminal Sekmesi */}
        {activeTab === 'cmd' && (
          <div className="w-full h-full overflow-hidden flex flex-col">
            <PCPanel
              deviceId={activeDeviceId}
              cableInfo={cableInfo}
              isVisible={true}
              onClose={() => setActiveTab('topology')}
              topologyDevices={topologyDevices || undefined}
              topologyConnections={topologyConnections || undefined}
              deviceStates={deviceStates}
              onExecuteDeviceCommand={handleExecuteCommand}
            />
          </div>
        )}

        {/* Terminal Sekmesi - Fixed Layout with Footer at Bottom */}
        {activeTab === 'terminal' && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="grid lg:grid-cols-4 gap-4 flex-1 overflow-hidden">
              <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
                <Terminal
                  deviceId={activeDeviceId}
                  // use same display name as the dropdown (hostname or topology name)
                  deviceName={
                    (() => {
                      const activeDevice = topologyDevices?.find(d => d.id === activeDeviceId);
                      const deviceState = deviceStates.get(activeDeviceId);
                      return deviceState?.hostname || activeDevice?.name || 'Device';
                    })()
                  }
                  prompt={prompt}
                  state={state}
                  onCommand={handleCommand}
                  onClear={handleClearTerminal}
                  output={output}
                  isLoading={isLoading}
                  t={t}
                  theme={theme}
                  language={language}
                />
                <QuickCommands
                  currentMode={state.currentMode}
                  onExecuteCommand={handleCommand}
                  t={t}
                  theme={theme}
                  language={language}
                />
              </div>
              <div className="space-y-4">
                <ConfigPanel
                  state={state}
                  onExecuteCommand={handleCommand}
                  t={t}
                  theme={theme}
                />
              </div>
            </div>
          </div>
        )}

        {/* Portlar Sekmesi */}
        {activeTab === 'ports' && (
          <div className="grid lg:grid-cols-3 gap-4 flex-1 overflow-y-auto custom-scrollbar">
            <div className="lg:col-span-2">
              <PortPanel 
                ports={state.ports}
                t={t} 
                theme={theme}
                deviceName={state.hostname}
                deviceModel={activeDeviceType === 'router' ? 'CISCO-1941' : 'WS-C2960-24TT-L'}
                activeDeviceId={activeDeviceId}
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
                deviceModel={activeDeviceType === 'router' ? 'CISCO-1941' : 'WS-C2960-24TT-L'}
                onExecuteCommand={handleCommand}
                t={t}
                theme={theme}
                activeDeviceType={activeDeviceType}
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
              <SecurityPanel security={state.security} t={t} theme={theme} />
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
    </div>
  );
}
