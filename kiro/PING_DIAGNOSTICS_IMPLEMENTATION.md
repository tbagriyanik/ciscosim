# Ping Diagnostics - Detaylı Hata Nedeni Gösterimi

## Genel Bakış
Ping başarısızlığında detaylı hata nedenleri toast notification'ı ile gösterilir. Sistem aşağıdaki kontrolleri yapar:

## Kontrol Edilen Şartlar

### 1. Kaynak Cihaz Kontrolü
- ✅ Kaynak cihaz var mı?
- ✅ Kaynak cihaz açık mı (online)?
- ✅ Kaynak cihazın IP adresi var mı?

### 2. Hedef Cihaz Kontrolü
- ✅ Hedef IP adresi var mı?
- ✅ Hedef cihaz açık mı (online)?
- ✅ Hedef cihazın IP adresi var mı?

### 3. Subnet Uyumluluğu
- ✅ Kaynak ve hedef aynı subnet'te mi?
- ✅ Subnet mask'ı doğru mu?
- ✅ IP adresleri subnet'e uygun mu?

### 4. Gateway Konfigürasyonu
- ✅ Farklı subnet'te ise gateway tanımlanmış mı?
- ✅ Kaynak cihazın gateway'i var mı?
- ✅ Hedef cihazın gateway'i var mı?

### 5. Fiziksel Bağlantı
- ✅ Cihazlar arasında fiziksel bağlantı var mı?
- ✅ Kablo tipi uyumlu mu?
- ✅ Cihazlar powered on mu?

### 6. Interface Durumu
- ✅ Kaynak interface açık mı?
- ✅ Hedef interface açık mı?
- ✅ Interface shutdown değil mi?

### 7. VLAN Konfigürasyonu
- ✅ VLAN uyumluluğu var mı?
- ✅ Access port VLAN'ı doğru mu?
- ✅ Trunk port'lar doğru mu?

### 8. Routing Konfigürasyonu
- ✅ Farklı subnet'te ise routing etkin mi?
- ✅ Router'da route tanımlanmış mı?
- ✅ IP routing enabled mi?

## Hata Mesajları (Türkçe)

| Hata | Nedeni |
|------|--------|
| Kaynak cihaz bulunamadı | Kaynak cihaz ID'si geçersiz |
| Kaynak cihaz kapalı (offline) | Cihaz power OFF durumunda |
| Kaynak cihazın IP adresi yok | IP adresi tanımlanmamış |
| Hedef IP adresi bulunamadı | Hedef IP'ye sahip cihaz yok |
| Hedef cihaz kapalı (offline) | Hedef cihaz power OFF durumunda |
| Hedef cihazın IP adresi yok | Hedef cihazın IP'si tanımlanmamış |
| Subnet uyumsuzluğu | Kaynak ve hedef farklı subnet'te |
| Kaynak cihazın gateway'i yok | Farklı subnet'te ama gateway yok |
| Hedef cihazın gateway'i yok | Farklı subnet'te ama gateway yok |
| Fiziksel bağlantı yok | Cihazlar arasında bağlantı yok |
| Kaynak interface kapalı | Interface shutdown durumunda |
| Hedef interface kapalı | Interface shutdown durumunda |
| VLAN uyumsuzluğu | Kaynak ve hedef farklı VLAN'da |
| Kaynak cihazda IP routing etkin değil | Routing disabled |

## Toast Notification Özellikleri

### Başarılı Ping
- **Renk**: Yeşil (Emerald)
- **Mesaj**: "Ping başarılı"
- **Süre**: 3 saniye

### Başarısız Ping
- **Renk**: Kırmızı (Red)
- **Mesaj**: Hata nedeni (ilk reason)
- **Süre**: 3 saniye

### Konum
- **Pozisyon**: Sol alt köşe (bottom-left)
- **Z-index**: 40 (Context menu'den düşük)

## Teknik Detaylar

### getPingDiagnostics Fonksiyonu
```typescript
export function getPingDiagnostics(
  sourceId: string,
  targetIp: string,
  devices: CanvasDevice[],
  connections: CanvasConnection[],
  deviceStates?: Map<string, SwitchState>
): { success: boolean; reasons: string[] }
```

### Dönen Değer
- `success`: Boolean - Ping başarılı mı?
- `reasons`: String[] - Hata nedenleri (başarısız ise)

### startPingAnimation Güncellemesi
- getPingDiagnostics çağrılır
- Hata varsa ilk reason toast'a gösterilir
- Başarılı ise "Ping başarılı" mesajı gösterilir

## Dosyalar

- `src/lib/network/connectivity.ts`
  - getPingDiagnostics fonksiyonu
  - isIpInSubnet helper fonksiyonu
  - Detaylı kontrol logikleri

- `src/components/network/NetworkTopology.tsx`
  - startPingAnimation güncellemesi
  - Toast notification render'ı
  - showToast callback'i

## Örnek Senaryolar

### Senaryo 1: Aynı Subnet'te Ping
```
PC-1 (192.168.1.10/24) → PC-2 (192.168.1.20/24)
✅ Aynı subnet
✅ Fiziksel bağlantı var
✅ Interface'ler açık
✅ VLAN uyumlu
→ Ping başarılı
```

### Senaryo 2: Farklı Subnet'te Gateway Yok
```
PC-1 (192.168.1.10/24, gateway: yok) → PC-2 (192.168.2.20/24)
❌ Farklı subnet
❌ Gateway tanımlanmamış
→ "Kaynak cihazın gateway'i yok (farklı subnet)"
```

### Senaryo 3: Interface Kapalı
```
PC-1 → Switch (interface shutdown) → PC-2
❌ Switch interface kapalı
→ "Hedef interface kapalı: fa0/1"
```

### Senaryo 4: VLAN Uyumsuzluğu
```
PC-1 (VLAN 10) → Switch (VLAN 20) → PC-2
❌ VLAN uyumsuzluğu
→ "VLAN uyumsuzluğu: Kaynak VLAN 10, Hedef VLAN 20"
```

## Kontrol Listesi

- [x] IP adresi kontrolü
- [x] Subnet uyumluluğu kontrolü
- [x] Gateway konfigürasyonu kontrolü
- [x] Interface durumu kontrolü
- [x] Fiziksel bağlantı kontrolü
- [x] VLAN konfigürasyonu kontrolü
- [x] Routing konfigürasyonu kontrolü
- [x] Toast notification gösterimi
- [x] Türkçe/İngilizce mesajlar
- [x] Hata nedeni detaylı gösterimi
- [x] TypeScript hata yok
- [x] Compilation warning yok
