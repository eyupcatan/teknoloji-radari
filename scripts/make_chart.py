import matplotlib.pyplot as plt
import numpy as np

# Veriler (Gerçek Benchmark Ölçüm Sonuçları)
# Önce (Korumasız): 12, 16, 20, 24, 27, 29 karakter
lengths_before = [12, 16, 20, 24, 27, 29]
times_before = [0.486, 0.818, 14.873, 134.619, 1045.476, 4292.980]

# Sonra (Güvenli Mimari): 12, 16, 20, 24, 27, 29 karakter
times_after = [0.035, 0.038, 0.041, 0.042, 0.045, 0.048]

plt.figure(figsize=(10, 6), dpi=300)
plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')

plt.plot(lengths_before, times_before, marker='o', color='#C0392B', linewidth=2.5, label='ÖNCE (Korumasız Regex: O(2^N) Üstel Kilitlenme)')
plt.plot(lengths_before, times_after, marker='s', color='#27AE60', linewidth=2.5, label='SONRA (Güvenli RE2 Mimari: O(N) Sabit Zamanlı)')

plt.title('ReDoS Doğrulama Testi: Kötü Niyetli Girdi Boyutuna Göre İşlem Süresi', fontsize=14, fontweight='bold', pad=15, color='#1F4E79')
plt.xlabel('Kötü Niyetli Girdi Uzunluğu (Karakter Sayısı)', fontsize=11, labelpad=10)
plt.ylabel('İşlem Süresi (Milisaniye - ms)', fontsize=11, labelpad=10)

plt.axhline(y=1000, color='#E67E22', linestyle='--', alpha=0.7, label='1.000 ms (Kritik Gecikme Eşiği)')

# Vurgular
plt.annotate('29 char: 4.292 ms\n(Event Loop Kilitlendi)', 
             xy=(29, 4292.980), xytext=(24, 3800),
             arrowprops=dict(facecolor='#C0392B', shrink=0.08, width=1.5, headwidth=8),
             fontweight='bold', color='#922B21', bbox=dict(boxstyle="round,pad=0.4", fc="#FDEDEC", ec="#C0392B", lw=1))

plt.annotate('29 char: < 0.05 ms\n(Anında Yanıt)', 
             xy=(29, 0.048), xytext=(24, 600),
             arrowprops=dict(facecolor='#27AE60', shrink=0.08, width=1.5, headwidth=8),
             fontweight='bold', color='#196F3D', bbox=dict(boxstyle="round,pad=0.4", fc="#EAFAF1", ec="#27AE60", lw=1))

plt.yscale('log')
plt.ylabel('İşlem Süresi (ms - Logaritmik Ölçek)', fontsize=11, labelpad=10)
plt.grid(True, which="both", ls="--", alpha=0.5)
plt.legend(loc='upper left', frameon=True, facecolor='white', framealpha=0.9)

output_path = 'tests/redos_comparison_chart.png'
plt.tight_layout()
plt.savefig(output_path)
plt.close()

print(f"Grafik üretildi: {output_path}")

