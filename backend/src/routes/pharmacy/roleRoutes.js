const express = require('express');
const router = express.Router();
const roleController = require('../../controllers/pharmacy/roleController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', roleController.getAllRoles);
router.post('/', authorizeRoles('PHARMACY_ADMIN'), roleController.createRole);

module.exports = router;
