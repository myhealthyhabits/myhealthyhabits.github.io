import csv,gzip,json,re
csv.field_size_limit(10**9)
BR=re.compile(r"\b(kroger|great value|walmart|del ?monte|green giant|bush'?s|hunt'?s|campbell'?s|libby'?s|dole|goya|progresso|s ?& ?w|allens|la sierra|rosarita|old el paso|chef boyardee|amy'?s|hormel|van camp|ro-?tel|cento|muir glen|le sueur|seneca|veg-?all|food club|clover valley|simple truth|private selection|our family|hy-?vee|signature select|essential everyday|market pantry|good & gather|member'?s mark|kirkland|happy harvest)\b",re.I)
CAT=re.compile(r"canned|soup|bean|vegetable|fruit|tomato|sauce|chili|stew|broth|pickle|olive|tuna|corn|peas|pumpkin",re.I)
have=set(open('have_gtin.txt').read().split('\n'))|set(json.loads(l)['gtin'] for l in open('canned.ndjson'))
f=gzip.open('off.csv.gz','rt',encoding='utf-8',errors='replace');r=csv.reader(f,delimiter='\t');h=next(r);ix={k:i for i,k in enumerate(h)}
def g(row,k):
  i=ix.get(k);return row[i] if i is not None and i<len(row) else ''
def fl(row,x):
  try:return round(float(g(row,x) or 0),2)
  except:return 0
o=open('off_canned.ndjson','w');n=0
for row in r:
  b=g(row,'brands')
  if not BR.search(b) or 'United States' not in g(row,'countries_en'):continue
  nm=g(row,'product_name').strip()
  if not nm or not CAT.search(nm+' '+g(row,'categories_en')):continue
  code=g(row,'code');gt=code.lstrip('0')
  if gt in have:continue
  k=fl(row,'energy-kcal_100g')
  if not 0<k<=900:continue
  have.add(gt);n+=1
  try:sc=int(float(g(row,'unique_scans_n') or 0))
  except:sc=0
  o.write(json.dumps({'code':code,'name':nm,'brand':b.split(',')[0].strip(),'ss':g(row,'serving_size'),'sq':fl(row,'serving_quantity'),'scans':sc,'n':{'kcal':k,'p':fl(row,'proteins_100g'),'c':fl(row,'carbohydrates_100g'),'f':fl(row,'fat_100g'),'fb':fl(row,'fiber_100g')}})+'\n')
print('off canned added',n)
