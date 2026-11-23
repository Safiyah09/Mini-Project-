const express = require('express');
const router = express.Router();
const locationController = require('../../controllers/warehouse/storageLocationController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

router.get('/', locationController.getAllLocations);
router.post('/', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER'), locationController.createLocation);
router.put('/:id', authorizeRoles('WAREHOUSE_ADMIN', 'INVENTORY_MANAGER'), locationController.updateLocation);

module.exports = router;
