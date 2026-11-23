const express = require('express');
const router = express.Router();
const authController = require('../../controllers/warehouse/authController');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');

// All auth routes get the warehouse database context
router.use(warehouseContext);

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticateWarehouse, authController.getMe);

module.exports = router;
