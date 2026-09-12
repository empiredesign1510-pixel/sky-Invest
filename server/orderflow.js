import {json,getQuery,fetchJson} from './_lib/http.js';
import {clamp} from './_lib/indicators.js';
export default async function handler(req,res){
 try{
  const q=getQuery(req),base=String(q.symbol||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{2,20}$/.test(base))return json(res,400,{ok:false,error:'Symbol crypto tidak valid.'});
  const pair=`${base}USDT`;
  const [book,trades]=await Promise.all([
   fetchJson(`https://data-api.binance.vision/api/v3/depth?symbol=${encodeURIComponent(pair)}&limit=100`),
   fetchJson(`https://data-api.binance.vision/api/v3/aggTrades?symbol=${encodeURIComponent(pair)}&limit=500`)
  ]);
  const bids=(book.bids||[]).slice(0,30).map(([p,q])=>Number(p)*Number(q)),asks=(book.asks||[]).slice(0,30).map(([p,q])=>Number(p)*Number(q));
  const bidN=bids.reduce((a,b)=>a+b,0),askN=asks.reduce((a,b)=>a+b,0),imb=(bidN-askN)/Math.max(bidN+askN,1);
  let buyN=0,sellN=0;
  for(const t of trades||[]){const n=Number(t.p)*Number(t.q);if(t.m) sellN+=n; else buyN+=n}
  const tradeImb=(buyN-sellN)/Math.max(buyN+sellN,1);
  const bestBid=Number(book.bids?.[0]?.[0]),bestAsk=Number(book.asks?.[0]?.[0]),mid=(bestBid+bestAsk)/2,spreadPct=mid?((bestAsk-bestBid)/mid)*100:null;
  const recent=(trades||[]).slice(-150),signed=recent.map(t=>(t.m?-1:1)*Number(t.p)*Number(t.q));
  const cumulativeDelta=signed.reduce((a,b)=>a+b,0);
  const absDelta=signed.reduce((a,b)=>a+Math.abs(b),0)||1;
  const deltaPct=cumulativeDelta/absDelta*100;
  const bidWall=Math.max(...bids,0),askWall=Math.max(...asks,0),wallRatio=askWall?bidWall/askWall:null;
  const raw=50+imb*24+tradeImb*27+(deltaPct/100)*18+(wallRatio!=null?(wallRatio>1.7?6:wallRatio<.6?-6:0):0)-(spreadPct!=null&&spreadPct>.15?8:0),score=Math.round(clamp(raw));
  let label='BALANCED',tone='wait';if(score>=64){label='BUYERS DOMINANT';tone='buy'}else if(score<=36){label='SELLERS DOMINANT';tone='sell'}
  json(res,200,{ok:true,pair,label,tone,score,bookImbalance:Number((imb*100).toFixed(1)),tradeImbalance:Number((tradeImb*100).toFixed(1)),spreadPct:spreadPct==null?null:Number(spreadPct.toFixed(4)),buyNotional:buyN,sellNotional:sellN,cumulativeDelta:Number(cumulativeDelta.toFixed(2)),deltaPct:Number(deltaPct.toFixed(1)),bidAskWallRatio:wallRatio==null?null:Number(wallRatio.toFixed(2)),source:'Binance depth + aggTrades microstructure snapshot'},'public, s-maxage=3, stale-while-revalidate=5');
 }catch(e){json(res,502,{ok:false,error:'Order flow tidak tersedia untuk pair ini.'})}
}
