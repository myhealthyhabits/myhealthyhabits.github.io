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
if(typeof module!=='undefined')module.exports={parseLabel};
