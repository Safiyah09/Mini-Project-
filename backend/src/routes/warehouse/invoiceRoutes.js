const express = require('express');
const router = express.Router();
const invoiceController = require('../../controllers/warehouse/invoiceController');
const { authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(authenticateWarehouse);

router.get('/', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER', 'AUDITOR'), invoiceController.getAllInvoices);
router.get('/:id', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER', 'AUDITOR'), invoiceController.getInvoiceById);
router.put('/:id/status', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER'), invoiceController.updateInvoiceStatus);

module.exports = router;
