export const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
export const num=(v,f=null)=>Number.isFinite(Number(v))?Number(v):f;
export function sma(a,p){if(!a||a.length<p)return null;return a.slice(-p).reduce((x,y)=>x+y,0)/p}
export function emaSeries(a,p){if(!a||a.length<p)return[];const k=2/(p+1),o=new Array(p-1).fill(null);let v=a.slice(0,p).reduce((x,y)=>x+y,0)/p;o.push(v);for(let i=p;i<a.length;i++){v=a[i]*k+v*(1-k);o.push(v)}return o}
export function ema(a,p){const x=emaSeries(a,p).filter(v=>v!=null);return x.length?x.at(-1):null}
export function rsi(a,p=14){if(!a||a.length<=p)return null;const d=[];for(let i=1;i<a.length;i++)d.push(a[i]-a[i-1]);let g=0,l=0;for(let i=0;i<p;i++){g+=Math.max(d[i],0);l+=Math.max(-d[i],0)}g/=p;l/=p;for(let i=p;i<d.length;i++){g=(g*(p-1)+Math.max(d[i],0))/p;l=(l*(p-1)+Math.max(-d[i],0))/p}if(l===0)return 100;const rs=g/l;return 100-100/(1+rs)}
export function macd(a,f=12,s=26,sp=9){if(!a||a.length<s+sp)return null;const F=emaSeries(a,f),S=emaSeries(a,s),m=a.map((_,i)=>F[i]==null||S[i]==null?null:F[i]-S[i]),c=m.filter(v=>v!=null),sig=emaSeries(c,sp).filter(v=>v!=null);if(!sig.length)return null;return{macd:c.at(-1),signal:sig.at(-1),histogram:c.at(-1)-sig.at(-1)}}
export function atr(c,p=14){if(!c||c.length<=p)return null;const tr=[];for(let i=1;i<c.length;i++){const x=c[i],z=c[i-1];tr.push(Math.max(x.high-x.low,Math.abs(x.high-z.close),Math.abs(x.low-z.close)))}let v=tr.slice(0,p).reduce((a,b)=>a+b,0)/p;for(let i=p;i<tr.length;i++)v=(v*(p-1)+tr[i])/p;return v}
export function technicalSnapshot(values,candles=null){const latest=values.at(-1),e20=ema(values,20),e50=ema(values,50),R=rsi(values),M=macd(values),A=candles?atr(candles):null;let trend=50;trend+=e20!=null&&latest>e20?15:-10;trend+=e50!=null&&latest>e50?15:-10;trend+=e20!=null&&e50!=null&&e20>e50?15:-8;let mom=50;if(R!=null){if(R>=50&&R<=70)mom+=20;else if(R>70&&R<=78)mom+=5;else if(R<35)mom-=10;else if(R>78)mom-=18}if(M?.histogram>0)mom+=15;else if(M)mom-=10;return{latest,ema20:e20,ema50:e50,rsi14:R,macd:M,atr14:A,trendScore:Math.round(clamp(trend)),momentumScore:Math.round(clamp(mom))}}

export function supportResistance(candles,lookback=70){
  if(!candles?.length)return{support:null,resistance:null};
  const c=candles.slice(-lookback),price=c.at(-1).close,lows=[],highs=[];
  for(let i=2;i<c.length-2;i++){
    if(c[i].low<=c[i-1].low&&c[i].low<=c[i-2].low&&c[i].low<=c[i+1].low&&c[i].low<=c[i+2].low)lows.push(c[i].low);
    if(c[i].high>=c[i-1].high&&c[i].high>=c[i-2].high&&c[i].high>=c[i+1].high&&c[i].high>=c[i+2].high)highs.push(c[i].high);
  }
  let support=lows.filter(x=>x<price).sort((a,b)=>b-a)[0]??Math.min(...c.slice(-25).map(x=>x.low));
  let resistance=highs.filter(x=>x>price).sort((a,b)=>a-b)[0]??Math.max(...c.slice(-25).map(x=>x.high));
  if(!Number.isFinite(support))support=null;if(!Number.isFinite(resistance))resistance=null;
  return{support,resistance};
}

export function volumeSnapshot(candles){
  if(!candles?.length)return{ratio:null,score:50,available:false};
  const vols=candles.slice(-21).map(x=>Number(x.volume)||0);
  const latest=vols.at(-1),base=vols.slice(0,-1).filter(v=>v>0);
  if(!latest||base.length<5)return{ratio:null,score:50,available:false};
  const avg=base.reduce((a,b)=>a+b,0)/base.length,ratio=avg?latest/avg:null;
  const score=ratio==null?50:ratio>=1.8?90:ratio>=1.25?75:ratio>=.8?58:42;
  return{ratio,score,available:true};
}

export function advancedSignal(t,candles){
  const p=t.latest,e20=t.ema20,e50=t.ema50,r=t.rsi14,mh=t.macd?.histogram??0;
  const sr=supportResistance(candles),vol=volumeSnapshot(candles);
  let direction=0,aligned=0,total=0,reasons=[],warnings=[];
  const vote=(cond,weight,posText,negText)=>{total+=Math.abs(weight);direction+=cond?weight:-weight;if(cond){aligned+=Math.abs(weight);if(posText)reasons.push(posText)}else if(negText)warnings.push(negText)};
  if(e20!=null){vote(p>e20,14,'Harga di atas EMA20','Harga di bawah EMA20')}
  if(e50!=null){vote(p>e50,14,'Harga di atas EMA50','Harga di bawah EMA50')}
  if(e20!=null&&e50!=null){vote(e20>e50,18,'EMA20 berada di atas EMA50','EMA20 berada di bawah EMA50')}
  if(t.macd){vote(mh>=0,14,'MACD mendukung momentum naik','MACD masih negatif')}
  if(r!=null){total+=14;if(r>=50&&r<=70){direction+=14;aligned+=14;reasons.push(`RSI sehat di ${r.toFixed(1)}`)}else if(r<45){direction-=12;warnings.push(`RSI lemah di ${r.toFixed(1)}`)}else if(r>76){direction+=2;warnings.push(`RSI panas di ${r.toFixed(1)}`)}else direction+=4}
  if(vol.available){total+=10;if(vol.ratio>=1.15){direction+=10;aligned+=10;reasons.push(`Volume ${vol.ratio.toFixed(1)}x rata-rata`)}else{direction-=2;warnings.push('Volume belum mengonfirmasi')}}
  if(sr.support!=null&&sr.resistance!=null){total+=8;const pos=(p-sr.support)/(Math.max(sr.resistance-sr.support,Number.EPSILON));if(pos<.35){direction+=5;reasons.push('Harga relatif dekat support')}else if(pos>.82){direction-=3;warnings.push('Harga dekat resistance')}else direction+=2}
  const consistency=total?Math.abs(direction)/total:0;
  let confidence=Math.round(clamp(55+consistency*38,55,93));
  let label='WAIT & SEE',tone='wait';
  const bullish=e20!=null&&e50!=null&&p>e20&&e20>e50;
  const bearish=e20!=null&&e50!=null&&p<e20&&e20<e50;
  if(direction>=38&&bullish&&r<=75){label='BUY';tone='buy'}
  else if(direction>=18&&bullish){label='HOLD';tone='hold'}
  else if(direction<=-36&&bearish){label='SELL';tone='sell'}
  if(label==='BUY'&&r>72){label='HOLD';tone='hold';confidence=Math.min(confidence,78);warnings.push('Momentum sudah cukup panas untuk entry baru')}
  if(label==='WAIT & SEE')confidence=Math.min(confidence,72);
  const reason=(label==='BUY'?'Konfirmasi bullish cukup selaras. ':label==='SELL'?'Konfirmasi bearish cukup selaras. ':label==='HOLD'?'Trend masih positif, namun entry baru belum ideal. ':'Indikator belum cukup selaras. ')+(reasons.slice(0,2).join(' • ')||warnings.slice(0,2).join(' • '));
  return{label,tone,confidence,directionalScore:Math.round(direction),reason,reasons:reasons.slice(0,4),warnings:warnings.slice(0,3),support:sr.support,resistance:sr.resistance,volumeRatio:vol.ratio};
}

export function tradeLevels(t,candles,signal){
  const p=t.latest,atrv=t.atr14||Math.max(p*.01,Number.EPSILON),sr=supportResistance(candles),support=sr.support,resistance=sr.resistance;
  if(signal?.label==='SELL'){
    const invalidation=(resistance&&resistance>p?resistance:p+atrv*1.2)+atrv*.25;
    const target1=support&&support<p?support:p-atrv*2;
    const target2=Math.max(0,Math.min(target1-atrv*1.5,p-atrv*3.5));
    return{entryLow:p-atrv*.2,entryHigh:p+atrv*.35,target1,target2,invalidation,support,resistance};
  }
  const anchor=t.ema20||p;
  const entryLow=Math.max(0,Math.max(support||0,anchor-atrv*.55));
  const entryHigh=Math.max(entryLow,Math.min(p+atrv*.1,anchor+atrv*.25));
  const invalidation=Math.max(0,(support&&support<p?support:Math.min(t.ema50||p,p))-atrv*.45);
  const target1=resistance&&resistance>p*1.001?resistance:p+atrv*2;
  const target2=Math.max(target1+atrv*1.3,p+atrv*3.6);
  return{entryLow,entryHigh,target1,target2,invalidation,support,resistance};
}

export function quickCryptoSignal(c){const p7=Number(c.change7d)||0,p30=Number(c.change30d)||0,s=Number(c.marketScore)||50,r=Number(c.riskPenalty)||0;if(s>=80&&p7>0&&p30>0&&r<16)return{label:'BUY',tone:'buy',confidence:70,reason:'Momentum multi-minggu positif dan risk gate masih terkendali.'};if(s>=67&&p30>0)return{label:'HOLD',tone:'hold',confidence:64,reason:'Struktur pasar masih positif, tetapi entry baru perlu konfirmasi timeframe.'};if(s<50&&p7<0&&p30<0)return{label:'SELL',tone:'sell',confidence:66,reason:'Momentum mingguan dan bulanan sama-sama melemah.'};return{label:'WAIT & SEE',tone:'wait',confidence:58,reason:'Belum ada konfirmasi arah yang cukup konsisten.'}}


export function indicatorSummary(t,candles){
  const p=t?.latest,e20=t?.ema20,e50=t?.ema50,r=t?.rsi14,m=t?.macd?.histogram??0,vol=volumeSnapshot(candles),sr=supportResistance(candles);
  let trend={label:'Netral',tone:'wait',score:t?.trendScore??50};
  if(Number.isFinite(p)&&Number.isFinite(e20)&&Number.isFinite(e50)){
    if(p>e20&&e20>e50)trend={label:'Bullish',tone:'buy',score:t.trendScore};
    else if(p<e20&&e20<e50)trend={label:'Bearish',tone:'sell',score:t.trendScore};
  }
  let momentum={label:'Netral',tone:'wait'};
  if(m>0&&(r==null||r>=48))momentum={label:'Positif',tone:'buy'};
  else if(m<0&&(r==null||r<50))momentum={label:'Negatif',tone:'sell'};
  let rsiState={label:'Netral',tone:'wait',value:r};
  if(r!=null){
    if(r>=50&&r<=70)rsiState={label:'Sehat',tone:'buy',value:r};
    else if(r>75)rsiState={label:'Panas',tone:'hold',value:r};
    else if(r<40)rsiState={label:'Lemah',tone:'sell',value:r};
  }
  let volume={label:'Normal',tone:'wait',ratio:vol.ratio};
  if(vol.available){
    if(vol.ratio>=1.35)volume={label:'Kuat',tone:'buy',ratio:vol.ratio};
    else if(vol.ratio<.7)volume={label:'Tipis',tone:'hold',ratio:vol.ratio};
  } else volume={label:'N/A',tone:'wait',ratio:null};

  let position={label:'Tengah Range',tone:'wait'};
  if(sr.support!=null&&sr.resistance!=null&&Number.isFinite(p)){
    const span=Math.max(sr.resistance-sr.support,Number.EPSILON),pos=(p-sr.support)/span;
    if(pos<.28)position={label:'Dekat Support',tone:'buy'};
    else if(pos>.82)position={label:'Dekat Resistance',tone:'hold'};
  }
  return{trend,momentum,rsi:rsiState,volume,position,support:sr.support,resistance:sr.resistance};
}

export function multiTimeframeSummary(frames){
  const weights={'15m':.15,'1h':.25,'4h':.35,'1d':.25};
  let weighted=0,used=0,buy=0,hold=0,sell=0,wait=0,confidenceWeighted=0;
  const numeric={BUY:2,HOLD:1,'WAIT & SEE':0,SELL:-2};
  for(const f of frames||[]){
    if(!f?.ok||!f.signal)continue;
    const w=weights[f.timeframe]??.1,score=numeric[f.signal.label]??0;
    weighted+=score*w;confidenceWeighted+=(Number(f.signal.confidence)||55)*w;used+=w;
    if(f.signal.label==='BUY')buy++; else if(f.signal.label==='HOLD')hold++; else if(f.signal.label==='SELL')sell++; else wait++;
  }
  if(!used)return{label:'WAIT & SEE',tone:'wait',confidence:55,score:0,reason:'Multi-timeframe belum memiliki data cukup.'};
  weighted/=used;confidenceWeighted/=used;
  let label='WAIT & SEE',tone='wait';
  if(weighted>=1.15&&buy>=2){label='BUY';tone='buy'}
  else if(weighted>=.35&&(buy+hold)>=2){label='HOLD';tone='hold'}
  else if(weighted<=-1.0&&sell>=2){label='SELL';tone='sell'}
  let agreement=Math.max(buy,hold,sell,wait)/Math.max(1,buy+hold+sell+wait);
  let confidence=Math.round(clamp(confidenceWeighted*.72+(55+agreement*40)*.28,55,92));
  if(label==='WAIT & SEE')confidence=Math.min(confidence,72);
  const reason=label==='BUY'
    ?'Mayoritas timeframe utama selaras bullish.'
    :label==='SELL'
    ?'Mayoritas timeframe utama selaras bearish.'
    :label==='HOLD'
    ?'Struktur menengah masih positif, tetapi belum cukup seragam untuk BUY baru.'
    :'Timeframe utama belum searah; lebih aman menunggu konfirmasi.';
  return{label,tone,confidence,score:Number(weighted.toFixed(2)),reason,counts:{buy,hold,wait,sell}};
}


export function timingQuality(t,candles,signal,levels){
  const p=Number(t?.latest),a=Number(t?.atr14)||Math.max(Math.abs(p)*.01,Number.EPSILON),r=Number(t?.rsi14),L=levels||tradeLevels(t,candles,signal);
  if(!Number.isFinite(p))return{label:'WAIT',tone:'wait',score:50,reason:'Harga belum tersedia.'};
  let score=55,notes=[];
  const buyish=['BUY','HOLD'].includes(signal?.label);
  if(buyish){
    if(Number.isFinite(L.entryLow)&&Number.isFinite(L.entryHigh)){
      if(p>=L.entryLow&&p<=L.entryHigh){score+=24;notes.push('harga berada di area entry')}
      else if(p>L.entryHigh+a*.8){score-=24;notes.push('harga terlalu jauh dari area entry')}
      else if(p<L.entryLow-a*.6){score-=8;notes.push('belum reclaim area entry')}
      else {score+=8;notes.push('harga masih dekat area entry')}
    }
    if(Number.isFinite(r)){if(r>=50&&r<=68){score+=10;notes.push('RSI sehat')}else if(r>76){score-=18;notes.push('RSI terlalu panas')}else if(r<42){score-=8;notes.push('momentum masih lemah')}}
    if(Number.isFinite(L.resistance)){const d=(L.resistance-p)/a;if(d<.55){score-=15;notes.push('resistance terlalu dekat')}else if(d>1.4)score+=7}
  }else if(signal?.label==='SELL'){
    if(Number.isFinite(L.entryLow)&&Number.isFinite(L.entryHigh)&&p>=L.entryLow&&p<=L.entryHigh){score+=18;notes.push('harga berada di area distribusi model')}
    if(Number.isFinite(r)&&r<42)score+=9;
  }else score-=5;
  score=Math.round(clamp(score,20,92));
  let label='WAIT FOR SETUP',tone='wait';
  if(signal?.label==='SELL'&&score>=68){label='REDUCE / EXIT';tone='sell'}
  else if(buyish&&score>=82){label='EXCELLENT ENTRY';tone='buy'}
  else if(buyish&&score>=70){label='GOOD ENTRY';tone='buy'}
  else if(buyish&&score>=55){label='WAIT PULLBACK';tone='hold'}
  else if(buyish){label='TOO LATE / CHASING';tone='sell'}
  return{label,tone,score,reason:notes.slice(0,3).join(' • ')||'Belum ada edge timing yang kuat.'};
}