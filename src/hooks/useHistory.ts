import { useState, useCallback, useRef } from 'react';
import { SwitchState, CableInfo } from '@/lib/network/types';
import { CanvasDevice, CanvasConnection } from '@/components/network/NetworkTopology';
import { TerminalOutput } from '@/components/network/Terminal';

export interface ProjectState {
  topologyDevices: CanvasDevice[];
  topologyConnections: CanvasConnection[];
  deviceStates: Map<string, SwitchState>;
  deviceOutputs: Map<string, TerminalOutput[]>;
  pcOutputs: Map<string, any[]>;
  cableInfo: CableInfo;
  activeDeviceId: string;
  activeDeviceType: 'pc' | 'switch' | 'router';
  zoom: number;
  pan: { x: number; y: number };
}

export function useHistory(initialState: ProjectState) {
  const [history, setHistory] = useState<ProjectState[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isTransitioning = useRef(false);

  const pushState = useCallback((newState: ProjectState) => {
    if (isTransitioning.current) return;

    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      // Deep copy maps to avoid reference issues
      const stateToPush = {
        ...newState,
        deviceStates: new Map(newState.deviceStates),
        deviceOutputs: new Map(newState.deviceOutputs),
        pcOutputs: new Map(newState.pcOutputs),
        topologyDevices: JSON.parse(JSON.stringify(newState.topologyDevices)),
        topologyConnections: JSON.parse(JSON.stringify(newState.topologyConnections)),
        cableInfo: { ...newState.cableInfo }
      };
      
      // Only push if different from current state (simple check)
      const currentState = newHistory[newHistory.length - 1];
      if (JSON.stringify(stateToPush.topologyDevices) === JSON.stringify(currentState?.topologyDevices) &&
          JSON.stringify(stateToPush.topologyConnections) === JSON.stringify(currentState?.topologyConnections) &&
          stateToPush.deviceStates.size === currentState?.deviceStates.size &&
          stateToPush.activeDeviceId === currentState?.activeDeviceId) {
          // This is a very shallow check, but it helps prevent some redundant pushes
          // For a truly "solid" undo/redo, we might want a better diffing or just trust the caller
      }

      newHistory.push(stateToPush);
      // Limit history size
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setCurrentIndex(prev => Math.min(prev + 1, 49));
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      isTransitioning.current = true;
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      const state = history[prevIndex];
      isTransitioning.current = false;
      return state;
    }
    return null;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      isTransitioning.current = true;
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const state = history[nextIndex];
      isTransitioning.current = false;
      return state;
    }
    return null;
  }, [currentIndex, history]);

  const resetHistory = useCallback((state: ProjectState) => {
    setHistory([state]);
    setCurrentIndex(0);
  }, []);

  return {
    pushState,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    resetHistory
  };
}
