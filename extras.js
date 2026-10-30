/* v44 extras: recent meals re-log, on-device meal photo thumbnails, daily goal celebrations */
/* ---------- Recent meals ---------- */
function rmList(excl){const out=new Map(),today=logicalToday();
 Object.keys(D.log).sort().reverse().slice(0,60).forEach(d=>{const L=D.log[d]||{};Object.entries(L).forEach(([m,es])=>{if(!es||es.length<2)return;if(d===today&&m===excl)return;
  const k=es.map(e=>fkey(e.food)+'×'+r1(e.qty)+'·'+(e.ui||0)).sort().join('|');const o=out.get(k);if(o){o.n++;return}out.set(k,{k,n:1,d,m,es})})});
 return[...out.values()].sort((a,b)=>(b.n>1)-(a.n>1)||b.n-a.n||(b.d>a.d?1:-1)).slice(0,6)}
function rmHtml(mid,title){const L=rmList(mid);window._rm=L;if(!L.length)return'';
 return`<div class="rmw"><div class="rmt">🔁 ${esc(title||'Recent meals · one tap to re-log')}</div><div class="rml">${L.map((r,i)=>{const s=sumEntries(r.es),nm=r.es.map(e=>e.food.name.split(',')[0]);
  return`<div class="rmc"><div class="rme">${[...new Set(r.es.map(e=>emoOf(e.food)))].slice(0,3).join('')}</div><div class="rmn"><b>${esc(nm.slice(0,2).join(' + '))}${nm.length>2?` <small>+${nm.length-2}</small>`:''}</b><small>${fE(s.kcal)} · ${r.n>1?r.n+'× logged':'last '+esc(nice(r.d))}</small></div><button class="rmp" data-rm="${i}" aria-label="Re-log this meal">+</button></div>`}).join('')}</div></div>`}
function rmBind(getMid,done){document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const r=(window._rm||[])[+b.dataset.rm];if(!r)return;const mid=getMid(),ids=[];
 r.es.forEach(e=>{const x={...e,id:uid()};delete x.ph;ids.push(x.id);addEntry(mid,x)});save();done&&done();const mn=(D.meals.find(m=>m.id===mid)||{}).name;
 toastU(`Re-logged ${r.es.length} items to ${mn} · ${fE(sumEntries(r.es).kcal)}`,()=>{const a=dayLog(cur)[mid]||[];dayLog(cur)[mid]=a.filter(x=>!ids.includes(x.id))})})}
/* ---------- Meal photo thumbnails (IndexedDB, this device only) ---------- */
const PHDB=()=>new Promise((ok,no)=>{const r=indexedDB.open('mhh-photos',1);r.onupgradeneeded=()=>r.result.createObjectStore('p',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
async function phPut(id,img){if(D.noThumbs||!window.indexedDB)return;try{const db=await PHDB();db.transaction('p','readwrite').objectStore('p').put({id,img,t:Date.now()})}catch(e){}}
async function phGet(id){try{const db=await PHDB();return await new Promise(ok=>{const q=db.transaction('p').objectStore('p').get(id);q.onsuccess=()=>ok(q.result&&q.result.img);q.onerror=()=>ok(null)})}catch(e){return null}}
async function phClear(maxAge){try{const db=await PHDB(),st=db.transaction('p','readwrite').objectStore('p'),c=st.openCursor(),lim=Date.now()-(maxAge||0);c.onsuccess=()=>{const k=c.result;if(!k)return;if(!maxAge||k.value.t<lim)k.delete();k.continue()}}catch(e){}}
setTimeout(()=>phClear(60*864e5),3000);
async function phFill(){for(const b of document.querySelectorAll('.mph[data-ph]:not(.ok)')){b.classList.add('ok');let img=null;for(const id of b.dataset.ph.split(' ')){img=await phGet(id);if(img)break}
 if(!img){b.remove();continue}b.style.backgroundImage=`url(${img})`;b.onclick=ev=>{ev.stopPropagation();sheet(`<h2>📷 Meal photo</h2><img src="${img}" class="phbig" alt="Meal photo"><p class="mut" style="font-size:13px">Saved only on this device. Turn off in Settings → Meals.</p><button class="btn alt" onclick="close()">Close</button>`)}}}
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
function afterRender(){phFill();setTimeout(goalCheck,250)}
