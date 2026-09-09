import { CanvasConnection } from '@/components/network/networkTopology.types';
import { getDevicePairKey } from '@/components/network/networkTopology.helpers';
import { Port, SwitchState, EtherChannelMode } from './types';

export interface EtherChannelMember {
  connectionId: string;
  sourcePort: string;
  targetPort: string;
  /** True when the member link is live (cable powered on AND neither end shut down) */
  up: boolean;
}

export interface EtherChannelBundle {
  groupId: number;
  sourceDeviceId: string;
  targetDeviceId: string;
  /** Live member connections only (used by STP to force forwarding on bundled ports) */
  memberConnections: CanvasConnection[];
  /** All configured member links with per-member liveness (dead members get the D flag) */
  members: EtherChannelMember[];
  upMemberCount: number;
  downMemberCount: number;
  protocol: 'lacp' | 'pagp' | 'static';
  bundled: boolean;
  /** Reason if not bundled */
  reason?: string;
}

export type EtherChannelChangeLevel = 'info' | 'warning' | 'error';

export interface EtherChannelChangeEvent {
  type: 'member-joined' | 'member-left' | 'bundle-up' | 'bundle-down';
  groupId: number;
  deviceId: string;
  port: string;
  upMemberCount: number;
  totalMemberCount: number;
  protocol: 'lacp' | 'pagp' | 'static';
  level: EtherChannelChangeLevel;
  message: string;
  detail?: string;
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
  // Group connections by sorted device pair. Unlike before, powered-off cables
  // (active === false) are kept so a bundle can survive with D-flagged members.
  const groups = new Map<string, CanvasConnection[]>();
  for (const conn of connections) {
    const key = getDevicePairKey(conn.sourceDeviceId, conn.targetDeviceId, '::');
    const list = groups.get(key);
    if (list) list.push(conn);
    else groups.set(key, [conn]);
  }

  const buildMembers = (
    conns: CanvasConnection[],
    sourceState: SwitchState,
    targetState: SwitchState
  ): EtherChannelMember[] =>
    conns.map(conn => {
      const srcPort = sourceState.ports?.[conn.sourcePort];
      const tgtPort = targetState.ports?.[conn.targetPort];
      const up = conn.active !== false && !srcPort?.shutdown && !tgtPort?.shutdown;
      return { connectionId: conn.id, sourcePort: conn.sourcePort, targetPort: conn.targetPort, up };
    });

  const bundles: EtherChannelBundle[] = [];

  for (const [, conns] of groups) {
    if (conns.length < 2) continue;

    // Group by channelGroup on source and target sides
    const channelGroups = new Map<string, {
      groupId: number;
      conns: CanvasConnection[];
      sourceState: SwitchState;
      targetState: SwitchState;
    }>();

    for (const conn of conns) {
      const sourceState = deviceStates.get(conn.sourceDeviceId);
      const targetState = deviceStates.get(conn.targetDeviceId);
      if (!sourceState || !targetState) continue;

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

      const { groupId, conns: groupConns, sourceState, targetState } = group;
      const members = buildMembers(groupConns, sourceState, targetState);
      const upMembers = members.filter(m => m.up);
      const upMemberCount = upMembers.length;
      const downMemberCount = members.length - upMemberCount;

      // Check if all source ports have the same mode and it's compatible with target
      const sourceModes = new Set<EtherChannelMode | undefined>();
      const targetModes = new Set<EtherChannelMode | undefined>();

      for (const conn of groupConns) {
        sourceModes.add(getPortMode(sourceState, conn.sourcePort));
        targetModes.add(getPortMode(targetState, conn.targetPort));
      }

      // All source ports should have the same mode across the bundle
      if (sourceModes.size > 1 || targetModes.size > 1) {
        bundles.push({
          groupId,
          sourceDeviceId: groupConns[0].sourceDeviceId,
          targetDeviceId: groupConns[0].targetDeviceId,
          memberConnections: groupConns.filter(c => members.some(m => m.connectionId === c.id && m.up)),
          members,
          upMemberCount,
          downMemberCount,
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

      const bundled = compatible && upMemberCount > 0;
      bundles.push({
        groupId,
        sourceDeviceId: groupConns[0].sourceDeviceId,
        targetDeviceId: groupConns[0].targetDeviceId,
        memberConnections: groupConns.filter(c => members.some(m => m.connectionId === c.id && m.up)),
        members,
        upMemberCount,
        downMemberCount,
        protocol,
        bundled,
        reason: !compatible
          ? `Incompatible modes: ${sourceMode} <-> ${targetMode}`
          : upMemberCount === 0
            ? 'No member links are up'
            : undefined
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
 * Diff two EtherChannel bundle snapshots and emit 
 * %EC-5-BUNDLE / %EC-5-UNBUNDLE change events for the live event timeline.
 *
 * Bundle-level flips (formed / fully down) produce 'bundle-up'/'bundle-down'
 * events source by member-level changes: when a bundle survives with fewer
 * members, per-member 'member-joined'/'member-left' events are emitted instead.
 */
export function computeEtherChannelChanges(
  prevBundles: EtherChannelBundle[],
  nextBundles: EtherChannelBundle[]
): EtherChannelChangeEvent[] {
  const toMap = (bundles: EtherChannelBundle[]) =>
    new Map(bundles.map(b => [`${b.sourceDeviceId}::${b.targetDeviceId}::${b.groupId}`, b]));

  const prevMap = toMap(prevBundles);
  const nextMap = toMap(nextBundles);

  const events: EtherChannelChangeEvent[] = [];
  const groupIds = new Set([...prevMap.keys(), ...nextMap.keys()]);

  const deviceIdsOf = (b?: EtherChannelBundle): [string, string] =>
    b ? [b.sourceDeviceId, b.targetDeviceId] : ['', ''];

  for (const key of groupIds) {
    const prev = prevMap.get(key);
    const next = nextMap.get(key);
    const protocol = next?.protocol ?? prev?.protocol ?? 'static';
    const groupId = prev?.groupId ?? next?.groupId ?? 0;
    const [devA, devB] = deviceIdsOf(next ?? prev);

    const prevBundled = !!prev?.bundled;
    const nextBundled = !!next?.bundled;

    // Whole-bundle transition — emit only the bundle-level event to avoid noise.
    if (!prevBundled && nextBundled) {
      const counts = next ? `${next.upMemberCount} port(s) aggregated` : '';
      for (const deviceId of [devA, devB]) {
        if (!deviceId) continue;
        events.push({
          type: 'bundle-up',
          groupId,
          deviceId,
          port: '',
          upMemberCount: next?.upMemberCount ?? 0,
          totalMemberCount: next ? next.members.length : 0,
          protocol,
          level: 'info',
          message: `%EC-5-BUNDLE: Bundle Po${groupId} is up, ${counts}`,
          detail: `${deviceId}|Po${groupId}|members ${next?.upMemberCount ?? 0}/${next?.members.length ?? 0}`
        });
      }
      continue;
    }

    if (prevBundled && !nextBundled) {
      const reason = next?.reason ?? prev?.reason;
      for (const deviceId of [devA, devB]) {
        if (!deviceId) continue;
        events.push({
          type: 'bundle-down',
          groupId,
          deviceId,
          port: '',
          upMemberCount: next?.upMemberCount ?? 0,
          totalMemberCount: next ? next.members.length : prev?.members.length ?? 0,
          protocol,
          level: 'error',
          message: `%EC-5-UNBUNDLE: Bundle Po${groupId} is down${reason ? ` (${reason})` : ''}`,
          detail: `${deviceId}|Po${groupId}|members ${next?.upMemberCount ?? 0}/${next?.members.length ?? prev?.members.length ?? 0}`
        });
      }
      continue;
    }

    // Bundle stayed up in both snapshots — diff members for join/leave events.
    if (!prev || !next) continue;

    const prevMembers = new Map(prev.members.map(m => [m.connectionId, m]));
    const nextMembers = new Map(next.members.map(m => [m.connectionId, m]));
    const connIds = new Set([...prevMembers.keys(), ...nextMembers.keys()]);

    for (const connId of connIds) {
      const pm = prevMembers.get(connId);
      const nm = nextMembers.get(connId);
      const prevUp = !!pm?.up;
      const nextUp = !!nm?.up;
      if (prevUp === nextUp) continue;

      const member = nm ?? pm;
      if (!member) continue;
      const joined = nextUp && !prevUp;
      const ports: Array<[string, string]> = [
        [prev?.sourceDeviceId ?? next?.sourceDeviceId ?? '', member.sourcePort],
        [prev?.targetDeviceId ?? next?.targetDeviceId ?? '', member.targetPort],
      ];
      for (const [deviceId, port] of ports) {
        if (!deviceId) continue;
        events.push({
          type: joined ? 'member-joined' : 'member-left',
          groupId,
          deviceId,
          port,
          upMemberCount: next.upMemberCount,
          totalMemberCount: next.members.length,
          protocol,
          level: joined ? 'info' : 'warning',
          message: joined
            ? `%EC-5-BUNDLE: Port ${port} joined bundle Po${groupId}`
            : `%EC-5-UNBUNDLE: Port ${port} left bundle Po${groupId}`,
          detail: `${deviceId}|${port}|Po${groupId}|members ${next.upMemberCount}/${next.members.length}`
        });
      }
    }
  }

  return events;
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
