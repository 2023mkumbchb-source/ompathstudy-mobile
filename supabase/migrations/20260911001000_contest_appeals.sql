create table if not exists public.contest_appeals (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  registration_id uuid not null references public.contest_registrations(id) on delete cascade,
  attempt_id uuid references public.contest_attempts(id) on delete set null,
  advancement_id uuid references public.contest_advancements(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('integrity','score','advancement','technical')),
  statement text not null check (length(trim(statement)) between 20 and 2000),
  status text not null default 'open' check (status in ('open','reviewing','upheld','overturned','dismissed')),
  resolution text check (resolution is null or length(trim(resolution)) between 10 and 2000),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(attempt_id, advancement_id) = 1)
);
create unique index if not exists contest_appeals_open_target_idx on public.contest_appeals (user_id, coalesce(attempt_id, advancement_id)) where status in ('open','reviewing');
create index if not exists contest_appeals_contest_status_idx on public.contest_appeals (contest_id, status, created_at);
create index if not exists contest_appeals_registration_idx on public.contest_appeals (registration_id);
create index if not exists contest_appeals_attempt_idx on public.contest_appeals (attempt_id) where attempt_id is not null;
create index if not exists contest_appeals_advancement_idx on public.contest_appeals (advancement_id) where advancement_id is not null;
create index if not exists contest_appeals_resolved_by_idx on public.contest_appeals (resolved_by) where resolved_by is not null;
alter table public.contest_appeals enable row level security;
revoke all on public.contest_appeals from anon, authenticated;
grant select on public.contest_appeals to authenticated;
create policy "Participants view own appeals" on public.contest_appeals for select to authenticated using (
  (select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin')
);

alter table public.contest_moderator_actions drop constraint if exists contest_moderator_actions_action_type_check;
alter table public.contest_moderator_actions add constraint contest_moderator_actions_action_type_check check (action_type in ('attempt_override','advancement_decision','appeal_resolution'));
alter table public.contest_moderator_actions drop constraint if exists contest_moderator_actions_target_type_check;
alter table public.contest_moderator_actions add constraint contest_moderator_actions_target_type_check check (target_type in ('contest_attempt','contest_registration','contest_appeal'));
