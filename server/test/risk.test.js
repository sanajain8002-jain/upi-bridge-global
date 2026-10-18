import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessRisk } from '../src/lib/risk.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const ago = (min) => new Date(NOW - min * 60000).toISOString();
const tx = (o) => ({ amount_inr: 5000, status: 'successful', created_at: ago(60 * 24 * 5), recipient_name: 'Sita Sharma', recipient_identifier: 'sita@x-demo', ...o });
const base = { amountInr: 5000, recipientName: 'Sita Sharma', identifier: 'sita@x-demo', now: NOW };

test('clean transfer is low risk with no reasons', () => {
  const r = assessRisk({ ...base, history: [tx({}), tx({}), tx({})] });
  assert.equal(r.level, 'low');
  assert.deepEqual(r.reasons, []);
  assert.equal(r.engine, 'rule-based');
});

test('large vs history flags medium and needs enough history', () => {
  const hist = [tx({}), tx({}), tx({})];
  assert.equal(assessRisk({ ...base, amountInr: 20000, history: hist }).reasons[0].code, 'LARGE_VS_HISTORY');
  assert.equal(assessRisk({ ...base, amountInr: 20000, history: [tx({})] }).reasons.length, 0);
});

test('velocity: 3 transfers in 10 minutes', () => {
  const r = assessRisk({ ...base, history: [tx({ created_at: ago(1) }), tx({ created_at: ago(3) }), tx({ created_at: ago(6) })] });
  assert.ok(r.reasons.some((x) => x.code === 'VELOCITY'));
});

test('repeated failures within 24h', () => {
  const r = assessRisk({ ...base, history: [tx({ status: 'failed', created_at: ago(60) }), tx({ status: 'failed', created_at: ago(120) })] });
  assert.ok(r.reasons.some((x) => x.code === 'REPEATED_FAILURES'));
  const old = assessRisk({ ...base, history: [tx({ status: 'failed', created_at: ago(60 * 48) }), tx({ status: 'failed', created_at: ago(60 * 49) })] });
  assert.equal(old.reasons.length, 0);
});

test('inconsistent recipient: same identifier, different name', () => {
  const r = assessRisk({ ...base, recipientName: 'Someone Else', history: [], identifierHistory: [{ recipient_name: 'Sita Sharma' }] });
  assert.ok(r.reasons.some((x) => x.code === 'INCONSISTENT_RECIPIENT'));
  const same = assessRisk({ ...base, history: [], identifierHistory: [{ recipient_name: ' sita  sharma ' }] });
  assert.equal(same.reasons.length, 0);
});

test('stacked rules reach high; wording stays non-accusatory', () => {
  const hist = [tx({}), tx({}), tx({})];
  const r = assessRisk({ ...base, amountInr: 120000, recipientName: 'Other Name', history: hist, identifierHistory: [{ recipient_name: 'Sita Sharma' }] });
  assert.equal(r.level, 'high');
  assert.match(r.note, /not an accusation/i);
  assert.doesNotMatch(JSON.stringify(r), /fraudster|criminal|you are committing/i);
});
