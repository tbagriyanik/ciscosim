'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { SwitchState, CableInfo, CommandResult } from '@/lib/cisco/types';
import { createInitialState, createInitialRouterState } from '@/lib/cisco/initialState';
// Duplicate removed
import { NetworkTopology, CanvasDevice, CanvasConnection } from '@/components/cisco/NetworkTopology';
import { PCPanel } from '@/components/cisco/PCPanel';
import { executeCommand, getPrompt } from '@/lib/cisco/executor';
import { Terminal, TerminalOutput } from '@/components/cisco/Terminal';
import { PortPanel } from '@/components/cisco/PortPanel';
import { VlanPanel } from '@/components/cisco/VlanPanel';
import { SecurityPanel } from '@/components/cisco/SecurityPanel';
import { ConfigPanel } from '@/components/cisco/ConfigPanel';
import { QuickCommands } from '@/components/cisco/QuickCommands';
import { TaskCard } from '@/components/cisco/TaskCard';
import { AppFooter } from '@/components/cisco/AppFooter';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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

  // Per-device state management
  const [deviceStates, setDeviceStates] = useState<Map<string, SwitchState>>(() => {
    const initialMap = new Map<string, SwitchState>();
    initialMap.set('switch-1', createInitialState());
    return initialMap;
  });

  // Per-device terminal outputs
  const [deviceOutputs, setDeviceOutputs] = useState<Map<string, TerminalOutput[]>>(() => {
    const initialMap = new Map<string, TerminalOutput[]>();
    initialMap.set('switch-1', []);
    return initialMap;
  });

  // Per-device PC outputs
  const [pcOutputs, setPcOutputs] = useState<Map<string, PCOutputLine[]>>(() => {
    const initialMap = new Map<string, PCOutputLine[]>();
    initialMap.set('pc-1', [
      {
        id: '0',
        type: 'output',
        content: 'Microsoft Windows [Version 10.0.19045.3803]\n(c) Microsoft Corporation. Tüm hakları saklıdır.\n'
      },
      {
        id: '1',
        type: 'output',
        content: '\nEthernet adapter Ethernet bağlantısı:\n'
      }
    ]);
    return initialMap;
  });

  // Currently active device in terminal
  const [activeDeviceId, setActiveDeviceId] = useState<string>('switch-1');
  const [activeDeviceType, setActiveDeviceType] = useState<'pc' | 'switch' | 'router'>('switch');

  // Get or create state for active device - ensures router gets router state
  const getActiveDeviceState = useCallback((): SwitchState => {
    const existingState = deviceStates.get(activeDeviceId);
    if (existingState) return existingState;
    
    // Create appropriate default based on device type
    if (activeDeviceType === 'router') {
      return createInitialRouterState();
    }
    return createInitialState();
  }, [activeDeviceId, activeDeviceType, deviceStates]);
  
  // Legacy state for compatibility with other panels (uses active device's state)
  const state = getActiveDeviceState();
  const output = deviceOutputs.get(activeDeviceId) || [];

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('topology');
  const [cableInfo, setCableInfo] = useState<CableInfo>({
    connected: true,
    cableType: 'straight',
    sourceDevice: 'pc',
    targetDevice: 'switch',
  });

  // Handle automatic tab switching when device type changes
  useEffect(() => {
    if (activeDeviceType === 'pc') {
      if (['terminal', 'ports', 'vlan', 'security'].includes(activeTab)) {
        setActiveTab('topology');
      }
    } else if (activeDeviceType === 'switch' || activeDeviceType === 'router') {
      if (activeTab === 'cmd') {
        setActiveTab('topology');
      }
    }
  }, [activeDeviceType, activeTab]);
  
  // Topology state - managed in page.tsx for save/load functionality
  const [topologyDevices, setTopologyDevices] = useState<CanvasDevice[] | null>(null);
  const [topologyConnections, setTopologyConnections] = useState<CanvasConnection[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedDevice, setSelectedDevice] = useState<'pc' | 'switch' | null>(null);
  const [showPCPanel, setShowPCPanel] = useState(false);
  const [showPCDeviceId, setShowPCDeviceId] = useState<string>('pc-1');

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    message: string;
    action: string;
    onConfirm: () => void;
  } | null>(null);

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

  // Broadcast to other components (like NetworkTopology)
  const broadcastCloseMenus = useCallback((source) => {
    window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source } }));
  }, []);

  const closeLocalMenus = useCallback((exclude) => {
    if (exclude !== 'mobile') setShowMobileMenu(false);
    if (exclude !== 'device') setShowActiveDeviceDropdown(false);
    if (exclude !== 'modal') {
      setConfirmDialog(null);
      setSaveDialog(null);
    }
  }, []);

  const openMobileMenu = useCallback(() => {
    closeLocalMenus('mobile');
    broadcastCloseMenus('mobile');
    setShowMobileMenu(true);
  }, [closeLocalMenus, broadcastCloseMenus]);

  const openDeviceDropdown = useCallback(() => {
    closeLocalMenus('device');
    broadcastCloseMenus('device');
    setShowActiveDeviceDropdown(true);
  }, [closeLocalMenus, broadcastCloseMenus]);

  // Listen for broadcasts from others
  useEffect(() => {
    const handleMenuBroadcast = (e) => {
      const source = e.detail?.source;
      if (source && source !== 'mobile' && source !== 'device' && source !== 'modal') {
        setShowMobileMenu(false);
        setShowActiveDeviceDropdown(false);
      }
    };
    window.addEventListener('close-menus-broadcast', handleMenuBroadcast);
    return () => window.removeEventListener('close-menus-broadcast', handleMenuBroadcast);
  }, []);

  const prompt = getPrompt(state);

  // Task context for task calculations
  const taskContext: TaskContext = {
    cableInfo,
    showPCPanel,
    selectedDevice,
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

  // Track previous score using ref to avoid stale closure issues
  const prevScoreRef = useRef(totalScore);

  // Track score changes for animation
  useEffect(() => {
    const prevScore = prevScoreRef.current;
    if (totalScore !== prevScore) {
      const change = totalScore - prevScore;
      
      setScoreAnimation({
        change: Math.abs(change),
        isIncreasing: change > 0,
        showAnimation: true
      });

      // Update ref to current score
      prevScoreRef.current = totalScore;

      // Hide animation after 1 second
      const timer = setTimeout(() => {
        setScoreAnimation(prev => ({ ...prev, showAnimation: false }));
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [totalScore]);

  // Get or create state for a device
  const getOrCreateDeviceState = useCallback((deviceId: string, deviceType: 'pc' | 'switch' | 'router'): SwitchState => {
    let deviceState = deviceStates.get(deviceId);
    if (!deviceState) {
      // Create appropriate initial state based on device type
      deviceState = deviceType === 'router' ? createInitialRouterState() : createInitialState();
      const hostname = deviceType === 'router' ? 'Router' : 'Switch';
      deviceState = {
        ...deviceState,
        hostname: hostname,
      };
      setDeviceStates(prev => {
        const newMap = new Map(prev);
        newMap.set(deviceId, deviceState!);
        return newMap;
      });
    }
    return deviceState;
  }, [deviceStates]);

  // Get or create outputs for a device
  const getOrCreateDeviceOutputs = useCallback((deviceId: string): TerminalOutput[] => {
    let outputs = deviceOutputs.get(deviceId);
    if (!outputs) {
      outputs = [];
      setDeviceOutputs(prev => {
        const newMap = new Map(prev);
        newMap.set(deviceId, outputs!);
        return newMap;
      });
    }
    return outputs;
  }, [deviceOutputs]);

  // Get or create PC outputs for a device
  const getOrCreatePCOutputs = useCallback((deviceId: string): PCOutputLine[] => {
    let outputs = pcOutputs.get(deviceId);
    if (!outputs) {
      outputs = [
        {
          id: '0',
          type: 'output',
          content: 'Microsoft Windows [Version 10.0.19045.3803]\n(c) Microsoft Corporation. Tüm hakları saklıdır.\n'
        },
        {
          id: '1',
          type: 'output',
          content: '\nEthernet adapter Ethernet bağlantısı:\n'
        }
      ];
      setPcOutputs(prev => {
        const newMap = new Map(prev);
        newMap.set(deviceId, outputs!);
        return newMap;
      });
    }
    return outputs;
  }, [pcOutputs]);

  // Handle command for a specific device
  const handleCommandForDevice = useCallback(async (deviceId: string, command: string, skipConfirm = false) => {
    setIsLoading(true);

    try {
      // Determine device type from deviceId
      const deviceType = deviceId.includes('router') ? 'router' : deviceId.includes('pc') ? 'pc' : 'switch';
      
      const deviceState = getOrCreateDeviceState(deviceId, deviceType as 'pc' | 'switch' | 'router');
      const deviceOutput = getOrCreateDeviceOutputs(deviceId);
      const devicePrompt = getPrompt(deviceState);

      const isPasswordMode = deviceState.awaitingPassword;
      const result = executeCommand(deviceState, command, language);

      // Check if command requires confirmation
      if (result.requiresConfirmation && !skipConfirm) {
        setIsLoading(false);
        setConfirmDialog({
          show: true,
          message: result.message || result.confirmationMessage || 'Are you sure?',
          action: result.confirmationAction || command,
          onConfirm: () => {
            setConfirmDialog(null);
            // Re-execute with skipConfirm = true
            handleCommandForDevice(deviceId, command, true);
          }
        });
        return;
      }

      if (!isPasswordMode) {
        const commandOutput: TerminalOutput = {
          id: Date.now().toString(),
          type: 'command',
          content: command,
          prompt: devicePrompt
        };
        setDeviceOutputs(prev => {
          const newMap = new Map(prev);
          const current = newMap.get(deviceId) || [];
          newMap.set(deviceId, [...current, commandOutput]);
          return newMap;
        });
      }

      if (!isPasswordMode) {
        setDeviceStates(prev => {
          const newMap = new Map(prev);
          const current = newMap.get(deviceId);
          if (current) {
            newMap.set(deviceId, {
              ...current,
              commandHistory: [...current.commandHistory, command]
            });
          }
          return newMap;
        });
      }

      if (result.success) {
        if (result.requiresPassword && result.passwordPrompt) {
          const passwordPromptOutput: TerminalOutput = {
            id: (Date.now() + 1).toString(),
            type: 'password-prompt',
            content: result.passwordPrompt
          };
          setDeviceOutputs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(deviceId) || [];
            newMap.set(deviceId, [...current, passwordPromptOutput]);
            return newMap;
          });
        } else if (result.output) {
          const outputItem: TerminalOutput = {
            id: (Date.now() + 1).toString(),
            type: 'output',
            content: result.output
          };
          setDeviceOutputs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(deviceId) || [];
            newMap.set(deviceId, [...current, outputItem]);
            return newMap;
          });
        }

        // Handle TELNET: find device in topology by IP and switch CLI to it
        if (result.telnetTarget && topologyDevices) {
          const targetIp = result.telnetTarget;
          const targetDevice = topologyDevices.find((d: any) => d.ip === targetIp);
          if (targetDevice && targetDevice.type !== 'pc') {
            const connMsg: TerminalOutput = {
              id: (Date.now() + 2).toString(),
              type: 'output',
              content: ` Open\n\n**** Connected to ${targetDevice.name} (${targetIp}) via VTY ****\n`
            };
            setDeviceOutputs((prev: any) => {
              const newMap = new Map(prev);
              const current = newMap.get(deviceId) || [];
              newMap.set(deviceId, [...current, connMsg]);
              return newMap;
            });
            getOrCreateDeviceState(targetDevice.id, targetDevice.type as 'switch' | 'router');
            getOrCreateDeviceOutputs(targetDevice.id);
            setActiveDeviceId(targetDevice.id);
            setActiveDeviceType(targetDevice.type as 'switch' | 'router');
          } else {
            const noHostMsg: TerminalOutput = {
              id: (Date.now() + 2).toString(),
              type: 'error',
              content: `\n% Connection timed out; remote host not responding\n`
            };
            setDeviceOutputs((prev: any) => {
              const newMap = new Map(prev);
              const current = newMap.get(deviceId) || [];
              newMap.set(deviceId, [...current, noHostMsg]);
              return newMap;
            });
          }
        }

        // Handle RELOAD: fully reset device state and show boot sequence
        if (result.reloadDevice && skipConfirm) {
          const deviceTypeFull = deviceId.includes('router') ? 'router' : 'switch';
          const freshState = deviceTypeFull === 'router' ? createInitialRouterState() : createInitialState();
          const oldState = deviceStates.get(deviceId);
          const finalState: SwitchState = {
            ...freshState,
            hostname: oldState?.hostname || freshState.hostname,
            commandHistory: oldState?.commandHistory || []
          };
          const bootMessages: TerminalOutput[] = [
            { id: (Date.now() + 2).toString(), type: 'output', content: '\n\nSystem Bootstrap, Version 12.1(11r)EA1\nCopyright (c) 2004 by cisco Systems, Inc.\n' },
            { id: (Date.now() + 3).toString(), type: 'output', content: 'C2960 Boot Loader (C2960-HBOOT-M) Version 12.2(25r)FX\nLoading "flash:c2960-lanbase-mz.150-2.SE4.bin"...\n################################################################################\n' },
            { id: (Date.now() + 4).toString(), type: 'output', content: '[OK]\n\nCisco IOS Software, Version 15.0(2)SE4\nPress RETURN to get started!\n\n' },
          ];
          setDeviceStates((prev: any) => {
            const newMap = new Map(prev);
            newMap.set(deviceId, finalState);
            return newMap;
          });
          setDeviceOutputs((prev: any) => {
            const newMap = new Map(prev);
            newMap.set(deviceId, bootMessages);
            return newMap;
          });
          setIsLoading(false);
          return;
        }

        // Handle reload confirmation success (legacy)
        if (result.confirmationAction === 'reload' && skipConfirm) {
          const reloadOutput: TerminalOutput = {
            id: (Date.now() + 2).toString(),
            type: 'output',
            content: '\n[OK]\nReload requested...\n'
          };
          setDeviceOutputs((prev: any) => {
            const newMap = new Map(prev);
            const current = newMap.get(deviceId) || [];
            newMap.set(deviceId, [...current, reloadOutput]);
            return newMap;
          });
        }

        // Handle erase startup-config success
        if (result.confirmationAction === 'erase-startup-config' && skipConfirm) {
          const eraseOutput: TerminalOutput = {
            id: (Date.now() + 2).toString(),
            type: 'output',
            content: '\n[OK]\nErase of nvram: complete\n'
          };
          setDeviceOutputs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(deviceId) || [];
            newMap.set(deviceId, [...current, eraseOutput]);
            return newMap;
          });
        }

        if (result.newState) {
          setDeviceStates(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(deviceId);
            if (current) {
              newMap.set(deviceId, {
                ...current,
                ...result.newState
              });
            }
            return newMap;
          });
        }
      } else {
        const errorOutput: TerminalOutput = {
          id: (Date.now() + 1).toString(),
          type: 'error',
          content: result.error || 'Unknown error'
        };
        setDeviceOutputs(prev => {
          const newMap = new Map(prev);
          const current = newMap.get(deviceId) || [];
          newMap.set(deviceId, [...current, errorOutput]);
          return newMap;
        });

        if (result.newState) {
          setDeviceStates(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(deviceId);
            if (current) {
              newMap.set(deviceId, {
                ...current,
                ...result.newState
              });
            }
            return newMap;
          });
        }
      }
    } catch (error) {
      const errorOutput: TerminalOutput = {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: 'System error: ' + (error as Error).message
      };
      setDeviceOutputs(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(deviceId) || [];
        newMap.set(deviceId, [...current, errorOutput]);
        return newMap;
      });
    } finally {
      setIsLoading(false);
    }
  }, [language, getOrCreateDeviceState, getOrCreateDeviceOutputs, topologyDevices, deviceStates]);

  // Handle command using active device
  const handleCommand = useCallback(async (command: string) => {
    await handleCommandForDevice(activeDeviceId, command);
  }, [activeDeviceId, handleCommandForDevice]);

  const handleReset = () => {
    setConfirmDialog({
      show: true,
      message: language === 'tr' 
        ? 'Tüm yapılandırma sıfırlanacak. Devam etmek istiyor musunuz?'
        : 'All configuration will be reset. Do you want to continue?',
      action: 'reset',
      onConfirm: () => {
        setConfirmDialog(null);
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

  // Handle device selection (single click) - just select the device, don't change tabs
  const handleDeviceSelect = useCallback((device: 'pc' | 'switch', deviceId?: string) => {
    setSelectedDevice(device);
    if (deviceId) {
      // Determine actual device type
      const actualDeviceType = deviceId.includes('router') ? 'router' : deviceId.includes('pc') ? 'pc' : 'switch';
      
      // Set the active device but DON'T switch tabs
      setActiveDeviceId(deviceId);
      setActiveDeviceType(actualDeviceType as 'pc' | 'switch' | 'router');
      
      // Initialize device state if needed (for switches/routers)
      if (actualDeviceType !== 'pc') {
        getOrCreateDeviceState(deviceId, actualDeviceType as 'pc' | 'switch' | 'router');
        getOrCreateDeviceOutputs(deviceId);
      }
    }
  }, [getOrCreateDeviceState, getOrCreateDeviceOutputs]);

  // Handle device double click (Open terminal or PC panel)
  const handleDeviceDoubleClick = useCallback((device: 'pc' | 'switch', deviceId: string) => {
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
      setActiveDeviceType(actualDeviceType as 'switch' | 'router');
      getOrCreateDeviceState(deviceId, actualDeviceType as 'pc' | 'switch' | 'router');
      getOrCreateDeviceOutputs(deviceId);
      setActiveTab('terminal');
    }
  }, [getOrCreateDeviceState, getOrCreateDeviceOutputs]);

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
      // Use a fresh reference by getting devices from the ref
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
  }, [activeDeviceId, topologyDevices, showPCDeviceId, selectedDevice]);

  // Sync hostname changes to topology device names
  useEffect(() => {
    if (!topologyDevices) return;
    
    // Check if any device's hostname has changed
    let hasChanges = false;
    const updatedDevices = topologyDevices.map(device => {
      const deviceState = deviceStates.get(device.id);
      if (deviceState && deviceState.hostname !== device.name && device.type !== 'pc') {
        hasChanges = true;
        return { ...device, name: deviceState.hostname };
      }
      return device;
    });

    if (hasChanges) {
      setTopologyDevices(updatedDevices);
      setHasUnsavedChanges(true);
    }
  }, [deviceStates, topologyDevices]);

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
    const anyModalOpen = showActiveDeviceDropdown || showMobileMenu || confirmDialog || saveDialog || showPCPanel;
    if (anyModalOpen) {
      window.history.pushState({ modal: true }, '');
    }
  }, [showActiveDeviceDropdown, showMobileMenu, confirmDialog, saveDialog, showPCPanel]);

  // Handle key events: ESC to close, ENTER to confirm
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowActiveDeviceDropdown(false);
        setShowMobileMenu(false);
        setConfirmDialog(null);
        setSaveDialog(null);
        setShowPCPanel(false);
        window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source: 'escape' } }));
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
  }, [showActiveDeviceDropdown, showMobileMenu, confirmDialog, saveDialog, showPCPanel]);

  // Close menus on mobile back button (popstate)
  useEffect(() => {
    const handlePopState = () => {
      // Close all open menus and dialogs when user presses back button
      setShowActiveDeviceDropdown(false);
      setShowMobileMenu(false);
      setConfirmDialog(null);
      setSaveDialog(null);
      setShowPCPanel(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Use history pushState for better mobile back button experience when modals open
  useEffect(() => {
    const anyModalOpen = showActiveDeviceDropdown || showMobileMenu || confirmDialog || saveDialog || showPCPanel;
    if (anyModalOpen) {
      window.history.pushState({ modal: true }, '');
    }
  }, [showActiveDeviceDropdown, showMobileMenu, confirmDialog, saveDialog, showPCPanel]);

  // Save project to JSON file
  const handleSaveProject = useCallback(() => {
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
  }, [language]);

  // New project - reset everything
  const handleNewProject = useCallback(() => {
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
  }, [language, hasUnsavedChanges, handleSaveProject]);

  const isDark = theme === 'dark';

  // Tab definitions
  const allTabs: { id: TabType; label: string; icon: React.ReactNode; tasks: typeof topologyTasks; color: string; showFor: string[] }[] = [
    {
      id: 'topology',
      label: language === 'tr' ? 'Ağ Topolojisi' : 'Network Topology',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
      tasks: topologyTasks,
      color: 'from-cyan-500 to-blue-500',
      showFor: ['pc', 'switch', 'router']
    },
    {
      id: 'cmd',
      label: 'CMD Terminal',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      tasks: [],
      color: 'from-blue-500 to-indigo-500',
      showFor: ['pc']
    },
    {
      id: 'terminal',
      label: 'Terminal',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      tasks: [],
      color: 'from-green-500 to-emerald-500',
      showFor: ['switch', 'router']
    },
    {
      id: 'ports',
      label: language === 'tr' ? 'Portlar' : 'Ports',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" /></svg>,
      tasks: portTasks,
      color: 'from-yellow-500 to-orange-500',
      showFor: ['switch', 'router']
    },
    {
      id: 'vlan',
      label: 'VLAN',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
      tasks: vlanTasks,
      color: 'from-purple-500 to-pink-500',
      showFor: ['switch', 'router']
    },
    {
      id: 'security',
      label: language === 'tr' ? 'Güvenlik' : 'Security',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
      tasks: securityTasks,
      color: 'from-red-500 to-rose-500',
      showFor: ['switch', 'router']
    },
  ];

  const tabs = allTabs.filter(tab => tab.showFor.includes(activeDeviceType));
  
  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100'}`}>
      {/* Header */}
      <header className={`${isDark ? 'bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95' : 'bg-gradient-to-r from-white/90 via-blue-50/80 to-white/90'} backdrop-blur-xl border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200/50'} px-4 py-3 sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
              <div className={`p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  {t.title}
                </h1>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.subtitle}</p>
              </div>
            </a>

            {/* Total Score - Desktop */}
            <div className="hidden sm:flex items-center gap-3">
              <div className={`px-4 py-2 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'} border ${isDark ? 'border-slate-700' : 'border-slate-200'} relative`}>
                <div className="text-xs text-slate-400 mb-1">{language === 'tr' ? 'Toplam Puan' : 'Total Score'}</div>
                <div className="flex items-center gap-2">
                  <Progress value={(totalScore / maxScore) * 100} className="h-2 w-24" />
                  <span className={`font-bold ${totalScore >= maxScore * 0.7 ? 'text-green-400' : totalScore >= maxScore * 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {totalScore}/{maxScore}
                  </span>
                </div>
                {/* Score animation overlay */}
                {scoreAnimation.showAnimation && (
                  <div className={`absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none ${
                    scoreAnimation.isIncreasing 
                      ? 'bg-green-500/20 animate-pulse' 
                      : 'bg-red-500/20 animate-pulse'
                  }`}>
                    <span className={`text-lg font-bold ${scoreAnimation.isIncreasing ? 'text-green-400' : 'text-red-400'}`}>
                      {scoreAnimation.isIncreasing ? '+' : '-'}
                      {scoreAnimation.change}
                    </span>
                  </div>
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
              {/* Project buttons */}
              <div className={`flex items-center gap-1 rounded-lg p-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewProject}
                  className={`text-xs px-2 h-7 ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  title={language === 'tr' ? 'Yeni Proje' : 'New Project'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveProject}
                  className={`text-xs px-2 h-7 ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  title={language === 'tr' ? 'Projeyi Kaydet' : 'Save Project'}
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
                  title={language === 'tr' ? 'Proje Yükle' : 'Load Project'}
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

          {/* Tab Navigation */}
          <div className="mt-4 flex gap-1 overflow-x-auto pb-1 items-center">
            {/* Active Device Selector Dropdown */}
            {activeDeviceId && (() => {
              // Get display name for active device (from topology or state)
              const activeDevice = topologyDevices?.find(d => d.id === activeDeviceId);
              const hostname = deviceStates.get(activeDeviceId)?.hostname || activeDevice?.name || 'Device';
              const typeLabel = activeDeviceType === 'pc' ? 'PC' : activeDeviceType === 'router' ? 'Router' : 'Switch';
              
              return (
              <div className="relative device-dropdown-container">
                <button
                  onClick={openDeviceDropdown}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold cursor-pointer transition-all rounded-xl border ${
                    isDark 
                      ? 'text-cyan-400 bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 hover:border-cyan-500/50' 
                      : 'text-cyan-700 bg-white border-slate-200 hover:bg-slate-50 hover:border-cyan-500/50'
                  } shadow-sm`}
                >
                  {activeDeviceType === 'pc' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ) : activeDeviceType === 'router' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                  )}
                  <span>{hostname} ({typeLabel})</span>
                  <svg className={`w-3 h-3 transition-transform ${showActiveDeviceDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Device Dropdown List - Fixed Position for overlay */}
                {showActiveDeviceDropdown && (
                  <>
                    {/* Invisible backdrop to close dropdown on click outside */}
                    <div className="fixed inset-0 z-[100]" onClick={() => setShowActiveDeviceDropdown(false)} />
                    {/* Dropdown panel positioned relative to button */}
                    <div
                      className={`fixed z-[101] min-w-[220px] rounded-xl shadow-2xl border overflow-hidden max-h-[300px] overflow-y-auto ${
                        isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
                      }`}
                      id="device-dropdown-menu"
                    >
                    {/* Sort devices by type: routers first, then switches, then PCs */}
                    {(() => {
                      const sortedDevices = [
                        ...topologyDevices?.filter(d => d.type === 'router') || [],
                        ...topologyDevices?.filter(d => d.type === 'switch') || [],
                        ...topologyDevices?.filter(d => d.type === 'pc') || [],
                      ];
                      
                      if (sortedDevices.length === 0) {
                        return (
                          <div className={`px-4 py-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {language === 'tr' ? 'Cihaz yok' : 'No devices'}
                          </div>
                        );
                      }
                      
                      return sortedDevices.map(device => {
                        const deviceState = deviceStates.get(device.id);
                        const hostname = deviceState?.hostname || device.name;
                        const isActive = activeDeviceId === device.id;
                        
                        return (
                          <button
                            key={device.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Select the device but don't change tabs
                              handleDeviceSelect(device.type === 'router' ? 'switch' : device.type, device.id);
                              setShowActiveDeviceDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isActive
                                ? isDark ? 'bg-cyan-600/20 text-cyan-400' : 'bg-cyan-50 text-cyan-700'
                                : isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            {device.type === 'pc' ? (
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            ) : device.type === 'router' ? (
                              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                              </svg>
                            )}
                            <span className="font-medium">{hostname}</span>
                            <span className={`text-xs ml-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {device.type === 'pc' ? 'PC' : device.type === 'router' ? 'Router' : 'Switch'}
                            </span>
                            {isActive && (
                              <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                  </>
                )}
              </div>
            )})()}
            {tabs.map((tab) => {
              const score = calculateTaskScore(tab.tasks, state, taskContext);
              const tabMaxScore = tab.tasks.reduce((acc, task) => acc + task.weight, 0);
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                    isActive
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg scale-105`
                      : isDark
                        ? 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white hover:scale-102'
                        : 'bg-white/50 text-slate-600 hover:bg-white hover:text-slate-900 hover:scale-102'
                  }`}
                >
                  <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                  {tab.tasks.length > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full transition-all duration-300 ${
                      isActive ? 'bg-white/20 scale-105' : isDark ? 'bg-slate-700' : 'bg-slate-200'
                    }`}>
                      {score}/{tabMaxScore}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className={`md:hidden absolute top-full left-0 right-0 ${isDark ? 'bg-slate-900' : 'bg-white'} border-b ${isDark ? 'border-slate-700' : 'border-slate-200'} shadow-lg z-50`}>
            <div className="p-4 space-y-4">
              {/* Project Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => { handleNewProject(); setShowMobileMenu(false); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm">{language === 'tr' ? 'Yeni' : 'New'}</span>
                </button>
                <button
                  onClick={() => { handleSaveProject(); setShowMobileMenu(false); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  <span className="text-sm">{language === 'tr' ? 'Kaydet' : 'Save'}</span>
                </button>
                <button
                  onClick={() => { fileInputRef.current?.click(); setShowMobileMenu(false); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-sm">{language === 'tr' ? 'Yükle' : 'Load'}</span>
                </button>
              </div>
              
              {/* Language Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm">{language === 'tr' ? 'Dil' : 'Language'}</span>
                <div className={`flex items-center gap-1 rounded-lg p-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                  <button
                    onClick={() => { setLanguage('tr'); }}
                    className={`px-3 py-1 rounded text-sm ${language === 'tr' ? 'bg-cyan-600 text-white' : isDark ? 'text-slate-300' : 'text-slate-600'}`}
                  >
                    TR
                  </button>
                  <button
                    onClick={() => { setLanguage('en'); }}
                    className={`px-3 py-1 rounded text-sm ${language === 'en' ? 'bg-cyan-600 text-white' : isDark ? 'text-slate-300' : 'text-slate-600'}`}
                  >
                    EN
                  </button>
                </div>
              </div>
              
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.5)' }}
              >
                <span className="text-sm">{language === 'tr' ? 'Tema' : 'Theme'}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{isDark ? (language === 'tr' ? 'Koyu' : 'Dark') : (language === 'tr' ? 'Açık' : 'Light')}</span>
                  {isDark ? (
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </div>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 pb-6">
        {/* Tab Content */}
        {activeTab === 'topology' && (
          <div className="space-y-4">
            {/* Network Topology */}
            <div className="w-full">
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
              />
            </div>
            
            {/* PC Panel - Below Topology if open */}
            {/* {showPCPanel && (
              <div className="w-full">
                <PCPanel
                  deviceId={showPCDeviceId}
                  cableInfo={cableInfo}
                  isVisible={showPCPanel}
                  onClose={() => setShowPCPanel(false)}
                  topologyDevices={topologyDevices || undefined}
                  topologyConnections={topologyConnections || undefined}
                />
              </div>
            )} */}

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
        )}

        {/* CMD Terminal Sekmesi */}
        {activeTab === 'cmd' && (
          <div className="w-full">
            <PCPanel
              deviceId={activeDeviceId}
              cableInfo={cableInfo}
              isVisible={true}
              onClose={() => setActiveTab('topology')}
              topologyDevices={topologyDevices || undefined}
              topologyConnections={topologyConnections || undefined}
            />
          </div>
        )}

        {/* Terminal Sekmesi - Fixed Layout with Footer at Bottom */}
        {activeTab === 'terminal' && (
          <div className="flex flex-col gap-4">
            <div className="grid lg:grid-cols-4 gap-4 flex-1">
              <div className="lg:col-span-3 flex flex-col gap-4">
                <Terminal
                  deviceId={activeDeviceId}
                  // use same display name as the dropdown (hostname or topology name)
                  deviceName={
                    (() => {
                      const activeDevice = topologyDevices?.find(d => d.id === activeDeviceId);
                      return deviceStates.get(activeDeviceId)?.hostname || activeDevice?.name || 'Device';
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
          <div className="grid lg:grid-cols-3 gap-4">
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
          <div className="grid lg:grid-cols-3 gap-4">
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

        {/* Güvenlik Sekmesi - Single Column */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <SecurityPanel security={state.security} t={t} theme={theme} />
            <TaskCard
              tasks={securityTasks}
              state={state}
              context={taskContext}
              color="from-red-500 to-rose-500"
              isDark={isDark}
            />
          </div>
        )}
      </main>

      {/* Footer - Always at Bottom */}
      <AppFooter
        state={state}
        selectedDevice={selectedDevice}
        activeDeviceId={activeDeviceId}
        activeDeviceName={state.hostname}
        isDark={isDark}
        isCLIActive={activeTab === 'terminal'}
      />

      {/* Confirmation Dialog */}
      {confirmDialog?.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`mx-4 rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full ${
            isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'
          }`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-yellow-500/20">
                  <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {language === 'tr' ? 'Onay Gerekli' : 'Confirmation Required'}
                </h3>
              </div>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {confirmDialog.message}
              </p>
            </div>
            <div className={`flex gap-2 p-4 ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
              <button
                onClick={() => setConfirmDialog(null)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isDark 
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-all"
              >
                {language === 'tr' ? 'Onayla' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Dialog for Unsaved Changes */}
      {saveDialog?.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`mx-4 rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full ${
            isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'
          }`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-cyan-500/20">
                  <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                </div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {language === 'tr' ? 'Kaydedilmemiş Değişiklikler' : 'Unsaved Changes'}
                </h3>
              </div>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {saveDialog.message}
              </p>
            </div>
            <div className={`flex gap-2 p-4 ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
              <button
                onClick={() => saveDialog.onConfirm(false)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isDark 
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {language === 'tr' ? 'Kaydetme' : 'Don\'t Save'}
              </button>
              <button
                onClick={() => saveDialog.onConfirm(true)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 transition-all"
              >
                {language === 'tr' ? 'Kaydet' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
