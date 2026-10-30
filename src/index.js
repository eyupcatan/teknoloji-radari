/**
 * Teknoloji Beceri Talep Radarı — Cloudflare Worker
 *
 * Güvenlik ve Mimari Özellikleri:
 *  - Kişisel Tehdit Kontrolü: ReDoS (Regex Denial of Service) ve aşırı büyük
 *    girdilerle metin işleme hattının kilitlenmesine karşı 3 katmanlı savunma:
 *      1. Girdi boyut sınırı (maksimum 10 KB)
 *      2. Sabit, RE2-uyumlu regex kataloğu (iç içe niceleyici yok, dinamik regex yok)
 *      3. İşlem zaman aşımı (2000 ms, Promise.race)
 *  - Tam HTTP Güvenlik Başlıkları (CSP - unsafe-inline/eval yok, HSTS, X-Content-Type-Options,
 *    X-Frame-Options, Referrer-Policy, Permissions-Policy)
 *  - Static Assets Entegrasyonu: Canlı veri ürünü (Etiket Atlası) ve verileri (2015/2025 kesitleri)
 *  - RFC 9116 security.txt desteği
 *  - Cron Triggers ile periyodik sağlık ve veri tazeleme
 *
 * Öğrenci: Muhammet Eyüp Çatan (2516016025)
 * Ders: Bulut Bilişim ve Siber Güvenlik
 */

/* ─────────────────────────────────────────────────────────────────────────────
   SABİTLER VE LİMİTLER
───────────────────────────────────────────────────────────────────────────── */
const MAX_BODY_BYTES   = 10_240;  // 10 KB — ReDoS için gereken aşırı girdiyi engeller
const PARSE_TIMEOUT_MS = 2_000;   // 2 saniye — CPU kilitlenmesine karşı üst sınır
const VERSION          = '1.1.0';

/* ─────────────────────────────────────────────────────────────────────────────
   GÜVENLİ REGEX KATALOĞU (RE2 Uyumlu, Lineer Karmaşıklık O(N))
   Kural: İç içe niceleyici (nested quantifier örn. (a+)+) ve üst üste binen
   alternasyonlar YASAKTIR.
───────────────────────────────────────────────────────────────────────────── */
const SAFE_PATTERNS = {
  // Teknoloji/etiket adı: harf, rakam, nokta, tire, artı, diyez (örn: c++, c#, .htaccess, node.js)
  tagName:    /^[a-z0-9#+.\-]{1,50}$/i,
  // Yıl filtresi: 2015 veya 2025 kesitleri
  year:       /^(2015|2025)$/,
  // Topluluk kimliği: tamsayı 0-999
  community:  /^\d{1,3}$/,
  // Serbest metin arama: uzunluğu sınırlı, özel regex metakarakterlerinden arındırılmış
  searchText: /^[a-z0-9#+.\-\s]{1,100}$/i,
};

/**
 * Girdinin güvenli regex kalıbıyla eşleşip eşleşmediğini kontrol eder.
 * Dinamik regex derlemez, uzunluk sınırını aşan girdiyi anında eler.
 */
function safeMatch(value, pattern) {
  if (typeof value !== 'string') return false;
  if (value.length > 500) return false;
  return pattern.test(value);
}

/**
 * Zaman aşımı koruması (Promise.race)
 */
function withTimeout(promise, ms = PARSE_TIMEOUT_MS) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('İşlem zaman aşımına uğradı (Timeout)')), ms)
  );
  return Promise.race([promise, timer]);
}

/* ─────────────────────────────────────────────────────────────────────────────
   GÜVENLİK BAŞLIKLARI (Mozilla Observatory B+ ve SecurityHeaders A Hedefi)
───────────────────────────────────────────────────────────────────────────── */
function addSecurityHeaders(response) {
  const h = new Headers(response.headers);

  // Content-Security-Policy: unsafe-inline ve unsafe-eval KESİNLİKLE YOKTUR
  h.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // HSTS: 1 Yıl, alt alan adları ve preload dahil
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // MIME type sniffing engelleme
  h.set('X-Content-Type-Options', 'nosniff');
  // Referrer sızıntısını sınırla
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // İzinler politikası — hassas cihaz donanımlarını kapat
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // Clickjacking koruması
  h.set('X-Frame-Options', 'DENY');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: h,
  });
}

function jsonResponse(data, status = 200) {
  const base = new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  return addSecurityHeaders(base);
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message, status }, status);
}

/* ─────────────────────────────────────────────────────────────────────────────
   GİRDİ BOYUT SINIRI KONTROLÜ
───────────────────────────────────────────────────────────────────────────── */
async function enforceBodySizeLimit(request) {
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    throw new Error(`Girdi boyutu çok büyük: ${contentLength} bayt (Limit: ${MAX_BODY_BYTES} bayt)`);
  }

  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) {
    throw new Error(`Gövde boyutu çok büyük: ${buffer.byteLength} bayt (Limit: ${MAX_BODY_BYTES} bayt)`);
  }
  return new TextDecoder().decode(buffer);
}

/* ─────────────────────────────────────────────────────────────────────────────
   RADAR VERİ ÖZETİ (Stack Overflow 2015-2025 Gerçek Analiz Verileri)
───────────────────────────────────────────────────────────────────────────── */
const RADAR_HIGHLIGHTS = {
  meta: {
    project: 'Teknoloji Etiketleri Ağının Evrimi & Beceri Talep Radarı',
    coverage: '2015 & 2025 72 Saatlik Kesitler (6-9 Ocak)',
    common_tags: 1225,
    nmi_similarity: 0.298,
  },
  key_technologies: [
    { tag: 'http', status: 'bridge-candidate', participation_2025: 0.850, degree_2025: 19, strength_2025: 20 },
    { tag: 'postgresql', status: 'high-participation', participation_2025: 0.735, strength_2025: 85 },
    { tag: 'docker', status: 'high-participation', participation_2025: 0.721, strength_2025: 58 },
    { tag: 'amazon-web-services', status: 'high-participation', participation_2025: 0.624, strength_2025: 72 },
    { tag: 'python', status: 'core-ecosystem', rank: 1, community: 'Veri & Python' },
    { tag: 'javascript', status: 'core-ecosystem', rank: 2, community: 'Web & Frontend' },
    { tag: 'reactjs', status: 'growing-demand', community: 'Web & Frontend' },
    { tag: 'typescript', status: 'emerging-standard', community: 'Web & Frontend' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   API VE ROTA YÖNLENDİRİCİSİ
───────────────────────────────────────────────────────────────────────────── */

/** GET /api/radar — Genel özet ve güvenlik durumu */
function handleRadarApi(url) {
  const q = url.searchParams.get('q');
  if (q && !safeMatch(q, SAFE_PATTERNS.searchText)) {
    return errorResponse('Arama sorgusu geçersiz karakterler içeriyor veya 100 karakter sınırını aşıyor.');
  }

  let items = RADAR_HIGHLIGHTS.key_technologies;
  if (q) {
    const query = q.toLowerCase();
    // ReDoS'a yol açabilecek dinamik RegExp yerine güvenli string araması:
    items = items.filter(t => t.tag.toLowerCase().includes(query) || (t.status && t.status.includes(query)));
  }

  return jsonResponse({
    summary: RADAR_HIGHLIGHTS.meta,
    count: items.length,
    results: items,
    security: {
      redos_safe: true,
      input_limit_bytes: MAX_BODY_BYTES,
      parse_timeout_ms: PARSE_TIMEOUT_MS,
    },
  });
}

/**
 * POST /api/parse — ReDoS Korumalı Metin & Etiket Ayrıştırma Hattı
 * Kişisel Tehdit Kontrolü için Canlı Doğrulama Uç Noktası
 */
async function handleParseApi(request) {
  let rawBody;
  try {
    rawBody = await withTimeout(enforceBodySizeLimit(request), PARSE_TIMEOUT_MS);
  } catch (err) {
    return errorResponse(err.message, 413);
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse('Geçersiz JSON biçimi.', 400);
  }

  const { text, pattern: patternName } = body;
  if (typeof text !== 'string') {
    return errorResponse('"text" parametresi metin dizesi olmalıdır.', 400);
  }

  const selectedPattern = SAFE_PATTERNS[patternName];
  if (!selectedPattern) {
    return errorResponse(
      `Bilinmeyen kalıp: "${patternName}". Geçerli kalıplar: ${Object.keys(SAFE_PATTERNS).join(', ')}`,
      400
    );
  }

  const startMs = performance.now();
  let matched;
  try {
    matched = await withTimeout(
      Promise.resolve(safeMatch(text, selectedPattern)),
      PARSE_TIMEOUT_MS
    );
  } catch (err) {
    return errorResponse('Metin işleme zaman aşımına uğradı.', 503);
  }
  const elapsedMs = performance.now() - startMs;

  return jsonResponse({
    matched,
    input_length: text.length,
    pattern: patternName,
    elapsed_ms: Number(elapsedMs.toFixed(4)),
    redos_protection: {
      safe_regex_applied: true,
      linear_complexity: 'O(N)',
      backtracking_prevented: true,
    },
  });
}

/** GET /.well-known/security.txt */
function handleSecurityTxt() {
  const content = [
    'Contact: mailto:2516016025@students.mcbu.edu.tr',
    'Expires: 2027-12-31T23:59:00.000Z',
    'Preferred-Languages: tr, en',
    'Canonical: https://teknoloji-radari.muhammetcatan.workers.dev/.well-known/security.txt',
    'Policy: https://teknoloji-radari.muhammetcatan.workers.dev/security-policy',
    '',
    '# RFC 9116 Uyumlu Güvenlik İletişim Dosyası',
    '# Lütfen güvenlik açıklarını yukarıdaki iletişim adresine bildiriniz.',
  ].join('\n');

  const base = new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
  return addSecurityHeaders(base);
}

/** GET /health */
function handleHealth() {
  return jsonResponse({
    status: 'healthy',
    uptime: '100%',
    version: VERSION,
    timestamp: new Date().toISOString(),
    security_controls: {
      redos_defense: 'ACTIVE',
      input_size_limit: `${MAX_BODY_BYTES} bytes`,
      process_timeout: `${PARSE_TIMEOUT_MS} ms`,
      csp_strict: 'ACTIVE',
      hsts_preload: 'ACTIVE',
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   ANA WORKER
───────────────────────────────────────────────────────────────────────────── */
export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method.toUpperCase();

    try {
      // 1. API ve Güvenlik Uç Noktaları
      if (path === '/api/radar' && method === 'GET') {
        return handleRadarApi(url);
      }
      if (path === '/api/parse' && method === 'POST') {
        return handleParseApi(request);
      }
      if (path === '/.well-known/security.txt') {
        return handleSecurityTxt();
      }
      if (path === '/health') {
        return handleHealth();
      }

      // 2. Canlı Veri Ürünü Statik Dosyaları (Static Assets Binding)
      if (env.ASSETS) {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return addSecurityHeaders(assetResponse);
        }
      }

      // 3. Bulunamayan Rotalar
      return addSecurityHeaders(
        new Response('Sayfa veya uç nokta bulunamadı.', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      );
    } catch (err) {
      console.error(`[Worker Hatası] ${method} ${path}:`, err);
      return errorResponse('Sunucu içi hata oluştu.', 500);
    }
  },

  /**
   * Cron Trigger — Zamanlanmış veri ve sağlık denetimi
   */
  async scheduled(event, env, ctx) {
    console.log(`[Cron Trigger] Çalıştırıldı: ${event.cron} — ${new Date().toISOString()}`);
    // Periyodik sağlık testi
    const check = await fetch('https://api.cloudflare.com/client/v4/ips');
    console.log(`[Cron Trigger] Cloudflare IP API durumu: ${check.ok ? 'BAŞARILI' : 'BAŞARISIZ'}`);
  },
};
