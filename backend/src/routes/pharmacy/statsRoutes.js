const express = require('express');
const router = express.Router();
const statsController = require('../../controllers/pharmacy/statsController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/summary', statsController.getPharmacyStats);

module.exports = router;
