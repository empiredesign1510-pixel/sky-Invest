# Investment AI OS v8.1.1 — Vercel Hobby Fix

## Perbaikan deployment
Versi V8.1 sebelumnya memiliki 19 endpoint JavaScript langsung di `/api`.
Pada Vercel Hobby, direct Vercel Functions dibatasi 12 per deployment.

V8.1.1 mengubah arsitektur menjadi:

Frontend
→ /api/<route>
→ Vercel rewrite
→ /api/index.js
→ server/<route>.js

Jadi Vercel hanya membangun **1 Function**, sedangkan semua mesin analisis tetap tersedia.

## Penting saat upload ke GitHub
Hapus folder `/api` versi lama terlebih dahulu atau pastikan repository akhirnya hanya memiliki:

api/
  index.js

Semua file seperti:
- analyze.js
- crypto.js
- multi-analyze.js
- orderflow.js
- derivatives.js
- onchain.js
- macro.js
- events.js
dan endpoint lain sekarang berada di:

server/

Jangan membiarkan salinan lama tetap berada di `/api`, karena akan dihitung lagi sebagai Function.

# Investment AI OS v8.1 — Unified Decision

Upgrade utama V8.1 adalah sinkronisasi keputusan.

## Masalah yang diperbaiki
Versi sebelumnya memakai quick signal di beranda tetapi full decision engine di detail.
Akibatnya sebuah aset dapat terlihat BUY di market list tetapi berubah WAIT & SEE ketika dibuka.

V8.1 tidak lagi menampilkan quick signal sebagai keputusan utama.
BUY/HOLD/WAIT/SELL di market list berasal dari Unified Decision Engine yang sama dengan detail.

## Decision Anchor
Final Decision dikunci ke:
- 4H Core
- Multi-timeframe 15M + 1H + 4H + 1D
- Order Flow
- Derivatives
- Historical Validation
- Event / News Risk
- Network Context
- Market Regime
- Macro/Fundamental sesuai kelas aset
- Data Quality
- Timing Quality
- Risk/Reward guard

Mengubah tombol timeframe di detail hanya mengubah chart + indicator snapshot.
Final Decision tetap menggunakan anchor yang sama agar tidak berubah hanya karena user mengganti tampilan chart.

## Filter baru
Market memiliki dua filter:
1. Instrumen: Semua / Crypto / Meme / Saham / Gold
2. Keputusan: Semua / BUY / HOLD / WAIT / SELL / VALIDATED

Filter keputusan hanya menampilkan instrumen yang sudah selesai dianalisis oleh Unified Decision Engine.

## Best Available Today
Aplikasi melakukan scan bertahap:
1. Pre-filter multi-timeframe
2. Deep analysis kandidat terbaik
3. Ranking berdasarkan:
   - final decision
   - confidence
   - validation score
   - timing score
   - data quality
   - risk/reward

Aplikasi selalu menampilkan kandidat terbaik yang tersedia.
Namun sistem tidak memaksa adanya BUY setiap hari. Jika tidak ada setup yang memenuhi quality gate,
judul akan menyatakan bahwa belum ada BUY berkualitas dan menampilkan kandidat WATCH terbaik.

Ini sengaja dilakukan untuk mengurangi false-positive.

## BUY guard
BUY dapat diturunkan menjadi HOLD/WAIT bila:
- MTF bukan BUY
- timing chasing
- risk/reward < 1.5x
- event risk HIGH
- historical expectancy negatif
- data quality rendah
- meme risk terlalu tinggi

## Deployment
Environment Variables tetap:
- TWELVEDATA_API_KEY
- COINGECKO_API_KEY
- ALPHAVANTAGE_API_KEY

Optional:
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- AGENT_SECRET

Tidak memerlukan BINANCE_API_KEY atau BINANCE_SECRET.
Tetap memakai Vercel Stable architecture tanpa api/stream.js.
