-- Consolidate Year 3 labels into course-level categories while retaining the
-- semester_number and topic unit_id on each resource.
update public.articles
set category = case
  when id = 'e2f15130-9669-425c-9cf0-aa96ff63096b' then 'Year 1: Physiology'
  when id = 'fa9e4335-816d-46a0-8ba3-d23102c4f418' then 'Year 1: Embryology'
  when category in ('Year 3: Genetic Disorders','Year 3: Oncopathology') then 'Year 3: General Pathology'
  when category in ('Year 3: Cardiovascular System Pathology','Year 3: Respiratory System Pathology','Year 3: Gastrointestinal Pathology','Year 3: Female Reproductive System Pathology','Year 3: Head & Neck Pathology','Year 3: Endocrine and Metabolic Pathology') then 'Year 3: Systemic Pathology I'
  when category in ('Year 3: Neuropathology','Year 3: Bone and Soft Tissue Pathology','Year 3: Breast Pathology','Year 3: Dermatopathology','Year 3: Male Reproductive and Urinary System Pathology') then 'Year 3: Systemic Pathology II'
  when category in ('Year 3: Hematopathology','Year 3: Hematopathology II') then 'Year 3: Hematology II'
  when category in ('Year 3: Hematopathology III','Year 3: Blood Transfusion') then 'Year 3: Hematology & Blood Transfusion III'
  when category in ('Year 3: Chemical Pathology I','Year 3: Chemical Pathology II') then 'Year 3: Chemical Pathology'
  when category in ('Year 3: Basic Pharmacology I','Year 3: Basic Pharmacology II','Year 3: Basic Pharmacology III') then 'Year 3: Pharmacology'
  when category in ('Year 3: Bacteriology','Year 3: Parasitology','Year 3: EXAM: MEDICAL MICROBIOLOGY III') then 'Year 3: Medical Microbiology I — Bacteriology & Parasitology'
  when category in ('Year 3: Medical Virology','Year 3: Medical Mycology') then 'Year 3: Medical Microbiology II — Virology & Mycology'
  when category = 'Year 3: Medical Microbiology and Parasitology' and title ~* '(virology|mycology)' then 'Year 3: Medical Microbiology II — Virology & Mycology'
  when category = 'Year 3: Medical Microbiology and Parasitology' then 'Year 3: Medical Microbiology I — Bacteriology & Parasitology'
  when category = 'Year 3: Introduction to Clinical Techniques' then 'Year 3: Clinical Techniques'
  when category in ('Year 3: Pathology Practical Revision Guide','Year 3: Spot/Practical Examination') then 'Year 3: Pathology Practical'
  when category = 'Year 3: Research Methodology and Proposal Writing' then 'Year 3: Research Methodology'
  else category
end,
unit_id = case when id in ('e2f15130-9669-425c-9cf0-aa96ff63096b','fa9e4335-816d-46a0-8ba3-d23102c4f418') then null else unit_id end,
semester_number = case when id in ('e2f15130-9669-425c-9cf0-aa96ff63096b','fa9e4335-816d-46a0-8ba3-d23102c4f418') then null else semester_number end,
updated_at = now()
where category like 'Year 3:%';

update public.mcq_sets
set category = case
  when category in ('Year 3: Genetic Disorders','Year 3: Oncopathology') then 'Year 3: General Pathology'
  when category in ('Year 3: Cardiovascular System Pathology','Year 3: Respiratory System Pathology','Year 3: Gastrointestinal Pathology','Year 3: Female Reproductive System Pathology','Year 3: Head & Neck Pathology','Year 3: Endocrine and Metabolic Pathology') then 'Year 3: Systemic Pathology I'
  when category in ('Year 3: Bone and Soft Tissue Pathology','Year 3: Male Reproductive and Urinary System Pathology') then 'Year 3: Systemic Pathology II'
  when category = 'Year 3: Hematopathology' then 'Year 3: Hematology II'
  when category in ('Year 3: Hematopathology III','Year 3: Blood Transfusion') then 'Year 3: Hematology & Blood Transfusion III'
  when category in ('Year 3: Chemical Pathology I','Year 3: Chemical Pathology II') then 'Year 3: Chemical Pathology'
  when category in ('Year 3: Basic Pharmacology II','Year 3: Basic Pharmacology III') then 'Year 3: Pharmacology'
  when category in ('Year 3: Bacteriology','Year 3: Parasitology') then 'Year 3: Medical Microbiology I — Bacteriology & Parasitology'
  when category in ('Year 3: Medical Virology','Year 3: Medical Mycology') then 'Year 3: Medical Microbiology II — Virology & Mycology'
  when category = 'Year 3: Medical Microbiology and Parasitology' and title ~* '(virology|mycology)' then 'Year 3: Medical Microbiology II — Virology & Mycology'
  when category = 'Year 3: Medical Microbiology and Parasitology' then 'Year 3: Medical Microbiology I — Bacteriology & Parasitology'
  when category = 'Year 3: Introduction to Clinical Techniques' then 'Year 3: Clinical Techniques'
  else category
end,
semester_number = case
  when category in ('Year 3: Medical Virology','Year 3: Medical Mycology') or (category='Year 3: Medical Microbiology and Parasitology' and title ~* '(virology|mycology)') then 3
  else semester_number
end,
updated_at = now()
where category like 'Year 3:%';

update public.flashcard_sets
set category = case
  when category = 'Year 3: Blood Transfusion' then 'Year 3: Hematology & Blood Transfusion III'
  when category = 'Year 3: Male Reproductive and Urinary System Pathology' then 'Year 3: Systemic Pathology II'
  when category = 'Year 3: Medical Mycology' then 'Year 3: Medical Microbiology II — Virology & Mycology'
  else category
end,
updated_at = now()
where category like 'Year 3:%';

-- Normalize display titles without changing slugs/URLs.
update public.articles
set title = case
  when title = 'Artherosclerosis — Past Paper' then 'Atherosclerosis — Past Paper'
  when title = 'muscuskeletal exam — Past Paper' then 'Musculoskeletal Pathology Examination — Past Paper'
  when title = 'renal pathology — Past Paper' then 'Renal Pathology — Past Paper'
  when title = 'hematopathology — Past Paper' then 'Hematopathology — Past Paper'
  when title = 'pathology essays — Past Paper' then 'Pathology Essays — Past Paper'
  when title = 'systemic pathology essays — Past Paper' then 'Systemic Pathology Essays — Past Paper'
  when title = 'cat makeup — CAT' then 'General Pathology Make-up CAT'
  when title = 'makeup cat with ans — CAT' then 'General Pathology Make-up CAT with Answers'
  when title = 'YEAR 3 PARASITOLOGY NOTES' then 'Medical Parasitology Revision Notes'
  when title = 'Medical Virology Exams' then 'Medical Virology Examination Collection — Past Papers'
  when title = 'Medical Mycology Compilation' then 'Medical Mycology Examination Collection — Past Papers'
  when title = 'Pathology Practical Revision Guide' then 'Pathology Practical and Stains Revision Guide'
  else regexp_replace(title, '[[:space:]]+', ' ', 'g')
end,
updated_at = now()
where category like 'Year 3:%';

-- Write concise, consistent descriptions from the verified content type and
-- consolidated course category. Avoid raw OCR text in search snippets.
update public.articles
set meta_title = left(regexp_replace(title, '[[:space:]]+—[[:space:]]+(Notes|Past Papers?|MCQ Bank|CAT([[:space:]]+[0-9]{4})?|Revision Guide)$', '', 'i'), 45) || ' | Year 3 | OmpathStudy',
meta_description = left(
  case
    when content_type='CAT' then 'Revise this Year 3 ' || replace(category,'Year 3: ','') || ' CAT with structured questions, answers and concise explanations.'
    when content_type='Past Paper' then 'Practise this Year 3 ' || replace(category,'Year 3: ','') || ' past paper with clearly arranged questions, answers and explanations.'
    when content_type='MCQ Bank' then 'Test your Year 3 ' || replace(category,'Year 3: ','') || ' knowledge using organised MCQs, answer keys and concise explanations.'
    when content_type='Revision Guide' then 'Review high-yield Year 3 ' || replace(category,'Year 3: ','') || ' concepts in a clear, exam-oriented revision guide.'
    else 'Study clear, exam-oriented Year 3 ' || replace(category,'Year 3: ','') || ' notes with structured headings and concise explanations.'
  end, 160),
updated_at = now()
where category like 'Year 3:%';

-- Replace the accumulated ad-hoc category menu with the canonical catalogue.
delete from public.article_categories where name like 'Year 3:%';
insert into public.article_categories(name)
select x.name from (values
 ('Year 3: General Pathology'),('Year 3: Systemic Pathology I'),('Year 3: Systemic Pathology II'),
 ('Year 3: Immunopathology'),('Year 3: Histopathology & Cytopathology'),
 ('Year 3: Hematology II'),('Year 3: Hematology & Blood Transfusion III'),
 ('Year 3: Chemical Pathology'),('Year 3: Pharmacology'),
 ('Year 3: Medical Microbiology I — Bacteriology & Parasitology'),
 ('Year 3: Medical Microbiology II — Virology & Mycology'),
 ('Year 3: Clinical Techniques'),('Year 3: Community Health'),
 ('Year 3: Nutrition and Dietetics'),('Year 3: Research Methodology'),
 ('Year 3: Pathology Practical'),('Year 3: Reference')
) x(name)
where not exists (select 1 from public.article_categories c where c.name=x.name);

-- Repair four malformed true/false questions where an explanation was
-- imported as extra answer choices. Correct-answer identity is preserved.
update public.mcq_sets m
set original_notes = coalesce(m.original_notes, m.questions::text),
questions = fixed.questions,
requires_review = true,
answer_key_verified = false,
updated_at = now()
from (
  select id, jsonb_agg(
    case ordinality
      when 2 then jsonb_set(jsonb_set(jsonb_set(q,'{options}','["True","False"]'::jsonb),'{correct_answer}','0'::jsonb),'{explanation}',to_jsonb('Receptor agonists bind and activate receptors to produce a response.'::text))
      when 6 then jsonb_set(jsonb_set(jsonb_set(q,'{options}','["False","True"]'::jsonb),'{correct_answer}','1'::jsonb),'{explanation}',to_jsonb('Drug strength describes the amount of active drug in a preparation; potency is a comparative dose-response property.'::text))
      when 10 then jsonb_set(jsonb_set(jsonb_set(q,'{options}','["False","True"]'::jsonb),'{correct_answer}','0'::jsonb),'{explanation}',to_jsonb('Antagonists have affinity but no intrinsic activity; they block agonist-mediated receptor responses.'::text))
      when 32 then jsonb_set(jsonb_set(jsonb_set(q,'{options}','["True","False"]'::jsonb),'{correct_answer}','0'::jsonb),'{explanation}',to_jsonb('Strength may be expressed as the concentration of active drug, such as milligrams per millilitre.'::text))
      else q end order by ordinality
  ) questions
  from public.mcq_sets cross join lateral jsonb_array_elements(questions) with ordinality e(q,ordinality)
  where id='830e7655-bae4-45fb-936d-5343da59c091'
  group by id
) fixed
where m.id=fixed.id;

-- Banks lacking explanations remain visible but enter the review queue; an
-- invented generic sentence is not a medically valid explanation.
update public.mcq_sets m
set requires_review=true, completeness_status='missing_explanations'
where category like 'Year 3:%'
and exists (select 1 from jsonb_array_elements(m.questions) q where coalesce(btrim(q->>'explanation'),'')='');
