export interface InviteDependencies {
  appUrl: string;
  allowedOrigins: string[];
  isAdmin: (token: string) => Promise<boolean>;
  invite: (token: string, email: string, name: string, redirectTo: string) => Promise<void>;
}

export function createInviteHandler(deps: InviteDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin');
    const allowed = !origin || deps.allowedOrigins.includes(origin);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      if (
        name.length < 2 ||
        name.length > 100 ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return reply(400, {
          error: 'Enter a name with 2–100 characters and a valid email address.',
        });
      }
      let redirectTo: URL;
      try {
        const appUrl = new URL(deps.appUrl);
        if (!['http:', 'https:'].includes(appUrl.protocol))
          throw new Error('Invalid application URL');
        redirectTo = new URL('/staff/activate', appUrl);
      } catch {
        return reply(503, {
          error: 'Invitation setup is incomplete. Ask the owner to configure the application URL.',
        });
      }
      await deps.invite(token, email, name, redirectTo.href);
      return reply(200, { message: 'Invitation sent.' });
    } catch (error) {
      return reply(400, {
        error: error instanceof Error ? error.message : 'Unable to invite this waiter.',
      });
    }
  };
}
