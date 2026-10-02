// Runs the pure Edge request handler without sending mail or using hosted credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const edgeEntry = fileURLToPath(
  new URL('../supabase/functions/create-waiter/index.ts', import.meta.url),
);
const shimPath = fileURLToPath(
  new URL('../supabase/functions/create-waiter/__runtime-check.d.ts', import.meta.url),
);
const shim =
  'declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };';
const options = {
  noEmit: true,
  strict: true,
  skipLibCheck: true,
  allowImportingTsExtensions: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
};
const host = ts.createCompilerHost(options);
const originalSource = host.getSourceFile.bind(host);
host.getSourceFile = (path, languageVersion, ...rest) =>
  path === shimPath
    ? ts.createSourceFile(path, shim, languageVersion)
    : originalSource(path, languageVersion, ...rest);
host.resolveModuleNames = (names, containing) =>
  names.map(
    (name) =>
      ts.resolveModuleName(
        name === 'npm:@supabase/supabase-js@2.117.2' ? '@supabase/supabase-js' : name,
        containing,
        options,
        host,
      ).resolvedModule,
  );
const diagnostics = ts.getPreEmitDiagnostics(
  ts.createProgram([edgeEntry, shimPath], options, host),
);
if (diagnostics.length) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (p) => p,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    }),
  );
  process.exit(1);
}
console.log('PASS: Edge Function TypeScript checks against the installed Supabase SDK');
const source = readFileSync(
  new URL('../supabase/functions/create-waiter/index.ts', import.meta.url),
  'utf8',
)
  .replace(/^import .*;\n/, '')
  .split('// Supabase runtime wiring.')[0];
const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const { createWaiterHandler } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
);
const creations = [];
const handler = createWaiterHandler({
  allowedOrigins: ['https://orderit.example'],
  isAdmin: async (token) => token === 'admin',
  create: async (...args) => creations.push(args),
});
const request = (
  token,
  body = { name: ' Alex ', email: 'ALEX@example.com', password: ' secret123 ' },
  origin = 'https://orderit.example',
) =>
  new Request('https://edge.example/create-waiter', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Origin: origin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
assert.equal((await handler(request(''))).status, 401);
assert.equal((await handler(request('waiter'))).status, 403);
assert.equal((await handler(request('invalid-token'))).status, 403);
assert.equal((await handler(request('admin', undefined, 'https://untrusted.example'))).status, 403);
assert.equal(
  (await handler(request('admin', { name: 'Alex', email: 'alex@example.com', password: 'short' })))
    .status,
  400,
);
assert.equal(
  (await handler(request('admin', { name: 'A', email: 'broken', password: 'secret123' }))).status,
  400,
);
assert.equal(creations.length, 0);
const response = await handler(
  request('admin', {
    name: ' Alex ',
    email: 'ALEX@example.com',
    password: ' secret123 ',
    role: 'admin',
  }),
);
assert.equal(response.status, 200);
assert.deepEqual(creations[0], ['admin', 'alex@example.com', 'Alex', ' secret123 ']);
assert.equal((await response.text()).includes('secret123'), false);
assert.equal(response.headers.get('Cache-Control'), 'no-store');
assert.equal(
  (
    await handler(
      new Request('https://edge.example', {
        method: 'OPTIONS',
        headers: { Origin: 'https://orderit.example' },
      }),
    )
  ).status,
  204,
);
console.log(
  'PASS: creation requires admin access, validates input/origin, preserves passwords, ignores supplied roles, and never returns passwords',
);
// Exercise the actual SDK orchestration with fake clients; no hosted accounts are created.
let runtimeHandler;
const state = {
  authorized: true,
  setupError: null,
  createError: null,
  membershipError: null,
  staff: null,
  calls: [],
};
const caller = {
  rpc: async (name, args) => {
    state.calls.push([name, args]);
    if (name === 'is_staff') return { data: state.authorized, error: null };
    if (name === 'list_waiters') return { data: [], error: state.setupError };
    return { error: state.membershipError };
  },
};
const admin = {
  auth: {
    getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }),
    admin: {
      createUser: async (args) => {
        state.calls.push(['createUser', args]);
        return {
          data: { user: state.createError ? null : { id: 'new-waiter' } },
          error: state.createError,
        };
      },
    },
  },
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: state.staff, error: null }) }),
    }),
  }),
};
globalThis.__waiterRuntime = {
  createClient: (_url, key) => (key === 'service' ? admin : caller),
  Deno: {
    env: {
      get: (name) =>
        ({
          SUPABASE_URL: 'https://edge.example',
          SUPABASE_SERVICE_ROLE_KEY: 'service',
          SUPABASE_ANON_KEY: 'anon',
          ORDERIT_ALLOWED_ORIGINS: 'https://orderit.example',
        })[name],
    },
    serve: (handler) => {
      runtimeHandler = handler;
    },
  },
};
const runtimeSource = readFileSync(
  new URL('../supabase/functions/create-waiter/index.ts', import.meta.url),
  'utf8',
).replace(/^import .*;\n/, 'const { createClient, Deno } = globalThis.__waiterRuntime;\n');
await import(
  `data:text/javascript;base64,${Buffer.from(ts.transpile(runtimeSource, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 })).toString('base64')}`
);
assert.equal((await runtimeHandler(request('admin'))).status, 200);
assert.deepEqual(state.calls.find(([name]) => name === 'createUser')[1], {
  email: 'alex@example.com',
  password: ' secret123 ',
  email_confirm: true,
  user_metadata: { name: 'Alex' },
});
assert.deepEqual(state.calls.find(([name]) => name === 'add_waiter_by_email')[1], {
  p_email: 'alex@example.com',
  p_name: 'Alex',
});
state.calls = [];
state.authorized = false;
assert.equal((await runtimeHandler(request('admin'))).status, 403);
assert.equal(
  state.calls.some(([name]) => name === 'createUser'),
  false,
);
state.authorized = true;
state.setupError = { message: 'Missing migration' };
state.calls = [];
assert.equal((await runtimeHandler(request('admin'))).status, 400);
assert.equal(
  state.calls.some(([name]) => name === 'createUser'),
  false,
);
state.setupError = null;
state.createError = { message: 'Account exists' };
state.calls = [];
assert.equal((await runtimeHandler(request('admin'))).status, 400);
assert.equal(
  state.calls.some(([name]) => name === 'add_waiter_by_email'),
  false,
);
state.createError = null;
state.membershipError = { message: 'Lost response' };
state.staff = { role: 'waiter' };
assert.equal((await runtimeHandler(request('admin'))).status, 200);
state.staff = null;
const partial = await runtimeHandler(request('admin'));
assert.equal(partial.status, 400);
assert.match((await partial.json()).error, /Link existing account/);
delete globalThis.__waiterRuntime;
console.log(
  'PASS: server preflights setup/admin access, creates confirmed logins, links fixed waiter access, protects existing logins, and recovers partial creation',
);
