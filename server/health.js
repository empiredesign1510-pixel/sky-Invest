import {json} from './_lib/http.js';
import {kvConfigured} from './_lib/kv.js';

export default async function handler(req,res){
  json(res,200,{
    ok:true,version:'8.1.2',deploymentMode:'vercel-stable',
    crypto:{provider:'CoinGecko + Binance',configured:true,liveMode:'Browser WebSocket'},
    stockGold:{provider:'Twelve Data',configured:Boolean(process.env.TWELVEDATA_API_KEY),liveMode:'REST auto-refresh 15s'},
    context:{provider:'Alpha Vantage',configured:Boolean(process.env.ALPHAVANTAGE_API_KEY)},
    serverAgent:{configured:kvConfigured(),secured:Boolean(process.env.AGENT_SECRET),mode:'optional scheduled HTTP agent'},
    pwa:{installable:true},
    features:[
      'unified-decision-engine','best-available-today','decision-filters','daily-command-center','multi-timeframe','market-regime','order-flow','derivatives',
      'network-onchain-context','macro-intelligence','earnings-event-guard','asset-specific-models',
      'historical-validation','calibration-lab','portfolio-intelligence','adaptive-position-sizing',
      'correlation-engine','paper-trading','data-quality-gate','explainable-ai',
      'meme-risk-filter','validated-buy-alert','pwa-install'
    ],
    time:new Date().toISOString()
  },'public, s-maxage=15, stale-while-revalidate=30');
}
