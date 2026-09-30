// Local SQL regression check. Install @electric-sql/pglite in a temporary folder,
// then run with PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node scripts/check-shared-ordering.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid, bucket_id text);
    grant usage on schema public, auth to anon, authenticated;
  `);
  for (const file of ['setup.sql','guest-ordering.sql','staff-management.sql','seed.sql','shared-table-ordering.sql']) {
    await db.exec(readFileSync(new URL(`../supabase/${file}`, import.meta.url), 'utf8'));
  }
  console.log('PASS: all SQL scripts execute');
  const admin = crypto.randomUUID(), waiter = crypto.randomUUID();
  await db.query('insert into auth.users values ($1),($2)', [admin, waiter]);
  await db.query("insert into public.staff values ($1,'Owner','admin'),($2,'Waiter','waiter')", [admin, waiter]);
  await db.exec('set role anon');
  const tables = (await db.query('select * from public.guest_tables()')).rows;
  assert.equal(tables.length, 10);
  const token = tables[0].qr_token;
  const state = async () => (await db.query('select public.guest_table_state($1) as state', [token])).rows[0].state;
  const initial = await state();
  const product = (await db.query('select id from public.products order by id limit 1')).rows[0].id;
  const change = (op = crypto.randomUUID()) => db.query('select public.change_table_basket($1,$2,$3,1,$4)', [token, initial.visit_id, product, op]);
  const op = crypto.randomUUID();
  await change(op); await change(op); // Simulated retry of the same device's operation.
  await Promise.all([change(), change()]); // Three distinct additions, no overwritten quantities.
  let current = await state();
  assert.equal(current.basket[0].quantity, 3);
  assert.equal(current.version, 3);
  console.log('PASS: shared additions and idempotent retries');
  await assert.rejects(db.query('select public.checkout_table_basket($1,$2,0,$3)', [token, initial.visit_id, crypto.randomUUID()]), /basket changed/);
  const request = crypto.randomUUID();
  const checkout = () => db.query('select public.checkout_table_basket($1,$2,$3,$4) as id', [token, initial.visit_id, current.version, request]);
  const id = (await checkout()).rows[0].id;
  assert.equal((await checkout()).rows[0].id, id);
  current = await state();
  assert.equal(current.basket.length, 0);
  assert.equal(current.orders.length, 1);
  assert.equal(current.orders[0].status, 'pending');
  assert.equal(current.orders[0].items[0].quantity, 3);
  assert.equal(Number(current.orders[0].total), 19.5);
  await assert.rejects(db.query('select public.checkout_table_basket($1,$2,$3,$4)', [token, initial.visit_id, 3, crypto.randomUUID()]), /basket changed/);
  await assert.rejects(db.query('select * from public.orders'), /permission denied/);
  console.log('PASS: checkout totals, pending acceptance, duplicate prevention and guest privacy');
  for (let i = 0; i < 2; i++) await db.query("select public.request_table_help($1,$2,'waiter')", [token, initial.visit_id]);
  assert.equal((await state()).requests.length, 1);
  await assert.rejects(db.query('select public.start_table_visit($1)', [tables[0].id]), /permission denied/);
  await db.exec('reset role; set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [waiter]);
  const version = async () => (await db.query('select "updatedAt"::text as v from public.orders where id=$1', [id])).rows[0].v;
  await assert.rejects(db.query("select public.set_order_status($1,'preparing',$2)", [id, await version()]), /Accept or decline/);
  await db.query("select public.set_order_status($1,'accepted',$2)", [id, await version()]);
  assert.equal((await state()).orders[0].status, 'accepted');
  await assert.rejects(db.query('select public.start_table_visit($1)', [tables[0].id]), /Serve or cancel/);
  const help = (await db.query('select id from public.table_requests')).rows[0].id;
  await db.query("select public.handle_table_request($1,'acknowledged')", [help]);
  assert.equal((await state()).requests[0].status, 'acknowledged');
  await db.query("select public.handle_table_request($1,'done')", [help]);
  assert.equal((await state()).requests.length, 0);
  await assert.rejects(db.query('select public.delete_staff_order($1,$2)', [id, await version()]), /Admin access/);
  await db.query("select public.set_order_status($1,'served',$2)", [id, await version()]);
  await db.query('select public.start_table_visit($1)', [tables[0].id]);
  current = await state();
  assert.equal(current.orders.length, 0);
  assert.notEqual(current.visit_id, initial.visit_id);
  await assert.rejects(change(), /new table visit/);
  assert.equal((await db.query('select count(*)::int as n from public.orders')).rows[0].n, 1);
  console.log('PASS: waiter acceptance, assistance handling, role checks, visit reset and order history');
} finally { await db.close(); }
