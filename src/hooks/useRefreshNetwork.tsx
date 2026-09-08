'use client';

import { useCallback, Dispatch, SetStateAction } from 'react';
import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import type { SwitchState } from '@/lib/network/types';
import type { PCOutputLine } from '@/app/page.types';

import type { RefreshNetworkReport } from '@/hooks/useRefreshReport';
import { isSwitchDeviceType, isWirelessMatch, validateTopologyConnections, releaseDisconnectedPorts, getEffectiveWifi, hasValidIp, isIpInPoolRange, buildRefreshDeviceSummaries, propagateVtpVlans } from '@/app/refreshNetworkUtils';
import { recalculateStp } from '@/lib/network/stp';
import { evaluateSlaacForDevice, evaluateDhcpv6ForDevice } from '@/lib/network/eui64';
import { recalculateBgpNeighbors } from '@/lib/network/routing';
import { evaluatePppoeSessions } from '@/lib/network/pppoeEngine';
import { normalizeMAC } from '@/lib/utils';

import { useAppStore } from '@/lib/store/appStore';

export function useRefreshNetwork({
  setActiveDeviceId,
  setSelectedDevice,
  setTopologyConnections,
  setPcOutputs,
  setDeviceStates,
  setTopologyDevices,
  setRefreshNetworkReport,
  topologyDevices,
  topologyConnections,
  deviceStates,
  pcOutputs,
  language,
  t,
  isValidIpv4,
  isSameSubnetByMask,
  iotAutomationPass,
  assignDhcpLeaseForPc,
  buildLinkLocalLease,
  toast,
}: {
  setActiveDeviceId: (id: string) => void;
  setSelectedDevice: (device: null) => void;
  setTopologyConnections: (connections: CanvasConnection[]) => void;
  setPcOutputs: (updater: (prev: Map<string, PCOutputLine[]>) => Map<string, PCOutputLine[]>) => void;
  setDeviceStates: (states: Map<string, SwitchState>) => void;
  setTopologyDevices: (devices: CanvasDevice[]) => void;
  setRefreshNetworkReport: Dispatch<SetStateAction<RefreshNetworkReport | null>>;
  topologyDevices: CanvasDevice[];
  topologyConnections: CanvasConnection[];
  deviceStates: Map<string, SwitchState>;
  pcOutputs: Map<string, PCOutputLine[]>;
  language: string;
  t: Record<string, string>;
  isValidIpv4: (ip: string) => boolean;
  isSameSubnetByMask: (ip1: string, ip2: string, mask?: string) => boolean;
  iotAutomationPass: (devices: CanvasDevice[]) => CanvasDevice[];
  assignDhcpLeaseForPc: (pc: CanvasDevice, allDevices: CanvasDevice[], states: Map<string, SwitchState>, connections: CanvasConnection[]) => { ip: string; subnet: string; gateway: string; dns: string } | null;
  buildLinkLocalLease: (pc: CanvasDevice, allDevices: CanvasDevice[]) => { ip: string; subnet: string; gateway: string; dns: string } | null;
  toast: (params: { title: string; description: string | React.ReactNode; duration?: number; variant?: 'default' | 'destructive' }) => void;
}) {
  const addNetworkEventLog = useAppStore(state => state.addNetworkEventLog);

  const handleRefreshNetwork = useCallback(() => {
    setActiveDeviceId('');
    setSelectedDevice(null);
    window.dispatchEvent(new CustomEvent('network-refresh'));

    const disconnectedPCs: string[] = [];
    const disconnectedAPs: string[] = [];
    const connectedWirelessClients: string[] = [];
    const activeAPs: string[] = [];
    let dhcpServerActiveCount = 0;
    let dhcpServerNoPoolCount = 0;
    let dhcpClientWithLeaseCount = 0;
    let dhcpClientNoLeaseCount = 0;
    let duplicateIpCount = 0;
    let duplicateMacCount = 0;
    let duplicateIpv6Count = 0;
    let subnetMismatchCount = 0;
    let invalidGatewayCount = 0;
    let disconnectedLinkCount = 0;
    let loopDetectedCount = 0;
    let vlanInconsistencyCount = 0;

    if (topologyDevices && deviceStates) {
      const { sanitizedConnections, invalidCount } = validateTopologyConnections(topologyDevices, topologyConnections);
      const connectionsChanged = sanitizedConnections.some((connection, index) => connection !== topologyConnections[index]);
      if (connectionsChanged) {
        setTopologyConnections(sanitizedConnections);
      }

      const releasedTopology = releaseDisconnectedPorts(topologyDevices, deviceStates, sanitizedConnections);
      let refreshedDevices = releasedTopology.devices.map((device) => ({
        ...device,
        wifi: getEffectiveWifi(device, deviceStates),
      }));
      const releasedDeviceStates = releasedTopology.states;

      refreshedDevices = refreshedDevices.map((device) => {
        if (device.type !== 'pc' && device.type !== 'iot' && device.type !== 'mobile' && device.type !== 'printer') return device;
        const clientWifi = device.wifi;
        if (!clientWifi?.enabled || clientWifi.mode !== 'client' || !clientWifi.ssid) return device;

        const matchedAp = refreshedDevices.find((ap) =>
          ap.id !== device.id &&
          (ap.type === 'router' || ap.type === 'wlc' || isSwitchDeviceType(ap.type)) &&
          isWirelessMatch(device, ap)
        );

        if (matchedAp) {
          connectedWirelessClients.push(device.name || device.id);
          return {
            ...device,
            wifi: {
              ...clientWifi,
              bssid: matchedAp.id,
            },
          };
        }

        disconnectedPCs.push(device.name || device.id);
        return {
          ...device,
          wifi: {
            ...clientWifi,
            bssid: undefined,
          },
        };
      });

      refreshedDevices.filter(d => d.type === 'router' || d.type === 'wlc' || isSwitchDeviceType(d.type)).forEach(ap => {
        const apWifi = ap.wifi;
        if (!apWifi || apWifi.mode !== 'ap' || !apWifi.ssid) return;

        let hasClient = false;

        refreshedDevices.forEach(pc => {
          if (pc.type !== 'pc' && pc.type !== 'iot' && pc.type !== 'mobile' && pc.type !== 'printer') return;
          const pcWifi = pc.wifi;
          if (!pcWifi?.enabled || pcWifi.mode !== 'client') return;
          if (pcWifi.bssid !== ap.id) return;

          hasClient = true;
        });

        if (hasClient) {
          activeAPs.push(ap.name || ap.id);
        } else {
          disconnectedAPs.push(ap.name || ap.id);
        }
      });

      const vtpUpdatedStates = propagateVtpVlans(refreshedDevices, releasedDeviceStates, sanitizedConnections);
      const stpUpdatedStates = recalculateStp(vtpUpdatedStates, sanitizedConnections);
      const bgpUpdatedStates = recalculateBgpNeighbors(stpUpdatedStates);
      const pppoeUpdatedStates = evaluatePppoeSessions(bgpUpdatedStates, sanitizedConnections);
      const stpUpdatedCount = Array.from(vtpUpdatedStates.keys()).filter(id => {
        const d = refreshedDevices.find(dev => dev.id === id);
        return d && (d.type === 'switchL2' || d.type === 'switchL3');
      }).length;

      const dhcpClients = refreshedDevices.filter(d => (d.type === 'pc' || d.type === 'iot' || d.type === 'mobile' || d.type === 'printer') && d.ipConfigMode === 'dhcp');
      const dhcpAssignments: Array<{ name: string, ip: string }> = [];
      const finalDevicesForRefresh = [...refreshedDevices];

      // Evaluate SLAAC for PCs attached to routers configured with RA enabled (no ipv6 nd suppress-ra)
      refreshedDevices.forEach(d => {
        if (d.type === 'pc' || d.type === 'iot') {
          const slaac = evaluateSlaacForDevice(d.id, pppoeUpdatedStates, sanitizedConnections);
          if (slaac?.ipv6Address) {
            const idx = finalDevicesForRefresh.findIndex(dev => dev.id === d.id);
            if (idx !== -1) {
              finalDevicesForRefresh[idx] = {
                ...finalDevicesForRefresh[idx],
                ipv6: slaac.ipv6Address
              };
            }
          }
        }
      });

      // Evaluate DHCPv6 for PCs attached to routers with 'ipv6 dhcp server <pool>' configured
      refreshedDevices.forEach(d => {
        if (d.type === 'pc' || d.type === 'iot') {
          const dhcpv6 = evaluateDhcpv6ForDevice(d.id, pppoeUpdatedStates, sanitizedConnections);

          if (dhcpv6?.ipv6Address) {
            const idx = finalDevicesForRefresh.findIndex(dev => dev.id === d.id);
            if (idx !== -1) {
              finalDevicesForRefresh[idx] = {
                ...finalDevicesForRefresh[idx],
                ipv6: dhcpv6.ipv6Address
              };
            }
          }
        }
      });

      if (dhcpClients.length > 0) {
        dhcpClients.forEach(pc => {
          // Preserve existing valid DHCP leases — only reassign if the device
          // has no IP, a link-local (169.254.x.x) fallback, or its current IP
          // falls outside every available DHCP pool (e.g. pool was resized/removed).
          const currentIp = pc.ip;
          const isLinkLocal = currentIp?.startsWith('169.254.') ?? false;
          const hasLease = currentIp && currentIp !== '0.0.0.0' && !isLinkLocal;
          const ipInPool = hasLease && (() => {
            for (const dev of finalDevicesForRefresh) {
              if (dev.id === pc.id) continue;
              // Topology DHCP pools (PC-type servers)
              if (dev.type === 'pc' && dev.services?.dhcp?.enabled) {
                for (const pool of (dev.services?.dhcp?.pools || [])) {
                  if (pool.startIp && pool.maxUsers && isIpInPoolRange(currentIp, { startIp: pool.startIp, maxUsers: pool.maxUsers })) return true;
                }
              }
              // CLI-configured DHCP pools (router/switch)
              const state = stpUpdatedStates.get(dev.id);
              if (state && (dev.type === 'router' || dev.type === 'switchL2' || dev.type === 'switchL3' || dev.type === 'wlc')) {
                for (const poolName in (state.dhcpPools || {})) {
                  const pool = state.dhcpPools![poolName];
                  if (pool.network && pool.subnetMask) {
                    if (isIpInPoolRange(currentIp, { startIp: `${pool.network.replace(/\.\d+$/, '')}.100`, maxUsers: 154 })) return true;
                  }
                }
                for (const pool of (state.services?.dhcp?.pools || [])) {
                  if (pool.startIp && pool.maxUsers && isIpInPoolRange(currentIp, { startIp: pool.startIp, maxUsers: pool.maxUsers })) return true;
                }
              }
            }
            return false;
          })();

          if (ipInPool) return; // already has a valid DHCP lease in a pool — skip reassignment

          const validDhcpLease = assignDhcpLeaseForPc(pc, finalDevicesForRefresh, stpUpdatedStates, sanitizedConnections);
          const lease = validDhcpLease || buildLinkLocalLease(pc, finalDevicesForRefresh);
          if (lease) {
            const idx = finalDevicesForRefresh.findIndex(d => d.id === pc.id);
            if (idx !== -1) {
              finalDevicesForRefresh[idx] = {
                ...finalDevicesForRefresh[idx],
                ip: lease.ip,
                subnet: lease.subnet,
                gateway: lease.gateway,
                dns: lease.dns
              };
              if (!lease.ip.startsWith('169.254.')) {
                dhcpAssignments.push({ name: pc.name || pc.id, ip: lease.ip });
              }

              const pcOut = pcOutputs.get(pc.id);
              if (pcOut) {
                const updatedOut = pcOut.map(line => {
                  if (line.id === '1' || line.content?.includes('IPv4 Address')) {
                    return {
                      ...line,
                      content: `\nEthernet adapter Ethernet connection:\n   IPv4 Address. . . . . . . . . . . : ${lease.ip}\n   Subnet Mask . . . . . . . . . . : ${lease.subnet}\n   Default Gateway . . . . . . . . . : ${lease.gateway}\n`
                    };
                  }
                  return line;
                });
                setPcOutputs(prev => new Map(prev).set(pc.id, updatedOut as unknown as PCOutputLine[]));
              }
            }
          }
        });

        if (dhcpAssignments.length > 0) {
          toast({
            title: `\uD83D\uDCDD ${t.dhcpAssignments}`,
            description: (
              <div className="flex flex-col gap-1 text-xs">
                {dhcpAssignments.map((asgn, i) => (
                  <div key={i} className="flex justify-between gap-4">
                    <span className="font-medium">{asgn.name}:</span>
                    <span className="text-primary-400">{asgn.ip}</span>
                  </div>
                ))}
              </div>
            ),
            duration: 4000,
          });
          addNetworkEventLog({
            level: 'info',
            category: 'DHCP',
            message: t.dhcpAssignments || (language === 'tr' ? 'DHCP Atamaları' : 'DHCP Assignments'),
            detail: dhcpAssignments.map(asgn => `${asgn.name}: ${asgn.ip}`).join('\n'),
          });
        }
      }

      const portSecurityUpdatedStates = new Map(bgpUpdatedStates);
      let portSecurityViolationCount = 0;
      let portSecurityRecoveredCount = 0;

      sanitizedConnections.forEach(conn => {
        if (!conn.active) return;

        const switchDevice = finalDevicesForRefresh.find(d =>
          (d.type === 'switchL2' || d.type === 'switchL3') &&
          (d.id === conn.sourceDeviceId || d.id === conn.targetDeviceId)
        );
        const connectedDevice = finalDevicesForRefresh.find(d =>
          d.type === 'pc' &&
          (d.id === conn.sourceDeviceId || d.id === conn.targetDeviceId)
        );

        if (!switchDevice || !connectedDevice) return;

        const switchPortId = switchDevice.id === conn.sourceDeviceId ? conn.sourcePort : conn.targetPort;
        const switchState = portSecurityUpdatedStates.get(switchDevice.id);
        if (!switchState) return;

        const switchPort = switchState.ports[switchPortId];
        if (!switchPort?.portSecurity?.enabled) return;

        const deviceMac = connectedDevice.macAddress;
        if (!deviceMac) return;

        const normalizedDeviceMac = deviceMac.toLowerCase().replace(/[-:.]/g, '');
        const staticMacs = switchPort.staticMacs || [];
        const normalizedStaticMacs = staticMacs.map(m => m.toLowerCase().replace(/[-:.]/g, ''));

        const isAllowed = normalizedStaticMacs.includes(normalizedDeviceMac);

        const updatedPorts = { ...switchState.ports };

        if (!isAllowed) {
          if (!switchPort.shutdown || switchPort.status !== 'err-disabled') {
            updatedPorts[switchPortId] = {
              ...switchPort,
              shutdown: true,
              status: 'err-disabled',
              portSecurity: switchPort.portSecurity ? {
                ...switchPort.portSecurity,
                violations: (switchPort.portSecurity.violations || 0) + 1
              } : undefined
            };
            portSecurityUpdatedStates.set(switchDevice.id, {
              ...switchState,
              ports: updatedPorts
            });
            portSecurityViolationCount++;
          }
        } else {
          if (switchPort.shutdown && switchPort.status === 'err-disabled') {
            updatedPorts[switchPortId] = {
              ...switchPort,
              shutdown: false,
              status: 'connected',
              portSecurity: switchPort.portSecurity ? {
                ...switchPort.portSecurity
              } : undefined
            };
            portSecurityUpdatedStates.set(switchDevice.id, {
              ...switchState,
              ports: updatedPorts
            });
            portSecurityRecoveredCount++;
          }
        }
      });

      setDeviceStates(portSecurityUpdatedStates);

      const stpSyncedDevices = finalDevicesForRefresh.map((device) => {
        const deviceState = portSecurityUpdatedStates.get(device.id);
        if (!deviceState || !deviceState.ports) return device;

        const updatedPorts = device.ports.map((port) => {
          const statePort = deviceState.ports[port.id];
          if (statePort) {
            return {
              ...port,
              spanningTree: statePort.spanningTree,
              shutdown: statePort.shutdown,
              portSecurity: statePort.portSecurity
            };
          }
          return port;
        });

        return {
          ...device,
          ports: updatedPorts
        };
      });

      const iotProcessedDevices = iotAutomationPass(stpSyncedDevices);
      setTopologyDevices(iotProcessedDevices);

      const allDhcpPools: Array<{ startIp: string; maxUsers: number }> = [];
      dhcpServerActiveCount = 0;
      dhcpServerNoPoolCount = 0;
      dhcpClientWithLeaseCount = 0;
      dhcpClientNoLeaseCount = 0;

      iotProcessedDevices.forEach((device) => {
        const state = portSecurityUpdatedStates.get(device.id);
        const topologyPools = device.services?.dhcp?.pools || [];
        const runtimePools = state?.services?.dhcp?.pools || [];
        const cliPoolEntries = Object.values(state?.dhcpPools || {});
        const cliPools = cliPoolEntries.map((pool: Record<string, unknown>) => {
          const networkPrefix = ((pool?.network as string) || '').split('.').slice(0, 3).join('.');
          return {
            startIp: (pool?.startIp as string) || (networkPrefix ? `${networkPrefix}.100` : ''),
            maxUsers: Number(pool?.maxUsers || 50),
          };
        }).filter((p: Record<string, unknown>) => p.startIp);
        const poolCount = topologyPools.length + runtimePools.length + cliPools.length;
        const dhcpEnabled = !!(device.services?.dhcp?.enabled || state?.services?.dhcp?.enabled || cliPoolEntries.length > 0);

        if (dhcpEnabled) {
          if (poolCount > 0) dhcpServerActiveCount++;
          else dhcpServerNoPoolCount++;
        }

        topologyPools.forEach((p) => allDhcpPools.push({ startIp: p.startIp, maxUsers: Number(p.maxUsers || 50) }));
        runtimePools.forEach((p) => allDhcpPools.push({ startIp: p.startIp, maxUsers: Number(p.maxUsers || 50) }));
        cliPools.forEach((p: Record<string, unknown>) => allDhcpPools.push({ startIp: p.startIp as string, maxUsers: Number(p.maxUsers || 50) }));
      });

      iotProcessedDevices.forEach((device) => {
        if ((device.type !== 'pc' && device.type !== 'iot' && device.type !== 'mobile' && device.type !== 'printer') || device.ipConfigMode !== 'dhcp') return;
        const state = portSecurityUpdatedStates.get(device.id);
        const runtimeIp = state?.ports?.['eth0']?.ipAddress || state?.ports?.['wlan0']?.ipAddress || '';
        const candidateIp = hasValidIp(device.ip) ? device.ip : runtimeIp;
        const hasLease = !!candidateIp &&
          !candidateIp.startsWith('169.254.') &&
          allDhcpPools.some((pool) => isIpInPoolRange(candidateIp, pool));

        if (hasLease) dhcpClientWithLeaseCount++;
        else dhcpClientNoLeaseCount++;
      });

      const refreshDeviceSummaries = buildRefreshDeviceSummaries(iotProcessedDevices, portSecurityUpdatedStates, deviceStates, language, t.none);

      const ipOwners = new Map<string, string[]>();
      const macOwners = new Map<string, string[]>();
      const ipv6Owners = new Map<string, string[]>();
      const rememberIdentity = (deviceName: string, ip?: string, mac?: string, ipv6?: string) => {
        if (ip && isValidIpv4(ip)) {
          const owners = ipOwners.get(ip) || [];
          owners.push(deviceName);
          ipOwners.set(ip, owners);
        }
        if (mac) {
          const normalized = normalizeMAC(mac || '').toLowerCase();
          if (normalized) {
            const owners = macOwners.get(normalized) || [];
            owners.push(deviceName);
            macOwners.set(normalized, owners);
          }
        }
        if (ipv6 && ipv6.trim()) {
          const normalized = ipv6.trim().toLowerCase();
          const owners = ipv6Owners.get(normalized) || [];
          owners.push(deviceName);
          ipv6Owners.set(normalized, owners);
        }
      };

      iotProcessedDevices.forEach((device) => {
        const deviceName = device.name || device.id;
        rememberIdentity(deviceName, device.ip, device.macAddress, device.ipv6);
        // Port MAC addresses in the generated device templates are interface
        // defaults shared by multiple models. Treating them as device
        // identities creates false collision reports (especially in WLC/AP
        // examples). Device-level MAC addresses are the authoritative values
        // for this topology-wide diagnostic.
        const devState = deviceStates.get(device.id);
        if (devState?.ports) {
          Object.values(devState.ports).forEach((port) => {
            if (port.ipAddress && !port.shutdown) {
              rememberIdentity(`${deviceName}:${port.id}`, port.ipAddress);
            }
          });
        }
      });
      // A device-level address and that same device's interface address are
      // one identity, not a conflict. Only report duplicates across devices.
      const hasCrossDeviceConflict = (owners: string[]) => new Set(owners.map((owner) => owner.split(':')[0])).size > 1;
      duplicateIpCount = Array.from(ipOwners.values()).filter(hasCrossDeviceConflict).length;
      duplicateMacCount = Array.from(macOwners.values()).filter(hasCrossDeviceConflict).length;
      duplicateIpv6Count = Array.from(ipv6Owners.values()).filter(hasCrossDeviceConflict).length;

      const invalidGatewayDevices: string[] = [];
      iotProcessedDevices.forEach((device) => {
        if ((device.type !== 'pc' && device.type !== 'iot') || !device.gateway || !isValidIpv4(device.ip) || !isValidIpv4(device.subnet || '')) return;
        const gateway = device.gateway || '';
        const devName = device.name || device.id;
        if (!isValidIpv4(gateway) || gateway === '0.0.0.0') {
          invalidGatewayCount++;
          invalidGatewayDevices.push(devName);
          return;
        }
        if (!isSameSubnetByMask(device.ip, gateway, device.subnet)) {
          subnetMismatchCount++;
          invalidGatewayCount++;
          if (!invalidGatewayDevices.includes(devName)) {
            invalidGatewayDevices.push(devName);
          }
        }
      });

      sanitizedConnections.forEach((connection) => {
        const aState = portSecurityUpdatedStates.get(connection.sourceDeviceId);
        const bState = portSecurityUpdatedStates.get(connection.targetDeviceId);
        const aPort = aState?.ports?.[connection.sourcePort];
        const bPort = bState?.ports?.[connection.targetPort];
        if (!aPort || !bPort) return;
        const aDown = aPort.shutdown || aPort.adminStatus === 'down' || aPort.operStatus === 'down' || aPort.status === 'blocked' || aPort.status === 'err-disabled';
        const bDown = bPort.shutdown || bPort.adminStatus === 'down' || bPort.operStatus === 'down' || bPort.status === 'blocked' || bPort.status === 'err-disabled';
        if (connection.active === false || aDown || bDown) disconnectedLinkCount++;
      });

      // Treat parallel physical links (for example the two members of an
      // EtherChannel) as one logical edge for loop detection.
      const graph = new Map<string, Set<string>>();
      const addEdge = (a: string, b: string) => {
        if (!graph.has(a)) graph.set(a, new Set<string>());
        if (!graph.has(b)) graph.set(b, new Set<string>());
        graph.get(a)?.add(b);
        graph.get(b)?.add(a);
      };
      sanitizedConnections.forEach((connection) => {
        if (connection.active === false) return;
        addEdge(connection.sourceDeviceId, connection.targetDeviceId);
      });
      const visited = new Set<string>();
      const hasCycle = (node: string, parent: string | null): boolean => {
        visited.add(node);
        for (const next of graph.get(node) || []) {
          if (!visited.has(next)) {
            if (hasCycle(next, node)) return true;
          } else if (next !== parent) {
            return true;
          }
        }
        return false;
      };
      for (const node of graph.keys()) {
        if (!visited.has(node) && hasCycle(node, null)) {
          loopDetectedCount = 1;
          break;
        }
      }

      sanitizedConnections.forEach((connection) => {
        if (connection.active === false) return;
        // End hosts do not participate in 802.1Q/access-VLAN negotiation;
        // their interface state normally has the default VLAN even when the
        // switch access port is assigned to the host's VLAN.
        const sourceDevice = iotProcessedDevices.find((device) => device.id === connection.sourceDeviceId);
        const targetDevice = iotProcessedDevices.find((device) => device.id === connection.targetDeviceId);
        if (sourceDevice?.type === 'pc' || sourceDevice?.type === 'iot' || targetDevice?.type === 'pc' || targetDevice?.type === 'iot') return;
        const aState = portSecurityUpdatedStates.get(connection.sourceDeviceId);
        const bState = portSecurityUpdatedStates.get(connection.targetDeviceId);
        const aPort = aState?.ports?.[connection.sourcePort];
        const bPort = bState?.ports?.[connection.targetPort];
        if (!aPort || !bPort) return;
        // A routed/L3 interface does not carry an access VLAN. An access
        // switch uplink connected to such an interface must not be compared
        // as two Layer-2 access ports.
        if (aPort.mode === 'routed' || bPort.mode === 'routed' || aPort.isRoutedPort || bPort.isRoutedPort) return;
        const aTrunk = aPort.mode === 'trunk';
        const bTrunk = bPort.mode === 'trunk';
        if (aTrunk && bTrunk) {
          if (Number(aPort.nativeVlan || 1) !== Number(bPort.nativeVlan || 1)) vlanInconsistencyCount++;
          return;
        }
        const aVlan = Number(aPort.accessVlan || aPort.vlan || 1);
        const bVlan = Number(bPort.accessVlan || bPort.vlan || 1);
        if (aVlan !== bVlan) vlanInconsistencyCount++;
      });

      const allVlans = new Set<number>();
      let totalRoutes = 0, connectedRoutes = 0, staticRoutes = 0, dynamicRoutes = 0;
      portSecurityUpdatedStates.forEach((state) => {
        if (state.vlans) Object.keys(state.vlans).forEach((vId) => allVlans.add(Number(vId)));
        [state.staticRoutes, state.dynamicRoutes].forEach((routes) => {
          if (!routes) return;
          routes.forEach((r) => {
            totalRoutes++;
            if (r.type === 'connected') connectedRoutes++;
            else if (r.type === 'static') staticRoutes++;
            else if (r.type === 'dynamic') dynamicRoutes++;
          });
        });
        Object.values(state.ports).forEach((port) => {
          if (port.ipAddress && port.subnetMask) {
            totalRoutes++;
            connectedRoutes++;
          }
        });
      });
      const summaryWarnings: string[] = [];
      if (subnetMismatchCount > 0) {
        summaryWarnings.push(language === 'tr' ? `Alt ağ uyumsuzluğu: ${subnetMismatchCount}` : `Subnet mismatch: ${subnetMismatchCount}`);
        addNetworkEventLog({ level: 'warning', category: 'Subnet', message: language === 'tr' ? `Alt ağ uyumsuzluğu tespit edildi (${subnetMismatchCount})` : `Subnet mismatch detected (${subnetMismatchCount})` });
      }
      if (invalidGatewayCount > 0) {
        const devList = invalidGatewayDevices.join(', ');
        summaryWarnings.push(language === 'tr' ? `Geçersiz ağ geçidi (${devList}): ${invalidGatewayCount}` : `Invalid gateway (${devList}): ${invalidGatewayCount}`);
        addNetworkEventLog({
          level: 'warning',
          category: 'Gateway',
          message: language === 'tr'
            ? `Geçersiz ağ geçidi tespit edildi: ${devList} (${invalidGatewayCount})`
            : `Invalid gateway detected: ${devList} (${invalidGatewayCount})`
        });
      }
      if (disconnectedLinkCount > 0) {
        summaryWarnings.push(language === 'tr' ? `Kopuk bağlantı: ${disconnectedLinkCount}` : `Disconnected link: ${disconnectedLinkCount}`);
        addNetworkEventLog({ level: 'warning', category: 'Link', message: language === 'tr' ? `Kopuk bağlantı tespit edildi (${disconnectedLinkCount})` : `Disconnected link detected (${disconnectedLinkCount})` });
      }
      if (loopDetectedCount > 0) {
        summaryWarnings.push(language === 'tr' ? `Döngü algılandı` : `Loop detected`);
        addNetworkEventLog({ level: 'error', category: 'Loop', message: language === 'tr' ? `Ağ döngüsü (loop) algılandı` : `Network loop detected` });
      }
      if (vlanInconsistencyCount > 0) {
        summaryWarnings.push(language === 'tr' ? `VLAN tutarsızlığı: ${vlanInconsistencyCount}` : `VLAN inconsistency: ${vlanInconsistencyCount}`);
        addNetworkEventLog({ level: 'warning', category: 'VLAN', message: language === 'tr' ? `VLAN tutarsızlığı tespit edildi (${vlanInconsistencyCount})` : `VLAN inconsistency detected (${vlanInconsistencyCount})` });
      }
      if (duplicateIpCount > 0) {
        summaryWarnings.push(language === 'tr' ? `IP çakışması: ${duplicateIpCount}` : `IP conflict: ${duplicateIpCount}`);
        const dupIpDesc = Array.from(ipOwners.entries())
          .filter(([, owners]) => hasCrossDeviceConflict(owners))
          .map(([ip, owners]) => `${ip}: ${owners.join(', ')}`)
          .join('; ');
        addNetworkEventLog({ level: 'error', category: 'IP Conflict', message: language === 'tr' ? `IP çakışması tespit edildi (${duplicateIpCount})` : `IP conflict detected (${duplicateIpCount})`, detail: dupIpDesc });
      }
      if (duplicateMacCount > 0) {
        summaryWarnings.push(language === 'tr' ? `MAC çakışması: ${duplicateMacCount}` : `MAC conflict: ${duplicateMacCount}`);
        const dupMacDesc = Array.from(macOwners.entries())
          .filter(([, owners]) => hasCrossDeviceConflict(owners))
          .map(([mac, owners]) => `${mac}: ${owners.join(', ')}`)
          .join('; ');
        addNetworkEventLog({ level: 'error', category: 'MAC Conflict', message: language === 'tr' ? `MAC çakışması tespit edildi (${duplicateMacCount})` : `MAC conflict detected (${duplicateMacCount})`, detail: dupMacDesc });
      }
      if (duplicateIpv6Count > 0) {
        const dupIpv6Desc = Array.from(ipv6Owners.entries())
          .filter(([, owners]) => hasCrossDeviceConflict(owners))
          .map(([ipv6, owners]) => `${ipv6}: ${owners.join(', ')}`)
          .join('; ');
        addNetworkEventLog({ level: 'error', category: 'IPv6 Conflict', message: language === 'tr' ? `IPv6 çakışması tespit edildi (${duplicateIpv6Count})` : `IPv6 conflict detected (${duplicateIpv6Count})`, detail: dupIpv6Desc });
      }
      if (portSecurityViolationCount > 0) {
        summaryWarnings.push(language === 'tr' ? `Port güvenlik ihlali: ${portSecurityViolationCount}` : `Port security violation: ${portSecurityViolationCount}`);
        addNetworkEventLog({ level: 'error', category: 'Port Security', message: language === 'tr' ? `Port güvenlik ihlali (${portSecurityViolationCount})` : `Port security violation (${portSecurityViolationCount})` });
      }
      if (dhcpServerNoPoolCount > 0) {
        summaryWarnings.push(language === 'tr' ? `DHCP havuz yok: ${dhcpServerNoPoolCount}` : `DHCP no pool: ${dhcpServerNoPoolCount}`);
        addNetworkEventLog({ level: 'warning', category: 'DHCP', message: language === 'tr' ? `DHCP sunucusunda IP havuzu yok (${dhcpServerNoPoolCount})` : `DHCP server has no IP pool (${dhcpServerNoPoolCount})` });
      }
      if (dhcpClientNoLeaseCount > 0) {
        summaryWarnings.push(language === 'tr' ? `DHCP kiralama yok: ${dhcpClientNoLeaseCount}` : `DHCP no lease: ${dhcpClientNoLeaseCount}`);
        addNetworkEventLog({ level: 'warning', category: 'DHCP', message: language === 'tr' ? `DHCP istemcisi IP kiralayamadı (${dhcpClientNoLeaseCount})` : `DHCP client could not get a lease (${dhcpClientNoLeaseCount})` });
      }
      const summary = {
        deviceCount: {
          total: iotProcessedDevices.length,
          routers: iotProcessedDevices.filter((d) => d.type === 'router').length,
          switches: iotProcessedDevices.filter((d) => d.type === 'switchL2' || d.type === 'switchL3').length,
          pcs: iotProcessedDevices.filter((d) => d.type === 'pc').length,
          iot: iotProcessedDevices.filter((d) => d.type === 'iot').length,
          firewalls: iotProcessedDevices.filter((d) => d.type === 'firewall').length,
          wlcs: iotProcessedDevices.filter((d) => d.type === 'wlc').length,
        },
        activeLinks: sanitizedConnections.filter((c) => c.active).length,
        vlanCount: allVlans.size,
        routingTableSummary: { totalRoutes, connected: connectedRoutes, static: staticRoutes, dynamic: dynamicRoutes },
        networkWarnings: summaryWarnings,
      };

      const showRefreshPanel = () => {
        const totalDevices = connectedWirelessClients.length + activeAPs.length + disconnectedPCs.length + disconnectedAPs.length;
        const stpMessage = stpUpdatedCount > 0
          ? `\u2713 ${language === 'tr' ? t.stpSwitchesUpdated.replace('X', String(stpUpdatedCount)) : `STP: ${stpUpdatedCount} ${stpUpdatedCount === 1 ? 'switch updated' : 'switches updated'}`}`
          : '';
        const portSecurityMessage = (portSecurityViolationCount > 0 || portSecurityRecoveredCount > 0)
          ? `\uD83D\uDD12 ${t.portSecurityBlocked.replace('X', String(portSecurityViolationCount)).replace('Y', String(portSecurityRecoveredCount))}`
          : '';
        const topologyMessage = invalidCount > 0
          ? `${language === 'tr' ? t.topologyInvalidConnections.replace('X', String(invalidCount)) : `Topology: ${invalidCount} ${invalidCount === 1 ? 'invalid connection disabled' : 'invalid connections disabled'}`}`
          : '';
        const validationMessages = [
          subnetMismatchCount > 0 ? (language === 'tr' ? `\u26A0 Alt a\u011F uyumsuzlu\u011Fu: ${subnetMismatchCount}` : `\u26A0 Subnet mismatch: ${subnetMismatchCount}`) : '',
          invalidGatewayCount > 0 ? (language === 'tr' ? `\u26A0 Ge\u00E7ersiz a\u011F ge\u00E7idi: ${invalidGatewayCount}` : `\u26A0 Invalid gateway: ${invalidGatewayCount}`) : '',
          disconnectedLinkCount > 0 ? (language === 'tr' ? `\u26A0 Kopuk ba\u011Flant\u0131: ${disconnectedLinkCount}` : `\u26A0 Disconnected link: ${disconnectedLinkCount}`) : '',
          loopDetectedCount > 0 ? (language === 'tr' ? `\u26A0 D\u00F6ng\u00FC alg\u0131land\u0131` : `\u26A0 Loop detected`) : '',
          vlanInconsistencyCount > 0 ? (language === 'tr' ? `\u26A0 VLAN tutars\u0131zl\u0131\u011F\u0131: ${vlanInconsistencyCount}` : `\u26A0 VLAN inconsistency: ${vlanInconsistencyCount}`) : '',
        ].filter(Boolean);

        if (totalDevices > 0 || dhcpClients.length > 0) {
          const wifiMessages = [];
          if (connectedWirelessClients.length > 0) {
            wifiMessages.push(language === 'tr'
              ? `\u2713 ${connectedWirelessClients.length} kablosuz istemci ba\u011Fland\u0131`
              : `\u2713 ${connectedWirelessClients.length} wireless client${connectedWirelessClients.length > 1 ? 's' : ''} connected`);
          }
          if (activeAPs.length > 0) {
            wifiMessages.push(language === 'tr'
              ? `\u2713 ${activeAPs.length} AP aktif`
              : `\u2713 ${activeAPs.length} AP active`);
          }
          if (disconnectedPCs.length > 0) {
            wifiMessages.push(language === 'tr'
              ? `\u26A0 ${disconnectedPCs.length} kablosuz istemcinin ba\u011Flant\u0131s\u0131 yok`
              : `\u26A0 ${disconnectedPCs.length} wireless client${disconnectedPCs.length > 1 ? 's' : ''} disconnected`);
          }
          if (disconnectedAPs.length > 0) {
            wifiMessages.push(language === 'tr'
              ? `\u26A0 ${disconnectedAPs.length} AP'nin istemcisi yok`
              : `\u26A0 ${disconnectedAPs.length} AP no client${disconnectedAPs.length > 1 ? 's' : ''}`);
          }

          if (wifiMessages.length > 0) {
            toast({
              title: `\uD83D\uDCF6 ${t.wirelessStatus}`,
              description: wifiMessages.join('\n'),
              duration: 4000,
            });
            addNetworkEventLog({
              level: 'info',
              category: 'Wireless',
              message: t.wirelessStatus || (language === 'tr' ? 'Kablosuz Ağ Durumu' : 'Wireless Status'),
              detail: wifiMessages.join('\n'),
            });
          }

          let conflictToastDelay = 0;
          const showConflictToast = (title: string, description: string) => {
            if (conflictToastDelay === 0) {
              toast({ title, description, duration: 4500, variant: 'destructive' });
            } else {
              setTimeout(() => toast({ title, description, duration: 4500, variant: 'destructive' }), conflictToastDelay);
            }
            conflictToastDelay += 5000;
          };

          if (duplicateIpCount > 0) {
            const dupIpDesc = Array.from(ipOwners.entries())
              .filter(([, owners]) => owners.length > 1)
              .map(([ip, owners]) => `${ip}: ${owners.join(', ')}`)
              .join('\n');
            showConflictToast(t.ipConflict, dupIpDesc);
          }
          if (duplicateMacCount > 0) {
            const dupMacDesc = Array.from(macOwners.entries())
              .filter(([, owners]) => owners.length > 1)
              .map(([mac, owners]) => `${mac}: ${owners.join(', ')}`)
              .join('\n');
            showConflictToast(
              language === 'tr' ? `MAC \u00C7ak\u0131\u015Fmas\u0131 (${duplicateMacCount})` : `MAC Conflict (${duplicateMacCount})`,
              dupMacDesc
            );
          }

          if (duplicateIpv6Count > 0) {
            const dupIpv6Desc = Array.from(ipv6Owners.entries())
              .filter(([, owners]) => owners.length > 1)
              .map(([ipv6, owners]) => `${ipv6}: ${owners.join(', ')}`)
              .join('\n');
            showConflictToast(
              language === 'tr' ? `IPv6 \u00C7ak\u0131\u015Fmas\u0131 (${duplicateIpv6Count})` : `IPv6 Conflict (${duplicateIpv6Count})`,
              dupIpv6Desc
            );
          }

          if (validationMessages.length > 0) {
            toast({
              title: language === 'tr' ? 'Topoloji Do\u011Frulama Uyar\u0131lar\u0131' : 'Topology Validation Warnings',
              description: validationMessages.join('\n'),
              duration: 5000,
            });
          }

          const dhcpMessages = [
            language === 'tr'
              ? `DHCP: ${dhcpServerActiveCount} sunucu aktif`
              : `DHCP: ${dhcpServerActiveCount} ${dhcpServerActiveCount <= 1 ? 'active server' : 'active servers'}`,
            language === 'tr'
              ? `${dhcpClientWithLeaseCount} istemci kiralad\u0131`
              : `${dhcpClientWithLeaseCount} ${dhcpClientWithLeaseCount <= 1 ? 'client leased' : 'clients leased'}`,
          ];
          if (dhcpServerNoPoolCount > 0) {
            dhcpMessages.push(language === 'tr'
              ? `\u26A0 ${dhcpServerNoPoolCount} ${t.dhcpNoPool}`
              : `\u26A0 ${dhcpServerNoPoolCount} ${t.dhcpNoPool}`);
          }
          if (dhcpClientNoLeaseCount > 0) {
            dhcpMessages.push(language === 'tr'
              ? `\u26A0 ${dhcpClientNoLeaseCount} ${t.dhcpNoLease}`
              : `\u26A0 ${dhcpClientNoLeaseCount} ${t.dhcpNoLease}`);
          }

          if (dhcpMessages.length > 0) {
            addNetworkEventLog({
              level: 'info',
              category: 'DHCP',
              message: language === 'tr' ? 'DHCP Durumu' : 'DHCP Status',
              detail: dhcpMessages.join('\n'),
            });
          }

          setRefreshNetworkReport({
            show: true,
            title: t.networkStatusUpdated,
            dhcpMessages,
            stpMessage,
            portSecurityMessage,
            topologyMessage,
            devices: refreshDeviceSummaries,
            summary
          });
        } else {
          const isDhcpMissing = dhcpServerActiveCount === 0 && dhcpClientWithLeaseCount === 0;
          const dhcpSummary = isDhcpMissing
            ? ''
            : (language === 'tr'
              ? `DHCP: ${dhcpServerActiveCount} sunucu aktif, ${dhcpClientWithLeaseCount} kiralama`
              : `DHCP: ${dhcpServerActiveCount} ${dhcpServerActiveCount <= 1 ? 'active server' : 'active servers'}, ${dhcpClientWithLeaseCount} ${dhcpClientWithLeaseCount <= 1 ? 'lease' : 'leases'}`);

          setRefreshNetworkReport({
            show: true,
            title: t.networkRefreshed,
            dhcpMessages: [
              stpMessage
                ? `${dhcpSummary} \u2022 ${stpMessage}`.replace(/^ \u2022 /, '')
                : (isDhcpMissing
                  ? ''
                  : `${t.noWifiDevices} \u2022 ${dhcpSummary}`)
            ].filter(msg => msg.trim()),
            stpMessage: '',
            portSecurityMessage: '',
            topologyMessage,
            devices: refreshDeviceSummaries,
            summary
          });
        }
      };

      if (dhcpAssignments.length > 0) {
        setTimeout(showRefreshPanel, 1000);
      } else {
        showRefreshPanel();
      }
    }
  }, [iotAutomationPass, assignDhcpLeaseForPc, buildLinkLocalLease, topologyDevices, topologyConnections, deviceStates, setDeviceStates, setTopologyConnections, language, t, pcOutputs, setActiveDeviceId, setSelectedDevice, setTopologyDevices, setPcOutputs, setRefreshNetworkReport, toast, isValidIpv4, isSameSubnetByMask, addNetworkEventLog]);

  return handleRefreshNetwork;
}
