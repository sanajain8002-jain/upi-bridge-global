import { state, api, loadSession, saveSession, clearSession, demoLogin } from './api.js';
import { html, raw, icon, esc } from './util.js';
import * as pub from './views-public.js';
import * as usr from './views-user.js';
import * as adm from './views-admin.js';

const root = document.getElementById('app');

// path -> { view, access: 'none' | 'user' | 'admin', layout: 'public' | 'app' }
const ROUTES = [
  ['/', pub.landing, 'none', 'public'],
  ['/login', pub.login, 'none', 'public'],
  ['/rates', pub.rates, 'none', 'public'],
  ['/about', pub.about, 'none', 'public'],
  ['/guide', pub.guide, 'none', 'public'],
  ['/dashboard', usr.dashboard, 'user', 'app'],
  ['/send', usr.send, 'user', 'app'],
  ['/history', usr.history, 'user', 'app'],
  ['/receipt/:id', usr.receipt, 'user', 'app'],
  ['/kyc', usr.kyc, 'user', 'app'],
  ['/risk', usr.risk, 'user', 'app'],
  ['/admin', adm.admin, 'admin', 'app'],
];

function match(path) {
  for (const [pattern, view, access, layout] of ROUTES) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
    const m = path.match(re);
    if (m) return { view, access, layout, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export function go(path) { location.hash = '#' + path; }
export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
export function logout() { clearSession(); go('/'); }


const NAV = [
  ['/dashboard', 'Dashboard', 'home'],
  ['/send', 'Send money', 'send'],
  ['/history', 'Transactions', 'list'],
  ['/rates', 'Rates & fees', 'calc'],
  ['/kyc', 'KYC demo', 'id'],
  ['/risk', 'Risk assistant', 'brain'],
];

function appLayout(path, content) {
  const items = [...NAV];
  if (state.user?.role === 'admin') items.push(['/admin', 'Admin', 'settings']);
  items.push(['/about', 'About & compliance', 'info']);
  const link = (p, label, ic) => html`<a href="#${p}" class="${path === p || (p === '/history' && path.startsWith('/receipt')) ? 'active' : ''}">${icon(ic, 19)}<span>${label}</span></a>`;
  const mobile = items.filter(([p]) => p !== '/rates' && p !== '/about').slice(0, 6);
  return html`
  <div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#/dashboard"><span class="logo">${icon('globe', 20)}</span>UPI Bridge Global</a>
      <nav class="nav" aria-label="Main">${items.map(([p, l, i]) => link(p, l, i))}</nav>
      <div class="spacer"></div>
      <div class="small muted" style="padding:.5rem .6rem">Signed in as<br><b>${state.user.name}</b><br>${state.user.role === 'admin' ? 'Demo administrator' : 'Demo user'}</div>
      <button class="btn secondary" data-logout>${icon('logout', 17)} Sign out</button>
    </aside>
    <main class="main" id="main">${content}</main>
  </div>
  <nav class="bottomnav" aria-label="Main">${mobile.map(([p, l, i]) => html`<a href="#${p}" class="${path === p ? 'active' : ''}">${icon(i, 20)}<span>${l.split(' ')[0]}</span></a>`)}</nav>`;
}

function publicLayout(path, content) {
  const l = (p, t) => html`<a class="plain" href="#${p}" ${path === p ? raw('style="font-weight:700;color:var(--purple)"') : ''}>${t}</a>`;
  return html`
  <header class="topbar-public"><div class="inner">
    <a class="brand" href="#/" style="padding:0"><span class="logo">${icon('globe', 20)}</span>UPI Bridge Global</a>
    <nav class="links" aria-label="Main">
      ${l('/', 'Home')}${l('/rates', 'Calculator')}${l('/guide', 'Guided demo')}${l('/about', 'About')}
      ${state.user
        ? html`<a class="btn small" href="#/dashboard">Open dashboard</a>`
        : html`<a class="btn small" href="#/login">Sign in / Demo</a>`}
    </nav>
  </div></header>
  <main id="main">${content}</main>`;
}

let renderToken = 0;
async function render() {
  const token = ++renderToken;
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = hash.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const m = match(path);

  const banner = html`<div class="sim-banner"><b>SIMULATED DEMO</b> · No real money moves. Rates shown are sample values, not live market rates.</div>`;
  const paint = (inner, layout, mount) => {
    if (token !== renderToken) return;
    const body = layout === 'app' ? appLayout(path, inner) : publicLayout(path, inner);
    root.innerHTML = banner.__raw + body.__raw;
    root.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', logout));
    window.scrollTo(0, 0);
    mount?.(root.querySelector('#main'));
  };

  if (!m) return paint(html`<div class="landing" style="padding-top:3rem"><h1>Page not found</h1><p><a href="#/">Go home</a></p></div>`, 'public');

  if (m.access !== 'none') {
    if (!state.token) return go('/login');
    if (!state.user) {
      try { state.user = (await api('/api/auth/me')).user; } catch { return go('/login'); }
    }
    if (m.access === 'admin' && state.user.role !== 'admin') {
      return paint(html`<div class="card"><h2>Administrator access required</h2><p class="muted">This area is limited to the demo administrator. Sign in with the demo admin account from the login page.</p><a class="btn" href="#/dashboard">Back to dashboard</a></div>`, 'app');
    }
  }
  paint(html`<div class="card muted">Loading…</div>`, m.layout);
  try {
    const out = await m.view({ params: m.params, query, go, toast, meta: state.meta, user: state.user });
    paint(out.html, m.layout, out.mount);
  } catch (e) {
    paint(html`<div class="alert bad">${e.message || 'Something went wrong.'}</div><a class="btn secondary" href="#/">Home</a>`, m.layout);
  }
}

async function boot() {
  loadSession();
  try {
    state.meta = await api('/api/meta');
  } catch (e) {
    root.innerHTML = `<div style="padding:2rem;font-family:sans-serif">Could not load the app: ${esc(e.message)}</div>`;
    return;
  }
  if (state.token) {
    try { state.user = (await api('/api/auth/me')).user; } catch { clearSession(); }
  }
  window.addEventListener('hashchange', render);
  render();
}
boot();

// Generic live filter for long tables (rates): <input data-table-filter> filters <tr data-q> in the same card.
document.addEventListener('input', (e) => {
  if (!e.target.matches?.('[data-table-filter]')) return;
  const q = e.target.value.trim().toLowerCase();
  const scope = e.target.closest('.card') || document;
  scope.querySelectorAll('tbody tr[data-q]').forEach((tr) => { tr.hidden = !!q && !tr.dataset.q.includes(q); });
});
