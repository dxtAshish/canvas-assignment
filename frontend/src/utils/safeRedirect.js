/**
 * Returns `target` only if it is a same-site relative path (prevents open
 * redirects through ?next=), otherwise the fallback.
 */
export function safeRedirect(target, fallback = '/dashboards') {
  return typeof target === 'string' && /^\/(?!\/)[\w\-/?=&%.]*$/.test(target) ? target : fallback;
}
