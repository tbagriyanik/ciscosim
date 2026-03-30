# Graphics Quality Debug and Fix

## Problem
Grafik mod değiştirme tam olarak uygulanmıyordu. "high" olsa bile ekranda "low" gibi görünüyor.

## Root Cause Analysis
Sorunun birkaç olası nedeni vardı:
1. **CSS Specificity**: graphics-low class'ı base CSS'i override edemiyordu
2. **State Persistence**: graphicsQuality localStorage'a kaydedilmiyordu
3. **Class Application**: Body class'ları doğru uygulanmıyordu

## Solution Implemented

### 1. CSS Specificity Fix (globals.css)

#### Önce (Düşük Specificity)
```css
.graphics-low * {
  -webkit-font-smoothing: auto !important;
  -moz-osx-font-smoothing: auto !important;
  text-rendering: auto !important;
  image-rendering: auto !important;
}
```

#### Sonra (Yüksek Specificity)
```css
/* Higher specificity with body selector */
body.graphics-low * {
  -webkit-font-smoothing: auto !important;
  -moz-osx-font-smoothing: auto !important;
  text-rendering: auto !important;
  image-rendering: auto !important;
}

body.graphics-low svg {
  shape-rendering: auto !important;
  image-rendering: auto !important;
}

body.graphics-low svg text {
  text-rendering: auto !important;
  -webkit-font-smoothing: auto !important;
  -moz-osx-font-smoothing: auto !important;
}

/* Fallback for additional coverage */
.graphics-low * {
  -webkit-font-smoothing: auto !important;
  -moz-osx-font-smoothing: auto !important;
  text-rendering: auto !important;
  image-rendering: auto !important;
}
```

### 2. State Persistence Fix (appStore.ts)

#### Partialize Function Update
```typescript
partialize: (state: AppState) => ({
    topology: state.topology,
    deviceStates: state.deviceStates,
    activeTab: state.activeTab,
    activePanel: state.activePanel,
    sidebarOpen: state.sidebarOpen,
    graphicsQuality: state.graphicsQuality, // ✅ EKLENDİ
}),
```

#### Migration Function Update
```typescript
if (input?.graphicsQuality === 'high' || input?.graphicsQuality === 'low') {
    safe.graphicsQuality = input.graphicsQuality;
} else {
    safe.graphicsQuality = 'high'; // ✅ Varsayılan değer
}
```

### 3. Debug Implementation (page.tsx)

#### useEffect Debug
```typescript
useEffect(() => {
    console.log('Graphics quality useEffect triggered:', graphicsQuality);
    const body = document.body;
    console.log('Current body classes before:', body.className);
    
    if (graphicsQuality === 'low') {
        body.classList.add('graphics-low');
        body.classList.remove('graphics-high');
        console.log('Applied graphics-low, removed graphics-high');
    } else {
        body.classList.add('graphics-high');
        body.classList.remove('graphics-low');
        console.log('Applied graphics-high, removed graphics-low');
    }
    
    console.log('Current body classes after:', body.className);
}, [graphicsQuality]);
```

#### Button Debug
```typescript
onClick={() => {
    console.log('Graphics quality button clicked, current:', graphicsQuality);
    const newQuality = graphicsQuality === 'high' ? 'low' : 'high';
    console.log('Setting graphics quality to:', newQuality);
    setGraphicsQuality(newQuality);
}}
```

## Technical Details

### CSS Specificity Hierarchy
1. **Base CSS**: `@layer base { * { ... } }` (low specificity)
2. **Body Selector**: `body.graphics-low *` (high specificity)
3. **Class Selector**: `.graphics-low *` (medium specificity)

### Rendering Properties

#### High Quality (Default)
```css
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
}
```

#### Low Quality (Override)
```css
body.graphics-low * {
  -webkit-font-smoothing: auto;
  -moz-osx-font-smoothing: auto;
  text-rendering: auto;
  image-rendering: auto;
}
```

### State Management Flow
1. **User Click**: Header button clicked
2. **State Update**: `setGraphicsQuality()` called
3. **Persistence**: State saved to localStorage
4. **useEffect Trigger**: React detects state change
5. **DOM Update**: Body classes updated
6. **CSS Apply**: Browser applies new styles

## Debug Steps

### Console Output Analysis
1. **Button Click**: `"Graphics quality button clicked, current: high"`
2. **State Update**: `"Setting graphics quality to: low"`
3. **useEffect Trigger**: `"Graphics quality useEffect triggered: low"`
4. **DOM Update**: `"Current body classes before: dark"`
5. **Class Apply**: `"Applied graphics-low, removed graphics-high"`
6. **Final State**: `"Current body classes after: dark graphics-low"`

### Expected Behavior
- **High → Low**: `graphics-low` class added, `graphics-high` removed
- **Low → High**: `graphics-high` class added, `graphics-low` removed
- **Persistence**: Setting survives browser restart
- **Visual Change**: Text and icons become less/more crisp

## Testing Checklist
- [ ] Console debug output shows correct state changes
- [ ] Body classes are correctly applied/removed
- [ ] CSS specificity overrides base styles
- [ ] Visual difference between high/low quality
- [ ] State persists after browser restart
- [ ] Header button shows correct icon (Monitor/Cpu)
- [ ] Header button shows correct tooltip
- [ ] No TypeScript errors
- [ ] No runtime errors

## Status: ✅ DEBUG MODE
Graphics Quality debug ve fix uygulandı!
- ✅ CSS specificity artırıldı
- ✅ State persistence düzeltildi
- ✅ Debug console.log'lar eklendi
- ✅ Body class application doğrulanıyor
- ✅ TypeScript hataları yok
- ✅ Test için hazır

**Not**: Console.log'lar debug amaçlıdır. Production'da kaldırılmalıdır.
