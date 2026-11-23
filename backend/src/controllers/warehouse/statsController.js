const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get Warehouse KPI and dashboard statistics directly from MongoDB Atlas
 * GET /api/warehouse/stats/summary
 */
const getWarehouseStats = async (req, res, next) => {
  try {
    const now = new Date();
    const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    // Parallel count queries for optimal performance
    const [
      totalMedicines,
      registeredPharmacies,
      totalSuppliers,
      pendingRequests,
      totalTransfers,
      stocks,
      nearExpiryCount,
      expiredCount,
      recentAuditLogs
    ] = await Promise.all([
      req.models.Medicine.countDocuments({ isActive: true }),
      req.models.Pharmacy.countDocuments(),
      req.models.Supplier.countDocuments(),
      req.models.SupplyRequest.countDocuments({ status: { $in: ['PENDING', 'TRANSMITTED', 'PROCESSING'] } }),
      req.models.StockTransfer.countDocuments(),
      req.models.WarehouseStock.find().select('quantity_on_hand quantity_reserved stock_status'),
      req.models.Batch.countDocuments({ expiry_date: { $gte: now, $lte: ninetyDays }, isActive: true }),
      req.models.Batch.countDocuments({ expiry_date: { $lt: now }, isActive: true }),
      req.models.AuditLog.find().sort({ timestamp: -1 }).limit(5).populate('user', 'name username')
    ]);

    // Aggregate stock metrics
    let totalStockQty = 0;
    let lowStockCount = 0;
    stocks.forEach((s) => {
      totalStockQty += (s.quantity_on_hand || 0);
      if (s.stock_status === 'LOW_STOCK' || s.quantity_on_hand < 300) {
        lowStockCount++;
      }
    });

    return ApiResponse.success(res, {
      kpis: {
        totalMedicines,
        totalWarehouseStock: totalStockQty,
        registeredPharmacies,
        pendingRequests,
        totalTransfers,
        lowStockMedicines: lowStockCount,
        nearExpiryBatches: nearExpiryCount,
        expiredBatches: expiredCount,
        totalSuppliers
      },
      recentActivity: recentAuditLogs
    }, 'Warehouse statistics retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get Warehouse Alerts
 * GET /api/warehouse/alerts
 */
const getWarehouseAlerts = async (req, res, next) => {
  try {
    const now = new Date();
    const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    // Find stocks that are low
    const lowStocks = await req.models.WarehouseStock.find({
      $or: [
        { stock_status: 'LOW_STOCK' },
        { quantity_on_hand: { $lt: 400 } }
      ]
    })
      .populate({
        path: 'batch',
        populate: { path: 'medicine', select: 'name medicine_id category' }
      })
      .populate('storage_location', 'zone rack_bin')
      .limit(20);

    // Find near-expiry batches
    const nearExpiryBatches = await req.models.Batch.find({
      expiry_date: { $gte: now, $lte: ninetyDays },
      isActive: true
    })
      .populate('medicine', 'name medicine_id category')
      .sort({ expiry_date: 1 })
      .limit(20);

    // Find expired batches
    const expiredBatches = await req.models.Batch.find({
      expiry_date: { $lt: now },
      isActive: true
    })
      .populate('medicine', 'name medicine_id category')
      .sort({ expiry_date: -1 })
      .limit(20);

    // Format into consolidated alert array
    const alerts = [];

    nearExpiryBatches.forEach((b) => {
      const daysLeft = Math.ceil((new Date(b.expiry_date) - now) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: `EXP-${b._id}`,
        alert_type: 'NEAR_EXPIRY',
        severity: daysLeft < 30 ? 'CRITICAL' : 'WARNING',
        title: `Near Expiry: ${b.medicine?.name || 'Unknown'} (Batch ${b.batch_number})`,
        message: `Batch ${b.batch_number} expires in ${daysLeft} days (${new Date(b.expiry_date).toLocaleDateString()}). Prioritize FEFO dispatch.`,
        created_at: b.createdAt || now,
        medicine: b.medicine,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date
      });
    });

    expiredBatches.forEach((b) => {
      alerts.push({
        id: `EXPIRED-${b._id}`,
        alert_type: 'EXPIRED_BATCH',
        severity: 'DANGER',
        title: `EXPIRED: ${b.medicine?.name || 'Unknown'} (Batch ${b.batch_number})`,
        message: `Batch ${b.batch_number} expired on ${new Date(b.expiry_date).toLocaleDateString()}. Quarantine immediately.`,
        created_at: b.expiry_date,
        medicine: b.medicine,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date
      });
    });

    lowStocks.forEach((s) => {
      alerts.push({
        id: `LOW-${s._id}`,
        alert_type: 'LOW_STOCK',
        severity: s.quantity_on_hand === 0 ? 'CRITICAL' : 'WARNING',
        title: `Low Stock: ${s.batch?.medicine?.name || 'Medicine'}`,
        message: `Stock level is ${s.quantity_on_hand} units in ${s.storage_location?.zone || 'Warehouse'} (Rack: ${s.storage_location?.rack_bin || 'Bin'}). Create purchase order.`,
        created_at: s.updatedAt || now,
        medicine: s.batch?.medicine,
        batch_number: s.batch?.batch_number,
        quantity_on_hand: s.quantity_on_hand
      });
    });

    return ApiResponse.success(res, alerts, 'Warehouse alerts retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWarehouseStats,
  getWarehouseAlerts
};
