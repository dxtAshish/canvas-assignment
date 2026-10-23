/** Application URLs (kept in one place so pages never hard-code paths). */
export const ROUTES = Object.freeze({
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARDS: '/dashboards',
  builder: (id) => `/dashboards/${id}`,
});

/** Extracts the dashboard id from /dashboards/:id, or null. */
export function dashboardIdFromPath(pathname = window.location.pathname) {
  const match = /^\/dashboards\/(\d+)\/?$/.exec(pathname);
  return match ? Number(match[1]) : null;
}
