alter table public.contest_rounds
  add column if not exists source_mcq_set_id uuid references public.mcq_sets(id) on delete set null,
  add column if not exists source_exam_title text;

comment on column public.contest_rounds.source_mcq_set_id is
  'Published MCQ paper selected by an administrator as the source for this round.';

comment on column public.contest_rounds.source_exam_title is
  'Snapshot of the selected exam title retained for contest administration and audit.';

create index if not exists contest_rounds_source_mcq_set_id_idx
  on public.contest_rounds(source_mcq_set_id)
  where source_mcq_set_id is not null;
