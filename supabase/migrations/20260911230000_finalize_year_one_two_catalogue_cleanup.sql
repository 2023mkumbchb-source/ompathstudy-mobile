-- Finalize the shared Year 1/2 catalogue cleanup without deleting resources.
-- Existing unit_id values remain intact so topic links and learner progress do
-- not break; category and unit labels become the course-level source of truth.

update public.articles
set category = case
      when category in ('Year 1: Anatomy','Year 1: Aponeurosis - Anatomy','Year 1: Aponeurosis - Embryology','Year 1: Aponeurosis - Histology','Year 1: Embryology','Year 1: Gross Anatomy Head and Neck') then 'Year 1: Human Anatomy I'
      when category in ('Year 1: Physiology','Year 1: Cardiovascular Physiology','Year 1: Neurophysiology I') then 'Year 1: Medical Physiology I'
      when category in ('Year 1: Biochemistry','Year 1: Carbohydrate Metabolism and Bioenergetics') then 'Year 1: Medical Biochemistry I'
      when category = 'Year 1: General' then 'Year 1: Reference'
      when category in ('Year 2: Clinical Biochemistry','Year 2: Medical Biochemistry II','Year 2: Molecular Biology','Year 2: Molecular Genetics and Cytogenetics') then 'Year 2: Medical Biochemistry II'
      when category in ('Year 2: GIT Physiology','Year 2: Physiology') then 'Year 2: Medical Physiology II'
      when category in ('Year 2: Microbiology','Year 2: Parasitology') then 'Year 2: Principles of Microbiology and Parasitology'
      when category = 'Year 2: Cellular Immunology' then 'Year 2: Immunology'
      when category = 'Year 2: Epidemiology and Statistics' then 'Year 2: Epidemiology and Biostatistics'
      else category
    end,
    unit = case
      when category in ('Year 1: Anatomy','Year 1: Aponeurosis - Anatomy','Year 1: Aponeurosis - Embryology','Year 1: Aponeurosis - Histology','Year 1: Embryology','Year 1: Gross Anatomy Head and Neck') then 'Human Anatomy I'
      when category in ('Year 1: Physiology','Year 1: Cardiovascular Physiology','Year 1: Neurophysiology I') then 'Medical Physiology I'
      when category in ('Year 1: Biochemistry','Year 1: Carbohydrate Metabolism and Bioenergetics') then 'Medical Biochemistry I'
      when category in ('Year 2: Clinical Biochemistry','Year 2: Medical Biochemistry II','Year 2: Molecular Biology','Year 2: Molecular Genetics and Cytogenetics') then 'Medical Biochemistry II'
      when category in ('Year 2: GIT Physiology','Year 2: Physiology') then 'Medical Physiology II'
      when category in ('Year 2: Microbiology','Year 2: Parasitology') then 'Principles of Microbiology and Parasitology'
      when category = 'Year 2: Cellular Immunology' then 'Immunology'
      when category = 'Year 2: Epidemiology and Statistics' then 'Epidemiology and Biostatistics'
      else unit
    end,
    updated_at = now()
where deleted_at is null and category ~ '^Year [12]:';

update public.mcq_sets
set category = case
      when category in ('Year 1: Anatomy','Year 1: Embryology','Year 1: Gross Anatomy Head and Neck') then 'Year 1: Human Anatomy I'
      when category in ('Year 1: Physiology','Year 1: Cardiovascular Physiology','Year 1: Neurophysiology I') then 'Year 1: Medical Physiology I'
      when category in ('Year 1: Biochemistry','Year 1: Carbohydrate Metabolism and Bioenergetics','Year 1: Enzymes, Vitamins and Minerals') then 'Year 1: Medical Biochemistry I'
      when category = 'Year 1: General' then 'Year 1: Reference'
      when category in ('Year 2: Clinical Biochemistry','Year 2: Medical Biochemistry II','Year 2: Molecular Biology','Year 2: Molecular Genetics and Cytogenetics') then 'Year 2: Medical Biochemistry II'
      when category in ('Year 2: GIT Physiology','Year 2: Physiology') then 'Year 2: Medical Physiology II'
      when category in ('Year 2: Microbiology','Year 2: Parasitology') then 'Year 2: Principles of Microbiology and Parasitology'
      when category = 'Year 2: Cellular Immunology' then 'Year 2: Immunology'
      when category = 'Year 2: Epidemiology and Statistics' then 'Year 2: Epidemiology and Biostatistics'
      else category
    end,
    unit = case
      when category in ('Year 1: Anatomy','Year 1: Embryology','Year 1: Gross Anatomy Head and Neck') then 'Human Anatomy I'
      when category in ('Year 1: Physiology','Year 1: Cardiovascular Physiology','Year 1: Neurophysiology I') then 'Medical Physiology I'
      when category in ('Year 1: Biochemistry','Year 1: Carbohydrate Metabolism and Bioenergetics','Year 1: Enzymes, Vitamins and Minerals') then 'Medical Biochemistry I'
      when category in ('Year 2: Clinical Biochemistry','Year 2: Medical Biochemistry II','Year 2: Molecular Biology','Year 2: Molecular Genetics and Cytogenetics') then 'Medical Biochemistry II'
      when category in ('Year 2: GIT Physiology','Year 2: Physiology') then 'Medical Physiology II'
      when category in ('Year 2: Microbiology','Year 2: Parasitology') then 'Principles of Microbiology and Parasitology'
      when category = 'Year 2: Cellular Immunology' then 'Immunology'
      when category = 'Year 2: Epidemiology and Statistics' then 'Epidemiology and Biostatistics'
      else unit
    end,
    updated_at = now()
where deleted_at is null and category ~ '^Year [12]:';

update public.flashcard_sets
set category = case
      when category in ('Year 1: Anatomy','Year 1: Embryology','Year 1: Gross Anatomy Head and Neck') then 'Year 1: Human Anatomy I'
      when category in ('Year 1: Physiology','Year 1: Cardiovascular Physiology','Year 1: Neurophysiology I') then 'Year 1: Medical Physiology I'
      when category in ('Year 1: Biochemistry','Year 1: Carbohydrate Metabolism and Bioenergetics','Year 1: Enzymes, Vitamins and Minerals') then 'Year 1: Medical Biochemistry I'
      when category in ('Year 2: Clinical Biochemistry','Year 2: Medical Biochemistry II','Year 2: Molecular Biology','Year 2: Molecular Genetics and Cytogenetics') then 'Year 2: Medical Biochemistry II'
      when category in ('Year 2: GIT Physiology','Year 2: Physiology') then 'Year 2: Medical Physiology II'
      when category in ('Year 2: Microbiology','Year 2: Parasitology') then 'Year 2: Principles of Microbiology and Parasitology'
      when category = 'Year 2: Cellular Immunology' then 'Year 2: Immunology'
      else category
    end,
    updated_at = now()
where deleted_at is null and category ~ '^Year [12]:';

-- Correct the single confirmed Year 5 ENT course outline assignment.
update public.articles
set category='Year 5: ENT', unit='ENT', unit_id='bb3a58db-3ccc-4a06-a55f-c2e70eef590e', semester_number=2,
    meta_title='Year 5 ENT Course Outline | OmpathStudy',
    meta_description='Review the Year 5 ENT second-semester course outline, assessments and learning materials.',
    updated_at=now()
where id='673c4d69-da9c-45ae-aa51-3d326f1b45a2';

-- Keep URL identities unique across blog and exam resources. No row is removed.
update public.articles set slug='chemical-pathology-mcqs-2-past-paper', updated_at=now()
where id='aca1d504-5556-4456-949f-0e1de4785028' and slug='chemical-pathology-mcqs-2';
update public.articles set slug='mycology-mcqs-complete-bank-past-paper', updated_at=now()
where id='46131691-6afb-43f5-8c61-2a5bdeb50a46' and slug='mycology-mcqs-complete-bank';

-- Complete search metadata and persist the renderer classification used by the
-- shared article layout. Visual spot banks keep their dedicated identity.
update public.articles
set content_kind = case
      when content_kind='image_spot_bank' or title ~* 'aponeurosis|spot[ -]?(exam|bank|atlas)' then 'image_spot_bank'
      when title ~* 'essay|SAQ|LAQ|short[- ]answer|long[- ]answer' and (title ~* 'MCQ|quiz' or content ~ E'(^|\\n)[[:space:]]*[A-E][.)][[:space:]]') then 'mcq_essay'
      when title ~* 'essay|SAQ|LAQ|short[- ]answer|long[- ]answer' then 'essay'
      when title ~* 'MCQ|quiz' or content ~ E'(^|\\n)[[:space:]]*[A-E][.)][[:space:]]' then 'mcq'
      when content_type='Past Paper' then 'past_paper'
      else 'notes'
    end,
    contains_answer_key = content ~* 'answer[[:space:]]*:',
    meta_title = coalesce(nullif(btrim(meta_title),''), left(regexp_replace(title,'[[:space:]]+',' ','g'),45) || ' | OmpathStudy'),
    meta_description = coalesce(nullif(btrim(meta_description),''), left('Study ' || replace(category, ':', '') || ' material with structured, exam-focused notes and practice resources.',160)),
    updated_at=now()
where deleted_at is null and category ~ '^Year [12]:';

-- Persist the correct option text before any future reordering or cleanup.
update public.mcq_sets m
set original_notes=coalesce(m.original_notes,m.questions::text), questions=x.questions, updated_at=now()
from (
  select m2.id, jsonb_agg(
    case when q ? 'correct_answer_text' and btrim(q->>'correct_answer_text')<>'' then q
         when jsonb_typeof(q->'options')='array'
          and (q->>'correct_answer') ~ '^[0-9]+$'
          and (q->>'correct_answer')::int >= 0
          and (q->>'correct_answer')::int < jsonb_array_length(q->'options')
         then jsonb_set(q,'{correct_answer_text}',q->'options'->((q->>'correct_answer')::int),true)
         else q end order by ord
  ) questions
  from public.mcq_sets m2 cross join lateral jsonb_array_elements(m2.questions) with ordinality e(q,ord)
  where m2.deleted_at is null
  group by m2.id
) x where m.id=x.id;

-- Flag incomplete assessments for editorial review; never invent answers.
update public.articles
set requires_review=true, completeness_status='missing_answers', answer_key_verified=false, updated_at=now()
where deleted_at is null and content_type in ('MCQ Bank','CAT','Past Paper','SPOT')
  and content ~ E'(^|\\n)[[:space:]]*[A-Ea-e][.)][[:space:]]+'
  and content !~* 'answer[[:space:]]*:';

update public.mcq_sets m
set requires_review=true,
    completeness_status=case
      when exists (select 1 from jsonb_array_elements(m.questions) q where case when (q->>'correct_answer') ~ '^[0-9]+$' then (q->>'correct_answer')::int < 0 or (q->>'correct_answer')::int >= jsonb_array_length(coalesce(q->'options','[]'::jsonb)) or btrim(coalesce(q->'options'->>((q->>'correct_answer')::int),''))='' else true end) then 'missing_answers'
      else 'missing_explanations' end,
    answer_key_verified=false, updated_at=now()
where deleted_at is null and (
  exists (select 1 from jsonb_array_elements(m.questions) q where case when (q->>'correct_answer') ~ '^[0-9]+$' then (q->>'correct_answer')::int < 0 or (q->>'correct_answer')::int >= jsonb_array_length(coalesce(q->'options','[]'::jsonb)) or btrim(coalesce(q->'options'->>((q->>'correct_answer')::int),''))='' else true end)
  or exists (select 1 from jsonb_array_elements(m.questions) q where coalesce(btrim(q->>'explanation'),'')='')
);

-- Publish only the canonical course-level labels in the category menu.
delete from public.article_categories where name like 'Year 1:%' or name like 'Year 2:%';
insert into public.article_categories(name)
select name from (values
 ('Year 1: Human Anatomy I'),('Year 1: Medical Physiology I'),('Year 1: Medical Biochemistry I'),
 ('Year 1: Behavioural Sciences'),('Year 1: ICT'),('Year 1: Reference'),
 ('Year 2: Medical Biochemistry II'),('Year 2: Medical Physiology II'),
 ('Year 2: Principles of Microbiology and Parasitology'),('Year 2: Immunology'),
 ('Year 2: Human Communication Skills'),('Year 2: Epidemiology and Biostatistics')
) v(name) where not exists (select 1 from public.article_categories c where c.name=v.name);
