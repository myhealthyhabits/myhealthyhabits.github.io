create extension if not exists pg_trgm;
create table if not exists public.food_lib(
 id serial primary key, ref text unique not null, src text not null, kind text not null, pop int not null default 0, gtin text,
 cn text not null, full_name text, brand text, raw jsonb not null, base text, tsv tsvector);
create table if not exists public.food_syn(pat text primary key, repl text not null);
create table if not exists public.food_staple(term text primary key);
alter table public.food_lib enable row level security;
alter table public.food_syn enable row level security;
alter table public.food_staple enable row level security;
drop policy if exists food_lib_read on public.food_lib; create policy food_lib_read on public.food_lib for select using (true);
drop policy if exists food_syn_read on public.food_syn; create policy food_syn_read on public.food_syn for select using (true);
drop policy if exists food_staple_read on public.food_staple; create policy food_staple_read on public.food_staple for select using (true);
create or replace function public.food_sing(w text) returns text language sql immutable as $$
 select case when w ~ 'ies$' then regexp_replace(w,'ies$','y') when w ~ '(ches|shes|oes|xes)$' then regexp_replace(w,'es$','') when w ~ '[^s]s$' then regexp_replace(w,'s$','') else w end $$;
create or replace function public.food_norm(q text) returns text language plpgsql stable as $$
declare r record; t text := ' '||lower(coalesce(q,''))||' ';
begin
 t := regexp_replace(t,'[^a-z0-9%&'' ]',' ','g');
 for r in select pat,repl from public.food_syn loop t := regexp_replace(t, r.pat, ' '||r.repl||' ','g'); end loop;
 t := (select string_agg(public.food_sing(w),' ') from unnest(regexp_split_to_array(trim(regexp_replace(t,'\s+',' ','g')),' ')) w where w<>'');
 return coalesce(t,'');
end $$;
