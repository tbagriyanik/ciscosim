# IoT Web Panel and Recent Network UX Updates

This note summarizes the current behavior around IoT management, DNS resolution, and the latest UI refinements in the simulator.

## Overview

The PC panel now includes an IoT web management entry point, smarter DNS resolution with alias chains, and cleaner tab-style navigation in the help and services areas.

## IoT Web Panel

- `generateIotWebPanelContent(iotDevices, language)` renders a login-protected IoT device list.
- `generateIotDevicePageContent(deviceId, deviceName, language)` renders the per-device management page.
- The IoT panel is opened through `http://iot-panel`.
- Individual device pages are opened through `iot://iot-device/<deviceId>`.
- The panel supports session-based login, device toggles, and a return-to-list flow without re-authentication.

## DNS and HTTP Flow

- DNS records in PC services support chained lookups such as `www.a10.com -> a10.com -> 192.168.1.10`.
- The DNS list now shows readable labels for record type.
- Record type labels are localized:
  - Turkish: `A Kaydı (Address Record)` and `CNAME Kaydı (Canonical Name Record)`
  - English: `A Record (Address Record)` and `CNAME Record (Canonical Name Record)`
- `http www.a10.com` should resolve correctly when the DNS chain ends in a valid IP address.

## UI Refinements

- Help modal tabs now use a unified tab-style layout.
- PC service subtabs for `DNS`, `HTTP`, and `DHCP` now share the same tab-style look.
- The IoT section includes a short `Internet of Things` description to make the panel clearer for first-time users.
- Example project JSON files were cleaned up so PC devices only keep their real ports instead of switch-like port dumps.

## Maintenance Notes

- The docs were updated to reflect the DNS alias chain behavior.
- Example project notes now explicitly mention the expected `http www.a10.com` flow.
- The simulator keeps the DNS, IoT, and panel labels synchronized across Turkish and English modes.

