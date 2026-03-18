'use client';

import { useTopologyCanvas } from '@/hooks/useTopologyCanvas';
import { useState, useRef, useEffect, useCallback, useMemo, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { CableType, CableInfo, getCableTypeLabel, isCableCompatible } from '@/lib/network/types';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Database, ChevronRight, Trash2, MousePointer2, Pencil, RotateCcw } from "lucide-react";
import { ConnectionLine } from './ConnectionLine';
import { DeviceNode } from './DeviceNode';
import { DeviceIcon } from './DeviceIcon';
import { NetworkTopologyProps, CanvasDevice, CanvasConnection, CanvasNote, ContextMenuState, SelectedPortRef } from './networkTopology.types';
import {
  CABLE_COLORS,
  DEFAULT_ZOOM,
  DEVICE_ICON_PATHS,
  DEVICE_ICONS,
  DRAG_THRESHOLD,
  LONG_PRESS_DURATION,
  MAX_ZOOM,
  MIN_ZOOM,
  NOTE_COLORS,
  NOTE_DEFAULT_HEIGHT,
  NOTE_DEFAULT_WIDTH,
  NOTE_FONTS_DESKTOP,
  NOTE_FONTS_MOBILE,
  NOTE_FONT_SIZES,
  NOTE_HEADER_HEIGHT,
  NOTE_OPACITY,
  VIRTUAL_CANVAS_HEIGHT_DESKTOP,
  VIRTUAL_CANVAS_HEIGHT_MOBILE,
  VIRTUAL_CANVAS_WIDTH_DESKTOP,
  VIRTUAL_CANVAS_WIDTH_MOBILE,
} from './networkTopology.constants';
import { generateMacAddress, generateRouterPorts, generateSwitchPorts } from './networkTopology.helpers';
import NetworkTopologyContextMenu from './NetworkTopologyContextMenu';
import { NetworkTopologyPortSelectorModal } from './NetworkTopologyPortSelectorModal';

// Drag item from palette
interface DragItem {
  type: 'pc' | 'switch' | 'router';
  icon: React.ReactNode;
}


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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: NetworkTopologyProps) {
  // Hook'u en başa alarak visualState'in NetworkTopology scope'unda olmasını sağla
  // Initialize hook
  const { containerRef, canvasRef, visualState, dragState, resetView: canvasReset, updateTransform, updateElementTransform } = useTopologyCanvas({ 
      x: panProp?.x || 0, 
      y: panProp?.y || 0, 
      zoom: zoomProp || DEFAULT_ZOOM 
  });

  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isMobile = useIsMobile();
  const noteFonts = isMobile ? NOTE_FONTS_MOBILE : NOTE_FONTS_DESKTOP;
  const getDualCableLabel = (type: CableType) => getCableTypeLabel(type, language);

  // Helper function to truncate long names with an ellipsis
  const truncateWithEllipsis = useCallback((text: string, maxLength: number) => {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }, []);

  // Default devices for initial state
  const defaultDevices: CanvasDevice[] = [
    {
      id: 'pc-1',
      type: 'pc',
      name: 'PC-1',
      macAddress: generateMacAddress(),
      ip: '192.168.1.10',
      vlan: 1,
      x: 100,
      y: 150,
      status: 'online',
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
      vlan: 1,
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
  const devicesRef = useRef<CanvasDevice[]>(devices);
  const connectionsRef = useRef<CanvasConnection[]>(connections);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  // Port frame should be gray when the device is powered off OR the link's peer is powered off.
  const offlinePortFramesByDevice = useMemo(() => {
    const map = new Map<string, Set<string>>();

    const ensure = (deviceId: string) => {
      const existing = map.get(deviceId);
      if (existing) return existing;
      const next = new Set<string>();
      map.set(deviceId, next);
      return next;
    };

    const byId = new Map(devices.map(d => [d.id, d] as const));

    // If device itself is offline, gray all its ports.
    for (const d of devices) {
      if (d.status === 'offline') {
        const set = ensure(d.id);
        for (const p of d.ports) set.add(p.id);
      }
    }

    for (const c of connections) {
      const a = byId.get(c.sourceDeviceId);
      const b = byId.get(c.targetDeviceId);
      if (!a || !b) continue;

      if (a.status === 'offline' || b.status === 'offline') {
        ensure(c.sourceDeviceId).add(c.sourcePort);
        ensure(c.targetDeviceId).add(c.targetPort);
      }
    }

    return map;
  }, [devices, connections]);

  // Use visualState from hook instead of local zoom/pan states
  const zoom = visualState.current.zoom;
  const setZoom = (val: number | ((prev: number) => number)) => {
    visualState.current.zoom = typeof val === 'function' ? val(visualState.current.zoom) : val;
  };

  const pan = { x: visualState.current.x, y: visualState.current.y };
  const setPan = (val: { x: number, y: number } | ((prev: { x: number, y: number }) => { x: number, y: number })) => {
    const newVal = typeof val === 'function' ? val({ x: visualState.current.x, y: visualState.current.y }) : val;
    visualState.current.x = newVal.x;
    visualState.current.y = newVal.y;
  };

  // Separate visual pan for smooth panning - synced with hook
  const visualPan = { x: visualState.current.x, y: visualState.current.y };
  const setVisualPan = (val: { x: number, y: number }) => {
    visualState.current.x = val.x;
    visualState.current.y = val.y;
  };
  // Tooltip states
  const [portTooltip, setPortTooltip] = useState<{
    deviceId: string;
    portId: string;
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const portTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const portTooltipShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [deviceTooltip, setDeviceTooltip] = useState<{
    deviceId: string;
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const deviceTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceTooltipShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync internal state with props (e.g. from undo/redo or tab switching)
  // We use a ref to track what was already reported back to avoid loops
  const lastStateReportedRef = useRef<string>('');
  const changeVersionRef = useRef(0);
  const lastReportedVersionRef = useRef(0);

  useEffect(() => {
    if (onTopologyChange) {
      changeVersionRef.current += 1;
      const version = changeVersionRef.current;
      const handler = setTimeout(() => {
        if (version === changeVersionRef.current && version !== lastReportedVersionRef.current) {
          lastReportedVersionRef.current = version;
          onTopologyChange(devices, connections, notes);
        }
      }, 100);
      return () => clearTimeout(handler);
    }
  }, [devices, connections, notes, onTopologyChange]);

  // Sync internal state with props (e.g. from undo/redo)
  useEffect(() => {
    let changed = false;
    let nextDevices = devices;
    let nextConnections = connections;
    let nextNotes = notes;

    if (initialDevices && initialDevices !== devices && JSON.stringify(initialDevices) !== JSON.stringify(devices)) {
      nextDevices = initialDevices;
      changed = true;
    }

    if (initialConnections && initialConnections !== connections && JSON.stringify(initialConnections) !== JSON.stringify(connections)) {
      nextConnections = initialConnections;
      changed = true;
    }

    if (initialNotes && initialNotes !== notes && JSON.stringify(initialNotes) !== JSON.stringify(notes)) {
      nextNotes = initialNotes.map(n => ({
        ...n,
        width: n.width || NOTE_DEFAULT_WIDTH,
        height: n.height || NOTE_DEFAULT_HEIGHT,
        color: n.color || NOTE_COLORS[0],
        font: n.font || noteFonts[0],
        fontSize: n.fontSize || 12,
        opacity: n.opacity || 1
      }));
      changed = true;
    }

    if (changed) {
      if (nextDevices !== devices) setDevices(nextDevices);
      if (nextConnections !== connections) setConnections(nextConnections);
      if (nextNotes !== notes) setNotes(nextNotes);

      // Reset the version counter so the outgoing sync doesn't fire for this undo/redo import
      lastReportedVersionRef.current = changeVersionRef.current;
    }
  }, [initialDevices, initialConnections, initialNotes, noteFonts]);

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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Clipboard state for copy/cut/paste
  const [clipboard, setClipboard] = useState<CanvasDevice[]>([]);
  const [noteClipboard, setNoteClipboard] = useState<CanvasNote[]>([]);
  const noteTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});



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
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);

  // Sync with prop
  useEffect(() => {
    if (isFullscreenProp !== undefined) {
      setIsFullscreen(isFullscreenProp);
    }
  }, [isFullscreenProp]);

  // Touch/Mobile state

  // Context menu rendering moved to NetworkTopologyContextMenu
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [isTouchDraggingNote, setIsTouchDraggingNote] = useState(false);
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
  const [selectedSourcePort, setSelectedSourcePort] = useState<SelectedPortRef | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuOpenedAtRef = useRef(0);

  const closePortSelector = useCallback(() => {
    setShowPortSelector(false);
    setPortSelectorStep('source');
    setSelectedSourcePort(null);
  }, []);

  const handlePortSelectorSelectPort = useCallback((deviceId: string, portId: string) => {
    if (portSelectorStep === 'source') {
      setSelectedSourcePort({ deviceId, portId });
      setPortSelectorStep('target');
      return;
    }

    if (!selectedSourcePort) return;

    const newConnection: CanvasConnection = {
      id: `conn-${Date.now()}`,
      sourceDeviceId: selectedSourcePort.deviceId,
      sourcePort: selectedSourcePort.portId,
      targetDeviceId: deviceId,
      targetPort: portId,
      cableType: cableInfo.cableType,
      active: true,
    };

    const updatedConnections = [...connections, newConnection];
    setConnections(updatedConnections);

    const updatedDevices = devices.map((d) => {
      if (d.id === selectedSourcePort.deviceId) {
        return {
          ...d,
          ports: d.ports.map((p) =>
            p.id === selectedSourcePort.portId ? { ...p, status: 'connected' as const } : p
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

    const sourceDevice = devices.find((d) => d.id === selectedSourcePort.deviceId);
    const targetDevice = devices.find((d) => d.id === deviceId);
    if (sourceDevice && targetDevice) {
      onCableChange({
        ...cableInfo,
        connected: true,
        sourceDevice: sourceDevice.type === 'router' ? 'switch' : sourceDevice.type,
        targetDevice: targetDevice.type === 'router' ? 'switch' : targetDevice.type,
      });
    }

    closePortSelector();
  }, [portSelectorStep, selectedSourcePort, connections, devices, cableInfo, onTopologyChange, notes, onCableChange, closePortSelector]);

  // Ping animation state
  const [pingAnimation, setPingAnimation] = useState<{
    sourceId: string;
    targetId: string;
    path: string[];
    currentHopIndex: number;
    progress: number;
    frame: number;
    success: boolean | null;
  } | null>(null);

  // Refs
  // canvasRef removed: now managed by useTopologyCanvas hook
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
    setDnsValue('');
  }, [configuringDevice, tempNameValue, ipValue, subnetValue, gatewayValue, dnsValue]);

  const toggleDevicePower = useCallback(() => {
    if (!configuringDevice) return;
    setDevices(prev =>
      prev.map(d =>
        d.id === configuringDevice
          ? { ...d, status: d.status === 'offline' ? 'online' : 'offline' }
          : d
      )
    );
  }, [configuringDevice]);

  const recomputePortStatuses = useCallback((nextDevices: CanvasDevice[], nextConnections: CanvasConnection[]) => {
    return nextDevices.map((d) => ({
      ...d,
      ports: d.ports.map((p) => {
        // Preserve powered-off behavior.
        if (d.status === 'offline') return { ...p, status: 'disabled' as const };

        const isConnected = nextConnections.some((c) =>
          c.active &&
          ((c.sourceDeviceId === d.id && c.sourcePort === p.id) ||
            (c.targetDeviceId === d.id && c.targetPort === p.id))
        );

        return { ...p, status: isConnected ? 'connected' as const : 'disconnected' as const };
      }),
    }));
  }, []);

  const deleteDevices = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);

    const remainingDevices = devices.filter((d) => !idSet.has(d.id));
    const remainingConnections = connections.filter((c) => !idSet.has(c.sourceDeviceId) && !idSet.has(c.targetDeviceId));
    const updatedDevices = recomputePortStatuses(remainingDevices, remainingConnections);

    setDevices(updatedDevices);
    setConnections(remainingConnections);
    if (onTopologyChange) onTopologyChange(updatedDevices, remainingConnections, notes);

    // Keep existing external delete side-effects per device (page.tsx sim state cleanup, etc.).
    if (onDeviceDelete) ids.forEach((id) => onDeviceDelete(id));
  }, [devices, connections, notes, onTopologyChange, onDeviceDelete, recomputePortStatuses]);

  const deleteSelection = useCallback((deviceIds: string[], noteIds: string[]) => {
    if (deviceIds.length === 0 && noteIds.length === 0) return;

    const deviceIdSet = new Set(deviceIds);
    const noteIdSet = new Set(noteIds);

    const remainingDevices = devices.filter((d) => !deviceIdSet.has(d.id));
    const remainingConnections = connections.filter((c) => !deviceIdSet.has(c.sourceDeviceId) && !deviceIdSet.has(c.targetDeviceId));
    const remainingNotes = notes.filter((n) => !noteIdSet.has(n.id));

    const updatedDevices = recomputePortStatuses(remainingDevices, remainingConnections);

    setDevices(updatedDevices);
    setConnections(remainingConnections);
    setNotes(remainingNotes);
    if (onTopologyChange) onTopologyChange(updatedDevices, remainingConnections, remainingNotes);

    if (onDeviceDelete) deviceIds.forEach((id) => onDeviceDelete(id));
  }, [devices, connections, notes, onTopologyChange, onDeviceDelete, recomputePortStatuses]);

  // Delete device and its connections
  const deleteDevice = useCallback((deviceId: string) => {
    deleteDevices([deviceId]);
  }, [deleteDevices]);

  const selectAllDevices = useCallback(() => {
    const allIds = devices.map(d => d.id);
    setSelectedDeviceIds(allIds);
    setSelectedNoteIds(notes.map(n => n.id));
    setSelectAllMode(true);
    setContextMenu(null);
  }, [devices, notes]);

  const handleAlign = useCallback((type: 'top' | 'bottom' | 'left' | 'right' | 'h-center' | 'v-center') => {
    if (selectedDeviceIds.length + selectedNoteIds.length < 2) return;

    const allSelectedItems: { id: string; x: number; y: number; isDevice: boolean }[] = [];

    devices.forEach(d => {
      if (selectedDeviceIds.includes(d.id)) {
        allSelectedItems.push({ id: d.id, x: d.x, y: d.y, isDevice: true });
      }
    });

    notes.forEach(n => {
      if (selectedNoteIds.includes(n.id)) {
        allSelectedItems.push({ id: n.id, x: n.x, y: n.y, isDevice: false });
      }
    });

    if (allSelectedItems.length < 2) return;

    let targetValue = 0;
    switch (type) {
      case 'top':
        targetValue = Math.min(...allSelectedItems.map(sd => sd.y));
        break;
      case 'bottom':
        targetValue = Math.max(...allSelectedItems.map(sd => sd.y));
        break;
      case 'left':
        targetValue = Math.min(...allSelectedItems.map(sd => sd.x));
        break;
      case 'right':
        targetValue = Math.max(...allSelectedItems.map(sd => sd.x));
        break;
      case 'h-center':
        targetValue = allSelectedItems.reduce((sum, sd) => sum + sd.y, 0) / allSelectedItems.length;
        break;
      case 'v-center':
        targetValue = allSelectedItems.reduce((sum, sd) => sum + sd.x, 0) / allSelectedItems.length;
        break;
    }

    if (selectedDeviceIds.length > 0) {
      setDevices(prev => prev.map(d => {
        if (!selectedDeviceIds.includes(d.id)) return d;
        if (type === 'top' || type === 'bottom' || type === 'h-center') {
          return { ...d, y: targetValue };
        }
        if (type === 'left' || type === 'right' || type === 'v-center') {
          return { ...d, x: targetValue };
        }
        return d;
      }));
    }

    if (selectedNoteIds.length > 0) {
      setNotes(prev => prev.map(n => {
        if (!selectedNoteIds.includes(n.id)) return n;
        if (type === 'top' || type === 'bottom' || type === 'h-center') {
          return { ...n, y: targetValue };
        }
        if (type === 'left' || type === 'right' || type === 'v-center') {
          return { ...n, x: targetValue };
        }
        return n;
      }));
    }
  }, [selectedDeviceIds, selectedNoteIds, devices, notes]);

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

  const canvasDimensions = useMemo(() => {
    if (typeof window === 'undefined') return { width: VIRTUAL_CANVAS_WIDTH_DESKTOP, height: VIRTUAL_CANVAS_HEIGHT_DESKTOP };
    return isMobile
      ? { width: VIRTUAL_CANVAS_WIDTH_MOBILE, height: VIRTUAL_CANVAS_HEIGHT_MOBILE }
      : { width: VIRTUAL_CANVAS_WIDTH_DESKTOP, height: VIRTUAL_CANVAS_HEIGHT_DESKTOP };
  }, [isMobile]);

  const getCanvasDimensions = useCallback(() => canvasDimensions, [canvasDimensions]);


  // Close context menu when clicking outside
  useEffect(() => {
    const handlePointerUpOutside = (e: MouseEvent) => {
      if (!contextMenu) return;
      // Ignore the initial click right after opening
      if (Date.now() - contextMenuOpenedAtRef.current < 150) return;
      const target = e.target as HTMLElement;
      if (!target.closest('.context-menu')) {
        setContextMenu(null);
      }
    };

    window.addEventListener('mouseup', handlePointerUpOutside);
    return () => window.removeEventListener('mouseup', handlePointerUpOutside);
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
    contextMenuOpenedAtRef.current = Date.now();
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
      return;
    } else if (e.button === 0 && !(e.target as HTMLElement).closest('[data-device-id], [data-note-id], [data-note-drag-handle]')) {
      setIsPanning(true);
      isBusyRef.current = true; // Pause animations
      // Cancel ping animation when starting pan
      if (pingAnimationRef.current) {
        cancelAnimationFrame(pingAnimationRef.current);
        pingAnimationRef.current = null;
      }
      // Use visualPan for the starting position during panning
      setPanStart({ x: e.clientX - visualPan.x, y: e.clientY - visualPan.y });
      setSelectedDeviceIds([]);
      setSelectedNoteIds([]);
      setContextMenu(null);
      setSelectAllMode(false);
    }
  }, [visualPan]);

  // Refs for animation frames to throttle updates
  const panAnimationFrameRef = useRef<number | null>(null);
  const svgGroupRef = useRef<SVGGElement | null>(null);
  const currentPanRef = useRef({ x: pan.x, y: pan.y });
  
  // Refs for tracking busy state (pan/drag) to pause animations
  const isBusyRef = useRef(false);
  
  // Sync currentPanRef with pan state when not panning
  useEffect(() => {
    if (!isBusyRef.current || !isPanning) {
      currentPanRef.current = { x: pan.x, y: pan.y };
    }
  }, [pan, isPanning]);

  // Cleanup animation frames on unmount
  useEffect(() => {
    return () => {
      if (dragAnimationFrameRef.current !== null) cancelAnimationFrame(dragAnimationFrameRef.current);
      if (panAnimationFrameRef.current !== null) cancelAnimationFrame(panAnimationFrameRef.current);
    };
  }, []);

  // Handle mouse move for panning and dragging
  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (isPanning) {
        // Update visual pan - this is the only state update during panning
        const newPanX = e.clientX - panStart.x;
        const newPanY = e.clientY - panStart.y;
        currentPanRef.current = { x: newPanX, y: newPanY };
        // Update visualPan state for rendering
        setVisualPan({ x: newPanX, y: newPanY });
        // Also update DOM directly for maximum smoothness
        if (svgGroupRef.current) {
          svgGroupRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0) scale(${zoom})`;
        }
      } else if (draggedDevice && canvasRef.current) {
        // Check if we've moved enough to consider it a drag
        if (dragStartPos) {
          const distance = Math.sqrt(Math.pow(dragStartPos.x - e.clientX, 2) + Math.pow(dragStartPos.y - e.clientY, 2));
          if (distance > DRAG_THRESHOLD) {
            setIsActuallyDragging(true);
            isBusyRef.current = true; // Pause animations
            // Cancel ping animation when starting drag
            if (pingAnimationRef.current) {
              cancelAnimationFrame(pingAnimationRef.current);
              pingAnimationRef.current = null;
            }
            wasDraggingRef.current = true; // Mark as dragging for click handler
            setPortTooltip(null); // Hide any active tooltip
          }
        }

        if (isActuallyDragging) {
          // Optimized dragging with reduced calculations
          if (dragAnimationFrameRef.current !== null) return;

          dragAnimationFrameRef.current = requestAnimationFrame(() => {
            if (!canvasRef.current || !dragStartPos) {
              dragAnimationFrameRef.current = null;
              return;
            }
            const rect = canvasRef.current.getBoundingClientRect();
            const dx = (e.clientX - rect.left - pan.x) / zoom - (dragStartPos.x - rect.left - pan.x) / zoom;
            const dy = (e.clientY - rect.top - pan.y) / zoom - (dragStartPos.y - rect.top - pan.y) / zoom;

            const canvasDims = getCanvasDimensions();
            const devicesToMove = selectedDeviceIds.includes(draggedDevice)
              ? selectedDeviceIds
              : [draggedDevice];

            setDevices((prev) => {
              const updates: { id: string; x: number; y: number }[] = [];

              devicesToMove.forEach(id => {
                const device = prev.find(d => d.id === id);
                const initialPos = dragStartDevicePositions[id];
                if (device && initialPos) {
                  const rawX = initialPos.x + dx;
                  const rawY = initialPos.y + dy;
                  const newX = Math.max(20, Math.min(rawX, canvasDims.width - 100));
                  const newY = Math.max(20, Math.min(rawY, canvasDims.height - 100));

                  if (Math.abs(device.x - newX) > 0.01 || Math.abs(device.y - newY) > 0.01) {
                    updates.push({ id, x: newX, y: newY });
                  }
                }
              });

              if (updates.length === 0) return prev;

              return prev.map(d => {
                const update = updates.find(u => u.id === d.id);
                return update ? { ...d, x: update.x, y: update.y } : d;
              });
            });

            // Also move selected notes when dragging devices
            if (selectedNoteIds.length > 0 && Object.keys(noteDragStartPositions).length > 0) {
              setNotes(prev =>
                prev.map(n => {
                  if (!selectedNoteIds.includes(n.id)) return n;
                  const start = noteDragStartPositions[n.id];
                  if (!start) return n;
                  const rawX = start.x + dx;
                  const rawY = start.y + dy;
                  const newX = Math.max(20, Math.min(rawX, canvasDims.width - NOTE_DEFAULT_WIDTH - 20));
                  const newY = Math.max(20, Math.min(rawY, canvasDims.height - NOTE_DEFAULT_HEIGHT - 20));
                  return { ...n, x: newX, y: newY };
                })
              );
            }

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
        const distance = Math.sqrt(Math.pow(noteDragStartPos.x - coords.x, 2) + Math.pow(noteDragStartPos.y - coords.y, 2));

        if (distance > DRAG_THRESHOLD) {
          wasDraggingRef.current = true;

          const canvasDims = getCanvasDimensions();
          const dx = coords.x - noteDragStartPos.x;
          const dy = coords.y - noteDragStartPos.y;
          const targets = selectedNoteIds.includes(draggedNoteId) ? selectedNoteIds : [draggedNoteId];

          setNotes(prev =>
            prev.map(n => {
              if (!targets.includes(n.id)) return n;
              const start = noteDragStartPositions[n.id] || { x: n.x, y: n.y };
              const rawX = start.x + dx;
              const rawY = start.y + dy;
              const clampedX = Math.max(20, Math.min(rawX, canvasDims.width - NOTE_DEFAULT_WIDTH - 20));
              const clampedY = Math.max(20, Math.min(rawY, canvasDims.height - NOTE_DEFAULT_HEIGHT - 20));
              return { ...n, x: clampedX, y: clampedY };
            })
          );

          // Also move selected devices when dragging notes
          if (selectedDeviceIds.length > 0 && Object.keys(dragStartDevicePositions).length > 0) {
            setDevices(prev =>
              prev.map(d => {
                if (!selectedDeviceIds.includes(d.id)) return d;
                const start = dragStartDevicePositions[d.id];
                if (!start) return d;
                const rawX = start.x + dx;
                const rawY = start.y + dy;
                const newX = Math.max(20, Math.min(rawX, canvasDims.width - 100));
                const newY = Math.max(20, Math.min(rawY, canvasDims.height - 100));
                return { ...d, x: newX, y: newY };
              })
            );
          }
        }
      } else if (isDrawingConnection) {
        const coords = getCanvasCoords(e.clientX, e.clientY);
        setMousePos(coords);
      }

      // Update tooltip position if visible or pending
      if (deviceTooltip) {
        setDeviceTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
      }
      if (portTooltip) {
        setPortTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
      }
    };

    const handleMouseUp = (e: globalThis.MouseEvent) => {
      // Cancel any pending animation frame
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }
      if (panAnimationFrameRef.current) {
        cancelAnimationFrame(panAnimationFrameRef.current);
        panAnimationFrameRef.current = null;
      }

      // Save to history and notify parent if we were actually dragging
      if (isActuallyDragging && draggedDevice) {
        if (onTopologyChange) {
          onTopologyChange(devices, connections, notes);
        }
      }

      if (isPanning) {
        // Commit pan from ref to state when panning ends
        const finalPan = currentPanRef.current;
        setPan(finalPan);
        setVisualPan(finalPan); // Sync visualPan with the committed pan
        if (onPanChange) onPanChange(finalPan);
      }

      if (resizingNoteId) {
        if (onTopologyChange) {
          onTopologyChange(devices, connections, notes);
        }
      }

      if (draggedNoteId) {
        if (onTopologyChange) {
          onTopologyChange(devices, connections, notes);
        }
      }

      // Note: We don't reset wasDraggingRef here - let it persist for the click handler
      // The click handler will check wasDraggingRef and the next mousedown will reset it

      setIsPanning(false);
      isBusyRef.current = false; // Resume animations
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
  }, [isPanning, panStart, draggedDevice, draggedNoteId, resizingNoteId, noteDragStartPos, noteResizeStartPos, noteResizeStartSizes, zoom, pan, isDrawingConnection, getCanvasCoords, getCanvasDimensions, dragStartPos, isActuallyDragging, getDistance, onDeviceSelect, selectedDeviceIds, selectedNoteIds, dragStartDevicePositions, noteDragStartPositions, notes, connections, devices, deviceTooltip, portTooltip]);

  // Global touch event handlers for device/note dragging on mobile
  useEffect(() => {
    if (!isMobile) return;

    const handleGlobalTouchMove = (e: globalThis.TouchEvent) => {
      if (e.touches.length !== 1 || !canvasRef.current) return;

      const touch = e.touches[0];

      if (touchDraggedDevice) {
        // Check if we've moved enough to consider it a drag
        if (touchDragStartPos) {
          const distance = getDistance(touchDragStartPos.x, touchDragStartPos.y, touch.clientX, touch.clientY);
          if (distance > DRAG_THRESHOLD) {
            setIsTouchDragging(true);
          }
        }

        if (isTouchDragging) {
          if (e.cancelable) e.preventDefault(); // Prevent page scroll
          if (!canvasRef.current || !touchDragStartPos) {
            dragAnimationFrameRef.current = null;
            return;
          }
          const rect = canvasRef.current.getBoundingClientRect();
          const rawX = (touch.clientX - rect.left - pan.x - touchDragOffset.x) / zoom;
          const rawY = (touch.clientY - rect.top - pan.y - touchDragOffset.y) / zoom;
          const canvasDims = getCanvasDimensions();
          const clampedX = Math.max(50, Math.min(rawX, canvasDims.width - 120));
          const clampedY = Math.max(50, Math.min(rawY, canvasDims.height - 150));

          // Use requestAnimationFrame for smooth updates
          if (dragAnimationFrameRef.current !== null) return;

          dragAnimationFrameRef.current = requestAnimationFrame(() => {
            if (!touchDraggedDevice) {
              dragAnimationFrameRef.current = null;
              return;
            }
            setDevices((prev) => {
              let changed = false;
              const nextDevices = prev.map((d) => {
                if (d.id !== touchDraggedDevice) return d;
                if (Math.abs(d.x - clampedX) > 0.05 || Math.abs(d.y - clampedY) > 0.05) {
                  changed = true;
                  return { ...d, x: clampedX, y: clampedY };
                }
                return d;
              });
              return changed ? nextDevices : prev;
            });
            dragAnimationFrameRef.current = null;
          });
        }
        return;
      }

      if (draggedNoteId && noteDragStartPos) {
        const coords = getCanvasCoords(touch.clientX, touch.clientY);
        const distance = getDistance(noteDragStartPos.x, noteDragStartPos.y, coords.x, coords.y);
        if (distance > DRAG_THRESHOLD) {
          setIsTouchDraggingNote(true);
        }

        if (isTouchDraggingNote) {
          if (e.cancelable) e.preventDefault(); // Prevent page scroll
          const canvasDims = getCanvasDimensions();
          const dx = coords.x - noteDragStartPos.x;
          const dy = coords.y - noteDragStartPos.y;
          const targets = selectedNoteIds.includes(draggedNoteId) ? selectedNoteIds : [draggedNoteId];

          setNotes(prev =>
            prev.map(n => {
              if (!targets.includes(n.id)) return n;
              const start = noteDragStartPositions[n.id] || { x: n.x, y: n.y };
              const rawX = start.x + dx;
              const rawY = start.y + dy;
              const clampedX = Math.max(20, Math.min(rawX, canvasDims.width - NOTE_DEFAULT_WIDTH - 20));
              const clampedY = Math.max(20, Math.min(rawY, canvasDims.height - NOTE_DEFAULT_HEIGHT - 20));
              return { ...n, x: clampedX, y: clampedY };
            })
          );
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

      if (draggedNoteId && isTouchDraggingNote) {
        // Handled by effect
      }

      setTouchDraggedDevice(null);
      setTouchDragStartPos(null);
      setIsTouchDragging(false);
      setIsTouchDraggingNote(false);
      setLastTouchDistance(null);
      setTouchStart(null);
      lastDragPositionRef.current = null;
      setDraggedNoteId(null);
      setNoteDragStartPos(null);
      setNoteDragStartPositions({});

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
  }, [isMobile, touchDraggedDevice, touchDragOffset, touchDragStartPos, isTouchDragging, draggedNoteId, noteDragStartPos, noteDragStartPositions, isTouchDraggingNote, pan, zoom, getDistance, getCanvasCoords, getCanvasDimensions, devices, connections, notes, selectedNoteIds, onDeviceSelect, onTopologyChange, longPressTimer]);

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
        setSelectedNoteIds([]);
        onDeviceSelect(device.type === 'router' ? 'switch' : device.type, deviceId);
      }
    }

    // Store starting positions of all selected devices for group dragging
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

    // Also store note positions for combined dragging
    const noteStartPositions: { [key: string]: { x: number; y: number } } = {};
    if (selectedNoteIds.length > 0) {
      notes.forEach(n => {
        if (selectedNoteIds.includes(n.id)) {
          noteStartPositions[n.id] = { x: n.x, y: n.y };
        }
      });
    }
    setNoteDragStartPositions(noteStartPositions);

    // Store the starting position for distance calculation
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setIsActuallyDragging(false);
    setDraggedDevice(deviceId);
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) - device.x * zoom,
      y: (e.clientY - rect.top - pan.y) - device.y * zoom,
    });
  }, [devices, notes, pan, zoom, selectedDeviceIds, selectedNoteIds, onDeviceSelect]);

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
    wasDraggingRef.current = false; // Reset drag tracking for note
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    setDraggedNoteId(noteId);
    setNoteDragStartPos(coords);
    const nextSelected = e.shiftKey
      ? (selectedNoteIds.includes(noteId) ? selectedNoteIds.filter(id => id !== noteId) : [...selectedNoteIds, noteId])
      : (selectedNoteIds.includes(noteId) ? selectedNoteIds : [noteId]);
    if (!e.shiftKey && !selectedNoteIds.includes(noteId)) {
      setSelectedDeviceIds([]);
    }
    setSelectedNoteIds(nextSelected);
    const targets = nextSelected.includes(noteId) ? nextSelected : [noteId];
    const startPositions: { [key: string]: { x: number; y: number } } = {};
    targets.forEach(id => {
      const n = notes.find(nn => nn.id === id);
      if (n) startPositions[id] = { x: n.x, y: n.y };
    });
    setNoteDragStartPositions(startPositions);

    // Also store device positions for combined dragging
    const deviceStartPositions: { [key: string]: { x: number; y: number } } = {};
    if (selectedDeviceIds.length > 0) {
      devices.forEach(d => {
        if (selectedDeviceIds.includes(d.id)) {
          deviceStartPositions[d.id] = { x: d.x, y: d.y };
        }
      });
    }
    setDragStartDevicePositions(deviceStartPositions);

    setContextMenu(null);
    setSelectAllMode(false);
  }, [notes, devices, getCanvasCoords, selectedNoteIds, selectedDeviceIds]);

  const handleNoteTouchStart = useCallback((e: ReactTouchEvent, noteId: string) => {
    if (e.touches.length !== 1) return;
    if ((e.target as HTMLElement).closest('[data-note-textarea]')) return;
    e.stopPropagation();
    const touch = e.touches[0];
    const coords = getCanvasCoords(touch.clientX, touch.clientY);
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    setDraggedNoteId(noteId);
    setNoteDragStartPos(coords);
    setIsTouchDraggingNote(false);
    const nextSelected = selectedNoteIds.includes(noteId) ? selectedNoteIds : [noteId];
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
    if (isMobile) return;
    e.stopPropagation();
    const coords = getCanvasCoords(e.clientX, e.clientY);
    setResizingNoteId(noteId);
    setNoteResizeStartPos(coords);
    const start = notes.find(n => n.id === noteId);
    if (start) {
      setNoteResizeStartSizes({ [noteId]: { width: start.width, height: start.height } });
    }
  }, [getCanvasCoords, notes, isMobile]);

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
    setNotes(nextNotes);
  }, []);

  const updateNoteStyle = useCallback((noteId: string, patch: Partial<Pick<CanvasNote, 'color' | 'font' | 'fontSize' | 'opacity' | 'bold' | 'italic' | 'underline'>>) => {
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

    // Hide tooltips when context menu opens
    setDeviceTooltip(null);
    setPortTooltip(null);

    window.dispatchEvent(new CustomEvent('close-menus-broadcast', { detail: { source: 'topology' } }));
    openContextMenu(x, y, deviceId || null, null, deviceId ? 'device' : 'canvas');
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
    if (e.cancelable) e.preventDefault(); // Prevent scrolling

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

      // Virtual drag: update DOM directly
      updateElementTransform(touchDraggedDevice, newX, newY);
      
      // Store temp coordinates in dragState for final commit
      dragState.current = { 
        id: touchDraggedDevice, 
        offset: { x: newX, y: newY } 
      };
    }
  }, [touchDraggedDevice, touchDragOffset, touchDragStartPos, isTouchDragging, pan, zoom, getDistance, updateElementTransform, dragState]);

  // Handle device touch end - for mobile dragging
  const handleDeviceTouchEnd = useCallback(() => {
    // If we were dragging, commit the final coordinates to React state
    if (isTouchDragging && dragState.current.id) {
      const { id, offset } = dragState.current;
      const canvasDims = getCanvasDimensions();
      setDevices((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, x: Math.max(50, Math.min(offset.x, canvasDims.width - 120)), y: Math.max(50, Math.min(offset.y, canvasDims.height - 150)) }
            : d
        )
      );
      // Reset DOM transform for the element
      const el = document.getElementById(`node-${id}`);
      if (el) el.style.transform = '';
    } else if (touchDraggedDevice && !isTouchDragging) {
      // If we weren't dragging, treat it as a tap (select)
      const device = devices.find(d => d.id === touchDraggedDevice);
      if (device) {
        setSelectedDeviceIds([device.id]);
        onDeviceSelect(device.type, device.id);
      }
    }

    setTouchDraggedDevice(null);
    setTouchDragStartPos(null);
    setIsTouchDragging(false);
    dragState.current = { id: null, offset: { x: 0, y: 0 } };
  }, [touchDraggedDevice, isTouchDragging, devices, onDeviceSelect, getCanvasDimensions]);

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
      const target = e.target as HTMLElement | null;
      const noteTextarea = target?.closest('[data-note-textarea]') as HTMLElement | null;
      if (noteTextarea && noteTextarea.scrollHeight > noteTextarea.clientHeight) {
        return; // allow note text scrolling without zoom
      }

      e.preventDefault(); // prevent window scroll

      const rect = canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const zoomSensitivity = 0.0015;
      const delta = -e.deltaY;

      setZoom(prevZoom => {
        const newZoom = Math.max(MIN_ZOOM, Math.min(prevZoom * Math.exp(delta * zoomSensitivity), MAX_ZOOM));

        // Only adjust pan if zoom actually changed
        if (newZoom !== prevZoom) {
          const zoomRatio = newZoom / prevZoom;
          setPan(prevPan => ({
            x: cursorX - (cursorX - prevPan.x) * zoomRatio,
            y: cursorY - (cursorY - prevPan.y) * zoomRatio
          }));
        }
        return newZoom;
      });
    };

    // passive: false is required to preventDefault on wheel
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const duplicateNote = useCallback((noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const newNote: CanvasNote = {
      ...note,
      id: `note-${Date.now()}`,
      x: note.x + 20,
      y: note.y + 20,
    };

    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
  }, [notes]);

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
        setConnectionError(t.portInUse);
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

      if (cableInfo.cableType === 'console') {
        const sourceDevice = devices.find((d) => d.id === connectionStart.deviceId);
        const targetDevice = devices.find((d) => d.id === deviceId);
        const isConsoleAllowed =
          !!sourceDevice &&
          !!targetDevice &&
          ((sourceDevice.type === 'pc' && (targetDevice.type === 'switch' || targetDevice.type === 'router')) ||
            (targetDevice.type === 'pc' && (sourceDevice.type === 'switch' || sourceDevice.type === 'router')));
        if (!isConsoleAllowed) {
          setConnectionError(language === 'tr'
            ? 'Console kablo sadece PC ile Switch/Router arasında bağlanabilir!'
            : 'Console cable can only connect PC to Switch/Router!');
          setTimeout(() => setConnectionError(null), 3000);
          setIsDrawingConnection(false);
          setConnectionStart(null);
          return;
        }
      }
      // Complete connection
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
        : (device.type === 'router'
          ? (getDeviceWidth(device) - (portsPerRow - 1) * portSpacing) / 2
          : 14);
      const portX = device.x + startX + col * portSpacing;
      const portY = device.y + 80 + row * 14;

      setIsDrawingConnection(true);
      setConnectionStart({
        deviceId,
        portId,
        point: { x: portX, y: portY },
      });
    }
  }, [devices, connections, isDrawingConnection, connectionStart, cableInfo, onCableChange, notes, language]);

  // generate an unused IP within 192.168.1.x (skip existing addresses)
  const generateUniqueIp = useCallback(() => {
    let suffix = 100;
    while (devices.some(d => d.ip === `192.168.1.${suffix}`) || suffix === 1 || suffix === 10) {
      suffix++;
    }
    return `192.168.1.${suffix}`;
  }, [devices]);

  const addNote = useCallback(() => {
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
      text: t.note,
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
  }, [notes, pan, zoom, language, getCanvasDimensions, noteFonts]);

  // Add device from palette button
  const addDevice = useCallback((type: 'pc' | 'switch' | 'router') => {
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
      vlan: 1,
      // Position near top-left with staggered layout
      x: 100 + offsetX + Math.random() * 30,
      y: 80 + offsetY + Math.random() * 30,
      status: 'online',
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
  }, [devices, generateUniqueIp]);



  const showPortTooltip = useCallback((e: ReactMouseEvent | MouseEvent, deviceId: string, portId: string) => {
    // Don't show tooltip while dragging
    if (isActuallyDragging || isTouchDragging) return;

    const device = devices.find(d => d.id === deviceId);
    const port = device?.ports.find(p => p.id === portId);
    if (!device || !port) return;

    // Clear any existing timers
    if (portTooltipShowTimerRef.current) clearTimeout(portTooltipShowTimerRef.current);
    if (portTooltipTimerRef.current) clearTimeout(portTooltipTimerRef.current);

    // Clear device tooltip state and timers immediately when hovering over a port
    setDeviceTooltip(null);
    if (deviceTooltipShowTimerRef.current) clearTimeout(deviceTooltipShowTimerRef.current);
    if (deviceTooltipTimerRef.current) clearTimeout(deviceTooltipTimerRef.current);

    // Estimate tooltip dimensions to prevent overflow
    const tooltipWidth = 140;
    const tooltipHeight = 60;
    let x = e.clientX + 15;
    let y = e.clientY + 15;

    if (x + tooltipWidth > window.innerWidth) x = e.clientX - tooltipWidth - 10;
    if (y + tooltipHeight > window.innerHeight) y = e.clientY - tooltipHeight - 10;

    // Start show delay timer (600ms)
    portTooltipShowTimerRef.current = setTimeout(() => {
      setPortTooltip({
        deviceId,
        portId,
        x: e.clientX,
        y: e.clientY,
        visible: true,
      });

      // Auto-hide after 1.5s
      portTooltipTimerRef.current = setTimeout(() => {
        setPortTooltip(prev => prev ? { ...prev, visible: false } : null);
      }, 1500);
    }, 600);
  }, [devices, isActuallyDragging, isTouchDragging]);

  const handlePortHover = useCallback((e: ReactMouseEvent, deviceId: string, portId: string) => {
    showPortTooltip(e, deviceId, portId);
  }, [showPortTooltip]);

  const handlePortMouseLeave = useCallback(() => {
    // Clear both show and hide timers
    if (portTooltipShowTimerRef.current) {
      clearTimeout(portTooltipShowTimerRef.current);
      portTooltipShowTimerRef.current = null;
    }
    if (portTooltipTimerRef.current) {
      clearTimeout(portTooltipTimerRef.current);
      portTooltipTimerRef.current = null;
    }
    // Hide immediately
    setPortTooltip(null);
  }, []);

  const showDeviceTooltip = useCallback((e: ReactMouseEvent | MouseEvent, deviceId: string) => {
    if (isActuallyDragging || isTouchDragging) return;

    // Do not show device tooltip if a port tooltip is active or pending
    if (portTooltip || portTooltipShowTimerRef.current) return;

    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    // Clear any existing timers
    if (deviceTooltipShowTimerRef.current) clearTimeout(deviceTooltipShowTimerRef.current);
    if (deviceTooltipTimerRef.current) clearTimeout(deviceTooltipTimerRef.current);

    // Estimate tooltip dimensions to prevent overflow
    const tooltipWidth = 180;
    const tooltipHeight = 160;
    let x = e.clientX + 15;
    let y = e.clientY + 15;

    if (x + tooltipWidth > window.innerWidth) x = e.clientX - tooltipWidth - 10;
    if (y + tooltipHeight > window.innerHeight) y = e.clientY - tooltipHeight - 10;

    // Start show delay timer (600ms)
    deviceTooltipShowTimerRef.current = setTimeout(() => {
      setDeviceTooltip({
        deviceId,
        x,
        y,
        visible: true,
      });

      // Clear port tooltip state and timers when device tooltip shows
      setPortTooltip(null);
      if (portTooltipShowTimerRef.current) clearTimeout(portTooltipShowTimerRef.current);
      if (portTooltipTimerRef.current) clearTimeout(portTooltipTimerRef.current);

      // Auto-hide after 3s (stays visible for a while)
      deviceTooltipTimerRef.current = setTimeout(() => {
        setDeviceTooltip(prev => prev ? { ...prev, visible: false } : null);
      }, 3000);
    }, 600);
  }, [isActuallyDragging, isTouchDragging, devices, portTooltip]);

  const handleDeviceHover = useCallback((e: ReactMouseEvent, deviceId: string) => {
    showDeviceTooltip(e, deviceId);
  }, [showDeviceTooltip]);

  const handleDeviceMouseLeave = useCallback(() => {
    // Clear both show and hide timers
    if (deviceTooltipShowTimerRef.current) {
      clearTimeout(deviceTooltipShowTimerRef.current);
      deviceTooltipShowTimerRef.current = null;
    }
    if (deviceTooltipTimerRef.current) {
      clearTimeout(deviceTooltipTimerRef.current);
      deviceTooltipTimerRef.current = null;
    }
    // Hide immediately
    setDeviceTooltip(null);
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

  // Sync port shutdown status and VLANs from deviceStates
  useEffect(() => {
    if (!deviceStates || devices.length === 0) return;

    let anyDeviceChanged = false;
    const updatedDevices = devices.map(device => {
      let deviceChanged = false;
      const deviceState = deviceStates.get(device.id);

      // Part 1: Sync shutdown status from simulator state to canvas ports
      const updatedPorts = device.ports.map(port => {
        if (!deviceState) return port;
        const simulatorPort = deviceState.ports[port.id];
        if (simulatorPort && simulatorPort.shutdown !== port.shutdown) {
          deviceChanged = true;
          return { ...port, shutdown: simulatorPort.shutdown };
        }
        return port;
      });

      // Part 2: If PC is connected to a switch, sync its VLAN from the switch's port VLAN
      let newVlan = device.vlan;
      if (device.type === 'pc') {
        const conn = connections.find(c => c.sourceDeviceId === device.id || c.targetDeviceId === device.id);
        if (conn) {
          const otherDeviceId = conn.sourceDeviceId === device.id ? conn.targetDeviceId : conn.sourceDeviceId;
          const otherPortId = conn.sourceDeviceId === device.id ? conn.targetPort : conn.sourcePort;
          const otherDeviceState = deviceStates.get(otherDeviceId);

          if (otherDeviceState && otherDeviceState.ports[otherPortId]) {
            const portVlan = otherDeviceState.ports[otherPortId].vlan;
            if (portVlan !== undefined && portVlan !== device.vlan) {
              newVlan = portVlan;
              deviceChanged = true;
            }
          }
        }
      }

      if (deviceChanged) {
        anyDeviceChanged = true;
        return { ...device, ports: updatedPorts, vlan: newVlan };
      }
      return device;
    });

    if (anyDeviceChanged) {
      setDevices(updatedDevices);
    }
  }, [deviceStates, devices, connections]);


  // Delete connection
  const deleteConnection = useCallback((connectionId: string) => {
    const conn = connections.find((c) => c.id === connectionId);
    let updatedDevices = devices;
    const updatedConnections = connections.filter((c) => c.id !== connectionId);

    if (conn) {
      updatedDevices = devices.map((d) => {
        if (d.id === conn.sourceDeviceId) {
          return { ...d, ports: d.ports.map((p) => (p.id === conn.sourcePort ? { ...p, status: 'notconnect' as const } : p)) };
        }
        if (d.id === conn.targetDeviceId) {
          return { ...d, ports: d.ports.map((p) => (p.id === conn.targetPort ? { ...p, status: 'notconnect' as const } : p)) };
        }
        return d;
      });
      setDevices(updatedDevices);
    }
    setConnections(updatedConnections);

    // Keep parent state (side panels, etc.) in sync so peer port LEDs refresh immediately.
    if (onTopologyChange) onTopologyChange(updatedDevices, updatedConnections, notes);
  }, [connections, devices, notes, onTopologyChange]);

  // Reset view
  const handleResetView = useCallback(() => {
    // Reset canvas to default scale (100%) via hook
    canvasReset();
    
    // Set zoom to 1.0 (100%)
    const nextZoom = 1.0;
    setZoom(nextZoom);
    
    // Force a port-status refresh
    setDevices((prev) => recomputePortStatuses(prev, connectionsRef.current));
  }, [canvasReset, recomputePortStatuses]);

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    setDevices([]);
    setConnections([]);
    setNotes([]);
    setSelectedDeviceIds([]);
    deviceCounterRef.current = { pc: 0, switch: 0, router: 0 };
    if (onTopologyChange) onTopologyChange([], [], []);
  }, [onTopologyChange]);

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
      deleteDevices(ids);
      setSelectedDeviceIds([]);
    }
    setContextMenu(null);
  }, [devices, deleteDevices]);

  // Confirm rename
  const confirmRename = useCallback(() => {
    if (renamingDevice && renameValue.trim()) {
      setDevices(prev => prev.map(d =>
        d.id === renamingDevice ? { ...d, name: renameValue.trim() } : d
      ));
    }
    setRenamingDevice(null);
    setRenameValue('');
  }, [renamingDevice, renameValue]);
  // Paste devices
  const pasteDevice = useCallback(() => {
    if (clipboard.length === 0) return;


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
  }, [clipboard, generateUniqueIp]);

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
        deleteSelection(selectedDeviceIds, selectedNoteIds);
        if (selectedDeviceIds.length > 0) setSelectedDeviceIds([]);
        if (selectedNoteIds.length > 0) setSelectedNoteIds([]);
      }

      // Enter: open terminal for selected device
      if (key === 'enter') {
        if (!configuringDevice && selectedDeviceIds.length === 1) {
          e.preventDefault();
          const device = devices.find(d => d.id === selectedDeviceIds[0]);
          if (device) handleDeviceDoubleClick(device);
        }
      }

      // Alt+Enter: configure selected device
      if (e.altKey && e.key.toLowerCase() === 'enter') {
        if (!configuringDevice && selectedDeviceIds.length === 1) {
          e.preventDefault();
          startDeviceConfig(selectedDeviceIds[0]);
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
          if (onUndo) onUndo();
        }

        // Ctrl+Y to redo
        if (key === 'y') {
          e.preventDefault();
          if (onRedo) onRedo();
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

      // Alt Shortcuts
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (key === 'r') {
          e.preventDefault();
          handleResetView();
        }
      }

    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);

    };
  }, [selectedDeviceIds, selectedNoteIds, deleteDevice, commitNotesChange, configuringDevice, cancelDeviceConfig, selectAllDevices, devices, notes, onDeviceDelete, isDrawingConnection, isPaletteOpen, onUndo, onRedo, copyDevice, cutDevice, pasteDevice, pingSource, showPortSelector, toggleFullscreen, isFullscreen, handleResetView, startDeviceConfig]);

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

            // Check if both ports are NOT shutdown and devices are powered on
            const sPort = sourceDevice.ports.find(p => p.id === sourcePortId);
            const tPort = targetDevice.ports.find(p => p.id === targetPortId);
            const isUp = sPort && !sPort.shutdown && tPort && !tPort.shutdown;
            const isPoweredOn = sourceDevice.status !== 'offline' && targetDevice.status !== 'offline';

            if (isCompatible && isUp && isPoweredOn) {
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

  const getDeviceWidth = useCallback((device: CanvasDevice) => {
    if (device.type === 'pc') return 85;
    if (device.type === 'switch') return 125; // switch width -5px per request
    return 130; // router
  }, []);

  const getDeviceCenter = useCallback((device: CanvasDevice) => {
    const deviceWidth = getDeviceWidth(device);
    const portsPerRow = 8;
    const numRows = Math.ceil(device.ports.length / portsPerRow);
    const deviceHeight = device.type === 'pc' ? 100 : 100 + numRows * 14 + 5;
    return { x: device.x + deviceWidth / 2, y: device.y + deviceHeight / 2 };
  }, [getDeviceWidth]);

  const getPortPosition = useCallback((device: CanvasDevice, portId: string) => {
    const portIndex = device.ports.findIndex(p => p.id === portId);
    if (portIndex === -1) return getDeviceCenter(device);

    const deviceWidth = getDeviceWidth(device);
    const portsPerRow = device.type === 'pc' ? 2 : 8;
    const col = portIndex % portsPerRow;
    const row = Math.floor(portIndex / portsPerRow);
    const portSpacing = device.type === 'pc' ? 18 : 14;
    const rowSpacing = 14;
    const startX = device.type === 'pc'
      ? deviceWidth / 2 - (device.ports.length > 1 ? portSpacing / 2 : 0)
      : (device.type === 'router'
        ? (deviceWidth - (portsPerRow - 1) * portSpacing) / 2
        : 14);
    const startY = device.type === 'pc' ? 80 : 80;

    return {
      x: device.x + startX + col * portSpacing,
      y: device.y + startY + row * rowSpacing
    };
  }, [getDeviceCenter, getDeviceWidth]);

  // Ping animation between devices with multi-hop support
  const startPingAnimation = useCallback((sourceId: string, targetId: string) => {
    // Cancel any existing animation
    if (pingAnimationRef.current) {
      cancelAnimationFrame(pingAnimationRef.current);
    }

    const sourceDevice = devices.find(d => d.id === sourceId);
    const targetDevice = devices.find(d => d.id === targetId);
    if (sourceDevice?.status === 'offline' || targetDevice?.status === 'offline') {
      setPingAnimation({
        sourceId,
        targetId,
        path: [sourceId, targetId],
        currentHopIndex: 0,
        progress: 1,
        frame: 0,
        success: false
      });
      setTimeout(() => setPingAnimation(null), 2500);
      return;
    }

    // VLAN check - success if same VLAN, else fail
    const sourceVlan = sourceDevice?.vlan || 1;
    const targetVlan = targetDevice?.vlan || 1;

    if (sourceVlan !== targetVlan) {
      setPingAnimation({
        sourceId,
        targetId,
        path: [sourceId, targetId],
        currentHopIndex: 0,
        progress: 1,
        frame: 0,
        success: false
      });
      setTimeout(() => setPingAnimation(null), 2500);
      return;
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
        frame: 0,
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
      frame: 0,
      success: null
    });

    // Animate ping - move 40px every 100ms (0.4px/ms)
    const SPEED_PX_PER_MS = 0.5;
    let startTime = Date.now();
    let currentHop = 0;

    const getHopDuration = (hopIndex: number) => {
      const fromDevice = devices.find(d => d.id === path[hopIndex]);
      const toDevice = devices.find(d => d.id === path[hopIndex + 1]);
      if (!fromDevice || !toDevice) return 1000;

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

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return Math.max(distance / SPEED_PX_PER_MS, 1);
    };

    let currentHopDuration = getHopDuration(0);

    const animate = () => {
      // Skip animation during pan/drag
      if (isBusyRef.current) {
        pingAnimationRef.current = requestAnimationFrame(animate);
        return;
      }

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / currentHopDuration, 1);

      setPingAnimation(prev => {
        if (!prev) return null;
        return { ...prev, currentHopIndex: currentHop, progress, frame: prev.frame + 1 };
      });

      if (progress < 1) {
        pingAnimationRef.current = requestAnimationFrame(animate);
      } else {
        // Move to next hop
        currentHop++;
        if (currentHop < path.length - 1) {
          startTime = Date.now();
          currentHopDuration = getHopDuration(currentHop);
          pingAnimationRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete - show success
          setPingAnimation(prev => prev ? { ...prev, success: true } : null);
          setTimeout(() => setPingAnimation(null), 2500);
        }
      }
    };

    pingAnimationRef.current = requestAnimationFrame(animate);
  }, [connections, devices, findPath, getDeviceCenter, getPortPosition]);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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
              {conn.sourcePort} \u2194 {conn.targetPort}
            </text>
            <text
              x={midX + perpX}
              y={midY + perpY - 8}
              fill={color}
              fontSize="10"
              textAnchor="middle"
              className="pointer-events-none select-none"
            >
              {conn.sourcePort} \u2194 {conn.targetPort}
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
              {conn.sourcePort} \u2194 {conn.targetPort}
            </text>
            <text
              x={midX}
              y={midY - 10}
              fill={color}
              fontSize="10"
              textAnchor="middle"
              className="pointer-events-none select-none"
            >
              {conn.sourcePort} \u2194 {conn.targetPort}
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
            {/* Subtle background rectangle with hover pulse */}
            <rect
              x="-10" y="-10"
              width="20" height="20"
              rx="6"
              fill={isDark ? '#1e293b' : '#ffffff'}
              className={`drop-shadow-sm transition-all duration-200 group-hover:scale-110 ${isDark ? 'group-hover:fill-slate-700' : 'group-hover:fill-slate-100'}`}
            />
            <svg
              x={-7}
              y={-7}
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-200 group-hover:stroke-red-600"
            >
              <path d="M3 6h18" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
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
  const renderDevice = (device: CanvasDevice, isDragging: boolean): React.ReactNode => {
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
    const statusFill = isPoweredOff
      ? '#000000'
      : hasError
        ? (isDark ? '#ef4444' : '#dc2626')
        : (hasConnection ? (isDark ? '#22c55e' : '#16a34a') : (isDark ? '#1f2937' : '#cbd5e1'));
    const statusStroke = isPoweredOff ? (isDark ? '#64748b' : '#94a3b8') : 'none';

    // Calculate device height based on number of ports (8 per row for switch/router)
    const portsPerRow = device.type === 'pc' ? 2 : 8;
    const numRows = Math.ceil(device.ports.length / portsPerRow);
    const deviceHeight = device.type === 'pc' ? 89 : 80 + numRows * 14 + 5;

    // Calculate device width to fit all ports with proper spacing
    const deviceWidth = getDeviceWidth(device);

    return (
      <g
        key={device.id}
        transform={`translate(${device.x}, ${device.y})`}
        className={`cursor-move ${isDragging ? 'opacity-80' : ''}`}
        data-device-id={device.id}
        onMouseEnter={(e) => handleDeviceHover(e as unknown as ReactMouseEvent, device.id)}
      >
        {/* Selection Glow */}
        {isSelected && (
          <rect
            width={deviceWidth + 10}
            height={deviceHeight + 10}
            x={-5}
            y={-5}
            rx={14}
            fill={isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(6, 182, 212, 0.25)'}
            className="animate-pulse"
            style={{ filter: 'blur(6px)' }}
          />
        )}

        {/* Device body */}
        <rect
          width={deviceWidth}
          height={deviceHeight}
          rx={8}
          fill={
            device.type === 'pc' ? 'url(#pcGradient)' :
              device.type === 'switch' ? 'url(#switchGradient)' :
                'url(#routerGradient)'
          }
          stroke={isSelected ? '#06b6d4' : isDark ? '#475569' : '#cbd5e1'}
          strokeWidth={isSelected ? 2 : 1}
          className={isDragging ? '' : 'transition-all duration-150 shadow-xl'}
        />
        {/* Selection stroke */}
        {isSelected && (
          <rect
            width={deviceWidth - 2}
            height={deviceHeight - 2}
            x={1}
            y={1}
            rx={7}
            fill="none"
            stroke="#06b6d4"
            strokeWidth={2}
            pointerEvents="none"
          />
        )}
        {/* Glossy overlay for 3D depth */}
        <rect
          width={deviceWidth}
          height={deviceHeight}
          rx={8}
          fill="url(#glossOverlay)"
          pointerEvents="none"
        />

        {/* Device icon */}
        <g transform={`translate(${deviceWidth / 2 - 12}, 10)`}>
          <g
            className="text-white"
            style={{ color: 'white' }}
          >
            {device.type === 'pc' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                stroke="currentColor"
                fill="none"
                d={DEVICE_ICON_PATHS.pc}
                transform="scale(1.2) translate(0, 3.3)"
              />
            )}
            {device.type === 'switch' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                stroke="currentColor"
                fill="none"
                d={DEVICE_ICON_PATHS.switch}
                transform="scale(1.2)"
              />
            )}
            {device.type === 'router' && (
              <g transform="scale(1.2)">
                <circle cx={DEVICE_ICON_PATHS.router.circle.cx} cy={DEVICE_ICON_PATHS.router.circle.cy} r={DEVICE_ICON_PATHS.router.circle.r} strokeWidth={1.5} stroke="currentColor" fill="none" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} stroke="currentColor" fill="none" d={DEVICE_ICON_PATHS.router.paths} />
              </g>
            )}
          </g>
        </g>

        {/* Status LED */}
        <circle
          cx={deviceWidth - 10}
          cy={10}
          r={5}
          fill={statusFill}
          stroke="#000000"
          strokeWidth={1}
          className="transition-colors duration-300"
        />

        {/* Device name */}
        <text x={deviceWidth / 2} y={58} fill="white" fontSize="10" textAnchor="middle" fontWeight="bold" className="select-none pointer-events-none drop-shadow-sm">
          {truncateWithEllipsis(device.name, 8)}
        </text>

        {/* Device IP */}
        {device.type === 'pc' && (
          <text x={deviceWidth / 2} y={70} fill="rgba(255,255,255,0.8)" fontSize="10" textAnchor="middle" fontFamily="monospace" className="select-none pointer-events-none">
            {device.ip}
          </text>
        )}

        {/* Ports - wrapped 6 per row */}
        {device.type === 'pc' ? (
          // PC has Eth0 and COM1 ports, show side by side
          device.ports.map((port, idx) => {
            // İki portu yan yana göster - eşit kenar boşluğu ile
            const portSpacing = 14;
            const startX = (deviceWidth - (device.ports.length - 1) * portSpacing) / 2;
            const portX = startX + idx * portSpacing;
            const portY = 80;
            const isConnected = port.status === 'connected';
            const isShutdown = port.shutdown;
            const forceGrayFrame = !!offlinePortFramesByDevice.get(device.id)?.has(port.id);

            // Determine port label: E for Ethernet, C for COM/Console
            const isConsolePort = port.id.toLowerCase().startsWith('com') || port.id.toLowerCase() === 'console';
            const portLabel = isConsolePort ? 'C' : 'E';

            // Port colors:
            // PC Ethernet: Blue, PC COM (Console): Turquoise
            // Shutdown: Red
            // If the device/peer is powered off, force the port to appear offline (gray),
            // otherwise keep the type/status coloring.
            const portColor = forceGrayFrame
              ? '#6b7280'
              : (isShutdown ? '#ef4444' :
                isConsolePort
                  ? (isConnected ? '#06b6d4' : '#0891b2')  // Turquoise for console
                  : (isConnected ? '#3b82f6' : '#1d4ed8')); // Blue for ethernet

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
                  fill={forceGrayFrame ? "url(#portOfflineGradient)" : isConnected ? "url(#portConnectedGradient)" : isShutdown ? "url(#portShutdownGradient)" : "url(#portOfflineGradient)"}
                  stroke={forceGrayFrame ? '#4b5563' : (isShutdown ? '#991b1b' : isConnected ? '#4ade80' : '#1e293b')}
                  strokeWidth={isShutdown || isConnected ? 2 : 1}
                />
                <text y={1} fill="#fff" fontSize="6" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" className="select-none pointer-events-none">
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
            // Port spacing - eşit kenar boşluğu için
            const portSpacing = 14;
            const rowSpacing = 14;
            // Eşit kenar boşluğu ile başlangıç pozisyonu
            const startX = (deviceWidth - (portsPerRow - 1) * portSpacing) / 2;
            const startY = 80;
            const portX = startX + col * portSpacing;
            const portY = startY + row * rowSpacing;
            const isConnected = port.status === 'connected';
            const isShutdown = port.shutdown;
            const forceGrayFrame = !!offlinePortFramesByDevice.get(device.id)?.has(port.id);

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

            // If the device/peer is powered off, force the port to appear offline (gray).
            if (forceGrayFrame) {
              portFill = '#6b7280';
              portStroke = '#4b5563';
            } else if (isDownOrBlocked) {
              portFill = isShutdown ? '#ef4444' : '#fb923c'; // Red for shutdown, lighter orange for blocked
              portStroke = '#ff0000'; // Explicit RED border
            } else if (isConsole) {
              portFill = isConnected ? '#22d3ee' : '#0ea5e9'; // Vibrant Turquoise
              portStroke = isConnected ? '#4ade80' : '#0ea5e9';
            } else if (isGigabit) {
              portFill = isConnected ? '#fb923c' : '#f97316'; // Vibrant Orange
              portStroke = isConnected ? '#4ade80' : '#f97316';
            } else if (isFastEthernet) {
              portFill = isConnected ? '#60a5fa' : '#3b82f6'; // Vibrant Blue
              portStroke = isConnected ? '#4ade80' : '#3b82f6';
            } else {
              portFill = isConnected ? '#4ade80' : '#94a3b8'; // Default green/gray
              portStroke = isConnected ? '#4ade80' : '#4b5563';
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
                  fill={
                    forceGrayFrame ? "url(#portOfflineGradient)" :
                      isShutdown ? "url(#portShutdownGradient)" :
                        isBlocked ? "url(#portBlockedGradient)" :
                          isConnected ? "url(#portConnectedGradient)" :
                            isConsole ? "url(#portConsoleGradient)" :
                              isGigabit ? "url(#portGigabitGradient)" :
                                isFastEthernet ? "url(#portFastEthernetGradient)" :
                                  "url(#portOfflineGradient)"
                  }
                  stroke={forceGrayFrame ? '#6b7280' : (isDownOrBlocked || isConnected ? portStroke : '#4b5563')}
                  strokeWidth={isDownOrBlocked || isConnected ? 2.5 : 1}
                  className={!forceGrayFrame && isDownOrBlocked ? 'animate-pulse' : ''}
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
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800/50">
          <div className={`text-xs font-bold tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'} whitespace-nowrap`}>
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

        <div className="px-4 py-3 flex items-center justify-between">
          <div className={`text-xs font-bold tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'} whitespace-nowrap`}>
            {t.cable}
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
                  ? t.straight.substring(0, 3)
                  : type === 'crossover'
                    ? t.crossover.substring(0, 3)
                    : t.console.substring(0, 3)}
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
          <span className="text-xs text-slate-300">{t.add}</span>
        </button>

        {/* Cable Type */}
        <button
          onClick={() => setIsPaletteOpen(true)}
          className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg min-h-[48px] min-w-[48px] bg-slate-800 hover:bg-slate-700"
        >
          <div className={`w-4 h-4 rounded ${CABLE_COLORS[cableInfo.cableType].bg}`} />
          <span className="text-xs text-slate-300">
            {cableInfo.cableType === 'straight'
              ? t.straight
              : cableInfo.cableType === 'crossover'
                ? t.crossover
                : t.console}
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
            -
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

  useEffect(() => {
    const handleZoomIn = () => setZoom(z => Math.min(MAX_ZOOM, z + 0.25));
    const handleZoomOut = () => setZoom(z => Math.max(MIN_ZOOM, z - 0.25));
    const handleConnect = () => {
      setShowPortSelector(true);
      setPortSelectorStep('source');
      setSelectedSourcePort(null);
    };
    const handleOpenPalette = () => setIsPaletteOpen(true);
    const handleTogglePower = (e: Event) => {
      const ce = e as CustomEvent<{ deviceId?: string; nextStatus?: 'online' | 'offline' }>;
      const id = ce.detail?.deviceId;
      if (!id) return;

      // Apply a "fast refresh" when power is toggled:
      // - Powered-off device ports become disabled
      // - Links touching that device become inactive
      // - Peer ports on the other side become notconnect
      // When powering on, restore links/ports to "connected" (unless peer is offline).
      setDevices((prevDevices) => {
        const nextStatus = ce.detail?.nextStatus || (prevDevices.find(d => d.id === id)?.status === 'offline' ? 'online' : 'offline');
        const byId = new Map(prevDevices.map(d => [d.id, d] as const));
        const nextDevices = prevDevices.map((d) => {
          if (d.id === id) {
            return {
              ...d,
              status: nextStatus,
              ports: d.ports.map((p) => ({ ...p, status: nextStatus === 'offline' ? 'disabled' as const : 'disconnected' as const })),
            };
          }
          return d;
        });

        // Update peer ports based on current connections (we flip connection/port state together below).
        const nextById = new Map(nextDevices.map(d => [d.id, d] as const));
        for (const c of connectionsRef.current) {
          if (c.sourceDeviceId !== id && c.targetDeviceId !== id) continue;
          const peerId = c.sourceDeviceId === id ? c.targetDeviceId : c.sourceDeviceId;
          const peer = nextById.get(peerId);
          if (!peer) continue;
          const peerPortId = c.sourceDeviceId === id ? c.targetPort : c.sourcePort;
          const shouldDisablePeer = nextStatus === 'offline' || peer.status === 'offline';
          const nextPeerPorts = peer.ports.map((p) => (p.id === peerPortId ? { ...p, status: shouldDisablePeer ? 'notconnect' as const : 'connected' as const } : p));
          nextById.set(peerId, { ...peer, ports: nextPeerPorts });
        }

        return nextDevices.map(d => nextById.get(d.id) || d);
      });

      setConnections((prevConnections) => {
        const nextStatus = ce.detail?.nextStatus || (devicesRef.current.find(d => d.id === id)?.status === 'offline' ? 'online' : 'offline');
        const byId = new Map(devicesRef.current.map(d => [d.id, d] as const));
        return prevConnections.map((c) => {
          if (c.sourceDeviceId !== id && c.targetDeviceId !== id) return c;
          if (nextStatus === 'offline') return { ...c, active: false };
          const peerId = c.sourceDeviceId === id ? c.targetDeviceId : c.sourceDeviceId;
          const peer = byId.get(peerId);
          return { ...c, active: peer?.status !== 'offline' };
        });
      });
    };

    window.addEventListener('trigger-topology-zoom-in', handleZoomIn);
    window.addEventListener('trigger-topology-zoom-out', handleZoomOut);
    window.addEventListener('trigger-topology-connect', handleConnect);
    window.addEventListener('trigger-topology-palette', handleOpenPalette);
    window.addEventListener('trigger-topology-toggle-power', handleTogglePower);

    return () => {
      window.removeEventListener('trigger-topology-zoom-in', handleZoomIn);
      window.removeEventListener('trigger-topology-zoom-out', handleZoomOut);
      window.removeEventListener('trigger-topology-connect', handleConnect);
      window.removeEventListener('trigger-topology-palette', handleOpenPalette);
      window.removeEventListener('trigger-topology-toggle-power', handleTogglePower);
    };
  }, [setZoom, setShowPortSelector, setPortSelectorStep, setSelectedSourcePort]);

  // Precompute connection groups to avoid O(n²) filter inside render
  const connectionGroups = useMemo(() => {
    const map = new Map<string, { conns: CanvasConnection[]; indexById: Map<string, number> }>();
    connections.forEach(conn => {
      const keyA = `${conn.sourceDeviceId}||${conn.targetDeviceId}`;
      const keyB = `${conn.targetDeviceId}||${conn.sourceDeviceId}`;
      const canonKey = keyA < keyB ? keyA : keyB;
      if (!map.has(canonKey)) {
        map.set(canonKey, { conns: [], indexById: new Map() });
      }
      const group = map.get(canonKey)!;
      group.indexById.set(conn.id, group.conns.length);
      group.conns.push(conn);
    });
    return map;
  }, [connections]);

  const getConnectionGroup = useCallback((conn: CanvasConnection) => {
    const keyA = `${conn.sourceDeviceId}||${conn.targetDeviceId}`;
    const keyB = `${conn.targetDeviceId}||${conn.sourceDeviceId}`;
    const canonKey = keyA < keyB ? keyA : keyB;
    const group = connectionGroups.get(canonKey);
    if (!group) return { totalSameConns: 1, sameConnIndex: 0 };
    return {
      totalSameConns: group.conns.length,
      sameConnIndex: group.indexById.get(conn.id) ?? 0,
    };
  }, [connectionGroups]);

  // Precompute device lookup map for O(1) access in render
  const deviceById = useMemo(() => new Map(devices.map(d => [d.id, d])), [devices]);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={`${isFullscreen ? 'fixed inset-[20px] z-[9999] rounded-xl shadow-2xl' : 'relative w-full flex-1 rounded-xl border-2 overflow-hidden'} flex flex-col transition-all duration-300 ${isDark
        ? 'bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90 border-slate-600/50'
        : 'bg-gradient-to-br from-blue-50/50 via-white to-slate-50/80 border-slate-300/50'
        }`}
    >
      {/* Header with Tools */}
      <div
        className={`px-4 pt-2 pb-2 border-b shrink-0 hidden sm:block ${isDark ? 'border-slate-700/50 bg-slate-800/80' : 'border-slate-200/50 bg-white/80'} backdrop-blur-md sticky top-0 z-40`}
      >
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-4 shrink-0">
            {/* SM/MD/LG Screen Quick Tools (640px and above) */}
            <div className="flex items-center">
              <div className={`flex items-center gap-2 p-1.5 rounded-lg border ${isDark ? 'bg-slate-900/40 border-slate-700/30' : 'bg-blue-50/50 border-blue-100/50'}`}>
                {/* Devices Group */}
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => addDevice('pc')}
                        className={`group relative p-2 rounded-lg transition-all duration-200 ${isDark
                          ? 'hover:bg-slate-700/80 hover:shadow-lg hover:shadow-blue-500/20 text-blue-400 hover:text-blue-300'
                          : 'hover:bg-slate-100 hover:shadow-lg hover:shadow-blue-500/10 text-blue-600 hover:text-blue-500'}`}
                      >
                        <svg className="w-6 h-6 transform group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z" />
                        </svg>
                        <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>PC</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t.addPcShort}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => addDevice('switch')}
                        className={`group relative p-2 rounded-xl transition-all duration-200 ${isDark
                          ? 'hover:bg-slate-700/80 hover:shadow-lg hover:shadow-emerald-500/20 text-emerald-400 hover:text-emerald-300'
                          : 'hover:bg-slate-100 hover:shadow-lg hover:shadow-emerald-500/10 text-emerald-600 hover:text-emerald-500'}`}
                      >
                        <svg className="w-6 h-6 transform group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 0 1 -2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2M5 12a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 -2-2m-2-4h.01M17 16h.01" />
                        </svg>
                        <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>SW</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t.addSwitchShort}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => addDevice('router')}
                        className={`group relative p-2 rounded-xl transition-all duration-200 ${isDark
                          ? 'hover:bg-slate-700/80 hover:shadow-lg hover:shadow-purple-500/20 text-purple-400 hover:text-purple-300'
                          : 'hover:bg-slate-100 hover:shadow-lg hover:shadow-purple-500/10 text-purple-600 hover:text-purple-500'}`}
                      >
                        <svg className="w-6 h-6 transform group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14M5 12h14M12 5l-2 2m2-2l2 2m-2 12l-2-2m2 2l2-2M5 12l2-2m-2 2l2 2M19 12l-2-2m2 2l-2 2" />
                        </svg>
                        <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>RT</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t.addRouterShort}</TooltipContent>
                  </Tooltip>
                </div>

                {/* Separator */}
                <div className={`w-px h-6 ${isDark ? 'bg-slate-700/50' : 'bg-slate-300'} mx-1`} />

                {/* Cable Types Group */}
                <div className="flex items-center gap-1">
                  {(['straight', 'crossover', 'console'] as CableType[]).map((type) => (
                    <Tooltip key={type}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onCableChange({ ...cableInfo, cableType: type })}
                          className={`group relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 ${cableInfo.cableType === type
                            ? `${CABLE_COLORS[type].bg} text-white hover:scale-105`
                            : isDark ? 'hover:bg-slate-700 text-slate-400 hover:scale-105' : 'hover:bg-slate-100 text-slate-600 hover:scale-105'}`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${cableInfo.cableType === type ? 'bg-white' : CABLE_COLORS[type].bg}`} />
                          <span className="text-[10px] font-bold">
                            {type === 'straight' ? t.straight.substring(0, 3) :
                              type === 'crossover' ? t.crossover.substring(0, 3) :
                                t.console.substring(0, 3)}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{getDualCableLabel(type)}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                {/* Separator */}
                <div className={`w-px h-6 ${isDark ? 'bg-slate-700/50' : 'bg-slate-300'} mx-1`} />

                {/* Notes */}
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={addNote}
                        className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-slate-700 text-amber-300' : 'hover:bg-slate-100 text-amber-500'}`}
                      >
                        <Pencil className="w-4 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t.addNote}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
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
              <span className="hidden sm:inline">{t.connectDevices}</span>
              <span className="sm:hidden">{t.connect}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className={`flex-1 relative flex flex-col`}>
          {/* Palette Sheet (Triggered from Top Toolbar) */}
          <Sheet open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
            <SheetContent side="bottom" className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'} rounded-t-[2rem] p-0 mb-2.5`}>
              <SheetHeader className="p-4 border-b border-slate-800/50">
                <SheetTitle className="text-lg font-bold flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-500/10'}`}>
                    <Plus className="w-6 h-6 text-cyan-500" />
                  </div>
                  {t.addDeviceOrCable}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Add new network devices or cables to the topology
                </SheetDescription>
              </SheetHeader>
              <div className="p-4 space-y-6">
                {/* Devices Section */}
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">{t.devices}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(['pc', 'switch', 'router'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => { addDevice(type); setIsPaletteOpen(false); }}
                        className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200 ${isDark
                          ? 'bg-slate-800 border-slate-700 active:bg-slate-700 active:scale-95 hover:shadow-lg'
                          : 'bg-slate-50 border-slate-200 active:bg-slate-100 active:scale-95 hover:shadow-lg'
                          } ${type === 'pc' ? 'hover:shadow-blue-500/10' : type === 'switch' ? 'hover:shadow-emerald-500/10' : 'hover:shadow-purple-500/10'}`}
                      >
                        <div className={`transform transition-transform duration-200 group-hover:scale-110 ${type === 'pc' ? 'text-blue-500 group-hover:text-blue-400' : type === 'switch' ? 'text-emerald-500 group-hover:text-emerald-400' : 'text-purple-500 group-hover:text-purple-400'}`}>
                          <DeviceIcon type={type} className="w-7 h-7" />
                        </div>
                        <span className={`text-xs font-bold capitalize ${type === 'pc' ? 'text-blue-500' : type === 'switch' ? 'text-emerald-500' : 'text-purple-500'}`}>{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cables Section */}
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">{t.cableTypes}</p>
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
                        <span className="text-[10px] font-bold text-center leading-tight">
                          {getDualCableLabel(type)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">
                    {t.annotations}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => { addNote(); setIsPaletteOpen(false); }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${isDark ? 'bg-slate-800 border-slate-700 active:bg-slate-700' : 'bg-slate-50 border-slate-200 active:bg-slate-100'
                        }`}
                    >
                      <Pencil className="w-6 h-6 text-amber-400" />
                      <span className="text-xs font-bold">{t.note}</span>
                    </button>
                  </div>
                </div>
                <div className="h-4" />
              </div>
            </SheetContent>
          </Sheet>
          {/* Multiple Selection Indicator & Tools */}
          {(selectedDeviceIds.length + selectedNoteIds.length) > 1 && (
            <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-4 ${isDark ? 'bg-slate-800/95 text-white border border-slate-700' : 'bg-white text-slate-900 border border-slate-200'
              } backdrop-blur-md`}>
              {(selectedDeviceIds.length + selectedNoteIds.length) > 1 && (
                <div className="flex items-center gap-2 border-r pr-4 border-slate-700/30">
                  <span className="text-xs font-bold tracking-wider opacity-60">
                    {t.align}
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
              )}

              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold whitespace-nowrap">
                  {language === 'tr'
                    ? `${selectedDeviceIds.length > 0 ? `${selectedDeviceIds.length} Cihaz` : ''}${selectedDeviceIds.length > 0 && selectedNoteIds.length > 0 ? ' + ' : ''}${selectedNoteIds.length > 0 ? `${selectedNoteIds.length} Not` : ''}`
                    : `${selectedDeviceIds.length > 0 ? `${selectedDeviceIds.length} Device${selectedDeviceIds.length > 1 ? 's' : ''}` : ''}${selectedDeviceIds.length > 0 && selectedNoteIds.length > 0 ? ' + ' : ''}${selectedNoteIds.length > 0 ? `${selectedNoteIds.length} Note${selectedNoteIds.length > 1 ? 's' : ''}` : ''}`
                  }
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setSelectedDeviceIds([]); setSelectedNoteIds([]); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                  >
                    {language === 'tr' ? 'İptal' : 'Cancel'}
                  </button>
                  <button
                    onClick={() => {
                      deleteSelection(selectedDeviceIds, selectedNoteIds);
                      setSelectedDeviceIds([]);
                      setSelectedNoteIds([]);
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
            ref={canvasRef as React.RefObject<HTMLDivElement>}
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
                ref={svgGroupRef as React.RefObject<SVGGElement>}
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

                  {/* Device Gradients - 3D Effect */}
                  <linearGradient id="pcGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={isDark ? '#3b82f6' : '#60a5fa'} />
                    <stop offset="100%" stopColor={isDark ? '#1d4ed8' : '#2563eb'} />
                  </linearGradient>

                  <linearGradient id="switchGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={isDark ? '#10b981' : '#34d399'} />
                    <stop offset="100%" stopColor={isDark ? '#047857' : '#059669'} />
                  </linearGradient>

                  <linearGradient id="routerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={isDark ? '#8b5cf6' : '#a78bfa'} />
                    <stop offset="100%" stopColor={isDark ? '#6d28d9' : '#7c3aed'} />
                  </linearGradient>

                  {/* Glossy overlay effect for 3D look */}
                  <linearGradient id="glossOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.15" />
                    <stop offset="50%" stopColor="white" stopOpacity="0" />
                    <stop offset="100%" stopColor="black" stopOpacity="0.1" />
                  </linearGradient>

                  {/* Subtle Background Gradient */}
                  <radialGradient id="bgGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stopColor={isDark ? '#1e293b' : '#ffffff'} />
                    <stop offset="100%" stopColor={isDark ? '#0f172a' : '#f1f5f9'} />
                  </radialGradient>

                  {/* Port Color Radial Gradients */}
                  {/* Console (Turquoise) */}
                  <radialGradient id="portConsoleGradient" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                  </radialGradient>

                  {/* Gigabit (Orange) */}
                  <radialGradient id="portGigabitGradient" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#fb923c" />
                    <stop offset="100%" stopColor="#f97316" />
                  </radialGradient>

                  {/* FastEthernet (Blue) */}
                  <radialGradient id="portFastEthernetGradient" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </radialGradient>

                  {/* Default/Connected (Green) */}
                  <radialGradient id="portConnectedGradient" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#4ade80" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </radialGradient>

                  {/* Shutdown (Red) */}
                  <radialGradient id="portShutdownGradient" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#f87171" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </radialGradient>

                  {/* Blocked (Amber) */}
                  <radialGradient id="portBlockedGradient" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#d97706" />
                  </radialGradient>

                  {/* Offline/Disabled (Gray) */}
                  <radialGradient id="portOfflineGradient" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#94a3b8" />
                    <stop offset="100%" stopColor="#64748b" />
                  </radialGradient>
                </defs>

                {/* Canvas Background with Grid - clipped to boundaries */}
                <g clipPath="url(#canvasClip)">
                  {/* Background */}
                  <rect
                    x="0"
                    y="0"
                    width={getCanvasDimensions().width}
                    height={getCanvasDimensions().height}
                    fill="url(#bgGradient)"
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
                    const sourceDevice = deviceById.get(conn.sourceDeviceId);
                    const targetDevice = deviceById.get(conn.targetDeviceId);
                    if (!sourceDevice || !targetDevice) return null;

                    const { totalSameConns, sameConnIndex } = getConnectionGroup(conn);

                    return (
                      <g key={`line-${conn.id}`}>
                        <ConnectionLine
                          connection={conn}
                          sourceDevice={sourceDevice}
                          targetDevice={targetDevice}
                          isDark={isDark}
                          isDragging={isActuallyDragging || isTouchDragging}
                          totalSameConns={totalSameConns}
                          sameConnIndex={sameConnIndex}
                          getPortPosition={getPortPosition}
                          CABLE_COLORS={CABLE_COLORS as any}
                          isHovered={hoveredConnectionId === conn.id}
                          onMouseEnter={() => setHoveredConnectionId(conn.id)}
                          onMouseLeave={() => setHoveredConnectionId(null)}
                        />
                        {renderConnectionHandle(conn)}
                      </g>
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
                        onMouseEnter={(e, id) => handleDeviceHover(e as unknown as ReactMouseEvent, id)}
                        onMouseLeave={handleDeviceMouseLeave}
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
                        className={`pointer-events-auto relative flex flex-col w-full h-full rounded-br-3xl shadow-xl text-white transition-all duration-300 ${selectedNoteIds.includes(note.id)
                          ? 'ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)] animate-pulse scale-[1.01]'
                          : 'hover:shadow-2xl hover:scale-[1.005]'
                          }`}
                        data-note-id={note.id}
                        style={{
                          backgroundColor: note.color,
                          fontFamily: note.font,
                          opacity: note.opacity,
                          backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.05) 100%)',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                          borderTop: '2px solid rgba(255, 255, 255, 0.4)',
                          borderLeft: '2px solid rgba(255, 255, 255, 0.4)',
                          borderRight: '2px solid rgba(0, 0, 0, 0.3)',
                          borderBottom: '2px solid rgba(0, 0, 0, 0.3)'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (wasDraggingRef.current) return;

                          const isHeaderClick = (e.target as HTMLElement).closest('[data-note-drag-handle]');

                          if (e.shiftKey) {
                            if (isHeaderClick) return; // Prevent double toggle since handleNoteMouseDown already handled it
                            setSelectedNoteIds(prev => prev.includes(note.id) ? prev.filter(id => id !== note.id) : [...prev, note.id]);
                          } else {
                            if (!isHeaderClick && !selectedNoteIds.includes(note.id)) {
                              setSelectedNoteIds([note.id]);
                              setSelectedDeviceIds([]);
                            }
                          }
                        }}
                        onTouchStart={(e) => handleNoteTouchStart(e as unknown as ReactTouchEvent, note.id)}
                        onContextMenu={(e) => handleNoteContextMenu(e as unknown as ReactMouseEvent, note.id, 'note-edit')}
                      >
                        <div
                          data-note-drag-handle
                          onMouseDown={(e) => handleNoteMouseDown(e as unknown as ReactMouseEvent, note.id)}
                          onContextMenu={(e) => handleNoteContextMenu(e as unknown as ReactMouseEvent, note.id, 'note-style')}
                          className={`flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-widest cursor-move select-none ${isDark ? 'bg-black/10' : 'bg-black/5'
                            }`}
                          style={{ height: NOTE_HEADER_HEIGHT }}
                        >
                          <span />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNote(note.id);
                            }}
                            className="px-1.5 py-0.5 rounded hover:bg-black/10 text-white/70 hover:text-white"
                            title={t.delete}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div
                          className="relative flex-1 w-full h-full overflow-hidden"
                          onWheel={(e) => e.stopPropagation()}
                          style={{
                            minWidth: '100px',
                            minHeight: '50px',
                            paddingRight: '2px'
                          }}
                        >
                          <textarea
                            ref={(el) => { noteTextareaRefs.current[note.id] = el; }}
                            data-note-textarea
                            value={note.text}
                            onChange={(e) => updateNoteText(note.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.ctrlKey) {
                                const textarea = e.target as HTMLTextAreaElement;
                                const selectionStart = textarea.selectionStart;
                                const selectionEnd = textarea.selectionEnd;
                                const hasSelection = selectionStart !== selectionEnd;

                                const key = e.key.toLowerCase();
                                if (key === 'b') {
                                  e.preventDefault();
                                  if (hasSelection) {
                                    updateNoteStyle(note.id, { bold: !note.bold });
                                  }
                                } else if (key === 'i') {
                                  e.preventDefault();
                                  if (hasSelection) {
                                    updateNoteStyle(note.id, { italic: !note.italic });
                                  }
                                } else if (key === 'u') {
                                  e.preventDefault();
                                  if (hasSelection) {
                                    updateNoteStyle(note.id, { underline: !note.underline });
                                  }
                                }
                              }
                            }}
                            onBlur={() => {
                              if (onTopologyChange) {
                                onTopologyChange(devices, connections, notes);
                              }
                            }}
                            className="w-full h-full px-2 py-1 bg-transparent outline-none resize-none text-white placeholder:text-white/50"
                            style={{
                              fontSize: note.fontSize,
                              fontWeight: note.bold ? 'bold' : 'normal',
                              fontStyle: note.italic ? 'italic' : 'normal',
                              textDecoration: note.underline ? 'underline' : 'none',
                              textShadow: '1px 1px 2px rgba(0,0,0,1)'
                            }}
                          />
                        </div>
                        {!isMobile && (
                          <div
                            className="absolute right-1 bottom-1 w-4 h-4 cursor-se-resize"
                            onMouseDown={(e) => handleNoteResizeStart(e as unknown as ReactMouseEvent, note.id)}
                            title={t.resize}
                          >
                            <svg viewBox="0 0 12 12" className="w-full h-full text-black/50">
                              <path d="M4 12 L12 4" stroke="currentColor" strokeWidth="1" />
                              <path d="M7 12 L12 7" stroke="currentColor" strokeWidth="1" />
                              <path d="M10 12 L12 10" stroke="currentColor" strokeWidth="1" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </foreignObject>
                  ))}

                  {/* Connection interaction handles are now rendered with their cables */}

                  {/* Ping Animation Envelope - Skip during pan/drag */}
                  {!isBusyRef.current && pingAnimation && (() => {
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
                  {getCanvasDimensions().width} X {getCanvasDimensions().height}
                </text>
              </g>
            </svg>
          </div>

          {/* Zoom Controls - Top Right */}
          <div
            className={`flex absolute top-2 right-2 items-center gap-1 px-2 py-1 rounded-lg ${isDark ? 'bg-slate-800/90' : 'bg-white/90'
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
              -
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
                  onClick={handleResetView}
                  className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${isDark
                    ? 'hover:bg-slate-700 text-slate-300'
                    : 'hover:bg-slate-100 text-slate-600'
                    }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">{language === 'tr' ? 'Sıfırla' : 'Reset'}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{language === 'tr' ? 'Sıfırla (Alt+R)' : 'Reset (Alt+R)'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleFullscreen}
                  className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${isDark
                    ? 'hover:bg-slate-700 text-slate-300'
                    : 'hover:bg-slate-100 text-slate-600'
                    }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <span className="hidden sm:inline">{isFullscreen ? (language === 'tr' ? 'Çıkış' : 'Exit') : (language === 'tr' ? 'Tam Ekran' : 'Full Screen')}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Ctrl+F</TooltipContent>
            </Tooltip>          </div>

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
      {contextMenu && (
        <div className="z-[9999] absolute" style={{ left: 0, top: 0 }}>
          <NetworkTopologyContextMenu
            contextMenu={contextMenu}
            contextMenuRef={contextMenuRef}
            isDark={isDark}
            language={language}
            noteFonts={noteFonts}
            notes={notes}
            devices={devices}
            note={notes.find(n => n.id === contextMenu?.noteId)}
            selectedDeviceIds={selectedDeviceIds}
            clipboardLength={clipboard.length}
            noteClipboardLength={noteClipboard.length}
            canUndo={canUndo ?? false}
            canRedo={canRedo ?? false}
            onClose={() => setContextMenu(null)}
            onUpdateNoteStyle={updateNoteStyle}
            onNoteCut={handleNoteTextCut}
            onNoteCopy={handleNoteTextCopy}
            onNotePaste={handleNoteTextPaste}
            onNoteDeleteText={handleNoteTextDelete}
            onNoteSelectAllText={handleNoteTextSelectAll}
            onDuplicateNote={duplicateNote}
            onPasteNotes={pasteNotes}
            onUndo={onUndo || (() => { })}
            onRedo={onRedo || (() => { })}
            onSelectAll={selectAllDevices}
            onOpenDevice={(device) => handleDeviceDoubleClick(device)}
            onCutDevices={cutDevice}
            onCopyDevices={copyDevice}
            onPasteDevice={pasteDevice || undefined}
            onDeleteDevices={(ids) => ids.forEach((id) => deleteDevice(id))}
            onStartConfig={startDeviceConfig}
            onStartPing={(id) => setPingSource(id)}
            onSaveToHistory={onUndo ? (() => { }) : (() => { })}
            onClearDeviceSelection={() => setSelectedDeviceIds([])}
          />
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
              <div className="flex items-center justify-between gap-4">
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          {language === 'tr' ? 'Güç:' : 'Power:'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleDevicePower}
                          className={`h-10 w-10 rounded-2xl transition-all ${devices.find(d => d.id === configuringDevice)?.status === 'offline'
                            ? 'text-rose-500 hover:bg-rose-500/10'
                            : 'text-emerald-500 hover:bg-emerald-500/10'}`}
                          aria-label={language === 'tr' ? 'Güç' : 'Power'}
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 1 1-12.728 0" />
                          </svg>
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} ${isDark ? 'text-white' : 'text-slate-900'} p-2 text-xs`}>
                      {devices.find(d => d.id === configuringDevice)?.status === 'offline'
                        ? (language === 'tr' ? 'Kapalı' : 'Off')
                        : (language === 'tr' ? 'Açık' : 'On')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                    placeholder={t.hostname}
                  />
                </div>
              </div>

              {/* Device Info (MAC Address) */}
              <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-800/50' : 'bg-slate-50 border-slate-200/50'}`}>
                <div className={`text-xs font-black tracking-widest mb-2 opacity-70 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                  {t.deviceInfo}
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.macAddress}</span>
                  <span className={`text-xs font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {devices.find(d => d.id === configuringDevice)?.macAddress || 'N/A'}
                  </span>
                </div>
              </div>

              {/* IP Configuration Section - Only for PCs */}
              {devices.find(d => d.id === configuringDevice)?.type === 'pc' && (
                <div className={`${isMobile ? 'p-3' : 'p-4'} rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-800/50' : 'bg-slate-50 border-slate-200/50'}`}>
                  <div className={`text-xs font-black tracking-widest ${isMobile ? 'mb-3' : 'mb-4'} opacity-70 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                    {language === 'tr' ? 'IP Yapılandırması' : 'IP Configuration'}
                  </div>

                  <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                    <div className="space-y-1">
                      <label className={`text-xs font-bold tracking-widest ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t.ipAddress}
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
                      <label className={`text-xs font-bold tracking-widest ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t.subnetMask}
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
                      <label className={`text-xs font-bold tracking-widest ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t.gateway}
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
                      <label className={`text-xs font-bold tracking-widest ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t.dnsServer}
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
      {!isBusyRef.current && pingAnimation && pingAnimation.success !== null && (
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
                    ? `${devices.find(d => d.id === pingAnimation.sourceId)?.name} - ${devices.find(d => d.id === pingAnimation.targetId)?.name} Başarılı!`
                    : `${devices.find(d => d.id === pingAnimation.sourceId)?.name} - ${devices.find(d => d.id === pingAnimation.targetId)?.name} Successful!`}
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

      {/* Device Info Tooltip */}
      {deviceTooltip && deviceTooltip.visible && (() => {
        const device = devices.find(d => d.id === deviceTooltip.deviceId);
        if (!device) return null;
        return (
          <div
            className="fixed z-[9999] pointer-events-none px-3 py-2 rounded-lg shadow-xl border text-[11px] backdrop-blur-md transition-all duration-300"
            style={{
              left: `${deviceTooltip.x + 15}px`,
              top: `${deviceTooltip.y + 15}px`,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
              color: isDark ? '#f1f5f9' : '#1e293b'
            }}
          >
            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <div className="flex items-center justify-between border-b border-slate-700/20 pb-1 mb-1">
                <span className="font-black uppercase tracking-widest text-cyan-500">
                  {device.type.toUpperCase()}
                </span>
                <span className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
              </div>
              <div className="flex justify-between gap-4">
                <span className="opacity-60 font-medium">Hostname:</span>
                <span className="font-bold">{device.name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="opacity-60 font-medium">IP:</span>
                <span className="font-mono font-bold text-blue-400">{device.ip || 'Unset'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="opacity-60 font-medium">MAC:</span>
                <span className="font-mono opacity-80">{device.macAddress}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-slate-700/10 pt-1 mt-0.5">
                <span className="opacity-60 font-medium italic">VLAN:</span>
                <span className="font-black text-amber-500">{device.vlan || 1}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Port Info Tooltip */}
      {portTooltip && portTooltip.visible && (() => {
        const device = devices.find(d => d.id === portTooltip.deviceId);
        const port = device?.ports.find(p => p.id === portTooltip.portId);
        if (!device || !port) return null;

        // Get additional info from simulator state if available
        const deviceState = deviceStates?.get(device.id);
        const simulatorPort = deviceState?.ports[port.id];
        const portIp = simulatorPort?.ipAddress;
        const portVlan = simulatorPort?.vlan;

        return (
          <div
            className="fixed z-[9999] pointer-events-none px-3 py-2 rounded-lg shadow-xl border text-[11px] backdrop-blur-md"
            style={{
              left: `${portTooltip.x + 15}px`,
              top: `${portTooltip.y + 15}px`,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
              color: isDark ? '#f1f5f9' : '#1e293b'
            }}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold">{port.label}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${port.status === 'connected' ? 'bg-emerald-500/20 text-emerald-500' :
                  port.status === 'blocked' ? 'bg-amber-500/20 text-amber-500' :
                    port.status === 'disabled' ? 'bg-red-500/20 text-red-500' :
                      'bg-slate-500/20 text-slate-500'
                  }`}>
                  {port.status}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="text-[10px] opacity-60">
                  {port.id}
                </div>
                {portIp && (
                  <div className="flex justify-between gap-2 border-t border-slate-700/10 pt-0.5 mt-0.5">
                    <span className="opacity-60">IP:</span>
                    <span className="font-mono font-bold text-blue-400">{portIp}</span>
                  </div>
                )}
                {portVlan !== undefined && (
                  <div className={`flex justify-between gap-2 ${!portIp ? 'border-t border-slate-700/10 pt-0.5 mt-0.5' : ''}`}>
                    <span className="opacity-60">VLAN:</span>
                    <span className="font-bold text-amber-500">{portVlan}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Mobile Bottom Sheet */}
      {renderMobilePalette()}

      <NetworkTopologyPortSelectorModal
        isOpen={showPortSelector}
        isDark={isDark}
        devices={devices}
        cableType={cableInfo.cableType}
        portSelectorStep={portSelectorStep}
        selectedSourcePort={selectedSourcePort}
        onClose={closePortSelector}
        onCableTypeChange={(type) => onCableChange({ ...cableInfo, cableType: type })}
        onSelectPort={handlePortSelectorSelectPort}
      />
    </div>
  );
}
