import {json,getQuery,fetchJson} from './_lib/http.js';
import {num} from './_lib/indicators.js';

function retMap(rows){
  const out=new Map();
  for(let i=1;i<rows.length;i++){
    const p=rows[i-1],c=rows[i];
    if(p.close>0&&c.close>0)out.set(c.date,(c.close/p.close)-1);
  }
  return out;
}
function corr(a,b){
  const keys=[...a.keys()].filter(k=>b.has(k));
  if(keys.length<12)return null;
  const x=keys.map(k=>a.get(k)),y=keys.map(k=>b.get(k));
  const mx=x.reduce((s,v)=>s+v,0)/x.length,my=y.reduce((s,v)=>s+v,0)/y.length;
  let cov=0,vx=0,vy=0;
  for(let i=0;i<x.length;i++){const dx=x[i]-mx,dy=y[i]-my;cov+=dx*dy;vx+=dx*dx;vy+=dy*dy}
  return vx&&vy?cov/Math.sqrt(vx*vy):null;
}
async function load(asset){
  if(asset.type==='crypto'){
    const data=await fetchJson(`https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(asset.symbol+'USDT')}&interval=1d&limit=100`);
    return data.map(v=>({date:new Date(Number(v[0])).toISOString().slice(0,10),close:num(v[4])})).filter(x=>Number.isFinite(x.close));
  }
  const key=process.env.TWELVEDATA_API_KEY;if(!key)throw new Error('TWELVEDATA_API_KEY belum dikonfigurasi.');
  const d=await fetchJson(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(asset.symbol)}&interval=1day&outputsize=100`,{headers:{Authorization:`apikey ${key}`}});
  if(d.status==='error')throw new Error(d.message);
  return (d.values||[]).map(v=>({date:v.datetime.slice(0,10),close:num(v.close)})).filter(x=>Number.isFinite(x.close)).reverse();
}
export default async function handler(req,res){
  try{
    const q=getQuery(req),raw=String(q.assets||'');
    const assets=raw.split(';').map(x=>{const [type,symbol]=x.split(':');return{type,symbol:String(symbol||'').toUpperCase()}}).filter(x=>x.symbol).slice(0,6);
    if(assets.length<2)return json(res,400,{ok:false,error:'Minimal 2 aset.'});
    const loaded=await Promise.all(assets.map(async a=>({a,map:retMap(await load(a))})));
    const matrix=assets.map((a,i)=>assets.map((b,j)=>{
      if(i===j)return 1;
      const c=corr(loaded[i].map,loaded[j].map);
      return c==null?null:Number(c.toFixed(3));
    }));
    let pairs=[];
    for(let i=0;i<assets.length;i++)for(let j=i+1;j<assets.length;j++)if(matrix[i][j]!=null)pairs.push({a:assets[i].symbol,b:assets[j].symbol,corr:matrix[i][j]});
    pairs.sort((x,y)=>Math.abs(y.corr)-Math.abs(x.corr));
    json(res,200,{ok:true,assets:assets.map(x=>x.symbol),matrix,strongest:pairs.slice(0,5),source:'90-day daily-return correlation'},'public, s-maxage=300, stale-while-revalidate=900');
  }catch(e){json(res,502,{ok:false,error:e.message})}
}
