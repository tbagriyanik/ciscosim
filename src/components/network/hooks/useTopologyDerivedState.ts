import { useMemo } from 'react';
import { CanvasDevice, CanvasConnection, CanvasNote } from '../networkTopology.types';
import { buildImplicitWirelessConnections } from '@/lib/network/wireless';
import { useSpatialPartitioning } from '@/lib/performance/spatial';
import { getDevicePairKey } from '../networkTopology.helpers';
import type { SwitchState } from '@/lib/network/types';

interface UseTopologyDerivedStateProps {
  topologyDevices: CanvasDevice[];
  topologyConnections: CanvasConnection[];
  topologyNotes: CanvasNote[];
  deviceStates?: Map<string, SwitchState>;
  isActive: boolean;
  isExporting: boolean;
  graphicsQuality: string;
  pan: { x: number; y: number };
  zoom: number;
  canvasDimensions: { width: number; height: number };
  activeDeviceId?: string | null;
}

export function useTopologyDerivedState({
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
}: UseTopologyDerivedStateProps) {
  // Memoize device map for O(1) lookups
  const deviceMap = useMemo(() => {
    const map = new Map<string, CanvasDevice>();
    topologyDevices.forEach((d) => map.set(d.id, d));
    return map;
  }, [topologyDevices]);

  // Wireless clients are implicit in the topology model, but must also be rendered.
  const visualConnections = useMemo(() => {
    const existing = new Set(
      topologyConnections.map(
        (connection) =>
          `${connection.sourceDeviceId}:${connection.sourcePort}-${connection.targetDeviceId}:${connection.targetPort}`
      )
    );
    const implicitWireless = buildImplicitWirelessConnections(topologyDevices, deviceStates, 'wireless')
      .filter(
        (connection) =>
          !existing.has(
            `${connection.sourceDeviceId}:${connection.sourcePort}-${connection.targetDeviceId}:${connection.targetPort}`
          )
      )
      .map((connection) => {
        const sourceDev = deviceMap.get(connection.sourceDeviceId);
        const targetDev = deviceMap.get(connection.targetDeviceId);
        const clientDevice =
          (sourceDev && (sourceDev.type === 'pc' || sourceDev.type === 'iot')) ? sourceDev :
          (targetDev && (targetDev.type === 'pc' || targetDev.type === 'iot')) ? targetDev : null;

        if (clientDevice && clientDevice.wifi?.powerDisabled) {
          return { ...connection, active: false };
        }
        return connection;
      });
    return [...topologyConnections, ...implicitWireless];
  }, [topologyConnections, topologyDevices, deviceStates, deviceMap]);

  // Connection map for O(1) lookups during culling
  const connectionMap = useMemo(() => {
    const map = new Map<string, CanvasConnection>();
    visualConnections.forEach((c) => map.set(c.id, c));
    return map;
  }, [visualConnections]);

  // Map of device ID to its connections for O(1) lookups in renderDevice
  const deviceToConnectionsMap = useMemo(() => {
    const map = new Map<string, CanvasConnection[]>();
    visualConnections.forEach((conn) => {
      const addConn = (deviceId: string) => {
        const list = map.get(deviceId);
        if (list) {
          list.push(conn);
        } else {
          map.set(deviceId, [conn]);
        }
      };

      addConn(conn.sourceDeviceId);
      if (conn.targetDeviceId !== conn.sourceDeviceId) {
        addConn(conn.targetDeviceId);
      }
    });
    return map;
  }, [visualConnections]);

  // Connection metadata (total and index for parallel cables)
  const connectionMeta = useMemo(() => {
    const meta = new Map<string, { index: number; total: number }>();
    const groupMap = new Map<string, string[]>();

    visualConnections.forEach((conn) => {
      const pair = getDevicePairKey(conn.sourceDeviceId, conn.targetDeviceId);
      if (!groupMap.has(pair)) groupMap.set(pair, []);
      groupMap.get(pair)?.push(conn.id);
    });

    groupMap.forEach((ids) => {
      const total = ids.length;
      ids.forEach((id, index) => {
        meta.set(id, { index, total });
      });
    });

    return meta;
  }, [visualConnections]);

  // Current viewport bounds
  const currentViewport = useMemo(() => {
    if (canvasDimensions.width === 0 || canvasDimensions.height === 0 || !zoom || zoom <= 0) {
      return null;
    }
    return {
      x: pan.x,
      y: pan.y,
      width: canvasDimensions.width,
      height: canvasDimensions.height,
      zoom,
    };
  }, [pan.x, pan.y, canvasDimensions.width, canvasDimensions.height, zoom]);

  // Spatial partitioning visibility culling (enabled only in low graphics quality)
  const { visibleDeviceIds, visibleConnectionIds } = useSpatialPartitioning(
    topologyDevices,
    visualConnections,
    currentViewport,
    { cellSize: 256, margin: 100, enabled: graphicsQuality === 'low' }
  );

  const { visibleDevices, visibleConnections, visibleNotes } = useMemo(() => {
    if (!isActive || canvasDimensions.width === 0 || isExporting || graphicsQuality !== 'low') {
      return { visibleDevices: topologyDevices, visibleConnections: visualConnections, visibleNotes: topologyNotes };
    }

    const { width, height } = canvasDimensions;

    if (width === 0 || height === 0 || !zoom || zoom <= 0) {
      return { visibleDevices: topologyDevices, visibleConnections: visualConnections, visibleNotes: topologyNotes };
    }

    const margin = 100;

    const vDevices = visibleDeviceIds.map((id) => deviceMap.get(id)).filter((d): d is CanvasDevice => !!d);
    const vConnections = visibleConnectionIds.map((id) => connectionMap.get(id)).filter((c): c is CanvasConnection => !!c);

    const vNotes = topologyNotes.filter((note) => {
      const x = note.x * zoom + pan.x;
      const y = note.y * zoom + pan.y;
      const noteWidth = note.width * zoom;
      const noteHeight = note.height * zoom;

      return (
        x + noteWidth + margin > 0 &&
        x - margin < width &&
        y + noteHeight + margin > 0 &&
        y - margin < height
      );
    });

    return { visibleDevices: vDevices, visibleConnections: vConnections, visibleNotes: vNotes };
  }, [
    topologyDevices,
    visualConnections,
    topologyNotes,
    zoom,
    pan,
    isActive,
    canvasDimensions,
    visibleDeviceIds,
    visibleConnectionIds,
    isExporting,
    graphicsQuality,
    deviceMap,
    connectionMap,
  ]);

  const devicesSortedForRender = useMemo(() => {
    return [...visibleDevices].sort((a, b) => {
      if (a.id === activeDeviceId) return 1;
      if (b.id === activeDeviceId) return -1;
      return 0;
    });
  }, [visibleDevices, activeDeviceId]);

  return {
    deviceMap,
    visualConnections,
    connectionMap,
    deviceToConnectionsMap,
    connectionMeta,
    visibleDevices,
    visibleConnections,
    visibleNotes,
    devicesSortedForRender,
  };
}
