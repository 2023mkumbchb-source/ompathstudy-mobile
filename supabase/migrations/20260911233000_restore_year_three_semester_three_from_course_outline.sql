-- Restore the three-semester Year 3 curriculum documented in the official
-- MKU Human Pathology course outline. The September-December timetable is
-- Trimester 1; it does not replace the outline's Semester 2 and 3 structure.

insert into public.semesters (academic_year_id, semester_number, title, display_order)
select id, 3, 'Semester 3', 3
from public.academic_years
where year_number=3
on conflict (academic_year_id, semester_number) do update
set title=excluded.title, display_order=excluded.display_order;

with placement(name, semester_number, display_order) as (values
  ('General Pathology',1,1),
  ('Oncopathology',1,2),
  ('Genetic Disorders',1,3),
  ('Histopathology & Cytopathology',1,4),
  ('Bacteriology',1,5),
  ('Parasitology',1,6),
  ('Nutrition and Dietetics',1,7),
  ('Basic Pharmacology I',1,8),
  ('Chemical Pathology I',1,9),
  ('Immunopathology',1,10),

  ('Cardiovascular System Pathology',2,1),
  ('Respiratory System Pathology',2,2),
  ('Gastrointestinal Pathology',2,3),
  ('Female Reproductive System Pathology',2,4),
  ('Head & Neck Pathology',2,5),
  ('Endocrine and Metabolic Pathology',2,6),
  ('Research Methodology and Proposal Writing',2,7),
  ('Basic Pharmacology II',2,8),
  ('Chemical Pathology II',2,9),
  ('Hematopathology',2,10),
  ('Hematopathology II',2,11),

  ('Neuropathology',3,1),
  ('Bone and Soft Tissue Pathology',3,2),
  ('Dermatopathology',3,3),
  ('Breast Pathology',3,4),
  ('Male Reproductive and Urinary System Pathology',3,5),
  ('Medical Mycology',3,6),
  ('Medical Virology',3,7),
  ('Introduction to Clinical Techniques',3,8),
  ('Spot/Practical Examination',3,9),
  ('Community Health',3,10),
  ('Basic Pharmacology III',3,11),
  ('Hematopathology III',3,12),
  ('Blood Transfusion',3,13)
), resolved as (
  select u.id, p.display_order, s.id as semester_id, s.semester_number
  from placement p
  join public.academic_years y on y.year_number=3
  join public.units u on u.academic_year_id=y.id and u.name=p.name
  join public.semesters s on s.academic_year_id=y.id
    and s.semester_number=p.semester_number
)
update public.units u
set semester_id=r.semester_id, display_order=r.display_order, published=true
from resolved r
where u.id=r.id;

-- Keep every linked resource in the same detailed category and make its
-- semester follow that unit. No articles, questions or study content are removed.
update public.articles a
set category=u.legacy_category, semester_number=s.semester_number, updated_at=now()
from public.units u
join public.academic_years y on y.id=u.academic_year_id
join public.semesters s on s.id=u.semester_id
where y.year_number=3 and a.unit_id=u.id and a.deleted_at is null;

update public.mcq_sets m
set category=u.legacy_category, semester_number=s.semester_number, updated_at=now()
from public.units u
join public.academic_years y on y.id=u.academic_year_id
join public.semesters s on s.id=u.semester_id
where y.year_number=3 and m.unit_id=u.id and m.deleted_at is null;

update public.flashcard_sets f
set category=u.legacy_category, updated_at=now()
from public.units u
join public.academic_years y on y.id=u.academic_year_id
where y.year_number=3 and f.unit_id=u.id and f.deleted_at is null;

-- Ensure the reviewed detailed categories appear in category navigation even
-- when a unit currently has no published article.
insert into public.article_categories(name)
select u.legacy_category
from public.units u
join public.academic_years y on y.id=u.academic_year_id
where y.year_number=3 and u.legacy_category is not null
on conflict (name) do nothing;
