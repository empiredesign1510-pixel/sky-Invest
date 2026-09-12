import {json,getQuery,fetchJson} from './_lib/http.js';
import {clamp} from './_lib/indicators.js';

export default async function handler(req,res){
  try{
    const q=getQuery(req),base=String(q.symbol||'').trim().toUpperCase();
    if(!/^[A-Z0-9]{2,20}$/.test(base)) return json(res,400,{ok:false,error:'Symbol crypto tidak valid.'});
    const symbol=`${base}USDT`;
    const [premium,oi,oiHist,ls]=await Promise.all([
      fetchJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`),
      fetchJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`),
      fetchJson(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${encodeURIComponent(symbol)}&period=5m&limit=3`).catch(()=>[]),
      fetchJson(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${encodeURIComponent(symbol)}&period=5m&limit=2`).catch(()=>[])
    ]);
    const funding=Number(premium.lastFundingRate||0)*100;
    const openInterest=Number(oi.openInterest||0);
    const hist=Array.isArray(oiHist)?oiHist:[];
    const oiNow=Number(hist.at(-1)?.sumOpenInterestValue||hist.at(-1)?.sumOpenInterest||0);
    const oiPrev=Number(hist.at(-2)?.sumOpenInterestValue||hist.at(-2)?.sumOpenInterest||0);
    const oiChange=oiPrev?((oiNow/oiPrev)-1)*100:null;
    const longShort=Number((Array.isArray(ls)?ls.at(-1):null)?.longShortRatio||0)||null;

    let score=55,notes=[];
    if(Math.abs(funding)<=0.02){score+=10;notes.push('funding sehat')}
    else if(funding>0.05){score-=14;notes.push('funding terlalu positif / crowded long')}
    else if(funding<-0.03){score+=5;notes.push('funding negatif dapat mendukung squeeze')}

    if(oiChange!=null){
      if(oiChange>0.4){score+=7;notes.push('open interest meningkat')}
      if(oiChange<-0.7){score-=5;notes.push('open interest turun')}
    }
    if(longShort!=null){
      if(longShort>1.7){score-=9;notes.push('long positioning terlalu padat')}
      else if(longShort<0.7){score+=4;notes.push('short positioning tinggi')}
    }
    score=Math.round(clamp(score,20,92));

    let label='NEUTRAL',tone='wait';
    if(score>=70){label='CONSTRUCTIVE';tone='buy'}
    else if(score<=42){label='OVERHEATED / RISKY';tone='sell'}
    else if(score>=60){label='HEALTHY';tone='hold'}

    json(res,200,{
      ok:true,symbol,label,tone,score,
      fundingRatePct:Number(funding.toFixed(4)),
      openInterest,
      openInterestChangePct:oiChange==null?null:Number(oiChange.toFixed(2)),
      longShortRatio:longShort==null?null:Number(longShort.toFixed(3)),
      nextFundingTime:Number(premium.nextFundingTime||0),
      markPrice:Number(premium.markPrice||0),
      reason:notes.join(' • ')||'Derivatives positioning netral.',
      source:'Binance USD-M Futures public market data'
    },'public, s-maxage=20, stale-while-revalidate=40');
  }catch(e){
    json(res,200,{ok:true,available:false,label:'N/A',tone:'wait',score:null,error:'Derivatives data tidak tersedia untuk pair ini.'});
  }
}
