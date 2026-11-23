const express = require('express');
const router = express.Router();
const customerController = require('../../controllers/pharmacy/customerController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);

module.exports = router;
