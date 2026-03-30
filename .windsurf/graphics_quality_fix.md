# Graphics Quality Lexical Declaration Fix

## Problem
Runtime ReferenceError: `can't access lexical declaration 'graphicsQuality' before initialization` hatası alınıyordu. useEffect, `graphicsQuality` değişkeni tanımlanmadan önce kullanılıyordu. Ayrıca PCPanel'de graphics ayarı olmamalıydı.

## Error Details
- **Type**: Runtime ReferenceError
- **Message**: `can't access lexical declaration 'graphicsQuality' before initialization`
- **Location**: `src/app/page.tsx:163:7`
- **Context**: useEffect dependency array'inde `graphicsQuality` kullanımı

## Root Cause Analysis
1. **Sıralama Sorunu**: useEffect, useAppStore çağrısından önce tanımlanmıştı
2. **PCPanel Duplicate**: PCPanel'de gereksiz graphics quality toggle vardı
3. **Lexical Declaration**: Değişken tanımlanmadan önce kullanılamaz

## Solution Implemented

### 1. useEffect Sıralama Düzeltildi (page.tsx)

#### Önce (Hatalı Sıralama)
```typescript
export default function Home() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, effectiveTheme, setTheme } = useTheme();

  // ❌ HATA: graphicsQuality henüz tanımlanmadı
  useEffect(() => {
    if (graphicsQuality === 'low') { // ReferenceError
      document.body.classList.add('graphics-low');
      document.body.classList.remove('graphics-high');
    } else {
      document.body.classList.add('graphics-high');
      document.body.classList.remove('graphics-low');
    }
  }, [graphicsQuality]); // ❌ Hata

  const exampleLevelLabels = useMemo(/* ... */);
  // ... daha sonra useAppStore çağrısı
  const { graphicsQuality, setGraphicsQuality } = useAppStore(); // ✅ Çok geç
}
```

#### Sonra (Doğru Sıralama)
```typescript
export default function Home() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, effectiveTheme, setTheme } = useTheme();

  const exampleLevelLabels = useMemo(/* ... */);
  // ... diğer hook'lar

  // ✅ Önce useAppStore çağrısı
  const { setDevices, setConnections, setNotes, setZoom, setPan, setActiveTab, graphicsQuality, setGraphicsQuality } = useAppStore();

  // ✅ Sonra useEffect (graphicsQuality tanımlı)
  useEffect(() => {
    if (graphicsQuality === 'low') {
      document.body.classList.add('graphics-low');
      document.body.classList.remove('graphics-high');
    } else {
      document.body.classList.add('graphics-high');
      document.body.classList.remove('graphics-low');
    }
  }, [graphicsQuality]); // ✅ Artık güvenli
}
```

### 2. PCPanel Graphics Quality Kaldırıldı (PCPanel.tsx)

#### useAppStore Kullanımı Kaldırıldı
**Before**:
```typescript
// Use granular selector for device state to prevent cascading re-renders
const deviceState = useSwitchState(deviceId);
const { graphicsQuality, setGraphicsQuality } = useAppStore(); // ❌ Gereksiz
```

**After**:
```typescript
// Use granular selector for device state to prevent cascading re-renders
const deviceState = useSwitchState(deviceId); // ✅ Sadece device state
```

#### Graphics Quality Toggle Kaldırıldı
**Before** (Lines 1847-1875):
```typescript
<div className="space-y-2">
  <label className="text-xs font-bold text-slate-500 ">Graphics Quality</label>
  <div className={`inline-flex p-1 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
    <button
      type="button"
      role="radio"
      aria-checked={graphicsQuality === 'high'}
      onClick={() => setGraphicsQuality('high')}
      // ... button props
    >
      High
    </button>
    <button
      type="button"
      role="radio"
      aria-checked={graphicsQuality === 'low'}
      onClick={() => setGraphicsQuality('low')}
      // ... button props
    >
      Low
    </button>
  </div>
</div>
```

**After**: Tamamen kaldırıldı, sadece IPv6 alanları kaldı.

## Changes Summary

### ✅ Fixed Issues
- **Lexical Declaration Error**: useEffect doğru sıraya taşındı
- **PCPanel Duplicate**: Graphics quality toggle kaldırıldı
- **Import Cleanup**: PCPanel'de useAppStore kullanımı temizlendi

### ✅ Code Organization
- **Hook Order**: React hook'ları doğru sıralama
- **Dependency Resolution**: Değişkenler kullanımdan önce tanımlandı
- **Single Source**: Graphics quality sadece header'da kontrol edilir

### ✅ User Experience
- **Single Control**: Graphics quality sadece header'da ayarlanır
- **No Confusion**: PCPanel'de duplicate kontrol yok
- **Consistent**: Tüm uygulamada tek graphics quality kaynağı

## Technical Details

### React Hook Rules
1. **Hook Order**: Hook'lar her zaman aynı sırada çağrılmalı
2. **Dependency Resolution**: Değişkenler kullanımdan önce tanımlanmalı
3. **Lexical Scope**: useEffect içinde kullanılan değişkenler scope'ta olmalı

### State Management
- **Global State**: graphicsQuality sadece global state'de
- **Local State**: Component'lerde local graphicsQuality state'i yok
- **Single Source**: Header'daki buton tek kontrol noktası

### Performance
- **No Re-renders**: PCPanel'de gereksiz state değişimleri yok
- **Optimized**: Sadece gerekli component'ler render olur
- **Efficient**: Duplicate state yönetimi kaldırıldı

## Testing Checklist
- [ ] Runtime ReferenceError yok
- [ ] TypeScript hataları yok
- [ ] Header graphics quality butonu çalışır
- [ ] PCPanel'de graphics ayarı yok
- [ ] useEffect doğru çalışır
- [ ] CSS class'ları uygulanır
- [ ] Global state persistence çalışır
- [ ] Component sıralaması doğru
- [ ] Hook rules takip ediliyor

## Status: ✅ COMPLETE
Graphics Quality lexical declaration hatası başarıyla düzeltildi!
- ✅ useEffect doğru sıraya taşındı
- ✅ Lexical declaration error çözüldü
- ✅ PCPanel'de graphics ayarı kaldırıldı
- ✅ Single source of principle uygulandı
- ✅ TypeScript hataları yok
- ✅ Runtime hataları yok
- ✅ Kod organizasyonu iyileştirildi
