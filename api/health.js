import {json} from './_lib/http.js';

export default async function handler(req,res){
  json(res,200,{
    ok:true,
    version:'7.2.0',
    deploymentMode:'vercel-stable',
    crypto:{
      provider:'CoinGecko + Binance public market data',
      configured:true,
      liveMode:'Browser WebSocket'
    },
    stockGold:{
      provider:'Twelve Data',
      configured:Boolean(process.env.TWELVEDATA_API_KEY),
      liveMode:'REST auto-refresh 15s'
    },
    context:{
      provider:'Alpha Vantage',
      configured:Boolean(process.env.ALPHAVANTAGE_API_KEY)
    },
    features:[
      'professional-ui','market-regime','opportunity-scanner','order-flow',
      'multi-timeframe','timing-quality','historical-validation',
      'news-event-risk','meme-coins','candlestick','trade-levels',
      'mobile-scroll-fix','vercel-stable-mode'
    ],
    time:new Date().toISOString()
  },'public, s-maxage=10, stale-while-revalidate=20');
}
