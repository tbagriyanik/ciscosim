# Proje Temizleme Önerileri - Gereksiz Dosyalar

## 🗑️ Silinebilir Dosyalar

### 1. **image1_analysis.json** ve **image2_analysis.json**
- **Durum**: Gereksiz
- **Açıklama**: AI analiz çıktıları, proje için gerekli değil
- **Boyut**: ~50KB
- **Tavsiye**: SİL

### 2. **ts_errors.log**
- **Durum**: Gereksiz
- **Açıklama**: Eski TypeScript hata logu, güncel değil
- **Boyut**: ~5KB
- **Tavsiye**: SİL

### 3. **worklog.md**
- **Durum**: Gereksiz
- **Açıklama**: Eski çalışma günlüğü, kiro/ klasöründe belgelendirme var
- **Boyut**: ~10KB
- **Tavsiye**: SİL

### 4. **planning.md**
- **Durum**: Gereksiz
- **Açıklama**: Eski planlama dokümanı, kiro/ klasöründe güncel belgelendirme var
- **Boyut**: ~5KB
- **Tavsiye**: SİL

### 5. **INSTALL.md**
- **Durum**: Kontrol gerekli
- **Açıklama**: Kurulum talimatları, hala geçerli mi?
- **Boyut**: ~2KB
- **Tavsiye**: Kontrol et, gerekli değilse SİL

### 6. **README.md**
- **Durum**: Kontrol gerekli
- **Açıklama**: Proje README'si, güncel mi?
- **Boyut**: ~5KB
- **Tavsiye**: Güncellenebilir veya SİL

## 📁 Silinebilir Klasörler

### 1. **.qodo/**
- **Durum**: Gereksiz
- **Açıklama**: Qodo AI analiz klasörü, proje için gerekli değil
- **Tavsiye**: SİL

### 2. **download/**
- **Durum**: Kontrol gerekli
- **Açıklama**: İndirme klasörü, içinde önemli dosya var mı?
- **Tavsiye**: Kontrol et, boşsa SİL

### 3. **mini-services/**
- **Durum**: Kontrol gerekli
- **Açıklama**: Mini servisler, hala kullanılıyor mu?
- **Tavsiye**: Kontrol et, kullanılmıyorsa SİL

## ✅ Tutulması Gereken Dosyalar

### Konfigürasyon Dosyaları
- ✅ `tsconfig.json` - TypeScript konfigürasyonu
- ✅ `next.config.mjs` - Next.js konfigürasyonu
- ✅ `tailwind.config.ts` - Tailwind CSS konfigürasyonu
- ✅ `eslint.config.mjs` - ESLint konfigürasyonu
- ✅ `postcss.config.mjs` - PostCSS konfigürasyonu
- ✅ `components.json` - Shadcn/ui konfigürasyonu
- ✅ `package.json` - Proje bağımlılıkları
- ✅ `package-lock.json` - Bağımlılık kilidi

### Proje Dosyaları
- ✅ `src/` - Kaynak kod
- ✅ `public/` - Statik dosyalar
- ✅ `db/` - Veritabanı
- ✅ `examples/` - Örnekler

### Belgelendirme
- ✅ `kiro/` - Proje belgelendirmesi
- ✅ `.kiro/` - Kiro konfigürasyonu

### Geliştirme Araçları
- ✅ `.git/` - Git repository
- ✅ `.vscode/` - VS Code ayarları
- ✅ `.gitignore` - Git ignore kuralları
- ✅ `.gitattributes` - Git attributes

## 📊 Temizlik Özeti

| Dosya/Klasör | Durum | Boyut | Tavsiye |
|---|---|---|---|
| image1_analysis.json | Gereksiz | ~25KB | SİL |
| image2_analysis.json | Gereksiz | ~25KB | SİL |
| ts_errors.log | Gereksiz | ~5KB | SİL |
| worklog.md | Gereksiz | ~10KB | SİL |
| planning.md | Gereksiz | ~5KB | SİL |
| INSTALL.md | Kontrol | ~2KB | Kontrol et |
| README.md | Kontrol | ~5KB | Kontrol et |
| .qodo/ | Gereksiz | ~100KB | SİL |
| download/ | Kontrol | ? | Kontrol et |
| mini-services/ | Kontrol | ? | Kontrol et |

## 🎯 Temizlik Planı

### Faz 1: Kesin Silinecekler (Güvenli)
```bash
rm image1_analysis.json
rm image2_analysis.json
rm ts_errors.log
rm worklog.md
rm planning.md
rm -rf .qodo/
```

**Tasarruf**: ~170KB

### Faz 2: Kontrol Sonrası Silinecekler
- INSTALL.md - Kontrol et, gerekli değilse sil
- README.md - Güncellenebilir veya silinebilir
- download/ - İçeriği kontrol et
- mini-services/ - Kullanım durumunu kontrol et

## 💾 Toplam Tasarruf

- **Faz 1**: ~170KB
- **Faz 2**: ~50-200KB (kontrol sonrası)
- **Toplam**: ~220-370KB

## ⚠️ Uyarılar

1. Silmeden önce git'e commit et
2. Önemli dosyaları yedekle
3. Kontrol gereken dosyaları önce oku
4. Silme işleminden sonra test et

## 📝 Notlar

- Tüm belgelendirme kiro/ klasöründe tutulur
- Proje belgeleri kiro/ klasöründe merkezi olarak yönetilir
- Eski dosyalar silinebilir, kiro/ klasöründe güncel belgelendirme var
