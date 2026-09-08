# Network Simulator - Usage Guide / Kullanım Kılavuzu

---

## EN: Canvas & Device Basics / TR: Tuval ve Cihaz Temelleri

| Action / İşlem | How / Nasıl |
|---|---|
| **Add device / Cihaz ekle** | Drag from palette onto canvas / Palettekten tuvale sürükle |
| **Select / Seç** | Left click / Sol tık |
| **Multi-select / Çoklu seç** | Shift + click / Shift + tık |
| **Rectangle select / Kutu seç** | Middle-click + drag / Orta tık + sürükle |
| **Move / Taşı** | Left-click + drag / Sol tık + sürükle |
| **Snap to grid / Izgaraya yapıştır** | Ctrl + drag / Ctrl + sürükle |
| **Delete / Sil** | Select + Delete / Seç + Delete |
| **Pan canvas / Tuval kaydır** | Space + drag / Boşluk + sürükle OR / VEYA right-click + drag / sağ tık + sürükle |
| **Zoom / Yakınlaştır** | Mouse wheel / Fare tekerleği OR / VEYA Ctrl + Scroll |
| **Context menu / Bağlam menüsü** | Right-click device / Cihaza sağ tık |
| **Open device / Cihaz aç** | Double-click device / Cihaza çift tık |
| **Mobile cable draw / Mobil kablo çiz** | Tap source port → tap destination port (tap-tap) / Kaynak porta tık → hedef porta tık |

### Cable Types / Kablo Tipleri
| Cable / Kablo | Use / Kullanım |
|---|---|
| **Straight-through / Düz** | PC ↔ Switch, Router ↔ Switch |
| **Crossover / Çapraz** | Switch ↔ Switch, Router ↔ Router, PC ↔ PC, PC ↔ Router |
| **Console** | PC COM → Switch/Router Console port |
| **Serial** | Router ↔ Router (WAN, PPP/HDLC, clock rate) |
| **Wireless** | Otomatik — SSID eşleşmesi + güvenlik + mesafeye göre |

---

## EN: Device Interaction / TR: Cihaz Etkileşimi

| Device / Cihaz | Panel / How to open / Nasıl açılır |
|---|---|
| **PC** | Double-click → CMD, Services (DHCP/DNS/HTTP/FTP/Mail/NTP/Syslog), WiFi, IoT tabs |
| **Switch / Router** | Double-click → CLI terminal (full NOS-style) |
| **L3 Switch** | Same as Switch + `ip routing` for Layer 3 |
| **Firewall** | Dedicated panel with drag-drop rule builder |
| **IoT** | Web-based sensor/actuator management panel |
| **Smartphone / Mobile** | Double-click → Mobile Web Browser (Address bar, Bookmarks, HTTP Render, Printer Integration) & Wi-Fi settings |
| **Network Printer** | Double-click → IP/DHCP Config, Wi-Fi SSID selector, Web Management Panel (LPD/IPP/JetDirect/AirPrint/SNMP/TLS) & Print Queue |
| **Cloud / WAN** | Double-click → Active Public Internet Gateway Monitor, Public DNS (8.8.8.8, 1.1.1.1) & NTP status |
| **Hub** | Layer-1 Multiport Repeater (No CLI configuration required) |

### CLI Modes / CLI Modları
| Prompt | Mode / Mod | Description / Açıklama |
|---|---|---|
| `Switch>` | User EXEC | Basic monitoring (`show`, `ping`, `enable`) |
| `Switch#` | Privileged EXEC | All commands (`configure terminal`, `debug`, `reload`) |
| `Switch(config)#` | Global Config | System config (`hostname`, `vlan`, `interface`) |
| `Switch(config-if)#` | Interface | Port config (`switchport`, `ip address`, `shutdown`) |
| `Switch(config-line)#` | Line | Console/VTY config (`password`, `login`) |
| `Switch(config-vlan)#` | VLAN | VLAN config (`name`, `state`) |
| `Switch(config-router)#` | Router | RIP/OSPF/EIGRP/IPv6 EIGRP config (`network`, `router-id`) |
| `Switch(config-route-map)#` | Route-Map | Route policy config (`match`, `set`) |
| `Switch(dhcp-config)#` | DHCP Pool | DHCP config (`network`, `default-router`) |
| `Switch(config-ssid)#` | SSID Config | SSID security (`authentication`, `guest-mode`, `mbssid`) |
| `Switch(config-dot11)#` | Dot11 Wireless | Wireless radio (`channel`, `speed`, `station-role`, `power`) |
| `WLC(config-wlan)#` | WLAN Config | WLAN profile (`wlan`, `security`, `shutdown`) |
| `PC>` | CMD | Windows-style commands (`ipconfig`, `ping`, `nslookup`) |

---

## EN: Keyboard Shortcuts / TR: Klavye Kısayolları

### Canvas / Tuval
| Shortcut / Kısayol | EN | TR |
|---|---|---|
| `Ctrl + Z` | Undo | Geri al |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo | Yeniden yap |
| `Ctrl + C` | Copy selected device | Seçili cihazı kopyala |
| `Ctrl + X` | Cut selected device | Seçili cihazı kes |
| `Ctrl + V` | Paste | Yapıştır |
| `Ctrl + A` | Select all | Tümünü seç |
| `Delete` / `Backspace` | Delete selected | Seçili öğeyi sil |
| `Escape` | Cancel selection / Close mode | Seçimi iptal et / Modu kapat |
| `Ctrl + Scroll` | Zoom in / out | Yakınlaştır / Uzaklaştır |
| `Space + Drag` | Pan canvas | Canvas'ı kaydır |
| `Arrow Keys` | Move selected device(s) | Seçili cihaz(lar)ı taşı |
| `Shift + Arrow Keys` | Move selected device(s) faster | Seçili cihaz(lar)ı daha hızlı taşı |
| `F1` | Open / close help panel | Yardım panelini aç / kapat |
| `F5` | Refresh network topology | Ağ topolojisini yenile |
| `Home` | Reset topology view | Topoloji görünümünü sıfırla |
| `End` | Focus last element | Son öğeye odaklan |
| `Page Up` | Scroll canvas up | Canvas'ı yukarı kaydır |
| `Page Down` | Scroll canvas down | Canvas'ı aşağı kaydır |
| `Double-click (Empty Space)` | Reset topology view | Topoloji görünümünü sıfırla |
| `Double-click (Device)` | Open collapsible device panel | Daraltılabilir cihaz panelini aç |
| `Double-click (Window Title)` | Collapse / expand floating panel | Yüzen pencereyi daralt / genişlet |
| `Ctrl + S` | Save project | Projeyi kaydet |
| `Ctrl + O` | Open project file | Proje dosyasını aç |
| `Ctrl + N` / `Alt + N` | New project | Yeni proje |
| `Ctrl + P` | Print topology | Topolojiyi yazdır |
| `Ctrl + F` | Toggle fullscreen | Tam ekrana geç / çık |
| `Alt + M` | Toggle Minimap display | Minimap (Harita) göster / gizle |
| `Alt + L` | Toggle Network Log panel | Ağ Olay Günlüğü panelini aç / kapat |
| `Alt + F` | Zoom to fit all devices | Tüm cihazları ekrana sığdır (Fit View) |
| `Alt + R` | Reset zoom/pan view | Görünümü sıfırla |
| `Tab` | Focus the next device / window | Sonraki cihazı / pencereyi odakla |
| `Shift + Tab` | Open Window Switcher (Görev Yöneticisi) | Cihaz pencereleri açıkken pencere değiştiriciyi aç |
| `Ctrl + M` | Minimize the active device window | Etkin cihaz penceresini küçült |
| `Side-by-Side (Böl)` | Arrange windows side-by-side (Split View) | Pencereleri ekranda yan yana / bölünmüş döşe |
| `Tabbed View (Sekme)` | Switch windows to tabbed layout mode | Açık pencereleri sekme modunda birleştir |

### Ping Packet Analysis / Ping Paket Analizi
| Shortcut / Kısayol | EN | TR |
|---|---|---|
| `P` | Play / Pause packet analysis | Paket analizi: Oynat / Duraklat |
| `N` | Next hop (when paused) | Sonraki Hop (duraklatıldığında) |

### CLI / CMD
| Shortcut / Kısayol | EN | TR |
|---|---|---|
| `Tab` | Auto-complete command | Komut tamamlama |
| `Arrow Up / Down` | Command history | Komut geçmişi |
| `Enter` | Execute command | Komutu çalıştır |
| `Ctrl + L` | Clear terminal | Terminali temizle |
| `?` | Show available commands | Kullanılabilir komutları göster |
| `Ctrl + C` | Cancel command (CLI) | Komutu iptal et |

---

## EN: PC CMD Commands / TR: PC CMD Komutları

PC panelinde aşağıdaki komutları kullanabilirsiniz:

| Command / Komut | EN | TR |
|---|---|---|
| `ipconfig` | IP configuration | IP yapılandırması |
| `ping` | Test connectivity | Bağlantı testi |
| `tracert` | Trace route | Rota izleme |
| `netstat` | Network statistics | Ağ istatistikleri |
| `nslookup` | DNS lookup | DNS sorgusu |
| `ssh` / `telnet` | Remote connection | Uzaktan bağlantı |
| `arp` | ARP table | ARP tablosu |
| `dir` / `type` / `copy` | File operations | Dosya işlemleri |

Tüm parametreler ve detaylı kullanım için → [PC_CMD_REFERENCE.md](PC_CMD_REFERENCE.md)

---

## EN: Advanced UI Features / TR: Gelişmiş Arayüz Özellikleri

### Window Management / Pencere Yönetimi
| Feature / Özellik | How / Nasıl |
|---|---|
| **Collapse panel / Paneli daralt** | Başlık çubuğuna çift tıkla / Double-click title bar |
| **Drag panel / Panel taşı** | Başlık çubuğunu sürükle / Drag title bar |
| **Reset window positions / Pencere konumlarını sıfırla** | Yenile (F5) / Refresh (F5) |

### Graphics Quality / Grafik Kalitesi
- Üst menüden **Grafik Kalitesi** seçeneğiyle **Yüksek / Düşük** mod arasında geçiş yapabilirsiniz.
- Düşük kalite, 50+ cihazlı büyük topolojilerde akıcılığı artırır.
- High/Low quality toggle is available in the top menu to improve performance on large topologies.

### Topology Generator / Topoloji Üretici
- **"Topoloji Üret"** butonu ile 40+ hazır senaryodan ağ topolojisi oluşturun.
- Arama kutusuna senaryo adı yazarak filtreleme yapabilirsiniz (`ospf`, `vlan`, `nat`, `iot`).
- Detaylı bilgi için → [TOPOLOGY_GENERATOR.md](TOPOLOGY_GENERATOR.md)

### Packet Capture / Paket Yakalama
- **Paket Yakalama Paneli** ile ağ trafiğini gerçek zamanlı izleyin.
- Çoklu dışlama filtresi: `cdp, stp, arp` gibi virgülle ayrılmış terimler girin.
- Arka plan trafik (DHCP DORA, STP BPDU, CDP, OSPF Hello vb.) otomatik yakalanır.
- Detaylı bilgi için → [PACKET_CAPTURE_GUIDE.md](../network/PACKET_CAPTURE_GUIDE.md)

---

## EN: Tips / TR: İpuçları

- **F1** anywhere toggles the help panel / Her yerde F1 yardım panelini açar
- **ESC** closes modals and deselects / ESC modal kapatır ve seçimi iptal eder
- **?** in CLI or CMD shows available commands / CLI veya CMD'de `?` komutları gösterir
- **CLI Suggestions** show valid commands when you make a typo / CLI hataları yaptığınızda benzer geçerli komutları önerir
- **Tab** auto-completes commands / `Tab` komutları tamamlar
- **Ctrl + Drag** snaps devices to 16px grid / `Ctrl + Drag` cihazları ızgaraya yapıştırır
- **Double-click** any device to open its panel / Cihaza çift tık paneli açar
- **Double-click title bar** of any floating window to collapse it / Yüzen pencerenin başlığına çift tıklayarak daraltabilirsiniz
- **Space + Drag** pans the canvas when zoomed in / `Boşluk + Sürükle` yakınlaştırınca tuvali kaydırır
- **Arrow Keys** move selected devices on topology / `Ok Tuşları` topolojide seçili cihazları taşır
- **Shift + Arrow Keys** moves selected devices faster / `Shift + Ok Tuşları` daha hızlı taşır
- **P** and **N** control ping packet animation playback / `P` ve `N` ping animasyonunu kontrol eder
- **F5** refreshes the network topology / `F5` topolojiyi yeniler
- **Tab** focuses the next device; **Shift + Tab** opens the window switcher when floating device windows are open / **Tab** sonraki cihaza, **Shift + Tab** açık yüzen cihaz pencereleri varsa pencere değiştiriciye odaklanır
- **Ctrl + M** minimizes the active device window / Etkin cihaz penceresini küçültür
- Config panel shows live `running-config` / Config paneli canlı `running-config` gösterir
- Windows are auto-positioned and restored on refresh / Pencereler otomatik konumlanır ve yenilemede geri yüklenir
- For PC CMD parameters → [PC_CMD_REFERENCE.md](PC_CMD_REFERENCE.md)
