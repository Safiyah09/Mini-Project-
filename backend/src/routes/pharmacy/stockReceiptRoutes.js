const express = require('express');
const router = express.Router();
const receiptController = require('../../controllers/pharmacy/stockReceiptController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');
const idempotencyMiddleware = require('../../middleware/idempotencyMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', receiptController.getAllReceipts);
router.get('/discrepancies', receiptController.getReceiptDiscrepancies);
router.get('/warehouse-transfer/:transferId', authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST'), receiptController.lookupWarehouseManifest);
router.post('/', idempotencyMiddleware, authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST'), receiptController.confirmStockReceipt);
router.post('/confirm-receipt', idempotencyMiddleware, authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST'), receiptController.confirmStockReceipt);

module.exports = router;
