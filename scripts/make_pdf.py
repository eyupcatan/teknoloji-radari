import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Image
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
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1F4E79"),
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#444444"),
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#1F4E79"),
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#2C3E50"),
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#222222"),
        spaceAfter=5
    )

    story = []

    # BAŞLIK
    story.append(Paragraph("GÜVENLİK VE TEHDİT MODELLEME RAPORU", title_style))
    story.append(Paragraph("<b>Ürün:</b> Teknoloji Beceri Talep Radarı & Canlı Etiket Atlası<br/>"
                           "<b>Canlı Dağıtım URL:</b> <font color='#1F4E79'><u>https://teknoloji-radari.muhammedeyupcatan.workers.dev</u></font><br/>"
                           "<b>GitHub Deposu:</b> <font color='#1F4E79'><u>https://github.com/eyupcatan/teknoloji-radari</u></font><br/>"
                           "<b>Öğrenci:</b> Muhammet Eyüp Çatan · <b>Öğrenci No:</b> 2516016025<br/>"
                           "<b>Öğretim Elemanı:</b> Öğr. Gör. Osman Can Çetlenbik · <b>Dönem:</b> 2026-2027 Güz", subtitle_style))
    story.append(Spacer(1, 4))

    # 1. YÖNETİCİ ÖZETİ
    story.append(Paragraph("1. Yönetici Özeti", h1_style))
    story.append(Paragraph(
        "Kullanıcı Arayüzü Tasarımı dersinde geliştirilen canlı veri ürünü (Stack Overflow etiketleri etkileşimli ağı), "
        "Cloudflare Workers ve Static Assets tabanlı sunucusuz (serverless) altyapıya taşınmıştır. "
        "Kişisel tehdit kartında yer alan <b>ReDoS (Regular Expression Denial of Service)</b> tehdidine karşı "
        "3 katmanlı savunma hattı kurulmuştur: (1) 10 KB girdi boyutu sınırı, (2) sabit RE2 uyumlu lineer regex kataloğu "
        "ve (3) 2.000 ms işlem zaman aşımı. Gerçek testlerde 29 karakterlik kötü niyetli bir girdide korumasız sistem "
        "<b>4.292 ms (4,3 sn)</b> kilitlenirken, güvenli mimaride bu süre <b>< 0.05 ms</b> seviyesine indirilmiştir. "
        "Sistem katı CSP, HSTS, gitleaks, OSV-Scanner, RFC 9116 security.txt ve 0 TL bütçe hedefiyle güvenceye alınmıştır.",
        body_style
    ))

    # 2. MİMARİ VE GÜVEN SINIRLARI
    story.append(Paragraph("2. Bulut Mimarisi ve Güven Sınırları (IaC)", h1_style))
    story.append(Paragraph(
        "Altyapı <code>wrangler.jsonc</code> üzerinden kod olarak tanımlanmıştır. "
        "<code>run_worker_first: true</code> özelliğiyle tüm istekler ve statik varlıklar önce Worker güvenlik katmanından geçirilir.",
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
    t_arch = Table(arch_data, colWidths=[100, 100, 287])
    t_arch.setStyle(TableStyle([
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
    story.append(t_arch)
    story.append(Spacer(1, 6))

    # 3. KİŞİSEL GÜVENLİK KONTROLÜ (ReDoS)
    story.append(Paragraph("3. Kişisel Güvenlik Kontrolü: ReDoS ve Dayanıklı Metin İşleme", h1_style))
    story.append(Paragraph(
        "<b>Tehdit:</b> İç içe niceleyici içeren regex kalıplarında (örn. <code>([a-z0-9_-]+)+$</code>) "
        "kötü niyetli girdiler NFA motorunu O(2^N) karmaşıklıkla kilitler.<br/>"
        "<b>Kontroller:</b> (1) 10 KB Girdi Sınırı (413 ret), (2) Sabit RE2 Kalıpları (O(N) karmaşıklık), (3) 2 sn Zaman Aşımı.",
        body_style
    ))

    # TABLO
    bench_data = [
        ["Aşama / Senaryo", "Girdi / Kalıp", "İşlem Süresi", "Sonuç & Güvenlik Durumu"],
        ["ÖNCE (Korumasız)", "24 char (a...!)", "134.62 ms", "Yüksek CPU tüketimi"],
        ["ÖNCE (Korumasız)", "27 char (a...!)", "1,045.48 ms", "Kritik yavaşlama (> 1 sn)"],
        ["ÖNCE (Korumasız)", "29 char (a...!)", "4,292.98 ms", "🔴 KİLİTLENDİ (Event Loop Blokajı)"],
        ["SONRA (Korumalı)", "Gerçek Etiket: 'http'", "0.27 ms", "🟢 GÜVENLİ (Doğrusal O(N))"],
        ["SONRA (Korumalı)", "Gerçek Etiket: 'postgresql'", "0.06 ms", "🟢 GÜVENLİ (Doğrusal O(N))"],
        ["SONRA (Korumalı)", "29 char Kötü Niyetli Girdi", "< 0.05 ms", "🟢 GÜVENLİ (Geri izleme önlendi)"],
        ["SONRA (Korumalı)", "25 KB Aşırı Boyut Saldırısı", "< 0.05 ms", "🛡️ ENGELLENDİ (413 Payload Too Large)"],
    ]
    t_bench = Table(bench_data, colWidths=[95, 125, 80, 187])
    t_bench.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2C3E50")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 7.5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#BDC3C7")),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 7),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,3), (-1,3), colors.HexColor("#FADBD8")),
        ('BACKGROUND', (0,6), (-1,6), colors.HexColor("#D4EFDF")),
    ]))
    story.append(t_bench)
    story.append(Spacer(1, 6))

    # GRAFİK (Zorunlu kural: grafikle gösterin)
    chart_img = 'tests/redos_comparison_chart.png'
    if os.path.exists(chart_img):
        story.append(Paragraph("<b>Şekil 1: ReDoS Öncesi ve Sonrası İşlem Süresi Kıyaslama Grafiği (Logaritmik)</b>", h2_style))
        story.append(Image(chart_img, width=460, height=210))
        story.append(Spacer(1, 6))

    # 4. TEHDİT MODELİ (STRIDE)
    story.append(Paragraph("4. Tehdit Modeli (STRIDE Analizi)", h1_style))
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
    t_stride = Table(stride_data, colWidths=[18, 95, 80, 40, 190, 64])
    t_stride.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1F4E79")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 7.5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D5D8DC")),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 6.8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8F9F9")]),
    ]))
    story.append(t_stride)
    story.append(Spacer(1, 6))

    # 5. GÜVENLİK TESTİ (OWASP ZAP) ÖNCE / SONRA TABLOSU
    story.append(Paragraph("5. Güvenlik Testi (OWASP ZAP) ve Bulgular Tablosu", h1_style))
    story.append(Paragraph(
        "Kendi canlı adresimize yapılan baseline taramasında tespit edilen başlık eksiklikleri giderilmiş ve ikinci taramayla doğrulanmıştır:",
        body_style
    ))
    zap_data = [
        ["Bulgu / Zafiyet", "Risk Seviyesi", "Uygulanan Düzeltme", "Durum"],
        ["Content Security Policy (CSP) Eksik", "Orta", "Katı CSP eklendi (unsafe-inline/eval engellendi)", "✅ Düzeltildi"],
        ["Strict-Transport-Security (HSTS) Yok", "Düşük", "max-age=31536000; includeSubDomains; preload eklendi", "✅ Düzeltildi"],
        ["X-Content-Type-Options Eksik", "Düşük", "'nosniff' başlığı tüm yanıtlara zorlandı", "✅ Düzeltildi"],
        ["Anti-Clickjacking Başlığı Yok", "Düşük", "X-Frame-Options: DENY ve frame-ancestors 'none' eklendi", "✅ Düzeltildi"],
        ["Referrer-Policy Eksik", "Bilgi", "strict-origin-when-cross-origin tanımlandı", "✅ Düzeltildi"],
        ["Permissions-Policy Eksik", "Bilgi", "Kamera, mikrofon, konum erişimleri kapatıldı", "✅ Düzeltildi"],
        ["RFC 9116 security.txt Eksik", "Bilgi", "/.well-known/security.txt dosyası yayına alındı", "✅ Düzeltildi"],
    ]
    t_zap = Table(zap_data, colWidths=[130, 60, 227, 70])
    t_zap.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2C3E50")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 7.5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#BDC3C7")),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 6.8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8F9F9")]),
    ]))
    story.append(t_zap)
    story.append(Spacer(1, 6))

    # 6. İZLEME, RUNBOOK VE MALİYET
    story.append(Paragraph("6. İzleme, Olay Müdahalesi ve Maliyet Yönetimi", h1_style))
    story.append(Paragraph(
        "<b>İzleme & Alarmlar:</b> Cloudflare Workers Observability ile istek hacmi ve hata oranları gerçek zamanlı toplanmaktadır. "
        "Yüksek hata oranı (> %5) ve kota aşımı alarmları yapılandırılmıştır.<br/>"
        "<b>Olay Müdahale Runbook'u:</b> 'API Anahtarım Sızdı' senaryosu için 6 adımlı (Tespit, İptal, Zarar Tespiti, Yenileme, İnceleme, Bildirim) "
        "eylem planı <code>RUNBOOK.md</code> dosyasında hazırlanmıştır.<br/>"
        "<b>Maliyet:</b> Cloudflare Workers Ücretsiz Katmanı ve GitHub Actions ile çalışılmaktadır. "
        "<b>Maliyet: 0 TL'dir.</b> Cloudflare Bildirim & Bütçe alarmları aktiftir.",
        body_style
    ))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Tam Donanımlı PDF Başarıyla Üretildi: {pdf_path}")

if __name__ == '__main__':
    generate_pdf()
