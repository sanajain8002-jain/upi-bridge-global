import { state, api, saveSession, demoLogin } from './api.js';
import { html, raw, icon, fmtDate, fmtNum, countryOf, flagEl } from './util.js';
import { countryPicker, wireCountrySearch, markCountrySelected, breakdown } from './components.js';
import { SCENARIOS } from './scenarios.js';

const go = (p) => { location.hash = '#' + p; };

// ---------------- Landing ----------------
export async function landing({ meta }) {
  const regions = [...new Set(meta.countries.map((c) => c.region))];
  const open = meta.countries.filter((c) => !c.restricted);
  const blocked = meta.countries.filter((c) => c.restricted);
  return {
    html: html`
    <div class="landing">
      <section class="hero">
        <div>
          <span class="sim-tag">PROPOSED SOLUTION · SIMULATED PROTOTYPE</span>
          <h1 style="margin-top:.8rem">Send money from UPI to the world, with the cost shown up front.</h1>
          <p class="lead">UPI Bridge Global demonstrates how Indian UPI users could send remittances to ${open.length} countries and ${new Set(open.map((c) => c.currency)).size} currencies: faster, with a fee target of ₹5 or less, and a clear view of the exchange rate before confirming.</p>
          <div class="row tight" style="margin:1.2rem 0">
            <button class="btn" data-demo="user">${icon('play', 18)} Try the live demo</button>
            <a class="btn secondary" href="#/rates">Fee calculator</a>
            <a class="btn ghost" href="#/guide">Guided scenarios →</a>
          </div>
          <p class="small muted">Every payment here is simulated. Real transfers need regulated payment partners, KYC/AML checks, supported corridors, and approval in each country.</p>
          <div id="landing-err"></div>
        </div>
        <div class="card hero-card">
          <div class="muted small">Illustrative example · SAMPLE rate</div>
          <div style="font-size:2rem;font-weight:800;margin:.3rem 0">₹10,000 → NPR 15,952</div>
          <div class="muted">Fee ₹5 (proposed target) · markup 0.3% shown separately · total ₹10,005</div>
          <hr style="border:0;border-top:1px solid rgba(255,255,255,.25);margin:1rem 0">
          <div class="small">${icon('lock', 15)} No UPI PINs, OTPs or bank passwords are ever requested.</div>
        </div>
      </section>

      <section class="grid cols-4" style="margin:1rem 0 2rem">
        ${[['zap', 'Fast, simulated flow', 'Pick a country, enter an amount, confirm: a complete end-to-end payment journey with a receipt.'],
           ['calc', 'Transparent costs', 'Fee, rate markup, total and the recipient amount are all shown before you confirm.'],
           ['brain', 'Risk assistant', 'Configurable rule-based checks flag transfers worth double-checking, never accusing anyone.'],
           ['id', 'KYC & compliance', 'A mock identity flow explains what regulated partners would require in the real world.']]
          .map(([i, t, d]) => html`<div class="card feature"><div class="icon">${icon(i)}</div><h3>${t}</h3><p class="muted small">${d}</p></div>`)}
      </section>

      <section class="card">
        <h2>${icon('globe', 22)} ${open.length} demo destinations across ${regions.length} regions</h2>
        <p class="muted">Launched with Nepal, Bangladesh, Sri Lanka and Bhutan, then extended to every country in the world. These are sample corridors for the prototype, not live payment routes, and rates are SAMPLE values.</p>
        ${regions.map((r) => { const list = open.filter((c) => c.region === r); return html`<details class="region-box" ${r === 'South Asia' ? raw('open') : ''}><summary><b>${r}</b> <span class="muted small">· ${list.length} countries</span></summary><div class="pill-row">${list.map((c) => html`<span class="pill">${flagEl(c)} ${c.name} · ${c.currency}</span>`)}</div></details>`; })}
        <p class="small muted" style="margin-top:1rem">${icon('shield', 14)} Blocked in this demo (comprehensive sanctions regimes): ${blocked.map((c) => c.name).join(', ')}. Real partners apply their own, legally reviewed lists for every corridor.</p>
      </section>
    </div>`,
    mount(el) {
      el.querySelector('[data-demo]').addEventListener('click', async (e) => {
        e.target.disabled = true;
        try { await demoLogin('user'); go('/guide'); } catch (err) {
          el.querySelector('#landing-err').innerHTML = `<div class="alert bad" style="margin-top:1rem">${err.message}</div>`;
          e.target.disabled = false;
        }
      });
    },
  };
}

// ---------------- Login / demo access ----------------
export async function login({ meta }) {
  let mode = 'login';
  const form = () => (mode === 'login'
    ? html`<form id="auth-form" novalidate>
        <div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="password">App password</label><input id="password" type="password" autocomplete="current-password" required></div>
        <button class="btn block" type="submit">Sign in</button></form>`
    : html`<form id="auth-form" novalidate>
        <div class="field"><label for="name">Full name</label><input id="name" autocomplete="name" required></div>
        <div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" required></div>
        <div class="row">
          <div class="field"><label for="country">Your country</label><select id="country"><option value="IN">India</option>${meta.countries.map((c) => html`<option value="${c.code}">${c.name}</option>`)}</select></div>
          <div class="field"><label for="cur">Preferred currency</label><select id="cur">${Object.entries(meta.currencies).map(([k, v]) => html`<option value="${k}">${k} · ${v.name}</option>`)}</select></div>
        </div>
        <div class="field"><label for="password">Choose an app password (8+ characters)</label><input id="password" type="password" autocomplete="new-password" required></div>
        <button class="btn block" type="submit">Create account</button></form>`);
  const view = () => html`
    <div class="landing" style="max-width:980px;padding-top:2rem">
      <div class="grid cols-2">
        <div class="card">
          <div class="tabs" role="tablist"><button class="${mode === 'login' ? 'active' : ''}" data-mode="login" role="tab">Sign in</button><button class="${mode === 'register' ? 'active' : ''}" data-mode="register" role="tab">Create account</button></div>
          <div id="auth-err" role="alert"></div>
          ${form()}
          <p class="small muted" style="margin-top:1rem">${icon('lock', 14)} This is an app-only demo password. Never enter a real bank password, UPI PIN or OTP here: this prototype never asks for them.</p>
        </div>
        <div class="card hero-card">
          <h2>Judge / demo access</h2>
          <p class="muted">${meta.demoMode ? 'One click, no password. Pre-loaded with SAMPLE transactions.' : 'Demo mode is disabled on this deployment.'}</p>
          <div style="display:grid;gap:.6rem;margin-top:1rem">
            <button class="btn secondary" data-demo="user" ${meta.demoMode ? '' : 'disabled'}>${icon('user', 18)} Demo user · Aarav Sharma (KYC verified)</button>
            <button class="btn secondary" data-demo="new" ${meta.demoMode ? '' : 'disabled'}>${icon('id', 18)} New demo user · Meera Iyer (try the KYC flow)</button>
            <button class="btn secondary" data-demo="admin" ${meta.demoMode ? '' : 'disabled'}>${icon('settings', 18)} Demo administrator · Priya</button>
          </div>
          <p class="small muted" style="margin-top:1rem">Not signed in? <a href="#/guide" style="color:#fff">Browse the guided scenarios</a> or <a href="#/rates" style="color:#fff">use the calculator</a>.</p>
        </div>
      </div>
    </div>`;
  return {
    html: view(),
    mount(el) {
      const rerender = () => { el.innerHTML = view().__raw; bind(); };
      const err = (m) => { el.querySelector('#auth-err').innerHTML = `<div class="alert bad">${m}</div>`; };
      const bind = () => {
        el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; rerender(); }));
        el.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', async () => {
          b.disabled = true;
          try { const u = await demoLogin(b.dataset.demo); go(u.role === 'admin' ? '/admin' : '/dashboard'); }
          catch (e) { err(e.message); b.disabled = false; }
        }));
        el.querySelector('#auth-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const v = (id) => el.querySelector('#' + id)?.value;
          const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
          try {
            const r = mode === 'login'
              ? await api('/api/auth/login', { method: 'POST', body: { email: v('email'), password: v('password') } })
              : await api('/api/auth/register', { method: 'POST', body: { name: v('name'), email: v('email'), password: v('password'), country: v('country'), preferredCurrency: v('cur') } });
            saveSession(r.token, r.user);
            go('/dashboard');
          } catch (ex) { err(ex.message); btn.disabled = false; }
        });
      };
      bind();
    },
  };
}

// ---------------- Rates & fee calculator (public) ----------------
export async function rates({ meta, query }) {
  const ratesData = await api('/api/rates');
  let country = query.country || 'NP';
  let amount = query.amount || '10000';
  const view = (quoteHtml) => html`
    <div class="${state.user ? '' : 'landing'}" style="${state.user ? '' : 'padding-top:2rem'}">
      <div class="page-head"><div><h1>Exchange rate &amp; fee calculator</h1><p class="muted">See exactly what you'd pay and what arrives, before confirming anything.</p></div></div>
      <div class="alert info">${icon('info', 16)} ${ratesData.label}. Last updated ${fmtDate(ratesData.updatedAt)}. The ₹5 fee is a <b>proposed target</b>, not a guaranteed real-world price.</div>
      <div class="grid cols-2">
        <div class="card">
          <div class="field"><label for="amt">Amount to send (INR)</label><input id="amt" inputmode="decimal" value="${amount}"></div>
          <div id="calc-err"></div>
          <label>Destination</label>
          <div id="picker">${countryPicker(meta, country)}</div>
        </div>
        <div class="card" id="quote-box">${quoteHtml}</div>
      </div>
      <div class="card" style="margin-top:1rem">
        <h2>All sample rates (per 1 INR)</h2>
        <input type="search" data-table-filter placeholder="Filter ${ratesData.rates.length - 1} currencies (e.g. JPY, dirham)" aria-label="Filter currencies">
        <div class="table-wrap" style="max-height:420px;overflow:auto;margin-top:.6rem"><table><thead><tr><th>Currency</th><th class="right">Rate</th><th>Source</th><th>Updated</th></tr></thead><tbody>
          ${ratesData.rates.filter((r) => r.currency !== 'INR').map((r) => html`<tr data-q="${(r.currency + ' ' + (meta.currencies[r.currency]?.name || '')).toLowerCase()}"><td>${r.currency} · ${meta.currencies[r.currency]?.name}</td><td class="right">${fmtNum(r.perInr, 4)}</td><td>${r.source === 'live' ? 'Live' : 'SAMPLE'}</td><td>${fmtDate(r.updatedAt)}</td></tr>`)}
        </tbody></table></div>
      </div>
    </div>`;
  const placeholder = html`<p class="muted">Enter an amount to see the breakdown.</p>`;
  return {
    html: view(placeholder),
    mount(el) {
      const box = el.querySelector('#quote-box');
      let timer;
      const calc = async () => {
        const amt = el.querySelector('#amt').value.trim();
        try {
          const q = await api('/api/quote', { method: 'POST', body: { amount: amt, country } });
          el.querySelector('#calc-err').innerHTML = '';
          box.innerHTML = breakdown(q, meta).__raw;
        } catch (e) {
          el.querySelector('#calc-err').innerHTML = `<div class="alert bad">${e.message}</div>`;
        }
      };
      el.querySelector('#amt').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(calc, 250); });
      el.querySelector('#picker').addEventListener('click', (e) => {
        const b = e.target.closest('[data-country]'); if (!b) return;
        country = b.dataset.country;
        markCountrySelected(el.querySelector('#picker'), meta, country);
        calc();
      });
      wireCountrySearch(el.querySelector('#picker'));
      calc();
    },
  };
}

// ---------------- Guided demo ----------------
export async function guide({ meta }) {
  const card = (s) => { const c = countryOf(meta, s.country); return html`
    <div class="card">
      <div class="row" style="align-items:center;justify-content:space-between"><h3 style="margin:0">${flagEl(c)} ${s.title}</h3>${s.featured ? html`<span class="badge neutral">South Asia launch</span>` : s.risk ? html`<span class="badge medium">risk demo</span>` : ''}</div>
      <p class="muted small" style="margin:.4rem 0">${s.blurb}</p>
      <p class="small" style="margin:.2rem 0 .8rem">₹${s.amount.toLocaleString('en-IN')} → ${c.currency} · recipient <b>${s.name}</b> (fictional)</p>
      <button class="btn small" data-run="${s.key}">${icon('play', 15)} Run scenario</button>
    </div>`; };
  return {
    html: html`
    <div class="landing" style="padding-top:2rem">
      <div class="page-head"><div><h1>Guided demonstration</h1><p class="muted">Each scenario signs you in as the demo user and pre-fills a simulated transfer. Walk through: destination → amount → rate &amp; fee → risk check → confirm → receipt → dashboard.</p></div></div>
      <div class="alert info">${icon('info', 16)} All recipients are fictional. All payments are simulated and no real money moves. <span id="guide-err"></span></div>
      <h2>South Asia launch corridors</h2>
      <div class="grid cols-4" style="margin-bottom:1.5rem">${SCENARIOS.filter((s) => s.featured).map(card)}</div>
      <h2>Around the world</h2>
      <div class="grid cols-4" style="margin-bottom:1.5rem">${SCENARIOS.filter((s) => !s.featured && !s.risk).map(card)}</div>
      <h2>Fraud-risk assistant</h2>
      <div class="grid cols-4">${SCENARIOS.filter((s) => s.risk).map(card)}</div>
    </div>`,
    mount(el) {
      el.querySelectorAll('[data-run]').forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          if (!state.user) await demoLogin('user');
          go(`/send?scenario=${b.dataset.run}`);
        } catch (e) { el.querySelector('#guide-err').textContent = e.message; b.disabled = false; }
      }));
    },
  };
}

// ---------------- About & compliance ----------------
export async function about({ meta }) {
  return {
    html: html`
    <div class="${state.user ? '' : 'landing'}" style="${state.user ? '' : 'padding-top:2rem'}">
      <div class="page-head"><div><h1>About &amp; compliance</h1><p class="muted">What this prototype is, and what a real launch would need.</p></div></div>
      <div class="alert warn"><b>This is a hackathon prototype.</b> It demonstrates a <i>proposed</i> cross-border payment experience with simulated transactions. Real transfers are not available in any country listed here.</div>
      <div class="grid cols-2">
        <div class="card"><h2>${icon('check', 20)} What the demo shows</h2>
          <ul><li>A complete simulated payment journey with receipts and a persistent transaction history.</li>
          <li>Currency conversion across ${Object.keys(meta.currencies).length} currencies (INR plus ${meta.countries.length} destinations), rounded to each currency's convention (e.g. JPY has no decimals).</li>
          <li>A configurable fee model: flat fee, percentage, and exchange-rate markup, always shown separately.</li>
          <li>A transparent, rule-based risk assistant and a mock KYC flow.</li>
          <li>Role-based admin tools: review flags, edit sample rates and fees, export CSV.</li></ul></div>
        <div class="card"><h2>${icon('x', 20)} What it does not do</h2>
          <ul><li>It does not move real money or connect to UPI, banks or card networks.</li>
          <li>It does not use live exchange rates unless an exchange-rate API is configured; sample rates are labelled as such.</li>
          <li>The ₹5-or-less fee is a <b>proposed target</b>, not a guaranteed price.</li>
          <li>It never collects UPI PINs, OTPs, bank credentials or real identity documents.</li></ul></div>
      </div>
      <div class="card" style="margin-top:1rem"><h2>${icon('shield', 20)} What a real launch would require</h2>
        <ul>
          <li><b>Regulated payment partners</b> in both the sending and receiving countries, and agreements with participating payment networks.</li>
          <li><b>KYC and anti-money-laundering (AML) checks</b> performed by licensed providers, plus sanctions screening and transaction monitoring.</li>
          <li><b>Compliance with each country's laws</b>: foreign-exchange rules, licensing for remittance or payment services, reporting duties, and consumer-protection requirements.</li>
          <li><b>Supported payment corridors</b> and settlement infrastructure: a rate and fee can only be offered where a live, licensed route exists.</li>
          <li><b>Security and privacy governance</b>: audited infrastructure, data-protection compliance, dispute handling and customer support.</li>
        </ul>
        <p class="muted small">Adding more destination countries to the demo changes nothing about this: each corridor would need its own approvals and partners before any real transfer could happen.</p></div>
      <div class="card" style="margin-top:1rem"><h2>${icon('lock', 20)} Security notes for this prototype</h2>
        <ul><li>All inputs are validated on the server; roles are checked on the server from the database for every admin request.</li>
        <li>Passwords are salted and hashed (scrypt); sessions are signed and expire; secrets live in environment variables.</li>
        <li>Transaction status is always decided by the server's simulated gateway, never by a client-side "paid" flag.</li>
        <li>CSV export neutralises spreadsheet formula injection. For production, move to a managed auth provider (e.g. Supabase Auth) and httpOnly cookies.</li></ul></div>
    </div>`,
  };
}
