import { COUNTRIES, CURRENCIES, KYC_STAGES, STATUSES } from '../config.js';

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.status = 400;
    this.field = field;
  }
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]{1,79}$/u;
const IDENT_RE = /^[A-Za-z0-9@._-]{6,40}$/;

export function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

export function validateEmail(v) {
  const e = str(v).toLowerCase();
  if (!EMAIL_RE.test(e)) throw new ValidationError('Enter a valid email address.', 'email');
  return e;
}

export function validatePassword(v) {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128)
    throw new ValidationError('Password must be 8–128 characters.', 'password');
  return v;
}

export function validateName(v, field = 'name') {
  const n = str(v).replace(/\s+/g, ' ');
  if (!NAME_RE.test(n)) throw new ValidationError('Enter a valid name (letters only, 2–80 characters).', field);
  return n;
}

export function validateCountryCode(v, field = 'country') {
  const code = str(v).toUpperCase();
  if (!COUNTRIES.some((c) => c.code === code) && code !== 'IN')
    throw new ValidationError('Unsupported country.', field);
  return code;
}

export function validateCurrency(v) {
  const c = str(v).toUpperCase();
  if (!CURRENCIES[c]) throw new ValidationError('Unsupported currency.', 'currency');
  return c;
}

export function validateDestination(v) {
  const code = str(v).toUpperCase();
  const c = COUNTRIES.find((x) => x.code === code);
  if (!c) throw new ValidationError('Choose a supported destination country.', 'country');
  if (c.restricted)
    throw new ValidationError(`Transfers to ${c.name} are blocked in this demo (${c.restrictedReason}). Real corridors depend on the laws and sanctions rules that regulated partners must follow.`, 'country');
  return code;
}

export function validateIdentifier(v) {
  const id = str(v);
  if (!IDENT_RE.test(id))
    throw new ValidationError('Payment identifier must be 6–40 characters (letters, numbers, @ . _ -).', 'identifier');
  return id;
}

export function validateAmount(v, fee) {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new ValidationError('Enter a valid amount.', 'amount');
  if (Math.round(n * 100) / 100 !== n) throw new ValidationError('Amount can have at most 2 decimal places.', 'amount');
  if (n < fee.min_amount_inr) throw new ValidationError(`Minimum transfer is ₹${fee.min_amount_inr}.`, 'amount');
  if (n > fee.max_amount_inr)
    throw new ValidationError(`Maximum transfer is ₹${fee.max_amount_inr.toLocaleString('en-IN')}.`, 'amount');
  return n;
}

export function validateStatus(v) {
  const s = str(v);
  if (!STATUSES.includes(s)) throw new ValidationError('Invalid status.', 'status');
  return s;
}

export function validateOutcome(v) {
  const s = str(v) || 'successful';
  if (!STATUSES.includes(s)) throw new ValidationError('Invalid simulated outcome.', 'outcome');
  return s;
}

export function validateKycStage(v) {
  const s = str(v);
  if (!KYC_STAGES.includes(s)) throw new ValidationError('Invalid KYC stage.', 'stage');
  return s;
}

export function validateDate(v, field) {
  if (v === undefined || v === null || v === '') return null;
  const s = str(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new ValidationError('Use YYYY-MM-DD dates.', field);
  return s;
}

export function validateFeeModel(body, current) {
  const out = { ...current };
  const rules = {
    flat_fee_inr: [0, 500],
    percent_fee: [0, 5],
    markup_percent: [0, 10],
    min_amount_inr: [1, 1000000],
    max_amount_inr: [1, 10000000],
    unverified_limit_inr: [1, 10000000],
  };
  for (const [k, [lo, hi]] of Object.entries(rules)) {
    if (body[k] === undefined) continue;
    const n = Number(body[k]);
    if (!Number.isFinite(n) || n < lo || n > hi) throw new ValidationError(`${k} must be between ${lo} and ${hi}.`, k);
    out[k] = n;
  }
  if (out.min_amount_inr >= out.max_amount_inr) throw new ValidationError('Minimum must be below maximum.', 'min_amount_inr');
  return out;
}

export function validateRate(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1e6) throw new ValidationError('Rate must be a positive number.', 'rate');
  return n;
}
