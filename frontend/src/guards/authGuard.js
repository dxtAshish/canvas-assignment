import { authApi } from '../api/auth.api.js';
import { ROUTES } from '../config/routes.js';

/**
 * Client-side route guards. The backend also guards pages it serves in
 * production; these cover the Vite dev server and expired sessions.
 */
export async function requireAuth() {
  try {
    return await authApi.me();
  } catch (err) {
    if (err.status === 401) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`${ROUTES.LOGIN}?next=${next}`);
      return new Promise(() => {}); // never resolves: navigation is in progress
    }
    throw err;
  }
}

/** Login/register pages: signed-in users go straight to their dashboards. */
export async function redirectIfAuthenticated() {
  try {
    await authApi.me();
    window.location.replace(ROUTES.DASHBOARDS);
  } catch {
    /* not signed in (or API unreachable): stay on the page */
  }
}
