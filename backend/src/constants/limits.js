'use strict';

/**
 * Business limits shared by validators and services.
 * Kept in one place so the API contract is easy to read and change.
 * Exposed to the frontend via GET /api/meta/config so the browser validates identically.
 */
module.exports = Object.freeze({
  CANVAS: {
    MIN_WIDTH: 800,
    MAX_WIDTH: 2400,
    MAX_Y: 20000,
  },
  SECTION: {
    MIN_WIDTH: 120,
    MIN_HEIGHT: 80,
    MAX_HEIGHT: 5000,
    MAX_PER_DASHBOARD: 50,
  },
  ELEMENT: {
    TYPES: ['text', 'image', 'chart'],
    MIN_WIDTH: 40,
    MIN_HEIGHT: 30,
    MAX_PER_SECTION: 30,
    MAX_PER_DASHBOARD: 300,
  },
  TEXT: {
    MAX_HTML_LENGTH: 20000,
    MIN_FONT_PX: 8,
    MAX_FONT_PX: 96,
  },
  CHART: {
    TYPES: ['bar', 'line'],
    SOURCES: ['manual', 'dynamic'],
    MIN_POINTS: 2,
    MAX_POINTS: 24,
    MAX_SERIES: 5,
    REFRESH_OPTIONS: [0, 5, 10, 30, 60],
  },
  IMAGE: {
    FITS: ['cover', 'contain', 'fill'],
    MIME_TYPES: {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
    },
    URL_PATTERN: /^\/uploads\/([A-Za-z0-9-]{1,56}\.(?:png|jpg|gif|webp))$/,
  },
  HEX_COLOR: /^#[0-9a-fA-F]{6}$/,
});
