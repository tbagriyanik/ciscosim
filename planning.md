## Summary of Changes: IoT Web Panel Enhancements

This implementation introduces an enhanced "IoT Web Panel" feature to the PC device interface, allowing users to securely view and manage connected IoT devices through a simulated web interface with authentication and device control capabilities.

**1. New File: `src/lib/network/iotWebPanel.ts`**

*   **`generateIotWebPanelContent(iotDevices, language)`**:
    *   Generates an HTML string that lists all available IoT devices.
    *   **Password Protection**: Secure login form with username/password fields (both default to "admin")
    *   **Session-Based Authentication**: Uses sessionStorage to remember login state
    *   **Auto-fill**: Username field is pre-filled with "admin" for convenience
    *   **Enter Key Support**: Supports Enter key for both username and password fields
    *   Each IoT device is presented as a card with its name/ID and a "Connect" button.
    *   Clicking the "Connect" button sends a `postMessage` to the parent window (PCPanel.tsx) with a `type: 'open-iot-device'` and the `deviceId`.
    *   Includes modern styling with responsive design and Turkish/English language support.
*   **`generateIotDevicePageContent(deviceId, deviceName, language)`**:
    *   Generates an HTML string for a simulated IoT device administration page.
    *   **Device Information Panel**: Displays device ID, name, and current status
    *   **Active/Inactive Toggle**: Toggle switch to control IoT reading activation (collaborationEnabled property)
    *   **Back to List Button**: Returns to IoT device list without re-authentication
    *   **Real-time Status Updates**: Visual feedback for active/inactive states with color coding
    *   **Message Communication**: Sends `toggle-iot-device` and `back-to-iot-list` messages to parent window
    *   Includes modern styling with toggle switch UI and Turkish/English language support.

**2. Modified File: `src/components/network/PCPanel.tsx`**

*   **Imports**:
    *   Added imports for `generateIotWebPanelContent` and `generateIotDevicePageContent` from `src/lib/network/iotWebPanel.ts`.
    *   Added `LayoutGrid` to the `lucide-react` import for the new button's icon.
*   **`openHttpTarget` Function**:
    *   **Special URL Handling**: Enhanced to recognize and process two new special URLs:
        *   `http://iot-panel`: When this URL is targeted, it calls `generateIotWebPanelContent` to create the IoT device listing page and sets it as the `httpAppContent`.
        *   `iot://iot-device/<deviceId>`: When a URL matching this pattern is targeted, it extracts the `deviceId`, finds the corresponding IoT device, and calls `generateIotDevicePageContent` to display the simulated admin page for that device.
*   **`handleRouterAdminMessage` Function**:
    *   **Iframe Communication**: Modified the `useEffect` hook that contains `handleRouterAdminMessage` to include `openHttpTarget` in its dependency array.
    *   **Message Handlers**:
        *   `open-iot-device`: Opens individual IoT device management page
        *   `back-to-iot-list`: Returns to IoT device list by calling `openHttpTarget('http://iot-panel')`
        *   `toggle-iot-device`: Toggles IoT device reading activation by updating `collaborationEnabled` property
    *   **Device Status Update**: Sends `update-topology-device-config` event to update IoT device configuration
*   **Backdrop Blur Effect**:
    *   Added `backdrop-blur-sm bg-black/20` to the browser popup overlay
    *   Creates visual blur effect on background when browser popup opens
*   **UI Integration**:
    *   A new "IoT Panel" button has been added to the PC panel's navigation tabs, positioned next to the "Desktop" button.
    *   This button uses the `LayoutGrid` icon and, when clicked, triggers `openHttpTarget('http://iot-panel')`, launching the IoT Web Panel.
    *   The button's styling is consistent with the existing navigation tabs.

These changes collectively enable a secure, feature-rich web-based management interface for IoT devices directly from the PC device in the network simulator, with authentication, device control, and improved user experience.

## Recent Maintenance Updates

The IoT and DHCP flows were later extended with several maintenance fixes so the current behavior is slightly broader than the original implementation above.

**3. Network Addressing Updates**

*   **New File: `src/lib/network/linkLocal.ts`**
    *   Added `generateRandomLinkLocalIpv4()` to generate APIPA addresses in the `169.254.x.x` range.
    *   Added `isLinkLocalIpv4()` helper for link-local detection.
*   **Modified File: `src/components/network/PCPanel.tsx`**
    *   **DHCP Fallback**: When DHCP lease acquisition fails, devices now fall back to APIPA instead of silently staying unconfigured.
    *   **IoT Renew Support**: Added `router-admin-renew-iot` message handling so IoT devices can renew their IP from the router admin page.
    *   **Router Subnet Awareness**: IoT connect/renew flows now prefer the router's runtime interface IP/subnet from `deviceStates`, so if a router is on `192.168.10.x`, connected IoT devices receive addresses from that subnet rather than a hardcoded `192.168.1.x` fallback.
*   **Modified File: `src/components/network/NetworkTopology.tsx`**
    *   New IoT devices are initialized for DHCP-oriented behavior instead of receiving an immediate static-looking IP on creation.

**4. IoT Panel UX Improvements**

*   **Modified File: `src/components/network/WifiControlPanel.tsx`**
    *   Added an `IP Renew` button in the `Connected IoT Devices` section.
    *   The button posts a `router-admin-renew-iot` message to the parent frame.
*   **Modified File: `src/components/network/PCPanel.tsx`**
    *   Connected IoT lists in the router admin flow now keep power-off devices visible instead of dropping them from the list.
    *   PC terminal IoT panel listing also keeps powered-off IoT devices visible.
*   **Modified File: `src/components/network/NetworkTopology.tsx`**
    *   The IoT Wi-Fi tooltip now shows the current IP address, preferring the runtime `wlan0` IP when available.

These maintenance updates make the IoT experience more realistic: devices keep their association visibility when powered off, renew IP addresses from the correct router subnet, and fall back to APIPA when DHCP is unavailable.

## Spanning Tree Protocol (STP) Implementation

This implementation adds STP (Spanning Tree Protocol) simulation to the network simulator, providing visual feedback for blocked ports in redundant network topologies.

### 1. Core STP Algorithm

**Modified File: `src/lib/network/core/showCommands.ts`**

*   **`calculateSTPState(state, ctx)`** (exported function):
    *   Implements simplified STP algorithm based on Cisco's PVST (Per-VLAN Spanning Tree)
    *   **Root Bridge Election**: Selects root bridge based on lowest MAC address
    *   **Port Role Determination**:
        *   Root Port: Lowest cost path to root bridge
        *   Designated Port: All ports on root bridge, or best path to downstream segments
        *   Alternate Port: Redundant paths to root bridge (blocked)
    *   **Port State Assignment**:
        *   Forwarding (FWD): Root and Designated ports
        *   Blocking (BLK): Alternate ports to prevent loops
    *   Returns a `Map<portId, {role, state}>` for all switch ports

*   **`cmdShowSpanningTree()`**:
    *   Uses `calculateSTPState()` to generate output
    *   Updates port `spanningTree` property in returned `newState`
    *   Output format matches Cisco IOS: `Fa0/1 Desg FWD 19 128.1 P2p`

### 2. Type Definitions

**Modified File: `src/lib/network/types.ts`**

*   Added `spanningTree` property to `Port` interface:
    ```typescript
    spanningTree?: {
      role?: 'root' | 'designated' | 'alternate' | 'backup' | 'disabled';
      state?: 'forwarding' | 'blocking' | 'listening' | 'learning' | 'disabled';
      portfast?: boolean;
      bpduguard?: boolean;
    };
    ```

**Modified File: `src/components/network/networkTopology.types.ts`**

*   Added `spanningTree` property to `CanvasPort` interface for topology visualization

### 3. Visual Indicators

**Modified File: `src/components/network/NetworkTopology.tsx`**

*   **Port Coloring**: STP blocked ports shown in **amber** (`#f59e0b`)
    *   Check: `port.spanningTree?.state === 'blocking' || port.spanningTree?.role === 'alternate'`
    *   Applied in switch port rendering logic
*   **Cable Animation Suppression**: 
    *   Detects STP-blocked ports on both ends of a connection
    *   Disables data flow animation (`animateMotion`) for blocked links
    *   Check: `!isSTPBlocked` condition added to animation rendering

**Modified File: `src/components/network/networkTopology.constants.tsx`**

*   Added `blocked: '#f59e0b'` (amber) color to `PORT_COLORS` for all port types (ethernet, console, gigabit)

**Modified File: `src/components/network/PortPanel.tsx`**

*   **LED Color**: Blocked ports show **orange** LED indicator
    *   Check: `port.spanningTree?.state === 'blocking' || port.spanningTree?.role === 'alternate'`
    *   Status label: "Blocked" (localized)
*   **Tooltip**: Shows STP role and state (e.g., "Altn BLK", "Root FWD", "Desg FWD")

**Modified File: `src/components/network/RouterPanel.tsx`**

*   Added STP blocking check to `getPortLEDColorClass()` for router ports

### 4. Network Refresh Integration

**Modified File: `src/app/page.tsx`**

*   **`handleRefreshNetwork()`**:
    *   Iterates all switches in topology
    *   Calls `calculateSTPState()` for each switch
    *   Updates `deviceStates` with new `spanningTree` properties
    *   Triggered by: Refresh button, F5 key, or network changes
    *   Applies role/state mapping: `'Altn'` → `'alternate'`, `'BLK'` → `'blocking'`, etc.

### 5. Command Integration

**File: `src/lib/network/core/showCommands.ts`**

*   **`show spanning-tree` command**:
    *   Calculates STP topology dynamically
    *   Displays VLAN-specific STP information
    *   Shows port roles (Root/Desg/Altn/Back) and states (FWD/BLK)
    *   Example output:
        ```
        VLAN0001
          Spanning tree enabled protocol ieee
          Root ID    Priority    32769
                     Address     0001.4203.FF01
                     Cost        19
                     Port        1 (FastEthernet0/1)
                     Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec
          Bridge ID  Priority    32769
                     Address     0001.4203.FF02
                     Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec
          Interface           Role Sts Cost      Prio.Nbr Type
          ------------------- ---- --- --------- -------- --------------------------------
          Fa0/1               Root FWD 19        128.1    P2p
          Fa0/2               Altn BLK 19       128.2    P2p
        ```

### Key Features

1. **Automatic Root Bridge Election**: Lowest MAC address becomes root
2. **Redundant Link Detection**: Multiple paths to root bridge detected
3. **Visual Blocking Indicators**: 
   - Amber port color in topology
   - Orange LED in PortPanel
   - No data animation on blocked cables
4. **Real-time Updates**: STP recalculated on network refresh
5. **CLI Support**: `show spanning-tree` command displays current STP state

### Usage Example

When two switches are connected with two redundant links:
1. Switch with lower MAC becomes Root Bridge
2. Lower port number (e.g., Fa0/1) becomes **Root Port** (Forwarding)
3. Higher port number (e.g., Fa0/2) becomes **Alternate Port** (Blocking)
4. Blocked port shown in **amber** with "Altn BLK" tooltip
5. No data flow animation on the blocked link

## UI/UX Refinement & Workspace Persistence (v1.5.2)

This phase focuses on improving the user's workflow by making the workspace more persistent and reducing accidental actions.

### 1. Panel Minimization with Persistence
*   **State Management**: Added `isMinimized` state to `PCPanel`, `RouterPanel`, and their mini popovers in `page.tsx`.
*   **Toggle System**: Replaced the close (X) button logic with a minimize/expand toggle using **v** (`ChevronDown`) and **^** (`ChevronUp`) icons.
*   **Local Storage Integration**: All minimized states are saved to and loaded from `localStorage` (`pc-panel-minimized`, `router-panel-minimized`, etc.).
*   **UI Focus**: Removed 'X' (Close) buttons from info popovers to encourage using the minimization model, ensuring device data stays accessible without cluttering the screen.

### 2. Selection System Optimization
*   **Event Handling**: Selection clearing logic on empty canvas moved from `mousedown` to `mouseup`.
*   **Drag Awareness**: The selection is only cleared if the user performs a simple click without any movement (dragging/panning).
*   **UI element Protection**: Added logic to prevent topology selection clearing when clicking on UI elements like menus, palettes, or dashboards.
*   **Right-Click Stability**: Opening the context menu no longer clears the current selection group.

### 3. Code Metrics Update
*   **Total Lines of Code**: 56,249
*   **Implementation Date**: 2026-04-18
