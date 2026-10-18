export const state = { meta: null, user: null, token: null };

const KEY = 'ubg_token';
export function loadSession() {
  try { state.token = sessionStorage.getItem(KEY); } catch { state.token = null; }
}
export function saveSession(token, user) {
  state.token = token; state.user = user;
  try { sessionStorage.setItem(KEY, token); } catch { /* storage unavailable */ }
}
export function clearSession() {
  state.token = null; state.user = null;
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(message, status, field, code) { super(message); this.status = status; this.field = field; this.code = code; }
}

export async function api(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  if (raw && res.ok) return res;
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    if (res.status === 401 && state.token) { clearSession(); location.hash = '#/login'; }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.field, data?.code);
  }
  return data;
}

export async function demoLogin(role) {
  const r = await api('/api/auth/demo', { method: 'POST', body: { role } });
  saveSession(r.token, r.user);
  return r.user;
}
