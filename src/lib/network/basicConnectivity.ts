import { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import { SwitchState } from './types';

/**
 * Basic L2 connectivity check (shared utility to avoid circular dependency)
 * This function provides a simplified L2 connectivity check without routing
 */
export function checkBasicL2Connectivity(
  sourceId: string,
  targetIp: string,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates?: Map<string, SwitchState>
): { success: boolean; hops: string[]; error?: string } {
  // Find target device by IP
  let targetDevice = devices.find(d => d.ip === targetIp);

  // Check device states for interface IPs
  if (!targetDevice && deviceStates) {
    for (const [id, state] of deviceStates.entries()) {
      for (const portId in state.ports) {
        if (state.ports[portId].ipAddress === targetIp) {
          targetDevice = devices.find(d => d.id === id);
          break;
        }
      }
      if (targetDevice) break;
    }
  }

  if (!targetDevice) {
    return { success: false, hops: [], error: 'Target device not found' };
  }

  // Simple BFS pathfinding for L2 connectivity
  const queue: string[] = [sourceId];
  const visited = new Set<string>([sourceId]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === targetDevice.id) break;

    const neighbors = connections
      .filter(c => c.active !== false && (c.sourceDeviceId === currentId || c.targetDeviceId === currentId))
      .map(c => c.sourceDeviceId === currentId ? c.targetDeviceId : c.sourceDeviceId);

    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        parent.set(neighborId, currentId);
        queue.push(neighborId);
      }
    }
  }

  if (!visited.has(targetDevice.id)) {
    return { success: false, hops: [], error: 'No L2 path to target' };
  }

  // Construct path
  const path: string[] = [];
  let curr: string | undefined = targetDevice.id;
  while (curr) {
    path.unshift(curr);
    curr = parent.get(curr);
  }

  const hopNames = path.map(id => devices.find(d => d.id === id)?.name || id);

  return { success: true, hops: hopNames, error: undefined };
}
