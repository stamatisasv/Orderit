# Waiters: managed entirely from OrderIt

After this one-time developer setup, the owner uses **Admin → Waiters → Add waiter**.
Enter the name, email and initial password, then choose **Create waiter**.
The waiter can sign in at `/login` immediately. Share their credentials privately.
No invitation email or SMTP setup is required.

## One-time setup — no CLI or Keychain needed

1. Open the project's Supabase **SQL Editor**. Paste and run `supabase/waiters-management.sql` (after `setup.sql`).
2. Open **Edge Functions → Secrets**. Add:
   - Name: `ORDERIT_ALLOWED_ORIGINS`
   - Value: your Angular app's origin, for example `https://your-orderit-domain.com`.
   - For local testing, include `http://localhost:4200`, separated by a comma: `https://your-orderit-domain.com,http://localhost:4200`.
     Use origins only: no trailing slash or page path.
3. Open **Edge Functions → Deploy a new function → Via Editor**.
   Name it **`create-waiter`**. Replace the editor's `index.ts` with the complete contents of `supabase/functions/create-waiter/index.ts`. Deploy it.
4. Open the function's **Details / Function configuration** and turn off **Verify JWT with legacy secret**. The code itself verifies the signed-in user through Supabase Auth and checks their admin membership before creating any account.
5. Run or redeploy the updated Angular app, sign in as the owner/admin, and open **Admin → Waiters**.

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function. Do not copy service credentials into Angular.

Official instructions: [Dashboard deployment](https://supabase.com/docs/guides/functions/quickstart-dashboard), [function secrets](https://supabase.com/docs/guides/functions/secrets), [JWT setting](https://supabase.com/docs/guides/troubleshooting/edge-function-401-error-response).

## Owner's daily workflow

- **Create new account**: enter name, email and a password of 8–128 characters (the project's stronger password rules also apply). This creates the login and waiter access.
- **Link existing account**: add or restore access by email for someone who already has a login. Their password stays unchanged.
- **Edit**: change the waiter's display name.
- **Remove access**: revoke waiter permissions while retaining the login. Restore it later with Link existing account.

Existing admin accounts cannot be converted or removed by these waiter controls.
If creation reports that the login was created but access could not be confirmed, refresh the list. If missing, select Link existing account using the same email; the initial password is already set.

## Check the hosted setup

1. Create a test waiter in the app and confirm they appear in the list.
2. Sign in as that waiter in a private browser window. Verify orders, tables and requests work, and menus/staff management are blocked.
3. Rename the waiter from the owner account, then remove their access. Refresh the waiter's session and verify staff data is blocked.
4. Restore access with Link existing account and verify the same password still works.
5. Try creating the same email again: it should show an error without changing that account's password or permissions.

Local checks use mocks and do not create hosted accounts:

```bash
node scripts/check-waiter-creation.mjs
npm test -- --watch=false
```

## Order states

Run `simplify-order-statuses.sql` after the ordering migrations. It converts preparing/ready orders to accepted and enforces pending, accepted, served and cancelled. Customers see the Order sent confirmation.
