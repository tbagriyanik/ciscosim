import { useState, useCallback } from 'react';
import { SwitchState } from '@/lib/network/types';
import { createInitialState, createInitialRouterState } from '@/lib/network/initialState';
import { executeCommand, getPrompt } from '@/lib/network/executor';
import type { TerminalOutput } from '@/components/network/Terminal';
import { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';

interface PCOutputLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'success';
  content: string;
}

export function useDeviceManager(language: 'tr' | 'en') {
  const [deviceStates, setDeviceStates] = useState<Map<string, SwitchState>>(() => {
    const initialMap = new Map<string, SwitchState>();
    initialMap.set('switch-1', createInitialState());
    return initialMap;
  });

  const [deviceOutputs, setDeviceOutputs] = useState<Map<string, TerminalOutput[]>>(() => new Map());

  const [pcOutputs, setPcOutputs] = useState<Map<string, PCOutputLine[]>>(() => {
    const initialMap = new Map<string, PCOutputLine[]>();
    initialMap.set('pc-1', [
      { id: '0', type: 'output', content: 'OS Windows [Version 10.0.19045.3803]\n(c) OS Corporation. All rights reserved.\n' },
      { id: '1', type: 'output', content: '\nEthernet adapter Ethernet connection:\n' }
    ]);
    return initialMap;
  });

  const [pcHistories, setPcHistories] = useState<Map<string, string[]>>(() => new Map());

  const [isLoading, setIsLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; message: string; action: string; onConfirm: () => void; } | null>(null);

  const getOrCreateDeviceState = useCallback((deviceId: string, deviceType: 'pc' | 'switch' | 'router', initialHostname?: string): SwitchState => {
    let deviceState = deviceStates.get(deviceId);
    const defaultName = deviceType === 'router' ? 'Router' : 'Switch';

    if (!deviceState) {
      deviceState = deviceType === 'router' ? createInitialRouterState() : createInitialState();
      const hostname = initialHostname || defaultName;
      deviceState = { ...deviceState, hostname };

      if (deviceState.runningConfig) {
        deviceState.runningConfig = deviceState.runningConfig.map(line =>
          line.startsWith('hostname') ? `hostname ${hostname}` : line
        );
      }
      setDeviceStates(prev => new Map(prev).set(deviceId, deviceState!));
    } else if (initialHostname && (deviceState.hostname === 'Switch' || deviceState.hostname === 'Router') && initialHostname !== deviceState.hostname) {
      const updatedState = { ...deviceState, hostname: initialHostname };
      if (updatedState.runningConfig) {
        updatedState.runningConfig = updatedState.runningConfig.map(line =>
          line.startsWith('hostname') ? `hostname ${initialHostname}` : line
        );
      }
      setDeviceStates(prev => new Map(prev).set(deviceId, updatedState));
      return updatedState;
    }
    return deviceState;
  }, [deviceStates]);

  const getOrCreateDeviceOutputs = useCallback((deviceId: string): TerminalOutput[] => {
    let outputs = deviceOutputs.get(deviceId);
    if (!outputs) {
      const state = deviceStates.get(deviceId);
      const isRouter = deviceId.includes('router');
      outputs = [
        { id: `boot-1-${Date.now()}`, type: 'output', content: isRouter ? '\n\nSystem Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)\nTechnical Support: http://yunus.sf.net\nCopyright (c) 1986-2026 by Systems, Inc.\n' : '\n\nSystem Bootstrap, Version 12.1(11r)EA1, RELEASE SOFTWARE (fc1)\nTechnical Support: http://yunus.sf.net\nCopyright (c) 1986-2026 by Systems, Inc.\n' },
        { id: `boot-2-${Date.now()}`, type: 'output', content: isRouter ? 'C1900 platform with 524288K bytes of main memory\nMain memory configured to 64 bit mode with ECC disabled\n' : 'C2960 platform with 262144K bytes of main memory\nMain memory configured to 32 bit mode with ECC enabled\n' },
        { id: `boot-3-${Date.now()}`, type: 'output', content: '\nLoading the runtime image: ######################################## [OK]\n' }
      ];
      if (state?.bannerMOTD) {
        outputs.push({ id: `banner-${Date.now()}`, type: 'output', content: `\n${state.bannerMOTD}\n` });
      }
      outputs.push({ id: `boot-ready-${Date.now()}`, type: 'output', content: '\nPress RETURN to get started!\n' });
      setDeviceOutputs(prev => new Map(prev).set(deviceId, outputs!));
    }
    return outputs;
  }, [deviceOutputs, deviceStates]);

  const getOrCreatePCOutputs = useCallback((deviceId: string): PCOutputLine[] => {
    let outputs = pcOutputs.get(deviceId);
    if (!outputs) {
      outputs = [
        { id: '0', type: 'output', content: 'OS Windows [Version 10.0.19045.3803]\n(c) OS Corporation. All rights reserved.\n' },
        { id: '1', type: 'output', content: '\nEthernet adapter Ethernet connection:\n' }
      ];
      setPcOutputs(prev => new Map(prev).set(deviceId, outputs!));
    }
    return outputs;
  }, [pcOutputs]);

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
      for (const line of command.split('\n').filter(l => l.trim())) {
        await handleCommandForDevice(deviceId, line.trim(), topologyDevices, setActiveDeviceId, setActiveDeviceType, topologyConnections, skipConfirm);
      }
      return;
    }

    setIsLoading(true);
    try {
      const deviceState = deviceStates.get(deviceId) || (deviceId.includes('router') ? createInitialRouterState() : createInitialState());
      const devicePrompt = getPrompt(deviceState);
      const { requiresConfirmation, confirmationMessage, confirmationAction, success, newState, error, ...result } = executeCommand(deviceState, command, language, topologyDevices ?? undefined, topologyConnections ?? undefined, deviceStates);

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
        return;
      }

      const newOutputs: TerminalOutput[] = [];
      if (!deviceState.awaitingPassword) {
        newOutputs.push({ id: Date.now().toString(), type: 'command', content: command, prompt: devicePrompt });
      }

      if (success) {
        if (result.requiresPassword && result.passwordPrompt) {
          newOutputs.push({ id: `${Date.now()}-pw`, type: 'password-prompt', content: result.passwordPrompt });
        } else if (result.output) {
          newOutputs.push({ id: `${Date.now()}-out`, type: 'output', content: result.output });
        }
        if (newState) {
          const shouldPropagateVlans = !!topologyConnections && !!topologyDevices && /^(no\s+)?vlan\s+\d+/i.test(command.trim());
          setDeviceStates(prev => {
            const next = new Map(prev);
            const mergedState = { ...deviceState, ...newState };
            next.set(deviceId, mergedState);

            if (shouldPropagateVlans) {
              const beforeVlans = new Set(Object.keys(deviceState.vlans || {}).map(Number));
              const afterVlans = new Set(Object.keys(mergedState.vlans || {}).map(Number));
              const addedVlans = Array.from(afterVlans).filter(v => !beforeVlans.has(v));
              const removedVlans = Array.from(beforeVlans).filter(v => !afterVlans.has(v));

              const sourceDevice = topologyDevices.find(d => d.id === deviceId);
              if (sourceDevice?.type === 'switch') {
                const sourceMode = mergedState.vtpMode;
                if (sourceMode !== 'transparent' && sourceMode !== 'off' && sourceMode !== 'client') {
                  const sourceDomain = mergedState.vtpDomain || '';

                  topologyConnections.forEach(conn => {
                    const isSource = conn.sourceDeviceId === deviceId || conn.targetDeviceId === deviceId;
                    if (!isSource) return;

                    const neighborId = conn.sourceDeviceId === deviceId ? conn.targetDeviceId : conn.sourceDeviceId;
                    const neighborDevice = topologyDevices.find(d => d.id === neighborId);
                    if (neighborDevice?.type !== 'switch') return;

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

        if (result.telnetTarget && topologyDevices) {
          const targetDevice = topologyDevices.find(d => d.ip === result.telnetTarget);
          if (targetDevice && targetDevice.type !== 'pc') {
            newOutputs.push({ id: `${Date.now()}-telnet`, type: 'output', content: ` Open\n\n**** Connected to ${targetDevice.name} (${result.telnetTarget}) via VTY ****\n` });
            const targetType = targetDevice.type as 'switch' | 'router';
            getOrCreateDeviceState(targetDevice.id, targetType, targetDevice.name);
            getOrCreateDeviceOutputs(targetDevice.id);
            setActiveDeviceId(targetDevice.id);
            setActiveDeviceType(targetType);
          } else {
            newOutputs.push({ id: `${Date.now()}-telnet-fail`, type: 'error', content: `\n% Connection timed out; remote host not responding\n` });
          }
        }
      } else {
        newOutputs.push({ id: `${Date.now()}-err`, type: 'error', content: error || 'Unknown error' });
        if (newState) {
          setDeviceStates(prev => new Map(prev).set(deviceId, { ...deviceState, ...newState }));
        }
      }
      if (newOutputs.length > 0) {
        setDeviceOutputs(prev => new Map(prev).set(deviceId, [...(prev.get(deviceId) || []), ...newOutputs]));
      }

    } catch (e) {
      setDeviceOutputs(prev => new Map(prev).set(deviceId, [...(prev.get(deviceId) || []), { id: `${Date.now()}-sys-err`, type: 'error', content: `System error: ${(e as Error).message}` }]));
    } finally {
      setIsLoading(false);
    }
  }, [language, deviceStates, getOrCreateDeviceState, getOrCreateDeviceOutputs]);

  const resetAll = () => {
    setDeviceStates(new Map([['switch-1', createInitialState()]]));
    setDeviceOutputs(new Map());
    setPcOutputs(new Map([['pc-1', [
      { id: '0', type: 'output', content: 'OS Windows [Version 10.0.19045.3803]\n(c) OS Corporation. All rights reserved.\n' },
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
