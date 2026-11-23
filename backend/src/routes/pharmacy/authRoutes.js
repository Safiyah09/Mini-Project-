const express = require('express');
const router = express.Router();
const authController = require('../../controllers/pharmacy/authController');
const { pharmacyContext, authenticatePharmacy } = require('../../middleware/authMiddleware');

router.use(pharmacyContext);

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticatePharmacy, authController.getMe);

module.exports = router;
