'use client';

import { useState, useRef, useEffect, useCallback, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { SwitchState, CableType, CableInfo, getCableTypeName, isCableCompatible } from '@/lib/network/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Monitor, Laptop, Network, Plus, Database, ChevronRight, Settings2, Trash2, MousePointer2, StickyNote } from "lucide-react";
import { ConnectionLine } from './ConnectionLine';
import { DeviceNode } from './DeviceNode';

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
}

// Device types for the canvas
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

// Connection types
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

// Drag item from palette
interface DragItem {
  type: 'pc' | 'switch' | 'router';
  icon: React.ReactNode;
}

const DEVICE_ICONS = {
  pc: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z" />
    </svg>
  ),
  switch: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 0 1 -2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2M5 12a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 -2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
  router: (
    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14M5 12h14M12 5l-2 2m2-2l2 2m-2 12l-2-2m2 2l2-2M5 12l2-2m-2 2l2 2M19 12l-2-2m2 2l-2 2" />
    </svg>
  ),
};

const CABLE_COLORS: Record<CableType | 'error', { primary: string; bg: string; text: string; border: string }> = {
  straight: { primary: '#3b82f6', bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30' },
  crossover: { primary: '#f97316', bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30' },
  console: { primary: '#06b6d4', bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/30' },
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
const NOTE_DEFAULT_WIDTH = 180;
const NOTE_DEFAULT_HEIGHT = 120;
const NOTE_HEADER_HEIGHT = 22;
const NOTE_COLORS = [
  '#FAE3E7',
  '#F7EAD7',
  '#F6EDC6',
  '#E3F2D3',
  '#D7F1EA',
  '#D1E2FF',
  '#CDB8FF',
  '#E3B3F1',
  '#F2B4C3',
  '#D7D0D0'
];
const NOTE_FONTS_DESKTOP = [
  'Roboto',
  'Impact',
  'Verdana',
  'Trebuchet MS',
  'Courier New'
];
const NOTE_FONTS_MOBILE = [
  'Roboto',
  'Verdana',
  'Trebuchet MS',
  'Courier New',
  'Arial'
];
const NOTE_FONT_SIZES: Array<CanvasNote['fontSize']> = [10, 12, 16];
const NOTE_OPACITY: Array<CanvasNote['opacity']> = [0.5, 0.75, 1];

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
  isFullscreen: isFullscreenProp,
  onFullscreenChange,
  zoom: zoomProp,
  onZoomChange,
  pan: panProp,
  onPanChange,
}: NetworkTopologyProps) {
  const { language } = useLanguage();
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
    ];
  };

  // Helper to generate a random unique Network-formatted MAC address (xxxx.xxxx.xxxx)
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
      status: 'offline',
      ports: [
        { id: 'eth0', label: 'Eth0', status: 'disconnected' },
        { id: 'com1', label: 'COM1', status: 'disconnected' },
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

  // Canvas state
  const [devices, setDevices] = useState<CanvasDevice[]>(initialDevices || defaultDevices);
  const [connections, setConnections] = useState<CanvasConnection[]>(initialConnections || []);
  const [notes, setNotes] = useState<CanvasNote[]>(initialNotes || []);

  const [zoom, setZoom] = useState(zoomProp || DEFAULT_ZOOM);
  const [pan, setPan] = useState(panProp || { x: 0, y: 0 });

  // Sync internal state with props (e.g. from undo/redo or tab switching)
  useEffect(() => {
    if (initialDevices) setDevices(initialDevices);
  }, [initialDevices]);

  useEffect(() => {
    if (initialConnections) setConnections(initialConnections);
  }, [initialConnections]);

  useEffect(() => {
    if (initialNotes) {
      setNotes(initialNotes.map(n => ({
        ...n,
        width: n.width || NOTE_DEFAULT_WIDTH,
        height: n.height || NOTE_DEFAULT_HEIGHT,
        color: n.color || NOTE_COLORS[0],
        font: n.font || noteFonts[0],
        fontSize: n.fontSize || 12,
        opacity: n.opacity || 1
      })));
    }
  }, [initialNotes]);

  useEffect(() => {
    if (zoomProp !== undefined) setZoom(zoomProp);
  }, [zoomProp]);

  useEffect(() => {
    if (panProp !== undefined) setPan(panProp);
  }, [panProp]);

  // Wrapper for setZoom to notify parent
  const updateZoom = useCallback((newZoom: number | ((prev: number) => number)) => {
    setZoom(prev => {
      const next = typeof newZoom === 'function' ? newZoom(prev) : newZoom;
      if (onZoomChange) onZoomChange(next);
      return next;
    });
  }, [onZoomChange]);

  // Wrapper for setPan to notify parent
  const updatePan = useCallback((newPan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
    setPan(prev => {
      const next = typeof newPan === 'function' ? newPan(prev) : newPan;
      if (onPanChange) onPanChange(next);
      return next;
    });
  }, [onPanChange]);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(activeDeviceId ? [activeDeviceId] : []);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  // Sync internal selection with prop from parent
  useEffect(() => {
    if (activeDeviceId !== undefined) {
      setSelectedDeviceIds(activeDeviceId ? [activeDeviceId] : []);
    }
  }, [activeDeviceId]);

  // Select all state
  const [selectAllMode, setSelectAllMode] = useState(false);

  // Drag state with position tracking
  const [draggedDevice, setDraggedDevice] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [dragStartDevicePositions, setDragStartDevicePositions] = useState<{ [key: string]: { x: number, y: number } }>({});
  const [isActuallyDragging, setIsActuallyDragging] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [noteDragStartPos, setNoteDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [noteDragStartPositions, setNoteDragStartPositions] = useState<{ [key: string]: { x: number; y: number } }>({});
  const [resizingNoteId, setResizingNoteId] = useState<string | null>(null);
  const [noteResizeStartPos, setNoteResizeStartPos] = useState<{ x: number; y: number } | null>(null);
  const [noteResizeStartSizes, setNoteResizeStartSizes] = useState<{ [key: string]: { width: number; height: number } }>({});

  // Drag performance - use ref for animation frame throttling
  const dragAnimationFrameRef = useRef<number | null>(null);
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const devicePositionRef = useRef<{ [key: string]: { x: number; y: number } }>({});

  // Ref to track if we were dragging (for click handler to check without stale closure)
  const wasDraggingRef = useRef(false);

  // Connection drawing state
  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{
    deviceId: string;
    portId: string;
    point: { x: number; y: number };
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Context menu state - deviceId can be null for empty area
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    deviceId: string | null;
    noteId: string | null;
    mode: 'device' | 'note-style' | 'note-edit' | 'canvas';
  } | null>(null);

  // Clipboard state for copy/cut/paste
  const [clipboard, setClipboard] = useState<CanvasDevice[]>([]);
  const [noteClipboard, setNoteClipboard] = useState<CanvasNote[]>([]);
  const noteTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Undo/Redo history
  const [history, setHistory] = useState<{ devices: CanvasDevice[]; connections: CanvasConnection[]; notes: CanvasNote[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef({ history, historyIndex });

  // Save state to history for undo
  const saveToHistory = useCallback(() => {
    const newState = { devices: [...devices], connections: [...connections], notes: [...notes] };
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newState);
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [devices, connections, notes, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setDevices(prevState.devices);
      setConnections(prevState.connections);
      setNotes(prevState.notes || []);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setDevices(nextState.devices);
      setConnections(nextState.connections);
      setNotes(nextState.notes || []);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

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
  const [isFullscreen, setIsFullscreen] = useState(isFullscreenProp || false);

  // Sync with prop
  useEffect(() => {
    if (isFullscreenProp !== undefined) {
      setIsFullscreen(isFullscreenProp);
    }
  }, [isFullscreenProp]);

  // Touch/Mobile state
  const isMobile = useIsMobile();
  const noteFonts = isMobile ? NOTE_FONTS_MOBILE : NOTE_FONTS_DESKTOP;
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchDraggedDevice, setTouchDraggedDevice] = useState<string | null>(null);
  const [touchDragStartPos, setTouchDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [touchDragOffset, setTouchDragOffset] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [lastTappedDevice, setLastTappedDevice] = useState<string | null>(null);

  // Advanced Canvas Pan/Zoom Touch state
  const [lastTouchCenter, setLastTouchCenter] = useState<{ x: number; y: number } | null>(null);

  // Ping and port selector state
  const [pingSource, setPingSource] = useState<string | null>(null);
  const [showPortSelector, setShowPortSelector] = useState(false);
  const [portSelectorStep, setPortSelectorStep] = useState<'source' | 'target'>('source');
  const [selectedSourcePort, setSelectedSourcePort] = useState<{ deviceId: string; portId: string } | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  // Ping animation state
  const [pingAnimation, setPingAnimation] = useState<{
    sourceId: string;
    targetId: string;
    path: string[];
    currentHopIndex: number;
    progress: number;
    success: boolean | null;
  } | null>(null);

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
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
    const updatedDevices = devices.filter((d) => d.id !== deviceId);
    const updatedConnections = connections.filter((c) => c.sourceDeviceId !== deviceId && c.targetDeviceId !== deviceId);

    setDevices(updatedDevices);
    setConnections(updatedConnections);

    if (onTopologyChange) {
      onTopologyChange(updatedDevices, updatedConnections, notes);
    }

    if (onDeviceDelete) {
      onDeviceDelete(deviceId);
    }
  }, [saveToHistory, onDeviceDelete, devices, connections, onTopologyChange, notes]);

  // Select all devices
  const selectAllDevices = useCallback(() => {
    const allIds = devices.map(d => d.id);
    setSelectedDeviceIds(allIds);
    setSelectedNoteIds(notes.map(n => n.id));
    setSelectAllMode(true);
    setContextMenu(null);
  }, [devices, notes]);

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

  const getCanvasDimensions = useCallback(() => {
    if (typeof window === 'undefined') return { width: VIRTUAL_CANVAS_WIDTH_DESKTOP, height: VIRTUAL_CANVAS_HEIGHT_DESKTOP };
    return isMobile
      ? { width: VIRTUAL_CANVAS_WIDTH_MOBILE, height: VIRTUAL_CANVAS_HEIGHT_MOBILE }
      : { width: VIRTUAL_CANVAS_WIDTH_DESKTOP, height: VIRTUAL_CANVAS_HEIGHT_DESKTOP };
  }, [isMobile]);


  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu) {
        const target = e.target as HTMLElement;
        // Don't close if clicking on context menu itself
        if (!target.closest('.context-menu')) {
          setContextMenu(null);
        }
      }
    };

    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

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

  // Handle right-click context menu with viewport clamping
  const openContextMenu = useCallback((
    clientX: number,
    clientY: number,
    deviceId: string | null = null,
    noteId: string | null = null,
    mode: 'device' | 'note-style' | 'note-edit' | 'canvas' = 'canvas'
  ) => {
    // Estimate menu dimensions (approximate)
    const menuWidth = 220;
    const menuHeight = deviceId ? 240 : noteId ? 320 : 180;

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

  // Clamp context menu to viewport after render
  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const rect = contextMenuRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 10;
    const maxY = window.innerHeight - rect.height - 10;
    const nextX = Math.max(10, Math.min(contextMenu.x, maxX));
    const nextY = Math.max(10, Math.min(contextMenu.y, maxY));
    if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
      setContextMenu(prev => prev ? { ...prev, x: nextX, y: nextY } : prev);
    }
  }, [contextMenu]);

  // Handle canvas pan start
  const handleCanvasMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.button === 2) {
      // Right click on canvas - show context menu
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, null, null, 'canvas');
    } else if (e.button === 0 && !(e.target as HTMLElement).closest('[data-device-id], [data-note-id], [data-note-drag-handle]')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedDeviceIds([]);
      setSelectedNoteIds([]);
      setContextMenu(null);
      setSelectAllMode(false);
    }
  }, [pan]);

  // Handle mouse move for panning and dragging
  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      } else if (draggedDevice && canvasRef.current) {
        // Check if we've moved enough to consider it a drag
        if (dragStartPos) {
          const distance = getDistance(dragStartPos.x, dragStartPos.y, e.clientX, e.clientY);
          if (distance > DRAG_THRESHOLD) {
            setIsActuallyDragging(true);
            wasDraggingRef.current = true; // Mark as dragging for click handler
            setPortTooltip(null); // Hide any active tooltip
          }
        }

        if (isActuallyDragging) {
          // Throttling with requestAnimationFrame
          if (dragAnimationFrameRef.current !== null) return;

          dragAnimationFrameRef.current = requestAnimationFrame(() => {
            const rect = canvasRef.current!.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - pan.x) / zoom;
            const mouseY = (e.clientY - rect.top - pan.y) / zoom;

            // Calculate delta from start pos
            if (!dragStartPos) return;
            const startMouseX = (dragStartPos.x - rect.left - pan.x) / zoom;
            const startMouseY = (dragStartPos.y - rect.top - pan.y) / zoom;
            const dx = mouseX - startMouseX;
            const dy = mouseY - startMouseY;

            const canvasDims = getCanvasDimensions();

            setDevices((prev) => {
              const newDevices = [...prev];
              let changed = false;

              // If draggedDevice is in selection, move all selected devices
              const devicesToMove = selectedDeviceIds.includes(draggedDevice)
                ? selectedDeviceIds
                : [draggedDevice];

              devicesToMove.forEach(id => {
                const deviceIndex = newDevices.findIndex(d => d.id === id);
                if (deviceIndex === -1) return;

                const initialPos = dragStartDevicePositions[id];
                if (!initialPos) return;

                const newX = initialPos.x + dx;
                const newY = initialPos.y + dy;

                const clampedX = Math.max(20, Math.min(newX, canvasDims.width - 100));
                const clampedY = Math.max(20, Math.min(newY, canvasDims.height - 100));

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
      } else if (resizingNoteId && noteResizeStartPos) {
        const coords = getCanvasCoords(e.clientX, e.clientY);
        const dx = coords.x - noteResizeStartPos.x;
        const dy = coords.y - noteResizeStartPos.y;
        const start = noteResizeStartSizes[resizingNoteId];
        if (start) {
          const nextWidth = Math.max(120, Math.min(start.width + dx, getCanvasDimensions().width - 40));
          const nextHeight = Math.max(80, Math.min(start.height + dy, getCanvasDimensions().height - 40));
          setNotes(prev => prev.map(n => n.id === resizingNoteId ? { ...n, width: nextWidth, height: nextHeight } : n));
        }
      } else if (draggedNoteId && noteDragStartPos) {
        const coords = getCanvasCoords(e.clientX, e.clientY);
        const canvasDims = getCanvasDimensions();
        const dx = coords.x - noteDragStartPos.x;
        const dy = coords.y - noteDragStartPos.y;
        const targets = selectedNoteIds.includes(draggedNoteId) ? selectedNoteIds : [draggedNoteId];

        setNotes(prev =>
          prev.map(n => {
            if (!targets.includes(n.id)) return n;
            const start = noteDragStartPositions[n.id] || { x: n.x, y: n.y };
            const newX = start.x + dx;
            const newY = start.y + dy;
            const clampedX = Math.max(20, Math.min(newX, canvasDims.width - NOTE_DEFAULT_WIDTH - 20));
            const clampedY = Math.max(20, Math.min(newY, canvasDims.height - NOTE_DEFAULT_HEIGHT - 20));
            return { ...n, x: clampedX, y: clampedY };
          })
        );
      } else if (isDrawingConnection) {
        const coords = getCanvasCoords(e.clientX, e.clientY);
        setMousePos(coords);
      }
    };

    const handleMouseUp = (e: globalThis.MouseEvent) => {
      // Cancel any pending animation frame
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }

      // Save to history and notify parent if we were actually dragging
      if (isActuallyDragging && draggedDevice) {
        saveToHistory();
        if (onTopologyChange) {
          onTopologyChange(devices, connections, notes);
        }
      }

      if (resizingNoteId) {
        saveToHistory();
        if (onTopologyChange) {
          onTopologyChange(devices, connections, notes);
        }
      }

      if (draggedNoteId) {
        saveToHistory();
        if (onTopologyChange) {
          onTopologyChange(devices, connections, notes);
        }
      }

      // Note: We don't reset wasDraggingRef here - let it persist for the click handler
      // The click handler will check wasDraggingRef and the next mousedown will reset it

      setIsPanning(false);
      setDraggedDevice(null);
      setDraggedNoteId(null);
      setNoteDragStartPos(null);
      setNoteDragStartPositions({});
      setResizingNoteId(null);
      setNoteResizeStartPos(null);
      setNoteResizeStartSizes({});
      setDragStartPos(null);
      setIsActuallyDragging(false);
      setDragStartDevicePositions({}); // Clear initial positions after drag
      lastDragPositionRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
      }
    };
  }, [isPanning, panStart, draggedDevice, draggedNoteId, resizingNoteId, noteDragStartPos, noteResizeStartPos, noteResizeStartSizes, zoom, pan, isDrawingConnection, getCanvasCoords, getCanvasDimensions, dragStartPos, isActuallyDragging, getDistance, onDeviceSelect, saveToHistory, selectedDeviceIds, selectedNoteIds, dragStartDevicePositions, noteDragStartPositions, notes, connections, devices, onTopologyChange]);

  // Global touch event handlers for device dragging on mobile
  useEffect(() => {
    if (!isMobile) return;

    const handleGlobalTouchMove = (e: globalThis.TouchEvent) => {
      if (e.touches.length !== 1 || !touchDraggedDevice || !canvasRef.current) return;

      const touch = e.touches[0];

      // Check if we've moved enough to consider it a drag
      if (touchDragStartPos) {
        const distance = getDistance(touchDragStartPos.x, touchDragStartPos.y, touch.clientX, touch.clientY);
        if (distance > DRAG_THRESHOLD) {
          setIsTouchDragging(true);
        }
      }

      if (isTouchDragging) {
        e.preventDefault(); // Prevent page scroll
        const rect = canvasRef.current.getBoundingClientRect();
        const newX = (touch.clientX - rect.left - pan.x - touchDragOffset.x) / zoom;
        const newY = (touch.clientY - rect.top - pan.y - touchDragOffset.y) / zoom;

        // Clamp to canvas bounds
        const canvasDims = getCanvasDimensions();
        const clampedX = Math.max(50, Math.min(newX, canvasDims.width - 120));
        const clampedY = Math.max(50, Math.min(newY, canvasDims.height - 150));

        // Store position in ref for animation frame
        lastDragPositionRef.current = { x: clampedX, y: clampedY };

        // Use requestAnimationFrame for smooth updates
        if (!dragAnimationFrameRef.current) {
          dragAnimationFrameRef.current = requestAnimationFrame(() => {
            if (lastDragPositionRef.current && touchDraggedDevice) {
              setDevices((prev) =>
                prev.map((d) =>
                  d.id === touchDraggedDevice
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
  }, [isMobile, touchDraggedDevice, touchDragOffset, touchDragStartPos, isTouchDragging, pan, zoom, getDistance, devices, onDeviceSelect, longPressTimer]);

  // Handle device drag start
  const handleDeviceMouseDown = useCallback((e: ReactMouseEvent, deviceId: string) => {
    e.stopPropagation();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;

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

    if (e.shiftKey) {
      return;
    }

    setSelectedDeviceIds([device.id]);
    setSelectedNoteIds([]);
    // Notify parent component - select device, don't open terminal
    onDeviceSelect(device.type, device.id);
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

  const handleNoteMouseDown = useCallback((e: ReactMouseEvent, noteId: string) => {
    e.stopPropagation();
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    setDraggedNoteId(noteId);
    setNoteDragStartPos(coords);
    const nextSelected = e.shiftKey
      ? (selectedNoteIds.includes(noteId) ? selectedNoteIds.filter(id => id !== noteId) : [...selectedNoteIds, noteId])
      : [noteId];
    setSelectedDeviceIds([]);
    setSelectedNoteIds(nextSelected);
    const targets = nextSelected.includes(noteId) ? nextSelected : [noteId];
    const startPositions: { [key: string]: { x: number; y: number } } = {};
    targets.forEach(id => {
      const n = notes.find(nn => nn.id === id);
      if (n) startPositions[id] = { x: n.x, y: n.y };
    });
    setNoteDragStartPositions(startPositions);
    setContextMenu(null);
    setSelectAllMode(false);
  }, [notes, getCanvasCoords, selectedNoteIds]);

  const handleNoteContextMenu = useCallback((
    e: ReactMouseEvent,
    noteId: string,
    mode: 'note-style' | 'note-edit'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY, null, noteId, mode);
  }, [openContextMenu]);

  const handleNoteResizeStart = useCallback((e: ReactMouseEvent, noteId: string) => {
    e.stopPropagation();
    const coords = getCanvasCoords(e.clientX, e.clientY);
    setResizingNoteId(noteId);
    setNoteResizeStartPos(coords);
    const start = notes.find(n => n.id === noteId);
    if (start) {
      setNoteResizeStartSizes({ [noteId]: { width: start.width, height: start.height } });
    }
  }, [getCanvasCoords, notes]);

  const updateNoteText = useCallback((noteId: string, text: string) => {
    setNotes(prev => prev.map(n => (n.id === noteId ? { ...n, text } : n)));
  }, []);

  const getNoteTextarea = useCallback((noteId: string) => {
    return noteTextareaRefs.current[noteId] || null;
  }, []);

  const handleNoteTextSelectAll = useCallback((noteId: string) => {
    const el = getNoteTextarea(noteId);
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, el.value.length);
  }, [getNoteTextarea]);

  const handleNoteTextCopy = useCallback(async (noteId: string) => {
    const el = getNoteTextarea(noteId);
    if (!el) return;
    el.focus();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const text = start !== end ? el.value.slice(start, end) : el.value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      document.execCommand('copy');
    }
  }, [getNoteTextarea]);

  const handleNoteTextCut = useCallback(async (noteId: string) => {
    const el = getNoteTextarea(noteId);
    if (!el) return;
    el.focus();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const text = start !== end ? el.value.slice(start, end) : el.value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      document.execCommand('copy');
    }
    if (start !== end) {
      const next = el.value.slice(0, start) + el.value.slice(end);
      el.value = next;
      el.setSelectionRange(start, start);
      updateNoteText(noteId, el.value);
    } else {
      updateNoteText(noteId, '');
    }
  }, [getNoteTextarea, updateNoteText]);

  const handleNoteTextPaste = useCallback(async (noteId: string) => {
    const el = getNoteTextarea(noteId);
    if (!el) return;
    el.focus();
    try {
      const text = await navigator.clipboard.readText();
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const next = el.value.slice(0, start) + text + el.value.slice(end);
      el.value = next;
      el.setSelectionRange(start + text.length, start + text.length);
      updateNoteText(noteId, el.value);
    } catch {
      document.execCommand('paste');
      updateNoteText(noteId, el.value);
    }
  }, [getNoteTextarea, updateNoteText]);

  const handleNoteTextDelete = useCallback((noteId: string) => {
    const el = getNoteTextarea(noteId);
    if (!el) return;
    el.focus();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start !== end) {
      const next = el.value.slice(0, start) + el.value.slice(end);
      el.value = next;
      el.setSelectionRange(start, start);
      updateNoteText(noteId, el.value);
    } else {
      updateNoteText(noteId, '');
    }
  }, [getNoteTextarea, updateNoteText]);

  const commitNotesChange = useCallback((nextNotes: CanvasNote[]) => {
    saveToHistory();
    setNotes(nextNotes);
    if (onTopologyChange) {
      onTopologyChange(devices, connections, nextNotes);
    }
  }, [saveToHistory, onTopologyChange, devices, connections]);

  const updateNoteStyle = useCallback((noteId: string, patch: Partial<Pick<CanvasNote, 'color' | 'font' | 'fontSize' | 'opacity'>>) => {
    const nextNotes = notes.map(n => (n.id === noteId ? { ...n, ...patch } : n));
    commitNotesChange(nextNotes);
  }, [notes, commitNotesChange]);

  const deleteNote = useCallback((noteId: string) => {
    const nextNotes = notes.filter(n => n.id !== noteId);
    commitNotesChange(nextNotes);
  }, [notes, commitNotesChange]);

  const copyNotes = useCallback((ids: string[]) => {
    const selected = notes.filter(n => ids.includes(n.id));
    if (selected.length > 0) {
      setNoteClipboard(selected.map(n => ({ ...n })));
    }
  }, [notes]);

  const pasteNotes = useCallback((clientX?: number, clientY?: number) => {
    if (noteClipboard.length === 0) return;
    const canvasDims = getCanvasDimensions();
    let baseX = 120;
    let baseY = 120;

    if (clientX !== undefined && clientY !== undefined) {
      const coords = getCanvasCoords(clientX, clientY);
      baseX = coords.x;
      baseY = coords.y;
    }

    const offsetStep = 20;
    const now = Date.now();
    const newNotes = noteClipboard.map((n, idx) => {
      const x = Math.max(20, Math.min(baseX + idx * offsetStep, canvasDims.width - NOTE_DEFAULT_WIDTH - 20));
      const y = Math.max(20, Math.min(baseY + idx * offsetStep, canvasDims.height - NOTE_DEFAULT_HEIGHT - 20));
      return {
        ...n,
        id: `note-${now}-${idx}`,
        x,
        y
      };
    });

    const nextNotes = [...notes, ...newNotes];
    commitNotesChange(nextNotes);
  }, [noteClipboard, notes, getCanvasDimensions, getCanvasCoords, commitNotesChange]);

  // Handle right-click context menu with viewport clamping
  const handleContextMenu = useCallback((e: ReactMouseEvent, deviceId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Estimate menu dimensions (approximate)
    const menuWidth = 180;
    const menuHeight = deviceId ? 400 : 200; // Device menu is taller

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
    openContextMenu(e.clientX, e.clientY, deviceId || null, null, 'device');
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
    const isNote = (e.target as HTMLElement).closest('[data-note-id]') || false;
    if (isDevice || isNote) return; // handled by device/note handlers

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
        openContextMenu(t.clientX, t.clientY, null, null, 'canvas');
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
    const isNote = (e.target as HTMLElement).closest('[data-note-id]') || false;
    if (isDevice || isNote) return;

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

      // Calculate zoom factor
      const zoomFactor = newDistance / lastTouchDistance;
      let newZoom = zoom * zoomFactor;
      newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));

      if (newZoom !== zoom) {
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
        setConnectionError(language === 'tr' ? 'Bu port zaten kullanÄ±mda!' : 'This port is already in use!');
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
          ? 'Bir cihaz kendisine baÄŸlanamaz!'
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

      const updatedConnections = [...connections, newConnection];
      setConnections(updatedConnections);

      // Update port status
      const updatedDevices = devices.map((d) => {
        if (d.id === connectionStart.deviceId) {
          return {
            ...d,
            ports: d.ports.map((p) =>
              p.id === connectionStart.portId ? { ...p, status: 'connected' as const } : p
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
      });
      setDevices(updatedDevices);

      if (onTopologyChange) {
        onTopologyChange(updatedDevices, updatedConnections, notes);
      }

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
      const portSpacing = device.type === 'pc' ? 18 : 14;
      const startX = device.type === 'pc'
        ? 42.5 - (device.ports.length > 1 ? portSpacing / 2 : 0)
        : 14;
      const portX = device.x + startX + col * portSpacing;
      const portY = device.y + 80 + row * 14;

      setIsDrawingConnection(true);
      setConnectionStart({
        deviceId,
        portId,
        point: { x: portX, y: portY },
      });
    }
  }, [devices, connections, isDrawingConnection, connectionStart, cableInfo, onCableChange, saveToHistory, onTopologyChange, notes, language]);

  // generate an unused IP within 192.168.1.x (skip existing addresses)
  const generateUniqueIp = useCallback(() => {
    let suffix = 100;
    while (devices.some(d => d.ip === `192.168.1.${suffix}`) || suffix === 1 || suffix === 10) {
      suffix++;
    }
    return `192.168.1.${suffix}`;
  }, [devices]);

  const addNote = useCallback(() => {
    saveToHistory();
    const canvasDims = getCanvasDimensions();
    let x = 100;
    let y = 100;

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      x = (-pan.x + rect.width / 2) / zoom - NOTE_DEFAULT_WIDTH / 2;
      y = (-pan.y + rect.height / 2) / zoom - NOTE_DEFAULT_HEIGHT / 2;
    }

    const clampedX = Math.max(20, Math.min(x, canvasDims.width - NOTE_DEFAULT_WIDTH - 20));
    const clampedY = Math.max(20, Math.min(y, canvasDims.height - NOTE_DEFAULT_HEIGHT - 20));

    const newNote: CanvasNote = {
      id: `note-${Date.now()}`,
      text: language === 'tr' ? 'Not' : 'Note',
      x: clampedX,
      y: clampedY,
      width: NOTE_DEFAULT_WIDTH,
      height: NOTE_DEFAULT_HEIGHT,
      color: NOTE_COLORS[0],
      font: noteFonts[0],
      fontSize: 12,
      opacity: 1,
    };

    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    if (onTopologyChange) {
      onTopologyChange(devices, connections, updatedNotes);
    }
  }, [devices, connections, notes, pan, zoom, language, onTopologyChange, saveToHistory, getCanvasDimensions, noteFonts]);

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
    const updatedDevices = [...devices, newDevice];
    setDevices(updatedDevices);
    if (onTopologyChange) {
      onTopologyChange(updatedDevices, connections, notes);
    }
  }, [devices, connections, notes, saveToHistory, generateUniqueIp, onTopologyChange]);

  // No automatic effect - we trigger onTopologyChange manually on key events (add, delete, move end)
  // to avoid re-rendering the parent Home component on every drag frame.
  // Port Tooltip state
  const [portTooltip, setPortTooltip] = useState<{
    deviceId: string;
    portId: string;
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const portTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPortTooltip = useCallback((e: ReactMouseEvent | MouseEvent, deviceId: string, portId: string) => {
    // Don't show tooltip while dragging
    if (isActuallyDragging || isTouchDragging) return;

    const device = devices.find(d => d.id === deviceId);
    const port = device?.ports.find(p => p.id === portId);
    if (!device || !port) return;

    if (portTooltipTimerRef.current) {
      clearTimeout(portTooltipTimerRef.current);
    }

    setPortTooltip({
      deviceId,
      portId,
      x: e.clientX,
      y: e.clientY,
      visible: true,
    });

    portTooltipTimerRef.current = setTimeout(() => {
      setPortTooltip(prev => prev ? { ...prev, visible: false } : null);
    }, 1500);
  }, [devices]);

  const handlePortHover = useCallback((e: ReactMouseEvent, deviceId: string, portId: string) => {
    showPortTooltip(e, deviceId, portId);
  }, [showPortTooltip]);

  const handlePortMouseLeave = useCallback(() => {
    // We don't immediately hide on leave if we want it to stay for 3s
    // but we could if needed. The requirement says 3s after open.
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
  useEffect(() => {
    if (!deviceStates || devices.length === 0) return;

    let hasChanges = false;
    const updatedDevices = devices.map(device => {
      const deviceState = deviceStates.get(device.id);
      if (!deviceState) return device;

      const updatedPorts = device.ports.map(port => {
        // Find corresponding port in deviceState
        const simulatorPort = deviceState.ports[port.id];
        if (simulatorPort && simulatorPort.shutdown !== port.shutdown) {
          hasChanges = true;
          return { ...port, shutdown: simulatorPort.shutdown };
        }
        return port;
      });

      if (hasChanges) {
        return { ...device, ports: updatedPorts };
      }
      return device;
    });

    if (hasChanges) {
      setDevices(updatedDevices);
    }
  }, [deviceStates, devices]);


  // Delete connection
  const deleteConnection = useCallback((connectionId: string) => {
    saveToHistory();
    const conn = connections.find((c) => c.id === connectionId);
    let updatedDevices = devices;
    let updatedConnections = connections.filter((c) => c.id !== connectionId);

    if (conn) {
      updatedDevices = devices.map((d) => {
        if (d.id === conn.sourceDeviceId || d.id === conn.targetDeviceId) {
          return {
            ...d,
            ports: d.ports.map((p) =>
              p.id === conn.sourcePort || p.id === conn.targetPort
                ? { ...p, status: 'notconnect' as const }
                : p
            ),
          };
        }
        return d;
      });
      setDevices(updatedDevices);
    }
    setConnections(updatedConnections);

    if (onTopologyChange) {
      onTopologyChange(updatedDevices, updatedConnections, notes);
    }
  }, [connections, devices, saveToHistory, onTopologyChange, notes]);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPan({ x: 0, y: 0 });
  }, []);

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    saveToHistory();
    setDevices([]);
    setConnections([]);
    setNotes([]);
    setSelectedDeviceIds([]);
    deviceCounterRef.current = { pc: 0, switch: 0, router: 0 };
    if (onTopologyChange) {
      onTopologyChange([], [], []);
    }
  }, [saveToHistory, onTopologyChange]);

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
    }
    setRenamingDevice(null);
    setRenameValue('');
  }, [renamingDevice, renameValue, saveToHistory]);
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

  // Handle key events: ESC to close context menu, DELETE to remove devices, Ctrl+A to select all
  useEffect(() => {
    const handleCloseBroadcast = (e: CustomEvent<{ source?: string }>) => {
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
          if (selectedDeviceIds.length > 0) setSelectedDeviceIds([]);
        }
      }
    };
    window.addEventListener('close-menus-broadcast', handleCloseBroadcast as EventListener);

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const activeEl = document.activeElement as HTMLElement | null;
      const isNoteTextarea = !!activeEl && activeEl.hasAttribute('data-note-textarea');
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

      // Close context menu on ESC (Duplicate logic above, but being thorough)
      if (key === 'escape') {
        setContextMenu(null);
        // Also cancel config if active
        if (configuringDevice) {
          cancelDeviceConfig();
        }
        // Cancel select all mode
        if (selectedDeviceIds.length > 0) {
          setSelectedDeviceIds([]);
        }
        if (selectedNoteIds.length > 0) {
          setSelectedNoteIds([]);
        }
        // Close Ping Source
        if (pingSource) {
          setPingSource(null);
        }
        // Close Port Selector
        if (showPortSelector) {
          setShowPortSelector(false);
          setPortSelectorStep('source');
          setSelectedSourcePort(null);
        }
        return;
      }

      // Don't handle other keys if a modal is open
      if (configuringDevice) {
        return;
      }

      // Allow native text editing when a note textarea is focused
      if (isNoteTextarea) {
        return;
      }

      // Delete selected device(s)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDeviceIds.length > 0) {
          saveToHistory();
          selectedDeviceIds.forEach(id => deleteDevice(id));
          setSelectedDeviceIds([]);
        }
        if (selectedNoteIds.length > 0) {
          commitNotesChange(notes.filter(n => !selectedNoteIds.includes(n.id)));
          setSelectedNoteIds([]);
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);

    };
  }, [selectedDeviceIds, selectedNoteIds, deleteDevice, commitNotesChange, configuringDevice, cancelDeviceConfig, selectAllDevices, saveToHistory, devices, notes, onDeviceDelete, isDrawingConnection, isPaletteOpen, handleUndo, handleRedo, copyDevice, cutDevice, pasteDevice, pingSource, showPortSelector, toggleFullscreen, isFullscreen]);

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

    // Find path between source and target
    const path = findPath(sourceId, targetId);

    if (!path || path.length < 2) {
      // No path found - show error
      setPingAnimation({
        sourceId,
        targetId,
        path: [sourceId, targetId],
        currentHopIndex: 0,
        progress: 1,
        success: false
      });
      setTimeout(() => setPingAnimation(null), 2500);
      return;
    }

    // Start ping animation
    setPingAnimation({
      sourceId,
      targetId,
      path,
      currentHopIndex: 0,
      progress: 0,
      success: null
    });

    // Animate ping - each hop takes 1000ms
    const hopDuration = 1000;
    let startTime = Date.now();
    let currentHop = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / hopDuration, 1);

      setPingAnimation(prev => {
        if (!prev) return null;
        return { ...prev, currentHopIndex: currentHop, progress };
      });

      if (progress < 1) {
        pingAnimationRef.current = requestAnimationFrame(animate);
      } else {
        // Move to next hop
        currentHop++;
        if (currentHop < path.length - 1) {
          startTime = Date.now();
          pingAnimationRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete - show success
          setPingAnimation(prev => prev ? { ...prev, success: true } : null);
          setTimeout(() => setPingAnimation(null), 2500);
        }
      }
    };

    pingAnimationRef.current = requestAnimationFrame(animate);
  }, [connections, findPath]);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Get device position (center based on device type)
  const getDeviceCenter = useCallback((device: CanvasDevice) => {
    const deviceWidth = device.type === 'pc' ? 85 : 130;
    const portsPerRow = 8;
    const numRows = Math.ceil(device.ports.length / portsPerRow);
    const deviceHeight = device.type === 'pc' ? 85 : 80 + numRows * 14 + 5;
    return { x: device.x + deviceWidth / 2, y: device.y + deviceHeight / 2 };
  }, []);

  // Get port position on device
  const getPortPosition = useCallback((device: CanvasDevice, portId: string) => {
    const portIndex = device.ports.findIndex(p => p.id === portId);
    if (portIndex === -1) return getDeviceCenter(device);

    const deviceWidth = device.type === 'pc' ? 85 : 130;
    const portsPerRow = device.type === 'pc' ? 2 : 8;
    const col = portIndex % portsPerRow;
    const row = Math.floor(portIndex / portsPerRow);
    const portSpacing = device.type === 'pc' ? 18 : 14;
    const rowSpacing = 14;
    // Center ports in the wider device
    const startX = device.type === 'pc' ? deviceWidth / 2 - (device.ports.length > 1 ? portSpacing / 2 : 0) : 14;
    const startY = device.type === 'pc' ? 80 : 80;

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
              {conn.sourcePort} â†” {conn.targetPort}
            </text>
            <text
              x={midX + perpX}
              y={midY + perpY - 8}
              fill={color}
              fontSize="10"
              textAnchor="middle"
              className="pointer-events-none select-none"
            >
              {conn.sourcePort} â†” {conn.targetPort}
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
              {conn.sourcePort} â†” {conn.targetPort}
            </text>
            <text
              x={midX}
              y={midY - 10}
              fill={color}
              fontSize="10"
              textAnchor="middle"
              className="pointer-events-none select-none"
            >
              {conn.sourcePort} â†” {conn.targetPort}
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
          strokeWidth={15}
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
            {/* Subtle background rectangle instead of circle */}
            <rect x="-8" y="-9" width="16" height="18" rx="3" fill={isDark ? '#0f172a' : '#ffffff'} opacity="0.9" className="drop-shadow-sm" />
            <g transform="translate(0, 0)">
              <path
                d="M -5 -3 H 5 M -3.5 -3 V 5.5 A 1 1 0 0 0 -2.5 6.5 H 2.5 A 1 1 0 0 0 3.5 5.5 V -3 M -1.5 -3 V -5 H 1.5 V -3"
                stroke="#ef4444"
                fill="none"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>
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

    const statusColor = hasError
      ? (isDark ? 'fill-red-500' : 'fill-red-600')
      : (hasConnection ? (isDark ? 'fill-green-500' : 'fill-green-600') : (isDark ? 'fill-slate-800' : 'fill-slate-300'));

    // Calculate device height based on number of ports (8 per row for switch/router)
    const portsPerRow = device.type === 'pc' ? 2 : 8;
    const numRows = Math.ceil(device.ports.length / portsPerRow);
    const deviceHeight = device.type === 'pc' ? 85 : 80 + numRows * 14 + 5;

    // Calculate device width to fit all ports with proper spacing
    // For switch/router: startX=12, portSpacing=13, portRadius=6
    // Width needed = startX + (portsPerRow - 1) * portSpacing + portRadius + margin
    // For 8 ports: 12 + 7*13 + 6 + 10 = 119, so we use 130 for more breathing room
    const deviceWidth = device.type === 'pc' ? 85 : 130;

    return (
      <g
        key={device.id}
        transform={`translate(${device.x}, ${device.y})`}
        className={`cursor-move ${isDragging ? 'opacity-80' : ''}`}
        data-device-id={device.id}
      >
        {/* Device body */}
        <rect
          width={deviceWidth}
          height={deviceHeight}
          rx={8}
          fill={isDark ? '#1e293b' : '#fff'}
          stroke={isSelected ? '#06b6d4' : isDark ? '#475569' : '#cbd5e1'}
          strokeWidth={isSelected ? 2 : 1}
          className={isDragging ? '' : 'transition-all duration-150'}
        />

        {/* Device icon */}
        <g transform={`translate(${deviceWidth / 2 - 12}, 10)`}>
          <g
            className={
              device.type === 'pc'
                ? 'text-blue-500'
                : device.type === 'switch'
                  ? 'text-emerald-500'
                  : 'text-purple-500'
            }
            style={{ color: 'currentColor' }}
          >
            {device.type === 'pc' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                stroke="currentColor"
                fill="none"
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z"
                transform="scale(1.2)"
              />
            )}
            {device.type === 'switch' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                stroke="currentColor"
                fill="none"
                d="M5 12h14M5 12a2 2 0 0 1 -2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2M5 12a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 -2-2m-2-4h.01M17 16h.01"
                transform="scale(1.2)"
              />
            )}
            {device.type === 'router' && (
              <g transform="scale(1.2)">
                <circle cx="12" cy="12" r="9" strokeWidth={1.5} stroke="currentColor" fill="none" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} stroke="currentColor" fill="none" d="M12 5v14M5 12h14M12 5l-2 2m2-2l2 2m-2 12l-2-2m2 2l2-2M5 12l2-2m-2 2l2 2M19 12l-2-2m2 2l-2 2" />
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

        {/* Ports - wrapped 6 per row */}
        {device.type === 'pc' ? (
          // PC has Eth0 and COM1 ports, show side by side
          device.ports.map((port, idx) => {
            // ï¿½ki portu yan yana gï¿½ster
            const portSpacing = 18;
            const startX = deviceWidth / 2 - (device.ports.length > 1 ? portSpacing / 2 : 0);
            const portX = startX + idx * portSpacing;
            const portY = 80;
            const isConnected = port.status === 'connected';
            const isShutdown = port.shutdown;

            // Determine port label: E for Ethernet, C for COM/Console
            const isConsolePort = port.id.toLowerCase().startsWith('com') || port.id.toLowerCase() === 'console';
            const portLabel = isConsolePort ? 'C' : 'E';

            // Port colors:
            // PC Ethernet: Blue, PC COM (Console): Turquoise
            // Shutdown: Red
            const portColor = isShutdown ? '#ef4444' :
              isConsolePort
                ? (isConnected ? '#06b6d4' : '#0891b2')  // Turquoise for console
                : (isConnected ? '#3b82f6' : '#1d4ed8'); // Blue for ethernet

            return (
              <g
                key={port.id}
                transform={`translate(${portX}, ${portY})`}
                className="cursor-pointer"
                onClick={(e) => {
                  handlePortClick(e as unknown as ReactMouseEvent, device.id, port.id);
                  showPortTooltip(e as unknown as ReactMouseEvent, device.id, port.id);
                }}
                onMouseEnter={(e) => handlePortHover(e, device.id, port.id)}
                onMouseLeave={handlePortMouseLeave}
              >
                <circle
                  r={7}
                  fill={portColor}
                  stroke={isShutdown ? '#991b1b' : isConnected ? '#22c55e' : '#4b5563'}
                  strokeWidth={isShutdown || isConnected ? 2 : 1}
                />
                <text y={1} fill="#fff" fontSize="7" textAnchor="middle" dominantBaseline="middle" className="select-none pointer-events-none">
                  {portLabel}
                </text>
              </g>
            );
          })
        ) : (
          // Switch/Router - wrap 8 ports per row for wider device
          device.ports.map((port, idx) => {
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

            // Check if port is blocked by STP (spanning tree)
            const deviceState = deviceStates?.get(device.id);
            const isBlocked = deviceState?.ports[port.id]?.status === 'blocked';
            const isDownOrBlocked = isShutdown || isBlocked;

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
            // Shutdown/Blocked: Red/Orange background with RED stroke
            let portFill: string;
            let portStroke: string;

            if (isDownOrBlocked) {
              portFill = isShutdown ? '#ef4444' : '#f97316'; // Red for shutdown, Orange for blocked
              portStroke = '#ff0000'; // Explicit RED border
            } else if (isConsole) {
              portFill = isConnected ? '#06b6d4' : '#0891b2'; // Turquoise
              portStroke = isConnected ? '#22c55e' : '#0891b2';
            } else if (isGigabit) {
              portFill = isConnected ? '#f97316' : '#c2410c'; // Orange
              portStroke = isConnected ? '#22c55e' : '#c2410c';
            } else if (isFastEthernet) {
              portFill = isConnected ? '#3b82f6' : '#1d4ed8'; // Blue
              portStroke = isConnected ? '#22c55e' : '#1d4ed8';
            } else {
              portFill = isConnected ? '#22c55e' : '#6b7280'; // Default green/gray
              portStroke = isConnected ? '#22c55e' : '#4b5563';
            }

            return (
              <g
                key={port.id}
                transform={`translate(${portX}, ${portY})`}
                className="cursor-pointer"
                onClick={(e) => {
                  handlePortClick(e as unknown as ReactMouseEvent, device.id, port.id);
                  showPortTooltip(e as unknown as ReactMouseEvent, device.id, port.id);
                }}
                onMouseEnter={(e) => handlePortHover(e, device.id, port.id)}
                onMouseLeave={handlePortMouseLeave}
              >
                <circle
                  r={6}
                  fill={portFill}
                  stroke={isDownOrBlocked || isConnected ? portStroke : '#4b5563'}
                  strokeWidth={isDownOrBlocked || isConnected ? 2.5 : 1}
                  className={isDownOrBlocked ? 'animate-pulse' : ''}
                />
                <text y={1} fill="#fff" fontSize="6" textAnchor="middle" dominantBaseline="middle" className="select-none pointer-events-none font-bold">
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

    return (
      <line
        x1={source.x}
        y1={source.y}
        x2={mousePos.x}
        y2={mousePos.y}
        stroke={CABLE_COLORS[cableInfo.cableType].primary}
        strokeWidth={2}
        strokeDasharray="5,5"
        className="pointer-events-none"
      />
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
            {language === 'tr' ? 'Cihazlar' : 'Devices'}
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
                  type === 'pc' ? 'text-blue-500' : type === 'switch' ? 'text-emerald-500' : 'text-purple-500'
                }>
                  <div className="scale-75">{DEVICE_ICONS[type]}</div>
                </div>
                <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {type === 'pc' ? 'PC' : type.charAt(0).toUpperCase() + type.slice(1)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Cable Type Selector */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className={`text-[10px] font-bold tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'} whitespace-nowrap`}>
            {language === 'tr' ? 'Kablonuz' : 'Cable'}
          </div>
          <div className="flex gap-1.5">
            {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
              <button
                key={type}
                onClick={() => {
                  onCableChange({ ...cableInfo, cableType: type });

                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${cableInfo.cableType === type
                  ? `${CABLE_COLORS[type].bg} text-white border-transparent`
                  : isDark
                    ? 'border-slate-700 bg-slate-800 text-slate-300'
                    : 'border-slate-300 bg-white text-slate-600'
                  }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${CABLE_COLORS[type].bg}`} />
                {type === 'straight'
                  ? language === 'tr' ? 'Dï¿½z' : 'Str'
                  : type === 'crossover'
                    ? language === 'tr' ? 'ï¿½ap' : 'Cro'
                    : language === 'tr' ? 'Kon' : 'Con'}
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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 px-2 py-2 safe-area-bottom">
      <div className="flex items-center justify-around gap-1">
        {/* Add Device */}
        <button
          onClick={() => setIsPaletteOpen(true)}
          className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg min-h-[48px] min-w-[48px] bg-slate-800 hover:bg-slate-700"
        >
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-xs text-slate-300">{language === 'tr' ? 'Ekle' : 'Add'}</span>
        </button>

        {/* Cable Type */}
        <button
          onClick={() => setIsPaletteOpen(true)}
          className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg min-h-[48px] min-w-[48px] bg-slate-800 hover:bg-slate-700"
        >
          <div className={`w-4 h-4 rounded ${CABLE_COLORS[cableInfo.cableType].bg}`} />
          <span className="text-xs text-slate-300">
            {cableInfo.cableType === 'straight'
              ? language === 'tr' ? 'Dï¿½z' : 'Straight'
              : cableInfo.cableType === 'crossover'
                ? language === 'tr' ? 'ï¿½apraz' : 'X-over'
                : language === 'tr' ? 'Konsol' : 'Console'}
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
            âˆ’
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
      className={`${isFullscreen ? 'fixed inset-[20px] z-[9999] rounded-xl shadow-2xl' : 'relative rounded-xl border-2 overflow-hidden'} flex flex-col transition-all duration-300 ${isDark
        ? 'bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90 border-slate-600/50'
        : 'bg-gradient-to-br from-blue-50/50 via-white to-slate-50/80 border-slate-300/50'
        }`}
    >
      {/* Header with Tools */}
      <div
        className={`px-4 py-2 border-b shrink-0 ${isDark ? 'border-slate-700/50 bg-slate-800/80' : 'border-slate-200/50 bg-white/80'} backdrop-blur-md sticky top-0 z-40`}
      >
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Network className="w-5 h-5 text-cyan-500 shrink-0" />
              <span className="hidden xl:inline">{language === 'tr' ? 'Ağ Topolojisi' : 'Network Topology'}</span>
            </h3>

            {/* MD/LG Screen Quick Tools */}
            <div className="hidden md:flex items-center pl-4 border-l border-slate-700/30">
              <div className={`flex items-center gap-2 p-1 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-700/30' : 'bg-blue-50/50 border-blue-100/50'}`}>
                {/* Devices Group */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => addDevice('pc')}
                    title={language === 'tr' ? "PC Ekle" : "Add PC"}
                    className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-slate-700 text-blue-500' : 'hover:bg-slate-100 text-blue-600'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => addDevice('switch')}
                    title={language === 'tr' ? "Switch Ekle" : "Add Switch"}
                    className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-slate-700 text-emerald-500' : 'hover:bg-slate-100 text-emerald-600'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 0 1 -2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2M5 12a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 -2-2m-2-4h.01M17 16h.01" />
                    </svg>
                  </button>
                  <button
                    onClick={() => addDevice('router')}
                    title={language === 'tr' ? "Router Ekle" : "Add Router"}
                    className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-slate-700 text-purple-500' : 'hover:bg-slate-100 text-purple-600'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14M5 12h14M12 5l-2 2m2-2l2 2m-2 12l-2-2m2 2l2-2M5 12l2-2m-2 2l2 2M19 12l-2-2m2 2l-2 2" />
                    </svg>
                  </button>
                </div>

                {/* Separator */}
                <div className={`w-px h-6 ${isDark ? 'bg-slate-700/50' : 'bg-slate-300'} mx-1`} />

                {/* Cable Types Group */}
                <div className="flex items-center gap-1">
                  {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => onCableChange({ ...cableInfo, cableType: type })}
                      title={type.charAt(0).toUpperCase() + type.slice(1)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all ${cableInfo.cableType === type
                        ? `${CABLE_COLORS[type].bg} text-white`
                        : isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${CABLE_COLORS[type].bg}`} />
                      <span className="text-[10px] font-bold">
                        {type === 'straight' ? (language === 'tr' ? 'Dï¿½z' : 'Str') :
                          type === 'crossover' ? (language === 'tr' ? 'ï¿½ap' : 'Cro') :
                            (language === 'tr' ? 'Kon' : 'Con')}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Separator */}
                <div className={`w-px h-6 ${isDark ? 'bg-slate-700/50' : 'bg-slate-300'} mx-1`} />

                {/* Notes */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={addNote}
                    title={language === 'tr' ? 'Not Ekle' : 'Add Note'}
                    className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-slate-700 text-amber-300' : 'hover:bg-slate-100 text-amber-500'}`}
                  >
                    <StickyNote className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Mobile Toolset */}
            <div className={`flex md:hidden items-center gap-1 p-1 rounded-xl border ${isDark ? 'bg-slate-900/30 border-slate-700/20' : 'bg-blue-50/50 border-blue-100/50'}`}>
              {/* Add Device Toggle */}
              <button
                onClick={() => setIsPaletteOpen(true)}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700 text-cyan-400' : 'hover:bg-slate-100 text-cyan-600'}`}
                title={language === 'tr' ? 'Cihaz Ekle' : 'Add Device'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v6m-3-3h6" />
                </svg>
              </button>

              {/* Cable Select Toggle */}
              <button
                onClick={() => setIsPaletteOpen(true)}
                className={`p-1.5 rounded-lg flex items-center gap-1 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                title={language === 'tr' ? 'Kablo Seç' : 'Select Cable'}
              >
                <div className={`w-3.5 h-3.5 rounded-full ${CABLE_COLORS[cableInfo.cableType].bg}`} />
              </button>

              {/* Add Note */}
              <button
                onClick={addNote}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700 text-amber-300' : 'hover:bg-slate-100 text-amber-500'}`}
                title={language === 'tr' ? 'Not Ekle' : 'Add Note'}
              >
                <StickyNote className="w-4 h-4" />
              </button>

              {/* Zoom Controls */}
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.25))}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <span className="text-lg font-bold">âˆ’</span>
                </button>
                <button
                  onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.25))}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <span className="text-lg font-bold">+</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setShowPortSelector(true);
                setPortSelectorStep('source');
                setSelectedSourcePort(null);
              }}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all ${isDark
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
                <SheetDescription className="sr-only">
                  Add new network devices or cables to the topology
                </SheetDescription>
              </SheetHeader>
              <div className="p-6 space-y-8">
                {/* Devices Section */}
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Devices</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(['pc', 'switch', 'router'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => { addDevice(type); setIsPaletteOpen(false); }}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${isDark ? 'bg-slate-800 border-slate-700 active:bg-slate-700' : 'bg-slate-50 border-slate-200 active:bg-slate-100'
                          }`}
                      >
                        <div className={type === 'pc' ? 'text-blue-500' : type === 'switch' ? 'text-emerald-500' : 'text-purple-500'}>
                          {type === 'pc' ? <Laptop className="w-6 h-6" /> : type === 'switch' ? <Monitor className="w-6 h-6" /> : <Network className="w-6 h-6" />}
                        </div>
                        <span className="text-xs font-bold capitalize">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cables Section */}
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Cable Types</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => { onCableChange({ ...cableInfo, cableType: type }); setIsPaletteOpen(false); }}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${cableInfo.cableType === type
                          ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                          : isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                          }`}
                      >
                        <div className={`w-4 h-4 rounded-full ${CABLE_COLORS[type].bg}`} />
                        <span className="text-xs font-bold capitalize">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Annotations Section */}
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">
                    {language === 'tr' ? 'Notlar' : 'Annotations'}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => { addNote(); setIsPaletteOpen(false); }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${isDark ? 'bg-slate-800 border-slate-700 active:bg-slate-700' : 'bg-slate-50 border-slate-200 active:bg-slate-100'
                        }`}
                    >
                      <StickyNote className="w-6 h-6 text-amber-400" />
                      <span className="text-xs font-bold">{language === 'tr' ? 'Not' : 'Note'}</span>
                    </button>
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
                    onClick={() => setSelectedDeviceIds([])}
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
            className="w-full flex-1 min-h-[450px] overflow-hidden cursor-grab active:cursor-grabbing relative touch-none select-none"
            onMouseDown={handleCanvasMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => {
              if (isDrawingConnection) {
                setIsDrawingConnection(false);
                setConnectionStart(null);
              }
              // Cancel select all mode on click
              if (selectAllMode) {
                setSelectAllMode(false);
              }
            }}
            onContextMenu={(e) => handleContextMenu(e as unknown as ReactMouseEvent)}
          >
            {/* SVG Layer with Grid and Content */}
            <svg
              width="100%"
              height="100%"
              className="select-none"
            >
              <g
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  transformOrigin: '0 0',
                  willChange: 'transform'
                }}
              >
                {/* Clip path for canvas boundaries */}
                <defs>
                  <clipPath id="canvasClip">
                    <rect x="0" y="0" width={getCanvasDimensions().width} height={getCanvasDimensions().height} />
                  </clipPath>
                  {/* Grid pattern */}
                  <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="1" fill={isDark ? '#334155' : '#94a3b8'} />
                  </pattern>
                </defs>

                {/* Canvas Background with Grid - clipped to boundaries */}
                <g clipPath="url(#canvasClip)">
                  {/* Background */}
                  <rect
                    x="0"
                    y="0"
                    width={getCanvasDimensions().width}
                    height={getCanvasDimensions().height}
                    fill={isDark ? '#1e293b' : '#f8fafc'}
                  />
                  {/* Grid */}
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

                  {/* Devices */}
                  {devices.map((device) => {
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
                        className={`pointer-events-auto relative flex flex-col w-full h-full rounded-lg shadow-lg border ${isDark
                          ? 'border-amber-300/60 text-slate-900'
                          : 'border-yellow-200 text-slate-800'
                          } ${selectedNoteIds.includes(note.id) ? 'ring-2 ring-emerald-400/70' : ''}`}
                        data-note-id={note.id}
                        style={{ backgroundColor: note.color, fontFamily: note.font, opacity: note.opacity }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey) {
                            setSelectedNoteIds(prev => prev.includes(note.id) ? prev.filter(id => id !== note.id) : [...prev, note.id]);
                          } else {
                            setSelectedNoteIds([note.id]);
                            setSelectedDeviceIds([]);
                          }
                        }}
                        onContextMenu={(e) => handleNoteContextMenu(e as unknown as ReactMouseEvent, note.id, 'note-edit')}
                      >
                        <div
                          data-note-drag-handle
                          onMouseDown={(e) => handleNoteMouseDown(e as unknown as ReactMouseEvent, note.id)}
                          onContextMenu={(e) => handleNoteContextMenu(e as unknown as ReactMouseEvent, note.id, 'note-style')}
                          className={`flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-widest cursor-move select-none ${isDark ? 'bg-black/10' : 'bg-black/5'
                            }`}
                          style={{ height: NOTE_HEADER_HEIGHT }}
                        >
                          <span />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNote(note.id);
                            }}
                            className="px-1.5 py-0.5 rounded hover:bg-black/10"
                            title={language === 'tr' ? 'Sil' : 'Delete'}
                          >
                            Ã—
                          </button>
                        </div>
                        <textarea
                          ref={(el) => { noteTextareaRefs.current[note.id] = el; }}
                          data-note-textarea
                          value={note.text}
                          onChange={(e) => updateNoteText(note.id, e.target.value)}
                          onBlur={() => {
                            saveToHistory();
                            if (onTopologyChange) {
                              onTopologyChange(devices, connections, notes);
                            }
                          }}
                          className="flex-1 px-2 py-1 bg-transparent outline-none resize-none"
                          style={{ fontSize: note.fontSize, height: note.height - NOTE_HEADER_HEIGHT - 6 }}
                        />
                        <div
                          className="absolute right-1 bottom-1 w-4 h-4 cursor-se-resize"
                          onMouseDown={(e) => handleNoteResizeStart(e as unknown as ReactMouseEvent, note.id)}
                          title={language === 'tr' ? 'Boyutu Değiştir' : 'Resize'}
                        >
                          <svg viewBox="0 0 12 12" className="w-full h-full text-black/50">
                            <path d="M4 12 L12 4" stroke="currentColor" strokeWidth="1" />
                            <path d="M7 12 L12 7" stroke="currentColor" strokeWidth="1" />
                            <path d="M10 12 L12 10" stroke="currentColor" strokeWidth="1" />
                          </svg>
                        </div>
                      </div>
                    </foreignObject>
                  ))}

                  {/* Connection interaction handles (Trash icons) - Rendered LAST to stay on top */}
                  {connections.map((conn) => renderConnectionHandle(conn))}

                  {/* Ping Animation Envelope - rendered inside transformed group */}
                  {pingAnimation && (() => {
                    const { path, currentHopIndex, progress, success } = pingAnimation;
                    if (!path || path.length < 2 || success !== null) return null;

                    // Get current hop devices
                    const fromDevice = devices.find(d => d.id === path[currentHopIndex]);
                    const toDevice = devices.find(d => d.id === path[currentHopIndex + 1]);
                    if (!fromDevice || !toDevice) return null;

                    // Find connection between these devices to get the bezier curve
                    const conn = connections.find(
                      c => (c.sourceDeviceId === fromDevice.id && c.targetDeviceId === toDevice.id) ||
                        (c.sourceDeviceId === toDevice.id && c.targetDeviceId === fromDevice.id)
                    );

                    // Get port positions for this connection
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
                    const midY = (source.y + target.y) / 2;

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

                    const controlPoint1 = {
                      x: midX + perpX,
                      y: source.y + perpY + Math.abs(offset) * 0.5
                    };
                    const controlPoint2 = {
                      x: midX + perpX,
                      y: target.y + perpY - Math.abs(offset) * 0.5
                    };

                    // Calculate position on bezier curve using cubic bezier formula
                    const t = progress;
                    const t2 = t * t;
                    const t3 = t2 * t;
                    const mt = 1 - t;
                    const mt2 = mt * mt;
                    const mt3 = mt2 * mt;

                    // Cubic bezier position (on the cable path)
                    const bezierX = mt3 * source.x + 3 * mt2 * t * controlPoint1.x + 3 * mt * t2 * controlPoint2.x + t3 * target.x;
                    const bezierY = mt3 * source.y + 3 * mt2 * t * controlPoint1.y + 3 * mt * t2 * controlPoint2.y + t3 * target.y;

                    // Simplified perpendicular offset based on source/target direction
                    const angle = Math.atan2(target.y - source.y, target.x - source.x);
                    const envelopeOffsetX = Math.sin(angle) * 20;
                    const envelopeOffsetY = -Math.cos(angle) * 20;

                    return (
                      <g key={`ping-${currentHopIndex}`}>
                        <g transform={`translate(${bezierX + envelopeOffsetX}, ${bezierY + envelopeOffsetY})`}>
                          <circle r="10" fill="#06b6d4" opacity={0.2} className="animate-ping" />
                          <rect x="-12" y="-8" width="24" height="16" rx="2" fill="#06b6d4" stroke="#0891b2" strokeWidth="1.5" />
                          <path d="M-9 -5 L0 3 L9 -5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
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
                  {getCanvasDimensions().width} Ã— {getCanvasDimensions().height}
                </text>
              </g>
            </svg>
          </div>

          {/* Zoom Controls - Desktop Only - Top Right */}
          <div
            className={`hidden md:flex absolute top-2 right-2 items-center gap-1 px-2 py-1 rounded-lg ${isDark ? 'bg-slate-800/90' : 'bg-white/90'
              } shadow-lg`}
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
              âˆ’
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
            <button
              onClick={resetView}
              className={`px-2 py-1 text-xs rounded ${isDark
                ? 'hover:bg-slate-700 text-slate-300'
                : 'hover:bg-slate-100 text-slate-600'
                }`}
            >
              {language === 'tr' ? 'Sıfırla' : 'Reset'}
            </button>
            <button
              onClick={toggleFullscreen}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${isDark
                ? 'hover:bg-slate-700 text-slate-300'
                : 'hover:bg-slate-100 text-slate-600'
                }`}
              title="Ctrl+F"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              {isFullscreen ? (language === 'tr' ? 'KÃ¼Ã§Ã¼lt' : 'Exit') : (language === 'tr' ? 'Tam Ekran' : 'Full Screen')}
            </button>
          </div>

          {/* Minimap - Desktop Only - Below Zoom Controls */}
          <div
            className={`hidden md:block absolute top-12 right-2 w-32 h-20 rounded border cursor-pointer ${isDark ? 'border-slate-700 bg-slate-800/90' : 'border-slate-200 bg-white/90'
              } shadow-lg overflow-hidden`}
            title={language === 'tr' ? 'Harita üzerinden gezinmek için tıklayın' : 'Click on map to navigate'}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${getCanvasDimensions().width} ${getCanvasDimensions().height}`}
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
              {/* Mini devices */}
              {devices.map((device) => (
                <rect
                  key={device.id}
                  x={device.x}
                  y={device.y}
                  width={device.type === 'pc' ? 85 : 100}
                  height={device.type === 'pc' ? 85 : 120}
                  fill={
                    device.type === 'pc'
                      ? '#3b82f6'
                      : device.type === 'switch'
                        ? '#10b981'
                        : '#a855f7'
                  }
                  opacity={0.6}
                />
              ))}
              {/* Mini notes */}
              {notes.map((note) => (
                <rect
                  key={note.id}
                  x={note.x}
                  y={note.y}
                  width={note.width}
                  height={note.height}
                  fill={note.color}
                  opacity={note.opacity}
                />
              ))}
              {/* Viewport indicator */}
              <rect
                x={-pan.x / zoom}
                y={-pan.y / zoom}
                width={getCanvasDimensions().width / zoom}
                height={getCanvasDimensions().height / zoom}
                fill="none"
                stroke={isDark ? '#06b6d4' : '#0891b2'}
                strokeWidth={2}
              />
            </svg>
          </div>

          {/* Instructions - Bottom Right */}
          <div
            className={`absolute bottom-2 right-2 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'} max-w-48 text-right hidden sm:block`}
          >
            {language === 'tr'
              ? 'Tek tık: seç, Çift tık: terminal, Sürükleyin: taşın'
              : 'Click: select, Double-click: terminal, Drag: move'}
          </div>

          {/* Mobile Instructions */}
          <div
            className={`absolute bottom-2 right-2 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'} max-w-48 text-right sm:hidden`}
          >
            {language === 'tr'
              ? 'Dokun: seç, Çift dokun: terminal, Sürükleyin: taşın, Basılı tut: sil'
              : 'Tap: select, Double-tap: terminal, Drag: move, Long-press: delete'}
          </div>
        </div>
      </div>


      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className={`context-menu fixed z-50 py-1 rounded-lg shadow-xl min-w-[140px] max-w-[240px] ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'
            }`}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            maxHeight: '60vh',
            overflow: 'auto',
            resize: contextMenu.mode.startsWith('note') ? 'both' : 'none',
            minWidth: contextMenu.mode.startsWith('note') ? 180 : undefined,
            minHeight: contextMenu.mode.startsWith('note') ? 120 : undefined
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Note-specific actions */}
          {contextMenu.noteId && contextMenu.mode === 'note-style' && (
            <div className="px-2 py-2 space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                {language === 'tr' ? 'Not Biçimi' : 'Note Style'}
              </div>

              <div className="grid grid-cols-5 gap-1">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateNoteStyle(contextMenu.noteId!, { color: c })}
                    className="w-4 h-4 rounded border border-black/10"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>

              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">
                  {language === 'tr' ? 'Yazı Tipi' : 'Font'}
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {noteFonts.map((f) => (
                    <button
                      key={f}
                      onClick={() => updateNoteStyle(contextMenu.noteId!, { font: f })}
                      className={`px-2 py-1 rounded text-left text-[11px] ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                      style={{ fontFamily: f }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">
                  {language === 'tr' ? 'Boyut' : 'Size'}
                </div>
                <div className="flex gap-1">
                  {NOTE_FONT_SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateNoteStyle(contextMenu.noteId!, { fontSize: s })}
                      className={`px-2 py-1 rounded text-[11px] ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                    >
                      {s}px
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">
                  {language === 'tr' ? 'Saydamlık' : 'Opacity'}
                </div>
                <div className="flex gap-1">
                  {NOTE_OPACITY.map((o) => (
                    <button
                      key={o}
                      onClick={() => updateNoteStyle(contextMenu.noteId!, { opacity: o })}
                      className={`px-2 py-1 rounded text-[11px] ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                    >
                      {Math.round(o * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {contextMenu.noteId && contextMenu.mode === 'note-edit' && (
            <div className="px-2 py-2 space-y-1">
              <button
                onClick={() => {
                  handleNoteTextCut(contextMenu.noteId!);
                  setContextMenu(null);
                }}
                className={`w-full px-2 py-1.5 text-xs text-left ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
              >
                {language === 'tr' ? 'Kes' : 'Cut'}
              </button>
              <button
                onClick={() => {
                  handleNoteTextCopy(contextMenu.noteId!);
                  setContextMenu(null);
                }}
                className={`w-full px-2 py-1.5 text-xs text-left ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
              >
                {language === 'tr' ? 'Kopyala' : 'Copy'}
              </button>
              <button
                onClick={() => {
                  handleNoteTextPaste(contextMenu.noteId!);
                  setContextMenu(null);
                }}
                className={`w-full px-2 py-1.5 text-xs text-left ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
              >
                {language === 'tr' ? 'Yapıştır' : 'Paste'}
              </button>
              <button
                onClick={() => {
                  handleNoteTextDelete(contextMenu.noteId!);
                  setContextMenu(null);
                }}
                className={`w-full px-2 py-1.5 text-xs text-left ${isDark ? 'hover:bg-slate-700 text-red-400' : 'hover:bg-slate-100 text-red-500'}`}
              >
                {language === 'tr' ? 'Sil' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  handleNoteTextSelectAll(contextMenu.noteId!);
                  setContextMenu(null);
                }}
                className={`w-full px-2 py-1.5 text-xs text-left ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
              >
                {language === 'tr' ? 'Tümünü Seç' : 'Select All'}
              </button>
            </div>
          )}
        </div>
      )}

      {contextMenu && contextMenu.mode === 'canvas' && (
        <div className="px-2 py-2 space-y-1">
          <button
            onClick={() => {
              addNote();
              setContextMenu(null);
            }}
            className={`w-full px-2 py-1.5 text-xs text-left ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
          >
            {language === 'tr' ? 'Not Ekle' : 'Add Note'}
          </button>
          <button
            onClick={() => {
              pasteNotes(contextMenu.x, contextMenu.y);
              setContextMenu(null);
            }}
            className={`w-full px-2 py-1.5 text-xs text-left ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
          >
            {language === 'tr' ? 'Not Yapıştır' : 'Paste Note'}
          </button>
        </div>
      )}

      {contextMenu && contextMenu.deviceId && contextMenu.mode === 'device' && (
        <div className="px-2 py-2 space-y-1">
          <button
            onClick={() => {
              const device = devices.find((d) => d.id === contextMenu.deviceId);
              if (device) handleDeviceDoubleClick(device);
              setContextMenu(null);
            }}
            className={`w-full px-2 py-1.5 text-xs text-left ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
          >
            {language === 'tr' ? 'Aç' : 'Open'}
          </button>
          <button
            onClick={() => { startDeviceConfig(contextMenu.deviceId!); setContextMenu(null); }}
            className={`w-full px-2 py-1.5 text-xs text-left ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
          >
            {language === 'tr' ? 'Yapılandır' : 'Configure'}
          </button>
          <button
            onClick={() => {
              saveToHistory();
              deleteDevice(contextMenu.deviceId!);
              setContextMenu(null);
            }}
            className={`w-full px-2 py-1.5 text-xs text-left ${isDark ? 'hover:bg-slate-700 text-red-400' : 'hover:bg-slate-100 text-red-500'}`}
          >
            {language === 'tr' ? 'Sil' : 'Delete'}
          </button>
        </div>
      )}
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
                  {language === 'tr' ? 'Cihaz Bilgisi' : 'DEVICE INFO'}
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

      {/* Ping Status Toasts */}
      {pingAnimation && pingAnimation.success !== null && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-end justify-center pb-24 px-4">
          <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300 ${pingAnimation.success
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
            }`}>
            {pingAnimation.success ? (
              <>
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-bold">
                  {language === 'tr'
                    ? `${devices.find(d => d.id === pingAnimation.sourceId)?.name} â†’ ${devices.find(d => d.id === pingAnimation.targetId)?.name} Başarılı!`
                    : `${devices.find(d => d.id === pingAnimation.sourceId)?.name} â†’ ${devices.find(d => d.id === pingAnimation.targetId)?.name} Successful!`}
                </span>
              </>
            ) : (
              <>
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-sm font-bold">
                  {language === 'tr' ? 'Ping başarısız!' : 'Ping failed!'}
                </span>
              </>
            )}
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

      {/* Port Selector Modal */}
      {showPortSelector && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={() => {
            setShowPortSelector(false);
            setPortSelectorStep('source');
            setSelectedSourcePort(null);
          }} />
          <div className={`relative w-full max-w-2xl rounded-[2.5rem] ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'} border shadow-2xl overflow-hidden flex flex-col transition-all duration-500`}>
            {/* Header */}
            <div className={`px-8 py-6 border-b ${isDark ? 'border-slate-800/50 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl shadow-inner ${isDark ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {portSelectorStep === 'source'
                        ? (language === 'tr' ? 'Kaynak Portu Seï¿½' : 'Source Port Selection')
                        : (language === 'tr' ? 'Hedef Portu Seï¿½' : 'Target Port Selection')
                      }
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPortSelector(false);
                    setPortSelectorStep('source');
                    setSelectedSourcePort(null);
                  }}
                  className={`p-2 rounded-xl transition-all duration-300 ${isDark ? 'hover:bg-slate-700/50 text-slate-500 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Step Indicator */}
              <div className="mt-8 flex items-center gap-4">
                <div className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${portSelectorStep === 'source' ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'bg-emerald-500/40'}`} />
                <div className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${portSelectorStep === 'target' ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : (isDark ? 'bg-slate-800' : 'bg-slate-200')}`} />
              </div>

              {/* Cable Type Selector */}
              <div className="mt-6 flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {language === 'tr' ? 'KABLO TİPİ:' : 'CABLE TYPE:'}
                  </span>
                  <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => onCableChange({ ...cableInfo, cableType: type })}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all duration-300 ${cableInfo.cableType === type
                          ? `${CABLE_COLORS[type].bg} text-white shadow-lg shadow-black/10`
                          : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                          }`}
                      >
                        {type === 'straight' ? 'Direct' : type === 'crossover' ? 'X-Over' : 'Cons'}
                      </button>
                    ))}
                  </div>
                </div>

                {portSelectorStep === 'target' && selectedSourcePort && (
                  <div className="flex items-center gap-3 ml-auto px-4 py-2 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-cyan-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    <span className="text-[10px] font-black tracking-widest">
                      Link from: {devices.find(d => d.id === selectedSourcePort.deviceId)?.name} ({selectedSourcePort.portId})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Device & Port Panel */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 max-h-[50vh]">
              {devices.map((device) => {
                const availablePorts = device.ports.filter(p => p.status === 'disconnected');
                if (availablePorts.length === 0) return null;

                // For target step, exclude the source device
                if (portSelectorStep === 'target' && selectedSourcePort?.deviceId === device.id) return null;

                return (
                  <div key={device.id} className="space-y-4">
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl border transition-colors ${device.type === 'pc' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                          device.type === 'switch' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                            'bg-purple-500/10 border-purple-500/20 text-purple-500'
                          }`}>
                          {DEVICE_ICONS[device.type]}
                        </div>
                        <span className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'} group-hover:text-cyan-500 transition-colors`}>
                          {device.name}
                        </span>
                      </div>
                      <div className={`text-[10px] font-bold tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {availablePorts.length} ports free
                      </div>
                    </div>

                    {/* Pro-Style Port Grid - topology-matched colors */}
                    <div className={`grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 p-4 rounded-3xl border ${isDark ? 'bg-slate-950/40 border-slate-800/50' : 'bg-slate-50 border-slate-200'}`}>
                      {/* Port type legend */}
                      <div className="col-span-full flex flex-wrap gap-3 mb-2 pb-2 border-b border-dashed border-slate-700/30 text-[10px]">
                        {device.type === 'pc' ? (
                          <>
                            <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> ETH</span>
                            <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" /> COM</span>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Fa</span>
                            <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Gi</span>
                            <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" /> Con</span>
                          </>
                        )}
                        <span className="flex items-center gap-1 text-slate-500 ml-auto"><span className="w-2 h-2 rounded-full bg-slate-600 inline-block" /> {language === 'tr' ? 'Bağlı' : 'Used'}</span>
                      </div>
                      {device.ports.map((port) => {
                        const isConnected = port.status === 'connected';
                        const pid = port.id.toLowerCase();
                        const isConsolePrt = pid === 'console' || pid.startsWith('com');
                        const isGigabit = pid.startsWith('gi');
                        const isFastEth = pid.startsWith('fa') || pid.startsWith('eth');
                        // Match topology canvas colors: Console/COMâ†’Cyan, Giâ†’Orange, Fa/Ethâ†’Blue
                        let dotCls = 'bg-slate-600';
                        let dotGlow = '';
                        let cardCls = isDark
                          ? 'bg-slate-800 border-slate-700 hover:border-cyan-500/50 hover:bg-slate-700'
                          : 'bg-white border-slate-200 hover:border-cyan-500 shadow-sm';
                        let textCls = isDark ? 'text-slate-500 group-hover:text-white' : 'text-slate-500 group-hover:text-cyan-600';
                        if (!isConnected) {
                          if (isConsolePrt) {
                            dotCls = 'bg-cyan-500';
                            dotGlow = 'shadow-[0_0_7px_rgba(6,182,212,0.8)]';
                            cardCls = isDark
                              ? 'bg-cyan-950/20 border-cyan-800/50 hover:border-cyan-400 hover:bg-cyan-900/30'
                              : 'bg-cyan-50 border-cyan-200 hover:border-cyan-400 shadow-sm';
                            textCls = 'text-cyan-400 group-hover:text-cyan-300';
                          } else if (isGigabit) {
                            dotCls = 'bg-orange-500';
                            dotGlow = 'shadow-[0_0_7px_rgba(249,115,22,0.8)]';
                            cardCls = isDark
                              ? 'bg-orange-950/20 border-orange-800/50 hover:border-orange-400 hover:bg-orange-900/30'
                              : 'bg-orange-50 border-orange-200 hover:border-orange-400 shadow-sm';
                            textCls = 'text-orange-400 group-hover:text-orange-300';
                          } else if (isFastEth) {
                            dotCls = 'bg-blue-500';
                            dotGlow = 'shadow-[0_0_7px_rgba(59,130,246,0.8)]';
                            cardCls = isDark
                              ? 'bg-blue-950/20 border-blue-800/50 hover:border-blue-400 hover:bg-blue-900/30'
                              : 'bg-blue-50 border-blue-200 hover:border-blue-400 shadow-sm';
                            textCls = 'text-blue-400 group-hover:text-blue-300';
                          }
                        }
                        return (
                          <button
                            key={port.id}
                            disabled={isConnected}
                            onClick={() => {
                              if (portSelectorStep === 'source') {
                                setSelectedSourcePort({ deviceId: device.id, portId: port.id });
                                setPortSelectorStep('target');
                              } else {
                                // Complete connection
                                const newConnection: CanvasConnection = {
                                  id: `conn-${Date.now()}`,
                                  sourceDeviceId: selectedSourcePort!.deviceId,
                                  sourcePort: selectedSourcePort!.portId,
                                  targetDeviceId: device.id,
                                  targetPort: port.id,
                                  cableType: cableInfo.cableType,
                                  active: true,
                                };

                                const updatedConnections = [...connections, newConnection];
                                setConnections(updatedConnections);

                                // Update port status
                                const updatedDevices = devices.map((d) => {
                                  if (d.id === selectedSourcePort!.deviceId) {
                                    return {
                                      ...d,
                                      ports: d.ports.map((p) =>
                                        p.id === selectedSourcePort!.portId ? { ...p, status: 'connected' as const } : p
                                      ),
                                    };
                                  }
                                  if (d.id === device.id) {
                                    return {
                                      ...d,
                                      ports: d.ports.map((p) =>
                                        p.id === port.id ? { ...p, status: 'connected' as const } : p
                                      ),
                                    };
                                  }
                                  return d;
                                });
                                setDevices(updatedDevices);

                                if (onTopologyChange) {
                                  onTopologyChange(updatedDevices, updatedConnections, notes);
                                }

                                // Update cable info
                                const sourceDevice = devices.find((d) => d.id === selectedSourcePort!.deviceId);
                                const targetDevice = devices.find((d) => d.id === device.id);
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
                            className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-300 border ${isConnected
                              ? (isDark ? 'bg-slate-900/40 border-slate-800 cursor-not-allowed opacity-40' : 'bg-slate-200 border-slate-300 cursor-not-allowed opacity-40')
                              : `${cardCls} hover:scale-110`
                              }`}
                          >
                            {/* Port dot - topology canvas color */}
                            <div className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${isConnected ? 'bg-slate-600' : `${dotCls} ${dotGlow}`
                              }`} />
                            <span className={`text-[10px] font-bold font-mono transition-colors ${isConnected ? 'text-slate-600' : textCls
                              }`}>
                              {port.label.replace('FastEthernet', 'Fa').replace('GigabitEthernet', 'Gi')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {devices.every(d => d.ports.filter(p => p.status === 'disconnected').length === 0) && (
                <div className="flex flex-col items-center py-12 space-y-4">
                  <div className={`p-6 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                    <svg className={`w-12 h-12 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className={`text-center max-w-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <h4 className="font-bold text-slate-400">{language === 'tr' ? 'Müsait Port Yok' : 'No Free Ports'}</h4>
                    <p className="text-xs mt-1">{language === 'tr' ? 'Lütfen önce cihazların bağlantılarını kesin.' : 'Please disconnect some cables first.'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Navigation */}
            <div className={`px-8 py-6 border-t ${isDark ? 'border-slate-800/50 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50'} flex justify-between items-center`}>
              <div className={`text-[10px] font-bold tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {portSelectorStep === 'source' ? 'Step 1: Root' : 'Step 2: Destination'}
              </div>
              <button
                onClick={() => {
                  setShowPortSelector(false);
                  setPortSelectorStep('source');
                  setSelectedSourcePort(null);
                }}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black tracking-widest transition-all ${isDark ? 'bg-slate-800 text-slate-400 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                  }`}
              >
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Port Tooltip */}
      {portTooltip && portTooltip.visible && (
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
              <div className={`w-2 h-2 rounded-full ${devices.find(d => d.id === portTooltip.deviceId)?.ports.find(p => p.id === portTooltip.portId)?.shutdown
                ? 'bg-red-500'
                : devices.find(d => d.id === portTooltip.deviceId)?.ports.find(p => p.id === portTooltip.portId)?.status === 'connected'
                  ? 'bg-green-500'
                  : 'bg-slate-400'
                }`} />
              <span className="text-[10px] font-black tracking-widest uppercase opacity-60">
                {portTooltip.portId}
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="text-xs font-bold">
                {language === 'tr' ? 'Durum:' : 'Status:'}{' '}
                <span className={
                  devices.find(d => d.id === portTooltip.deviceId)?.ports.find(p => p.id === portTooltip.portId)?.shutdown
                    ? 'text-red-500'
                    : devices.find(d => d.id === portTooltip.deviceId)?.ports.find(p => p.id === portTooltip.portId)?.status === 'connected'
                      ? 'text-green-500'
                      : 'text-slate-400'
                }>
                  {devices.find(d => d.id === portTooltip.deviceId)?.ports.find(p => p.id === portTooltip.portId)?.shutdown
                    ? (language === 'tr' ? 'Kapalı (Shutdown)' : 'Shutdown')
                    : devices.find(d => d.id === portTooltip.deviceId)?.ports.find(p => p.id === portTooltip.portId)?.status === 'connected'
                      ? (language === 'tr' ? 'Bağlı (Up)' : 'Connected (Up)')
                      : (language === 'tr' ? 'Bağlı Değil (Down)' : 'Not Connected (Down)')
                  }
                </span>
              </div>

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
    </div>
  );
}
