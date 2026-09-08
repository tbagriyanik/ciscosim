import type { CommandContext } from './commandTypes';
import type { SwitchState, CommandResult } from '../types';
import type { CanvasDevice } from '@/components/network/networkTopology.types';
import { getSwitchDisplayProfile } from './showHelpers';
import { checkConnectivity } from '../connectivity';

/**
 * Show Running Configuration
 */
export function cmdShowRunningConfig(
  state: SwitchState,
  input: string,
  ctx: CommandContext,
  buildRunningConfig: (state: SwitchState) => string[],
  cmdShowRunningConfigInterface: (state: SwitchState, input: string, ctx: CommandContext) => CommandResult
): CommandResult {
  const match = input.match(/show\s+(?:running-config|run|running)(?:\s+interface\s+(\S+))?/i);
  const interfaceName = match?.[1];

  if (interfaceName) {
    return cmdShowRunningConfigInterface(state, input, ctx);
  }

  let output = '\nBuilding configuration...\n\n';
  const lines = buildRunningConfig(state);
  const configText = lines.join('\n');
  output += `Current configuration : ${configText.length} bytes\n\n`;
  output += configText;

  output += '\nend\n';
  return { success: true, output };
}

/**
 * Show Startup Configuration
 */
export function cmdShowStartupConfig(
  state: SwitchState,
  _input: string,
  _ctx: CommandContext
): CommandResult {
  const { systemImage } = getSwitchDisplayProfile(state);
  if (!state.startupConfig) {
    return {
      success: true,
      output: '\n% No startup configuration available\n'
    };
  }

  let output = '\nBuilding configuration...\n\n';
  output += 'Startup configuration : 1024 bytes\n\n';
  output += '!\n';
  output += `version ${state.startupConfig.version || '15.0'}\n`;
  output += `hostname ${state.startupConfig.hostname || state.hostname || 'Switch'}\n`;

  if (state.startupConfig.bannerMOTD) {
    const escapedBanner = state.startupConfig.bannerMOTD.replace(/\n/g, '\\n');
    output += `banner motd #${escapedBanner}#\n`;
    output += '!\n';
  }

  output += `boot system ${systemImage}\n`;
  output += '!\n';

  if (state.startupConfig.security?.servicePasswordEncryption) {
    output += 'service password-encryption\n';
  }
  output += '!\n';

  output += `spanning-tree mode ${state.startupConfig.spanningTree?.mode || 'pvst'}\n`;
  output += '!\n';

  const startupVlans = state.startupConfig.vlans || {};
  const vlanIds = Object.keys(startupVlans).filter(v => v !== '1');
  if (vlanIds.length > 0) {
    vlanIds.forEach((vlanId: string) => {
      const vlan = startupVlans[Number(vlanId)];
      output += `vlan ${vlanId}\n`;
      output += ` name ${vlan?.name || `VLAN${vlanId}`}\n`;
      output += ` state ${vlan?.status || 'active'}\n`;
      output += '!\n';
    });
  }

  const startupPorts = state.startupConfig.ports || {};
  Object.keys(startupPorts).forEach(portName => {
    const port = startupPorts[portName];
    output += `interface ${portName}\n`;

    const portDescription = port.description || port.name;
    if (portDescription) {
      output += ` description ${portDescription}\n`;
    }

    if (port.mode === 'trunk') {
      output += ' switchport mode trunk\n';
      if (port.nativeVlan) {
        output += ` switchport trunk native vlan ${port.nativeVlan}\n`;
      }
      if (port.allowedVlans) {
        output += ` switchport trunk allowed vlan ${port.allowedVlans}\n`;
      }
    } else if (port.mode === 'dynamic-auto') {
      output += ' switchport mode dynamic auto\n';
    } else if (port.mode === 'dynamic-desirable') {
      output += ' switchport mode dynamic desirable\n';
    } else if (port.mode === 'dot1q-tunnel') {
      output += ' switchport mode dot1q-tunnel\n';
    } else {
      output += ` switchport access vlan ${port.accessVlan || 1}\n`;
    }

    if (port.speed && port.speed !== 'auto') {
      output += ` speed ${port.speed}\n`;
    }

    if (port.duplex && port.duplex !== 'auto') {
      output += ` duplex ${port.duplex}\n`;
    }

    if (port.shutdown) {
      output += ' shutdown\n';
    }

    if (port.ipAddress && port.subnetMask) {
      output += ` ip address ${port.ipAddress} ${port.subnetMask}\n`;
    }

    if (port.spanningTree?.portfast) {
      output += ' spanning-tree portfast\n';
    }

    if (port.spanningTree?.bpduguard) {
      output += ' spanning-tree bpduguard enable\n';
    }

    output += '!\n';
  });

  output += 'line console 0\n';
  if (state.startupConfig.security?.consoleLine?.password) {
    if (state.startupConfig.security.servicePasswordEncryption) {
      output += ` password 7 ********\n`;
    } else {
      output += ` password ${state.startupConfig.security.consoleLine.password}\n`;
    }
  }
  if (state.startupConfig.security?.consoleLine?.login) {
    output += ' login\n';
  }
  output += '!\n';

  output += 'line vty 0 4\n';
  if (state.startupConfig.security?.vtyLines?.password) {
    if (state.startupConfig.security.servicePasswordEncryption) {
      output += ` password 7 ********\n`;
    } else {
      output += ` password ${state.startupConfig.security.vtyLines.password}\n`;
    }
  }
  if (state.startupConfig.security?.vtyLines?.login) {
    output += ' login\n';
  }
  if (state.startupConfig.security?.vtyLines?.transportInput) {
    output += ` transport input ${state.startupConfig.security.vtyLines.transportInput.join(' ')}\n`;
  }
  output += '!\n';

  if (state.startupConfig.security?.enableSecret) {
    output += `enable secret ${state.startupConfig.security.enableSecret}\n`;
  } else if (state.startupConfig.security?.enablePassword) {
    if (state.startupConfig.security.servicePasswordEncryption) {
      output += `enable password 7 ${state.startupConfig.security.enablePassword}\n`;
    } else {
      output += `enable password ${state.startupConfig.security.enablePassword}\n`;
    }
  }

  output += 'end\n';
  return { success: true, output };
}

/**
 * Show Version
 */
export function cmdShowVersion(
  state: SwitchState,
  _input: string,
  _ctx: CommandContext
): CommandResult {
  const { switchModel, softwareImage, rom, bootldr, systemImage, processor, reportedFeCount, reportedGiCount } = getSwitchDisplayProfile(state);
  const wlanPortCount = Object.values(state.ports || {}).filter((p) => (p?.id || '').startsWith('wlan')).length;

  let output = `\nNetwork NOS Software, ${softwareImage}\n`;
  output += 'Technical Support: http://yunus.sf.net\n';
  output += 'Copyright (c) 1996-2026 by Network Systems, Inc.\n\n';
  output += `ROM: Bootstrap program is ${rom}\n`;
  output += `BOOTLDR: ${bootldr}\n\n`;
  const bootTime = state.bootTime || Date.now();
  const elapsedMs = Date.now() - bootTime;
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const weeks = Math.floor(totalSeconds / (7 * 24 * 3600));
  const days = Math.floor((totalSeconds % (7 * 24 * 3600)) / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const uptimeStr = `${weeks} week${weeks !== 1 ? 's' : ''}, ${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  output += `Switch uptime is ${uptimeStr}\n`;
  output += `System image file is "${systemImage}"\n\n`;
  output += `${processor}\n`;
  output += 'Processor board ID FOC1234X5YZ\n';
  output += 'Last reload reason: power-on\n\n';

  if (reportedFeCount > 0) {
    output += `${reportedFeCount} FastEthernet/IEEE 802.3 interface(s)\n`;
  }

  if (reportedGiCount > 0) {
    output += `${reportedGiCount} Gigabit Ethernet/IEEE 802.3 interface(s)\n`;
  }

  if (wlanPortCount > 0) {
    output += `${wlanPortCount} 802.11 Wireless interface(s)\n`;
  }
  output += '\n';
  output += '64K bytes of flash-simulated non-volatile configuration memory.\n';
  output += `Base ethernet MAC Address       : ${state.macAddress}\n`;
  output += 'Motherboard assembly number   : 73-10000-01\n';
  output += `Model number                  : ${switchModel}\n`;
  output += '!\n';

  return { success: true, output };
}

/**
 * Show Clock
 */
export function cmdShowClock(
  state: SwitchState,
  _input: string,
  ctx: CommandContext
): CommandResult {
  const serverIps = state.ntpServers || [];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatNtpTime = (ntp: { time: string; date: string }): CommandResult => {
    const [y, m, d] = ntp.date.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[parseInt(m) - 1] || m;
    const dayName = days[new Date(`${y}-${m}-${d}`).getDay()];
    return { success: true, output: `\n*${ntp.time}.000 UTC ${dayName} ${monthName} ${parseInt(d)} ${y}\n` };
  };

  for (const serverIp of serverIps) {
    if (ctx.devices && ctx.connections && ctx.sourceDeviceId) {
      const reachable = checkConnectivity(
        ctx.sourceDeviceId, serverIp,
        ctx.devices, ctx.connections,
        ctx.deviceStates, ctx.language,
        { protocol: 'udp', port: '123' }
      );
      if (reachable.success) {
        const targetDev = ctx.devices.find((d: CanvasDevice) => d.id === reachable.targetId);
        if (targetDev && targetDev.type !== 'switchL2' && targetDev.type !== 'switchL3' && targetDev.type !== 'router') {
          const ntp = targetDev.services?.ntp;
          if (ntp?.enabled && ntp.date && ntp.time) return formatNtpTime({ time: ntp.time, date: ntp.date });
        }
        if (reachable.targetId && ctx.deviceStates) {
          const serverState = ctx.deviceStates.get(reachable.targetId);
          const toff = serverState?.services?.ntp?.timeOffset;
          if (toff !== undefined) {
            const now = new Date();
            const adj = new Date(now.getTime() + toff);
            return { success: true, output: `\n*${adj.toTimeString().slice(0, 8)}.000 UTC ${days[adj.getDay()]} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][adj.getMonth()]} ${adj.getDate()} ${adj.getFullYear()}\n` };
          }
        }
        const now = new Date();
        return { success: true, output: `\n*${now.toTimeString().slice(0, 8)}.000 UTC ${days[now.getDay()]} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]} ${now.getDate()} ${now.getFullYear()}\n` };
      }
    }

    const serverDev = ctx.devices?.find((d) => d.ip === serverIp);
    if (serverDev && serverDev.type !== 'switchL2' && serverDev.type !== 'switchL3' && serverDev.type !== 'router') {
      const ntp = serverDev.services?.ntp;
      if (ntp?.enabled && ntp.date && ntp.time) return formatNtpTime({ time: ntp.time, date: ntp.date });
    }
    if (serverIp && ctx.deviceStates) {
      for (const [, devState] of ctx.deviceStates) {
        if (devState.services?.ntp?.enabled) {
          const ports = Object.values(devState.ports);
          if (ports.some(p => p.ipAddress === serverIp || p.ipv6Address === serverIp)) {
            const toff = devState.services.ntp.timeOffset;
            if (toff !== undefined) {
              const now = new Date();
              const adj = new Date(now.getTime() + toff);
              return { success: true, output: `\n*${adj.toTimeString().slice(0, 8)}.000 UTC ${days[adj.getDay()]} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][adj.getMonth()]} ${adj.getDate()} ${adj.getFullYear()}\n` };
            }
          }
        }
      }
    }
  }

  const localNtp = state.services?.ntp;
  if (localNtp?.enabled) {
    if (localNtp.date && localNtp.time) return formatNtpTime(localNtp as { time: string; date: string });
    if (localNtp.timeOffset !== undefined) {
      const now = new Date();
      const adj = new Date(now.getTime() + localNtp.timeOffset);
      return { success: true, output: `\n*${adj.toTimeString().slice(0, 8)}.000 UTC ${days[adj.getDay()]} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][adj.getMonth()]} ${adj.getDate()} ${adj.getFullYear()}\n` };
    }
  }

  if (state.systemClock) {
    const { time, day, month, year } = state.systemClock as { time: string; day: string; month: string; year: string };
    const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month) + 1;
    const dayName = days[new Date(`${year}-${String(monthIndex).padStart(2, '0')}-${String(day).padStart(2, '0')}`).getDay()];
    return { success: true, output: `\n*${time}.000 UTC ${dayName} ${month} ${parseInt(day)} ${year}\n` };
  }

  const now = new Date();
  return { success: true, output: `\n*${now.toTimeString().split(' ')[0]}.000 UTC ${days[now.getDay()]} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]} ${now.getDate()} ${now.getFullYear()}\n` };
}

/**
 * Show Flash
 */
export function cmdShowFlash(
  state: SwitchState,
  _input: string,
  _ctx: CommandContext
): CommandResult {
  const { bootImage } = getSwitchDisplayProfile(state);
  let output = '\n-#- --length-- -----date/time------ path\n';
  const staticFiles = [
    { name: 'vlan.dat', length: 616 },
    { name: 'config.text', length: 1599 },
    { name: 'private-config.text', length: 1464 },
    { name: bootImage, length: 3024 },
  ];

  const flashFiles = (state.flashFiles || {}) as Record<string, string[]>;
  const flashBackups: Array<{ name: string; length: number }> = Object.entries(flashFiles).map(
    ([name, lines]) => ({
      name,
      length: Array.isArray(lines) ? lines.join('\n').length : 0,
    })
  );

  const now = new Date();
  const dateText = now.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(',', '');

  const files = [...staticFiles, ...flashBackups];
  files.forEach((file, idx) => {
    output += `${String(idx + 1).padEnd(5)} ${String(file.length).padEnd(8)} ${dateText} +00:00  ${file.name}\n`;
  });

  const usedBytes = files.reduce((sum, f) => sum + f.length, 0);
  const totalBytes = 32505856;
  const availableBytes = Math.max(0, totalBytes - usedBytes);
  output += `\n${availableBytes} bytes available (${usedBytes} bytes used)\n`;
  return { success: true, output };
}

/**
 * Show Boot
 */
export function cmdShowBoot(
  state: SwitchState,
  _input: string,
  _ctx: CommandContext
): CommandResult {
  const { systemImage } = getSwitchDisplayProfile(state);
  let output = '\n';
  output += `BOOT variable = flash:${systemImage}\n`;
  output += 'CONFIG_FILE variable = flash:config.text\n';
  output += 'BOOTLDR variable = \n';
  output += 'Configuration register is 0x2102\n';
  return { success: true, output };
}
