-- My Healthy Habits cloud sync. Run once in Supabase Dashboard > SQL Editor.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;

drop policy if exists "own row select" on public.user_data;
drop policy if exists "own row insert" on public.user_data;
drop policy if exists "own row update" on public.user_data;
drop policy if exists "own row delete" on public.user_data;
create policy "own row select" on public.user_data for select to authenticated using (auth.uid() = user_id);
create policy "own row insert" on public.user_data for insert to authenticated with check (auth.uid() = user_id);
create policy "own row update" on public.user_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row delete" on public.user_data for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_data to authenticated;
revoke all on public.user_data from anon;

-- Lets a signed-in user delete their own account (and, via cascade, their data).
create or replace function public.delete_my_account()
returns void language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
