import { httpClient } from './httpClient.js';

export const uploadApi = {
  /** Uploads one image file; resolves to `{ url, storedName, mimeType, ... }`. */
  uploadImage(file) {
    const form = new FormData();
    form.append('image', file);
    return httpClient.post('/api/uploads/images', form, { timeout: 60000 });
  },
};
