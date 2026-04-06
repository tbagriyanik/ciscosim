# WiFi Sinyal Gücü ve Ping Gecikmeleri Implementasyonu

**Tarih**: 2026-04-05  
**Durum**: ✅ Tamamlandı  
**Versiyon**: 1.2.1

## Özet

WiFi bağlantılarında sinyal gücüne göre gerçekçi ping gecikmeleri ve görsel sinyal göstergeleri eklendi. Hem PC terminal (Windows ping) hem de CLI terminal desteklenmektedir.

## Özellikler

### 1. WiFi Sinyal Gücü Göstergesi

#### Terminal Başlığında Gösterge
- **Konum**: Terminal başlık çubuğunda (sağ üst köşe)
- **Görünüm**: WiFi simgesi + sinyal yüzdesi
- **Renk Kodlaması**:
  - 🟢 Yeşil: 100% (5 bar) - Mükemmel
  - 🟡 Sarı: 75% (4 bar) - İyi
  - 🟠 Turuncu: 50% (3 bar) - Orta
  - 🔴 Kırmızı: 25% (2 bar) - Zayıf
  - 🔴 Kırmızı: 1% (1 bar) - Çok Zayıf

#### PC Panel'de Gösterge
- **Konum**: PC tablet ekranında WiFi ayarları bölümü
- **Görünüm**: 5 çubuklu sinyal göstergesi
- **Dinamik Güncelleme**: Mesafeye göre otomatik hesaplama

### 2. WiFi Kontrol Paneli

#### Erişim
- **Komut**: `http <router-ip>` (örn: `http 192.168.1.1`)
- **Konum**: PC terminalinden HTTP komutu ile
- **Görünüm**: Modal pencere olarak açılır

#### Özellikler
- **SSID Yapılandırması**: Ağ adı belirleme
- **Güvenlik Ayarları**: Open, WPA, WPA2, WPA3 seçenekleri
- **Kanal Seçimi**: 2.4GHz veya 5GHz
- **Mod Değiştirme**: AP (Access Point) veya Client modu
- **Bağlı Cihazlar**: Gerçek zamanlı cihaz listesi
- **Tema Desteği**: Dark/Light mode uyumlu
- **Responsive Tasarım**: Tüm ekran boyutlarında çalışır

#### Kullanım Örneği
```bash
# PC terminalinden router'a erişim
C:\> http 192.168.1.1

# WiFi Kontrol Paneli açılır:
┌─────────────────────────────────────┐
│ Router1 - WiFi Configuration       │
├─────────────────────────────────────┤
│ SSID: MyNetwork                     │
│ Security: WPA2                      │
│ Password: ********                  │
│ Channel: 2.4GHz                     │
│ Mode: AP                            │
│                                     │
│ Connected Devices:                  │
│ • PC1 (192.168.1.100)              │
│ • PC2 (192.168.1.101)              │
│                                     │
│ [Save Configuration]                │
└─────────────────────────────────────┘
```

### 3. Sinyal Gücü Hesaplama

Sinyal gücü, PC ile Access Point (AP) arasındaki mesafeye göre hesaplanır:

```typescript
function getWirelessSignalStrength(device, devices, deviceStates): number {
  // PC ile AP arasındaki mesafe hesaplanır
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Mesafeye göre sinyal gücü:
  if (distance < 150) return 5;  // 100% - Mükemmel
  if (distance < 250) return 4;  // 75% - İyi
  if (distance < 350) return 3;  // 50% - Orta
  if (distance < 450) return 2;  // 25% - Zayıf
  if (distance < 550) return 1;  // 1% - Çok Zayıf
  return 0;                      // Sinyal yok
}
```

### 3. Ping Gecikmeleri

#### Gecikme Aralıkları

Her sinyal seviyesi için random gecikme aralıkları:

| Sinyal Gücü | Çubuk | Yüzde | Min (ms) | Avg (ms) | Max (ms) | Kalite |
|-------------|-------|-------|----------|----------|----------|--------|
| 5 | █████ | 100% | 1 | 2-4 | 6 | Mükemmel |
| 4 | ████░ | 75% | 5 | 7-15 | 24 | İyi |
| 3 | ███░░ | 50% | 15 | 20-40 | 55 | Orta |
| 2 | ██░░░ | 25% | 40 | 50-90 | 110 | Zayıf |
| 1 | █░░░░ | 1% | 100 | 120-180 | 220 | Çok Zayıf |
| 0 | ░░░░░ | 0% | - | - | - | Bağlantı Yok |

#### Kablolu Bağlantı
- WiFi kullanılmıyorsa: `<1ms` (sabit)
- Ethernet bağlantıları için ideal gecikme

### 4. Implementasyon Detayları

#### Dosya Değişiklikleri

**1. Terminal.tsx** (CLI Terminal)
```typescript
// WiFi sinyal gücü hesaplama
const wifiSignalStrength = useMemo(() => {
  if (!device || device.type !== 'pc') return null;
  const wifi = getDeviceWifiConfig(device, deviceStates);
  if (!wifi || !wifi.enabled || (wifi.mode !== 'client' && wifi.mode !== 'sta')) return null;
  return getWirelessSignalStrength(device, devices, deviceStates);
}, [device, devices, deviceStates]);

// Sinyal göstergesi render
const getSignalIcon = (strength: number) => {
  return (
    <div className="flex items-center gap-1">
      <Wifi className={cn(
        "w-4 h-4",
        strength >= 4 ? "text-emerald-500" :
        strength >= 3 ? "text-yellow-500" :
        strength >= 2 ? "text-orange-500" :
        "text-rose-500"
      )} />
      <span>{strength === 5 ? "100%" : ...}</span>
    </div>
  );
};
```

**2. privilegedCommands.ts** (CLI Ping)
```typescript
function generatePingLatencies(signalStrength: number) {
  const between = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  if (signalStrength >= 5) {
    const min = between(1, 3);
    const avg = between(min + 1, min + 3);
    const max = between(avg + 1, avg + 3);
    return { min, avg, max };
  }
  // ... diğer seviyeler
}

function cmdPing(state, input, ctx) {
  const signalStrength = getWirelessSignalStrength(sourceDevice, devices, deviceStates);
  const { min, avg, max } = generatePingLatencies(signalStrength);
  
  output += `Success rate is 100 percent (${count}/${count}), `;
  output += `round-trip min/avg/max = ${min}/${avg}/${max} ms\n`;
}
```

**3. PCPanel.tsx** (Windows Ping)
```typescript
// PC ping komutunda sinyal gücüne göre gecikme
const generatePingTime = () => {
  if (signalStrength >= 5) {
    return Math.floor(Math.random() * 6) + 1;  // 1-6ms
  } else if (signalStrength === 4) {
    return Math.floor(Math.random() * 20) + 5; // 5-24ms
  }
  // ... diğer seviyeler
};

const time1 = generatePingTime();
const time2 = generatePingTime();
const time3 = generatePingTime();
const time4 = generatePingTime();

const formatTime = (ms: number) => ms === 0 ? '<1ms' : `${ms}ms`;

output = `Reply from ${targetIp}: bytes=32 time=${formatTime(time1)} TTL=128\n`;
output += `Reply from ${targetIp}: bytes=32 time=${formatTime(time2)} TTL=128\n`;
// ...
```

**4. page.tsx** (Terminal Props)
```typescript
<Terminal
  deviceId={activeDeviceId}
  device={topologyDevices.find(d => d.id === activeDeviceId)}
  devices={topologyDevices}
  deviceStates={deviceStates}
  // ... diğer props
/>
```

## Kullanım Senaryoları

### Senaryo 1: Güçlü WiFi Sinyali
```
PC1 (WiFi Client) <--150px--> Router1 (AP)

Terminal'de:
┌─────────────────────────────┐
│ PC1 Terminal    [📶 100%]   │
└─────────────────────────────┘

Ping çıktısı:
Reply from 192.168.1.1: bytes=32 time=2ms TTL=128
Reply from 192.168.1.1: bytes=32 time=4ms TTL=128
Reply from 192.168.1.1: bytes=32 time=1ms TTL=128
Reply from 192.168.1.1: bytes=32 time=5ms TTL=128
```

### Senaryo 2: Zayıf WiFi Sinyali
```
PC1 (WiFi Client) <--400px--> Router1 (AP)

Terminal'de:
┌─────────────────────────────┐
│ PC1 Terminal    [📶 25%]    │
└─────────────────────────────┘

Ping çıktısı:
Reply from 192.168.1.1: bytes=32 time=67ms TTL=128
Reply from 192.168.1.1: bytes=32 time=93ms TTL=128
Reply from 192.168.1.1: bytes=32 time=45ms TTL=128
Reply from 192.168.1.1: bytes=32 time=108ms TTL=128
```

### Senaryo 3: WiFi Kontrol Paneli Kullanımı
```
1. Router'ı topolojiye ekle
2. Router'a IP ata (192.168.1.1)
3. PC'den HTTP komutu ile eriş:
   C:\> http 192.168.1.1

4. WiFi Kontrol Paneli açılır:
   - SSID: "MyNetwork" olarak ayarla
   - Security: WPA2 seç
   - Password: "mypassword123" gir
   - Mode: AP seç
   - Kaydet

5. PC'den WiFi'ye bağlan:
   - PC WiFi ayarlarını aç
   - SSID: "MyNetwork" seç
   - Password: "mypassword123" gir
   - Bağlan

6. Bağlantıyı test et:
   C:\> ping 192.168.1.1
   Reply from 192.168.1.1: bytes=32 time=3ms TTL=128
```

### Senaryo 4: Kablolu Bağlantı
```
PC1 (Ethernet) <--cable--> Switch1

Terminal'de:
┌─────────────────────────────┐
│ PC1 Terminal    [WiFi yok]  │
└─────────────────────────────┘

Ping çıktısı:
Reply from 192.168.1.1: bytes=32 time<1ms TTL=128
Reply from 192.168.1.1: bytes=32 time<1ms TTL=128
Reply from 192.168.1.1: bytes=32 time<1ms TTL=128
Reply from 192.168.1.1: bytes=32 time<1ms TTL=128
```

## Test Senaryoları

### Test 1: Sinyal Gücü Göstergesi
1. PC ekle ve WiFi'yi etkinleştir
2. Router ekle ve AP modunda WiFi yapılandır
3. PC'yi router'a yaklaştır → 100% sinyal görmeli
4. PC'yi router'dan uzaklaştır → Sinyal azalmalı

### Test 2: Ping Gecikmeleri
1. PC'den router'a ping at
2. Yakın mesafede: 1-6ms arası gecikmeler
3. Uzak mesafede: 100-220ms arası gecikmeler
4. Her ping paketi farklı gecikme göstermeli

### Test 3: WiFi Kontrol Paneli
1. Router'a HTTP ile eriş: `http 192.168.1.1`
2. WiFi ayarlarını değiştir (SSID, güvenlik, kanal)
3. Ayarları kaydet
4. PC'den yeni SSID'ye bağlan
5. Bağlantıyı test et (ping)
6. Kontrol panelinde bağlı cihazları gör

### Test 4: Kablolu vs Kablosuz
1. PC'yi ethernet ile bağla → <1ms
2. PC'yi WiFi'ye geçir → Mesafeye göre gecikme
3. WiFi'yi kapat → Sinyal göstergesi kaybolmalı

## Teknik Notlar

### Performans
- Sinyal gücü hesaplaması `useMemo` ile optimize edildi
- Her render'da yeniden hesaplama yapılmıyor
- Sadece device, devices veya deviceStates değiştiğinde güncelleniyor

### Gerçekçilik
- Gerçek WiFi ağlarındaki gecikme davranışını simüle eder
- Random değerler her ping için farklı, gerçekçi varyasyon sağlar
- Mesafe bazlı sinyal hesaplaması fiziksel gerçekliği yansıtır

### Uyumluluk
- Hem Windows ping (PC terminal) hem ping (CLI) desteklenir
- Tüm WiFi modları (AP, Client, STA) ile uyumlu
- Kablolu bağlantılarda otomatik olarak devre dışı kalır
- WiFi kontrol paneli tüm router ve switch cihazlarında çalışır
- HTTP komutu ile erişilebilir web arayüzü

## Gelecek İyileştirmeler

Potansiyel geliştirmeler (opsiyonel):
- [ ] Paket kaybı simülasyonu (zayıf sinyalde %10-20 loss)
- [ ] Jitter hesaplaması (gecikme varyasyonu)
- [ ] Sinyal gücü grafiği (zaman içinde değişim)
- [ ] Engel/duvar simülasyonu (sinyal zayıflatma)
- [ ] 2.4GHz vs 5GHz frekans farkı
- [ ] WiFi kontrol panelinde gelişmiş ayarlar (QoS, MAC filtering)
- [ ] Bağlı cihazlar için bandwidth kullanımı gösterimi

## Sonuç

WiFi sinyal gücü, ping gecikmeleri ve kontrol paneli implementasyonu başarıyla tamamlandı. Sistem gerçekçi ağ davranışını simüle ederek eğitim değerini artırıyor. Web tabanlı WiFi yönetim arayüzü ile kullanıcılar gerçek dünya senaryolarını deneyimleyebiliyor.

**Durum**: ✅ Production Ready  
**Test**: ✅ Başarılı  
**Build**: ✅ Hatasız
