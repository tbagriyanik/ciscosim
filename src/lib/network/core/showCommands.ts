import { IOS_ERRORS } from './iosErrors';
import type { CommandHandler, CommandContext } from './commandTypes';
import { buildRunningConfig } from './configBuilder';
import { SwitchState, CommandResult } from '../types';
import { getSwitchDisplayProfile } from './showHelpers';
import { formatIpSlaStatistics } from '../ipSla';
import {
  cmdShowWireless, cmdShowWlanSummary,
  cmdShowApSummary, cmdShowApConfig, cmdShowApJoinStats,
  cmdShowDot11Associations, cmdShowDot11Statistics, cmdShowWlan,
} from './showWlcDisplay';
import {
  cmdShowVersion, cmdShowClock, cmdShowFlash, cmdShowBoot,
  cmdShowStartupConfig, cmdShowRunningConfig as cmdShowRunningConfigSystem
} from './showSystemDisplay';
import {
  cmdShowInterfaces, cmdShowInterface, cmdShowInterfaceTrunk,
  cmdShowIpInterfaceBrief, cmdShowInterfacesStatus,
  cmdShowIpInterface, cmdShowIpv6InterfaceBrief,
  cmdShowNameif, cmdShowControllers, cmdShowIpAccessGroup,
} from './showInterfaceDisplay';
import {
  cmdShowVlan, cmdShowMacAddressTable,
  cmdShowSpanningTree, cmdShowSpanningTreeInterface,
  cmdShowEtherchannel, cmdShowArp, cmdShowPortSecurity,
  cmdShowVtpStatus, cmdShowVtpPassword, cmdShowMacStatic,
  cmdShowCdpNeighbors, cmdShowCdp, cmdShowLldp,
} from './showSwitchingDisplay';
import {
  cmdShowIpRoute, cmdShowIpv6Route, cmdShowIpOspf,
  cmdShowIpOspfNeighbor, cmdShowIpOspfDatabase,
  cmdShowIpOspfInterface, cmdShowIpProtocols,
  cmdShowStandby, cmdShowHosts,
  cmdShowIpNatTranslations, cmdShowIpNatStatistics,
  cmdShowIpDhcpPool, cmdShowIpDhcpBinding,
  cmdShowIpv6DhcpPool, cmdShowIpDhcpSnooping,
  cmdShowIpSourceBinding, cmdShowIpVerifySource,
  cmdShowIpArpInspection,
  cmdShowIpEigrpNeighbors, cmdShowIpEigrpInterfaces, cmdShowIpBgpSummary,
  cmdShowIpBgp, cmdShowIpBgpNeighbors, cmdShowIpv6Rip, cmdShowIpv6Ospf,
  cmdShowVrrp, cmdShowVrrpBrief, cmdShowIpv6AccessList,
  cmdShowPrefixList, cmdShowRouteMap, cmdShowIpv6EigrpNeighbors, cmdShowIpv6EigrpTopology, cmdShowIpv6EigrpInterfaces,
  cmdShowGlbp, cmdShowIpFlowExport, cmdShowIpCacheFlow, cmdShowIpv6Neighbors,
  cmdShowIpv6DhcpBinding, cmdShowPppoeSession, cmdShowCaller,
  cmdShowTrack, cmdShowIpSlaSummary, cmdShowIpSlaConfiguration
} from './showRoutingDisplay';





import {
  cmdShowCryptoIsakmpSa, cmdShowCryptoIpsecSa, cmdShowCryptoMap
} from './cryptoCommands';


// Show komutları (show running-config, show vlan, show ip route, vs.)


export const showHandlers: Record<string, CommandHandler> = {
  'show running-config': cmdShowRunningConfig,
  'show running-config interface': cmdShowRunningConfigInterface,
  'show startup-config': cmdShowStartupConfig,
  'show version': cmdShowVersion,
  'show logging': cmdShowLogging,
  'show interfaces': cmdShowInterfaces,
  'show interface': cmdShowInterface,
  'show interface trunk': cmdShowInterfaceTrunk,
  'show interfaces trunk': cmdShowInterfaceTrunk,
  'show ip interface brief': cmdShowIpInterfaceBrief,
  'show vlan brief': cmdShowVlan,
  'show vlan': cmdShowVlan,
  'show mac address-table': cmdShowMacAddressTable,
  'show cdp neighbors': cmdShowCdpNeighbors,
  'show ip route': cmdShowIpRoute,
  'show clock': cmdShowClock,
  'show flash': cmdShowFlash,
  'show boot': cmdShowBoot,
  'show spanning-tree': cmdShowSpanningTree,
  'show spanning-tree interface': cmdShowSpanningTreeInterface,
  'show port-security': cmdShowPortSecurity,
  'show wireless': cmdShowWireless,
  'show wlan summary': cmdShowWlanSummary,
  'show ap summary': cmdShowApSummary,
  'show ap config': cmdShowApConfig,
  'show ap join statistics': cmdShowApJoinStats,
  'show ap join stats': cmdShowApJoinStats,
  'show ssh': cmdShowSsh,
  'show ip ssh': cmdShowSsh,
  'do show': cmdDoShow,
  'show ip dhcp snooping': cmdShowIpDhcpSnooping,
  'show interfaces status': cmdShowInterfacesStatus,
  'show cdp': cmdShowCdp,
  'show lldp': cmdShowLldp,
  'show lldp neighbors': cmdShowLldp,
  'show vtp status': cmdShowVtpStatus,
  'show etherchannel': cmdShowEtherchannel,
  'show arp': cmdShowArp,
  'show ip arp': cmdShowArp,
  'show mls qos': cmdShowMlsQos,
  'show policy-map': cmdShowPolicyMap,
  'show policy-map interface': cmdShowPolicyMapInterface,
  'show qos interface': cmdShowQosInterface,
  'show queuing interface': cmdShowQueuingInterface,
  'show ip arp inspection': cmdShowIpArpInspection,
  'show access-lists': cmdShowAccessLists,
  'show history': cmdShowHistory,
  'show users': cmdShowUsers,
  'show environment': cmdShowEnvironment,
  'show inventory': cmdShowInventory,
  'show errdisable recovery': cmdShowErrdisableRecovery,
  'show errdisable detect': cmdShowErrdisableRecovery,
  'show storm-control': cmdShowStormControl,
  'show udld': cmdShowUdld,
  'show monitor': cmdShowMonitor,
  'show debugging': cmdShowDebug,
  'show processes': cmdShowProcesses,
  'show memory': cmdShowMemory,
  'show sdm prefer': cmdShowSdmPrefer,
  'show system mtu': cmdShowSystemMtu,
  'show ip dhcp pool': cmdShowIpDhcpPool,
  'show ip dhcp binding': cmdShowIpDhcpBinding,
  'show ip source binding': cmdShowIpSourceBinding,
  'show crypto isakmp sa': cmdShowCryptoIsakmpSa,
  'show crypto ipsec sa': cmdShowCryptoIpsecSa,
  'show crypto map': cmdShowCryptoMap,

  'show ip verify source': cmdShowIpVerifySource,
  'show': cmdShowParent,
  'show ip interface': cmdShowIpInterface,
  'show ipv6 route': cmdShowIpv6Route,
  'show ipv6 neighbors': cmdShowIpv6Neighbors,
  'show ipv6 interface brief': cmdShowIpv6InterfaceBrief,
  'show ipv6 dhcp pool': cmdShowIpv6DhcpPool,
  'show ipv6 dhcp binding': cmdShowIpv6DhcpBinding,
  'show pppoe session': cmdShowPppoeSession,
  'show pppoe summary': cmdShowPppoeSession,
  'show caller': cmdShowCaller,
  'show caller ip': cmdShowCaller,

  'show mac address-table static': cmdShowMacStatic,
  'show authentication': cmdShowAuth,
  'show sessions': cmdShowSessions,
  'show ntp associations': cmdShowNtp,
  'show ntp status': cmdShowNtp,
  'show ntp': cmdShowNtp,
  'show snmp': cmdShowSnmp,
  'show class-map': cmdShowClassMap,
  'show mac access-lists': cmdShowMacAcl,
  'show controllers': cmdShowControllers,
  'show diagnostic': cmdShowDiag,
  'show privilege': cmdShowPrivilege,
  'show banner motd': cmdShowBannerMotd,
  'show alias': cmdShowAlias,
  'show redundancy': cmdShowRedundancy,
  'show archive': cmdShowArchive,
  'show ip protocols': cmdShowIpProtocols,
  'show ip ospf neighbor': cmdShowIpOspfNeighbor,
  'show ip ospf database': cmdShowIpOspfDatabase,
  'show ip ospf': cmdShowIpOspf,
  'show ip ospf interface': cmdShowIpOspfInterface,
  'show standby': cmdShowStandby,
  'show hosts': cmdShowHosts,
  'show ip nat translations': cmdShowIpNatTranslations,
  'show ip nat statistics': cmdShowIpNatStatistics,
  'show ip sla statistics': cmdShowIpSlaStatistics,
  'show ip sla summary': cmdShowIpSlaSummary,
  'show ip sla configuration': cmdShowIpSlaConfiguration,
  'show ip sla application': cmdShowIpSlaConfiguration,
  'show track': cmdShowTrack,


  // New: missing show commands
  'show nameif': cmdShowNameif,
  'show ip access-group': cmdShowIpAccessGroup,
  'show dot11 associations': cmdShowDot11Associations,
  'show dot11 statistics': cmdShowDot11Statistics,
  'show wlan': cmdShowWlan,
  'show vtp password': cmdShowVtpPassword,
  'show ip eigrp': cmdShowIpEigrpNeighbors,
  'show ip eigrp neighbors': cmdShowIpEigrpNeighbors,
  'show ip eigrp interfaces': cmdShowIpEigrpInterfaces,
  'show ip bgp summary': cmdShowIpBgpSummary,
  'show ip bgp': cmdShowIpBgp,
  'show ip bgp neighbors': cmdShowIpBgpNeighbors,
  'show ipv6 rip': cmdShowIpv6Rip,
  'show ipv6 ospf': cmdShowIpv6Ospf,
  'show vrrp': cmdShowVrrp,
  'show vrrp brief': cmdShowVrrpBrief,
  'show ipv6 access-list': cmdShowIpv6AccessList,
  'show ipv6 access-lists': cmdShowIpv6AccessList,
  'show ip prefix-list': cmdShowPrefixList,
  'show ipv6 prefix-list': cmdShowPrefixList,
  'show route-map': cmdShowRouteMap,
  'show ipv6 eigrp neighbors': cmdShowIpv6EigrpNeighbors,
  'show ipv6 eigrp topology': cmdShowIpv6EigrpTopology,
  'show ipv6 eigrp interfaces': cmdShowIpv6EigrpInterfaces,

  'show glbp': cmdShowGlbp,
  'show glbp brief': cmdShowGlbp,
  'show ip flow export': cmdShowIpFlowExport,
  'show ip cache flow': cmdShowIpCacheFlow,
};

function cmdShowIpSlaStatistics(state: SwitchState): CommandResult {
  return { success: true, output: formatIpSlaStatistics(state.ipSlaOperations) };
}

/**
 * Show Running Configuration
 */
function cmdShowRunningConfig(
  state: SwitchState,
  input: string,
  ctx: CommandContext
): CommandResult {
  return cmdShowRunningConfigSystem(state, input, ctx, buildRunningConfig, cmdShowRunningConfigInterface);
}

/**
 * Show Running Configuration Interface
 */
function cmdShowRunningConfigInterface(
  state: SwitchState,
  input: string,
  _ctx: CommandContext
): CommandResult {
  const match = input.match(/show\s+(?:running-config|run|running)\s+interface\s+(\S+)/i);
  const interfaceName = match?.[1];

  if (!interfaceName) {
    return { success: false, error: '% Incomplete command.' };
  }

  const normalized = interfaceName.toLowerCase();
  const port = state.ports?.[normalized];

  if (!port) {
    return { success: false, error: `% Interface ${interfaceName} not found` };
  }

  const lines = buildRunningConfig(state);
  const interfaceLines: string[] = [];
  let inInterface = false;

  for (const line of lines) {
    if (line.toLowerCase().startsWith('interface ') && line.toLowerCase().includes(normalized)) {
      inInterface = true;
      interfaceLines.push(line);
    } else if (inInterface) {
      if (line === '!') {
        inInterface = false;
        interfaceLines.push(line);
        break;
      }
      interfaceLines.push(line);
    }
  }

  if (interfaceLines.length === 0) {
    return { success: true, output: '\n% Interface configuration not found\n' };
  }

  return { success: true, output: '\nBuilding configuration...\n\n' + interfaceLines.join('\n') + '\n' };
}

/**
 * Show History
 */

















/**
 * Do Show - Execute show command from config mode
 */




/**
 * Do Show - Execute show command from config mode
 */
function cmdDoShow(
  state: SwitchState,
  input: string,
  ctx: CommandContext
): CommandResult {
  const match = input.match(/^do\s+(sh(?:ow)?\s+.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid command' };
  }

  let showCommand = match[1];
  if (showCommand.startsWith('sh ')) {
    showCommand = 'show ' + showCommand.substring(3);
  }

  const lowered = showCommand.toLowerCase();
  const showKey = Object.keys(showHandlers)
    .filter(key => lowered === key || lowered.startsWith(`${key} `))
    .sort((a, b) => b.length - a.length)[0];
  if (showKey && showHandlers[showKey]) {
    return showHandlers[showKey](state, showCommand, ctx);
  }

  return { success: false, error: "% Invalid input detected at '^' marker." };
}

/**
 * Show Wireless - Display WiFi settings
 */
/**
 * Show SSH - Display SSH server configuration and session summary
 */
function cmdShowSsh(
  state: SwitchState,
  _input: string,
  _ctx: CommandContext
): CommandResult {
  const version = state.sshVersion || 2;
  const transportInput = state.security?.vtyLines?.transportInput || [];
  const sshEnabled = version > 0 && (transportInput.includes('ssh') || transportInput.includes('all'));
  const timeout = state.sshTimeout || 60;
  const retries = state.sshAuthenticationRetries || 3;
  const domainName = state.domainName || 'not set';

  let output = '\nSSH Server Status\n';
  output += '-----------------\n';
  output += `SSH Version: ${version}\n`;
  output += `SSH Status: ${sshEnabled ? 'enabled' : 'disabled'}\n`;
  output += `Authentication Retries: ${retries}\n`;
  output += `Timeout: ${timeout} seconds\n`;
  output += `Domain Name: ${domainName}\n`;
  output += `VTY Transport Input: ${transportInput.length > 0 ? transportInput.join(' ') : 'none'}\n`;

  const activeSessions = Array.isArray(state.sshSessions) ? state.sshSessions : [];
  const normalizedSessions = activeSessions;

  output += `\nActive SSH Sessions: ${normalizedSessions.length}\n`;
  if (normalizedSessions.length > 0) {
    output += 'Session   User       Source\n';
    output += '--------  ---------  ----------------\n';
    normalizedSessions.forEach((session: { user?: string; source?: string }, index: number) => {
      output += `${String(index + 1).padEnd(8)}  ${(session.user || 'unknown').padEnd(9)}  ${session.source || 'unknown'}\n`;
    });
  }

  output += '!\n';
  return { success: true, output };
}







/**
 * Show MLS QoS
 */
function cmdShowMlsQos(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const enabled = state.mlsQosEnabled ?? false;
  return { success: true, output: `\nQoS is ${enabled ? 'enabled' : 'disabled'}\n` };
}


/**
 * Show Access-Lists
 */
function cmdShowAccessLists(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const hasClassicAcls = !!state.accessLists && Object.keys(state.accessLists).length > 0;
  const firewallRules = Array.isArray(state.firewallRules) ? state.firewallRules : [];
  const hasFirewallAcls = firewallRules.length > 0;

  // Filter by ACL name if specified
  const filterAcl = input.match(/^show\s+access-lists?\s+(\S+)$/i)?.[1];

  if (!hasClassicAcls && !hasFirewallAcls) {
    return { success: true, output: '\n% No access lists configured\n' };
  }

  let output = '\n';

  if (hasClassicAcls) {
    Object.entries(state.accessLists || {}).forEach(([aclId, rules]: [string, string[]]) => {
      if (filterAcl && aclId !== filterAcl) return;

      const isNamed = isNaN(Number(aclId));
      const aclType = isNamed ? (state.namedAclTypes?.[aclId] || 'standard') : (parseInt(aclId) >= 100 ? 'extended' : 'standard');
      output += `${aclType === 'extended' ? 'Extended' : 'Standard'} IP access list ${aclId}\n`;
      rules.forEach((rule: string, ruleIndex: number) => {
        // Parse rule format: "seq permit|deny <conditions>"
        const seqMatch = rule.match(/^(\d+)\s+(.+)$/);
        let seq: string;
        let ruleText: string;
        if (seqMatch) {
          seq = seqMatch[1];
          ruleText = seqMatch[2];
        } else {
          seq = String((ruleIndex + 1) * 10);
          ruleText = rule;
        }
        const matches = state.aclMatchCounters?.[aclId]?.[ruleIndex] || 0;
        output += `    ${seq.padEnd(5)} ${ruleText} (${matches} ${matches === 1 ? 'match' : 'matches'})\n`;
      });
    });
  }

  if (hasFirewallAcls) {
    if (!filterAcl || filterAcl === 'OUTSIDE-IN') {
      output += 'access-list OUTSIDE-IN\n';
      firewallRules.forEach((rule: { enabled?: boolean; protocol?: string; action: string; sourceIp: string; targetIp: string; port: string | number }, index: number) => {
        const inactive = rule.enabled === false ? 'inactive ' : '';
        const protocol = rule.protocol === 'any' ? 'ip' : (rule.protocol || 'ip');
        output += `    line ${index + 1} extended ${inactive}${rule.action} ${protocol} ${rule.sourceIp} ${rule.targetIp} eq ${rule.port}\n`;
      });
    }
  }

  return { success: true, output };
}

/**
 * Show History
 */
function cmdShowHistory(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const history = state.commandHistory || [];
  let output = '\n';
  history.slice(-20).forEach((cmd: string) => { output += `  ${cmd}\n`; });
  return { success: true, output };
}

/**
 * Show Users
 */
function cmdShowUsers(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\n    Line       User       Host(s)              Idle       Location\n';
  output += '*   0 con 0                idle                 00:00:00\n';
  return { success: true, output };
}

/**
 * Show Environment
 */
function cmdShowEnvironment(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\nSystem Temperature Value: 36 Degree Celsius\nSystem Temperature State: GREEN\nYellow Threshold : 46 Degree Celsius\nRed Threshold    : 56 Degree Celsius\n' };
}

/**
 * Show Inventory
 */
function cmdShowInventory(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const profile = getSwitchDisplayProfile(state);
  return { success: true, output: `\nNAME: "1", DESCR: "${profile.switchModel}"\nPID: ${profile.switchModel}  , VID: V01, SN: ${state.version?.serialNumber || 'FOC0000X000'}\n` };
}

/**
 * Show Errdisable Recovery
 */
function cmdShowErrdisableRecovery(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\nErrDisable Reason            Timer Status\n-----------------            --------------\nbpduguard                    Disabled\npsecure-violation            Disabled\nport-security                Disabled\n\nTimer interval: 300 seconds\n' };
}

/**
 * Show Storm-Control
 */
function cmdShowStormControl(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/show\s+storm-control\s+(?:interface\s+)?(\S+)?/i);
  const interfaceName = match?.[1];

  if (interfaceName) {
    const port = (state.ports || {})[interfaceName.toLowerCase()];
    if (!port) {
      return { success: false, error: `% Interface ${interfaceName} not found` };
    }

    let output = `\nStorm Control for interface ${interfaceName}\n`;
    const sc = port.stormControl;

    if (!sc || (!sc.broadcast?.enabled && !sc.multicast?.enabled && !sc.unicast?.enabled)) {
      output += '  Storm control is not enabled on this interface\n';
    } else {
      if (sc.broadcast?.enabled) {
        output += `  Broadcast:\n`;
        output += `    Status: enabled\n`;
        output += `    Threshold: ${sc.broadcast.threshold || 'unlimited'}\n`;
        output += `    Action: ${sc.broadcast.action || 'shutdown'}\n`;
      }
      if (sc.multicast?.enabled) {
        output += `  Multicast:\n`;
        output += `    Status: enabled\n`;
        output += `    Threshold: ${sc.multicast.threshold || 'unlimited'}\n`;
        output += `    Action: ${sc.multicast.action || 'shutdown'}\n`;
      }
      if (sc.unicast?.enabled) {
        output += `  Unicast:\n`;
        output += `    Status: enabled\n`;
        output += `    Threshold: ${sc.unicast.threshold || 'unlimited'}\n`;
        output += `    Action: ${sc.unicast.action || 'shutdown'}\n`;
      }
    }
    output += '!\n';
    return { success: true, output };
  }

  // Global storm control list
  let output = '\nInterface   Broadcast      Multicast       Unicast\n';
  output += '---------   ----------     ----------     ----------\n';
  Object.keys(state.ports || {}).forEach(portName => {
    const port = (state.ports || {})[portName];
    const sc = port.stormControl;
    const bc = sc?.broadcast?.enabled ? 'enabled' : 'disabled';
    const mc = sc?.multicast?.enabled ? 'enabled' : 'disabled';
    const uc = sc?.unicast?.enabled ? 'enabled' : 'disabled';
    output += `${portName.padEnd(10)}${bc.padEnd(16)}${mc.padEnd(16)}${uc}\n`;
  });
  output += '!\n';
  return { success: true, output };
}

/**
 * Show UDLD
 */
function cmdShowUdld(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/show\s+udld\s+(?:interface\s+)?(\S+)?/i);
  const interfaceName = match?.[1];

  let output = '\nGlobal UDLD information\n';
  output += '  Message interval: 15 seconds\n';
  output += '  Time out interval: 5 seconds\n';
  output += '  Mode: normal\n\n';

  if (interfaceName) {
    const port = (state.ports || {})[interfaceName.toLowerCase()];
    if (!port) {
      return { success: false, error: `% Interface ${interfaceName} not found` };
    }

    output += `UDLD Status for interface ${interfaceName}\n`;
    const udld = port.udld;
    output += `  Admin: ${udld?.enabled ? 'enabled' : 'disabled'}\n`;
    output += `  Mode: ${udld?.mode || 'normal'}\n`;
    output += `  Bidirectional Status: ${udld?.bidirectionalStatus || 'unknown'}\n`;
    output += `  Last Probe Time: ${udld?.lastProbeTime ? new Date(udld.lastProbeTime).toLocaleString() : 'never'}\n`;
  } else {
    output += 'Interface        Admin  State\n';
    output += '--------         -----  -----\n';
    Object.keys(state.ports || {}).forEach(portName => {
      const port = (state.ports || {})[portName];
      if (port && port.udld) {
        const admin = port.udld.enabled ? 'enable' : 'disable';
        const state = port.udld.bidirectionalStatus || 'unknown';
        output += `${portName.padEnd(16)}${admin.padEnd(7)}${state}\n`;
      }
    });
  }

  output += '!\n';
  return { success: true, output };
}

/**
 * Show Monitor (SPAN)
 */
function cmdShowMonitor(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\n% No SPAN sessions configured\n' };
}

/**
 * Show Debug
 */
function cmdShowDebug(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\nAll possible debugging has been turned off\n' };
}

/**
 * Show Processes
 */
function cmdShowProcesses(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\nCPU utilization for five seconds: 1%/0%; one minute: 1%; five minutes: 1%\n' };
}

/**
 * Show Memory
 */
function cmdShowMemory(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\n                Head    Total(b)     Used(b)     Free(b)   Lowest(b)  Largest(b)\nProcessor  65536000    65536000     8192000    57344000    57344000    57344000\n' };
}

/**
 * Show SDM Prefer
 */
function cmdShowSdmPrefer(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const template = state.sdmTemplate || 'default';
  let output = `\nThe current template is "${template}" template.\n`;
  if (template === 'lanbase-routing' || template === 'routing') {
    output += ` The selected template optimizes the resources in\n the switch to support this level of features for\n 16384 IPv4 ACL entries, 2048 QoS labels, 16384 IPv4 Multicast entries.\n`;
  } else if (template === 'lanbase') {
    output += ` The selected template optimizes the resources in\n the switch to support this level of features for\n 8192 IPv4 ACL entries, 2048 QoS labels, 2048 IPv4 Multicast entries.\n`;
  } else if (template === 'desktop') {
    output += ` The selected template optimizes the resources in\n the switch to support this level of features for\n 4096 IPv4 ACL entries, 512 QoS labels, 256 IPv4 Multicast entries.\n`;
  } else {
    output += ` The selected template optimizes the resources in\n the switch to support this level of features for\n 8 routed interfaces and 1024 VLANs.\n`;
  }
  return { success: true, output };
}

/**
 * Show System MTU
 */
function cmdShowSystemMtu(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\nSystem MTU size is 1500 bytes\nSystem Jumbo MTU size is 1500 bytes\nRouting MTU size is 1500 bytes\n' };
}




/**
 * Show parent command (incomplete)
 */
function cmdShowParent(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: false, error: IOS_ERRORS.incomplete };
}






/**
 * Show Auth
 */
function cmdShowAuth(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\nNo active authentication sessions.\n' };
}

/**
 * Show Sessions
 */
function cmdShowSessions(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\n% No active sessions.\n' };
}

/**
 * Show NTP
 */
export function cmdShowNtp(state: SwitchState, input: string, ctx: CommandContext): CommandResult {
  const servers = state.ntpServers || [];
  const masterStratum = state.ntpMasterStratum;
  if (servers.length === 0 && !masterStratum) {
    return { success: true, output: '\n% NTP is not enabled.\n' };
  }

  const isStatus = /status/i.test(input);
  const isAssociations = /associations/i.test(input);

  const referenceIp = servers[0];
  const matchedDevice = ctx.devices?.find((d) => d.ip === referenceIp);
  const isSync = matchedDevice !== undefined || servers.length > 0;

  if (isAssociations) {
    let output = '\n  address         ref clock       st   when   poll reach  delay  offset   disp\n';
    output += '*~' + referenceIp.padEnd(16) + '127.127.1.1     1     14     64  377     1.24   0.045   0.12\n';
    for (let i = 1; i < servers.length; i++) {
      const s = servers[i];
      output += ' +' + s.padEnd(16) + '127.127.1.1     2     28     64  377     2.10   0.112   0.24\n';
    }
    output += ' * master (synced), # master (unsynced), + selected, - candidate, ~ configured\n';
    return { success: true, output };
  }

  if (isStatus || input.trim() === 'show ntp') {
    if (masterStratum) {
      let output = '\nClock is synchronized, NTP master (stratum ' + masterStratum + ')\n';
      output += 'nominal freq is 250.0000 Hz, actual freq is 249.9998 Hz, precision is 2**18\n';
      output += 'reference time is LOCAL(0)\n';
      output += 'clock offset is 0.0000 msec, root delay is 0.00 msec\n';
      output += 'root dispersion is 0.00 msec, peer dispersion is 0.00 msec\n';
      output += 'loopfilter state is \'FREQ\' (Normal), drift is 0.00000000 s/s\n';
      output += 'system poll interval is 64 s\n';
      output += '\n  NTP servers configured as master (stratum ' + masterStratum + ')\n';
      return { success: true, output };
    }
    let output = '\nClock is synchronized, stratum 2, reference is ' + referenceIp + '\n';
    output += 'nominal freq is 250.0000 Hz, actual freq is 249.9998 Hz, precision is 2**18\n';
    output += 'reference time is E8D1A543.64D29810 (20:12:00.393 UTC Wed Sep 2 2026)\n';
    output += 'clock offset is 0.0450 msec, root delay is 1.24 msec\n';
    output += 'root dispersion is 11.23 msec, peer dispersion is 1.20 msec\n';
    output += 'loopfilter state is \'SPIK\' (Normal), drift is 0.00000123 s/s\n';
    output += 'system poll interval is 64 s, last update was 14 sec ago.\n';
    return { success: true, output };
  }

  let output = '\nClock is synchronized, stratum 2, reference is ' + referenceIp + '\n';
  output += ' actual frequency: 250.0000 Hz, precision: 2**18\n';
  output += ' reference time: ' + referenceIp + '\n';
  output += ' clock offset: 0.0450 msec, root delay: 1.24 msec\n';
  output += ' root dispersion: 11.23 msec, peer dispersion: 1.20 msec\n';
  output += ' loopfilter state: \'CTRL\' (Normal), drift: 0.00000000 s/s\n';
  output += ' system poll interval: 64 s, last update: 14 sec ago\n';
  output += `\n  NTP servers configured:\n\n`;

  for (const ip of servers) {
    const isReachable = ctx.devices?.find((d) => d.ip === ip) !== undefined || isSync;
    output += `  ${ip} ${isReachable ? '... reachable, syncing' : '... unreachable'}\n`;
  }

  output += '\n';
  return { success: true, output };
}

/**
 * Show SNMP
 */
function cmdShowSnmp(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const chassis = state.version?.serialNumber || 'XXXXXXXXXXXX';
  const contact = state.snmpContact || 'unconfigured';
  const location = state.snmpLocation || 'unconfigured';
  const communities = Object.entries(state.snmpCommunities || {});

  let output = `Chassis: ${chassis}\n`;
  output += `Contact: ${contact}\n`;
  output += `Location: ${location}\n`;
  output += `0 SNMP packets input\n`;
  output += `    0 Bad SNMP version errors\n`;
  output += `    0 Unknown community name\n`;
  output += `    0 Illegal operation for community name supplied\n`;
  output += `    0 Encoding errors\n`;
  output += `    0 Number of requested variables\n`;
  output += `    0 Number of altered variables\n`;
  output += `    0 Get-request PDUs\n`;
  output += `    0 Get-next PDUs\n`;
  output += `    0 Set-request PDUs\n`;
  output += `0 SNMP packets output\n`;
  output += `    0 Too big errors (Maximum packet size 1500)\n`;
  output += `    0 No such name errors\n`;
  output += `    0 Bad values errors\n`;
  output += `    0 General errors\n`;
  output += `    0 Response PDUs\n`;
  output += `    0 Trap PDUs\n`;
  output += `SNMP logging: ${state.loggingEnabled ? 'enabled' : 'disabled'}\n`;

  if (communities.length > 0) {
    output += `SNMP communities:\n`;
    communities.forEach(([name, mode]) => {
      output += `    ${name} ${mode}\n`;
    });
  } else {
    output += `SNMP communities:\n    <none configured>\n`;
  }

  return { success: true, output };
}

/**
 * Show Policy Map
 */
function cmdShowPolicyMap(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const maps = state.qosPolicyMaps;
  if (!maps || Object.keys(maps).length === 0) return { success: true, output: '\n% No policy maps configured.\n' };
  let output = '';
  Object.entries(maps).forEach(([name, policy]) => {
    output += `Policy-map ${name}\n`;
    Object.entries(policy.classes || {}).forEach(([className, cls]) => {
      output += `  Class ${className}\n`;
      if (cls.setDscp) output += `    set dscp ${cls.setDscp}\n`;
      if (cls.setCos !== undefined) output += `    set cos ${cls.setCos}\n`;
      if (cls.policeRate !== undefined) output += `    police rate ${cls.policeRate}\n`;
      if (cls.bandwidthPercent !== undefined) output += `    bandwidth ${cls.bandwidthPercent}%\n`;
      if (cls.priority) output += '    priority\n';
    });
  });
  return { success: true, output };
}

/**
 * Show Class Map
 */
function cmdShowClassMap(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const maps = state.qosClassMaps;
  if (!maps || Object.keys(maps).length === 0) return { success: true, output: '\n% No class maps configured.\n' };
  let output = '';
  Object.entries(maps).forEach(([name, cm]) => {
    output += `Class-map: ${name} (match-${cm.match})\n`;
  });
  return { success: true, output };
}

/**
 * Show MAC ACL
 */
function cmdShowMacAcl(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\n% No MAC access lists configured.\n' };
}


/**
 * Show Diagnostic
 */
function cmdShowDiag(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\nDiagnostic results: PASS\n' };
}

/**
 * Show Privilege
 */
function cmdShowPrivilege(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const level = state.currentMode === 'privileged' ? 15 : 1;
  return { success: true, output: `\nCurrent privilege level is ${level}\n` };
}


/**
 * Show Banner MOTD
 */
function cmdShowBannerMotd(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: state.bannerMOTD ? `\n${state.bannerMOTD}\n` : '\n% Banner not set\n' };
}

/**
 * Show Alias
 */
function cmdShowAlias(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  let output = '\nExec aliases:\n';
  const builtIn: Record<string, string> = { 'h': 'show history', 'lo': 'exit' };
  const allAliases = { ...builtIn, ...state.execAliases };
  if (Object.keys(allAliases).length === 0) {
    output += '  (none)\n';
  } else {
    for (const [name, cmd] of Object.entries(allAliases)) {
      output += `  ${name.padEnd(20)} ${cmd}\n`;
    }
  }
  return { success: true, output };
}

/**
 * Show Redundancy
 */
function cmdShowRedundancy(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\nRedundancy mode: NON-REDUNDANT\n' };
}

/**
 * Show Archive
 */
function cmdShowArchive(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\nArchive configuration is not enabled.\n' };
}


/**
 * Show Policy Map Interface
 */
function cmdShowPolicyMapInterface(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/show\s+policy-map\s+interface\s+(\S+)?/i);
  const interfaceName = match?.[1];

  let output = '';

  if (interfaceName) {
    const port = (state.ports || {})[interfaceName.toLowerCase()];
    if (!port) {
      return { success: false, error: `% Interface ${interfaceName} not found` };
    }

    if (!port.qos?.policyMap) {
      output += `\nInterface ${interfaceName}\n`;
      output += `  Service Policy output: not configured\n`;
      output += `  Service Policy input: not configured\n`;
    } else {
      output += `\nInterface ${interfaceName}\n`;
      output += `  Service Policy output: ${port.qos.policyMap}\n`;
      if (port.qos.enabled) {
        output += `    Class ${port.qos.policyMap}\n`;
        output += `      Output Queue: ${port.qos.egressQueue || 40}\n`;
        if (port.qos.shaping?.enabled) {
          output += `      Shaping rate: ${port.qos.shaping.rate} bps\n`;
        }
        if (port.qos.policing?.enabled) {
          output += `      Police rate: ${port.qos.policing.rate} bps\n`;
        }
      }
    }
  } else {
    output += '\nPolicy Map output\n';
    output += '  No configured policy maps\n';
  }

  output += '!\n';
  return { success: true, output };
}

/**
 * Show QoS Interface
 */
function cmdShowQosInterface(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/show\s+qos\s+interface\s+(\S+)?/i);
  const interfaceName = match?.[1];

  let output = '';

  if (interfaceName) {
    const port = (state.ports || {})[interfaceName.toLowerCase()];
    if (!port) {
      return { success: false, error: `% Interface ${interfaceName} not found` };
    }

    output += `\nInterface ${interfaceName}\n`;
    output += `QoS is ${port.qos?.enabled ? 'enabled' : 'disabled'}\n`;

    if (port.qos?.enabled) {
      output += `  Queue Strategy: FIFO\n`;
      output += `  Egress Queue Depth: ${port.qos.egressQueue || 40}\n`;
      output += `  Ingress Queue Depth: ${port.qos.ingressQueue || 75}\n`;

      if (port.qos.shaping?.enabled) {
        output += `  Traffic Shaping:\n`;
        output += `    Rate: ${port.qos.shaping.rate} bits/sec\n`;
      }

      if (port.qos.policing?.enabled) {
        output += `  Traffic Policing:\n`;
        output += `    Rate: ${port.qos.policing.rate} bits/sec\n`;
        output += `    Burst: ${port.qos.policing.burst} bytes\n`;
      }

      if (port.qos.priorityQueue?.enabled) {
        output += `  Priority Queue: enabled\n`;
        output += `    Limit: ${port.qos.priorityQueue.limit || 'unlimited'}\n`;
      }
    }
  } else {
    output += '\nInterface         QoS Status\n';
    output += '----------        ----------\n';
    Object.keys(state.ports || {}).forEach(portName => {
      const port = (state.ports || {})[portName];
      output += `${portName.padEnd(18)}${port.qos?.enabled ? 'enabled' : 'disabled'}\n`;
    });
  }

  output += '!\n';
  return { success: true, output };
}

/**
 * Show Queueing Interface
 */
function cmdShowQueuingInterface(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const match = input.match(/show\s+queuing\s+interface\s+(\S+)?/i);
  const interfaceName = match?.[1];

  let output = '';

  if (interfaceName) {
    const port = (state.ports || {})[interfaceName.toLowerCase()];
    if (!port) {
      return { success: false, error: `% Interface ${interfaceName} not found` };
    }

    output += `\nInterface ${interfaceName}\n`;
    output += `  Queueing Strategy: FIFO\n`;
    output += `  Output Queue: ${port.qos?.egressQueue || 40} (max threshold)\n`;
    output += `  Input Queue: ${port.qos?.ingressQueue || 75} (max threshold)\n`;

    const stats = port.statistics || {};
    output += `\nQueue Statistics:\n`;
    output += `  Enqueued: ${stats.outputPackets || 0} packets\n`;
    output += `  Dropped: ${stats.drops || 0} packets\n`;
    output += `  Overruns: ${stats.overruns || 0}\n`;

    if (port.qos?.priorityQueue?.enabled) {
      output += `\nPriority Queue:\n`;
      output += `  Status: enabled\n`;
      output += `  Limit: ${port.qos.priorityQueue.limit || 'unlimited'}\n`;
    }
  } else {
    output += '\nInterface         Queue Strategy  Threshold\n';
    output += '----------        --------------  ---------\n';
    Object.keys(state.ports || {}).forEach(portName => {
      const port = (state.ports || {})[portName];
      const threshold = port.qos?.egressQueue || 40;
      output += `${portName.padEnd(18)}FIFO             ${threshold}\n`;
    });
  }

  output += '!\n';
  return { success: true, output };
}



export function cmdShowLogging(state: SwitchState): CommandResult {
  const loggingStatus = state.loggingEnabled !== false ? 'enabled' : 'disabled';
  const trapLevel = state.syslogTrapLevel || 'informational';
  const host = state.syslogHost ? `Logging to ${state.syslogHost}` : 'Logging to console/buffer';

  const output = `Syslog logging: ${loggingStatus}
Console logging: level debugging, 0 messages logged
Buffer logging: level debugging, 0 messages logged
Trap logging: level ${trapLevel}, 0 message lines logged
${host}
`;
  return { success: true, output };
}







