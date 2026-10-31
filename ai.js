/* v47: AI helpers (Gemini via meal-scan Edge Function): What should I eat?, Talk or type to log, Weekly coach recap. All share the daily AI limit. */
function aiErr(r,j,what){if(!r)return'No connection. Check your signal and try again.';
 if(r.status===429)return j.error==='user_limit'?`You've used all ${j.cap||10} AI uses for today (meal scans, ideas, talk-to-log and recaps share them). They reset at midnight Pacific. 🌙`:'The AI helper is extra busy today and hit its daily limit. Please try again tomorrow!';
 return r.status===503?`${what} is still being set up. Check back soon!`:'Something went wrong on our side. Please try again in a moment.'}
const aiMealPills=(mid,attr)=>`<div class="ai-mp">${visMeals().map(m=>`<button data-${attr}="${m.id}" class="${m.id===mid?'on':''}">${esc(m.name)}</button>`).join('')}</div>`;
const aiN=it=>{const n=msN(it),m=it.g/100;return{k:n.kcal*m,p:n.p*m,c:n.c*m,f:n.f*m}};
const aiSum=items=>items.reduce((t,it)=>{const n=aiN(it);t.k+=n.k;t.p+=n.p;t.c+=n.c;t.f+=n.f;return t},{k:0,p:0,c:0,f:0});
/* ---- What should I eat? ---- */
let aiIdeas=null;
function ideasSheet(mid){mid=mid||nextMeal();const t=dayTotal(cur),left=Math.round(budget()-t.kcal),pl=Math.max(0,Math.round(macroGoal().p-t.p));
 sheet(`<h2>🍽️ What should I eat?</h2><div class="ai-left"><span>🔥 <b>${fE(Math.max(0,left))}</b> left</span><span>🥩 <b>${pl} g</b> protein to go</span></div>
 <label>Ideas for</label>${aiMealPills(mid,'im')}
 <details class="ai-pref"${D.aiSched||D.dislikes?'':' open'}><summary>⚙️ My schedule & foods I skip</summary>
 <label>My eating schedule</label><input id="ai_sch" placeholder="e.g. Dinner 6pm first meal, lunch 1am on shift, breakfast 7am" value="${esc(D.aiSched||'')}">
 <label>Foods I don't like</label><input id="ai_dis" placeholder="e.g. boiled eggs, mushrooms" value="${esc(D.dislikes||'')}"></details>
 <div id="ai_res">${aiIdeas&&aiIdeas.mid===mid&&aiIdeas.day===cur?ideaCards(aiIdeas.list):''}</div>
 <button class="btn" id="ai_go">${aiIdeas&&aiIdeas.mid===mid&&aiIdeas.day===cur?'✨ 3 new ideas':'✨ Get 3 ideas'}</button><p class="hint">Ideas and numbers are AI <b>estimates</b>. Uses 1 of your daily AI uses.</p>`);
 const keep=()=>{D.aiSched=$('#ai_sch').value.trim().slice(0,160);D.dislikes=$('#ai_dis').value.trim().slice(0,160);save()};
 $('#ai_sch').onchange=keep;$('#ai_dis').onchange=keep;
 document.querySelectorAll('[data-im]').forEach(b=>b.onclick=()=>{keep();ideasSheet(b.dataset.im)});
 const bindCards=()=>document.querySelectorAll('[data-il]').forEach(b=>b.onclick=()=>{const I=aiIdeas.list[+b.dataset.il];window.msPick=1;window.msThumb=null;
  msReview(mid,I.items.map(x=>msItem(x)),{title:`${esc(I.emoji||'🍽️')} ${esc(I.title)}`,src:'idea',back:m=>ideasSheet(m),backL:'← Back to ideas'})});
 bindCards();
 $('#ai_go').onclick=async()=>{keep();const b=$('#ai_go');b.disabled=true;$('#ai_res').innerHTML='<div class="ai-wait">🧑‍🍳 Cooking up ideas…</div>';
  const L=dayLog(cur),eaten=[...new Set(Object.values(L).flat().map(e=>e&&e.food&&e.food.name).filter(Boolean))].slice(0,20),
   empty=visMeals().filter(m=>!(L[m.id]||[]).length).length||1,mn=(D.meals.find(m=>m.id===mid)||{}).name,
   avoid=[...((D.aiSeen||{})[cur]||[])].slice(-12);
  const ctx={upcomingMeal:mn,mealsLeftToday:empty,remainingCalories:Math.max(0,left),targetCalories:Math.max(150,Math.round(Math.max(0,left)/empty)),remainingProtein:pl,
   schedule:D.aiSched||'',dislikes:D.dislikes||'',eatenToday:eaten,avoid,localTime:new Date().toTimeString().slice(0,5)};
  let r,j={};try{[r,j]=await msCall({mode:'ideas',ctx})}catch(e){}
  const list=r&&r.ok?(j.ideas||[]).filter(i=>i&&i.title&&(i.items||[]).some(x=>+x.grams>0)).map(i=>({...i,items:i.items.filter(x=>+x.grams>0)})):[];
  if(!list.length){b.disabled=false;$('#ai_res').innerHTML=`<div class="ai-msg">${r&&r.ok?'🤔 No ideas came back. Try again?':esc(aiErr(r,j,'Meal ideas'))}</div>`;return}
  aiIdeas={mid,day:cur,list};D.aiSeen={[cur]:[...avoid,...list.map(i=>i.title)]};save();$('#ai_res').innerHTML=ideaCards(list);b.disabled=false;b.textContent='✨ 3 new ideas';bindCards()}}
function ideaCards(list){return list.map((I,i)=>{const s=aiSum(I.items.map(x=>msItem(x)));return`<div class="ai-idea ai-c${i}"><div class="ai-it"><span class="ai-emo">${esc(I.emoji||'🍽️')}</span><div><b>${esc(I.title)}</b><small>${esc(I.why||'')}</small></div></div>
 <div class="ms-ch"><span class="ai-k">~${fE(s.k)}</span><span class="cp">P ${r0(s.p)}g</span><span class="cc">C ${r0(s.c)}g</span><span class="cf">F ${r0(s.f)}g</span><i class="ms-tag ai">estimate</i></div>
 <small class="mut">${I.items.map(x=>esc(msCap(x.name))).join(' · ')}</small><button class="btn ai-log" data-il="${i}">✅ Log this</button></div>`}).join('')}
/* ---- Talk or type to log ---- */
function talkSheet(mid,txt=''){mid=mid||msAutoMeal();const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 sheet(`<h2>🎙️ Talk or type to log</h2><p class="mut" style="margin-top:0">Say or type what you ate, like “2 eggs and toast with butter”. You can fix anything before it's logged.</p>
 <div class="ai-talk"><textarea id="tk_t" rows="3" maxlength="300" placeholder="e.g. a turkey sandwich and an apple">${esc(txt)}</textarea>${SR?'<button id="tk_mic" class="ai-mic" aria-label="Speak">🎤</button>':''}</div>
 <p class="hint" id="tk_h">${SR?'Tap 🎤 and speak, or just type.':'Voice isn’t supported in this browser, so type it instead.'}</p>
 <label>Log to</label>${aiMealPills(mid,'tm')}<button class="btn" id="tk_go">✨ Find my foods</button><div id="tk_msg"></div><p class="hint">Numbers are <b>estimates</b>. Uses 1 of your daily AI uses.</p>`);
 document.querySelectorAll('[data-tm]').forEach(b=>b.onclick=()=>talkSheet(b.dataset.tm,$('#tk_t').value));
 if(SR){let rec=null;$('#tk_mic').onclick=()=>{if(rec){rec.stop();return}rec=new SR();rec.lang=navigator.language||'en-US';rec.interimResults=true;const base=$('#tk_t').value;
  $('#tk_mic').classList.add('on');$('#tk_h').textContent='Listening… tap 🎤 again to stop.';
  rec.onresult=e=>{$('#tk_t').value=(base?base+' ':'')+[...e.results].map(x=>x[0].transcript).join(' ')};
  rec.onerror=e=>{$('#tk_h').textContent=e.error==='not-allowed'?'Mic access was blocked. You can type instead.':'Didn’t catch that. Try again or type it.'};
  rec.onend=()=>{rec=null;const m=$('#tk_mic');if(m)m.classList.remove('on');const h=$('#tk_h');if(h&&/Listening/.test(h.textContent))h.textContent='Got it! Edit if needed, then tap Find my foods.'};try{rec.start()}catch(e){rec=null}}}
 $('#tk_go').onclick=async()=>{const text=$('#tk_t').value.trim();if(!text)return toast('Say or type what you ate');const b=$('#tk_go');b.disabled=true;b.textContent='🔎 Reading your meal…';
  let r,j={};try{[r,j]=await msCall({mode:'parse',text})}catch(e){}
  const items=r&&r.ok?(j.items||[]).filter(x=>x&&x.name&&+x.grams>0):[];
  if(!items.length){b.disabled=false;b.textContent='✨ Find my foods';$('#tk_msg').innerHTML=`<div class="ai-msg">${r&&r.ok?'🤔 Couldn’t find any foods in that. Try naming them, like “1 cup rice”.':esc(aiErr(r,j,'Talk to log'))}</div>`;return}
  window.msPick=1;window.msThumb=null;msReview(mid,items.map(msItem),{title:'🎙️ Here’s what you ate',src:'voice',back:m=>talkSheet(m,text),backL:'✏️ Edit what I said'})}}
/* ---- Weekly coach recap ---- */
const aiWk=d=>{const x=new Date(d+'T12:00:00'),k=(x.getDay()+6)%7;return addDays(d,-k)};
function recapData(){const t=logicalToday(),days=[...Array(7)].map((_,i)=>addDays(t,i-7)),g=macroGoal(),S=streaks();
 const per=days.map(d=>{const x=dayTotal(d);return{day:d,logged:x.kcal>0,cal:Math.round(x.kcal),budget:Math.round(budget(d)),protein:Math.round(x.p),steps:D.steps[d]||0,waterOz:(D.water||{})[d]||0,workout:!!D.gym[d]}});
 const L=per.filter(p=>p.logged);return{daysLogged:L.length,days:per,proteinGoal:g.p,stepGoal:D.stepGoal||10000,
  avgCalories:L.length?Math.round(L.reduce((s,p)=>s+p.cal,0)/L.length):0,daysWithinBudget:L.filter(p=>p.cal<=p.budget).length,
  streaks:Object.fromEntries(Object.entries(S).map(([k,v])=>[k,{current:v.cur,best:v.best}])),snapStreak:typeof snapStreak==='function'?snapStreak().cur:0}}
async function recapGen(manual){const t=logicalToday(),R=D.aiRecap||{};if(manual&&R.day===t)return toast('You can refresh once a day · try tomorrow');
 window._rcBusy=1;paintRecap();let r,j={};try{[r,j]=await msCall({mode:'recap',ctx:recapData()})}catch(e){}window._rcBusy=0;
 if(r&&r.ok&&j.headline){D.aiRecap={wk:aiWk(t),day:t,data:{headline:j.headline,wins:(j.wins||[]).slice(0,3),tips:(j.tips||[]).slice(0,2),streak:j.streak||''}};save()}
 else{window._rcErr=aiErr(r,j,'Weekly recap');if(!manual)D.aiRecapTry=t,save()}paintRecap()}
function recapCard(){const t=logicalToday(),R=D.aiRecap,d=R&&R.data,busy=window._rcBusy;
 let body=busy?'<div class="ai-wait">🧑‍🏫 Writing your week…</div>':d?`<p class="rc-h">${esc(d.headline)}</p><div class="rc-sec"><b>🏆 Wins</b>${d.wins.map(w=>`<p>${esc(w)}</p>`).join('')}</div><div class="rc-sec"><b>💡 Try this</b>${d.tips.map(w=>`<p>${esc(w)}</p>`).join('')}</div>${d.streak?`<div class="rc-st">🔥 ${esc(d.streak)}</div>`:''}`
  :`<p class="mut">Log a couple of days and your coach will write a weekly recap here.</p>`;
 if(window._rcErr&&!busy)body+=`<div class="ai-msg">${esc(window._rcErr)}</div>`;
 const can=d&&R.day!==t&&!busy;
 return`<div class="card rcap" id="rcap"><div class="rc-top"><h2>🧑‍🏫 Weekly coach</h2>${d?`<button class="pill" id="rc_ref" ${can?'':'disabled'}>${R.day===t?'✓ Fresh today':'↻ Refresh'}</button>`:''}</div>${body}<small class="mut">AI-written from your logs · ${d&&R.wk===aiWk(t)?'this week':'updates weekly'}</small></div>`}
function paintRecap(){const c=document.getElementById('rcap');if(!c)return;c.outerHTML=recapCard();const b=document.getElementById('rc_ref');if(b)b.onclick=()=>{window._rcErr='';recapGen(1)}}
function recapMaybe(){const t=logicalToday(),R=D.aiRecap;if(window._rcBusy||(R&&R.wk===aiWk(t))||D.aiRecapTry===t)return;if(recapData().daysLogged<2)return;recapGen(0)}
/* ---- hooks ---- */
function aiHook(){if(typeof tab==='undefined'||typeof V==='undefined')return;if(tab==='today'&&!document.querySelector('.aibar')){const h=V.querySelector('.rhero');if(h)h.insertAdjacentHTML('afterend',`<div class="aibar"><button id="ai_eat"><span>🍽️</span><b>What should I eat?</b><small>3 ideas that fit your day</small></button><button id="ai_talk"><span>🎙️</span><b>Talk or type to log</b><small>“2 eggs and toast”</small></button></div>`);
  const e=$('#ai_eat'),k=$('#ai_talk');if(e)e.onclick=()=>ideasSheet();if(k)k.onclick=()=>talkSheet()}
 if(tab==='progress'&&!document.getElementById('rcap')){V.insertAdjacentHTML('afterbegin',recapCard());paintRecap();recapMaybe()}
}
(function(){const prev=window.afterRender;window.afterRender=function(){aiHook();return prev&&prev.apply(this,arguments)};aiHook()})();
