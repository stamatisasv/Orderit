import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

export interface CreationDependencies {
  allowedOrigins: string[];
  isAdmin: (token: string) => Promise<boolean>;
  create: (token: string, email: string, name: string, password: string) => Promise<void>;
}

export function createWaiterHandler(deps: CreationDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin');
    const allowed = !origin || deps.allowedOrigins.includes(origin);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    };
    if (origin && allowed) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers });
    if (!allowed) return reply(403, { error: 'This application origin is not allowed.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply(401, { error: 'Please sign in.' });
    try {
      if (!(await deps.isAdmin(token))) return reply(403, { error: 'Admin access required.' });
      const body = await request.json().catch(() => null);
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      if (
        name.length < 2 ||
        name.length > 100 ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
        return reply(400, {
          error: 'Enter a name with 2–100 characters and a valid email address.',
        });
      if (password.length < 8 || password.length > 128)
        return reply(400, { error: 'Use an initial password with 8–128 characters.' });
      await deps.create(token, email, name, password);
      return reply(200, { message: 'Waiter created.' });
    } catch (error) {
      return reply(400, {
        error: error instanceof Error ? error.message : 'Unable to create this waiter.',
      });
    }
  };
}

// Supabase runtime wiring. Credentials stay in the Edge Function environment.
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);
const caller = (token: string) =>
  createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    ...options,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
const allowedOrigins = (Deno.env.get('ORDERIT_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
Deno.serve(
  createWaiterHandler({
    allowedOrigins,
    async isAdmin(token) {
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(token);
      if (error || !user) return false;
      const { data, error: roleError } = await caller(token).rpc('is_staff', { admin_only: true });
      return !roleError && data === true;
    },
    async create(token, email, name, password) {
      const client = caller(token);
      const { data: waiters, error: setupError } = await client.rpc('list_waiters');
      if (setupError)
        throw new Error('Waiter management setup is incomplete or admin access was revoked.');
      if (waiters?.some((waiter: { email: string }) => waiter.email?.toLowerCase() === email))
        throw new Error(
          'This email already has waiter access. Refresh and edit the existing waiter.',
        );
      // createUser never overwrites an existing account or its password.
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error)
        throw new Error(
          `${error.message} If this login already exists, choose Link existing account.`,
        );
      if (!data.user) throw new Error('No new account was returned. Refresh before trying again.');
      // Caller RPC rechecks admin access and assigns the fixed waiter role.
      const { error: membershipError } = await client.rpc('add_waiter_by_email', {
        p_email: email,
        p_name: name,
      });
      if (membershipError) {
        // A response may fail after commit: check before reporting a partial creation.
        const { data: staff, error: lookupError } = await admin
          .from('staff')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();
        if (!lookupError && staff?.role === 'waiter') return;
        // Retain the account rather than risk deleting a concurrently linked user.
        throw new Error(
          'Login created, but waiter access could not be confirmed. Refresh the list; if missing, use Link existing account with this email. The initial password is already set.',
        );
      }
    },
  }),
);
