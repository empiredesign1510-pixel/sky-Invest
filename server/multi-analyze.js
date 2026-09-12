import {json,getQuery,fetchJson} from './_lib/http.js';
import {technicalSnapshot,advancedSignal,indicatorSummary,multiTimeframeSummary,num} from './_lib/indicators.js';

const FRAMES=['15m','1h','4h','1d'];
const BTF={'15m':'15m','1h':'1h','4h':'4h','1d':'1d'};
const TTF={'15m':'15min','1h':'1h','4h':'4h','1d':'1day'};

function parseBinance(rows){return(rows||[]).map(v=>({time:Number(v[0]),open:num(v[1]),high:num(v[2]),low:num(v[3]),close:num(v[4]),volume:num(v[5],0)})).filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite))}
function parseTwelve(d){return(d.values||[]).map(v=>({time:new Date(v.datetime).getTime(),open:num(v.open),high:num(v.high),low:num(v.low),close:num(v.close),volume:num(v.volume,0)})).filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite)).reverse()}

function analyzeCandles(candles,timeframe,source){
  const vals=candles.map(x=>x.close);
  if(vals.length<55)return{ok:false,timeframe,error:'history kurang'};
  const technical=technicalSnapshot(vals,candles),signal=advancedSignal(technical,candles),indicators=indicatorSummary(technical,candles);
  return{ok:true,timeframe,signal,technical:{rsi14:technical.rsi14,trendScore:technical.trendScore,momentumScore:technical.momentumScore},indicators,source};
}

async function cryptoFrame(base,tf){
  try{
    const pair=`${base}USDT`;
    const rows=await fetchJson(`https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${BTF[tf]}&limit=120`);
    return analyzeCandles(parseBinance(rows),tf,'Binance');
  }catch(e){
    const key=process.env.TWELVEDATA_API_KEY;
    if(!key)return{ok:false,timeframe:tf,error:'pair tidak ada di Binance'};
    try{
      const symbol=`${base}/USD`,headers={Authorization:`apikey ${key}`};
      const d=await fetchJson(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${TTF[tf]}&outputsize=120`,{headers});
      if(d.status==='error')throw new Error(d.message);
      return analyzeCandles(parseTwelve(d),tf,'Twelve Data fallback');
    }catch(err){return{ok:false,timeframe:tf,error:err.message}}
  }
}

async function twelveFrame(symbol,tf,key){
  try{
    const headers={Authorization:`apikey ${key}`};
    const d=await fetchJson(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${TTF[tf]}&outputsize=120`,{headers});
    if(d.status==='error')throw new Error(d.message);
    return analyzeCandles(parseTwelve(d),tf,'Twelve Data');
  }catch(e){return{ok:false,timeframe:tf,error:e.message}}
}

export default async function handler(req,res){
  try{
    const q=getQuery(req),type=String(q.type||'crypto').toLowerCase(),symbol=String(q.symbol||'').trim().toUpperCase();
    if(!symbol)return json(res,400,{ok:false,error:'Symbol wajib diisi.'});
    let frames;
    if(type==='crypto'){
      frames=await Promise.all(FRAMES.map(tf=>cryptoFrame(symbol,tf)));
    }else{
      const key=process.env.TWELVEDATA_API_KEY;
      if(!key)return json(res,503,{ok:false,error:'TWELVEDATA_API_KEY belum dikonfigurasi.'});
      frames=await Promise.all(FRAMES.map(tf=>twelveFrame(symbol,tf,key)));
    }
    const summary=multiTimeframeSummary(frames);
    json(res,200,{ok:true,symbol,type,frames,summary,method:'15m + 1h + 4h + 1d weighted confirmation'},'public, s-maxage=45, stale-while-revalidate=90');
  }catch(e){json(res,502,{ok:false,error:e.message})}
}
