-- Normalize public SEO metadata from each resource's actual title, type and
-- canonical unit. Existing article/story URLs are retained to protect indexed
-- links; only missing MCQ slugs are generated.

-- Correct three high-confidence title/category mismatches found by comparing
-- the displayed title with the document heading and body.
with corrections(article_id, target_category, next_title) as (values
  ('b337eda8-86ea-46ce-a10a-3f55e149f07e'::uuid, 'Year 2: Clinical Biochemistry', 'Biochemistry Make-up CAT — 50 Questions with Answers'),
  ('7e702b23-f587-4510-b35e-823a7310eea6'::uuid, 'Year 3: Introduction to Clinical Techniques', 'Musculoskeletal Examination — Knee and Shoulder Clinical Guide'),
  ('d9bfe307-d785-4260-94dc-562f5e4b8c21'::uuid, 'Year 3: Introduction to Clinical Techniques', 'Head-to-Toe Clinical Assessment Guide')
), resolved as (
  select c.article_id,c.next_title,u.id unit_id,u.legacy_category,s.semester_number
  from corrections c join public.units u on u.legacy_category=c.target_category
  left join public.semesters s on s.id=u.semester_id
)
update public.articles a set title=r.next_title,unit_id=r.unit_id,
  category=r.legacy_category,semester_number=r.semester_number,updated_at=now()
from resolved r where a.id=r.article_id and a.deleted_at is null;

-- Clean visible titles without rewriting clinically meaningful wording.
update public.articles set title=btrim(regexp_replace(
  replace(replace(replace(title,'&amp;','&'),'&nbsp;',' '),E'\\u00a0',' '),
  '[[:space:]]+',' ','g')),updated_at=now()
where deleted_at is null;

update public.mcq_sets set title=coalesce(nullif(btrim(regexp_replace(
  replace(replace(replace(title,'&amp;','&'),'&nbsp;',' '),E'\\u00a0',' '),
  '[[:space:]]+',' ','g')),''),
  regexp_replace(category,'^Year[[:space:]]+[1-6]:[[:space:]]*','','i') || ' MCQs'),updated_at=now()
where deleted_at is null;

update public.stories set title=btrim(regexp_replace(
  replace(replace(replace(title,'&amp;','&'),'&nbsp;',' '),E'\\u00a0',' '),
  '[[:space:]]+',' ','g'))
where deleted_at is null;

-- Keep meta titles readable and within 60 characters. Truncation occurs at a
-- word boundary and the brand is included once.
with prepared as (
  select id,title,
    regexp_replace(title,'[[:space:]]*\\|[[:space:]]*OmpathStudy[[:space:]]*$','','i') base
  from public.articles where published=true and deleted_at is null
)
update public.articles a set meta_title=case
  when length(p.base || ' | OmpathStudy')<=60 then p.base || ' | OmpathStudy'
  else coalesce(nullif(regexp_replace(left(p.base,45),'[[:space:]]+[^[:space:]]*$',''),''),left(p.base,45)) || ' | OmpathStudy' end,
  meta_description=left(case
    when coalesce(a.content_type,'') ~* 'MCQ|Question' or a.title ~* 'MCQ|Question Bank' then
      'Practise ' || regexp_replace(a.title,'[[:space:]]+—[[:space:]]+(MCQ Bank|Questions?)$','','i') ||
      ' with organized questions, answers and explanations for focused medical exam revision.'
    when coalesce(a.content_type,'') ~* 'Past Paper|CAT|Exam' or a.title ~* 'Past Paper|CAT|Examination' then
      'Revise ' || regexp_replace(a.title,'[[:space:]]+—[[:space:]]+(Past Paper|CAT)$','','i') ||
      ' with structured exam questions and available answers for focused medical revision.'
    when coalesce(a.content_type,'') ~* 'Course Outline' or a.title ~* 'Course Outline' then
      'Review ' || a.title || ', including the learning outcomes, core topics and assessment structure for this medical course.'
    else 'Study ' || regexp_replace(a.title,'[[:space:]]+—[[:space:]]+(Notes|Revision Guide)$','','i') ||
      ' with clear, structured coverage of the key concepts in ' ||
      regexp_replace(coalesce(a.category,'medical education'),'^Year[[:space:]]+[1-6]:[[:space:]]*','','i') || '.' end,160),
  updated_at=now()
from prepared p where a.id=p.id;

-- Every published MCQ set receives a stable slug and metadata based on the
-- actual set title, canonical unit and stored question count.
update public.mcq_sets m set slug=coalesce(nullif(btrim(m.slug),''),
  trim(both '-' from regexp_replace(lower(replace(m.title,'&',' and ')),'[^a-z0-9]+','-','g')) || '-' || left(m.id::text,8))
where m.published=true and m.deleted_at is null;

with prepared as (
  select id,title,
    regexp_replace(title,'[[:space:]]*\\|[[:space:]]*OmpathStudy[[:space:]]*$','','i') base,
    case when jsonb_typeof(questions)='array' then jsonb_array_length(questions) else 0 end question_count
  from public.mcq_sets where published=true and deleted_at is null
)
update public.mcq_sets m set meta_title=case
  when length(p.base || ' | OmpathStudy')<=60 then p.base || ' | OmpathStudy'
  else coalesce(nullif(regexp_replace(left(p.base,45),'[[:space:]]+[^[:space:]]*$',''),''),left(p.base,45)) || ' | OmpathStudy' end,
  meta_description=left('Practise ' || p.question_count || ' ' ||
    regexp_replace(m.title,'[[:space:]]+—[[:space:]]+(MCQ Bank|MCQs?)$','','i') ||
    ' MCQs with answers and explanations for focused revision in ' ||
    regexp_replace(coalesce(m.category,'medical studies'),'^Year[[:space:]]+[1-6]:[[:space:]]*','','i') || '.',160),
  updated_at=now()
from prepared p where m.id=p.id;

-- Stories retain their editorial summaries; only normalize their title tag.
with prepared as (
  select id,regexp_replace(title,'[[:space:]]*\\|[[:space:]]*OmpathStudy[[:space:]]*$','','i') base
  from public.stories where published=true and deleted_at is null
)
update public.stories s set meta_title=case
  when length(p.base || ' | OmpathStudy')<=60 then p.base || ' | OmpathStudy'
  else coalesce(nullif(regexp_replace(left(p.base,45),'[[:space:]]+[^[:space:]]*$',''),''),left(p.base,45)) || ' | OmpathStudy' end,
  meta_description=left(btrim(regexp_replace(regexp_replace(coalesce(s.meta_description,s.content),'[#*_`>]+',' ','g'),'[[:space:]]+',' ','g')),160)
from prepared p where s.id=p.id;
