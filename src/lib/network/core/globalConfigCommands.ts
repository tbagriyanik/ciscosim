'use client';

import type { CommandHandler } from './commandTypes';
import { canAssignIPToPhysicalPort } from '../switchModels';

// Global config (hostname, vlan, vtp, spanning-tree, security, ip domain-name, etc.)

export const globalConfigHandlers: Record<string, CommandHandler> = {
  'hostname': cmdHostname,
  'vlan': cmdVlan,
  'no vlan': cmdNoVlan,
  'name': cmdVlanName,
  'state': cmdVlanState,
  'vtp mode': cmdVtpMode,
  'vtp domain': cmdVtpDomain,
  'spanning-tree mode': cmdSpanningTreeMode,
  'no spanning-tree': cmdNoSpanningTree,
  'service password-encryption': cmdServicePasswordEncryption,
  'no service password-encryption': cmdNoServicePasswordEncryption,
  'enable secret': cmdEnableSecret,
  'no enable secret': cmdNoEnableSecret,
  'enable password': cmdEnablePassword,
  'no enable password': cmdNoEnablePassword,
  'banner motd': cmdBannerMotd,
  'no banner motd': cmdNoBannerMotd,
  'ip default-gateway': cmdIpDefaultGateway,
  'no ip default-gateway': cmdNoIpDefaultGateway,
  'ip domain-name': cmdIpDomainName,
  'no ip domain lookup': cmdNoIpDomainLookup,
  'ip routing': cmdIpRouting,
  'no ip routing': cmdNoIpRouting,
  'ip ssh time-out': cmdIpSshTimeOut,
  'no ip ssh time-out': cmdNoIpSshTimeOut,
  'ip dhcp snooping': cmdIpDhcpSnooping,
  'no ip dhcp snooping': cmdNoIpDhcpSnooping,
  'mls qos': cmdMlsQos,
  'no mls qos': cmdNoMlsQos,
  'cdp run': cmdCdpRun,
  'no cdp run': cmdNoCdpRun,
  'username': cmdUsername,
  'no username': cmdNoUsername,
  'interface': cmdInterface,
  'no interface': cmdNoInterface,
  // Routing protocols
  'router rip': cmdRouterRip,
  'router ospf': cmdRouterOspf,
  'no router rip': cmdNoRouterRip,
  'no router ospf': cmdNoRouterOspf,
  // HTTP Server
  'ip http server': cmdIpHttpServer,
  'no ip http server': cmdNoIpHttpServer,
};

/**
 * Hostname - Set device hostname
 */
function cmdHostname(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^hostname\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid hostname command' };
  }

  return {
    success: true,
    newState: { hostname: match[1] }
  };
}

/**
 * IP Routing - Enable IP routing
 */
function cmdIpRouting(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { ipRouting: true }
  };
}

/**
 * IP SSH Time-Out
 */
function cmdIpSshTimeOut(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^ip\s+ssh\s+time-out\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid SSH time-out command' };
  }

  return {
    success: true,
    newState: { sshTimeOut: parseInt(match[1]) }
  };
}

/**
 * IP DHCP Snooping - Enable DHCP snooping
 */
function cmdIpDhcpSnooping(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { dhcpSnoopingEnabled: true }
  };
}

/**
 * MLS QoS - Enable MLS QoS
 */
function cmdMlsQos(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { mlsQosEnabled: true }
  };
}

/**
 * Username - Create username
 */
function cmdUsername(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^username\s+(\S+)(\s+(privilege\s+(\d+)|password|secret)\s+(.+))?$/i);
  if (!match) {
    return { success: false, error: '% Invalid username command' };
  }

  const username = match[1];
  const privilege = match[4] ? parseInt(match[4]) : 0;
  const password = match[5] || '';
  const passwordType = input.toLowerCase().includes('secret') ? 'secret' : 'password';

  const newUsers = { ...state.users };
  newUsers[username] = {
    username,
    privilege,
    password,
    passwordType
  };

  return {
    success: true,
    newState: { users: newUsers }
  };
}

/**
 * Interface - Enter interface configuration
 */
function cmdInterface(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^interface\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid interface command' };
  }

  const iface = match[1].toLowerCase();

  if (iface.startsWith('vlan')) {
    const vlanMatch = iface.match(/vlan\s+(\d+)/i);
    if (!vlanMatch) {
      return { success: false, error: '% Invalid VLAN interface' };
    }
    const vlanId = vlanMatch[1];
    const newVlans = { ...state.vlans };
    if (!newVlans[vlanId]) {
      newVlans[vlanId] = {
        id: parseInt(vlanId),
        name: `VLAN${vlanId}`,
        status: 'active',
        ports: []
      };
    }
    return {
      success: true,
      newState: {
        vlans: newVlans,
        currentMode: 'interface',
        currentInterface: `Vlan${vlanId}`
      }
    };
  }

  return {
    success: true,
    newState: {
      currentMode: 'interface',
      currentInterface: match[1]
    }
  };
}

/**
 * VLAN - Create/enter VLAN configuration
 */
function cmdVlan(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^vlan\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid VLAN ID' };
  }

  const vlanId = match[1];
  const newVlans = { ...state.vlans };

  if (!newVlans[vlanId]) {
    newVlans[vlanId] = {
      id: parseInt(vlanId, 10),
      name: `VLAN${vlanId}`,
      status: 'active',
      ports: []
    };
  }

  return {
    success: true,
    newState: {
      vlans: newVlans,
      currentMode: 'vlan',
      currentVlan: vlanId
    }
  };
}

/**
 * No VLAN - Delete VLAN
 */
function cmdNoVlan(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^no\s+vlan\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid VLAN ID' };
  }

  const vlanId = match[1];
  const newVlans = { ...state.vlans };

  if (!newVlans[vlanId]) {
    return { success: false, error: `% VLAN ${vlanId} does not exist` };
  }

  delete newVlans[vlanId];

  return {
    success: true,
    newState: {
      vlans: newVlans
    }
  };
}

/**
 * VLAN Name
 */
function cmdVlanName(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'vlan' || state.currentVlan == null) {
    return { success: false, error: '% Invalid command at this mode' };
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

  return {
    success: true,
    newState: {
      vlans: {
        ...state.vlans,
        [vlanId]: {
          ...vlan,
          name: match[1]
        }
      }
    }
  };
}

/**
 * VLAN State
 */
function cmdVlanState(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'vlan' || state.currentVlan == null) {
    return { success: false, error: '% Invalid command at this mode' };
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

  return {
    success: true,
    newState: {
      vlans: {
        ...state.vlans,
        [vlanId]: {
          ...vlan,
          status: match[1].toLowerCase()
        }
      }
    }
  };
}

/**
 * VTP Mode
 */
function cmdVtpMode(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^vtp\s+mode\s+(server|client|transparent)$/i);
  if (!match) {
    return { success: false, error: '% Invalid VTP mode' };
  }

  return {
    success: true,
    newState: { vtpMode: match[1].toLowerCase() }
  };
}

/**
 * VTP Domain
 */
function cmdVtpDomain(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
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
function cmdSpanningTreeMode(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^spanning-tree\s+mode\s+(pvst|rapid-pvst|mst)$/i);
  if (!match) {
    return { success: false, error: '% Invalid spanning-tree mode' };
  }

  return {
    success: true,
    newState: {
      spanningTree: {
        ...state.spanningTree,
        mode: match[1].toLowerCase()
      }
    }
  };
}

/**
 * Service Password-Encryption
 */
function cmdServicePasswordEncryption(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        servicePasswordEncryption: true
      }
    }
  };
}

/**
 * No Service Password-Encryption
 */
function cmdNoServicePasswordEncryption(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        servicePasswordEncryption: false
      }
    }
  };
}

/**
 * Enable Secret
 */
function cmdEnableSecret(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^enable\s+secret\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid enable secret command' };
  }

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        enableSecret: match[1]
      }
    }
  };
}

/**
 * Enable Password
 */
function cmdEnablePassword(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^enable\s+password\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid enable password command' };
  }

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        enablePassword: match[1]
      }
    }
  };
}

/**
 * No Enable Secret
 */
function cmdNoEnableSecret(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        enableSecret: ''
      }
    }
  };
}

/**
 * No Enable Password
 */
function cmdNoEnablePassword(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        enablePassword: ''
      }
    }
  };
}

/**
 * Banner MOTD
 */
function cmdBannerMotd(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^banner\s+motd\s+(.)([\s\S]*?)\1\s*$/i);
  if (!match) {
    return { success: false, error: '% Invalid banner command. Use: banner motd #message#' };
  }

  return {
    success: true,
    newState: { bannerMOTD: match[2] }
  };
}

/**
 * IP Default-Gateway
 */
function cmdIpDefaultGateway(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^ip\s+default-gateway\s+([0-9.]+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid default-gateway command' };
  }

  return {
    success: true,
    newState: { defaultGateway: match[1] }
  };
}

/**
 * No IP Default-Gateway
 */
function cmdNoIpDefaultGateway(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { defaultGateway: undefined }
  };
}

/**
 * IP Domain-Name
 */
function cmdIpDomainName(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^ip\s+domain-name\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid domain-name command' };
  }

  return {
    success: true,
    newState: { domainName: match[1] }
  };
}

/**
 * CDP Run
 */
function cmdCdpRun(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { cdpEnabled: true }
  };
}

/**
 * No CDP Run
 */
function cmdNoCdpRun(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { cdpEnabled: false }
  };
}

/**
 * Router RIP - Enable RIP routing
 */
function cmdRouterRip(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  // Check if device supports routing (L3 switch only)
  if (!canAssignIPToPhysicalPort(state.switchModel)) {
    return {
      success: false,
      error: `% Invalid command. Layer 2 switch (${state.switchModel}) does not support routing protocols.\nRouting protocols are only supported on Layer 3 switches.`
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
      currentMode: 'router-config'
    }
  };
}

/**
 * Router OSPF - Enable OSPF routing
 */
function cmdRouterOspf(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  // Check if device supports routing (L3 switch only)
  if (!canAssignIPToPhysicalPort(state.switchModel)) {
    return {
      success: false,
      error: `% Invalid command. Layer 2 switch (${state.switchModel}) does not support routing protocols.\nRouting protocols are only supported on Layer 3 switches.`
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
      currentMode: 'router-config'
    }
  };
}

/**
 * No Router RIP - Disable RIP routing
 */
function cmdNoRouterRip(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
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
function cmdNoRouterOspf(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
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
function cmdIpHttpServer(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
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
          content: ''
        }
      }
    }
  };
}

/**
 * No IP HTTP Server - Disable HTTP server
 */
function cmdNoIpHttpServer(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const lang = ctx.language || 'en';
  const services = state.services || {};
  return {
    success: true,
    output: lang === 'tr' ?
      'HTTP sunucusu devre dışı bırakıldı' :
      'HTTP server disabled',
    newState: {
      services: {
        ...services,
        http: {
          enabled: false,
          content: ''
        }
      }
    }
  };
}

/**
 * No Banner MOTD - Clear banner
 */
function cmdNoBannerMotd(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { bannerMOTD: '' }
  };
}

/**
 * No IP Domain Lookup - Disable domain lookup
 */
function cmdNoIpDomainLookup(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { domainLookup: false }
  };
}

/**
 * No IP Routing - Disable IP routing
 */
function cmdNoIpRouting(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { ipRouting: false }
  };
}

/**
 * No IP SSH Time-Out
 */
function cmdNoIpSshTimeOut(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { sshTimeOut: undefined }
  };
}

/**
 * No Spanning-Tree - Disable spanning-tree globally
 */
function cmdNoSpanningTree(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { spanningTreeEnabled: false }
  };
}

/**
 * No MLS QoS - Disable MLS QoS
 */
function cmdNoMlsQos(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { mlsQosEnabled: false }
  };
}

/**
 * No IP DHCP Snooping - Disable DHCP snooping
 */
function cmdNoIpDhcpSnooping(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: { dhcpSnoopingEnabled: false }
  };
}

/**
 * No Username - Remove username
 */
function cmdNoUsername(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^no\s+username\s+(\S+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid username command' };
  }

  const username = match[1];
  const newUsers = { ...state.users };
  delete newUsers[username];

  return {
    success: true,
    newState: { users: newUsers }
  };
}

/**
 * No Interface - Delete interface config (for VLAN interfaces)
 */
function cmdNoInterface(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^no\s+interface\s+vlan\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid interface command' };
  }

  const vlanId = match[1];
  const newVlans = { ...state.vlans };
  
  if (!newVlans[vlanId]) {
    return { success: false, error: `% VLAN ${vlanId} does not exist` };
  }

  // Remove the VLAN interface (keep VLAN but remove IP)
  newVlans[vlanId] = {
    ...newVlans[vlanId],
    ipAddress: undefined,
    subnetMask: undefined
  };

  return {
    success: true,
    newState: { vlans: newVlans }
  };
}
