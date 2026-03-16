# 📋 Network Simulator 2026 Pro - Planning & Roadmap

This document tracks the implementation status of features and planned enhancements for the simulator.

## 🚀 Core Infrastructure
- [x] **Next.js 16 + React 19 Integration** - Modern framework setup
- [x] **TypeScript 5 Implementation** - End-to-end type safety
- [x] **Tailwind CSS 4 + Animations** - Responsive and polished UI
- [x] **Internationalization (i18n)** - Support for Turkish (TR) and English (EN)
- [x] **State Management** - Per-device CLI state and topology persistence
- [x] **Database Integration** - Prisma ORM configured
- [x] **Offline Support** - localStorage-based PWA with Service Worker
- [ ] **App Hosting Deployment** - Cloud deployment for server-side Next.js app

## 🌐 Network Topology Canvas
- [x] **Device Palette** - PC, Switch, and Router drag & drop support
- [x] **Canvas Interaction** - Smooth zoom (cursor-aware) and panning
- [x] **Cable Management** - Straight-through, Crossover, and Console cable logic
- [x] **Connection Validation** - Intelligent cable compatibility checking
- [x] **Visual Feedback** - Animated data packets and port link LEDs
- [x] **Minimap** - Navigation overview for large topologies
- [x] **Save/Load Topology** - Persistent storage of canvas layouts to database / Local JSON
- [x] **New Project Modal** - Full-screen modal with scroll support and example projects
- [x] **Mobile Optimization** - Touch-friendly interface, responsive modals, 2-column layouts
- [ ] **Auto-layout** - Intelligent positioning of connected devices

## 💻 Network NOS Simulator (Switch Focus)
- [x] **CLI Engine** - Support for multiple modes (User, Priv, Config, Interface)
- [x] **Command Parser** - Case-insensitive parsing with shorthand support (e.g., `conf t`)
- [x] **Interactive Help** - Inline `?` help and Tab-completion
- [x] **Ghost Text** - Intelligent inline command suggestions
- [x] **Terminal UI** - Scrollback, command history, and per-device output
- [x] **Layer 2 Features**:
    - [x] **VLANs** - Creation, naming, and assignment
    - [x] **Trunking** - `switchport mode trunk` and allowed VLANs
    - [x] **Port Security** - Sticky MAC, violation modes (Protect/Restrict/Shutdown)
    - [x] **STP (Spanning Tree)** - Mode selection (PVST, Rapid-PVST) and status viewing
    - [x] **EtherChannel** - `channel-group` configuration
- [x] **System Management**:
    - [x] **Hostname** - Custom device names
    - [x] **Banner** - MOTD configuration
    - [x] **Passwords** - `enable secret`, line passwords, and encryption
    - [x] **NDP** - Network Discovery Protocol neighbor discovery
- [ ] **Advanced Layer 2**:
    - [ ] **VTP (VLAN Trunking Protocol)** - Domain and mode simulation
    - [ ] **LACP/PAGP** - Detailed EtherChannel negotiation logic
    - [ ] **Voice VLAN** - Specific voice port configuration logic

## 🛣️ Routing & Layer 3 Features
- [x] **Basic IP Config** - `ip address` and `ip default-gateway`
- [x] **SVI (Switch Virtual Interface)** - Management VLAN 1 support
- [x] **VLAN-Aware Connectivity** - Cross-VLAN communication through trunk ports
- [x] **Inter-VLAN Routing** - Router-on-a-stick and Layer 3 Switch routing
- [x] **Static Routing** - `ip route` implementation with routing table
- [ ] **Dynamic Routing** - OSPF or RIP basic simulation
- [x] **DHCP Services** - Basic DHCP simulation
- [ ] **Access Control Lists (ACL)** - Standard and Extended IP ACLs

## 🖥️ PC & End-Device Simulation
- [x] **PC Command Prompt** - Dedicated terminal for end-devices
- [x] **Network Utilities** - `ping`, `ipconfig`, `help`
- [x] **Persistence** - Independent command history and IP config per PC
- [x] **MAC Address Synchronization** - ipconfig shows topology MAC address
- [x] **Mobile-Optimized Interface** - Responsive 2-column layouts for touch devices
- [ ] **Web Browser Simulation** - Basic HTTP request testing
- [x] **Telnet/SSH Client** - Connecting to switches from the PC terminal

## 🏆 Lab & Education System
- [x] **Task Engine** - Dynamic task validation based on device state
- [x] **Visual Progress** - Real-time task cards and progress bars
- [x] **Categorized Labs** - Topology, Port, VLAN, and Security groups
- [x] **UX/UI Polish (Q1 2026)** - Project menu simplification, save status indicator, tab tooltips, mobile labels, task badges, toasts, onboarding tour
- [x] **Save Status Indicator** - Real-time unsaved/saved status with compact labels
- [x] **Mobile Tab Management** - Bottom tab bar hidden in modals for better UX
- [ ] **Scenario Creator** - Tool to create custom labs without coding
- [ ] **Certification Tracks** - Pre-defined CCNA-style lab sequences

## 🛠️ Future Roadmap
- [ ] **Multi-user Collaboration** - Real-time shared labs via WebSockets
- [ ] **Packet Inspection** - "Wireshark-lite" view for data flow analysis
- [x] **Mobile Optimization** - Improved touch gestures, compact modals, and back button support
- [ ] **Terminal UX Enhancements** - Search/highlight, copy output, and PC console parity (in progress)
- [ ] **Performance Benchmarks** - Optimizing large topology rendering (100+ devices)

## 📚 Example Projects (Templates)

### 🎓 Beginner Labs
- [x] **Basic Switch Configuration** - Single switch with VLAN setup
- [x] **PC-to-PC Communication** - Two PCs on same VLAN
- [x] **Basic Trunk Configuration** - Two switches with trunk port

### 🏢 Intermediate Labs  
- [x] **Inter-VLAN Routing (L3 Switch)** - Multi-VLAN environment with L3 switch
- [x] **Router-on-a-Stick** - Router with subinterfaces for VLAN routing
- [x] **Static Routing Lab** - Multi-router topology with static routes
- [x] **Port Security Lab** - Switch with port security configuration
- [x] **EtherChannel Lab** - Link aggregation between switches

### 🏭 Advanced Labs
- [ ] **OSPF Multi-Area** - Dynamic routing with OSPF areas
- [ ] **Enterprise Network** - Full campus network with Core/Distribution/Access
- [ ] **WAN Simulation** - Multiple sites with WAN connections
- [ ] **Network Security** - ACLs, port security, and DHCP snooping combined

### 📋 Example Project Details

#### 1. Basic VLAN Lab (Beginner)
```
Devices: 1 Switch, 2 PCs
Concepts: VLAN creation, access ports, inter-VLAN ping
Commands: vlan, switchport mode access, switchport access vlan
```

#### 2. Inter-VLAN Routing Lab (Intermediate)
```
Devices: 1 L3 Switch, 4 PCs
Concepts: VLANs, SVI, ip routing, inter-VLAN communication
Commands: ip routing, interface vlan, ip address
```

#### 3. Static Routing Lab (Intermediate)
```
Devices: 2 Routers, 2 Switches, 4 PCs
Concepts: Static routes, next-hop, routing table
Commands: ip route, show ip route
```

#### 4. Enterprise Network (Advanced)
```
Devices: 2 Core Switches, 4 Distribution Switches, 8 Access Switches, 16 PCs
Concepts: Hierarchical design, redundancy, EtherChannel, routing
Commands: Full range of switching and routing commands
```

#### 5. Router-on-a-Stick Lab (Intermediate)
```
Devices: 1 Router, 1 Switch, 4 PCs (2 VLANs)
Concepts: Subinterfaces, 802.1Q encapsulation, inter-VLAN routing
Commands: interface gi0/0.10, encapsulation dot1q 10
```

#### 6. Port Security Lab (Intermediate)
```
Devices: 1 Switch, 2 PCs
Concepts: Sticky MAC, violation modes, secure ports
Commands: switchport port-security, switchport port-security mac-address sticky
```

#### 7. Basic Campus Network (Advanced)
```
Devices: 1 Core Router, 2 Distribution Switches, 4 Access Switches, 8 PCs
Concepts: Layer 3 at core, VLANs, trunking, routing
Commands: Full switch and router configuration
```

#### 8. Redundant Links Lab (Intermediate)
```
Devices: 2 Switches, 4 PCs
Concepts: STP, redundant paths, root bridge election
Commands: spanning-tree mode rapid-pvst, spanning-tree priority
```

### 🎯 Learning Paths

#### **CCNA Preparation Track**
1. ✅ **Network Fundamentals** - Basic device connectivity
2. ✅ **VLANs & Trunking** - Layer 2 segmentation
3. ✅ **Inter-VLAN Routing** - L3 switching and routing
4. ✅ **Static Routing** - Manual route configuration
5. 🔄 **Dynamic Routing (OSPF)** - Coming soon
6. ⏳ **ACLs** - Access control implementation
7. ⏳ **NAT & DHCP** - Network services
8. ⏳ **WAN Technologies** - Serial connections

#### **Network Security Track**
1. ✅ **Port Security** - MAC address control
2. 🔄 **DHCP Snooping** - Rogue DHCP protection
3. ⏳ **Dynamic ARP Inspection** - ARP spoofing prevention
4. ⏳ **ACL Implementation** - Traffic filtering
5. ⏳ **Secure VLANs** - Private VLAN concepts

#### **Enterprise Networking Track**
1. ✅ **EtherChannel** - Link aggregation
2. ✅ **STP/RSTP** - Loop prevention
3. 🔄 **VTP** - VLAN management (planned)
4. ⏳ **HSRP/VRRP** - First hop redundancy
5. ⏳ **Multi-layer Switching** - Advanced L3 features
