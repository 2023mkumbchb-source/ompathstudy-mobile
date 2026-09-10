-- Give the Year 3 catalogue one durable semester source of truth.
insert into public.semesters (academic_year_id, semester_number, title, display_order)
select id, 3, 'Semester 3', 3
from public.academic_years
where year_number = 3
on conflict (academic_year_id, semester_number)
do update set title = excluded.title, display_order = excluded.display_order;

with year_three as (
  select id from public.academic_years where year_number = 3
), unit_semesters(unit_name, semester_number) as (
  values
    ('General Pathology', 1), ('Oncopathology', 1), ('Genetic Disorders', 1),
    ('Histopathology & Cytopathology', 1), ('Bacteriology', 1), ('Parasitology', 1),
    ('Nutrition and Dietetics', 1), ('Basic Pharmacology I', 1), ('Chemical Pathology I', 1),
    ('Cardiovascular System Pathology', 2), ('Respiratory System Pathology', 2),
    ('Gastrointestinal Pathology', 2), ('Female Reproductive System Pathology', 2),
    ('Head & Neck Pathology', 2), ('Endocrine and Metabolic Pathology', 2),
    ('Research Methodology and Proposal Writing', 2), ('Basic Pharmacology II', 2),
    ('Chemical Pathology II', 2), ('Hematopathology', 2), ('Hematopathology II', 2),
    ('Neuropathology', 3), ('Bone and Soft Tissue Pathology', 3), ('Breast Pathology', 3),
    ('Dermatopathology', 3), ('Male Reproductive and Urinary System Pathology', 3),
    ('Immunopathology', 3), ('Medical Mycology', 3), ('Medical Virology', 3),
    ('Introduction to Clinical Techniques', 3), ('Spot/Practical Examination', 3),
    ('Community Health', 3), ('Basic Pharmacology III', 3), ('Hematopathology III', 3),
    ('Blood Transfusion', 3)
)
update public.units u
set semester_id = s.id
from year_three y, unit_semesters m, public.semesters s
where u.academic_year_id = y.id
  and u.name = m.unit_name
  and s.academic_year_id = y.id
  and s.semester_number = m.semester_number;

-- Most articles inherit their semester from their canonical unit.
update public.articles a
set semester_number = s.semester_number
from public.units u
join public.semesters s on s.id = u.semester_id
join public.academic_years y on y.id = u.academic_year_id
where a.unit_id = u.id
  and y.year_number = 3
  and a.category like 'Year 3:%';

-- Older imports without a canonical unit are classified conservatively by
-- their existing category/title. Reference material intentionally stays global.
update public.articles
set semester_number = case
  when category = 'Year 3: EXAM: MEDICAL MICROBIOLOGY III' then 1
  when category = 'Year 3: Pathology Practical Revision Guide' then 3
  when category = 'Year 3: Medical Mycology' then 3
  when category = 'Year 3: Medical Virology' then 3
  when category = 'Year 3: Medical Microbiology and Parasitology'
    and title ~* '(virology|mycology)' then 3
  when category = 'Year 3: Medical Microbiology and Parasitology'
    and title ~* '(bacteriology|parasitology|entomology)' then 1
  else semester_number
end
where category in (
  'Year 3: EXAM: MEDICAL MICROBIOLOGY III',
  'Year 3: Pathology Practical Revision Guide',
  'Year 3: Medical Mycology',
  'Year 3: Medical Virology',
  'Year 3: Medical Microbiology and Parasitology'
);

-- Some older rows point at a duplicate legacy unit. Category is authoritative
-- for these unambiguous Semester 1 subjects.
update public.articles
set semester_number = 1
where category in ('Year 3: Bacteriology', 'Year 3: Parasitology')
  and semester_number is null;

-- Fill the missing resource labels used by the Year 3 catalogue.
update public.articles
set content_type = case
  when title ~* '(^|[^a-z])cat([^a-z]|$)|continuous assessment' then 'CAT'
  when title ~* 'past paper|supplementary|end[- ]?of[- ]?year|\mexam(ination)?s?\M' then 'Past Paper'
  else 'Notes'
end
where category like 'Year 3:%'
  and content_type is null;
