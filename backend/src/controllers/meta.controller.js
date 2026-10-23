'use strict';

const config = require('../config/env');
const { CANVAS, SECTION, ELEMENT, TEXT, CHART, IMAGE } = require('../constants/limits');
const chartDataService = require('../services/chartData.service');

/**
 * Business limits shared with the frontend so its client-side validation always
 * matches the API's rules (single source of truth).
 */
function getConfig(_req, res) {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    data: {
      CANVAS,
      SECTION,
      ELEMENT,
      TEXT,
      CHART,
      IMAGE: { FITS: IMAGE.FITS, MIME_TYPES: Object.keys(IMAGE.MIME_TYPES) },
      DATASETS: chartDataService.listDatasets(),
      UPLOAD_MAX_BYTES: config.uploads.maxBytes,
    },
  });
}

module.exports = { getConfig };
