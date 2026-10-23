/**
 * Thin fetch wrapper: JSON in/out, consistent error objects, session expiry handling.
 */
export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const DEFAULT_TIMEOUT_MS = 20000;

async function request(method, url, { body, signal, timeout = DEFAULT_TIMEOUT_MS, redirectOn401 = true } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeout);
  signal?.addEventListener('abort', () => controller.abort(signal.reason), { once: true });

  const isForm = body instanceof FormData;
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(body && !isForm && { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    const timedOut = controller.signal.reason?.name === 'TimeoutError';
    throw new ApiError(0, timedOut ? 'TIMEOUT' : 'NETWORK_ERROR', timedOut
      ? 'The server took too long to respond. Please try again.'
      : 'Cannot reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON response (e.g. proxy error page) handled below */
  }

  if (!response.ok) {
    const error = payload?.error || {};
    if (response.status === 401 && redirectOn401) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ApiError(response.status, error.code || 'HTTP_ERROR',
      error.message || `Request failed (${response.status}).`, error.details || []);
  }
  return payload?.data ?? null;
}

/** Low-level HTTP helpers. Prefer the resource modules (auth.api.js, dashboard.api.js, ...). */
export const httpClient = {
  get: (url, opts) => request('GET', url, opts),
  post: (url, body, opts) => request('POST', url, { ...opts, body }),
  put: (url, body, opts) => request('PUT', url, { ...opts, body }),
  patch: (url, body, opts) => request('PATCH', url, { ...opts, body }),
  delete: (url, opts) => request('DELETE', url, opts),
};
