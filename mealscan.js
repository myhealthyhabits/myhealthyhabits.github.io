/* Snap meal: photo -> foods via the meal-scan Edge Function (Gemini). Nutrition from FOODLIB (USDA, per 100 g) when matched, else AI estimate. Photos are not stored. */
const MS_URL='https://mbmeftdocjazdrgpeftu.supabase.co/functions/v1/meal-scan',MS_AK='sb_publishable__FA1ABf79m6khS0isPDlmQ_2fXh9CKN';
function msAutoMeal(){const mm=mainMeals().slice(0,D.mealCount||3),n=mm.length,h=new Date().getHours();if(!n)return's';
 const cut={1:[],2:[14],3:[11,16],4:[10,13,17]}[n]||[];let i=cut.filter(c=>h>=c).length;if(h<4)i=n-1;return mm[Math.min(i,n-1)].id}
function mealScan(mid,pick){if(pick!==undefined)window.msPick=!!pick;stopScan();sheet(`<h2>📷 Snap meal</h2><div class="ms-hero">🍗🍚🥦</div>
 <p class="mut" style="margin-top:0">Snap your plate from above in good light. The AI guesses each food and portion, then you fix anything before logging. Numbers are <b>estimates</b>. Your photo isn't saved.</p>
 <input type="file" id="ms_cam" accept="image/*" capture="environment" hidden><input type="file" id="ms_up" accept="image/*" hidden>
 <button class="btn" id="ms_take">📸 Take photo</button><button class="btn alt" id="ms_pick">🖼️ Upload a photo</button><button class="btn alt" id="ms_back">Back</button>`);
 $('#ms_take').onclick=()=>$('#ms_cam').click();$('#ms_pick').onclick=()=>$('#ms_up').click();$('#ms_back').onclick=()=>window.msPick?close():openAdd(mid);
 const go=e=>{const f=e.target.files&&e.target.files[0];if(f)msRun(mid,f)};$('#ms_cam').onchange=go;$('#ms_up').onchange=go}
function msShrink(file,max=1024,q=.8){return new Promise((ok,no)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);ok(c.toDataURL('image/jpeg',q))};im.onerror=()=>{URL.revokeObjectURL(u);no(new Error('img'))};im.src=u})}
async function msCall(body){let tok='';try{tok=(JSON.parse(localStorage.getItem('mhh-sb')||'null')||{}).at||''}catch(e){}
 const r=await fetch(window.MS_MOCK||MS_URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:MS_AK,Authorization:'Bearer '+(tok||MS_AK)},body:JSON.stringify(body)});return[r,await r.json().catch(()=>({}))]}
function msErr(mid,emo,title,msg){sheet(`<h2>${title}</h2><div class="ms-hero">${emo}</div><p class="mut" style="text-align:center">${msg}</p><button class="btn" id="ms_again">Try another photo</button><button class="btn alt" id="ms_srch">Search foods instead</button>`);$('#ms_again').onclick=()=>mealScan(mid);$('#ms_srch').onclick=()=>openAdd(mid)}
async function msRun(mid,file){sheet(`<h2>📷 Snap meal</h2><div class="ms-hero">🔎</div><p class="mut" style="text-align:center">Looking at your meal… this takes a few seconds.</p>`);
 let img;window.msThumb=null;try{img=await msShrink(file);if(!D.noThumbs)window.msThumb=await msShrink(file,200,.7).catch(()=>null)}catch(e){return msErr(mid,'🖼️','Couldn’t open that photo','Try a different photo (JPG or PNG).')}
 let r,j={};try{[r,j]=await msCall({image:img})}
 catch(e){return msErr(mid,'📶','No connection','Meal scan needs internet. Check your signal and try again, or search foods instead.')}
 if(r.status===429)return msErr(mid,'⏳','Daily limit reached',j.error==='user_limit'?`You've used all ${j.cap||10} meal scans for today. They reset at midnight (Pacific). You can still search or quick-add foods.`:'Meal scan is extra busy today and hit its daily limit. Please try again tomorrow, or search foods instead.');
 if(!r.ok)return msErr(mid,'🛠️','Meal scan isn’t available',r.status===503?'Meal scan is still being set up. Check back soon!':'Something went wrong on our side. Please try again in a moment.');
 const items=(j.items||[]).filter(x=>x&&x.name&&+x.grams>0);
 if(!items.length)return msErr(mid,'🤔','Couldn’t recognize food','We couldn’t spot any food in that photo. Try a closer, brighter shot from above.');
 msReview(mid,items.map(msItem))}
const msTk=t=>norm(t).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w&&!/^(and|with|the|of|a|on|in|fresh|plain|homemade|style|nfs)$/.test(w)).map(stem);
const MS_MOD0=['grill','steam','bake','fry','fri','roast','boil','cook','larg','small','medium','slice','side','regular','mini','hot','warm','cold','homemad','restaurant','fast','food','order','piece','bowl','plate','serving','sauce','syrup','topping','dress'];let _msm;const msMod=()=>_msm||(_msm=MS_MOD0.map(stem));
function msMatch(name){const ws=msTk(name);if(!ws.length||typeof FOODLIB==='undefined')return null;let best=null,bs=0;
 for(const f of FOODLIB){const nm=msTk(f.name),core=msTk(f.name.split(',')[0]).filter(w=>!/^\d/.test(w));
  for(const c of [core,...(f.syn||[]).map(msTk)]){if(!c.length||!c.every(w=>ws.includes(w)))continue;if(c!==core&&ws.some(w=>!c.includes(w)&&!nm.includes(w)&&!msMod().includes(w)))continue;
   const sc=c.length*3+nm.filter(w=>ws.includes(w)).length+(c===core?1:0)-nm.filter(w=>!ws.includes(w)).length*.2;if(sc>bs){bs=sc;best=f}}}
 return best}
const msCap=t=>{t=String(t||'').trim();return t?t[0].toUpperCase()+t.slice(1):t};
function msUnits(it){const U=[],add=(l,g)=>{if(g>0&&!U.some(u=>u.l===l))U.push({l,g})},au=String(it.unit||'').toLowerCase().replace(/s$/,'');
 if(!/^(g|gram|grams|oz|ounce)$/.test(au)&&it.amt>0)add(au||'serving',it.g0/it.amt);
 if(it.lib)(it.lib.units||[]).forEach(u=>add(u.label,u.mult*100));add('g',1);add('oz',28.35);return U}
function msItem(x){const g=Math.max(1,+x.grams),lib=msMatch(x.name),per=k=>(+x[k]||0)*100/g;
 const it={name:msCap(x.name),amt:+x.amount||1,unit:x.unit||'serving',g0:g,g,conf:+x.confidence||0,lib,ai:{kcal:per('kcal'),p:per('protein_g'),c:per('carbs_g'),f:per('fat_g'),fb:per('fiber_g')}};it.u=0;return it}
const msN=it=>it.lib?it.lib.n:it.ai,msK=it=>msN(it).kcal*it.g/100;
const msFmt=v=>{v=Math.round(v*100)/100;const w=Math.floor(v),f=v-w,fr={.25:'¼',.5:'½',.75:'¾'}[Math.round(f*4)/4];return Math.abs(f*4-Math.round(f*4))<.02&&fr?(w?w:'')+fr:(Math.round(v*10)/10).toString()};
function msPortion(it){const U=msUnits(it),u=U[Math.min(it.u,U.length-1)],a=it.g/u.g;return(u.l==='g'?Math.round(a)+' g':msFmt(a)+' '+u.l+(u.l==='oz'?'':' · '+Math.round(it.g)+' g'))}
function msReview(mid,items,o={}){const pick=!!window.msPick,mn=()=>(D.meals.find(m=>m.id===mid)||{}).name||'meal';let open=-1,menu=-1,sw=-1,swq='',swR=[],swBusy=0,swT;
 const tot=()=>items.reduce((t,it)=>{const n=msN(it),m=it.g/100;t.k+=n.kcal*m;t.p+=n.p*m;t.c+=n.c*m;t.f+=n.f*m;t.fb+=(n.fb||0)*m;return t},{k:0,p:0,c:0,f:0,fb:0});
 const totH=()=>{const t=tot();return`<div class="ms-tl"><small>Estimated total</small><b>${fE(t.k)}</b></div><div class="ms-ch"><span class="cp">P ${r0(t.p)}g</span><span class="cc">C ${r0(t.c)}g</span><span class="cf">F ${r0(t.f)}g</span><span class="cb">Fiber ${r0(t.fb)}g</span></div>`};
 const live=i=>{const it=items[i],row=$('#ms_r'+i);if(row){row.querySelector('.ms-kc').textContent=fE(msK(it));row.querySelector('.ms-pt').textContent=msPortion(it)}$('#ms_tot').innerHTML=totH()};
 const ed=(it,i)=>{const U=msUnits(it),u=U[Math.min(it.u,U.length-1)],a=it.g/u.g,base=it.g0;return`<div class="ms-ed">
  <div class="ms-qs">${[[.5,'½×'],[.75,'¾×'],[1,'1×'],[1.25,'1¼×'],[1.5,'1½×'],[2,'2×']].map(([m,l])=>`<button data-q="${m}" class="${Math.abs(it.g-base*m)<.5?'on':''}">${l}</button>`).join('')}</div>
  <div class="ms-st"><button data-s="-1" aria-label="Less">−</button><input id="ms_am" type="number" inputmode="decimal" min="0" step="any" value="${u.l==='g'?Math.round(a):Math.round(a*100)/100}"><button data-s="1" aria-label="More">+</button></div>
  <div class="ms-us">${U.map((x,j)=>`<button data-u="${j}" class="${j===it.u?'on':''}">${esc(x.l)}</button>`).join('')}</div>
  <button class="ms-done" data-d="1">Done</button></div>`};
 const swH=(it,i)=>`<div class="ms-sw"><label class="ms-swl">Change food</label><input id="ms_swq" type="search" enterkeyhint="search" placeholder="Type a food, e.g. cucumber" value="${esc(swq)}"><div class="ms-sr" id="ms_sr">${swList(it)}</div><button class="ms-done" data-swx="1">Cancel</button></div>`;
 const swList=it=>{const q=swq.trim();let h=swR.map((f,j)=>`<button data-j="${j}"><span>${emoOf(f)}</span><b>${esc(f.name)}</b><small>${f.src==='usda'?'USDA':'Library'} · ${r0(f.n.kcal)} cal/100 g</small></button>`).join('');
  if(swBusy)h+='<small class="mut">Searching more foods…</small>';
  if(q){h+=`<button data-use="1" class="ms-use">✏️ Use “${esc(q)}”<small>${swR.length?'Name as typed, nutrition by AI estimate':'No match found · nutrition by AI estimate'}</small></button>`;if(q!==(it.lib?it.lib.name:it.name))h+=`<button data-ren="1" class="ms-use">🏷️ Just rename to “${esc(q)}”<small>Keep the current nutrition</small></button>`}
  if(it.lib)h+=`<button data-j="ai"><span>🤖</span><b>Use AI estimate for “${esc(it.name)}”</b></button>`;return h};
 const swPaint=()=>{const it=items[sw],b=$('#ms_sr');if(it&&b)b.innerHTML=swList(it)};
 const swFind=()=>{const ws=qWords(swq),seen=new Set();swR=ws.length?FOODLIB.filter(f=>fMatch(f,ws)).slice(0,5):[];swR.forEach(f=>seen.add(f.name.toLowerCase()));clearTimeout(swT);swBusy=0;
  if(ws.length&&typeof usdaQ==='function'){swBusy=1;const q0=swq;swT=setTimeout(async()=>{let L=[];try{L=await usdaQ(q0,'Foundation,SR Legacy')}catch(e){}if(q0!==swq)return;swBusy=0;
   const hits=f=>ws.filter(w=>norm(f.name).includes(w)).length;L.sort((a,b)=>hits(b)-hits(a)||a.name.length-b.name.length).forEach(f=>{const k=f.name.toLowerCase();if(!seen.has(k)&&swR.length<10){seen.add(k);swR.push(f)}});swPaint()},350)}
  swPaint()};
 const swOpen=i=>{sw=i;menu=-1;open=-1;swq=items[i].lib?items[i].lib.name:items[i].name;swq=swq.split(',')[0];swR=[];draw();const q=$('#ms_swq');q.focus();q.select();swFind()};
 const swUse=async it=>{const q=msCap(swq.trim());const b=$('#ms_sr');if(b)b.innerHTML='<small class="mut">Estimating nutrition for “'+esc(q)+'”…</small>';
  let n=null;try{const[r,j]=await msCall({text:q,grams:Math.round(it.g)});const x=r.ok&&(j.items||[])[0];if(x&&+x.grams>0){const g=+x.grams,per=k=>(+x[k]||0)*100/g;n={kcal:per('kcal'),p:per('protein_g'),c:per('carbs_g'),f:per('fat_g'),fb:per('fiber_g')}}else if(r.status===429)toast('Daily AI limit reached · used the closest match')}catch(e){}
  if(!n){const near=swR[0]||msMatch(q);if(near)n={...near.n};else{toast('Couldn’t estimate that · kept the current numbers');n={...msN(it)}}}
  it.name=q;it.lib=null;it.ai=n;it.conf=0;it.u=msUnits(it).findIndex(u=>u.l==='g');sw=-1;draw()};
 const draw=()=>{const sc=$('#sheetBody').scrollTop;
  sheet(`<div class="ms-head"><h2>${o.title||"📷 Here's what we see"}</h2><div id="ms_tot" class="ms-tot">${totH()}</div></div>
  <p class="ms-hint">Tap a food to fix its portion.</p>
  <div class="ms-list">${items.map((it,i)=>`<div class="ms-it${open===i?' open':''}" id="ms_r${i}"><div class="ms-row" data-o="${i}"><span class="ms-emo">${emoOf({name:it.lib?it.lib.name:it.name})}</span>
   <div class="ms-nm"><b data-n="${i}">${esc(it.lib?it.lib.name:it.name)}</b><span class="ms-pt">${esc(msPortion(it))}</span><span>${it.lib?'<i class="ms-tag lib">USDA</i>':'<i class="ms-tag ai">AI estimate</i>'}${it.conf&&it.conf<.5?'<i class="ms-tag lo">unsure</i>':''}</span></div>
   <b class="ms-kc">${fE(msK(it))}</b><button class="ms-more" data-m="${i}" aria-label="More options">⋯</button></div>
   ${menu===i?`<div class="ms-menu"><button data-a="s" data-i="${i}">🔄 Swap food</button><button data-a="x" data-i="${i}">🗑️ Remove</button></div>`:''}
   ${open===i?ed(it,i):''}${sw===i?swH(it,i):''}</div>`).join('')||'<p class="mut">No items left.</p>'}</div>
  <div class="ms-foot">${pick?`<div class="ms-mp"><small>Log to</small>${visMeals().map(m=>`<button data-mp="${m.id}" class="${m.id===mid?'on':''}">${esc(m.name)}</button>`).join('')}</div>`:''}<button class="btn" id="ms_log" ${items.length?'':'disabled'}>Log ${items.length} item${items.length===1?'':'s'} to ${esc(mn())}</button><button class="ms-re" id="ms_re">${o.backL||'📷 Retake photo'}</button></div>`);
  $('#sheetBody').scrollTop=sc;
  const L=$('.ms-list');L.onclick=e=>{const t=e.target;
   if(t.closest('.ms-sw')){const it=items[sw];const j=t.closest('[data-j]');if(j){it.lib=j.dataset.j==='ai'?null:swR[+j.dataset.j];if(it.lib&&it.lib.src==='usda')it.lib={...it.lib,name:it.lib.name.split(',').slice(0,2).join(',')};it.conf=0;it.u=msUnits(it).findIndex(u=>u.l==='g');sw=-1;return draw()}
    if(t.closest('[data-use]'))return swUse(it);if(t.closest('[data-ren]')){const q=msCap(swq.trim());if(it.lib){it.ai={...it.lib.n};it.lib=null}it.name=q;sw=-1;return draw()}
    if(t.closest('[data-swx]')){sw=-1;return draw()}return}
   const nb=t.closest('[data-n]');if(nb&&!t.closest('[data-m]')){return swOpen(+nb.dataset.n)}
   const m=t.closest('[data-m]');if(m){const i=+m.dataset.m;menu=menu===i?-1:i;return draw()}
   const a=t.closest('[data-a]');if(a){const i=+a.dataset.i,it=items[i];menu=-1;
    if(a.dataset.a==='x'){items.splice(i,1);open=-1;return draw()}
    return swOpen(i)}
   const it=items[open];
   const q=t.closest('[data-q]');if(q){it.g=it.g0*+q.dataset.q;return draw()}
   const st=t.closest('[data-s]');if(st){const U=msUnits(it),u=U[Math.min(it.u,U.length-1)],step=u.l==='g'?10:u.l==='oz'?.5:.25,a=it.g/u.g;it.g=Math.max(u.g*step,(Math.round(a/step)+ +st.dataset.s)*step*u.g);return draw()}
   const uu=t.closest('[data-u]');if(uu){it.u=+uu.dataset.u;return draw()}
   if(t.closest('[data-d]')){open=-1;return draw()}
   const o=t.closest('[data-o]');if(o){const i=+o.dataset.o;open=open===i?-1:i;menu=-1;draw()}};
  const am=$('#ms_am');if(am)am.oninput=()=>{const it=items[open],U=msUnits(it),u=U[Math.min(it.u,U.length-1)],v=parseFloat(am.value);if(v>0){it.g=v*u.g;live(open);document.querySelectorAll('.ms-qs button').forEach(b=>b.classList.toggle('on',Math.abs(it.g-it.g0*+b.dataset.q)<.5))}};
  const sq=$('#ms_swq');if(sq){sq.oninput=()=>{swq=sq.value;swFind()};sq.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(swR[0]&&qWords(swq).length)sq.blur();else if(swq.trim())swUse(items[sw])}}}
  $('#ms_re').onclick=()=>o.back?o.back(mid):mealScan(mid);
  document.querySelectorAll('[data-mp]').forEach(b=>b.onclick=()=>{mid=b.dataset.mp;draw()});
  $('#ms_log').onclick=()=>{window._fxMeal=items.length>1;window._fxSnap=!o.src;const ph=!o.src&&window.msThumb&&!D.noThumbs?uid():null;if(ph&&window.phPut)phPut(ph,window.msThumb);items.forEach(it=>{const food={src:o.src||'photo',ref:uid(),name:it.lib?it.lib.name:it.name,brand:it.lib?'':'AI estimate',n:{...msN(it)},units:[{label:'g',mult:.01}]};const e=entryFrom(food,0,r0(it.g));e.est=1;if(ph)e.ph=ph;addEntry(mid,e)});
   close();render();toast(`Logged ${items.length} item${items.length===1?'':'s'} to ${mn()} · estimate`)}};
 draw()}
