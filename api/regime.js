import {json,fetchJson} from './_lib/http.js';
import {technicalSnapshot,num,clamp} from './_lib/indicators.js';
function parseK(rows){return(rows||[]).map(v=>({open:num(v[1]),high:num(v[2]),low:num(v[3]),close:num(v[4]),volume:num(v[5],0)})).filter(x=>Number.isFinite(x.close))}
export default async function handler(req,res){
 try{
  const headers={};if(process.env.COINGECKO_API_KEY)headers['x-cg-demo-api-key']=process.env.COINGECKO_API_KEY;
  const [coins,k4,k1]=await Promise.all([
   fetchJson('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=40&page=1&sparkline=false&price_change_percentage=24h,7d',{headers}),
   fetchJson('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=120'),
   fetchJson('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=120')
  ]);
  const c4=parseK(k4),c1=parseK(k1),t4=technicalSnapshot(c4.map(x=>x.close),c4),t1=technicalSnapshot(c1.map(x=>x.close),c1);
  const usable=(coins||[]).filter(x=>Number.isFinite(Number(x.price_change_percentage_24h)));
  const pos24=usable.filter(x=>Number(x.price_change_percentage_24h)>0).length/Math.max(1,usable.length);
  const pos7=usable.filter(x=>Number(x.price_change_percentage_7d_in_currency)>0).length/Math.max(1,usable.length);
  const absMoves=usable.map(x=>Math.abs(Number(x.price_change_percentage_24h)||0)).sort((a,b)=>a-b);
  const medianMove=absMoves[Math.floor(absMoves.length/2)]||0;
  let score=t4.trendScore*.28+t1.trendScore*.32+pos24*100*.20+pos7*100*.20;
  if(medianMove>8)score-=6;score=Math.round(clamp(score));
  let label='NEUTRAL',tone='wait',risk='NORMAL';
  if(score>=78){label='RISK ON';tone='buy';risk='LOWER'}
  else if(score>=65){label='BULLISH';tone='buy';risk='NORMAL'}
  else if(score<35){label='RISK OFF';tone='sell';risk='HIGH'}
  else if(score<48){label='DEFENSIVE';tone='hold';risk='ELEVATED'}
  const reason=`BTC 4H ${t4.trendScore}/100 • BTC 1D ${t1.trendScore}/100 • breadth 24H ${Math.round(pos24*100)}%`;
  json(res,200,{ok:true,label,tone,score,risk,reason,breadth24:Math.round(pos24*100),breadth7d:Math.round(pos7*100),btc4h:t4.trendScore,btc1d:t1.trendScore,medianMove24h:Number(medianMove.toFixed(2)),source:'CoinGecko breadth + Binance BTC OHLC'},'public, s-maxage=60, stale-while-revalidate=120');
 }catch(e){json(res,502,{ok:false,error:e.message})}
}
