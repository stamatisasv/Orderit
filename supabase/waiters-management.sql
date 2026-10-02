-- Run after setup.sql. Admin-only waiter membership management.
-- Does not create Auth users or expose service credentials to the browser.
begin;

create or replace function public.list_waiters()
returns table (user_id uuid, name text, email text, email_confirmed_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff(true) then raise exception 'Admin access required'; end if;
  return query select s.user_id, s.name, u.email::text, u.email_confirmed_at
    from public.staff s join auth.users u on u.id = s.user_id
    where s.role = 'waiter' order by lower(s.name), s.user_id;
end;
$$;

create or replace function public.add_waiter_by_email(p_email text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not public.is_staff(true) then raise exception 'Admin access required'; end if;
  if p_name is null or length(trim(p_name)) not between 2 and 100 then raise exception 'Name must be 2–100 characters'; end if;
  if p_email is null or length(trim(p_email)) > 254 then raise exception 'Enter a valid email address'; end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user is null then raise exception 'No sign-in account exists for this email. Use Create new account instead.'; end if;
  insert into public.staff as s (user_id, name, role) values (v_user, trim(p_name), 'waiter')
    on conflict (user_id) do nothing;
  if not found then raise exception 'This account already has staff access. Edit the existing waiter instead.'; end if;
  return v_user;
end;
$$;

create or replace function public.rename_waiter(p_user_id uuid, p_name text, p_expected_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff(true) then raise exception 'Admin access required'; end if;
  if p_name is null or length(trim(p_name)) not between 2 and 100 then raise exception 'Name must be 2–100 characters'; end if;
  update public.staff set name = trim(p_name)
    where user_id = p_user_id and role = 'waiter' and name = p_expected_name;
  if not found then raise exception 'Waiter changed or no longer exists. Refresh and try again.'; end if;
end;
$$;

create or replace function public.remove_waiter(p_user_id uuid, p_expected_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff(true) then raise exception 'Admin access required'; end if;
  delete from public.staff where user_id = p_user_id and role = 'waiter' and name = p_expected_name;
  if not found then raise exception 'Waiter changed or no longer exists. Refresh and try again.'; end if;
end;
$$;

revoke all on function public.list_waiters(), public.add_waiter_by_email(text,text),
  public.rename_waiter(uuid,text,text), public.remove_waiter(uuid,text) from public, anon;
grant execute on function public.list_waiters(), public.add_waiter_by_email(text,text),
  public.rename_waiter(uuid,text,text), public.remove_waiter(uuid,text) to authenticated;
commit;
