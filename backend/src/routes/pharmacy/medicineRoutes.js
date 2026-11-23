const express = require('express');
const router = express.Router();
const medicineController = require('../../controllers/pharmacy/medicineController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', medicineController.getAllMedicines);
router.get('/availability', medicineController.checkStockAvailability);
router.get('/availability/:id', medicineController.checkStockAvailability);
router.get('/:id/availability', medicineController.checkStockAvailability);
router.get('/:id', medicineController.getMedicineById);
router.post('/', authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST'), medicineController.createMedicine);
router.put('/:id', authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST'), medicineController.updateMedicine);

module.exports = router;
