import json,subprocess,os
T=open('/workspace/secrets/supabase_token.txt').read().strip()
import urllib.request
def q(sql):
  req=urllib.request.Request('https://api.supabase.com/v1/projects/mbmeftdocjazdrgpeftu/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+T,'Content-Type':'application/json','User-Agent':'mhh-loader'})
  with urllib.request.urlopen(req,timeout=120) as r:return r.read().decode()
#
rows=[json.loads(l) for l in open('canned.ndjson')]
B=1500
for i in range(0,len(rows),B):
  ch=[{'ref':r['ref'],'src':r['src'],'kind':r['kind'],'pop':r['pop'],'gtin':r['gtin'],'cn':r['cn'],'full_name':r['full'],'brand':r['brand'],'raw':r['raw']} for r in rows[i:i+B]]
  s=json.dumps(ch).replace("$J$","")
  q("insert into public.food_lib(ref,src,kind,pop,gtin,cn,full_name,brand,raw) select ref,src,kind,pop,gtin,cn,full_name,brand,raw from jsonb_to_recordset($J$"+s+"$J$::jsonb) as x(ref text,src text,kind text,pop int,gtin text,cn text,full_name text,brand text,raw jsonb) on conflict (ref) do nothing")
  if i%15000==0:print(i,flush=True)
print(q("select count(*) from public.food_lib"))
