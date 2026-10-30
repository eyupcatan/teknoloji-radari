# Tehdit Modeli — STRIDE Analizi

**Ürün:** Teknoloji Beceri Talep Radarı  
**Platform:** Cloudflare Workers (Serverless)  
**Öğrenci:** Muhammet Eyüp Çatan · 2516016025  
**Tarih:** 2026-10-30

---

## 1. Mimari & Veri Akış Diyagramı (DFD)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  GÜVEN SINIRI: İnternet (Dış)                                                │
│                                                                              │
│   [Kullanıcı Tarayıcısı]                                                     │
│        │  HTTPS GET /api/radar?q=...                                         │
│        │  HTTPS POST /api/parse (JSON gövde)                                 │
└────────┼─────────────────────────────────────────────────────────────────────┘
         │
         ▼  ◄── GÜVEN SINIRI GEÇİŞİ (TLS 1.3)
┌─────────────────────────────────────────────────────────────────────────────┐
│  GÜVEN SINIRI: Cloudflare Edge Network                                      │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Cloudflare Workers Çalışma Ortamı (V8 İzolatı)                       │ │
│  │                                                                        │ │
│  │  ┌──────────────┐    ┌─────────────────┐    ┌────────────────────┐    │ │
│  │  │ fetch()      │    │ Güvenlik         │    │ İş Mantığı         │    │ │
│  │  │ handler      │───►│ Katmanı          │───►│ (Radar Verileri)   │    │ │
│  │  │              │    │ - Boyut sınırı   │    │ - RADAR_DATA       │    │ │
│  │  │              │    │ - Timeout        │    │ - Sabit regex      │    │ │
│  │  │              │    │ - Regex doğrula  │    │ - HTML escape      │    │ │
│  │  └──────────────┘    └─────────────────┘    └────────────────────┘    │ │
│  │                                                                        │ │
│  │  ┌──────────────┐                                                      │ │
│  │  │ scheduled()  │──► Cloudflare IP API (Dış) [giden HTTPS]            │ │
│  │  │ handler      │                                                      │ │
│  │  └──────────────┘                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Secrets: CF_API_TOKEN → Cloudflare Secrets (istemciye sızdırılmaz)        │
│  Logs: Workers Observability (erişim + hata)                                │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼  HTTPS yanıt (güvenlik başlıkları dahil)
┌──────────────────────────────────────────────────────────────────────────────┐
│  GÜVEN SINIRI: İnternet (Dış)                                                │
│   [Kullanıcı Tarayıcısı] → HTML / JSON yanıtı alır                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. STRIDE Tehdit Analizi

Tehdit öncelik puanı: **Olasılık (1-5) × Etki (1-5) = Risk Puanı**

---

### T1 — ReDoS (Regex Denial of Service) ⭐ KİŞİSEL TEHDIT

| Alan | Değer |
|------|-------|
| **STRIDE Kategorisi** | Denial of Service (D) |
| **Olasılık** | 4 / 5 — Otomatik tarayıcılar bu saldırıyı kolayca dener |
| **Etki** | 5 / 5 — Worker kilitlenir, tüm kullanıcılara 503 |
| **Risk Puanı** | **20 / 25** |
| **Saldırı Vektörü** | POST /api/parse — büyük, kötü niyetli girdi |

**Saldırı senaryosu:**  
Saldırgan `POST /api/parse` endpointine `"a".repeat(50000) + "X"` gibi bir girdi gönderir.
Eğer tehlikeli bir regex (örn. `/^(a+)+$/`) kullanılıyorsa V8 motoru üstel geri izlemeye (catastrophic backtracking) girer ve Worker thread'i kilitlenir. Cloudflare'in CPU sınırı aşılarak tüm gelen istekler 503 alır.

**Alınan Önlemler:**
1. ✅ **Boyut sınırı:** Her istek 10 KB'dan büyükse anında reddedilir (`413`)
2. ✅ **Sabit regex kataloğu:** Yalnızca önceden derlenmiş, RE2-uyumlu kalıplar kullanılır; dinamik regex oluşturulmaz
3. ✅ **`includes()` ile metin arama:** Kullanıcı arama girişi asla regex'e dönüştürülmez
4. ✅ **Promise.race timeout:** 2 saniyeyi aşan işlem `503` döner
5. ✅ **Girdi uzunluk kontrolü:** `safeMatch()` 1000 karakterden uzun girdiyi reddeder

**Kalan Risk:** Çok düşük. Cloudflare'in kendi CPU limiti de ek güvenlik ağı sağlar.

---

### T2 — API Anahtarı Sızıntısı

| Alan | Değer |
|------|-------|
| **STRIDE Kategorisi** | Information Disclosure (I) |
| **Olasılık** | 3 / 5 — Yanlışlıkla commit'e ekleme sık görülür |
| **Etki** | 5 / 5 — Tam hesap ele geçirme |
| **Risk Puanı** | **15 / 25** |

**Alınan Önlemler:**
- ✅ Anahtarlar Cloudflare Secrets ve GitHub Secrets'ta saklanır
- ✅ gitleaks CI taraması her push'ta çalışır
- ✅ İstemci tarafına hiçbir anahtar sızdırılmaz

**Kalan Risk:** Orta. Git geçmişinde yanlışlıkla eklenme riski devam eder → pre-commit hook önerilir.

---

### T3 — XSS (Cross-Site Scripting)

| Alan | Değer |
|------|-------|
| **STRIDE Kategorisi** | Tampering (T) + Information Disclosure (I) |
| **Olasılık** | 3 / 5 |
| **Etki** | 4 / 5 — Kullanıcı oturumu çalınabilir |
| **Risk Puanı** | **12 / 25** |

**Alınan Önlemler:**
- ✅ `escapeHtml()` fonksiyonu tüm dinamik HTML çıktısını temizler
- ✅ `Content-Security-Policy: default-src 'none'` — inline script yasak
- ✅ `X-Content-Type-Options: nosniff`

**Kalan Risk:** Düşük.

---

### T4 — Yetkisiz Deploy / Hesap Ele Geçirme

| Alan | Değer |
|------|-------|
| **STRIDE Kategorisi** | Spoofing (S) + Elevation of Privilege (E) |
| **Olasılık** | 2 / 5 |
| **Etki** | 5 / 5 — Kötü amaçlı Worker deploy edilebilir |
| **Risk Puanı** | **10 / 25** |

**Alınan Önlemler:**
- ✅ `permissions: contents: read` — CI'da en az yetki
- ✅ Branch protection (main'e doğrudan push kapalı)
- ✅ CF_API_TOKEN yalnızca Workers için yetkili

**Kalan Risk:** Düşük.

---

### T5 — Bağımlılık Zinciri Saldırısı (Supply Chain)

| Alan | Değer |
|------|-------|
| **STRIDE Kategorisi** | Tampering (T) |
| **Olasılık** | 2 / 5 |
| **Etki** | 4 / 5 — Kötü amaçlı paket deploy edilebilir |
| **Risk Puanı** | **8 / 25** |

**Alınan Önlemler:**
- ✅ `npm audit` CI'da zorunlu
- ✅ OSV-Scanner her push'ta çalışır
- ✅ Dependabot (GitHub'da etkinleştirilecek)

**Kalan Risk:** Orta. `npm ci` ile kilit dosyası kullanılır.

---

### T6 — Clickjacking / UI Redressing

| Alan | Değer |
|------|-------|
| **STRIDE Kategorisi** | Tampering (T) |
| **Olasılık** | 2 / 5 |
| **Etki** | 3 / 5 |
| **Risk Puanı** | **6 / 25** |

**Alınan Önlemler:**
- ✅ `Content-Security-Policy: frame-ancestors 'none'`
- ✅ `X-Frame-Options: DENY`

**Kalan Risk:** Çok düşük.

---

### T7 — Veri Sağlayıcı API'sini Aşırı Yükleme

| Alan | Değer |
|------|-------|
| **STRIDE Kategorisi** | Denial of Service (D) |
| **Olasılık** | 2 / 5 |
| **Etki** | 3 / 5 — Veri sağlayıcı tarafından engelleniriz |
| **Risk Puanı** | **6 / 25** |

**Alınan Önlemler:**
- ✅ Zamanlanmış cron'dan API çağrısı (her dakika değil, veriler KV'de önbelleğe alınır)
- ✅ Kullanıcı istekleri doğrudan harici API'ye gitmiyor

**Kalan Risk:** Düşük.

---

### T8 — Log / Hata Mesajı Bilgi Sızıntısı

| Alan | Değer |
|------|-------|
| **STRIDE Kategorisi** | Information Disclosure (I) |
| **Olasılık** | 3 / 5 |
| **Etki** | 2 / 5 — İç yapı açığa çıkabilir |
| **Risk Puanı** | **6 / 25** |

**Alınan Önlemler:**
- ✅ Stack trace kullanıcıya dönmez; `console.error` ile yalnızca iç log'a yazılır
- ✅ Genel `errorResponse()` sarmalayıcısı → standart hata mesajları

**Kalan Risk:** Düşük.

---

## 3. Risk Matrisi (Özet)

| # | Tehdit | Kategori | Olasılık | Etki | Risk | Durum |
|---|--------|----------|---------|------|------|-------|
| T1 | **ReDoS** ⭐ | D | 4 | 5 | **20** | ✅ Hafifletildi |
| T2 | API Anahtarı Sızıntısı | I | 3 | 5 | **15** | ✅ Hafifletildi |
| T3 | XSS | T+I | 3 | 4 | **12** | ✅ Hafifletildi |
| T4 | Yetkisiz Deploy | S+E | 2 | 5 | **10** | ✅ Hafifletildi |
| T5 | Supply Chain | T | 2 | 4 | **8** | ⚠️ Kısmen |
| T6 | Clickjacking | T | 2 | 3 | **6** | ✅ Hafifletildi |
| T7 | API Aşırı Yükleme | D | 2 | 3 | **6** | ✅ Hafifletildi |
| T8 | Log Sızıntısı | I | 3 | 2 | **6** | ✅ Hafifletildi |

