import {fetchJson} from './http.js';

export function kvConfigured(){
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
async function cmd(parts){
  if(!kvConfigured()) return null;
  const base=process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/,'');
  return fetchJson(`${base}/${parts.map(x=>encodeURIComponent(String(x))).join('/')}`,{
    headers:{Authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`}
  });
}
export async function kvGet(key){
  const x=await cmd(['get',key]); if(!x) return null;
  try{return JSON.parse(x.result)}catch{return x.result}
}
export async function kvSet(key,value,ttlSec=86400){
  const body=JSON.stringify(value);
  await cmd(['set',key,body,'EX',ttlSec]);
  return true;
}
