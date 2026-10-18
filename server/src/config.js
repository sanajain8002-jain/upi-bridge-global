// Static configuration: supported corridors and SAMPLE exchange rates.
// All rates are ILLUSTRATIVE SAMPLE values (foreign units per 1 INR), not live market rates.

import { buildWorldCountries, SAMPLE_PER_USD } from './world.js';

export const BASE_CURRENCY = 'INR';

// decimals = minor-unit digits used when rounding amounts in that currency.
const CURATED_CURRENCIES = {
  INR: { name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  NPR: { name: 'Nepalese Rupee', symbol: 'Rs', decimals: 2 },
  BDT: { name: 'Bangladeshi Taka', symbol: '৳', decimals: 2 },
  LKR: { name: 'Sri Lankan Rupee', symbol: 'Rs', decimals: 2 },
  BTN: { name: 'Bhutanese Ngultrum', symbol: 'Nu.', decimals: 2 },
  USD: { name: 'US Dollar', symbol: '$', decimals: 2 },
  GBP: { name: 'Pound Sterling', symbol: '£', decimals: 2 },
  EUR: { name: 'Euro', symbol: '€', decimals: 2 },
  AED: { name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
  SAR: { name: 'Saudi Riyal', symbol: '﷼', decimals: 2 },
  QAR: { name: 'Qatari Riyal', symbol: 'QR', decimals: 2 },
  KWD: { name: 'Kuwaiti Dinar', symbol: 'KD', decimals: 3 },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  THB: { name: 'Thai Baht', symbol: '฿', decimals: 2 },
  PHP: { name: 'Philippine Peso', symbol: '₱', decimals: 2 },
  IDR: { name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 0 },
  JPY: { name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  AUD: { name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  CAD: { name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  BRL: { name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  MXN: { name: 'Mexican Peso', symbol: 'MX$', decimals: 2 },
  ZAR: { name: 'South African Rand', symbol: 'R', decimals: 2 },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2 },
  NGN: { name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
};

// Every sovereign state except India (the sender). Regions group them in the UI; "featured" marks the original
// South Asia launch corridors; "restricted" corridors are blocked in this demo (see world.js).
export const COUNTRIES = buildWorldCountries();

// SAMPLE mid-market rates: units of destination currency per 1 INR. Editable by the demo admin.
const CURATED_RATES = {
  INR: 1,
  NPR: 1.6,
  BDT: 1.37,
  LKR: 3.45,
  BTN: 1.0,
  USD: 0.0118,
  GBP: 0.0088,
  EUR: 0.0102,
  AED: 0.0433,
  SAR: 0.0443,
  QAR: 0.043,
  KWD: 0.0036,
  SGD: 0.0152,
  MYR: 0.05,
  THB: 0.385,
  PHP: 0.68,
  IDR: 197,
  JPY: 1.75,
  AUD: 0.0182,
  CAD: 0.0163,
  CHF: 0.0094,
  BRL: 0.064,
  MXN: 0.22,
  ZAR: 0.21,
  KES: 1.53,
  NGN: 17.7,
};

// ---- Expand to the whole world -------------------------------------------------------------
// Currency metadata (name, symbol, minor-unit digits) comes from the runtime's Intl data; the curated
// entries above take precedence. Sample rates for the rest are derived from SAMPLE_PER_USD via USD/INR.
const USD_PER_INR = CURATED_RATES.USD;
const names = new Intl.DisplayNames('en', { type: 'currency' });
function intlMeta(code) {
  try {
    const nf = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' });
    return {
      name: names.of(code) || code,
      symbol: nf.formatToParts(0).find((p) => p.type === 'currency')?.value || code,
      decimals: nf.resolvedOptions().maximumFractionDigits,
    };
  } catch {
    return { name: code, symbol: code, decimals: 2 };
  }
}

export const CURRENCIES = { ...CURATED_CURRENCIES };
export const SAMPLE_RATES = { ...CURATED_RATES };
for (const { currency } of COUNTRIES) {
  if (!CURRENCIES[currency]) CURRENCIES[currency] = intlMeta(currency);
  if (SAMPLE_RATES[currency] === undefined) {
    const perUsd = SAMPLE_PER_USD[currency];
    if (!perUsd) throw new Error(`Missing sample rate for ${currency}`);
    SAMPLE_RATES[currency] = Number((perUsd * USD_PER_INR).toPrecision(6));
  }
}


// Configurable fee model (stored in the settings table; these are the seeded defaults).
// flat_fee_inr = 5 reflects the PROPOSED target of ₹5 or less - not a guaranteed real price.
export const DEFAULT_FEE_MODEL = {
  flat_fee_inr: 5,
  percent_fee: 0, // percent of amount, e.g. 0.1 = 0.1%
  markup_percent: 0.3, // exchange-rate markup, shown separately from the fee
  min_amount_inr: 100,
  max_amount_inr: 200000,
  unverified_limit_inr: 10000,
};

export const SESSION_TTL_SECONDS = 60 * 60 * 8;
export const STATUSES = ['pending', 'successful', 'failed'];
export const KYC_STAGES = ['not_started', 'submitted', 'under_review', 'verified'];
