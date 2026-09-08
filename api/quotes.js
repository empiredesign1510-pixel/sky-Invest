import {json,getQuery,fetchJson} from './_lib/http.js';
const DEFAULT=['AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','XAU/USD'];
function allowed(s){return /^[A-Z0-9.\-/]{1,24}$/.test(s)}
function normalize(d){
  const arr=Array.isArray(d)?d:(d&&d.symbol?[d]:Object.values(d||{}).filter(x=>x&&typeof x==='object'));
  return arr.filter(x=>x.symbol).map(x=>({symbol:x.symbol,name:x.name||x.symbol,exchange:x.exchange||'',currency:x.currency||'USD',type:x.type||'',price:Number(x.close??x.price??x.extended_price),open:Number(x.open),high:Number(x.high),low:Number(x.low),previousClose:Number(x.previous_close),change:Number(x.change),percentChange:Number(x.percent_change),timestamp:Number(x.timestamp||x.last_quote_at||0)*1000,isMarketOpen:Boolean(x.is_market_open)})).filter(x=>Number.isFinite(x.price));
}
export default async function handler(req,res){const key=process.env.TWELVEDATA_API_KEY;if(!key)return json(res,503,{ok:false,error:'TWELVEDATA_API_KEY belum dikonfigurasi.'});try{const q=getQuery(req),syms=String(q.symbols||DEFAULT.join(',')).split(',').map(s=>s.trim().toUpperCase()).filter(allowed).slice(0,8);const d=await fetchJson(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(syms.join(','))}`,{headers:{Authorization:`apikey ${key}`}});if(d.status==='error')throw new Error(d.message||'Twelve Data error');json(res,200,{ok:true,data:normalize(d),source:'Twelve Data latest quote (auto-refresh client)'},'public, s-maxage=8, stale-while-revalidate=15')}catch(e){json(res,502,{ok:false,error:e.message})}}
