# Investment AI OS v7.2 — Vercel Stable

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
