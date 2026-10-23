import { httpClient } from './httpClient.js';

/** Auth endpoints. 401 must not auto-redirect here: these calls decide where to go. */
export const authApi = {
  login: (credentials) => httpClient.post('/api/auth/login', credentials, { redirectOn401: false }),
  register: (data) => httpClient.post('/api/auth/register', data, { redirectOn401: false }),
  logout: () => httpClient.post('/api/auth/logout', undefined, { redirectOn401: false }),
  me: () => httpClient.get('/api/auth/me', { redirectOn401: false }),
};
