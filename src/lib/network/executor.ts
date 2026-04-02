// Network Command Executor (refactored with handler map)
import { SwitchState, CommandMode, CommandResult } from './types';
import { checkConnectivity } from './connectivity';
import { addStaticRoute, removeStaticRoute, getRoutingTable } from './routing';
import { parseCommand, validateCommand, getHelpContent } from './parser';
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

// --- Inline help tree (kept as-is for now) ---
export const commandHelp: Record<string, Record<string, string[]>> = {
  user: {
    '': ['enable', 'exit', 'show', 'ipconfig', 'ping', 'telnet', 'ssh', 'tracert', 'traceroute', 'netstat', 'nbtstat', 'nslookup', 'http', 'arp', 'hostname', 'snake', '?', 'help'],
    'i': ['ipconfig'],
    'ip': ['ipconfig'],
    'p': ['ping'],
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
    'traceroute': [''],
    'tracert': [''],
    's': ['ssh', 'snake', 'show'],
    'sh': ['ssh', 'show'],
    'ssh': [''],
    'n': ['netstat', 'nbtstat', 'nslookup'],
    'ne': ['netstat'],
    'nb': ['nbtstat'],
    'ns': ['nslookup'],
    'h': ['http', 'hostname'],
    'a': ['arp'],
    'sn': ['snake', 'show'],
    'sho': ['show'],
    'show': ['version', 'wireless'],
  },
  privileged: {
    '': ['configure', 'disable', 'show', 'write', 'ping', 'telnet', 'ssh', 'tracert', 'traceroute', 'reload', 'exit', 'copy', 'erase', 'ip', '?', 'help'],
    'c': ['configure', 'clear', 'copy'],
    'co': ['configure', 'copy'],
    'con': ['configure'],
    'conf': ['configure'],
    'confi': ['configure'],
    'config': ['configure'],
    'configu': ['configure'],
    'configur': ['configure'],
    'configure': ['terminal'],
    'configure t': ['terminal'],
    'configure te': ['terminal'],
    'configure ter': ['terminal'],
    'configure term': ['terminal'],
    'configure termi': ['terminal'],
    'configure termin': ['terminal'],
    'configure termina': ['terminal'],

    'd': ['disable'],
    'di': ['disable'],
    'dis': ['disable'],
    'disa': ['disable'],
    'disab': ['disable'],
    'disabl': ['disable'],

    'sh': ['show'],
    'sho': ['show'],
    'show': ['running-config', 'interfaces', 'vlan', 'version', 'mac', 'cdp', 'ip', 'spanning-tree', 'port-security', 'wireless'],
    'show r': ['running-config'],
    'show ru': ['running-config'],
    'show run': ['running-config'],
    'show i': ['interfaces', 'ip'],
    'show in': ['interfaces'],
    'show int': ['interfaces'],
    'show v': ['vlan', 'version'],
    'show vl': ['vlan'],
    'show vla': ['vlan'],
    'show vlan': ['brief'],
    'show m': ['mac'],
    'show ma': ['mac'],
    'show mac': ['address-table'],
    'show c': ['cdp', 'clock'],
    'show cd': ['cdp'],
    'show cdp': ['neighbors'],
    'show ip': ['interface', 'route'],
    'show ip i': ['interface'],
    'show ip int': ['interface'],
    'show ip inte': ['interface'],
    'show ip interf': ['interface'],
    'show ip interfa': ['interface'],
    'show ip interfac': ['interface'],
    'show ip interface': ['brief'],
    'show ip r': ['route'],
    'show ip ro': ['route'],
    'show ip rou': ['route'],

    'ip': ['route', 'default-gateway', 'domain-name', 'ssh'],
    'ip r': ['route'],
    'ip ro': ['route'],
    'ip rou': ['route'],
    'ip rout': ['route'],

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

    'r': ['reload'],
    're': ['reload'],
    'rel': ['reload'],
    'relo': ['reload'],
    'reloa': ['reload'],

    'e': ['exit'],
    'ex': ['exit'],

    'copy': ['running-config'],
    'copy r': ['running-config'],
    'copy ru': ['running-config'],
    'copy run': ['running-config'],
    'copy runn': ['running-config'],
    'copy runni': ['running-config'],
    'copy runnin': ['running-config'],
    'copy running': ['running-config'],
    'copy running-': ['running-config'],
    'copy running-c': ['running-config'],
    'copy running-co': ['running-config'],
    'copy running-con': ['running-config'],
    'copy running-conf': ['running-config'],
    'copy running-confi': ['running-config'],
    'copy running-config': ['startup-config'],
    'copy running-config s': ['startup-config'],
    'copy running-config st': ['startup-config'],
    'copy running-config sta': ['startup-config'],
    'copy running-config star': ['startup-config'],
    'copy running-config start': ['startup-config'],
    'copy running-config startu': ['startup-config'],
    'copy running-config startup': ['startup-config'],
    'copy running-config startup-': ['startup-config'],
    'copy running-config startup-c': ['startup-config'],
    'copy running-config startup-co': ['startup-config'],
    'copy running-config startup-con': ['startup-config'],
    'copy running-config startup-conf': ['startup-config'],
    'copy running-config startup-confi': ['startup-config'],

    'erase': ['startup-config', 'nvram'],
    'erase s': ['startup-config'],
    'erase st': ['startup-config'],
    'erase sta': ['startup-config'],
    'erase star': ['startup-config'],
    'erase start': ['startup-config'],
    'erase startu': ['startup-config'],
    'erase startup': ['startup-config'],
    'erase startup-': ['startup-config'],
    'erase startup-c': ['startup-config'],
    'erase startup-co': ['startup-config'],
    'erase startup-con': ['startup-config'],
    'erase startup-conf': ['startup-config'],
    'erase startup-confi': ['startup-config'],
    'erase n': ['nvram'],
    'erase nv': ['nvram'],
    'erase nvr': ['nvram'],
    'erase nvra': ['nvram'],
  },
  config: {
    '': ['hostname', 'interface', 'vlan', 'enable', 'service', 'username', 'line', 'banner', 'ip', 'no', 'spanning-tree', 'vtp', 'cdp', 'exit', 'end', 'do', '?', 'help'],
    'h': ['hostname'],
    'ho': ['hostname'],
    'hos': ['hostname'],
    'host': ['hostname'],
    'hostn': ['hostname'],
    'hostna': ['hostname'],
    'hostnam': ['hostname'],

    'i': ['interface', 'ip'],
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

    'v': ['vlan'],
    'vl': ['vlan'],
    'vla': ['vlan'],
    'vlan': ['1', '10', '20', '30', '50', '100', '200'],

    'e': ['enable', 'end', 'exit'],
    'en': ['enable', 'end', 'encryption'],
    'ena': ['enable'],
    'enab': ['enable'],
    'enabl': ['enable'],
    'enable': ['secret', 'password'],
    'enc': ['encryption'],
    'encr': ['encryption'],
    'encry': ['encryption'],
    'encryption': ['open', 'wpa', 'wpa2', 'wpa3'],
    'enable s': ['secret'],
    'enable se': ['secret'],
    'enable sec': ['secret'],
    'enable p': ['password'],
    'enable pa': ['password'],
    'enable pas': ['password'],
    'enable pass': ['password'],

    'se': ['service'],
    'ser': ['service'],
    'serv': ['service'],
    'servi': ['service'],
    'servic': ['service'],
    'service': ['password-encryption'],

    'u': ['username'],
    'us': ['username'],
    'use': ['username'],
    'user': ['username'],
    'usern': ['username'],
    'userna': ['username'],
    'usernam': ['username'],

    'l': ['line'],
    'li': ['line'],
    'lin': ['line'],
    'line': ['console', 'vty'],
    'line c': ['console'],
    'line co': ['console'],
    'line con': ['console'],
    'line cons': ['console'],
    'line conso': ['console'],
    'line consol': ['console'],
    'line console': ['0'],
    'line console 0': [''],
    'line v': ['vty'],
    'line vt': ['vty'],
    'line vty': ['0'],
    'line vty 0': ['4'],
    'line vty 0 4': [''],

    'b': ['banner'],
    'ba': ['banner'],
    'ban': ['banner'],
    'bann': ['banner'],
    'banne': ['banner'],
    'banner': ['motd', 'login'],
    'banner m': ['motd'],
    'banner mo': ['motd'],
    'banner mot': ['motd'],
    'banner motd': [''],

    'ip': ['default-gateway', 'domain-name', 'ssh'],
    'ip d': ['default-gateway', 'domain-name'],
    'ip de': ['default-gateway'],
    'ip def': ['default-gateway'],
    'ip defa': ['default-gateway'],
    'ip defau': ['default-gateway'],
    'ip defaul': ['default-gateway'],
    'ip default': ['default-gateway'],
    'ip default-': ['default-gateway'],
    'ip default-g': ['default-gateway'],
    'ip default-ga': ['default-gateway'],
    'ip default-gat': ['default-gateway'],
    'ip default-gate': ['default-gateway'],
    'ip default-gatew': ['default-gateway'],
    'ip default-gatewa': ['default-gateway'],
    'ip do': ['domain-name'],
    'ip dom': ['domain-name'],
    'ip doma': ['domain-name'],
    'ip domain': ['domain-name'],
    'ip domain-': ['domain-name'],
    'ip domain-n': ['domain-name'],
    'ip domain-na': ['domain-name'],
    'ip domain-nam': ['domain-name'],
    'ip ssh': ['version'],
    'ip ssh v': ['version'],
    'ip ssh ve': ['version'],
    'ip ssh ver': ['version'],
    'ip ssh vers': ['version'],
    'ip ssh versi': ['version'],
    'ip ssh versio': ['version'],

    'n': ['no'],
    'no': ['shutdown', 'vlan', 'cdp', 'service', 'spanning-tree'],

    'sp': ['spanning-tree'],
    'spa': ['spanning-tree'],
    'span': ['spanning-tree'],
    'spann': ['spanning-tree'],
    'spanni': ['spanning-tree'],
    'spannin': ['spanning-tree'],
    'spanning': ['spanning-tree'],
    'spanning-': ['spanning-tree'],
    'spanning-t': ['spanning-tree'],
    'spanning-tr': ['spanning-tree'],
    'spanning-tre': ['spanning-tree'],
    'spanning-tree': ['mode', 'portfast'],
    'spanning-tree m': ['mode'],
    'spanning-tree mo': ['mode'],
    'spanning-tree mod': ['mode'],
    'spanning-tree mode': ['pvst', 'rapid-pvst', 'mst'],

    'vt': ['vtp'],
    'vtp': ['mode', 'domain'],
    'vtp m': ['mode'],
    'vtp mo': ['mode'],
    'vtp mod': ['mode'],
    'vtp mode': ['server', 'client', 'transparent'],
    'vtp d': ['domain'],
    'vtp do': ['domain'],
    'vtp dom': ['domain'],
    'vtp doma': ['domain'],
    'vtp domain': [''],

    'cd': ['cdp'],
    'cdp': ['run'],
    'cdp r': ['run'],
    'cdp ru': ['run'],

    'ex': ['exit'],
    'exi': ['exit'],

    'end': [''],

    'do': ['show', 'write', 'ping'],
    'do s': ['show'],
    'do sh': ['show'],
    'do sho': ['show'],
    'do show': ['running-config', 'interfaces', 'vlan', 'version'],
    'do w': ['write'],
    'do wr': ['write'],
    'do wri': ['write'],
    'do writ': ['write'],
    'do write': ['memory'],
  },
  interface: {
    '': ['shutdown', 'no', 'speed', 'duplex', 'description', 'switchport', 'cdp', 'spanning-tree', 'channel-group', 'ip', 'ssid', 'encryption', 'wifi-password', 'channel', 'wifi-mode', 'exit', 'end', 'do', '?', 'help'],
    's': ['shutdown', 'speed', 'spanning-tree', 'ssid'],
    'ss': ['ssid'],
    'ssi': ['ssid'],
    'ssid': ['<SSID>'],
    'en': ['encryption'],
    'enc': ['encryption'],
    'encr': ['encryption'],
    'encry': ['encryption'],
    'encryp': ['encryption'],
    'encryption': ['open', 'wpa', 'wpa2', 'wpa3'],
    'sh': ['shutdown'],
    'shu': ['shutdown'],
    'shut': ['shutdown'],
    'shutd': ['shutdown'],
    'shutdo': ['shutdown'],
    'shutdow': ['shutdown'],

    'sp': ['speed', 'spanning-tree'],
    'spe': ['speed'],
    'spee': ['speed'],
    'speed': ['10', '100', '1000', 'auto'],

    'd': ['duplex', 'description'],
    'du': ['duplex'],
    'dup': ['duplex'],
    'dupl': ['duplex'],
    'duple': ['duplex'],
    'duplex': ['half', 'full', 'auto'],

    'de': ['description'],
    'des': ['description'],
    'desc': ['description'],
    'descr': ['description'],
    'descri': ['description'],
    'descrip': ['description'],
    'descript': ['description'],
    'descripti': ['description'],
    'descriptio': ['description'],



    'i': ['ip'],
    'ip': ['address', 'helper-address', 'default-gateway'],
    'ip a': ['address'],
    'ip ad': ['address'],
    'ip add': ['address'],
    'ip addr': ['address'],
    'ip addre': ['address'],
    'ip address': [],
    'ip d': ['default-gateway'],
    'ip de': ['default-gateway'],
    'ip def': ['default-gateway'],
    'ip defa': ['default-gateway'],
    'ip defau': ['default-gateway'],
    'ip defaul': ['default-gateway'],
    'ip default': ['default-gateway'],
    'ip default-': ['default-gateway'],
    'ip default-g': ['default-gateway'],
    'ip default-ga': ['default-gateway'],
    'ip default-gat': ['default-gateway'],
    'ip default-gate': ['default-gateway'],
    'ip default-gatew': ['default-gateway'],
    'ip default-gatewa': ['default-gateway'],
    'ip default-gateway': [],

    'n': ['no'],
    'no': ['shutdown', 'switchport', 'cdp', 'description', 'speed', 'duplex', 'spanning-tree', 'ip'],
    'no s': ['shutdown', 'switchport', 'speed', 'spanning-tree'],
    'no sh': ['shutdown'],
    'no shu': ['shutdown'],
    'no shut': ['shutdown'],
    'no shutd': ['shutdown'],
    'no shutdo': ['shutdown'],
    'no shutdow': ['shutdown'],
    'no sw': ['switchport'],
    'no swi': ['switchport'],
    'no swit': ['switchport'],
    'no switc': ['switchport'],
    'no switch': ['switchport'],
    'no switchp': ['switchport'],
    'no switchpo': ['switchport'],
    'no switchpor': ['switchport'],
    'no switchport': ['mode', 'access', 'port-security'],
    'no i': ['ip'],
    'no ip': ['address', 'default-gateway'],
    'no ip a': ['address'],
    'no ip ad': ['address'],
    'no ip add': ['address'],
    'no ip addr': ['address'],
    'no ip addre': ['address'],
    'no ip address': [],
    'no ip d': ['default-gateway'],
    'no ip de': ['default-gateway'],
    'no ip def': ['default-gateway'],
    'no ip defa': ['default-gateway'],
    'no ip defau': ['default-gateway'],
    'no ip defaul': ['default-gateway'],
    'no ip default': ['default-gateway'],
    'no ip default-': ['default-gateway'],
    'no ip default-g': ['default-gateway'],
    'no ip default-ga': ['default-gateway'],
    'no ip default-gat': ['default-gateway'],
    'no ip default-gate': ['default-gateway'],
    'no ip default-gatew': ['default-gateway'],
    'no ip default-gatewa': ['default-gateway'],
    'no ip default-gateway': [],

    'sw': ['switchport'],
    'swi': ['switchport'],
    'swit': ['switchport'],
    'switc': ['switchport'],
    'switch': ['switchport'],
    'switchp': ['switchport'],
    'switchpo': ['switchport'],
    'switchpor': ['switchport'],
    'switchport': ['mode', 'access', 'trunk', 'port-security', 'voice', 'nonegotiate'],
    'switchport m': ['mode'],
    'switchport mo': ['mode'],
    'switchport mod': ['mode'],
    'switchport mode': ['access', 'trunk'],
    'switchport a': ['access'],
    'switchport ac': ['access'],
    'switchport acc': ['access'],
    'switchport acce': ['access'],
    'switchport acces': ['access'],
    'switchport access': ['vlan'],
    'switchport access v': ['vlan'],
    'switchport access vl': ['vlan'],
    'switchport access vlan': ['1', '10', '20', '30', '50', '100'],
    'switchport t': ['trunk'],
    'switchport tr': ['trunk'],
    'switchport tru': ['trunk'],
    'switchport trun': ['trunk'],
    'switchport trunk': ['allowed', 'native', 'encapsulation'],
    'switchport trunk a': ['allowed'],
    'switchport trunk al': ['allowed'],
    'switchport trunk all': ['allowed'],
    'switchport trunk allo': ['allowed'],
    'switchport trunk allow': ['allowed'],
    'switchport trunk allowe': ['allowed'],
    'switchport trunk allowed': ['vlan'],
    'switchport trunk allowed v': ['vlan'],
    'switchport trunk allowed vl': ['vlan'],
    'switchport trunk allowed vlan': ['all', 'add', 'remove', '1,2,10,20'],
    'switchport p': ['port-security'],
    'switchport po': ['port-security'],
    'switchport por': ['port-security'],
    'switchport port': ['port-security'],
    'switchport port-': ['port-security'],
    'switchport port-s': ['port-security'],
    'switchport port-se': ['port-security'],
    'switchport port-sec': ['port-security'],
    'switchport port-secu': ['port-security'],
    'switchport port-secur': ['port-security'],
    'switchport port-securi': ['port-security'],
    'switchport port-securit': ['port-security'],
    'switchport port-security': ['maximum', 'violation', 'mac-address'],
    'switchport port-security m': ['maximum'],
    'switchport port-security ma': ['maximum'],
    'switchport port-security max': ['maximum'],
    'switchport port-security maxi': ['maximum'],
    'switchport port-security maxim': ['maximum'],
    'switchport port-security maximu': ['maximum'],
    'switchport port-security maximum': ['1', '2', '3', '5', '10'],
    'switchport port-security v': ['violation'],
    'switchport port-security vi': ['violation'],
    'switchport port-security vio': ['violation'],
    'switchport port-security viol': ['violation'],
    'switchport port-security viola': ['violation'],
    'switchport port-security violat': ['violation'],
    'switchport port-security violati': ['violation'],
    'switchport port-security violatio': ['violation'],
    'switchport port-security violation': ['protect', 'restrict', 'shutdown'],
    'switchport port-security mac': ['mac-address'],
    'switchport port-security mac-': ['mac-address'],
    'switchport port-security mac-a': ['mac-address'],
    'switchport port-security mac-ad': ['mac-address'],
    'switchport port-security mac-addr': ['mac-address'],
    'switchport port-security mac-addre': ['mac-address'],
    'switchport port-security mac-addres': ['mac-address'],
    'switchport port-security mac-address': ['sticky', '<MAC>'],
    'switchport port-security mac-address s': ['sticky'],
    'switchport port-security mac-address st': ['sticky'],
    'switchport port-security mac-address sti': ['sticky'],
    'switchport port-security mac-address stick': ['sticky'],
    'switchport port-security mac-address sticky': [''],

    'cd': ['cdp'],
    'cdp': ['enable'],
    'cdp e': ['enable'],
    'cdp en': ['enable'],
    'cdp ena': ['enable'],
    'cdp enab': ['enable'],
    'cdp enabl': ['enable'],

    'spanning': ['spanning-tree'],
    'spanning-': ['spanning-tree'],
    'spanning-t': ['spanning-tree'],
    'spanning-tr': ['spanning-tree'],
    'spanning-tre': ['spanning-tree'],
    'spanning-tree': ['portfast', 'bpduguard', 'cost', 'priority'],
    'spanning-tree p': ['portfast'],
    'spanning-tree po': ['portfast'],
    'spanning-tree por': ['portfast'],
    'spanning-tree port': ['portfast'],
    'spanning-tree portf': ['portfast'],
    'spanning-tree portfa': ['portfast'],
    'spanning-tree portfas': ['portfast'],
    'spanning-tree portfast': [''],
    'spanning-tree b': ['bpduguard'],
    'spanning-tree bp': ['bpduguard'],
    'spanning-tree bpd': ['bpduguard'],
    'spanning-tree bpdu': ['bpduguard'],
    'spanning-tree bpdug': ['bpduguard'],
    'spanning-tree bpdugu': ['bpduguard'],
    'spanning-tree bpdugua': ['bpduguard'],
    'spanning-tree bpduguar': ['bpduguard'],
    'spanning-tree bpduguard': ['enable', 'disable'],

    'ch': ['channel-group'],
    'cha': ['channel-group'],
    'chan': ['channel-group'],
    'chann': ['channel-group'],
    'channe': ['channel-group'],
    'channel': ['channel-group'],
    'channel-': ['channel-group'],
    'channel-g': ['channel-group'],
    'channel-gr': ['channel-group'],
    'channel-gro': ['channel-group'],
    'channel-grou': ['channel-group'],
    'channel-group': ['1', '2'],
    'channel-group 1': ['mode'],
    'channel-group 1 m': ['mode'],
    'channel-group 1 mo': ['mode'],
    'channel-group 1 mod': ['mode'],
    'channel-group 1 mode': ['active', 'passive', 'on', 'desirable', 'auto'],

    'wifi-p': ['password'],
    'wifi-pa': ['password'],
    'wifi-pas': ['password'],
    'wifi-pass': ['password'],
    'wifi-passw': ['password'],
    'wifi-passwo': ['password'],
    'wifi-password': ['<password>'],
    'wifi-c': ['channel'],
    'wifi-ch': ['channel'],
    'wifi-cha': ['channel'],
    'wifi-chan': ['channel'],
    'wifi-chann': ['channel'],
    'wifi-channe': ['channel'],
    'wifi-channel': ['2.4GHz', '5GHz'],
    'wifi-m': ['mode'],
    'wifi-mo': ['mode'],
    'wifi-mod': ['mode'],
    'wifi-mode': ['ap', 'client', 'disabled'],

    'ex': ['exit'],
    'exi': ['exit'],

    'end': [''],

    'do': ['show', 'write', 'ping'],
    'do s': ['show'],
    'do sh': ['show'],
    'do sho': ['show'],
    'do show': ['running-config', 'interfaces', 'vlan'],
  },
  line: {
    '': ['password', 'login', 'transport', 'exec-timeout', 'logging', 'history', 'privilege', 'exit', 'end', 'do', '?', 'help'],
    'p': ['password'],
    'pa': ['password'],
    'pas': ['password'],
    'pass': ['password'],
    'passw': ['password'],
    'passwo': ['password'],
    'passwor': ['password'],

    'l': ['login', 'logging'],
    'lo': ['login', 'logging'],
    'log': ['login', 'logging'],
    'logi': ['login'],
    'login': ['', 'local'],
    'login l': ['local'],
    'login lo': ['local'],
    'login loc': ['local'],
    'login loca': ['local'],

    'logg': ['logging'],
    'loggi': ['logging'],
    'loggin': ['logging'],
    'logging': ['synchronous'],
    'logging s': ['synchronous'],
    'logging sy': ['synchronous'],
    'logging syn': ['synchronous'],
    'logging sync': ['synchronous'],
    'logging synch': ['synchronous'],
    'logging synchr': ['synchronous'],
    'logging synchro': ['synchronous'],
    'logging synchron': ['synchronous'],
    'logging synchrono': ['synchronous'],
    'logging synchronou': ['synchronous'],
    'logging synchronous': [''],

    't': ['transport'],
    'tr': ['transport'],
    'tra': ['transport'],
    'tran': ['transport'],
    'trans': ['transport'],
    'transp': ['transport'],
    'transpo': ['transport'],
    'transpor': ['transport'],
    'transport': ['input', 'output'],
    'transport i': ['input'],
    'transport in': ['input'],
    'transport inp': ['input'],
    'transport inpu': ['input'],
    'transport input': ['ssh', 'telnet', 'all', 'none'],

    'e': ['exec-timeout', 'exit', 'end'],
    'ex': ['exec-timeout', 'exit'],
    'exe': ['exec-timeout'],
    'exec': ['exec-timeout'],
    'exec-': ['exec-timeout'],
    'exec-t': ['exec-timeout'],
    'exec-ti': ['exec-timeout'],
    'exec-tim': ['exec-timeout'],
    'exec-time': ['exec-timeout'],
    'exec-timeo': ['exec-timeout'],
    'exec-timeou': ['exec-timeout'],
    'exec-timeout': ['<minutes>', '0'],

    'h': ['history'],
    'hi': ['history'],
    'his': ['history'],
    'hist': ['history'],
    'histo': ['history'],
    'histor': ['history'],
    'history': ['size'],
    'history s': ['size'],
    'history si': ['size'],
    'history siz': ['size'],

    'pr': ['privilege'],
    'pri': ['privilege'],
    'priv': ['privilege'],
    'prive': ['privilege'],
    'privl': ['privilege'],
    'privil': ['privilege'],
    'privile': ['privilege'],
    'privileg': ['privilege'],
    'privilege': ['level'],
    'privilege l': ['level'],
    'privilege le': ['level'],
    'privilege lev': ['level'],
    'privilege leve': ['level'],
    'privilege level': ['0', '1', '15'],

    'exit': [''],
    'end': [''],

    'do': ['show'],
    'do s': ['show'],
    'do sh': ['show'],
    'do sho': ['show'],
    'do show': ['running-config'],
  },
  vlan: {
    '': ['name', 'state', 'exit', 'end', '?', 'help'],
    'n': ['name'],
    'na': ['name'],
    'nam': ['name'],
    'name': [''],

    'st': ['state'],
    'sta': ['state'],
    'stat': ['state'],
    'state': ['active', 'suspend'],

    'exit': [''],
    'end': [''],
  },
  'router-config': {
    '': ['network', 'router-id', 'passive-interface', 'default-information', 'exit', 'end', '?', 'help'],
    'n': ['network'],
    'ne': ['network'],
    'net': ['network'],
    'netw': ['network'],
    'netwo': ['network'],
    'networ': ['network'],
    'network': [''],

    'r': ['router-id'],
    'ro': ['router-id'],
    'rou': ['router-id'],
    'rout': ['router-id'],
    'route': ['router-id'],
    'router': ['router-id'],
    'router-': ['router-id'],
    'router-i': ['router-id'],
    'router-id': ['<ip-address>'],

    'p': ['passive-interface'],
    'pa': ['passive-interface'],
    'pas': ['passive-interface'],
    'pass': ['passive-interface'],
    'passi': ['passive-interface'],
    'passiv': ['passive-interface'],
    'passive': ['passive-interface'],
    'passive-': ['passive-interface'],
    'passive-i': ['passive-interface'],
    'passive-interface': ['FastEthernet', 'GigabitEthernet'],

    'd': ['default-information'],
    'de': ['default-information'],
    'def': ['default-information'],
    'defa': ['default-information'],
    'defau': ['default-information'],
    'defaul': ['default-information'],
    'default': ['default-information'],
    'default-': ['default-information'],
    'default-i': ['default-information'],
    'default-information': ['originate'],

    'ex': ['exit'],
    'exi': ['exit'],
    'exit': [''],
    'end': [''],
  },
};

function getInlineHelp(mode: CommandMode, partialInput: string, prompt: string): string {
  const modeCommands = commandHelp[mode] || commandHelp.user;
  const lower = partialInput.toLowerCase().trim();

  let suggestions: string[] = [];

  if (modeCommands[lower]) {
    suggestions = modeCommands[lower];
  } else {
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

  const lines: string[] = [];
  lines.push(prompt + partialInput + '?');
  lines.push('');

  if (suggestions.length === 0) {
    lines.push('% Ambiguous command:  "' + partialInput + '"');
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
    if (state.awaitingReloadConfirm) {
      if (input === '__RELOAD_CONFIRM__') {
        // treat as confirm
        return privilegedHandlers['reload'](state, 'confirm', { language, devices, connections, deviceStates: deviceStates || new Map() });
      } else {
        // treat as cancel
        return privilegedHandlers['reload'](state, 'no', { language, devices, connections, deviceStates: deviceStates || new Map() });
      }
    }
    // If not awaiting confirmation, ignore as unknown
    return { success: false, error: '% Unknown command' };
  }

  if (input === '__TELNET_CONNECT__') {
    return handleTelnetConnect(state, language);
  }

  if (state.awaitingPassword) {
    if (input === '__PASSWORD_CANCELLED__') {
      // Password dialog was cancelled (ESC, back, outside click)
      return {
        success: false,
        error: language === 'tr' ? '% Erişim reddedildi' : '% Access denied',
        newState: {
          awaitingPassword: false,
          passwordContext: undefined
        }
      };
    }
    return handlePasswordInput(state, input, language);
  }

  let cmdToProcess = input.trim();
  const lowerInput = cmdToProcess.toLowerCase();

  // If we're awaiting a reload confirmation, handle confirmation/cancellation directly
  if (state.awaitingReloadConfirm) {
    const confirmInputs = ['', 'confirm', 'y', 'n', 'no'];
    if (confirmInputs.includes(lowerInput)) {
      // call the reload handler directly to avoid normal parsing/routing
      const result = privilegedHandlers['reload'](state, cmdToProcess, { language, devices, connections, deviceStates: deviceStates || new Map() });
      return result;
    }
    // For any other input, clear awaiting flag and return invalid-confirmation result
    return {
      success: false,
      error: '% Invalid input during reload confirmation. Use "confirm" to proceed or "no" to cancel.',
      newState: { awaitingReloadConfirm: false }
    };
  }

  if (state.currentMode === 'privileged') {
    if (lowerInput === 'conf t') cmdToProcess = 'configure terminal';
    if (lowerInput.startsWith('sh ip int br')) cmdToProcess = 'show ip interface brief';
    if (lowerInput.startsWith('sh run')) cmdToProcess = 'show running-config';
    if (lowerInput.startsWith('sh ip ro')) cmdToProcess = 'show ip route';
    if (lowerInput === 'wr') cmdToProcess = 'write memory';
  } else if (state.currentMode === 'user') {
    if (lowerInput === 'en') cmdToProcess = 'enable';
  } else if (state.currentMode === 'config') {
    if (lowerInput.startsWith('int fa')) cmdToProcess = cmdToProcess.replace(/int fa/i, 'interface fastethernet');
    if (lowerInput.startsWith('int gi')) cmdToProcess = cmdToProcess.replace(/int gi/i, 'interface gigabitethernet');
    if (lowerInput.startsWith('int vlan')) cmdToProcess = cmdToProcess.replace(/int vlan/i, 'interface vlan');
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

  const validation = validateCommand(parsed, state.currentMode);

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
    // Cisco ISR Router boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2011 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2011 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device`;
  } else if (isL3Switch) {
    // Cisco 3560 L3 Switch boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 12.2(55r)SE, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2011 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 12.2(55r)SE, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2011 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device`;
  } else {
    // Cisco 2960 L2 Switch boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 12.2(11r)EA1, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2010 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 12.2(11r)EA1, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2010 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device`;
  }

  output += `${bootMessages}\n`;

  // Display banner MOTD next
  if (state.bannerMOTD) {
    output += `\n${state.bannerMOTD}\n`;
  }

  output += `\nReady!\n\n`;

  if (!needsLogin) {
    const prompt = getPrompt(state);
    output += prompt;
    return {
      success: true,
      output,
      newState: { consoleAuthenticated: true }
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
    // Cisco ISR Router boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2011 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2011 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device`;
  } else if (isL3Switch) {
    // Cisco 3560 L3 Switch boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 12.2(55r)SE, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2011 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 12.2(55r)SE, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2011 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device`;
  } else {
    // Cisco 2960 L2 Switch boot sequence
    const syslog = language === 'tr' ? '*** Syslog istemcisi başlatıldı' : '*** Syslog client started';
    bootMessages = language === 'tr' ?
      `System Bootstrap, Version 12.2(11r)EA1, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2010 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device` :
      `System Bootstrap, Version 12.2(11r)EA1, RELEASE SOFTWARE (fc1)
Technical Support: http://yunus.sf.net
Copyright (c) 1994-2010 by Network Systems, Inc.
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
  ######################################################################################################################################### [OK]
  0 bytes remaining in flash device`;
  }

  output += `${bootMessages}\n`;

  if (!needsLogin) {
    // Display banner MOTD for open access
    if (state.bannerMOTD) {
      output += `\n${state.bannerMOTD}\n`;
    }
    output += `\nReady!\n\n`;
    const prompt = getPrompt(state);
    output += prompt;
    return {
      success: true,
      output,
      newState: { telnetAuthenticated: true }
    };
  }

  // Display banner MOTD before login prompt
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

function handlePasswordInput(state: SwitchState, password: string, language: 'tr' | 'en'): CommandResult {
  if (state.passwordContext === 'enable') {
    const validPassword = state.security.enableSecret
      ? password === state.security.enableSecret
      : state.security.enablePassword
        ? password === state.security.enablePassword
        : true;

    if (validPassword) {
      let output = '';
      if (state.bannerMOTD) {
        output = `\n${state.bannerMOTD}\n\n`;
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
    const validPassword = password === state.security.vtyLines.password;
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
          telnetAuthenticated: true,
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
};


