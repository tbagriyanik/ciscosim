# L3 Switch Icon Color Fix

## Problem
Topolojide L3 switch simgesi yeşil renkli gösteriliyordu, mor olması gerekiyordu.

## Solution Implemented
Device rendering logic'inde L3 switch renk kontrolü eklendi.

## Files Modified
**File**: `src/components/network/NetworkTopology.tsx`
**Line**: 5294

### Before
```typescript
const color = device.type === 'pc' ? '#3b82f6' : device.type === 'switch' ? '#22c55e' : '#a855f7';
```

### After
```typescript
const color = device.type === 'pc' ? '#3b82f6' : device.type === 'switch' ? (device.switchModel === 'WS-C3560-24PS' ? '#a855f7' : '#22c55e') : '#a855f7';
```

## Color Scheme After Fix

### Device Colors
- **PC**: `#3b82f6` (Blue)
- **L2 Switch** (WS-C2960-24TT-L): `#22c55e` (Green)
- **L3 Switch** (WS-C3560-24PS): `#a855f7` (Purple) ✅
- **Router**: `#a855f7` (Purple)

### Visual Distinction
Artık topolojide cihaz türlerini ve switch katmanlarını görsel olarak ayırt edebilirsiniz:
- Yeşil switch = L2 (basic switching)
- Mor switch = L3 (advanced routing capabilities)
- Mor router = L3 routing device

## Testing Checklist
- [ ] L2 switch simgesi yeşil renkli
- [ ] L3 switch simgesi mor renkli  
- [ ] Router simgesi mor renkli
- [ ] PC simgesi mavi renkli
- [ ] Renkler hem dark hem light modda doğru görünüyor
- [ ] Seçili cihazlarda renkler doğru kalıyor

## Technical Notes
Bu değişiklik sadece device rendering kısmını etkiler, diğer icon renkleri (iconColor, stroke renkleri) zaten doğru şekilde ayarlanmıştı.

## Status: ✅ COMPLETE
L3 switch simgesi artık topolojide mor renkli olarak gösteriliyor!
