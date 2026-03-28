# 🚀 Network Simulator 2026

Öğrenciler ve ağ meraklıları için tasarlanmış, modern ve etkileşimli bir web tabanlı Network simülatörü.

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Tech Stack](https://img.shields.io/badge/stack-Next.js%2016%20|%20React%2019%20|%20TypeScript%20|%20Tailwind%204-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Commits](https://img.shields.io/badge/commits-350-orange)
![Lines of Code](https://img.shields.io/badge/lines--of--code-44.6k-blueviolet)

## ✨ Temel Özellikler

### 🌐 İnteraktif Network Topolojisi
- **Cihaz Yönetimi**: PC, Switch ve Router cihazlarını kanvasa sürükle-bırak
- **Zoom & Pan**: Smooth zoom ve pan işlemleri
- **Kablo Sistemi**: Straight-through, Crossover ve Console kablolar
- **Bağlantı Yönetimi**: Cihazlar arasında bağlantı oluştur ve yönet
- **Görsel Geri Bildirim**: Cihaz durumu göstergeleri ve port etiketleri
- **Kablosuz (WiFi) Simülasyonu**: SSID, WPA2 güvenlik ve AP/Client modları ile kablosuz ağ simülasyonu

### 💻 Network CLI Simülasyonu
- **Komut Desteği**: enable, configure, interface, show komutları
- **Mod Sistemi**: User, Privileged, Config, Interface modları
- **Komut Geçmişi**: Her cihaz için bağımsız komut geçmişi
- **Hata Kontrolü**: Geçersiz komutlar için hata mesajları

### 🔌 Fiziksel Cihaz Görselleştirmesi
- **Port Paneli**: Gerçekçi port gösterimi
- **LED Göstergeleri**: Bağlantı durumunu gösteren renkli LED'ler
- **Port Durumu**: Connected, Disconnected, Shutdown durumları

### 🛠️ Konfigürasyon Özellikleri
- **VLAN Yönetimi**: VLAN oluştur ve portları ata
- **IP Konfigürasyonu**: IP adresi, subnet ve gateway ayarları
- **Interface Yönetimi**: Port hızı, duplex ve shutdown ayarları
- **Routing**: IP routing ve statik route yönetimi

### 📝 Not Sistemi
- **Not Ekleme**: Kanvasa not ekle
- **Not Sürükleme**: Notları kanvas üzerinde sürükle
- **Not Yeniden Boyutlandırma**: Notları yeniden boyutlandır
- **Not Stil Özelleştirmesi**: Renk, yazı tipi, boyut ve opaklık ayarları
- **Undo/Redo**: Tüm işlemler için geri al/yinele desteği

### 🔍 Ping ve Bağlantı Kontrolü
- **Ping Atma**: Cihazlar arasında ping at
- **Detaylı Diagnostics**: Ping başarısızlığında hata nedeni göster
- **Subnet Doğrulama**: Farklı subnet'te ping kontrolü
- **Routing Kontrolü**: Router routing kontrolü
- **Görsel Ping Animasyonu**: Mail ikonu ile cihazlar arası (kablolu/kablosuz) arched ping yolu gösterimi
- **Global Animasyon Tetikleyici**: Terminal veya CLI üzerinden ping atıldığında otomatik animasyon

### ⚡ Gelişmiş Özellikler
- **Bulk Power Control**: Seçili cihazların gücünü toplu aç/kapat
- **Multi-Select**: Birden fazla cihaz seç
- **Keyboard Shortcuts**: Ctrl+Z (Undo), Ctrl+Y (Redo), vb.
- **Dark/Light Mode**: Koyu ve açık tema desteği
- **Turkish/English**: Türkçe ve İngilizce dil desteği
- **Offline Storage**: Çevrimdışı veri saklama
- **Görev Sistemi (Tasks)**: WLAN bağlantısı, güvenlik ve port yapılandırma görevlerini takip etme

## 🛠️ Teknoloji Stack

- **Framework**: [Next.js 16](https://nextjs.org/) + [React 19](https://react.dev/)
- **Dil**: [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) + [Lucide React](https://lucide.dev/)
- **State Management**: [Zustand](https://docs.pmnd.rs/zustand) + Context API
- **Storage**: localStorage + Custom offline storage

## 📁 Proje Yapısı

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main page
├── components/
│   ├── network/              # Network simulator components
│   │   ├── NetworkTopology.tsx       # Main canvas
│   │   ├── Terminal.tsx              # CLI interface
│   │   ├── DeviceNode.tsx            # Device visualization
│   │   ├── PortPanel.tsx             # Port management
│   │   └── ...
│   └── ui/                   # shadcn/ui components
├── lib/
│   └── network/              # Network logic
│       ├── parser.ts         # Command parser
│       ├── executor.ts       # Command executor
│       ├── connectivity.ts   # Connectivity checker
│       ├── routing.ts        # Routing logic
│       └── types.ts          # Type definitions
├── contexts/                 # React contexts
│   ├── ThemeContext.tsx      # Dark/Light mode
│   └── LanguageContext.tsx   # TR/EN language
└── hooks/                    # Custom hooks

kiro/                         # Project documentation
├── POWER_TOGGLE_IMPLEMENTATION.md
├── PING_DIAGNOSTICS_IMPLEMENTATION.md
├── SUBNET_VALIDATION_IMPLEMENTATION.md
├── NOTE_SYSTEM_SUMMARY.md
└── ...
```

## 🚀 Hızlı Başlangıç

### Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Production build
npm run build

# Production sunucusunu başlat
npm start
```

Tarayıcıda açın: [http://localhost:3000](http://localhost:3000)

Detaylı kurulum talimatları için [INSTALL.md](INSTALL.md) dosyasını okuyun.

## 📚 Belgelendirme

Detaylı belgelendirme `kiro/` klasöründe bulunur:

### Sistem Özellikleri
- **POWER_TOGGLE_IMPLEMENTATION.md** - Bulk power ON/OFF toggle
- **PING_DIAGNOSTICS_IMPLEMENTATION.md** - Detaylı ping hata nedenleri
- **PING_ERROR_DISPLAY_IMPLEMENTATION.md** - Canvas üzerinde hata gösterimi
- **SUBNET_VALIDATION_IMPLEMENTATION.md** - Subnet doğrulama ve routing
- **NOTE_SYSTEM_SUMMARY.md** - Not sistemi özeti
- **NOTE_DRAG_RESIZE_FEATURES.md** - Not drag ve resize özellikleri

### Proje Belgeleri
- **AI_RULES.md** - AI kuralları
- **IMPLEMENTATION_CHECKLIST.md** - Uygulama kontrol listesi
- **CLEANUP_RECOMMENDATIONS.md** - Temizlik önerileri

## 🎯 Kullanım Örnekleri

### Cihaz Ekleme
1. Sol panelden PC, Switch veya Router seç
2. Kanvasa sürükle
3. Cihaz otomatik eklenir

### Bağlantı Oluşturma
1. Cihazın portuna tıkla
2. Başka bir cihazın portuna tıkla
3. Bağlantı otomatik oluşturulur

### Ping Atma
1. Cihaza sağ tıkla
2. "Ping At" seç
3. Hedef cihaza tıkla
4. Ping animasyonu başlar

### Not Ekleme
1. "Not Ekle" butonuna tıkla
2. Not kanvasa eklenir
3. Notu sürükle, yeniden boyutlandır, stil özelleştir

## 🌍 Dil Desteği

- ✅ **Türkçe** - Tam destek
- ✅ **English** - Full support

Dil seçimi sağ üst köşedeki dil seçicisinden yapılır.

## 🎨 Tema Desteği

- ✅ **Dark Mode** - Koyu tema
- ✅ **Light Mode** - Açık tema

Tema seçimi sağ üst köşedeki tema seçicisinden yapılır.

## 📊 Sistem Gereksinimleri

- **Node.js**: 18.0 veya üzeri
- **npm**: 9.0 veya üzeri (veya bun)
- **Tarayıcı**: Modern tarayıcı (Chrome, Firefox, Safari, Edge)

## 🐛 Sorun Giderme

Sorunlar için [INSTALL.md](INSTALL.md) dosyasındaki "Sorun Giderme" bölümünü kontrol edin.

## 📝 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasını kontrol edin.

## 🤝 Katkıda Bulunma

Katkılar memnuniyetle karşılanır. Lütfen:

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit yapın (`git commit -m 'Add some AmazingFeature'`)
4. Push yapın (`git push origin feature/AmazingFeature`)
5. Pull Request açın

## 📞 İletişim

Sorular veya öneriler için lütfen issue açın.

---

**Bu proje açık kaynaklıdır.** 🚀  
GitHub üzerinden katkıda bulunabilirsiniz: [github.com/tbagriyanik/ciscosim](https://github.com/tbagriyanik/ciscosim)

**Sürüm**: 1.1.0  
**Son Güncelleme**: 2026-03-28  
**Durum**: Production Ready ✅
