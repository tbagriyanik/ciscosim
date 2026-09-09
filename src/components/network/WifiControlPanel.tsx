'use client';

import { CanvasDevice } from './networkTopology.types';
import type { SwitchState } from '@/lib/network/types';
import { getRouterWifiConfig } from './wifiAdminConfig';
import type { WifiAdminConfig, ConnectedIoTDevice, AvailableIoTDevice } from './wifiAdminTypes';
import { renderWifiAdminLoginTemplate } from './wifiAdminLoginTemplate';
import { renderWifiAdminIotTemplate } from './wifiAdminIotTemplate';
import { renderWifiAdminAccountTemplate } from './wifiAdminAccountTemplate';
import { renderWifiConfigFieldTemplates } from './wifiAdminConfigTemplate';
import { sanitizeHTML, safeJSONForHTML } from '@/lib/security/sanitizer';
import { colors } from '@/lib/design-tokens/colors';
import { IFRAME_FONT_FACES_CSS, INRIA_SANS_STACK, GEIST_MONO_STACK } from '@/lib/design-tokens/iframeFonts';
import {
  WIRELESS_CHANNELS_2_4GHZ,
  WIRELESS_CHANNELS_5GHZ,
  formatChannelDisplay,
  normalizeChannel,
} from '@/lib/network/wireless';

export type { ConnectedIoTDevice, AvailableIoTDevice } from './wifiAdminTypes';

interface RouterWebConfig {
  wifi: WifiAdminConfig;
  deviceName: string;
  deviceIp: string;
  deviceId?: string;
  adminPassword?: string;
  username?: string;
  password?: string;
  connectedIotDevices?: ConnectedIoTDevice[];
  availableIotDevices?: AvailableIoTDevice[];
  language?: string;
  device?: CanvasDevice;
  runtimeState?: SwitchState;
}

/**
 * Generates a WiFi Control Panel HTML for router/switch admin interface
 * Styled like a typical router web admin page (e.g., 192.168.1.1)
 */
function generateWifiControlPanelHTML(config: RouterWebConfig, activeTab: string = 'wireless'): string {
  const { wifi, deviceName, deviceIp, deviceId, connectedIotDevices = [], availableIotDevices = [], username, password, language = 'en', device, runtimeState } = config;
  const isTurkish = language === 'tr';
  const pluralize = (count: number, singular: string, plural: string) => (count === 1 ? singular : plural);

  // Sanitized versions for HTML display
  const safeDeviceName = sanitizeHTML(deviceName);
  const safeDeviceIp = sanitizeHTML(deviceIp);
  const safeSsid = sanitizeHTML(wifi.ssid || '');
  const safeWifiPassword = sanitizeHTML(wifi.password || '');
  const onlyIotConnectedDevices = (connectedIotDevices || []).filter(d =>
    d.sensorType !== 'Laptop/PC' &&
    !String(d.id).toLowerCase().startsWith('pc-') &&
    !String(d.id).toLowerCase().startsWith('laptop-')
  );
  const dhcpPool = device?.services?.dhcp?.pools?.[0] || runtimeState?.services?.dhcp?.pools?.[0];
  const dhcpServerEnabled = device?.services?.dhcp?.enabled ?? runtimeState?.services?.dhcp?.enabled ?? true;
  const safeStartIp = sanitizeHTML(dhcpPool?.startIp || '192.168.1.100');
  const safeEndIp = sanitizeHTML(dhcpPool?.endIp || '192.168.1.200');
  const safeGateway = sanitizeHTML(dhcpPool?.defaultGateway || deviceIp || '192.168.1.1');
  const safeSubnet = sanitizeHTML(dhcpPool?.subnetMask || device?.subnet || '255.255.255.0');
  const safeDns = sanitizeHTML(dhcpPool?.dnsServer || deviceIp || '192.168.1.1');
  const safeLeaseTime = String(dhcpPool?.maxUsers || 24);
  // JSON stringified versions for use in <script> blocks to prevent logic corruption and XSS
  // Admin credentials: default admin:admin unless explicitly configured (persisted in services.http)
  const adminUsername = username?.trim() || 'admin';
  const adminPassword = password || 'admin';
  const jsUsername = safeJSONForHTML(adminUsername);
  const jsPassword = safeJSONForHTML(adminPassword);
  const jsDeviceId = safeJSONForHTML(deviceId || '');
  const jsSsid = safeJSONForHTML(wifi.ssid || '');
  const jsWifiPassword = safeJSONForHTML(wifi.password || '');
  const jsChannel = safeJSONForHTML(wifi.channel || '');
  const jsSecurity = safeJSONForHTML(wifi.security || '');

  const defaultSsidsList = wifi.ssids || [
    { id: 'ssid-1', name: isTurkish ? 'Ana Ağ (Primary)' : 'Primary Network', ssid: wifi.ssid || 'WiFi_Network', security: wifi.security || 'wpa2', password: wifi.password || 'password123', band: 'both', enabled: true },
    { id: 'ssid-2', name: isTurkish ? 'Misafir Ağ (Guest)' : 'Guest Network', ssid: (wifi.ssid || 'WiFi') + '_Guest', security: 'open', band: '2.4GHz', enabled: false }
  ];
  const jsCurrentSsidList = safeJSONForHTML(defaultSsidsList);
  const jsConnectedClientsData = safeJSONForHTML(connectedIotDevices || []);
  const jsMacFilterList = safeJSONForHTML(wifi.macFilterList || []);

  const securityOptions = [
    { value: 'open', label: isTurkish ? 'Açık (Güvenlik Yok)' : 'Open (No Security)' },
    { value: 'wep', label: isTurkish ? 'WEP (Wired Equivalent Privacy)' : 'WEP (Wired Equivalent Privacy)' },
    { value: 'wpa', label: isTurkish ? 'WPA Kişisel' : 'WPA Personal' },
    { value: 'wpa2', label: isTurkish ? 'WPA2 Kişisel (Önerilen)' : 'WPA2 Personal (Recommended)' },
    { value: 'wpa3', label: isTurkish ? 'WPA3 Kişisel' : 'WPA3 Personal' },
  ];

  const modeOptions = [
    { value: 'ap', label: isTurkish ? 'Erişim Noktası (AP)' : 'Access Point (AP)' },
    { value: 'client', label: isTurkish ? 'İstemci Modu' : 'Client Mode' },
  ];

  const currentNormalizedChannel = normalizeChannel(wifi.channel);
  const autoOption = `<option value="auto" ${(!wifi.channel || currentNormalizedChannel === 'auto') ? 'selected' : ''}>${isTurkish ? 'Otomatik (Auto - Önerilen)' : 'Auto (Recommended)'}</option>`;

  const optgroup24 = `
    <optgroup label="${isTurkish ? '2.4 GHz Bandı (Kanal 1 - 11)' : '2.4 GHz Band (Channels 1 - 11)'}">
      <option value="2.4GHz" ${wifi.channel === '2.4GHz' ? 'selected' : ''}>${isTurkish ? '2.4 GHz (Varsayılan)' : '2.4 GHz (Default)'}</option>
      ${WIRELESS_CHANNELS_2_4GHZ.map(opt => `<option value="${opt.value}" ${currentNormalizedChannel === opt.value ? 'selected' : ''}>${isTurkish ? opt.labelTr : opt.labelEn}</option>`).join('')}
    </optgroup>
  `;

  const optgroup5 = `
    <optgroup label="${isTurkish ? '5 GHz Bandı (Kanal 36 - 165)' : '5 GHz Band (Channels 36 - 165)'}">
      <option value="5GHz" ${wifi.channel === '5GHz' ? 'selected' : ''}>${isTurkish ? '5 GHz (Yüksek Hız)' : '5 GHz (High Speed)'}</option>
      ${WIRELESS_CHANNELS_5GHZ.map(opt => `<option value="${opt.value}" ${currentNormalizedChannel === opt.value ? 'selected' : ''}>${isTurkish ? opt.labelTr : opt.labelEn}</option>`).join('')}
    </optgroup>
  `;

  const channelSelect = `${autoOption}${optgroup24}${optgroup5}`;

  const securitySelect = securityOptions
    .map(opt => `<option value="${opt.value}" ${wifi.security === opt.value ? 'selected' : ''}>${opt.label}</option>`)
    .join('');

  const modeSelect = modeOptions
    .map(opt => `<option value="${opt.value}" ${wifi.mode === opt.value ? 'selected' : ''}>${opt.label}</option>`)
    .join('');

  const { passwordField, hiddenCheckbox, maxClientsField } = renderWifiConfigFieldTemplates(wifi, isTurkish, safeWifiPassword);

  const loginFormHTML = renderWifiAdminLoginTemplate({ deviceName: safeDeviceName, isTurkish, username: adminUsername });

  const mainContent = `
    <div id="main-content" style="display:none;">
  `;

  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeDeviceName} - ${isTurkish ? 'Kablosuz Ayarları' : 'Wireless Settings'}</title>
  <style>
    ${IFRAME_FONT_FACES_CSS}
    :root {
      --color-primary-500: ${colors.status.info};
      --color-primary-600: ${colors.blue['600']};
      --color-primary-700: ${colors.blue['700']};
      --color-primary-100: ${colors.blue['100']};
      --color-secondary-100: ${colors.terminal.fg};
      --color-secondary-200: ${colors.topology.noteText};
      --color-secondary-300: ${colors.terminal.output};
      --color-secondary-400: ${colors.cables.default};
      --color-secondary-500: ${colors.cables.console};
      --color-secondary-700: ${colors.topology.gridLine};
      --color-secondary-900: ${colors.topology.bg};
      --color-success-500: ${colors.status.active};
      --color-success-600: ${colors.green['600']};
      --color-warning-500: ${colors.packet.http};
      --color-warning-600: ${colors.yellow['600']};
      --color-error-500: ${colors.status.offline};
      --color-error-600: ${colors.red['600']};
      --color-accent-600: ${colors.teal['600']};
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    html, body {
      width: 100%;
      min-height: 100%;
      overflow-y: auto;
      overflow-x: auto;
    }
    
    body {
      font-family: ${INRIA_SANS_STACK};
      background: ${colors.topology.deviceText};
      color: var(--color-secondary-900);
      line-height: 1.5;
      padding: 20px;
      font-size: 14px;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: ${colors.common.white};
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, var(--color-secondary-900) 0%, ${colors.topology.canvasBg} 100%);
      color: ${colors.common.white};
      padding: 24px;
    }
    
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
    .header .subtitle { color: var(--color-secondary-400); font-size: 13px; }
    .header .device-info { display: flex; gap: 16px; margin-top: 12px; font-size: 12px; color: var(--color-secondary-300); }
    
    .nav-tabs { display: flex; background: var(--color-secondary-100); border-bottom: 1px solid var(--color-secondary-200); padding: 0 16px; overflow-x: auto; }
    .nav-tab { padding: 14px 20px; font-weight: 600; font-size: 13px; color: var(--color-secondary-500); cursor: pointer; border: none; background: none; border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap; }
    .nav-tab:hover { color: var(--color-primary-600); }
    .nav-tab.active { color: var(--color-primary-600); border-bottom-color: var(--color-primary-600); }
    
    .content { padding: 24px; }
    .panel-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: var(--color-secondary-900); display: flex; align-items: center; justify-content: space-between; }
    
    .status-card { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, ${colors.sky['50']} 0%, ${colors.sky['50']} 100%); border: 1px solid ${colors.sky['100']}; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .status-card.disabled { background: var(--color-secondary-100); border-color: var(--color-secondary-200); }
    .status-info h3 { font-size: 14px; font-weight: 600; }
    .status-info p { font-size: 12px; color: var(--color-secondary-500); }
    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: var(--color-success-500); color: ${colors.common.white}; }
    .status-card.disabled .status-badge { background: var(--color-secondary-400); }
    
    .form-group { margin-bottom: 18px; }
    .form-group label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; }
    .form-group input[type="text"], .form-group input[type="password"], .form-group input[type="number"], .form-group select {
      width: 100%; padding: 10px 12px; border: 1px solid var(--color-secondary-300); border-radius: 6px; font-size: 13px; font-family: ${INRIA_SANS_STACK}; transition: border-color 0.2s; background-color: var(--color-common-white, #fff); color: var(--color-secondary-900);
    }
    .form-group select option {
      font-size: 13px; font-family: ${INRIA_SANS_STACK}; padding: 6px; background-color: var(--color-white); color: var(--color-secondary-900);
    }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: var(--color-primary-500); box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
    .hint { display: block; font-size: 11px; color: var(--color-secondary-500); margin-top: 4px; }
    
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; font-weight: 600; border-radius: 6px; border: none; cursor: pointer; transition: all 0.2s; font-size: 13px; }
    .btn-primary { background: var(--color-primary-600); color: ${colors.common.white}; }
    .btn-primary:hover { background: var(--color-primary-700); }
    .btn-secondary { background: var(--color-secondary-200); color: var(--color-secondary-700); }
    .btn-secondary:hover { background: var(--color-secondary-300); }
    .btn-danger { background: var(--color-error-500); color: ${colors.common.white}; }
    .btn-danger:hover { background: var(--color-error-600); }
    .btn-block { width: 100%; }
    
    .actions { display: flex; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--color-secondary-200); }
    
    .toggle-switch { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: ${colors.topology.deviceText}; border-radius: 8px; border: 1px solid var(--color-secondary-200); margin-bottom: 20px; }
    .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--color-secondary-300); transition: .3s; border-radius: 24px; }
    .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
    input:checked + .slider { background-color: var(--color-success-500); }
    input:checked + .slider:before { transform: translateX(20px); }
    
    .login-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; overflow-y: auto; box-sizing: border-box; }
    .login-card { background: ${colors.common.white}; border-radius: 12px; width: 100%; max-width: 400px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .login-header { text-align: center; margin-bottom: 24px; }
    .login-icon { font-size: 40px; margin-bottom: 8px; }
    .error-message { background: ${colors.red['50']}; border: 1px solid ${colors.red['200']}; color: var(--color-error-600); padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 16px; text-align: center; }
    .success-message { background: ${colors.green['50']}; border: 1px solid ${colors.green['200']}; color: var(--color-success-700, ${colors.green['700']}); padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 16px; text-align: center; }

    /* Client list table styles */
    .client-card { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: ${colors.topology.deviceText}; border: 1px solid var(--color-secondary-200); border-radius: 8px; margin-bottom: 8px; transition: all 0.2s; }
    .client-card:hover { border-color: var(--color-primary-500); background: ${colors.common.white}; }
    .client-icon { width: 36px; height: 36px; border-radius: 8px; background: var(--color-primary-100); display: flex; align-items: center; justify-content: center; font-size: 18px; color: var(--color-primary-600); shrink: 0; }
    .client-details { display: flex; flex-direction: column; min-width: 0; }
    .client-title { font-weight: 600; color: var(--color-secondary-900); font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .client-sub { font-size: 11px; color: var(--color-secondary-500); font-family: ${GEIST_MONO_STACK}; }
    .mono { font-family: ${GEIST_MONO_STACK}; }
    .client-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; background: var(--color-secondary-100); color: var(--color-secondary-700); }
    .badge-primary { background: ${colors.blue['100']}; color: ${colors.blue['700']}; }
    .badge-success { background: ${colors.green['100']}; color: ${colors.green['700']}; }
    .badge-warning { background: ${colors.yellow['100']}; color: ${colors.yellow['700']}; }

    @media (max-width: 600px) {
      body { padding: 10px; }
      .grid-2 { grid-template-columns: 1fr; gap: 0; }
      .actions { flex-direction: column; }
      .btn { width: 100%; }
      .status-card { flex-direction: column; align-items: flex-start; gap: 10px; }
      .client-card { flex-direction: column; align-items: flex-start; gap: 10px; }
    }
  </style>
</head>
<body>
  ${loginFormHTML}
  ${mainContent}
  <div class="container">
    <div class="header" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
      <div>
        <h1>🔧 ${safeDeviceName}</h1>
        <div class="subtitle">${isTurkish ? 'Kablosuz Ağ Yönetimi & Çoklu SSID Kapısı' : 'Wireless Network Administration & Multi-SSID Portal'}</div>
        <div class="device-info">
          <span>📍 IP: ${safeDeviceIp}</span>
          <span>📡 WLAN Interface: wlan0</span>
        </div>
      </div>
      <button type="button" class="btn btn-secondary" onclick="handleLogout()" style="padding:8px 16px;font-size:12px;background:${colors.common.white};border:1px solid var(--color-secondary-300);color:var(--color-secondary-700);cursor:pointer;shrink:0;border-radius:6px;" title="${isTurkish ? 'Oturumu Kapat' : 'Logout'}">
        🚪 ${isTurkish ? 'Çıkış Yap' : 'Logout'}
      </button>
    </div>
    
    <div class="nav-tabs">
      <button type="button" class="nav-tab${activeTab === 'wireless' ? ' active' : ''}" data-tab="wireless">📶 ${isTurkish ? 'Kablosuz & Çoklu SSID' : 'Wireless & Multi-SSID'}</button>
      <button type="button" class="nav-tab${activeTab === 'status' ? ' active' : ''}" data-tab="status">📊 ${isTurkish ? 'Durum & Bağlı Cihazlar' : 'Status & Connected Clients'}</button>
      <button type="button" class="nav-tab${activeTab === 'advanced' ? ' active' : ''}" data-tab="advanced">⚙️ ${isTurkish ? 'Gelişmiş' : 'Advanced'}</button>
      <button type="button" class="nav-tab${activeTab === 'iot' ? ' active' : ''}" data-tab="iot">🛜 ${isTurkish ? 'IoT Cihazları' : 'IoT Devices'}</button>
      <button type="button" class="nav-tab${activeTab === 'admin' ? ' active' : ''}" data-tab="admin">👤 ${isTurkish ? 'Yönetici' : 'Admin'}</button>
    </div>
    
    <!-- Wireless Tab -->
    <div id="wireless-tab" class="content" style="display:${activeTab === 'wireless' ? 'block' : 'none'};">
      <div class="toggle-switch">
        <div>
          <h3>${isTurkish ? 'Kablosuz Radyo (Ana Anahtar)' : 'Wireless Radio (Master Switch)'}</h3>
          <p>${isTurkish ? 'Kablosuz erişim noktasını genel olarak etkinleştirin veya devre dışı bırakın' : 'Enable or disable the wireless access point globally'}</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="wifi-enabled" ${wifi.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      
      <div class="status-card ${wifi.enabled ? '' : 'disabled'}">
        <div class="status-info">
          <h3>${isTurkish ? 'Mevcut Durum' : 'Current Status'}</h3>
          <p>${wifi.enabled ? (isTurkish ? 'WiFi aktif ve çoklu SSID yayınları açık' : 'WiFi is active and multi-SSID broadcasting is live') : (isTurkish ? 'WiFi şu anda devre dışı' : 'WiFi is currently disabled')}</p>
        </div>
        <span class="status-badge">${wifi.enabled ? (isTurkish ? '● Çevrimiçi' : '● Online') : (isTurkish ? '○ Çevrimdışı' : '○ Offline')}</span>
      </div>
      
      <h2 class="panel-title">${isTurkish ? 'Temel Kablosuz Ayarları' : 'Basic Wireless Settings (Primary SSID)'}</h2>
      
      <form id="wifi-form" onsubmit="handleSavePrimarySettings(event)">
        <div class="form-group">
          <label for="wifi-ssid">${isTurkish ? 'Ana Ağ Adı' : 'Primary Network Name (SSID)'}</label>
          <input type="text" id="wifi-ssid" name="ssid" value="${safeSsid}" placeholder="${isTurkish ? 'WiFi ağ adınızı girin' : 'Enter your WiFi network name'}" maxlength="32" aria-describedby="wifi-ssid-hint">
          <span class="hint" id="wifi-ssid-hint">${isTurkish ? 'Bu ad ana kablosuz yayın olarak görülecektir' : 'This name will be visible as primary wireless broadcast'}</span>
        </div>
        
        <div class="grid-2">
          <div class="form-group">
            <label for="wifi-mode">${isTurkish ? 'Çalışma Modu' : 'Operation Mode'}</label>
            <select id="wifi-mode" name="mode">
              ${modeSelect}
            </select>
          </div>
          
          <div class="form-group">
            <label for="wifi-channel">${isTurkish ? 'Yayın Kanalı (Kanal / Frekans)' : 'Broadcast Channel (Channel / Frequency)'}</label>
            <select id="wifi-channel" name="channel">
              ${channelSelect}
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label for="wifi-security">${isTurkish ? 'Güvenlik Türü' : 'Security Type'}</label>
          <select id="wifi-security" name="security">
            ${securitySelect}
          </select>
          <span class="hint">${isTurkish ? 'Çoğu ağ için WPA2 Kişisel önerilir' : 'WPA2 Personal is recommended for most networks'}</span>
        </div>
        
        <div id="wifi-password-wrap" style="${wifi.security === 'open' ? 'display:none;' : ''}">
          ${passwordField}
        </div>
        
        <div class="grid-2">
          ${hiddenCheckbox}
          ${maxClientsField}
        </div>
        
        <div class="actions">
          <button type="submit" class="btn btn-primary">💾 ${isTurkish ? 'Ana Ayarları Kaydet' : 'Save Primary Settings'}</button>
          <button type="button" class="btn btn-secondary" onclick="location.reload()">↺ ${isTurkish ? 'Sıfırla' : 'Reset'}</button>
        </div>
      </form>

      <!-- Multi-SSID Section -->
      <h2 class="panel-title" style="margin-top:32px;">🌐 ${isTurkish ? 'Çoklu SSID &amp; Misafir Ağ Profilleri' : 'Multi-SSID &amp; Guest Network Profiles'}</h2>
      <p style="color:var(--color-secondary-500);margin-bottom:16px;font-size:13px;">
        ${isTurkish ? 'Erişim noktası üzerinde ek kablosuz yayınlar (Misafir Ağı, IoT Ağı, 5G Yüksek Hız) oluşturun ve yönetin.' : 'Create and manage additional wireless broadcasts (Guest Network, IoT Network, 5G High Speed) on this Access Point.'}
      </p>

      <div id="ssid-profiles-container" style="margin-bottom:20px;"></div>

      <div style="background:${colors.topology.deviceText};padding:20px;border-radius:10px;border:1px solid var(--color-secondary-200);margin-bottom:25px;">
        <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--color-secondary-900);" id="ssid-form-title">
          ➕ ${isTurkish ? 'Yeni SSID Profili Ekle' : 'Add New SSID Profile'}
        </h3>
        <input type="hidden" id="edit-ssid-id" value="">
        
        <div class="grid-2" style="margin-bottom:12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label for="profile-name">${isTurkish ? 'Profil Adı' : 'Profile Name'}</label>
            <input type="text" id="profile-name" placeholder="${isTurkish ? 'örn. Misafir Ağı, IoT Ağı' : 'e.g. Guest WiFi, IoT Network'}">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label for="profile-ssid">${isTurkish ? 'Ağ Adı (SSID)' : 'Network Name (SSID)'}</label>
            <input type="text" id="profile-ssid" placeholder="${isTurkish ? 'örn. Guest-WiFi' : 'e.g. Guest-WiFi'}">
          </div>
        </div>

        <div class="grid-2" style="margin-bottom:12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label for="profile-band">${isTurkish ? 'Frekans / Bant' : 'Frequency / Band'}</label>
            <select id="profile-band">
              <option value="both">${isTurkish ? 'Çift Bant (2.4 GHz & 5 GHz)' : 'Dual Band (2.4 GHz & 5 GHz)'}</option>
              <option value="2.4GHz">2.4 GHz</option>
              <option value="5GHz">5 GHz</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label for="profile-security">${isTurkish ? 'Güvenlik Türü' : 'Security Type'}</label>
            <select id="profile-security" onchange="var pWrap = document.getElementById('profile-password-wrap'); if(pWrap) pWrap.style.display = this.value === 'open' ? 'none' : 'block';">
              <option value="wpa2">${isTurkish ? 'WPA2-PSK (Kişisel)' : 'WPA2-PSK (Personal)'}</option>
              <option value="wpa3">${isTurkish ? 'WPA3-SAE (Yüksek Güvenlik)' : 'WPA3-SAE (High Security)'}</option>
              <option value="open">${isTurkish ? 'Açık (Şifresiz)' : 'Open (No password)'}</option>
              <option value="wep">WEP</option>
            </select>
          </div>
        </div>

        <div class="form-group" id="profile-password-wrap" style="margin-bottom:12px;">
          <label for="profile-password">${isTurkish ? 'Wi-Fi Parolası' : 'Wi-Fi Password'}</label>
          <input type="password" id="profile-password" placeholder="${isTurkish ? 'En az 8 karakter' : 'Minimum 8 characters'}" value="guestpass123">
        </div>

        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--color-secondary-700);">
            <input type="checkbox" id="profile-enabled" checked>
            ${isTurkish ? 'Yayın Etkin (Aktif)' : 'Broadcast Enabled (Active)'}
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--color-secondary-700);">
            <input type="checkbox" id="profile-hidden">
            ${isTurkish ? 'Gizli SSID (SSID Gizle)' : 'Hidden SSID (Hide SSID)'}
          </label>
        </div>

        <div style="display:flex;gap:10px;">
          <button type="button" class="btn btn-primary" onclick="saveSsidProfile()" id="btn-save-ssid-profile">
            💾 ${isTurkish ? 'SSID Profilini Kaydet' : 'Save SSID Profile'}
          </button>
          <button type="button" class="btn btn-secondary" onclick="resetSsidForm()">
            ↺ ${isTurkish ? 'Formu Temizle' : 'Clear Form'}
          </button>
        </div>
      </div>
    </div>
      
    ${renderWifiAdminIotTemplate({
    activeTab,
    isTurkish,
    connectedDevices: onlyIotConnectedDevices,
    availableDevices: availableIotDevices,
  })}

    ${renderWifiAdminAccountTemplate(activeTab, isTurkish, jsUsername)}
    <!-- Status Tab -->
    <div id="status-tab" class="content" style="display:${activeTab === 'status' ? 'block' : 'none'};">
      <h2 class="panel-title">${isTurkish ? 'Ağ Durumu & Bağlı Cihazlar' : 'Network Status & Connected Devices'}</h2>
      
      <div class="grid-2" style="margin-bottom:20px;">
        <div class="status-card">
          <div class="status-info">
            <h3>${isTurkish ? 'WiFi Durumu' : 'WiFi Status'}</h3>
            <p>${wifi.enabled ? (isTurkish ? 'Aktif ve Yayın Yapıyor' : 'Active and Broadcasting') : (isTurkish ? 'Devre Dışı' : 'Disabled')}</p>
          </div>
          <span class="status-badge">${wifi.enabled ? (isTurkish ? '● Çevrimiçi' : '● Online') : (isTurkish ? '○ Çevrimdışı' : '○ Offline')}</span>
        </div>
        <div class="status-card">
          <div class="status-info">
            <h3>${isTurkish ? 'Bağlı Cihazlar (Toplam)' : 'Connected Clients (Total)'}</h3>
            <p id="status-connected-count">${connectedIotDevices.filter(d => d.connected).length} ${isTurkish ? 'cihaz bağlı' : pluralize(connectedIotDevices.filter(d => d.connected).length, 'device connected', 'devices connected')}</p>
          </div>
          <span class="status-badge" id="status-total-badge">${connectedIotDevices.length} ${isTurkish ? 'Toplam' : 'Total'}</span>
        </div>
      </div>

      <!-- Connected Wireless Clients List Section -->
      <h3 style="margin-bottom:12px;font-size:15px;color:var(--color-secondary-900);">${isTurkish ? '📶 Bağlı Kablosuz İstemciler Listesi' : '📶 Connected Wireless Clients List'}</h3>
      <p style="color:var(--color-secondary-500);margin-bottom:16px;font-size:13px;">
        ${isTurkish ? 'Bu erişim noktasına (AP/Router) bağlı tüm kablosuz istemcilerin (PC, Laptop, Akıllı Cihaz, Sensör) canlı listesi:' : 'Live list of all wireless clients (PC, Laptop, Smart Device, Sensor) currently connected to this Access Point:'}
      </p>

      <div id="connected-wireless-clients-container" style="margin-bottom:24px;"></div>

      <div style="background:${colors.topology.deviceText};padding:20px;border-radius:10px;border:1px solid var(--color-secondary-200);">
        <h3 style="margin-bottom:15px;font-size:15px;color:var(--color-secondary-900);">${isTurkish ? 'Ağ & Yayın Bilgileri' : 'Network & Broadcast Information'}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
          <div><strong>SSID (Ana):</strong> ${safeSsid || (isTurkish ? 'Yapılandırılmadı' : 'Not configured')}</div>
          <div><strong>${isTurkish ? 'Güvenlik' : 'Security'}:</strong> ${sanitizeHTML(wifi.security.toUpperCase())}</div>
          <div><strong>${isTurkish ? 'Kanal' : 'Channel'}:</strong> ${sanitizeHTML(formatChannelDisplay(wifi.channel, language))}</div>
          <div><strong>${isTurkish ? 'Mod' : 'Mode'}:</strong> ${sanitizeHTML(wifi.mode.toUpperCase())}</div>
          <div style="grid-column: 1 / -1;"><strong>${isTurkish ? 'MAC Filtresi' : 'MAC Filter'}:</strong> ${wifi.macFilterEnabled ? (wifi.macFilterMode === 'deny' ? (isTurkish ? '● Etkin (Engelleme: ' + (wifi.macFilterList?.length || 0) + ' adres)' : '● Enabled (Deny: ' + (wifi.macFilterList?.length || 0) + ' items)') : (isTurkish ? '● Etkin (Erişim: ' + (wifi.macFilterList?.length || 0) + ' adres)' : '● Enabled (Allow: ' + (wifi.macFilterList?.length || 0) + ' items)')) : (isTurkish ? '○ Devre Dışı' : '○ Disabled')}</div>
        </div>
      </div>
    </div>
    
    <!-- Advanced Tab -->
    <div id="advanced-tab" class="content" style="display:${activeTab === 'advanced' ? 'block' : 'none'};">
      <h2 class="panel-title">${isTurkish ? 'Gelişmiş Kablosuz Ayarları' : 'Advanced Wireless Settings'}</h2>
      <p style="color:var(--color-secondary-500);margin-bottom:20px;">${isTurkish ? 'Kablosuz MAC adresi filtreleme ve güvenlik kurallarını yapılandırın.' : 'Configure wireless MAC address filtering and security rules.'}</p>
      
      <div style="background:${colors.topology.deviceText};border:1px solid var(--color-secondary-200);border-radius:10px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:16px;color:var(--color-secondary-900);">🛡️ ${isTurkish ? 'Kablosuz MAC Adresi Filtreleme' : 'Wireless MAC Address Filtering'}</h3>
            <p style="margin:0;font-size:13px;color:var(--color-secondary-500);">${isTurkish ? 'Kablosuz ağa yalnızca izin verilen cihazların erişmesini sağlayın veya belirli cihazları engelleyin.' : 'Allow only permitted devices to access the wireless network or block specific devices.'}</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="mac-filter-enabled" ${wifi.macFilterEnabled ? 'checked' : ''} onchange="toggleMacFilterSection()">
            <span class="slider"></span>
          </label>
        </div>

        <div id="mac-filter-body" style="display:${wifi.macFilterEnabled ? 'block' : 'none'};">
          <div style="margin-bottom:16px;padding:12px;background:white;border-radius:8px;border:1px solid var(--color-secondary-200);">
            <label style="display:block;font-weight:600;font-size:13px;margin-bottom:8px;">${isTurkish ? 'Filtreleme Modu:' : 'Filtering Mode:'}</label>
            <div style="display:flex;gap:20px;">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;">
                <input type="radio" name="macFilterMode" value="allow" ${wifi.macFilterMode !== 'deny' ? 'checked' : ''}>
                <span>✅ ${isTurkish ? 'İzin Ver (Yalnızca listedeki MAC adreslerine izin ver)' : 'Allow (Allow only MAC addresses in list)'}</span>
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;">
                <input type="radio" name="macFilterMode" value="deny" ${wifi.macFilterMode === 'deny' ? 'checked' : ''}>
                <span>🚫 ${isTurkish ? 'Engelle (Listede olan MAC adreslerini engelle)' : 'Deny (Block MAC addresses in list)'}</span>
              </label>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-weight:600;font-size:13px;margin-bottom:6px;">${isTurkish ? 'MAC Adresi Ekle:' : 'Add MAC Address:'}</label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="manual-mac-input" placeholder="00:11:22:33:44:55" style="font-family:${GEIST_MONO_STACK}">
              <button type="button" class="btn btn-secondary" onclick="addManualMac()">➕ ${isTurkish ? 'Ekle' : 'Add'}</button>
            </div>
          </div>

          <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:600;font-size:13px;">${isTurkish ? 'Filtrelenen MAC Adresleri:' : 'Filtered MAC Addresses:'}</span>
            <span id="mac-list-count" class="status-badge" style="background:var(--color-secondary-700);">${(wifi.macFilterList || []).length} ${isTurkish ? 'adres' : 'items'}</span>
          </div>

          <div id="mac-filter-list-container" style="max-height:200px;overflow-y:auto;background:var(--color-secondary-100);padding:10px;border-radius:8px;border:1px solid var(--color-secondary-200);">${(wifi.macFilterList || []).map(mac => `<div class="mac-filter-entry">${mac}</div>`).join('')}</div>
        </div>
      </div>

      <!-- DHCP Server Settings Section -->
      <div style="background:${colors.topology.deviceText};border:1px solid var(--color-secondary-200);border-radius:10px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:16px;color:var(--color-secondary-900);">🌐 ${isTurkish ? 'DHCP Sunucusu Ayarları' : 'DHCP Server Settings'}</h3>
            <p style="margin:0;font-size:13px;color:var(--color-secondary-500);">${isTurkish ? 'Ağa bağlanan cihazlara otomatik IP adresi dağıtımını ve ağ parametrelerini yapılandırın.' : 'Configure automatic IP assignment and network parameters for connected devices.'}</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="dhcp-server-enabled" ${dhcpServerEnabled ? 'checked' : ''} onchange="toggleDhcpServerSection()">
            <span class="slider"></span>
          </label>
        </div>

        <div id="dhcp-server-body" style="display:${dhcpServerEnabled ? 'block' : 'none'};">
          <div class="grid-2" style="margin-bottom:12px;">
            <div class="form-group">
              <label for="dhcp-start-ip">${isTurkish ? 'Başlangıç IP Adresi' : 'Start IP Address'}</label>
              <input type="text" id="dhcp-start-ip" value="${safeStartIp}" placeholder="192.168.1.100" style="font-family:${GEIST_MONO_STACK};">
            </div>
            <div class="form-group">
              <label for="dhcp-end-ip">${isTurkish ? 'Bitiş IP Adresi' : 'End IP Address'}</label>
              <input type="text" id="dhcp-end-ip" value="${safeEndIp}" placeholder="192.168.1.200" style="font-family:${GEIST_MONO_STACK};">
            </div>
          </div>

          <div class="grid-2" style="margin-bottom:12px;">
            <div class="form-group">
              <label for="dhcp-gateway">${isTurkish ? 'Varsayılan Ağ Geçidi' : 'Default Gateway'}</label>
              <input type="text" id="dhcp-gateway" value="${safeGateway}" placeholder="192.168.1.1" style="font-family:${GEIST_MONO_STACK};">
            </div>
            <div class="form-group">
              <label for="dhcp-subnet">${isTurkish ? 'Alt Ağ Maskesi' : 'Subnet Mask'}</label>
              <input type="text" id="dhcp-subnet" value="${safeSubnet}" placeholder="255.255.255.0" style="font-family:${GEIST_MONO_STACK};">
            </div>
          </div>

          <div class="grid-2" style="margin-bottom:12px;">
            <div class="form-group">
              <label for="dhcp-dns">${isTurkish ? 'Birincil DNS Sunucusu' : 'Primary DNS Server'}</label>
              <input type="text" id="dhcp-dns" value="${safeDns}" placeholder="192.168.1.1" style="font-family:${GEIST_MONO_STACK};">
            </div>
            <div class="form-group">
              <label for="dhcp-lease">${isTurkish ? 'Kiralama Süresi (Saat)' : 'Lease Time (Hours)'}</label>
              <input type="number" id="dhcp-lease" value="${safeLeaseTime}" min="1" max="720" style="font-family:${GEIST_MONO_STACK};">
            </div>
          </div>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn btn-primary" id="save-advanced-btn" onclick="saveMacFilterSettings()">💾 ${isTurkish ? 'Gelişmiş Ayarları Kaydet' : 'Save Advanced Settings'}</button>
      </div>
    </div>
  </div>

  <script>
    var isTurkish = ${isTurkish ? 'true' : 'false'};
    function escH(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
    var selectedIotDevices = new Set();
    var currentSsidList = ${jsCurrentSsidList};
    window.currentSsidList = currentSsidList;

    var connectedClientsData = ${jsConnectedClientsData};
    var currentMacFilterList = ${jsMacFilterList};
    if (!Array.isArray(currentMacFilterList)) currentMacFilterList = [];
    window.currentMacFilterList = currentMacFilterList;

    window.toggleMacFilterSection = function() {
      var enabled = !!document.getElementById('mac-filter-enabled')?.checked;
      var body = document.getElementById('mac-filter-body');
      if (body) body.style.display = enabled ? 'block' : 'none';
      saveAllWifiSettings();
    };

    window.renderMacFilterList = function() {
      var container = document.getElementById('mac-filter-list-container');
      var countEl = document.getElementById('mac-list-count');
      if (!container) return;

      var list = window.currentMacFilterList || [];
      if (countEl) {
        countEl.textContent = list.length + ' ' + (isTurkish ? 'adres' : 'items');
      }

      if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:12px;color:var(--color-secondary-400);">' +
          (isTurkish ? 'Filtrelenmiş MAC adresi bulunmuyor.' : 'No filtered MAC addresses.') + '</div>';
        return;
      }

      container.innerHTML = list.map(function(mac, idx) {
        var safeMac = String(mac).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return '<div class="mono" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:${colors.common.white};border:1px solid var(--color-secondary-200);border-radius:6px;margin-bottom:6px;font-size:13px;color:var(--color-secondary-800);">' +
          '<span>🛡️ ' + safeMac + '</span>' +
          '<button type="button" class="btn btn-danger" style="padding:2px 8px;font-size:11px;" onclick="removeMacFromFilter(' + idx + ')" title="' + (isTurkish ? 'Sil' : 'Remove') + '">🗑️</button>' +
        '</div>';
      }).join('');
    };

    window.addManualMac = function() {
      var input = document.getElementById('manual-mac-input');
      if (!input) return;
      var val = (input.value || '').trim();
      if (!val) {
        alert('❌ ' + (isTurkish ? 'Lütfen geçerli bir MAC adresi girin' : 'Please enter a valid MAC address'));
        return;
      }

      var clean = val.toLowerCase().replace(/[^0-9a-f]/g, '');
      if (clean.length === 12) {
        val = clean.match(/.{1,2}/g).join(':');
      } else if (!/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(val)) {
        alert('❌ ' + (isTurkish ? 'Geçersiz MAC adresi formatı. Örnek: 00:11:22:33:44:55' : 'Invalid MAC address format. Example: 00:11:22:33:44:55'));
        return;
      }

      if (!window.currentMacFilterList) window.currentMacFilterList = [];
      var normalizedVal = val.toLowerCase();
      var exists = window.currentMacFilterList.some(function(item) {
        return item.toLowerCase() === normalizedVal;
      });

      if (exists) {
        alert('⚠️ ' + (isTurkish ? 'Bu MAC adresi zaten listede var' : 'This MAC address is already in the list'));
        return;
      }

      window.currentMacFilterList.push(val);
      input.value = '';
      window.renderMacFilterList();
      saveAllWifiSettings();
    };

    window.removeMacFromFilter = function(index) {
      if (window.currentMacFilterList && window.currentMacFilterList[index] !== undefined) {
        window.currentMacFilterList.splice(index, 1);
        window.renderMacFilterList();
        saveAllWifiSettings();
      }
    };

    window.toggleDhcpServerSection = function() {
      var enabled = !!document.getElementById('dhcp-server-enabled')?.checked;
      var body = document.getElementById('dhcp-server-body');
      if (body) body.style.display = enabled ? 'block' : 'none';
      saveAllWifiSettings();
    };

    window.saveMacFilterSettings = function() {
      saveAllWifiSettings();
      alert('✅ ' + (isTurkish ? 'Gelişmiş kablosuz MAC filtreleme ve DHCP ayarları kaydedildi.' : 'Advanced wireless MAC filtering and DHCP settings saved.'));
    };

    function showTab(tabId) {
      const tabs = ['wireless', 'status', 'advanced', 'iot'];
      tabs.forEach(id => {
        const el = document.getElementById(id + '-tab');
        if (el) el.style.display = id === tabId ? 'block' : 'none';
      });
      document.querySelectorAll('.nav-tab').forEach(tab => {
        if (tab.getAttribute('data-tab') === tabId) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
      try { window.parent.postMessage({ type: 'router-admin-tab-change', tab: tabId }, '*'); } catch {}
    }

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        showTab(this.getAttribute('data-tab') || 'wireless');
      });
    });

    window.toggleIotDeviceSelection = function(deviceId) {
      const checkbox = document.querySelector('.iot-checkbox[data-device-id="' + deviceId + '"]');
      const card = document.querySelector('.iot-device-card[data-device-id="' + deviceId + '"]');
      if (selectedIotDevices.has(deviceId)) {
        selectedIotDevices.delete(deviceId);
        if (checkbox) checkbox.checked = false;
        if (card) {
          card.style.borderColor = 'var(--color-secondary-200)';
          card.style.background = '${colors.topology.deviceText}';
        }
      } else {
        selectedIotDevices.add(deviceId);
        if (checkbox) checkbox.checked = true;
        if (card) {
          card.style.borderColor = 'var(--color-primary-500)';
          card.style.background = '${colors.sky['50']}';
        }
      }
    };

    window.disconnectIotDevice = function(deviceId) {
      if (!confirm('⚠️ ' + (isTurkish ? 'Bu cihazın kablosuz bağlantısını kesmek istediğinizden emin misiniz?' : 'Are you sure you want to disconnect this device from the network?'))) return;
      try {
        window.parent.postMessage({
          type: 'router-admin-disconnect-iot',
          deviceId: ${jsDeviceId},
          payload: { iotDeviceId: deviceId }
        }, '*');
      } catch(err) {
        console.warn('Could not disconnect device:', err);
      }
    };

    window.renewIotDevice = function(deviceId) {
      try {
        window.parent.postMessage({
          type: 'router-admin-renew-iot',
          deviceId: ${jsDeviceId},
          payload: { iotDeviceId: deviceId }
        }, '*');
      } catch(err) {
        console.warn('Could not renew device IP:', err);
      }
    };

    window.clearIotSelection = function() {
      selectedIotDevices.clear();
      document.querySelectorAll('.iot-checkbox').forEach(cb => cb.checked = false);
      document.querySelectorAll('.iot-device-card.available').forEach(card => {
        card.style.borderColor = 'var(--color-secondary-200)';
        card.style.background = '${colors.topology.deviceText}';
      });
    };

    window.saveSelectedIotDevices = function() {
      const deviceIds = Array.from(selectedIotDevices);
      if (deviceIds.length === 0) {
        alert('❌ ' + (isTurkish ? 'Lütfen en az bir cihaz seçin' : 'Please select at least one device'));
        return;
      }
      
      const btn = document.getElementById('save-iot-btn');
      if (btn) {
        btn.innerHTML = '💾 ' + (isTurkish ? 'Bağlanıyor...' : 'Connecting...');
        btn.disabled = true;
      }

      deviceIds.forEach((deviceId, index) => {
        setTimeout(() => {
          try {
            window.parent.postMessage({
              type: 'router-admin-connect-iot',
              deviceId: deviceId,
              payload: {
                iotDeviceId: deviceId,
                ssid: ${jsSsid},
                security: ${jsSecurity},
                password: ${jsWifiPassword},
                channel: ${jsChannel}
              }
            }, '*');
          } catch (err) {}
        }, index * 100);
      });
    };

    var currentAdminUser = ${jsUsername};
    var currentAdminPass = ${jsPassword};

    window.handleLogin = function(event) {
      try {
        event.preventDefault();
        const get = (id) => document.getElementById(id);
        const usernameEl = get('login-username');
        const passwordEl = get('login-password');
        const loginForm = get('login-form');
        const mainContent = get('main-content');
        const loginError = get('login-error');
        const usernameInput = usernameEl ? (usernameEl.value || '') : '';
        const passwordInput = passwordEl ? (passwordEl.value || '') : '';

        if (usernameInput === currentAdminUser && passwordInput === currentAdminPass) {
          try {
            localStorage.setItem('router_admin_auth_' + ${jsDeviceId}, 'true');
            sessionStorage.setItem('router_admin_auth_' + ${jsDeviceId}, 'true');
          } catch {}
          if (loginForm) loginForm.style.display = 'none';
          if (mainContent) mainContent.style.display = 'block';
        } else {
          if (loginError) loginError.style.display = 'block';
        }
      } catch (err) {}
    };

    window.handleLogout = function() {
      try {
        localStorage.removeItem('router_admin_auth_' + ${jsDeviceId});
        sessionStorage.removeItem('router_admin_auth_' + ${jsDeviceId});
      } catch {}
      var loginForm = document.getElementById('login-form');
      var mainContent = document.getElementById('main-content');
      var loginError = document.getElementById('login-error');
      if (loginError) loginError.style.display = 'none';
      if (mainContent) mainContent.style.display = 'none';
      if (loginForm) loginForm.style.display = 'flex';
      var uInput = document.getElementById('login-username');
      var pInput = document.getElementById('login-password');
      if (uInput) uInput.value = '';
      if (pInput) pInput.value = '';
    };

    window.resetCredentialsForm = function() {
      const get = (id) => document.getElementById(id);
      if (get('cred-current-password')) get('cred-current-password').value = '';
      if (get('cred-new-username')) get('cred-new-username').value = currentAdminUser;
      if (get('cred-new-password')) get('cred-new-password').value = '';
      if (get('cred-confirm-password')) get('cred-confirm-password').value = '';
      if (get('cred-error')) get('cred-error').style.display = 'none';
      if (get('cred-success')) get('cred-success').style.display = 'none';
    };

    window.handleSavePrimarySettings = function(event) {
      if (event) event.preventDefault();
      saveAllWifiSettings();
      alert('✅ ' + (isTurkish ? 'Ana kablosuz ayarlar kaydedildi.' : 'Primary wireless settings saved.'));
      return false;
    };

    window.handleSaveCredentials = function(event) {
      try {
        event.preventDefault();
        const get = (id) => document.getElementById(id);
        const errorEl = get('cred-error');
        const successEl = get('cred-success');
        if (errorEl) errorEl.style.display = 'none';
        if (successEl) successEl.style.display = 'none';

        const currentPass = (get('cred-current-password') ? get('cred-current-password').value : '') || '';
        const newUsername = ((get('cred-new-username') ? get('cred-new-username').value : '') || '').trim();
        const newPass = (get('cred-new-password') ? get('cred-new-password').value : '') || '';
        const confirmPass = (get('cred-confirm-password') ? get('cred-confirm-password').value : '') || '';

        const showCredError = (msgTr, msgEn) => {
          if (errorEl) { errorEl.textContent = '❌ ' + (isTurkish ? msgTr : msgEn); errorEl.style.display = 'block'; }
        };

        if (currentPass !== currentAdminPass) { showCredError('Mevcut şifre hatalı!', 'Current password is incorrect!'); return; }
        if (!newUsername) { showCredError('Kullanıcı adı boş olamaz.', 'Username cannot be empty.'); return; }
        if (newPass.length < 4) { showCredError('Yeni şifre en az 4 karakter olmalı.', 'New password must be at least 4 characters.'); return; }
        if (newPass !== confirmPass) { showCredError('Yeni şifreler eşleşmiyor!', 'New passwords do not match!'); return; }

        currentAdminUser = newUsername;
        currentAdminPass = newPass;

        try {
          window.parent.postMessage({
            type: 'router-admin-save-credentials',
            deviceId: ${safeJSONForHTML(deviceId || '')},
            payload: { username: newUsername, password: newPass }
          }, '*');
        } catch {}

        if (successEl) successEl.style.display = 'block';
      } catch (err) {}
    };

    // --- Multi-SSID Management Functions ---
    window.renderSsidList = function() {
      var container = document.getElementById('ssid-profiles-container');
      if (!container) return;

      if (!currentSsidList || currentSsidList.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--color-secondary-400);">' +
          (isTurkish ? 'Yapılandırılmış ek SSID profili yok.' : 'No configured SSID profiles.') + '</div>';
        return;
      }

      container.innerHTML = currentSsidList.map(function(item, idx) {
        var isPrimary = idx === 0;
        var bandText = item.band === '5GHz' ? '5 GHz' : (item.band === '2.4GHz' ? '2.4 GHz' : (isTurkish ? 'Çift Bant' : 'Dual Band'));
        var secText = (item.security || 'open').toUpperCase();
        var statusBadge = item.enabled
          ? '<span class="status-badge" style="background:var(--color-success-500);">' + (isTurkish ? '● Etkin' : '● Active') + '</span>'
          : '<span class="status-badge" style="background:var(--color-secondary-400);">' + (isTurkish ? '○ Pasif' : '○ Disabled') + '</span>';

        var safeDisplayName = escH(item.name || item.ssid);
        var safeSsid = escH(item.ssid);
        var safeSecText = escH(secText);
        var safeBandText = escH(bandText);

        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:${colors.common.white};border:1px solid var(--color-secondary-200);border-radius:8px;margin-bottom:8px;gap:12px;">' +
          '<div style="min-w-0;">' +
            '<div style="font-weight:600;font-size:14px;color:var(--color-secondary-900);display:flex;align-items:center;gap:8px;">' +
              '<span>📶 ' + safeDisplayName + '</span>' +
              (isPrimary ? '<span class="badge badge-primary">' + (isTurkish ? 'Ana Yayın' : 'Primary') + '</span>' : '') +
              (item.hidden ? '<span class="badge badge-warning">🙈 ' + (isTurkish ? 'Gizli' : 'Hidden') + '</span>' : '') +
            '</div>' +
            '<div style="font-size:12px;color:var(--color-secondary-500);margin-top:2px;">' +
              'SSID: <strong style="color:var(--color-primary-600);">' + safeSsid + '</strong> · ' +
              (isTurkish ? 'Güvenlik' : 'Security') + ': <strong>' + safeSecText + '</strong> · ' +
              (isTurkish ? 'Bant' : 'Band') + ': <strong>' + safeBandText + '</strong>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;shrink:0;">' +
            statusBadge +
            '<button type="button" class="btn btn-secondary" style="padding:4px 10px;font-size:12px;" onclick="editSsidProfile(' + idx + ')">✏️ ' + (isTurkish ? 'Düzenle' : 'Edit') + '</button>' +
            '<button type="button" class="btn btn-secondary" style="padding:4px 10px;font-size:12px;" onclick="toggleSsidProfile(' + idx + ')">⚡</button>' +
            (!isPrimary ? '<button type="button" class="btn btn-danger" style="padding:4px 10px;font-size:12px;" onclick="deleteSsidProfile(' + idx + ')">🗑️</button>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    };

    window.saveSsidProfile = function() {
      var editId = document.getElementById('edit-ssid-id').value;
      var name = (document.getElementById('profile-name').value || '').trim();
      var ssid = (document.getElementById('profile-ssid').value || '').trim();
      var band = document.getElementById('profile-band').value || 'both';
      var security = document.getElementById('profile-security').value || 'wpa2';
      var password = (document.getElementById('profile-password').value || '').trim();
      var enabled = !!document.getElementById('profile-enabled').checked;
      var hidden = !!document.getElementById('profile-hidden').checked;

      if (!name || !ssid) {
        alert('❌ ' + (isTurkish ? 'Lütfen Profil Adı ve SSID girin' : 'Please enter Profile Name and SSID'));
        return;
      }

      if (security !== 'open' && password.length < 8) {
        alert('❌ ' + (isTurkish ? 'Şifre en az 8 karakter olmalıdır' : 'Password must be at least 8 characters'));
        return;
      }

      if (editId !== '') {
        var idx = parseInt(editId, 10);
        if (!isNaN(idx) && currentSsidList[idx]) {
          currentSsidList[idx] = {
            id: currentSsidList[idx].id,
            name: name,
            ssid: ssid,
            security: security,
            password: password,
            band: band,
            enabled: enabled,
            hidden: hidden
          };
        }
      } else {
        var newProfile = {
          id: 'ssid-' + (Date.now()),
          name: name,
          ssid: ssid,
          security: security,
          password: password,
          band: band,
          enabled: enabled,
          hidden: hidden
        };
        currentSsidList.push(newProfile);
      }

      // If primary SSID (idx 0) was updated, reflect on main form
      if (currentSsidList[0]) {
        var mainSsidEl = document.getElementById('wifi-ssid');
        if (mainSsidEl) mainSsidEl.value = currentSsidList[0].ssid;
      }

      resetSsidForm();
      renderSsidList();
      saveAllWifiSettings();
    };

    window.editSsidProfile = function(idx) {
      var profile = currentSsidList[idx];
      if (!profile) return;
      document.getElementById('edit-ssid-id').value = idx;
      document.getElementById('profile-name').value = profile.name || '';
      document.getElementById('profile-ssid').value = profile.ssid || '';
      document.getElementById('profile-band').value = profile.band || 'both';
      document.getElementById('profile-security').value = profile.security || 'wpa2';
      document.getElementById('profile-password').value = profile.password || '';
      document.getElementById('profile-enabled').checked = profile.enabled !== false;
      document.getElementById('profile-hidden').checked = !!profile.hidden;

      var pWrap = document.getElementById('profile-password-wrap');
      if (pWrap) pWrap.style.display = profile.security === 'open' ? 'none' : 'block';

      document.getElementById('ssid-form-title').innerHTML = '✏️ ' + (isTurkish ? 'SSID Profilini Düzenle' : 'Edit SSID Profile');
    };

    window.toggleSsidProfile = function(idx) {
      if (currentSsidList[idx]) {
        currentSsidList[idx].enabled = !currentSsidList[idx].enabled;
        renderSsidList();
        saveAllWifiSettings();
      }
    };

    window.deleteSsidProfile = function(idx) {
      if (idx === 0) {
        alert('❌ ' + (isTurkish ? 'Ana SSID profili silinemez' : 'Primary SSID profile cannot be deleted'));
        return;
      }
      if (confirm('⚠️ ' + (isTurkish ? 'Bu SSID profilini silmek istediğinizden emin misiniz?' : 'Are you sure you want to delete this SSID profile?'))) {
        currentSsidList.splice(idx, 1);
        renderSsidList();
        saveAllWifiSettings();
      }
    };

    window.resetSsidForm = function() {
      document.getElementById('edit-ssid-id').value = '';
      document.getElementById('profile-name').value = '';
      document.getElementById('profile-ssid').value = '';
      document.getElementById('profile-band').value = 'both';
      document.getElementById('profile-security').value = 'wpa2';
      document.getElementById('profile-password').value = 'password123';
      document.getElementById('profile-enabled').checked = true;
      document.getElementById('profile-hidden').checked = false;
      document.getElementById('ssid-form-title').innerHTML = '➕ ' + (isTurkish ? 'Yeni SSID Profili Ekle' : 'Add New SSID Profile');
    };

    // --- Connected Wireless Clients Table Handler ---
    window.renderConnectedWirelessClients = function() {
      var container = document.getElementById('connected-wireless-clients-container');
      var countEl = document.getElementById('status-connected-count');
      var totalBadge = document.getElementById('status-total-badge');

      var totalCount = connectedClientsData ? connectedClientsData.length : 0;
      if (countEl) {
        countEl.innerHTML = totalCount + ' ' + (isTurkish ? 'cihaz bağlı' : (totalCount === 1 ? 'device connected' : 'devices connected'));
      }
      if (totalBadge) {
        totalBadge.innerHTML = totalCount + ' ' + (isTurkish ? 'Toplam' : 'Total');
      }

      if (!container) return;

      if (!connectedClientsData || connectedClientsData.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:24px;background:${colors.topology.deviceText};border-radius:8px;border:1px solid var(--color-secondary-200);color:var(--color-secondary-500);">' +
          '<div style="font-size:36px;margin-bottom:8px;">📶</div>' +
          '<div>' + (isTurkish ? 'Şu anda bu erişim noktasına bağlı aktif kablosuz istemci yok.' : 'No active wireless clients currently connected to this AP.') + '</div>' +
        '</div>';
        return;
      }

      container.innerHTML = connectedClientsData.map(function(client) {
        var isSensor = client.sensorType === 'temperature' || client.sensorType === 'humidity' || client.sensorType === 'motion' || client.sensorType === 'light' || client.sensorType === 'sound';
        var icon = client.isWired ? '🔌' : (isSensor ? '🛜' : '💻');
        var ipDisplay = client.ip || (isTurkish ? 'Dinamik / DHCP' : 'Dynamic / DHCP');
        var macDisplay = client.mac || 'Auto';
        var clientSsid = client.ssid || ${jsSsid} || 'WiFi';
        var jsId = JSON.stringify(client.id || '').replace(/"/g, '&quot;');
        function escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

        var sigPct = typeof client.signalPercent === 'number' ? client.signalPercent : 90;
        var sigDbm = typeof client.rssiDbm === 'number' ? client.rssiDbm : Math.round(-95 + (sigPct * 0.65));
        var sigBadgeClass = client.isWired ? 'badge-success' : (sigPct > 60 ? 'badge-success' : (sigPct > 30 ? 'badge-warning' : 'badge-danger'));
        var sigDisplay = client.isWired ? '🔌 1 Gbps' : ('📶 ' + sigDbm + ' dBm (%' + sigPct + ')');

        return '<div class="client-card">' +
          '<div style="display:flex;align-items:center;gap:12px;min-width:0;">' +
            '<div class="client-icon">' + icon + '</div>' +
            '<div class="client-details">' +
              '<div class="client-title">' +
                '<span>' + escH(client.name) + '</span>' +
                '<span class="badge badge-primary">SSID: ' + escH(clientSsid) + '</span>' +
              '</div>' +
              '<div class="client-sub">IP: ' + escH(ipDisplay) + ' · MAC: ' + escH(macDisplay) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="client-badges">' +
            '<span class="badge ' + sigBadgeClass + '">' + sigDisplay + '</span>' +
            '<span class="badge ' + (client.connected ? 'badge-success"' : 'badge-danger"') + '>' + (client.connected ? (isTurkish ? '● Bağlı' : '● Connected') : (isTurkish ? '● Bağlı Değil' : '● Disconnected')) + '</span>' +
            '<button type="button" class="btn btn-secondary" style="padding:4px 8px;font-size:11px;" onclick="renewIotDevice(' + jsId + ')" title="' + (isTurkish ? 'IP Yenile' : 'Renew IP') + '">🔄</button>' +
            '<button type="button" class="btn btn-danger" style="padding:4px 8px;font-size:11px;" onclick="disconnectIotDevice(' + jsId + ')" title="' + (isTurkish ? 'Bağlantıyı Kes' : 'Disconnect') + '">🔌</button>' +
          '</div>' +
        '</div>';
      }).join('');
    };

    function saveAllWifiSettings() {
      var enabled = !!document.getElementById('wifi-enabled')?.checked;
      var ssid = document.getElementById('wifi-ssid') ? (document.getElementById('wifi-ssid').value || '') : '';
      var security = document.getElementById('wifi-security') ? (document.getElementById('wifi-security').value || '') : '';
      var channel = document.getElementById('wifi-channel') ? (document.getElementById('wifi-channel').value || '') : '';
      var mode = document.getElementById('wifi-mode') ? (document.getElementById('wifi-mode').value || '') : '';
      var hidden = document.getElementById('wifi-hidden') ? !!document.getElementById('wifi-hidden').checked : false;
      var maxClients = document.getElementById('max-clients') ? (document.getElementById('max-clients').value || 32) : 32;
      var password = document.getElementById('wifi-password') ? (document.getElementById('wifi-password').value || '') : '';

      var macFilterEnabled = !!document.getElementById('mac-filter-enabled')?.checked;
      var macFilterMode = document.querySelector('input[name="macFilterMode"]:checked')?.value || 'allow';
      var macFilterList = Array.isArray(window.currentMacFilterList) ? window.currentMacFilterList.slice() : [];

      var dhcpEnabled = !!document.getElementById('dhcp-server-enabled')?.checked;
      var dhcpStartIp = document.getElementById('dhcp-start-ip') ? (document.getElementById('dhcp-start-ip').value || '192.168.1.100') : '192.168.1.100';
      var dhcpEndIp = document.getElementById('dhcp-end-ip') ? (document.getElementById('dhcp-end-ip').value || '192.168.1.200') : '192.168.1.200';
      var dhcpGateway = document.getElementById('dhcp-gateway') ? (document.getElementById('dhcp-gateway').value || '192.168.1.1') : '192.168.1.1';
      var dhcpSubnet = document.getElementById('dhcp-subnet') ? (document.getElementById('dhcp-subnet').value || '255.255.255.0') : '255.255.255.0';
      var dhcpDns = document.getElementById('dhcp-dns') ? (document.getElementById('dhcp-dns').value || '192.168.1.1') : '192.168.1.1';
      var dhcpLeaseTime = document.getElementById('dhcp-lease') ? (document.getElementById('dhcp-lease').value || '24') : '24';

      try {
        window.parent.postMessage({
          type: 'router-admin-save-wifi',
          deviceId: ${jsDeviceId},
          payload: {
            enabled: enabled,
            ssid: ssid,
            security: security,
            channel: channel,
            mode: mode,
            hidden: hidden,
            maxClients: Number(maxClients),
            password: password,
            macFilterEnabled: macFilterEnabled,
            macFilterMode: macFilterMode,
            macFilterList: macFilterList,
            ssids: currentSsidList,
            dhcp: {
              enabled: dhcpEnabled,
              startIp: dhcpStartIp,
              endIp: dhcpEndIp,
              gateway: dhcpGateway,
              subnet: dhcpSubnet,
              dns: dhcpDns,
              leaseTime: Number(dhcpLeaseTime)
            }
          }
        }, '*');
      } catch(err) {}
    }

    function checkRouterAuth() {
      try {
        var localAuth = localStorage.getItem('router_admin_auth_' + ${jsDeviceId});
        var sessionAuth = sessionStorage.getItem('router_admin_auth_' + ${jsDeviceId});
        if (localAuth === 'true' || sessionAuth === 'true') {
          var loginForm = document.getElementById('login-form');
          var mainContent = document.getElementById('main-content');
          if (loginForm) loginForm.style.display = 'none';
          if (mainContent) mainContent.style.display = 'block';
        }
      } catch(err) {}
    }

    // Initialize lists & session state on document ready
    renderSsidList();
    renderConnectedWirelessClients();
    renderMacFilterList();
    checkRouterAuth();

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      checkRouterAuth();
    } else {
      window.addEventListener('load', checkRouterAuth);
      document.addEventListener('DOMContentLoaded', checkRouterAuth);
    }
  </script>
</body>
</html>
  `;
}

/**
 * Get default WiFi configuration for a router
 */
/* moved to wifiAdminConfig.ts */
/* function getDefaultWifiConfig(device: CanvasDevice): WifiAdminConfig {
  const defaultSsids: DeviceWifiSsidProfile[] = Array.isArray(device.wifi?.ssids) && device.wifi.ssids.length > 0
    ? device.wifi.ssids
    : [
        {
          id: 'ssid-1',
          name: 'Ana Ağ (Primary)',
          ssid: device.wifi?.ssid || `${device.name}_WiFi`,
          security: device.wifi?.security || 'wpa2',
          password: device.wifi?.password || 'password123',
          band: 'both',
          enabled: true,
          hidden: device.wifi?.hidden ?? false,
        },
        {
          id: 'ssid-2',
          name: 'Misafir Ağ (Guest)',
          ssid: `${device.name}_Guest`,
          security: 'open',
          band: '2.4GHz',
          enabled: false,
          hidden: false,
        },
      ];

  return {
    enabled: device.wifi?.enabled ?? false,
    ssid: device.wifi?.ssid || `${device.name}_WiFi`,
    security: device.wifi?.security || 'wpa2',
    password: device.wifi?.password || 'password123',
    channel: device.wifi?.channel || '2.4GHz',
    mode: device.wifi?.mode || 'ap',
    hidden: device.wifi?.hidden ?? false,
    maxClients: device.wifi?.maxClients ?? 32,
    macFilterEnabled: device.wifi?.macFilterEnabled ?? false,
    macFilterMode: device.wifi?.macFilterMode || 'allow',
    macFilterList: device.wifi?.macFilterList || [],
    ssids: defaultSsids,
  };
} */

/* function getRouterWifiConfig(device: CanvasDevice, state?: SwitchState): WifiAdminConfig {
  const wlan = state?.ports?.['wlan0'];
  const wlanWifi = wlan?.wifi;
  const base = getDefaultWifiConfig(device);

  // If WLC has configured WLANs, synchronize the active WLAN
  if (device.type === 'wlc' || state?.deviceType === 'wlc') {
    const wlcWlans = state?.wlcWlans ? Object.values(state.wlcWlans) : [];
    const activeWlan = wlcWlans.find((w) => w.status === 'enabled') || wlcWlans[0];
    if (activeWlan) {
      base.enabled = activeWlan.status === 'enabled';
      base.ssid = activeWlan.ssid || base.ssid;
      base.security = (activeWlan.security === 'open' ? 'open' : (activeWlan.security as 'open' | 'wep' | 'wpa' | 'wpa2' | 'wpa3') || 'open');
    }
  }

  if (!wlanWifi) return base;

  return {
    enabled: !wlan?.shutdown && wlanWifi.mode !== 'disabled',
    ssid: wlanWifi.ssid || base.ssid,
    security: wlanWifi.security || base.security,
    password: wlanWifi.password || base.password,
    channel: wlanWifi.channel || base.channel,
    mode: (wlanWifi.mode === 'client' ? 'client' : 'ap'),
    hidden: wlanWifi.hidden ?? base.hidden,
    maxClients: wlanWifi.maxClients ?? base.maxClients,
    macFilterEnabled: wlanWifi.macFilterEnabled ?? base.macFilterEnabled,
    macFilterMode: wlanWifi.macFilterMode || base.macFilterMode,
    macFilterList: wlanWifi.macFilterList || base.macFilterList,
    ssids: Array.isArray(wlanWifi.ssids) && wlanWifi.ssids.length > 0 ? wlanWifi.ssids : base.ssids,
  };
} */

/**
 * Generate router/switch/WLC admin page content for HTTP access
 */
export function generateRouterAdminPage(
  device: CanvasDevice,
  language: string,
  state?: SwitchState,
  connectedIotDevices?: ConnectedIoTDevice[],
  availableIotDevices?: AvailableIoTDevice[],
  username?: string,
  password?: string,
  activeTab?: string
): string {
  const interfaceIp = state?.ports ? Object.values(state.ports).find((p) => p?.ipAddress && !p.shutdown)?.ipAddress : undefined;
  // Persisted admin credentials live in services.http (changeable via Admin tab); fall back to defaults inside the panel
  const persistedUsername = state?.services?.http?.username ?? device.services?.http?.username;
  const persistedPassword = state?.services?.http?.password ?? device.services?.http?.password;
  const config: RouterWebConfig = {
    wifi: getRouterWifiConfig(device, state),
    deviceName: device.name,
    deviceIp: interfaceIp || device.ip || '192.168.1.1',
    deviceId: device.id,
    adminPassword: 'admin',
    username: username ?? persistedUsername,
    password: password ?? persistedPassword,
    connectedIotDevices: connectedIotDevices || [],
    availableIotDevices: availableIotDevices || [],
    language: language,
    device: device,
    runtimeState: state,
  };

  return generateWifiControlPanelHTML(config, activeTab);
}

export function isRouterDevice(device: CanvasDevice): boolean {
  return device.type === 'router' || device.type === 'wlc' || device.type === 'switchL3';
}
