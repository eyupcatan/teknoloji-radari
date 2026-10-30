ETIKET ATLASI - STATIK YAYIN PAKETI

Bu klasorun kokunde index.html bulunur. Tum dosyalari birlikte tasiyin.
Build, sunucu uygulamasi, veritabani, API anahtari veya kullanici oturumu gerekmez.

YEREL ONIZLEME
python -m http.server 8000
http://localhost:8000 adresini acin. file:// ile acmak JSON fetch kisitina takilabilir.

VERCEL
Framework Preset: Other
Root Directory: index.html dosyasinin bulundugu klasor
Build Command: bos (override ile kapatin)
Output Directory: . (proje koku)
Tum assets/, data/, files/, vendor/ dosyalarini koruyun.
Vercel CLI kurulu ve hesap bagliysa bu klasorde: vercel --prod
Gercek uretim adresini Vercel verir; onceden bir URL varsaymayin.

Gizli dosya ve .env gerekmez. Bu paket mevcut portfolyo uygulamasinin
.env.local dosyasini veya yonetici parolasini icermez.
Kaynak JS ve CSS duzenlenirse index.html icindeki surum parametresini
degistirerek eski tarayici onbellegini gecersiz kilin.

ETKILESIM
2015 ve 2025 icin 6-9 Ocak UTC, iki esit 72 saatlik kesit.
Tam yillar veya on yilin temsili orneklemi degildir.
Ana gorunum en fazla 350 dugum / 1200 kenardir. Olculer tam agdan gelir.
Ham analiz sonuclari, JSON dosyalari ve indirilebilir dosyalar degistirilmedi.
Ag alanini surukleyerek 3B dondurun; fare tekerlegi veya +/- ile yakinlastirin.
Bir dugume tiklayinca kamera yumusakca onu merkeze alir. Gorunum dugmesi kamera
yonunu ve yakinlastirmayi sifirlar. Arama, yil secimi, topluluk filtresi ve tam
ag dugum ayrintilari korunur.

LISANSLAR
Veri kaynagi Stack Exchange API / Stack Overflow.
https://api.stackexchange.com/docs/questions
https://stackoverflow.com/help/licensing
Ag, tarayicinin Canvas 2D API'siyle cizilir; D3 ve d3-sankey topluluk akisinda
kullanilir. Cytoscape.js dosyalari ve lisansi vendor/ altinda korunur.
