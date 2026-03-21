# Power ON/OFF Toggle Implementation - Multi-Select Context Menu

## Overview
Implemented a bulk power toggle feature for the multi-select context menu. Users can now toggle the power state (online/offline) for one or multiple selected devices at once.

## Changes Made

### 1. NetworkTopologyContextMenu.tsx
- **Added Power icon import**: Imported `Power` from lucide-react
- **Added callback prop**: `onTogglePowerDevices: (ids: string[]) => void` to handle power toggle requests
- **Added icon renderer**: Added case for 'power' icon in `renderIcon()` function
- **Added power toggle button**: New button in device context menu that:
  - Appears after the Ping button
  - Shows "Güç Aç/Kapat" (Turkish) or "Power ON/OFF" (English)
  - Uses amber color (#fbbf24) for visual distinction
  - Calls `onTogglePowerDevices()` with selected device IDs
  - Saves to history before toggling

### 2. NetworkTopology.tsx
- **Added togglePowerDevices function**: New callback that:
  - Takes an array of device IDs
  - Toggles each device's status between 'online' and 'offline'
  - Updates device state immediately
  - Works for single or multiple devices
  
- **Added power toggle button to context menu**: 
  - Positioned after Ping button
  - Calls `saveToHistory()` before toggling to enable undo/redo
  - Supports multi-select: if device is in selection, toggles all selected devices
  - Otherwise toggles just the right-clicked device

### 3. NetworkTopologyView.tsx
- **Added togglePowerDevices to props destructuring**: Receives the function from parent
- **Added onTogglePowerDevices prop to context menu**: Passes the function to NetworkTopologyContextMenu

## Features

✅ **Bulk Power Control**: Toggle power for multiple selected devices at once
✅ **Single Device Control**: Toggle power for a single device via context menu
✅ **History Integration**: All power toggles are saved to undo/redo history
✅ **Multi-Language Support**: Turkish and English labels
✅ **Visual Feedback**: Amber-colored button for power operations
✅ **Smart Selection**: Respects multi-select state (toggles all selected if device is in selection)

## Usage

1. Right-click on a device to open context menu
2. Click "Power ON/OFF" (or "Güç Aç/Kapat" in Turkish)
3. Device status toggles between online (green) and offline (red)
4. For multiple devices: Select devices first, then right-click and choose "Power ON/OFF"
5. Use Ctrl+Z to undo power changes

## Device Status Behavior

- **Online**: Device is powered on, ports are active, connections can be established
- **Offline**: Device is powered off, ports are inactive (shown in red), connections cannot traverse through it

## Files Modified

1. `src/components/network/NetworkTopologyContextMenu.tsx`
   - Added Power icon import
   - Added onTogglePowerDevices callback prop
   - Added power toggle button to device context menu

2. `src/components/network/NetworkTopology.tsx`
   - Added togglePowerDevices function
   - Added power toggle button to inline context menu
   - Integrated with history system

3. `src/components/network/NetworkTopologyView.tsx`
   - Added togglePowerDevices to props destructuring
   - Added onTogglePowerDevices prop to context menu component

## Testing Checklist

- [x] Single device power toggle works
- [x] Multi-select power toggle works
- [x] Power state changes are reflected in UI (color changes)
- [x] Undo/Redo works for power toggles
- [x] Turkish and English labels display correctly
- [x] No TypeScript errors
- [x] No compilation warnings
- [x] All three files compile without errors
