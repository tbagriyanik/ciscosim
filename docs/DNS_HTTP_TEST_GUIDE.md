# DNS ve HTTP Servis Test Rehberi

## ✅ Build Durumu

**Build Başarılı:** ✓
- TypeScript derleme hatası yok
- Tüm değişiklikler başarıyla derlendi
- Production build hazır

---

## 🧪 Manuel Test Adımları

### Test 1: HTTP Servisi - Basit Metin

1. Uygulamayı başlatın
2. Bir PC seçin ve paneli açın
3. **Services** sekmesine gidin
4. **HTTP** bölümünde servisi etkinleştirin
5. Content alanına: `Merhaba Dünya!`
6. Terminal sekmesine gidin
7. Console bağlantısı kurun
8. Komut: `http <pc-ip>`

**Beklenen Sonuç:**
```
┌─────────────────────────────┐
│  Merhaba Dünya!             │
└─────────────────────────────┘
```

---

### Test 2: HTTP Servisi - `<b>` Etiketi

1. HTTP Content: `<b>Kalın Metin</b>`
2. Terminal'de: `http <pc-ip>`

**Beklenen Sonuç:**
```
┌─────────────────────────────┐
│  Kalın Metin                │
└─────────────────────────────┘
```
(Metin kalın/bold olarak render edilmeli)

---

### Test 3: HTTP Servisi - `<i>` Etiketi

1. HTTP Content: `<i>Eğik Metin</i>`
2. Terminal'de: `http <pc-ip>`

**Beklenen Sonuç:**
```
┌─────────────────────────────┐
│  Eğik Metin                 │
└─────────────────────────────┘
```
(Metin eğik/italic olarak render edilmeli)

---

### Test 4: HTTP Servisi - Karışık İçerik

1. HTTP Content: `<b>Başlık</b> ve <i>alt başlık</i>`
2. Terminal'de: `http <pc-ip>`

**Beklenen Sonuç:**
```
┌─────────────────────────────┐
│  Başlık ve alt başlık       │
└─────────────────────────────┘
```
(Başlık kalın, alt başlık eğik olmalı)

---

### Test 5: Güvenlik - Script Engelleme

1. HTTP Content: `<b>Güvenli</b><script>alert('XSS')</script>`
2. Terminal'de: `http <pc-ip>`

**Beklenen Sonuç:**
```
┌─────────────────────────────┐
│  Güvenli<script>alert('XSS')│
│  </script>                  │
└─────────────────────────────┘
```
(Script etiketi çalıştırılmamalı, sadece metin olarak gösterilmeli)

---

### Test 6: DNS Servisi - Kayıt Ekleme

1. PC Panel → Services → DNS
2. DNS servisini etkinleştir
3. Domain: `test.local`
4. Address: `192.168.1.100`
5. Add Record'a tıkla

**Beklenen Sonuç:**
- Kayıt listesinde `test.local → 192.168.1.100` görünmeli

---

### Test 7: DNS Çözümleme - nslookup

1. Client PC'den terminal açın
2. DNS ayarını DNS sunucusunun IP'si olarak ayarlayın
3. Komut: `nslookup test.local`

**Beklenen Sonuç:**
```
Server: <dns-server-name>
Address: <dns-server-ip>

Name: test.local
Address: 192.168.1.100
```

---

### Test 8: DNS + HTTP Entegrasyonu

**Kurulum:**
- PC-1: DNS Server (192.168.1.10)
  - DNS kaydı: `web.local → 192.168.1.100`
- PC-2: HTTP Server (192.168.1.100)
  - Content: `<b>Web Sayfası</b>`
- PC-3: Client
  - DNS: 192.168.1.10

**Test:**
1. PC-3'te terminal açın
2. Komut: `http web.local`

**Beklenen Sonuç:**
```
┌─────────────────────────────┐
│  Web Sayfası                │
└─────────────────────────────┘
```

---

## 🔍 Kod Doğrulama

### Import Kontrolü
```typescript
// PCPanel.tsx içinde:
import { sanitizeHTTPContent } from '@/lib/security/sanitizer';
```

### Render Kontrolü
```typescript
// HTML output rendering:
{line.type === 'html' && (
  <div 
    className="mt-2 p-4 rounded-lg border bg-white/5 backdrop-blur-sm"
    dangerouslySetInnerHTML={{ __html: sanitizeHTTPContent(line.content) }}
  />
)}
```

### Sanitizer Kontrolü
```typescript
// sanitizer.ts içinde:
export function sanitizeHTTPContent(input: string): string {
    const escaped = input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    let result = escaped
        .replace(/&lt;b&gt;/g, '<b>')
        .replace(/&lt;\/b&gt;/g, '</b>')
        .replace(/&lt;i&gt;/g, '<i>')
        .replace(/&lt;\/i&gt;/g, '</i>');
    
    return result;
}
```

---

## 📊 Test Checklist

### Fonksiyonel Testler
- [ ] HTTP servisi etkinleştirilebiliyor
- [ ] HTTP içeriği girilebiliyor
- [ ] `<b>` etiketi çalışıyor
- [ ] `<i>` etiketi çalışıyor
- [ ] Karışık içerik çalışıyor
- [ ] Terminal'de HTML render ediliyor
- [ ] Servis panelinde önizleme çalışıyor

### Güvenlik Testleri
- [ ] Script etiketleri engelleniyor
- [ ] Event handler'lar temizleniyor
- [ ] XSS denemesi başarısız oluyor
- [ ] Sadece güvenli etiketlere izin veriliyor

### DNS Testleri
- [ ] DNS servisi etkinleştirilebiliyor
- [ ] DNS kaydı eklenebiliyor
- [ ] DNS kaydı silinebiliyor
- [ ] nslookup çalışıyor
- [ ] HTTP komutu DNS kullanabiliyor
- [ ] Domain ile HTTP erişimi çalışıyor

### Performans Testleri
- [ ] Sayfa yükleme hızı etkilenmemiş
- [ ] Terminal performansı iyi
- [ ] Memory leak yok
- [ ] CPU kullanımı normal

---

## 🐛 Bilinen Sorunlar

**Yok** - Build başarılı, hata yok

---

## 📝 Notlar

### Örnek Proje
DNS ve HTTP örneğini test etmek için:
1. Örnek proje yükle: `59-sayfa3-dns-http.json`
2. Bu proje zaten DNS ve HTTP yapılandırması içeriyor
3. HTTP içeriği: `<b>Merhaba</b> Dünya!`

### Beklenen Davranış
- DNS çözümlemesi otomatik çalışmalı
- HTTP komutu domain adlarını çözebilmeli
- HTML içeriği güvenli şekilde render edilmeli
- Script injection denemeleri engellenmeli

---

**Test Durumu:** ⏳ Test edilmeye hazır
**Son Güncelleme:** 1 Nisan 2026
