const fs=require('fs'),rl=require('readline');const {cleanName}=require('./cn.js');
const NUT=new Set([1008,2047,2048,1003,1005,1004,1079]);const NUTN={'208':1008,'203':1003,'205':1005,'204':1004,'291':1079};
const scans=JSON.parse(fs.readFileSync('off_scans.json','utf8'));
const out=fs.createWriteStream('foods.ndjson');let cnt={};
const titled=s=>s.charAt(0)+s.slice(1).toLowerCase();
function emit(src,x,meta){const f=src==='usda'?{src:'usda',dt:x.dataType,branded:x.dataType==='Branded',name:x.dataType==='Branded'?titled(x.description).replace(/\b\w/g,c=>c.toUpperCase()):x.description,brand:(x.brandName||x.brandOwner||'').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).replace(/'S\b/g,"'s")}:{src:'off',name:x.product_name,brand:(x.brands||'').split(',')[0].trim()};
 let cn='';try{cn=cleanName(f)}catch(e){cn=f.name}
 out.write(JSON.stringify({ref:src+':'+(src==='usda'?x.fdcId:x.code),src,kind:meta.kind,pop:meta.pop||0,gtin:meta.gtin||null,cn,full:f.name,brand:f.brand,raw:x})+'\n');cnt[meta.kind]=(cnt[meta.kind]||0)+1}
function usdaRaw(d){const fn=[];(d.foodNutrients||[]).forEach(n=>{const id=n.nutrient&&(n.nutrient.id);const id2=NUT.has(id)?id:NUTN[n.nutrient&&n.nutrient.number];if(id2&&n.amount!=null&&!fn.some(z=>z.nutrientId===id2))fn.push({nutrientId:id2,value:+(+n.amount).toFixed(2)})});
 const fm=[];(d.foodPortions||[]).forEach(p=>{if(!p.gramWeight)return;let t=p.portionDescription&&p.portionDescription!=='Quantity not specified'?p.portionDescription:((p.amount||1)+' '+(p.modifier&&isNaN(+p.modifier)?p.modifier:(p.measureUnit&&p.measureUnit.name!=='undetermined'?p.measureUnit.name:''))).trim();if(t&&!/^\d+(\.\d+)?$/.test(t))fm.push({gramWeight:p.gramWeight,disseminationText:t})});
 const x={fdcId:d.fdcId,description:d.description,dataType:d.dataType==='Survey (FNDDS)'||d.foodClass==='Survey'?'Survey (FNDDS)':d.dataType,foodNutrients:fn,foodMeasures:fm.slice(0,5)};
 if(d.dataType==='Branded'){Object.assign(x,{servingSize:d.servingSize,servingSizeUnit:d.servingSizeUnit,householdServingFullText:d.householdServingFullText,brandName:d.brandName,brandOwner:d.brandOwner})}return x}
const kc=x=>{const g=id=>(x.foodNutrients.find(n=>n.nutrientId===id)||{}).value||0;return g(1008)||g(2047)||g(2048)};
async function lines(file,cb){const r=rl.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity});for await(let l of r){l=l.trim().replace(/,$/,'');if(!l.startsWith('{"'))continue;let d;try{d=JSON.parse(l)}catch(e){continue}cb(d)}}
(async()=>{
 await lines('FoodData_Central_foundation_food_json_2025-12-18.json',d=>{const x=usdaRaw(d);if(kc(x))emit('usda',x,{kind:'base'})});
 await lines('FoodData_Central_sr_legacy_food_json_2018-04.json',d=>{const x=usdaRaw(d);if(kc(x))emit('usda',x,{kind:'base'})});
 await lines('surveyDownload.json',d=>{d.dataType='Survey (FNDDS)';const x=usdaRaw(d);if(kc(x))emit('usda',x,{kind:'survey'})});
 const br=[];const seen=new Set();
 await lines('FoodData_Central_branded_food_json_2025-04-24.json',d=>{const g=(d.gtinUpc||'').replace(/^0+/,'');const sc=scans[d.gtinUpc]||scans[g]||scans['0'+g]||scans['00'+g]||0;const bo=((d.brandOwner||'')+' '+(d.brandName||'')).toLowerCase();const sp=/seeq|myprotein/.test(bo);if(!sc&&!sp)return;if(seen.has(g))return;seen.add(g);const x=usdaRaw(d);if(!kc(x))return;br.push([sc+(sp?1e6:0),x,g])});
 br.sort((a,b)=>b[0]-a[0]);const keepB=br.slice(0,60000);keepB.forEach(([sc,x,g])=>emit('usda',x,{kind:'branded',pop:sc>=1e6?sc-1e6:sc,gtin:g}));
 const bg=new Set(keepB.map(b=>b[2]));
 await lines('off_us.ndjson',d=>{const g=d.code.replace(/^0+/,'');if(bg.has(g))return;const sq=d.sq;const x={code:d.code,product_name:d.name,brands:d.brand,serving_size:d.ss,serving_quantity:sq||undefined,nutriments:{'energy-kcal_100g':d.n.kcal,proteins_100g:d.n.p,carbohydrates_100g:d.n.c,fat_100g:d.n.f,fiber_100g:d.n.fb}};emit('off',x,{kind:'branded',pop:d.scans,gtin:g})});
 out.end();console.log(cnt)})();
