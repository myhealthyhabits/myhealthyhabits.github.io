import csv,gzip,json,sys
csv.field_size_limit(10**9)
f=gzip.open('off.csv.gz','rt',encoding='utf-8',errors='replace');r=csv.reader(f,delimiter='\t');h=next(r);ix={k:i for i,k in enumerate(h)}
need=['code','product_name','brands','countries_en','unique_scans_n','serving_size','serving_quantity','energy-kcal_100g','energy_100g','proteins_100g','carbohydrates_100g','fat_100g','fiber_100g']
print([k for k in need if k not in ix],file=sys.stderr)
out=[];n=0
def g(row,k):
  i=ix.get(k);return row[i] if i is not None and i<len(row) else ''
for row in r:
  n+=1
  c=g(row,'countries_en');b=g(row,'brands');bl=b.lower()
  sp=('seeq' in bl or 'myprotein' in bl)
  if 'United States' not in c and not sp: continue
  nm=g(row,'product_name').strip()
  if not nm: continue
  try:
    k=g(row,'energy-kcal_100g');k=float(k) if k else (float(g(row,'energy_100g'))/4.184 if g(row,'energy_100g') else 0)
  except: k=0
  if not (0<k<=900): continue
  try:sc=int(float(g(row,'unique_scans_n') or 0))
  except:sc=0
  def fl(x):
    try:return round(float(g(row,x) or 0),2)
    except:return 0
  out.append([sc,sp,{'code':g(row,'code'),'name':nm,'brand':b.split(',')[0].strip(),'ss':g(row,'serving_size'),'sq':fl('serving_quantity'),'n':{'kcal':round(k,1),'p':fl('proteins_100g'),'c':fl('carbohydrates_100g'),'f':fl('fat_100g'),'fb':fl('fiber_100g')}}])
print('rows',n,'us',len(out),file=sys.stderr)
out.sort(key=lambda x:-x[0])
keep=[x for x in out[:45000]]+[x for x in out[45000:] if x[1]]
with open('off_us.ndjson','w') as o:
  for sc,sp,d in keep:d['scans']=sc;o.write(json.dumps(d)+'\n')
with open('off_scans.json','w') as o:json.dump({d['code']:sc for sc,sp,d in out if sc>0},o)
print('kept',len(keep),'seeq/mp',sum(1 for x in keep if x[1]),file=sys.stderr)
