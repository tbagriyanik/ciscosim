'use client';

import { useCallback } from 'react';
import type { CanvasDevice, CanvasConnection } from '../networkTopology.types';
import type { SwitchState } from '@/lib/network/types';
import type { FtpSession, PcFile } from './PCPanel.types';
import { checkConnectivity } from '@/lib/network/connectivity';
import { dispatchCapturedPackets } from '../../../utils/packetCapture';
import { loadFs, saveFs, readFile, getFtpFilesFromUploadDir, writeFile } from './pcFileSystem';

export interface UsePCPanelFtpCommandsParams {
  deviceId: string;
  language: string;
  ftpSession: FtpSession | null;
  setFtpSession: React.Dispatch<React.SetStateAction<FtpSession | null>>;
  setPcLocalFiles: React.Dispatch<React.SetStateAction<PcFile[]>>;
  setIsFtpFilePickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  topologyDevices: CanvasDevice[];
  topologyConnections: { sourceDeviceId: string; sourcePort: string; targetDeviceId: string; targetPort: string; cableType?: string; active?: boolean }[];
  deviceStates: Map<string, SwitchState> | undefined;
  addLocalOutput: (type: 'command' | 'output' | 'error' | 'success', content: string, prompt?: string) => void;
}

export function usePCPanelFtpCommands(params: UsePCPanelFtpCommandsParams) {
  const {
    deviceId,
    language,
    ftpSession,
    setFtpSession,
    setPcLocalFiles,
    setIsFtpFilePickerOpen,
    topologyDevices,
    topologyConnections,
    deviceStates,
    addLocalOutput,
  } = params;

  const executeFtpPut = useCallback((fileName: string) => {
    const session = ftpSession;
    if (!session) return;

    const clientFs = loadFs(deviceId);
    const content = readFile(clientFs, `C:\\upload\\${fileName}`) || readFile(clientFs, `C:\\${fileName}`) || 'Sample FTP Data';
    writeFile(clientFs, `C:\\upload\\${fileName}`, content);
    saveFs(deviceId, clientFs);

    if (session.targetDeviceId) {
      const serverDev = topologyDevices.find(d => d.id === session.targetDeviceId);
      if (serverDev?.ip) {
        const connectivity = checkConnectivity(deviceId, serverDev.ip, topologyDevices, topologyConnections as unknown as CanvasConnection[], deviceStates || new Map(), language as 'tr' | 'en', { protocol: 'tcp', port: '20' });
        const ftpPackets = (connectivity.capturedPackets || []).map(p => ({
          ...p,
          protocol: 'FTP',
          info: `FTP: STOR ${fileName} (150 Opening BINARY connection)`
        }));
        dispatchCapturedPackets(ftpPackets);
      }
      const serverFs = loadFs(session.targetDeviceId);
      writeFile(serverFs, `C:\\upload\\${fileName}`, content);
      saveFs(session.targetDeviceId, serverFs);

      const serverFiles = getFtpFilesFromUploadDir(session.targetDeviceId);
      setFtpSession({ ...session, files: serverFiles });

      const targetDev = topologyDevices.find(d => d.id === session.targetDeviceId);
      if (targetDev) {
        window.dispatchEvent(new CustomEvent('update-topology-device-config', {
          detail: {
            deviceId: session.targetDeviceId,
            config: {
              services: {
                ...targetDev.services,
                ftp: {
                  ...targetDev.services?.ftp,
                  enabled: true,
                  files: serverFiles,
                }
              }
            }
          }
        }));
      }
    }

    addLocalOutput('output', `150 Opening BINARY mode data connection for ${fileName}\n226 Transfer complete.`);
  }, [ftpSession, addLocalOutput, topologyDevices, setFtpSession, deviceId, topologyConnections, deviceStates, language]);

  const handleFtpSessionCommand = useCallback((cmdLine: string) => {
    const session = ftpSession;
    if (!session) return;
    const cmd = cmdLine.trim().toLowerCase();
    if (cmd === 'quit' || cmd === 'bye' || cmd === 'exit') {
      addLocalOutput('output', '221 Goodbye.');
      setFtpSession(null);
      return;
    }
    if (cmd === 'help' || cmd === '?') {
      addLocalOutput('output', 'Commands: put, ls, dir, get <file>, quit, bye, exit');
      return;
    }
    if (cmd === 'ls' || cmd === 'dir') {
      const files = session.targetDeviceId
        ? getFtpFilesFromUploadDir(session.targetDeviceId)
        : (session.files || []);
      if (!files || files.length === 0) {
        addLocalOutput('output', '(empty)');
      } else {
        const list = files.map(f => `${f.name.padEnd(20)} ${(f.size || 0).toString().padStart(8)} bytes`).join('\n');
        addLocalOutput('output', list);
      }
      return;
    }
    const getMatch = cmdLine.trim().match(/^(get|recv|mget)\s+(.+)/i);
    if (getMatch) {
      const fileName = getMatch[2];
      const targetDevId = session.targetDeviceId;
      let content = 'Sample FTP File Content';
      if (targetDevId) {
        const serverDev = topologyDevices.find(d => d.id === targetDevId);
        if (serverDev?.ip) {
          const connectivity = checkConnectivity(deviceId, serverDev.ip, topologyDevices, topologyConnections as unknown as CanvasConnection[], deviceStates || new Map(), language as 'tr' | 'en', { protocol: 'tcp', port: '20' });
          const ftpPackets = (connectivity.capturedPackets || []).map(p => ({
            ...p,
            protocol: 'FTP',
            info: `FTP: RETR ${fileName} (226 Transfer complete)`
          }));
          dispatchCapturedPackets(ftpPackets);
        }
        const serverFs = loadFs(targetDevId);
        content = readFile(serverFs, `C:\\upload\\${fileName}`) || readFile(serverFs, `C:\\${fileName}`) || content;
      }
      const clientFs = loadFs(deviceId);
      writeFile(clientFs, `C:\\upload\\${fileName}`, content);
      saveFs(deviceId, clientFs);

      const localFile = { name: fileName, size: content.length, modifiedAt: new Date().toISOString() };
      setPcLocalFiles(prev => prev.filter(f => f.name !== fileName).concat(localFile));
      addLocalOutput('output', `150 Opening BINARY mode data connection for ${fileName}\n226 Transfer complete.`);
      return;
    }
    const putMatch = cmdLine.trim().match(/^(put|send|mput)(?:\s+(.+))?$/i);
    if (putMatch) {
      if (putMatch[2]) {
        const fileName = putMatch[2];
        executeFtpPut(fileName);
      } else {
        setIsFtpFilePickerOpen(true);
      }
      return;
    }
    addLocalOutput('output', '200 Command okay.');
  }, [ftpSession, addLocalOutput, setFtpSession, deviceId, setIsFtpFilePickerOpen, executeFtpPut, setPcLocalFiles, topologyDevices, topologyConnections, deviceStates, language]);

  return {
    executeFtpPut,
    handleFtpSessionCommand,
  };
}
