# Investment AI OS v7.3 — Validated Buy Alert

V7.2 menghapus backend WebSocket server (`api/stream.js`) dan dependency `ws`
agar deployment lebih stabil pada Vercel.

## Arsitektur realtime

### Crypto
- CoinGecko untuk discovery Crypto/Meme.
- Binance public WebSocket langsung dari browser untuk harga live.
- Binance REST untuk OHLC / candlestick / order flow jika pair tersedia.

### Saham + XAU/USD
- Twelve Data melalui `/api/quotes`.
- Auto-refresh setiap 15 detik.
- API key tetap aman di server/Vercel Environment Variables.
- Tidak ada API key yang dikirim ke browser.

## Fitur analisis tetap ada
- Market Regime
- Multi-Timeframe 15M + 1H + 4H + 1D
- Timing Quality
- Order Flow crypto
- Historical validation
- Fundamental + news/event risk
- Meme Coin
- Opportunity Scanner
- Candlestick
- Entry / Target / Invalidation / Support / Resistance
- Watchlist
- Mobile/Desktop professional UI

## Environment Variables

Wajib agar saham + Gold aktif:
`TWELVEDATA_API_KEY`

Direkomendasikan:
`COINGECKO_API_KEY`

Opsional untuk fundamental/news:
`ALPHAVANTAGE_API_KEY`

Tidak perlu:
- BINANCE_API_KEY
- BINANCE_SECRET
- WebSocket backend setting
- package `ws`
- Fluid Compute untuk fungsi stream custom

## Deploy ke Vercel

1. Upload seluruh isi folder project ke root repository GitHub.
2. Pastikan repository TIDAK punya `api/stream.js` lama.
3. Pastikan `package.json` dari V7.2 ikut menggantikan versi lama.
4. Vercel -> Add New Project / import repo.
5. Framework Preset: Other.
6. Build Command: kosong/default.
7. Output Directory: kosong/default.
8. Install Command: kosong/default.
9. Tambahkan Environment Variables.
10. Deploy.

Jika memakai repository V7 lama, hapus cache/deploy ulang setelah file lama diganti.

## Catatan
`Model Confidence` adalah keselarasan evidence, bukan probabilitas pasti profit.


## V7.3 Validated Buy Alert
Notifikasi hanya dipicu jika Validation Score = 100/100, artinya seluruh 10 gate model lolos:
1. Final Decision BUY
2. Multi-Timeframe BUY
3. Minimal 3 timeframe BUY dan tidak ada SELL
4. MTF confidence >=82%
5. Timing >=78 dan GOOD/EXCELLENT ENTRY
6. Trend >=75 + RSI sehat + active signal BUY
7. Historical validation: sample >=10, hit rate >=58%, expectancy positif
8. Market regime mendukung
9. Event risk LOW/MEDIUM
10. Asset-specific confirmation (order flow crypto / fundamental saham / gold context)

100/100 adalah kelulusan semua gate model, bukan jaminan profit 100%.
Browser notification memerlukan HTTPS dan izin pengguna. Jika izin ditolak, in-app toast tetap tersedia selama website terbuka.
