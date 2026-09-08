import React, { useCallback, useState } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';
import type { CanvasDevice, ContextMenuMode, DeviceType } from '../networkTopology.types';
import { MOMENTUM_DECAY, MOMENTUM_MIN_SPEED, MOMENTUM_THRESHOLD } from '../networkTopology.constants';

export interface UseTopologyTouchProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  deviceMap: Map<string, CanvasDevice>;
  devices: CanvasDevice[];
  pan: { x: number; y: number };
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  zoom: number;
  zoomRef: React.MutableRefObject<number>;
  selectedDeviceIds: string[];
  setSelectedDeviceIds: (ids: string[]) => void;
  saveToHistory: () => void;
  openContextMenu: (x: number, y: number, deviceId: string | null, mode?: ContextMenuMode) => void;
  handleDeviceDoubleClick: (device: CanvasDevice) => void;
  onDeviceSelect: (type: DeviceType, id: string, model?: string, name?: string) => void;
  isDrawingConnection: boolean;
  mobileConnectionSource?: string | null;
  setMobileConnectionSource?: (id: string | null) => void;
  isMobile: boolean;
  isTR: boolean;
  toast: (opts: { title: string; description?: string; duration?: number }) => void;
  getCanvasDimensions: () => { width: number; height: number };
  getDistance: (x1: number, y1: number, x2: number, y2: number) => number;
  setDevices: React.Dispatch<React.SetStateAction<CanvasDevice[]>>;
  isSwitchDeviceType: (type: string) => boolean;
  LONG_PRESS_DURATION: number;
  DRAG_THRESHOLD: number;
  MIN_ZOOM: number;
  MAX_ZOOM: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  panStartRef: React.MutableRefObject<{ x: number; y: number }>;
  svgContentGroupRef: React.RefObject<SVGGElement | null>;
  pendingPanRef: React.MutableRefObject<{ x: number; y: number } | null>;
  activePointerDragRef: React.MutableRefObject<boolean>;
  dragStartDevicePositionsRef: React.MutableRefObject<{ [key: string]: { x: number; y: number } }>;
  dragAnimationFrameRef: React.MutableRefObject<number | null>;
  liveDeviceDragPositionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  latestDevicesRef: React.MutableRefObject<CanvasDevice[]>;
  selectedDeviceIdsRef: React.MutableRefObject<string[]>;
  isDrawingConnectionRef: React.MutableRefObject<boolean>;
  setIsDrawingConnection: (isDrawing: boolean) => void;
  setConnectionStart: (start: { deviceId: string; portId: string; point: { x: number; y: number } } | null) => void;
  lastDragPositionRef: React.MutableRefObject<{ x: number; y: number } | null>;
  setDeviceTooltip: (tooltip: { deviceId: string; x: number; y: number; visible: boolean } | null) => void;
  setPortTooltip: (tooltip: { deviceId: string; portId: string; x: number; y: number; visible: boolean } | null) => void;
}

export function useTopologyTouch({
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
  isDrawingConnection: _isDrawingConnection,
  mobileConnectionSource: _mobileConnectionSource,
  setMobileConnectionSource: _setMobileConnectionSource,
  isMobile: _isMobile,
  isTR: _isTR,
  toast: _toast,
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
}: UseTopologyTouchProps) {
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchDraggedDevice, setTouchDraggedDevice] = useState<CanvasDevice | null>(null);
  const [touchDragStartPos, setTouchDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [touchDragOffset, setTouchDragOffset] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [_touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [lastTouchCenter, setLastTouchCenter] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [_panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Add Refs equivalent to those used in NetworkTopology.tsx
  const isPanningRef = React.useRef(isPanning);
  const touchDraggedDeviceRef = React.useRef(touchDraggedDevice);
  const touchDragStartPosRef = React.useRef(touchDragStartPos);
  const touchDragOffsetRef = React.useRef(touchDragOffset);
  const isTouchDraggingRef = React.useRef(isTouchDragging);
  const lastTapTimeRef = React.useRef(0);
  const lastTappedDeviceRef = React.useRef<string | null>(null);

  // Touch gesture smoothing (EMA)
  const ZOOM_SMOOTHING = 0.65;
  const PAN_SMOOTHING = 0.55;
  const lastSmoothedZoomRef = React.useRef<number | null>(null);
  const lastSmoothedPanRef = React.useRef<{ x: number; y: number } | null>(null);

  // Touch velocity tracking for momentum
  const touchVelocityRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchMoveTimeRef = React.useRef(0);
  const lastTouchMovePosRef = React.useRef<{ x: number; y: number } | null>(null);
  const touchMomentumFrameRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    isPanningRef.current = isPanning;
    touchDraggedDeviceRef.current = touchDraggedDevice;
    touchDragStartPosRef.current = touchDragStartPos;
    touchDragOffsetRef.current = touchDragOffset;
    isTouchDraggingRef.current = isTouchDragging;
  }, [isPanning, touchDraggedDevice, touchDragStartPos, touchDragOffset, isTouchDragging]);

  const handleDeviceTouchStart = useCallback((e: ReactTouchEvent, deviceId: string) => {
    if (activePointerDragRef.current) {
      activePointerDragRef.current = false;
    }

    if (e.touches.length !== 1) return;
    e.stopPropagation();

    if (!canvasRef.current) return;

    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const device = deviceMap.get(deviceId);
    if (!device) return;

    saveToHistory();

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    setTouchDragStartPos({ x: touch.clientX, y: touch.clientY });
    touchDragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    setIsTouchDragging(false);
    setTouchDraggedDevice(device);
    touchDraggedDeviceRef.current = device;

    const alreadySelected = selectedDeviceIds.length > 1 && selectedDeviceIds.includes(deviceId);
    const idsForDrag = alreadySelected ? selectedDeviceIds : [deviceId];
    if (!alreadySelected) setSelectedDeviceIds(idsForDrag);

    setTouchDragOffset({
      x: (touch.clientX - rect.left - pan.x) - device.x * zoom,
      y: (touch.clientY - rect.top - pan.y) - device.y * zoom,
    });
    touchDragOffsetRef.current = {
      x: (touch.clientX - rect.left - pan.x) - device.x * zoom,
      y: (touch.clientY - rect.top - pan.y) - device.y * zoom,
    };

    const initialPositions: { [key: string]: { x: number; y: number } } = {};
    devices.forEach(d => {
      if (idsForDrag.includes(d.id)) {
        initialPositions[d.id] = { x: d.x, y: d.y };
      }
    });
    dragStartDevicePositionsRef.current = initialPositions;

    const now = Date.now();
    if (now - lastTapTimeRef.current < 300 && lastTappedDeviceRef.current === deviceId) {
      handleDeviceDoubleClick(device);
      lastTapTimeRef.current = 0;
      lastTappedDeviceRef.current = null;
    } else {
      lastTapTimeRef.current = now;
      lastTappedDeviceRef.current = deviceId;

      const timer = setTimeout(() => {
        openContextMenu(touch.clientX, touch.clientY, deviceId, 'device');
        setLongPressTimer(null);
        setTouchDraggedDevice(null);
        touchDraggedDeviceRef.current = null;
      }, LONG_PRESS_DURATION);
      setLongPressTimer(timer);
    }
  }, [devices, pan, zoom, longPressTimer, handleDeviceDoubleClick, selectedDeviceIds, openContextMenu]);

  const handleDeviceTouchMove = useCallback((e: ReactTouchEvent) => {
    if (e.touches.length !== 1 || !touchDraggedDevice || !canvasRef.current) return;

    const touch = e.touches[0];

    if (touchDragStartPos) {
      const distance = getDistance(touchDragStartPos.x, touchDragStartPos.y, touch.clientX, touch.clientY);
      if (distance > DRAG_THRESHOLD) {
        setIsTouchDragging(true);
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
        }
      }
    }

    if (isTouchDragging && touchDragStartPos) {
      const dx = (touch.clientX - touchDragStartPos.x) / zoom;
      const dy = (touch.clientY - touchDragStartPos.y) / zoom;
      const initialPositions = dragStartDevicePositionsRef.current;
      const canvasDims = getCanvasDimensions();
      setDevices((prev) =>
        prev.map((d) => {
          const init = initialPositions[d.id];
          if (!init) return d;
          return {
            ...d,
            x: Math.max(50, Math.min(init.x + dx, canvasDims.width - 120)),
            y: Math.max(50, Math.min(init.y + dy, canvasDims.height - 150)),
          };
        })
      );
    }
  }, [touchDraggedDevice, touchDragStartPos, isTouchDragging, zoom, getCanvasDimensions, getDistance]);

  const handleDeviceTouchEnd = useCallback(() => {
    if (touchDraggedDevice && !isTouchDragging) {
      setSelectedDeviceIds([touchDraggedDevice.id]);
      onDeviceSelect(touchDraggedDevice.type, touchDraggedDevice.id, isSwitchDeviceType(touchDraggedDevice.type) ? touchDraggedDevice.switchModel : undefined, touchDraggedDevice.name);
    }

    setTouchDraggedDevice(null);
    touchDraggedDeviceRef.current = null;
    setTouchDragStartPos(null);
    touchDragStartPosRef.current = null;
    setIsTouchDragging(false);
  }, [touchDraggedDevice, isTouchDragging, onDeviceSelect]);

  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    if (!canvasRef.current) return;

    const isDevice = (e.target as HTMLElement).closest('[data-device-id]') || false;
    if (isDevice) return;

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const currentPan = panRef.current;
      setTouchStart({ x: touch.clientX, y: touch.clientY });
      setIsPanning(true);
      const ps = { x: touch.clientX - currentPan.x, y: touch.clientY - currentPan.y };
      setPanStart(ps);
      panStartRef.current = ps;
      isPanningRef.current = true;
      if (svgContentGroupRef.current) {
        svgContentGroupRef.current.style.willChange = 'transform';
        svgContentGroupRef.current.style.transition = 'none';
      }

      // Cancel any running momentum animation
      if (touchMomentumFrameRef.current) {
        cancelAnimationFrame(touchMomentumFrameRef.current);
        touchMomentumFrameRef.current = null;
      }

      // Initialize velocity tracking for this gesture
      touchVelocityRef.current = { x: 0, y: 0 };
      lastTouchMoveTimeRef.current = Date.now();
      lastTouchMovePosRef.current = { x: touch.clientX, y: touch.clientY };

      const timer = setTimeout(() => {
        openContextMenu(touch.clientX, touch.clientY, null);
        setLongPressTimer(null);
        setIsPanning(false);
        isPanningRef.current = false;
      }, LONG_PRESS_DURATION);
      setLongPressTimer(timer);
    } else if (e.touches.length === 2) {
      setIsPanning(false);
      isPanningRef.current = false;
      const a = e.touches[0];
      const b = e.touches[1];
      setLastTouchDistance(getDistance(a.clientX, a.clientY, b.clientX, b.clientY));
      setLastTouchCenter({
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2
      });
      lastSmoothedZoomRef.current = null;
      lastSmoothedPanRef.current = null;
    }
  }, [longPressTimer, getDistance]);

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!canvasRef.current) return;
    const isDevice = (e.target as HTMLElement).closest('[data-device-id]') || false;
    if (isDevice) return;

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (e.touches.length === 1 && isPanningRef.current) {
      const touch = e.touches[0];
      const ps = panStartRef.current;
      const newPanX = touch.clientX - ps.x;
      const newPanY = touch.clientY - ps.y;
      const g = svgContentGroupRef.current;
      if (g) {
        g.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0px) scale(${zoomRef.current})`;
      }
      pendingPanRef.current = { x: newPanX, y: newPanY };
      panRef.current = { x: newPanX, y: newPanY };

      // Track velocity for momentum on touchend
      const now = Date.now();
      const dt = now - lastTouchMoveTimeRef.current;
      if (dt > 0) {
        const dx = touch.clientX - lastTouchMovePosRef.current!.x;
        const dy = touch.clientY - lastTouchMovePosRef.current!.y;
        touchVelocityRef.current = {
          x: touchVelocityRef.current.x * 0.3 + (dx / dt) * 0.7,
          y: touchVelocityRef.current.y * 0.3 + (dy / dt) * 0.7,
        };
      }
      lastTouchMoveTimeRef.current = now;
      lastTouchMovePosRef.current = { x: touch.clientX, y: touch.clientY };

    } else if (e.touches.length === 2 && lastTouchDistance !== null && lastTouchCenter !== null) {
      const a = e.touches[0];
      const b = e.touches[1];

      const newDistance = getDistance(a.clientX, a.clientY, b.clientX, b.clientY);
      const newCenter = {
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2
      };

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const rawZoomFactor = newDistance / lastTouchDistance;

      // Smooth zoom factor with EMA to reduce jitter
      const prevSmoothedZoom = lastSmoothedZoomRef.current;
      const smoothedZoomFactor = prevSmoothedZoom !== null
        ? prevSmoothedZoom * (1 - ZOOM_SMOOTHING) + rawZoomFactor * ZOOM_SMOOTHING
        : rawZoomFactor;
      lastSmoothedZoomRef.current = smoothedZoomFactor;

      let newZoom = currentZoom * smoothedZoomFactor;
      newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));

      // Raw pan delta from center movement
      const rawPanDeltaX = newCenter.x - lastTouchCenter.x;
      const rawPanDeltaY = newCenter.y - lastTouchCenter.y;

      // Smooth pan delta with EMA
      const prevSmoothedPan = lastSmoothedPanRef.current;
      const smoothedPanDeltaX = prevSmoothedPan !== null
        ? prevSmoothedPan.x * (1 - PAN_SMOOTHING) + rawPanDeltaX * PAN_SMOOTHING
        : rawPanDeltaX;
      const smoothedPanDeltaY = prevSmoothedPan !== null
        ? prevSmoothedPan.y * (1 - PAN_SMOOTHING) + rawPanDeltaY * PAN_SMOOTHING
        : rawPanDeltaY;
      lastSmoothedPanRef.current = { x: smoothedPanDeltaX, y: smoothedPanDeltaY };

      if (Math.abs(newZoom - currentZoom) > 0.005) {
        const rect = canvasRef.current.getBoundingClientRect();
        const cursorX = newCenter.x - rect.left;
        const cursorY = newCenter.y - rect.top;

        const deltaX = cursorX - (cursorX - currentPan.x) * (newZoom / currentZoom);
        const deltaY = cursorY - (cursorY - currentPan.y) * (newZoom / currentZoom);

        const newPan = { x: deltaX + smoothedPanDeltaX, y: deltaY + smoothedPanDeltaY };
        setZoom(newZoom);
        setPan(newPan);
        pendingPanRef.current = newPan;
        const g = svgContentGroupRef.current;
        if (g) {
          g.style.transform = `translate3d(${newPan.x}px, ${newPan.y}px, 0px) scale(${newZoom})`;
        }
      } else {
        const newPan = { x: currentPan.x + smoothedPanDeltaX, y: currentPan.y + smoothedPanDeltaY };
        setPan(newPan);
        pendingPanRef.current = newPan;
        const g = svgContentGroupRef.current;
        if (g) {
          g.style.transform = `translate3d(${newPan.x}px, ${newPan.y}px, 0px) scale(${zoomRef.current})`;
        }
      }

      setLastTouchDistance(newDistance);
      setLastTouchCenter(newCenter);
    }
  }, [longPressTimer, lastTouchDistance, lastTouchCenter, getDistance]);

  const handleTouchEnd = useCallback((e: globalThis.TouchEvent | ReactTouchEvent) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    const touchesLength = (e as ReactTouchEvent).touches ? (e as ReactTouchEvent).touches.length : 0;
    if (touchesLength === 0) {
      // Reset pinch-to-zoom smoothing state
      lastSmoothedZoomRef.current = null;
      lastSmoothedPanRef.current = null;

      setLastTouchDistance(null);
      setLastTouchCenter(null);
      setTouchStart(null);
      setIsPanning(false);
      isPanningRef.current = false;

      if (pendingPanRef.current) {
        panRef.current = pendingPanRef.current;
        setPan(pendingPanRef.current);
        pendingPanRef.current = null;
      }

      // Momentum / inertia for single-finger pan
      const vel = touchVelocityRef.current;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed > MOMENTUM_THRESHOLD && svgContentGroupRef.current) {
        const g = svgContentGroupRef.current;
        g.style.willChange = 'transform';
        let mVelX = vel.x;
        let mVelY = vel.y;
        let mPanX = panRef.current.x;
        let mPanY = panRef.current.y;
        const animateMomentum = () => {
          mVelX *= MOMENTUM_DECAY;
          mVelY *= MOMENTUM_DECAY;
          mPanX += mVelX;
          mPanY += mVelY;
          g.style.transform = `translate3d(${mPanX}px, ${mPanY}px, 0px) scale(${zoomRef.current})`;
          panRef.current = { x: mPanX, y: mPanY };
          const remainingSpeed = Math.sqrt(mVelX * mVelX + mVelY * mVelY);
          if (remainingSpeed > MOMENTUM_MIN_SPEED) {
            touchMomentumFrameRef.current = requestAnimationFrame(animateMomentum);
          } else {
            touchMomentumFrameRef.current = null;
            setPan({ x: mPanX, y: mPanY });
            g.style.willChange = '';
          }
        };
        touchMomentumFrameRef.current = requestAnimationFrame(animateMomentum);
      }
      touchVelocityRef.current = { x: 0, y: 0 };
      lastTouchMoveTimeRef.current = 0;
      lastTouchMovePosRef.current = null;

      if (svgContentGroupRef.current && speed <= MOMENTUM_THRESHOLD) {
        svgContentGroupRef.current.style.willChange = '';
      }
    } else if (touchesLength === 1) {
      // Cancel momentum if a new touch starts
      if (touchMomentumFrameRef.current) {
        cancelAnimationFrame(touchMomentumFrameRef.current);
        touchMomentumFrameRef.current = null;
      }

      const touch = (e as ReactTouchEvent).touches[0];
      setIsPanning(true);
      isPanningRef.current = true;
      const currentPan = panRef.current;
      const ps = { x: touch.clientX - currentPan.x, y: touch.clientY - currentPan.y };
      setPanStart(ps);
      panStartRef.current = ps;
      setLastTouchDistance(null);
      setLastTouchCenter(null);
      lastSmoothedZoomRef.current = null;
      lastSmoothedPanRef.current = null;

      // Reset velocity tracking for fresh start
      touchVelocityRef.current = { x: 0, y: 0 };
      lastTouchMoveTimeRef.current = Date.now();
      lastTouchMovePosRef.current = { x: touch.clientX, y: touch.clientY };
    }
  }, [longPressTimer]);

  React.useEffect(() => {
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
          setDeviceTooltip(null);
          setPortTooltip(null);
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
          }
        }
      }

      if (isTouchDraggingRef.current) {
        if (e.cancelable) e.preventDefault();
        const currentZoom = zoomRef.current;
        const currentTouchDragStartPos = touchDragStartPosRef.current;

        if (!currentTouchDragStartPos) return;
        const dx = (touch.clientX - currentTouchDragStartPos.x) / currentZoom;
        const dy = (touch.clientY - currentTouchDragStartPos.y) / currentZoom;
        const initialPositions = dragStartDevicePositionsRef.current;
        const canvasDims = getCanvasDimensions();

        if (!dragAnimationFrameRef.current) {
          dragAnimationFrameRef.current = requestAnimationFrame(() => {
            const touchNewPositions = new Map<string, { x: number; y: number }>();
            const initialKeys = Object.keys(initialPositions);
            for (let ti = 0; ti < initialKeys.length; ti++) {
              const id = initialKeys[ti];
              const init = initialPositions[id];
              if (!init) continue;
              const clampedX = Math.max(50, Math.min(init.x + dx, canvasDims.width - 120));
              const clampedY = Math.max(50, Math.min(init.y + dy, canvasDims.height - 150));
              touchNewPositions.set(id, { x: clampedX, y: clampedY });
              const touchOuterG = document.querySelector('[data-device-id="' + id + '"]');
              if (touchOuterG) {
                touchOuterG.setAttribute('transform', 'translate(' + clampedX + ', ' + clampedY + ')');
              }
            }
            liveDeviceDragPositionsRef.current = touchNewPositions;
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
        const device = latestDevicesRef.current.find(d => d.id === currentTouchDraggedDevice.id);
        if (device) {
          // Keep multi-selection if device was already selected
          const currentSelected = selectedDeviceIdsRef.current;
          if (currentSelected.length > 1 && currentSelected.includes(device.id)) {
            // already set, keep as-is
          } else {
            setSelectedDeviceIds([device.id]);
          }
          onDeviceSelect(device.type, device.id, isSwitchDeviceType(device.type) ? device.switchModel : undefined, device.name);
        }
      }

      // PERFORMANCE: Sync touch drag positions back to Zustand state
      const touchFinalPositions = liveDeviceDragPositionsRef.current;
      const touchFinalDeviceIds = [...touchFinalPositions.keys()];
      if (touchFinalPositions.size > 0) {
        setDevices(prev => {
          const newDevices = [...prev];
          let changed = false;
          touchFinalPositions.forEach((pos, id) => {
            const idx = newDevices.findIndex(d => d.id === id);
            if (idx !== -1) {
              if (Math.abs(newDevices[idx].x - pos.x) > 0.1 || Math.abs(newDevices[idx].y - pos.y) > 0.1) {
                newDevices[idx] = { ...newDevices[idx], x: pos.x, y: pos.y };
                changed = true;
              }
            }
          });
          return changed ? newDevices : prev;
        });
        touchFinalPositions.clear();
      }

      // Remove GPU will-change hints from touch-dragged devices
      for (let wi = 0; wi < touchFinalDeviceIds.length; wi++) {
        const we = document.querySelector('[data-device-id="' + touchFinalDeviceIds[wi] + '"]') as SVGGElement | null;
        if (we) {
          we.style.willChange = '';
        }
      }

      setTouchDraggedDevice(null);
      touchDraggedDeviceRef.current = null;
      setTouchDragStartPos(null);
      touchDragStartPosRef.current = null;

      // Touch sürükleme olduysa ve kablo çizimi başlamışsa iptal et
      if (currentIsTouchDragging && isDrawingConnectionRef.current) {
        setIsDrawingConnection(false);
        setConnectionStart(null);
      }

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
      if (touchMomentumFrameRef.current) {
        cancelAnimationFrame(touchMomentumFrameRef.current);
        touchMomentumFrameRef.current = null;
      }
    };
  }, [longPressTimer]);

  return {
    handleDeviceTouchStart,
    handleDeviceTouchMove,
    handleDeviceTouchEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    isTouchDragging,
    touchDraggedDevice,
    touchMomentumFrameRef,
  };
}
