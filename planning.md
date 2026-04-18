# Recent Network CLI, Maintenance, and Accessibility Updates

This note summarizes the recent CLI command fixes, code cleanup improvements, and accessibility enhancements in the simulator.

## Overview

Fixed domain lookup command handling, removed debug logging from production code, and added comprehensive ARIA labels to improve accessibility for screen readers.

## Domain Lookup Command Fixes

### Issue
The `no ip domain-lookup` command was not working due to a key mismatch between the parser pattern and the command handler mapping.

### Resolution
- Fixed key mismatch in `globalConfigCommands.ts`: Changed handler key from `'no ip domain lookup'` (with space) to `'no ip domain-lookup'` (with hyphen) to match the parser pattern
- Added support for `ip domain-lookup` (with hyphen) to re-enable domain lookup, providing both hyphen and space variants for flexibility
- Both `ip domain lookup` and `ip domain-lookup` now work correctly to enable domain lookup
- `no ip domain-lookup` correctly disables domain lookup

### Files Modified
- `src/lib/network/parser.ts` - Added pattern for `ip domain-lookup` with hyphen
- `src/lib/network/core/globalConfigCommands.ts` - Fixed handler key mapping and added hyphen variant

## Code Cleanup

Removed debug console.log statements from production code to improve performance and code cleanliness:

### Files Modified
- `src/hooks/useDeviceManager.ts` - Removed DEBUG console.log statements for domainLookup tracking (2 statements)
- `src/components/network/PCPanel.tsx` - Removed debug console.log statements from IoT message handling (10+ statements)
- `src/components/network/WifiControlPanel.tsx` - Removed script loaded console.log statement

### Impact
- Cleaner console output in production
- Reduced unnecessary logging overhead
- Improved code maintainability

## Accessibility Improvements

Added comprehensive ARIA labels and role attributes to improve screen reader support and keyboard navigation:

### Files Modified
- `src/components/network/NetworkTopology.tsx` - Added ARIA labels to device palette buttons (PC, L2, L3, Router, IoT) and cable type selector buttons (straight, crossover, console) with role="group" and aria-pressed
- `src/components/network/RouterPanel.tsx` - Added ARIA labels to minimize/maximize button, tab buttons with role="tab", aria-selected, aria-controls, and tab panels with role="tabpanel" and corresponding ids

### Impact
- Improved screen reader support for device selection and cable type selection
- Proper tab pattern implementation for RouterPanel tabs (overview, ports, wifi, dhcp)
- Better keyboard navigation support
- WCAG 2.1 AA compliance improvements

## Previous Updates

### IoT Web Panel
- `generateIotWebPanelContent(iotDevices, language)` renders a login-protected IoT device list.
- `generateIotDevicePageContent(deviceId, deviceName, language)` renders the per-device management page.
- The IoT panel is opened through `http://iot-panel`.
- Individual device pages are opened through `iot://iot-device/<deviceId>`.
- The panel supports session-based login, device toggles, and a return-to-list flow without re-authentication.

### DNS and HTTP Flow
- DNS records in PC services support chained lookups such as `www.a10.com -> a10.com -> 192.168.1.10`.
- The DNS list now shows readable labels for record type.
- Record type labels are localized:
  - Turkish: `A Kaydı (Address Record)` and `CNAME Kaydı (Canonical Name Record)`
  - English: `A Record (Address Record)` and `CNAME Record (Canonical Name Record)`
- `http www.a10.com` should resolve correctly when the DNS chain ends in a valid IP address.

### UI Refinements
- Help modal tabs now use a unified tab-style layout.
- PC service subtabs for `DNS`, `HTTP`, and `DHCP` now share the same tab-style look.
- The IoT section includes a short `Internet of Things` description to make the panel clearer for first-time users.
- Example project JSON files were cleaned up so PC devices only keep their real ports instead of switch-like port dumps.

