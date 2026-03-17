// Network Command Parser
import { CommandMode, ParsedCommand } from './types';
import { commandAliases } from './initialState';

// Komut yapıları
interface CommandPattern {
  pattern: RegExp;
  modes: CommandMode[];
  minArgs: number;
  maxArgs: number;
}

// Desteklenen komutlar ve pattern'leri
const commandPatterns: Record<string, CommandPattern> = {
  // Mode değiştirme komutları
  'enable': {
    pattern: /^enable$/i,
    modes: ['user'],
    minArgs: 0,
    maxArgs: 0
  },
  'disable': {
    pattern: /^disable$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'configure terminal': {
    pattern: /^conf(?:igure)?(?:\s+t(?:erminal)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'exit': {
    pattern: /^(exit|quit)$/i,
    modes: ['privileged', 'config', 'interface', 'line', 'vlan'],
    minArgs: 0,
    maxArgs: 0
  },
  'end': {
    pattern: /^end$/i,
    modes: ['config', 'interface', 'line', 'vlan'],
    minArgs: 0,
    maxArgs: 0
  },
  'abort': {
    pattern: /^abort$/i,
    modes: ['config', 'interface', 'line', 'vlan'],
    minArgs: 0,
    maxArgs: 0
  },

  // Global config komutları
  'hostname': {
    pattern: /^hostname\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'vlan': {
    pattern: /^vlan\s+(\d+)(\s+name\s+(.+))?$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 3
  },
  'no vlan': {
    pattern: /^no\s+vlan\s+(\d+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'enable secret': {
    pattern: /^enable\s+(secret|password)\s+(.+)$/i,
    modes: ['config'],
    minArgs: 2,
    maxArgs: 2
  },
  'enable password': {
    pattern: /^enable\s+password\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'service password-encryption': {
    pattern: /^service\s+password-encryption$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'no service password-encryption': {
    pattern: /^no\s+service\s+password-encryption$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'username': {
    pattern: /^username\s+(\S+)(\s+(privilege\s+\d+|password|secret)\s+(.+))?$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 4
  },
  'no username': {
    pattern: /^no\s+username\s+(\S+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'banner motd': {
    pattern: /^banner\s+motd\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'no banner motd': {
    pattern: /^no\s+banner\s+motd$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'banner login': {
    pattern: /^banner\s+login\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'ip domain-name': {
    pattern: /^ip\s+domain-name\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'ip domain lookup': {
    pattern: /^ip\s+domain\s+lookup$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'no ip domain lookup': {
    pattern: /^no\s+ip\s+domain\s+lookup$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'ipv6 unicast-routing': {
    pattern: /^ipv6\s+unicast-routing$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'ip name-server': {
    pattern: /^ip\s+name-server\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'ip default-gateway': {
    pattern: /^ip\s+default-gateway\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'ip routing': {
    pattern: /^ip\s+routing$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'no ip routing': {
    pattern: /^no\s+ip\s+routing$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'ip ssh version': {
    pattern: /^ip\s+ssh\s+version\s+(1|2)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'ip ssh authentication-retries': {
    pattern: /^ip\s+ssh\s+authentication-retries\s+(\d+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'ip ssh time-out': {
    pattern: /^ip\s+ssh\s+time-out\s+(\d+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'crypto key generate rsa': {
    pattern: /^crypto\s+key\s+generate\s+rsa(\s+modulus\s+(\d+))?$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 2
  },
  'cdp run': {
    pattern: /^cdp\s+run$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'no cdp run': {
    pattern: /^no\s+cdp\s+run$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'cdp timer': {
    pattern: /^cdp\s+timer\s+(\d+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'cdp holdtime': {
    pattern: /^cdp\s+holdtime\s+(\d+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'vtp mode': {
    pattern: /^vtp\s+mode\s+(server|client|transparent|off)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'vtp domain': {
    pattern: /^vtp\s+domain\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'vtp password': {
    pattern: /^vtp\s+password\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'spanning-tree mode': {
    pattern: /^spanning-tree\s+mode\s+(pvst|rapid-pvst|mst)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'spanning-tree vlan': {
    pattern: /^spanning-tree\s+vlan\s+(\d+)(\s+priority\s+(\d+))?$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 3
  },
  'spanning-tree portfast': {
    pattern: /^spanning-tree\s+portfast(\s+(default|edge|bpduguard\s+(enable|disable)))?$/i,
    modes: ['config', 'interface'],
    minArgs: 0,
    maxArgs: 2
  },
  'spanning-tree bpduguard': {
    pattern: /^spanning-tree\s+bpduguard\s+(enable|disable)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'no spanning-tree': {
    pattern: /^no\s+spanning-tree(\s+vlan\s+(\d+))?$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 2
  },
  'errdisable recovery': {
    pattern: /^errdisable\s+recovery\s+(cause|interval)\s+(.+)$/i,
    modes: ['config'],
    minArgs: 2,
    maxArgs: 2
  },
  'errdisable recovery cause': {
    pattern: /^errdisable\s+recovery\s+cause\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'mls qos': {
    pattern: /^mls\s+qos$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'no mls qos': {
    pattern: /^no\s+mls\s+qos$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'ip dhcp snooping': {
    pattern: /^ip\s+dhcp\s+snooping$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'ip dhcp snooping vlan': {
    pattern: /^ip\s+dhcp\s+snooping\s+vlan\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'no ip dhcp snooping': {
    pattern: /^no\s+ip\s+dhcp\s+snooping$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'ip arp inspection': {
    pattern: /^ip\s+arp\s+inspection\s+vlan\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'system mtu': {
    pattern: /^system\s+mtu\s+(\d+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'sdm prefer': {
    pattern: /^sdm\s+prefer\s+(default|dual-ipv4-and-ipv6|lanbase-routing|qos)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'snmp-server community': {
    pattern: /^snmp-server\s+community\s+(\S+)(\s+(RO|RW))?$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 2
  },
  'snmp-server contact': {
    pattern: /^snmp-server\s+contact\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'snmp-server location': {
    pattern: /^snmp-server\s+location\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'ntp server': {
    pattern: /^ntp\s+server\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'clock timezone': {
    pattern: /^clock\s+timezone\s+(\S+)\s+([+-]?\d+)(:\d+)?$/i,
    modes: ['config'],
    minArgs: 2,
    maxArgs: 3
  },
  'archive': {
    pattern: /^archive$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'alias': {
    pattern: /^alias\s+(exec|configure|interface|line)\s+(\S+)\s+(.+)$/i,
    modes: ['config'],
    minArgs: 3,
    maxArgs: 3
  },
  'macro': {
    pattern: /^macro\s+(name|global|auto\s+(execute|processing))\s+(.+)$/i,
    modes: ['config', 'interface'],
    minArgs: 2,
    maxArgs: 3
  },
  
  // Interface komutları - interface range ÖNCE gelmeli (daha spesifik)
  'interface range': {
    pattern: /^interface\s+r(?:ange)?\s+(?:(?:fa|fastethernet|gi|gigabitethernet|e|ethernet|po|port-channel|vlan)\s*)?(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'interface': {
    pattern: /^interface\s+(?!r(?:ange)?\s)(fa|fastethernet|gi|gigabitethernet|e|ethernet|po|port-channel|vlan)?\s*(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 2
  },
  'default interface': {
    pattern: /^default\s+interface\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'no interface': {
    pattern: /^no\s+interface\s+(.+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  'ipv6 address': {
    pattern: /^ipv6\s+address\s+([0-9a-f:]+)\/(\d+)$/i,
    modes: ['interface'],
    minArgs: 2,
    maxArgs: 2
  },
  'no shutdown': {
    pattern: /^no\s+shutdown$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'shutdown': {
    pattern: /^shutdown$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'speed': {
    pattern: /^speed\s+(10|100|1000|2500|5000|10000|auto)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'duplex': {
    pattern: /^duplex\s+(half|full|auto)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'description': {
    pattern: /^description\s+(.+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'no description': {
    pattern: /^no\s+description$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'switchport mode': {
    pattern: /^switchport\s+mode\s+(access|trunk|dynamic\s+(auto|desirable)|dot1q-tunnel)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 2
  },
  'no switchport mode': {
    pattern: /^no\s+switchport\s+mode$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'switchport access vlan': {
    pattern: /^switchport\s+access\s+vlan\s+(\d+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'no switchport access vlan': {
    pattern: /^no\s+switchport\s+access\s+vlan$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'switchport trunk allowed vlan': {
    pattern: /^switchport\s+trunk\s+allowed\s+vlan\s+(.+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'switchport trunk native vlan': {
    pattern: /^switchport\s+trunk\s+native\s+vlan\s+(\d+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'switchport trunk encapsulation': {
    pattern: /^switchport\s+trunk\s+encapsulation\s+(dot1q|isl|negotiate)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'encapsulation dot1q': {
    pattern: /^encapsulation\s+dot1q\s+(\d+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'switchport nonegotiate': {
    pattern: /^switchport\s+nonegotiate$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'switchport protected': {
    pattern: /^switchport\s+protected$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'switchport block': {
    pattern: /^switchport\s+block\s+(unicast|multicast)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'switchport port-security': {
    pattern: /^switchport\s+port-security$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'no switchport port-security': {
    pattern: /^no\s+switchport\s+port-security$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'switchport port-security maximum': {
    pattern: /^switchport\s+port-security\s+maximum\s+(\d+)(\s+vlan\s+(.+))?$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 3
  },
  'switchport port-security violation': {
    pattern: /^switchport\s+port-security\s+violation\s+(protect|restrict|shutdown)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'switchport port-security mac-address': {
    pattern: /^switchport\s+port-security\s+mac-address\s+(.+?)(\s+vlan\s+(\d+))?$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 3
  },
  'switchport port-security mac-address sticky': {
    pattern: /^switchport\s+port-security\s+mac-address\s+sticky$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'switchport voice vlan': {
    pattern: /^switchport\s+voice\s+vlan\s+(\d+|dot1p|none|untagged)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'switchport voice': {
    pattern: /^switchport\s+voice\s+(.+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'cdp enable': {
    pattern: /^cdp\s+enable$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'no cdp enable': {
    pattern: /^no\s+cdp\s+enable$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'channel-group': {
    pattern: /^channel-group\s+(\d+)(\s+mode\s+(on|active|passive|desirable|auto))?$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 3
  },
  'no channel-group': {
    pattern: /^no\s+channel-group\s+(\d+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'channel-protocol': {
    pattern: /^channel-protocol\s+(lacp|pagp)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'storm-control': {
    pattern: /^storm-control\s+(broadcast|multicast|unicast)\s+level\s+(.+)$/i,
    modes: ['interface'],
    minArgs: 2,
    maxArgs: 2
  },
  'storm-control action': {
    pattern: /^storm-control\s+action\s+(shutdown|trap)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'udld enable': {
    pattern: /^udld\s+enable$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'udld port': {
    pattern: /^udld\s+port(\s+aggressive)?$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 1
  },
  'no udld': {
    pattern: /^no\s+udld(\s+(enable|port))?$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 1
  },
  'mls qos trust': {
    pattern: /^mls\s+qos\s+trust\s+(cos|dscp|ip-precedence)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'mls qos cos': {
    pattern: /^mls\s+qos\s+cos\s+(\d+)(\s+override)?$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 2
  },
  'priority-queue out': {
    pattern: /^priority-queue\s+out$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'queue-set': {
    pattern: /^queue-set\s+(\d+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'tx-queue': {
    pattern: /^tx-queue\s+(\d+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'power inline': {
    pattern: /^power\s+inline\s+(auto|static|never)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'power inline consumption': {
    pattern: /^power\s+inline\s+consumption\s+(\d+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'ip address': {
    pattern: /^ip\s+address\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(\s+secondary)?$/i,
    modes: ['interface'],
    minArgs: 2,
    maxArgs: 3
  },
  'no ip address': {
    pattern: /^no\s+ip\s+address$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'ip helper-address': {
    pattern: /^ip\s+helper-address\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'ip directed-broadcast': {
    pattern: /^ip\s+directed-broadcast$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'ip proxy-arp': {
    pattern: /^ip\s+proxy-arp$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'no ip proxy-arp': {
    pattern: /^no\s+ip\s+proxy-arp$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'ip verify source': {
    pattern: /^ip\s+verify\s+source(\s+vlan\s+dhcp-snooping)?$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 2
  },
  'ip dhcp snooping trust': {
    pattern: /^ip\s+dhcp\s+snooping\s+trust$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'no ip dhcp snooping trust': {
    pattern: /^no\s+ip\s+dhcp\s+snooping\s+trust$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'ip arp inspection trust': {
    pattern: /^ip\s+arp\s+inspection\s+trust$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'no ip arp inspection trust': {
    pattern: /^no\s+ip\s+arp\s+inspection\s+trust$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'ip arp inspection limit': {
    pattern: /^ip\s+arp\s+inspection\s+limit\s+(rate\s+\d+|none)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 2
  },
  'keepalive': {
    pattern: /^keepalive(\s+(\d+))?$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 1
  },
  'no keepalive': {
    pattern: /^no\s+keepalive$/i,
    modes: ['interface'],
    minArgs: 0,
    maxArgs: 0
  },
  'carrier-delay': {
    pattern: /^carrier-delay\s+(\d+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'bandwidth': {
    pattern: /^bandwidth\s+(\d+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'delay': {
    pattern: /^delay\s+(\d+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  'load-interval': {
    pattern: /^load-interval\s+(\d+)$/i,
    modes: ['interface'],
    minArgs: 1,
    maxArgs: 1
  },
  
  // VLAN config komutları
  'name': {
    pattern: /^name\s+(.+)$/i,
    modes: ['vlan'],
    minArgs: 1,
    maxArgs: 1
  },
  'no name': {
    pattern: /^no\s+name$/i,
    modes: ['vlan'],
    minArgs: 0,
    maxArgs: 0
  },
  'state': {
    pattern: /^state\s+(active|suspend)$/i,
    modes: ['vlan'],
    minArgs: 1,
    maxArgs: 1
  },
  
  // Line komutları
  'line console': {
    pattern: /^line\s+console\s+0$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'line vty': {
    pattern: /^line\s+vty\s+(\d+)\s+(\d+)$/i,
    modes: ['config'],
    minArgs: 2,
    maxArgs: 2
  },
  'line aux': {
    pattern: /^line\s+aux\s+0$/i,
    modes: ['config'],
    minArgs: 0,
    maxArgs: 0
  },
  'line': {
    pattern: /^line\s+(\S+)(\s+(\d+)(\s+(\d+))?)?$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 4
  },
  'password': {
    pattern: /^password\s+(.+)$/i,
    modes: ['line'],
    minArgs: 1,
    maxArgs: 1
  },
  'no password': {
    pattern: /^no\s+password$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 0
  },
  'login': {
    pattern: /^login(\s+local)?$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 1
  },
  'no login': {
    pattern: /^no\s+login$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 0
  },
  'transport input': {
    pattern: /^transport\s+input\s+(ssh|telnet|all|none)(\s+(ssh|telnet|all|none))*$/i,
    modes: ['line'],
    minArgs: 1,
    maxArgs: 4
  },
  'transport output': {
    pattern: /^transport\s+output\s+(ssh|telnet|all|none)(\s+(ssh|telnet|all|none))*$/i,
    modes: ['line'],
    minArgs: 1,
    maxArgs: 4
  },
  'no transport input': {
    pattern: /^no\s+transport\s+input$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 0
  },
  'transport preferred': {
    pattern: /^transport\s+preferred\s+(ssh|telnet|none)$/i,
    modes: ['line'],
    minArgs: 1,
    maxArgs: 1
  },
  'exec-timeout': {
    pattern: /^exec-timeout\s+(\d+)\s+(\d+)$/i,
    modes: ['line'],
    minArgs: 2,
    maxArgs: 2
  },
  'no exec-timeout': {
    pattern: /^no\s+exec-timeout$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 0
  },
  'logging synchronous': {
    pattern: /^logging\s+synchronous$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 0
  },
  'no logging synchronous': {
    pattern: /^no\s+logging\s+synchronous$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 0
  },
  'history size': {
    pattern: /^history\s+size\s+(\d+)$/i,
    modes: ['line'],
    minArgs: 1,
    maxArgs: 1
  },
  'history': {
    pattern: /^history(\s+(enable|disable))?$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 1
  },
  'no history': {
    pattern: /^no\s+history$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 0
  },
  'privilege level': {
    pattern: /^privilege\s+level\s+(\d+)$/i,
    modes: ['line'],
    minArgs: 1,
    maxArgs: 1
  },
  'access-class': {
    pattern: /^access-class\s+(\d+)\s+(in|out)$/i,
    modes: ['line'],
    minArgs: 2,
    maxArgs: 2
  },
  'session-limit': {
    pattern: /^session-limit\s+(\d+)$/i,
    modes: ['line'],
    minArgs: 1,
    maxArgs: 1
  },
  'no exec': {
    pattern: /^no\s+exec$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 0
  },
  'exec': {
    pattern: /^exec$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 0
  },
  'autocommand': {
    pattern: /^autocommand\s+(.+)$/i,
    modes: ['line'],
    minArgs: 1,
    maxArgs: 1
  },
  'no autocommand': {
    pattern: /^no\s+autocommand$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 0
  },
  'lockable': {
    pattern: /^lockable$/i,
    modes: ['line'],
    minArgs: 0,
    maxArgs: 0
  },
  
  // Show komutları
  'show running-config': {
    pattern: /^show(\s+running-config|\s+run|\s+running)(\s+\|\s+(include|section|begin|exclude)\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 4
  },
  'show startup-config': {
    pattern: /^show\s+startup-config$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show interfaces': {
    pattern: /^show(\s+interfaces?|\s+int)(\s+(status|description|counter|\S+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show interfaces status': {
    pattern: /^show\s+interfaces?\s+status$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show interface': {
    pattern: /^show\s+interface\s+(.+)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  'show vlan brief': {
    pattern: /^show(\s+vlan|\s+vl)\s*(brief|br)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show vlan': {
    pattern: /^show\s+vlan(\s+(id|name)\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 3
  },
  'show version': {
    pattern: /^show(\s+version|\s+ver)$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show mac address-table': {
    pattern: /^show\s+mac(?:\s*(?:address\-table|address|addr))?(\s+(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show cdp neighbors': {
    pattern: /^show\s+cdp\s+(neighbors?|nei|ne)(\s+(detail|det))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show cdp': {
    pattern: /^show\s+cdp(\s+(interface|interfaces|entry)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show ip interface brief': {
    pattern: /^show\s+ip\s+interface\s+(brief|br)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  'show ip interface': {
    pattern: /^show\s+ip\s+interface(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show ip route': {
    pattern: /^show\s+ip\s+route(\s+(.+))?$/i,
    modes: ['privileged', 'config', 'interface', 'vlan', 'line'],
    minArgs: 0,
    maxArgs: 0
  },
  'show ipv6 interface brief': {
    pattern: /^show\s+ipv6\s+interface\s+brief$/i,
    modes: ['privileged', 'config', 'interface', 'vlan', 'line'],
    minArgs: 0,
    maxArgs: 0
  },
  'show spanning-tree': {
    pattern: /^show\s+spanning-tree(\s+(vlan|interface|detail|summary)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show port-security': {
    pattern: /^show\s+port-security(\s+(interface)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show etherchannel': {
    pattern: /^show\s+etherchannel(\s+(summary|detail|port|load-balance)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show vtp status': {
    pattern: /^show\s+vtp\s+(status|password|counters)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  'show vtp': {
    pattern: /^show\s+vtp(\s+(status|password|counters))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show errdisable recovery': {
    pattern: /^show\s+errdisable\s+recovery$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show errdisable detect': {
    pattern: /^show\s+errdisable\s+detect$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show mac address-table static': {
    pattern: /^show\s+mac\s+address-table\s+static$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show authentication': {
    pattern: /^show\s+authentication(\s+(sessions|status)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show clock': {
    pattern: /^show\s+clock(\s+detail)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show flash': {
    pattern: /^show\s+flash(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show boot': {
    pattern: /^show\s+boot$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show environment': {
    pattern: /^show\s+environment(\s+(all|power|temperature|fan))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show inventory': {
    pattern: /^show\s+inventory(\s+(raw))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show users': {
    pattern: /^show\s+users(\s+(wide))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show sessions': {
    pattern: /^show\s+sessions?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show processes': {
    pattern: /^show\s+processes(\s+(cpu|memory))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show memory': {
    pattern: /^show\s+memory(\s+(statistics|summary))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show debug': {
    pattern: /^show\s+debug$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show ntp associations': {
    pattern: /^show\s+ntp\s+associations(\s+(detail))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ntp status': {
    pattern: /^show\s+ntp\s+status$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show ntp': {
    pattern: /^show\s+ntp(\s+(associations|status|source))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show snmp': {
    pattern: /^show\s+snmp(\s+(community|contact|location|host|user|group))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show arp': {
    pattern: /^show\s+arp(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ip arp': {
    pattern: /^show\s+ip\s+arp(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ip dhcp snooping': {
    pattern: /^show\s+ip\s+dhcp\s+snooping(\s+(binding|database|statistics))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ip arp inspection': {
    pattern: /^show\s+ip\s+arp\s+inspection(\s+(vlan|interface|statistics)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show monitor': {
    pattern: /^show\s+monitor(\s+(session)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show policy-map': {
    pattern: /^show\s+policy-map(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show class-map': {
    pattern: /^show\s+class-map(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show access-lists': {
    pattern: /^show\s+access-lists?(\s+(\S+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show mac access-lists': {
    pattern: /^show\s+mac\s+access-lists?(\s+(\S+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show system mtu': {
    pattern: /^show\s+system\s+mtu$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show sdm prefer': {
    pattern: /^show\s+sdm\s+prefer$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show controllers': {
    pattern: /^show\s+controllers(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show diagnostic': {
    pattern: /^show\s+diagnostic(\s+(result|content|status|schedule)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show udld': {
    pattern: /^show\s+udld(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show lldp': {
    pattern: /^show\s+lldp(\s+(neighbors|entry|interface|traffic)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show mls qos': {
    pattern: /^show\s+mls\s+qos(\s+(interface|maps|queueing)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show storm-control': {
    pattern: /^show\s+storm-control(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show banner motd': {
    pattern: /^show\s+banner\s+motd$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show alias': {
    pattern: /^show\s+alias$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show history': {
    pattern: /^show\s+history$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show redundancy': {
    pattern: /^show\s+redundancy(\s+(states|clients|history))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show archive': {
    pattern: /^show\s+archive(\s+(config\s+differences|status))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  
  // Kaydetme komutları
  'write memory': {
    pattern: /^(?:wr[ite]*(\s+me[mory]*)?)$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'copy running-config startup-config': {
    pattern: /^cop[y]*\s+run[ning\-config]*\s+sta[rtup\-config]*$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'copy running-config tftp': {
    pattern: /^copy\s+running-config\s+tftp$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'copy tftp running-config': {
    pattern: /^copy\s+tftp\s+running-config$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'copy startup-config running-config': {
    pattern: /^copy\s+startup-config\s+running-config$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'erase startup-config': {
    pattern: /^erase\s+startup-config$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'erase nvram': {
    pattern: /^erase\s+nvram$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'delete nvram': {
    pattern: /^delete\s+(nvram|flash:config\.text)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  
  // Yardım
  'help': {
    pattern: /^(\?|help)$/i,
    modes: ['user', 'privileged', 'config', 'interface', 'line', 'vlan'],
    minArgs: 0,
    maxArgs: 0
  },
  
  // Do komutları (config moddan show çalıştırma)
  'do show': {
    pattern: /^do\s+(show\s+.+)$/i,
    modes: ['config', 'interface', 'line', 'vlan'],
    minArgs: 1,
    maxArgs: 1
  },
  'do write': {
    pattern: /^do\s+(?:wr[ite]*(\s+me[mory]*)?)$/i,
    modes: ['config', 'interface', 'line', 'vlan'],
    minArgs: 0,
    maxArgs: 1
  },
  'do ping': {
    pattern: /^do\s+ping\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
    modes: ['config', 'interface', 'line', 'vlan'],
    minArgs: 1,
    maxArgs: 1
  },
  'do': {
    pattern: /^do\s+(.+)$/i,
    modes: ['config', 'interface', 'line', 'vlan'],
    minArgs: 1,
    maxArgs: 1
  },
  
  // Ping
  'ping': {
    pattern: /^ping\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(\s+(repeat\s+\d+|size\s+\d+|timeout\s+\d+))*$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 6
  },
  
  // Traceroute
  'traceroute': {
    pattern: /^traceroute\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  
  // Telnet
  'telnet': {
    pattern: /^telnet\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(\s+(\d+))?$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 2
  },
  
  // SSH
  'ssh': {
    pattern: /^ssh\s+(-l\s+\S+\s+)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 3
  },
  
  // Terminal
  'terminal length': {
    pattern: /^terminal\s+length\s+(\d+)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  'terminal width': {
    pattern: /^terminal\s+width\s+(\d+)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  'terminal monitor': {
    pattern: /^terminal\s+monitor$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'terminal no monitor': {
    pattern: /^terminal\s+no\s+monitor$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'terminal': {
    pattern: /^terminal\s+(.+)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  
  // Reload
  'reload': {
    pattern: /^reload(\s+(in\s+\d+|at\s+\S+|cancel))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  
  // Clear commands
  'clear arp-cache': {
    pattern: /^clear\s+arp-cache$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'clear mac address-table': {
    pattern: /^clear\s+mac\s+address-table(\s+(dynamic|static)(\s+vlan\s+\d+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 3
  },
  'clear counters': {
    pattern: /^clear\s+counters(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'clear line': {
    pattern: /^clear\s+line\s+(\d+)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  'clear interface': {
    pattern: /^clear\s+interface\s+(.+)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  
  // Debug commands
  'debug': {
    pattern: /^debug\s+(.+)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  'no debug': {
    pattern: /^no\s+debug(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'undebug': {
    pattern: /^undebug(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'undebug all': {
    pattern: /^undebug\s+all$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  
  // Setup
  'setup': {
    pattern: /^setup$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  
  // Test
  'test': {
    pattern: /^test\s+(.+)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  
  // Configure replace
  'configure replace': {
    pattern: /^configure\s+replace\s+(.+)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  
  // More
  'more': {
    pattern: /^more\s+(.+)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  
  // Disconnect
  'disconnect': {
    pattern: /^disconnect(\s+(\d+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  
  // Resume
  'resume': {
    pattern: /^resume(\s+(\d+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  
  // Suspend
  'suspend': {
    pattern: /^suspend$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  
  // Access-list
  'access-list': {
    pattern: /^(access-list|ip\s+access-list)\s+(standard|extended)\s+(\S+)$/i,
    modes: ['config'],
    minArgs: 2,
    maxArgs: 3
  },
  'no access-list': {
    pattern: /^no\s+(access-list|ip\s+access-list)\s+(standard|extended)?\s*(\S+)?$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 3
  },
  
  // Mac access-list
  'mac access-list': {
    pattern: /^mac\s+access-list\s+extended\s+(\S+)$/i,
    modes: ['config'],
    minArgs: 2,
    maxArgs: 2
  },
  
  // Monitor session (SPAN)
  'monitor session': {
    pattern: /^monitor\s+session\s+(\d+)(\s+(source|destination)\s+(.+))?$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 4
  },
  'no monitor session': {
    pattern: /^no\s+monitor\s+session\s+(\d+)(\s+(source|destination))?$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 3
  },
  
  // Class-map
  'class-map': {
    pattern: /^class-map\s+(match-any|match-all)\s+(\S+)$/i,
    modes: ['config'],
    minArgs: 2,
    maxArgs: 2
  },
  
  // Policy-map
  'policy-map': {
    pattern: /^policy-map\s+(\S+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  },
  
  // Template
  'template': {
    pattern: /^template\s+(\S+)$/i,
    modes: ['config'],
    minArgs: 1,
    maxArgs: 1
  }
};

// Komut alias'larını çöz - Gelişmiş versiyon
function resolveAliases(input: string): string {
  const trimmed = input.trim().toLowerCase();
  
  // Tam eşleşme - direkt alias
  if (commandAliases[trimmed]) {
    return commandAliases[trimmed];
  }
  
  // Kısmi eşleşme - daha uzun komutlar için
  // Önce en uzun alias'ları dene
  const sortedAliases = Object.entries(commandAliases)
    .sort((a, b) => b[0].length - a[0].length);
  
  for (const [alias, full] of sortedAliases) {
    // Alias ile başlıyor ve devamında bir şey varsa
    if (trimmed === alias.toLowerCase()) {
      return full;
    }
    // Alias ile başlıyor ve boşluk veya başka karakterle devam ediyorsa
    if (trimmed.startsWith(alias.toLowerCase() + ' ')) {
      const rest = input.trim().substring(alias.length).trim();
      return full + ' ' + rest;
    }
  }
  
  return input;
}

// Komut parse et
export function parseCommand(input: string, currentMode: CommandMode): ParsedCommand | null {
  const resolvedInput = resolveAliases(input);
  const trimmed = resolvedInput.trim();
  
  if (!trimmed) return null;
  
  // Komut ve argümanları ayır
  const parts = trimmed.split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);
  
  return {
    command: command.toLowerCase(),
    args: args.map(a => a.toLowerCase()),
    rawInput: input,
    resolvedInput: resolvedInput  // Store resolved input for executor
  };
}

// Komut geçerli mi kontrol et
export function validateCommand(
  parsed: ParsedCommand, 
  currentMode: CommandMode
): { valid: boolean; error?: string; matchedPattern?: string } {
  
  const input = parsed.rawInput.toLowerCase();
  const resolvedInput = resolveAliases(parsed.rawInput);
  
  // Tüm pattern'leri kontrol et
  for (const [name, pattern] of Object.entries(commandPatterns)) {
    const match = resolvedInput.match(pattern.pattern);
    
    if (match) {
      // Mode kontrolü
      if (!pattern.modes.includes(currentMode)) {
        return {
          valid: false,
          error: getModeError(name, currentMode)
        };
      }
      
      return { valid: true, matchedPattern: name };
    }
  }
  
  // Eşleşme bulunamadı
  return {
    valid: false,
    error: getInvalidCommandError(parsed.rawInput)
  };
}

// Mode hatası mesajı
function getModeError(command: string, currentMode: CommandMode): string {
  const modeNames: Record<CommandMode, string> = {
    user: 'User EXEC',
    privileged: 'Privileged EXEC',
    config: 'Global Configuration',
    interface: 'Interface Configuration',
    line: 'Line Configuration',
    vlan: 'VLAN Configuration',
    'router-config': 'Router Configuration',
  };
  
  return `          ^
% Invalid input detected at '^' marker.

Bu komut bu modda kullanılamaz. Mevcut mod: ${modeNames[currentMode]}`;
}

// Geçersiz komut hatası
function getInvalidCommandError(input: string): string {
  return `Translating "${input}"...domain server (255.255.255.255)
% Unknown command or computer name, or unable to find computer address`;
}

// Komut için gereken argümanları al
export function getCommandArgs(input: string, pattern: RegExp): string[] | null {
  const match = input.match(pattern);
  if (!match) return null;
  return match.slice(1);
}

// Yardım içeriği
export function getHelpContent(mode: CommandMode, language: 'tr' | 'en' = 'tr'): string {
  const helpContentsTR: Record<CommandMode, string> = {
    user: `
Mevcut komutlar:
  enable      - Privileged EXEC moduna geç
  exit        - Oturumu kapat
  show        - Sistem bilgilerini göster (sınırlı)
  ?           - Bu yardım mesajını göster

Hızlı yazım:
  en          = enable
`,
    privileged: `
Mevcut komutlar:
  configure terminal  - Global configuration moduna geç
  disable            - User EXEC moduna dön
  show               - Sistem bilgilerini göster
    show running-config   - Çalışan konfigürasyonu göster
    show interfaces       - Port durumlarını göster
    show vlan brief       - VLAN özetini göster
    show version          - Sistem versiyonunu göster
    show mac address-table - MAC adres tablosunu göster
    show cdp neighbors    - CDP komşularını göster
    show spanning-tree    - Spanning-tree durumunu göster
    show port-security    - Port güvenlik durumunu göster
    show ip interface brief - IP arayüz özetini göster
  write memory       - Konfigürasyonu kaydet
  copy run start     - Konfigürasyonu kaydet (alternatif)
  ping <ip>          - Ping at
  traceroute <ip>    - Trace route
  telnet <ip>        - Telnet bağlantısı
  reload             - Switch'i yeniden başlat
  exit               - User EXEC moduna dön

Hızlı yazım:
  conf t      = configure terminal
  sh run      = show running-config
  sh int      = show interfaces
  sh vl br    = show vlan brief
  sh ver      = show version
  sh mac      = show mac address-table
  sh cdp ne   = show cdp neighbors
  wr          = write memory
  cop run sta = copy running-config startup-config
`,
    config: `
Mevcut komutlar:
  hostname <isim>           - Switch adını değiştir
  interface <port>          - Interface konfigürasyonuna geç
    Ethernet                - Ethernet IEEE 802.3
    FastEthernet            - FastEthernet IEEE 802.3
    GigabitEthernet        - GigabitEthernet IEEE 802.3z
    Port-channel            - Ethernet Channel of interfaces
    Vlan                    - Catalyst Vlans
  interface range <ports>   - Birden fazla interface seç
  vlan <id>                 - VLAN konfigürasyonuna geç
  no vlan <id>              - VLAN sil
  enable secret <şifre>     - Enable şifresi (şifreli)
  enable password <şifre>   - Enable şifresi (düz metin)
  service password-encryption - Şifreleri şifrele
  username <isim> password <şifre> - Kullanıcı oluştur
  line console 0            - Console hattı konfigürasyonu
  line vty <start> <end>    - VTY hattı konfigürasyonu
  banner motd #<mesaj>#     - MOTD banner ayarla
  ip default-gateway <ip>   - Varsayılan ağ geçidi
  ip domain-name <name>     - Domain adı
  spanning-tree mode <mode> - STP modu ayarla
  vtp mode <mode>           - VTP modu ayarla
  vtp domain <name>         - VTP domain ayarla
  cdp run                   - CDP'yi etkinleştir
  no cdp run                - CDP'yi devre dışı bırak
  exit                      - Privileged mode'a dön
  end                       - Privileged mode'a dön
  do <command>              - Privileged komutlarını çalıştır

Hızlı yazım:
  int fa0/1   = interface FastEthernet0/1
  int gi0/1   = interface GigabitEthernet0/1
  int r fa0/1-24 = interface range FastEthernet0/1-24
  en sec      = enable secret
  ser pass    = service password-encryption
  ban mot     = banner motd
  ip def      = ip default-gateway
`,
    interface: `
Mevcut komutlar:
  shutdown                  - Portu kapat
  no shutdown               - Portu aç
  speed <10|100|1000|auto>  - Port hızı
  duplex <half|full|auto>   - Duplex ayarı
  description <metin>       - Port açıklaması
  switchport mode <access|trunk> - Port modu
  switchport access vlan <id>    - VLAN ata
  switchport trunk allowed vlan <list> - Trunk VLAN'ları
  switchport trunk native vlan <id> - Native VLAN
  switchport port-security        - Port güvenliği etkinleştir
  switchport port-security maximum <n> - Max MAC adresi
  switchport port-security violation <mode> - İhlal modu
  switchport port-security mac-address <mac> - Statik MAC
  switchport voice vlan <id>       - Voice VLAN
  cdp enable               - CDP'yi etkinleştir (port)
  no cdp enable            - CDP'yi devre dışı bırak (port)
  channel-group <id> mode <mode>   - EtherChannel
  spanning-tree portfast   - PortFast etkinleştir
  spanning-tree bpduguard enable - BPDU Guard etkinleştir
  storm-control broadcast level <rate> - Storm control
  power inline <auto|static|never> - PoE kontrolü
  exit                      - Config mode'a dön
  end                       - Privileged mode'a dön

Hızlı yazım:
  no sh      = no shutdown
  sh         = shutdown
  sw mode    = switchport mode
  sw acc vlan = switchport access vlan
  sw m a     = switchport mode access
  sw m t     = switchport mode trunk
  sw p       = switchport port-security
  sw voice   = switchport voice
  desc       = description
  chan       = channel-group
  span port  = spanning-tree portfast
`,
    line: `
Mevcut komutlar:
  password <şifre>          - Hat şifresi
  login                     - Login aktifleştir
  login local               - Local authentication
  no login                  - Login devre dışı
  transport input <ssh|telnet|all|none> - Erişim protokolü
  transport output <ssh|telnet|all|none> - Çıkış protokolü
  exec-timeout <min> <sec>  - Oturum zaman aşımı
  logging synchronous       - Log senkronizasyonu
  history size <n>          - Komut geçmişi boyutu
  privilege level <0-15>    - Privilege seviyesi
  access-class <acl> <in|out> - Erişim kontrolü
  exit                      - Config mode'a dön
  end                       - Privileged mode'a dön

Hızlı yazım:
  pass       = password
  trans in   = transport input
  exec-t     = exec-timeout
  log sync   = logging synchronous
`,
    vlan: `
Mevcut komutlar:
  name <isim>               - VLAN adı
  no name                   - VLAN adını sil
  state <active|suspend>    - VLAN durumu
  exit                      - Config mode'a dön
  end                       - Privileged mode'a dön

Hızlı yazım:
  n         = name
`,
    'router-config': `
Mevcut komutlar:
  network <ip> <wildcard> area <area> - OSPF/ağ bildirimi
  neighbor <ip>               - BGP komşu
  version <1|2>               - RIP versiyonu
  no auto-summary             - Otomatik özetlemeyi kapat
  redistribute <protocol>     - Rota yeniden dağıt
  exit                        - Config mode'a dön
  end                         - Privileged mode'a dön
`
  };

  const helpContentsEN: Record<CommandMode, string> = {
    user: `
Available commands:
  enable      - Enter privileged EXEC mode
  exit        - Close session
  show        - Display system information (limited)
  ?           - Show this help message

Shortcuts:
  en          = enable
`,
    privileged: `
Available commands:
  configure terminal  - Enter global configuration mode
  disable            - Return to user EXEC mode
  show               - Display system information
    show running-config   - Show running configuration
    show interfaces       - Show port status
    show vlan brief       - Show VLAN summary
    show version          - Show system version
    show mac address-table - Show MAC address table
    show cdp neighbors    - Show CDP neighbors
    show spanning-tree    - Show spanning-tree status
    show port-security    - Show port security status
    show ip interface brief - Show IP interface summary
  write memory       - Save configuration
  copy run start     - Save configuration (alternative)
  ping <ip>          - Ping
  traceroute <ip>    - Trace route
  telnet <ip>        - Telnet connection
  reload             - Reload switch
  exit               - Return to user EXEC mode

Shortcuts:
  conf t      = configure terminal
  sh run      = show running-config
  sh int      = show interfaces
  sh vl br    = show vlan brief
  sh ver      = show version
  sh mac      = show mac address-table
  sh cdp ne   = show cdp neighbors
  wr          = write memory
  cop run sta = copy running-config startup-config
`,
    config: `
    Available commands:
    hostname <name>           - Change switch name
    interface <port>          - Enter interface configuration
    Ethernet                - Ethernet IEEE 802.3
    FastEthernet            - FastEthernet IEEE 802.3
    GigabitEthernet        - GigabitEthernet IEEE 802.3z
    Port-channel            - Ethernet Channel of interfaces
    Vlan                    - Catalyst Vlans
    interface range <ports>   - Select multiple interfaces
    vlan <id>                 - Enter VLAN configuration
    no vlan <id>              - Delete VLAN
    enable secret <password>  - Enable password (encrypted)
    enable password <password> - Enable password (plain text)
    service password-encryption - Encrypt passwords
    username <name> password <password> - Create user
    line console 0            - Console line configuration
    line vty <start> <end>    - VTY line configuration
    banner motd #<message>#   - Set MOTD banner
    ip default-gateway <ip>   - Default gateway
    ip domain-name <name>     - Domain name
    spanning-tree mode <mode> - Set STP mode
    vtp mode <mode>           - Set VTP mode
    vtp domain <name>         - Set VTP domain
    cdp run                   - Enable CDP
    no cdp run                - Disable CDP
    exit                      - Return to privileged mode
    end                       - Return to privileged mode
    do <command>              - Run privileged commands

    Shortcuts:
    int fa0/1   = interface FastEthernet0/1
    int gi0/1   = interface GigabitEthernet0/1
    int r fa0/1-24 = interface range FastEthernet0/1-24
    en sec      = enable secret
    ser pass    = service password-encryption
    ban mot     = banner motd
    ip def      = ip default-gateway
    `,
    interface: `
Available commands:
  shutdown                  - Disable port
  no shutdown               - Enable port
  speed <10|100|1000|auto>  - Port speed
  duplex <half|full|auto>   - Duplex setting
  description <text>        - Port description
  switchport mode <access|trunk> - Port mode
  switchport access vlan <id>    - Assign VLAN
  switchport trunk allowed vlan <list> - Trunk VLANs
  switchport trunk native vlan <id> - Native VLAN
  switchport port-security        - Enable port security
  switchport port-security maximum <n> - Max MAC addresses
  switchport port-security violation <mode> - Violation mode
  switchport port-security mac-address <mac> - Static MAC
  switchport voice vlan <id>       - Voice VLAN
  cdp enable               - Enable CDP (port)
  no cdp enable            - Disable CDP (port)
  channel-group <id> mode <mode>   - EtherChannel
  spanning-tree portfast   - Enable PortFast
  spanning-tree bpduguard enable - Enable BPDU Guard
  storm-control broadcast level <rate> - Storm control
  power inline <auto|static|never> - PoE control
  exit                      - Return to config mode
  end                       - Return to privileged mode

Shortcuts:
  no sh      = no shutdown
  sh         = shutdown
  sw mode    = switchport mode
  sw acc vlan = switchport access vlan
  sw m a     = switchport mode access
  sw m t     = switchport mode trunk
  sw p       = switchport port-security
  sw voice   = switchport voice
  desc       = description
  chan       = channel-group
  span port  = spanning-tree portfast
`,
    line: `
Available commands:
  password <password>       - Line password
  login                     - Enable login
  login local               - Local authentication
  no login                  - Disable login
  transport input <ssh|telnet|all|none> - Access protocol
  transport output <ssh|telnet|all|none> - Output protocol
  exec-timeout <min> <sec>  - Session timeout
  logging synchronous       - Log synchronization
  history size <n>          - Command history size
  privilege level <0-15>    - Privilege level
  access-class <acl> <in|out> - Access control
  exit                      - Return to config mode
  end                       - Return to privileged mode

Shortcuts:
  pass       = password
  trans in   = transport input
  exec-t     = exec-timeout
  log sync   = logging synchronous
`,
    vlan: `
Available commands:
  name <name>               - VLAN name
  no name                   - Remove VLAN name
  state <active|suspend>    - VLAN state
  exit                      - Return to config mode
  end                       - Return to privileged mode

Shortcuts:
  n         = name
`,
    'router-config': `
Available commands:
  network <ip> <wildcard> area <area> - OSPF/network announcement
  neighbor <ip>               - BGP neighbor
  version <1|2>               - RIP version
  no auto-summary             - Disable auto-summary
  redistribute <protocol>     - Redistribute routes
  exit                        - Return to config mode
  end                         - Return to privileged mode
`
  };
  
  return language === 'en' ? helpContentsEN[mode] : helpContentsTR[mode];
}

export { commandPatterns };
