import type { CableInfo, SwitchState, PortMode, PortStatus, WifiConfig, WifiMode, CableType } from '@/lib/network/types';
import type { Dispatch, SetStateAction } from 'react';

// Canvas-specific WiFi config that allows partial compatibility with legacy code
export type CanvasWifiConfig = Partial<WifiConfig> & {
  ssid: string;
  mode: WifiMode;
};

export type DeviceType = 'pc' | 'iot' | 'switchL2' | 'switchL3' | 'router' | 'firewall' | 'wlc' | 'hub' | 'cloud' | 'mobile' | 'printer';
export type PortType = 'ethernet' | 'fastEthernet' | 'gigabitEthernet' | 'tenGigabitEthernet' | 'serial' | 'wireless' | 'console' | string;

export type CanvasPortMode = PortMode;
export type CanvasPortStatus = PortStatus;

export interface CanvasPort {
  id: string;
  label: string;
  status: CanvasPortStatus;
  type?: PortType;
  adminStatus?: 'up' | 'down';
  operStatus?: 'up' | 'down';
  linkStatus?: 'up' | 'down' | 'blocked' | 'err-disabled' | 'disconnected';
  shutdown?: boolean;
  vlan?: number;
  accessVlan?: number | string;
  allowedVlans?: number[] | 'all' | string;
  nativeVlan?: number;
  mode?: CanvasPortMode;
  name?: string;
  description?: string;
  speed?: '10' | '100' | '1000' | '10000' | 'auto';
  duplex?: 'half' | 'full' | 'auto';
  ipAddress?: string;
  subnetMask?: string;
  macAddress?: string; // Per-port MAC address (for router ports)
  wifi?: CanvasWifiConfig;
  spanningTree?: {
    role?: 'root' | 'designated' | 'alternate' | 'backup' | 'disabled';
    state?: 'forwarding' | 'blocking' | 'listening' | 'learning' | 'disabled';
    portfast?: boolean;
    bpduguard?: boolean;
  };
  portSecurity?: {
    enabled: boolean;
    maxAddresses?: number;
    violationAction?: 'shutdown' | 'protect' | 'restrict';
    sticky?: boolean;
    violations?: number;
  };
  staticMacs?: string[];
}

export interface NetworkTopologyProps {
  cableInfo: CableInfo;
  onCableChange: (cableInfo: CableInfo) => void;
  selectedDevice: DeviceType | null;
  onDeviceSelect: (device: DeviceType, deviceId?: string, switchModel?: string, deviceName?: string, isNew?: boolean, deviceData?: CanvasDevice) => void;
  onDeviceDoubleClick?: (device: DeviceType, deviceId: string) => void;
  onTopologyChange?: (devices: CanvasDevice[], connections: CanvasConnection[], notes: CanvasNote[]) => void;
  onDeviceDelete?: (deviceId: string) => void;
  initialDevices?: CanvasDevice[];
  initialConnections?: CanvasConnection[];
  initialNotes?: CanvasNote[];
  isActive?: boolean;
  activeDeviceId?: string | null;
  deviceStates?: Map<string, SwitchState>;
  onDeviceStatesChange?: Dispatch<SetStateAction<Map<string, SwitchState>>>;
  isFullscreen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  pan?: { x: number; y: number };
  onPanChange?: (pan: { x: number; y: number }) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onDeviceRename?: (deviceId: string, newName: string) => void;
  onRefreshNetwork?: () => void;
  focusDeviceId?: string | null;
  onOpenTasks?: (deviceId: string) => void;
  clearSelectionTrigger?: number;
  onPacketPanelFocus?: () => void;
  packetPanelZIndex?: number;
  isExamActive?: boolean;
  isExamEditorOpen?: boolean;
  onPingPanelOpenChange?: (open: boolean) => void;
  onAction?: (desc: string) => void;
}

export interface FirewallRule {
  id: string;
  sourceIp: string;
  targetIp: string;
  port: string;
  protocol: 'tcp' | 'udp' | 'icmp' | 'any';
  action: 'allow' | 'deny';
  enabled: boolean;
}

export interface CanvasDevice {
  id: string;
  type: DeviceType;
  name: string;
  macAddress?: string;
  ipConfigMode?: 'static' | 'dhcp';
  ip: string;
  subnet?: string;
  ipv6?: string;
  ipv6Prefix?: string;
  gateway?: string;
  dns?: string;
  services?: {
    dns?: {
      enabled: boolean;
      records: Array<{ domain: string; address: string }>;
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
      mode?: 'simple' | 'iot';
      username?: string;
      password?: string;
      content: string;
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
    };
    dhcp?: {
      enabled: boolean;
      pools: Array<{
        poolName: string;
        defaultGateway: string;
        dnsServer: string;
        startIp: string;
        endIp?: string;
        subnetMask: string;
        maxUsers: number;
      }>;
    };
    syslog?: {
      enabled: boolean;
      messages: import('../../lib/network/syslog').SyslogMessage[];
      maxMessages?: number;
    };
  };
  vlan?: number;
  x: number;
  y: number;
  status: 'online' | 'offline' | 'error';
  switchModel?: string; // WS-C2960-24TT-L (L2) veya WS-C3650-24PS (L3)
  ports: CanvasPort[];
  wifi?: CanvasWifiConfig;
  iot?: {
    sensorType: 'temperature' | 'sound' | 'motion' | 'humidity' | 'light';
    kind?: 'cooler' | 'lamp' | 'heater' | 'sensor';
    dataFlowDirection?: 'input' | 'output' | 'input/output'; // input=sensors (read-only), output=actuators (controllable)
    collaborationEnabled?: boolean;
    dataStore?: string;
    rules?: Array<{
      id: string;
      condition: string; // e.g., "temperature > 25"
      action: string;    // e.g., "ON"
      enabled: boolean;
    }>;
    value?: number | boolean; // Current value/state of the device
    history?: number[]; // History of values for the sensor
  };
  printJobs?: Array<{
    id: string;
    documentTitle: string;
    senderName: string;
    pages: number;
    timestamp: string;
    status: 'printing' | 'completed' | 'queued';
  }>;
  activeVoipCall?: {
    callerId: string;
    callerName: string;
    callerIp?: string;
    status: 'ringing' | 'connected';
  };
  voipHistory?: Array<{
    id: string;
    peerName: string;
    peerIp?: string;
    type: 'incoming' | 'outgoing';
    status: 'answered' | 'missed' | 'rejected';
    durationSeconds: number;
    timestamp: string;
  }>;
  firewallRules?: FirewallRule[];
}

export interface CanvasConnection {
  id: string;
  sourceDeviceId: string;
  sourcePort: string;
  targetDeviceId: string;
  targetPort: string;
  cableType: CableType;
  active: boolean;
  ssidIndex?: number;
  ssid?: string;
}

export interface CanvasNote {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  font: string;
  fontSize: 10 | 12 | 16 | 20;
  opacity: 0.25 | 0.5 | 0.75 | 1;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface SelectedPortRef {
  deviceId: string;
  portId: string;
}

export type ContextMenuMode = 'device' | 'note-style' | 'note-edit' | 'canvas';

export interface ContextMenuState {
  x: number;
  y: number;
  deviceId: string | null;
  noteId: string | null;
  mode: ContextMenuMode;
}
