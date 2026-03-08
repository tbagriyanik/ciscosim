'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { CableInfo, isCableCompatible, SwitchState } from '@/lib/cisco/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface PCPanelProps {
  deviceId: string;
  cableInfo: CableInfo;
  isVisible: boolean;
  onClose: () => void;
  topologyDevices?: { id: string; type: string; name: string; ip: string; subnet?: string; gateway?: string; dns?: string; ports: { id: string; status: string }[] }[];
  topologyConnections?: { 
    sourceDeviceId: string; 
    sourcePort: string; 
    targetDeviceId: string; 
    targetPort: string; 
    cableType?: string;
    active?: boolean 
  }[];
  deviceStates?: Map<string, SwitchState>;
  onExecuteDeviceCommand?: (deviceId: string, command: string) => Promise<any>;
}

interface OutputLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'success' | 'prompt';
  content: string;
  prompt?: string;  // For interactive prompts
}

// Global store for PC outputs per device
const pcOutputsStore = new Map<string, OutputLine[]>();
const pcCommandHistoryStore = new Map<string, string[]>();

// PC IP configurations per device
const pcConfigs = new Map<string, { ip: string; subnet: string; gateway: string; dns: string; mac: string }>();

const MAX_SUGGESTIONS = 15;
const MAX_HISTORY_BUTTONS = 30;

// Interactive state for telnet/ssh sessions
interface InteractiveState {
  active: boolean;
  type: 'telnet' | 'ssh' | null;
  step: 'username' | 'password' | 'command' | null;
  targetDevice: string;
}

function getPCConfig(deviceId: string) {
  if (!pcConfigs.has(deviceId)) {
    // Extract number from device ID for IP
    const num = parseInt(deviceId.replace(/\D/g, '')) || 1;
    pcConfigs.set(deviceId, {
      ip: `192.168.1.${10 + num - 1}`,
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      dns: '8.8.8.8',
      mac: `00-1A-2B-3C-4D-${String(num).padStart(2, '0')}`
    });
  }
  return pcConfigs.get(deviceId)!;
}

function getPCOutputs(deviceId: string, language: 'tr' | 'en' = 'tr'): OutputLine[] {
  if (!pcOutputsStore.has(deviceId)) {
    pcOutputsStore.set(deviceId, [
      {
        id: '0',
        type: 'output',
        content: language === 'tr' 
          ? 'Microsoft Windows [Version 10.0.19045.3803]\n(c) Microsoft Corporation. Tüm hakları saklıdır.\n'
          : 'Microsoft Windows [Version 10.0.19045.3803]\n(c) Microsoft Corporation. All rights reserved.\n'
      },
      {
        id: '1',
        type: 'output',
        content: language === 'tr'
          ? '\nEthernet adapter Ethernet bağlantısı:\n'
          : '\nEthernet adapter Ethernet:\n'
      }
    ]);
  }
  return pcOutputsStore.get(deviceId)!;
}

function setPCOutputs(deviceId: string, outputs: OutputLine[]) {
  pcOutputsStore.set(deviceId, outputs);
}

function getCommandHistory(deviceId: string): string[] {
  if (!pcCommandHistoryStore.has(deviceId)) {
    pcCommandHistoryStore.set(deviceId, []);
  }
  return pcCommandHistoryStore.get(deviceId)!;
}

function addToCommandHistory(deviceId: string, command: string) {
  const history = getCommandHistory(deviceId);
  if (command.trim() && (history.length === 0 || history[history.length - 1] !== command)) {
    pcCommandHistoryStore.set(deviceId, [...history, command]);
  }
}

type PCActiveTab = 'desktop' | 'config' | 'terminal';

export function PCPanel({ 
  deviceId, 
  cableInfo, 
  isVisible, 
  onClose, 
  topologyDevices = [], 
  topologyConnections = [],
  deviceStates,
  onExecuteDeviceCommand
}: PCPanelProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [activeTab, setActiveTab] = useState<PCActiveTab>('desktop');
  
  // Terminal settings state
  const [terminalSettings, setTerminalSettings] = useState({
    bitsPerSecond: '9600',
    dataBits: '8',
    parity: 'None',
    stopBits: '1',
    flowControl: 'None'
  });

  const [output, setOutput] = useState<OutputLine[]>(() => getPCOutputs(deviceId, language));
  const [commandHistory, setCommandHistory] = useState<string[]>(() => getCommandHistory(deviceId));
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentCommand, setCurrentCommand] = useState('');
  const [showCompletionBar, setShowCompletionBar] = useState(true);
  const [interactiveState, setInteractiveState] = useState<InteractiveState>({
    active: false,
    type: null,
    step: null,
    targetDevice: ''
  });
  const [currentPrompt, setCurrentPrompt] = useState<string>('C:\\>');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  
  const config = getPCConfig(deviceId);
  const deviceFromTopology = topologyDevices.find(d => d.id === deviceId);
  
  const pcIP = deviceFromTopology?.ip || config.ip;
  const pcSubnet = deviceFromTopology?.subnet || config.subnet;
  const pcGateway = deviceFromTopology?.gateway || config.gateway;
  const pcDNS = deviceFromTopology?.dns || config.dns;
  const pcMAC = config.mac;
  
  const isCompatible = isCableCompatible(cableInfo);

  // Find the device that PC is connected to (via Ethernet port)
  const getConnectedDevice = useCallback((): { id: string; type: string; name: string; ip: string } | null => {
    // Find connection where this PC's eth0 port is involved
    const connection = topologyConnections.find(conn => 
      (conn.sourceDeviceId === deviceId && conn.sourcePort === 'eth0') ||
      (conn.targetDeviceId === deviceId && conn.targetPort === 'eth0')
    );
    
    if (!connection) return null;
    
    // Get the other device in the connection
    const otherDeviceId = connection.sourceDeviceId === deviceId 
      ? connection.targetDeviceId 
      : connection.sourceDeviceId;
    
    const device = topologyDevices.find(d => d.id === otherDeviceId);
    
    // Only return if it's a switch or router (not another PC)
    if (device && (device.type === 'switch' || device.type === 'router')) {
      return device;
    }
    
    return null;
  }, [deviceId, topologyConnections, topologyDevices]);

  // Find the device that PC is connected to (via Console port)
  const getConsoleDevice = useCallback((): { id: string; type: string; name: string; ip: string } | null => {
    if (!topologyConnections || !deviceId) return null;

    const connection = topologyConnections.find(conn => {
      const isSource = conn.sourceDeviceId === deviceId;
      const isTarget = conn.targetDeviceId === deviceId;
      
      if (isSource) {
        // PC is source, its port should be a COM port
        const port = conn.sourcePort.toLowerCase();
        return port.startsWith('com') || port === 'console';
      }
      if (isTarget) {
        // PC is target, its port should be a COM port
        const port = conn.targetPort.toLowerCase();
        return port.startsWith('com') || port === 'console';
      }
      return false;
    });
    
    if (!connection) return null;
    
    const otherDeviceId = connection.sourceDeviceId === deviceId 
      ? connection.targetDeviceId 
      : connection.sourceDeviceId;
    
    const device = topologyDevices.find(d => d.id === otherDeviceId);
    
    // Only return if it's a switch or router
    if (device && (device.type === 'switch' || device.type === 'router')) {
      return device;
    }
    
    return null;
  }, [deviceId, topologyConnections, topologyDevices]);

  const connectedDevice = getConnectedDevice();
  const consoleDevice = getConsoleDevice();

  // PC CMD Komutları - organized by category
  const pcCommands = {
    network: ['ping', 'telnet', 'tracert', 'nslookup', 'netstat'],
    config: ['ipconfig', 'ipconfig /all', 'arp -a', 'route print', 'getmac'],
    system: ['hostname', 'cls', 'help', 'exit', 'echo'],
  };

  // Common IP addresses for suggestions
  const commonIPs = [
    '192.168.1.1',
    '192.168.1.10',
    '192.168.1.100',
    'localhost',
    'google.com',
    '8.8.8.8',
  ];

  // Get recent history for buttons
  const getRecentHistory = useCallback((): string[] => {
    return commandHistory.slice(-MAX_HISTORY_BUTTONS).reverse();
  }, [commandHistory]);

  // Smart command suggestions based on current input
  const getSmartSuggestions = useCallback((input: string): string[] => {
    if (!input.trim()) {
      // Show most common commands when input is empty
      return ['ping', 'ipconfig', 'help', 'telnet', 'exit'];
    }

    const parts = input.toLowerCase().trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    // Get all commands for matching
    const allCommands = [...pcCommands.network, ...pcCommands.config, ...pcCommands.system];

    // If we're typing a command
    if (parts.length === 1) {
      const matches = allCommands.filter(cmd => 
        cmd.toLowerCase().startsWith(command) && cmd.toLowerCase() !== command
      );
      return matches.slice(0, MAX_SUGGESTIONS);
    }

    // Command-specific suggestions
    switch (command) {
      case 'ping':
      case 'telnet':
      case 'tracert':
      case 'nslookup':
        if (args.length === 0 || !args[0]) {
          return commonIPs;
        }
        return commonIPs.filter(ip => 
          ip.toLowerCase().startsWith(args[0].toLowerCase())
        ).slice(0, MAX_SUGGESTIONS);

      case 'ipconfig':
        if (args.length === 0) {
          return ['/all', '/release', '/renew'];
        }
        return ['/all'].filter(opt => 
          opt.toLowerCase().startsWith(args[0].toLowerCase())
        );

      case 'arp':
        if (args.length === 0) {
          return ['-a', '-d'];
        }
        return ['-a'].filter(opt => 
          opt.toLowerCase().startsWith(args[0].toLowerCase())
        );

      case 'route':
        if (args.length === 0) {
          return ['print', 'add', 'delete'];
        }
        return ['print'].filter(opt => 
          opt.toLowerCase().startsWith(args[0].toLowerCase())
        );

      case 'netstat':
        if (args.length === 0) {
          return ['-a', '-n', '-an'];
        }
        return ['-a', '-n', '-an'].filter(opt => 
          opt.toLowerCase().startsWith(args[0].toLowerCase())
        );

      default:
        return [];
    }
  }, []);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);
  
  // Close on mobile back button (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (isVisible) {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isVisible, onClose]);
  
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);
  
  // Sync output to store when it changes
  useEffect(() => {
    setPCOutputs(deviceId, output);
  }, [deviceId, output]);

  const addOutput = (type: OutputLine['type'], content: string, prompt?: string) => {
    setOutput(prev => [...prev, { id: Date.now().toString() + Math.random(), type, content, prompt }]);
  };
  
  const executeCommand = (cmd: string) => {
    // Interactive mode handling
    if (interactiveState.active) {
      handleInteractiveInput(cmd);
      return;
    }
    
    const args = cmd.trim().toLowerCase().split(/\s+/);
    const command = args[0];
    
    // Add command to output - ON SAME LINE with prompt
    addOutput('command', cmd, 'C:\\>');
    
    // Add to history
    addToCommandHistory(deviceId, cmd);
    setCommandHistory(getCommandHistory(deviceId));
    setHistoryIndex(-1);
    
    switch (command) {
      case 'ping':
        handlePing(args[1]);
        break;
      case 'telnet':
        handleTelnet(args[1]);
        break;
      case 'terminal':
        handleTerminal();
        break;
      case 'ipconfig':
        if (args[1] === '/all') {
          handleIpconfigAll();
        } else {
          handleIpconfig();
        }
        break;
      case 'arp':
        handleArp(args[1]);
        break;
      case 'tracert':
        handleTracert(args[1]);
        break;
      case 'nslookup':
        handleNslookup(args[1]);
        break;
      case 'netstat':
        handleNetstat(args[1]);
        break;
      case 'route':
        handleRoute(args[1]);
        break;
      case 'hostname':
        addOutput('output', 'DESKTOP-NETSIM\n');
        break;
      case 'getmac':
        handleGetmac();
        break;
      case 'cls':
      case 'clear':
        setOutput([]);
        break;
      case 'help':
      case '?':
        showHelp();
        break;
      case 'exit':
        addOutput('output', language === 'tr' ? 'PC terminali kapatılıyor...\n' : 'Closing PC terminal...\n');
        setTimeout(() => onClose(), 500);
        break;
      case 'echo':
        addOutput('output', cmd.slice(5) + '\n');
        break;
      case '':
        break;
      default:
        addOutput('error', language === 'tr' 
          ? `'${command}' iç veya dış komut, çalıştırılabilir program veya toplu iş dosyası olarak tanınmıyor.\n`
          : `'${command}' is not recognized as an internal or external command, operable program or batch file.\n`);
    }
    
    setCurrentCommand('');
  };
  
  const handlePing = (target: string) => {
    // Check if connected to a device
    if (!connectedDevice) {
      if (consoleDevice) {
        addOutput('error', `\n${t.pcPingError}\n` + `${t.errorPrefix}: ${t.pcConsoleTip}\n\n`);
      } else {
        addOutput('error', `\n${t.pcPingError}\n` + `${t.errorPrefix}: ${t.pcNotConnected}\n\n`);
      }
      return;
    }
    
    if (!cableInfo.connected) {
      addOutput('error', `\n${t.pcPingError}\n`);
      addOutput('error', `${t.errorPrefix}: ${t.pcCableError}\n\n`);
      return;
    }
    
    if (!isCompatible) {
      addOutput('error', language === 'tr' ? '\nHedef ana bilgisayara ulaşılamıyor.\n' : '\nDestination host unreachable.\n');
      addOutput('error', `${t.errorPrefix}: ${t.pcIncompatibleCable}\n\n`);
      return;
    }
    
    if (!target) {
      addOutput('output', language === 'tr' 
        ? 'Kullanım: ping [hedef]\nÖrnek: ping 192.168.1.1\n' 
        : 'Usage: ping [target]\nExample: ping 192.168.1.1\n');
      return;
    }
    
    // Check if target is a device in topology
    const targetIP = target;
    const targetDeviceInTopology = topologyDevices.find(d => d.ip === targetIP || d.name === targetIP);
    
    // Virtual targets (localhost, gateway, dns)
    const isLocal = targetIP === 'localhost' || targetIP === pcIP;
    const isGateway = targetIP === pcGateway && pcGateway !== '0.0.0.0';
    
    const canReach = isLocal || isGateway || !!targetDeviceInTopology;
    
    if (!canReach) {
      // Target is not directly connected - show timeout/unreachable
      addOutput('output', language === 'tr'
        ? `\n${targetIP} için 32 bayt veri ile Ping yapılıyor:\n`
        : `\nPinging ${targetIP} with 32 bytes of data:\n`);
      
      setTimeout(() => {
        addOutput('error', language === 'tr'
          ? 'Hedef ana bilgisayara ulaşılamıyor.\n\n'
          : 'Destination host unreachable.\n\n');
        addOutput('output', language === 'tr'
          ? 'İstek zaman aşımına uğradı.\n\n'
          : 'Request timed out.\n\n');
      }, 800);
      return;
    }
    
    // CCNA 1 Check: Subnet mask and Gateway
    const pcNet = pcIP.split('.').slice(0, 3).join('.');
    const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(targetIP);
    if (isIp && !isLocal) {
      const targetNet = targetIP.split('.').slice(0, 3).join('.');
      if (pcNet !== targetNet && (pcGateway === '0.0.0.0' || !pcGateway)) {
        addOutput('output', language === 'tr'
          ? `\n${targetIP} için 32 bayt veri ile Ping yapılıyor:\n`
          : `\nPinging ${targetIP} with 32 bytes of data:\n`);
        setTimeout(() => {
          addOutput('error', language === 'tr' ? 'İstek zaman aşımına uğradı. (Varsayılan ağ geçidi tanımlanmamış)\n' : 'Request timed out. (Default gateway not set)\n');
        }, 1000);
        return;
      }
    }
    
    const actualTarget = isLocal ? pcIP : (targetDeviceInTopology ? targetDeviceInTopology.ip : targetIP);
    const actualName = targetDeviceInTopology ? targetDeviceInTopology.name : targetIP;
    
    addOutput('output', language === 'tr'
      ? `\n${actualTarget} için 32 bayt veri ile Ping yapılıyor:\n`
      : `\nPinging ${actualTarget} with 32 bytes of data:\n`);
    
    // Simulate ping with real-looking output
    setTimeout(() => {
      const lines: string[] = [];
      for (let i = 0; i < 4; i++) {
        const time = Math.floor(Math.random() * 8) + 1;
        const ttl = 64 + Math.floor(Math.random() * 10);
        lines.push(language === 'tr'
          ? `${actualTarget}'den yanıt: bayt=32 süre=${time}ms TTL=${ttl}`
          : `Reply from ${actualTarget}: bytes=32 time=${time}ms TTL=${ttl}`);
      }
      addOutput('output', lines.join('\n') + '\n');
      
      addOutput('output', language === 'tr'
        ? `\n${actualTarget} için Ping istatistikleri:\n`
        : `\nPing statistics for ${actualTarget}:\n`);
      addOutput('output', language === 'tr'
        ? `    Paketler: Gönderilen = 4, Alınan = 4, Kayıp = 0 (0% kayıp),\n`
        : `    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\n`);
      addOutput('success', language === 'tr' ? 'Başarılı! Ağ bağlantısı çalışıyor.\n' : 'Success! Network connection is working.\n');
    }, 600);
  };
  
  const handleTelnet = (target: string) => {
    // Check if connected to a device
    if (!connectedDevice) {
      if (consoleDevice) {
        addOutput('error', `\n${t.pcTelnetError}\n` + `${t.errorPrefix}: ${t.pcConsoleTip}\n\n`);
      } else {
        addOutput('error', `\n${t.pcTelnetError}\n` + `${t.errorPrefix}: ${t.pcNotConnected}\n\n`);
      }
      return;
    }
    
    if (!cableInfo.connected) {
      addOutput('error', `\n${t.pcTelnetError} ${t.pcCableError}\n\n`);
      return;
    }
    
    if (!isCompatible) {
      addOutput('error', `\n${t.pcTelnetError} ${t.pcIncompatibleCable}\n\n`);
      return;
    }
    
    if (!target) {
      addOutput('output', language === 'tr' 
        ? `Kullanım: telnet [hedef]\nBağlı cihaz: ${connectedDevice.name} (${connectedDevice.ip})\nÖrnek: telnet ${connectedDevice.ip}\n` 
        : `Usage: telnet [target]\nConnected device: ${connectedDevice.name} (${connectedDevice.ip})\nExample: telnet ${connectedDevice.ip}\n`);
      return;
    }
    
    const targetIP = target;
    const targetDeviceInTopology = topologyDevices.find(d => d.ip === targetIP || d.name === targetIP);
    
    if (!targetDeviceInTopology || (targetDeviceInTopology.type !== 'switch' && targetDeviceInTopology.type !== 'router')) {
      addOutput('error', language === 'tr'
        ? `\nBağlantı isteği ${targetIP} tarafından reddedildi.\n\n`
        : `\nConnection refused by ${targetIP}.\n\n`);
      return;
    }
    
    const actualTarget = targetDeviceInTopology.ip;
    const targetId = targetDeviceInTopology.id;
    
    addOutput('output', `${actualTarget} bağlantı noktası 23...`);
    
    setTimeout(() => {
      addOutput('success', 'Bağlandı.\n');
      addOutput('output', `Kaçış karakteri: '^]'.\n\n`);
      
      // Get target device state for banner and login requirements
      const targetState = deviceStates?.get(targetId);
      if (targetState?.bannerMOTD) {
        addOutput('output', `${targetState.bannerMOTD}\n\n`);
      }
      
      const requiresLogin = targetState?.security.vtyLines.login;
      const requiresLocal = targetState?.security.vtyLines.loginLocal;
      
      // Set interactive mode
      setInteractiveState({
        active: true,
        type: 'telnet',
        step: requiresLogin ? (requiresLocal ? 'username' : 'password') : 'command',
        targetDevice: targetId
      });
      
      if (requiresLogin) {
        if (requiresLocal) {
          setCurrentPrompt('Username: ');
          addOutput('prompt', '', 'Username: ');
        } else {
          setCurrentPrompt('Password: ');
          addOutput('prompt', '', 'Password: ');
        }
      } else {
        const prompt = `${targetState?.hostname || targetDeviceInTopology.name}>`;
        setCurrentPrompt(prompt);
        addOutput('prompt', '', prompt);
      }
    }, 800);
  };

  const handleTerminal = () => {
    if (!consoleDevice) {
      addOutput('error', `\nTERMINAL: ${t.pcTelnetError}\n${t.errorPrefix}: ${t.pcCableError}\n\n`);
      return;
    }

    addOutput('output', language === 'tr' ? 'Konsol bağlantısı açılıyor...\n' : 'Opening console connection...\n');
    
    setTimeout(() => {
      addOutput('success', t.pcConnected + '\n');
      
      // Get target device state
      const targetState = deviceStates?.get(consoleDevice.id);
      if (targetState?.bannerMOTD) {
        addOutput('output', `\n${targetState.bannerMOTD}\n`);
      }
      
      setInteractiveState({
        active: true,
        type: 'telnet', 
        step: 'command', // Console usually goes straight to CLI
        targetDevice: consoleDevice.id
      });
      
      const prompt = `${targetState?.hostname || consoleDevice.name}>`;
      setCurrentPrompt(prompt);
      addOutput('output', `\nCisco IOS Software, ${targetState?.version.modelName || 'WS-C2960'}, Version 15.0(2)SE4, RELEASE SOFTWARE (fc1)\n\n`);
      addOutput('prompt', prompt);
    }, 800);
  };
  
  // Handle interactive input for telnet/ssh sessions
  const handleInteractiveInput = (input: string) => {
    if (!interactiveState.active) return;
    
    const { step, targetDevice } = interactiveState;
    
    // Echo the input
    addOutput('command', input, currentPrompt);
    
    if (step === 'username') {
      // Check if username is valid (accept any for simulator)
      if (input.trim()) {
        setInteractiveState(prev => ({ ...prev, step: 'password' }));
        setCurrentPrompt('Password: ');
        addOutput('prompt', '', 'Password: ');
      } else {
        addOutput('error', '% Username required\n');
        addOutput('prompt', '', 'Username: ');
      }
    } else if (step === 'password') {
      // Accept any password for simulator
      addOutput('output', '\n');
      addOutput('success', 'Login successful\n\n');
      setInteractiveState(prev => ({ ...prev, step: 'command' }));
      setCurrentPrompt(`${targetDevice}>`);
      addOutput('prompt', '', `${targetDevice}>`);
    } else if (step === 'command') {
      // Execute command on target device using the provided handler
      if (onExecuteDeviceCommand) {
        onExecuteDeviceCommand(targetDevice, input).then(result => {
          if (result.output) addOutput('output', result.output + '\n');
          if (result.error) addOutput('error', result.error + '\n');
          
          // Get updated state to refresh prompt
          const updatedState = deviceStates?.get(targetDevice);
          const newPrompt = updatedState ? getPrompt(updatedState) : currentPrompt;
          
          // Close session if command was 'exit' at top level
          const cmd = input.trim().toLowerCase();
          if ((cmd === 'exit' || cmd === 'quit' || cmd === 'logout') && updatedState?.currentMode === 'user') {
            addOutput('output', '\n[Connection closed by foreign host.]\n\n');
            setInteractiveState({ active: false, type: null, step: null, targetDevice: '' });
            setCurrentPrompt('C:\\>');
          } else {
            setCurrentPrompt(newPrompt);
            addOutput('prompt', '', newPrompt);
          }
        });
      } else {
        addOutput('error', 'Remote execution not supported.\n');
        addOutput('prompt', '', currentPrompt);
      }
    }
  };
  
  const handleIpconfig = () => {
    addOutput('output', language === 'tr' ? '\nWindows IP Yapılandırması\n\n' : '\nWindows IP Configuration\n\n');
    addOutput('output', language === 'tr' ? 'Ethernet adapter Ethernet:\n\n' : 'Ethernet adapter Ethernet:\n\n');
    if (language === 'tr') {
      addOutput('output', `   Bağlantıya özgü DNS Soneki  . :\n`);
      addOutput('output', `   IPv4 Adresi. . . . . . . . . . . : ${pcIP}\n`);
      addOutput('output', `   Alt Ağ Maskesi. . . . . . . . . . : ${pcSubnet}\n`);
      addOutput('output', `   Varsayılan Ağ Geçidi. . . . . . . : ${pcGateway}\n\n`);
    } else {
      addOutput('output', `   Connection-specific DNS Suffix  . :\n`);
      addOutput('output', `   IPv4 Address. . . . . . . . . . . : ${pcIP}\n`);
      addOutput('output', `   Subnet Mask . . . . . . . . . . . : ${pcSubnet}\n`);
      addOutput('output', `   Default Gateway . . . . . . . . . : ${pcGateway}\n\n`);
    }
  };
  
  const handleIpconfigAll = () => {
    addOutput('output', language === 'tr' ? '\nWindows IP Yapılandırması\n\n' : '\nWindows IP Configuration\n\n');
    if (language === 'tr') {
      addOutput('output', '   Ana bilgisayar adı. . . . . . . . . : DESKTOP-NETSIM\n');
      addOutput('output', '   Birincil DNS Soneki. . . . . . . . :\n');
      addOutput('output', '   Düğüm Türü. . . . . . . . . . . . . : Karma\n');
      addOutput('output', '   IP Yönlendirmesi Etkin. . . . . . . : Hayır\n');
      addOutput('output', '   WINS Proxy Etkin. . . . . . . . . . : Hayır\n\n');
      addOutput('output', 'Ethernet adapter Ethernet:\n\n');
      addOutput('output', '   Bağlantıya özgü DNS Soneki. . . :\n');
      addOutput('output', '   Açıklama . . . . . . . . . . . . . : Intel(R) PRO/1000 MT Network Connection\n');
      addOutput('output', '   Fiziksel Adres. . . . . . . . . . . : ' + pcMAC + '\n');
      addOutput('output', '   DHCP Etkin. . . . . . . . . . . . : Hayır\n');
      addOutput('output', '   Otomatik Yapılandırma Etkin . . . . : Evet\n');
      addOutput('output', `   IPv4 Adresi. . . . . . . . . . . . : ${pcIP}\n`);
      addOutput('output', `   Alt Ağ Maskesi. . . . . . . . . . . : ${pcSubnet}\n`);
      addOutput('output', `   Varsayılan Ağ Geçidi. . . . . . . . : ${pcGateway}\n`);
      addOutput('output', `   DNS Sunucuları. . . . . . . . . . . : ${pcDNS}\n\n`);
    } else {
      addOutput('output', '   Host Name . . . . . . . . . . . . . : DESKTOP-NETSIM\n');
      addOutput('output', '   Primary Dns Suffix  . . . . . . . . :\n');
      addOutput('output', '   Node Type . . . . . . . . . . . . . : Hybrid\n');
      addOutput('output', '   IP Routing Enabled. . . . . . . . . : No\n');
      addOutput('output', '   WINS Proxy Enabled. . . . . . . . . : No\n\n');
      addOutput('output', 'Ethernet adapter Ethernet:\n\n');
      addOutput('output', '   Connection-specific DNS Suffix  . . :\n');
      addOutput('output', '   Description . . . . . . . . . . . . : Intel(R) PRO/1000 MT Network Connection\n');
      addOutput('output', '   Physical Address. . . . . . . . . . : ' + pcMAC + '\n');
      addOutput('output', '   DHCP Enabled. . . . . . . . . . . . : No\n');
      addOutput('output', '   Autoconfiguration Enabled . . . . . : Yes\n');
      addOutput('output', `   IPv4 Address. . . . . . . . . . . . : ${pcIP}\n`);
      addOutput('output', `   Subnet Mask . . . . . . . . . . . . : ${pcSubnet}\n`);
      addOutput('output', `   Default Gateway . . . . . . . . . . : ${pcGateway}\n`);
      addOutput('output', `   DNS Servers . . . . . . . . . . . . : ${pcDNS}\n\n`);
    }
  };
  
  const handleArp = (flag: string) => {
    if (flag === '-a') {
      addOutput('output', language === 'tr'
        ? '\nArabirim: ' + pcIP + ' --- 0x3\n'
        : '\nInterface: ' + pcIP + ' --- 0x3\n');
      addOutput('output', language === 'tr'
        ? '  Internet Adresi      Fiziksel Adres      Tür\n'
        : '  Internet Address      Physical Address      Type\n');
      if (connectedDevice) {
        addOutput('output', '  ' + connectedDevice.ip + '            00-1A-2B-3C-4D-01     ' + (language === 'tr' ? 'Dinamik' : 'Dynamic') + '\n');
      }
      addOutput('output', '  192.168.1.255        ff-ff-ff-ff-ff-ff     ' + (language === 'tr' ? 'Statik' : 'Static') + '\n');
      addOutput('output', '  224.0.0.22           01-00-5e-00-00-16    ' + (language === 'tr' ? 'Statik' : 'Static') + '\n\n');
    } else {
      addOutput('output', language === 'tr' 
        ? 'Kullanım: arp -a\n' 
        : 'Usage: arp -a\n');
    }
  };
  
  const handleTracert = (target: string) => {
    if (!connectedDevice) {
      if (consoleDevice) {
        addOutput('error', language === 'tr'
          ? "\nTRACERT: Hedefe ulaşılamıyor.\nHATA: Konsol kablosu üzerinden izleme yapılamaz. Tracert IP üzerinden (Ethernet) çalışır.\n\n"
          : "\nTRACERT: Destination host unreachable.\nERROR: Cannot trace route over console. Tracert requires an IP link.\n\n");
      } else {
        addOutput('error', language === 'tr'
          ? "\nTRACERT: Hedefe ulaşılamıyor.\nHATA: Herhangi bir switch veya router'a bağlı değilsiniz.\n\n"
          : "\nTRACERT: Unable to reach target.\nERROR: You are not connected to any switch or router.\n\n");
      }
      return;
    }
    
    if (!cableInfo.connected || !isCompatible) {
      addOutput('error', language === 'tr'
        ? '\nTRACERT: Hedefe ulaşılamıyor. Bağlantı sorunu.\n\n'
        : '\nTRACERT: Unable to reach target. Connection issue.\n\n');
      return;
    }
    
    if (!target) {
      addOutput('output', language === 'tr' 
        ? 'Kullanım: tracert [hedef]\n' 
        : 'Usage: tracert [target]\n');
      return;
    }
    
    // Check if target is connected device
    if (target !== connectedDevice.ip && target !== connectedDevice.name) {
      addOutput('error', language === 'tr'
        ? `\nTRACERT: ${target} adresine ulaşılamıyor.\n`
        : `\nTRACERT: Cannot reach ${target}.\n`);
      addOutput('error', language === 'tr'
        ? `Sadece bağlı olduğunuz ${connectedDevice.name} (${connectedDevice.ip}) cihazına tracert yapabilirsiniz.\n\n`
        : `You can only tracert to the connected device ${connectedDevice.name} (${connectedDevice.ip}).\n\n`);
      return;
    }
    
    addOutput('output', language === 'tr'
      ? `\n${connectedDevice.ip} üzerindeki yolu izleme, en fazla 30 atlama:\n\n`
      : `\nTracing route to ${connectedDevice.ip} over a maximum of 30 hops:\n\n`);
    addOutput('output', '  1    1 ms    1 ms    1 ms  ' + connectedDevice.ip + '\n');
    addOutput('output', language === 'tr' ? '\nİzleme tamamlandı.\n' : '\nTrace complete.\n');
  };
  
  const handleNslookup = (domain: string) => {
    if (!connectedDevice) {
      if (consoleDevice) {
        addOutput('error', language === 'tr'
          ? '\nNSLOOKUP: DNS sunucusuyla iletişim kurulamadı.\nHATA: Konsol kablosu üzerinden ağ trafiği (DNS) iletilemez.\n\n'
          : '\nNSLOOKUP: Cannot communicate with DNS server.\nERROR: Network traffic (DNS) cannot be sent over console.\n\n');
      } else {
        addOutput('error', language === 'tr'
          ? '\nNSLOOKUP: DNS sunucusuyla iletişim kurulamadı.\n\n'
          : '\nNSLOOKUP: Cannot communicate with DNS server.\n\n');
      }
      return;
    }
    
    if (!cableInfo.connected || !isCompatible) {
      addOutput('error', language === 'tr'
        ? '\nDNS sunucusuyla iletişim kurulamadı.\n\n'
        : '\nCannot communicate with DNS server.\n\n');
      return;
    }
    
    const lookupDomain = domain || 'google.com';
    addOutput('output', language === 'tr' ? '\nSunucu:  dns.local\n' : '\nServer:  dns.local\n');
    addOutput('output', `Address:  ${pcGateway}\n\n`);
    addOutput('output', language === 'tr'
      ? '*** dns.local, ' + lookupDomain + ' bulamadı: Non-existent domain\n\n'
      : '*** dns.local can\'t find ' + lookupDomain + ': Non-existent domain\n\n');
  };
  
  const handleNetstat = (flag: string) => {
    addOutput('output', language === 'tr' ? '\nEtkin Bağlantılar\n\n' : '\nActive Connections\n\n');
    addOutput('output', language === 'tr'
      ? '  Protokol  Yerel Adres          Yabancı Adres        Durum\n'
      : '  Proto  Local Address          Foreign Address        State\n');
    const connectedIP = connectedDevice?.ip || 'N/A';
    addOutput('output', `  TCP    ${pcIP}:49670         ${connectedIP}:22           ESTABLISHED\n`);
    addOutput('output', `  TCP    ${pcIP}:49671         ${connectedIP}:23           ESTABLISHED\n`);
    addOutput('output', `  TCP    ${pcIP}:49672         151.101.1.69:443      ESTABLISHED\n`);
    addOutput('output', '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING\n\n');
  };
  
  const handleRoute = (flag: string) => {
    if (flag === 'print' || flag === '-p') {
      addOutput('output', language === 'tr' ? '\nIPv4 Yol Tablosu\n' : '\nIPv4 Route Table\n');
      addOutput('output', '===========================================================================\n');
      addOutput('output', language === 'tr' ? 'Etkin Yollar:\n' : 'Active Routes:\n');
      addOutput('output', language === 'tr'
        ? 'Ağ Hedefi        Ağ Maskesi         Ağ Geçidi   Arabirim   Ölçü\n'
        : 'Network Destination        Netmask          Gateway       Interface  Metric\n');
      addOutput('output', `          0.0.0.0          0.0.0.0      ${pcGateway}     ${pcIP}     10\n`);
      addOutput('output', `        ${pcIP.slice(0, pcIP.lastIndexOf('.'))}.0    255.255.255.0         On-link     ${pcIP}    266\n`);
      addOutput('output', `        ${pcIP}  255.255.255.255         On-link     ${pcIP}    266\n`);
      addOutput('output', '===========================================================================\n');
    } else {
      addOutput('output', language === 'tr' 
        ? 'Kullanım: route print\n' 
        : 'Usage: route print\n');
    }
  };
  
  const handleGetmac = () => {
    addOutput('output', language === 'tr' ? '\nFiziksel Adres    Taşıyıcı Adı\n' : '\nPhysical Address    Transport Name\n');
    addOutput('output', '================ ===============\n');
    addOutput('output', pcMAC + '   \\\\Device\\Tcpip_{12345678-90AB-CDEF}\n\n');
  };
  
  const showHelp = () => {
    if (language === 'tr') {
      addOutput('output', '\nKullanılabilir Komutlar:\n');
      addOutput('output', '─'.repeat(40) + '\n');
      addOutput('output', '  ping [ip]        - ICMP echo isteği gönder\n');
      addOutput('output', '  telnet [ip]      - Uzak cihaza bağlan\n');
      addOutput('output', '  terminal         - Konsol kablosuyla bağlı cihaza eriş\n');
      addOutput('output', '  ipconfig         - IP yapılandırmasını göster\n');
      addOutput('output', '  ipconfig /all    - Detaylı IP yapılandırması\n');
      addOutput('output', '  arp -a           - ARP tablosunu göster\n');
      addOutput('output', '  tracert [ip]     - Rotayı izle\n');
      addOutput('output', '  nslookup [dom]   - DNS sorgusu\n');
      addOutput('output', '  netstat          - Ağ istatistikleri\n');
      addOutput('output', '  route print      - Yönlendirme tablosu\n');
      addOutput('output', '  getmac           - MAC adresini göster\n');
      addOutput('output', '  hostname         - Bilgisayar adını göster\n');
      addOutput('output', '  cls              - Ekranı temizle\n');
      addOutput('output', '  help / ?         - Bu yardımı göster\n');
      addOutput('output', '  exit             - PC terminalini kapat\n\n');
    } else {
      addOutput('output', '\nAvailable Commands:\n');
      addOutput('output', '─'.repeat(40) + '\n');
      addOutput('output', '  ping [ip]        - Send ICMP echo request\n');
      addOutput('output', '  telnet [ip]      - Connect to remote device\n');
      addOutput('output', '  terminal         - Access connected device via console cable\n');
      addOutput('output', '  ipconfig         - Show IP configuration\n');
      addOutput('output', '  ipconfig /all    - Detailed IP configuration\n');
      addOutput('output', '  arp -a           - Show ARP table\n');
      addOutput('output', '  tracert [ip]     - Trace route\n');
      addOutput('output', '  nslookup [dom]   - DNS lookup\n');
      addOutput('output', '  netstat          - Network statistics\n');
      addOutput('output', '  route print      - Routing table\n');
      addOutput('output', '  getmac           - Show MAC address\n');
      addOutput('output', '  hostname         - Show computer name\n');
      addOutput('output', '  cls              - Clear screen\n');
      addOutput('output', '  help / ?         - Show this help\n');
      addOutput('output', '  exit             - Close PC terminal\n\n');
    }
  };

  // Handle suggestion button click
  const handleSuggestionClick = (suggestion: string) => {
    if (currentCommand.endsWith(' ')) {
      setCurrentCommand(currentCommand + suggestion + ' ');
    } else {
      const parts = currentCommand.split(' ');
      if (parts.length > 1) {
        // Replace last argument
        parts[parts.length - 1] = suggestion;
        setCurrentCommand(parts.join(' ') + ' ');
      } else {
        // Replace command
        setCurrentCommand(suggestion + ' ');
      }
    }
    inputRef.current?.focus();
  };

  // Handle history button click
  const handleHistoryClick = (cmd: string) => {
    setCurrentCommand(cmd);
    inputRef.current?.focus();
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(currentCommand);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // TAB ile ilk öneriyi tamamla
      const suggestions = getSmartSuggestions(currentCommand);
      if (suggestions.length > 0) {
        handleSuggestionClick(suggestions[0]);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setCurrentCommand('');
      }
    } else if (e.key === 'Escape') {
      if (showCompletionBar && !interactiveState.active) {
        setShowCompletionBar(false);
      } else {
        onClose();
      }
    }
  };
  
  if (!isVisible) return null;

  // Get current suggestions for display
  const currentSuggestions = getSmartSuggestions(currentCommand);
  const recentHistory = getRecentHistory();
  
  return (
    <div className={`flex flex-col h-full rounded-[2.5rem] border transition-all duration-500 overflow-hidden shadow-2xl ${
      isDark ? 'bg-slate-900/80 border-slate-800/50 shadow-blue-500/10' : 'bg-white/90 border-slate-200/50 shadow-blue-500/5'
    }`}>
      {/* Header */}
      <div className={`px-8 py-5 border-b flex items-center justify-between flex-shrink-0 ${
        isDark ? 'bg-slate-800/40 border-slate-800/50' : 'bg-slate-50 border-slate-200/50'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl shadow-inner ${isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
            <svg className="w-5 h-5 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {deviceId.toUpperCase()} - {activeTab === 'desktop' ? (language === 'tr' ? 'Masaüstü' : 'Desktop') : 
                activeTab === 'config' ? (language === 'tr' ? 'Yapılandırma' : 'Configuration') :
                (language === 'tr' ? 'Terminal' : 'Terminal')}
            </h3>
            <div className={`text-[10px] font-bold tracking-widest opacity-60 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {pcIP} • {pcMAC}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Tab Navigation */}
          <div className={`flex items-center p-1 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
            <button
              onClick={() => setActiveTab('desktop')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'desktop' 
                  ? 'bg-blue-500 text-white shadow-lg' 
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'tr' ? 'Masaüstü' : 'Desktop'}
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'config' 
                  ? 'bg-blue-500 text-white shadow-lg' 
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'tr' ? 'Yapılandırma' : 'Config'}
            </button>
            {consoleDevice && (
              <button
                onClick={() => setActiveTab('terminal')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'terminal' 
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Terminal
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-all duration-300 ${isDark ? 'hover:bg-slate-700/50 text-slate-500 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'desktop' && (
          <div className="h-full flex flex-col">
            {/* Desktop Icons - Visual only for now */}
            <div className="flex-1 p-8 grid grid-cols-4 sm:grid-cols-6 gap-8 content-start">
               <button 
                onClick={() => {
                  // If clicking "Command Prompt", it could stay in desktop or we focus it
                  // For now, let's assume the terminal view *is* the desktop content
                }}
                className="flex flex-col items-center gap-2 group"
               >
                 <div className={`p-4 rounded-2xl border transition-all duration-300 group-hover:scale-110 group-active:scale-95 ${
                   isDark ? 'bg-slate-800/50 border-slate-700 group-hover:border-blue-500/50' : 'bg-slate-50 border-slate-200 group-hover:border-blue-500/50'
                 }`}>
                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                 </div>
                 <span className={`text-[10px] font-bold text-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Command Prompt</span>
               </button>

               <button className="flex flex-col items-center gap-2 group opacity-50 cursor-not-allowed">
                 <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                 </div>
                 <span className={`text-[10px] font-bold text-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Web Browser</span>
               </button>

               <button className="flex flex-col items-center gap-2 group opacity-50 cursor-not-allowed">
                 <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                 </div>
                 <span className={`text-[10px] font-bold text-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>IP Config</span>
               </button>
            </div>

            {/* Terminal Window Overlay (Simulated) */}
            <div className="absolute inset-x-8 top-8 bottom-8 flex flex-col pointer-events-none">
              <div className="pointer-events-auto flex-1 flex flex-col">
                <div className={`flex-1 overflow-y-auto p-8 font-mono text-sm scroll-smooth custom-scrollbar border rounded-3xl shadow-xl ${
                  isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50/95 border-slate-200'
                }`}
                onClick={() => inputRef.current?.focus()}
                >
                  <div className="space-y-1.5">
                    {output.map((line) => (
                      <div key={line.id} className="group transition-all duration-300">
                        {line.type === 'command' && (
                          <div className="flex flex-wrap">
                            <span className="text-blue-500 font-bold whitespace-nowrap">{line.prompt}</span>
                            <span className={`${isDark ? 'text-white' : 'text-slate-900'} ml-1`}>{line.content}</span>
                          </div>
                        )}
                        {(line.type === 'output' || line.type === 'prompt') && (
                          <pre className={`${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-pre-wrap leading-relaxed`}>
                            {line.prompt && <span className="text-blue-500 font-bold">{line.prompt}</span>}
                            {line.content}
                          </pre>
                        )}
                        {line.type === 'error' && (
                          <pre className="text-rose-500 whitespace-pre-wrap font-bold bg-rose-500/5 px-2 py-1 rounded-lg border border-rose-500/10 mb-1">{line.content}</pre>
                        )}
                        {line.type === 'success' && (
                          <pre className="text-emerald-500 whitespace-pre-wrap font-medium">{line.content}</pre>
                        )}
                      </div>
                    ))}
                    
                    {/* PC Prompt Line */}
                    {!interactiveState.active && (
                      <div className="flex items-center min-h-[40px] group mt-2">
                        <span className="text-blue-500 font-bold flex-shrink-0 mr-1.5">{currentPrompt}</span>
                        <div className="relative flex-1">
                          {currentSuggestions.length > 0 && currentCommand && (
                            <div className="absolute inset-0 flex items-center pointer-events-none font-mono text-sm overflow-hidden">
                              <span className="text-transparent">{currentCommand}</span>
                              <span className={`${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
                                {currentSuggestions[0].startsWith(currentCommand.split(' ').pop() || '') 
                                  ? currentSuggestions[0].slice(currentCommand.split(' ').pop()?.length || 0)
                                  : ''}
                              </span>
                            </div>
                          )}
                          <input
                            ref={inputRef}
                            type="text"
                            value={currentCommand}
                            onChange={(e) => setCurrentCommand(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className={`bg-transparent ${isDark ? 'text-white' : 'text-slate-900'} outline-none w-full font-mono py-2 text-sm caret-blue-500`}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    )}

                    {interactiveState.active && (
                       <div className="flex items-center min-h-[40px] group mt-2">
                         <span className="text-blue-500 font-bold flex-shrink-0 mr-1.5">{currentPrompt}</span>
                         <input
                            ref={inputRef}
                            type={interactiveState.step === 'password' ? 'password' : 'text'}
                            value={currentCommand}
                            onChange={(e) => setCurrentCommand(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className={`bg-transparent ${isDark ? 'text-white' : 'text-slate-900'} outline-none w-full font-mono py-2 text-sm caret-blue-500`}
                            autoComplete="off"
                            spellCheck={false}
                          />
                       </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="h-full p-12 overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-12">
              <div className="space-y-6">
                 <h4 className={`text-xs font-black tracking-widest uppercase opacity-40 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {language === 'tr' ? 'IP YAPILANDIRMASI' : 'IP CONFIGURATION'}
                 </h4>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className={`text-[10px] font-bold ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>IP Address</label>
                      <input 
                        readOnly 
                        value={pcIP} 
                        className={`w-full px-5 py-3.5 rounded-2xl border font-mono text-sm ${
                          isDark ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-[10px] font-bold ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Subnet Mask</label>
                      <input 
                        readOnly 
                        value={pcSubnet} 
                        className={`w-full px-5 py-3.5 rounded-2xl border font-mono text-sm ${
                          isDark ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-[10px] font-bold ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Default Gateway</label>
                      <input 
                        readOnly 
                        value={pcGateway} 
                        className={`w-full px-5 py-3.5 rounded-2xl border font-mono text-sm ${
                          isDark ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-[10px] font-bold ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>DNS Server</label>
                      <input 
                        readOnly 
                        value={pcDNS} 
                        className={`w-full px-5 py-3.5 rounded-2xl border font-mono text-sm ${
                          isDark ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`} 
                      />
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <h4 className={`text-xs font-black tracking-widest uppercase opacity-40 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {language === 'tr' ? 'FİZİKSEL' : 'PHYSICAL'}
                 </h4>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className={`text-[10px] font-bold ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>MAC Address</label>
                      <input 
                        readOnly 
                        value={pcMAC} 
                        className={`w-full px-5 py-3.5 rounded-2xl border font-mono text-sm ${
                          isDark ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-[10px] font-bold ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Port</label>
                      <div className={`px-5 py-3.5 rounded-2xl border flex items-center gap-3 ${
                        isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${cableInfo.connected ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                        <span className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Ethernet0</span>
                      </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="h-full flex items-center justify-center p-8">
            <div className={`w-full max-w-md p-10 rounded-[2.5rem] border shadow-2xl ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-col items-center gap-6 mb-10">
                <div className="p-5 rounded-[2rem] bg-blue-500/10 border border-blue-500/20">
                  <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {language === 'tr' ? 'Terminal Ayarları' : 'Terminal Configuration'}
                  </h3>
                  <p className={`text-xs mt-2 font-medium opacity-60 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {language === 'tr' ? 'Konsol bağlantısı parametrelerini ayarlayın' : 'Set your console connection parameters'}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between group">
                  <label className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Bits per second (Baud)
                  </label>
                  <select 
                    value={terminalSettings.bitsPerSecond}
                    onChange={(e) => setTerminalSettings({...terminalSettings, bitsPerSecond: e.target.value})}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold ${
                      isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <option>9600</option>
                    <option>19200</option>
                    <option>38400</option>
                    <option>57600</option>
                    <option>115200</option>
                  </select>
                </div>

                <div className="flex items-center justify-between group">
                  <label className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Data bits
                  </label>
                  <select 
                    value={terminalSettings.dataBits}
                    onChange={(e) => setTerminalSettings({...terminalSettings, dataBits: e.target.value})}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold ${
                      isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <option>5</option>
                    <option>6</option>
                    <option>7</option>
                    <option>8</option>
                  </select>
                </div>

                <div className="flex items-center justify-between group">
                  <label className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Parity
                  </label>
                  <select 
                    value={terminalSettings.parity}
                    onChange={(e) => setTerminalSettings({...terminalSettings, parity: e.target.value})}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold ${
                      isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <option>None</option>
                    <option>Even</option>
                    <option>Odd</option>
                    <option>Mark</option>
                    <option>Space</option>
                  </select>
                </div>

                <div className="flex items-center justify-between group">
                  <label className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Stop bits
                  </label>
                  <select 
                    value={terminalSettings.stopBits}
                    onChange={(e) => setTerminalSettings({...terminalSettings, stopBits: e.target.value})}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold ${
                      isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <option>1</option>
                    <option>1.5</option>
                    <option>2</option>
                  </select>
                </div>

                <div className="flex items-center justify-between group pb-4">
                  <label className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Flow control
                  </label>
                  <select 
                    value={terminalSettings.flowControl}
                    onChange={(e) => setTerminalSettings({...terminalSettings, flowControl: e.target.value})}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold ${
                      isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <option>None</option>
                    <option>Xon/Xoff</option>
                    <option>Hardware</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-700/50 mt-8 flex flex-col gap-3">
                <button
                  onClick={() => {
                    handleTerminal();
                    setActiveTab('desktop');
                  }}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-500 shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all"
                >
                  {language === 'tr' ? 'Bağlan' : 'Connect'}
                </button>
                <div className="flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest opacity-40 uppercase">
                   <div className={`w-1.5 h-1.5 rounded-full ${consoleDevice ? 'bg-emerald-500' : 'bg-red-500'}`} />
                   {consoleDevice ? (language === 'tr' ? 'Console Kablosu Hazır' : 'Console Cable Ready') : (language === 'tr' ? 'Kablo Yok' : 'No Cable')}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* PC Completion Bar (Only for Desktop/Terminal mode) */}
      {activeTab === 'desktop' && showCompletionBar && !interactiveState.active && (
        <div className={`border-t px-4 py-3 transition-all duration-500 ${isDark ? 'bg-slate-900/60 border-slate-800/50' : 'bg-slate-50/80 border-slate-200/50'}`}>
          {/* Suggestions Row */}
          {currentSuggestions.length > 0 && (
            <div className="mb-3">
              <div className={`text-[10px] font-black tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {language === 'tr' ? 'Komut Önerileri' : 'Command Suggestions'}
              </div>
              <div className="flex flex-wrap gap-2">
                {currentSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-all duration-300 border ${
                      isDark 
                        ? 'bg-slate-800/80 border-slate-700/50 text-blue-400 hover:bg-slate-700 hover:border-blue-500/30 hover:scale-105 active:scale-95' 
                        : 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50 hover:border-blue-500/30 hover:scale-105 active:scale-95 shadow-sm'
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* History Row */}
          {recentHistory.length > 0 && (
            <div>
              <div className={`text-[10px] font-black tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {language === 'tr' ? 'Geçmiş' : 'Recent History'}
              </div>
              <div className="flex flex-wrap gap-2">
                {recentHistory.map((cmd, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleHistoryClick(cmd)}
                    className={`px-3 py-1.5 rounded-xl font-mono text-[10px] transition-all duration-300 border ${
                      isDark 
                        ? 'bg-slate-900/50 border-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 hover:scale-105 active:scale-95' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:scale-105 active:scale-95 shadow-sm'
                    }`}
                  >
                    {cmd.length > 24 ? cmd.substring(0, 24) + '...' : cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowCompletionBar(false)}
            className={`mt-4 w-full py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-colors ${
              isDark ? 'bg-slate-800/50 text-slate-600 hover:text-slate-400' : 'bg-slate-200/50 text-slate-400 hover:text-slate-600'
            }`}
          >
            {language === 'tr' ? 'Paneli Gizle' : 'Hide Panel'}
          </button>
        </div>
      )}
      
      {/* Show button when hidden */}
      {activeTab === 'desktop' && !showCompletionBar && (
        <button
          onClick={() => setShowCompletionBar(true)}
          className={`w-full border-t px-4 py-2 text-[10px] font-bold tracking-widest flex items-center justify-center gap-2 transition-all ${
            isDark 
              ? 'bg-slate-900 border-slate-800 text-slate-600 hover:text-blue-500 hover:bg-slate-800/50' 
              : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-white'
          }`}
        >
          <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          {language === 'tr' ? 'Yardımcı Paneli Göster' : 'Show Helper Panel'}
        </button>
      )}
    </div>
  );
}

// Helper for prompt (copy from executor)
function getPrompt(state: SwitchState): string {
  const { currentMode, hostname } = state;
  switch (currentMode) {
    case 'user': return `${hostname}>`;
    case 'privileged': return `${hostname}#`;
    case 'config': return `${hostname}(config)#`;
    case 'interface': return `${hostname}(config-if)#`;
    case 'line': return `${hostname}(config-line)#`;
    case 'vlan': return `${hostname}(config-vlan)#`;
    default: return `${hostname}>`;
  }
}
