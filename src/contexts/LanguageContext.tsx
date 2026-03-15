'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'tr' | 'en';

export interface Translations {
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
  unassigned: string;

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
  nosVersion: string;
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
  pcTerminal: string;
  pcConnected: string;
  pcNotConnected: string;
  pcCableError: string;
  pcIncompatibleCable: string;
  pcAccessDenied: string;
  pcConsoleTip: string;
  pcPingError: string;
  pcTelnetError: string;
  pcTracertError: string;
  pcNslookupError: string;
  pcIpconfigError: string;
  pcTerminalClosing: string;
  pcLoginSuccess: string;
  pcConnectionClosed: string;
  load: string;
  saveLabel: string;
  languageLabel: string;
  themeLabel: string;
  errorPrefix: string;
  newBtn: string;
  modeUser: string;
  modePrivileged: string;
  modeConfig: string;
  modeInterface: string;
  modeLine: string;
  modeVlanLabel: string;
  macAddress: string;
  deviceInfo: string;
  consoleTerminal: string;
  devices: string;
  cableTypes: string;
  cli: string;
  id: string;
  portInUse: string;
  note: string;
  cable: string;
  add: string;
  annotations: string;
  align: string;
  addDeviceOrCable: string;
  selectCable: string;
  deviceInfoShort: string;
  addPcShort: string;
  addSwitchShort: string;
  addRouterShort: string;
  ipAddress: string;
  subnetMask: string;
  gateway: string;
  dnsServer: string;
  accessDenied: string;
  resetConfirm: string;
  clearTerminalConfirm: string;
  unsavedChangesConfirm: string;
  newProjectConfirm: string;
  invalidProjectFile: string;
  failedLoadProject: string;
  undo: string;
  redo: string;
  newProject: string;
  saveProject: string;
  loadProject: string;
  about: string;
  noDevicesInTopology: string;
  addDevicesFirst: string;
  selectDeviceDropdown: string;
  vlanNameExample: string;
  hostnameExample: string;

  // Security descriptions
  secEnableSecretOn: string;
  secEnableSecretOff: string;
  secConsoleOn: string;
  secConsoleOff: string;
  secVtyOn: string;
  secVtyOff: string;
  secPassEncOn: string;
  secPassEncOff: string;
  secSshOnly: string;
  secTelnetWarn: string;
  secNoProtocol: string;

  // VLAN Panel
  vlanNotApplicable: string;
  vlanOnlyOnNetworkDevices: string;
  vlanScore: string;
  vlanTasks: string;
  vlanExcellent: string;
  vlanGood: string;
  vlanInProgress: string;
  vlanNeeded: string;

  // VLAN Tasks
  vTaskCreateName: string;
  vTaskCreateDesc: string;
  vTaskNameName: string;
  vTaskNameDesc: string;
  vTaskAssignName: string;
  vTaskAssignDesc: string;
  vTaskTrunkName: string;
  vTaskTrunkDesc: string;
  vTaskMultipleName: string;
  vTaskMultipleDesc: string;
  vTaskFullNamingName: string;
  vTaskFullNamingDesc: string;
  vTaskFullNamingHint: string;
  saving: string;
  connect: string;
  disconnect: string;
  physicalConnectionDetected: string;
  noConsoleCableDetected: string;
  consoleConfiguration: string;
  waitingForConnection: string;
  typeCommand: string;
  labProgress: string;
  networkTopology: string;
  navigation: string;
  project: string;
  settings: string;
  selectDevice: string;
  confirmationRequired: string;
  cancel: string;
  continue: string;
  dontSave: string;
  pts: string;
  initializingSystem: string;

  // About Section
  aboutTitle: string;
  aboutIntro: string;
  termsAndConditions: string;
  termsText: string;
  licenseInfo: string;
  close: string;

  // Network Topology
  connectDevices: string;
  addDevice: string;
  addPc: string;
  addSwitch: string;
  addRouter: string;
  addNote: string;
  cableType: string;
  straight: string;
  crossover: string;
  console: string;
  linkFrom: string;
  selectSourcePort: string;
  selectTargetPort: string;
  step1: string;
  step2: string;
  noFreePorts: string;
  noFreePortsMessage: string;
}

const translations: Record<Language, Translations> = {
  tr: {
    title: 'Network Simulator 2026',
    subtitle: 'Ağ Becerilerini Geliştir',
    mode: 'Kip',
    hostname: 'Ana Bilgisayar Adı',
    clearTerminal: 'Terminali Temizle',
    reset: 'Sıfırla',
    switchTitle: 'Network 2960 Switch',
    fastEthernetPorts: 'FastEthernet Portları (Fa0/1 - Fa0/24)',
    gigabitPorts: 'GigabitEthernet Portları',
    connected: 'Bağlı',
    closed: 'Kapalı',
    blocked: 'Engelli',
    idle: 'Boşta',
    status: 'Durum',
    portName: 'Ad',
    speed: 'Hız',
    duplex: 'Çift Yönlü',
    description: 'Açıklama',
    unassigned: 'Atanmamış',
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
    on: 'Açık',
    off: 'Kapalı',
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
    nosVersion: 'NOS Versiyon',
    model: 'Model',
    uptime: 'Uptime',
    activePorts: 'Aktif Portlar',
    tips: 'İpuçları',
    portClickTip: 'Port LED\'lerine tıklayarak hızlıca interface moduna geçebilirsiniz',
    simulatorTitle: 'Network Simulator 2026 v1.0',
    simulatorCopyright: 'Telif hakkı (c) 2024 Simulator. Tüm hakları saklıdır.',
    theme: 'Tema',
    light: 'Açık',
    dark: 'Koyu',
    language: 'tr',
    clearTerminalBtn: 'Temizle',
    switchMode: 'Switch Modu',
    newVlanLabel: 'Yeni VLAN',
    pcTerminal: 'PC Terminali',
    pcConnected: 'Bağlandı.',
    pcNotConnected: 'Herhangi bir switch veya router\'a bağlı değilsiniz.',
    pcCableError: 'Ağ kablosu bağlı değil.',
    pcIncompatibleCable: 'Kablo tipi uyumsuz. PC-Switch için Düz Kablo gerekli.',
    pcAccessDenied: 'Adrese doğrudan erişim yok.',
    pcConsoleTip: 'Konsol kablosuyla bağlısınız. Lütfen "terminal" komutunu kullanın.',
    pcPingError: 'Ping isteği zaman aşımına uğradı.',
    pcTelnetError: 'TELNET: Bağlantı kurulamadı.',
    pcTracertError: 'TRACERT: Hedefe ulaşılamıyor.',
    pcNslookupError: 'NSLOOKUP: DNS sunucusuyla iletişim kurulamadı.',
    pcIpconfigError: 'IP yapılandırması alınamadı.',
    pcTerminalClosing: 'PC terminali kapatılıyor...',
    pcLoginSuccess: 'Giriş başarılı',
    pcConnectionClosed: 'Bağlantı uzak bilgisayar tarafından kapatıldı.',
    load: 'Yükle',
    saveLabel: 'Kaydet',
    languageLabel: 'Dil',
    themeLabel: 'Tema',
    errorPrefix: 'HATA',
    newBtn: 'Yeni',
    modeUser: 'Kullanıcı EXEC',
    modePrivileged: 'Ayrıcalıklı EXEC',
    modeConfig: 'Global Yapılandırma',
    modeInterface: 'Arayüz Yapılandırma',
    modeLine: 'Hat Yapılandırma',
    modeVlanLabel: 'VLAN Yapılandırma',
    secEnableSecretOn: 'Şifreli enable şifresi yapılandırılmış',
    secEnableSecretOff: 'Enable şifresi yapılandırılmamış',
    secConsoleOn: 'Console hattı için giriş aktif',
    secConsoleOff: 'Console hattı için giriş yapılandırılmamış',
    secVtyOn: 'VTY hatları için giriş aktif',
    secVtyOff: 'VTY hatları için giriş yapılandırılmamış',
    secPassEncOn: 'Şifreler şifrelenmiş durumda',
    secPassEncOff: 'Şifreler düz metin olarak saklanıyor',
    secSshOnly: 'Sadece SSH erişimi aktif',
    secTelnetWarn: 'Telnet erişimi aktif (güvenli değil)',
    secNoProtocol: 'Erişim protokolü yapılandırılmamış',
    vlanNotApplicable: 'PC Cihazlarında VLAN Yapılandırması Yok',
    vlanOnlyOnNetworkDevices: 'VLAN bilgileri sadece switch veya router cihazlarında görüntülenebilir ve yapılandırılabilir.',
    vlanScore: 'VLAN Puanı',
    vlanTasks: 'VLAN Görevleri',
    vlanExcellent: 'Mükemmel VLAN yapılandırması!',
    vlanGood: 'İyi VLAN yapısı',
    vlanInProgress: 'VLAN yapılandırma devam ediyor',
    vlanNeeded: 'VLAN yapılandırması gerekli',
    vTaskCreateName: 'VLAN Oluştur',
    vTaskCreateDesc: 'Varsayılan olmayan en az 1 VLAN oluştur',
    vTaskNameName: 'VLAN İsimlendir',
    vTaskNameDesc: 'Bir VLAN\'a özel isim ver',
    vTaskAssignName: 'Port Ata',
    vTaskAssignDesc: 'Bir portu VLAN\'a ata',
    vTaskTrunkName: 'Trunk Port',
    vTaskTrunkDesc: 'Bir portu trunk moduna al',
    vTaskMultipleName: 'Çoklu VLAN',
    vTaskMultipleDesc: 'En az 3 kullanıcılı VLAN\'ı oluştur',
    vTaskFullNamingName: 'Tam İsimlendirme',
    vTaskFullNamingDesc: 'Tüm VLAN\'ları isimlendir',
    vTaskFullNamingHint: 'Her VLAN için: name <isim>',
    saving: 'Kaydediliyor...',
    connect: 'Bağla',
    disconnect: 'Bağlantıyı Kes',
    physicalConnectionDetected: 'Fiziksel bağlantı algılandı:',
    noConsoleCableDetected: 'Konsol kablosu algılanmadı. PC\'den bir ağ cihazına konsol kablosu bağlayın.',
    consoleConfiguration: 'Yapılandırma: 9600 bits/s, 8 data bits, no parity',
    waitingForConnection: 'Bağlantı bekleniyor...',
    typeCommand: 'Komut yazın...',
    labProgress: 'Lab İlerlemesi',
    networkTopology: 'Ağ Topolojisi',
    navigation: 'Navigasyon',
    project: 'Proje',
    settings: 'Ayarlar',
    selectDevice: 'Cihaz Seçimi',
    confirmationRequired: 'Onay Gerekiyor',
    cancel: 'İptal',
    continue: 'Devam Et',
    dontSave: 'Kaydetme',
    pts: 'puan',
    initializingSystem: 'Sistem Başlatılıyor...',
    macAddress: 'MAC Adresi',
    deviceInfo: 'CİHAZ BİLGİSİ',
    consoleTerminal: 'Konsol Terminali',
    devices: 'Cihazlar',
    cableTypes: 'Kablo Tipleri',
    cli: 'CLI',
    id: 'ID',
    portInUse: 'Bu port zaten kullanımda!',
    note: 'Not',
    cable: 'Kablo',
    add: 'Ekle',
    annotations: 'Notlar',
    align: 'Hizala',
    addDeviceOrCable: 'Cihaz veya Kablo Ekle',
    selectCable: 'Kablo Seç',
    deviceInfoShort: 'Bilgi',
    addPcShort: 'PC Ekle',
    addSwitchShort: 'Switch Ekle',
    addRouterShort: 'Router Ekle',
    ipAddress: 'IP Adresi',
    subnetMask: 'Alt Ağ Maskesi',
    gateway: 'Ağ Geçidi',
    dnsServer: 'DNS Sunucusu',
    accessDenied: '% Erişim reddedildi',
    resetConfirm: 'Tüm yapılandırma sıfırlanacak. Devam etmek istiyor musunuz?',
    clearTerminalConfirm: 'Terminal çıktısı temizlenecek. Devam etmek istiyor musunuz?',
    unsavedChangesConfirm: 'Kaydedilmemiş değişiklikler var. Kaydetmek istiyor musunuz?',
    newProjectConfirm: 'Tüm yapılandırma ve topoloji sıfırlanacak. Devam etmek istiyor musunuz?',
    invalidProjectFile: 'Proje dosyası geçersiz!',
    failedLoadProject: 'Proje dosyası yüklenemedi!',
    undo: 'Geri Al (Ctrl+Z)',
    redo: 'İleri Al (Ctrl+Y)',
    newProject: 'Yeni Proje',
    saveProject: 'Projeyi Kaydet',
    loadProject: 'Proje Yükle',
    about: 'Hakkında',
    noDevicesInTopology: 'Topolojide henüz cihaz yok.',
    addDevicesFirst: 'Önce Cihaz Ekleyin',
    selectDeviceDropdown: 'Cihaz Seç',
    vlanNameExample: 'Örn: Muhasebe',
    hostnameExample: 'Örn: Router-X',
    aboutTitle: 'Network Simulator 2026 Hakkında',
    aboutIntro: 'Bu uygulama, ağ teknolojilerini ve terminal komutlarını öğrenmek isteyenler için tasarlanmış interaktif bir simülasyon aracıdır.',
    termsAndConditions: 'Şartlar ve Koşullar',
    termsText: 'Bu yazılım eğitim amaçlıdır. Ticari olmayan amaçlarla özgürce kullanılabilir ve dağıtılabilir.',
    licenseInfo: 'Tuzla Mesleki ve Teknik Anadolu Lisesi',
    close: 'Kapat',
    connectDevices: 'Cihazları Bağla',
    addDevice: 'Cihaz Ekle',
    addPc: 'PC Ekle',
    addSwitch: 'Switch Ekle',
    addRouter: 'Router Ekle',
    addNote: 'Not Ekle',
    cableType: 'Kablo Tipi',
    straight: 'Düz',
    crossover: 'Çapraz',
    console: 'Konsol',
    linkFrom: 'Bağlantı',
    selectSourcePort: 'Kaynak Portu Seç',
    selectTargetPort: 'Hedef Portu Seç',
    step1: 'Adım 1: Kaynak',
    step2: 'Adım 2: Hedef',
    noFreePorts: 'Boş Port Yok',
    noFreePortsMessage: 'Lütfen önce bazı kabloları çıkarın.',
  },
  en: {
    title: 'Network Simulator 2026',
    subtitle: 'Develop Your Networking Skills',
    mode: 'Mode',
    hostname: 'Hostname',
    clearTerminal: 'Clear Terminal',
    reset: 'Reset',
    switchTitle: 'Network 2960 Switch',
    fastEthernetPorts: 'FastEthernet Ports (Fa0/1 - Fa0/24)',
    gigabitPorts: 'GigabitEthernet Ports',
    connected: 'Connected',
    closed: 'Closed',
    blocked: 'Blocked',
    idle: 'Idle',
    status: 'Status',
    portName: 'Name',
    speed: 'Speed',
    duplex: 'Duplex',
    description: 'Description',
    unassigned: 'Unassigned',
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
    nosVersion: 'NOS Version',
    model: 'Model',
    uptime: 'Uptime',
    activePorts: 'Active Ports',
    tips: 'Tips',
    portClickTip: 'Click on port LEDs to quickly switch to interface mode',
    simulatorTitle: 'Network Simulator 2026 v1.0',
    simulatorCopyright: 'Copyright (c) 2024 Simulator. All rights reserved.',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    language: 'en',
    clearTerminalBtn: 'Clear',
    switchMode: 'Switch Mode',
    newVlanLabel: 'New VLAN',
    pcTerminal: 'PC Terminal',
    pcConnected: 'Connected.',
    pcNotConnected: 'You are not connected to any switch or router.',
    pcCableError: 'Network cable not connected.',
    pcIncompatibleCable: 'Incompatible cable type. Straight-through required for PC-Switch.',
    pcAccessDenied: 'no direct access to address.',
    pcConsoleTip: 'Connected via console. Please use the "terminal" command.',
    pcPingError: 'Ping request timed out.',
    pcTelnetError: 'TELNET: Connection failed.',
    pcTracertError: 'TRACERT: Target unreachable.',
    pcNslookupError: 'NSLOOKUP: Cannot communicate with DNS server.',
    pcIpconfigError: 'Could not retrieve IP configuration.',
    pcTerminalClosing: 'Closing PC terminal...',
    pcLoginSuccess: 'Login successful',
    pcConnectionClosed: 'Connection closed by foreign host.',
    load: 'Load',
    saveLabel: 'Save',
    languageLabel: 'Language',
    themeLabel: 'Theme',
    errorPrefix: 'ERROR',
    newBtn: 'New',
    modeUser: 'User EXEC',
    modePrivileged: 'Privileged EXEC',
    modeConfig: 'Global Config',
    modeInterface: 'Interface Config',
    modeLine: 'Line Config',
    modeVlanLabel: 'VLAN Config',
    secEnableSecretOn: 'Encrypted enable password configured',
    secEnableSecretOff: 'Enable password not configured',
    secConsoleOn: 'Console line login enabled',
    secConsoleOff: 'Console line login not configured',
    secVtyOn: 'VTY lines login enabled',
    secVtyOff: 'VTY lines login not configured',
    secPassEncOn: 'Passwords encrypted',
    secPassEncOff: 'Passwords stored in plain text',
    secSshOnly: 'SSH-only access enabled',
    secTelnetWarn: 'Telnet access enabled (insecure)',
    secNoProtocol: 'Access protocol not configured',
    vlanNotApplicable: 'VLAN Configuration Not Applicable for PC Devices',
    vlanOnlyOnNetworkDevices: 'VLAN information can only be viewed and configured on switch or router devices.',
    vlanScore: 'VLAN Score',
    vlanTasks: 'VLAN Tasks',
    vlanExcellent: 'Excellent VLAN configuration!',
    vlanGood: 'Good VLAN structure',
    vlanInProgress: 'VLAN configuration in progress',
    vlanNeeded: 'VLAN configuration needed',
    vTaskCreateName: 'Create VLAN',
    vTaskCreateDesc: 'Create at least 1 non-default VLAN',
    vTaskNameName: 'Name VLAN',
    vTaskNameDesc: 'Give a custom name to a VLAN',
    vTaskAssignName: 'Assign Port',
    vTaskAssignDesc: 'Assign a port to a VLAN',
    vTaskTrunkName: 'Trunk Port',
    vTaskTrunkDesc: 'Configure a port as trunk',
    vTaskMultipleName: 'Multiple VLANs',
    vTaskMultipleDesc: 'Create at least 3 user VLANs',
    vTaskFullNamingName: 'Full Naming',
    vTaskFullNamingDesc: 'Name all VLANs properly',
    vTaskFullNamingHint: 'For each VLAN: name <name>',
    saving: 'Saving...',
    connect: 'Connect',
    disconnect: 'Disconnect',
    physicalConnectionDetected: 'Physical connection detected to',
    noConsoleCableDetected: 'No console cable detected. Connect a console cable from the PC to a network device.',
    consoleConfiguration: 'Configuration: 9600 bits/s, 8 data bits, no parity',
    waitingForConnection: 'Waiting for connection...',
    typeCommand: 'Type command...',
    labProgress: 'Lab Progress',
    networkTopology: 'Network Topology',
    navigation: 'Navigation',
    project: 'Project',
    settings: 'Settings',
    selectDevice: 'Select Device',
    confirmationRequired: 'Confirmation Required',
    cancel: 'Cancel',
    continue: 'Continue',
    dontSave: 'Don\'t Save',
    pts: 'pts',
    initializingSystem: 'Initializing System...',
    macAddress: 'MAC Address',
    deviceInfo: 'DEVICE INFO',
    consoleTerminal: 'Console Terminal',
    devices: 'Devices',
    cableTypes: 'Cable Types',
    cli: 'CLI',
    id: 'ID',
    portInUse: 'This port already in use!',
    note: 'Note',
    cable: 'Cable',
    add: 'Add',
    annotations: 'Annotations',
    align: 'Align',
    addDeviceOrCable: 'Add Device or Cable',
    selectCable: 'Select Cable',
    deviceInfoShort: 'Info',
    addPcShort: 'Add PC',
    addSwitchShort: 'Add Switch',
    addRouterShort: 'Add Router',
    ipAddress: 'IP Address',
    subnetMask: 'Subnet Mask',
    gateway: 'Gateway',
    dnsServer: 'DNS Server',
    accessDenied: '% Access denied',
    resetConfirm: 'All configuration will be reset. Do you want to continue?',
    clearTerminalConfirm: 'Terminal output will be cleared. Do you want to continue?',
    unsavedChangesConfirm: 'You have unsaved changes. Do you want to save?',
    newProjectConfirm: 'All configuration and topology will be reset. Do you want to continue?',
    invalidProjectFile: 'Invalid project file!',
    failedLoadProject: 'Failed to load project file!',
    undo: 'Undo (Ctrl+Z)',
    redo: 'Redo (Ctrl+Y)',
    newProject: 'New Project',
    saveProject: 'Save Project',
    loadProject: 'Load Project',
    about: 'About',
    noDevicesInTopology: 'No devices in topology yet.',
    addDevicesFirst: 'Add Devices First',
    selectDeviceDropdown: 'Select Device',
    vlanNameExample: 'e.g. Sales',
    hostnameExample: 'e.g. Router-X',
    aboutTitle: 'About Network Simulator 2026',
    aboutIntro: 'This application is an interactive simulation tool designed for those who want to learn network technologies and terminal commands.',
    termsAndConditions: 'Terms and Conditions',
    termsText: 'This software is for educational purposes. It can be freely used and distributed for non-commercial purposes.',
    licenseInfo: 'Tuzla Vocational and Technical Anatolian High School',
    close: 'Close',
    connectDevices: 'Connect Devices',
    addDevice: 'Add Device',
    addPc: 'Add PC',
    addSwitch: 'Add Switch',
    addRouter: 'Add Router',
    addNote: 'Add Note',
    cableType: 'Cable Type',
    straight: 'Straight',
    crossover: 'Cross-over',
    console: 'Console',
    linkFrom: 'Link from',
    selectSourcePort: 'Select Source Port',
    selectTargetPort: 'Select Target Port',
    step1: 'Step 1: Source',
    step2: 'Step 2: Destination',
    noFreePorts: 'No Free Ports',
    noFreePortsMessage: 'Please disconnect some cables first.',
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
      const saved = localStorage.getItem('network-sim-language');
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
      localStorage.setItem('network-sim-language', language);
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
