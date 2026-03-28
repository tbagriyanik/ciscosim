import { CableInfo, CableType, SwitchState } from '@/lib/network/types';

export type DeviceType = 'pc' | 'switch' | 'router';
export type CanvasPortMode = 'access' | 'trunk' | 'routed';
export type CanvasPortStatus = 'connected' | 'disconnected' | 'notconnect' | 'blocked' | 'disabled';

export interface CanvasPort {
  id: string;
  label: string;
  status: CanvasPortStatus;
  shutdown?: boolean;
  vlan?: number;
  accessVlan?: number | string;
  mode?: CanvasPortMode;
  name?: string;
  speed?: '10' | '100' | '1000' | 'auto';
  duplex?: 'half' | 'full' | 'auto';
  ipAddress?: string;
  subnetMask?: string;
  wifi?: {
    ssid: string;
    security: 'open' | 'wpa' | 'wpa2' | 'wpa3';
    channel: '2.4GHz' | '5GHz';
  };
}

export interface NetworkTopologyProps {
  cableInfo: CableInfo;
  onCableChange: (cableInfo: CableInfo) => void;
  selectedDevice: 'pc' | 'switch' | 'router' | null;
  onDeviceSelect: (device: 'pc' | 'switch' | 'router', deviceId?: string) => void;
  onDeviceDoubleClick?: (device: 'pc' | 'switch' | 'router', deviceId: string) => void;
  onTopologyChange?: (devices: CanvasDevice[], connections: CanvasConnection[], notes: CanvasNote[]) => void;
  onDeviceDelete?: (deviceId: string) => void;
  initialDevices?: CanvasDevice[];
  initialConnections?: CanvasConnection[];
  initialNotes?: CanvasNote[];
  isActive?: boolean;
  activeDeviceId?: string | null;
  deviceStates?: Map<string, SwitchState>;
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
    http?: {
      enabled: boolean;
      content: string;
    };
    dhcp?: {
      enabled: boolean;
      pools: Array<{
        poolName: string;
        defaultGateway: string;
        dnsServer: string;
        startIp: string;
        subnetMask: string;
        maxUsers: number;
      }>;
    };
  };
  vlan?: number;
  x: number;
  y: number;
  status: 'online' | 'offline' | 'error';
  ports: CanvasPort[];
  wifi?: {
    enabled: boolean;
    ssid: string;
    security: 'open' | 'wpa' | 'wpa2' | 'wpa3';
    password?: string;
    channel: '2.4GHz' | '5GHz';
    mode: 'ap' | 'client';
  };
}

export interface CanvasConnection {
  id: string;
  sourceDeviceId: string;
  sourcePort: string;
  targetDeviceId: string;
  targetPort: string;
  cableType: CableType;
  active: boolean;
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
