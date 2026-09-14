alter table public.contest_rounds
  add column if not exists auto_open boolean not null default true,
  add column if not exists auto_close boolean not null default true,
  add column if not exists entry_grace_minutes integer not null default 10 check (entry_grace_minutes between 0 and 60),
  add column if not exists results_visible boolean not null default false;

alter table public.notification_campaigns drop constraint if exists notification_campaigns_audience_check;
alter table public.notification_campaigns add constraint notification_campaigns_audience_check
check (audience in ('all_users','subscribers','study_year','contest'));

create table if not exists private.contest_reminder_log (
  contest_id uuid not null references public.contests(id) on delete cascade,
  event_key text not null,
  created_at timestamptz not null default now(),
  primary key (contest_id, event_key)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contest-posters', 'contest-posters', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads contest posters" on storage.objects;
create policy "Public reads contest posters" on storage.objects for select to public
using (bucket_id = 'contest-posters');
drop policy if exists "Admins upload contest posters" on storage.objects;
create policy "Admins upload contest posters" on storage.objects for insert to authenticated
with check (bucket_id = 'contest-posters' and public.has_role((select auth.uid()), 'admin'));
drop policy if exists "Admins update contest posters" on storage.objects;
create policy "Admins update contest posters" on storage.objects for update to authenticated
using (bucket_id = 'contest-posters' and public.has_role((select auth.uid()), 'admin'))
with check (bucket_id = 'contest-posters' and public.has_role((select auth.uid()), 'admin'));
drop policy if exists "Admins delete contest posters" on storage.objects;
create policy "Admins delete contest posters" on storage.objects for delete to authenticated
using (bucket_id = 'contest-posters' and public.has_role((select auth.uid()), 'admin'));

create or replace function private.sync_contest_schedule()
returns void language plpgsql security invoker set search_path = '' as $$
declare expired_attempt record;
begin
  update public.contest_rounds
  set status = 'live', locked_at = coalesce(locked_at, now()), updated_at = now()
  where auto_open and status in ('scheduled','lobby') and question_count > 0
    and starts_at is not null and starts_at <= now() and (ends_at is null or ends_at > now());

  update public.contest_rounds
  set status = 'closed', updated_at = now()
  where auto_close and status = 'live' and ends_at is not null and ends_at <= now();

  for expired_attempt in
    select a.id from public.contest_attempts a join public.contest_rounds r on r.id = a.round_id
    where a.status = 'active' and r.ends_at is not null and r.ends_at <= now()
  loop
    perform public.score_contest_attempt(expired_attempt.id);
  end loop;

  update public.contests c set status = 'live', updated_at = now()
  where status in ('concept','registration') and exists (select 1 from public.contest_rounds r where r.contest_id = c.id and r.status = 'live');

  update public.contests c set status = 'completed', updated_at = now()
  where status = 'live' and not exists (select 1 from public.contest_rounds r where r.contest_id = c.id and r.status in ('scheduled','lobby','live'));
end;
$$;

create or replace function private.queue_contest_reminders()
returns void language plpgsql security invoker set search_path = '' as $$
declare item record; campaign_id uuid; actor_id uuid;
begin
  select user_id into actor_id from public.user_roles where role = 'admin' order by id limit 1;
  if actor_id is null then return; end if;
  for item in
    select c.id, c.slug, c.title, r.starts_at,
      case when r.starts_at <= now() then 'live'
           when r.starts_at <= now() + interval '1 hour' then 'one-hour'
           else 'twenty-four-hour' end as event_key
    from public.contests c join public.contest_rounds r on r.contest_id = c.id
    where c.published and r.status in ('scheduled','lobby','live') and r.starts_at is not null
      and r.starts_at <= now() + interval '24 hours'
      and not exists (select 1 from private.contest_reminder_log l where l.contest_id = c.id and l.event_key = case when r.starts_at <= now() then 'live' when r.starts_at <= now() + interval '1 hour' then 'one-hour' else 'twenty-four-hour' end)
  loop
    insert into private.contest_reminder_log(contest_id,event_key) values(item.id,item.event_key) on conflict do nothing;
    insert into public.notification_campaigns(title,message,action_url,audience,status,recipient_count,created_by,sent_at)
    values(item.title || case item.event_key when 'live' then ' is now live' when 'one-hour' then ' starts in one hour' else ' starts tomorrow' end,
      case item.event_key when 'live' then 'The contest is open. Enter the secure lobby now.' when 'one-hour' then 'Prepare your device and connection. The contest starts in one hour.' else 'Your registered contest begins within 24 hours.' end,
      'https://www.ompathstudy.com/contests/' || item.slug || '/lobby','contest','partial',
      (select count(*) from public.contest_registrations where contest_id=item.id and status in ('pending','verified')),actor_id,now()) returning id into campaign_id;
    insert into public.user_notifications(campaign_id,user_id,title,message,action_url,email_status)
    select campaign_id,cr.user_id,item.title || case item.event_key when 'live' then ' is now live' when 'one-hour' then ' starts in one hour' else ' starts tomorrow' end,
      case item.event_key when 'live' then 'The contest is open. Enter the secure lobby now.' when 'one-hour' then 'Prepare your device and connection. The contest starts in one hour.' else 'Your registered contest begins within 24 hours.' end,
      'https://www.ompathstudy.com/contests/' || item.slug || '/lobby','skipped'
    from public.contest_registrations cr where cr.contest_id=item.id and cr.status in ('pending','verified') on conflict do nothing;
  end loop;
end;
$$;

revoke all on function private.sync_contest_schedule() from public, anon, authenticated;
grant execute on function private.sync_contest_schedule() to postgres, service_role;
revoke all on function private.queue_contest_reminders() from public, anon, authenticated;
grant execute on function private.queue_contest_reminders() to postgres, service_role;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'sync-contest-schedule';
  perform cron.schedule('sync-contest-schedule', '* * * * *', 'select private.sync_contest_schedule();');
  perform cron.unschedule(jobid) from cron.job where jobname = 'queue-contest-reminders';
  perform cron.schedule('queue-contest-reminders', '* * * * *', 'select private.queue_contest_reminders();');
end $$;

drop policy if exists "Verified participants start live attempts" on public.contest_attempts;
create policy "Verified participants start live attempts" on public.contest_attempts for insert to authenticated with check (
  public.has_role((select auth.uid()), 'admin') or (
    (select auth.uid()) = user_id and status = 'active' and exists (
      select 1 from public.contest_rounds r join public.contest_registrations cr on cr.contest_id = r.contest_id
      where r.id = round_id and cr.id = registration_id and cr.user_id = (select auth.uid()) and cr.status = 'verified'
        and r.status = 'live' and r.starts_at <= now() and now() <= r.starts_at + make_interval(mins => r.entry_grace_minutes)
        and (r.ends_at is null or r.ends_at > now())
    )
  )
);

create index if not exists contest_rounds_automatic_schedule_idx
on public.contest_rounds (status, starts_at, ends_at) where auto_open or auto_close;
