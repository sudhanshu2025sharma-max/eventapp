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

function waitForRefresh(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => {
      cleanup();
      const error = new Error('Token refresh timed out or was canceled.');
      error.name = 'AbortError';
      reject(error);
    };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      value => { cleanup(); resolve(value); },
      error => { cleanup(); reject(error); },
    );
  });
}

async function _refreshTokens(signal) {
  if (!_tokens?.refresh) return false;
  if (_refreshPromise) return waitForRefresh(_refreshPromise, signal);

  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ refresh: _tokens.refresh }),
        signal,
      });
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

  return waitForRefresh(_refreshPromise, signal);
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

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

  const { timeoutMs, ...fetchOptions } = options;
  let controller = null;
  let timeoutId = null;

  if (timeoutMs && typeof AbortController !== 'undefined') {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    fetchOptions.signal = controller.signal;
  }

  try {
    let res = await fetch(url, { ...fetchOptions, headers });

    if (res.status === 401 && _tokens?.refresh) {
      const refreshed = await _refreshTokens(fetchOptions.signal);
      if (refreshed) {
        const retryHeaders = { ...headers, Authorization: `Bearer ${_tokens.access}` };
        if (isFormData) delete retryHeaders['Content-Type'];
        res = await fetch(url, { ...fetchOptions, headers: retryHeaders });
      }
    }

    return res;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
