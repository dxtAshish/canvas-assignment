'use strict';

const fs = require('fs');
const express = require('express');
const config = require('../config/env');
const webController = require('../controllers/web.controller');
const uploadController = require('../controllers/upload.controller');
const { requireAuth, requirePageAuth, redirectIfAuthenticated } = require('../middlewares/auth.middleware');

const router = express.Router();

// Uploaded images are private: only their owner can fetch them.
router.get('/uploads/:name', requireAuth, uploadController.serveImage);

/*
 * In production the API server also serves the built frontend (frontend/dist),
 * so the app runs on a single origin. During development the Vite dev server
 * serves the frontend and proxies /api and /uploads here instead.
 */
if (fs.existsSync(config.frontendDist)) {
  router.use('/assets', express.static(`${config.frontendDist}/assets`, { immutable: true, maxAge: '1y' }));
  router.use(express.static(config.frontendDist, { index: false, maxAge: config.isProduction ? '1h' : 0 }));

  router.get('/', webController.home);
  router.get('/login', redirectIfAuthenticated, webController.page('login.html'));
  router.get('/register', redirectIfAuthenticated, webController.page('register.html'));
  router.get('/dashboards', requirePageAuth, webController.page('dashboards.html'));
  router.get(/^\/dashboards\/\d+$/, requirePageAuth, webController.page('builder.html'));
}

module.exports = router;
