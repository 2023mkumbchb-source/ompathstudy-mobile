drop policy if exists "Administrators manage contest universities" on public.contest_universities;
drop policy if exists "Administrators manage contests" on public.contests;
drop policy if exists "Administrators manage contest registrations" on public.contest_registrations;
drop policy if exists "Participants can register for an open contest" on public.contest_registrations;
drop policy if exists "Participants can withdraw own pending registration" on public.contest_registrations;

create policy "Administrators create contest universities" on public.contest_universities for insert to authenticated
with check (public.has_role((select auth.uid()), 'admin'));
create policy "Administrators update contest universities" on public.contest_universities for update to authenticated
using (public.has_role((select auth.uid()), 'admin')) with check (public.has_role((select auth.uid()), 'admin'));
create policy "Administrators delete contest universities" on public.contest_universities for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'));

create policy "Administrators create contests" on public.contests for insert to authenticated
with check (public.has_role((select auth.uid()), 'admin'));
create policy "Administrators update contests" on public.contests for update to authenticated
using (public.has_role((select auth.uid()), 'admin')) with check (public.has_role((select auth.uid()), 'admin'));
create policy "Administrators delete contests" on public.contests for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'));

create policy "Participants register when open" on public.contest_registrations for insert to authenticated
with check (
  public.has_role((select auth.uid()), 'admin') or (
    (select auth.uid()) = user_id and status = 'pending' and exists (
      select 1 from public.contests c where c.id = contest_id and c.published = true and c.status = 'registration'
        and (c.registration_opens_at is null or c.registration_opens_at <= now())
        and (c.registration_closes_at is null or c.registration_closes_at > now())
    )
  )
);
create policy "Participants withdraw or admins update" on public.contest_registrations for update to authenticated
using (public.has_role((select auth.uid()), 'admin') or ((select auth.uid()) = user_id and status = 'pending'))
with check (public.has_role((select auth.uid()), 'admin') or ((select auth.uid()) = user_id and status in ('pending','withdrawn')));
create policy "Administrators delete contest registrations" on public.contest_registrations for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'));
