
import { CanvasDevice } from '@/components/network/networkTopology.types';

export const generateIotWebPanelContent = (
  iotDevices: CanvasDevice[],
  language: string,
  routerId?: string,
  routerSsid?: string,
  topologyConnections?: any[],
): string => {
  const isTurkish = language === 'tr';

  // Filter IoT devices based on router if routerId is provided
  const filteredIotDevices = routerId
    ? iotDevices.filter(device => {
        // Check if device is connected via wired connection to this router
        if (topologyConnections) {
          const isWiredConnected = topologyConnections.some(c =>
            (c.sourceDeviceId === routerId && c.targetDeviceId === device.id) ||
            (c.targetDeviceId === routerId && c.sourceDeviceId === device.id)
          );
          if (isWiredConnected) {
            return true;
          }
        }
        // Check if device is connected via WiFi to this router's SSID
        if (routerSsid && device.wifi?.ssid === routerSsid && device.wifi?.enabled) {
          return true;
        }
        // If no router-specific connection found, don't include this device
        return false;
      })
    : iotDevices;

  const iotDeviceListHtml = filteredIotDevices.length > 0
    ? filteredIotDevices.map(device => {
        const isPoweredOff = device.status === 'offline';
        const isActive = device.iot?.collaborationEnabled ?? true;
        
        // Check if device is actually connected to the network
        // If viewing from a specific router (routerSsid provided), check connection to that router
        // If viewing global IoT panel (no routerSsid), check if device has any connection
        const isConnectedToNetwork = topologyConnections?.some(conn => {
          const isWiredConnected = conn.sourceDeviceId === device.id || conn.targetDeviceId === device.id;
          if (isWiredConnected) return true;
          
          // WiFi connection check
          if (device.wifi?.enabled) {
            // If routerSsid is provided, check connection to that specific router
            if (routerSsid) {
              return device.wifi.ssid === routerSsid;
            }
            // If no routerSsid (global panel), check if device has any WiFi connection
            return !!device.wifi.ssid;
          }
          
          return false;
        });

        const cardClass = isPoweredOff ? 'powered-off' : isConnectedToNetwork ? (isActive ? 'connected' : 'connected-inactive') : (isActive ? 'active' : 'inactive');
        const statusText = isPoweredOff
          ? (isTurkish ? 'Kapalı' : 'Offline')
          : isConnectedToNetwork
            ? (isActive ? (isTurkish ? 'Çevrimiçi' : 'Online') : (isTurkish ? 'Çevrimiçi (Pasif)' : 'Online (Inactive)'))
            : (isActive ? (isTurkish ? 'Aktif' : 'Active') : (isTurkish ? 'Pasif' : 'Inactive'));
        const statusClass = isPoweredOff ? 'offline' : isConnectedToNetwork ? (isActive ? 'online' : 'online-inactive') : (isActive ? 'active' : 'inactive');

        return `
      <div class="iot-device-card ${cardClass}">
        <div class="device-info">
          <span class="device-name">${device.name || device.id}</span>
          <div class="device-details">
            <span class="device-ip">${isTurkish ? 'IP' : 'IP'}: ${device.ip || '-'}</span>
            <span class="device-mac">${isTurkish ? 'MAC' : 'MAC'}: ${device.macAddress || '-'}</span>
          </div>
          <div class="device-status ${statusClass}">${statusText}</div>
        </div>
        <button onclick="window.parent.postMessage({ type: 'open-iot-device', deviceId: '${device.id}' }, '*')" class="connect-button">
          ${isTurkish ? 'Bağlan' : 'Connect'}
        </button>
      </div>
    `;
      }).join('')
    : `<p class="no-devices">${isTurkish ? 'Hiç IoT cihazı bulunamadı.' : 'No IoT devices found.'}</p>`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${isTurkish ? 'IoT Web Paneli' : 'IoT Web Panel'}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f0f2f5;
            color: #333;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            padding: 30px;
            max-width: 600px;
            width: 100%;
            box-sizing: border-box;
          }
          h1 {
            color: #0056b3;
            text-align: center;
            margin-bottom: 25px;
            font-size: 24px;
            font-weight: 600;
          }
          .login-form {
            text-align: center;
          }
          .form-group {
            margin-bottom: 20px;
            text-align: left;
          }
          label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #555;
          }
          input[type="text"],
          input[type="password"] {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ced4da;
            border-radius: 5px;
            box-sizing: border-box;
            font-size: 16px;
          }
          .login-button {
            background-color: #28a745;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 12px 25px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: background-color 0.2s ease;
            width: 100%;
          }
          .login-button:hover {
            background-color: #218838;
          }
          .error-message {
            color: #dc3545;
            font-size: 14px;
            margin-top: 10px;
            display: none;
          }
          .iot-device-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #e9ecef;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            padding: 15px 20px;
            margin-bottom: 15px;
            transition: all 0.2s ease-in-out;
          }
          .iot-device-card.powered-off {
            background-color: #f8d7da;
            border-color: #f5c6cb;
            opacity: 0.7;
          }
          .iot-device-card.connected {
            background-color: #dcfce7;
            border-color: #86efac;
          }
          .iot-device-card.connected-inactive {
            background-color: #fef3c7;
            border-color: #fde68a;
          }
          .iot-device-card.active {
            background-color: #e0f2fe;
            border-color: #7dd3fc;
          }
          .iot-device-card.inactive {
            background-color: #f3f4f6;
            border-color: #d1d5db;
            opacity: 0.7;
          }
          .iot-device-card.offline {
            background-color: #e2e3e5;
            border-color: #d6d8db;
            opacity: 0.6;
          }
          .iot-device-card.wifi-disabled {
            background-color: #fff3cd;
            border-color: #ffeaa7;
          }
          .iot-device-card.powered-off.wifi-disabled {
            background-color: #e2e3e5;
            border-color: #d6d8db;
          }
          .device-info {
            flex: 1;
          }
          .device-name {
            font-weight: 600;
            font-size: 16px;
            color: #333;
          }
          .device-details {
            display: flex;
            flex-direction: column;
            gap: 2px;
            margin: 6px 0;
          }
          .device-ip,
          .device-mac {
            font-size: 12px;
            color: #666;
            font-family: 'Courier New', monospace;
          }
          .device-status {
            font-size: 13px;
            margin-top: 4px;
            color: #666;
          }
          .device-status.offline {
            color: #dc3545;
            font-weight: 500;
          }
          .device-status.online {
            color: #166534;
            font-weight: 500;
          }
          .device-status.online-inactive {
            color: #92400e;
            font-weight: 500;
          }
          .device-status.active {
            color: #0369a1;
            font-weight: 500;
          }
          .device-status.inactive {
            color: #6c757d;
            font-weight: 500;
          }
          .device-status.disabled {
            color: #856404;
            font-weight: 500;
          }
          .iot-device-card:hover {
            background-color: #e2e6ea;
            border-color: #cdd2d6;
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }
          .device-name {
            font-size: 16px;
            font-weight: 500;
            color: #333;
          }
          .connect-button {
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s ease;
          }
          .connect-button:hover {
            background-color: #0056b3;
          }
          .no-devices {
            text-align: center;
            color: #6c757d;
            font-style: italic;
            margin-top: 20px;
          }
          .hidden {
            display: none;
          }
          .logout-button {
            position: absolute;
            top: 20px;
            right: 20px;
            background-color: #dc3545;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: background-color 0.2s ease;
          }
          .logout-button:hover {
            background-color: #c82333;
          }
          .settings-icon {
            position: absolute;
            top: 20px;
            right: 20px;
            background-color: #6c757d;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 18px;
            font-weight: 600;
            transition: background-color 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
          }
          .settings-icon:hover {
            background-color: #5a6268;
          }
          .settings-popup {
            position: absolute;
            top: 70px;
            right: 20px;
            background-color: #ffffff;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            padding: 15px;
            min-width: 250px;
            z-index: 1000;
            display: none;
          }
          .settings-popup.show {
            display: block;
          }
          .settings-popup-title {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #dee2e6;
          }
          .settings-option {
            margin-bottom: 15px;
          }
          .settings-option:last-child {
            margin-bottom: 0;
          }
          .settings-option label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: #555;
            margin-bottom: 8px;
          }
          .settings-input {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #ced4da;
            border-radius: 5px;
            box-sizing: border-box;
            font-size: 14px;
          }
          .settings-button {
            width: 100%;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: background-color 0.2s ease;
            margin-top: 5px;
          }
          .settings-button:hover {
            background-color: #0056b3;
          }
          .settings-button.logout {
            background-color: #dc3545;
          }
          .settings-button.logout:hover {
            background-color: #c82333;
          }
          .password-success {
            color: #28a745;
            font-size: 12px;
            margin-top: 5px;
            display: none;
          }
          .password-error {
            color: #dc3545;
            font-size: 12px;
            margin-top: 5px;
            display: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${isTurkish ? 'IoT Web Paneli' : 'IoT Web Panel'}</h1>
          
          <div id="loginSection" class="login-form">
            <div class="form-group">
              <label for="username">${isTurkish ? 'Kullanıcı Adı' : 'Username'}:</label>
              <input type="text" id="username" value="admin" placeholder="${isTurkish ? 'Kullanıcı adı girin' : 'Enter username'}" />
            </div>
            <div class="form-group">
              <label for="password">${isTurkish ? 'Parola' : 'Password'}:</label>
              <input type="password" id="password" placeholder="${isTurkish ? 'Parola girin' : 'Enter password'}" />
            </div>
            <button type="button" class="login-button" onclick="checkPassword()">
              ${isTurkish ? 'Giriş Yap' : 'Login'}
            </button>
            <div id="errorMessage" class="error-message">
              ${isTurkish ? 'Hatalı kullanıcı adı veya parola!' : 'Incorrect username or password!'}
            </div>
          </div>

          <div id="deviceSection" class="hidden">
            <button type="button" class="settings-icon" onclick="toggleSettingsPopup()">
              ⚙️
            </button>
            <div id="settingsPopup" class="settings-popup">
              <div class="settings-popup-title">${isTurkish ? 'Ayarlar' : 'Settings'}</div>
              <div class="settings-option">
                <label>${isTurkish ? 'Parola Değiştir' : 'Change Password'}</label>
                <input type="password" id="newPassword" class="settings-input" placeholder="${isTurkish ? 'Yeni parola' : 'New password'}" />
                <input type="password" id="confirmPassword" class="settings-input" style="margin-top: 5px;" placeholder="${isTurkish ? 'Parolayı onayla' : 'Confirm password'}" />
                <button type="button" class="settings-button" onclick="changePassword()">
                  ${isTurkish ? 'Değiştir' : 'Change'}
                </button>
                <div id="passwordSuccess" class="password-success">${isTurkish ? 'Parola başarıyla değiştirildi!' : 'Password changed successfully!'}</div>
                <div id="passwordError" class="password-error">${isTurkish ? 'Parolalar eşleşmiyor!' : 'Passwords do not match!'}</div>
              </div>
              <div class="settings-option">
                <button type="button" class="settings-button logout" onclick="logout()">
                  ${isTurkish ? 'Çıkış Yap' : 'Logout'}
                </button>
              </div>
            </div>
            <div class="device-list">
              ${iotDeviceListHtml}
            </div>
          </div>
        </div>

        <script>
          function checkPassword() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const correctUsername = 'admin';
            const correctPassword = sessionStorage.getItem('iotPanelPassword') || 'admin';
            
            if (username === correctUsername && password === correctPassword) {
              sessionStorage.setItem('iotPanelAuthenticated', 'true');
              document.getElementById('loginSection').classList.add('hidden');
              document.getElementById('deviceSection').classList.remove('hidden');
            } else {
              const errorMessage = document.getElementById('errorMessage');
              errorMessage.style.display = 'block';
              document.getElementById('username').value = '';
              document.getElementById('password').value = '';
              document.getElementById('username').focus();
            }
          }

          function checkAuthentication() {
            const isAuthenticated = sessionStorage.getItem('iotPanelAuthenticated');
            if (isAuthenticated === 'true') {
              document.getElementById('loginSection').classList.add('hidden');
              document.getElementById('deviceSection').classList.remove('hidden');
            } else {
              document.getElementById('loginSection').classList.remove('hidden');
              document.getElementById('deviceSection').classList.add('hidden');
            }
          }

          function logout() {
            sessionStorage.removeItem('iotPanelAuthenticated');
            document.getElementById('loginSection').classList.remove('hidden');
            document.getElementById('deviceSection').classList.add('hidden');
            document.getElementById('username').value = 'admin';
            document.getElementById('password').value = '';
            document.getElementById('errorMessage').style.display = 'none';
            document.getElementById('settingsPopup').classList.remove('show');
          }

          function toggleSettingsPopup() {
            const popup = document.getElementById('settingsPopup');
            popup.classList.toggle('show');
          }

          function changePassword() {
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const successMessage = document.getElementById('passwordSuccess');
            const errorMessage = document.getElementById('passwordError');

            if (newPassword && newPassword === confirmPassword) {
              sessionStorage.setItem('iotPanelPassword', newPassword);
              successMessage.style.display = 'block';
              errorMessage.style.display = 'none';
              document.getElementById('newPassword').value = '';
              document.getElementById('confirmPassword').value = '';
              
              // Hide success message after 3 seconds
              setTimeout(() => {
                successMessage.style.display = 'none';
              }, 3000);

              // Close popup after successful password change
              setTimeout(() => {
                document.getElementById('settingsPopup').classList.remove('show');
              }, 1500);
            } else {
              errorMessage.style.display = 'block';
              successMessage.style.display = 'none';
            }
          }

          // Close popup when clicking outside
          document.addEventListener('click', function(e) {
            const popup = document.getElementById('settingsPopup');
            const settingsIcon = document.querySelector('.settings-icon');
            if (popup && settingsIcon) {
              if (!popup.contains(e.target) && !settingsIcon.contains(e.target)) {
                popup.classList.remove('show');
              }
            }
          });

          document.getElementById('password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
              checkPassword();
            }
          });

          document.getElementById('username').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
              document.getElementById('password').focus();
            }
          });

          // Check authentication on page load
          window.addEventListener('load', checkAuthentication);
        </script>
      </body>
    </html>
  `;
};

export const generateIotDevicePageContent = (
  deviceId: string,
  deviceName: string,
  language: string,
  isActive: boolean = true,
  isPoweredOff: boolean = false,
): string => {
  const isTurkish = language === 'tr';
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${isTurkish ? 'IoT Cihaz Yönetimi' : 'IoT Device Management'}: ${deviceName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f0f2f5;
            color: #333;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .device-panel {
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            padding: 30px;
            max-width: 500px;
            width: 100%;
            box-sizing: border-box;
            text-align: center;
          }
          h1 {
            color: #0056b3;
            margin-bottom: 25px;
            font-size: 22px;
            font-weight: 600;
          }
          .device-info {
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 25px;
            text-align: left;
          }
          .device-info p {
            margin: 10px 0;
            font-size: 14px;
          }
          .device-info strong {
            color: #555;
            display: inline-block;
            width: 120px;
          }
          .toggle-section {
            margin-bottom: 25px;
          }
          .toggle-label {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 15px;
            display: block;
          }
          .toggle-switch {
            position: relative;
            display: inline-block;
            width: 60px;
            height: 34px;
          }
          .toggle-switch input {
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
            background-color: #28a745;
          }
          input:checked + .slider:before {
            transform: translateX(26px);
          }
          .status-text {
            margin-top: 10px;
            font-size: 14px;
            font-weight: 500;
          }
          .status-active {
            color: #28a745;
          }
          .status-inactive {
            color: #dc3545;
          }
          .toggle-disabled {
            opacity: 0.5;
            pointer-events: none;
          }
          .power-off-message {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 25px;
            text-align: center;
            color: #856404;
            font-size: 14px;
            font-weight: 500;
          }
          .back-button {
            background-color: #6c757d;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 12px 25px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: background-color 0.2s ease;
            margin-top: 10px;
          }
          .back-button:hover {
            background-color: #5a6268;
          }
        </style>
      </head>
      <body>
        <div class="device-panel">
          <h1>${deviceName} ${isTurkish ? 'Yönetimi' : 'Management'}</h1>
          
          <div class="device-info">
            <p><strong>${isTurkish ? 'Cihaz ID' : 'Device ID'}:</strong> ${deviceId}</p>
            <p><strong>${isTurkish ? 'Cihaz Adı' : 'Device Name'}:</strong> ${deviceName}</p>
            <p><strong>${isTurkish ? 'Güç Durumu' : 'Power Status'}:</strong> ${isPoweredOff ? (isTurkish ? 'Kapalı' : 'Off') : (isTurkish ? 'Açık' : 'On')}</p>
            <p><strong>${isTurkish ? 'Durum' : 'Status'}:</strong> <span id="statusText" class="${isActive ? 'status-active' : 'status-inactive'}">${isActive ? (isTurkish ? 'Aktif' : 'Active') : (isTurkish ? 'Pasif' : 'Inactive')}</span></p>
          </div>

          ${isPoweredOff ? `
          <div class="power-off-message">
            ${isTurkish ? '⚠️ Cihaz kapalı. Ayarları değiştirmek için önce cihazı açın.' : '⚠️ Device is powered off. Turn on the device to change settings.'}
          </div>
          ` : ''}

          <div class="toggle-section ${isPoweredOff ? 'toggle-disabled' : ''}">
            <label class="toggle-label">${isTurkish ? 'Cihaz Durumu' : 'Device Status'}</label>
            <label class="toggle-switch">
              <input type="checkbox" id="deviceToggle" ${isActive ? 'checked' : ''} ${isPoweredOff ? 'disabled' : ''} onchange="toggleDevice()">
              <span class="slider"></span>
            </label>
            <div id="statusMessage" class="status-text ${isActive ? 'status-active' : 'status-inactive'}">
              ${isActive ? (isTurkish ? 'Cihaz aktif' : 'Device is active') : (isTurkish ? 'Cihaz pasif' : 'Device is inactive')}
            </div>
          </div>

          <button type="button" class="back-button" onclick="goBack()">
            ${isTurkish ? 'Listeye Dön' : 'Back to List'}
          </button>
        </div>

        <script>
          const isPoweredOff = ${isPoweredOff};
          function toggleDevice() {
            // Prevent toggling if device is powered off
            if (isPoweredOff) {
              return;
            }

            const toggle = document.getElementById('deviceToggle');
            const statusText = document.getElementById('statusText');
            const statusMessage = document.getElementById('statusMessage');

            if (toggle.checked) {
              statusText.textContent = '${isTurkish ? 'Aktif' : 'Active'}';
              statusText.className = 'status-text status-active';
              statusMessage.textContent = '${isTurkish ? 'Cihaz aktif' : 'Device is active'}';
              statusMessage.className = 'status-text status-active';
              window.parent.postMessage({ type: 'toggle-iot-device', deviceId: '${deviceId}', active: true }, '*');
            } else {
              statusText.textContent = '${isTurkish ? 'Pasif' : 'Inactive'}';
              statusText.className = 'status-text status-inactive';
              statusMessage.textContent = '${isTurkish ? 'Cihaz pasif' : 'Device is inactive'}';
              statusMessage.className = 'status-text status-inactive';
              window.parent.postMessage({ type: 'toggle-iot-device', deviceId: '${deviceId}', active: false }, '*');
            }
          }

          function goBack() {
            window.parent.postMessage({ type: 'back-to-iot-list' }, '*');
          }
        </script>
      </body>
    </html>
  `;
};
