import { state, api } from './api.js';
import { html, icon, fmtInr, fmtNum, fmtDate, badge, countryOf, simTag, esc, flagEl, countryOptions } from './util.js';
import { txnTable, wireRows } from './components.js';

const TABS = [['overview', 'Overview'], ['transactions', 'Transactions'], ['alerts', 'Flagged payments'], ['rates', 'Exchange rates'], ['fee', 'Fee model']];

export async function admin({ meta }) {
  let tab = 'overview';
  const f = { country: '', status: '', from: '', to: '', page: 1 };

  const shell = () => html`
    <div class="page-head"><div><h1>Admin dashboard</h1><p class="muted">Demo administrator tools. Role is verified on the server for every request. ${simTag}</p></div>
      <button class="btn secondary" id="export">${icon('download', 17)} Export CSV</button></div>
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => html`<button class="${tab === k ? 'active' : ''}" data-tab="${k}" role="tab">${l}</button>`)}</div>
    <div id="msg"></div><div id="panel"><div class="card muted">Loading…</div></div>`;

  return {
    html: shell(),
    mount(el) {
      const panel = el.querySelector('#panel');
      const msg = (m, k = 'ok') => { el.querySelector('#msg').innerHTML = m ? `<div class="alert ${k}" role="status">${esc(m)}</div>` : ''; };
      const fail = (e) => msg(e.message, 'bad');

      const views = {
        async overview() {
          const s = await api('/api/admin/stats');
          const stat = (l, v) => html`<div class="card stat"><div class="label">${l}</div><div class="value">${v}</div></div>`;
          return html`
          <div class="grid cols-4">${stat('Total simulated sent', fmtInr(s.sentInr))}${stat('Transactions', s.count)}${stat('Open flags', s.openAlerts)}${stat('Demo users', s.users)}</div>
          <div class="grid cols-4" style="margin-top:1rem">${stat('Successful', s.successful)}${stat('Pending', s.pending)}${stat('Failed', s.failed)}${stat('Fees (simulated)', fmtInr(s.feesInr))}</div>
          <div class="card" style="margin-top:1rem"><h2>By destination country</h2><div class="table-wrap"><table>
            <thead><tr><th>Country</th><th class="right">Txns</th><th class="right">Successful</th><th class="right">Pending</th><th class="right">Failed</th><th class="right">Flagged</th><th class="right">Sent</th><th class="right">Fees</th></tr></thead>
            <tbody>${s.perCountry.map((r) => { const c = countryOf(meta, r.country); return html`<tr><td>${flagEl(c)} ${c.name}</td><td class="right">${r.count}</td><td class="right">${r.successful}</td><td class="right">${r.pending}</td><td class="right">${r.failed}</td><td class="right">${r.flagged}</td><td class="right">${fmtInr(r.sent_inr)}</td><td class="right">${fmtInr(r.fees_inr)}</td></tr>`; })}</tbody></table></div></div>`;
        },
        async transactions() {
          const qs = new URLSearchParams({ pageSize: 15, page: f.page });
          for (const k of ['country', 'status', 'from', 'to']) if (f[k]) qs.set(k, f[k]);
          const r = await api('/api/admin/transactions?' + qs);
          const pages = Math.max(1, Math.ceil(r.total / r.pageSize));
          return html`<div class="card">
            <form id="filters" class="row" style="margin-bottom:1rem">
              <div><label for="f-country">Country</label><select id="f-country"><option value="">All</option>${countryOptions(meta, f.country)}</select></div>
              <div><label for="f-status">Status</label><select id="f-status"><option value="">All</option>${['successful', 'pending', 'failed'].map((s) => html`<option value="${s}" ${f.status === s ? 'selected' : ''}>${s}</option>`)}</select></div>
              <div><label for="f-from">From</label><input id="f-from" type="date" value="${f.from}"></div>
              <div><label for="f-to">To</label><input id="f-to" type="date" value="${f.to}"></div>
            </form>
            ${txnTable(r.rows, meta, { admin: true, actions: true })}
            <div class="row tight" style="margin-top:1rem;align-items:center"><button class="btn secondary small" data-p="-1" ${f.page <= 1 ? 'disabled' : ''}>Previous</button><span class="small muted">Page ${f.page} of ${pages} · ${r.total} total</span><button class="btn secondary small" data-p="1" ${f.page >= pages ? 'disabled' : ''}>Next</button></div></div>`;
        },
        async alerts() {
          const { alerts } = await api('/api/admin/alerts');
          if (!alerts.length) return html`<div class="card"><p class="muted">No flagged payments.</p></div>`;
          return html`<div class="card"><h2>Flagged demo payments</h2><p class="small muted">Flags are prompts for a verification step, not accusations.</p>
            ${alerts.map((a) => { const c = countryOf(meta, a.country); return html`
            <div class="card" style="box-shadow:none;margin-top:.8rem">
              <div class="row" style="align-items:center;justify-content:space-between"><div><b>${a.txn_id}</b> · ${a.sender_email} → ${flagEl(c)} ${a.recipient_name} · ${fmtInr(a.amount_inr)}<div class="small muted">${fmtDate(a.created_at)} · payment ${a.txn_status}</div></div><div>${badge(a.level, `${a.level} · ${a.score}`)} ${badge(a.review_status)}</div></div>
              <ul class="small">${a.reasons.map((r) => html`<li>${r.text}</li>`)}</ul>
              <p class="small"><b>Suggested step:</b> ${a.suggested_step}</p>
              <div class="row tight"><button class="btn small" data-review="${a.id}:cleared">Mark cleared</button><button class="btn small danger" data-review="${a.id}:escalated">Escalate</button><button class="btn small secondary" data-review="${a.id}:open">Reopen</button><a class="btn small ghost" href="#/receipt/${a.txn_id}">Receipt</a></div>
            </div>`; })}</div>`;
        },
        async rates() {
          const r = await api('/api/rates');
          return html`<div class="card"><div class="row" style="align-items:center;justify-content:space-between"><div><h2 style="margin:0">Exchange rates (per 1 INR)</h2><p class="small muted" style="margin:.2rem 0 0">${r.label}. Edits are recorded as SAMPLE rate snapshots.</p></div>
            <button class="btn secondary small" id="refresh-live" ${meta.liveRatesConfigured ? '' : 'disabled title="Set EXCHANGE_RATE_API_URL to enable"'}>Refresh from live API</button></div>
            <input type="search" data-table-filter placeholder="Filter ${r.rates.length - 1} currencies (e.g. JPY, dirham)" aria-label="Filter currencies" style="margin-top:.8rem">
            <div class="table-wrap" style="margin-top:.8rem;max-height:520px;overflow:auto"><table><thead><tr><th>Currency</th><th class="right">Rate</th><th>Source</th><th>Updated</th><th></th></tr></thead><tbody>
            ${r.rates.filter((x) => x.currency !== 'INR').map((x) => html`<tr data-q="${(x.currency + ' ' + (meta.currencies[x.currency]?.name || '')).toLowerCase()}"><td>${x.currency} · ${meta.currencies[x.currency]?.name}</td>
              <td class="right"><input type="number" step="any" min="0" value="${x.perInr}" data-rate-input="${x.currency}" style="width:130px;min-height:36px;padding:.3rem .5rem" aria-label="${x.currency} rate"></td>
              <td>${x.source === 'live' ? 'Live' : 'SAMPLE'}</td><td>${fmtDate(x.updatedAt)}</td><td><button class="btn small" data-rate-save="${x.currency}">Save</button></td></tr>`)}</tbody></table></div></div>`;
        },
        async fee() {
          const { fee } = await api('/api/admin/fee');
          const fld = (k, label, hint) => html`<div class="field"><label for="fee-${k}">${label}</label><input id="fee-${k}" type="number" step="any" min="0" value="${fee[k]}"><div class="small muted">${hint}</div></div>`;
          return html`<div class="card" style="max-width:640px"><h2>Illustrative fee model</h2>
            <div class="alert info">The ₹5-or-less flat fee is a <b>proposed target</b> for the demo, not a guaranteed real-world price.</div>
            <form id="fee-form" novalidate>
              ${fld('flat_fee_inr', 'Flat transfer fee (INR)', 'Demo default: ₹5.')}
              ${fld('percent_fee', 'Percentage fee (%)', 'Added on top of the flat fee. Default 0.')}
              ${fld('markup_percent', 'Exchange-rate markup (%)', 'Shown separately from the fee and built into the rate.')}
              ${fld('min_amount_inr', 'Minimum transfer (INR)', '')}${fld('max_amount_inr', 'Maximum transfer (INR)', '')}${fld('unverified_limit_inr', 'Limit without completed KYC (INR)', '')}
              <button class="btn" type="submit">Save fee model</button></form></div>`;
        },
      };

      const show = async () => {
        msg('');
        try {
          panel.innerHTML = (await views[tab]()).__raw;
          wireRows(panel);
        } catch (e) { fail(e); }
      };

      el.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-tab]');
        if (t) { tab = t.dataset.tab; el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === t)); return show(); }
        if (e.target.closest('#export')) {
          try {
            const qs = new URLSearchParams(); for (const k of ['country', 'status', 'from', 'to']) if (f[k]) qs.set(k, f[k]);
            const res = await api('/api/admin/export.csv?' + qs, { raw: true });
            const url = URL.createObjectURL(await res.blob());
            const a = document.createElement('a'); a.href = url; a.download = 'upi-bridge-demo-transactions.csv'; a.click(); URL.revokeObjectURL(url);
            msg('CSV exported (demo data, rates marked SAMPLE).');
          } catch (err) { fail(err); }
          return;
        }
        const p = e.target.closest('[data-p]');
        if (p) { f.page += Number(p.dataset.p); return show(); }
        const settle = e.target.closest('[data-settle]');
        if (settle) {
          const [id, status] = settle.dataset.settle.split(':');
          try { await api(`/api/admin/transactions/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } }); msg(`${id} marked ${status} (simulated).`); await show(); } catch (err) { fail(err); }
          return;
        }
        const rv = e.target.closest('[data-review]');
        if (rv) {
          const [id, reviewStatus] = rv.dataset.review.split(':');
          try { await api(`/api/admin/alerts/${id}`, { method: 'PATCH', body: { reviewStatus } }); msg(`Alert marked ${reviewStatus}.`); await show(); } catch (err) { fail(err); }
          return;
        }
        const rs = e.target.closest('[data-rate-save]');
        if (rs) {
          const cur = rs.dataset.rateSave;
          const val = el.querySelector(`[data-rate-input="${cur}"]`).value;
          try { await api(`/api/admin/rates/${cur}`, { method: 'PUT', body: { rate: val } }); msg(`${cur} sample rate updated.`); await show(); } catch (err) { fail(err); }
          return;
        }
        if (e.target.closest('#refresh-live')) {
          try { const r = await api('/api/admin/rates/refresh', { method: 'POST', body: {} }); msg(`Updated ${r.updated} rates from the live API.`); await show(); } catch (err) { fail(err); }
        }
      });
      el.addEventListener('input', (e) => {
        const map = { 'f-country': 'country', 'f-status': 'status', 'f-from': 'from', 'f-to': 'to' };
        if (map[e.target.id]) { f[map[e.target.id]] = e.target.value; f.page = 1; show(); }
      });
      el.addEventListener('submit', async (e) => {
        if (e.target.id !== 'fee-form') return;
        e.preventDefault();
        const body = {};
        for (const k of ['flat_fee_inr', 'percent_fee', 'markup_percent', 'min_amount_inr', 'max_amount_inr', 'unverified_limit_inr']) body[k] = el.querySelector(`#fee-${k}`).value;
        try { await api('/api/admin/fee', { method: 'PUT', body }); msg('Fee model saved.'); const m = await api('/api/meta'); state.meta = m; } catch (err) { fail(err); }
      });
      show();
    },
  };
}
