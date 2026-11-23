const express = require('express');
const router = express.Router();
const adjController = require('../../controllers/warehouse/stockAdjustmentController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');
const idempotencyMiddleware = require('../../middleware/idempotencyMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', adjController.getAllAdjustments);
router.post('/', idempotencyMiddleware, authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER'), adjController.createAdjustment);

module.exports = router;
