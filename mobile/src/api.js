import { API_URL, API_HEADERS } from './theme';

let _tokens = null;
let _onTokensUpdated = null;
let _refreshPromise = null;

export function setTokens(tokens, onUpdated) {
  _tokens = tokens;
  if (onUpdated) _onTokensUpdated = onUpdated;
}

export function getTokens() {
  return _tokens;
}

export function authHeaders() {
  if (!_tokens?.access) return API_HEADERS;
  return { ...API_HEADERS, Authorization: `Bearer ${_tokens.access}` };
}

async function _refreshTokens(timeoutMs) {
  if (!_tokens?.refresh) return false;
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await fetchWithTimeout(`${API_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ refresh: _tokens.refresh }),
      }, timeoutMs);
      if (!res.ok) return false;
      const data = await res.json();
      if (data.access) {
        _tokens = { ..._tokens, access: data.access };
        if (data.refresh) _tokens.refresh = data.refresh;
        if (_onTokensUpdated) _onTokensUpdated(_tokens);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  if (!timeoutMs) return fetch(url, options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) controller.abort();
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new Error('The request took too long. Please check your connection and retry.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export async function apiFetch(path, options = {}) {
  // Opt in on slow list screens and push registration; other callers keep their behavior.
  const { timeoutMs, ...requestOptions } = options;
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  // Robust FormData detection for RN SDK 57 TurboModules
  const isFormData = !!(
    options.body &&
    (options.body instanceof FormData ||
     Object.prototype.toString.call(options.body) === '[object FormData]' ||
     typeof options.body.getParts === 'function' ||
     options.body._parts)
  );

  const baseHeaders = _tokens?.access
    ? { Authorization: `Bearer ${_tokens.access}` }
    : {};

  if (!isFormData && !options.headers?.['Content-Type']) {
    baseHeaders['Content-Type'] = 'application/json';
  }

  baseHeaders['ngrok-skip-browser-warning'] = 'true';

  const headers = { ...baseHeaders, ...(options.headers || {}) };

  if (isFormData) {
    delete headers['Content-Type'];
  }

  let res = await fetchWithTimeout(url, { ...requestOptions, headers }, timeoutMs);

  if (res.status === 401 && _tokens?.refresh) {
    const refreshed = await _refreshTokens(timeoutMs);
    if (refreshed) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${_tokens.access}` };
      if (isFormData) delete retryHeaders['Content-Type'];
      res = await fetchWithTimeout(url, { ...requestOptions, headers: retryHeaders }, timeoutMs);
    }
  }

  return res;
}
