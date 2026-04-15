import type { CommandHandler } from './commandTypes';
import { checkConnectivity, getWirelessSignalStrength, getWirelessDistance } from '../connectivity';
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
    'copy running-config flash': cmdCopyRunningFlash,
    'copy flash startup-config': cmdCopyFlashStartup,
    'erase startup-config': cmdEraseStartupConfig,
    'erase nvram': cmdEraseNvram,
    'reload': cmdReload,
    'ip route': cmdIpRoute,
    'no ip route': cmdNoIpRoute,
    'debug': cmdDebug,
    'undebug all': cmdUndebugAll,
    'do write': cmdDoWrite,
    'do ping': cmdDoPing,
    'delete flash:vlan.dat': cmdDeleteVlanDat,
};

/**
 * Generate ping latencies proportional to WiFi distance.
 * Uses exponential curve: close = very fast, far = much slower (realistic WiFi behavior).
 * distance 0px → ~1ms, 450px (signal 1) → ~150ms, 549px → ~210ms
 */
function generatePingLatencies(distance: number): { min: number; avg: number; max: number } {
    const jitter = (base: number, pct: number) =>
        Math.max(1, Math.round(base * (1 + (Math.random() * 2 - 1) * pct)));

    // Exponential: base = e^(distance/130) scaled to 1ms at 0px, ~210ms at 549px
    const basePing = Math.exp(distance / 130);

    const min = jitter(basePing * 0.8, 0.08);
    const avg = jitter(basePing, 0.08);
    const max = jitter(basePing * 1.25, 0.08);

    return { min, avg: Math.max(min, avg), max: Math.max(avg, max) };
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
            const targetDevice = connectivity.targetId ? devices.find(d => d.id === connectivity.targetId) : undefined;

            const srcDist = getWirelessDistance(sourceDevice, devices, ctx.deviceStates);
            const dstDist = getWirelessDistance(targetDevice, devices, ctx.deviceStates);

            // Both wired → <1ms
            // One or both wireless → sum their distances for total path latency
            const srcWired = srcDist === Infinity;
            const dstWired = dstDist === Infinity;

            let pingResult: { min: number; avg: number; max: number };
            if (srcWired && dstWired) {
                pingResult = { min: 1, avg: 1, max: 2 };
            } else {
                // Use effective distance: sum wireless hops, ignore wired (0 cost)
                const effectiveDist = (srcWired ? 0 : srcDist) + (dstWired ? 0 : dstDist);
                pingResult = generatePingLatencies(effectiveDist);
            }

            const fmtMs = (ms: number) => ms <= 1 ? '<1' : String(ms);
            for (let i = 0; i < successCount; i++) output += '!';
            output += `\n\nSuccess rate is 100 percent (${successCount}/${successCount}), round-trip min/avg/max = ${fmtMs(pingResult.min)}/${fmtMs(pingResult.avg)}/${fmtMs(pingResult.max)} ms\n`;
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
    // Allow telnet from both user and privileged modes
    if (state.currentMode !== 'user' && state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^telnet\s+([0-9.]+|[\w.-]+)(?:\s+(\d+))?$/i);
    if (!match) {
        return { success: false, error: '% Invalid telnet command' };
    }

    const host = match[1];
    const port = match[2] || '23';

    // Connectivity logic
    if (ctx?.sourceDeviceId && Array.isArray(ctx.devices)) {
        const connectivity = checkConnectivity(
            ctx.sourceDeviceId,
            host,
            ctx.devices,
            ctx.connections || [],
            ctx.deviceStates,
            ctx.language
        );

        if (!connectivity.success) {
            return {
                success: false,
                output: `Trying ${host} ${port} ...`,
                error: connectivity.error || (ctx.language === 'tr' ? 'Hedefe ulaşılamadı.' : 'Destination host unreachable.')
            };
        }

        // Check target device configuration
        const targetDeviceId = connectivity.targetId;
        const targetState = ctx.deviceStates?.get(targetDeviceId);

        if (targetState) {
            const transportInput = targetState.security?.vtyLines?.transportInput || [];
            const isTelnetActive = transportInput.includes('all') || transportInput.includes('telnet');

            if (!isTelnetActive) {
                return {
                    success: false,
                    output: `Connecting to ${host}...`,
                    error: `% Connection refused by remote host`
                };
            }
        }
    }

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
    // Allow ssh from both user and privileged modes
    if (state.currentMode !== 'user' && state.currentMode !== 'privileged') {
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

    // Connectivity logic
    if (ctx?.sourceDeviceId && Array.isArray(ctx.devices)) {
        const connectivity = checkConnectivity(
            ctx.sourceDeviceId,
            host,
            ctx.devices,
            ctx.connections || [],
            ctx.deviceStates,
            ctx.language
        );

        if (!connectivity.success) {
            return {
                success: false,
                output: `Connecting to ${host}...`,
                error: connectivity.error || (ctx.language === 'tr' ? 'Hedefe ulaşılamadı.' : 'Destination host unreachable.')
            };
        }

        // Check target device configuration
        const targetDeviceId = connectivity.targetId;
        const targetState = ctx.deviceStates?.get(targetDeviceId);

        if (targetState) {
            const transportInput = targetState.security?.vtyLines?.transportInput || [];
            const isSshActive = transportInput.includes('all') || transportInput.includes('ssh');

            if (!isSshActive) {
                return {
                    success: false,
                    output: `Connecting to ${host}...`,
                    error: `% Connection refused by remote host`
                };
            }
        }
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
 * Copy Running-Config Flash:
 */
function cmdCopyRunningFlash(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^copy\s+running-config\s+flash:(\S+)?$/i);
    if (!match) {
        return { success: false, error: '% Invalid copy command. Use: copy running-config flash:[:filename]' };
    }

    const requestedFilename = (match[1] || '').trim();
    const filename = requestedFilename || 'running-config';

    return {
        success: true,
        output: `Destination filename [${filename}]?\nBuilding configuration...\n[OK]\n`,
        saveFlashConfig: true,
        flashFilename: filename
    };
}

/**
 * Copy Flash: Startup-Config
 */
function cmdCopyFlashStartup(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    const match = input.match(/^copy\s+flash:(\S+)?\s+startup-config$/i);
    if (!match) {
        return { success: false, error: '% Invalid copy command. Use: copy flash:[:filename] startup-config' };
    }

    const requestedFilename = (match[1] || '').trim();
    const sourceFilename = requestedFilename || 'running-config';
    const hasSnapshot = !!state.flashStartupConfigs?.[sourceFilename];
    const hasLegacyTextBackup = !!state.flashFiles?.[sourceFilename];

    if (!hasSnapshot && hasLegacyTextBackup) {
        return {
            success: false,
            error: `%Error: flash:${sourceFilename} is legacy backup format. Re-save with "copy running-config flash:${sourceFilename}" and try again.`
        };
    }

    if (!hasSnapshot) {
        return {
            success: false,
            error: `%Error: flash:${sourceFilename} not found`
        };
    }

    return {
        success: true,
        output: `Loading flash:${sourceFilename} to startup-config...\n[OK]\nStartup config updated. Reload required to apply.\n`,
        restoreFlashConfig: true,
        flashSourceFilename: sourceFilename
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
            ipRouting: true
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
 * Tracert - Trace route to destination 
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

/**
 * Terminal - Set terminal parameters
 */
function cmdTerminal(state: any, input: string, ctx: any): any {
    const match = input.match(/^terminal\s+(length|width|monitor|no\s+monitor)\s*(\d*)$/i);
    if (!match) return { success: false, error: '% Invalid terminal command' };
    const param = match[1].toLowerCase();
    if (param === 'length') return { success: true, output: '' };
    if (param === 'width') return { success: true, output: '' };
    if (param === 'monitor') return { success: true, output: '%LINK-5-CHANGED: Interface, changed state to monitoring' };
    return { success: true, output: '' };
}

/**
 * Clear ARP Cache
 */
function cmdClearArpCache(state: any, input: string, ctx: any): any {
    return { success: true, output: '' };
}

/**
 * Clear MAC Address-Table
 */
function cmdClearMacAddressTable(state: any, input: string, ctx: any): any {
    return {
        success: true,
        output: '',
        newState: { macAddressTable: [] }
    };
}

/**
 * Clear Counters
 */
function cmdClearCounters(state: any, input: string, ctx: any): any {
    return { success: true, output: 'Clear "show interface" counters on all interfaces [confirm]\n' };
}

/**
 * Undebug (alias for undebug all)
 */
function cmdUndebug(state: any, input: string, ctx: any): any {
    return {
        success: true,
        output: 'All possible debugging has been turned off',
        newState: { debugEnabled: false }
    };
}

/**
 * Help command
 */
function cmdHelp(state: any, input: string, ctx: any): any {
    const lang = ctx?.language || 'en';
    const output = lang === 'tr'
        ? '\nYardım sistemi:\n  Komut tamamlama için TAB tuşunu kullanın\n  Komut yardımı için ? kullanın\n  Örnek: show ?\n'
        : '\nHelp system:\n  Use TAB for command completion\n  Use ? for command help\n  Example: show ?\n';
    return { success: true, output };
}

/**
 * Delete VLAN database file
 */
function cmdDeleteVlanDat(state: any, input: string, ctx: any): any {
    if (state.currentMode !== 'privileged') {
        return { success: false, error: '% Invalid command at this mode' };
    }

    // Check if this is a confirmation (skipConfirm is passed from useDeviceManager)
    if (ctx?.skipConfirm) {
        // Actually delete the VLANs
        const newPorts: any = {};
        Object.entries(state.ports || {}).forEach(([portId, port]: [string, any]) => {
            newPorts[portId] = {
                ...port,
                accessVlan: 1,
                vlan: 1,
                trunkAllowedVlans: '1-4094',
                nativeVlan: 1
            };
        });

        return {
            success: true,
            output: 'Delete filename [vlan.dat]? \nDeleting flash:vlan.dat...\n',
            newState: {
                vlans: {},
                ports: newPorts,
                runningConfig: undefined // Will be rebuilt
            }
        };
    }

    return {
        success: true,
        output: 'Delete filename [vlan.dat]?',
        requiresConfirmation: true,
        confirmationMessage: 'Delete vlan.dat? This will remove all VLAN database information.',
        confirmationAction: 'delete-vlan',
        deleteVlanDat: true
    };
}

// Register new privileged handlers
Object.assign(privilegedHandlers, {
    'terminal': cmdTerminal,
    'terminal length': cmdTerminal,
    'terminal width': cmdTerminal,
    'terminal monitor': cmdTerminal,
    'terminal no monitor': cmdTerminal,
    'clear arp-cache': cmdClearArpCache,
    'clear mac address-table': cmdClearMacAddressTable,
    'clear counters': cmdClearCounters,
    'undebug': cmdUndebug,
    'help': cmdHelp,
});
