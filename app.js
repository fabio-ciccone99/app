// --- storage portatile: usa window.storage dentro Claude, localStorage in locale ---
const _ws = (typeof window!=='undefined' && window.storage) ? window.storage : null;
const store = {
  async get(k){ if(_ws) return _ws.get(k); try{const v=localStorage.getItem(k);return v!=null?{key:k,value:v}:null}catch(e){return null} },
  async set(k,v){ if(_ws) return _ws.set(k,v); try{localStorage.setItem(k,v)}catch(e){} return {key:k,value:v} }
};

let DB=[]; let COSTS={}; let OPENING={mese:'2026-06',valore:9970};
let SCEN={years:{2026:{inc:100,cut:0},2027:{inc:100,cut:0},2028:{inc:100,cut:0},2029:{inc:100,cut:0}},injections:[],deferrals:[]};
const SCEN_YEARS=[2026,2027,2028,2029];
const KEY='ct:records:v2', CKEY='ct:costs:v2', OKEY='ct:open:v2', SKEY='ct:scen:v2';
const MESI=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const W={rinnovo:1.0,pack:0.6,prodotti:0.3};
const COST_YEAR={2026:21300,2027:18000,2028:16500,2029:16500};

async function load(){
  try{const r=await store.get(KEY); if(r&&r.value) DB=JSON.parse(r.value);}catch(e){DB=[]}
  try{const c=await store.get(CKEY); if(c&&c.value) COSTS=JSON.parse(c.value);}catch(e){COSTS={}}
  try{const o=await store.get(OKEY); if(o&&o.value) OPENING=JSON.parse(o.value);}catch(e){}
  try{const s=await store.get(SKEY); if(s&&s.value){const v=JSON.parse(s.value);SCEN.injections=v.injections||[];SCEN.deferrals=v.deferrals||[];if(v.years)SCEN_YEARS.forEach(y=>{if(v.years[y])SCEN.years[y]=v.years[y]})}}catch(e){}
}
async function save(){try{await store.set(KEY,JSON.stringify(DB))}catch(e){}}
async function saveCosts(){try{await store.set(CKEY,JSON.stringify(COSTS))}catch(e){}}
async function saveOpen(){try{await store.set(OKEY,JSON.stringify(OPENING))}catch(e){}}
async function saveScen(){try{await store.set(SKEY,JSON.stringify(SCEN))}catch(e){}}

const uid=()=>'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const mk=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')};
const mLabel=m=>{const[y,mo]=m.split('-');return MESI[+mo-1]+" '"+y.slice(2)};
const fmt=n=>'€ '+Math.round(n).toLocaleString('it-IT');
const fmtK=n=>{const a=Math.abs(n);return a>=1000?(n<0?'-':'')+'€'+(a/1000).toFixed(a%1000?1:0)+'k':'€'+Math.round(n)};
const NOW=new Date(), CURM=mk(NOW);
function addMonths(m,n){let[y,mo]=m.split('-').map(Number);mo+=n;while(mo>12){mo-=12;y++}while(mo<1){mo+=12;y--}return y+'-'+String(mo).padStart(2,'0')}
function cmpM(a,b){return a<b?-1:a>b?1:0}
function costDefault(m){return COST_YEAR[+m.slice(0,4)]||16500}
function costOf(m){return COSTS[m]!=null?COSTS[m]:costDefault(m)}

function cashByMonth(){const o={};DB.filter(r=>r.stato==='reale').forEach(r=>{const m=mk(r.data_cassa);o[m]=(o[m]||0)+r.importo});return o}
function compByMonth(f){const o={};DB.filter(f).forEach(r=>r.competenza.forEach(c=>{o[c.mese]=(o[c.mese]||0)+c.quota}));return o}
function compByMonthTipo(){const o={};DB.filter(r=>r.stato==='reale').forEach(r=>r.competenza.forEach(c=>{o[c.mese]=o[c.mese]||{rinnovo:0,pack:0,prodotti:0};o[c.mese][r.tipo]+=c.quota}));return o}
function last3avg(map){const ms=Object.keys(map).filter(m=>m<=CURM).sort(cmpM).slice(-3);return ms.length?ms.reduce((s,m)=>s+map[m],0)/ms.length:0}
function stockFuturo(){let s=0;DB.filter(r=>r.stato==='reale').forEach(r=>r.competenza.forEach(c=>{if(c.mese>CURM)s+=c.quota}));return s}
function stockFuturoNext(n){const l=addMonths(CURM,n);let s=0;DB.filter(r=>r.stato==='reale').forEach(r=>r.competenza.forEach(c=>{if(c.mese>CURM&&c.mese<=l)s+=c.quota}));return s}
function forecastNext(n){const l=addMonths(CURM,n);let lordo=0,pes=0;DB.filter(r=>r.stato==='previsto').forEach(r=>r.competenza.forEach(c=>{if(c.mese>CURM&&c.mese<=l){lordo+=c.quota;pes+=c.quota*(r.prob||0)/100}}));return{lordo,pes}}
function costNext(n){let s=0;for(let i=1;i<=n;i++)s+=costOf(addMonths(CURM,i));return s}

function projectBalance(opt){
  opt=opt||{};
  const years=opt.years||{}; const inj=opt.injections||[], defs=opt.deferrals||[];
  const endM = opt.end || addMonths(CURM, opt.months||6);
  const cashM=cashByMonth();
  const avgCash=last3avg(cashM);
  const fc={};DB.filter(r=>r.stato==='previsto').forEach(r=>r.competenza.forEach(c=>{if(c.mese>CURM)fc[c.mese]=(fc[c.mese]||0)+c.quota*(r.prob||0)/100}));
  const yInc=y=>years[y]&&years[y].inc!=null?years[y].inc/100:1;
  const yCut=y=>years[y]&&years[y].cut?years[y].cut:0;
  function adjCost(m){const y=+m.slice(0,4);let c=costOf(m)-yCut(y);defs.forEach(d=>{if(d.eur){if(m===d.da)c-=d.eur;if(m===d.a)c+=d.eur}});return c}
  function injOf(m){let s=0;inj.forEach(i=>{if(i.eur&&i.mese===m)s+=i.eur});return s}
  const out=[]; let saldo=OPENING.valore; let m=OPENING.mese;
  while(cmpM(m,endM)<=0){
    const y=+m.slice(0,4);
    const base = (m<=CURM ? (cashM[m]||0) : Math.max(avgCash,(fc[m]||0))*yInc(y));
    saldo = saldo + base + injOf(m) - adjCost(m);
    out.push({mese:m, saldo, fut:m>CURM});
    m=addMonths(m,1);
  }
  return out;
}
function runningBalance(){return projectBalance({months:6})}
const SCEN_END=()=>Math.max.apply(null,SCEN_YEARS)+'-12';

function kpis(){
  const cashM=cashByMonth(),compM=compByMonth(r=>r.stato==='reale'),tipoM=compByMonthTipo();
  const avgCash=last3avg(cashM),avgComp=last3avg(compM);
  let qN=0,qD=0,rin=0;
  Object.keys(tipoM).filter(m=>m<=CURM).sort(cmpM).slice(-3).forEach(m=>{const t=tipoM[m];qN+=t.rinnovo*W.rinnovo+t.pack*W.pack+t.prodotti*W.prodotti;qD+=t.rinnovo+t.pack+t.prodotti;rin+=t.rinnovo});
  const RQI=qD?Math.round(qN/qD*100):null;
  const rinShare=qD?rin/qD:0;
  const sec3=stockFuturoNext(3),exp3=avgComp*3;
  const cov=exp3?Math.min(100,sec3/exp3*100):0;
  const STAB=qD?Math.round(.7*cov+.3*rinShare*100):null;
  const fc3=forecastNext(3),cost3=costNext(3);
  const projCash3=Math.max(avgCash*3,fc3.pes);
  const risk=cost3?Math.max(0,Math.min(100,Math.round(100*(1-projCash3/cost3)))):null;
  let slip=0,base=0;DB.forEach(r=>{if(r.origin==='previsto'||r.stato==='previsto'||r.stato==='spostato'){base+=r.importo;if(r.slipped)slip+=r.importo}});
  const SLIP=base?Math.round(slip/base*100):null;
  let conv=0,lost=0;DB.forEach(r=>{if(r.origin==='previsto'&&r.stato==='reale')conv+=r.importo;if(r.stato==='perso')lost+=r.importo});
  const ACC=(conv+lost)?Math.round(conv/(conv+lost)*100):null;
  return[
    {lab:'Revenue Quality',val:RQI,suf:'/100',meta:'rinnovi vs nuovi vs prod.',col:'--grn',pct:RQI},
    {lab:'Stability Index',val:STAB,suf:'/100',meta:'futuro già coperto',col:'--blu',pct:STAB},
    {lab:'Cashflow Risk',val:risk,suf:'/100',meta:'incassi vs costi 3m',col:risk>50?'--red':'--amb',pct:risk},
    {lab:'Slippage Rate',val:SLIP,suf:'%',meta:'previsionali slittati',col:'--amb',pct:SLIP},
    {lab:'Forecast Accuracy',val:ACC,suf:'%',meta:'reale vs previsto',col:'--blu',pct:ACC},
    {lab:'Stock venduto',val:stockFuturo()?fmtK(stockFuturo()):'—',suf:'',meta:'ricavi futuri già incassati',col:'--amb',pct:Math.min(100,stockFuturo()/(avgComp*3||1)*100),raw:true}
  ];
}

let charts={};
function mkChart(id,cfg){if(charts[id])charts[id].destroy();charts[id]=new Chart(document.getElementById(id),cfg)}
const GRID={color:'#262b31'},TICK={color:'#8a9099',font:{family:'IBM Plex Mono',size:10}};
const baseOpts=st=>({responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#171a1e',borderColor:'#33393f',borderWidth:1,titleColor:'#e9eaec',bodyColor:'#e9eaec',titleFont:{family:'IBM Plex Mono'},bodyFont:{family:'IBM Plex Mono'},callbacks:{label:c=>' '+fmt(c.parsed.y)}}},scales:{x:{grid:{display:false},ticks:TICK,stacked:st},y:{grid:GRID,ticks:{...TICK,callback:v=>fmtK(v)},stacked:st}}});

function renderKPIs(){const b=document.getElementById('kpis');b.innerHTML='';kpis().forEach(k=>{const v=k.val==null?'—':k.val;b.insertAdjacentHTML('beforeend',`<div class="kpi"><div class="lab">${k.lab}</div><div class="val" style="color:var(${k.col})">${v}${k.val==null?'':k.suf}</div><div class="meta">${k.meta}</div><div class="bar" style="width:${Math.max(0,Math.min(100,k.pct||0))}%;background:var(${k.col})"></div></div>`)})}

function renderCash(){
  const m=cashByMonth();const months=Object.keys(m).sort(cmpM);
  const costs=months.map(x=>costOf(x)),net=months.map(x=>m[x]-costOf(x));
  mkChart('cCash',{data:{labels:months.map(mLabel),datasets:[
    {type:'bar',data:months.map(x=>m[x]),backgroundColor:'#ff5c33',borderRadius:2,maxBarThickness:42,order:2},
    {type:'line',data:costs,borderColor:'#ff4d4d',borderDash:[4,3],pointRadius:0,tension:.2,order:1},
    {type:'line',data:net,borderColor:'#36d399',backgroundColor:'rgba(54,211,153,.06)',fill:true,pointRadius:2,tension:.25,order:0}
  ]},options:baseOpts(false)});
  const tot=months.reduce((s,x)=>s+m[x],0);
  const totNet=net.reduce((s,x)=>s+x,0);
  document.getElementById('cashTot').textContent=fmt(tot);
  document.getElementById('cashAvg').textContent=months.length?fmtK(tot/months.length):'—';
  document.getElementById('costAvg').textContent=months.length?fmtK(costs.reduce((s,x)=>s+x,0)/months.length):'—';
  const na=months.length?totNet/months.length:0;
  const ne=document.getElementById('netAvg');ne.textContent=months.length?fmtK(na):'—';ne.style.color=na>=0?'var(--grn)':'var(--red)';
  const nt=document.getElementById('netTot');nt.textContent=fmtK(totNet);nt.style.color=totNet>=0?'var(--grn)':'var(--red)';
}
function renderPerf(){
  const t=compByMonthTipo();const months=Object.keys(t).sort(cmpM);
  mkChart('cPerf',{data:{labels:months.map(mLabel),datasets:[
    {type:'bar',label:'Rinnovo',data:months.map(x=>t[x].rinnovo),backgroundColor:'#36d399',maxBarThickness:42,stack:'s'},
    {type:'bar',label:'Pack',data:months.map(x=>t[x].pack),backgroundColor:'#4ea8ff',maxBarThickness:42,stack:'s'},
    {type:'bar',label:'Prodotti',data:months.map(x=>t[x].prodotti),backgroundColor:'#ffce4a',maxBarThickness:42,stack:'s'},
    {type:'line',label:'Costi',data:months.map(x=>costOf(x)),borderColor:'#ff4d4d',borderDash:[4,3],pointRadius:0,tension:.2}
  ]},options:baseOpts(true)});
  const cm=compByMonth(r=>r.stato==='reale');const tot=Object.values(cm).reduce((s,x)=>s+x,0);const mn=Object.keys(cm);
  document.getElementById('perfTot').textContent=fmt(tot);
  document.getElementById('perfAvg').textContent=mn.length?fmtK(tot/mn.length):'—';
  document.getElementById('perfCur').textContent=cm[CURM]?fmtK(cm[CURM]):'€0';
  let mar=0;mn.forEach(x=>mar+=cm[x]-costOf(x));const ma=mn.length?mar/mn.length:0;
  const me=document.getElementById('marAvg');me.textContent=mn.length?fmtK(ma):'—';me.style.color=ma>=0?'var(--grn)':'var(--red)';
  let rin=0,all=0;Object.values(t).forEach(x=>{rin+=x.rinnovo;all+=x.rinnovo+x.pack+x.prodotti});
  document.getElementById('perfRin').textContent=all?Math.round(rin/all*100)+'%':'—';
}
function renderFcst(){
  const f1=forecastNext(1),f3=forecastNext(3),f6=forecastNext(6);
  document.getElementById('f1').textContent=fmtK(f1.lordo);document.getElementById('f1w').textContent='pesato '+fmt(f1.pes);
  document.getElementById('f3').textContent=fmtK(f3.lordo);document.getElementById('f3w').textContent='pesato '+fmt(f3.pes);
  document.getElementById('f6').textContent=fmtK(f6.lordo);document.getElementById('f6w').textContent='pesato '+fmt(f6.pes);
  const months=[];for(let i=1;i<=6;i++)months.push(addMonths(CURM,i));
  const pm={};DB.filter(r=>r.stato==='previsto').forEach(r=>r.competenza.forEach(c=>{if(c.mese>CURM){pm[c.mese]=pm[c.mese]||{l:0,p:0};pm[c.mese].l+=c.quota;pm[c.mese].p+=c.quota*(r.prob||0)/100}}));
  mkChart('cFcst',{data:{labels:months.map(mLabel),datasets:[
    {type:'bar',data:months.map(x=>pm[x]?pm[x].l:0),backgroundColor:'rgba(78,168,255,.35)',maxBarThickness:42,order:2},
    {type:'bar',data:months.map(x=>pm[x]?pm[x].p:0),backgroundColor:'#4ea8ff',maxBarThickness:22,order:1},
    {type:'line',data:months.map(x=>costOf(x)),borderColor:'#ff4d4d',borderDash:[4,3],pointRadius:0,tension:.2,order:0}
  ]},options:baseOpts(false)});
  const ps=DB.filter(r=>r.stato==='previsto').sort((a,b)=>cmpM(a.competenza[0].mese,b.competenza[0].mese));
  let h='<table><tr><th>Mese</th><th>Cliente</th><th>Tipo</th><th class="num">€</th><th class="num">Prob</th><th></th></tr>';
  if(!ps.length)h+='<tr><td colspan="6" class="empty">Nessun previsionale aperto</td></tr>';
  ps.forEach(r=>{h+=`<tr><td>${mLabel(r.competenza[0].mese)}</td><td>${r.cliente||'—'}${r.parent?' <span style="color:var(--dim2)">↻</span>':''}</td><td class="t-${r.tipo}">${tipoLbl(r.tipo)}</td><td class="num">${fmt(r.importo)}</td><td class="num">${r.prob}%</td><td class="num"><button class="act" onclick="convert('${r.id}')">→reale</button><button class="act" onclick="lose('${r.id}')">perso</button></td></tr>`});
  h+='</table>';document.getElementById('fcstTable').innerHTML=h;
}
function renderGap(){
  const cash=cashByMonth(),comp=compByMonth(r=>r.stato==='reale');
  const months=[...new Set([...Object.keys(cash),...Object.keys(comp)])].sort(cmpM);
  mkChart('cGap',{type:'line',data:{labels:months.map(mLabel),datasets:[
    {label:'Cassa',data:months.map(x=>cash[x]||0),borderColor:'#ff5c33',backgroundColor:'rgba(255,92,51,.08)',fill:true,tension:.3,pointRadius:2},
    {label:'Competenza',data:months.map(x=>comp[x]||0),borderColor:'#36d399',backgroundColor:'rgba(54,211,153,.06)',fill:true,tension:.3,pointRadius:2}
  ]},options:baseOpts(false)});
  document.getElementById('stockTot').textContent=fmt(stockFuturo());
  let h='<table><tr><th>Mese</th><th class="num">Cassa</th><th class="num">Compet.</th><th class="num">Gap</th></tr>';
  months.forEach(x=>{const g=(cash[x]||0)-(comp[x]||0);h+=`<tr><td>${mLabel(x)}</td><td class="num">${fmtK(cash[x]||0)}</td><td class="num">${fmtK(comp[x]||0)}</td><td class="num" style="color:${g>=0?'var(--acc)':'var(--grn)'}">${g>=0?'+':''}${fmtK(g)}</td></tr>`});
  h+='</table>';document.getElementById('gapTable').innerHTML=h;
}
function renderCostTab(){
  const set=new Set();DB.forEach(r=>{set.add(mk(r.data_cassa));r.competenza.forEach(c=>set.add(c.mese))});
  for(let i=0;i<=6;i++)set.add(addMonths(CURM,i));set.add(CURM);
  const months=[...set].sort(cmpM);
  let h='<table><tr><th>Mese</th><th class="num">Costo €</th><th>Sorgente</th><th></th></tr>';
  months.forEach(x=>{const ov=COSTS[x]!=null;h+=`<tr><td>${mLabel(x)}</td><td class="num"><input type="number" value="${costOf(x)}" data-m="${x}" class="costin" style="max-width:120px;text-align:right"></td><td style="color:var(--dim)">${ov?'manuale':'default '+(+x.slice(0,4))}</td><td class="num">${ov?`<button class="act" onclick="resetCost('${x}')">reset</button>`:''}</td></tr>`});
  h+='</table>';document.getElementById('costTable').innerHTML=h;
  document.querySelectorAll('.costin').forEach(inp=>inp.onchange=()=>{COSTS[inp.dataset.m]=+inp.value;saveCosts();renderAll()});
}
function resetCost(m){delete COSTS[m];saveCosts();renderAll()}
function tipoLbl(t){return t==='pack'?'Pack nuovo':t==='rinnovo'?'Rinnovo':'Prodotti'}
function renderData(){
  const rows=[...DB].sort((a,b)=>b.data_cassa<a.data_cassa?-1:1);
  document.getElementById('dataCount').textContent=DB.length;
  document.getElementById('recCount').textContent=DB.length+' movimenti';
  let h='<table><tr><th>Cassa</th><th>Cliente</th><th>Ramo</th><th>Tipo</th><th class="num">€</th><th>Met.</th><th>Stato</th><th>Comp.</th><th></th></tr>';
  if(!rows.length)h+='<tr><td colspan="9" class="empty">Nessun movimento — incolla le righe o carica i dati esempio</td></tr>';
  rows.forEach(r=>{const comp=r.competenza.length>1?mLabel(r.competenza[0].mese)+'+'+(r.competenza.length-1):mLabel(r.competenza[0].mese);
    h+=`<tr><td>${r.data_cassa}</td><td>${r.cliente||'—'}</td><td style="color:var(--dim)">${r.ramo||'—'}</td><td class="t-${r.tipo}">${tipoLbl(r.tipo)}</td><td class="num">${fmt(r.importo)}</td><td style="color:var(--dim)">${r.metodo||'—'}</td><td><span class="pill p-${r.stato}">${r.stato}${r.stato==='previsto'?' '+r.prob+'%':''}</span>${r.slipped?' <span class="pill p-spostato">slip</span>':''}</td><td style="color:var(--dim)">${comp}</td><td class="num"><button class="act" onclick="openMove('${r.id}')">sposta</button><button class="act" onclick="del('${r.id}')" style="border-color:var(--line)">×</button></td></tr>`});
  h+='</table>';document.getElementById('dataTable').innerHTML=h;
  const rami=[...new Set(DB.map(r=>r.ramo).filter(Boolean))];
  document.getElementById('rami').innerHTML=rami.map(r=>`<option>${r}</option>`).join('');
}
function renderProj(){
  const rb=runningBalance();
  if(!rb.length){return}
  const labels=rb.map(x=>mLabel(x.mese));
  const data=rb.map(x=>x.saldo);
  const splitIdx=rb.findIndex(x=>x.fut);
  const pointCol=rb.map(x=>x.saldo<0?'#ff4d4d':(x.fut?'#4ea8ff':'#ff5c33'));
  mkChart('cProj',{type:'line',data:{labels,datasets:[
    {data,borderColor:'#4ea8ff',backgroundColor:'rgba(78,168,255,.07)',fill:true,tension:.25,
     pointRadius:4,pointBackgroundColor:pointCol,pointBorderColor:pointCol,
     segment:{borderDash:c=>c.p1DataIndex>=splitIdx&&splitIdx>0?[5,4]:undefined}},
    {data:rb.map(()=>0),borderColor:'rgba(255,77,77,.5)',borderWidth:1,borderDash:[2,3],pointRadius:0}
  ]},options:baseOpts(false)});
  const min=rb.reduce((a,b)=>b.saldo<a.saldo?b:a,rb[0]);
  const pm=document.getElementById('projMin');pm.textContent=fmt(min.saldo);pm.style.color=min.saldo<0?'var(--red)':(min.saldo<5000?'var(--amb)':'var(--grn)');
  document.getElementById('projMinM').textContent='minimo: '+mLabel(min.mese);
  const at=m=>{const f=rb.find(x=>x.mese===m);return f?f.saldo:null};
  const now=at(CURM),p3=at(addMonths(CURM,3)),p6=at(addMonths(CURM,6));
  const setv=(id,v)=>{const e=document.getElementById(id);if(v==null){e.textContent='—';return}e.textContent=fmtK(v);e.style.color=v<0?'var(--red)':'var(--txt)'};
  setv('projNow',now);setv('proj3',p3);setv('proj6',p6);
}
function renderScenario(){
  const end=SCEN_END();
  const base=projectBalance({end});
  const scen=projectBalance({end,years:SCEN.years,injections:SCEN.injections,deferrals:SCEN.deferrals});
  const labels=base.map(x=>mLabel(x.mese));
  mkChart('cScen',{type:'line',data:{labels,datasets:[
    {data:base.map(x=>x.saldo),borderColor:'#5c636b',borderWidth:1.5,borderDash:[4,4],pointRadius:0,tension:.2,fill:false},
    {data:scen.map(x=>x.saldo),borderColor:'#36d399',backgroundColor:'rgba(54,211,153,.07)',fill:true,tension:.25,pointRadius:0,borderWidth:2},
    {data:base.map(()=>0),borderColor:'rgba(255,77,77,.5)',borderWidth:1,borderDash:[2,3],pointRadius:0}
  ]},options:baseOpts(false)});
  const minS=scen.reduce((a,b)=>b.saldo<a.saldo?b:a,scen[0]);
  const sm=document.getElementById('scMin');sm.textContent=fmt(minS.saldo);sm.style.color=minS.saldo<0?'var(--red)':(minS.saldo<5000?'var(--amb)':'var(--grn)');
  document.getElementById('scMinM').textContent='punto critico: '+mLabel(minS.mese);
  // saldo fine anno per ogni anno (scenario)
  const endOf=(arr,y)=>{const f=arr.filter(x=>x.mese.slice(0,4)==y);return f.length?f[f.length-1].saldo:null};
  const ye=document.getElementById('scYearEnds');ye.innerHTML='';
  SCEN_YEARS.forEach(y=>{const v=endOf(scen,y);if(v==null)return;ye.insertAdjacentHTML('beforeend',`<div class="c"><div class="l">Fine ${y}</div><div class="v" style="color:${v<0?'var(--red)':'var(--txt)'}">${fmtK(v)}</div></div>`)});
  const endScen=scen[scen.length-1].saldo, endBase=base[base.length-1].saldo, delta=endScen-endBase;
  const dl=document.getElementById('scDelta');dl.textContent=(delta>=0?'+':'')+fmt(delta);dl.style.color=delta>=0?'var(--grn)':'var(--red)';
  const subZero=scen.find(x=>x.fut&&x.saldo<0);
  document.getElementById('scNote').textContent=subZero?('⚠ sotto zero a '+mLabel(subZero.mese)):'liquidità sempre positiva nell\'orizzonte';
  renderYearTable(scen);
  renderLeverList('injList',SCEN.injections,x=>`${x.lab||'iniezione'} · ${fmt(x.eur)} · ${x.mese?mLabel(x.mese):'—'}`,'injections');
  renderLeverList('defList',SCEN.deferrals,x=>`${fmt(x.eur)} · ${x.da?mLabel(x.da):'—'} → ${x.a?mLabel(x.a):'—'}`,'deferrals');
}
function renderYearTable(scen){
  const endOf=y=>{const f=scen.filter(x=>x.mese.slice(0,4)==y);return f.length?f[f.length-1].saldo:null};
  let h='<table><tr><th>Anno</th><th class="num">Incassi %</th><th class="num">Taglio €/mese</th><th class="num">Costo base/mese</th><th class="num">Saldo fine anno</th></tr>';
  SCEN_YEARS.forEach(y=>{const yc=SCEN.years[y]||{inc:100,cut:0};const v=endOf(y);
    h+=`<tr><td><b>${y}</b></td>
    <td class="num"><input type="number" value="${yc.inc}" data-y="${y}" data-k="inc" class="yin" style="max-width:80px;text-align:right"></td>
    <td class="num"><input type="number" value="${yc.cut}" data-y="${y}" data-k="cut" class="yin" style="max-width:100px;text-align:right" step="100"></td>
    <td class="num" style="color:var(--dim)">${fmt(costDefault(y+'-01'))}</td>
    <td class="num" style="color:${v!=null&&v<0?'var(--red)':'var(--grn)'};font-weight:600">${v==null?'—':fmt(v)}</td></tr>`});
  h+='</table>';document.getElementById('yearTable').innerHTML=h;
  document.querySelectorAll('.yin').forEach(inp=>inp.onchange=()=>{const y=inp.dataset.y,k=inp.dataset.k;SCEN.years[y]=SCEN.years[y]||{inc:100,cut:0};SCEN.years[y][k]=+inp.value;saveScen();renderScenario()});
}
function renderLeverList(id,arr,fmtFn,key){
  const el=document.getElementById(id);
  if(!arr.length){el.innerHTML='<div class="hint" style="margin:0">Nessuna ipotesi attiva.</div>';return}
  el.innerHTML=arr.map((x,i)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--line);font-size:12px"><span>${fmtFn(x)}</span><button class="act" onclick="rmLever('${key}',${i})" style="border-color:var(--line)">×</button></div>`).join('');
}
function rmLever(key,i){SCEN[key].splice(i,1);saveScen();renderScenario()}
function renderAll(){renderKPIs();renderCash();renderProj();renderScenario();renderPerf();renderFcst();renderGap();renderCostTab();renderData()}

function makeRecord(o){return Object.assign({id:uid(),ramo:'',metodo:'',cliente:'',prob:100,origin:o.stato||'reale',slipped:false,parent:null,storico:[]},o)}
function scheduleRenewal(src,n){
  if(!n||n<1)return;
  const compMonth=addMonths(src.competenza[0].mese,n);
  const d=new Date(src.data_cassa);d.setMonth(d.getMonth()+n);
  DB.push(makeRecord({importo:src.importo,tipo:'rinnovo',stato:'previsto',data_cassa:d.toISOString().slice(0,10),cliente:src.cliente,ramo:src.ramo,metodo:src.metodo,prob:70,origin:'previsto',parent:src.id,competenza:[{mese:compMonth,quota:src.importo}],storico:[{t:Date.now(),a:'rinnovo schedulato da pack'}]}));
}
function add(){
  const imp=+document.getElementById('i-imp').value;if(!imp){document.getElementById('i-imp').focus();return}
  const stato=document.getElementById('i-stato').value;
  const data=document.getElementById('i-data').value||new Date().toISOString().slice(0,10);
  const comp=document.getElementById('i-comp').value||CURM;
  const rec=makeRecord({importo:imp,tipo:document.getElementById('i-tipo').value,stato,data_cassa:data,
    cliente:document.getElementById('i-cli').value.trim(),ramo:document.getElementById('i-ramo').value.trim(),
    metodo:document.getElementById('i-met').value.trim(),prob:stato==='previsto'?+document.getElementById('i-prob').value:100,
    origin:stato,competenza:[{mese:comp,quota:imp}],storico:[{t:Date.now(),a:'creato '+stato}]});
  DB.push(rec);
  scheduleRenewal(rec,+document.getElementById('i-rinn').value);
  ['i-imp','i-cli','i-rinn'].forEach(id=>document.getElementById(id).value='');
  save();renderAll();
}
function del(id){DB=DB.filter(r=>r.id!==id);save();renderAll()}
function convert(id){const r=DB.find(x=>x.id===id);if(!r)return;r.stato='reale';r.prob=100;r.data_cassa=new Date().toISOString().slice(0,10);r.storico.push({t:Date.now(),a:'convertito in reale'});save();renderAll()}
function lose(id){const r=DB.find(x=>x.id===id);if(!r)return;r.stato='perso';r.storico.push({t:Date.now(),a:'perso'});save();renderAll()}

let moveTarget=null;
function openMove(id){const r=DB.find(x=>x.id===id);if(!r)return;moveTarget=id;
  let h='<div class="hint" style="margin:0 0 12px">Cassa <b>'+r.data_cassa+'</b> · '+fmt(r.importo)+' — non cambia. Modifica i mesi di competenza:</div>';
  r.competenza.forEach((c,i)=>{h+=`<div class="spread-row"><input type="month" value="${c.mese}" data-i="${i}" class="mvm"><span style="color:var(--dim)">${fmt(c.quota)}</span></div>`});
  document.getElementById('moveBody').innerHTML=h;document.getElementById('moveDlg').showModal()}
document.getElementById('moveSave').onclick=()=>{const r=DB.find(x=>x.id===moveTarget);if(!r)return;let later=false;
  document.querySelectorAll('.mvm').forEach(inp=>{const i=+inp.dataset.i,old=r.competenza[i].mese;if(inp.value&&inp.value!==old){if(inp.value>old)later=true;r.competenza[i].mese=inp.value}});
  if(later&&(r.stato==='previsto'||r.origin==='previsto'))r.slipped=true;
  r.storico.push({t:Date.now(),a:'competenza spostata'});save();document.getElementById('moveDlg').close();renderAll()};

let parsed=[];
function parsePaste(){
  const txt=document.getElementById('pasteBox').value.trim();if(!txt)return;
  const bm=document.getElementById('batchMonth').value||CURM;
  parsed=txt.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
    let p=l.split(/\t|\s{2,}|;|\|/).map(s=>s.trim()).filter(Boolean);
    if(p.length<3) p=l.split(/[\s,]+/).map(s=>s.trim()).filter(Boolean);
    let ramo='',imp=0,met='',cli='';
    const numIdx=p.findIndex(x=>/^\d+([.,]\d+)?$/.test(x.replace(/[€\s]/g,'')));
    if(numIdx>=0){imp=+p[numIdx].replace(/[€\s]/g,'').replace(',','.');ramo=p.slice(0,numIdx).join(' ');const rest=p.slice(numIdx+1);met=rest[0]||'';cli=rest.slice(1).join(' ')}
    else{cli=p.join(' ')}
    return{ramo,importo:imp,metodo:met,cliente:cli,tipo:'rinnovo',mese:bm};
  });
  renderReview();
}
function renderReview(){
  if(!parsed.length){document.getElementById('reviewBox').innerHTML='';return}
  let h='<table class="rev"><tr><th>Cliente</th><th>Ramo</th><th class="num">€</th><th>Metodo</th><th>Tipo</th><th>Competenza</th></tr>';
  parsed.forEach((r,i)=>{h+=`<tr>
    <td><input value="${r.cliente}" onchange="parsed[${i}].cliente=this.value"></td>
    <td><input value="${r.ramo}" onchange="parsed[${i}].ramo=this.value" style="max-width:90px"></td>
    <td class="num"><input type="number" value="${r.importo}" onchange="parsed[${i}].importo=+this.value" style="max-width:90px;text-align:right"></td>
    <td><input value="${r.metodo}" onchange="parsed[${i}].metodo=this.value" style="max-width:90px"></td>
    <td><select onchange="parsed[${i}].tipo=this.value"><option value="pack"${r.tipo==='pack'?' selected':''}>Pack</option><option value="rinnovo"${r.tipo==='rinnovo'?' selected':''}>Rinnovo</option><option value="prodotti"${r.tipo==='prodotti'?' selected':''}>Prodotti</option></select></td>
    <td><input type="month" value="${r.mese}" onchange="parsed[${i}].mese=this.value" style="max-width:130px"></td></tr>`});
  h+='</table><div class="toolbar" style="margin-top:12px"><button class="btn" id="confImport">Importa '+parsed.length+' righe</button><button class="gho" id="cancImport">Annulla</button></div>';
  document.getElementById('reviewBox').innerHTML=h;
  document.getElementById('cancImport').onclick=()=>{parsed=[];renderReview();document.getElementById('pasteBox').value=''};
  document.getElementById('confImport').onclick=()=>{
    parsed.forEach(r=>{if(!r.importo)return;const d=r.mese+'-15';DB.push(makeRecord({importo:r.importo,tipo:r.tipo,stato:'reale',data_cassa:d,cliente:r.cliente,ramo:r.ramo,metodo:r.metodo,prob:100,origin:'reale',competenza:[{mese:r.mese,quota:r.importo}],storico:[{t:Date.now(),a:'importato'}]}))});
    parsed=[];document.getElementById('pasteBox').value='';document.getElementById('reviewBox').innerHTML='';save();renderAll();
  };
}

function seed(){
  const today=new Date();
  const past=n=>{const d=new Date(today);d.setMonth(d.getMonth()-n);d.setDate(8+Math.floor(Math.random()*15));return d.toISOString().slice(0,10)};
  const fut=n=>{const d=new Date(today);d.setMonth(d.getMonth()+n);d.setDate(10);return d.toISOString().slice(0,10)};
  const cl=['Rossi','Bianchi','Esposito','Romano','Greco','Conti','Ricci','Marino','Bruno','Gallo','Costa','Fontana','Guarriello','Russo'];
  const rami=['well','fit','hub'];const C=i=>cl[i%cl.length];let k=0;DB=[];
  for(let mo=3;mo>=0;mo--){
    for(let j=0;j<4;j++){const d=past(mo);DB.push(makeRecord({importo:560,tipo:'rinnovo',stato:'reale',data_cassa:d,cliente:C(k++),ramo:rami[k%3],metodo:'DIL',competenza:[{mese:mk(d),quota:560}]}))}
    const dp=past(mo);DB.push(makeRecord({importo:600,tipo:'pack',stato:'reale',data_cassa:dp,cliente:C(k++),ramo:rami[k%3],metodo:'Carta',competenza:[{mese:mk(dp),quota:600}]}));
    const dpr=past(mo);DB.push(makeRecord({importo:120,tipo:'prodotti',stato:'reale',data_cassa:dpr,cliente:C(k++),ramo:'well',metodo:'Contanti',competenza:[{mese:mk(dpr),quota:120}]}));
  }
  const dadv=past(0);DB.push(makeRecord({importo:600,tipo:'pack',stato:'reale',data_cassa:dadv,cliente:C(k++),ramo:'fit',metodo:'Bonifico',competenza:[{mese:addMonths(CURM,2),quota:600}],storico:[{t:Date.now(),a:'pagato in anticipo'}]}));
  for(let mo=1;mo<=4;mo++){const d=fut(mo);DB.push(makeRecord({importo:560,tipo:'rinnovo',stato:'previsto',data_cassa:d,cliente:C(k++),ramo:rami[k%3],metodo:'DIL',prob:80,origin:'previsto',competenza:[{mese:mk(d),quota:560}]}))}
  const dsl=fut(2);DB.push(makeRecord({importo:600,tipo:'pack',stato:'previsto',data_cassa:dsl,cliente:C(k++),ramo:'hub',prob:40,origin:'previsto',slipped:true,competenza:[{mese:mk(dsl),quota:600}],storico:[{t:Date.now(),a:'slittato'}]}));
  const dls=past(1);DB.push(makeRecord({importo:600,tipo:'pack',stato:'perso',data_cassa:dls,cliente:C(k++),ramo:'fit',prob:0,origin:'previsto',competenza:[{mese:mk(dls),quota:600}]}));
  save();renderAll();
}

document.getElementById('exportBtn').onclick=()=>{const b=new Blob([JSON.stringify({records:DB,costs:COSTS},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='control-tower.json';a.click()};
document.getElementById('importBtn').onclick=()=>document.getElementById('fileIn').click();
document.getElementById('fileIn').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{const o=JSON.parse(rd.result);if(Array.isArray(o)){DB=o}else{DB=o.records||[];COSTS=o.costs||{}}save();saveCosts();renderAll()}catch(x){alert('JSON non valido')}};rd.readAsText(f)};
document.getElementById('clearBtn').onclick=()=>{if(confirm('Svuotare tutti i movimenti?')){DB=[];save();renderAll()}};
document.getElementById('seedBtn').onclick=()=>{if(!DB.length||confirm('Sovrascrivo con i dati esempio?'))seed()};
document.getElementById('addBtn').onclick=add;
document.getElementById('openBtn').onclick=()=>{const m=document.getElementById('o-mese').value,v=+document.getElementById('o-val').value;if(m)OPENING.mese=m;if(!isNaN(v))OPENING.valore=v;saveOpen();renderAll()};
// scenario levers
document.getElementById('injAdd').onclick=()=>{const eur=+document.getElementById('inj-eur').value;if(!eur)return;SCEN.injections.push({lab:document.getElementById('inj-lab').value.trim(),eur,mese:document.getElementById('inj-m').value||addMonths(CURM,1)});['inj-lab','inj-eur'].forEach(id=>document.getElementById(id).value='');saveScen();renderScenario()};
document.getElementById('defAdd').onclick=()=>{const eur=+document.getElementById('def-eur').value,da=document.getElementById('def-da').value,a=document.getElementById('def-a').value;if(!eur||!da||!a)return;SCEN.deferrals.push({eur,da,a});document.getElementById('def-eur').value='';saveScen();renderScenario()};
document.getElementById('parseBtn').onclick=parsePaste;
document.getElementById('i-stato').onchange=e=>{document.getElementById('probWrap').style.display=e.target.value==='previsto'?'flex':'none'};
document.getElementById('i-data').value=new Date().toISOString().slice(0,10);
document.getElementById('i-comp').value=CURM;
document.getElementById('batchMonth').value=CURM;
['inj-m','def-da'].forEach(id=>document.getElementById(id).value=addMonths(CURM,1));
document.getElementById('def-a').value=addMonths(CURM,3);
document.getElementById('o-mese').value=OPENING.mese;
document.getElementById('o-val').value=OPENING.valore;
document.getElementById('curMonth').textContent=mLabel(CURM);
document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#nav button').forEach(x=>x.classList.remove('on'));b.classList.add('on');document.querySelectorAll('.view').forEach(v=>v.classList.remove('on'));document.getElementById('v-'+b.dataset.v).classList.add('on');setTimeout(()=>Object.values(charts).forEach(c=>{try{c.resize()}catch(e){}}),30)});

(async()=>{await load();document.getElementById('o-mese').value=OPENING.mese;document.getElementById('o-val').value=OPENING.valore;if(!DB.length)seed();else renderAll()})();
