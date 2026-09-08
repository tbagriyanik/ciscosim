# 📅 Network Simulator — Proje Geçmişi

Yeniden eskiye, tarih mevcuttur.

## v4.8.0 — 2026-09-08

**CLI İyileştirmeleri, Canlı Arayüz Sayaçları, Ağ Teşhis Detektörleri, STP/OSPF/EIGRP/NAT Motor Güncellemeleri ve Network Health Check** —
- **🎯 CLI Hata Formatlama & İmleç Konumlandırması**: `% Ambiguous command: "<token>"`, `% Incomplete command.` ve `% Invalid input detected at '^' marker.` hassas imleç konum gösterimi uygulandı (`parser.ts`, `iosErrors.ts`).
- **📊 Canlı `show interfaces` Sayaç Eşlemesi**: Arayüz paket/bayt geçişleri (`inputPackets`, `outputPackets`, `inputBytes`, `outputBytes`, `inputErrors`, `drops`) canlı veri yapısına bağlandı (`showInterfaceDisplay.ts`).
- **📍 Tek Satır Drop Nedeni Raporlaması**: Ping ve paket izleme başarısızlıklarında düşme gerekçesi tek satırda (`Drop Reason: Inbound ACL Denied...`) raporlanıyor (`privilegedConnectivity.ts`).
- **🗺️ Detaylı `show ip route` Formatı**: Rotalar Administrative Distance (AD), Metric, Next-Hop IP ve çıkış arayüzü bilgisiyle (`[110/2] via 10.0.0.2, GigabitEthernet0/1`) gösteriliyor (`showRoutingDisplay.ts`).
- **⏳ Otomatik ARP / MAC / NAT Session Aging**: Zaman tabanlı yaşlanma motoru ile pasif ARP, MAC ve dinamik NAT/PAT oturumları otomatik temizleniyor ve syslog olayları üretiliyor (`agingEngine.ts`, `arp.ts`).
- **🔍 Otomatik Ağ Teşhis Detektörleri (`vlanDiagnostics.ts`)**:
  - **Native & Trunk VLAN Mismatch**: Native VLAN uyumsuzluğu (`%CDP-4-NATIVE_VLAN_MISMATCH`), allowed ve access VLAN farkı tespiti.
  - **Duplicate IP & MAC Detektörü**: Çakışan IP (`%IP-4-DUPARP`) ve MAC adreslerinin (`%MAC-4-DUPLICATE`) tespiti.
  - **Orphan Port & Bağlantısız Cihaz Detektörü**: İzole cihazlar ve konfigüre edilip kablo takılmamış boş portların tespiti.
- **🔄 Routing Loop Detektörü & Hop-by-Hop TTL**: Katman-3 yönlendirme döngülerinin tespiti (`%ROUTING-3-LOOP_DETECTED`) ve router geçişlerinde TTL'nin hop hop eksiltilmesi (`packetPipeline.ts`).
- **🛡️ ACL Hit Counters Eşleşmesi**: Paket geçişlerinde ilgili ACL kuralının sayaçları artırılarak `show access-lists` çıktısında `(X matches)` şeklinde gösteriliyor (`acl.ts`, `showCommands.ts`).
- **🌳 STP Topology Change Events**: STP port durum ve köprü değişimlerinde `%STP-6-TOPOTRAP: Topology change detected` olay kaydı üretiliyor (`stp.ts`).
- **⚡ Arayüz Shutdown / No Shutdown Otomatik Recalculation**: Port açılıp kapandığında STP (`getPvstUpdate`) ve yönlendirme durumları anında yeniden hesaplanıyor (`cmd.interface.ts`).
- **🔗 Dinamik EtherChannel Bundle Güncellemesi**: Kapanan üye portlar bundle paketinden düşürülüp `Port-channel` durumu dinamik güncelleniyor (`etherchannel.ts`).
- **📜 OSPF & EIGRP Komşuluk İyileştirmeleri**: OSPF komşuluk durum geçişleri (Down -> Full) `%OSPF-5-ADJCHG` olarak timeline'a ekleniyor; EIGRP hold-time zaman aşımı ve birim testleri tamamlandı (`eventPipeline.ts`, `eigrp-dual.test.ts`).
- **🏥 Tek Komutla Network Health Check (`show network health`)**: Tüm VLAN, IP/MAC, bağlantı ve STP sorunlarını özetleyen `show network health` (ve `show health`) CLI komutu eklendi (`showCommands.ts`, `showPatterns.ts`).
- **🧩 Modüler Kod Ayrıştırma (Satır Sınırı Optimizasyonları)**:
  - `showCommands.ts` içerisindeki sistem/saat/flash komutları [`showSystemDisplay.ts`](file:///f:/NetworkSimulator/src/lib/network/core/showSystemDisplay.ts) dosyasına ayrıştırıldı.
  - `globalConfigCommands.ts` içerisindeki parola, banner ve kullanıcı güvenlik işleyicileri [`globalConfigSecurityCommands.ts`](file:///f:/NetworkSimulator/src/lib/network/core/globalConfigSecurityCommands.ts) dosyasına taşındı.
  - `usePCPanelCommands.ts` içerisindeki FTP oturum yönetimi [`usePCPanelFtpCommands.ts`](file:///f:/NetworkSimulator/src/components/network/pc-panel/usePCPanelFtpCommands.ts) hook'una bölündü.
- **⚡ O(1) Yol Çözümleme İndeksi (`pathResolutionCache.ts`)**: $O(1)$ sürede cihaz komşuluklarını ve port durumlarını veren `buildDeviceAdjacencyMap` komşuluk indeksi eklendi.
- **📱 Mobil Touch UX ve Haptic Feedback**: `triggerHapticFeedback` ile mobil titreşim desteği ve A11y SVG hassasiyeti uygulandı.

## v4.7.0 — 2026-09-07

**WLC Wi-Fi SSID Yansıması & Yönetim IP Düzeltmesi, PC HTTP Servisi Varsayılanları ve Kararlı Toggle, Terminal UX Modülarizasyonu (8 Claude Önerisi), Güvenlik/Determinizm Düzeltmeleri ve Connectivity Ayıklama** —
- **📶 WLC Wi-Fi SSID & Güvenlik Yansıması (`wireless.ts`)**: WLC'de tanımlı ve aktif (`status: enabled`) WLAN'ların SSID, parola ve güvenlik modu bilgisi, `getDeviceWifiConfig` üzerinden kablosuz ağ yapılandırmasına (AP modu) otomatik yansıtılıyor; WLC üzerinde WLAN tanımlandığında istemci cihazları SSID sinyal düzeni üzerinden WLC'ye bağlanabilecek duruma geliyor.
- **🌐 WLC Varsayılan Yönetim IP Düzeltmesi (`initialState.ts`)**: WLC GigabitEthernet0/1 varsayılan IP adresi ağ geçidiyle uyumlu olması için `192.168.1.254` yerine `192.168.1.1` yapıldı.
- **🖥️ PC/IoT/Yazıcı/WLC Cihazlarında HTTP Varsayılan Açık (`useCanvasActions.ts`)**: Araç çubuğundan eklenen PC, IoT, Yazıcı ve WLC cihazlarında HTTP servisi varsayılan `enabled: true` ile oluşturuluyor; PC'ler için `Welcome to <cihaz adı> Web Server` içerik şablonu, WLC'ler için `WLC-DHCP-POOL` (başlangıç `192.168.1.100`, ağ geçidi `192.168.1.1`, DNS `8.8.8.8`) DHCP havuzu otomatik tanımlanıyor.
- **🖧 İlk PC'de HTTP Varsayılan Açık**: Boş proje (`useProjectReset.ts` resetHistory/setTopologyDevices), senaryo üretici (`scenarioGenerators.ts`) ve örnek projelerdeki (`exampleProjects/helpers.ts`) tüm PC'lere `services.http.enabled: true` varsayılanı uygulanıyor; PC'ler ilk eklendiğinde HTTP servisi "açık" olarak başlıyor.
- **🔁 PC HTTP Aç/Kapa Toggle Stabilizasyonu (`usePageNetworkLogic.ts`, `useDeviceManager.ts`, `useAppNavigation.ts`, `page.tsx`)**: PC panelindeki HTTP servis düğmesine basıldığında durumun anında eski haline dönmesi giderildi. `update-topology-device-config` olayı `services.http` bilgisini artık runtime cihaz durumuna (`SwitchState`) da yansıtıyor ve `running-config`'teki `ip http server` satırı yeniden oluşturularak senkron tutuluyor; `getOrCreateDeviceState` canvas cihazının `services` bilgisini alarak PC runtime'ını HTTP servis durumuyla başlatıyor. HTTP içerik, kullanıcı adı/parola ve yazı tipi boyutu ayarları config iletiminde korunuyor (`usePCPanelSync.ts`, `HttpServiceConfig.tsx`).
- **🖧 Cihaz Bilgi Popover Servis Rozetleri (`DeviceInfoPopovers.tsx`)**: PC bilgi popover'larındaki HTTP/DNS/DHCP/FTP/MAIL/NTP/SYSLOG rozetleri artık hem canvas `services` hem de runtime cihaz durumunu birlikte değerlendiriyor; HTTP rozeti PC'lerde varsayılan etkin gösteriliyor.
- **⌨️ Terminal UX Modülarizasyonu & 8 Claude Önerisi**: `Terminal.tsx` monoliti yeniden yapılandırıldı; `BootProgressBar.tsx` (cihaz önyükleme ilerleme çubuğu animasyonu, tamamlanan boot ID'leri arasında sekmeler arası tekrarsız geçiş), `TerminalHeaderActions.tsx` (kopyala, temizle, dışa aktar/indir, ayarlar, Wi-Fi ve yazı boyutu hızlı eylemleri), `useTerminalTabCompletion.ts` (Tab tuşu ile bağlama duyarlı komut tamamlama altyapısı), `PythonInputModal.tsx` (Python kod satırı giriş modalı), `PCPanelDialogs.tsx` + `PCPanelContext.tsx` (PC paneli diyalog ve bağlam modülerliği) bileşenleri eklendi.
- **🛡️ Firewall Tip Güvenliği & `same-security-traffic` (`firewallCommands.ts`, `types.ts`)**: ASA firewall'da aynı güvenlik seviyesi içi trafiğe izin/red emri (`same-security-traffic permit intra-interface`) artık `SwitchState.sameSecurityTraffic` alanını tip güvenli şekilde kullanıyor; firewall komut işleyicilerindeki `as unknown as Partial<SwitchState>` cast'leri kaldırıldı.
- **🪄 Deterministik Ping Gecikmesi (PRNG) (`privilegedConnectivity.ts`)**: Kablosuz uzaklığa göre ping gecikmesi ve hop sürelerinde `Math.random` yerine tohumlanabilir deterministik PRNG kullanıldı; simülasyon çıktıları tekrarlanabilir ve test kararlılığı artırıldı.
- **🌩️ Bulut Bağlantısız Durum Denetimi (`usePCPanelBrowser.ts`, `pathResolution.ts`)**: Web tarayıcısından kamu DNS/WAN adreslerine (`1.1.1.1`, `8.8.8.8`) gidilirken Cloud (WAN) cihazının topolojide bulunmaması veya hiçbir kabloyla ağa bağlı olmaması durumları tespit edilip *"Bulut (Cloud) cihazı ağa bağlı değil."* hatası, simülasyon tarafında `success: false` dönüşü ve tarayıcıda özel **"Bulut Bağlantısız"** (bağlantısız cihaz ekranı) gösteriliyor.
- **🧹 Silinen Cihaz Geçmişi Temizleme (`historySerialization.ts`)**: Proje geçmişine (history) kopyalama sırasında topolojide artık bulunmayan cihazların `deviceOutputs` (konsol çıktıları), `pcOutputs` (PC çıktıları) ve `pcHistories` (komut geçmişleri) verileri temizleniyor; geçmiş kayıtlarında kalıntı terminal verisi tutulmuyor.
- **🧵 HTML Entity Çözme — `decodeHTMLEntities` (`sanitizer.ts`)**: HTTP servis içeriği gibi sanitize edilmiş metinlerdeki HTML entity'lerin (`&lt;`, `&gt;`, `&quot;`, `&#039;`, `&amp;` vb.) orijinal karakterlere dönüştürülmesi için güvenli çözücü eklendi.
- **🔀 Connectivity Ayıklaması (`connectivity/resolvePathTraffic.ts`)**: QoS/IPsec ile patik çözümleme yardımcı fonksiyonu `pathResolution.ts` içinden ayrılıp bağımsız `resolvePathTraffic.ts` modülüne taşındı; döngüsel bağımlılık riski azaltıldı.

## v4.6.0 — 2026-09-06

**Canlı Paket İzleme UI, RFC ICMP Hata Kodları, L3 TTL Decrementing, Gerçek Zamanlı Aging, ACL Sayaçları, VLAN Teşhisleri, LPM Routing Rasyoneli, MAC Yaşam Döngüsü ve Canlı Port İstatistikleri** —
- **🔍 Canlı Paket İzleme UI Inspector (`PacketTraceInspector.tsx`)**: Paketin tuval ve düğümler üzerindeki hop, aşama (`L1`, `Port Security`, `STP`, `VLAN`, `ACL`, `Routing/MAC Lookup`, `QoS`, `Capture`), eylem (`pass`, `drop`, `forward`, `flood`, `trap`) kararlarını, gerekçe açıklamalarını ve frame snapshot'larını canlı gösteren interaktif paket analiz paneli.
- **✉️ RFC Standartlarında ICMP Hata Kodları & Paket Üretimi (`icmpUtils.ts`)**: RFC 792 ve RFC 4443 standartlarına uygun ICMP Type 3 (Destination Unreachable: Code 0 Net Unreachable, Code 1 Host Unreachable, Code 3 Port Unreachable, Code 13 Admin Prohibited) ve Type 11 (Time Exceeded: Code 0 TTL Exceeded) hata paket üretimi.
- **⏳ Standartlaştırılmış Katman-3 TTL Decrementing (`packetPipeline.ts`)**: Tüm Router, L3 Switch ve Firewall yönlendirme yollarında TTL'nin 1 eksiltilmesi ve TTL 0'a ulaştığında paketin düşürülüp göndericiye ICMP Time Exceeded yanıtı dönülmesi.
- **⏱️ Gerçek Zamanlı ARP ve MAC Aging Motoru (`agingEngine.ts`)**: MAC adresi dinamik kayıtları (300sn) ve ARP önbelleği (120sn) için canlı arka plan yaşlanma ve temizleme mekanizması.
- **📊 ACL Paket Sayacı & İzleme Yöntemi (`acl.ts`)**: Erişim kontrol listelerindeki (ACL) her kural için canlı paket ve bayt eşleşme sayaçlarının tutulması, `show access-lists` çıktısına yansıtılması ve ACL engelinde ICMP Code 13 üretimi.
- **🔌 VLAN & Trunk Uyumsuzluk Teşhisleri (`vlanDiagnostics.ts`)**: Bağlı trunk ve access switch portlarındaki Native VLAN uyuşmazlığı, Allowed VLAN farkları ve Access VLAN uyumsuzluklarını otomatik tespit eden teşhis tarayıcısı.
- **🎯 Detaylı Routing Karar Açıklamaları (`routing.ts`)**: Rota seçiminde Longest-Prefix Match (LPM) (örn. `10.0.0.0/24`), Administrative Distance (AD) (Connected: 0, Static: 1, EIGRP: 90, OSPF: 110, RIP: 120) ve Metric değerlerini analiz edip gerekçelendiren `findRouteDetailed` motoru.
- **🪵 MAC Yaşam Döngüsü Olay Günlüğü (`macLearning.ts`)**: MAC adresi öğrenme (`LEARN`), portlar arası geçiş/flapping (`MOVE`), zaman aşımıyla silinme (`AGE`) ve unicast miss durumunda taşma (`FLOOD`) olaylarını yayınlayan log altyapısı.
- **📈 Canlı Arayüz Trafik İstatistikleri (`packetPipeline.ts`)**: Arayüzlerden paket geçtikçe ve düştükçe `rxPackets`, `rxBytes`, `txPackets`, `txBytes`, `rxDrops`, `txDrops` istatistiklerinin gerçek zamanlı hesaplanması ve `show interfaces` komutuna yansıtılması.
- **🛑 Paket Düşürme Nedeni Standartlaştırması (`dropReasons.ts`)**: Tüm Katman-1, Katman-2, Katman-3, ACL, STP ve Güvenlik paket düşürme gerekçelerinin standart `DropReasonCode` enum'ları ve düzeltme önerileri ile sınıflandırılması.

## v4.5.0 — 2026-09-06

**Çift Yönlü Otomatik VoIP Arama Kapanma Guard, Bulut Cihazı SVG Port Numaralandırması (1-4) ve Birleştirilmiş Fare/Klavye Kısayolları** —
- **📞 Çift Yönlü Otomatik VoIP Arama Kapanma Guard**: Telefon araması esnasında kablo sökülmesi, kablosuz bağlantı kopması, IP değişikliği veya karşı cihazın kapanması durumunda her iki tarafın aktif aramasını eş zamanlı sonlandıran ve ekran pencerelerine *"Arama Sonlandırıldı: Bağlantı koptu!"* bildirimi yansıtan otomatik ağ denetim mekanizması uygulandı (`usePeriodicNetworkPackets.ts`, `MobileDeviceView.tsx`).
- **☁️ Bulut Cihazı SVG Port Düzeni ve Numaralandırması**: Bulut (`cloud`) cihazının altındaki portların konumlandırması sağa hizalandı ve port isimleri (`W`, `L`) standartlaşarak `1`, `2`, `3`, `4` rakamlarına çevrildi (`DeviceRenderer.tsx`).
- **⌨️ Birleştirilmiş Fare & Klavye Kısayolları Paneli**: F1 Yardım ve Komut Referansı modalında Klavye Kısayolları kategorisi, tüm klavye tuş kombinasyonları ve fare etkileşimlerini (Sol Tık, Çift Tık, Sağ Tık, Scroll Zoom, Pan, Otomatik Kopyalama) kapsayacak şekilde **"Fare & Klavye Kısayolları"** tek birleştirilmiş başlık altında yeniden düzenlendi (`networkTopology.commands.ts`).

## v4.4.0 — 2026-09-05

**WAN Bulut ICMP/Ping Desteği, IP Doğrulama Düzeltmeleri, Otomatik Fare Seçim Kopyalama ve UI Düzeltmeleri** —
- **☁️ WAN Bulut / Public DNS ICMP Ping Desteği**: `1.1.1.1` ve `8.8.8.8` genel kamu DNS/WAN IP adreslerine web tarayıcısının yanında PC komut satırı ve cihaz pencerelerinden `ping` atılabilmesi için Katman-3 Varsayılan Ağ Geçidi (Default Gateway) ve ICMP paket iletim rotaları bağlandı (`pathResolution.ts`, `pingDiagnostics.ts`).
- **🛡️ Sadece Geçerli WAN/Kamu IP Doğrulaması**: Topolojide olmayan yerel/geçersiz IP adreslerine (`192.168.1.1111` vb.) ping atıldığında yanlışlıkla Bulut cihazına düşüp "ping başarılı" denmesi engellendi; sadece doğrulanan kamu DNS IP'leri (`1.1.1.1`, `8.8.8.8`, vb.) ve açıkça tanımlı Cloud IP'leri için bulut yönlendirmesi kısıtlanarak hatalı IP'lerde "Request timed out" üretilmesi sağlandı (`pathResolution.ts`).
- **📋 Fare İle Metin Seçince Otomatik Panoya Kopyalama (Auto-Copy)**: PC Komut İstemi (CMD), Linux Terminali, Cihaz Konsol Sekmesi (`CommandLineTab.tsx`, `ConsoleTerminalTab.tsx`) ve Ana CLI Terminal penceresinde (`Terminal.tsx`) komut/çıktı geçmişi alanlarında fare ile sürükleyip metin seçimi tamamlandığında (`onMouseUp`), seçilen metnin otomatik olarak panoya (clipboard) kopyalanması sağlandı.
- **🎨 CMD & CLI Komut Önerileri (Autocomplete) Düzenleme**: Komut tamamlama açılır penceresinde IP önerileri ile komut önerilerinin yan yana bitişik Türkçe/İngilizce kelimeler halinde kayması engellendi. Öneri listesi `flex flex-col` yapısında dikey butonlar halinde hizalandı.

## v4.3.0 — 2026-09-04

**Akıllı Cihaz Hizalama Araç Çubuğu, Hizalamada Undo/Redo (Ctrl+Z/Ctrl+Y) Desteği, Cloud/WAN Arayüz & Port Monitörü, Ağ Yazıcısı & Print Server Yönetimi** —
- **📐 Akıllı Hizalama Araç Çubuğu & Undo/Redo**: Topolojide çoklu cihaz seçildiğinde beliren araç çubuğu için Sola, Sağa, Üste, Yatayda Ortala ve Dikeyde Ortala eylemlerine grafik SVG ikonları entegre edildi. Her hizalama eyleminde `saveToHistory()` çağrılarak `Ctrl+Z` ve `Ctrl+Y` ile hizalama hareketlerinin geri alınması ve yenilenmesi sağlandı.
- **🌐 Cloud / WAN Arayüz & Port Monitörü**: Bulut (`cloud`) cihazının detay görünümüne (`CloudDeviceView.tsx`) ISP Arayüz & Port Listesi eklendi. `Eth0..Eth3` portlarının canlı bağlantı durumu (UP/DOWN), kiraladığı/atadığı IP adresleri ve bağlı olduğu komşu ağ cihazının adı/IP çözümlenmesi sağlandı.
- **🖨️ Ağ Yazıcısı & Web Yönetim / Wi-Fi Entegrasyonu**: Dual-interface Ethernet/Wi-Fi destekli Ağ Yazıcısı (`printer`) için dinamik DHCP IP edinimi (`obtainDhcpLeaseForPrinter`), Wi-Fi SSID seçim paneli ve tuval üzerinde Wi-Fi sinyal çubukları (`wifiBarRects`) eklendi (`PrinterDeviceView.tsx`, `DeviceRenderer.tsx`).
- **🌐 Print Server Web Yönetimi & LPD/IPP Paket Yakalama**: Yazıcı cihazlarının dahili web sunucusuna (`printerWebPanel.ts`) Servis & Protokol Yönetimi (LPD/515, IPP/631, JetDirect/9100, AirPrint/IPP-S, SNMP, TLS 1.3), Güvenlik & Yetkilendirme ayarları ve Canlı Yazdırma Kuyruğu (`printJobs`) yönetimi eklendi. PC ve Mobil Web Tarayıcılarından (`HttpBrowserWindow.tsx`) "Belgeyi Yazdır" butonu ile ağdaki aktif yazıcılara belge kuyruklama ve Paket Yakalama Paneline (`dispatchCapturedPackets`) LPD/IPP paket akışı iletimi sağlandı.
- **📱 Akıllı Telefon (Mobile) Web Tarayıcısı & VoIP Sesli Arama**: Mobil cihaz arayüzüne Adres Çubuğu, Git butonu, Hazır Yer İmleri (`Gateway`, `DNS 8.8.8.8`, `IoT Panel`) ve TCP port 80 ağ yolu denetimi ile canlı HTML web sayfalarını (Router/WLC Yönetim, Yazıcı Paneli, IoT Kontrol Paneli, Genel WAN Arama ve PC HTTP Sunucusu) render eden mobil web tarayıcısı uygulandı (`MobileDeviceView.tsx`). Dahili **IP Voice / VoIP Numaratörü (Dial Pad)**, Numaratör (`0-9`, `*`, `#`), **Ağ Rehberi (Network Directory)** üzerinden aynı alt ağdaki/rotalı diğer telefonları arayabilme, canlı SIP/UDP 5060 sinyalleşmesi ve paket yakalama entegrasyonu, aranan tarafta **Gelen Çağrı (Incoming Call - Cevapla / Reddet)** bildirimi, çift taraflı eşzamanlı konuşma sonlandırma ve konuşma süreli **Arama Geçmişi (Call History)** yönetimi sağlandı.
- **☁️ Fonksiyonel Bulut WAN Geçit Cihazı (`cloud`)**: Topolojideki Bulut cihazı `203.0.113.1` varsayılan IP adresi, `eth0..eth3` portları ve transit köprü ile paket iletimi yapacak şekilde aktifleştirildi (`commonForwardingEngine.ts`, `pathResolution.ts`). Genel DNS (`8.8.8.8`, `1.1.1.1`), NTP (`pool.ntp.org`) ve dış alan adlarına yapılan ping/web istekleri canvas üzerindeki Bulut cihazı üzerinden gerçek zamanlı çözümlenecek şekilde bağlandı.
- **📊 Ağ Özeti & Syslog Sunucusu Gösterimi**: Cihaz Listesi / Ağ Özeti panelinde PC ve uç cihazlar için Syslog Sunucusu aktiflik durumu ve kayıt sayıları gösterildi; Hub cihazı Katman-1 tekrarlayıcı niteliğinde olduğundan CLI ve durum özeti kartlarından muaf tutuldu (`LiveDeviceList.tsx`).
- **💾 Depolama Kotası & Kota Aşımı Optimizasyonu**: `localStorage` 5 MB kotasını korumak amacıyla geçmiş kaydı 15 işlem ile sınırlandırıldı, acil durum depolama temizleme mantığı entegre edildi ve `QuotaExceededError` uyarısı giderildi (`secureStorage.ts`, `useHistory.ts`).

## v4.1.0 — 2026-09-03

**MSTP Entegrasyonu, IPsec GRE, BGP Politikaları, 802.1X EAPOL & 4 Yeni Cihaz Tipi (`Hub`, `Cloud/WAN`, `Smartphone`, `Printer`)** —
- **🚀 4 Yeni Cihaz Tipi & Kompakt Toolbar Mimarisi**: Topolojiye Layer-1 Multiport **Hub** (`hub`), Dış İnternet **Cloud/WAN** (`cloud`), Kablosuz **Akıllı Telefon/Tablet** (`mobile`) ve Ağ **Yazıcısı** (`printer`) cihaz tipleri eklendi. Tuval (canvas) üzerinde her cihaz tipi için özel gerçekçi SVG gövde ve ikon çizimleri (`DeviceRenderer.tsx`, `DeviceIcon.tsx`) geliştirildi. Cihaz ekleme araç çubuğu (toolbar) 2 satırlı ultra-kompakt (`h-7 w-7` butonlar, `15px` ikonlar) grid yapısına getirildi.
- **🌲 MSTP (IEEE 802.1s) Bölge Sınırı İzolasyonu**: `mstp.ts` ve `stp.ts` üzerinde MST bölge adı, revizyon numarası ve VLAN-to-Instance digest denetimi yapan `areSameMstRegion()` sınır izolasyonu entegre edildi. CIST (Instance 0) tekil-ağaç BPDU'ları bölge dışına iletilirken, MSTI (Instance 1..N) BPDU'larının farklı bölgedeki switch'lere taşması engellendi.
- **🛡️ 802.1X EAPOL & Port Güvenlik Akışı**: EAPOL-Start, EAPOL-Request/Response Identity, EAPOL-Success/Failure paket seviyesinde port erişim kontrolü ve RADIUS kimlik doğrulama simülasyonu sağlandı.
- **⚡ QoS Token Bucket Police & Shape Engine**: Traffic Policing (`police <rate>`) ve Traffic Shaping (`shape average <rate>`) jeton kovası (Token Bucket) algoritması ile bandwidth limitleme ve paket paket kalıplama simülasyonu eklendi.
- **🔒 IPsec Site-to-Site GRE over IPsec**: `crypto isakmp policy`, `crypto isakmp key`, `crypto ipsec transform-set`, `crypto map` komutları, ESP tünel şifreleme simülasyonu ve `show crypto isakmp/ipsec sa` komutları tamamlandı.
- **🌐 BGP Policy & Attributes Deepening**: `neighbor route-map` ve `neighbor weight` komutları ile BGP en iyi yol (best-path) seçim algoritması derinleştirildi.
- **🧹 DHCP Snooping Rate-Limit & Option 82**: `ip dhcp snooping information option` ve arayüz bazlı `ip dhcp snooping limit rate` CLI komut desteği entegre edildi.
- **📶 Wireless Client Roaming & RF Parametreleri**: AP kapsama alanı, sinyal seviyesi (RSSI), kanal çakışması denetimi ve AP'ler arası kesintisiz müşteri roaming geçişi desteklendi.
- **📚 F1 Yardım & Dokümantasyon Entegrasyonu**: Tüm v4.1.0 komutları F1 CLI komut referansı pencerelerine ve dokümantasyon dizinlerine entegre edildi.


## v4.0.0 — 2026-09-02

**Kurumsal Ağ & Gelişmiş Protokol Mimarisi** — EIGRP for IPv6, IP/IPv6 Prefix-List, Route-Map politika motoru (`match` & `set`), GLBP (Gateway Load Balancing Protocol sanal router grubu, AVG seçimi), STP Loop Guard ve NetFlow trafik izleme motoru ile tam dokümantasyon ve yardım entegrasyonu tamamlanarak Sürüm 4.0.0 ana yayın seviyesine geçildi.

## v3.9.0 — 2026-09-02

**Gelişmiş Ağ Protokolleri & CLI Dokümantasyon/Yardım Entegrasyonu** — EIGRP for IPv6 (`ipv6 router eigrp`, `ipv6 eigrp <as>`, DUAL IPv6 metric hesabı), IP/IPv6 Prefix-List (`ip/ipv6 prefix-list`), Route-Map politika motoru (`route-map`, `match ip/ipv6 address prefix-list`, `match interface`, `set metric`, `set ip/ipv6 next-hop`, `set local-preference`), GLBP (Gateway Load Balancing Protocol sanal router grubu, AVG seçimi ve `0007.b400.XXXX` sanal MAC üretimi), STP Loop Guard (`spanning-tree loopguard default`, `spanning-tree guard loop`) ve NetFlow (`ip flow-export`, `ip flow ingress/egress`, `show ip cache flow`) protokol simülasyonları eklendi. Tüm yeni komutlar CLI yardım penceresine, inline tab-completion mimarisine ve `CLI_COMMANDS.md` dokümantasyonuna entegre edildi.

## v3.8.0 — 2026-09-01

**Topoloji Not İçi Klavye & Giriş Güvenliği ve Sekme Odak Yönetimi** — Not (`NoteNode`) ve metin düzenleme alanlarında yazı yazılırken global topoloji klavye kısayollarının (`TAB`, nümerik `0`, `+`, `-`, `Home`) devre dışı kalması sağlandı. `TAB` tuşunun not metni içerisinde 4 boşlukluk girinti (`indentation` / `outdentation`) olarak çalışması ve odağın not alanında kalması sağlandı. `0`, `+`, `-`, `Home` tuşlarının topoloji nesnesi seçmeden veya görünümü sıfırlamadan doğrudan not metnine karakter ve imleç hareketi olarak yansıması sağlandı. `useKeyboardShortcuts` capture dinleyicisinde `isEditable` alanı genişletilerek `data-note-id`, `input`, `textarea` odaklanmaları tam koruma altına alındı.

## v3.7.0 — 2026-08-31

**Rehberli Ders & Sınav Modu Quiz ve PDF Sertifika Güncellemesi** — 19 rehberli ders konusuna özel 2-3 soruluk bilgi quiz'leri entegre edildi ve canlı puan sistemine bağlandı. PDF sertifika oluşturucu Canvas High-DPI Türkçe karakter (Ş, İ, Ğ, Ç, Ö, Ü) motoru ile yenilendi ve PDF dosya boyutu ~150KB seviyesine düşürüldü. Rehberli Dersler ana sekme yapıldı. CLI komut ayrıştırıcı (parser) mod eşleşme döngüsü güncellenerek extended/standard ACL ve `mls qos` mod çakışmaları çözüldü.

## v3.5.0 — 2026-08-29

Görev yöneticisi pencere listesi modernleştirildi; eksik örnek açıklamalarına not ve detaylar eklendi. OSPF, RIP ve ACL arıza örneklerine komut ipuçları eklendi. ROAS alt arayüzleri ve örnek topoloji kablo durumları düzeltildi. NTP istemci zamanı ile Linux terminal `date` komutu ve canvas not sürükleme davranışı iyileştirildi.

**IP SLA Active Probes & QoS Queue Scheduling** — Sentetik IP SLA `icmp-echo`/`jitter` prob motoru, RTT min/avg/max, jitter ve timeout istatistikleri ile `show ip sla statistics` desteği eklendi. QoS için deterministik WFQ, LLQ ve CBWFQ kuyruk simülasyonu, doygunlukta paket düşürme ve sınıf bazlı sayaçlar uygulandı. IP SLA ve QoS davranışları için otomatik testler eklendi.

**MSTP BPDU Engine başlangıcı** — CIST root seçimi, MSTI M-record üretimi, bölge adı/revizyon/digest karşılaştırması ve bölge sınırı algılama eklendi; testleri oluşturuldu.

**802.1X, IPsec ve SDN/YANG altyapısı** — `dot1x system-auth-control`, interface port-control, EAPOL state machine ve RADIUS sonucu simülasyonu; IKE Phase 1/2 SA ile ESP protocol 50 kapsülleme; YANG parser ve NETCONF/RESTCONF tarzı SDN controller datastore eklendi. MQC `class-map`, `policy-map` ve `service-policy` komutları stub durumundan çıkarıldı.

**Ağ Entegrasyon Düzeltmeleri** — LLDP neighbor detail çıktısı artık bağlı cihazın gerçek chassis ID ve management IP değerlerini kullanıyor. HSRP/VRRP sanal IP’leri aktif/master cihaza çözümleniyor. DHCP broadcast’leri helper adresine yönlendiriliyor ve DHCP snooping yalnızca UDP 67/68 veya açık DHCP mesajlarında untrusted portları engelliyor.

## v3.4.0 — 2026-08-28

| Tarih | Değişiklik |
|---|---|
| 2026-08-28 | **Sürüm 3.4.0 Yayınlandı: SSH Tam Akışı, Subnetting Yardımcısı & Cihaz Penceresi UI Düzeltmeleri** — SSH uçtan uca yapılandırma zinciri (`crypto key generate rsa modulus 2048` → `ip ssh version 2` → `username ... privilege 15 secret ...` → `line vty 0 4` → `login local` → `transport input ssh`) doğrulandı ve `username` komutundaki parola ayrıştırma hatası giderildi; PC terminalinden `ssh <kullanıcı>@<ip>` ile başarılı oturum simülasyonu sağlandı. IP adresi girişinde network/broadcast/kullanılabilir host aralığını gösteren etkileşimli **Subnetting Yardımcısı** paneli eklendi ve `show ip interface brief` çıktısı subnet bilgisiyle zenginleştirildi. Switch/Router/WLC cihaz pencerelerinde CLI geçmiş kaydırma çubuğunun yeniden boyutlandırma tutamaçlarının altında kalması sorunu giderildi (içerik alanına alt/sağ iç boşluk eklendi). |

## v3.3.0 — 2026-08-27

| Tarih | Değişiklik |
|---|---|
| 2026-08-27 | **Sürüm 3.3.0 Yayınlandı: Gelişmiş Linux Bash Shell & Standart Modüler Pencere UI/UX** — Linux Terminaline `for` döngüleri, `if/else` koşul blokları, Pipe (`|`) boru hattı, Çıktı yönlendirmeleri (`>` ve `>>`), `grep` ve `wc` filtreleme komutları entegre edildi. `ping 127.0.0.1` döngü adresi denetimi ve `chmod -x` izin kaldırma mantığı giderildi. CMD `Ctrl+L` ekran temizleme düzeltildi. Tüm uygulama pencerelerine (`ModernPanel`, `TeacherRoomPanel`, `RoomJoinDialog`, `BasarilarimPanel`, `DialogContent`) kırmızı daire içinde beyaz `X` simgeli standart modüler kapatma butonları uygulandı. |

## v3.2.0 — 2026-08-27

| Tarih | Değişiklik |
|---|---|
| 2026-08-27 | **Gelişmiş Linux Bash Terminali & Ağ Protokol / İzin Entegrasyonları** — Linux Terminal sekmesine (`CommandLineTab`) `ftp`, `ssh`, `telnet` ağ servisi bağlantı komutları, komut geçmişini listeleyen `history`, dosya çalışma izinlerini yöneten `chmod` (`+x`, `-x`, `755`, `644`) ve sahiplik komutu `chown` eklendi. `ls -l` çıktısında `-rwxr-xr-x` izinleri ve Sade `ls` görünümünde `*` belirteci desteklendi. `chmod +x` yetkili `.sh` ve `.py` betiklerinin `./script.sh` şeklinde doğrudan çalıştırılabilmesi ve çalıştırma izni yoksa `Permission denied` denetimi sağlandı. Cihaz yeniden başlatıldığında Linux çıktısının sıfırlanması ve `Ctrl+L` ekran temizleme kısayolu entegre edildi. |
|---|---|
| 2026-08-25 | **PC Python Yorumlayıcısı Liste Üretimi (List Comprehension `[expr for var in iter if cond]`) Desteği** — `[x.strip() for x in content_list]`, `[x**2 for x in range(10) if x % 2 == 0]` ve demet/tuple açılımlı (`[(a, b) for a, b in zip(...)]`) liste üretimi yapıları entegre edildi. Koşul ifadeleri (`if`), üyelik kontrolleri ve üs alma (`**`) operatörü ile tam uyumlu çalışması sağlandı. Varsayılan dosya sistemine `data_file.txt` eklendi. |
| 2026-08-25 | **PC Python Sanal Dosya Sistemine Varsayılan `names.txt` ve `body.txt` Entegrasyonu** — Mail birleştirme (`Mail Merger`) betiklerinin doğrudan çalışabilmesi için varsayılan sanal dosya sistemine (`pcFileSystem`) `names.txt` ve `body.txt` dosyaları eklendi. `with open(...)` bloklarının dosya oluşturma (`'w'`), okuma (`'r'`) ve satır yineleme davranışları doğrulanarak test edildi. |
| 2026-08-25 | **PC Python Yorumlayıcısı `glob` Modülü ve `os.chdir()` Dosya Arama Desteği** — `glob.glob(pattern)` dosya deseni eşleme modülü entegre edildi (`*.py`, `*.txt` vb.). `os.chdir(path)`, `os.getcwd()`, `os.listdir()` dizin gezinti metotları sanal dosya sistemi (`pcFileSystem`) ile dinamik olarak bağlandı. Tek bir `import glob, os` satırında virgülle ayrılmış çoklu modül aktarımları desteklendi. |
| 2026-08-25 | **PC Python Yorumlayıcısı Metin ve Liste Dilimleme (`[start:stop:step]`) Desteği** — Metin (`str`) ve Liste (`list`) veri tiplerinde dilimleme (slicing) yapısı entegre edildi. `s[1:]`, `s[:5]`, `s[1:4]`, `s[::-1]` (ters çevirme) ve `my_string[0].upper() + my_string[1:]` (baş harfi büyütme) gibi tüm dilimleme kombinasyonları ve operatör işlem sırası (precedence) desteklendi. |
| 2026-08-25 | **PC Python Yorumlayıcısı `enumerate()` ve `zip()` Dahili Fonksiyon Desteği** — `enumerate(iterable, start=0)` dahili fonksiyonu ve `start` adlandırılmış parametresi entegre edildi. Birden fazla diziyi eş zamanlı yineleyen `zip(*iterables)` dahili fonksiyonu eklendi. `for index, val in enumerate(my_list, start=1):` gibi döngü açılımları desteklendi. |
| 2026-08-25 | **PC Python Yorumlayıcısı Sözlük Birleştirme (`|` ve `|=`) Desteği** — `{key: val}` sözlük değişmezlerinin (dict literal) ayrıştırılması geliştirildi. Python sözlük birleştirme operatörü (`dict_1 | dict_2`) ve birleşik atama operatörü (`dict_1 |= dict_2`) eklendi. Sözlüklerin sayısal ve metin anahtarlarının temsil çıktıları Python standartlarına uyumlu hale getirildi. |
| 2026-08-25 | **PC Python Yorumlayıcısı Sanal Dosya Okuma/Yazma (`open()` / `with open()`) Desteği** — Python Betik çalıştırıcısına sanal dosya sistemi (`pcFileSystem`) entegre edildi. `open(filename, mode, encoding)`, `with open(...) as f:` blok yapısı, `f.read()`, `f.readline()`, `f.readlines()`, `f.write()`, `f.writelines()`, `f.close()` metotları ve `for line in file:` satır yineleme desteği sağlandı. Mail birleştirme (`Mail Merger`) gibi dosya tabanlı tüm Python betikleri desteklendi. |
| 2026-08-25 | **PC Python Yorumlayıcısı Sözlük (Dict) ve Üyelik Operatörü Geliştirmeleri** — `{}.fromkeys()` / `dict.fromkeys()`, `.get()`, `.keys()`, `.values()`, `.items()`, `.pop()`, `.clear()`, `.copy()`, `.setdefault()`, `.update()` sözlük metotları eklendi. `in` ve `not in` operatörlerinin sözlükler (`dict`) ve kümeler (`set`) üzerinde anahtar varlık kontrolü yapabilmesi sağlandı. `{}` boş sözlük değişmezi düzeltildi. |
| 2026-08-25 | **Paket Analiz Paneline HTTP, Mail, FTP ve DNS Hizmet İstekleri Entegrasyonu** — Canlı Paket Yakalama (Packet Capture) paneline `HTTP` (Web tarayıcı/curl/wget), `SMTP` / `POP3` (E-posta gönderme ve alma), `FTP` (Dosya transferi STOR/RETR), `DNS` (Alan adı sorguları) hizmet paketleri entegre edildi. Protokol sütununa `HTTP (80)`, `FTP (21)`, `SMTP (25)`, `POP3 (110)`, `DNS (53)` port numaraları ve özel protokol renk rozetleri eklendi. |
| 2026-08-25 | **Kullanıcı Tanımlı Batch (.bat / .cmd) Yığın Dosyası Desteği & Düzenleyici Entegrasyonu** — PC Komut İstemi'nde (CMD) kullanıcı tanımlı `.bat` ve `.cmd` dosyalarını çalıştırma, `@echo off`, `set VAR=value`, `%VAR%`, `%0`..`%9`, `%*`, `goto :etiket` ve `call` ile iç içe yığın dosyası çağırma desteği eklendi. Dosya Düzenleyici penceresinin başlığına `Batch Yığın Dosyası` rozeti ve editörden doğrudan kaydetip CMD'de çalıştırma (Play butonu) entegre edildi. |
| 2026-08-24 | **PC Python Yorumlayıcı İyileştirmeleri** — `def` fonksiyonlarında default parametre desteği, `is` / `is not` karşılaştırma operatörleri, liste eleman takası (`a[i], a[j] = a[j], a[i]`), string metotları (`.lower()`, `.upper()`, `.strip()`, `.replace()`, `.split()` vb.), string'lerde `sorted()`, ve `for a, b in ...` çoklu değişken açılımı (tuple unpacking) eklendi. Async modda özyinelemeli fonksiyonların `Promise` döndürme hatası giderilerek doğru sonuçlar elde edildi. |

## v2.9.0 — 2026-08-24

| Tarih | Değişiklik |
|---|---|
| 2026-08-24 | **Çoklu Cihaz Penceresi Kısayolları** — `Tab` ile cihaz odaklama, `Shift+Tab` ile açık pencere değiştirici, `Ctrl+M` ile etkin pencereyi küçültme ve alt çubuktan tıklanabilir kısayol çalıştırma eklendi. Pencere geri yükleme akışı iyileştirildi. |

## v2.8.0 — 2026-08-22

| Tarih | Değişiklik |
|---|---|
| 2026-08-22 | **Sürüm Yükseltmesi (v2.8.0)** — Ağ Yenileme Raporu penceresine koyu/açık tema sürükleme (drag-and-drop) ve çift tıkla daraltma desteği eklendi. Olay günlüğü rozeti renk uyumu sağlandı. Örnek projelerdeki taban MAC çakışmaları ve cihaz kapatıp açma durumunda MAC adresinin korunması sağlandı. Çift yönlü arama ile ACL filtresi ve `access-list` Global Konfigürasyon mod desteği entegre edildi. |

---

## v2.7.0 — 2026-08-21

| Tarih | Değişiklik |
|---|---|
| 2026-08-21 | **Sürüm Yükseltmesi (v2.7.0)** — Dokümantasyondaki 18 eksik özellik tam olarak belgelendi. `PC_CMD_REFERENCE.md`, `PACKET_CAPTURE_GUIDE.md` ve `TOPOLOGY_GENERATOR.md` oluşturuldu. Tüm kılavuzlar ve kitapçık v2.7.0'a göre güncellendi. Örnek uygulama projeleri sayısı 46'ya çıkarıldı. |

---

## v2.6.0 — 2026-08-20

| Tarih | Değişiklik |
|---|---|
| 2026-08-20 | **Sürüm Yükseltmesi (v2.6.0)** — Uygulama versiyonu v2.6.0 olarak güncellendi, derleme ve test doğrulamaları yapıldı. |

---

## v2.5.0 — 2026-08-19

| Tarih | Değişiklik |
|---|---|
| 2026-08-19 | Switch/router arayüz komutları ve PC CMD ARP yönetimi iyileştirildi; kullanılmayan wireless kodu temizlendi ve type-check düzeltildi. |

---

## v2.4.0 — 2026-08-19

| Tarih | Özellik |
|-------|---------|
| 2026-08-19 | **Arka Plan Ağ Hareketliliği Yakalama** — İstemci DHCP IP alma adımları (`DHCP Discover`, `DHCP Offer`, `DHCP Request`, `DHCP ACK`), `STP BPDU` döngü engelleme paketleri, periyodik `CDP`, `OSPF Hello`, `RIP`, `EIGRP` ve `WLAN Beacon` paketleri canlı Paket Yakalama paneline bağlandı. |
| 2026-08-19 | **Paket Yakalama Arama ve Sayfalama Desteği** — Paket yakalama paneline canlı IP/protokol/içerik arama çubuğu ve sayfa başına 10 paket gösteren gezinti (pagination) sistemi eklendi. |
| 2026-08-19 | **Paket Yakalamada Çoklu Dışlama Filtresi (Multi-term Exclude)** — Dışlama alanına virgül/boşluk ile ayrılmış çoklu terimler (`cdp, stp, arp` vb.) girilerek istenmeyen paketlerin anlık gizlenebilmesi sağlandı. |
| 2026-08-18 | **Sürüm Yükseltmesi (v2.4)** — Uygulama versiyonu 2.4'e yükseltildi. |
| 2026-08-18 | **Paket Analizinde Protokol Numarası Gösterimi** — Paket analizi panelindeki protokol sütununda, her protokolün port/protokol numarası parantez içinde gösteriliyor: ICMP (1), ICMPv6 (58), TCP (6), UDP (17), GRE (47), OSPF (89), EIGRP (88), ARP (0x0806), RARP (0x8035), STP (0x4242). |
| 2026-08-18 | **Pencere Başlığı Çift Tıklama ile Daraltma/Genişletme (Toggle Collapse)** — PC Paneli, Router Bilgi Paneli, Paket Analizi / Yakalama ve Ağ Yenileme Raporu pencerelerinin başlık çubuğuna çift tıklandığında pencereyi hızlıca küçültme/büyütme desteği eklendi. |
| 2026-08-18 | **CLI Geçmiş Paneli Tıklama Odaklanması** — Terminal ve PC CMD ekranlarında çıktı / geçmiş alanına tıklandığında komut yazma kutusunun (input) otomatik olarak odaklanması (`focus`) sağlandı. |
| 2026-08-18 | **Trunk İzinli VLAN Desteği (`switchport trunk allowed vlan`)** — `switchport trunk allowed vlan 10,20`, `10-20`, `add`, `remove`, `except` ve `all` sözdizimleri ile VLAN filtreleme, simülasyon ve PVST Spanning Tree hesaplamalarına entegre edildi. |
| 2026-08-18 | **Paket Yakalamada ARP İstek ve Yanıt Entegrasyonu** — Sağ tık ile başlatılan ping işlemlerinde, hedef MAC adresi önbellekte yoksa `ARP Request (Broadcast)` ve `ARP Reply` paketlerinin kablo paket yakalama (Packet Capture) tablosuna otomatik işlenmesi doğrulandı ve optimize edildi. |

---

## v2.2.0 — 2026-08-15

| Tarih | Özellik |
|-------|---------|
| 2026-08-15 | **Sürüm Yükseltmesi (v2.2)** — Uygulama versiyonu 2.2'ye yükseltildi; Next.js 16.2.4, React 19.2.5, TypeScript 6.0.3 ve Tailwind CSS 4.2.2 paketleri güncellendi. |
| 2026-08-15 | **Ping & Paket Animasyonu İyileştirmeleri** — Ping animasyonu oynatma/duraklatma ve paket ilerleme mantığındaki senkronizasyon hataları giderildi. |
| 2026-08-15 | **Pencere & Başlık Görsel Optimizasyonları** — Başlık rengi, tema geçişleri, Toolbar başlığı ve fare etkileşimleri (hover/drag) daha akıcı hale getirildi. |
| 2026-08-15 | **Topoloji ve Çizim Performansı** — `ConnectionLine` özel memo karşılaştırıcısı ve topoloji çizim döngüsü optimize edilerek yüksek cihaz sayılarında FPS artışı sağlandı. |
| 2026-08-15 | **CLI Parser & Arayüz İyileştirmeleri** — `parser.ts`, `interfaceCommands.ts` ve cihaz panelleri (PCPanel vb.) modüler hale getirilip temizlendi. |
| 2026-08-17 | **PC CMD Parametre Desteği** — `ping` (-n, -l, -w, -a, -t, -4/-6), `tracert` (-d, -h, -w, -4/-6), `nbtstat` (-n, -c, -r, -R, -RR, -S, -s, -a/-A/-L), `netstat` (-a, -n, -o, -p, -r, -s, -e), `arp` (-a, -g, -v, -d, -s) ve `nslookup` (-type, ters/PTR çözümleme, sunucu seçimi) komutları için Windows tarzı parametreler eklendi. |

---

## v2.0.1 — 2026-08-01

| Tarih | Özellik |
|-------|---------|
| 2026-08-01 | **Genel Bakım ve Hata Düzeltmeleri** — Bağlantı render optimizasyonu (ConnectionLine memo comparator), bellek optimizasyonları ve kod temizliği yapıldı. |
| 2026-07-28 | **Proje Açıklamaları & Topoloji Şablonları** — 12 yeni topoloji şablonu ve detaylı proje açıklamaları güncellendi. |

---

## v2.0.0 — 2026-07-20

| Tarih | Özellik |
|-------|---------|
| 2026-07-20 | **İsim ve Marka Güncellemesi** — Proje adı "NetworkSimulator" olarak güncellendi ve tüm markalama buna göre düzenlendi. |
| 2026-07-20 | **LocalStorage Güvenliği (XOR+Base64)** — Yerel depolama verileri, tüm uygulamayı kapsayan bir interceptor aracılığıyla (XOR ve Base64 kullanarak) şifrelendi; geriye dönük uyumluluk eklendi. |
| 2026-07-20 | **Metin Limiti ve XSS Koruması** — İsim ve proje açıklama alanları için aşırı uzun girdileri engelleyecek otomatik karakter limitleri ve anti-XSS (`<`, `>` filtrelemesi) korumaları aktif edildi. |
| 2026-07-20 | **Gelişmiş Topoloji Üretimi** — "Topoloji Üret" sihirbazına arama işlevi eklendi; üretilen şablonlar kendi özgün proje başlıklarını ve açıklamalarını özet notlarına otomatik olarak ekliyor. |

---

## v1.9.9 — 2026-07-18

| Tarih | Özellik |
|-------|---------|
| 2026-07-18 | **Minör Güncelleme** — Hata düzeltmeleri, stabilite artışı ve genel performans iyileştirmeleri |

---

## v1.9.8 — 2026-07-16

| Tarih | Özellik |
|-------|---------|
| 2026-07-12 | **Daraltılabilir Bilgi Panelörleri** — PC ve Router bilgilendirme popup'ları artık daraltılabilir; bölümler (WiFi, Servisler, IP Modu, vb.) tek tıkla gizlenip gösterilebilir ve durum localStorage'da saklanır |
| 2026-07-12 | **Daraltılabilir Ağ Yenileme Raporu Paneli** — Ağ yenileme raporu panelini (Ağ Yenilendi) artık daraltılabilir; başlık düğmesiyle genişletme/daraltma mümkün ve durum localStorage'da saklanır |
| 2026-07-16 | **Sürüm Güncellemesi** — Uygulama versiyonu 1.9.7'den 1.9.8'e yükseltildi |

---

## v1.9.7 — 2026-07-12

| Tarih | Özellik |
|-------|---------|
| 2026-07-12 | **Minör Güncelleme** — Arayüzdeki ufak hataların giderilmesi ve altyapı iyileştirmeleri |

---

## v1.9.6 — 2026-07-08

| Tarih | Özellik |
|-------|---------|
| 2026-07-08 | **"Bana Öğret" Rehberli Dersleri** — Sıfırdan öğretim için 3 yeni rehberli proje: Temel (PC ipconfig, switch enable/configure terminal/hostname), Orta (router IP yapılandırma) ve İleri (OSPF + ACL) seviyeleri |
| 2026-07-08 | **PC Tabanlı Arıza Giderme** — Arıza tanımı artık `pc.` ön eki ile PC özelliklerini (IP, gateway, DNS, hostname vb.) doğrulayabiliyor; TroubleshootingPanel `topologyDevices` üzerinden PC arızalarını çözüyor |
| 2026-07-08 | **Otomatik Komut Yazdırma** — `pc-auto-type` olayı ile dışarıdan komutların karakter karakter PC CMD'ye yazdırılması ve otomatik çalıştırılması desteği |
| 2026-07-08 | **Yeni Pencere Olayları** — `pc-tab-changed` ve `pc-command-executed` olayları ile PC paneli durumu dış bileşenlere bildiriliyor |

---

## v1.9.5 — 2026-07-07

| Tarih | Özellik |
|-------|---------|
| 2026-07-07 | **Sektörel Senaryolar** — SOHO, Okul Kampüsü, Hastane, E-Ticaret; çok adımlı doğrulama |
| 2026-07-07 | **Sesli Anlatım (TTS)** — Rehberli Modda "Sesli Dinle" butonu; konuşma sentezi desteği |
| 2026-07-07 | **PDF Sertifikaları** — Lab tamamlandığında öğrenci adı ve puanını içeren otomatik sertifika üretimi |
| 2026-07-07 | **Gelişmiş Arıza Giderme** — Trunk yapılandırma hataları ve OSPF alan uyumsuzlukları için "Bul ve Düzelt" görevleri |
| 2026-07-07 | **IPv6 Master Lab** — OSPFv3 ve IPv6 ACL içeren kapsamlı dual-stack senaryosu |
| 2026-07-07 | **Mobil PNG Dışa Aktarma** — Web Share API ile mobil paylaşım ve bellek optimizasyonu |
| 2026-07-07 | **Gelişmiş Kablo Bağlantı Deneyimi** — `onPointerDown` ile porttan porta tıklayarak kablo bağlama kararlı hale getirildi |
| 2026-07-07 | **Gelişmiş İşlem Geçmişi (Timeline)** — Scroll desteği, ayrıntılı bildirimler, `.txt` dışa aktarma, localStorage kalıcılığı |

---

## v1.9.4 — 2026-07-04

| Tarih | Özellik |
|-------|---------|
| 2026-07-04 | **Minör Güncelleme** — Küçük UI iyileştirmeleri ve performans optimizasyonları |

---

## v1.9.3 — 2026-06-30

| Tarih | Özellik |
|-------|---------|
| 2026-06-30 | **PNG 300 DPI Export** — Topolojiye sadık yüksek çözünürlüklü dışa aktarma; cihaz görselleri, kablo renkleri, port etiketleri, notlar |
| 2026-06-30 | **Kablo Kes/Onar** — Unplug/PlugZap ikonları; cihazlarda güç durumu simgeleri |
| 2026-06-30 | **Protokol Durum Paneli** — OSPF/STP/HSRP/EIGRP durumu "Özet" sekmesine entegre edildi; ayrı yüzen panel kaldırıldı |
| 2026-06-30 | **Ağ Durum Paneli** — Header üzerinde sabit z-index, taşma kaydırma, mobilde sabit, ekran dışı güvenli konumlandırma |
| 2026-06-30 | **Sürükleme Düzeltmesi** — Cihaz taşırken kablo bağlantı noktaları artık kaymıyor; port pozisyonları normalize edildi |
| 2026-06-30 | **UI Temizliği** — Mobil cihaz ekle butonu kaldırıldı; mobil ağ durum paneli sürüklenemez |
| 2026-06-30 | **FTP Servisleri** — FTP istemci/sunucu yapılandırması, dosya yükleme ve cihazlar arası aktarım simülasyonu |
| 2026-06-30 | **NTP Zaman Senkronizasyonu** — Ağ genelinde zaman senkronizasyonu için NTP sunucu/istemci |
| 2026-06-30 | **Mail Servisleri** — Topoloji içi e-posta gönderme, alma ve posta kutusu simülasyonu |
| 2026-06-30 | **Güvenlik Duvarı Servis Entegrasyonu** — Trafik filtreleme için entegre servis seçimli güvenlik duvarı kuralları |
| 2026-06-30 | **Kablosuz Gösterge Paneli** — SSID ve güvenlik yönetimi ile özel kablosuz cihaz ana sayfası |
| 2026-06-30 | **IoT Panel Sekmeleri** — Sensörler, aktüatörler ve cihaz ayarları için sekmeli IoT paneli |
| 2026-06-30 | **Sensör Geliştirmeleri** — Hareket sensörü yarıçap görselleştirmesi, fare ayarlanabilir ses sensörü menzili, lamba ikonu |
| 2026-06-30 | **Pencere Notları** — Daraltılabilir bölümler ve not alma özelliği ile yeniden boyutlandırılabilir pencereler |
| 2026-06-30 | **API Hız Sınırlama** — İletişim formu API hız sınırlaması; kötüye kullanım önleme |
| 2026-06-30 | **Tarayıcı Penceresi ESC Kapatma** — Web tarayıcı penceresi ESC ile kapanır, PC paneli etkilenmez |
| 2026-06-30 | **Pencere Snap Kaldırma** — PC/Switch/Router/Firewall pencereleri ekran kenarlarına snap olmaz |
| 2026-06-30 | **PC Geçmiş Temizliği** — Yeni ve açılan projelerde önceki cmd/CLI geçmişi sıfırlanır |

---

## v1.9.2 — 2026-06-28

| Tarih | Özellik |
|-------|---------|
| 2026-06-28 | **Minör Güncelleme** — Geri bildirimler doğrultusunda stabilite güncellemeleri |

---

## v1.9.1 — 2026-06-25

| Tarih | Özellik |
|-------|---------|
| 2026-06-25 | **Minör Güncelleme** — Yayın sonrası ilk hata düzeltmeleri ve minör optimizasyonlar |

---

## v1.9.0 — 2026-06-21

| Tarih | Özellik |
|-------|---------|
| 2026-06-21 | **Başarım Sistemi** — Projeler, rehberli dersler ve sınavlar için aktivite takibi; oturum süresi günlüğü |
| 2026-06-21 | **Sınav Modu** — Öğretmen sınav düzenleyicisi, projeden sınava dönüşüm, mobil uyumlu düzen, güvenli öğrenci dağıtımı |
| 2026-06-21 | **Rehberli Mod & Eğitim Sihirbazı** — Puan, ilerleme takibi ve ipucu sistemi ile adım adım rehberli dersler |
| 2026-06-21 | **Akıllı CLI Asistanı** — Fuzzy-matched komut önerileri; CLI hata mesajlarının altında alt komut ipuçları |
| 2026-06-21 | **Sınav İçe Aktarma İyileştirmeleri** — `.json` / `.exam` içe aktarma; akıllı PC IP çıkarma, bağlantı ayrıştırma, ağırlıklı puanlama |
| 2026-06-21 | **PC Servis Kalıcılığı** — DHCP, DNS, HTTP servis yapılandırmaları ağ yenilemelerinde korunur |
| 2026-06-21 | **WLC & AP Yönetimi** — Lightweight AP desteği, dot11 WLAN yapılandırması, AP katılımı, auth-mac filtreleme |
| 2026-06-21 | **Seri / WAN Arayüzleri** — HDLC ve PPP kapsülleme, clock rate, PAP/CHAP kimlik doğrulama, DCE/DTE tespiti |
| 2026-06-21 | **Gelişmiş Yönlendirme** — EIGRP (named/config), BGP (temel), OSPFv3 (IPv6), RIPng (IPv6), rota yeniden dağıtımı |
| 2026-06-21 | **IoT & Güvenlik Duvarı CLI** — IoT sensör/aktüatör yönetimi ve güvenlik duvarı kural/politika yapılandırması CLI komutları |
| 2026-06-21 | **Yardım Sistemi Revizyonu** — Kapsamlı CLI komutları; iki dilli yardım paneli; cihaz bağlamına göre düzenli |
| 2026-06-21 | **Kanvas Sürükleme Pürüzsüzlüğü** — Frame başına taze DOM rect; SVG geçişleri hareket sırasında devre dışı |
| 2026-06-21 | **Türkçe Eğitim Kitapçığı** — Ağ temelleri, CLI, yönlendirme, WAN, kablosuz ve güvenlik konularını kapsayan kapsamlı kitapçık |
| 2026-06-21 | **Seri Kapsülleme** — Bağlantı kontrollerinde HDLC/PPP uyumsuzluğu tespiti |
| 2026-06-21 | **No Hostname Komutu** — `no hostname` ile cihaz hostname'i varsayılana sıfırlama |
| 2026-06-21 | **Oda Takip Sistemi** — Oda kodları ve Vercel KV (Redis) ile gerçek zamanlı öğretmen-öğrenci ilerleme takibi |
| 2026-06-21 | **ACL Standard & Extended** — Trafik filtreleme ve güvenlik politikaları için standart ve genişletilmiş ACL |
| 2026-06-21 | **NAT (Static/Dynamic/PAT)** — Statik birebir, dinamik havuz ve PAT overload desteği |
| 2026-06-21 | **HSRP Yedeklilik** — Varsayılan ağ geçidi yedekliliği ve arıza geçişi için HSRP |
| 2026-06-21 | **OSPF Multi-Area** — Area 0, Area 10, Area 20 ve stub alan yapılandırması |
| 2026-06-21 | **EIGRP Dinamik Yönlendirme** — Named/config modu ile EIGRP |
| 2026-06-21 | **IPv6 Gelişmiş Lab** — IPv6 adresleme, DHCPv6 havuzları, OSPFv3 |
| 2026-06-21 | **Tüm Servisler Laboratuvarı** — DNS, HTTP, DHCP, FTP, MAIL ve NTP servislerini içeren kapsamlı lab |
| 2026-06-21 | **Google Sheets Entegrasyonu** — Apps Script API ile iletişim formu verilerinin Google Sheets'e aktarımı |
| 2026-06-21 | **Redis / KV Depolama** — Upstash Redis ile oda takibi oturum kalıcılığı ve gerçek zamanlı senkronizasyon |

---

## Temel Özellikler (İlk Sürüm)

| Özellik |
|---------|
| **Ağ Tuvali** — Sürükle-bırak topoloji oluşturucu; Router, Switch, PC, Laptop, Server, IoT, Wireless cihaz paleti |
| **CLI Motoru** — enable modu, configure terminal, interface config; kapsamlı komut desteği |
| **Switching** — VLAN, STP, trunk/access portları, MAC öğrenmesi, switchport güvenliği |
| **Yönlendirme** — Statik rotalar, OSPF, RIP; VLAN'lar arası yönlendirme; L3 anahtarlama |
| **DHCP / DNS** — DHCP sunucu-istemci, adres havuzları; DNS ad çözümleme |
| **ARP** — ARP tablosu yönetimi, MAC-IP çözümleme |
| **Link-Local** — Otomatik link-yerel adresleme (169.254.x.x) |
| **Bağlantı Testi** — Ping, traceroute, genişletilmiş ping |
| **JSON Serileştirme** — Ağ topolojilerini JSON olarak kaydet/yükle |
| **CLI Geçmişi** — Yukarı/aşağı ok ile komut geçmişi navigasyonu |
| **Fuzzy Matching** — Yazım hatası toleranslı akıllı komut eşleştirme |
| **Pipe Desteği** — Komut çıktısı yönlendirme ve filtreleme |
| **Context-Aware Yardım** — Cihaz bağlamına göre alt komut önerileri ve sözdizimi ipuçları |
| **Türkçe / İngilizce** — Tam iki dilli arayüz desteği |
| **Sürüklenebilir Pencereler** — Yeniden boyutlandırılabilir ve sürüklenebilir diyalog pencereleri |
| **Toast Bildirimleri** — Rahatsız etmeyen bildirim sistemi |
| **Klavye Kısayolları** — Tüm işlemler için tam klavye desteği |
| **ARIA / Erişilebilirlik** — ARIA etiketleri, ekran okuyucu desteği, yüksek kontrast modu |
| **Responsive Tasarım** — Mobil uyumlu düzen, adaptif kırılım noktaları |
| **Örnek Projeler** — Kılavuzlarla birlikte 46 önceden oluşturulmuş örnek proje |
| **Geri Alma / İleri Alma** — Tuval geçmişi takibi ile undo/redo |
| **Proje Kalıcılığı** — Tarayıcı depolama ile kaydet/yükle |

---

## İstatistikler (arşivlenmiş v2.0.0 özeti)

> Aşağıdaki değerler v2.0.0 dönemine aittir; güncel proje sayıları için README ve kaynak ağacını esas alın.

| Metrik | Değer |
|--------|-------|
| Toplam Kaynak Satırı (src/) | 103.245 |
| Kaynak Dosya | 286 |
| Dokümantasyon Dosyası | 16 |
| Örnek Proje | 46 |
| Rehberli Ders | 19 |
| Sınav | 6 |
| CLI Komutu | 450+ |
| Test Dosyası | 45 |
| Geçen Test | 517 |

---

*Bu dosya [doc/history.md](history.md) — Network Simulator proje değişiklik günlüğü.*
