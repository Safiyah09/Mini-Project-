const express = require('express');
const router = express.Router();
const userController = require('../../controllers/warehouse/userController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', authorizeRoles('WAREHOUSE_ADMIN'), userController.getAllUsers);
router.put('/:id', authorizeRoles('WAREHOUSE_ADMIN'), userController.updateUser);

module.exports = router;
