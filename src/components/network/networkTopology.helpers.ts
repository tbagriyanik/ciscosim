export const generateSwitchPorts = () => {
 const ports = [{ id: 'console', label: 'Console', status: 'disconnected' as const }];
 for (let i = 1; i <= 24; i++) {
 ports.push({ id: `fa0/${i}`, label: `Fa0/${i}`, status: 'disconnected' as const });
 }
 ports.push({ id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const });
 ports.push({ id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const });
 return ports;
};

export const generateRouterPorts = () => {
 return [
 { id: 'console', label: 'Console', status: 'disconnected' as const },
 { id: 'gi0/0', label: 'Gi0/0', status: 'disconnected' as const },
 { id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const },
 { id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const },
 { id: 'gi0/3', label: 'Gi0/3', status: 'disconnected' as const },
 ];
};

export const generateMacAddress = (): string => {
 const chars = '0123456789abcdef';
 let mac = '';
 for (let i = 0; i < 12; i++) {
 mac += chars[Math.floor(Math.random() * 16)];
 if (i === 3 || i === 7) mac += '.';
 }
 return mac;
};
