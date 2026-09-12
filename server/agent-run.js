import {json,fetchJson} from './_lib/http.js';
import {technicalSnapshot,advancedSignal,multiTimeframeSummary,num} from './_lib/indicators.js';
import {kvConfigured,kvSet} from './_lib/kv.js';

const universe=['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX'];
const tfMap={'15m':'15m','1h':'1h','4h':'4h','1d':'1d'};
function parse(rows){return(rows||[]).map(v=>({time:Number(v[0]),open:num(v[1]),high:num(v[2]),low:num(v[3]),close:num(v[4]),volume:num(v[5],0)})).filter(x=>Number.isFinite(x.close))}
async function frame(symbol,tf){
  const rows=await fetchJson(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}USDT&interval=${tfMap[tf]}&limit=120`);
  const candles=parse(rows),vals=candles.map(x=>x.close);
  const t=technicalSnapshot(vals,candles),signal=advancedSignal(t,candles);
  return{ok:true,timeframe:tf,signal};
}
export default async function handler(req,res){
  try{
    const secret=process.env.CRON_SECRET;
    if(secret){
      const auth=String(req.headers.authorization||'');
      if(auth!==`Bearer ${secret}`)return json(res,401,{ok:false,error:'Unauthorized'});
    }
    const alerts=[];
    for(const symbol of universe){
      try{
        const frames=await Promise.all(['15m','1h','4h','1d'].map(tf=>frame(symbol,tf)));
        const summary=multiTimeframeSummary(frames);
        if(summary.label==='BUY'&&summary.confidence>=80)alerts.push({symbol,summary,ts:Date.now()});
      }catch{}
    }
    const data={lastRun:new Date().toISOString(),alerts,universe};
    if(kvConfigured())await kvSet('investment-ai:agent:last',data,7200);
    json(res,200,{ok:true,persisted:kvConfigured(),...data});
  }catch(e){json(res,502,{ok:false,error:e.message})}
}
