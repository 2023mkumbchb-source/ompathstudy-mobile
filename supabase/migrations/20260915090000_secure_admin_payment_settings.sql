-- Payment settings must be readable by clients but writable only by admins.
revoke insert, update, delete on table public.app_settings from anon;

drop policy if exists "Allow all operations on app_settings" on public.app_settings;
drop policy if exists "Public can read safe settings only" on public.app_settings;
drop policy if exists "Admins can manage app settings" on public.app_settings;

create policy "Public can read safe settings only"
on public.app_settings for select to anon, authenticated
using (key = any (array[
  'site_url','access_price_kes','paywall_free_ratio','pdf_download_enabled','access_plans',
  'exam_price','exam_award','mcq_free_limit','mcq_price','founder_page_visible',
  'guest_slide_view','redacted_names','show_content_counts','mobile_about_profile',
  'app_latest_version','app_download_url','app_live_bundle','app_update_notes'
]));

create policy "Admins can manage app settings"
on public.app_settings for all to authenticated
using ((select public.has_role((select auth.uid()), 'admin')))
with check ((select public.has_role((select auth.uid()), 'admin')));

create or replace function public.admin_save_payment_settings(settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed constant text[] := array[
    'access_price_kes','paywall_free_ratio','pdf_download_enabled','access_plans',
    'exam_price','mcq_free_limit','mcq_price'
  ];
  item record;
  result jsonb;
begin
  if (select auth.uid()) is null or not public.has_role((select auth.uid()), 'admin') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(settings) <> 'object' then
    raise exception 'Settings must be a JSON object';
  end if;

  for item in select key, value from jsonb_each_text(settings)
  loop
    if not (item.key = any (allowed)) then
      raise exception 'Unsupported payment setting: %', item.key;
    end if;
    if item.key in ('access_price_kes','exam_price','mcq_price')
       and (item.value !~ '^\d+(\.\d{1,2})?$' or item.value::numeric < 0) then
      raise exception '% must be a non-negative amount', item.key;
    end if;
    if item.key = 'mcq_free_limit'
       and (item.value !~ '^\d+$' or item.value::integer < 0) then
      raise exception 'mcq_free_limit must be a non-negative whole number';
    end if;
    if item.key = 'paywall_free_ratio'
       and (item.value !~ '^0?\.\d+$' or item.value::numeric < 0.05 or item.value::numeric > 0.90) then
      raise exception 'paywall_free_ratio must be between 0.05 and 0.90';
    end if;
    if item.key = 'pdf_download_enabled' and item.value not in ('true','false') then
      raise exception 'pdf_download_enabled must be true or false';
    end if;
    if item.key = 'access_plans' and jsonb_typeof(item.value::jsonb) <> 'array' then
      raise exception 'access_plans must be an array';
    end if;

    insert into public.app_settings(key,value)
    values (item.key,item.value)
    on conflict (key) do update set value=excluded.value;
  end loop;

  select jsonb_object_agg(key,value) into result
  from public.app_settings where key = any (allowed);
  return coalesce(result,'{}'::jsonb);
end;
$$;

revoke all on function public.admin_save_payment_settings(jsonb) from public;
grant execute on function public.admin_save_payment_settings(jsonb) to authenticated;
