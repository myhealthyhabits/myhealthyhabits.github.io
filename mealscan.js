/* Snap meal: photo -> foods via the meal-scan Edge Function (Gemini). Nutrition from FOODLIB (USDA, per 100 g) when matched, else AI estimate. Photos are not stored. */
const MS_URL='https://mbmeftdocjazdrgpeftu.supabase.co/functions/v1/meal-scan',MS_AK='sb_publishable__FA1ABf79m6khS0isPDlmQ_2fXh9CKN';
function mealScan(mid){stopScan();sheet(`<h2>📷 Snap meal</h2><div class="ms-hero">🍗🍚🥦</div>
 <p class="mut" style="margin-top:0">Snap your plate from above in good light. The AI guesses each food and portion, then you fix anything before logging. Numbers are <b>estimates</b>. Your photo isn't saved.</p>
 <input type="file" id="ms_cam" accept="image/*" capture="environment" hidden><input type="file" id="ms_up" accept="image/*" hidden>
 <button class="btn" id="ms_take">📸 Take photo</button><button class="btn alt" id="ms_pick">🖼️ Upload a photo</button><button class="btn alt" id="ms_back">Back</button>`);
 $('#ms_take').onclick=()=>$('#ms_cam').click();$('#ms_pick').onclick=()=>$('#ms_up').click();$('#ms_back').onclick=()=>openAdd(mid);
 const go=e=>{const f=e.target.files&&e.target.files[0];if(f)msRun(mid,f)};$('#ms_cam').onchange=go;$('#ms_up').onchange=go}
function msShrink(file,max=1024){return new Promise((ok,no)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);ok(c.toDataURL('image/jpeg',.8))};im.onerror=()=>{URL.revokeObjectURL(u);no(new Error('img'))};im.src=u})}
function msErr(mid,emo,title,msg){sheet(`<h2>${title}</h2><div class="ms-hero">${emo}</div><p class="mut" style="text-align:center">${msg}</p><button class="btn" id="ms_again">Try another photo</button><button class="btn alt" id="ms_srch">Search foods instead</button>`);$('#ms_again').onclick=()=>mealScan(mid);$('#ms_srch').onclick=()=>openAdd(mid)}
async function msRun(mid,file){sheet(`<h2>📷 Snap meal</h2><div class="ms-hero">🔎</div><p class="mut" style="text-align:center">Looking at your meal… this takes a few seconds.</p>`);
 let img;try{img=await msShrink(file)}catch(e){return msErr(mid,'🖼️','Couldn’t open that photo','Try a different photo (JPG or PNG).')}
 let r,j={};try{let tok='';try{tok=(JSON.parse(localStorage.getItem('mhh-sb')||'null')||{}).at||''}catch(e){}
  r=await fetch(window.MS_MOCK||MS_URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:MS_AK,Authorization:'Bearer '+(tok||MS_AK)},body:JSON.stringify({image:img})});j=await r.json().catch(()=>({}))}
 catch(e){return msErr(mid,'📶','No connection','Meal scan needs internet. Check your signal and try again, or search foods instead.')}
 if(r.status===429)return msErr(mid,'⏳','Daily limit reached',j.error==='user_limit'?`You've used all ${j.cap||10} meal scans for today. They reset at midnight (Pacific). You can still search or quick-add foods.`:'Meal scan is extra busy today and hit its daily limit. Please try again tomorrow, or search foods instead.');
 if(!r.ok)return msErr(mid,'🛠️','Meal scan isn’t available',r.status===503?'Meal scan is still being set up. Check back soon!':'Something went wrong on our side. Please try again in a moment.');
 const items=(j.items||[]).filter(x=>x&&x.name&&+x.grams>0);
 if(!items.length)return msErr(mid,'🤔','Couldn’t recognize food','We couldn’t spot any food in that photo. Try a closer, brighter shot from above.');
 msReview(mid,items.map(msItem))}
function msMatch(name){const ws=qWords(name),has=w=>ws.some(x=>x===w||x===w+'s'||w===x+'s'||x===w+'es');if(!ws.length||typeof FOODLIB==='undefined')return null;let best=null,bs=0;
 for(const f of FOODLIB){const core=qWords(f.name.split(',')[0]).filter(w=>!/^\d/.test(w)),rest=qWords(f.name.split(',').slice(1).join(' '));if(!core.length||!core.every(has))continue;const s=core.length*2+rest.filter(has).length;if(s>bs){bs=s;best=f}}
 return best}
function msItem(x){const g=Math.max(1,+x.grams),lib=msMatch(x.name),per=k=>(+x[k]||0)*100/g;
 return{name:x.name,amt:+x.amount||1,unit:x.unit||'serving',g0:g,k:1,conf:+x.confidence||0,lib,ai:{kcal:per('kcal'),p:per('protein_g'),c:per('carbs_g'),f:per('fat_g'),fb:per('fiber_g')}}}
const msN=it=>it.lib?it.lib.n:it.ai,msG=it=>it.g0*it.k,msK=it=>msN(it).kcal*msG(it)/100;
function msReview(mid,items){const meal=(D.meals.find(m=>m.id===mid)||{}).name||'meal';
 const draw=()=>{const tot=items.reduce((t,it)=>{const n=msN(it),m=msG(it)/100;t.k+=n.kcal*m;t.p+=n.p*m;t.c+=n.c*m;t.f+=n.f*m;t.fb+=(n.fb||0)*m;return t},{k:0,p:0,c:0,f:0,fb:0});
  sheet(`<h2>📷 Here's what we see</h2><p class="mut" style="margin-top:0">Tap + / − to fix portions, 🔄 to swap a food, ✕ to remove.</p>
  <div class="ms-list">${items.map((it,i)=>`<div class="ms-it"><div class="ms-top"><span class="ms-emo">${emoOf({name:it.name})}</span><div class="ms-nm"><b>${esc(it.lib?it.lib.name:it.name)}</b><small>${r1(it.amt*it.k)} ${esc(it.unit)} · ~${r0(msG(it))} g ${it.lib?'<span class="ms-tag lib">USDA</span>':'<span class="ms-tag ai">AI estimate</span>'}${it.conf&&it.conf<.5?' <span class="ms-tag lo">unsure</span>':''}</small></div><b class="ms-kc">${fE(msK(it))}</b></div>
   <div class="ms-ctl"><button data-a="-" data-i="${i}" aria-label="Less">−</button><button data-a="+" data-i="${i}" aria-label="More">+</button><button data-a="s" data-i="${i}">🔄 Swap</button><button data-a="x" data-i="${i}" aria-label="Remove">✕</button></div><div class="ms-sw" id="ms_sw${i}"></div></div>`).join('')||'<p class="mut">No items left.</p>'}</div>
  <div class="ms-tot"><div><small>Estimated total</small><b>${fE(tot.k)}</b></div><span>P ${r0(tot.p)}g</span><span>C ${r0(tot.c)}g</span><span>F ${r0(tot.f)}g</span><span>Fiber ${r0(tot.fb)}g</span></div>
  <button class="btn" id="ms_log" ${items.length?'':'disabled'}>Log ${items.length} item${items.length===1?'':'s'} to ${esc(meal)}</button><button class="btn alt" id="ms_re">Retake photo</button>`);
  $('.ms-list').onclick=e=>{const b=e.target.closest('[data-a]');if(!b)return;const i=+b.dataset.i,it=items[i];
   if(b.dataset.a==='+'){it.k=Math.min(5,r1(it.k+.25));draw()}else if(b.dataset.a==='-'){it.k=Math.max(.25,r1(it.k-.25));draw()}else if(b.dataset.a==='x'){items.splice(i,1);draw()}
   else if(b.dataset.a==='s'){const w=$('#ms_sw'+i);w.innerHTML=`<input type="search" placeholder="Search to swap…" value="${esc(it.name)}"><div class="ms-sr"></div>`;const inp=w.querySelector('input'),sr=w.querySelector('.ms-sr');
    const find=()=>{const ws=qWords(inp.value);const res=ws.length?FOODLIB.filter(f=>fMatch(f,ws)).slice(0,6):[];sr.innerHTML=res.map((f,j)=>`<button data-j="${j}">${emoOf(f)} ${esc(f.name)}</button>`).join('')+(it.lib?`<button data-j="ai">🤖 Use AI estimate for “${esc(it.name)}”</button>`:'')||'<small class="mut">No match. Keep the AI estimate or try another word.</small>';sr.onclick=ev=>{const bb=ev.target.closest('[data-j]');if(!bb)return;it.lib=bb.dataset.j==='ai'?null:res[+bb.dataset.j];draw()}};
    inp.oninput=find;find();inp.focus()}};
  $('#ms_re').onclick=()=>mealScan(mid);
  $('#ms_log').onclick=()=>{items.forEach(it=>{const food={src:'photo',ref:uid(),name:it.lib?it.lib.name:it.name,brand:it.lib?'':'AI estimate',n:{...msN(it)},units:[{label:'g',mult:.01}]};const e=entryFrom(food,0,r0(msG(it)));e.est=1;addEntry(mid,e)});
   close();render();toast(`Logged ${items.length} item${items.length===1?'':'s'} to ${meal} · estimate`)}};
 draw()}
