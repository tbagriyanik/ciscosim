'use client';

import { useCallback } from 'react';
import type { CanvasDevice } from '../networkTopology.types';

interface UseTopologyCanvasDragParams {
  zoomRef: React.MutableRefObject<number>;
  draggedDeviceRef: React.MutableRefObject<string | null>;
  dragStartPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  dragStartDevicePositionsRef: React.MutableRefObject<{ [key: string]: { x: number; y: number } }>;
  isActuallyDraggingRef: React.MutableRefObject<boolean>;
  setIsActuallyDragging: (dragging: boolean) => void;
  onTopologyChange?: (devices: CanvasDevice[]) => void;
}

export function useTopologyCanvasDrag({
  zoomRef,
  draggedDeviceRef,
  dragStartPosRef,
  dragStartDevicePositionsRef,
  isActuallyDraggingRef,
  setIsActuallyDragging,
  onTopologyChange,
}: UseTopologyCanvasDragParams) {

  const handleDeviceDragMove = useCallback((
    e: MouseEvent | TouchEvent,
    _devices: CanvasDevice[],
    setDevices: React.Dispatch<React.SetStateAction<CanvasDevice[]>>
  ) => {
    if (!draggedDeviceRef.current || !dragStartPosRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = (clientX - dragStartPosRef.current.x) / zoomRef.current;
    const dy = (clientY - dragStartPosRef.current.y) / zoomRef.current;

    if (!isActuallyDraggingRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      isActuallyDraggingRef.current = true;
      setIsActuallyDragging(true);
    }

    if (!isActuallyDraggingRef.current) return;

    setDevices(prevDevices => {
      const nextDevices = prevDevices.map(dev => {
        const startPos = dragStartDevicePositionsRef.current[dev.id];
        if (!startPos) return dev;
        return {
          ...dev,
          x: Math.max(0, Math.round(startPos.x + dx)),
          y: Math.max(0, Math.round(startPos.y + dy)),
        };
      });
      if (onTopologyChange) onTopologyChange(nextDevices);
      return nextDevices;
    });
  }, [draggedDeviceRef, dragStartPosRef, zoomRef, isActuallyDraggingRef, setIsActuallyDragging, dragStartDevicePositionsRef, onTopologyChange]);

  const handleDeviceDragEnd = useCallback(() => {
    draggedDeviceRef.current = null;
    dragStartPosRef.current = null;
    dragStartDevicePositionsRef.current = {};
    setIsActuallyDragging(false);
    isActuallyDraggingRef.current = false;
  }, [draggedDeviceRef, dragStartPosRef, dragStartDevicePositionsRef, setIsActuallyDragging, isActuallyDraggingRef]);

  return {
    handleDeviceDragMove,
    handleDeviceDragEnd,
  };
}
