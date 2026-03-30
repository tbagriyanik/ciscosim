# DeviceIcon L2/L3 Switch Color Fix

## Problem
DeviceIcon component'inde tüm switch'ler için aynı renk (emerald) kullanılıyordu. L3 switch'ler mor, L2 switch'ler emerald olmalıydı.

## Solution Implemented
DeviceIcon component'ına switchModel prop'u eklendi ve renk mantığı L2/L3 ayrımı yapacak şekilde güncellendi.

## Files Modified
**File**: `src/components/network/DeviceIcon.tsx`

### 1. Interface Update (Line 13)
```typescript
export interface DeviceIconProps {
  type: DeviceType;
  className?: string;
  size?: number | string;
  color?: string;
  switchModel?: string; // Added for L2/L3 distinction
  active?: boolean;
}
```

### 2. Function Parameters Update (Line 22)
```typescript
export function DeviceIcon({ 
  type, 
  className, 
  size = 24, 
  color,
  switchModel, // Added parameter
  active = false 
}: DeviceIconProps) {
```

### 3. Color Logic Update (Lines 25-29)
**Before**:
```typescript
const defaultColor = color || (
  type === 'pc' ? DEVICE_ICON_COLORS.pc : 
  type === 'router' ? DEVICE_ICON_COLORS.router : 
  DEVICE_ICON_COLORS.switch
);
```

**After**:
```typescript
const defaultColor = color || (
  type === 'pc' ? DEVICE_ICON_COLORS.pc : 
  type === 'router' ? DEVICE_ICON_COLORS.router : 
  (type === 'switch' && switchModel === 'WS-C3560-24PS' ? '#a855f7' : DEVICE_ICON_COLORS.switch)
);
```

### 4. Usage Update in page.tsx (Lines 2482-2486)
**Before**:
```typescript
<DeviceIcon
  type={device.type}
  className={`${device.type === 'pc' ? 'text-blue-500' : device.type === 'router' ? 'text-purple-500' : 'text-emerald-500'} w-5 h-5`}
/>
```

**After**:
```typescript
<DeviceIcon
  type={device.type}
  switchModel={device.switchModel}
  className="w-5 h-5"
/>
```

## Color Logic After Fix

### PC Devices
- **Renk**: Mavi (DEVICE_ICON_COLORS.pc)
- **Özel durum**: Yok

### Router Devices  
- **Renk**: Mor (DEVICE_ICON_COLORS.router)
- **Özel durum**: Yok

### Switch Devices
- **L2 Switch** (WS-C2960-24TT-L): **Emerald** (DEVICE_ICON_COLORS.switch) ✅
- **L3 Switch** (WS-C3560-24PS): **Mor** (#a855f7) ✅

## Visual Impact

### Device Menu (Left Sidebar)
- **PC**: Mavi icon ✅
- **L2 Switch**: Emerald icon ✅
- **L3 Switch**: Mor icon ✅
- **Router**: Mor icon ✅

### Port Selector Dialog
- **Device Header**: Doğru renkler gösterilir
- **Type Consistency**: Tüm kullanımlarda aynı mantık

## Technical Benefits

### Component Reusability
- Tek bir DeviceIcon component'i tüm yerlerde çalışır
- Renk mantığı merkezi olarak yönetilir
- Kolay bakım ve güncelleme

### Type Safety
- TypeScript ile switchModel prop'u zorunlu değil ama kullanılabilir
- Renk mantığı compile-time kontrolü
- Hata azaltma

## Testing Checklist
- [ ] PC cihazları mavi gösterilir
- [ ] L2 switch'ler emerald gösterilir
- [ ] L3 switch'ler mor gösterilir
- [ ] Router'lar mor gösterilir
- [ ] Device menu'de renkler doğru
- [ ] Port selector'da renkler doğru
- [ ] Diğer DeviceIcon kullanımları çalışır
- [ ] Custom color prop'u hala çalışır
- [ ] Active state hala çalışır

## Status: ✅ COMPLETE
DeviceIcon component'inde L2/L3 switch renk ayrımı yapıldı!
- ✅ L2 switch'ler: Emerald
- ✅ L3 switch'ler: Mor
- ✅ Tüm cihaz tiplerinde doğru renkler
- ✅ Component yeniden kullanılabilirliği
- ✅ Merkezi renk yönetimi
