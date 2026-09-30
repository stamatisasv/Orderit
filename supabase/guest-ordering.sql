-- Apply to an existing OrderIt database. Does not delete existing orders or users.
begin;
drop policy if exists order_read on public.orders;
create policy order_read on public.orders for select to authenticated
  using (public.is_staff());

create or replace function public.place_order(p_table_token uuid, p_items jsonb,
  p_request_id uuid, p_notes text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_table integer;
  v_order uuid;
  v_item jsonb;
  v_product record;
  v_quantity integer;
begin
  if p_request_id is null then raise exception 'Request ID required'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items must be an array';
  end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Provide between 1 and 50 items';
  end if;
  if length(coalesce(p_notes, '')) > 1000 then raise exception 'Notes too long'; end if;
  select id into v_table from public.restaurant_tables
    where qr_token = p_table_token and is_active for share;
  if not found then raise exception 'Invalid or inactive table'; end if;
  -- Serialize retries for the same table and checkout request.
  perform pg_advisory_xact_lock(hashtextextended(v_table::text || ':' || p_request_id::text, 0));
  select id into v_order from public.orders
    where table_id = v_table and customer_id is null and request_id = p_request_id;
  if found then return v_order; end if;

  insert into public.orders(table_id, customer_id, request_id, notes)
    values (v_table, null, p_request_id, coalesce(p_notes, '')) returning id into v_order;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'quantity', '') !~ '^[1-9][0-9]?$'
      or coalesce(v_item->>'product_id', '') !~ '^[1-9][0-9]*$' then
      raise exception 'Invalid product ID or quantity (1–99)';
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    select p.id, p.name, p.price into v_product
      from public.products p join public.categories c on c.id = p."categoryId"
      join public.menus m on m.id = c."menuId"
      where p.id = (v_item->>'product_id')::integer and p."isAvailable" and m."isActive"
      for share of p, c, m;
    if not found then raise exception 'Product is unavailable'; end if;
    insert into public.order_items(order_id, product_id, product_name, unit_price, quantity)
      values (v_order, v_product.id, v_product.name, v_product.price, v_quantity);
  end loop;
  update public.orders set total = (
    select sum(line_total) from public.order_items where order_id = v_order
  ) where id = v_order;
  return v_order;
end;
$$;
revoke all on function public.place_order(uuid, jsonb, uuid, text) from public, anon;
grant execute on function public.place_order(uuid, jsonb, uuid, text) to anon, authenticated;

commit;
