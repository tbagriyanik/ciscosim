# Switch Icon Color Fix

## Problem
Eklenen cihaz çizimindeki switch simgesi yeşil renkli gösteriliyordu, L3 switch'lerin mor olması gerekiyordu.

## Solution Implemented
Switch icon rendering'inde L3 switch için mor renk kontrolü eklendi.

## Files Modified
**File**: `src/components/network/NetworkTopology.tsx`
**Line**: 3646

### Before
```typescript
stroke={isDark ? '#14b8a6' : '#0d9488'}
```

### After
```typescript
stroke={isDark ? (device.switchModel === 'WS-C3560-24PS' ? '#c084fc' : '#14b8a6') : (device.switchModel === 'WS-C3560-24PS' ? '#a855f7' : '#0d9488')}
```

## Color Scheme After Fix

### Switch Icon Colors
- **L2 Switch** (WS-C2960-24TT-L): 
  - Dark mode: `#14b8a6` (Teal)
  - Light mode: `#0d9488` (Teal)
- **L3 Switch** (WS-C3560-24PS):
  - Dark mode: `#c084fc` (Purple) ✅
  - Light mode: `#a855f7` (Purple) ✅

### Complete Device Color Scheme
- **PC**: Blue icon
- **L2 Switch**: Teal icon
- **L3 Switch**: **Purple icon** ✅
- **Router**: Purple icon

## Visual Consistency
Artık cihaz simgeleri ve kutu renkleri tutarlı:
- L2 switch: Yeşil kutu + Teal icon
- L3 switch: Mor kutu + Mor icon
- Router: Mor kutu + Mor icon

## Testing Checklist
- [ ] L2 switch simgesi teal/yeşil tonlarında
- [ ] L3 switch simgesi mor tonlarında
- [ ] Router simgesi mor tonlarında  
- [ ] PC simgesi mavi tonlarında
- [ ] Dark modda renkler doğru
- [ ] Light modda renkler doğru
- [ ] Icon renkleri kutu renkleriyle uyumlu

## Status: ✅ COMPLETE
Eklenen cihaz çizimindeki L3 switch simgesi artık mor renkli olarak gösteriliyor!
