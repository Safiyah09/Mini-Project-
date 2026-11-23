const express = require('express');
const router = express.Router();
const batchController = require('../../controllers/warehouse/batchController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', batchController.getAllBatches);
router.get('/:id', batchController.getBatchById);
router.post('/', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER'), batchController.createBatch);
router.put('/:id', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER'), batchController.updateBatch);

module.exports = router;
