import { IOS_ERRORS, iosModeError } from './iosErrors';

import type { CommandHandler, CommandContext } from './commandTypes';
import type { SwitchState, CommandResult, Route } from '../types';
import type { CanvasDevice } from '@/components/network/networkTopology.types';
import { buildRunningConfig } from './configBuilder';
import { canAssignIPToPhysicalPort, isLayer3Switch } from '../switchModels';
import { getPvstUpdate } from './commandHelpers';
import { getDeviceCapabilities } from '../capabilities';
import { validateIpRoutingSupport } from './L3Validation';
import { createStubHandler } from './stubCommandHints';
import { cmdAccessList, cmdNoAccessList } from './interface/cmd.misc';
import { cmdIpDhcpPool, cmdNoIpDhcpPool, cmdIpv6DhcpPool, cmdIpDhcpExcludedAddress, cmdNoIpDhcpExcludedAddress, cmdIpDhcpSnoopingVlan, cmdNoIpDhcpSnooping, cmdIpDhcpSnoopingInformationOption } from './globalConfigDhcpCommands';
import { cmdIpNatPool, cmdIpNatInsideSourceStatic, cmdIpNatInsideSourceList, cmdLoggingHost, cmdLoggingTrap, cmdNtpServer, cmdNtpMaster, cmdNoNtpServer, cmdClockTimezone, cmdIpNameServer, cmdIpHost, cmdAliasExec, cmdNoAliasExec, cmdIpSla, cmdTrack, cmdLldpTlvSelect, cmdSpanningTreeMst, cmdIpPrefixList, cmdRouteMap, cmdIpv6RouterEigrp, cmdSpanningTreeLoopguardDefault, cmdIpFlowExport, cmdNoIpPrefixList, cmdNoIpv6PrefixList, cmdNoRouteMap } from './globalConfigNetworkCommands';

import { cmdClassMap, cmdPolicyMap, cmdClass, cmdSetDscp, cmdSetCoS, cmdPolice, cmdNoClassMap, cmdNoPolicyMap } from './qosMqcCommands';
import { cmdDot1xSystem } from './dot1xCommands';
import { cmdAaaNewModel, cmdNoAaaNewModel, cmdAaaAuthentication, cmdRadiusServerHost, cmdTacacsServerHost, cmdRadiusServerKey, cmdTacacsServerKey } from './globalConfigAaaCommands';
import {
  cmdNoIpHttpServer,
  cmdNoIpDomainLookup,
  cmdNoIpDomainName,
  cmdNoIpRouting,
  cmdNoIpSshTimeOut,
  cmdNoMlsQos,
  cmdIpSshVersion,
  cmdIpDomainLookup,
  cmdSystemMtu,
  cmdSdmPrefer,
  cmdIpSshAuthRetries
} from './globalConfigServiceCommands';
import {
  cmdNoSpanningTree,
  cmdNoUsername,
  cmdUsername,
  cmdNoInterface,
  cmdSpanningTreeVlan,
  cmdSpanningTreePortfastDefault,
  cmdErrdisableRecovery,
  cmdVtpPassword,
  cmdIpArpInspection,
  cmdNoIpArpInspection,
  cmdCryptoKeyGenerateRsa,
  cmdCryptoKeyZeroizeRsa,
  cmdServicePasswordEncryption,
  cmdNoServicePasswordEncryption,
  cmdEnableSecret,
  cmdEnablePassword,
  cmdNoEnableSecret,
  cmdNoEnablePassword,
  cmdBannerMotd,
  cmdNoBannerMotd,
  cmdBannerLogin,
  cmdNoBannerLogin,
  cmdBannerExec,
  cmdNoBannerExec
} from './globalConfigSecurityCommands';
import {
  cmdIpAccessList,
  cmdIpv6AccessList,
  cmdIpv6AclPermit,
  cmdIpv6AclDeny,
  cmdNamedAclPermit,
  cmdNamedAclDeny,
  cmdNamedAclNoPermit,
  cmdNamedAclNoDeny,
  cmdExtAclPermit,
  cmdExtAclDeny,
  cmdExtAclNoPermit,
  cmdExtAclNoDeny,
  cmdNoIpAccessList
} from './globalConfigAclCommands';

import {
  cmdMstName,
  cmdMstRevision,
  cmdMstInstance,
  cmdNoMstInstance,
  cmdMstShowPending,
  cmdSpanningTreeMstPriority
} from './globalConfigMstpCommands';
import {
  cmdIpv6UnicastRouting,
  cmdNoIpv6UnicastRouting,
  cmdIpv6Route,
  cmdNoIpv6Route,
  cmdIpv6RouterRip,
  cmdIpv6RouterOspf,
  cmdNoIpv6RouterRip,
  cmdNoIpv6RouterOspf
} from './globalConfigIpv6Commands';

// Global config (hostname, vlan, vtp, spanning-tree, security, ip domain-name, etc.)

export const globalConfigHandlers: Record<string, CommandHandler> = {
  'hostname': cmdHostname,
  'no hostname': cmdNoHostname,
  'vlan': cmdVlan,
  'no vlan': cmdNoVlan,
  'name': (state, input, ctx) => {
    if (state.currentMode === 'config-mst') return cmdMstName(state, input);
    return cmdVlanName(state, input, ctx);
  },
  'no name': cmdNoVlanName,
  'revision': cmdMstRevision,
  'instance': cmdMstInstance,
  'no instance': cmdNoMstInstance,
  'show pending': cmdMstShowPending,
  'spanning-tree mst priority': cmdSpanningTreeMstPriority,
  'aaa new-model': cmdAaaNewModel,
  'no aaa new-model': cmdNoAaaNewModel,
  'aaa authentication login': cmdAaaAuthentication,
  'radius-server host': cmdRadiusServerHost,
  'tacacs-server host': cmdTacacsServerHost,
  'radius-server key': cmdRadiusServerKey,
  'tacacs-server key': cmdTacacsServerKey,
  'state': cmdVlanState,
  'vtp mode': cmdVtpMode,
  'vtp domain': cmdVtpDomain,
  'spanning-tree mode': cmdSpanningTreeMode,
  'spanning-tree vlan': cmdSpanningTreeVlan,
  'spanning-tree portfast': cmdSpanningTreePortfastDefault,
  'no spanning-tree': cmdNoSpanningTree,
  'service password-encryption': cmdServicePasswordEncryption,
  'no service password-encryption': cmdNoServicePasswordEncryption,
  'enable secret': cmdEnableSecret,
  'no enable secret': cmdNoEnableSecret,
  'enable password': cmdEnablePassword,
  'no enable password': cmdNoEnablePassword,
  'banner motd': cmdBannerMotd,
  'no banner motd': cmdNoBannerMotd,
  'banner login': cmdBannerLogin,
  'no banner login': cmdNoBannerLogin,
  'banner exec': cmdBannerExec,
  'no banner exec': cmdNoBannerExec,
  'ip default-gateway': cmdIpDefaultGateway,
  'no ip default-gateway': cmdNoIpDefaultGateway,
  'ip domain-name': cmdIpDomainName,
  'ip domain lookup': cmdIpDomainLookup,
  'ip domain-lookup': cmdIpDomainLookup,
  'no ip domain-lookup': cmdNoIpDomainLookup,
  'no ip domain-name': cmdNoIpDomainName,
  'ip routing': cmdIpRouting,
  'no ip routing': cmdNoIpRouting,
  'ip route': cmdIpRoute,
  'no ip route': cmdNoIpRoute,
  'ip ssh time-out': cmdIpSshTimeOut,
  'no ip ssh time-out': cmdNoIpSshTimeOut,
  'ip dhcp snooping': cmdIpDhcpSnooping,
  'no ip dhcp snooping': cmdNoIpDhcpSnooping,
  'mls qos': cmdMlsQos,
  'dot1x system-auth-control': cmdDot1xSystem,
  'no mls qos': cmdNoMlsQos,
  'cdp run': cmdCdpRun,
  'no cdp run': cmdNoCdpRun,
  'lldp run': cmdLldpRun,
  'lldp tlv-select': cmdLldpTlvSelect,
  'no lldp run': cmdNoLldpRun,
  'username': cmdUsername,
  'no username': cmdNoUsername,
  // 'interface' command handler is in interfaceCommands.ts for proper port validation
  // We handle VLAN interfaces here
  'no interface': cmdNoInterface,
  // Routing protocols
  'router rip': cmdRouterRip,
  'router ospf': cmdRouterOspf,
  'router eigrp': cmdRouterEigrp,
  'router bgp': cmdRouterBgp,
  'no router rip': cmdNoRouterRip,
  'no router ospf': cmdNoRouterOspf,
  'no router eigrp': cmdNoRouterEigrp,
  'no router bgp': cmdNoRouterBgp,
  // HTTP Server
  'ip http server': cmdIpHttpServer,
  'no ip http server': cmdNoIpHttpServer,
  // SSH version
  'ip ssh version': cmdIpSshVersion,
  'ip dhcp snooping vlan': cmdIpDhcpSnoopingVlan,
  'ip dhcp snooping information option': cmdIpDhcpSnoopingInformationOption,
  'no ip dhcp snooping information option': cmdIpDhcpSnoopingInformationOption,
  'ip arp inspection': cmdIpArpInspection,
  'no ip arp inspection': cmdNoIpArpInspection,
  'errdisable recovery': cmdErrdisableRecovery,
  'errdisable recovery cause': cmdErrdisableRecovery,
  'vtp password': cmdVtpPassword,
  'ntp server': cmdNtpServer,
  'no ntp server': cmdNoNtpServer,
  'ntp master': cmdNtpMaster,
  'clock timezone': cmdClockTimezone,
  'ip name-server': cmdIpNameServer,
  'system mtu': cmdSystemMtu,
  'sdm prefer': cmdSdmPrefer,
  'ipv6 unicast-routing': cmdIpv6UnicastRouting,
  'no ipv6 unicast-routing': cmdNoIpv6UnicastRouting,
  'ipv6 route': cmdIpv6Route,
  'no ipv6 route': cmdNoIpv6Route,
  'ipv6 router rip': cmdIpv6RouterRip,
  'ipv6 router ospf': cmdIpv6RouterOspf,
  'ipv6 router eigrp': cmdIpv6RouterEigrp,
  'no ipv6 router rip': cmdNoIpv6RouterRip,
  'no ipv6 router ospf': cmdNoIpv6RouterOspf,
  'ip prefix-list': cmdIpPrefixList,
  'ipv6 prefix-list': cmdIpPrefixList,
  'no ip prefix-list': cmdNoIpPrefixList,
  'no ipv6 prefix-list': cmdNoIpv6PrefixList,
  'route-map': cmdRouteMap,
  'no route-map': cmdNoRouteMap,
  'spanning-tree loopguard default': cmdSpanningTreeLoopguardDefault,
  'no spanning-tree loopguard default': cmdSpanningTreeLoopguardDefault,
  'ip flow-export': cmdIpFlowExport,
  'no ip flow-export': cmdIpFlowExport,
  'ip ssh authentication-retries': cmdIpSshAuthRetries,
  'crypto key generate rsa': cmdCryptoKeyGenerateRsa,
  'crypto key zeroize rsa': cmdCryptoKeyZeroizeRsa,
  'ip dhcp pool': cmdIpDhcpPool,
  'no ip dhcp pool': cmdNoIpDhcpPool,
  'ipv6 dhcp pool': cmdIpv6DhcpPool,
  'ip dhcp excluded-address': cmdIpDhcpExcludedAddress,
  'no ip dhcp excluded-address': cmdNoIpDhcpExcludedAddress,
  'cdp timer': cmdCdpTimer,
  'cdp holdtime': cmdCdpHoldtime,
  'lldp timer': cmdLldpTimer,
  'lldp holdtime': cmdLldpHoldtime,
  'lldp reinit': cmdLldpReinit,
  'snmp-server community': cmdSnmpCommunity,
  'snmp-server contact': cmdSnmpContact,
  'snmp-server location': cmdSnmpLocation,
  'archive': createStubHandler('archive'),
  'alias': cmdAliasExec,
  'no alias': cmdNoAliasExec,
  'macro': createStubHandler('macro'),
  'default interface': cmdDefaultInterface,
  'configure replace': createStubHandler('configure replace'),
  'mac access-list': createStubHandler('mac access-list'),
  'class-map': cmdClassMap,
  'no class-map': cmdNoClassMap,
  'policy-map': cmdPolicyMap,
  'no policy-map': cmdNoPolicyMap,
  'class': cmdClass,
  'police': cmdPolice,
  'set dscp': cmdSetDscp,
  'set cos': cmdSetCoS,
  'template': createStubHandler('template'),
  'access-list': cmdAccessList,
  'no access-list': cmdNoAccessList,
  'ip access-list': cmdIpAccessList,
  'permit (named-acl)': cmdNamedAclPermit,
  'deny (named-acl)': cmdNamedAclDeny,
  'no permit (named-acl)': cmdNamedAclNoPermit,
  'no deny (named-acl)': cmdNamedAclNoDeny,
  'permit (ext-named-acl)': cmdExtAclPermit,
  'deny (ext-named-acl)': cmdExtAclDeny,
  'no permit (ext-named-acl)': cmdExtAclNoPermit,
  'no deny (ext-named-acl)': cmdExtAclNoDeny,
  'no ip access-list': cmdNoIpAccessList,
  'ipv6 access-list': cmdIpv6AccessList,
  'permit (ipv6-acl)': cmdIpv6AclPermit,
  'deny (ipv6-acl)': cmdIpv6AclDeny,
  'ip host': cmdIpHost,
  'no ip host': cmdNoIpHost,
  'no ipv6 dhcp pool': cmdNoIpv6DhcpPool,

  'ip nat pool': cmdIpNatPool,
  'ip nat inside source static': cmdIpNatInsideSourceStatic,
  'ip nat inside source list': cmdIpNatInsideSourceList,
  'logging host': cmdLoggingHost,
  'logging trap': cmdLoggingTrap,
  'ip sla': cmdIpSla,
  'ip sla schedule': cmdIpSla,
  'track': cmdTrack,
  'no track': cmdTrack,
  'spanning-tree mst configuration': cmdSpanningTreeMst,
};


/**
 * Hostname - Set device hostname
 */
function cmdHostname(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^hostname\s+(.+)$/i);
  if (!match) {
    return { success: false, error: IOS_ERRORS.invalidInput };
  }

  const hostname = match[1].trim();
  // hostname: max 63 chars, must start with a letter, alphanumeric + hyphens only
  if (hostname.length > 63 || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(hostname)) {
    return { success: false, error: "% Invalid input detected at '^' marker." };
  }

  return {
    success: true,
    newState: { hostname },
    hint: {
      tr: '💡 Gerçek dünyada: Anlamlı bir hostname cihazı ağda tanımlamayı kolaylaştırır (örn: Kat2-SW).',
      en: '💡 In the real world: A meaningful hostname makes it easier to identify the device in the network (e.g., Floor2-SW).'
    }
  };
}

function cmdNoHostname(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }
  return {
    success: true,
    newState: { hostname: 'Switch' }
  };
}

/**
 * IP Routing - Enable IP routing
 */
function cmdIpRouting(state: SwitchState, _input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  // Validate IP routing support with comprehensive checks
  const validation = validateIpRoutingSupport(state.switchModel, state);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Check device capabilities as backup
  const currentDevice = ctx.devices?.find((d: CanvasDevice) => d.id === ctx.sourceDeviceId);
  const capabilities = getDeviceCapabilities(currentDevice || null, state.switchModel);
  if (!capabilities.routing) {
    const deviceLabel = state.deviceType === 'router' ? 'router' : (isLayer3Switch(state.switchModel) ? 'Layer 3 switch' : 'Layer 2 switch');
    return {
      success: false,
      error: `% Invalid command. ${deviceLabel} (${state.switchModel}) does not support IP routing.\nIP routing is only supported on routers and Layer 3 switches.`
    };
  }

  let output = 'IP routing enabled\n';
  const newState: Partial<SwitchState> = { ipRouting: true };

  // If sdm prefer was configured, show helpful message
  if (state.sdmPreferConfigured) {
    output += 'SDM preference configuration is active. Routing table has been allocated.\n';
  }

  return {
    success: true,
    output,
    newState
  };
}

/**
 * IP Route - Add static route
 */
function cmdIpRoute(state: SwitchState, input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  // Check if device supports routing (router or L3 switch)
  const currentDevice = ctx.devices?.find((d: CanvasDevice) => d.id === ctx.sourceDeviceId);
  const capabilities = getDeviceCapabilities(currentDevice || null, state.switchModel);
  if (!capabilities.routing) {
    const deviceLabel = state.deviceType === 'router' ? 'router' : (isLayer3Switch(state.switchModel) ? 'Layer 3 switch' : 'Layer 2 switch');
    return {
      success: false,
      error: `% Invalid command. ${deviceLabel} (${state.switchModel}) does not support static routing.\nStatic routing is only supported on routers and Layer 3 switches.`
    };
  }

  const match = input.match(/^ip\s+route\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+|\S+)(?:\s+(\d+))?$/i);
  if (!match) {
    return { success: false, error: '% Invalid ip route command. Use: ip route <network> <mask> <next-hop|interface> [administrative-distance]' };
  }

  const [, network, mask, nextHop, adminDistance] = match;
  const metric = adminDistance ? parseInt(adminDistance, 10) : 1;

  const newStaticRoutes = [...(state.staticRoutes || [])];
  // Remove existing route to same destination if exists
  const filteredRoutes = newStaticRoutes.filter(
    (route: Route) => !(route.destination === network && route.subnetMask === mask)
  );
  filteredRoutes.push({ destination: network, subnetMask: mask, nextHop, metric, type: 'static' });

  return {
    success: true,
    newState: {
      staticRoutes: filteredRoutes,
      ipRouting: true
    }
  };
}

/**
 * no ip host <name>
 */
function cmdNoIpHost(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') return { success: false, error: iosModeError() };
  const match = input.match(/^no\s+ip\s+host\s+(\S+)(?:\s+[0-9.]+)?$/i);
  if (!match) return { success: false, error: '% Invalid no ip host command' };

  const hostName = match[1];
  const services = { ...state.services };
  if (services.dns && services.dns.records) {
    services.dns.records = services.dns.records.filter((r: { domain: string; address: string }) => r.domain !== hostName);
  }

  const updatedState = { ...state, services };
  return { success: true, newState: { services, runningConfig: buildRunningConfig(updatedState) } };
}

/**
 * no ipv6 dhcp pool <name>
 */
function cmdNoIpv6DhcpPool(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') return { success: false, error: iosModeError() };
  const match = input.match(/^no\s+ipv6\s+dhcp\s+pool\s+(\S+)$/i);
  if (!match) return { success: false, error: '% Invalid no ipv6 dhcp pool command' };

  const poolName = match[1];
  const pools = { ...state.ipv6DhcpPools };
  if (!pools[poolName]) return { success: false, error: `% DHCP pool ${poolName} not found` };
  delete pools[poolName];

  const updatedState = { ...state, ipv6DhcpPools: pools };
  return { success: true, newState: { ipv6DhcpPools: pools, runningConfig: buildRunningConfig(updatedState) } };
}

/**
 * Router EIGRP - Enable EIGRP routing
 */
function cmdRouterEigrp(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const deviceLabel = state.deviceType === 'router' ? 'router' : (isLayer3Switch(state.switchModel) ? 'Layer 3 switch' : 'Layer 2 switch');
  if (state.deviceType !== 'router' && !canAssignIPToPhysicalPort(state.switchModel)) {
    return {
      success: false,
      error: `% Invalid command. ${deviceLabel} (${state.switchModel}) does not support routing protocols.`
    };
  }

  const match = input.match(/^router\s+eigrp\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: IOS_ERRORS.incomplete };
  }

  const asNumber = match[1];
  return {
    success: true,
    output: `EIGRP Routing Process enabled with AS ${asNumber}`,
    newState: {
      routingProtocol: 'eigrp',
      ipRouting: true,
      eigrpAs: asNumber,
      currentMode: 'router-config',
      dynamicRoutes: state.routingProtocol !== 'eigrp' ? [] : state.dynamicRoutes
    }
  };
}

/**
 * No Router EIGRP
 */
function cmdNoRouterEigrp(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^no\s+router\s+eigrp\s+(\d+)$/i);
  if (!match) return { success: false, error: IOS_ERRORS.incomplete };

  return {
    success: true,
    output: 'EIGRP Routing Protocol disabled',
    newState: {
      routingProtocol: 'none',
      dynamicRoutes: [],
      eigrpAs: undefined
    }
  };
}

/**
 * Router BGP - Enable BGP routing
 */
function cmdRouterBgp(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const deviceLabel = state.deviceType === 'router' ? 'router' : (isLayer3Switch(state.switchModel) ? 'Layer 3 switch' : 'Layer 2 switch');
  if (!canAssignIPToPhysicalPort(state.switchModel)) {
    return {
      success: false,
      error: `% Invalid command. ${deviceLabel} (${state.switchModel}) does not support routing protocols.`
    };
  }

  const match = input.match(/^router\s+bgp\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: IOS_ERRORS.incomplete };
  }

  const asNumber = match[1];
  return {
    success: true,
    output: `BGP Routing Process enabled with AS ${asNumber}`,
    newState: {
      routingProtocol: 'bgp',
      ipRouting: true,
      bgpAs: asNumber,
      currentMode: 'router-config',
      dynamicRoutes: state.routingProtocol !== 'bgp' ? [] : state.dynamicRoutes
    }
  };
}

/**
 * No Router BGP
 */
function cmdNoRouterBgp(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^no\s+router\s+bgp\s+(\d+)$/i);
  if (!match) return { success: false, error: IOS_ERRORS.incomplete };

  return {
    success: true,
    output: 'BGP Routing Protocol disabled',
    newState: {
      routingProtocol: 'none',
      dynamicRoutes: [],
      bgpAs: undefined
    }
  };
}

/**
 * No IP Route - Remove static route
 */
function cmdNoIpRoute(state: SwitchState, input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  // Check if device supports routing (router or L3 switch)
  const currentDevice = ctx.devices?.find((d: CanvasDevice) => d.id === ctx.sourceDeviceId);
  const capabilities = getDeviceCapabilities(currentDevice || null, state.switchModel);
  if (!capabilities.routing) {
    const deviceLabel = state.deviceType === 'router' ? 'router' : (isLayer3Switch(state.switchModel) ? 'Layer 3 switch' : 'Layer 2 switch');
    return {
      success: false,
      error: `% Invalid command. ${deviceLabel} (${state.switchModel}) does not support static routing.\nStatic routing is only supported on routers and Layer 3 switches.`
    };
  }

  const match = input.match(/^no\s+ip\s+route\s+([0-9.]+)\s+([0-9.]+)(?:\s+([0-9.]+|\S+))?$/i);
  if (!match) {
    return { success: false, error: '% Invalid no ip route command' };
  }

  const [, network, mask, nextHop] = match;

  let newStaticRoutes;
  if (nextHop) {
    // Remove specific route
    newStaticRoutes = (state.staticRoutes || []).filter(
      (route: Route) => !(route.destination === network && route.subnetMask === mask && route.nextHop === nextHop)
    );
  } else {
    // Remove all routes for this network/mask
    newStaticRoutes = (state.staticRoutes || []).filter(
      (route: Route) => !(route.destination === network && route.subnetMask === mask)
    );
  }

  return {
    success: true,
    newState: { staticRoutes: newStaticRoutes }
  };
}

/**
 * IP SSH Time-Out
 */
function cmdIpSshTimeOut(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^ip\s+ssh\s+time-out\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid SSH time-out command' };
  }

  return {
    success: true,
    newState: { sshTimeout: parseInt(match[1]) }
  };
}

/**
 * IP DHCP Snooping - Enable DHCP snooping
 */
function cmdIpDhcpSnooping(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: { dhcpSnoopingEnabled: true }
  };
}

/**
 * MLS QoS - Enable MLS QoS
 */
function cmdMlsQos(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config' && state.currentMode !== 'interface') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: { mlsQosEnabled: true }
  };
}



/**
 * VLAN - Create/enter VLAN configuration
 */
function cmdVlan(state: SwitchState, input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^vlan\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: IOS_ERRORS.invalidInput };
  }

  const vlanId = match[1];
  const vlanNum = parseInt(vlanId, 10);

  if (vlanNum < 1 || vlanNum > 4094) {
    return { success: false, error: `% VLAN ID ${vlanId} is not in the range 1 to 4094.` };
  }
  if (vlanNum >= 1002 && vlanNum <= 1005) {
    return { success: false, error: `% VLAN ${vlanNum} is a reserved VLAN and cannot be created.` };
  }

  const newVlans = { ...state.vlans };

  if (!newVlans[vlanId]) {
    newVlans[vlanId] = {
      id: vlanNum,
      name: `VLAN${vlanId}`,
      status: 'active',
      ports: []
    };
  }

  const shouldBumpVtp = (state.vtpMode === 'server') && !!state.vtpDomain;
  const nextVtpRevision = shouldBumpVtp ? ((state.vtpRevision || 0) + 1) : state.vtpRevision;

  const updatedCurrentState = {
    ...state,
    vlans: newVlans,
    vtpRevision: nextVtpRevision,
    currentMode: 'vlan' as const,
    currentVlan: vlanNum
  };

  const pvst = getPvstUpdate(updatedCurrentState, ctx);
  if ('error' in pvst) return pvst.error;
  const { allUpdatedStates, myUpdatedState } = pvst;

  return {
    success: true,
    newState: myUpdatedState || updatedCurrentState,
    updatedDeviceStates: allUpdatedStates,
    hint: {
      tr: `💡 İpucu: VLAN ${vlanId} oluşturuldu. Şimdi 'name' komutu ile isim verebilir veya arayüzleri bu VLAN'a atayabilirsiniz.`,
      en: `💡 Hint: VLAN ${vlanId} created. Now you can give it a name using the 'name' command or assign interfaces to this VLAN.`
    }
  };
}

/**
 * No VLAN - Delete VLAN
 */
function cmdNoVlan(state: SwitchState, input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^no\s+vlan\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid VLAN ID' };
  }

  const vlanId = match[1];

  if (vlanId === '1') {
    return { success: false, error: '% Cannot remove VLAN 1.' };
  }

  const newVlans = { ...state.vlans };

  if (!newVlans[vlanId]) {
    return { success: false, error: `% VLAN ${vlanId} does not exist` };
  }

  delete newVlans[vlanId];

  const shouldBumpVtp = (state.vtpMode === 'server') && !!state.vtpDomain;
  const nextVtpRevision = shouldBumpVtp ? ((state.vtpRevision || 0) + 1) : state.vtpRevision;

  const updatedCurrentState = {
    ...state,
    vlans: newVlans,
    vtpRevision: nextVtpRevision,
  };

  const pvst = getPvstUpdate(updatedCurrentState, ctx);
  if ('error' in pvst) return pvst.error;
  const { allUpdatedStates, myUpdatedState } = pvst;

  return {
    success: true,
    newState: myUpdatedState || updatedCurrentState,
    updatedDeviceStates: allUpdatedStates
  };
}

/**
 * VLAN Name
 */
function cmdVlanName(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'vlan' || state.currentVlan == null) {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^name\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid VLAN name command' };
  }

  const vlanId = String(state.currentVlan);
  const vlan = state.vlans?.[vlanId];
  if (!vlan) {
    return { success: false, error: '% VLAN not found' };
  }

  const shouldBumpVtp = (state.vtpMode === 'server') && !!state.vtpDomain;
  const nextVtpRevision = shouldBumpVtp ? ((state.vtpRevision || 0) + 1) : state.vtpRevision;

  return {
    success: true,
    newState: {
      vlans: {
        ...state.vlans,
        [vlanId]: {
          ...vlan,
          name: match[1]
        }
      },
      vtpRevision: nextVtpRevision,
    }
  };
}

/**
 * No Name - Clear VLAN name (only valid in vlan mode)
 */
function cmdNoVlanName(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'vlan') {
    return { success: false, error: '% Invalid command. no name is only valid in VLAN configuration mode.\nUsage: vlan <id> -> no name' };
  }

  const newVlans = { ...state.vlans };
  const currentVlanId = state.currentVlan;
  if (currentVlanId && newVlans[currentVlanId]) {
    newVlans[currentVlanId] = { ...newVlans[currentVlanId], name: `VLAN${currentVlanId}` };
    return { success: true, newState: { vlans: newVlans } };
  }

  return { success: false, error: '% VLAN not found' };
}

/**
 * VLAN State
 */
function cmdVlanState(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'vlan' || state.currentVlan == null) {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^state\s+(active|suspend)$/i);
  if (!match) {
    return { success: false, error: '% Invalid VLAN state command' };
  }

  const vlanId = String(state.currentVlan);
  const vlan = state.vlans?.[vlanId];
  if (!vlan) {
    return { success: false, error: '% VLAN not found' };
  }

  const shouldBumpVtp = (state.vtpMode === 'server') && !!state.vtpDomain;
  const nextVtpRevision = shouldBumpVtp ? ((state.vtpRevision || 0) + 1) : state.vtpRevision;

  return {
    success: true,
    newState: {
      vlans: {
        ...state.vlans,
        [vlanId]: {
          ...vlan,
          status: match[1].toLowerCase() as 'active' | 'suspend'
        }
      },
      vtpRevision: nextVtpRevision,
    }
  };
}

/**
 * VTP Mode
 */
function cmdVtpMode(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  // valid VTP modes: server, client, transparent (NOT 'off')
  const match = input.match(/^vtp\s+mode\s+(server|client|transparent)$/i);
  if (!match) {
    return { success: false, error: "% Invalid input detected at '^' marker." };
  }

  return {
    success: true,
    newState: { vtpMode: match[1].toLowerCase() as 'server' | 'client' | 'transparent' }
  };
}

/**
 * VTP Domain
 */
function cmdVtpDomain(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^vtp\s+domain\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid VTP domain command' };
  }

  return {
    success: true,
    newState: { vtpDomain: match[1] }
  };
}

/**
 * Spanning-Tree Mode
 */
function cmdSpanningTreeMode(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^spanning-tree\s+mode\s+(pvst|rapid-pvst|mst)$/i);
  if (!match) {
    return { success: false, error: IOS_ERRORS.invalidInput };
  }

  return {
    success: true,
    newState: { spanningTreeMode: match[1].toLowerCase() as 'pvst' | 'rapid-pvst' | 'mst' }
  };
}

/**
 * IP Default-Gateway
 */
function cmdIpDefaultGateway(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^ip\s+default-gateway\s+([0-9.]+)$/i);
  if (!match) {
    return { success: false, error: "% Invalid input detected at '^' marker." };
  }

  return {
    success: true,
    newState: { defaultGateway: match[1] }
  };
}

/**
 * No IP Default-Gateway
 */
function cmdNoIpDefaultGateway(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: { defaultGateway: undefined }
  };
}

/**
 * IP Domain-Name
 */
function cmdIpDomainName(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^ip\s+domain-name\s+(.+)$/i);
  if (!match) {
    return { success: false, error: "% Invalid input detected at '^' marker." };
  }

  return {
    success: true,
    newState: { domainName: match[1] }
  };
}

/**
 * CDP Run
 */
function cmdCdpRun(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: { cdpEnabled: true }
  };
}

/**
 * No CDP Run
 */
function cmdNoCdpRun(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: { cdpEnabled: false }
  };
}

/**
 * LLDP Run
 */
function cmdLldpRun(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: { lldpEnabled: true }
  };
}

/**
 * No LLDP Run
 */
function cmdNoLldpRun(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: { lldpEnabled: false }
  };
}

/**
 * Router RIP - Enable RIP routing
 */
function cmdRouterRip(state: SwitchState, _input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  // Check if device supports routing (routers and L3 switches only)
  const deviceType: string | undefined = state.deviceType;
  if (deviceType !== 'router' && !canAssignIPToPhysicalPort(state.switchModel)) {
    const deviceLabel = (deviceType as string | undefined) === 'router' ? 'router' : (isLayer3Switch(state.switchModel) ? 'Layer 3 switch' : 'Layer 2 switch');
    return {
      success: false,
      error: `% Invalid command. ${deviceLabel} (${state.switchModel}) does not support routing protocols.\nRouting protocols are only supported on Layer 3 switches.`
    };
  }

  const lang = ctx.language || 'en';
  return {
    success: true,
    output: lang === 'tr' ?
      'RIP Routing Protocol etkinleştirildi' :
      'RIP Routing Protocol enabled',
    newState: {
      routingProtocol: 'rip',
      ipRouting: true,
      currentMode: 'router-config',
      dynamicRoutes: state.routingProtocol !== 'rip' ? [] : state.dynamicRoutes
    }
  };
}

/**
 * Router OSPF - Enable OSPF routing
 */
function cmdRouterOspf(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  // Check if device supports routing (routers and L3 switches only)
  const deviceType2: string | undefined = state.deviceType;
  if (deviceType2 !== 'router' && !canAssignIPToPhysicalPort(state.switchModel)) {
    const deviceLabel = (deviceType2 as string | undefined) === 'router' ? 'router' : (isLayer3Switch(state.switchModel) ? 'Layer 3 switch' : 'Layer 2 switch');
    return {
      success: false,
      error: `% Invalid command. ${deviceLabel} (${state.switchModel}) does not support routing protocols.\nRouting protocols are only supported on Layer 3 switches.`
    };
  }

  // Parse OSPF process ID (optional)
  const match = input.match(/^router\s+ospf\s*(\d*)$/i);
  const processId = match?.[1] || '1';

  return {
    success: true,
    output: `OSPF Routing Process enabled with Process ID ${processId}`,
    newState: {
      routingProtocol: 'ospf',
      ipRouting: true,
      ospfProcessId: processId,
      currentMode: 'router-config',
      dynamicRoutes: state.routingProtocol !== 'ospf' ? [] : state.dynamicRoutes
    }
  };
}

/**
 * No Router RIP - Disable RIP routing
 */
function cmdNoRouterRip(state: SwitchState, _input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const lang = ctx.language || 'en';
  return {
    success: true,
    output: lang === 'tr' ?
      'RIP Routing Protocol devre dışı bırakıldı' :
      'RIP Routing Protocol disabled',
    newState: {
      routingProtocol: 'none',
      dynamicRoutes: []
    }
  };
}

/**
 * No Router OSPF - Disable OSPF routing
 */
function cmdNoRouterOspf(state: SwitchState, _input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const lang = ctx.language || 'en';
  return {
    success: true,
    output: lang === 'tr' ?
      'OSPF Routing Protocol devre dışı bırakıldı' :
      'OSPF Routing Protocol disabled',
    newState: {
      routingProtocol: 'none',
      dynamicRoutes: []
    }
  };
}

/**
 * IP HTTP Server - Enable HTTP server
 */
function cmdIpHttpServer(state: SwitchState, _input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const lang = ctx.language || 'en';
  const services = state.services || {};
  return {
    success: true,
    output: lang === 'tr' ?
      'HTTP sunucusu etkinleştirildi' :
      'HTTP server enabled',
    newState: {
      services: {
        ...services,
        http: {
          enabled: true,
          content: '',
          fontSize: 14
        }
      }
    }
  };
}




// ── End of Handlers ──────────────────────────────────────────────────────────

function cmdCdpTimer(_state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/^cdp\s+timer\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid CDP timer value' };
  const value = Number(match[1]);
  if (value < 5 || value > 65535) return { success: false, error: '% CDP timer must be between 5 and 65535 seconds' };
  return { success: true, output: `CDP timer set to ${value} seconds`, newState: { cdpTimer: value } };
}

function cmdCdpHoldtime(_state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/^cdp\s+holdtime\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid CDP holdtime value' };
  const value = Number(match[1]);
  if (value < 10 || value > 65535) return { success: false, error: '% CDP holdtime must be between 10 and 65535 seconds' };
  return { success: true, output: `CDP holdtime set to ${value} seconds`, newState: { cdpHoldtime: value } };
}

function cmdLldpTimer(_state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/^lldp\s+timer\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid LLDP timer value' };
  const value = Number(match[1]);
  if (value < 5 || value > 65535) return { success: false, error: '% LLDP timer must be between 5 and 65535 seconds' };
  return { success: true, output: `LLDP timer set to ${value} seconds`, newState: { lldpTimer: value } };
}

function cmdLldpHoldtime(_state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/^lldp\s+holdtime\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid LLDP holdtime value' };
  const value = Number(match[1]);
  if (value < 10 || value > 65535) return { success: false, error: '% LLDP holdtime must be between 10 and 65535 seconds' };
  return { success: true, output: `LLDP holdtime set to ${value} seconds`, newState: { lldpHoldtime: value } };
}

function cmdLldpReinit(_state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/^lldp\s+reinit\s+(\d+)$/i);
  if (!match) return { success: false, error: '% Invalid LLDP reinit value' };
  const value = Number(match[1]);
  if (value < 2 || value > 5) return { success: false, error: '% LLDP reinit must be between 2 and 5 seconds' };
  return { success: true, output: `LLDP reinit set to ${value} seconds`, newState: { lldpReinit: value } };
}

function cmdSnmpCommunity(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/^snmp-server\s+community\s+(\S+)(?:\s+(RO|RW))?$/i);
  if (!match) return { success: false, error: '% Invalid SNMP community command' };
  return { success: true, output: `SNMP community ${match[1]} configured`, newState: { snmpCommunities: { ...state.snmpCommunities, [match[1]]: (match[2] || 'RO').toUpperCase() as 'RO' | 'RW' } } };
}

function cmdSnmpContact(_state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/^snmp-server\s+contact\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid SNMP contact command' };
  return { success: true, output: 'SNMP contact configured', newState: { snmpContact: match[1].trim() } };
}

function cmdSnmpLocation(_state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/^snmp-server\s+location\s+(.+)$/i);
  if (!match) return { success: false, error: '% Invalid SNMP location command' };
  return { success: true, output: 'SNMP location configured', newState: { snmpLocation: match[1].trim() } };
}

function cmdDefaultInterface(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/^default\s+interface\s+(\S+)$/i);
  if (!match) return { success: false, error: '% Invalid interface name' };
  const interfaceName = match[1];
  const port = state.ports?.[interfaceName];
  if (!port) return { success: false, error: `% Interface ${interfaceName} not found` };
  const defaultPort = { ...port };
  for (const key of ['description', 'ipAddress', 'ipv6Address', 'nativeVlan', 'allowedVlans', 'qos', 'bandwidth', 'delay', 'stpPriority', 'dhcpSnoopingTrust', 'dhcpSnoopingLimitRate', 'arpInspectionTrust', 'carrierDelay', 'loadInterval', 'directedBroadcast', 'powerInline', 'channelGroup', 'encapsulation', 'clockRate', 'pppAuthentication', 'pppUsername', 'helperAddress', 'proxyArp', 'ipVerifySource']) {
    delete (defaultPort as Record<string, unknown>)[key];
  }
  return { success: true, output: `Interface ${interfaceName} reset to default configuration`, newState: { ports: { ...state.ports, [interfaceName]: defaultPort } } };
}



