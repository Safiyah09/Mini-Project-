const express = require('express');
const router = express.Router();
const saleController = require('../../controllers/pharmacy/saleController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');
const idempotencyMiddleware = require('../../middleware/idempotencyMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', saleController.getAllSales);
router.post('/', idempotencyMiddleware, saleController.createSale);

module.exports = router;
