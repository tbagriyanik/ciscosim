'use client';

import { useState, useRef, useEffect, useCallback, useMemo, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import useAppStore, { useTopologyDevices, useTopologyConnections, useTopologyNotes } from '@/lib/store/appStore';
import { SwitchState, CableType, CableInfo, isCableCompatible } from '@/lib/network/types';
import { checkDeviceConnectivity, getPingDiagnostics } from '@/lib/network/connectivity';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSpatialPartitioning } from '@/lib/performance/spatial';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CanvasDevice, CanvasConnection, CanvasNote } from './networkTopology.types';
import { DeviceIcon } from './DeviceIcon';
import { ConnectionLine } from './ConnectionLine';
import { DeviceNode } from './DeviceNode';
import LazyNetworkTopologyContextMenu from './LazyNetworkTopologyContextMenu';
import { LazyNetworkTopologyPortSelectorModal } from './LazyNetworkTopologyPortSelectorModal';
import { Plus, Power, Trash2 } from "lucide-react";

interface NetworkTopologyProps {
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
  onDeviceRename?: (deviceId: string, newName: string) => void;
  onRefreshNetwork?: () => void;
}

// Drag item from palette
interface DragItem {
  type: 'pc' | 'switch' | 'router';
  icon: React.ReactNode;
}

const DEVICE_ICONS = {
  pc: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z" />
    </svg>
  ),
  switch: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 0 1 -2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2M5 12a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 -2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
  router: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="#a855f7" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14M5 12h14M12 5l-2 2m2-2l2 2m-2 12l-2-2m2 2l2-2M5 12l2-2m-2 2l2 2M19 12l-2-2m2 2l-2 2" />
    </svg>
  ),
};

const CABLE_COLORS = {
  straight: { primary: '#3b82f6', bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30' },
  crossover: { primary: '#f97316', bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30' },
  console: { primary: '#06b6d4', bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  wireless: { primary: '#a855f7', bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/30' },
  error: { primary: '#ec4899', bg: 'bg-pink-500', text: 'text-pink-400', border: 'border-pink-500/30' }, // For incompatible cables
};

// Distance threshold for distinguishing drag from click (in pixels)
const DRAG_THRESHOLD = 5;
const LONG_PRESS_DURATION = 500; // ms

// Virtual canvas dimensions (strictly enforced) - significantly increased for mobile panning
const VIRTUAL_CANVAS_WIDTH_MOBILE = 3000;
const VIRTUAL_CANVAS_HEIGHT_MOBILE = 2000;
const VIRTUAL_CANVAS_WIDTH_DESKTOP = 3000;
const VIRTUAL_CANVAS_HEIGHT_DESKTOP = 2000;

// Zoom limits
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4.0;
const DEFAULT_ZOOM = 1.0; // 100% default zoom
const NOTE_COLORS = ['#fef3c7', '#dbeafe', '#dcfce7', '#fee2e2', '#f5d0fe', '#e2e8f0'] as const;
const NOTE_FONTS = ['Arial', 'Verdana', 'Trebuchet MS', 'Courier New', 'Roboto'] as const;
const NOTE_FONT_SIZES: Array<CanvasNote['fontSize']> = [10, 12, 16, 20];
const NOTE_OPACITY_OPTIONS: Array<CanvasNote['opacity']> = [0.25, 0.5, 0.75, 1];

export function NetworkTopology({
  cableInfo,
  onCableChange,
  selectedDevice,
  onDeviceSelect,
  onDeviceDoubleClick,
  onTopologyChange,
  onDeviceDelete,
  initialDevices,
  initialConnections,
  initialNotes,
  isActive = true,
  activeDeviceId,
  deviceStates,
  onDeviceRename,
  onRefreshNetwork,
}: NetworkTopologyProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Helper function to generate all switch ports
  const generateSwitchPorts = () => {
    const ports = [{ id: 'console', label: 'Console', status: 'disconnected' as const }];
    // 24 FastEthernet ports
    for (let i = 1; i <= 24; i++) {
      ports.push({ id: `fa0/${i}`, label: `Fa0/${i}`, status: 'disconnected' as const });
    }
    // 2 GigabitEthernet ports
    ports.push({ id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const });
    ports.push({ id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const });
    ports.push({ id: 'wlan0', label: 'WLAN0', status: 'disconnected' as const });
    return ports;
  };

  // Helper function to generate all router ports - 4 GIGABIT PORTS
  const generateRouterPorts = () => {
    return [
      { id: 'console', label: 'Console', status: 'disconnected' as const },
      { id: 'gi0/0', label: 'Gi0/0', status: 'disconnected' as const },
      { id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const },
      { id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const },
      { id: 'gi0/3', label: 'Gi0/3', status: 'disconnected' as const },
      { id: 'wlan0', label: 'WLAN0', status: 'disconnected' as const },
    ];
  };

  // Helper to generate a random unique Dot-formatted MAC address (xxxx.xxxx.xxxx)
  const generateMacAddress = (): string => {
    const chars = '0123456789abcdef';
    let mac = '';
    for (let i = 0; i < 12; i++) {
      mac += chars[Math.floor(Math.random() * 16)];
      if (i === 3 || i === 7) mac += '.';
    }
    return mac;
  };

  // Default devices for initial state
  const defaultDevices: CanvasDevice[] = [
    {
      id: 'pc-1',
      type: 'pc',
      name: 'PC-1',
      macAddress: generateMacAddress(),
      ip: '192.168.1.10',
      x: 100,
      y: 150,
      status: 'online',
      ports: [
        { id: 'eth0', label: 'Eth0', status: 'disconnected' },
        { id: 'com1', label: 'COM1', status: 'disconnected' },
        { id: 'wlan0', label: 'WLAN0', status: 'disconnected' },
      ],
    },
    {
      id: 'switch-1',
      type: 'switch',
      name: 'Switch-1',
      macAddress: generateMacAddress(),
      ip: '',
      x: 300,
      y: 150,
      status: 'online',
      ports: generateSwitchPorts(),
    },
  ];

  // Zustand store state - using granular selectors to prevent cascading re-renders
  const topologyDevices = useTopologyDevices();
  const topologyConnections = useTopologyConnections();
  const topologyNotes = useTopologyNotes();
  const { setDevices, setConnections, setNotes } = useAppStore();

  const devices = topologyDevices;
  const connections = topologyConnections;
  const notes = topologyNotes;

  // Sync state functions for local component logic
  const setDevicesState = setDevices;
  const setConnectionsState = setConnections;
  const setNotesState = setNotes;

  // Force re-render when deviceStates changes (for WiFi icon updates)
  const [, setDeviceStatesVersion] = useState(0);
  useEffect(() => {
    setDeviceStatesVersion(prev => prev + 1);
  }, [deviceStates]);

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(activeDeviceId ? [activeDeviceId] : []);
  const [snapToGrid, setSnapToGrid] = useState(true); // Snap-to-grid toggle
  const canvasRef = useRef<HTMLDivElement>(null);

  // Use spatial partitioning for efficient visibility culling
  const { visibleDeviceIds, visibleConnectionIds, updateViewport } = useSpatialPartitioning(
    devices,
    connections,
    { cellSize: 256, margin: 100, enabled: devices.length > 100 }
  );

  const { visibleDevices, visibleConnections } = useMemo(() => {
    // If not active, or no canvas, return all items to prevent them from disappearing
    // when calculating visibility while the container has 0 width/height.
    if (!isActive || !canvasRef.current) return { visibleDevices: devices, visibleConnections: connections };

    const { width, height } = canvasRef.current.getBoundingClientRect();

    // If container has 0 width or height (e.g. hidden by CSS), don't filter out things
    if (width === 0 || height === 0 || !zoom || zoom <= 0) {
      return { visibleDevices: devices, visibleConnections: connections };
    }

    // Use spatial partitioning if enabled (for large topologies)
    if (devices.length > 100) {
      // Update viewport for spatial partitioning
      updateViewport({
        x: pan.x,
        y: pan.y,
        width,
        height,
        zoom,
      });

      // Filter devices and connections using spatial partitioning results
      const vDevices = devices.filter(d => visibleDeviceIds.includes(d.id));
      const vConnections = connections.filter(c => visibleConnectionIds.includes(c.id));

      return { visibleDevices: vDevices, visibleConnections: vConnections };
    }

    // Fallback to simple viewport culling for small topologies
    const margin = 100; // Extra margin to prevent pop-in

    const vDevices = devices.filter(device => {
      const x = device.x * zoom + pan.x;
      const y = device.y * zoom + pan.y;
      const deviceWidth = (device.type === 'pc' ? 90 : 130) * zoom;
      const deviceHeight = 100 * zoom;

      return (
        x + deviceWidth + margin > 0 &&
        x - margin < width &&
        y + deviceHeight + margin > 0 &&
        y - margin < height
      );
    });

    const vConnections = connections.filter(conn => {
      const source = devices.find(d => d.id === conn.sourceDeviceId);
      const target = devices.find(d => d.id === conn.targetDeviceId);
      if (!source || !target) return false;

      // Check if either end is visible
      const sourceVisible = vDevices.some(d => d.id === source.id);
      const targetVisible = vDevices.some(d => d.id === target.id);
      if (sourceVisible || targetVisible) return true;

      const minX = Math.min(source.x, target.x) * zoom + pan.x;
      const maxX = Math.max(source.x, target.x) * zoom + pan.x;
      const minY = Math.min(source.y, target.y) * zoom + pan.y;
      const maxY = Math.max(source.y, target.y) * zoom + pan.y;

      return (
        maxX + margin > 0 &&
        minX - margin < width &&
        maxY + margin > 0 &&
        minY - margin < height
      );
    });

    return { visibleDevices: vDevices, visibleConnections: vConnections };
  }, [devices, connections, pan, zoom, isActive, visibleDeviceIds, visibleConnectionIds, updateViewport]);

  const devicesSortedForRender = useMemo(() => {
    return [...visibleDevices].sort((a, b) => {
      if (a.id === activeDeviceId) return 1;
      if (b.id === activeDeviceId) return -1;
      if (selectedDeviceIds.includes(a.id) && !selectedDeviceIds.includes(b.id)) return 1;
      if (!selectedDeviceIds.includes(a.id) && selectedDeviceIds.includes(b.id)) return -1;
      return 0;
    });
  }, [visibleDevices, activeDeviceId, selectedDeviceIds]);

  // Sync internal selection with prop from parent
  useEffect(() => {
    if (activeDeviceId !== undefined) {
      setSelectedDeviceIds(activeDeviceId ? [activeDeviceId] : []);
    }
  }, [activeDeviceId, isActive]);

  // Select all state
  const [selectAllMode, setSelectAllMode] = useState(false);

  // Drag state with position tracking
  const [draggedDevice, setDraggedDevice] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [dragStartDevicePositions, setDragStartDevicePositions] = useState<{ [key: string]: { x: number, y: number } }>({});
  const [isActuallyDragging, setIsActuallyDragging] = useState(false);

  // Drag performance - use ref for animation frame throttling
  const dragAnimationFrameRef = useRef<number | null>(null);
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const devicePositionRef = useRef<{ [key: string]: { x: number; y: number } }>({});

  // Ref to track if we were dragging (for click handler to check without stale closure)
  const wasDraggingRef = useRef(false);

  // ─── Performance refs: always hold latest values to avoid stale closures ───
  // These allow event handlers registered once (on mount) to always use fresh state
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(DEFAULT_ZOOM);
  const panRef = useRef({ x: 0, y: 0 });
  const draggedDeviceRef = useRef<string | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartDevicePositionsRef = useRef<{ [key: string]: { x: number; y: number } }>({});
  const isActuallyDraggingRef = useRef(false);
  const selectedDeviceIdsRef = useRef<string[]>([]);
  const snapToGridRef = useRef(true);
  const isDrawingConnectionRef = useRef(false);
  const panAnimationFrameRef = useRef<number | null>(null);
  const momentumAnimationFrameRef = useRef<number | null>(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastMouseMoveTimeRef = useRef<number>(0);
  const lastMouseMovePosRef = useRef({ x: 0, y: 0 });

  // ─── Touch performance refs ───
  const isTouchDraggingRef = useRef(false);
  const touchDraggedDeviceRef = useRef<string | null>(null);
  const touchDragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchDragOffsetRef = useRef({ x: 0, y: 0 });

  // Connection drawing state
  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{
    deviceId: string;
    portId: string;
    point: { x: number; y: number };
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });

  type ContextMenuMode = 'device' | 'note-edit' | 'canvas';
  type ContextMenuState = {
    x: number;
    y: number;
    deviceId: string | null;
    noteId: string | null;
    mode: ContextMenuMode;
  };
  // Context menu state - device, note, or empty canvas
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  // Clipboard state for copy/cut/paste
  const [clipboard, setClipboard] = useState<CanvasDevice[]>([]);
  const [notesClipboard, setNotesClipboard] = useState<CanvasNote[]>([]);

  // Undo/Redo history - ref-based, no stale closure
  const historyRef = useRef<{ devices: CanvasDevice[]; connections: CanvasConnection[]; notes: CanvasNote[] }[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyLength, setHistoryLength] = useState(0);

  // Always-fresh refs: updated on every render so event handlers never get stale values
  const latestDevicesRef = useRef<CanvasDevice[]>([]);
  const latestConnectionsRef = useRef<CanvasConnection[]>([]);

  // Save CURRENT state to history (call BEFORE making changes)
  const saveToHistory = useCallback(() => {
    const snapshot = {
      devices: JSON.parse(JSON.stringify(latestDevicesRef.current)),
      connections: JSON.parse(JSON.stringify(latestConnectionsRef.current)),
      notes: JSON.parse(JSON.stringify(latestNotesRef.current)),
    };
    // Truncate redo stack
    const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);
    // Deduplicate: skip if identical to last entry
    const last = truncated[truncated.length - 1];
    if (last &&
      JSON.stringify(last.devices) === JSON.stringify(snapshot.devices) &&
      JSON.stringify(last.connections) === JSON.stringify(snapshot.connections) &&
      JSON.stringify(last.notes) === JSON.stringify(snapshot.notes)) {
      return;
    }
    truncated.push(snapshot);
    if (truncated.length > 100) truncated.shift();
    historyRef.current = truncated;
    historyIndexRef.current = truncated.length - 1;
    setHistoryIndex(historyIndexRef.current);
    setHistoryLength(truncated.length);
  }, []);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const state = historyRef.current[historyIndexRef.current];
      if (state) {
        setDevices(JSON.parse(JSON.stringify(state.devices)));
        setConnections(JSON.parse(JSON.stringify(state.connections)));
        setNotes(JSON.parse(JSON.stringify(state.notes)));
        setHistoryIndex(historyIndexRef.current);
      }
    }
  }, []);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const state = historyRef.current[historyIndexRef.current];
      if (state) {
        setDevices(JSON.parse(JSON.stringify(state.devices)));
        setConnections(JSON.parse(JSON.stringify(state.connections)));
        setNotes(JSON.parse(JSON.stringify(state.notes)));
        setHistoryIndex(historyIndexRef.current);
      }
    }
  }, []);

  // Configuration state (Name, IP, etc.)
  const [configuringDevice, setConfiguringDevice] = useState<string | null>(null);
  const [tempNameValue, setTempNameValue] = useState('');
  const [ipValue, setIpValue] = useState('');
  const [subnetValue, setSubnetValue] = useState('');
  const [gatewayValue, setGatewayValue] = useState('');
  const [dnsValue, setDnsValue] = useState('');
  const configInputRef = useRef<HTMLInputElement>(null);

  // Rename state
  const [renamingDevice, setRenamingDevice] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // UI state
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Touch/Mobile state
  const isMobile = useIsMobile();
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchDraggedDevice, setTouchDraggedDevice] = useState<string | null>(null);
  const [touchDragStartPos, setTouchDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [touchDragOffset, setTouchDragOffset] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [lastTappedDevice, setLastTappedDevice] = useState<string | null>(null);

  // Sync all refs on every render BEFORE they are used in handlers
  latestDevicesRef.current = devices;
  latestConnectionsRef.current = connections;
  isPanningRef.current = isPanning;
  panStartRef.current = panStart;
  zoomRef.current = zoom;
  panRef.current = pan;
  draggedDeviceRef.current = draggedDevice;
  dragStartPosRef.current = dragStartPos;
  dragStartDevicePositionsRef.current = dragStartDevicePositions;
  isActuallyDraggingRef.current = isActuallyDragging;
  selectedDeviceIdsRef.current = selectedDeviceIds;
  snapToGridRef.current = snapToGrid;
  isDrawingConnectionRef.current = isDrawingConnection;

  isTouchDraggingRef.current = isTouchDragging;
  touchDraggedDeviceRef.current = touchDraggedDevice;
  touchDragStartPosRef.current = touchDragStartPos;
  touchDragOffsetRef.current = touchDragOffset;

  // Advanced Canvas Pan/Zoom Touch state
  const [lastTouchCenter, setLastTouchCenter] = useState<{ x: number; y: number } | null>(null);

  // Ping and port selector state
  const [pingSource, setPingSource] = useState<string | null>(null);
  const [showPortSelector, setShowPortSelector] = useState(false);
  const [portSelectorStep, setPortSelectorStep] = useState<'source' | 'target'>('source');
  const [selectedSourcePort, setSelectedSourcePort] = useState<{ deviceId: string; portId: string } | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Ping animation state
  const [pingAnimation, setPingAnimation] = useState<{
    sourceId: string;
    targetId: string;
    path: string[];
    currentHopIndex: number;
    progress: number;
    success: boolean | null;
    frame: number; // Frame counter for smooth animations
    error?: string; // Error message if ping failed
    hopCount: number; // Current hop number
  } | null>(null);
  const [errorToast, setErrorToast] = useState<{ message: string; details?: string } | null>(null);

  // Refs
  const deviceCounterRef = useRef<{ pc: number; switch: number; router: number }>({ pc: 0, switch: 0, router: 0 });
  const pingAnimationRef = useRef<number | null>(null);

  // Start device config (Name and IP)
  const startDeviceConfig = useCallback((deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      setConfiguringDevice(deviceId);
      setTempNameValue(device.name);
      setIpValue(device.ip || '');
      setSubnetValue(device.subnet || '255.255.255.0');

      if (device.gateway) {
        setGatewayValue(device.gateway);
      } else {
        const ipParts = (device.ip || '192.168.1.10').split('.');
        ipParts[3] = '1';
        setGatewayValue(ipParts.join('.'));
      }

      setDnsValue(device.dns || '8.8.8.8');

      setContextMenu(null);
      // Focus input after render
      setTimeout(() => configInputRef.current?.focus(), 0);
    }
  }, [devices]);

  // Cancel device config
  const cancelDeviceConfig = useCallback(() => {
    setConfiguringDevice(null);
    setTempNameValue('');
    setIpValue('');
    setSubnetValue('');
    setGatewayValue('');
    setDnsValue('');
  }, []);

  // Confirm device config
  const confirmDeviceConfig = useCallback(() => {
    if (!configuringDevice) return;

    // Basic IP validation if IP is provided
    if (ipValue.trim()) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(ipValue)) {
        return; // Invalid IP format
      }
    }

    saveToHistory();
    setDevices((prev) =>
      prev.map((d) =>
        d.id === configuringDevice
          ? {
            ...d,
            name: tempNameValue.trim() || d.name,
            ip: ipValue.trim(),
            subnet: subnetValue.trim(),
            gateway: gatewayValue.trim(),
            dns: dnsValue.trim()
          }
          : d
      )
    );
    setConfiguringDevice(null);
    setTempNameValue('');
    setIpValue('');
    setSubnetValue('');
    setGatewayValue('');
  }, [configuringDevice, tempNameValue, ipValue, saveToHistory]);

  // Delete device and its connections
  const deleteDevice = useCallback((deviceId: string) => {
    saveToHistory();
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    setConnections((prev) =>
      prev.filter((c) => c.sourceDeviceId !== deviceId && c.targetDeviceId !== deviceId)
    );
    if (onDeviceDelete) {
      onDeviceDelete(deviceId);
    }
  }, [saveToHistory, onDeviceDelete]);

  // Toggle power for devices (bulk operation)
  const togglePowerDevices = useCallback((deviceIds: string[]) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (deviceIds.includes(d.id)) {
          return {
            ...d,
            status: d.status === 'online' ? 'offline' : 'online'
          };
        }
        return d;
      })
    );
  }, []);

  // Select all devices
  const selectAllDevices = useCallback(() => {
    const allIds = devices.map(d => d.id);
    setSelectedDeviceIds(allIds);
    setSelectAllMode(true);
    setContextMenu(null);
  }, [devices]);

  // Handle alignment for multiple selected devices
  const handleAlign = useCallback((type: 'top' | 'bottom' | 'left' | 'right' | 'h-center' | 'v-center') => {
    if (selectedDeviceIds.length < 2) return;
    saveToHistory();

    setDevices(prev => {
      const selectedDevices = prev.filter(d => selectedDeviceIds.includes(d.id));
      if (selectedDevices.length < 2) return prev;

      let targetValue = 0;
      switch (type) {
        case 'top':
          targetValue = Math.min(...selectedDevices.map(sd => sd.y));
          break;
        case 'bottom':
          targetValue = Math.max(...selectedDevices.map(sd => sd.y));
          break;
        case 'left':
          targetValue = Math.min(...selectedDevices.map(sd => sd.x));
          break;
        case 'right':
          targetValue = Math.max(...selectedDevices.map(sd => sd.x));
          break;
        case 'h-center':
          targetValue = selectedDevices.reduce((sum, sd) => sum + sd.y, 0) / selectedDevices.length;
          break;
        case 'v-center':
          targetValue = selectedDevices.reduce((sum, sd) => sum + sd.x, 0) / selectedDevices.length;
          break;
      }

      return prev.map(d => {
        if (!selectedDeviceIds.includes(d.id)) return d;
        if (type === 'top' || type === 'bottom' || type === 'h-center') {
          return { ...d, y: targetValue };
        }
        if (type === 'left' || type === 'right' || type === 'v-center') {
          return { ...d, x: targetValue };
        }
        return d;
      });
    });
  }, [selectedDeviceIds, saveToHistory]);

  // Get dynamic canvas dimensions based on screen size
  const getCanvasDimensions = useCallback(() => {
    if (typeof window === 'undefined') return { width: VIRTUAL_CANVAS_WIDTH_DESKTOP, height: VIRTUAL_CANVAS_HEIGHT_DESKTOP };
    return isMobile
      ? { width: VIRTUAL_CANVAS_WIDTH_MOBILE, height: VIRTUAL_CANVAS_HEIGHT_MOBILE }
      : { width: VIRTUAL_CANVAS_WIDTH_DESKTOP, height: VIRTUAL_CANVAS_HEIGHT_DESKTOP };
  }, [isMobile]);

  // Calculate distance between two points
  const getDistance = useCallback((x1: number, y1: number, x2: number, y2: number): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Get canvas coordinates from screen coordinates
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);


  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | PointerEvent | TouchEvent) => {
      if (contextMenu) {
        const target = e.target as HTMLElement;
        // Don't close if clicking on context menu itself
        if (!target.closest('.context-menu')) {
          setContextMenu(null);
        }
      }
    };

    window.addEventListener('pointerdown', handleClickOutside as EventListener);
    window.addEventListener('click', handleClickOutside as EventListener);
    return () => {
      window.removeEventListener('pointerdown', handleClickOutside as EventListener);
      window.removeEventListener('click', handleClickOutside as EventListener);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;

    const rect = contextMenuRef.current.getBoundingClientRect();
    const padding = 10;
    const nextX = Math.max(padding, Math.min(contextMenu.x, window.innerWidth - rect.width - padding));
    const nextY = Math.max(padding, Math.min(contextMenu.y, window.innerHeight - rect.height - padding));

    if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
      setContextMenu(prev => prev ? { ...prev, x: nextX, y: nextY } : prev);
    }
  }, [contextMenu?.x, contextMenu?.y, contextMenu?.mode, contextMenu?.noteId, contextMenu?.deviceId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (portTooltipTimerRef.current) clearTimeout(portTooltipTimerRef.current);
    };
  }, []);

  // Handle mobile back button to close modals/popups
  useEffect(() => {
    const isAnyModalOpen = isPaletteOpen || !!configuringDevice || !!pingSource || showPortSelector || !!contextMenu || isFullscreen;

    if (isAnyModalOpen) {
      window.history.pushState({ modalOpen: true }, '');
    }

    const handlePopState = () => {
      if (isPaletteOpen) setIsPaletteOpen(false);
      if (configuringDevice) cancelDeviceConfig();
      if (pingSource) setPingSource(null);
      if (showPortSelector) {
        setShowPortSelector(false);
        setPortSelectorStep('source');
        setSelectedSourcePort(null);
      }
      if (contextMenu) setContextMenu(null);
      if (isFullscreen) setIsFullscreen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isPaletteOpen, configuringDevice, pingSource, showPortSelector, contextMenu, cancelDeviceConfig, isFullscreen]);

  // Allow page-level header buttons (next to the device selector) to control topology UI on mobile.
  useEffect(() => {
    const openPalette = () => setIsPaletteOpen(true);
    const openConnect = () => {
      setShowPortSelector(true);
      setPortSelectorStep('source');
      setSelectedSourcePort(null);
    };

    window.addEventListener('trigger-topology-palette', openPalette as EventListener);
    window.addEventListener('trigger-topology-connect', openConnect as EventListener);
    return () => {
      window.removeEventListener('trigger-topology-palette', openPalette as EventListener);
      window.removeEventListener('trigger-topology-connect', openConnect as EventListener);
    };
  }, []);

  // Handle right-click context menu with viewport clamping
  const openContextMenu = useCallback((clientX: number, clientY: number, deviceId: string | null = null, mode: ContextMenuMode = deviceId ? 'device' : 'canvas', noteId: string | null = null) => {
    // Estimate menu dimensions (approximate)
    const menuWidth = 180;
    const menuHeight = deviceId ? 400 : 200; // Device menu is taller

    // Clamp coordinates to stay within viewport
    let x = clientX;
    let y = clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }

    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    // Ensure it doesn't go off the top/left either
    x = Math.max(10, x);
    y = Math.max(10, y);

    window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source: 'topology' } }));
    setContextMenu({ x, y, deviceId, noteId, mode });
  }, []);

  // Handle canvas pan start
  // Reads pan via ref to avoid re-creating callback on every pan state change
  const handleCanvasMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.button === 2) {
      // Right click on canvas - show context menu
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, null, 'canvas');
    } else if (e.button === 0 && !(e.target as HTMLElement).closest('[data-device-id]')) {
      const currentPan = panRef.current;
      const ps = { x: e.clientX - currentPan.x, y: e.clientY - currentPan.y };
      setPanStart(ps);
      panStartRef.current = ps;
      setIsPanning(true);
      isPanningRef.current = true;
      setContextMenu(null);
      setSelectAllMode(false);
    }
  }, [openContextMenu]);

  // Keep refs in sync with state on every render (no cost - just ref assignment)
  isPanningRef.current = isPanning;
  panStartRef.current = panStart;
  zoomRef.current = zoom;
  panRef.current = pan;
  draggedDeviceRef.current = draggedDevice;
  dragStartPosRef.current = dragStartPos;
  dragStartDevicePositionsRef.current = dragStartDevicePositions;
  isActuallyDraggingRef.current = isActuallyDragging;
  selectedDeviceIdsRef.current = selectedDeviceIds;
  snapToGridRef.current = snapToGrid;
  isDrawingConnectionRef.current = isDrawingConnection;

  // Handle mouse move for panning and dragging
  // Registered ONCE (empty deps) - reads all mutable values through refs to avoid stale closures
  useEffect(() => {
    const CANVAS_W_D = VIRTUAL_CANVAS_WIDTH_DESKTOP;
    const CANVAS_H_D = VIRTUAL_CANVAS_HEIGHT_DESKTOP;
    const CANVAS_W_M = VIRTUAL_CANVAS_WIDTH_MOBILE;
    const CANVAS_H_M = VIRTUAL_CANVAS_HEIGHT_MOBILE;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (isPanningRef.current) {
        // Track velocity for momentum
        const now = Date.now();
        const dt = now - lastMouseMoveTimeRef.current;
        if (dt > 0) {
          const dx = e.clientX - lastMouseMovePosRef.current.x;
          const dy = e.clientY - lastMouseMovePosRef.current.y;
          // Exponential moving average for velocity to smooth out noise
          velocityRef.current = {
            x: velocityRef.current.x * 0.2 + (dx / dt) * 0.8,
            y: velocityRef.current.y * 0.2 + (dy / dt) * 0.8,
          };
        }
        lastMouseMoveTimeRef.current = now;
        lastMouseMovePosRef.current = { x: e.clientX, y: e.clientY };

        // Throttle pan with RAF for smooth rendering
        if (panAnimationFrameRef.current !== null) return;
        const ps = panStartRef.current;
        panAnimationFrameRef.current = requestAnimationFrame(() => {
          setPan({ x: e.clientX - ps.x, y: e.clientY - ps.y });
          panAnimationFrameRef.current = null;
        });
      } else if (draggedDeviceRef.current && canvasRef.current) {
        // Check if we've moved enough to consider it a drag
        const dsp = dragStartPosRef.current;
        if (dsp) {
          const dx2 = e.clientX - dsp.x;
          const dy2 = e.clientY - dsp.y;
          const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (dist > DRAG_THRESHOLD) {
            if (!isActuallyDraggingRef.current) {
              setIsActuallyDragging(true);
              isActuallyDraggingRef.current = true;
            }
            wasDraggingRef.current = true;
          }
        }

        if (isActuallyDraggingRef.current) {
          // Throttle drag with RAF
          if (dragAnimationFrameRef.current !== null) return;

          const clientX = e.clientX;
          const clientY = e.clientY;
          const ctrlKey = e.ctrlKey;

          dragAnimationFrameRef.current = requestAnimationFrame(() => {
            if (!canvasRef.current) { dragAnimationFrameRef.current = null; return; }
            const rect = canvasRef.current.getBoundingClientRect();
            const currentPan = panRef.current;
            const currentZoom = zoomRef.current;
            const currentDragStartPos = dragStartPosRef.current;
            const currentDraggedDevice = draggedDeviceRef.current;
            const currentSnapToGrid = snapToGridRef.current;
            const currentSelectedIds = selectedDeviceIdsRef.current;
            const currentStartPositions = dragStartDevicePositionsRef.current;

            if (!currentDragStartPos || !currentDraggedDevice) {
              dragAnimationFrameRef.current = null;
              return;
            }

            const mouseX = (clientX - rect.left - currentPan.x) / currentZoom;
            const mouseY = (clientY - rect.top - currentPan.y) / currentZoom;
            const startMouseX = (currentDragStartPos.x - rect.left - currentPan.x) / currentZoom;
            const startMouseY = (currentDragStartPos.y - rect.top - currentPan.y) / currentZoom;
            const dx = mouseX - startMouseX;
            const dy = mouseY - startMouseY;

            const canvasW = CANVAS_W_D;
            const canvasH = CANVAS_H_D;

            setDevices(prev => {
              const newDevices = [...prev];
              let changed = false;

              const devicesToMove = currentSelectedIds.includes(currentDraggedDevice)
                ? currentSelectedIds
                : [currentDraggedDevice];

              devicesToMove.forEach(id => {
                const deviceIndex = newDevices.findIndex(d => d.id === id);
                if (deviceIndex === -1) return;

                const initialPos = currentStartPositions[id];
                if (!initialPos) return;

                let newX = initialPos.x + dx;
                let newY = initialPos.y + dy;

                if (currentSnapToGrid && ctrlKey) {
                  newX = Math.round(newX / 20) * 20;
                  newY = Math.round(newY / 20) * 20;
                }

                const clampedX = Math.max(20, Math.min(newX, canvasW - 100));
                const clampedY = Math.max(20, Math.min(newY, canvasH - 100));

                if (Math.abs(newDevices[deviceIndex].x - clampedX) > 0.1 || Math.abs(newDevices[deviceIndex].y - clampedY) > 0.1) {
                  newDevices[deviceIndex] = { ...newDevices[deviceIndex], x: clampedX, y: clampedY };
                  changed = true;
                }
              });

              return changed ? newDevices : prev;
            });

            dragAnimationFrameRef.current = null;
          });
        }
      } else if (isDrawingConnectionRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const currentPan = panRef.current;
        const currentZoom = zoomRef.current;
        const newPos = {
          x: (e.clientX - rect.left - currentPan.x) / currentZoom,
          y: (e.clientY - rect.top - currentPan.y) / currentZoom,
        };
        mousePosRef.current = newPos;
        setMousePos(newPos);
      }
    };

    const handleMouseUp = () => {
      // Cancel any pending animation frames
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }
      if (panAnimationFrameRef.current) {
        cancelAnimationFrame(panAnimationFrameRef.current);
        panAnimationFrameRef.current = null;
      }

      // Start momentum if panning and velocity is high enough
      if (isPanningRef.current) {
        const vx = velocityRef.current.x;
        const vy = velocityRef.current.y;
        const speed = Math.sqrt(vx * vx + vy * vy);

        if (speed > 0.1) {
          let lastTime = Date.now();
          const friction = 0.95; // Deceleration rate

          const animateMomentum = () => {
            const now = Date.now();
            const dt = now - lastTime;
            lastTime = now;

            if (dt > 0) {
              const currentVx = velocityRef.current.x * Math.pow(friction, dt / 16);
              const currentVy = velocityRef.current.y * Math.pow(friction, dt / 16);
              velocityRef.current = { x: currentVx, y: currentVy };

              const currentSpeed = Math.sqrt(currentVx * currentVx + currentVy * currentVy);
              if (currentSpeed > 0.01) {
                setPan(prev => ({
                  x: prev.x + currentVx * dt,
                  y: prev.y + currentVy * dt
                }));
                momentumAnimationFrameRef.current = requestAnimationFrame(animateMomentum);
              } else {
                momentumAnimationFrameRef.current = null;
              }
            } else {
              momentumAnimationFrameRef.current = requestAnimationFrame(animateMomentum);
            }
          };
          momentumAnimationFrameRef.current = requestAnimationFrame(animateMomentum);
        }
      }

      setIsPanning(false);
      isPanningRef.current = false;
      setDraggedDevice(null);
      draggedDeviceRef.current = null;
      setDragStartPos(null);
      dragStartPosRef.current = null;
      setIsActuallyDragging(false);
      isActuallyDraggingRef.current = false;
      setDragStartDevicePositions({});
      lastDragPositionRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (dragAnimationFrameRef.current) cancelAnimationFrame(dragAnimationFrameRef.current);
      if (panAnimationFrameRef.current) cancelAnimationFrame(panAnimationFrameRef.current);
    };
  }, []);
  // Global touch event handlers for device dragging on mobile
  // FIXED: uses refs to avoid re-registering the listener on ogni state change
  useEffect(() => {
    if (!isMobile) return;

    const handleGlobalTouchMove = (e: globalThis.TouchEvent) => {
      const currentTouchDraggedDevice = touchDraggedDeviceRef.current;
      if (e.touches.length !== 1 || !currentTouchDraggedDevice || !canvasRef.current) return;

      const touch = e.touches[0];
      const currentTouchDragStartPos = touchDragStartPosRef.current;

      // Check if we've moved enough to consider it a drag
      if (currentTouchDragStartPos && !isTouchDraggingRef.current) {
        const distance = getDistance(currentTouchDragStartPos.x, currentTouchDragStartPos.y, touch.clientX, touch.clientY);
        if (distance > DRAG_THRESHOLD) {
          setIsTouchDragging(true);
          isTouchDraggingRef.current = true;
        }
      }

      if (isTouchDraggingRef.current) {
        if (e.cancelable) e.preventDefault(); // Prevent page scroll
        const rect = canvasRef.current.getBoundingClientRect();
        const currentPan = panRef.current;
        const currentZoom = zoomRef.current;
        const currentTouchDragOffset = touchDragOffsetRef.current;

        const newX = (touch.clientX - rect.left - currentPan.x - currentTouchDragOffset.x) / currentZoom;
        const newY = (touch.clientY - rect.top - currentPan.y - currentTouchDragOffset.y) / currentZoom;

        // Clamp to canvas bounds
        const canvasDims = getCanvasDimensions();
        const clampedX = Math.max(50, Math.min(newX, canvasDims.width - 120));
        const clampedY = Math.max(50, Math.min(newY, canvasDims.height - 150));

        // Store position in ref for animation frame
        lastDragPositionRef.current = { x: clampedX, y: clampedY };

        // Use requestAnimationFrame for smooth updates
        if (!dragAnimationFrameRef.current) {
          dragAnimationFrameRef.current = requestAnimationFrame(() => {
            if (lastDragPositionRef.current && touchDraggedDeviceRef.current) {
              setDevices((prev) =>
                prev.map((d) =>
                  d.id === touchDraggedDeviceRef.current
                    ? { ...d, x: lastDragPositionRef.current!.x, y: lastDragPositionRef.current!.y }
                    : d
                )
              );
            }
            dragAnimationFrameRef.current = null;
          });
        }
      }
    };

    const handleGlobalTouchEnd = () => {
      // Cancel any pending animation frame
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }

      const currentTouchDraggedDevice = touchDraggedDeviceRef.current;
      const currentIsTouchDragging = isTouchDraggingRef.current;

      // If we weren't dragging, treat it as a tap (select)
      if (currentTouchDraggedDevice && !currentIsTouchDragging) {
        // We use latestDevicesRef to avoid stale devices closure
        const device = latestDevicesRef.current.find(d => d.id === currentTouchDraggedDevice);
        if (device) {
          setSelectedDeviceIds([device.id]);
          onDeviceSelect(device.type, device.id);
        }
      }

      // Save to history if we were dragging (already saved at touch start)
      if (currentIsTouchDragging && currentTouchDraggedDevice) {
        // no-op: saved at touch start
      }

      setTouchDraggedDevice(null);
      touchDraggedDeviceRef.current = null;
      setTouchDragStartPos(null);
      touchDragStartPosRef.current = null;
      setIsTouchDragging(false);
      isTouchDraggingRef.current = false;
      setLastTouchDistance(null);
      setTouchStart(null);
      lastDragPositionRef.current = null;

      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
    };

    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
      }
    };
  }, [isMobile, onDeviceSelect, saveToHistory, getCanvasDimensions]);

  // Handle device drag start
  const handleDeviceMouseDown = useCallback((e: ReactMouseEvent, deviceId: string) => {
    e.stopPropagation();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;

    // Save current state before drag starts (for undo)
    saveToHistory();

    // Reset drag tracking
    wasDraggingRef.current = false;

    // Shift key for multi-selection
    if (e.shiftKey) {
      setSelectedDeviceIds(prev =>
        prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
      );
    } else {
      // If clicking a device that's not selected, make it the only selection
      // If it IS already selected, keep selection for group dragging
      if (!selectedDeviceIds.includes(deviceId)) {
        setSelectedDeviceIds([deviceId]);
        onDeviceSelect(device.type === 'router' ? 'switch' : device.type, deviceId);
      }
    }

    // Store starting positions of all selected devices for group dragging
    // Use the latest selected set
    const currentSelectedIds = e.shiftKey
      ? (selectedDeviceIds.includes(deviceId) ? selectedDeviceIds.filter(id => id !== deviceId) : [...selectedDeviceIds, deviceId])
      : (selectedDeviceIds.includes(deviceId) ? selectedDeviceIds : [deviceId]);

    const initialPositions: { [key: string]: { x: number, y: number } } = {};
    devices.forEach(d => {
      if (currentSelectedIds.includes(d.id)) {
        initialPositions[d.id] = { x: d.x, y: d.y };
      }
    });
    setDragStartDevicePositions(initialPositions);

    // Store the starting position for distance calculation
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setIsActuallyDragging(false);
    setDraggedDevice(deviceId);
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) - device.x * zoom,
      y: (e.clientY - rect.top - pan.y) - device.y * zoom,
    });
  }, [devices, pan, zoom, selectedDeviceIds, onDeviceSelect]);

  // Handle device click (single click - select only)
  const handleDeviceClick = useCallback((e: ReactMouseEvent, device: CanvasDevice) => {
    e.stopPropagation();
    // Don't handle click if we were dragging (check ref to avoid stale closure)
    if (wasDraggingRef.current) return;

    if (!e.shiftKey) {
      setSelectedDeviceIds([device.id]);
      // Notify parent component - select device, don't open terminal
      onDeviceSelect(device.type, device.id);
      // Focus canvas for keyboard navigation
      canvasRef.current?.focus();
    }
  }, [onDeviceSelect]);

  // Handle device double click - open terminal
  const handleDeviceDoubleClick = useCallback((device: CanvasDevice) => {
    // Open terminal for this specific device
    if (onDeviceDoubleClick) {
      onDeviceDoubleClick(device.type, device.id);
    } else {
      // Fallback to old behavior
      if (device.type === 'pc') {
        onDeviceSelect('pc', device.id);
      } else if (device.type === 'switch' || device.type === 'router') {
        onDeviceSelect('switch', device.id);
      }
    }
  }, [onDeviceDoubleClick, onDeviceSelect]);

  // Handle right-click context menu with viewport clamping
  const handleContextMenu = useCallback((e: ReactMouseEvent, deviceId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Estimate menu dimensions (approximate)
    const menuWidth = 180;
    const menuHeight = deviceId ? 400 : 200;

    // Clamp coordinates to stay within viewport
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }

    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    // Ensure it doesn't go off the top/left either
    x = Math.max(10, x);
    y = Math.max(10, y);

    window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source: 'topology' } }));
    openContextMenu(x, y, deviceId || null, deviceId ? 'device' : 'canvas');
  }, [openContextMenu]);

  // Handle device touch start - for mobile dragging
  const handleDeviceTouchStart = useCallback((e: ReactTouchEvent, deviceId: string) => {
    if (e.touches.length !== 1) return; // Only handle single touch for dragging
    e.stopPropagation();

    if (!canvasRef.current) return;

    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;

    // Save current state before touch drag starts (for undo)
    saveToHistory();

    // Cancel any pending long press timer from canvas touch
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    // Store the starting position for distance calculation
    setTouchDragStartPos({ x: touch.clientX, y: touch.clientY });
    setIsTouchDragging(false);
    setTouchDraggedDevice(deviceId);
    setTouchDragOffset({
      x: (touch.clientX - rect.left - pan.x) - device.x * zoom,
      y: (touch.clientY - rect.top - pan.y) - device.y * zoom,
    });
    setSelectedDeviceIds([deviceId]);

    // Check for double tap
    const now = Date.now();
    if (now - lastTapTime < 300 && lastTappedDevice === deviceId) {
      // Double tap detected - open terminal
      handleDeviceDoubleClick(device);
      setLastTapTime(0);
      setLastTappedDevice(null);
    } else {
      setLastTapTime(now);
      setLastTappedDevice(deviceId);
    }
  }, [devices, pan, zoom, longPressTimer, lastTapTime, lastTappedDevice, handleDeviceDoubleClick]);

  // Handle device touch move - for mobile dragging
  const handleDeviceTouchMove = useCallback((e: ReactTouchEvent) => {
    if (e.touches.length !== 1 || !touchDraggedDevice || !canvasRef.current) return;
    e.stopPropagation();
    e.preventDefault(); // Prevent scrolling

    const touch = e.touches[0];

    // Check if we've moved enough to consider it a drag
    if (touchDragStartPos) {
      const distance = getDistance(touchDragStartPos.x, touchDragStartPos.y, touch.clientX, touch.clientY);
      if (distance > DRAG_THRESHOLD) {
        setIsTouchDragging(true);
      }
    }

    if (isTouchDragging) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = (touch.clientX - rect.left - pan.x - touchDragOffset.x) / zoom;
      const newY = (touch.clientY - rect.top - pan.y - touchDragOffset.y) / zoom;

      const canvasDims = getCanvasDimensions();
      setDevices((prev) =>
        prev.map((d) =>
          d.id === touchDraggedDevice
            ? { ...d, x: Math.max(50, Math.min(newX, canvasDims.width - 120)), y: Math.max(50, Math.min(newY, canvasDims.height - 150)) }
            : d
        )
      );
    }
  }, [touchDraggedDevice, touchDragOffset, touchDragStartPos, isTouchDragging, pan, zoom, getDistance]);

  // Handle device touch end - for mobile dragging
  const handleDeviceTouchEnd = useCallback(() => {
    // If we weren't dragging, treat it as a tap (select)
    if (touchDraggedDevice && !isTouchDragging) {
      const device = devices.find(d => d.id === touchDraggedDevice);
      if (device) {
        setSelectedDeviceIds([device.id]);
        onDeviceSelect(device.type, device.id);
      }
    }

    setTouchDraggedDevice(null);
    setTouchDragStartPos(null);
    setIsTouchDragging(false);
  }, [touchDraggedDevice, isTouchDragging, devices, onDeviceSelect]);

  // Canvas-level touch handlers (pan, pinch, long-press for context)
  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    if (!canvasRef.current) return;

    // Check if target is not a device
    const isDevice = (e.target as HTMLElement).closest('[data-device-id]') || false;
    if (isDevice) return; // handled by handleDeviceTouchStart

    // Cancel any existing long-press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      setTouchStart({ x: t.clientX, y: t.clientY });
      setIsPanning(true);
      setPanStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });

      // Start long-press to open context menu
      const timer = setTimeout(() => {
        openContextMenu(t.clientX, t.clientY, null);
        setLongPressTimer(null);
        setIsPanning(false);
      }, LONG_PRESS_DURATION);
      setLongPressTimer(timer);
    } else if (e.touches.length === 2) {
      setIsPanning(false);
      // Pinch start - track initial distance and center
      const a = e.touches[0];
      const b = e.touches[1];
      setLastTouchDistance(getDistance(a.clientX, a.clientY, b.clientX, b.clientY));
      setLastTouchCenter({
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2
      });
    }
  }, [longPressTimer, pan, getDistance]);

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!canvasRef.current) return;
    const isDevice = (e.target as HTMLElement).closest('[data-device-id]') || false;
    if (isDevice) return;

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (e.touches.length === 1 && isPanning) {
      const t = e.touches[0];
      setPan({ x: t.clientX - panStart.x, y: t.clientY - panStart.y });
    } else if (e.touches.length === 2 && lastTouchDistance !== null && lastTouchCenter !== null) {
      const a = e.touches[0];
      const b = e.touches[1];

      const newDistance = getDistance(a.clientX, a.clientY, b.clientX, b.clientY);
      const newCenter = {
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2
      };

      // Calculate zoom factor with smoothing
      const zoomFactor = newDistance / lastTouchDistance;
      let newZoom = zoom * zoomFactor;
      newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));

      if (Math.abs(newZoom - zoom) > 0.01) {
        // Adjust pan to zoom relative to the gesture center
        const rect = canvasRef.current.getBoundingClientRect();
        const cursorX = newCenter.x - rect.left;
        const cursorY = newCenter.y - rect.top;

        const deltaX = cursorX - (cursorX - pan.x) * (newZoom / zoom);
        const deltaY = cursorY - (cursorY - pan.y) * (newZoom / zoom);

        // Also add the pan movement of the center point itself
        const panDeltaX = newCenter.x - lastTouchCenter.x;
        const panDeltaY = newCenter.y - lastTouchCenter.y;

        setZoom(newZoom);
        setPan({ x: deltaX + panDeltaX, y: deltaY + panDeltaY });
      } else {
        // If zoom didn't change (hit limits), at least we can pan
        const panDeltaX = newCenter.x - lastTouchCenter.x;
        const panDeltaY = newCenter.y - lastTouchCenter.y;
        setPan(prev => ({ x: prev.x + panDeltaX, y: prev.y + panDeltaY }));
      }

      setLastTouchDistance(newDistance);
      setLastTouchCenter(newCenter);
    }
  }, [isPanning, panStart, longPressTimer, pan, zoom, lastTouchDistance, lastTouchCenter, getDistance]);

  const handleTouchEnd = useCallback((e: globalThis.TouchEvent | ReactTouchEvent) => {
    // Clear long-press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    // If no more touches, reset pinch/touch tracking
    const touchesLength = (e as ReactTouchEvent).touches ? (e as ReactTouchEvent).touches.length : 0;
    if (touchesLength === 0) {
      setLastTouchDistance(null);
      setLastTouchCenter(null);
      setTouchStart(null);
      setIsPanning(false);
    } else if (touchesLength === 1) {
      // Revert to panning with one finger if the other is lifted
      const t = (e as ReactTouchEvent).touches[0];
      setIsPanning(true);
      setPanStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });
      setLastTouchDistance(null);
      setLastTouchCenter(null);
    }
  }, [longPressTimer, pan]);

  // Handle Wheel Event for Zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const isEditable = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable;
        const noteScrollHost = target.closest('[data-note-scroll]');
        if (isEditable || noteScrollHost) {
          return;
        }
      }

      e.preventDefault(); // prevent window scroll

      const rect = canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const zoomSensitivity = 0.0015;
      const delta = -e.deltaY;

      setZoom(prevZoom => {
        let newZoom = prevZoom * Math.exp(delta * zoomSensitivity);
        newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));

        // Only adjust pan if zoom actually changed
        if (newZoom !== prevZoom) {
          setPan(prevPan => {
            return {
              x: cursorX - (cursorX - prevPan.x) * (newZoom / prevZoom),
              y: cursorY - (cursorY - prevPan.y) * (newZoom / prevZoom)
            };
          });
        }
        return newZoom;
      });
    };

    // passive: false is required to preventDefault on wheel
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // Handle Keyboard Navigation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if canvas is focused
      if (document.activeElement !== canvas) return;

      const moveAmount = 20 * zoom;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setPan(prev => ({ ...prev, y: prev.y + moveAmount }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setPan(prev => ({ ...prev, y: prev.y - moveAmount }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setPan(prev => ({ ...prev, x: prev.x + moveAmount }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setPan(prev => ({ ...prev, x: prev.x - moveAmount }));
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoom(prev => Math.min(prev * 1.2, MAX_ZOOM));
          break;
        case '-':
          e.preventDefault();
          setZoom(prev => Math.max(prev / 1.2, MIN_ZOOM));
          break;
        case '0':
          e.preventDefault();
          setZoom(1);
          setPan({ x: 0, y: 0 });
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedDeviceIds.length === 1) {
            const selectedDevice = devices.find(d => d.id === selectedDeviceIds[0]);
            if (selectedDevice) {
              handleDeviceDoubleClick(selectedDevice);
            }
          }
          break;
        case 'Delete':
        case 'Backspace':
          // Handled by window keydown listener
          break;
      }
    };

    canvas.addEventListener('keydown', handleKeyDown);
    return () => canvas.removeEventListener('keydown', handleKeyDown);
  }, [zoom, selectedDeviceIds, onDeviceDelete]);

  // Handle port click for connection
  const handlePortClick = useCallback((e: ReactMouseEvent, deviceId: string, portId: string) => {
    e.stopPropagation();
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;

    const port = device.ports.find((p) => p.id === portId);
    if (!port) return;

    // Check if port is already connected
    if (port.status === 'connected') {
      // Port is already in use - cannot connect
      if (isDrawingConnection) {
        setConnectionError(language === 'tr' ? 'Bu port zaten kullanımda!' : 'This port is already in use!');
        setTimeout(() => setConnectionError(null), 3000);
        setIsDrawingConnection(false);
        setConnectionStart(null);
      }
      return;
    }

    if (isDrawingConnection && connectionStart) {
      // Check if trying to connect to itself (same device, different port)
      if (connectionStart.deviceId === deviceId) {
        // Show error message - cannot connect device to itself
        const errorMsg = language === 'tr'
          ? 'Bir cihaz kendisine bağlanamaz!'
          : 'A device cannot connect to itself!';
        setConnectionError(errorMsg);
        setTimeout(() => setConnectionError(null), 3000);
        setIsDrawingConnection(false);
        setConnectionStart(null);
        return;
      }
      // Complete connection
      saveToHistory();
      const newConnection: CanvasConnection = {
        id: `conn-${Date.now()}`,
        sourceDeviceId: connectionStart.deviceId,
        sourcePort: connectionStart.portId,
        targetDeviceId: deviceId,
        targetPort: portId,
        cableType: cableInfo.cableType,
        active: true,
      };

      setConnections((prev) => [...prev, newConnection]);

      // Update port status - her iki cihazda da
      setDevices((prev) =>
        prev.map((d) => {
          // Source device port'unu güncelle
          if (d.id === connectionStart.deviceId) {
            return {
              ...d,
              ports: d.ports.map((p) =>
                p.id === connectionStart.portId
                  ? { ...p, status: 'connected' as const }
                  : p
              ),
            };
          }
          // Target device port'unu güncelle
          if (d.id === deviceId) {
            return {
              ...d,
              ports: d.ports.map((p) =>
                p.id === portId
                  ? { ...p, status: 'connected' as const }
                  : p
              ),
            };
          }
          return d;
        })
      );

      // Update cable info
      const sourceDevice = devices.find((d) => d.id === connectionStart.deviceId);
      const targetDevice = devices.find((d) => d.id === deviceId);
      if (sourceDevice && targetDevice) {
        onCableChange({
          ...cableInfo,
          connected: true,
          sourceDevice: sourceDevice.type === 'router' ? 'switch' : sourceDevice.type,
          targetDevice: targetDevice.type === 'router' ? 'switch' : targetDevice.type,
        });
      }

      setIsDrawingConnection(false);
      setConnectionStart(null);
    } else {
      // Start connection - calculate port position inline
      const portIndex = device.ports.findIndex(p => p.id === portId);
      const portsPerRow = device.type === 'pc' ? 2 : 8;
      const col = portIndex % portsPerRow;
      const row = Math.floor(portIndex / portsPerRow);
      const deviceWidth = device.type === 'pc' ? 90 : device.type === 'router' ? 90 : 130;
      const deviceHeight = device.type === 'pc' ? 99 : 80 + Math.ceil(device.ports.length / 8) * 14 + 5;
      let portX = 0;
      let portY = 0;

      if (device.type === 'pc') {
        const pcPortSpacing = 18;
        const pcStartY = deviceHeight / 2 - ((device.ports.length - 1) * pcPortSpacing) / 2;
        portX = device.x + deviceWidth - 8;
        portY = device.y + pcStartY + portIndex * pcPortSpacing;
      } else {
        portX = device.x + 14 + col * 14;
        portY = device.y + 80 + row * 14;
      }

      setIsDrawingConnection(true);
      setConnectionStart({
        deviceId,
        portId,
        point: { x: portX, y: portY },
      });
    }
  }, [devices, isDrawingConnection, connectionStart, cableInfo, onCableChange, saveToHistory]);

  // generate an unused IP within 192.168.1.x (skip existing addresses)
  const generateUniqueIp = useCallback(() => {
    let suffix = 100;
    while (devices.some(d => d.ip === `192.168.1.${suffix}`) || suffix === 1 || suffix === 10) {
      suffix++;
    }
    return `192.168.1.${suffix}`;
  }, [devices]);

  // Add device from palette button
  const addDevice = useCallback((type: 'pc' | 'switch' | 'router') => {
    saveToHistory();
    deviceCounterRef.current[type]++;

    // Calculate position near top-left with some random offset
    const deviceCount = devices.length;
    const offsetX = (deviceCount % 4) * 100;
    const offsetY = Math.floor(deviceCount / 4) * 100;

    const newDevice: CanvasDevice = {
      id: `${type}-${deviceCounterRef.current[type]}`,
      type,
      name: `${type.toUpperCase()}-${deviceCounterRef.current[type]}`,
      macAddress: generateMacAddress(),
      ip: type === 'pc' ? generateUniqueIp() : '',
      // Position near top-left with staggered layout
      x: 100 + offsetX + Math.random() * 30,
      y: 80 + offsetY + Math.random() * 30,
      status: 'offline',
      ports:
        type === 'pc'
          ? [
            { id: 'eth0', label: 'Eth0', status: 'disconnected' as const },
            { id: 'com1', label: 'COM1', status: 'disconnected' as const },
          ]
          : type === 'switch'
            ? generateSwitchPorts()
            : generateRouterPorts(),
    };
    setDevices((prev) => [...prev, newDevice]);
    setSelectedDeviceIds([newDevice.id]);
    onDeviceSelect(type === 'router' ? 'switch' : type, newDevice.id);

  }, [devices.length, saveToHistory, generateUniqueIp, onDeviceSelect]);

  // Note management functions
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const noteCounterRef = useRef<number>(0);
  const noteTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [noteClipboard, setNoteClipboard] = useState('');
  const [noteTextSelection, setNoteTextSelection] = useState<{ noteId: string; start: number; end: number } | null>(null);

  // Note dragging and resizing state
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [resizingNoteId, setResizingNoteId] = useState<string | null>(null);
  const [noteDragStart, setNoteDragStart] = useState<{ x: number; y: number } | null>(null);
  const [noteResizeStart, setNoteResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Refs for note dragging/resizing to avoid stale closures
  const draggedNoteIdRef = useRef<string | null>(null);
  const resizingNoteIdRef = useRef<string | null>(null);
  const noteDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const noteResizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const latestNotesRef = useRef<CanvasNote[]>([]);
  const getNextNoteId = useCallback(() => {
    const existingIds = new Set(latestNotesRef.current.map((n) => n.id));
    let next = noteCounterRef.current + 1;
    while (existingIds.has(`note-${next}`)) {
      next++;
    }
    noteCounterRef.current = next;
    return `note-${next}`;
  }, []);

  const addNote = useCallback(() => {
    saveToHistory();
    const newNote: CanvasNote = {
      id: getNextNoteId(),
      x: 200 + Math.random() * 100,
      y: 200 + Math.random() * 100,
      width: 200,
      height: 150,
      text: language === 'tr' ? 'Yeni not...' : 'New note...',
      color: '#fef3c7',
      font: 'Arial',
      fontSize: 12,
      opacity: 1,
    };
    setNotes((prev) => [...prev, newNote]);
    setSelectedNoteIds([newNote.id]);
  }, [saveToHistory, language, getNextNoteId]);

  const deleteNote = useCallback((noteId: string) => {
    saveToHistory();
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    setSelectedNoteIds((prev) => prev.filter((id) => id !== noteId));
  }, [saveToHistory]);

  const updateNoteText = useCallback((noteId: string, text: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, text } : n))
    );
  }, []);

  const updateNoteStyle = useCallback((noteId: string, updates: Partial<CanvasNote>) => {
    saveToHistory();
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, ...updates } : n))
    );
  }, [saveToHistory]);

  const cycleNoteColor = useCallback((noteId: string) => {
    const note = latestNotesRef.current.find((n) => n.id === noteId);
    if (!note) return;
    const idx = NOTE_COLORS.indexOf(note.color as typeof NOTE_COLORS[number]);
    const next = NOTE_COLORS[(idx >= 0 ? idx + 1 : 0) % NOTE_COLORS.length];
    updateNoteStyle(noteId, { color: next });
  }, [updateNoteStyle]);

  const cycleNoteFont = useCallback((noteId: string) => {
    const note = latestNotesRef.current.find((n) => n.id === noteId);
    if (!note) return;
    const idx = NOTE_FONTS.indexOf(note.font as typeof NOTE_FONTS[number]);
    const next = NOTE_FONTS[(idx >= 0 ? idx + 1 : 0) % NOTE_FONTS.length];
    updateNoteStyle(noteId, { font: next });
  }, [updateNoteStyle]);

  const cycleNoteFontSize = useCallback((noteId: string) => {
    const note = latestNotesRef.current.find((n) => n.id === noteId);
    if (!note) return;
    const idx = NOTE_FONT_SIZES.indexOf(note.fontSize);
    const next = NOTE_FONT_SIZES[(idx >= 0 ? idx + 1 : 0) % NOTE_FONT_SIZES.length];
    updateNoteStyle(noteId, { fontSize: next });
  }, [updateNoteStyle]);

  const cycleNoteOpacity = useCallback((noteId: string) => {
    const note = latestNotesRef.current.find((n) => n.id === noteId);
    if (!note) return;
    const idx = NOTE_OPACITY_OPTIONS.indexOf(note.opacity);
    const next = NOTE_OPACITY_OPTIONS[(idx >= 0 ? idx + 1 : 0) % NOTE_OPACITY_OPTIONS.length];
    updateNoteStyle(noteId, { opacity: next });
  }, [updateNoteStyle]);

  const duplicateNote = useCallback((noteId: string) => {
    const note = latestNotesRef.current.find((n) => n.id === noteId);
    if (!note) return;
    saveToHistory();
    const duplicatedNote: CanvasNote = {
      ...note,
      id: getNextNoteId(),
      x: note.x + 20,
      y: note.y + 20,
    };
    setNotes((prev) => [...prev, duplicatedNote]);
    setSelectedNoteIds([duplicatedNote.id]);
    setSelectedDeviceIds([]);
  }, [saveToHistory, getNextNoteId]);

  const getNoteSelection = useCallback((noteId: string) => {
    const note = latestNotesRef.current.find((n) => n.id === noteId);
    if (!note) return null;

    const cachedSelection = noteTextSelection?.noteId === noteId ? noteTextSelection : null;
    const textarea = noteTextareaRefs.current[noteId];
    const start = cachedSelection?.start ?? textarea?.selectionStart ?? 0;
    const end = cachedSelection?.end ?? textarea?.selectionEnd ?? 0;
    const from = Math.max(0, Math.min(start, end));
    const to = Math.max(0, Math.max(start, end));

    return {
      note,
      start: from,
      end: to,
      selectedText: note.text.slice(from, to),
      hasSelection: to > from,
    };
  }, [noteTextSelection]);

  const updateNoteTextRange = useCallback((noteId: string, start: number, end: number, insertText: string) => {
    saveToHistory();
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const safeStart = Math.max(0, Math.min(start, n.text.length));
        const safeEnd = Math.max(0, Math.min(end, n.text.length));
        return {
          ...n,
          text: `${n.text.slice(0, safeStart)}${insertText}${n.text.slice(safeEnd)}`
        };
      })
    );
  }, [saveToHistory]);

  const handleNoteTextContextMenu = useCallback((e: ReactMouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const textarea = noteTextareaRefs.current[noteId];
    if (textarea) {
      setNoteTextSelection({
        noteId,
        start: textarea.selectionStart ?? 0,
        end: textarea.selectionEnd ?? 0,
      });
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      deviceId: null,
      noteId,
      mode: 'note-edit',
    });
  }, []);

  const handleNoteTextCopy = useCallback(async (noteId: string) => {
    const textarea = noteTextareaRefs.current[noteId];
    const note = latestNotesRef.current.find((n) => n.id === noteId);
    if (!textarea || !note) return;

    const selection = getNoteSelection(noteId);
    if (!selection?.hasSelection) return;

    // Focus textarea ve seçili metni seç
    textarea.focus();
    textarea.setSelectionRange(selection.start, selection.end);

    setNoteClipboard(selection.selectedText);
    try {
      await navigator.clipboard.writeText(selection.selectedText);
    } catch {
      // Clipboard may be blocked; keep local fallback.
    }
  }, [getNoteSelection]);

  const handleNoteTextCut = useCallback(async (noteId: string) => {
    const textarea = noteTextareaRefs.current[noteId];
    const note = latestNotesRef.current.find((n) => n.id === noteId);
    if (!textarea || !note) return;

    const selection = getNoteSelection(noteId);
    if (!selection?.hasSelection) return;

    // Focus textarea ve seçili metni seç
    textarea.focus();
    textarea.setSelectionRange(selection.start, selection.end);

    setNoteClipboard(selection.selectedText);
    try {
      await navigator.clipboard.writeText(selection.selectedText);
    } catch {
      // Clipboard may be blocked; keep local fallback.
    }
    updateNoteTextRange(noteId, selection.start, selection.end, '');
    setNoteTextSelection(null);
  }, [getNoteSelection, updateNoteTextRange]);

  const handleNoteTextDelete = useCallback((noteId: string) => {
    const textarea = noteTextareaRefs.current[noteId];
    const note = latestNotesRef.current.find((n) => n.id === noteId);
    if (!textarea || !note) return;

    const selection = getNoteSelection(noteId);
    if (!selection?.hasSelection) return;

    // Focus textarea ve seçili metni seç
    textarea.focus();
    textarea.setSelectionRange(selection.start, selection.end);

    updateNoteTextRange(noteId, selection.start, selection.end, '');
    setNoteTextSelection(null);
  }, [getNoteSelection, updateNoteTextRange]);

  const handleNoteTextPaste = useCallback(async (noteId: string) => {
    const textarea = noteTextareaRefs.current[noteId];
    const note = latestNotesRef.current.find((n) => n.id === noteId);
    if (!textarea || !note) return;

    // Focus textarea
    textarea.focus();

    const selection = getNoteSelection(noteId);
    if (!selection) return;

    let pastedText = '';
    try {
      pastedText = await navigator.clipboard.readText();
    } catch {
      pastedText = noteClipboard;
    }

    if (!pastedText) return;
    updateNoteTextRange(noteId, selection.start, selection.end, pastedText);
    setNoteTextSelection({
      noteId,
      start: selection.start + pastedText.length,
      end: selection.start + pastedText.length,
    });
  }, [getNoteSelection, noteClipboard, updateNoteTextRange]);

  const handleNoteTextSelectAll = useCallback((noteId: string) => {
    const textarea = noteTextareaRefs.current[noteId];
    const note = latestNotesRef.current.find((n) => n.id === noteId);
    if (!textarea || !note) return;

    textarea.focus();
    textarea.setSelectionRange(0, note.text.length);
    setNoteTextSelection({
      noteId,
      start: 0,
      end: note.text.length,
    });
  }, []);

  // Sync notes ref on every render
  latestNotesRef.current = notes;
  draggedNoteIdRef.current = draggedNoteId;
  resizingNoteIdRef.current = resizingNoteId;
  noteDragStartRef.current = noteDragStart;
  noteResizeStartRef.current = noteResizeStart;

  // Handle note header drag start
  const handleNoteHeaderMouseDown = useCallback((e: ReactMouseEvent, noteId: string) => {
    e.stopPropagation();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    saveToHistory();
    setDraggedNoteId(noteId);
    setNoteDragStart({ x: e.clientX, y: e.clientY });
    setSelectedNoteIds([noteId]);
  }, [notes, saveToHistory]);

  // Handle note resize start
  const handleNoteResizeStart = useCallback((e: ReactMouseEvent, noteId: string) => {
    e.stopPropagation();
    if (!canvasRef.current) return;

    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    saveToHistory();
    setResizingNoteId(noteId);
    setNoteResizeStart({ x: e.clientX, y: e.clientY, width: note.width, height: note.height });
    setSelectedNoteIds([noteId]);
  }, [notes, saveToHistory]);

  // Handle note dragging and resizing with mouse move
  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!canvasRef.current) return;

      if (draggedNoteIdRef.current && noteDragStartRef.current) {
        const currentZoom = zoomRef.current;

        const deltaX = (e.clientX - noteDragStartRef.current.x) / currentZoom;
        const deltaY = (e.clientY - noteDragStartRef.current.y) / currentZoom;

        setNotes((prev) =>
          prev.map((n) =>
            n.id === draggedNoteIdRef.current
              ? { ...n, x: n.x + deltaX, y: n.y + deltaY }
              : n
          )
        );

        setNoteDragStart({ x: e.clientX, y: e.clientY });
      } else if (resizingNoteIdRef.current && noteResizeStartRef.current) {
        const currentZoom = zoomRef.current;

        const deltaX = (e.clientX - noteResizeStartRef.current.x) / currentZoom;
        const deltaY = (e.clientY - noteResizeStartRef.current.y) / currentZoom;

        const newWidth = Math.max(150, noteResizeStartRef.current.width + deltaX);
        const newHeight = Math.max(100, noteResizeStartRef.current.height + deltaY);

        setNotes((prev) =>
          prev.map((n) =>
            n.id === resizingNoteIdRef.current
              ? { ...n, width: newWidth, height: newHeight }
              : n
          )
        );
      }
    };

    const handleMouseUp = () => {
      setDraggedNoteId(null);
      setNoteDragStart(null);
      setResizingNoteId(null);
      setNoteResizeStart(null);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Notify parent of topology changes — debounced to avoid calling at 60fps during drag
  const lastStateRef = useRef<string>('');
  const topologyChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!onTopologyChange) return;
    if (topologyChangeTimerRef.current) clearTimeout(topologyChangeTimerRef.current);
    topologyChangeTimerRef.current = setTimeout(() => {
      const currentState = JSON.stringify({ devices, connections, notes });
      if (currentState !== lastStateRef.current) {
        lastStateRef.current = currentState;
        onTopologyChange(devices, connections, notes);
      }
      topologyChangeTimerRef.current = null;
    }, 150);
    return () => {
      if (topologyChangeTimerRef.current) clearTimeout(topologyChangeTimerRef.current);
    };
  }, [devices, connections, notes, onTopologyChange]);
  // Port Tooltip state
  const [portTooltip, setPortTooltip] = useState<{
    deviceId: string;
    portId: string;
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const portTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getLivePort = useCallback((deviceId: string, portId: string) => {
    const deviceState = deviceStates?.get(deviceId);
    if (deviceState?.ports?.[portId]) {
      return deviceState.ports[portId];
    }
    const device = devices.find(d => d.id === deviceId);
    return device?.ports.find(p => p.id === portId);
  }, [deviceStates, devices]);

  const hasPortMode = (port: ReturnType<typeof getLivePort>): port is NonNullable<ReturnType<typeof getLivePort>> & { mode: 'access' | 'trunk' | 'routed' } => {
    return !!port && typeof port === 'object' && 'mode' in port;
  };

  const getLiveDeviceVlan = useCallback((device: CanvasDevice) => {
    if (device.type !== 'pc') return null;
    if (typeof device.vlan === 'number' && device.vlan > 0) {
      return device.vlan;
    }

    const connectedPort = connections.find(conn => conn.sourceDeviceId === device.id || conn.targetDeviceId === device.id);
    if (!connectedPort) return 1;

    const otherDeviceId = connectedPort.sourceDeviceId === device.id ? connectedPort.targetDeviceId : connectedPort.sourceDeviceId;
    const otherPortId = connectedPort.sourceDeviceId === device.id ? connectedPort.targetPort : connectedPort.sourcePort;
    const otherPort = getLivePort(otherDeviceId, otherPortId);

    if (!otherPort) return 1;
    if (hasPortMode(otherPort) && otherPort.mode === 'trunk') return 'Trunk';
    return Number((otherPort as any).accessVlan || otherPort.vlan || 1);
  }, [connections, getLivePort]);

  const getLivePortVlanText = useCallback((deviceId: string, portId: string) => {
    const device = devices.find(d => d.id === deviceId);
    const livePort = getLivePort(deviceId, portId);
    if (!device || !livePort) return '1';

    if (device.type === 'pc') {
      const conn = connections.find(c =>
        (c.sourceDeviceId === deviceId && c.sourcePort === portId) ||
        (c.targetDeviceId === deviceId && c.targetPort === portId)
      );
      if (!conn) return '1';

      const peerDeviceId = conn.sourceDeviceId === deviceId ? conn.targetDeviceId : conn.sourceDeviceId;
      const peerPortId = conn.sourceDeviceId === deviceId ? conn.targetPort : conn.sourcePort;
      const peerPort = getLivePort(peerDeviceId, peerPortId);
      if (!peerPort) return '1';
      if (hasPortMode(peerPort) && peerPort.mode === 'trunk') return 'Trunk';
      return String((peerPort as any).accessVlan || peerPort.vlan || 1);
    }

    if (hasPortMode(livePort) && livePort.mode === 'trunk') return 'Trunk';
    return String((livePort as any).accessVlan || livePort.vlan || 1);
  }, [connections, devices, getLivePort]);

  const showPortTooltip = useCallback((e: ReactMouseEvent | MouseEvent, deviceId: string, portId: string) => {
    const device = devices.find(d => d.id === deviceId);
    const port = getLivePort(deviceId, portId);
    if (!device || !port) return;

    if (portTooltipTimerRef.current) {
      clearTimeout(portTooltipTimerRef.current);
    }

    // Hemen tooltip'i göster
    portTooltipTimerRef.current = setTimeout(() => {
      setPortTooltip({
        deviceId,
        portId,
        x: e.clientX,
        y: e.clientY,
        visible: true,
      });

      // 2000ms sonra tooltip'i gizle
      portTooltipTimerRef.current = setTimeout(() => {
        setPortTooltip(prev => prev ? { ...prev, visible: false } : null);
      }, 2000);
    }, 0);
  }, [devices, getLivePort]);

  const handlePortHover = useCallback((e: ReactMouseEvent, deviceId: string, portId: string) => {
    // Kablo takarken port ipuçlarını gösterme
    if (isDrawingConnection) return;
    showPortTooltip(e, deviceId, portId);
  }, [showPortTooltip, isDrawingConnection]);

  const handlePortMouseLeave = useCallback(() => {
    if (portTooltipTimerRef.current) {
      clearTimeout(portTooltipTimerRef.current);
    }
    setPortTooltip(null);
  }, []);

  // Sync device counters with current devices to prevent ID collisions
  useEffect(() => {
    if (devices.length > 0) {
      const counters = { pc: 0, switch: 0, router: 0 };
      devices.forEach(d => {
        const match = d.id.match(/^(\w+)-(\d+)$/);
        if (match) {
          const type = match[1] as 'pc' | 'switch' | 'router';
          const num = parseInt(match[2]);
          if (counters[type] !== undefined) {
            counters[type] = Math.max(counters[type], num);
          }
        }
      });
      deviceCounterRef.current = counters;
    }
  }, [devices]);

  // Sync port shutdown status from deviceStates
  // FIXED: removed `devices` from deps — using functional setState (prev =>) to read latest devices
  // Previously having `devices` in deps + calling setDevices caused an infinite re-render loop
  useEffect(() => {
    if (!deviceStates) return;
    setDevices(prev => {
      if (prev.length === 0) return prev;
      let hasChanges = false;
      const updatedDevices = prev.map(device => {
        const deviceState = deviceStates.get(device.id);
        if (!deviceState) return device;

        let portChanged = false;
        const updatedPorts = device.ports.map(port => {
          const simulatorPort = deviceState.ports[port.id];
          if (simulatorPort) {
            // Check if this port has an active connection in the topology
            const hasActiveConnection = connections.some(
              conn => (conn.sourceDeviceId === device.id && conn.sourcePort === port.id) ||
                (conn.targetDeviceId === device.id && conn.targetPort === port.id)
            );

            // Translate simulator status → UI status
            // Simulator: 'connected' | 'notconnect' | 'disabled' | 'blocked'
            // UI:        'connected' | 'disconnected'
            let uiStatus: 'connected' | 'disconnected';
            if (hasActiveConnection) {
              uiStatus = 'connected';
            } else {
              // If no active connection, port must be disconnected regardless of simulator state
              uiStatus = 'disconnected';
            }

            const nextPort = {
              ...port,
              status: uiStatus,
              vlan: simulatorPort.vlan ?? port.vlan,
              accessVlan: simulatorPort.accessVlan ?? (port as any).accessVlan,
              mode: simulatorPort.mode ?? port.mode,
              name: simulatorPort.name ?? port.name,
              speed: simulatorPort.speed ?? port.speed,
              duplex: simulatorPort.duplex ?? port.duplex,
              shutdown: simulatorPort.shutdown ?? port.shutdown,
              ipAddress: simulatorPort.ipAddress ?? port.ipAddress,
              subnetMask: simulatorPort.subnetMask ?? port.subnetMask,
            };
            const changed =
              nextPort.status !== port.status ||
              nextPort.vlan !== port.vlan ||
              nextPort.accessVlan !== (port as any).accessVlan ||
              nextPort.mode !== port.mode ||
              nextPort.name !== port.name ||
              nextPort.speed !== port.speed ||
              nextPort.duplex !== port.duplex ||
              nextPort.shutdown !== port.shutdown ||
              nextPort.ipAddress !== port.ipAddress ||
              nextPort.subnetMask !== port.subnetMask;
            if (changed) {
              portChanged = true;
              hasChanges = true;
              return nextPort;
            }
          }
          return port;
        });

        return portChanged ? { ...device, ports: updatedPorts } : device;
      });
      return hasChanges ? updatedDevices : prev;
    });
  }, [deviceStates, connections]); // ← added connections to check for active connections


  // Delete connection
  const deleteConnection = useCallback((connectionId: string) => {
    saveToHistory();
    const conn = connections.find((c) => c.id === connectionId);
    if (conn) {
      // Port durumlarını güncelle - her iki cihazda da
      setDevices((prev) =>
        prev.map((d) => {
          // Source veya target device ise port'ları güncelle
          if (d.id === conn.sourceDeviceId || d.id === conn.targetDeviceId) {
            return {
              ...d,
              ports: d.ports.map((p) => {
                // Bu bağlantıya ait portları disconnected yap
                if (p.id === conn.sourcePort || p.id === conn.targetPort) {
                  return { ...p, status: 'disconnected' as const };
                }
                return p;
              }),
            };
          }
          return d;
        })
      );
      // Bağlantıyı sil
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    }
  }, [connections, saveToHistory]);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    if (devices.length === 0 && notes.length === 0) {
      setPan({ x: 0, y: 0 });
      return;
    }

    const padding = 10;
    const minDeviceX = devices.length ? Math.min(...devices.map(d => d.x)) : Infinity;
    const minDeviceY = devices.length ? Math.min(...devices.map(d => d.y)) : Infinity;
    const minNoteX = notes.length ? Math.min(...notes.map(n => n.x)) : Infinity;
    const minNoteY = notes.length ? Math.min(...notes.map(n => n.y)) : Infinity;

    const minX = Math.min(minDeviceX, minNoteX);
    const minY = Math.min(minDeviceY, minNoteY);

    setPan({ x: padding - minX * DEFAULT_ZOOM, y: padding - minY * DEFAULT_ZOOM });
    window.scrollTo(0, 0);
  }, [devices, notes]);

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    setDevices([]);
    setConnections([]);
    setSelectedDeviceIds([]);
    deviceCounterRef.current = { pc: 0, switch: 0, router: 0 };
  }, []);

  // Copy devices
  const copyDevice = useCallback((ids: string[]) => {
    const selectedDevices = devices.filter(d => ids.includes(d.id));
    if (selectedDevices.length > 0) {
      setClipboard(selectedDevices.map(d => ({ ...d })));
    }
    setContextMenu(null);
  }, [devices]);

  // Cut devices
  const cutDevice = useCallback((ids: string[]) => {
    const selectedDevices = devices.filter(d => ids.includes(d.id));
    if (selectedDevices.length > 0) {
      setClipboard(selectedDevices.map(d => ({ ...d })));
      ids.forEach(id => deleteDevice(id));
      setSelectedDeviceIds([]);
    }
    setContextMenu(null);
  }, [devices, deleteDevice]);

  // Confirm rename
  const confirmRename = useCallback(() => {
    if (renamingDevice && renameValue.trim()) {
      saveToHistory();
      setDevices(prev => prev.map(d =>
        d.id === renamingDevice ? { ...d, name: renameValue.trim() } : d
      ));
      onDeviceRename?.(renamingDevice, renameValue.trim());
    }
    setRenamingDevice(null);
    setRenameValue('');
  }, [renamingDevice, renameValue, saveToHistory, onDeviceRename]);
  // Paste devices
  const pasteDevice = useCallback(() => {
    if (clipboard.length === 0) return;

    saveToHistory();

    const newDevices: CanvasDevice[] = [];

    clipboard.forEach(device => {
      const type = device.type;
      deviceCounterRef.current[type]++;
      const newId = `${type}-${deviceCounterRef.current[type]}`;

      newDevices.push({
        ...device,
        id: newId,
        name: `${type.toUpperCase()}-${deviceCounterRef.current[type]}`,
        ip: type === 'pc' ? generateUniqueIp() : '',
        x: device.x + 30,
        y: device.y + 30,
        ports: device.ports.map(p => ({ ...p, status: 'disconnected' as const })),
      });
    });

    setDevices(prev => [...prev, ...newDevices]);
    setContextMenu(null);
  }, [clipboard, saveToHistory, generateUniqueIp]);

  // Paste notes
  const pasteNotes = useCallback((x: number, y: number) => {
    if (notesClipboard.length === 0) return;

    saveToHistory();

    const newNotes: CanvasNote[] = notesClipboard.map((note) => ({
      ...note,
      id: getNextNoteId(),
      x: x + 20,
      y: y + 20,
    }));

    setNotes((prev) => [...prev, ...newNotes]);
    setSelectedNoteIds(newNotes.map(n => n.id));
    setContextMenu(null);
  }, [notesClipboard, saveToHistory, getNextNoteId, setNotes]);

  // Handle key events: ESC to close context menu, DELETE to remove devices, Ctrl+A to select all
  useEffect(() => {
    const handleCloseBroadcast = (e: any) => {
      const source = e.detail?.source;
      if (source && source !== 'topology') {
        setContextMenu(null);
        if (source === 'escape') {
          if (configuringDevice) cancelDeviceConfig();
          if (pingSource) setPingSource(null);
          if (showPortSelector) {
            setShowPortSelector(false);
            setPortSelectorStep('source');
            setSelectedSourcePort(null);
          }
          if (selectedDeviceIds.length > 0) {
            const firstId = selectedDeviceIds[0];
            const firstDevice = devices.find(d => d.id === firstId);
            setSelectedDeviceIds([firstId]);
            if (firstDevice) onDeviceSelect(firstDevice.type === 'router' ? 'router' : firstDevice.type, firstId);
          }
        }
      }
    };
    window.addEventListener('close-menus-broadcast', handleCloseBroadcast);

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // ESC to close context menu
      if (key === 'escape') {
        setContextMenu(null);
        // Also cancel drawing connection
        if (isDrawingConnection) {
          setIsDrawingConnection(false);
          setConnectionStart(null);
        }
        // Close palette
        if (isPaletteOpen) {
          setIsPaletteOpen(false);
        }
        // Exit fullscreen
        if (isFullscreen) {
          setIsFullscreen(false);
        }
      }

      // Don't handle other keys if a modal is open
      if (configuringDevice) {
        return;
      }

      // Delete selected device(s)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
        const isEditable = tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;
        if (!isEditable && selectedDeviceIds.length > 0) {
          saveToHistory();
          selectedDeviceIds.forEach(id => deleteDevice(id));
          setSelectedDeviceIds([]);
        }
      }

      // Ctrl Shortcuts
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+A to select all
        if (key === 'a') {
          e.preventDefault();
          selectAllDevices();
        }

        // Ctrl+Z to undo
        if (key === 'z') {
          e.preventDefault();
          handleUndo();
        }

        // Ctrl+Y to redo
        if (key === 'y') {
          e.preventDefault();
          handleRedo();
        }
        // Ctrl+C to copy
        if (key === 'c' && (e.ctrlKey || e.metaKey)) {
          if (selectedDeviceIds.length > 0) {
            copyDevice(selectedDeviceIds);
          }
        }
        // Ctrl+X to cut
        if (key === 'x' && (e.ctrlKey || e.metaKey)) {
          if (selectedDeviceIds.length > 0) {
            cutDevice(selectedDeviceIds);
          }
        }
        // Ctrl+V to paste
        if (key === 'v' && pasteDevice) {
          e.preventDefault();
          pasteDevice();
        }

        // Ctrl+F to toggle fullscreen
        if (key === 'f') {
          e.preventDefault();
          toggleFullscreen();
        }
      }

      // Alt+R to reset zoom/pan view
      if (e.altKey && !e.ctrlKey && !e.metaKey && key === 'r') {
        e.preventDefault();
        resetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('close-menus-broadcast', handleCloseBroadcast);
    };
  }, [selectedDeviceIds, deleteDevice, configuringDevice, cancelDeviceConfig, selectAllDevices, saveToHistory, devices, onDeviceDelete, isDrawingConnection, isPaletteOpen, handleUndo, handleRedo, copyDevice, cutDevice, pasteDevice, pingSource, showPortSelector, toggleFullscreen, isFullscreen, resetView]);

  // Find path between devices using BFS
  const findPath = useCallback((sourceId: string, targetId: string): string[] | null => {
    if (sourceId === targetId) return [sourceId];

    const visited = new Set<string>();
    const queue: { deviceId: string; path: string[] }[] = [{ deviceId: sourceId, path: [sourceId] }];
    visited.add(sourceId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Find all connected devices
      for (const conn of connections) {
        // Skip console cables for data path (Ping)
        if (conn.cableType === 'console') continue;

        let nextDeviceId: string | null = null;
        let sourcePortId: string | null = null;
        let targetPortId: string | null = null;

        if (conn.sourceDeviceId === current.deviceId && !visited.has(conn.targetDeviceId)) {
          nextDeviceId = conn.targetDeviceId;
          sourcePortId = conn.sourcePort;
          targetPortId = conn.targetPort;
        } else if (conn.targetDeviceId === current.deviceId && !visited.has(conn.sourceDeviceId)) {
          nextDeviceId = conn.sourceDeviceId;
          sourcePortId = conn.targetPort;
          targetPortId = conn.sourcePort;
        }

        if (nextDeviceId && sourcePortId && targetPortId) {
          const sourceDevice = devices.find(d => d.id === current.deviceId);
          const targetDevice = devices.find(d => d.id === nextDeviceId);

          if (sourceDevice && targetDevice) {
            // Check if devices are powered on
            const sourceIsOffline = sourceDevice.status === 'offline';
            const targetIsOffline = targetDevice.status === 'offline';

            if (sourceIsOffline || targetIsOffline) {
              // Cannot traverse through powered off devices
              continue;
            }

            // Check if cable is compatible
            const isCompatible = isCableCompatible({
              connected: true,
              cableType: conn.cableType,
              sourceDevice: sourceDevice.type === 'router' ? 'switch' : sourceDevice.type,
              targetDevice: targetDevice.type === 'router' ? 'switch' : targetDevice.type,
              sourcePort: conn.sourcePort,
              targetPort: conn.targetPort,
            });

            // Check if both ports are NOT shutdown
            const sPort = sourceDevice.ports.find(p => p.id === sourcePortId);
            const tPort = targetDevice.ports.find(p => p.id === targetPortId);
            const isUp = sPort && !sPort.shutdown && tPort && !tPort.shutdown;

            if (isCompatible && isUp) {
              const newPath = [...current.path, nextDeviceId!];

              if (nextDeviceId === targetId) {
                return newPath;
              }

              visited.add(nextDeviceId!);
              queue.push({ deviceId: nextDeviceId!, path: newPath });
            }
          }
        }
      }
    }

    return null; // No path found
  }, [connections, devices]);

  // Ping animation between devices with multi-hop support
  const startPingAnimation = useCallback((sourceId: string, targetId: string) => {
    // Cancel any existing animation
    if (pingAnimationRef.current) {
      cancelAnimationFrame(pingAnimationRef.current);
    }

    // Validate source device IP
    const sourceDevice = devices.find(d => d.id === sourceId);
    const sourceIp = sourceDevice?.ip || '';
    const isSourceIpValid = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(sourceIp);

    // Validate target device IP
    const targetDevice = devices.find(d => d.id === targetId);
    const targetIp = targetDevice?.ip || deviceStates?.get(targetId)?.ports['vlan1']?.ipAddress || '';
    const isTargetIpValid = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(targetIp);

    // Check if both IPs are valid
    if (!isSourceIpValid || !isTargetIpValid) {
      const errorMessage = !isSourceIpValid
        ? (language === 'tr' ? 'Kaynak cihazın IP adresi geçersiz' : 'Source device IP is invalid')
        : (language === 'tr' ? 'Hedef cihazın IP adresi geçersiz' : 'Target device IP is invalid');

      setPingAnimation({
        sourceId,
        targetId,
        path: [sourceId, targetId],
        currentHopIndex: 0,
        progress: 1,
        success: false,
        frame: 0,
        error: errorMessage,
        hopCount: 0
      });

      setErrorToast({
        message: language === 'tr' ? 'Ping başarısız!' : 'Ping failed!',
        details: errorMessage
      });

      setTimeout(() => setPingAnimation(null), 3000);
      return;
    }

    // Get detailed diagnostics
    const diagnostics = getPingDiagnostics(sourceId, targetIp, devices, connections, deviceStates);

    const connectivity = checkDeviceConnectivity(sourceId, targetId, devices, connections, deviceStates);
    if (!connectivity.success) {
      const errorMessage = diagnostics.reasons.length > 0
        ? diagnostics.reasons[0]
        : 'Ping başarısız';

      setPingAnimation({
        sourceId,
        targetId,
        path: [sourceId, targetId],
        currentHopIndex: 0,
        progress: 1,
        success: false,
        frame: 0,
        error: errorMessage,
        hopCount: 0
      });

      // Show persistent error toast
      setErrorToast({
        message: language === 'tr' ? 'Ping başarısız!' : 'Ping failed!',
        details: errorMessage
      });

      setTimeout(() => setPingAnimation(null), 3000);
      return;
    }

    // Find path between source and target
    const path = connectivity.hopIds;

    if (!path || path.length < 2) {
      // No path found - show error
      setPingAnimation({
        sourceId,
        targetId,
        path: [sourceId, targetId],
        currentHopIndex: 0,
        progress: 1,
        success: false,
        frame: 0,
        error: 'Fiziksel bağlantı yok',
        hopCount: 0
      });

      // Show persistent error toast
      setErrorToast({
        message: language === 'tr' ? 'Ping başarısız!' : 'Ping failed!',
        details: 'Fiziksel bağlantı yok'
      });

      setTimeout(() => setPingAnimation(null), 3000);
      return;
    }

    // Start ping animation
    setPingAnimation({
      sourceId,
      targetId,
      path,
      currentHopIndex: 0,
      progress: 0,
      success: null,
      frame: 0,
      hopCount: 0
    });

    // Clear any previous error toast
    setErrorToast(null);

    // Animate ping - each hop takes 800ms
    const hopDuration = 800;
    let startTime = Date.now();
    let currentHop = 0;
    let frameCount = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / hopDuration, 1);
      frameCount++;

      if (progress < 1) {
        setPingAnimation(prev => {
          if (!prev) return null;
          return { ...prev, currentHopIndex: currentHop, progress, frame: frameCount };
        });
        pingAnimationRef.current = requestAnimationFrame(animate);
      } else {
        // Check if this segment was a hop before moving to next
        const fromId = path[currentHop];
        const toId = path[currentHop + 1];

        const conn = connections.find(c =>
          (c.sourceDeviceId === fromId && c.targetDeviceId === toId) ||
          (c.sourceDeviceId === toId && c.targetDeviceId === fromId)
        );
        const toDevice = devices.find(d => d.id === toId);
        const isWifi = conn?.cableType === 'wireless';
        const isRouter = toDevice?.type === 'router';

        // Calculate currentSegmentHopCountIncrement for the segment that just finished
        const currentSegmentHopCountIncrement = (isWifi || isRouter) ? 1 : 0;

        if (currentHop < path.length - 1) { // If there are more segments to animate
          // Prepare for the NEXT segment
          currentHop++; // Increment hop index
          startTime = Date.now(); // Reset timer for the NEW segment

          setPingAnimation(prev => {
            if (!prev) return null;
            return {
              ...prev,
              currentHopIndex: currentHop,
              progress: 0, // Start progress for the NEW segment
              frame: frameCount,
              hopCount: prev.hopCount + currentSegmentHopCountIncrement // Update hopCount with increment from previous segment
            };
          });
          pingAnimationRef.current = requestAnimationFrame(animate); // Schedule next frame for the NEW segment

        } else { // This was the LAST segment. Animation complete.
          setPingAnimation(prev => {
            if (!prev) return null;
            return {
              ...prev,
              success: true, // Mark as successful
              hopCount: prev.hopCount + currentSegmentHopCountIncrement // Update hopCount with increment from last segment
            };
          });
          setTimeout(() => setPingAnimation(null), 3000); // Clear animation after delay
        }
      }
    };

    pingAnimationRef.current = requestAnimationFrame(animate);
  }, [connections, deviceStates, devices, findPath]);

  // Listen for global ping animation trigger
  useEffect(() => {
    const handlePingTrigger = (event: any) => {
      const { sourceId, targetId } = event.detail;
      if (sourceId && targetId) {
        startPingAnimation(sourceId, targetId);
      }
    };
    window.addEventListener('trigger-ping-animation', handlePingTrigger);
    return () => window.removeEventListener('trigger-ping-animation', handlePingTrigger);
  }, [startPingAnimation]);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Get device position (center based on device type)
  const getDeviceCenter = useCallback((device: CanvasDevice) => {
    const deviceWidth = device.type === 'pc' ? 90 : device.type === 'router' ? 90 : 130;
    const iconColor = device.status === 'online'
      ? '#22c55e'
      : '#ef4444';
    const portsPerRow = 8;
    const numRows = Math.ceil(device.ports.length / portsPerRow);
    const deviceHeight = device.type === 'pc' ? 99 : 80 + numRows * 14 + 5;
    return { x: device.x + deviceWidth / 2, y: device.y + deviceHeight / 2 };
  }, []);

  // Get port position on device
  const getPortPosition = useCallback((device: CanvasDevice, portId: string) => {
    const portIndex = device.ports.findIndex(p => p.id === portId);
    if (portIndex === -1) return getDeviceCenter(device);

    const deviceWidth = device.type === 'pc' ? 90 : device.type === 'router' ? 90 : 130;
    const portsPerRow = device.type === 'pc' ? 2 : 8;
    const col = portIndex % portsPerRow;
    const row = Math.floor(portIndex / portsPerRow);

    if (device.type === 'pc') {
      const pcPortSpacing = 18;
      const pcStartY = 99 / 2 - ((device.ports.length - 1) * pcPortSpacing) / 2;
      return {
        x: device.x + deviceWidth - 8,
        y: device.y + pcStartY + portIndex * pcPortSpacing
      };
    }

    const portSpacing = 14;
    const rowSpacing = 14;
    const startX = 14;
    const startY = 80;

    return {
      x: device.x + startX + col * portSpacing,
      y: device.y + startY + row * rowSpacing
    };
  }, [getDeviceCenter]);

  // Render connection SVG (Visual line only)
  const renderConnectionLine = (conn: CanvasConnection, connIndex: number) => {
    const sourceDevice = devices.find((d) => d.id === conn.sourceDeviceId);
    const targetDevice = devices.find((d) => d.id === conn.targetDeviceId);
    if (!sourceDevice || !targetDevice) return null;

    // Get port positions for more accurate connection lines
    const source = getPortPosition(sourceDevice, conn.sourcePort);
    const target = getPortPosition(targetDevice, conn.targetPort);

    // Check cable compatibility - use pink color for incompatible cables
    const cableInfoForConnection: CableInfo = {
      connected: true,
      cableType: conn.cableType,
      sourceDevice: sourceDevice.type === 'router' ? 'switch' : sourceDevice.type,
      targetDevice: targetDevice.type === 'router' ? 'switch' : targetDevice.type,
      sourcePort: conn.sourcePort,
      targetPort: conn.targetPort,
    };
    const isCompatible = isCableCompatible(cableInfoForConnection);
    const color = isCompatible ? CABLE_COLORS[conn.cableType].primary : CABLE_COLORS.error.primary;

    // Calculate parallel offset for multiple connections between same devices
    const sameDeviceConnections = connections.filter(
      c => (c.sourceDeviceId === conn.sourceDeviceId && c.targetDeviceId === conn.targetDeviceId) ||
        (c.sourceDeviceId === conn.targetDeviceId && c.targetDeviceId === conn.sourceDeviceId)
    );
    const sameConnIndex = sameDeviceConnections.findIndex(c => c.id === conn.id);
    const totalSameConns = sameDeviceConnections.length;

    // Calculate offset for parallel lines (spread out from center)
    const maxOffset = 20;
    const offset = totalSameConns > 1
      ? (sameConnIndex - (totalSameConns - 1) / 2) * (maxOffset / Math.max(totalSameConns - 1, 1))
      : 0;

    // Calculate control points for smooth curve with offset
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;

    // Apply perpendicular offset for parallel lines
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / len * offset;
    const perpY = dx / len * offset;

    const controlPoint1 = {
      x: midX + perpX,
      y: source.y + perpY + Math.abs(offset) * 0.5
    };
    const controlPoint2 = {
      x: midX + perpX,
      y: target.y + perpY - Math.abs(offset) * 0.5
    };

    return (
      <g key={`line-${conn.id}`}>
        {/* Visual Connection line */}
        <path
          d={`M ${source.x} ${source.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${target.x} ${target.y}`}
          stroke={isCompatible ? color : '#ef4444'}
          strokeWidth={3}
          fill="none"
          strokeDasharray={isCompatible ? 'none' : '6,3'}
          className="pointer-events-none"
        />

        {/* Animated data flow - only for compatible cables */}
        {conn.active && isCompatible && (
          <>
            <circle r="4" fill={color}>
              <animateMotion
                dur="2s"
                repeatCount="indefinite"
                path={`M ${source.x} ${source.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${target.x} ${target.y}`}
              />
            </circle>
            <circle r="4" fill={color}>
              <animateMotion
                dur="2s"
                repeatCount="indefinite"
                begin="1s"
                path={`M ${target.x} ${target.y} C ${controlPoint2.x} ${controlPoint2.y}, ${controlPoint1.x} ${controlPoint1.y}, ${source.x} ${source.y}`}
              />
            </circle>
          </>
        )}
        {/* Connection label */}
        {totalSameConns > 1 ? (
          <>
            <text
              x={midX + perpX}
              y={midY + perpY - 8}
              fill="none"
              stroke={isDark ? '#0f172a' : '#ffffff'}
              strokeWidth="4"
              strokeLinejoin="round"
              fontSize="10"
              textAnchor="middle"
              className="pointer-events-none select-none"
            >
              {conn.sourcePort} ↔ {conn.targetPort}
            </text>
            <text
              x={midX + perpX}
              y={midY + perpY - 8}
              fill={color}
              fontSize="10"
              textAnchor="middle"
              className="pointer-events-none select-none"
            >
              {conn.sourcePort} ↔ {conn.targetPort}
            </text>
          </>
        ) : (
          <>
            <text
              x={midX}
              y={midY - 10}
              fill="none"
              stroke={isDark ? '#0f172a' : '#ffffff'}
              strokeWidth="4"
              strokeLinejoin="round"
              fontSize="10"
              textAnchor="middle"
              className="pointer-events-none select-none"
            >
              {conn.sourcePort} ↔ {conn.targetPort}
            </text>
            <text
              x={midX}
              y={midY - 10}
              fill={color}
              fontSize="10"
              textAnchor="middle"
              className="pointer-events-none select-none"
            >
              {conn.sourcePort} ↔ {conn.targetPort}
            </text>
          </>
        )}
      </g>
    );
  };

  // Render connection interaction handles (Trash Icon) - Should be rendered LAST to stay on top
  const renderConnectionHandle = (conn: CanvasConnection) => {
    const sourceDevice = devices.find((d) => d.id === conn.sourceDeviceId);
    const targetDevice = devices.find((d) => d.id === conn.targetDeviceId);
    if (!sourceDevice || !targetDevice) return null;

    const source = getPortPosition(sourceDevice, conn.sourcePort);
    const target = getPortPosition(targetDevice, conn.targetPort);

    const sameDeviceConnections = connections.filter(
      c => (c.sourceDeviceId === conn.sourceDeviceId && c.targetDeviceId === conn.targetDeviceId) ||
        (c.sourceDeviceId === conn.targetDeviceId && c.targetDeviceId === conn.sourceDeviceId)
    );
    const sameConnIndex = sameDeviceConnections.findIndex(c => c.id === conn.id);
    const totalSameConns = sameDeviceConnections.length;

    const offset = totalSameConns > 1
      ? (sameConnIndex - (totalSameConns - 1) / 2) * (20 / Math.max(totalSameConns - 1, 1))
      : 0;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const midX = (source.x + target.x) / 2;
    const perpX = -dy / len * offset;
    const perpY = dx / len * offset;

    const controlPoint1 = {
      x: midX + perpX,
      y: source.y + perpY + Math.abs(offset) * 0.5
    };
    const controlPoint2 = {
      x: midX + perpX,
      y: target.y + perpY - Math.abs(offset) * 0.5
    };

    // Position trash icon in the center of the connection
    const tTrash = 0.5;
    const invT = 1 - tTrash;
    const trashX = invT * invT * invT * source.x +
      3 * invT * invT * tTrash * controlPoint1.x +
      3 * invT * tTrash * tTrash * controlPoint2.x +
      tTrash * tTrash * tTrash * target.x;
    const trashY = invT * invT * invT * source.y +
      3 * invT * invT * tTrash * controlPoint1.y +
      3 * invT * tTrash * tTrash * controlPoint2.y +
      tTrash * tTrash * tTrash * target.y;

    const isCompatible = isCableCompatible({
      connected: true,
      cableType: conn.cableType,
      sourceDevice: sourceDevice.type === 'router' ? 'switch' : sourceDevice.type,
      targetDevice: targetDevice.type === 'router' ? 'switch' : targetDevice.type,
      sourcePort: conn.sourcePort,
      targetPort: conn.targetPort,
    });

    return (
      <g key={`handle-${conn.id}`}>
        {/* Larger Hit Area */}
        <path
          d={`M ${source.x} ${source.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${target.x} ${target.y}`}
          stroke="transparent"
          strokeWidth={22}
          fill="none"
          className="cursor-pointer"
          onClick={() => deleteConnection(conn.id)}
        />

        {/* Delete Handle (Trash Icon) */}
        {isCompatible && (
          <g
            transform={`translate(${trashX}, ${trashY})`}
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              deleteConnection(conn.id);
            }}
          >
            <rect x="-8" y="-8" width="15" height="15" rx="5" fill={isDark ? '#0f172a' : '#ffffff'} opacity="0.92" className="drop-shadow-sm" />
            <Trash2 className="w-4 h-4 text-red-500" width={15} height={15} style={{ transform: 'translate(-8px, -8px)' }} />
          </g>
        )}

        {/* Warning Icon if incompatible */}
        {!isCompatible && (
          <g
            transform={`translate(${midX + perpX}, ${(source.y + target.y) / 2 + perpY})`}
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              deleteConnection(conn.id);
            }}
          >
            <path d="M 0 -9 L -10 7 L 10 7 Z" fill="#ef4444" stroke="#fff" strokeWidth="1" />
            <text y="4" fontSize="10" fontStyle="normal" fontWeight="bold" fill="white" textAnchor="middle">!</text>
          </g>
        )}
      </g>
    );
  };

  // Render device
  const renderDevice = (device: CanvasDevice, isDragging: boolean = false) => {
    const isSelected = selectedDeviceIds.includes(device.id);
    // Check if device has any connections
    const deviceConnections = connections.filter(c => c.sourceDeviceId === device.id || c.targetDeviceId === device.id);
    const hasConnection = deviceConnections.length > 0;
    const hasError = deviceConnections.some(conn => {
      const source = devices.find(d => d.id === conn.sourceDeviceId);
      const target = devices.find(d => d.id === conn.targetDeviceId);
      if (!source || !target) return false;
      return !isCableCompatible({
        connected: true,
        cableType: conn.cableType,
        sourceDevice: source.type === 'router' ? 'switch' : source.type,
        targetDevice: target.type === 'router' ? 'switch' : target.type,
        sourcePort: conn.sourcePort,
        targetPort: conn.targetPort,
      });
    });

    const isPoweredOff = device.status === 'offline';
    const statusColor = isPoweredOff
      ? (isDark ? 'fill-red-500' : 'fill-red-600')
      : hasError
        ? (isDark ? 'fill-red-500' : 'fill-red-600')
        : (hasConnection ? (isDark ? 'fill-green-500' : 'fill-green-600') : (isDark ? 'fill-slate-800' : 'fill-slate-300'));

    const deviceFill = isDark
      ? (device.type === 'pc'
        ? 'url(#pcGradientDark)'
        : device.type === 'switch'
          ? 'url(#switchGradientDark)'
          : 'url(#routerGradientDark)')
      : (device.type === 'pc'
        ? 'url(#pcGradientLight)'
        : device.type === 'switch'
          ? 'url(#switchGradientLight)'
          : 'url(#routerGradientLight)');

    // Calculate device height based on number of ports (8 per row for switch/router)
    const portsPerRow = device.type === 'pc' ? 2 : 8;
    const numRows = Math.ceil(device.ports.length / portsPerRow);
    const deviceHeight = device.type === 'pc' ? 85 : 80 + numRows * 14 + 5;

    // Calculate device width to fit all ports with proper spacing
    // For switch/router: startX=12, portSpacing=13, portRadius=6
    // Width needed = startX + (portsPerRow - 1) * portSpacing + portRadius + margin
    // For 8 ports: 12 + 7*13 + 6 + 10 = 119, so we use 130 for more breathing room
    const deviceWidth = device.type === 'pc' ? 90 : device.type === 'router' ? 90 : 130;
    const iconColor = isPoweredOff
      ? '#ef4444'
      : (hasConnection
        ? '#22c55e'
        : (device.type === 'pc' ? '#3b82f6' : device.type === 'switch' ? '#14b8a6' : '#a855f7'));

    return (
      <g
        key={device.id}
        transform={`translate(${device.x}, ${device.y})`}
        className={`cursor-move ${isDragging ? 'opacity-80' : ''}`}
        data-device-id={device.id}
      >
        {/* Selection glow effect */}
        {isSelected && (
          <rect
            x="-4"
            y="-4"
            width={deviceWidth + 8}
            height={deviceHeight + 8}
            rx={10}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3"
            opacity="0.4"
            className="animate-pulse"
          />
        )}

        {/* Device body */}
        <rect
          width={deviceWidth}
          height={deviceHeight}
          rx={8}
          fill={deviceFill}
          stroke={isSelected ? '#06b6d4' : isDark
            ? (device.type === 'pc' ? '#3b82f6' : device.type === 'switch' ? '#22c55e' : '#a855f7')
            : '#cbd5e1'}
          strokeWidth={isSelected ? 2.5 : 1.5}
          className={isDragging ? '' : 'transition-all duration-150'}
        />
        {/* Device body highlight for 3D effect in dark mode */}
        {isDark && (
          <rect
            x={2}
            y={2}
            width={deviceWidth - 4}
            height={deviceHeight / 3}
            rx={6}
            fill="white"
            opacity="0.08"
          />
        )}

        {/* WiFi Status Icon */}
        {(() => {
          const wlanPort = device.ports.find(p => p.id === 'wlan0');
          const pcWifi = device.wifi;
          const isPC = device.type === 'pc';
          const isSwitch = device.type === 'switch';
          const isRouter = device.type === 'router';
          const devState = deviceStates?.get(device.id);
          const wlanState = devState?.ports['wlan0'];

          let wifiColor = '#94a3b8'; // Grey (Off)
          const showWifi = isPC || isSwitch || isRouter;

          // Check if WiFi is enabled
          let isEnabled = false;
          if (isPC) {
            isEnabled = pcWifi?.enabled || (wlanState ? (wlanState.wifi?.mode !== 'disabled') : false);
          } else if (isSwitch || isRouter) {
            // Enhanced check for switch/router even if port is not in visual ports list
            isEnabled = wlanState ? (wlanState.wifi?.mode !== 'ap' && wlanState.wifi?.mode !== 'client' ? false : !wlanState.shutdown) : (wlanPort ? !wlanPort.shutdown : false);
          }

          if (showWifi) {
            let isConnected = false;

            if (!isEnabled || device.status === 'offline') {
              wifiColor = isDark ? '#475569' : '#94a3b8'; // Grey
            } else {
              if (isPC && deviceStates) {
                // PC: check if SSID matches an active AP wlan0 on another device
                const pcSsid = pcWifi?.ssid || wlanState?.wifi?.ssid || '';
                const pcPass = pcWifi?.password || wlanState?.wifi?.password || '';
                const pcSecurity = pcWifi?.security || wlanState?.wifi?.security || 'open';
                const pcBssid = pcWifi?.bssid;
                if (pcSsid) {
                  deviceStates.forEach((state, stateId) => {
                    if (stateId === device.id) return;
                    const apWlan = state.ports['wlan0'];
                    if (!apWlan || apWlan.shutdown || apWlan.wifi?.mode !== 'ap') return;
                    if (pcBssid && pcBssid !== stateId) return; // Must match specific bssid if set
                    if (apWlan.wifi?.ssid !== pcSsid) return;
                    const apSecurity = apWlan.wifi?.security || 'open';
                    if (apSecurity !== pcSecurity) return;
                    if (apSecurity !== 'open' && apWlan.wifi?.password !== pcPass) return;
                    isConnected = true;
                  });
                }
              } else if ((isSwitch || isRouter) && deviceStates) {
                // Switch acting as AP: check if any PC is associated to this device
                const apSsid = wlanState?.wifi?.ssid || '';
                const apPass = wlanState?.wifi?.password || '';
                const apSecurity = wlanState?.wifi?.security || 'open';
                if (apSsid && wlanState?.wifi?.mode === 'ap') {
                  devices.forEach(otherDev => {
                    if (otherDev.id === device.id || otherDev.type !== 'pc') return;
                    const pcwifi = otherDev.wifi;
                    const otherState = deviceStates.get(otherDev.id);
                    const otherWlan = otherState?.ports['wlan0'];
                    const clientSsid = pcwifi?.ssid || otherWlan?.wifi?.ssid || '';
                    const clientPass = pcwifi?.password || otherWlan?.wifi?.password || '';
                    const clientSecurity = pcwifi?.security || otherWlan?.wifi?.security || 'open';
                    const clientBssid = pcwifi?.bssid;
                    if ((!clientBssid || clientBssid === device.id) && clientSsid === apSsid && clientSecurity === apSecurity && (apSecurity === 'open' || apPass === clientPass)) {
                      isConnected = true;
                    }
                  });
                }
              }
              wifiColor = isConnected ? '#22c55e' : '#f59e0b'; // Green or Orange
            }

            // Prepare WiFi info for tooltip
            let wifiSsid = '';
            let wifiSecurity = 'open';
            let wifiMode = 'disabled';
            let wifiChannel = '';
            let connectedDevices = 0;

            if (isPC) {
              wifiSsid = pcWifi?.ssid || wlanState?.wifi?.ssid || '';
              wifiSecurity = pcWifi?.security || wlanState?.wifi?.security || 'open';
              wifiMode = wlanState?.wifi?.mode || (pcWifi?.enabled ? 'client' : 'disabled');
              wifiChannel = wlanState?.wifi?.channel?.toString() || '';
            } else if (isSwitch || isRouter) {
              wifiSsid = wlanState?.wifi?.ssid || '';
              wifiSecurity = wlanState?.wifi?.security || 'open';
              wifiMode = wlanState?.wifi?.mode || 'disabled';
              wifiChannel = wlanState?.wifi?.channel?.toString() || '';

              // Count connected devices
              if (wifiMode === 'ap' && deviceStates) {
                devices.forEach(otherDev => {
                  if (otherDev.id === device.id || otherDev.type !== 'pc') return;
                  const pcwifi = otherDev.wifi;
                  const otherWlan = deviceStates.get(otherDev.id)?.ports['wlan0'];
                  const clientSsid = pcwifi?.ssid || otherWlan?.wifi?.ssid || '';
                  const clientSecurity = pcwifi?.security || otherWlan?.wifi?.security || 'open';
                  if (clientSsid === wifiSsid && clientSecurity === wifiSecurity) {
                    connectedDevices++;
                  }
                });
              }
            }

            const getStatusText = () => {
              if (device.status === 'offline') return language === 'tr' ? 'Cihaz Kapalı' : 'Device Off';
              if (!isEnabled) return language === 'tr' ? 'WiFi Kapalı' : 'WiFi Off';
              if (isConnected) return language === 'tr' ? 'Bağlı' : 'Connected';
              return language === 'tr' ? 'Açık (Bağlı Değil)' : 'On (Not Connected)';
            };

            const getModeText = () => {
              if (wifiMode === 'ap') return language === 'tr' ? 'Erişim Noktası (AP)' : 'Access Point (AP)';
              if (wifiMode === 'client') return language === 'tr' ? 'İstemci (STA)' : 'Client (STA)';
              return language === 'tr' ? 'Kapalı' : 'Disabled';
            };

            const getSecurityText = () => {
              if (wifiSecurity === 'wpa3') return 'WPA3';
              if (wifiSecurity === 'wpa2') return 'WPA2';
              if (wifiSecurity === 'wpa') return 'WPA';
              return language === 'tr' ? 'Açık' : 'Open';
            };

            const getStatusColor = () => {
              if (device.status === 'offline' || !isEnabled) return 'text-red-500';
              if (isConnected) return 'text-green-500';
              return 'text-orange-500';
            };

            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <g transform="translate(2, 0) scale(0.9)" filter="url(#wifiIconShadow)" style={{ cursor: 'pointer' }}>
                    {/* Invisible rect for easier hover */}
                    <rect x="0" y="5" width="24" height="20" fill="transparent" />
                    <path
                      d="M5 10.55a11 11 0 0 1 14.08 0"
                      stroke={wifiColor}
                      fill="none"
                      strokeWidth="1"
                      strokeLinecap="round"
                      className="transition-colors duration-300"
                    />
                    <path
                      d="M8.53 13.11a6 6 0 0 1 6.95 0"
                      stroke={wifiColor}
                      fill="none"
                      strokeWidth="1"
                      strokeLinecap="round"
                      className="transition-colors duration-300"
                    />
                    <circle
                      cx="12"
                      cy="16"
                      r="1"
                      fill={wifiColor}
                      className="transition-colors duration-300"
                    />
                  </g>
                </TooltipTrigger>
                <TooltipContent
                  hideArrow
                  className="p-0 bg-transparent border-none shadow-none"
                  sideOffset={8}
                >
                  <div
                    className={`relative px-3 py-2 rounded-xl shadow-2xl border backdrop-blur-md ${isDark
                      ? 'bg-slate-900/90 border-slate-700 text-white shadow-cyan-500/10'
                      : 'bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/50'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${device.status === 'offline' || !isEnabled
                        ? 'bg-red-500'
                        : isConnected
                          ? 'bg-green-500'
                          : 'bg-orange-500'
                        }`} />
                      <span className="text-[10px] font-black tracking-widest opacity-60">
                        WIFI
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold">
                        {language === 'tr' ? 'Durum:' : 'Status:'}{' '}
                        <span className={getStatusColor()}>
                          {getStatusText()}
                        </span>
                      </div>
                      {wifiSsid && (
                        <div className="text-xs font-bold">
                          SSID:{' '}
                          <span className="text-cyan-500">{wifiSsid}</span>
                        </div>
                      )}
                      <div className="text-xs font-bold">
                        {language === 'tr' ? 'Mod:' : 'Mode:'}{' '}
                        <span>{getModeText()}</span>
                      </div>
                      {wifiMode !== 'disabled' && (
                        <>
                          <div className="text-xs font-bold">
                            {language === 'tr' ? 'Güvenlik:' : 'Security:'}{' '}
                            <span>{getSecurityText()}</span>
                          </div>
                          {wifiChannel && (
                            <div className="text-xs font-bold">
                              {language === 'tr' ? 'Kanal:' : 'Channel:'}{' '}
                              <span>{wifiChannel}</span>
                            </div>
                          )}
                          {wifiMode === 'ap' && (
                            <div className="text-xs font-bold">
                              {language === 'tr' ? 'Bağlı:' : 'Connected:'}{' '}
                              <span className="text-cyan-500">{connectedDevices}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] ${isDark ? 'border-t-slate-800' : 'border-t-white'
                      }`} />
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          }
          return null;
        })()}

        {/* PC monitor stand */}
        {device.type === 'pc' && (
          <>
            <rect
              x={deviceWidth / 2 - 3}
              y={deviceHeight + 1}
              width={6}
              height={5}
              rx={2}
              fill={isDark ? '#334155' : '#94a3b8'}
            />
            <rect
              x={deviceWidth / 2 - 15}
              y={deviceHeight + 6}
              width={30}
              height={4}
              rx={2}
              fill={isDark ? '#475569' : '#cbd5e1'}
            />
          </>
        )}

        {/* Device icon */}
        <g transform={`translate(${deviceWidth / 2 - 12}, 10)`}>
          <g style={{ color: iconColor }}>
            {device.type === 'pc' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                stroke={isDark ? '#60a5fa' : '#3b82f6'}
                fill="none"
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z"
                transform="scale(1.2)"
              />
            )}
            {device.type === 'switch' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                stroke={isDark ? '#14b8a6' : '#0d9488'}
                fill="none"
                d="M5 12h14M5 12a2 2 0 0 1 -2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2M5 12a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 -2-2m-2-4h.01M17 16h.01"
                transform="scale(1.2)"
              />
            )}
            {device.type === 'router' && (
              <g transform="scale(1.2)">
                <circle cx="12" cy="12" r="9" strokeWidth={2} stroke={isDark ? '#c084fc' : '#a855f7'} fill="none" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke={isDark ? '#c084fc' : '#a855f7'} fill="none" d="M12 5v14M5 12h14M12 5l-2 2m2-2l2 2m-2 12l-2-2m2 2l2-2M5 12l2-2m-2 2l2 2M19 12l-2-2m2 2l-2 2" />
              </g>
            )}
          </g>
        </g>

        {/* Status LED */}
        <circle cx={deviceWidth - 10} cy={10} r={5} className={`${statusColor} transition-colors duration-300`} />

        {/* Device name */}
        <text x={deviceWidth / 2} y={58} fill={isDark ? '#f1f5f9' : '#1e293b'} fontSize="10" textAnchor="middle" fontWeight="bold" className="select-none pointer-events-none">
          {device.name}
        </text>

        {/* Device IP */}
        {device.type === 'pc' && (
          <text x={deviceWidth / 2} y={70} fill={isDark ? '#94a3b8' : '#64748b'} fontSize="10" textAnchor="middle" fontFamily="monospace" className="select-none pointer-events-none">
            {device.ip}
          </text>
        )}

        {/* Device VLAN */}
        {device.type === 'pc' && (
          <text x={deviceWidth / 2} y={81} fill={isDark ? '#38bdf8' : '#0f766e'} fontSize="9" textAnchor="middle" fontFamily="monospace" className="select-none pointer-events-none">
            VLAN {String(getLiveDeviceVlan(device))}
          </text>
        )}

        {/* Ports - wrapped 6 per row */}
        {device.type === 'pc' ? (
          // PC has Eth0 and COM1 ports, show side by side
          device.ports.map((port, idx) => {
            // İki portu yan yana göster
            const portSpacing = 18;
            const portX = deviceWidth - 8;
            const startY = deviceHeight / 2 - ((device.ports.length - 1) * portSpacing) / 2;
            const portY = startY + idx * portSpacing;
            const isConnected = port.status === 'connected';
            const isShutdown = port.shutdown;
            const isDeviceOffline = device.status === 'offline';

            // Determine port label: E for Ethernet, C for COM/Console
            const portLabel = port.id.toLowerCase().startsWith('com') ? 'C' : 'E';

            // Port colors:
            // PC Ethernet: Blue, PC COM (Console): Turquoise
            // Shutdown or device offline: Red
            const portColor = (isShutdown || isDeviceOffline) ? '#ef4444' :
              port.id.toLowerCase().startsWith('com')
                ? (isConnected ? '#06b6d4' : '#0891b2')  // Turquoise for console
                : (isConnected ? '#3b82f6' : '#1d4ed8'); // Blue for ethernet

            return (
              <g
                key={port.id}
                transform={`translate(${portX}, ${portY})`}
                className="cursor-pointer"
                onClick={(e) => {
                  handlePortClick(e as unknown as ReactMouseEvent, device.id, port.id);
                }}
                onMouseEnter={(e) => handlePortHover(e, device.id, port.id)}
                onMouseLeave={handlePortMouseLeave}
              >
                {/* Larger invisible hitbox for easier clicking */}
                <circle
                  r={12}
                  fill="transparent"
                  className="pointer-events-auto"
                />
                {/* Visible port circle */}
                <circle
                  r={7}
                  fill={portColor}
                  stroke={isShutdown || isDeviceOffline ? '#991b1b' : isConnected ? '#22c55e' : '#4b5563'}
                  strokeWidth={isShutdown || isDeviceOffline || isConnected ? 2 : 1}
                  className="pointer-events-none"
                />
                <text y={1} fill="#fff" fontSize="7" textAnchor="middle" dominantBaseline="middle" className="select-none pointer-events-none">
                  {portLabel}
                </text>
              </g>
            );
          })
        ) : (
          // Switch/Router - wrap 8 ports per row for wider device
          (device.type === 'router' ? device.ports.filter(p => p.id !== 'wlan0') : device.ports).map((port, idx) => {
            const portsPerRow = 8;
            const col = idx % portsPerRow;
            const row = Math.floor(idx / portsPerRow);
            // Adjust port spacing for wider device (130px)
            const portSpacing = 14;
            const rowSpacing = 14;
            const startX = 14;
            const startY = 80;
            const portX = startX + col * portSpacing;
            const portY = startY + row * rowSpacing;
            const isConnected = port.status === 'connected';
            const isShutdown = port.shutdown;
            const isDeviceOffline = device.status === 'offline';

            // Determine port type
            const portId = port.id.toLowerCase();
            const isConsole = portId === 'console';
            const isGigabit = portId.startsWith('gi'); // GigabitEthernet
            const isFastEthernet = portId.startsWith('fa'); // FastEthernet

            // Extract port number - remove leading zeros
            const portNum = port.label.replace(/\D/g, '');
            const displayNum = isConsole ? 'C' : (portNum ? parseInt(portNum, 10).toString() : 'C');

            // Port colors:
            // Console: Turquoise, Fa: Blue, Gi: Orange
            // Shutdown or device offline: Red
            // Not connected: Gray
            let portFill: string;
            let portStroke: string;

            if (isShutdown || isDeviceOffline) {
              // Güç kapalı - içi kırmızı, çerçeve gri
              portFill = '#ef4444';
              portStroke = '#4b5563';
            } else if (isConnected) {
              // Güç açık ve bağlı - içi mavi, çerçeve açık mavi
              if (isConsole) {
                portFill = '#06b6d4';
                portStroke = '#67e8f9';
              } else if (isGigabit) {
                portFill = '#f97316';
                portStroke = '#fdba74';
              } else if (isFastEthernet) {
                portFill = '#3b82f6';
                portStroke = '#60a5fa';
              } else {
                portFill = '#3b82f6';
                portStroke = '#60a5fa';
              }
            } else {
              // Güç açık ama bağlı değil - içi mavi, çerçeve gri
              if (isConsole) {
                portFill = '#06b6d4';
                portStroke = '#4b5563';
              } else if (isGigabit) {
                portFill = '#f97316';
                portStroke = '#4b5563';
              } else if (isFastEthernet) {
                portFill = '#3b82f6';
                portStroke = '#4b5563';
              } else {
                portFill = '#3b82f6';
                portStroke = '#4b5563';
              }
            }

            return (
              <g
                key={port.id}
                transform={`translate(${portX}, ${portY})`}
                className="cursor-pointer"
                onClick={(e) => {
                  handlePortClick(e as unknown as ReactMouseEvent, device.id, port.id);
                }}
                onMouseEnter={(e) => handlePortHover(e, device.id, port.id)}
                onMouseLeave={handlePortMouseLeave}
              >
                {/* Larger invisible hitbox for easier clicking */}
                <circle
                  r={10}
                  fill="transparent"
                  className="pointer-events-auto"
                />
                {/* Visible port circle */}
                <circle
                  r={6}
                  fill={portFill}
                  stroke={isShutdown || isDeviceOffline || isConnected ? portStroke : '#4b5563'}
                  strokeWidth={isShutdown || isDeviceOffline || isConnected ? 2 : 1}
                  className="pointer-events-none"
                />
                <text y={1} fill="#fff" fontSize="6" textAnchor="middle" dominantBaseline="middle" className="select-none pointer-events-none">
                  {displayNum}
                </text>
              </g>
            );
          })
        )}
      </g>
    );
  };

  // Render temporary connection line while drawing
  const renderTempConnection = () => {
    if (!isDrawingConnection || !connectionStart) return null;

    // Use the port position stored in connectionStart.point
    const source = connectionStart.point;
    const sourceDevice = devices.find(d => d.ports.some(p => p.id === connectionStart.portId));

    return (
      <>
        {/* Kablo takarken arka plan overlay */}
        <rect
          x={-10000}
          y={-10000}
          width={20000}
          height={20000}
          fill="rgba(0,0,0,0.1)"
          className="pointer-events-none"
        />

        {/* Connection line with gradient */}
        <line
          x1={source.x}
          y1={source.y}
          x2={mousePos.x}
          y2={mousePos.y}
          stroke={CABLE_COLORS[cableInfo.cableType].primary}
          strokeWidth={4}
          strokeDasharray="8,4"
          strokeLinecap="round"
          opacity="0.8"
          className="pointer-events-none"
        >
          <animate attributeName="stroke-dashoffset" from="12" to="0" dur="1s" repeatCount="indefinite" />
        </line>
        {/* Inner solid line */}
        <line
          x1={source.x}
          y1={source.y}
          x2={mousePos.x}
          y2={mousePos.y}
          stroke={CABLE_COLORS[cableInfo.cableType].primary}
          strokeWidth={2}
          opacity="1"
          className="pointer-events-none"
        />

        {/* Source port highlight */}
        <circle
          cx={source.x}
          cy={source.y}
          r={12}
          fill={CABLE_COLORS[cableInfo.cableType].primary}
          opacity="0.15"
          className="pointer-events-none"
        >
          <animate attributeName="r" values="12;16;12" dur="1.5s" repeatCount="indefinite" />
        </circle>

        {/* End point circle */}
        <circle
          cx={mousePos.x}
          cy={mousePos.y}
          r={8}
          fill={CABLE_COLORS[cableInfo.cableType].primary}
          opacity="0.4"
          className="pointer-events-none"
        >
          <animate attributeName="r" values="8;10;8" dur="1.5s" repeatCount="indefinite" />
        </circle>

        {/* Kablo tipi göstergesi */}
        <g transform={`translate(${(source.x + mousePos.x) / 2}, ${(source.y + mousePos.y) / 2 - 20})`}>
          <rect
            x={-35}
            y={-12}
            width={70}
            height={24}
            rx={8}
            fill={CABLE_COLORS[cableInfo.cableType].primary}
            opacity="0.9"
            className="pointer-events-none"
          />
          <text
            x={0}
            y={4}
            fill="white"
            fontSize="11"
            fontWeight="bold"
            textAnchor="middle"
            className="select-none pointer-events-none"
          >
            {cableInfo.cableType === 'straight' ? 'Düz' : cableInfo.cableType === 'crossover' ? 'Çapraz' : 'Konsol'}
          </text>
        </g>
      </>
    );
  };

  // Render Mobile Bottom Sheet
  const renderMobilePalette = () => (
    <div
      className={`fixed inset-0 z-50 transition-all duration-300 md:hidden ${isPaletteOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isPaletteOpen ? 'opacity-100' : 'opacity-0'
          }`}
        onClick={() => setIsPaletteOpen(false)}
      />

      {/* Bottom Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-2xl transition-transform duration-300 ${isPaletteOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-slate-600" />
        </div>
        {/* Device Buttons */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800/50">
          <div className={`text-[10px] font-bold tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'} whitespace-nowrap`}>
            {t.devices}
          </div>
          <div className="flex gap-2">
            {(['pc', 'switch', 'router'] as const).map((type) => (
              <button
                key={type}
                onClick={() => { addDevice(type); setIsPaletteOpen(false); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${isDark
                  ? 'border-slate-700 bg-slate-800'
                  : 'border-slate-300 bg-white'
                  }`}
              >
                <div className={
                  type === 'pc' ? 'text-blue-500' : type === 'switch' ? 'text-green-500' : 'text-purple-500'
                }>
                  {DEVICE_ICONS[type]}
                </div>
                <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {type === 'pc' ? t.addPcShort : type === 'switch' ? t.addSwitchShort : t.addRouterShort}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Cable Type Selector - Grouped */}
        <div className="px-4 py-3">
          <div className={`text-[10px] font-bold tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t.cable}
          </div>
          <div className={`flex gap-1.5 p-2 rounded-xl border ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
            {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
              <button
                key={type}
                onClick={() => {
                  onCableChange({ ...cableInfo, cableType: type });

                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all flex-1 justify-center ${cableInfo.cableType === type
                  ? `${CABLE_COLORS[type].bg} text-white border-transparent`
                  : isDark
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${CABLE_COLORS[type].bg}`} />
                {type === 'straight' ? t.straight : type === 'crossover' ? t.crossover : t.console}
              </button>
            ))}
          </div>
        </div>

        {/* Safe Area Padding */}
        <div className="h-6" />
      </div>
    </div>
  );

  // Render Mobile Bottom Action Bar
  const renderMobileBottomBar = () => (
    <div className="md:hidden fixed bottom-14 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 px-2 py-2 safe-area-bottom">
      <div className="flex items-center justify-around gap-1">
        {/* Add Device */}
        <button
          onClick={() => setIsPaletteOpen(true)}
          className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg min-h-[48px] min-w-[48px] bg-slate-800 hover:bg-slate-700"
        >
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-xs text-slate-300">{t.add}</span>
        </button>

        {/* Cable Type */}
        <button
          onClick={() => setIsPaletteOpen(true)}
          className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg min-h-[48px] min-w-[48px] bg-slate-800 hover:bg-slate-700"
        >
          <div className={`w-4 h-4 rounded ${CABLE_COLORS[cableInfo.cableType].bg}`} />
          <span className="text-xs text-slate-300">
            {cableInfo.cableType === 'straight' ? t.straight : cableInfo.cableType === 'crossover' ? t.crossover : t.console}
          </span>
        </button>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setZoom((z) => {
              const newZoom = Math.max(MIN_ZOOM, z - 0.25);
              if (!canvasRef.current) return newZoom;
              const rect = canvasRef.current.getBoundingClientRect();
              const cursorX = rect.width / 2;
              const cursorY = rect.height / 2;
              setPan(prevPan => ({
                x: cursorX - (cursorX - prevPan.x) * (newZoom / z),
                y: cursorY - (cursorY - prevPan.y) * (newZoom / z)
              }));
              return newZoom;
            })}
            className="flex items-center justify-center w-10 h-10 rounded hover:bg-slate-700 text-slate-300"
          >
            −
          </button>
          <span className="text-xs font-mono w-10 text-center text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => {
              const newZoom = Math.min(MAX_ZOOM, z + 0.25);
              if (!canvasRef.current) return newZoom;
              const rect = canvasRef.current.getBoundingClientRect();
              const cursorX = rect.width / 2;
              const cursorY = rect.height / 2;
              setPan(prevPan => ({
                x: cursorX - (cursorX - prevPan.x) * (newZoom / z),
                y: cursorY - (cursorY - prevPan.y) * (newZoom / z)
              }));
              return newZoom;
            })}
            className="flex items-center justify-center w-10 h-10 rounded hover:bg-slate-700 text-slate-300"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={`${isFullscreen ? 'fixed inset-[20px] z-[9999] rounded-2xl shadow-2xl overflow-hidden' : 'relative m-2.5 rounded-2xl border overflow-hidden h-full'} flex flex-col transition-all duration-300 ${isDark
        ? 'bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90 border-slate-700/50'
        : 'bg-gradient-to-br from-blue-50/50 via-white to-slate-50/80 border-slate-200'
        }`}
    >
      {/* Header with Tools */}
      <div
        className={`px-4 py-0 border-b shrink-0 ${isDark ? 'border-slate-700/50 bg-slate-800/80' : 'border-slate-200/50 bg-white/80'} backdrop-blur-md sticky top-0 z-40`}
      >
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <span className="hidden">{language === 'tr' ? 'Ağ Topolojisi' : 'Network Topology'}</span>
            </h3>

            {/* MD/LG Screen Quick Tools */}
            <div className="hidden md:flex items-center ">
              <div className={`flex items-center gap-2 p-1 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-700/30' : 'bg-blue-50/50 border-blue-100/50'}`}>
                {/* Devices Group */}
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => addDevice('pc')}
                        className={`p-1.5 rounded-lg ui-hover-surface ${isDark ? 'text-blue-500 hover:text-blue-400' : 'text-blue-600 hover:text-blue-700'}`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z" />
                        </svg>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{language === 'tr' ? 'PC Ekle' : 'Add PC'}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => addDevice('switch')}
                        className={`p-1.5 rounded-lg ui-hover-surface ${isDark ? 'text-emerald-500 hover:text-emerald-400' : 'text-emerald-600 hover:text-emerald-700'}`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 0 1 -2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2M5 12a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 -2-2m-2-4h.01M17 16h.01" />
                        </svg>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{language === 'tr' ? 'Switch Ekle' : 'Add Switch'}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => addDevice('router')}
                        className={`p-1.5 rounded-lg ui-hover-surface ${isDark ? 'text-purple-500 hover:text-purple-400' : 'text-purple-600 hover:text-purple-700'}`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="#a855f7" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14M5 12h14M12 5l-2 2m2-2l2 2m-2 12l-2-2m2 2l2-2M5 12l2-2m-2 2l2 2M19 12l-2-2m2 2l-2 2" />
                        </svg>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{language === 'tr' ? 'Router Ekle' : 'Add Router'}</TooltipContent>
                  </Tooltip>
                </div>

                {/* Cable Types Group */}
                <div className={`flex p-1 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                  {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
                    <Tooltip key={type}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onCableChange({ ...cableInfo, cableType: type })}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all duration-300 ${cableInfo.cableType === type
                            ? `${CABLE_COLORS[type].bg} text-white shadow-lg shadow-black/10`
                            : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {type === 'straight' ? t.straight : type === 'crossover' ? t.crossover : t.console}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {type === 'straight'
                          ? (language === 'tr' ? 'Düz Kablo' : 'Straight Cable')
                          : type === 'crossover'
                            ? (language === 'tr' ? 'Çapraz Kablo' : 'Crossover Cable')
                            : (language === 'tr' ? 'Konsol Kablosu' : 'Console Cable')}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* Desktop Connect Button */}
            <button
              onClick={() => {
                setShowPortSelector(true);
                setPortSelectorStep('source');
                setSelectedSourcePort(null);
              }}
              className={`cursor-pointer hidden md:flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all ${isDark
                ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 0 0 -5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0 -5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="hidden sm:inline">{language === 'tr' ? 'Cihazları Bağla' : 'Connect Devices'}</span>
              <span className="sm:hidden">{language === 'tr' ? 'Bağla' : 'Connect'}</span>
            </button>

            {/* Add Note Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={addNote}
                  className={`cursor-pointer hidden md:flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all ${isDark
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 0 0 -2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="hidden sm:inline">{language === 'tr' ? 'Not Ekle' : 'Add Note'}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{language === 'tr' ? 'Not Ekle' : 'Add Note'}</TooltipContent>
            </Tooltip>

            {/* Refresh Network Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    // Refresh network by checking all connections and device states
                    if (onRefreshNetwork) {
                      onRefreshNetwork();
                    }
                  }}
                  className={`cursor-pointer hidden md:flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all ${isDark
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">{language === 'tr' ? 'Ağı Yenile' : 'Refresh Network'}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{language === 'tr' ? 'Ağı Yenile' : 'Refresh Network'}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className={`flex-1 relative flex flex-col`}>
          {/* Palette Sheet (Triggered from Top Toolbar) */}
          <Sheet open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
            <SheetContent side="bottom" className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'} rounded-t-[2rem] p-0`}>
              <SheetHeader className="p-6 border-b border-slate-800/50">
                <SheetTitle className="text-lg font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-cyan-500" />
                  {language === 'tr' ? 'Cihaz veya Kablo Ekle' : 'Add Device or Cable'}
                </SheetTitle>
              </SheetHeader>
              <div className="p-6 space-y-8">
                {/* Devices Section */}
                <div className="space-y-4">
                  <p className="text-[10px] font-bold  tracking-widest text-slate-500 ml-1">{t.devices}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(['pc', 'switch', 'router'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => { addDevice(type); setIsPaletteOpen(false); }}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${isDark ? 'bg-slate-800 border-slate-700 active:bg-slate-700' : 'bg-slate-50 border-slate-200 active:bg-slate-100'
                          }`}
                      >
                        <div className={type === 'pc' ? 'text-blue-500' : type === 'switch' ? 'text-green-500' : 'text-purple-500'}>
                          {DEVICE_ICONS[type]}
                        </div>
                        <span className="text-xs font-bold capitalize">
                          {type === 'pc' ? t.addPcShort : type === 'switch' ? t.addSwitchShort : t.addRouterShort}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cables Section - Grouped */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold  tracking-widest text-slate-500 ml-1">{t.cableTypes}</p>
                  <div className={`grid grid-cols-3 gap-2 p-2 rounded-xl border ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                    {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => { onCableChange({ ...cableInfo, cableType: type }); setIsPaletteOpen(false); }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all ${cableInfo.cableType === type
                          ? `${CABLE_COLORS[type].bg} text-white`
                          : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        <div className={`w-4 h-4 rounded-full ${isDark && cableInfo.cableType !== type ? 'bg-slate-600' : ''}`} style={cableInfo.cableType !== type ? { backgroundColor: CABLE_COLORS[type].primary } : {}} />
                        <span className="text-[10px] font-bold capitalize">
                          {type === 'straight' ? t.straight : type === 'crossover' ? t.crossover : t.console}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-4" />
              </div>
            </SheetContent>
          </Sheet>
          {/* Multiple Selection Indicator & Tools */}
          {selectedDeviceIds.length > 1 && (
            <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-4 ${isDark ? 'bg-slate-800/95 text-white border border-slate-700' : 'bg-white text-slate-900 border border-slate-200'
              } backdrop-blur-md`}>
              <div className="flex items-center gap-2 border-r pr-4 border-slate-700/30">
                <span className="text-xs font-bold tracking-wider opacity-60">
                  {language === 'tr' ? 'Hizala' : 'Align'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAlign('left')}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
                    title={language === 'tr' ? 'Sola Hizala' : 'Align Left'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 2v20M8 5h10M8 11h7M8 17h12" />
                    </svg>
                  </button>
                  <div className="w-px h-4 bg-slate-700/30 mx-1" />
                  <button
                    onClick={() => handleAlign('top')}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
                    title={language === 'tr' ? 'Üste Hizala' : 'Align Top'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 4h20M5 8v10M11 8v7M17 8v12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold whitespace-nowrap">
                  {language === 'tr' ? `${selectedDeviceIds.length} Cihaz` : `${selectedDeviceIds.length} Devices`}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      saveToHistory();
                      togglePowerDevices(selectedDeviceIds);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 ${isDark
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/20'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                      }`}
                    title={language === 'tr' ? 'Gücü Aç/Kapat' : 'Toggle Power'}
                  >
                    <Power className="w-4 h-4" />
                    {language === 'tr' ? 'Güç' : 'Power'}
                  </button>
                  <button
                    onClick={() => {
                      const firstId = selectedDeviceIds[0];
                      const firstDevice = devices.find(d => d.id === firstId);
                      setSelectedDeviceIds(firstId ? [firstId] : []);
                      if (firstDevice) onDeviceSelect(firstDevice.type === 'router' ? 'router' : firstDevice.type, firstId);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                  >
                    {language === 'tr' ? 'İptal' : 'Cancel'}
                  </button>
                  <button
                    onClick={() => {
                      saveToHistory();
                      selectedDeviceIds.forEach(id => deleteDevice(id));
                      setSelectedDeviceIds([]);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-xs font-bold transition-all border border-red-500/20"
                  >
                    {language === 'tr' ? 'Sil' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Canvas */}
          <div
            ref={canvasRef}
            className="w-full h-full flex-1 min-h-[500px] overflow-hidden cursor-grab active:cursor-grabbing relative touch-none select-none print:overflow-visible print:h-auto print:min-h-full topology-print-area"
            role="application"
            aria-label={language === 'tr' ? 'Ağ topolojisi tuvali. Cihazları sürükleyerek taşıyabilirsiniz.' : 'Network topology canvas. You can drag devices to move them.'}
            tabIndex={0}
            onMouseDown={handleCanvasMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => {
              canvasRef.current?.focus();
              if (isDrawingConnection) {
                setIsDrawingConnection(false);
                setConnectionStart(null);
              }
            }}
            onContextMenu={(e) => {
              // Show text editing options if editing a note
              const target = e.target as HTMLElement;
              const noteElement = target.closest('[data-note-id]');
              const textareaElement = noteElement?.querySelector('textarea');
              const contentEditableElement = noteElement?.querySelector('[contenteditable]');

              const isEditingNote = textareaElement?.matches(':focus') || contentEditableElement?.matches(':focus');

              if (isEditingNote) {
                e.preventDefault();
                e.stopPropagation();
                // Allow native text editing context menu on mobile/desktop
                // The browser will show copy, cut, paste, select all options
              } else {
                handleContextMenu(e as unknown as ReactMouseEvent);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && selectedDeviceIds.length === 1) {
                const selectedDevice = devices.find(d => d.id === selectedDeviceIds[0]);
                if (selectedDevice) {
                  handleDeviceDoubleClick(selectedDevice);
                }
              }
            }}
          >
            {/* SVG Layer with Grid and Content */}
            <svg
              width="100%"
              height="100%"
              className="block select-none print:w-full print:h-auto print:block"
            >
              <g
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  transition: isPanning ? 'none' : 'transform 0.05s linear',
                }}
              >
                {/* Clip path for canvas boundaries */}
                <defs>
                  <clipPath id="canvasClip">
                    <rect x="0" y="0" width={getCanvasDimensions().width} height={getCanvasDimensions().height} />
                  </clipPath>
                  {/* WiFi Icon Shadow Filter */}
                  <filter id="wifiIconShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0.5" stdDeviation="0.6" floodOpacity={isDark ? "0.8" : "0.4"} />
                  </filter>
                  {/* Canvas background gradient */}
                  <radialGradient id="canvasBgGradient" cx="46%" cy="30%" r="88%">
                    {isDark ? (
                      <>
                        <stop offset="0%" stopColor="#24344d" />
                        <stop offset="28%" stopColor="#1e2c43" />
                        <stop offset="55%" stopColor="#18253a" />
                        <stop offset="78%" stopColor="#142033" />
                        <stop offset="100%" stopColor="#0d1728" />
                      </>
                    ) : (
                      <>
                        <stop offset="0%" stopColor="#fcfdff" />
                        <stop offset="28%" stopColor="#f6faff" />
                        <stop offset="55%" stopColor="#eef4fc" />
                        <stop offset="78%" stopColor="#e7eff9" />
                        <stop offset="100%" stopColor="#dde8f4" />
                      </>
                    )}
                  </radialGradient>
                  {/* Grid pattern with improved visibility */}
                  <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="1.5" fill={isDark ? '#475569' : '#64748b'} opacity="0.6" />
                  </pattern>
                  {/* Major grid lines pattern */}
                  <pattern id="majorGridPattern" width="100" height="100" patternUnits="userSpaceOnUse">
                    <rect width="100" height="100" fill="none" stroke={isDark ? '#334155' : '#cbd5e1'} strokeWidth="0.5" opacity="0.3" />
                  </pattern>
                  {/* Device 3D Gradients for Dark Mode */}
                  <linearGradient id="pcGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="30%" stopColor="#1e40af" />
                    <stop offset="100%" stopColor="#1e3a8a" />
                  </linearGradient>
                  <linearGradient id="switchGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#14b8a6" />
                    <stop offset="30%" stopColor="#0f766e" />
                    <stop offset="100%" stopColor="#115e59" />
                  </linearGradient>
                  <linearGradient id="routerGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="30%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#5b21b6" />
                  </linearGradient>
                  {/* Device 3D Gradients for Light Mode */}
                  <linearGradient id="pcGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#eff6ff" />
                    <stop offset="100%" stopColor="#dbeafe" />
                  </linearGradient>
                  <linearGradient id="switchGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f0fdfa" />
                    <stop offset="100%" stopColor="#ccfbf1" />
                  </linearGradient>
                  <linearGradient id="routerGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f5f3ff" />
                    <stop offset="100%" stopColor="#ede9fe" />
                  </linearGradient>
                </defs>

                {/* Canvas Background with Grid - clipped to boundaries */}
                <g clipPath="url(#canvasClip)">
                  {/* Background */}
                  <rect
                    x="0"
                    y="0"
                    width={getCanvasDimensions().width}
                    height={getCanvasDimensions().height}
                    fill="url(#canvasBgGradient)"
                  />
                  {/* Major Grid Lines (subtle) */}
                  <rect
                    x="0"
                    y="0"
                    width={getCanvasDimensions().width}
                    height={getCanvasDimensions().height}
                    fill="url(#majorGridPattern)"
                  />
                  {/* Grid Dots */}
                  <rect
                    x="0"
                    y="0"
                    width={getCanvasDimensions().width}
                    height={getCanvasDimensions().height}
                    fill="url(#gridPattern)"
                  />

                  {/* Visual Connection Lines (Behind devices) */}
                  {connections.map((conn, index) => {
                    const sourceDevice = devices.find((d) => d.id === conn.sourceDeviceId);
                    const targetDevice = devices.find((d) => d.id === conn.targetDeviceId);
                    if (!sourceDevice || !targetDevice) return null;

                    const sameDeviceConnections = connections.filter(
                      c => (c.sourceDeviceId === conn.sourceDeviceId && c.targetDeviceId === conn.targetDeviceId) ||
                        (c.sourceDeviceId === conn.targetDeviceId && c.targetDeviceId === conn.sourceDeviceId)
                    );
                    const sameConnIndex = sameDeviceConnections.findIndex(c => c.id === conn.id);
                    const totalSameConns = sameDeviceConnections.length;

                    return (
                      <ConnectionLine
                        key={`line-${conn.id}`}
                        connection={conn}
                        sourceDevice={sourceDevice}
                        targetDevice={targetDevice}
                        isDark={isDark}
                        isDragging={isActuallyDragging || isTouchDragging}
                        totalSameConns={totalSameConns}
                        sameConnIndex={sameConnIndex}
                        getPortPosition={getPortPosition}
                        CABLE_COLORS={CABLE_COLORS as any}
                      />
                    );
                  })}

                  {/* Temporary connection line */}
                  {renderTempConnection()}

                  {/* Connection interaction handles (Trash icons) */}
                  {connections.map((conn) => renderConnectionHandle(conn))}

                  {/* Devices */}                  {devicesSortedForRender.map((device) => {
                    const isCurrentlyDragging = (draggedDevice === device.id && isActuallyDragging) ||
                      (touchDraggedDevice === device.id && isTouchDragging);
                    return (
                      <DeviceNode
                        key={device.id}
                        device={device}
                        isSelected={selectedDeviceIds.includes(device.id)}
                        isDragging={isCurrentlyDragging}
                        isActive={activeDeviceId === device.id}
                        isDark={isDark}
                        onMouseDown={(e, id) => handleDeviceMouseDown(e as unknown as ReactMouseEvent, id)}
                        onClick={(e, dev) => handleDeviceClick(e as unknown as ReactMouseEvent, dev)}
                        onDoubleClick={() => handleDeviceDoubleClick(device)}
                        onContextMenu={(e, id) => handleContextMenu(e as unknown as ReactMouseEvent, id)}
                        onTouchStart={(e, id) => handleDeviceTouchStart(e as unknown as ReactTouchEvent, id)}
                        onTouchMove={handleDeviceTouchMove}
                        onTouchEnd={handleDeviceTouchEnd}
                        renderDeviceContent={renderDevice}
                      />
                    );
                  })}

                  {/* Notes */}
                  {notes.map((note) => (
                    <foreignObject
                      key={note.id}
                      x={note.x}
                      y={note.y}
                      width={note.width}
                      height={note.height}
                      data-note-id={note.id}
                      className="pointer-events-none"
                    >
                      <div
                        className={`pointer-events-auto relative flex flex-col w-full h-full overflow-hidden rounded-lg shadow-lg border ${isDark
                          ? 'border-amber-300/60'
                          : 'border-yellow-200'
                          } ${selectedNoteIds.includes(note.id) ? 'ring-2 ring-emerald-400/70' : ''}`}
                        data-note-id={note.id}
                        style={{ backgroundColor: note.color, fontFamily: note.font, opacity: note.opacity }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if ((e as any).shiftKey) {
                            setSelectedNoteIds((prev) => prev.includes(note.id) ? prev.filter(id => id !== note.id) : [...prev, note.id]);
                          } else {
                            setSelectedNoteIds([note.id]);
                            setSelectedDeviceIds([]);
                          }
                        }}
                      >
                        {/* Note Header - Draggable */}
                        <div
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleNoteHeaderMouseDown(e as unknown as ReactMouseEvent, note.id);
                          }}
                          className={`flex items-center gap-2 px-2 text-[10px] font-semibold  tracking-widest cursor-move select-none ${isDark ? 'bg-black/10' : 'bg-black/5'
                            }`}
                          style={{ height: '24px' }}
                        >
                          <div
                            className="flex items-center gap-1"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cycleNoteColor(note.id);
                                  }}
                                  className="w-4 h-4 rounded border border-black/20"
                                  style={{ backgroundColor: note.color }}
                                />
                              </TooltipTrigger>
                              <TooltipContent>{language === 'tr' ? 'Renk' : 'Color'}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cycleNoteFont(note.id);
                                  }}
                                  className="px-1 rounded text-[9px] leading-4 bg-black/10 hover:bg-black/20"
                                >
                                  F
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{language === 'tr' ? 'Yazı Tipi' : 'Font'}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cycleNoteFontSize(note.id);
                                  }}
                                  className="px-1 rounded text-[9px] leading-4 bg-black/10 hover:bg-black/20"
                                >
                                  {note.fontSize}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{language === 'tr' ? 'Boyut' : 'Size'}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cycleNoteOpacity(note.id);
                                  }}
                                  className="px-1 rounded text-[9px] leading-4 bg-black/10 hover:bg-black/20"
                                >
                                  {Math.round(note.opacity * 100)}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{language === 'tr' ? 'Saydamlık' : 'Opacity'}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    duplicateNote(note.id);
                                  }}
                                  className="px-1 rounded text-[9px] leading-4 bg-black/10 hover:bg-black/20"
                                >
                                  D
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{language === 'tr' ? 'Çoğalt' : 'Duplicate'}</TooltipContent>
                            </Tooltip>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNote(note.id);
                                }}
                                className="ml-auto px-1.5 py-0.5 rounded hover:bg-black/10"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1 -1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0 -1-1h-4a1 1 0 0 0 -1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{language === 'tr' ? 'Sil' : 'Delete'}</TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Note Content - Scrollable */}
                        <div
                          data-note-scroll
                          className="flex-1 min-h-0 overflow-hidden"
                          style={{
                            height: `calc(100% - 24px)`,
                            scrollBehavior: 'smooth',
                          }}
                          onWheel={(e) => {
                            // Allow scroll within note without affecting canvas zoom
                            e.stopPropagation();
                          }}
                          onMouseDown={(e) => {
                            // Prevent note content interactions from starting a drag on the note shell
                            e.stopPropagation();
                          }}
                        >
                          <textarea
                            ref={(el) => { noteTextareaRefs.current[note.id] = el; }}
                            value={note.text}
                            onChange={(e) => updateNoteText(note.id, e.target.value)}
                            onSelect={(e) => {
                              setNoteTextSelection({
                                noteId: note.id,
                                start: e.currentTarget.selectionStart ?? 0,
                                end: e.currentTarget.selectionEnd ?? 0,
                              });
                            }}
                            onMouseUp={(e) => {
                              setNoteTextSelection({
                                noteId: note.id,
                                start: e.currentTarget.selectionStart ?? 0,
                                end: e.currentTarget.selectionEnd ?? 0,
                              });
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              // ESC tuşu ile context menu'yü kapat
                              if (e.key === 'Escape' && contextMenu?.noteId === note.id) {
                                setContextMenu(null);
                              }
                            }}
                            onContextMenu={(e) => {
                              e.stopPropagation();
                            }}
                            onBlur={() => {
                              // Textarea'nın dışında tıklanınca context menu'yü kapat
                              if (contextMenu?.noteId === note.id) {
                                setContextMenu(null);
                              }
                              if (onTopologyChange) {
                                onTopologyChange(devices, connections, notes);
                              }
                            }}
                            className="w-full h-full min-h-full px-2 py-1 bg-transparent outline-none resize-none overflow-y-auto whitespace-pre-wrap break-words"
                            style={{ fontSize: note.fontSize, lineHeight: 1.35, color: '#000000' }}
                          />
                        </div>

                        {/* Resize Handle - Bottom Right */}
                        <div
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleNoteResizeStart(e as unknown as ReactMouseEvent, note.id);
                          }}
                          className="absolute right-1 bottom-1 z-10 w-4 h-4 cursor-se-resize opacity-50 hover:opacity-100 transition-opacity"
                          title={language === 'tr' ? 'Yeniden Boyutlandır' : 'Resize'}
                        >
                          <svg viewBox="0 0 12 12" className="w-full h-full text-black">
                            <path d="M4 12 L12 4" stroke="currentColor" strokeWidth="1" />
                            <path d="M7 12 L12 7" stroke="currentColor" strokeWidth="1" />
                            <path d="M10 12 L12 10" stroke="currentColor" strokeWidth="1" />
                          </svg>
                        </div>
                      </div>
                    </foreignObject>
                  ))}

                  {/* Ping Animation - rendered LAST for top z-order */}
                  {pingAnimation && (() => {
                    const { path, currentHopIndex, progress, success, error } = pingAnimation;

                    // Show error message if ping failed
                    if (success === false && error) {
                      return (
                        <g key="ping-error" opacity={0.95}>
                          <foreignObject x="20" y="20" width="300" height="auto">
                            <div className={`p-3 rounded-lg shadow-lg border ${isDark ? 'bg-red-500/20 border-red-500/50' : 'bg-red-50 border-red-200'}`}>
                              <div className={`text-sm font-bold ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                                Ping başarısız
                              </div>
                              <div className={`text-xs mt-1 ${isDark ? 'text-red-200' : 'text-red-600'}`}>
                                {error}
                              </div>
                            </div>
                          </foreignObject>
                        </g>
                      );
                    }

                    // Show success message if ping succeeded
                    if (success === true) {
                      return (
                        <g key="ping-success" opacity={0.95}>
                          <foreignObject x="20" y="20" width="300" height="auto">
                            <div className={`p-3 rounded-lg shadow-lg border ${isDark ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-emerald-50 border-emerald-200'}`}>
                              <div className={`text-sm font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                Ping başarılı
                              </div>
                            </div>
                          </foreignObject>
                        </g>
                      );
                    }

                    if (!path || path.length < 2 || success !== null) return null;

                    const fromDevice = devices.find(d => d.id === path[currentHopIndex]);
                    const toDevice = devices.find(d => d.id === path[currentHopIndex + 1]);
                    if (!fromDevice || !toDevice) return null;

                    const conn = connections.find(
                      c => (c.sourceDeviceId === fromDevice.id && c.targetDeviceId === toDevice.id) ||
                        (c.sourceDeviceId === toDevice.id && c.targetDeviceId === fromDevice.id)
                    );

                    let source: { x: number; y: number };
                    let target: { x: number; y: number };

                    if (conn) {
                      source = getPortPosition(fromDevice, conn.sourceDeviceId === fromDevice.id ? conn.sourcePort : conn.targetPort);
                      target = getPortPosition(toDevice, conn.sourceDeviceId === toDevice.id ? conn.sourcePort : conn.targetPort);
                    } else {
                      source = getDeviceCenter(fromDevice);
                      target = getDeviceCenter(toDevice);
                    }

                    const midX = (source.x + target.x) / 2;
                    const sameDeviceConnections = connections.filter(
                      c => (c.sourceDeviceId === fromDevice.id && c.targetDeviceId === toDevice.id) ||
                        (c.sourceDeviceId === toDevice.id && c.targetDeviceId === fromDevice.id)
                    );
                    const sameConnIndex = conn ? sameDeviceConnections.findIndex(c => c.id === conn.id) : 0;
                    const totalSameConns = sameDeviceConnections.length;
                    const maxOffset = 20;
                    const offset = totalSameConns > 1
                      ? (sameConnIndex - (totalSameConns - 1) / 2) * (maxOffset / Math.max(totalSameConns - 1, 1))
                      : 0;

                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    const perpX = -dy / len * offset;
                    const perpY = dx / len * offset;

                    const controlPoint1 = { x: midX + perpX, y: source.y + perpY + Math.abs(offset) * 0.5 };
                    const controlPoint2 = { x: midX + perpX, y: target.y + perpY - Math.abs(offset) * 0.5 };

                    const t = progress;
                    const t2 = t * t; const t3 = t2 * t;
                    const mt = 1 - t; const mt2 = mt * mt; const mt3 = mt2 * mt;

                    const bezierX = mt3 * source.x + 3 * mt2 * t * controlPoint1.x + 3 * mt * t2 * controlPoint2.x + t3 * target.x;
                    const bezierY = mt3 * source.y + 3 * mt2 * t * controlPoint1.y + 3 * mt * t2 * controlPoint2.y + t3 * target.y;

                    const tangentDx = -3 * mt2 * source.x + 3 * (mt2 - 2 * mt * t) * controlPoint1.x + 3 * (2 * mt * t - t2) * controlPoint2.x + 3 * t2 * target.x;
                    const tangentDy = -3 * mt2 * source.y + 3 * (mt2 - 2 * mt * t) * controlPoint1.y + 3 * (2 * mt * t - t2) * controlPoint2.y + 3 * t2 * target.y;
                    const tangentLen = Math.sqrt(tangentDx * tangentDx + tangentDy * tangentDy) || 1;

                    const envelopeX = bezierX + (tangentDy / tangentLen * 20);
                    const envelopeY = bezierY + (-tangentDx / tangentLen * 20);

                    return (
                      <g key="ping-animation" opacity={0.9}>
                        <g transform={`translate(${envelopeX}, ${envelopeY})`}>
                          <rect x="-10" y="-7" width="20" height="14" rx="2" fill="#06b6d4" stroke="#0891b2" strokeWidth="1.5" />
                          <path d="M-8 -3 L0 4 L8 -3" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                      </g>
                    );
                  })()}

                </g>

                {/* Canvas Boundary Border */}
                <rect
                  x="0"
                  y="0"
                  width={getCanvasDimensions().width}
                  height={getCanvasDimensions().height}
                  fill="none"
                  stroke={isDark ? '#3b82f6' : '#2563eb'}
                  strokeWidth={2 / zoom}
                  strokeDasharray={`${6 / zoom},${4 / zoom}`}
                  opacity={0.7}
                />

                {/* Canvas size label - bottom right only */}
                <text
                  x={getCanvasDimensions().width - 80}
                  y={getCanvasDimensions().height - 10}
                  fill={isDark ? '#64748b' : '#64748b'}
                  fontSize={12 / zoom}
                  fontFamily="monospace"
                >
                  {getCanvasDimensions().width} × {getCanvasDimensions().height}
                </text>
              </g>
            </svg>
          </div>

          {/* Zoom Controls - Mobile Float - Above Footer */}
          <div
            className={`fixed bottom-[60px] right-[10px] items-center gap-1 px-2 py-1 rounded-lg ${isDark ? 'bg-slate-800/90' : 'bg-white/90'
              } shadow-lg flex z-40`}
          >
            <button
              onClick={() => setZoom((z) => {
                const newZoom = Math.max(MIN_ZOOM, z - 0.25);
                if (!canvasRef.current) return newZoom;
                const rect = canvasRef.current.getBoundingClientRect();
                const cursorX = rect.width / 2;
                const cursorY = rect.height / 2;
                setPan(prevPan => ({
                  x: cursorX - (cursorX - prevPan.x) * (newZoom / z),
                  y: cursorY - (cursorY - prevPan.y) * (newZoom / z)
                }));
                return newZoom;
              })}
              className={`w-7 h-7 flex items-center justify-center rounded ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                }`}
            >
              −
            </button>
            <span className={`text-xs font-mono w-12 text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => {
                const newZoom = Math.min(MAX_ZOOM, z + 0.25);
                if (!canvasRef.current) return newZoom;
                const rect = canvasRef.current.getBoundingClientRect();
                const cursorX = rect.width / 2;
                const cursorY = rect.height / 2;
                setPan(prevPan => ({
                  x: cursorX - (cursorX - prevPan.x) * (newZoom / z),
                  y: cursorY - (cursorY - prevPan.y) * (newZoom / z)
                }));
                return newZoom;
              })}
              className={`w-7 h-7 flex items-center justify-center rounded ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                }`}
            >
              +
            </button>
            <div className={`w-px h-5 ${isDark ? 'bg-slate-600' : 'bg-slate-300'} mx-1`} />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={resetView}
                  className={`px-2 py-1 text-xs rounded ui-hover-surface ${isDark
                    ? 'text-slate-300 hover:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {language === 'tr' ? 'Sıfırla' : 'Reset'}
                </button>
              </TooltipTrigger>
              <TooltipContent>{`${language === 'tr' ? 'Sıfırla' : 'Reset'} (Alt+R)`}</TooltipContent>
            </Tooltip>
          </div>

          {/* Zoom Controls - Desktop Only - Hidden (now in footer) */}
          <div
            className={`hidden`}
          >
            <button
              onClick={() => setZoom((z) => {
                const newZoom = Math.max(MIN_ZOOM, z - 0.25);
                if (!canvasRef.current) return newZoom;
                const rect = canvasRef.current.getBoundingClientRect();
                const cursorX = rect.width / 2;
                const cursorY = rect.height / 2;
                setPan(prevPan => ({
                  x: cursorX - (cursorX - prevPan.x) * (newZoom / z),
                  y: cursorY - (cursorY - prevPan.y) * (newZoom / z)
                }));
                return newZoom;
              })}
              className={`w-7 h-7 flex items-center justify-center rounded ui-hover-surface ${isDark ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              −
            </button>
            <span className={`text-xs font-mono w-12 text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => {
                const newZoom = Math.min(MAX_ZOOM, z + 0.25);
                if (!canvasRef.current) return newZoom;
                const rect = canvasRef.current.getBoundingClientRect();
                const cursorX = rect.width / 2;
                const cursorY = rect.height / 2;
                setPan(prevPan => ({
                  x: cursorX - (cursorX - prevPan.x) * (newZoom / z),
                  y: cursorY - (cursorY - prevPan.y) * (newZoom / z)
                }));
                return newZoom;
              })}
              className={`w-7 h-7 flex items-center justify-center rounded ui-hover-surface ${isDark ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              +
            </button>
            <div className={`w-px h-5 ${isDark ? 'bg-slate-600' : 'bg-slate-300'} mx-1`} />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={resetView}
                  className={`px-2 py-1 text-xs rounded ui-hover-surface ${isDark
                    ? 'text-slate-300 hover:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {language === 'tr' ? 'Sıfırla' : 'Reset'}
                </button>
              </TooltipTrigger>
              <TooltipContent>{`${language === 'tr' ? 'Sıfırla' : 'Reset'} (Alt+R)`}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleFullscreen}
                  className={`px-2 py-1 text-xs rounded flex items-center gap-1 ui-hover-surface ${isDark
                    ? 'text-slate-300 hover:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  {isFullscreen ? (language === 'tr' ? 'Küçült' : 'Exit') : (language === 'tr' ? 'Tam Ekran' : 'Full Screen')}
                </button>
              </TooltipTrigger>
              <TooltipContent>Ctrl+F</TooltipContent>
            </Tooltip>
          </div>

          {/* Minimap (Preview) - Hidden */}
          <div
            className={`hidden print:block print:w-full print:h-auto`}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${getCanvasDimensions().width} ${getCanvasDimensions().height}`}
              className="print:w-full print:h-auto"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const canvasDims = getCanvasDimensions();
                const x = ((e.clientX - rect.left) / rect.width) * canvasDims.width;
                const y = ((e.clientY - rect.top) / rect.height) * canvasDims.height;
                // Pan to clicked location (center)
                const newPanX = -(x - 400 / zoom) * zoom;
                const newPanY = -(y - 200 / zoom) * zoom;
                setPan({ x: newPanX, y: newPanY });
              }}
            >
              {/* Canvas background */}
              <defs>
                <radialGradient id="canvasBgGradient" cx="46%" cy="30%" r="88%">
                  {isDark ? (
                    <>
                      <stop offset="0%" stopColor="#15243a" />
                      <stop offset="25%" stopColor="#132035" />
                      <stop offset="50%" stopColor="#101b2e" />
                      <stop offset="75%" stopColor="#0e1829" />
                      <stop offset="100%" stopColor="#0b1424" />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor="#fbfdff" />
                      <stop offset="25%" stopColor="#f6faff" />
                      <stop offset="50%" stopColor="#f1f7ff" />
                      <stop offset="75%" stopColor="#ecf3fb" />
                      <stop offset="100%" stopColor="#e6eef8" />
                    </>
                  )}
                </radialGradient>
                <radialGradient id="canvasSoftGlow" cx="20%" cy="15%" r="75%">
                  {isDark ? (
                    <>
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.08" />
                      <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.04" />
                      <stop offset="100%" stopColor="#0b1220" stopOpacity="0" />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.18" />
                      <stop offset="45%" stopColor="#a5b4fc" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#f8fbff" stopOpacity="0" />
                    </>
                  )}
                </radialGradient>
              </defs>

              {/* Background */}
              <rect
                x="0"
                y="0"
                width={getCanvasDimensions().width}
                height={getCanvasDimensions().height}
                fill="url(#canvasBgGradient)"
              />
              <rect
                x="0"
                y="0"
                width={getCanvasDimensions().width}
                height={getCanvasDimensions().height}
                fill="url(#canvasSoftGlow)"
              />

              {/* Connections */}
              {connections.map((conn) => {
                const sourceDevice = devices.find(d => d.id === conn.sourceDeviceId);
                const targetDevice = devices.find(d => d.id === conn.targetDeviceId);
                if (!sourceDevice || !targetDevice) return null;

                const sourceX = sourceDevice.x + (sourceDevice.type === 'pc' ? 45 : 50);
                const sourceY = sourceDevice.y + (sourceDevice.type === 'pc' ? 45 : 60);
                const targetX = targetDevice.x + (targetDevice.type === 'pc' ? 45 : 50);
                const targetY = targetDevice.y + (targetDevice.type === 'pc' ? 45 : 60);

                return (
                  <line
                    key={conn.id}
                    x1={sourceX}
                    y1={sourceY}
                    x2={targetX}
                    y2={targetY}
                    stroke={conn.cableType === 'straight' ? '#3b82f6' : conn.cableType === 'crossover' ? '#f97316' : '#06b6d4'}
                    strokeWidth="2"
                    opacity="0.7"
                  />
                );
              })}

              {/* Devices */}
              {devicesSortedForRender.map((device) => {
                const deviceWidth = device.type === 'pc' ? 90 : device.type === 'router' ? 90 : 130;
                const deviceHeight = device.type === 'pc' ? 99 : 80;
                const color = device.type === 'pc' ? '#3b82f6' : device.type === 'switch' ? '#22c55e' : '#a855f7';

                return (
                  <g key={device.id}>
                    {/* Device box */}
                    <rect
                      x={device.x}
                      y={device.y}
                      width={deviceWidth}
                      height={deviceHeight}
                      fill={color}
                      opacity="0.1"
                      stroke={color}
                      strokeWidth="2"
                      rx="4"
                    />

                    {/* Device label */}
                    <text
                      x={device.x + deviceWidth / 2}
                      y={device.y + deviceHeight / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="12"
                      fontWeight="bold"
                      fill={color}
                    >
                      {device.name}
                    </text>

                    {/* IP address if exists */}
                    {(() => {
                      // Validate IP format
                      const isValidIP = device.ip ? /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(device.ip) : false;
                      const isValidSubnet = device.subnet ? /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(device.subnet) : false;
                      const hasError = !isValidIP || !isValidSubnet;
                      const displayText = device.ip || (language === 'tr' ? 'IP Yok' : 'No IP');

                      return (
                        <text
                          x={device.x + deviceWidth / 2}
                          y={device.y + deviceHeight / 2 + 16}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="10"
                          fill={hasError ? '#ef4444' : '#666'}
                          fontWeight={hasError ? '700' : '400'}
                        >
                          {hasError ? '⚠ ' : ''}{displayText}
                        </text>
                      );
                    })()}
                  </g>
                );
              })}

              {/* Notes */}
              {notes.map((note) => (
                <g key={note.id}>
                  {/* Note background */}
                  <rect
                    x={note.x}
                    y={note.y}
                    width={note.width}
                    height={note.height}
                    fill={note.color}
                    opacity={note.opacity}
                    stroke="#999"
                    strokeWidth="1"
                    rx="4"
                  />

                  {/* Note text */}
                  <text
                    x={note.x + 8}
                    y={note.y + 20}
                    fontSize={note.fontSize}
                    fill="#000000"
                    fontFamily={note.font}
                    fontWeight={note.bold ? 'bold' : 'normal'}
                    fontStyle={note.italic ? 'italic' : 'normal'}
                    textDecoration={note.underline ? 'underline' : 'none'}
                  >
                    {note.text.split('\n').map((line, i) => (
                      <tspan key={i} x={note.x + 8} dy={i === 0 ? 0 : note.fontSize + 2}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              ))}
            </svg>
          </div>

        </div>
      </div>

      {/* Context Menu - Using lazy-loaded NetworkTopologyContextMenu component */}
      <LazyNetworkTopologyContextMenu
        contextMenu={contextMenu}
        contextMenuRef={contextMenuRef}
        isDark={isDark}
        language={language}
        noteFonts={Array.from(NOTE_FONTS)}
        notes={notes}
        devices={devices}
        selectedDeviceIds={selectedDeviceIds}
        clipboardLength={clipboard.length}
        noteClipboardLength={noteClipboard.length}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < historyLength - 1}
        onClose={() => setContextMenu(null)}
        onUpdateNoteStyle={(id, style) => updateNoteStyle(id, style)}
        onNoteCut={(id) => handleNoteTextCut(id)}
        onNoteCopy={(id) => handleNoteTextCopy(id)}
        onNotePaste={(id) => handleNoteTextPaste(id)}
        onNoteDeleteText={(id) => handleNoteTextDelete(id)}
        onNoteSelectAllText={(id) => handleNoteTextSelectAll(id)}
        onDuplicateNote={(id) => duplicateNote(id)}
        onPasteNotes={(x, y) => pasteNotes(x, y)}
        onUndo={() => handleUndo()}
        onRedo={() => handleRedo()}
        onSelectAll={() => selectAllDevices()}
        onOpenDevice={(d) => handleDeviceDoubleClick(d)}
        onCutDevices={(ids) => { saveToHistory(); cutDevice(ids); }}
        onCopyDevices={(ids) => copyDevice(ids)}
        onPasteDevice={() => pasteDevice()}
        onDeleteDevices={(ids) => { saveToHistory(); ids.forEach(id => deleteDevice(id)); setSelectedDeviceIds([]); }}
        onStartConfig={(id) => {
          const device = devices.find(d => d.id === id);
          if (device) {
            setConfiguringDevice(id);
            setTempNameValue(device.name);
            setDnsValue(device.dns || '8.8.8.8');
            setTimeout(() => configInputRef.current?.focus(), 0);
          }
        }}
        onStartPing={(id) => setPingSource(id)}
        onTogglePowerDevices={(ids) => { saveToHistory(); togglePowerDevices(ids); }}
        onSaveToHistory={() => saveToHistory()}
        onClearDeviceSelection={() => setSelectedDeviceIds([])}
        note={notes.find(n => n.id === contextMenu?.noteId)}
      />
      {/* Device Configuration Modal (Name & IP) */}
      {configuringDevice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={cancelDeviceConfig}>
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" />
          <div
            className={`relative w-full max-w-md overflow-hidden rounded-[2rem] border transition-all duration-500 hover:shadow-cyan-500/10 ${isDark ? 'bg-slate-900/80 border-slate-800/50 shadow-2xl' : 'bg-white/90 border-slate-200/50 shadow-2xl'
              }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`${isMobile ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'} border-b ${isDark ? 'border-slate-800/50 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="flex items-center gap-4">
                <div className={`${isMobile ? 'p-2' : 'p-3'} rounded-2xl shadow-inner ${isDark ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-cyan-50 text-cyan-600 border border-cyan-100'}`}>
                  <svg className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} drop-shadow-sm`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0 -2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0 -1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1 -6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {language === 'tr' ? 'Yapılandır' : 'Configure'}
                  </h3>
                  <div className={`text-[10px] font-bold tracking-widest opacity-60 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {devices.find(d => d.id === configuringDevice)?.name}
                  </div>
                </div>
              </div>
            </div>

            <div className={`${isMobile ? 'p-4 space-y-4' : 'p-6 space-y-6'}`}>
              {/* Hostname */}
              <div className="space-y-2">
                <label className={`text-[10px] font-black tracking-widest ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {language === 'tr' ? 'Cihaz Adı' : 'Device Name'}
                </label>
                <div className="relative group">
                  <input
                    ref={configInputRef}
                    type="text"
                    value={tempNameValue}
                    onChange={(e) => setTempNameValue(e.target.value)}
                    className={`w-full ${isMobile ? 'px-4 py-2.5' : 'px-4 py-3'} rounded-2xl border transition-all duration-300 font-bold ${isDark
                      ? 'bg-slate-950/50 border-slate-800 text-white placeholder-slate-700 focus:border-cyan-500/50 focus:bg-slate-950 focus:ring-4 focus:ring-cyan-500/10'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:bg-white focus:ring-4 focus:ring-cyan-500/10'
                      } outline-none`}
                    placeholder={language === 'tr' ? 'Örn: Router-X' : 'e.g. Router-X'}
                  />
                </div>
              </div>

              {/* Device Info (MAC Address) */}
              <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-800/50' : 'bg-slate-50 border-slate-200/50'}`}>
                <div className={`text-[10px] font-black tracking-widest mb-2 opacity-70 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                  {language === 'tr' ? 'CİHAZ BİLGİSİ' : 'DEVICE INFO'}
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>MAC Address</span>
                  <span className={`text-xs font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {devices.find(d => d.id === configuringDevice)?.macAddress || 'N/A'}
                  </span>
                </div>
              </div>

              {/* IP Configuration Section - Only for PCs */}
              {devices.find(d => d.id === configuringDevice)?.type === 'pc' && (
                <div className={`${isMobile ? 'p-3' : 'p-4'} rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-800/50' : 'bg-slate-50 border-slate-200/50'}`}>
                  <div className={`text-[10px] font-black tracking-widest ${isMobile ? 'mb-3' : 'mb-4'} opacity-70 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                    {language === 'tr' ? 'IP Yapılandırması' : 'IP Configuration'}
                  </div>

                  <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold tracking-widest ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {language === 'tr' ? 'IP Adresi' : 'IP Address'}
                      </label>
                      <input
                        type="text"
                        value={ipValue}
                        onChange={(e) => setIpValue(e.target.value)}
                        className={`w-full px-4 ${isMobile ? 'py-2' : 'py-2.5'} rounded-xl border font-mono font-bold transition-all duration-300 ${isDark
                          ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-700 focus:border-cyan-500/50'
                          : 'bg-white border-slate-200 text-slate-900 placeholder-slate-300 focus:border-cyan-500/50'
                          } outline-none`}
                        placeholder="192.168.1.1"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold tracking-widest ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {language === 'tr' ? 'Alt Ağ Maskesi' : 'Subnet Mask'}
                      </label>
                      <input
                        type="text"
                        value={subnetValue}
                        onChange={(e) => setSubnetValue(e.target.value)}
                        className={`w-full px-4 ${isMobile ? 'py-2' : 'py-2.5'} rounded-xl border font-mono font-bold transition-all duration-300 ${isDark
                          ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-700 focus:border-cyan-500/50'
                          : 'bg-white border-slate-200 text-slate-900 placeholder-slate-300 focus:border-cyan-500/50'
                          } outline-none`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold tracking-widest ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {language === 'tr' ? 'Ağ Geçidi' : 'Gateway'}
                      </label>
                      <input
                        type="text"
                        value={gatewayValue}
                        onChange={(e) => setGatewayValue(e.target.value)}
                        className={`w-full px-4 ${isMobile ? 'py-2' : 'py-2.5'} rounded-xl border font-mono font-bold transition-all duration-300 ${isDark
                          ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-700 focus:border-cyan-500/50'
                          : 'bg-white border-slate-200 text-slate-900 placeholder-slate-300 focus:border-cyan-500/50'
                          } outline-none`}
                        placeholder="192.168.1.1"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold tracking-widest ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {language === 'tr' ? 'DNS Sunucusu' : 'DNS Server'}
                      </label>
                      <input
                        type="text"
                        value={dnsValue}
                        onChange={(e) => setDnsValue(e.target.value)}
                        className={`w-full px-4 ${isMobile ? 'py-2' : 'py-2.5'} rounded-xl border font-mono font-bold transition-all duration-300 ${isDark
                          ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-700 focus:border-cyan-500/50'
                          : 'bg-white border-slate-200 text-slate-900 placeholder-slate-300 focus:border-cyan-500/50'
                          } outline-none`}
                        placeholder="8.8.8.8"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  onClick={cancelDeviceConfig}
                  className={`flex-1 py-3.5 rounded-2xl text-xs font-black tracking-widest transition-all duration-300 border ${isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                    }`}
                >
                  {language === 'tr' ? 'İptal' : 'Cancel'}
                </button>
                <button
                  onClick={confirmDeviceConfig}
                  className="flex-1 py-3.5 rounded-2xl text-xs font-black tracking-widest bg-cyan-500 text-white hover:bg-cyan-400 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all duration-300"
                >
                  {language === 'tr' ? 'Kaydet' : 'Save'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Ping Target Selection Overlay */}
      {pingSource && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onClick={() => setPingSource(null)}>
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 m-4 max-w-sm`} onClick={e => e.stopPropagation()}>
            <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {language === 'tr' ? 'Ping Hedefi Seçin' : 'Select Ping Target'}
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {devices.filter(d => d.id !== pingSource).map(device => (
                <button
                  key={device.id}
                  onClick={() => {
                    startPingAnimation(pingSource, device.id);
                    setPingSource(null);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-sm text-left flex items-center gap-2 ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                    }`}
                >
                  <span className={`w-2 h-2 rounded-full ${device.type === 'pc' ? 'bg-blue-500' : device.type === 'router' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                  {device.name}
                </button>
              ))}
              {devices.filter(d => d.id !== pingSource).length === 0 && (
                <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {language === 'tr' ? 'Başka cihaz yok' : 'No other devices'}
                </p>
              )}
            </div>
            <button
              onClick={() => setPingSource(null)}
              className={`mt-3 w-full py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              {language === 'tr' ? 'İptal' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Success Toast - ping başarılı olduğunda göster, otomatik kapanır */}
      {pingAnimation && pingAnimation.success === true && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 bg-green-600 text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">
              {language === 'tr'
                ? `${devices.find(d => d.id === pingAnimation?.sourceId)?.name} → ${devices.find(d => d.id === pingAnimation?.targetId)?.name} Ping Başarılı! (${pingAnimation?.path?.length - 1} hop)`
                : `${devices.find(d => d.id === pingAnimation?.sourceId)?.name} → ${devices.find(d => d.id === pingAnimation?.targetId)?.name} Ping Successful! (${pingAnimation?.path?.length - 1} hop${pingAnimation?.path?.length > 2 ? 's' : ''})`}
            </span>
          </div>
        </div>
      )}

      {/* Persistent Error Toast - ping başarısız olduğunda göster, kullanıcı kapatana kadar açık kalır */}
      {errorToast && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="px-4 py-3 rounded-lg shadow-lg flex items-start gap-2 bg-red-600 text-white max-w-md">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex flex-col flex-grow">
              <span className="text-sm font-medium">{errorToast.message}</span>
              {errorToast.details && (
                <span className="text-xs opacity-90 mt-0.5">{errorToast.details}</span>
              )}
            </div>
            <button
              onClick={() => setErrorToast(null)}
              className="flex-shrink-0 ml-2 hover:bg-red-700 rounded p-1 transition-colors"
              title={language === 'tr' ? 'Kapat' : 'Close'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Connection Error Toast */}
      {connectionError && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 bg-red-600 text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium">{connectionError}</span>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {renderMobilePalette()}
      <LazyNetworkTopologyPortSelectorModal
        isOpen={showPortSelector}
        isDark={isDark}
        devices={devices}
        cableType={cableInfo.cableType}
        portSelectorStep={portSelectorStep}
        selectedSourcePort={selectedSourcePort}
        onClose={() => {
          setShowPortSelector(false);
          setPortSelectorStep('source');
          setSelectedSourcePort(null);
        }}
        onCableTypeChange={(nextType) => onCableChange({ ...cableInfo, cableType: nextType })}
        onSelectPort={(deviceId, portId) => {
          if (portSelectorStep === 'source') {
            setSelectedSourcePort({ deviceId, portId });
            setPortSelectorStep('target');
          } else {
            // Complete connection
            const newConnection: CanvasConnection = {
              id: `conn-${Date.now()}`,
              sourceDeviceId: selectedSourcePort!.deviceId,
              sourcePort: selectedSourcePort!.portId,
              targetDeviceId: deviceId,
              targetPort: portId,
              cableType: cableInfo.cableType,
              active: true,
            };

            setConnections((prev) => [...prev, newConnection]);

            // Update port status
            setDevices((prev) =>
              prev.map((d) => {
                if (d.id === selectedSourcePort!.deviceId) {
                  return {
                    ...d,
                    ports: d.ports.map((p) =>
                      p.id === selectedSourcePort!.portId ? { ...p, status: 'connected' as const } : p
                    ),
                  };
                }
                if (d.id === deviceId) {
                  return {
                    ...d,
                    ports: d.ports.map((p) =>
                      p.id === portId ? { ...p, status: 'connected' as const } : p
                    ),
                  };
                }
                return d;
              })
            );

            // Update cable info
            const sourceDevice = devices.find((d) => d.id === selectedSourcePort!.deviceId);
            const targetDevice = devices.find((d) => d.id === deviceId);
            if (sourceDevice && targetDevice) {
              onCableChange({
                ...cableInfo,
                connected: true,
                sourceDevice: sourceDevice.type === 'router' ? 'switch' : sourceDevice.type,
                targetDevice: targetDevice.type === 'router' ? 'switch' : targetDevice.type,
              });
            }

            setShowPortSelector(false);
            setPortSelectorStep('source');
            setSelectedSourcePort(null);
          }
        }}
      />
      {/* Port Tooltip */}
      {
        portTooltip && portTooltip.visible && (
          <div
            className={`fixed z-[100] pointer-events-none transition-opacity duration-300 ${portTooltip.visible ? 'opacity-100' : 'opacity-0'
              }`}
            style={{
              left: portTooltip.x,
              top: portTooltip.y - 10,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div
              className={`px-3 py-2 rounded-xl shadow-2xl border backdrop-blur-md ${isDark
                ? 'bg-slate-900/90 border-slate-700 text-white shadow-cyan-500/10'
                : 'bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/50'
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${(() => {
                  const dev = devices.find(d => d.id === portTooltip.deviceId);
                  const prt = dev?.ports.find(p => p.id === portTooltip.portId);
                  return dev?.status === 'offline' || prt?.shutdown ? 'bg-red-500' : prt?.status === 'connected' ? 'bg-green-500' : 'bg-slate-400';
                })()
                  }`} />
                <span className="text-[10px] font-black tracking-widest opacity-60">
                  {portTooltip.portId}
                </span>
              </div>

              <div className="space-y-0.5">
                <div className="text-xs font-bold">
                  VLAN:{' '}
                  <span className="text-cyan-500">
                    {getLivePortVlanText(portTooltip.deviceId, portTooltip.portId)}
                  </span>
                </div>
                <div className="text-xs font-bold">
                  {language === 'tr' ? 'Durum:' : 'Status:'}{' '}
                  <span className={
                    (() => {
                      const dev = devices.find(d => d.id === portTooltip.deviceId);
                      const prt = dev?.ports.find(p => p.id === portTooltip.portId);
                      return dev?.status === 'offline' || prt?.shutdown ? 'text-red-500' : prt?.status === 'connected' ? 'text-green-500' : 'text-slate-400';
                    })()
                  }>
                    {(() => {
                      const dev = devices.find(d => d.id === portTooltip.deviceId);
                      const prt = dev?.ports.find(p => p.id === portTooltip.portId);
                      if (dev?.status === 'offline') {
                        return language === 'tr' ? 'Cihaz Kapalı' : 'Device Off';
                      }
                      if (prt?.shutdown) {
                        return language === 'tr' ? 'Kapalı (Shutdown)' : 'Shutdown';
                      }
                      if (prt?.status === 'connected') {
                        return language === 'tr' ? 'Bağlı (Up)' : 'Connected (Up)';
                      }
                      return language === 'tr' ? 'Bağlı Değil (Down)' : 'Not Connected (Down)';
                    })()
                    }
                  </span>
                </div>

                {(() => {
                  const dev = devices.find(d => d.id === portTooltip.deviceId);
                  const prt = dev?.ports.find(p => p.id === portTooltip.portId);
                  if (prt?.ipAddress) {
                    return (
                      <div className="text-xs font-bold">
                        IP:{' '}
                        <span className="text-amber-400">
                          {prt.ipAddress}{prt.subnetMask ? `/${prt.subnetMask}` : ''}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {devices.find(d => d.id === portTooltip.deviceId)?.ports.find(p => p.id === portTooltip.portId)?.status === 'connected' && (
                  <div className="text-[10px] opacity-70">
                    {language === 'tr' ? 'Fiziksel bağlantı aktif' : 'Physical link active'}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] ${isDark ? 'border-t-slate-800' : 'border-t-white'
                }`} />
            </div>
          </div>
        )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 left-4 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 z-40 ${toast.type === 'success'
            ? isDark ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : isDark ? 'bg-red-500/20 border border-red-500/50 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'
            }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}



