// Task definitions with descriptions and tips
import { SwitchState, CableInfo } from './types';
import { CanvasConnection } from '@/components/network/networkTopology.types';

export interface TaskDefinition {
  id: string;
  name: { tr: string; en: string };
  description: { tr: string; en: string };
  tip: { tr: string; en: string };
  weight: number;
  checkFn: (state: SwitchState, context: TaskContext) => boolean;
  icon?: 'wlan0'; // Optional icon identifier
}

export interface TaskContext {
  cableInfo: CableInfo;
  showPCPanel: boolean;
  selectedDevice: 'pc' | 'switch' | 'router' | null;
  language: 'tr' | 'en';
  deviceStates?: Map<string, SwitchState>;
  topologyConnections?: CanvasConnection[];
}

// Topoloji görevleri - PUAN YOK (0)
export const topologyTasks: TaskDefinition[] = [
  {
    id: 'pc-access',
    name: { tr: 'PC Erişimi', en: 'PC Access' },
    description: { tr: 'PC terminaline erişin', en: 'Access the PC terminal' },
    tip: { tr: 'PC\'ye çift tıklayarak açın', en: 'Double-click PC to open' },
    weight: 0,
    checkFn: (_, ctx) => ctx.showPCPanel,
  },
  {
    id: 'switch-access',
    name: { tr: 'Switch Erişimi', en: 'Switch Access' },
    description: { tr: 'Switch terminaline bağlanın', en: 'Connect to Switch terminal' },
    tip: { tr: 'Switch\'e çift tıklayarak açın', en: 'Double-click Switch to open' },
    weight: 0,
    checkFn: (_, ctx) => ctx.selectedDevice === 'switch' || ctx.selectedDevice === 'router',
  },
];

// Port görevleri - TOPLAM: 100
export const portTasks: TaskDefinition[] = [
  {
    id: 'activate-port',
    name: { tr: 'Port Aktifleştir', en: 'Activate Port' },
    description: { tr: 'En az 1 portu aktif hale getirin', en: 'Activate at least 1 port' },
    tip: { tr: 'no shutdown komutu ile port açın', en: 'Use no shutdown command to open port' },
    weight: 20,
    checkFn: (state) => Object.values(state.ports).filter(p => !p.shutdown).length > 0,
  },
  {
    id: 'create-trunk',
    name: { tr: 'Trunk Port', en: 'Trunk Port' },
    description: { tr: 'Bir portu trunk moduna alın', en: 'Set a port to trunk mode' },
    tip: { tr: 'switchport mode trunk komutunu kullanın', en: 'Use switchport mode trunk command' },
    weight: 25,
    checkFn: (state) => Object.values(state.ports).some(p => p.mode === 'trunk'),
  },
  {
    id: 'add-description',
    name: { tr: 'Port Açıklaması', en: 'Port Description' },
    description: { tr: 'Portlara açıklayıcı isim verin', en: 'Add descriptive names to ports' },
    tip: { tr: 'description "isim" komutu ile ekleyin', en: 'Add with description "name" command' },
    weight: 20,
    checkFn: (state) => Object.values(state.ports).some(p => p.name),
  },
  {
    id: 'configure-speed',
    name: { tr: 'Hız Ayarı', en: 'Speed Config' },
    description: { tr: 'Port hızını manuel ayarlayın', en: 'Manually configure port speed' },
    tip: { tr: 'speed 100 veya speed 1000 kullanın', en: 'Use speed 100 or speed 1000' },
    weight: 15,
    checkFn: (state) => Object.values(state.ports).some(p => p.speed !== 'auto'),
  },
  {
    id: 'configure-duplex',
    name: { tr: 'Duplex Ayarı', en: 'Duplex Config' },
    description: { tr: 'Port duplex ayarını yapın', en: 'Configure port duplex setting' },
    tip: { tr: 'duplex full veya duplex half kullanın', en: 'Use duplex full or duplex half' },
    weight: 10,
    checkFn: (state) => Object.values(state.ports).some(p => p.duplex !== 'auto'),
  },
  {
    id: 'all-ports-up',
    name: { tr: 'Tüm Portlar Aktif', en: 'All Ports Up' },
    description: { tr: 'Tüm portları aktif edin', en: 'Activate all ports' },
    tip: { tr: 'interface range ile toplu işlem yapın', en: 'Use interface range for bulk operation' },
    weight: 10,
    checkFn: (state) => Object.values(state.ports).filter(p => !p.shutdown).length === Object.keys(state.ports).length,
  },
];

// VLAN görevleri - TOPLAM: 100
export const vlanTasks: TaskDefinition[] = [
  {
    id: 'create-vlan',
    name: { tr: 'VLAN Oluştur', en: 'Create VLAN' },
    description: { tr: 'En az 1 kullanıcı VLAN\'ı oluşturun', en: 'Create at least 1 user VLAN' },
    tip: { tr: 'vlan 10 komutu ile yeni VLAN açın', en: 'Open new VLAN with vlan 10 command' },
    weight: 20,
    checkFn: (state) => Object.values(state.vlans).filter(v => v.id > 1 && v.id < 1002).length >= 1,
  },
  {
    id: 'name-vlan',
    name: { tr: 'VLAN İsimlendir', en: 'Name VLAN' },
    description: { tr: 'VLAN\'lara anlamlı isim verin', en: 'Give meaningful names to VLANs' },
    tip: { tr: 'name Muhasebe komutu ile isimlendirin', en: 'Name with name Accounting command' },
    weight: 15,
    checkFn: (state) => Object.values(state.vlans).some(v => v.id > 1 && v.id < 1002 && v.name !== `VLAN${v.id}`),
  },
  {
    id: 'assign-port',
    name: { tr: 'Port Ata', en: 'Assign Port' },
    description: { tr: 'Portları VLAN\'lara atayın', en: 'Assign ports to VLANs' },
    tip: { tr: 'switchport access vlan 10 komutu ile', en: 'Use switchport access vlan 10 command' },
    weight: 20,
    checkFn: (state) => Object.values(state.ports).filter(p => Number(p.accessVlan || p.vlan || 1) !== 1 && !p.shutdown).length >= 1,
  },
  {
    id: 'multiple-vlans',
    name: { tr: 'Çoklu VLAN', en: 'Multiple VLANs' },
    description: { tr: 'En az 3 farklı VLAN oluşturun', en: 'Create at least 3 different VLANs' },
    tip: { tr: 'Her departman için ayrı VLAN açın', en: 'Create separate VLAN for each department' },
    weight: 20,
    checkFn: (state) => Object.values(state.vlans).filter(v => v.id > 1 && v.id < 1002).length >= 3,
  },
  {
    id: 'trunk-config',
    name: { tr: 'Trunk Yapılandır', en: 'Configure Trunk' },
    description: { tr: 'Trunk portları yapılandırın', en: 'Configure trunk ports' },
    tip: { tr: 'Trunk portlar birden fazla VLAN taşır', en: 'Trunk ports carry multiple VLANs' },
    weight: 15,
    checkFn: (state) => Object.values(state.ports).some(p => p.mode === 'trunk'),
  },
  {
    id: 'all-named',
    name: { tr: 'Tam İsimlendirme', en: 'Full Naming' },
    description: { tr: 'Tüm VLAN\'ları isimlendirin', en: 'Name all VLANs' },
    tip: { tr: 'Standart isimlendirme kuralı uygulayın', en: 'Apply standard naming convention' },
    weight: 10,
    checkFn: (state) => {
      const userVlans = Object.values(state.vlans).filter(v => v.id > 1 && v.id < 1002);
      const namedVlans = userVlans.filter(v => v.name !== `VLAN${v.id}`);
      return userVlans.length > 0 && namedVlans.length === userVlans.length;
    },
  },
];

// Güvenlik görevleri - TOPLAM: 100
export const securityTasks: TaskDefinition[] = [
  {
    id: 'enable-secret',
    name: { tr: 'Enable Secret', en: 'Enable Secret' },
    description: { tr: 'Privileged mode için şifre belirleyin', en: 'Set password for privileged mode' },
    tip: { tr: 'enable secret network komutu ile', en: 'Use enable secret network command' },
    weight: 25,
    checkFn: (state) => !!state.security.enableSecret,
  },
  {
    id: 'console-security',
    name: { tr: 'Console Güvenliği', en: 'Console Security' },
    description: { tr: 'Console erişimine şifre koyun', en: 'Secure console access with password' },
    tip: { tr: 'line console 0 altında password kullanın', en: 'Use password under line console 0' },
    weight: 20,
    checkFn: (state) => state.security.consoleLine.login && !!state.security.consoleLine.password,
  },
  {
    id: 'vty-security',
    name: { tr: 'VTY Güvenliği', en: 'VTY Security' },
    description: { tr: 'Uzaktan erişimi güvenli hale getirin', en: 'Secure remote access' },
    tip: { tr: 'line vty 0 4 altında login local kullanın', en: 'Use login local under line vty 0 4' },
    weight: 20,
    checkFn: (state) => state.security.vtyLines.login && !!state.security.vtyLines.password,
  },
  {
    id: 'password-encryption',
    name: { tr: 'Şifre Şifreleme', en: 'Password Encryption' },
    description: { tr: 'Şifreleri şifreli olarak saklayın', en: 'Store passwords in encrypted form' },
    tip: { tr: 'service password-encryption komutu ile', en: 'Use service password-encryption command' },
    weight: 15,
    checkFn: (state) => state.security.servicePasswordEncryption,
  },
  {
    id: 'ssh-only',
    name: { tr: 'SSH Erişimi', en: 'SSH Access' },
    description: { tr: 'Sadece SSH ile erişime izin verin', en: 'Allow only SSH access' },
    tip: { tr: 'transport input ssh komutu ile', en: 'Use transport input ssh command' },
    weight: 10,
    checkFn: (state) => state.security.vtyLines.transportInput.includes('ssh'),
  },
  {
    id: 'create-user',
    name: { tr: 'Kullanıcı Oluştur', en: 'Create User' },
    description: { tr: 'Yerel kullanıcı hesabı oluşturun', en: 'Create local user account' },
    tip: { tr: 'username admin secret network ile', en: 'Use username admin secret network' },
    weight: 10,
    checkFn: (state) => state.security.users.length > 0,
  },
];

// Kablosuz görevler - TOPLAM: 100
export const wirelessTasks: TaskDefinition[] = [
  {
    id: 'wlan-active',
    name: { tr: 'WLAN Aktif', en: 'WLAN Active' },
    description: { tr: 'Kablosuz arayüzü (wlan0) aktif edin', en: 'Activate wireless interface (wlan0)' },
    tip: { tr: 'interface wlan0 altında no shutdown kullanın', en: 'Use no shutdown under interface wlan0' },
    weight: 20,
    icon: 'wlan0',
    checkFn: (state) => {
      const wlan = state.ports['wlan0'];
      return wlan && !wlan.shutdown;
    },
  },
  {
    id: 'wlan-ssid',
    name: { tr: 'SSID Yapılandır', en: 'Configure SSID' },
    description: { tr: 'Kablosuz ağ adı (SSID) belirleyin', en: 'Set wireless network name (SSID)' },
    tip: { tr: 'ssid HomeWiFi komutunu kullanın', en: 'Use ssid HomeWiFi command' },
    weight: 20,
    icon: 'wlan0',
    checkFn: (state) => {
      const wlan = state.ports['wlan0'];
      return !!wlan?.wifi?.ssid;
    },
  },
  {
    id: 'wlan-security',
    name: { tr: 'WPA2 Güvenliği', en: 'WPA2 Security' },
    description: { tr: 'Kablosuz ağa WPA2 şifreleme ekleyin', en: 'Add WPA2 encryption to wireless' },
    tip: { tr: 'encryption wpa2 ve wifi-password kullanın', en: 'Use encryption wpa2 and wifi-password' },
    weight: 30,
    icon: 'wlan0',
    checkFn: (state) => {
      const wlan = state.ports['wlan0'];
      return !!(wlan?.wifi && wlan.wifi.mode !== 'disabled' && wlan.wifi.security === 'wpa2' && wlan.wifi.password);
    },
  },
  {
    id: 'wlan-connection',
    name: { tr: 'WLAN Bağlantısı', en: 'WLAN Connection' },
    description: { tr: 'Sağlıklı kablosuz bağlantı kurun', en: 'Establish healthy wireless connection' },
    tip: { tr: 'SSID ve şifrenin PC ile eşleştiğinden emin olun', en: 'Ensure SSID and password match the PC' },
    weight: 30,
    icon: 'wlan0',
    checkFn: (state) => {
      const wlan = state.ports['wlan0'];
      return !!(wlan && !wlan.shutdown && wlan.wifi?.mode === 'ap' && wlan.wifi.ssid);
    },
  },
];

// Routing görevleri - TOPLAM: 100 (L3 Switch only)
export const routingTasks: TaskDefinition[] = [
  {
    id: 'enable-ip-routing',
    name: { tr: 'IP Routing', en: 'IP Routing' },
    description: { tr: 'IP routing özelliğini aktifleştirin', en: 'Enable IP routing feature' },
    tip: { tr: 'L3 switch üzerinde routing komutlarını kullanın', en: 'Use routing commands on L3 switch' },
    weight: 25,
    checkFn: (state, ctx) => {
      // Only check for L3 switches
      const device = ctx.deviceStates?.get(ctx.selectedDevice || '');
      return device?.ipRouting === true;
    },
  },
  {
    id: 'configure-rip',
    name: { tr: 'RIP Protokolü', en: 'RIP Protocol' },
    description: { tr: 'RIP routing protokolünü yapılandırın', en: 'Configure RIP routing protocol' },
    tip: { tr: 'router rip komutu ile RIP etkinleştirin', en: 'Enable RIP with router rip command' },
    weight: 30,
    checkFn: (state, ctx) => {
      const device = ctx.deviceStates?.get(ctx.selectedDevice || '');
      return device?.routingProtocol === 'rip';
    },
  },
  {
    id: 'configure-ospf',
    name: { tr: 'OSPF Protokolü', en: 'OSPF Protocol' },
    description: { tr: 'OSPF routing protokolünü yapılandırın', en: 'Configure OSPF routing protocol' },
    tip: { tr: 'router ospf komutu ile OSPF etkinleştirin', en: 'Enable OSPF with router ospf command' },
    weight: 30,
    checkFn: (state, ctx) => {
      const device = ctx.deviceStates?.get(ctx.selectedDevice || '');
      return device?.routingProtocol === 'ospf';
    },
  },
  {
    id: 'routed-port',
    name: { tr: 'Routed Port', en: 'Routed Port' },
    description: { tr: 'Fiziksel portu routed moduna alın', en: 'Configure physical port as routed port' },
    tip: { tr: 'no switchport komutu ile L3 port yapın', en: 'Make L3 port with no switchport command' },
    weight: 15,
    checkFn: (state, ctx) => {
      const device = ctx.deviceStates?.get(ctx.selectedDevice || '');
      return Object.values(device?.ports || {}).some(port => port.mode === 'routed' && !port.id.startsWith('vlan'));
    },
  },
];

// Tüm görevleri birleştir
export const allTaskGroups = {
  topology: topologyTasks,
  ports: portTasks,
  vlan: vlanTasks,
  security: securityTasks,
  wireless: wirelessTasks,
  routing: routingTasks,
};

// Görev hesaplama yardımcı fonksiyonu
export function calculateTaskScore(tasks: TaskDefinition[], state: SwitchState, context: TaskContext): number {
  return tasks.reduce((acc, task) => {
    const completed = task.checkFn(state, context);
    return acc + (completed ? task.weight : 0);
  }, 0);
}

// Görev tamamlanma durumunu kontrol et
export function getTaskStatus(task: TaskDefinition, state: SwitchState, context: TaskContext): boolean {
  return task.checkFn(state, context);
}
