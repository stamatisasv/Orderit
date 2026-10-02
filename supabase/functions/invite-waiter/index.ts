import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createInviteHandler } from './handler.ts';

// These secrets belong only to the Edge Function environment.
const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl = Deno.env.get('ORDERIT_APP_URL') ?? '';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const caller = (token: string) =>
  createClient(url, anonKey, {
    ...options,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
let appOrigin = '';
try {
  appOrigin = new URL(appUrl).origin;
} catch {
  /* Handler reports incomplete setup. */
}
const allowedOrigins = [appOrigin, ...(Deno.env.get('ORDERIT_ALLOWED_ORIGINS') ?? '').split(',')]
  .map((value) => value.trim())
  .filter(Boolean);

Deno.serve(
  createInviteHandler({
    appUrl,
    allowedOrigins,
    async isAdmin(token) {
      // Verify the JWT with Auth before using any service-role operations.
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(token);
      if (error || !user) return false;
      const { data, error: roleError } = await caller(token).rpc('is_staff', { admin_only: true });
      if (roleError) throw new Error('Unable to verify admin access.');
      return data === true;
    },
    async invite(token, email, name, redirectTo) {
      const client = caller(token);
      // Fail before sending mail when the migration is missing or access was revoked.
      const { data: waiters, error: setupError } = await client.rpc('list_waiters');
      if (setupError)
        throw new Error('Waiter management setup is incomplete or admin access was revoked.');
      if (waiters?.some((waiter: { email: string }) => waiter.email?.toLowerCase() === email)) {
        throw new Error('This email already has waiter access. Edit the existing waiter instead.');
      }
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { name },
      });
      if (error)
        throw new Error(`${error.message} If the account already exists, use Existing account.`);
      if (!data.user) throw new Error('No invited account was returned.');
      // Authorization always comes from staff, never user-editable account metadata.
      const { error: membershipError } = await client.rpc('add_waiter_by_email', {
        p_email: email,
        p_name: name,
      });
      if (membershipError)
        throw new Error(
          'The invitation was sent, but waiter access could not be added. Refresh the team list; if they are missing, add them using Existing account.',
        );
    },
  }),
);
