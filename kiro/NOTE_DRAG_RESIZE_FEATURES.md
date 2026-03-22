# Not Nesneleri - Drag ve Resize Özellikleri

## Genel Bakış
Not nesneleri tam drag (sürükleme) ve resize (yeniden boyutlandırma) desteğine sahiptir. Kullanıcılar notları kanvas üzerinde taşıyabilir ve boyutlarını değiştirebilir.

## Uygulanan Özellikler

### 1. Drag (Sürükleme) Desteği
- **Başlık Alanından Sürükleme**: Not başlığından tıklayıp sürükleyerek not taşınabilir
- **Zoom Farkında**: Sürükleme işlemi zoom seviyesine göre hesaplanır
- **Pan Desteği**: Kanvas pan'ı sürükleme sırasında dikkate alınır
- **Smooth Movement**: Gerçek zamanlı, akıcı hareket
- **History Integration**: Her sürükleme işlemi history'ye kaydedilir

### 2. Resize (Yeniden Boyutlandırma) Desteği
- **Sağ Alt Köşe Handle**: Sağ alt köşedeki handle'dan sürükleyerek resize yapılır
- **Minimum Boyutlar**: 
  - Minimum genişlik: 150px
  - Minimum yükseklik: 100px
- **Zoom Farkında**: Resize işlemi zoom seviyesine göre hesaplanır
- **Visual Handle**: Resize handle'ı hover sırasında görünürlüğü artar
- **History Integration**: Her resize işlemi history'ye kaydedilir

### 3. Seçim ve Etkileşim
- **Tıklama Seçimi**: Nota tıklanarak seçilir (yeşil ring gösterilir)
- **Shift+Tıklama**: Shift tuşu ile birden fazla not seçilebilir
- **Seçim Göstergesi**: Seçili notlar yeşil ring ile gösterilir
- **Otomatik Seçim**: Drag/Resize başladığında not otomatik seçilir

### 4. Scroll Desteği
- **Not İçinde Scroll**: Nota tıklanıp scroll yapılabilir
- **Canvas Zoom Etkilenmez**: Not içinde scroll yapılırken canvas zoom'u etkilenmez
- **Smooth Scroll**: Scroll davranışı smooth olarak ayarlanmıştır

## Teknik Detaylar

### State Management
```typescript
// Drag state
const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
const [noteDragStart, setNoteDragStart] = useState<{ x: number; y: number } | null>(null);

// Resize state
const [resizingNoteId, setResizingNoteId] = useState<string | null>(null);
const [noteResizeStart, setNoteResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
```

### Refs (Stale Closure Önleme)
```typescript
const draggedNoteIdRef = useRef<string | null>(null);
const noteDragStartRef = useRef<{ x: number; y: number } | null>(null);
const resizingNoteIdRef = useRef<string | null>(null);
const noteResizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
```

### Event Handlers

#### handleNoteHeaderMouseDown
- Not başlığında mouse down olayını yakalar
- History'ye snapshot kaydeder
- Drag state'ini başlatır
- Notu seçili yapar

#### handleNoteResizeStart
- Resize handle'ında mouse down olayını yakalar
- History'ye snapshot kaydeder
- Resize state'ini başlatır
- Notu seçili yapar

#### handleMouseMove (Global)
- Drag sırasında: Not pozisyonunu günceller
- Resize sırasında: Not boyutlarını günceller
- Zoom seviyesine göre delta hesaplar

#### handleMouseUp (Global)
- Drag/Resize işlemini sonlandırır
- State'i temizler

## Kullanım

### Not Sürükleme
1. Not başlığına tıklayın
2. Fare tuşunu basılı tutarak sürükleyin
3. Notu istediğiniz konuma taşıyın
4. Fare tuşunu bırakın

### Not Yeniden Boyutlandırma
1. Not sağ alt köşesindeki handle'a tıklayın
2. Fare tuşunu basılı tutarak sürükleyin
3. Notu istediğiniz boyuta getirin
4. Fare tuşunu bırakın

### Undo/Redo
- Ctrl+Z: Son işlemi geri al
- Ctrl+Y: Son işlemi yinele

## Dosyalar

- `src/components/network/NetworkTopology.tsx`
  - handleNoteHeaderMouseDown
  - handleNoteResizeStart
  - Mouse move/up event listeners
  - Note rendering with drag/resize handles

## Özellik Kontrol Listesi

- [x] Not sürükleme çalışıyor
- [x] Not yeniden boyutlandırma çalışıyor
- [x] Zoom farkında hesaplamalar
- [x] Pan desteği
- [x] Minimum boyut kısıtlaması
- [x] History entegrasyonu
- [x] Seçim göstergesi
- [x] Scroll desteği (canvas zoom etkilenmez)
- [x] Smooth hareket
- [x] Visual feedback (handle hover)
- [x] TypeScript hata yok
- [x] Compilation warning yok
