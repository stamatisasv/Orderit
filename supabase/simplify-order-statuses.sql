-- Run after staff-management.sql and shared-table-ordering.sql.
begin;
-- Preserve active orders while removing the two intermediate states.
update public.orders set status = 'accepted' where status in ('preparing', 'ready');
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'accepted', 'served', 'cancelled'));
create or replace function public.set_order_status(p_id uuid, p_status text, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  if p_status is null or p_status not in ('pending','accepted','served','cancelled') then raise exception 'Invalid status'; end if;
  select status into v_status from public.orders where id = p_id and "updatedAt" = p_expected_updated_at for update;
  if not found then raise exception 'Order changed or was deleted. Refresh and try again.'; end if;
  if v_status = 'pending' and p_status not in ('pending','accepted','cancelled') then raise exception 'Accept or decline this order first'; end if;
  if v_status in ('served','cancelled') and p_status <> v_status and p_status <> 'pending' then raise exception 'Reopen as pending before accepting again'; end if;
  update public.orders set status = p_status where id = p_id;
end;
$$;
revoke all on function public.set_order_status(uuid,text,timestamptz) from public, anon;
grant execute on function public.set_order_status(uuid,text,timestamptz) to authenticated;
commit;
