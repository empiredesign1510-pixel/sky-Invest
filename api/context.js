import {json,getQuery,fetchJson} from './_lib/http.js';
import {clamp,num} from './_lib/indicators.js';
function stockScore(o){const roe=num(o.ReturnOnEquityTTM),margin=num(o.ProfitMargin),growth=num(o.QuarterlyRevenueGrowthYOY),eps=num(o.EPS),pe=num(o.PERatio);let pts=[];if(roe!=null)pts.push(clamp(50+roe*150));if(margin!=null)pts.push(clamp(50+margin*120));if(growth!=null)pts.push(clamp(55+growth*110));if(eps!=null)pts.push(eps>0?75:25);if(pe!=null&&pe>0)pts.push(pe<20?82:pe<35?68:pe<50?52:38);return pts.length?Math.round(pts.reduce((a,b)=>a+b,0)/pts.length):null}
function parseTime(s){if(!s||s.length<15)return null;const y=s.slice(0,4),m=s.slice(4,6),d=s.slice(6,8),h=s.slice(9,11),mi=s.slice(11,13),se=s.slice(13,15);return Date.parse(`${y}-${m}-${d}T${h}:${mi}:${se}Z`)}
export default async function handler(req,res){
 const key=process.env.ALPHAVANTAGE_API_KEY;if(!key)return json(res,200,{ok:true,configured:false,news:[],eventRisk:{level:'UNKNOWN',tone:'wait',reason:'Alpha Vantage key belum dikonfigurasi.'},fundamental:null});
 try{
  const q=getQuery(req),type=String(q.type||'stock'),symbol=String(q.symbol||'').trim().toUpperCase();
  let newsUrl=`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=12&sort=LATEST&apikey=${encodeURIComponent(key)}`;
  if(type==='crypto')newsUrl+=`&tickers=${encodeURIComponent('CRYPTO:'+symbol)}`;
  else if(type==='stock')newsUrl+=`&tickers=${encodeURIComponent(symbol)}`;
  else newsUrl+=`&topics=${encodeURIComponent('economy_monetary,financial_markets')}`;
  const tasks=[fetchJson(newsUrl)];if(type==='stock')tasks.push(fetchJson(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`));
  const out=await Promise.all(tasks),newsData=out[0],overview=out[1]||null;
  if(newsData.Note||newsData.Information)throw new Error(newsData.Note||newsData.Information);
  const news=(newsData.feed||[]).slice(0,8).map(x=>({title:x.title,source:x.source,url:x.url,time:x.time_published,ts:parseTime(x.time_published),sentimentScore:num(x.overall_sentiment_score),sentiment:x.overall_sentiment_label||'Neutral'}));
  const text=news.map(x=>x.title||'').join(' ').toLowerCase(),hot=/fomc|federal reserve|interest rate|cpi|inflation|earnings|guidance|sec |lawsuit|hack|exploit|war|sanction|tariff/.test(text);
  const latest=news[0]?.ts,veryRecent=latest&&Date.now()-latest<36*3600*1000;
  let level='LOW',tone='buy',reason='Tidak ada event besar yang terdeteksi dari headline terbaru.';if(hot&&veryRecent){level='HIGH';tone='sell';reason='Ada headline/event berisiko tinggi dalam berita terbaru.'}else if(hot){level='MEDIUM';tone='hold';reason='Ada catalyst/event penting yang perlu dipantau.'}
  let fundamental=null;if(overview&&overview.Symbol){const score=stockScore(overview);fundamental={score,grade:score>=78?'STRONG':score>=62?'GOOD':score>=48?'MIXED':'WEAK',sector:overview.Sector||'',pe:num(overview.PERatio),roe:num(overview.ReturnOnEquityTTM),profitMargin:num(overview.ProfitMargin),revenueGrowthYOY:num(overview.QuarterlyRevenueGrowthYOY),marketCap:num(overview.MarketCapitalization)}}
  json(res,200,{ok:true,configured:true,news,eventRisk:{level,tone,reason},fundamental,source:'Alpha Vantage news/sentiment + company overview'},'public, s-maxage=300, stale-while-revalidate=900');
 }catch(e){json(res,200,{ok:true,configured:true,error:e.message,news:[],eventRisk:{level:'UNKNOWN',tone:'wait',reason:'Context API sedang dibatasi atau tidak tersedia.'},fundamental:null})}
}
