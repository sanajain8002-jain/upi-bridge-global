// Safe templating: every interpolated value is HTML-escaped unless wrapped with raw().
export const raw = (s) => ({ __raw: String(s) });
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const part = (v) => {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(part).join('');
  if (typeof v === 'object' && v.__raw !== undefined) return v.__raw;
  return esc(v);
};
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s + (i < vals.length ? part(vals[i]) : ''); });
  return raw(out);
}

const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h2M14 19h2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  brain: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 1V2z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  download: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  id: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M13 10h5M13 14h4"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
};
export const icon = (name, size = 20) =>
  raw(`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);

// ---------- formatting ----------
export function fmtNum(n, decimals = 2) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export const fmtInr = (n) =>
  '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function fmtMoney(n, code, meta) {
  const d = meta?.currencies?.[code]?.decimals ?? 2;
  if (code === 'INR') return fmtInr(n);
  return `${code} ${fmtNum(n, d)}`;
}
export const fmtDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtDay = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
export const statusLabel = (s) => ({ successful: 'Successful', pending: 'Pending', failed: 'Failed', not_started: 'Not started', under_review: 'Under review', submitted: 'Submitted', verified: 'Verified' }[s] || s);
export const badge = (kind, text) => html`<span class="badge ${kind}">${text ?? statusLabel(kind)}</span>`;
export const simTag = html`<span class="sim-tag">SIMULATED</span>`;
export function countryOf(meta, code) {
  return meta.countries.find((c) => c.code === code) || { code, name: code, flag: '🏳️', currency: '' };
}
/** Flag as a bundled SVG (emoji flags do not render on Windows). Pass a country object. */
export const flagEl = (c) => raw(`<span class="fi fi-${esc(String(c.code).toLowerCase())}" role="img" aria-label="${esc(c.name)} flag"></span>`);
/** <option>s grouped by region. Restricted corridors are omitted unless includeRestricted. */
export function countryOptions(meta, selected = '', { includeRestricted = false } = {}) {
  const list = meta.countries.filter((c) => includeRestricted || !c.restricted);
  const regions = [...new Set(list.map((c) => c.region))];
  return html`${regions.map((r) => html`<optgroup label="${r}">${list.filter((c) => c.region === r).map((c) => html`<option value="${c.code}" ${c.code === selected ? 'selected' : ''}>${c.name} · ${c.currency}</option>`)}</optgroup>`)}`;
}
