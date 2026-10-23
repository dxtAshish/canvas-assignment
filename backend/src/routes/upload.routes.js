'use strict';

const { Router } = require('express');
const controller = require('../controllers/upload.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { singleImage } = require('../middlewares/upload.middleware');

const router = Router();

router.post('/images', requireAuth, singleImage, controller.uploadImage);

module.exports = router;
