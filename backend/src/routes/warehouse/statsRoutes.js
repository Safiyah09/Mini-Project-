const express = require('express');
const router = express.Router();
const statsController = require('../../controllers/warehouse/statsController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/summary', statsController.getWarehouseStats);

module.exports = router;
