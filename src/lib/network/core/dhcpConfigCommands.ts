'use client';

import type { CommandHandler } from './commandTypes';

// ── DHCP Pool sub-command handlers ──────────────────────────────────────────

function cmdDhcpNetwork(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'dhcp-config') {
        return { success: false, error: '% Invalid command at this mode' };
    }
    const match = input.match(/^network\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)$/i);
    if (!match) {
        return { success: false, error: '% Invalid network command' };
    }
    const poolName = state.currentDhcpPool;
    if (!poolName) return { success: false, error: '% No active DHCP pool' };

    const pools = { ...(state.dhcpPools || {}) };
    pools[poolName] = { ...(pools[poolName] || {}), network: match[1], subnetMask: match[2] };
    return { success: true, newState: { dhcpPools: pools } };
}

function cmdDhcpDefaultRouter(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'dhcp-config') {
        return { success: false, error: '% Invalid command at this mode' };
    }
    const match = input.match(/^default-router\s+(.+)$/i);
    if (!match) return { success: false, error: '% Invalid default-router command' };

    const poolName = state.currentDhcpPool;
    if (!poolName) return { success: false, error: '% No active DHCP pool' };

    const primaryGw = match[1].trim().split(/\s+/)[0];
    const pools = { ...(state.dhcpPools || {}) };
    pools[poolName] = { ...(pools[poolName] || {}), defaultRouter: primaryGw };
    return { success: true, newState: { dhcpPools: pools } };
}

function cmdDhcpDnsServer(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'dhcp-config') {
        return { success: false, error: '% Invalid command at this mode' };
    }
    const match = input.match(/^dns-server\s+(.+)$/i);
    if (!match) return { success: false, error: '% Invalid dns-server command' };

    const poolName = state.currentDhcpPool;
    if (!poolName) return { success: false, error: '% No active DHCP pool' };

    const primaryDns = match[1].trim().split(/\s+/)[0];
    const pools = { ...(state.dhcpPools || {}) };
    pools[poolName] = { ...(pools[poolName] || {}), dnsServer: primaryDns };
    return { success: true, newState: { dhcpPools: pools } };
}

function cmdDhcpLease(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'dhcp-config') {
        return { success: false, error: '% Invalid command at this mode' };
    }
    const match = input.match(/^lease\s+(.+)$/i);
    if (!match) return { success: false, error: '% Invalid lease command' };

    const poolName = state.currentDhcpPool;
    if (!poolName) return { success: false, error: '% No active DHCP pool' };

    const pools = { ...(state.dhcpPools || {}) };
    pools[poolName] = { ...(pools[poolName] || {}), leaseTime: match[1].trim() };
    return { success: true, newState: { dhcpPools: pools } };
}

function cmdDhcpDomainName(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'dhcp-config') {
        return { success: false, error: '% Invalid command at this mode' };
    }
    const match = input.match(/^domain-name\s+(\S+)$/i);
    if (!match) return { success: false, error: '% Invalid domain-name command' };

    const poolName = state.currentDhcpPool;
    if (!poolName) return { success: false, error: '% No active DHCP pool' };

    const pools = { ...(state.dhcpPools || {}) };
    pools[poolName] = { ...(pools[poolName] || {}), domainName: match[1] };
    return { success: true, newState: { dhcpPools: pools } };
}

export const dhcpConfigHandlers: Record<string, CommandHandler> = {
    'network': cmdDhcpNetwork,
    'default-router': cmdDhcpDefaultRouter,
    'dns-server': cmdDhcpDnsServer,
    'lease': cmdDhcpLease,
    'domain-name': cmdDhcpDomainName,
};
