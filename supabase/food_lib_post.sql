truncate public.food_syn; truncate public.food_staple;
insert into public.food_syn values
 ('\m(soft drinks?|pop)\M','soda'),('\mbreasts? of chicken\M','chicken breast'),('\myoghurts?\M','yogurt'),('\mprawns?\M','shrimp'),
 ('\mgarbanzos?( beans?)?\M','chickpea'),('\mcourgettes?\M','zucchini'),('\maubergines?\M','eggplant'),('\mhard ?boiled\M','hard-boiled'),
 ('\mmac (and|&|n) cheese\M','macaroni and cheese'),('\mpb\M','peanut butter'),('\mhot ?dogs?\M','frankfurter'),('\mfries\M','french fries'),
 ('\moats\M','oat'),('\mcoke\M','cola'),('\mtatos?\M','potato');
insert into public.food_staple select public.food_norm(t) from unnest(string_to_array('egg,egg white,chicken,chicken breast,chicken thigh,rice,white rice,brown rice,banana,milk,bread,oatmeal,oat,salmon,apple,cheese,potato,sweet potato,beef,ground beef,steak,pork,turkey,tuna,shrimp,tofu,pasta,yogurt,greek yogurt,avocado,orange,strawberry,blueberry,grape,broccoli,spinach,carrot,bean,black bean,chickpea,almond,butter,peanut butter,tortilla,bacon,ham,corn,tomato,lettuce,cucumber,onion,peach,pear,mango,pineapple,watermelon,cottage cheese,cheddar cheese,hummus,olive oil,popcorn,bagel,cereal,granola,lentil,quinoa,soda',',')) t on conflict do nothing;
update public.food_lib set base = public.food_norm(split_part(cn,',',1)),
 tsv = setweight(to_tsvector('english', coalesce(public.food_norm(cn),'')),'A') || setweight(to_tsvector('english', coalesce(brand,'')),'B') || setweight(to_tsvector('english', coalesce(full_name,'')),'C');
create index if not exists food_lib_tsv on public.food_lib using gin(tsv);
create index if not exists food_lib_base_trgm on public.food_lib using gin(base gin_trgm_ops);
create index if not exists food_lib_gtin on public.food_lib(gtin);
analyze public.food_lib;
select pg_size_pretty(pg_total_relation_size('public.food_lib')) t, pg_size_pretty(pg_database_size(current_database())) db;
