import { html, raw, icon, fmtInr, fmtMoney, fmtNum, fmtDate, badge, countryOf, simTag, flagEl, esc } from './util.js';

export function stepper(labels, cur) {
  return html`<div class="stepper" role="list" aria-label="Progress">${labels.map((l, i) =>
    html`<div class="s ${i < cur ? 'done' : ''} ${i === cur ? 'cur' : ''}" role="listitem" ${i === cur ? raw('aria-current="step"') : ''}><div class="bar"></div>${i + 1}. ${l}</div>`)}</div>`;
}

export function countryPicker(meta, selected) {
  const regions = [...new Set(meta.countries.map((c) => c.region))];
  const sel = meta.countries.find((c) => c.code === selected);
  return html`
    <div class="picker-search">
      <input type="search" data-country-search placeholder="Search country, currency or code" aria-label="Search destination country" autocomplete="off">
      <div class="small muted" data-country-count aria-live="polite">${sel ? html`Selected: ${flagEl(sel)} <b>${sel.name}</b> (${sel.currency})` : `${meta.countries.filter((c) => !c.restricted).length} destinations available. Pick one.`}</div>
    </div>
    <div class="picker-list">${regions.map((r) => html`
    <div class="picker-region" data-region>
      <div class="region">${r}</div>
      <div class="countries">${meta.countries.filter((c) => c.region === r).map((c) => html`
        <button type="button" class="country ${c.code === selected ? 'sel' : ''}" ${c.restricted ? raw('disabled') : ''} data-country="${c.code}" data-q="${(c.name + ' ' + c.currency + ' ' + c.code).toLowerCase()}" aria-pressed="${c.code === selected}" ${c.restricted ? raw(`title="Blocked in this demo: ${esc(c.restrictedReason)}"`) : ''}>
          <span class="flag" aria-hidden="true">${flagEl(c)}</span><span><b>${c.name}</b><br><span class="cur">${c.restricted ? 'Blocked in demo' : c.currency}</span></span>
        </button>`)}</div>
    </div>`)}
    <p class="muted small" data-country-none hidden>No destination matches your search.</p></div>`;
}

/** Update selection in place (keeps the search text and scroll position). */
export function markCountrySelected(root, meta, code) {
  root.querySelectorAll('[data-country]').forEach((b) => { const on = b.dataset.country === code; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
  const c = meta.countries.find((x) => x.code === code);
  const line = root.querySelector('[data-country-count]');
  if (line && c) line.innerHTML = `Selected: ${flagEl(c).__raw} <b>${esc(c.name)}</b> (${esc(c.currency)})`;
}

/** Client-side filtering of an already rendered picker (no re-render, so typing keeps focus). */
export function wireCountrySearch(root) {
  const input = root.querySelector('[data-country-search]');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll('[data-region]').forEach((reg) => {
      let n = 0;
      reg.querySelectorAll('[data-country]').forEach((b) => { const hit = !q || b.dataset.q.includes(q); b.hidden = !hit; if (hit) n++; });
      reg.hidden = n === 0; shown += n;
    });
    root.querySelector('[data-country-none]').hidden = shown !== 0;
  });
}

export function breakdown(q, meta, { title = true } = {}) {
  return html`<div class="breakdown">
    ${title ? html`<div class="small muted">Recipient gets (estimated)</div>` : ''}
    <div class="big">${fmtMoney(q.recipientAmount, q.receiveCurrency, meta)}</div>
    <div class="small muted" style="margin-bottom:.6rem">in ${q.countryName}</div>
    <div class="line"><span>Amount sent</span><span>${fmtInr(q.amountInr)}</span></div>
    <div class="line"><span>Transfer fee <span class="muted small">(proposed target)</span></span><span>${fmtInr(q.transferFeeInr)}</span></div>
    <div class="line"><span>Exchange-rate markup <span class="muted small">(${q.markupPercent}% · shown separately)</span></span><span>${fmtInr(q.markupCostInr)}<br><span class="muted small">already built into the rate</span></span></div>
    <div class="line"><span>Sample mid-market rate</span><span>1 INR = ${q.midRate} ${q.receiveCurrency}</span></div>
    <div class="line"><span>Rate you get after markup</span><span>1 INR = ${q.effectiveRate} ${q.receiveCurrency}</span></div>
    <div class="line total"><span>Total payable</span><span>${fmtInr(q.totalPayableInr)}</span></div>
    <p class="small muted" style="margin:.7rem 0 0">${q.rateIsSample ? 'SAMPLE rate' : 'Indicative rate'} · last updated ${fmtDate(q.rateUpdatedAt)}. ${q.disclaimer}</p>
  </div>`;
}

export function riskCard(r) {
  return html`<div class="card" style="box-shadow:none">
    <div class="row" style="align-items:center;justify-content:space-between;margin-bottom:.6rem">
      <h3 style="margin:0">${icon('shield', 18)} Risk check</h3>
      <span>${badge(r.level, `${r.level} risk · score ${r.score}`)}</span>
    </div>
    ${r.reasons.length
      ? html`<div>${r.reasons.map((x) => html`<div class="reason"><b>${x.code.replaceAll('_', ' ').toLowerCase()}</b> <span class="muted small">(+${x.points})</span><br>${x.text}</div>`)}</div>`
      : html`<p class="muted">No rules were triggered.</p>`}
    <p style="margin:.7rem 0 .3rem"><b>Next step:</b> ${r.suggestedStep}</p>
    <p class="small muted" style="margin:0">Engine: ${r.engine === 'rule-based' ? 'transparent rule-based checks (no AI API connected)' : r.engine}. ${r.note}</p>
  </div>`;
}

export function txnTable(rows, meta, { admin = false, actions = false } = {}) {
  if (!rows.length) return html`<p class="muted">No transactions match these filters.</p>`;
  return html`
  <div class="table-wrap collapse"><table>
    <thead><tr><th>ID</th><th>Date</th>${admin ? html`<th>Sender</th>` : ''}<th>To</th><th>Recipient</th><th class="right">Sent</th><th class="right">Received</th><th>Status</th><th>Risk</th>${actions ? html`<th></th>` : ''}</tr></thead>
    <tbody>${rows.map((t) => { const c = countryOf(meta, t.country); return html`
      <tr class="click" data-href="#/receipt/${t.txn_id}" tabindex="0">
        <td class="mono">${t.txn_id}</td><td>${fmtDate(t.created_at)}</td>${admin ? html`<td>${t.sender_email}</td>` : ''}
        <td>${flagEl(c)} ${c.name}</td><td>${t.recipient_name}</td>
        <td class="right">${fmtInr(t.amount_inr)}</td><td class="right">${fmtMoney(t.recipient_amount, t.receive_currency, meta)}</td>
        <td>${badge(t.status)}</td><td>${badge(t.risk_level, t.risk_level)}</td>
        ${actions ? html`<td>${t.status === 'pending' ? html`<button class="btn small" data-settle="${t.txn_id}:successful">Mark successful</button> <button class="btn small secondary" data-settle="${t.txn_id}:failed">Mark failed</button>` : ''}</td>` : ''}
      </tr>`; })}</tbody>
  </table></div>
  <div class="cards-mobile">${rows.map((t) => { const c = countryOf(meta, t.country); return html`
    <div class="tcard" data-href="#/receipt/${t.txn_id}" tabindex="0">
      <div class="top"><b>${flagEl(c)} ${t.recipient_name}</b>${badge(t.status)}</div>
      <div class="small muted mono">${t.txn_id}</div>
      <div style="display:flex;justify-content:space-between;margin-top:.3rem"><span>${fmtInr(t.amount_inr)}</span><span>${fmtMoney(t.recipient_amount, t.receive_currency, meta)}</span></div>
      <div class="small muted">${fmtDate(t.created_at)}</div>
    </div>`; })}</div>`;
}

/** Make rows/cards with data-href navigable by click or Enter. */
export function wireRows(el) {
  el.querySelectorAll('[data-href]').forEach((r) => {
    const go = () => { location.hash = r.dataset.href; };
    r.addEventListener('click', (e) => { if (!e.target.closest('button')) go(); });
    r.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}

export function receiptBody(t, meta, alert) {
  const c = countryOf(meta, t.country);
  return html`
  <dl class="kv">
    <dt>Transaction ID</dt><dd class="mono">${t.txn_id}</dd>
    <dt>Status</dt><dd>${badge(t.status)} ${t.failure_reason ? html`<div class="small muted">${t.failure_reason}</div>` : ''}</dd>
    <dt>Date</dt><dd>${fmtDate(t.created_at)}</dd>
    <dt>Sender</dt><dd>${t.sender_name || ''}</dd>
    <dt>Destination</dt><dd>${flagEl(c)} ${c.name}</dd>
    <dt>Recipient</dt><dd>${t.recipient_name}<div class="small muted mono">${t.recipient_identifier} (simulated identifier)</div></dd>
    <dt>Amount sent</dt><dd>${fmtInr(t.amount_inr)}</dd>
    <dt>Transfer fee</dt><dd>${fmtInr(t.fee_inr)} <span class="small muted">(proposed target, illustrative)</span></dd>
    <dt>Rate markup</dt><dd>${t.markup_percent}% ≈ ${fmtInr(t.markup_cost_inr)} <span class="small muted">(included in rate)</span></dd>
    <dt>Total paid</dt><dd><b>${fmtInr(t.total_payable_inr)}</b></dd>
    <dt>Conversion rate</dt><dd>1 INR = ${t.effective_rate} ${t.receive_currency}<div class="small muted">${t.rate_source === 'live' ? 'Indicative rate' : 'SAMPLE rate, not a live market rate'} · updated ${fmtDate(t.rate_updated_at)}</div></dd>
    <dt>Recipient receives</dt><dd><b>${fmtMoney(t.recipient_amount, t.receive_currency, meta)}</b> <span class="small muted">(estimate)</span></dd>
    <dt>Risk check</dt><dd>${badge(t.risk_level, `${t.risk_level} · ${t.risk_score}`)}</dd>
  </dl>
  ${alert ? html`<div class="alert warn" style="margin-top:1rem"><b>Flagged for verification:</b> ${alert.suggested_step}</div>` : ''}`;
}
