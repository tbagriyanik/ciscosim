import { CanvasPort } from './networkTopology.types';

/** Generates standard L2 switch ports: 24x FastEthernet + 2x GigabitEthernet + WLAN0 */
export function generateSwitchPorts(): CanvasPort[] {
    const ports: CanvasPort[] = [{ id: 'console', label: 'Console', status: 'disconnected' as const }];
    for (let i = 1; i <= 24; i++) {
        ports.push({ id: `fa0/${i}`, label: `Fa0/${i}`, status: 'disconnected' as const });
    }
    ports.push({ id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const });
    ports.push({ id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const });
    ports.push({ id: 'wlan0', label: 'WLAN0', status: 'disconnected' as const, shutdown: true });
    return ports;
}

/** Generates L3 switch ports: 24x FastEthernet + 4x GigabitEthernet + WLAN0 */
export function generateL3SwitchPorts(): CanvasPort[] {
    const ports: CanvasPort[] = [{ id: 'console', label: 'Console', status: 'disconnected' as const }];
    for (let i = 1; i <= 24; i++) {
        ports.push({ id: `fa0/${i}`, label: `Fa0/${i}`, status: 'disconnected' as const });
    }
    ports.push({ id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const });
    ports.push({ id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const });
    ports.push({ id: 'gi0/3', label: 'Gi0/3', status: 'disconnected' as const });
    ports.push({ id: 'gi0/4', label: 'Gi0/4', status: 'disconnected' as const });
    ports.push({ id: 'wlan0', label: 'WLAN0', status: 'disconnected' as const, shutdown: true });
    return ports;
}

/** Generates router ports: 4x GigabitEthernet + WLAN0 with per-port MAC addresses */
export function generateRouterPorts(): CanvasPort[] {
    // Generate base MAC for router ports
    const formatMacFromNumber = (value: number): string => {
        const base = value.toString(16).padStart(12, '0').toUpperCase();
        return `${base.slice(0, 4)}.${base.slice(4, 8)}.${base.slice(8, 12)}`;
    };
    const baseMacNumber = 0x005000000000; // Router base MAC range

    return [
        { id: 'console', label: 'Console', status: 'disconnected' as const },
        { id: 'gi0/0', label: 'Gi0/0', status: 'disconnected' as const, macAddress: formatMacFromNumber(baseMacNumber) },
        { id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const, macAddress: formatMacFromNumber(baseMacNumber + 1) },
        { id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const, macAddress: formatMacFromNumber(baseMacNumber + 2) },
        { id: 'gi0/3', label: 'Gi0/3', status: 'disconnected' as const, macAddress: formatMacFromNumber(baseMacNumber + 3) },
        { id: 'wlan0', label: 'WLAN0', status: 'disconnected' as const, shutdown: true },
    ];
}
