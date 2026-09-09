import {json} from './_lib/http.js';
import {kvConfigured,kvGet} from './_lib/kv.js';

export default async function handler(req,res){
  if(!kvConfigured()) return json(res,200,{ok:true,configured:false,lastRun:null,alerts:[],reason:'Upstash belum dikonfigurasi.'});
  try{
    const data=await kvGet('investment-ai:agent:last')||null;
    json(res,200,{ok:true,configured:true,...(data||{lastRun:null,alerts:[]})},'public, s-maxage=30, stale-while-revalidate=60');
  }catch(e){json(res,200,{ok:true,configured:true,lastRun:null,alerts:[],error:e.message})}
}
