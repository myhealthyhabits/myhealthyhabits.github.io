/* v44 extras: recent meals re-log, on-device meal photo thumbnails, daily goal celebrations */
/* ---------- Recent meals ---------- */
function rmList(excl){const out=new Map(),today=logicalToday();
 Object.keys(D.log).sort().reverse().slice(0,60).forEach(d=>{const L=D.log[d]||{};Object.entries(L).forEach(([m,es])=>{if(!es||es.length<2)return;if(d===today&&m===excl)return;
  const k=es.map(e=>fkey(e.food)+'×'+r1(e.qty)+'·'+(e.ui||0)).sort().join('|');const o=out.get(k);if(o){o.n++;return}out.set(k,{k,n:1,d,m,es})})});
 return[...out.values()].sort((a,b)=>(b.n>1)-(a.n>1)||b.n-a.n||(b.d>a.d?1:-1)).slice(0,6)}
function rmHtml(mid,title){const L=rmList(mid);window._rm=L;if(!L.length)return'';
 return`<div class="rmw"><div class="rmt">🔁 ${esc(title||'Recent meals · one tap to re-log')}</div><div class="rml">${L.map((r,i)=>{const s=sumEntries(r.es),nm=r.es.map(e=>e.food.name.split(',')[0]);
  return`<div class="rmc"><div class="rme">${[...new Set(r.es.map(e=>emoOf(e.food)))].slice(0,3).join('')}</div><div class="rmn"><b>${esc(nm.slice(0,2).join(' + '))}${nm.length>2?` <small>+${nm.length-2}</small>`:''}</b><small>${fE(s.kcal)} · ${r.n>1?r.n+'× logged':'last '+esc(nice(r.d))}</small></div><button class="rmp" data-rm="${i}" aria-label="Re-log this meal">+</button></div>`}).join('')}</div></div>`}
function rmBind(getMid,done){document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const r=(window._rm||[])[+b.dataset.rm];if(!r)return;const mid=getMid(),ids=[];window._fxMeal=r.es.length>1;
 r.es.forEach(e=>{const x={...e,id:uid()};delete x.ph;ids.push(x.id);addEntry(mid,x)});save();done&&done();const mn=(D.meals.find(m=>m.id===mid)||{}).name;
 toastU(`Re-logged ${r.es.length} items to ${mn} · ${fE(sumEntries(r.es).kcal)}`,()=>{const a=dayLog(cur)[mid]||[];dayLog(cur)[mid]=a.filter(x=>!ids.includes(x.id))})})}
/* ---------- Meal photo thumbnails (IndexedDB, this device only) ---------- */
const PHDB=()=>new Promise((ok,no)=>{const r=indexedDB.open('mhh-photos',1);r.onupgradeneeded=()=>r.result.createObjectStore('p',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
async function phPut(id,img){if(D.noThumbs||!window.indexedDB)return;try{const db=await PHDB();db.transaction('p','readwrite').objectStore('p').put({id,img,t:Date.now()})}catch(e){}}
async function phGet(id){try{const db=await PHDB();return await new Promise(ok=>{const q=db.transaction('p').objectStore('p').get(id);q.onsuccess=()=>ok(q.result&&q.result.img);q.onerror=()=>ok(null)})}catch(e){return null}}
async function phClear(maxAge){try{const db=await PHDB(),st=db.transaction('p','readwrite').objectStore('p'),c=st.openCursor(),lim=Date.now()-(maxAge||0);c.onsuccess=()=>{const k=c.result;if(!k)return;if(!maxAge||k.value.t<lim)k.delete();k.continue()}}catch(e){}}
setTimeout(()=>phClear(60*864e5),3000);
async function phFill(){for(const b of document.querySelectorAll('.mph[data-ph]:not(.ok)')){b.classList.add('ok');let img=null;for(const id of b.dataset.ph.split(' ')){img=await phGet(id);if(img)break}
 if(!img){b.remove();continue}b.style.backgroundImage=`url(${img})`;b.onclick=ev=>{ev.stopPropagation();sheet(`<h2>📷 Meal photo</h2><img src="${img}" class="phbig" alt="Meal photo"><p class="mut" style="font-size:13px">Saved only on this device. Turn off in Settings → Meals.</p><button class="btn alt" data-close="1">Close</button>`)}}}
/* ---------- Goal celebrations ---------- */
const GH='mhh-goalhit';
function goalCheck(){if(tab!=='today'||cur!==logicalToday())return;const L=D.log[cur]||{},t=sumEntries(Object.values(L).flat()),g=macroGoal(),b=budget();
 let st={};try{st=JSON.parse(localStorage.getItem(GH)||'{}')}catch(e){}if(st.d!==cur)st={d:cur,h:[],seen:0};
 const hit=[];if(g.p&&t.p>=g.p)hit.push(['p','💪 Protein goal hit!']);if((D.water[cur]||0)>=(D.waterGoal||64))hit.push(['w','💧 Water goal hit!']);if(t.kcal>=b*.9&&t.kcal<=b)hit.push(['k','🎯 Calories in range!']);
 const nw=hit.filter(([k])=>!st.h.includes(k));if(!nw.length)return;st.h.push(...nw.map(x=>x[0]));localStorage.setItem(GH,JSON.stringify(st));goalParty(nw.map(x=>x[1]).join('  '))}
function goalParty(msg){const old=document.getElementById('gbadge');if(old)old.remove();const w=document.createElement('div');w.id='gbadge';w.className='gbadge';w.setAttribute('role','status');w.innerHTML=`<b>Goal hit!</b><span>${esc(msg)}</span>`;document.body.appendChild(w);setTimeout(()=>w.classList.add('out'),3800);setTimeout(()=>w.remove(),4400);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const c=document.createElement('canvas');c.className="gconf";c.width=innerWidth;c.height=innerHeight;document.body.appendChild(c);const x=c.getContext('2d'),C=['#22c55e','#f97316','#ec4899','#3b82f6','#eab308','#a78bfa'];
 const P=Array.from({length:90},()=>({x:innerWidth/2+(Math.random()-.5)*80,y:innerHeight*.35,vx:(Math.random()-.5)*7,vy:-Math.random()*7-3,r:Math.random()*6.28,s:5+Math.random()*5,c:C[Math.random()*C.length|0]}));let f=0;
 (function step(){x.clearRect(0,0,c.width,c.height);P.forEach(p=>{p.vy+=.18;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=.08;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.globalAlpha=Math.max(0,1-f/150);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore()});if(++f<150)requestAnimationFrame(step);else c.remove()})()}
function afterRender(){phFill();fxAfter();snapTab();setTimeout(goalCheck,(window._fxQ&&_fxQ.length)?1300:250)}

/* ---------- v45: fun log animations ---------- */
const fxOn=()=>!D.noFx,fxRM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
window._fxQ=[];
function fxWrap(){if(window._fxW||typeof addEntry!=='function')return;window._fxW=1;const orig=addEntry;
 window.addEntry=addEntry=function(mid,e,date){const d=date||cur;if(d===cur&&fxOn()&&e){if(!_fxQ.length){_fxQ.prev=dayTotal(cur).kcal}_fxQ.push({mid,emo:emoOf(e.food),kcal:e.kcal||0,id:e.id})}return orig.apply(this,arguments)}}
fxWrap();addEventListener('load',fxWrap);
const sheetOpen=()=>{const s=document.getElementById('sheet');return s&&!s.classList.contains('hidden')};
function fxHold(){const g=document.querySelector('.gwrap');if(!g||!_fxQ.length)return;const prev=_fxQ.prev||0,bud=budget(),N=g.querySelectorAll('.gtr line').length||1,k0=Math.round(Math.min(1,prev/bud)*N);
 g.querySelectorAll('.gfl line').forEach((l,i)=>{if(i>=k0&&l.dataset.fx===undefined){l.dataset.fx=l.dataset.on;l.dataset.on='0'}});const gl=g.querySelector('.glead');if(gl)gl.style.opacity='0';
 const nb=g.querySelector('.gin b');if(nb)nb.textContent=Math.abs(Math.round(bud-prev)).toLocaleString();
 _fxQ.forEach(x=>{const r=document.querySelector(`.mi[data-edit="${x.mid}|${x.id}"]`);if(r)r.style.opacity='0'})}
function fxAfter(){if(window._fxSnap&&!fxOn()){window._fxSnap=0;setTimeout(snapReward,300)}if(!_fxQ.length)return;if(tab==='today'&&fxOn())fxHold();if(window._fxMeal){_fxQ.meal=1;window._fxMeal=0}if(window._fxSnap){_fxQ.snap=1;window._fxSnap=0}
 if(tab!=='today'){if(!sheetOpen())_fxQ.length=0;return}
 if(sheetOpen()){clearTimeout(window._fxT);window._fxT=setTimeout(()=>{if(!sheetOpen())setTimeout(fxPlay,350);else fxAfter()},250);return}fxPlay()}
/* v50: slower, clearly visible log animation. Timeline: pop in place (0.5s) -> gentle arc (2.3s) -> soft bounce landing (0.5s) -> row slides in, wheel fills (2.5s), chip 3s. */
const FX={pop:500,fly:2300,land:500,stag:180,fill:2500,chip:3000};
function fxVis(el){if(!el)return false;const r=el.getBoundingClientRect();return r.bottom>60&&r.top<innerHeight-90}
function fxPlay(){const prev=_fxQ.prev||0,meal=_fxQ.meal,snap=_fxQ.snap;_fxQ.snap=0;_fxQ.meal=0;const Q=_fxQ.splice(0);if(!Q.length)return;
 const rm=fxRM(),mids=[...new Set(Q.map(x=>x.mid))],card=m=>{const b=document.querySelector(`.mch [data-add="${m}"]`);return b&&b.closest('.meal')};
 const g0=document.querySelector('.gwrap');let tgt=card(Q[0].mid),toWheel=false,wait=0;
 if(!fxVis(tgt)){if(fxVis(g0))toWheel=true;else if(tgt){tgt.scrollIntoView({block:'center',behavior:rm?'auto':'smooth'});wait=rm?0:650}}
 window._fxBusy=Date.now();setTimeout(()=>fxRun(Q,prev,meal,snap,rm,mids,card,toWheel),Math.max(wait,120))}
function fxRun(Q,prev,meal,snap,rm,mids,card,toWheel){const now=dayTotal(cur).kcal,add=Q.reduce((s,x)=>s+x.kcal,0),n=Math.min(Q.length,6);
 const LAND=rm?600:FX.pop+FX.fly+(n-1)*FX.stag;if(snap)setTimeout(snapReward,LAND+(meal?3200:2600));setTimeout(()=>{window._fxBusy=0},LAND+FX.fill+400);
 try{navigator.vibrate&&navigator.vibrate(10)}catch(e){}
 // hide the new rows until the emoji lands, then slide them in
 Q.forEach((x,i)=>{const r=document.querySelector(`.mi[data-edit="${x.mid}|${x.id}"]`);if(r){r.classList.remove('fxland','fxfade');r.style.opacity='0';setTimeout(()=>{r.style.opacity='';r.classList.add(rm?'fxfade':'fxland');r.style.animationDelay='0ms'},rm?LAND:FX.pop+FX.fly+Math.min(i,n-1)*FX.stag)}});
 // wheel: hold at the old value, then fill after landing
 const g=document.querySelector('.gwrap'),nb=g&&g.querySelector('.gin b'),bud=budget();
 if(g){g.querySelectorAll('.gfl line').forEach(l=>{if(l.dataset.fx!==undefined){l.dataset.on=l.dataset.fx;delete l.dataset.fx}});const N=g.querySelectorAll('.gtr line').length||1,L=[...g.querySelectorAll('.gfl line')],k0=Math.round(Math.min(1,prev/bud)*N),on=L.filter(l=>l.dataset.on==='1'),kOn=on.length,gl=g.querySelector('.glead');
  L.forEach((l,i)=>{if(i>=k0){l.getAnimations().forEach(a=>a.cancel());l.style.transition='none';l.style.opacity='0'}});if(gl&&kOn>k0){gl.style.transition='none';gl.style.opacity='0'}
  const fmt=v=>Math.abs(v).toLocaleString(),left0=Math.round(bud-prev),left1=Math.round(bud-now);if(nb)nb.textContent=fmt(left0);
  setTimeout(()=>{if(!g.isConnected)return;g.classList.remove('fxglow');void g.offsetWidth;g.classList.add('fxglow');
   const span=Math.max(1,kOn-k0),step=(FX.fill-600)/span;L.forEach((l,i)=>{if(i>=k0&&l.dataset.on==='1'){const a=l.animate([{opacity:0},{opacity:1}],{duration:rm?400:600,delay:rm?0:(i-k0)*step,fill:'backwards',easing:'ease-out'});l.style.opacity='1';a.onfinish=()=>{l.style.transition=''}}});
   if(gl){setTimeout(()=>{gl.style.transition='opacity .6s ease';gl.style.opacity=''},rm?0:FX.fill-500)}
   if(nb){const t0=performance.now(),D0=rm?400:FX.fill;(function st(t){if(!nb.isConnected)return;const p=Math.min(1,(t-t0)/D0),e=1-Math.pow(1-p,3);nb.textContent=fmt(Math.round(left0+(left1-left0)*e));if(p<1)requestAnimationFrame(st)})(t0)}
   const r=(nb||g).getBoundingClientRect(),c=document.createElement('div');c.className='fxchip'+(rm?' rm':'');c.textContent=`+${Math.round(add).toLocaleString()} cal`;c.style.left=(r.left+r.width/2)+'px';c.style.top=(r.top-6)+'px';document.body.appendChild(c);setTimeout(()=>c.remove(),FX.chip+100)},LAND)}
 // flying emojis: pop in place, gentle arc, soft bounce
 if(rm)Q.slice(0,n).forEach((x,i)=>{const m=card(x.mid);if(!fxVis(m))return;const tr=m.querySelector('.mch').getBoundingClientRect(),s=document.createElement('span');s.className='fxfly';s.textContent=x.emo;s.style.transform=`translate(${tr.left+44+i*30}px,${tr.top+tr.height/2}px)`;document.body.appendChild(s);
   s.animate([{opacity:0},{opacity:1,offset:.25},{opacity:1,offset:.75},{opacity:0}],{duration:2000,fill:'forwards'}).onfinish=()=>s.remove()});
 if(!rm)Q.slice(0,n).forEach((x,i)=>{const m=card(x.mid),gw=document.querySelector('.gwrap');let tx,ty;
   if(toWheel&&gw){const r=gw.getBoundingClientRect();tx=r.left+r.width/2+(i%2?18:-18);ty=r.top+r.height*.45}else if(m){const tr=m.querySelector('.mch').getBoundingClientRect();tx=tr.left+44+i*14;ty=tr.top+tr.height/2}else return;
   const s=document.createElement('span');s.className='fxfly';s.textContent=x.emo;document.body.appendChild(s);
   const sx=innerWidth/2+(i-(n-1)/2)*34,sy=innerHeight*.72,mx=(sx+tx)/2+(i%2?50:-50),my=Math.min(sy,ty)-110,T=FX.pop+FX.fly+FX.land,o=v=>v/T;
   s.animate([{transform:`translate(${sx}px,${sy}px) scale(.3)`,opacity:0},{transform:`translate(${sx}px,${sy}px) scale(1.5)`,opacity:1,offset:o(FX.pop*.5)},{transform:`translate(${sx}px,${sy}px) scale(1.35)`,opacity:1,offset:o(FX.pop)},
    {transform:`translate(${mx}px,${my}px) scale(1.25)`,opacity:1,offset:o(FX.pop+FX.fly*.5),easing:'ease-in-out'},{transform:`translate(${tx}px,${ty}px) scale(1)`,opacity:1,offset:o(FX.pop+FX.fly)},
    {transform:`translate(${tx}px,${ty-12}px) scale(1.12)`,opacity:1,offset:o(FX.pop+FX.fly+FX.land*.45)},{transform:`translate(${tx}px,${ty}px) scale(.9)`,opacity:.9,offset:o(FX.pop+FX.fly+FX.land*.8)},{transform:`translate(${tx}px,${ty}px) scale(.8)`,opacity:0}],
    {duration:T,delay:i*FX.stag,easing:'ease-in-out',fill:'forwards'}).onfinish=()=>s.remove()});
 // whole meal moment, after landing
 if(meal)setTimeout(()=>mids.forEach(mi=>{const m=card(mi);if(!m)return;const h=m.querySelector('.mch'),ck=document.createElement('span');ck.className='fxck'+(rm?' rm':'');ck.textContent='✓';h.querySelector('.mct').appendChild(ck);setTimeout(()=>ck.remove(),2000);
  if(rm)return;h.classList.remove('fxwig');void h.offsetWidth;h.classList.add('fxwig');const hr=h.getBoundingClientRect(),cx=hr.left+60,cy=hr.top+hr.height/2,em=Q.filter(x=>x.mid===mi).map(x=>x.emo);
   for(let i=0;i<7;i++){const s=document.createElement('span');s.className='fxfly';s.textContent=em[i%em.length];document.body.appendChild(s);const a=i/7*6.28-1.57,R=55+i%3*12;
    s.animate([{transform:`translate(${cx}px,${cy}px) scale(.4)`,opacity:1},{transform:`translate(${cx+Math.cos(a)*R}px,${cy+Math.sin(a)*R}px) scale(1)`,opacity:0}],{duration:1500,easing:'ease-out',fill:'forwards'}).onfinish=()=>s.remove()}}),LAND+200)}
/* ---------- v45: Snap streak ---------- */
const snapDay=d=>Object.values(D.log[d]||{}).some(a=>(a||[]).some(e=>e.food&&e.food.src==='photo'));
const SNAP_MS=[[3,'📸','Shutterbug Chef'],[7,'🍳','Snap Sous-Chef'],[14,'🌟','Plate Paparazzo'],[30,'🏅','Meal Snap Master'],[60,'👑','Food Photo Royalty'],[100,'🏆','Legendary Lens Chef']];
const snapStreak=()=>({cur:dayStreak(snapDay),best:bestDay(snapDay,Object.keys(D.log))});
function snapReward(){const t=logicalToday();if(cur!==t||!snapDay(t))return;let st={};try{st=JSON.parse(localStorage.getItem('mhh-snaprw')||'{}')}catch(e){}
 const n=snapStreak().cur,ms=SNAP_MS.find(m=>m[0]===n),key=t+':'+(ms?ms[0]:'d');if(st[key])return;st={[key]:1,[t+':d']:1};localStorage.setItem('mhh-snaprw',JSON.stringify(st));
 const show=()=>{if(document.getElementById('gbadge')){return setTimeout(show,900)}const w=document.createElement('div');w.className='snaprw'+(fxRM()||!fxOn()?' rm':'');w.setAttribute('role','status');
  w.innerHTML=`<span class="srf">🔥</span><div><b>Day ${n} snap streak!</b><small>${ms?`${ms[1]} New badge: ${esc(ms[2])}`:'📸 +1 · keep snapping tomorrow'}</small></div><span class="srp">+1</span>`;document.body.appendChild(w);setTimeout(()=>w.classList.add('out'),3200);setTimeout(()=>w.remove(),3800)};show()}
function snapTab(){if(tab!=='activity')return;const g=document.querySelector('.skg');if(!g||g.querySelector('.sksnap'))return;const S=snapStreak(),t=logicalToday(),c=S.cur,nx=(SNAP_MS.find(m=>m[0]>c)||[c+100])[0];
 g.insertAdjacentHTML('beforeend',`<div class="skc sksnap${c?'':' zero'}" style="--c:#ec4899"><div class="skh"><span class="skic">📸</span><span class="skt">Snap streak</span>${snapDay(t)?'<span class="skfl">🔥</span>':''}</div><div class="skv"><b>${c}</b><span>${c===1?'day':'days'}</span></div><div class="skbar"><i style="width:${Math.min(100,c/nx*100)}%"></i></div><small>${c?`Best: ${S.best} · next badge at ${nx}`:'Snap a meal to start'}</small></div>`);
 g.insertAdjacentHTML('afterend',`<div class="card snapbd"><h2>📸 Snap badges</h2><div class="sbg">${SNAP_MS.map(([d,ic,nm])=>`<div class="sb${S.best>=d?' on':''}"><span>${S.best>=d?ic:'🔒'}</span><b>${esc(nm)}</b><small>${d} days</small></div>`).join('')}</div></div>`)}
/* ---------- v49: swipe left to remove a logged food ---------- */
function mlSwipe(V){V.querySelectorAll('.miw>.mi').forEach(r=>{let w0=300,x0=0,y0=0,dx=0,mode=0,base=0,id=null;const W=()=>w0,set=(v,an)=>{r.style.transition=an?'transform .3s ease':'none';r.style.transform=v?`translateX(${v}px)`:'';r.parentNode.classList.toggle('mswo',v<0)};
 r.addEventListener('pointerdown',e=>{if(e.button>0||e.target.closest('[data-rm]'))return;x0=e.clientX;y0=e.clientY;w0=r.parentNode.getBoundingClientRect().width||300;dx=0;mode=0;id=e.pointerId;base=r.parentNode.classList.contains('mswo')?-96:0;r._sw=0});
 r.addEventListener('pointermove',e=>{if(e.pointerId!==id)return;const ax=e.clientX-x0,ay=e.clientY-y0;if(!mode){if(Math.abs(ax)>10&&Math.abs(ax)>Math.abs(ay)*1.3){mode=1;try{r.setPointerCapture(id)}catch(_){}V.querySelectorAll('.miw.mswo>.mi').forEach(o=>{if(o!==r){o.style.transition='transform .3s ease';o.style.transform='';o.parentNode.classList.remove('mswo')}})}else if(Math.abs(ay)>10){id=null;return}}
  if(mode===1){dx=Math.min(0,base+ax);set(dx)}});
 const end=e=>{if(e.pointerId!==id)return;id=null;if(mode!==1){return}r._sw=1;setTimeout(()=>r._sw=0,350);const[m,eid]=r.dataset.edit.split('|');
  if(dx<-W()*.55){set(-W(),1);setTimeout(()=>removeEntry(m,eid),280)}else if(dx<-50)set(-96,1);else set(0,1)};
 r.addEventListener('pointerup',end);r.addEventListener('pointercancel',e=>{if(e.pointerId===id){id=null;if(mode===1)set(0,1)}})})}
