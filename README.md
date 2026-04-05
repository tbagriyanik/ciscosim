# 🚀 Network Simulator 2026

A modern and interactive web-based Network simulator designed for students and networking enthusiasts.

![Version](https://img.shields.io/badge/version-1.2.1-blue)
![Tech Stack](https://img.shields.io/badge/stack-Next.js%2016%20|%20React%2019%20|%20TypeScript%20|%20Tailwind%204-green)
![FOSS](https://img.shields.io/badge/FOSS-Free%20Open%20Source-brightgreen)
![Commits](https://img.shields.io/badge/commits-365+-orange)
![Lines of Code](https://img.shields.io/badge/lines--of--code-65k+-blueviolet)

## ✨ Key Features

### 🌐 Interactive Network Topology
- **Device Management**: Drag and drop PC, Switch, and Router devices to canvas
- **Zoom & Pan**: Smooth zoom and pan operations
- **Cable System**: Straight-through, Crossover, and Console cables
- **Connection Management**: Create and manage connections between devices
- **Visual Feedback**: Device status indicators and port labels
- **Wireless (WiFi) Simulation**: Wireless network simulation with SSID, WPA2 security, and AP/Client modes
- **WiFi Signal Strength Indicator**: Real-time signal strength display (5-bar meter) in PC and CLI terminals
  - Visual signal bars with color coding (green/yellow/orange/red)
  - Signal percentage display (100%, 75%, 50%, 25%, 1%)
  - Distance-based signal calculation between AP and client devices
- **WiFi Control Panel**: Web-based WiFi management interface for routers/switches
  - Access via HTTP (e.g., `http 192.168.1.1` from PC terminal)
  - Configure SSID, security (Open/WPA/WPA2/WPA3), channel (2.4GHz/5GHz)
  - Switch between AP and Client modes
  - View connected devices in real-time
  - Modern, responsive UI with dark/light theme support

### 💻 Network CLI Simulation
- **Command Support**: enable, configure, interface, show commands
- **Mode System**: User, Privileged, Config, and Interface modes
- **Command History**: Independent command history for each device
- **Error Checking**: Error messages for invalid commands

### 🔌 Physical Device Visualization
- **Port Panel**: Realistic port display
- **LED Indicators**: Colored LEDs showing connection status
- **Port Status**: Connected, Disconnected, and Shutdown states

### 🛠️ Configuration Features
- **VLAN Management**: Create VLANs and assign ports
- **IP Configuration**: IP address, subnet, and gateway settings
- **Interface Management**: Port speed, duplex, and shutdown settings
- **Routing**: IP routing and static route management

### 📝 Note System
- **Add Notes**: Add notes to canvas
- **Drag Notes**: Drag notes on canvas
- **Resize Notes**: Resize notes
- **Note Style Customization**: Color, font type, size, and opacity settings
- **Undo/Redo**: Undo/redo support for all operations

### 🔍 Ping and Connectivity Testing
- **Ping Testing**: Ping between devices
- **Detailed Diagnostics**: Show error cause when ping fails
- **Subnet Validation**: Ping control across different subnets
- **Routing Check**: Router routing verification
- **Visual Ping Animation**: Mail icon with arched path between devices (wired/wireless)
- **Global Animation Trigger**: Automatic animation when ping is sent from terminal or CLI
- **WiFi Signal-Based Latency**: Realistic ping latencies based on wireless signal strength
  - 100% signal (5 bars): 1-6ms (Excellent)
  - 75% signal (4 bars): 5-24ms (Good)
  - 50% signal (3 bars): 15-55ms (Fair)
  - 25% signal (2 bars): 40-110ms (Weak)
  - 1% signal (1 bar): 100-220ms (Very Weak)
  - Wired connection: <1ms (No WiFi)

### ⚡ Advanced Features
- **Bulk Power Control**: Bulk power on/off for selected devices
- **Multi-Select**: Select multiple devices
- **Keyboard Shortcuts**: Ctrl+Z (Undo), Ctrl+Y (Redo), etc.
- **Dark/Light Mode**: Dark and light theme support
- **Turkish/English**: Turkish and English language support
- **Offline Storage**: Offline data storage
- **Task System (Tasks)**: Track WLAN connection, security, and port configuration tasks

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) + [React 19](https://react.dev/)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) + [Lucide React](https://lucide.dev/)
- **State Management**: [Zustand](https://docs.pmnd.rs/zustand) + Context API
- **Storage**: localStorage + Custom offline storage

## 📁 Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main page
├── components/
│   ├── network/              # Network simulator components
│   │   ├── NetworkTopology.tsx       # Main canvas
│   │   ├── Terminal.tsx              # CLI interface
│   │   ├── DeviceNode.tsx            # Device visualization
│   │   ├── PortPanel.tsx             # Port management
│   │   └── ...
│   └── ui/                   # shadcn/ui components
├── lib/
│   └── network/              # Network logic
│       ├── parser.ts         # Command parser
│       ├── executor.ts       # Command executor
│       ├── connectivity.ts   # Connectivity checker
│       ├── routing.ts        # Routing logic
│       └── types.ts          # Type definitions
├── contexts/                 # React contexts
│   ├── ThemeContext.tsx      # Dark/Light mode
│   └── LanguageContext.tsx   # TR/EN language
└── hooks/                    # Custom hooks

kiro/                         # Project documentation
├── POWER_TOGGLE_IMPLEMENTATION.md
├── PING_DIAGNOSTICS_IMPLEMENTATION.md
├── SUBNET_VALIDATION_IMPLEMENTATION.md
├── NOTE_SYSTEM_SUMMARY.md
└── ...
```

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build

# Start production server
npm start
```

Open in browser: [http://localhost:3000](http://localhost:3000)

For detailed installation instructions, read [INSTALL.md](INSTALL.md).

## 📚 Documentation

Detailed documentation can be found in the `kiro/` folder:

## 🎯 Usage Examples

### Adding Devices
1. Select PC, Switch, or Router from left panel
2. Drag to canvas
3. Device is automatically added

### Creating Connections
1. Click on a device port
2. Click on another device port
3. Connection is automatically created

### Configuring WiFi
1. Access router via HTTP: `http 192.168.1.1` from PC terminal
2. Configure SSID, security, and channel in WiFi Control Panel
3. Enable AP mode on router
4. Connect PC as WiFi client with matching SSID

### Ping Testing
1. Right-click on device
2. Select "Ping"
3. Target the device
4. Ping animation starts
5. View latency based on WiFi signal strength

### Adding Notes
1. Click "Add Note" button
2. Note is added to canvas
3. Drag note, resize, customize style

## 🌍 Language Support

- ✅ **Turkish** - Full support
- ✅ **English** - Full support

Language selection is done from the language selector in the top right corner.

## 🎨 Theme Support

- ✅ **Dark Mode** - Dark theme
- ✅ **Light Mode** - Light theme

Theme selection is done from the theme selector in the top right corner.

## 📊 System Requirements

- **Node.js**: 18.0 or higher
- **npm**: 9.0 or higher (or bun)
- **Browser**: Modern browser (Chrome, Firefox, Safari, Edge)

## 🔢 Code Metrics

- Scope: `src/`
- Source files: `244`
- Total lines: `66,000+`
- Last updated: `2026-04-05`

## 🐛 Troubleshooting

For issues, check the "Troubleshooting" section in [INSTALL.md](INSTALL.md).

## 📝 License

FOSS License - Check [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome. Please:

1. Fork
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add some AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📞 Contact

For questions or suggestions, please open an issue.

---

## 🌍 Dil Desteği / Language Support

- ✅ **Türkçe** - Tam destek / Full support
- ✅ **English** - Tam destek / Full support

Dil seçimi sağ üst köşedeki dil seçicisinden yapılır.

## 🎨 Tema Desteği / Theme Support

- ✅ **Dark Mode** - Koyu tema / Dark theme
- ✅ **Light Mode** - Açık tema / Light theme

Tema seçimi sağ üst köşedeki tema seçicisinden yapılır.

## 📊 Sistem Gereksinimleri / System Requirements

- **Node.js**: 18.0 veya üzeri / 18.0 or higher
- **npm**: 9.0 veya üzeri (veya Bun) / 9.0 or higher (or bun)
- **Tarayıcı**: Modern tarayıcı (Chrome, Firefox, Safari, Edge) / Modern browser (Chrome, Firefox, Safari, Edge)

## 🐛 Sorun Giderme / Troubleshooting

Sorunlar için [INSTALL.md](INSTALL.md) dosyasındaki "Sorun Giderme" bölümünü kontrol edin. / For issues, check the "Troubleshooting" section in [INSTALL.md](INSTALL.md).

## 📝 Lisans / License

FOSS License - Detaylar için [LICENSE](LICENSE) dosyasını kontrol edin. / FOSS License - Check [LICENSE](LICENSE) for details.

## 🤝 Katkıda Bulunma / Contributing

Katkılar memnuniyetle karşılanır. Lütfen: / Contributions are welcome. Please:

1. Fork yapın / Fork
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`) / Create feature branch
3. Commit yapın (`git commit -m 'Add some AmazingFeature'`) / Commit
4. Push yapın (`git push origin feature/AmazingFeature`) / Push
5. Pull Request açın / Open Pull Request

## 📞 İletişim / Contact

Sorular veya öneriler için lütfen issue açın. / For questions or suggestions, please open an issue.

---

**Sürüm**: 1.2.1  
**Son Güncelleme**: 2026-04-05  
**Durum**: Production Ready ✅

---

**Bu proje açık kaynaklıdır.** 🚀  
GitHub üzerinden katkıda bulunabilirsiniz: [github.com/tbagriyanik/ciscosim](https://github.com/tbagriyanik/ciscosim)

**Sürüm**: 1.2.1  
**Son Güncelleme**: 2026-04-05  
**Durum**: Production Ready ✅
