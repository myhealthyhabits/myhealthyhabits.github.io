/* Nutrition Facts label parser (works on OCR text). Returns per-serving values + confidence per field. */
function parseLabel(raw){
 let t=String(raw||'').replace(/\r/g,'');
 const cut=t.search(/percent daily values|daily value[s]?\s*(\(dv\)\s*)?(tells|are based)|calories\s*:?\s*2[,.]?000\s+2[,.]?500/i);if(cut>80)t=t.slice(0,cut);
 const L=t.split('\n').map(s=>s.trim()).filter(Boolean),out={},conf={};
 // fix OCR digit noise in a value token; returns [number, fixed?]
 const num=s=>{let fx=false,x=s.replace(/\b[Oo](?=\s*(m?g|mcg)\b)/g,'0').replace(/\b[il](?=\s*g\b)/g,()=>{fx=true;return'1'}).replace(/(?<=\d)[Oo]|[Oo](?=\d)/g,()=>{fx=true;return'0'}).replace(/(?<=\d)[lI|]|[lI|](?=\d)/g,()=>{fx=true;return'1'}).replace(/(\d),(\d{3})/g,'$1$2');return[x,fx]};
 const LT=/less than|<\s*(?=\d)/i;
 function grab(re,unit){for(let i=0;i<L.length;i++){const m=L[i].match(re);if(!m)continue;let rest=L[i].slice(m.index+m[0].length);
   if(/^\s*(from|per)\b/i.test(rest))continue;
   let [r,fx]=num(rest),lt=LT.test(r);
   // value with unit, not a %; OCR reads trailing g as 9: "0.59" "59 7%"
   let mm=r.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*('+unit+')(?![a-z%])','i'));let low=fx;
   if(!mm&&unit==='g'){const m2=r.match(/(\d+(?:\.\d+)?)9(?=\s|$)(?!\s*%)/);if(m2){mm=[0,m2[1]];low=true}}
   if(!mm){const m3=r.match(/(\d+(?:\.\d+)?)(?!\s*%|\d)/);if(m3){let v=m3[1];if(unit==='g'&&/9$/.test(v)&&+v>=100)v=v.slice(0,-1);mm=[0,v];low=true}}
   if(mm){let v=+mm[1];if(lt)v=v>=1?0.5:v/2;return[v,low]}}return null}
 const set=(k,r)=>{if(r){out[k]=r[0];conf[k]=r[1]?'low':'ok'}else conf[k]='missing'};
 // calories: same line or the next line with a bare number; skip "calories from fat" & "2,000 calorie"
 let cal=null;for(let i=0;i<L.length&&cal==null;i++){let ln=L[i].replace(/calories\s*from\s*fat.*$/i,'');if(!/calor[il1]es|ca[l1]ories|calorias|^ca\S{0,2}\s*o?s\b/i.test(ln)||/2[,.]?000|diet/i.test(ln))continue;
  const after=num(ln.replace(/.*?(calor\S*|ca[l1]ories|^ca\S{0,2}\s*o?s)/i,''))[0];let m=after.match(/(\d{1,4})(?!\s*%|\d)/);let low=false;
  if(!m&&L[i+1]){m=num(L[i+1])[0].match(/^\D{0,3}(\d{1,4})\b(?!\s*%)/);low=!m?false:false}
  if(m)cal=[+m[1],low||+m[1]<5||!/calor|calories/i.test(ln)]}
 if(!cal){const m=t.match(/amount per serving[\s\S]{0,40}?(\d{2,4})/i);if(m)cal=[+m[1],true]}
 if(cal&&cal[0]<5)cal=null;set('kcal',cal);
 set('f',grab(/total\s*fat|^fat\b/i,'g'));set('sf',grab(/satu?r?a?t?e?d?\s*fat|sat\.?\s*fat/i,'g'));
 set('na',grab(/sodium|sod[il1]um/i,'mg'));set('c',grab(/(total\s*)?carbo?hy?d?r?a?t?e?s?|carbs?\b/i,'g'));
 set('fb',grab(/(dietary\s*)?fi[bh]e?r/i,'g'));set('sg',grab(/(total\s*)?sugars?/i,'g'));set('p',grab(/prote[il1]n/i,'g'));
 // serving size text + grams
 const ssl=L.findIndex(s=>/serving\s*s[il1]z?e/i.test(s));if(ssl>=0){let s=L[ssl].replace(/.*?serving\s*s[il1]z?e\s*[:\/]?\s*/i,'');if((s.length<3||!/\d/.test(s))&&L[ssl+1])s=L[ssl+1];s=num(s)[0];
  out.ss=s.replace(/\s{2,}/g,' ').replace(/[~_|]/g,'').trim().slice(0,40);const g=(s.match(/\((?:\D{0,4})?(\d+(?:\.\d+)?)\s*(g|ml)\b/i)||s.match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i));
  if(g){out.g=+g[1];conf.g='ok'}else conf.g='missing';conf.ss=out.ss?'ok':'missing'}else conf.ss=conf.g='missing';
 const sp=t.match(/(about|approx\.?)?\s*(\d+(?:\.\d+)?)\s*servings?\s*per\s*c/i)||t.match(/servings?\s*per\s*container\s*(about|approx\.?)?\s*(\d+(?:\.\d+)?)/i);
 if(sp){out.spc=+sp[2];conf.spc='ok'}else conf.spc='missing';
 // sanity: Atwater check flags calories
 if(out.kcal!=null&&out.p!=null&&out.c!=null&&out.f!=null){const est=4*out.p+4*out.c+9*out.f;if(est>20&&Math.abs(est-out.kcal)/est>0.3)conf.kcal='low'}
 return{v:out,conf}}
/* v85: photo quality (blur / glare / dark) measured on a small grey copy */
function labelQuality(c){const W=480,k=W/c.width,w=W,h=Math.max(1,Math.round(c.height*k)),t=document.createElement('canvas');t.width=w;t.height=h;const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,w,h);
 const d=x.getImageData(0,0,w,h).data,g=new Float32Array(w*h);let sum=0;for(let i=0;i<w*h;i++){g[i]=d[i*4]*.299+d[i*4+1]*.587+d[i*4+2]*.114;sum+=g[i]}
 const x0=w*.12|0,x1=w*.88|0,y0=h*.12|0,y1=h*.88|0;let n=0,m=0,m2=0,hot=0,cn=0,edge=0;
 for(let y=y0;y<y1;y++)for(let X=x0;X<x1;X++){const i=y*w+X,v=g[i],L=4*v-g[i-1]-g[i+1]-g[i-w]-g[i+w];m+=L;m2+=L*L;n++;if(v>=250)hot++;const gx=Math.abs(g[i+1]-g[i-1]);if(gx>40)edge++;cn++}
 const lv=m2/n-(m/n)**2;return{blur:lv,glare:hot/cn,mean:sum/(w*h),edges:edge/cn}}
const labelIssue=q=>q.mean<60?'dark':q.blur<150&&q.edges<0.04?'blurry':'';  // glare is judged by the AI reader (paper-white labels look like glare to simple pixel counts)
/* v85: AI label reader (server-side Gemini) -> same {v,conf} shape the review screen uses */
async function labelAI(c,big){const k=Math.min(1,(big?2200:1600)/Math.max(c.width,c.height)),t=document.createElement('canvas');t.width=Math.round(c.width*k);t.height=Math.round(c.height*k);t.getContext('2d').drawImage(c,0,0,t.width,t.height);
 const img=t.toDataURL('image/jpeg',.85);const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),20000);
 try{let tok='';try{tok=(JSON.parse(localStorage.getItem('mhh-sb')||'null')||{}).at||''}catch(e){}
  const r=await fetch(window.MS_MOCK||MS_URL,{method:'POST',signal:ac.signal,headers:{'Content-Type':'application/json',apikey:MS_AK,Authorization:'Bearer '+(tok||MS_AK)},body:JSON.stringify({mode:'label',image:img})});
  if(!r.ok)return{err:r.status===429?'limit':'server'};const j=await r.json(),L=j&&j.label;if(!L)return{err:'server'};
  const v={},conf={},un=new Set(L.unsure||[]),M={kcal:'kcal',f:'fat_g',sf:'sat_fat_g',c:'carbs_g',fb:'fiber_g',sg:'sugar_g',p:'protein_g',na:'sodium_mg'};
  for(const[a,b]of Object.entries(M)){const x=+L[b];if(isFinite(x)&&x>=0){v[a]=Math.round(x*10)/10;conf[a]=un.has(b)?'low':'ok'}else conf[a]='missing'}
  if(L.serving_size&&L.serving_size!=='-1'){v.ss=String(L.serving_size).slice(0,40);conf.ss='ok'}else conf.ss='missing';
  if(+L.serving_g>0){v.g=+L.serving_g;conf.g=un.has('serving_g')?'low':'ok'}else conf.g='missing';
  if(+L.servings_per_container>0){v.spc=+L.servings_per_container;conf.spc='ok'}else conf.spc='missing';
  if(v.kcal!=null&&v.p!=null&&v.c!=null&&v.f!=null){const est=4*v.p+4*v.c+9*v.f;if(est>20&&Math.abs(est-v.kcal)/est>0.3)conf.kcal='low'}
  return{lab:{v,conf,src:'ai'},issue:L.issue||'ok'}}catch(e){return{err:'net'}}finally{clearTimeout(tm)}}
const labelWarm=()=>{try{fetch(MS_URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:MS_AK,Authorization:'Bearer '+MS_AK},body:'{"mode":"ping"}'}).catch(()=>{})}catch(e){}};
/* on-device fallback: grey + contrast stretch before Tesseract */
function labelPrep(c){const t=document.createElement('canvas');t.width=c.width;t.height=c.height;const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0);const im=x.getImageData(0,0,t.width,t.height),d=im.data;let lo=255,hi=0;const H=new Uint32Array(256);
 for(let i=0;i<d.length;i+=4){const v=d[i]*.299+d[i+1]*.587+d[i+2]*.114|0;d[i]=v;H[v]++}let acc=0,N=d.length/4;for(let v=0;v<256;v++){acc+=H[v];if(acc>N*.02&&lo===255)lo=v;if(acc>N*.98){hi=v;break}}const s=255/Math.max(1,hi-lo);
 for(let i=0;i<d.length;i+=4){const v=Math.max(0,Math.min(255,(d[i]-lo)*s));d[i]=d[i+1]=d[i+2]=v}x.putImageData(im,0,0);return t}
if(typeof module!=='undefined')module.exports={parseLabel};
