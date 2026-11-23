const express = require('express');
const router = express.Router();
const stockController = require('../../controllers/pharmacy/stockController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', stockController.getPharmacyInventory);

module.exports = router;
