'use strict';

const { Joi } = require('./common.validator');

const email = Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254)
  .messages({ 'string.email': 'Please enter a valid email address' });

// bcrypt only uses the first 72 bytes, so longer passwords are rejected explicitly.
const password = Joi.string().min(8).max(72)
  .pattern(/[a-z]/, 'lowercase')
  .pattern(/[A-Z]/, 'uppercase')
  .pattern(/\d/, 'digit')
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password must be at most 72 characters',
    'string.pattern.name': 'Password must contain at least one {#name} character',
  });

const register = Joi.object({
  name: Joi.string().trim().min(2).max(50).pattern(/^[\p{L}\p{M}' .-]+$/u)
    .messages({ 'string.pattern.base': 'Name may only contain letters, spaces, apostrophes, dots and hyphens' })
    .required(),
  email: email.required(),
  password: password.required(),
});

const login = Joi.object({
  email: email.required(),
  password: Joi.string().max(72).required(),
});

module.exports = { register, login };
