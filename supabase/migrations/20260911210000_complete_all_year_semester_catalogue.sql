-- Complete the Year 4-6 catalogue using the official MKU MBChB
-- September-December 2026 Trimester 1 timetable. Years 1-3 were aligned in
-- the preceding timetable migration. Units listed in Trimester 1 belong to
-- Semester 1; established catalogue units absent from it belong to Semester 2.

with catalogue(year_number, name, semester_number, display_order) as (values
  (4, 'Obstetrics and Gynaecology', 1, 1),
  (4, 'General Surgery', 1, 2),
  (4, 'Mental Health/Psychiatry', 1, 3),
  (4, 'Internal Medicine', 1, 4),
  (4, 'Pediatrics and Child Health', 1, 5),
  (4, 'Clinical Pharmacology II', 1, 6),

  (5, 'Orthopedics and Trauma', 1, 1),
  (5, 'Dental Health', 1, 2),
  (5, 'Ophthalmology', 1, 3),
  (5, 'ENT', 1, 4),
  (5, 'Radiology and Imaging', 1, 5),
  (5, 'Anaesthesiology and Critical Care', 1, 6),
  (5, 'Public Health', 1, 7),
  (5, 'Health Informatics and Electronics', 1, 8),
  (5, 'Dermatology', 2, 9),

  (6, 'Senior Clerkship in General Surgery', 1, 1),
  (6, 'Senior Clerkship in Internal Medicine', 1, 2),
  (6, 'Senior Clerkship in Reproductive Health', 1, 3),
  (6, 'Senior Clerkship in Pediatrics and Child Health', 1, 4),
  (6, 'Senior Clerkship in Mental Health', 1, 5),
  (6, 'Therapeutics', 2, 6),
  (6, 'Oncology and Palliative Care', 2, 7)
), resolved as (
  select y.id as academic_year_id, c.year_number, c.name,
         c.display_order, s.id as semester_id
  from catalogue c
  join public.academic_years y on y.year_number=c.year_number
  join public.semesters s on s.academic_year_id=y.id
    and s.semester_number=c.semester_number
)
insert into public.units
  (academic_year_id, semester_id, name, slug, short_name, description,
   legacy_category, display_order, published)
select academic_year_id, semester_id, name,
       trim(both '-' from regexp_replace(lower(regexp_replace(name, '&', ' and ', 'g')), '[^a-z0-9]+', '-', 'g')),
       case when length(name)<=24 then name else null end,
       name || ' resources for Year ' || year_number || ', organized into notes, assessments and revision activities.',
       'Year ' || year_number || ': ' || name, display_order, true
from resolved
on conflict (academic_year_id, slug) do update
set semester_id=excluded.semester_id,
    name=excluded.name,
    legacy_category=excluded.legacy_category,
    display_order=excluded.display_order,
    published=true;

-- Link any existing or later-imported resources whose preserved category
-- already matches one of these canonical units.
update public.articles a
set unit_id=u.id, semester_number=s.semester_number, updated_at=now()
from public.units u join public.semesters s on s.id=u.semester_id
where a.deleted_at is null and a.category=u.legacy_category
  and substring(a.category from '^Year ([4-6]):')::int between 4 and 6;

update public.mcq_sets m
set unit_id=u.id, semester_number=s.semester_number, updated_at=now()
from public.units u join public.semesters s on s.id=u.semester_id
where m.deleted_at is null and m.category=u.legacy_category
  and substring(m.category from '^Year ([4-6]):')::int between 4 and 6;

update public.flashcard_sets f
set unit_id=u.id, updated_at=now()
from public.units u
where f.deleted_at is null and f.category=u.legacy_category
  and substring(f.category from '^Year ([4-6]):')::int between 4 and 6;
