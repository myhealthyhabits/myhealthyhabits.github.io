/* Prepared dishes: search order, Restaurant/Homemade toggle, portion notes, and "Estimate with AI" backup.
   Data: dishlib.js (USDA FNDDS). Restaurant toggle uses the FNDDS restaurant version when one exists (d.R);
   otherwise it is an ESTIMATE: restaurant small/regular/large portions are 1.5x the USDA typical home amount and
   calories are +15% (the extra as fat, i.e. added oil/butter). Cups, grams, oz and pieces stay exact. */
const REST_PORTION=1.5,REST_RICH=0.15;
function dishFirst(L){const d=L.filter(f=>f&&f.dish).slice(0,6),ds=new Set(d);return[...d,...L.filter(f=>!ds.has(f))]}
const dishBase=f=>f.dv==='r'?(DISHLIB.find(x=>x.ref===f.bref)||f):f;
function dishVar(b,rest){if(!rest)return b;if(b.rest)return b;
 const real=!!b.R,n0=b.n,n=real?{...b.R.n}:{...n0,kcal:n0.kcal*(1+REST_RICH),f:(n0.f||0)+n0.kcal*REST_RICH/9};
 const units=b.units.map(u=>/^(small|regular|large)$/.test(u.label)?{...u,mult:+(u.mult*REST_PORTION).toFixed(3),note:Math.round(u.mult*REST_PORTION*100)+' g'}:u);
 const v={...b,ref:b.ref+':r',bref:b.ref,dv:'r',name:b.name.replace(/, home recipe$/i,'')+' (restaurant)',n,units};delete v.R;if(!real)v.est=1;else v.usda=b.R.usda;return v}
function dishBar(f){if(!f.dish)return'';const b=dishBase(f),r=f.dv==='r';
 const src=b.rest?'USDA restaurant data':r?(f.est?'Estimate: restaurant portions ~1.5× and richer (+15% cal)':'USDA restaurant data · bigger restaurant portion'):'USDA average';
 return`<div class="dishbar"><span class="stchip dish">🍽️ Dish</span>${b.rest?'':`<div class="seg dseg" id="d_rh"><button data-r="0" class="${r?'':'on'}">🏠 Homemade</button><button data-r="1" class="${r?'on':''}">🍴 Restaurant</button></div>`}
 <div class="mut dsrc">${src}${f.usda||b.usda?` · <i>${esc(f.usda||b.usda)}</i>`:''} <a href="https://fdc.nal.usda.gov/food-details/${(r&&b.R?b.R.fdc:b.fdc)}/nutrients" target="_blank" rel="noopener">USDA ›</a></div></div>`}
function dishBind(f,ui,qty,mid,onSave,onDel,ctx){if(!f.dish&&f.src!=='ai')return;
 const L=unitsFor(f),note=l=>{l=l||$('#v_u .uchip.on')?.dataset.l;const u=L.find(x=>x.label===l);const el=$('#v_note');if(el&&u)el.textContent=u.kind==='w'?'':'1 '+u.label+' = '+(u.note||Math.round(u.mult*100)+' g')+(f.szest&&/^(small|large)$/.test(u.label)?' (size estimate)':'')};
 $('#v_u').addEventListener('click',e=>{const c=e.target.closest('.uchip');if(c)note(c.dataset.l)});note();
 const s=$('#d_rh');if(s)s.onclick=e=>{const bt=e.target.closest('[data-r]');if(!bt)return;const b=dishBase(f),nf=dishVar(b,bt.dataset.r==='1');if(nf===f)return;
  const curL=$('#v_u .uchip.on')?.dataset.l,nL=unitsFor(nf),i=Math.max(0,nL.findIndex(u=>u.label===curL));close();servingSheet(nf,i,parseAmt($('#v_q')?.value)||qty,mid,onSave,onDel,ctx)}}
/* AI backup */
function aiRow(q,all,bottom){const hasDish=all.slice(0,6).some(f=>f.dish&&qWords(q).every(w=>wHit(w,ftoks(f),0)>=2));
 if(bottom?!hasDish:hasDish)return'';return`<button class="aiest${bottom?' sm':''}" data-ai="1"><span>✨</span><div><b>Estimate “${esc(q.length>40?q.slice(0,39)+'…':q)}” with AI</b><small>${bottom?'Not quite right? Describe it, e.g. “yellow curry with chicken from a Thai restaurant”':'No close dish match · uses 1 of your daily AI estimates'}</small></div></button>`}
function aiBind(q,mid){document.querySelectorAll('#s_res [data-ai]').forEach(b=>b.onclick=()=>dishAI(q,mid))}
async function dishAI(q,mid){sheet(`<h2>✨ Estimate with AI</h2><label>Describe what you ate</label><textarea id="ai_t" rows="3" maxlength="300">${esc(q)}</textarea>
 <p class="mut" style="font-size:13px">Add details for a better guess, like where it was from and the size. Uses 1 of your daily AI estimates (shared with Snap meal).</p><button class="btn" id="ai_go">✨ Estimate</button><button class="btn alt" id="ai_back">Back</button>`);
 $('#ai_back').onclick=()=>{openAdd(mid);$('#s_q').value=q;search(q,mid)};
 $('#ai_go').onclick=async()=>{const t=$('#ai_t').value.trim();if(!t)return toast('Describe the food first');$('#ai_go').disabled=true;$('#ai_go').textContent='Estimating…';
  let r,j={};try{[r,j]=await msCall({mode:'dish',text:t})}catch(e){$('#ai_go').disabled=false;$('#ai_go').textContent='✨ Estimate';return toast('No connection. Try again when you’re online.')}
  if(r.status===429){$('#ai_go').disabled=false;$('#ai_go').textContent='✨ Estimate';return toast(j.error==='user_limit'?`You’ve used all ${j.cap||10} AI estimates for today. They reset at midnight.`:'AI is extra busy today. Try again tomorrow.')}
  const it=(j.items||[])[0];if(!r.ok||!it||!(+it.grams>0)||!(+it.kcal>0)){$('#ai_go').disabled=false;$('#ai_go').textContent='✨ Estimate';return toast(r.ok?'Couldn’t estimate that. Try describing it differently.':'AI estimate isn’t available right now.')}
  const g=+it.grams,per=k=>Math.round((+it[k]||0)*1000/g)/10;
  const f={src:'ai',ref:'ai:'+uid(),name:msCap(it.name||t).slice(0,60),ai:1,n:{kcal:per('kcal'),p:per('protein_g'),c:per('carbs_g'),f:per('fat_g'),fb:per('fiber_g')},
   units:[{label:'serving',mult:g/100,kind:'s',note:Math.round(g)+' g'+(it.amount&&it.unit?' · about '+msFmt(+it.amount)+' '+it.unit:'')},...(/cup/i.test(it.unit||'')&&+it.amount>0?[{label:'cup',mult:g/+it.amount/100,kind:'n',note:Math.round(g/+it.amount)+' g'}]:[])]};
  servingSheet(f,0,1,mid,(e,m)=>{addEntry(m,e);render();toast('Added '+f.name)});
  const h=$('#sheetBody h2');if(h)h.insertAdjacentHTML('afterend','<div class="dishbar"><span class="stchip dish">✨ AI estimate</span><div class="mut dsrc">A best guess. Tap ✏️ Edit to fix the numbers, or change the amount below.</div></div>')}}
