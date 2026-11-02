create or replace function public.food_by_gtin(codes text[]) returns table(ref text, src text, raw jsonb)
language sql stable security definer set search_path = public as $$
 select f.ref,f.src,f.raw from food_lib f where f.gtin = any(array(select ltrim(c,'0') from unnest(codes) c)) order by (f.src='usda') desc, f.pop desc limit 1 $$;
grant execute on function public.food_by_gtin(text[]) to anon, authenticated;
