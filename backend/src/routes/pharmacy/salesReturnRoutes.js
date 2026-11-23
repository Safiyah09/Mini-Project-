const express = require('express');
const router = express.Router();
const returnController = require('../../controllers/pharmacy/salesReturnController');
const { returnGoodsToWarehouse } = require('../../controllers/pharmacy/warehouseReturnController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');
const idempotencyMiddleware = require('../../middleware/idempotencyMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', returnController.getAllReturns);
router.post('/', idempotencyMiddleware, authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST', 'CASHIER'), returnController.createSalesReturn);
router.post('/to-warehouse', idempotencyMiddleware, authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST'), returnGoodsToWarehouse);

module.exports = router;
