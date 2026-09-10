-- Preserve the imported source before correcting confirmed Year 3 defects.
update public.articles
set original_notes = coalesce(original_notes, content)
where id in (
  'aa6f3843-6647-4fbb-80f9-8a2b707d5fb2',
  '82ccc2fb-069b-4688-ad7b-f96f01d96c6b',
  '5162c928-1aa8-4910-ab72-25d739e6b7cb'
);

-- No offered choice is a GABA-gated chloride-channel antagonist. DDT and
-- permethrin are sodium-channel modulators; bendiocarb inhibits AChE.
update public.articles
set content = replace(content,
  E'Answer: a) DDT (as marked)\nExplanation: DDT primarily acts by keeping voltage-gated sodium channels open; GABA-gated chloride channel antagonism is more classically linked to cyclodienes (e.g., dieldrin, lindane), though some organochlorines have secondary GABA-related activity.',
  E'Answer: No listed option is correct.\nExplanation: DDT and permethrin modify voltage-gated sodium channels, while bendiocarb inhibits acetylcholinesterase. GABA-gated chloride-channel antagonists include cyclodienes such as dieldrin.'),
  requires_review = true,
  answer_key_verified = false,
  updated_at = now()
where id = 'aa6f3843-6647-4fbb-80f9-8a2b707d5fb2';

update public.articles
set content = replace(content,
  E'Answer: \nD. DDT (as marked in exam key)',
  E'Answer: No listed option is correct.\nExplanation: DDT and permethrin act on voltage-gated sodium channels; bendiocarb and malathion inhibit acetylcholinesterase. None of the listed agents is the expected GABA-gated chloride-channel antagonist.'),
  requires_review = true,
  answer_key_verified = false,
  updated_at = now()
where id = '82ccc2fb-069b-4688-ad7b-f96f01d96c6b';

-- Cryptococcus neoformans, not Sporothrix, is classically associated with
-- pigeon-dropping-contaminated soil.
update public.articles
set content = replace(content,
  '**Answer: e (as marked)** — *Note: standard teaching associates Cryptococcus neoformans (c) most classically with pigeon droppings; verify against your course''s official key.*',
  '**Answer:** c. Cryptococcus\n**Explanation:** Cryptococcus neoformans is classically associated with soil contaminated by pigeon droppings.'),
  requires_review = true,
  answer_key_verified = false,
  updated_at = now()
where id = '5162c928-1aa8-4910-ab72-25d739e6b7cb';

-- Remove empty imported list rows. Answer-line normalization is also done by
-- the shared renderer so older and future imports receive the same layout.
update public.articles
set content = regexp_replace(content, E'(^|\\n)-[[:space:]]*(?=\\n)', E'\\1', 'g'),
    updated_at = now()
where category like 'Year 3:%'
  and content ~ E'(^|\\n)-[[:space:]]*(\\n|$)';

-- Flag genuinely answerless assessment imports for editorial completion;
-- never invent an answer merely to make the page look complete.
update public.articles
set requires_review = true,
    completeness_status = 'missing_answers'
where category like 'Year 3:%'
  and content_type in ('MCQ Bank', 'CAT', 'Past Paper')
  and content ~* '(^|\\n)[[:space:]]*[A-Ea-e][.)][[:space:]]+'
  and content !~* 'answer[[:space:]]*:';
