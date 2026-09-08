import { CanvasConnection } from '@/components/network/networkTopology.types';
import { getDevicePairKey } from '@/components/network/networkTopology.helpers';
import { Port, SwitchState, EtherChannelMode } from './types';

export interface EtherChannelBundle {
  groupId: number;
  sourceDeviceId: string;
  targetDeviceId: string;
  memberConnections: CanvasConnection[];
  protocol: 'lacp' | 'pagp' | 'static';
  bundled: boolean;
  /** Reason if not bundled */
  reason?: string;
}

export type LoadBalanceAlgorithm =
  | 'src-mac'
  | 'dst-mac'
  | 'src-dst-mac'
  | 'src-ip'
  | 'dst-ip'
  | 'src-dst-ip'
  | 'src-port'
  | 'dst-port'
  | 'src-dst-port';

function getPortState(state: SwitchState, portId: string): Port | undefined {
  return state.ports?.[portId];
}

function getPortMode(state: SwitchState, portId: string): EtherChannelMode | undefined {
  return getPortState(state, portId)?.channelMode;
}

function getPortChannelGroup(state: SwitchState, portId: string): number | undefined {
  return getPortState(state, portId)?.channelGroup;
}

/**
 * Check if two EtherChannel modes are compatible for bundling.
 */
function areModesCompatible(modeA: EtherChannelMode | undefined, modeB: EtherChannelMode | undefined): boolean {
  if (!modeA || !modeB) return false;

  // Static 'on' requires both sides to be 'on'
  if (modeA === 'on' && modeB === 'on') return true;

  // LACP: active-active or active-passive
  if ((modeA === 'active' || modeA === 'passive') && (modeB === 'active' || modeB === 'passive')) {
    // At least one side must be active
    return modeA === 'active' || modeB === 'active';
  }

  // PAgP: desirable-desirable or desirable-auto
  if ((modeA === 'desirable' || modeA === 'auto') && (modeB === 'desirable' || modeB === 'auto')) {
    // At least one side must be desirable
    return modeA === 'desirable' || modeB === 'desirable';
  }

  return false;
}

/**
 * Detect and return all EtherChannel bundles across all connections.
 * A bundle is formed when two devices have matching channel-group IDs
 * on their respective ports AND the modes are compatible.
 */
export function detectEtherChannelBundles(
  connections: CanvasConnection[],
  deviceStates: Map<string, SwitchState>
): EtherChannelBundle[] {
  // Group connections by sorted device pair
  const groups = new Map<string, CanvasConnection[]>();
  for (const conn of connections) {
    if (conn.active === false) continue;
    const key = getDevicePairKey(conn.sourceDeviceId, conn.targetDeviceId, '::');
    const list = groups.get(key);
    if (list) list.push(conn);
    else groups.set(key, [conn]);
  }

  const bundles: EtherChannelBundle[] = [];

  for (const [, conns] of groups) {
    if (conns.length < 2) continue;

    // Group by channelGroup on source and target sides
    const channelGroups = new Map<string, {
      groupId: number;
      conns: CanvasConnection[];
      sourceState?: SwitchState;
      targetState?: SwitchState;
    }>();

    for (const conn of conns) {
      const sourceState = deviceStates.get(conn.sourceDeviceId);
      const targetState = deviceStates.get(conn.targetDeviceId);
      if (!sourceState || !targetState) continue;

      const srcPort = sourceState.ports?.[conn.sourcePort];
      const tgtPort = targetState.ports?.[conn.targetPort];
      if (srcPort?.shutdown || tgtPort?.shutdown) continue;

      const sourceGroup = getPortChannelGroup(sourceState, conn.sourcePort);
      const targetGroup = getPortChannelGroup(targetState, conn.targetPort);

      if (!sourceGroup || !targetGroup) continue;
      if (sourceGroup !== targetGroup) continue;

      const key = `${sourceGroup}`;
      const existing = channelGroups.get(key);
      if (existing) {
        existing.conns.push(conn);
      } else {
        channelGroups.set(key, { groupId: sourceGroup, conns: [conn], sourceState, targetState });
      }
    }

    for (const [, group] of channelGroups) {
      if (group.conns.length < 2) continue;
      if (!group.sourceState || !group.targetState) continue;

      const { groupId, conns, sourceState, targetState } = group;

      // Check if all source ports have the same mode and it's compatible with target
      const sourceModes = new Set<EtherChannelMode | undefined>();
      const targetModes = new Set<EtherChannelMode | undefined>();

      for (const conn of conns) {
        sourceModes.add(getPortMode(sourceState, conn.sourcePort));
        targetModes.add(getPortMode(targetState, conn.targetPort));
      }

      // All source ports should have the same mode across the bundle
      if (sourceModes.size > 1 || targetModes.size > 1) {
        bundles.push({
          groupId,
          sourceDeviceId: conns[0].sourceDeviceId,
          targetDeviceId: conns[0].targetDeviceId,
          memberConnections: conns,
          protocol: 'static',
          bundled: false,
          reason: 'Mode mismatch within bundle'
        });
        continue;
      }

      const sourceMode = sourceModes.values().next().value;
      const targetMode = targetModes.values().next().value;

      const compatible = areModesCompatible(sourceMode, targetMode);

      // Determine protocol
      let protocol: 'lacp' | 'pagp' | 'static' = 'static';
      if (sourceMode === 'on' && targetMode === 'on') {
        protocol = 'static';
      } else if (sourceMode === 'active' || sourceMode === 'passive' || targetMode === 'active' || targetMode === 'passive') {
        protocol = 'lacp';
      } else if (sourceMode === 'desirable' || sourceMode === 'auto' || targetMode === 'desirable' || targetMode === 'auto') {
        protocol = 'pagp';
      }

      bundles.push({
        groupId,
        sourceDeviceId: conns[0].sourceDeviceId,
        targetDeviceId: conns[0].targetDeviceId,
        memberConnections: conns,
        protocol,
        bundled: compatible,
        reason: compatible ? undefined : `Incompatible modes: ${sourceMode} <-> ${targetMode}`
      });
    }
  }

  return bundles;
}

/**
 * Get the IDs of all connections that are part of an active (bundled) EtherChannel.
 */
export function getBundledConnectionIds(
  connections: CanvasConnection[],
  deviceStates: Map<string, SwitchState>
): Set<string> {
  const bundles = detectEtherChannelBundles(connections, deviceStates);
  const ids = new Set<string>();
  for (const bundle of bundles) {
    if (bundle.bundled) {
      for (const conn of bundle.memberConnections) {
        ids.add(conn.id);
      }
    }
  }
  return ids;
}

/**
 * Get the default load-balance algorithm for a given device.
 */
export function getLoadBalanceAlgorithm(_deviceId: string): LoadBalanceAlgorithm {
  return 'src-dst-ip';
}

/**
 * Format load-balance algorithm for display.
 */
export function formatLoadBalance(algorithm: LoadBalanceAlgorithm): string {
  const map: Record<LoadBalanceAlgorithm, string> = {
    'src-mac': 'Source MAC address',
    'dst-mac': 'Destination MAC address',
    'src-dst-mac': 'Source and Destination MAC address',
    'src-ip': 'Source IP address',
    'dst-ip': 'Destination IP address',
    'src-dst-ip': 'Source and Destination IP address',
    'src-port': 'Source TCP/UDP port',
    'dst-port': 'Destination TCP/UDP port',
    'src-dst-port': 'Source and Destination TCP/UDP port'
  };
  return map[algorithm];
}
