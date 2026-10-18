import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, CURRENCIES, SAMPLE_RATES } from '../src/config.js';
import { buildQuote } from '../src/lib/money.js';
import { openDb } from '../src/db.js';
import { seedDemo } from '../src/seed.js';
import { createApp } from '../src/app.js';

const FEE = { flat_fee_inr: 5, percent_fee: 0, markup_percent: 0.3 };
const quote = (code, amountInr = 10000) =>
  buildQuote({ amountInr, countryCode: code, rates: SAMPLE_RATES, fee: FEE, rateUpdatedAt: '2026-01-01T00:00:00Z', rateSource: 'sample' });

test('world coverage: ~190+ unique countries, every one has currency metadata and a sample rate', () => {
  assert.ok(COUNTRIES.length >= 190);
  assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, COUNTRIES.length);
  assert.ok(!COUNTRIES.some((c) => c.code === 'IN'), 'India is the sender, not a destination');
  for (const c of COUNTRIES) {
    assert.match(c.code, /^[A-Z]{2}$/);
    assert.ok(CURRENCIES[c.currency], `currency metadata for ${c.currency}`);
    assert.ok(SAMPLE_RATES[c.currency] > 0, `sample rate for ${c.currency}`);
  }
  for (const r of ['South Asia', 'Europe', 'Americas', 'Africa', 'Middle East', 'Asia-Pacific', 'Oceania'])
    assert.ok(COUNTRIES.some((c) => c.region === r), r);
});

test('every non-restricted corridor produces a sane quote rounded to its currency convention', () => {
  for (const c of COUNTRIES.filter((x) => !x.restricted)) {
    const q = quote(c.code);
    const d = CURRENCIES[c.currency].decimals;
    assert.ok(q.recipientAmount > 0, c.code);
    assert.equal(q.recipientAmount, Number(q.recipientAmount.toFixed(d)), `${c.code} rounds to ${d} dp`);
    assert.ok(q.recipientAmount < q.recipientAmountAtMid + 1e-9 && q.effectiveRate < q.midRate);
    assert.equal(q.totalPayableInr, 10005);
    assert.equal(q.rateIsSample, true);
  }
});

test('currency conventions: zero-decimal (JPY, XOF, CLP) and three-decimal (KWD, BHD) currencies', () => {
  for (const cur of ['JPY', 'XOF', 'CLP', 'KRW', 'VND']) assert.equal(CURRENCIES[cur].decimals, 0, cur);
  for (const cur of ['KWD', 'BHD', 'OMR', 'JOD']) assert.equal(CURRENCIES[cur].decimals, 3, cur);
  assert.ok(Number.isInteger(quote('JP').recipientAmount));
  assert.equal(quote('KW', 10000).recipientAmount, Number(quote('KW', 10000).recipientAmount.toFixed(3)));
});

test('pegged and shared currencies behave sensibly in the sample data', () => {
  assert.equal(SAMPLE_RATES.BTN, 1); // Ngultrum is pegged 1:1 to INR
  assert.equal(SAMPLE_RATES.NPR, 1.6); // NPR is pegged 1.6:1
  const eur = COUNTRIES.filter((c) => c.currency === 'EUR');
  assert.ok(eur.length >= 20);
  assert.equal(new Set(eur.map((c) => quote(c.code).recipientAmount)).size, 1);
});

test('restricted corridors are marked and rejected by the API with a clear reason', async () => {
  const restricted = COUNTRIES.filter((c) => c.restricted).map((c) => c.code).sort();
  assert.deepEqual(restricted, ['CU', 'IR', 'KP', 'SY']);

  const db = openDb(':memory:');
  seedDemo(db);
  const server = createApp({ db, secret: 'test-secret-test-secret', authLimit: 1000 });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const post = (path, body, token) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    const q = await post('/api/quote', { amount: 1000, country: 'KP' });
    assert.equal(q.status, 400);
    assert.match((await q.json()).error, /blocked in this demo/);

    const { token } = await (await post('/api/auth/demo', { role: 'user' })).json();
    const t = await post('/api/transfers', { amount: 1000, country: 'IR', recipientName: 'Test Person', identifier: 'test.person@demo', outcome: 'successful' }, token);
    assert.equal(t.status, 400);

    // A brand-new corridor works end to end and is recorded as simulated.
    const ok = await post('/api/transfers', { amount: 2000, country: 'BR', recipientName: 'Lucas Almeida', identifier: 'lucas.almeida@br-demo', outcome: 'successful' }, token);
    assert.equal(ok.status, 201);
    const body = await ok.json();
    assert.equal(body.transaction.receive_currency, 'BRL');
    assert.equal(body.transaction.simulated, true);
  } finally {
    server.close();
  }
});

test('an existing database gains newly supported currencies without losing admin edits', () => {
  const db = openDb(':memory:');
  db.prepare("UPDATE rates SET per_inr = 9.99, source='sample' WHERE currency='NPR'").run();
  db.prepare("DELETE FROM rates WHERE currency IN ('BRL','ZWG')").run();
  openDbDefaults(db);
  const n = db.prepare('SELECT COUNT(*) AS n FROM rates').get().n;
  assert.equal(n, Object.keys(SAMPLE_RATES).length);
  assert.equal(db.prepare("SELECT per_inr FROM rates WHERE currency='NPR'").get().per_inr, 9.99);
});

import { ensureDefaults } from '../src/db.js';
const openDbDefaults = ensureDefaults;
