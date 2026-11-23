const express = require('express');
const router = express.Router();
const userController = require('../../controllers/pharmacy/userController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(pharmacyContext);
router.use(authenticatePharmacy);

router.get('/', authorizeRoles('PHARMACY_ADMIN'), userController.getAllUsers);
router.put('/:id', authorizeRoles('PHARMACY_ADMIN'), userController.updateUser);

module.exports = router;
