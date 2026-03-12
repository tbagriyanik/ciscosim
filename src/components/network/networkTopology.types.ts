import { CableInfo, CableType, SwitchState } from '@/lib/network/types';

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
}

export interface CanvasDevice {
  id: string;
  type: 'pc' | 'switch' | 'router';
  name: string;
  macAddress?: string;
  ip: string;
  subnet?: string;
  gateway?: string;
  dns?: string;
  x: number;
  y: number;
  status: 'online' | 'offline' | 'error';
  ports: { id: string; label: string; status: 'connected' | 'disconnected' | 'notconnect' | 'blocked' | 'disabled'; shutdown?: boolean }[];
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
  fontSize: 10 | 12 | 16;
  opacity: 0.5 | 0.75 | 1;
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
