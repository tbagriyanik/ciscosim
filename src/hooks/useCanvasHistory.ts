import { useState, useRef, useCallback } from 'react';
import { CanvasDevice, CanvasConnection, CanvasNote } from '@/components/network/networkTopology.types';

interface HistorySnapshot {
    devices: CanvasDevice[];
    connections: CanvasConnection[];
    notes: CanvasNote[];
}

interface UseCanvasHistoryOptions {
    setDevices: (devices: CanvasDevice[]) => void;
    setConnections: (connections: CanvasConnection[]) => void;
    setNotes: (notes: CanvasNote[]) => void;
    latestDevicesRef: React.MutableRefObject<CanvasDevice[]>;
    latestConnectionsRef: React.MutableRefObject<CanvasConnection[]>;
    latestNotesRef: React.MutableRefObject<CanvasNote[]>;
    maxHistory?: number;
}

/**
 * Manages undo/redo history for the canvas topology.
 * Call `saveToHistory()` BEFORE making any change to capture the current state.
 */
export function useCanvasHistory({
    setDevices,
    setConnections,
    setNotes,
    latestDevicesRef,
    latestConnectionsRef,
    latestNotesRef,
    maxHistory = 100,
}: UseCanvasHistoryOptions) {
    const historyRef = useRef<HistorySnapshot[]>([]);
    const historyIndexRef = useRef<number>(-1);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [historyLength, setHistoryLength] = useState(0);

    const saveToHistory = useCallback(() => {
        const snapshot: HistorySnapshot = {
            devices: JSON.parse(JSON.stringify(latestDevicesRef.current)),
            connections: JSON.parse(JSON.stringify(latestConnectionsRef.current)),
            notes: JSON.parse(JSON.stringify(latestNotesRef.current)),
        };

        const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);

        // Skip if identical to last entry
        const last = truncated[truncated.length - 1];
        if (
            last &&
            JSON.stringify(last.devices) === JSON.stringify(snapshot.devices) &&
            JSON.stringify(last.connections) === JSON.stringify(snapshot.connections) &&
            JSON.stringify(last.notes) === JSON.stringify(snapshot.notes)
        ) {
            return;
        }

        truncated.push(snapshot);
        if (truncated.length > maxHistory) truncated.shift();

        historyRef.current = truncated;
        historyIndexRef.current = truncated.length - 1;
        setHistoryIndex(historyIndexRef.current);
        setHistoryLength(truncated.length);
    }, [latestDevicesRef, latestConnectionsRef, latestNotesRef, maxHistory]);

    const handleUndo = useCallback(() => {
        if (historyIndexRef.current > 0) {
            historyIndexRef.current -= 1;
            const state = historyRef.current[historyIndexRef.current];
            if (state) {
                setDevices(JSON.parse(JSON.stringify(state.devices)));
                setConnections(JSON.parse(JSON.stringify(state.connections)));
                setNotes(JSON.parse(JSON.stringify(state.notes)));
                setHistoryIndex(historyIndexRef.current);
            }
        }
    }, [setDevices, setConnections, setNotes]);

    const handleRedo = useCallback(() => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current += 1;
            const state = historyRef.current[historyIndexRef.current];
            if (state) {
                setDevices(JSON.parse(JSON.stringify(state.devices)));
                setConnections(JSON.parse(JSON.stringify(state.connections)));
                setNotes(JSON.parse(JSON.stringify(state.notes)));
                setHistoryIndex(historyIndexRef.current);
            }
        }
    }, [setDevices, setConnections, setNotes]);

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < historyLength - 1;

    return {
        saveToHistory,
        handleUndo,
        handleRedo,
        canUndo,
        canRedo,
        historyIndex,
        historyLength,
    };
}
