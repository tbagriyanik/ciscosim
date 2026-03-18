import { useRef, useCallback, useState, useEffect } from 'react';

/**
 * Topoloji canvas etkileşimlerini yönetmek için custom hook.
 * Görsel pan, zoom ve drag işlemlerini React state'inden bağımsız
 * yöneterek performans artışı sağlar.
 */
export const useTopologyCanvas = (initialState = { x: 0, y: 0, zoom: 1 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Görsel durum (DOM manipülasyonu için)
  const visualState = useRef({ x: initialState.x, y: initialState.y, zoom: initialState.zoom });
  const dragState = useRef<{ id: string | null; offset: { x: number; y: number } }>({ id: null, offset: { x: 0, y: 0 } });

  const updateTransform = useCallback(() => {
    if (canvasRef.current) {
      const { x, y, zoom } = visualState.current;
      canvasRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    }
  }, []);

  const updateElementTransform = useCallback((id: string, x: number, y: number) => {
    const el = document.getElementById(`node-${id}`);
    if (el) {
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }, []);

  const resetView = useCallback(() => {
    visualState.current = { ...initialState };
    updateTransform();
  }, [initialState, updateTransform]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const zoomSpeed = 0.001;
    const delta = -e.deltaY;
    const factor = Math.pow(1.1, delta / 100);

    visualState.current.zoom = Math.min(Math.max(visualState.current.zoom * factor, 0.1), 5);
    updateTransform();
  }, [updateTransform]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  return { containerRef, canvasRef, visualState, dragState, resetView, updateTransform, updateElementTransform };
};
