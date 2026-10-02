// Runs the pure Edge request handler without sending mail or using hosted credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const edgeEntry = fileURLToPath(
  new URL('../supabase/functions/invite-waiter/index.ts', import.meta.url),
);
const shimPath = fileURLToPath(
  new URL('../supabase/functions/invite-waiter/__runtime-check.d.ts', import.meta.url),
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
  new URL('../supabase/functions/invite-waiter/handler.ts', import.meta.url),
  'utf8',
);
const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const { createInviteHandler } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
);
const invitations = [];
const handler = createInviteHandler({
  appUrl: 'https://orderit.example',
  allowedOrigins: ['https://orderit.example'],
  isAdmin: async (token) => token === 'admin',
  invite: async (...args) => invitations.push(args),
});
const request = (
  token,
  body = { name: ' Alex ', email: 'ALEX@example.com' },
  origin = 'https://orderit.example',
) =>
  new Request('https://edge.example/invite-waiter', {
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
assert.equal((await handler(request('admin', { name: 'A', email: 'broken' }))).status, 400);
assert.equal(invitations.length, 0);
assert.equal(
  (
    await handler(
      request('admin', {
        name: ' Alex ',
        email: 'ALEX@example.com',
        role: 'admin',
        redirectTo: 'https://untrusted.example',
      }),
    )
  ).status,
  200,
);
assert.deepEqual(invitations[0], [
  'admin',
  'alex@example.com',
  'Alex',
  'https://orderit.example/staff/activate',
]);
const preflight = await handler(
  new Request('https://edge.example', {
    method: 'OPTIONS',
    headers: { Origin: 'https://orderit.example' },
  }),
);
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://orderit.example');
const unavailable = createInviteHandler({
  appUrl: '',
  allowedOrigins: ['https://orderit.example'],
  isAdmin: async () => true,
  invite: async () => assert.fail('Must not invite without setup'),
});
assert.equal((await unavailable(request('admin'))).status, 503);
console.log(
  'PASS: invitations require verified admin access, validate input/origin, ignore supplied roles/redirects, and fail safely without setup',
);
