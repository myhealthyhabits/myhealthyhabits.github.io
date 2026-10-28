'use strict';
const APP_NAME='My Healthy Habits'; // working name: change here (and in manifest.webmanifest)
document.title=APP_NAME;
const $=s=>document.querySelector(s),V=$('#view'),KEY='ct-data-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r0=n=>Math.round(n||0),r1=n=>Math.round((n||0)*10)/10,uid=()=>Math.random().toString(36).slice(2,10);
const APP_USDA_KEY='DT9zrJmwr7F7qwrrM76T9MnHq6BW8HcMMNzgMgBq'; // built-in api.data.gov key (public, client-side by design)
const tfetch=(u,ms=8000)=>{const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return fetch(u,{signal:c.signal}).finally(()=>clearTimeout(t))};
const def=()=>({profile:null,budget:null,macroPct:{p:30,c:40,f:30},meals:[{id:'b',name:'Meal 1'},{id:'l',name:'Meal 2'},{id:'d',name:'Meal 3'},{id:'m4',name:'Meal 4'},{id:'s',name:'Snacks'}],mealCount:3,fiberGoal:28,water:{},waterGoal:64,notes:{},workouts:[],wtemplates:[],fav:[],shareOFF:false,rollover:0,usdaKey:'',stepsAddBack:false,exercise:{},exAddBack:false,budgetMode:'manual',macroGrams:null,gym:{},gymGoal:4,steps:{},stepGoal:10000,log:{},custom:[],saved:[],stats:{},weights:[],done:{}});
/* Storage adapter: swap Store.backend for a cloud sync backend later (same load/save shape). */
const Store={backend:{load:()=>JSON.parse(localStorage.getItem(KEY)||'{}'),save:d=>localStorage.setItem(KEY,JSON.stringify(d))},
 load(){try{return Object.assign(def(),this.backend.load())}catch(e){return def()}},save(d){d.updatedAt=Date.now();this.backend.save(d)}};
let D=Store.load();if(!D.done||typeof D.done!=='object')D.done={};
/* one-time: exercise/step calories no longer added to budget by default */
if(!D.noAddBackV1){D.exAddBack=false;D.stepsAddBack=false;D.noAddBackV1=1;try{Store.save(D)}catch(e){}}
/* migrate old Breakfast/Lunch/Dinner names to neutral meals (ids and logs kept) */
{const old={b:'Breakfast',l:'Lunch',d:'Dinner'},nw={b:'Meal 1',l:'Meal 2',d:'Meal 3'};D.meals.forEach(m=>{if(old[m.id]===m.name)m.name=nw[m.id]});
 if(!D.meals.some(m=>m.id==='s'))D.meals.push({id:'s',name:'Snacks'});
 if(!D.meals.some(m=>m.id==='m4')){const si=D.meals.findIndex(m=>m.id==='s');D.meals.splice(si,0,{id:'m4',name:'Meal 4'})}
 D.mealCount=Math.max(1,Math.min(4,+D.mealCount||3));}
const mainMeals=()=>D.meals.filter(m=>m.id!=='s');
const visMeals=(d=cur)=>{const L=D.log[d]||{},mm=mainMeals();return[...mm.filter((m,i)=>i<D.mealCount||(L[m.id]||[]).length),...D.meals.filter(m=>m.id==='s')]};
const save=()=>Store.save(D);
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add('hidden'),2200)};
const iso=d=>{const z=new Date(d);return z.getFullYear()+'-'+String(z.getMonth()+1).padStart(2,'0')+'-'+String(z.getDate()).padStart(2,'0')};
const logicalToday=()=>iso(Date.now()-D.rollover*3600e3);
const addDays=(s,n)=>{const d=new Date(s+'T12:00');d.setDate(d.getDate()+n);return iso(d)};
const nice=s=>{const t=logicalToday();if(s===t)return'Today';if(s===addDays(t,-1))return'Yesterday';return new Date(s+'T12:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})};
let cur=logicalToday(),tab='today';
const sheet=h=>{$('#sheetBody').innerHTML=h;$('#sheet').classList.remove('hidden')};
const close=()=>{stopScan();$('#sheet').classList.add('hidden')};
$('#sheet').onclick=e=>{if(e.target.id==='sheet')close()};

/* ---------- calculations ---------- */
const ACT=[[1.2,'Sedentary','Desk job or mostly sitting, little or no exercise'],[1.375,'Lightly active','On your feet some of the day, or light exercise 1–3 days a week'],[1.55,'Moderately active','On your feet most of a shift, or exercise 3–5 days a week'],[1.725,'Very active','Physical job all shift, or hard exercise 6–7 days a week'],[1.9,'Extremely active','Heavy labor plus daily training']];
const heightCm=p=>p.hUnit==='cm'?+p.cm:(+p.ft*12+ +p.inch)*2.54;
function calc(p){const kg=p.weight*0.453592,cm=heightCm(p),bmr=10*kg+6.25*cm-5*p.age+(p.sex==='m'?5:-161),tdee=bmr*p.act;
 const rate=p.goalType==='maintain'?0:+p.rate,adj=rate*500*(p.goalType==='gain'?1:-1),raw=tdee+adj,floor=p.sex==='m'?1500:1200;
 const final=Math.round(Math.max(floor,raw)/10)*10,diff=Math.abs(p.weight-p.goal),weeks=rate?diff/rate:0;
 const realRate=p.goalType==='lose'?Math.max(0,(tdee-final)/500):rate,eta=realRate>0&&diff?new Date(Date.now()+diff/realRate*7*864e5):null;
 return{bmr:r0(bmr),tdee:r0(tdee),adj:r0(adj),raw:r0(raw),final,floor,capped:raw<floor,eta,weeks}}
const budget=(d=cur)=>typeof dayBudget==='function'?dayBudget(d):(D.budget||1800);
const macroGoal=()=>{if(D.macroGrams)return D.macroGrams;const b=budget(),m=D.macroPct;const dflt=m.p===30&&m.c===40&&m.f===30;
 if(dflt){const pr=D.profile,w=pr&&+pr.weight?Math.min(+pr.weight,+pr.goal||+pr.weight):0,S=D.strat||'bal';let p=w?w*(S==='hp'?0.9:0.7):b*(S==='hp'?0.3:0.2)/4;p=Math.max(50,Math.min(p,S==='hp'?180:160,b*(S==='hp'?0.4:0.3)/4));let f,c;if(S==='lc'){c=b*0.2/4;f=Math.max(0,(b-p*4-c*4)/9)}else{f=b*0.3/9;c=Math.max(0,(b-p*4-f*9)/4)}return{p:Math.round(p),c:Math.round(c),f:Math.round(f)}}
 return{p:b*m.p/100/4,c:b*m.c/100/4,f:b*m.f/100/9}};
const dayLog=d=>D.log[d]||(D.log[d]={});
const sumEntries=a=>a.reduce((s,e)=>({kcal:s.kcal+e.kcal,p:s.p+e.p,c:s.c+e.c,f:s.f+e.f,fb:s.fb+(e.fb||0)}),{kcal:0,p:0,c:0,f:0,fb:0});
const dayTotal=d=>sumEntries(Object.values(D.log[d]||{}).flat());
function entryFrom(food,ui,qty){const u=food.units[ui]||food.units[0],m=u.mult*qty,n=food.n;
 return{id:uid(),food,ui,qty,kcal:n.kcal*m,p:n.p*m,c:n.c*m,f:n.f*m,fb:(n.fb||0)*m}}
const fkey=f=>f.src+':'+(f.ref||f.name);
function addEntry(mealId,e,date=cur){(dayLog(date)[mealId]=dayLog(date)[mealId]||[]).push(e);
 const k=fkey(e.food),s=D.stats[k]||{count:0};D.stats[k]={food:e.food,count:s.count+1,last:Date.now(),ui:e.ui,qty:e.qty,meal:mealId};save()}

/* ---------- calorie budget ---------- */
const nb=()=>{$('.tabs').classList.toggle('hidden',!D.profile&&!D.budget)};
function budgetHome(){nb();const has=!!D.budget;
 V.innerHTML=`<div class="card hero"><div class="mut">${has?'Your daily calorie budget':'Welcome to '+esc(APP_NAME)}</div>${has?`<div class="big">${budget().toLocaleString()}</div><div class="mut">${D.budgetMode==='guided'?'Recommended from your profile':'Set by you'}</div>`:'<h2 style="margin-top:6px">How do you want to set your calorie budget?</h2>'}</div>
 <button class="choice" id="b_guide"><b>🧭 Guide me</b><span>Answer a few quick questions and get a recommended budget and goal date.</span></button>
 <button class="choice" id="b_own"><b>✏️ Set my own calories</b><span>Type in a daily calorie number, with optional macro goals.</span></button>
 ${has?'<button class="btn alt" id="b_back">Back</button>':''}`;
 $('#b_guide').onclick=()=>wizard(0);$('#b_own').onclick=manual;if(has)$('#b_back').onclick=()=>go('today')}
function manual(){const g=D.macroGrams||{};
 V.innerHTML=`<div class="card"><h2>Set my own calories</h2><label>Daily calorie budget</label><input id="m_k" type="number" inputmode="numeric" class="bigin" value="${D.budget||''}" placeholder="e.g. 1800">
 <label style="margin-top:16px">Macro goals (optional, grams per day)</label><div class="row"><div><label>Protein</label><input id="m_p" type="number" value="${g.p?r0(g.p):''}"></div><div><label>Carbs</label><input id="m_c" type="number" value="${g.c?r0(g.c):''}"></div><div><label>Fat</label><input id="m_f" type="number" value="${g.f?r0(g.f):''}"></div></div>
 <p class="mut" style="font-size:13px">Leave blank to use a 30/40/30 split of your calories.</p>
 <button class="btn" id="m_go">Save budget</button><button class="btn alt" id="m_back">Back</button></div>`;
 $('#m_back').onclick=budgetHome;
 $('#m_go').onclick=()=>{const k=+$('#m_k').value;if(!(k>=800&&k<=6000))return toast('Enter a budget between 800 and 6000');
  const P=+$('#m_p').value,C=+$('#m_c').value,F=+$('#m_f').value;D.macroGrams=(P||C||F)?{p:P,c:C,f:F}:null;
  D.budget=k;D.budgetMode='manual';D.profile=D.profile||{manual:true};save();nb();go('today');toast('Budget set to '+k.toLocaleString())}}
let W0=null;
const STEPS=['goal','sex','age','height','weight','goalw','act','pace'];
function wizard(i){if(i===0&&!W0)W0=Object.assign({goalType:'lose',sex:'m',age:'',hUnit:U().h==='cm'?'cm':'ft',ft:'',inch:'',cm:'',weight:'',goal:'',act:1.375,rate:1},D.profile&&!D.profile.manual?D.profile:{});
 const p=W0,st=STEPS[i],opt=(k,v,t,d='')=>`<button class="choice ${p[k]==v?'on':''}" data-k="${k}" data-v="${v}"><b>${t}</b>${d?`<span>${d}</span>`:''}</button>`;
 if(p.goalType==='maintain'&&st==='goalw')return wizard(i+(wizard.dir||1));if(p.goalType==='maintain'&&st==='pace')return i<STEPS.length-1?0:summary();
 let body='';
 if(st==='goal')body=`<h2>What's your goal?</h2>${opt('goalType','lose','Lose weight')}${opt('goalType','maintain','Maintain my weight')}${opt('goalType','gain','Gain weight')}`;
 if(st==='sex')body=`<h2>What's your sex?</h2><p class="mut">Used to estimate how many calories your body burns.</p>${opt('sex','m','Male')}${opt('sex','f','Female')}`;
 if(st==='age')body=`<h2>How old are you?</h2><label>Age</label><input id="w_age" type="number" inputmode="numeric" class="bigin" value="${p.age}"><label>…or your birthday</label><input id="w_bd" type="date" value="${p.bday||''}">`;
 if(st==='height')body=`<h2>How tall are you?</h2><div class="seg"><button data-hu="ft" class="${p.hUnit==='ft'?'on':''}">ft / in</button><button data-hu="cm" class="${p.hUnit==='cm'?'on':''}">cm</button></div>
  ${p.hUnit==='ft'?`<div class="row"><div><label>Feet</label><input id="w_ft" type="number" class="bigin" value="${p.ft}"></div><div><label>Inches</label><input id="w_in" type="number" class="bigin" value="${p.inch}"></div></div>`:`<label>Centimeters</label><input id="w_cm" type="number" class="bigin" value="${p.cm}">`}`;
 if(st==='weight')body=`<h2>What's your current weight?</h2><label>Pounds</label><input id="w_w" type="number" step="0.1" inputmode="decimal" class="bigin" value="${p.weight}">`;
 if(st==='goalw')body=`<h2>What's your goal weight?</h2><label>Pounds</label><input id="w_g" type="number" step="0.1" inputmode="decimal" class="bigin" value="${p.goal}">`;
 if(st==='act')body=`<h2>How active are you?</h2><p class="mut">Not counting workouts you'll log separately.</p>${ACT.map(([v,t,d])=>opt('act',v,t,d)).join('')}`;
 if(st==='pace')body=`<h2>How fast do you want to ${p.goalType==='gain'?'gain':'lose'}?</h2>${[[0.5,'Slow and steady'],[1,'Recommended'],[1.5,'Faster'],[2,'Aggressive']].map(([v,d])=>opt('rate',v,v+' lb per week',d)).join('')}`;
 const n=p.goalType==='maintain'?6:8,pos=p.goalType==='maintain'&&i>5?5:i;
 V.innerHTML=`<div class="dots">${[...Array(n)].map((_,j)=>`<i class="${j<=pos?'on':''}"></i>`).join('')}</div><div class="card wiz">${body}</div>
 <div class="row wnav"><button class="btn alt" id="w_back">Back</button><button class="btn" id="w_next">${i===STEPS.length-1?'See my budget':'Next'}</button></div>`;
 V.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{const k=b.dataset.k;p[k]=isNaN(+b.dataset.v)?b.dataset.v:+b.dataset.v;V.querySelectorAll(`[data-k="${k}"]`).forEach(x=>x.classList.toggle('on',x===b))});
 V.querySelectorAll('[data-hu]').forEach(b=>b.onclick=()=>{read();p.hUnit=b.dataset.hu;wizard(i)});
 if($('#w_bd'))$('#w_bd').onchange=e=>{const d=new Date(e.target.value);if(!isNaN(d)){p.bday=e.target.value;$('#w_age').value=Math.floor((Date.now()-d)/(365.25*864e5))}};
 function read(){const v=id=>$(id)?.value;if(st==='age')p.age=+v('#w_age');if(st==='height'){if(p.hUnit==='ft'){p.ft=+v('#w_ft');p.inch=+v('#w_in')||0}else p.cm=+v('#w_cm')}
  if(st==='weight')p.weight=+v('#w_w');if(st==='goalw')p.goal=+v('#w_g')}
 const ok=()=>{if(st==='age'&&!(p.age>=13&&p.age<=110))return'Enter your age';if(st==='height'&&!(heightCm(p)>100&&heightCm(p)<250))return'Enter your height';
  if(st==='weight'&&!(p.weight>60))return'Enter your weight';if(st==='goalw'){if(!(p.goal>60))return'Enter a goal weight';if(p.goalType==='lose'&&p.goal>=p.weight)return'Goal should be below your current weight';if(p.goalType==='gain'&&p.goal<=p.weight)return'Goal should be above your current weight'}};
 $('#w_back').onclick=()=>{read();wizard.dir=-1;i?wizard(i-1):(W0=null,budgetHome())};
 $('#w_next').onclick=()=>{read();const e=ok();if(e)return toast(e);wizard.dir=1;i<STEPS.length-1?wizard(i+1):summary()}}
function summary(){const p=W0;if(p.goalType==='maintain')p.goal=p.weight;const c=calc(p);
 V.innerHTML=`<div class="card hero"><div class="mut">Your recommended daily budget</div><div class="big">${c.final.toLocaleString()}</div><div class="mut">calories per day</div>
 ${c.eta&&p.goalType!=='maintain'?`<div class="eta">🎯 Reach <b>${p.goal} lb</b> by <b>${c.eta.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})}</b></div>`:''}</div>
 ${c.capped?`<div class="card nudge">⚠️ Your pace would put you below ${c.floor.toLocaleString()} calories a day, the safe minimum for ${p.sex==='m'?'men':'women'}. Your budget is held at ${c.floor.toLocaleString()}, so you'll reach your goal a bit later.</div>`:''}
 <div class="card"><h3 style="margin-top:0">How we got this</h3>
 <div class="item"><div>Resting burn (Mifflin-St Jeor)</div><b>${c.bmr.toLocaleString()}</b></div>
 <div class="item"><div>× activity (${ACT.find(a=>a[0]==p.act)[1].toLowerCase()})<small>Maintenance calories</small></div><b>${c.tdee.toLocaleString()}</b></div>
 ${c.adj?`<div class="item"><div>${c.adj<0?'Deficit':'Surplus'} for ${p.rate} lb/week<small>500 cal/day per lb/week</small></div><b>${c.adj>0?'+':''}${c.adj.toLocaleString()}</b></div>`:''}
 ${c.capped?`<div class="item"><div>Safety floor applied</div><b>${c.floor.toLocaleString()}</b></div>`:''}
 <div class="item"><div><b>Daily budget</b></div><b>${c.final.toLocaleString()}</b></div></div>
 <button class="btn" id="s_use">Use this budget</button><button class="btn alt" id="s_adj">Adjust</button>`;
 const commit=k=>{const first=!D.weights.length;D.profile={...p};D.budget=k;D.budgetMode=k===c.final?'guided':'manual';D.macroGrams=null;
  if(first)D.weights.push({date:logicalToday(),lb:p.weight});W0=null;save();nb();go('today');toast('Budget set to '+k.toLocaleString())};
 $('#s_use').onclick=()=>commit(c.final);
 $('#s_adj').onclick=()=>{sheet(`<h2>Adjust budget</h2><input id="a_k" type="number" class="bigin" value="${c.final}"><button class="btn" id="a_go">Save</button><button class="btn alt" onclick="close()">Cancel</button>`);
  $('#a_go').onclick=()=>{const k=+$('#a_k').value;if(!(k>=800))return toast('Enter a budget');close();commit(k)}}}
const onboarding=budgetHome;


/* ---------- activity rings ---------- */
const RC=[['cal','#ff2d6f','#ff7a59'],['stp','#9cff2e','#3ee08f'],['wat','#2ee6ff','#2f8cff']];
const RICON={cal:'<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 2 2s-.5-4 1-7z"/>',stp:'<path d="M5 12h12M13 7l5 5-5 5"/>',wat:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'};
function heroRings(t,b,exc,left){const st=D.steps[cur]||0,sg=D.stepGoal||10000,oz=D.water[cur]||0,wg=wGoal();
 const v=[t.kcal/(b+exc||1),st/sg,oz/wg],S=200,c=S/2,w=22,rs=[c-w/2-2,c-w*1.5-6,c-w*2.5-10];
 const svg=`<svg class="arings" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs>${RC.map(([k,a,z])=>`<linearGradient id="g_${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${z}"/><stop offset="1" stop-color="${a}"/></linearGradient>`).join('')}<filter id="rsh"><feDropShadow dx="0" dy="0" stdDeviation="2.2" flood-color="#000" flood-opacity=".7"/></filter></defs>
 ${RC.map(([k,a],i)=>{const r=rs[i],C=2*Math.PI*r,p=Math.max(0,v[i]||0),p1=Math.min(1,p),p2=Math.min(1,Math.max(0,p-1));
  return`<g><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${a}" stroke-opacity=".2" stroke-width="${w}"/>
  <circle class="ra" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="url(#g_${k})" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-to="${C*(1-p1)}" style="opacity:${p>0?1:0}"/>
  ${p2>0?`<circle class="ra ra2" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${a}" stroke-width="${w}" stroke-linecap="round" filter="url(#rsh)" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-to="${C*(1-p2)}"/>`:''}</g>`}).join('')}</svg>
 <svg class="ricons" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${RC.map(([k],i)=>`<g transform="translate(${c-7} ${c-rs[i]-7}) scale(.58)" fill="none" stroke="#000" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${RICON[k]}</g>`).join('')}</svg>`;
 const over=left<0;
 return`<div class="card rhero"><div class="rwrap">${svg}</div><div class="rstats">
 <div class="rs"><small>Calories</small><b style="color:#ff4f6d">${eN(t.kcal).toLocaleString()}<i>/${eN(b+exc).toLocaleString()}</i><em>${eU().toUpperCase()}</em></b></div>
 <div class="rs sgedit tap" role="button" aria-label="Steps, tap to change goal"><small>Steps ✎</small><b style="color:#a6ff3a">${st.toLocaleString()}<i>/${sg.toLocaleString()}</i></b></div>
 <div class="rs"><small>Water</small><b style="color:#3fe3ff">${lN(oz)}<i>/${lN(wg)}</i><em>${lU().toUpperCase()}</em></b></div>
 </div><div class="rleft ${over?'over':''}"><b>${eN(Math.abs(left)).toLocaleString()}</b> ${eU()==='kJ'?'kJ':'calories'} ${over?'over budget':'left today'}${exc?` <span class="mut">· +${r0(exc)} exercise</span>`:(()=>{const bn=exList(cur).reduce((s,e)=>s+(+e.kcal||0),0)+stepKcal(cur);return bn?` <span class="mut">· ${fE(bn)} burned</span>`:''})()}</div></div>`}
function animRings(){const rs=[...V.querySelectorAll('.ra')];if(prevRA)rs.forEach((r,i)=>{if(prevRA[i]){r.style.transition='none';r.style.strokeDashoffset=prevRA[i];r.getBoundingClientRect();r.style.transition=''}});requestAnimationFrame(()=>requestAnimationFrame(()=>rs.forEach(r=>r.style.strokeDashoffset=r.dataset.to)))}
function spark(vals,goal,col){const m=Math.max(goal||0,...vals,1);return`<div class="spark">${vals.map((v,i)=>`<i style="height:${Math.max(4,v/m*100)}%;background:${col};opacity:${i===vals.length-1?1:.55}"></i>`).join('')}</div>`}
function statGrid(){const days=[...Array(7)].map((_,i)=>addDays(cur,i-6)),S=streaks(),g=macroGoal(),t=dayTotal(cur);
 const card=(id,lbl,col,big,unit,ch)=>`<div class="scard" data-go="${id}"><small>${lbl}</small><b style="color:${col}">${big}<em>${unit}</em></b>${ch}</div>`;
 const gymDays=days.map(d=>D.gym[d]?1:0);
 return`<div class="sgrid">
 ${card('steps','Step Count','#a6ff3a',`<span class="stepnum" data-sd="${cur}" role="button" aria-label="Edit steps">${(D.steps[cur]||0).toLocaleString()}</span>`,'steps',spark(days.map(d=>D.steps[d]||0),D.stepGoal,'#8be22d'))}
 ${card('water','Water','#3fe3ff',lN(D.water[cur]||0),lU(),spark(days.map(d=>D.water[d]||0),D.waterGoal,'#2ec5ff'))}
 ${card('protein','Protein','#5b9dff',r0(t.p),'g / '+r0(g.p),spark(days.map(d=>dayTotal(d).p),g.p,'#4c8dff'))}
 ${card('gym','Gym Streak','#ffb020',S.gym.cur,S.gym.cur===1?'day':'days',`<div class="spark dots7">${gymDays.map(x=>`<i class="${x?'on':''}"></i>`).join('')}</div>`)}
 </div>`}
/* ---------- today ---------- */
function ring(pct,color){const R=52,C=2*Math.PI*R;return`<svg width="120" height="120"><circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--ln)" stroke-width="12"/>
 <circle cx="60" cy="60" r="${R}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-Math.min(1,pct))}"/></svg>`}
const exList=d=>{const a=[...(D.exercise[d]||[])];if(D.gym[d]?.kcal)a.unshift({id:'gym',name:'Gym'+(D.gym[d].type?' · '+D.gym[d].type:''),kcal:D.gym[d].kcal,gym:1});return a};
const KPS=0.03,/* conservative net kcal per step */stepKcal=d=>Math.round((D.steps[d]||0)*KPS);
// Step credit = step calories minus walking/running already logged as exercise (no double counting)
const stepCredit=d=>{if(!D.stepsAddBack)return 0;const walk=(D.exercise[d]||[]).filter(e=>/walk|run|jog|hike|step/i.test(e.name||'')).reduce((s,e)=>s+(+e.kcal||0),0);return Math.max(0,stepKcal(d)-walk)};
const exTotal=d=>exList(d).reduce((s,e)=>s+(+e.kcal||0),0)+stepCredit(d);
const TIPS={p:'chicken, Greek yogurt, eggs, tuna, cottage cheese',c:'oats, rice, fruit, potatoes, whole-grain bread',fb:'oats, beans, berries, lentils, chia seeds',kcal:'a balanced meal with protein and veggies'};
function tips(t,g,b){if(cur!==logicalToday())return'';const out=[],need=(k,v,goal,u,n)=>{const d=goal-v;if(d>goal*0.15)out.push(`Add <b>${r0(d)}${u}</b> more ${n}: try ${TIPS[k]}.`)};
 need('p',t.p,g.p,'g','protein');need('fb',t.fb,D.fiberGoal,'g','fiber');
 if(t.c>g.c*1.1)out.push(`Carbs are ${r0(t.c-g.c)}g over. Lean on protein and veggies for the rest of today.`);
 if(t.kcal>b)out.push(`You're ${r0(t.kcal-b)} cal over. A walk helps, and tomorrow is a fresh start.`);
 return out.length?`<div class="tips">${out.slice(0,2).map(x=>`<div>💡 ${x}</div>`).join('')}</div>`:(t.kcal?'<div class="tips"><div>✅ Nice balance so far today!</div></div>':'')}
function mini(lbl,v,goal,col,u='g'){const R=26,C=2*Math.PI*R,pc=Math.min(1,v/(goal||1));return`<div class="mr"><div class="mrr"><svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--ln)" stroke-width="7"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pc)}"/></svg><b>${r0(v)}</b></div><small>${lbl}</small><small class="mut">of ${r0(goal)}${u}</small></div>`}
let prevOz=null,prevRA=null,lastView=null;
function cupSVG(f,i,pop){const id='cw'+i,y=4+40*(1-f);return`<svg viewBox="0 0 36 48" width="100%" height="100%" aria-hidden="true"><defs><clipPath id="${id}"><path d="M5 4h26l-3.2 38.5a3 3 0 0 1-3 2.5H11.2a3 3 0 0 1-3-2.5z"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cf0ff"/><stop offset="1" stop-color="#0aa8d8"/></linearGradient></defs>
<path d="M5 4h26l-3.2 38.5a3 3 0 0 1-3 2.5H11.2a3 3 0 0 1-3-2.5z" fill="#3fe3ff" fill-opacity=".06"/>
<g clip-path="url(#${id})"><g class="wf${pop?' pop':''}" style="transform:translateY(${y}px)"><path class="wave" d="M-36 0q4.5-3 9 0t9 0 9 0 9 0 9 0 9 0 9 0 9 0 9 0 9 0 9 0 9 0V60H-36z" fill="url(#${id}g)" opacity="${f>0?1:0}"/>${f>0?'<circle class="bub" cx="14" cy="30" r="1.3"/><circle class="bub b2" cx="22" cy="34" r="1"/>':''}</g></g>
<path d="M5 4h26l-3.2 38.5a3 3 0 0 1-3 2.5H11.2a3 3 0 0 1-3-2.5z" fill="none" stroke="#3fe3ff" stroke-opacity="${f>0?.9:.35}" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 9l2.2 28" stroke="#fff" stroke-opacity=".18" stroke-width="1.6" stroke-linecap="round"/><text x="18" y="29" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff" fill-opacity="${f>0?.95:.6}" stroke="#04384a" stroke-opacity="${f>0?.55:0}" stroke-width="2" paint-order="stroke" style="font-family:inherit">${cupLbl()}</text></svg>`}
function waterCard(){const oz=D.water[cur]||0,g=wGoal(),C=CUP(),gc=Math.max(1,Math.round(g/C)),n=Math.max(gc,Math.ceil(oz/C-1e-6)),po=prevOz??oz,hit=oz>=g;
 return`<div class="card water ${hit?'hit':''}"><h3><span>Water</span><span class="wst">${hit?'✓ Goal reached · ':''}<b>${lN(oz)}</b> of ${fL(g)}</span></h3>
 <div class="cups2">${[...Array(n)].map((_,i)=>{const f=Math.max(0,Math.min(1,(oz-i*C)/C)),pf=Math.max(0,Math.min(1,(po-i*C)/C));return`<button class="cup ${f>0?'full':''} ${i>=gc?'xtra':''}" data-cup="${i}" aria-label="Cup ${i+1}, ${f>=1?'full':f>0?'partly full':'empty'}. ${f>0&&Math.ceil(oz/C-1e-6)-1===i?'Tap to empty':'Tap to fill to '+fL((i+1)*C)}">${cupSVG(f,i,f>pf)}</button>`}).join('')}${hit?`<button class="cup ghost" data-cup="${n}" aria-label="Add 8 oz">+8</button>`:''}</div></div>`}
function waterTap(i){const d=cur,oz=D.water[d]||0,C=CUP(),last=Math.ceil(oz/C-1e-6)-1,g=wGoal();prevOz=oz;D.water[d]=(i===last&&oz>0)?i*C:(i+1)*C;if(!D.water[d])delete D.water[d];save();today();prevOz=null;const nw=D.water[d]||0;if(oz<g&&nw>=g)toast('Water goal hit! 💧')}
let waterStack=[];
const bankCol=(left,b)=>left<0?'var(--bad)':left<b*0.15?'var(--warn)':'var(--ok)';
function bankRing(left,b){const R=80,C=2*Math.PI*R,pc=Math.max(0,Math.min(1,left/b));return`<svg width="190" height="190" viewBox="0 0 190 190"><circle cx="95" cy="95" r="${R}" fill="none" stroke="var(--ln)" stroke-width="16"/>
 <circle class="bankarc" cx="95" cy="95" r="${R}" fill="none" stroke="${bankCol(left,b)}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-(today.lastPc??1))}" data-to="${C*(1-pc)}"/></svg>`}
function stepsCard(){const d=cur,st=D.steps[d]||0,g=D.stepGoal||10000,S=streaks().steps,days=[...Array(7)].map((_,i)=>addDays(d,i-6));
 return`<div class="card stepsc"><h2 style="margin-top:0;display:flex;justify-content:space-between;align-items:center">Steps<button class="pill sgedit" aria-label="Change step goal">Goal ${g.toLocaleString()} ✎</button></h2><div style="display:flex;gap:14px;align-items:center"><div class="ring" style="position:relative;width:120px;height:120px">${ring(st/g,st>=g?'var(--ok)':'var(--steps)')}<div class="in" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><b class="stepnum" data-sd="${d}" role="button" aria-label="Edit steps">${st.toLocaleString()}</b><small class="mut">of ${g.toLocaleString()}</small></div></div>
 <div style="flex:1"><div>🔥 ${S.cur}-day streak<small class="mut" style="display:block">Best ${S.best}</small></div><div class="mut" style="font-size:13px">≈ ${stepKcal(d).toLocaleString()} cal burned${D.stepsAddBack?` · +${stepCredit(d)} added`:''}</div>
 <div class="row" style="margin-top:6px"><button class="add" data-sp="1000">+1,000</button><button class="add" data-sp="5000">+5,000</button></div>
 <div class="row"><input id="sp_n" type="number" inputmode="numeric" placeholder="Exact steps" style="flex:1;min-width:0"><button class="add" id="sp_set">Set</button></div></div></div>
 <div class="wkbars">${days.map(x=>{const v=D.steps[x]||0;return`<div><i style="height:${Math.min(100,v/g*80)}%;background:${v>=g?'var(--ok)':'var(--steps)'}"></i><small>${new Date(x+'T12:00').toLocaleDateString(undefined,{weekday:'narrow'})}</small></div>`}).join('')}</div>
 <label class="tog"><input type="checkbox" id="sp_ab" ${D.stepsAddBack?'checked':''}> Add step calories to my budget (skips walks/runs already logged)</label>
 <p class="mut" style="font-size:12px;margin:4px 0 0">Enter steps from your phone's health app; automatic counting will come with the app version.</p></div>`}
function stepGoalSheet(after){const g=D.stepGoal||10000,P=[5000,7500,10000,12000,15000];sheet(`<h2>Daily step goal</h2><div class="seg sgp">${P.map(n=>`<button data-sg="${n}" class="${g===n?'on':''}">${n/1000}k</button>`).join('')}</div><label>Custom</label><div class="row"><input id="sg_n" type="number" inputmode="numeric" min="500" step="500" value="${g}"><button class="btn" id="sg_go" style="flex:none">Save</button></div>`);
 const set=v=>{v=Math.round(+v);if(!(v>=100))return toast('Enter a goal of at least 100');D.stepGoal=v;save();close();(after||render)();toast('Step goal: '+v.toLocaleString())};
 document.querySelectorAll('[data-sg]').forEach(b=>b.onclick=()=>set(b.dataset.sg));$('#sg_go').onclick=()=>set($('#sg_n').value)}
function bindSteps(re){V.querySelectorAll('.sgedit').forEach(e=>e.onclick=ev=>{ev.stopPropagation();stepGoalSheet()});const d=cur,set=v=>{const was=(D.steps[d]||0)>=D.stepGoal;D.steps[d]=Math.max(0,Math.round(v));save();re();if(!was&&D.steps[d]>=D.stepGoal)toast('Step goal hit! 🎉')};
 V.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>set((D.steps[d]||0)+ +b.dataset.sp));
 const sb=$('#sp_set');if(sb)sb.onclick=()=>{const v=+$('#sp_n').value;if($('#sp_n').value!==''&&v>=0)set(v)};
 const ab=$('#sp_ab');if(ab)ab.onchange=e=>{D.stepsAddBack=e.target.checked;save();re()}}
function today(){const view=tab+'|'+cur,soft=lastView===view&&V.children.length,sy=window.scrollY;prevRA=soft?[...V.querySelectorAll('.ra')].map(r=>r.style.strokeDashoffset):null;lastView=view;const t=dayTotal(cur),b=budget(),ex=exTotal(cur),exc=(D.exAddBack?ex-stepCredit(cur):0)+stepCredit(cur),net=t.kcal-exc,left=b-net,g=macroGoal(),L=dayLog(cur),X=exList(cur);
 const top=Object.values(D.stats).sort((a,b)=>b.count-a.count||b.last-a.last);
 V.innerHTML=nudges()+`<div class="card datebar"><button id="prev" aria-label="Previous day">‹</button><b id="dlabel" class="tap">${nice(cur)} ▾</b>${cur!==logicalToday()?'<button id="toToday" class="pill todayb">Today</button>':''}<button id="next" aria-label="Next day" ${cur>=logicalToday()?'disabled':''}>›</button></div>
 ${heroRings(t,b,exc,left)}
 ${statGrid()}
 ${doneCard()}
 ${visMeals().map(m=>{const es=L[m.id]||[],s=sumEntries(es),chips=top.filter(x=>x.meal===m.id).slice(0,3);return`<div class="card meal"><h3><span>${esc(m.name)}</span><span><span class="mut">${r0(s.kcal)} cal</span> <button class="x" data-menu="${m.id}" aria-label="Meal options">⋯</button></span></h3>
 ${es.map(e=>`<div class="item" data-edit="${m.id}|${e.id}"><div>${esc(e.food.name)}<small>${esc(amtLbl(e))}${e.food.brand?' · '+esc(e.food.brand):''}</small></div><b class="kc">${r0(e.kcal)}</b></div>`).join('')}
 ${!es.length&&chips.length?`<div class="chips">${chips.map(c=>`<button data-chip="${m.id}|${esc(fkey(c.food))}">+ ${esc(c.food.name)}</button>`).join('')}</div>`:''}
 <div class="row"><button class="add" data-add="${m.id}">+ Add food</button><button class="add qa" data-qa="${m.id}" aria-label="Quick calories">⚡ ${eU()==='kJ'?'kJ':'Cal'}</button><button class="add qa" data-scan="${m.id}" aria-label="Scan barcode">📷</button></div></div>`}).join('')}
 <div class="card"><h3 class="ch"><span>Nutrition</span><span class="mut tap" id="budTap">Budget ${fE(b)} ✎</span></h3><div id="goalsTap" class="mbars">${[['Protein',t.p,g.p,'var(--p)'],['Carbs',t.c,g.c,'var(--c)'],['Fat',t.f,g.f,'var(--f)'],['Fiber',t.fb,D.fiberGoal,'var(--fb)']].map(([n,v,gl,col])=>`<div class="macro"><div class="lbl"><span>${n}</span><span class="mut">${r0(v)} / ${r0(gl)} g</span></div><div class="bar"><i style="width:${Math.min(100,v/(gl||1)*100)}%;background:${col}"></i></div></div>`).join('')}</div>${tips(t,g,b)}</div>
 ${stepsCard()}
 ${waterCard()}
 <div class="card meal"><h3><span>Exercise</span><span class="mut">${r0(ex)} cal</span></h3>
 ${X.map(e=>`<div class="item" ${e.gym?'':`data-ex="${e.id}"`}><div class="exli">${exIcon(e.gym?{cat:'free',name:''}:findEx(e.name),30)}<div>${esc(e.name)}${e.min?`<small>${e.min} min${e.dist?' · '+fD(e.dist):''}</small>`:''}</div></div><b class="exk">${e.gym?r0(e.kcal)+' cal':kcalTxt(e)}</b></div>`).join('')}<button class="add" id="exAdd">+ Add exercise</button></div>
 <div class="card"><label style="margin-top:0">📝 Notes for the day</label><textarea id="dayNote" rows="2" placeholder="How did today go?">${esc(D.notes[cur]||'')}</textarea><button class="btn alt" id="copyDay">📋 Copy yesterday's food to ${nice(cur)}</button></div>`;
 V.classList.toggle('noanim',!!soft);animRings();pageTitle();if(soft)window.scrollTo(0,sy);
 $('#prev').onclick=()=>{cur=addDays(cur,-1);today()};$('#next').onclick=()=>{if(cur<logicalToday()){cur=addDays(cur,1);today()}};$('#toToday')&&($('#toToday').onclick=()=>{cur=logicalToday();today()});
 $('#dlabel').onclick=calPicker;bindDone();$('#goalsTap').onclick=goalsSheet;
 V.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>openAdd(b.dataset.add));
 V.querySelectorAll('[data-qa]').forEach(b=>b.onclick=()=>quickAdd(b.dataset.qa));
 V.querySelectorAll('[data-scan]').forEach(b=>b.onclick=()=>scan(b.dataset.scan));
 V.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{const[m,...k]=b.dataset.chip.split('|'),st=D.stats[k.join('|')];if(!st)return;addEntry(m,entryFrom(st.food,st.ui,st.qty));render();toast('Added '+st.food.name)});
 V.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>mealMenu(b.dataset.menu));
 V.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const[m,id]=b.dataset.edit.split('|');editEntry(m,id)});
 V.querySelectorAll('[data-cup]').forEach(b=>b.onclick=()=>waterTap(+b.dataset.cup));
 bindSteps(today);
 V.querySelectorAll('[data-go]').forEach(c=>c.onclick=()=>{const k=c.dataset.go;if(k==='gym')return go('gym');const el=k==='protein'?$('#goalsTap'):k==='water'?V.querySelector('.water'):V.querySelector('.stepsc');el&&el.scrollIntoView({behavior:'smooth',block:'center'})});
 $('#copyDay').onclick=()=>{const y=D.log[addDays(cur,-1)]||{};let n=0;Object.entries(y).forEach(([m,es])=>es.forEach(e=>{addEntry(m,{...e,id:uid()});n++}));if(!n)return toast('Nothing logged the day before');render();toast('Copied '+n+' item'+(n>1?'s':''))};
 $('#dayNote').onchange=e=>{const v=e.target.value.trim();if(v)D.notes[cur]=v;else delete D.notes[cur];save()};
 $('#budTap').onclick=e=>{e.stopPropagation();budgetHome()};$('#exAdd').onclick=()=>exSheet();
 V.querySelectorAll('[data-ex]').forEach(el=>el.onclick=()=>exSheet(el.dataset.ex))}
function goalsSheet(){const g=macroGoal();sheet(`<h2>Daily goals</h2><p class="mut" style="margin-top:0">Defaults: 30/40/30 split of your calories, 28 g fiber, 64 oz water.</p>
 <div class="row"><div><label>Protein g</label><input id="gl_p" type="number" value="${r0(g.p)}"></div><div><label>Carbs g</label><input id="gl_c" type="number" value="${r0(g.c)}"></div><div><label>Fat g</label><input id="gl_f" type="number" value="${r0(g.f)}"></div></div>
 <div class="row"><div><label>Fiber g</label><input id="gl_fb" type="number" value="${D.fiberGoal}"></div><div><label>Water oz</label><input id="gl_w" type="number" value="${D.waterGoal}"></div></div><label>Daily steps</label><input id="gl_st" type="number" inputmode="numeric" value="${D.stepGoal||10000}">
 <button class="btn" id="gl_go">Save goals</button><button class="btn alt" id="gl_rs">Reset to defaults</button><button class="btn alt" onclick="close()">Cancel</button>`);
 $('#gl_go').onclick=()=>{D.macroGrams={p:+$('#gl_p').value||0,c:+$('#gl_c').value||0,f:+$('#gl_f').value||0};D.fiberGoal=+$('#gl_fb').value||28;D.waterGoal=+$('#gl_w').value||64;D.stepGoal=Math.max(100,+$('#gl_st').value||10000);save();close();render();toast('Goals saved')};
 $('#gl_rs').onclick=()=>{D.macroGrams=null;D.fiberGoal=28;D.waterGoal=64;D.stepGoal=10000;save();close();render()}}
const MET=[['Other',5]];
const curLb=()=>D.weights.length?[...D.weights].sort((a,b)=>a.date<b.date?-1:1).pop().lb:(D.profile?.weight||180);
/* conservative NET burn: (MET-1) × kg × hours, rounded to nearest 5 */
const estKcal=(met,min)=>Math.round(Math.max(0,met-1)*curLb()*0.453592*min/60/5)*5;
const kcalTxt=e=>e.est?`~${r0(e.kcal)} cal <small class="estl">(estimate)</small>`:`${r0(e.kcal)} cal`;
const allEx=()=>[...(D.exCustom||[]).map(x=>({...x,custom:1})),...EXLIB];
const findEx=n=>allEx().find(x=>x.name.toLowerCase()===String(n||'').toLowerCase().trim());
const exMin=x=>x.type==='s'||'sets' in x&&!('min' in x)?Math.max(1,(+x.sets||3))*3:+x.min||0;
function pushRecent(n){D.exRecent=[n,...(D.exRecent||[]).filter(x=>x!==n)].slice(0,8)}
const EXSYN={bike:['cycl','bike','spin'],bicycle:['cycl','bike'],cycle:['cycl','bike','spin'],walk:['walk','treadmill walk','hik'],treadmill:['treadmill'],run:['run','jog','treadmill run'],jog:['jog','run'],lift:['press','curl','row','squat','deadlift'],weights:['press','curl','row','squat'],row:['row'],swim:['swim','water'],climb:['climb','stair'],stairs:['stair'],stepper:['stair'],abs:['crunch','plank','sit-up','leg raise','ab '],core:['plank','crunch','ab '],chest:['chest','bench','pec','push-up','fly'],back:['row','pulldown','pull-up','back','deadlift'],legs:['leg','squat','lunge','calf','hip'],arms:['curl','tricep','dip'],shoulders:['shoulder','overhead','lateral','delt'],cardio:['treadmill','elliptical','bike','row','stair'],hike:['hik'],ski:['ski'],board:['board'],dance:['dance','zumba'],box:['box'],kayak:['kayak','canoe','paddle'],yard:['yard','mow','garden','shovel'],lawn:['mow']};
function exScore(x,q){const n=x.name.toLowerCase();if(!q)return 1;if(n===q)return 1000;let s=0;
 if(n.startsWith(q))s=900;else if(n.split(/[\s\-\/(]+/).some(w=>w.startsWith(q)))s=800;else if(n.includes(q))s=600;
 for(const[k,v]of Object.entries(EXSYN))if(k.startsWith(q)||(q.length>=3&&q.startsWith(k)))if(v.some(t=>n.includes(t)))s=Math.max(s,500-v.findIndex(t=>n.includes(t))*10);
 if(!s&&q.length>=2){let i=0;for(const ch of n)if(ch===q[i])i++;if(i===q.length)s=200-n.length;}
 if(!s&&q.length>=3){const ws=n.split(/\s+/);const lev=(A,B)=>{const d=[...Array(B.length+1).keys()];for(let i=1;i<=A.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=B.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(A[i-1]===B[j-1]?0:1));p=t}}return d[B.length]};if(ws.some(w=>lev(q,w.slice(0,q.length+1))<=1))s=150}
 return s+((D.exFav||[]).includes(x.name)?40:0)+((D.exRecent||[]).includes(x.name)?20:0)}
const EXEMO=[[/treadmill/i,'🏃'],[/ellip/i,'⛷️'],[/stair|step/i,'🪜'],[/row(ing)? machine|canoe|kayak|paddle/i,'🚣'],[/bike|cycl|spin/i,'🚴'],[/hik/i,'🥾'],[/walk/i,'🚶'],[/run|jog/i,'🏃'],[/swim|water/i,'🏊'],[/yoga|stretch|pilates|barre/i,'🧘'],[/dance|zumba/i,'💃'],[/box/i,'🥊'],[/climb/i,'🧗'],[/golf/i,'⛳'],[/tennis|pickle/i,'🎾'],[/basket/i,'🏀'],[/soccer/i,'⚽'],[/volley/i,'🏐'],[/snowboard/i,'🏂'],[/ski/i,'⛷️'],[/skate/i,'🛹'],[/surf/i,'🏄'],[/fish/i,'🎣'],[/yard|mow|garden|shovel/i,'🌿'],[/push-up|pull-up|\bchin|\bdips?\b|plank|burpee|crunch|sit-up|squats|jumping|mountain climb|lunge|bridge|raise|wall sit/i,'🤸'],[/hiit|crossfit|bootcamp/i,'🔥']];
const exEmoji=x=>{if(!x)return null;const m=EXEMO.find(r=>r[0].test(x.name));return m?m[1]:x.cat==='mach'?null:x.cat==='free'?'🏋️':null};
const exIcon=(x,sz)=>{const e=exEmoji(x);if(!e)return exIco(x&&x.cat,sz);const c=EXCATS.find(c=>c.id===(x&&x.cat))||{col:'#8e8e93'};return `<span class="exico emo" style="--c:${c.col}${sz?';width:'+sz+'px;height:'+sz+'px':''}">${e}</span>`};
const myEx=()=>{const s=new Set([...(D.exCustom||[]).map(x=>x.name),...(D.exFav||[]),...(D.exRecent||[])]);Object.values(D.exercise||{}).forEach(a=>a.forEach(e=>s.add(e.name)));(D.workouts||[]).forEach(w=>w.items.forEach(i=>s.add(i.name)));return[...s].map(findEx).filter(Boolean).sort((p,q)=>p.name.localeCompare(q.name))};
function exPicker(cb,back){D.exFav=D.exFav||[];let cat='all',q='',top=null,ptab=myEx().length?'my':'all';
 sheet(`<div class="shhead"><button class="x" id="xp_bk" aria-label="Back">‹</button><h2>Exercise</h2><button class="linkbtn" id="xp_new2">Create</button></div><div class="seg xptabs" id="xp_t"><button data-pt="my">My Exercises</button><button data-pt="all">All Exercises</button></div>
 <div class="xpsearch"><input id="xp_q" type="search" enterkeyhint="go" placeholder="Search ${EXLIB.length}+ exercises — try bike, lat, walk" autocomplete="off" autocapitalize="off"></div>
 <div class="segscroll" id="xp_c" ${myEx().length?'style="display:none"':''}><button data-c="all" class="on">All</button>${EXCATS.map(c=>`<button data-c="${c.id}">${c.name}</button>`).join('')}<button data-c="custom">Custom</button></div>
 <div id="xp_l" class="xplist"></div><button class="btn alt" id="xp_new">+ Custom exercise</button>`);
 const row=x=>`<div class="xprow" data-n="${esc(x.name)}">${exIcon(x)}<div class="xpn">${esc(x.name)}<small>${(EXCATS.find(c=>c.id===x.cat)||{name:'Custom'}).name}</small></div><button class="star ${D.exFav.includes(x.name)?'on':''}" data-st="${esc(x.name)}" aria-label="Favorite">★</button></div>`;
 const list=()=>{const qq=q.toLowerCase(),MY=myEx(),A=ptab==='my'&&!qq?MY:allEx(),myN=new Set(MY.map(x=>x.name));let h='';
  if(ptab==='my'&&!qq){let ltr='';A.forEach(x=>{const c=x.name[0].toUpperCase();if(c!==ltr){ltr=c;h+=`<div class="xph">${c}</div>`}h+=row(x)});if(!A.length)h='<div class="empty"><p>Exercises you log or create show up here.</p></div>'}
  else if(!qq&&cat==='all'){const F=D.exFav.map(findEx).filter(Boolean),R=(D.exRecent||[]).filter(n=>!D.exFav.includes(n)).map(findEx).filter(Boolean);
   if(F.length)h+=`<div class="xph">Favorites</div>${F.map(row).join('')}`;if(R.length)h+=`<div class="xph">Recent</div>${R.map(row).join('')}`;
   EXCATS.forEach(c=>h+=`<div class="xph">${c.name}</div>${A.filter(x=>x.cat===c.id&&!x.custom).map(row).join('')}`);
   const C=A.filter(x=>x.custom);if(C.length)h+=`<div class="xph">Custom</div>${C.map(row).join('')}`}
  else{const L=A.filter(x=>cat==='all'||(cat==='custom'?x.custom:x.cat===cat)).map(x=>[exScore(x,qq)+(ptab==='my'&&myN.has(x.name)?60:0),x]).filter(z=>z[0]>0).sort((p,r)=>r[0]-p[0]).map(z=>z[1]);top=L[0];h=L.slice(0,40).map((x,i)=>row(x).replace('class="xprow"',i?'class="xprow"':'class="xprow top"')).join('');if(q&&!L.some(x=>x.name.toLowerCase()===qq))h+=`<button class="xpadd" id="xp_mk">+ Add “${esc(q)}” as custom</button>`;if(!L.length)h=`<button class="xpadd only" id="xp_mk">+ Add “${esc(q)}” as custom</button><p class="hint" style="text-align:center">Saved to your library for next time.</p>`}
  const l=$('#xp_l');l.innerHTML=h;
  l.querySelectorAll('.xprow').forEach(r=>r.onclick=e=>{if(e.target.closest('.star'))return;cb(findEx(r.dataset.n))});
  l.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{const n=b.dataset.st,i=D.exFav.indexOf(n);i<0?D.exFav.unshift(n):D.exFav.splice(i,1);save();b.classList.toggle('on',i<0);if(!q&&cat==='all')list()});
  if($('#xp_mk'))$('#xp_mk').onclick=quick};
 const quick=()=>{const n=q.replace(/^./,c=>c.toUpperCase());if(findEx(n))return cb(findEx(n));const x={name:n,met:3.5,type:/run|walk|bike|swim|hik|row|ride|skat|paddl|ski/i.test(n)?'c':'s',cat:'',custom:1};x.cat=x.type==='c'?'out':'free';D.exCustom=[x,...(D.exCustom||[])];save();toast('Added to your library');cb(x)};
 $('#xp_q').oninput=e=>{q=e.target.value.trim();list()};$('#xp_q').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(q&&top)cb(top);else if(q)quick()}};
 $('#xp_c').querySelectorAll('button').forEach(b=>b.onclick=()=>{cat=b.dataset.c;$('#xp_c').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));list()});
 $('#xp_t').querySelectorAll('button').forEach(b=>{b.classList.toggle('on',b.dataset.pt===ptab);b.onclick=()=>{ptab=b.dataset.pt;$('#xp_t').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));$('#xp_c').style.display=ptab==='all'?'':'none';list()}});$('#xp_new2').onclick=()=>customEx(q,cb,()=>exPicker(cb,back));$('#xp_bk').onclick=()=>back?back():close();$('#xp_new').onclick=()=>customEx(q,cb,()=>exPicker(cb,back));list();setTimeout(()=>$('#xp_q')&&$('#xp_q').focus(),30);$('#xp_q').focus()}
function customEx(name,cb,back){sheet(`<div class="shhead"><button class="x" id="cx_bk">‹</button><h2>Custom exercise</h2><span></span></div>
 <label>Name</label><input id="cx_n" value="${esc(name)}" placeholder="e.g. Battle ropes">
 <label>Category</label><select id="cx_c">${EXCATS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
 <label>Logged as</label><div class="seg" id="cx_t"><button data-t="s">Sets · reps · weight</button><button data-t="c">Time · distance</button></div>
 <label>Intensity (MET)</label><select id="cx_m">${[[3,'Light — 3'],[5,'Moderate — 5'],[7,'Hard — 7'],[9,'Very hard — 9']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
 <p class="hint">Calories = MET × your weight (kg) × hours.</p><button class="btn" id="cx_go">Save exercise</button>`);
 let t='s';const st=()=>$('#cx_t').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));st();$('#cx_m').value=5;
 $('#cx_c').onchange=e=>{t=EXCATS.find(c=>c.id===e.target.value).t;st()};$('#cx_t').querySelectorAll('button').forEach(b=>b.onclick=()=>{t=b.dataset.t;st()});
 $('#cx_bk').onclick=back;$('#cx_go').onclick=()=>{const n=$('#cx_n').value.trim();if(!n)return toast('Name your exercise');if(findEx(n)&&!findEx(n).custom)return cb(findEx(n));
  D.exCustom=(D.exCustom||[]).filter(x=>x.name.toLowerCase()!==n.toLowerCase());const x={name:n,met:+$('#cx_m').value,type:t,cat:$('#cx_c').value};D.exCustom.unshift(x);save();toast('Saved to your library');cb(x)}}
const INTS=[['l','Light',.75],['m','Moderate',1],['v','Vigorous',1.25]];
const intF=k=>(INTS.find(x=>x[0]===k)||INTS[1])[2];
function wheel(el,n,v,onv,fmt){const H=40;el.innerHTML=`<div class="whpad"></div>${[...Array(n)].map((_,i)=>`<div class="whi" data-v="${i}">${fmt?fmt(i):i}</div>`).join('')}<div class="whpad"></div>`;
 let cur=v,raf=0,lock=Date.now()+300;const mark=()=>el.querySelectorAll('.whi').forEach((x,i)=>x.classList.toggle('on',i===cur));
 el.scrollTop=v*H;mark();el.onscroll=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(Date.now()<lock)return;const nv=Math.max(0,Math.min(n-1,Math.round(el.scrollTop/H)));if(nv!==cur){cur=nv;mark();onv(nv)}})};
 el.querySelectorAll('.whi').forEach(x=>x.onclick=()=>el.scrollTo({top:+x.dataset.v*H,behavior:'smooth'}));
 return{set:(nv,sm=true)=>{cur=nv;mark();lock=Date.now()+(sm?600:100);el.scrollTo({top:nv*H,behavior:sm?'smooth':'auto'})},get:()=>cur}}
/* Simple exercise sheet: name, intensity, duration wheels, live estimate. opts.gym → logs into today's gym session */
function exSheet(id,pre,onSaved,opts={}){const gymMode=!!opts.gym,day=opts.day||cur;
 const arr=gymMode?null:(D.exercise[day]=D.exercise[day]||[]),old=gymMode?opts.item:arr.find(x=>x.id===id),e={name:'',min:30,int:'m',...(old||{}),...(pre||{})};
 const L=findEx(e.name)||(e.name?{name:e.name,met:3.5,type:'c',cat:''}:null);if(!L)return exPicker(x=>exSheet(id,{...e,name:x.name},onSaved,opts),close);
 let min=e.min||30,int=e.int||'m',typed=!!old&&!old.est&&!pre,showSR=!!(e.sets||e.reps||e.wt);
 const kc=()=>estKcal(L.met*intF(int),min);
 sheet(`<div class="exhead"><button class="pickbtn" id="e_pick">${exIcon(L)}<span>${esc(L.name)}<small>Tap to change</small></span><b>›</b></button></div>
 <label>Intensity</label><div class="seg" id="e_int">${INTS.map(([k,n])=>`<button data-i="${k}" class="${int===k?'on':''}">${n}</button>`).join('')}</div>
 <label>Duration <span class="mut" style="font-weight:400">(minutes)</span></label><div class="chips mchips">${[10,15,20,30,45,60].map(m=>`<button data-mc="${m}">${m}</button>`).join('')}</div>
 <div class="wheels"><div class="wcol"><div class="wh" id="wh_h"></div><span>hours</span></div><div class="wcol"><div class="wh" id="wh_m"></div><span>mins</span></div><div class="whsel"></div></div>
 <div class="burn"><b id="e_burn" data-kj="1"></b><small>${eU()==='kJ'?'kJ':'calories'} burned (estimate) · not added to your budget</small><button class="linkbtn" id="e_adj">Adjust</button><input id="e_k" type="number" inputmode="numeric" class="hidden" placeholder="Your number${eU()==='kJ'?' (kJ)':''}"></div>
 <button class="linkbtn" id="e_srt">${showSR?'− Hide sets & reps':'+ Add sets & reps (optional)'}</button>
 <div id="e_sr" class="row ${showSR?'':'hidden'}"><div><small>Sets</small><input id="e_s" type="number" inputmode="numeric" value="${e.sets||''}"></div><div><small>Reps</small><input id="e_r" type="number" inputmode="numeric" value="${e.reps||''}"></div><div><small>Weight lb</small><input id="e_w" type="number" inputmode="decimal" value="${e.wt||''}"></div></div>
 <button class="btn" id="e_go">Save</button><button class="btn alt" id="e_more">Save & add another</button>${old?'<button class="btn alt" id="e_del" style="color:var(--bad)">Remove</button>':''}`);
 const kin=()=>{const v=+$('#e_k').value;return eU()==='kJ'?Math.round(v/4.184):v};const upd=()=>{delete $('#e_burn').dataset.kj;$('#e_burn').textContent=typed&&$('#e_k').value?(+$('#e_k').value).toLocaleString():'~'+eN(kc()).toLocaleString();
  document.querySelectorAll('[data-mc]').forEach(b=>b.classList.toggle('on',+b.dataset.mc===min))};
 const hW=wheel($('#wh_h'),6,Math.floor(min/60),h=>{min=h*60+mW.get();upd()}),mW=wheel($('#wh_m'),60,min%60,m=>{min=hW.get()*60+m;upd()},m=>String(m).padStart(2,'0'));
 if(typed){$('#e_k').classList.remove('hidden');$('#e_k').value=eU()==='kJ'?Math.round(e.kcal*4.184):e.kcal}
 $('#e_int').querySelectorAll('button').forEach(b=>b.onclick=()=>{int=b.dataset.i;$('#e_int').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));upd()});
 document.querySelectorAll('[data-mc]').forEach(b=>b.onclick=()=>{min=+b.dataset.mc;hW.set(Math.floor(min/60));mW.set(min%60);upd()});
 $('#e_adj').onclick=()=>{typed=true;const k=$('#e_k');k.classList.remove('hidden');k.value=k.value||(eU()==='kJ'?Math.round(kc()*4.184):kc());k.focus();k.select()};$('#e_k').oninput=upd;
 $('#e_srt').onclick=()=>{showSR=!showSR;$('#e_sr').classList.toggle('hidden',!showSR);$('#e_srt').textContent=showSR?'− Hide sets & reps':'+ Add sets & reps (optional)'};
 $('#e_pick').onclick=()=>{const s={...e,min,int};exPicker(x=>exSheet(id,{...s,name:x.name},onSaved,opts),()=>exSheet(id,s,onSaved,opts))};
 const build=()=>{const k=typed&&+$('#e_k').value?kin():kc();const ne={id:old?.id||uid(),name:L.name,min,int,kcal:k};if(!(typed&&+$('#e_k').value))ne.est=1;
  if(showSR){const s=+$('#e_s').value,r=+$('#e_r').value,w=+$('#e_w').value;if(s)ne.sets=s;if(r)ne.reps=r;if(w)ne.wt=w}return ne};
 const commit=()=>{if(!min)return toast('Pick a duration'),null;const ne=build();pushRecent(L.name);
  if(gymMode)gymLog(day,ne,old);else{if(old)arr[arr.indexOf(old)]=ne;else arr.push(ne)}save();return ne};
 $('#e_go').onclick=()=>{const ne=commit();if(!ne)return;close();render();onSaved&&onSaved(ne)};
 $('#e_more').onclick=()=>{const ne=commit();if(!ne)return;render();toast(`Logged ${ne.name} · ~${ne.kcal} cal`);exPicker(x=>exSheet(null,{name:x.name},onSaved,{...opts,item:null}),close)};
 if(old)$('#e_del').onclick=()=>{if(gymMode)gymLog(day,null,old);else arr.splice(arr.indexOf(old),1);save();close();render()};upd()}
/* gym session: one workout per day holding simple items */
function gymLog(day,ne,old){let w=D.workouts.find(x=>x.date===day&&x.quick);if(!w){w={id:uid(),ts:Date.now(),date:day,type:'Gym',items:[],notes:'',min:0,kcal:0,quick:1,est:1};D.workouts.push(w)}
 const i=old?w.items.findIndex(x=>x.id===old.id):-1;if(ne){if(i>=0)w.items[i]=ne;else w.items.push(ne)}else if(i>=0)w.items.splice(i,1);
 w.min=w.items.reduce((s,x)=>s+(+x.min||0),0);w.kcal=w.items.reduce((s,x)=>s+(+x.kcal||0),0);w.est=w.items.some(x=>x.est)?1:0;
 if(!w.items.length)D.workouts=D.workouts.filter(x=>x!==w);syncGymDay(day)}

function quickAdd(mealId){sheet(`<h2>Quick add</h2><label>Meal</label><select id="q_m">${visMeals().map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
 <label>Name (optional)</label><input id="q_n" placeholder="Quick add"><label>${eU()==='kJ'?'Kilojoules':'Calories'}</label><input id="q_k" type="number" inputmode="numeric" class="bigin" autofocus>
 <div class="row"><div><label>Protein g</label><input id="q_p" type="number"></div><div><label>Carbs g</label><input id="q_c" type="number"></div><div><label>Fat g</label><input id="q_f" type="number"></div><div><label>Fiber g</label><input id="q_fb" type="number"></div></div>
 <button class="btn" id="q_go">Add</button><button class="btn alt" onclick="close()">Cancel</button>`);
 if(mealId)$('#q_m').value=mealId;
 $('#q_go').onclick=()=>{const k=eU()==='kJ'?Math.round(+$('#q_k').value/4.184):+$('#q_k').value;if(!k)return toast('Enter calories');
  const f={src:'quick',name:$('#q_n').value||'Quick add',n:{kcal:k,p:+$('#q_p').value||0,c:+$('#q_c').value||0,f:+$('#q_f').value||0,fb:+$('#q_fb').value||0},units:[{label:'serving',mult:1}]};
  f.ref=uid();addEntry($('#q_m').value,entryFrom(f,0,1));close();render()};setTimeout(()=>$('#q_k')?.focus(),50)}
function mealMenu(mid){const m=D.meals.find(x=>x.id===mid);sheet(`<h2>${esc(m.name)}</h2>
 <button class="btn alt" id="mm_copy">Copy yesterday's ${esc(m.name)}</button><button class="btn alt" id="mm_save">Save this meal for later</button>
 <button class="btn alt" id="mm_q">Quick add calories</button><button class="btn alt" id="mm_clr">Clear this meal</button><button class="btn alt" onclick="close()">Cancel</button>`);
 $('#mm_copy').onclick=()=>{const y=(D.log[addDays(cur,-1)]||{})[mid]||[];if(!y.length)return toast('Nothing logged yesterday');
  y.forEach(e=>addEntry(mid,{...e,id:uid()}));close();render();toast('Copied '+y.length+(y.length>1?' items':' item'))};
 $('#mm_save').onclick=()=>{const es=dayLog(cur)[mid]||[];if(!es.length)return toast('Nothing to save');const n=prompt('Name this meal',m.name);if(!n)return;
  D.saved.push({id:uid(),name:n,items:es.map(e=>({...e}))});save();close();toast('Saved “'+n+'”')};
 $('#mm_q').onclick=()=>quickAdd(mid);
 $('#mm_clr').onclick=()=>{if(confirm('Clear '+m.name+'?')){delete dayLog(cur)[mid];save();close();render()}}}
function editEntry(mid,id){const es=dayLog(cur)[mid],e=es.find(x=>x.id===id);
 servingSheet(e.food,e.ui,e.qty,mid,(ne,newMeal)=>{es.splice(es.indexOf(e),1);ne.id=e.id;(dayLog(cur)[newMeal]=dayLog(cur)[newMeal]||[]).push(ne);save();render()},
  ()=>{es.splice(es.indexOf(e),1);save();close();render()})}

/* ---------- add food / search ---------- */
let addTab='recent';
const myFoods=()=>{const m=new Map();Object.values(D.stats).forEach(s=>m.set(fkey(s.food),{food:s.food,count:s.count,last:s.last,ui:s.ui,qty:s.qty}));D.custom.forEach(f=>{const k=fkey(f);if(!m.has(k))m.set(k,{food:f,count:0,last:0,ui:0,qty:1})});return[...m.values()].sort((a,b)=>b.count-a.count||b.last-a.last)};
function openAdd(mid){sheet(`<h2>Add to ${esc(D.meals.find(m=>m.id===mid).name)}</h2>
 <div class="row"><input id="s_q" type="search" placeholder="Search foods…" enterkeyhint="search"><button class="btn sm" id="s_scan" style="flex:none">📷 Scan</button></div>
 <div class="seg" id="s_tabs">${[['recent','Recent'],['fav','★ Favorites'],['my','My Foods'],['meals','Saved meals']].map(([k,v])=>`<button data-t="${k}" class="${k===addTab?'on':''}">${v}</button>`).join('')}</div>
 <div id="s_res"></div><button class="btn alt" id="s_new">+ Create a custom food</button><button class="btn alt" onclick="close()">Done</button>`);
 const showTab=()=>{$('#s_tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.t===addTab));listLocal(mid)};
 $('#s_tabs').onclick=e=>{if(e.target.dataset.t){addTab=e.target.dataset.t;showTab()}};
 let tmo;$('#s_q').oninput=e=>{clearTimeout(tmo);const q=e.target.value.trim();if(!q)return showTab();tmo=setTimeout(()=>search(q,mid),800)};
 $('#s_q').onkeydown=e=>{if(e.key==='Enter'){clearTimeout(tmo);search(e.target.value.trim(),mid)}};
 $('#s_scan').onclick=()=>scan(mid);$('#s_new').onclick=()=>customFood(mid);showTab()}
const resRow=(f,extra='')=>`<div class="res" data-i>${esc(f.name)} ${extra}<br><small>${f.brand?esc(f.brand)+' · ':''}${r0(f.n.kcal*f.units[0].mult)} cal per ${esc(f.units[0].label)}</small></div>`;
function bindRes(list,mid,onpick){$('#s_res').querySelectorAll('[data-i]').forEach((el,i)=>el.onclick=()=>onpick(list[i]))}
function listLocal(mid){let html='',list=[];const S=Object.values(D.stats);
 if(addTab==='recent'||addTab==='freq'){list=S.sort((a,b)=>addTab==='recent'?b.last-a.last:b.count-a.count).slice(0,30);
  html=list.map(s=>resRow(s.food,addTab==='freq'?`<small class="mut">· ${s.count}×</small>`:'')).join('')||'<p class="mut">Foods you log will show up here.</p>';
  $('#s_res').innerHTML=html;bindRes(list,mid,s=>pick(s.food,mid,s.ui,s.qty))}
 else if(addTab==='fav'){list=D.fav.map(k=>D.stats[k]).filter(Boolean);$('#s_res').innerHTML=list.map(s=>resRow(s.food,'<small class="mut">★</small>')).join('')||'<p class="mut">Tap ☆ on any food to make it a favorite.</p>';bindRes(list,mid,s=>pick(s.food,mid,s.ui,s.qty))}
 else if(addTab==='my'){list=myFoods();$('#s_res').innerHTML=list.map(s=>resRow(s.food,`<small class="mut">· ${s.count}× ${s.food.barcode||s.food.src==='off'?'· UPC '+esc(s.food.barcode||s.food.ref):''}</small>`)).join('')||'<p class="mut">Foods you log, scan or create show up here, most used first.</p>';bindRes(list,mid,s=>pick(s.food,mid,s.ui,s.qty))}
 else{list=D.saved;$('#s_res').innerHTML=list.map(m=>{const s=sumEntries(m.items);return`<div class="res" data-i>${esc(m.name)}<br><small>${m.items.length} items · ${r0(s.kcal)} cal</small></div>`}).join('')||'<p class="mut">Save a meal from the ⋯ menu on any meal, or build one in Settings.</p>';
  bindRes(list,mid,m=>{m.items.forEach(e=>addEntry(mid,{...e,id:uid()}));close();render();toast('Added '+m.name)})}}
const pick=(f,mid,ui=0,qty=1)=>servingSheet(f,ui,qty,mid,(e,m)=>{addEntry(m,e);render();toast('Added '+f.name)});

function usdaFood(x){const g=id=>{const n=(x.foodNutrients||[]).find(n=>n.nutrientId===id||n.nutrientNumber===String(id));return n?n.value:0};
 let kcal=g(1008)||g(208)||g(2047)||g(2048);const n={kcal,p:g(1003),c:g(1005),f:g(1004),fb:g(1079)||g(291)};
 const units=[];if(x.servingSize&&x.dataType==='Branded'){const gu=(x.servingSizeUnit||'g').toLowerCase();units.push({label:(x.householdServingFullText?x.householdServingFullText.toLowerCase()+' ('+x.servingSize+gu+')':x.servingSize+gu),mult:x.servingSize/100})}
 (x.foodMeasures||[]).filter(m=>m.gramWeight&&m.disseminationText&&m.disseminationText!=='Quantity not specified').slice(0,4).forEach(m=>units.push({label:m.disseminationText,mult:m.gramWeight/100}));
 units.push({label:'100 g',mult:1},{label:'1 oz',mult:.2835},{label:'1 g',mult:.01});
 const nm=x.description.charAt(0)+x.description.slice(1).toLowerCase();
 return{src:'usda',ref:x.fdcId,name:x.dataType==='Branded'?nm.replace(/\b\w/g,c=>c.toUpperCase()):x.description,brand:x.brandName||x.brandOwner||'',n,units}}
function offFood(p){const N=p.nutriments||{};const kcal=N['energy-kcal_100g']??(N.energy_100g?N.energy_100g/4.184:0);
 const n={kcal:+kcal||0,p:+N.proteins_100g||0,c:+N.carbohydrates_100g||0,f:+N.fat_100g||0,fb:+N.fiber_100g||0};const units=[];
 const sq=parseFloat(p.serving_quantity);if(sq)units.push({label:p.serving_size||sq+' g',mult:sq/100});
 units.push({label:'100 g',mult:1},{label:'1 oz',mult:.2835},{label:'1 g',mult:.01});
 return{src:'off',ref:p.code,barcode:p.code,name:p.product_name||'Unnamed product',brand:(p.brands||'').split(',')[0],n,units}}
const SC={};
async function search(q,mid){if(!q)return;const R=$('#s_res');R.innerHTML='<p class="mut">Searching…</p>';
 $('#s_tabs').querySelectorAll('button').forEach(b=>b.classList.remove('on'));
 const loc=[...D.custom,...Object.values(D.stats).map(s=>s.food)].filter(f=>f.name.toLowerCase().includes(q.toLowerCase()));
 let list=[],err='';
 const ck='q:'+q.toLowerCase();SC[ck]=SC[ck]||null;
 try{if(SC[ck])list=SC[ck];else{const r=await tfetch('https://api.nal.usda.gov/fdc/v1/foods/search?api_key='+(D.usdaKey||APP_USDA_KEY||'DEMO_KEY')+'&pageSize=25&dataType=Foundation,SR%20Legacy,Branded&query='+encodeURIComponent(q));
  if(!r.ok)throw new Error(r.status===429?'limit':'usda');const j=await r.json();list=SC[ck]=(j.foods||[]).sort((a,b)=>(a.dataType==='Branded')-(b.dataType==='Branded')).map(usdaFood).filter(f=>f.n.kcal||f.n.p)}}catch(e){err=e.message}
 if(list.length<5){const ok='off:'+q.toLowerCase();if(SC[ok])list=list.concat(SC[ok]);else{let ps=null;const f='code,product_name,brands,nutriments,serving_size,serving_quantity';
  for(const u of['https://world.openfoodfacts.org/cgi/search.pl?json=1&page_size=20&fields='+f+'&search_terms='+encodeURIComponent(q),'https://world.openfoodfacts.org/api/v2/search?page_size=20&fields='+f+'&search_terms='+encodeURIComponent(q)]){try{const r=await tfetch(u);if(!r.ok)continue;const j=await r.json();ps=(j.products||[]).filter(p=>p.product_name).map(offFood);break}catch(e){}}
  if(ps){SC[ok]=ps;list=list.concat(ps)}else err+=' off'}}
if($('#s_q')?.value.trim()!==q)return;
 const seen=new Set(),all=[...loc,...list].filter(f=>{const k=fkey(f);if(seen.has(k))return false;seen.add(k);return true});
 R.innerHTML=all.map(f=>resRow(f)).join('')||`<p class="mut">${!navigator.onLine?'You are offline. Search needs internet; your recent and custom foods still work.':err.includes('limit')?'The free food database is busy (hourly limit). Try again in a minute.':'No results.'}</p>`;
 bindRes(all,mid,f=>pick(f,mid))}
/* ---------- amounts: units + parsing ---------- */
const parseAmt=s=>{s=String(s||'').trim().replace(',','.').replace(/[½¼¾⅓⅔]/g,c=>({'½':' 1/2','¼':' 1/4','¾':' 3/4','⅓':' 1/3','⅔':' 2/3'})[c]).trim();if(!s)return 0;
 let m=s.match(/^(\d+)\s+(\d+)\/(\d+)$/);if(m)return +m[1]+m[2]/m[3];m=s.match(/^(\d*\.?\d+)\/(\d+)$/);if(m)return m[1]/m[2];return /^\d*\.?\d+$/.test(s)?+s:NaN};
const fmtAmt=q=>{const w=Math.floor(q),r=q-w,F=[[.5,'½'],[.25,'¼'],[.75,'¾']].find(([v])=>Math.abs(r-v)<.001);return F?(w?w+F[1]:F[1]):String(+q.toFixed(2))};
const sing=w=>/(ch|sh|x)es$/.test(w)?w.slice(0,-2):/(rr|tt|tr)ies$/.test(w)?w.slice(0,-3)+'y':/[^s]s$/.test(w)&&w.length>3?w.slice(0,-1):w;
const amtLbl=e=>{const u=(e.food.units[e.ui]||{}).label||'serving',q=e.qty;if(OLDGEN.test(u)||!/^[a-z][a-z .-]*$/i.test(u))return r1(q)+' × '+u;if(u==='g'||u==='oz'||u==='ml')return r1(q)+' '+u;return fmtAmt(q)+' '+(q>1&&!/s$/.test(u)&&!/^(tbsp|tsp|oz|serving size)$/.test(u)?(/(ch|sh|x)$/.test(u)?u+'es':u+'s'):u)};
const OLDGEN=/^(100 g|1 oz|1 g)$/;
function unitsFor(f){const gk=f.src==='custom'?(f.gpS?f.gpS:0):(f.src==='quick'?0:100),out=[],add=u=>{if(u.label&&!out.some(x=>x.label===u.label))out.push(u)};
 (f.units||[]).forEach((u,i)=>{if(OLDGEN.test(u.label)||['g','oz','ml'].includes(u.label))return;let L=u.label.trim();
  if(u.kind){add(u);return}
  const m=L.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s+([a-zA-Z][a-zA-Z .-]*?)(?:\s*\((.*)\))?$/);
  if(f.src==='custom'&&i===0){const nm=L.replace(/^1\s+/,'');add({label:nm||'serving',mult:u.mult,kind:'n'});if(nm!=='serving')add({label:'serving',mult:u.mult,kind:'s'});return}
  if(i===0){add({label:'serving',mult:u.mult,kind:'s',note:L})}
  if(m){const n=parseAmt(m[1])||1,w=m[2].trim().toLowerCase();if(!/^(g|grams?|oz|ml|serving)$/.test(w))add({label:n>1?sing(w):w,mult:u.mult/n,kind:'n'})}
  else if(i>0)add({label:L,mult:u.mult,kind:'n'})});
 if(!out.length)add({label:"serving",mult:1,kind:"s",note:gk===100?"100 g":""});
 const gw=gk||(f.units||[]).find(u=>u.label==='g')&&1/(f.units.find(u=>u.label==='g').mult);
 if(gw){add({label:'g',mult:1/gw,kind:'w'});add({label:'oz',mult:28.3495/gw,kind:'w'});if(/ml|drink|juice|milk|soda|water|beverage/i.test((f.units||[]).map(u=>u.label).join(' ')+' '+f.name))add({label:'ml',mult:1/gw,kind:'w'})}
 return out}
function servingSheet(f,ui,qty,mid,onSave,onDel){const L=unitsFor(f);let lbl=(f.units[ui]||f.units[0]||{}).label;
 if(!onDel){const st=D.stats[fkey(f)];if(st&&st.food.units[st.ui]){lbl=st.food.units[st.ui].label;qty=st.qty}}
 if(OLDGEN.test(lbl||''))lbl={'100 g':'g','1 oz':'oz','1 g':'g'}[lbl],qty=lbl==='g'&&(f.units[ui]||{}).label==='100 g'?qty*100:qty;
 if(!L.some(u=>u.label===lbl))lbl=L[0].label==='serving'?'serving':L[0].label;
 const sv=L.find(u=>u.kind==='s');
 sheet(`<h2>${esc(f.name)}</h2>${f.brand?`<div class="mut">${esc(f.brand)}</div>`:''}
 <div class="amtbox"><input id="v_q" class="amtin" inputmode="decimal" autocomplete="off" value="${fmtAmt(qty).replace('½',' 1/2').replace('¼',' 1/4').replace('¾',' 3/4').trim()}" aria-label="Amount"><div class="uchips" id="v_u">${L.map(u=>`<button class="uchip" data-l="${esc(u.label)}">${esc(u.label)}</button>`).join('')}</div></div>
 <div class="qchips">${[['1/2','½'],['1','1'],['1.5','1½'],['2','2']].map(([v,t])=>`<button data-q="${v}">${t}</button>`).join('')}</div>
 ${sv&&sv.note?`<div class="mut" style="font-size:13px;margin:2px 2px 0">1 serving = ${esc(sv.note)}</div>`:''}
 <div class="nutbox"><div><b id="v_k">0</b><span>cal</span></div><div><b id="v_p">0</b><span>protein</span></div><div><b id="v_c">0</b><span>carbs</span></div><div><b id="v_fb">0</b><span>fiber</span></div><div><b id="v_f">0</b><span>fat</span></div></div>
 <div class="row"><div style="flex:1"><label>Meal</label><select id="v_meal">${visMeals().map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div></div>
 <button class="btn" id="v_go">${onDel?'Save':'Add'}</button>${onDel?'<button class="btn alt" id="v_del" style="color:var(--bad)">Remove</button>':''}
 <button class="btn alt sm" id="v_fav" style="width:100%">${D.fav.includes(fkey(f))?'★ Favorite':'☆ Add to favorites'}</button><button class="btn alt" id="v_x">Cancel</button>`);
 $('#v_x').onclick=close;$('#v_meal').value=mid;
 $('#v_fav').onclick=()=>{const k=fkey(f),i=D.fav.indexOf(k);if(i<0){D.fav.push(k);if(!D.stats[k])D.stats[k]={food:{...f,units:L},count:0,last:Date.now(),ui:0,qty:1}}else D.fav.splice(i,1);save();$('#v_fav').textContent=D.fav.includes(k)?'★ Favorite':'☆ Add to favorites'};
 const f2={...f,units:L},ix=()=>Math.max(0,L.findIndex(u=>u.label===lbl)),q=()=>parseAmt($('#v_q').value);
 const upd=()=>{$('#v_u').querySelectorAll('.uchip').forEach(b=>b.classList.toggle('on',b.dataset.l===lbl));const a=q(),e=entryFrom(f2,ix(),a>0?a:0);
  const k=$('#v_k');delete k.dataset.kj;k.textContent=r0(e.kcal).toLocaleString();$('#v_k').nextSibling.textContent=eU()==='kJ'?'kJ':'cal';if(eU()==='kJ'){k.textContent=Math.round(e.kcal*4.184).toLocaleString();k.dataset.kj=1}
  $('#v_p').textContent=r1(e.p)+'g';$('#v_c').textContent=r1(e.c)+'g';$('#v_fb').textContent=r1(e.fb)+'g';$('#v_f').textContent=r1(e.f)+'g';$('#v_q').classList.toggle('bad',!(a>0)&&$('#v_q').value.trim()!=='')};
 $('#v_q').oninput=upd;$('#v_u').onclick=e=>{const b=e.target.closest('.uchip');if(!b)return;
  const old=L[ix()],nu=L.find(u=>u.label===b.dataset.l),a=q();lbl=nu.label;
  if(a>0&&(old.kind==='w'||nu.kind==='w')&&old!==nu){const v=a*old.mult/nu.mult;$('#v_q').value=nu.kind==='w'?String(Math.round(v)):String(+v.toFixed(2))}upd()};
 document.querySelectorAll('.qchips [data-q]').forEach(b=>b.onclick=()=>{$('#v_q').value=b.dataset.q;upd()});
 $('#v_q').onkeydown=e=>{if(e.key==='Enter')$('#v_go').click()};
 $('#v_q').onfocus=e=>e.target.select();upd();
 $('#v_go').onclick=()=>{const a=q();if(!(a>0))return toast('Enter an amount, like 1, 1.5 or 1 1/2');close();onSave(entryFrom(f2,ix(),a),$('#v_meal').value)};
 if(onDel)$('#v_del').onclick=onDel}
function customFood(mid,edit,pre={}){const f=edit||{barcode:pre.barcode,name:pre.name||'',brand:pre.brand||'',n:{kcal:'',p:'',c:'',f:''},units:[{label:'serving',mult:1}]};
 const un=(f.units[0].label||'serving').replace(/^1\s+/,'');
 sheet(`<h2>${edit?'Edit':'New'} custom food</h2><label>Name</label><input id="c_n" value="${esc(f.name)}" placeholder="e.g. Flour tortilla"><label>Brand (optional)</label><input id="c_b" value="${esc(f.brand)}">
 <label>Unit</label><div class="cunit">1 <input id="c_s" value="${esc(un)}" placeholder="serving, tortilla, cookie…"> = <input id="c_g" type="number" inputmode="decimal" value="${f.gpS||''}" placeholder="g"> g <span class="mut">(optional)</span></div>
 <label id="c_kl">Calories per 1 ${esc(un)}</label><input id="c_k" type="number" inputmode="decimal" value="${f.n.kcal}">
 <div class="row"><div><label>Protein g</label><input id="c_p" type="number" value="${f.n.p}"></div><div><label>Carbs g</label><input id="c_c" type="number" value="${f.n.c}"></div><div><label>Fat g</label><input id="c_f" type="number" value="${f.n.f}"></div><div><label>Fiber g</label><input id="c_fb" type="number" value="${f.n.fb??''}"></div></div>
 ${f.barcode?`<p class="mut" style="font-size:13px">UPC ${esc(f.barcode)} — saved on this device so the next scan finds it instantly.</p><label class="tog"><input type="checkbox" id="c_share" ${D.shareOFF?'checked':''}> Also share to Open Food Facts so it helps everyone</label>`:''}
 <button class="btn" id="c_go">Save</button>${edit?'<button class="btn alt" id="c_del" style="color:var(--bad)">Delete</button>':''}<button class="btn alt" id="c_x">Cancel</button>`);
 $('#c_x').onclick=close;$('#c_s').oninput=()=>{$('#c_kl').textContent='Calories per 1 '+($('#c_s').value.trim()||'serving')};
 $('#c_go').onclick=()=>{const n=$('#c_n').value.trim();if(!n||$('#c_k').value==='')return toast('Name and calories are required');
  const u=$('#c_s').value.trim().replace(/^1\s+/,'')||'serving',g=+$('#c_g').value||0;
  const nf={src:'custom',ref:edit?.ref||uid(),barcode:f.barcode,name:n,brand:$('#c_b').value.trim(),n:{kcal:+$('#c_k').value,p:+$('#c_p').value||0,c:+$('#c_c').value||0,f:+$('#c_f').value||0,fb:+$('#c_fb').value||0},units:[{label:u,mult:1}],...(g?{gpS:g}:{})};
  if(f.barcode&&$('#c_share')?.checked){D.shareOFF=true;shareOFF({...nf,units:[{label:'1 '+u+(g?` (${g} g)`:''),mult:1}]})}else if($('#c_share'))D.shareOFF=false;
  if(edit)D.custom[D.custom.indexOf(edit)]=nf;else D.custom.push(nf);save();
  if(mid)pick(nf,mid);else{close();render()}};
 if(edit)$('#c_del').onclick=()=>{D.custom.splice(D.custom.indexOf(edit),1);save();close();render()}}

/* ---------- barcode ---------- */
/* Opt-in contribution to the open, shared Open Food Facts database (public write API, no account). Values are per serving. */
async function shareOFF(f){if(!navigator.onLine)return toast('Offline — saved on this device only');
 const b=new URLSearchParams({code:f.barcode,product_name:f.name,brands:f.brand||'',serving_size:f.units[0].label,nutrition_data_per:'serving','nutriment_energy-kcal':f.n.kcal,'nutriment_energy-kcal_unit':'kcal',nutriment_proteins:f.n.p,nutriment_proteins_unit:'g',nutriment_carbohydrates:f.n.c,nutriment_carbohydrates_unit:'g',nutriment_fat:f.n.f,nutriment_fat_unit:'g',nutriment_fiber:f.n.fb||0,nutriment_fiber_unit:'g',app_name:'MyHealthyHabits',app_version:'1.1',comment:'Added from My Healthy Habits web app'});
 try{await fetch('https://world.openfoodfacts.org/cgi/product_jqm2.pl',{method:'POST',mode:'no-cors',body:b});toast('Thanks! Shared to Open Food Facts')}catch(e){toast('Could not share right now — saved on this device')}}
let stream=null,scanLoop=null,zx=null;
function stopScan(){if(scanLoop)cancelAnimationFrame(scanLoop),scanLoop=null;if(zx){try{zx.reset()}catch(e){}zx=null}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
async function scan(mid){sheet(`<h2>Scan a barcode</h2><video id="b_v" playsinline muted></video><p class="mut" id="b_s">Point the camera at the barcode…</p>
 <div class="row"><input id="b_code" inputmode="numeric" placeholder="Or type the barcode number"><button class="btn sm" id="b_go" style="flex:none">Look up</button></div><button class="btn alt" onclick="close()">Cancel</button>`);
 $('#b_go').onclick=()=>lookup($('#b_code').value.trim(),mid);
 const found=c=>{stopScan();if(navigator.vibrate)navigator.vibrate(80);lookup(c,mid)};
 try{if('BarcodeDetector' in window){const fm=await BarcodeDetector.getSupportedFormats();
   if(fm.includes('ean_13')){stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});const v=$('#b_v');v.srcObject=stream;await v.play();
    const det=new BarcodeDetector({formats:fm.filter(f=>/ean|upc|code_128/.test(f))});
    const tick=async()=>{if(!stream)return;try{const r=await det.detect(v);if(r[0])return found(r[0].rawValue)}catch(e){}scanLoop=requestAnimationFrame(tick)};return tick()}}
  await loadZX();zx=new ZXing.BrowserMultiFormatReader();
  zx.decodeFromConstraints({video:{facingMode:'environment'}},'b_v',(res)=>{if(res)found(res.getText())});
 }catch(e){$('#b_s').textContent='Camera not available ('+e.name+'). Type the barcode number instead.'}}
const loadZX=()=>window.ZXing?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='vendor/zxing.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)});
async function lookup(code,mid){if(!code)return;const s=$('#b_s');if(s)s.textContent='Looking up '+code+'…';
 const mine=D.custom.find(f=>f.barcode===code)||Object.values(D.stats).map(s=>s.food).find(f=>f.barcode===code);if(mine)return pick(mine,mid);
 try{const r=await fetch('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(code)+'.json?fields=code,product_name,brands,nutriments,serving_size,serving_quantity');
  const j=await r.json();if(j.status===1&&j.product){const f=offFood(j.product);if(f.n.kcal)return pick(f,mid);toast('Found “'+f.name+'” but it has no nutrition info — add it below');return customFood(mid,null,{name:f.name,brand:f.brand,barcode:code})}}catch(e){}
 toast('Not found — add it as a custom food');customFood(mid,null,{barcode:code})}

/* ---------- history ---------- */
function progress(){weight();const keep=V.innerHTML;history();const h=V.innerHTML;weight();V.insertAdjacentHTML('beforeend',h);V.querySelectorAll('[data-d]').forEach(el=>el.onclick=()=>{cur=el.dataset.d;go('today')});V.insertAdjacentHTML('afterbegin',programCard());bindProgram()}
function history(){const t=logicalToday(),days=[...Array(30)].map((_,i)=>addDays(t,-i)),b=budget();
 const tot=days.map(d=>dayTotal(d)),logged=tot.filter(x=>x.kcal>0),avg=logged.length?logged.reduce((s,x)=>s+x.kcal,0)/logged.length:0;
 const wk=[...Array(7)].map((_,i)=>addDays(t,-i)),wt=wk.map(d=>dayTotal(d)),wl=wt.filter(x=>x.kcal),wa=k=>wl.length?wl.reduce((s,x)=>s+x[k],0)/wl.length:0;
 const wkHtml=`<div class="card"><h2>This week</h2><div class="stats"><div><span class="mut">Days logged</span><b>${wl.length} / 7</b></div><div><span class="mut">Avg calories</span><b>${r0(wa('kcal')).toLocaleString()}</b></div>
 <div><span class="mut">Under budget</span><b>${wt.filter(x=>x.kcal&&x.kcal<=b).length} days</b></div><div><span class="mut">Avg protein / carbs / fat / fiber</span><b>${r0(wa('p'))} / ${r0(wa('c'))} / ${r0(wa('f'))} / ${r0(wa('fb'))} g</b></div>
 <div><span class="mut">Avg water</span><b>${fL(wk.reduce((s,d)=>s+(D.water[d]||0),0)/7)}</b></div><div><span class="mut">Gym days</span><b>${wk.filter(d=>D.gym[d]).length}</b></div></div>
 <div class="wkbars">${wk.slice().reverse().map(d=>{const k=dayTotal(d).kcal;return`<div><i style="height:${Math.min(100,k/b*80)}%;background:${k>b?'var(--bad)':'var(--pri)'}"></i><small>${new Date(d+'T12:00').toLocaleDateString(undefined,{weekday:'narrow'})}</small></div>`}).join('')}</div></div>`;
 V.innerHTML=wkHtml+`<div class="card"><h2>Last 30 days</h2><div class="mut">Average on logged days: <b>${r0(avg).toLocaleString()}</b> cal (budget ${b.toLocaleString()})</div></div>
 <div class="card"><h2>Daily calories</h2><div class="d30">${[...days].reverse().map(d=>{const i=days.indexOf(d),k=tot[i].kcal,mx=Math.max(b*1.4,...tot.map(t=>t.kcal));return`<i data-d="${d}" title="${nice(d)}" style="height:${k?Math.max(4,k/mx*100):3}%;background:${!k?'var(--ln)':k>b?'var(--bad)':'var(--pri)'}"></i>`}).join('')}<b style="bottom:${b/Math.max(b*1.4,...tot.map(t=>t.kcal))*100}%"></b></div><div class="d30l"><span>30 days ago</span><span>Today</span></div></div>
 <div class="card"><h2>Logged days</h2>${days.map((d,i)=>tot[i].kcal?i:-1).filter(i=>i>=0).length?'':'<div class="empty"><p>No food logged yet.<br>Days you log will appear here.</p></div>'}${days.map((d,i)=>{const k=tot[i].kcal;if(!k)return'';return`<div class="item" data-d="${d}"><div>${nice(d)}<small>${k?(k>b?r0(k-b)+' over':r0(b-k)+' under'):'Nothing logged'}</small></div>
 <b style="color:${!k?'var(--mut)':k>b?'var(--bad)':'var(--pri)'}">${r0(k).toLocaleString()}</b></div>`}).join('')}</div>`;
 V.querySelectorAll('[data-d]').forEach(el=>el.onclick=()=>{cur=el.dataset.d;go('today')})}

/* ---------- weight ---------- */
function weight(){const W=[...D.weights].sort((a,b)=>a.date<b.date?-1:1),last=W[W.length-1],first=W[0],goal=D.profile?.goal;
 V.innerHTML=`<div class="card"><h2>Weight</h2><div class="stats"><div><span class="mut">Current</span><b>${last?fW(last.lb):'—'}</b></div>
 <div><span class="mut">Change</span><b>${last&&first?(r1(last.lb-first.lb)>0?'+':'')+fW(last.lb-first.lb):'—'}</b></div><div><span class="mut">Goal</span><b>${goal?fW(goal):'—'}</b></div>
 ${last&&goal?`<div><span class="mut">To go</span><b>${fW(Math.abs(last.lb-goal))}</b></div>`:''}</div>
 <canvas class="chart" id="w_c"></canvas>
 <div class="row" style="margin-top:10px"><input id="w_d" type="date" value="${logicalToday()}"><input id="w_v" type="number" step="0.1" inputmode="decimal" placeholder="${wU()}"><button class="btn sm" id="w_go" style="flex:none">Log</button></div></div>
 <div class="card">${W.slice().reverse().map(w=>`<div class="item"><div>${nice(w.date)}</div><span><b>${fW(w.lb)}</b> <button class="x" data-del="${w.date}">✕</button></span></div>`).join('')||'<p class="mut">No weigh-ins yet.</p>'}</div>`;
 $('#w_go').onclick=()=>{const v=toLb(+$('#w_v').value),d=$('#w_d').value;if(!v||!d)return toast('Enter a weight');D.weights=D.weights.filter(w=>w.date!==d);D.weights.push({date:d,lb:v});
  const latest=d>=W.reduce((m,w)=>w.date>m?w.date:m,'');if(D.profile&&latest)D.profile.weight=v;save();progress();
  if(latest&&D.profile&&D.profile.sex){const c=calc(D.profile);if(c.final!==D.budget){sheet(`<h2>Update your budget?</h2><p>At ${v} lb your recommended budget is <b>${c.final.toLocaleString()}</b> calories a day (now ${budget().toLocaleString()}).</p>${c.capped?'<p class="mut">Held at the safe minimum.</p>':''}<button class="btn" id="rc_y">Update to ${c.final.toLocaleString()}</button><button class="btn alt" onclick="close()">Keep ${budget().toLocaleString()}</button>`);$('#rc_y').onclick=()=>{D.budget=c.final;D.budgetMode='guided';save();close();toast('Budget updated')}}}};

 V.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{D.weights=D.weights.filter(w=>w.date!==b.dataset.del);save();progress()});
 drawChart($('#w_c'),W,goal)}
function drawChart(cv,W,goal){const dpr=devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;cv.width=w*dpr;cv.height=h*dpr;const x=cv.getContext('2d');x.scale(dpr,dpr);
 const cs=getComputedStyle(document.body),mut=cs.getPropertyValue('--mut'),ln=cs.getPropertyValue('--ln');x.font='11px system-ui';
 if(W.length<1){x.fillStyle=mut;x.fillText('Log your weight to see a chart',10,h/2);return}
 const vals=W.map(p=>p.lb).concat(goal?[goal]:[]),lo=Math.floor(Math.min(...vals)-2),hi=Math.ceil(Math.max(...vals)+2);
 const t0=new Date(W[0].date).getTime(),t1=Math.max(new Date(W[W.length-1].date).getTime(),t0+864e5);
 const P={l:36,r:10,t:10,b:22},X=d=>P.l+(new Date(d).getTime()-t0)/(t1-t0)*(w-P.l-P.r),Y=v=>P.t+(hi-v)/(hi-lo)*(h-P.t-P.b);
 x.strokeStyle=ln;x.fillStyle=mut;for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;x.beginPath();x.moveTo(P.l,Y(v));x.lineTo(w-P.r,Y(v));x.stroke();x.fillText(r0(v),4,Y(v)+4)}
 x.fillText(nice(W[0].date),P.l,h-6);const le=nice(W[W.length-1].date);x.fillText(le,w-P.r-x.measureText(le).width,h-6);
 if(goal){x.setLineDash([5,4]);x.strokeStyle='#f97316';x.beginPath();x.moveTo(P.l,Y(goal));x.lineTo(w-P.r,Y(goal));x.stroke();x.setLineDash([])}
 x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--pri').trim();x.lineWidth=2.5;x.beginPath();W.forEach((p,i)=>i?x.lineTo(X(p.date),Y(p.lb)):x.moveTo(X(p.date),Y(p.lb)));x.stroke();
 x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--pri').trim();W.forEach(p=>{x.beginPath();x.arc(X(p.date),Y(p.lb),3.5,0,7);x.fill()})}

/* ---------- settings ---------- */
function settings(){const m=D.macroPct;
 V.innerHTML=`<div class="card"><h2>Appearance</h2><div class="seg" id="st_th">${["dark","light"].map(t=>`<button data-th="${t}" class="${(localStorage.getItem("mhh-theme")||"dark")===t?"on":""}">${t==="dark"?"Dark":"Light"}</button>`).join("")}</div></div>
 <div class="card"><h2>Daily budget</h2><div class="stats"><div><span class="mut">Calories</span><b>${budget().toLocaleString()}</b></div></div>
 <button class="btn alt" id="st_prof">Calorie Budget</button>
 <label class="tog"><input type="checkbox" id="st_ex" ${D.exAddBack?'checked':''}> Add exercise calories back to my budget</label>
 <label>Macro split (% of calories): protein / carbs / fat</label><div class="row"><input id="st_p" type="number" value="${m.p}"><input id="st_c" type="number" value="${m.c}"><input id="st_f" type="number" value="${m.f}"></div></div>
 <div class="card"><h2>Units</h2><div class="item tap" id="st_un"><div>Weight, energy, height, distance, liquids<small>${(u=>`${u.w} · ${u.e} · ${u.h==="ft"?"ft/in":"cm"} · ${u.d} · ${u.l}`)(U())}</small></div><b>›</b></div></div>
 <div class="card"><h2>Goals</h2><div class="item tap" id="st_sg"><div>Daily step goal<small>Tap to change</small></div><b>${(D.stepGoal||10000).toLocaleString()}</b></div><div class="item tap" id="st_gl"><div>Nutrition &amp; water goals</div><b>›</b></div></div>
 <div class="card"><h2>Meals</h2><label>Meals a day</label><div class="seg" id="st_mc">${[1,2,3,4].map(n=>`<button data-mc="${n}" class="${D.mealCount===n?'on':''}">${n}</button>`).join('')}</div>
 <p class="mut" style="margin-top:0;font-size:13px">Name your meals however your day runs — e.g. night shift: "Lunch", "Dinner", "Breakfast (after shift)". Snacks always show.</p>
 ${D.meals.map((x,i)=>`<div class="row" style="margin-bottom:6px;align-items:center"><input data-mn="${i}" value="${esc(x.name)}"><button class="btn sm alt" data-up="${i}" style="flex:none">↑</button><button class="btn sm alt" data-dn="${i}" style="flex:none">↓</button></div>`).join('')}
 <label>New day starts at</label><select id="st_roll">${[...Array(13)].map((_,h)=>`<option value="${h}">${h===0?'Midnight (default)':(h<12?h+':00 AM':'Noon')}</option>`).join('')}</select>
 <p class="mut" style="font-size:13px">Working nights? Set this to when you usually go to bed so a whole shift counts as one day.</p></div>
 <div class="card"><h2>My foods & meals</h2>${D.custom.map((f,i)=>`<div class="item" data-cf="${i}"><div>${esc(f.name)}<small>${r0(f.n.kcal)} cal · ${esc(f.units[0].label)}</small></div><span class="mut">Edit</span></div>`).join('')}
 ${D.saved.map((s,i)=>`<div class="item"><div>${esc(s.name)}<small>Saved meal · ${s.items.length} items · ${r0(sumEntries(s.items).kcal)} cal</small></div><button class="x" data-sd="${i}">✕</button></div>`).join('')}
 <button class="btn alt" id="st_cf">+ Create a custom food</button><button class="btn alt" id="st_recipe">+ Build a recipe / meal</button></div>
 <details class="card"><summary class="mut" style="cursor:pointer">Advanced: food search key (optional)</summary><p class="mut" style="margin-top:0;font-size:13px">Food search works out of the box. Only if you want your own USDA quota, get a free key at <a href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noopener">fdc.nal.usda.gov</a> and paste it here.</p>
 <input id="st_key" placeholder="DEMO_KEY" value="${esc(D.usdaKey)}"></details>
 <div class="card"><h2>Backup</h2><p class="mut" style="margin-top:0">Your data lives only on this device. Export a backup now and then.</p>
 <button class="btn" id="st_exp">Export backup</button><button class="btn alt" id="st_imp">Import backup</button><input type="file" id="st_file" accept="application/json,.json" hidden></div>
 <p class="mut" style="text-align:center;font-size:12px">Food data: USDA FoodData Central & Open Food Facts. No accounts, no fees.</p>`;
 $('#st_prof').onclick=budgetHome;$('#st_un').onclick=unitsSheet;document.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{localStorage.setItem('mhh-theme',b.dataset.th);document.documentElement.dataset.theme=b.dataset.th;document.querySelector('meta[name=theme-color]').content=b.dataset.th==='light'?'#f2f2f7':'#0b0b0f';render()});$('#st_ex').onchange=e=>{D.exAddBack=e.target.checked;save()};$('#st_key').onchange=e=>{D.usdaKey=e.target.value.trim();save()};
 ['p','c','f'].forEach(k=>$('#st_'+k).onchange=e=>{D.macroPct[k]=+e.target.value||0;save()});
 $('#st_sg').onclick=()=>stepGoalSheet(settings);$('#st_gl').onclick=goalsSheet;
 V.querySelectorAll('[data-mc]').forEach(b=>b.onclick=()=>{D.mealCount=+b.dataset.mc;save();settings()});
 V.querySelectorAll('[data-mn]').forEach(i=>i.onchange=()=>{D.meals[+i.dataset.mn].name=i.value.trim()||D.meals[+i.dataset.mn].name;save()});
 const mv=(i,j)=>{if(j<0||j>=D.meals.length)return;[D.meals[i],D.meals[j]]=[D.meals[j],D.meals[i]];save();settings()};
 V.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>mv(+b.dataset.up,+b.dataset.up-1));V.querySelectorAll('[data-dn]').forEach(b=>b.onclick=()=>mv(+b.dataset.dn,+b.dataset.dn+1));
 $('#st_roll').value=D.rollover;$('#st_roll').onchange=e=>{D.rollover=+e.target.value;cur=logicalToday();save()};
 V.querySelectorAll('[data-cf]').forEach(el=>el.onclick=()=>customFood(null,D.custom[+el.dataset.cf]));
 V.querySelectorAll('[data-sd]').forEach(b=>b.onclick=()=>{D.saved.splice(+b.dataset.sd,1);save();settings()});
 $('#st_cf').onclick=()=>customFood(null);$('#st_recipe').onclick=recipe;
 $('#st_exp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(D,null,1)],{type:'application/json'}));a.download='my-healthy-habits-backup-'+logicalToday()+'.json';a.click()};
 $('#st_imp').onclick=()=>$('#st_file').click();
 $('#st_file').onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());if(!j.meals||!j.log)throw 0;if(!confirm('Replace all data on this device with this backup?'))return;
  D=Object.assign(def(),j,{exAddBack:D.exAddBack,stepsAddBack:D.stepsAddBack,noAddBackV1:1});save();toast('Backup restored');go('today')}catch(x){toast('That file isn\'t a valid backup')}}}
function recipe(){const items=[];const draw=()=>{const s=sumEntries(items);$('#r_list').innerHTML=items.map(e=>`<div class="item"><div>${esc(e.food.name)}<small>${esc(amtLbl(e))}</small></div><b>${r0(e.kcal)}</b></div>`).join('')+`<p><b>Total ${r0(s.kcal)} cal</b></p>`};
 sheet(`<h2>Build a recipe / meal</h2><label>Name</label><input id="r_n" placeholder="e.g. Chicken rice bowl"><div id="r_list"></div>
 <label>Add ingredients from your foods</label><select id="r_pick"><option value="">Choose…</option>${[...D.custom,...Object.values(D.stats).map(s=>s.food)].map((f,i)=>`<option value="${i}">${esc(f.name)}</option>`).join('')}</select>
 <div class="row"><div><label>Amount</label><input id="r_q" type="number" value="1"></div></div><button class="btn alt" id="r_add">Add ingredient</button>
 <label>Servings this makes</label><input id="r_sv" type="number" value="1"><button class="btn" id="r_go">Save</button><button class="btn alt" onclick="close()">Cancel</button>`);
 const pool=[...D.custom,...Object.values(D.stats).map(s=>s.food)];draw();
 $('#r_add').onclick=()=>{const f=pool[+$('#r_pick').value];if(!f)return;items.push(entryFrom(f,0,+$('#r_q').value||1));draw()};
 $('#r_go').onclick=()=>{const n=$('#r_n').value.trim(),sv=+$('#r_sv').value||1;if(!n||!items.length)return toast('Add a name and ingredients');const s=sumEntries(items);
  D.custom.push({src:'custom',ref:uid(),name:n,brand:'Recipe',n:{kcal:s.kcal/sv,p:s.p/sv,c:s.c/sv,f:s.f/sv},units:[{label:'1 serving (of '+sv+')',mult:1}]});save();close();settings();toast('Recipe saved')}}


/* ---------- activity & streaks ---------- */
const foodDay=d=>Object.values(D.log[d]||{}).some(a=>a.length);
const doneDay=d=>!!D.done[d];
const FLAME='<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 2 2s-.5-4 1-7z"/></svg>';
function doneCard(){const on=doneDay(cur),S=streaks().done,fut=cur>logicalToday();
 return`<div class="card donec${on?' on':''}"><div class="dflame">${FLAME}</div><div class="dtx"><b>Done Logging</b><small>Streak: ${S.cur} day${S.cur===1?'':'s'} · Best ${S.best}</small><small class="mut">${on?'Marked done for '+nice(cur):cur===logicalToday()?'Mark when you finish eating today':'Not marked — mark it to repair your streak'}</small></div>
 <button id="doneT" class="sw${on?' on':''}" role="switch" aria-checked="${on}" aria-label="Done logging" ${fut?'disabled':''}><i></i></button></div>`}
function bindDone(){const b=$('#doneT');if(!b)return;b.onclick=()=>{if(cur>logicalToday())return toast("Can't mark a future day");const before=streaks().done.cur;
 if(D.done[cur])delete D.done[cur];else D.done[cur]=Date.now();save();today();const n=streaks().done.cur;
 if(D.done[cur]){if([3,7,14,30,60,100,365].includes(n)&&n>before)celebrate(n);else toast(cur===logicalToday()?'Nice! Day logged ✅':'Marked '+nice(cur)+' done ✅')}}}
function celebrate(n){toast(`🔥 ${n}-day logging streak!`);const c=document.createElement('div');c.className='confetti';const cols=['#ff375f','#a6ff00','#00e5ff','#ff9f0a','#bf5af2'];
 for(let i=0;i<60;i++){const e=document.createElement('i');e.style.left=Math.random()*100+'%';e.style.background=cols[i%5];e.style.animationDelay=Math.random()*.4+'s';e.style.transform=`rotate(${Math.random()*360}deg)`;c.appendChild(e)}
 document.body.appendChild(c);setTimeout(()=>c.remove(),2600)}
function monthGrid(ym,sel,clickable){const[y,m]=ym.split('-').map(Number),first=new Date(y,m-1,1),days=new Date(y,m,0).getDate(),off=(first.getDay()+6)%7,t=logicalToday();
 let h='<div class="mcal">'+['M','T','W','T','F','S','S'].map(x=>`<span class="mh">${x}</span>`).join('')+'<span></span>'.repeat(off);
 for(let i=1;i<=days;i++){const d=`${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`,cl=[doneDay(d)?'dn':foodDay(d)?'fd':'',d===t?'td':'',d===sel?'sel':'',d>t?'fu':''].join(' ');
  h+=`<button class="${cl}" ${clickable&&d<=t?`data-cd="${d}"`:'disabled'}>${i}</button>`}
 return h+'</div><div class="mleg"><span><i class="dn"></i>Done</span><span><i class="fd"></i>Food logged, not marked</span></div>'}
const ymOf=d=>d.slice(0,7),ymAdd=(ym,n)=>{const[y,m]=ym.split('-').map(Number),z=new Date(y,m-1+n,1);return z.getFullYear()+'-'+String(z.getMonth()+1).padStart(2,'0')};
const ymName=ym=>new Date(ym+'-15T12:00').toLocaleDateString(undefined,{month:'long',year:'numeric'});
function calPicker(){let ym=ymOf(cur);const draw=()=>{sheet(`<div class="calhd"><button id="cp_p" aria-label="Previous month">‹</button><h2>${ymName(ym)}</h2><button id="cp_n" aria-label="Next month" ${ym>=ymOf(logicalToday())?'disabled':''}>›</button></div>${monthGrid(ym,cur,true)}<button class="btn alt" id="cp_t">Jump to Today</button>`);
 $('#cp_p').onclick=()=>{ym=ymAdd(ym,-1);draw()};$('#cp_n').onclick=()=>{if(ym<ymOf(logicalToday())){ym=ymAdd(ym,1);draw()}};
 $('#cp_t').onclick=()=>{cur=logicalToday();close();go('today')};
 document.querySelectorAll('[data-cd]').forEach(b=>b.onclick=()=>{cur=b.dataset.cd;close();go('today')})};draw()}
const stepDay=d=>(D.steps[d]||0)>=D.stepGoal;
function dayStreak(fn){const t=logicalToday();let d=fn(t)?t:addDays(t,-1),n=0;while(fn(d)){n++;d=addDays(d,-1)}return n}
function bestDay(fn,keys){const ds=[...new Set(keys)].filter(fn).sort();let b=0,run=0,prev=null;ds.forEach(d=>{run=prev&&addDays(prev,1)===d?run+1:1;b=Math.max(b,run);prev=d});return b}
const weekStart=d=>{const x=new Date(d+'T12:00');return addDays(d,-((x.getDay()+6)%7))};
const gymInWeek=ws=>[...Array(7)].filter((_,i)=>D.gym[addDays(ws,i)]).length;
function gymStreak(){let ws=weekStart(logicalToday()),n=gymInWeek(ws)>=D.gymGoal?1:0;ws=addDays(ws,-7);while(gymInWeek(ws)>=D.gymGoal){n++;ws=addDays(ws,-7)}return n}
function gymBest(){const ks=Object.keys(D.gym).sort();if(!ks.length)return 0;let ws=weekStart(ks[0]),end=weekStart(logicalToday()),b=0,run=0;
 while(ws<=end){run=gymInWeek(ws)>=D.gymGoal?run+1:0;b=Math.max(b,run);ws=addDays(ws,7)}return b}
function streaks(){return{done:{cur:dayStreak(doneDay),best:bestDay(doneDay,Object.keys(D.done))},food:{cur:dayStreak(foodDay),best:bestDay(foodDay,Object.keys(D.log))},steps:{cur:dayStreak(stepDay),best:bestDay(stepDay,Object.keys(D.steps))},gym:{cur:gymStreak(),best:gymBest()}}}
function nudges(){if(cur!==logicalToday())return'';const S=streaks(),t=logicalToday(),out=[];
 if(foodDay(t)&&!doneDay(t)&&S.done.cur)out.push(`🔥 Tap <b>Done Logging</b> when you finish eating to keep your ${S.done.cur}-day streak.`);
 if(!foodDay(t))out.push(S.food.cur?`🔥 Your ${S.food.cur}-day logging streak is on the line. Log your first meal to keep it going!`:`👋 Log one meal today to start a new streak.`);
 const st=D.steps[t]||0;if(st<D.stepGoal&&S.steps.cur)out.push(`👟 ${(D.stepGoal-st).toLocaleString()} more steps keeps your ${S.steps.cur}-day step streak alive.`);
 const ws=weekStart(t),done=gymInWeek(ws),left=D.gymGoal-done,daysLeft=7-[...Array(7)].findIndex((_,i)=>addDays(ws,i)===t);
 if(left>0&&!D.gym[t]&&left>=daysLeft-1)out.push(`💪 ${left} more gym day${left>1?'s':''} this week to hit your goal — ${daysLeft} day${daysLeft>1?'s':''} left. Today's a great day!`);
 return out.map(m=>`<div class="card nudge">${m}</div>`).join('')}
const BADGES=[['food',7,'🥉','7-day logger'],['food',30,'🥈','30-day logger'],['food',100,'🥇','100-day logger'],['steps',7,'👟','7 days of 10k'],['steps',30,'🏃','30 days of 10k'],['steps',100,'🏅','100 days of 10k'],['gym',4,'💪','4 strong weeks'],['gym',12,'🏋️','12 strong weeks'],['gym',52,'🏆','A full year at the gym']];
function activity(){const t=logicalToday(),S=streaks(),ws=weekStart(t),gw=gymInWeek(ws),st=D.steps[t]||0,g=D.gym[t];
 const box=(ic,lbl,c,b,u)=>`<div class="sk"><div>${ic}</div><b>${c}</b><small>${lbl}</small><small class="mut">best ${b} ${u}</small></div>`;
 const cells=[];const start=addDays(weekStart(t),-7*15);for(let i=0;i<16*7;i++){const d=addDays(start,i);const n=d>t?-1:(foodDay(d)?1:0)+(D.gym[d]?1:0)+(stepDay(d)?1:0);cells.push(`<i class="h${n}" title="${d}"></i>`)}
 let ym=ymOf(t);V.innerHTML=`<div class="card"><h2>Streaks</h2><div class="sks">${box('✅','day Done Logging streak',S.done.cur,S.done.best,'days')}${box('🍽️','days with food logged',S.food.cur,S.food.best,'days')}${box('💪','week gym streak',S.gym.cur,S.gym.best,'weeks')}${box('👟','day step streak',S.steps.cur,S.steps.best,'days')}</div></div>
 <div class="card"><div class="calhd"><button id="am_p" aria-label="Previous month">‹</button><h2 id="am_t">${ymName(ym)}</h2><button id="am_n" aria-label="Next month">›</button></div><div id="am_g">${monthGrid(ym,null,true)}</div><p class="mut" style="font-size:12px;margin:6px 0 0">Streak counts days marked Done Logging. Tap a day to open it, add food and mark it — a missed day can be fixed later.</p></div>
 <div class="card"><button class="btn" id="toGym">💪 Open Gym — check in & log workouts</button></div>
 <div class="card"><h2>Steps today</h2><div class="mut"><b class="stepnum" data-sd="${t}" role="button" aria-label="Edit steps" style="font-size:22px;color:var(--tx)">${st.toLocaleString()}</b> / ${D.stepGoal.toLocaleString()}</div><div class="bar" style="margin:8px 0"><i style="width:${Math.min(100,st/D.stepGoal*100)}%;background:var(--p)"></i></div>
 <div class="row"><input id="s_n" type="number" inputmode="numeric" placeholder="Total steps from your phone"><button class="btn sm" id="s_set" style="flex:none">Save</button></div>
 <div class="seg">${[1000,2500,5000].map(n=>`<button data-plus="${n}">+${n.toLocaleString()}</button>`).join('')}</div>
 <p class="mut" style="font-size:12px;margin:0">Copy the number from Apple Health or Google Fit — browsers can't read them directly.</p>
 <label>Daily step goal</label><input id="s_goal" type="number" value="${D.stepGoal}"></div>
 <div class="card"><h2>Last 16 weeks</h2><div class="heat">${cells.join('')}</div><div class="mut" style="font-size:12px;margin-top:6px">Darker = more goals hit that day (food logged, gym, steps)</div></div>
 <div class="card"><h2>Badges</h2><div class="badges">${BADGES.map(([k,n,ic,l])=>{const got=S[k].best>=n;return`<div class="bd ${got?'':'off'}"><div>${ic}</div><small>${l}</small></div>`}).join('')}</div></div>`;
 $('#toGym').onclick=()=>go('gym');
 const am=()=>{$('#am_t').textContent=ymName(ym);$('#am_g').innerHTML=monthGrid(ym,null,true);$('#am_n').disabled=ym>=ymOf(t);V.querySelectorAll('#am_g [data-cd]').forEach(b=>b.onclick=()=>{cur=b.dataset.cd;go('today')})};am();
 $('#am_p').onclick=()=>{ym=ymAdd(ym,-1);am()};$('#am_n').onclick=()=>{if(ym<ymOf(t)){ym=ymAdd(ym,1);am()}};
 $('#s_set').onclick=()=>{const v=+$('#s_n').value;if(!(v>=0))return;D.steps[t]=v;save();activity();if(v>=D.stepGoal)toast('Step goal hit! 🎉')};
 V.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{D.steps[t]=(D.steps[t]||0)+ +b.dataset.plus;save();activity()});
 $('#s_goal').onchange=e=>{D.stepGoal=+e.target.value||10000;save();activity()}}

function myfoods(){const L=myFoods();
 V.innerHTML=`<div class="card"><h2>My Foods</h2><p class="mut" style="margin-top:0">Your meals, snacks and scanned items, most used first. Tap + to add in one tap.</p>
 <div class="row"><button class="btn sm" id="mf_scan" style="flex:1">📷 Scan barcode</button><button class="btn sm alt" id="mf_new" style="flex:1">+ Custom food</button></div></div>
 <div class="card">${L.map((x,i)=>`<div class="item"><div>${D.fav.includes(fkey(x.food))?'★ ':''}${esc(x.food.name)}<small>${r0(x.food.n.kcal*x.food.units[x.ui||0].mult*(x.qty||1))} cal · used ${x.count}×${x.food.barcode?' · UPC '+esc(x.food.barcode):''}</small></div><button class="btn sm" data-mf="${i}" style="flex:none">+</button></div>`).join('')||'<p class="mut">Nothing yet. Log, scan or create a food and it shows up here.</p>'}
 ${D.saved.map((m,i)=>`<div class="item"><div>🍱 ${esc(m.name)}<small>Saved meal · ${r0(sumEntries(m.items).kcal)} cal</small></div><button class="btn sm" data-ms="${i}" style="flex:none">+</button></div>`).join('')}</div>`;
 const mealNow=()=>{const vm=visMeals(logicalToday()).filter(m=>m.id!=='s'),L0=D.log[logicalToday()]||{};return(vm.find(m=>!(L0[m.id]||[]).length)||vm[vm.length-1]).id};
 V.querySelectorAll('[data-mf]').forEach(b=>b.onclick=()=>{cur=logicalToday();const x=L[+b.dataset.mf];pick(x.food,mealNow(),x.ui||0,x.qty||1)});
 V.querySelectorAll('[data-ms]').forEach(b=>b.onclick=()=>{cur=logicalToday();const m=D.saved[+b.dataset.ms],mm=mealNow();m.items.forEach(e=>addEntry(mm,{...e,id:uid()}));toast('Added '+m.name)});
 $('#mf_scan').onclick=()=>{cur=logicalToday();scan(mealNow())};$('#mf_new').onclick=()=>customFood(null)}
/* ---------- gym & workouts ---------- */
const WTYPES=['Strength','Cardio','Full body','Upper body','Lower body','Class','Swim','Other'];
const isCardio=t=>/Cardio|Swim/.test(t);
const wSum=w=>w.items.map(x=>x.min?`${esc(x.name)} ${x.min} min${x.dist?' · '+x.dist+' mi':''}`:`${esc(x.name)} ${x.sets}×${x.reps}${x.wt?' @ '+x.wt+' lb':''}`).join(', ');
function syncGymDay(d){const ws=D.workouts.filter(w=>w.date===d);if(!ws.length){if(D.gym[d]?.auto)delete D.gym[d];return}
 D.gym[d]={type:[...new Set(ws.map(w=>w.type))].join(', '),kcal:ws.reduce((s,w)=>s+(w.kcal||0),0),min:ws.reduce((s,w)=>s+(w.min||0),0),notes:ws.map(w=>w.notes).filter(Boolean).join(' · '),auto:1}}
function gym(){const t=logicalToday(),S=streaks(),ws=weekStart(t),gw=gymInWeek(ws),g=D.gym[t],H=[...D.workouts].sort((a,b)=>b.date<a.date?-1:b.date>a.date?1:b.ts-a.ts),last=H[0];
 V.innerHTML=`<div class="card gymhero"><div class="sks"><div class="sk"><span class="exico" style="--c:#ff9f0a;margin:0 auto 4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 2 2s-.5-4 1-7z"/></svg></span><b>${S.gym.cur}</b><small>week streak</small></div><div class="sk"><span class="exico" style="--c:#64d2ff;margin:0 auto 4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg></span><b>${gw}/${D.gymGoal}</b><small>this week</small></div><div class="sk"><span class="exico" style="--c:#ffd60a;margin:0 auto 4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg></span><b>${S.gym.best}</b><small>best streak</small></div></div>
 <div class="bar" style="margin:12px 0 4px"><i style="width:${Math.min(100,gw/D.gymGoal*100)}%;background:var(--acc)"></i></div>
 ${g?`<div class="item"><div>✅ Checked in today${g.type?' · '+esc(g.type):''}${g.kcal?' · '+g.kcal+' cal':''}</div>${g.auto?'':'<button class="x" id="g_undo">Undo</button>'}</div>`:'<button class="btn big1" id="g_check">💪 Check in — I went to the gym</button>'}
 <label>Weekly gym goal</label><select id="g_goal">${[1,2,3,4,5,6,7].map(n=>`<option value="${n}">${n} day${n>1?'s':''} a week</option>`).join('')}</select></div>
 <div class="card"><h2>Log a workout</h2><button class="btn" id="w_new">+ Log exercise</button><p class="hint" style="text-align:center;margin:6px 0 10px">Pick an exercise and how long — e.g. 30 min weight machines.</p>${last?`<button class="btn alt" id="w_rep">🔁 Repeat last: ${esc(last.type)} (${nice(last.date)})</button>`:''}
 ${D.wtemplates.length?`<label>Templates</label>${D.wtemplates.map((x,i)=>`<div class="item"><div>${esc(x.name)}<small>${wSum(x)}</small></div><span><button class="btn sm" data-tu="${i}">Start</button> <button class="x" data-td="${i}">✕</button></span></div>`).join('')}`:''}</div>
 <div class="card"><h2>History</h2>${H.slice(0,40).map(w=>`<div class="item" data-wo="${w.id}"><div>${nice(w.date)} · <b>${esc(w.type)}</b><small>${wSum(w)||'No exercises'}${w.notes?' — '+esc(w.notes):''}</small></div><span class="mut">${w.kcal?(w.est?'~':'')+w.kcal+' cal':''}</span></div>`).join('')||'<div class="empty">'+exIco('free',44).replace('exico','exico big')+'<p>No workouts yet.<br>Tap <b>New workout</b> and pick from 100+ exercises.</p></div>'}</div>`;
 if($('#g_check'))$('#g_check').onclick=()=>{D.gym[t]={type:'',kcal:0};save();gym();toast('Nice work! 💪 Streak saved')};
 if($('#g_undo'))$('#g_undo').onclick=()=>{delete D.gym[t];save();gym()};
 $('#g_goal').value=D.gymGoal;$('#g_goal').onchange=e=>{D.gymGoal=+e.target.value;save();gym()};
 $('#w_new').onclick=()=>exSheet(null,null,()=>toast('Workout saved 💪'),{gym:1,day:t});if(last)$('#w_rep').onclick=()=>workoutSheet({...last,id:null,date:t,notes:''});
 V.querySelectorAll('[data-tu]').forEach(b=>b.onclick=()=>workoutSheet({...D.wtemplates[+b.dataset.tu],id:null,date:t}));
 V.querySelectorAll('[data-td]').forEach(b=>b.onclick=()=>{D.wtemplates.splice(+b.dataset.td,1);save();gym()});
 V.querySelectorAll('[data-wo]').forEach(el=>el.onclick=()=>{const w=D.workouts.find(w=>w.id===el.dataset.wo);if(!w.quick)return workoutSheet(w);sheet(`<h2>${nice(w.date)} · Gym</h2>${w.items.map(x=>`<div class="item tap" data-qi="${x.id}"><div class="exli">${exIcon(findEx(x.name),30)}<div>${esc(x.name)}<small>${x.min} min · ${(INTS.find(k=>k[0]===x.int)||INTS[1])[1]}${x.sets?` · ${x.sets}×${x.reps||'?'}${x.wt?' @ '+x.wt+' lb':''}`:''}</small></div></div><b>${x.est?'~':''}${x.kcal} cal</b></div>`).join('')}<button class="btn" id="qi_add">+ Add another exercise</button><button class="btn alt" onclick="close()">Done</button>`);document.querySelectorAll('[data-qi]').forEach(r=>r.onclick=()=>exSheet(null,null,null,{gym:1,day:w.date,item:w.items.find(x=>x.id===r.dataset.qi)}));$('#qi_add').onclick=()=>exSheet(null,null,null,{gym:1,day:w.date})})}
function workoutSheet(w0){const w=JSON.parse(JSON.stringify(w0||{type:'Strength',date:logicalToday(),items:[],notes:'',min:0,kcal:0}));if(!w.items.length)w.items.push(isCardio(w.type)?{name:'',min:30,dist:''}:{name:'',sets:3,reps:10,wt:''});
 let typedK=!!w0?.id;
 const draw=()=>{const c=isCardio(w.type);sheet(`<h2>${w.id?'Edit':'Log'} workout</h2><div class="row"><div><label>Type</label><select id="wk_t">${WTYPES.map(x=>`<option>${x}</option>`).join('')}</select></div><div><label>Date</label><input id="wk_d" type="date" value="${w.date}"></div></div>
 <label>Exercises</label>${w.items.map((x,i)=>`<div class="exrow"><div class="exname">${exIcon(findEx(x.name))}<input data-f="name" data-i="${i}" placeholder="${c?'e.g. Treadmill':'e.g. Bench press'}" value="${esc(x.name)}" list="exdl"></div>
  <div class="row">${'min' in x?`<div><small>Minutes</small><input data-f="min" data-i="${i}" type="number" value="${x.min}"></div><div><small>Distance mi</small><input data-f="dist" data-i="${i}" type="number" step="0.1" value="${x.dist}"></div>`:`<div><small>Sets</small><input data-f="sets" data-i="${i}" type="number" value="${x.sets}"></div><div><small>Reps</small><input data-f="reps" data-i="${i}" type="number" value="${x.reps}"></div><div><small>Weight lb</small><input data-f="wt" data-i="${i}" type="number" value="${x.wt}"></div>`}<button class="x" data-rm="${i}" style="flex:none">✕</button></div></div>`).join('')}
 <datalist id="exdl">${allEx().map(x=>`<option value="${esc(x.name)}">`).join('')}</datalist><button class="btn alt" id="wk_lib">+ Add from exercise library</button><div class="row"><button class="btn alt sm" id="wk_as">+ Sets/reps exercise</button><button class="btn alt sm" id="wk_ac">+ Cardio (time/distance)</button></div>
 <div class="row"><div><label>Total minutes (optional)</label><input id="wk_m" inputmode="numeric" type="number" value="${w.min||''}"></div><div><label>Calories (est.)</label><input id="wk_k" type="number" value="${w.kcal||''}"></div></div>
 <label>Notes</label><textarea id="wk_n" rows="2">${esc(w.notes)}</textarea>
 <button class="btn" id="wk_go">Save workout</button><button class="btn alt" id="wk_tp">Save as template</button>${w.id?'<button class="btn alt" id="wk_del" style="color:var(--bad)">Delete</button>':''}<button class="btn alt" onclick="close()">Cancel</button>`);
  $('#wk_t').value=w.type;
  const est=()=>{const named=w.items.filter(x=>String(x.name).trim()),auto=w.items.reduce((s,x)=>s+('min' in x?(+x.min||0):(+x.sets||0)*2),0),typedM=+$('#wk_m').value,m=typedM||auto;
   $('#wk_m').placeholder=auto?'~'+auto+' (est.)':'e.g. 45';
   const wm=named.reduce((s,x)=>{const mm='min' in x?(+x.min||0):(+x.sets||0)*2;return[s[0]+(findEx(x.name)||{met:x.met||3.5}).met*mm,s[1]+mm]},[0,0]);
   const met=wm[1]?wm[0]/wm[1]:({Strength:3.5,Cardio:6,'Full body':4,Class:5,Swim:5.8}[w.type]||3.5);if(!typedK)$('#wk_k').value=m?estKcal(met,m):''};
  const read=()=>{w.type=$('#wk_t').value;w.date=$('#wk_d').value||logicalToday();w.notes=$('#wk_n').value.trim();w.min=+$('#wk_m').value||+String($('#wk_m').placeholder).replace(/[^0-9]/g,'')||0;w.kcal=+$('#wk_k').value||0;
   document.querySelectorAll('#sheetBody [data-f]').forEach(el=>{const x=w.items[+el.dataset.i];x[el.dataset.f]=el.dataset.f==='name'?el.value:el.value===''?'':+el.value})};
  document.querySelectorAll('#sheetBody [data-f]').forEach(el=>el.oninput=()=>{read();est()});$('#wk_m').oninput=est;$('#wk_k').oninput=()=>typedK=true;$('#wk_t').onchange=()=>{read();est()};est();
  document.querySelectorAll('#sheetBody [data-f=name]').forEach(el=>el.onfocus=()=>{if(el.value.trim())return;read();const i=+el.dataset.i;el.blur();exPicker(x=>{const o=w.items[i];w.items[i]=x.type==='s'?{name:x.name,sets:o.sets||3,reps:o.reps||10,wt:o.wt||''}:{name:x.name,min:o.min||20,dist:o.dist||''};pushRecent(x.name);draw();const f=[...document.querySelectorAll('#sheetBody [data-i="'+i+'"]')].find(e=>e.dataset.f!=='name');if(f){f.focus();f.select&&f.select()}},draw)});
  document.querySelectorAll('#sheetBody [data-rm]').forEach(b=>b.onclick=()=>{read();w.items.splice(+b.dataset.rm,1);draw()});
  $('#wk_as').onclick=()=>{read();w.items.push({name:'',sets:3,reps:10,wt:''});draw()};$('#wk_lib').onclick=()=>{read();exPicker(x=>{w.items=w.items.filter(i=>String(i.name).trim());w.items.push(x.type==='s'?{name:x.name,sets:3,reps:10,wt:''}:{name:x.name,min:20,dist:''});pushRecent(x.name);draw();const f=[...document.querySelectorAll('#sheetBody [data-i="'+(w.items.length-1)+'"]')].find(el=>el.dataset.f!=='name');if(f){f.focus();f.select&&f.select();f.scrollIntoView({block:'center'})}},draw)};$('#wk_ac').onclick=()=>{read();w.items.push({name:'',min:20,dist:''});draw()};
  const clean=()=>{read();w.items=w.items.filter(x=>String(x.name).trim())};
  $('#wk_tp').onclick=()=>{clean();const n=prompt('Template name',w.type+' day');if(!n)return;D.wtemplates.push({name:n,type:w.type,items:w.items,min:w.min,kcal:w.kcal});save();toast('Template saved');draw()};
  $('#wk_go').onclick=()=>{clean();w.est=typedK?0:1;w.items.forEach(x=>pushRecent(x.name));const old=D.workouts.find(x=>x.id===w.id);if(old){const od=old.date;Object.assign(old,w);syncGymDay(od)}else D.workouts.push({...w,id:uid(),ts:Date.now()});syncGymDay(w.date);save();close();render();toast('Workout saved 💪')};
  if(w.id)$('#wk_del').onclick=()=>{D.workouts=D.workouts.filter(x=>x.id!==w.id);syncGymDay(w.date);save();close();render()}};
 draw()}
/* ---------- units (stored: lb, kcal, mi, fl oz; display converts) ---------- */
const U=()=>Object.assign({w:'lb',e:'cal',h:'ft',d:'mi',l:'oz'},D.units||{});
const fW=lb=>U().w==='kg'?r1(lb*0.453592)+' kg':r1(lb)+' lb',wU=()=>U().w,toLb=v=>U().w==='kg'?r1(v/0.453592):v;
const fE=k=>U().e==='kJ'?Math.round(k*4.184).toLocaleString()+' kJ':r0(k).toLocaleString()+' cal',eU=()=>U().e==='kJ'?'kJ':'cal',eN=k=>U().e==='kJ'?Math.round(k*4.184):r0(k);
const fD=mi=>U().d==='km'?r1(mi*1.60934)+' km':mi+' mi';
const CUP=()=>U().l==='ml'?250/29.5735:8,wGoal=()=>U().l==='ml'?Math.max(1,Math.round((D.waterGoal||64)/8))*CUP():(D.waterGoal||64);
const fL=oz=>U().l==='ml'?(Math.round(oz*29.5735/10)*10).toLocaleString()+' ml':r0(oz)+' oz',lU=()=>U().l==='ml'?'ml':'oz',lN=oz=>(U().l==='ml'?Math.round(oz*29.5735/10)*10:r0(oz)).toLocaleString(),cupLbl=()=>U().l==='ml'?'250 ml':'8 oz';
function unitsSheet(){const u=U(),R=[['w','Weight',[['lb','Pounds (lb)'],['kg','Kilograms (kg)']]],['e','Energy',[['cal','Calories'],['kJ','Kilojoules (kJ)']]],['h','Height',[['ft','Feet & inches'],['cm','Centimeters']]],['d','Distance',[['mi','Miles'],['km','Kilometers']]],['l','Liquids',[['oz','Fluid ounces'],['ml','Milliliters']]]];
 sheet(`<h2>Units</h2>${R.map(([k,n,o])=>`<label>${n}</label><div class="seg" data-uk="${k}">${o.map(([v,l])=>`<button data-uv="${v}" class="${u[k]===v?'on':''}">${l}</button>`).join('')}</div>`).join('')}<p class="hint">Your data is stored once and converted for display, so switching is safe.</p><button class="btn" id="un_done">Done</button>`);
 $('#un_done').onclick=()=>close();document.querySelectorAll('[data-uk]').forEach(s=>s.querySelectorAll('button').forEach(b=>b.onclick=()=>{D.units={...U(),[s.dataset.uk]:b.dataset.uv};save();s.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));render()}))}
/* ---------- program: calorie schedule + nutrition strategy ---------- */
const SCH=()=>Object.assign({mode:'even',days:[5,6],extra:300},D.sched||{});
function dayBudget(d){const B=D.budget||1800,s=SCH();if(s.mode!=='weekend'||!s.days.length||s.days.length>=7)return B;const wd=new Date(d+'T12:00').getDay(),n=s.days.length;
 return s.days.includes(wd)?B+s.extra:Math.round(B-s.extra*n/(7-n))}
const STRATS=[['bal','Balanced','Protein from your goal weight, 30% fat, rest carbs'],['hp','High protein','More protein (≈0.9 g per lb goal weight), 30% fat'],['lc','Low carb','About 20% carbs, protein from goal weight, rest fat']];
const ICO={goal:'<path d="M12 3v18M12 4l7 3-7 3"/>',bud:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',sch:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',nut:'<path d="M12 21c-4 0-7-3-7-7 0-5 4-7 7-11 3 4 7 6 7 11 0 4-3 7-7 7z"/>',uni:'<path d="M4 7h16M4 12h10M4 17h6"/>'};
const prow=(id,ic,t,v)=>`<div class="prow tap" id="${id}"><span class="pico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[ic]}</svg></span><div>${t}<small>${v}</small></div><b>›</b></div>`;
function programCard(){const t=logicalToday(),ws=weekStart(t),days=[...Array(7)].map((_,i)=>addDays(ws,i)),bs=days.map(dayBudget),eat=days.map(d=>d<=t?dayTotal(d).kcal:0),mx=Math.max(...bs,...eat)*1.1||1;
 const W=[...D.weights].sort((a,b)=>a.date<b.date?-1:1),last=W.length?W[W.length-1].lb:D.profile?.weight,goal=D.profile?.goal,s=SCH(),st=STRATS.find(x=>x[0]===(D.strat||'bal'));
 const gtxt=last&&goal?(Math.abs(last-goal)<0.5?'At your goal weight 🎉':`${last>goal?'Lose':'Gain'} ${fW(Math.abs(last-goal))} more`):'Set a goal weight';
 return`<div class="card prog"><h2>Program</h2><div class="pchart">${days.map((d,i)=>`<div class="pcol ${d===t?'today':''}"><div class="pbar"><i class="pb" style="height:${Math.round(bs[i]/mx*120)}px"></i><i class="pe ${eat[i]>bs[i]?'over':''}" style="height:${Math.round(eat[i]/mx*120)}px"></i></div><small>${'MTWTFSS'[i]}</small></div>`).join('')}<b class="pline" style="bottom:${20+(D.budget||1800)/mx*120}px"></b></div>
 <div class="plg"><span><i class="pb"></i>Budget</span><span><i class="pe"></i>Eaten</span></div>
 ${prow('pg_goal','goal','Goal',gtxt)}${prow('pg_bud','bud','Budget',`${fE(D.budget||1800)} a day · ${D.budgetMode==='guided'?'Auto':'Custom'}`)}${prow('pg_sch','sch','Calorie Schedule',s.mode==='weekend'?`Weekender · +${s.extra} on ${s.days.map(x=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][x]).join(', ')}`:'Even every day')}${prow('pg_nut','nut','Nutrition Strategy',st[1])}${prow('pg_uni','uni','Units',(u=>`${u.w} · ${u.e} · ${u.d} · ${u.l}`)(U()))}</div>`}
function bindProgram(){if(!$('#pg_goal'))return;$('#pg_goal').onclick=budgetHome;$('#pg_bud').onclick=budgetHome;$('#pg_uni').onclick=unitsSheet;
 $('#pg_nut').onclick=()=>{sheet(`<h2>Nutrition strategy</h2>${STRATS.map(([k,n,d])=>`<button class="choice ${(D.strat||'bal')===k?'on':''}" data-stg="${k}"><b>${n}</b><span>${d}</span></button>`).join('')}<p class="hint">Sets your protein, carb and fat goals. Custom grams in Goals override this.</p>`);
  document.querySelectorAll('[data-stg]').forEach(b=>b.onclick=()=>{D.strat=b.dataset.stg;if(D.strat!=='bal'||1){D.macroGrams=null;D.macroPct={p:30,c:40,f:30}}save();close();render();const g=macroGoal();toast(`Protein ${g.p} g · Carbs ${g.c} g · Fat ${g.f} g`)})};
 $('#pg_sch').onclick=()=>{const s=SCH();const draw=()=>{sheet(`<h2>Calorie schedule</h2><div class="seg" id="sc_m"><button data-m="even" class="${s.mode==='even'?'on':''}">Even</button><button data-m="weekend" class="${s.mode==='weekend'?'on':''}">Weekender</button></div>
  ${s.mode==='weekend'?`<label>Higher-calorie days</label><div class="dayp">${['S','M','T','W','T','F','S'].map((l,i)=>`<button data-wd="${i}" class="${s.days.includes(i)?'on':''}">${l}</button>`).join('')}</div>
  <label>Extra on those days</label><div class="seg" id="sc_x">${[150,300,500].map(v=>`<button data-x="${v}" class="${s.extra===v?'on':''}">+${v}</button>`).join('')}</div>
  <p class="hint">Other days drop by ${s.days.length&&s.days.length<7?Math.round(s.extra*s.days.length/(7-s.days.length)):0} cal so your weekly total stays ${fE((D.budget||1800)*7)}.</p>`:'<p class="hint">Same budget every day.</p>'}<button class="btn" id="sc_go">Save</button>`);
  $('#sc_m').querySelectorAll('button').forEach(b=>b.onclick=()=>{s.mode=b.dataset.m;draw()});document.querySelectorAll('[data-wd]').forEach(b=>b.onclick=()=>{const i=+b.dataset.wd;s.days=s.days.includes(i)?s.days.filter(x=>x!==i):[...s.days,i].sort();draw()});
  document.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{s.extra=+b.dataset.x;draw()});$('#sc_go').onclick=()=>{D.sched=s;save();close();render();toast('Schedule saved')}};draw()}}
/* kJ display: convert "N cal" text and .kc numbers in rendered UI (data stays in kcal) */
const KJR=/(~?)(\d[\d,]*(?:\.\d+)?)(\s?)cal\b/g;
function kjText(s){return s.replace(KJR,(m,t,n,sp)=>t+Math.round(+n.replace(/,/g,'')*4.184).toLocaleString()+sp+'kJ').replace(/\bcal\b(?=\s|$|\)|\/|·)/g,'kJ')}
function kjWalk(root){if(U().e!=='kJ'||!root)return;const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const ns=[];while(tw.nextNode())ns.push(tw.currentNode);
 ns.forEach(n=>{if(n.parentElement&&n.parentElement.closest('[data-kj],input,textarea,select,option'))return;const v=n.nodeValue;if(!/cal\b/.test(v))return;
  if(/^\s*cal\b/.test(v)){const p=n.previousSibling;if(p&&p.nodeType===1&&/^~?[\d,]+$/.test(p.textContent.trim())&&!p.dataset.kj){const t=p.textContent.trim();p.textContent=(t[0]==='~'?'~':'')+Math.round(+t.replace(/[~,]/g,'')*4.184).toLocaleString();p.dataset.kj=1}}
  const nv=kjText(v);if(nv!==v)n.nodeValue=nv});
 root.querySelectorAll('.kc:not([data-kj])').forEach(el=>{const t=el.textContent.trim();if(/^~?[\d,]+$/.test(t)){el.textContent=(t[0]==='~'?'~':'')+Math.round(+t.replace(/[~,]/g,'')*4.184).toLocaleString();el.dataset.kj=1}})}
{let busy=false;const mo=new MutationObserver(()=>{if(busy||U().e!=='kJ')return;busy=true;mo.disconnect();['#view','#sheet','#toast'].forEach(s=>kjWalk($(s)));obs();busy=false});
 const obs=()=>['#view','#sheet','#toast'].forEach(s=>$(s)&&mo.observe($(s),{childList:true,subtree:true,characterData:true}));obs()}
/* ---------- nav / install ---------- */
const views={today,myfoods,gym,activity,progress,history,weight,settings};
function render(){$('#fab').classList.toggle('hidden',!D.budget);if(!D.budget)return budgetHome();nb();views[tab]();pageTitle()}
const TITLES={today:'Summary',myfoods:'My Foods',gym:'Gym',activity:'Streaks',progress:'Progress',history:'History',weight:'Weight',settings:'Settings'};
function pageTitle(){const h=document.querySelector('.top h1');h.innerHTML=`<small>${new Date((tab==='today'?cur:logicalToday())+'T12:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase()}</small>${TITLES[tab]||APP_NAME}`}
function go(t){tab=t;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));window.scrollTo(0,0);render()}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{if(b.dataset.tab==='today')cur=logicalToday();go(b.dataset.tab)});
document.querySelector('.top h1').textContent=APP_NAME;
let deferred=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e});
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;if(standalone)$('#installBtn').classList.add('hidden');
$('#installBtn').onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;return}
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 sheet(`<h2>Get the app</h2>${ios?'<ol><li>Tap the <b>Share</b> button (square with arrow) in Safari</li><li>Tap <b>Add to Home Screen</b></li><li>Tap <b>Add</b></li></ol>':'<p>Open your browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>'}<button class="btn" onclick="close()">Got it</button>`)};
window.close=close;
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
let lastDay=logicalToday();setInterval(()=>{const t=logicalToday();if(t!==lastDay){if(cur===lastDay)cur=t;lastDay=t;if(tab==='today'&&$('#sheet').classList.contains('hidden'))render()}},60000);
/* ---------- floating + quick-log ---------- */
const toastU=(m,undo)=>{const t=$('#toast');t.innerHTML=esc(m)+(undo?' <button id="t_undo" class="tundo">Undo</button>':'');t.classList.remove('hidden');clearTimeout(toast.t);
 if(undo)$('#t_undo').onclick=()=>{undo();save();render();t.classList.add('hidden');toast('Undone')};toast.t=setTimeout(()=>t.classList.add('hidden'),undo?5000:2200)};
const nextMeal=()=>{const L=D.log[cur]||{},mm=visMeals().filter(m=>m.id!=='s');return(mm.find(m=>!(L[m.id]||[]).length)||D.meals.find(m=>m.id==='s')).id};
function fabMenu(){const nm=nextMeal(),d=cur;
 sheet(`<h2>Quick log</h2><div class="fabgrid">
 <button data-fq="food"><span><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v6a2 2 0 0 1-2 2M7 3v6M17 21V3c-2 1-3 4-3 8h3"/></svg></span>Food</button><button data-fq="ex"><span><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="14" cy="4.5" r="1.5"/><path d="m8 21 3-6 3 2v4M6 12l3-3 4 1 2 3h3M11 15l1-5"/></svg></span>Exercise</button><button data-fq="gym"><span><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg></span>Workout</button>
 <button data-fq="steps"><span><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 15c-2 0-3-2-3-5s1-6 3-6 3 3 3 6-1 5-3 5zM5 18h4M17 20c-2 0-3-2-3-5s1-6 3-6 3 3 3 6-1 5-3 5z"/></svg></span>Steps</button><button data-fq="wt"><span><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4 4 0 0 1 6 0L12 12"/></svg></span>Weight</button><button data-fq="scan"><span><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 9v6M11 9v6M14 9v6M17 9v6"/></svg></span>Scan</button></div>
 <label>Food goes to</label><div class="fabmeals">${visMeals().map(m=>`<button class="pill${m.id===nm?' on':''}" data-fm="${m.id}">${esc(m.name)}</button>`).join('')}</div>
 <label>💧 Water</label><div class="row"><button class="btn alt" data-fw="8">+8 oz</button><button class="btn alt" data-fw="16">+16 oz</button></div>`);
 let mid=nm;document.querySelectorAll('[data-fm]').forEach(b=>b.onclick=()=>{mid=b.dataset.fm;document.querySelectorAll('[data-fm]').forEach(x=>x.classList.toggle('on',x===b))});
 document.querySelectorAll('[data-fw]').forEach(b=>b.onclick=()=>{const n=+b.dataset.fw;D.water[d]=(D.water[d]||0)+n;save();close();render();toastU(`+${n} oz water · ${D.water[d]} oz today`,()=>{D.water[d]=Math.max(0,(D.water[d]||0)-n)})});
 const A={food:()=>{close();openAdd(mid)},scan:()=>{close();openAdd(mid);scan(mid)},gym:()=>exSheet(null,null,e=>toast(`Logged ${e.name} · ~${e.kcal} cal`),{gym:1,day:d}),
  ex:()=>exSheet(null,null,e=>{const arr=D.exercise[d]||[];toastU(`Logged ${e.name} · ${e.kcal} cal`,()=>{arr.splice(arr.indexOf(e),1)})}),
  steps:()=>{sheet(`<h2>👟 Steps</h2><input id="fs_n" type="number" inputmode="numeric" class="bigin" placeholder="${(D.steps[d]||0).toLocaleString()}" autofocus>
   <button class="btn" id="fs_go">Set steps</button><div class="row"><button class="btn alt" data-fs="1000">+1,000</button><button class="btn alt" data-fs="5000">+5,000</button></div>`);
   const set=v=>{const was=D.steps[d]||0;D.steps[d]=Math.max(0,Math.round(v));save();close();render();toastU(`Steps: ${D.steps[d].toLocaleString()}`+(was<D.stepGoal&&D.steps[d]>=D.stepGoal?' 🎉 goal hit!':''),()=>{D.steps[d]=was})};
   $('#fs_go').onclick=()=>{const v=+$('#fs_n').value;if(!(v>=0)||$('#fs_n').value==='')return toast('Enter your steps');set(v)};
   document.querySelectorAll('[data-fs]').forEach(b=>b.onclick=()=>set((D.steps[d]||0)+ +b.dataset.fs))},
  wt:()=>{const day=d,prev=D.weights.find(w=>w.date===day),last=[...D.weights].sort((a,b)=>a.date<b.date?-1:1).pop();
   sheet(`<h2>⚖️ Weight · ${nice(d)}</h2><input id="fwt" type="number" step="0.1" inputmode="decimal" class="bigin" placeholder="lb" value="${prev?prev.lb:(last?last.lb:'')}" autofocus><button class="btn" id="fwt_go">Save</button>`);
   $('#fwt_go').onclick=()=>{const v=+$('#fwt').value;if(!(v>60&&v<1000))return toast('Enter your weight in lb');const old=prev?{...prev}:null;
    D.weights=D.weights.filter(w=>w.date!==day);D.weights.push({date:day,lb:r1(v)});save();close();render();
    toastU(`Weight logged: ${r1(v)} lb`,()=>{D.weights=D.weights.filter(w=>w.date!==day);if(old)D.weights.push(old)})}}};
 document.querySelectorAll('[data-fq]').forEach(b=>b.onclick=()=>A[b.dataset.fq]())}
$('#fab').onclick=fabMenu;

render();

/* inline step edit: tap a steps number, type to replace, empty/0 clears */
document.addEventListener('click',ev=>{const el=ev.target.closest('.stepnum');if(!el||el.querySelector('input'))return;ev.stopPropagation();ev.preventDefault();
 const d=el.dataset.sd,v=D.steps[d]||0,w=el.offsetWidth;el.innerHTML=`<input class="stepin" type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" value="${v||''}" placeholder="0" aria-label="Steps" style="width:${Math.max(3,String(v||'').length+1)}ch">`;
 const i=el.querySelector('input');i.oninput=()=>{i.style.width=Math.max(3,i.value.length+1)+'ch'};i.focus({preventScroll:true});i.select();let done=false;
 const fin=ok=>{if(done)return;done=true;const sy=scrollY;if(ok){const raw=i.value.replace(/[^0-9]/g,''),was=v>=D.stepGoal;if(raw===''||+raw===0)delete D.steps[d];else D.steps[d]=Math.round(+raw);save();
   const n=D.steps[d]||0;if(n!==v){toastU(n?`Steps: ${n.toLocaleString()}`+(!was&&n>=D.stepGoal?' 🎉 goal hit!':''):'Steps cleared',()=>{if(v)D.steps[d]=v;else delete D.steps[d]})}}
  render();scrollTo(0,sy)};
 i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();fin(true)}else if(e.key==='Escape')fin(false)};i.onblur=()=>fin(true);i.onclick=e=>e.stopPropagation()},true);
