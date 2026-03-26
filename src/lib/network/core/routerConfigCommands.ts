'use client';

import type { CommandHandler } from './commandTypes';

// Router config commands (router ospf, router rip, etc.)

export const routerConfigHandlers: Record<string, CommandHandler> = {
    'network': cmdRouterNetwork,
    'router-id': cmdRouterId,
    'passive-interface': cmdPassiveInterface,
    'default-information': cmdDefaultInformation,
};

// Router subcommands in OSPF/RIP config mode

/**
 * network - Add network to routing process
 */
function cmdRouterNetwork(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'router-config') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^network\s+([0-9.]+)\s+([0-9.]+)\s+area\s+(\d+)$/i);
    if (!match) {
        // Try without area (RIP)
        const ripMatch = input.match(/^network\s+([0-9.]+)$/i);
        if (!ripMatch) {
            return { success: false, error: '% Invalid network command. Use: network [ip-address] [wildcard-mask] area [area-id]' };
        }

        // RIP network
        return {
            success: true,
            output: `${ripMatch[1]} added to RIP routing`,
            newState: {
                dynamicRoutes: [
                    ...(state.dynamicRoutes || []),
                    { network: ripMatch[1], mask: '255.255.255.0', nextHop: 'directly connected', metric: 1, protocol: 'RIP' }
                ]
            }
        };
    }

    // OSPF network
    const [_, network, wildcard, area] = match;
    return {
        success: true,
        output: `${network}/${wildcard} added to OSPF area ${area}`,
        newState: {
            dynamicRoutes: [
                ...(state.dynamicRoutes || []),
                { network, mask: wildcard, area: parseInt(area), protocol: 'OSPF' }
            ]
        }
    };
}

/**
 * router-id - Set router ID
 */
function cmdRouterId(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'router-config') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^router-id\s+([0-9.]+)$/i);
    if (!match) {
        return { success: false, error: '% Invalid router-id command' };
    }

    return {
        success: true,
        output: `Router ID set to ${match[1]}`,
        newState: { routerId: match[1] }
    };
}

/**
 * passive-interface - Disable sending updates on interface
 */
function cmdPassiveInterface(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'router-config') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^passive-interface\s+(\S+)$/i);
    if (!match) {
        return { success: false, error: '% Invalid passive-interface command' };
    }

    return {
        success: true,
        output: `Interface ${match[1]} set as passive`,
        newState: {
            passiveInterfaces: [...(state.passiveInterfaces || []), match[1]]
        }
    };
}

/**
 * default-information - Control distribution of default route
 */
function cmdDefaultInformation(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'router-config') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^default-information\s+(originate|always)$/i);
    if (!match) {
        return { success: false, error: '% Invalid default-information command' };
    }

    return {
        success: true,
        output: `Default information ${match[1]} configured`,
        newState: {
            defaultInformation: match[1]
        }
    };
}