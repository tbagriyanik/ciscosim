import { useState, useCallback, useMemo } from 'react';
import { SwitchState, CableInfo } from '@/lib/network/types';
import { CanvasDevice, CanvasConnection, CanvasNote } from '@/components/network/networkTopology.types';
import { TerminalOutput } from '@/components/network/Terminal';

export interface ProjectState {
  topologyDevices: CanvasDevice[];
  topologyConnections: CanvasConnection[];
  topologyNotes: CanvasNote[];
  deviceStates: Map<string, SwitchState>;
  deviceOutputs: Map<string, TerminalOutput[]>;
  pcOutputs: Map<string, any[]>;
  pcHistories: Map<string, string[]>;
  cableInfo: CableInfo;
  activeDeviceId: string;
  activeDeviceType: 'pc' | 'switch' | 'router';
  zoom: number;
  pan: { x: number; y: number };
  activeTab?: string;
}

interface HistoryState {
  items: ProjectState[];
  index: number;
}

export function useHistory(initialState: ProjectState) {
  const [state, setState] = useState<HistoryState>({
    items: [initialState],
    index: 0
  });

  const pushState = useCallback((newState: ProjectState) => {
    setState(prev => {
      const newItems = prev.items.slice(0, prev.index + 1);

      // Deep copy maps and objects
      const stateToPush: ProjectState = {
        ...newState,
        deviceStates: new Map(newState.deviceStates),
        deviceOutputs: new Map(newState.deviceOutputs),
        pcOutputs: new Map(newState.pcOutputs),
        pcHistories: new Map(newState.pcHistories),
        topologyDevices: JSON.parse(JSON.stringify(newState.topologyDevices)),
        topologyConnections: JSON.parse(JSON.stringify(newState.topologyConnections)),
        topologyNotes: JSON.parse(JSON.stringify(newState.topologyNotes)),
        cableInfo: { ...newState.cableInfo }
      };

      // Optimization: don't push if it's the same as current present
      const currentPresent = prev.items[prev.index];
      if (currentPresent &&
          JSON.stringify(stateToPush.topologyDevices) === JSON.stringify(currentPresent.topologyDevices) &&
          JSON.stringify(stateToPush.topologyConnections) === JSON.stringify(currentPresent.topologyConnections) &&
          JSON.stringify(stateToPush.topologyNotes) === JSON.stringify(currentPresent.topologyNotes)) {
        return prev;
      }

      newItems.push(stateToPush);

      let nextIndex = newItems.length - 1;

      // Limit history size
      if (newItems.length > 50) {
        newItems.shift();
        nextIndex = Math.max(0, nextIndex - 1);
      }

      return {
        items: newItems,
        index: nextIndex
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState(prev => {
      if (prev.index > 0) {
        return { ...prev, index: prev.index - 1 };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setState(prev => {
      if (prev.index < prev.items.length - 1) {
        return { ...prev, index: prev.index + 1 };
      }
      return prev;
    });
  }, []);

  const resetHistory = useCallback((newState: ProjectState) => {
    setState({
      items: [newState],
      index: 0
    });
  }, []);

  // Current state based on index - useful for applying undo/redo
  const currentState = useMemo(() => {
    return state.items[state.index] || null;
  }, [state.items, state.index]);

  const canUndo = useMemo(() => state.index > 0, [state.index]);
  const canRedo = useMemo(() => state.index < state.items.length - 1, [state.index, state.items.length]);

  return {
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
    currentState
  };
}
