import type { CommandContext } from './commandTypes';
import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import type { SwitchState, CommandResult, Route, Port } from '../types';
import { buildOSPFLinkStateDatabase, electOspfDrBdr, type OspfCandidate } from '../ospf';
import { recalculateBgpNeighbors, calculateBgpRoutes, findRouteDetailed } from '../routing';
import { buildEigrp6TopologyTable, EigrpTopologyEntry } from '../eigrp-dual';

import { ensureDeviceStatesMap } from '../networkUtils';
import {
  getPrefixLength, getNetworkAddress, formatPortName, isIpInNetwork, getSTPCost,
} from './showHelpers';

/**
 * Show IP OSPF Interface
 */
export function cmdShowIpOspfInterface(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.routingProtocol !== 'ospf') {
    return { success: true, output: '\n% OSPF is not enabled\n' };
  }

  const match = input.match(/show\s+ip\s+ospf\s+interface\s*(\S+)?/i);
  const interfaceName = match?.[1];

  let output = '\n';

  const portEntries = interfaceName
    ? (state.ports?.[interfaceName.toLowerCase()] ? [[interfaceName.toLowerCase(), state.ports[interfaceName.toLowerCase()]]] : [])
    : Object.entries(state.ports || {});

  if (interfaceName && portEntries.length === 0) {
    return { success: false, error: `% Interface ${interfaceName} not found` };
  }

  let found = false;
  (portEntries as [string, Port][]).forEach(([name, port]) => {
    if (port.ipAddress && !port.shutdown) {
      found = true;
      const portArea = port.ospfArea !== undefined ? port.ospfArea : '0';
      const portProcess = port.ospfProcessId || state.ospfProcessId || '1';
      output += `${name} is up, line protocol is up\n`;
      output += `  Internet Address ${port.ipAddress}/${getPrefixLength(port.subnetMask)}, Area ${portArea}\n`;
      output += `  Process ID ${portProcess}, Router ID ${state.ospfRouterId || state.ip || '192.168.1.1'}, Network Type BROADCAST, Cost: ${getSTPCost(port)}\n`;
      output += `  Transmit Delay is 1 sec, State DR, Priority 1\n`;
      output += `  Designated Router (ID) ${state.ip || '192.168.1.1'}, Interface address ${port.ipAddress}\n`;
      output += `  Backup Designated router (ID) 0.0.0.0, Interface address 0.0.0.0\n`;
      output += `  Timer intervals configured, Hello 10, Dead 40, Wait 40, Retransmit 5\n`;
      output += `    Hello due in 00:00:07\n`;
      output += `  Index 1/1, flood queue length 0\n`;
      output += `  Next 0x0(0)/0x0(0)\n`;
      output += `  Last flood scan length is 0, maximum is 0\n`;
      output += `  Last flood scan time is 0 msec, maximum is 0 msec\n`;
      output += `  Neighbor Count is 0, Adjacent neighbor count is 0\n`;
      output += `  Suppress hello for 0 neighbor(s)\n\n`;
    }
  });

  if (!found) {
    output += '% OSPF not enabled on any interface\n';
  }

  return { success: true, output };
}

/**
 * Show Standby - Display HSRP status
 */
export function cmdShowStandby(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\n';
  let found = false;

  Object.entries(state.ports || {}).forEach(([portName, port]: [string, Port]) => {
    if (port.hsrp?.groups) {
      found = true;
      Object.entries(port.hsrp.groups).forEach(([groupId, config]) => {
        output += `${portName} - Group ${groupId}\n`;
        output += `  State is ${config.state || 'Active'}\n`;
        output += `  Virtual IP address is ${config.virtualIp || 'unknown'}\n`;
        output += `  Active virtual MAC address is 0000.0c07.ac${parseInt(groupId).toString(16).padStart(2, '0')}\n`;
        output += `  Local virtual MAC address is 0000.0c07.ac${parseInt(groupId).toString(16).padStart(2, '0')} (v1 default)\n`;
        output += `  Hello time 3 sec, hold time 10 sec\n`;
        output += `  Next hello sent in 1.234 secs\n`;
        output += `  Preemption ${config.preempt ? 'enabled' : 'disabled'}\n`;
        output += `  Active router is local\n`;
        output += `  Standby router is unknown\n`;
        output += `  Priority ${config.priority ?? 100} (configured ${config.priority ?? 100})\n`;
        output += `  Group name is "hsrp-${portName}-${groupId}" (default)\n`;
      });
    }
  });

  if (!found) {
    output += '% HSRP not configured on any interface\n';
  }

  return { success: true, output };
}

export { cmdShowIpNatTranslations, cmdShowIpNatStatistics } from './showNatDisplay';
export { cmdShowIpDhcpSnooping, cmdShowIpDhcpPool } from './showDhcpInspectionDisplay';

/**
 * Show Hosts - Display DNS host mapping
 */
export function cmdShowHosts(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\nDefault domain is not set\n';
  output += 'Name servers are unassigned\n\n';
  output += 'Host                      Address\n';

  const records = state.services?.dns?.records || [];
  if (records.length === 0) {
    output += '(No host mappings configured)\n';
  } else {
    records.forEach((record: { domain: string; address: string }) => {
      output += `${record.domain.padEnd(25)} ${record.address}\n`;
    });
  }

  output += '!\n';
  return { success: true, output };
}

/**
 * Convert a prefix length (0-32) to a dotted-quad IPv4 netmask.
 */
function prefixLenToMask(prefixLength: number): string {
  const int = prefixLength === 0 ? 0 : (~0 >>> 0) ^ ((1 << (32 - Math.min(prefixLength, 32))) - 1);
  return `${(int >>> 24) & 255}.${(int >>> 16) & 255}.${(int >>> 8) & 255}.${int & 255}`;
}

/**
 * Collect the same candidate routes the full table shows (connected from ports
 * and topology neighbours, static, dynamic) as Route objects for lookups.
 */
function collectRouteCandidates(state: SwitchState, ctx: CommandContext): Route[] {
  const candidates: Route[] = [];

  // Connected routes from configured ports
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    if (port.ipAddress && port.subnetMask && !port.shutdown) {
      candidates.push({
        destination: getNetworkAddress(port.ipAddress, port.subnetMask),
        subnetMask: port.subnetMask,
        nextHop: portName,
        interface: portName,
        type: 'connected',
        metric: 0,
        code: 'C',
      });
    }
  });

  // Connected routes derived from directly attached devices
  const connections = ctx.connections || [];
  const sourceDeviceId = ctx.sourceDeviceId as string;
  const devices = ctx.devices || [];
  if (connections.length > 0 && sourceDeviceId) {
    connections.forEach((conn: CanvasConnection) => {
      if (conn.sourceDeviceId === sourceDeviceId || conn.targetDeviceId === sourceDeviceId) {
        const isSource = conn.sourceDeviceId === sourceDeviceId;
        const localPort = isSource ? conn.sourcePort : conn.targetPort;
        const connectedDeviceId = isSource ? conn.targetDeviceId : conn.sourceDeviceId;
        const connectedDevice = devices.find((d: CanvasDevice) => d.id === connectedDeviceId);
        if (connectedDevice?.ip && connectedDevice?.subnet) {
          candidates.push({
            destination: getNetworkAddress(connectedDevice.ip, connectedDevice.subnet),
            subnetMask: connectedDevice.subnet,
            nextHop: localPort,
            interface: localPort,
            type: 'connected',
            metric: 0,
            code: 'C',
          });
        }
      }
    });
  }

  // Static routes
  (state.staticRoutes || []).forEach((route: Route) => {
    const mask = route.mask || route.subnetMask;
    const network = route.network || route.destination;
    if (mask && network) {
      const ad = (route as any).distance ?? (route as any).ad ?? 1;
      candidates.push({
        destination: network,
        subnetMask: mask,
        nextHop: route.nextHop,
        interface: route.interface,
        type: 'static',
        metric: route.metric ?? 0,
        administrativeDistance: ad,
        code: 'S',
      });
    }
  });

  // Dynamic routes
  (state.dynamicRoutes || []).forEach((route: Route) => {
    const mask = route.mask || route.subnetMask;
    const network = route.network || route.destination;
    if (mask && network) {
      let code = 'R';
      let ad = 120;
      if (state.routingProtocol === 'ospf') {
        const myAreas = (state.dynamicRoutes || []).map(r => (r as any).area).filter((a: number | undefined) => a !== undefined);
        if (state.ospfAreas) state.ospfAreas.forEach(a => myAreas.push(a));
        const isInterArea = (route as any).area !== undefined && !myAreas.includes((route as any).area);
        code = isInterArea ? 'O IA' : 'O';
        ad = 110;
      } else if (state.routingProtocol === 'eigrp') {
        code = 'D';
        ad = 90;
      } else if (state.routingProtocol === 'bgp') {
        code = 'B';
        ad = 20;
      }
      candidates.push({
        destination: network,
        subnetMask: mask,
        nextHop: route.nextHop,
        interface: route.interface,
        type: 'dynamic',
        metric: route.metric || 1,
        administrativeDistance: ad,
        code,
      });
    }
  });

  return candidates;
}

/**
 * Show the route entry / decision explanation for a specific destination:
 *   show ip route <ip>                       -> longest-prefix match decision
 *   show ip route <network> <mask>           -> entry for that exact prefix
 *   show ip route <network>/<prefix-length>  -> CIDR variant
 */
function showRouteLookup(state: SwitchState, ctx: CommandContext, lookupIp: string, lookupMask?: string): CommandResult {
  const candidates = collectRouteCandidates(state, ctx);
  let output = '\n';

  if (lookupMask) {
    // Exact-prefix lookup
    const exact = candidates.find(r => {
      const prefixLength = getPrefixLength(r.subnetMask);
      return r.destination.toLowerCase() === lookupIp && getPrefixLength(lookupMask) === prefixLength && getNetworkAddress(lookupIp, lookupMask).toLowerCase() === r.destination.toLowerCase();
    });
    if (!exact) {
      output += `% Network not in table\n`;
      return { success: true, output };
    }
    const prefixLength = getPrefixLength(exact.subnetMask);
    const routeLabel = routeCodeLabel(exact);
    output += `Routing entry for ${exact.destination}/${prefixLength}\n`;
    output += `  Known via "${routeLabel}", distance ${routeAd(exact)}, metric ${routeMetric(exact)}\n`;
    const hopText = routeHopText(exact);
    if (hopText.intf) output += `  Last update from ${hopText.hop}${hopText.intf ? `, ${hopText.intf}` : ''}\n`;
    output += `  Routing Descriptor Blocks:\n`;
    output += `  * ${exact.destination}/${prefixLength}, ${hopText.line}\n`;
    output += `      Route metric is ${routeMetric(exact)}, traffic share count is 1\n`;
    output += `  Decision: exact match on ${exact.destination}/${prefixLength}; source "${routeLabel}", AD ${routeAd(exact)}, metric ${routeMetric(exact)}, next-hop ${hopText.hop}\n`;
    return { success: true, output };
  }

  // Longest-prefix-match lookup with explanation
  const matchedCandidates = candidates.filter(r => {
    if (!r.subnetMask) return false;
    return isIpInNetwork(lookupIp, r.destination, r.subnetMask);
  });

  const detailed = findRouteDetailed(lookupIp, candidates);
  if (!detailed) {
    output += `% Network not in table\n`;
    output += `  No route matched ${lookupIp} across ${candidates.length} candidate route(s); longest-prefix lookup returned no match.\n`;
    return { success: true, output };
  }

  const route = detailed.route;
  const routeLabel = routeCodeLabel(route);
  const hopText = routeHopText(route);
  const prefixLength = getPrefixLength(route.subnetMask);
  output += `Routing entry for ${route.destination}/${prefixLength}\n`;
  output += `  Known via "${routeLabel}", distance ${detailed.administrativeDistance}, metric ${detailed.metric}\n`;
  const lastUpdate = route.type === 'connected' ? 'directly connected' : (route.nextHop || '(no next hop)');
  output += `  Last update from ${lastUpdate}${route.type !== 'connected' && hopText.intf ? `, ${hopText.intf}` : ''}\n`;
  output += `  Routing Descriptor Blocks:\n`;
  if (route.type === 'connected') {
    output += `  * ${route.destination}/${prefixLength} is directly connected, ${hopText.hop}\n`;
  } else {
    output += `  * ${route.destination}/${prefixLength}, ${hopText.line}\n`;
  }
  output += `      Route metric is ${detailed.metric}, traffic share count is 1\n`;
  output += `  Decision: longest-prefix match selected ${route.destination}/${prefixLength} (${matchedCandidates.length}/${candidates.length} candidate route(s) matched ${lookupIp});\n`;
  output += `    source "${routeLabel}", AD ${detailed.administrativeDistance}, metric ${detailed.metric}, next-hop ${hopText.hop}${hopText.intf ? ` on ${hopText.intf}` : ''}\n`;
  output += `    Selection order: longest prefix match, then lowest administrative distance, then lowest metric.\n`;
  return { success: true, output };
}

/**
 * Source label for a route code.
 */
function routeCodeLabel(route: Route): string {
  if (route.type === 'connected') return 'connected';
  if (route.type === 'static') return 'static';
  if (route.code?.startsWith('O')) return 'ospf';
  if (route.code === 'D' || route.code === 'EX') return 'eigrp';
  if (route.code === 'R') return 'rip';
  if (route.code === 'B') return 'bgp';
  return route.code || 'dynamic';
}

function routeAd(route: Route): number {
  if (route.type === 'connected') return 0;
  if (route.type === 'static') return route.administrativeDistance ?? 1;
  if (route.code?.startsWith('O')) return 110;
  if (route.code === 'D' || route.code === 'EX') return 90;
  if (route.code === 'R') return 120;
  if (route.code === 'B') return 20;
  return route.administrativeDistance ?? 110;
}

function routeMetric(route: Route): number {
  return route.metric ?? 0;
}

function routeHopText(route: Route): { hop: string; intf?: string; line: string } {
  const isIpNextHop = /^\d{1,3}(\.\d{1,3}){3}$/.test(route.nextHop || '');
  const via = isIpNextHop ? route.nextHop : formatPortName(route.nextHop || '');
  if (route.type === 'connected') {
    return { hop: via, line: `via ${via}, directly connected` };
  }
  if (isIpNextHop) {
    const intf = route.interface ? formatPortName(route.interface) : undefined;
    return { hop: via, intf, line: `via ${via}${intf ? `, ${intf}` : ''}` };
  }
  const intf = via;
  return { hop: intf, intf, line: `is directly connected, ${intf}` };
}

/**
 * Show IP Route
 */
export function cmdShowIpRoute(
  state: SwitchState,
  input: string,
  ctx: CommandContext
): CommandResult {
  let output = '\n';

  if (!state.ipRouting) {
    output += '% IP routing is not enabled\n';
    return { success: true, output };
  }

  // Parse filter / lookup target: `show ip route [protocol] [ip] [-mask-]`
  const rest = input.replace(/^show\s+ip\s+route/i, '').trim();
  const tokens = rest.split(/\s+/).filter(Boolean);
  let filter: string | undefined;
  let lookupIp: string | undefined;
  let lookupMask: string | undefined;
  if (tokens.length > 0) {
    const first = tokens[0].toLowerCase();
    if (['ospf', 'eigrp', 'rip', 'static', 'connected'].includes(first)) {
      filter = first;
    } else if (/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(first)) {
      const cidr = first.match(/^(\d{1,3}(\.\d{1,3}){3})\/(\d{1,2})$/);
      if (cidr) {
        lookupIp = cidr[1];
        lookupMask = prefixLenToMask(parseInt(cidr[3], 10));
      }
    } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(first)) {
      lookupIp = first;
      if (tokens.length >= 2 && /^\d{1,3}(\.\d{1,3}){3}$/.test(tokens[1])) {
        lookupMask = tokens[1];
      }
    }
  }

  if (lookupIp) {
    return showRouteLookup(state, ctx, lookupIp, lookupMask);
  }

  output += 'Codes: C - connected, S - static, I - IGRP, R - RIP, M - mobile, B - BGP\n';
  output += '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area\n';
  output += '       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2\n';
  output += '       E1 - OSPF external type 1, E2 - OSPF external type 2, E - EGP\n';
  output += '       i - IS-IS, L1 - IS-IS level-1, L2 - IS-IS level-2, ia - IS-IS inter area\n';
  output += '       * - candidate default, U - per-user static route, o - ODR\n';
  output += '       P - periodic downloaded static route\n';
  output += '\n';
  output += 'Gateway of last resort is not set\n\n';

  // Connected routes - show network address instead of interface IP
  let hasConnectedRoutes = false;
  if (!filter || filter === 'connected') {
    Object.keys(state.ports || {}).forEach(portName => {
      const port = state.ports[portName];
      if (port.ipAddress && port.subnetMask && !port.shutdown) {
        hasConnectedRoutes = true;
        const prefixLength = getPrefixLength(port.subnetMask);
        const networkAddress = getNetworkAddress(port.ipAddress, port.subnetMask);
        const formattedPortName = formatPortName(portName);
        output += `C     ${networkAddress}/${prefixLength} is directly connected, ${formattedPortName}\n`;
      }
    });

    // Add routes to connected networks via topology
    const connections = ctx.connections || [];
    const sourceDeviceId = ctx.sourceDeviceId as string;
    const devices = ctx.devices || [];

    if (connections && connections.length > 0) {
      connections.forEach((conn: CanvasConnection) => {
        if (conn.sourceDeviceId === sourceDeviceId || conn.targetDeviceId === sourceDeviceId) {
          const isSource = conn.sourceDeviceId === sourceDeviceId;
          const localPort = isSource ? conn.sourcePort : conn.targetPort;
          const connectedDeviceId = isSource ? conn.targetDeviceId : conn.sourceDeviceId;

          const connectedDevice = devices.find((d: CanvasDevice) => d.id === connectedDeviceId);

          if (connectedDevice?.ip && connectedDevice?.subnet) {
            const prefixLength = getPrefixLength(connectedDevice.subnet);
            const networkAddress = getNetworkAddress(connectedDevice.ip, connectedDevice.subnet);
            const formattedPortName = formatPortName(localPort);
            output += `C     ${networkAddress}/${prefixLength} is directly connected, ${formattedPortName}\n`;
            hasConnectedRoutes = true;
          }
        }
      });
    }
  }

  // Static routes
  if (!filter || filter === 'static') {
    if (state.staticRoutes && state.staticRoutes.length > 0) {
      state.staticRoutes.forEach((route) => {
        const mask = route.mask || route.subnetMask;
        const network = route.network || route.destination;
        if (mask && network) {
          const prefixLength = getPrefixLength(mask);
          const ad = (route as any).distance ?? (route as any).ad ?? 1;
          const metric = route.metric ?? 0;
          const outInt = route.interface ? formatPortName(route.interface) : '';
          if (route.nextHop) {
            output += `S     ${network}/${prefixLength} [${ad}/${metric}] via ${route.nextHop}${outInt ? `, ${outInt}` : ''}\n`;
          } else if (outInt) {
            output += `S     ${network}/${prefixLength} is directly connected, ${outInt}\n`;
          }
        }
      });
    }
  }

  // Dynamic routes (RIP, OSPF, EIGRP, BGP)
  if (state.dynamicRoutes && state.dynamicRoutes.length > 0) {
    state.dynamicRoutes.forEach((route) => {
      const mask = route.mask || route.subnetMask;
      const network = route.network || route.destination;
      if (mask && network) {
        const prefixLength = getPrefixLength(mask);
        let code = 'R';
        let ad = 120;
        let protocol = 'rip';
        if (state.routingProtocol === 'ospf') {
          const myAreas = (state.dynamicRoutes || []).map(r => r.area).filter(a => a !== undefined);
          if (state.ospfAreas) state.ospfAreas.forEach(a => myAreas.push(a));
          const isInterArea = route.area !== undefined && !myAreas.includes(route.area);
          code = isInterArea ? 'O IA' : 'O';
          ad = 110;
          protocol = 'ospf';
        }
        else if (state.routingProtocol === 'eigrp') { code = 'D'; ad = 90; protocol = 'eigrp'; }
        else if (state.routingProtocol === 'bgp') { code = 'B'; ad = 20; protocol = 'bgp'; }

        if (!filter || filter === protocol) {
          const metric = route.metric || 1;
          const outInt = route.interface ? formatPortName(route.interface) : '';
          output += `${code.padEnd(6)}${network}/${prefixLength} [${ad}/${metric}] via ${route.nextHop}, 00:00:11${outInt ? `, ${outInt}` : ''}\n`;
        }
      }
    });
  }

  if (!hasConnectedRoutes && (!state.staticRoutes || state.staticRoutes.length === 0) && (!state.dynamicRoutes || state.dynamicRoutes.length === 0)) {
    output += 'No routes in routing table\n';
  }

  output += '!\n';
  return { success: true, output };
}

/**
 * Show IP Protocols
 */
export function cmdShowIpProtocols(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (!state.routingProtocol) {
    return { success: true, output: '\n% No routing protocols configured\n' };
  }

  let output = '\n';
  if (state.routingProtocol === 'ospf') {
    const processId = state.ospfProcessId || 1;
    const routerId = state.ospfRouterId || state.ip || '192.168.1.1';
    const areas = new Set<number>();
    if (state.dynamicRoutes) state.dynamicRoutes.forEach(r => { if (r.area !== undefined) areas.add(r.area); });
    if (state.ospfAreas) state.ospfAreas.forEach(a => areas.add(a));
    const areaCount = areas.size || 1;

    output += `Routing Protocol is "ospf ${processId}"\n`;
    output += '  Outgoing update filter list for all interfaces is not set\n';
    output += '  Incoming update filter list for all interfaces is not set\n';
    output += `  Router ID ${routerId}\n`;
    if (state.isAbr) output += '  It is an area border router\n';
    let normalCount = 0, stubCount = 0, totallyStubCount = 0, nssaCount = 0, totallyNssaCount = 0;
    areas.forEach(a => {
      const aStr = String(a);
      if (state.ospfTotallyNssaAreas?.includes(aStr)) totallyNssaCount++;
      else if (state.ospfNssaAreas?.includes(aStr)) nssaCount++;
      else if (state.ospfTotallyStubAreas?.includes(aStr)) totallyStubCount++;
      else if (state.ospfStubAreas?.includes(aStr)) stubCount++;
      else normalCount++;
    });
    output += `  Number of areas in this router is ${areaCount}. ${normalCount} normal ${stubCount + totallyStubCount} stub ${nssaCount + totallyNssaCount} nssa\n`;
    output += '  Maximum path: 4\n';
    output += '  Routing for Networks:\n';
    if (state.dynamicRoutes && state.dynamicRoutes.length > 0) {
      state.dynamicRoutes.forEach((route) => {
        if (route.network && route.mask) {
          // Wildcard mask approximation from subnet
          const wildcard = route.mask.split('.').map((p: string) => 255 - parseInt(p)).join('.');
          output += `    ${route.network} ${wildcard} area ${route.area || 0}\n`;
        }
      });
    } else {
      output += '    (No networks advertised)\n';
    }
    output += '  Routing Information Sources:\n';
    output += '    Gateway         Distance      Last Update\n';
    if (state.dynamicRoutes) {
      state.dynamicRoutes.forEach((route: Route) => {
        if (route.nextHop) {
          output += `    ${route.nextHop.padEnd(15)} 110           00:00:15\n`;
        }
      });
    }
    output += '  Distance: (default is 110)\n';
  } else if (state.routingProtocol === 'eigrp') {
    const asNum = state.eigrpAs || 1;
    output += `Routing Protocol is "eigrp ${asNum}"\n`;
    output += '  Outgoing update filter list for all interfaces is not set\n';
    output += '  Incoming update filter list for all interfaces is not set\n';
    output += '  Default networks accepted in routing updates\n';
    output += '  Default networks will not be sent in routing updates\n';
    output += `  EIGRP-IPv4 Protocol for AS(${asNum})\n`;
    output += '    Metric weight K1=1, K2=0, K3=1, K4=0, K5=0\n';
    output += '    NSF-aware route hold timer is 240\n';
    output += `    Router-ID: ${state.ospfRouterId || state.ip || '10.0.0.1'}\n`;
    output += '    Topology : 0 (base)\n';
    output += '      Active Timer: 3 min\n';
    output += '      Distance: internal 90 external 170\n';
    output += '      Maximum path: 4\n';
    output += '      Maximum hopcount 100\n';
    output += '      Maximum metric variance 1\n';
  } else {
    output += `Routing Protocol is "${state.routingProtocol}"\n`;
    output += '  No detailed information available for this protocol.\n';
  }

  return { success: true, output };
}

/**
 * Show IP OSPF Neighbor
 */
export function cmdShowIpOspfNeighbor(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.routingProtocol !== 'ospf') {
    return { success: true, output: '\n% OSPF is not enabled\n' };
  }

  let output = '\nNeighbor ID     Pri   State           Dead Time   Address         Interface\n';

  // Simulate neighbors from dynamic routes or configured neighbors
  if (state.dynamicRoutes && state.dynamicRoutes.length > 0) {
    const candidateList: OspfCandidate[] = [];
    const neighborMap = new Map<string, { address: string; intf: string; routerId: string; priority: number }>();

    state.dynamicRoutes.forEach((r, idx) => {
      if (r.nextHop && !neighborMap.has(r.nextHop)) {
        const routerId = `10.0.0.${(idx + 1) * 2}`;
        const address = r.nextHop;
        const intf = r.interface || 'FastEthernet0/0';
        const priority = 1;
        neighborMap.set(r.nextHop, { address, intf, routerId, priority });
        candidateList.push({ routerId, drPriority: priority, ipAddress: address, interfaceName: intf });
      }
    });

    const election = electOspfDrBdr(candidateList);

    neighborMap.forEach((neighbor) => {
      const deadTimer = `00:00:35`;
      let drBdrRole = 'DROTHER';
      if (election.dr?.routerId === neighbor.routerId) {
        drBdrRole = 'DR';
      } else if (election.bdr?.routerId === neighbor.routerId) {
        drBdrRole = 'BDR';
      }
      const stateStr = `FULL/${drBdrRole}`;
      output += `${neighbor.routerId.padEnd(15)} ${String(neighbor.priority).padEnd(5)} ${stateStr.padEnd(15)} ${deadTimer}    ${neighbor.address.padEnd(15)} ${neighbor.intf}\n`;
    });
  }

  if (output === '\nNeighbor ID     Pri   State           Dead Time   Address         Interface\n') {
    output += '(no neighbors found)\n';
  }

  return { success: true, output };
}

/**
 * Show IP OSPF Database
 */
export function cmdShowIpOspfDatabase(state: SwitchState, _input: string, ctx: CommandContext): CommandResult {
  if (state.routingProtocol !== 'ospf') {
    return { success: true, output: '\n% OSPF is not enabled\n' };
  }

  const routerId = state.ospfRouterId || state.ip || '192.168.1.1';
  const areas = state.ospfAreas || [0];
  const deviceStates = ensureDeviceStatesMap(ctx.deviceStates);

  // Real LSDB build for OSPF
  const lsdb = buildOSPFLinkStateDatabase(deviceStates);

  let output = '\n            OSPF Router with ID (' + routerId + ') (Process ID 1)\n\n';

  areas.forEach(area => {
    const areaData = lsdb[area];
    if (!areaData) return;

    output += `                Router Link States (Area ${area})\n\n`;
    output += 'Link ID         ADV Router      Age         Seq#       Checksum Link count\n';

    areaData.routerLSAs.forEach((lsa) => {
      output += `${lsa.id.padEnd(15)} ${lsa.advRouter.padEnd(15)} ${lsa.ageNumber.toString().padEnd(11)} 0x80000001 0x0000   ${lsa.links.length}\n`;
    });

    if (areaData.summaryLSAs.size > 0) {
      output += `\n                Summary Net Link States (Area ${area})\n\n`;
      output += 'Link ID         ADV Router      Age         Seq#       Checksum\n';
      areaData.summaryLSAs.forEach((lsa) => {
        output += `${lsa.id.padEnd(15)} ${lsa.advRouter.padEnd(15)} ${lsa.ageNumber.toString().padEnd(11)} 0x80000001 0x0000\n`;
      });
    }
  });

  return { success: true, output };
}

/**
 * Show IP OSPF
 */
export function cmdShowIpOspf(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.routingProtocol !== 'ospf') {
    return { success: true, output: '\n% OSPF is not enabled\n' };
  }

  const processId = state.ospfProcessId || 1;
  const routerId = state.ospfRouterId || state.ip || '192.168.1.1';
  const areas = new Set<number>();
  if (state.dynamicRoutes) state.dynamicRoutes.forEach(r => { if (r.area !== undefined) areas.add(r.area); });
  if (state.ospfAreas) state.ospfAreas.forEach(a => areas.add(a));
  const areaCount = areas.size || 1;

  let output = `\n Routing Process "ospf ${processId}" with ID ${routerId}\n`;
  if (state.isAbr) output += ' It is an area border router\n';
  output += ' Start time: 00:00:01.000, Time elapsed: 00:02:15.000\n';
  output += ' Supports only single TOS(TOS0) routes\n';
  output += ' Supports opaque LSA\n';
  output += ' Supports Link-local Signaling (LLS)\n';
  output += ' Supports area transit capability\n';
  output += ' Initial SPF schedule delay 5000 msecs\n';
  output += ' Minimum hold time between two consecutive SPFs 10000 msecs\n';
  output += ' Maximum wait time between two consecutive SPFs 10000 msecs\n';
  output += ' Incremental-SPF disabled\n';
  output += ' Minimum LSA interval 5 secs\n';
  output += ' Minimum LSA arrival 1000 msecs\n';
  output += ' LSA group pacing timer 240 secs\n';
  output += ' Interface flood pacing timer 33 msecs\n';
  output += ' Retransmission pacing timer 66 msecs\n';
  output += ' Number of external LSA 0. Checksum Sum 0x000000\n';
  output += ' Number of opaque AS LSA 0. Checksum Sum 0x000000\n';
  output += ' Number of DCbitless external and opaque AS LSA 0\n';
  output += ' Number of DoNotAge external and opaque AS LSA 0\n';
  let normalCount = 0, stubCount = 0, totallyStubCount = 0, nssaCount = 0, totallyNssaCount = 0;
  areas.forEach(a => {
    const aStr = String(a);
    if (state.ospfTotallyNssaAreas?.includes(aStr)) totallyNssaCount++;
    else if (state.ospfNssaAreas?.includes(aStr)) nssaCount++;
    else if (state.ospfTotallyStubAreas?.includes(aStr)) totallyStubCount++;
    else if (state.ospfStubAreas?.includes(aStr)) stubCount++;
    else normalCount++;
  });
  output += ` Number of areas in this router is ${areaCount}. ${normalCount} normal ${stubCount + totallyStubCount} stub ${nssaCount + totallyNssaCount} nssa\n`;
  output += ' Number of areas transit capable is 0\n';
  output += ' External flood list length 0\n';
  output += ' IETF NSF helper support enabled\n';
  output += ' Reference bandwidth unit is 100 mbps\n';

  Array.from(areas).forEach(area => {
    const aStr = String(area);
    let areaTypeStr = 'normal';
    if (state.ospfTotallyNssaAreas?.includes(aStr)) areaTypeStr = 'totally nssa';
    else if (state.ospfNssaAreas?.includes(aStr)) areaTypeStr = 'nssa';
    else if (state.ospfTotallyStubAreas?.includes(aStr)) areaTypeStr = 'totally stubby';
    else if (state.ospfStubAreas?.includes(aStr)) areaTypeStr = 'stub';

    output += `    Area ${area === 0 ? 'BACKBONE(0)' : area}\n`;
    output += `        Number of interfaces in this area is 1\n`;
    output += `        It is a ${areaTypeStr} area\n`;
    output += `        Area has no authentication\n`;
    output += `        SPF algorithm last executed 00:01:15.000 ago\n`;
    output += `        SPF algorithm executed 2 times\n`;
    output += `        Area ranges are\n`;
  });

  if (areas.size === 0) {
    output += '    Area BACKBONE(0)\n';
    output += '        Number of interfaces in this area is 1\n';
    output += '        Area has no authentication\n';
  }
  output += '        Number of interfaces in this area is 1\n';
  output += '        Area has no authentication\n';
  output += '        SPF algorithm last executed 00:01:15.000 ago\n';
  output += '        SPF algorithm executed 2 times\n';
  output += '        Area ranges are\n';
  output += '        Number of LSA 3. Checksum Sum 0x01A3B1\n';
  output += '        Number of opaque link LSA 0. Checksum Sum 0x000000\n';
  output += '        Number of DCbitless LSA 0\n';
  output += '        Number of indication LSA 0\n';
  output += '        Number of DoNotAge LSA 0\n';
  output += '        Flood list length 0\n';

  return { success: true, output };
}

/**
 * Show IP ARP Inspection
 */
export function cmdShowIpArpInspection(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\nSource Mac Validation      : Disabled\nDestination Mac Validation : Disabled\nIP Address Validation      : Disabled\n\n Vlan     Configuration    Operation   ACL Match          Static ACL\n------   -------------    ---------   ---------          ----------\n' };
}

export function cmdShowIpDhcpBinding(state: SwitchState, _input: string, ctx: CommandContext): CommandResult {
  let output = '\nIP address       Client-ID/              Lease expiration        Type\n' +
    '                 Hardware address\n';

  const devices = ctx.devices || [];

  // Find devices that received DHCP from this device
  // A device is considered a DHCP client if its ipConfigMode is 'dhcp' 
  // and it's connected (directly or indirectly) to this device.
  const dhcpClients = devices.filter((d) =>
    (d.type === 'pc' || d.type === 'iot') &&
    d.ipConfigMode === 'dhcp' &&
    d.ip &&
    d.ip !== '0.0.0.0' &&
    !d.ip.startsWith('169.254.')
  );

  if (dhcpClients.length === 0) {
    output += '% No bindings found\n';
  } else {
    dhcpClients.forEach((client) => {
      // Check if this client's IP belongs to one of our pools
      const cliPools = state.dhcpPools || {};
      const servicePools = state.services?.dhcp?.pools || [];

      let belongsToOurPool = false;

      // Check CLI pools
      for (const poolName in cliPools) {
        const pool = cliPools[poolName];
        if (pool.network && pool.subnetMask) {
          if (isIpInNetwork(client.ip, pool.network, pool.subnetMask)) {
            belongsToOurPool = true;
            break;
          }
        }
      }

      // Check Service pools
      if (!belongsToOurPool) {
        for (const pool of servicePools) {
          if (pool.startIp && pool.subnetMask) {
            // Simple check: same subnet
            if (isIpInNetwork(client.ip, pool.startIp, pool.subnetMask)) {
              belongsToOurPool = true;
              break;
            }
          }
        }
      }

      if (belongsToOurPool) {
        const mac = client.macAddress || '0000.0000.0000';
        const formattedMac = mac.replace(/[:-]/g, '').toLowerCase();
        const clientId = `01${formattedMac}`; // Format: 01 + mac
        output += `${client.ip.padEnd(16)} ${clientId.padEnd(23)} Infinite                Automatic\n`;
      }
    });

    if (output.endsWith('Hardware address\n')) {
      output += '% No bindings found\n';
    }
  }

  return { success: true, output };
}

/**
 * Show IP Source Binding
 */
export function cmdShowIpSourceBinding(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {

  let output = '\nMacAddress          IpAddress       Lease(sec)  Type           VLAN  Interface\n';
  output += '------------------  --------------  ----------  -------------  ----  --------------------\n';

  // Check if DHCP snooping is enabled
  if (!state.dhcpSnoopingEnabled) {
    output += '% DHCP snooping not enabled\n';
    return { success: true, output };
  }

  // Build bindings from port data
  const bindings: { mac: string; ip: string; vlan: number; interface: string; type: string }[] = [];
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    if (port.dhcpSnoopingTrust && port.ipAddress) {
      bindings.push({
        mac: port.macAddress || '0000.0000.0000',
        ip: port.ipAddress,
        vlan: port.vlan || 1,
        interface: portName,
        type: 'dhcp-snooping'
      });
    }
  });

  if (bindings.length === 0) {
    output += '% No bindings found\n';
  } else {
    bindings.forEach(b => {
      output += `${b.mac.padEnd(18)}  ${b.ip.padEnd(14)}  0           ${b.type.padEnd(13)}  ${String(b.vlan).padEnd(4)}  ${b.interface}\n`;
    });
  }

  return { success: true, output };
}

/**
 * Show IPv6 Route
 */
export function cmdShowIpv6Route(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\n';

  if (!state.ipv6Enabled) {
    output += '% IPv6 routing is not enabled\n';
    return { success: true, output };
  }

  const routes: string[] = [];

  // Connected routes
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    if (port.ipv6Address && port.ipv6Prefix && !port.shutdown) {
      routes.push(`C   ${port.ipv6Address}/${port.ipv6Prefix} [0/0]\n     via ${portName}, directly connected`);
      routes.push(`L   ${port.ipv6Address}/128 [0/0]\n     via ${portName}, receive`);
    }
  });

  // Static routes
  if (state.ipv6StaticRoutes && state.ipv6StaticRoutes.length > 0) {
    state.ipv6StaticRoutes.forEach((route: Route) => {
      const metric = route.metric || 1;
      routes.push(`S   ${route.destination}/${route.prefixLength} [${metric}/0]\n     via ${route.nextHop}`);
    });
  }

  // Dynamic routes
  if (state.ipv6DynamicRoutes && state.ipv6DynamicRoutes.length > 0) {
    state.ipv6DynamicRoutes.forEach((route: Route) => {
      const metric = route.metric || 1;
      const code = state.routingProtocol === 'ospfv3' ? 'O' : 'R';
      routes.push(`${code}   ${route.destination}/${route.prefixLength} [${code === 'O' ? 110 : 120}/${metric}]\n     via ${route.nextHop}`);
    });
  }

  output += `IPv6 Routing Table - default - ${routes.length} entries\n`;
  output += 'Codes: C - Connected, L - Local, S - Static, U - Per-user Static route\n';
  output += '       B - BGP, R - RIP, I1 - ISIS L1, I2 - IS-IS L2\n';
  output += '       IA - IS-IS interarea, IS - IS-IS summary, D - EIGRP, EX - EIGRP external\n';
  output += '       O - OSPF Intra, OI - OSPF Inter, OE1 - OSPF ext 1, OE2 - OSPF ext 2\n';
  output += '       ON1 - OSPF NSSA ext 1, ON2 - OSPF NSSA ext 2\n\n';

  if (routes.length === 0) {
    output += 'No IPv6 routes found\n';
  } else {
    output += routes.join('\n') + '\n';
  }

  return { success: true, output };
}

/**
 * Show IPv6 DHCP Pool
 */
export function cmdShowIpv6DhcpPool(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const pools = state.ipv6DhcpPools || {};
  const poolNames = Object.keys(pools);
  if (poolNames.length === 0) {
    return { success: true, output: '\n% No IPv6 DHCP pools configured\n' };
  }

  const match = input.match(/show\s+ipv6\s+dhcp\s+pool\s*(\S+)?/i);
  const requestedPool = match?.[1];

  let output = '\n';
  const targetPools = requestedPool ? (pools[requestedPool] ? [requestedPool] : []) : poolNames;

  if (targetPools.length === 0 && requestedPool) {
    return { success: false, error: `% DHCPv6 pool ${requestedPool} not found` };
  }

  targetPools.forEach(name => {
    const p = pools[name];
    const activeCount = (state.dhcpv6Bindings || []).length;
    output += `DHCPv6 pool: ${name}\n`;
    output += `  Address allocation prefix: ${p.addressPrefix || 'not set'}\n`;
    output += `  DNS server: ${p.dnsServer || 'not set'}\n`;
    output += `  Domain name: ${p.domainName || 'not set'}\n`;
    output += `  Active clients: ${activeCount}\n`;
  });

  return { success: true, output };
}

export function cmdShowIpv6DhcpBinding(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const bindings = state.dhcpv6Bindings || [];
  if (bindings.length === 0) {
    return { success: true, output: '\n% No DHCPv6 binding entries\n' };
  }

  let output = '\n';
  bindings.forEach(b => {
    output += `Client: ${b.clientHostname || b.duid}\n`;
    output += `  DUID: ${b.duid}\n`;
    output += `  ${b.type}: IAID ${b.iaid}, T1 302400, T2 483840\n`;

    output += `    Address: ${b.ipv6Address}\n`;
    output += `      preferred lifetime ${b.preferredLifetime}, valid lifetime ${b.validLifetime}\n`;
    output += `      expires at Oct 12 2026 12:00 PM (${b.validLifetime} seconds)\n`;
  });

  return { success: true, output };
}

export function cmdShowPppoeSession(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const sessions = state.pppoeSessions || [];
  if (sessions.length === 0) {
    return { success: true, output: '\n1 client session\n\nUniq ID  PPPoE  RemMAC          TTY        LocIP           RemIP           State\n         Sid\nN/A      101    0050.56C0.0002  Di1        100.64.1.2      100.64.1.1      UP (LCP/IPCP Opened)\n' };
  }

  let output = `\n${sessions.length} client session(s)\n\n`;
  output += 'Uniq ID  PPPoE  RemMAC          TTY        LocIP           RemIP           State\n';
  output += '         Sid\n';

  sessions.forEach(s => {
    output += `N/A      ${String(s.sessionId).padEnd(6)} ${s.serverMac.padEnd(15)} Di1        ${s.assignedIp.padEnd(15)} ${s.peerIp.padEnd(15)} UP (LCP/IPCP Opened)\n`;
  });

  return { success: true, output };
}

export function cmdShowCaller(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const sessions = state.pppoeSessions || [];
  let output = '\n  Line          User                 IP Address       Local Subnet    VLAN\n';
  output += '  ------------  -------------------  ---------------  --------------  ----\n';

  if (sessions.length === 0) {
    output += '  Di1           user@isp.net         100.64.1.2       100.64.1.1/32   1\n';
  } else {
    sessions.forEach(s => {
      output += `  Di1           ${'user@isp.net'.padEnd(19)}  ${s.assignedIp.padEnd(15)}  ${s.peerIp}/32   1\n`;
    });
  }

  return { success: true, output };
}


export function cmdShowTrack(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {

  const tracks = state.ipSlaTracks || {};
  const trackKeys = Object.keys(tracks);

  if (trackKeys.length === 0) {
    return { success: true, output: '\n% No track objects configured\n' };
  }

  const match = input.match(/show\s+track\s*(\d+)?/i);
  const requestedId = match?.[1];

  let output = '\n';
  const targetKeys = requestedId ? (tracks[requestedId] ? [requestedId] : []) : trackKeys;

  if (requestedId && targetKeys.length === 0) {
    return { success: false, error: `% Track object ${requestedId} not found` };
  }

  targetKeys.forEach(id => {
    const t = tracks[id];
    const op = state.ipSlaOperations?.[t.operationId];
    const isUp = t.state === 'up';

    output += `Track ${id}\n`;
    output += `  IP SLA ${t.operationId} reachability\n`;
    output += `  Reachability is ${isUp ? 'Up' : 'Down'}\n`;
    output += `  Latest operation return code: ${op?.statistics?.successes ? 'OK' : 'Timeout'}\n`;
    output += `  Latest RTT: ${op?.statistics?.last !== undefined ? `${op.statistics.last} ms` : 'N/A'}\n`;
    output += `  Tracked by:\n`;
    output += `    Static IP Route 0.0.0.0/0\n\n`;
  });

  return { success: true, output };
}

export function cmdShowIpSlaSummary(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const ops = state.ipSlaOperations || {};
  const entries = Object.values(ops);

  if (entries.length === 0) {
    return { success: true, output: '\nIP SLA: No operations configured\n' };
  }

  let output = '\nIP SLA Operational Summary\n';
  output += 'ID       Type        Target          Status      Return Code\n';
  output += '------------------------------------------------------------\n';

  entries.forEach(op => {
    const status = op.running ? 'Scheduled' : 'Configured';
    const returnCode = op.statistics.successes > 0 ? 'OK' : (op.running ? 'Timeout' : 'Pending');
    output += `${op.id.padEnd(8)} ${op.type.toUpperCase().padEnd(11)} ${op.target.padEnd(15)} ${status.padEnd(11)} ${returnCode}\n`;
  });

  return { success: true, output };
}

export function cmdShowIpSlaConfiguration(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const ops = state.ipSlaOperations || {};
  const entries = Object.values(ops);

  if (entries.length === 0) {
    return { success: true, output: '\n% No IP SLA operations configured\n' };
  }

  let output = '\n';
  entries.forEach(op => {
    output += `IP SLA Operation ${op.id}\n`;
    output += `  Type: ${op.type}\n`;
    output += `  Target: ${op.target}\n`;
    output += `  Frequency: ${op.frequency} seconds\n`;
    output += `  Timeout: ${op.timeout} ms\n`;
    output += `  Schedule: Start Time = ${op.startTime || 'Now'}, Life = ${op.life || 'Forever'}, Status = ${op.running ? 'Scheduled' : 'Inactive'}\n\n`;
  });

  return { success: true, output };
}



/**
 * Show IP Verify Source
 */
export function cmdShowIpVerifySource(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\nInterface        Filter Type    Filter Mode    IP Address      MacAddress       Vlan\n';
  output += '---------------  -------------  -------------  --------------  ---------------  ----\n';

  let hasEntries = false;
  Object.keys(state.ports || {}).forEach(portName => {
    const port = state.ports[portName];
    if (port.ipVerifySource) {
      hasEntries = true;
      const filterType = port.ipVerifySourcePortSecurity ? 'ip+mac' : 'ip';
      const filterMode = 'active';
      output += `${portName.padEnd(15)}  ${filterType.padEnd(13)}  ${filterMode.padEnd(13)}  ${(port.ipAddress || 'N/A').padEnd(14)}  ${(port.macAddress || 'N/A').padEnd(15)}  ${port.vlan || 1}\n`;
    }
  });

  if (!hasEntries) {
    output += '% No interfaces configured with IP verify source\n';
  }

  return { success: true, output };
}

/**
 * Show IP EIGRP Neighbors
 */
export function cmdShowIpEigrpNeighbors(state: SwitchState, _input: string, ctx?: CommandContext): CommandResult {
  const isEigrpEnabled = state.routingProtocol === 'eigrp' || Boolean(state.eigrpAs) || Boolean(state.runningConfig?.some(l => l.includes('router eigrp')));

  if (!isEigrpEnabled) {
    return { success: true, output: '\n% EIGRP is not configured on this device\n' };
  }

  const asNum = state.eigrpAs || '100';
  let output = `\nEIGRP-IPv4 Neighbors for AS(${asNum})\n`;
  output += 'H   Address                 Interface              Hold Uptime   SRTT   RTO  Q  Seq\n';
  output += '                                                   (sec)         (ms)       Cnt Num\n';

  const neighbors: Array<{ address: string; intf: string }> = [];

  // Find neighbor interfaces from dynamic routes
  if (state.dynamicRoutes && state.dynamicRoutes.length > 0) {
    state.dynamicRoutes.forEach((r) => {
      if (r.nextHop && !neighbors.some(n => n.address === r.nextHop)) {
        let foundIntf = r.interface || '';
        if (!foundIntf) {
          Object.entries(state.ports).forEach(([portName, port]) => {
            if (port.ipAddress && (port.mode === 'routed' || port.isRoutedPort || port.status === 'connected')) {
              foundIntf = portName;
            }
          });
        }
        neighbors.push({ address: r.nextHop, intf: foundIntf || 'Gi1/0/24' });
      }
    });
  }

  // If no dynamic routes yet, check connected neighbor devices in topology context
  if (neighbors.length === 0 && ctx?.deviceStates) {
    Object.entries(state.ports).forEach(([portName, port]) => {
      if (port.ipAddress && (port.mode === 'routed' || port.isRoutedPort || port.status === 'connected')) {
        const myIp = port.ipAddress;
        ctx.deviceStates?.forEach((otherState) => {
          if (otherState.hostname !== state.hostname && (otherState.routingProtocol === 'eigrp' || otherState.eigrpAs)) {
            Object.values(otherState.ports).forEach((otherPort) => {
              if (otherPort.ipAddress && otherPort.ipAddress !== myIp) {
                const myIpParts = myIp.split('.');
                const otherIpParts = otherPort.ipAddress.split('.');
                if (myIpParts[0] === otherIpParts[0] && myIpParts[1] === otherIpParts[1] && myIpParts[2] === otherIpParts[2]) {
                  if (!neighbors.some(n => n.address === otherPort.ipAddress)) {
                    neighbors.push({ address: otherPort.ipAddress, intf: portName });
                  }
                }
              }
            });
          }
        });
      }
    });
  }

  if (neighbors.length > 0) {
    neighbors.forEach((n, idx) => {
      const holdTime = '12';
      const uptime = '00:04:15';
      const srtt = '12';
      const rto = '200';
      const qCnt = '0';
      const seqNum = String(idx + 1);
      output += `${String(idx).padEnd(4)}${n.address.padEnd(24)}${n.intf.padEnd(23)}${holdTime.padEnd(5)} ${uptime.padEnd(10)} ${srtt.padEnd(6)} ${rto.padEnd(4)} ${qCnt.padEnd(2)} ${seqNum}\n`;
    });
  } else {
    // Default EIGRP neighbor fallback output when configured
    output += '0   192.168.2.2             Gi1/0/24                 12 00:04:15   12   200  0  1\n';
  }

  return { success: true, output };
}

/**
 * Show IP EIGRP Interfaces
 */
export function cmdShowIpEigrpInterfaces(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const isEigrpEnabled = state.routingProtocol === 'eigrp' || Boolean(state.eigrpAs) || Boolean(state.runningConfig?.some(l => l.includes('router eigrp')));
  if (!isEigrpEnabled) {
    return { success: true, output: '\n% EIGRP is not configured on this device\n' };
  }
  const asNum = state.eigrpAs || '100';
  let output = `\nEIGRP-IPv4 Interfaces for AS(${asNum})\n`;
  output += 'Xmit Queue   PeerQ        Mean SRTT   Pacing Time   Multicast    Pending\n';
  output += 'Interface              Peers  Un/Reliable  Un/Reliable  (ms)        Un/Reliable   Flow Timer   Routes\n';

  Object.entries(state.ports).forEach(([portName, port]) => {
    if (port.ipAddress && (port.mode === 'routed' || port.isRoutedPort || port.status === 'connected')) {
      output += `${portName.padEnd(23)}1      0/0          0/0          12          0/10          0            0\n`;
    }
  });

  return { success: true, output };
}

/**
 * Show IP BGP Summary
 */
export function cmdShowIpBgpSummary(state: SwitchState, _input: string, ctx?: CommandContext): CommandResult {
  let currentState = state;
  if (ctx?.deviceStates && ctx?.sourceDeviceId) {
    const updatedStates = recalculateBgpNeighbors(ctx.deviceStates);
    const updatedMyState = updatedStates.get(ctx.sourceDeviceId);
    if (updatedMyState) {
      currentState = updatedMyState;
    }
  }

  const routerId = currentState.routerId || currentState.defaultGateway || '1.1.1.1';
  const localAs = currentState.bgpAs || 65000;
  const rawNeighbors = currentState.bgpNeighbors;

  const neighborList: Array<{ ip: string; as: string | number; state?: string }> = [];

  if (Array.isArray(rawNeighbors)) {
    rawNeighbors.forEach(n => {
      neighborList.push({
        ip: n.ip,
        as: n.as,
        state: n.state || currentState.bgpNeighborState?.[n.ip]
      });
    });
  } else if (rawNeighbors && typeof rawNeighbors === 'object') {
    Object.entries(rawNeighbors as Record<string, { remoteAs?: number | string; as?: number | string; state?: string }>).forEach(([ip, val]) => {
      neighborList.push({
        ip,
        as: val.as || val.remoteAs || localAs,
        state: val.state || currentState.bgpNeighborState?.[ip]
      });
    });
  }

  if (neighborList.length === 0) {
    return { success: true, output: '\n% BGP is not configured on this device\n' };
  }

  let output = `BGP router identifier ${routerId}, local AS number ${localAs}\n`;
  output += `BGP table version is 1, main routing table version 1\n\n`;
  output += `Neighbor        V           AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd\n`;

  neighborList.forEach(n => {
    const nState = n.state || currentState.bgpNeighborState?.[n.ip] || 'Idle';
    output += `${n.ip.padEnd(15)} 4 ${String(n.as).padEnd(12)} 12      12        1    0    0 00:15:20 ${nState}\n`;
  });

  return { success: true, output };
}

/**
 * Show IP BGP Table
 */
export function cmdShowIpBgp(state: SwitchState, input: string, ctx?: CommandContext): CommandResult {
  const routerId = state.routerId || state.defaultGateway || '1.1.1.1';
  const bgpNetworks = state.bgpNetworks || [];
  const dynamicRoutes = state.dynamicRoutes || [];

  const entries: Array<{ network: string; prefixLength: number; nextHop: string; metric: number; asPath?: string; localPref?: number; weight?: number; internal?: boolean }>
    = bgpNetworks.map(n => ({
      network: n.network,
      prefixLength: getPrefixLength(n.mask),
      nextHop: '0.0.0.0',
      metric: 0,
      asPath: 'i',
      weight: 32768,
    }));

  const learnedRoutes = ctx?.deviceStates && ctx?.sourceDeviceId
    ? calculateBgpRoutes(ctx.sourceDeviceId, ctx.deviceStates)
    : dynamicRoutes.filter(r => r.code === 'B');

  learnedRoutes.forEach(r => {
    const routeObj = r as any;
    if (!bgpNetworks.some(n => n.network === routeObj.destination)) {
      entries.push({
        network: routeObj.destination,
        prefixLength: routeObj.prefixLength || getPrefixLength(routeObj.mask || routeObj.subnetMask || '255.255.255.0'),
        nextHop: routeObj.nextHop || '0.0.0.0',
        metric: routeObj.metric ?? 0,
        asPath: routeObj.asPath || 'i',
        localPref: routeObj.localPreference ?? 100,
        weight: routeObj.weight,
        internal: routeObj.administrativeDistance === 200,
      });
    }
  });


  if (state.routingProtocol === 'bgp') {
    const knownNets = new Set(entries.map(e => e.network));
    dynamicRoutes.forEach(r => {
      if (!knownNets.has(r.destination)) {
        entries.push({
          network: r.destination,
          prefixLength: r.prefixLength || getPrefixLength(r.mask || r.subnetMask || '255.255.255.0'),
          nextHop: r.nextHop || '0.0.0.0',
          metric: r.metric ?? 0,
          asPath: r.asPath || 'i',
          localPref: r.localPreference ?? 100,
        });
      }
    });
  }

  let output = `BGP table version is 1, local router ID ${routerId}\n`;
  output += `Status codes: s suppressed, d damped, h history, * valid, > best, i - internal\n`;
  output += `Origin codes: i - IGP, e - EGP, ? - incomplete\n\n`;
  output += `   Network          Next Hop            Metric LocPrf Weight Path\n`;

  if (entries.length === 0) {
    output += `   No BGP prefixes advertised\n`;
  } else {
    entries.forEach(r => {
      const netStr = `${r.network}/${r.prefixLength}`;
      const nextHop = r.nextHop;
      const metric = r.metric ?? 0;
      const flag = r.internal ? '*>i' : '*>';
      output += `${flag} ${netStr.padEnd(16)} ${String(nextHop).padEnd(20)} ${String(metric).padEnd(5)} ${String(r.localPref ?? 100).padEnd(6)} ${String(r.weight ?? 0).padEnd(6)} ${r.asPath || 'i'}\n`;
    });
  }
  void input;
  return { success: true, output };
}

/**
 * Show IP BGP Neighbors (detailed per neighbor or compact list)
 */
export function cmdShowIpBgpNeighbors(state: SwitchState, input: string, ctx?: CommandContext): CommandResult {
  let currentState = state;
  if (ctx?.deviceStates && ctx?.sourceDeviceId) {
    const updatedStates = recalculateBgpNeighbors(ctx.deviceStates);
    const updatedMyState = updatedStates.get(ctx.sourceDeviceId);
    if (updatedMyState) currentState = updatedMyState;
  }

  const routerId = currentState.routerId || currentState.defaultGateway || '1.1.1.1';
  const localAs = currentState.bgpAs || 65000;
  const neighbors = currentState.bgpNeighbors || [];

  if (neighbors.length === 0) {
    return { success: true, output: '\n% BGP is not configured on this device\n' };
  }

  // Optional specific neighbor: show ip bgp neighbors <ip>
  const specificMatch = input.match(/^show\s+ip\s+bgp\s+neighbors?\s+([0-9.]+)$/i);

  let learnedRoutes: Route[] = [];
  if (ctx?.deviceStates && ctx?.sourceDeviceId) {
    learnedRoutes = calculateBgpRoutes(ctx.sourceDeviceId, ctx.deviceStates);
  }
  const learnedByNeighbor = new Map<string, number>();
  learnedRoutes.forEach(r => {
    learnedByNeighbor.set(r.nextHop, (learnedByNeighbor.get(r.nextHop) || 0) + 1);
  });

  if (specificMatch) {
    const n = neighbors.find(x => x.ip === specificMatch[1]);
    if (!n) {
      return { success: true, output: `% BGP neighbor ${specificMatch[1]} does not exist\n` };
    }
    const keepalive = n.timersKeepalive ?? 60;
    const holdtime = n.timersHoldtime ?? 180;
    const nState = n.state || currentState.bgpNeighborState?.[n.ip] || 'Idle';
    let output = `BGP neighbor is ${n.ip}, remote AS ${n.as}${n.as === localAs ? ', internal link' : ', external link'}\n`;
    output += `  BGP version 4, remote router ID ${routerId}\n`;
    output += `  BGP state = ${nState}, up for 00:15:20\n`;
    output += `  Last read 00:00:${Math.max(1, keepalive - 20)}, hold time is ${holdtime}, keepalive interval is ${keepalive} seconds\n`;
    if (n.description) output += `  Description: ${n.description}\n`;
    if (n.shutdown) output += `  Administratively shut down\n`;
    if (n.updateSource) output += `  Update source is ${n.updateSource}\n`;
    if (n.ebgpMultihop !== undefined) output += `  External BGP multihop: ${n.ebgpMultihop} hops\n`;
    if (n.password) output += `  Message Digest based authentication enabled\n`;
    if (n.nextHopSelf) output += `  Next-hop-self is enabled\n`;
    if (n.defaultOriginate) output += `  Default information originate is enabled\n`;
    if (n.routeReflectorClient) output += `  Route-Reflector Client, cluster-id ${currentState.bgpClusterId || routerId}\n`;
    if (n.maximumPrefix !== undefined) output += `  Maximum prefixes allowed: ${n.maximumPrefix}\n`;
    if (n.allowAsIn !== undefined) output += `  Allow AS in: ${n.allowAsIn}\n`;
    if (n.sendCommunity) output += `  Community attribute sent to this neighbor\n`;
    if (n.removePrivateAs) output += `  Private AS numbers are removed before sending updates\n`;
    if (n.asOverride) output += `  AS override enabled\n`;
    if (n.softReconfiguration) output += `  Inbound soft reconfiguration allowed\n`;
    if (n.routeMapIn) output += `  Incoming update route-map filter is ${n.routeMapIn}\n`;
    if (n.routeMapOut) output += `  Outgoing update route-map filter is ${n.routeMapOut}\n`;
    if (n.weight !== undefined) output += `  BGP weight is ${n.weight}\n`;
    output += `  Received prefix count: ${learnedByNeighbor.get(n.ip) || 0}\n`;
    return { success: true, output };
  }

  let output = `BGP neighbor summary for router ${routerId}, local AS ${localAs}\n\n`;
  output += `Neighbor        V           AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd\n`;
  neighbors.forEach(n => {
    const nState = n.state || currentState.bgpNeighborState?.[n.ip] || 'Idle';
    const received = learnedByNeighbor.get(n.ip) || 0;
    const stateField = nState === 'Established' ? String(received) : nState;
    output += `${n.ip.padEnd(15)} 4 ${String(n.as).padEnd(12)} 12      12        1    0    0 00:15:20 ${stateField}\n`;
  });

  return { success: true, output };
}

/**
 * Show VRRP
 */
export function cmdShowVrrp(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '';
  let found = false;

  Object.entries(state.ports || {}).forEach(([portName, port]) => {
    if (port.vrrp?.groups) {
      Object.entries(port.vrrp.groups).forEach(([groupId, config]) => {
        found = true;
        output += `${portName} - Group ${groupId}\n`;
        output += `  State is ${config.state || 'Init'}\n`;
        output += `  Virtual IP address is ${config.virtualIp || '0.0.0.0'}\n`;
        output += `  Master Router IP address is ${config.state === 'Master' ? (port.ipAddress || 'self') : '192.168.1.1'}\n`;
        output += `  Priority is ${config.priority ?? 100}\n`;
        output += `  Preemption ${config.preempt !== false ? 'enabled' : 'disabled'}\n`;
      });
    }
  });

  if (!found) {
    output = '% VRRP not configured on any interface\n';
  }

  return { success: true, output };
}

/**
 * Show VRRP Brief
 */
export function cmdShowVrrpBrief(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = 'Interface          Grp  Pri Time  Own Pre State   Master addr     Group addr\n';
  let found = false;

  Object.entries(state.ports || {}).forEach(([portName, port]) => {
    if (port.vrrp?.groups) {
      Object.entries(port.vrrp.groups).forEach(([groupId, config]) => {
        found = true;
        const stateStr = (config.state || 'Init').padEnd(7);
        const priStr = String(config.priority ?? 100).padEnd(4);
        const preStr = config.preempt !== false ? 'Y' : 'N';
        const masterIp = config.state === 'Master' ? (port.ipAddress || 'local') : '192.168.1.1';
        const vIp = config.virtualIp || '0.0.0.0';
        output += `${portName.padEnd(18)} ${groupId.padEnd(4)} ${priStr} 3609  N   ${preStr}   ${stateStr} ${masterIp.padEnd(15)} ${vIp}\n`;
      });
    }
  });

  if (!found) {
    output = '% VRRP not configured on any interface\n';
  }

  return { success: true, output };
}

/**
 * Show IPv6 Access-Lists
 */
export function cmdShowIpv6AccessList(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const aclMap = state.ipv6AccessLists || {};
  const keys = Object.keys(aclMap);
  if (keys.length === 0) {
    return { success: true, output: '% No IPv6 access lists configured\n' };
  }

  let output = '';
  keys.forEach(name => {
    output += `IPv6 access list ${name}\n`;
    const rules = aclMap[name] || [];
    rules.forEach((rule, idx) => {
      output += `    sequence ${(idx + 1) * 10} ${rule}\n`;
    });
  });

  return { success: true, output };
}

/**
 * Show IPv6 RIP
 */
export function cmdShowIpv6Rip(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const anyState = state as SwitchState & { ipv6RipProcesses?: Record<string, { interfaces?: string[] }> };
  const ripProcesses = anyState.ipv6RipProcesses || {};
  const keys = Object.keys(ripProcesses);
  if (keys.length === 0) {
    return { success: true, output: '\n% IPv6 RIP is not configured\n' };
  }
  let output = '\nIPv6 RIP Processes:\n';
  keys.forEach(name => {
    const proc = ripProcesses[name];
    output += `  Process "${name}":\n`;
    output += `    Interfaces: ${(proc?.interfaces || []).join(', ') || 'none'}\n`;
  });
  output += '!\n';
  return { success: true, output };
}

/**
 * Show IPv6 OSPF
 */
export function cmdShowIpv6Ospf(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const anyState = state as SwitchState & { ipv6OspfProcesses?: Record<string, { routerId?: string; areas?: string[] }> };
  const ospfProcesses = anyState.ipv6OspfProcesses || {};
  const keys = Object.keys(ospfProcesses);
  if (keys.length === 0) {
    return { success: true, output: '\n% OSPFv3 is not configured\n' };
  }
  let output = '\nOSPFv3 Processes:\n';
  keys.forEach(id => {
    const proc = ospfProcesses[id];
    output += `  Process ${id}:\n`;
    output += `    Router ID: ${proc?.routerId || 'not set'}\n`;
    output += `    Areas: ${(proc?.areas || []).join(', ') || 'none'}\n`;
  });
  output += '!\n';
  return { success: true, output };
}

export function cmdShowIpv6Neighbors(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\nIPv6 Address                              Age Link-layer Addr State Interface\n';

  const ndpCache = state.ndpCache || [];
  const now = Date.now();

  ndpCache.forEach(entry => {
    const ageMs = now - entry.timestamp;
    const ageMin = Math.floor(ageMs / 60000);
    const ageStr = entry.state === 'STATIC' ? '-' : ageMin.toString();
    const mac = entry.mac || '-';

    // Format the line, padding logic:
    // Address: 42 chars
    // Age: 3 chars right aligned
    // Space: 1 char
    // MAC: 15 chars
    // State: 5 chars
    // Interface: rest
    const paddedAddress = entry.ipv6.toUpperCase().padEnd(41, ' ');
    const paddedAge = ageStr.padStart(3, ' ');
    const paddedMac = mac.padEnd(15, ' ');
    const paddedState = entry.state.padEnd(5, ' ');
    output += `${paddedAddress} ${paddedAge} ${paddedMac} ${paddedState} ${entry.interface}\n`;
  });

  return { success: true, output };
}

export function cmdShowPrefixList(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const isIpv6 = /ipv6/i.test(input);
  const targetKey = isIpv6 ? 'ipv6PrefixLists' : 'prefixLists';
  const prefixLists = state[targetKey] || {};
  const names = Object.keys(prefixLists);

  if (names.length === 0) {
    return { success: true, output: `\n% No ${isIpv6 ? 'ipv6' : 'ip'} prefix-lists configured\n` };
  }

  let output = '\n';
  names.forEach(name => {
    const entries = prefixLists[name];
    output += `${isIpv6 ? 'ipv6' : 'ip'} prefix-list ${name}: ${entries.length} entries\n`;
    entries.forEach(e => {
      let line = `   seq ${e.seq} ${e.action} ${e.prefix}`;
      if (e.ge !== undefined) line += ` ge ${e.ge}`;
      if (e.le !== undefined) line += ` le ${e.le}`;
      output += `${line}\n`;
    });
  });

  return { success: true, output };
}

export function cmdShowRouteMap(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const routeMaps = state.routeMaps || {};
  const names = Object.keys(routeMaps);

  if (names.length === 0) {
    return { success: true, output: '\n% No route-maps configured\n' };
  }

  let output = '\n';
  names.forEach(name => {
    const clauses = routeMaps[name];
    clauses.forEach(c => {
      output += `route-map ${name}, ${c.action}, sequence ${c.seq}\n`;
      output += '  Match clauses:\n';
      const mKeys = Object.keys(c.matchRules || {});
      if (mKeys.length === 0) {
        output += '    none\n';
      } else {
        if (c.matchRules.prefixList) output += `    ip address prefix-list ${c.matchRules.prefixList}\n`;
        if (c.matchRules.acl) output += `    ip address ${c.matchRules.acl}\n`;
        if (c.matchRules.interface) output += `    interface ${c.matchRules.interface}\n`;
      }
      output += '  Set clauses:\n';
      const sKeys = Object.keys(c.setRules || {});
      if (sKeys.length === 0) {
        output += '    none\n';
      } else {
        if (c.setRules.metric !== undefined) output += `    metric ${c.setRules.metric}\n`;
        if (c.setRules.nextHop) output += `    ip next-hop ${c.setRules.nextHop}\n`;
        if (c.setRules.localPreference !== undefined) output += `    local-preference ${c.setRules.localPreference}\n`;
      }
    });
  });

  return { success: true, output };
}

export function cmdShowIpv6EigrpNeighbors(state: SwitchState, _input: string, ctx?: CommandContext): CommandResult {
  const as = state.eigrp6Config?.as;
  if (!as || state.eigrp6Config?.shutdown) return { success: true, output: '\n% EIGRPv6 is not configured\n' };

  let output = `\nEIGRP-IPv6 Neighbors for AS(${as})\n`;
  output += 'H   Address                                 Interface       Hold Uptime   SRTT   RTO  Q  Seq\n';
  output += '                                                            (sec)         (ms)        Cnt Num\n';

  const neighbors: Array<{ address: string; intf: string }> = [];

  if (ctx?.deviceStates && ctx?.sourceDeviceId) {
    const myId = ctx.sourceDeviceId;
    ctx.deviceStates.forEach((otherState, otherId) => {
      if (otherId === myId) return;
      if (otherState.eigrp6Config?.as !== as || otherState.eigrp6Config?.shutdown) return;

      Object.values(state.ports || {}).forEach(port => {
        if (!port.ipv6Eigrp?.enabled || port.ipv6Eigrp.as !== as || port.shutdown) return;
        const nPort = Object.values(otherState.ports || {}).find(p =>
          (p.ipv6Address || p.ipv6LinkLocal) && !p.shutdown && p.ipv6Eigrp?.enabled && p.ipv6Eigrp.as === as
        );
        if (nPort) {
          const nIp = nPort.ipv6LinkLocal || (nPort.ipv6Address ? nPort.ipv6Address.split('/')[0] : 'FE80::1');
          if (!neighbors.some(n => n.address === nIp && n.intf === port.id)) {
            neighbors.push({ address: nIp, intf: port.id });
          }
        }
      });
    });
  }

  if (neighbors.length > 0) {
    neighbors.forEach((n, idx) => {
      output += `${idx.toString().padEnd(4)} ${n.address.padEnd(39)} ${n.intf.padEnd(15)} 14 00:04:12    1   200  0  ${idx + 1}\n`;
    });
  } else {
    let hIdx = 0;
    Object.values(state.ports || {}).forEach(port => {
      if (port.ipv6Eigrp?.enabled && !port.shutdown) {
        const neighborIp = port.ipv6LinkLocal || 'FE80::1';
        output += `${hIdx.toString().padEnd(4)} ${neighborIp.padEnd(39)} ${port.id.padEnd(15)} 14 00:04:12    1   200  0  ${hIdx + 1}\n`;
        hIdx++;
      }
    });
  }

  return { success: true, output };
}

export function cmdShowIpv6EigrpTopology(state: SwitchState, _input: string, ctx?: CommandContext): CommandResult {
  const as = state.eigrp6Config?.as;
  if (!as || state.eigrp6Config?.shutdown) {
    return { success: true, output: '\n% EIGRPv6 is not configured on this device\n' };
  }

  const routerId = state.eigrp6Config?.routerId || state.routerId || '1.1.1.1';
  let output = `\nEIGRP-IPv6 Topology Table for AS(${as})/ID(${routerId})\n`;
  output += 'Codes: P - Passive, A - Active, U - Update, Q - Query, R - Reply, r - reply Status, s - sia Status\n\n';

  if (!ctx?.deviceStates || !ctx?.sourceDeviceId) {
    output += 'P 2001:DB8:1::/64, 1 successors, FD is 281600\n        via Connected, GigabitEthernet1/0/1\n';
    return { success: true, output };
  }

  const topoTable = buildEigrp6TopologyTable(ctx.sourceDeviceId, ctx.deviceStates);
  if (topoTable.length === 0) {
    output += '% EIGRPv6 topology table is empty\n';
    return { success: true, output };
  }

  const grouped = new Map<string, EigrpTopologyEntry[]>();
  topoTable.forEach(entry => {
    const key = `${entry.destination}/${entry.subnetMask}`;
    const list = grouped.get(key) || [];
    list.push(entry);
    grouped.set(key, list);
  });

  grouped.forEach((entries, key) => {
    const successorCount = entries.filter(e => e.isSuccessor).length;
    const fd = entries[0]?.feasibleDistance || 0;
    const stateCode = entries[0]?.state === 'Active' ? 'A' : 'P';
    output += `${stateCode} ${key}, ${successorCount} successors, FD is ${fd}\n`;
    entries.forEach(e => {
      const viaText = e.neighborIp === 'Connected' ? 'Connected' : e.neighborIp;
      output += `        via ${viaText} (${e.computedDistance}/${e.reportedDistance}), ${e.interfaceId}\n`;
    });
  });

  return { success: true, output };
}

export function cmdShowIpv6EigrpInterfaces(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const as = state.eigrp6Config?.as;
  if (!as || state.eigrp6Config?.shutdown) {
    return { success: true, output: '\n% EIGRPv6 is not configured on this device\n' };
  }

  let output = `\nEIGRP-IPv6 Interfaces for AS(${as})\n`;
  output += 'Xmit Queue   PeerQ        Mean SRTT   Pacing Time   Multicast    Pending\n';
  output += 'Interface              Peers  Un/Reliable  Un/Reliable  (ms)        Un/Reliable   Flow Timer   Routes\n';

  Object.entries(state.ports || {}).forEach(([portId, port]) => {
    if (port.ipv6Eigrp?.enabled && port.ipv6Eigrp.as === as && !port.shutdown) {
      output += `${portId.padEnd(23)}1      0/0          0/0          12          0/10          0            0\n`;
    }
  });

  return { success: true, output };
}


export function cmdShowGlbp(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\n';
  let found = false;

  Object.entries(state.ports || {}).forEach(([portId, port]) => {
    if (port.glbp?.groups) {
      Object.entries(port.glbp.groups).forEach(([gId, group]) => {
        found = true;
        output += `${portId} - Group ${gId}\n`;
        output += `  State is ${group.state || 'Listen'}\n`;
        output += `  Virtual IP address is ${group.virtualIp || '192.168.1.254'}\n`;
        output += `  Active is ${group.state === 'Active' ? 'local' : '192.168.1.1'}\n`;
        output += `  Standby is ${group.state === 'Standby' ? 'local' : '192.168.1.2'}\n`;
        output += `  Virtual MAC address is ${group.avgMac || '0007.b400.0101'} (Active)\n`;
        if (group.loadBalancing) {
          output += `  Load balancing mode is ${group.loadBalancing}\n`;
        }
      });
    }
  });

  if (!found) {
    return { success: true, output: '\n% GLBP is not configured on any interface\n' };
  }

  return { success: true, output };
}

export function cmdShowIpFlowExport(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const conf = state.netflowConfig;
  if (!conf || !conf.exportDestination) {
    return { success: true, output: '\nNetFlow export is disabled\n' };
  }

  let output = '\nNetFlow export status:\n';
  output += `  Version ${conf.version || 5} export flow records\n`;
  output += `  Exporting flows to ${conf.exportDestination} port ${conf.exportPort || 2055}\n`;
  output += '  Exporting source loopback 0\n';
  output += '  1542 packets exported, 34 exports executed\n';
  return { success: true, output };
}

export function cmdShowIpCacheFlow(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const cache = state.netflowCache || [
    { srcIp: '10.0.0.5', dstIp: '192.168.1.100', proto: '06', srcPort: 443, dstPort: 80, pkts: 24, bytes: 14200, active: 12 },
    { srcIp: '10.0.0.8', dstIp: '172.16.0.2', proto: '11', srcPort: 53, dstPort: 53, pkts: 4, bytes: 320, active: 2 }
  ];

  let output = '\nIP packet size distribution (100 total packets):\n';
  output += '  1-32   64  128  256  512 1024\n';
  output += '  .000 .800 .100 .050 .050 .000\n\n';
  output += 'SrcIf          SrcIPaddress    DstIf          DstIPaddress    Pr SrcP DstP  Pkts\n';

  cache.forEach(c => {
    output += `Gi0/0          ${c.srcIp.padEnd(15)} Gi0/1          ${c.dstIp.padEnd(15)} ${c.proto} ${c.srcPort.toString().padStart(4, '0')} ${c.dstPort.toString().padStart(4, '0')} ${c.pkts.toString().padStart(5)}\n`;
  });

  return { success: true, output };
}
