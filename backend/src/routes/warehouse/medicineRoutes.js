const express = require('express');
const router = express.Router();
const medicineController = require('../../controllers/warehouse/medicineController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', medicineController.getAllMedicines);
router.get('/:id', medicineController.getMedicineById);
router.post('/', authorizeRoles('WAREHOUSE_ADMIN', 'PROCUREMENT_OFFICER'), medicineController.createMedicine);
router.put('/:id', authorizeRoles('WAREHOUSE_ADMIN', 'PROCUREMENT_OFFICER'), medicineController.updateMedicine);
router.delete('/:id', authorizeRoles('WAREHOUSE_ADMIN'), medicineController.deleteMedicine);

module.exports = router;
