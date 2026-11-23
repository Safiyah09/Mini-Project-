const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const roleRoutes = require('./roleRoutes');
const customerRoutes = require('./customerRoutes');
const medicineRoutes = require('./medicineRoutes');
const batchRoutes = require('./batchRoutes');
const stockRoutes = require('./stockRoutes');
const statsRoutes = require('./statsRoutes');
const userRoutes = require('./userRoutes');
const supplyRequestRoutes = require('./supplyRequestRoutes');
const stockReceiptRoutes = require('./stockReceiptRoutes');
const saleRoutes = require('./saleRoutes');
const salesReturnRoutes = require('./salesReturnRoutes');
const stockAdjustmentRoutes = require('./stockAdjustmentRoutes');
const alertRoutes = require('./alertRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/customers', customerRoutes);
router.use('/medicines', medicineRoutes);
router.use('/batches', batchRoutes);
router.use('/stocks', stockRoutes);
router.use('/stats', statsRoutes);
router.use('/users', userRoutes);
router.use('/supply-requests', supplyRequestRoutes);
router.use('/receipts', stockReceiptRoutes);
router.use('/sales', saleRoutes);
router.use('/returns', salesReturnRoutes);
router.use('/adjustments', stockAdjustmentRoutes);
router.use('/alerts', alertRoutes);

module.exports = router;
