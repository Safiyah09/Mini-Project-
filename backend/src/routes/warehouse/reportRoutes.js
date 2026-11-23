const express = require('express');
const router = express.Router();
const reportController = require('../../controllers/warehouse/reportController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/stock-by-batch', reportController.getStockByBatch);
router.get('/transaction-history', reportController.getTransactionHistory);
router.get('/expiry', reportController.getExpiryReport);
router.get('/dispatch-per-pharmacy', reportController.getDispatchPerPharmacy);

module.exports = router;
