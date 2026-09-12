import {json,getQuery,fetchJson} from './_lib/http.js';
import {technicalSnapshot,advancedSignal,num} from './_lib/indicators.js';
const B={'15m':'15m','1h':'1h','4h':'4h','1d':'1d'},T={'15m':'15min','1h':'1h','4h':'4h','1d':'1day'};
function pk(r){return(r||[]).map(v=>({time:Number(v[0]),open:num(v[1]),high:num(v[2]),low:num(v[3]),close:num(v[4]),volume:num(v[5],0)})).filter(x=>Number.isFinite(x.close))}
function pt(d){return(d.values||[]).map(v=>({time:new Date(v.datetime).getTime(),open:num(v.open),high:num(v.high),low:num(v.low),close:num(v.close),volume:num(v.volume,0)})).filter(x=>Number.isFinite(x.close)).reverse()}
async function load(type,symbol,tf){
 if(type==='crypto'){
  try{return pk(await fetchJson(`https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(symbol+'USDT')}&interval=${B[tf]}&limit=320`))}
  catch(e){const key=process.env.TWELVEDATA_API_KEY;if(!key)throw e;const d=await fetchJson(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol+'/USD')}&interval=${T[tf]}&outputsize=320`,{headers:{Authorization:`apikey ${key}`}});return pt(d)}
 }
 const key=process.env.TWELVEDATA_API_KEY;if(!key)throw new Error('TWELVEDATA_API_KEY belum dikonfigurasi.');
 const d=await fetchJson(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${T[tf]}&outputsize=320`,{headers:{Authorization:`apikey ${key}`}});return pt(d)
}
export default async function handler(req,res){
 try{
  const q=getQuery(req),type=String(q.type||'crypto'),symbol=String(q.symbol||'').trim().toUpperCase(),tf=B[q.tf]?q.tf:'4h',horizon=tf==='15m'?12:tf==='1h'?8:tf==='4h'?6:4;
  const candles=await load(type,symbol,tf);if(candles.length<100)return json(res,422,{ok:false,error:'History belum cukup untuk validasi.'});
  const samples=[];
  for(let i=65;i<candles.length-horizon;i+=2){
   const slice=candles.slice(0,i+1),vals=slice.map(x=>x.close),t=technicalSnapshot(vals,slice),s=advancedSignal(t,slice);
   if(!['BUY','SELL'].includes(s.label))continue;
   const p=slice.at(-1).close,f=candles[i+horizon].close,ret=(f/p-1)*100,signed=s.label==='BUY'?ret:-ret;
   samples.push({label:s.label,ret,signed,hit:signed>0});
  }
  const n=samples.length,hits=samples.filter(x=>x.hit).length,hitRate=n?hits/n*100:null,exp=n?samples.reduce((a,b)=>a+b.signed,0)/n:null;
  const wins=samples.filter(x=>x.signed>0),loss=samples.filter(x=>x.signed<=0),avg=(a)=>a.length?a.reduce((x,y)=>x+y.signed,0)/a.length:null;
  let grade='INSUFFICIENT',tone='wait';if(n>=8){if(hitRate>=62&&exp>0){grade='STRONG';tone='buy'}else if(hitRate>=54&&exp>0){grade='USABLE';tone='hold'}else if(hitRate<48||exp<0){grade='WEAK';tone='sell'}else grade='MIXED'}
  json(res,200,{ok:true,symbol,type,timeframe:tf,horizonBars:horizon,sampleSize:n,hitRate:hitRate==null?null:Number(hitRate.toFixed(1)),expectancyPct:exp==null?null:Number(exp.toFixed(3)),avgWinPct:avg(wins)==null?null:Number(avg(wins).toFixed(3)),avgLossPct:avg(loss)==null?null:Number(avg(loss).toFixed(3)),grade,tone,method:'walk-forward heuristic validation on prior bars; not out-of-sample guarantee'},'public, s-maxage=300, stale-while-revalidate=900');
 }catch(e){json(res,502,{ok:false,error:e.message})}
}
