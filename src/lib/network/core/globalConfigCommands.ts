'use client';

import type { CommandHandler } from './commandTypes';

// Global config (hostname, vlan, vtp, spanning-tree, security, ip domain-name, etc.)

export const globalConfigHandlers: Record<string, CommandHandler> = {
  'hostname': cmdHostname,
  'vlan': cmdVlan,
  'name': cmdVlanName,
  'state': cmdVlanState,
  'vtp mode': cmdVtpMode,
  'vtp domain': cmdVtpDomain,
  'spanning-tree mode': cmdSpanningTreeMode,
  'service password-encryption': cmdServicePasswordEncryption,
  'enable secret': cmdEnableSecret,
  'enable password': cmdEnablePassword,
  'banner motd': cmdBannerMotd,
  'ip default-gateway': cmdIpDefaultGateway,
  'ip domain-name': cmdIpDomainName,
  'cdp run': cmdCdpRun,
  'no cdp run': cmdNoCdpRun,
  // Routing protocols
  'router rip': cmdRouterRip,
  'router ospf': cmdRouterOspf,
  'no router rip': cmdNoRouterRip,
  'no router ospf': cmdNoRouterOspf,
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
        passwordEncryption: true
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
 * Banner MOTD
 */
function cmdBannerMotd(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^banner\s+motd\s+(.)(.*)\1$/i);
  if (!match) {
    return { success: false, error: '% Invalid banner command. Use: banner motd #message#' };
  }

  return {
    success: true,
    newState: { banner: match[2] }
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
