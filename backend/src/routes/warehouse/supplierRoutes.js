const express = require('express');
const router = express.Router();
const supplierController = require('../../controllers/warehouse/supplierController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', supplierController.getAllSuppliers);
router.get('/:id', supplierController.getSupplierById);
router.post('/', authorizeRoles('WAREHOUSE_ADMIN', 'PROCUREMENT_OFFICER'), supplierController.createSupplier);
router.put('/:id', authorizeRoles('WAREHOUSE_ADMIN', 'PROCUREMENT_OFFICER'), supplierController.updateSupplier);
router.delete('/:id', authorizeRoles('WAREHOUSE_ADMIN'), supplierController.deleteSupplier);

module.exports = router;
