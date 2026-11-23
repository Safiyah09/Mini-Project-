const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const roleRoutes = require('./roleRoutes');
const supplierRoutes = require('./supplierRoutes');
const medicineRoutes = require('./medicineRoutes');
const batchRoutes = require('./batchRoutes');
const storageLocationRoutes = require('./storageLocationRoutes');
const pharmacyRoutes = require('./pharmacyRoutes');
const userRoutes = require('./userRoutes');
const purchaseOrderRoutes = require('./purchaseOrderRoutes');
const goodsReceiptRoutes = require('./goodsReceiptRoutes');
const warehouseStockRoutes = require('./warehouseStockRoutes');
const stockAdjustmentRoutes = require('./stockAdjustmentRoutes');
const supplyRequestRoutes = require('./supplyRequestRoutes');
const stockTransferRoutes = require('./stockTransferRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const paymentRoutes = require('./paymentRoutes');
const returnRoutes = require('./returnRoutes');
const auditLogRoutes = require('./auditLogRoutes');
const reportRoutes = require('./reportRoutes');
const serviceRoutes = require('./serviceRoutes');
const discrepancyRoutes = require('./discrepancyRoutes');
const alertRoutes = require('./alertRoutes');
const statsRoutes = require('./statsRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/medicines', medicineRoutes);
router.use('/batches', batchRoutes);
router.use('/locations', storageLocationRoutes);
router.use('/pharmacies', pharmacyRoutes);
router.use('/users', userRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/goods-receipts', goodsReceiptRoutes);
router.use('/stocks', warehouseStockRoutes);
router.use('/adjustments', stockAdjustmentRoutes);
router.use('/supply-requests', supplyRequestRoutes);
router.use('/transfers', stockTransferRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/returns', returnRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/reports', reportRoutes);
router.use('/service', serviceRoutes);
router.use('/discrepancies', discrepancyRoutes);
router.use('/alerts', alertRoutes);
router.use('/stats', statsRoutes);

// Transaction Ledger & Reconciliation Aliases
const ledgerService = require('../../services/warehouse/ledgerService');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');

router.get('/ledger/reconciliation', warehouseContext, authenticateWarehouse, async (req, res, next) => {
  try {
    const results = await ledgerService.reconcileAllStocks(req.models);
    return res.json({
      success: true,
      statusCode: 200,
      data: {
        reconciliation: results.reconciliations || (Array.isArray(results) ? results : []),
        total_batches: results.total_batches,
        reconciled_batches: results.reconciled_batches,
        variance_count: results.variance_count
      },
      message: 'Reconciliation audit completed'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/ledger', warehouseContext, authenticateWarehouse, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const ledger = await req.models.TransactionLedger.find({})
      .sort({ created_at: -1 })
      .limit(limit)
      .populate('medicine_id batch_id user_id');
    return res.json({
      success: true,
      statusCode: 200,
      data: { ledger },
      message: 'Ledger entries retrieved'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
