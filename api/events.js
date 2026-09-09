import {json,getQuery} from './_lib/http.js';

function parseCsv(text){
  const lines=String(text||'').trim().split(/\r?\n/);
  if(lines.length<2)return[];
  const head=lines[0].split(',');
  return lines.slice(1).map(line=>{
    const vals=line.match(/(".*?"|[^",]+|(?<=,)(?=,))/g)||[];
    const o={};head.forEach((h,i)=>o[h]=String(vals[i]||'').replace(/^"|"$/g,''));return o;
  });
}
export default async function handler(req,res){
  const key=process.env.ALPHAVANTAGE_API_KEY;
  if(!key)return json(res,200,{ok:true,configured:false,level:'UNKNOWN',tone:'wait',events:[],reason:'Alpha Vantage key belum dikonfigurasi.'});
  try{
    const q=getQuery(req),symbol=String(q.symbol||'').trim().toUpperCase(),type=String(q.type||'stock');
    if(type!=='stock') return json(res,200,{ok:true,configured:true,level:'LOW',tone:'buy',events:[],reason:'Tidak ada earnings calendar untuk asset type ini.'});
    const r=await fetch(`https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&symbol=${encodeURIComponent(symbol)}&horizon=3month&apikey=${encodeURIComponent(key)}`);
    const text=await r.text(),rows=parseCsv(text);
    const now=Date.now(),future=rows.map(x=>({...x,ts:Date.parse(x.reportDate)})).filter(x=>Number.isFinite(x.ts)&&x.ts>=now).sort((a,b)=>a.ts-b.ts);
    const next=future[0]||null,days=next?((next.ts-now)/86400000):null;
    let level='LOW',tone='buy',reason='Tidak ada earnings dekat.';
    if(days!=null&&days<=2){level='HIGH';tone='sell';reason=`Earnings sekitar ${days.toFixed(1)} hari lagi.`}
    else if(days!=null&&days<=7){level='MEDIUM';tone='hold';reason=`Earnings sekitar ${days.toFixed(1)} hari lagi.`}
    json(res,200,{ok:true,configured:true,level,tone,reason,nextEarnings:next,daysToEarnings:days==null?null:Number(days.toFixed(1)),events:future.slice(0,3),source:'Alpha Vantage earnings calendar'},'public, s-maxage=1800, stale-while-revalidate=3600');
  }catch(e){json(res,200,{ok:true,configured:true,level:'UNKNOWN',tone:'wait',events:[],reason:'Calendar tidak tersedia.',error:e.message})}
}
