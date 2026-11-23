const express = require('express');
const router = express.Router();
const alertController = require('../../controllers/pharmacy/alertController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', alertController.getAlerts);
router.put('/:id/resolve', alertController.resolveAlert);

module.exports = router;
