'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'tr' | 'en';

export interface Translations {
  pcConnected: string;
  undo: string;
  redo: string;
  load: string;
  help: string;
  addRouter: string;
  addNote: string;
  resetView: string;
  exit: string;
  tips: string;
  addDeviceOrCable: string;
  colorLabel: string;
  fontLabel: string;
  opacityLabel: string;
  duplicateLabel: string;
  paste: string;
  selectAll: string;
  cut: string;
  copy: string;
  power: string;
  active: string;
  connectDevices: string;
  refreshNetwork: string;
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

  // Footer
  nosVersion: string;
  model: string;
  uptime: string;
  activePorts: string;

  // Tips
  levelBasic: string;
  levelIntermediate: string;
  levelAdvanced: string;
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
  // UI text for global controls in About modal / tour
  close: string;
  pcTerminal: string;
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
  consolePingNotAllowed: string;
  pcLoginSuccess: string;
  pcConnectionClosed: string;
  copyToastSuccessTitle: string;
  copyToastSuccessDescription: string;
  copyToastFailureTitle: string;
  copyToastFailureDescription: string;
  consolePasswordErrorTitle: string;
  consolePasswordErrorDescription: string;
  pcConnectionError: string;
  dnsInvalidAddress: string;
  dnsGatewayRequired: string;
  targetGatewayRequired: string;
  dnsAddressRequired: string;
  pcNoDeviceConnected: string;
  pcConsoleHelp: string;
  searchOutputTitle: string;
  searchOutputDescription: string;
  searchPlaceholder: string;
  commandPromptTab: string;
  consoleTab: string;
  settingsTab: string;
  servicesTab: string;
  ipConfigurationLabel: string;
  staticLabel: string;
  dnsRecordManagerTip: string;
  dnsDomainPlaceholder: string;
  dnsAddressPlaceholder: string;
  addDnsRecord: string;
  dnsNoRecords: string;
  httpServiceDescription: string;
  dhcpPoolsDescription: string;
  dhcpPoolNamePlaceholder: string;
  dhcpPoolGatewayPlaceholder: string;
  dhcpPoolDnsPlaceholder: string;
  dhcpPoolStartIpPlaceholder: string;
  dhcpPoolSubnetPlaceholder: string;
  dhcpPoolMaxUsersPlaceholder: string;
  addPool: string;
  updatePool: string;
  noDhcpPools: string;
  edit: string;
  dhcpSuccessTitle: string;
  dhcpSuccessDescription: string;
  dhcpFailureTitle: string;
  dhcpFailureDescription: string;
  resetToDefaults: string;
  confirmResetTitle: string;
  confirmResetDescription: string;
  confirmReset: string;
  saveLabel: string;
  languageLabel: string;
  themeLabel: string;
  errorPrefix: string;
  newBtn: string;
  dhcpEnabled: string;
  openServices: string;
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
  gitAddressLabel: string;
  openSourceInfo: string;
  startTour: string;

  // Network Topology
  addDevice: string;
  addPc: string;
  addSwitch: string;
  cableType: string;
  straight: string;
  crossover: string;
  console: string;
  linkFrom: string;
  selectSourcePort: string;
  selectTargetPort: string;
  step1: string;
  step2: string;
  freePorts: string;
  noFreePorts: string;
  noFreePortsMessage: string;
  reloadPage: string;
  delete: string;
  resize: string;
  search: string;
  tasks: string;
  basicHint: string;
  intermediateHint: string;
  advancedHint: string;
  syslogStarted: string;
  bootReady: string;
  bootLoading: string;
  bootInitializing: string;
  bootingFlash: string;
  extractingFiles: string;
  performanceOptimization: string;
  spatialPartitioning: string;
  viewportCulling: string;
  virtualScrolling: string;
  skeletonScreens: string;
  assetLoading: string;
  nodePooling: string;
  layer3Switching: string;
  routedPorts: string;
  dynamicRouting: string;
  ipRoutingEngine: string;
  routingTasks: string;
  accessibility: string;
  ariaManagement: string;
  keyboardNav: string;
  highContrast: string;
  screenReader: string;
  wifiSignal: string;
  wifiConnected: string;
  wifiDisconnected: string;
  wifiConfig: string;
  wifiControlPanel: string;
  wifiMode: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiSecurity: string;
  wifiChannel: string;
  wifiAp: string;
  wifiClient: string;
  saveSuccess: string;
  saveError: string;
  copySuccess: string;
  copyError: string;
  rename: string;
  powerOn: string;
  powerOff: string;
  reload: string;
  clear: string;
  confirm: string;
  yes: string;
  no: string;
  newNote: string;
  deviceOff: string;
  wifiOff: string;
  wifiOn: string;
  statusLabel: string;
  modeLabel: string;
  securityLabel: string;
  channelLabel: string;
  connectedLabel: string;
  exitPingMode: string;
  selectSource: string;
  selectTarget: string;
  alignLeft: string;
  alignTop: string;
  togglePower: string;
  topologyAriaLabel: string;
  fontSizeLabel: string;
  noIp: string;
  deviceNameLabel: string;
  measurementLabel: string;
  noServices: string;
  dhcpPoolLabel: string;
  dnsRecordsLabel: string;
  httpServerLabel: string;
  exportLabel: string;
  pressEnterToConfirm: string;
  enterPassword: string;
  typeCommandPlaceholder: string;
  searchTerminal: string;
  commandReference: string;
  commandsFound: string;
  commandModes: string;
  basicCommands: string;
  allCommands: string;
  globalConfigLabel: string;
  interfaceConfigLabel: string;
  activeSystem: string;
  tutorialWelcomeTitle: string;
  tutorialWelcomeDesc: string;
  tutorialTopologyTitle: string;
  tutorialTopologyDesc: string;
  tutorialCablesTitle: string;
  tutorialCablesDesc: string;
  tutorialDevicesTitle: string;
  tutorialDevicesDesc: string;
  tutorialPingTitle: string;
  tutorialPingDesc: string;
  tutorialWifiTitle: string;
  tutorialWifiDesc: string;
  tutorialProjectTitle: string;
  tutorialProjectDesc: string;
  tutorialThemeTitle: string;
  tutorialThemeDesc: string;
  tutorialReadyTitle: string;
  tutorialReadyDesc: string;
  projectSaved: string;
  jsonDownloaded: string;
  invalidProject: string;
  corruptedProject: string;
  wifiDhcpStatusUpdated: string;
  // Environmental settings
  environmentSettings: string;
  environmentBackground: string;
  backgroundNone: string;
  backgroundHouse: string;
  backgroundTwoStoryGarage: string;
  backgroundGreenhouse: string;
  temperature: string;
  humidity: string;
  lightLevel: string;
  celsius: string;
  percent: string;
  // Room labels for floor plan
  room1: string;
  room2: string;
  bedroom: string;
  livingRoom: string;
  kitchen: string;
  bathroom: string;
  contactTitle: string;
  contactName: string;
  contactEmail: string;
  contactType: string;
  contactMessage: string;
  contactSend: string;
  bugReport: string;
  suggestion: string;
  other: string;
  tabDescTopology: string;
  tabDescCmd: string;
  tabDescTerminal: string;
  tabDescTasks: string;
  networkStatusUpdated: string;
  networkRefreshed: string;
  noWifiDevices: string;
  importSuccess: string;
  pcDisconnected: string;
  apNoClients: string;
  dhcpNoPool: string;
  dhcpNoLease: string;
  newMessage: string;
  sending: string;
  savedViaSheets: string;
  dhcpNotFound: string;
  congrats: string;
  contactSuccessTitle: string;
  contactSuccessDesc: string;
  contactErrorTitle: string;
  contactErrorDesc: string;
  sizeLabel: string;
  resizeLabel: string;
  pingFailed: string;
  pingSuccess: string;
  completeWithTab: string;
  cmdSuggestions: string;
  noteStyle: string;
  open: string;
  ping: string;
  addIoT: string;
  addPC: string;
  addL2Switch: string;
  addL3Switch: string;
  devicesCount: string;
  none: string;
  openNewProject: string;
  openNewProjectDesc: string;
  searchProjects: string;
  emptyProject: string;
  emptyProjectDesc: string;
  skip: string;
  back: string;
  finish: string;
  next: string;
  switchTerminal: string;
  switchTasks: string;
  deviceTasksAndConfig: string;
  cliInterface: string;
  connectionError: string;
  lightMode: string;
  darkMode: string;
  highRes: string;
  lowRes: string;
  quickActions: string;
  new: string;
  tour: string;
  searchShort: string;
  straightCable: string;
  crossoverCable: string;
  consoleCable: string;
  straightShort: string;
  crossoverShort: string;
  consoleShort: string;
  fullScreenMode: string;
  unsaved: string;
  saved: string;
  lastSavedAt: string;
  pan: string;
  boxSelect: string;
  menu: string;
  clickIconsToRun: string;
  tabsShort: string;
  taskCompleted: string;
  taskFailed: string;
  channelShort: string;
  signal: string;
  services: string;
  openCMD: string;
  openCLI: string;
  ipMode: string;
  static: string;
  portsShort: string;
  connectedShort: string;
  routing: string;
  enabled: string;
  disabled: string;
  pools: string;
  routerInfoPanel: string;
  expand: string;
  minimize: string;
  overview: string;
  deviceInformation: string;
  ipRouting: string;
  ipInterfaces: string;
  noIpInterfaces: string;
  portSummary: string;
  notConnected: string;
  shutdownStatus: string;
  noWifiConfig: string;
  dhcpPoolConfig: string;
  dhcpCliConfig: string;
  wifiStatus: string;
  connectedStatus: string;
  disconnectedStatus: string;
}

const translations: Record<Language, Translations> = {
  tr: {
    resetView: 'resetView',
    exit: 'exit',
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
    help: 'Yardım',
    nosVersion: 'NOS Versiyon',
    model: 'Model',
    uptime: 'Uptime',
    activePorts: 'Aktif Portlar',
    tips: 'İpuçları',
    levelBasic: 'Basit Seviye',
    levelIntermediate: 'Orta Seviye',
    levelAdvanced: 'İleri Seviye',
    portClickTip: 'Port LED\'lerine tıklayarak hızlıca interface moduna geçebilirsiniz',
    simulatorTitle: 'Network Simulator 2026 v1.0',
    simulatorCopyright: 'Telif hakkı (c) 2026 Simulator. Tüm hakları saklıdır.',
    theme: 'Tema',
    light: 'Açık',
    dark: 'Koyu',
    language: 'tr',
    clearTerminalBtn: 'Temizle',
    switchMode: 'Switch Modu',
    newVlanLabel: 'Yeni VLAN',
    pcTerminal: 'PC Terminali',
    pcConnected: 'PC bağlı',
    pcNotConnected: 'Herhangi bir switch veya router\'a bağlı değilsiniz.',
    pcCableError: 'Ağ kablosu bağlı değil.',
    pcIncompatibleCable: 'Kablo tipi uyumsuz. PC-Switch için Düz Kablo gerekli.',
    pcAccessDenied: 'Adrese doğrudan erişim yok.',
    pcConsoleTip: 'Konsol kablosuyla bağlısınız. Lütfen, "terminal" komutunu kullanın.',
    pcPingError: 'Ping isteği zaman aşımına uğradı.',
    pcTelnetError: 'TELNET: Bağlantı kurulamadı.',
    pcTracertError: 'TRACERT: Hedefe ulaşılamıyor.',
    pcNslookupError: 'NSLOOKUP: DNS sunucusuyla iletişim kurulamadı.',
    pcIpconfigError: 'IP yapılandırması alınamadı.',
    pcTerminalClosing: 'PC terminali kapatılıyor...',
    consolePingNotAllowed: 'Console bağlantısı üzerinden ping yapılamaz.',
    pcLoginSuccess: 'Giriş başarılı',
    pcConnectionClosed: 'Bağlantı uzak bilgisayar tarafından kapatıldı.',
    copyToastSuccessTitle: 'Kopyalandı',
    copyToastSuccessDescription: 'Çıktı panoya kopyalandı.',
    copyToastFailureTitle: 'Kopyalama başarısız',
    copyToastFailureDescription: 'Panoya erişilemedi.',
    consolePasswordErrorTitle: 'Parola Hatalı',
    consolePasswordErrorDescription: 'Lütfen doğru parolayı girin.',
    pcConnectionError: 'Bağlantı hatası',
    dnsInvalidAddress: 'DNS adresi geçersiz veya eksik.',
    dnsGatewayRequired: 'DNS sunucusuna erişim için gateway gerekli.',
    targetGatewayRequired: 'Hedefe erişim için gateway gerekli.',
    dnsAddressRequired: 'Alan adı çözümlemek için DNS adresi gerekli.',
    pcNoDeviceConnected: 'Bağlı bir cihaz yok',
    pcConsoleHelp: 'Mevcut komutlar:\n  enable   - Privileged mode\n  exit     - Konsoldan çık\n  show     - Bilgi göster\n  ?        - Yardım\n',
    searchOutputTitle: 'Çıktıda ara',
    searchOutputDescription: 'Eşleşmeler çıktı alanında vurgulanır.',
    searchPlaceholder: 'Arama...',
    commandPromptTab: 'Komut İstemi',
    consoleTab: 'Konsol',
    settingsTab: 'Ayarlar',
    servicesTab: 'Servisler',
    ipConfigurationLabel: 'IP Yapılandırma',
    staticLabel: 'Statik',
    dnsRecordManagerTip: 'Alan adı -> IP adresi kayıtlarını yönet.',
    dnsDomainPlaceholder: 'Alan adı (site.local)',
    dnsAddressPlaceholder: 'Adres (192.168.1.10)',
    addDnsRecord: 'Kayıt Ekle',
    dnsNoRecords: 'Henüz DNS kaydı yok.',
    httpServiceDescription: 'HTTP açıkken bu cihazın web içeriği yayınlanır.',
    dhcpPoolsDescription: 'DHCP havuzlarını ekle, düzenle ve sil.',
    dhcpPoolNamePlaceholder: 'Havuz Adı',
    dhcpPoolGatewayPlaceholder: 'Varsayılan Ağ Geçidi',
    dhcpPoolDnsPlaceholder: 'DNS Sunucusu',
    dhcpPoolStartIpPlaceholder: 'Start IP',
    dhcpPoolSubnetPlaceholder: 'Alt Ağ Maskesi',
    dhcpPoolMaxUsersPlaceholder: 'Maksimum Kullanıcı',
    addPool: 'Havuz Ekle',
    updatePool: 'Havuzu Güncelle',
    noDhcpPools: 'Henüz DHCP havuzu yok.',
    edit: 'Düzenle',
    load: 'Yükle',
    saveLabel: 'Kaydet',
    languageLabel: 'Dil',
    themeLabel: 'Tema',
    errorPrefix: 'HATA',
    newBtn: 'Yeni',
    dhcpEnabled: 'DHCP Etkin',
    openServices: 'Açık Servisler',
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
    undo: 'Geri Al',
    redo: 'Yinele',
    newProject: 'Yeni Proje',
    saveProject: 'Projeyi Kaydet',
    loadProject: 'Proje Yükle',
    about: 'Yardım',
    noDevicesInTopology: 'Topolojide henüz cihaz yok.',
    addDevicesFirst: 'Önce Cihaz Ekleyin',
    selectDeviceDropdown: 'Cihaz Seç',
    vlanNameExample: 'Örn: Muhasebe',
    hostnameExample: 'Örn: Router-X',
    aboutTitle: 'Hakkında',
    aboutIntro: 'Bu uygulama, ağ teknolojilerini ve terminal komutlarını öğrenmek isteyenler için tasarlanmış interaktif bir simülasyon aracıdır.',
    termsAndConditions: 'Şartlar ve Koşullar',
    termsText: 'Bu yazılım eğitim amaçlıdır. Ticari olmayan amaçlarla özgürce kullanılabilir ve dağıtılabilir.',
    licenseInfo: 'Tuzla Mesleki ve Teknik Anadolu Lisesi',
    close: 'Kapat',
    startTour: 'Tur',
    gitAddressLabel: 'Kaynak Adresi',
    openSourceInfo: 'Bu proje açık kaynaklıdır',
    connectDevices: 'Bağla',
    addDevice: 'Cihaz Ekle',
    addPc: 'PC Ekle',
    addSwitch: 'Switch Ekle',
    addRouter: 'Router Ekle',
    addNote: 'Not',
    cableType: 'Kablo Tipi',
    straight: 'Düz',
    crossover: 'Çapraz',
    console: 'Konsol',
    linkFrom: 'Bağlantı',
    selectSourcePort: 'Kaynak Portu Seç',
    selectTargetPort: 'Hedef Portu Seç',
    step1: 'Adım 1: Kaynak',
    step2: 'Adım 2: Hedef',
    freePorts: 'boş port',
    noFreePorts: 'Boş Port Yok',
    noFreePortsMessage: 'Lütfen, önce bazı kabloları çıkarın.',
    reloadPage: 'Sayfayı Yenile',
    delete: 'Sil',
    resize: 'Boyutlandır',
    search: 'Ara',
    copy: 'Kopyala',
    power: 'Güç',
    tasks: 'Görevler',
    basicHint: 'Temel komutlar ve ilk topoloji adımları',
    intermediateHint: 'Servisler, VLAN ve yönlendirme senaryoları',
    advancedHint: 'Kapsamlı kurulum ve doğrulama laboratuvarları',
    syslogStarted: '*** Syslog istemcisi başlatıldı',
    bootReady: 'Hazır!',
    bootLoading: 'Sistem yükleniyor...',
    bootInitializing: 'Donanım başlatılıyor...',
    bootingFlash: 'Flash üzerinden önyükleme yapılıyor...',
    extractingFiles: 'Dosyalar flash üzerinden çıkarılıyor...',
    performanceOptimization: 'Performans Optimizasyonu',
    spatialPartitioning: 'Uzamsal Bölümleme',
    viewportCulling: 'Görünüm Alanı Ayıklama',
    virtualScrolling: 'Sanal Kaydırma',
    skeletonScreens: 'İskelet Ekranlar',
    assetLoading: 'Varlık Yükleme Stratejisi',
    nodePooling: 'Düğüm Havuzlama',
    layer3Switching: 'Katman 3 Anahtarlama',
    routedPorts: 'Yönlendirilmiş Portlar',
    dynamicRouting: 'Dinamik Yönlendirme',
    ipRoutingEngine: 'IP Yönlendirme Motoru',
    routingTasks: 'Yönlendirme Görevleri',
    accessibility: 'Erişilebilirlik',
    ariaManagement: 'ARIA Yönetimi',
    keyboardNav: 'Klavye Navigasyonu',
    highContrast: 'Yüksek Kontrast Desteği',
    screenReader: 'Ekran Okuyucu Duyuruları',
    wifiSignal: 'WiFi Sinyal Gücü',
    wifiConnected: 'WiFi Bağlı',
    wifiDisconnected: 'WiFi Bağlantısı Kesildi',
    wifiConfig: 'WiFi Yapılandırması',
    wifiControlPanel: 'WiFi Kontrol Paneli',
    wifiMode: 'WiFi Modu',
    wifiSsid: 'SSID',
    wifiPassword: 'Şifre',
    wifiSecurity: 'Güvenlik',
    wifiChannel: 'Kanal',
    wifiAp: 'Erişim Noktası (AP)',
    wifiClient: 'İstemci',
    saveSuccess: 'Yapılandırma başarıyla kaydedildi',
    saveError: 'Kaydetme sırasında bir hata oluştu',
    copySuccess: 'Panoya kopyalandı',
    copyError: 'Kopyalama başarısız',
    selectAll: 'Tümünü Seç',
    cut: 'Kes',
    paste: 'Yapıştır',
    rename: 'Yeniden Adlandır',
    powerOn: 'Gücü Aç',
    powerOff: 'Gücü Kapat',
    reload: 'Yeniden Yükle',
    clear: 'Temizle',
    confirm: 'Onayla',
    yes: 'Evet',
    no: 'Hayır',
    newNote: 'Yeni not...',
    deviceOff: 'Cihaz Kapalı',
    wifiOff: 'WiFi Kapalı',
    wifiOn: 'WiFi Açık',
    statusLabel: 'Durum:',
    modeLabel: 'Mod:',
    securityLabel: 'Güvenlik:',
    channelLabel: 'Kanal:',
    connectedLabel: 'Bağlı:',
    refreshNetwork: 'Ağı Yenile',
    exitPingMode: 'Ping modundan çık (ESC)',
    selectSource: 'Kaynak seç',
    selectTarget: 'Hedef seç',
    alignLeft: 'Sola Hizala',
    alignTop: 'Üste Hizala',
    togglePower: 'Gücü Aç/Kapat',
    topologyAriaLabel: 'Ağ topolojisi tuvali. Cihazları sürükleyerek taşıyabilirsiniz.',
    colorLabel: 'Renk',
    fontLabel: 'Yazı Tipi',
    fontSizeLabel: 'Boyut',
    opacityLabel: 'Saydamlık',
    duplicateLabel: 'Çoğalt',
    noIp: 'IP Yok',
    deviceNameLabel: 'Cihaz Adı',
    measurementLabel: 'Ölçüm:',
    noServices: 'Servis yok',
    dhcpPoolLabel: 'DHCP Havuzu',
    dnsRecordsLabel: 'DNS Kayıtları',
    httpServerLabel: 'HTTP Sunucu',
    exportLabel: 'Dışa Aktar',
    pressEnterToConfirm: 'Devam etmek için Enter\'a basın',
    enterPassword: 'Parolayı girin...',
    typeCommandPlaceholder: 'Enter\'a basın veya yazın...',
    searchTerminal: 'Terminal çıktısında arama yapın',
    commandReference: 'Komut Referansı',
    commandsFound: 'komut bulundu',
    commandModes: 'Komut Modları:',
    basicCommands: 'Temel komutlar',
    allCommands: 'Tüm komutlar',
    globalConfigLabel: 'Global yapılandırma',
    interfaceConfigLabel: 'Arayüz yapılandırması',
    activeSystem: 'Aktif Sistem',
    tutorialWelcomeTitle: '🎓 Hoş Geldiniz',
    tutorialWelcomeDesc: 'Network Simulator 2026\'ya hoş geldiniz! Bu kısa turda temel özellikleri keşfedeceksiniz. Bağlantıları yapılandırın, cihazları yönetin ve ağ becerilerinizi geliştirin.',
    tutorialTopologyTitle: '📐 Topoloji Editörü',
    tutorialTopologyDesc: 'Sürükle-bırak ile cihazları yerleştirin. Bağlantı kurmak için: 1) Bağla düğmesine tıkla, 2) Kaynak cihaz/port seç, 3) Hedef cihaz/port seç. Çift tıklama: PC\'de CMD, Switch/Router\'da CLI açar.',
    tutorialCablesTitle: '🔌 Kablo Türleri',
    tutorialCablesDesc: 'Kablo türleri: Straight (mavi) - PC↔Switch/Router, Crossover (turuncu) - Switch↔Switch/Router↔Router, Console (cyan) - PC↔Cihaz yapılandırma bağlantılar.',
    tutorialDevicesTitle: '💻 Cihaz Yönetimi',
    tutorialDevicesDesc: 'Cihazları aç/kapat (güç düğmesi), yapılandır (CLI/Panel), ve monitör et. CLI sekmesinde komut satırından yapılandırma yapın. Görevler sekmesinde VLAN, port ve güvenlik görevlerini tamamlayın.',
    tutorialPingTitle: '📡 Ping ve Bağlantı Testi',
    tutorialPingDesc: 'Ping modu ile cihazlar arası bağlantıyı test edin. Başarılı pingler yeşil, başarısız olanlar kırmızı animasyonla gösterilir. DHCP otomatik IP atama, statik IP için manuel yapılandırma yapın.',
    tutorialWifiTitle: '🌐 WiFi ve Kablosuz',
    tutorialWifiDesc: 'Router ve Switch\'leri Access Point moduna alın (WiFi ayarları). SSID, şifreleme (WPA2/WPA3) ve şifre ayarlayın. PC\'ler otomatik olarak erişim noktalarına bağlanır.',
    tutorialProjectTitle: '💾 Proje Yönetimi',
    tutorialProjectDesc: 'Projeleri kaydet (Ctrl+S), yükle (Ctrl+O) veya yeni başlat (Alt+N). Örnek projeler ile hazır senaryoları inceleyin. Tüm yapılandırmalar JSON formatında kaydedilir.',
    tutorialThemeTitle: '🎨 Arayüz Özelleştirme',
    tutorialThemeDesc: 'Karanlık/Açık tema (🌙/☀️) ve dil (🇹🇷/🇬🇧) tercihlerinizi ayarlayın. Grafik kalitesi düşük/yüksek arasında geçiş yapın. Tüm tercihler tarayıcıda otomatik kaydedilir.',
    tutorialReadyTitle: '🚀 Başlamaya Hazırsınız!',
    tutorialReadyDesc: 'Artık ağ simülasyonuna başlamaya hazırsınız! Örnek projeleri inceleyin veya kendi topolojinizi oluşturun. Yardım paneli (sağ alt köşe) ve komut referansı her zaman yanınızda. İyi çalışmalar!',
    projectSaved: 'Proje kaydedildi',
    jsonDownloaded: 'JSON dosyası indirildi.',
    invalidProject: 'Hata',
    corruptedProject: 'Proje dosyası bozuk veya uyumsuz!',
    wifiDhcpStatusUpdated: '🔄 WiFi + DHCP Durumu Güncellendi',
    dhcpSuccessTitle: 'DHCP ataması başarılı',
    dhcpSuccessDescription: 'DHCP ile {ip} atandı.',
    dhcpFailureTitle: 'DHCP ataması başarısız',
    dhcpFailureDescription: 'DHCP sunucusu bulunamadı.',
    resetToDefaults: 'Varsayılana Sıfırla',
    confirmResetTitle: 'Fabrika Ayarlarına Sıfırla?',
    confirmResetDescription: 'Tüm yapılandırma silinecek ve fabrika ayarları geri yüklenecek. Cihaz yeniden başlatılacak. Bu işlem geri alınamaz.',
    confirmReset: 'Cihazı Sıfırla',
    // Environmental settings
    environmentSettings: 'Ayarlar',
    environmentBackground: 'Arka Plan',
    backgroundNone: 'Yok',
    backgroundHouse: 'Ev Krokisi',
    backgroundTwoStoryGarage: '2 Katlı Bina',
    backgroundGreenhouse: 'Sera Krokisi',
    temperature: 'Sıcaklık',
    humidity: 'Nem',
    lightLevel: 'Işık',
    celsius: '°C',
    percent: '%',
    // Room labels for floor plan
    room1: 'Oda 1',
    room2: 'Oda 2',
    bedroom: 'Yatak',
    livingRoom: 'Salon',
    kitchen: 'Mutfak',
    bathroom: 'Banyo',
    contactTitle: 'Bize Ulaşın / Hata Bildir',
    contactName: 'Adınız',
    contactEmail: 'E-posta Adresiniz',
    contactType: 'Konu',
    contactMessage: 'Mesajınız',
    contactSend: 'Gönder',
    bugReport: 'Böcek / Hata Raporu',
    suggestion: 'Öneri / İstek',
    other: 'Diğer',
    tabDescTopology: 'Cihazları sürükleyip bırakarak ağ topolojisini tasarla.',
    tabDescCmd: 'PC komut satırı ile ping, ipconfig vb. komutları çalıştır.',
    tabDescTerminal: 'Switch / router CLI üzerinden yapılandırma komutlarını çalıştır.',
    tabDescTasks: 'Port, VLAN ve güvenlik görevlerini tamamlayarak puan kazan.',
    networkStatusUpdated: 'Ağ Durumu Tamamen Güncellendi',
    networkRefreshed: 'Ağ Yenilendi',
    noWifiDevices: 'WiFi cihazı bulunamadı',
    importSuccess: 'Dosya başarıyla içe aktarıldı.',
    pcDisconnected: 'PC bağlantısız',
    apNoClients: 'AP istemcisiz',
    dhcpNoPool: 'sunucuda havuz yok',
    dhcpNoLease: 'istemci lease alamadı',
    newMessage: 'Yeni Mesaj',
    sending: 'Gönderiliyor...',
    savedViaSheets: 'Sheets entegrasyonu ile saklanır',
    dhcpNotFound: 'DHCP bulunamadı',
    congrats: 'Tebrikler!',
    contactSuccessTitle: 'Mesaj Gönderildi',
    contactSuccessDesc: 'Mesajınız başarıyla gönderildi. Geri bildiriminiz için teşekkürler!',
    contactErrorTitle: 'Gönderilemedi',
    contactErrorDesc: 'Bir ağ hatası oluştu. Lütfen sonra tekrar deneyin.',
    sizeLabel: 'Boyut',
    resizeLabel: 'Yeniden Boyutlandır',
    pingFailed: 'Ping başarısız',
    pingSuccess: 'Ping başarılı',
    completeWithTab: 'ile tamamla',
    cmdSuggestions: 'Komut önerileri',
    noteStyle: 'Not Biçimi',
    open: 'Aç',
    ping: 'Ping',
    addIoT: 'IoT Ekle',
    addPC: 'PC Ekle',
    addL2Switch: 'L2 Switch Ekle',
    addL3Switch: 'L3 Switch Ekle',
    devicesCount: 'cihaz',
    none: 'Yok',
    openNewProject: 'Yeni Proje Aç',
    openNewProjectDesc: 'Topolojinizi tasarlamaya başlamak için hazır bir senaryo seçin veya boş bir proje ile başlayın.',
    searchProjects: 'Proje ara...',
    emptyProject: 'Boş Proje',
    emptyProjectDesc: 'Sıfırdan temiz bir topoloji ile başla',
    skip: 'Geç',
    back: 'Geri',
    finish: 'Bitir',
    next: 'İleri',
    switchTerminal: "CLI Terminal'e geç",
    switchTasks: 'Görevlere geç',
    deviceTasksAndConfig: 'Cihaz görevleri ve yapılandırma görevleri',
    cliInterface: 'Komut satırı arayüzü',
    connectionError: 'Bağlantı hatası',
    lightMode: 'Açık Tema',
    darkMode: 'Koyu Tema',
    highRes: 'Yüksek Çözünürlük',
    lowRes: 'Düşük Çözünürlük',
    quickActions: 'Hızlı işlemler',
    new: 'Yeni',
    tour: 'Tur',
    searchShort: 'Ara...',
    straightCable: 'Düz Kablo',
    crossoverCable: 'Çapraz Kablo',
    consoleCable: 'Konsol Kablosu',
    straightShort: 'Düz',
    crossoverShort: 'Çapraz',
    consoleShort: 'Konsol',
    fullScreenMode: 'Tam Ekran (Ctrl+F)',
    unsaved: 'Kaydedilmedi',
    saved: 'Kaydedildi',
    lastSavedAt: 'Son kaydedilme: ',
    pan: 'Kaydır',
    boxSelect: 'Kutu',
    menu: 'Menü',
    clickIconsToRun: 'Program çalıştırmak için simgeleri tıklayınız',
    tabsShort: 'Sekmeler',
    taskCompleted: '✓ Görev Tamamlandı',
    taskFailed: '⚠ Görev Başarısız',
    channelShort: 'Kanal',
    signal: 'Sinyal',
    services: 'Servisler',
    openCMD: 'CMD Aç',
    openCLI: 'CLI Aç',
    ipMode: 'IP Modu',
    static: 'STATIK',
    portsShort: 'Portlar',
    connectedShort: 'bağlı',
    routing: 'Yönlendirme',
    enabled: 'Aktif',
    disabled: 'Pasif',
    pools: 'Havuz',
    routerInfoPanel: 'Router Bilgi Paneli',
    expand: 'Genişlet',
    minimize: 'Küçült',
    overview: 'Genel Bakış',
    deviceInformation: 'Cihaz Bilgileri',
    ipRouting: 'IP Yönlendirme',
    ipInterfaces: 'IP Arayüzleri',
    noIpInterfaces: 'IP adresi yapılandırılmış arayüz yok.',
    portSummary: 'Port Özeti',
    notConnected: 'Bağlı Değil',
    shutdownStatus: 'Kapalı',
    noWifiConfig: 'WiFi yapılandırması bulunmuyor.',
    dhcpPoolConfig: 'DHCP havuzu yapılandırması bulunmuyor.',
    dhcpCliConfig: 'DHCP havuzları CLI üzerinden yapılandırılabilir.',
    wifiStatus: 'WiFi Durumu',
    connectedStatus: 'Bağlı',
    disconnectedStatus: 'Bağlı Değil',
  },
  en: {
    resetView: 'resetView',
    exit: 'exit',
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
    levelBasic: 'Basic Level',
    levelIntermediate: 'Intermediate Level',
    levelAdvanced: 'Advanced Level',
    portClickTip: 'Click on port LEDs to quickly switch to interface mode',
    simulatorTitle: 'Network Simulator 2026 v1.0',
    simulatorCopyright: 'Copyright (c) 2026 Simulator. All rights reserved.',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    language: 'en',
    clearTerminalBtn: 'Clear',
    switchMode: 'Switch Mode',
    newVlanLabel: 'New VLAN',
    pcTerminal: 'PC Terminal',
    pcConnected: 'PC connected',
    pcNotConnected: 'You are not connected to any switch or router.',
    pcCableError: 'Network cable not connected.',
    pcIncompatibleCable: 'Incompatible cable type. Straight-through required for PC-Switch.',
    pcAccessDenied: 'no direct access to address.',
    pcConsoleTip: 'Connected via console. Please, use the "terminal" command.',
    pcPingError: 'Ping request timed out.',
    pcTelnetError: 'TELNET: Connection failed.',
    pcTracertError: 'TRACERT: Target unreachable.',
    pcNslookupError: 'NSLOOKUP: Cannot communicate with DNS server.',
    pcIpconfigError: 'Could not retrieve IP configuration.',
    pcTerminalClosing: 'Closing PC terminal...',
    consolePingNotAllowed: 'Ping cannot be sent over a console connection.',
    pcLoginSuccess: 'Login successful',
    pcConnectionClosed: 'Connection closed by foreign host.',
    copyToastSuccessTitle: 'Copied',
    copyToastSuccessDescription: 'Output copied to clipboard.',
    copyToastFailureTitle: 'Copy failed',
    copyToastFailureDescription: 'Clipboard access was blocked.',
    consolePasswordErrorTitle: 'Incorrect Password',
    consolePasswordErrorDescription: 'Please enter the correct password.',
    pcConnectionError: 'Connection error',
    dnsInvalidAddress: 'DNS address is missing or invalid.',
    dnsGatewayRequired: 'Gateway is required to reach DNS server.',
    targetGatewayRequired: 'Gateway is required to reach target.',
    dnsAddressRequired: 'A valid DNS address is required to resolve domain.',
    pcNoDeviceConnected: 'No device connected',
    pcConsoleHelp: 'Available commands:\n  enable   - Enter privileged mode\n  exit     - Disconnect from console\n  show     - Show information\n  ?        - Help\n',
    searchOutputTitle: 'Search output',
    searchOutputDescription: 'Matches will be highlighted in the output.',
    searchPlaceholder: 'Search...',
    commandPromptTab: 'Command Prompt',
    consoleTab: 'Console',
    settingsTab: 'Settings',
    servicesTab: 'Services',
    ipConfigurationLabel: 'IP Configuration',
    staticLabel: 'Static',
    dnsRecordManagerTip: 'Manage domain to IP address records.',
    dnsDomainPlaceholder: 'Domain (site.local)',
    dnsAddressPlaceholder: 'Address (192.168.1.10)',
    addDnsRecord: 'Add Record',
    dnsNoRecords: 'No DNS records yet.',
    httpServiceDescription: 'When enabled, this PC serves web content.',
    dhcpPoolsDescription: 'Add, edit and delete DHCP pools.',
    dhcpPoolNamePlaceholder: 'Pool Name',
    dhcpPoolGatewayPlaceholder: 'Default Gateway',
    dhcpPoolDnsPlaceholder: 'DNS Server',
    dhcpPoolStartIpPlaceholder: 'Start IP',
    dhcpPoolSubnetPlaceholder: 'Subnet Mask',
    dhcpPoolMaxUsersPlaceholder: 'Max User',
    addPool: 'Add Pool',
    updatePool: 'Update Pool',
    noDhcpPools: 'No DHCP pools yet.',
    edit: 'Edit',
    load: 'Load',
    saveLabel: 'Save',
    languageLabel: 'Language',
    themeLabel: 'Theme',
    errorPrefix: 'ERROR',
    newBtn: 'New',
    dhcpEnabled: 'DHCP Enabled',
    openServices: 'Open Services',
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
    undo: 'Undo',
    redo: 'Redo',
    newProject: 'New Project',
    saveProject: 'Save Project',
    loadProject: 'Load Project',
    about: 'Help',
    noDevicesInTopology: 'No devices in topology yet.',
    addDevicesFirst: 'Add Devices First',
    selectDeviceDropdown: 'Select Device',
    vlanNameExample: 'e.g. Sales',
    hostnameExample: 'e.g. Router-X',
    aboutTitle: 'About',
    aboutIntro: 'This application is an interactive simulation tool designed for those who want to learn network technologies and terminal commands.',
    termsAndConditions: 'Terms and Conditions',
    termsText: 'This software is for educational purposes. It can be freely used and distributed for non-commercial purposes.',
    licenseInfo: 'Tuzla Vocational and Technical Anatolian High School',
    startTour: 'Tour',
    gitAddressLabel: 'Source Address',
    openSourceInfo: 'This project is open-source',
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
    freePorts: 'free ports',
    noFreePorts: 'No Free Ports',
    noFreePortsMessage: 'Please, disconnect some cables first.',
    reloadPage: 'Reload page',
    delete: 'Delete',
    resize: 'Resize',
    search: 'Search',
    copy: 'Copy',
    power: 'Power',
    tasks: 'Tasks',
    basicHint: 'Core commands and first topology steps',
    intermediateHint: 'Services, VLAN and routing scenarios',
    advancedHint: 'Comprehensive setup and verification labs',
    syslogStarted: '*** Syslog client started',
    bootReady: 'Ready!',
    bootLoading: 'Loading system...',
    bootInitializing: 'Initializing hardware...',
    bootingFlash: 'Booting from flash...',
    extractingFiles: 'Extracting files from flash...',
    performanceOptimization: 'Performance Optimization',
    spatialPartitioning: 'Spatial Partitioning',
    viewportCulling: 'Viewport Culling',
    virtualScrolling: 'Virtual Scrolling',
    skeletonScreens: 'Skeleton Screens',
    assetLoading: 'Asset Loading Strategy',
    nodePooling: 'Node Pooling',
    layer3Switching: 'Layer 3 Switching',
    routedPorts: 'Routed Ports',
    dynamicRouting: 'Dynamic Routing',
    ipRoutingEngine: 'IP Routing Engine',
    routingTasks: 'Routing Tasks',
    accessibility: 'Accessibility',
    ariaManagement: 'ARIA Management',
    keyboardNav: 'Keyboard Navigation',
    highContrast: 'High Contrast Support',
    screenReader: 'Screen Reader Announcements',
    wifiSignal: 'WiFi Signal Strength',
    wifiConnected: 'WiFi Connected',
    wifiDisconnected: 'WiFi Disconnected',
    wifiConfig: 'WiFi Configuration',
    wifiControlPanel: 'WiFi Control Panel',
    wifiMode: 'WiFi Mode',
    wifiSsid: 'SSID',
    wifiPassword: 'Password',
    wifiSecurity: 'Security',
    wifiChannel: 'Channel',
    wifiAp: 'Access Point (AP)',
    wifiClient: 'Client',
    saveSuccess: 'Configuration saved successfully',
    saveError: 'Error occurred while saving',
    copySuccess: 'Copied to clipboard',
    copyError: 'Copy failed',
    selectAll: 'Select All',
    cut: 'Cut',
    paste: 'Paste',
    rename: 'Rename',
    powerOn: 'Power On',
    powerOff: 'Power Off',
    reload: 'Reload',
    clear: 'Clear',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    newNote: 'New note...',
    deviceOff: 'Device Off',
    wifiOff: 'WiFi Off',
    wifiOn: 'WiFi On',
    statusLabel: 'Status:',
    modeLabel: 'Mode:',
    securityLabel: 'Security:',
    channelLabel: 'Channel:',
    connectedLabel: 'Connected:',
    refreshNetwork: 'Refresh Network',
    exitPingMode: 'Exit ping mode (ESC)',
    selectSource: 'Select source',
    selectTarget: 'Select target',
    alignLeft: 'Align Left',
    alignTop: 'Align Top',
    togglePower: 'Toggle Power',
    topologyAriaLabel: 'Network topology canvas. You can drag devices to move them.',
    colorLabel: 'Color',
    fontLabel: 'Font',
    fontSizeLabel: 'Size',
    opacityLabel: 'Opacity',
    duplicateLabel: 'Duplicate',
    noIp: 'No IP',
    deviceNameLabel: 'Device Name',
    measurementLabel: 'Measurement:',
    noServices: 'No services',
    dhcpPoolLabel: 'DHCP Pool',
    dnsRecordsLabel: 'DNS Records',
    httpServerLabel: 'HTTP Server',
    exportLabel: 'Export',
    pressEnterToConfirm: 'Press Enter to confirm',
    enterPassword: 'Enter password...',
    typeCommandPlaceholder: 'Press Enter or type...',
    searchTerminal: 'Search in terminal output',
    commandReference: 'Command Reference',
    commandsFound: 'commands found',
    commandModes: 'Command Modes:',
    basicCommands: 'Basic commands',
    allCommands: 'All commands',
    globalConfigLabel: 'Global config',
    interfaceConfigLabel: 'Interface config',
    activeSystem: 'Active System',
    tutorialWelcomeTitle: '🎓 Welcome',
    tutorialWelcomeDesc: 'Welcome to Network Simulator 2026! This quick tour will show you the essential features. Configure connections, manage devices, and develop your networking skills.',
    tutorialTopologyTitle: '📐 Topology Editor',
    tutorialTopologyDesc: 'Drag and drop to position devices. To connect: 1) Click Connect button, 2) Select source device/port, 3) Select target device/port. Double-click: Opens CMD on PC, CLI on Switch/Router.',
    tutorialCablesTitle: '🔌 Cable Types',
    tutorialCablesDesc: 'Cable types: Straight (blue) - PC↔Switch/Router, Crossover (orange) - Switch↔Switch/Router↔Router, Console (cyan) - PC↔Device config connections.',
    tutorialDevicesTitle: '💻 Device Management',
    tutorialDevicesDesc: 'Power on/off devices (power button), configure (CLI/Panel), and monitor. Use CLI tab for command-line configuration. Complete VLAN, port and security tasks in Tasks tab.',
    tutorialPingTitle: '📡 Ping Connectivity',
    tutorialPingDesc: 'Test connectivity with Ping mode. Successful pings show green, failed ones show red animation. DHCP auto-assigns IPs, or configure static IPs manually.',
    tutorialWifiTitle: '🌐 WiFi Wireless',
    tutorialWifiDesc: 'Set Routers and Switches to Access Point mode (WiFi settings). Configure SSID, encryption (WPA2/WPA3) and password. PCs automatically connect to available access points.',
    tutorialProjectTitle: '💾 Project Management',
    tutorialProjectDesc: 'Save (Ctrl+S), load (Ctrl+O), or start new projects (Alt+N). Explore ready scenarios with example projects. All configurations are saved in JSON format.',
    tutorialThemeTitle: '🎨 Interface Customization',
    tutorialThemeDesc: 'Set Dark/Light theme (🌙/☀️) and language (🇹🇷/🇬🇧) preferences. Toggle graphics quality between low/high. All preferences are automatically saved in browser.',
    tutorialReadyTitle: '🚀 You\'re Ready!',
    tutorialReadyDesc: 'You\'re now ready to start network simulation! Explore example projects or create your own topology. Help panel (bottom-right) and command reference are always available. Good luck!',
    projectSaved: 'Project saved',
    jsonDownloaded: 'JSON file downloaded.',
    invalidProject: 'Error',
    corruptedProject: 'Project file is corrupted or incompatible!',
    wifiDhcpStatusUpdated: '🔄 WiFi + DHCP Status Updated',
    dhcpSuccessTitle: 'DHCP assignment successful',
    dhcpSuccessDescription: 'Assigned via DHCP: {ip}',
    dhcpFailureTitle: 'DHCP assignment failed',
    dhcpFailureDescription: 'No DHCP server found.',
    resetToDefaults: 'Reset to Defaults',
    confirmResetTitle: 'Reset to Factory Defaults?',
    confirmResetDescription: 'This will erase all configuration and restore factory defaults. The device will reload. This action cannot be undone.',
    confirmReset: 'Reset Device',
    close: 'Close',
    // Environmental settings
    environmentSettings: 'Settings',
    environmentBackground: 'Background',
    backgroundNone: 'None',
    backgroundHouse: 'House Sketch',
    backgroundTwoStoryGarage: '2-Story Building',
    backgroundGreenhouse: 'Greenhouse Sketch',
    temperature: 'Temperature',
    humidity: 'Humidity',
    lightLevel: 'Light',
    celsius: '°C',
    percent: '%',
    // Room labels for floor plan
    room1: 'Room 1',
    room2: 'Room 2',
    bedroom: 'Bedroom',
    livingRoom: 'Living Room',
    kitchen: 'Kitchen',
    bathroom: 'Bathroom',
    contactTitle: 'Contact / Bug Report',
    contactName: 'Your Name',
    contactEmail: 'Your Email',
    contactType: 'Topic',
    contactMessage: 'Your Message',
    contactSend: 'Send Now',
    bugReport: 'Bug Report',
    suggestion: 'Suggestion / Request',
    other: 'Other',
    tabDescTopology: 'Design the network topology by dragging and dropping devices.',
    tabDescCmd: 'Run commands like ping, ipconfig, etc. via PC command line.',
    tabDescTerminal: 'Run configuration commands via Switch / router CLI.',
    tabDescTasks: 'Earn points by completing port, VLAN and security tasks.',
    networkStatusUpdated: 'Network Status Fully Updated',
    networkRefreshed: 'Network Refreshed',
    noWifiDevices: 'No WiFi device found',
    importSuccess: 'File imported successfully.',
    pcDisconnected: 'PC disconnected',
    apNoClients: 'AP has no clients',
    dhcpNoPool: 'no pool on server',
    dhcpNoLease: 'client could not get lease',
    newMessage: 'New Message',
    sending: 'Sending...',
    savedViaSheets: 'Saved via Sheets integration',
    dhcpNotFound: 'No DHCP found',
    congrats: 'Congratulations!',
    contactSuccessTitle: 'Message Sent',
    contactSuccessDesc: 'Thank you for your feedback!',
    contactErrorTitle: 'Send Failed',
    contactErrorDesc: 'A network error occurred. Please try again later.',
    sizeLabel: 'Size',
    resizeLabel: 'Resize',
    pingFailed: 'Ping failed',
    pingSuccess: 'Ping successful',
    completeWithTab: 'to complete',
    cmdSuggestions: 'Command suggestions',
    noteStyle: 'Note Style',
    open: 'Open',
    ping: 'Ping',
    addIoT: 'Add IoT',
    addPC: 'Add PC',
    addL2Switch: 'Add L2 Switch',
    addL3Switch: 'Add L3 Switch',
    devicesCount: 'devices',
    none: 'None',
    openNewProject: 'Open a New Project',
    openNewProjectDesc: 'Choose a ready scenario to start designing your topology or start with an empty project.',
    searchProjects: 'Search projects...',
    emptyProject: 'Empty Project',
    emptyProjectDesc: 'Start with a clean topology from scratch',
    skip: 'Skip',
    back: 'Back',
    finish: 'Finish',
    next: 'Next',
    switchTerminal: "Switch to CLI Terminal",
    switchTasks: 'Switch to Tasks',
    deviceTasksAndConfig: 'Device tasks and configuration tasks',
    cliInterface: 'Command line interface',
    connectionError: 'Connection error',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    highRes: 'High Resolution',
    lowRes: 'Low Resolution',
    quickActions: 'Quick actions',
    new: 'New',
    tour: 'Tour',
    searchShort: 'Search...',
    straightCable: 'Straight Cable',
    crossoverCable: 'Crossover Cable',
    consoleCable: 'Console Cable',
    straightShort: 'Straight',
    crossoverShort: 'Crossover',
    consoleShort: 'Console',
    fullScreenMode: 'Full Screen (Ctrl+F)',
    unsaved: 'Unsaved',
    saved: 'Saved',
    lastSavedAt: 'Last saved: ',
    pan: 'Pan',
    boxSelect: 'Box',
    menu: 'Menu',
    clickIconsToRun: 'Click icons to run programs',
    tabsShort: 'Tabs',
    taskCompleted: '✓ Task Completed',
    taskFailed: '⚠ Task Failed',
    channelShort: 'Ch',
    signal: 'Signal',
    services: 'Services',
    openCMD: 'Open CMD',
    openCLI: 'Open CLI',
    ipMode: 'IP Mode',
    static: 'STATIC',
    portsShort: 'Ports',
    connectedShort: 'connected',
    routing: 'Routing',
    enabled: 'Enabled',
    disabled: 'Disabled',
    pools: 'Pools',
    routerInfoPanel: 'Router Information Panel',
    expand: 'Expand',
    minimize: 'Minimize',
    overview: 'Overview',
    deviceInformation: 'Device Information',
    ipRouting: 'IP Routing',
    ipInterfaces: 'IP Interfaces',
    noIpInterfaces: 'No interfaces with IP configured.',
    portSummary: 'Port Summary',
    notConnected: 'Not Connected',
    shutdownStatus: 'Shutdown',
    noWifiConfig: 'No WiFi configuration found.',
    dhcpPoolConfig: 'No DHCP pool configuration found.',
    dhcpCliConfig: 'DHCP pools can be configured via CLI.',
    wifiStatus: 'WiFi Status',
    connectedStatus: 'Connected',
    disconnectedStatus: 'Disconnected',
  },
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

  // İlk mount'ta localStorage'dan veya sistem dilinden yükle
  useEffect(() => {
    if (initialized) return;

    try {
      const saved = localStorage.getItem('network-sim-language');
      if (saved === 'tr' || saved === 'en') {
        setLanguage(saved);
      } else {
        const browserLang = navigator.language || (navigator as any).userLanguage;
        const lang = browserLang.startsWith('tr') ? 'tr' : 'en';
        setLanguage(lang);
      }
    } catch {
      // localStorage erişim hatası
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
