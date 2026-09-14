alter table public.contests
  add column if not exists max_participants_per_university integer not null default 50 check (max_participants_per_university between 1 and 1000);

alter table public.contest_registrations
  add column if not exists team_name text,
  add column if not exists team_role text not null default 'member' check (team_role in ('captain','member'));

alter table public.contest_rounds
  add column if not exists shuffle_questions boolean not null default true,
  add column if not exists marks_correct numeric(6,2) not null default 1 check (marks_correct > 0),
  add column if not exists marks_incorrect numeric(6,2) not null default 0 check (marks_incorrect between -10 and 0);

create index if not exists contest_registrations_team_idx
  on public.contest_registrations (contest_id, university_id, team_name)
  where representation = 'university_team';

create or replace function public.score_contest_attempt(p_attempt_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  result numeric;
begin
  select case when count(q.id) = 0 then 0 else greatest(0, round(100.0 * (
    count(*) filter (where a.selected_index = k.correct_index) * r.marks_correct
    + count(*) filter (where a.selected_index is not null and a.selected_index <> k.correct_index) * r.marks_incorrect
  ) / (count(q.id) * r.marks_correct), 2)) end
  into result
  from public.contest_attempts ca
  join public.contest_rounds r on r.id = ca.round_id
  join public.contest_questions q on q.round_id = ca.round_id
  left join public.contest_answers a on a.attempt_id = ca.id and a.question_id = q.id
  join private.contest_answer_keys k on k.question_id = q.id
  where ca.id = p_attempt_id
  group by r.marks_correct, r.marks_incorrect;

  update public.contest_attempts set status = 'submitted', submitted_at = now(), score = coalesce(result, 0)
  where id = p_attempt_id and status = 'active';
  if not found then raise exception 'Attempt is not active'; end if;
  return coalesce(result, 0);
end;
$$;

revoke all on function public.score_contest_attempt(uuid) from public, anon, authenticated;
grant execute on function public.score_contest_attempt(uuid) to service_role;
