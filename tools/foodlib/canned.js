const fs=require('fs'),rl=require('readline');const {cleanName}=require('./cn.js');
const BR=/\b(kroger|great value|walmart|del ?monte|green giant|bush'?s|hunt'?s|campbell'?s|libby'?s|dole|goya|progresso|s ?& ?w|allens|margaret holmes|la sierra|rosarita|old el paso|chef boyardee|amy'?s|wolfgang|hormel|van camp|ro-?tel|cento|muir glen|furmano|le sueur|seneca|veg-?all|food club|clover valley|simple truth|private selection|our family|hy-?vee|signature select|essential everyday|market pantry|good & gather|member'?s mark|kirkland|aldi|happy harvest|dakota'?s pride|libbys)\b/i;
const CAT=/canned|soup|bean|vegetable|fruit|tomato|pasta sauce|chili|stew|broth|pickle|olive|tuna|chicken|salmon|meat|pumpkin|sauerkraut|corn|peas/i;
const have=new Set(fs.readFileSync('have_gtin.txt','utf8').split('\n'));
const scans=JSON.parse(fs.readFileSync('off_scans.json','utf8'));
const NUT=new Set([1008,2047,2048,1003,1005,1004,1079]);
const out=fs.createWriteStream('canned.ndjson');let n=0;const seen=new Set();
const titled=s=>s.charAt(0)+s.slice(1).toLowerCase();
(async()=>{const r=rl.createInterface({input:fs.createReadStream('FoodData_Central_branded_food_json_2025-04-24.json')});
for await(let l of r){l=l.trim().replace(/,$/,'');if(!l.startsWith('{"'))continue;if(!BR.test(l.slice(0,3000)))continue;let d;try{d=JSON.parse(l)}catch(e){continue}
 const bo=(d.brandOwner||'')+' '+(d.brandName||'');if(!BR.test(bo))continue;if(!CAT.test((d.brandedFoodCategory||'')+' '+d.description))continue;
 const g=(d.gtinUpc||'').replace(/^0+/,'');if(!g||have.has(g)||seen.has(g))continue;seen.add(g);
 const fn=[];(d.foodNutrients||[]).forEach(x=>{const id=x.nutrient&&x.nutrient.id;if(NUT.has(id)&&x.amount!=null&&!fn.some(z=>z.nutrientId===id))fn.push({nutrientId:id,value:+(+x.amount).toFixed(2)})});
 const x={fdcId:d.fdcId,description:d.description,dataType:'Branded',foodNutrients:fn,foodMeasures:[],servingSize:d.servingSize,servingSizeUnit:d.servingSizeUnit,householdServingFullText:d.householdServingFullText,brandName:d.brandName,brandOwner:d.brandOwner};
 const kc=(fn.find(z=>z.nutrientId===1008)||{}).value;if(kc==null)continue;
 const f={src:'usda',dt:'Branded',branded:true,name:titled(x.description).replace(/\b\w/g,c=>c.toUpperCase()),brand:(x.brandName||x.brandOwner||'').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).replace(/'S\b/g,"'s")};
 let cn;try{cn=cleanName(f)}catch(e){cn=f.name}
 out.write(JSON.stringify({ref:'usda:'+x.fdcId,src:'usda',kind:'branded',pop:scans[d.gtinUpc]||0,gtin:g,cn,full:f.name,brand:f.brand,raw:x})+'\n');n++}
out.end();console.log('usda canned added',n)})();
