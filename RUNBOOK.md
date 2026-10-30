# 🚨 Olay Müdahale Runbook'u

**Teknoloji Beceri Talep Radarı — Cloudflare Workers**  
Hazırlayan: Muhammet Eyüp Çatan (2516016025)  
Versiyon: 1.0 · Tarih: 2026-10-30

---

## Senaryo: "API Anahtarım Sızdı"

> Bu runbook, bir Cloudflare API anahtarının veya başka bir gizli değerin
> depoya, log'a veya başka bir yere sızdığı durumda izlenecek adımları tanımlar.

---

## ⏱️ Hedef Müdahale Süresi

| Aşama | Hedef Süre |
|-------|-----------|
| Tespit → İptal | < 5 dakika |
| İptal → Yenileme | < 15 dakika |
| Yenileme → Normal operasyon | < 30 dakika |
| Olay raporu | < 24 saat |

---

## Adım 1 — TESPİT

**Nasıl tespit edilir?**

- [ ] GitHub Secret Scanning uyarısı aldınız (e-posta / GitHub bildirimi)
- [ ] `gitleaks` CI taraması başarısız oldu
- [ ] Cloudflare dashboard'da alışılmadık API kullanımı gördünüz
- [ ] Bir üçüncü kişi sizi uyardı

**Hangi anahtarın sızdığını belirleyin:**

```bash
# gitleaks ile yerel tarama
docker run -v "$(pwd)":/path zricethezav/gitleaks:latest detect \
  --source="/path" --report-format=json --report-path=gitleaks-report.json

cat gitleaks-report.json
```

**Hangi commit'te sızdı?**

```bash
git log --all --oneline | head -20
git show <commit-hash> -- <sızan-dosya>
```

---

## Adım 2 — İPTAL (< 5 dakika içinde!)

### Cloudflare API Token iptali:

1. https://dash.cloudflare.com/profile/api-tokens adresine gidin
2. Sızan token'ı bulun → **"Revoke"** / **"İptal Et"** butonuna tıklayın
3. İptal tarih/saatini not edin: `_______________`

### GitHub Secrets temizliği:

1. **Repo → Settings → Secrets and variables → Actions**
2. Sızan secret'ı **silin** (henüz yenisini eklemeyin)
3. Diğer secret'ların etkilenip etkilenmediğini kontrol edin

---

## Adım 3 — ZARAR TESPİTİ

**Sızan token ne kadar süre aktifti?**

- Sızma tarihi: `_______________`
- Tespit tarihi: `_______________`
- Aktif kalma süresi: `_______________`

**Cloudflare Audit Log incelemesi:**

1. https://dash.cloudflare.com → **Manage Account → Audit Log**
2. İptal öncesi dönemdeki API çağrılarını filtreleyin
3. Yetkisiz işlem var mı? (zone ekleme, route değişikliği, vb.)

```
Kontrol edilecekler:
☐ Worker'lara yetkisiz deploy yapıldı mı?
☐ KV verisi okundu/değiştirildi mi?
☐ DNS kayıtları değiştirildi mi?
☐ Başka account'lar etkilendi mi?
```

---

## Adım 4 — YENİLEME

**Yeni Cloudflare API Token oluşturma:**

1. https://dash.cloudflare.com/profile/api-tokens → **"Create Token"**
2. **En az yetki:** yalnızca `Workers Scripts:Edit` ve `Workers Routes:Edit`
3. Yeni token'ı not edin (yalnızca bir kez görüntülenir)

**GitHub Secrets'a yeni token ekleme:**

1. **Repo → Settings → Secrets → Actions → "New repository secret"**
2. `CF_API_TOKEN` → yeni token değeri
3. Kaydedip workflow'u test edin:

```bash
# Manuel deploy tetikle
gh workflow run deploy.yml
```

**Git geçmişinden temizleme (eğer commit'e girdi ise):**

```bash
# BFG Repo Cleaner ile geçmişten sil
java -jar bfg.jar --replace-text passwords.txt .
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
git push --force --tags
```

> [!CAUTION]
> Force push geçmişi yeniden yazar. Takım üyeleri varsa koordineli yapılmalıdır.

---

## Adım 5 — İNCELEME (Kök Neden Analizi)

**Neden sızdı?**

```
☐ Commit'e yanlışlıkla eklendi (.env dosyası, hardcode)
☐ Log'a yazdırıldı (console.log ile)
☐ Hata mesajına yansıdı (stack trace)
☐ Başka bir araç/servis açığa çıkardı
```

**Tekrarlanmasını önlemek için:**

```
☐ pre-commit hook ekle: gitleaks / git-secrets
☐ .gitignore'u güncelle (.env, *.secret, *.key)
☐ CI'da secret scanning zorunlu hale getir
☐ Kod inceleme (code review) kurallarına ekle
```

---

## Adım 6 — BİLDİRİM

| Kişi/Kurum | Nasıl | Ne Zaman |
|-----------|-------|---------|
| Öğretim Elemanı (Öğr. Gör. Çetlenbik) | E-posta | Tespit edildiğinde |
| Cloudflare (eğer veri ihlaline yol açtıysa) | support.cloudflare.com | 72 saat içinde |
| Etkilenen kullanıcılar | Yok (bu ödevde kişisel veri yok) | — |

**Bildirim e-postası şablonu:**

```
Konu: Güvenlik Olayı Bildirimi — Teknoloji Radarı Uygulaması

Sayın Öğr. Gör. Çetlenbik,

[TARİH] tarihinde Cloudflare API token'ımın [NEREDE] sızdığını tespit ettim.
Token derhal iptal edildi ([İPTAL SAATİ]).
Audit log incelemesinde yetkisiz işlem tespit edilmedi.
Yeni token oluşturuldu ve CI/CD pipeline'ı test edildi.

Kök neden: [AÇIKLAMA]
Alınan önlem: [ÖNLEMLER]
```

---

## Kontrol Listesi — Olay Kapanışı

```
☐ Sızan anahtar iptal edildi
☐ Yetkisiz erişim/işlem incelendi, sonuç belgelendi
☐ Yeni anahtar oluşturuldu ve test edildi
☐ Git geçmişi temizlendi (gerekliyse)
☐ Öğretim elemanı bilgilendirildi
☐ pre-commit hook / CI taraması güçlendirildi
☐ Bu runbook güncellendi (gerekirse)
```

---

*Bu runbook RFC 9116 ve NIST SP 800-61r2 Bilgisayar Güvenliği Olay Müdahale Kılavuzu referans alınarak hazırlanmıştır.*

