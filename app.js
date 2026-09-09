const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const state={filter:'all',crypto:[],macro:[],regime:null,selected:null,analysis:null,timeframe:'4h',liveCrypto:new Map(),binanceWs:null,macroPoll:null,macroSymbols:[],lastTick:null,health:null,mtfCache:new Map(),scanResults:[],validatedMap:new Map(),alertMonitor:null,alertBusy:false,macroIntel:null,agentFeed:null,installPrompt:null,correlation:null};
const store={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},set(k,v){localStorage.setItem(k,JSON.stringify(v))}};
const esc=(s='')=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmt=(v,c='USD')=>{const n=Number(v);if(!Number.isFinite(n))return'—';return new Intl.NumberFormat('id-ID',{style:'currency',currency:c,maximumFractionDigits:Math.abs(n)<10?6:2}).format(n)};
const pct=v=>{const n=Number(v);return Number.isFinite(n)?`${n>=0?'+':''}${n.toFixed(2)}%`:'—'};
const short=s=>s?.label==='WAIT & SEE'?'WAIT':(s?.label||'WAIT');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(url){const r=await fetch(url),d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`HTTP ${r.status}`);return d}
function alertPrefs(){return store.get('inv_validated_alert_v73',{enabled:false,intervalMinutes:5})}
function alertHistory(){return store.get('inv_validated_history_v73',{})}
function showToast(title,message){const stack=$('#toastStack');if(!stack)return;const el=document.createElement('div');el.className='toast';el.innerHTML=`<b>${esc(title)}</b><span>${esc(message)}</span>`;stack.prepend(el);setTimeout(()=>el.remove(),8500)}
function updateAlertUI(lastText=''){
  const pref=alertPrefs(),card=$('#validatedMonitor'),title=$('#alertStatusTitle'),text=$('#alertStatusText'),btn=$('#alertToggle');if(!card)return;
  card.classList.toggle('active',pref.enabled);title.textContent=pref.enabled?'Alert Aktif':'Alert OFF';btn.textContent=pref.enabled?'Matikan Alert':'Aktifkan Alert';
  text.textContent=pref.enabled?(lastText||`Memantau kandidat setiap ${pref.intervalMinutes} menit. Alert hanya untuk Validation Score 100/100.`):'Notifikasi hanya muncul saat seluruh 10 gate validasi BUY lolos.';
}
async function requestAlertPermission(){
  let browser='in-app only';
  if('Notification' in window){try{let p=Notification.permission;if(p==='default')p=await Notification.requestPermission();if(p==='granted')browser='browser + in-app'}catch{}}
  store.set('inv_validated_alert_v73',{...alertPrefs(),enabled:true});updateAlertUI(`Aktif • ${browser} • strict 100/100`);startValidatedMonitor(true);showToast('Validated Buy Alert aktif','Website akan memberi tahu ketika semua gate BUY lolos 100/100.');
}
function stopValidatedMonitor(){if(state.alertMonitor)clearInterval(state.alertMonitor);state.alertMonitor=null;store.set('inv_validated_alert_v73',{...alertPrefs(),enabled:false});updateAlertUI()}
async function browserNotify(title,body){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  try{if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.ready;await reg.showNotification(title,{body,tag:'validated-buy',renotify:true,data:{url:location.origin}})}else new Notification(title,{body})}catch{}
}
function maybeNotifyValidatedBuy(a,validation,details){
  if(!validation?.valid)return;const key=`${a.type}:${a.symbol}`,hist=alertHistory(),last=Number(hist[key]||0);if(Date.now()-last<30*60*1000)return;
  hist[key]=Date.now();store.set('inv_validated_history_v73',hist);const price=Number(details?.d?.quote?.price??a.price),msg=`${a.symbol} lolos 10/10 gate • Validation 100/100${Number.isFinite(price)?` • ${fmt(price,details?.d?.currency||a.currency||'USD')}`:''}`;
  showToast(`VALIDATED BUY • ${a.symbol}`,msg);browserNotify(`VALIDATED BUY • ${a.symbol}`,msg);const box=$('#validatedLatest');if(box){box.classList.remove('hidden');box.innerHTML=`<div><strong>VALIDATED BUY • ${esc(a.symbol)}</strong><span>${esc(validation.reason)}</span></div><span class="validated-score">100/100</span>`}
}

function tab(id){$$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));$$('.screen').forEach(x=>x.classList.toggle('hidden',x.id!==id));if(id==='portfolio')renderPortfolio();if(id==='lab')renderLab()}
$$('.bottom-nav button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$$('.filter').forEach(b=>b.onclick=()=>{$$('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.filter=b.dataset.filter;renderMarket()});
function watches(){return store.get('inv_watch_v7',store.get('inv_watch_v5',[]))}function isWatched(a){return watches().some(x=>x.type===a.type&&x.id===a.id)}function addWatch(a){const w=watches();if(!w.some(x=>x.type===a.type&&x.id===a.id))w.unshift({...a,added:Date.now()});store.set('inv_watch_v7',w.slice(0,100))}function removeWatch(a){store.set('inv_watch_v7',watches().filter(x=>!(x.id===a.id&&x.type===a.type)))}
function cryptoLive(a){const t=state.liveCrypto.get(`${a.symbol}USDT`);if(!t)return a;return{...a,price:t.price,change24h:t.open?((t.price/t.open)-1)*100:a.change24h,liveAt:t.time}}
function signalSpan(s){return`<span class="signal ${esc(s?.tone||'wait')}">${esc(short(s))}</span>`}
function assetRow(a){const c=a.type==='crypto'?cryptoLive(a):a,s=c.signal||{label:'WAIT & SEE',tone:'wait'},chg=Number(c.change24h??c.percentChange),img=a.type==='crypto'&&a.image?`<img class="coin-img" src="${esc(a.image)}" alt="">`:`<div class="asset-icon">${a.type==='gold'?'AU':'ST'}</div>`;return`<article class="asset-row" data-open-type="${esc(a.type)}" data-open-id="${esc(a.id)}"><div class="asset-main">${img}<div><div class="asset-symbol">${esc(a.symbol)}${a.isMeme?'<span class="meme-badge">MEME</span>':''}${state.validatedMap.get(`${a.type}:${a.id}`)?.valid?'<span class="validated-badge">VALID BUY</span>':''}</div><div class="asset-name">${esc(a.name||a.symbol)}</div></div></div><div class="asset-price"><strong>${fmt(c.price,c.currency||'USD')}</strong><span class="change ${chg>=0?'positive':'negative'}">${pct(chg)}</span></div>${signalSpan(s)}</article>`}
function renderMarket(){const normal=state.crypto.filter(x=>!x.isMeme),memes=state.crypto.filter(x=>x.isMeme);let rows=[];if(state.filter==='all'){rows=[...state.macro.filter(x=>x.type==='gold'),...state.macro.filter(x=>x.type==='stock').slice(0,6),...normal.slice(0,18),...memes.slice(0,10)]}else if(state.filter==='crypto')rows=normal;else if(state.filter==='meme')rows=memes;else rows=state.macro.filter(x=>x.type===state.filter);$('#assetList').innerHTML=rows.length?rows.map(assetRow).join(''):`<div class="empty-state"><b>Tidak ada data.</b><span>Coba kategori lain.</span></div>`;$$('#assetList [data-open-type]').forEach(x=>x.onclick=()=>openAsset(x.dataset.openType,x.dataset.openId));renderTopSignal()}
function renderTopSignal(){const all=[...state.macro,...state.crypto].filter(x=>x.signal);const rank={BUY:4,HOLD:3,'WAIT & SEE':2,SELL:1};all.sort((a,b)=>(rank[b.signal.label]||0)-(rank[a.signal.label]||0)+(Number(b.signal.confidence||0)-Number(a.signal.confidence||0))/100);const a=all[0];$('#topSignal').textContent=a?short(a.signal):'—';$('#topSignalName').textContent=a?`${a.symbol} • ${a.signal.confidence||'—'}%`:'loading'}
async function loadHealth(){
  try{
    state.health=await api('/api/health');
    const stockReady=state.health?.stockGold?.configured;
    $('#liveText').textContent=stockReady?'Crypto LIVE • Saham/Gold 15s':'Crypto LIVE • Saham/Gold perlu key';
    const ag=state.health?.serverAgent;
    if($('#agentStatus'))$('#agentStatus').textContent=ag?.configured?'READY':'LOCAL';
    if($('#agentMeta'))$('#agentMeta').textContent=ag?.configured?'server feed tersambung':'foreground monitor';
  }catch{
    $('#liveText').textContent='Crypto live • data lain terbatas';
  }
}
async function loadRegime(){try{state.regime=await api('/api/regime');$('#regimeLabel').textContent=state.regime.label;$('#regimeScore').textContent=state.regime.score;$('#regimeReason').textContent=state.regime.reason;$('#breadth24').textContent=`${state.regime.breadth24}%`;$('#regimeCard').classList.toggle('buy',state.regime.tone==='buy');$('#regimeCard').classList.toggle('sell',state.regime.tone==='sell')}catch(e){$('#regimeLabel').textContent='NEUTRAL';$('#regimeReason').textContent='Regime data sedang tidak tersedia.'}}
async function loadCrypto(){try{const d=await api('/api/crypto?limit=100&meme_limit=70');state.crypto=d.data.map(x=>({...x,type:'crypto'}));renderMarket();connectBinance()}catch(e){$('#assetList').innerHTML=`<div class="error-box">${esc(e.message)}</div>`}}
function quickMacroSignal(x){const p=Number(x.percentChange);if(!Number.isFinite(p))return{label:'WAIT & SEE',tone:'wait',confidence:55};if(p>1.2)return{label:'HOLD',tone:'hold',confidence:62};if(p<-1.5)return{label:'SELL',tone:'sell',confidence:62};return{label:'WAIT & SEE',tone:'wait',confidence:56}}
async function loadMacro(extra=null){
  const base=['AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','XAU/USD'];
  const syms=extra&&!base.includes(extra)?[extra,...base.slice(0,7)]:base;
  state.macroSymbols=syms;
  try{
    const d=await api(`/api/quotes?symbols=${encodeURIComponent(syms.join(','))}`);
    state.macro=d.data.map(x=>({
      ...x,id:x.symbol,
      type:x.symbol==='XAU/USD'?'gold':'stock',
      change24h:x.percentChange,
      signal:quickMacroSignal(x)
    }));
    renderMarket();
    startMacroPolling(syms);
  }catch(e){
    if(!state.macro.length){
      state.macro=[{
        id:'XAU/USD',symbol:'XAU/USD',name:'Gold Spot / US Dollar',
        type:'gold',currency:'USD',price:NaN,change24h:NaN,
        signal:{label:'WAIT & SEE',tone:'wait',confidence:55}
      }];
    }
    renderMarket();
  }
}

async function refreshMacroPrices(symbols=state.macroSymbols){
  if(!symbols?.length || document.hidden)return;
  try{
    const d=await api(`/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`);
    for(const x of d.data){
      const existing=state.macro.find(a=>a.symbol===x.symbol);
      const normalized={
        ...x,id:x.symbol,
        type:x.symbol==='XAU/USD'?'gold':'stock',
        change24h:x.percentChange,
        signal:quickMacroSignal(x),
        liveAt:Date.now()
      };
      if(existing)Object.assign(existing,normalized);
      else state.macro.push(normalized);
      if(state.selected?.symbol===x.symbol){
        state.selected={...state.selected,...normalized};
        const p=$('#liveDetailPrice');
        if(p)p.textContent=fmt(Number(x.price),x.currency||'USD');
      }
    }
    state.lastTick=Date.now();
    $('#lastUpdate').textContent='AUTO 15S';
    renderMarket();
    
  }catch(e){
    console.warn('Stock/Gold refresh skipped:',e.message);
  }
}

function startMacroPolling(symbols){
  state.macroSymbols=symbols||state.macroSymbols;
  if(state.macroPoll)clearInterval(state.macroPoll);
  if(!state.health?.stockGold?.configured)return;
  state.macroPoll=setInterval(()=>refreshMacroPrices(state.macroSymbols),15000);
}

function connectBinance(){
  if(state.binanceWs)try{state.binanceWs.close()}catch{}
  try{
    const ws=new WebSocket('wss://data-stream.binance.vision/ws/!miniTicker@arr');
    state.binanceWs=ws;
    ws.onopen=()=>{
      $('#liveText').textContent=state.health?.stockGold?.configured
        ?'Crypto LIVE • Saham/Gold refresh 15s'
        :'Crypto LIVE • Saham/Gold perlu API key';
    };
    ws.onmessage=e=>{
      const arr=JSON.parse(e.data);
      if(!Array.isArray(arr))return;
      for(const t of arr){
        if(!t.s?.endsWith('USDT'))continue;
        state.liveCrypto.set(t.s,{
          price:Number(t.c),open:Number(t.o),time:Number(t.E)||Date.now()
        });
        if(state.selected?.type==='crypto'&&`${state.selected.symbol}USDT`===t.s){
          const p=$('#liveDetailPrice');
          if(p)p.textContent=fmt(Number(t.c),'USD');
        }
      }
      state.lastTick=Date.now();
      $('#lastUpdate').textContent='LIVE';
      if(['all','crypto','meme'].includes(state.filter))renderMarket();
    };
    ws.onerror=()=>{};
    ws.onclose=()=>setTimeout(connectBinance,4000);
  }catch{}
}

document.addEventListener('visibilitychange',()=>{
  if(!document.hidden && state.health?.stockGold?.configured){
    refreshMacroPrices(state.macroSymbols);
  }
});



async function loadMacroIntel(){
  try{
    state.macroIntel=await api('/api/macro');
    if($('#macroLabel'))$('#macroLabel').textContent=state.macroIntel.label||'NEUTRAL';
    if($('#macroReason'))$('#macroReason').textContent=state.macroIntel.reason||'Macro context belum tersedia.';
  }catch{
    state.macroIntel={label:'UNKNOWN',tone:'wait',score:50,reason:'Macro feed tidak tersedia.'};
  }
}
async function loadAgentFeed(){
  try{
    state.agentFeed=await api('/api/agent-feed');
    if($('#agentStatus'))$('#agentStatus').textContent=state.agentFeed.configured?'24/7':'LOCAL';
    if($('#agentMeta'))$('#agentMeta').textContent=state.agentFeed.configured
      ?`${state.agentFeed.alerts?.length||0} server alerts`
      :'optional Upstash agent';
    if(state.agentFeed?.alerts?.length){
      const x=state.agentFeed.alerts[0];
      const box=$('#validatedLatest');
      if(box&&!box.innerHTML){box.classList.remove('hidden');box.innerHTML=`<div><strong>SERVER AGENT • ${esc(x.symbol)}</strong><span>${esc(x.summary?.reason||'MTF signal detected')}</span></div><span class="validated-score">${x.summary?.confidence||'—'}%</span>`}
    }
  }catch{}
}

// search
async function search(){const q=$('#globalSearch').value.trim();if(!q){$('#searchResults').classList.add('hidden');return}const l=q.toLowerCase(),local=state.crypto.filter(x=>x.symbol.toLowerCase().includes(l)||x.name.toLowerCase().includes(l)).slice(0,5);let remote=[];try{remote=(await api(`/api/search?q=${encodeURIComponent(q)}`)).data.slice(0,7)}catch{}const rows=[...local.map(x=>({type:'crypto',id:x.id,symbol:x.symbol,name:x.name,meta:x.isMeme?'Meme coin':'Crypto'})),...remote.map(x=>({type:(x.symbol==='XAU/USD'||String(x.instrumentType).toLowerCase().includes('commodity'))?'gold':'stock',id:x.symbol,symbol:x.symbol,name:x.instrumentName,meta:[x.exchange,x.instrumentType].filter(Boolean).join(' • ')}))];$('#searchResults').innerHTML=rows.length?rows.map(x=>`<div class="search-result" data-rtype="${esc(x.type)}" data-rid="${esc(x.id)}"><div><b>${esc(x.symbol)}</b><small>${esc(x.name)}</small></div><span>${esc(x.meta)}</span></div>`).join(''):`<div class="empty-state"><b>Tidak ditemukan.</b></div>`;$('#searchResults').classList.remove('hidden');$$('[data-rtype]').forEach(x=>x.onclick=async()=>{if(x.dataset.rtype!=='crypto'&&!state.macro.find(a=>a.id===x.dataset.rid))await loadMacro(x.dataset.rid);$('#searchResults').classList.add('hidden');openAsset(x.dataset.rtype,x.dataset.rid)})}
$('#searchBtn').onclick=search;$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter')search()});

// scanner
function candidatePool(){const normal=state.crypto.filter(x=>!x.isMeme).sort((a,b)=>(b.marketScore||0)-(a.marketScore||0)).slice(0,5),memes=state.crypto.filter(x=>x.isMeme&&x.riskPenalty<22).sort((a,b)=>(b.marketScore||0)-(a.marketScore||0)).slice(0,2),macro=state.macro.filter(x=>['NVDA','AAPL','XAU/USD'].includes(x.symbol));return[...normal,...memes,...macro].slice(0,9)}
async function runScanner(){$('#scanBtn').disabled=true;$('#scanProgress').classList.remove('hidden');state.scanResults=[];const pool=candidatePool();for(let i=0;i<pool.length;i++){const a=pool[i];$('#scanBar').style.width=`${Math.round((i/pool.length)*100)}%`;$('#scanText').textContent=`Menganalisis ${a.symbol} (${i+1}/${pool.length})`;try{const d=await api(`/api/multi-analyze?type=${a.type==='crypto'?'crypto':'market'}&symbol=${encodeURIComponent(a.symbol)}`);const rank=({BUY:400,HOLD:250,'WAIT & SEE':120,SELL:0}[d.summary.label]||0)+(d.summary.confidence||0)-(a.isMeme?(a.riskPenalty||0)*1.2:0);state.scanResults.push({asset:a,summary:d.summary,rank})}catch{}await sleep(180)}state.scanResults.sort((a,b)=>b.rank-a.rank);$('#scanBar').style.width='100%';$('#scanText').textContent='Scan selesai';renderScanner();$('#scanBtn').disabled=false;setTimeout(()=>$('#scanProgress').classList.add('hidden'),1000)}
function renderScanner(){$('#scannerResults').innerHTML=state.scanResults.length?state.scanResults.map((x,i)=>`<article class="opportunity-card" data-scan-type="${esc(x.asset.type)}" data-scan-id="${esc(x.asset.id)}"><div class="rank">${i+1}</div><div><h4>${esc(x.asset.symbol)} ${x.asset.isMeme?'<span class="meme-badge">MEME</span>':''}</h4><p>${esc(x.summary.reason)}</p></div><div class="opportunity-meta"><strong>${esc(short(x.summary))}</strong><span>${x.summary.confidence}% confidence</span></div></article>`).join(''):`<div class="empty-state"><b>Belum ada deep scan.</b><span>Tekan “Mulai Deep Scan”.</span></div>`;$$('[data-scan-type]').forEach(x=>x.onclick=()=>openAsset(x.dataset.scanType,x.dataset.scanId))}
$('#scanBtn').onclick=runScanner;

// detail
const TFS=['5m','15m','1h','4h','1d','1w'];
async function openAsset(type,id){let a=type==='crypto'?state.crypto.find(x=>x.id===id):state.macro.find(x=>x.id===id);if(!a)return;state.selected=a;state.timeframe=store.get('inv_tf_v7','4h');$('#detailSheet').classList.remove('hidden');$('#detailContent').innerHTML=`<div class="skeleton-block" style="height:110px;margin-top:12px"></div><div class="skeleton-block" style="height:190px;margin-top:8px"></div>`;await loadDetail()}
async function loadDetail(){
  const a=state.selected;if(!a)return;
  try{
    const baseUrl=a.type==='crypto'?`/api/crypto-analyze?symbol=${encodeURIComponent(a.symbol)}&tf=${state.timeframe}`:`/api/analyze?symbol=${encodeURIComponent(a.symbol)}&tf=${state.timeframe}`;
    const cached=state.mtfCache.get(`${a.type}:${a.symbol}`),
      mtfP=cached&&Date.now()-cached.ts<60000?Promise.resolve(cached.data):api(`/api/multi-analyze?type=${a.type==='crypto'?'crypto':'market'}&symbol=${encodeURIComponent(a.symbol)}`).then(d=>(state.mtfCache.set(`${a.type}:${a.symbol}`,{ts:Date.now(),data:d}),d));
    const tasks=[
      api(baseUrl),mtfP,
      a.type==='crypto'?api(`/api/orderflow?symbol=${encodeURIComponent(a.symbol)}`).catch(()=>null):Promise.resolve(null),
      api(`/api/backtest?type=${a.type==='crypto'?'crypto':'market'}&symbol=${encodeURIComponent(a.symbol)}&tf=${['15m','1h','4h','1d'].includes(state.timeframe)?state.timeframe:'4h'}`).catch(()=>null),
      api(`/api/context?type=${encodeURIComponent(a.type)}&symbol=${encodeURIComponent(a.symbol)}`).catch(()=>null),
      a.type==='crypto'?api(`/api/derivatives?symbol=${encodeURIComponent(a.symbol)}`).catch(()=>null):Promise.resolve(null),
      a.type==='crypto'?api(`/api/onchain?id=${encodeURIComponent(a.id)}&symbol=${encodeURIComponent(a.symbol)}`).catch(()=>null):Promise.resolve(null),
      a.type==='stock'?api(`/api/events?type=stock&symbol=${encodeURIComponent(a.symbol)}`).catch(()=>null):Promise.resolve(null)
    ];
    const [d,mtf,order,back,ctx,deriv,onchain,events]=await Promise.all(tasks);
    state.analysis={d,mtf,order,back,ctx,deriv,onchain,events};
    renderDetail(a,d,mtf,order,back,ctx,deriv,onchain,events);
  }catch(e){$('#detailContent').innerHTML=`<div class="error-box">${esc(e.message)}</div>`}
}
function mtfCell(f){if(!f?.ok)return'<div class="mtf-mini na">N/A</div>';return`<div class="mtf-mini ${esc(f.signal.tone)}">${esc(short(f.signal))}<small>${f.signal.confidence}%</small></div>`}
function intel(title,label,tone='wait',small=''){return`<div class="intel-card ${esc(tone)}"><span>${esc(title)}</span><b>${esc(label||'—')}</b>${small?`<small>${esc(small)}</small>`:''}</div>`}

function timingQuality(a,d,order,deriv){
  const p=Number(d.quote?.price??d.technical?.latest),L=d.levels||{},r=Number(d.technical?.rsi14),atr=Number(d.technical?.atr14)||Math.max(p*.01,.0000001);
  let score=55,notes=[];const buyish=['BUY','HOLD'].includes(d.signal?.label);
  if(buyish){
    if(p>=L.entryLow&&p<=L.entryHigh){score+=22;notes.push('di area entry')}
    else if(p>L.entryHigh+atr*.8){score-=23;notes.push('terlalu jauh dari entry')}
    else score+=6;
    if(r>=50&&r<=68)score+=10;else if(r>76)score-=18;
    if(Number.isFinite(L.resistance)&&(L.resistance-p)/atr<.55)score-=13;
    if(order?.score>=64)score+=7;else if(order?.score<=36)score-=9;
    if(deriv?.score>=70)score+=4;else if(deriv?.score!=null&&deriv.score<=42)score-=7;
  }else if(d.signal?.label==='SELL'){score+=8;if(order?.score<=36)score+=8}else score-=5;
  score=Math.max(20,Math.min(92,Math.round(score)));
  let label='WAIT FOR SETUP',tone='wait';
  if(d.signal?.label==='SELL'&&score>=65){label='REDUCE / EXIT';tone='sell'}
  else if(buyish&&score>=82){label='EXCELLENT ENTRY';tone='buy'}
  else if(buyish&&score>=70){label='GOOD ENTRY';tone='buy'}
  else if(buyish&&score>=55){label='WAIT PULLBACK';tone='hold'}
  else if(buyish){label='TOO LATE / CHASING';tone='sell'}
  return{label,tone,score,reason:notes.join(' • ')};
}
function calibrationModifier(a){
  const rows=store.get('inv_signal_memory_v8',[]).filter(x=>x.type===a.type&&x.outcome);
  if(rows.length<8)return 0;
  const hit=rows.filter(x=>x.outcome==='hit').length/rows.length;
  return hit>=.62?2:hit<.45?-2:0;
}
function finalDecision(a,d,mtf,order,back,ctx,deriv,onchain,events){
  let v={BUY:2,HOLD:1,'WAIT & SEE':0,SELL:-2}[mtf?.summary?.label||d.signal.label]||0,
      conf=Number(mtf?.summary?.confidence||d.signal.confidence||60),reasons=[],contrib=[];
  const add=(name,val,reason)=>{v+=val;contrib.push({name,value:val});if(reason)reasons.push(reason)};
  if(a.type==='crypto'){
    if(order?.score>=64)add('Order Flow',.38,'buyer order flow dominan');else if(order?.score<=36)add('Order Flow',-.45,'seller order flow dominan');
    if(deriv?.score>=70)add('Derivatives',.20,'derivatives sehat');else if(deriv?.score!=null&&deriv.score<=42)add('Derivatives',-.28,'derivatives overheated');
    if(onchain?.score>=72)add('Network Context',.16,'network/supply context positif');else if(onchain?.score!=null&&onchain.score<=45)add('Network Context',-.22,'network/supply risk tinggi');
    if(a.isMeme){add('Meme Risk',-(a.riskPenalty||0)/80,'meme risk filter aktif');conf-=Math.min(6,(a.riskPenalty||0)/4)}
  }
  if(a.type==='stock'){
    if(ctx?.fundamental?.score>=72)add('Fundamental',.26,'fundamental mendukung');else if(ctx?.fundamental?.score!=null&&ctx.fundamental.score<48)add('Fundamental',-.30,'fundamental lemah');
    if(events?.level==='HIGH')add('Earnings Guard',-.72,'earnings sangat dekat');else if(events?.level==='MEDIUM')add('Earnings Guard',-.22,'earnings perlu dipantau');
  }
  if(a.type==='gold'){
    if(state.macroIntel?.score>=66)add('Macro',.25,'macro mendukung gold/risk assets');else if(state.macroIntel?.score<=44)add('Macro',-.25,'macro tightening');
  }
  if(state.regime){if(state.regime.score>=68)add('Regime',.18,'market regime mendukung');else if(state.regime.score<40){add('Regime',-.35,'market regime defensif');conf-=4}}
  if(back?.sampleSize>=8){if(back.hitRate>=60&&back.expectancyPct>0){add('Historical',.22,'historical validation positif');conf+=2}else if(back.hitRate<48||back.expectancyPct<0){add('Historical',-.28,'historical validation lemah');conf-=4}}
  if(ctx?.eventRisk?.level==='HIGH'){add('News Risk',-.55,'event/news risk tinggi');conf-=6}
  const cal=calibrationModifier(a);if(cal){conf+=cal;contrib.push({name:'Calibration',value:cal/10})}
  let label='WAIT & SEE',tone='wait';
  if(v>=1.50){label='BUY';tone='buy'}else if(v>=.58){label='HOLD';tone='hold'}else if(v<=-1.20){label='SELL';tone='sell'}
  conf=Math.max(50,Math.min(91,Math.round(conf)));if(label==='WAIT & SEE')conf=Math.min(conf,72);
  return{label,tone,confidence:conf,score:Number(v.toFixed(2)),reason:reasons.slice(0,4).join(' • ')||mtf?.summary?.reason||d.signal.reason,contributions:contrib};
}
function dataQuality(a,d,mtf,order,ctx,deriv,onchain){
  let score=100,notes=[];
  const frames=(mtf?.frames||[]).filter(x=>x?.ok).length;
  if(frames<4){score-=20;notes.push('MTF incomplete')}
  if(!d?.history?.length){score-=30;notes.push('OHLC missing')}
  const ts=Number(d?.quote?.timestamp||0);
  if(ts&&Date.now()-ts>24*3600*1000&&a.type!=='stock'){score-=15;notes.push('quote stale')}
  if(a.type==='crypto'&&!order){score-=10;notes.push('order flow unavailable')}
  if(a.type==='crypto'&&!deriv?.available&&deriv?.score==null){score-=7;notes.push('derivatives unavailable')}
  if(a.type==='stock'&&!ctx?.fundamental){score-=8;notes.push('fundamental unavailable')}
  score=Math.max(0,Math.round(score));
  return{score,label:score>=90?'EXCELLENT':score>=78?'GOOD':score>=60?'LIMITED':'LOW',tone:score>=78?'buy':score>=60?'hold':'sell',reason:notes.join(' • ')||'Semua sumber utama tersedia.'};
}
function validation100(a,d,mtf,order,back,ctx,final,timing,deriv,onchain,events,quality){
  const frames=mtf?.frames||[],counts=frames.reduce((o,f)=>{if(f?.ok)o[f.signal?.label]=(o[f.signal?.label]||0)+1;return o},{}),r=Number(d?.technical?.rsi14),trend=Number(d?.technical?.trendScore||0),event=ctx?.eventRisk?.level||'UNKNOWN';
  const gates=[
    {name:'Final Decision BUY',pass:final?.label==='BUY'},
    {name:'Multi-TF BUY',pass:mtf?.summary?.label==='BUY'},
    {name:'≥3 TF BUY, 0 SELL',pass:(counts.BUY||0)>=3&&(counts.SELL||0)===0},
    {name:'MTF confidence ≥80%',pass:Number(mtf?.summary?.confidence)>=80},
    {name:'Timing Good / Excellent',pass:Number(timing?.score)>=75&&['GOOD ENTRY','EXCELLENT ENTRY'].includes(timing?.label)},
    {name:'Trend + RSI sehat',pass:d?.signal?.label==='BUY'&&trend>=72&&r>=46&&r<=72},
    {name:'Historical positive',pass:Number(back?.sampleSize)>=8&&Number(back?.hitRate)>=56&&Number(back?.expectancyPct)>0},
    {name:'Regime tidak defensif',pass:Number(state.regime?.score)>=48},
    {name:'Event risk terkontrol',pass:!['HIGH','UNKNOWN'].includes(event)&&events?.level!=='HIGH'},
    {name:'Data quality ≥78',pass:Number(quality?.score)>=78},
    {name:'Asset-specific risk gate',pass:a.type==='crypto'?(order?.score>=58&&(deriv?.score==null||deriv.score>=45)&&(onchain?.score==null||onchain.score>=48)):a.type==='stock'?(ctx?.fundamental?.score>=55):true},
    {name:'Tidak overheat / chasing',pass:timing?.label!=='TOO LATE / CHASING'&&r<=74}
  ];
  const passed=gates.filter(x=>x.pass).length,score=Math.round(passed/gates.length*100),valid=passed===gates.length;
  return{valid,score,passed,total:gates.length,label:valid?'VALIDATED BUY':score>=83?'NEAR VALIDATION':score>=67?'PARTIAL':'NOT VALID',reason:valid?'Semua strict gate V8 lolos. Ini bukan jaminan profit.':`${passed}/${gates.length} gate lolos.`,gates};
}
function recommendedPosition(a,d,timing,quality){
  const capital=Number(store.get('inv_capital_base_v8',1000))||0,riskPct=(Number(store.get('inv_risk_v8',1))||1)/100,
    entry=Number(d?.quote?.price||d?.technical?.latest),stop=Number(d?.levels?.invalidation);
  if(!capital||!entry||!stop||entry===stop)return null;
  let modifier=(timing?.score||60)/80*(quality?.score||70)/85;
  if(a.isMeme)modifier*=.55;
  modifier=Math.max(.35,Math.min(1,modifier));
  const riskBudget=capital*riskPct*modifier,riskPerUnit=Math.abs(entry-stop),units=riskPerUnit?riskBudget/riskPerUnit:0;
  return{riskBudget,units,value:units*entry,riskPct:riskPct*100*modifier,modifier};
}
function recordSignal(a,d,final,timing,validation){
  const rows=store.get('inv_signal_memory_v8',[]),key=`${a.type}:${a.symbol}:${state.timeframe}`,
    last=rows.find(x=>x.key===key&&!x.outcome);
  if(last&&Date.now()-last.ts<4*3600*1000)return;
  rows.unshift({key,type:a.type,symbol:a.symbol,name:a.name,tf:state.timeframe,signal:final.label,confidence:final.confidence,validation:validation.score,entry:Number(d.quote?.price||d.technical?.latest),ts:Date.now(),outcome:null});
  store.set('inv_signal_memory_v8',rows.slice(0,250));
}
function explainRows(final){
  const base=[{name:'Multi-Timeframe Core',value:final.score}];
  return [...(final.contributions||[])].sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,8);
}
function renderDetail(a,d,mtf,order,back,ctx,deriv,onchain,events){
  const cur=a.type==='crypto'?cryptoLive(a):a,
    final=finalDecision(a,d,mtf,order,back,ctx,deriv,onchain,events),
    timing=timingQuality(a,d,order,deriv),
    quality=dataQuality(a,d,mtf,order,ctx,deriv,onchain),
    validation=validation100(a,d,mtf,order,back,ctx,final,timing,deriv,onchain,events,quality),
    I=d.indicators||{},L=d.levels||{},frames=Object.fromEntries((mtf?.frames||[]).map(x=>[x.timeframe,x])),
    watched=isWatched(a),chg=Number(cur.change24h??cur.percentChange),C=d.currency||cur.currency||'USD',
    sizing=recommendedPosition(a,d,timing,quality);

  state.validatedMap.set(`${a.type}:${a.id}`,validation);
  maybeNotifyValidatedBuy(a,validation,{d,mtf,order,back,ctx,final,timing});
  recordSignal(a,d,final,timing,validation);

  $('#detailContent').innerHTML=`
<div class="detail-head"><div class="detail-type">${a.isMeme?'MEME COIN • ':''}${esc(a.type.toUpperCase())} • ${esc(a.symbol)}<span class="live-badge">MARKET DATA</span></div><h2>${esc(a.name)}</h2><div class="detail-price-row"><div id="liveDetailPrice" class="detail-price">${fmt(cur.price,C)}</div><div class="detail-change ${chg>=0?'positive':'negative'}">${pct(chg)}</div></div></div>

<div class="final-card ${esc(final.tone)}"><div class="final-top"><div><span class="decision-kicker">FINAL DECISION</span><div class="decision-title">${esc(final.label)}</div></div><div class="confidence"><strong>${final.confidence}%</strong><span>evidence confidence*</span></div></div><div class="decision-reason">${esc(final.reason)}</div><div class="timing-bar"><span>TIMING QUALITY</span><b class="${esc(timing.tone)}">${esc(timing.label)} • ${timing.score}/100</b></div></div>

<div class="data-quality"><div><strong>DATA QUALITY • ${esc(quality.label)}</strong><span>${esc(quality.reason)}</span></div><b>${quality.score}/100</b></div>

<div class="validation-card ${validation.valid?'valid':''}"><div class="validation-head"><div><span class="decision-kicker">STRICT BUY VALIDATION</span><h4>${esc(validation.label)}</h4></div><strong>${validation.score}/100</strong></div><div class="validation-sub">${esc(validation.reason)}</div><div class="gate-grid">${validation.gates.map(g=>`<div class="gate ${g.pass?'pass':''}"><i></i>${esc(g.name)}</div>`).join('')}</div></div>

<div class="power-grid">
${intel('Market Regime',state.regime?.label,state.regime?.tone,`${state.regime?.score??'—'}/100`)}
${intel('Macro',state.macroIntel?.label,state.macroIntel?.tone,`${state.macroIntel?.score??'—'}/100`)}
${intel('Order Flow',order?.label||'N/A',order?.tone||'wait',order?`${order.score}/100 • Δ ${order.deltaPct??'—'}%`:'crypto only')}
${intel('Derivatives',deriv?.label||'N/A',deriv?.tone||'wait',deriv?.score!=null?`${deriv.score}/100 • funding ${deriv.fundingRatePct??'—'}%`:'crypto only')}
${intel('Network / On-chain',onchain?.label||'N/A',onchain?.tone||'wait',onchain?.score!=null?`${onchain.score}/100`:'crypto only')}
${intel('Historical',back?.grade||'N/A',back?.tone||'wait',back?.sampleSize?`${back.hitRate??'—'}% hit • n=${back.sampleSize}`:'insufficient')}
${intel('Event / News',ctx?.eventRisk?.level||'UNKNOWN',ctx?.eventRisk?.tone||'wait',ctx?.eventRisk?.reason||'optional')}
${intel('Earnings Guard',events?.level||'N/A',events?.tone||'wait',events?.reason||'stock only')}
</div>

<div class="timeframe-row">${TFS.map(tf=>`<button class="tf-btn ${tf===state.timeframe?'active':''}" data-tf="${tf}">${tf.toUpperCase()}</button>`).join('')}</div>
<div class="chartbox"><canvas id="detailChart"></canvas></div>

<div class="level-grid"><div class="stat wide"><span>Area Entry</span><b>${fmt(L.entryLow,C)} – ${fmt(L.entryHigh,C)}</b></div><div class="stat"><span>Target 1</span><b>${fmt(L.target1,C)}</b></div><div class="stat"><span>Target 2</span><b>${fmt(L.target2,C)}</b></div><div class="stat"><span>Invalidation</span><b>${fmt(L.invalidation,C)}</b></div><div class="stat"><span>Support</span><b>${fmt(L.support,C)}</b></div><div class="stat"><span>Resistance</span><b>${fmt(L.resistance,C)}</b></div></div>

${sizing?`<div class="section-card"><h4>Adaptive Position Sizing</h4><div class="intelligence-grid">${intel('Risk Budget',fmt(sizing.riskBudget,C),'wait')}${intel('Suggested Units',sizing.units.toLocaleString('id-ID',{maximumFractionDigits:6}),'wait')}${intel('Position Value',fmt(sizing.value,C),'wait')}${intel('Effective Risk',`${sizing.riskPct.toFixed(2)}%`,'wait')}</div></div>`:''}

<div class="section-card"><h4>Multi-Timeframe Confirmation</h4><div class="mtf-grid">${['15m','1h','4h','1d'].map(tf=>`<div class="mtf-item"><span>${tf.toUpperCase()}</span>${mtfCell(frames[tf])}</div>`).join('')}</div></div>

<div class="section-card"><h4>Explainable AI • contribution</h4><div class="explain-list">${explainRows(final).map(x=>`<div class="explain-row"><span>${esc(x.name)}</span><b class="${x.value>=0?'pos':'neg'}">${x.value>=0?'+':''}${Number(x.value).toFixed(2)}</b></div>`).join('')}</div></div>

<div class="section-card"><h4>Indicator Snapshot • ${state.timeframe.toUpperCase()}</h4><div class="intelligence-grid">${intel('Trend',I.trend?.label,I.trend?.tone,`${I.trend?.score??'—'}/100`)}${intel('Momentum',I.momentum?.label,I.momentum?.tone)}${intel('RSI',I.rsi?.label,I.rsi?.tone,Number.isFinite(I.rsi?.value)?I.rsi.value.toFixed(1):'')}${intel('Volume',I.volume?.label,I.volume?.tone,I.volume?.ratio?`${I.volume.ratio.toFixed(1)}x`:'')}</div></div>

${ctx?.fundamental?`<div class="section-card"><h4>Fundamental Snapshot</h4><div class="intelligence-grid">${intel('Quality',ctx.fundamental.grade,ctx.fundamental.score>=62?'buy':'hold',`${ctx.fundamental.score}/100`)}${intel('P/E',String(ctx.fundamental.pe??'—'),'wait')}${intel('ROE',ctx.fundamental.roe!=null?`${(ctx.fundamental.roe*100).toFixed(1)}%`:'—','wait')}${intel('Revenue Growth',ctx.fundamental.revenueGrowthYOY!=null?`${(ctx.fundamental.revenueGrowthYOY*100).toFixed(1)}%`:'—','wait')}</div></div>`:''}

${ctx?.news?.length?`<div class="section-card"><h4>Latest Context</h4><div class="news-list">${ctx.news.slice(0,4).map(n=>`<a class="news-item" href="${esc(n.url||'#')}" target="_blank" rel="noopener"><b>${esc(n.title)}</b><span>${esc(n.source||'')} • ${esc(n.sentiment||'')}</span></a>`).join('')}</div></div>`:''}

<div class="detail-actions"><button class="portfolio-action" id="detailPortfolioBtn">＋ Portfolio</button><button class="paper-action" id="paperTradeBtn">◈ Paper Trade</button></div>
<button class="watch-action" id="watchBtn">${watched?'Hapus dari Watchlist':'★ Tambah ke Watchlist'}</button>
<p class="disclaimer">*Confidence bukan probabilitas pasti profit. Semua analisis adalah decision-support. Validated Buy 100/100 berarti seluruh gate model lolos, bukan jaminan keuntungan.</p>`;

  $$('[data-tf]').forEach(b=>b.onclick=()=>{state.timeframe=b.dataset.tf;store.set('inv_tf_v7',state.timeframe);loadDetail()});
  requestAnimationFrame(()=>drawCandles($('#detailChart'),d.history||[],L));
  $('#watchBtn').onclick=()=>{watched?removeWatch(a):addWatch({id:a.id,type:a.type,symbol:a.symbol,name:a.name,isMeme:a.isMeme});renderDetail(a,d,mtf,order,back,ctx,deriv,onchain,events)};
  $('#detailPortfolioBtn').onclick=()=>openPositionModal(a,Number(d.quote?.price||d.technical?.latest));
  $('#paperTradeBtn').onclick=()=>openPaperTrade(a,d,final);
}

async function deepValidateCandidate(a,mtfInput=null){
  const tf='4h',baseUrl=a.type==='crypto'?`/api/crypto-analyze?symbol=${encodeURIComponent(a.symbol)}&tf=${tf}`:`/api/analyze?symbol=${encodeURIComponent(a.symbol)}&tf=${tf}`;
  const [d,mtf,order,back,ctx,deriv,onchain,events]=await Promise.all([
    api(baseUrl),
    mtfInput?Promise.resolve(mtfInput):api(`/api/multi-analyze?type=${a.type==='crypto'?'crypto':'market'}&symbol=${encodeURIComponent(a.symbol)}`),
    a.type==='crypto'?api(`/api/orderflow?symbol=${encodeURIComponent(a.symbol)}`).catch(()=>null):Promise.resolve(null),
    api(`/api/backtest?type=${a.type==='crypto'?'crypto':'market'}&symbol=${encodeURIComponent(a.symbol)}&tf=4h`).catch(()=>null),
    api(`/api/context?type=${encodeURIComponent(a.type)}&symbol=${encodeURIComponent(a.symbol)}`).catch(()=>null),
    a.type==='crypto'?api(`/api/derivatives?symbol=${encodeURIComponent(a.symbol)}`).catch(()=>null):Promise.resolve(null),
    a.type==='crypto'?api(`/api/onchain?id=${encodeURIComponent(a.id)}&symbol=${encodeURIComponent(a.symbol)}`).catch(()=>null):Promise.resolve(null),
    a.type==='stock'?api(`/api/events?type=stock&symbol=${encodeURIComponent(a.symbol)}`).catch(()=>null):Promise.resolve(null)
  ]);
  const final=finalDecision(a,d,mtf,order,back,ctx,deriv,onchain,events),timing=timingQuality(a,d,order,deriv),quality=dataQuality(a,d,mtf,order,ctx,deriv,onchain),
    validation=validation100(a,d,mtf,order,back,ctx,final,timing,deriv,onchain,events,quality);
  return{a,d,mtf,order,back,ctx,deriv,onchain,events,final,timing,quality,validation};
}
async function runValidatedMonitor(manual=false){
  if(state.alertBusy)return;state.alertBusy=true;
  try{
    updateAlertUI(manual?'Strict V8 scan berjalan…':'Memindai strict gates…');
    const seen=new Map(),pool=[...candidatePool()],unique=pool.filter(a=>{const k=`${a.type}:${a.id}`;if(seen.has(k))return false;seen.set(k,1);return true}).slice(0,8),pre=[];
    for(const a of unique){
      try{const mtf=await api(`/api/multi-analyze?type=${a.type==='crypto'?'crypto':'market'}&symbol=${encodeURIComponent(a.symbol)}`);if(mtf?.summary?.label==='BUY'&&Number(mtf.summary.confidence)>=76)pre.push({a,mtf})}catch{}
      await sleep(120);
    }
    pre.sort((x,y)=>Number(y.mtf.summary.confidence)-Number(x.mtf.summary.confidence));
    for(const x of pre.slice(0,3)){try{const result=await deepValidateCandidate(x.a,x.mtf);state.validatedMap.set(`${x.a.type}:${x.a.id}`,result.validation);maybeNotifyValidatedBuy(x.a,result.validation,result)}catch{}await sleep(160)}
    renderMarket();const valid=[...state.validatedMap.values()].filter(v=>v.valid).length;
    updateAlertUI(`Scan ${new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})} • ${valid} validated setup`);
    if(manual&&!valid)showToast('Strict scan selesai','Belum ada aset yang lolos seluruh strict gate saat ini.');
  }finally{state.alertBusy=false}
}
function startValidatedMonitor(runNow=false){
  if(state.alertMonitor)clearInterval(state.alertMonitor);
  if(!alertPrefs().enabled){updateAlertUI();return}
  const ms=Math.max(3,Number(alertPrefs().intervalMinutes||5))*60000;
  if(runNow)setTimeout(()=>runValidatedMonitor(false),1400);
  state.alertMonitor=setInterval(()=>runValidatedMonitor(false),ms);updateAlertUI();
}

function drawCandles(canvas,rows,L){if(!canvas||!rows.length)return;const ctx=canvas.getContext('2d'),r=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=Math.floor(r.width*dpr);canvas.height=Math.floor(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const w=r.width,h=r.height,p=9,c=rows.slice(-70),vals=c.flatMap(x=>[Number(x.high),Number(x.low)]).filter(Number.isFinite);if(!vals.length)return;let lo=Math.min(...vals),hi=Math.max(...vals),range=hi-lo||1;lo-=range*.07;hi+=range*.07;range=hi-lo;const y=v=>h-p-((v-lo)/range)*(h-2*p),cw=Math.max(2,(w-2*p)/c.length*.62);ctx.clearRect(0,0,w,h);for(const [label,val,color] of [['S',L.support,'#3bd38c88'],['R',L.resistance,'#ff6b7c88']])if(Number.isFinite(Number(val))){ctx.strokeStyle=color;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(p,y(val));ctx.lineTo(w-p,y(val));ctx.stroke();ctx.setLineDash([])}c.forEach((x,i)=>{const X=p+(i+.5)*(w-2*p)/c.length,o=Number(x.open),cl=Number(x.close),H=Number(x.high),l=Number(x.low),up=cl>=o;ctx.strokeStyle=up?'#3bd38c':'#ff6b7c';ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(X,y(H));ctx.lineTo(X,y(l));ctx.stroke();ctx.fillRect(X-cw/2,Math.min(y(o),y(cl)),cw,Math.max(1,Math.abs(y(o)-y(cl))))})}
$$('[data-close-sheet]').forEach(x=>x.onclick=()=>$('#detailSheet').classList.add('hidden'));
$('#alertToggle').onclick=()=>{alertPrefs().enabled?stopValidatedMonitor():requestAlertPermission()};
$('#alertScanBtn').onclick=()=>runValidatedMonitor(true);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});

// ---------- V8 Portfolio ----------
function positions(){return store.get('inv_positions_v8',[])}
function priceForPosition(p){
  if(p.type==='crypto'){const a=state.crypto.find(x=>x.symbol===p.symbol);return a?Number(cryptoLive(a).price):null}
  const a=state.macro.find(x=>x.symbol===p.symbol);return a?Number(a.price):null;
}
function portfolioStats(){
  const rows=positions();let value=0,cost=0,valued=0;
  for(const p of rows){const px=priceForPosition(p);if(Number.isFinite(px)){value+=px*p.qty;cost+=p.avg*p.qty;valued++}}
  return{value,cost,pnl:value-cost,pnlPct:cost?((value/cost)-1)*100:0,valued,total:rows.length};
}
function renderPortfolio(){
  const s=portfolioStats(),rows=positions();
  $('#portfolioValue').textContent=fmt(s.value,'USD');$('#portfolioPnl').textContent=pct(s.pnlPct);
  $('#portfolioPnl').className=s.pnl>=0?'positive':'negative';
  $('#homePortfolioPnl').textContent=rows.length?pct(s.pnlPct):'—';$('#homePortfolioMeta').textContent=rows.length?`${rows.length} positions`:'belum ada posisi';
  $('#portfolioList').innerHTML=rows.length?rows.map((p,i)=>{
    const px=priceForPosition(p),val=Number.isFinite(px)?px*p.qty:null,pnl=Number.isFinite(px)?(px/p.avg-1)*100:null;
    return `<article class="position-card"><div><h4>${esc(p.symbol)} • ${esc(p.name||p.symbol)}</h4><p>${p.qty} unit • avg ${fmt(p.avg,p.currency||'USD')}</p></div><div class="right">${val!=null?`<b>${fmt(val,p.currency||'USD')}</b><span class="${pnl>=0?'positive':'negative'}">${pct(pnl)}</span>`:'<b>—</b><span>price unavailable</span>'}<button class="ghost-btn" data-del-pos="${i}" style="margin-top:4px">Hapus</button></div></article>`;
  }).join(''):`<div class="empty-state"><b>Portfolio kosong.</b><span>Tambahkan posisi agar AI bisa menghitung exposure dan P/L.</span></div>`;
  $$('[data-del-pos]').forEach(b=>b.onclick=()=>{const r=positions();r.splice(Number(b.dataset.delPos),1);store.set('inv_positions_v8',r);renderPortfolio()});
}
function openPositionModal(a=null,price=null){
  $('#positionModal').classList.remove('hidden');
  $('#positionType').value=a?.type||'stock';$('#positionSymbol').value=a?.symbol||'';$('#positionName').value=a?.name||'';$('#positionQty').value='';$('#positionAvg').value=Number.isFinite(price)?price:'';
}
function closePositionModal(){$('#positionModal').classList.add('hidden')}
$('#addPositionBtn').onclick=()=>openPositionModal();
$$('[data-close-modal]').forEach(x=>x.onclick=closePositionModal);
$('#savePositionBtn').onclick=()=>{
  const type=$('#positionType').value,symbol=$('#positionSymbol').value.trim().toUpperCase(),name=$('#positionName').value.trim()||symbol,qty=Number($('#positionQty').value),avg=Number($('#positionAvg').value);
  if(!symbol||!qty||!avg)return showToast('Posisi belum lengkap','Isi symbol, jumlah, dan harga rata-rata.');
  const r=positions();r.unshift({type,symbol,name,qty,avg,currency:'USD',ts:Date.now()});store.set('inv_positions_v8',r.slice(0,100));closePositionModal();renderPortfolio();showToast('Portfolio diperbarui',`${symbol} ditambahkan.`);
};
$('#riskPerIdea').value=store.get('inv_risk_v8',1);$('#capitalBase').value=store.get('inv_capital_base_v8',1000);
$('#riskPerIdea').oninput=()=>store.set('inv_risk_v8',Number($('#riskPerIdea').value)||1);
$('#capitalBase').oninput=()=>store.set('inv_capital_base_v8',Number($('#capitalBase').value)||0);
$('#correlationBtn').onclick=async()=>{
  const rows=positions().slice(0,6);if(rows.length<2)return showToast('Belum cukup aset','Minimal 2 posisi untuk correlation.');
  $('#correlationBox').innerHTML='<span class="context-note">Menghitung 90-day correlation…</span>';
  try{
    const qs=rows.map(x=>`${x.type}:${x.symbol}`).join(';'),d=await api(`/api/correlation?assets=${encodeURIComponent(qs)}`);state.correlation=d;
    $('#correlationBox').innerHTML=`<div class="context-note">Korelasi tinggi berarti exposure bisa bergerak bersama.</div>${(d.strongest||[]).map(x=>`<div class="corr-pair"><span>${esc(x.a)} ↔ ${esc(x.b)}</span><b class="${Math.abs(x.corr)>=.7?'negative':''}">${x.corr.toFixed(2)}</b></div>`).join('')}`;
  }catch(e){$('#correlationBox').innerHTML=`<span class="context-note">${esc(e.message)}</span>`}
};

// ---------- Paper Trading ----------
function paperTrades(){return store.get('inv_paper_v8',[])}
function openPaperTrade(a,d,final){
  const price=Number(d.quote?.price||d.technical?.latest),L=d.levels||{},side=final.label==='SELL'?'SELL':'BUY',r=paperTrades();
  r.unshift({type:a.type,symbol:a.symbol,name:a.name,side,entry:price,target1:Number(L.target1),target2:Number(L.target2),stop:Number(L.invalidation),opened:Date.now(),status:'OPEN'});
  store.set('inv_paper_v8',r.slice(0,200));showToast('Paper trade dibuat',`${side} ${a.symbol} @ ${fmt(price,d.currency||'USD')}`);renderLab();
}
function updatePaper(){
  const r=paperTrades();let changed=false;
  for(const t of r){
    if(t.status!=='OPEN')continue;const p={type:t.type,symbol:t.symbol},px=priceForPosition(p);if(!Number.isFinite(px))continue;
    if(t.side==='BUY'){if(Number.isFinite(t.target1)&&px>=t.target1){t.status='TP1';t.closed=Date.now();t.exit=px;changed=true}else if(Number.isFinite(t.stop)&&px<=t.stop){t.status='STOP';t.closed=Date.now();t.exit=px;changed=true}}
    else{if(Number.isFinite(t.target1)&&px<=t.target1){t.status='TP1';t.closed=Date.now();t.exit=px;changed=true}else if(Number.isFinite(t.stop)&&px>=t.stop){t.status='STOP';t.closed=Date.now();t.exit=px;changed=true}}
  }
  if(changed)store.set('inv_paper_v8',r);
}
function paperReturn(t){
  const px=t.exit||priceForPosition({type:t.type,symbol:t.symbol});if(!Number.isFinite(px)||!t.entry)return null;
  const raw=(px/t.entry-1)*100;return t.side==='BUY'?raw:-raw;
}

// ---------- Calibration ----------
function updateSignalOutcomes(){
  const rows=store.get('inv_signal_memory_v8',[]);let changed=false;
  for(const s of rows){
    if(s.outcome||Date.now()-s.ts<4*3600*1000)continue;
    const px=priceForPosition({type:s.type,symbol:s.symbol});if(!Number.isFinite(px)||!s.entry)continue;
    const ret=(px/s.entry-1)*100,dir=s.signal==='BUY'?ret:s.signal==='SELL'?-ret:null;
    if(dir==null)continue;s.returnPct=Number(ret.toFixed(2));s.outcome=dir>0?'hit':'miss';changed=true;
  }
  if(changed)store.set('inv_signal_memory_v8',rows);
}
function renderLab(){
  updatePaper();updateSignalOutcomes();
  const sig=store.get('inv_signal_memory_v8',[]),done=sig.filter(x=>x.outcome),hit=done.length?done.filter(x=>x.outcome==='hit').length/done.length*100:null;
  $('#calibrationHit').textContent=hit==null?'—':`${hit.toFixed(1)}%`;$('#calibrationMeta').textContent=done.length?`${done.length} evaluated signals • bounded calibration ±2 confidence`:'Belum cukup signal berumur ≥4 jam.';
  $('#signalHistory').innerHTML=sig.length?sig.slice(0,30).map(x=>`<article class="history-card"><div><h4>${esc(x.symbol)} • ${esc(x.signal)} • ${esc(x.tf.toUpperCase())}</h4><p>${new Date(x.ts).toLocaleString('id-ID')} • confidence ${x.confidence}% • validation ${x.validation}%</p></div><div class="right"><b class="${x.outcome==='hit'?'positive':x.outcome==='miss'?'negative':''}">${x.outcome?.toUpperCase()||'PENDING'}</b><span>${x.returnPct!=null?pct(x.returnPct):'waiting'}</span></div></article>`).join(''):`<div class="empty-state"><b>Belum ada signal memory.</b><span>Buka detail aset untuk mulai mencatat.</span></div>`;
  const trades=paperTrades(),rets=trades.map(paperReturn).filter(Number.isFinite),avg=rets.length?rets.reduce((a,b)=>a+b,0)/rets.length:null;
  $('#paperPnl').textContent=avg==null?'—':pct(avg);$('#paperMeta').textContent=trades.length?`${trades.length} paper trades • avg return`:'Belum ada paper trade.';
  $('#paperList').innerHTML=trades.length?trades.slice(0,30).map(t=>{const r=paperReturn(t);return`<article class="history-card"><div><h4>${esc(t.symbol)} • ${esc(t.side)}</h4><p>${new Date(t.opened).toLocaleString('id-ID')} • ${esc(t.status)}</p></div><div class="right"><b class="${r>=0?'positive':'negative'}">${r==null?'—':pct(r)}</b><span>entry ${fmt(t.entry,'USD')}</span></div></article>`}).join(''):`<div class="empty-state"><b>Paper book kosong.</b><span>Buka detail aset dan tekan Paper Trade.</span></div>`;
}
$('#clearSignalsBtn').onclick=()=>{store.set('inv_signal_memory_v8',[]);renderLab()};
$('#clearPaperBtn').onclick=()=>{store.set('inv_paper_v8',[]);renderLab()};

// ---------- PWA Install / Download App ----------
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('#installBtn').textContent='⇩ Download App'});
window.addEventListener('appinstalled',()=>{state.installPrompt=null;showToast('Aplikasi terpasang','Investment AI sudah ditambahkan ke perangkat.')});
$('#installBtn').onclick=async()=>{
  if(window.matchMedia('(display-mode: standalone)').matches)return showToast('Sudah terpasang','Anda sedang memakai versi aplikasi.');
  if(state.installPrompt){
    state.installPrompt.prompt();const choice=await state.installPrompt.userChoice;
    if(choice.outcome==='accepted')showToast('Menginstal aplikasi','Ikuti proses instalasi perangkat.');
    state.installPrompt=null;
  }else{
    showToast('Download App','Android Chrome: menu ⋮ → Tambahkan ke layar utama / Install app. iPhone Safari: Share → Add to Home Screen.');
  }
};


updateAlertUI();
Promise.allSettled([loadHealth(),loadRegime(),loadCrypto(),loadMacro(),loadMacroIntel(),loadAgentFeed()]).then(()=>{renderMarket();renderPortfolio();renderLab();startValidatedMonitor(alertPrefs().enabled)});
