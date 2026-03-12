import { useState, useRef, useEffect, useCallback } from 'react';
import { SwitchState, CommandResult } from '@/lib/network/types';
import { createInitialState, createInitialRouterState } from '@/lib/network/initialState';
import { executeCommand, getPrompt } from '@/lib/network/executor';
import { TerminalOutput } from '@/components/network/Terminal';
import { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';

interface PCOutputLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'success';
  content: string;
}

export function useDeviceManager(language: 'tr' | 'en') {
  // Per-device state management
  const [deviceStates, setDeviceStates] = useState<Map<string, SwitchState>>(() => {
    const initialMap = new Map<string, SwitchState>();
    initialMap.set('switch-1', createInitialState());
    return initialMap;
  });
  
  const deviceStatesRef = useRef(deviceStates);
  useEffect(() => {
    deviceStatesRef.current = deviceStates;
  }, [deviceStates]);

  // Per-device terminal outputs
  const [deviceOutputs, setDeviceOutputs] = useState<Map<string, TerminalOutput[]>>(() => {
    return new Map<string, TerminalOutput[]>();
  });

  // Per-device PC outputs
  const [pcOutputs, setPcOutputs] = useState<Map<string, PCOutputLine[]>>(() => {
    const initialMap = new Map<string, PCOutputLine[]>();
    initialMap.set('pc-1', [
      {
        id: '0',
        type: 'output',
        content: 'OS Windows [Version 10.0.19045.3803]\n(c) OS Corporation. Tüm hakları saklıdır.\n'
      },
      {
        id: '1',
        type: 'output',
        content: '\nEthernet adapter Ethernet bağlantısı:\n'
      }
    ]);
    return initialMap;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    message: string;
    action: string;
    onConfirm: () => void;
  } | null>(null);

  // Get or create state for a device
  const getOrCreateDeviceState = useCallback((deviceId: string, deviceType: 'pc' | 'switch' | 'router', initialHostname?: string): SwitchState => {
    let deviceState = deviceStates.get(deviceId);
    const defaultName = deviceType === 'router' ? 'Router' : 'Switch';
    
    if (!deviceState) {
      deviceState = deviceType === 'router' ? createInitialRouterState() : createInitialState();
      const hostname = initialHostname || defaultName;
      
      // Update state with unique hostname
      deviceState = { ...deviceState, hostname };
      
      // Also update running config hostname line if it exists
      if (deviceState.runningConfig) {
        deviceState.runningConfig = deviceState.runningConfig.map(line => 
          line.startsWith(' hostname ') || line.startsWith('hostname ') 
            ? `hostname ${hostname}` 
            : line
        );
      }
      
      setDeviceStates(prev => new Map(prev).set(deviceId, deviceState!));
    } else if (initialHostname && (deviceState.hostname === 'Switch' || deviceState.hostname === 'Router') && initialHostname !== deviceState.hostname) {
      // If state exists but has default name, and we have a specific name from topology, update it
      const updatedState = { ...deviceState, hostname: initialHostname };
      
      // Also update running config
      if (updatedState.runningConfig) {
        updatedState.runningConfig = updatedState.runningConfig.map(line => 
          line.startsWith(' hostname ') || line.startsWith('hostname ') 
            ? `hostname ${initialHostname}` 
            : line
        );
      }
      
      setDeviceStates(prev => new Map(prev).set(deviceId, updatedState));
      return updatedState;
    }
    return deviceState;
  }, [deviceStates]);

  // Get or create outputs for a device
  const getOrCreateDeviceOutputs = useCallback((deviceId: string): TerminalOutput[] => {
    let outputs = deviceOutputs.get(deviceId);
    if (!outputs) {
      const state = deviceStates.get(deviceId);
      const isRouter = deviceId.includes('router');
      
      // Boot Messages for professional look
      outputs = [
        { 
          id: 'boot-1-' + Date.now(), 
          type: 'output', 
          content: isRouter 
            ? '\n\nSystem Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)\nTechnical Support: http://yunus.sf.net\nCopyright (c) 1986-2026 by Systems, Inc.\n' 
            : '\n\nSystem Bootstrap, Version 12.1(11r)EA1, RELEASE SOFTWARE (fc1)\nTechnical Support: http://yunus.sf.net\nCopyright (c) 1986-2026 by Systems, Inc.\n'
        },
        { 
          id: 'boot-2-' + Date.now(), 
          type: 'output', 
          content: isRouter
            ? 'C1900 platform with 524288K bytes of main memory\nMain memory configured to 64 bit mode with ECC disabled\n'
            : 'C2960 platform with 262144K bytes of main memory\nMain memory configured to 32 bit mode with ECC enabled\n'
        },
        { 
          id: 'boot-3-' + Date.now(), 
          type: 'output', 
          content: '\nLoading the runtime image: ######################################################################################################################## [OK]\n' 
        }
      ];

      if (state?.bannerMOTD) {
        outputs.push({
          id: 'banner-' + Date.now(),
          type: 'output',
          content: '\n' + state.bannerMOTD + '\n'
        });
      }
      
      outputs.push({
        id: 'boot-ready-' + Date.now(),
        type: 'output',
        content: '\nPress RETURN to get started!\n'
      });

      setDeviceOutputs(prev => new Map(prev).set(deviceId, outputs!));
    }
    return outputs;
  }, [deviceOutputs, deviceStates]);

  // Get or create PC outputs for a device
  const getOrCreatePCOutputs = useCallback((deviceId: string): PCOutputLine[] => {
    let outputs = pcOutputs.get(deviceId);
    if (!outputs) {
      outputs = [
        {
          id: '0',
          type: 'output',
          content: 'OS Windows [Version 10.0.19045.3803]\n(c) OS Corporation. Tüm hakları saklıdır.\n'
        },
        {
          id: '1',
          type: 'output',
          content: '\nEthernet adapter Ethernet bağlantısı:\n'
        }
      ];
      setPcOutputs(prev => new Map(prev).set(deviceId, outputs!));
    }
    return outputs;
  }, [pcOutputs]);

  // Handle command execution
  const handleCommandForDevice = useCallback(async (
    deviceId: string, 
    command: string, 
    topologyDevices: CanvasDevice[] | null,
    setActiveDeviceId: (id: string) => void,
    setActiveDeviceType: (type: 'pc' | 'switch' | 'router') => void,
    topologyConnections: CanvasConnection[] | null = null,
    skipConfirm = false
  ) => {
    if (command.includes('\n')) {
      const lines = command.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        await handleCommandForDevice(deviceId, line.trim(), topologyDevices, setActiveDeviceId, setActiveDeviceType, topologyConnections, skipConfirm);
      }
      return;
    }

    setIsLoading(true);

    try {
      const deviceType = deviceId.includes('router') ? 'router' : deviceId.includes('pc') ? 'pc' : 'switch';
      const deviceState = deviceStatesRef.current.get(deviceId) || (deviceType === 'router' ? createInitialRouterState() : createInitialState());
      const devicePrompt = getPrompt(deviceState);
      const isPasswordMode = deviceState.awaitingPassword;
      
      const result = executeCommand(
        deviceState, 
        command, 
        language, 
        topologyDevices || undefined, 
        topologyConnections || undefined,
        deviceStatesRef.current
      );

      if (result.requiresConfirmation && !skipConfirm) {
        setIsLoading(false);
        setConfirmDialog({
          show: true,
          message: result.confirmationMessage || 'Are you sure?',
          action: result.confirmationAction || command,
          onConfirm: () => {
            setConfirmDialog(null);
            handleCommandForDevice(deviceId, command, topologyDevices, setActiveDeviceId, setActiveDeviceType, topologyConnections, true);
          }
        });
        return;
      }

      // Add command to output (if not password)
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

      // Handle result
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

        // Handle Telnet
        if (result.telnetTarget && topologyDevices) {
          const targetIp = result.telnetTarget;
          const targetDevice = topologyDevices.find((d: CanvasDevice) => d.ip === targetIp);
          if (targetDevice && targetDevice.type !== 'pc') {
            const connMsg: TerminalOutput = {
              id: (Date.now() + 2).toString(),
              type: 'output',
              content: ` Open\n\n**** Connected to ${targetDevice.name} (${targetIp}) via VTY ****\n`
            };
            setDeviceOutputs((prev) => {
              const newMap = new Map(prev);
              const current = newMap.get(deviceId) || [];
              newMap.set(deviceId, [...current, connMsg]);
              return newMap;
            });
            
            const targetType = targetDevice.type as 'switch' | 'router';
            getOrCreateDeviceState(targetDevice.id, targetType, targetDevice.name);
            getOrCreateDeviceOutputs(targetDevice.id);
            setActiveDeviceId(targetDevice.id);
            setActiveDeviceType(targetType);
          } else {
            const noHostMsg: TerminalOutput = {
              id: (Date.now() + 2).toString(),
              type: 'error',
              content: `\n% Connection timed out; remote host not responding\n`
            };
            setDeviceOutputs((prev) => {
              const newMap = new Map(prev);
              const current = newMap.get(deviceId) || [];
              newMap.set(deviceId, [...current, noHostMsg]);
              return newMap;
            });
          }
        }

        // Handle Reload
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
            { id: (Date.now() + 2).toString(), type: 'output', content: '\n\nSystem Bootstrap, Version 12.1(11r)EA1\nCopyright (c) 2004 by Network Systems, Inc.\n' },
            { id: (Date.now() + 3).toString(), type: 'output', content: 'N2960 Boot Loader (N2960-HBOOT-M) Version 12.2(25r)FX\nLoading "flash:n2960-lanbase-mz.150-2.SE4.bin"...\n################################################################################\n' },
            { id: (Date.now() + 4).toString(), type: 'output', content: '[OK]\n\nNetwork NOS Software, Version 15.0(2)SE4\nPress RETURN to get started!\n\n' },
          ];
          
          setDeviceStates(prev => new Map(prev).set(deviceId, finalState));
          setDeviceOutputs(prev => new Map(prev).set(deviceId, bootMessages));
          setIsLoading(false);
          return;
        }

        // Handle Confirmation Actions
        if (result.confirmationAction === 'reload' && skipConfirm) {
          const reloadOutput: TerminalOutput = {
            id: (Date.now() + 2).toString(),
            type: 'output',
            content: '\n[OK]\nReload requested...\n'
          };
          setDeviceOutputs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(deviceId) || [];
            newMap.set(deviceId, [...current, reloadOutput]);
            return newMap;
          });
        }

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

        // Update State
        if (result.newState) {
          const nextState = {
            ...(deviceStatesRef.current.get(deviceId) || deviceState),
            ...result.newState
          };
          deviceStatesRef.current.set(deviceId, nextState);
          setDeviceStates(new Map(deviceStatesRef.current));
        }
      } else {
        // Error handling
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
          const nextState = {
            ...(deviceStatesRef.current.get(deviceId) || deviceState),
            ...result.newState
          };
          deviceStatesRef.current.set(deviceId, nextState);
          setDeviceStates(new Map(deviceStatesRef.current));
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
  }, [language, getOrCreateDeviceState, getOrCreateDeviceOutputs, deviceStates]);

  const resetAll = () => {
    setDeviceStates(new Map([['switch-1', createInitialState()]]));
    setDeviceOutputs(new Map([['switch-1', []]]));
    setPcOutputs(new Map([['pc-1', [
      { id: '0', type: 'output', content: 'OS Windows [Version 10.0.19045.3803]\n(c) OS Corporation. Tüm hakları saklıdır.\n' },
      { id: '1', type: 'output', content: '\nEthernet adapter Ethernet bağlantısı:\n' }
    ]]]));
  };

  return {
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
  };
}
