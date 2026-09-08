import {json,getQuery,fetchJson} from './_lib/http.js';
import {technicalSnapshot,advancedSignal,tradeLevels,indicatorSummary,num} from './_lib/indicators.js';
const TF={
  '5m':'5min','15m':'15min','1h':'1h','4h':'4h','1d':'1day','1w':'1week'
};
function valid(s){return /^[A-Z0-9.\-/]{1,24}$/.test(s)}
function parseSeries(d){return(d.values||[]).map(v=>({time:new Date(v.datetime).getTime(),date:v.datetime,open:num(v.open),high:num(v.high),low:num(v.low),close:num(v.close),volume:num(v.volume,0)})).filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite)).reverse()}
export default async function handler(req,res){
  const key=process.env.TWELVEDATA_API_KEY;if(!key)return json(res,503,{ok:false,error:'TWELVEDATA_API_KEY belum dikonfigurasi.'});
  try{
    const q=getQuery(req),symbol=String(q.symbol||'').trim().toUpperCase(),tf=TF[q.tf] ? q.tf : '4h',interval=TF[tf];
    if(!valid(symbol))return json(res,400,{ok:false,error:'Symbol tidak valid.'});
    const headers={Authorization:`apikey ${key}`};
    const [quote,series]=await Promise.all([
      fetchJson(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}`,{headers}),
      fetchJson(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=180`,{headers})
    ]);
    if(quote.status==='error')throw new Error(quote.message);if(series.status==='error')throw new Error(series.message);
    const candles=parseSeries(series),vals=candles.map(x=>x.close);if(vals.length<55)return json(res,422,{ok:false,error:`Belum cukup bar ${interval} untuk menghitung signal.`});
    const tech=technicalSnapshot(vals,candles),signal=advancedSignal(tech,candles),levels=tradeLevels(tech,candles,signal),indicators=indicatorSummary(tech,candles),latest=Number(quote.close??quote.price??tech.latest);
    json(res,200,{ok:true,symbol,timeframe:tf,interval,name:quote.name||symbol,type:quote.type||series.meta?.type||'',exchange:quote.exchange||series.meta?.exchange||'',currency:quote.currency||series.meta?.currency||'USD',quote:{price:latest,open:Number(quote.open),high:Number(quote.high),low:Number(quote.low),previousClose:Number(quote.previous_close),percentChange:Number(quote.percent_change),timestamp:Number(quote.timestamp||quote.last_quote_at||0)*1000,isMarketOpen:Boolean(quote.is_market_open)},technical:tech,indicators,signal,levels,history:candles.slice(-120),source:`Twelve Data ${interval} OHLC + latest quote`},'public, s-maxage=12, stale-while-revalidate=24');
  }catch(e){json(res,502,{ok:false,error:e.message})}
}
