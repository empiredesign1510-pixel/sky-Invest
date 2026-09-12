import {json,getQuery,fetchJson} from './_lib/http.js';
import {clamp} from './_lib/indicators.js';

export default async function handler(req,res){
  try{
    const q=getQuery(req),id=String(q.id||'').trim().toLowerCase(),symbol=String(q.symbol||'').trim().toUpperCase();
    if(!id) return json(res,400,{ok:false,error:'CoinGecko id wajib diisi.'});
    const headers={};
    if(process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key']=process.env.COINGECKO_API_KEY;
    const coin=await fetchJson(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=true&sparkline=false`,{headers});
    const md=coin.market_data||{},dev=coin.developer_data||{};
    const mc=Number(md.market_cap?.usd||0),fdv=Number(md.fully_diluted_valuation?.usd||0),
      circ=Number(md.circulating_supply||0),total=Number(md.total_supply||0),max=Number(md.max_supply||0),
      fdvRatio=mc>0&&fdv>0?fdv/mc:null,commits=Number(dev.commit_count_4_weeks||0);

    let score=58,notes=[];
    if(fdvRatio!=null){
      if(fdvRatio<=1.25){score+=13;notes.push('dilution relatif terkendali')}
      else if(fdvRatio>2.5){score-=18;notes.push('FDV jauh di atas market cap')}
      else if(fdvRatio>1.7){score-=8;notes.push('dilution perlu dipantau')}
    }
    if(commits>=50){score+=8;notes.push('developer activity aktif')}
    else if(commits===0){score-=3}

    let btcNetwork=null;
    if(symbol==='BTC'){
      try{
        const [mempool,fees]=await Promise.all([
          fetchJson('https://mempool.space/api/mempool'),
          fetchJson('https://mempool.space/api/v1/fees/recommended')
        ]);
        btcNetwork={
          txCount:Number(mempool.count||0),
          vsize:Number(mempool.vsize||0),
          totalFee:Number(mempool.total_fee||0),
          fastestFee:Number(fees.fastestFee||0),
          halfHourFee:Number(fees.halfHourFee||0)
        };
        if(btcNetwork.txCount>100000){score+=3;notes.push('network activity tinggi')}
      }catch{}
    }

    score=Math.round(clamp(score,20,92));
    let label='NEUTRAL',tone='wait';
    if(score>=72){label='POSITIVE';tone='buy'}
    else if(score<=45){label='RISKY';tone='sell'}
    else if(score>=60){label='HEALTHY';tone='hold'}

    json(res,200,{
      ok:true,id,symbol,label,tone,score,
      marketCap:mc,fdv,fdvRatio:fdvRatio==null?null:Number(fdvRatio.toFixed(2)),
      circulatingSupply:circ,totalSupply:total,maxSupply:max,
      developerCommits4w:commits,btcNetwork,
      reason:notes.join(' • ')||'Network/supply context netral.',
      source:'CoinGecko network/supply context + mempool.space for BTC'
    },'public, s-maxage=300, stale-while-revalidate=900');
  }catch(e){
    json(res,200,{ok:true,available:false,label:'N/A',tone:'wait',score:null,error:e.message});
  }
}
