-- OrderIt: run ONCE in the SQL Editor of a fresh Supabase project.
-- One restaurant per project. Monetary values use the restaurant's single currency.
begin;

create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('admin', 'waiter'))
);

create function public.is_staff(admin_only boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff
    where user_id = (select auth.uid())
      and (not admin_only or role = 'admin')
  );
$$;
revoke all on function public.is_staff(boolean) from public, anon;
grant execute on function public.is_staff(boolean) to authenticated;

-- Quoted camelCase fields match the existing Angular interfaces.
create table public.menus (
  id integer generated always as identity primary key,
  name text not null check (length(trim(name)) >= 2),
  description text,
  "isActive" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create unique index one_active_menu on public.menus ("isActive") where "isActive";

create table public.categories (
  id integer generated always as identity primary key,
  "menuId" integer not null references public.menus(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  description text,
  "sortOrder" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index categories_menu_idx on public.categories ("menuId", "sortOrder");

create table public.products (
  id integer generated always as identity primary key,
  "categoryId" integer not null references public.categories(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  description text,
  price numeric(10,2) not null check (price >= 0 and price < 1000000),
  "imageUrl" text,
  "isAvailable" boolean not null default true,
  "sortOrder" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index products_category_idx on public.products ("categoryId", "sortOrder");

create table public.restaurant_tables (
  id integer generated always as identity primary key,
  name text not null unique,
  qr_token uuid not null unique default gen_random_uuid(),
  is_active boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  table_id integer not null references public.restaurant_tables(id),
  customer_id uuid references auth.users(id) on delete set null,
  request_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'preparing', 'ready', 'served', 'cancelled')),
  notes text not null default '' check (length(notes) <= 1000),
  total numeric(12,2) not null default 0 check (total >= 0),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (customer_id, request_id)
);
create index orders_table_idx on public.orders (table_id);
create index orders_status_idx on public.orders (status, "createdAt");

create table public.order_items (
  id integer generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id integer references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new."updatedAt" := now();
  return new;
end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['menus','categories','products','restaurant_tables','orders'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
  foreach t in array array['staff','menus','categories','products','restaurant_tables','orders','order_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

grant select on public.menus, public.categories, public.products to anon, authenticated;
grant insert, update, delete on public.menus, public.categories, public.products to authenticated;
grant select, insert, update, delete on public.restaurant_tables to authenticated;
grant select on public.staff, public.orders, public.order_items to authenticated;
grant update (status) on public.orders to authenticated;
grant usage on sequence public.menus_id_seq, public.categories_id_seq,
  public.products_id_seq, public.restaurant_tables_id_seq to authenticated;

create policy staff_read on public.staff for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff(true));
-- Staff membership can only be changed through SQL Editor / trusted backend.
create policy menu_public on public.menus for select to anon, authenticated using ("isActive");
create policy category_public on public.categories for select to anon, authenticated
  using (exists (select 1 from public.menus m where m.id = "menuId" and m."isActive"));
create policy product_public on public.products for select to anon, authenticated
  using (exists (select 1 from public.categories c join public.menus m on m.id = c."menuId"
    where c.id = "categoryId" and m."isActive"));

create policy menu_admin on public.menus for all to authenticated
  using (public.is_staff(true)) with check (public.is_staff(true));
create policy category_admin on public.categories for all to authenticated
  using (public.is_staff(true)) with check (public.is_staff(true));
create policy product_admin on public.products for all to authenticated
  using (public.is_staff(true)) with check (public.is_staff(true));
create policy table_admin on public.restaurant_tables for all to authenticated
  using (public.is_staff(true)) with check (public.is_staff(true));
create policy table_staff_read on public.restaurant_tables for select to authenticated
  using (public.is_staff());
create policy order_read on public.orders for select to authenticated
  using (public.is_staff());
create policy order_staff_update on public.orders for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy item_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- Resolves a QR token without exposing a list of table tokens to customers.
create function public.resolve_table(p_token uuid)
returns table (id integer, name text) language sql stable security definer set search_path = '' as $$
  select t.id, t.name from public.restaurant_tables t
  where t.qr_token = p_token and t.is_active;
$$;
revoke all on function public.resolve_table(uuid) from public;
grant execute on function public.resolve_table(uuid) to anon, authenticated;

-- Atomic submission. Prices and totals supplied by the browser are never used.
-- Guests submit using a QR token; no Auth account or session is created.
create function public.place_order(p_table_token uuid, p_items jsonb,
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

-- Switch menus atomically; the unique index permits only one active menu.
create function public.activate_menu(p_menu_id integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff(true) then raise exception 'Admin access required'; end if;
  lock table public.menus in share row exclusive mode;
  if not exists (select 1 from public.menus where id = p_menu_id) then
    raise exception 'Menu not found';
  end if;
  update public.menus set "isActive" = false where "isActive";
  update public.menus set "isActive" = true where id = p_menu_id;
end;
$$;
revoke all on function public.activate_menu(integer) from public, anon;
grant execute on function public.activate_menu(integer) to authenticated;

-- Public product photos; uploads and modifications are restricted to admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']);
create policy product_images_admin on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.is_staff(true))
  with check (bucket_id = 'product-images' and public.is_staff(true));

insert into public.restaurant_tables(name)
select 'Table ' || n from generate_series(1, 10) as n;

commit;
