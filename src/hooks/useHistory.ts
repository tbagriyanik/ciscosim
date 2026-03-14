import { useState, useCallback, useRef } from 'react';
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
    let result: ProjectState | null = null;
    setState(prev => {
      if (prev.index > 0) {
        const nextIndex = prev.index - 1;
        result = prev.items[nextIndex];
        return { ...prev, index: nextIndex };
      }
      return prev;
    });
    // Since setState is async, we can't easily return the state here 
    // without a ref or some other trick. 
    // But in our current architecture, the caller calls undo() and 
    // expects the state back to apply it.
    // Let's use a workaround: return the state from the items array 
    // using the index BEFORE the update, but the caller already has 'state' in scope.
    if (state.index > 0) {
      return state.items[state.index - 1];
    }
    return null;
  }, [state]);

  const redo = useCallback(() => {
    if (state.index < state.items.length - 1) {
      const nextIndex = state.index + 1;
      setState(prev => ({ ...prev, index: nextIndex }));
      return state.items[nextIndex];
    }
    return null;
  }, [state]);

  const resetHistory = useCallback((newState: ProjectState) => {
    setState({
      items: [newState],
      index: 0
    });
  }, []);

  return {
    pushState,
    undo,
    redo,
    canUndo: state.index > 0,
    canRedo: state.index < state.items.length - 1,
    resetHistory
  };
}
