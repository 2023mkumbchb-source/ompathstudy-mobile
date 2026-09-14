-- Secure, typed notification delivery for the dedicated mobile application.
alter table public.notification_campaigns
  add column if not exists type text not null default 'general',
  add column if not exists priority text not null default 'normal',
  add column if not exists expires_at timestamptz;

alter table public.user_notifications
  add column if not exists type text not null default 'general',
  add column if not exists priority text not null default 'normal',
  add column if not exists study_year integer,
  add column if not exists expires_at timestamptz;

alter table public.notification_campaigns
  drop constraint if exists notification_campaigns_type_check,
  add constraint notification_campaigns_type_check
    check (type in ('exam', 'update', 'note', 'general')),
  drop constraint if exists notification_campaigns_priority_check,
  add constraint notification_campaigns_priority_check
    check (priority in ('normal', 'urgent'));

alter table public.user_notifications
  drop constraint if exists user_notifications_type_check,
  add constraint user_notifications_type_check
    check (type in ('exam', 'update', 'note', 'general')),
  drop constraint if exists user_notifications_priority_check,
  add constraint user_notifications_priority_check
    check (priority in ('normal', 'urgent')),
  drop constraint if exists user_notifications_study_year_check,
  add constraint user_notifications_study_year_check
    check (study_year is null or study_year between 1 and 6);

-- Existing RLS policies already limit campaigns to administrators and each
-- user's notification rows to that user. Realtime delivers only rows visible
-- through those policies.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end $$;
