# DNS ve HTTP Servis Kullanım Kılavuzu

## 🌐 DNS (Domain Name System) Servisi

DNS servisi, alan adlarını IP adreslerine çözümlemek için kullanılır.

### DNS Servisini Etkinleştirme

1. PC Panel'i açın ve **Services** sekmesine gidin
2. **DNS** bölümünde toggle switch'i kullanarak DNS servisini etkinleştirin
3. DNS kayıtları ekleyin:
   - **Domain**: Alan adı girin (örn: `example.com`)
   - **Address**: IP adresi girin (örn: `192.168.1.10`)
   - **Add Record** butonuna tıklayın

### DNS Kaydı Örneği

```
Domain: webserver.local
Address: 192.168.1.100
```

### DNS Kullanımı

Terminal'de aşağıdaki komutları kullanabilirsiniz:

```bash
# DNS ile alan adı çözümleme
nslookup example.com

# HTTP ile web sunucusuna erişim (alan adı ile)
http webserver.local

# Ping komutu (alan adı ile)
ping example.com
```

### DNS Gereksinimleri

- DNS sunucusunun IP adresi PC'nin DNS ayarında yapılandırılmış olmalı
- DNS sunucusuna fiziksel bağlantı bulunmalı
- DNS sunucusunda en az bir kayıt olmalı

---

## 🌍 HTTP (Hypertext Transfer Protocol) Servisi

HTTP servisi, basit web içeriği sunmak için kullanılır.

### HTTP Servisini Etkinleştirme

1. PC Panel'i açın ve **Services** sekmesine gidin
2. **HTTP** bölümünde toggle switch'i kullanarak HTTP servisini etkinleştirin
3. **HTTP Content** alanına gösterilecek içeriği girin

### HTML Etiketleri

HTTP içeriğinde aşağıdaki HTML etiketlerini kullanabilirsiniz:

- `<b>metin</b>` - **Kalın metin**
- `<i>metin</i>` - *Eğik metin*

### Güvenlik

Sistem, XSS saldırılarını önlemek için tüm HTML içeriğini güvenli hale getirir:
- Sadece `<b>` ve `<i>` etiketlerine izin verilir
- Diğer tüm HTML etiketleri temizlenir
- JavaScript kodu çalıştırılmaz

### HTTP İçeriği Örnekleri

#### Örnek 1: Temel Metin
```
Merhaba Dünya!
```

#### Örnek 2: Biçimlendirilmiş Metin
```
<b>Hoş Geldiniz!</b> Bu <i>örnek</i> bir HTTP sayfasıdır.
```

#### Örnek 3: Başlık ve Açıklama
```
<b style="font-size: 20px;">Ana Başlık</b>
<i>Bu alt başlık</i>
```

### HTTP Servisine Erişim

Terminal'den HTTP servisine erişmek için:

```bash
# IP adresi ile erişim
http 192.168.1.100

# Alan adı ile erişim (DNS gerekli)
http example.com
```

---

## 🔧 Sorun Giderme

### DNS Çözümleme Başarısız

1. DNS sunucusunun açık olduğundan emin olun
2. DNS sunucusuna bağlantıyı kontrol edin
3. DNS kaydının doğru yapılandırıldığını doğrulayın
4. PC'nin DNS ayarının doğru olduğunu kontrol edin

### HTTP Sayfası Gösterilmiyor

1. HTTP servisinin etkin olduğunu doğrulayın
2. Hedef cihule erişilebilir olduğunu kontrol edin
3. Gateway ve subnet ayarlarını doğrulayın
4. DNS kullanılıyorsa, DNS çözümlemesinin çalıştığını kontrol edin

---

## 📋 Örnek Senaryo

### Senaryo: Web Sunucusu ve DNS

1. **PC-1**'i web sunucusu olarak yapılandırın:
   - IP: `192.168.1.100`
   - HTTP Servisi: Etkin
   - HTTP İçerik: `<b>Hoş Geldiniz!</b> Bu <i>test</i> sayfası.`

2. **PC-2**'yi DNS sunucusu olarak yapılandırın:
   - IP: `192.168.1.10`
   - DNS Servisi: Etkin
   - DNS Kaydı: `web.local → 192.168.1.100`

3. **PC-3**'ten erişim:
   - DNS: `192.168.1.10` olarak ayarlayın
   - Terminal'de: `http web.local` komutunu çalıştırın

Sonuç: PC-3'te "Hoş Geldiniz! Bu test sayfası." mesajı görüntülenir.

---

## ⚠️ Güvenlik Notları

- HTTP içeriği otomatik olarak sanitize edilir
- Sadece `<b>` ve `<i>` etiketleri güvenlidir
- Script etiketleri ve event handler'lar engellenmiştir
- External kaynaklara bağlantılar desteklenmez
