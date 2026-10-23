'use strict';

const { Joi } = require('./common.validator');
const { CHART } = require('../constants/limits');
const { DATASET_KEYS } = require('../services/chartData.service');

const datasetParams = Joi.object({
  dataset: Joi.string().valid(...DATASET_KEYS).required()
    .messages({ 'any.only': `dataset must be one of: ${DATASET_KEYS.join(', ')}` }),
});

const datasetQuery = Joi.object({
  points: Joi.number().integer().min(CHART.MIN_POINTS).max(CHART.MAX_POINTS).default(6),
});

module.exports = { datasetParams, datasetQuery };
