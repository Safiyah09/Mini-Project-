const express = require('express');
const router = express.Router();
const stockController = require('../../controllers/warehouse/warehouseStockController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', stockController.getInventory);
router.get('/reconcile', stockController.reconcileStock);
router.get('/availability', stockController.checkStockAvailability);
router.get('/availability/:medicineId', stockController.checkStockAvailability);
router.get('/fefo/:medicineId', stockController.getFefoBatches);

module.exports = router;
