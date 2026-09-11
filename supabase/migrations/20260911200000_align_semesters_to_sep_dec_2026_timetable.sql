-- Align catalogue semesters with the official MKU MBChB September-December
-- 2026 teaching timetable. It identifies this teaching period as Trimester 1.

-- Year 3 was previously split into an unsupported third semester. Move those
-- units into Semester 2 first, then place the courses explicitly listed in the
-- supplied Trimester 1 timetable into Semester 1.
update public.units u
set semester_id=s2.id
from public.academic_years y, public.semesters s2
where u.academic_year_id=y.id and y.year_number=3
  and s2.academic_year_id=y.id and s2.semester_number=2
  and u.semester_id=(select id from public.semesters where academic_year_id=y.id and semester_number=3);

update public.articles
set semester_number=2, updated_at=now()
where deleted_at is null and category like 'Year 3:%' and semester_number=3;

update public.mcq_sets
set semester_number=2, updated_at=now()
where deleted_at is null and category like 'Year 3:%' and semester_number=3;

with timetable_units(name) as (values
 ('Bacteriology'),('Parasitology'),('Basic Pharmacology I'),
 ('Nutrition and Dietetics'),('General Pathology'),('Oncopathology'),
 ('Genetic Disorders'),('Immunopathology'),('Chemical Pathology I'),
 ('Histopathology & Cytopathology'),('Spot/Practical Examination')
)
update public.units u set semester_id=s1.id
from public.academic_years y, public.semesters s1, timetable_units t
where u.academic_year_id=y.id and y.year_number=3 and u.name=t.name
  and s1.academic_year_id=y.id and s1.semester_number=1;

-- Years 1 and 2: assign the units represented directly in the supplied
-- Trimester 1 unit lists. Unlisted specialist units belong to Semester 2.
with first_period(year_number,name) as (values
 (1,'Anatomy'),(1,'Aponeurosis - Anatomy'),(1,'Aponeurosis - Embryology'),
 (1,'Aponeurosis - Histology'),(1,'Embryology'),(1,'Biochemistry'),
 (1,'Neurophysiology I'),(1,'Physiology'),(1,'Behavioural Sciences'),(1,'ICT'),
 (2,'Cellular Immunology'),(2,'Clinical Biochemistry'),(2,'GIT Physiology'),
 (2,'Medical Biochemistry II'),(2,'Microbiology'),(2,'Physiology')
)
update public.units u
set semester_id=case
  when exists (select 1 from first_period fp where fp.year_number=y.year_number and fp.name=u.name) then s1.id
  else s2.id end
from public.academic_years y, public.semesters s1, public.semesters s2
where u.academic_year_id=y.id and y.year_number in (1,2)
  and s1.academic_year_id=y.id and s1.semester_number=1
  and s2.academic_year_id=y.id and s2.semester_number=2;

-- Year 5 ENT is explicitly part of the Year 5 Trimester 1 rotation.
update public.units u set semester_id=s1.id
from public.academic_years y, public.semesters s1
where u.academic_year_id=y.id and y.year_number=5 and u.name='ENT'
  and s1.academic_year_id=y.id and s1.semester_number=1;

-- Resource semester follows its preserved detailed unit assignment.
update public.articles a set semester_number=s.semester_number, updated_at=now()
from public.units u join public.semesters s on s.id=u.semester_id
where a.unit_id=u.id and a.deleted_at is null and a.category ~ '^Year [1-6]:';

update public.mcq_sets m set semester_number=s.semester_number, updated_at=now()
from public.units u join public.semesters s on s.id=u.semester_id
where m.unit_id=u.id and m.deleted_at is null and m.category ~ '^Year [1-6]:';

-- Consolidated Year 3 categories without a detailed unit use the same
-- two-semester timetable mapping.
update public.articles set semester_number=case
  when category in ('Year 3: General Pathology','Year 3: Histopathology & Cytopathology',
    'Year 3: Medical Microbiology I — Bacteriology & Parasitology','Year 3: Nutrition and Dietetics',
    'Year 3: Pathology Practical') then 1
  when category like 'Year 3:%' and category<>'Year 3: Reference' then 2
  else semester_number end,
  updated_at=now()
where deleted_at is null and unit_id is null and category like 'Year 3:%';

update public.mcq_sets set semester_number=case
  when category in ('Year 3: General Pathology','Year 3: Histopathology & Cytopathology',
    'Year 3: Medical Microbiology I — Bacteriology & Parasitology','Year 3: Nutrition and Dietetics',
    'Year 3: Pathology Practical') then 1 else 2 end,
  updated_at=now()
where deleted_at is null and unit_id is null and category like 'Year 3:%';

-- Remove only the obsolete empty semester container after all references move.
delete from public.semesters s using public.academic_years y
where s.academic_year_id=y.id and y.year_number=3 and s.semester_number=3;
