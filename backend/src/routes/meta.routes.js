'use strict';

const { Router } = require('express');
const controller = require('../controllers/meta.controller');

const router = Router();

router.get('/config', controller.getConfig);

module.exports = router;
