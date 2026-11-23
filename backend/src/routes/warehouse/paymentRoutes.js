const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/warehouse/paymentController');
const { authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(authenticateWarehouse);

router.post('/', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER'), paymentController.recordPayment);
router.get('/', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER', 'AUDITOR'), paymentController.getAllPayments);

module.exports = router;
