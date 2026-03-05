'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'tr' | 'en';

interface Translations {
  // Header
  title: string;
  subtitle: string;
  mode: string;
  hostname: string;
  clearTerminal: string;
  reset: string;
  
  // Port Panel
  switchTitle: string;
  fastEthernetPorts: string;
  gigabitPorts: string;
  connected: string;
  closed: string;
  blocked: string;
  idle: string;
  status: string;
  portName: string;
  speed: string;
  duplex: string;
  description: string;
  
  // VLAN Panel
  vlanStatus: string;
  newVlan: string;
  vlanId: string;
  vlanName: string;
  create: string;
  delete: string;
  active: string;
  suspended: string;
  ports: string;
  
  // Security Panel
  securityControls: string;
  securityLevel: string;
  enableSecret: string;
  consoleSecurity: string;
  vtySecurity: string;
  passwordEncryption: string;
  sshAccess: string;
  definedUsers: string;
  goodSecurity: string;
  mediumSecurity: string;
  lowSecurity: string;
  criticalSecurity: string;
  on: string;
  off: string;
  
  // Config Panel
  runningConfig: string;
  save: string;
  realTimeUpdate: string;
  
  // Terminal
  cliTerminal: string;
  processing: string;
  lines: string;
  
  // Quick Commands
  quickCommands: string;
  noCommandsAvailable: string;
  tabComplete: string;
  commandHistory: string;
  help: string;
  
  // Footer
  iosVersion: string;
  model: string;
  uptime: string;
  activePorts: string;
  
  // Tips
  tips: string;
  portClickTip: string;
  
  // Simulator
  simulatorTitle: string;
  simulatorCopyright: string;
  
  // Theme
  theme: string;
  light: string;
  dark: string;
  language: Language;  // 'tr' | 'en'
  
  // Additional
  clearTerminalBtn: string;
  switchMode: string;
  newVlanLabel: string;
}

const translations: Record<Language, Translations> = {
  tr: {
    title: 'Cisco Simulator',
    subtitle: 'Catalyst 2960 Series',
    mode: 'Mod',
    hostname: 'Hostname',
    clearTerminal: 'Terminali Temizle',
    reset: 'Sıfırla',
    switchTitle: 'Cisco 2960 Switch',
    fastEthernetPorts: 'FastEthernet Portları (Fa0/1 - Fa0/24)',
    gigabitPorts: 'GigabitEthernet Uplink (Gi0/1 - Gi0/2)',
    connected: 'Bağlı',
    closed: 'Kapalı',
    blocked: 'Engelli',
    idle: 'Boşta',
    status: 'Durum',
    portName: 'Ad',
    speed: 'Hız',
    duplex: 'Duplex',
    description: 'Açıklama',
    vlanStatus: 'VLAN Durumu',
    newVlan: 'Yeni VLAN Oluştur',
    vlanId: 'ID (1-4094)',
    vlanName: 'İsim',
    create: 'Oluştur',
    delete: 'Sil',
    active: 'Aktif',
    suspended: 'Askıda',
    ports: 'Portlar',
    securityControls: 'Güvenlik Kontrolleri',
    securityLevel: 'Güvenlik Seviyesi',
    enableSecret: 'Enable Secret',
    consoleSecurity: 'Console Güvenliği',
    vtySecurity: 'VTY Hatları Güvenliği',
    passwordEncryption: 'Şifre Şifreleme',
    sshAccess: 'SSH Erişimi',
    definedUsers: 'Tanımlı Kullanıcılar',
    goodSecurity: 'İyi güvenlik seviyesi',
    mediumSecurity: 'Orta güvenlik seviyesi',
    lowSecurity: 'Düşük güvenlik seviyesi',
    criticalSecurity: 'Kritik güvenlik açıkları mevcut',
    on: 'AÇIK',
    off: 'KAPALI',
    runningConfig: 'Running-Config',
    save: 'Kaydet (wr)',
    realTimeUpdate: 'Gerçek zamanlı güncelleme aktif',
    cliTerminal: 'CLI Terminal',
    processing: 'İşleniyor...',
    lines: 'satır',
    quickCommands: 'Hızlı Komutlar',
    noCommandsAvailable: 'Bu modda hızlı komut yok',
    tabComplete: 'komut tamamlama',
    commandHistory: 'komut geçmişi',
    help: 'yardım',
    iosVersion: 'IOS Versiyon',
    model: 'Model',
    uptime: 'Uptime',
    activePorts: 'Aktif Portlar',
    tips: 'İpuçları',
    portClickTip: 'Port LED\'lerine tıklayarak hızlıca interface moduna geçebilirsiniz',
    simulatorTitle: 'Cisco Switch Simulator v1.0',
    simulatorCopyright: 'Telif hakkı (c) 2024 Simulator. Tüm hakları saklıdır.',
    theme: 'Tema',
    light: 'Açık',
    dark: 'Koyu',
    language: 'tr',
    clearTerminalBtn: 'Temizle',
    switchMode: 'Switch Modu',
    newVlanLabel: 'Yeni VLAN',
  },
  en: {
    title: 'Cisco Simulator',
    subtitle: 'Catalyst 2960 Series',
    mode: 'Mode',
    hostname: 'Hostname',
    clearTerminal: 'Clear Terminal',
    reset: 'Reset',
    switchTitle: 'Cisco 2960 Switch',
    fastEthernetPorts: 'FastEthernet Ports (Fa0/1 - Fa0/24)',
    gigabitPorts: 'GigabitEthernet Uplinks (Gi0/1 - Gi0/2)',
    connected: 'Connected',
    closed: 'Closed',
    blocked: 'Blocked',
    idle: 'Idle',
    status: 'Status',
    portName: 'Name',
    speed: 'Speed',
    duplex: 'Duplex',
    description: 'Description',
    vlanStatus: 'VLAN Status',
    newVlan: 'Create New VLAN',
    vlanId: 'ID (1-4094)',
    vlanName: 'Name',
    create: 'Create',
    delete: 'Delete',
    active: 'Active',
    suspended: 'Suspended',
    ports: 'Ports',
    securityControls: 'Security Controls',
    securityLevel: 'Security Level',
    enableSecret: 'Enable Secret',
    consoleSecurity: 'Console Security',
    vtySecurity: 'VTY Lines Security',
    passwordEncryption: 'Password Encryption',
    sshAccess: 'SSH Access',
    definedUsers: 'Defined Users',
    goodSecurity: 'Good security level',
    mediumSecurity: 'Medium security level',
    lowSecurity: 'Low security level',
    criticalSecurity: 'Critical security vulnerabilities',
    on: 'ON',
    off: 'OFF',
    runningConfig: 'Running-Config',
    save: 'Save (wr)',
    realTimeUpdate: 'Real-time update active',
    cliTerminal: 'CLI Terminal',
    processing: 'Processing...',
    lines: 'lines',
    quickCommands: 'Quick Commands',
    noCommandsAvailable: 'No quick commands in this mode',
    tabComplete: 'command completion',
    commandHistory: 'command history',
    help: 'help',
    iosVersion: 'IOS Version',
    model: 'Model',
    uptime: 'Uptime',
    activePorts: 'Active Ports',
    tips: 'Tips',
    portClickTip: 'Click on port LEDs to quickly switch to interface mode',
    simulatorTitle: 'Cisco Switch Simulator v1.0',
    simulatorCopyright: 'Copyright (c) 2024 Simulator. All rights reserved.',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    language: 'en',
    clearTerminalBtn: 'Clear',
    switchMode: 'Switch Mode',
    newVlanLabel: 'New VLAN',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('tr');
  const [initialized, setInitialized] = useState(false);

  // İlk mount'ta localStorage'dan dil yükle (sadece bir kez)
  useEffect(() => {
    if (initialized) return;
    
    try {
      const saved = localStorage.getItem('cisco-sim-language');
      if (saved === 'tr' || saved === 'en') {
        setLanguage(saved);
      }
    } catch {
      // localStorage erişim hatası - varsayılan tr kullan
    }
    setInitialized(true);
  }, [initialized]);

  // Dil değiştiğinde kaydet
  useEffect(() => {
    if (!initialized) return;
    
    try {
      localStorage.setItem('cisco-sim-language', language);
    } catch {
      // localStorage erişim hatası
    }
  }, [language, initialized]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export type { Language, Translations };
