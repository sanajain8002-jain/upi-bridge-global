import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { hashPassword } from './lib/auth.js';
import { buildQuote, generateTransactionId } from './lib/money.js';
import { getFeeModel, getRates, insertAlert } from './services.js';

export const DEMO_USER_EMAIL = 'demo@upibridge.demo';
export const DEMO_ADMIN_EMAIL = 'admin@upibridge.demo';
export const DEMO_NEWUSER_EMAIL = 'newuser@upibridge.demo';

const DAY = 86400000;

// [daysAgo, hoursAgo, country, amountInr, status, recipientName, identifier, risk]
// risk: null = low, otherwise { level, score, reasons[], suggestedStep }
const USER_TXNS = [
  [38, 3, 'NP', 8000, 'successful', 'Sita Sharma', 'sita.sharma@nepal-demo'],
  [33, 5, 'NP', 7500, 'successful', 'Sita Sharma', 'sita.sharma@nepal-demo'],
  [29, 2, 'BD', 12000, 'successful', 'Rahim Uddin', 'rahim.uddin@dhaka-demo'],
  [25, 6, 'LK', 6000, 'successful', 'Nimali Perera', 'nimali.perera@colombo-demo'],
  [21, 1, 'BT', 4500, 'successful', 'Karma Dorji', 'karma.dorji@thimphu-demo'],
  [18, 4, 'AE', 15000, 'successful', 'Rohit Menon', 'rohit.menon@dubai-demo'],
  [15, 2, 'US', 20000, 'successful', 'Ananya Rao', 'ananya.rao@us-demo'],
  [12, 7, 'NP', 8200, 'successful', 'Sita Sharma', 'sita.sharma@nepal-demo'],
  [10, 3, 'GB', 9000, 'failed', 'Oliver Grant', 'oliver.grant@uk-demo'],
  [9, 8, 'GB', 9000, 'successful', 'Oliver Grant', 'oliver.grant@uk-demo'],
  [7, 2, 'SG', 11000, 'successful', 'Wei Ling Tan', 'weiling.tan@sg-demo'],
  [5, 5, 'BD', 5000, 'pending', 'Rahim Uddin', 'rahim.uddin@dhaka-demo'],
  [3, 3, 'JP', 14000, 'successful', 'Haruto Sato', 'haruto.sato@jp-demo'],
  [2, 1, 'NP', 9000, 'successful', 'Sita Sharma', 'sita.sharma@nepal-demo'],
  [1, 4, 'KE', 7000, 'failed', 'Amina Otieno', 'amina.otieno@ke-demo'],
];

const OTHER_USERS = [
  { email: 'rohan@upibridge.demo', name: 'Rohan Verma', txns: [
    [20, 2, 'PH', 25000, 'successful', 'Maria Santos', 'maria.santos@ph-demo'],
    [14, 6, 'PH', 26000, 'successful', 'Maria Santos', 'maria.santos@ph-demo'],
    [6, 1, 'SA', 30000, 'successful', 'Faisal Al-Harbi', 'faisal.harbi@sa-demo'],
    [4, 2, 'NP', 95000, 'pending', 'Gita Thapa', 'gita.thapa@nepal-demo', {
      level: 'high', score: 65,
      reasons: [
        { code: 'LARGE_VS_HISTORY', points: 40, text: 'This amount (₹95,000) is more than 3× your demo average of ₹27,000.' },
        { code: 'INCONSISTENT_RECIPIENT', points: 35, text: 'This payment identifier was previously used with a different recipient name.' },
      ] }],
  ] },
  { email: 'kavya@upibridge.demo', name: 'Kavya Nair', txns: [
    [16, 3, 'CA', 18000, 'successful', 'Arjun Nair', 'arjun.nair@ca-demo'],
    [9, 4, 'AU', 22000, 'successful', 'Priya Iyer', 'priya.iyer@au-demo'],
    [0, 0, 'LK', 4000, 'failed', 'Dilan Fernando', 'dilan.fernando@colombo-demo'],
    [0, 0, 'LK', 4000, 'failed', 'Dilan Fernando', 'dilan.fernando@colombo-demo'],
    [0, 0, 'LK', 4500, 'pending', 'Dilan Fernando', 'dilan.fernando@colombo-demo', {
      level: 'medium', score: 30,
      reasons: [{ code: 'REPEATED_FAILURES', points: 30, text: '2 failed attempts in the last 24 hours.' }] }],
  ] },
];

function insertTxn(db, userId, [daysAgo, hoursAgo, country, amount, status, name, ident, risk], rates, fee, rateInfo) {
  const created = new Date(Date.now() - daysAgo * DAY - hoursAgo * 3600000 - (daysAgo === 0 && hoursAgo === 0 ? Math.floor(Math.random() * 600000) : 0)).toISOString();
  const q = buildQuote({ amountInr: amount, countryCode: country, rates, fee, rateUpdatedAt: rateInfo.updatedAt, rateSource: rateInfo.source });
  const txnId = generateTransactionId(randomBytes, new Date(created));
  const r = risk || { level: 'low', score: 0, reasons: [], suggestedStep: 'No extra step suggested. Proceed as normal.', engine: 'rule-based' };
  r.suggestedStep ||= r.level === 'high'
    ? 'Suggested: pause and verify the recipient and amount directly with them. A reviewer will look at this demo payment.'
    : 'Suggested: confirm the recipient details with the recipient through a channel you already trust before sending.';
  r.engine ||= 'rule-based';
  db.prepare(
    `INSERT INTO transactions (txn_id,user_id,country,receive_currency,recipient_name,recipient_identifier,amount_inr,mid_rate,effective_rate,
      markup_percent,markup_cost_inr,fee_inr,total_payable_inr,recipient_amount,rate_source,rate_updated_at,status,failure_reason,risk_level,risk_score,simulated,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`
  ).run(txnId, userId, q.country, q.receiveCurrency, name, ident, q.amountInr, q.midRate, q.effectiveRate, q.markupPercent, q.markupCostInr,
    q.transferFeeInr, q.totalPayableInr, q.recipientAmount, q.rateSource, q.rateUpdatedAt, status,
    status === 'failed' ? 'Simulated failure: the mock destination bank declined the payment (demo).' : null, r.level, r.score, created, created);
  if (r.level !== 'low') insertAlert(db, txnId, userId, r, created);
}

function addUser(db, { email, name, role = 'user', kyc = 'verified', password = null }) {
  const info = db.prepare(
    `INSERT INTO users (email,password_hash,name,country,preferred_currency,role,is_demo,kyc_stage,kyc_demo_name,kyc_demo_doc,created_at)
     VALUES (?,?,?,?,?,?,1,?,?,?,?)`
  ).run(email, password ? hashPassword(password) : null, name, 'IN', 'INR', role, kyc, kyc === 'verified' ? name : null,
    kyc === 'verified' ? 'Placeholder ID (demo)' : null, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

/** Seed demo users and SAMPLE transactions. Safe to call once on an empty database. */
export function seedDemo(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return false;
  const fee = getFeeModel(db);
  const rateInfo = getRates(db);
  const { rates } = rateInfo;
  db.exec('BEGIN');
  try {
    const demoId = addUser(db, { email: DEMO_USER_EMAIL, name: 'Aarav Sharma' });
    addUser(db, { email: DEMO_ADMIN_EMAIL, name: 'Priya Admin', role: 'admin' });
    addUser(db, { email: DEMO_NEWUSER_EMAIL, name: 'Meera Iyer', kyc: 'not_started' });
    for (const t of USER_TXNS) insertTxn(db, demoId, t, rates, fee, rateInfo);
    for (const u of OTHER_USERS) {
      const id = addUser(db, { email: u.email, name: u.name });
      for (const t of u.txns) insertTxn(db, id, t, rates, fee, rateInfo);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.env.DATABASE_PATH || new URL('../../data/upi-bridge.db', import.meta.url).pathname;
  const db = openDb(path);
  console.log(seedDemo(db) ? `Seeded demo data into ${path}` : 'Database already has users; nothing seeded.');
}
