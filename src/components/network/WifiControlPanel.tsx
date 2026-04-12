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

export interface ConnectedIoTDevice {
  id: string;
  name: string;
  sensorType: string;
  connected: boolean;
  ip?: string;
  isWired?: boolean;
}

export interface AvailableIoTDevice {
  id: string;
  name: string;
  sensorType: string;
  currentSsid?: string;
}

export interface RouterWebConfig {
  wifi: WifiAdminConfig;
  deviceName: string;
  deviceIp: string;
  deviceId?: string;
  adminPassword?: string;
  connectedIotDevices?: ConnectedIoTDevice[];
  availableIotDevices?: AvailableIoTDevice[];
}

/**
 * Generates a WiFi Control Panel HTML for router/switch admin interface
 * Styled like a typical router web admin page (e.g., 192.168.1.1)
 */
export function generateWifiControlPanelHTML(config: RouterWebConfig): string {
  const { wifi, deviceName, deviceIp, deviceId, connectedIotDevices = [], availableIotDevices = [] } = config;

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

  const passwordField = `
    <div class="form-group">
      <label for="wifi-password">WiFi Password / Security Key</label>
      <div style="position:relative;display:flex;align-items:center;">
        <input type="password" id="wifi-password" name="password" value="${wifi.password || ''}" placeholder="Enter password (min 8 characters)" minlength="8" style="padding-right:2.2rem;width:100%;">
        <button type="button" onclick="(function(btn){var inp=document.getElementById('wifi-password');if(inp.type==='password'){inp.type='text';btn.innerHTML='&#128065;&#65039;';}else{inp.type='password';btn.innerHTML='&#128065;';}})(this)" tabindex="-1" style="position:absolute;right:0.5rem;background:none;border:none;cursor:pointer;font-size:1rem;color:#888;padding:0;line-height:1;" title="Show/Hide password">&#128065;</button>
      </div>
      <span class="hint">Minimum 8 characters required</span>
    </div>
  `;

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
      <div class="nav-tab active" onclick="showTab('wireless')">📶 Wireless</div>
      <div class="nav-tab" onclick="showTab('iot')">🛜 IoT Devices</div>
      <div class="nav-tab" onclick="showTab('status')">📊 Status</div>
      <div class="nav-tab" onclick="showTab('advanced')">⚙️ Advanced</div>
    </div>
    
    <!-- Wireless Tab -->
    <div id="wireless-tab" class="content">
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
        
        <div id="wifi-password-wrap" style="${wifi.security === 'open' ? 'display:none;' : ''}">
          ${passwordField}
        </div>
        
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
      
    <!-- IoT Devices Tab -->
      <div id="iot-tab" class="content" style="display:none;">
        <h2 class="panel-title" style="margin-bottom:20px;">🛜 Connected IoT Devices</h2>
        
        <div class="status-card" style="margin-bottom:20px;">
          <div class="status-info">
            <h3>IoT Network</h3>
            <p>${connectedIotDevices.length} device(s) connected to this AP</p>
          </div>
          <span class="status-badge">${connectedIotDevices.filter(d => d.connected).length} Active</span>
        </div>
        
        ${connectedIotDevices.length > 0 ? `
        <div class="iot-device-list" style="margin-bottom:25px;">
          <p style="color:#6c757d;margin-bottom:15px;font-size:13px;">Manage connected IoT devices:</p>
          ${connectedIotDevices.map(device => `
            <div class="iot-device-card connected" data-device-id="${device.id}" style="display:flex;align-items:center;justify-content:space-between;padding:15px;background:#f8f9fa;border-radius:10px;margin-bottom:10px;border:1px solid #e9ecef;cursor:pointer;" onclick="focusDeviceInTopology('${device.id}')">
              <div style="display:flex;align-items:center;gap:12px;">               
                <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg, ${device.isWired ? '#22c55e 0%, #16a34a 100%' : '#16cbf9 0%, #0ea5e9 100%'});display:flex;align-items:center;justify-content:center;color:white;font-size:18px;">
                  ${device.isWired ? '🔌' : '🛜'}
                </div>
                <div>
                  <div style="font-weight:600;color:#333;">${device.name}</div>
                  <div style="font-size:12px;color:#6c757d;">
                    Sensor: ${device.sensorType}
                    ${device.ip ? `<span style="margin-left:8px;padding:2px 6px;background:#e0f2fe;border-radius:4px;color:#0369a1;font-family:monospace;">${device.ip}</span>` : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;background:${device.connected ? '#dcfce7' : '#fef3c7'};color:${device.connected ? '#166534' : '#92400e'};">
                  ${device.connected ? '● Connected' : '○ Disconnected'}
                </span>
                <button type="button" style="display:flex; align-items:center; justify-content:center; width:32px; height:32px; padding:0; border:none; border-radius:6px; background:#ef4444; color:white; cursor:pointer; transition:all 0.2s;" onclick="event.stopPropagation();disconnectIotDevice('${device.id}')" title="Bağlantıyı Kes">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>               
              </div>
            </div>
          `).join('')}
        </div>
        ` : `
        <div style="text-align:center;padding:30px;color:#6c757d;">
          <div style="font-size:48px;margin-bottom:15px;">📡</div>
          <p>No IoT devices connected yet</p>
          <p style="font-size:12px;">Add a new IoT device below to get started</p>
        </div>
        `}
        
        <h2 class="panel-title">Connect IoT Devices</h2>
        
        ${availableIotDevices.filter(d => !d.currentSsid).length > 0 ? `
        <div class="available-iot-list" style="margin-bottom:25px;">
          <p style="color:#6c757d;margin-bottom:15px;font-size:13px;"><strong>Unconnected Devices:</strong> Select to connect to this network:</p>
          ${availableIotDevices.filter(d => !d.currentSsid).map(device => `
            <div class="iot-device-card available" data-device-id="${device.id}" style="display:flex;align-items:center;justify-content:space-between;padding:15px;background:#f8f9fa;border-radius:10px;margin-bottom:10px;border:2px solid #e9ecef;cursor:pointer;transition:all 0.3s;" onclick="event.stopPropagation(); focusDeviceInTopology('${device.id}'); toggleIotDeviceSelection('${device.id}')">
              <div style="display:flex;align-items:center;gap:12px;">
                <input type="checkbox" class="iot-checkbox" data-device-id="${device.id}" style="width:20px;height:20px;cursor:pointer;" onclick="event.stopPropagation(); focusDeviceInTopology('${device.id}'); toggleIotDeviceSelection('${device.id}')">
                <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);display:flex;align-items:center;justify-content:center;color:white;font-size:18px;">
                  🛜
                </div>
                <div>
                  <div style="font-weight:600;color:#333;">${device.name}</div>
                  <div style="font-size:12px;color:#6c757d;">Sensor: ${device.sensorType} • <strong>Unconnected</strong></div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${availableIotDevices.filter(d => d.currentSsid && d.currentSsid !== '${wifi.ssid}').length > 0 ? `
        <div class="available-iot-list" style="margin-bottom:25px;">
          <p style="color:#6c757d;margin-bottom:15px;font-size:13px;"><strong>On Other Networks:</strong> Select to switch to this network:</p>
          ${availableIotDevices.filter(d => d.currentSsid && d.currentSsid !== '${wifi.ssid}').map(device => `
            <div class="iot-device-card available" data-device-id="${device.id}" style="display:flex;align-items:center;justify-content:space-between;padding:15px;background:#f8f9fa;border-radius:10px;margin-bottom:10px;border:2px solid #e9ecef;cursor:pointer;transition:all 0.3s;" onclick="event.stopPropagation(); focusDeviceInTopology('${device.id}'); toggleIotDeviceSelection('${device.id}')">
              <div style="display:flex;align-items:center;gap:12px;">
                <input type="checkbox" class="iot-checkbox" data-device-id="${device.id}" style="width:20px;height:20px;cursor:pointer;" onclick="event.stopPropagation(); focusDeviceInTopology('${device.id}'); toggleIotDeviceSelection('${device.id}')">
                <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);display:flex;align-items:center;justify-content:center;color:white;font-size:18px;">
                  🛜
                </div>
                <div>
                  <div style="font-weight:600;color:#333;">${device.name}</div>
                  <div style="font-size:12px;color:#6c757d;">Sensor: ${device.sensorType} • On: ${device.currentSsid}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${(availableIotDevices.filter(d => !d.currentSsid).length > 0 || availableIotDevices.filter(d => d.currentSsid && d.currentSsid !== '${wifi.ssid}').length > 0) ? `
        <div class="actions" style="margin-top:20px;">
          <button type="button" class="btn btn-primary" onclick="saveSelectedIotDevices()" id="save-iot-btn">
            💾 Connect Selected Devices
          </button>
          <button type="button" class="btn btn-secondary" onclick="clearIotSelection()">
            ↺ Clear Selection
          </button>
        </div>
        ` : `
        <div style="text-align:center;padding:30px;color:#6c757d;background:#f8f9fa;border-radius:10px;margin-bottom:20px;">
          <div style="font-size:48px;margin-bottom:15px;">📡</div>
          <p>No available IoT devices in topology</p>
          <p style="font-size:12px;">Add IoT devices to the topology first, then connect them here</p>
        </div>
        `}
      </div>
      
      <!-- Status Tab -->
      <div id="status-tab" class="content" style="display:none;">
        <h2 class="panel-title">Network Status</h2>
        <div class="grid-2" style="margin-bottom:20px;">
          <div class="status-card">
            <div class="status-info">
              <h3>WiFi Status</h3>
              <p>${wifi.enabled ? 'Active and Broadcasting' : 'Disabled'}</p>
            </div>
            <span class="status-badge">${wifi.enabled ? '● Online' : '○ Offline'}</span>
          </div>
          <div class="status-card">
            <div class="status-info">
              <h3>Connected Clients</h3>
              <p>${connectedIotDevices.filter(d => d.connected).length} IoT device(s)</p>
            </div>
            <span class="status-badge">${connectedIotDevices.length} Total</span>
          </div>
        </div>
        <div style="background:#f8f9fa;padding:20px;border-radius:10px;">
          <h3 style="margin-bottom:15px;font-size:16px;color:#333;">Network Information</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
            <div><strong>SSID:</strong> ${wifi.ssid || 'Not configured'}</div>
            <div><strong>Security:</strong> ${wifi.security.toUpperCase()}</div>
            <div><strong>Channel:</strong> ${wifi.channel}</div>
            <div><strong>Mode:</strong> ${wifi.mode.toUpperCase()}</div>
          </div>
        </div>
      </div>
      
      <!-- Advanced Tab -->
      <div id="advanced-tab" class="content" style="display:none;">
        <h2 class="panel-title">Advanced Settings</h2>
        <p style="color:#6c757d;margin-bottom:20px;">Advanced configuration options for power users.</p>
        <div style="background:#fff3cd;padding:15px;border-radius:10px;border:1px solid #ffc107;">
          <strong>⚠️ Warning</strong>
          <p style="margin:10px 0 0 0;font-size:13px;">Changing advanced settings may affect network stability. Proceed with caution.</p>
        </div>
      </div>
    
    <div class="footer">
      © Network Simulator Router Administration | Model: ${deviceName} | Firmware: v1.0.0
    </div>
  </div>
  
  <script>
    console.log('Router WiFi admin panel script loaded');
    console.log('window.parent available:', typeof window.parent !== 'undefined');
    console.log('window.parent === window:', window.parent === window);

    // Hide tooltips on mobile devices
    function hideTooltipsOnMobile() {
      if (window.innerWidth <= 600) {
        document.querySelectorAll('[title]').forEach(el => {
          el.setAttribute('data-title', el.getAttribute('title'));
          el.removeAttribute('title');
        });
      }
    }
    hideTooltipsOnMobile();
    window.addEventListener('resize', hideTooltipsOnMobile);
    
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
      const passwordWrap = document.getElementById('wifi-password-wrap');
      const isOpen = this.value === 'open';
      if (passwordWrap) {
        passwordWrap.style.display = isOpen ? 'none' : 'block';
      }
      console.log('Security type changed to:', this.value);
    });
    
    // Tab switching
    function showTab(tabName) {
      const tabs = ['wireless', 'iot', 'status', 'advanced'];
      tabs.forEach(tab => {
        const tabEl = document.getElementById(tab + '-tab');
        if (tabEl) tabEl.style.display = tab === tabName ? 'block' : 'none';
      });
      // Update nav-tab active state
      document.querySelectorAll('.nav-tab').forEach((el, idx) => {
        const tabIds = ['wireless', 'iot', 'status', 'advanced'];
        if (tabIds[idx] === tabName) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });
    }
    window.showTab = showTab;
    
    // IoT device multi-selection tracking
    let selectedIotDevices = new Set();
    
    window.toggleIotDeviceSelection = function(deviceId) {
      const checkbox = document.querySelector('.iot-checkbox[data-device-id="' + deviceId + '"]');
      const card = document.querySelector('.iot-device-card[data-device-id="' + deviceId + '"]');

      // Use checkbox's current state (browser already toggled it on click)
      const isChecked = checkbox ? checkbox.checked : false;
      console.log('Toggle IoT device:', deviceId, 'checked:', isChecked);

      if (isChecked) {
        selectedIotDevices.add(deviceId);
        if (card) {
          card.style.borderColor = '#2a5298';
          card.style.background = '#e8f0fe';
        }
      } else {
        selectedIotDevices.delete(deviceId);
        if (card) {
          card.style.borderColor = '#e9ecef';
          card.style.background = '#f8f9fa';
        }
      }

      console.log('Selected IoT devices:', Array.from(selectedIotDevices));

      // Update button text
      const saveBtn = document.getElementById('save-iot-btn');
      if (saveBtn) {
        const count = selectedIotDevices.size;
        saveBtn.innerHTML = count > 0 ? '💾 Connect ' + count + ' Device' + (count > 1 ? 's' : '') : '💾 Connect Selected Devices';
      }
    };
    
    // Connected devices selection for disconnect
    let selectedConnectedDevices = new Set();
    
    window.toggleConnectedDeviceSelection = function(deviceId) {
      const checkbox = document.querySelector('.iot-disconnect-checkbox[data-device-id="' + deviceId + '"]');
      const card = document.querySelector('.iot-device-card.connected[data-device-id="' + deviceId + '"]');

      // Use checkbox's current state (browser already toggled it on click)
      const isChecked = checkbox ? checkbox.checked : false;

      if (isChecked) {
        selectedConnectedDevices.add(deviceId);
        if (card) card.style.background = '#fee2e2';
      } else {
        selectedConnectedDevices.delete(deviceId);
        if (card) card.style.background = '#f8f9fa';
      }

      // Update disconnect button
      const disconnectBtn = document.getElementById('disconnect-selected-btn');
      if (disconnectBtn) {
        const count = selectedConnectedDevices.size;
        disconnectBtn.innerHTML = count > 0 ? '✕ Disconnect ' + count : '✕ Disconnect Selected';
      }
    };
    
    // Get all currently connected IoT device IDs from the DOM
    function getAllConnectedDeviceIds() {
      const checkboxes = document.querySelectorAll('.iot-disconnect-checkbox[data-device-id]');
      return Array.from(checkboxes).map(cb => cb.getAttribute('data-device-id')).filter(Boolean);
    }

    // Focus device in topology
    window.focusDeviceInTopology = function(deviceId) {
      console.log('Focusing device in topology:', deviceId);
      try {
        window.parent.postMessage({
          type: 'router-admin-focus-device',
          deviceId: deviceId
        }, '*');
      } catch (err) {
        console.warn('Could not send focus device message:', err);
      }
    };
    
    window.disconnectIotDevice = function(deviceId) {
      console.log('disconnectIotDevice called with:', deviceId);
      if (!confirm('Bu cihazın ağ ile olan kablosuz bağlantısını (disconnect) kesmek istediğinize emin misiniz?')) return;
      
      try {
        console.log('Posting disconnect message for device:', deviceId);
        window.parent.postMessage({
          type: 'router-admin-disconnect-iot',
          deviceId: deviceId,
          payload: {
            iotDeviceId: deviceId
          }
        }, '*');
      } catch (err) {
        console.warn('Could not disconnect IoT device:', err);
        alert('❌ Cihazın bağlantısı kesilemedi: ' + err.message);
      }
    };
    
    window.deleteIotDevice = function(deviceId) {
      console.log('deleteIotDevice called with:', deviceId);
      if (!confirm('⚠️ Are you sure you want to PERMANENTLY DELETE this device from the topology?')) return;
      
      try {
        console.log('Posting delete message for device:', deviceId);
        window.parent.postMessage({
          type: 'router-admin-delete-iot',
          deviceId: deviceId,
          payload: {
            iotDeviceId: deviceId
          }
        }, '*');
        alert('✅ IoT device has been deleted');
      } catch (err) {
        console.warn('Could not delete IoT device:', err);
        alert('❌ Failed to delete IoT device');
      }
    };
    
    window.disconnectAllDevices = function() {
      const deviceIds = getAllConnectedDeviceIds();
      console.log('disconnectAllDevices called. Count:', deviceIds.length, 'Devices:', deviceIds);
      
      if (deviceIds.length === 0) {
        alert('❌ No connected IoT devices to disconnect');
        return;
      }
      
      if (!confirm('❓ Disconnect all ' + deviceIds.length + ' IoT device(s) from the network?')) {
        console.log('Disconnect all cancelled');
        return;
      }
      
      console.log('Starting disconnect sequence for all devices');
      
      deviceIds.forEach((deviceId, index) => {
        setTimeout(() => {
          console.log('Processing device ' + (index + 1) + ' of ' + deviceIds.length + ': ' + deviceId);
          try {
            const message = {
              type: 'router-admin-disconnect-iot',
              deviceId: deviceId,
              payload: { iotDeviceId: deviceId }
            };
            console.log('Sending postMessage:', message);
            window.parent.postMessage(message, '*');
            console.log('postMessage sent successfully for device:', deviceId);
          } catch (err) {
            console.error('Error posting message for device ' + deviceId + ':', err);
            alert('❌ Error disconnecting device ' + deviceId);
          }
        }, index * 200);  // Increased delay to 200ms for safety
      });
      
      setTimeout(() => {
        selectedConnectedDevices.clear();
        console.log('Disconnect all sequence completed');
        alert('✅ Sent disconnect commands for ' + deviceIds.length + ' IoT device(s)');
        // Notify parent to refresh the device list
        try {
          window.parent.postMessage({
            type: 'router-admin-refresh-devices',
            deviceId: '${deviceId || ''}'
          }, '*');
        } catch (err) {
          console.warn('Could not send refresh message:', err);
        }
      }, deviceIds.length * 200 + 500);
    };
    
    window.deleteSelectedDevices = function() {
      const deviceIds = Array.from(selectedConnectedDevices);
      if (deviceIds.length === 0) {
        alert('❌ Please select at least one device to delete');
        return;
      }
      
      if (!confirm('⚠️ PERMANENTLY DELETE ' + deviceIds.length + ' device(s) from the topology?')) return;
      
      deviceIds.forEach((deviceId, index) => {
        setTimeout(() => {
          try {
            window.parent.postMessage({
              type: 'router-admin-delete-iot',
              deviceId: deviceId,
              payload: { iotDeviceId: deviceId }
            }, '*');
          } catch (err) {
            console.warn('Could not delete IoT device:', err);
          }
        }, index * 100);
      });
      
      setTimeout(() => {
        selectedConnectedDevices.clear();
        alert('✅ ' + deviceIds.length + ' device(s) deleted');
      }, deviceIds.length * 100 + 200);
    };

    window.deleteAllDevices = function() {
      const deviceIds = getAllConnectedDeviceIds();
      if (deviceIds.length === 0) {
        alert('❌ No devices to delete');
        return;
      }
      
      if (!confirm('⚠️ PERMANENTLY DELETE ALL ' + deviceIds.length + ' device(s)?')) return;
      
      deviceIds.forEach((deviceId, index) => {
        setTimeout(() => {
          try {
            window.parent.postMessage({
              type: 'router-admin-delete-iot',
              deviceId: deviceId,
              payload: { iotDeviceId: deviceId }
            }, '*');
          } catch (err) {
            console.warn('Could not delete IoT device:', err);
          }
        }, index * 100);
      });
      
      setTimeout(() => {
        selectedConnectedDevices.clear();
        alert('✅ All IoT devices deleted');
      }, deviceIds.length * 100 + 200);
    };

    window.disconnectSelectedDevices = function() {
      const deviceIds = Array.from(selectedConnectedDevices);
      if (deviceIds.length === 0) {
        alert('❌ Please select at least one device to disconnect');
        return;
      }
      
      if (!confirm('Disconnect ' + deviceIds.length + ' device(s) from the network?')) return;
      
      deviceIds.forEach((deviceId, index) => {
        setTimeout(() => {
          try {
            console.log('Posting disconnect-selected message for device:', deviceId);
            window.parent.postMessage({
              type: 'router-admin-disconnect-iot',
              deviceId: deviceId,
              payload: { iotDeviceId: deviceId }
            }, '*');
          } catch (err) {
            console.warn('Could not disconnect IoT device:', err);
          }
        }, index * 100);
      });
      
      setTimeout(() => {
        selectedConnectedDevices.clear();
        alert('✅ ' + deviceIds.length + ' device(s) disconnected from the network');
        // Notify parent to refresh the device list
        try {
          window.parent.postMessage({
            type: 'router-admin-refresh-devices',
            deviceId: '${deviceId || ''}'
          }, '*');
        } catch (err) {
          console.warn('Could not send refresh message:', err);
        }
      }, deviceIds.length * 100 + 200);
    };
    
    window.clearIotSelection = function() {
      selectedIotDevices.clear();
      document.querySelectorAll('.iot-checkbox').forEach(cb => cb.checked = false);
      document.querySelectorAll('.iot-device-card.available').forEach(card => {
        card.style.borderColor = '#e9ecef';
        card.style.background = '#f8f9fa';
      });
      const saveBtn = document.getElementById('save-iot-btn');
      if (saveBtn) saveBtn.innerHTML = '💾 Connect Selected Devices';
    };
    
    window.saveSelectedIotDevices = function() {
      const deviceIds = Array.from(selectedIotDevices);
      console.log('Saving selected IoT devices:', deviceIds);
      if (deviceIds.length === 0) {
        alert('❌ Please select at least one IoT device');
        return;
      }
      
      const btn = document.getElementById('save-iot-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '💾 Connecting...';
      btn.disabled = true;
      
      // Connect all selected devices
      let successCount = 0;
      let failCount = 0;
      
      deviceIds.forEach((deviceId, index) => {
        setTimeout(() => {
          try {
            console.log('Posting connect message for device:', deviceId);
            window.parent.postMessage({
              type: 'router-admin-connect-iot',
              deviceId: deviceId,
              payload: {
                iotDeviceId: deviceId,
                ssid: '${wifi.ssid || ''}',
                security: '${wifi.security}',
                password: '${wifi.password || ''}',
                channel: '${wifi.channel}'
              }
            }, '*');
            successCount++;
          } catch (err) {
            console.warn('Could not connect IoT device ' + deviceId + ':', err);
            failCount++;
          }
        }, index * 100);
      });
      
      setTimeout(() => {
        btn.innerHTML = '✓ Connected ' + successCount + '!';
        btn.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
        setTimeout(() => {
          btn.innerHTML = '💾 Connect Selected Devices';
          btn.style.background = '';
          btn.disabled = false;
          clearIotSelection();
          alert('✅ ' + successCount + ' IoT device' + (successCount > 1 ? 's' : '') + ' connected to the network!' + (failCount > 0 ? ' (' + failCount + ' failed)' : ''));
          // Do not reload - let parent handle updates
        }, 1500);
      }, deviceIds.length * 100 + 500);
    };
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
export function generateRouterAdminPage(device: CanvasDevice, state?: SwitchState, connectedIotDevices?: ConnectedIoTDevice[], availableIotDevices?: AvailableIoTDevice[]): string {
  const config: RouterWebConfig = {
    wifi: getRouterWifiConfig(device, state),
    deviceName: device.name,
    deviceIp: device.ip || '192.168.1.1',
    deviceId: device.id,
    adminPassword: 'admin',
    connectedIotDevices: connectedIotDevices || [],
    availableIotDevices: availableIotDevices || [],
  };

  return generateWifiControlPanelHTML(config);
}
