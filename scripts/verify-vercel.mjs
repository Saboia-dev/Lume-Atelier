import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import './verify-sql.mjs';

if (process.exitCode) process.exit(process.exitCode);
const manifest = JSON.parse(await readFile(new URL('../.next/routes-manifest.json', import.meta.url), 'utf8'));
assert.ok(manifest.version > 0, 'O build precisa gerar o manifesto nativo do Next.js.');
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}` };
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'AI_GATEWAY_API_KEY']) delete env[key];
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: new URL('..', import.meta.url), env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', data => { output += data.toString(); });
server.stderr.on('data', data => { output += data.toString(); });
const base = `http://127.0.0.1:${port}`;
const request = (path, options) => fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...options });
let checks = 1;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    try { const response = await request('/'); ready = response.ok; if (ready) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Servidor Next.js não iniciou.');
  for (const path of ['/', '/perfil', '/privacidade', '/entrar']) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /Lume|lume/);
    assert.doesNotMatch(html, /Codex could not read|upload\/image|chatgpt-auth/);
    checks++;
  }
  for (const path of ['/fonts/dm-sans-latin-wght-normal.woff2', '/fonts/dm-serif-display-latin-400-normal.woff2', '/images/lume-care.webp', '/images/lume-space.webp', '/images/lume-portrait.webp', '/favicon.svg']) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.ok((await response.arrayBuffer()).byteLength > 100);
    checks++;
  }
  for (const path of ['/api/profile', '/api/availability?date=2026-10-20']) {
    const response = await request(path, { headers: { 'x-oai-user-id': 'spoofed', 'x-oai-user-email': 'fake@example.test' } });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('cache-control'), /no-store/);
    checks++;
  }
  const post = data => ({ method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(data) });
  const auth = await request('/api/auth', post({ action: 'signin', email: 'test@example.test', password: 'test-password' }));
  assert.equal(auth.status, 503); checks++;
  for (const path of ['/api/auth', '/api/bookings', '/api/favorites', '/api/chat']) {
    const response = await request(path, { ...post({}), headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' } });
    assert.equal(response.status, 403, path); checks++;
  }
  assert.equal((await request('/api/chat', post({ messages: [{ role: 'user', content: '' }] }))).status, 400); checks++;
  assert.equal((await request('/api/chat', post({ messages: [{ role: 'user', content: 'a'.repeat(19000) }] }))).status, 413); checks++;
  const guide = await request('/api/chat', post({ messages: [{ role: 'user', content: 'Como agendar uma avaliação?' }] }));
  assert.equal(guide.status, 200);
  assert.equal(guide.headers.get('X-Lume-Mode'), 'guide');
  assert.match(await guide.text(), /reservar|avaliação/i); checks++;
  assert.equal((await (await request('/api/chat')).json()).mode, 'guide'); checks++;
  for (const path of ['/auth/callback?next=https://untrusted.example', '/auth/confirm?token_hash=invalid&type=email', '/nova-senha']) {
    const response = await request(path);
    assert.equal(response.status, 307);
    assert.ok(new URL(response.headers.get('location'), base).pathname === '/entrar'); checks++;
  }
  const logout = await request('/auth/sair', { method: 'POST', headers: { Origin: base } });
  assert.equal(logout.status, 303);
  assert.equal(new URL(logout.headers.get('location'), base).pathname, '/'); checks++;
  console.log(`Next.js: ${checks} verificações passaram (manifesto, páginas, assets e APIs sem credenciais).`);
  console.log('Supabase hospedado, envio de e-mails e IA paga precisam das configurações reais; não são simulados como conectados.');
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
}
