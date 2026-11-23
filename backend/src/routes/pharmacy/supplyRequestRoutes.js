const express = require('express');
const router = express.Router();
const reqController = require('../../controllers/pharmacy/supplyRequestController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', reqController.getAllSupplyRequests);
router.get('/:id/history', reqController.getOrderHistory);
router.post('/', authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST'), reqController.createSupplyRequest);
router.post('/:id/transmit', authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST'), reqController.transmitSupplyRequest);
router.put('/:id/cancel', authorizeRoles('PHARMACY_ADMIN', 'PHARMACIST'), reqController.cancelOrder);

module.exports = router;
