'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import React from 'react';
import { flushSync } from 'react-dom';
import { useAppStore, useTopologyDevices, useTopologyConnections, useTopologyNotes, useGraphicsQuality, useIsSimulationMode, useEnvironment, useNetworkEventLogs } from '@/lib/store/appStore';
import { checkDeviceConnectivity, getPingDiagnostics, getWirelessDistance } from '@/lib/network/connectivity';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/use-breakpoint';
import { useNetworkRefreshWithPositions } from '@/hooks/useNetworkRefreshWithPositions';
import { toast } from "@/hooks/use-toast";
import { CanvasDevice, CanvasConnection, CanvasNote, DeviceType, ContextMenuState, NetworkTopologyProps } from './networkTopology.types';
import type { CableType } from '@/lib/network/types';
import { useCanvasHistory } from '@/hooks/useCanvasHistory';
import LazyNetworkTopologyContextMenu from './LazyNetworkTopologyContextMenu';

import {
  getDeviceWidth,
  getDeviceHeight,
  isSwitchDeviceType,
  easeInOutCubic,
  getPortPosition,
} from './networkTopology.helpers';
import { CABLE_COLORS, DRAG_THRESHOLD, LONG_PRESS_DURATION, VIRTUAL_CANVAS_WIDTH_MOBILE, VIRTUAL_CANVAS_HEIGHT_MOBILE, VIRTUAL_CANVAS_WIDTH_DESKTOP, VIRTUAL_CANVAS_HEIGHT_DESKTOP, MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM, NOTE_FONTS_DESKTOP as NOTE_FONTS } from './networkTopology.constants';

import { useCanvasActions } from '../../hooks/useCanvasActions';
import { exportTopologyToPNG } from '../../utils/exportPNG';

import { useCanvasZoomPan } from './hooks/useCanvasZoomPan';
import { useTopologyTouch } from './hooks/useTopologyTouch';
import { useTopologyMouse } from './hooks/useTopologyMouse';
import { useCanvasKeyboard } from './hooks/useCanvasKeyboard';
import { useCanvasClipboard } from './hooks/useCanvasClipboard';
import { useDeviceDrag } from './hooks/useDeviceDrag';
import { useCanvasSelection } from './hooks/useCanvasSelection';
import { useNoteEditing } from './hooks/useNoteEditing';
import { useIotSensorDetection } from './hooks/useIotSensorDetection';
import { usePeriodicNetworkPackets } from './hooks/usePeriodicNetworkPackets';
import { useTopologySync } from './hooks/useTopologySync';
import { useConnectionDrawing } from './hooks/useConnectionDrawing';
import { useTopologyDeviceActions } from './hooks/useTopologyDeviceActions';
import { usePingAnimation } from './hooks/usePingAnimation';
import { useTopologyPingUI } from './hooks/useTopologyPingUI';
import { usePingSequence, type PingAnimationState } from './hooks/usePingSequence';
import { useTopologyIot } from './hooks/useTopologyIot';
import { useTopologyTooltipHandlers } from './hooks/useTopologyTooltipHandlers';
import { useTopologyNoteActions } from './hooks/useTopologyNoteActions';
import { useTopologyPortConnection } from './hooks/useTopologyPortConnection';
import { useTopologyEventListeners } from './hooks/useTopologyEventListeners';
import { useTopologyContextMenu } from './hooks/useTopologyContextMenu';
import { useDeviceNavigation } from './hooks/useDeviceNavigation';
import { useTopologyDerivedState } from './hooks/useTopologyDerivedState';
import { useTopologyWindowEvents } from './hooks/useTopologyWindowEvents';
import { useTopologyPingState } from './hooks/useTopologyPingState';
import { useVisualConnectionActions } from './hooks/useVisualConnectionActions';

import { CanvasToolbar } from './topology/CanvasToolbar';
import { TopologyDeviceRenderer } from './topology/TopologyDeviceRenderer';
import { NetworkEventLogPanel } from './topology/NetworkEventLogPanel';
import { TopologyModals } from './topology/TopologyModals';
import { DEVICE_ICONS } from './topology/DeviceIcons';
import { TopologySelectionToolbar } from './topology/TopologySelectionToolbar';
import { TopologyCanvasLayer } from './topology/TopologyCanvasLayer';
import { TopologyFullscreenButton } from './topology/TopologyFullscreenButton';
import { TopologyPaletteSheet } from './topology/TopologyPaletteSheet';
import { TopologyTooltips } from './topology/TopologyTooltips';
import { MinimapNavigator } from './topology/MinimapNavigator';
import { PingCursorOverlay } from './topology/PingCursorOverlay';

export function NetworkTopology({
  cableInfo,
  onCableChange,
  onDeviceSelect,
  onDeviceDoubleClick,
  onTopologyChange,
  onDeviceDelete,
  isActive = true,
  activeDeviceId,
  deviceStates,
  onDeviceStatesChange,
  onRefreshNetwork,
  focusDeviceId,
  zoom: zoomProp,
  onZoomChange,
  pan: panProp,
  onPanChange,
  isFullscreen = false,
  onFullscreenChange,
  onOpenTasks,
  clearSelectionTrigger,
  onPacketPanelFocus,
  packetPanelZIndex,
  isExamActive = false,
  isExamEditorOpen = false,
  onPingPanelOpenChange,
}: NetworkTopologyProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isTR = language === 'tr';

  const [isExporting, setIsExporting] = useState(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState(false);

  // Zustand store state
  const topologyDevices = useTopologyDevices();
  const topologyConnections = useTopologyConnections();
  const topologyNotes = useTopologyNotes();
  const setDevices = useAppStore((state) => state.setDevices);
  const setConnections = useAppStore((state) => state.setConnections);
  const setNotes = useAppStore((state) => state.setNotes);
  const graphicsQuality = useGraphicsQuality();
  const isSimulationMode = useIsSimulationMode();
  const activeCaptureConnectionId = useAppStore((state) => state.topology.activeCaptureConnectionId);
  const setActiveCaptureConnection = useAppStore((state) => state.setActiveCaptureConnection);
  const capturedPacketsMap = useAppStore((state) => state.topology.capturedPackets);
  const clearCapturedPackets = useAppStore((state) => state.clearCapturedPackets);
  const clearAllCapturedPackets = useAppStore((state) => state.clearAllCapturedPackets);
  const networkEventLogs = useNetworkEventLogs();
  const [showLogPanel, setShowLogPanel] = useState(false);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(zoomProp ?? DEFAULT_ZOOM);
  const [pan, setPan] = useState(panProp ?? { x: 0, y: 0 });
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // Custom hook for derived topology states, lookup maps, and spatial culling
  const {
    deviceMap,
    visualConnections,
    deviceToConnectionsMap,
    connectionMeta,
    visibleConnections,
    visibleNotes,
    devicesSortedForRender,
  } = useTopologyDerivedState({
    topologyDevices,
    topologyConnections,
    topologyNotes,
    deviceStates,
    isActive,
    isExporting,
    graphicsQuality,
    pan,
    zoom,
    canvasDimensions,
    activeDeviceId,
  });

  const devices = topologyDevices;
  const connections = visualConnections;
  const notes = topologyNotes;

  // Sync state functions for local component logic
  const setDevicesState = setDevices;
  const setConnectionsState = setConnections;
  const setNotesState = setNotes;

  // Track deviceStates dependency
  useEffect(() => {}, [deviceStates]);

  // Use hook to preserve window positions during network refresh
  useNetworkRefreshWithPositions(onRefreshNetwork || (() => {}));

  // Environment settings
  const environment = useEnvironment();

  // Force continuous updates for IoT measurements
  const [iotUpdateTrigger, setIotUpdateTrigger] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setIotUpdateTrigger((prev) => prev + 1);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const mousePosRef = useRef({ x: 0, y: 0 });

  useIotSensorDetection({
    setDevices,
    mousePosRef,
  });

  usePeriodicNetworkPackets({
    devices,
    connections,
    deviceStates,
    onDeviceStatesChange,
  });

  // Update canvas dimensions on resize and mount
  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const updateDimensions = () => {
      if (canvasRef.current) {
        const { width, height } = canvasRef.current.getBoundingClientRect();
        setCanvasDimensions({ width, height });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(activeDeviceId ? [activeDeviceId] : []);

  const selectedDeviceSet = useMemo(() => new Set(selectedDeviceIds), [selectedDeviceIds]);

  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [snapToGrid] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);

  const updateCanvasRect = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRectRef.current = canvasRef.current.getBoundingClientRect();
  }, []);

  // Ping Mode State Hook
  const {
    pingMode,
    setPingMode,
    pingModeRef,
    pingSource,
    setPingSource,
    pingSourceRef,
    setPingResult,
    pingCursorPos,
    setPingCursorPos,
    pingAnimation,
    setPingAnimation,
    errorToast,
    setErrorToast,
    hopPacketInfos,
    setHopPacketInfos,
    packetPopupHop,
    setPacketPopupHop,
    pingAnimationRef,
    pingCleanupTimeoutRef,
    pingIsPausedRef,
    pingResumeCallbackRef,
    pingSkipCallbackRef,
    pingStepModeRef,
    pingPathRef,
    cancelPingDueToInterruptionRef,
    isPingPanelVisible,
    handlePingClose,
  } = useTopologyPingState({ onPingPanelOpenChange });

  const startPingAnimationRef = useRef<((sourceId: string, targetId: string) => void) | null>(null);

  useEffect(() => {
    updateCanvasRect();
    const handleUpdate = () => updateCanvasRect();
    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('scroll', handleUpdate, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, { capture: true } as EventListenerOptions);
    };
  }, [updateCanvasRect]);

  // Sync internal selection with prop from parent
  useEffect(() => {
    if (activeDeviceId) {
      queueMicrotask(() => {
        setSelectedDeviceIds((prev) => {
          if (prev.includes(activeDeviceId)) return prev;
          return [activeDeviceId];
        });
      });
    }
  }, [activeDeviceId]);

  // Handle external focus device request (selection only)
  useEffect(() => {
    if (focusDeviceId && deviceMap.get(focusDeviceId)) {
      queueMicrotask(() => {
        setSelectedDeviceIds([focusDeviceId]);
      });
    }
  }, [focusDeviceId, deviceMap]);

  const [_selectAllMode, setSelectAllMode] = useState(false);

  useEffect(() => {
    selectedDeviceIdsRef.current = [...selectedDeviceIds];
  }, [selectedDeviceIds]);

  // Handle external clear selection trigger
  useEffect(() => {
    if (clearSelectionTrigger !== undefined) {
      queueMicrotask(() => {
        setSelectedDeviceIds([]);
        selectedDeviceIdsRef.current = [];
        setSelectAllMode(false);
      });
    }
  }, [clearSelectionTrigger]);

  // Selection box state
  const [selectionBox, setSelectionBox] = useState<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const selectionBoxRef = useRef<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const selectionAdditiveRef = useRef(false);
  const selectionBaseIdsRef = useRef<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const isSelectingRef = useRef(false);

  const dragAnimationFrameRef = useRef<number | null>(null);
  const selectionAnimationFrameRef = useRef<number | null>(null);
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const wasDraggingRef = useRef(false);
  const liveDeviceDragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const lastDragEventRef = useRef<{ clientX: number; clientY: number; ctrlKey: boolean } | null>(null);

  const getPortPositionRef = useRef<(device: CanvasDevice, portId: string) => { x: number; y: number }>((_d, _p) => ({ x: 0, y: 0 }));

  const connectionMetaRef = useRef<Map<string, { index: number; total: number }>>(new Map());
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

  const svgContentGroupRef = useRef<SVGGElement | null>(null);
  const pendingPanRef = useRef<{ x: number; y: number } | null>(null);
  const pendingZoomRef = useRef<number | null>(null);
  const wheelSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTouchDraggingRef = useRef(false);
  const touchDraggedDeviceRef = useRef<CanvasDevice | null>(null);
  const activePointerDragRef = useRef(false);
  const activeDragPointerIdRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef(0);
  const lastTappedDeviceRef = useRef<string | null>(null);

  const mousePosAnimationFrameRef = useRef<number | null>(null);

  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{
    deviceId: string;
    portId: string;
    point: { x: number; y: number };
  } | null>(null);
  const connectionStartRef = useRef<{
    deviceId: string;
    portId: string;
    point: { x: number; y: number };
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const [notesClipboard] = useState<CanvasNote[]>([]);

  const latestDevicesRef = useRef<CanvasDevice[]>([]);
  const latestConnectionsRef = useRef<CanvasConnection[]>([]);
  const latestNotesRef = useRef<CanvasNote[]>([]);

  const draggedNoteIdRef = useRef<string | null>(null);
  const resizingNoteIdRef = useRef<string | null>(null);
  const noteDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const noteResizeStartRef = useRef<{ x: number; y: number; width: number; height: number; noteX: number; noteY: number } | null>(null);
  const noteResizeDirectionRef = useRef<string>('se');

  const {
    saveToHistory,
    handleUndo,
    handleRedo,
    historyIndex,
    historyLength,
  } = useCanvasHistory({
    setDevices: setDevicesState,
    setConnections: setConnectionsState,
    setNotes: setNotesState,
    latestDevicesRef,
    latestConnectionsRef,
    latestNotesRef,
  });

  const syncingZoomFromPropRef = useRef(false);
  const syncingPanFromPropRef = useRef(false);

  const {
    handleZoomWheel,
    handleZoomMouseDown,
    isDraggingZoom,
    resetView,
    zoomToFit,
  } = useCanvasZoomPan({
    zoom,
    setZoom,
    pan,
    setPan,
    zoomProp,
    onZoomChange,
    panProp,
    onPanChange,
    canvasRef,
    svgContentGroupRef,
    devices,
    notes,
    zoomRef,
    panRef,
    pendingPanRef,
    pendingZoomRef,
    wheelSyncTimerRef,
    syncingZoomFromPropRef,
    syncingPanFromPropRef,
  });

  const [configuringDevice, setConfiguringDevice] = useState<string | null>(null);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [mobileConnectionSource, setMobileConnectionSource] = useState<string | null>(null);

  const isMobile = useIsMobile();

  const [showPortSelector, setShowPortSelector] = useState(false);
  const [portSelectorStep, setPortSelectorStep] = useState<'source' | 'target'>('source');
  const [selectedSourcePort, setSelectedSourcePort] = useState<{ deviceId: string; portId: string } | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleRefresh = useCallback(() => {
    setPacketPopupHop(null);
    setPingAnimation(null);
    onRefreshNetwork?.();
  }, [onRefreshNetwork, setPacketPopupHop, setPingAnimation]);

  const deviceCounterRef = useRef<Record<string, number>>({ pc: 0, iot: 0, switch: 0, router: 0, firewall: 0, wlc: 0, hub: 0, cloud: 0, mobile: 0, printer: 0 });
  const getCounterKey = useCallback((type: DeviceType | string): string => {
    if (type === 'switchL2' || type === 'switchL3' || type === 'switch') return 'switch';
    return type;
  }, []);

  useEffect(() => {
    pingStepModeRef.current = isSimulationMode;
  }, [isSimulationMode, pingStepModeRef]);

  const noteCounterRef = useRef<number>(0);
  const noteTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const {
    getLivePort,
    getLiveDeviceVlan,
    getIotDeviceStatus,
    getIotPowerStatus,
    getIotOpenCloseStatus,
    getIotMeasuredValue,
    getLivePortVlanText,
  } = useTopologyIot({
    connections,
    deviceStates,
    deviceMap,
    language,
    environment,
    mousePosRef,
    t,
  });

  const {
    generateUniqueLinkLocalIp,
    generateUniqueLinkLocalIpv6,
    generateUniqueHostname,
    addDevice,
    deleteDevice,
    getNextNoteId,
    addNote,
    addSummaryNote,
    deleteNote,
    duplicateNote,
  } = useCanvasActions({
    devices,
    setDevices: setDevicesState,
    connections,
    setConnections: setConnectionsState,
    notes,
    setNotes: setNotesState,
    deviceStates,
    saveToHistory,
    isExamActive,
    isExamEditorOpen,
    pan,
    zoom,
    canvasDimensions,
    deviceCounterRef,
    noteCounterRef,
    latestNotesRef,
    setSelectedDeviceIds,
    setSelectedNoteIds,
    onDeviceSelect,
    onDeviceDelete,
    setConnectionStart,
    setIsDrawingConnection,
    language,
    t,
  });

  const {
    noteClipboard,
    setNoteTextSelection,
    handleNoteTextCopy,
    handleNoteTextCut,
    handleNoteTextDelete,
    handleNoteTextPaste,
    handleNoteTextSelectAll,
    bringNoteToFront,
  } = useNoteEditing({
    setNotesState,
    latestNotesRef,
    saveToHistory,
    noteTextareaRefs,
  });

  const {
    draggedDevice,
    setDraggedDevice,
    isActuallyDragging,
    setIsActuallyDragging,
    startDeviceDrag,
  } = useDeviceDrag({
    saveToHistory,
    draggedDeviceRef,
    dragStartPosRef,
    isActuallyDraggingRef,
    dragStartDevicePositionsRef,
  });

  const {
    hoveredConnectionId,
    connectionTooltip,
    portTooltip,
    setPortTooltip,
    deviceTooltip,
    setDeviceTooltip,
    handlePortHover,
    handlePortMouseLeave,
    handleConnectionClick,
    handleConnectionMouseEnter,
    handleConnectionMouseLeave,
    handleDeviceMouseLeave,
    portTooltipTimerRef,
    connectionTooltipTimerRef,
  } = useTopologyTooltipHandlers({
    devices,
    canvasRef,
    deviceMap,
    getLivePort,
    activeCaptureConnectionId,
    setActiveCaptureConnection,
    setContextMenu,
    zoomRef,
    panRef,
    isDrawingConnection,
    isPanning,
    isSelecting,
    isActuallyDragging,
    isTouchDraggingRef,
    TOOLTIP_DELAY: 300,
    TOOLTIP_OFFSET_Y: 20,
  });

  const { selectAllDevices } = useCanvasSelection({
    devices,
    setSelectedDeviceIds,
    selectedDeviceIdsRef,
    setIsSelecting,
    isSelectingRef,
    selectionBoxRef,
    setSelectionBox,
    setSelectAllMode,
    setContextMenu: setContextMenu as (menu: unknown) => void,
    canvasRef,
    panRef,
    zoomRef,
  });

  const previousCableTypeRef = useRef<CableType | null>(null);

  const { cancelConnectionDrawing } = useConnectionDrawing({
    setIsDrawingConnection,
    setConnectionStart,
    setMobileConnectionSource,
    isDrawingConnectionRef,
    connectionStartRef,
    onCableChange,
    cableInfo,
    previousCableTypeRef,
  });

  const { cancelPingDueToInterruption } = usePingAnimation({
    connections,
    deviceStates,
    deviceMap,
    isTR,
    setPingAnimation,
    setHopPacketInfos,
    setErrorToast,
    setPingMode,
    pingAnimationRef,
    pingCleanupTimeoutRef,
    pingIsPausedRef,
  });

  const { startPingAnimation } = usePingSequence({
    isTR,
    isSimulationMode,
    devices,
    connections,
    deviceStates,
    deviceMap,
    latestDevicesRef,
    latestConnectionsRef,
    pingAnimationRef,
    pingCleanupTimeoutRef,
    pingIsPausedRef,
    pingStepModeRef,
    pingResumeCallbackRef,
    pingSkipCallbackRef,
    pingPathRef,
    cancelPingDueToInterruptionRef,
    setPingAnimation: setPingAnimation as React.Dispatch<React.SetStateAction<PingAnimationState | null>>,
    setHopPacketInfos: (infos) => setHopPacketInfos(infos),
    setErrorToast: (toast) => setErrorToast(toast),
    setPingMode,
    getPingDiagnostics,
    checkDeviceConnectivity,
    getWirelessDistance,
    easeInOutCubic,
    flushSync,
    cancelAnimationFrame,
    requestAnimationFrame,
  });

  const {
    handlePingPause,
    handlePingPlay,
    handlePingNext,
    handleEnvelopeClick,
  } = useTopologyPingUI({
    pingIsPausedRef,
    pingStepModeRef,
    pingResumeCallbackRef,
    pingSkipCallbackRef,
    pingAnimationRef,
    pingCleanupTimeoutRef,
    pingPathRef,
    cancelPingDueToInterruptionRef,
    setPingAnimation: setPingAnimation as React.Dispatch<React.SetStateAction<PingAnimationState | null>>,
    setPacketPopupHop,
    onPacketPanelFocus,
    pingAnimation,
    startPingAnimation,
    isTR,
  });

  const {
    startDeviceConfig,
    cancelDeviceConfig,
    saveDeviceConfig,
    togglePowerDevices,
    handleAlign,
    toggleConnectionActive,
    deleteConnection,
  } = useTopologyDeviceActions({
    devices,
    setDevices: setDevicesState,
    connections,
    setConnections: setConnectionsState,
    selectedDeviceIds,
    saveToHistory,
    activeCaptureConnectionId,
    setActiveCaptureConnection,
    setConfiguringDevice,
    setContextMenu: setContextMenu as React.Dispatch<React.SetStateAction<ContextMenuState | null>>,
  });

  // Visual Connection Actions Hook
  const { deleteVisualConnection, toggleVisualConnectionActive } = useVisualConnectionActions({
    topologyConnections,
    visualConnections,
    deleteConnection,
    toggleConnectionActive,
    saveToHistory,
    setDevicesState,
  });

  const getCanvasDimensions = useCallback(() => {
    if (typeof window === 'undefined') return { width: VIRTUAL_CANVAS_WIDTH_DESKTOP, height: VIRTUAL_CANVAS_HEIGHT_DESKTOP };
    return isMobile
      ? { width: VIRTUAL_CANVAS_WIDTH_MOBILE, height: VIRTUAL_CANVAS_HEIGHT_MOBILE }
      : { width: VIRTUAL_CANVAS_WIDTH_DESKTOP, height: VIRTUAL_CANVAS_HEIGHT_DESKTOP };
  }, [isMobile]);

  const getDistance = useCallback((x1: number, y1: number, x2: number, y2: number): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;

    const rect = contextMenuRef.current.getBoundingClientRect();
    const padding = 10;
    const nextX = Math.max(padding, Math.min(contextMenu.x, window.innerWidth - rect.width - padding));
    const nextY = Math.max(padding, Math.min(contextMenu.y, window.innerHeight - rect.height - padding));

    if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
      setContextMenu((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev));
    }
  }, [contextMenu?.x, contextMenu?.y, contextMenu?.mode, contextMenu?.noteId, contextMenu?.deviceId]);

  const { openContextMenu, handleContextMenu } = useTopologyContextMenu({
    setContextMenu,
    pingMode,
  });

  const getDeviceIdsInSelectionBox = useCallback((box: { start: { x: number; y: number }; current: { x: number; y: number } }) => {
    const x1 = Math.min(box.start.x, box.current.x);
    const y1 = Math.min(box.start.y, box.current.y);
    const x2 = Math.max(box.start.x, box.current.x);
    const y2 = Math.max(box.start.y, box.current.y);

    return latestDevicesRef.current
      .filter((d) => {
        const deviceWidth = getDeviceWidth(d.type);
        const deviceHeight = getDeviceHeight(d.type, d.ports?.length || 0);
        const dX1 = d.x;
        const dY1 = d.y;
        const dX2 = d.x + deviceWidth;
        const dY2 = d.y + deviceHeight;
        return dX1 < x2 && dX2 > x1 && dY1 < y2 && dY2 > y1;
      })
      .map((d) => d.id);
  }, []);

  const mergeSelectionIds = useCallback((boxSelectedIds: string[]) => {
    if (!selectionAdditiveRef.current) return boxSelectedIds;
    return Array.from(new Set([...selectionBaseIdsRef.current, ...boxSelectedIds]));
  }, []);

  useLayoutEffect(() => {
    isPanningRef.current = isPanning;
    panStartRef.current = panStart;
    zoomRef.current = zoom;
    if (!isPanning && !isActuallyDragging && !touchMomentumFrameRef.current) {
      panRef.current = pan;
    }
    draggedDeviceRef.current = draggedDevice;
    isActuallyDraggingRef.current = isActuallyDragging;
    snapToGridRef.current = snapToGrid;
    isDrawingConnectionRef.current = isDrawingConnection;
    connectionStartRef.current = connectionStart;
    connectionMetaRef.current = connectionMeta;
    selectedDeviceIdsRef.current = selectedDeviceIds;
  }, [isPanning, panStart, zoom, pan, draggedDevice, isActuallyDragging, snapToGrid, isDrawingConnection, connectionStart, selectedDeviceIds, connectionMeta]);

  useLayoutEffect(() => {
    if (isPanning || isActuallyDragging) return;
    if (wheelSyncTimerRef.current) return;
    if (touchMomentumFrameRef.current) return;
    const g = svgContentGroupRef.current;
    if (!g) return;
    g.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`;
  }, [pan, zoom, isPanning, isActuallyDragging]);

  const handleDeviceMouseDown = useCallback(
    (e: ReactMouseEvent, deviceId: string) => {
      e.stopPropagation();
      if (!canvasRef.current) return;

      const device = deviceMap.get(deviceId);
      if (!device) return;

      const currentPingMode = pingModeRef.current;
      const currentPingSource = pingSourceRef.current;
      if (currentPingMode) {
        if (!currentPingSource) {
          setPingSource(device);
          pingSourceRef.current = device;
          setPingResult(null);

          pingIsPausedRef.current = false;
          pingStepModeRef.current = false;
          if (pingAnimationRef.current) {
            cancelAnimationFrame(pingAnimationRef.current);
            pingAnimationRef.current = null;
          }
          if (pingCleanupTimeoutRef.current) {
            clearTimeout(pingCleanupTimeoutRef.current);
            pingCleanupTimeoutRef.current = null;
          }
          setPingAnimation(null);
          setHopPacketInfos([]);
          setPacketPopupHop(null);

          return;
        } else {
          if (device.id === currentPingSource.id) return;
          setPingMode(false);
          pingModeRef.current = false;
          setPingSource(null);
          pingSourceRef.current = null;
          setPacketPopupHop(null);
          startPingAnimationRef.current?.(currentPingSource.id, device.id);
          return;
        }
      }

      saveToHistory();
      wasDraggingRef.current = false;
      canvasRef.current?.focus();

      let newSelectedIds: string[];
      const currentSelectedIds = [...selectedDeviceIdsRef.current];

      if (e.shiftKey) {
        newSelectedIds = currentSelectedIds.includes(deviceId)
          ? currentSelectedIds.filter((id) => id !== deviceId)
          : [...currentSelectedIds, deviceId];

        if (newSelectedIds.length > 0) {
          const firstSelectedDevice = deviceMap.get(newSelectedIds[0]);
          if (firstSelectedDevice) {
            onDeviceSelect(firstSelectedDevice.type, newSelectedIds[0], undefined, firstSelectedDevice.name);
          }
        } else if (onDeviceSelect) {
          onDeviceSelect(null as unknown as DeviceType, null as unknown as string | undefined, undefined, null as unknown as string | undefined);
        }

        setSelectedDeviceIds(newSelectedIds);
        document.body.style.cursor = 'copy';
      } else {
        if (!currentSelectedIds.includes(deviceId)) {
          newSelectedIds = [deviceId];
          setSelectedDeviceIds(newSelectedIds);
          onDeviceSelect(device.type, deviceId, isSwitchDeviceType(device.type) ? device.switchModel : undefined, device.name);
        } else {
          newSelectedIds = currentSelectedIds;
        }
      }

      const initialPositions: { [key: string]: { x: number; y: number } } = {};
      devices.forEach((d) => {
        if (newSelectedIds.includes(d.id)) {
          initialPositions[d.id] = { x: d.x, y: d.y };
        }
      });
      startDeviceDrag(e, deviceId, newSelectedIds, initialPositions);
    },
    [
      devices,
      selectedDeviceIds,
      onDeviceSelect,
      pingMode,
      pingSource,
      startDeviceDrag,
      deviceMap,
      saveToHistory,
      setPingSource,
      setPingResult,
      setPingAnimation,
      setHopPacketInfos,
      setPacketPopupHop,
      setPingMode,
    ]
  );

  const handleDeviceClick = useCallback(
    (e: ReactMouseEvent, device: CanvasDevice) => {
      e.stopPropagation();

      setContextMenu(null);

      if (wasDraggingRef.current) return;

      if (pingModeRef.current || pingSourceRef.current) {
        return;
      }

      setSelectedNoteIds([]);

      if (!e.shiftKey) {
        onDeviceSelect(device.type, device.id, isSwitchDeviceType(device.type) ? device.switchModel : undefined, device.name);
        if (!e.isTrusted) {
          setSelectedDeviceIds([device.id]);
        }
      }
      canvasRef.current?.focus();
    },
    [onDeviceSelect, pingMode, pingSource, setContextMenu]
  );

  const { handleDeviceKeyDown } = useDeviceNavigation({
    devices,
    deviceMap,
    onDeviceSelect,
    setSelectedDeviceIds,
    setSelectedNoteIds,
    setPan,
    canvasRef,
    zoomRef,
    panRef,
    svgContentGroupRef,
  });

  const handleDeviceDoubleClick = useCallback(
    (device: CanvasDevice) => {
      if (onDeviceDoubleClick) {
        onDeviceDoubleClick(device.type, device.id);
      } else {
        if (device.type === 'pc' || device.type === 'iot') {
          onDeviceSelect('pc', device.id, undefined, device.name);
        } else if (isSwitchDeviceType(device.type) || device.type === 'router') {
          onDeviceSelect(device.type, device.id, isSwitchDeviceType(device.type) ? device.switchModel : undefined, device.name);
        }
      }
    },
    [onDeviceDoubleClick, onDeviceSelect]
  );

  const handleDevicePointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>, deviceId: string) => {
      if (e.pointerType === 'mouse') return;
      if (activeDragPointerIdRef.current !== null) return;

      e.preventDefault();
      e.stopPropagation();
      activePointerDragRef.current = true;
      activeDragPointerIdRef.current = e.pointerId;

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // SVG pointer capture fallback
      }

      const device = deviceMap.get(deviceId);
      if (device) {
        const now = Date.now();
        if (now - lastTapTimeRef.current < 300 && lastTappedDeviceRef.current === deviceId) {
          handleDeviceDoubleClick(device);
          lastTapTimeRef.current = 0;
          lastTappedDeviceRef.current = null;
        } else {
          lastTapTimeRef.current = now;
          lastTappedDeviceRef.current = deviceId;
        }
      }

      handleDeviceMouseDown(e as unknown as ReactMouseEvent, deviceId);
    },
    [handleDeviceMouseDown, deviceMap, handleDeviceDoubleClick]
  );

  const {
    handleDeviceTouchStart,
    handleDeviceTouchMove,
    handleDeviceTouchEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    isTouchDragging,
    touchDraggedDevice,
    touchMomentumFrameRef,
  } = useTopologyTouch({
    canvasRef,
    deviceMap,
    devices,
    pan,
    panRef,
    zoom,
    zoomRef,
    selectedDeviceIds,
    setSelectedDeviceIds,
    saveToHistory,
    openContextMenu,
    handleDeviceDoubleClick,
    onDeviceSelect,
    isDrawingConnection,
    mobileConnectionSource,
    setMobileConnectionSource,
    isMobile,
    isTR,
    toast,
    getCanvasDimensions,
    getDistance,
    setDevices,
    isSwitchDeviceType,
    LONG_PRESS_DURATION,
    DRAG_THRESHOLD,
    MIN_ZOOM,
    MAX_ZOOM,
    setZoom,
    setPan,
    panStartRef,
    svgContentGroupRef,
    pendingPanRef,
    activePointerDragRef,
    dragStartDevicePositionsRef,
    dragAnimationFrameRef,
    liveDeviceDragPositionsRef,
    latestDevicesRef,
    selectedDeviceIdsRef,
    isDrawingConnectionRef,
    setIsDrawingConnection,
    setConnectionStart,
    lastDragPositionRef,
    setDeviceTooltip,
    setPortTooltip,
  });

  const isDraggingInteractionDisabled = isActuallyDragging || isTouchDragging;

  const { handleCanvasMouseDown } = useTopologyMouse({
    canvasRef,
    canvasRectRef,
    panRef,
    zoomRef,
    mousePosRef,
    isPanningRef,
    lastMouseMoveTimeRef,
    lastMouseMovePosRef,
    velocityRef,
    panAnimationFrameRef,
    panStartRef,
    svgContentGroupRef,
    pendingPanRef,
    isSelectingRef,
    selectionBoxRef,
    selectionAdditiveRef,
    selectionBaseIdsRef,
    selectedDeviceIdsRef,
    selectionAnimationFrameRef,
    draggedDeviceRef,
    dragStartPosRef,
    isActuallyDraggingRef,
    wasDraggingRef,
    lastDragEventRef,
    dragStartDevicePositionsRef,
    snapToGridRef,
    liveDeviceDragPositionsRef,
    isDrawingConnectionRef,
    activePointerDragRef,
    activeDragPointerIdRef,
    latestDevicesRef,
    latestConnectionsRef,
    getPortPositionRef,
    connectionMetaRef,
    lastDragPositionRef,
    dragAnimationFrameRef,
    mousePosAnimationFrameRef,
    momentumAnimationFrameRef,
    setMousePos,
    setDevices,
    setIsPanning,
    setPan,
    setIsSelecting,
    setSelectionBox,
    setSelectedDeviceIds,
    setIsActuallyDragging,
    setDraggedDevice,
    setIsDrawingConnection,
    setConnectionStart,
    setDeviceTooltip,
    setPortTooltip,
    setContextMenu,
    setSelectAllMode,
    setPingMode,
    setPingSource,
    setPingResult,
    setPanStart,
    setSelectedNoteIds,
    mergeSelectionIds,
    getDeviceIdsInSelectionBox,
    openContextMenu,
    cancelConnectionDrawing,
    onDeviceSelect,
    pingMode,
    pingSource,
    language,
  });

  const { handlePortClick } = useTopologyPortConnection({
    deviceMap,
    topologyConnections,
    connections,
    devices,
    cableInfo,
    onCableChange,
    saveToHistory,
    setConnections,
    setDevices,
    setIsDrawingConnection,
    setConnectionStart,
    setConnectionError,
    cancelConnectionDrawing,
    isDrawingConnectionRef,
    connectionStartRef,
    isActuallyDraggingRef,
    isTouchDraggingRef,
    language,
    t: { portInUse: t.portInUse },
    previousCableTypeRef,
  });

  const {
    draggedNoteId,
    resizingNoteId,
    noteDragStart,
    noteResizeStart,
    noteResizeDirection,
    updateNoteText,
    updateNoteStyle,
    cycleNoteColor,
    cycleNoteFont,
    cycleNoteFontSize,
    cycleNoteOpacity,
    handleNoteHeaderMouseDown,
    handleNoteHeaderTouchStart,
    handleNoteResizeStart,
    handleNoteResizeTouchStart,
  } = useTopologyNoteActions({
    notes,
    setNotes: setNotesState,
    latestNotesRef,
    saveToHistory,
    bringNoteToFront,
    setSelectedNoteIds,
    canvasRef,
    zoomRef,
    draggedNoteIdRef,
    resizingNoteIdRef,
    noteDragStartRef,
    noteResizeStartRef,
    noteResizeDirectionRef,
  });

  useEffect(() => {
    latestDevicesRef.current = devices;
    latestConnectionsRef.current = connections;
    latestNotesRef.current = notes;
    draggedNoteIdRef.current = draggedNoteId;
    resizingNoteIdRef.current = resizingNoteId;
    noteDragStartRef.current = noteDragStart;
    noteResizeStartRef.current = noteResizeStart;
    noteResizeDirectionRef.current = noteResizeDirection;
    isTouchDraggingRef.current = isTouchDragging;
    touchDraggedDeviceRef.current = touchDraggedDevice;
  }, [
    devices,
    connections,
    notes,
    draggedNoteId,
    resizingNoteId,
    noteDragStart,
    noteResizeStart,
    noteResizeDirection,
    isTouchDragging,
    touchDraggedDevice,
  ]);

  const handleExportPNG = useCallback(() => {
    setIsExporting(true);
    setTimeout(() => {
      if (!canvasRef.current) {
        setIsExporting(false);
        return;
      }
      const svg = canvasRef.current.querySelector('svg');
      if (!svg) {
        setIsExporting(false);
        return;
      }

      try {
        exportTopologyToPNG({
          svgElement: svg,
          devices,
          notes,
          connections,
          deviceStates: deviceStates || undefined,
          getPortPosition: getPortPositionRef.current,
        });
      } finally {
        setIsExporting(false);
      }
    }, 300);
  }, [devices, connections, notes, deviceStates]);

  useTopologyEventListeners({
    isExamActive,
    isExamEditorOpen,
    addDevice,
    addNote,
    addSummaryNote,
    handleExportPNG,
    setPingMode,
    pingModeRef,
    pingIsPausedRef,
    pingStepModeRef,
    pingAnimationRef,
    pingCleanupTimeoutRef,
    setPingAnimation: setPingAnimation as React.Dispatch<React.SetStateAction<unknown>>,
    setHopPacketInfos: setHopPacketInfos as React.Dispatch<React.SetStateAction<unknown>>,
    setPacketPopupHop,
    setPingSource,
    pingSourceRef,
    setPingResult: setPingResult as React.Dispatch<React.SetStateAction<unknown>>,
    setContextMenu: setContextMenu as React.Dispatch<React.SetStateAction<unknown>>,
    setIsPaletteOpen,
    setShowPortSelector,
    setPortSelectorStep,
    setSelectedSourcePort,
    saveToHistory,
    setDevices: setDevicesState,
    deleteConnection,
  });

  // Custom Window Event Listeners & Side-effect Hook
  useTopologyWindowEvents({
    canvasRef,
    setZoom,
    setPan,
    zoomToFit,
    setIsMinimapOpen,
    setShowLogPanel,
    setContextMenu,
    setPacketPopupHop,
    setPingAnimation,
    setHopPacketInfos: setHopPacketInfos as React.Dispatch<React.SetStateAction<unknown>>,
    saveToHistory,
    setDevices: setDevicesState,
    deleteConnection,
    focusDeviceId,
    deviceMap,
    zoom,
    onPanChange,
    onTopologyChange,
    devices,
    topologyConnections,
    notes,
    portTooltipTimerRef,
    connectionTooltipTimerRef,
    wheelSyncTimerRef,
  });

  useTopologySync({
    deviceStates,
    connections: topologyConnections,
    setDevices,
    devices,
    getCounterKey,
    deviceCounterRef,
  });

  const toggleFullscreen = useCallback(() => {
    if (onFullscreenChange) {
      onFullscreenChange(!isFullscreen);
    }
  }, [isFullscreen, onFullscreenChange]);

  const {
    clipboard,
    copyDevice,
    cutDevice,
    pasteDevice,
    pasteNotes,
  } = useCanvasClipboard({
    devices,
    setDevices,
    deleteDevice,
    setSelectedDeviceIds,
    saveToHistory,
    deviceCounterRef,
    generateUniqueHostname,
    generateUniqueLinkLocalIp,
    generateUniqueLinkLocalIpv6,
    getCounterKey,
    setContextMenu,
    notesClipboard,
    getNextNoteId,
    setNotes,
    setSelectedNoteIds,
  });

  useLayoutEffect(() => {
    cancelPingDueToInterruptionRef.current = cancelPingDueToInterruption;
  }, [cancelPingDueToInterruption]);

  useLayoutEffect(() => {
    startPingAnimationRef.current = startPingAnimation;
  }, [startPingAnimation]);

  useEffect(() => {
    getPortPositionRef.current = getPortPosition;
  }, []);

  const renderDevice = (device: CanvasDevice, isDragging: boolean = false) => {
    return (
      <TopologyDeviceRenderer
        device={device}
        topologyDevices={devices}
        isDragging={isDragging}
        selectedDeviceIds={selectedDeviceSet}
        isDark={isDark}
        language={language}
        t={t}
        deviceStates={deviceStates}
        deviceToConnectionsMap={deviceToConnectionsMap}
        graphicsQuality={graphicsQuality}
        isDraggingInteractionDisabled={isDraggingInteractionDisabled}
        getLiveDeviceVlan={getLiveDeviceVlan}
        getIotMeasuredValue={getIotMeasuredValue}
        handlePortHover={handlePortHover}
        handlePortMouseLeave={handlePortMouseLeave}
        handlePortClick={handlePortClick}
        handleDeviceMouseDown={(e, id) => handleDeviceMouseDown(e as unknown as ReactMouseEvent, id)}
        handleDevicePointerDown={handleDevicePointerDown}
        handleDeviceClick={(e, selectedDevice) => handleDeviceClick(e as unknown as ReactMouseEvent, selectedDevice)}
        handleDeviceKeyDown={handleDeviceKeyDown}
        handleDeviceDoubleClick={handleDeviceDoubleClick}
        handleDeviceMouseLeave={handleDeviceMouseLeave}
        handleDeviceTouchStart={(e, id) => handleDeviceTouchStart(e as unknown as ReactTouchEvent, id)}
        handleDeviceTouchMove={handleDeviceTouchMove}
        handleDeviceTouchEnd={handleDeviceTouchEnd}
        _mousePosRef={mousePosRef}
        isDrawingConnection={isDrawingConnection}
        connectionStart={connectionStart}
      />
    );
  };

  useCanvasKeyboard({
    selectedDeviceIds,
    selectedNoteIds,
    deleteDevice,
    deleteNote,
    configuringDevice,
    cancelDeviceConfig,
    selectAllDevices,
    saveToHistory,
    onDeviceDelete,
    isDrawingConnection,
    copyDevice,
    cutDevice,
    pasteDevice,
    pingSource,
    pingMode,
    setPingSource: setPingSource as (src: unknown) => void,
    setPingMode,
    setPingResult: setPingResult as (res: unknown) => void,
    toggleFullscreen,
    resetView,
    isExamActive,
    cancelConnectionDrawing,
    handlePingClose,
    packetPopupHop,
    setPacketPopupHop,
    pingAnimation,
    deviceMap,
    setDevices,
    setSelectedDeviceIds,
    setSelectedNoteIds,
    setContextMenu,
    isPaletteOpen,
    setIsPaletteOpen,
    isFullscreen,
    onFullscreenChange,
    isPingPanelVisible,
  });

  const _liveRegionText = useMemo(() => {
    const selectedCount = selectedDeviceIds.length;
    const totalCount = devices.length;
    const deviceLabel = totalCount === 1
      ? (language === 'tr' ? 'cihaz' : 'device')
      : (language === 'tr' ? 'cihaz' : 'devices');
    let text = `${totalCount} ${deviceLabel}`;
    if (selectedCount > 0) {
      const selLabel = selectedCount === 1
        ? (language === 'tr' ? 'seçili' : 'selected')
        : (language === 'tr' ? 'seçili' : 'selected');
      text += `, ${selectedCount} ${selLabel}`;
    }
    return text;
  }, [devices.length, selectedDeviceIds.length, language]);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={`${isFullscreen ? 'fixed inset-0 z-[9999] overflow-hidden' : 'relative w-full h-full'} flex flex-col ${
        isDark
          ? 'bg-gradient-to-br from-secondary-800/90 via-secondary-700/80 to-secondary-800/90'
          : 'bg-gradient-to-br from-primary-50/50 via-white to-secondary-50/80'
      }`}
    >
      {isFullscreen && (
        <TopologyFullscreenButton isDark={isDark} label={t.exit} onClick={toggleFullscreen} />
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 relative flex flex-col">
          {/* Palette Sheet */}
          <TopologyPaletteSheet
            isPaletteOpen={isPaletteOpen}
            setIsPaletteOpen={setIsPaletteOpen}
            isDark={isDark}
            isTR={isTR}
            t={t}
            addDevice={addDevice}
            cableInfo={cableInfo}
            onCableChange={onCableChange}
            DEVICE_ICONS={DEVICE_ICONS}
          />
          
          {/* Ping Mode Target/Source Overlay Badge */}
          <PingCursorOverlay
            pingMode={pingMode}
            pingCursorPos={pingCursorPos}
            pingSource={pingSource}
            isDark={isDark}
            t={{ selectTarget: t.selectTarget, selectSource: t.selectSource }}
          />

          {/* Multiple Selection Indicator & Tools */}
          <TopologySelectionToolbar
            isDark={isDark}
            t={t}
            selectedDeviceIds={selectedDeviceIds}
            deviceMap={deviceMap}
            handleAlign={handleAlign}
            setSelectedDeviceIds={setSelectedDeviceIds}
            onDeviceSelect={onDeviceSelect}
            saveToHistory={saveToHistory}
            deleteDevice={deleteDevice}
          />

          {/* Canvas */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {_liveRegionText}
          </div>
          <TopologyCanvasLayer
            canvasRef={canvasRef}
            svgContentGroupRef={svgContentGroupRef}
            isDark={isDark}
            isPanning={isPanning}
            isSelecting={isSelecting}
            pingMode={pingMode}
            pingSource={pingSource}
            selectedDeviceIds={selectedDeviceIds}
            selectedDeviceSet={selectedDeviceSet}
            selectedNoteIds={selectedNoteIds}
            connectionStart={connectionStart}
            mousePos={mousePos}
            isDrawingConnection={isDrawingConnection}
            cableInfo={cableInfo}
            contextMenu={contextMenu}
            noteTextareaRefs={noteTextareaRefs}
            isActuallyDragging={isActuallyDragging}
            isTouchDragging={isTouchDragging}
            deviceMap={deviceMap}
            deviceStates={deviceStates}
            devices={devices}
            connections={connections}
            notes={notes}
            visibleConnections={visibleConnections}
            visibleNotes={visibleNotes}
            devicesSortedForRender={devicesSortedForRender}
            activeDeviceId={activeDeviceId}
            iotUpdateTrigger={iotUpdateTrigger}
            graphicsQuality={graphicsQuality}
            zoom={zoom}
            environment={environment}
            t={t}
            language={language}
            selectionBox={selectionBox}
            hoveredConnectionId={hoveredConnectionId}
            handleCanvasMouseDown={handleCanvasMouseDown}
            handleTouchStart={handleTouchStart}
            handleTouchMove={handleTouchMove}
            handleTouchEnd={handleTouchEnd}
            handleContextMenu={(e, deviceId) => handleContextMenu(e as unknown as ReactMouseEvent, deviceId)}
            handleNoteHeaderMouseDown={handleNoteHeaderMouseDown}
            handleNoteHeaderTouchStart={handleNoteHeaderTouchStart}
            cycleNoteColor={cycleNoteColor}
            cycleNoteFont={cycleNoteFont}
            cycleNoteFontSize={cycleNoteFontSize}
            cycleNoteOpacity={cycleNoteOpacity}
            duplicateNote={duplicateNote}
            deleteNote={deleteNote}
            updateNoteText={updateNoteText}
            setNoteTextSelection={setNoteTextSelection}
            handleNoteResizeStart={handleNoteResizeStart}
            handleNoteResizeTouchStart={handleNoteResizeTouchStart}
            bringNoteToFront={bringNoteToFront}
            setSelectedNoteIds={setSelectedNoteIds}
            setSelectedDeviceIds={setSelectedDeviceIds}
            setContextMenu={setContextMenu}
            setSelectAllMode={setSelectAllMode}
            cancelConnectionDrawing={cancelConnectionDrawing}
            setPingCursorPos={setPingCursorPos}
            setZoom={setZoom}
            setPan={setPan}
            handleZoomWheel={handleZoomWheel}
            resetView={resetView}
            getCanvasDimensions={getCanvasDimensions}
            renderDevice={renderDevice}
            handleConnectionMouseEnter={handleConnectionMouseEnter}
            handleConnectionMouseLeave={handleConnectionMouseLeave}
            handleConnectionClick={handleConnectionClick}
            onDeleteConnection={deleteVisualConnection}
            onToggleConnectionActive={toggleVisualConnectionActive}
            pingAnimation={pingAnimation}
            handleEnvelopeClick={handleEnvelopeClick}
            isDarkForPing={isDark}
            tForPing={t}
          />

          {/* Zoom Controls */}
          <CanvasToolbar
            zoom={zoom}
            setZoom={setZoom}
            setPan={setPan}
            canvasRef={canvasRef}
            resetView={resetView}
            zoomToFit={zoomToFit}
            handleZoomMouseDown={handleZoomMouseDown}
            handleZoomWheel={handleZoomWheel}
            isDraggingZoom={isDraggingZoom}
            isDark={isDark}
            t={t}
            MIN_ZOOM={MIN_ZOOM}
            MAX_ZOOM={MAX_ZOOM}
            onToggleLogPanel={() => setShowLogPanel(!showLogPanel)}
            logCount={networkEventLogs.length}
            onToggleMinimap={() => setIsMinimapOpen(!isMinimapOpen)}
            isMinimapOpen={isMinimapOpen}
          />

          <NetworkEventLogPanel
            isOpen={showLogPanel}
            onClose={() => setShowLogPanel(false)}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Context Menu */}
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
        isExamActive={isExamActive}
        isPingPanelOpen={isPingPanelVisible}
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
        onCutDevices={(ids) => {
          saveToHistory();
          cutDevice(ids);
        }}
        onCopyDevices={(ids) => copyDevice(ids)}
        onPasteDevice={() => pasteDevice()}
        onDeleteDevices={(ids) => {
          saveToHistory();
          ids.forEach((id) => deleteDevice(id));
          setSelectedDeviceIds([]);
        }}
        onStartConfig={startDeviceConfig}
        onStartPing={(id) => {
          const device = deviceMap.get(id);
          if (device) {
            setPingMode(true);
            setPingSource(device);
            setPingResult(null);
          }
        }}
        onTogglePowerDevices={(ids) => {
          saveToHistory();
          togglePowerDevices(ids);
        }}
        onSaveToHistory={() => saveToHistory()}
        onClearDeviceSelection={() => setSelectedDeviceIds([])}
        onOpenTasks={onOpenTasks}
        onRefreshNetwork={handleRefresh}
        note={notes.find((n) => n.id === contextMenu?.noteId)}
      />

      <TopologyTooltips
        portTooltip={portTooltip}
        deviceMap={deviceMap}
        deviceStates={deviceStates}
        isDark={isDark}
        language={language}
        getIotDeviceStatus={getIotDeviceStatus}
        getIotPowerStatus={getIotPowerStatus}
        getIotOpenCloseStatus={getIotOpenCloseStatus}
        getLivePortVlanText={getLivePortVlanText}
        connectionTooltip={connectionTooltip}
        CABLE_COLORS={CABLE_COLORS}
        deviceTooltip={deviceTooltip}
        isTR={isTR}
        isDraggingInteractionDisabled={isDraggingInteractionDisabled}
        t={{
          ipAddress: t.ipAddress,
          subnetMask: t.subnetMask,
          gateway: t.gateway,
          dnsServer: t.dnsServer,
          macAddress: t.macAddress,
          dhcpEnabled: t.dhcpEnabled,
          openServices: t.openServices,
          active: t.active,
        }}
      />

      <TopologyModals
        configuringDevice={configuringDevice}
        deviceMap={deviceMap}
        cancelDeviceConfig={cancelDeviceConfig}
        saveDeviceConfig={saveDeviceConfig}
        isMobile={isMobile}
        isDark={isDark}
        pingAnimation={pingAnimation}
        hopPacketInfos={hopPacketInfos}
        handlePingPlay={handlePingPlay}
        handlePingPause={handlePingPause}
        handlePingNext={handlePingNext}
        handlePingClose={handlePingClose}
        language={language}
        graphicsQuality={graphicsQuality}
        onPacketPanelFocus={onPacketPanelFocus}
        packetPanelZIndex={packetPanelZIndex}
        packetPopupHop={packetPopupHop}
        setPacketPopupHop={setPacketPopupHop}
        errorToast={errorToast}
        setErrorToast={setErrorToast}
        connectionError={connectionError}
        mobilePaletteOpen={mobilePaletteOpen}
        setMobilePaletteOpen={setMobilePaletteOpen}
        isTR={isTR}
        addDevice={addDevice}
        cableInfo={cableInfo}
        onCableChange={onCableChange}
        showPortSelector={showPortSelector}
        devices={devices}
        portSelectorStep={portSelectorStep}
        selectedSourcePort={selectedSourcePort}
        setShowPortSelector={setShowPortSelector}
        setPortSelectorStep={setPortSelectorStep}
        setSelectedSourcePort={setSelectedSourcePort}
        setConnections={setConnections}
        setDevices={setDevices}
        connections={connections}
        activeCaptureConnectionId={activeCaptureConnectionId}
        clearCapturedPackets={clearCapturedPackets}
        clearAllCapturedPackets={clearAllCapturedPackets}
        setActiveCaptureConnection={setActiveCaptureConnection}
        capturedPacketsMap={capturedPacketsMap}
        t={t}
      />

      <MinimapNavigator
        devices={devices}
        connections={connections}
        zoom={zoom}
        pan={pan}
        setPan={setPan}
        canvasRef={canvasRef}
        isDark={isDark}
        language={language}
        isOpen={isMinimapOpen}
        onToggle={() => setIsMinimapOpen(!isMinimapOpen)}
      />
    </div>
  );
}
