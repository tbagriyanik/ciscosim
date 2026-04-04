'use client';

import { CanvasDevice } from './networkTopology.types';
import type { SwitchState } from '@/lib/network/types';

export interface WifiAdminConfig {
  enabled: boolean;
  ssid: string;
  security: 'open' | 'wpa' | 'wpa2' | 'wpa3';
  password?: string;
  channel: '2.4GHz' | '5GHz';
  mode: 'ap' | 'client';
  hidden?: boolean;
  maxClients?: number;
}

export interface RouterWebConfig {
  wifi: WifiAdminConfig;
  deviceName: string;
  deviceIp: string;
  deviceId?: string;
  adminPassword?: string;
}

/**
 * Generates a WiFi Control Panel HTML for router/switch admin interface
 * Styled like a typical router web admin page (e.g., 192.168.1.1)
 */
export function generateWifiControlPanelHTML(config: RouterWebConfig): string {
  const { wifi, deviceName, deviceIp, deviceId } = config;

  const securityOptions = [
    { value: 'open', label: 'Open (No Security)' },
    { value: 'wpa', label: 'WPA Personal' },
    { value: 'wpa2', label: 'WPA2 Personal (Recommended)' },
    { value: 'wpa3', label: 'WPA3 Personal' },
  ];

  const channelOptions = [
    { value: '2.4GHz', label: '2.4 GHz (Better Range)' },
    { value: '5GHz', label: '5 GHz (Better Speed)' },
  ];

  const modeOptions = [
    { value: 'ap', label: 'Access Point (AP)' },
    { value: 'client', label: 'Client Mode' },
  ];

  const securitySelect = securityOptions.map(opt =>
    `<option value="${opt.value}" ${wifi.security === opt.value ? 'selected' : ''}>${opt.label}</option>`
  ).join('');

  const channelSelect = channelOptions.map(opt =>
    `<option value="${opt.value}" ${wifi.channel === opt.value ? 'selected' : ''}>${opt.label}</option>`
  ).join('');

  const modeSelect = modeOptions.map(opt =>
    `<option value="${opt.value}" ${wifi.mode === opt.value ? 'selected' : ''}>${opt.label}</option>`
  ).join('');

  const passwordField = wifi.security !== 'open' ? `
    <div class="form-group">
      <label for="wifi-password">WiFi Password / Security Key</label>
      <input type="password" id="wifi-password" name="password" value="${wifi.password || ''}" placeholder="Enter password (min 8 characters)" minlength="8">
      <span class="hint">Minimum 8 characters required</span>
    </div>
  ` : '';

  const hiddenCheckbox = `
    <div class="form-group checkbox-group">
      <label class="checkbox-label">
        <input type="checkbox" id="wifi-hidden" name="hidden" ${wifi.hidden ? 'checked' : ''}>
        <span class="checkmark"></span>
        <span class="label-text">Hide SSID (Don't broadcast network name)</span>
      </label>
    </div>
  `;

  const maxClientsField = `
    <div class="form-group">
      <label for="max-clients">Maximum Connected Clients</label>
      <input type="number" id="max-clients" name="maxClients" value="${wifi.maxClients || 32}" min="1" max="128">
      <span class="hint">Range: 1-128 clients</span>
    </div>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${deviceName} - Wireless Settings</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .header .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .header .device-info {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid rgba(255,255,255,0.2);
      font-size: 13px;
      display: flex;
      justify-content: center;
      gap: 30px;
    }
    
    .nav-tabs {
      display: flex;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    }
    
    .nav-tab {
      flex: 1;
      padding: 16px 20px;
      text-align: center;
      color: #6c757d;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      transition: all 0.3s;
    }
    
    .nav-tab:hover {
      color: #2a5298;
      background: rgba(42,82,152,0.05);
    }
    
    .nav-tab.active {
      color: #2a5298;
      border-bottom-color: #2a5298;
      background: #fff;
    }
    
    .content {
      padding: 30px;
    }
    
    .panel-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .panel-title::before {
      content: '📶';
      font-size: 24px;
    }
    
    .status-card {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 25px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .status-card.disabled {
      background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
    }
    
    .status-info h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 5px;
    }
    
    .status-info p {
      font-size: 13px;
      opacity: 0.95;
    }
    
    .status-badge {
      background: rgba(255,255,255,0.2);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #495057;
      margin-bottom: 8px;
    }
    
    .form-group input[type="text"],
    .form-group input[type="password"],
    .form-group input[type="number"],
    .form-group select {
      width: 100%;
      padding: 12px 15px;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      font-size: 14px;
      transition: all 0.3s;
      background: #fff;
    }
    
    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      border-color: #2a5298;
      box-shadow: 0 0 0 3px rgba(42,82,152,0.1);
    }
    
    .form-group .hint {
      display: block;
      font-size: 12px;
      color: #6c757d;
      margin-top: 5px;
    }
    
    .checkbox-group {
      display: flex;
      align-items: center;
    }
    
    .checkbox-label {
      display: flex !important;
      align-items: center;
      cursor: pointer;
      flex-direction: row !important;
      gap: 12px;
    }
    
    .checkbox-label input {
      display: none;
    }
    
    .checkmark {
      width: 22px;
      height: 22px;
      border: 2px solid #ced4da;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
      flex-shrink: 0;
    }
    
    .checkbox-label input:checked + .checkmark {
      background: #2a5298;
      border-color: #2a5298;
    }
    
    .checkbox-label input:checked + .checkmark::after {
      content: '✓';
      color: white;
      font-size: 14px;
      font-weight: bold;
    }
    
    .label-text {
      font-size: 14px !important;
      font-weight: 500 !important;
      color: #495057;
    }
    
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    .actions {
      display: flex;
      gap: 15px;
      margin-top: 30px;
      padding-top: 25px;
      border-top: 1px solid #e9ecef;
    }
    
    .btn {
      flex: 1;
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: white;
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(42,82,152,0.3);
    }
    
    .btn-secondary {
      background: #f8f9fa;
      color: #6c757d;
      border: 2px solid #e9ecef;
    }
    
    .btn-secondary:hover {
      background: #e9ecef;
      color: #495057;
    }
    
    .toggle-switch {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
      margin-bottom: 25px;
    }
    
    .toggle-switch h3 {
      font-size: 16px;
      color: #333;
    }
    
    .toggle-switch p {
      font-size: 13px;
      color: #6c757d;
      margin-top: 4px;
    }
    
    .switch {
      position: relative;
      width: 60px;
      height: 34px;
    }
    
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 34px;
    }
    
    .slider:before {
      position: absolute;
      content: "";
      height: 26px;
      width: 26px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    
    input:checked + .slider {
      background-color: #11998e;
    }
    
    input:checked + .slider:before {
      transform: translateX(26px);
    }
    
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #6c757d;
      border-top: 1px solid #e9ecef;
    }
    
    @media (max-width: 600px) {
      .grid-2 {
        grid-template-columns: 1fr;
      }
      
      .actions {
        flex-direction: column;
      }
      
      .device-info {
        flex-direction: column;
        gap: 10px !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔧 ${deviceName}</h1>
      <div class="subtitle">Wireless Network Administration</div>
      <div class="device-info">
        <span>📍 IP: ${deviceIp}</span>
        <span>📡 WLAN Interface: wlan0</span>
      </div>
    </div>
    
    <div class="nav-tabs">
      <div class="nav-tab active">📶 Wireless</div>
      <div class="nav-tab">🔐 Security</div>
      <div class="nav-tab">📊 Status</div>
      <div class="nav-tab">⚙️ Advanced</div>
    </div>
    
    <div class="content">
      <div class="toggle-switch">
        <div>
          <h3>Wireless Radio</h3>
          <p>Enable or disable the wireless access point</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="wifi-enabled" ${wifi.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      
      <div class="status-card ${wifi.enabled ? '' : 'disabled'}">
        <div class="status-info">
          <h3>Current Status</h3>
          <p>${wifi.enabled ? 'WiFi is active and broadcasting' : 'WiFi is currently disabled'}</p>
        </div>
        <span class="status-badge">${wifi.enabled ? '● Online' : '○ Offline'}</span>
      </div>
      
      <h2 class="panel-title">Basic Wireless Settings</h2>
      
      <form id="wifi-form">
        <div class="form-group">
          <label for="wifi-ssid">Network Name (SSID)</label>
          <input type="text" id="wifi-ssid" name="ssid" value="${wifi.ssid || ''}" placeholder="Enter your WiFi network name" maxlength="32">
          <span class="hint">This name will be visible to wireless clients (unless hidden)</span>
        </div>
        
        <div class="grid-2">
          <div class="form-group">
            <label for="wifi-mode">Operation Mode</label>
            <select id="wifi-mode" name="mode">
              ${modeSelect}
            </select>
          </div>
          
          <div class="form-group">
            <label for="wifi-channel">Frequency Band</label>
            <select id="wifi-channel" name="channel">
              ${channelSelect}
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label for="wifi-security">Security Type</label>
          <select id="wifi-security" name="security">
            ${securitySelect}
          </select>
          <span class="hint">WPA2 Personal is recommended for most networks</span>
        </div>
        
        ${passwordField}
        
        <div class="grid-2">
          ${hiddenCheckbox}
          ${maxClientsField}
        </div>
        
        <div class="actions">
          <button type="submit" class="btn btn-primary">💾 Save Settings</button>
          <button type="button" class="btn btn-secondary" onclick="location.reload()">↺ Reset Changes</button>
        </div>
      </form>
    </div>
    
    <div class="footer">
      © Network Simulator Router Administration | Model: ${deviceName} | Firmware: v1.0.0
    </div>
  </div>
  
  <script>
    // Form handling simulation
    document.getElementById('wifi-form').addEventListener('submit', function(e) {
      e.preventDefault();
      
      const enabled = document.getElementById('wifi-enabled').checked;
      const ssid = document.getElementById('wifi-ssid').value;
      const security = document.getElementById('wifi-security').value;
      const channel = document.getElementById('wifi-channel').value;
      const mode = document.getElementById('wifi-mode').value;
      const hidden = document.getElementById('wifi-hidden')?.checked || false;
      const maxClients = document.getElementById('max-clients')?.value || 32;
      const password = document.getElementById('wifi-password')?.value || '';
      
      if (!ssid) {
        alert('❌ Please enter a network name (SSID)');
        return;
      }
      
      if (security !== 'open' && password.length < 8) {
        alert('❌ Password must be at least 8 characters');
        return;
      }
      
      // Show success message (simulated)
      const btn = document.querySelector('.btn-primary');
      const originalText = btn.innerHTML;
      btn.innerHTML = '✓ Saved!';
      btn.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        alert('✅ WiFi settings have been saved successfully!\\n\\nChanges will take effect immediately.');
      }, 1000);

      try {
        window.parent.postMessage({
          type: 'router-admin-save-wifi',
          deviceId: '${deviceId || ''}',
          payload: {
            enabled,
            ssid,
            security,
            channel,
            mode,
            hidden,
            maxClients: Number(maxClients),
            password
          }
        }, '*');
      } catch (err) {
        console.warn('Could not sync router settings to parent:', err);
      }
      
      console.log('WiFi Configuration:', {
        enabled, ssid, security, channel, mode, hidden, maxClients, password: password ? '***' : 'none'
      });
    });
    
    // Toggle switch handler
    document.getElementById('wifi-enabled').addEventListener('change', function() {
      const statusCard = document.querySelector('.status-card');
      const statusBadge = document.querySelector('.status-badge');
      const statusInfoP = document.querySelector('.status-info p');
      
      if (this.checked) {
        statusCard.classList.remove('disabled');
        statusBadge.textContent = '● Online';
        statusInfoP.textContent = 'WiFi is active and broadcasting';
      } else {
        statusCard.classList.add('disabled');
        statusBadge.textContent = '○ Offline';
        statusInfoP.textContent = 'WiFi is currently disabled';
      }
    });
    
    // Security type change handler
    document.getElementById('wifi-security').addEventListener('change', function() {
      console.log('Security type changed to:', this.value);
      // Password field visibility is handled by CSS in real implementation
    });
  </script>
</body>
</html>
  `.trim();
}

/**
 * Check if a device is a router/switch that should show WiFi admin panel
 */
export function isRouterDevice(device: CanvasDevice): boolean {
  return device.type === 'router' || device.type === 'switchL2' || device.type === 'switchL3';
}

/**
 * Get default WiFi configuration for a router
 */
export function getDefaultWifiConfig(device: CanvasDevice): WifiAdminConfig {
  return {
    enabled: device.wifi?.enabled ?? false,
    ssid: device.wifi?.ssid || `${device.name}_WiFi`,
    security: device.wifi?.security || 'wpa2',
    password: device.wifi?.password || 'password123',
    channel: device.wifi?.channel || '2.4GHz',
    mode: device.wifi?.mode || 'ap',
    hidden: false,
    maxClients: 32,
  };
}

export function getRouterWifiConfig(device: CanvasDevice, state?: SwitchState): WifiAdminConfig {
  const wlan = state?.ports?.['wlan0'];
  const wlanWifi = wlan?.wifi;
  const base = getDefaultWifiConfig(device);

  if (!wlanWifi) return base;

  return {
    enabled: !wlan?.shutdown && wlanWifi.mode !== 'disabled',
    ssid: wlanWifi.ssid || base.ssid,
    security: wlanWifi.security || base.security,
    password: wlanWifi.password || base.password,
    channel: (wlanWifi.channel as '2.4GHz' | '5GHz') || base.channel,
    mode: (wlanWifi.mode === 'client' ? 'client' : 'ap'),
    hidden: base.hidden,
    maxClients: base.maxClients,
  };
}

/**
 * Generate router admin page content for HTTP access
 */
export function generateRouterAdminPage(device: CanvasDevice, state?: SwitchState): string {
  const config: RouterWebConfig = {
    wifi: getRouterWifiConfig(device, state),
    deviceName: device.name,
    deviceIp: device.ip || '192.168.1.1',
    deviceId: device.id,
    adminPassword: 'admin',
  };

  return generateWifiControlPanelHTML(config);
}
