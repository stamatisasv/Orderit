-- Run AFTER setup.sql, guest-ordering.sql and staff-management.sql.
-- Guests can select any active table. A table's current basket/orders are shared
-- with everyone selecting it. Staff start a new visit to clear previous guests.
begin;
alter table public.restaurant_tables add column if not exists visit_id uuid not null default gen_random_uuid();
alter table public.restaurant_tables add column if not exists basket_version integer not null default 0;
alter table public.orders add column if not exists visit_id uuid;
create table if not exists public.table_basket (
  table_id integer not null references public.restaurant_tables(id) on delete cascade,
  product_id integer not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  primary key(table_id, product_id)
);
create table if not exists public.basket_operations (
  table_id integer not null references public.restaurant_tables(id) on delete cascade,
  visit_id uuid not null, operation_id uuid not null,
  primary key(table_id, visit_id, operation_id)
);
create table if not exists public.table_requests (
  id uuid primary key default gen_random_uuid(),
  table_id integer not null references public.restaurant_tables(id) on delete cascade,
  visit_id uuid not null,
  kind text not null check (kind in ('waiter','bill')),
  status text not null default 'pending' check (status in ('pending','acknowledged','done')),
  created_at timestamptz not null default now()
);
create unique index if not exists one_open_table_request on public.table_requests(table_id, visit_id, kind) where status <> 'done';
create index if not exists orders_visit_idx on public.orders(table_id, visit_id);
alter table public.table_basket enable row level security;
alter table public.basket_operations enable row level security;
alter table public.table_requests enable row level security;
revoke all on public.table_basket, public.basket_operations, public.table_requests from anon, authenticated;
grant select on public.table_requests to authenticated;
drop policy if exists staff_requests on public.table_requests;
create policy staff_requests on public.table_requests for select to authenticated using (public.is_staff());

create or replace function public.guest_tables()
returns table(id integer, name text, qr_token uuid) language sql stable security definer set search_path = '' as $$
 select id, name, qr_token from public.restaurant_tables where is_active order by id;
$$;

create or replace function public.guest_table_state(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.restaurant_tables%rowtype;
begin
 select * into t from public.restaurant_tables where qr_token = p_token and is_active for share;
 if not found then raise exception 'Table is inactive or link has expired'; end if;
 return jsonb_build_object('id', t.id, 'name', t.name, 'visit_id', t.visit_id, 'version', t.basket_version,
 'basket', coalesce((select jsonb_agg(jsonb_build_object('product_id', p.id, 'name', p.name, 'price', p.price,
   'quantity', b.quantity, 'available', p."isAvailable" and m."isActive") order by p.id)
   from public.table_basket b join public.products p on p.id = b.product_id
   join public.categories c on c.id = p."categoryId" join public.menus m on m.id = c."menuId"
   where b.table_id = t.id), '[]'::jsonb),
 'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'status', o.status, 'total', o.total,
   'notes', o.notes, 'createdAt', o."createdAt", 'items', coalesce((select jsonb_agg(jsonb_build_object(
    'name', i.product_name, 'quantity', i.quantity, 'total', i.line_total) order by i.id)
    from public.order_items i where i.order_id = o.id), '[]'::jsonb)) order by o."createdAt" desc)
   from public.orders o where o.table_id = t.id and o.visit_id = t.visit_id), '[]'::jsonb),
 'requests', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'status', r.status))
   from public.table_requests r where r.table_id = t.id and r.visit_id = t.visit_id and r.status <> 'done'), '[]'::jsonb));
end;
$$;

create or replace function public.change_table_basket(p_token uuid, p_visit uuid, p_product integer, p_delta integer, p_operation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.restaurant_tables%rowtype; q integer;
begin
 if p_delta is null or p_delta not in (-1,1) or p_operation is null then raise exception 'Invalid basket change'; end if;
 select * into t from public.restaurant_tables where qr_token = p_token and is_active for update;
 if not found then raise exception 'Table is inactive or link has expired'; end if;
 if p_visit is distinct from t.visit_id then raise exception 'A new table visit has started. Refresh before ordering.'; end if;
 if exists(select 1 from public.basket_operations where table_id = t.id and visit_id = p_visit and operation_id = p_operation) then return; end if;
 if p_delta > 0 then
   perform 1 from public.products p join public.categories c on c.id = p."categoryId" join public.menus m on m.id = c."menuId"
     where p.id = p_product and p."isAvailable" and m."isActive" for share of p,c,m;
   if not found then raise exception 'Product is unavailable'; end if;
 end if;
 select quantity into q from public.table_basket where table_id = t.id and product_id = p_product;
 q := greatest(0, coalesce(q, 0) + p_delta);
 if q > 99 then raise exception 'Maximum quantity is 99'; end if;
 if q = 0 then delete from public.table_basket where table_id = t.id and product_id = p_product;
 else
   if not exists(select 1 from public.table_basket where table_id = t.id and product_id = p_product)
     and (select count(*) from public.table_basket where table_id = t.id) >= 50 then raise exception 'Maximum 50 different items'; end if;
   insert into public.table_basket values(t.id, p_product, q)
     on conflict(table_id, product_id) do update set quantity = excluded.quantity;
 end if;
 insert into public.basket_operations values(t.id, p_visit, p_operation);
 update public.restaurant_tables set basket_version = basket_version + 1 where id = t.id;
end;
$$;

create or replace function public.checkout_table_basket(p_token uuid, p_visit uuid, p_version integer, p_request uuid, p_notes text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.restaurant_tables%rowtype; v_id uuid; b record; p public.products%rowtype;
begin
 if p_request is null then raise exception 'Request ID required'; end if;
 if length(coalesce(p_notes,'')) > 1000 then raise exception 'Notes too long'; end if;
 select * into t from public.restaurant_tables where qr_token = p_token and is_active for update;
 if not found then raise exception 'Table is inactive or link has expired'; end if;
 if p_visit is distinct from t.visit_id then raise exception 'A new visit has started'; end if;
 select id into v_id from public.orders where table_id = t.id and visit_id = p_visit and request_id = p_request;
 if found then return v_id; end if;
 if p_version is distinct from t.basket_version then raise exception 'The shared basket changed. Review it and submit again.'; end if;
 if not exists(select 1 from public.table_basket where table_id = t.id) then raise exception 'Basket is empty'; end if;
 insert into public.orders(table_id, visit_id, request_id, notes, status)
 values(t.id, p_visit, p_request, coalesce(p_notes,''), 'pending') returning id into v_id;
 for b in select * from public.table_basket where table_id = t.id order by product_id loop
   select pr.* into p from public.products pr join public.categories c on c.id = pr."categoryId"
     join public.menus m on m.id = c."menuId" where pr.id = b.product_id and pr."isAvailable" and m."isActive" for share of pr,c,m;
   if not found then raise exception 'An item is unavailable. Remove it before submitting.'; end if;
   insert into public.order_items(order_id, product_id, product_name, unit_price, quantity)
     values(v_id, p.id, p.name, p.price, b.quantity);
 end loop;
 update public.orders set total = (select sum(line_total) from public.order_items where order_id = v_id) where id = v_id;
 delete from public.table_basket where table_id = t.id;
 update public.restaurant_tables set basket_version = basket_version + 1 where id = t.id;
 return v_id;
end;
$$;

create or replace function public.request_table_help(p_token uuid, p_visit uuid, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.restaurant_tables%rowtype;
begin
 if p_kind is null or p_kind not in ('waiter','bill') then raise exception 'Invalid request'; end if;
 select * into t from public.restaurant_tables where qr_token = p_token and is_active for update;
 if not found then raise exception 'Table is inactive or link has expired'; end if;
 if p_visit is distinct from t.visit_id then raise exception 'A new visit has started'; end if;
 insert into public.table_requests(table_id, visit_id, kind) values(t.id, p_visit, p_kind) on conflict do nothing;
end;
$$;

create or replace function public.handle_table_request(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 if p_status is null or p_status not in ('acknowledged','done') then raise exception 'Invalid request status'; end if;
 update public.table_requests set status = p_status where id = p_id and status <> 'done';
 if not found then raise exception 'Request has already been handled'; end if;
end;
$$;

create or replace function public.start_table_visit(p_table integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 perform 1 from public.restaurant_tables where id = p_table for update;
 if not found then raise exception 'Table not found'; end if;
 if exists(select 1 from public.orders o join public.restaurant_tables t on t.id = o.table_id
   where t.id = p_table and o.visit_id = t.visit_id and o.status not in ('served','cancelled')) then
   raise exception 'Serve or cancel open orders before starting a new visit';
 end if;
 delete from public.table_basket where table_id = p_table;
 delete from public.basket_operations where table_id = p_table;
 update public.table_requests set status = 'done' where table_id = p_table and status <> 'done';
 update public.restaurant_tables set visit_id = gen_random_uuid(), basket_version = 0 where id = p_table;
end;
$$;

-- Staff-created orders also belong to the table's current visit.
create or replace function public.assign_order_visit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op = 'INSERT' or new.table_id <> old.table_id then
   select visit_id into new.visit_id from public.restaurant_tables where id = new.table_id for share;
 end if;
 return new;
end;
$$;
drop trigger if exists assign_order_visit on public.orders;
create trigger assign_order_visit before insert or update of table_id on public.orders for each row execute function public.assign_order_visit();
revoke all on function public.assign_order_visit() from public, anon, authenticated;

-- Require explicit acceptance before an order can reach the kitchen.
create or replace function public.set_order_status(p_id uuid, p_status text, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 if p_status is null or p_status not in ('pending','accepted','preparing','ready','served','cancelled') then raise exception 'Invalid status'; end if;
 select status into v_status from public.orders where id = p_id and "updatedAt" = p_expected_updated_at for update;
 if not found then raise exception 'Order changed or was deleted. Refresh and try again.'; end if;
 if v_status = 'pending' and p_status not in ('accepted','cancelled') then raise exception 'Accept or decline this order first'; end if;
 if v_status in ('served','cancelled') and p_status <> 'pending' then raise exception 'Reopen as pending before accepting again'; end if;
 update public.orders set status = p_status where id = p_id;
end;
$$;

revoke all on function public.guest_tables() from public;
revoke all on function public.guest_table_state(uuid) from public;
revoke all on function public.change_table_basket(uuid,uuid,integer,integer,uuid) from public;
revoke all on function public.checkout_table_basket(uuid,uuid,integer,uuid,text) from public;
revoke all on function public.request_table_help(uuid,uuid,text) from public;
grant execute on function public.guest_tables(), public.guest_table_state(uuid),
 public.change_table_basket(uuid,uuid,integer,integer,uuid), public.checkout_table_basket(uuid,uuid,integer,uuid,text),
 public.request_table_help(uuid,uuid,text) to anon, authenticated;
revoke all on function public.handle_table_request(uuid,text), public.start_table_visit(integer) from public, anon;
grant execute on function public.handle_table_request(uuid,text), public.start_table_visit(integer) to authenticated;
-- Guest checkout now goes through the shared basket.
revoke execute on function public.place_order(uuid,jsonb,uuid,text) from anon;
commit;
