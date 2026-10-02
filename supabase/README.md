# Supabase setup for OrderIt

This setup assumes **one café/restaurant per Supabase project**, with one active menu and one currency. It is an initial schema for a fresh database, not a migration for an existing populated schema.

## 1. Create the database

Open Supabase → SQL Editor → New query. Paste all of `setup.sql` and run it once. It creates:

- `menus` → `categories` → `products`, matching the existing Angular field names.
- `restaurant_tables`, including ten sample tables with random QR tokens.
- `orders` → `order_items`, with saved product names and prices so later menu edits do not change past orders.
- `staff`, containing Supabase Auth user IDs and admin/waiter roles.
- Row Level Security policies, order/menu functions, and the public `product-images` storage bucket.

The script runs in a transaction. It deliberately fails on conflicting existing objects rather than silently accepting an incompatible schema. It has been reviewed but has not been executed against your Supabase project.

## 2. Create your admin

Create a permanent email/password user in Supabase Authentication. Copy their user UUID and run this separately in SQL Editor, replacing the placeholder:

```sql
insert into public.staff (user_id, name, role)
values ('YOUR-AUTH-USER-UUID'::uuid, 'Owner', 'admin');
```

For each waiter, create another Auth user and insert their UUID with role `waiter`. Customers cannot assign themselves staff roles. After the one-time setup in WAITERS_SETUP.md, owners manage waiters directly in the app.

## 3. Customers do not have accounts

Customers browse and submit orders as unauthenticated guests. Do not call `signInAnonymously()` or `signUp()` for customers.

In Supabase Authentication → Sign In / Providers, disable **Allow new users to sign up** and **Allow anonymous sign-ins**. Keep email/password sign-in enabled for staff. Create/invite admin and waiter accounts through the Supabase dashboard and add their IDs to `staff`.

If you already ran the original setup, run `guest-ordering.sql` once in SQL Editor to remove the old customer Auth requirement. Fresh projects can use the updated `setup.sql`. Existing orders and users are retained. The migration has not been applied to your hosted project by this app.

## 4. Generate QR links

Run this in SQL Editor, replacing the domain:

```sql
select id, name,
  'https://your-domain.com/menu?table=' || qr_token::text as qr_url
from public.restaurant_tables
order by id;
```

Encode each URL in a printed QR code. The Angular `/menu` route already exists, but reading and retaining this query parameter still needs implementation.

Resolve the token on arrival:

```ts
const { data, error } = await supabase.rpc('resolve_table', {
  p_token: tableToken,
});
// data contains [{ id, name }], or [] for an inactive/unknown token.
```

Retain the token when navigating to the basket and checkout. Do not use a customer-supplied numeric table ID to submit orders.

A printed QR token can be copied and does not prove physical presence. Before public launch, add ordering abuse controls (for example rate limiting and CAPTCHA validation through an Edge Function). If ordering must be restricted to current seated guests, add expiring table sessions or staff-issued codes. Set `is_active = false` to disable a table; replacing `qr_token` invalidates its old printed link.

## 5. Submit an order

Call directly as a guest; no customer session or account is needed:

```ts
// Generate once per checkout and retain for retries of this same submission.
const requestId = crypto.randomUUID();
const { data: orderId, error } = await supabase.rpc('place_order', {
  p_table_token: tableToken,
  p_request_id: requestId,
  p_items: [
    { product_id: 1, quantity: 2 },
    { product_id: 3, quantity: 1 },
  ],
  p_notes: 'Please bring some water.',
});
```

Use actual product IDs from your menu. The function validates table/product availability, saves items, and computes the total in one transaction. Reusing the same request ID returns the original order; use a new ID for a new checkout. Customers have no direct insert/update permissions on orders or items.

Guests receive their order ID from submission but cannot query orders or order items directly. Staff can see all orders and update only the `status` column. Supported statuses are `pending`, `accepted`, `preparing`, `ready`, `served`, and `cancelled`. This schema does not enforce a particular transition order or implement payment processing.

## 6. Open Angular

The shared client is in `src/app/services/supabase.ts`. Project settings are in `src/enviroments/enviroments.ts`; the URL must be the project base URL, without `/rest/v1/`. Only the public/anon key belongs in Angular.

```bash
npm install
npm start
```

Open `http://localhost:4200/login` and sign in using the email/password of the admin created in step 2. Open `/admin/menu` to create menus, categories and products, upload cropped photos, and activate a menu. Open `/menu` to view the active menu, or `/menu?table=YOUR-QR-TOKEN` to show the table name.

Menu, category, product, image upload and admin authentication services now use Supabase. The public menu also reads Supabase. Guest checkout and basket are described in section 8; waiter account management is described in section 9; the guest order RPC examples above describe the database API for checkout. See section 7 for the implemented table/order management screens.

Past orders keep item snapshots when products are deleted. Deactivate tables with order history instead of deleting them. Removing/replacing product image references does not currently garbage-collect old stored images.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database functions and execution permissions](https://supabase.com/docs/guides/database/functions)

## 7. Table and order management

Run **`staff-management.sql`** in SQL Editor after the base setup. This migration is also required for fresh installs. It preserves existing records and adds the order-management functions; it has not been applied to the hosted database automatically.

- `/admin/tables`: admins create, rename, activate/deactivate, and delete tables, copy table menu links, or replace their QR tokens. Waiters can view tables and copy links. Print new QR codes after replacing tokens. Tables with order history must be deactivated instead of deleted.
- `/admin/orders`: staff can view line items, filter by table/status, refresh, and change status. Admins also create orders, edit table/notes/items, and permanently delete orders with confirmation. Cancel orders when you want to retain history.
- Served/cancelled orders cannot have their contents edited unless staff first reopen them by changing their status.
- Existing lines keep their saved prices. New items use current prices from the active menu. The database calculates totals atomically and rejects stale edits.
- The list shows up to 200 matching orders, newest first. With section 8 installed, updates refresh every 3 seconds while not editing; historical pagination is not implemented.
- Staff membership still requires the Supabase dashboard and the `staff` table. Shared customer checkout is described in section 8.

Suggested next features: guest basket/checkout, live kitchen order updates, printable QR cards, waiter calls, payment tracking, stock/availability controls, and daily sales summaries.

## 8. Shared guest basket, checkout and assistance

Run **`shared-table-ordering.sql` after `staff-management.sql`**. It adds shared baskets, current table visits, assistance requests, and guest/staff functions. Existing order history is retained; older orders without a visit are visible to staff but are not shown to guests. This migration has been tested locally with PostgreSQL via PGlite, not applied to your hosted database.

Customer flow:

1. Open `/order`, choose a table, or scan its `/order?table=TOKEN` link. Older `/menu?table=TOKEN` links also work via the menu's Order link.
2. Add dishes. Every device selecting the same table shares one basket; changes refresh every 2 seconds. Quantity changes are atomic additions/removals, so guests do not overwrite each other's changes.
3. Open `/basket` or review the basket on the order page. Submission sends the entire table basket, not just one guest's additions. Notes belong to the person submitting and are not synced before submission.
4. Submit for staff acceptance. The server checks the basket version and prices and creates one pending order. Duplicate retries return the original order. If someone changed the basket, review and submit again.
5. Everyone can see orders from the current visit and whether staff accepted them. Call waiter and Request bill create one open request of each kind per table.

Staff flow:

- `/admin/orders` updates every 3 seconds while not editing. Accept or decline pending orders before preparation. Handle assistance requests with Acknowledge and Done.
- `/admin/tables/:id` → Start new visit after the previous guests leave. Open orders must first be served or cancelled. This clears the basket and hides earlier orders from new guests while retaining staff order history. Requesting a bill does not mark orders paid; payment processing is not implemented.
- Table selection is intentionally public: anyone selecting a table can see and change that table's current basket and see its current orders/notes. QR tokens are not proof of physical presence. Do not put private customer information in notes. Restrict selection or add staff-issued visit codes if private table access becomes necessary.
- Synchronization uses polling, not Supabase Realtime. No replication/publication setup is needed. Refresh intervals add database traffic and should be reviewed against your hosting limits before deployment.

Local SQL regression checks: install `@electric-sql/pglite` in a temporary directory, then set `PGLITE_MODULE` to its `dist/index.js` path and run `node scripts/check-shared-ordering.mjs`. The script uses an in-memory database with Auth/Storage stubs and never connects to hosted Supabase. It checks migrations, multiple additions, retry idempotency, stale checkout rejection, prices, role permissions, staff acceptance, assistance and visit resets. It does not simulate multiple PostgreSQL connections.


## 9. Dashboard and waiter management

The dashboard reads real product/table counts and active orders (`pending`, `accepted`), shows the five newest orders, and refreshes every five seconds while visible. Failed reads retain the previous summary and show an error. No extra dashboard migration is needed.

Owners create waiter logins directly in **Admin → Waiters**, using name, email and an initial password. The developer must run `waiters-management.sql` and deploy `create-waiter` once. Follow [WAITERS_SETUP.md](WAITERS_SETUP.md) for dashboard-only setup without CLI/Keychain.

Existing accounts can be linked by email without changing passwords. Removing waiter access retains the login and immediately revokes staff data access through RLS. Admin accounts are protected. The older invitation function is optional legacy code and is not used by this form.

Run `simplify-order-statuses.sql` after the ordering migrations to convert preparing/ready to accepted and enforce pending, accepted, served and cancelled. Customer status tracking is hidden; checkout shows a sent confirmation.

Validation:

```bash
npm test -- --watch=false
node scripts/check-waiter-creation.mjs
PGLITE_MODULE=/path/to/pglite/dist/index.js node scripts/check-shared-ordering.mjs
```

These checks do not create hosted users or validate a hosted deployment.
