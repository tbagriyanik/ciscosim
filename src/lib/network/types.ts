// Network Simulator Types

import type { SwitchModel } from './switchModels';
import type { DeviceWifiSsidProfile } from './wireless';
import type {
  OspfNeighborRecord,
  EigrpNeighborRecord,
  DhcpClientRecord,
  LacpPortRecord,
} from './protocols/protocolStateMachines';

// ============================================
// CENTRALIZED TYPE DEFINITIONS
// ============================================

// WiFi Mode Types (Centralized - used across the application)
export type WifiMode = 'ap' | 'client' | 'disabled' | 'sta';

// Port Status Types (Centralized - used across the application)
export type PortStatus = 'connected' | 'notconnect' | 'disabled' | 'blocked' | 'err-disabled' | 'disconnected';

// Port Mode Types (Centralized - used across the application)
export type PortMode = 'access' | 'trunk' | 'routed' | 'dynamic-auto' | 'dynamic-desirable' | 'dot1q-tunnel';

// WiFi Configuration Types (Centralized - used across the application)
export interface Dhcpv6Binding {
  iaid: string; // Identity Association ID (e.g. 0x00010001)
  duid: string; // Client DUID (e.g. 00:03:00:01:00:50:56:C0:00:01)
  ipv6Address: string; // Leased IPv6 address
  type: 'IA_NA' | 'IA_PD'; // Non-temporary Address or Prefix Delegation
  preferredLifetime: number; // e.g. 604800 sec
  validLifetime: number; // e.g. 2592000 sec
  interfaceId: string; // Ingress interface (e.g. Gi0/0)
  clientHostname?: string;
  leaseTime: number; // Timestamp when leased
}

export interface PppoeSession {
  sessionId: number; // e.g. 101
  clientDeviceId: string; // e.g. 'r1'
  clientInterfaceId: string; // e.g. 'gi0/0' or 'dialer1'
  clientMac: string;
  serverDeviceId: string; // e.g. 'r2'
  serverInterfaceId: string; // e.g. 'gi0/0'
  serverMac: string;
  discoveryState: 'IDLE' | 'PADI_SENT' | 'PADO_RCVD' | 'PADR_SENT' | 'PADS_RCVD' | 'ESTABLISHED';
  lcpState: 'Initial' | 'Starting' | 'ReqSent' | 'AckRcvd' | 'Opened';
  authProtocol: 'CHAP' | 'PAP' | 'NONE';
  authenticated: boolean;
  ipcpState: 'Initial' | 'ReqSent' | 'AckRcvd' | 'Opened';
  assignedIp: string;
  peerIp: string;
  primaryDns?: string;
  uptime: number; // seconds
}

export interface WifiConfig {

  enabled?: boolean;
  ssid: string;
  bssid?: string;
  password?: string;
  security?: 'open' | 'wep' | 'wpa' | 'wpa2' | 'wpa3';
  channel?: '2.4GHz' | '5GHz' | string;
  mode: WifiMode;
  hidden?: boolean;
  maxClients?: number;
  macFilterEnabled?: boolean;
  macFilterMode?: 'allow' | 'deny';
  macFilterList?: string[];
  ssids?: DeviceWifiSsidProfile[];
  powerDisabled?: boolean;
  txPowerDbm?: number;
}


// Helper function to normalize WiFi config with defaults
export function normalizeWifiConfig(config: Partial<WifiConfig> & { ssid: string; mode: WifiMode }): WifiConfig {
  return {
    enabled: config.enabled ?? true,
    ssid: config.ssid,
    mode: config.mode,
    security: config.security ?? 'open',
    channel: config.channel ?? '2.4GHz',
    password: config.password,
    bssid: config.bssid,
    hidden: config.hidden,
    maxClients: config.maxClients,
    macFilterEnabled: config.macFilterEnabled,
    macFilterMode: config.macFilterMode,
    macFilterList: config.macFilterList,
    ssids: config.ssids,
    powerDisabled: config.powerDisabled,
  };
}

// Helper function to ensure WiFi config has required fields for wireless functions
export function ensureWifiConfig(config: Partial<WifiConfig> & { ssid: string; mode: WifiMode }): WifiConfig {
  return normalizeWifiConfig(config);
}

// Helper function to normalize security type
export function normalizeSecurityType(security: string | undefined): 'open' | 'wep' | 'wpa' | 'wpa2' | 'wpa3' {
  if (!security) return 'open';
  const normalized = security.toLowerCase();
  if (normalized === 'wpa3') return 'wpa3';
  if (normalized === 'wpa2') return 'wpa2';
  if (normalized === 'wpa') return 'wpa';
  if (normalized === 'wep') return 'wep';
  return 'open';
}

export type CommandMode =
  | 'user'           // Switch>
  | 'privileged'     // Switch#
  | 'config'         // Switch(config)#
  | 'interface'      // Switch(config-if)#
  | 'config-if-range' // Switch(config-if-range)#
  | 'line'           // Switch(config-line)#
  | 'vlan'           // Switch(config-vlan)#
  | 'router-config'  // Router(config-router)#
  | 'dhcp-config'    // Router(dhcp-config)#
  | 'ssid-config'    // Router(config-ssid)#
  | 'dot11-config'   // Router(config-if)# [dot11Radio]
  | 'ap-config'      // AP configuration mode
  | 'config-std-nacl'  // Router(config-std-nacl)# - Named standard ACL
  | 'config-ext-nacl'  // Router(config-ext-nacl)# - Named extended ACL
  | 'config-ipv6-acl'  // Router(config-ipv6-acl)# - Named IPv6 ACL
  | 'config-mst'        // Switch(config-mst)# - MST configuration mode
  | 'config-route-map'; // Router(config-route-map)# - Route-map configuration mode

// Port status and mode types are now defined above as centralized types
type VoiceVlanMode = number | 'dot1p' | 'none' | 'untagged';
type EtherChannelProtocol = 'lacp' | 'pagp';
export type DuplexMode = 'half' | 'full' | 'auto';
export type SpeedMode = '10' | '100' | '1000' | '10000' | 'auto';
export type EtherChannelMode = 'on' | 'active' | 'passive' | 'desirable' | 'auto';

export interface PortStats {
  rxPackets?: number;
  rxBytes?: number;
  txPackets?: number;
  txBytes?: number;
  rxDrops?: number;
  txDrops?: number;
  rxErrors?: number;
  txErrors?: number;
}

export interface Port {
  id: string;              // fa0/1, gi0/1 etc.
  name: string;            // description
  description?: string;    // interface description (CLI: description <text>)
  status: PortStatus;
  stats?: PortStats;
  vlan: number;
  accessVlan?: number | string;
  nativeVlan?: number;       // Native VLAN for trunk ports
  mode: PortMode;
  voiceVlan?: VoiceVlanMode;
  duplex: DuplexMode;
  speed: SpeedMode;
  shutdown: boolean;
  type: 'fastethernet' | 'gigabitethernet' | 'vlan' | 'serial' | 'tunnel';
  previousStatus?: PortStatus;  // shutdown öncesi durum (no shutdown için)
  ipAddress?: string;           // For L3 ports or SVI
  subnetMask?: string;
  stpCost?: number;             // Manual STP path cost
  arpTimeout?: string;          // ARP timeout setting
  macAddress?: string;         // Per-port MAC address (for router ports)
  allowedVlans?: number[] | 'all'; // For trunk ports
  accessGroupIn?: string;       // Inbound ACL name/ID
  accessGroupOut?: string;      // Outbound ACL name/ID
  channelGroup?: number; // Port-channel group id
  channelMode?: EtherChannelMode;
  channelProtocol?: EtherChannelProtocol;
  portSecurity?: {
    enabled: boolean;
    maxAddresses?: number;
    violationAction?: 'protect' | 'restrict' | 'shutdown';
    sticky?: boolean;
    violations?: number;
    macAddress?: string;
    aging?: {
      enabled?: boolean;
      time?: number; // minutes
      type?: 'absolute' | 'inactivity';
    };
  };
  staticMacs?: string[]; // Static MAC addresses for port security
  stickyMacs?: string[]; // Sticky MAC addresses for port security
  protected?: boolean; // Protected port (PVLAN edge)
  ipv6Address?: string;
  ipv6Prefix?: number;
  ipv6LinkLocal?: string;
  ipv6Autoconfig?: boolean;
  ipv6Rip?: {
    enabled: boolean;
    processName?: string;
  };
  ipv6Ospf?: {
    enabled: boolean;
    processId?: string;
    area?: string;
  };
  ipv6NdSuppressRa?: boolean;
  ospfEnabled?: boolean;
  ospfProcessId?: string;
  ospfArea?: string;
  ipv6DhcpServer?: string;
  ipv6DhcpServerPool?: string; // Pool name for 'ipv6 dhcp server <pool>' on interface
  pppoeClientDialPool?: number; // pppoe-client dial-pool-number N
  pppoeEnableGroup?: string; // pppoe enable group <group>
  dialerPool?: number; // dialer pool N
  pppAuthentication?: string; // ppp authentication chap pap
  pppChapHostname?: string;
  pppChapPassword?: string;
  helperAddresses?: string[];

  lldpTransmit?: boolean;       // default: true when LLDP enabled
  lldpReceive?: boolean;        // default: true when LLDP enabled
  isRoutedPort?: boolean;       // For L3 switch routed ports
  isSubinterface?: boolean;     // For subinterfaces (e.g., gi0/0.10)
  tunnel?: {
    source?: string;
    destination?: string;
    protocol?: 'gre' | 'ipsec';
  };
  parentInterface?: string;     // Parent interface for subinterfaces
  dot1qVlan?: number;           // Dot1q VLAN for subinterfaces
  nameif?: string;              // ASA interface name (inside, outside, etc.)
  securityLevel?: number;       // ASA security level (0-100)
  wifi?: Partial<WifiConfig> & {
    ssid: string;
    mode: WifiMode;
  } | {
    ssid: string;
    security: 'open' | 'wep' | 'wpa' | 'wpa2' | 'wpa3';
    password?: string;
    channel: '2.4GHz' | '5GHz' | string;
    mode: 'ap' | 'client' | 'disabled' | 'sta';
    hidden?: boolean;
    maxClients?: number;
    macFilterEnabled?: boolean;
    macFilterMode?: 'allow' | 'deny';
    macFilterList?: string[];
    ssids?: DeviceWifiSsidProfile[];
  };
  spanningTree?: {
    role?: 'root' | 'designated' | 'alternate' | 'backup' | 'disabled';
    state?: 'forwarding' | 'blocking' | 'listening' | 'learning' | 'disabled';
    portfast?: boolean;
    bpduguard?: boolean;
    loopguard?: 'enable' | 'disable' | 'default';
    loopInconsistent?: boolean;
    instances?: Record<number, {
      role?: 'root' | 'designated' | 'alternate' | 'backup' | 'disabled';
      state?: 'forwarding' | 'blocking' | 'listening' | 'learning' | 'disabled';
    }>;
  };
  // Link layer properties
  mtu?: number;                    // Maximum Transmission Unit (default 1500)
  adminStatus?: 'up' | 'down';     // Admin status (from config: shutdown/no shutdown)
  operStatus?: 'up' | 'down';      // Operational status (actual port state)
  lineProtocol?: 'up' | 'down';    // Line protocol status
  encapsulation?: 'isl' | '802.1q' | 'native' | 'dot1q-tunnel' | 'hdlc' | 'ppp'; // Encapsulation type (trunk or WAN serial)
  // QoS & Performance properties
  qos?: {
    enabled: boolean;
    policyMap?: string;           // Service policy name
    ingressQueue?: number;        // Input queue size
    egressQueue?: number;         // Output queue size
    priorityQueue?: {
      enabled: boolean;
      limit?: number;
    };
    shaping?: {
      enabled: boolean;
      rate?: number;              // bits per second
    };
    policing?: {
      enabled: boolean;
      rate?: number;              // bits per second
      burst?: number;
    };
  };
  qosDscp?: string;
  qosTrust?: 'cos' | 'dscp' | 'ip-precedence';
  qosCos?: number;
  bandwidth?: number;               // Bandwidth in kbps (for routing protocols)
  delay?: number;                   // Delay in microseconds (for routing protocols)
  stpPriority?: number;
  dhcpSnoopingTrust?: boolean;
  dhcpSnoopingLimitRate?: number; // DHCP rate limit (packets per second) on untrusted ports
  arpInspectionTrust?: boolean;
  arpInspectionLimitRate?: number;
  carrierDelay?: number;
  loadInterval?: number;
  directedBroadcast?: boolean;
  powerInline?: {
    auto?: boolean;
    static?: boolean;
    never?: boolean;
    maxMilliwatts?: number;
    enabled?: boolean;
    consumption?: number;
  };
  nonegotiate?: boolean;
  ipVerifySource?: boolean;
  ipVerifySourcePortSecurity?: boolean;
  // Statistics & Counters
  statistics?: {
    inputPackets?: number;
    outputPackets?: number;
    inputBytes?: number;
    outputBytes?: number;
    inputErrors?: number;
    outputErrors?: number;
    crcErrors?: number;
    collisions?: number;
    runts?: number;                 // Frames < 64 bytes
    giants?: number;                // Frames > 1500 bytes
    throttles?: number;
    resets?: number;
    drops?: number;
    overruns?: number;
    underruns?: number;
    lastInput?: number;             // Timestamp of last input
    lastOutput?: number;            // Timestamp of last output
    lastCleared?: number;           // Timestamp when stats cleared
  };
  // Trunk specific properties
  trunkAllowedVlans?: number[] | string;  // VLAN range (e.g., "1-4094,except 1002-1005")
  trunkNativeVlan?: number;               // VLAN that doesn't get tagged
  trunkEncapsulation?: 'dot1q' | 'isl' | 'negotiate';
  vlanPruning?: {
    enabled: boolean;
    prunedVlans?: number[];
  };
  // Congestion & Flow Control
  congestion?: {
    level?: 'low' | 'medium' | 'high';
    flowControl?: boolean;
    pauseFrames?: number;
  };
  // Link aggregation details
  linkAggregation?: {
    enabled: boolean;
    groupId?: number;
    portInGroup?: number;
    totalPortsInGroup?: number;
    activePortsInGroup?: number;
  };
  // Port monitor (SPAN) settings
  portMonitor?: {
    source?: boolean;
    destination?: boolean;
    direction?: 'rx' | 'tx' | 'both';
  };
  // BPDU Guard & related features
  bpduGuard?: boolean;
  bpduFilter?: boolean;
  rootGuard?: boolean;
  // Storm control
  stormControl?: {
    broadcast?: {
      enabled: boolean;
      threshold?: number;         // percentage or pps
      action?: 'shutdown' | 'trap';
    };
    multicast?: {
      enabled: boolean;
      threshold?: number;
      action?: 'shutdown' | 'trap';
    };
    unicast?: {
      enabled: boolean;
      threshold?: number;
      action?: 'shutdown' | 'trap';
    };
  };
  // UDLD - Unidirectional Link Detection
  udld?: {
    enabled: boolean;
    mode?: 'normal' | 'aggressive';
    lastProbeTime?: number;
    bidirectionalStatus?: 'up' | 'down' | 'unknown';
  };
  hsrp?: {
    groups?: Record<number, {
      virtualIp?: string;
      ipv6VirtualIp?: string;
      virtualMac?: string;
      version?: number;
      priority?: number;
      preempt?: boolean;
      state?: 'Initial' | 'Listen' | 'Speak' | 'Standby' | 'Active';
    }>;
  };
  vrrp?: {
    groups?: Record<number, {
      virtualIp?: string;
      virtualMac?: string;
      priority?: number;
      preempt?: boolean;
      state?: 'Init' | 'Backup' | 'Master';
    }>;
  };
  glbp?: {
    groups?: Record<number, {
      virtualIp?: string;
      priority?: number;
      preempt?: boolean;
      loadBalancing?: 'round-robin' | 'weighted' | 'host-dependent';
      weighting?: number;
      state?: 'Listen' | 'Speak' | 'Standby' | 'Active';
      avgMac?: string;
      avfMacs?: Record<number, string>;
    }>;
  };
  ipv6Eigrp?: {
    enabled: boolean;
    as: string;
  };
  netflowIngress?: boolean;
  netflowEgress?: boolean;
  ipv6TrafficFilterIn?: string;
  ipv6TrafficFilterOut?: string;
  natSide?: 'inside' | 'outside';
  // Serial interface properties (WAN)
  serialEncapsulation?: 'hdlc' | 'ppp';
  clockRate?: number;       // Clock rate in bps (DCE side)
  dce?: boolean;            // Whether this serial port is DCE
  pppAuth?: 'pap' | 'chap' | 'none';  // PPP authentication type
  pppPapUsername?: string;
  pppPapPassword?: string;
  lapGroup?: number;        // Lightweight AP group (WLC)
}

export interface Vlan {
  id: number;
  name: string;
  status: 'active' | 'suspend';
  ports: string[];
  ipAddress?: string;
  subnetMask?: string;
}

interface LineConfig {
  password?: string;
  login: boolean;
  loginLocal?: boolean;
  transportInput: ('ssh' | 'telnet' | 'all' | 'none')[];
  loggingSynchronous?: boolean;
  historySize?: number;
  exec?: boolean;
  autocommand?: string;
  privilegeLevel?: number;
  execTimeout?: { minutes: number; seconds: number };
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

export type { SwitchModel } from './switchModels';
export type SwitchLayer = 'L2' | 'L3' | 'FW' | 'WLC';

export interface StpVlanState {
  vlanId: number;
  bridgeId: string;        // priority + MAC, e.g. "32768.AABB.CC00.0100"
  rootBridgeId: string;
  isRoot: boolean;
  rootCost: number;
  ports: Record<string, {
    role: 'root' | 'designated' | 'alternate' | 'backup' | 'disabled';
    state: 'forwarding' | 'blocking' | 'listening' | 'learning' | 'disabled';
    cost: number;
    proposal?: boolean;
    agreement?: boolean;
  }>;
}

export interface DhcpSnoopingBinding {
  macAddress: string;
  ipAddress: string;
  vlan: number;
  portId: string;
  leaseTime?: number;
  type: 'dynamic' | 'static';
}

/**
 * Advanced BGP neighbor configuration (BGP router-config mode).
 * Extends the basic { ip, as } pair with the full feature set: route policies,
 * peering options, authentication, timers and route-reflector attributes.
 */
export interface BgpNeighbor {
  ip: string;
  as: string;
  state?: string;
  weight?: number;
  routeMapIn?: string;
  routeMapOut?: string;
  nextHopSelf?: boolean;
  ebgpMultihop?: number;
  updateSource?: string;
  timersKeepalive?: number;
  timersHoldtime?: number;
  password?: string;
  description?: string;
  shutdown?: boolean;
  defaultOriginate?: boolean;
  removePrivateAs?: boolean;
  maximumPrefix?: number;
  allowAsIn?: number;
  sendCommunity?: boolean;
  routeReflectorClient?: boolean;
  asOverride?: boolean;
  softReconfiguration?: boolean;
}

export interface SwitchState {
  hostname: string;
  macAddress: string; // Unique base MAC address for the device
  switchModel: SwitchModel; // Switch model (L2 or L3)
  switchLayer: SwitchLayer; // Layer 2 or Layer 3
  deviceType?: 'pc' | 'router' | 'switch' | 'switchL2' | 'switchL3' | 'iot' | 'firewall' | 'wlc'; // Device type for identification
  currentMode: CommandMode;
  currentInterface?: string;
  selectedInterfaces?: string[];  // interface range için çoklu port seçimi
  currentLine?: string;
  currentVlan?: number;
  ports: Record<string, Port>;
  vlans: Record<string, Vlan>;
  security: SecurityConfig;
  runningConfig: string[];
  commandHistory: string[];
  historyIndex: number;
  eventLogs?: string[];
  debugs?: Record<string, boolean>;
  bannerMOTD?: string;
  bannerLogin?: string;
  bannerExec?: string;
  version: {
    nosVersion: string;
    modelName: string;
    serialNumber: string;
    uptime: string;
  };
  macAddressTable: { mac: string; vlan: number; port: string; type: string; timestamp?: number }[];
  arpCache: { ip: string; mac: string; interface: string; timestamp: number }[];
  ndpCache?: { ipv6: string; mac: string; interface: string; state: string; timestamp: number; isRouter?: boolean }[];
  // Password prompt state
  awaitingPassword?: boolean;
  passwordContext?: 'enable' | 'console' | 'vty';
  // "Configuring from terminal, memory, or network" prompt state
  awaitingConfigSource?: boolean;
  consoleAuthenticated?: boolean;
  telnetAuthenticated?: boolean;
  sshSessions?: { user: string; source: string; state: string }[];
  sshLastUser?: string;
  sshLastSource?: string;
  ftpSession?: {
    host: string;
    stage: 'username' | 'password' | 'ready';
    username?: string;
    remoteIp?: string;
    targetDeviceId?: string;
  };
  mailSession?: {
    address: string;
    stage: 'password' | 'ready';
    username: string;
    domain?: string;
    targetDeviceId?: string;
  };
  // Reload confirmation state
  awaitingReloadConfirm?: boolean;
  bootTime: number;
  // New optional properties for extended features
  domainName?: string;
  defaultGateway?: string;
  dnsServer?: string;
  domainLookup?: boolean;
  sshVersion?: 1 | 2;
  rsaKeys?: { modulus: number; name: string };
  cryptoIsakmpPolicies?: Record<number, { encryption: string; hash: string; group: number; lifetime: number }>;
  cryptoIpsecTransformSets?: Record<string, { espEncryption: string; espAuth: string; mode: string }>;
  cryptoMaps?: Record<string, Record<number, { ipsecIsakmp: boolean; matchAddress?: string; setPeer?: string; setTransformSet?: string; setPfs?: string }>>;
  tunnelGroups?: Record<string, { type?: string; generalAttributes?: { authenticationType?: string; authenticationServerGroup?: string }; ipsecAttributes?: { preSharedKey?: string } }>;
  cdpEnabled?: boolean;
  cdpTimer?: number;
  cdpHoldtime?: number;
  lldpEnabled?: boolean;
  lldpTimer?: number;
  lldpHoldtime?: number;
  lldpReinit?: number;
  lldpTlvSelect?: string[];
  lldpMed?: { capabilities?: boolean; networkPolicy?: boolean; location?: boolean; power?: boolean };
  snmpCommunities?: Record<string, 'RO' | 'RW'>;
  snmpContact?: string;
  snmpLocation?: string;
  spanningTreeMode?: 'pvst' | 'rapid-pvst' | 'mst';
  vtpMode?: 'server' | 'client' | 'transparent' | 'off';
  vtpDomain?: string;
  vtpPassword?: string;
  vtpRevision?: number;
  savedConfig?: string;
  mlsQosEnabled?: boolean;
  dhcpSnooping?: { enabled?: boolean; vlans?: number[]; informationOption?: boolean };
  dhcpSnoopingEnabled?: boolean;
  ntpServers?: string[];
  ntpMasterStratum?: number;
  systemClock?: { time: string; day: string; month: string; year: string };
  ipv6Enabled?: boolean;
  ipRouting: boolean;
  spanningTreeVlans?: Record<string, { priority?: string; enabled?: boolean }>;
  startupConfig?: StartupConfig;
  flashFiles?: Record<string, string[]>;
  flashStartupConfigs?: Record<string, StartupConfig>;
  loopguardDefault?: boolean;
  eigrp6Config?: {
    as?: string;
    routerId?: string;
    shutdown?: boolean;
  };
  prefixLists?: Record<string, {
    seq: number;
    action: 'permit' | 'deny';
    prefix: string;
    ge?: number;
    le?: number;
  }[]>;
  ipv6PrefixLists?: Record<string, {
    seq: number;
    action: 'permit' | 'deny';
    prefix: string;
    ge?: number;
    le?: number;
  }[]>;
  currentRouteMap?: string;
  routeMaps?: Record<string, {
    seq: number;
    action: 'permit' | 'deny';
    matchRules: Record<string, unknown>;
    setRules: Record<string, unknown>;
  }[]>;
  netflowConfig?: {
    exportDestination?: string;
    exportPort?: number;
    version?: number;
  };
  netflowCache?: {
    srcIp: string;
    dstIp: string;
    proto: string;
    srcPort: number;
    dstPort: number;
    pkts: number;
    bytes: number;
    active: number;
  }[];
  // New routing fields
  isLayer3Switch?: boolean;        // L3 switch capability
  staticRoutes?: Route[];          // Static routing table
  dynamicRoutes?: Route[];         // Dynamic routing table
  ipv6StaticRoutes?: Route[];      // IPv6 static routing table
  ipv6DynamicRoutes?: Route[];     // IPv6 dynamic routing table
  routingProtocol?: 'none' | 'rip' | 'ospf' | 'ripng' | 'ospfv3' | 'eigrp' | 'bgp'; // Routing protocol
  ripVersion?: 1 | 2;                 // RIP version configured in router mode
  autoSummary?: boolean;           // Auto-summary for routing protocols
  ospfNeighbors?: string[];        // OSPF neighbor IDs/IPs
  eigrpAs?: string;                // EIGRP AS number
  eigrpNeighbors?: string[];       // EIGRP neighbor IDs/IPs
  bgpAs?: string;                  // BGP AS number
  bgpNeighbors?: BgpNeighbor[];   // BGP neighbor configurations
  bgpNeighborState?: Record<string, string>; // BGP neighbor dynamic state mapping (e.g. 'Established', 'Idle')
  bgpNetworks?: { network: string; mask: string }[]; // BGP advertised networks (network <ip> mask <mask>)
  // --- Advanced BGP global settings (router-config mode for BGP) ---
  bgpMaximumPaths?: number;          // maximum-paths <n> multipath
  bgpGracefulRestart?: boolean;      // bgp graceful-restart
  bgpClusterId?: string;             // bgp cluster-id <id> (route-reflector)
  bgpSynchronization?: boolean;      // synchronization (default false on modern IOS)
  bgpAggregateAddresses?: { network: string; mask: string; summaryOnly?: boolean }[]; // aggregate-address <ip> <mask>
  bgpTimers?: { keepalive: number; holdtime: number }; // timers bgp <keepalive> <holdtime>
  passiveInterfaces?: string[];    // Interfaces that should not send updates
  routerId?: string;               // Router identifier (for routing)
  defaultInformation?: string;     // Default route information configuration
  // DHCP pool CLI config (ip dhcp pool <name>)
  currentDhcpPool?: string;
  dhcpPools?: Record<string, {
    network?: string;
    subnetMask?: string;
    defaultRouter?: string;
    dnsServer?: string;
    leaseTime?: string;
    domainName?: string;
  }>;
  currentIpv6DhcpPool?: string;
  ipv6DhcpPools?: Record<string, {
    addressPrefix?: string;
    dnsServer?: string;
    domainName?: string;
  }>;
  dhcpv6Bindings?: Dhcpv6Binding[];
  pppoeSessions?: PppoeSession[];

  // Services (DHCP, DNS, HTTP, FTP, Mail)
  services?: {
    dhcp?: {
      enabled: boolean;
      pools?: {
        poolName: string;
        defaultGateway: string;
        dnsServer: string;
        startIp: string;
        endIp?: string;
        subnetMask: string;
        maxUsers: number;
      }[];
    };
    dns?: {
      enabled: boolean;
      records?: { domain: string; address: string }[];
    };
    ftp?: {
      enabled: boolean;
      username?: string;
      password?: string;
      rootDirectory?: string;
      anonymousAccess?: boolean;
      files?: Array<{
        name: string;
        size: number;
        modifiedAt?: string;
      }>;
    };
    http?: {
      enabled: boolean;
      content?: string;
      fontSize?: number;
      username?: string;
      password?: string;
    };
    mail?: {
      enabled: boolean;
      domain?: string;
      username?: string;
      password?: string;
      inbox?: Array<{ from: string; subject: string; body: string; timestamp?: string }>;
      sent?: Array<{ to: string; subject: string; body: string; timestamp?: string }>;
    };
    ntp?: {
      enabled: boolean;
      server?: string;
      timezone?: string;
      date?: string;
      time?: string;
      timeOffset?: number; // Time offset in milliseconds from real system time
    };
    syslog?: {
      enabled: boolean;
      messages: import('./syslog').SyslogMessage[];
      maxMessages?: number;
    };
  };
  spanningTreePriority?: number;
  firewallRules?: Array<{
    id: string;
    sourceIp: string;
    targetIp: string;
    port: string;
    protocol: 'tcp' | 'udp' | 'icmp' | 'any';
    action: 'allow' | 'deny';
    enabled: boolean;
  }>;
  // Wireless configuration
  wirelessConfig?: Record<string, {
    name: string;
    authentication: 'open' | 'shared' | 'network-eap';
    keyManagement: 'none' | 'wpa';
    wpaVersion: 2 | 3;
    presharedKey: string;
    encryption: 'none' | 'aes-ccm' | 'tkip' | 'aes-tkip';
    guestMode: boolean;
    mbssid?: boolean;
  }>;
  wirelessRadios?: Record<string, {
    id: string;
    frequency: '2.4GHz' | '5GHz';
    channel: number;
    power: string;
    ssid: string;
    encryption: string;
    stationRole: 'root' | 'repeater' | 'client';
    shutdown: boolean;
    macFilter?: {
      enabled: boolean;
      allowList: string[];
      denyList: string[];
    };
  }>;
  wlans?: Record<string, {
    name: string;
    ssid: string;
  }>;
  ip?: string; // Device management/primary IP
  ospfProcessId?: string;
  ospfv3ProcessId?: string;
  ospfRouterId?: string;
  sshTimeout?: number;
  sshAuthenticationRetries?: number;
  dhcpOption82?: boolean;
  dhcpSnoopingVlans?: string[];
  dhcpSnoopingBindings?: DhcpSnoopingBinding[];
  arpInspectionVlans?: string[];
  accessLists?: Record<string, string[]>;
  ipv6AccessLists?: Record<string, string[]>;
  namedAclTypes?: Record<string, 'standard' | 'extended'>;  // Track named ACL types for display
  currentNamedAcl?: string;  // Current named standard ACL being configured
  currentExtendedAcl?: string;  // Current named extended ACL being configured
  currentIpv6Acl?: string;  // Current named IPv6 ACL being configured
  aclMatchCounters?: Record<string, Record<string, number>>;  // ACL name → rule index → match count
  currentSsid?: string;
  currentRadio?: string;
  execAliases?: Record<string, string>;
  // NAT configuration
  natPools?: Record<string, { startIp: string; endIp: string; netmask: string }>;
  natStaticTranslations?: Array<{ localIp: string; globalIp: string }>;
  natDynamicRules?: Array<{ aclId: string; poolName?: string; overload?: boolean; interface?: string }>;
  natTranslations?: Array<{
    protocol: string;
    localIp: string;
    localPort: number;
    globalIp: string;
    globalPort: number;
    remoteIp?: string;
    remotePort?: number;
    type?: 'static' | 'dynamic';
    timeout?: number;
  }>;
  // OSPF areas
  ospfAreas?: number[];
  ospfStubAreas?: string[];
  ospfTotallyStubAreas?: string[];
  ospfNssaAreas?: string[];
  ospfTotallyNssaAreas?: string[];
  isAbr?: boolean;
  // World mode for dot11d
  worldModeDot11d?: string;
  // IoT specific configuration
  iotConfig?: {
    sensorType?: string;
    name?: string;
    wifiSsid?: string;
  };
  // WLC-specific state
  wlcAps?: Record<string, {
    name: string;
    macAddress: string;
    ipAddress?: string;
    status: 'joined' | 'disconnected' | 'downloading';
    model?: string;
    apGroup?: string;
    wlans?: number[];
    rfChannel?: number;
    power?: string;
    dot11?: {
      '5ghz'?: {
        rfChannel?: number;
        powerConstraint?: number;
        channelSwitchMode?: 0 | 1;
      };
    };
    uptime?: string;
  }>;
  wlcWlans?: Record<string, {
    id: number;
    name: string;
    ssid: string;
    status: 'enabled' | 'disabled';
    security: 'open' | 'wep' | 'wpa' | 'wpa2' | 'wpa3';
    password?: string;
    vlan?: number;
    apGroups?: string[];
  }>;
  currentApName?: string;  // Current AP being configured
  // SDM / Reload
  sdmPreferConfigured?: boolean;
  sdmTemplate?: string;
  reloaded?: boolean;
  // Spanning-tree global per-VLAN enabled
  spanningTreeEnabled?: boolean;
  // ARP inspection
  arpInspectionEnabled?: boolean;
  // Spanning-tree portfast default (global)
  spanningTreePortfastDefault?: boolean;
  // STP calculation results
  cryptoIsakmpKeys?: Record<string, string>;
  stpState?: Record<number, StpVlanState>;

  sameSecurityTraffic?: boolean;
  // Firewall ASA-specific state
  firewallObjects?: Record<string, {
    name: string;
    subnet?: { ip: string; mask: string };
    host?: string;
    nat?: string;
  }>;
  currentFirewallObject?: string;
  natRules?: Array<{
    type: 'static' | 'dynamic';
    srcZone: string;
    dstZone: string;
    mappedIp?: string;
    pool?: string;
    target?: string;
  }>;
  firewallTimeouts?: Record<string, string>;
  loggingEnabled?: boolean;
  syslogHost?: string;
  syslogTrapLevel?: string;
  currentSlaId?: string;
  ipSlaOperations?: Record<string, IpSlaOperation>;
  ipSlaTracks?: Record<string, { operationId: string; state: 'up' | 'down'; lastChange: number }>;
  qosClassMaps?: Record<string, { match: 'all' | 'any'; criteria: string[] }>;
  qosPolicyMaps?: Record<string, { classes: Record<string, { priority?: boolean; bandwidthPercent?: number; setDscp?: string; setCos?: number; policeRate?: number; match?: 'all' | 'any' }> }>;
  qosServicePolicies?: Record<string, { direction: 'input' | 'output'; policy: string }>;
  dot1xSystemAuthControl?: boolean;
  dot1xSessions?: Record<string, import('./dot1x').Dot1xSession>;

  // Route redistribution rules
  redistributeRules?: RedistributeRule[];

  // MSTP configuration state
  mstConfig?: MstConfig;

  // SLAAC / Host IPv6 Auto-config
  ipv6UnicastRouting?: boolean;
  ipv6Autoconfig?: boolean;

  // AAA, RADIUS, TACACS+ state
  aaaNewModel?: boolean;
  aaaAuthentication?: string[];
  radiusServers?: Array<{ host: string; key?: string }>;
  tacacsServers?: Array<{ host: string; key?: string }>;
  radiusKey?: string;
  tacacsKey?: string;

  // ── Stateful Protocol State Machine Records ────────────────────────────
  // These replace the legacy flat arrays (ospfNeighbors, eigrpNeighbors)
  // with full RFC-compliant FSM records. Optional so old projects still load.

  /**
   * OSPF neighbor FSM records keyed by neighbor Router-ID.
   * OspfNeighborRecord holds state (Down→Full), dead timers, DD seq, etc.
   */
  ospfNeighborStates?: Record<string, OspfNeighborRecord>;

  /**
   * EIGRP neighbor FSM records keyed by neighbor IP.
   * EigrpNeighborRecord holds hold-timer, K-values, AS number, state.
   */
  eigrpNeighborStates?: Record<string, EigrpNeighborRecord>;

  /**
   * DHCP client FSM records keyed by interface ID (e.g. 'gi0/0').
   * Tracks INIT → SELECTING → REQUESTING → BOUND → RENEWING → REBINDING.
   */
  dhcpClientStates?: Record<string, DhcpClientRecord>;

  /**
   * LACP port FSM records keyed by port ID.
   * Tracks Detached → Waiting → Attached → Collecting → Distributing.
   */
  lacpPortStates?: Record<string, LacpPortRecord>;
}

export interface IpSlaSample { success: boolean; rtt?: number; timestamp: number; }
export interface IpSlaOperation {
  id: string; target: string; type: 'icmp-echo' | 'jitter'; frequency: number;
  timeout: number; sourceInterface?: string; running: boolean;
  startTime?: string; life?: string;
  statistics: { attempts: number; successes: number; failures: number; min?: number; avg?: number; max?: number; jitter?: number; last?: number; samples: IpSlaSample[] };
  lastRunAt?: number;
}


export interface RedistributeRule {
  targetProtocol: string; // 'ospf' | 'rip' | 'eigrp' | 'bgp'
  sourceProtocol: 'ospf' | 'rip' | 'eigrp' | 'bgp' | 'static' | 'connected';
  processId?: string;
  metric?: number;
  subnets?: boolean;
}

export interface MstConfig {
  name?: string;
  revision?: number;
  instances?: Record<number, number[]>; // instanceId -> vlanIds
  instancePriorities?: Record<number, number>; // instanceId -> priority
  pendingInstances?: Record<number, number[]>;
  pendingName?: string;
  pendingRevision?: number;
}

export interface StartupConfig {
  hostname: string;
  version?: string;
  ports: Record<string, Port>;
  vlans: Record<string, Vlan>;
  security: SecurityConfig;
  spanningTree?: {
    mode: string;
  };
  bannerMOTD?: string;
  bannerLogin?: string;
  bannerExec?: string;
  domainName?: string;
  defaultGateway?: string;
  dnsServer?: string;
  sshVersion?: 1 | 2;
  cdpEnabled?: boolean;
  lldpEnabled?: boolean;
  spanningTreeMode?: 'pvst' | 'rapid-pvst' | 'mst';
  vtpMode?: 'server' | 'client' | 'transparent' | 'off';
  vtpDomain?: string;
  vtpPassword?: string;
  vtpRevision?: number;
  mlsQosEnabled?: boolean;
  dhcpSnoopingEnabled?: boolean;
  dhcpSnoopingBindings?: DhcpSnoopingBinding[];
  ntpServers?: string[];
  ntpTimeOffset?: number;
  ipv6Enabled?: boolean;
  ipRouting: boolean;
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  realismLevel?: 'real' | 'stub' | 'sim-only';
  hint?: string | { tr: string; en: string };
  newState?: Partial<SwitchState>;
  deviceStates?: Map<string, SwitchState>; // Cross-device state updates (e.g., port security violations)
  updatedDeviceStates?: Map<string, SwitchState>; // Cross-device state updates (e.g., STP recalculation)
  modeChange?: CommandMode;
  requiresPassword?: boolean;        // Şifre gerekiyor mu?
  passwordPrompt?: string;           // Şifre istemi metni
  passwordContext?: 'enable' | 'console' | 'vty';        // Şifre bağlamı
  requiresConfirmation?: boolean;    // Onay gerekiyor mu?
  confirmationMessage?: string;      // Onay mesajı
  confirmationAction?: string;       // Onay sonrası yapılacak işlem
  requiresReloadConfirm?: boolean;   // Reload sonrası Enter ile onay gerekiyor mu?
  telnetTarget?: { host: string; port: string };  // Telnet bağlantı hedefi
  reloadDevice?: boolean;            // Cihazı sıfırla
  saveConfig?: boolean;  // running-config'i startup-config'e kaydet
  saveFlashConfig?: boolean;  // running-config'i flash'a kaydet
  flashFilename?: string;  // flash dosya adı (örn: running-config)
  restoreFlashConfig?: boolean;  // flash'tan startup-config'e geri yükle
  flashSourceFilename?: string;  // kaynak flash dosya adı
  eraseConfig?: boolean;  // startup-config'i sil
  deleteVlanDat?: boolean;  // vlan.dat dosyasını sil
  triggerPingAnimation?: string;  // Animatör başlatmak için hedef cihaz ID'si
  exitSession?: boolean;  // Oturum sonlandırma bayrağı
  requiresTelnetPassword?: boolean;  // Telnet için şifre gerekiyor mu?
  requiresSshPassword?: boolean;  // SSH için şifre gerekiyor mu?
  sshTarget?: { host: string; username?: string; port: number };  // SSH bağlantı hedefi
  sourceDeviceId?: string;             // Telnet bağlantı hedef IP
}

export interface ParsedCommand {
  command: string;
  args: string[];
  rawInput: string;
  resolvedInput?: string;  // Alias-resolved input for executor
  intent?: {
    family: 'show' | 'interface' | 'routing' | 'system' | 'security' | 'other';
    action: string;
  };
}

type ValidationReason = 'ok' | 'ambiguous' | 'incomplete' | 'invalid-mode' | 'unknown-command';

export interface CommandValidationResult {
  valid: boolean;
  reason: ValidationReason;
  error?: string;
  matchedPattern?: string;
}

// Kablo Tipleri
import type { DeviceType } from '@/components/network/networkTopology.types';

export type CableType = 'straight' | 'crossover' | 'console' | 'wireless' | 'serial' | 'fiber';

export interface CableInfo {
  connected: boolean;
  cableType: CableType;
  sourceDevice: DeviceType;
  targetDevice: DeviceType;
  sourcePort?: string;  // Port ID (e.g., 'eth0', 'com1', 'console', 'fa0/1')
  targetPort?: string;  // Port ID
}


// Kablo uyumluluk kuralları
export const CABLE_COMPATIBILITY: Record<string, CableType[]> = {
  'pc-switch': ['straight', 'crossover'],
  'iot-switch': ['straight', 'crossover'],
  'switch-iot': ['straight', 'crossover'],
  'switch-pc': ['straight', 'crossover'],
  'pc-router': ['straight', 'crossover'],
  'iot-router': ['straight', 'crossover'],
  'router-iot': ['straight', 'crossover'],
  'router-pc': ['straight', 'crossover'],
  'switch-router': ['straight', 'crossover'],
  'router-switch': ['straight', 'crossover'],
  'router-router': ['straight', 'crossover', 'serial'],
  'pc-pc': ['crossover'],
  'pc-iot': ['crossover'],
  'iot-pc': ['crossover'],
  'iot-iot': ['crossover'],
  'switch-switch': ['straight', 'crossover'],
  'pc-console': ['console'],
  'console-pc': ['console'],
  'firewall-switch': ['straight', 'crossover'],
  'switch-firewall': ['straight', 'crossover'],
  'firewall-router': ['straight', 'crossover'],
  'router-firewall': ['straight', 'crossover'],
  'firewall-pc': ['straight', 'crossover'],
  'pc-firewall': ['straight', 'crossover'],
  'firewall-firewall': ['crossover'],
  'router-serial': ['serial'],
  'serial-router': ['serial'],
  'wlc-switch': ['straight', 'crossover'],
  'switch-wlc': ['straight', 'crossover'],
  'wlc-router': ['straight', 'crossover'],
  'router-wlc': ['straight', 'crossover'],
  'wlc-pc': ['straight', 'crossover'],
  'pc-wlc': ['straight', 'crossover'],
};

// Console portu olup olmadığını kontrol et
function isConsolePort(portId: string | undefined): boolean {
  if (!portId) return false;
  const port = portId.toLowerCase();
  return port === 'console' || port === 'com1' || port === 'com';
}


export function isCableCompatible(cable: CableInfo): boolean {
  if (!cable.connected) return false;

  const sourceIsWireless = cable.sourcePort?.toLowerCase() === 'wlan0';
  const targetIsWireless = cable.targetPort?.toLowerCase() === 'wlan0';

  // Wireless links must terminate on WLAN ports at both ends.
  if (cable.cableType === 'wireless') return sourceIsWireless && targetIsWireless;

  // Physical cables cannot be plugged into a WLAN port.
  if (sourceIsWireless || targetIsWireless) return false;

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
  const normalize = (t: CableInfo['sourceDevice']): 'pc' | 'switch' | 'router' | 'firewall' | 'wlc' =>
    t === 'switchL2' || t === 'switchL3' || t === 'hub'
      ? 'switch'
      : t === 'iot' || t === 'mobile' || t === 'printer' || t === 'cloud'
        ? 'pc'
        : (t as 'pc' | 'switch' | 'router' | 'firewall' | 'wlc');

  const connection = `${normalize(cable.sourceDevice)}-${normalize(cable.targetDevice)}`;
  const allowedTypes = CABLE_COMPATIBILITY[connection];
  return allowedTypes ? allowedTypes.includes(cable.cableType) : false;
}

// Port LED renkleri
export type PortLEDColor = 'green' | 'gray' | 'orange' | 'off' | 'white' | 'red';

// Route interface for routing functionality
export interface Route {
  destination: string;      // e.g., "192.168.2.0" or "2001:db8:1::"
  network?: string;         // Alias for destination
  mask?: string;            // Alias for subnetMask
  subnetMask?: string;      // e.g., "255.255.255.0" (for IPv4)
  prefixLength?: number;     // e.g., 64 (for IPv6)
  nextHop: string;          // e.g., "192.168.1.1" or "2001:db8:1::1" or interface name
  interface?: string;       // Exit interface name
  metric?: number;          // Administrative distance/metric
  type: 'connected' | 'static' | 'dynamic'; // Route type
  area?: number;            // For OSPF
  ospfRouteType?: 'E1' | 'E2' | 'N1' | 'N2';
  code?: string;
  administrativeDistance?: number;
  asPath?: string;          // For BGP — AS path attribute
  localPreference?: number; // For BGP — local preference attribute
  weight?: number;          // For BGP — weight attribute
}

