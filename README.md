# 🚀 Network Simulator 2026

A modern, interactive, browser-based network simulator for students and networking enthusiasts.

![Version](https://img.shields.io/badge/version-1.5.2-blue)
![Tech Stack](https://img.shields.io/badge/stack-Next.js%2016.2%20|%20React%2019%20|%20TypeScript%205.9%20|%20Tailwind%204-green)
![FOSS](https://img.shields.io/badge/FOSS-Free%20Open%20Source-brightgreen)
![Commits](https://img.shields.io/badge/commits-640+-orange)
![Lines of Code](https://img.shields.io/badge/lines--of--code-56249-blueviolet)

Network learning app: [Test Address](https://network2026.vercel.app)

## Recent Updates

- DNS records now support readable chains such as `www.a10.com -> a10.com -> 192.168.1.10`.
- DNS record lists show record types clearly: `A Record` and `CNAME Record` with TR/EN localization.
- The Help modal tabs and PC Services tabs now use a unified Tab-style layout.
- The IoT panel includes a short `Internet of Things` description for clearer onboarding.
- Example projects were cleaned up so PC devices keep only their real ports instead of switch-like port dumps.

## ✨ Key Features

### 🌐 Interactive Network Topology
- **Device Management**: Drag and drop PC, Switch, and Router devices to canvas
- **Zoom & Pan**: Smooth zoom and pan operations with spatial partitioning
  - **NEW: Advanced Navigation**: Left-click to pan canvas, middle-click for rectangle selection, right-click for context menu
- **Selection System**: Multi-device rubber-band selection with real-time feedback (box intersection detection)
- **Cable System**: Straight-through, Crossover, and Console cables
- **Connection Management**: Create and manage connections between devices
- **Visual Feedback**: Device status indicators and port labels
  - **UX Optimization**: Tooltips suppressed during active operations (panning, selecting, connecting)
  - **NEW: Advanced Selection Logic**: Selection clearing moved to mouse-up on empty canvas, preventing accidental deselection.
  - **Device Information Panels**: Collapsible mini-panels with persistence (minimized/maximized states saved to localStorage).
  - **Interaction Legend**: Visual guide for mouse shortcuts in the footer toolbar
  - **Task Notifications**: Context-aware success/failure alerts at the footer top-left
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
  - **IoT Device Management**: Safely connect/disconnect or fully delete IoT devices mapping to topology
  - Bulk operations for gracefully disconnecting or removing multiple IoT devices visually
  - IP address display for connected IoT devices
- **IoT Web Panel**: Centralized Internet of Things (IoT) device management interface accessible via `http://iot-panel`
  - **Password Protection**: Secure login with username/password (admin/admin)
  - **Session-Based Authentication**: Remembers login state using sessionStorage
  - **Device List**: View all connected IoT devices in the network
  - **Device Management**: Access individual IoT device management pages
  - **Active/Inactive Toggle**: Control IoT reading activation (collaborationEnabled property)
  - **Back to List**: Navigate back to device list without re-authentication
  - **Backdrop Blur**: Visual blur effect when browser popup opens
  - Context Menu Restrictions: Smart right-click menu tailored to device types (e.g., disabling 'Open' for non-interactive IoT devices)
  - Save file (JSON) optimization by abstracting away redundant switch parameters for PC and IoT devices
  - Modern, responsive UI with dark/light theme support
- **IoT WiFi Lab**: Complete lab scenario with 3 Internet of Things (IoT) device types (Temperature, Humidity, Motion sensors)
  - Pre-configured example project with WiFi connectivity
  - Static IP assignment support for IoT devices

### ⚡ Performance Optimization (Phase 2)
- **Spatial Partitioning**: Grid-based 256x256px partitioning for efficient rendering of 500+ nodes
- **Viewport Culling**: Only visible nodes and connections are rendered to maintain 60 FPS
- **Virtual Scrolling**: Optimized device lists with `react-window` for memory efficiency
- **Skeleton Screens**: Progressive loading with skeleton components for smoother transitions
- **Asset Loading Strategy**: Next.js 16 optimized image and icon loading
- **Node Pooling**: Efficient memory management for network elements

## 🗺️ Development Roadmap

### ✅ Completed (v1.5.1)
- Interactive network topology with drag-and-drop
- WiFi simulation with signal strength indicators
- IoT device management and web panel
- Layer 3 switching and routing (RIP/OSPF)
- **Spanning Tree Protocol (STP) Simulation**: Visual blocking detection with amber port coloring
  - Root bridge election based on lowest MAC address
  - Port roles: Root, Designated, Alternate (blocked)
  - Port states: Forwarding, Blocking
  - Visual indicators: Amber color for blocked ports, no data animation on blocked links
  - STP status shown in port tooltips (e.g., "Altn BLK", "Root FWD")
- Note system with undo/redo support
- Ping diagnostics with visual animation
- Multi-selection and bulk operations
- Performance optimization (spatial partitioning, viewport culling)
- Accessibility (WCAG 2.1 AA compliance)
- Turkish/English localization
- **24 Example Projects**: Complete lab scenarios
- **150+ CLI Commands**: Full command reference in Help Panel
- DHCP/DNS/HTTP system enhancements
- IoT WiFi Lab with sensor simulation

### 🚧 In Progress (v1.6.0)
- Advanced routing protocols (BGP, EIGRP)
- Network security simulation (ACLs, NAT, Firewall)
- VLAN trunking and inter-VLAN routing
- DHCP server simulation
- Enhanced IoT protocols (MQTT, CoAP)

### 📋 Planned (v1.7.0 - v2.0.0)
- Packet capture and analysis (Wireshark-like)
- Network monitoring dashboard
- Automated lab grading system
- Cloud-based lab sharing
- Mobile app (React Native)
- VR/AR network visualization
- AI-powered network troubleshooting
- Multi-user collaborative labs
- Advanced QoS and traffic shaping
- IPv6 support throughout

### 🎯 Long-term Vision
- Enterprise network simulation
- SDN (Software-Defined Networking) support
- Network automation with Ansible/Puppet
- Integration with real network equipment
- Certification exam preparation (CCNA/CCNP)
- University curriculum integration

### 🛣️ Layer 3 Switching & Routing
- **L3 Switch Support**: Implementation of WS-C3560-24PS with 4 GigabitEthernet ports
- **Routed Ports**: Convert physical switch ports to routed ports with `no switchport`
- **Dynamic Routing**: Support for RIP and OSPF routing protocols
- **IP Routing Engine**: Enable/disable global IP routing on L3 devices
- **Routing Tasks**: Dedicated task system for routing configurations

### ♿ Accessibility (WCAG 2.1 AA)
- **ARIA Management**: Comprehensive ARIA attribute system for screen readers
- **Keyboard Navigation**: Full focus management, trapping, and shortcut support
- **High Contrast Support**: Optimized themes for improved visibility
- **Screen Reader Announcements**: Real-time feedback for simulation actions

## 💻 Network CLI Simulation

The simulator supports **100+ commands** across multiple configuration modes. For a complete command reference, see [CLI_COMMANDS.md](./CLI_COMMANDS.md).

### Features
- **Tab Completion**: Auto-complete commands with TAB
- **Command History**: Up/Arrow keys for previous commands
- **Context Help**: Use `?` for command help
- **Error Checking**: Detailed error messages for invalid commands

### 🔌 Physical Device Visualization
- **Port Panel**: Realistic port display with STP status support
- **LED Indicators**: Colored LEDs showing connection status
  - **Green**: Connected/Forwarding
  - **Orange/Amber**: STP Blocked (Alternate port)
  - **Gray**: Shutdown/Closed
  - **White**: Idle/Not Connected
- **Port Status**: Connected, Disconnected, Shutdown, and STP Blocked states
- **STP Visualization**: Blocked ports shown in amber with "Altn BLK" tooltip indicator

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
- **Multi-Selection 2.0**: Improved selection logic with rubber-band and Shift+Click support
- **DNS/HTTP System**: Enhanced web simulation with domain name resolution and CNAME-style alias chains
- **Keyboard Shortcuts**: Ctrl+Z (Undo), Ctrl+Y (Redo), Ctrl+A (Select All), etc.
- **Dark/Light Mode**: Dark and light theme support with system preference detection
- **Turkish/English**: Full localization support with dynamic switching
- **Offline Storage**: Persistent simulation state using IndexedDB/localStorage
- **Task System**: Interactive tasks for WLAN, Routing, Security, and VLANs

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16.2](https://nextjs.org/) + [React 19](https://react.dev/)
- **Language**: [TypeScript 5.9](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4.0](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) + [Lucide React 1.7](https://lucide.dev/)
- **State Management**: [Zustand 5.0](https://docs.pmnd.rs/zustand)
- **Storage**: IndexedDB (via custom offline storage) + localStorage
- **Testing**: [Vitest 4.1](https://vitest.dev/)

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
│   ├── performance/          # Performance optimization components
│   └── ui/                   # Modern shadcn/ui components
├── lib/
│   ├── network/              # Network logic
│   │   ├── parser.ts         # Command parser
│   │   ├── executor.ts       # Command executor
│   │   ├── connectivity.ts   # Connectivity checker
│   │   ├── routing.ts        # Routing logic
│   │   └── types.ts          # Type definitions
│   ├── performance/          # Optimization strategies (spatial, virtual)
│   ├── accessibility/        # WCAG compliance logic
│   └── design-system/        # Design tokens and responsive utils
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

Detailed documentation lives in the `kiro/` and `docs/` folders:

- **Performance**: [Optimization Guide](kiro/PERFORMANCE_OPTIMIZATION_GUIDE.md) | [Validation Report](kiro/PERFORMANCE_VALIDATION_REPORT.md)
- **Accessibility**: [Implementation Guide](src/lib/accessibility/ACCESSIBILITY_GUIDE.md)
- **Features**: [DNS/HTTP System](docs/DNS_HTTP_IMPROVEMENTS_SUMMARY.md) | [Multi-Selection](docs/MULTI_SELECTION_IMPROVEMENTS.md)
- **Core Systems**: [Note System](kiro/NOTE_SYSTEM_SUMMARY.md) | [Ping Diagnostics](kiro/PING_DIAGNOSTICS_IMPLEMENTATION.md) | [Power Toggle](kiro/POWER_TOGGLE_IMPLEMENTATION.md)
- **Validation**: [Subnet Validation](kiro/SUBNET_VALIDATION_IMPLEMENTATION.md) | [Project Structure](kiro/PROJECT_STRUCTURE_VERIFICATION.md)

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

### Layer 3 Routing
1. Drag a **Router** or **L3 Switch** to the canvas
2. Enter CLI and enable IP routing: `ip routing`
3. Configure routed ports: `interface g0/1` -> `no switchport` -> `ip address 192.168.10.1 255.255.255.0`
4. Configure RIP/OSPF: `router rip` -> `network 192.168.10.0`

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
- Source files: `175+`
- Total lines: `56586`
- TS/TSX files: `165+`
- Network components: `55+`
- Example projects: `24`
- CLI commands: `150+`
- Last updated: `2026-04-18`

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

---

**Sürüm**: 1.5.2
**Son Güncelleme**: 2026-04-18
**Durum**: Production Ready

GitHub: [github.com/tbagriyanik/ciscosim](https://github.com/tbagriyanik/ciscosim)
