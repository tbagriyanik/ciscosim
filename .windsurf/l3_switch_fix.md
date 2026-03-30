# L3 Switch Port Configuration Fix

## Problem
When adding an L3 switch, it was using the same port configuration as an L2 switch, which didn't reflect the actual capabilities of an L3 switch.

## Root Cause
The `addDevice` function was always calling `generateSwitchPorts()` for all switches, regardless of whether they were L2 or L3.

## Solution Implemented

### 1. Added L3 Switch Port Generation Function
```typescript
const generateL3SwitchPorts = () => {
  const ports = [{ id: 'console', label: 'Console', status: 'disconnected' as const }];
  // 24 FastEthernet ports
  for (let i = 1; i <= 24; i++) {
    ports.push({ id: `fa0/${i}`, label: `Fa0/${i}`, status: 'disconnected' as const });
  }
  // 4 GigabitEthernet ports (L3 switches have more)
  ports.push({ id: 'gi0/1', label: 'Gi0/1', status: 'disconnected' as const });
  ports.push({ id: 'gi0/2', label: 'Gi0/2', status: 'disconnected' as const });
  ports.push({ id: 'gi0/3', label: 'Gi0/3', status: 'disconnected' as const });
  ports.push({ id: 'gi0/4', label: 'Gi0/4', status: 'disconnected' as const });
  ports.push({ id: 'wlan0', label: 'WLAN0', status: 'disconnected' as const });
  return ports;
};
```

### 2. Updated addDevice Function
Modified the port generation logic to use the correct function based on switch layer:
```typescript
ports:
  type === 'pc'
    ? [/* PC ports */]
    : type === 'switch'
      ? switchLayer === 'L3' ? generateL3SwitchPorts() : generateSwitchPorts()
      : generateRouterPorts(),
```

## Key Differences Between L2 and L3 Switch Ports

### L2 Switch (WS-C2960-24TT-L)
- Console port
- 24 FastEthernet ports (Fa0/1 to Fa0/24)
- 2 GigabitEthernet ports (Gi0/1, Gi0/2)
- WLAN0 port

### L3 Switch (WS-C3560-24PS)
- Console port
- 24 FastEthernet ports (Fa0/1 to Fa0/24)
- 4 GigabitEthernet ports (Gi0/1 to Gi0/4) - **2 more than L2**
- WLAN0 port

## Files Modified
- `src/components/network/NetworkTopology.tsx`
  - Added `generateL3SwitchPorts()` function
  - Updated `addDevice()` function logic

## Testing Checklist
- [ ] Add L2 switch - should have 2 GigabitEthernet ports (Gi0/1, Gi0/2)
- [ ] Add L3 switch - should have 4 GigabitEthernet ports (Gi0/1, Gi0/2, Gi0/3, Gi0/4)
- [ ] Switch model should be correctly set (WS-C2960-24TT-L for L2, WS-C3560-24PS for L3)
- [ ] Port labels should be correct
- [ ] All ports should start with 'disconnected' status

## Technical Notes
- L3 switches typically have more GigabitEthernet ports for routing between VLANs
- The console port configuration remains the same
- FastEthernet port count is identical (24 ports)
- WLAN0 port is available on both types
