-- Run once after setup.sql (also works after guest-ordering.sql).
-- Adds atomic admin order editing/deletion and staff status updates.
begin;
create or replace function public.save_staff_order(
  p_id uuid, p_table_id integer, p_notes text, p_items jsonb,
  p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_line public.order_items%rowtype;
  v_product public.products%rowtype;
  v_quantity integer;
  v_ids integer[] := '{}';
  v_line_id integer;
begin
  if not public.is_staff(true) then raise exception 'Admin access required'; end if;
  if p_id is null then raise exception 'Order ID required'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Items must be an array'; end if;
  if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Choose 1–50 items'; end if;
  if length(coalesce(p_notes, '')) > 1000 then raise exception 'Notes must be at most 1000 characters'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into v_order from public.orders where id = p_id for update;
  if found then
    if p_expected_updated_at is null then return p_id; end if;
    if v_order."updatedAt" <> p_expected_updated_at then raise exception 'Order changed. Refresh and try again.'; end if;
    if v_order.status in ('served', 'cancelled') then raise exception 'Completed orders cannot be edited'; end if;
  else
    if p_expected_updated_at is not null then raise exception 'Order no longer exists'; end if;
  end if;
  perform 1 from public.restaurant_tables where id = p_table_id
    and (is_active or id = v_order.table_id) for share;
  if not found then raise exception 'Select an active table'; end if;
  if v_order.id is null then
    insert into public.orders(id, table_id, request_id, notes)
      values (p_id, p_table_id, p_id, coalesce(p_notes, ''));
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'quantity', '') !~ '^[1-9][0-9]?$' then raise exception 'Quantity must be 1–99'; end if;
    v_quantity := (v_item->>'quantity')::integer;
    if v_item->>'item_id' is not null then
      select * into v_line from public.order_items
        where id = (v_item->>'item_id')::integer and order_id = p_id;
      if not found then raise exception 'Order item no longer exists'; end if;
      if v_line.id = any(v_ids) then raise exception 'Duplicate order item'; end if;
      -- Existing lines retain their original name and price, even after menu changes.
      update public.order_items set quantity = v_quantity where id = v_line.id;
      v_line_id := v_line.id;
    else
      select p.* into v_product from public.products p
        join public.categories c on c.id = p."categoryId"
        join public.menus m on m.id = c."menuId"
        where p.id = (v_item->>'product_id')::integer and p."isAvailable" and m."isActive"
        for share of p, c, m;
      if not found then raise exception 'Product is no longer available on the active menu'; end if;
      insert into public.order_items(order_id, product_id, product_name, unit_price, quantity)
        values (p_id, v_product.id, v_product.name, v_product.price, v_quantity)
        returning id into v_line_id;
    end if;
    v_ids := array_append(v_ids, v_line_id);
  end loop;
  delete from public.order_items where order_id = p_id and not (id = any(v_ids));
  update public.orders set table_id = p_table_id, notes = coalesce(p_notes, ''),
    total = (select sum(line_total) from public.order_items where order_id = p_id)
    where id = p_id;
  return p_id;
end;
$$;

create or replace function public.set_order_status(p_id uuid, p_status text, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  if p_status not in ('pending','accepted','preparing','ready','served','cancelled') or p_status is null then
    raise exception 'Invalid status';
  end if;
  update public.orders set status = p_status where id = p_id and "updatedAt" = p_expected_updated_at;
  if not found then raise exception 'Order changed or was deleted. Refresh and try again.'; end if;
end;
$$;

create or replace function public.delete_staff_order(p_id uuid, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff(true) then raise exception 'Admin access required'; end if;
  delete from public.orders where id = p_id and "updatedAt" = p_expected_updated_at;
  if not found then raise exception 'Order changed or was deleted. Refresh and try again.'; end if;
end;
$$;
revoke all on function public.save_staff_order(uuid, integer, text, jsonb, timestamptz) from public, anon;
revoke all on function public.set_order_status(uuid, text, timestamptz) from public, anon;
revoke all on function public.delete_staff_order(uuid, timestamptz) from public, anon;
grant execute on function public.save_staff_order(uuid, integer, text, jsonb, timestamptz) to authenticated;
grant execute on function public.set_order_status(uuid, text, timestamptz) to authenticated;
grant execute on function public.delete_staff_order(uuid, timestamptz) to authenticated;
-- Require status changes to go through the function's concurrent-edit check.
revoke update (status) on public.orders from authenticated;
commit;
