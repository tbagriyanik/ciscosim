import { createInitialState, createInitialRouterState } from './initialState';
import type { SwitchState, CableInfo } from './types';
import type { CanvasDevice, CanvasConnection, CanvasNote, DeviceType } from '@/components/network/networkTopology.types';
import { generateRandomLinkLocalIpv4 } from './linkLocal';
import macExampleA from './examples/40-sayfa2-mac-tablosu.json';
import dnsHttpExample from './examples/59-sayfa3-dns-http.json';
import macExampleB from './examples/69-sayfa4-mac-tablosu.json';
import ipConfigExample from './examples/76-sayfa1-ip-yapilandirma.json';
import dhcpExample from './examples/87-sayfa6-dhcp.json';
import trunk2SwitchExample from './examples/166-sayfa5uygulama-2switchTrunk.json';

type ProjectData = {
  version: string;
  timestamp: string;
  devices: { id: string; state: SwitchState }[];
  deviceOutputs: { id: string; outputs: any[] }[];
  pcOutputs: { id: string; outputs: any[] }[];
  pcHistories: { id: string; history: string[] }[];
  topology: {
    devices: CanvasDevice[];
    connections: CanvasConnection[];
    notes: CanvasNote[];
  };
  cableInfo: CableInfo;
  activeDeviceId: string;
  activeDeviceType: DeviceType;
  activeTab: 'topology' | 'cmd' | 'terminal' | 'ports' | 'vlan' | 'security';
  zoom: number;
  pan: { x: number; y: number };
};

const defaultCableInfo: CableInfo = {
  connected: true,
  cableType: 'straight',
  sourceDevice: 'pc',
  targetDevice: 'switchL2'
};

const normalizeDeviceType = (type: string): CanvasDevice['type'] => {
  if (type === 'switch') return 'switchL2';
  if (type === 'switchL2' || type === 'switchL3' || type === 'pc' || type === 'iot' || type === 'router') return type;
  return 'pc';
};

const isValidIpv4 = (value?: string) => {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    const n = Number(part);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
};

const applyLinkLocalToUnconfiguredHosts = (devices: CanvasDevice[]): CanvasDevice[] => {
  const usedIps = new Set<string>();
  devices.forEach((device) => {
    if (isValidIpv4(device.ip) && device.ip !== '0.0.0.0') {
      usedIps.add(device.ip);
    }
  });

  return devices.map((device) => {
    if (device.type !== 'pc' && device.type !== 'iot') return device;
    if (isValidIpv4(device.ip) && device.ip !== '0.0.0.0') return device;

    const linkLocalIp = generateRandomLinkLocalIpv4(usedIps);
    usedIps.add(linkLocalIp);
    return {
      ...device,
      ip: linkLocalIp,
      subnet: device.subnet || '255.255.0.0',
      gateway: device.gateway || '0.0.0.0',
      dns: device.dns || '0.0.0.0',
      ipConfigMode: device.type === 'iot' ? (device.ipConfigMode || 'dhcp') : device.ipConfigMode
    };
  });
};

const ensureProjectData = (source: any): ProjectData => {
  const partial = source || {};
  return {
    version: partial.version ?? '1.0',
    timestamp: partial.timestamp ?? new Date().toISOString(),
    devices: partial.devices ?? [],
    deviceOutputs: partial.deviceOutputs ?? [],
    pcOutputs: partial.pcOutputs ?? [],
    pcHistories: partial.pcHistories ?? [],
    topology: {
      devices: applyLinkLocalToUnconfiguredHosts((partial.topology?.devices ?? []).map((device: CanvasDevice) => ({
        ...device,
        type: normalizeDeviceType(device.type),
      }))),
      connections: partial.topology?.connections ?? [],
      notes: partial.topology?.notes ?? []
    },
    cableInfo: partial.cableInfo
      ? {
        ...partial.cableInfo,
        sourceDevice: normalizeDeviceType(partial.cableInfo.sourceDevice),
        targetDevice: normalizeDeviceType(partial.cableInfo.targetDevice),
      }
      : defaultCableInfo,
    activeDeviceId: partial.activeDeviceId ?? 'switch-1',
    activeDeviceType: normalizeDeviceType(partial.activeDeviceType ?? 'switchL2'),
    activeTab: partial.activeTab ?? 'topology',
    zoom: partial.zoom ?? 1,
    pan: partial.pan ?? { x: 0, y: 0 }
  };
};

export type ExampleProjectLevel = 'basic' | 'intermediate' | 'advanced';

export type ExampleProject = {
  id: string;
  tag: string;
  title: string;
  description: string;
  detail?: string;
  data: ProjectData;
  level: ExampleProjectLevel;
};

const macExampleAData: ProjectData = ensureProjectData(macExampleA);
const dnsHttpExampleData: ProjectData = ensureProjectData(dnsHttpExample);
const macExampleBData: ProjectData = ensureProjectData(macExampleB);
const ipConfigExampleData: ProjectData = ensureProjectData(ipConfigExample);
const dhcpExampleData: ProjectData = ensureProjectData(dhcpExample);
const trunk2SwitchData: ProjectData = ensureProjectData(trunk2SwitchExample);

let exampleMacCounter = 0;
const nextExampleMac = () => {
  exampleMacCounter += 1;
  const base = (0x00e0f701a100 + exampleMacCounter).toString(16).padStart(12, '0').toUpperCase();
  return `${base.slice(0, 4)}.${base.slice(4, 8)}.${base.slice(8, 12)}`;
};

const createSwitchDevice = (id: string, name: string, x: number, y: number): CanvasDevice => ({
  id,
  type: 'switchL2',
  name,
  x,
  y,
  ip: '',
  macAddress: nextExampleMac(),
  status: 'online',
  switchModel: 'WS-C2960-24TT-L',
  ports: [
    { id: 'console', label: 'Console', status: 'disconnected' as const },
    ...Array.from({ length: 24 }, (_, i) => ({ id: `fa0/${i + 1}`, label: `Fa0/${i + 1}`, status: 'disconnected' as const })),
    { id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const },
    { id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const }
  ]
});

const createPcDevice = (id: string, name: string, x: number, y: number, ip: string, vlan: number, gateway?: string): CanvasDevice => ({
  id,
  type: 'pc',
  name,
  x,
  y,
  ip,
  vlan,
  gateway,
  macAddress: nextExampleMac(),
  status: 'online',
  ports: [
    { id: 'eth0', label: 'Eth0', status: 'disconnected' as const },
    { id: 'com1', label: 'COM1', status: 'disconnected' as const }
  ]
});

const createRouterDevice = (id: string, name: string, x: number, y: number): CanvasDevice => {
  const baseMac = nextExampleMac();
  const macNumber = parseInt(baseMac.replace(/\./g, ''), 16);

  const formatMacFromNumber = (value: number): string => {
    const base = value.toString(16).padStart(12, '0').toUpperCase();
    return `${base.slice(0, 4)}.${base.slice(4, 8)}.${base.slice(8, 12)}`;
  };

  return {
    id,
    type: 'router',
    name,
    x,
    y,
    ip: '',
    macAddress: baseMac, // Base MAC for router
    status: 'online',
    ports: [
      { id: 'console', label: 'Console', status: 'disconnected' as const },
      { id: 'gi0/0', label: 'Gi0/0', status: 'disconnected' as const, macAddress: formatMacFromNumber(macNumber) },
      { id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const, macAddress: formatMacFromNumber(macNumber + 1) },
      { id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const, macAddress: formatMacFromNumber(macNumber + 2) },
      { id: 'gi0/3', label: 'Gi0/3', status: 'disconnected' as const, macAddress: formatMacFromNumber(macNumber + 3) }
    ]
  };
};

const createIotDevice = (id: string, name: string, x: number, y: number, sensorType: 'temperature' | 'humidity' | 'motion' | 'light' | 'sound'): CanvasDevice => ({
  id,
  type: 'iot',
  name,
  x,
  y,
  ip: '',
  macAddress: nextExampleMac(),
  status: 'online',
  iot: {
    sensorType,
    collaborationEnabled: true,
    dataStore: ''
  },
  wifi: {
    enabled: true,
    ssid: '',
    security: 'open',
    password: '',
    channel: '2.4GHz',
    mode: 'client'
  },
  ports: [
    { id: 'wlan0', label: 'WLAN0', status: 'disconnected' as const, wifi: { ssid: '', security: 'open', channel: '2.4GHz', mode: 'client' } }
  ]
});

const connectPorts = (
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  sourceDeviceId: string,
  sourcePort: string,
  targetDeviceId: string,
  targetPort: string,
  cableType: 'straight' | 'crossover' | 'console' = 'straight'
) => {
  connections.push({
    id: `${sourceDeviceId}-${sourcePort}-${targetDeviceId}-${targetPort}`,
    sourceDeviceId,
    sourcePort,
    targetDeviceId,
    targetPort,
    cableType,
    active: true
  });

  devices.forEach(device => {
    if (device.id !== sourceDeviceId && device.id !== targetDeviceId) return;
    device.ports = device.ports.map(port => {
      const isMatch = (device.id === sourceDeviceId && port.id === sourcePort) ||
        (device.id === targetDeviceId && port.id === targetPort);
      return isMatch ? { ...port, status: 'connected' as const } : port;
    });
  });
};

const baseProjectData = (devices: CanvasDevice[], connections: CanvasConnection[], notes: CanvasNote[], deviceStates: { id: string; state: SwitchState }[]): ProjectData => ({
  version: '1.0',
  timestamp: new Date().toISOString(),
  devices: deviceStates,
  deviceOutputs: [],
  pcOutputs: [],
  pcHistories: [],
  topology: {
    devices: applyLinkLocalToUnconfiguredHosts(devices),
    connections,
    notes
  },
  cableInfo: {
    connected: true,
    cableType: 'straight',
    sourceDevice: 'pc',
    targetDevice: 'switchL2'
  },
  activeDeviceId: deviceStates[0]?.id || 'switch-1',
  activeDeviceType: 'switchL2',
  activeTab: 'topology',
  zoom: 1.0,
  pan: { x: 0, y: 0 }
});

export const exampleProjects = (language: 'tr' | 'en'): ExampleProject[] => {
  const isTr = language === 'tr';

  // 🌍 Dil Desteği / Language Support
  // ✅ Türkçe - Tam destek / Full support
  // ✅ English - Tam destek / Full support

  // Example 11: Wireless Lab (Intermediate) - 2 PCs, 1 Router
  const wifiDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 220, '192.168.1.10', 1),
    createRouterDevice('router-1', 'R1', 350, 220),
    createPcDevice('pc-2', 'PC-2', 650, 220, '192.168.1.11', 1)
  ];

  // Example 13: IoT WiFi Lab - 3 IoT devices, 1 PC, 1 Router (WiFi with connected IoT)
  const iotWifiDevices = [
    createPcDevice('pc-1', 'PC-1', 50, 100, '192.168.1.10', 1),
    createRouterDevice('router-1', 'R1', 300, 100),
    createIotDevice('iot-1', 'IoT-Temp', 50, 280, 'temperature'),
    createIotDevice('iot-2', 'IoT-Humidity', 200, 320, 'humidity'),
    createIotDevice('iot-3', 'IoT-Motion', 350, 280, 'motion')
  ];

  // Configure R1 for WiFi with open security
  iotWifiDevices[1].wifi = {
    enabled: true,
    ssid: 'IoT-Network',
    security: 'open',
    password: '',
    channel: '2.4GHz',
    mode: 'ap'
  };
  iotWifiDevices[1].ports = [
    {
      id: 'wlan0',
      label: 'WLAN0',
      status: 'connected' as const,
      ipAddress: '192.168.1.1',
      subnetMask: '255.255.255.0',
      wifi: {
        ssid: 'IoT-Network',
        security: 'open',
        channel: '2.4GHz',
        mode: 'ap'
      }
    },
    ...iotWifiDevices[1].ports
  ];

  // Configure PC-1 for WiFi (Client mode, open)
  iotWifiDevices[0].wifi = {
    enabled: true,
    ssid: 'IoT-Network',
    security: 'open',
    password: '',
    channel: '2.4GHz',
    mode: 'client'
  };
  iotWifiDevices[0].ip = '192.168.1.10';
  iotWifiDevices[0].subnet = '255.255.255.0';
  iotWifiDevices[0].gateway = '192.168.1.1';

  // Configure IoT devices to connect to the router's WiFi with IP addresses
  iotWifiDevices[2].wifi = {
    enabled: true,
    ssid: 'IoT-Network',
    security: 'open',
    password: '',
    channel: '2.4GHz',
    mode: 'client'
  };
  iotWifiDevices[2].ip = '192.168.1.101';
  iotWifiDevices[2].subnet = '255.255.255.0';
  iotWifiDevices[2].gateway = '192.168.1.1';
  iotWifiDevices[2].ports[0].status = 'connected';
  iotWifiDevices[2].ports[0].ipAddress = '192.168.1.101';
  iotWifiDevices[2].ports[0].subnetMask = '255.255.255.0';
  iotWifiDevices[2].ports[0].wifi = { ssid: 'IoT-Network', security: 'open', channel: '2.4GHz', mode: 'client' };

  iotWifiDevices[3].wifi = {
    enabled: true,
    ssid: 'IoT-Network',
    security: 'open',
    password: '',
    channel: '2.4GHz',
    mode: 'client'
  };
  iotWifiDevices[3].ip = '192.168.1.102';
  iotWifiDevices[3].subnet = '255.255.255.0';
  iotWifiDevices[3].gateway = '192.168.1.1';
  iotWifiDevices[3].ports[0].status = 'connected';
  iotWifiDevices[3].ports[0].ipAddress = '192.168.1.102';
  iotWifiDevices[3].ports[0].subnetMask = '255.255.255.0';
  iotWifiDevices[3].ports[0].wifi = { ssid: 'IoT-Network', security: 'open', channel: '2.4GHz', mode: 'client' };

  iotWifiDevices[4].wifi = {
    enabled: true,
    ssid: 'IoT-Network',
    security: 'open',
    password: '',
    channel: '2.4GHz',
    mode: 'client'
  };
  iotWifiDevices[4].ip = '192.168.1.103';
  iotWifiDevices[4].subnet = '255.255.255.0';
  iotWifiDevices[4].gateway = '192.168.1.1';
  iotWifiDevices[4].ports[0].status = 'connected';
  iotWifiDevices[4].ports[0].ipAddress = '192.168.1.103';
  iotWifiDevices[4].ports[0].subnetMask = '255.255.255.0';
  iotWifiDevices[4].ports[0].wifi = { ssid: 'IoT-Network', security: 'open', channel: '2.4GHz', mode: 'client' };

  const iotWifiConnections: CanvasConnection[] = [];
  const iotWifiNotes: CanvasNote[] = [
    {
      id: 'iot-wifi-note',
      text: isTr
        ? 'IoT WiFi Laboratuvarı:\n1) R1 (Router) wlan0 üzerinde AP modunda SSID: IoT-Network (Open) yayınlar.\n2) PC-1 kablosuz ağa (WiFi Client) bağlıdır.\n3) 3 IoT cihazı (Sıcaklık, Nem, Hareket) WiFi üzerinden bağlıdır.\n4) PC-1 üzerinde http 192.168.1.1 ile WiFi panelinden IoT cihazlarını yönetin.\n5) PC-1 > ping 192.168.1.1 ile bağlantıyı test edin.\n6) PC-1 > http http://iot-panel ile cihaz kontrol paneline ulaşınız.'
        : 'IoT WiFi Lab:\n1) R1 (Router) broadcasts SSID: IoT-Network (Open) on wlan0 in AP mode.\n2) PC-1 is connected wirelessly (WiFi Client).\n3) 3 IoT devices (Temperature, Humidity, Motion) connected via WiFi.\n4) Manage IoT devices from PC-1 WiFi panel via http 192.168.1.1.\n5) Test connectivity with PC-1 > ping 192.168.1.1.\n6) Access device control panel via PC-1 > http http://iot-panel',
      x: 500,
      y: 80,
      width: 450,
      height: 200,
      color: '#10b981',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];

  const iotWifiR1State = createInitialRouterState();
  iotWifiR1State.hostname = 'R1';
  // Update router port MAC addresses (already set by createInitialRouterPorts)
  iotWifiR1State.ports['wlan0'] = {
    ...iotWifiR1State.ports['wlan0'],
    status: 'connected',
    shutdown: false,
    ipAddress: '192.168.1.1',
    subnetMask: '255.255.255.0',
    wifi: {
      ssid: 'IoT-Network',
      security: 'open',
      password: '',
      channel: '2.4GHz',
      mode: 'ap'
    }
  };
  iotWifiR1State.ports['wlan0'].wifi!.mode = 'ap';

  // Add DHCP service for WiFi clients
  iotWifiR1State.services = {
    ...iotWifiR1State.services,
    dhcp: {
      enabled: true,
      pools: [{
        poolName: 'iot-pool',
        defaultGateway: '192.168.1.1',
        dnsServer: '8.8.8.8',
        startIp: '192.168.1.100',
        subnetMask: '255.255.255.0',
        maxUsers: 50
      }]
    }
  };

  // Update running config
  iotWifiR1State.runningConfig = [
    '!',
    'hostname R1',
    '!',
    'interface WLAN0',
    ' ip address 192.168.1.1 255.255.255.0',
    ' no shutdown',
    ' wifi-mode ap',
    ' ssid IoT-Network',
    '!',
    'ip dhcp pool iot-pool',
    ' network 192.168.1.0 255.255.255.0',
    ' default-router 192.168.1.1',
    ' dns-server 8.8.8.8',
    '!',
    'line con 0',
    'line aux 0',
    'line vty 0 4',
    ' login',
    '!',
    'end'
  ];

  // Example 14: Greenhouse (Sera) IoT Lab - Environmental monitoring
  const greenhouseDevices = [
    createPcDevice('pc-1', 'PC-1', 50, 80, '192.168.2.10', 1),
    createRouterDevice('router-1', 'R1', 300, 80),
    createIotDevice('iot-temp', 'Sera-Sicaklik', 30, 300, 'temperature'),
    createIotDevice('iot-hum', 'Sera-Nem', 180, 340, 'humidity'),
    createIotDevice('iot-light', 'Sera-Isik', 330, 300, 'light'),
    createIotDevice('iot-motion', 'Sera-Kapi', 480, 320, 'motion')
  ];

  // Configure R1 for Greenhouse WiFi with WPA2 security
  greenhouseDevices[1].wifi = {
    enabled: true,
    ssid: 'GreenHouse-Network',
    security: 'wpa2',
    password: 'sera2026',
    channel: '2.4GHz',
    mode: 'ap'
  };
  greenhouseDevices[1].ports = [
    {
      id: 'wlan0',
      label: 'WLAN0',
      status: 'connected',
      vlan: 1,
      ipAddress: '192.168.2.1',
      subnetMask: '255.255.255.0',
      wifi: {
        ssid: 'GreenHouse-Network',
        security: 'wpa2',
        password: 'sera2026',
        channel: '2.4GHz',
        mode: 'ap'
      }
    },
    {
      id: 'console',
      label: 'Console',
      status: 'disconnected'
    },
    {
      id: 'gi0/0',
      label: 'Gi0/0',
      status: 'disconnected',
      macAddress: greenhouseDevices[1].ports.find(p => p.id === 'gi0/0')?.macAddress
    },
    {
      id: 'gi0/1',
      label: 'Gi0/1',
      status: 'disconnected',
      macAddress: greenhouseDevices[1].ports.find(p => p.id === 'gi0/1')?.macAddress
    },
    {
      id: 'gi0/2',
      label: 'Gi0/2',
      status: 'disconnected',
      macAddress: greenhouseDevices[1].ports.find(p => p.id === 'gi0/2')?.macAddress
    },
    {
      id: 'gi0/3',
      label: 'Gi0/3',
      status: 'disconnected',
      macAddress: greenhouseDevices[1].ports.find(p => p.id === 'gi0/3')?.macAddress
    }
  ];

  // Configure PC-1 for Greenhouse WiFi
  greenhouseDevices[0].wifi = {
    enabled: true,
    ssid: 'GreenHouse-Network',
    security: 'wpa2',
    password: 'sera2026',
    channel: '2.4GHz',
    mode: 'client'
  };
  greenhouseDevices[0].ip = '192.168.2.10';
  greenhouseDevices[0].subnet = '255.255.255.0';
  greenhouseDevices[0].gateway = '192.168.2.1';

  // Configure IoT sensors for greenhouse
  greenhouseDevices[2].wifi = {
    enabled: true,
    ssid: 'GreenHouse-Network',
    security: 'wpa2',
    password: 'sera2026',
    channel: '2.4GHz',
    mode: 'client'
  };
  greenhouseDevices[2].ip = '192.168.2.101';
  greenhouseDevices[2].subnet = '255.255.255.0';
  greenhouseDevices[2].gateway = '192.168.2.1';
  greenhouseDevices[2].ports[0].status = 'connected';
  greenhouseDevices[2].ports[0].ipAddress = '192.168.2.101';
  greenhouseDevices[2].ports[0].subnetMask = '255.255.255.0';
  greenhouseDevices[2].ports[0].wifi = { ssid: 'GreenHouse-Network', security: 'wpa2', channel: '2.4GHz', mode: 'client' };

  greenhouseDevices[3].wifi = {
    enabled: true,
    ssid: 'GreenHouse-Network',
    security: 'wpa2',
    password: 'sera2026',
    channel: '2.4GHz',
    mode: 'client'
  };
  greenhouseDevices[3].ip = '192.168.2.102';
  greenhouseDevices[3].subnet = '255.255.255.0';
  greenhouseDevices[3].gateway = '192.168.2.1';
  greenhouseDevices[3].ports[0].status = 'connected';
  greenhouseDevices[3].ports[0].ipAddress = '192.168.2.102';
  greenhouseDevices[3].ports[0].subnetMask = '255.255.255.0';
  greenhouseDevices[3].ports[0].wifi = { ssid: 'GreenHouse-Network', security: 'wpa2', channel: '2.4GHz', mode: 'client' };

  greenhouseDevices[4].wifi = {
    enabled: true,
    ssid: 'GreenHouse-Network',
    security: 'wpa2',
    password: 'sera2026',
    channel: '2.4GHz',
    mode: 'client'
  };
  greenhouseDevices[4].ip = '192.168.2.103';
  greenhouseDevices[4].subnet = '255.255.255.0';
  greenhouseDevices[4].gateway = '192.168.2.1';
  greenhouseDevices[4].ports[0].status = 'connected';
  greenhouseDevices[4].ports[0].ipAddress = '192.168.2.103';
  greenhouseDevices[4].ports[0].subnetMask = '255.255.255.0';
  greenhouseDevices[4].ports[0].wifi = { ssid: 'GreenHouse-Network', security: 'wpa2', channel: '2.4GHz', mode: 'client' };

  greenhouseDevices[5].wifi = {
    enabled: true,
    ssid: 'GreenHouse-Network',
    security: 'wpa2',
    password: 'sera2026',
    channel: '2.4GHz',
    mode: 'client'
  };
  greenhouseDevices[5].ip = '192.168.2.104';
  greenhouseDevices[5].subnet = '255.255.255.0';
  greenhouseDevices[5].gateway = '192.168.2.1';
  greenhouseDevices[5].ports[0].status = 'connected';
  greenhouseDevices[5].ports[0].ipAddress = '192.168.2.104';
  greenhouseDevices[5].ports[0].subnetMask = '255.255.255.0';
  greenhouseDevices[5].ports[0].wifi = { ssid: 'GreenHouse-Network', security: 'wpa2', channel: '2.4GHz', mode: 'client' };

  const greenhouseConnections: CanvasConnection[] = [];
  const greenhouseNotes: CanvasNote[] = [
    {
      id: 'greenhouse-note',
      text: isTr
        ? '🌱 AKILLI SERA KROKİSİ:\n1) R1 (Router) WPA2 korumalı WiFi ağı: GreenHouse-Network (şifre: sera2026)\n2) 4 IoT Sensör: Sıcaklık (2.101), Nem (2.102), Işık (2.103), Kapı/Hareket (2.104)\n3) PC-1 ile WiFi panelinden (http 192.168.2.1) sensörleri izleyin\n4) IoT Panel: http://iot-panel (admin/admin) ile cihazları yönetin\n5) Görev: ping 192.168.2.101 ile sensör erişimini test edin'
        : '🌱 SMART GREENHOUSE SKETCH:\n1) R1 (Router) WPA2 secured WiFi: GreenHouse-Network (password: sera2026)\n2) 4 IoT Sensors: Temperature (.101), Humidity (.102), Light (.103), Door/Motion (.104)\n3) Monitor sensors from PC-1 via WiFi panel (http 192.168.2.1)\n4) IoT Panel: http://iot-panel (admin/admin) to manage devices\n5) Task: Test sensor access with ping 192.168.2.101',
      x: 500,
      y: 60,
      width: 480,
      height: 180,
      color: '#10b981',
      font: 'verdana',
      fontSize: 12,
      opacity: 0.75
    }
  ];

  const greenhouseR1State = createInitialRouterState();
  greenhouseR1State.hostname = 'R1-SERA';
  greenhouseR1State.ports['wlan0'] = {
    ...greenhouseR1State.ports['wlan0'],
    status: 'connected',
    shutdown: false,
    ipAddress: '192.168.2.1',
    subnetMask: '255.255.255.0',
    wifi: {
      ssid: 'GreenHouse-Network',
      security: 'wpa2',
      password: 'sera2026',
      channel: '2.4GHz',
      mode: 'ap'
    }
  };
  greenhouseR1State.ports['wlan0'].wifi!.mode = 'ap';

  // Add DHCP service for greenhouse WiFi clients
  greenhouseR1State.services = {
    ...greenhouseR1State.services,
    dhcp: {
      enabled: true,
      pools: [{
        poolName: 'greenhouse-pool',
        defaultGateway: '192.168.2.1',
        dnsServer: '8.8.8.8',
        startIp: '192.168.2.100',
        subnetMask: '255.255.255.0',
        maxUsers: 50
      }]
    }
  };

  greenhouseR1State.runningConfig = [
    '!',
    'hostname R1-SERA',
    '!',
    'interface WLAN0',
    ' ip address 192.168.2.1 255.255.255.0',
    ' no shutdown',
    ' wifi-mode ap',
    ' ssid GreenHouse-Network',
    ' security wpa2',
    ' password sera2026',
    '!',
    'ip dhcp pool greenhouse-pool',
    ' network 192.168.2.0 255.255.255.0',
    ' default-router 192.168.2.1',
    ' dns-server 8.8.8.8',
    '!',
    'line con 0',
    'line aux 0',
    'line vty 0 4',
    ' login',
    '!',
    'end'
  ];

  // Configure R1 for WiFi
  wifiDevices[1].wifi = {
    enabled: true,
    ssid: 'HomeWiFi',
    security: 'open',
    password: '',
    channel: '2.4GHz',
    mode: 'ap'
  };
  wifiDevices[1].ports = [
    {
      id: 'wlan0',
      label: 'WLAN0',
      status: 'connected' as const,
      ipAddress: '192.168.1.1',
      subnetMask: '255.255.255.0',
      wifi: {
        ssid: 'HomeWiFi',
        security: 'open',
        channel: '2.4GHz',
        mode: 'ap'
      }
    },
    ...wifiDevices[1].ports
  ];
  // Configure PCs for WiFi (Clients) - Keep static IPs for now
  wifiDevices[0].wifi = {
    enabled: true,
    ssid: 'HomeWiFi',
    security: 'open',
    password: '',
    channel: '2.4GHz',
    mode: 'client'
  };
  wifiDevices[2].wifi = {
    enabled: true,
    ssid: 'HomeWiFi',
    security: 'open',
    password: '',
    channel: '2.4GHz',
    mode: 'client'
  };

  const wifiConnections: CanvasConnection[] = [];
  const wifiNotes: CanvasNote[] = [
    {
      id: 'wifi-note',
      text: isTr
        ? 'WiFi Laboratuvarı (Orta Seviye):\n1) R1 (Router) wlan0 üzerinde AP modunda SSID: HomeWiFi yayınlar.\n2) PC-1 ve PC-2 kablosuz ağa (SSID match) bağlıdır.\n3) Tüm cihazlar aynı subnet (192.168.1.x) içindedir.\n4) PC-1 > ping 192.168.1.11 ile kablosuz iletişimi test edin.\n5) PC-1 > http 192.168.1.1 ile Wifi kontrol panelini görün.'
        : 'WiFi Lab (Intermediate):\n1) R1 (Router) broadcasts SSID: HomeWiFi on wlan0 in AP mode.\n2) PC-1 and PC-2 are connected wirelessly (SSID match).\n3) All devices are on the same subnet (192.168.1.x).\n4) Test wireless connectivity with PC-1 > ping 192.168.1.11.\n5) PC-1 > http 192.168.1.1 for Wifi control panel.',
      x: 300,
      y: 400,
      width: 450,
      height: 180,
      color: '#f59e0b',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];
  const wifiR1State = createInitialRouterState();
  wifiR1State.hostname = 'R1';
  wifiR1State.ports['wlan0'] = {
    ...wifiR1State.ports['wlan0'],
    status: 'connected',
    shutdown: false,
    ipAddress: '192.168.1.1',
    subnetMask: '255.255.255.0',
    wifi: {
      ssid: 'HomeWiFi',
      security: 'open',
      password: '',
      channel: '2.4GHz',
      mode: 'ap'
    }
  };
  wifiR1State.ports['wlan0'].wifi!.mode = 'ap';

  // Add DHCP service to R1 for WiFi clients
  wifiR1State.services = {
    ...wifiR1State.services,
    dhcp: {
      enabled: true,
      pools: [{
        poolName: 'wifi-pool',
        defaultGateway: '192.168.1.1',
        dnsServer: '8.8.8.8',
        startIp: '192.168.1.100',
        subnetMask: '255.255.255.0',
        maxUsers: 50
      }]
    }
  };

  // Example 12: Router DHCP (2 PCs + 1 Router)
  const routerDhcpDevices = [
    createPcDevice('pc-1', 'PC-1', 110, 140, '0.0.0.0', 1),
    createRouterDevice('router-1', 'R1', 420, 200),
    createPcDevice('pc-2', 'PC-2', 110, 290, '0.0.0.0', 1)
  ];
  routerDhcpDevices[0].ipConfigMode = 'dhcp';
  routerDhcpDevices[1].ipConfigMode = 'static';
  routerDhcpDevices[2].ipConfigMode = 'dhcp';

  const routerDhcpConnections: CanvasConnection[] = [];
  connectPorts(routerDhcpDevices, routerDhcpConnections, 'pc-1', 'eth0', 'router-1', 'gi0/0', 'crossover');
  connectPorts(routerDhcpDevices, routerDhcpConnections, 'pc-2', 'eth0', 'router-1', 'gi0/1', 'crossover');

  const routerDhcpNotes: CanvasNote[] = [
    {
      id: 'router-dhcp-note',
      text: isTr
        ? 'Router DHCP Kurulumu (2 PC + 1 Router):\n1) R1> en\n2) conf t\n3) int gi0/0 -> ip address 192.168.10.1 255.255.255.0 -> no shut\n4) ip dhcp pool LAN\n5) network 192.168.10.0 255.255.255.0\n6) default-router 192.168.10.1\n7) dns-server 8.8.8.8\n8) PC-1 ve PC-2: IP mode DHCP, ardından ipconfig /renew\nBeklenen: PC’ler 192.168.10.100+ aralığından IP alır.'
        : 'Router DHCP Setup (2 PCs + 1 Router):\n1) R1> en\n2) conf t\n3) int gi0/0 -> ip address 192.168.10.1 255.255.255.0 -> no shut\n4) ip dhcp pool LAN\n5) network 192.168.10.0 255.255.255.0\n6) default-router 192.168.10.1\n7) dns-server 8.8.8.8\n8) PC-1 and PC-2: set IP mode DHCP, then run ipconfig /renew\nExpected: PCs receive addresses from 192.168.10.100+ range.',
      x: 610,
      y: 40,
      width: 430,
      height: 220,
      color: '#0ea5e9',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];

  const routerDhcpR1 = createInitialRouterState();
  routerDhcpR1.hostname = 'R1';
  routerDhcpR1.ports['gi0/0'] = {
    ...routerDhcpR1.ports['gi0/0'],
    ipAddress: '192.168.10.1',
    subnetMask: '255.255.255.0',
    status: 'connected',
    shutdown: false
  };
  routerDhcpR1.ports['gi0/1'] = {
    ...routerDhcpR1.ports['gi0/1'],
    ipAddress: '192.168.10.1',
    subnetMask: '255.255.255.0',
    status: 'connected',
    shutdown: false
  };
  routerDhcpR1.dhcpPools = {
    LAN: {
      network: '192.168.10.0',
      subnetMask: '255.255.255.0',
      defaultRouter: '192.168.10.1',
      dnsServer: '8.8.8.8',
      leaseTime: '1'
    }
  };
  routerDhcpR1.services = {
    ...routerDhcpR1.services,
    dhcp: {
      enabled: true,
      pools: [
        {
          poolName: 'LAN',
          defaultGateway: '192.168.10.1',
          dnsServer: '8.8.8.8',
          startIp: '192.168.10.100',
          subnetMask: '255.255.255.0',
          maxUsers: 50
        }
      ]
    }
  } as any;

  // Update running config to include wifi mode
  wifiR1State.runningConfig = [
    '!',
    'hostname R1',
    '!',
    'interface WLAN0',
    ' ip address 192.168.1.1 255.255.255.0',
    ' no shutdown',
    ' wifi-mode ap',
    ' ssid HomeWiFi',
    '!',
    'ip dhcp pool wifi-pool',
    ' network 192.168.1.0 255.255.255.0',
    ' default-router 192.168.1.1',
    ' dns-server 8.8.8.8',
    '!',
    'line con 0',
    'line aux 0',
    'line vty 0 4',
    ' login',
    '!',
    'end'
  ];

  // Example 1: Basic switch + passwords
  const basicDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 180, '192.168.10.10', 10),
    createPcDevice('pc-2', 'PC-2 (Console)', 40, 320, '', 1),
    createSwitchDevice('switch-1', 'SW1', 240, 220)
  ];
  const basicConnections: CanvasConnection[] = [];
  connectPorts(basicDevices, basicConnections, 'pc-1', 'eth0', 'switch-1', 'fa0/1');
  connectPorts(basicDevices, basicConnections, 'pc-2', 'com1', 'switch-1', 'console', 'console');
  const basicNotes: CanvasNote[] = [
    {
      id: 'basic-note-1',
      text: isTr
        ? 'Amaç: Konsol, VTY ve enable parolalarını ayarlayıp doğrulamak.\n1) SW1’de: enable, conf t\n2) enable secret class\n3) enable password paswd\n4) line con 0 -> password console, login\n5) line vty 0 4 -> password vty123, login\n6) int vlan 10 -> ip address 192.168.10.150 255.255.255.0\n7) write memory\n8) PC-2 (Console) ile COM1 üzerinden konsol bağlantısı kullan.\n9) PC-1 CMD ekranından "telnet 192.168.10.150" komutu ile bağlanın.'
        : 'Goal: Configure and verify console, VTY, and enable passwords.\n1) SW1: enable, conf t\n2) enable secret class\n3) enable password paswd\n4) line con 0 -> password console, login\n5) line vty 0 4 -> password vty123, login\n6) int vlan 10 -> ip address 192.168.10.150 255.255.255.0\n7) write memory\n8) Use PC-2 (Console) via COM1 to connect to console.\n9) Connect from PC-1 CMD using "telnet 192.168.10.150" command.',
      x: 600,
      y: 40,
      width: 420,
      height: 250,
      color: '#22d3ee',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];
  const basicState = createInitialState();
  basicState.hostname = 'SW1';
  basicState.security = {
    ...basicState.security,
    enableSecret: 'class',
    enablePassword: 'paswd',
    servicePasswordEncryption: true,
    consoleLine: { ...basicState.security.consoleLine, password: 'console', login: true },
    vtyLines: { ...basicState.security.vtyLines, password: 'vty123', login: true }
  };
  basicState.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  basicState.ports['vlan10'] = {
    id: 'vlan10',
    name: 'VLAN10 Interface',
    status: 'connected',
    vlan: 10,
    mode: 'access',
    duplex: 'auto',
    speed: 'auto',
    shutdown: false,
    type: 'fastethernet',
    ipAddress: '192.168.10.150',
    subnetMask: '255.255.255.0'
  };
  basicState.ports['fa0/1'] = { ...basicState.ports['fa0/1'], vlan: 10, mode: 'access', status: 'connected' };

  // Example 2: Single switch VLANs
  const vlanDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 120, '192.168.10.10', 10),
    createPcDevice('pc-2', 'PC-2', 40, 260, '192.168.20.10', 20),
    createSwitchDevice('switch-1', 'SW1', 260, 190)
  ];
  const vlanConnections: CanvasConnection[] = [];
  connectPorts(vlanDevices, vlanConnections, 'pc-1', 'eth0', 'switch-1', 'fa0/1');
  connectPorts(vlanDevices, vlanConnections, 'pc-2', 'eth0', 'switch-1', 'fa0/2');
  const vlanNotes: CanvasNote[] = [
    {
      id: 'vlan-note-1',
      text: isTr
        ? 'Amaç: VLAN 10/20 erişim portları.\n1) conf t\n2) vlan 10, name VLAN10\n3) vlan 20, name VLAN20\n4) int fa0/1 -> switchport access vlan 10\n5) int fa0/2 -> switchport access vlan 20\n6) show vlan brief ile kontrol et.'
        : 'Goal: Access VLANs 10/20.\n1) conf t\n2) vlan 10, name VLAN10\n3) vlan 20, name VLAN20\n4) int fa0/1 -> switchport access vlan 10\n5) int fa0/2 -> switchport access vlan 20\n6) verify with show vlan brief.',
      x: 600,
      y: 40,
      width: 420,
      height: 180,
      color: '#a855f7',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];
  const vlanState = createInitialState();
  vlanState.hostname = 'SW1';
  vlanState.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  vlanState.vlans[20] = { id: 20, name: 'VLAN20', status: 'active', ports: [] };
  vlanState.ports['fa0/1'] = { ...vlanState.ports['fa0/1'], vlan: 10, mode: 'access', status: 'connected' };
  vlanState.ports['fa0/2'] = { ...vlanState.ports['fa0/2'], vlan: 20, mode: 'access', status: 'connected' };

  // Example 3: Two switches trunk + VTP
  const vtpDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 220, '192.168.10.10', 10),
    createSwitchDevice('switch-1', 'SW1', 240, 140),
    createSwitchDevice('switch-2', 'SW2', 440, 260)
  ];
  const vtpConnections: CanvasConnection[] = [];
  connectPorts(vtpDevices, vtpConnections, 'pc-1', 'eth0', 'switch-2', 'fa0/1');
  connectPorts(vtpDevices, vtpConnections, 'switch-1', 'gi0/1', 'switch-2', 'gi0/1', 'crossover');
  const vtpNotes: CanvasNote[] = [
    {
      id: 'vtp-note-1',
      text: isTr
        ? 'Amaç: Trunk + VTP.\nSW1 (server): vtp mode server, vtp domain LAB\nSW2 (client): vtp mode client, vtp domain LAB\nGi0/1 trunk olmalı.\nSW1’de VLAN 10/20 aç -> SW2’ye otomatik gelmeli.\nshow interface trunk ve show vlan brief ile doğrula.'
        : 'Goal: Trunk + VTP.\nSW1 (server): vtp mode server, vtp domain LAB\nSW2 (client): vtp mode client, vtp domain LAB\nGi0/1 must be trunk.\nCreate VLAN 10/20 on SW1 -> should appear on SW2.\nVerify with show interface trunk and show vlan brief.',
      x: 600,
      y: 40,
      width: 420,
      height: 190,
      color: '#f59e0b',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];
  const vtpSw1 = createInitialState();
  vtpSw1.hostname = 'SW1';
  vtpSw1.vtpMode = 'server';
  vtpSw1.vtpDomain = 'LAB';
  vtpSw1.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  vtpSw1.vlans[20] = { id: 20, name: 'VLAN20', status: 'active', ports: [] };
  vtpSw1.ports['gi0/1'] = { ...vtpSw1.ports['gi0/1'], mode: 'trunk', allowedVlans: 'all', status: 'connected' };
  const vtpSw2 = createInitialState();
  vtpSw2.hostname = 'SW2';
  vtpSw2.vtpMode = 'client';
  vtpSw2.vtpDomain = 'LAB';
  vtpSw2.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  vtpSw2.vlans[20] = { id: 20, name: 'VLAN20', status: 'active', ports: [] };
  vtpSw2.ports['gi0/1'] = { ...vtpSw2.ports['gi0/1'], mode: 'trunk', allowedVlans: 'all', status: 'connected' };
  vtpSw2.ports['fa0/1'] = { ...vtpSw2.ports['fa0/1'], vlan: 10, mode: 'access', status: 'connected' };

  // Example 4: ROAS (conceptual)
  const roasDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 120, '192.168.10.10', 10),
    createPcDevice('pc-2', 'PC-2', 40, 260, '192.168.20.10', 20),
    createSwitchDevice('switch-1', 'SW1', 260, 190),
    createRouterDevice('router-1', 'R1', 520, 190)
  ];
  const roasConnections: CanvasConnection[] = [];
  connectPorts(roasDevices, roasConnections, 'pc-1', 'eth0', 'switch-1', 'fa0/1');
  connectPorts(roasDevices, roasConnections, 'pc-2', 'eth0', 'switch-1', 'fa0/2');
  connectPorts(roasDevices, roasConnections, 'switch-1', 'gi0/1', 'router-1', 'gi0/0', 'crossover');
  const roasSw = createInitialState();
  roasSw.hostname = 'SW1';
  roasSw.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  roasSw.vlans[20] = { id: 20, name: 'VLAN20', status: 'active', ports: [] };
  roasSw.ports['fa0/1'] = { ...roasSw.ports['fa0/1'], vlan: 10, mode: 'access', status: 'connected' };
  roasSw.ports['fa0/2'] = { ...roasSw.ports['fa0/2'], vlan: 20, mode: 'access', status: 'connected' };
  roasSw.ports['gi0/1'] = { ...roasSw.ports['gi0/1'], mode: 'trunk', allowedVlans: 'all', status: 'connected' };
  const roasRouter = createInitialRouterState();
  roasRouter.hostname = 'R1';
  roasRouter.ports['gi0/0'] = { ...roasRouter.ports['gi0/0'], status: 'connected', shutdown: false };
  roasRouter.ports['gi0/0.10'] = {
    ...roasRouter.ports['gi0/0'],
    id: 'gi0/0.10',
    vlan: 10,
    ipAddress: '192.168.10.1',
    subnetMask: '255.255.255.0'
  };
  roasRouter.ports['gi0/0.20'] = {
    ...roasRouter.ports['gi0/0'],
    id: 'gi0/0.20',
    vlan: 20,
    ipAddress: '192.168.20.1',
    subnetMask: '255.255.255.0'
  };

  const roasNotes: CanvasNote[] = [
    {
      id: 'roas-note',
      text: isTr
        ? 'ROAS adımları:\nSW1: int gi0/1 -> switchport mode trunk\nR1: int gi0/0.10 -> encapsulation dot1q 10, ip address 192.168.10.1/24\nR1: int gi0/0.20 -> encapsulation dot1q 20, ip address 192.168.20.1/24\nPC-1 VLAN10, PC-2 VLAN20.\nAynı VLAN ping başarılı; farklı VLAN ping başarısız (L2).'
        : 'ROAS steps:\nSW1: int gi0/1 -> switchport mode trunk\nR1: int gi0/0.10 -> encapsulation dot1q 10, ip address 192.168.10.1/24\nR1: int gi0/0.20 -> encapsulation dot1q 20, ip address 192.168.20.1/24\nPC-1 VLAN10, PC-2 VLAN20.\nSame-VLAN ping succeeds; different-VLAN ping fails (L2).',
      x: 600,
      y: 40,
      width: 420,
      height: 190,
      color: '#38bdf8',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];

  // Example 5: Legacy Inter-VLAN Routing (2 separate router interfaces, not trunk)
  const legacyRoutingDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 120, '192.168.0.2', 10, '192.168.0.1'),
    createPcDevice('pc-2', 'PC-2', 40, 260, '192.168.1.2', 20, '192.168.1.1'),
    createSwitchDevice('switch-1', 'SW1', 260, 190),
    createRouterDevice('router-1', 'R1', 520, 190)
  ];
  const legacyRoutingConnections: CanvasConnection[] = [];
  connectPorts(legacyRoutingDevices, legacyRoutingConnections, 'pc-1', 'eth0', 'switch-1', 'fa0/2');
  connectPorts(legacyRoutingDevices, legacyRoutingConnections, 'pc-2', 'eth0', 'switch-1', 'fa0/12');
  connectPorts(legacyRoutingDevices, legacyRoutingConnections, 'router-1', 'gi0/1', 'switch-1', 'fa0/11', 'crossover');
  connectPorts(legacyRoutingDevices, legacyRoutingConnections, 'router-1', 'gi0/0', 'switch-1', 'fa0/1', 'crossover');
  const legacyRoutingSw = createInitialState();
  legacyRoutingSw.hostname = 'SW1';
  legacyRoutingSw.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  legacyRoutingSw.vlans[20] = { id: 20, name: 'VLAN20', status: 'active', ports: [] };
  legacyRoutingSw.ports['fa0/2'] = { ...legacyRoutingSw.ports['fa0/2'], vlan: 10, mode: 'access', status: 'connected' };
  legacyRoutingSw.ports['fa0/12'] = { ...legacyRoutingSw.ports['fa0/12'], vlan: 20, mode: 'access', status: 'connected' };
  legacyRoutingSw.ports['fa0/11'] = { ...legacyRoutingSw.ports['fa0/11'], vlan: 10, mode: 'access', status: 'connected' };
  legacyRoutingSw.ports['fa0/1'] = { ...legacyRoutingSw.ports['fa0/1'], vlan: 20, mode: 'access', status: 'connected' };
  const legacyRoutingRouter = createInitialRouterState();
  legacyRoutingRouter.hostname = 'R1';
  legacyRoutingRouter.ipRouting = true;
  legacyRoutingRouter.ports['gi0/1'] = { ...legacyRoutingRouter.ports['gi0/1'], ipAddress: '192.168.0.1', subnetMask: '255.255.255.0', status: 'connected', shutdown: false };
  legacyRoutingRouter.ports['gi0/0'] = { ...legacyRoutingRouter.ports['gi0/0'], ipAddress: '192.168.1.1', subnetMask: '255.255.255.0', status: 'connected', shutdown: false };
  const legacyRoutingNotes: CanvasNote[] = [
    {
      id: 'legacy-routing-note',
      text: isTr
        ? 'Legacy Inter-VLAN Routing:\nRouter 2 ayrı fiziksel interface ile VLAN\'lara bağlanır.\nSW1: int fa0/11 -> access vlan 10\nSW1: int fa0/1 -> access vlan 20\nR1: int gi0/1 -> ip address 192.168.0.1/24 (VLAN 10 gateway)\nR1: int gi0/0 -> ip address 192.168.1.1/24 (VLAN 20 gateway)\nPC-1 gateway: 192.168.0.1, PC-2 gateway: 192.168.1.1\nFarklı VLAN\'lar arası ping başarılı (ip routing otomatik).'
        : 'Legacy Inter-VLAN Routing:\nRouter connects to VLANs with 2 separate physical interfaces.\nSW1: int fa0/11 -> access vlan 10\nSW1: int fa0/1 -> access vlan 20\nR1: int gi0/1 -> ip address 192.168.0.1/24 (VLAN 10 gateway)\nR1: int gi0/0 -> ip address 192.168.1.1/24 (VLAN 20 gateway)\nPC-1 gateway: 192.168.0.1, PC-2 gateway: 192.168.1.1\nDifferent VLAN ping succeeds (ip routing auto-enabled).',
      x: 600,
      y: 40,
      width: 440,
      height: 210,
      color: '#a855f7',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];

  // Example 6: Port-security
  const psDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 180, '192.168.1.10', 1),
    createSwitchDevice('switch-1', 'SW1', 240, 180)
  ];
  const psConnections: CanvasConnection[] = [];
  connectPorts(psDevices, psConnections, 'pc-1', 'eth0', 'switch-1', 'fa0/3');
  const psNotes: CanvasNote[] = [
    {
      id: 'ps-note-1',
      text: isTr
        ? 'Amaç: Port-security temel örnek.\nFa0/3 üzerinde enabled + sticky + max 1.\nshow port-security ile kontrol et.\nFarklı MAC görürse ihlal oluşur (shutdown).'
        : 'Goal: Basic port-security.\nFa0/3 enabled + sticky + max 1.\nVerify with show port-security.\nDifferent MAC triggers violation (shutdown).',
      x: 600,
      y: 40,
      width: 420,
      height: 170,
      color: '#f87171',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];
  const psState = createInitialState();
  psState.hostname = 'SW1';
  psState.ports['fa0/3'] = {
    ...psState.ports['fa0/3'],
    status: 'connected',
    portSecurity: { enabled: true, maxMac: 1, violation: 'shutdown', stickyMac: true }
  };

  // Example 6: Inter-VLAN Routing (L3 Switch)
  const l3RoutingDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 120, '192.168.10.10', 10),
    createPcDevice('pc-2', 'PC-2', 40, 260, '192.168.20.10', 20),
    createPcDevice('pc-3', 'PC-3', 40, 400, '192.168.30.10', 30),
    createPcDevice('pc-4', 'PC-4', 40, 540, '192.168.40.10', 40),
    createSwitchDevice('switch-1', 'L3SW1', 260, 330)
  ];
  const l3RoutingConnections: CanvasConnection[] = [];
  connectPorts(l3RoutingDevices, l3RoutingConnections, 'pc-1', 'eth0', 'switch-1', 'fa0/1');
  connectPorts(l3RoutingDevices, l3RoutingConnections, 'pc-2', 'eth0', 'switch-1', 'fa0/2');
  connectPorts(l3RoutingDevices, l3RoutingConnections, 'pc-3', 'eth0', 'switch-1', 'fa0/3');
  connectPorts(l3RoutingDevices, l3RoutingConnections, 'pc-4', 'eth0', 'switch-1', 'fa0/4');
  const l3RoutingNotes: CanvasNote[] = [
    {
      id: 'l3-routing-note',
      text: isTr
        ? 'L3 Inter-VLAN Routing:\n1) conf t\n2) ip routing\n3) interface vlan 10 -> ip address 192.168.10.1/24\n4) interface vlan 20 -> ip address 192.168.20.1/24\n5) interface vlan 30 -> ip address 192.168.30.1/24\n6) interface vlan 40 -> ip address 192.168.40.1/24\n7) show ip route ile kontrol et\nTüm VLANlar birbirine ping atabilir.'
        : 'L3 Inter-VLAN Routing:\n1) conf t\n2) ip routing\n3) interface vlan 10 -> ip address 192.168.10.1/24\n4) interface vlan 20 -> ip address 192.168.20.1/24\n5) interface vlan 30 -> ip address 192.168.30.1/24\n6) interface vlan 40 -> ip address 192.168.40.1/24\n7) verify with show ip route\nAll VLANs can ping each other.',
      x: 600,
      y: 40,
      width: 420,
      height: 200,
      color: '#22c55e',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];
  const l3RoutingState = createInitialState(undefined, 'WS-C3560-24PS');
  l3RoutingState.hostname = 'L3SW1';
  l3RoutingState.ipRouting = true;
  l3RoutingState.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  l3RoutingState.vlans[20] = { id: 20, name: 'VLAN20', status: 'active', ports: [] };
  l3RoutingState.vlans[30] = { id: 30, name: 'VLAN30', status: 'active', ports: [] };
  l3RoutingState.vlans[40] = { id: 40, name: 'VLAN40', status: 'active', ports: [] };
  l3RoutingState.ports['vlan1'] = { ...l3RoutingState.ports['vlan1'], ipAddress: '192.168.1.1', subnetMask: '255.255.255.0' };
  l3RoutingState.ports['vlan10'] = { id: 'vlan10', name: '', status: 'notconnect', vlan: 10, mode: 'access', duplex: 'auto', speed: 'auto', shutdown: false, type: 'fastethernet', ipAddress: '192.168.10.1', subnetMask: '255.255.255.0' };
  l3RoutingState.ports['vlan20'] = { id: 'vlan20', name: '', status: 'notconnect', vlan: 20, mode: 'access', duplex: 'auto', speed: 'auto', shutdown: false, type: 'fastethernet', ipAddress: '192.168.20.1', subnetMask: '255.255.255.0' };
  l3RoutingState.ports['vlan30'] = { id: 'vlan30', name: '', status: 'notconnect', vlan: 30, mode: 'access', duplex: 'auto', speed: 'auto', shutdown: false, type: 'fastethernet', ipAddress: '192.168.30.1', subnetMask: '255.255.255.0' };
  l3RoutingState.ports['vlan40'] = { id: 'vlan40', name: '', status: 'notconnect', vlan: 40, mode: 'access', duplex: 'auto', speed: 'auto', shutdown: false, type: 'fastethernet', ipAddress: '192.168.40.1', subnetMask: '255.255.255.0' };
  l3RoutingState.ports['fa0/1'] = { ...l3RoutingState.ports['fa0/1'], vlan: 10, mode: 'access', status: 'connected' };
  l3RoutingState.ports['fa0/2'] = { ...l3RoutingState.ports['fa0/2'], vlan: 20, mode: 'access', status: 'connected' };
  l3RoutingState.ports['fa0/3'] = { ...l3RoutingState.ports['fa0/3'], vlan: 30, mode: 'access', status: 'connected' };
  l3RoutingState.ports['fa0/4'] = { ...l3RoutingState.ports['fa0/4'], vlan: 40, mode: 'access', status: 'connected' };

  // Example 7: Static Routing
  const staticRoutingDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 120, '192.168.10.10', 1),
    createPcDevice('pc-2', 'PC-2', 40, 260, '192.168.20.10', 1),
    createSwitchDevice('switch-1', 'SW1', 240, 190),
    createRouterDevice('router-1', 'R1', 440, 120),
    createRouterDevice('router-2', 'R2', 440, 260),
    createSwitchDevice('switch-2', 'SW2', 640, 190)
  ];
  const staticRoutingConnections: CanvasConnection[] = [];
  connectPorts(staticRoutingDevices, staticRoutingConnections, 'pc-1', 'eth0', 'switch-1', 'fa0/1');
  connectPorts(staticRoutingDevices, staticRoutingConnections, 'pc-2', 'eth0', 'switch-2', 'fa0/1');
  connectPorts(staticRoutingDevices, staticRoutingConnections, 'switch-1', 'gi0/1', 'router-1', 'gi0/0', 'crossover');
  connectPorts(staticRoutingDevices, staticRoutingConnections, 'router-1', 'gi0/1', 'router-2', 'gi0/0', 'crossover');
  connectPorts(staticRoutingDevices, staticRoutingConnections, 'router-2', 'gi0/1', 'switch-2', 'gi0/1', 'crossover');
  const staticRoutingNotes: CanvasNote[] = [
    {
      id: 'static-routing-note',
      text: isTr
        ? 'Static Routing Lab:\nR1: ip route 192.168.20.0 255.255.255.0 192.168.1.2\nR2: ip route 192.168.10.0 255.255.255.0 192.168.1.1\nR1 Gi0/0: 192.168.1.1/24, Gi0/1: 192.168.2.1/24\nR2 Gi0/0: 192.168.2.2/24, Gi0/1: 192.168.3.1/24\nSW1 Gi0/1: 192.168.1.2/24\nSW2 Gi0/1: 192.168.3.2/24\nshow ip route ile doğrula.'
        : 'Static Routing Lab:\nR1: ip route 192.168.20.0 255.255.255.0 192.168.1.2\nR2: ip route 192.168.10.0 255.255.255.0 192.168.1.1\nR1 Gi0/0: 192.168.1.1/24, Gi0/1: 192.168.2.1/24\nR2 Gi0/0: 192.168.2.2/24, Gi0/1: 192.168.3.1/24\nSW1 Gi0/1: 192.168.1.2/24\nSW2 Gi0/1: 192.168.3.2/24\nVerify with show ip route.',
      x: 600,
      y: 40,
      width: 420,
      height: 210,
      color: '#3b82f6',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];
  const staticSw1 = createInitialState(undefined, 'WS-C3560-24PS');
  staticSw1.hostname = 'SW1';
  staticSw1.ports['vlan1'] = { ...staticSw1.ports['vlan1'], ipAddress: '192.168.1.2', subnetMask: '255.255.255.0' };
  staticSw1.ports['gi0/1'] = { ...staticSw1.ports['gi0/1'], mode: 'routed', ipAddress: '192.168.1.2', subnetMask: '255.255.255.0', status: 'connected' };
  staticSw1.ports['fa0/1'] = { ...staticSw1.ports['fa0/1'], vlan: 1, mode: 'access', status: 'connected' };

  const staticR1 = createInitialRouterState();
  staticR1.hostname = 'R1';
  staticR1.ports['gi0/0'] = { ...staticR1.ports['gi0/0'], ipAddress: '192.168.1.1', subnetMask: '255.255.255.0', status: 'connected', shutdown: false };
  staticR1.ports['gi0/1'] = { ...staticR1.ports['gi0/1'], ipAddress: '192.168.2.1', subnetMask: '255.255.255.0', status: 'connected', shutdown: false };
  staticR1.staticRoutes = [
    { destination: '192.168.20.0', subnetMask: '255.255.255.0', nextHop: '192.168.2.2', metric: 1, type: 'static' }
  ];

  const staticR2 = createInitialRouterState();
  staticR2.hostname = 'R2';
  staticR2.ports['gi0/0'] = { ...staticR2.ports['gi0/0'], ipAddress: '192.168.2.2', subnetMask: '255.255.255.0', status: 'connected', shutdown: false };
  staticR2.ports['gi0/1'] = { ...staticR2.ports['gi0/1'], ipAddress: '192.168.3.1', subnetMask: '255.255.255.0', status: 'connected', shutdown: false };
  staticR2.staticRoutes = [
    { destination: '192.168.10.0', subnetMask: '255.255.255.0', nextHop: '192.168.2.1', metric: 1, type: 'static' }
  ];

  const staticSw2 = createInitialState(undefined, 'WS-C3560-24PS');
  staticSw2.hostname = 'SW2';
  staticSw2.ports['vlan1'] = { ...staticSw2.ports['vlan1'], ipAddress: '192.168.3.2', subnetMask: '255.255.255.0' };
  staticSw2.ports['gi0/1'] = { ...staticSw2.ports['gi0/1'], mode: 'routed', ipAddress: '192.168.3.2', subnetMask: '255.255.255.0', status: 'connected' };
  staticSw2.ports['fa0/1'] = { ...staticSw2.ports['fa0/1'], vlan: 1, mode: 'access', status: 'connected' };

  // Example 8: EtherChannel
  const etherChannelDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 120, '192.168.10.10', 10),
    createPcDevice('pc-2', 'PC-2', 40, 260, '192.168.10.11', 10),
    createSwitchDevice('switch-1', 'SW1', 240, 190),
    createSwitchDevice('switch-2', 'SW2', 440, 190)
  ];
  const etherChannelConnections: CanvasConnection[] = [];
  connectPorts(etherChannelDevices, etherChannelConnections, 'pc-1', 'eth0', 'switch-1', 'fa0/1');
  connectPorts(etherChannelDevices, etherChannelConnections, 'pc-2', 'eth0', 'switch-2', 'fa0/1');
  connectPorts(etherChannelDevices, etherChannelConnections, 'switch-1', 'gi0/1', 'switch-2', 'gi0/1', 'crossover');
  connectPorts(etherChannelDevices, etherChannelConnections, 'switch-1', 'gi0/2', 'switch-2', 'gi0/2', 'crossover');
  const etherChannelNotes: CanvasNote[] = [
    {
      id: 'etherchannel-note',
      text: isTr
        ? 'EtherChannel (Link Aggregation):\nSW1: int range gi0/1-2 -> channel-group 1 mode active\nSW2: int range gi0/1-2 -> channel-group 1 mode active\nSW1: int po1 -> switchport mode trunk\nSW2: int po1 -> switchport mode trunk\nshow etherchannel summary ile doğrula\nRedundancy ve bandwidth artışı.'
        : 'EtherChannel (Link Aggregation):\nSW1: int range gi0/1-2 -> channel-group 1 mode active\nSW2: int range gi0/1-2 -> channel-group 1 mode active\nSW1: int po1 -> switchport mode trunk\nSW2: int po1 -> switchport mode trunk\nVerify with show etherchannel summary\nRedundancy and bandwidth increase.',
      x: 600,
      y: 40,
      width: 420,
      height: 190,
      color: '#f97316',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];
  const etherSw1 = createInitialState();
  etherSw1.hostname = 'SW1';
  etherSw1.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  etherSw1.ports['fa0/1'] = { ...etherSw1.ports['fa0/1'], vlan: 10, mode: 'access', status: 'connected' };
  etherSw1.ports['gi0/1'] = { ...etherSw1.ports['gi0/1'], mode: 'trunk', allowedVlans: 'all', status: 'connected', channelGroup: 1, channelMode: 'active', channelProtocol: 'lacp' };
  etherSw1.ports['gi0/2'] = { ...etherSw1.ports['gi0/2'], mode: 'trunk', allowedVlans: 'all', status: 'connected', channelGroup: 1, channelMode: 'active', channelProtocol: 'lacp' };

  const etherSw2 = createInitialState();
  etherSw2.hostname = 'SW2';
  etherSw2.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  etherSw2.ports['fa0/1'] = { ...etherSw2.ports['fa0/1'], vlan: 10, mode: 'access', status: 'connected' };
  etherSw2.ports['gi0/1'] = { ...etherSw2.ports['gi0/1'], mode: 'trunk', allowedVlans: 'all', status: 'connected', channelGroup: 1, channelMode: 'active', channelProtocol: 'lacp' };
  etherSw2.ports['gi0/2'] = { ...etherSw2.ports['gi0/2'], mode: 'trunk', allowedVlans: 'all', status: 'connected', channelGroup: 1, channelMode: 'active', channelProtocol: 'lacp' };

  // Example 9: STP Redundant Links
  const stpDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 120, '192.168.10.10', 10),
    createPcDevice('pc-2', 'PC-2', 40, 260, '192.168.10.11', 10),
    createSwitchDevice('switch-1', 'SW1', 240, 190),
    createSwitchDevice('switch-2', 'SW2', 440, 190)
  ];
  const stpConnections: CanvasConnection[] = [];
  connectPorts(stpDevices, stpConnections, 'pc-1', 'eth0', 'switch-1', 'fa0/1');
  connectPorts(stpDevices, stpConnections, 'pc-2', 'eth0', 'switch-2', 'fa0/1');
  connectPorts(stpDevices, stpConnections, 'switch-1', 'gi0/1', 'switch-2', 'gi0/1', 'crossover');
  connectPorts(stpDevices, stpConnections, 'switch-1', 'gi0/2', 'switch-2', 'gi0/2', 'crossover');
  const stpNotes: CanvasNote[] = [
    {
      id: 'stp-note',
      text: isTr
        ? 'STP Redundant Links:\nSW1: spanning-tree mode rapid-pvst\nSW1: spanning-tree priority 28672 (root bridge)\nSW2: spanning-tree priority 32768\nGi0/1 ve Gi0/2 redundant link.\nshow spanning-tree ile root bridge ve port durumlarını kontrol et\nBir link düşse diğeri devreye girer.'
        : 'STP Redundant Links:\nSW1: spanning-tree mode rapid-pvst\nSW1: spanning-tree priority 28672 (root bridge)\nSW2: spanning-tree priority 32768\nGi0/1 and Gi0/2 are redundant links.\nVerify root bridge and port states with show spanning-tree\nIf one link fails, the other takes over.',
      x: 600,
      y: 40,
      width: 420,
      height: 200,
      color: '#8b5cf6',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];
  const stpSw1 = createInitialState();
  stpSw1.hostname = 'SW1';
  stpSw1.spanningTreeMode = 'rapid-pvst';
  stpSw1.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  stpSw1.ports['fa0/1'] = { ...stpSw1.ports['fa0/1'], vlan: 10, mode: 'access', status: 'connected' };
  stpSw1.ports['gi0/1'] = { ...stpSw1.ports['gi0/1'], mode: 'trunk', allowedVlans: 'all', status: 'connected' };
  stpSw1.ports['gi0/2'] = { ...stpSw1.ports['gi0/2'], mode: 'trunk', allowedVlans: 'all', status: 'connected' };

  const stpSw2 = createInitialState();
  stpSw2.hostname = 'SW2';
  stpSw2.spanningTreeMode = 'rapid-pvst';
  stpSw2.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  stpSw2.ports['fa0/1'] = { ...stpSw2.ports['fa0/1'], vlan: 10, mode: 'access', status: 'connected' };
  stpSw2.ports['gi0/1'] = { ...stpSw2.ports['gi0/1'], mode: 'trunk', allowedVlans: 'all', status: 'connected' };
  stpSw2.ports['gi0/2'] = { ...stpSw2.ports['gi0/2'], mode: 'trunk', allowedVlans: 'all', status: 'connected' };

  // Example 10: Campus Network (Simplified)
  const campusDevices = [
    createPcDevice('pc-1', 'PC-1', 40, 120, '192.168.10.10', 10),
    createPcDevice('pc-2', 'PC-2', 40, 260, '192.168.20.10', 20),
    createSwitchDevice('switch-1', 'ACC-SW1', 240, 190),
    createRouterDevice('router-1', 'CORE-R1', 440, 190),
    createSwitchDevice('switch-2', 'ACC-SW2', 640, 190)
  ];
  const campusConnections: CanvasConnection[] = [];
  connectPorts(campusDevices, campusConnections, 'pc-1', 'eth0', 'switch-1', 'fa0/1');
  connectPorts(campusDevices, campusConnections, 'pc-2', 'eth0', 'switch-2', 'fa0/1');
  connectPorts(campusDevices, campusConnections, 'switch-1', 'gi0/1', 'router-1', 'gi0/0', 'crossover');
  connectPorts(campusDevices, campusConnections, 'router-1', 'gi0/1', 'switch-2', 'gi0/1', 'crossover');
  const campusNotes: CanvasNote[] = [
    {
      id: 'campus-note',
      text: isTr
        ? 'Campus Network (Core + Access):\nCORE-R1: ip routing\nCORE-R1: int gi0/0 -> ip address 192.168.1.1/24\nCORE-R1: int gi0/1 -> ip address 192.168.2.1/24\nACC-SW1: int gi0/1 -> switchport mode trunk\nACC-SW2: int gi0/1 -> switchport mode trunk\nACC-SW1: VLAN 10, ACC-SW2: VLAN 20\nCORE-R1 route tables ile inter-VLAN routing.'
        : 'Campus Network (Core + Access):\nCORE-R1: ip routing\nCORE-R1: int gi0/0 -> ip address 192.168.1.1/24\nCORE-R1: int gi0/1 -> ip address 192.168.2.1/24\nACC-SW1: int gi0/1 -> switchport mode trunk\nACC-SW2: int gi0/1 -> switchport mode trunk\nACC-SW1: VLAN 10, ACC-SW2: VLAN 20\nCORE-R1 inter-VLAN routing with route tables.',
      x: 600,
      y: 40,
      width: 420,
      height: 200,
      color: '#06b6d4',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];
  const campusAcc1 = createInitialState();
  campusAcc1.hostname = 'ACC-SW1';
  campusAcc1.vlans[10] = { id: 10, name: 'VLAN10', status: 'active', ports: [] };
  campusAcc1.ports['fa0/1'] = { ...campusAcc1.ports['fa0/1'], vlan: 10, mode: 'access', status: 'connected' };
  campusAcc1.ports['gi0/1'] = { ...campusAcc1.ports['gi0/1'], mode: 'trunk', allowedVlans: 'all', status: 'connected' };

  const campusCore = createInitialRouterState();
  campusCore.hostname = 'CORE-R1';
  campusCore.ipRouting = true;
  campusCore.ports['gi0/0'] = { ...campusCore.ports['gi0/0'], ipAddress: '192.168.1.1', subnetMask: '255.255.255.0', status: 'connected', shutdown: false };
  campusCore.ports['gi0/1'] = { ...campusCore.ports['gi0/1'], ipAddress: '192.168.2.1', subnetMask: '255.255.255.0', status: 'connected', shutdown: false };
  campusCore.staticRoutes = [
    { destination: '192.168.10.0', subnetMask: '255.255.255.0', nextHop: '192.168.1.2', metric: 1, type: 'static' },
    { destination: '192.168.20.0', subnetMask: '255.255.255.0', nextHop: '192.168.2.2', metric: 1, type: 'static' }
  ];

  const campusAcc2 = createInitialState();
  campusAcc2.hostname = 'ACC-SW2';
  campusAcc2.vlans[20] = { id: 20, name: 'VLAN20', status: 'active', ports: [] };
  campusAcc2.ports['fa0/1'] = { ...campusAcc2.ports['fa0/1'], vlan: 20, mode: 'access', status: 'connected' };
  campusAcc2.ports['gi0/1'] = { ...campusAcc2.ports['gi0/1'], mode: 'trunk', allowedVlans: 'all', status: 'connected' };

  // Example 12: Router SSH Lab (Basic) - 1 PC, 1 Router
  const routerSshDevices = [
    createPcDevice('pc-1', 'PC-1', 80, 220, '192.168.1.10', 1),
    createRouterDevice('router-1', 'R1', 420, 220),
  ];
  const routerSshConnections: CanvasConnection[] = [];
  connectPorts(routerSshDevices, routerSshConnections, 'pc-1', 'eth0', 'router-1', 'gi0/0', 'straight');
  const routerSshNotes: CanvasNote[] = [
    {
      id: 'router-ssh-note',
      text: isTr
        ? 'Router SSH Lab:\nR1 hazır SSH ayarlı.\nPC-1 CMD: ssh admin@192.168.1.150\nŞifre: 1234\nKontrol: show ssh\nEnable şifresi:123'
        : 'Router SSH Lab:\nR1 is preconfigured for SSH.\nPC-1 CMD: ssh admin@192.168.1.150\nPassword: 1234\nVerify: show ssh\nEnable password:123',
      x: 580,
      y: 80,
      width: 360,
      height: 170,
      color: '#22c55e',
      font: 'verdana',
      fontSize: 16,
      opacity: 0.75
    }
  ];
  const routerSshR1 = createInitialRouterState();
  routerSshR1.hostname = 'R1';
  routerSshR1.domainName = 'lab.local';
  routerSshR1.sshVersion = 2;
  routerSshR1.ports['gi0/0'] = {
    ...routerSshR1.ports['gi0/0'],
    ipAddress: '192.168.1.150',
    subnetMask: '255.255.255.0',
    status: 'connected',
    shutdown: false
  };
  routerSshR1.security = {
    ...routerSshR1.security,
    users: [
      { username: 'admin', password: '1234', privilege: 15 },
      { username: 'user', password: '1234', privilege: 15 }
    ],
    enableSecret: '123',
    vtyLines: {
      ...routerSshR1.security.vtyLines,
      login: true,
      loginLocal: true,
      transportInput: ['ssh']
    }
  };
  routerSshR1.runningConfig = [
    '!',
    'hostname R1',
    '!',
    'ip domain-name lab.local',
    'crypto key generate rsa modulus 1024',
    'ip ssh version 2',
    '!',
    'username admin privilege 15 secret 1234',
    'username user privilege 15 secret 1234',
    'enable secret 123',
    '!',
    'interface GigabitEthernet0/0',
    ' ip address 192.168.1.150 255.255.255.0',
    ' no shutdown',
    '!',
    'line vty 0 4',
    ' login local',
    ' transport input ssh',
    '!',
    'end'
  ];
  const routerSshData: ProjectData = {
    ...baseProjectData(routerSshDevices, routerSshConnections, routerSshNotes, [
      { id: 'router-1', state: routerSshR1 }
    ]),
    activeDeviceId: 'router-1',
    activeDeviceType: 'router',
    cableInfo: {
      connected: true,
      cableType: 'straight',
      sourceDevice: 'pc',
      targetDevice: 'router'
    }
  };

  return [
    {
      id: 'basic-secure',
      tag: isTr ? 'TEMEL' : 'BASIC',
      title: isTr ? 'Basit Ağ + Parolalar' : 'Basic Network + Passwords',
      description: isTr ? 'Console, VTY ve enable parolaları ayarlı, tek PC + tek switch.' : 'Console, VTY, and enable passwords with 1 PC + 1 switch.',
      detail: isTr
        ? 'enable secret: class, enable password: paswd, console: console, vty: vty123'
        : 'enable secret: class, enable password: paswd, console: console, vty: vty123',
      level: 'basic',
      data: baseProjectData(basicDevices, basicConnections, basicNotes, [{ id: 'switch-1', state: basicState }])
    },
    {
      id: 'single-vlan',
      tag: isTr ? 'VLAN' : 'VLAN',
      title: isTr ? '1 Switch VLAN' : 'Single Switch VLANs',
      description: isTr ? 'VLAN 10/20 ve iki PC erişim portu.' : 'VLAN 10/20 with two access PCs.',
      level: 'basic',
      data: baseProjectData(vlanDevices, vlanConnections, vlanNotes, [{ id: 'switch-1', state: vlanState }])
    },
    {
      id: 'trunk-vtp',
      tag: isTr ? 'TRUNK/VTP' : 'TRUNK/VTP',
      title: isTr ? '2 Switch Trunk + VTP' : 'Two Switch Trunk + VTP',
      description: isTr ? 'Gi0/1 trunk, VTP domain LAB, VLAN 10/20 hazır.' : 'Gi0/1 trunk, VTP domain LAB, VLAN 10/20 ready.',
      level: 'intermediate',
      data: baseProjectData(vtpDevices, vtpConnections, vtpNotes, [
        { id: 'switch-1', state: vtpSw1 },
        { id: 'switch-2', state: vtpSw2 }
      ])
    },
    {
      id: 'roas',
      tag: isTr ? 'ROAS' : 'ROAS',
      title: isTr ? 'ROAS (Konsept)' : 'ROAS (Concept)',
      description: isTr ? 'Switch trunk + router (subinterface notlarıyla).' : 'Switch trunk + router with ROAS notes.',
      level: 'intermediate',
      data: baseProjectData(roasDevices, roasConnections, roasNotes, [
        { id: 'switch-1', state: roasSw },
        { id: 'router-1', state: roasRouter }
      ])
    },
    {
      id: 'legacy-routing',
      tag: isTr ? 'LEGACY ROUTING' : 'LEGACY ROUTING',
      title: isTr ? 'Legacy Inter-VLAN Routing' : 'Legacy Inter-VLAN Routing',
      description: isTr ? 'Router 2 ayrı fiziksel interface ile VLAN\'lara bağlanır (trunk yok).' : 'Router connects to VLANs with 2 separate physical interfaces (no trunk).',
      detail: isTr ? '2 router interface, access portlar, ip routing otomatik' : '2 router interfaces, access ports, ip routing auto-enabled',
      level: 'intermediate',
      data: baseProjectData(legacyRoutingDevices, legacyRoutingConnections, legacyRoutingNotes, [
        { id: 'switch-1', state: legacyRoutingSw },
        { id: 'router-1', state: legacyRoutingRouter }
      ])
    },
    {
      id: 'port-security',
      tag: isTr ? 'GÜVENLİK' : 'SECURITY',
      title: isTr ? 'Port-Security' : 'Port-Security',
      description: isTr ? 'Fa0/3 üzerinde port-security hazır.' : 'Port-security enabled on Fa0/3.',
      level: 'intermediate',
      data: baseProjectData(psDevices, psConnections, psNotes, [{ id: 'switch-1', state: psState }])
    },
    {
      id: 'l3-routing',
      tag: isTr ? 'L3 ROUTING' : 'L3 ROUTING',
      title: isTr ? 'Inter-VLAN Routing (L3 Switch)' : 'Inter-VLAN Routing (L3 Switch)',
      description: isTr ? '4 VLAN, L3 switch, inter-VLAN routing aktif.' : '4 VLANs, L3 switch, inter-VLAN routing enabled.',
      detail: isTr ? 'ip routing, VLAN 10/20/30/40 SVI' : 'ip routing, VLAN 10/20/30/40 SVI',
      level: 'advanced',
      data: baseProjectData(l3RoutingDevices, l3RoutingConnections, l3RoutingNotes, [{ id: 'switch-1', state: l3RoutingState }])
    },
    {
      id: 'static-routing',
      tag: isTr ? 'ROUTING' : 'ROUTING',
      title: isTr ? 'Static Routing Lab' : 'Static Routing Lab',
      description: isTr ? '2 router, 2 switch, 2 PC, static routes.' : '2 routers, 2 switches, 2 PCs, static routes.',
      detail: isTr ? 'R1: ip route 192.168.20.0/24 192.168.2.2' : 'R1: ip route 192.168.20.0/24 192.168.2.2',
      level: 'advanced',
      data: baseProjectData(staticRoutingDevices, staticRoutingConnections, staticRoutingNotes, [
        { id: 'switch-1', state: staticSw1 },
        { id: 'router-1', state: staticR1 },
        { id: 'router-2', state: staticR2 },
        { id: 'switch-2', state: staticSw2 }
      ])
    },
    {
      id: 'etherchannel',
      tag: isTr ? 'ETHERCHANNEL' : 'ETHERCHANNEL',
      title: isTr ? 'EtherChannel Lab' : 'EtherChannel Lab',
      description: isTr ? '2 switch, LACP, link aggregation.' : '2 switches, LACP, link aggregation.',
      detail: isTr ? 'channel-group 1 mode active, Po1 trunk' : 'channel-group 1 mode active, Po1 trunk',
      level: 'advanced',
      data: baseProjectData(etherChannelDevices, etherChannelConnections, etherChannelNotes, [
        { id: 'switch-1', state: etherSw1 },
        { id: 'switch-2', state: etherSw2 }
      ])
    },
    {
      id: 'stp-redundant',
      tag: isTr ? 'STP' : 'STP',
      title: isTr ? 'STP Redundant Links' : 'STP Redundant Links',
      description: isTr ? '2 switch, redundant links, Rapid-PVST.' : '2 switches, redundant links, Rapid-PVST.',
      detail: isTr ? 'spanning-tree priority 28672' : 'spanning-tree priority 28672',
      level: 'advanced',
      data: baseProjectData(stpDevices, stpConnections, stpNotes, [
        { id: 'switch-1', state: stpSw1 },
        { id: 'switch-2', state: stpSw2 }
      ])
    },
    {
      id: 'campus-network',
      tag: isTr ? 'CAMPUS' : 'CAMPUS',
      title: isTr ? 'Campus Network' : 'Campus Network',
      description: isTr ? 'Core router + 2 access switches, routing.' : 'Core router + 2 access switches, routing.',
      detail: isTr ? 'CORE-R1 ip routing, VLAN 10/20' : 'CORE-R1 ip routing, VLAN 10/20',
      level: 'advanced',
      data: baseProjectData(campusDevices, campusConnections, campusNotes, [
        { id: 'switch-1', state: campusAcc1 },
        { id: 'router-1', state: campusCore },
        { id: 'switch-2', state: campusAcc2 }
      ])
    },
    {
      id: 'wifi-intermediate',
      tag: isTr ? 'WiFi' : 'WiFi',
      title: isTr ? 'Kablosuz Ağ (WiFi)' : 'Wireless Network (WiFi)',
      description: isTr ? 'Router AP ve iki PC kablosuz bağlantısı.' : 'Router AP and two PCs wireless connectivity.',
      detail: isTr ? 'SSID: HomeWiFi, Router AP mode' : 'SSID: HomeWiFi, Router AP mode',
      level: 'intermediate',
      data: baseProjectData(wifiDevices, wifiConnections, wifiNotes, [
        { id: 'router-1', state: wifiR1State }
      ])
    },
    {
      id: 'iot-wifi-lab',
      tag: 'IoT',
      title: isTr ? 'IoT WiFi Laboratuvarı' : 'IoT WiFi Lab',
      description: isTr ? '3 IoT cihazı (Sıcaklık, Nem, Hareket), WiFi açık PC ve Router.' : '3 IoT devices (Temp, Humidity, Motion), WiFi open PC and Router.',
      detail: isTr ? 'SSID: IoT-Network (Open), IoT cihazları WiFi panelinden yönetilebilir' : 'SSID: IoT-Network (Open), IoT devices manageable via WiFi panel',
      level: 'intermediate',
      data: baseProjectData(iotWifiDevices, iotWifiConnections, iotWifiNotes, [
        { id: 'router-1', state: iotWifiR1State }
      ])
    },
    {
      id: 'greenhouse-iot-lab',
      tag: isTr ? 'ÇEVRE' : 'ENV',
      title: isTr ? '🌱 Sera Krokisi (Akıllı Tarım)' : '🌱 Greenhouse Sketch (Smart Farm)',
      description: isTr ? '4 IoT sensör (Sıcaklık/Nem/Işık/Kapı), WPA2 WiFi, çevresel izleme.' : '4 IoT sensors (Temp/Humidity/Light/Door), WPA2 WiFi, environmental monitoring.',
      detail: isTr ? 'SSID: GreenHouse-Network (WPA2), Şifre: sera2026, IP: 192.168.2.x' : 'SSID: GreenHouse-Network (WPA2), Password: sera2026, IP: 192.168.2.x',
      level: 'intermediate',
      data: baseProjectData(greenhouseDevices, greenhouseConnections, greenhouseNotes, [
        { id: 'router-1', state: greenhouseR1State }
      ])
    },
    {
      id: 'router-ssh-1pc',
      tag: 'SSH',
      title: isTr ? 'Router SSH (1 PC + 1 Router)' : 'Router SSH (1 PC + 1 Router)',
      description: isTr ? 'PC-1 üzerinden R1 cihazına SSH ile bağlanma senaryosu.' : 'SSH access from PC-1 to router R1.',
      detail: isTr ? 'Komut: ssh admin@192.168.1.150 | parola: 1234' : 'Command: ssh admin@192.168.1.150 | password: 1234',
      level: 'basic',
      data: routerSshData
    },
    {
      id: 'router-dhcp-2pc',
      tag: 'DHCP',
      title: isTr ? 'Router DHCP (2 PC + 1 Router)' : 'Router DHCP (2 PCs + 1 Router)',
      description: isTr ? 'Router üzerinden DHCP havuzu ile iki PC’ye otomatik IP dağıtımı.' : 'Automatic IP assignment to two PCs via router DHCP pool.',
      detail: isTr ? 'R1: ip dhcp pool LAN, PC-1/PC-2: ipconfig /renew' : 'R1: ip dhcp pool LAN, PC-1/PC-2: ipconfig /renew',
      level: 'basic',
      data: baseProjectData(routerDhcpDevices, routerDhcpConnections, routerDhcpNotes, [
        { id: 'router-1', state: routerDhcpR1 }
      ])
    },
    {
      id: 'mac-table-lab',
      tag: isTr ? 'MAC' : 'MAC',
      title: isTr ? 'MAC Tablo Öğrenme' : 'MAC Table Lab',
      description: isTr
        ? 'SW1 üzerinde show mac address-table ile PC1/PC2 ve ROUTER-2 adreslerini karşılaştırın.'
        : 'Use show mac address-table on SWITCH-1 to compare the MAC entries for PC1, PC2, and ROUTER-2.',
      detail: isTr
        ? 'PC1: 00-e0-f7-01-a1-b1, PC2: 97-31-e5-97-a7-03, SW1: 042c.802b.9da9, R2: 4145.c35d.e6d1'
        : 'PC1: 00-e0-f7-01-a1-b1, PC2: 97-31-e5-97-a7-03, SW1: 042c.802b.9da9, R2: 4145.c35d.e6d1',
      level: 'basic',
      data: macExampleAData
    },
    {
      id: 'dns-http',
      tag: isTr ? 'DNS/HTTP' : 'DNS/HTTP',
      title: isTr
        ? 'DNS ve HTTP Test (Domain Name System / Hypertext Transfer Protocol - görev: isim çözümleme + web erişimi)'
        : 'DNS + HTTP Test (Domain Name System / Hypertext Transfer Protocol - task: name resolution + web access)',
      description: isTr
        ? 'PC-1 üzerinden HTTP istekleri gönderip nslookup yaparak sunucu hizmetlerini doğrulayın.'
        : 'From PC-1 send HTTP requests and use nslookup to verify server services.',
      detail: 'http 192.168.1.10 / http a10.com / nslookup a10.com',
      level: 'intermediate',
      data: dnsHttpExampleData
    },
    {
      id: 'mac-arp-lab',
      tag: isTr ? 'MAC' : 'MAC',
      title: isTr ? 'ARP ve MAC Tablo Çalışması' : 'ARP vs MAC Table',
      description: isTr
        ? 'PC terminalinden arp -a ve SWITCH-1 konsolundan show mac ile adresleri eşleştirin.'
        : 'Match ARP and show mac address-table output between PCs and SWITCH-1.',
      detail: isTr
        ? 'PC terminali: arp, arp -a | SWITCH-1#: show mac address-table'
        : 'PC terminal: arp, arp -a | SWITCH-1#: show mac address-table',
      level: 'basic',
      data: macExampleBData
    },
    {
      id: 'ip-config-lab',
      tag: isTr ? 'IP' : 'IP',
      title: isTr ? 'IP Yapılandırma Laboratuvarı' : 'IP Configuration Lab',
      description: isTr
        ? 'PC1 & PC2 aynı IP/mask ile iletişim kurarken, PC3 farklı ayarlamayla farkı keşfedin.'
        : 'Discover how identical IP/mask on PC1 & PC2 enables connectivity while PC3 differs.',
      detail: isTr
        ? 'PC1/PC2: 192.168.1.x/255.255.255.0; PC3: farklı yapılandırma, ping başarısız.'
        : 'PC1/PC2: 192.168.1.x/255.255.255.0; PC3: different config, ping fails.',
      level: 'basic',
      data: ipConfigExampleData
    },
    {
      id: 'dhcp-distribution',
      tag: isTr ? 'DHCP' : 'DHCP',
      title: isTr
        ? 'DHCP Dağıtım Senaryosu (Dynamic Host Configuration Protocol - görev: otomatik IP dağıtımı)'
        : 'DHCP Distribution Scenario (Dynamic Host Configuration Protocol - task: automatic IP assignment)',
      description: isTr
        ? 'DHCP sunucusunun PC1 ve PC2’ye IP atamasını izleyin, PC3 ise manuel kalıyor.'
        : 'Observe the DHCP server handing out IPs to PC1 & PC2 while PC3 stays static.',
      detail: isTr
        ? 'PC1/PC2 DHCP ile, PC3 elle yapılandırılmış; sh ip dhcp binding kontrolü yapın.'
        : 'PC1/PC2 via DHCP, PC3 manual; verify with sh ip dhcp binding.',
      level: 'intermediate',
      data: dhcpExampleData
    },
    {
      id: 'trunk-2switch',
      tag: isTr ? 'TRUNK' : 'TRUNK',
      title: isTr ? '2 Switch Trunk Uygulaması' : '2 Switch Trunk Application',
      description: isTr
        ? '2 switch, trunk bağlantı, VLAN 100/200 erişim portları.'
        : '2 switches, trunk connection, VLAN 100/200 access ports.',
      detail: isTr
        ? 'SW-1: Fa0/1=VLAN100, Fa0/11=VLAN200, Gi0/1=trunk | SW-2: Fa0/1=VLAN100, Fa0/11=VLAN200, Gi0/1=trunk'
        : 'SW-1: Fa0/1=VLAN100, Fa0/11=VLAN200, Gi0/1=trunk | SW-2: Fa0/1=VLAN100, Fa0/11=VLAN200, Gi0/1=trunk',
      level: 'intermediate',
      data: trunk2SwitchData
    }
  ];
};
