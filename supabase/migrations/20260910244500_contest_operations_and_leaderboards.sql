alter table public.contest_rounds add column if not exists tab_switch_limit integer not null default 2 check (tab_switch_limit between 1 and 20);
alter table public.contest_rounds add column if not exists focus_loss_limit integer not null default 3 check (focus_loss_limit between 1 and 30);
alter table public.contest_rounds add column if not exists auto_eliminate boolean not null default false;
alter table public.contest_rounds add column if not exists integrity_policy text not null default 'Integrity events are logged and reviewed by a moderator. Automatic elimination is used only when explicitly enabled for the round.';

create table if not exists public.contest_university_results (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  round_id uuid not null references public.contest_rounds(id) on delete cascade,
  university_id uuid not null references public.contest_universities(id) on delete cascade,
  rank integer not null check (rank > 0),
  participant_count integer not null check (participant_count > 0),
  average_score numeric(7,2) not null,
  total_points numeric(10,2) not null,
  published boolean not null default false,
  published_at timestamptz not null default now(),
  unique (round_id, university_id)
);
create index if not exists contest_results_contest_rank_idx on public.contest_university_results (contest_id, rank);
create index if not exists contest_results_round_idx on public.contest_university_results (round_id, rank);
create index if not exists contest_results_university_idx on public.contest_university_results (university_id);
alter table public.contest_university_results enable row level security;
revoke all on public.contest_university_results from anon, authenticated;
grant select on public.contest_university_results to anon, authenticated;
create policy "Published university contest results are public" on public.contest_university_results for select to anon, authenticated using (
  public.has_role((select auth.uid()), 'admin') or published = true
);

revoke insert on public.contest_integrity_events from authenticated;
drop policy if exists "Participants log own active attempt events" on public.contest_integrity_events;
