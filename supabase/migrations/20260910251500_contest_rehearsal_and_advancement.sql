create table if not exists public.contest_advancements (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  registration_id uuid not null references public.contest_registrations(id) on delete cascade,
  source_round_id uuid not null references public.contest_rounds(id) on delete cascade,
  target_round_id uuid references public.contest_rounds(id) on delete set null,
  decision text not null check (decision in ('advanced','eliminated','wildcard')),
  reason text not null check (length(trim(reason)) between 3 and 500),
  decided_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, source_round_id)
);

create table if not exists public.contest_moderator_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action_type text not null check (action_type in ('attempt_override','advancement_decision')),
  target_type text not null check (target_type in ('contest_attempt','contest_registration')),
  target_id uuid not null,
  reason text not null check (length(trim(reason)) between 3 and 500),
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists contest_advancements_registration_idx on public.contest_advancements (registration_id, source_round_id);
create index if not exists contest_advancements_contest_idx on public.contest_advancements (contest_id, created_at desc);
create index if not exists contest_advancements_source_round_idx on public.contest_advancements (source_round_id);
create index if not exists contest_advancements_target_round_idx on public.contest_advancements (target_round_id) where target_round_id is not null;
create index if not exists contest_advancements_decided_by_idx on public.contest_advancements (decided_by);
create index if not exists contest_moderator_actions_target_idx on public.contest_moderator_actions (target_type, target_id, created_at desc);
create index if not exists contest_moderator_actions_actor_idx on public.contest_moderator_actions (actor_id, created_at desc);

alter table public.contest_advancements enable row level security;
alter table public.contest_moderator_actions enable row level security;

revoke all on public.contest_advancements, public.contest_moderator_actions from anon, authenticated;
grant select on public.contest_advancements, public.contest_moderator_actions to authenticated;

create policy "Participants view own advancement" on public.contest_advancements for select to authenticated using (
  public.has_role((select auth.uid()), 'admin') or exists (
    select 1 from public.contest_registrations cr
    where cr.id = registration_id and cr.user_id = (select auth.uid())
  )
);

create policy "Administrators view moderator audit" on public.contest_moderator_actions for select to authenticated using (
  public.has_role((select auth.uid()), 'admin')
);
