-- Finish the metadata quality pass: correct recurring source-title defects and
-- bring short descriptions into a useful search-snippet range.
update public.articles set title=case
  when title='LEISHMANIA — Notes' then 'Leishmania — Notes'
  when title='Pharmco Notes — Notes' then 'Basic Pharmacology Notes'
  when title='MEDICAL PHYSIOLOGY II ESsays — Notes' then 'Medical Physiology II Essays'
  when title='Medical Physiology Pp2 Year 2 — Notes' then 'Medical Physiology Paper II — Questions and Answers'
  when title='LECTURE 7: GI tract Hormones — Notes' then 'Gastrointestinal Hormones — Lecture 7 Notes'
  when title='Bnd 3104 Nutrition And Dietetics — Notes' then 'BND 3104 Nutrition and Dietetics — Questions and Answers'
  when title='TAKE HOME CAT 1&2. — CAT' then 'Basic Pharmacology Take-Home CAT 1 and 2'
  when title='CRUSH COURSE (PART 2) Clinical Chem Pathology — Revision Guide' then 'Clinical Chemical Pathology Crash Course — Part 2'
  else title end,
  updated_at=now()
where deleted_at is null;

-- Rebuild title tags for the corrected records and ensure every description
-- is long enough to communicate its study value without keyword stuffing.
with prepared as (
  select id,regexp_replace(title,'[[:space:]]*\\|[[:space:]]*OmpathStudy[[:space:]]*$','','i') base
  from public.articles where published=true and deleted_at is null
)
update public.articles a set meta_title=case
  when length(p.base || ' | OmpathStudy')<=60 then p.base || ' | OmpathStudy'
  else coalesce(nullif(regexp_replace(left(p.base,45),'[[:space:]]+[^[:space:]]*$',''),''),left(p.base,45)) || ' | OmpathStudy' end,
  meta_description=case when length(a.meta_description)<120 then
    left(rtrim(a.meta_description,'.') || '. Designed for MBChB students preparing for medical examinations.',160)
    else a.meta_description end,
  updated_at=now()
from prepared p where a.id=p.id;

update public.mcq_sets set meta_description=
  left(rtrim(meta_description,'.') || '. Designed for MBChB students preparing for medical examinations.',160),
  updated_at=now()
where published=true and deleted_at is null and length(meta_description)<120;
