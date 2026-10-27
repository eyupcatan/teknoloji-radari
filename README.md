# Teknoloji Beceri Talep Radarı - Güvenli Bulut Yayını

## Mimari Diyagram Taslağı
```mermaid
flowchart TD
    subgraph Güven Sınırı: Dış İnternet
        User([Kullanıcı / İstemci])
    end

    subgraph Güven Sınırı: GitHub CI/CD
        GA[GitHub Actions - Zamanlanmış Görev]
        GS[(GitHub Secrets)]
    end

    subgraph Güven Sınırı: Bulut Platformu (Cloudflare)
        SF[Serverless Fonksiyon - Metin İşleme]
        WAF[Web Application Firewall / CSP]
    end

    User -->|HTTPS İstekleri| WAF
    WAF --> SF
    GA -->|Tetikleme / Deploy| SF
    GA -->|Anahtarları Oku| GS
    SF -->|Veri Çekme| API[(Dış Veri Kaynağı API)]
    
    classDef boundary fill:none,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5;
    class Dış İnternet,GitHub CI/CD,Bulut Platformu boundary;
