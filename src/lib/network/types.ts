// Network Simulator 2026 Types

export type CommandMode =
  | 'user'           // Switch>
  | 'privileged'     // Switch#
  | 'config'         // Switch(config)#
  | 'interface'      // Switch(config-if)#
  | 'line'           // Switch(config-line)#
  | 'vlan';          // Switch(config-vlan)#

export type PortStatus = 'connected' | 'notconnect' | 'disabled' | 'blocked';
export type PortMode = 'access' | 'trunk';
export type DuplexMode = 'half' | 'full' | 'auto';
export type SpeedMode = '10' | '100' | '1000' | 'auto';
export type VoiceVlanMode = number | 'dot1p' | 'none' | 'untagged';
export type EtherChannelProtocol = 'lacp' | 'pagp';
export type EtherChannelMode = 'on' | 'active' | 'passive' | 'desirable' | 'auto';

export interface Port {
  id: string;              // fa0/1, gi0/1 etc.
  name: string;            // description
  status: PortStatus;
  vlan: number;
  mode: PortMode;
  voiceVlan?: VoiceVlanMode;
  duplex: DuplexMode;
  speed: SpeedMode;
  shutdown: boolean;
  type: 'fastethernet' | 'gigabitethernet';
  previousStatus?: PortStatus;  // shutdown öncesi durum (no shutdown için)
  ipAddress?: string;           // For L3 ports or SVI
  subnetMask?: string;
  allowedVlans?: number[] | 'all'; // For trunk ports
  channelGroup?: number; // Port-channel group id
  channelMode?: EtherChannelMode;
  channelProtocol?: EtherChannelProtocol;
  portSecurity?: {
    enabled: boolean;
    maxMac: number;
    violation: 'protect' | 'restrict' | 'shutdown';
    stickyMac: boolean;
  };
  ipv6Address?: string;         // For CCNA 1 v7 support
  ipv6Prefix?: number;
}

export interface Vlan {
  id: number;
  name: string;
  status: 'active' | 'suspend';
  ports: string[];
}

export interface LineConfig {
  password?: string;
  login: boolean;
  loginLocal?: boolean;
  transportInput: ('ssh' | 'telnet' | 'all' | 'none')[];
}

export interface SecurityConfig {
  enableSecret?: string;
  enableSecretEncrypted: boolean;
  enablePassword?: string;
  servicePasswordEncryption: boolean;
  users: { username: string; password: string; privilege: number }[];
  consoleLine: LineConfig;
  vtyLines: LineConfig;
}

export interface SwitchState {
  hostname: string;
  macAddress: string; // Unique base MAC address for the device
  currentMode: CommandMode;
  currentInterface?: string;
  selectedInterfaces?: string[];  // interface range için çoklu port seçimi
  currentLine?: string;
  currentVlan?: number;
  ports: Record<string, Port>;
  vlans: Record<number, Vlan>;
  security: SecurityConfig;
  runningConfig: string[];
  commandHistory: string[];
  historyIndex: number;
  bannerMOTD?: string;
  version: {
    nosVersion: string;
    modelName: string;
    serialNumber: string;
    uptime: string;
  };
  macAddressTable: { mac: string; vlan: number; port: string; type: string }[];
  // Password prompt state
  awaitingPassword?: boolean;
  passwordContext?: 'enable';
  // New optional properties for extended features
  domainName?: string;
  defaultGateway?: string;
  dnsServer?: string;
  sshVersion?: 1 | 2;
  cdpEnabled?: boolean;
  spanningTreeMode?: 'pvst' | 'rapid-pvst' | 'mst';
  vtpMode?: 'server' | 'client' | 'transparent' | 'off';
  vtpDomain?: string;
  vtpPassword?: string;
  vtpRevision?: number;
  mlsQosEnabled?: boolean;
  dhcpSnoopingEnabled?: boolean;
  ntpServers?: string[];
  ipv6Enabled?: boolean;
  ipRouting: boolean;
  startupConfig?: StartupConfig;
}

export interface StartupConfig {
  hostname: string;
  ports: Record<string, Port>;
  vlans: Record<number, Vlan>;
  security: SecurityConfig;
  bannerMOTD?: string;
  domainName?: string;
  defaultGateway?: string;
  dnsServer?: string;
  sshVersion?: 1 | 2;
  cdpEnabled?: boolean;
  spanningTreeMode?: 'pvst' | 'rapid-pvst' | 'mst';
  vtpMode?: 'server' | 'client' | 'transparent' | 'off';
  vtpDomain?: string;
  mlsQosEnabled?: boolean;
  dhcpSnoopingEnabled?: boolean;
  ntpServers?: string[];
  ipv6Enabled?: boolean;
  ipRouting: boolean;
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  newState?: Partial<SwitchState>;
  modeChange?: CommandMode;
  requiresPassword?: boolean;        // Şifre gerekiyor mu?
  passwordPrompt?: string;           // Şifre istemi metni
  passwordContext?: 'enable';        // Şifre bağlamı
  requiresConfirmation?: boolean;    // Onay gerekiyor mu?
  confirmationMessage?: string;      // Onay mesajı
  confirmationAction?: string;       // Onay sonrası yapılacak işlem
  telnetTarget?: string;             // Telnet bağlantı hedef IP
  reloadDevice?: boolean;            // Cihazı sıfırla
}

export interface ParsedCommand {
  command: string;
  args: string[];
  rawInput: string;
  resolvedInput?: string;  // Alias-resolved input for executor
}

// Kablo Tipleri
export type CableType = 'straight' | 'crossover' | 'console';

export interface CableInfo {
  connected: boolean;
  cableType: CableType;
  sourceDevice: 'pc' | 'switch';
  targetDevice: 'pc' | 'switch';
  sourcePort?: string;  // Port ID (e.g., 'eth0', 'com1', 'console', 'fa0/1')
  targetPort?: string;  // Port ID
}

// Kablo uyumluluk kuralları
export const CABLE_COMPATIBILITY: Record<string, CableType[]> = {
  'pc-switch': ['straight'],
  'switch-pc': ['straight'],
  'pc-pc': ['crossover'],
  'switch-switch': ['crossover'],
  'pc-console': ['console'],
  'console-pc': ['console'],
};

// Console portu olup olmadığını kontrol et
function isConsolePort(portId: string | undefined): boolean {
  if (!portId) return false;
  const port = portId.toLowerCase();
  return port === 'console' || port === 'com1' || port === 'com';
}

// Ethernet portu olup olmadığını kontrol et
function isEthernetPort(portId: string | undefined): boolean {
  if (!portId) return false;
  const port = portId.toLowerCase();
  return port.startsWith('eth') || port.startsWith('fa') || port.startsWith('gi');
}

export function isCableCompatible(cable: CableInfo): boolean {
  if (!cable.connected) return false;

  // Console portu bağlantıları için özel kontrol
  // Console kablosu: PC COM1 <-> Switch Console portu
  const sourceIsConsole = isConsolePort(cable.sourcePort);
  const targetIsConsole = isConsolePort(cable.targetPort);

  if (sourceIsConsole || targetIsConsole) {
    // Console portları için sadece console kablosu geçerli
    if (cable.cableType !== 'console') return false;
    // Bir taraf console portu ise diğer taraf da console portu olmalı
    // PC COM1 <-> Switch Console veya Switch Console <-> PC COM1
    return sourceIsConsole && targetIsConsole;
  }

  // Normal Ethernet bağlantıları için standart kurallar
  const connection = `${cable.sourceDevice}-${cable.targetDevice}`;
  const allowedTypes = CABLE_COMPATIBILITY[connection];
  return allowedTypes ? allowedTypes.includes(cable.cableType) : false;
}

export function getCableTypeName(type: CableType, lang: 'tr' | 'en'): string {
  const names: Record<CableType, Record<'tr' | 'en', string>> = {
    straight: { tr: 'Düz Kablo', en: 'Straight-through' },
    crossover: { tr: 'Çapraz Kablo', en: 'Crossover' },
    console: { tr: 'Konsol Kablosu', en: 'Console Cable' },
  };
  return names[type][lang];
}

export function getCableTypeLabel(type: CableType, primaryLang: 'tr' | 'en'): string {
  const trLabel = getCableTypeName(type, 'tr');
  const enLabel = getCableTypeName(type, 'en');
  return primaryLang === 'tr'
    ? `${trLabel}`
    : `${enLabel}`;
}

// Port LED renkleri
export type PortLEDColor = 'green' | 'gray' | 'orange' | 'off' | 'white';

export function getPortLEDColor(port: Port): PortLEDColor {
  if (port.shutdown) return 'gray';
  if (port.status === 'blocked') return 'orange';
  if (port.status === 'connected') return 'green';
  if (port.status === 'notconnect') return 'white';
  return 'white';
}

// Port tipi yardımcı fonksiyonları
export function parsePortId(portId: string): { type: 'fa' | 'gi'; module: number; port: number } | null {
  const match = portId.toLowerCase().match(/^(fa|gi)(\d+)\/(\d+)$/);
  if (!match) return null;
  return {
    type: match[1] as 'fa' | 'gi',
    module: parseInt(match[2]),
    port: parseInt(match[3])
  };
}

export function formatPortId(type: 'fastethernet' | 'gigabitethernet', module: number, port: number): string {
  const prefix = type === 'fastethernet' ? 'Fa' : 'Gi';
  return `${prefix}${module}/${port}`;
}
