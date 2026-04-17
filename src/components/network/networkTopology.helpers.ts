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
    { id: 'wlan0', label: 'WLAN0', status: 'disconnected' as const, shutdown: true },
  ];
};

export const generateMacAddress = (): string => {
  const chars = '0123456789ABCDEF';
  let mac = '';
  for (let i = 0; i < 12; i++) {
    mac += chars[Math.floor(Math.random() * 16)];
    if (i === 3 || i === 7) mac += '.';
  }
  return mac;
};

// Device dimension constants
export const DEVICE_DIMENSIONS = {
  pc: { width: 90, height: 99 },
  iot: { width: 90, height: 99 },
  router: { width: 90, height: 80 },
  switch: { width: 130, height: 80 },
} as const;

export const getDeviceDimensions = (type: string) => {
  if (type === 'pc' || type === 'iot') return DEVICE_DIMENSIONS.pc;
  if (type === 'router') return DEVICE_DIMENSIONS.router;
  return DEVICE_DIMENSIONS.switch;
};

export const getDeviceWidth = (type: string): number => {
  return getDeviceDimensions(type).width;
};

export const getDeviceHeight = (deviceType: string, portCount: number): number => {
  const dims = getDeviceDimensions(deviceType);
  if (deviceType === 'pc' || deviceType === 'iot') return dims.height;
  const numRows = Math.ceil(portCount / 8);
  return 80 + numRows * 14 + 5;
};

// Device type checks
export const isPcLike = (type: string): boolean => type === 'pc' || type === 'iot';
export const isSwitchDevice = (type: string): boolean => type === 'switchL2' || type === 'switchL3' || type === 'switch';
export const isRouterDevice = (type: string): boolean => type === 'router';

// Port type detection
export type PortType = 'ethernet' | 'console' | 'gigabit' | 'unknown';

export const getPortType = (portId: string): PortType => {
  const lower = portId.toLowerCase();
  if (lower === 'console') return 'console';
  if (lower.startsWith('gi')) return 'gigabit';
  if (lower.startsWith('fa') || lower.startsWith('eth')) return 'ethernet';
  return 'unknown';
};
