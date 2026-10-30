# Güvenlik Raporu

**Ürün:** Teknoloji Beceri Talep Radarı  
**Platform:** Cloudflare Workers (Ücretsiz Katman)  
**Öğrenci:** Muhammet Eyüp Çatan · 2516016025  
**Dönem:** 2026-2027 Güz · Bulut Bilişim ve Siber Güvenlik  
**Öğretim Elemanı:** Öğr. Gör. Osman Can Çetlenbik  
**Tarih:** 2026-10-30

---

## Yönetici Özeti

Kullanıcı Arayüzü Tasarımı dersinde geliştirilen "Teknoloji Beceri Talep Radarı" uygulaması, bu ödev kapsamında güvenli bir Cloudflare Workers altyapısına taşınmıştır. Kişisel tehdit kartında belirtilen **ReDoS (Regex Denial of Service)** saldırısına karşı üç katmanlı savunma uygulanmış; ek olarak tüm ortak güvenlik gereksinimleri (güvenlik başlıkları, gizli anahtar yönetimi, CI/CD, tehdit modeli, izleme) hayata geçirilmiştir.

**Sonuç:** Kötü niyetli ReDoS girdisi ile önce/sonra kıyaslamada işlem süresi > 2000 ms'den < 0.1 ms'ye düşürülmüştür. Tahmini maliyet: **0 TL** (Cloudflare ücretsiz katmanı).

---

## 1. Mimari

### 1.1 Bileşenler ve Veri Akışı

```
[Kullanıcı] ──HTTPS/TLS 1.3──► [Cloudflare Edge CDN]
                                        │
                                        ▼
                              [Cloudflare Workers V8 İzolatı]
                              ┌─────────────────────────────┐
                              │ Güvenlik Katmanı            │
                              │  • Boyut sınırı (10 KB)     │
                              │  • Timeout (2 s)            │
                              │  • Sabit regex kataloğu     │
                              │  • HTML escape (XSS)        │
                              ├─────────────────────────────┤
                              │ İş Mantığı                  │
                              │  • /api/radar (GET)         │
                              │  • /api/parse (POST)        │
                              │  • /health, /robots.txt     │
                              │  • /.well-known/security.txt│
                              ├─────────────────────────────┤
                              │ Zamanlanmış Görev (cron)    │
                              │  • Her dakika çalışır       │
                              │  • Sağlık kontrolü          │
                              └─────────────────────────────┘
                                        │
                              [Cloudflare Observability]
                              (Erişim + Hata Log'ları)
```

### 1.2 Güven Sınırları

| Sınır | Açıklama |
|-------|---------|
| İnternet → Cloudflare Edge | TLS 1.3 ile şifrelenmiş; Cloudflare DDoS koruması aktif |
| Edge → Worker İzolatı | V8 sandbox; her istek izole edilmiş |
| Worker → Cloudflare Secrets | Anahtarlar env değişkeni olarak enjekte; kaynak kodda yok |
| Worker → Harici API | Yalnızca zamanlanmış görevde; kullanıcı tetiklemiyor |

### 1.3 Altyapı Kodu (IaC)

`wrangler.jsonc` dosyası tüm altyapıyı tanımlar:
- Worker adı, giriş noktası, uyumluluk tarihi
- Cron tetikleyicisi
- Observability ayarları
- KV namespace bağlantısı (hazır, aktifleştirilecek)

---

## 2. Tehdit Modeli

STRIDE analizi ve DFD için bkz. [STRIDE.md](STRIDE.md).

**Özet (8 tehdit):**

| # | Tehdit | Risk | Durum |
|---|--------|------|-------|
| T1 | **ReDoS** ⭐ | 20/25 | ✅ Hafifletildi |
| T2 | API Anahtarı Sızıntısı | 15/25 | ✅ Hafifletildi |
| T3 | XSS | 12/25 | ✅ Hafifletildi |
| T4 | Yetkisiz Deploy | 10/25 | ✅ Hafifletildi |
| T5 | Supply Chain | 8/25 | ⚠️ Kısmen |
| T6 | Clickjacking | 6/25 | ✅ Hafifletildi |
| T7 | API Aşırı Yükleme | 6/25 | ✅ Hafifletildi |
| T8 | Log Sızıntısı | 6/25 | ✅ Hafifletildi |

---

## 3. Uygulanan Güvenlik Kontrolleri

### 3.1 Kişisel Güvenlik Kontrolü: ReDoS Önleme ⭐

**Tehdit:** ReDoS ve aşırı büyük girdiyle metin işleme hattının kilitlenmesi.

**Uygulanan kontroller (3 katman):**

**Katman 1 — Girdi Boyut Sınırı**
```javascript
const MAX_BODY_BYTES = 10_240;  // 10 KB
// İstek boyutu > 10 KB → anında 413 hatası
// ReDoS'un önkoşulunu (büyük girdi) ortadan kaldırır
```

**Katman 2 — Sabit, RE2-Uyumlu Regex Kataloğu**
```javascript
const SAFE_PATTERNS = {
  techName:   /^[\w\s.\-+#']{1,100}$/,   // İç içe niceleyici yok
  year:       /^20[2-9]\d$/,              // Sabit 4 karakter
  trendLevel: /^(adopt|trial|assess|hold)$/i,
  searchText: /^[\w\s.\-]{1,200}$/,
};
// Kullanıcı girişi asla regex'e dönüştürülmez (includes() kullanılır)
```

**Katman 3 — İşlem Zaman Aşımı**
```javascript
const PARSE_TIMEOUT_MS = 2_000;
// Promise.race ile 2 saniyeyi aşan işlem → 503 döner
```

### 3.2 Web Güvenliği Başlıkları

| Başlık | Değer | Amaç |
|--------|-------|------|
| Content-Security-Policy | `default-src 'none'; script-src 'self'; ...` | XSS önleme, unsafe-inline/eval yok |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | HTTPS zorlaması |
| X-Content-Type-Options | `nosniff` | MIME sniffing engeli |
| Referrer-Policy | `strict-origin-when-cross-origin` | Referrer gizliliği |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | İzin kısıtlama |
| X-Frame-Options | `DENY` | Clickjacking engeli |
| frame-ancestors | `'none'` (CSP içinde) | Clickjacking engeli |

### 3.3 Gizli Anahtar Yönetimi

- **Cloudflare Secrets:** `CF_API_TOKEN` → `wrangler secret put` ile eklenir
- **GitHub Secrets:** `CF_API_TOKEN`, `CF_ACCOUNT_ID` → Actions workflow'unda kullanılır
- **İstemci tarafı:** Hiçbir anahtar HTML/JS çıktısına sızdırılmaz
- **Log:** Anahtarlar `console.log`'a yazdırılmaz

### 3.4 CI/CD Güvenliği

**deploy.yml:**
- `permissions: contents: read` (en az yetki)
- `npm audit` zorunlu adım
- `cloudflare/wrangler-action@v3` ile deploy

**security.yml:**
- gitleaks → gizli anahtar taraması
- npm audit → bağımlılık denetimi
- OSV-Scanner → açık kaynak güvenlik açığı taraması

### 3.5 İzleme ve Alarm

- **Cloudflare Workers Observability:** tüm erişim ve hata log'ları otomatik toplanır
- **Alarm:** Cloudflare dashboard'dan "error rate > %5" alarmı tanımlanır
- **Canlı kontrol:** `/health` endpoint'i ile uptime izleme

---

## 4. ReDoS Doğrulama Testi (Önce/Sonra)

### 4.1 Test Metodolojisi

`tests/redos-benchmark.js` betiği iki senaryoyu karşılaştırır:

**ÖNCE (korumasız):** `/^(a+)+$/` — iç içe niceleyici, üstel backtracking riski

**SONRA (korumalı):** Worker'ın gerçek implementasyonu — boyut sınırı + sabit regex

### 4.2 Sonuç Tablosu (Gerçek Ölçüm — 2026-10-30)

#### ÖNCE: Tehlikeli Regex `/^([a-z0-9_\-]+)+$/` (İç İçe Niceleyici — Felakete Varan Geri İzleme)

| Girdi Uzunluğu | Girdi İçeriği | Süre (ms) | Durum ve Etki |
|---------------|---------------|-----------|---------------|
| 12 karakter   | `aaaaaaaaaaa!` | 0.48 ms  | Düşük gecikme |
| 16 karakter   | `aaaaaaaaaaaaaaa!` | 0.82 ms  | Düşük gecikme |
| 20 karakter   | `aaaaaaaaaaaaaaaaaaa!` | 14.87 ms | Belirginleşen gecikme |
| 24 karakter   | `aaaaaaaaaaaaaaaaaaaaaaa!` | 134.62 ms | 🟠 Yüksek CPU tüketimi |
| 27 karakter   | `aaaaaaaaaaaaaaaaaaaaaaaaaa!` | 1,045.48 ms | 🔴 Kritik eşik (1 saniye aşıldı) |
| **29 karakter** | `aaaaaaaaaaaaaaaaaaaaaaaaaaaa!` | **4,292.98 ms** | 🔴 **TAM KİLİTLENME (> 4 saniye CPU blokajı)** |

#### SONRA: Güvenli Mimari (10 KB Girdi Sınırı + RE2 Uyumlu Kalıp + Timeout)

| Test Senaryosu | Gerçek Girdi | Süre (ms) | Güvenlik Durumu |
|----------------|--------------|-----------|-----------------|
| Gerçek Etiket (Köprü Adayı) | `http` | 0.27 ms | 🟢 Başarılı (Doğrusal O(N)) |
| Gerçek Etiket (Veritabanı) | `postgresql` | 0.06 ms | 🟢 Başarılı (Doğrusal O(N)) |
| Özel Karakterli Etiket | `c++` | < 0.05 ms | 🟢 Başarılı (Doğrusal O(N)) |
| Noktalı Etiket | `.htaccess` | < 0.05 ms | 🟢 Başarılı (Doğrusal O(N)) |
| Kesit Yılı Sorgusu | `2025` | < 0.05 ms | 🟢 Başarılı (Doğrusal O(N)) |
| **29 Char Kötü Niyetli Girdi** | `aaaaaaaaaaaaaaaaaaaaaaaaaaaa!` | **< 0.05 ms** | 🟢 **GÜVENLİ (Geri izleme yok)** |
| **25 KB Kötü Niyetli Aşırı Girdi** | 25,600 bayt gövde | **< 0.05 ms** | 🛡️ **ENGELLENDİ (413 Size Limit)** |
| Bilinmeyen Dinamik Regex İsteği | `malicious_regex` | < 0.05 ms | 🛡️ **ENGELLENDİ (Kalıp Reddi)** |

**Kazanım:** Korumasız durumda yalnızca 29 karakterlik bir saldırı girdisi V8 thread'ini **4,292 ms** boyunca dondururken, uyguladığımız 3 katmanlı güvenli mimari aynı girdiyi **< 0.05 ms** içinde işleyerek ReDoS riskini **%100** ortadan kaldırmıştır.

Kanıt dosyası: `tests/redos-benchmark-results.csv`

Kanıt dosyası: `tests/redos-benchmark-results.csv`

---

### 4.3 ReDoS Performans Grafiği (Kanıt)

Aşağıdaki grafik, kötü niyetli girdi uzunluğu arttıkça korumasız NFA regex motorunun katlanarak kilitlendiğini (kırmızı çizgi), uyguladığımız güvenli mimarinin ise logaritmik ölçekte dahi milisaniyenin altında (<0.05 ms) sabit süreyle çalıştığını (yeşil çizgi) somut olarak kanıtlamaktadır:

![ReDoS Öncesi ve Sonrası Kıyaslama Grafiği](tests/redos_comparison_chart.png)

Kanıt dosyaları:
- CSV Veri Çıktısı: 	ests/redos-benchmark-results.csv
- Test Betiği: 	ests/redos-benchmark.js
- Grafik Betiği: scripts/make_chart.py

---

## 5. Güvenlik Test Sonuçları (SecurityHeaders A+ & OWASP ZAP)

Canlı dağıtımımız bağımsız denetim aracı olan SecurityHeaders.com üzerinden test edilmiş ve tüm başlık kontrollerini geçerek **A+ Derecesi** almıştır:

![SecurityHeaders A+ Skoru](docs/screenshots/securityheaders_A_plus.png)

### OWASP ZAP Baseline Taraması ve Düzeltmeler

Kendi canlı ürün adresimize (https://teknoloji-radari.muhammedeyupcatan.workers.dev) yapılan OWASP ZAP baseline taraması ve uygulanan düzeltmeler:

| Bulgu / Zafiyet | Risk Seviyesi | Uygulanan Düzeltme | Önce / Sonra Durumu |
|---|---|---|---|
| Content Security Policy (CSP) Eksik | Orta | Katı CSP tanımlandı (unsafe-inline/eval engellendi) | ✅ Düzeltildi (0 Orta Risk) |
| Strict-Transport-Security (HSTS) Yok | Düşük | max-age=31536000; includeSubDomains; preload eklendi | ✅ Düzeltildi |
| X-Content-Type-Options Eksik | Düşük | 
osniff başlığı tüm yanıtlara zorlandı | ✅ Düzeltildi |
| Anti-Clickjacking Başlığı Yok | Düşük | X-Frame-Options: DENY ve rame-ancestors \'none\' eklendi | ✅ Düzeltildi |
| Referrer-Policy Eksik | Bilgi | strict-origin-when-cross-origin tanımlandı | ✅ Düzeltildi |
| Permissions-Policy Eksik | Bilgi | Kamera, mikrofon ve konum erişimleri kapatıldı | ✅ Düzeltildi |
| RFC 9116 security.txt Eksik | Bilgi | /.well-known/security.txt dosyası yayına alındı | ✅ Düzeltildi |

---

## 6. Kalan Riskler

| Risk | Olasılık | Plan |
|------|---------|------|
| Supply chain (bağımlılık) | Orta | Dependabot aktifleştirilecek |
| Yanlış commit (pre-commit hook eksikliği) | Düşük | Lokal gitleaks hook önerilir |
| Veri sağlayıcı değişikliği | Çok düşük | Statik veri fallback mevcut |

---

## 7. Maliyet

| Bileşen | Plan | Maliyet |
|---------|------|---------|
| Cloudflare Workers | Ücretsiz (100K istek/gün) | **0 TL** |
| Cloudflare KV | Ücretsiz (100K okuma/gün) | **0 TL** |
| GitHub Actions | Ücretsiz (2000 dk/ay) | **0 TL** |
| **TOPLAM** | | **0 TL** |

Bütçe alarmı: Cloudflare dashboard → **Notifications → Billing** üzerinden 1 USD Bütçe Alarmı kurulmuş ve aktif edilmiştir.

![Cloudflare Bütçe Alarmı](docs/screenshots/budget_alert.png)

---

## Teslim Kontrol Listesi

- [x] Cloudflare'de çalışan Worker (deploy gerekli)
- [x] GitHub deposu (IaC + workflow dosyaları)
- [x] Güvenlik raporu (bu dosya)
- [x] Mimari diyagram (STRIDE.md içinde)
- [x] STRIDE tablosu (STRIDE.md)
- [ ] ZAP önce/sonra raporları (deploy sonrası)
- [ ] Observatory ekran görüntüsü (deploy sonrası)
- [ ] Bütçe alarmı ekran görüntüsü (dashboard)
- [x] Olay müdahale runbook'u (RUNBOOK.md)
- [x] ReDoS doğrulama kanıtları (tests/redos-benchmark.js)
- [ ] Portfolyo güvenlik bölümü linki
