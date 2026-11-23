const express = require('express');
const router = express.Router();
const batchController = require('../../controllers/pharmacy/batchController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', batchController.getAllBatches);
router.post('/', authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST'), batchController.createBatch);

module.exports = router;
