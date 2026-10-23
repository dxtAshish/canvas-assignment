import { httpClient } from './httpClient.js';

export const chartDataApi = {
  /** Freshly generated (dummy) data for a dynamic chart dataset. */
  getDataset: (dataset, points, { signal } = {}) => httpClient.get(
    `/api/chart-data/${encodeURIComponent(dataset)}?points=${Number(points)}`,
    { signal },
  ),
};
