do $$
declare
  v_contest_id uuid;
  v_round_id uuid;
  v_exam_id uuid;
  v_exam_title text;
  v_questions jsonb;
  v_count integer;
begin
  if exists (select 1 from public.contests where slug = 'hematology-live-contest-demo') then
    return;
  end if;

  select id, title
  into v_exam_id, v_exam_title
  from public.mcq_sets
  where slug = 'haematology-exam-2025-mcqs-on-anaemia-leukaemia-and-clotting-ca0460d4'
    and published = true
    and deleted_at is null;

  if v_exam_id is null then
    raise exception 'The hematology example paper is unavailable';
  end if;

  insert into public.contests (
    slug, title, subtitle, status, subjects, eligible_years, competition_format,
    registration_opens_at, registration_closes_at, starts_at, published
  ) values (
    'hematology-live-contest-demo',
    'Hematology Live Contest — Example',
    'A working Year 3 contest example using an existing 60-question hematology examination.',
    'registration',
    array['Hematology', 'Hematopathology'],
    array[3],
    'Single live examination round',
    now(),
    now() + interval '6 days',
    now() + interval '7 days',
    true
  ) returning id into v_contest_id;

  insert into public.contest_rounds (
    contest_id, title, round_number, status, duration_seconds,
    tab_switch_limit, focus_loss_limit, auto_eliminate,
    source_mcq_set_id, source_exam_title
  ) values (
    v_contest_id, 'Hematology examination round', 1, 'scheduled', 3600,
    2, 3, false, v_exam_id, v_exam_title
  ) returning id into v_round_id;

  select jsonb_agg(jsonb_build_object(
    'stem', q->>'question',
    'options', q->'options',
    'correctIndex', (q->>'correct_answer')::int,
    'explanation', nullif(trim(q->>'explanation'), '')
  ) order by ord)
  into v_questions
  from public.mcq_sets m
  cross join lateral jsonb_array_elements(m.questions) with ordinality items(q, ord)
  where m.id = v_exam_id;

  v_count := public.admin_replace_contest_questions(v_round_id, v_questions);

  update public.contest_rounds
  set status = 'lobby',
      starts_at = now() + interval '7 days',
      ends_at = now() + interval '7 days 1 hour',
      locked_at = now(),
      question_count = v_count,
      updated_at = now()
  where id = v_round_id;
end $$;
