import { httpClient } from './httpClient.js';

const BASE = '/api/dashboards';

export const dashboardApi = {
  list: () => httpClient.get(BASE),
  get: (id) => httpClient.get(`${BASE}/${id}`),
  create: (data) => httpClient.post(BASE, data),
  update: (id, data) => httpClient.patch(`${BASE}/${id}`, data),
  remove: (id) => httpClient.delete(`${BASE}/${id}`),
  /** Saves the display order (ids first → last). */
  reorder: (ids) => httpClient.put(`${BASE}/order`, { ids }),
  /** Persists the full layout; `payload.version` enables optimistic locking (409 on conflict). */
  saveLayout: (id, payload) => httpClient.put(`${BASE}/${id}/layout`, payload),
};
