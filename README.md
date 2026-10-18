# UPI Bridge Global

A hackathon prototype showing how Indian UPI users **could** send money to **any country in the world** (190 destinations, 143 currencies, started from Nepal, Bangladesh, Sri Lanka and Bhutan). **Everything is simulated**: sample exchange rates, a proposed ₹5 fee target, a mock payment gateway, fictional KYC. No live corridors exist; real transfers would need regulated payment partners, KYC/AML, and approval in every country involved.

## Run it (no install, no dependencies)
Requires Node.js 22.13+.
```bash
cp .env.example .env      # optional; a random session secret is used if missing
npm start                 # http://localhost:3000  (seeds SAMPLE data on first run)
npm test                  # 38 tests
npm run reset-db          # wipe local data
```
Zero npm dependencies: the API uses Node's built-in `http` and `node:sqlite`; the UI is plain ES modules.

## Demo accounts (buttons on the Sign-in page)
| Account | Use |
|---|---|
| Demo user – Aarav Sharma (KYC verified) | Normal sending, dashboard, history |
| New demo user – Meera Iyer | Try the KYC flow; unverified users are capped at ₹10,000 per transfer |
| Demo administrator – Priya | Admin dashboard: flags, rates, fee, per-country stats, CSV export |

Demo accounts have no passwords. Real sign-up (email + password) also works; the password is only for this app. Never enter a bank password, UPI PIN or OTP.

## Guided demo
Open **Guided demo**. Run the Nepal scenario first (destination → amount → rate & fee → risk check → confirm → receipt → dashboard), then Bangladesh, Sri Lanka, Bhutan, and the world scenarios (Brazil, Nigeria, Kuwait for 3-decimal rounding, Japan for zero-decimal, Germany for euro). The **Risk assistant demo** flags a large amount to an identifier already used with another name. On the confirm step, choose *failed* or *pending* to show those outcomes.

## What "whole world" means here
- 194 sovereign states in the data; 190 selectable. Cuba, Iran, North Korea and Syria are shown as **blocked** (illustrative sanctions handling; a real partner uses its own legal lists).
- Currency names, symbols and decimals (JPY 0, KWD 3, …) come from the runtime's Intl data. Sample rates for every currency live in `server/src/world.js` (per USD) and are converted to per-INR; the admin can edit any of them.
- Adding a country = one line in `COUNTRY_TABLE` in `server/src/world.js` (plus a sample rate if it's a new currency).

## Structure
```
server/src/   app.js (routes, RBAC, security headers) · services.js · lib/{money,risk,validate,auth,csv}.js · config.js · world.js · db.js · seed.js
server/test/  money, risk, world coverage, API integration tests
client/       index.html · styles.css · js/ (views, components, api) · vendor/flag-icons (MIT, bundled SVG flags)
db/schema.sql PostgreSQL/Supabase equivalent of the SQLite schema
docs/API.md   endpoint reference
```

## Deploy
Any Node 22 host (Render, Railway, Fly.io): start command `npm start`, set `SESSION_SECRET`, `DEMO_MODE=true` for judges, and mount a disk for `DATABASE_PATH`. For Postgres/Supabase, apply `db/schema.sql` and port the small query layer in `services.js`/`db.js`.

## Honest limits
- Fraud checks are rule-based and transparent; there is no AI API wired in (the response has an `aiExplanation: null` placeholder). It flags for verification, never accuses.
- Sample rates are hand-entered approximations, not market data. Set `EXCHANGE_RATE_API_URL` to pull indicative rates.
- The ₹5 fee is a proposed target, not a real price. No real payment processing exists or should be added without regulated, authorised sandbox access.
