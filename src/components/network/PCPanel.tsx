'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CableInfo, isCableCompatible, SwitchState } from '@/lib/network/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { TerminalOutput } from './Terminal';
import { checkConnectivity } from '@/lib/network/connectivity';
import { Button } from '@/components/ui/button';
import { Laptop, Monitor, Terminal as TerminalIcon, X, CornerDownLeft, Command, Globe, Network, ShieldCheck, History } from 'lucide-react';

interface OutputLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'success' | 'prompt';
  content: string;
  prompt?: string;
}

interface PCPanelProps {
  deviceId: string;
  cableInfo: CableInfo;
  isVisible: boolean;
  onClose: () => void;
  topologyDevices?: { id: string; type: string; name: string; ip: string; subnet?: string; gateway?: string; dns?: string; macAddress?: string; ports: { id: string; status: string }[] }[];
  topologyConnections?: { 
    sourceDeviceId: string; 
    sourcePort: string; 
    targetDeviceId: string; 
    targetPort: string; 
    cableType?: string;
    active?: boolean 
  }[];
  deviceStates?: Map<string, SwitchState>;
  deviceOutputs?: Map<string, TerminalOutput[]>;
  onExecuteDeviceCommand?: (deviceId: string, command: string) => Promise<any>;
}

type PCActiveTab = 'desktop' | 'terminal';

// Advanced Command Help Tree for Network
const networkHelp: Record<string, Record<string, string[]>> = {
  user: {
    '': ['enable', 'exit', 'show', 'ping', 'telnet', 'ssh'],
    'sh': ['version', 'ip', 'interfaces', 'vlan'],
    'show ip': ['interface', 'route', 'arp'],
    'show ip interface': ['brief'],
  },
  privileged: {
    '': ['configure', 'disable', 'show', 'write', 'ping', 'telnet', 'reload', 'exit', 'copy', 'erase'],
    'sh': ['running-config', 'startup-config', 'interfaces', 'vlan', 'version', 'mac', 'ip'],
    'show ip': ['interface', 'route', 'arp', 'dhcp'],
    'show ip interface': ['brief'],
    'conf': ['terminal'],
    'copy': ['running-config', 'startup-config'],
    'write': ['memory'],
  },
  config: {
    '': ['hostname', 'interface', 'vlan', 'enable', 'line', 'banner', 'ip', 'no', 'exit', 'end', 'do'],
    'int': ['FastEthernet0/', 'GigabitEthernet0/', 'Vlan'],
    'line': ['console 0', 'vty 0 4'],
    'banner': ['motd'],
    'ip': ['address', 'default-gateway', 'domain-name', 'route'],
    'no': ['shutdown', 'ip', 'vlan'],
  }
};

export function PCPanel({ 
  deviceId, 
  cableInfo, 
  isVisible, 
  onClose, 
  topologyDevices = [], 
  topologyConnections = [],
  deviceStates,
  deviceOutputs,
  onExecuteDeviceCommand
}: PCPanelProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const terminalBg = isDark ? 'bg-black shadow-inner' : 'bg-slate-50 shadow-inner border border-slate-200';
  const textColor = isDark ? 'text-slate-400' : 'text-slate-600';
  const cmdColor = isDark ? 'text-slate-100' : 'text-slate-900';
  const inputBg = isDark ? 'bg-black/50' : 'bg-white';
  const inputBorder = isDark ? 'border-slate-800' : 'border-slate-300';
  
  const [activeTab, setActiveTab] = useState<PCActiveTab>('desktop');
  const [input, setInput] = useState('');
  
  // History State
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Get device from topology
  const deviceFromTopology = topologyDevices.find(d => d.id === deviceId);
  const defaultConfig = getPCConfigDefaults(deviceId);
  
  const [pcIP, setPcIP] = useState(deviceFromTopology?.ip || defaultConfig.ip);
  const [pcHostname, setPcHostname] = useState(deviceFromTopology?.name || deviceId);
  const pcMAC = deviceFromTopology?.macAddress || defaultConfig.mac;

  // Local output for Desktop (Local)
  const [pcOutput, setPcOutput] = useState<OutputLine[]>(() => [
    {
      id: '1',
      type: 'output',
      content: 'OS Windows [Version 10.0.19045.4412]\n(c) OS Corporation. All rights reserved.\n'
    }
  ]);
  
  // Tab cycle state
  const [tabCycleIndex, setTabCycleIndex] = useState(-1);
  const [lastTabInput, setLastTabInput] = useState('');

  // Console connection state
  const [isConsoleConnected, setIsConsoleConnected] = useState(false);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find connected console device
  const getConsoleDevice = useCallback(() => {
    if (!topologyConnections || !deviceId) return null;
    const connection = topologyConnections.find(conn => {
      // Must be an active console cable
      if (conn.cableType !== 'console' || conn.active === false) return false;
      
      const isSource = conn.sourceDeviceId === deviceId;
      const isTarget = conn.targetDeviceId === deviceId;
      
      // Port name checks (case insensitive)
      if (isSource) {
        const port = conn.sourcePort.toLowerCase();
        return port.startsWith('com') || port === 'console' || port === 'rs232';
      }
      if (isTarget) {
        const port = conn.targetPort.toLowerCase();
        return port.startsWith('com') || port === 'console' || port === 'rs232';
      }
      return false;
    });
    if (!connection) return null;
    const otherId = connection.sourceDeviceId === deviceId ? connection.targetDeviceId : connection.sourceDeviceId;
    return topologyDevices.find(d => d.id === otherId && (d.type === 'switch' || d.type === 'router')) || null;
  }, [deviceId, topologyConnections, topologyDevices]);

  const consoleDevice = getConsoleDevice();

  // Synchronized Console Output from Global State
  const activeConsoleOutput = useMemo(() => {
    if (!isConsoleConnected || !connectedDeviceId || !deviceOutputs) return [];
    return deviceOutputs.get(connectedDeviceId) || [];
  }, [isConsoleConnected, connectedDeviceId, deviceOutputs]);

  const addLocalOutput = useCallback((type: OutputLine['type'], content: string, prompt?: string) => {
    const newLine: OutputLine = { id: Math.random().toString(36).substr(2, 9), type, content, prompt };
    setPcOutput(prev => [...prev, newLine]);
    
    setTimeout(() => {
      if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }, 0);
  }, []);

  const handleConnect = () => {
    if (!consoleDevice) return;
    
    setIsConsoleConnected(true);
    setConnectedDeviceId(consoleDevice.id);
    
    if (onExecuteDeviceCommand) {
      onExecuteDeviceCommand(consoleDevice.id, '').then(() => {});
    }
  };

  const executeCommand = async (cmdToExecute?: string) => {
    const command = (cmdToExecute || input).trim();
    if (!command) return;

    // Add to history
    setHistory(prev => {
      if (prev[0] === command) return prev;
      return [command, ...prev].slice(0, 50);
    });
    setHistoryIndex(-1);
    setInput('');

    if (activeTab === 'desktop') {
      addLocalOutput('command', command);
      
      const parts = command.split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (cmd === 'ipconfig') {
        if (args.includes('/release')) {
          setPcIP('0.0.0.0');
          addLocalOutput('success', 'IP address released successfully.');
        } else if (args.includes('/renew')) {
          const restoredIP = deviceFromTopology?.ip || defaultConfig.ip;
          setPcIP(restoredIP);
          addLocalOutput('success', `IP address renewed successfully. New IP: ${restoredIP}`);
        } else if (args.includes('/all')) {
          addLocalOutput('output', `OS IP Configuration\n\n   Host Name . . . . . . . . . . . . : ${pcHostname}\n   Primary Dns Suffix  . . . . . . . : \n   Node Type . . . . . . . . . . . . : Hybrid\n   IP Routing Enabled. . . . . . . . : No\n   WINS Proxy Enabled. . . . . . . . : No\n\nEthernet adapter Ethernet0:\n   Connection-specific DNS Suffix  . : \n   Description . . . . . . . . . . . : Generic Gigabit Network Connection\n   Physical Address. . . . . . . . . : ${pcMAC}\n   DHCP Enabled. . . . . . . . . . . : No\n   Autoconfiguration Enabled . . . . : Yes\n   IPv4 Address. . . . . . . . . . . : ${pcIP}(Preferred)\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.1.1\n   DNS Servers . . . . . . . . . . . : 8.8.8.8`);
        } else {
          addLocalOutput('output', `OS IP Configuration\n\nEthernet adapter Ethernet0:\n   Connection-specific DNS Suffix  . : \n   Link-local IPv6 Address . . . . . : fe80::a1b2:c3d4:e5f6%12\n   IPv4 Address. . . . . . . . . . . : ${pcIP}\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.1.1`);
        }
      } else if (cmd === 'ipv6config') {
        addLocalOutput('output', `OS IPv6 Configuration\n\nEthernet adapter Ethernet0:\n   IPv6 Address. . . . . . . . . . . : 2001:db8:acad:1::10\n   Link-local IPv6 Address . . . . . : fe80::a1b2:c3d4:e5f6%12\n   Default Gateway . . . . . . . . . : fe80::1`);
      } else if (cmd === 'ping') {
        const target = args[0];
        if (!target) {
          addLocalOutput('output', 'Usage: ping <target_name_or_address>');
        } else if (pcIP === '0.0.0.0') {
          addLocalOutput('error', 'Ping transmit failed. General failure.');
        } else {
          const result = checkConnectivity(deviceId, target, topologyDevices as any, topologyConnections as any, deviceStates);
          if (result.success) {
            addLocalOutput('output', `Pinging ${target} with 32 bytes of data:\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\nReply from ${target}: bytes=32 time<1ms TTL=128\n\nPing statistics for ${target}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = 0ms, Maximum = 0ms, Average = 0ms`);
          } else {
            addLocalOutput('output', `Pinging ${target} with 32 bytes of data:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\n\nPing statistics for ${target}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)`);
          }
        }
      } else if (cmd === 'tracert') {
        const target = args[0];
        if (!target) {
          addLocalOutput('output', 'Usage: tracert <target_name_or_address>');
        } else if (pcIP === '0.0.0.0') {
          addLocalOutput('error', 'Unable to resolve target system name.');
        } else {
          const result = checkConnectivity(deviceId, target, topologyDevices as any, topologyConnections as any, deviceStates);
          if (result.success) {
            let output = `Tracing route to ${target} over a maximum of 30 hops:\n\n`;
            result.hops.forEach((hop, index) => {
              output += `  ${index + 1}    <1 ms    <1 ms    <1 ms  ${hop}\n`;
            });
            output += `\nTrace complete.`;
            addLocalOutput('output', output);
          } else {
            addLocalOutput('output', `Tracing route to ${target} over a maximum of 30 hops:\n\n  1    *        *        *     Request timed out.\n\nTrace complete.`);
          }
        }
      } else if (cmd === 'nslookup') {
        const target = args[0] || 'example.com';
        addLocalOutput('output', `Server:  public-dns.example.com\nAddress:  8.8.8.8\n\nNon-authoritative answer:\nName:    ${target}\nAddresses:  93.184.216.34`);
      } else if (cmd === 'arp') {
        if (args[0] === '-a' || !args[0]) {
          addLocalOutput('output', `Interface: ${pcIP} --- 0x2\n  Internet Address      Physical Address      Type\n  192.168.1.1           00-15-2b-e4-9b-60     dynamic\n  192.168.1.255         ff-ff-ff-ff-ff-ff     static`);
        } else {
          addLocalOutput('output', 'Usage: arp -a');
        }
      } else if (cmd === 'netstat') {
        addLocalOutput('output', `Active Connections\n\n  Proto  Local Address          Foreign Address        State\n  TCP    ${pcIP}:49674        142.250.185.78:443     ESTABLISHED\n  TCP    ${pcIP}:49675        172.217.17.142:443     ESTABLISHED`);
      } else if (cmd === 'netsh') {
        addLocalOutput('output', 'netsh> usage: interface, wlan, firewalls, routing, etc.\nFor simulation purposes, netsh is in interactive mode.');
      } else if (cmd === 'dir') {
        addLocalOutput('output', ` Volume in drive C has no label.\n Volume Serial Number is 4C32-8B1F\n\n Directory of C:\\\n\n26/02/2026  22:00    <DIR>          Users\n26/02/2026  22:00    <DIR>          Program Files\n26/02/2026  22:00    <DIR>          System\n26/02/2026  22:05               124 notes.txt\n               1 File(s)            124 bytes\n               3 Dir(s)  45,234,122,752 bytes free`);
      } else if (cmd === 'cd') {
        addLocalOutput('output', `C:\\${args[0] || ''}`);
      } else if (cmd === 'mkdir') {
        addLocalOutput('success', `Directory '${args[0] || 'new_folder'}' created.`);
      } else if (cmd === 'rmdir') {
        addLocalOutput('success', `Directory '${args[0] || 'folder'}' removed.`);
      } else if (cmd === 'delete') {
        addLocalOutput('success', `File '${args[0] || 'file'}' deleted.`);
      } else if (cmd === 'ftp') {
        addLocalOutput('output', `Connected to ${args[0] || 'server'}.\n220 OS FTP Service\nUser (anonymous):`);
      } else if (cmd === 'ssh') {
        addLocalOutput('output', `OpenSSH_9.2p1, OpenSSL 3.0.8\nusage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address]...`);
      } else if (cmd === 'telnet') {
        addLocalOutput('output', `Connecting To ${args[0] || 'host'}...Could not open connection to the host, on port 23: Connect failed`);
      } else if (cmd === 'python') {
        addLocalOutput('output', 'Python 3.11.2 (main, Feb 12 2026, 11:00:00)\n[MSC v.1934 64 bit (AMD64)] on win32\nType "help", "copyright", "credits" or "license" for more information.\n>>> ');
      } else if (cmd === 'js') {
        addLocalOutput('output', 'Node.js v18.16.0 Interactive Interpreter\n> ');
      } else if (cmd === 'ide') {
        addLocalOutput('output', 'Starting Network IOx Development Environment...');
      } else if (cmd === 'ioxclient') {
        addLocalOutput('output', 'Network IOx Client v1.15.0.0\nUsage: ioxclient [options] command [command options] [arguments...]');
      } else if (cmd === 'snmpget' || cmd === 'snmpset' || cmd === 'snmpgetbulk') {
        addLocalOutput('output', `${cmd.toUpperCase()}: usage: ${cmd} [common options] [-protocol specific options] agent [OID [OID]...]`);
      } else if (cmd === 'hostname') {
        if (args[0]) {
          let name = args[0];
          if ((name.startsWith('"') && name.endsWith('"')) || 
              (name.startsWith("'") && name.endsWith("'"))) {
            name = name.substring(1, name.length - 1);
          }
          setPcHostname(name);
          addLocalOutput('success', `Hostname changed to ${name}`);
        } else {
          addLocalOutput('output', pcHostname);
        }
      } else if (cmd === 'ver') {
        addLocalOutput('output', 'OS Windows [Version 10.0.19045.4412]');
      } else if (cmd === 'help' || cmd === '?') {
        addLocalOutput('output', `?            Display the list of available commands
  arp          Display the arp table
  cd           Displays the name of or changes the current directory.
  delete       Deletes the specified file from C: directory.
  dir          Displays the list of files  in C: directory.
  exit         Quits the CMD.EXE program (command interpreter)
  ftp          Transfers files to and from a computer running an FTP server.
  help         Display the list of available commands
  ide          Starts IoX development environment
  ioxclient    Command line tool to assist in app development for Network IOx
               platforms
  ipconfig     Display network configuration for each network adapter
  ipv6config   Display network configuration for each network adapter
  js           JavaScript Interactive Interpreter
  mkdir        Creates a directory.
  netsh        
  netstat      Displays protocol statistics and current TCP/IP network
               connections
  nslookup     DNS Lookup
  ping         Send echo messages
  python       Python Interactive Interpreter
  quit         Exit Telnet/SSH
  rmdir        Removes a directory.
  snmpget      SNMP GET
  snmpgetbulk  SNMP GET BULK
  snmpset      SNMP SET
  ssh          ssh client
  telnet       Telnet client
  tracert      Trace route to destination`);
      } else if (cmd === 'cls') {
        setPcOutput([]);
      } else if (cmd === 'exit' || cmd === 'quit') {
        onClose();
      } else {
        addLocalOutput('error', `'${command}' is not recognized as an internal or external command, operable program or batch file.`);
      }
    } else {
      if (!isConsoleConnected) return;
      if (onExecuteDeviceCommand && connectedDeviceId) {
        try {
          await onExecuteDeviceCommand(connectedDeviceId, command);
        } catch (err) {}
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
        setTabCycleIndex(-1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
        setTabCycleIndex(-1);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
        setTabCycleIndex(-1);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabComplete(e.currentTarget);
    } else {
      setTabCycleIndex(-1);
    }
  };

  const handleTabComplete = (inputEl: HTMLInputElement) => {
    const value = inputEl.value;
    if (!value && tabCycleIndex === -1) return;

    if (activeTab === 'desktop') {
      const pcCmds = ['ipconfig', 'ipv6config', 'ping', 'tracert', 'nslookup', 'arp', 'netstat', 'hostname', 'dir', 'ver', 'help', 'cls', 'exit', 'quit', 'mkdir', 'rmdir', 'delete', 'ftp', 'ssh', 'telnet', 'python', 'js', 'ide', 'ioxclient'];
      const matches = pcCmds.filter(c => c.startsWith(value.toLowerCase()));
      if (matches.length > 0) {
        if (tabCycleIndex === -1) {
          setLastTabInput(value);
          setTabCycleIndex(0);
          setInput(matches[0]);
        } else {
          const nextIndex = (tabCycleIndex + 1) % matches.length;
          setTabCycleIndex(nextIndex);
          setInput(matches[nextIndex]);
        }
      }
    } else if (isConsoleConnected && connectedDeviceId && deviceStates) {
      const state = deviceStates.get(connectedDeviceId);
      if (!state) return;

      const mode = state.currentMode;
      const helpTree = networkHelp[mode] || networkHelp.user;
      
      const parts = value.split(/\s+/);
      const hasTrailingSpace = value.endsWith(' ');
      
      const currentWord = hasTrailingSpace ? '' : parts[parts.length - 1].toLowerCase();
      const previousContext = hasTrailingSpace ? value.trim() : parts.slice(0, -1).join(' ');
      const contextKey = previousContext.toLowerCase();
      
      let options: string[] = [];
      if (!previousContext) {
        options = helpTree[''];
      } else {
        options = helpTree[contextKey] || [];
      }

      const matches = options.filter(opt => opt.toLowerCase().startsWith(currentWord));
      
      if (matches.length > 0) {
        if (tabCycleIndex === -1) {
          setLastTabInput(value);
          const nextIndex = 0;
          setTabCycleIndex(nextIndex);
          const completion = matches[nextIndex];
          setInput(previousContext ? `${previousContext} ${completion}` : completion);
        } else {
          const nextIndex = (tabCycleIndex + 1) % matches.length;
          setTabCycleIndex(nextIndex);
          const originalParts = lastTabInput.split(/\s+/);
          const originalContext = lastTabInput.endsWith(' ') ? lastTabInput.trim() : originalParts.slice(0, -1).join(' ');
          const completion = matches[nextIndex];
          setInput(originalContext ? `${originalContext} ${completion}` : completion);
        }
      }
    }
  };

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [pcOutput, activeConsoleOutput, activeTab]);

  if (!isVisible) return null;

  // Last 10 unique commands for mobile
  const recentCommands = history.slice(0, 10);

  return (
    <div className={`w-full h-full flex flex-col flex-1 overflow-hidden h-full min-h-0`}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full h-full flex flex-col flex-1 rounded-2xl overflow-hidden border ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        } shadow-2xl min-h-0`}
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${isDark ? 'border-slate-800 bg-slate-800/20' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight leading-none uppercase">{pcHostname}</h2>
              <p className="text-[10px] font-bold text-slate-500 mt-1.5 uppercase tracking-widest">{pcIP} • {pcMAC}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-all"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className={`px-4 py-1.5 flex items-center gap-1 border-b ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <Button 
            variant={activeTab === 'desktop' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('desktop')}
            className={`h-9 px-4 text-xs font-black tracking-wider uppercase transition-all gap-2 ${
              activeTab === 'desktop' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Desktop
          </Button>
          <Button 
            variant={activeTab === 'terminal' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('terminal')}
            className={`h-9 px-4 text-xs font-black tracking-wider uppercase transition-all gap-2 ${
              activeTab === 'terminal' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            Console
          </Button>
        </div>

        {/* Content Area */}
        <div className={`flex-1 flex flex-col overflow-hidden ${terminalBg} relative min-h-0`}>
          {activeTab === 'terminal' && !isConsoleConnected && (
            <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center ${isDark ? 'bg-black/90' : 'bg-white/90'} backdrop-blur-md gap-4 p-4 text-center animate-in fade-in duration-500 overflow-y-auto`}>
              <div className={`p-6 md:p-8 rounded-3xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl'} border max-w-sm w-full border-t-4 border-t-blue-500 my-auto`}>
                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} flex items-center justify-center mx-auto mb-4 md:mb-6 border shadow-inner group`}>
                  <Monitor className="w-8 h-8 md:w-10 md:h-10 text-blue-500 transition-transform group-hover:scale-110" />
                </div>
                <h3 className={`text-base md:text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'} mb-1 md:mb-2 uppercase tracking-tight`}>Console Terminal</h3>
                <p className={`text-[10px] md:text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'} mb-4 md:mb-8 leading-relaxed px-2 md:px-4`}>
                  {consoleDevice 
                    ? `${t.physicalConnectionDetected} ${consoleDevice.name}. Port: 9600-8-N-1`
                    : t.noConsoleCableDetected}
                </p>
                <div className="flex flex-col gap-3 md:gap-4">
                  <Button 
                    disabled={!consoleDevice}
                    onClick={handleConnect}
                    size="lg"
                    className={`rounded-xl md:rounded-2xl font-black uppercase tracking-widest gap-3 h-12 md:h-14 ${
                      consoleDevice 
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/20 active:scale-95' 
                        : isDark ? 'bg-slate-800 text-slate-600' : 'bg-slate-200 text-slate-400'
                    } cursor-not-allowed`}
                  >
                    <TerminalIcon className="w-5 h-5" />
                    {t.connect}
                  </Button>
                  <p className={`text-[10px] ${isDark ? 'text-slate-700' : 'text-slate-400'} uppercase tracking-[0.2em] font-black mt-1`}>
                    {t.consoleConfiguration}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div 
            ref={outputRef}
            className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-2 font-mono text-[13px] leading-relaxed flex flex-col"
          >
            <div className="flex-1" /> {/* Spacer to push content down if small */}
            {(activeTab === 'desktop' ? pcOutput : activeConsoleOutput).map((line) => (
              <div key={line.id} className="break-all animate-in fade-in slide-in-from-left-1 duration-200">
                {line.type === 'command' && (
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-500 shrink-0 font-black opacity-50 select-none">
                      {activeTab === 'desktop' ? 'C:\\>' : (line.prompt || '>')}
                    </span>
                    <span className={cmdColor}>{line.content}</span>
                  </div>
                )}
                {line.type === 'prompt' && (
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-500 shrink-0 font-black">{line.prompt}</span>
                  </div>
                )}
                {line.type === 'output' && <span className={`${textColor} whitespace-pre-wrap`}>{line.content}</span>}
                {line.type === 'error' && <span className="text-rose-500 font-bold italic">{line.content}</span>}
                {line.type === 'success' && <span className="text-cyan-500 font-bold uppercase text-[11px] tracking-widest opacity-80">{line.content}</span>}
              </div>
            ))}
          </div>

          {/* History / Mobile Helpers */}
          {recentCommands.length > 0 && (
            <div className={`md:hidden flex flex-col gap-1 px-4 py-2 border-t ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-100/50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <History className="w-3 h-3 text-slate-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {language === 'tr' ? 'Son Komutlar' : 'Recent Commands'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentCommands.map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => executeCommand(cmd)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all border ${
                      isDark 
                        ? 'bg-slate-800 border-slate-700 text-slate-300 active:bg-cyan-500/20 active:text-cyan-400' 
                        : 'bg-white border-slate-200 text-slate-600 active:bg-cyan-50'
                    }`}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={`p-4 border-t ${isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center gap-3 max-w-full">
              <div className={`flex items-center gap-3 px-4 py-2.5 ${inputBg} rounded-xl border ${inputBorder} flex-1 focus-within:border-blue-500/50 transition-all group`}>
                <span className="text-emerald-500 font-black text-xs select-none shrink-0 opacity-50 group-focus-within:opacity-100 transition-opacity">
                  {activeTab === 'desktop' 
                    ? 'C:\\>' 
                    : (isConsoleConnected ? (activeConsoleOutput.findLast(l => l.prompt !== undefined)?.prompt || '>') : 'OFFLINE>')}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={activeTab === 'terminal' && !isConsoleConnected}
                  className={`flex-1 bg-transparent border-none outline-none ${cmdColor} font-mono text-[13px] placeholder:text-slate-500 w-full`}
                  placeholder={activeTab === 'terminal' && !isConsoleConnected ? t.waitingForConnection : t.typeCommand}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className={`hidden md:flex items-center gap-1.5 px-1.5 py-0.5 rounded border ${isDark ? 'border-slate-800 bg-slate-800/50' : 'border-slate-200 bg-slate-100'} text-[10px] text-slate-500 font-black uppercase tracking-widest`}>
                  <Command className="w-2.5 h-3.5" />
                  Enter
                </div>
              </div>
              
              <Button 
                onClick={() => executeCommand()}
                disabled={(activeTab === 'terminal' && !isConsoleConnected) || !input.trim()}
                size="icon"
                className={`shrink-0 h-11 w-11 rounded-xl transition-all shadow-lg ${
                  input.trim() 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-95' 
                    : isDark ? 'bg-slate-800 text-slate-700' : 'bg-slate-200 text-slate-400'
                } cursor-not-allowed opacity-50`}
              >
                <CornerDownLeft className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function getPCConfigDefaults(id: string) {
  const num = id.split('-')[1] || '1';
  return {
    ip: `192.168.1.${10 + parseInt(num)}`,
    mac: `00E0.F7${num.padStart(2, '0')}.A${num}B${num}`
  };
}
