import { httpClient } from './httpClient.js';

export const metaApi = {
  /** Validation limits and chart datasets shared by the backend. */
  getConfig: () => httpClient.get('/api/meta/config'),
};
