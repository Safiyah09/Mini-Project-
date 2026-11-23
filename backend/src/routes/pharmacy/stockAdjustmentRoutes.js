const express = require('express');
const router = express.Router();
const adjController = require('../../controllers/pharmacy/stockAdjustmentController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', adjController.getAllAdjustments);
router.post('/', authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST'), adjController.createAdjustment);

module.exports = router;
