export function json(res,status,body,cache=null){
  res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');
  if(cache)res.setHeader('Cache-Control',cache);res.end(JSON.stringify(body));
}
export function getQuery(req){const u=new URL(req.url,'http://localhost');return Object.fromEntries(u.searchParams.entries())}
export async function fetchJson(url,options={}){
  const r=await fetch(url,{...options,headers:{Accept:'application/json','User-Agent':'Investment-AI-OS/3.0',...(options.headers||{})}});
  const t=await r.text();let d;try{d=JSON.parse(t)}catch{throw new Error(`Provider returned non-JSON (${r.status})`)}
  if(!r.ok){const e=new Error(d?.message||`Provider HTTP ${r.status}`);e.status=r.status;e.payload=d;throw e}return d;
}
