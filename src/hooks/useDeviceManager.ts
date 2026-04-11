import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SwitchState } from '@/lib/network/types';
import { createInitialState, createInitialRouterState, applyStartupConfig, buildStartupConfig } from '@/lib/network/initialState';
import { buildRunningConfig } from '@/lib/network/core/configBuilder';
import { executeCommand, getPrompt } from '@/lib/network/executor';
import type { TerminalOutput } from '@/components/network/Terminal';
import { BOOT_PROGRESS_MARKER } from '@/components/network/Terminal';
import { CanvasDevice, CanvasConnection, DeviceType } from '@/components/network/networkTopology.types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppFeedback } from '@/hooks/useAppFeedback';
import { formatErrorForUser } from '@/lib/errors/errorHandler';

const isSwitchDeviceType = (type?: DeviceType | string) => type === 'switchL2' || type === 'switchL3';
const resolveSwitchBootType = (switchModel?: string): 'switchL2' | 'switchL3' =>
  switchModel === 'WS-C3560-24PS' ? 'switchL3' : 'switchL2';

interface PCOutputLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'success';
  content: string;
  prompt?: string;
}

export function useDeviceManager() {
  const { toast } = useToast();
  const { notifyErrorInfo } = useAppFeedback();
  const { language } = useLanguage();

  const [deviceStates, setDeviceStates] = useState<Map<string, SwitchState>>(new Map());

  const [deviceOutputs, setDeviceOutputs] = useState<Map<string, TerminalOutput[]>>(() => new Map());

  const [pcOutputs, setPcOutputs] = useState<Map<string, PCOutputLine[]>>(() => {
    try {
      const savedData = localStorage.getItem('netsim_autosave');
      if (savedData) {
        const projectData = JSON.parse(savedData);
        if (projectData.pcOutputs && Array.isArray(projectData.pcOutputs)) {
          const newPcOutputs = new Map<string, PCOutputLine[]>();
          projectData.pcOutputs.forEach((item: { id: string; outputs: PCOutputLine[] }) => {
            newPcOutputs.set(item.id, item.outputs || []);
          });
          return newPcOutputs;
        }
      }
    } catch {
      // ignore
    }
    return new Map();
  });

  const [pcHistories, setPcHistories] = useState<Map<string, string[]>>(() => {
    try {
      const savedData = localStorage.getItem('netsim_autosave');
      if (savedData) {
        const projectData = JSON.parse(savedData);
        if (projectData.pcHistories && Array.isArray(projectData.pcHistories)) {
          const newPcHistories = new Map<string, string[]>();
          projectData.pcHistories.forEach((item: { id: string; history: string[] }) => {
            newPcHistories.set(item.id, item.history || []);
          });
          return newPcHistories;
        }
      }
    } catch {
      // ignore
    }
    return new Map();
  });

  const [isLoading, setIsLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; message: string; action: string; onConfirm: () => void; } | null>(null);

  const getBootMessage = useCallback((deviceType: Exclude<DeviceType, 'pc'>, switchModel?: string, language: 'tr' | 'en' = 'en') => {
    const isRouter = deviceType === 'router';
    const isL3Switch = deviceType === 'switchL3' || switchModel?.includes('3560');
    const isL2Switch = !isRouter && !isL3Switch;

    if (isRouter) {
      const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
      return {
        boot1: `\n\nSystem Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)\nTechnical Support: http://yunus.sf.net\nCopyright (c) 1994-2011 by Network Systems, Inc.\n`,
        boot2: `ISR4451/K9 platform with 4096 K bytes of memory\n\n${syslog}\nLoad/bootstrap symbols loaded, GOXR initialization\nReading all bootflash vectors\nPOST: CPU PCIe port Check PASS\nCPU memory test . . . . . . . . . . . . . OK\nBoard initialization completed\nInitializing flash file system\n`,
        boot3: `\nBooting flash:c1900-universalk9-mz.SPA.154-3.M.bin...OK!\nExtracting files from flash:c1900-universalk9-mz.SPA.154-3.M.bin...\n  ########## [OK]\n  0 bytes remaining in flash device\n`,
        initMessage: language === 'tr' ? 'Sistem başlatılıyor' : 'Initializing system'
      };
    }

    if (isL3Switch) {
      const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
      return {
        boot1: `\n\nSystem Bootstrap, Version 12.2(55r)SE, RELEASE SOFTWARE (fc1)\nTechnical Support: http://yunus.sf.net\nCopyright (c) 1994-2011 by Network Systems, Inc.\n`,
        boot2: `C3560 platform with 131072 K bytes of memory\n\n${syslog}\nLoad/bootstrap symbols loaded\nReading all bootflash vectors\nPOST: CPU PCIe port Check PASS\nCPU memory test . . . . . . . . . . . . . OK\nBoard initialization completed\nInitializing flash file system\n`,
        boot3: `\nBooting flash:c3560-ipbase-mz.152-2.SE4.bin...OK!\nExtracting files from flash:c3560-ipbase-mz.152-2.SE4.bin...\n  ########## [OK]\n  0 bytes remaining in flash device\n`,
        initMessage: language === 'tr' ? 'Sistem açıldı' : 'System is powered on'
      };
    }

    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    return {
      boot1: `\n\nSystem Bootstrap, Version 12.2(11r)EA1, RELEASE SOFTWARE (fc1)\nTechnical Support: http://yunus.sf.net\nCopyright (c) 1994-2010 by Network Systems, Inc.\n`,
      boot2: `C2960 platform with 65536 K bytes of memory\n\n${syslog}\nLoad/bootstrap symbols loaded\nReading all bootflash vectors\nPOST: CPU Ethernet port Check PASS\nCPU memory test . . . . . . . . . . . . . OK\nBoard initialization completed\nInitializing flash file system\n`,
      boot3: `\nBooting flash:c2960-lanbase-mz.152-2.E6.bin...OK!\nExtracting files from flash:c2960-lanbase-mz.152-2.E6.bin...\n  ########## [OK]\n  0 bytes remaining in flash device\n`,
      initMessage: language === 'tr' ? 'Sistem açıldı' : 'System is powered on'
    };
  }, []);

  const ensureSwitchModelConsistency = useCallback((state: SwitchState, model?: string, macAddress?: string): SwitchState => {
    if (!model) return state;

    const normalizedModel = model as any;
    const baseState = createInitialState(macAddress || state.macAddress, normalizedModel);
    const mergedPorts = { ...baseState.ports, ...state.ports };

    return {
      ...state,
      switchModel: normalizedModel,
      switchLayer: baseState.switchLayer,
      ports: mergedPorts,
      version: {
        ...state.version,
        modelName: normalizedModel,
      },
    };
  }, []);

  // Listen for power toggle events from topology and handle device reset
  useEffect(() => {
    const handlePowerToggle = (event: CustomEvent<{ deviceId: string; nextStatus: 'online' | 'offline'; switchModel?: string; deviceType?: DeviceType }>) => {
      const { deviceId, nextStatus, switchModel: incomingModel, deviceType } = event.detail;

      if (nextStatus === 'online') {
        // Power on: reset device state and show boot sequence
        const existingState = deviceStates.get(deviceId);
        const isRouter = deviceType === 'router' || deviceId.includes('router') || existingState?.switchLayer === 'L3';
        const isSwitchL3 = deviceType === 'switchL3' || existingState?.switchLayer === 'L3' || existingState?.switchModel === 'WS-C3560-24PS';

        // Get the switch model from existing state or default. L3 switches should start as 3560.
        const switchModel = existingState?.switchModel || incomingModel || (isRouter || isSwitchL3 ? 'WS-C3560-24PS' : 'WS-C2960-24TT-L');
        const baseState = isRouter ? createInitialRouterState() : createInitialState(undefined, switchModel as any);

        // Get existing state to preserve saved configuration and identity
        const startupConfig = existingState?.startupConfig;
        const defaultHostname = isRouter ? 'Router' : 'Switch';
        const hostname = startupConfig ? (existingState?.hostname || defaultHostname) : defaultHostname;

        const baseIdentityState: SwitchState = {
          ...baseState,
          hostname,
          macAddress: existingState?.macAddress || baseState.macAddress,
          switchModel: switchModel as any,
          switchLayer: baseState.switchLayer,
          version: existingState?.version || baseState.version,
          flashFiles: existingState?.flashFiles || {},
          flashStartupConfigs: existingState?.flashStartupConfigs || {}
        };

        const restoredState = startupConfig
          ? applyStartupConfig(baseIdentityState, startupConfig)
          : baseIdentityState;

        const reloadedState: SwitchState = {
          ...restoredState,
          startupConfig,
          flashFiles: existingState?.flashFiles || {},
          flashStartupConfigs: existingState?.flashStartupConfigs || {},
          currentMode: 'user',
          currentInterface: undefined,
          selectedInterfaces: undefined,
          currentLine: undefined,
          currentVlan: undefined,
          awaitingPassword: false,
          commandHistory: [],
          historyIndex: -1
        };

        setDeviceStates(prev => new Map(prev).set(deviceId, reloadedState));

        // Show a short loading line before boot outputs (small loading animation)
        (async () => {
          setDeviceOutputs(prev => new Map(prev).set(deviceId, [
            { id: `loading-${reloadedState.macAddress}`, type: 'output', content: 'Initializing system...' }
          ]));
          await sleep(600);

          const bootInfo = getBootMessage(isRouter ? 'router' : resolveSwitchBootType(reloadedState.switchModel), reloadedState.switchModel, language);
          const bootTs = Date.now();
          const bootOutputs: TerminalOutput[] = [
            { id: `boot-1-${reloadedState.macAddress}`, type: 'output', content: bootInfo.boot1 },
            { id: `boot-2-${reloadedState.macAddress}`, type: 'output', content: bootInfo.boot2 },
            { id: `boot-3-${reloadedState.macAddress}`, type: 'output', content: bootInfo.boot3 },
            // Insert banner MOTD here if present so it's visible during boot
            ...(reloadedState.bannerMOTD ? [{ id: `banner-${reloadedState.macAddress}`, type: 'output' as const, content: `\n${reloadedState.bannerMOTD}\n` }] : []),
            { id: `boot-ready-${reloadedState.macAddress}-${bootTs}`, type: 'output', content: BOOT_PROGRESS_MARKER }
          ];

          setDeviceOutputs(prev => new Map(prev).set(deviceId, bootOutputs));
        })();
      } else {
        // Power off: keep saved state so configuration survives future power cycles
        // Only clear the visible terminal output.
        setDeviceOutputs(prev => {
          const next = new Map(prev);
          next.set(deviceId, []);
          return next;
        });
      }
    };

    window.addEventListener('trigger-topology-toggle-power', handlePowerToggle as EventListener);
    return () => window.removeEventListener('trigger-topology-toggle-power', handlePowerToggle as EventListener);
  }, [deviceStates, getBootMessage]);

  const getOrCreateDeviceState = useCallback((deviceId: string, deviceType: DeviceType, initialHostname?: string, initialMac?: string, switchModel?: string): SwitchState => {
    let deviceState = deviceStates.get(deviceId);
    const defaultName = deviceType === 'router' ? 'Router' : (deviceType === 'iot' ? 'IoT' : 'Switch');

    if (!deviceState) {
      // Use the provided switchModel, default to L2 for switches, or L3 for routers
      const model = switchModel || (deviceType === 'router' ? 'WS-C3560-24PS' : deviceType === 'switchL3' ? 'WS-C3560-24PS' : 'WS-C2960-24TT-L');
      deviceState = deviceType === 'router' ? createInitialRouterState(initialMac) : createInitialState(initialMac, model as any);
      const hostname = initialHostname || defaultName;
      deviceState = { ...deviceState, hostname };
      
      // IoT devices should be WiFi clients, not AP
      if (deviceType === 'iot' && deviceState.ports['wlan0']) {
        deviceState = {
          ...deviceState,
          ports: {
            ...deviceState.ports,
            wlan0: {
              ...deviceState.ports['wlan0'],
              wifi: {
                ssid: deviceState.ports['wlan0'].wifi?.ssid || '',
                security: deviceState.ports['wlan0'].wifi?.security || 'open',
                password: deviceState.ports['wlan0'].wifi?.password || '',
                channel: deviceState.ports['wlan0'].wifi?.channel || '2.4GHz',
                mode: 'client',
                hidden: false
              }
            }
          }
        };
      }
      
      // Rebuild runningConfig from actual state so wlan0 and all ports are reflected correctly
      deviceState = { ...deviceState, runningConfig: buildRunningConfig({ ...deviceState }) } as SwitchState;
      setDeviceStates(prev => new Map(prev).set(deviceId, deviceState!));
    } else {
      // Update existing device state if switchModel is provided and differs
      if (switchModel && deviceState.switchModel !== switchModel) {
        const updatedState = ensureSwitchModelConsistency(deviceState, switchModel, initialMac);
        setDeviceStates(prev => new Map(prev).set(deviceId, updatedState));
        deviceState = updatedState;
      }

      if (!deviceState.switchModel) {
        const fallbackModel = switchModel || (deviceType === 'router' ? 'WS-C3560-24PS' : deviceType === 'switchL3' ? 'WS-C3560-24PS' : 'WS-C2960-24TT-L');
        const updatedState = ensureSwitchModelConsistency(deviceState, fallbackModel, initialMac);
        setDeviceStates(prev => new Map(prev).set(deviceId, updatedState));
        deviceState = updatedState;
      }

      if (isSwitchDeviceType(deviceType) && deviceState.switchModel === 'WS-C3560-24PS' && (!deviceState.ports['gi0/3'] || !deviceState.ports['gi0/4'])) {
        const healedState = ensureSwitchModelConsistency(deviceState, deviceState.switchModel, initialMac);
        setDeviceStates(prev => new Map(prev).set(deviceId, healedState));
        deviceState = healedState;
      }

      if (initialHostname && (deviceState.hostname === 'Switch' || deviceState.hostname === 'Router') && initialHostname !== deviceState.hostname) {
        const updatedState = { ...deviceState, hostname: initialHostname };
        if (updatedState.runningConfig) {
          updatedState.runningConfig = updatedState.runningConfig.map(line =>
            line.startsWith('hostname') ? `hostname ${initialHostname}` : line
          );
        }
        setDeviceStates(prev => new Map(prev).set(deviceId, updatedState));
        deviceState = updatedState;
      }
    }
    return deviceState!;
  }, [deviceStates, ensureSwitchModelConsistency]);

  const getOrCreateDeviceOutputs = useCallback((deviceId: string, deviceStateArg?: SwitchState): TerminalOutput[] => {
    let outputs = deviceOutputs.get(deviceId);
    const hasBootMessages = outputs?.some(o => o.id?.startsWith('boot-'));

    // If no outputs exist OR boot messages are missing, generate them
    if (!outputs || !hasBootMessages) {
      const state = deviceStateArg || deviceStates.get(deviceId);
      const isRouter = deviceId.includes('router');
      const inferredDeviceType: Exclude<DeviceType, 'pc'> = isRouter
        ? 'router'
        : state?.switchLayer === 'L3'
          ? 'switchL3'
          : 'switchL2';

      const bootInfo = getBootMessage(inferredDeviceType, state?.switchModel, language);
      const fallbackSwitchModel = state?.switchModel || deviceStates.get(deviceId)?.switchModel;
      const fallbackState = state || (isRouter ? createInitialRouterState() : createInitialState(undefined, fallbackSwitchModel as any));
      const suffix = fallbackState?.macAddress || deviceId;

      const newBootMessages: TerminalOutput[] = [
        { id: `boot-1-${suffix}`, type: 'output', content: bootInfo.boot1 },
        { id: `boot-2-${suffix}`, type: 'output', content: bootInfo.boot2 },
        { id: `boot-3-${suffix}`, type: 'output', content: bootInfo.boot3 },
        ...(fallbackState?.bannerMOTD ? [{ id: `banner-${suffix}`, type: 'output' as const, content: `\n${fallbackState.bannerMOTD}\n` }] : []),
        { id: `boot-ready-${suffix}`, type: 'output', content: BOOT_PROGRESS_MARKER }
      ];

      // If we have existing outputs, append them; otherwise use just boot messages
      if (outputs && hasBootMessages === false && outputs.length > 0) {
        outputs = [...newBootMessages, ...outputs] as TerminalOutput[];
      } else {
        outputs = newBootMessages;
      }

      setDeviceOutputs(prev => new Map(prev).set(deviceId, outputs!));
    }
    return outputs;
  }, [deviceOutputs, deviceStates, getBootMessage]);

  const getOrCreatePCOutputs = useCallback((deviceId: string): PCOutputLine[] => {
    let outputs = pcOutputs.get(deviceId);
    if (!outputs) {
      outputs = [
        { id: '0', type: 'output', content: 'OS [Version 10.0.26200.8037]\n(c) OS Corporation. All rights reserved.\n' },
        { id: '1', type: 'output', content: '\nEthernet adapter Ethernet connection:\n' }
      ];
      setPcOutputs(prev => new Map(prev).set(deviceId, outputs!));
    }
    return outputs;
  }, [pcOutputs]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const appendOutputsWithDelay = useCallback(async (
    deviceId: string,
    lines: TerminalOutput[],
    options?: { clearFirst?: boolean; minDelay?: number; maxDelay?: number }
  ) => {
    if (options?.clearFirst) {
      setDeviceOutputs(prev => new Map(prev).set(deviceId, []));
    }

    for (const line of lines) {
      const content = line.content || '';
      const animatedLine = content.includes('Loading the runtime image')
        ? {
          ...line,
          content: '\nLoading the runtime image: #\n'
        }
        : content.includes('Sending') && content.includes('!')
          ? {
            ...line,
            content: content.replace(/!+/g, (match) => '!'.repeat(Math.max(1, Math.min(5, match.length))))
          }
          : line;

      setDeviceOutputs(prev => new Map(prev).set(deviceId, [...(prev.get(deviceId) || []), animatedLine]));
      const minDelay = options?.minDelay ?? 80;
      const maxDelay = options?.maxDelay ?? 280;
      const delay = minDelay + Math.floor(Math.random() * Math.max(1, maxDelay - minDelay));
      await sleep(delay);
    }
  }, []);

  const handleCommandForDevice = useCallback(async (
    deviceId: string,
    command: string,
    topologyDevices: CanvasDevice[] | null,
    setActiveDeviceId: (id: string) => void,
    setActiveDeviceType: (type: DeviceType) => void,
    topologyConnections: CanvasConnection[] | null = null,
    skipConfirm = false
  ): Promise<any> => {
    // Handle cancellation token
    if (command === '__CANCEL__') {
      setIsLoading(false);
      const deviceState = deviceStates.get(deviceId) || (deviceId.includes('router') ? createInitialRouterState() : createInitialState());
      getOrCreateDeviceOutputs(deviceId);
      setDeviceOutputs(prev => {
        const newMap = new Map(prev);
        const outputs = newMap.get(deviceId) || [];
        newMap.set(deviceId, [
          ...outputs,
          {
            id: `${Date.now()}-cancel`,
            type: 'output',
            content: language === 'tr' ? '\n^C\nKomut iptal edildi.' : '\n^C\nCommand cancelled.',
            timestamp: Date.now()
          }
        ]);
        return newMap;
      });
      return { success: false, error: 'Cancelled' };
    }

    if (command.includes('\n')) {
      for (const line of command.split('\n').filter(l => l.trim())) {
        await handleCommandForDevice(deviceId, line.trim(), topologyDevices, setActiveDeviceId, setActiveDeviceType, topologyConnections, skipConfirm);
      }
      return { success: true };
    }

    setIsLoading(true);
    try {
      const deviceState = deviceStates.get(deviceId) || (deviceId.includes('router') ? createInitialRouterState() : createInitialState());
      const devicePrompt = getPrompt(deviceState);
      const result = executeCommand(
        deviceState,
        command,
        language,
        topologyDevices ?? undefined,
        topologyConnections ?? undefined,
        deviceStates,
        deviceId
      );

      const { requiresConfirmation, confirmationMessage, confirmationAction, success, newState, error, triggerPingAnimation } = result as any;
      const trimmedCommand = command.trim().toLowerCase();
      const isInternalCommand = command === '__CONSOLE_CONNECT__';

      if (requiresConfirmation && !skipConfirm) {
        setIsLoading(false);
        setConfirmDialog({
          show: true,
          message: confirmationMessage || 'Are you sure?',
          action: confirmationAction || command,
          onConfirm: () => {
            setConfirmDialog(null);
            handleCommandForDevice(deviceId, command, topologyDevices, setActiveDeviceId, setActiveDeviceType, topologyConnections, true);
          }
        });

        if (triggerPingAnimation) {
          window.dispatchEvent(new CustomEvent('trigger-ping-animation', {
            detail: { sourceId: deviceId, targetId: triggerPingAnimation }
          }));
        }

        return result;
      }

      const newOutputs: TerminalOutput[] = [];
      const now = Date.now();
      if (!isInternalCommand && !deviceState.awaitingPassword) {
        newOutputs.push({ id: now.toString(), type: 'command', content: command, prompt: devicePrompt, timestamp: now });
      }

      if (success) {
        if (result.requiresPassword && result.passwordPrompt) {
          newOutputs.push({ id: `${now}-pw`, type: 'password-prompt', content: result.passwordPrompt, timestamp: now });
        } else if (result.output) {
          newOutputs.push({ id: `${now}-out`, type: 'output', content: result.output, timestamp: now });
        }
        if (newState) {
          const shouldPropagateVlans = !!topologyConnections && !!topologyDevices && (
            /^(no\s+)?vlan\s+\d+/i.test(command.trim()) ||
            /^switchport\s+access\s+vlan\s+\d+/i.test(command.trim())
          );
          setDeviceStates(prev => {
            const next = new Map(prev);
            const mergedState = { ...deviceState, ...newState, runningConfig: buildRunningConfig({ ...deviceState, ...newState }) };
            next.set(deviceId, mergedState);

            if (shouldPropagateVlans) {
              const beforeVlans = new Set(Object.keys(deviceState.vlans || {}).map(Number));
              const afterVlans = new Set(Object.keys(mergedState.vlans || {}).map(Number));
              const addedVlans = Array.from(afterVlans).filter(v => !beforeVlans.has(v));
              const removedVlans = Array.from(beforeVlans).filter(v => !afterVlans.has(v));

              const sourceDevice = topologyDevices.find(d => d.id === deviceId);
              if (isSwitchDeviceType(sourceDevice?.type)) {
                const sourceMode = mergedState.vtpMode;
                if (sourceMode !== 'transparent' && sourceMode !== 'off' && sourceMode !== 'client') {
                  const sourceDomain = mergedState.vtpDomain || '';

                  topologyConnections.forEach(conn => {
                    const isSource = conn.sourceDeviceId === deviceId || conn.targetDeviceId === deviceId;
                    if (!isSource) return;

                    const neighborId = conn.sourceDeviceId === deviceId ? conn.targetDeviceId : conn.sourceDeviceId;
                    const neighborDevice = topologyDevices.find(d => d.id === neighborId);
                    if (!isSwitchDeviceType(neighborDevice?.type)) return;

                    const sourcePortId = conn.sourceDeviceId === deviceId ? conn.sourcePort : conn.targetPort;
                    const neighborPortId = conn.sourceDeviceId === deviceId ? conn.targetPort : conn.sourcePort;
                    const sourcePort = mergedState.ports[sourcePortId];
                    const neighborState = next.get(neighborId);
                    if (!neighborState || !sourcePort) return;

                    const neighborPort = neighborState.ports[neighborPortId];
                    if (!neighborPort) return;

                    if (sourcePort.mode !== 'trunk' || neighborPort.mode !== 'trunk') return;

                    const neighborMode = neighborState.vtpMode;
                    if (neighborMode === 'transparent' || neighborMode === 'off') return;

                    const neighborDomain = neighborState.vtpDomain || '';
                    if (sourceDomain !== neighborDomain) return;

                    const isAllowed = (port: typeof sourcePort, vlanId: number) => {
                      if (!port.allowedVlans || port.allowedVlans === 'all') return true;
                      return port.allowedVlans.includes(vlanId);
                    };

                    const nextVlans = { ...neighborState.vlans };
                    let changed = false;

                    addedVlans.forEach(vlanId => {
                      if (!isAllowed(sourcePort, vlanId) || !isAllowed(neighborPort, vlanId)) return;
                      if (!nextVlans[vlanId]) {
                        nextVlans[vlanId] = { id: vlanId, name: `VLAN${vlanId}`, status: 'active', ports: [] };
                        changed = true;
                      }
                    });

                    removedVlans.forEach(vlanId => {
                      if ([1, 1002, 1003, 1004, 1005].includes(vlanId)) return;
                      if (nextVlans[vlanId]) {
                        delete nextVlans[vlanId];
                        changed = true;
                      }
                    });

                    if (changed) {
                      const nextPorts = { ...neighborState.ports };
                      removedVlans.forEach(vlanId => {
                        Object.values(nextPorts).forEach(port => {
                          if (port.vlan === vlanId) {
                            nextPorts[port.id] = { ...port, vlan: 1 };
                          }
                        });
                      });
                      next.set(neighborId, { ...neighborState, vlans: nextVlans, ports: nextPorts });
                    }
                  });
                }
              }
            }

            return next;
          });
        }
        if ((result as any).saveConfig) {
          setDeviceStates(prev => {
            const next = new Map(prev);
            const current = next.get(deviceId);
            if (current) {
              next.set(deviceId, { ...current, startupConfig: buildStartupConfig(current) });
            }
            return next;
          });

          // Show toast notification for config save
          const device = topologyDevices?.find(d => d.id === deviceId);
          const deviceName = device?.name || deviceId;
          const timestamp = new Date().toLocaleString();

          toast({
            title: language === 'tr' ? 'Yapılandırma Kaydedildi' : 'Configuration Saved',
            description: language === 'tr'
              ? `${deviceName} - running-config → startup-config (${timestamp})`
              : `${deviceName} - running-config → startup-config (${timestamp})`,
            variant: "default"
          });
        }
        if ((result as any).saveFlashConfig) {
          const flashFilename = ((result as any).flashFilename || 'running-config').trim();
          setDeviceStates(prev => {
            const next = new Map(prev);
            const current = next.get(deviceId);
            if (current) {
              const flashFiles = { ...(current.flashFiles || {}) };
              const flashStartupConfigs = { ...(current.flashStartupConfigs || {}) };
              flashFiles[flashFilename] = buildRunningConfig(current);
              flashStartupConfigs[flashFilename] = buildStartupConfig(current);
              next.set(deviceId, { ...current, flashFiles, flashStartupConfigs });
            }
            return next;
          });

          const device = topologyDevices?.find(d => d.id === deviceId);
          const deviceName = device?.name || deviceId;
          const timestamp = new Date().toLocaleString();

          toast({
            title: language === 'tr' ? 'Flash Kaydı Tamamlandı' : 'Flash Save Complete',
            description: language === 'tr'
              ? `${deviceName} - running-config → flash:${flashFilename} (${timestamp})`
              : `${deviceName} - running-config → flash:${flashFilename} (${timestamp})`,
            variant: "default"
          });
        }
        if ((result as any).restoreFlashConfig) {
          const sourceFilename = ((result as any).flashSourceFilename || 'running-config').trim();
          const currentState = deviceStates.get(deviceId);
          const startupFromFlash = currentState?.flashStartupConfigs?.[sourceFilename];
          const restored = !!(currentState && startupFromFlash);

          if (restored) {
            setDeviceStates(prev => {
              const next = new Map(prev);
              const current = next.get(deviceId);
              if (current && startupFromFlash) {
                next.set(deviceId, { ...current, startupConfig: startupFromFlash });
              }
              return next;
            });
          }

          const device = topologyDevices?.find(d => d.id === deviceId);
          const deviceName = device?.name || deviceId;
          const timestamp = new Date().toLocaleString();

          if (restored) {
            toast({
              title: language === 'tr' ? 'Flash Geri Yükleme Tamamlandı' : 'Flash Restore Complete',
              description: language === 'tr'
                ? `${deviceName} - flash:${sourceFilename} → startup-config (${timestamp})`
                : `${deviceName} - flash:${sourceFilename} → startup-config (${timestamp})`,
              variant: "default"
            });
          } else {
            toast({
              title: language === 'tr' ? 'Flash Dosyası Bulunamadı' : 'Flash File Not Found',
              description: language === 'tr'
                ? `${deviceName} üzerinde flash:${sourceFilename} bulunamadı`
                : `flash:${sourceFilename} was not found on ${deviceName}`,
              variant: "destructive"
            });
          }
        }
        if ((result as any).eraseConfig) {
          setDeviceStates(prev => {
            const next = new Map(prev);
            const current = next.get(deviceId);
            if (current) {
              next.set(deviceId, {
                ...current,
                startupConfig: undefined,
                commandHistory: [],
                historyIndex: -1,
                awaitingPassword: false,
                passwordContext: undefined,
              });
            }
            return next;
          });

          // Show toast notification for config erase
          const device = topologyDevices?.find(d => d.id === deviceId);
          const deviceName = device?.name || deviceId;
          const timestamp = new Date().toLocaleString();

          toast({
            title: language === 'tr' ? 'Yapılandırma Silindi' : 'Configuration Erased',
            description: language === 'tr'
              ? `${deviceName} - startup-config silindi (${timestamp})`
              : `${deviceName} - startup-config erased (${timestamp})`,
            variant: "destructive"
          });

          setDeviceOutputs(prev => new Map(prev).set(deviceId, []));
        }
        if (result.reloadDevice) {
          const baseState = deviceId.includes('router') ? createInitialRouterState() : createInitialState();
          const startupConfig = deviceState.startupConfig;
          const hasStartupConfig = !!startupConfig;
          const baseIdentityState = {
            ...baseState,
            hostname: hasStartupConfig ? deviceState.hostname : baseState.hostname,
            macAddress: deviceState.macAddress,
            version: deviceState.version,
            flashFiles: deviceState.flashFiles || {},
            flashStartupConfigs: deviceState.flashStartupConfigs || {}
          };
          const appliedState = hasStartupConfig
            ? applyStartupConfig(baseIdentityState, startupConfig)
            : baseIdentityState;
          const reloadedState = {
            ...appliedState,
            startupConfig: deviceState.startupConfig,
            flashFiles: deviceState.flashFiles || {},
            flashStartupConfigs: deviceState.flashStartupConfigs || {},
            currentMode: 'user' as const,
            currentInterface: undefined,
            selectedInterfaces: undefined,
            currentLine: undefined,
            currentVlan: undefined,
            awaitingPassword: false,
            commandHistory: [],
            historyIndex: -1
          };
          setDeviceStates(prev => new Map(prev).set(deviceId, reloadedState));
          const isRouter = deviceId.includes('router');
          const bootInfo = getBootMessage(isRouter ? 'router' : resolveSwitchBootType(reloadedState.switchModel), reloadedState.switchModel, language);
          const mac = reloadedState.macAddress;
          const bootTs = Date.now();
          // Clear screen immediately (sync), then show boot sequence after delay
          setDeviceOutputs(prev => new Map(prev).set(deviceId, [
            { id: `loading-${mac}`, type: 'output', content: 'Reloading...' }
          ]));
          ; (async () => {
            await sleep(600);
            const bootOutputs: TerminalOutput[] = [
              { id: `boot-1-${mac}`, type: 'output', content: bootInfo.boot1 },
              { id: `boot-2-${mac}`, type: 'output', content: bootInfo.boot2 },
              { id: `boot-3-${mac}`, type: 'output', content: bootInfo.boot3 },
              ...(reloadedState.bannerMOTD ? [{ id: `banner-${mac}`, type: 'output' as const, content: `\n${reloadedState.bannerMOTD}\n` }] : []),
              { id: `boot-ready-${mac}-${bootTs}`, type: 'output', content: BOOT_PROGRESS_MARKER }
            ];
            setDeviceOutputs(prev => new Map(prev).set(deviceId, bootOutputs));
          })();

          if (triggerPingAnimation) {
            window.dispatchEvent(new CustomEvent('trigger-ping-animation', {
              detail: { sourceId: deviceId, targetId: triggerPingAnimation }
            }));
          }

          return result;
        }

        if (result.telnetTarget && topologyDevices) {
          const targetDevice = topologyDevices.find(d => d.ip === result.telnetTarget);
          if (targetDevice && targetDevice.type !== 'pc') {
            newOutputs.push({ id: `${now}-telnet`, type: 'output', content: ` Open\n\n**** Connected to ${targetDevice.name} (${result.telnetTarget}) via VTY ****\n`, timestamp: now });
            const targetType = targetDevice.type;
            getOrCreateDeviceState(targetDevice.id, targetType, targetDevice.name);
            getOrCreateDeviceOutputs(targetDevice.id);
            setActiveDeviceId(targetDevice.id);
            setActiveDeviceType(targetType);
          } else {
            newOutputs.push({ id: `${now}-telnet-fail`, type: 'error', content: `\n% Connection timed out; remote host not responding\n`, timestamp: now });
          }
        }
      } else {
        newOutputs.push({ id: `${now}-err`, type: 'error', content: error || 'Unknown error', timestamp: now });
        if (newState) {
          setDeviceStates(prev => new Map(prev).set(deviceId, { ...deviceState, ...newState }));
        }
      }
      if (newOutputs.length > 0) {
        const shouldStream = /^(ping|reload)$/i.test(trimmedCommand) || newOutputs.some(line => line.type === 'output' && line.content.includes('\n'));
        if (shouldStream) {
          const immediate = newOutputs.filter(line => line.type === 'command' || line.type === 'password-prompt');
          const streamed = newOutputs.filter(line => line.type === 'output' || line.type === 'success' || line.type === 'error');
          if (immediate.length > 0) {
            setDeviceOutputs(prev => new Map(prev).set(deviceId, [...(prev.get(deviceId) || []), ...immediate]));
          }
          if (streamed.length > 0) {
            void appendOutputsWithDelay(deviceId, streamed, { minDelay: 70, maxDelay: 250 });
          }
        } else {
          setDeviceOutputs(prev => new Map(prev).set(deviceId, [...(prev.get(deviceId) || []), ...newOutputs]));
        }
      }


      if (triggerPingAnimation) {
        window.dispatchEvent(new CustomEvent('trigger-ping-animation', {
          detail: { sourceId: deviceId, targetId: triggerPingAnimation }
        }));
      }

      return result;

    } catch (e) {
      const errorMsg = (e as Error).message;
      if (errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('auth')) {
        toast({
          title: language === 'tr' ? 'Hata' : 'Error',
          description: language === 'tr' ? 'Konsol şifresi hatalı!' : 'Invalid console password!',
          variant: 'destructive',
        });
      }
      setDeviceOutputs(prev => new Map(prev).set(deviceId, [...(prev.get(deviceId) || []), { id: `${Date.now()}-sys-err`, type: 'error', content: `System error: ${errorMsg}`, timestamp: Date.now() }]));
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [language, deviceStates, getOrCreateDeviceState, getOrCreateDeviceOutputs, toast]);

  const resetAll = () => {
    setDeviceStates(new Map([['switch-1', createInitialState()]]));
    setDeviceOutputs(new Map());
    setPcOutputs(new Map([['pc-1', [
      { id: '0', type: 'output', content: 'OS [Version 10.0.26200.8037]\n(c) OS Corporation. All rights reserved.\n' },
      { id: '1', type: 'output', content: '\nEthernet adapter Ethernet connection:\n' }
    ]]]));
  };

  return {
    deviceStates,
    setDeviceStates,
    deviceOutputs,
    setDeviceOutputs,
    pcOutputs,
    setPcOutputs,
    pcHistories,
    setPcHistories,
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
