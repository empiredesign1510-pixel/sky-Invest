import {json,getQuery,fetchJson} from './_lib/http.js';
import {technicalSnapshot,advancedSignal,tradeLevels,indicatorSummary,num} from './_lib/indicators.js';

const BTF={'5m':'5m','15m':'15m','1h':'1h','4h':'4h','1d':'1d','1w':'1w'};
const TTF={'5m':'5min','15m':'15min','1h':'1h','4h':'4h','1d':'1day','1w':'1week'};
function validSymbol(s){return /^[A-Z0-9]{2,20}$/.test(s)}
function parseBinance(rows){return(rows||[]).map(v=>({time:Number(v[0]),date:new Date(Number(v[0])).toISOString(),open:num(v[1]),high:num(v[2]),low:num(v[3]),close:num(v[4]),volume:num(v[5],0),closeTime:Number(v[6])})).filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite))}
function parseTwelve(d){return(d.values||[]).map(v=>({time:new Date(v.datetime).getTime(),date:v.datetime,open:num(v.open),high:num(v.high),low:num(v.low),close:num(v.close),volume:num(v.volume,0)})).filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite)).reverse()}

async function fromBinance(base,tf){
  const pair=`${base}USDT`;
  const rows=await fetchJson(`https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${BTF[tf]}&limit=180`);
  return{candles:parseBinance(rows),source:`Binance Spot ${BTF[tf]} OHLC`,pair};
}
async function fromTwelve(base,tf){
  const key=process.env.TWELVEDATA_API_KEY;
  if(!key)throw new Error('Pair tidak ada di Binance dan fallback Twelve Data belum dikonfigurasi.');
  const symbol=`${base}/USD`,headers={Authorization:`apikey ${key}`};
  const d=await fetchJson(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${TTF[tf]}&outputsize=180`,{headers});
  if(d.status==='error')throw new Error(d.message);
  return{candles:parseTwelve(d),source:`Twelve Data ${TTF[tf]} OHLC fallback`,pair:symbol};
}

export default async function handler(req,res){
  try{
    const q=getQuery(req),base=String(q.symbol||'').trim().toUpperCase(),tf=BTF[q.tf]?q.tf:'4h';
    if(!validSymbol(base))return json(res,400,{ok:false,error:'Symbol crypto tidak valid.'});
    if(['USDT','USDC','DAI','FDUSD','TUSD'].includes(base))return json(res,422,{ok:false,error:'Stablecoin tidak dianalisis sebagai pair terhadap USD.'});

    let payload;
    try{payload=await fromBinance(base,tf)}
    catch(e){
      const msg=String(e?.payload?.msg||e.message||'');
      if(!msg.includes('Invalid symbol')&&!msg.includes('400'))throw e;
      payload=await fromTwelve(base,tf);
    }

    const candles=payload.candles,vals=candles.map(x=>x.close);
    if(vals.length<55)return json(res,422,{ok:false,error:`History ${payload.pair} belum cukup.`});
    const tech=technicalSnapshot(vals,candles),signal=advancedSignal(tech,candles),
      levels=tradeLevels(tech,candles,signal),indicators=indicatorSummary(tech,candles);

    json(res,200,{
      ok:true,symbol:base,pair:payload.pair,timeframe:tf,quote:{price:tech.latest,timestamp:candles.at(-1)?.closeTime||candles.at(-1)?.time||Date.now()},
      technical:tech,indicators,signal,levels,history:candles.slice(-120),source:payload.source
    },'public, s-maxage=8, stale-while-revalidate=16');
  }catch(e){
    json(res,502,{ok:false,error:String(e.message||'Data candlestick tidak tersedia untuk aset ini.')});
  }
}
