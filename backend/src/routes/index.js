'use strict';

const { Router } = require('express');
const { apiLimiter } = require('../middlewares/rateLimit.middleware');
const sameOrigin = require('../middlewares/sameOrigin.middleware');
const healthController = require('../controllers/health.controller');

/** API router mounted at /api. */
const router = Router();

router.use(apiLimiter);
router.use(sameOrigin);

router.get('/health', healthController.check);
router.use('/meta', require('./meta.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/dashboards', require('./dashboard.routes'));
router.use('/uploads', require('./upload.routes'));
router.use('/chart-data', require('./chartData.routes'));

module.exports = router;
