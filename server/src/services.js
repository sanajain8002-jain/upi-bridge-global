import { randomBytes } from 'node:crypto';
import { COUNTRIES, KYC_STAGES } from './config.js';
import { getSetting } from './db.js';
import { buildQuote, generateTransactionId } from './lib/money.js';
import { assessRisk } from './lib/risk.js';
import { ValidationError } from './lib/validate.js';

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getFeeModel(db) {
  return getSetting(db, 'fee_model');
}

export function getRates(db) {
  const rows = db.prepare('SELECT currency, per_inr, source, updated_at FROM rates').all();
  const rates = {};
  let updatedAt = null;
  let allLive = rows.length > 0;
  for (const r of rows) {
    rates[r.currency] = r.per_inr;
    if (!updatedAt || r.updated_at > updatedAt) updatedAt = r.updated_at;
    if (r.source !== 'live') allLive = false;
  }
  return { rates, updatedAt, source: allLive ? 'live' : 'sample', rows };
}

export function quote(db, amountInr, country) {
  const { rates, updatedAt, source } = getRates(db);
  return buildQuote({ amountInr, countryCode: country, rates, fee: getFeeModel(db), rateUpdatedAt: updatedAt, rateSource: source });
}

const parseTxn = (t) => (t ? { ...t, simulated: !!t.simulated } : t);

export function userHistory(db, userId, limit = 100) {
  return db.prepare('SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT ?').all(userId, limit);
}

export function riskCheck(db, user, { amountInr, recipientName, identifier }, now = Date.now()) {
  const history = userHistory(db, user.id);
  const identifierHistory = db
    .prepare('SELECT recipient_name FROM transactions WHERE recipient_identifier=? ORDER BY created_at DESC LIMIT 20')
    .all(identifier);
  return assessRisk({ amountInr, recipientName, identifier, history, identifierHistory, now });
}

/**
 * Create a SIMULATED transfer. The status is decided on the server (never from a client-supplied
 * "paid" flag). `outcome` is a demo control that picks which simulated result the mock gateway returns.
 */
export function createTransfer(db, user, { amountInr, country, recipientName, identifier, outcome }) {
  const fee = getFeeModel(db);
  if (user.kyc_stage !== 'verified' && amountInr > fee.unverified_limit_inr) {
    throw new HttpError(
      403,
      `Demo accounts without completed KYC are limited to ₹${fee.unverified_limit_inr.toLocaleString('en-IN')} per transfer. Complete the KYC demo first.`,
      'KYC_REQUIRED'
    );
  }
  const q = quote(db, amountInr, country);
  const risk = riskCheck(db, user, { amountInr, recipientName, identifier });
  const nowIso = new Date().toISOString();
  const txnId = generateTransactionId(randomBytes);
  const failureReason = outcome === 'failed' ? 'Simulated failure: the mock destination bank declined the payment (demo).' : null;

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO transactions (txn_id,user_id,country,receive_currency,recipient_name,recipient_identifier,amount_inr,mid_rate,effective_rate,
        markup_percent,markup_cost_inr,fee_inr,total_payable_inr,recipient_amount,rate_source,rate_updated_at,status,failure_reason,risk_level,risk_score,simulated,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`
    ).run(
      txnId, user.id, q.country, q.receiveCurrency, recipientName, identifier, q.amountInr, q.midRate, q.effectiveRate,
      q.markupPercent, q.markupCostInr, q.transferFeeInr, q.totalPayableInr, q.recipientAmount, q.rateSource, q.rateUpdatedAt,
      outcome, failureReason, risk.level, risk.score, nowIso, nowIso
    );
    if (risk.level !== 'low') insertAlert(db, txnId, user.id, risk, nowIso);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { transaction: getTransaction(db, txnId), risk, quote: q };
}

export function insertAlert(db, txnId, userId, risk, createdAt) {
  db.prepare(
    'INSERT INTO risk_alerts (txn_id,user_id,level,score,reasons,suggested_step,engine,created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).run(txnId, userId, risk.level, risk.score, JSON.stringify(risk.reasons), risk.suggestedStep, risk.engine, createdAt);
}

export function getTransaction(db, txnId) {
  return parseTxn(db.prepare('SELECT t.*, u.name AS sender_name, u.email AS sender_email FROM transactions t JOIN users u ON u.id=t.user_id WHERE txn_id=?').get(txnId));
}

export function updateStatus(db, txnId, status, reason = null) {
  const t = getTransaction(db, txnId);
  if (!t) throw new HttpError(404, 'Transaction not found.');
  if (t.status !== 'pending') throw new HttpError(409, 'Only pending transactions can change status.');
  if (status === 'pending') throw new ValidationError('Choose successful or failed.', 'status');
  db.prepare('UPDATE transactions SET status=?, failure_reason=?, updated_at=? WHERE txn_id=?').run(
    status,
    status === 'failed' ? reason || 'Simulated failure set by demo administrator.' : null,
    new Date().toISOString(),
    txnId
  );
  return getTransaction(db, txnId);
}

/** Build a WHERE clause for transaction filters. userId=null means all users (admin). */
function filterSql({ userId, country, status, from, to, q }) {
  const where = [];
  const params = [];
  if (userId != null) { where.push('t.user_id=?'); params.push(userId); }
  if (country) { where.push('t.country=?'); params.push(country); }
  if (status) { where.push('t.status=?'); params.push(status); }
  if (from) { where.push('t.created_at >= ?'); params.push(`${from}T00:00:00.000Z`); }
  if (to) { where.push('t.created_at <= ?'); params.push(`${to}T23:59:59.999Z`); }
  if (q) { where.push('(t.txn_id LIKE ? OR t.recipient_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

export function listTransactions(db, filters, { page = 1, pageSize = 20 } = {}) {
  const { sql, params } = filterSql(filters);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM transactions t ${sql}`).get(...params).n;
  const rows = db
    .prepare(`SELECT t.*, u.name AS sender_name, u.email AS sender_email FROM transactions t JOIN users u ON u.id=t.user_id ${sql} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);
  return { total, page, pageSize, rows: rows.map(parseTxn) };
}

export function allTransactionsForExport(db, filters) {
  const { sql, params } = filterSql(filters);
  return db
    .prepare(`SELECT t.*, u.email AS sender_email FROM transactions t JOIN users u ON u.id=t.user_id ${sql} ORDER BY t.created_at DESC`)
    .all(...params);
}

export function summary(db, userId) {
  const { sql, params } = filterSql({ userId });
  const base = `FROM transactions t ${sql}`;
  const totals = db.prepare(
    `SELECT COUNT(*) AS count,
       COALESCE(SUM(CASE WHEN status='successful' THEN amount_inr END),0) AS sent_inr,
       COALESCE(SUM(CASE WHEN status='successful' THEN fee_inr END),0) AS fees_inr,
       SUM(status='successful') AS successful, SUM(status='pending') AS pending, SUM(status='failed') AS failed ${base}`
  ).get(...params);
  const byCountry = db.prepare(
    `SELECT country, COUNT(*) AS count, COALESCE(SUM(CASE WHEN status='successful' THEN amount_inr END),0) AS sent_inr ${base} GROUP BY country ORDER BY sent_inr DESC`
  ).all(...params);
  return {
    count: totals.count,
    sentInr: totals.sent_inr,
    feesInr: totals.fees_inr,
    successful: totals.successful || 0,
    pending: totals.pending || 0,
    failed: totals.failed || 0,
    byCountry: byCountry.map((r) => ({ ...r, countryName: COUNTRIES.find((c) => c.code === r.country)?.name || r.country })),
  };
}

export function adminStats(db) {
  const s = summary(db, null);
  const perCountry = db.prepare(
    `SELECT country, COUNT(*) AS count,
      SUM(status='successful') AS successful, SUM(status='pending') AS pending, SUM(status='failed') AS failed,
      COALESCE(SUM(CASE WHEN status='successful' THEN amount_inr END),0) AS sent_inr,
      COALESCE(SUM(CASE WHEN status='successful' THEN fee_inr END),0) AS fees_inr,
      SUM(risk_level!='low') AS flagged
     FROM transactions GROUP BY country ORDER BY sent_inr DESC`
  ).all();
  return {
    ...s,
    perCountry: perCountry.map((r) => ({
      ...r,
      countryName: COUNTRIES.find((c) => c.code === r.country)?.name || r.country,
      successful: r.successful || 0, pending: r.pending || 0, failed: r.failed || 0, flagged: r.flagged || 0,
    })),
    openAlerts: db.prepare("SELECT COUNT(*) AS n FROM risk_alerts WHERE review_status='open'").get().n,
    users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
  };
}

export function listAlerts(db, { userId = null, status = null } = {}) {
  const where = [];
  const params = [];
  if (userId != null) { where.push('a.user_id=?'); params.push(userId); }
  if (status) { where.push('a.review_status=?'); params.push(status); }
  const rows = db.prepare(
    `SELECT a.*, t.amount_inr, t.country, t.recipient_name, t.status AS txn_status, u.email AS sender_email
     FROM risk_alerts a JOIN transactions t ON t.txn_id=a.txn_id JOIN users u ON u.id=a.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.created_at DESC LIMIT 200`
  ).all(...params);
  return rows.map((r) => ({ ...r, reasons: JSON.parse(r.reasons) }));
}

// ---- KYC demo (fictional identities and placeholder documents only) ----
export function nextKycStage(stage) {
  const i = KYC_STAGES.indexOf(stage);
  return i >= 0 && i < KYC_STAGES.length - 1 ? KYC_STAGES[i + 1] : stage;
}
