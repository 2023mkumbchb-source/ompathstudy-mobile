-- Remove legacy public write policies and enforce the mobile access matrix.
drop policy if exists "Allow all operations for managing articles" on public.articles;
drop policy if exists "Service can manage stories" on public.stories;
drop policy if exists "Admins can manage articles" on public.articles;
drop policy if exists "Administrators manage stories" on public.stories;
drop policy if exists "Signed-in users submit unpublished stories" on public.stories;
drop policy if exists "Administrators view profiles" on public.profiles;
drop policy if exists "Administrators update profiles" on public.profiles;

alter table public.stories
  add column if not exists submitted_by uuid references auth.users(id) on delete set null default auth.uid();

create index if not exists stories_submitted_by_idx on public.stories(submitted_by);

create policy "Admins can manage articles"
  on public.articles for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

create policy "Administrators manage stories"
  on public.stories for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

create policy "Signed-in users submit unpublished stories"
  on public.stories for insert to authenticated
  with check (
    (select auth.uid()) = submitted_by
    and published = false
    and deleted_at is null
  );

create policy "Administrators view profiles"
  on public.profiles for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'));

create policy "Administrators update profiles"
  on public.profiles for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
