import type { CommandHandler } from './commandTypes';
import { checkConnectivity } from '../connectivity';

// Privileged EXEC komutları (ping, telnet, write, copy, erase, reload, debug, vs.)

export const privilegedHandlers: Record<string, CommandHandler> = {
    'ping': cmdPing,
    'telnet': cmdTelnet,
    'write memory': cmdWriteMemory,
    'copy running-config startup-config': cmdCopyRunningStartup,
    'erase startup-config': cmdEraseStartupConfig,
    'erase nvram': cmdEraseNvram,
    'reload': cmdReload,
    'ip route': cmdIpRoute,
    'no ip route': cmdNoIpRoute,
    'debug': cmdDebug,
    'undebug all': cmdUndebugAll,
    'do write': cmdDoWrite,
    'do ping': cmdDoPing,
};

/**
 * Ping - Test connectivity
 */
function cmdPing(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^ping\s+([0-9.]+|[\w.-]+)(?:\s+(\d+))?(?:\s+(\d+))?$/i);
    if (!match) {
        return { success: false, error: '% Invalid ping command. Use: ping <host> [size] [count]' };
    }

    const host = match[1];
    const size = match[2] || '56';
    const count = match[3] || '5';
    if (ctx?.sourceDeviceId && Array.isArray(ctx.devices)) {
        const connectivity = checkConnectivity(
            ctx.sourceDeviceId,
            host,
            ctx.devices,
            ctx.connections || [],
            ctx.deviceStates,
            ctx.language
        );

        if (connectivity.success) {
            let output = `\nType escape sequence to abort.\n`;
            output += `Sending ${count}, ${size}-byte ICMP Echos to ${host}, timeout is 2 seconds:\n`;
            const successCount = parseInt(count);
            for (let i = 0; i < successCount; i++) output += '!';
            output += '\n\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/8 ms\n';
            return { success: true, output, triggerPingAnimation: connectivity.targetId };
        } else {
            return {
                success: false,
                output: `\nType escape sequence to abort.\nSending ${count}, ${size}-byte ICMP Echos to ${host}, timeout is 2 seconds:\n.....\n`,
                error: connectivity.error || `Destination host unreachable.`,
            };
        }
    }

    return { success: false, error: '% Ping requires network context' };
}

/**
 * Telnet - Connect to remote device
 */
function cmdTelnet(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^telnet\s+([0-9.]+|[\w.-]+)(?:\s+(\d+))?$/i);
    if (!match) {
        return { success: false, error: '% Invalid telnet command' };
    }

    const host = match[1];
    const port = match[2] || '23';

    return {
        success: true,
        output: `Trying ${host} ${port} ...\nOpen\n\nUser Access Verification\n\nPassword: `,
        requiresTelnetPassword: true,
        telnetTarget: { host, port }
    };
}

/**
 * Write Memory - Save configuration
 */
function cmdWriteMemory(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    return {
        success: true,
        output: 'Building configuration...\n[OK]\n',
        saveConfig: true
    };
}

/**
 * Copy Running-Config Startup-Config
 */
function cmdCopyRunningStartup(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    return {
        success: true,
        output: 'Destination filename [startup-config]?\nBuilding configuration...\n[OK]\n',
        saveConfig: true
    };
}

/**
 * Erase Startup-Config
 */
function cmdEraseStartupConfig(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    return {
        success: true,
        output: 'Erasing the nvram filesystem will remove startup configuration files.\nErase of nvram: complete\n',
        requiresConfirmation: true,
        confirmationMessage: 'Erase startup configuration? This cannot be undone.',
        confirmationAction: 'erase',
        eraseConfig: true
    };
}

/**
 * Erase NVRAM
 */
function cmdEraseNvram(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    return {
        success: true,
        output: 'Erasing the nvram filesystem will remove all configuration files.\nErase of nvram: complete\n',
        requiresConfirmation: true,
        confirmationMessage: 'Erase nvram? This will remove all configuration files.',
        confirmationAction: 'erase',
        eraseConfig: true
    };
}

/**
 * Reload - Reboot device
 */
function cmdReload(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }
    // Immediately perform reload without confirmation
    return {
        success: true,
        output: 'Reloading...\n',
        reloadDevice: true,
        requiresReloadConfirm: false
    };
}

/**
 * IP Route - Add static route
 */
function cmdIpRoute(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^ip\s+route\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+|\w+)$/i);
    if (!match) {
        return { success: false, error: '% Invalid ip route command. Use: ip route <network> <mask> <next-hop|interface>' };
    }

    const [, network, mask, nextHop] = match;

    const newStaticRoutes = [...(state.staticRoutes || [])];
    newStaticRoutes.push({ network, mask, nextHop });

    return {
        success: true,
        newState: {
            staticRoutes: newStaticRoutes,
            ipRouting: true,
            isLayer3Switch: true
        }
    };
}

/**
 * No IP Route - Remove static route
 */
function cmdNoIpRoute(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^no\s+ip\s+route\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+|\w+)$/i);
    if (!match) {
        return { success: false, error: '% Invalid no ip route command' };
    }

    const [, network, mask, nextHop] = match;

    const newStaticRoutes = (state.staticRoutes || []).filter(
        (route: any) => !(route.network === network && route.mask === mask && route.nextHop === nextHop)
    );

    return {
        success: true,
        newState: { staticRoutes: newStaticRoutes }
    };
}

/**
 * Debug - Enable debugging
 */
function cmdDebug(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^debug\s+(.+)$/i);
    if (!match) {
        return { success: false, error: '% Invalid debug command' };
    }

    const debugType = match[1].toLowerCase();
    const newDebugs = { ...(state.debugs || {}) };
    newDebugs[debugType] = true;

    return {
        success: true,
        output: `${debugType} debugging is on`,
        newState: { debugs: newDebugs }
    };
}

/**
 * Undebug All
 */
function cmdUndebugAll(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    return {
        success: true,
        output: 'All possible debugging has been turned off',
        newState: { debugs: {} }
    };
}


/**
 * Do Write - Execute write command from config mode
 */
function cmdDoWrite(state: any, input: string, ctx: any): any {
    // Extract the write command from "do write ..."
    const match = input.match(/^do\s+(wr[ite]*(?:\s+me[mory]*)?)$/i);
    if (!match) {
        return { success: false, error: '% Invalid command' };
    }

    // Execute write memory
    return cmdWriteMemory(state, 'write memory', ctx);
}

/**
 * Do Ping - Execute ping command from config mode
 */
function cmdDoPing(state: any, input: string, ctx: any): any {
    // Extract the ping command from "do ping ..."
    const match = input.match(/^do\s+(ping\s+.+)$/i);
    if (!match) {
        return { success: false, error: '% Invalid command' };
    }

    const pingCommand = match[1];

    // Execute ping
    return cmdPing(state, pingCommand, ctx);
}
