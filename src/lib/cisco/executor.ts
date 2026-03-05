// Cisco Command Executor
import { SwitchState, CommandMode, CommandResult, Port, Vlan, PortStatus } from './types';
import { parseCommand, validateCommand, getHelpContent, commandPatterns } from './parser';
import { normalizePortId, getModePrompt, createInitialState } from './initialState';

// Cisco tarzı komut ağacı - ? için
const commandHelp: Record<string, Record<string, string[]>> = {
  user: {
    '': ['enable', 'exit', 'show', '?'],
    'e': ['enable', 'exit'],
    'en': ['enable'],
    'ex': ['exit'],
    's': ['show'],
    'sh': ['show'],
    'sho': ['show'],
    'show': ['version'],
  },
  privileged: {
    '': ['configure', 'disable', 'show', 'write', 'ping', 'telnet', 'reload', 'exit', 'copy', 'erase', '?'],
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
    
    's': ['show'],
    'sh': ['show'],
    'sho': ['show'],
    'show': ['running-config', 'interfaces', 'vlan', 'version', 'mac', 'cdp', 'ip', 'spanning-tree', 'port-security'],
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
    'show ip': ['interface'],
    'show ip i': ['interface'],
    'show ip int': ['interface'],
    'show ip inte': ['interface'],
    'show ip interf': ['interface'],
    'show ip interfa': ['interface'],
    'show ip interfac': ['interface'],
    'show ip interface': ['brief'],
    
    'w': ['write'],
    'wr': ['write'],
    'wri': ['write'],
    'writ': ['write'],
    'write': ['memory'],
    
    'p': ['ping'],
    'pi': ['ping'],
    'pin': ['ping'],
    
    't': ['telnet', 'traceroute'],
    'te': ['telnet'],
    'tel': ['telnet'],
    'teln': ['telnet'],
    'telne': ['telnet'],
    
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
    '': ['hostname', 'interface', 'vlan', 'enable', 'service', 'username', 'line', 'banner', 'ip', 'no', 'spanning-tree', 'vtp', 'cdp', 'exit', 'end', 'do', '?'],
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
    'interface': ['FastEthernet', 'GigabitEthernet', 'range'],
    'interface F': ['FastEthernet'],
    'interface Fa': ['FastEthernet'],
    'interface Fas': ['FastEthernet'],
    'interface Fast': ['FastEthernet'],
    'interface FastE': ['FastEthernet'],
    'interface FastEt': ['FastEthernet'],
    'interface FastEth': ['FastEthernet'],
    'interface FastEthe': ['FastEthernet'],
    'interface FastEther': ['FastEthernet'],
    'interface FastEthern': ['FastEthernet'],
    'interface FastEtherne': ['FastEthernet'],
    'interface FastEthernet': ['0/'],
    'interface FastEthernet0': ['0/'],
    'interface FastEthernet0/': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
    'interface G': ['GigabitEthernet'],
    'interface Gi': ['GigabitEthernet'],
    'interface Gig': ['GigabitEthernet'],
    'interface Giga': ['GigabitEthernet'],
    'interface Gigab': ['GigabitEthernet'],
    'interface Gigabi': ['GigabitEthernet'],
    'interface Gigabit': ['GigabitEthernet'],
    'interface GigabitE': ['GigabitEthernet'],
    'interface GigabitEt': ['GigabitEthernet'],
    'interface GigabitEth': ['GigabitEthernet'],
    'interface GigabitEthe': ['GigabitEthernet'],
    'interface GigabitEther': ['GigabitEthernet'],
    'interface GigabitEthern': ['GigabitEthernet'],
    'interface GigabitEtherne': ['GigabitEthernet'],
    'interface GigabitEthernet': ['0/'],
    'interface GigabitEthernet0': ['0/'],
    'interface GigabitEthernet0/': ['1', '2'],
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
    'interface range GigabitEthernet0/': ['1-2'],
    
    'v': ['vlan'],
    'vl': ['vlan'],
    'vla': ['vlan'],
    'vlan': ['1', '10', '20', '30', '50', '100', '200'],
    
    'e': ['enable', 'end', 'exit'],
    'en': ['enable', 'end'],
    'ena': ['enable'],
    'enab': ['enable'],
    'enabl': ['enable'],
    'enable': ['secret', 'password'],
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
    '': ['shutdown', 'no', 'speed', 'duplex', 'description', 'switchport', 'cdp', 'spanning-tree', 'channel-group', 'exit', 'end', 'do', '?'],
    's': ['shutdown', 'speed', 'spanning-tree'],
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
    
    'n': ['no'],
    'no': ['shutdown', 'switchport', 'cdp', 'description', 'speed', 'duplex', 'spanning-tree'],
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
    '': ['password', 'login', 'transport', 'exec-timeout', 'logging', 'history', 'privilege', 'exit', 'end', 'do', '?'],
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
    '': ['name', 'state', 'exit', 'end', '?'],
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
};

// Cisco tarzı ? yardım çıktısı oluştur
function getInlineHelp(mode: CommandMode, partialInput: string, prompt: string): string {
  const modeCommands = commandHelp[mode] || commandHelp.user;
  const lower = partialInput.toLowerCase().trim();
  
  // Komutları al
  let suggestions: string[] = [];
  
  if (modeCommands[lower]) {
    suggestions = modeCommands[lower];
  } else {
    // Kısmi eşleşme ara
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
  
  // Çıktıyı formatla (Cisco tarzı)
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
    lines.push('');
    lines.push('  <cr>');
  }
  
  lines.push('');
  
  return lines.join('\n');
}

// Komut çalıştırıcı
export function executeCommand(
  state: SwitchState,
  input: string,
  language: 'tr' | 'en' = 'tr'
): CommandResult {
  // Eğer şifre bekleniyorsa, şifre doğrulama yap
  if (state.awaitingPassword) {
    return handlePasswordInput(state, input, language);
  }
  
  // ? ile biten komutları help olarak işle
  if (input.endsWith('?') && input.length > 0) {
    const partialInput = input.slice(0, -1).trim();
    const prompt = getModePrompt(state.currentMode, state.hostname);
    const helpOutput = getInlineHelp(state.currentMode, partialInput, prompt);
    return {
      success: true,
      output: helpOutput
    };
  }
  
  const parsed = parseCommand(input, state.currentMode);
  
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
  
  // Komut işleyicilerini çağır - use resolved input from parsed command
  return executeSpecificCommand(state, commandName, parsed.resolvedInput || parsed.rawInput, language);
}

// Şifre girişi işleme
function handlePasswordInput(state: SwitchState, password: string, language: 'tr' | 'en'): CommandResult {
  if (state.passwordContext === 'enable') {
    // Enable secret önce kontrol edilir (öncelikli)
    const validPassword = state.security.enableSecret 
      ? password === state.security.enableSecret
      : state.security.enablePassword 
        ? password === state.security.enablePassword
        : true;
    
    if (validPassword) {
      return {
        success: true,
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
          awaitingPassword: false,
          passwordContext: undefined
        }
      };
    }
  }
  
  // Bilinmeyen şifre bağlamı
  return {
    success: false,
    error: '% Password error',
    newState: {
      awaitingPassword: false,
      passwordContext: undefined
    }
  };
}

// Komut işleyicileri
function executeSpecificCommand(
  state: SwitchState,
  commandName: string,
  input: string,
  language: 'tr' | 'en' = 'tr'
): CommandResult {
  
  switch (commandName) {
    // Mode değiştirme
    case 'enable':
      return cmdEnable(state, language);
    case 'disable':
      return cmdDisable(state);
    case 'configure terminal':
      return cmdConfigureTerminal(state);
    case 'exit':
    case 'abort':
      return cmdExit(state);
    case 'end':
      return cmdEnd(state);
    
    // Global config
    case 'hostname':
      return cmdHostname(state, input);
    case 'vlan':
      return cmdVlan(state, input);
    case 'no vlan':
      return cmdNoVlan(state, input);
    case 'enable secret':
      return cmdEnableSecret(state, input);
    case 'enable password':
      return cmdEnablePassword(state, input);
    case 'service password-encryption':
      return cmdServicePasswordEncryption(state);
    case 'no service password-encryption':
      return cmdNoServicePasswordEncryption(state);
    case 'username':
      return cmdUsername(state, input);
    case 'no username':
      return cmdNoUsername(state, input);
    case 'banner motd':
      return cmdBannerMotd(state, input);
    case 'no banner motd':
      return cmdNoBannerMotd(state);
    case 'ip domain-name':
      return cmdIpDomainName(state, input);
    case 'ip default-gateway':
      return cmdIpDefaultGateway(state, input);
    case 'ip ssh version':
      return cmdIpSshVersion(state, input);
    case 'crypto key generate rsa':
      return cmdCryptoKeyGenerateRsa(state);
    case 'cdp run':
      return cmdCdpRun(state);
    case 'no cdp run':
      return cmdNoCdpRun(state);
    case 'spanning-tree mode':
      return cmdSpanningTreeMode(state, input);
    case 'vtp mode':
      return cmdVtpMode(state, input);
    case 'vtp domain':
      return cmdVtpDomain(state, input);
    case 'mls qos':
      return cmdMlsQos(state);
    case 'no mls qos':
      return cmdNoMlsQos(state);
    case 'ip dhcp snooping':
      return cmdIpDhcpSnooping(state);
    case 'no ip dhcp snooping':
      return cmdNoIpDhcpSnooping(state);
    case 'ip dhcp snooping vlan':
      return cmdIpDhcpSnoopingVlan(state, input);
    case 'snmp-server community':
      return cmdSnmpServerCommunity(state, input);
    case 'ntp server':
      return cmdNtpServer(state, input);
    
    // Interface
    case 'interface':
      return cmdInterface(state, input);
    case 'interface range':
      return cmdInterfaceRange(state, input);
    case 'no shutdown':
      return cmdNoShutdown(state);
    case 'shutdown':
      return cmdShutdown(state);
    case 'speed':
      return cmdSpeed(state, input);
    case 'duplex':
      return cmdDuplex(state, input);
    case 'description':
      return cmdDescription(state, input);
    case 'no description':
      return cmdNoDescription(state);
    case 'switchport mode':
      return cmdSwitchportMode(state, input);
    case 'switchport access vlan':
      return cmdSwitchportAccessVlan(state, input);
    case 'switchport trunk allowed vlan':
      return cmdSwitchportTrunkAllowedVlan(state, input);
    case 'switchport trunk native vlan':
      return cmdSwitchportTrunkNativeVlan(state, input);
    case 'switchport port-security':
      return cmdSwitchportPortSecurity(state);
    case 'switchport port-security maximum':
      return cmdSwitchportPortSecurityMaximum(state, input);
    case 'switchport port-security violation':
      return cmdSwitchportPortSecurityViolation(state, input);
    case 'switchport port-security mac-address':
      return cmdSwitchportPortSecurityMac(state, input);
    case 'switchport port-security mac-address sticky':
      return cmdSwitchportPortSecuritySticky(state);
    case 'switchport voice vlan':
      return cmdSwitchportVoiceVlan(state, input);
    case 'cdp enable':
      return cmdCdpEnable(state);
    case 'no cdp enable':
      return cmdNoCdpEnable(state);
    case 'channel-group':
      return cmdChannelGroup(state, input);
    case 'spanning-tree portfast':
      return cmdSpanningTreePortfast(state, input);
    case 'spanning-tree bpduguard':
      return cmdSpanningTreeBpduguard(state, input);
    case 'storm-control':
      return cmdStormControl(state, input);
    case 'mls qos trust':
      return cmdMlsQosTrust(state, input);
    case 'udld enable':
    case 'udld port':
      return cmdUdldEnable(state);
    case 'power inline':
      return cmdPowerInline(state, input);
    case 'ip address':
      return cmdIpAddress(state, input);
    case 'ip dhcp snooping trust':
      return cmdIpDhcpSnoopingTrust(state);
    case 'no ip dhcp snooping trust':
      return cmdNoIpDhcpSnoopingTrust(state);
    case 'ip arp inspection trust':
      return cmdIpArpInspectionTrust(state);
    case 'keepalive':
    case 'no keepalive':
      return { success: true };
    case 'bandwidth':
    case 'delay':
    case 'load-interval':
      return { success: true };
    
    // VLAN config
    case 'name':
      return cmdVlanName(state, input);
    case 'no name':
      return cmdNoVlanName(state);
    case 'state':
      return cmdVlanState(state, input);
    
    // Line
    case 'line console':
      return cmdLineConsole(state);
    case 'line vty':
      return cmdLineVty(state, input);
    case 'password':
      return cmdPassword(state, input);
    case 'login':
      return cmdLogin(state, input);
    case 'no login':
      return cmdNoLogin(state);
    case 'transport input':
      return cmdTransportInput(state, input);
    case 'exec-timeout':
      return cmdExecTimeout(state, input);
    case 'logging synchronous':
      return cmdLoggingSynchronous(state);
    case 'no logging synchronous':
      return cmdNoLoggingSynchronous(state);
    case 'history size':
      return cmdHistorySize(state, input);
    case 'privilege level':
      return { success: true };
    
    // Show
    case 'show running-config':
      return cmdShowRunningConfig(state, input);
    case 'show startup-config':
      return cmdShowStartupConfig(state);
    case 'show interfaces':
      return cmdShowInterfaces(state, input);
    case 'show interfaces status':
      return cmdShowInterfacesStatus(state);
    case 'show interface':
      return cmdShowInterface(state, input);
    case 'show vlan brief':
    case 'show vlan':
      return cmdShowVlanBrief(state);
    case 'show version':
      return cmdShowVersion(state);
    case 'show mac address-table':
    case 'show mac address-table static':
      return cmdShowMacAddressTable(state);
    case 'show cdp neighbors':
    case 'show cdp':
      return cmdShowCdpNeighbors(state, input);
    case 'show ip interface brief':
    case 'show ip interface':
      return cmdShowIpInterfaceBrief(state);
    case 'show spanning-tree':
      return cmdShowSpanningTree(state);
    case 'show port-security':
      return cmdShowPortSecurity(state);
    case 'show etherchannel':
      return cmdShowEtherchannel(state);
    case 'show vtp status':
    case 'show vtp':
      return cmdShowVtpStatus(state);
    case 'show errdisable recovery':
      return cmdShowErrdisableRecovery(state);
    case 'show clock':
      return cmdShowClock(state);
    case 'show flash':
      return cmdShowFlash(state);
    case 'show boot':
      return cmdShowBoot(state);
    case 'show inventory':
      return cmdShowInventory(state);
    case 'show users':
      return cmdShowUsers(state);
    case 'show processes':
    case 'show memory':
      return cmdShowProcesses(state);
    case 'show ntp status':
    case 'show ntp associations':
    case 'show ntp':
      return cmdShowNtp(state);
    case 'show arp':
    case 'show ip arp':
      return cmdShowArp(state);
    case 'show ip dhcp snooping':
      return cmdShowIpDhcpSnooping(state);
    case 'show ip arp inspection':
      return cmdShowIpArpInspection(state);
    case 'show mac access-lists':
    case 'show access-lists':
      return cmdShowAccessLists(state);
    case 'show system mtu':
      return cmdShowSystemMtu(state);
    case 'show sdm prefer':
      return cmdShowSdmPrefer(state);
    case 'show history':
      return cmdShowHistory(state);
    case 'show banner motd':
      return cmdShowBannerMotd(state);
    case 'show udld':
      return cmdShowUdld(state);
    case 'show lldp':
      return cmdShowLldp(state);
    case 'show mls qos':
      return cmdShowMlsQos(state);
    case 'show storm-control':
      return cmdShowStormControl(state);
    case 'show environment':
      return cmdShowEnvironment(state);
    case 'show diagnostic':
      return cmdShowDiagnostic(state);
    case 'show debug':
      return cmdShowDebug(state);
    
    // Kaydetme
    case 'write memory':
    case 'copy running-config startup-config':
      return cmdWriteMemory(state);
    case 'copy running-config tftp':
      return cmdCopyRunningConfigTftp(state, input);
    case 'erase startup-config':
    case 'erase nvram':
    case 'delete nvram':
      return cmdEraseStartupConfig(state);
    
    // Do komutları
    case 'do show':
    case 'do write':
    case 'do ping':
    case 'do':
      return cmdDo(state, input);
    
    // Ping & Trace
    case 'ping':
      return cmdPing(state, input);
    case 'traceroute':
      return cmdTraceroute(state, input);
    case 'telnet':
      return cmdTelnet(state, input);
    case 'ssh':
      return cmdSsh(state, input);
    
    // Terminal
    case 'terminal length':
    case 'terminal width':
    case 'terminal monitor':
    case 'terminal no monitor':
    case 'terminal':
      return { success: true };
    
    // Reload
    case 'reload':
      return cmdReload(state, input);
    
    // Clear
    case 'clear arp-cache':
      return cmdClearArpCache(state);
    case 'clear mac address-table':
      return cmdClearMacAddressTable(state);
    case 'clear counters':
      return cmdClearCounters(state);
    case 'clear line':
      return cmdClearLine(state, input);
    
    // Debug
    case 'debug':
      return cmdDebug(state, input);
    case 'no debug':
    case 'undebug':
    case 'undebug all':
      return cmdNoDebug(state, input);
    
    // Setup & Test
    case 'setup':
      return cmdSetup(state);
    case 'test':
      return { success: true };
    
    // Disconnect
    case 'disconnect':
    case 'resume':
    case 'suspend':
      return { success: true };
    
    // Monitor
    case 'monitor session':
      return cmdMonitorSession(state, input);
    case 'no monitor session':
      return cmdNoMonitorSession(state, input);
    
    // Yardım
    case 'help':
      return cmdHelp(state, language);
    
    default:
      // Tanınmayan ama parse edilen komutlar için success dön
      return { success: true };
  }
}

// Mode değiştirme komutları
function cmdEnable(state: SwitchState, language: 'tr' | 'en' = 'tr'): CommandResult {
  // Eğer zaten privileged modundaysak bir şey yapma
  if (state.currentMode === 'privileged') {
    return { success: true };
  }
  
  // Eğer enable secret veya password ayarlıysa şifre iste
  const hasPassword = state.security.enableSecret || state.security.enablePassword;
  
  if (hasPassword && !state.awaitingPassword) {
    return {
      success: true,
      output: 'Password: ',
      requiresPassword: true,
      passwordPrompt: 'Password: ',
      passwordContext: 'enable',
      newState: {
        awaitingPassword: true,
        passwordContext: 'enable'
      }
    };
  }
  
  return {
    success: true,
    newState: { currentMode: 'privileged' }
  };
}

function cmdDisable(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: { currentMode: 'user' }
  };
}

function cmdConfigureTerminal(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: {
      currentMode: 'config',
      currentInterface: undefined,
      currentLine: undefined,
      currentVlan: undefined
    }
  };
}

function cmdExit(state: SwitchState): CommandResult {
  switch (state.currentMode) {
    case 'privileged':
      return { success: true, newState: { currentMode: 'user' } };
    case 'config':
      return { success: true, newState: { currentMode: 'privileged' } };
    case 'interface':
    case 'line':
    case 'vlan':
      return { 
        success: true, 
        newState: { 
          currentMode: 'config', 
          currentInterface: undefined, 
          currentLine: undefined, 
          currentVlan: undefined,
          selectedInterfaces: undefined  // Range seçimini temizle
        } 
      };
    default:
      return { success: true };
  }
}

function cmdEnd(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: {
      currentMode: 'privileged',
      currentInterface: undefined,
      currentLine: undefined,
      currentVlan: undefined,
      selectedInterfaces: undefined  // Range seçimini temizle
    }
  };
}

// Global config komutları
function cmdHostname(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^hostname\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid hostname' };
  
  const newHostname = match[1].trim();
  return {
    success: true,
    newState: { hostname: newHostname }
  };
}

function cmdVlan(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^vlan\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid VLAN ID' };
  
  const vlanId = parseInt(match[1]);
  if (vlanId < 1 || vlanId > 4094) {
    return { success: false, error: '% Invalid VLAN ID (1-4094)' };
  }
  
  const newVlans = { ...state.vlans };
  if (!newVlans[vlanId]) {
    newVlans[vlanId] = {
      id: vlanId,
      name: `VLAN${vlanId}`,
      status: 'active',
      ports: []
    };
  }
  
  return {
    success: true,
    newState: {
      vlans: newVlans,
      currentMode: 'vlan',
      currentVlan: vlanId
    }
  };
}

function cmdNoVlan(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^no\s+vlan\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid VLAN ID' };
  
  const vlanId = parseInt(match[1]);
  
  // Varsayılan VLAN'lar silinemez
  if ([1, 1002, 1003, 1004, 1005].includes(vlanId)) {
    return { success: false, error: '% Cannot delete default VLAN' };
  }
  
  const newVlans = { ...state.vlans };
  delete newVlans[vlanId];
  
  // Portları VLAN 1'e taşı
  const newPorts = { ...state.ports };
  Object.values(newPorts).forEach(port => {
    if (port.vlan === vlanId) {
      newPorts[port.id] = { ...port, vlan: 1 };
    }
  });
  
  return {
    success: true,
    newState: { vlans: newVlans, ports: newPorts }
  };
}

function cmdEnableSecret(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^enable\s+secret\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid secret' };
  
  const secret = match[1].trim();
  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        enableSecret: secret,
        enableSecretEncrypted: true
      }
    }
  };
}

function cmdEnablePassword(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^enable\s+password\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid password' };
  
  const password = match[1].trim();
  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        enablePassword: password
      }
    }
  };
}

function cmdServicePasswordEncryption(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        servicePasswordEncryption: true
      }
    }
  };
}

function cmdNoServicePasswordEncryption(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        servicePasswordEncryption: false
      }
    }
  };
}

function cmdUsername(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^username\s+(\S+)\s+(password|privilege)\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid username command' };
  
  const username = match[1];
  const type = match[2].toLowerCase();
  const value = match[3].trim();
  
  const existingIndex = state.security.users.findIndex(u => u.username === username);
  const newUsers = [...state.security.users];
  
  if (existingIndex >= 0) {
    if (type === 'password') {
      newUsers[existingIndex] = { ...newUsers[existingIndex], password: value };
    } else {
      newUsers[existingIndex] = { ...newUsers[existingIndex], privilege: parseInt(value) || 1 };
    }
  } else {
    newUsers.push({
      username,
      password: type === 'password' ? value : '',
      privilege: type === 'privilege' ? parseInt(value) || 1 : 1
    });
  }
  
  return {
    success: true,
    newState: {
      security: { ...state.security, users: newUsers }
    }
  };
}

function cmdBannerMotd(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^banner\s+motd\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid banner' };
  
  let banner = match[1];
  // # işaretleri arasındaki metni al
  const delimMatch = banner.match(/^(\S)(.*?)\1$/);
  if (delimMatch) {
    banner = delimMatch[2];
  }
  
  return {
    success: true,
    newState: { bannerMOTD: banner }
  };
}

function cmdNoBannerMotd(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: { bannerMOTD: undefined }
  };
}

// Interface komutları
function cmdInterface(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^interface\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid interface' };
  
  const portInput = match[1].trim();
  const portId = normalizePortId(portInput);
  
  if (!portId) {
    return { success: false, error: '% Invalid interface name' };
  }
  
  // Port yoksa oluştur
  const newPorts = { ...state.ports };
  if (!newPorts[portId]) {
    const isGigabit = portId.startsWith('gi');
    newPorts[portId] = {
      id: portId,
      name: '',
      status: 'notconnect',
      vlan: 1,
      mode: 'access',
      duplex: 'auto',
      speed: 'auto',
      shutdown: true,
      type: isGigabit ? 'gigabitethernet' : 'fastethernet'
    };
  }
  
  return {
    success: true,
    newState: {
      currentMode: 'interface',
      currentInterface: portId,
      selectedInterfaces: undefined,  // Tek port seçiminde range'i temizle
      ports: newPorts
    }
  };
}

function cmdNoShutdown(state: SwitchState): CommandResult {
  // Interface range ile çoklu port seçimi
  const interfaces = state.selectedInterfaces || (state.currentInterface ? [state.currentInterface] : []);
  
  if (interfaces.length === 0) {
    return { success: false, error: '% No interface selected' };
  }
  
  const newPorts = { ...state.ports };
  
  for (const portId of interfaces) {
    if (newPorts[portId]) {
      const port = newPorts[portId];
      // Önceki durumu geri yükle, yoksa notconnect yap
      const restoredStatus = port.previousStatus || 'notconnect';
      
      newPorts[portId] = {
        ...port,
        shutdown: false,
        status: restoredStatus
      };
    }
  }
  
  return {
    success: true,
    newState: { ports: newPorts }
  };
}

function cmdShutdown(state: SwitchState): CommandResult {
  // Interface range ile çoklu port seçimi
  const interfaces = state.selectedInterfaces || (state.currentInterface ? [state.currentInterface] : []);
  
  if (interfaces.length === 0) {
    return { success: false, error: '% No interface selected' };
  }
  
  const newPorts = { ...state.ports };
  
  for (const portId of interfaces) {
    if (newPorts[portId]) {
      const port = newPorts[portId];
      
      // Önceki durumu kaydet (no shutdown için)
      const savedStatus: PortStatus = port.status === 'disabled' ? 'notconnect' : port.status;
      
      newPorts[portId] = {
        ...port,
        shutdown: true,
        status: 'disabled' as PortStatus,
        previousStatus: savedStatus
      };
    }
  }
  
  return {
    success: true,
    newState: { ports: newPorts }
  };
}

function cmdSpeed(state: SwitchState, input: string): CommandResult {
  const interfaces = state.selectedInterfaces || (state.currentInterface ? [state.currentInterface] : []);
  
  if (interfaces.length === 0) {
    return { success: false, error: '% No interface selected' };
  }
  
  const match = input.match(/^speed\s+(10|100|1000|auto)$/i);
  if (!match) return { success: false, error: '% Invalid speed value' };
  
  const speed = match[1] as '10' | '100' | '1000' | 'auto';
  
  const newPorts = { ...state.ports };
  for (const portId of interfaces) {
    if (newPorts[portId]) {
      newPorts[portId] = { ...newPorts[portId], speed };
    }
  }
  
  return {
    success: true,
    newState: { ports: newPorts }
  };
}

function cmdDuplex(state: SwitchState, input: string): CommandResult {
  const interfaces = state.selectedInterfaces || (state.currentInterface ? [state.currentInterface] : []);
  
  if (interfaces.length === 0) {
    return { success: false, error: '% No interface selected' };
  }
  
  const match = input.match(/^duplex\s+(half|full|auto)$/i);
  if (!match) return { success: false, error: '% Invalid duplex value' };
  
  const duplex = match[1] as 'half' | 'full' | 'auto';
  
  const newPorts = { ...state.ports };
  for (const portId of interfaces) {
    if (newPorts[portId]) {
      newPorts[portId] = { ...newPorts[portId], duplex };
    }
  }
  
  return {
    success: true,
    newState: { ports: newPorts }
  };
}

function cmdDescription(state: SwitchState, input: string): CommandResult {
  const interfaces = state.selectedInterfaces || (state.currentInterface ? [state.currentInterface] : []);
  
  if (interfaces.length === 0) {
    return { success: false, error: '% No interface selected' };
  }
  
  const match = input.match(/^description\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid description' };
  
  const description = match[1].trim();
  
  const newPorts = { ...state.ports };
  for (const portId of interfaces) {
    if (newPorts[portId]) {
      newPorts[portId] = { ...newPorts[portId], name: description };
    }
  }
  
  return {
    success: true,
    newState: { ports: newPorts }
  };
}

function cmdNoDescription(state: SwitchState): CommandResult {
  const interfaces = state.selectedInterfaces || (state.currentInterface ? [state.currentInterface] : []);
  
  if (interfaces.length === 0) {
    return { success: false, error: '% No interface selected' };
  }
  
  const newPorts = { ...state.ports };
  for (const portId of interfaces) {
    if (newPorts[portId]) {
      newPorts[portId] = { ...newPorts[portId], name: '' };
    }
  }
  
  return {
    success: true,
    newState: { ports: newPorts }
  };
}

function cmdSwitchportMode(state: SwitchState, input: string): CommandResult {
  const interfaces = state.selectedInterfaces || (state.currentInterface ? [state.currentInterface] : []);
  
  if (interfaces.length === 0) {
    return { success: false, error: '% No interface selected' };
  }
  
  const match = input.match(/^switchport\s+mode\s+(access|trunk)$/i);
  if (!match) return { success: false, error: '% Invalid mode' };
  
  const mode = match[1] as 'access' | 'trunk';
  
  const newPorts = { ...state.ports };
  for (const portId of interfaces) {
    if (newPorts[portId]) {
      newPorts[portId] = { ...newPorts[portId], mode };
    }
  }
  
  return {
    success: true,
    newState: { ports: newPorts }
  };
}

function cmdSwitchportAccessVlan(state: SwitchState, input: string): CommandResult {
  const interfaces = state.selectedInterfaces || (state.currentInterface ? [state.currentInterface] : []);
  
  if (interfaces.length === 0) {
    return { success: false, error: '% No interface selected' };
  }
  
  const match = input.match(/^switchport\s+access\s+vlan\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid VLAN ID' };
  
  const vlanId = parseInt(match[1]);
  
  if (!state.vlans[vlanId]) {
    return { success: false, error: `% VLAN ${vlanId} does not exist` };
  }
  
  const newPorts = { ...state.ports };
  for (const portId of interfaces) {
    if (newPorts[portId]) {
      newPorts[portId] = { ...newPorts[portId], vlan: vlanId };
    }
  }
  
  return {
    success: true,
    newState: { ports: newPorts }
  };
}

function cmdSwitchportTrunkAllowedVlan(state: SwitchState, input: string): CommandResult {
  // Bu komut için şimdilik sadece success dönüyoruz
  return { success: true };
}

// VLAN config komutları
function cmdVlanName(state: SwitchState, input: string): CommandResult {
  if (!state.currentVlan) {
    return { success: false, error: '% No VLAN selected' };
  }
  
  const match = input.match(/^name\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid name' };
  
  const name = match[1].trim();
  
  const newVlans = { ...state.vlans };
  newVlans[state.currentVlan] = {
    ...newVlans[state.currentVlan],
    name
  };
  
  return {
    success: true,
    newState: { vlans: newVlans }
  };
}

function cmdNoVlanName(state: SwitchState): CommandResult {
  if (!state.currentVlan) {
    return { success: false, error: '% No VLAN selected' };
  }
  
  const newVlans = { ...state.vlans };
  newVlans[state.currentVlan] = {
    ...newVlans[state.currentVlan],
    name: `VLAN${state.currentVlan}`
  };
  
  return {
    success: true,
    newState: { vlans: newVlans }
  };
}

// Line komutları
function cmdLineConsole(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: {
      currentMode: 'line',
      currentLine: 'console 0'
    }
  };
}

function cmdLineVty(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^line\s+vty\s+(\d+)\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid VTY range' };
  
  return {
    success: true,
    newState: {
      currentMode: 'line',
      currentLine: `vty ${match[1]} ${match[2]}`
    }
  };
}

function cmdPassword(state: SwitchState, input: string): CommandResult {
  if (!state.currentLine) {
    return { success: false, error: '% No line selected' };
  }
  
  const match = input.match(/^password\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid password' };
  
  const password = match[1].trim();
  
  if (state.currentLine.startsWith('console')) {
    return {
      success: true,
      newState: {
        security: {
          ...state.security,
          consoleLine: { ...state.security.consoleLine, password }
        }
      }
    };
  } else {
    return {
      success: true,
      newState: {
        security: {
          ...state.security,
          vtyLines: { ...state.security.vtyLines, password }
        }
      }
    };
  }
}

function cmdNoLogin(state: SwitchState): CommandResult {
  if (!state.currentLine) {
    return { success: false, error: '% No line selected' };
  }
  
  if (state.currentLine.startsWith('console')) {
    return {
      success: true,
      newState: {
        security: {
          ...state.security,
          consoleLine: { ...state.security.consoleLine, login: false }
        }
      }
    };
  } else {
    return {
      success: true,
      newState: {
        security: {
          ...state.security,
          vtyLines: { ...state.security.vtyLines, login: false }
        }
      }
    };
  }
}

function cmdTransportInput(state: SwitchState, input: string): CommandResult {
  if (!state.currentLine) {
    return { success: false, error: '% No line selected' };
  }
  
  const match = input.match(/^transport\s+input\s+(ssh|telnet|all|none)$/i);
  if (!match) return { success: false, error: '% Invalid transport input' };
  
  const transport = match[1].toLowerCase() as 'ssh' | 'telnet' | 'all' | 'none';
  
  if (state.currentLine.startsWith('console')) {
    return {
      success: true,
      newState: {
        security: {
          ...state.security,
          consoleLine: { ...state.security.consoleLine, transportInput: [transport] }
        }
      }
    };
  } else {
    return {
      success: true,
      newState: {
        security: {
          ...state.security,
          vtyLines: { ...state.security.vtyLines, transportInput: [transport] }
        }
      }
    };
  }
}

function cmdShowInterfacesStatus(state: SwitchState): CommandResult {
  let output = 'Port      Name               Status       Vlan       Duplex  Speed Type\n';
  output += '--------- ------------------ ------------ ---------- ------ ------ ------------\n';
  
  Object.values(state.ports).forEach(port => {
    const portUpper = port.id.toUpperCase();
    const name = port.name.substring(0, 18).padEnd(18);
    const status = port.shutdown ? 'disabled' : 
                   port.status === 'connected' ? 'connected' : 'notconnect';
    const vlan = port.mode === 'trunk' ? 'trunk' : port.vlan.toString();
    const duplex = port.duplex === 'auto' ? 'a-' + (port.status === 'connected' ? 'full' : 'auto') : port.duplex;
    const speed = port.speed === 'auto' ? 'a-' + (port.status === 'connected' ? (port.type === 'gigabitethernet' ? '1000' : '100') : 'auto') : port.speed;
    const type = port.type === 'gigabitethernet' ? '10/100/1000BaseTX' : '10/100BaseTX';
    
    output += `${portUpper.padEnd(9)} ${name} ${status.padEnd(12)} ${vlan.padEnd(10)} ${(duplex).padEnd(6)} ${(speed).padEnd(6)} ${type}\n`;
  });
  
  return { success: true, output };
}

function cmdShowInterface(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^show\s+interface\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid interface' };
  
  const portId = normalizePortId(match[1]);
  if (!portId || !state.ports[portId]) {
    return { success: false, error: '% Invalid interface' };
  }
  
  const port = state.ports[portId];
  const portUpper = port.id.toUpperCase().replace('FA', 'FastEthernet').replace('GI', 'GigabitEthernet');
  const status = port.shutdown ? 'administratively down' : 
                 port.status === 'connected' ? 'up' : 'down';
  const lineProtocol = port.status === 'connected' && !port.shutdown ? 'up' : 'down';
  
  let output = `${portUpper} is ${status}, line protocol is ${lineProtocol}\n`;
  output += `  Hardware is ${port.type === 'gigabitethernet' ? 'Gigabit Ethernet' : 'Fast Ethernet'}\n`;
  output += `  Description: ${port.name || '(not set)'}\n`;
  output += `  VLAN: ${port.vlan}, Mode: ${port.mode}\n`;
  
  return { success: true, output };
}

function cmdShowVlanBrief(state: SwitchState): CommandResult {
  let output = '\nVLAN Name                             Status    Ports\n';
  output += '---- -------------------------------- --------- -------------------------------\n';
  
  Object.values(state.vlans).forEach(vlan => {
    const id = vlan.id.toString().padEnd(4);
    const name = vlan.name.substring(0, 32).padEnd(32);
    const status = vlan.status.padEnd(9);
    
    // VLAN'a atanmış portları bul
    const vlanPorts = Object.values(state.ports)
      .filter(p => p.vlan === vlan.id && !p.shutdown)
      .map(p => p.id.toUpperCase());
    
    // Portları satırlara böl
    let portStr = '';
    if (vlanPorts.length > 0) {
      portStr = vlanPorts.join(', ');
    }
    
    output += `${id} ${name} ${status}    ${portStr}\n`;
  });
  
  return { success: true, output };
}

function cmdShowVersion(state: SwitchState): CommandResult {
  let output = `\n${state.hostname} uptime is ${state.version.uptime}\n`;
  output += `System returned to ROM by power-on\n`;
  output += `System image file is "flash:c2960-lanbase-mz.150-2.SE4.bin"\n\n`;
  output += `cisco ${state.version.modelName} (PowerPC) processor (revision B0) with 65536K bytes of memory.\n`;
  output += `Processor board ID ${state.version.serialNumber}\n`;
  output += `24 FastEthernet interfaces\n`;
  output += `2 Gigabit Ethernet interfaces\n`;
  output += `64K bytes of flash-simulated non-volatile configuration memory.\n`;
  output += `Base ethernet MAC Address       : 0011.2233.4400\n`;
  output += `Motherboard assembly number     : 73-9897-01\n`;
  output += `Power supply part number        : 341-0097-01\n`;
  output += `Motherboard serial number       : FOC12345XYZ\n`;
  output += `Power supply serial number      : DCA1234ABCD\n`;
  output += `Model revision number           : B0\n`;
  output += `Motherboard revision number     : A0\n`;
  output += `Model number                    : ${state.version.modelName}\n`;
  output += `System serial number            : ${state.version.serialNumber}\n`;
  output += `Top Assembly Part Number        : 800-23456-01\n`;
  output += `Top Assembly Revision Number    : A0\n`;
  output += `Version ID                      : V01\n`;
  output += `Configuration register is 0xF\n`;
  
  return { success: true, output };
}

function cmdShowMacAddressTable(state: SwitchState): CommandResult {
  let output = '\n          Mac Address Table\n';
  output += '-------------------------------------------\n\n';
  output += 'Vlan    Mac Address       Type        Ports\n';
  output += '----    -----------       --------    -----\n';
  
  state.macAddressTable.forEach(entry => {
    output += `${entry.vlan.toString().padEnd(7)} ${entry.mac.padEnd(17)} ${entry.type.padEnd(11)} ${entry.port}\n`;
  });
  
  output += '\nTotal Mac Addresses for this criterion: ' + state.macAddressTable.length + '\n';
  
  return { success: true, output };
}

// Kaydetme komutu
function cmdWriteMemory(state: SwitchState): CommandResult {
  return {
    success: true,
    output: 'Building configuration...\n[OK]'
  };
}

// Yardım komutu
function cmdHelp(state: SwitchState, language: 'tr' | 'en' = 'tr'): CommandResult {
  return {
    success: true,
    output: getHelpContent(state.currentMode, language)
  };
}

// Running config oluştur
function generateRunningConfig(state: SwitchState): string {
  let config = '!\n';
  config += `hostname ${state.hostname}\n`;
  config += '!\n';
  
  // Banner
  if (state.bannerMOTD) {
    config += `banner motd #${state.bannerMOTD}#\n`;
    config += '!\n';
  }
  
  // Enable secret/password
  if (state.security.enableSecret) {
    if (state.security.servicePasswordEncryption && state.security.enableSecretEncrypted) {
      config += `enable secret 5 ${encryptPassword(state.security.enableSecret)}\n`;
    } else {
      config += `enable secret ${state.security.enableSecret}\n`;
    }
  }
  if (state.security.enablePassword) {
    if (state.security.servicePasswordEncryption) {
      config += `enable password 7 ${encryptPassword(state.security.enablePassword)}\n`;
    } else {
      config += `enable password ${state.security.enablePassword}\n`;
    }
  }
  
  // Password encryption
  if (state.security.servicePasswordEncryption) {
    config += 'service password-encryption\n';
  }
  config += '!\n';
  
  // Users
  state.security.users.forEach(user => {
    config += `username ${user.username} privilege ${user.privilege} password ${user.password}\n`;
  });
  if (state.security.users.length > 0) config += '!\n';
  
  // Interfaces
  Object.values(state.ports).forEach(port => {
    const portUpper = port.id.toUpperCase().replace('FA', 'FastEthernet').replace('GI', 'GigabitEthernet');
    config += `interface ${portUpper}\n`;
    if (port.name) {
      config += ` description ${port.name}\n`;
    }
    if (port.shutdown) {
      config += ' shutdown\n';
    }
    if (port.mode === 'trunk') {
      config += ' switchport mode trunk\n';
    } else if (port.vlan !== 1) {
      config += ` switchport access vlan ${port.vlan}\n`;
    }
    if (port.speed !== 'auto') {
      config += ` speed ${port.speed}\n`;
    }
    if (port.duplex !== 'auto') {
      config += ` duplex ${port.duplex}\n`;
    }
    config += '!\n';
  });
  
  // VLANs
  Object.values(state.vlans).forEach(vlan => {
    if (vlan.id >= 2 && vlan.id <= 1001 && vlan.name !== `VLAN${vlan.id}`) {
      config += `vlan ${vlan.id}\n`;
      config += ` name ${vlan.name}\n`;
      config += '!\n';
    }
  });
  
  // Line console
  config += 'line con 0\n';
  if (state.security.consoleLine.password) {
    config += ` password ${state.security.consoleLine.password}\n`;
  }
  if (state.security.consoleLine.login) {
    config += ' login\n';
  }
  config += '!\n';
  
  // Line VTY
  config += 'line vty 0 4\n';
  if (state.security.vtyLines.password) {
    config += ` password ${state.security.vtyLines.password}\n`;
  }
  if (state.security.vtyLines.login) {
    config += ' login\n';
  }
  if (state.security.vtyLines.transportInput.length > 0 && 
      state.security.vtyLines.transportInput[0] !== 'all') {
    config += ` transport input ${state.security.vtyLines.transportInput.join(' ')}\n`;
  }
  config += '!\n';
  
  config += 'end\n';
  
  return config;
}

// Basit şifreleme (gerçek değil, sadece gösterim için)
function encryptPassword(password: string): string {
  let encrypted = '';
  for (let i = 0; i < password.length; i++) {
    encrypted += (password.charCodeAt(i) + 7).toString(16).padStart(2, '0');
  }
  return encrypted.substring(0, 16);
}

// ============ YENİ KOMUT FONKSİYONLARI ============

// No username
function cmdNoUsername(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^no\s+username\s+(\S+)$/i);
  if (!match) return { success: false, error: '% Invalid username' };
  
  const username = match[1];
  const newUsers = state.security.users.filter(u => u.username !== username);
  
  return {
    success: true,
    newState: { security: { ...state.security, users: newUsers } }
  };
}

// IP Domain Name
function cmdIpDomainName(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^ip\s+domain-name\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid domain name' };
  
  return {
    success: true,
    newState: { domainName: match[1].trim() }
  };
}

// IP Default Gateway
function cmdIpDefaultGateway(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^ip\s+default-gateway\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (!match) return { success: false, error: '% Invalid IP address' };
  
  return {
    success: true,
    newState: { defaultGateway: match[1] }
  };
}

// IP SSH Version
function cmdIpSshVersion(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^ip\s+ssh\s+version\s+(1|2)$/i);
  if (!match) return { success: false, error: '% Invalid SSH version' };
  
  return {
    success: true,
    newState: { sshVersion: parseInt(match[1]) as 1 | 2 }
  };
}

// Crypto Key Generate RSA
function cmdCryptoKeyGenerateRsa(state: SwitchState): CommandResult {
  return {
    success: true,
    output: 'The name for the keys will be: Switch.test.local\nChoose the size of the key modulus in the range of 360 to 2048 for your General Purpose Keys. Choosing a key modulus greater than 512 may take a few minutes.\n\nHow many bits in the modulus [512]: 1024\n% Generating 1024 bit RSA keys, keys will be non-exportable...[OK]\n\n%SSH-1.5 has been enabled'
  };
}

// CDP Run
function cmdCdpRun(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: { cdpEnabled: true }
  };
}

// No CDP Run
function cmdNoCdpRun(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: { cdpEnabled: false }
  };
}

// Spanning-Tree Mode
function cmdSpanningTreeMode(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^spanning-tree\s+mode\s+(pvst|rapid-pvst|mst)$/i);
  if (!match) return { success: false, error: '% Invalid spanning-tree mode' };
  
  return {
    success: true,
    newState: { spanningTreeMode: match[1].toLowerCase() as 'pvst' | 'rapid-pvst' | 'mst' }
  };
}

// VTP Mode
function cmdVtpMode(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^vtp\s+mode\s+(server|client|transparent|off)$/i);
  if (!match) return { success: false, error: '% Invalid VTP mode' };
  
  return {
    success: true,
    newState: { vtpMode: match[1].toLowerCase() as 'server' | 'client' | 'transparent' | 'off' }
  };
}

// VTP Domain
function cmdVtpDomain(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^vtp\s+domain\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid VTP domain' };
  
  return {
    success: true,
    newState: { vtpDomain: match[1].trim() }
  };
}

// MLS QoS
function cmdMlsQos(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: { mlsQosEnabled: true }
  };
}

// No MLS QoS
function cmdNoMlsQos(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: { mlsQosEnabled: false }
  };
}

// IP DHCP Snooping
function cmdIpDhcpSnooping(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: { dhcpSnoopingEnabled: true }
  };
}

// No IP DHCP Snooping
function cmdNoIpDhcpSnooping(state: SwitchState): CommandResult {
  return {
    success: true,
    newState: { dhcpSnoopingEnabled: false }
  };
}

// IP DHCP Snooping VLAN
function cmdIpDhcpSnoopingVlan(state: SwitchState, input: string): CommandResult {
  return { success: true };
}

// SNMP Server Community
function cmdSnmpServerCommunity(state: SwitchState, input: string): CommandResult {
  return { success: true };
}

// NTP Server
function cmdNtpServer(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^ntp\s+server\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (!match) return { success: false, error: '% Invalid NTP server address' };
  
  const ntpServers = [...(state.ntpServers || []), match[1]];
  return {
    success: true,
    newState: { ntpServers }
  };
}

// Interface Range
function cmdInterfaceRange(state: SwitchState, input: string): CommandResult {
  // "interface range fa0/1-24" veya "int r fa0/1-24" gibi formatları kabul et
  const match = input.match(/^interface\s+r(?:ange)?\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid interface range' };
  
  const rangeInput = match[1].trim();
  const selectedPorts: string[] = [];
  
  // Virgülle ayrılmış birden fazla range desteği: fa0/1-12,gi0/1-2 veya fa0/1-2,fa0/5-6
  const ranges = rangeInput.split(',').map(r => r.trim());
  
  for (const range of ranges) {
    // Boşlukları kaldır (örn: "fa 0/1-2" -> "fa0/1-2")
    const normalizedRange = range.replace(/\s+/g, '').toLowerCase();
    
    // FastEthernet range: fa0/1-24, fa0/1, fastethernet0/1-24
    const faMatch = normalizedRange.match(/^(?:fa|fastethernet|fast|f)(\d+)\/(\d+)(?:-(\d+))?$/);
    // GigabitEthernet range: gi0/1-2, gig0/1-2, gigabitethernet0/1-2
    const giMatch = normalizedRange.match(/^(?:gi|gig|gigabit|gigabitethernet|g)(\d+)\/(\d+)(?:-(\d+))?$/);
    
    const portMatch = faMatch || giMatch;
    if (portMatch) {
      const prefix = faMatch ? 'fa' : 'gi';
      const moduleNum = portMatch[1];
      const startPort = parseInt(portMatch[2]);
      const endPort = portMatch[3] ? parseInt(portMatch[3]) : startPort;
      
      // Geçerli port aralığı kontrolü (0-48 arası portlar)
      if (startPort < 0 || endPort > 48 || startPort > endPort) {
        return { success: false, error: '% Invalid port range. Valid range: 0-48' };
      }
      
      for (let i = startPort; i <= endPort; i++) {
        selectedPorts.push(`${prefix}${moduleNum}/${i}`);
      }
    }
  }
  
  if (selectedPorts.length === 0) {
    return { success: false, error: '% Invalid interface range format. Examples: fa0/1-24, gi0/1-2, fa0/1-2,gi0/1-2' };
  }
  
  // Portları oluştur (yoksa)
  const newPorts = { ...state.ports };
  for (const portId of selectedPorts) {
    if (!newPorts[portId]) {
      const isGigabit = portId.startsWith('gi');
      newPorts[portId] = {
        id: portId,
        name: '',
        status: 'notconnect',
        vlan: 1,
        mode: 'access',
        duplex: 'auto',
        speed: 'auto',
        shutdown: false,
        type: isGigabit ? 'gigabitethernet' : 'fastethernet'
      };
    }
  }
  
  return {
    success: true,
    newState: {
      currentMode: 'interface',
      currentInterface: selectedPorts[0],
      selectedInterfaces: selectedPorts,
      ports: newPorts
    }
  };
}

// Switchport Trunk Native VLAN
function cmdSwitchportTrunkNativeVlan(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }
  
  const match = input.match(/^switchport\s+trunk\s+native\s+vlan\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid VLAN ID' };
  
  return { success: true };
}

// Switchport Port-Security
function cmdSwitchportPortSecurity(state: SwitchState): CommandResult {
  if (!state.currentInterface) {
    return { success: false, error: '% No interface selected' };
  }
  
  const newPorts = { ...state.ports };
  newPorts[state.currentInterface] = {
    ...newPorts[state.currentInterface],
    portSecurity: {
      enabled: true,
      maxMac: 1,
      violation: 'shutdown',
      stickyMac: false
    }
  };
  
  return { success: true, newState: { ports: newPorts } };
}

// Switchport Port-Security Maximum
function cmdSwitchportPortSecurityMaximum(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  
  const match = input.match(/^switchport\s+port-security\s+maximum\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid maximum value' };
  
  const newPorts = { ...state.ports };
  const port = newPorts[state.currentInterface];
  if (port.portSecurity) {
    port.portSecurity.maxMac = parseInt(match[1]);
  }
  
  return { success: true, newState: { ports: newPorts } };
}

// Switchport Port-Security Violation
function cmdSwitchportPortSecurityViolation(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  
  const match = input.match(/^switchport\s+port-security\s+violation\s+(protect|restrict|shutdown)$/i);
  if (!match) return { success: false, error: '% Invalid violation mode' };
  
  const newPorts = { ...state.ports };
  const port = newPorts[state.currentInterface];
  if (port.portSecurity) {
    port.portSecurity.violation = match[1].toLowerCase() as 'protect' | 'restrict' | 'shutdown';
  }
  
  return { success: true, newState: { ports: newPorts } };
}

// Switchport Port-Security MAC-Address
function cmdSwitchportPortSecurityMac(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// Switchport Port-Security Sticky
function cmdSwitchportPortSecuritySticky(state: SwitchState): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  
  const newPorts = { ...state.ports };
  const port = newPorts[state.currentInterface];
  if (port.portSecurity) {
    port.portSecurity.stickyMac = true;
  }
  
  return { success: true, newState: { ports: newPorts } };
}

// Switchport Voice VLAN
function cmdSwitchportVoiceVlan(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// CDP Enable (Interface)
function cmdCdpEnable(state: SwitchState): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// No CDP Enable (Interface)
function cmdNoCdpEnable(state: SwitchState): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// Channel-Group
function cmdChannelGroup(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// Spanning-Tree PortFast
function cmdSpanningTreePortfast(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// Spanning-Tree BPDUGuard
function cmdSpanningTreeBpduguard(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// Storm-Control
function cmdStormControl(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// MLS QoS Trust
function cmdMlsQosTrust(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// UDLD Enable
function cmdUdldEnable(state: SwitchState): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// Power Inline
function cmdPowerInline(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// IP Address
function cmdIpAddress(state: SwitchState, input: string): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// IP DHCP Snooping Trust
function cmdIpDhcpSnoopingTrust(state: SwitchState): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// No IP DHCP Snooping Trust
function cmdNoIpDhcpSnoopingTrust(state: SwitchState): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// IP ARP Inspection Trust
function cmdIpArpInspectionTrust(state: SwitchState): CommandResult {
  if (!state.currentInterface) return { success: false, error: '% No interface selected' };
  return { success: true };
}

// VLAN State
function cmdVlanState(state: SwitchState, input: string): CommandResult {
  if (!state.currentVlan) return { success: false, error: '% No VLAN selected' };
  
  const match = input.match(/^state\s+(active|suspend)$/i);
  if (!match) return { success: false, error: '% Invalid state' };
  
  const newVlans = { ...state.vlans };
  newVlans[state.currentVlan] = {
    ...newVlans[state.currentVlan],
    status: match[1].toLowerCase() === 'active' ? 'active' : 'suspend'
  };
  
  return { success: true, newState: { vlans: newVlans } };
}

// Login with local option
function cmdLogin(state: SwitchState, input: string): CommandResult {
  if (!state.currentLine) return { success: false, error: '% No line selected' };
  
  const isLocal = input.toLowerCase().includes('local');
  
  if (state.currentLine.startsWith('console')) {
    return {
      success: true,
      newState: {
        security: {
          ...state.security,
          consoleLine: { ...state.security.consoleLine, login: true, loginLocal: isLocal }
        }
      }
    };
  } else {
    return {
      success: true,
      newState: {
        security: {
          ...state.security,
          vtyLines: { ...state.security.vtyLines, login: true, loginLocal: isLocal }
        }
      }
    };
  }
}

// Exec-Timeout
function cmdExecTimeout(state: SwitchState, input: string): CommandResult {
  if (!state.currentLine) return { success: false, error: '% No line selected' };
  return { success: true };
}

// Logging Synchronous
function cmdLoggingSynchronous(state: SwitchState): CommandResult {
  if (!state.currentLine) return { success: false, error: '% No line selected' };
  return { success: true };
}

// No Logging Synchronous
function cmdNoLoggingSynchronous(state: SwitchState): CommandResult {
  if (!state.currentLine) return { success: false, error: '% No line selected' };
  return { success: true };
}

// History Size
function cmdHistorySize(state: SwitchState, input: string): CommandResult {
  if (!state.currentLine) return { success: false, error: '% No line selected' };
  return { success: true };
}

// Show Running Config with filter support
function cmdShowRunningConfig(state: SwitchState, input: string): CommandResult {
  const config = generateRunningConfig(state);
  
  // Check for pipe filters
  const pipeMatch = input.match(/\|\s+(include|section|begin|exclude)\s+(.+)$/i);
  if (pipeMatch) {
    const filter = pipeMatch[1].toLowerCase();
    const pattern = pipeMatch[2].toLowerCase();
    const lines = config.split('\n');
    
    const filteredLines = lines.filter(line => {
      switch (filter) {
        case 'include':
        case 'section':
          return line.toLowerCase().includes(pattern);
        case 'begin':
          return true; // Show from first match
        case 'exclude':
          return !line.toLowerCase().includes(pattern);
        default:
          return true;
      }
    });
    
    return { success: true, output: filteredLines.join('\n') };
  }
  
  return { success: true, output: config };
}

// Show Startup Config
function cmdShowStartupConfig(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '!\n! Startup configuration is not available in simulation\n!\n'
  };
}

// Show Interfaces with filter
function cmdShowInterfaces(state: SwitchState, input: string): CommandResult {
  // Check if status or specific interface
  if (input.toLowerCase().includes('status')) {
    return cmdShowInterfacesStatus(state);
  }
  
  let output = '';
  
  Object.values(state.ports).forEach(port => {
    const portUpper = port.id.toUpperCase().replace('FA', 'FastEthernet').replace('GI', 'GigabitEthernet');
    const status = port.shutdown ? 'administratively down' : 
                   port.status === 'connected' ? 'up' : 'down';
    const lineProtocol = port.status === 'connected' && !port.shutdown ? 'up' : 'down';
    
    output += `${portUpper} is ${status}, line protocol is ${lineProtocol}\n`;
    output += `  Description: ${port.name || '(not set)'}\n`;
    output += `  Hardware is ${port.type === 'gigabitethernet' ? 'Gigabit Ethernet' : 'Fast Ethernet'}\n`;
    output += `  VLAN: ${port.vlan}, Mode: ${port.mode}\n`;
    output += `  Duplex: ${port.duplex}, Speed: ${port.speed}\n\n`;
  });
  
  return { success: true, output };
}

// Show CDP Neighbors
function cmdShowCdpNeighbors(state: SwitchState, input: string): CommandResult {
  const isDetail = input.toLowerCase().includes('detail');
  
  if (isDetail) {
    return {
      success: true,
      output: `\n-------------------------\nDevice ID: Core-Switch-01\nEntry address(es): \n  IP address: 192.168.1.1\nPlatform: cisco WS-C2960-24TT-L,  Capabilities: Switch \nInterface: Gi0/1,  Port ID (outgoing port): Gi0/24\nHoldtime : 163 sec\n\nVersion :\nCisco IOS Software, C2960 Software (C2960-LANBASE-M), Version 15.0(2)SE4\n\nadvertisement version: 2\nProtocol Hello:  OUI=0x00000C, Protocol ID=0x0112; payload len=27, value=00000000FFFFFFFF010221FF000000000000000000000000\nVTP Management Domain: 'LOCAL'\nDuplex: full\nManagement address(es):\n  IP address: 192.168.1.1\n`
    };
  }
  
  let output = '\nCapability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge\n                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone\n\n';
  output += 'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\n';
  output += 'Core-Switch-01   Gi0/1             163        S           WS-C2960  Gi0/24\n';
  output += 'Router-Edge      Gi0/1             150        R S I       2911      Gi0/0\n';
  
  return { success: true, output };
}

// Show IP Interface Brief
function cmdShowIpInterfaceBrief(state: SwitchState): CommandResult {
  let output = '\nInterface              IP-Address      OK? Method Status                Protocol\n';
  output += 'Vlan1                  unassigned      YES unset  administratively down down\n';
  output += 'FastEthernet0/1        unassigned      YES unset  up                    up\n';
  output += 'FastEthernet0/2        unassigned      YES unset  up                    up\n';
  output += 'FastEthernet0/3        unassigned      YES unset  up                    up\n';
  output += 'GigabitEthernet0/1     unassigned      YES unset  up                    up\n';
  
  return { success: true, output };
}

// Show Spanning-Tree
function cmdShowSpanningTree(state: SwitchState): CommandResult {
  let output = '\nVLAN0001\n';
  output += '  Spanning tree enabled protocol ieee\n';
  output += '  Root ID    Priority    32769\n';
  output += '             Address     0011.2233.4400\n';
  output += '             This bridge is the root\n';
  output += '             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n\n';
  output += '  Bridge ID  Priority    32769  (priority 32768 sys-id-ext 1)\n';
  output += '             Address     0011.2233.4400\n';
  output += '             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n';
  output += '             Aging Time  15 sec\n\n';
  output += 'Interface           Role Sts Cost      Prio.Nbr Type\n';
  output += '------------------- ---- --- --------- -------- --------------------------------\n';
  output += 'Fa0/1               Desg FWD 19        128.1    P2p\n';
  output += 'Fa0/2               Desg FWD 19        128.2    P2p\n';
  output += 'Gi0/1               Desg FWD 4         128.25   P2p\n';
  
  return { success: true, output };
}

// Show Port-Security
function cmdShowPortSecurity(state: SwitchState): CommandResult {
  let output = '\nSecure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action\n';
  output += '               (Count)       (Count)      (Count)\n';
  output += '-------------------------------------------------------------------------\n';
  
  const securedPorts = Object.values(state.ports).filter(p => p.portSecurity?.enabled);
  if (securedPorts.length === 0) {
    output += '(No secure ports configured)\n';
  } else {
    securedPorts.forEach(port => {
      output += `${port.id.toUpperCase().padEnd(14)}${String(port.portSecurity?.maxMac || 1).padEnd(15)}0            0                   ${port.portSecurity?.violation || 'shutdown'}\n`;
    });
  }
  
  output += '\nTotal Addresses in System: 0\n';
  output += 'Max Addresses limit in System: 6144\n';
  
  return { success: true, output };
}

// Show EtherChannel
function cmdShowEtherchannel(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nChannel-group listing:\n-----------------------\n\nNo EtherChannels configured\n'
  };
}

// Show VTP Status
function cmdShowVtpStatus(state: SwitchState): CommandResult {
  let output = '\nVTP Version capable             : 1 to 3\n';
  output += 'VTP version running             : 1\n';
  output += 'VTP Domain Name                 : ' + (state.vtpDomain || 'not set') + '\n';
  output += 'VTP Pruning Mode                : Disabled\n';
  output += 'VTP Traps Generation            : Disabled\n';
  output += 'Device ID                       : 0011.2233.4400\n';
  output += 'Configuration last modified by 0.0.0.0 at 0-0-00 00:00:00\n';
  output += 'Local updater ID is 0.0.0.0 (no valid interface found)\n';
  
  return { success: true, output };
}

// Show Errdisable Recovery
function cmdShowErrdisableRecovery(state: SwitchState): CommandResult {
  let output = '\nErrdisable Reason              Timer Status\n';
  output += '-----------------------------  --------------\n';
  output += 'arp-inspection                 Disabled\n';
  output += 'bpduguard                      Disabled\n';
  output += 'channel-misconfig              Disabled\n';
  output += 'dhcp-rate-limit                Disabled\n';
  output += 'dtp-flap                       Disabled\n';
  output += 'gbic-invalid                   Disabled\n';
  output += 'inline-power                   Disabled\n';
  output += 'l2ptguard                      Disabled\n';
  output += 'link-flap                      Disabled\n';
  output += 'loopback                       Disabled\n';
  output += 'pagp-flap                      Disabled\n';
  output += 'psecure-violation              Disabled\n';
  output += 'security-violation             Disabled\n';
  output += 'sfp-config-mismatch            Disabled\n';
  output += 'storm-control                  Disabled\n';
  output += 'udld                           Disabled\n';
  output += 'vmps                           Disabled\n';
  output += 'psp                            Disabled\n';
  output += '\nTimer interval: 300 seconds\n';
  output += '\nInterfaces that will be enabled at the next timeout:\n';
  
  return { success: true, output };
}

// Show Clock
function cmdShowClock(state: SwitchState): CommandResult {
  const now = new Date();
  return {
    success: true,
    output: `\n*${now.toTimeString().split(' ')[0]} UTC ${now.toLocaleDateString()}\n`
  };
}

// Show Flash
function cmdShowFlash(state: SwitchState): CommandResult {
  let output = '\n-#- --length-- -----date/time------ path\n';
  output += '1     616      Mar 01 2024 00:00:00 +00:00  vlan.dat\n';
  output += '2     1599     Mar 01 2024 00:00:00 +00:00  config.text\n';
  output += '3     1464     Mar 01 2024 00:00:00 +00:00  private-config.text\n';
  output += '4     3024     Mar 01 2024 00:00:00 +00:00  c2960-lanbase-mz.150-2.SE4.bin\n';
  output += '\n32505856 bytes available (29720576 bytes used)\n';
  
  return { success: true, output };
}

// Show Boot
function cmdShowBoot(state: SwitchState): CommandResult {
  let output = '\nBOOT path-list      : flash:c2960-lanbase-mz.150-2.SE4.bin\n';
  output += 'Config file         : flash:config.text\n';
  output += 'Private Config file : flash:private-config.text\n';
  output += 'Enable Break        : no\n';
  output += 'Manual Boot         : no\n';
  output += 'HELPER path-list    : \n';
  output += 'Auto upgrade        : yes\n';
  
  return { success: true, output };
}

// Show Inventory
function cmdShowInventory(state: SwitchState): CommandResult {
  let output = '\nNAME: "1", DESCR: "WS-C2960-24TT-L"\n';
  output += 'PID: WS-C2960-24TT-L  , VID: V01  , SN: ' + state.version.serialNumber + '\n';
  
  return { success: true, output };
}

// Show Users
function cmdShowUsers(state: SwitchState): CommandResult {
  let output = '\n    Line       User       Host(s)              Idle       Location\n';
  output += '   0 con 0                idle                 00:00:00 \n';
  output += '*  2 vty 0                idle                 00:00:00 192.168.1.100\n\n';
  output += '  Interface    User               Mode         Idle     Peer Address\n';
  
  return { success: true, output };
}

// Show Processes
function cmdShowProcesses(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nCPU utilization for five seconds: 2%/0%; one minute: 1%; five minutes: 1%\n PID Runtime(ms)     Invoked      uSecs   5Sec   1Min   5Min TTY Process\n   1           0           1          0  0.00%  0.00%  0.00%   0 Chunk Manager\n   2           4          44         90  0.00%  0.00%  0.00%   0 Load Meter\n'
  };
}

// Show NTP
function cmdShowNtp(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nClock is unsynchronized, stratum 16, no reference clock\nnominal freq is 119.2092 Hz, actual freq is 119.2092 Hz, precision is 2**18\nreference time: 00000000.00000000 (Mon Jan 1 00:00:00 1900)\nclock offset is 0.0000 msec, root delay is 0.00 msec\nroot dispersion is 0.02 msec, peer dispersion is 0.02 msec\n'
  };
}

// Show ARP
function cmdShowArp(state: SwitchState): CommandResult {
  let output = '\nProtocol  Address          Age (min)  Hardware Addr   Type   Interface\n';
  output += 'Internet  192.168.1.1             -   0011.2233.4401  ARPA   Vlan1\n';
  output += 'Internet  192.168.1.100          10   0001.C234.5678   ARPA   Vlan1\n';
  
  return { success: true, output };
}

// Show IP DHCP Snooping
function cmdShowIpDhcpSnooping(state: SwitchState): CommandResult {
  let output = '\nSwitch DHCP snooping is ' + (state.dhcpSnoopingEnabled ? 'enabled' : 'disabled') + '\n';
  output += 'DHCP snooping is configured on following VLANs:\n';
  output += 'Insertion of option 82 is enabled\n';
  output += 'circuit-id format: dot-decimal\n';
  output += 'Option 82 on untrusted port is not allowed\n';
  
  return { success: true, output };
}

// Show IP ARP Inspection
function cmdShowIpArpInspection(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nSource Mac Validation      : Disabled\nDestination Mac Validation : Disabled\nIP Address Validation      : Disabled\n'
  };
}

// Show Access Lists
function cmdShowAccessLists(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nNo access-lists configured\n'
  };
}

// Show System MTU
function cmdShowSystemMtu(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nSystem MTU size is 1500 bytes\nSystem Jumbo MTU size is 9000 bytes\nRouting MTU size is 1500 bytes\n'
  };
}

// Show SDM Prefer
function cmdShowSdmPrefer(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nThe current template is "default" template.\nThe selected template optimizes the resources in the switch to support this level of features for 0 routed interfaces and 1024 VLANs.\n'
  };
}

// Show History
function cmdShowHistory(state: SwitchState): CommandResult {
  const history = state.commandHistory.slice(-20).join('\n');
  return {
    success: true,
    output: '\n' + (history || 'No commands in history') + '\n'
  };
}

// Show Banner MOTD
function cmdShowBannerMotd(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\n' + (state.bannerMOTD || 'No MOTD banner configured') + '\n'
  };
}

// Show UDLD
function cmdShowUdld(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nUDLD is globally enabled.\nNo neighbors on any interface.\n'
  };
}

// Show LLDP
function cmdShowLldp(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nLLDP is not enabled\n'
  };
}

// Show MLS QoS
function cmdShowMlsQos(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nQoS is ' + (state.mlsQosEnabled ? 'enabled' : 'disabled') + '\n'
  };
}

// Show Storm Control
function cmdShowStormControl(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nNo storm control configured\n'
  };
}

// Show Environment
function cmdShowEnvironment(state: SwitchState): CommandResult {
  let output = '\nFAN Status:\n';
  output += '--------------------\n';
  output += 'FAN 1 is OK\n\n';
  output += 'Temperature Status:\n';
  output += '--------------------\n';
  output += 'Temperature Value: 28 Degree Celsius\n';
  output += 'Temperature State: GREEN\n';
  output += 'Yellow Threshold: 55 Degree Celsius\n';
  output += 'Red Threshold: 65 Degree Celsius\n\n';
  output += 'Power Supply Status:\n';
  output += '--------------------\n';
  output += 'Power Supply 1 is OK\n';
  
  return { success: true, output };
}

// Show Diagnostic
function cmdShowDiagnostic(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nSystem Health status: GREEN\nNo diagnostic tests configured\n'
  };
}

// Show Debug
function cmdShowDebug(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '\nNo debugging is enabled\n'
  };
}

// Copy Running Config TFTP
function cmdCopyRunningConfigTftp(state: SwitchState, input: string): CommandResult {
  return {
    success: true,
    output: 'Address or name of remote host []? \nDestination filename [switch-confg]? \n\n!!\n[OK - 1599 bytes]\n\n1599 bytes copied in 1.234 secs'
  };
}

// Erase Startup Config
function cmdEraseStartupConfig(state: SwitchState): CommandResult {
  return {
    success: true,
    requiresConfirmation: true,
    confirmationMessage: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]',
    confirmationAction: 'erase-startup-config',
    output: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]',
    // When confirmed, mark as erased (running-config remains but startup is gone)
    newState: {
      // Reset running config to minimal
      runningConfig: [
        '!',
        '!',
        '!',
        'end'
      ]
    }
  };
}

// Do command
function cmdDo(state: SwitchState, input: string): CommandResult {
  const doMatch = input.match(/^do\s+(.+)$/i);
  if (!doMatch) return { success: false, error: '% Invalid do command' };
  
  const subCommand = doMatch[1];
  // Execute as privileged command
  return executeCommand({ ...state, currentMode: 'privileged' }, subCommand);
}

// Ping
function cmdPing(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^ping\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i);
  if (!match) return { success: false, error: '% Invalid IP address' };
  
  const ip = match[1];
  return {
    success: true,
    output: `\nType escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`
  };
}

// Traceroute
function cmdTraceroute(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^traceroute\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i);
  if (!match) return { success: false, error: '% Invalid IP address' };
  
  const ip = match[1];
  return {
    success: true,
    output: `\nType escape sequence to abort.\nTracing the route to ${ip}\n\n  1 192.168.1.1 0 msec 0 msec 0 msec\n  2 ${ip} 1 msec *  1 msec`
  };
}

// Telnet
function cmdTelnet(state: SwitchState, input: string): CommandResult {
  const match = input.match(/^telnet\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i);
  if (!match) return { success: false, error: '% Invalid IP address' };
  
  return {
    success: true,
    output: `Trying ${match[1]} ... Open\n\nUser Access Verification\n\nUsername:`
  };
}

// SSH
function cmdSsh(state: SwitchState, input: string): CommandResult {
  const match = input.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
  if (!match) return { success: false, error: '% Invalid IP address' };
  
  return {
    success: true,
    output: `Connecting to ${match[1]}...\n\nUser Access Verification\n\nUsername:`
  };
}

// Reload
function cmdReload(state: SwitchState, input: string): CommandResult {
  if (input.toLowerCase().includes('cancel')) {
    return {
      success: true,
      output: 'Reload cancelled.'
    };
  }
  
  // Check if already confirmed (skipConfirm passed from page.tsx)
  // When confirmed, actually reload - reset to initial state
  return {
    success: true,
    requiresConfirmation: true,
    confirmationMessage: 'Proceed with reload? [confirm]',
    confirmationAction: 'reload',
    output: 'Proceed with reload? [confirm]\n\nWARNING: System will reload!',
    // When confirmed, this newState will be applied
    newState: {
      currentMode: 'user',
      currentInterface: undefined,
      selectedInterfaces: undefined,
      currentLine: undefined,
      currentVlan: undefined,
      awaitingPassword: false,
      commandHistory: state.commandHistory // Preserve history
    }
  };
}

// Clear ARP Cache
function cmdClearArpCache(state: SwitchState): CommandResult {
  return { success: true, output: 'ARP cache cleared.' };
}

// Clear MAC Address Table
function cmdClearMacAddressTable(state: SwitchState): CommandResult {
  return { success: true, output: 'MAC address table cleared.' };
}

// Clear Counters
function cmdClearCounters(state: SwitchState): CommandResult {
  return { success: true, output: 'Clear "show interface" counters on all interfaces [confirm]\n[OK]' };
}

// Clear Line
function cmdClearLine(state: SwitchState, input: string): CommandResult {
  return { success: true, output: '[confirm]\n[OK]' };
}

// Debug
function cmdDebug(state: SwitchState, input: string): CommandResult {
  return { success: true };
}

// No Debug
function cmdNoDebug(state: SwitchState, input: string): CommandResult {
  return { success: true, output: 'All possible debugging has been turned off' };
}

// Setup
function cmdSetup(state: SwitchState): CommandResult {
  return {
    success: true,
    output: '--- System Configuration Dialog ---\n\nWould you like to enter the initial configuration dialog? [yes/no]:'
  };
}

// Monitor Session
function cmdMonitorSession(state: SwitchState, input: string): CommandResult {
  return { success: true };
}

// No Monitor Session
function cmdNoMonitorSession(state: SwitchState, input: string): CommandResult {
  return { success: true };
}

// Prompt al
export function getPrompt(state: SwitchState): string {
  return getModePrompt(state.currentMode, state.hostname);
}
