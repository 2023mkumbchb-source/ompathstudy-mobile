-- A valid numeric index is not a valid answer when the indexed option is an
-- empty OCR placeholder. Keep the source visible and route it to review.
update public.mcq_sets m
set requires_review=true,
    completeness_status='missing_answers',
    answer_key_verified=false,
    updated_at=now()
where deleted_at is null
  and exists (
    select 1 from jsonb_array_elements(m.questions) q
    where (q->>'correct_answer') ~ '^[0-9]+$'
      and (q->>'correct_answer')::int >= 0
      and (q->>'correct_answer')::int < jsonb_array_length(coalesce(q->'options','[]'::jsonb))
      and btrim(coalesce(q->'options'->>((q->>'correct_answer')::int),''))=''
  );
