create table if not exists public.contest_universities (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  abbreviation text, active boolean not null default true, verified boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
  subtitle text not null default '', status text not null default 'concept' check (status in ('concept','registration','live','completed','cancelled')),
  subjects text[] not null default '{}', eligible_years integer[] not null default '{}', competition_format text not null default '',
  registration_opens_at timestamptz, registration_closes_at timestamptz, starts_at timestamptz,
  published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (eligible_years <@ array[1,2,3,4,5,6])
);
create table if not exists public.contest_registrations (
  id uuid primary key default gen_random_uuid(), contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, university_id uuid not null references public.contest_universities(id),
  study_year integer not null check (study_year between 1 and 6), representation text not null default 'individual' check (representation in ('individual','university_team')),
  status text not null default 'pending' check (status in ('pending','verified','rejected','withdrawn')), accepted_rules_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (contest_id, user_id)
);
create index if not exists contests_public_status_start_idx on public.contests (published, status, starts_at);
create index if not exists contest_registrations_user_idx on public.contest_registrations (user_id, contest_id);
create index if not exists contest_registrations_university_idx on public.contest_registrations (university_id, contest_id);
alter table public.contest_universities enable row level security;
alter table public.contests enable row level security;
alter table public.contest_registrations enable row level security;
revoke all on public.contest_universities from anon, authenticated;
revoke all on public.contests from anon, authenticated;
revoke all on public.contest_registrations from anon, authenticated;
grant select on public.contest_universities to anon, authenticated;
grant select on public.contests to anon, authenticated;
grant select, insert, update on public.contest_registrations to authenticated;
create policy "Active contest universities are public" on public.contest_universities for select to anon, authenticated using (active = true or public.has_role((select auth.uid()), 'admin'));
create policy "Published contests are public" on public.contests for select to anon, authenticated using (published = true or public.has_role((select auth.uid()), 'admin'));
create policy "Participants can view own contest registrations" on public.contest_registrations for select to authenticated using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'));
create policy "Participants can register for an open contest" on public.contest_registrations for insert to authenticated with check (
  (select auth.uid()) = user_id and status = 'pending' and exists (
    select 1 from public.contests c where c.id = contest_id and c.published = true and c.status = 'registration'
      and (c.registration_opens_at is null or c.registration_opens_at <= now()) and (c.registration_closes_at is null or c.registration_closes_at > now())
  )
);
create policy "Participants can withdraw own pending registration" on public.contest_registrations for update to authenticated
using ((select auth.uid()) = user_id and status = 'pending') with check ((select auth.uid()) = user_id and status in ('pending','withdrawn'));
create policy "Administrators manage contest universities" on public.contest_universities for all to authenticated using (public.has_role((select auth.uid()), 'admin')) with check (public.has_role((select auth.uid()), 'admin'));
create policy "Administrators manage contests" on public.contests for all to authenticated using (public.has_role((select auth.uid()), 'admin')) with check (public.has_role((select auth.uid()), 'admin'));
create policy "Administrators manage contest registrations" on public.contest_registrations for all to authenticated using (public.has_role((select auth.uid()), 'admin')) with check (public.has_role((select auth.uid()), 'admin'));
insert into public.contest_universities (name, slug, abbreviation) values
 ('Mount Kenya University','mount-kenya-university','MKU'), ('University of Nairobi','university-of-nairobi','UoN'),
 ('Kenyatta University','kenyatta-university','KU'), ('Jomo Kenyatta University of Agriculture and Technology','jkuat','JKUAT'),
 ('Moi University','moi-university','MU'), ('Kenya Methodist University','kenya-methodist-university','KeMU'),
 ('Maseno University','maseno-university','MSU'), ('Egerton University','egerton-university','EU')
on conflict (slug) do update set name=excluded.name, abbreviation=excluded.abbreviation, updated_at=now();
insert into public.contests (slug,title,subtitle,status,subjects,eligible_years,competition_format,published)
values ('inter-university-medical-challenge','Inter-University Medical Challenge','A national knowledge arena for Kenya''s next generation of clinicians.','concept',array['Anatomy','Physiology','Pathology','Microbiology'],array[1,2,3],'Qualifiers → Semifinal → Grand final',true)
on conflict (slug) do update set title=excluded.title, subtitle=excluded.subtitle, subjects=excluded.subjects, eligible_years=excluded.eligible_years, competition_format=excluded.competition_format, updated_at=now();
