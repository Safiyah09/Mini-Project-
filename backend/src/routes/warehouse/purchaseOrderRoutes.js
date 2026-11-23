const express = require('express');
const router = express.Router();
const poController = require('../../controllers/warehouse/purchaseOrderController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', poController.getAllPurchaseOrders);
router.get('/:id', poController.getPurchaseOrderById);
router.post('/', authorizeRoles('WAREHOUSE_ADMIN', 'PROCUREMENT_OFFICER'), poController.createPurchaseOrder);

module.exports = router;
