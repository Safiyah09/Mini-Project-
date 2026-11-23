const express = require('express');
const router = express.Router();
const returnController = require('../../controllers/warehouse/returnController');
const { authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');
const idempotencyMiddleware = require('../../middleware/idempotencyMiddleware');

router.use(authenticateWarehouse);

router.post('/supplier', idempotencyMiddleware, authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER'), returnController.createSupplierReturn);
router.get('/supplier', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER', 'AUDITOR'), returnController.getAllSupplierReturns);

router.post('/pharmacy', idempotencyMiddleware, authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER'), returnController.createPharmacyReturn);
router.get('/pharmacy', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER', 'AUDITOR'), returnController.getAllPharmacyReturns);

module.exports = router;
