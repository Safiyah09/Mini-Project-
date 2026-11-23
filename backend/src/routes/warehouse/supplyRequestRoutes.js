const express = require('express');
const router = express.Router();
const reqController = require('../../controllers/warehouse/supplyRequestController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', reqController.getAllSupplyRequests);
router.get('/:id', reqController.getSupplyRequestById);
router.get('/:id/history', reqController.getStatusHistory);
router.put('/:id/status', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER', 'DISPATCH_OPERATOR'), reqController.updateRequestStatus);

module.exports = router;
