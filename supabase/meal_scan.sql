-- Meal photo scan: daily usage counters (no photos stored). Run once in Supabase SQL Editor.
create table if not exists public.scan_counts (
  day date not null,
  who text not null,            -- 'global', 'u:<user id>' or 'ip:<hashed ip>'
  n int not null default 0,
  primary key (day, who)
);
alter table public.scan_counts enable row level security;  -- no policies: only the service role touches it
revoke all on public.scan_counts from anon, authenticated;

-- Atomically counts one scan for the caller and the whole app. Returns 'ok', 'user' or 'global'.
create or replace function public.scan_take(p_who text, p_user_cap int, p_global_cap int)
returns text language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'America/Los_Angeles')::date; u int; g int;
begin
  insert into public.scan_counts(day, who, n) values (d, 'global', 0) on conflict do nothing;
  select n into g from public.scan_counts where day = d and who = 'global' for update;
  if g >= p_global_cap then return 'global'; end if;
  insert into public.scan_counts(day, who, n) values (d, p_who, 0) on conflict do nothing;
  select n into u from public.scan_counts where day = d and who = p_who for update;
  if u >= p_user_cap then return 'user'; end if;
  update public.scan_counts set n = n + 1 where day = d and who in ('global', p_who);
  delete from public.scan_counts where day < d - 7;
  return 'ok';
end $$;
revoke all on function public.scan_take(text, int, int) from public, anon, authenticated;
