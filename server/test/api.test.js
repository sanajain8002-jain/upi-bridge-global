import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { seedDemo } from '../src/seed.js';
import { createApp } from '../src/app.js';

let server, base, db;
before(async () => {
  db = openDb(':memory:');
  seedDemo(db);
  server = createApp({ db, secret: 'test-secret-test-secret', authLimit: 1000 });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* csv */ }
  return { status: res.status, json, text, headers: res.headers };
}
const demo = async (role) => (await call('/api/auth/demo', { method: 'POST', body: { role } })).json.token;
const transfer = (token, o = {}) =>
  call('/api/transfers', { method: 'POST', token, body: { amount: 5000, country: 'NP', recipientName: 'Sita Sharma', identifier: 'sita.sharma@nepal-demo', outcome: 'successful', ...o } });

test('meta lists global corridors and labels rates as sample', async () => {
  const { json } = await call('/api/meta');
  assert.ok(json.countries.length >= 20);
  for (const code of ['NP', 'BD', 'LK', 'BT', 'US', 'JP']) assert.ok(json.countries.some((c) => c.code === code));
  assert.match(json.rates.label, /SAMPLE/);
  assert.equal(json.simulated, true);
});

test('quote validates input on the server', async () => {
  assert.equal((await call('/api/quote', { method: 'POST', body: { amount: 10, country: 'NP' } })).status, 400);
  assert.equal((await call('/api/quote', { method: 'POST', body: { amount: 1e9, country: 'NP' } })).status, 400);
  assert.equal((await call('/api/quote', { method: 'POST', body: { amount: 'abc', country: 'NP' } })).status, 400);
  assert.equal((await call('/api/quote', { method: 'POST', body: { amount: 1000, country: 'ZZ' } })).status, 400);
  const ok = await call('/api/quote', { method: 'POST', body: { amount: 2500.5, country: 'JP' } });
  assert.equal(ok.status, 200);
  assert.ok(Number.isInteger(ok.json.recipientAmount));
});

test('register, login, wrong password, duplicate email, role cannot be self-assigned', async () => {
  const email = `t${Date.now()}@example.com`;
  const reg = await call('/api/auth/register', { method: 'POST', body: { email, password: 'longenough1', name: 'Test User', role: 'admin' } });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.user.role, 'user');
  assert.equal((await call('/api/auth/register', { method: 'POST', body: { email, password: 'longenough1', name: 'Test User' } })).status, 409);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email, password: 'wrongwrong' } })).status, 401);
  const login = await call('/api/auth/login', { method: 'POST', body: { email, password: 'longenough1' } });
  assert.equal(login.status, 200);
  assert.equal((await call('/api/auth/register', { method: 'POST', body: { email: 'bad', password: 'short', name: '1' } })).status, 400);
  assert.equal(JSON.stringify(login.json).includes('password_hash'), false);
});

test('demo accounts cannot sign in with a password', async () => {
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'demo@upibridge.demo', password: 'anything123' } })).status, 401);
});

test('protected routes require a valid token; tampered tokens fail', async () => {
  assert.equal((await call('/api/summary')).status, 401);
  const t = await demo('user');
  assert.equal((await call('/api/summary', { token: t })).status, 200);
  assert.equal((await call('/api/summary', { token: t.slice(0, -3) + 'abc' })).status, 401);
});

test('role-based access: users cannot reach admin APIs; admins can', async () => {
  const user = await demo('user');
  const admin = await demo('admin');
  for (const p of ['/api/admin/stats', '/api/admin/transactions', '/api/admin/alerts', '/api/admin/export.csv', '/api/admin/fee'])
    assert.equal((await call(p, { token: user })).status, 403, p);
  assert.equal((await call('/api/admin/rates/NPR', { method: 'PUT', token: user, body: { rate: 2 } })).status, 403);
  for (const p of ['/api/admin/stats', '/api/admin/transactions', '/api/admin/alerts', '/api/admin/fee'])
    assert.equal((await call(p, { token: admin })).status, 200, p);
});

test('successful simulated transfer updates history and dashboard summary', async () => {
  const t = await demo('user');
  const before = (await call('/api/summary', { token: t })).json;
  const r = await transfer(t, { amount: 3000, country: 'BD', recipientName: 'Rahim Uddin', identifier: 'rahim.uddin@dhaka-demo' });
  assert.equal(r.status, 201);
  assert.equal(r.json.transaction.status, 'successful');
  assert.equal(r.json.transaction.simulated, true);
  assert.equal(r.json.transaction.fee_inr, 5);
  assert.match(r.json.transaction.txn_id, /^UBG-/);
  const after = (await call('/api/summary', { token: t })).json;
  assert.equal(after.count, before.count + 1);
  assert.equal(after.sentInr, before.sentInr + 3000);
  const list = (await call('/api/transfers?country=BD&status=successful', { token: t })).json;
  assert.ok(list.rows.some((x) => x.txn_id === r.json.transaction.txn_id));
  const rec = await call(`/api/transfers/${r.json.transaction.txn_id}`, { token: t });
  assert.equal(rec.json.transaction.recipient_name, 'Rahim Uddin');
});

test('pending and failed outcomes are demonstrable; pending can be settled only by admin', async () => {
  const t = await demo('user');
  const admin = await demo('admin');
  const pending = (await transfer(t, { outcome: 'pending' })).json.transaction;
  const failed = (await transfer(t, { outcome: 'failed' })).json.transaction;
  assert.equal(pending.status, 'pending');
  assert.equal(failed.status, 'failed');
  assert.match(failed.failure_reason, /Simulated/);
  assert.equal((await call(`/api/admin/transactions/${pending.txn_id}/status`, { method: 'PATCH', token: t, body: { status: 'successful' } })).status, 403);
  const ok = await call(`/api/admin/transactions/${pending.txn_id}/status`, { method: 'PATCH', token: admin, body: { status: 'successful' } });
  assert.equal(ok.json.transaction.status, 'successful');
  assert.equal((await call(`/api/admin/transactions/${pending.txn_id}/status`, { method: 'PATCH', token: admin, body: { status: 'failed' } })).status, 409);
});

test('a client cannot force a status or supply its own amounts', async () => {
  const t = await demo('user');
  const r = await transfer(t, { status: 'successful', fee_inr: 0, recipient_amount: 999999, outcome: 'pending' });
  assert.equal(r.json.transaction.status, 'pending');
  assert.equal(r.json.transaction.fee_inr, 5);
  assert.notEqual(r.json.transaction.recipient_amount, 999999);
  assert.equal((await transfer(t, { outcome: 'paid' })).status, 400);
});

test('transfer validation: recipient name, identifier, amount, country', async () => {
  const t = await demo('user');
  assert.equal((await transfer(t, { recipientName: '<script>alert(1)</script>' })).status, 400);
  assert.equal((await transfer(t, { identifier: 'a b' })).status, 400);
  assert.equal((await transfer(t, { amount: -5 })).status, 400);
  assert.equal((await transfer(t, { country: 'IN' })).status, 400);
});

test('KYC limit: unverified users are capped; completing the demo KYC lifts the cap', async () => {
  const t = await demo('new');
  const blocked = await transfer(t, { amount: 20000 });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.json.code, 'KYC_REQUIRED');
  assert.equal((await call('/api/kyc/advance', { method: 'POST', token: t })).status, 409);
  assert.equal((await call('/api/kyc/submit', { method: 'POST', token: t, body: { fullName: 'Asha Verma', documentType: 'real passport' } })).status, 400);
  assert.equal((await call('/api/kyc/submit', { method: 'POST', token: t, body: { fullName: 'Asha Verma', documentType: 'Placeholder passport (demo)' } })).json.stage, 'submitted');
  assert.equal((await call('/api/kyc/advance', { method: 'POST', token: t })).json.stage, 'under_review');
  assert.equal((await call('/api/kyc/advance', { method: 'POST', token: t })).json.stage, 'verified');
  assert.equal((await transfer(t, { amount: 20000 })).status, 201);
  await call('/api/kyc/reset', { method: 'POST', token: t });
});

test('risk assistant flags a large amount to a reused identifier, with reason and next step', async () => {
  const t = await demo('user');
  const r = await call('/api/risk/assess', { method: 'POST', token: t, body: { amount: 60000, country: 'NP', recipientName: 'Geeta Sharma', identifier: 'gita.thapa@nepal-demo' } });
  assert.equal(r.json.level, 'high');
  assert.ok(r.json.reasons.length >= 2);
  assert.ok(r.json.suggestedStep.length > 10);
  assert.equal(r.json.engine, 'rule-based');
  const created = await transfer(t, { amount: 60000, recipientName: 'Geeta Sharma', identifier: 'gita.thapa@nepal-demo' });
  assert.equal(created.json.transaction.risk_level, 'high');
  const admin = await demo('admin');
  const alerts = (await call('/api/admin/alerts', { token: admin })).json.alerts;
  const mine = alerts.find((a) => a.txn_id === created.json.transaction.txn_id);
  assert.ok(mine);
  assert.equal((await call(`/api/admin/alerts/${mine.id}`, { method: 'PATCH', token: admin, body: { reviewStatus: 'cleared' } })).status, 200);
});

test('users only see their own transactions; receipts of others return 404', async () => {
  const user = await demo('user');
  const admin = await demo('admin');
  const all = (await call('/api/admin/transactions?pageSize=100', { token: admin })).json.rows;
  const other = all.find((x) => x.sender_email !== 'demo@upibridge.demo');
  assert.ok(other);
  assert.equal((await call(`/api/transfers/${other.txn_id}`, { token: user })).status, 404);
  assert.equal((await call(`/api/transfers/${other.txn_id}`, { token: admin })).status, 200);
  const mine = (await call('/api/transfers?pageSize=100', { token: user })).json.rows;
  assert.ok(mine.every((x) => x.sender_email === undefined));
});

test('admin can change sample rates and fee; quotes follow immediately', async () => {
  const admin = await demo('admin');
  await call('/api/admin/rates/NPR', { method: 'PUT', token: admin, body: { rate: 2 } });
  await call('/api/admin/fee', { method: 'PUT', token: admin, body: { flat_fee_inr: 3, markup_percent: 0 } });
  const q = (await call('/api/quote', { method: 'POST', body: { amount: 1000, country: 'NP' } })).json;
  assert.equal(q.transferFeeInr, 3);
  assert.equal(q.recipientAmount, 2000);
  assert.equal((await call('/api/admin/rates/NPR', { method: 'PUT', token: admin, body: { rate: -1 } })).status, 400);
  assert.equal((await call('/api/admin/rates/INR', { method: 'PUT', token: admin, body: { rate: 2 } })).status, 400);
  assert.equal((await call('/api/admin/fee', { method: 'PUT', token: admin, body: { flat_fee_inr: 9999 } })).status, 400);
  await call('/api/admin/rates/NPR', { method: 'PUT', token: admin, body: { rate: 1.6 } });
  await call('/api/admin/fee', { method: 'PUT', token: admin, body: { flat_fee_inr: 5, markup_percent: 0.3 } });
  assert.equal((await call('/api/admin/rates/refresh', { method: 'POST', token: admin })).status, 400); // no live API configured
});

test('admin stats per country and CSV export (SAMPLE labelled, injection-safe)', async () => {
  const admin = await demo('admin');
  const stats = (await call('/api/admin/stats', { token: admin })).json;
  assert.ok(stats.perCountry.length > 5);
  assert.ok(stats.perCountry.some((c) => c.country === 'NP'));
  const csv = await call('/api/admin/export.csv?country=NP', { token: admin });
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const lines = csv.text.trim().split('\n');
  assert.match(lines[0], /^Transaction ID,/);
  assert.ok(lines.length > 2);
  assert.ok(lines.slice(1).every((l) => l.includes(',NP,') && l.includes('SAMPLE')));
});

test('profile update validates and persists', async () => {
  const t = await demo('user');
  const r = await call('/api/auth/profile', { method: 'PATCH', token: t, body: { preferredCurrency: 'USD' } });
  assert.equal(r.json.user.preferredCurrency, 'USD');
  assert.equal((await call('/api/auth/profile', { method: 'PATCH', token: t, body: { preferredCurrency: 'XXX' } })).status, 400);
  await call('/api/auth/profile', { method: 'PATCH', token: t, body: { preferredCurrency: 'INR' } });
});

test('errors are clean JSON; unknown routes 404; bad JSON 400; security headers present', async () => {
  assert.equal((await call('/api/nope')).status, 404);
  const bad = await fetch(base + '/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await call('/api/auth/me')).status, 401);
});
