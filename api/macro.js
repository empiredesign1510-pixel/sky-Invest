import {json,fetchJson} from './_lib/http.js';
import {clamp} from './_lib/indicators.js';

function latest(data){
  const rows=data?.data||[];
  return rows.length?{value:Number(rows[0].value),date:rows[0].date,prev:Number(rows[1]?.value)}:null;
}
export default async function handler(req,res){
  const key=process.env.ALPHAVANTAGE_API_KEY;
  if(!key) return json(res,200,{ok:true,configured:false,label:'UNKNOWN',tone:'wait',score:50,reason:'Alpha Vantage key belum dikonfigurasi.'});
  try{
    const [y10,ffr,cpi]=await Promise.all([
      fetchJson(`https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${encodeURIComponent(key)}`),
      fetchJson(`https://www.alphavantage.co/query?function=FEDERAL_FUNDS_RATE&interval=daily&apikey=${encodeURIComponent(key)}`),
      fetchJson(`https://www.alphavantage.co/query?function=CPI&interval=monthly&apikey=${encodeURIComponent(key)}`)
    ]);
    const ten=latest(y10),fed=latest(ffr),infl=latest(cpi);
    let score=55,notes=[];
    if(ten&&Number.isFinite(ten.prev)){
      const d=ten.value-ten.prev;
      if(d<-0.04){score+=8;notes.push('10Y yield turun')}
      else if(d>0.04){score-=7;notes.push('10Y yield naik')}
    }
    if(fed){notes.push(`Fed funds ${fed.value}%`)}
    if(infl){notes.push(`CPI ${infl.value}`)}
    score=Math.round(clamp(score,25,85));
    let label='NEUTRAL',tone='wait';
    if(score>=66){label='SUPPORTIVE';tone='buy'}
    else if(score<=44){label='TIGHT / RISKY';tone='sell'}
    else if(score>=58){label='MILDLY SUPPORTIVE';tone='hold'}
    json(res,200,{
      ok:true,configured:true,label,tone,score,reason:notes.join(' • '),
      treasury10Y:ten,fedFunds:fed,cpi:infl,source:'Alpha Vantage macro series'
    },'public, s-maxage=1800, stale-while-revalidate=3600');
  }catch(e){
    json(res,200,{ok:true,configured:true,label:'UNKNOWN',tone:'wait',score:50,reason:'Macro API sedang dibatasi.',error:e.message});
  }
}
