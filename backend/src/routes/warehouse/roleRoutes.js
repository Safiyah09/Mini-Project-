const express = require('express');
const router = express.Router();
const roleController = require('../../controllers/warehouse/roleController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(warehouseContext);

router.get('/', authenticateWarehouse, roleController.getAllRoles);
router.post('/', authenticateWarehouse, authorizeRoles('WAREHOUSE_ADMIN'), roleController.createRole);

module.exports = router;
