# Kurulum Talimatları - Network Simulator

## 🚀 Hızlı Başlangıç

### 1. Bağımlılıkları Yükle

```bash
npm install
```

veya

```bash
bun install
```

### 2. Geliştirme Sunucusunu Başlat

```bash
npm run dev
```

veya

```bash
bun run dev
```

Tarayıcıda açın: [http://localhost:3000](http://localhost:3000)

## 📋 Sistem Gereksinimleri

- **Node.js**: 18.0 veya üzeri
- **npm**: 9.0 veya üzeri (veya bun)
- **Tarayıcı**: Modern tarayıcı (Chrome, Firefox, Safari, Edge)

## 📦 Yüklü Paketler

### Core Dependencies
- **Next.js 16** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

### UI Components
- **shadcn/ui** - Component library
- **Radix UI** - Headless UI components
- **Lucide React** - Icons

### State Management
- **Zustand** - State management
- **React Context** - Global context

### Utilities
- **clsx** - Conditional classnames
- **class-variance-authority** - CSS class variants

## 🔧 Yapılandırma

### TypeScript
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Build
```bash
npm run build
```

## 🐛 Sorun Giderme

### PowerShell Execution Policy Hatası

Eğer şu hatayı alırsanız:
```
cannot be loaded because running scripts is disabled on this system
```

**Çözüm 1:** CMD kullanın
```cmd
npm install
```

**Çözüm 2:** PowerShell'de bypass yapın
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install
```

### Bağımlılık Hatası

Eğer modül bulunamadı hatası alırsanız:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Port 3000 Zaten Kullanılıyorsa

```bash
npm run dev -- -p 3001
```

## 📚 Proje Yapısı

```
src/
├── app/              # Next.js app directory
├── components/       # React components
│   └── network/      # Network simulator components
├── contexts/         # React contexts
├── hooks/            # Custom hooks
├── lib/              # Utility functions
│   └── network/      # Network logic
└── styles/           # Global styles

public/              # Static files
kiro/                # Project documentation
```

## 🎯 Özellikler

### Network Simulator
- ✅ Cihaz yönetimi (PC, Switch, Router)
- ✅ Bağlantı yönetimi
- ✅ VLAN konfigürasyonu
- ✅ IP routing
- ✅ Ping ve connectivity kontrol

### Not Sistemi
- ✅ Not ekleme/silme
- ✅ Not sürükleme ve yeniden boyutlandırma
- ✅ Not stil özelleştirmesi
- ✅ Undo/Redo desteği

### Gelişmiş Özellikler
- ✅ Zoom ve pan
- ✅ Multi-select
- ✅ Keyboard shortcuts
- ✅ Dark/Light mode
- ✅ Turkish/English support
- ✅ Offline storage

## 📖 Belgelendirme

Detaylı belgelendirme `kiro/` klasöründe bulunur:

- **POWER_TOGGLE_IMPLEMENTATION.md** - Bulk power control
- **PING_DIAGNOSTICS_IMPLEMENTATION.md** - Ping diagnostics
- **SUBNET_VALIDATION_IMPLEMENTATION.md** - Subnet validation
- **NOTE_SYSTEM_SUMMARY.md** - Note system features

## 🚀 Deployment

### Vercel'e Deploy

```bash
npm run build
vercel deploy
```

### Docker ile Deploy

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 📞 Destek

Sorunlar için `kiro/` klasöründeki belgelendirmeyi kontrol edin.

## 📝 Lisans

MIT License

## ✅ Kontrol Listesi

Kurulum sonrası kontrol edin:

- [ ] npm install başarılı
- [ ] npm run dev çalışıyor
- [ ] http://localhost:3000 açılıyor
- [ ] Network simulator yükleniyor
- [ ] Cihaz ekleyebiliyorsunuz
- [ ] Bağlantı oluşturabiliyorsunuz
- [ ] Ping atabiliyorsunuz
- [ ] Not ekleyebiliyorsunuz
