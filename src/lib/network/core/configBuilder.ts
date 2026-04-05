import { SwitchState } from '../types';

const TIMESTAMP = '2026-02-26 22:00:00';

/**
 * Pure function that generates the running config lines for a given SwitchState.
 * Returns one config line per array entry (no \n characters).
 * Mirrors the generateConfig() logic in ConfigPanel.tsx.
 */
export function buildRunningConfig(state: SwitchState): string[] {
    const lines: string[] = [];

    // Header
    lines.push('!');
    lines.push(`! Last configuration change at ${TIMESTAMP}`);
    lines.push('!');
    lines.push('version 15.0');
    lines.push('no service pad');
    lines.push('service timestamps debug datetime msec');
    lines.push('service timestamps log datetime msec');

    if (state.security.servicePasswordEncryption) {
        lines.push('service password-encryption');
    }

    lines.push('!');
    lines.push(`hostname ${state.hostname}`);
    lines.push(`! base mac-address ${state.macAddress}`);
    lines.push('!');

    if (state.bannerMOTD) {
        const escapedBanner = state.bannerMOTD.replace(/\n/g, '\\n');
        lines.push(`banner motd #${escapedBanner}#`);
        lines.push('!');
    }

    if (state.security.enableSecret) {
        lines.push('enable secret 5 $1$xxxx$xxxxxxxxxxxxxxxx');
    }
    if (state.security.enablePassword) {
        if (state.security.servicePasswordEncryption) {
            lines.push(`enable password 7 ********`);
        } else {
            lines.push(`enable password ${state.security.enablePassword}`);
        }
    }
    lines.push('!');

    if (state.services?.http?.enabled) {
        lines.push('ip http server');
        lines.push('!');
    }

    state.security.users.forEach(user => {
        if (state.security.servicePasswordEncryption) {
            lines.push(`username ${user.username} privilege ${user.privilege} secret 7 ********`);
        } else {
            lines.push(`username ${user.username} privilege ${user.privilege} secret ${user.password}`);
        }
    });
    if (state.security.users.length > 0) {
        lines.push('!');
    }

    // IP Routing
    if (state.ipRouting) {
        lines.push('ip routing');
        lines.push('!');
    }

    // VLANs (id 2-1001)
    Object.values(state.vlans).forEach(vlan => {
        if (vlan.id >= 2 && vlan.id <= 1001) {
            lines.push(`vlan ${vlan.id}`);
            lines.push(` name ${vlan.name}`);
            lines.push('!');
        }
    });

    // Physical interfaces (non-VLAN ports)
    Object.values(state.ports).forEach(port => {
        if (port.id.toLowerCase().startsWith('vlan')) {
            return;
        }

        const isWlan = port.id.toLowerCase().startsWith('wlan');
        const portUpper = isWlan
            ? port.id.toUpperCase()
            : port.id.toUpperCase().replace('FA', 'FastEthernet').replace('GI', 'GigabitEthernet');

        lines.push(`interface ${portUpper}`);

        if (port.name) {
            lines.push(` description ${port.name}`);
        }

        if (isWlan) {
            // WLAN interface: only wifi-specific commands, no switchport
            if (port.wifi) {
                const wifiMode = port.wifi.mode === 'disabled'
                    ? 'disabled'
                    : port.wifi.mode === 'client'
                        ? 'client'
                        : 'ap';
                lines.push(` wifi-mode ${wifiMode}`);
                if (port.wifi.ssid) {
                    lines.push(` ssid ${port.wifi.ssid}`);
                }
                if (port.wifi.security && port.wifi.security !== 'open') {
                    lines.push(` encryption ${port.wifi.security}`);
                }
                if (port.wifi.password) {
                    lines.push(` wifi-password ${port.wifi.password}`);
                }
                if (port.wifi.channel) {
                    lines.push(` wifi-channel ${port.wifi.channel}`);
                }
            }
            if (!port.shutdown) {
                lines.push(' no shutdown');
            } else {
                lines.push(' shutdown');
            }
        } else {
            // Regular (Ethernet) interface
            if (port.speed !== 'auto') {
                lines.push(` speed ${port.speed}`);
            }
            if (port.duplex !== 'auto') {
                lines.push(` duplex ${port.duplex}`);
            }
            if (port.mode === 'trunk') {
                lines.push(' switchport mode trunk');
            } else if (port.mode === 'access') {
                lines.push(' switchport mode access');
                const vlanId = Number((port as any).accessVlan || port.vlan || 1);
                if (vlanId !== 1) {
                    lines.push(` switchport access vlan ${vlanId}`);
                }
            }
            if (port.ipAddress && port.subnetMask) {
                lines.push(` ip address ${port.ipAddress} ${port.subnetMask}`);
            }
            if (!port.shutdown) {
                lines.push(' no shutdown');
            } else {
                lines.push(' shutdown');
            }
        }

        lines.push('!');
    });

    // VLAN SVI interfaces (ports starting with 'vlan')
    Object.keys(state.ports || {}).forEach(portName => {
        if (portName.toLowerCase().startsWith('vlan')) {
            const port = state.ports[portName];
            const vlanNum = portName.toLowerCase().replace('vlan', '');

            // Skip Vlan1 if it doesn't have an IP address - handled at the end
            if (vlanNum === '1' && (!port.ipAddress || !port.subnetMask)) {
                return;
            }

            lines.push(`interface Vlan${vlanNum}`);
            if (port.ipAddress && port.subnetMask) {
                lines.push(` ip address ${port.ipAddress} ${port.subnetMask}`);
            }
            if (!port.shutdown) {
                lines.push(' no shutdown');
            } else {
                lines.push(' shutdown');
            }
            lines.push('!');
        }
    });

    // Default Vlan1 (if not already configured above)
    const vlan1Port = state.ports['vlan1'];
    if (!vlan1Port || !vlan1Port.ipAddress || !vlan1Port.subnetMask) {
        lines.push('interface Vlan1');
        lines.push(' no ip address');
        lines.push(' no shutdown');
        lines.push('!');
    }

    // IP default-gateway
    if (state.defaultGateway) {
        lines.push(`ip default-gateway ${state.defaultGateway}`);
        lines.push('!');
    }

    // line con 0
    lines.push('line con 0');
    if (state.security.consoleLine.password) {
        if (state.security.servicePasswordEncryption) {
            lines.push(` password 7 ********`);
        } else {
            lines.push(` password ${state.security.consoleLine.password}`);
        }
    }
    if (state.security.consoleLine.login) {
        lines.push(' login');
    }
    lines.push('!');

    // line vty 0 15
    lines.push('line vty 0 15');
    if (state.security.vtyLines.password) {
        if (state.security.servicePasswordEncryption) {
            lines.push(` password 7 ********`);
        } else {
            lines.push(` password ${state.security.vtyLines.password}`);
        }
    }
    if (state.security.vtyLines.login) {
        lines.push(' login');
    }
    if (
        state.security.vtyLines.transportInput.length > 0 &&
        state.security.vtyLines.transportInput[0] !== 'all'
    ) {
        lines.push(` transport input ${state.security.vtyLines.transportInput.join(' ')}`);
    }
    lines.push('!');

    lines.push('end');

    return lines;
}
