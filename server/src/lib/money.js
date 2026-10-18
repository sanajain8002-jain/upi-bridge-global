import { CURRENCIES, COUNTRIES } from '../config.js';

export function currencyDecimals(code) {
  const c = CURRENCIES[code];
  if (!c) throw new Error(`Unsupported currency: ${code}`);
  return c.decimals;
}

/** Round a numeric amount to the minor-unit convention of a currency (half away from zero). */
export function roundToCurrency(value, code) {
  const d = currencyDecimals(code);
  const f = 10 ** d;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * f) / f;
}

/** Convert INR paise (integer) into an INR amount rounded to 2dp. */
export function toPaise(inr) {
  return Math.round(Number(inr) * 100);
}

export function fromPaise(paise) {
  return paise / 100;
}

/**
 * Build a full quote. All INR arithmetic happens in integer paise to avoid float drift.
 * rates: { CODE: units per 1 INR }, fee: fee model object.
 *
 *  - midRate: sample mid-market rate
 *  - markup: percent of the sent amount taken via a worse effective rate (shown separately from fee)
 *  - effectiveRate = midRate * (1 - markup%)
 *  - recipientAmount = amount * effectiveRate rounded to destination currency convention
 *  - totalPayable = amount + transferFee
 */
export function buildQuote({ amountInr, countryCode, rates, fee, rateUpdatedAt, rateSource }) {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  if (!country) throw new Error('Unsupported destination country');
  const cur = country.currency;
  const mid = rates[cur];
  if (!(mid > 0)) throw new Error(`No rate available for ${cur}`);

  const amountPaise = toPaise(amountInr);
  const flatPaise = toPaise(fee.flat_fee_inr);
  const pctPaise = Math.round((amountPaise * fee.percent_fee) / 100);
  const feePaise = flatPaise + pctPaise;
  const markupPaise = Math.round((amountPaise * fee.markup_percent) / 100);

  const effectiveRate = mid * (1 - fee.markup_percent / 100);
  const recipientAmount = roundToCurrency((amountPaise / 100) * effectiveRate, cur);
  const recipientAtMid = roundToCurrency((amountPaise / 100) * mid, cur);

  return {
    country: country.code,
    countryName: country.name,
    sendCurrency: 'INR',
    receiveCurrency: cur,
    amountInr: fromPaise(amountPaise),
    midRate: mid,
    effectiveRate: Number(effectiveRate.toPrecision(8)),
    markupPercent: fee.markup_percent,
    markupCostInr: fromPaise(markupPaise),
    transferFeeInr: fromPaise(feePaise),
    totalPayableInr: fromPaise(amountPaise + feePaise),
    recipientAmount,
    recipientAmountAtMid: recipientAtMid,
    rateUpdatedAt,
    rateSource,
    rateIsSample: rateSource !== 'live',
    disclaimer:
      'Illustrative sample rates and a proposed fee target for a simulated demo. Not a live market rate or a guaranteed price.',
  };
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateTransactionId(randomBytes, now = new Date()) {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  let suffix = '';
  const bytes = randomBytes(8);
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `UBG-${ymd}-${suffix}`;
}
