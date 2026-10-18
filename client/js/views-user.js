import { state, api } from './api.js';
import { html, raw, icon, fmtInr, fmtMoney, fmtDate, badge, statusLabel, countryOf, simTag, esc, flagEl, countryOptions } from './util.js';
import { stepper, countryPicker, wireCountrySearch, markCountrySelected, breakdown, riskCard, txnTable, wireRows, receiptBody } from './components.js';
import { SCENARIOS } from './scenarios.js';

const go = (p) => { location.hash = '#' + p; };

// ---------------- Dashboard ----------------
export async function dashboard({ meta, user }) {
  const [sum, recent] = await Promise.all([api('/api/summary'), api('/api/transfers?pageSize=5')]);
  const max = Math.max(1, ...sum.byCountry.map((c) => c.sent_inr));
  const stat = (label, value) => html`<div class="card stat"><div class="label">${label}</div><div class="value">${value}</div></div>`;
  return {
    html: html`
    <div class="page-head"><div><h1>Hello, ${user.name.split(' ')[0]} 👋</h1><p class="muted">Your simulated remittance overview. ${simTag}</p></div>
      <a class="btn" href="#/send">${icon('send', 18)} Send money</a></div>
    ${user.kycStage !== 'verified' ? html`<div class="alert warn">KYC demo status: <b>${statusLabel(user.kycStage)}</b>. Transfers above ₹${meta.limits.unverified.toLocaleString('en-IN')} need the KYC demo completed. <a href="#/kyc">Open KYC demo</a></div>` : ''}
    <div class="grid cols-5">
      ${stat('Total simulated sent', fmtInr(sum.sentInr))}${stat('Transactions', sum.count)}${stat('Successful', sum.successful)}${stat('Pending', sum.pending)}${stat('Failed', sum.failed)}
    </div>
    <div class="grid cols-2" style="margin-top:1rem">
      <div class="card"><h2>Sent by destination</h2>
        ${sum.byCountry.filter((c) => c.sent_inr > 0).length
          ? html`<div class="bars">${sum.byCountry.filter((c) => c.sent_inr > 0).slice(0, 7).map((c) => { const cc = countryOf(meta, c.country); return html`<div class="bar-row"><span>${flagEl(cc)} ${cc.name}</span><div class="track"><div class="fill" style="width:${Math.round((c.sent_inr / max) * 100)}%"></div></div><span class="right">${fmtInr(c.sent_inr)}</span></div>`; })}</div>`
          : html`<p class="muted">No successful transfers yet. <a href="#/send">Send your first simulated transfer</a>.</p>`}
      </div>
      <div class="card"><h2>Profile</h2>
        <div id="profile-msg"></div>
        <form id="profile-form" novalidate>
          <div class="field"><label for="p-name">Name</label><input id="p-name" value="${user.name}"></div>
          <div class="row">
            <div class="field"><label for="p-country">Country</label><select id="p-country"><option value="IN" ${user.country === 'IN' ? 'selected' : ''}>India</option>${meta.countries.map((c) => html`<option value="${c.code}" ${user.country === c.code ? 'selected' : ''}>${c.name}</option>`)}</select></div>
            <div class="field"><label for="p-cur">Preferred currency</label><select id="p-cur">${Object.entries(meta.currencies).map(([k, v]) => html`<option value="${k}" ${user.preferredCurrency === k ? 'selected' : ''}>${k} · ${v.name}</option>`)}</select></div>
          </div>
          <div class="row tight" style="align-items:center"><button class="btn secondary small" type="submit">Save profile</button><span class="small muted">${user.email} · ${badge(user.kycStage)}</span></div>
        </form>
      </div>
    </div>
    <div class="card" style="margin-top:1rem"><div class="row" style="align-items:center;justify-content:space-between"><h2 style="margin:0">Recent transactions</h2><a class="btn secondary small" href="#/history">View all</a></div>
      <div style="margin-top:.6rem">${txnTable(recent.rows, meta)}</div></div>`,
    mount(el) {
      wireRows(el);
      el.querySelector('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = el.querySelector('#profile-msg');
        try {
          const r = await api('/api/auth/profile', { method: 'PATCH', body: { name: el.querySelector('#p-name').value, country: el.querySelector('#p-country').value, preferredCurrency: el.querySelector('#p-cur').value } });
          state.user = r.user;
          msg.innerHTML = '<div class="alert ok">Profile saved.</div>';
        } catch (err) { msg.innerHTML = `<div class="alert bad">${esc(err.message)}</div>`; }
      });
    },
  };
}

// ---------------- Send money (multi-step) ----------------
const STEPS = ['Destination', 'Recipient', 'Amount', 'Confirm', 'Result'];
export async function send({ meta, query }) {
  const s = { step: 0, country: '', name: '', ident: '', amount: '', quote: null, risk: null, outcome: 'successful', result: null, error: '', busy: false, note: '' };
  const sc = SCENARIOS.find((x) => x.key === query.scenario);
  if (sc) Object.assign(s, { country: sc.country, name: sc.name, ident: sc.identifier, amount: String(sc.amount), step: 2, note: `Guided scenario: ${sc.title}. ${sc.blurb}` });

  const body = () => {
    if (s.step === 0) return html`
      <h2>Where are you sending money?</h2><p class="muted">Choose a destination. Corridors are simulated for this prototype.</p>
      ${countryPicker(meta, s.country)}
      <div class="row tight" style="margin-top:1.2rem"><button class="btn" data-act="next" ${s.country ? '' : 'disabled'}>Continue</button></div>`;
    if (s.step === 1) { const c = countryOf(meta, s.country); return html`
      <h2>Who is receiving in ${flagEl(c)} ${c.name}?</h2>
      <div class="field"><label for="r-name">Recipient's full name</label><input id="r-name" value="${s.name}" autocomplete="off"></div>
      <div class="field"><label for="r-id">Simulated payment identifier</label><input id="r-id" value="${s.ident}" autocomplete="off" placeholder="e.g. name@bank-demo"><div class="small muted">A fictional identifier for the demo. Never enter a real account number, UPI PIN or OTP.</div></div>
      <div class="row tight"><button class="btn secondary" data-act="back">Back</button><button class="btn" data-act="next">Continue</button></div>`; }
    if (s.step === 2) return html`
      <h2>How much, in INR?</h2>
      <div class="field"><label for="amt">Amount (INR)</label><input id="amt" inputmode="decimal" value="${s.amount}" placeholder="10000"></div>
      <div id="quote-live" aria-live="polite" class="card" style="box-shadow:none;background:var(--lavender)">${s.quote ? breakdown(s.quote, meta) : html`<p class="muted">Enter an amount to see the rate, fee and what arrives.</p>`}</div>
      <div class="row tight" style="margin-top:1rem"><button class="btn secondary" data-act="back">Back</button><button class="btn" data-act="review" ${s.busy ? 'disabled' : ''}>Review transfer</button></div>`;
    if (s.step === 3) { const c = countryOf(meta, s.country); return html`
      <h2>Confirm your simulated transfer</h2>
      <div class="grid cols-2">
        <div class="card" style="box-shadow:none"><div class="small muted">To</div><div><b>${s.name}</b> · ${flagEl(c)} ${c.name}</div><div class="small muted mono">${s.ident}</div><hr style="border:0;border-top:1px solid var(--border)">${breakdown(s.quote, meta)}</div>
        <div>${riskCard(s.risk)}
          <div class="card" style="box-shadow:none;margin-top:1rem;border-style:dashed">
            <div class="small"><b>Demo control:</b> choose what the <i>simulated</i> payment gateway returns, so every outcome can be shown.</div>
            <div class="field" style="margin:.6rem 0 0"><label for="outcome" class="small">Simulated gateway result</label>
              <select id="outcome"><option value="successful" ${s.outcome === 'successful' ? 'selected' : ''}>Success</option><option value="pending" ${s.outcome === 'pending' ? 'selected' : ''}>Pending (processing)</option><option value="failed" ${s.outcome === 'failed' ? 'selected' : ''}>Failure (declined)</option></select></div>
          </div>
        </div>
      </div>
      <div class="alert info" style="margin-top:1rem">${icon('lock', 15)} DEMO PAYMENT: no real money moves, and no PIN or OTP is needed.</div>
      <div class="row tight"><button class="btn secondary" data-act="back">Back</button><button class="btn" data-act="pay" ${s.busy ? 'disabled' : ''}>${icon('zap', 17)} Pay ${fmtInr(s.quote.totalPayableInr)} (SIMULATED)</button></div>`; }
    const t = s.result.transaction;
    const c = countryOf(meta, t.country);
    const copy = { successful: ['Simulated payment successful', `${fmtMoney(t.recipient_amount, t.receive_currency, meta)} would reach ${t.recipient_name} in ${c.name}.`], pending: ['Simulated payment pending', 'The mock gateway is still processing. A demo administrator can settle pending payments.'], failed: ['Simulated payment failed', t.failure_reason] }[t.status];
    return html`
      <div class="center"><div class="result-icon ${t.status}">${icon(t.status === 'successful' ? 'check' : t.status === 'failed' ? 'x' : 'clock', 32)}</div>
        <h2>${copy[0]}</h2><p class="muted">${copy[1]}</p><p>${simTag} <span class="mono small">${t.txn_id}</span></p></div>
      ${s.result.risk.level !== 'low' ? html`<div class="alert warn">This payment was flagged for review (${s.result.risk.level} risk). ${s.result.risk.suggestedStep}</div>` : ''}
      <div class="row tight" style="justify-content:center;margin-top:1rem"><a class="btn" href="#/receipt/${t.txn_id}">${icon('receipt', 17)} View receipt</a><a class="btn secondary" href="#/dashboard">Dashboard</a><a class="btn secondary" href="#/history">Transactions</a><button class="btn ghost" data-act="again">Send another</button></div>`;
  };

  return {
    html: html`<div class="page-head"><div><h1>Send money</h1><p class="muted">Step-by-step simulated transfer ${simTag}</p></div></div>
      <div class="card" style="max-width:860px"><div id="send-root"></div></div>`,
    mount(el) {
      const rootEl = el.querySelector('#send-root');
      let timer;
      const draw = () => {
        rootEl.innerHTML = (s.step < 4 ? stepper(STEPS, s.step).__raw : '') + (s.note && s.step < 3 ? `<div class="alert info">${esc(s.note)}</div>` : '') + (s.error ? `<div class="alert bad" role="alert">${esc(s.error)}${s.errorLink ? ` <a href="#/kyc">Open KYC demo</a>` : ''}</div>` : '') + body().__raw;
        s.error = ''; s.errorLink = false;
        wireCountrySearch(rootEl);
      };
      const loadQuote = async () => {
        const box = rootEl.querySelector('#quote-live');
        try {
          s.quote = await api('/api/quote', { method: 'POST', body: { amount: s.amount, country: s.country } });
          box.innerHTML = breakdown(s.quote, meta).__raw;
        } catch (e) { s.quote = null; box.innerHTML = `<div class="alert bad" style="margin:0">${esc(e.message)}</div>`; }
      };
      rootEl.addEventListener('input', (e) => {
        if (e.target.id === 'amt') { s.amount = e.target.value.trim(); clearTimeout(timer); timer = setTimeout(loadQuote, 250); }
        if (e.target.id === 'r-name') s.name = e.target.value;
        if (e.target.id === 'r-id') s.ident = e.target.value;
      });
      rootEl.addEventListener('change', (e) => { if (e.target.id === 'outcome') s.outcome = e.target.value; });
      rootEl.addEventListener('click', async (e) => {
        const cb = e.target.closest('[data-country]');
        if (cb) {
          s.country = cb.dataset.country; s.quote = null;
          if (s.step === 0) { markCountrySelected(rootEl, meta, s.country); rootEl.querySelector('[data-act="next"]').disabled = false; } else draw();
          return;
        }
        const b = e.target.closest('[data-act]'); if (!b) return;
        const act = b.dataset.act;
        if (act === 'back') { s.step -= 1; draw(); }
        else if (act === 'next') { s.step += 1; draw(); if (s.step === 2 && s.amount) loadQuote(); }
        else if (act === 'again') { Object.assign(s, { step: 0, country: '', name: '', ident: '', amount: '', quote: null, risk: null, result: null, outcome: 'successful', note: '' }); draw(); }
        else if (act === 'review') {
          s.busy = true;
          try {
            const payload = { amount: s.amount, country: s.country, recipientName: s.name, identifier: s.ident };
            s.quote = await api('/api/quote', { method: 'POST', body: payload });
            s.risk = await api('/api/risk/assess', { method: 'POST', body: payload });
            s.step = 3;
          } catch (err) {
            s.error = err.message;
            if (err.field === 'recipientName' || err.field === 'identifier') s.step = 1;
          }
          s.busy = false; draw();
        } else if (act === 'pay') {
          s.busy = true; b.disabled = true;
          try {
            s.result = await api('/api/transfers', { method: 'POST', body: { amount: s.amount, country: s.country, recipientName: s.name, identifier: s.ident, outcome: s.outcome } });
            s.step = 4;
          } catch (err) { s.error = err.message; s.errorLink = err.code === 'KYC_REQUIRED'; }
          s.busy = false; draw();
        }
      });
      draw();
      if (s.step === 2) loadQuote();
    },
  };
}

// ---------------- Transaction history ----------------
export async function history({ meta }) {
  const f = { country: '', status: '', from: '', to: '', q: '', page: 1 };
  return {
    html: html`
    <div class="page-head"><div><h1>Transactions</h1><p class="muted">Every transfer here is simulated. Click a row for its receipt.</p></div><a class="btn" href="#/send">${icon('send', 18)} Send money</a></div>
    <div class="card">
      <form id="filters" class="row" style="margin-bottom:1rem">
        <div><label for="f-q">Search</label><input id="f-q" placeholder="ID or recipient"></div>
        <div><label for="f-country">Country</label><select id="f-country"><option value="">All countries</option>${countryOptions(meta)}</select></div>
        <div><label for="f-status">Status</label><select id="f-status"><option value="">All statuses</option><option value="successful">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option></select></div>
        <div><label for="f-from">From</label><input id="f-from" type="date"></div>
        <div><label for="f-to">To</label><input id="f-to" type="date"></div>
        <div style="flex:0 0 auto"><button class="btn secondary" type="button" id="f-clear">Clear</button></div>
      </form>
      <div id="list"><p class="muted">Loading…</p></div>
      <div id="pager" class="row tight" style="margin-top:1rem;align-items:center"></div>
    </div>`,
    mount(el) {
      const load = async () => {
        const qs = new URLSearchParams({ pageSize: 10, page: f.page });
        for (const k of ['country', 'status', 'from', 'to', 'q']) if (f[k]) qs.set(k, f[k]);
        try {
          const r = await api('/api/transfers?' + qs);
          el.querySelector('#list').innerHTML = txnTable(r.rows, meta).__raw;
          wireRows(el.querySelector('#list'));
          const pages = Math.max(1, Math.ceil(r.total / r.pageSize));
          el.querySelector('#pager').innerHTML = `<button class="btn secondary small" data-p="-1" ${f.page <= 1 ? 'disabled' : ''}>Previous</button><span class="small muted">Page ${f.page} of ${pages} · ${r.total} transaction${r.total === 1 ? '' : 's'}</span><button class="btn secondary small" data-p="1" ${f.page >= pages ? 'disabled' : ''}>Next</button>`;
        } catch (e) { el.querySelector('#list').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
      };
      const map = { 'f-q': 'q', 'f-country': 'country', 'f-status': 'status', 'f-from': 'from', 'f-to': 'to' };
      let t;
      el.querySelector('#filters').addEventListener('input', (e) => {
        const k = map[e.target.id]; if (!k) return;
        f[k] = e.target.value; f.page = 1; clearTimeout(t); t = setTimeout(load, 200);
      });
      el.querySelector('#f-clear').addEventListener('click', () => { el.querySelector('#filters').reset(); Object.assign(f, { country: '', status: '', from: '', to: '', q: '', page: 1 }); load(); });
      el.querySelector('#pager').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) { f.page += Number(b.dataset.p); load(); } });
      load();
    },
  };
}

// ---------------- Receipt ----------------
export async function receipt({ meta, params }) {
  const { transaction: t, alert } = await api(`/api/transfers/${encodeURIComponent(params.id)}`);
  return {
    html: html`
    <div class="no-print" style="margin-bottom:1rem"><a href="#/history">← Transactions</a></div>
    <div class="card receipt">
      <div class="wm">SIMULATED · DEMO</div>
      <div class="center"><div class="result-icon ${t.status}">${icon(t.status === 'successful' ? 'check' : t.status === 'failed' ? 'x' : 'clock', 30)}</div>
        <h2>Transaction receipt</h2><p class="muted small">${simTag} Not a real payment. No money moved.</p></div>
      ${receiptBody(t, meta, alert)}
      <div class="row tight no-print" style="margin-top:1.2rem"><button class="btn secondary" onclick="window.print()">Print / save as PDF</button><a class="btn" href="#/dashboard">Dashboard</a></div>
    </div>`,
  };
}

// ---------------- KYC demo ----------------
export async function kyc({ meta }) {
  const data = await api('/api/kyc');
  const labels = { not_started: 'Not started', submitted: 'Submitted', under_review: 'Under review', verified: 'Verified' };
  const idx = data.stages.indexOf(data.stage);
  return {
    html: html`
    <div class="page-head"><div><h1>KYC demo</h1><p class="muted">A mock identity-verification flow with fictional data. ${simTag}</p></div></div>
    <div class="alert warn">Use <b>fictional</b> details only. This demo never collects real identity documents; "documents" are placeholder labels.</div>
    <div class="card">
      <div class="stepper" role="list">${data.stages.map((st, i) => html`<div class="s ${i < idx ? 'done' : ''} ${i === idx ? 'cur' : ''}" role="listitem"><div class="bar"></div>${labels[st]}</div>`)}</div>
      <div id="kyc-msg"></div>
      ${data.stage === 'not_started' ? html`
        <form id="kyc-form" novalidate style="max-width:460px">
          <div class="field"><label for="k-name">Fictional full name</label><input id="k-name" placeholder="e.g. Asha Verma" autocomplete="off"></div>
          <div class="field"><label for="k-doc">Placeholder document</label><select id="k-doc"><option>Placeholder passport (demo)</option><option>Placeholder national ID (demo)</option><option>Placeholder driving licence (demo)</option></select></div>
          <button class="btn" type="submit">Submit for (mock) verification</button></form>`
        : html`<p><b>Status:</b> ${badge(data.stage)} ${data.demoName ? html`· ${data.demoName} · ${data.demoDoc}` : ''}</p>
          <div class="row tight">
            ${data.stage !== 'verified' ? html`<button class="btn" id="advance">Advance to next stage (demo control)</button>` : html`<span class="alert ok" style="margin:0">Verified: transfers up to ₹${meta.limits.max.toLocaleString('en-IN')} are allowed in this demo.</span>`}
            <button class="btn secondary" id="reset">Reset KYC demo</button></div>
          <p class="small muted">In a real system a licensed KYC provider decides these stages. The advance button exists only so the demo can show every stage.</p>`}
    </div>
    <div class="card"><h2>${icon('shield', 20)} Why this matters</h2>
      <p>Actual cross-border transfers would require appropriate <b>regulated payment partners</b>, <b>KYC</b>, <b>anti-money-laundering checks</b> and compliance with the laws of each participating country. Without completed KYC, this demo caps a transfer at ₹${data.unverifiedLimitInr.toLocaleString('en-IN')}, mirroring how real providers tier their limits.</p></div>`,
    mount(el) {
      const msg = (m, k = 'bad') => { el.querySelector('#kyc-msg').innerHTML = `<div class="alert ${k}">${esc(m)}</div>`; };
      const act = async (path, body) => {
        try {
          const r = await api(path, { method: 'POST', body });
          state.user = { ...state.user, kycStage: r.stage };
          window.dispatchEvent(new HashChangeEvent('hashchange')); // re-render this screen
        } catch (e) { msg(e.message); }
      };
      el.querySelector('#kyc-form')?.addEventListener('submit', (e) => { e.preventDefault(); act('/api/kyc/submit', { fullName: el.querySelector('#k-name').value, documentType: el.querySelector('#k-doc').value }); });
      el.querySelector('#advance')?.addEventListener('click', () => act('/api/kyc/advance'));
      el.querySelector('#reset')?.addEventListener('click', () => act('/api/kyc/reset'));
    },
  };
}

// ---------------- AI Fraud Risk Assistant ----------------
export async function risk({ meta }) {
  const { alerts } = await api('/api/alerts');
  return {
    html: html`
    <div class="page-head"><div><h1>Fraud risk assistant</h1><p class="muted">Transparent rule-based checks, no AI API connected. ${simTag}</p></div></div>
    <div class="alert info">${icon('info', 16)} The assistant highlights transfers worth double-checking. It never accuses anyone of fraud and cannot guarantee fraud prevention.</div>
    <div class="grid cols-2">
      <div class="card"><h2>Try a risk check</h2>
        <form id="risk-form" novalidate>
          <div class="field"><label for="x-amt">Amount (INR)</label><input id="x-amt" inputmode="decimal" value="60000"></div>
          <div class="field"><label for="x-country">Destination</label><select id="x-country">${countryOptions(meta, 'NP')}</select></div>
          <div class="field"><label for="x-name">Recipient name</label><input id="x-name" value="Geeta Sharma"></div>
          <div class="field"><label for="x-id">Simulated identifier</label><input id="x-id" value="gita.thapa@nepal-demo"></div>
          <button class="btn" type="submit">Assess risk</button>
        </form>
        <div id="risk-out" style="margin-top:1rem"></div></div>
      <div class="card"><h2>Rules in use</h2>
        <ul class="small"><li><b>Large vs history:</b> amount over 3× your average successful transfer.</li><li><b>Large absolute:</b> ₹1,00,000 or more.</li><li><b>Velocity:</b> 3+ transfers in 10 minutes.</li><li><b>Repeated failures:</b> 2+ failed attempts in 24 hours.</li><li><b>Inconsistent recipient:</b> same identifier seen with a different name.</li><li><b>Many identifiers:</b> 3+ identifiers for one name in 30 days.</li></ul>
        <p class="small muted">Thresholds are configurable in <span class="mono">server/src/lib/risk.js</span>. Scores of 25+ are medium, 55+ high.</p></div>
    </div>
    <div class="card" style="margin-top:1rem"><h2>Your flagged payments</h2>
      ${alerts.length ? html`<div class="table-wrap"><table><thead><tr><th>Transaction</th><th>Level</th><th>Reasons</th><th>Review</th></tr></thead><tbody>${alerts.map((a) => html`<tr class="click" data-href="#/receipt/${a.txn_id}"><td class="mono">${a.txn_id}</td><td>${badge(a.level)}</td><td class="wrap">${a.reasons.map((r) => r.text).join(' ')}</td><td>${badge(a.review_status)}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">Nothing flagged for your account.</p>`}
    </div>`,
    mount(el) {
      wireRows(el);
      el.querySelector('#risk-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const out = el.querySelector('#risk-out');
        try {
          const r = await api('/api/risk/assess', { method: 'POST', body: { amount: el.querySelector('#x-amt').value, country: el.querySelector('#x-country').value, recipientName: el.querySelector('#x-name').value, identifier: el.querySelector('#x-id').value } });
          out.innerHTML = riskCard(r).__raw;
        } catch (err) { out.innerHTML = `<div class="alert bad">${esc(err.message)}</div>`; }
      });
    },
  };
}
