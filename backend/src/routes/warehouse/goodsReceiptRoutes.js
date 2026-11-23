const express = require('express');
const router = express.Router();
const grController = require('../../controllers/warehouse/goodsReceiptController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', grController.getAllGoodsReceipts);
router.post('/', authorizeRoles('WAREHOUSE_ADMIN', 'PROCUREMENT_OFFICER', 'INVENTORY_MANAGER'), grController.createGoodsReceipt);

module.exports = router;
