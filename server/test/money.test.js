import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { buildQuote, roundToCurrency, generateTransactionId, toPaise } from '../src/lib/money.js';
import { SAMPLE_RATES, DEFAULT_FEE_MODEL } from '../src/config.js';
import { toCsv, csvCell } from '../src/lib/csv.js';

const q = (amountInr, countryCode, fee = DEFAULT_FEE_MODEL) =>
  buildQuote({ amountInr, countryCode, rates: SAMPLE_RATES, fee, rateUpdatedAt: '2026-01-01T00:00:00Z', rateSource: 'sample' });

test('Nepal quote: fee, separate markup, total and recipient amount', () => {
  const r = q(10000, 'NP');
  assert.equal(r.transferFeeInr, 5);
  assert.equal(r.markupCostInr, 30);
  assert.equal(r.totalPayableInr, 10005);
  assert.equal(r.effectiveRate, 1.5952);
  assert.equal(r.recipientAmount, 15952);
  assert.equal(r.rateIsSample, true);
});

test('Bhutan is pegged 1:1 before markup', () => {
  const r = q(1000, 'BT');
  assert.equal(r.midRate, 1);
  assert.equal(r.recipientAmount, 997);
});

test('rounding follows currency conventions (JPY 0dp, KWD 3dp, USD 2dp)', () => {
  assert.equal(roundToCurrency(1234.5, 'JPY'), 1235);
  assert.equal(roundToCurrency(1.23456, 'KWD'), 1.235);
  assert.equal(roundToCurrency(10.005, 'USD'), 10.01);
  assert.equal(Number.isInteger(q(14000, 'JP').recipientAmount), true);
});

test('INR arithmetic has no float drift (0.1 + 0.2 style amounts)', () => {
  const r = q(1000.1, 'US', { ...DEFAULT_FEE_MODEL, flat_fee_inr: 5.2 });
  assert.equal(r.totalPayableInr, 1005.3);
  assert.equal(toPaise(19.99), 1999);
});

test('percentage fee is added to flat fee; zero markup gives mid rate', () => {
  const r = q(10000, 'GB', { ...DEFAULT_FEE_MODEL, percent_fee: 0.5, markup_percent: 0 });
  assert.equal(r.transferFeeInr, 55);
  assert.equal(r.effectiveRate, r.midRate);
});

test('every configured country can be quoted', () => {
  for (const c of ['NP', 'BD', 'LK', 'BT', 'US', 'AE', 'KW', 'ID', 'NG', 'BR', 'ZA']) {
    const r = q(5000, c);
    assert.ok(r.recipientAmount > 0, c);
  }
});

test('unknown destination is rejected', () => {
  assert.throws(() => q(1000, 'XX'), /Unsupported destination/);
});

test('transaction IDs have the expected shape and are unique', () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) {
    const id = generateTransactionId(randomBytes);
    assert.match(id, /^UBG-\d{8}-[A-Z2-9]{8}$/);
    ids.add(id);
  }
  assert.equal(ids.size, 500);
});

test('CSV escapes quotes/commas and neutralises formula injection', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("x")').startsWith(`"'=`), true);
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(toCsv([{ key: 'a', header: 'A' }], [{ a: 1 }]), 'A\n1\n');
});
