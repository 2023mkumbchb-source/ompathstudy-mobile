create schema if not exists private;

create table if not exists public.contest_rounds (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  title text not null,
  round_number integer not null check (round_number > 0),
  status text not null default 'scheduled' check (status in ('scheduled','lobby','live','closed','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  duration_seconds integer not null default 1800 check (duration_seconds between 60 and 14400),
  question_count integer not null default 0 check (question_count >= 0),
  advancement_count integer check (advancement_count is null or advancement_count > 0),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, round_number),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.contest_questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.contest_rounds(id) on delete cascade,
  position integer not null check (position > 0),
  stem text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  snapshot_hash text not null,
  created_at timestamptz not null default now(),
  unique (round_id, position)
);

create table if not exists private.contest_answer_keys (
  question_id uuid primary key references public.contest_questions(id) on delete cascade,
  correct_index integer not null check (correct_index >= 0),
  explanation text,
  created_at timestamptz not null default now()
);

create table if not exists public.contest_attempts (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.contest_rounds(id) on delete cascade,
  registration_id uuid not null references public.contest_registrations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','submitted','eliminated','expired','void')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  eliminated_at timestamptz,
  score numeric(7,2),
  created_at timestamptz not null default now(),
  unique (round_id, user_id)
);

create table if not exists public.contest_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.contest_attempts(id) on delete cascade,
  question_id uuid not null references public.contest_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  selected_index integer not null check (selected_index >= 0),
  response_ms integer check (response_ms is null or response_ms >= 0),
  submitted_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists public.contest_integrity_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.contest_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('tab_hidden','focus_lost','fullscreen_exit','copy_attempt','paste_attempt','context_menu','disconnected','reconnected')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index if not exists contest_rounds_contest_idx on public.contest_rounds (contest_id, round_number);
create index if not exists contest_questions_round_idx on public.contest_questions (round_id, position);
create index if not exists contest_attempts_registration_idx on public.contest_attempts (registration_id);
create index if not exists contest_attempts_user_idx on public.contest_attempts (user_id, round_id);
create index if not exists contest_answers_question_idx on public.contest_answers (question_id);
create index if not exists contest_answers_user_idx on public.contest_answers (user_id, attempt_id);
create index if not exists contest_integrity_attempt_idx on public.contest_integrity_events (attempt_id, occurred_at);
create index if not exists contest_integrity_user_idx on public.contest_integrity_events (user_id, occurred_at);

alter table public.contest_rounds enable row level security;
alter table public.contest_questions enable row level security;
alter table public.contest_attempts enable row level security;
alter table public.contest_answers enable row level security;
alter table public.contest_integrity_events enable row level security;

revoke all on public.contest_rounds, public.contest_questions, public.contest_attempts, public.contest_answers, public.contest_integrity_events from anon, authenticated;
grant select on public.contest_rounds to anon, authenticated;
grant select on public.contest_questions to authenticated;
grant select, insert on public.contest_attempts, public.contest_answers, public.contest_integrity_events to authenticated;

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

create policy "Published rounds are visible" on public.contest_rounds for select to anon, authenticated using (
  public.has_role((select auth.uid()), 'admin') or exists (
    select 1 from public.contests c where c.id = contest_id and c.published = true
  )
);
create policy "Administrators create contest rounds" on public.contest_rounds for insert to authenticated with check (public.has_role((select auth.uid()), 'admin'));
create policy "Administrators update contest rounds" on public.contest_rounds for update to authenticated using (public.has_role((select auth.uid()), 'admin')) with check (public.has_role((select auth.uid()), 'admin'));
create policy "Administrators delete contest rounds" on public.contest_rounds for delete to authenticated using (public.has_role((select auth.uid()), 'admin'));

create policy "Verified entrants see admitted questions" on public.contest_questions for select to authenticated using (
  public.has_role((select auth.uid()), 'admin') or exists (
    select 1
    from public.contest_rounds r
    join public.contest_registrations cr on cr.contest_id = r.contest_id
    where r.id = round_id and r.status in ('lobby','live') and cr.user_id = (select auth.uid()) and cr.status = 'verified'
  )
);
create policy "Administrators create scheduled questions" on public.contest_questions for insert to authenticated with check (
  public.has_role((select auth.uid()), 'admin') and exists (select 1 from public.contest_rounds r where r.id = round_id and r.status = 'scheduled' and r.locked_at is null)
);
create policy "Administrators update scheduled questions" on public.contest_questions for update to authenticated using (
  public.has_role((select auth.uid()), 'admin') and exists (select 1 from public.contest_rounds r where r.id = round_id and r.status = 'scheduled' and r.locked_at is null)
) with check (
  public.has_role((select auth.uid()), 'admin') and exists (select 1 from public.contest_rounds r where r.id = round_id and r.status = 'scheduled' and r.locked_at is null)
);
create policy "Administrators delete scheduled questions" on public.contest_questions for delete to authenticated using (
  public.has_role((select auth.uid()), 'admin') and exists (select 1 from public.contest_rounds r where r.id = round_id and r.status = 'scheduled' and r.locked_at is null)
);

create policy "Participants view own attempts" on public.contest_attempts for select to authenticated using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'));
create policy "Verified participants start live attempts" on public.contest_attempts for insert to authenticated with check (
  public.has_role((select auth.uid()), 'admin') or (
    (select auth.uid()) = user_id and status = 'active' and exists (
      select 1 from public.contest_rounds r
      join public.contest_registrations cr on cr.contest_id = r.contest_id
      where r.id = round_id and cr.id = registration_id and cr.user_id = (select auth.uid()) and cr.status = 'verified'
        and r.status = 'live' and (r.starts_at is null or r.starts_at <= now()) and (r.ends_at is null or r.ends_at > now())
    )
  )
);

create policy "Participants view own answers" on public.contest_answers for select to authenticated using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'));
create policy "Participants submit one live answer" on public.contest_answers for insert to authenticated with check (
  public.has_role((select auth.uid()), 'admin') or (
    (select auth.uid()) = user_id and exists (
      select 1 from public.contest_attempts a
      join public.contest_rounds r on r.id = a.round_id
      join public.contest_questions q on q.round_id = r.id
      where a.id = attempt_id and a.user_id = (select auth.uid()) and a.status = 'active' and q.id = question_id
        and r.status = 'live' and (r.starts_at is null or r.starts_at <= now()) and (r.ends_at is null or r.ends_at > now())
    )
  )
);

create policy "Participants and admins view integrity events" on public.contest_integrity_events for select to authenticated using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'));
create policy "Participants log own active attempt events" on public.contest_integrity_events for insert to authenticated with check (
  public.has_role((select auth.uid()), 'admin') or (
    (select auth.uid()) = user_id and exists (
      select 1 from public.contest_attempts a where a.id = attempt_id and a.user_id = (select auth.uid()) and a.status = 'active'
    )
  )
);

insert into public.contest_rounds (contest_id, title, round_number, status, duration_seconds)
select id, 'National Qualifier', 1, 'scheduled', 1800
from public.contests where slug = 'inter-university-medical-challenge'
on conflict (contest_id, round_number) do nothing;
