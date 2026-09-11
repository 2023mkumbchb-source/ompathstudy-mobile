-- Align every active academic blog category with its reviewed canonical unit.
-- The linked units were classified from article titles/content and aligned to
-- the official September-December 2026 timetable in the preceding migrations.
-- Stories remain Stories; non-study placeholders are not forced into a course.

-- Correct the small set of missing or cross-year links found in the final
-- article-by-article audit before applying the general category sync.
with corrections(article_id, target_category) as (values
  -- Year 1
  ('fa9e4335-816d-46a0-8ba3-d23102c4f418'::uuid, 'Year 1: Embryology'),
  ('e2f15130-9669-425c-9cf0-aa96ff63096b'::uuid, 'Year 1: Physiology'),
  ('79d0f62d-8fbd-48e6-9f8b-7e993fb09b9f'::uuid, 'Year 1: Physiology'),
  ('b364c03d-05fb-40f9-b5a8-9eae9cc5bbc3'::uuid, 'Year 1: Physiology'),
  ('f23c5ab1-3acd-44b6-a512-ad7ca1317d38'::uuid, 'Year 1: Physiology'),
  ('81a9c54f-1aa1-4360-bf32-079f37c7fd12'::uuid, 'Year 1: Physiology'),

  -- Year 2
  ('820d195d-b1ed-4003-8a2c-f74e55643dcc'::uuid, 'Year 2: Parasitology'),

  -- Year 3 bacteriology, parasitology and medical entomology
  ('ec0b3ebd-1091-4f0a-846a-72de6425000d'::uuid, 'Year 3: Parasitology'),
  ('1446c28f-dbf9-46b9-b3dd-e443c9311c41'::uuid, 'Year 3: Parasitology'),
  ('3d7e9206-9d1a-489d-a631-7bf072b77de9'::uuid, 'Year 3: Bacteriology'),
  ('aa6f3843-6647-4fbb-80f9-8a2b707d5fb2'::uuid, 'Year 3: Bacteriology'),
  ('b09e6291-bcf7-49b6-8abc-57c9e8afbdc2'::uuid, 'Year 3: Bacteriology'),
  ('82ccc2fb-069b-4688-ad7b-f96f01d96c6b'::uuid, 'Year 3: Parasitology'),
  ('ca2a8b03-a501-425e-a04f-44ea112fdca1'::uuid, 'Year 3: Parasitology'),
  ('a27dfae2-0211-4311-8da3-e132618cbebc'::uuid, 'Year 3: Parasitology'),
  ('73dc5534-80f1-4a55-aa7a-16552906cf80'::uuid, 'Year 3: Parasitology'),

  -- Year 3 virology, mycology, haematology and practicals
  ('5162c928-1aa8-4910-ab72-25d739e6b7cb'::uuid, 'Year 3: Medical Mycology'),
  ('90c15a70-d28b-448e-9f42-7a217b59a6c8'::uuid, 'Year 3: Medical Virology'),
  ('e39e4a60-056c-4deb-81a7-203369e4c8c1'::uuid, 'Year 3: Medical Virology'),
  ('ca7aa82d-291b-4387-8852-95c2b4777198'::uuid, 'Year 3: Medical Virology'),
  ('8798aa7b-1979-4461-93c9-a82415fe54cd'::uuid, 'Year 3: Hematopathology'),
  ('f88e3a8c-69ce-49ea-ae97-e5e9960ab33b'::uuid, 'Year 3: Hematopathology'),
  ('386b04c8-a6ed-4396-a099-842e70d61fc9'::uuid, 'Year 3: Spot/Practical Examination')
), resolved as (
  select c.article_id,u.id as unit_id,u.legacy_category,s.semester_number
  from corrections c
  join public.units u on u.legacy_category=c.target_category
  left join public.semesters s on s.id=u.semester_id
)
update public.articles a
set unit_id=r.unit_id,
    category=r.legacy_category,
    semester_number=r.semester_number,
    updated_at=now()
from resolved r
where a.id=r.article_id and a.deleted_at is null;

-- Replace broad or stale academic labels with the exact category of the
-- reviewed linked unit. This is the main correction for the 461 mismatches.
update public.articles a
set category=u.legacy_category,
    semester_number=s.semester_number,
    updated_at=now()
from public.units u
left join public.semesters s on s.id=u.semester_id
where a.unit_id=u.id and a.deleted_at is null
  and (a.category is distinct from u.legacy_category
       or a.semester_number is distinct from s.semester_number);

-- Normalize the malformed legacy haematology label if it survives because the
-- article was edited concurrently during deployment.
update public.articles a
set unit_id=u.id, category=u.legacy_category,
    semester_number=s.semester_number, updated_at=now()
from public.units u left join public.semesters s on s.id=u.semester_id
where a.deleted_at is null and a.category='Year 3 : Hematopathology'
  and u.legacy_category='Year 3: Hematopathology';
