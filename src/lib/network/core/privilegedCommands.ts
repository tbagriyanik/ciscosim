import type { CommandHandler } from './commandTypes';
import { checkConnectivity, getWirelessSignalStrength } from '../connectivity';
import type { CanvasDevice } from '@/components/network/networkTopology.types';

// Privileged EXEC komutları (ping, telnet, write, copy, erase, reload, debug, vs.)

export const privilegedHandlers: Record<string, CommandHandler> = {
    'ping': cmdPing,
    'telnet': cmdTelnet,
    'ssh': cmdSsh,
    'traceroute': cmdTraceroute,
    'tracert': cmdTracert,
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
 * Estimate ping latencies based on signal strength (0-5) and add randomness.
 */
function generatePingLatencies(signalStrength: number): { min: number; avg: number; max: number } {
    const between = (min: number, max: number) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    if (signalStrength >= 5) {
        // 100% - Excellent
        const min = between(1, 3);
        const avg = between(min + 1, min + 3);
        const max = between(avg + 1, avg + 3);
        return { min, avg, max };
    }

    if (signalStrength === 4) {
        // 75% - Good
        const min = between(5, 10);
        const avg = between(min + 2, min + 8);
        const max = between(avg + 2, avg + 6);
        return { min, avg, max };
    }

    if (signalStrength === 3) {
        // 50% - Fair
        const min = between(15, 25);
        const avg = between(min + 5, min + 15);
        const max = between(avg + 5, avg + 15);
        return { min, avg, max };
    }

    if (signalStrength === 2) {
        // 25% - Weak
        const min = between(40, 60);
        const avg = between(min + 10, min + 40);
        const max = between(avg + 10, avg + 40);
        return { min, avg, max };
    }

    if (signalStrength === 1) {
        // 1% - Very Weak
        const min = between(100, 150);
        const avg = between(min + 20, min + 50);
        const max = between(avg + 20, avg + 50);
        return { min, avg, max };
    }

    // strength 0 - No signal (should not reach here)
    return { min: 1, avg: 2, max: 5 };
}

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
            const successCount = parseInt(count, 10) || 5;
            const devices = (ctx.devices || []) as CanvasDevice[];
            const sourceDevice = ctx.sourceDeviceId ? devices.find(d => d.id === ctx.sourceDeviceId) : undefined;
            const signalStrength = getWirelessSignalStrength(sourceDevice, devices, ctx.deviceStates);
            const { min, avg, max } = generatePingLatencies(signalStrength);
            for (let i = 0; i < successCount; i++) output += '!';
            output += `\n\nSuccess rate is 100 percent (${successCount}/${successCount}), round-trip min/avg/max = ${min}/${avg}/${max} ms\n`;
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
 * SSH - Connect to remote device via SSH
 */
function cmdSsh(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^ssh\s+(-l\s+\S+\s+)?([0-9.]+|[\w.-]+)$/i);
    if (!match) {
        return { success: false, error: '% Invalid ssh command. Use: ssh [-l username] host' };
    }

    const username = match[1] ? match[1].replace(/^-l\s+/, '') : undefined;
    const host = match[2];

    // Resolve hostname to show IP address
    let resolvedIp = host;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(host)) {
        const knownDomains: Record<string, string> = {
            'a10.com': '52.8.34.123',
            'google.com': '142.250.185.78',
            'github.com': '140.82.112.4',
            'microsoft.com': '20.112.52.29',
            'amazon.com': '52.94.236.248',
            'facebook.com': '157.240.229.35',
            'twitter.com': '104.244.42.1',
        };
        resolvedIp = knownDomains[host.toLowerCase()] || host;
    }

    let output = `Connecting to ${host}`;
    if (resolvedIp !== host) {
        output += ` (${resolvedIp})`;
    }
    output += ` port 22...\n`;

    if (username) {
        output += `${username}@${host}'s password: `;
    } else {
        output += `Password: `;
    }

    return {
        success: true,
        output,
        requiresSshPassword: true,
        sshTarget: { host, username, port: 22 }
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
        reloadDevice: true
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

/**
 * Traceroute - Trace route to destination (Unix/Linux style)
 */
function cmdTraceroute(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^traceroute\s+([0-9.]+|[\w.-]+)$/i);
    if (!match) {
        return { success: false, error: '% Invalid traceroute command. Use: traceroute <host>' };
    }

    const host = match[1];

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
            // Resolve hostname to show IP address
            let resolvedIp = host;
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipRegex.test(host)) {
                // For external domains, we'll simulate the IP
                const knownDomains: Record<string, string> = {
                    'a10.com': '52.8.34.123',
                    'google.com': '142.250.185.78',
                    'github.com': '140.82.112.4',
                    'microsoft.com': '20.112.52.29',
                    'amazon.com': '52.94.236.248',
                    'facebook.com': '157.240.229.35',
                    'twitter.com': '104.244.42.1',
                };
                resolvedIp = knownDomains[host.toLowerCase()] || 'Unknown';
            }

            let output = `\nType escape sequence to abort.\n`;
            output += `Tracing the route to ${host} (${resolvedIp})\n`;

            // Use the hops from connectivity result
            if (connectivity.hops && connectivity.hops.length > 0) {
                for (let i = 0; i < connectivity.hops.length; i++) {
                    const hop = connectivity.hops[i];
                    const hopTime = Math.floor(Math.random() * 20) + 1; // 1-20ms
                    output += `  ${i + 1} ${hop} ${hopTime} ms ${hopTime} ms ${hopTime} ms\n`;
                }
            } else {
                // Fallback hops
                const hops = Math.floor(Math.random() * 3) + 2; // 2-4 hops
                for (let i = 1; i <= hops; i++) {
                    const hopTime = Math.floor(Math.random() * 20) + 1; // 1-20ms
                    output += `  ${i} ${connectivity.targetId || '192.168.1.1'} ${hopTime} ms ${hopTime} ms ${hopTime} ms\n`;
                }
            }

            output += `\nTrace complete.\n`;
            return { success: true, output, triggerPingAnimation: connectivity.targetId };
        } else {
            // For failed connections, still try to show resolved IP
            let resolvedIp = host;
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipRegex.test(host)) {
                const knownDomains: Record<string, string> = {
                    'a10.com': '52.8.34.123',
                    'google.com': '142.250.185.78',
                    'github.com': '140.82.112.4',
                    'microsoft.com': '20.112.52.29',
                    'amazon.com': '52.94.236.248',
                    'facebook.com': '157.240.229.35',
                    'twitter.com': '104.244.42.1',
                };
                resolvedIp = knownDomains[host.toLowerCase()] || 'Unknown';
            }

            return {
                success: false,
                output: `\nType escape sequence to abort.\nTracing the route to ${host} (${resolvedIp})\n`,
                error: connectivity.error || `Destination host unreachable.`,
            };
        }
    }

    return { success: false, error: '% Traceroute requires network context' };
}

/**
 * Tracert - Trace route to destination (Windows style)
 */
function cmdTracert(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^tracert\s+([0-9.]+|[\w.-]+)$/i);
    if (!match) {
        return { success: false, error: '% Invalid tracert command. Use: tracert <host>' };
    }

    const host = match[1];

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
            // Resolve hostname to show IP address
            let resolvedIp = host;
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipRegex.test(host)) {
                // For external domains, we'll simulate the IP
                const knownDomains: Record<string, string> = {
                    'a10.com': '52.8.34.123',
                    'google.com': '142.250.185.78',
                    'github.com': '140.82.112.4',
                    'microsoft.com': '20.112.52.29',
                    'amazon.com': '52.94.236.248',
                    'facebook.com': '157.240.229.35',
                    'twitter.com': '104.244.42.1',
                };
                resolvedIp = knownDomains[host.toLowerCase()] || 'Unknown';
            }

            let output = `\nTracing route to ${host} [${resolvedIp}] over a maximum of 30 hops\n`;

            // Use the hops from connectivity result
            if (connectivity.hops && connectivity.hops.length > 0) {
                for (let i = 0; i < connectivity.hops.length; i++) {
                    const hop = connectivity.hops[i];
                    const hopTime1 = Math.floor(Math.random() * 20) + 1; // 1-20ms
                    const hopTime2 = Math.floor(Math.random() * 20) + 1; // 1-20ms
                    const hopTime3 = Math.floor(Math.random() * 20) + 1; // 1-20ms
                    output += `  ${i + 1}    <1 ms    <1 ms    <1 ms ${hop}\n`;
                }
            } else {
                // Fallback hops
                const hops = Math.floor(Math.random() * 3) + 2; // 2-4 hops
                for (let i = 1; i <= hops; i++) {
                    const hopTime1 = Math.floor(Math.random() * 20) + 1; // 1-20ms
                    const hopTime2 = Math.floor(Math.random() * 20) + 1; // 1-20ms
                    const hopTime3 = Math.floor(Math.random() * 20) + 1; // 1-20ms
                    output += `  ${i}    <1 ms    <1 ms    <1 ms ${connectivity.targetId || '192.168.1.1'}\n`;
                }
            }

            output += `\nTrace complete.\n`;
            return { success: true, output, triggerPingAnimation: connectivity.targetId };
        } else {
            // For failed connections, still try to show resolved IP
            let resolvedIp = host;
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipRegex.test(host)) {
                const knownDomains: Record<string, string> = {
                    'a10.com': '52.8.34.123',
                    'google.com': '142.250.185.78',
                    'github.com': '140.82.112.4',
                    'microsoft.com': '20.112.52.29',
                    'amazon.com': '52.94.236.248',
                    'facebook.com': '157.240.229.35',
                    'twitter.com': '104.244.42.1',
                };
                resolvedIp = knownDomains[host.toLowerCase()] || 'Unknown';
            }

            return {
                success: false,
                output: `\nTracing route to ${host} [${resolvedIp}] over a maximum of 30 hops\n  1    *        *        *     Request timed out.\n`,
                error: connectivity.error || `Request timed out.`,
            };
        }
    }

    return { success: false, error: '% Tracert requires network context' };
}
