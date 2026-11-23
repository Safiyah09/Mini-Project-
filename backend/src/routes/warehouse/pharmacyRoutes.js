const express = require('express');
const router = express.Router();
const pharmacyController = require('../../controllers/warehouse/pharmacyController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', pharmacyController.getAllPharmacies);
router.get('/:id', pharmacyController.getPharmacyById);
router.post('/', authorizeRoles('WAREHOUSE_ADMIN'), pharmacyController.createPharmacy);
router.put('/:id', authorizeRoles('WAREHOUSE_ADMIN'), pharmacyController.updatePharmacy);

module.exports = router;
