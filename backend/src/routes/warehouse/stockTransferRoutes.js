const express = require('express');
const router = express.Router();
const transferController = require('../../controllers/warehouse/stockTransferController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');
const idempotencyMiddleware = require('../../middleware/idempotencyMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', transferController.getAllTransfers);
router.post('/', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER', 'DISPATCH_OPERATOR'), transferController.createTransfer);
router.put('/:id/dispatch', idempotencyMiddleware, authorizeRoles('WAREHOUSE_ADMIN', 'DISPATCH_OPERATOR'), transferController.dispatchTransfer);
router.post('/:id/notify', authorizeRoles('WAREHOUSE_ADMIN', 'DISPATCH_OPERATOR'), transferController.notifyPharmacyDispatchHandler);

module.exports = router;
