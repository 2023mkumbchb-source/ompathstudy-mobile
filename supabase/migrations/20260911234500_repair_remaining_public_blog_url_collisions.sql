-- Preserve every published article as a distinct canonical sitemap URL.
-- Six-character hexadecimal import suffixes are stripped from public routes,
-- so these seven pairs previously collapsed to one URL each.
update public.articles set slug='bachelor-of-medicine-and-bachelor-of-surgery-mbchb-2', updated_at=now()
where slug='bachelor-of-medicine-and-bachelor-of-surgery-mbchb-a9bdfa';

update public.articles set slug='cellular-i-mmunology-2', updated_at=now()
where slug='cellular-i-mmunology-ae60f0';

update public.articles set slug='heart-disease-must-knows-2', updated_at=now()
where slug='heart-disease-must-knows-9a4e4d';

update public.articles set slug='mbchb-cat-genetics-answer-key-2', updated_at=now()
where slug='mbchb-cat-genetics-answer-key-102307';

update public.articles set slug='medical-bacteriology-and-entomology-2', updated_at=now()
where slug='medical-bacteriology-and-entomology-b18948';

update public.articles set slug='medical-microbiology-qampa-guide-2', updated_at=now()
where slug='medical-microbiology-qampa-guide-503d38';

update public.articles set slug='pathology-continuous-assessment-july-2021-2', updated_at=now()
where slug='pathology-continuous-assessment-july-2021-6a7bed';
