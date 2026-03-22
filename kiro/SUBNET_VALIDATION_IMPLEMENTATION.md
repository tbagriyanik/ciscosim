# Subnet Doğrulama - Farklı Subnet'te Ping Engelleme

## Genel Bakış
Farklı subnet'te olan cihazlara ping atamamalı. Ping başarılı olması için:
1. Aynı subnet'te olmalı VEYA
2. Path'te routing etkin olan bir router olmalı

## Uygulanan Değişiklikler

### 1. checkConnectivity Fonksiyonunda Subnet Kontrolü
Pathfinding'den sonra, VLAN kontrolünden önce subnet kontrolü yapılır:

```typescript
// 2.5. Check subnet compatibility (Layer 3)
const sourceDeviceForSubnet = devices.find(d => d.id === sourceId);
if (sourceDeviceForSubnet && targetDevice) {
  const sourceIp = sourceDeviceForSubnet.ip;
  const sourceSubnet = sourceDeviceForSubnet.subnet || '255.255.255.0';
  const targetIp_check = targetDevice.ip;
  const targetSubnet = targetDevice.subnet || '255.255.255.0';

  // Check if source and target are in the same subnet
  const isInSameSubnet = isIpInSubnet(sourceIp, targetIp_check, sourceSubnet);

  if (!isInSameSubnet) {
    // Different subnets - check if there's a router with routing enabled
    let hasRouter = false;
    for (const deviceId of path) {
      const device = devices.find(d => d.id === deviceId);
      const state = deviceStates?.get(deviceId);
      if (device?.type === 'router' && state?.ipRouting) {
        hasRouter = true;
        break;
      }
    }

    if (!hasRouter) {
      return {
        success: false,
        hops: path.map(id => devices.find(d => d.id === id)?.name || id),
        error: `Subnet uyumsuzluğu: Kaynak ${sourceIp}/${sourceSubnet}, Hedef ${targetIp_check}/${targetSubnet}. Router ile routing gerekli.`
      };
    }
  }
}
```

### 2. getPingDiagnostics Fonksiyonunda Subnet Kontrolü
Subnet uyumsuzluğu varsa, hemen başarısız olur:

```typescript
// 5. Check subnet compatibility
const sourceSubnet = sourceDevice.subnet || '255.255.255.0';
const targetSubnet = targetDevice.subnet || '255.255.255.0';

const isSourceInSameSubnet = isIpInSubnet(sourceIp, targetIp, sourceSubnet);
const isTargetInSameSubnet = isIpInSubnet(targetIp, sourceIp, targetSubnet);

if (!isSourceInSameSubnet && !isTargetInSameSubnet) {
  reasons.push(`Subnet uyumsuzluğu: Kaynak ${sourceIp}/${sourceSubnet}, Hedef ${targetIp}/${targetSubnet}. Router ile routing gerekli.`);
  return { success: false, reasons };
}
```

## Kontrol Sırası

1. ✅ Kaynak cihaz var mı?
2. ✅ Kaynak cihaz açık mı?
3. ✅ Kaynak IP var mı?
4. ✅ Hedef IP var mı?
5. ✅ Hedef cihaz açık mı?
6. ✅ **Subnet uyumlu mu?** (YENİ)
7. ✅ Fiziksel bağlantı var mı?
8. ✅ Interface'ler açık mı?
9. ✅ VLAN uyumlu mu?
10. ✅ Routing yapılandırılmış mı?

## Senaryo Örnekleri

### Senaryo 1: Aynı Subnet'te - Başarılı
```
PC-1: 192.168.1.10/24
PC-2: 192.168.1.20/24
→ Ping başarılı
```

### Senaryo 2: Farklı Subnet'te, Router Yok - Başarısız
```
PC-1: 192.168.1.10/24
PC-2: 192.168.2.20/24
Path: PC-1 → Switch → PC-2 (Router yok)
→ Ping başarısız
→ Hata: "Subnet uyumsuzluğu: Kaynak 192.168.1.10/255.255.255.0, Hedef 192.168.2.20/255.255.255.0. Router ile routing gerekli."
```

### Senaryo 3: Farklı Subnet'te, Router Var - Başarılı
```
PC-1: 192.168.1.10/24
PC-2: 192.168.2.20/24
Path: PC-1 → Switch → Router (IP Routing: ON) → Switch → PC-2
→ Ping başarılı (Router routing yapıyor)
```

### Senaryo 4: Farklı Subnet'te, Router Var Ama Routing OFF - Başarısız
```
PC-1: 192.168.1.10/24
PC-2: 192.168.2.20/24
Path: PC-1 → Switch → Router (IP Routing: OFF) → Switch → PC-2
→ Ping başarısız
→ Hata: "Subnet uyumsuzluğu: Kaynak 192.168.1.10/255.255.255.0, Hedef 192.168.2.20/255.255.255.0. Router ile routing gerekli."
```

## Hata Mesajı

**Türkçe:**
```
Subnet uyumsuzluğu: Kaynak 192.168.1.10/255.255.255.0, Hedef 192.168.2.20/255.255.255.0. Router ile routing gerekli.
```

**Gösterim:**
- Canvas üzerinde sol üst köşede kırmızı kutu
- Başlık: "Ping başarısız"
- Detay: Hata mesajı

## Teknik Detaylar

### isIpInSubnet Fonksiyonu
```typescript
function isIpInSubnet(ip: string, targetIp: string, subnet: string): boolean {
  try {
    const ipParts = ip.split('.').map(Number);
    const targetParts = targetIp.split('.').map(Number);
    const subnetParts = subnet.split('.').map(Number);

    for (let i = 0; i < 4; i++) {
      const ipMasked = ipParts[i] & subnetParts[i];
      const targetMasked = targetParts[i] & subnetParts[i];
      if (ipMasked !== targetMasked) return false;
    }
    return true;
  } catch {
    return false;
  }
}
```

### Subnet Mask Örnekleri
- 255.255.255.0 = /24 (Class C)
- 255.255.0.0 = /16 (Class B)
- 255.0.0.0 = /8 (Class A)

## Dosyalar

- `src/lib/network/connectivity.ts`
  - checkConnectivity: Subnet kontrolü eklendi
  - getPingDiagnostics: Subnet kontrolü eklendi
  - isIpInSubnet: Subnet hesaplama fonksiyonu

## Kontrol Listesi

- [x] Subnet kontrolü checkConnectivity'de eklendi
- [x] Subnet kontrolü getPingDiagnostics'de eklendi
- [x] Router routing kontrolü eklendi
- [x] Hata mesajı detaylı
- [x] isIpInSubnet fonksiyonu çalışıyor
- [x] Türkçe hata mesajı
- [x] TypeScript hata yok
- [x] Compilation warning yok
