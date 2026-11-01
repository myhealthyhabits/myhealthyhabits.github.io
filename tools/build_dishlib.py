"""Build dishlib.js from USDA FoodData Central FNDDS ("Survey Foods", 2024-10-31 release).
Download: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip
Nutrients (per 100 g) and portion gram weights are copied straight from FNDDS. Nothing is invented:
friendly names below only point at an existing FNDDS food code."""
import json,re,sys
L=json.load(open(sys.argv[1]))['SurveyFoods']
BY={x['description']:x for x in L}
CATS={'Bean, pea, legume dishes','Burgers','Burritos and tacos','Cheese sandwiches','Chicken fillet sandwiches','Chicken patties, nuggets and tenders','Coleslaw, non-lettuce salads','Deli and cured meat sandwiches','Egg rolls, dumplings, sushi','Egg/breakfast sandwiches','Frankfurter sandwiches','Fried rice and lo/chow mein','Lettuce and lettuce salads','Macaroni and cheese','Meat and BBQ sandwiches','Meat mixed dishes','Nachos','Other Mexican mixed dishes','Pasta mixed dishes, excludes macaroni and cheese','Pizza','Poultry mixed dishes','Ramen and Asian broth-based soups','Rice mixed dishes','Seafood mixed dishes','Seafood sandwiches','Soups, broth-based','Soups, cream-based','Stir-fry and soy-based sauce mixtures','Vegetable dishes','Vegetable sandwiches/burgers','French fries and other fried white potatoes','Mashed potatoes and white potato mixtures'}
BAD=re.compile(r'frozen meal|frozen entree|school|canned|baby|as ingredient|ready-to-heat|NS as to|excluding|including carrots|Puerto Rican|from frozen|from precooked|from other sources|light mayonnaise|fat free|Topping from|reported separately|dry mix|condensed|prepared with water|diet|reduced sodium|lowfat|low sodium|whole grain|\bnuggets,? boneless|on wheat|wheat bread|whole wheat|on rye|Rice, brown|brown rice|no added fat|fat added|souffle|\blight\b|dessert|, raw|creamed|NS as to|made with any|mayonnaise-type|Italian dressing|imitation|, with fruit|with nuts|gizzard|liver|tongue|chitterling|tripe|blood',re.I)
# Friendly names -> exact FNDDS description, extra search words
CUR=[
("Thai yellow curry with chicken","Chicken curry","yellow curry thai massaman"),("Thai red curry with chicken","Chicken curry","red curry thai panang"),("Thai green curry with chicken","Chicken curry","green curry thai"),
("Yellow curry with chicken and rice","Chicken curry with rice","thai yellow curry rice"),("Beef curry","Beef curry",""),("Vegetable curry","Vegetable curry","veggie tofu"),("Shrimp or fish curry","Fish curry","seafood prawn curry"),("Lentil curry (dal)","Lentil curry","dal dhal daal lentil"),
("Pad thai with chicken","Pad Thai with chicken","padthai"),("Pad thai with shrimp","Pad Thai with seafood","padthai prawn"),("Pad thai with beef or pork","Pad Thai with meat","padthai"),("Pad thai, vegetarian","Pad Thai, meatless","padthai tofu veggie"),
("Sweet and sour chicken","Sweet and sour chicken or turkey","chinese"),("Sweet and sour pork","Sweet and sour pork","chinese"),("Sweet and sour shrimp","Sweet and sour shrimp",""),
("Orange chicken","Orange chicken","chinese panda"),("General Tso's chicken","General Tso chicken","tsos tso chinese"),("Sesame chicken","Sesame chicken","chinese"),("Kung pao chicken","Kung pao chicken","chinese"),("Beef and broccoli","Beef and broccoli","chinese broccoli beef"),("Teriyaki chicken","Chicken or turkey with teriyaki","japanese"),("Steak teriyaki","Steak teriyaki","beef"),
("Miso soup","Soup, miso or tofu","japanese"),("Pho with beef","Soup, pho, with meat","vietnamese noodle soup"),("Ramen with pork and egg","Ramen bowl with meat and egg","tonkotsu noodle"),("Chicken ramen bowl","Ramen bowl with chicken","noodle"),("Wonton soup","Soup, wonton",""),("Hot and sour soup","Soup, hot and sour",""),
("Chicken fried rice","Rice, fried, with chicken","friedrice"),("Shrimp fried rice","Rice, fried, with shrimp","friedrice"),("Pork fried rice","Rice, fried, with pork","friedrice"),("Beef fried rice","Rice, fried, with beef","friedrice"),("Vegetable fried rice","Rice, fried, meatless","friedrice veggie"),
("Chicken lo mein","Lo mein, with chicken","noodles"),("Shrimp lo mein","Lo mein, with shrimp","noodles"),("Beef lo mein","Lo mein, with beef","noodles"),("Vegetable lo mein","Lo mein, meatless","noodles"),
("Spaghetti with meat sauce","Pasta with tomato-based sauce and meat, home recipe","spaghetti bolognese meatsauce"),("Spaghetti with marinara","Pasta with tomato-based sauce, home recipe","spaghetti tomato sauce"),("Chicken alfredo","Pasta with cream sauce and poultry, home recipe","fettuccine alfredo"),("Fettuccine alfredo","Pasta with cream sauce, home recipe","alfredo pasta"),
("Lasagna with meat","Lasagna with meat, home recipe",""),("Mac and cheese","Macaroni or noodles with cheese","macaroni cheese maccheese"),
("Caesar salad with chicken","Chicken or turkey caesar garden salad, chicken and/or turkey, lettuce, tomato, cheese, no dressing","grilled chicken"),("Caesar salad","Caesar salad, with romaine, no dressing",""),("Cobb salad","Cobb salad, no dressing",""),("Greek salad","Greek Salad, no dressing",""),
("Chili with beans and meat","Chili with meat and beans","chili con carne"),("Chili, restaurant","Chili with meat, from restaurant",""),
("Hamburger","Hamburger, NFS","burger"),("Cheeseburger","Cheeseburger, NFS","burger"),("Burrito with beef, beans and rice","Burrito, beef, with beans and rice, cheese","chipotle"),("Burrito","Burrito, NFS",""),
("Pizza slice, cheese","Pizza, cheese, from restaurant or fast food, NS as to type of crust","cheese pizza"),
("Biryani with chicken","Biryani with chicken","indian"),("Bibimbap","Bibimbap, Korean","korean"),("Gyro","Gyro sandwich","greek"),("Falafel","Falafel",""),("Egg roll","Egg roll, with beef and/or pork",""),("Potstickers / fried dumplings","Wonton, dumpling or pot sticker, fried","gyoza dumpling"),("Steamed dumplings","Wonton, dumpling or pot sticker, steamed","gyoza dumpling"),
("California roll","Sushi roll, California","sushi"),("Chicken quesadilla","Quesadilla, chicken",""),("Chicken enchilada","Enchilada, chicken",""),("Chicken fajitas","Fajita, chicken",""),("Beef nachos","Nachos, beef or pork, with beans","nachos"),
("Chicken tenders","Chicken tenders or strips, breaded, from restaurant","strips fingers"),("Chicken wings","Chicken \"wings\" with hot sauce, from fast food / restaurant","buffalo wings"),("Chicken pot pie","Pot pie, chicken",""),("Shepherd's pie","Shepherd's pie",""),
("Jambalaya","Jambalaya with meat and rice",""),("Gumbo with rice","Gumbo with rice",""),("Paella","Paella with seafood",""),("Clam chowder","Soup, New England clam chowder",""),("Grilled cheese","Grilled cheese sandwich, NFS","sandwich"),("Club sandwich","Club sandwich or sub, restaurant","sub"),("Philly cheesesteak","Cheese steak sandwich or sub on white","cheesesteak"),("Reuben","Reuben sandwich",""),("Meatball sub","Meatball sandwich or sub",""),
("Egg foo young","Egg foo yung, NFS","yung"),("Moo goo gai pan","Moo Goo Gai Pan",""),("Chicken chow mein","Chicken or turkey chow mein or chop suey with noodles",""),
]
N={'208':'kcal','203':'p','205':'c','204':'f','291':'fb','606':'sf','307':'na'}
def nut(x):
  d={}
  for n in x['foodNutrients']:
    k=N.get(n['nutrient']['number'])
    if k and k not in d: d[k]=round(n.get('amount',0),2)
  return d
PIECE=re.compile(r'^1 (small|medium|large|regular|sandwich|burger|burrito|taco|slice|piece|roll|enchilada|quesadilla|tamale|pupusa|empanada|egg roll|wrap|sub|serving|order|bowl|cup|patty|fajita|gyro|tostada|chimichanga|wing|dumpling|nugget|tender|strip|pie)\b(.*)$',re.I)
def portions(x):
  P=[p for p in x['foodPortions'] if p.get('gramWeight')]
  qns=next((p['gramWeight'] for p in P if 'not specified' in p['portionDescription'].lower()),None)
  U=[];seen=set()
  for p in sorted(P,key=lambda p:p['sequenceNumber']):
    d=p['portionDescription'].strip()
    if 'not specified' in d.lower() or re.search(r'fl oz|\boz\b|ounce|guideline|amount|\bg\b',d,re.I):continue
    m=PIECE.match(d)
    if not m: continue
    lb=(m.group(1)+m.group(2)).lower().strip()
    lb=re.sub(r'\s*\(.*?\)','',lb).replace(', nfs','').strip()
    if len(lb)>28 or lb in seen:continue
    seen.add(lb);U.append((lb,p['gramWeight']))
  return qns,U
REST=re.compile(r',?\s*(from )?(fast food / restaurant|restaurant or fast food|fast food|restaurant)\b',re.I)
HOME=re.compile(r',?\s*(made from |from )?(home recipe|homemade)\b',re.I)
def base(d):return HOME.sub('',REST.sub('',d)).strip(' ,')
def clean(d):
  d=re.sub(r', NFS$','',d);m=re.match(r'^Soup, (.*)$',d)
  if m:d=m.group(1)[0].upper()+m.group(1)[1:]+' soup';d=d.replace('Chicken or turkey','Chicken').replace('chicken or turkey','chicken')
  return d
dishes={};order=[]
def mk(x,name,syn='',cur=0):
  n=nut(x);qns,U=portions(x)
  if not n.get('kcal'):return None
  reg=qns or next((g for l,g in U if l in('cup','serving','medium','regular')),None) or (U[0][1] if U else None)
  if not reg:return None
  sz={l:g for l,g in U}
  units=[{"label":"small","mult":round(sz.get('small',reg*0.67)/100,3),"kind":"n","note":f"{round(sz.get('small',reg*0.67))} g"},
         {"label":"regular","mult":round(sz.get('medium',reg)/100,3),"kind":"n","note":f"{round(sz.get('medium',reg))} g"},
         {"label":"large","mult":round(sz.get('large',reg*1.5)/100,3),"kind":"n","note":f"{round(sz.get('large',reg*1.5))} g"}]
  for l,g in U:
    if l in('small','medium','large','regular'):continue
    units.append({"label":l,"mult":round(g/100,3),"kind":"n","note":f"{round(g)} g"})
  sznote='' if 'small' in sz and 'large' in sz else 'sz'
  return {"src":"dish","ref":"dish:"+str(x['fdcId'])+(':c' if cur else ''),"fdc":x['fdcId'],"name":name,**({"usda":x['description']} if name!=x['description'] else {}),"dish":1,"n":n,"units":units,"syn":[s for s in syn.split() if s],**({"szest":1} if sznote else {}),**({"pop":1} if cur else {})}
out=[]
pool=[x for x in L if x['wweiaFoodCategory']['wweiaFoodCategoryDescription'] in CATS]
groups={}
for x in pool:groups.setdefault(base(x['description']),[]).append(x)
def rv(desc):
  """real restaurant counterpart from FNDDS if one exists"""
  b=base(desc);return next((y for y in groups.get(b,[]) if REST.search(y['description']) and y['description']!=desc),None)
used=set()
for name,desc,syn in CUR:
  x=BY.get(desc);assert x,desc
  d=mk(x,name,syn,1)
  if not d:print('skip',desc);continue
  r=rv(desc)
  if r and not REST.search(desc):d["R"]={"fdc":r['fdcId'],"n":nut(r),"usda":r['description']}
  if REST.search(desc):d["rest"]=1
  out.append(d)
CURF={d['fdc'] for d in out}
for x in pool:
  desc=x['description']
  if x['fdcId'] in CURF:continue
  if BAD.search(desc) or len(desc)>64:continue
  if HOME.search(desc) and rv(desc) is None and False:pass
  if REST.search(desc) and any(not REST.search(y['description']) for y in groups[base(desc)]):continue  # folded into toggle
  nm=clean(HOME.sub('',desc).strip(' ,'))
  if HOME.search(desc) is None and any(HOME.search(y['description']) for y in groups[base(desc)]):continue # prefer home recipe row
  d=mk(x,nm)
  if not d:continue
  r=rv(desc)
  if r and not REST.search(desc):d["R"]={"fdc":r['fdcId'],"n":nut(r),"usda":r['description']}
  if REST.search(desc):d["rest"]=1;d["name"]=clean(desc)
  out.append(d)
seen=set();fin=[]
for d in out:
  k=d['name'].lower()
  if k in seen:continue
  seen.add(k);fin.append(d)
hdr="/* Prepared dishes & restaurant meals. Nutrition per 100 g and portion gram weights from USDA FoodData Central, FNDDS Survey Foods (2024-10-31 release, https://fdc.nal.usda.gov). Built by tools/build_dishlib.py; 'fdc' is the FoodData Central id. Friendly names (pop) map to an existing FNDDS food. 'R' = FNDDS restaurant version of the same dish. small/large without FNDDS sizes (szest) = 2/3x and 1.5x the USDA typical amount. */\n"
open('dishlib.js','w').write(hdr+"const DISHLIB="+json.dumps(fin,separators=(',',':'))+";\n")
print(len(fin),'dishes',sum(1 for d in fin if 'R' in d),'with real restaurant data')
