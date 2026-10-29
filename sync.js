/* Optional account + cloud sync (Supabase via plain fetch). Guest mode is default; local data is always the source of truth. */
(()=>{const SB='https://mbmeftdocjazdrgpeftu.supabase.co',AK='sb_publishable__FA1ABf79m6khS0isPDlmQ_2fXh9CKN',SK='mhh-sb',MK='mhh-sync';
const H=t=>({apikey:AK,'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})});
let ses=null;try{ses=JSON.parse(localStorage.getItem(SK)||'null')}catch(e){}
const meta=()=>{try{return JSON.parse(localStorage.getItem(MK)||'{}')}catch(e){return{}}},setMeta=m=>localStorage.setItem(MK,JSON.stringify({...meta(),...m}));
const keepSes=s=>{ses=s?{at:s.access_token,rt:s.refresh_token,exp:Date.now()+(s.expires_in||3600)*1000,email:s.user?.email||ses?.email,uid:s.user?.id||ses?.uid}:null;s?localStorage.setItem(SK,JSON.stringify(ses)):localStorage.removeItem(SK)};
async function api(path,o={}){const r=await fetch(SB+path,{...o,headers:{...H(o.tok),...(o.headers||{})}});const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
 if(!r.ok){const m=j?.msg||j?.error_description||j?.message||j?.error||('Error '+r.status);const e=new Error(m);e.status=r.status;throw e}return j}
async function token(){if(!ses)return null;if(Date.now()<ses.exp-60e3)return ses.at;
 try{keepSes(await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:ses.rt})}));return ses.at}catch(e){if(e.status>=400&&e.status<500){keepSes(null);stat('')}return null}}
/* ---- merge: objects by key, id-arrays by id, other arrays/scalars from the newer side ---- */
const isO=x=>x&&typeof x==='object'&&!Array.isArray(x);
function merge(a,b,bNewer){if(isO(a)&&isO(b)){const o={...a};for(const k in b)o[k]=k in a?merge(a[k],b[k],bNewer):b[k];return o}
 if(Array.isArray(a)&&Array.isArray(b)){const idd=x=>x&&typeof x==='object'&&(x.id!=null||x.ref!=null||x.name!=null);
  if([...a,...b].length&&[...a,...b].every(idd)){const kf=x=>x.id!=null?'i'+x.id:x.ref!=null?'r'+(x.src||'')+x.ref:'n'+x.name;const m=new Map();
   (bNewer?[a,b]:[b,a]).forEach(L=>L.forEach(x=>{const k=kf(x),p=m.get(k);m.set(k,p?merge(p,x,true):x)}));
   const order=(bNewer?b:a).map(kf),rest=[...m.keys()].filter(k=>!order.includes(k));return[...order,...rest].map(k=>m.get(k))}
  return bNewer?b:a}
 if(b===undefined)return a;if(a===undefined)return b;return bNewer?b:a}
/* ---- status ---- */
let stTxt='';function stat(t){stTxt=t;const e=document.getElementById('acct_st');if(e&&e.textContent!==t)e.textContent=t}
let busy=false,again=false,pt=null;
async function sync(mode){if(!ses)return;if(busy){again=true;return}busy=true;
 try{const t=await token();if(!t)return;if(!navigator.onLine){stat('Offline · will sync');return}
  stat('Syncing…');const m=meta(),loc=D.updatedAt||0;
  const rows=await api('/rest/v1/user_data?select=data,updated_at&user_id=eq.'+ses.uid,{tok:t});const R=rows&&rows[0];
  let out=null;
  if(R){const rt=Date.parse(R.updated_at),remoteNew=rt>(m.pulled||0),localNew=loc>(m.pushed||0)||!m.uid||m.uid!==ses.uid;
   if(remoteNew&&localNew){out=merge(D,R.data,(R.data.updatedAt||0)>loc)}
   else if(remoteNew){out=R.data}
   if(out){const keep={};['usdaKey'].forEach(k=>{if(D[k]&&!out[k])keep[k]=D[k]});Object.assign(out,keep);
    const tx=JSON.stringify(out)!==JSON.stringify(D);if(tx){for(const k of Object.keys(D))if(!(k in out))delete D[k];Object.assign(D,out);localStorage.setItem(KEY,JSON.stringify(D));if(typeof render==='function'&&!document.querySelector('#sheet:not(.hidden)'))render()}
    setMeta({pulled:rt,uid:ses.uid});if(!localNew){setMeta({pushed:D.updatedAt||0});stat('Synced');return}}
   else if(!localNew){setMeta({pulled:rt,uid:ses.uid});stat('Synced');return}}
  const now=new Date().toISOString();D.updatedAt=D.updatedAt||Date.now();
  await api('/rest/v1/user_data?on_conflict=user_id',{method:'POST',tok:t,headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:ses.uid,data:D,updated_at:now})});
  setMeta({pushed:D.updatedAt,pulled:Date.parse(now),uid:ses.uid,at:Date.now()});stat('Synced')}
 catch(e){stat(/relation|does not exist|schema cache|PGRST/i.test(e.message)?'Sync not set up yet':'Sync paused · will retry');console.warn('sync',e.message)}
 finally{busy=false;if(again){again=false;setTimeout(()=>sync(),500)}}}
const sv=Store.save.bind(Store);Store.save=d=>{sv(d);if(ses){clearTimeout(pt);pt=setTimeout(()=>sync(),2500)}};
window.addEventListener('focus',()=>sync());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync();else if(pt){clearTimeout(pt);sync()}});window.addEventListener('online',()=>sync());
/* ---- auth ---- */
async function signIn(email,pw){keepSes(await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password:pw})}));setMeta({pulled:0,pushed:0,uid:null});await sync();}
async function signUp(email,pw){const r=await api('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password:pw,options:{emailRedirectTo:location.origin}})});
 if(r?.access_token){keepSes(r);setMeta({pulled:0,pushed:0,uid:null});await sync();return'in'}return'confirm'}
async function signOut(){const t=ses?.at;keepSes(null);localStorage.removeItem(MK);stat('');try{t&&await api('/auth/v1/logout',{method:'POST',tok:t})}catch(e){}}
const $$=s=>document.querySelector(s),es=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sh=h=>{sheet(h);document.querySelectorAll('.au_x').forEach(b=>b.onclick=close)};
function authSheet(mode='in'){const up=mode==='up';sh(`<h2>${up?'Create account':'Sign in'}</h2><p class="mut" style="font-size:13px">Optional. Your data stays on this device either way; an account backs it up and syncs it to your other devices.</p>${gBtn()}${gOn?'<div class="mut gbtn" style="text-align:center;font-size:12px;margin:6px 0">or use email</div>':''}
 <label>Email<input id="au_e" type="email" autocomplete="email" inputmode="email"></label><label>Password<input id="au_p" type="password" autocomplete="${up?'new-password':'current-password'}" minlength="6"></label>
 <p class="mut" id="au_m" style="font-size:13px;min-height:18px"></p><button class="btn" id="au_go">${up?'Create account':'Sign in'}</button>
 <div class="row" style="justify-content:space-between;margin-top:8px"><button class="btn sm alt" id="au_sw">${up?'I have an account':'Create an account'}</button>${up?'':'<button class="btn sm alt" id="au_fp">Forgot password?</button>'}</div><button class="btn alt au_x">Cancel</button><p class="mut" style="text-align:center;font-size:12px;margin-top:8px">By continuing you agree to the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> · <a href="terms.html" target="_blank" rel="noopener">Terms of Service</a>.</p>`);
 bindG();const msg=t=>$$('#au_m').textContent=t;$$('#au_sw').onclick=()=>authSheet(up?'in':'up');
 if(!up)$$('#au_fp').onclick=async()=>{const e=$$('#au_e').value.trim();if(!e)return msg('Enter your email first.');try{await api('/auth/v1/recover',{method:'POST',body:JSON.stringify({email:e,redirect_to:location.origin})});msg('Check your email for a reset link.')}catch(x){msg(x.message)}};
 $$('#au_go').onclick=async()=>{const e=$$('#au_e').value.trim(),p=$$('#au_p').value;if(!e||p.length<6)return msg('Enter your email and a password of at least 6 characters.');
  $$('#au_go').disabled=true;msg(up?'Creating…':'Signing in…');try{if(up&&await signUp(e,p)==='confirm'){msg('Check your email to confirm, then sign in here.');$$('#au_go').disabled=false;return}if(!up)await signIn(e,p);close();toast('Signed in · your data is synced');render()}catch(x){msg(x.message);$$('#au_go').disabled=false}}}
function resetSheet(at){sh(`<h2>Set a new password</h2><label>New password<input id="rp_p" type="password" autocomplete="new-password" minlength="6"></label><p class="mut" id="rp_m" style="font-size:13px;min-height:18px"></p><button class="btn" id="rp_go">Save password</button><button class="btn alt au_x">Cancel</button>`);
 $$('#rp_go').onclick=async()=>{const p=$$('#rp_p').value;if(p.length<6)return $$('#rp_m').textContent='At least 6 characters.';try{await api('/auth/v1/user',{method:'PUT',tok:at,body:JSON.stringify({password:p})});close();toast('Password updated');await sync();render()}catch(x){$$('#rp_m').textContent=x.message}}}
function delSheet(){sh(`<h2>Delete account?</h2><p class="mut">This permanently deletes your account and the cloud copy of your data. Choose whether to also erase the data on this device.</p>
 <label class="row" style="gap:8px"><input type="checkbox" id="dl_loc"> Also erase data on this device</label><p class="mut" id="dl_m" style="font-size:13px;min-height:18px"></p><button class="btn" id="dl_go" style="background:#ff453a">Delete account</button><button class="btn alt au_x">Cancel</button>`);
 $$('#dl_go').onclick=async()=>{try{const t=await token();await api('/rest/v1/rpc/delete_my_account',{method:'POST',tok:t,body:'{}'});const wipe=$$('#dl_loc').checked;await signOut();if(wipe){localStorage.removeItem(KEY);location.reload();return}close();toast('Account deleted · data kept on this device');render()}catch(x){$$('#dl_m').textContent=x.message}}}
/* ---- Google sign-in (shown only once the provider is enabled in Supabase) ---- */
let gOn=localStorage.getItem('mhh-g')==='1';
fetch(SB+'/auth/v1/settings',{headers:{apikey:AK}}).then(r=>r.ok?r.json():null).then(j=>{if(!j)return;const on=!!j.external?.google;if(on!==gOn){gOn=on;localStorage.setItem('mhh-g',on?'1':'0');document.querySelectorAll('.gbtn').forEach(b=>b.hidden=!on)}}).catch(()=>{});
const G_SVG='<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const gBtn=()=>`<button class="btn alt gbtn" ${gOn?'':'hidden'} style="display:flex;align-items:center;justify-content:center;gap:8px">${G_SVG}Continue with Google</button>`;
function google(){localStorage.setItem('mhh-oauth','google');location.href=SB+'/auth/v1/authorize?provider=google&redirect_to='+encodeURIComponent('https://myhealthyhabitsapp.com/')}
const bindG=()=>document.querySelectorAll('.gbtn').forEach(b=>b.onclick=google);
/* ---- UI hooks ---- */
window.acctCard=()=>{const V=document.getElementById('view');if(!V||document.getElementById('acct'))return;const c=document.createElement('div');c.className='card';c.id='acct';
 c.innerHTML=ses?`<h2>Account</h2><p class="mut" style="font-size:14px">${es(ses.email||'Signed in')}<br><small id="acct_st">${es(stTxt||'Synced')}</small></p><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm alt" id="ac_sync">Sync now</button><button class="btn sm alt" id="ac_out">Sign out</button><button class="btn sm alt" id="ac_del" style="color:#ff453a">Delete account</button></div>`
 :`<h2>Account</h2><p class="mut" style="font-size:14px">You're using guest mode. Everything works without an account; sign in to back up and sync across devices.</p><div class="row" style="gap:8px"><button class="btn sm" id="ac_up">Create account</button><button class="btn sm alt" id="ac_in">Sign in</button></div><div style="margin-top:8px">${gBtn()}</div>`;
 V.prepend(c);bindG();if(ses){$$('#ac_sync').onclick=()=>sync();$$('#ac_out').onclick=async()=>{await signOut();toast('Signed out · data stays on this device');render()};$$('#ac_del').onclick=delSheet}else{$$('#ac_up').onclick=()=>authSheet('up');$$('#ac_in').onclick=()=>authSheet('in')}};
window.acctPrompt=()=>{if(ses||localStorage.getItem('mhh-acct-nudge'))return;const days=Object.keys(D.log||{}).filter(d=>Object.values(D.log[d]||{}).some(a=>a&&a.length)).length;if(days<3)return;
 const V=document.getElementById('view');if(!V||document.getElementById('acct_nudge'))return;const c=document.createElement('div');c.className='card';c.id='acct_nudge';
 c.innerHTML=`<div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px"><div style="font-size:14px">☁️ <b>Back up your log?</b><br><span class="mut">Optional free account keeps your data safe and synced across devices.</span></div><button class="btn sm alt" id="an_x" aria-label="Dismiss" style="flex:none">✕</button></div><button class="btn sm" id="an_go" style="margin-top:8px">Create account</button>`;
 V.append(c);$$('#an_x').onclick=()=>{localStorage.setItem('mhh-acct-nudge','1');c.remove()};$$('#an_go').onclick=()=>authSheet('up')};
/* ---- start: handle email links (confirm / recovery), then pull ---- */
const hp=new URLSearchParams(location.hash.slice(1));
if(hp.get('access_token')){const s={access_token:hp.get('access_token'),refresh_token:hp.get('refresh_token'),expires_in:+hp.get('expires_in')||3600};history.replaceState(null,'',location.pathname+location.search);
 const oa=localStorage.getItem('mhh-oauth');localStorage.removeItem('mhh-oauth');
 api('/auth/v1/user',{tok:s.access_token}).then(u=>{const fresh=!ses||ses.uid!==u.id;keepSes({...s,user:u});if(hp.get('type')==='recovery')resetSheet(s.access_token);else{if(fresh)setMeta({pulled:0,pushed:0,uid:null});toast(oa?'Signed in with Google · your data is synced':'Email confirmed · signed in');sync().then(()=>typeof render==='function'&&render())}}).catch(()=>{})}
else if(hp.get('error_description')){localStorage.removeItem('mhh-oauth');history.replaceState(null,'',location.pathname+location.search);setTimeout(()=>toast(hp.get('error_description')),500)}
else if(ses)sync();
window.MHHSync={sync,merge,get signedIn(){return!!ses}};
})();
