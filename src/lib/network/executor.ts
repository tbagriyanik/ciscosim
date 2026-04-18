// Network Command Executor (refactored with handler map)
import { SwitchState, CommandMode, CommandResult } from './types';
import { checkConnectivity } from './connectivity';
import { addStaticRoute, removeStaticRoute, getRoutingTable } from './routing';
import { parseCommand, validateCommand, getHelpContent, commandPatterns } from './parser';
import { getModePrompt } from './initialState';
import { isValidMAC, normalizeMAC } from '../utils';

/**
 * Generate CLI prompt string based on current switch state
 */
export function getPrompt(state: SwitchState): string {
  const hostname = state.hostname || 'Switch';
  const mode = state.currentMode;

  switch (mode) {
    case 'user':
      return `${hostname}>`;
    case 'privileged':
      return `${hostname}#`;
    case 'config':
      return `${hostname}(config)#`;
    case 'interface':
      return `${hostname}(config-if)#`;
    case 'config-if-range':
      return `${hostname}(config-if-range)#`;
    case 'line':
      return `${hostname}(config-line)#`;
    case 'vlan':
      return `${hostname}(config-vlan)#`;
    case 'router-config':
      return `${hostname}(config-router)#`;
    case 'dhcp-config':
      return `${hostname}(dhcp-config)#`;
    default:
      return `${hostname}>`;
  }
}

// Import command handlers from modular files
import { systemHandlers } from './core/systemCommands';
import { showHandlers } from './core/showCommands';
import { interfaceHandlers } from './core/interfaceCommands';
import { globalConfigHandlers } from './core/globalConfigCommands';
import { routerConfigHandlers } from './core/routerConfigCommands';
import { lineHandlers } from './core/lineCommands';
import { privilegedHandlers } from './core/privilegedCommands';
import { dhcpConfigHandlers } from './core/dhcpConfigCommands';

// --- Command handler types & context ---
export interface CommandContext {
  language: 'tr' | 'en';
  devices?: any[];
  connections?: any[];
  deviceStates: Map<string, SwitchState>;
  sourceDeviceId?: string;
}

export type CommandHandler = (
  state: SwitchState,
  input: string,
  ctx: CommandContext
) => CommandResult;

// --- Inline help tree ---
// Helper: Generate prefixes for a command (e.g., 'telnet' -> 't','te','tel'...)
const pfx = (cmd: string, completions: string[], minLen = 1): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  for (let i = minLen; i <= cmd.length; i++) {
    result[cmd.slice(0, i)] = completions;
  }
  return result;
};

// Helper: Generate prefixes for nested commands (e.g., 'show version')
const npfx = (base: string, cmd: string, completions: string[], minLen = 1): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  const prefix = base + ' ';
  for (let i = minLen; i <= cmd.length; i++) {
    result[prefix + cmd.slice(0, i)] = completions;
  }
  return result;
};

// Helper: Single letter or exact match
const single = (char: string, completions: string[]): Record<string, string[]> => ({ [char]: completions });

// Helper: Multi-prefix for ambiguous first letters (e.g., 't' -> ['telnet','tracert'])
const multi = (char: string, completions: string[]): Record<string, string[]> => {
  const result: Record<string, string[]> = { [char]: completions };
  completions.forEach(cmd => {
    for (let i = 1; i <= cmd.length; i++) {
      const prefix = cmd.slice(0, i);
      // Only add if this prefix is unique to this command
      const matches = completions.filter(c => c.startsWith(prefix));
      if (matches.length === 1) {
        result[char + prefix] = [cmd];
      }
    }
  });
  return result;
};

export const commandHelp: Record<string, Record<string, string[]>> = {
  user: {
    '': ['enable', 'exit', 'show', 'ipconfig', 'ping', 'telnet', 'ssh', 'tracert', 'traceroute', 'netstat', 'nbtstat', 'getmac', 'nslookup', 'http', 'arp', 'hostname', 'dir', 'ver', 'cls', 'quit', 'snake', '?', 'help'],
    ...single('i', ['ipconfig']),
    ...pfx('ipconfig', ['ipconfig']),
    ...single('p', ['ping']),
    ...multi('t', ['telnet', 'tracert', 'traceroute']),
    ...pfx('telnet', ['telnet']),
    ...pfx('tracert', ['']),
    ...pfx('traceroute', ['']),
    ...multi('s', ['ssh', 'show']),
    ...pfx('ssh', ['']),
    ...multi('n', ['netstat', 'nbtstat', 'nslookup']),
    ...pfx('netstat', ['netstat']),
    ...pfx('nbtstat', ['nbtstat']),
    ...pfx('nslookup', ['nslookup']),
    ...single('g', ['getmac']),
    ...pfx('getmac', ['getmac']),
    'h': ['http', 'hostname'],
    'http': ['iot-panel', 'http://iot-panel'],
    'http i': ['iot-panel'],
    'http io': ['iot-panel'],
    'http iot': ['-panel'],
    'http iot-': ['panel'],
    'http iot-p': ['anel'],
    'http iot-pa': ['nel'],
    'http iot-pan': ['el'],
    'http iot-pane': ['l'],
    'http h': ['http://iot-panel'],
    'http ht': ['http://iot-panel'],
    'http htt': ['http://iot-panel'],
    'http http': ['://iot-panel'],
    'http http:': ['//iot-panel'],
    'http http:/': ['/iot-panel'],
    'http http://': ['iot-panel'],
    'http http://i': ['ot-panel'],
    'http http://io': ['t-panel'],
    'http http://iot': ['-panel'],
    'http http://iot-': ['panel'],
    'http http://iot-p': ['anel'],
    'http http://iot-pa': ['nel'],
    'http http://iot-pan': ['el'],
    'http http://iot-pane': ['l'],
    'a': ['arp'],
    'd': ['dir'],
    'v': ['ver'],
    'cl': ['cls'],
    'q': ['quit'],
    'sho': ['show'],
    'show': ['version', 'wireless', 'ssh'],
  },
  privileged: {
    '': ['configure', 'disable', 'show', 'clear', 'debug', 'undebug', 'terminal', 'write', 'ping', 'telnet', 'ssh', 'tracert', 'traceroute', 'reload', 'exit', 'copy', 'erase', 'delete', 'ip', '?', 'help'],
    ...multi('c', ['configure', 'clear', 'copy']),
    ...pfx('configure', ['terminal']),
    ...npfx('configure', 'terminal', ['terminal']),
    ...multi('d', ['disable', 'delete', 'debug']),
    ...pfx('disable', ['disable']),
    ...pfx('delete', ['flash:', 'nvram:']),
    ...npfx('delete', 'flash:', ['vlan.dat', 'config.text'], 6),
    ...npfx('delete', 'nvram:', ['startup-config'], 6),
    ...pfx('debug', ['ip', 'spanning-tree', 'all']),
    ...pfx('undebug', ['all']),
    ...pfx('terminal', ['length', 'width', 'monitor']),
    ...pfx('clear', ['arp-cache', 'mac', 'counters', 'ip']),
    ...npfx('clear', 'mac', ['address-table'], 3),
    ...npfx('clear', 'ip', ['route', 'arp'], 2),
    ...pfx('show', ['running-config', 'interfaces', 'vlan', 'version', 'mac', 'cdp', 'ip', 'spanning-tree', 'port-security', 'wireless', 'ssh']),
    ...npfx('show', 'running-config', ['running-config'], 14),
    ...multi('show i', ['interfaces', 'ip']),
    ...npfx('show', 'interfaces', ['status', 'trunk'], 10),
    ...npfx('show interface', 'trunk', ['trunk'], 5),
    ...multi('show v', ['vlan', 'version']),
    ...npfx('show', 'vlan', ['brief'], 4),
    ...npfx('show', 'mac', ['address-table'], 3),
    ...multi('show c', ['cdp', 'clock']),
    ...npfx('show', 'cdp', ['neighbors'], 3),
    ...multi('show ip', ['interface', 'route']),
    ...npfx('show ip', 'interface', ['brief'], 9),
    ...npfx('show ip', 'route', ['route'], 5),
    'ip': ['route', 'default-gateway', 'domain-name', 'ssh'],
    ...npfx('ip', 'route', ['route']),

    'w': ['write'],
    'wr': ['write'],
    'wri': ['write'],
    'writ': ['write'],
    'write': ['memory'],

    'p': ['ping'],
    'pi': ['ping'],
    'pin': ['ping'],

    't': ['telnet', 'tracert', 'traceroute'],
    'te': ['telnet'],
    'tel': ['telnet'],
    'teln': ['telnet'],
    'telne': ['telnet'],
    'tr': ['tracert', 'traceroute'],
    'tra': ['tracert', 'traceroute'],
    'trac': ['tracert'],
    'trace': ['traceroute'],
    'tracer': ['traceroute'],
    'tracert': [''],
    'traceroute': [''],
    's': ['ssh'],
    'ssh': [''],

    ...single('r', ['reload']),
    ...pfx('reload', ['reload']),
    ...single('e', ['exit']),
    ...pfx('exit', ['exit']),
    'copy': ['running-config'],
    ...npfx('copy', 'flash:', ['startup-config']),
    ...npfx('copy', 'running-config', ['startup-config']),
    ...npfx('copy running-config', 'flash:', ['']),
    ...npfx('copy running-config', 'startup-config', ['startup-config']),
    ...pfx('erase', ['startup-config', 'nvram']),
    ...npfx('erase', 'startup-config', ['startup-config']),
    ...npfx('erase', 'nvram', ['nvram']),
  },
  config: {
    '': ['hostname', 'interface', 'vlan', 'enable', 'service', 'username', 'line', 'banner', 'ip', 'ipv6', 'crypto', 'snmp-server', 'ntp', 'clock', 'archive', 'alias', 'macro', 'iot', 'no', 'spanning-tree', 'vtp', 'cdp', 'exit', 'end', 'do', '?', 'help'],
    ...pfx('banner', ['motd', 'login', 'exec']),
    ...npfx('banner', 'motd', ['']),
    ...npfx('banner', 'login', ['']),
    ...npfx('banner', 'exec', ['']),
    ...pfx('hostname', ['hostname']),
    ...pfx('iot', ['sensor', 'name', 'wifi']),
    ...npfx('iot', 'sensor', ['temperature', 'humidity', 'motion', 'light', 'sound']),
    ...npfx('iot', 'name', ['<name>']),
    ...npfx('iot', 'wifi', ['ssid', 'password', 'security']),

    'i': ['interface', 'ip', 'ipv6', 'iot'],
    'in': ['interface'],
    'int': ['interface'],
    'inte': ['interface'],
    'inter': ['interface'],
    'interf': ['interface'],
    'interfa': ['interface'],
    'interfac': ['interface'],
    'interface': ['FastEthernet', 'GigabitEthernet', 'Vlan', 'Wlan0', 'range'],
    'interface F': ['FastEthernet'],
    'interface f': ['fastethernet'],
    'interface Fa': ['FastEthernet'],
    'interface fa': ['fastethernet'],
    'interface Fas': ['FastEthernet'],
    'interface fas': ['fastethernet'],
    'interface Fast': ['FastEthernet'],
    'interface fast': ['fastethernet'],
    'interface FastE': ['FastEthernet'],
    'interface faste': ['fastethernet'],
    'interface FastEt': ['FastEthernet'],
    'interface fastet': ['fastethernet'],
    'interface FastEth': ['FastEthernet'],
    'interface fasteth': ['fastethernet'],
    'interface FastEthe': ['FastEthernet'],
    'interface fastethe': ['fastethernet'],
    'interface FastEther': ['FastEthernet'],
    'interface fastether': ['fastethernet'],
    'interface FastEthern': ['FastEthernet'],
    'interface fastethern': ['fastethernet'],
    'interface FastEtherne': ['FastEthernet'],
    'interface fastetherne': ['fastethernet'],
    'interface FastEthernet': ['0/'],
    'interface fastethernet': ['0/'],
    'interface FastEthernet0': ['0/'],
    'interface fastethernet0': ['0/'],
    'interface FastEthernet0/': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
    'interface fastethernet0/': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
    'interface G': ['GigabitEthernet'],
    'interface g': ['gigabitethernet'],
    'interface Gi': ['GigabitEthernet'],
    'interface gi': ['gigabitethernet'],
    'interface Gig': ['GigabitEthernet'],
    'interface gig': ['gigabitethernet'],
    'interface Giga': ['GigabitEthernet'],
    'interface giga': ['gigabitethernet'],
    'interface Gigab': ['GigabitEthernet'],
    'interface gigab': ['gigabitethernet'],
    'interface Gigabi': ['GigabitEthernet'],
    'interface gigabi': ['gigabitethernet'],
    'interface Gigabit': ['GigabitEthernet'],
    'interface gigabit': ['gigabitethernet'],
    'interface GigabitE': ['GigabitEthernet'],
    'interface gigabite': ['gigabitethernet'],
    'interface GigabitEt': ['GigabitEthernet'],
    'interface gigabitet': ['gigabitethernet'],
    'interface GigabitEth': ['GigabitEthernet'],
    'interface gigabieth': ['gigabitethernet'],
    'interface GigabitEthe': ['GigabitEthernet'],
    'interface gigabiethe': ['gigabitethernet'],
    'interface GigabitEther': ['GigabitEthernet'],
    'interface gigabiether': ['gigabitethernet'],
    'interface GigabitEthern': ['GigabitEthernet'],
    'interface gigabiethern': ['gigabitethernet'],
    'interface GigabitEtherne': ['GigabitEthernet'],
    'interface gigabietherne': ['gigabitethernet'],
    'interface GigabitEthernet': ['0/'],
    'interface gigabitethernet': ['0/'],
    'interface GigabitEthernet0': ['0/'],
    'interface gigabitethernet0': ['0/'],
    'interface GigabitEthernet0/': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
    'interface gigabitethernet0/': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
    'interface V': ['Vlan'],
    'interface v': ['vlan'],
    'interface Vl': ['Vlan'],
    'interface vl': ['vlan'],
    'interface Vla': ['Vlan'],
    'interface vla': ['vlan'],
    'interface Vlan': ['1', '2', '3', '4', '5', '10', '20', '30', '40', '50', '100', '200', '300', '400', '500'],
    'interface vlan': ['1', '2', '3', '4', '5', '10', '20', '30', '40', '50', '100', '200', '300', '400', '500'],
    'interface r': ['range'],
    'interface ra': ['range'],
    'interface ran': ['range'],
    'interface rang': ['range'],
    'interface range': ['FastEthernet', 'GigabitEthernet'],
    'interface range F': ['FastEthernet'],
    'interface range Fa': ['FastEthernet'],
    'interface range Fas': ['FastEthernet'],
    'interface range Fast': ['FastEthernet'],
    'interface range FastE': ['FastEthernet'],
    'interface range FastEt': ['FastEthernet'],
    'interface range FastEth': ['FastEthernet'],
    'interface range FastEthe': ['FastEthernet'],
    'interface range FastEther': ['FastEthernet'],
    'interface range FastEthern': ['FastEthernet'],
    'interface range FastEtherne': ['FastEthernet'],
    'interface range FastEthernet': ['0/'],
    'interface range FastEthernet0': ['0/'],
    'interface range FastEthernet0/': ['1-24', '1-12', '1-6', '0-20'],
    'interface range G': ['GigabitEthernet'],
    'interface range Gi': ['GigabitEthernet'],
    'interface range Gig': ['GigabitEthernet'],
    'interface range Giga': ['GigabitEthernet'],
    'interface range Gigab': ['GigabitEthernet'],
    'interface range Gigabi': ['GigabitEthernet'],
    'interface range Gigabit': ['GigabitEthernet'],
    'interface range GigabitE': ['GigabitEthernet'],
    'interface range GigabitEt': ['GigabitEthernet'],
    'interface range GigabitEth': ['GigabitEthernet'],
    'interface range GigabitEthe': ['GigabitEthernet'],
    'interface range GigabitEther': ['GigabitEthernet'],
    'interface range GigabitEthern': ['GigabitEthernet'],
    'interface range GigabitEtherne': ['GigabitEthernet'],
    'interface range GigabitEthernet': ['0/'],
    'interface range GigabitEthernet0': ['0/'],
    'interface range GigabitEthernet0/': ['0-3', '1-2'],
    'interface W': ['Wlan0'],
    'interface w': ['wlan0'],
    'interface Wl': ['Wlan0'],
    'interface wl': ['wlan0'],
    'interface Wlan': ['0'],
    'interface wlan': ['0'],
    'interface Wlan0': [''],
    'interface wlan0': [''],

    'ipv6': ['unicast-routing', 'address', 'route'],
    ...npfx('ipv6', 'unicast-routing', [''], 15),
    ...npfx('ipv6', 'address', ['<ipv6-address>'], 7),
    ...npfx('ipv6', 'route', ['<ipv6-prefix>', '<next-hop>'], 5),

    'crypto': ['key'],
    ...npfx('crypto', 'key', ['generate'], 3),
    ...npfx('crypto key', 'generate', ['rsa'], 8),

    'snmp-server': ['community', 'contact', 'location'],
    ...npfx('snmp-server', 'community', ['<string>', 'RO', 'RW'], 9),
    ...npfx('snmp-server', 'contact', ['<text>'], 7),
    ...npfx('snmp-server', 'location', ['<text>'], 8),

    'ntp': ['server'],
    ...npfx('ntp', 'server', ['<ip-address>'], 6),

    'clock': ['timezone'],
    ...npfx('clock', 'timezone', ['<name>', '<offset>'], 8),

    'archive': [''],
    'alias': ['exec', 'configure', 'interface', 'line'],
    'macro': ['name', 'global', 'auto'],

    ...pfx('vlan', ['1', '10', '20', '30', '50', '100', '200']),

    ...multi('e', ['enable', 'end', 'exit']),
    ...multi('en', ['enable', 'encryption']),
    ...pfx('enable', ['secret', 'password']),
    ...pfx('encryption', ['open', 'wpa', 'wpa2', 'wpa3']),
    ...npfx('enable', 'secret', ['secret']),
    ...npfx('enable', 'password', ['password']),


    ...npfx('no', 'enable', ['secret', 'password']),
    ...npfx('no enable', 'secret', ['']),
    ...npfx('no enable', 'password', ['']),

    ...pfx('service', ['password-encryption']),

    ...pfx('username', ['username']),

    ...pfx('line', ['console', 'vty']),
    ...npfx('line', 'console', ['0']),
    'line console 0': [''],
    ...npfx('line', 'vty', ['0']),
    'line vty 0': ['4'],
    'line vty 0 4': [''],

    // Banner completions removed - handled by config section above

    'ip': ['default-gateway', 'domain-name', 'ssh', 'http', 'dhcp', 'routing'],
    ...multi('ip d', ['default-gateway', 'domain-name', 'dhcp']),
    ...npfx('ip', 'dhcp', ['pool', 'excluded-address', 'snooping']),
    ...npfx('ip dhcp', 'pool', ['<pool-name>']),
    ...npfx('ip dhcp', 'excluded-address', ['<low-ip>', '<high-ip>']),
    ...npfx('ip', 'default-gateway', ['default-gateway']),
    ...npfx('ip', 'domain-name', ['domain-name']),
    ...npfx('ip', 'http', ['server']),
    ...npfx('ip http', 'server', ['']),
    ...npfx('ip', 'ssh', ['version']),
    ...npfx('ip ssh', 'version', ['version']),

    ...single('n', ['no']),
    ...pfx('no', ['shutdown', 'vlan', 'cdp', 'service', 'spanning-tree', 'ip']),

    ...pfx('spanning-tree', ['mode', 'portfast']),
    ...npfx('spanning-tree', 'mode', ['pvst', 'rapid-pvst', 'mst']),

    ...pfx('vtp', ['mode', 'domain']),
    ...npfx('vtp', 'mode', ['server', 'client', 'transparent']),
    ...npfx('vtp', 'domain', ['']),

    ...pfx('cdp', ['run']),
    'cdp r': ['run'],
    'cdp ru': ['run'],

    'ex': ['exit'],
    'exi': ['exit'],

    'end': [''],

    'do': ['show', 'write', 'ping'],
    'do s': ['show'],
    'do sh': ['show'],
    'do sho': ['show'],
    'do show': ['running-config', 'interfaces', 'vlan', 'version', 'ssh'],
    'do w': ['write'],
    'do wr': ['write'],
    'do wri': ['write'],
    'do writ': ['write'],
    'do write': ['memory'],
  },
  interface: {
    '': ['shutdown', 'no', 'speed', 'duplex', 'description', 'switchport', 'cdp', 'spanning-tree', 'channel-group', 'ip', 'ssid', 'encryption', 'wifi-password', 'channel', 'wifi-mode', 'exit', 'end', 'do', '?', 'help'],
    ...multi('s', ['shutdown', 'speed', 'spanning-tree', 'ssid']),
    ...pfx('ssid', ['<SSID>']),
    ...pfx('encryption', ['open', 'wpa', 'wpa2', 'wpa3']),
    ...pfx('shutdown', ['shutdown']),

    ...multi('sp', ['speed', 'spanning-tree']),
    ...pfx('speed', ['10', '100', '1000', 'auto']),

    ...multi('d', ['duplex', 'description']),
    ...pfx('duplex', ['half', 'full', 'auto']),
    ...pfx('description', ['']),



    ...single('i', ['ip']),
    'ip': ['address', 'helper-address', 'default-gateway'],
    ...npfx('ip', 'address', []),
    ...npfx('ip', 'default-gateway', ['']),

    ...single('n', ['no']),
    ...pfx('no', ['shutdown', 'switchport', 'cdp', 'description', 'speed', 'duplex', 'spanning-tree', 'ip']),
    ...multi('no s', ['shutdown', 'switchport', 'speed', 'spanning-tree']),
    ...pfx('no shutdown', ['shutdown']),
    ...pfx('no switchport', ['mode', 'access', 'port-security']),
    'no i': ['ip'],
    'no ip': ['address', 'default-gateway', 'http'],
    'no ip h': ['http'],
    'no ip ht': ['http'],
    'no ip htt': ['http'],
    ...npfx('no ip', 'http', ['server']),
    ...npfx('no ip http', 'server', ['']),
    ...npfx('no ip', 'address', []),
    ...npfx('no ip', 'default-gateway', ['']),

    ...pfx('switchport', ['mode', 'access', 'trunk', 'port-security', 'voice', 'nonegotiate']),
    ...npfx('switchport', 'mode', ['access', 'trunk', 'dynamic', 'dot1q-tunnel']),
    ...multi('switchport mode d', ['dynamic', 'dot1q-tunnel']),
    ...npfx('switchport mode', 'dynamic', ['auto', 'desirable']),
    ...npfx('switchport', 'access', ['vlan']),
    ...npfx('switchport access', 'vlan', ['1', '10', '20', '30', '50', '100']),
    ...npfx('switchport', 'trunk', ['allowed', 'native', 'encapsulation']),
    ...npfx('switchport trunk', 'allowed', ['vlan']),
    ...npfx('switchport trunk allowed', 'vlan', ['all', 'add', 'remove', '1,2,10,20']),
    ...npfx('switchport', 'port-security', ['maximum', 'violation', 'mac-address']),
    ...npfx('switchport port-security', 'maximum', ['1', '2', '3', '5', '10']),
    ...npfx('switchport port-security', 'violation', ['protect', 'restrict', 'shutdown']),
    ...npfx('switchport port-security', 'mac-address', ['sticky', '<MAC>']),
    ...npfx('switchport port-security mac-address', 'sticky', ['']),

    ...pfx('cdp', ['enable']),
    ...npfx('cdp', 'enable', ['enable']),

    ...pfx('spanning-tree', ['portfast', 'bpduguard', 'cost', 'priority']),
    'spanning-tree p': ['portfast'],
    'spanning-tree po': ['portfast'],
    'spanning-tree por': ['portfast'],
    'spanning-tree port': ['portfast'],
    'spanning-tree portf': ['portfast'],
    'spanning-tree portfa': ['portfast'],
    ...npfx('spanning-tree', 'portfast', ['']),
    ...npfx('spanning-tree', 'bpduguard', ['enable', 'disable']),

    ...pfx('channel-group', ['1', '2']),
    'channel-group 1': ['mode'],
    ...npfx('channel-group 1', 'mode', ['active', 'passive', 'on', 'desirable', 'auto']),

    ...pfx('wifi-password', ['<password>']),
    ...pfx('wifi-channel', ['2.4GHz', '5GHz']),
    ...pfx('wifi-mode', ['ap', 'client', 'disabled']),

    ...pfx('exit', ['exit']),
    'end': [''],
    ...multi('do', ['show', 'write', 'ping']),
    ...npfx('do', 'show', ['running-config', 'interfaces', 'vlan']),
  },
  line: {
    '': ['password', 'login', 'no', 'transport', 'exec-timeout', 'logging', 'history', 'privilege', 'exit', 'end', 'do', '?', 'help'],
    ...pfx('password', ['password']),
    ...multi('l', ['login', 'logging']),
    ...pfx('login', ['', 'local']),
    ...npfx('login', 'local', ['local']),

    ...single('n', ['no']),
    ...pfx('no', ['login']),
    ...npfx('no', 'login', ['']),
    ...pfx('logging', ['synchronous']),
    ...npfx('logging', 'synchronous', ['']),

    ...pfx('transport', ['input', 'output']),
    ...npfx('transport', 'input', ['ssh', 'telnet', 'all', 'none']),

    ...multi('e', ['exec-timeout', 'exit', 'end']),
    ...multi('ex', ['exec-timeout', 'exit']),
    ...pfx('exec-timeout', ['<minutes>', '0']),

    ...pfx('history', ['size']),
    ...npfx('history', 'size', ['size']),

    ...pfx('privilege', ['level']),
    ...npfx('privilege', 'level', ['0', '1', '15']),

    'exit': [''],
    'end': [''],
    ...multi('do', ['show', 'write', 'ping']),
    ...npfx('do', 'show', ['running-config', 'ssh']),
  },
  vlan: {
    '': ['name', 'state', 'exit', 'end', '?', 'help'],
    ...pfx('name', ['']),
    ...pfx('state', ['active', 'suspend']),
    'exit': [''],
    'end': [''],
  },
  'router-config': {
    '': ['network', 'router-id', 'passive-interface', 'default-information', 'exit', 'end', '?', 'help'],
    ...pfx('network', ['']),
    ...pfx('router-id', ['<ip-address>']),
    ...pfx('passive-interface', ['FastEthernet', 'GigabitEthernet']),
    ...pfx('default-information', ['originate']),
    ...pfx('exit', ['exit']),
    'end': [''],
  },
  'dhcp-config': {
    '': ['network', 'default-router', 'dns-server', 'lease', 'domain-name', 'exit', 'end', '?', 'help'],
    ...pfx('network', ['<network-address>', '<subnet-mask>']),
    ...multi('d', ['default-router', 'dns-server', 'domain-name']),
    ...pfx('default-router', ['default-router']),
    'default': ['default-router'],
    'default-': ['default-router'],
    ...npfx('default', 'router', ['<ip-address>']),
    ...pfx('dns-server', ['<ip-address>']),
    ...pfx('lease', ['infinite', '1', '7', '30']),
    ...pfx('domain-name', ['<domain>']),
    ...pfx('exit', ['exit']),
    'end': [''],
  },
};

function getInlineHelp(mode: CommandMode, partialInput: string, prompt: string): string {
  const modeCommands = commandHelp[mode] || commandHelp.user;
  const lower = partialInput.toLowerCase().trim();

  let suggestions: string[] = [];

  // 1. Exact match in commandHelp tree
  if (modeCommands[lower]) {
    suggestions = [...modeCommands[lower]];
  }

  // 2. Prefix match in commandHelp tree
  if (suggestions.length === 0) {
    for (const key of Object.keys(modeCommands)) {
      if (key.startsWith(lower) && key !== lower) {
        const remaining = key.substring(lower.length).trim();
        if (remaining) {
          const nextWord = remaining.split(' ')[0];
          if (nextWord && !suggestions.includes(nextWord)) {
            suggestions.push(nextWord);
          }
        }
      }
    }
  }

  // 3. Fallback: derive suggestions from commandPatterns for this mode
  //    This handles "no ip ?", "do ping ?", multi-word prefixes not in commandHelp tree
  if (suggestions.length === 0) {
    const patternSuggestions: string[] = [];
    for (const [name, pattern] of Object.entries(commandPatterns)) {
      if (!pattern.modes.includes(mode as any)) continue;
      if (!name.startsWith(lower + ' ') && name !== lower) continue;
      const remaining = name.substring(lower.length).trim();
      if (!remaining) continue;
      const nextWord = remaining.split(' ')[0];
      if (nextWord && !patternSuggestions.includes(nextWord)) {
        patternSuggestions.push(nextWord);
      }
    }
    suggestions = patternSuggestions;
  }

  const lines: string[] = [];
  lines.push(prompt + partialInput + '?');
  lines.push('');

  if (suggestions.length === 0) {
    lines.push('% Unrecognized command');
  } else {
    suggestions.forEach(cmd => {
      if (cmd && !cmd.startsWith('<')) {
        lines.push(`  ${cmd}`);
      }
    });
  }

  lines.push('');

  return lines.join('\n');
}

// --- Core executor ---
export function executeCommand(
  state: SwitchState,
  input: string,
  language: 'tr' | 'en' = 'tr',
  devices?: any[],
  connections?: any[],
  deviceStates?: Map<string, SwitchState>,
  sourceDeviceId?: string
): CommandResult {
  if (input === '__CANCEL__') {
    // Cancellation token - handled by useDeviceManager
    return { success: false, error: '% Command cancelled' };
  }

  if (input === '__CONSOLE_CONNECT__') {
    return handleConsoleConnect(state, language);
  }

  // Special reload control tokens from Terminal to avoid normal parsing
  if (input === '__RELOAD_CONFIRM__' || input === '__RELOAD_CANCEL__') {
    // No longer used - reload is immediate
    return { success: false, error: '% Unknown command' };
  }

  if (input === '__TELNET_CONNECT__') {
    return handleTelnetConnect(state, language);
  }

  if (input.startsWith('__SSH_CONNECT__')) {
    const sshUser = input.includes(':') ? input.split(':').slice(1).join(':').trim() : '';
    return handleSshConnect(state, language, sshUser || undefined);
  }

  if (state.awaitingPassword) {
    if (input === '__PASSWORD_CANCELLED__') {
      // Password dialog was cancelled (ESC, back, outside click)
      return {
        success: false,
        error: language === 'tr' ? '% Erişim reddedildi' : '% Access denied',
        newState: {
          awaitingPassword: false,
          passwordContext: undefined,
          consoleAuthenticated: false,
          telnetAuthenticated: false
        }
      };
    }
    return handlePasswordInput(state, input, language);
  }

  let cmdToProcess = input.trim();
  const lowerInput = cmdToProcess.toLowerCase();

  if (state.currentMode === 'privileged') {
    if (lowerInput === 'conf t') cmdToProcess = 'configure terminal';
    if (lowerInput.startsWith('sh ip int br')) cmdToProcess = 'show ip interface brief';
    if (lowerInput.startsWith('sh run')) cmdToProcess = 'show running-config';
    if (lowerInput.startsWith('sh ip ro')) cmdToProcess = 'show ip route';
    if (lowerInput === 'sh ssh' || lowerInput === 'show ssh') cmdToProcess = 'show ssh';
    if (lowerInput === 'wr') cmdToProcess = 'write memory';
  } else if (state.currentMode === 'user') {
    if (lowerInput === 'en') cmdToProcess = 'enable';
  } else if (state.currentMode === 'config') {
    if (lowerInput.startsWith('int fa')) cmdToProcess = cmdToProcess.replace(/int fa/i, 'interface fastethernet');
    if (lowerInput.startsWith('int gi')) cmdToProcess = cmdToProcess.replace(/int gi/i, 'interface gigabitethernet');
    if (lowerInput.startsWith('int vlan')) cmdToProcess = cmdToProcess.replace(/int vlan/i, 'interface vlan');
  }

  // Special handling for enable command when no password is set
  // Direct console access (no remote session) can bypass this check
  // Remote session = telnet or SSH connection (has telnetAuthenticated flag)
  if (cmdToProcess.toLowerCase() === 'enable') {
    const isRemoteSession = state.telnetAuthenticated || state.consoleAuthenticated;
    if (isRemoteSession) {
      const hasEnablePassword = !!(state.security?.enableSecret || state.security?.enablePassword);
      if (!hasEnablePassword) {
        return {
          success: false,
          error: language === 'tr' ? '% Erişim reddedildi' : '% Access denied'
        };
      }
    }
  }

  const isHelpRequest = (cmdToProcess.endsWith('?') && cmdToProcess.length > 0) ||
    cmdToProcess.toLowerCase().trim() === 'help' ||
    cmdToProcess.toLowerCase().trim().endsWith(' help');

  if (isHelpRequest) {
    let partialInput = '';
    if (cmdToProcess.endsWith('?')) {
      partialInput = cmdToProcess.slice(0, -1).trim();
    } else if (cmdToProcess.toLowerCase().trim().endsWith(' help')) {
      const idx = cmdToProcess.toLowerCase().trim().lastIndexOf(' help');
      partialInput = cmdToProcess.trim().substring(0, idx).trim();
    }
    const prompt = getModePrompt(state.currentMode, state.hostname);
    const helpOutput = getInlineHelp(state.currentMode, partialInput, prompt);
    return {
      success: true,
      output: helpOutput
    };
  }

  const parsed = parseCommand(cmdToProcess, state.currentMode);

  if (!parsed) {
    return { success: true, output: '' };
  }

  const validation = validateCommand(parsed, state.currentMode, state);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || 'Unknown error'
    };
  }

  const commandName = validation.matchedPattern;
  if (!commandName) {
    return {
      success: false,
      error: '% Unknown command'
    };
  }

  const ctx: CommandContext = {
    language,
    devices,
    connections,
    deviceStates: deviceStates || new Map(),
    sourceDeviceId,
  };

  const handler = commandHandlers[commandName];
  if (!handler) {
    return { success: true };
  }

  return handler(state, parsed.resolvedInput || parsed.rawInput, ctx);
}

// --- Session helpers (kept local) ---
function handleConsoleConnect(state: SwitchState, language: 'tr' | 'en'): CommandResult {
  const needsLogin = !!(state.security.consoleLine.login && state.security.consoleLine.password);

  let output = '';

  // Device type detection for realistic boot messages
  const isRouter = state.version.modelName.includes('1900') || state.version.modelName.includes('C1900') || state.version.modelName.includes('1941');
  const isL3Switch = state.version.modelName.includes('3560');
  const isL2Switch = !isRouter && !isL3Switch;

  // Generate realistic boot messages based on device type
  let bootMessages: string;

  if (isRouter) {
    //  ISR Router boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
ISR4451/K9 platform with 4096 K bytes of memory

${syslog}
Load/bootstrap symbols loaded, GOXR initialization
Reading all bootflash vectors
POST: CPU PCIe port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c1900-universalk9-mz.SPA.154-3.M.bin...OK!
Extracting files from flash:c1900-universalk9-mz.SPA.154-3.M.bin...
  ########## [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
ISR4451/K9 platform with 4096 K bytes of memory

${syslog}
Load/bootstrap symbols loaded, GOXR initialization
Reading all bootflash vectors
POST: CPU PCIe port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c1900-universalk9-mz.SPA.154-3.M.bin...OK!
Extracting files from flash:c1900-universalk9-mz.SPA.154-3.M.bin...
  ########## [OK]
  0 bytes remaining in flash device`;
  } else if (isL3Switch) {
    //  3560 L3 Switch boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 12.2(55r)SE, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
C3560 platform with 131072 K bytes of memory

${syslog}
Load/bootstrap symbols loaded
Reading all bootflash vectors
POST: CPU PCIe port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c3560-ipbase-mz.152-2.SE4.bin...OK!
Extracting files from flash:c3560-ipbase-mz.152-2.SE4.bin...
  ########## [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 12.2(55r)SE, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
C3560 platform with 131072 K bytes of memory

${syslog}
Load/bootstrap symbols loaded
Reading all bootflash vectors
POST: CPU PCIe port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c3560-ipbase-mz.152-2.SE4.bin...OK!
Extracting files from flash:c3560-ipbase-mz.152-2.SE4.bin...
  ########## [OK]
  0 bytes remaining in flash device`;
  } else {
    //  2960 L2 Switch boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 12.2(11r)EA1, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
C2960 platform with 65536 K bytes of memory

${syslog}
Load/bootstrap symbols loaded
Reading all bootflash vectors
POST: CPU Ethernet port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c2960-lanbase-mz.152-2.E6.bin...OK!
Extracting files from flash:c2960-lanbase-mz.152-2.E6.bin...
  ########## [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 12.2(11r)EA1, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
C2960 platform with 65536 K bytes of memory

${syslog}
Load/bootstrap symbols loaded
Reading all bootflash vectors
POST: CPU Ethernet port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c2960-lanbase-mz.152-2.E6.bin...OK!
Extracting files from flash:c2960-lanbase-mz.152-2.E6.bin...
  ########## [OK]
  0 bytes remaining in flash device`;
  }

  output += `${bootMessages}\n`;

  // Display banner MOTD next
  if (state.bannerMOTD) {
    output += `\n${state.bannerMOTD}\n`;
  }

  output += `\nReady!\n\n`;

  if (!needsLogin) {
    // Check if enable password is configured - if not, start in privileged mode
    const needsEnablePassword = !!(state.security?.enableSecret || state.security?.enablePassword);
    const initialMode = needsEnablePassword ? 'user' : 'privileged';

    const prompt = getPrompt({ ...state, currentMode: initialMode });
    output += prompt;
    return {
      success: true,
      output,
      newState: {
        consoleAuthenticated: true,
        currentMode: initialMode
      }
    };
  }

  output += 'User Access Verification\n\nPassword: ';
  return {
    success: true,
    output,
    requiresPassword: true,
    passwordPrompt: 'Password: ',
    passwordContext: 'console',
    newState: {
      consoleAuthenticated: false,
      awaitingPassword: true,
      passwordContext: 'console'
    }
  };
}

function handleTelnetConnect(state: SwitchState, language: 'tr' | 'en'): CommandResult {
  const needsLogin = !!(state.security.vtyLines?.login && state.security.vtyLines?.password);

  let output = '';

  // Device type detection for realistic boot messages
  const isRouter = state.version.modelName.includes('1900') || state.version.modelName.includes('C1900') || state.version.modelName.includes('1941');
  const isL3Switch = state.version.modelName.includes('3560');
  const isL2Switch = !isRouter && !isL3Switch;

  // Generate realistic boot messages based on device type
  let bootMessages: string;

  if (isRouter) {
    //  ISR Router boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
ISR4451/K9 platform with 4096 K bytes of memory

${syslog}
Load/bootstrap symbols loaded, GOXR initialization
Reading all bootflash vectors
POST: CPU PCIe port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c1900-universalk9-mz.SPA.154-3.M.bin...OK!
Extracting files from flash:c1900-universalk9-mz.SPA.154-3.M.bin...
  ########## [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
ISR4451/K9 platform with 4096 K bytes of memory

${syslog}
Load/bootstrap symbols loaded, GOXR initialization
Reading all bootflash vectors
POST: CPU PCIe port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c1900-universalk9-mz.SPA.154-3.M.bin...OK!
Extracting files from flash:c1900-universalk9-mz.SPA.154-3.M.bin...
  ########## [OK]
  0 bytes remaining in flash device`;
  } else if (isL3Switch) {
    //  3560 L3 Switch boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 12.2(55r)SE, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
C3560 platform with 131072 K bytes of memory

${syslog}
Load/bootstrap symbols loaded
Reading all bootflash vectors
POST: CPU PCIe port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c3560-ipbase-mz.152-2.SE4.bin...OK!
Extracting files from flash:c3560-ipbase-mz.152-2.SE4.bin...
  ########## [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 12.2(55r)SE, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
C3560 platform with 131072 K bytes of memory

${syslog}
Load/bootstrap symbols loaded
Reading all bootflash vectors
POST: CPU PCIe port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c3560-ipbase-mz.152-2.SE4.bin...OK!
Extracting files from flash:c3560-ipbase-mz.152-2.SE4.bin...
  ########## [OK]
  0 bytes remaining in flash device`;
  } else {
    //  2960 L2 Switch boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 12.2(11r)EA1, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
C2960 platform with 65536 K bytes of memory

${syslog}
Load/bootstrap symbols loaded
Reading all bootflash vectors
POST: CPU Ethernet port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c2960-lanbase-mz.152-2.E6.bin...OK!
Extracting files from flash:c2960-lanbase-mz.152-2.E6.bin...
  ########## [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 12.2(11r)EA1, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2026 by Network Systems, Inc.
C2960 platform with 65536 K bytes of memory

${syslog}
Load/bootstrap symbols loaded
Reading all bootflash vectors
POST: CPU Ethernet port Check PASS
CPU memory test . . . . . . . . . . . . . OK
Board initialization completed
Initializing flash file system

Booting flash:c2960-lanbase-mz.152-2.E6.bin...OK!
Extracting files from flash:c2960-lanbase-mz.152-2.E6.bin...
  ########## [OK]
  0 bytes remaining in flash device`;
  }

  output += `${bootMessages}\n`;

  if (!needsLogin) {
    // Display banner MOTD for open access
    if (state.bannerMOTD) {
      output += `\n${state.bannerMOTD}\n`;
    }
    output += `\nReady!\n\n`;

    // Telnet authentication always starts in user mode - enable password required to go to privileged
    const initialMode = 'user';

    const prompt = getPrompt({ ...state, currentMode: initialMode });
    output += prompt;
    return {
      success: true,
      output,
      newState: {
        telnetAuthenticated: true,
        currentMode: initialMode
      }
    };
  }

  // Display banner MOTD before login prompt (and banner login if configured)
  output = '';
  if (state.bannerLogin) {
    output += `${state.bannerLogin}\n`;
  }
  if (state.bannerMOTD) {
    output += `\n${state.bannerMOTD}\n`;
  }

  output += `\nReady!\n\nUser Access Verification\n\nPassword: `;
  return {
    success: true,
    output,
    requiresPassword: true,
    passwordPrompt: 'Password: ',
    passwordContext: 'vty' as const,
    newState: {
      telnetAuthenticated: false,
      awaitingPassword: true,
      passwordContext: 'vty' as const
    }
  };
}

function handleSshConnect(state: SwitchState, language: 'tr' | 'en', requestedUser?: string): CommandResult {
  const existingSessions = Array.isArray(state.sshSessions) ? state.sshSessions : [];
  const nextSourceIndex = existingSessions.length;
  const user = requestedUser || state.sshLastUser || state.hostname || 'admin';
  const source = `vty${nextSourceIndex}`;

  // SSH authentication always starts in user mode - enable password required to go to privileged
  const initialMode = 'user';

  let output = '';
  if (state.bannerLogin) {
    output += `${state.bannerLogin}\n`;
  }
  if (state.bannerMOTD) {
    output += `\n${state.bannerMOTD}\n\n`;
  } else {
    output += '\n';
  }
  output += 'Password: ';
  return {
    success: true,
    output,
    passwordPrompt: 'Password: ',
    passwordContext: 'vty' as const,
    newState: {
      telnetAuthenticated: false,
      awaitingPassword: true,
      passwordContext: 'vty' as const,
      currentMode: initialMode,
      sshLastUser: user,
      sshLastSource: source,
    }
  };
}

function handlePasswordInput(state: SwitchState, password: string, language: 'tr' | 'en'): CommandResult {
  if (state.passwordContext === 'enable') {
    // Check if enable password is configured
    const hasEnablePassword = !!(state.security.enableSecret || state.security.enablePassword);
    
    if (!hasEnablePassword) {
      return {
        success: false,
        error: language === 'tr' ? '% Parola ayarlanmamış' : '% No password set',
        newState: {
          awaitingPassword: false,
          passwordContext: undefined
        }
      };
    }
    
    const validPassword = state.security.enableSecret
      ? password === state.security.enableSecret
      : state.security.enablePassword
        ? password === state.security.enablePassword
        : false;

    if (validPassword) {
      let output = '';
      // Display exec banner when entering privileged EXEC mode
      if (state.bannerExec) {
        output = `\n${state.bannerExec}\n`;
      }
      if (state.bannerMOTD) {
        output += `\n${state.bannerMOTD}\n\n`;
      }
      return {
        success: true,
        output,
        newState: {
          currentMode: 'privileged',
          awaitingPassword: false,
          passwordContext: undefined
        }
      };
    } else {
      return {
        success: false,
        error: language === 'tr' ? '% Erişim reddedildi' : '% Access denied',
        newState: {
          awaitingPassword: true,
          passwordContext: 'enable'
        }
      };
    }
  }

  if (state.passwordContext === 'console') {
    const validPassword = password === state.security.consoleLine.password;
    if (validPassword) {
      let output = '';
      if (state.bannerMOTD) {
        output = `\n${state.bannerMOTD}\n\n`;
      }
      const prompt = getPrompt(state);
      output += prompt;
      return {
        success: true,
        output,
        newState: {
          consoleAuthenticated: true,
          awaitingPassword: false,
          passwordContext: undefined
        }
      };
    } else {
      return {
        success: false,
        error: language === 'tr' ? '% Erişim reddedildi' : '% Access denied',
        newState: {
          awaitingPassword: true,
          passwordContext: 'console'
        }
      };
    }
  }

  if (state.passwordContext === 'vty') {
    const useLocalLogin = !!state.security?.vtyLines?.loginLocal;
    const configuredPassword = state.security.vtyLines.password || '';
    const rawUsers = state.security?.users;
    const configuredUsers: any[] = Array.isArray(rawUsers) ? rawUsers : Object.values(rawUsers || {}) as any[];
    const sshUsername = state.sshLastUser || '';
    const matchedUser: any | undefined = configuredUsers.find((user: any) => (user?.username || '').toLowerCase() === sshUsername.toLowerCase());
    const validPassword = useLocalLogin
      ? !!matchedUser && String(matchedUser.password || '') === password
      : password === configuredPassword;
    if (validPassword) {
      const sessionUser = state.sshLastUser || state.hostname || 'admin';
      const sessionSource = state.sshLastSource || 'vty0';
      const existingSessions = Array.isArray(state.sshSessions) ? state.sshSessions : [];
      const nextSessions = [
        ...existingSessions.filter((session) => session.source !== sessionSource),
        { user: sessionUser, source: sessionSource, state: 'established' }
      ];
      let output = '';
      if (state.bannerMOTD) {
        output = `\n${state.bannerMOTD}\n\n`;
      }
      const prompt = getPrompt(state);
      output += prompt;
      return {
        success: true,
        output,
        newState: {
          telnetAuthenticated: true,
          awaitingPassword: false,
          passwordContext: undefined,
          sshSessions: nextSessions,
          sshLastUser: sessionUser,
          sshLastSource: sessionSource,
        }
      };
    } else {
      return {
        success: false,
        error: language === 'tr' ? '% Erişim reddedildi' : '% Access denied',
        newState: {
          awaitingPassword: true,
          passwordContext: 'vty'
        }
      };
    }
  }

  return {
    success: false,
    error: '% Password error',
    newState: {
      awaitingPassword: true,
      passwordContext: state.passwordContext
    }
  };
}

// --- Placeholder command handlers map ---
// Combine all handler maps into one unified command registry
const commandHandlers: Record<string, CommandHandler> = {
  // System commands
  ...systemHandlers,

  // Show commands
  ...showHandlers,

  // Interface commands
  ...interfaceHandlers,

  // Global configuration commands
  ...globalConfigHandlers,

  // Router configuration commands (OSPF/RIP)
  ...routerConfigHandlers,

  // Line commands
  ...lineHandlers,

  // Privileged EXEC commands
  ...privilegedHandlers,

  // DHCP pool sub-commands
  ...dhcpConfigHandlers,
};


