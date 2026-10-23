'use strict';

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const apiRoutes = require('./routes');
const webRoutes = require('./routes/web.routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler.middleware');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // inline styles are needed for element positioning
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: config.cookie.secure ? [] : null,
    },
  },
  // HSTS only makes sense when served over HTTPS.
  strictTransportSecurity: config.cookie.secure,
}));

if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

app.use('/api', apiRoutes);
app.use('/', webRoutes); // private uploads + the built frontend (production)

app.use(notFound);
app.use(errorHandler);

module.exports = app;
