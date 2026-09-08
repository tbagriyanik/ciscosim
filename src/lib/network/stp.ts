import type { SwitchState, StpVlanState, Port } from './types';
import type { CanvasConnection } from '@/components/network/networkTopology.types';
import { dispatchCapturedPackets } from '../../utils/packetCapture';
import { detectEtherChannelBundles } from './etherchannel';
import { buildConnectionIndex, getConnectionAtPort, type ConnectionIndex } from './connectionIndex';
import { areSameMstRegion } from './mstp';


/**
 * Spanning Tree Protocol Bridge Protocol Data Unit (BPDU)
 */
interface Bpdu {
  rootBridgeId: string;
  rootPathCost: number;
  senderBridgeId: string;
  senderPortId: string;
  proposal?: boolean;
  agreement?: boolean;
}

/**
 * Compare two BPDUs to determine which one is superior.
 * Returns true if newBp is superior to currentBp.
 *
 * STP Superior BPDU Hierarchy:
 * 1. Lowest Root Bridge ID
 * 2. Lowest Root Path Cost
 * 3. Lowest Sender Bridge ID
 * 4. Lowest Sender Port ID
 */
function isBpduSuperior(newBp: Bpdu, currentBp: Bpdu): boolean {
  if (newBp.rootBridgeId < currentBp.rootBridgeId) return true;
  if (newBp.rootBridgeId > currentBp.rootBridgeId) return false;

  if (newBp.rootPathCost < currentBp.rootPathCost) return true;
  if (newBp.rootPathCost > currentBp.rootPathCost) return false;

  if (newBp.senderBridgeId < currentBp.senderBridgeId) return true;
  if (newBp.senderBridgeId > currentBp.senderBridgeId) return false;

  return newBp.senderPortId < currentBp.senderPortId;
}

/**
 * Format a Bridge ID from priority and MAC address.
 * Format: priority.mac (e.g., "32768.0000.0000.0001")
 */
function calculateBridgeId(priority: number, mac: string | undefined): string {
  let cleanMac = (mac || '000000000000').replace(/[:.-]/g, '').toLowerCase();
  cleanMac = cleanMac.padEnd(12, '0').slice(0, 12);
  const match = cleanMac.match(/.{1,4}/g);
  const formattedMac = match ? match.join('.') : cleanMac;
  return `${priority.toString().padStart(5, '0')}.${formattedMac}`;
}

/**
 * Get the IEEE 802.1D standard cost based on port speed.
 */
function getPortCost(port: Port): number {
  if (port.stpCost !== undefined) return port.stpCost;

  const speed = port.speed;
  if (speed === '10000') return 2;
  if (speed === '1000') return 4;
  if (speed === '100') return 19;
  if (speed === '10') return 100;

  // Fallback to port type if speed is auto or unknown
  if (port.type === 'gigabitethernet') return 4;
  return 19;
}

/**
 * Helper to extract port number from port ID (fa0/1 -> 1, gi0/24 -> 24)
 */
function getPortNumber(portId: string): number {
  const match = portId.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Recalculate Spanning Tree Protocol for all switches in the topology.
 */
export function recalculateStp(
  deviceStates: Map<string, SwitchState>,
  connections: CanvasConnection[]
): Map<string, SwitchState> {
  const updatedStates = new Map<string, SwitchState>();
  const switchIds: string[] = [];
  const allVlanIds = new Set<number>([1]); // Always include default VLAN 1

  // First pass: identify switches and deep clone their states to avoid side effects
  deviceStates.forEach((state, id) => {
    // Robust switch identification:
    // 1. Explicitly check deviceType
    // 2. Fallback to ID-based prefix check if deviceType is missing
    // 3. Check switchLayer
    const isExplicitExcluded = state?.deviceType === 'pc' || state?.deviceType === 'iot' ||
      state?.deviceType === 'router' || state?.deviceType === 'firewall' || state?.deviceType === 'wlc' ||
      id.startsWith('pc-') || id.startsWith('iot-') || id.startsWith('router-') || id.startsWith('firewall-') || id.startsWith('wlc-');

    const isSwitch = !isExplicitExcluded && (
      state?.deviceType === 'switch' ||
      state?.deviceType === 'switchL2' ||
      state?.deviceType === 'switchL3' ||
      state?.switchLayer === 'L2' ||
      state?.switchLayer === 'L3'
    );

    if (isSwitch) {
      switchIds.push(id);

      // Clone state and nested objects that will be modified
      const clonedState: SwitchState = {
        ...state,
        ports: { ...state.ports },
        stpState: {} // Reset STP results for recalculation
      };

      // Clone ports and their spanningTree info
      Object.keys(clonedState.ports).forEach(portId => {
        const port = clonedState.ports[portId];
        clonedState.ports[portId] = {
          ...port,
          spanningTree: port.spanningTree ? {
            ...port.spanningTree,
            instances: port.spanningTree.instances ? { ...port.spanningTree.instances } : {}
          } : { instances: {} }
        };
      });

      if (state.vlans) {
        Object.keys(state.vlans).forEach(v => allVlanIds.add(Number(v)));
      }
      if (state.mstConfig?.instances) {
        Object.values(state.mstConfig.instances).forEach(vlans => {
          if (Array.isArray(vlans)) vlans.forEach(v => allVlanIds.add(v));
        });
      }
      updatedStates.set(id, clonedState);
    } else {
      // For non-switches, we can keep the reference or do a shallow clone
      updatedStates.set(id, state);
    }
  });

  if (switchIds.length === 0) return updatedStates;

  // Build connection index once for O(1) port connection lookups across all VLANs
  const connectionIndex = buildConnectionIndex(connections);

  // Check if there are any active connections between DIFFERENT switches.
  // STP blocking is only enabled if the topology contains at least two switches connected to each other.
  // This prevents self-loops from blocking ports on isolated switches, making it easier for beginners.
  const hasInterSwitchLinks = connections.some(c =>
    c.active &&
    c.sourceDeviceId !== c.targetDeviceId &&
    switchIds.includes(c.sourceDeviceId) &&
    switchIds.includes(c.targetDeviceId)
  );

  // For each VLAN, run STP calculation
  allVlanIds.forEach(vlanId => {
    runStpForVlan(vlanId, switchIds, connections, connectionIndex, updatedStates, hasInterSwitchLinks);
  });

  return updatedStates;
}

function getMstInstanceForVlan(state: SwitchState, vlanId: number): number {
  if (!state.mstConfig?.instances) return 0;
  for (const [instStr, vlans] of Object.entries(state.mstConfig.instances)) {
    if (Array.isArray(vlans) && vlans.includes(vlanId)) {
      return parseInt(instStr, 10);
    }
  }
  return 0;
}

function getVlanPriority(state: SwitchState, vlanId: number): number {
  if (state.spanningTreeMode === 'mst') {
    const instId = getMstInstanceForVlan(state, vlanId);
    if (state.mstConfig?.instancePriorities?.[instId] !== undefined) {
      return state.mstConfig.instancePriorities[instId];
    }
    return state.spanningTreePriority || 32768;
  }
  const vlanConfig = state.spanningTreeVlans?.[vlanId];
  return vlanConfig?.priority ? parseInt(vlanConfig.priority, 10) : (state.spanningTreePriority || 32768);
}

function getBridgePriority(state: SwitchState, vlanId: number): number {
  const priority = getVlanPriority(state, vlanId);
  if (state.spanningTreeMode === 'mst') {
    return priority;
  }
  return priority + vlanId;
}

function runStpForVlan(
  vlanId: number,
  switchIds: string[],
  connections: CanvasConnection[],
  connectionIndex: ConnectionIndex,
  deviceStates: Map<string, SwitchState>,
  hasInterSwitchLinks: boolean
) {
  // If no switch-to-switch links exist, all ports are designated (forwarding)
  // A single switch or multiple isolated switches cannot form a loop
  if (!hasInterSwitchLinks) {
    switchIds.forEach(id => {
      const state = deviceStates.get(id);
      if (!state) return;
      const vlanConfig = state.spanningTreeVlans?.[vlanId];
      if (vlanConfig?.enabled === false) return;

      const bridgeId = calculateBridgeId(getBridgePriority(state, vlanId), state.macAddress);

      const vlanStpState: StpVlanState = {
        vlanId,
        bridgeId,
        rootBridgeId: bridgeId,
        isRoot: true,
        rootCost: 0,
        ports: {}
      };

      Object.keys(state.ports).forEach(portId => {
        const port = state.ports[portId];
        if (portId.startsWith('vlan') || portId.startsWith('console')) return;
        if (!isPortVlanMember(port, vlanId)) return;

        if (port.shutdown) {
          vlanStpState.ports[portId] = { role: 'disabled', state: 'disabled', cost: getPortCost(port) };
        } else {
          vlanStpState.ports[portId] = { role: 'designated', state: 'forwarding', cost: getPortCost(port) };
        }
      });

      if (!state.stpState) state.stpState = {};
      state.stpState[vlanId] = vlanStpState;

      syncPortStatusVlan1(state, vlanStpState);
    });
    return;
  }

  // Map to store the best BPDU known by each switch (best it can send)
  const deviceBestBpdu = new Map<string, Bpdu>();
  // Map to store the best BPDU received on each port: deviceId -> portId -> Bpdu
  const portBestBpdu = new Map<string, Map<string, Bpdu>>();
  // Map to store which port is the root port for each switch: deviceId -> portId
  const rootPortIdMap = new Map<string, string>();

  // Initialize: Every switch thinks it's the Root Bridge
  switchIds.forEach(id => {
    const state = deviceStates.get(id);
    if (!state) return;

    const vlanConfig = state.spanningTreeVlans?.[vlanId];
    if (vlanConfig?.enabled === false) return;

    const bridgeId = calculateBridgeId(getBridgePriority(state, vlanId), state.macAddress);

    const initialBpdu: Bpdu = {
      rootBridgeId: bridgeId,
      rootPathCost: 0,
      senderBridgeId: bridgeId,
      senderPortId: "0" // Placeholder for self
    };

    deviceBestBpdu.set(id, initialBpdu);
    portBestBpdu.set(id, new Map());
  });

  // Iterative BPDU propagation (Simulating network convergence)
  let changed = true;
  let iterations = 0;
  const maxIterations = switchIds.length * 10; // High enough for large topologies

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    connections.forEach(conn => {
      if (!conn.active) return;

      const propagate = (srcId: string, srcPort: string, dstId: string, dstPort: string) => {
        const srcState = deviceStates.get(srcId);
        const dstState = deviceStates.get(dstId);
        if (!srcState || !dstState || !switchIds.includes(srcId) || !switchIds.includes(dstId)) return;

        const srcPortObj = srcState.ports[srcPort];
        const dstPortObj = dstState.ports[dstPort];
        if (!srcPortObj || !dstPortObj || srcPortObj.shutdown || dstPortObj.shutdown) return;
        if (!isPortVlanMember(srcPortObj, vlanId) || !isPortVlanMember(dstPortObj, vlanId)) return;

        // MSTP IEEE 802.1s Boundary Check: MSTI (Instances 1..N) BPDUs do not cross MST Region boundaries
        if (srcState.spanningTreeMode === 'mst' || dstState.spanningTreeMode === 'mst') {
          const instId = getMstInstanceForVlan(srcState, vlanId);
          if (instId > 0 && !areSameMstRegion(srcState, dstState)) {
            return;
          }
        }

        // Source sends its best BPDU (the one it would advertise)

        const bestBp = deviceBestBpdu.get(srcId);
        if (!bestBp) return;

        const bpToSend: Bpdu = {
          ...bestBp,
          senderBridgeId: bestBp.senderBridgeId, // This should actually be src bridge ID in real STP
          senderPortId: srcPort
        };

        // Standard STP: BPDU sent by a bridge uses its own Bridge ID as sender
        bpToSend.senderBridgeId = calculateBridgeId(getBridgePriority(srcState, vlanId), srcState.macAddress);

        const currentPortBp = portBestBpdu.get(dstId)?.get(dstPort);
        if (!currentPortBp || isBpduSuperior(bpToSend, currentPortBp)) {
          portBestBpdu.get(dstId)?.set(dstPort, bpToSend);

          // Re-evaluate device's best BPDU
          const dstBridgeId = calculateBridgeId(getBridgePriority(dstState, vlanId), dstState.macAddress);

          let bestBpForDst: Bpdu = {
            rootBridgeId: dstBridgeId,
            rootPathCost: 0,
            senderBridgeId: dstBridgeId,
            senderPortId: "0"
          };
          let bestPortForDst = "";

          portBestBpdu.get(dstId)?.forEach((bp, pId) => {
            const costToRoot = bp.rootPathCost + getPortCost(dstState.ports[pId]);
            const potentialBp: Bpdu = {
              ...bp,
              rootPathCost: costToRoot
            };

            if (isBpduSuperior(potentialBp, bestBpForDst)) {
              bestBpForDst = potentialBp;
              bestPortForDst = pId;
            }
          });

          const oldBest = deviceBestBpdu.get(dstId);
          if (!oldBest || bestBpForDst.rootBridgeId !== oldBest.rootBridgeId ||
            bestBpForDst.rootPathCost !== oldBest.rootPathCost ||
            bestPortForDst !== rootPortIdMap.get(dstId)) {
            deviceBestBpdu.set(dstId, bestBpForDst);
            rootPortIdMap.set(dstId, bestPortForDst);
            changed = true;
          }
        }
      };

      propagate(conn.sourceDeviceId, conn.sourcePort, conn.targetDeviceId, conn.targetPort);
      propagate(conn.targetDeviceId, conn.targetPort, conn.sourceDeviceId, conn.sourcePort);
    });
  }

  // Final Stage: Assign Roles and States
  switchIds.forEach(deviceId => {
    const state = deviceStates.get(deviceId);
    if (!state) return;

    const bestBp = deviceBestBpdu.get(deviceId);
    if (!bestBp) return;
    const rootPortId = rootPortIdMap.get(deviceId);
    const myBridgePriority = getBridgePriority(state, vlanId);
    const isRoot = bestBp.rootBridgeId === calculateBridgeId(myBridgePriority, state.macAddress);

    const vlanStpState: StpVlanState = {
      vlanId,
      bridgeId: calculateBridgeId(myBridgePriority, state.macAddress),
      rootBridgeId: bestBp.rootBridgeId,
      isRoot,
      rootCost: bestBp.rootPathCost,
      ports: {}
    };

    const activeBundles = detectEtherChannelBundles(connections, deviceStates).filter(b => b.bundled);

    Object.keys(state.ports).forEach(portId => {
      const port = state.ports[portId];
      if (portId.startsWith('vlan') || portId.startsWith('console')) return;
      if (!isPortVlanMember(port, vlanId)) return;

      if (port.shutdown) {
        vlanStpState.ports[portId] = { role: 'disabled', state: 'disabled', cost: getPortCost(port) };
        return;
      }

      // Check if this port is part of an active bundled EtherChannel
      const portBundle = port.channelGroup !== undefined ? activeBundles.find(b =>
        (b.sourceDeviceId === deviceId && b.memberConnections.some(c => c.sourcePort === portId)) ||
        (b.targetDeviceId === deviceId && b.memberConnections.some(c => c.targetPort === portId))
      ) : undefined;

      const isRootChannel = !!(portBundle && rootPortId && portBundle.memberConnections.some(c =>
        (c.sourceDeviceId === deviceId && c.sourcePort === rootPortId) ||
        (c.targetDeviceId === deviceId && c.targetPort === rootPortId)
      ));

      if (isRootChannel) {
        vlanStpState.ports[portId] = { role: 'root', state: 'forwarding', cost: getPortCost(port) };
        return;
      }

      if (portBundle && isRoot) {
        vlanStpState.ports[portId] = { role: 'designated', state: 'forwarding', cost: getPortCost(port) };
        return;
      }

      if (portId === rootPortId) {
        vlanStpState.ports[portId] = { role: 'root', state: 'forwarding', cost: getPortCost(port) };
      } else {
        // Decide between Designated and Alternate
        // A port is Designated if:
        // 1. It's on the Root Bridge
        // 2. It has a lower cost to root than the other side of the link
        // 3. (Tie-breaker) It has a lower Bridge ID than the other side
        // 4. (Tie-breaker) It has a lower Port ID than the other side

        // BOLT: Use connectionIndex for O(1) port-connection lookup instead of scanning connections array
        const portConn = getConnectionAtPort(connectionIndex, deviceId, portId);
        const conn = (portConn && portConn.active !== false) ? portConn : undefined;

        if (!conn) {
          // No connection or non-switch peer -> Designated
          vlanStpState.ports[portId] = { role: 'designated', state: 'forwarding', cost: getPortCost(port) };
          return;
        }

        const peerId = conn.sourceDeviceId === deviceId ? conn.targetDeviceId : conn.sourceDeviceId;
        const peerPortId = conn.sourceDeviceId === deviceId ? conn.targetPort : conn.sourcePort;
        const peerState = deviceStates.get(peerId);

        if (!peerState || !switchIds.includes(peerId)) {
          vlanStpState.ports[portId] = { role: 'designated', state: 'forwarding', cost: getPortCost(port) };
        } else {
          const myBestBp = bestBp;
          const peerBestBp = deviceBestBpdu.get(peerId);
          if (!peerBestBp) return;

          let isDesignated = false;
          if (myBestBp.rootPathCost < peerBestBp.rootPathCost) {
            isDesignated = true;
          } else if (myBestBp.rootPathCost === peerBestBp.rootPathCost) {
            const myBridgeId = vlanStpState.bridgeId;
            const peerBridgeId = calculateBridgeId(getBridgePriority(peerState, vlanId), peerState.macAddress);

            if (myBridgeId < peerBridgeId) {
              isDesignated = true;
            } else if (myBridgeId === peerBridgeId) {
              isDesignated = getPortNumber(portId) < getPortNumber(peerPortId);
            }
          }

          if (isDesignated || portBundle) {
            vlanStpState.ports[portId] = { role: 'designated', state: 'forwarding', cost: getPortCost(port) };
          } else {
            vlanStpState.ports[portId] = { role: 'alternate', state: 'blocking', cost: getPortCost(port) };
          }

          // Dispatch STP BPDU packet to packet capture panel
          if (typeof window !== 'undefined') {
            const connId = conn.id || `${conn.sourceDeviceId}-${conn.targetDeviceId}`;
            dispatchCapturedPackets([{
              connectionId: connId,
              sourceIp: state.hostname || deviceId,
              targetIp: '01:80:C2:00:00:00',
              protocol: 'STP',
              length: 60,
              info: `STP BPDU: Root ${bestBp.rootBridgeId.split('.').slice(-2).join('.')} Cost ${bestBp.rootPathCost} Sender ${vlanStpState.bridgeId.split('.').slice(-2).join('.')}`
            }]);
          }
        }
      }
    });

    if (!state.stpState) state.stpState = {};
    state.stpState[vlanId] = vlanStpState;

    if (vlanId === 1) {
      syncPortStatusVlan1(state, vlanStpState);
    }
  });

  // Rapid-PVST synchronizes an eligible link with a proposal/agreement exchange.
  // This runs after all port roles are known so both ends can participate.
  switchIds.forEach(deviceId => {
    const state = deviceStates.get(deviceId);
    const localVlanState = state?.stpState?.[vlanId];
    if (!state || !localVlanState || state.spanningTreeMode !== 'rapid-pvst') return;

    connections.forEach(conn => {
      if (!conn.active) return;
      const peerId = conn.sourceDeviceId === deviceId ? conn.targetDeviceId : conn.sourceDeviceId;
      if (!switchIds.includes(peerId)) return;
      const localPortId = conn.sourceDeviceId === deviceId ? conn.sourcePort : conn.targetPort;
      const peerPortId = conn.sourceDeviceId === deviceId ? conn.targetPort : conn.sourcePort;
      const peerState = deviceStates.get(peerId);
      const localPort = localVlanState.ports[localPortId];
      const peerVlanState = peerState?.stpState?.[vlanId];
      const peerPort = peerVlanState?.ports[peerPortId];
      if (!peerState || !localPort || !peerPort || peerState.spanningTreeMode !== 'rapid-pvst') return;

      if (localPort.role === 'designated') localPort.proposal = true;
      if (localPort.role === 'root' && peerPort.role === 'designated') localPort.agreement = true;
    });
  });
}


function syncPortStatusVlan1(state: SwitchState, vlanStpState: StpVlanState) {
  const processedPorts = new Set<string>();

  Object.keys(vlanStpState.ports).forEach(pId => {
    const pInfo = vlanStpState.ports[pId];
    const port = state.ports[pId];
    if (port) {
      if (!port.spanningTree) port.spanningTree = {};
      const oldState = port.spanningTree.state;
      port.spanningTree.role = pInfo.role;
      port.spanningTree.state = pInfo.state;
      if (!port.shutdown) {
        port.status = pInfo.state === 'blocking' ? 'blocked' : 'connected';
      }
      processedPorts.add(pId);

      if (oldState && oldState !== pInfo.state) {
        if (!state.eventLogs) state.eventLogs = [];
        state.eventLogs.push(`%STP-6-TOPOTRAP: Topology change detected on interface ${pId} (${oldState} -> ${pInfo.state})`);
      }
    }
  });

  // Clear stale blocking status from ports not in the current STP state
  // (e.g., VLAN membership changed, device type changed, etc.)
  Object.keys(state.ports).forEach(pId => {
    if (!processedPorts.has(pId)) {
      const port = state.ports[pId];
      if (port) {
        if (port.status === 'blocked') {
          port.status = 'notconnect';
        }
        if (port.spanningTree) {
          port.spanningTree.role = undefined;
          port.spanningTree.state = undefined;
        }
      }
    }
  });
}

function isPortVlanMember(port: Port, vlanId: number): boolean {
  if (port.mode === 'trunk' || port.mode === 'dynamic-auto' || port.mode === 'dynamic-desirable' || port.mode === 'dot1q-tunnel') {
    const allowed = port.allowedVlans ?? port.trunkAllowedVlans;
    if (!allowed || allowed === 'all') return true;
    if (Array.isArray(allowed)) return allowed.map(Number).includes(vlanId);
    if (typeof allowed === 'string') {
      if (allowed.trim().toLowerCase() === 'all') return true;
      return allowed.split(',').some(part => {
        const trimmed = part.trim();
        if (!trimmed) return false;
        const [startRaw, endRaw] = trimmed.split('-');
        const start = Number(startRaw);
        const end = endRaw ? Number(endRaw) : start;
        return Number.isFinite(start) && Number.isFinite(end) && vlanId >= start && vlanId <= end;
      });
    }
    return true;
  }
  return Number(port.accessVlan || port.vlan || 1) === vlanId;
}
