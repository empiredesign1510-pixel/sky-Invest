import {json,getQuery,fetchJson} from './_lib/http.js';
import {clamp,quickCryptoSignal} from './_lib/indicators.js';

const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function score(c,isMeme=false){
  const mc=n(c.market_cap),vol=n(c.total_volume),fdv=n(c.fully_diluted_valuation,mc),
    p24=n(c.price_change_percentage_24h),p7=n(c.price_change_percentage_7d_in_currency),
    p30=n(c.price_change_percentage_30d_in_currency),athGap=Math.abs(Math.min(0,n(c.ath_change_percentage)));
  const lr=mc>0?vol/mc:0,liq=lr>=.12?95:lr>=.06?85:lr>=.025?72:lr>=.01?58:38,
    fr=mc>0?fdv/mc:2,tok=fr<=1.08?92:fr<=1.25?80:fr<=1.6?65:fr<=2.5?48:30;
  let mom=clamp(50+clamp(p24*2,-15,15)+clamp(p7*1.2,-18,18)+clamp(p30*.45,-20,20));
  const surv=mc>=50e9?92:mc>=10e9?86:mc>=2e9?78:mc>=500e6?68:mc>=100e6?55:35,
    dd=clamp(90-athGap*.55),market=Math.round(mom*.30+liq*.25+tok*.20+surv*.15+dd*.10);
  let risk=0;
  if(mc<100e6)risk+=12;else if(mc<500e6)risk+=6;
  if(lr<.01)risk+=8;
  if(fr>2.5)risk+=10;else if(fr>1.6)risk+=5;
  if(Math.abs(p24)>15)risk+=6;
  if(isMeme){
    risk+=4;
    if(mc<500e6)risk+=5;
    if(Math.abs(p24)>10)risk+=3;
  }
  risk=Math.min(30,risk);
  return{marketScore:market,momentumScore:Math.round(mom),liquidityScore:Math.round(liq),tokenomicsScore:Math.round(tok),riskPenalty:risk};
}

function normalize(c,isMeme=false){
  const base={
    id:c.id,symbol:String(c.symbol||'').toUpperCase(),name:c.name,image:c.image,
    price:c.current_price,marketCap:c.market_cap,marketCapRank:c.market_cap_rank,
    fdv:c.fully_diluted_valuation,volume24h:c.total_volume,
    change24h:c.price_change_percentage_24h,change7d:c.price_change_percentage_7d_in_currency,
    change30d:c.price_change_percentage_30d_in_currency,lastUpdated:c.last_updated,
    isMeme,segment:isMeme?'meme':'crypto',...score(c,isMeme)
  };
  const signal=quickCryptoSignal(base);
  if(isMeme&&signal.label==='BUY'&&base.riskPenalty>=18){
    signal.label='HOLD';signal.tone='hold';signal.confidence=Math.min(signal.confidence||65,68);
    signal.reason='Momentum menarik, tetapi risiko meme coin masih tinggi; tunggu entry yang lebih disiplin.';
  }
  return{...base,signal};
}

export default async function handler(req,res){
  try{
    const q=getQuery(req),limit=Math.max(20,Math.min(120,Number(q.limit||100))),
      memeLimit=Math.max(10,Math.min(100,Number(q.meme_limit||60))),headers={};
    if(process.env.COINGECKO_API_KEY)headers['x-cg-demo-api-key']=process.env.COINGECKO_API_KEY;

    const common={vs_currency:'usd',order:'market_cap_desc',sparkline:'false',price_change_percentage:'1h,24h,7d,30d'};
    const topParams=new URLSearchParams({...common,per_page:String(limit),page:'1'});
    const memeParams=new URLSearchParams({...common,per_page:String(memeLimit),page:'1',category:'meme-token'});

    const [top,meme]=await Promise.all([
      fetchJson(`https://api.coingecko.com/api/v3/coins/markets?${topParams}`,{headers}),
      fetchJson(`https://api.coingecko.com/api/v3/coins/markets?${memeParams}`,{headers})
    ]);

    const memeIds=new Set((meme||[]).map(x=>x.id));
    const map=new Map();
    for(const c of top||[])map.set(c.id,normalize(c,memeIds.has(c.id)));
    for(const c of meme||[])map.set(c.id,normalize(c,true));

    const rows=[...map.values()];
    json(res,200,{
      ok:true,data:rows,
      counts:{total:rows.length,meme:rows.filter(x=>x.isMeme).length},
      source:'CoinGecko',
      realtimeOverlay:'Binance WebSocket when USDT pair is available',
      memeCategory:'meme-token'
    },'public, s-maxage=45, stale-while-revalidate=120');
  }catch(e){
    json(res,e.status===429?429:502,{ok:false,error:e.status===429?'CoinGecko rate limit reached.':e.message});
  }
}
