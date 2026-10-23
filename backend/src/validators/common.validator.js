'use strict';

const Joi = require('joi');
const { HEX_COLOR } = require('../constants/limits');

/** Reusable Joi building blocks. */
const id = Joi.number().integer().positive().max(4294967295);
const hexColor = Joi.string().trim().pattern(HEX_COLOR)
  .messages({ 'string.pattern.base': '{{#label}} must be a hex color like #1a2b3c' });
const coordinate = Joi.number().integer().min(0);
const size = Joi.number().integer().positive();
const zIndex = Joi.number().integer().min(0).max(10000).default(1);

const idParam = Joi.object({ id: id.required() });

module.exports = { Joi, id, hexColor, coordinate, size, zIndex, idParam };
