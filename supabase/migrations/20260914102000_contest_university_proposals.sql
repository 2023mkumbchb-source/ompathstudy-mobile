alter table public.contest_universities
  add column if not exists proposed_by uuid references auth.users(id) on delete set null;

create index if not exists contest_universities_proposed_by_idx
  on public.contest_universities (proposed_by)
  where proposed_by is not null;

drop policy if exists "Participants view own proposed universities" on public.contest_universities;
create policy "Participants view own proposed universities"
  on public.contest_universities
  for select
  to authenticated
  using ((select auth.uid()) = proposed_by);
