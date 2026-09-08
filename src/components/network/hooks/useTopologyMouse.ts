import { useEffect, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { CanvasDevice, CanvasConnection, ContextMenuState, ContextMenuMode, DeviceType } from '../networkTopology.types';
import { areArraysEqual } from '@/lib/network/equality';
import {
  VIRTUAL_CANVAS_WIDTH_DESKTOP,
  VIRTUAL_CANVAS_HEIGHT_DESKTOP,
  DRAG_THRESHOLD,
  MOMENTUM_THRESHOLD,
  MOMENTUM_DECAY,
  MOMENTUM_MIN_SPEED
} from '../networkTopology.constants';
import { isSwitchDeviceType } from '../networkTopology.helpers';

export interface UseTopologyMouseProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  canvasRectRef: React.MutableRefObject<DOMRect | null>;
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  zoomRef: React.MutableRefObject<number>;
  mousePosRef: React.MutableRefObject<{ x: number; y: number }>;
  isPanningRef: React.MutableRefObject<boolean>;
  lastMouseMoveTimeRef: React.MutableRefObject<number>;
  lastMouseMovePosRef: React.MutableRefObject<{ x: number; y: number }>;
  velocityRef: React.MutableRefObject<{ x: number; y: number }>;
  panAnimationFrameRef: React.MutableRefObject<number | null>;
  panStartRef: React.MutableRefObject<{ x: number; y: number }>;
  svgContentGroupRef: React.RefObject<SVGGElement | null>;
  pendingPanRef: React.MutableRefObject<{ x: number; y: number } | null>;
  isSelectingRef: React.MutableRefObject<boolean>;
  selectionBoxRef: React.MutableRefObject<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>;
  selectionAdditiveRef: React.MutableRefObject<boolean>;
  selectionBaseIdsRef: React.MutableRefObject<string[]>;
  selectedDeviceIdsRef: React.MutableRefObject<string[]>;
  selectionAnimationFrameRef: React.MutableRefObject<number | null>;
  draggedDeviceRef: React.MutableRefObject<string | null>;
  dragStartPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  isActuallyDraggingRef: React.MutableRefObject<boolean>;
  wasDraggingRef: React.MutableRefObject<boolean>;
  lastDragEventRef: React.MutableRefObject<{ clientX: number, clientY: number, ctrlKey: boolean } | null>;
  dragStartDevicePositionsRef: React.MutableRefObject<{ [key: string]: { x: number; y: number } }>;
  snapToGridRef: React.MutableRefObject<boolean>;
  liveDeviceDragPositionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  isDrawingConnectionRef: React.MutableRefObject<boolean>;
  activePointerDragRef: React.MutableRefObject<boolean>;
  activeDragPointerIdRef: React.MutableRefObject<number | null>;
  latestDevicesRef: React.MutableRefObject<CanvasDevice[]>;
  latestConnectionsRef: React.MutableRefObject<CanvasConnection[]>;
  getPortPositionRef: React.MutableRefObject<(device: CanvasDevice, portId: string) => { x: number; y: number }>;
  connectionMetaRef: React.MutableRefObject<Map<string, { index: number; total: number }>>;
  lastDragPositionRef: React.MutableRefObject<{ x: number, y: number } | null>;

  dragAnimationFrameRef: React.MutableRefObject<number | null>;
  mousePosAnimationFrameRef: React.MutableRefObject<number | null>;
  momentumAnimationFrameRef: React.MutableRefObject<number | null>;

  setMousePos: (pos: { x: number; y: number }) => void;
  setDevices: React.Dispatch<React.SetStateAction<CanvasDevice[]>>;
  setIsPanning: (panning: boolean) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setIsSelecting: (selecting: boolean) => void;
  setSelectionBox: (box: { start: { x: number; y: number }; current: { x: number; y: number } } | null) => void;
  setSelectedDeviceIds: (ids: string[]) => void;
  setIsActuallyDragging: (dragging: boolean) => void;
  setDraggedDevice: (id: string | null) => void;
  setIsDrawingConnection: (drawing: boolean) => void;
  setConnectionStart: (start: { deviceId: string; portId: string; point: { x: number; y: number } } | null) => void;
  setDeviceTooltip: (tooltip: { deviceId: string; x: number; y: number; visible: boolean } | null) => void;
  setPortTooltip: (tooltip: { deviceId: string; portId: string; x: number; y: number; visible: boolean } | null) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  setSelectAllMode: (mode: boolean) => void;
  setPingMode: (mode: boolean) => void;
  setPingSource: (source: CanvasDevice | null) => void;
  setPingResult: (result: { success: boolean; message: string } | null) => void;
  setPanStart: (start: { x: number; y: number }) => void;
  setSelectedNoteIds: (ids: string[]) => void;
  mergeSelectionIds: (ids: string[]) => string[];

  getDeviceIdsInSelectionBox: (box: { start: { x: number; y: number }; current: { x: number; y: number } }) => string[];
  openContextMenu: (x: number, y: number, id: string | null, mode?: ContextMenuMode) => void;
  cancelConnectionDrawing: () => void;
  onDeviceSelect: (type: DeviceType, id: string, model?: string, name?: string) => void;

  pingMode: boolean;
  pingSource: CanvasDevice | null;
  language?: string;
}

export function useTopologyMouse(props: UseTopologyMouseProps) {
  const {
    language = 'tr',
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
  } = props;

  const handleCanvasMouseDown = useCallback((e: ReactMouseEvent) => {
    const targetEl = e.target as HTMLElement;
    const isOnDevice = !!targetEl.closest('[data-device-id]');
    const isOnNote = !!targetEl.closest('[data-note-id]');
    // Note headers own the drag gesture. Never start canvas panning for the
    // same pointer-down, even if the event reaches the canvas layer.
    const isOnNoteHeader = !!targetEl.closest('[data-note-header]');
    const isOnEditable = targetEl.tagName === 'TEXTAREA' || targetEl.tagName === 'INPUT' || targetEl.isContentEditable;

    if (isOnNoteHeader || isOnNote) return;

    if (e.button === 0 && !isOnDevice && !isOnEditable) {
      e.preventDefault();

      setSelectedDeviceIds([]);
      setSelectedNoteIds([]);
      setSelectAllMode(false);
      if (pingMode || pingSource) {
        setPingMode(false);
        setPingSource(null);
        setPingResult(null);
      }
      cancelConnectionDrawing();

      const currentPan = panRef.current;
      const ps = { x: e.clientX - currentPan.x, y: e.clientY - currentPan.y };
      setPanStart(ps);
      panStartRef.current = ps;
      setIsPanning(true);
      isPanningRef.current = true;
      if (svgContentGroupRef.current) {
        svgContentGroupRef.current.style.willChange = 'transform';
        svgContentGroupRef.current.style.transition = 'none';
      }
      setContextMenu(null);
      return;
    } else if (e.button === 1 && !isOnEditable) {
      e.preventDefault();
      e.stopPropagation();
      if (pingMode) {
        setPingMode(false);
        setPingSource(null);
        setPingResult(null);
        return;
      }

      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const startX = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
        const startY = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;

        const box = { start: { x: startX, y: startY }, current: { x: startX, y: startY } };
        selectionAdditiveRef.current = e.shiftKey;
        selectionBaseIdsRef.current = e.shiftKey ? selectedDeviceIdsRef.current : [];
        setSelectionBox(box);
        selectionBoxRef.current = box;
        setIsSelecting(true);
        isSelectingRef.current = true;

        document.body.style.cursor = 'crosshair';
        canvasRef.current?.focus();
      }

      setContextMenu(null);
      setSelectAllMode(false);
    }
  }, [
    openContextMenu, pingMode, cancelConnectionDrawing, pingSource,
    panRef, zoomRef, setPanStart, panStartRef, setIsPanning, isPanningRef,
    svgContentGroupRef, setContextMenu, setSelectedDeviceIds, setSelectedNoteIds,
    setSelectAllMode, setPingMode, setPingSource, setPingResult, selectionAdditiveRef,
    selectionBaseIdsRef, selectedDeviceIdsRef, setSelectionBox, selectionBoxRef,
    setIsSelecting, isSelectingRef, canvasRef
  ]);

  useEffect(() => {
    const CANVAS_W_D = VIRTUAL_CANVAS_WIDTH_DESKTOP;
    const CANVAS_H_D = VIRTUAL_CANVAS_HEIGHT_DESKTOP;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (canvasRef.current) {
        const rect = canvasRectRef.current ?? canvasRef.current.getBoundingClientRect();
        const currentPan = panRef.current;
        const currentZoom = zoomRef.current;
        mousePosRef.current = {
          x: (e.clientX - rect.left - currentPan.x) / currentZoom,
          y: (e.clientY - rect.top - currentPan.y) / currentZoom,
        };
      }

      if (isPanningRef.current) {
        const now = Date.now();
        const dt = now - lastMouseMoveTimeRef.current;
        if (dt > 0) {
          const dx = e.clientX - lastMouseMovePosRef.current.x;
          const dy = e.clientY - lastMouseMovePosRef.current.y;
          velocityRef.current = {
            x: velocityRef.current.x * 0.2 + (dx / dt) * 0.8,
            y: velocityRef.current.y * 0.2 + (dy / dt) * 0.8,
          };
        }
        lastMouseMoveTimeRef.current = now;
        lastMouseMovePosRef.current = { x: e.clientX, y: e.clientY };

        const capturedX = e.clientX;
        const capturedY = e.clientY;
        if (panAnimationFrameRef.current !== null) {
          cancelAnimationFrame(panAnimationFrameRef.current);
        }
        panAnimationFrameRef.current = requestAnimationFrame(() => {
          const newPanX = capturedX - panStartRef.current.x;
          const newPanY = capturedY - panStartRef.current.y;
          const g = svgContentGroupRef.current;
          if (g) {
            g.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0px) scale(${zoomRef.current})`;
          }
          pendingPanRef.current = { x: newPanX, y: newPanY };
          panRef.current = { x: newPanX, y: newPanY };
          panAnimationFrameRef.current = null;
        });
      } else if (isSelectingRef.current && canvasRef.current) {
        const rect = canvasRectRef.current ?? canvasRef.current.getBoundingClientRect();
        const currentX = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
        const currentY = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;

        const currentBox = selectionBoxRef.current;
        if (currentBox) {
          const newBox = { ...currentBox, current: { x: currentX, y: currentY } };
          selectionBoxRef.current = newBox;

          const selectedIds = mergeSelectionIds(getDeviceIdsInSelectionBox(newBox));

          if (!areArraysEqual(selectedIds, selectedDeviceIdsRef.current)) {
            selectedDeviceIdsRef.current = selectedIds;
          }

          const rectEl = document.getElementById('selection-rectangle');
          if (rectEl) {
            const rx = Math.min(newBox.start.x, newBox.current.x);
            const ry = Math.min(newBox.start.y, newBox.current.y);
            const rw = Math.abs(newBox.current.x - newBox.start.x);
            const rh = Math.abs(newBox.current.y - newBox.start.y);
            rectEl.setAttribute('x', rx.toString());
            rectEl.setAttribute('y', ry.toString());
            rectEl.setAttribute('width', rw.toString());
            rectEl.setAttribute('height', rh.toString());
          }

          const counterEl = document.getElementById('selection-counter');
          if (counterEl) {
            if (selectedIds.length > 0) {
              const deviceLabel = language === 'tr' ? 'Cihaz' : (selectedIds.length === 1 ? 'device' : 'devices');
              counterEl.textContent = `${selectedIds.length} ${deviceLabel}`;
              counterEl.setAttribute('x', (Math.min(newBox.start.x, newBox.current.x) + 10).toString());
              counterEl.setAttribute('y', (Math.min(newBox.start.y, newBox.current.y) - 10).toString());
            } else {
              counterEl.textContent = '';
            }
          }

          if (selectionAnimationFrameRef.current === null) {
            selectionAnimationFrameRef.current = requestAnimationFrame(() => {
              setSelectedDeviceIds(selectedDeviceIdsRef.current);
              selectionAnimationFrameRef.current = null;
            });
          }
        }
      } else if (draggedDeviceRef.current && canvasRef.current) {
        const dsp = dragStartPosRef.current;
        if (dsp) {
          const dx2 = e.clientX - dsp.x;
          const dy2 = e.clientY - dsp.y;
          const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (dist > DRAG_THRESHOLD) {
            if (!isActuallyDraggingRef.current) {
              setIsActuallyDragging(true);
              isActuallyDraggingRef.current = true;
              setDeviceTooltip(null);
              setPortTooltip(null);
              document.body.style.cursor = 'grabbing';
              const currentDragged = draggedDeviceRef.current;
              if (!currentDragged) return;
              const dragIds = selectedDeviceIdsRef.current.includes(currentDragged)
                ? selectedDeviceIdsRef.current
                : [currentDragged];
              for (let wi = 0; wi < dragIds.length; wi++) {
                const we = document.querySelector('[data-device-id="' + dragIds[wi] + '"]') as SVGGElement | null;
                if (we) {
                  we.style.willChange = 'transform';
                  const ichild = we.querySelector('g');
                  if (ichild) ichild.style.willChange = 'transform';
                }
              }
            }
            wasDraggingRef.current = true;
          }
        }

        if (isActuallyDraggingRef.current) {
          if (dragAnimationFrameRef.current !== null) return;

          const clientX = e.clientX;
          const clientY = e.clientY;
          const ctrlKey = e.ctrlKey;
          lastDragEventRef.current = { clientX, clientY, ctrlKey };

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
            // Connection updates can touch many links. Avoid scanning the full
            // device array once per endpoint and frame while dragging.
            const devicesById = new Map(latestDevicesRef.current.map(device => [device.id, device]));

            const devicesToMove = currentSelectedIds.includes(currentDraggedDevice)
              ? currentSelectedIds
              : [currentDraggedDevice];

            const newPositions = new Map<string, { x: number; y: number }>();
            const doSnap = currentSnapToGrid && ctrlKey;

            devicesToMove.forEach(id => {
              const initialPos = currentStartPositions[id];
              if (!initialPos) return;
              let newX = initialPos.x + dx;
              let newY = initialPos.y + dy;
              if (doSnap) {
                newX = Math.round(newX / 16) * 16;
                newY = Math.round(newY / 16) * 16;
              }
              const clampedX = Math.max(20, Math.min(newX, canvasW - 100));
              const clampedY = Math.max(20, Math.min(newY, canvasH - 100));
              newPositions.set(id, { x: clampedX, y: clampedY });

              const outerG = document.querySelector('[data-device-id="' + id + '"]');
              if (outerG) {
                outerG.setAttribute('transform', 'translate(' + clampedX + ', ' + clampedY + ')');
              }
            });

            if (newPositions.size > 0) {
              const movedSet = new Set(devicesToMove);
              const liveConns = latestConnectionsRef.current;
              for (let ci = 0; ci < liveConns.length; ci++) {
                const conn = liveConns[ci];
                if (!movedSet.has(conn.sourceDeviceId) && !movedSet.has(conn.targetDeviceId)) continue;

                const srcDev = devicesById.get(conn.sourceDeviceId);
                const tgtDev = devicesById.get(conn.targetDeviceId);
                if (!srcDev || !tgtDev) continue;

                const sp = newPositions.get(conn.sourceDeviceId) || { x: srcDev.x, y: srcDev.y };
                const tp = newPositions.get(conn.targetDeviceId) || { x: tgtDev.x, y: tgtDev.y };

                const srcPort = getPortPositionRef.current(
                  Object.assign({}, srcDev, { x: sp.x, y: sp.y }),
                  conn.sourcePort
                );
                const tgtPort = getPortPositionRef.current(
                  Object.assign({}, tgtDev, { x: tp.x, y: tp.y }),
                  conn.targetPort
                );

                const isWireless = conn.cableType === 'wireless';
                const midX = (srcPort.x + tgtPort.x) / 2;
                const meta = connectionMetaRef.current.get(conn.id) || { index: 0, total: 1 };
                const sameConnIndex = meta.index;
                const totalSameConns = meta.total;
                const maxOffset = 20;
                const offset = totalSameConns > 1
                  ? (sameConnIndex - (totalSameConns - 1) / 2) * (maxOffset / Math.max(totalSameConns - 1, 1))
                  : 0;

                const dxVal = tgtPort.x - srcPort.x;
                const dyVal = tgtPort.y - srcPort.y;
                const len = Math.sqrt(dxVal * dxVal + dyVal * dyVal) || 1;
                const perpX = -dyVal / len * offset;
                const perpY = dxVal / len * offset;

                const controlPoint1 = {
                  x: midX + perpX,
                  y: srcPort.y + perpY + Math.abs(offset) * 0.5
                };
                const controlPoint2 = {
                  x: midX + perpX,
                  y: tgtPort.y + perpY - Math.abs(offset) * 0.5
                };

                const buildWavePath = (sx: number, sy: number, tx: number, ty: number) => {
                  const dx = tx - sx;
                  const dy = ty - sy;
                  const length = Math.sqrt(dx * dx + dy * dy) || 1;
                  const ux = dx / length;
                  const uy = dy / length;
                  const px = -uy;
                  const py = ux;
                  const waveCount = Math.max(3, Math.round(length / 28));
                  const amplitude = 8;
                  const points = [`M ${sx} ${sy}`];
                  for (let i = 0; i < waveCount; i++) {
                    const t1 = (i + 0.5) / waveCount;
                    const t2 = (i + 1) / waveCount;
                    const mx = sx + ux * length * t1 + px * amplitude * (i % 2 === 0 ? 1 : -1);
                    const my = sy + uy * length * t1 + py * amplitude * (i % 2 === 0 ? 1 : -1);
                    const ex = sx + ux * length * t2;
                    const ey = sy + uy * length * t2;
                    points.push(`Q ${mx} ${my} ${ex} ${ey}`);
                  }
                  return points.join(' ');
                };

                const pathD = isWireless
                  ? buildWavePath(srcPort.x, srcPort.y, tgtPort.x, tgtPort.y)
                  : `M ${srcPort.x} ${srcPort.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${tgtPort.x} ${tgtPort.y}`;

                const connEl = document.querySelector('[data-connection-id="' + conn.id + '"]');
                if (connEl) {
                  const pathNodes = connEl.querySelectorAll('path');
                  for (let pi2 = 0; pi2 < pathNodes.length; pi2++) {
                    pathNodes[pi2].setAttribute('d', pathD);
                  }

                  const bezierPoint = (tVal: number) => {
                    if (isWireless) {
                      return { x: srcPort.x + (tgtPort.x - srcPort.x) * tVal, y: srcPort.y + (tgtPort.y - srcPort.y) * tVal };
                    }
                    const mt = 1 - tVal;
                    return {
                      x: mt * mt * mt * srcPort.x + 3 * mt * mt * tVal * controlPoint1.x + 3 * mt * tVal * tVal * controlPoint2.x + tVal * tVal * tVal * tgtPort.x,
                      y: mt * mt * mt * srcPort.y + 3 * mt * mt * tVal * controlPoint1.y + 3 * mt * tVal * tVal * controlPoint2.y + tVal * tVal * tVal * tgtPort.y
                    };
                  };

                  const srcPos = bezierPoint(0.42);
                  const tgtPos = bezierPoint(0.58);
                  const srcLabel = { x: srcPos.x + perpX, y: srcPos.y + perpY };
                  const tgtLabel = { x: tgtPos.x + perpX, y: tgtPos.y + perpY };
                  const labelOffsetY = -10;

                  const textNodes = connEl.querySelectorAll('text');
                  if (textNodes.length >= 4) {
                    textNodes[0].setAttribute('x', String(srcLabel.x));
                    textNodes[0].setAttribute('y', String(srcLabel.y + labelOffsetY));
                    textNodes[1].setAttribute('x', String(srcLabel.x));
                    textNodes[1].setAttribute('y', String(srcLabel.y + labelOffsetY));
                    textNodes[2].setAttribute('x', String(tgtLabel.x));
                    textNodes[2].setAttribute('y', String(tgtLabel.y + labelOffsetY));
                    textNodes[3].setAttribute('x', String(tgtLabel.x));
                    textNodes[3].setAttribute('y', String(tgtLabel.y + labelOffsetY));
                  }
                }

                const tTrash = 0.5;
                const invT = 1 - tTrash;
                const trashX =
                  invT * invT * invT * srcPort.x +
                  3 * invT * invT * tTrash * controlPoint1.x +
                  3 * invT * tTrash * tTrash * controlPoint2.x +
                  tTrash * tTrash * tTrash * tgtPort.x;
                const trashY =
                  invT * invT * invT * srcPort.y +
                  3 * invT * invT * tTrash * controlPoint1.y +
                  3 * invT * tTrash * tTrash * controlPoint2.y +
                  tTrash * tTrash * tTrash * tgtPort.y;

                const handleEl = document.querySelector('[data-connection-handle-id="' + conn.id + '"]');
                if (handleEl) {
                  const innerG = handleEl.querySelector('[data-handle-inner="true"]');
                  if (innerG) {
                    innerG.setAttribute('transform', 'translate(' + trashX + ', ' + trashY + ')');
                  }
                }
              }
            }

            // The SVG nodes and connection paths are updated directly above for
            // every frame. Committing the whole device array here would make
            // React reconcile the entire topology at 60fps and can overwrite
            // those DOM writes. Keep the live positions in the ref and commit
            // them once in handleMouseUp instead.
            liveDeviceDragPositionsRef.current = newPositions;
            dragAnimationFrameRef.current = null;
          });
        }
      } else if (isDrawingConnectionRef.current && canvasRef.current) {
        if (mousePosAnimationFrameRef.current !== null) return;

        mousePosAnimationFrameRef.current = requestAnimationFrame(() => {
          const rect = canvasRectRef.current ?? canvasRef.current?.getBoundingClientRect();
          if (!rect) {
            mousePosAnimationFrameRef.current = null;
            return;
          }

          const currentPan = panRef.current;
          const currentZoom = zoomRef.current;
          const newPos = {
            x: (e.clientX - rect.left - currentPan.x) / currentZoom,
            y: (e.clientY - rect.top - currentPan.y) / currentZoom,
          };
          mousePosRef.current = newPos;
          setMousePos(newPos);
          mousePosAnimationFrameRef.current = null;
        });
      }
    };

    const handleMouseUp = (e: globalThis.MouseEvent) => {
      activePointerDragRef.current = false;
      activeDragPointerIdRef.current = null;

      if (draggedDeviceRef.current && canvasRef.current && dragStartPosRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const currentPan = panRef.current;
        const currentZoom = zoomRef.current;
        const currentDragStartPos = dragStartPosRef.current;
        const currentDraggedDevice = draggedDeviceRef.current;
        const currentSelectedIds = selectedDeviceIdsRef.current;
        const currentStartPositions = dragStartDevicePositionsRef.current;
        const lastDragEvent = lastDragEventRef.current ?? { clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey };
        const mouseX = (lastDragEvent.clientX - rect.left - currentPan.x) / currentZoom;
        const mouseY = (lastDragEvent.clientY - rect.top - currentPan.y) / currentZoom;
        const startMouseX = (currentDragStartPos.x - rect.left - currentPan.x) / currentZoom;
        const startMouseY = (currentDragStartPos.y - rect.top - currentPan.y) / currentZoom;
        const dx = mouseX - startMouseX;
        const dy = mouseY - startMouseY;
        const devicesToMove = currentSelectedIds.includes(currentDraggedDevice)
          ? currentSelectedIds
          : [currentDraggedDevice];
        const finalPositions = new Map<string, { x: number; y: number }>();
        const doSnap = snapToGridRef.current && lastDragEvent.ctrlKey;

        devicesToMove.forEach(id => {
          const initialPos = currentStartPositions[id];
          if (!initialPos) return;
          let newX = initialPos.x + dx;
          let newY = initialPos.y + dy;
          if (doSnap) {
            newX = Math.round(newX / 16) * 16;
            newY = Math.round(newY / 16) * 16;
          }
          finalPositions.set(id, {
            x: Math.max(20, Math.min(newX, VIRTUAL_CANVAS_WIDTH_DESKTOP - 100)),
            y: Math.max(20, Math.min(newY, VIRTUAL_CANVAS_HEIGHT_DESKTOP - 100)),
          });
        });

        if (finalPositions.size > 0) {
          liveDeviceDragPositionsRef.current = finalPositions;
        }
      }

      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }
      if (panAnimationFrameRef.current) {
        cancelAnimationFrame(panAnimationFrameRef.current);
        panAnimationFrameRef.current = null;
      }
      if (mousePosAnimationFrameRef.current) {
        cancelAnimationFrame(mousePosAnimationFrameRef.current);
        mousePosAnimationFrameRef.current = null;
      }
      if (momentumAnimationFrameRef.current) {
        cancelAnimationFrame(momentumAnimationFrameRef.current);
        momentumAnimationFrameRef.current = null;
      }
      if (selectionAnimationFrameRef.current) {
        cancelAnimationFrame(selectionAnimationFrameRef.current);
        selectionAnimationFrameRef.current = null;
      }

      if (isSelectingRef.current && selectionBoxRef.current) {
        const box = selectionBoxRef.current;
        const boxSelectedIds = getDeviceIdsInSelectionBox(box);
        const selectedIds = mergeSelectionIds(boxSelectedIds);

        if (boxSelectedIds.length > 0 || selectionAdditiveRef.current) {
          setSelectedDeviceIds(selectedIds);
          selectedDeviceIdsRef.current = selectedIds;

          const firstDevice = latestDevicesRef.current.find(d => d.id === selectedIds[0]);
          if (firstDevice) {
            onDeviceSelect(firstDevice.type, firstDevice.id, isSwitchDeviceType(firstDevice.type) ? firstDevice.switchModel : undefined, firstDevice.name);
          }
        } else {
          const dragDistance = Math.sqrt(
            Math.pow(box.current.x - box.start.x, 2) +
            Math.pow(box.current.y - box.start.y, 2)
          );

          if (dragDistance > 10) {
            setSelectedDeviceIds([]);
            selectedDeviceIdsRef.current = [];
          }
        }

        setIsSelecting(false);
        isSelectingRef.current = false;
        setSelectionBox(null);
        selectionBoxRef.current = null;
        selectionAdditiveRef.current = false;
        selectionBaseIdsRef.current = [];

        document.body.style.cursor = '';
      }

      if (document.body.style.cursor === 'copy') {
        document.body.style.cursor = '';
      }

      if (!isPanningRef.current && !isActuallyDraggingRef.current && !wasDraggingRef.current) {
        const targetEl = e.target as HTMLElement;
        const isOnDevice = !!targetEl.closest?.('[data-device-id]');
        const isOnNote = !!targetEl.closest?.('[data-note-id]');
        const isOnMenu = !!targetEl.closest?.('.context-menu') || !!targetEl.closest?.('.palette') || !!targetEl.closest?.('.modal') || !!targetEl.closest?.('.selection-toolbar');

        if (!isOnDevice && !isOnNote && !isOnMenu) {
          setSelectedDeviceIds([]);
          selectedDeviceIdsRef.current = [];
          // onDeviceSelect is intentionally not called here — clearing selection is handled by setSelectedDeviceIds([]).
          setSelectedNoteIds([]);
          setPingMode(false);
          setPingSource(null);
          setPingResult(null);
          setIsDrawingConnection(false);
          setConnectionStart(null);
          setContextMenu(null);
        }
      }

      setIsPanning(false);
      isPanningRef.current = false;
      if (pendingPanRef.current) {
        panRef.current = pendingPanRef.current;
        setPan(pendingPanRef.current);
        pendingPanRef.current = null;
      }

      if (!isActuallyDraggingRef.current && !document.body.classList.contains('graphics-low')) {
        const vel = velocityRef.current;
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
              momentumAnimationFrameRef.current = requestAnimationFrame(animateMomentum);
            } else {
              momentumAnimationFrameRef.current = null;
              setPan({ x: mPanX, y: mPanY });
              g.style.willChange = '';
            }
          };
          momentumAnimationFrameRef.current = requestAnimationFrame(animateMomentum);
        }
      }
      velocityRef.current = { x: 0, y: 0 };

      if (!momentumAnimationFrameRef.current && svgContentGroupRef.current) {
        svgContentGroupRef.current.style.willChange = '';
      }

      const finalDragPositions = liveDeviceDragPositionsRef.current;
      const finalDragDeviceIds = [...finalDragPositions.keys()];
      if (finalDragPositions.size > 0) {
        setDevices(prev => {
          const newDevices = [...prev];
          let changed = false;
          finalDragPositions.forEach((pos, id) => {
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
        finalDragPositions.clear();
      }

      for (let wi = 0; wi < finalDragDeviceIds.length; wi++) {
        const we = document.querySelector('[data-device-id="' + finalDragDeviceIds[wi] + '"]') as SVGGElement | null;
        if (we) {
          we.style.willChange = '';
        }
      }

      setDraggedDevice(null);
      draggedDeviceRef.current = null;
      dragStartPosRef.current = null;
      lastDragEventRef.current = null;

      if (isActuallyDraggingRef.current && isDrawingConnectionRef.current) {
        setIsDrawingConnection(false);
        setConnectionStart(null);
      }

      setIsActuallyDragging(false);
      isActuallyDraggingRef.current = false;
      lastDragPositionRef.current = null;

      document.body.style.cursor = '';
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && activeDragPointerIdRef.current === e.pointerId) {
        handleMouseMove(e as unknown as globalThis.MouseEvent);
      }
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && activeDragPointerIdRef.current === e.pointerId) {
        handleMouseUp(e as unknown as globalThis.MouseEvent);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      if (dragAnimationFrameRef.current) cancelAnimationFrame(dragAnimationFrameRef.current);
      if (panAnimationFrameRef.current) cancelAnimationFrame(panAnimationFrameRef.current);
      if (mousePosAnimationFrameRef.current) cancelAnimationFrame(mousePosAnimationFrameRef.current);
      if (momentumAnimationFrameRef.current) cancelAnimationFrame(momentumAnimationFrameRef.current);
      if (selectionAnimationFrameRef.current) cancelAnimationFrame(selectionAnimationFrameRef.current);
    };
  }, []);

  return { handleCanvasMouseDown };
}
