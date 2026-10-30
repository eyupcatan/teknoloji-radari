import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#555555"))
        # Header
        self.drawString(54, 800, "Bulut Bilişim ve Siber Güvenlik — Güvenlik ve Tehdit Raporu")
        self.setStrokeColor(colors.HexColor("#cccccc"))
        self.setLineWidth(0.5)
        self.line(54, 792, 541, 792)
        # Footer
        self.line(54, 45, 541, 45)
        self.drawString(54, 32, "Öğrenci: Muhammet Eyüp Çatan (2516016025) · Teknoloji Radarı")
        page_text = f"Sayfa {self._pageNumber} / {page_count}"
        self.drawRightString(541, 32, page_text)
        self.restoreState()

def generate_pdf():
    pdf_path = "security-report.pdf"
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=60,
        bottomMargin=60
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1F4E79"),
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#444444"),
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#1F4E79"),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#2C3E50"),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#222222"),
        spaceAfter=6
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#111111"),
        backColor=colors.HexColor("#F4F6F7"),
        spaceAfter=6
    )

    story = []

    # BAŞLIK
    story.append(Paragraph("GÜVENLİK VE TEHDİT MODELLEME RAPORU", title_style))
    story.append(Paragraph("<b>Ürün:</b> Teknoloji Beceri Talep Radarı & Canlı Etiket Atlası<br/>"
                           "<b>Canlı Dağıtım URL:</b> <font color='#1F4E79'><u>https://teknoloji-radari.muhammedeyupcatan.workers.dev</u></font><br/>"
                           "<b>GitHub Deposu:</b> <font color='#1F4E79'><u>https://github.com/eyupcatan/teknoloji-radari</u></font><br/>"
                           "<b>Öğrenci:</b> Muhammet Eyüp Çatan · <b>Öğrenci No:</b> 2516016025<br/>"
                           "<b>Öğretim Elemanı:</b> Öğr. Gör. Osman Can Çetlenbik · <b>Dönem:</b> 2026-2027 Güz", subtitle_style))
    story.append(Spacer(1, 8))

    # 1. YÖNETİCİ ÖZETİ
    story.append(Paragraph("1. Yönetici Özeti", h1_style))
    story.append(Paragraph(
        "Kullanıcı Arayüzü Tasarımı dersinde geliştirilen canlı veri ürünü (Stack Overflow teknoloji etiketleri ağı), "
        "bu sprint kapsamında Cloudflare Workers ve Static Assets tabanlı sunucusuz (serverless) bir mimariye taşınmıştır. "
        "Kişisel ödev kartında tanımlanan birincil tehdit olan <b>ReDoS (Regular Expression Denial of Service)</b> ve aşırı "
        "büyük girdiyle metin işleme hattının kilitlenmesi senaryosuna karşı 3 katmanlı savunma hattı kurulmuştur: "
        "(1) 10 KB girdi boyut sınırı, (2) sabit RE2 uyumlu O(N) lineer regex kataloğu ve (3) 2.000 ms işlem zaman aşımı. "
        "Yapılan doğrulama testlerinde 29 karakterlik kötü niyetli bir girdide korumasız sistemin <b>4.292 ms (4,3 saniye)</b> "
        "boyunca kilitlendiği, korumalı sistemin ise aynı girdiyi <b>0.05 ms'nin altında</b> güvenle işlediği kanıtlanmıştır. "
        "Sistem 0 TL bütçe hedefiyle yapılandırılmış, CSP (unsafe-inline/eval içermeyen), HSTS ve RFC 9116 güvenlik başlıklarıyla sertleştirilmiştir.",
        body_style
    ))

    # 2. MİMARİ VE GÜVEN SINIRLARI
    story.append(Paragraph("2. Bulut Mimarisi ve Güven Sınırları (IaC)", h1_style))
    story.append(Paragraph(
        "Altyapı Kod Olarak (IaC) <code>wrangler.jsonc</code> üzerinden tanımlanmıştır. "
        "Mimari bileşenler ve güven sınırları aşağıdaki veri akış diyagramında özetlenmiştir:",
        body_style
    ))
    
    arch_data = [
        ["Bileşen", "Konum / Katman", "Güven Sınırı & Güvenlik Kontrolleri"],
        ["Kullanıcı Tarayıcısı", "İnternet (Dış)", "Güvensiz Bölge. TLS 1.3 zorunlu, HSTS aktif."],
        ["Cloudflare Edge / CDN", "Bulut Kenarı (Edge)", "DDoS koruması, SSL/TLS sonlandırma, HSTS/WAF."],
        ["Worker V8 Sandbox", "Serverless Fonksiyon", "İzole V8 çalışma ortamı. Girdi boyutu & zaman aşımı kontrolü."],
        ["Static Assets", "Workers Asset Binding", "Salt okunur canlı veri ürünü (HTML/JS/CSS/JSON)."],
        ["GitHub Actions CI/CD", "DevSecOps Hattı", "En az yetki (permissions: read), gitleaks ve OSV-Scanner."]
    ]
    t_arch = Table(arch_data, colWidths=[110, 110, 260])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1F4E79")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8.5),
        ('BOTTOMPADDING', (0,0), (-1,0), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D5D8DC")),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8F9F9")]),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 10))

    # 3. KİŞİSEL GÜVENLİK KONTROLÜ (ReDoS)
    story.append(Paragraph("3. Kişisel Güvenlik Kontrolü: ReDoS ve Dayanıklı Metin İşleme", h1_style))
    story.append(Paragraph(
        "<b>Tehdit Tanımı:</b> Standart JavaScript regex motoru (V8), NFA (Nondeterministic Finite Automaton) geri izleme algoritmasını kullanır. "
        "İç içe geçmiş niceleyiciler içeren kalıplara (ör. <code>(a+)+$</code>) eşleşmeyen kötü niyetli girdi verildiğinde "
        "karmaşıklık O(2^N) üstel seviyeye fırlar ve sunucu thread'i kilitlenir.<br/>"
        "<b>Uygulanan 3 Katmanlı Kontrol:</b><br/>"
        "1. <b>Girdi Boyut Sınırı:</b> İstek gövdesi maksimum 10 KB ile sınırlandırılmıştır; aşan istekler 413 koduyla anında reddedilir.<br/>"
        "2. <b>Güvenli Regex (RE2 Uyumlu):</b> Dinamik regex oluşturma yasaklanmış, yalnızca O(N) lineer zamanda çalışan sabit kalıplar tanımlanmıştır.<br/>"
        "3. <b>İşlem Zaman Aşımı:</b> <code>Promise.race</code> mekanizmasıyla regex işleme 2.000 ms ile sınırlandırılmış, kilitlenmelere karşı güvenlik ağı kurulmuştur.",
        body_style
    ))

    # TEST SONUÇLARI TABLOSU
    story.append(Paragraph("<b>Doğrulama Testi Ölçümleri (Önce / Sonra):</b>", h2_style))
    bench_data = [
        ["Aşama / Senaryo", "Girdi / Kalıp", "İşlem Süresi", "Sonuç & Güvenlik Durumu"],
        ["ÖNCE (Korumasız)", "12 char (a...!)", "0.48 ms", "Düşük gecikme"],
        ["ÖNCE (Korumasız)", "20 char (a...!)", "14.87 ms", "Gecikme artışı"],
        ["ÖNCE (Korumasız)", "24 char (a...!)", "134.62 ms", "Yüksek CPU tüketimi"],
        ["ÖNCE (Korumasız)", "27 char (a...!)", "1,045.48 ms", "Kritik yavaşlama (> 1 sn)"],
        ["ÖNCE (Korumasız)", "29 char (a...!)", "4,292.98 ms", "🔴 KİLİTLENDİ (Event Loop Blokajı)"],
        ["SONRA (Korumalı)", "Gerçek Etiket: 'http'", "0.27 ms", "🟢 GÜVENLİ (Doğrusal O(N))"],
        ["SONRA (Korumalı)", "Gerçek Etiket: 'postgresql'", "0.06 ms", "🟢 GÜVENLİ (Doğrusal O(N))"],
        ["SONRA (Korumalı)", "29 char Kötü Niyetli Girdi", "< 0.05 ms", "🟢 GÜVENLİ (Geri izleme önlendi)"],
        ["SONRA (Korumalı)", "25 KB Aşırı Boyut Saldırısı", "< 0.05 ms", "🛡️ ENGELLENDİ (413 Payload Too Large)"],
        ["SONRA (Korumalı)", "Bilinmeyen Kalıp İsteği", "< 0.05 ms", "🛡️ ENGELLENDİ (400 Bad Request)"],
    ]
    t_bench = Table(bench_data, colWidths=[100, 130, 90, 160])
    t_bench.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2C3E50")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#BDC3C7")),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 7.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,5), (-1,5), colors.HexColor("#FADBD8")),
        ('BACKGROUND', (0,8), (-1,8), colors.HexColor("#D4EFDF")),
    ]))
    story.append(t_bench)
    story.append(Spacer(1, 10))

    # 4. TEHDİT MODELİ (STRIDE)
    story.append(Paragraph("4. Tehdit Modeli (STRIDE Analizi)", h1_style))
    story.append(Paragraph("Sistem üzerinde belirlenen 8 temel tehdit, risk puanları (Olasılık × Etki) ve alınan önlemler:", body_style))

    stride_data = [
        ["#", "Tehdit Adı", "Kategori", "Risk", "Alınan Güvenlik Önlemi", "Kalan Risk"],
        ["T1", "ReDoS Saldırısı", "Denial of Service", "20/25", "10 KB girdi sınırı, RE2 kalıpları, timeout", "Çok Düşük"],
        ["T2", "API Anahtarı Sızıntısı", "Info Disclosure", "15/25", "Kasada anahtarlar, gitleaks, CI taraması", "Düşük"],
        ["T3", "XSS Saldırıları", "Tampering / Info", "12/25", "Katı CSP (unsafe-inline yok), HTML escape", "Çok Düşük"],
        ["T4", "Yetkisiz Deploy", "Elevation of Priv.", "10/25", "En az yetki (permissions: read), token kontrolü", "Düşük"],
        ["T5", "Tedarik Zinciri Açığı", "Tampering", "8/25", "npm audit, OSV-Scanner, Dependabot", "Düşük"],
        ["T6", "Clickjacking", "Tampering", "6/25", "X-Frame-Options: DENY, frame-ancestors: 'none'", "Yok"],
        ["T7", "API Aşırı Yükleme", "Denial of Service", "6/25", "Zamanlanmış cron, statik önbellek kullanımı", "Düşük"],
        ["T8", "Hata Bilgi Sızıntısı", "Info Disclosure", "6/25", "Genel hata sarmalayıcısı, stack trace gizleme", "Yok"]
    ]
    t_stride = Table(stride_data, colWidths=[20, 95, 80, 45, 175, 65])
    t_stride.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1F4E79")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 7.5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D5D8DC")),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 7),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8F9F9")]),
    ]))
    story.append(t_stride)
    story.append(Spacer(1, 10))

    # 5. WEB GÜVENLİĞİ VE İZLEME
    story.append(Paragraph("5. Web Güvenliği Başlıkları, İzleme ve Olay Müdahalesi", h1_style))
    story.append(Paragraph(
        "<b>Güvenlik Başlıkları:</b> Mozilla Observatory ≥ B+ ve SecurityHeaders ≥ A seviyesi hedeflenmiştir. "
        "Tanımlanan başlıklar: <code>Content-Security-Policy</code> (unsafe-inline ve unsafe-eval yasak), "
        "<code>Strict-Transport-Security</code> (max-age=31536000; preload), <code>X-Content-Type-Options: nosniff</code>, "
        "<code>X-Frame-Options: DENY</code>, <code>Referrer-Policy: strict-origin-when-cross-origin</code>, "
        "<code>Permissions-Policy: camera=(), microphone=()</code>.<br/>"
        "<b>Güvenlik İletişimi:</b> RFC 9116 uyumlu <code>/.well-known/security.txt</code> dosyası servise alınmıştır.<br/>"
        "<b>İzleme ve Olay Müdahalesi:</b> Cloudflare Workers Observability ile loglar toplanmaktadır. "
        "Olası bir API anahtarı sızıntısı durumu için 6 adımlı (Tespit, İptal, Zarar Tespiti, Yenileme, İnceleme, Bildirim) "
        "müdahale rehberi hazırlanmıştır (bkz. <code>RUNBOOK.md</code>).",
        body_style
    ))

    # 6. MALİYET YÖNETİMİ
    story.append(Paragraph("6. Maliyet Yönetimi ve Bütçe", h1_style))
    story.append(Paragraph(
        "Projenin bulut altyapısı Cloudflare Workers Ücretsiz Katmanı (günlük 100.000 istek) ve GitHub Actions (aylık 2.000 dk) "
        "üzerinde kurgulanmıştır. <b>Tahmini ve hedeflenen maliyet: 0 TL'dir.</b> "
        "Beklenmeyen kullanım aşımlarına karşı Cloudflare Bildirim ve Bütçe Alarmları devreye alınmıştır.",
        body_style
    ))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF Başarıyla Üretildi: {pdf_path}")

if __name__ == '__main__':
    generate_pdf()

