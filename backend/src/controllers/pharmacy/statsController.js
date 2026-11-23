const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get Pharmacy KPI and dashboard statistics directly from MongoDB Atlas
 * GET /api/pharmacy/stats/summary
 */
const getPharmacyStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const [
      totalMedicines,
      totalSalesCount,
      todaySalesDocs,
      pendingRequestsCount,
      ordersReceivedCount,
      stocks,
      nearExpiryBatchesCount,
      customersCount
    ] = await Promise.all([
      req.models.Medicine.countDocuments({ isActive: true }),
      req.models.Sale.countDocuments(),
      req.models.Sale.find({ sale_date: { $gte: startOfToday } }).select('total_amount'),
      req.models.SupplyRequest.countDocuments({ status: { $in: ['PENDING', 'TRANSMITTED', 'PROCESSING'] } }),
      req.models.StockReceipt.countDocuments({ status: 'ACCEPTED' }),
      req.models.PharmacyStock.find().select('quantity_on_hand stock_status'),
      req.models.Batch.countDocuments({ expiry_date: { $gte: now, $lte: ninetyDays }, isActive: true }),
      req.models.Customer.countDocuments({ isActive: true })
    ]);

    let todaySalesRevenue = 0;
    todaySalesDocs.forEach((s) => {
      todaySalesRevenue += parseFloat(s.total_amount ? s.total_amount.toString() : 0);
    });

    let totalStockQty = 0;
    let lowStockCount = 0;
    stocks.forEach((s) => {
      totalStockQty += (s.quantity_on_hand || 0);
      if (s.stock_status === 'LOW_STOCK' || s.quantity_on_hand < 25) {
        lowStockCount++;
      }
    });

    return ApiResponse.success(res, {
      kpis: {
        totalMedicines,
        totalPharmacyStock: totalStockQty,
        todaySales: todaySalesRevenue,
        todaySalesCount: todaySalesDocs.length,
        totalTransactions: totalSalesCount,
        pendingRequests: pendingRequestsCount,
        ordersReceived: ordersReceivedCount,
        lowStockMedicines: lowStockCount,
        nearExpiryBatches: nearExpiryBatchesCount,
        totalCustomers: customersCount
      }
    }, 'Pharmacy statistics retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPharmacyStats
};
