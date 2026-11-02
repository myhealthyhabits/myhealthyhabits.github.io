/* v72 Lose It-style tracking: log again labels, barcode cache, scan another, macro bars, move/copy */
function lastLbl(s){try{const u=s.food.units[s.ui];if(!u||!(s.qty>0))return'';const e=entryFrom(s.food,s.ui,s.qty);return amtLbl(e)+' · '+fE(e.kcal)}catch(e){return''}}
/* offline barcode cache (separate localStorage key, newest 300) */
const BCK='mhh-bc';
function bcAll(){try{return JSON.parse(localStorage.getItem(BCK)||'{}')}catch(e){return{}}}
function bcGet(V){const A=bcAll();for(const v of V)if(A[v])return A[v].f;return null}
function bcPut(V,f){try{const A=bcAll(),k=V.find(v=>v.length===13)||V[0];const o={...f};delete o._cn;A[k]={f:o,t:Date.now()};const ks=Object.keys(A).sort((a,b)=>A[b].t-A[a].t);ks.slice(300).forEach(x=>delete A[x]);localStorage.setItem(BCK,JSON.stringify(A))}catch(e){}}
/* after adding a scanned food */
function scanAgain(f,e,m){const mn=(D.meals.find(x=>x.id===m)||{}).name||'meal';
 sheet(`<div class="scok"><span>✅</span><h2>Added to ${esc(mn)}</h2><p class="mut">${esc(cleanName(f))} · ${esc(amtLbl(e))} · ${fE(e.kcal)}</p></div><button class="btn" id="sa_go">📷 Scan another</button><button class="btn alt" id="sa_undo">↩️ Undo</button><button class="btn alt" data-close="1">Done</button>`);
 $('#sa_go').onclick=()=>scan(m);
 $('#sa_undo').onclick=()=>{const a=dayLog(cur)[m]||[],i=a.findIndex(x=>x===e||x.id===e.id);if(i>=0)a.splice(i,1);save();render();close();toast('Undone')}}
/* colorful macro bars: today so far + this food */
function mbars(e,ctx){const box=document.getElementById('v_mb');if(!box)return;const d=(ctx&&ctx.entry&&ctx.entry.date)||cur,t=dayTotal(d),g=macroGoal();
 let old=null;if(ctx&&ctx.entry){old=((D.log[d]||{})[ctx.entry.mid]||[]).find(x=>x.id===ctx.entry.id)}
 const R=[['p','🥩 Protein','#ff6b6b'],['c','🍞 Carbs','#ffb340'],['f','🥑 Fat','#5ac8fa']];
 box.innerHTML=`<div class="mbh">Today with this food</div>`+R.map(([k,l,c])=>{const base=Math.max(0,(t[k]||0)-(old?old[k]||0:0)),add=e[k]||0,G=g[k]||1,b=Math.min(100,base/G*100),a=Math.min(100-b,add/G*100),tot=base+add;
  return`<div class="mbr"><span class="mbl">${l}</span><div class="mbt"><i style="width:${b}%;background:${c}"></i><i class="mba" style="width:${a}%;background:${c}"></i></div><span class="mbv${tot>G?' over':''}">${Math.round(tot)}<small>/${Math.round(G)}g</small></span></div>`}).join('')}
/* copy a meal to another day, with Undo */
function copyMealTo(mid,from,to){const src=(D.log[from]||{})[mid]||[];if(!src.length)return toast('Nothing to copy');const ids=[];src.forEach(e=>{const n={...e,id:uid()};ids.push(n.id);(dayLog(to)[mid]=dayLog(to)[mid]||[]).push(n)});save();render();
 toastU(`📅 Copied ${src.length} item${src.length>1?'s':''} to ${to===addDays(from,1)?'tomorrow':nice(to)}`,()=>{const a=(D.log[to]||{})[mid]||[];D.log[to][mid]=a.filter(x=>!ids.includes(x.id))})}
/* move / copy one logged food */
function moveSheet(mid,id){const e=((D.log[cur]||{})[mid]||[]).find(x=>x.id===id);if(!e)return;let tm=mid,td=cur;const days=[[addDays(cur,-1),'Yesterday'],[cur,'This day'],[addDays(cur,1),'Tomorrow']];
 sheet(`<h2>↔️ Move or copy</h2><p class="mut" style="margin-top:0">${emoOf(e.food)} ${esc(cleanName(e.food))} · ${esc(amtLbl(e))}</p><div class="qlt">Meal</div><div class="fabmeals" id="mv_m">${visMeals().map(m=>`<button class="pill" data-v="${m.id}">${esc(m.name)}</button>`).join('')}</div>
 <div class="qlt">Day</div><div class="fabmeals" id="mv_d">${days.map(([d,l])=>`<button class="pill" data-v="${d}">${l}</button>`).join('')}<input type="date" id="mv_dt" class="mvdt" value="${cur}" aria-label="Pick a date"></div>
 <button class="btn" id="mv_go">Move</button><button class="btn alt" id="mv_cp">📋 Copy instead</button><button class="btn alt" data-close="1">Cancel</button>`);
 const paint=()=>{document.querySelectorAll('#mv_m .pill').forEach(b=>b.classList.toggle('on',b.dataset.v===tm));document.querySelectorAll('#mv_d .pill').forEach(b=>b.classList.toggle('on',b.dataset.v===td));$('#mv_dt').value=td};paint();
 $('#mv_m').onclick=ev=>{const b=ev.target.closest('.pill');if(b){tm=b.dataset.v;paint()}};$('#mv_d').onclick=ev=>{const b=ev.target.closest('.pill');if(b){td=b.dataset.v;paint()}};$('#mv_dt').onchange=ev=>{if(ev.target.value){td=ev.target.value;paint()}};
 const lbl=()=>`${(D.meals.find(m=>m.id===tm)||{}).name}${td===cur?'':' · '+(td===addDays(cur,1)?'tomorrow':td===addDays(cur,-1)?'yesterday':nice(td))}`;
 $('#mv_go').onclick=()=>{if(tm===mid&&td===cur)return close();const src=dayLog(cur)[mid],i=src.indexOf(e),d0=cur;src.splice(i,1);(dayLog(td)[tm]=dayLog(td)[tm]||[]).push(e);save();close();render();
  toastU('↔️ Moved to '+lbl(),()=>{const a=D.log[td][tm],j=a.indexOf(e);if(j>=0)a.splice(j,1);const s=(dayLog(d0)[mid]=dayLog(d0)[mid]||[]);s.splice(Math.min(i,s.length),0,e)})};
 $('#mv_cp').onclick=()=>{const n={...e,id:uid()};(dayLog(td)[tm]=dayLog(td)[tm]||[]).push(n);save();close();render();toastU('📋 Copied to '+lbl(),()=>{const a=D.log[td][tm],j=a.indexOf(n);if(j>=0)a.splice(j,1)})}}
/* long-press a logged food (and right-click on desktop) */
(()=>{let T=null,x0=0,y0=0,el=null;const clr=()=>{clearTimeout(T);T=null};
 document.addEventListener('pointerdown',ev=>{const r=ev.target.closest&&ev.target.closest('.miw>.mi');if(!r||ev.target.closest('[data-rm]'))return;el=r;x0=ev.clientX;y0=ev.clientY;clr();T=setTimeout(()=>{T=null;r._sw=1;setTimeout(()=>r._sw=0,600);if(navigator.vibrate)navigator.vibrate(20);const[m,id]=r.dataset.edit.split('|');moveSheet(m,id)},500)},true);
 document.addEventListener('pointermove',ev=>{if(T&&(Math.abs(ev.clientX-x0)>8||Math.abs(ev.clientY-y0)>8))clr()},true);
 ['pointerup','pointercancel','scroll'].forEach(t=>document.addEventListener(t,clr,true));
 document.addEventListener('contextmenu',ev=>{const r=ev.target.closest&&ev.target.closest('.miw>.mi');if(!r)return;ev.preventDefault();clr();const[m,id]=r.dataset.edit.split('|');moveSheet(m,id)})})();
