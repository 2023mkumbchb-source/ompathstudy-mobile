create or replace function private.notify_contest_registration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare campaign_id uuid; actor_id uuid; contest_row record; notice_title text; notice_message text;
begin
  select user_id into actor_id from public.user_roles where role='admin' order by id limit 1;
  select title,slug into contest_row from public.contests where id=new.contest_id;
  if actor_id is null or contest_row is null then return new; end if;
  if tg_op='INSERT' then
    notice_title := 'Contest registration received'; notice_message := 'Your registration for ' || contest_row.title || ' was received and is awaiting verification.';
  elsif old.status is distinct from new.status and new.status='verified' then
    notice_title := 'Contest entry verified'; notice_message := 'Your entry for ' || contest_row.title || ' is verified. Open the lobby to review the schedule.';
  else return new;
  end if;
  insert into public.notification_campaigns(title,message,action_url,audience,status,recipient_count,created_by,sent_at)
  values(notice_title,notice_message,'https://www.ompathstudy.com/contests/' || contest_row.slug || '/lobby','contest','partial',1,actor_id,now()) returning id into campaign_id;
  insert into public.user_notifications(campaign_id,user_id,title,message,action_url,email_status)
  values(campaign_id,new.user_id,notice_title,notice_message,'https://www.ompathstudy.com/contests/' || contest_row.slug || '/lobby','skipped');
  return new;
end;
$$;

drop trigger if exists contest_registration_notification on public.contest_registrations;
create trigger contest_registration_notification after insert or update of status on public.contest_registrations
for each row execute function private.notify_contest_registration();

revoke all on function private.notify_contest_registration() from public, anon, authenticated;
