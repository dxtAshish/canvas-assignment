'use strict';

const path = require('path');
const Joi = require('joi');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

/**
 * Validates environment variables once at startup so misconfiguration fails fast
 * with a readable message instead of surfacing later as a confusing runtime error.
 */
const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(5000),
  // Comma-separated browser origins allowed to call the API (the Vite dev server in development).
  CLIENT_ORIGINS: Joi.string().default('http://localhost:5173'),
  // Built frontend (vite build) served by the API server in production. Relative to backend/.
  FRONTEND_DIST: Joi.string().default('../frontend/dist'),
  DB_HOST: Joi.string().default('127.0.0.1'),
  DB_PORT: Joi.number().port().default(3306),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_NAME: Joi.string().pattern(/^[A-Za-z0-9_]+$/).default('dashboard_builder'),
  DB_CONNECTION_LIMIT: Joi.number().integer().min(1).max(100).default(10),
  JWT_SECRET: Joi.string().min(32).required()
    .messages({ 'string.min': 'JWT_SECRET must be at least 32 characters long' }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  UPLOAD_MAX_MB: Joi.number().min(1).max(20).default(5),
}).unknown(true);

const { value: env, error } = schema.validate(process.env, { abortEarly: false });

if (error) {
  const details = error.details.map((d) => `  - ${d.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${details}\nSee .env.example for reference.`);
  process.exit(1);
}

module.exports = Object.freeze({
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  clientOrigins: env.CLIENT_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  frontendDist: path.resolve(__dirname, '../..', env.FRONTEND_DIST),
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: env.DB_CONNECTION_LIMIT,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  cookie: {
    name: 'db_session',
    secure: env.COOKIE_SECURE,
  },
  uploads: {
    dir: path.resolve(__dirname, '../../uploads'),
    maxBytes: env.UPLOAD_MAX_MB * 1024 * 1024,
  },
});
