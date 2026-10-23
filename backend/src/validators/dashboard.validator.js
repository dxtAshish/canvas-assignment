'use strict';

const {
  Joi, id, hexColor, coordinate, size, zIndex,
} = require('./common.validator');
const { CANVAS, SECTION, ELEMENT, TEXT, CHART, IMAGE } = require('../constants/limits');
const { DATASET_KEYS } = require('../services/chartData.service');

const name = Joi.string().trim().min(1).max(100);
const description = Joi.string().trim().max(500).allow('');
const canvasWidth = Joi.number().integer().min(CANVAS.MIN_WIDTH).max(CANVAS.MAX_WIDTH);

const createDashboard = Joi.object({
  name: name.required(),
  description: description.default(''),
  canvasWidth: canvasWidth.default(1200),
  backgroundColor: hexColor.default('#f4f6fb'),
});

const updateDashboard = Joi.object({
  name,
  description,
  canvasWidth,
  backgroundColor: hexColor,
}).min(1).messages({ 'object.min': 'Provide at least one field to update' });

/* ---------------------------- element content ---------------------------- */

const textContent = Joi.object({
  html: Joi.string().max(TEXT.MAX_HTML_LENGTH).allow('').default(''),
  backgroundColor: Joi.alternatives(hexColor, Joi.string().valid('transparent')).default('transparent'),
});

const imageContent = Joi.object({
  url: Joi.string().pattern(IMAGE.URL_PATTERN).allow('').default('')
    .messages({ 'string.pattern.base': 'Image url must reference an uploaded image' }),
  alt: Joi.string().trim().max(200).allow('').default(''),
  fit: Joi.string().valid(...IMAGE.FITS).default('cover'),
});

const chartSeries = Joi.object({
  label: Joi.string().trim().max(40).allow('').default(''),
  color: hexColor.required(),
  data: Joi.array().items(Joi.number().min(-1e9).max(1e9)).max(CHART.MAX_POINTS).default([]),
});

const chartContent = Joi.object({
  chartType: Joi.string().valid(...CHART.TYPES).required(),
  title: Joi.string().trim().max(100).allow('').default(''),
  source: Joi.string().valid(...CHART.SOURCES).default('manual'),
  dataset: Joi.string().valid(...DATASET_KEYS).default(DATASET_KEYS[0]),
  points: Joi.number().integer().min(CHART.MIN_POINTS).max(CHART.MAX_POINTS).default(6),
  refreshSeconds: Joi.number().integer().valid(...CHART.REFRESH_OPTIONS).default(0),
  labels: Joi.array().items(Joi.string().trim().max(30).allow('')).max(CHART.MAX_POINTS).default([]),
  series: Joi.array().items(chartSeries).min(1).max(CHART.MAX_SERIES).required(),
});

const element = Joi.object({
  id: Joi.any().strip(), // client-side keys are not persisted
  type: Joi.string().valid(...ELEMENT.TYPES).required(),
  x: coordinate.required(),
  y: coordinate.required(),
  width: size.min(ELEMENT.MIN_WIDTH).required(),
  height: size.min(ELEMENT.MIN_HEIGHT).required(),
  zIndex,
  content: Joi.when('type', {
    switch: [
      { is: 'text', then: textContent.required() },
      { is: 'image', then: imageContent.required() },
      { is: 'chart', then: chartContent.required() },
    ],
  }),
});

const section = Joi.object({
  id: Joi.any().strip(),
  title: Joi.string().trim().max(100).allow('').default(''),
  x: coordinate.required(),
  y: coordinate.max(CANVAS.MAX_Y).required(),
  width: size.min(SECTION.MIN_WIDTH).max(CANVAS.MAX_WIDTH).required(),
  height: size.min(SECTION.MIN_HEIGHT).max(SECTION.MAX_HEIGHT).required(),
  zIndex,
  backgroundColor: hexColor.default('#ffffff'),
  elements: Joi.array().items(element).max(ELEMENT.MAX_PER_SECTION).default([]),
});

const saveLayout = Joi.object({
  version: Joi.number().integer().positive().required(),
  // Optional dashboard settings saved atomically together with the layout.
  settings: Joi.object({
    name: name.required(),
    description: description.default(''),
    canvasWidth: canvasWidth.required(),
    backgroundColor: hexColor.required(),
  }),
  sections: Joi.array().items(section).max(SECTION.MAX_PER_DASHBOARD).required(),
});

const reorderDashboards = Joi.object({
  // Dashboard ids in their new display order (first = shown first).
  ids: Joi.array().items(id.required()).min(1).max(500).unique().required()
    .messages({ 'array.unique': 'ids must not contain duplicates' }),
});

module.exports = {
  createDashboard, updateDashboard, saveLayout, reorderDashboards,
};
