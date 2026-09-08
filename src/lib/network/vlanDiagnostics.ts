/**
 * vlanDiagnostics.ts — VLAN and Trunk Mismatch Diagnostic Utility
 *
 * Scans network topology connections and identifies:
 * - Native VLAN Mismatch between connected trunk ports
 * - Access VLAN Mismatch between connected access ports
 * - Tagged frame drops due to unallowed VLANs on trunk
 */

import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import type { SwitchState, Port } from './types';
import { normalizeMAC } from '@/lib/utils';

export interface VlanDiagnosticIssue {
  type: 'NATIVE_VLAN_MISMATCH' | 'ACCESS_VLAN_MISMATCH' | 'TRUNK_ALLOWED_MISMATCH' | 'TRUNK_ACCESS_MODE_MISMATCH';
  severity: 'warning' | 'error';
  connectionId: string;
  sourceDeviceName: string;
  sourcePortId: string;
  sourceVlan: number | string;
  targetDeviceName: string;
  targetPortId: string;
  targetVlan: number | string;
  message: string;
  recommendation: string;
}

export function diagnoseVlanMismatches(
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates: Map<string, SwitchState>
): VlanDiagnosticIssue[] {
  const issues: VlanDiagnosticIssue[] = [];
  const deviceMap = new Map<string, CanvasDevice>(devices.map(d => [d.id, d]));

  const resolveAllowedVlans = (port: Port): number[] | null => {
    const allowed = port.allowedVlans;
    if (allowed === 'all' || allowed === undefined || allowed === null) return null;
    return Array.isArray(allowed) ? allowed.map(Number) : [];
  };

  for (const conn of connections) {
    const srcDevice = deviceMap.get(conn.sourceDeviceId);
    const tgtDevice = deviceMap.get(conn.targetDeviceId);
    const srcState = deviceStates.get(conn.sourceDeviceId);
    const tgtState = deviceStates.get(conn.targetDeviceId);

    if (!srcDevice || !tgtDevice || !srcState || !tgtState) continue;

    const srcPort: Port | undefined = srcState.ports?.[conn.sourcePort];
    const tgtPort: Port | undefined = tgtState.ports?.[conn.targetPort];

    if (!srcPort || !tgtPort || srcPort.shutdown || tgtPort.shutdown) continue;

    const srcIsTrunk = srcPort.mode === 'trunk';
    const tgtIsTrunk = tgtPort.mode === 'trunk';

    // Trunk Native VLAN Mismatch
    if (srcIsTrunk && tgtIsTrunk) {
      const srcNative = srcPort.nativeVlan ?? 1;
      const tgtNative = tgtPort.nativeVlan ?? 1;

      if (srcNative !== tgtNative) {
        issues.push({
          type: 'NATIVE_VLAN_MISMATCH',
          severity: 'error',
          connectionId: conn.id,
          sourceDeviceName: srcDevice.name,
          sourcePortId: srcPort.id,
          sourceVlan: srcNative,
          targetDeviceName: tgtDevice.name,
          targetPortId: tgtPort.id,
          targetVlan: tgtNative,
          message: `Native VLAN mismatch on link ${srcDevice.name} (${srcPort.id}: Native VLAN ${srcNative}) <-> ${tgtDevice.name} (${tgtPort.id}: Native VLAN ${tgtNative})`,
          recommendation: `Align native VLAN on both ends: "switchport trunk native vlan ${srcNative}"`,
        });
      }

      // Trunk Allowed VLAN Discrepancy. 'all'/undefined means every VLAN is
      // allowed, so a specific list only creates a mismatch when the other side
      // has a different explicit restriction.
      const srcAllowed = resolveAllowedVlans(srcPort);
      const tgtAllowed = resolveAllowedVlans(tgtPort);
      if (srcAllowed !== null && tgtAllowed !== null) {
        const srcSet = new Set(srcAllowed);
        const tgtSet = new Set(tgtAllowed);
        const diffSrc = srcAllowed.filter(v => !tgtSet.has(v));
        const diffTgt = tgtAllowed.filter(v => !srcSet.has(v));

        if (diffSrc.length > 0 || diffTgt.length > 0) {
          issues.push({
            type: 'TRUNK_ALLOWED_MISMATCH',
            severity: 'warning',
            connectionId: conn.id,
            sourceDeviceName: srcDevice.name,
            sourcePortId: srcPort.id,
            sourceVlan: srcAllowed.join(','),
            targetDeviceName: tgtDevice.name,
            targetPortId: tgtPort.id,
            targetVlan: tgtAllowed.join(','),
            message: `Allowed VLAN mismatch between trunks ${srcDevice.name}:${srcPort.id} (${srcAllowed.join(',')}) and ${tgtDevice.name}:${tgtPort.id} (${tgtAllowed.join(',')})`,
            recommendation: 'Ensure both trunk ports allow the same set of VLAN IDs',
          });
        }
      }
    }

    // Trunk-to-access mode mismatch: a trunk meeting a non-trunk port drops
    // tagged frames on the access side. Only meaningful for switch-type links.
    if (srcIsTrunk !== tgtIsTrunk) {
      const srcIsSwitch = srcDevice.type === 'switchL2' || srcDevice.type === 'switchL3';
      const tgtIsSwitch = tgtDevice.type === 'switchL2' || tgtDevice.type === 'switchL3';
      if (srcIsSwitch && tgtIsSwitch) {
        const trunkSide = srcIsTrunk ? srcDevice : tgtDevice;
        const trunkPort = srcIsTrunk ? srcPort : tgtPort;
        const accessSide = tgtIsTrunk ? srcDevice : tgtDevice;
        const accessPort = tgtIsTrunk ? srcPort : tgtPort;
        issues.push({
          type: 'TRUNK_ACCESS_MODE_MISMATCH',
          severity: 'error',
          connectionId: conn.id,
          sourceDeviceName: srcDevice.name,
          sourcePortId: srcPort.id,
          sourceVlan: srcPort.mode,
          targetDeviceName: tgtDevice.name,
          targetPortId: tgtPort.id,
          targetVlan: tgtPort.mode,
          message: `Trunk/Access mode mismatch: ${trunkSide.name}:${trunkPort.id} is ${trunkPort.mode} but ${accessSide.name}:${accessPort.id} is ${accessPort.mode}`,
          recommendation: `Switch both ends to the same mode: "switchport mode trunk" or "switchport mode access"`,
        });
      }
    }

    // Access VLAN Mismatch between switches
    if (!srcIsTrunk && !tgtIsTrunk) {
      const srcVlan = srcPort.accessVlan ?? srcPort.vlan ?? 1;
      const tgtVlan = tgtPort.accessVlan ?? tgtPort.vlan ?? 1;

      // If both are switch ports or switch to host
      const isSwitchSrc = srcDevice.type === 'switchL2' || srcDevice.type === 'switchL3';
      const isSwitchTgt = tgtDevice.type === 'switchL2' || tgtDevice.type === 'switchL3';

      if (isSwitchSrc && isSwitchTgt && srcVlan !== tgtVlan) {
        issues.push({
          type: 'ACCESS_VLAN_MISMATCH',
          severity: 'warning',
          connectionId: conn.id,
          sourceDeviceName: srcDevice.name,
          sourcePortId: srcPort.id,
          sourceVlan: srcVlan,
          targetDeviceName: tgtDevice.name,
          targetPortId: tgtPort.id,
          targetVlan: tgtVlan,
          message: `Access VLAN mismatch on switch-to-switch link: ${srcDevice.name} (${srcPort.id}: VLAN ${srcVlan}) <-> ${tgtDevice.name} (${tgtPort.id}: VLAN ${tgtVlan})`,
          recommendation: 'Configure matching access VLAN or change link mode to trunk',
        });
      }
    }
  }

  return issues;
}

/**
 * Log VLAN mismatch diagnostic alerts into device event logs (%CDP-4-NATIVE_VLAN_MISMATCH)
 */
export function logVlanDiagnosticsToDevices(
  issues: VlanDiagnosticIssue[],
  deviceStates: Map<string, SwitchState>
): void {
  for (const issue of issues) {
    if (issue.type === 'NATIVE_VLAN_MISMATCH') {
      const logMsg = `%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on ${issue.sourcePortId} (VLAN ${issue.sourceVlan}), with ${issue.targetDeviceName} ${issue.targetPortId} (VLAN ${issue.targetVlan}).`;
      deviceStates.forEach(state => {
        if (state.hostname === issue.sourceDeviceName || state.hostname === issue.targetDeviceName) {
          if (!state.eventLogs) state.eventLogs = [];
          if (!state.eventLogs.includes(logMsg)) {
            state.eventLogs.push(logMsg);
          }
        }
      });
    }
  }
}

export interface DuplicateAddressIssue {
  type: 'DUPLICATE_IP' | 'DUPLICATE_MAC';
  address: string;
  devices: { deviceId: string; deviceName: string; portId?: string }[];
  message: string;
}

/**
 * Detect Duplicate IP and MAC addresses across topology devices
 */
export function diagnoseDuplicateAddresses(
  devices: CanvasDevice[],
  deviceStates: Map<string, SwitchState>
): DuplicateAddressIssue[] {
  const issues: DuplicateAddressIssue[] = [];
  const ipMap = new Map<string, { deviceId: string; deviceName: string; portId?: string }[]>();
  const macMap = new Map<string, { deviceId: string; deviceName: string; portId?: string }[]>();

  devices.forEach(device => {
    const state = deviceStates.get(device.id);

    // Canvas device IP/MAC
    if (device.ip) {
      const existing = ipMap.get(device.ip) || [];
      existing.push({ deviceId: device.id, deviceName: device.name });
      ipMap.set(device.ip, existing);
    }
    const devMac = device.macAddress;
    if (devMac) {
      const key = normalizeMAC(devMac);
      const existing = macMap.get(key) || [];
      existing.push({ deviceId: device.id, deviceName: device.name });
      macMap.set(key, existing);
    }

    // Port IPs & MACs
    if (state?.ports) {
      Object.values(state.ports).forEach(port => {
        if (port.ipAddress && !port.shutdown) {
          const existing = ipMap.get(port.ipAddress) || [];
          if (!existing.some(e => e.deviceId === device.id && e.portId === port.id)) {
            existing.push({ deviceId: device.id, deviceName: device.name, portId: port.id });
            ipMap.set(port.ipAddress, existing);
          }
        }
        if (port.macAddress && !port.shutdown) {
          const key = normalizeMAC(port.macAddress);
          const existing = macMap.get(key) || [];
          if (!existing.some(e => e.deviceId === device.id && e.portId === port.id)) {
            existing.push({ deviceId: device.id, deviceName: device.name, portId: port.id });
            macMap.set(key, existing);
          }
        }
      });
    }
  });

  // Check duplicate IPs
  ipMap.forEach((entryList, ip) => {
    const uniqueDevices = new Set(entryList.map(e => e.deviceId));
    if (entryList.length > 1 && uniqueDevices.size > 1) {
      const names = entryList.map(e => `${e.deviceName}${e.portId ? ` (${e.portId})` : ''}`).join(', ');
      const msg = `%IP-4-DUPARP: Duplicate IP address ${ip} detected on ${names}`;
      issues.push({
        type: 'DUPLICATE_IP',
        address: ip,
        devices: entryList,
        message: msg,
      });

      // Log to device event logs
      entryList.forEach(e => {
        const state = deviceStates.get(e.deviceId);
        if (state) {
          if (!state.eventLogs) state.eventLogs = [];
          if (!state.eventLogs.includes(msg)) state.eventLogs.push(msg);
        }
      });
    }
  });

  // Check duplicate MACs
  macMap.forEach((entryList, mac) => {
    const uniqueDevices = new Set(entryList.map(e => e.deviceId));
    if (entryList.length > 1 && uniqueDevices.size > 1) {
      const names = entryList.map(e => `${e.deviceName}${e.portId ? ` (${e.portId})` : ''}`).join(', ');
      const msg = `%MAC-4-DUPLICATE: Duplicate MAC address ${mac} detected on ${names}`;
      issues.push({
        type: 'DUPLICATE_MAC',
        address: mac,
        devices: entryList,
        message: msg,
      });

      entryList.forEach(e => {
        const state = deviceStates.get(e.deviceId);
        if (state) {
          if (!state.eventLogs) state.eventLogs = [];
          if (!state.eventLogs.includes(msg)) state.eventLogs.push(msg);
        }
      });
    }
  });

  return issues;
}

export interface OrphanDiagnosticIssue {
  type: 'ORPHAN_DEVICE' | 'ORPHAN_PORT';
  deviceId: string;
  deviceName: string;
  portId?: string;
  message: string;
}

/**
 * Detect isolated devices and unconnected configured ports
 */
export function diagnoseOrphanDevices(
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates: Map<string, SwitchState>
): OrphanDiagnosticIssue[] {
  const issues: OrphanDiagnosticIssue[] = [];
  const connectedDeviceIds = new Set<string>();
  const connectedPortKeys = new Set<string>();

  connections.forEach(conn => {
    connectedDeviceIds.add(conn.sourceDeviceId);
    connectedDeviceIds.add(conn.targetDeviceId);
    connectedPortKeys.add(`${conn.sourceDeviceId}:${conn.sourcePort}`);
    connectedPortKeys.add(`${conn.targetDeviceId}:${conn.targetPort}`);
  });

  devices.forEach(device => {
    if (!connectedDeviceIds.has(device.id)) {
      issues.push({
        type: 'ORPHAN_DEVICE',
        deviceId: device.id,
        deviceName: device.name,
        message: `Device ${device.name} is completely isolated (no connected links)`,
      });
    } else {
      const state = deviceStates.get(device.id);
      if (state?.ports) {
        Object.values(state.ports).forEach(port => {
          const isConfigured = !port.shutdown && (port.ipAddress || port.mode === 'trunk' || (port.accessVlan && port.accessVlan !== 1));
          const isConnected = connectedPortKeys.has(`${device.id}:${port.id}`);
          if (isConfigured && !isConnected) {
            issues.push({
              type: 'ORPHAN_PORT',
              deviceId: device.id,
              deviceName: device.name,
              portId: port.id,
              message: `Port ${port.id} on ${device.name} is configured but not connected to any cable`,
            });
          }
        });
      }
    }
  });

  return issues;
}
