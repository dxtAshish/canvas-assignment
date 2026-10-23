'use strict';

const { Router } = require('express');
const controller = require('../controllers/dashboard.controller');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const { idParam } = require('../validators/common.validator');
const schemas = require('../validators/dashboard.validator');

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', validate({ body: schemas.createDashboard }), controller.create);
router.put('/order', validate({ body: schemas.reorderDashboards }), controller.reorder); // before /:id routes
router.get('/:id', validate({ params: idParam }), controller.show);
router.patch('/:id', validate({ params: idParam, body: schemas.updateDashboard }), controller.update);
router.delete('/:id', validate({ params: idParam }), controller.remove);
router.put('/:id/layout', validate({ params: idParam, body: schemas.saveLayout }), controller.saveLayout);

module.exports = router;
