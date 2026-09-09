# Investment AI OS v8 — Power Core

V8 adalah upgrade besar dari V7.3 dan tetap memakai arsitektur Vercel Stable (tanpa backend WebSocket custom).

## Fitur utama

### Decision Intelligence
- Multi-Timeframe 15M + 1H + 4H + 1D
- Market Regime
- Timing Quality
- Strict Validated Buy
- Historical validation
- Explainable AI contribution
- Data Quality Gate
- Asset-specific model:
  - Major crypto / altcoin
  - Meme coin
  - Stocks
  - XAU/USD

### Crypto Power Layer
- Binance public live price
- Binance order book + aggTrades
- Cumulative delta proxy
- Bid/ask wall ratio
- Futures funding
- Open interest + OI change
- Global long/short ratio
- CoinGecko supply / FDV / developer context
- BTC mempool context
- Meme risk filter

### Stocks / Gold
- Twelve Data quote + OHLC
- Alpha Vantage fundamentals
- News/event risk
- Earnings calendar guard
- Macro context:
  - US 10Y Treasury yield
  - Fed Funds
  - CPI

### Portfolio Intelligence
- Manual positions
- Live mark-to-market
- Unrealized P/L
- Adaptive position sizing
- 90-day return correlation
- Exposure-aware workflow

### Calibration + Paper Trading
- Signal memory
- Signal outcome check after >=4 hours
- Local hit rate
- Bounded calibration modifier
- Paper BUY/SELL
- TP/STOP monitoring
- Paper performance

### Server Agent
`/api/agent-run` dapat dipanggil scheduler secara periodik.
Jika Upstash dikonfigurasi, hasil terbaru disimpan dan dibaca melalui `/api/agent-feed`.

Penting: `vercel.json` utama sengaja TIDAK memaksa cron agar deployment tetap kompatibel dengan plan Vercel yang berbeda.
Contoh cron tersedia di `vercel-cron.example.json`.
Jika plan Anda mendukung cron hourly, gabungkan bagian `crons` ke `vercel.json`.

### Download App / PWA
Website sudah installable sebagai PWA.
- Tombol **Download App** tersedia di header.
- Android Chrome: akan memunculkan native install prompt jika browser mengizinkan.
- iOS Safari: Share -> Add to Home Screen.
- Core UI dicache oleh service worker.
- Icon 192px dan 512px disertakan.

## Environment Variables

Minimal:
`TWELVEDATA_API_KEY`

Recommended:
`COINGECKO_API_KEY`
`ALPHAVANTAGE_API_KEY`

Optional 24/7 server-agent persistence:
`UPSTASH_REDIS_REST_URL`
`UPSTASH_REDIS_REST_TOKEN`
`CRON_SECRET`

Tidak perlu:
`BINANCE_API_KEY`
`BINANCE_SECRET`

## Deploy
1. Replace seluruh file versi lama dengan isi folder V8.
2. Pastikan `api/stream.js` TIDAK ada.
3. Vercel Framework Preset: Other.
4. Build Command / Output Directory: default/kosong.
5. Tambahkan env variables.
6. Redeploy.

## Catatan penting
- `100/100 Validated Buy` berarti seluruh gate model lolos, bukan jaminan profit 100%.
- Calibration local baru bermakna setelah jumlah sampel cukup.
- On-chain layer generic adalah network/supply context; BTC mendapat tambahan mempool context.
- Server agent 24/7 membutuhkan scheduler eksternal/Vercel Cron dan, untuk persistence lintas instance, Upstash.
