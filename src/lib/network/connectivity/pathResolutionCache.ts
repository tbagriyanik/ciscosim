import type { CanvasConnection } from '@/components/network/networkTopology.types';

export interface DeviceAdjacency {
  targetDeviceId: string;
  sourcePort: string;
  targetPort: string;
  cableType?: string;
  connectionId?: string;
}

/**
 * Builds an O(1) adjacency map for topology connections to prevent
 * repeated O(N) array filtering during packet resolution hops.
 */
export function buildDeviceAdjacencyMap(connections: CanvasConnection[]): Map<string, DeviceAdjacency[]> {
  const map = new Map<string, DeviceAdjacency[]>();

  for (const conn of connections) {
    if (!map.has(conn.sourceDeviceId)) {
      map.set(conn.sourceDeviceId, []);
    }
    map.get(conn.sourceDeviceId)!.push({
      targetDeviceId: conn.targetDeviceId,
      sourcePort: conn.sourcePort,
      targetPort: conn.targetPort,
      cableType: conn.cableType,
      connectionId: conn.id,
    });

    if (!map.has(conn.targetDeviceId)) {
      map.set(conn.targetDeviceId, []);
    }
    map.get(conn.targetDeviceId)!.push({
      targetDeviceId: conn.sourceDeviceId,
      sourcePort: conn.targetPort,
      targetPort: conn.sourcePort,
      cableType: conn.cableType,
      connectionId: conn.id,
    });
  }

  return map;
}
