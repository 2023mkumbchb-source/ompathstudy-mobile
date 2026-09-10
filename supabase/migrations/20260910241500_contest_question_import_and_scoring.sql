create or replace function public.admin_replace_contest_questions(p_round_id uuid, p_questions jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  question_id uuid;
  item_count integer := 0;
  option_count integer;
  answer_index integer;
begin
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) < 1 or jsonb_array_length(p_questions) > 200 then
    raise exception 'Question bank must contain between 1 and 200 questions';
  end if;
  if not exists (select 1 from public.contest_rounds where id = p_round_id and status = 'scheduled' and locked_at is null) then
    raise exception 'Only an unlocked scheduled round can be edited';
  end if;

  delete from public.contest_questions where round_id = p_round_id;
  for item in select value from jsonb_array_elements(p_questions)
  loop
    option_count := jsonb_array_length(item->'options');
    answer_index := (item->>'correctIndex')::integer;
    if length(trim(item->>'stem')) < 5 or jsonb_typeof(item->'options') <> 'array' or option_count < 2 or option_count > 8
      or answer_index < 0 or answer_index >= option_count then
      raise exception 'Invalid question at position %', item_count + 1;
    end if;
    question_id := gen_random_uuid();
    insert into public.contest_questions (id, round_id, position, stem, options, snapshot_hash)
    values (question_id, p_round_id, item_count + 1, trim(item->>'stem'), item->'options',
      encode(extensions.digest(convert_to((jsonb_build_object('stem', trim(item->>'stem'), 'options', item->'options'))::text, 'UTF8'), 'sha256'), 'hex'));
    insert into private.contest_answer_keys (question_id, correct_index, explanation)
    values (question_id, answer_index, nullif(trim(item->>'explanation'), ''));
    item_count := item_count + 1;
  end loop;
  update public.contest_rounds set question_count = item_count, updated_at = now() where id = p_round_id;
  return item_count;
end;
$$;

create or replace function public.score_contest_attempt(p_attempt_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  result numeric;
begin
  select case when count(q.id) = 0 then 0 else round(100.0 * count(*) filter (where a.selected_index = k.correct_index) / count(q.id), 2) end
  into result
  from public.contest_attempts ca
  join public.contest_questions q on q.round_id = ca.round_id
  left join public.contest_answers a on a.attempt_id = ca.id and a.question_id = q.id
  join private.contest_answer_keys k on k.question_id = q.id
  where ca.id = p_attempt_id;

  update public.contest_attempts set status = 'submitted', submitted_at = now(), score = result
  where id = p_attempt_id and status = 'active';
  if not found then raise exception 'Attempt is not active'; end if;
  return result;
end;
$$;

revoke all on function public.admin_replace_contest_questions(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.score_contest_attempt(uuid) from public, anon, authenticated;
grant execute on function public.admin_replace_contest_questions(uuid, jsonb) to service_role;
grant execute on function public.score_contest_attempt(uuid) to service_role;
