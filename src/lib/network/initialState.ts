// Network Switch Initial State
import { SwitchState, Port, Vlan, SecurityConfig, CommandMode, StartupConfig } from './types';

// 24 FastEthernet + 2 GigabitEthernet portu oluştur
function createInitialPorts(): Record<string, Port> {
  const ports: Record<string, Port> = {};
  
  // FastEthernet 0/1 - 0/24 - HEPSİ AÇIK (no shutdown) BAŞLANGIÇTA
  for (let i = 1; i <= 24; i++) {
    const portId = `fa0/${i}`;
    ports[portId] = {
      id: portId,
      name: '',
      status: 'notconnect',
      vlan: 1,
      mode: 'access',
      voiceVlan: 'none',
      duplex: 'auto',
      speed: 'auto',
      shutdown: false, // BAŞLANGIÇTA AÇIK
      type: 'fastethernet',
      allowedVlans: 'all',
      channelGroup: undefined,
      channelMode: undefined,
      channelProtocol: undefined
    };
  }
  
  // GigabitEthernet 0/1 - 0/2 (Uplink) - BUNLAR DA AÇIK
  for (let i = 1; i <= 2; i++) {
    const portId = `gi0/${i}`;
    ports[portId] = {
      id: portId,
      name: '',
      status: 'notconnect',
      vlan: 1,
      mode: 'access',
      voiceVlan: 'none',
      duplex: 'auto',
      speed: 'auto',
      shutdown: false, // BAŞLANGIÇTA AÇIK
      type: 'gigabitethernet',
      allowedVlans: 'all',
      channelGroup: undefined,
      channelMode: undefined,
      channelProtocol: undefined
    };
  }

  // Management VLAN interface
  ports['vlan1'] = {
    id: 'vlan1',
    name: '',
    status: 'notconnect',
    vlan: 1,
    mode: 'access',
    duplex: 'auto',
    speed: 'auto',
    shutdown: false, // BAŞLANGIÇTA AÇIK
    type: 'fastethernet'
  };
  
  return ports;
}

// Varsayılan VLAN'lar - sadece sistem VLAN'ları (kullanıcı VLAN oluşturmalı)
function createInitialVlans(): Record<number, Vlan> {
  return {
    1: { id: 1, name: 'default', status: 'active', ports: [] },
    1002: { id: 1002, name: 'fddi-default', status: 'active', ports: [] },
    1003: { id: 1003, name: 'token-ring-default', status: 'active', ports: [] },
    1004: { id: 1004, name: 'fddinet-default', status: 'active', ports: [] },
    1005: { id: 1005, name: 'trnet-default', status: 'active', ports: [] }
  };
}

// Güvenlik başlangıç durumu
function createInitialSecurity(): SecurityConfig {
  return {
    enableSecret: undefined,
    enableSecretEncrypted: false,
    enablePassword: undefined,
    servicePasswordEncryption: false,
    users: [],
    consoleLine: {
      password: undefined,
      login: false,
      transportInput: ['all']
    },
    vtyLines: {
      password: undefined,
      login: false,
      transportInput: ['all']
    }
  };
}

// MAC Adres Tablosu (simülasyon için örnek veriler)
function createInitialMacTable(): { mac: string; vlan: number; port: string; type: string }[] {
  return [
    { mac: '0001.C234.5678', vlan: 1, port: 'Fa0/1', type: 'DYNAMIC' },
    { mac: '0002.A345.6789', vlan: 1, port: 'Fa0/2', type: 'DYNAMIC' },
    { mac: '0003.B456.7890', vlan: 1, port: 'Fa0/3', type: 'DYNAMIC' },
    { mac: '0011.2233.4455', vlan: 10, port: 'Gi0/1', type: 'DYNAMIC' },
    { mac: '0022.3344.5566', vlan: 20, port: 'Gi0/1', type: 'DYNAMIC' },
  ];
}

// Helper to generate a random unique Network-formatted MAC address (xxxx.xxxx.xxxx)
function generateMacAddress(): string {
  const chars = '0123456789ABCDEF';
  let mac = '';
  for (let i = 0; i < 12; i++) {
    mac += chars[Math.floor(Math.random() * 16)];
    if (i === 3 || i === 7) mac += '.';
  }
  return mac;
}

// Ana başlangıç durumu
export function createInitialState(): SwitchState {
  const ports = createInitialPorts();
  const vlans = createInitialVlans();
  const macAddress = generateMacAddress();
  
  // VLAN'lara portları ata
  Object.values(ports).forEach(port => {
    if (!port.shutdown && vlans[port.vlan]) {
      vlans[port.vlan].ports.push(port.id.toUpperCase());
    }
  });
  
  return {
    hostname: 'Switch',
    macAddress,
    currentMode: 'user',
    ports,
    vlans,
    security: createInitialSecurity(),
    runningConfig: [
      '!',
      `hostname Switch`,
      '!',
      '!',
      '!',
      'interface Vlan1',
      ' no ip address',
      ' no shutdown',
      '!',
      '!',
      'line con 0',
      'line vty 0 4',
      ' login',
      'line vty 5 15',
      ' login',
      '!',
      'end'
    ],
    commandHistory: [],
    historyIndex: -1,
    bannerMOTD: 'Welcome to the Network Simulator 2026\nUnauthorized access is strictly prohibited.',
    version: {
      nosVersion: '15.0(2)SE4',
      modelName: 'WS-C2960-24TT-L',
      serialNumber: 'FOC1234X5YZ',
      uptime: '2 weeks, 3 days, 5 hours'
    },
    macAddressTable: createInitialMacTable(),
    vtpRevision: 0,
    ipRouting: false
  };
}

// Router için başlangıç portları oluştur
function createInitialRouterPorts(): Record<string, Port> {
  const ports: Record<string, Port> = {};
  
  // GigabitEthernet 0/0 - 0/3 (Router portları)
  for (let i = 0; i <= 3; i++) {
    const portId = `gi0/${i}`;
    ports[portId] = {
      id: portId,
      name: i === 0 ? 'WAN' : i === 1 ? 'LAN' : '',
      status: 'notconnect', // HEPSİ BAŞLANGIÇTA BAĞLI DEĞİL
      vlan: 1,
      mode: 'access',
      voiceVlan: 'none',
      duplex: 'auto',
      speed: 'auto',
      shutdown: false,
      type: 'gigabitethernet',
      allowedVlans: 'all',
      channelGroup: undefined,
      channelMode: undefined,
      channelProtocol: undefined
    };
  }
  
  return ports;
}

// Router için başlangıç durumu
export function createInitialRouterState(): SwitchState {
  const ports = createInitialRouterPorts();
  const vlans = createInitialVlans();
  const macAddress = generateMacAddress();
  
  return {
    hostname: 'Router',
    macAddress,
    currentMode: 'user',
    ports,
    vlans,
    security: createInitialSecurity(),
    runningConfig: [
      '!',
      `hostname Router`,
      '!',
      '!',
      '!',
      '!',
      'line con 0',
      'line aux 0',
      'line vty 0 4',
      ' login',
      '!',
      'end'
    ],
    commandHistory: [],
    historyIndex: -1,
    bannerMOTD: 'Welcome to the Network Simulator 2026\nUnauthorized access is strictly prohibited.',
    version: {
      nosVersion: '15.4(3)M4',
      modelName: 'NETWORK1941/K9',
      serialNumber: 'FTX1234ABCD',
      uptime: '1 week, 2 days, 4 hours'
    },
    macAddressTable: [],
    vtpRevision: 0,
    ipRouting: false
  };
}

export function buildStartupConfig(state: SwitchState): StartupConfig {
  return {
    hostname: state.hostname,
    ports: JSON.parse(JSON.stringify(state.ports)),
    vlans: JSON.parse(JSON.stringify(state.vlans)),
    security: JSON.parse(JSON.stringify(state.security)),
    bannerMOTD: state.bannerMOTD,
    domainName: state.domainName,
    defaultGateway: state.defaultGateway,
    dnsServer: state.dnsServer,
    sshVersion: state.sshVersion,
    cdpEnabled: state.cdpEnabled,
    spanningTreeMode: state.spanningTreeMode,
    vtpMode: state.vtpMode,
    vtpDomain: state.vtpDomain,
    mlsQosEnabled: state.mlsQosEnabled,
    dhcpSnoopingEnabled: state.dhcpSnoopingEnabled,
    ntpServers: state.ntpServers ? [...state.ntpServers] : undefined,
    ipv6Enabled: state.ipv6Enabled,
    ipRouting: state.ipRouting
  };
}

export function applyStartupConfig(baseState: SwitchState, startup: StartupConfig): SwitchState {
  const mergedPorts: Record<string, Port> = {};
  Object.entries(baseState.ports).forEach(([id, basePort]) => {
    const savedPort = startup.ports[id];
    if (!savedPort) {
      mergedPorts[id] = basePort;
      return;
    }
    mergedPorts[id] = {
      ...basePort,
      name: savedPort.name,
      vlan: savedPort.vlan,
      mode: savedPort.mode,
      voiceVlan: (savedPort as any).voiceVlan ?? (basePort as any).voiceVlan ?? 'none',
      duplex: savedPort.duplex,
      speed: savedPort.speed,
      shutdown: savedPort.shutdown,
      type: savedPort.type,
      allowedVlans: savedPort.allowedVlans,
      channelGroup: (savedPort as any).channelGroup,
      channelMode: (savedPort as any).channelMode,
      channelProtocol: (savedPort as any).channelProtocol,
      portSecurity: savedPort.portSecurity,
      ipAddress: savedPort.ipAddress,
      subnetMask: savedPort.subnetMask,
      ipv6Address: savedPort.ipv6Address,
      ipv6Prefix: savedPort.ipv6Prefix
    };
  });

  return {
    ...baseState,
    hostname: startup.hostname,
    ports: mergedPorts,
    vlans: JSON.parse(JSON.stringify(startup.vlans)),
    security: JSON.parse(JSON.stringify(startup.security)),
    bannerMOTD: startup.bannerMOTD,
    domainName: startup.domainName,
    defaultGateway: startup.defaultGateway,
    dnsServer: startup.dnsServer,
    sshVersion: startup.sshVersion,
    cdpEnabled: startup.cdpEnabled,
    spanningTreeMode: startup.spanningTreeMode,
    vtpMode: startup.vtpMode,
    vtpDomain: startup.vtpDomain,
    vtpPassword: (startup as any).vtpPassword,
    vtpRevision: (startup as any).vtpRevision ?? baseState.vtpRevision ?? 0,
    mlsQosEnabled: startup.mlsQosEnabled,
    dhcpSnoopingEnabled: startup.dhcpSnoopingEnabled,
    ntpServers: startup.ntpServers ? [...startup.ntpServers] : undefined,
    ipv6Enabled: startup.ipv6Enabled,
    ipRouting: startup.ipRouting
  };
}

// Mode prompt'ları
export function getModePrompt(mode: CommandMode, hostname: string, context?: string): string {
  switch (mode) {
    case 'user':
      return `${hostname}>`;
    case 'privileged':
      return `${hostname}#`;
    case 'config':
      return `${hostname}(config)#`;
    case 'interface':
      return `${hostname}(config-if)#`;
    case 'line':
      return `${hostname}(config-line)#`;
    case 'vlan':
      return `${hostname}(config-vlan)#`;
    default:
      return `${hostname}>`;
  }
}

// Port ID normalize etme
export function normalizePortId(input: string): string | null {
  // Boşlukları kaldır ve küçük harfe çevir (örn: "gig 0/1" -> "gig0/1")
  const lower = input.toLowerCase().trim().replace(/\s+/g, '');

  const subMatch = lower.match(/^(?:fa|fastethernet|fast|gi|gig|gigabit|gigabitethernet)(\d+)\/(\d+)\.(\d+)$/);
  if (subMatch) {
    const prefix = lower.startsWith('fa') || lower.startsWith('fast') ? 'fa' : 'gi';
    return `${prefix}${subMatch[1]}/${subMatch[2]}.${subMatch[3]}`;
  }
  
  // Fa0/1, fa0/1, FastEthernet0/1, fastethernet0/1, fast 0/1 formatlarını kabul et
  const faMatch = lower.match(/^(?:fa|fastethernet|fast)(\d+)\/(\d+)$/);
  if (faMatch) {
    return `fa${faMatch[1]}/${faMatch[2]}`;
  }
  
  // Gi0/1, gi0/1, GigabitEthernet0/1, gigabitethernet0/1, gig 0/1 formatlarını kabul et
  const giMatch = lower.match(/^(?:gi|gig|gigabit|gigabitethernet)(\d+)\/(\d+)$/);
  if (giMatch) {
    return `gi${giMatch[1]}/${giMatch[2]}`;
  }
  
  return null;
}

// Komut kısaltmaları için eşleşme - TÜM NETWORK 2960 KOMUTLARI
export const commandAliases: Record<string, string> = {
  // Enable/Disable
  'en': 'enable',
  'ena': 'enable',
  'enab': 'enable',
  'dis': 'disable',
  'disa': 'disable',
  
  // Configure
  'conf': 'configure',
  'conf t': 'configure terminal',
  'config t': 'configure terminal',
  'conf te': 'configure terminal',
  'config te': 'configure terminal',
  'conf ter': 'configure terminal',
  'config ter': 'configure terminal',
  'conf term': 'configure terminal',
  'config term': 'configure terminal',
  'conf termi': 'configure terminal',
  'config termi': 'configure terminal',
  'conf termin': 'configure terminal',
  'config termin': 'configure terminal',
  'conf termina': 'configure terminal',
  'config termina': 'configure terminal',
  'configure t': 'configure terminal',
  'configure te': 'configure terminal',
  'configure ter': 'configure terminal',
  'configure term': 'configure terminal',
  'configure termi': 'configure terminal',
  'configure termin': 'configure terminal',
  'configure termina': 'configure terminal',
  'c': 'configure',
  'c t': 'configure terminal',
  'ct': 'configure terminal',
  
  // Show commands
  'sh': 'show',
  'sho': 'show',
  'sh r': 'show running-config',
  'sh ru': 'show running-config',
  'sh run': 'show running-config',
  'sh runn': 'show running-config',
  'sh runni': 'show running-config',
  'sh runnin': 'show running-config',
  'sh running': 'show running-config',
  'sh running-c': 'show running-config',
  'sh running-co': 'show running-config',
  'sh running-con': 'show running-config',
  'sh running-conf': 'show running-config',
  'sh runn-c': 'show running-config',
  'sh runn-co': 'show running-config',
  
  'sh i': 'show interfaces',
  'sh in': 'show interfaces',
  'sh int': 'show interfaces',
  'sh inte': 'show interfaces',
  'sh inter': 'show interfaces',
  'sh interf': 'show interfaces',
  'sh interfa': 'show interfaces',
  'sh interfac': 'show interfaces',
  'sh interface': 'show interfaces',
  'sh interfaces': 'show interfaces',
  
  'sh vl': 'show vlan',
  'sh vla': 'show vlan',
  'sh vlan': 'show vlan brief',
  'sh vlan b': 'show vlan brief',
  'sh vlan br': 'show vlan brief',
  'sh vlan bre': 'show vlan brief',
  'sh vlanbrie': 'show vlan brief',
  'sh vl b': 'show vlan brief',
  'sh vl br': 'show vlan brief',
  'sh vl bre': 'show vlan brief',
  
  'sh v': 'show version',
  'sh ve': 'show version',
  'sh ver': 'show version',
  'sh vers': 'show version',
  'sh versi': 'show version',
  'sh versio': 'show version',
  
  'sh m': 'show mac address-table',
  'sh ma': 'show mac address-table',
  'sh mac': 'show mac address-table',
  'sh mac-': 'show mac address-table',
  'sh mac-a': 'show mac address-table',
  'sh mac-ad': 'show mac address-table',
  'sh mac-addr': 'show mac address-table',
  'sh mac-addre': 'show mac address-table',
  'sh mac-addres': 'show mac address-table',
  'sh mac address': 'show mac address-table',
  'sh mac addres': 'show mac address-table',
  
  'sh cdp': 'show cdp neighbors',
  'sh cdp n': 'show cdp neighbors',
  'sh cdp ne': 'show cdp neighbors',
  'sh cdp nei': 'show cdp neighbors',
  'sh cdp neig': 'show cdp neighbors',
  'sh cdp neigh': 'show cdp neighbors',
  'sh cdp neighb': 'show cdp neighbors',
  'sh cdp neighbo': 'show cdp neighbors',
  'sh cdp neighbor': 'show cdp neighbors',
  
  'sh cdp ne de': 'show cdp neighbors detail',
  'sh cdp nei d': 'show cdp neighbors detail',
  'sh cdp det': 'show cdp neighbors detail',
  'sh cdp deta': 'show cdp neighbors detail',
  
  'sh ip int br': 'show ip interface brief',
  'sh ip int brie': 'show ip interface brief',
  'sh ip int brief': 'show ip interface brief',
  'sh ip interface br': 'show ip interface brief',
  'sh ip interface brief': 'show ip interface brief',
  'sh ip int': 'show ip interface brief',
  
  'sh int sta': 'show interfaces status',
  'sh int stat': 'show interfaces status',
  'sh int statu': 'show interfaces status',
  'sh inte sta': 'show interfaces status',
  'sh inter sta': 'show interfaces status',
  'sh interf sta': 'show interfaces status',
  
  'sh spanning-tree': 'show spanning-tree',
  'sh span': 'show spanning-tree',
  'sh spann': 'show spanning-tree',
  'sh spanni': 'show spanning-tree',
  'sh spannin': 'show spanning-tree',
  'sh spanning': 'show spanning-tree',
  'sh spanning-t': 'show spanning-tree',
  'sh spanning-tr': 'show spanning-tree',
  'sh spanning-tre': 'show spanning-tree',
  'sh sp': 'show spanning-tree',
  
  'sh port-security': 'show port-security',
  'sh port': 'show port-security',
  'sh port-s': 'show port-security',
  'sh port-se': 'show port-security',
  'sh port-sec': 'show port-security',
  'sh port-secu': 'show port-security',
  'sh port-secur': 'show port-security',
  'sh port-securi': 'show port-security',
  'sh port-securit': 'show port-security',
  
  'sh run | include': 'show running-config | include',
  'sh run | inc': 'show running-config | include',
  'sh run | i': 'show running-config | include',
  'sh run | section': 'show running-config | section',
  'sh run | sec': 'show running-config | section',
  'sh run | begin': 'show running-config | begin',
  'sh run | beg': 'show running-config | begin',
  
  // Interface commands
  'int': 'interface',
  'inte': 'interface',
  'inter': 'interface',
  'interf': 'interface',
  'interfa': 'interface',
  'interfac': 'interface',
  'i': 'interface',
  
  // Interface range
  'int r': 'interface range',
  'int ra': 'interface range',
  'int ran': 'interface range',
  'int rang': 'interface range',
  'inter r': 'interface range',
  'inter ra': 'interface range',
  'inter ran': 'interface range',
  'inter rang': 'interface range',
  'inter range': 'interface range',
  'interf r': 'interface range',
  'interf ra': 'interface range',
  'interf ran': 'interface range',
  'interf rang': 'interface range',
  'interf range': 'interface range',
  'interface r': 'interface range',
  'interface ra': 'interface range',
  'interface ran': 'interface range',
  'interface rang': 'interface range',
  
  // Shutdown commands
  'no sh': 'no shutdown',
  'no shu': 'no shutdown',
  'no shut': 'no shutdown',
  'no shutd': 'no shutdown',
  'no shutdo': 'no shutdown',
  'no shutdow': 'no shutdown',
  'shut': 'shutdown',
  'shutd': 'shutdown',
  'shutdo': 'shutdown',
  'shutdow': 'shutdown',
  
  // Switchport commands
  'sw': 'switchport',
  'swi': 'switchport',
  'swit': 'switchport',
  'switc': 'switchport',
  'switch': 'switchport',
  'switchp': 'switchport',
  'switchpo': 'switchport',
  'switchpor': 'switchport',
  
  'sw m': 'switchport mode',
  'sw mo': 'switchport mode',
  'sw mod': 'switchport mode',
  'swi m': 'switchport mode',
  'swi mo': 'switchport mode',
  'swi mod': 'switchport mode',
  'swit m': 'switchport mode',
  'swit mo': 'switchport mode',
  'swit mod': 'switchport mode',
  'switch m': 'switchport mode',
  'switch mo': 'switchport mode',
  'switch mod': 'switchport mode',
  'switchp m': 'switchport mode',
  'switchp mo': 'switchport mode',
  'switchp mod': 'switchport mode',
  'switchpo m': 'switchport mode',
  'switchpo mo': 'switchport mode',
  'switchpo mod': 'switchport mode',
  'switchpor m': 'switchport mode',
  'switchpor mo': 'switchport mode',
  'switchpor mod': 'switchport mode',
  'switchport m': 'switchport mode',
  'switchport mo': 'switchport mode',
  
  'sw m a': 'switchport mode access',
  'sw mo a': 'switchport mode access',
  'sw mod a': 'switchport mode access',
  'sw m ac': 'switchport mode access',
  'sw mo ac': 'switchport mode access',
  'sw mod ac': 'switchport mode access',
  'sw m acc': 'switchport mode access',
  'sw mo acc': 'switchport mode access',
  'sw mod acc': 'switchport mode access',
  'sw m acce': 'switchport mode access',
  'sw mo acce': 'switchport mode access',
  'sw mod acce': 'switchport mode access',
  'sw m acces': 'switchport mode access',
  'sw mo acces': 'switchport mode access',
  'sw mod acces': 'switchport mode access',
  
  'sw m t': 'switchport mode trunk',
  'sw mo t': 'switchport mode trunk',
  'sw mod t': 'switchport mode trunk',
  'sw m tr': 'switchport mode trunk',
  'sw mo tr': 'switchport mode trunk',
  'sw mod tr': 'switchport mode trunk',
  'sw m tru': 'switchport mode trunk',
  'sw mo tru': 'switchport mode trunk',
  'sw mod tru': 'switchport mode trunk',
  'sw m trun': 'switchport mode trunk',
  'sw mo trun': 'switchport mode trunk',
  'sw mod trun': 'switchport mode trunk',
  
  'sw a': 'switchport access',
  'sw ac': 'switchport access',
  'sw acc': 'switchport access',
  'sw acce': 'switchport access',
  'sw acces': 'switchport access',
  'swi a': 'switchport access',
  'swi ac': 'switchport access',
  'swi acc': 'switchport access',
  'swi acce': 'switchport access',
  'swi acces': 'switchport access',
  
  'sw a v': 'switchport access vlan',
  'sw ac v': 'switchport access vlan',
  'sw acc v': 'switchport access vlan',
  'sw acce v': 'switchport access vlan',
  'sw acces v': 'switchport access vlan',
  'sw a vl': 'switchport access vlan',
  'sw ac vl': 'switchport access vlan',
  'sw acc vl': 'switchport access vlan',
  'sw acce vl': 'switchport access vlan',
  'sw acces vl': 'switchport access vlan',
  'sw a vla': 'switchport access vlan',
  'sw ac vla': 'switchport access vlan',
  'sw acc vla': 'switchport access vlan',
  'sw acce vla': 'switchport access vlan',
  'sw acces vla': 'switchport access vlan',
  'sw acc vlan': 'switchport access vlan',
  'sw acce vlan': 'switchport access vlan',
  'sw acces vlan': 'switchport access vlan',
  
  'sw t': 'switchport trunk',
  'sw tr': 'switchport trunk',
  'sw tru': 'switchport trunk',
  'sw trun': 'switchport trunk',
  'sw t a': 'switchport trunk allowed',
  'sw tr a': 'switchport trunk allowed',
  'sw tru a': 'switchport trunk allowed',
  'sw trun a': 'switchport trunk allowed',
  'sw t al': 'switchport trunk allowed',
  'sw tr al': 'switchport trunk allowed',
  'sw tru al': 'switchport trunk allowed',
  'sw trun al': 'switchport trunk allowed',
  'sw t all': 'switchport trunk allowed',
  'sw tr all': 'switchport trunk allowed',
  'sw tru all': 'switchport trunk allowed',
  'sw trun all': 'switchport trunk allowed',
  'sw t allo': 'switchport trunk allowed',
  'sw tr allo': 'switchport trunk allowed',
  'sw tru allo': 'switchport trunk allowed',
  'sw trun allo': 'switchport trunk allowed',
  'sw t allow': 'switchport trunk allowed',
  'sw tr allow': 'switchport trunk allowed',
  'sw tru allow': 'switchport trunk allowed',
  'sw trun allow': 'switchport trunk allowed',
  'sw t allowe': 'switchport trunk allowed',
  'sw tr allowe': 'switchport trunk allowed',
  'sw tru allowe': 'switchport trunk allowed',
  'sw trun allowe': 'switchport trunk allowed',
  'sw t allowed': 'switchport trunk allowed',
  'sw tr allowed': 'switchport trunk allowed',
  'sw tru allowed': 'switchport trunk allowed',
  'sw trun allowed': 'switchport trunk allowed',
  'sw t a v': 'switchport trunk allowed vlan',
  'sw tr a v': 'switchport trunk allowed vlan',
  'sw tru a v': 'switchport trunk allowed vlan',
  'sw trun a v': 'switchport trunk allowed vlan',
  'sw t al v': 'switchport trunk allowed vlan',
  'sw tr al v': 'switchport trunk allowed vlan',
  'sw tru al v': 'switchport trunk allowed vlan',
  'sw trun al v': 'switchport trunk allowed vlan',
  'sw trunk all vlan': 'switchport trunk allowed vlan',
  
  // Speed and Duplex
  'spe': 'speed',
  'spee': 'speed',
  'dup': 'duplex',
  'dupl': 'duplex',
  'duple': 'duplex',
  
  // Description
  'desc': 'description',
  'descr': 'description',
  'descri': 'description',
  'descrip': 'description',
  'descript': 'description',
  'descripti': 'description',
  'descriptio': 'description',
  
  // VLAN commands
  'vl': 'vlan',
  'vla': 'vlan',
  'vl n': 'vlan name',
  'vla n': 'vlan name',
  'vlan n': 'vlan name',
  
  // Write/Copy commands (Patterns now handle these natively)
  'cop': 'copy',
  'copy': 'copy',
  
  // Enable secret/password
  'en s': 'enable secret',
  'en se': 'enable secret',
  'en sec': 'enable secret',
  'en secr': 'enable secret',
  'en secre': 'enable secret',
  'en secret': 'enable secret',
  'ena s': 'enable secret',
  'ena se': 'enable secret',
  'ena sec': 'enable secret',
  'ena secr': 'enable secret',
  'ena secre': 'enable secret',
  'ena secret': 'enable secret',
  'enab s': 'enable secret',
  'enab se': 'enable secret',
  'enab sec': 'enable secret',
  'enab secr': 'enable secret',
  'enab secre': 'enable secret',
  'enab secret': 'enable secret',
  
  'en p': 'enable password',
  'en pa': 'enable password',
  'en pas': 'enable password',
  'en pass': 'enable password',
  'en passw': 'enable password',
  'en passwo': 'enable password',
  'en passwor': 'enable password',
  'ena p': 'enable password',
  'ena pa': 'enable password',
  'ena pas': 'enable password',
  'ena pass': 'enable password',
  'ena passw': 'enable password',
  'ena passwo': 'enable password',
  'ena passwor': 'enable password',
  
  // Service password-encryption
  'ser': 'service',
  'serv': 'service',
  'servi': 'service',
  'servic': 'service',
  'ser p': 'service password-encryption',
  'ser pa': 'service password-encryption',
  'ser pas': 'service password-encryption',
  'ser pass': 'service password-encryption',
  'ser passw': 'service password-encryption',
  'ser passwo': 'service password-encryption',
  'ser passwor': 'service password-encryption',
  'ser password': 'service password-encryption',
  'ser password-e': 'service password-encryption',
  'ser password-en': 'service password-encryption',
  'ser password-enc': 'service password-encryption',
  'ser password-encr': 'service password-encryption',
  'ser password-encry': 'service password-encryption',
  'ser password-encryp': 'service password-encryption',
  'ser password-encrypt': 'service password-encryption',
  'ser password-encrypti': 'service password-encryption',
  'ser password-encryptio': 'service password-encryption',
  'serv p': 'service password-encryption',
  'serv pa': 'service password-encryption',
  'serv pas': 'service password-encryption',
  'serv pass': 'service password-encryption',
  'serv passw': 'service password-encryption',
  'serv passwo': 'service password-encryption',
  'serv passwor': 'service password-encryption',
  'serv password': 'service password-encryption',
  'serv password-e': 'service password-encryption',
  'serv password-en': 'service password-encryption',
  'serv password-enc': 'service password-encryption',
  'serv password-encr': 'service password-encryption',
  'serv password-encry': 'service password-encryption',
  'serv password-encryp': 'service password-encryption',
  'serv password-encrypt': 'service password-encryption',
  'serv password-encrypti': 'service password-encryption',
  'serv password-encryptio': 'service password-encryption',
  'service p': 'service password-encryption',
  'service pa': 'service password-encryption',
  'service pas': 'service password-encryption',
  'service pass': 'service password-encryption',
  'service passw': 'service password-encryption',
  'service passwo': 'service password-encryption',
  'service passwor': 'service password-encryption',
  'service password': 'service password-encryption',
  'service password-e': 'service password-encryption',
  'service password-en': 'service password-encryption',
  'service password-enc': 'service password-encryption',
  'service password-encr': 'service password-encryption',
  'service password-encry': 'service password-encryption',
  'service password-encryp': 'service password-encryption',
  'service password-encrypt': 'service password-encryption',
  'service password-encrypti': 'service password-encryption',
  'service password-encryptio': 'service password-encryption',
  
  // Username
  'use': 'username',
  'user': 'username',
  'usern': 'username',
  'userna': 'username',
  'usernam': 'username',
  'user p': 'username password',
  'user pa': 'username password',
  'user pas': 'username password',
  'user pass': 'username password',
  'user passw': 'username password',
  'user passwo': 'username password',
  'user passwor': 'username password',
  'usern p': 'username password',
  'usern pa': 'username password',
  'usern pas': 'username password',
  'usern pass': 'username password',
  'usern passw': 'username password',
  'usern passwo': 'username password',
  'usern passwor': 'username password',
  'username p': 'username password',
  'username pa': 'username password',
  'username pas': 'username password',
  'username pass': 'username password',
  'username passw': 'username password',
  'username passwo': 'username password',
  'username passwor': 'username password',
  
  // Banner
  'ban': 'banner',
  'bann': 'banner',
  'banne': 'banner',
  'ban m': 'banner motd',
  'bann m': 'banner motd',
  'banne m': 'banner motd',
  'banner m': 'banner motd',
  'ban mo': 'banner motd',
  'bann mo': 'banner motd',
  'banne mo': 'banner motd',
  'banner mo': 'banner motd',
  'ban mot': 'banner motd',
  'bann mot': 'banner motd',
  'banne mot': 'banner motd',
  'banner mot': 'banner motd',
  
  // Line commands
  'lin': 'line',
  'line': 'line',
  'lin c': 'line console',
  'line c': 'line console',
  'lin co': 'line console',
  'line co': 'line console',
  'lin con': 'line console',
  'line con': 'line console',
  'lin cons': 'line console',
  'line cons': 'line console',
  'lin conso': 'line console',
  'line conso': 'line console',
  'lin consol': 'line console',
  'line consol': 'line console',
  'line console 0': 'line console 0',
  'lin con 0': 'line console 0',
  'line con 0': 'line console 0',
  
  'lin v': 'line vty',
  'line v': 'line vty',
  'lin vt': 'line vty',
  'line vt': 'line vty',
  'lin vty': 'line vty',
  'line vty': 'line vty',
  
  // Password on line
  'pass': 'password',
  'passw': 'password',
  'passwo': 'password',
  'passwor': 'password',
  
  // Login
  'log': 'login',
  'logi': 'login',
  
  // Transport
  'tra': 'transport',
  'tran': 'transport',
  'trans': 'transport',
  'transp': 'transport',
  'transpo': 'transport',
  'transpor': 'transport',
  'tra i': 'transport input',
  'tran i': 'transport input',
  'trans i': 'transport input',
  'transp i': 'transport input',
  'transpo i': 'transport input',
  'transpor i': 'transport input',
  'transport i': 'transport input',
  'tra in': 'transport input',
  'tran in': 'transport input',
  'trans in': 'transport input',
  'transp in': 'transport input',
  'transpo in': 'transport input',
  'transpor in': 'transport input',
  'transport in': 'transport input',
  'tra inp': 'transport input',
  'tran inp': 'transport input',
  'trans inp': 'transport input',
  'transp inp': 'transport input',
  'transpo inp': 'transport input',
  'transpor inp': 'transport input',
  'transport inp': 'transport input',
  'tra inpu': 'transport input',
  'tran inpu': 'transport input',
  'trans inpu': 'transport input',
  'transp inpu': 'transport input',
  'transpo inpu': 'transport input',
  'transpor inpu': 'transport input',
  'transport inpu': 'transport input',
  
  // Hostname
  'host': 'hostname',
  'hostn': 'hostname',
  'hostna': 'hostname',
  'hostnam': 'hostname',
  
  // Exit/End
  'ex': 'exit',
  'exi': 'exit',
  // Note: 'en' already maps to 'enable', use 'end' or 'e' to exit config mode
  'e': 'end',   // In config mode
  
  // Do command (execute privileged commands from config mode)
  'do': 'do',
  'do sh': 'do show',
  'do sho': 'do show',
  'do sh r': 'do show running-config',
  'do sh ru': 'do show running-config',
  'do sh run': 'do show running-config',
  'do sh int': 'do show interfaces',
  'do sh vl': 'do show vlan',
  'do sh vlan': 'do show vlan brief',
  'do sh ver': 'do show version',
  
  // CDP commands
  'cdp r': 'cdp run',
  'cdp ru': 'cdp run',
  'cdp run': 'cdp run',
  'no cdp r': 'no cdp run',
  'no cdp ru': 'no cdp run',
  'no cdp run': 'no cdp run',
  'cdp e': 'cdp enable',
  'cdp en': 'cdp enable',
  'cdp ena': 'cdp enable',
  'cdp enab': 'cdp enable',
  'cdp enabl': 'cdp enable',
  'cdp enable': 'cdp enable',
  'no cdp e': 'no cdp enable',
  'no cdp en': 'no cdp enable',
  'no cdp ena': 'no cdp enable',
  'no cdp enab': 'no cdp enable',
  'no cdp enabl': 'no cdp enable',
  'no cdp enable': 'no cdp enable',
  
  // Port-security commands
  'sw p': 'switchport port-security',
  'sw po': 'switchport port-security',
  'sw por': 'switchport port-security',
  'sw port': 'switchport port-security',
  'sw port-': 'switchport port-security',
  'sw port-s': 'switchport port-security',
  'sw port-se': 'switchport port-security',
  'sw port-sec': 'switchport port-security',
  'sw port-secu': 'switchport port-security',
  'sw port-secur': 'switchport port-security',
  'sw port-securi': 'switchport port-security',
  'sw port-securit': 'switchport port-security',
  'switchport p': 'switchport port-security',
  'switchport po': 'switchport port-security',
  'switchport por': 'switchport port-security',
  'switchport port': 'switchport port-security',
  'switchport port-': 'switchport port-security',
  'switchport port-s': 'switchport port-security',
  'switchport port-se': 'switchport port-security',
  'switchport port-sec': 'switchport port-security',
  'switchport port-secu': 'switchport port-security',
  'switchport port-secur': 'switchport port-security',
  'switchport port-securi': 'switchport port-security',
  'switchport port-securit': 'switchport port-security',
  
  'sw p m': 'switchport port-security maximum',
  'sw po m': 'switchport port-security maximum',
  'sw por m': 'switchport port-security maximum',
  'sw port m': 'switchport port-security maximum',
  'sw port-s m': 'switchport port-security maximum',
  'switchport port-s m': 'switchport port-security maximum',
  'switchport port-security m': 'switchport port-security maximum',
  'switchport port-security ma': 'switchport port-security maximum',
  'switchport port-security max': 'switchport port-security maximum',
  'switchport port-security maxi': 'switchport port-security maximum',
  'switchport port-security maxim': 'switchport port-security maximum',
  'switchport port-security maximu': 'switchport port-security maximum',
  
  'sw p v': 'switchport port-security violation',
  'sw po v': 'switchport port-security violation',
  'sw por v': 'switchport port-security violation',
  'sw port v': 'switchport port-security violation',
  'sw port-s v': 'switchport port-security violation',
  'switchport port-s v': 'switchport port-security violation',
  'switchport port-security v': 'switchport port-security violation',
  'switchport port-security vi': 'switchport port-security violation',
  'switchport port-security vio': 'switchport port-security violation',
  'switchport port-security viol': 'switchport port-security violation',
  'switchport port-security viola': 'switchport port-security violation',
  'switchport port-security violat': 'switchport port-security violation',
  'switchport port-security violati': 'switchport port-security violation',
  'switchport port-security violatio': 'switchport port-security violation',
  
  'sw p m-a': 'switchport port-security mac-address',
  'sw po m-a': 'switchport port-security mac-address',
  'sw por m-a': 'switchport port-security mac-address',
  'sw port m-a': 'switchport port-security mac-address',
  'sw port-s m-a': 'switchport port-security mac-address',
  'switchport port-security m-a': 'switchport port-security mac-address',
  'switchport port-security mac': 'switchport port-security mac-address',
  'switchport port-security mac-': 'switchport port-security mac-address',
  'switchport port-security mac-a': 'switchport port-security mac-address',
  'switchport port-security mac-ad': 'switchport port-security mac-address',
  'switchport port-security mac-addr': 'switchport port-security mac-address',
  'switchport port-security mac-addre': 'switchport port-security mac-address',
  'switchport port-security mac-addres': 'switchport port-security mac-address',
  
  // Spanning-tree
  'span': 'spanning-tree',
  'spann': 'spanning-tree',
  'spanni': 'spanning-tree',
  'spannin': 'spanning-tree',
  'spanning': 'spanning-tree',
  'spanning-': 'spanning-tree',
  'spanning-t': 'spanning-tree',
  'spanning-tr': 'spanning-tree',
  'spanning-tre': 'spanning-tree',
  
  'span m': 'spanning-tree mode',
  'spann m': 'spanning-tree mode',
  'spanni m': 'spanning-tree mode',
  'spannin m': 'spanning-tree mode',
  'spanning m': 'spanning-tree mode',
  'spanning- m': 'spanning-tree mode',
  'spanning-t m': 'spanning-tree mode',
  'spanning-tr m': 'spanning-tree mode',
  'spanning-tre m': 'spanning-tree mode',
  'spanning-tree m': 'spanning-tree mode',
  'spanning-tree mo': 'spanning-tree mode',
  'spanning-tree mod': 'spanning-tree mode',
  
  'span m r': 'spanning-tree mode rapid-pvst',
  'spann m r': 'spanning-tree mode rapid-pvst',
  'span m ra': 'spanning-tree mode rapid-pvst',
  'spann m ra': 'spanning-tree mode rapid-pvst',
  'span m rap': 'spanning-tree mode rapid-pvst',
  'spann m rap': 'spanning-tree mode rapid-pvst',
  'span m rapi': 'spanning-tree mode rapid-pvst',
  'spann m rapi': 'spanning-tree mode rapid-pvst',
  'span m rapid': 'spanning-tree mode rapid-pvst',
  'spann m rapid': 'spanning-tree mode rapid-pvst',
  'span m rapid-': 'spanning-tree mode rapid-pvst',
  'spann m rapid-': 'spanning-tree mode rapid-pvst',
  'span m rapid-p': 'spanning-tree mode rapid-pvst',
  'spann m rapid-p': 'spanning-tree mode rapid-pvst',
  'span m rapid-pv': 'spanning-tree mode rapid-pvst',
  'spann m rapid-pv': 'spanning-tree mode rapid-pvst',
  'span m rapid-pvs': 'spanning-tree mode rapid-pvst',
  'spann m rapid-pvs': 'spanning-tree mode rapid-pvst',
  'spanning-tree mode r': 'spanning-tree mode rapid-pvst',
  'spanning-tree mode ra': 'spanning-tree mode rapid-pvst',
  'spanning-tree mode rap': 'spanning-tree mode rapid-pvst',
  'spanning-tree mode rapi': 'spanning-tree mode rapid-pvst',
  'spanning-tree mode rapid': 'spanning-tree mode rapid-pvst',
  'spanning-tree mode rapid-': 'spanning-tree mode rapid-pvst',
  'spanning-tree mode rapid-p': 'spanning-tree mode rapid-pvst',
  'spanning-tree mode rapid-pv': 'spanning-tree mode rapid-pvst',
  'spanning-tree mode rapid-pvs': 'spanning-tree mode rapid-pvst',
  
  'span m p': 'spanning-tree mode pvst',
  'spann m p': 'spanning-tree mode pvst',
  'span m pv': 'spanning-tree mode pvst',
  'spann m pv': 'spanning-tree mode pvst',
  'span m pvs': 'spanning-tree mode pvst',
  'spann m pvs': 'spanning-tree mode pvst',
  'spanning-tree mode p': 'spanning-tree mode pvst',
  'spanning-tree mode pv': 'spanning-tree mode pvst',
  'spanning-tree mode pvs': 'spanning-tree mode pvst',
  
  // Channel-group (EtherChannel)
  'chan': 'channel-group',
  'chann': 'channel-group',
  'channe': 'channel-group',
  'channel': 'channel-group',
  'channel-': 'channel-group',
  'channel-g': 'channel-group',
  'channel-gr': 'channel-group',
  'channel-gro': 'channel-group',
  'channel-grou': 'channel-group',
  'ch': 'channel-group',
  'ch g': 'channel-group',
  'ch gr': 'channel-group',
  'ch gro': 'channel-group',
  'ch grou': 'channel-group',
  'ch group': 'channel-group',
  
  // IP commands
  'ip d': 'ip default-gateway',
  'ip de': 'ip default-gateway',
  'ip def': 'ip default-gateway',
  'ip defa': 'ip default-gateway',
  'ip defau': 'ip default-gateway',
  'ip defaul': 'ip default-gateway',
  'ip default': 'ip default-gateway',
  'ip default-': 'ip default-gateway',
  'ip default-g': 'ip default-gateway',
  'ip default-ga': 'ip default-gateway',
  'ip default-gat': 'ip default-gateway',
  'ip default-gate': 'ip default-gateway',
  'ip default-gatew': 'ip default-gateway',
  'ip default-gatewa': 'ip default-gateway',
  
  // Management IP on VLAN interface
  'ip a': 'ip address',
  'ip ad': 'ip address',
  'ip add': 'ip address',
  'ip addr': 'ip address',
  'ip addre': 'ip address',
  'ip addres': 'ip address',
  
  // No commands
  'no int': 'no interface',
  'no vlan': 'no vlan',
  'no sw': 'no switchport',
  'no sw m': 'no switchport mode',
  'no sw a': 'no switchport access',
  'no sw acc': 'no switchport access',
  'no sw acc v': 'no switchport access vlan',
  'no sw acc vlan': 'no switchport access vlan',
  'no sw t': 'no switchport trunk',
  'no cdp': 'no cdp run',
  'no span': 'no spanning-tree',
  'no spann': 'no spanning-tree',
  'no spanni': 'no spanning-tree',
  'no spannin': 'no spanning-tree',
  'no spanning': 'no spanning-tree',
  'no spanning-': 'no spanning-tree',
  'no spanning-t': 'no spanning-tree',
  'no spanning-tr': 'no spanning-tree',
  'no spanning-tre': 'no spanning-tree',
  
  // Errdisable recovery
  'err': 'errdisable',
  'errd': 'errdisable',
  'errdi': 'errdisable',
  'errdis': 'errdisable',
  'errdisa': 'errdisable',
  'errdisab': 'errdisable',
  'errdisabl': 'errdisable',
  'errdisable': 'errdisable',
  'err r': 'errdisable recovery',
  'errd r': 'errdisable recovery',
  'errdi r': 'errdisable recovery',
  'errdis r': 'errdisable recovery',
  'errdisa r': 'errdisable recovery',
  'errdisab r': 'errdisable recovery',
  'errdisabl r': 'errdisable recovery',
  'errdisable r': 'errdisable recovery',
  'errdisable re': 'errdisable recovery',
  'errdisable rec': 'errdisable recovery',
  'errdisable reco': 'errdisable recovery',
  'errdisable recov': 'errdisable recovery',
  'errdisable recove': 'errdisable recovery',
  'errdisable recover': 'errdisable recovery',
  'errdisable recovery': 'errdisable recovery',
  
  // Logging
  'log s': 'logging synchronous',
  'log sy': 'logging synchronous',
  'log syn': 'logging synchronous',
  'log sync': 'logging synchronous',
  'log synch': 'logging synchronous',
  'log synchr': 'logging synchronous',
  'log synchro': 'logging synchronous',
  'log synchron': 'logging synchronous',
  'log synchrono': 'logging synchronous',
  'log synchronou': 'logging synchronous',
  'logg s': 'logging synchronous',
  'logg sy': 'logging synchronous',
  'logg syn': 'logging synchronous',
  'logg sync': 'logging synchronous',
  'logg synch': 'logging synchronous',
  'logg synchr': 'logging synchronous',
  'logg synchro': 'logging synchronous',
  'logg synchron': 'logging synchronous',
  'logg synchrono': 'logging synchronous',
  'logg synchronou': 'logging synchronous',
  'logging synchronous': 'logging synchronous',
  
  // Exec-timeout
  'exec': 'exec-timeout',
  'exec-': 'exec-timeout',
  'exec-t': 'exec-timeout',
  'exec-ti': 'exec-timeout',
  'exec-tim': 'exec-timeout',
  'exec-time': 'exec-timeout',
  'exec-timeo': 'exec-timeout',
  'exec-timeou': 'exec-timeout',
  
  // History
  'hist': 'history',
  'histo': 'history',
  'histor': 'history',
  'history': 'history',
  'hist s': 'history size',
  'histo s': 'history size',
  'histor s': 'history size',
  'history s': 'history size',
  'history si': 'history size',
  'history siz': 'history size',
  
  // Terminal
  'term': 'terminal',
  'termi': 'terminal',
  'termin': 'terminal',
  'term l': 'terminal length',
  'termi l': 'terminal length',
  'termin l': 'terminal length',
  'terminal l': 'terminal length',
  'terminal le': 'terminal length',
  'terminal len': 'terminal length',
  'terminal leng': 'terminal length',
  'terminal lengt': 'terminal length',
  'terminal no monitor': 'terminal no monitor',
  'term no mon': 'terminal no monitor',
  'terminal mon': 'terminal monitor',
  'term mon': 'terminal monitor',
  
  // Reload
  'rel': 'reload',
  'relo': 'reload',
  'reloa': 'reload',
  
  // Ping
  'pi': 'ping',
  'pin': 'ping',
  
  // Traceroute
  'trac': 'traceroute',
  'trace': 'traceroute',
  'tracer': 'traceroute',
  'tracero': 'traceroute',
  'tracerou': 'traceroute',
  'tracerout': 'traceroute',
  
  // Telnet
  'tel': 'telnet',
  'teln': 'telnet',
  'telne': 'telnet',
  
  // SSH
  'ss': 'ssh',
  'ssh': 'ssh',
  
  // Crypto key generate
  'cry': 'crypto',
  'cryp': 'crypto',
  'crypt': 'crypto',
  'crypto': 'crypto',
  'cry k': 'crypto key',
  'cryp k': 'crypto key',
  'crypt k': 'crypto key',
  'crypto k': 'crypto key',
  'cry ke': 'crypto key',
  'cryp ke': 'crypto key',
  'crypt ke': 'crypto key',
  'crypto ke': 'crypto key',
  'crypto key': 'crypto key',
  'crypto key g': 'crypto key generate',
  'crypto key ge': 'crypto key generate',
  'crypto key gen': 'crypto key generate',
  'crypto key gene': 'crypto key generate',
  'crypto key gener': 'crypto key generate',
  'crypto key genera': 'crypto key generate',
  'crypto key generat': 'crypto key generate',
  'crypto key generate': 'crypto key generate',
  'crypto key generate r': 'crypto key generate rsa',
  'crypto key generate rs': 'crypto key generate rsa',
  'crypto key generate rsa': 'crypto key generate rsa',
  
  // Ip domain-name
  'ip dn': 'ip domain-name',
  'ip dom': 'ip domain-name',
  'ip doma': 'ip domain-name',
  'ip domai': 'ip domain-name',
  'ip domain': 'ip domain-name',
  'ip domain-': 'ip domain-name',
  'ip domain-n': 'ip domain-name',
  'ip domain-na': 'ip domain-name',
  'ip domain-nam': 'ip domain-name',
  
  // Ip ssh version
  'ip ssh': 'ip ssh',
  'ip ssh v': 'ip ssh version',
  'ip ssh ve': 'ip ssh version',
  'ip ssh ver': 'ip ssh version',
  'ip ssh vers': 'ip ssh version',
  'ip ssh versi': 'ip ssh version',
  'ip ssh versio': 'ip ssh version',
  
  // Mac address-table static
  'mac a': 'mac address-table static',
  'mac ad': 'mac address-table static',
  'mac add': 'mac address-table static',
  'mac addr': 'mac address-table static',
  'mac addre': 'mac address-table static',
  'mac addres': 'mac address-table static',
  'mac address': 'mac address-table static',
  'mac address-': 'mac address-table static',
  'mac address-t': 'mac address-table static',
  'mac address-ta': 'mac address-table static',
  'mac address-tab': 'mac address-table static',
  'mac address-tabl': 'mac address-table static',
  'mac address-table': 'mac address-table static',
  'mac address-table s': 'mac address-table static',
  'mac address-table st': 'mac address-table static',
  'mac address-table sta': 'mac address-table static',
  'mac address-table stat': 'mac address-table static',
  'mac address-table stati': 'mac address-table static',
  
  // Alias command
  'ali': 'alias',
  'alia': 'alias',
  'alias': 'alias',
  
  // Default interface
  'def': 'default',
  'defa': 'default',
  'defau': 'default',
  'defaul': 'default',
  'default i': 'default interface',
  'default in': 'default interface',
  'default int': 'default interface',
  'default inte': 'default interface',
  'default inter': 'default interface',
  'default interf': 'default interface',
  'default interfa': 'default interface',
  'default interfac': 'default interface',
  
  // More commands
  'mo': 'more',
  'mor': 'more',
  
  // Debug
  'deb': 'debug',
  'debu': 'debug',
  'debug': 'debug',
  'no deb': 'no debug',
  'no debu': 'no debug',
  'no debug': 'no debug',
  'undeb': 'undebug',
  'undebu': 'undebug',
  'undebug': 'undebug',
  
  // Show debug
  'sh deb': 'show debug',
  'sh debu': 'show debug',
  'sh debug': 'show debug',
  
  // Show processes
  'sh pro': 'show processes',
  'sh proc': 'show processes',
  'sh proce': 'show processes',
  'sh proces': 'show processes',
  'sh process': 'show processes',
  'sh processes': 'show processes',
  
  // Show memory
  'sh mem': 'show memory',
  'sh memo': 'show memory',
  'sh memor': 'show memory',
  
  // Show clock
  'sh cl': 'show clock',
  'sh clo': 'show clock',
  'sh cloc': 'show clock',
  
  // Show flash
  'sh fl': 'show flash',
  'sh fla': 'show flash',
  'sh flas': 'show flash',
  
  // Show boot
  'sh bo': 'show boot',
  'sh boo': 'show boot',
  
  // Show environment
  'sh env': 'show environment',
  'sh envi': 'show environment',
  'sh envir': 'show environment',
  'sh enviro': 'show environment',
  'sh environ': 'show environment',
  'sh environm': 'show environment',
  'sh environme': 'show environment',
  'sh environmen': 'show environment',
  
  // Show inventory
  'sh inv': 'show inventory',
  'sh inve': 'show inventory',
  'sh inven': 'show inventory',
  'sh invent': 'show inventory',
  'sh invento': 'show inventory',
  'sh inventor': 'show inventory',
  
  // Show users
  'sh u': 'show users',
  'sh us': 'show users',
  'sh use': 'show users',
  'sh user': 'show users',
  
  // Show sessions
  'sh ses': 'show sessions',
  'sh sess': 'show sessions',
  'sh sessi': 'show sessions',
  'sh sessio': 'show sessions',
  'sh session': 'show sessions',
  
  // Disconnect
  'discon': 'disconnect',
  'disconn': 'disconnect',
  'discconne': 'disconnect',
  'disconnect': 'disconnect',
  
  // Clear commands
  'cle': 'clear',
  'clea': 'clear',
  'cle ar': 'clear arp-cache',
  'clea ar': 'clear arp-cache',
  'clear ar': 'clear arp-cache',
  'clear arp': 'clear arp-cache',
  'clear arp-': 'clear arp-cache',
  'clear arp-c': 'clear arp-cache',
  'clear arp-ca': 'clear arp-cache',
  'clear arp-cac': 'clear arp-cache',
  'clear arp-cache': 'clear arp-cache',
  
  'cle cou': 'clear counters',
  'clea cou': 'clear counters',
  'clear cou': 'clear counters',
  'clear coun': 'clear counters',
  'clear count': 'clear counters',
  'clear counte': 'clear counters',
  'clear counter': 'clear counters',
  
  'cle mac': 'clear mac address-table',
  'clea mac': 'clear mac address-table',
  'clear mac': 'clear mac address-table',
  'clear mac-': 'clear mac address-table',
  'clear mac-a': 'clear mac address-table',
  'clear mac-ad': 'clear mac address-table',
  'clear mac-addr': 'clear mac address-table',
  'clear mac-addre': 'clear mac address-table',
  'clear mac-addres': 'clear mac address-table',
  'clear mac-address': 'clear mac address-table',
  'clear mac-address-': 'clear mac address-table',
  'clear mac-address-t': 'clear mac address-table',
  'clear mac-address-ta': 'clear mac address-table',
  'clear mac-address-tab': 'clear mac address-table',
  'clear mac-address-tabl': 'clear mac address-table',
  'clear mac-address-table': 'clear mac address-table',
  
  // Archive
  'arc': 'archive',
  'arch': 'archive',
  'archi': 'archive',
  'archiv': 'archive',
  
  // Configure replace
  'conf r': 'configure replace',
  'conf re': 'configure replace',
  'conf rep': 'configure replace',
  'conf repl': 'configure replace',
  'conf repla': 'configure replace',
  'conf replac': 'configure replace',
  'configure r': 'configure replace',
  'configure re': 'configure replace',
  'configure rep': 'configure replace',
  'configure repl': 'configure replace',
  'configure repla': 'configure replace',
  'configure replac': 'configure replace',
  
  // Template
  'tem': 'template',
  'temp': 'template',
  'templ': 'template',
  'templa': 'template',
  'templat': 'template',
  
  // Policy-map
  'pol': 'policy-map',
  'poli': 'policy-map',
  'polic': 'policy-map',
  'policy': 'policy-map',
  'policy-': 'policy-map',
  'policy-m': 'policy-map',
  'policy-ma': 'policy-map',
  
  // Class-map
  'cla': 'class-map',
  'clas': 'class-map',
  'class': 'class-map',
  'class-': 'class-map',
  'class-m': 'class-map',
  'class-ma': 'class-map',
  
  // Access-list
  'ac': 'access-list',
  'acc': 'access-list',
  'acce': 'access-list',
  'acces': 'access-list',
  'access': 'access-list',
  'access-': 'access-list',
  'access-l': 'access-list',
  'access-li': 'access-list',
  'access-lis': 'access-list',
  
  // Mac access-list
  'mac acc': 'mac access-list',
  'mac acce': 'mac access-list',
  'mac acces': 'mac access-list',
  'mac access': 'mac access-list',
  'mac access-': 'mac access-list',
  'mac access-l': 'mac access-list',
  'mac access-li': 'mac access-list',
  'mac access-lis': 'mac access-list',
  
  // Arp inspection
  'ip arp i': 'ip arp inspection',
  'ip arp in': 'ip arp inspection',
  'ip arp ins': 'ip arp inspection',
  'ip arp insp': 'ip arp inspection',
  'ip arp inspe': 'ip arp inspection',
  'ip arp inspec': 'ip arp inspection',
  'ip arp inspect': 'ip arp inspection',
  'ip arp inspecti': 'ip arp inspection',
  'ip arp inspectio': 'ip arp inspection',
  
  // DHCP snooping
  'ip dhcp s': 'ip dhcp snooping',
  'ip dhcp sn': 'ip dhcp snooping',
  'ip dhcp sno': 'ip dhcp snooping',
  'ip dhcp snoo': 'ip dhcp snooping',
  'ip dhcp snoop': 'ip dhcp snooping',
  'ip dhcp snoopi': 'ip dhcp snooping',
  'ip dhcp snoopin': 'ip dhcp snooping',
  
  // Storm control
  'sto': 'storm-control',
  'stor': 'storm-control',
  'storm': 'storm-control',
  'storm-': 'storm-control',
  'storm-c': 'storm-control',
  'storm-co': 'storm-control',
  'storm-con': 'storm-control',
  'storm-cont': 'storm-control',
  'storm-contr': 'storm-control',
  'storm-contro': 'storm-control',
  
  // UDLD
  'ud': 'udld',
  'udl': 'udld',
  'udld': 'udld',
  'udld e': 'udld enable',
  'udld en': 'udld enable',
  'udld ena': 'udld enable',
  'udld enab': 'udld enable',
  'udld enabl': 'udld enable',
  'udld enable': 'udld enable',
  
  // LACP
  'lacp': 'lacp',
  'lacp p': 'lacp port-priority',
  'lacp po': 'lacp port-priority',
  'lacp por': 'lacp port-priority',
  'lacp port': 'lacp port-priority',
  'lacp port-': 'lacp port-priority',
  'lacp port-p': 'lacp port-priority',
  'lacp port-pr': 'lacp port-priority',
  'lacp port-pri': 'lacp port-priority',
  'lacp port-prio': 'lacp port-priority',
  'lacp port-prior': 'lacp port-priority',
  'lacp port-priori': 'lacp port-priority',
  'lacp port-priorit': 'lacp port-priority',
  
  // PAgP
  'pagp': 'pagp',
  
  // Monitor (SPAN)
  'mon': 'monitor',
  'moni': 'monitor',
  'monit': 'monitor',
  'monito': 'monitor',
  'monitor s': 'monitor session',
  'monitor se': 'monitor session',
  'monitor ses': 'monitor session',
  'monitor sess': 'monitor session',
  'monitor sessi': 'monitor session',
  'monitor sessio': 'monitor session',
  
  // VTP
  'vtp': 'vtp',
  'vtp m': 'vtp mode',
  'vtp mo': 'vtp mode',
  'vtp mod': 'vtp mode',
  'vtp mode': 'vtp mode',
  'vtp mode s': 'vtp mode server',
  'vtp mode se': 'vtp mode server',
  'vtp mode ser': 'vtp mode server',
  'vtp mode serv': 'vtp mode server',
  'vtp mode serve': 'vtp mode server',
  'vtp mode c': 'vtp mode client',
  'vtp mode cl': 'vtp mode client',
  'vtp mode cli': 'vtp mode client',
  'vtp mode clien': 'vtp mode client',
  'vtp mode t': 'vtp mode transparent',
  'vtp mode tr': 'vtp mode transparent',
  'vtp mode tra': 'vtp mode transparent',
  'vtp mode tran': 'vtp mode transparent',
  'vtp mode trans': 'vtp mode transparent',
  'vtp mode transp': 'vtp mode transparent',
  'vtp mode transpa': 'vtp mode transparent',
  'vtp mode transpar': 'vtp mode transparent',
  'vtp mode transpare': 'vtp mode transparent',
  'vtp mode transparen': 'vtp mode transparent',
  'vtp d': 'vtp domain',
  'vtp do': 'vtp domain',
  'vtp dom': 'vtp domain',
  'vtp doma': 'vtp domain',
  'vtp domai': 'vtp domain',
  
  // Snmp
  'snmp': 'snmp-server',
  'snmp-': 'snmp-server',
  'snmp-s': 'snmp-server',
  'snmp-se': 'snmp-server',
  'snmp-ser': 'snmp-server',
  'snmp-serv': 'snmp-server',
  'snmp-serve': 'snmp-server',
  
  // Ntp
  'ntp': 'ntp',
  'ntp s': 'ntp server',
  'ntp se': 'ntp server',
  'ntp ser': 'ntp server',
  'ntp serv': 'ntp server',
  'ntp serve': 'ntp server',
  
  // Clock
  'clo': 'clock',
  'cloc': 'clock',
  'clock t': 'clock timezone',
  'clock ti': 'clock timezone',
  'clock tim': 'clock timezone',
  'clock time': 'clock timezone',
  'clock timez': 'clock timezone',
  'clock timezo': 'clock timezone',
  'clock timezon': 'clock timezone',
  
  // System MTU
  'sys': 'system',
  'syst': 'system',
  'syste': 'system',
  'system m': 'system mtu',
  'system mt': 'system mtu',
  'system mtu': 'system mtu',
  
  // SDM prefer
  'sdm': 'sdm',
  'sdm p': 'sdm prefer',
  'sdm pr': 'sdm prefer',
  'sdm pre': 'sdm prefer',
  'sdm pref': 'sdm prefer',
  'sdm prefe': 'sdm prefer',
  
  // Power inline (PoE)
  'pow': 'power',
  'powe': 'power',
  'power i': 'power inline',
  'power in': 'power inline',
  'power inl': 'power inline',
  'power inli': 'power inline',
  'power inlin': 'power inline',
  'power inline': 'power inline',
  'power inline n': 'power inline never',
  'power inline ne': 'power inline never',
  'power inline nev': 'power inline never',
  'power inline neve': 'power inline never',
  'power inline s': 'power inline static',
  'power inline st': 'power inline static',
  'power inline sta': 'power inline static',
  'power inline stat': 'power inline static',
  
  // Voice VLAN
  'sw v': 'switchport voice',
  'sw vo': 'switchport voice',
  'sw voi': 'switchport voice',
  'sw voic': 'switchport voice',
  'switchport v': 'switchport voice',
  'switchport vo': 'switchport voice',
  'switchport voi': 'switchport voice',
  'switchport voic': 'switchport voice',
  'switchport voice': 'switchport voice',
  'switchport voice v': 'switchport voice vlan',
  'switchport voice vl': 'switchport voice vlan',
  'switchport voice vla': 'switchport voice vlan',
  
  // MLs QoS
  'mls': 'mls',
  'mls q': 'mls qos',
  'mls qo': 'mls qos',
  'mls qos': 'mls qos',
  'mls qos t': 'mls qos trust',
  'mls qos tr': 'mls qos trust',
  'mls qos tru': 'mls qos trust',
  'mls qos trust': 'mls qos trust',
  'mls qos trust c': 'mls qos trust cos',
  'mls qos trust co': 'mls qos trust cos',
  'mls qos trust d': 'mls qos trust dscp',
  'mls qos trust ds': 'mls qos trust dscp',
  'mls qos trust dsc': 'mls qos trust dscp',
  
  // Priority-queue
  'pri': 'priority-queue',
  'prio': 'priority-queue',
  'prior': 'priority-queue',
  'priori': 'priority-queue',
  'priorit': 'priority-queue',
  'priority': 'priority-queue',
  'priority-': 'priority-queue',
  'priority-q': 'priority-queue',
  'priority-qu': 'priority-queue',
  'priority-que': 'priority-queue',
  'priority-queu': 'priority-queue',
  'priority-queue': 'priority-queue',
  'priority-queue o': 'priority-queue out',
  'priority-queue ou': 'priority-queue out',
  'priority-queue out': 'priority-queue out',
  
  // Queue-set
  'que': 'queue-set',
  'queu': 'queue-set',
  'queue': 'queue-set',
  'queue-': 'queue-set',
  'queue-s': 'queue-set',
  'queue-se': 'queue-set',
  'queue-set': 'queue-set',
  
  // Test
  'tes': 'test',
  'test': 'test',
  
  // Setup
  'set': 'setup',
  'setu': 'setup',
  'setup': 'setup'
};
