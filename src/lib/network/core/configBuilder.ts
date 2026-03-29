import { SwitchState } from '../types';

const TIMESTAMP = '2026-02-26 22:00:00';

/**
 * Cisco Type 7 password encryption (simple XOR-based)
 * This is a simplified version for simulation purposes
 */
function simplePasswordEncrypt(password: string): string {
    const key = [0x64, 0x73, 0x66, 0x64, 0x3b, 0x6b, 0x66, 0x6f, 0x41, 0x2c, 0x2e, 0x69, 0x79, 0x65, 0x77, 0x72, 0x6b, 0x6c, 0x64, 0x4a, 0x4b, 0x44, 0x48, 0x53, 0x55, 0x42];
    let result = '';
    let index = 0;

    for (let i = 0; i < password.length; i++) {
        const encrypted = password.charCodeAt(i) ^ key[index];
        result += encrypted.toString(16).padStart(2, '0');
        index = (index + 1) % key.length;
    }

    // Add random salt at the beginning (Cisco Type 7 format)
    const salt = Math.floor(Math.random() * 15) + 1;
    return salt.toString() + result;
}

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
        lines.push(`banner motd #${state.bannerMOTD}#`);
        lines.push('!');
    }

    if (state.security.enableSecret) {
        if (state.security.enableSecretEncrypted) {
            lines.push('enable secret 5 $1$xxxx$xxxxxxxxxxxxxxxx');
        } else {
            lines.push(`enable secret ${state.security.enableSecret}`);
        }
    }
    if (state.security.enablePassword) {
        // If service password-encryption is enabled, encrypt the password (type 7)
        if (state.security.servicePasswordEncryption) {
            const encrypted = simplePasswordEncrypt(state.security.enablePassword);
            lines.push(`enable password 7 ${encrypted}`);
        } else {
            lines.push(`enable password ${state.security.enablePassword}`);
        }
    }
    lines.push('!');

    state.security.users.forEach(user => {
        lines.push(`username ${user.username} privilege ${user.privilege} secret ${user.password}`);
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

        const portUpper = port.id.toUpperCase().replace('FA', 'FastEthernet').replace('GI', 'GigabitEthernet');
        lines.push(`interface ${portUpper}`);
        if (port.name) {
            lines.push(` description ${port.name}`);
        }
        if (port.shutdown) {
            lines.push(' shutdown');
        }
        if (port.speed !== 'auto') {
            lines.push(` speed ${port.speed}`);
        }
        if (port.duplex !== 'auto') {
            lines.push(` duplex ${port.duplex}`);
        }
        if (port.mode === 'trunk') {
            lines.push(' switchport mode trunk');
        } else {
            lines.push(' switchport mode access');
            const vlanId = Number((port as any).accessVlan || port.vlan || 1);
            if (vlanId !== 1) {
                lines.push(` switchport access vlan ${vlanId}`);
            }
        }
        if (port.ipAddress && port.subnetMask) {
            lines.push(` ip address ${port.ipAddress} ${port.subnetMask}`);
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
        lines.push(' shutdown');
        lines.push('!');
    }
    lines.push(' shutdown');
    lines.push('!');

    // line con 0
    lines.push('line con 0');
    if (state.security.consoleLine.password) {
        lines.push(` password ${state.security.consoleLine.password}`);
    }
    if (state.security.consoleLine.login) {
        lines.push(' login');
    }
    lines.push('!');

    // line vty 0 15
    lines.push('line vty 0 15');
    if (state.security.vtyLines.password) {
        lines.push(` password ${state.security.vtyLines.password}`);
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
