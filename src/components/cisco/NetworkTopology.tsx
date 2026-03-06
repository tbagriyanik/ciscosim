'use client';

import { useState, useRef, useEffect, useCallback, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { CableType, CableInfo, getCableTypeName, isCableCompatible } from '@/lib/cisco/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface NetworkTopologyProps {
  cableInfo: CableInfo;
  onCableChange: (cableInfo: CableInfo) => void;
  selectedDevice: 'pc' | 'switch' | null;
  onDeviceSelect: (device: 'pc' | 'switch', deviceId?: string) => void;
  onDeviceDoubleClick?: (device: 'pc' | 'switch', deviceId: string) => void;
  onTopologyChange?: (devices: CanvasDevice[], connections: CanvasConnection[]) => void;
  onDeviceDelete?: (deviceId: string) => void;
  initialDevices?: CanvasDevice[];
  initialConnections?: CanvasConnection[];
  isActive?: boolean;
}

// Device types for the canvas
export interface CanvasDevice {
  id: string;
  type: 'pc' | 'switch' | 'router';
  name: string;
  ip: string;
  x: number;
  y: number;
  status: 'online' | 'offline' | 'error';
  ports: { id: string; label: string; status: 'connected' | 'disconnected' }[];
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 0 1 7.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
};

const CABLE_COLORS = {
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
  isActive = true,
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

  // Default devices for initial state
  const defaultDevices: CanvasDevice[] = [
    {
      id: 'pc-1',
      type: 'pc',
      name: 'PC-1',
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
      ip: '192.168.1.1',
      x: 300,
      y: 150,
      status: 'online',
      ports: generateSwitchPorts(),
    },
  ];

  // Canvas state
  const [devices, setDevices] = useState<CanvasDevice[]>(initialDevices || defaultDevices);

  const [connections, setConnections] = useState<CanvasConnection[]>(initialConnections || []);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedCanvasDevice, setSelectedCanvasDevice] = useState<string | null>(null);

  // Select all state
  const [selectAllMode, setSelectAllMode] = useState(false);

  // Drag state with position tracking
  const [draggedDevice, setDraggedDevice] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isActuallyDragging, setIsActuallyDragging] = useState(false);

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
  } | null>(null);

  // Clipboard state for copy/cut/paste
  const [clipboard, setClipboard] = useState<CanvasDevice | null>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<{ devices: CanvasDevice[]; connections: CanvasConnection[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef({ history, historyIndex });

  // Save state to history for undo
  const saveToHistory = useCallback(() => {
    const newState = { devices: [...devices], connections: [...connections] };
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newState);
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [devices, connections, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setDevices(prevState.devices);
      setConnections(prevState.connections);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setDevices(nextState.devices);
      setConnections(nextState.connections);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

  // Configuration state (Name, IP, etc.)
  const [configuringDevice, setConfiguringDevice] = useState<string | null>(null);
  const [tempNameValue, setTempNameValue] = useState('');
  const [ipValue, setIpValue] = useState('');
  const [subnetValue, setSubnetValue] = useState('');
  const [gatewayValue, setGatewayValue] = useState('');
  const configInputRef = useRef<HTMLInputElement>(null);

  // Rename state
  const [renamingDevice, setRenamingDevice] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // UI state
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

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
  } | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deviceCounterRef = useRef<{ pc: number; switch: number; router: number }>({ pc: 0, switch: 0, router: 0 });
  const pingAnimationRef = useRef<number | null>(null);

  // Start device config (Name and IP)
  const startDeviceConfig = useCallback((deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      setConfiguringDevice(deviceId);
      setTempNameValue(device.name);
      setIpValue(device.ip || '');
      // Default subnet mask
      setSubnetValue('255.255.255.0');
      // Default gateway (first usable IP in subnet)
      const ipParts = (device.ip || '192.168.1.10').split('.');
      ipParts[3] = '1';
      setGatewayValue(ipParts.join('.'));
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
          ? { ...d, name: tempNameValue.trim() || d.name, ip: ipValue.trim() }
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

  // Select all devices
  const selectAllDevices = useCallback(() => {
    setSelectAllMode(true);
  }, []);

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

  // Handle keyboard events (Delete key and ESC for context menu)
  useEffect(() => {
    // 1. Listen for mutual exclusion broadcast
    const handleCloseBroadcast = (e: any) => {
      const source = e.detail?.source;
      if (source !== 'topology') {
        setContextMenu(null);
        // If it's ESC or back button or other menus, also close modals
        if (source === 'escape' || source === 'backbutton' || source === 'back' || source === 'mobile' || source === 'device') {
          if (configuringDevice) cancelDeviceConfig();
          if (pingSource) setPingSource(null);
          if (showPortSelector) {
            setShowPortSelector(false);
            setPortSelectorStep('source');
            setSelectedSourcePort(null);
          }
          if (selectAllMode) setSelectAllMode(false);
        }
      }
    };
    window.addEventListener('close-menus-broadcast', handleCloseBroadcast);

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close context menu
      if (e.key === 'Escape') {
        setContextMenu(null);
        // Page level handles other things
      }

      // Close context menu on ESC
      if (e.key === 'Escape') {
        setContextMenu(null);
        // Also cancel config if active
        if (configuringDevice) {
          cancelDeviceConfig();
        }
        // Cancel select all mode
        if (selectAllMode) {
          setSelectAllMode(false);
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

      // Delete selected device(s)
      if (e.key === 'Delete') {
        if (selectAllMode) {
          // Delete all devices
          saveToHistory();
          setDevices([]);
          setConnections([]);
          setSelectAllMode(false);
          if (onDeviceDelete) {
            devices.forEach(d => onDeviceDelete(d.id));
          }
        } else if (selectedCanvasDevice) {
          deleteDevice(selectedCanvasDevice);
          setSelectedCanvasDevice(null);
        }
      }

      // Ctrl+A to select all
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        selectAllDevices();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('close-menus-broadcast', handleCloseBroadcast);
    };
  }, [selectedCanvasDevice, deleteDevice, configuringDevice, cancelDeviceConfig, selectAllMode, selectAllDevices, saveToHistory, devices, onDeviceDelete]);

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

  // Handle canvas pan start
  const handleCanvasMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.button === 2) {
      // Right click on canvas - show context menu
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source: 'topology' } }));
      setContextMenu({ x: e.clientX, y: e.clientY, deviceId: null });
    } else if (e.button === 0 && !(e.target as HTMLElement).closest('[data-device-id]')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedCanvasDevice(null);
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
          }
        }

        if (isActuallyDragging) {
          // Throttling with requestAnimationFrame
          if (dragAnimationFrameRef.current !== null) return;

          dragAnimationFrameRef.current = requestAnimationFrame(() => {
            const rect = canvasRef.current!.getBoundingClientRect();
            const newX = (e.clientX - rect.left - pan.x - dragOffset.x) / zoom;
            const newY = (e.clientY - rect.top - pan.y - dragOffset.y) / zoom;

            // Clamp to canvas bounds
            const canvasDims = getCanvasDimensions();
            const clampedX = Math.max(20, Math.min(newX, canvasDims.width - 100));
            const clampedY = Math.max(20, Math.min(newY, canvasDims.height - 100));

            setDevices((prev) => {
              const deviceIndex = prev.findIndex(d => d.id === draggedDevice);
              if (deviceIndex === -1) return prev;

              const oldDevice = prev[deviceIndex];
              // Only update if change is significant (> 0.1px) to avoid micro-renders
              if (Math.abs(oldDevice.x - clampedX) < 0.1 && Math.abs(oldDevice.y - clampedY) < 0.1) {
                return prev;
              }

              const newDevices = [...prev];
              newDevices[deviceIndex] = { ...oldDevice, x: clampedX, y: clampedY };
              return newDevices;
            });

            dragAnimationFrameRef.current = null;
          });
        }
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

      // Save to history if we were actually dragging a device
      if (isActuallyDragging && draggedDevice) {
        saveToHistory();
      }

      // Note: We don't reset wasDraggingRef here - let it persist for the click handler
      // The click handler will check wasDraggingRef and the next mousedown will reset it

      setIsPanning(false);
      setDraggedDevice(null);
      setDragStartPos(null);
      setIsActuallyDragging(false);
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
  }, [isPanning, panStart, draggedDevice, dragOffset, zoom, pan, isDrawingConnection, getCanvasCoords, dragStartPos, isActuallyDragging, getDistance, onDeviceSelect, saveToHistory]);

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
          setSelectedCanvasDevice(device.id);
          onDeviceSelect(device.type === 'router' ? 'switch' : device.type, device.id);
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

    // Store the starting position for distance calculation
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setIsActuallyDragging(false);
    setDraggedDevice(deviceId);
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) - device.x * zoom,
      y: (e.clientY - rect.top - pan.y) - device.y * zoom,
    });
    setSelectedCanvasDevice(deviceId);
  }, [devices, pan, zoom]);

  // Handle device click (single click - select only)
  const handleDeviceClick = useCallback((e: ReactMouseEvent, device: CanvasDevice) => {
    e.stopPropagation();
    // Don't handle click if we were dragging (check ref to avoid stale closure)
    if (wasDraggingRef.current) return;

    setSelectedCanvasDevice(device.id);
    // Notify parent component - select device, don't open terminal
    onDeviceSelect(device.type === 'router' ? 'switch' : device.type, device.id);
  }, [onDeviceSelect]);

  // Handle device double click - open terminal
  const handleDeviceDoubleClick = useCallback((device: CanvasDevice) => {
    // Open terminal for this specific device
    if (onDeviceDoubleClick) {
      onDeviceDoubleClick(device.type === 'router' ? 'switch' : device.type, device.id);
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
    setContextMenu({ x, y, deviceId: deviceId || null });
  }, []);

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
    setSelectedCanvasDevice(deviceId);

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
        setSelectedCanvasDevice(device.id);
        onDeviceSelect(device.type === 'router' ? 'switch' : device.type, device.id);
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
        setContextMenu({ x: t.clientX, y: t.clientY, deviceId: null });
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

      // Update port status
      setDevices((prev) =>
        prev.map((d) => {
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
      ip: generateUniqueIp(),
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
    setIsPaletteOpen(false);
  }, [devices.length, saveToHistory, generateUniqueIp]);

  // Notify parent of topology changes
  useEffect(() => {
    if (onTopologyChange) {
      onTopologyChange(devices, connections);
    }
  }, [devices, connections, onTopologyChange]);

  // Delete connection
  const deleteConnection = useCallback((connectionId: string) => {
    saveToHistory();
    const conn = connections.find((c) => c.id === connectionId);
    if (conn) {
      setDevices((prev) =>
        prev.map((d) => {
          if (d.id === conn.sourceDeviceId || d.id === conn.targetDeviceId) {
            return {
              ...d,
              ports: d.ports.map((p) =>
                p.id === conn.sourcePort || p.id === conn.targetPort
                  ? { ...p, status: 'disconnected' as const }
                  : p
              ),
            };
          }
          return d;
        })
      );
    }
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
  }, [connections, saveToHistory]);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPan({ x: 0, y: 0 });
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    setDevices([]);
    setConnections([]);
    setSelectedCanvasDevice(null);
    deviceCounterRef.current = { pc: 0, switch: 0, router: 0 };
  }, []);

  // Copy device
  const copyDevice = useCallback((deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      setClipboard({ ...device });
    }
    setContextMenu(null);
  }, [devices]);

  // Cut device
  const cutDevice = useCallback((deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      setClipboard({ ...device });
      deleteDevice(deviceId);
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

  // Paste device
  const pasteDevice = useCallback(() => {
    if (!clipboard) return;

    saveToHistory();

    // Create new device with new ID
    const type = clipboard.type;
    deviceCounterRef.current[type]++;
    const newId = `${type}-${deviceCounterRef.current[type]}`;

    const newDevice: CanvasDevice = {
      ...clipboard,
      id: newId,
      name: `${type.toUpperCase()}-${deviceCounterRef.current[type]}`,
      ip: generateUniqueIp(),
      x: clipboard.x + 30,
      y: clipboard.y + 30,
      ports: clipboard.ports.map(p => ({ ...p, status: 'disconnected' as const })),
    };

    setDevices(prev => [...prev, newDevice]);
    setContextMenu(null);
  }, [clipboard, saveToHistory, generateUniqueIp]);

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
        let nextDeviceId: string | null = null;

        if (conn.sourceDeviceId === current.deviceId && !visited.has(conn.targetDeviceId)) {
          nextDeviceId = conn.targetDeviceId;
        } else if (conn.targetDeviceId === current.deviceId && !visited.has(conn.sourceDeviceId)) {
          nextDeviceId = conn.sourceDeviceId;
        }

        if (nextDeviceId) {
          const newPath = [...current.path, nextDeviceId!];

          if (nextDeviceId === targetId) {
            return newPath;
          }

          visited.add(nextDeviceId!);
          queue.push({ deviceId: nextDeviceId!, path: newPath });
        }
      }
    }

    return null; // No path found
  }, [connections]);

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

    // Animate ping - each hop takes 800ms
    const hopDuration = 800;
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

  // Get dynamic canvas dimensions based on screen size
  const getCanvasDimensions = useCallback(() => {
    if (typeof window === 'undefined') return { width: VIRTUAL_CANVAS_WIDTH_DESKTOP, height: VIRTUAL_CANVAS_HEIGHT_DESKTOP };
    return isMobile
      ? { width: VIRTUAL_CANVAS_WIDTH_MOBILE, height: VIRTUAL_CANVAS_HEIGHT_MOBILE }
      : { width: VIRTUAL_CANVAS_WIDTH_DESKTOP, height: VIRTUAL_CANVAS_HEIGHT_DESKTOP };
  }, [isMobile]);

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

  // Render connection SVG
  const renderConnection = (conn: CanvasConnection, connIndex: number) => {
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
      <g key={conn.id}>
        {/* Connection line */}
        <path
          d={`M ${source.x} ${source.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${target.x} ${target.y}`}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeDasharray={isCompatible ? 'none' : '8,4'}
          className="cursor-pointer hover:stroke-[5px]"
          onClick={() => deleteConnection(conn.id)}
        />

        {/* X icon for incompatible cables */}
        {!isCompatible && (
          <g transform={`translate(${midX}, ${midY})`}>
            <circle r="10" fill="#ec4899" stroke="#fff" strokeWidth="1.5" />
            <line x1="-4" y1="-4" x2="4" y2="4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <line x1="4" y1="-4" x2="-4" y2="4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

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
          <text
            x={midX + perpX}
            y={midY + perpY - 8}
            fill={color}
            fontSize="10"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            {conn.sourcePort}→{conn.targetPort}
          </text>
        ) : (
          <text
            x={midX}
            y={midY - 10}
            fill={color}
            fontSize="10"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            {getCableTypeName(conn.cableType, language)}
          </text>
        )}
      </g>
    );
  };

  // Render device
  const renderDevice = (device: CanvasDevice, isDragging: boolean = false) => {
    const isSelected = selectedCanvasDevice === device.id || selectAllMode;
    // Check if device has any connections
    const hasConnection = connections.some(
      conn => conn.sourceDeviceId === device.id || conn.targetDeviceId === device.id
    );
    // Green if connected, red if not connected
    const statusColor = hasConnection ? 'bg-green-500' : 'bg-red-500';

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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                stroke="currentColor"
                fill="none"
                d="M8.111 16.404a5.5 5.5 0 0 1 7.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                transform="scale(1.2)"
              />
            )}
          </g>
        </g>

        {/* Status LED */}
        <circle cx={deviceWidth - 10} cy={10} r={5} className={statusColor} />

        {/* Device name */}
        <text x={deviceWidth / 2} y={58} fill={isDark ? '#f1f5f9' : '#1e293b'} fontSize="10" textAnchor="middle" fontWeight="bold" className="select-none pointer-events-none">
          {device.name}
        </text>

        {/* Device IP */}
        <text x={deviceWidth / 2} y={70} fill={isDark ? '#94a3b8' : '#64748b'} fontSize="10" textAnchor="middle" fontFamily="monospace" className="select-none pointer-events-none">
          {device.ip}
        </text>

        {/* Ports - wrapped 6 per row */}
        {device.type === 'pc' ? (
          // PC has Eth0 and COM1 ports, show side by side
          device.ports.map((port, idx) => {
            // İki portu yan yana göster
            const portSpacing = 18;
            const startX = deviceWidth / 2 - (device.ports.length > 1 ? portSpacing / 2 : 0);
            const portX = startX + idx * portSpacing;
            const portY = 80;
            const isConnected = port.status === 'connected';

            // Determine port label: E for Ethernet, C for COM/Console
            const portLabel = port.id.toLowerCase().startsWith('com') ? 'C' : 'E';

            // Port colors:
            // PC Ethernet: Blue, PC COM (Console): Turquoise
            const portColor = port.id.toLowerCase().startsWith('com')
              ? (isConnected ? '#06b6d4' : '#0891b2')  // Turquoise for console
              : (isConnected ? '#3b82f6' : '#1d4ed8'); // Blue for ethernet

            return (
              <g
                key={port.id}
                transform={`translate(${portX}, ${portY})`}
                className="cursor-pointer"
                onClick={(e) => handlePortClick(e as unknown as ReactMouseEvent, device.id, port.id)}
              >
                <circle
                  r={7}
                  fill={portColor}
                  stroke={isConnected ? (port.id.toLowerCase().startsWith('com') ? '#0891b2' : '#1d4ed8') : '#4b5563'}
                  strokeWidth={1}
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
            let portFill: string;
            let portStroke: string;

            if (isConsole) {
              portFill = isConnected ? '#06b6d4' : '#0891b2'; // Turquoise
              portStroke = '#0891b2';
            } else if (isGigabit) {
              portFill = isConnected ? '#f97316' : '#c2410c'; // Orange
              portStroke = '#c2410c';
            } else if (isFastEthernet) {
              portFill = isConnected ? '#3b82f6' : '#1d4ed8'; // Blue
              portStroke = '#1d4ed8';
            } else {
              portFill = isConnected ? '#22c55e' : '#6b7280'; // Default green/gray
              portStroke = isConnected ? '#16a34a' : '#4b5563';
            }

            return (
              <g
                key={port.id}
                transform={`translate(${portX}, ${portY})`}
                className="cursor-pointer"
                onClick={(e) => handlePortClick(e as unknown as ReactMouseEvent, device.id, port.id)}
              >
                <circle
                  r={6}
                  fill={portFill}
                  stroke={portStroke}
                  strokeWidth={1}
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
        <div className="px-4 pb-3">
          <div className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-2`}>
            {language === 'tr' ? 'Cihaz Ekle' : 'Add Device'}
          </div>
          <div className="flex gap-2">
            {(['pc', 'switch', 'router'] as const).map((type) => (
              <button
                key={type}
                onClick={() => addDevice(type)}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all min-h-[80px] ${isDark
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  : 'border-slate-300 bg-white hover:bg-slate-100'
                  }`}
              >
                <div className={
                  type === 'pc' ? 'text-blue-500' : type === 'switch' ? 'text-emerald-500' : 'text-purple-500'
                }>
                  {DEVICE_ICONS[type]}
                </div>
                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {type.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Cable Type Selector */}
        <div className="px-4 pb-4">
          <div className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-2`}>
            {language === 'tr' ? 'Kablo Tipi' : 'Cable Type'}
          </div>
          <div className="flex gap-2">
            {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
              <button
                key={type}
                onClick={() => {
                  onCableChange({ ...cableInfo, cableType: type });
                  setIsPaletteOpen(false);
                }}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all min-h-[48px] ${cableInfo.cableType === type
                  ? `${CABLE_COLORS[type].bg} text-white border-transparent`
                  : isDark
                    ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-600'
                  }`}
              >
                <div className={`w-3 h-3 rounded ${CABLE_COLORS[type].bg}`} />
                {type === 'straight'
                  ? language === 'tr' ? 'Düz' : 'Straight'
                  : type === 'crossover'
                    ? language === 'tr' ? 'Çapraz' : 'X-over'
                    : language === 'tr' ? 'Konsol' : 'Console'}
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
              ? language === 'tr' ? 'Düz' : 'Straight'
              : cableInfo.cableType === 'crossover'
                ? language === 'tr' ? 'Çapraz' : 'X-over'
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
      className={`rounded-xl border-2 overflow-hidden transition-all duration-300 ${isDark
        ? 'bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90 border-slate-600/50'
        : 'bg-gradient-to-br from-blue-50/50 via-white to-slate-50/80 border-slate-300/50'
        }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 border-b ${isDark ? 'border-slate-700/50 bg-gradient-to-r from-slate-800/80 via-slate-700/60 to-slate-800/80' : 'border-slate-200/50 bg-gradient-to-r from-blue-50/30 via-white/50 to-blue-50/30'}`}
      >
        <div className="flex items-center justify-between">
          <h3
            className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}
          >
            <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0 -2-2H7a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2zM9 9h6v6H9V9z"
              />
            </svg>
            {language === 'tr' ? 'Ağ Topolojisi' : 'Network Topology'}
          </h3>

          {/* Connection status */}
          <div className="flex items-center gap-2">
            {/* Connect Ports Button */}
            <button
              onClick={() => {
                setShowPortSelector(true);
                setPortSelectorStep('source');
                setSelectedSourcePort(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isDark
                ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 0 0 -5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0 -5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="hidden sm:inline">{language === 'tr' ? 'Bağlantı Kur' : 'Connect'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Device Palette - Desktop Only */}
        <div
          className={`hidden md:flex w-24 border-r ${isDark ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/60 to-slate-900/60' : 'border-slate-200/50 bg-gradient-to-b from-blue-50/40 to-slate-50/60'} p-2 flex-col gap-2`}
        >
          <div className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-1`}>
            {language === 'tr' ? 'Cihazlar' : 'Devices'}
          </div>

          {/* PC Button */}
          <button
            onClick={() => addDevice('pc')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all min-h-[52px] ${isDark
              ? 'border-slate-600 bg-slate-700/50 hover:bg-slate-700 hover:border-blue-500'
              : 'border-slate-300 bg-white hover:bg-slate-100 hover:border-blue-500'
              }`}
          >
            <div className="text-blue-500">{DEVICE_ICONS.pc}</div>
            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>PC</span>
          </button>

          {/* Switch Button */}
          <button
            onClick={() => addDevice('switch')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all min-h-[52px] ${isDark
              ? 'border-slate-600 bg-slate-700/50 hover:bg-slate-700 hover:border-emerald-500'
              : 'border-slate-300 bg-white hover:bg-slate-100 hover:border-emerald-500'
              }`}
          >
            <div className="text-emerald-500">{DEVICE_ICONS.switch}</div>
            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Switch
            </span>
          </button>

          {/* Router Button */}
          <button
            onClick={() => addDevice('router')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all min-h-[52px] ${isDark
              ? 'border-slate-600 bg-slate-700/50 hover:bg-slate-700 hover:border-purple-500'
              : 'border-slate-300 bg-white hover:bg-slate-100 hover:border-purple-500'
              }`}
          >
            <div className="text-purple-500">{DEVICE_ICONS.router}</div>
            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Router
            </span>
          </button>

          <div className={`my-2 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`} />

          <div className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-1`}>
            {language === 'tr' ? 'Kablo' : 'Cable'}
          </div>

          {/* Cable Type Selector */}
          {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
            <button
              key={type}
              onClick={() => onCableChange({ ...cableInfo, cableType: type })}
              className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all min-h-[44px] ${cableInfo.cableType === type
                ? `${CABLE_COLORS[type].bg} text-white border-transparent`
                : isDark
                  ? 'border-slate-600 bg-slate-700/50 hover:bg-slate-700'
                  : 'border-slate-300 bg-white hover:bg-slate-100'
                }`}
            >
              <div className={`w-3 h-3 rounded ${CABLE_COLORS[type].bg}`} />
              <span className={`text-[9px] font-medium ${cableInfo.cableType === type ? 'text-white' : isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {type === 'straight'
                  ? language === 'tr'
                    ? 'Düz'
                    : 'Straight'
                  : type === 'crossover'
                    ? language === 'tr'
                      ? 'Çapraz'
                      : 'X-over'
                    : language === 'tr'
                      ? 'Konsol'
                      : 'Console'}
              </span>
            </button>
          ))}
        </div>

        {/* Canvas Area */}
        <div className={`flex-1 relative ${isMobile ? 'pb-20' : ''}`}>
          {/* Select All Mode Indicator */}
          {selectAllMode && (
            <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 ${isDark ? 'bg-cyan-600/90 text-white' : 'bg-cyan-500 text-white'
              }`}>
              <span className="text-sm font-medium">
                {language === 'tr' ? `${devices.length} cihaz seçili` : `${devices.length} devices selected`}
              </span>
              <button
                onClick={() => setSelectAllMode(false)}
                className="px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-xs"
              >
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  saveToHistory();
                  setDevices([]);
                  setConnections([]);
                  setSelectAllMode(false);
                  if (onDeviceDelete) {
                    devices.forEach(d => onDeviceDelete(d.id));
                  }
                }}
                className="px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-xs"
              >
                {language === 'tr' ? 'Tümünü Sil' : 'Delete All'}
              </button>
            </div>
          )}

          {/* Canvas */}
          <div
            ref={canvasRef}
            className="w-full h-full min-h-[500px] overflow-hidden cursor-grab active:cursor-grabbing relative touch-none select-none"
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

                {/* Connections */}
                {connections.map((conn, index) => renderConnection(conn, index))}

                {/* Temporary connection line */}
                {renderTempConnection()}

                {/* Devices */}
                {devices.map((device) => {
                  const isCurrentlyDragging = (draggedDevice === device.id && isActuallyDragging) ||
                    (touchDraggedDevice === device.id && isTouchDragging);
                  return (
                    <g
                      key={device.id}
                      onMouseDown={(e) => handleDeviceMouseDown(e as unknown as ReactMouseEvent, device.id)}
                      onClick={(e) => handleDeviceClick(e as unknown as ReactMouseEvent, device)}
                      onDoubleClick={() => handleDeviceDoubleClick(device)}
                      onContextMenu={(e) => handleContextMenu(e as unknown as ReactMouseEvent, device.id)}
                      onTouchStart={(e) => handleDeviceTouchStart(e, device.id)}
                      onTouchMove={handleDeviceTouchMove}
                      onTouchEnd={handleDeviceTouchEnd}
                      style={{ cursor: 'move', touchAction: 'none' }}
                    >
                      {renderDevice(device, isCurrentlyDragging)}
                    </g>
                  );
                })}
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
            <button
              onClick={resetView}
              className={`px-2 py-1 text-xs rounded ${isDark
                ? 'hover:bg-slate-700 text-slate-300'
                : 'hover:bg-slate-100 text-slate-600'
                }`}
            >
              {language === 'tr' ? 'Sıfırla' : 'Reset'}
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
              ? 'Tek tık: seç, Çift tık: terminal, Sürükle: taşı'
              : 'Click: select, Double-click: terminal, Drag: move'}
          </div>

          {/* Mobile Instructions */}
          <div
            className={`absolute bottom-2 right-2 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'} max-w-48 text-right sm:hidden`}
          >
            {language === 'tr'
              ? 'Dokun: seç, Çift dokun: terminal, Sürükle: taşı, Basılı tut: sil'
              : 'Tap: select, Double-tap: terminal, Drag: move, Long-press: delete'}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className={`context-menu fixed z-50 py-1 rounded-lg shadow-xl min-w-[140px] ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'
            }`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Device-specific actions */}
          {contextMenu.deviceId && (
            <>
              {/* Open */}
              <button
                onClick={() => {
                  const device = devices.find((d) => d.id === contextMenu.deviceId);
                  if (device) handleDeviceDoubleClick(device);
                  setContextMenu(null);
                }}
                className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {language === 'tr' ? 'Aç' : 'Open'}
              </button>

              <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

              {/* Copy */}
              <button
                onClick={() => { copyDevice(contextMenu.deviceId!); setContextMenu(null); }}
                className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 0 1 -2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0 -2-2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2z" />
                </svg>
                {language === 'tr' ? 'Kopyala' : 'Copy'}
              </button>

              {/* Cut */}
              <button
                onClick={() => { cutDevice(contextMenu.deviceId!); setContextMenu(null); }}
                className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 1 0 -4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 1 0 -4.243-4.243 3 3 0 004.243 4.243z" />
                </svg>
                {language === 'tr' ? 'Kes' : 'Cut'}
              </button>

              {/* Configure */}
              <button
                onClick={() => { startDeviceConfig(contextMenu.deviceId!); }}
                className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0 -2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0 -1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1 -6 0 3 3 0 016 0z" />
                </svg>
                {language === 'tr' ? 'Yapılandır' : 'Configure'}
              </button>

              <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

              {/* Delete */}
              <button
                onClick={() => { deleteDevice(contextMenu.deviceId!); setContextMenu(null); }}
                className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 ${isDark ? 'hover:bg-slate-700 text-red-400' : 'hover:bg-slate-100 text-red-500'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1 -1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0 -1-1h-4a1 1 0 0 0 -1 1v3M4 7h16" />
                </svg>
                {language === 'tr' ? 'Sil' : 'Delete'}
              </button>

              <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

              {/* Ping */}
              <button
                onClick={() => {
                  setPingSource(contextMenu.deviceId);
                  setContextMenu(null);
                }}
                className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 ${isDark ? 'hover:bg-slate-700 text-cyan-400' : 'hover:bg-slate-100 text-cyan-600'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z" />
                </svg>
                {language === 'tr' ? 'Ping At' : 'Send Ping'}
              </button>

              <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
            </>
          )}

          {/* Common actions (available on both device and empty area) */}

          {/* Paste */}
          <button
            onClick={() => pasteDevice()}
            disabled={!clipboard}
            className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 ${clipboard
              ? isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              : isDark ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0 -2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
            </svg>
            {language === 'tr' ? 'Yapıştır' : 'Paste'}
          </button>

          <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

          {/* Undo */}
          <button
            onClick={() => { handleUndo(); setContextMenu(null); }}
            disabled={historyIndex <= 0}
            className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 ${historyIndex > 0
              ? isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              : isDark ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            {language === 'tr' ? 'Geri Al' : 'Undo'}
          </button>

          {/* Redo */}
          <button
            onClick={() => { handleRedo(); setContextMenu(null); }}
            disabled={historyIndex >= history.length - 1}
            className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 ${historyIndex < history.length - 1
              ? isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              : isDark ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 0 0 -8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
            {language === 'tr' ? 'Yinele' : 'Redo'}
          </button>

          <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

          {/* Select All */}
          <button
            onClick={() => selectAllDevices()}
            className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {language === 'tr' ? 'Tümünü Seç' : 'Select All'}
          </button>
        </div>
      )}

      {/* Device Configuration Modal (Name & IP) */}
      {configuringDevice && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm" onClick={cancelDeviceConfig}>
          <div
            className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-6 m-4 w-96 shadow-2xl`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0 -2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0 -1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1 -6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {language === 'tr' ? 'Cihaz Yapılandırması' : 'Device Configuration'}
              </h3>
            </div>

            <div className="space-y-4">
              {/* Hostname */}
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {language === 'tr' ? 'Cihaz Adı (Hostname)' : 'Device Name (Hostname)'}
                </label>
                <input
                  ref={configInputRef}
                  type="text"
                  value={tempNameValue}
                  onChange={(e) => setTempNameValue(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all ${isDark
                    ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                    } outline-none`}
                  placeholder={language === 'tr' ? 'Cihaz adı girin' : 'Enter device name'}
                />
              </div>

              <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'} my-2`} />

              {/* IP Address */}
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {language === 'tr' ? 'IP Adresi' : 'IP Address'}
                </label>
                <input
                  type="text"
                  value={ipValue}
                  onChange={(e) => setIpValue(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border font-mono transition-all ${isDark
                    ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                    } outline-none`}
                  placeholder="192.168.1.x"
                />
              </div>

              {/* Subnet Mask */}
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {language === 'tr' ? 'Alt Ağ Maskesi' : 'Subnet Mask'}
                </label>
                <input
                  type="text"
                  value={subnetValue}
                  onChange={(e) => setSubnetValue(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border font-mono transition-all ${isDark
                    ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                    } outline-none`}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={cancelDeviceConfig}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button
                onClick={confirmDeviceConfig}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-cyan-600 text-white hover:bg-cyan-700 shadow-lg shadow-cyan-900/20 transition-all"
              >
                {language === 'tr' ? 'Kaydet' : 'Save'}
              </button>
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

      {/* Ping Animation Overlay */}
      {pingAnimation && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          {/* Envelope animation along bezier curve - rendered inside canvas SVG for correct positioning */}
          {(() => {
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
              // Fallback to device centers if no connection found
              source = getDeviceCenter(fromDevice);
              target = getDeviceCenter(toDevice);
            }

            // Calculate control points matching renderConnection logic exactly
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;

            // Calculate parallel offset if multiple connections (same as renderConnection)
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

            // Calculate perpendicular offset for parallel lines
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const perpX = -dy / len * offset;
            const perpY = dx / len * offset;

            // Control points matching renderConnection exactly
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

            // Calculate tangent direction for perpendicular offset
            const tangentDx = -3 * mt2 * source.x + 3 * (mt2 - 2 * mt * t) * controlPoint1.x + 3 * (2 * mt * t - t2) * controlPoint2.x + 3 * t2 * target.x;
            const tangentDy = -3 * mt2 * source.y + 3 * (mt2 - 2 * mt * t) * controlPoint1.y + 3 * (2 * mt * t - t2) * controlPoint2.y + 3 * t2 * target.y;
            const tangentLen = Math.sqrt(tangentDx * tangentDx + tangentDy * tangentDy) || 1;

            // Perpendicular direction (20px ABOVE the cable - negative Y in screen coords means up)
            // In SVG, -Y is up, so we use -tangentDx, +tangentDy for perpendicular pointing up
            const envelopeOffsetX = tangentDy / tangentLen * 20;
            const envelopeOffsetY = -tangentDx / tangentLen * 20;

            // Get canvas container position for proper overlay
            const canvasRect = canvasRef.current?.getBoundingClientRect();

            if (!canvasRect) return null;

            // Transform from canvas coordinates to screen coordinates
            const screenX = canvasRect.left + (bezierX + envelopeOffsetX) * zoom + pan.x * zoom;
            const screenY = canvasRect.top + (bezierY + envelopeOffsetY) * zoom + pan.y * zoom;

            return (
              <svg
                className="absolute inset-0 w-full h-full"
                style={{ overflow: 'visible' }}
              >
                <g transform={`translate(${screenX}, ${screenY})`}>
                  {/* Trail effect */}
                  <circle r="8" fill="#06b6d4" opacity={0.15} className="animate-ping" />
                  <circle r="5" fill="#06b6d4" opacity={0.3} />
                  {/* Envelope icon */}
                  <rect x="-12" y="-8" width="24" height="16" rx="2" fill="#06b6d4" stroke="#0891b2" strokeWidth="1.5" />
                  <path d="M-9 -5 L0 3 L9 -5" fill="none" stroke="white" strokeWidth="2" />
                </g>
              </svg>
            );
          })()}

          {/* Success/Error Toast */}
          {pingAnimation.success !== null && (
            <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
              <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${pingAnimation.success
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
                }`}>
                {pingAnimation.success ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium">
                      {language === 'tr'
                        ? `${devices.find(d => d.id === pingAnimation.sourceId)?.name} → ${devices.find(d => d.id === pingAnimation.targetId)?.name} Ping Başarılı! (${pingAnimation.path.length - 1} hop)`
                        : `${devices.find(d => d.id === pingAnimation.sourceId)?.name} → ${devices.find(d => d.id === pingAnimation.targetId)?.name} Ping Successful! (${pingAnimation.path.length - 1} hop${pingAnimation.path.length > 2 ? 's' : ''})`}
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-sm font-medium">
                      {language === 'tr' ? 'Ping başarısız - bağlantı yok!' : 'Ping failed - no connection!'}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
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

      {/* Mobile Bottom Action Bar */}
      {isMobile && renderMobileBottomBar()}

      {/* Port Selector Modal */}
      {showPortSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-lg mx-4 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-2xl overflow-hidden max-h-[80vh] flex flex-col`}>
            {/* Header */}
            <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'} flex-shrink-0`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {portSelectorStep === 'target' && (
                    <button
                      onClick={() => {
                        setPortSelectorStep('source');
                        setSelectedSourcePort(null);
                      }}
                      className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {portSelectorStep === 'source'
                      ? (language === 'tr' ? 'Başlangıç Portu Seçin' : 'Select Source Port')
                      : (language === 'tr' ? 'Hedef Portu Seçin' : 'Select Target Port')
                    }
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowPortSelector(false);
                    setPortSelectorStep('source');
                    setSelectedSourcePort(null);
                  }}
                  className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Cable Type Selector */}
              <div className="mt-3">
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-2`}>
                  {language === 'tr' ? 'Kablo Tipi' : 'Cable Type'}
                </div>
                <div className="flex gap-2">
                  {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => onCableChange({ ...cableInfo, cableType: type })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${cableInfo.cableType === type
                        ? `${CABLE_COLORS[type].bg} text-white`
                        : isDark
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded ${CABLE_COLORS[type].bg}`} />
                      {getCableTypeName(type, language)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Device & Port List */}
            <div className="overflow-y-auto p-4 space-y-3 flex-1">
              {devices.map((device) => {
                const availablePorts = device.ports.filter(p => p.status === 'disconnected');
                if (availablePorts.length === 0) return null;

                // For target step, exclude the source device
                if (portSelectorStep === 'target' && selectedSourcePort?.deviceId === device.id) return null;

                return (
                  <div
                    key={device.id}
                    className={`rounded-xl border ${isDark ? 'border-slate-700 bg-slate-700/30' : 'border-slate-200 bg-slate-50'}`}
                  >
                    {/* Device Header */}
                    <div className={`px-3 py-2 flex items-center gap-2 border-b ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
                      <div className={
                        device.type === 'pc' ? 'text-blue-400' : device.type === 'switch' ? 'text-emerald-400' : 'text-purple-400'
                      }>
                        {DEVICE_ICONS[device.type]}
                      </div>
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {device.name}
                      </span>
                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        ({availablePorts.length} {language === 'tr' ? 'müsait' : 'available'})
                      </span>
                    </div>

                    {/* Port Grid */}
                    <div className="p-3 flex flex-wrap gap-2">
                      {availablePorts.map((port) => (
                        <button
                          key={port.id}
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
                                  if (d.id === device.id) {
                                    return {
                                      ...d,
                                      ports: d.ports.map((p) =>
                                        p.id === port.id ? { ...p, status: 'connected' as const } : p
                                      ),
                                    };
                                  }
                                  return d;
                                })
                              );

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
                          className={`px-3 py-2 rounded-lg text-sm font-mono transition-all ${isDark
                            ? 'bg-slate-600 hover:bg-cyan-600 text-slate-200 hover:text-white'
                            : 'bg-white hover:bg-cyan-500 text-slate-700 hover:text-white border border-slate-200'
                            }`}
                        >
                          {port.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {devices.every(d => d.ports.filter(p => p.status === 'disconnected').length === 0) && (
                <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {language === 'tr' ? 'Müsait port bulunamadı' : 'No available ports found'}
                </div>
              )}
            </div>

            {/* Footer Hint */}
            <div className={`px-4 py-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} text-center flex-shrink-0`}>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {portSelectorStep === 'source'
                  ? (language === 'tr' ? 'Bağlantıyı başlatacak portu seçin' : 'Select the port to start connection from')
                  : (language === 'tr' ? 'Bağlantıyı tamamlayacak portu seçin' : 'Select the port to complete connection')
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
