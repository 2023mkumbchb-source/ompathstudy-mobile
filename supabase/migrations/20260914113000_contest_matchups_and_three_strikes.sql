alter table public.contest_rounds
  add column if not exists university_a_id uuid references public.contest_universities(id) on delete set null,
  add column if not exists university_b_id uuid references public.contest_universities(id) on delete set null;

alter table public.contest_rounds
  drop constraint if exists contest_rounds_distinct_universities;
alter table public.contest_rounds
  add constraint contest_rounds_distinct_universities
  check (university_a_id is null or university_b_id is null or university_a_id <> university_b_id);

update public.contest_rounds
set tab_switch_limit = 3,
    focus_loss_limit = 3,
    auto_eliminate = true,
    updated_at = now()
where tab_switch_limit <> 3 or focus_loss_limit <> 3 or auto_eliminate is not true;

create index if not exists contest_rounds_university_a_idx on public.contest_rounds (university_a_id);
create index if not exists contest_rounds_university_b_idx on public.contest_rounds (university_b_id);
