'use strict';

const { Router } = require('express');
const controller = require('../controllers/chartData.controller');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const schemas = require('../validators/chartData.validator');

const router = Router();

router.use(requireAuth);

router.get('/', controller.listDatasets);
router.get('/:dataset', validate({ params: schemas.datasetParams, query: schemas.datasetQuery }), controller.getDataset);

module.exports = router;
