import type { SwitchState, CommandResult } from '../types';
import type { CommandContext } from './commandTypes';
import { recalculateStp } from '../stp';

export type PvstUpdateResult =
  | { error: CommandResult }
  | { allUpdatedStates: Map<string, SwitchState>; myUpdatedState: SwitchState | undefined };

export function getPvstUpdate(
  updatedCurrentState: SwitchState,
  ctx: CommandContext
): PvstUpdateResult {
  const sourceDeviceId = ctx.sourceDeviceId;
  if (!sourceDeviceId) {
    return { error: { success: false, error: '% Internal error: source device not available' } };
  }

  const workingDeviceStates = new Map(ctx.deviceStates);
  workingDeviceStates.set(sourceDeviceId, updatedCurrentState);

  const allUpdatedStates = recalculateStp(workingDeviceStates, ctx.connections || []);
  return { allUpdatedStates, myUpdatedState: allUpdatedStates.get(sourceDeviceId) };
}

/**
 * Interface state update: recalculate STP AND flush stale ARP/MAC entries for
 * the changed ports. When an interface goes down/up, learned forwarding state
 * pointing at that port must be invalidated so routing/ARP/MAC lookups do not
 * keep using a dead link.
 */
export function getInterfaceStateUpdate(
  updatedCurrentState: SwitchState,
  ctx: CommandContext,
  changedPortIds: string[]
): PvstUpdateResult {
  const sourceDeviceId = ctx.sourceDeviceId;
  if (!sourceDeviceId) {
    return { error: { success: false, error: '% Internal error: source device not available' } };
  }

  const workingDeviceStates = new Map(ctx.deviceStates);
  workingDeviceStates.set(sourceDeviceId, updatedCurrentState);
  const portSet = new Set(changedPortIds);

  // Flush stale ARP/MAC/NDP entries learned through the changed ports.
  const current = workingDeviceStates.get(sourceDeviceId);
  if (current) {
    let next: SwitchState = current;
    if (Array.isArray(next.arpCache)) {
      const filtered = next.arpCache.filter(e => !portSet.has(e.interface));
      if (filtered.length !== next.arpCache.length) next = { ...next, arpCache: filtered };
    }
    if (Array.isArray(next.macAddressTable)) {
      const filtered = next.macAddressTable.filter(m => !portSet.has(m.port));
      if (filtered.length !== next.macAddressTable.length) next = { ...next, macAddressTable: filtered };
    }
    if (Array.isArray(next.ndpCache)) {
      const filtered = next.ndpCache.filter(e => !portSet.has(e.interface));
      if (filtered.length !== next.ndpCache.length) next = { ...next, ndpCache: filtered };
    }
    workingDeviceStates.set(sourceDeviceId, next);
  }

  // Peer-facing MAC entries: flush learned MACs that point out the changed
  // ports on the far end of the same links.
  (ctx.connections || []).forEach(conn => {
    const connectsTo = (deviceId: string, portId: string | undefined) =>
      deviceId === sourceDeviceId && portId !== undefined && portSet.has(portId);
    const peerDeviceId = connectsTo(conn.sourceDeviceId, conn.sourcePort)
      ? conn.targetDeviceId
      : connectsTo(conn.targetDeviceId, conn.targetPort)
        ? conn.sourceDeviceId
        : undefined;
    if (!peerDeviceId) return;
    const peerPortId = conn.sourceDeviceId === peerDeviceId ? conn.sourcePort : conn.targetPort;
    const peerState = workingDeviceStates.get(peerDeviceId);
    if (!peerState || !Array.isArray(peerState.macAddressTable)) return;
    const filtered = peerState.macAddressTable.filter(m => m.port !== peerPortId);
    if (filtered.length !== peerState.macAddressTable.length) {
      workingDeviceStates.set(peerDeviceId, { ...peerState, macAddressTable: filtered });
    }
  });

  // Recalculate STP across the topology with the cleaned state.
  const allUpdatedStates = recalculateStp(workingDeviceStates, ctx.connections || []);
  return { allUpdatedStates, myUpdatedState: allUpdatedStates.get(sourceDeviceId) };
}
