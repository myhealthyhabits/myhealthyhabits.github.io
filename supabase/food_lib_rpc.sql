create or replace function public.search_foods(q text, liked text[] default '{}', lim int default 40)
returns table(ref text, src text, kind text, cn text, base text, score real, raw jsonb)
language plpgsql stable security definer set search_path = public as $$
declare nq text := public.food_norm(q); tq tsquery; staple boolean; ws text[]; bq text; fq text;
begin
 if nq = '' then return; end if;
 ws := regexp_split_to_array(nq,' ');
 tq := to_tsquery('english', array_to_string(array(select quote_literal(w)||case when i=array_length(ws,1) then ':*' else '' end from unnest(ws) with ordinality u(w,i) where w !~ '^(and|with|the|of|or)$'),' & '));
 select b.alias into bq from food_brand b where (' '||nq||' ') like '% '||b.alias||' %' order by length(b.alias) desc limit 1;
 fq := trim(regexp_replace(' '||nq||' ', '\m(canned|frozen|fresh|raw|cooked|can of|cans?|jar)\M',' ','g'));
 fq := trim(regexp_replace(fq,'\s+',' ','g'));
 if bq is not null then fq := trim(regexp_replace(' '||fq||' ',' '||bq||' ',' ')); end if;
 staple := bq is null and exists(select 1 from food_staple s where s.term = fq);
 return query
 with c1 as ((select f.* from food_lib f where f.tsv @@ tq and f.kind<>'branded' order by length(f.cn) limit 800) union all (select f.* from food_lib f where f.tsv @@ tq and f.kind='branded' order by f.pop desc limit 600)),
 c2 as (select f.* from food_lib f where nq <% f.base and not exists(select 1 from c1 limit 1 offset 4) limit 300),
 cand as (select *, true as exact from c1 union all select *, false from c2),
 sc as (select c.*, (
   ts_rank(c.tsv,tq)*10
   + case when c.base = nq then 30 when c.base like nq||' %' or c.base like nq||'%' then 14
          when staple and c.kind<>'branded' and c.base like '% '||nq and array_length(regexp_split_to_array(c.base,' '),1)=2 then 20
          when position(nq in c.base)>1 then (case when staple then -12 else -4 end) else 0 end
   + case when staple then (case c.kind when 'base' then 22 when 'survey' then 8 else -10 end)
          else (case c.kind when 'survey' then 18 when 'base' then 4 else 0 end) end
   + case when bq is not null and lower(coalesce(c.brand,'')||' '||c.full_name) like '%'||bq||'%' then 45 when bq is not null then -20 else 0 end
   + case when bq is not null and fq<>'' and c.base like '%'||fq||'%' then 12 else 0 end
   + case when fq<>nq and bq is null and c.kind<>'branded' and c.base = fq then 20 when fq<>nq and bq is null and lower(c.full_name) ~ 'canned' then 8 else 0 end
   + case when fq<>'' and position(' ' in fq)=0 and not ((' '||c.base||' ') ~ ('\m'||fq||'\M')) and not (' '||c.base||' ') ~ ('\m'||fq||'(s|es)?\M') then -10 else 0 end
   + least(c.pop,2000)/200.0
   + case when c.base = any(liked) then 15 else 0 end
   - least(length(c.cn),80)/15.0
   - case when c.exact then 0 else 12 end)::real as s from cand c),
 d as (select distinct on (lower(sc.cn)) sc.* from sc order by lower(sc.cn), sc.s desc),
 g as (select d.*, max(d.s) over (partition by d.base) as gs, row_number() over (partition by d.base order by d.s desc) as rn from d)
 select g.ref,g.src,g.kind,g.cn,g.base,g.s,g.raw from g where g.rn<=6 order by g.gs desc, g.base, g.s desc limit lim;
end $$;
grant execute on function public.search_foods(text,text[],int) to anon, authenticated;
grant select on public.food_lib, public.food_syn, public.food_staple to anon, authenticated;
