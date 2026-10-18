# API reference

Base URL `http://localhost:3000`. JSON in/out. Errors: `{ "error": "message", "field": "optional" }` with 400/401/403/404/429.
Auth: `Authorization: Bearer <token>` (from register/login/demo). **Every payment is simulated.**

## Public
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ ok, simulated }` |
| GET | `/api/meta` | 194 countries (`code,name,currency,region,featured?,restricted?,restrictedReason?`), 144 currencies (`name,symbol,decimals`), limits, rate label |
| GET | `/api/rates` | Sample rates per 1 INR, source (`sample`/`live`), `updatedAt` |
| POST | `/api/quote` | `{ amount, country }` → rate, markup, fee, total payable, recipient amount. 400 for restricted/unknown country or amount outside limits |
| POST | `/api/auth/register` | `{ email, password, name }` (app password only; never a bank password/PIN/OTP) |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/demo` | `{ role: "user"|"admin"|"new" }` – only if `DEMO_MODE` is on |

## Signed-in user
| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/me` · PATCH `/api/auth/profile` | name, country, preferred currency |
| POST | `/api/risk/assess` | Same body as a transfer; returns `level, score, reasons[], suggestedStep, engine` |
| POST | `/api/transfers` | `{ amount, country, recipientName, identifier, outcome }` – `outcome` (`successful`/`pending`/`failed`) is a **demo control** for the mock gateway; the server prices the quote itself and decides the status. Returns 201 `{ transaction, risk, quote, simulated:true }` |
| GET | `/api/transfers` | Filters `country, status, from, to, q, page, pageSize` |
| GET | `/api/transfers/:txnId` | Receipt (own transactions only) |
| GET | `/api/summary` · `/api/alerts` | Dashboard totals; own risk alerts |
| GET | `/api/kyc` · POST `/api/kyc/submit` · `/advance` · `/reset` | Mock KYC: not_started → submitted → under_review → verified. Unverified users are capped per transfer |

## Admin (role `admin`)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/stats` · `/transactions` · `/alerts` | Stats per destination country, all transactions, flagged payments |
| PATCH | `/api/admin/alerts/:id` | Review flagged payment (`cleared`/`escalated`) |
| PATCH | `/api/admin/transactions/:txnId/status` | Settle a pending demo payment |
| PUT | `/api/admin/rates/:currency` | `{ rate }` – sample rate per 1 INR (snapshot recorded) |
| POST | `/api/admin/rates/refresh` | Pull indicative rates from `EXCHANGE_RATE_API_URL` |
| GET/PUT | `/api/admin/fee` | `flat_fee_inr, percent_fee, markup_percent, min/max_amount_inr, unverified_limit_inr` |
| GET | `/api/admin/export.csv` | CSV (spreadsheet-formula-injection safe, rates labelled SAMPLE) |

## Demo outcome triggers
`outcome: "failed"` → failed with reason; `"pending"` → pending (admin can settle). Medium/high risk scores additionally create a flagged-payment alert for the admin to review; they do not change the status.
