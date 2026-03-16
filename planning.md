# 📋 Network Simulator 2026 Pro - Planning & Roadmap

This document tracks the implementation status of features and planned enhancements for the simulator.

## 🚀 Core Infrastructure
- [x] **Next.js 16 + React 19 Integration** - Modern framework setup
- [x] **TypeScript 5 Implementation** - End-to-end type safety
- [x] **Tailwind CSS 4 + Animations** - Responsive and polished UI
- [x] **Internationalization (i18n)** - Support for Turkish (TR) and English (EN)
- [x] **State Management** - Per-device CLI state and topology persistence
- [x] **Database Integration** - Prisma ORM configured
- [ ] **App Hosting Deployment** - Cloud deployment for server-side Next.js app

## 🌐 Network Topology Canvas
- [x] **Device Palette** - PC, Switch, and Router drag & drop support
- [x] **Canvas Interaction** - Smooth zoom (cursor-aware) and panning
- [x] **Cable Management** - Straight-through, Crossover, and Console cable logic
- [x] **Connection Validation** - Intelligent cable compatibility checking
- [x] **Visual Feedback** - Animated data packets and port link LEDs
- [x] **Minimap** - Navigation overview for large topologies
- [x] **Save/Load Topology** - Persistent storage of canvas layouts to database / Local JSON
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
- [ ] **Inter-VLAN Routing** - Router-on-a-stick and Layer 3 Switch routing
- [ ] **Static Routing** - `ip route` implementation
- [ ] **Dynamic Routing** - OSPF or RIP basic simulation
- [x] **DHCP Services** - Basic DHCP simulation
- [ ] **Access Control Lists (ACL)** - Standard and Extended IP ACLs

## 🖥️ PC & End-Device Simulation
- [x] **PC Command Prompt** - Dedicated terminal for end-devices
- [x] **Network Utilities** - `ping`, `ipconfig`, `help`
- [x] **Persistence** - Independent command history and IP config per PC
- [ ] **Web Browser Simulation** - Basic HTTP request testing
- [x] **Telnet/SSH Client** - Connecting to switches from the PC terminal

## 🏆 Lab & Education System
- [x] **Task Engine** - Dynamic task validation based on device state
- [x] **Visual Progress** - Real-time task cards and progress bars
- [x] **Categorized Labs** - Topology, Port, VLAN, and Security groups
- [x] **UX/UI Polish (Q1 2026)** - Project menu simplification, save status indicator, tab tooltips, mobile labels, task badges, toasts, onboarding tour
- [ ] **Scenario Creator** - Tool to create custom labs without coding
- [ ] **Certification Tracks** - Pre-defined CCNA-style lab sequences

## 🛠️ Future Roadmap
- [ ] **Multi-user Collaboration** - Real-time shared labs via WebSockets
- [ ] **Packet Inspection** - "Wireshark-lite" view for data flow analysis
- [x] **Mobile Optimization** - Improved touch gestures, compact modals, and back button support
- [ ] **Terminal UX Enhancements** - Search/highlight, copy output, and PC console parity (in progress)
- [ ] **Performance Benchmarks** - Optimizing large topology rendering (100+ devices)
