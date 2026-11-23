const { STOCK_STATUS } = require('../../utils/constants');
const { compareBatchesFEFO, allocateFEFO } = require('../common/fefoMinHeap');

/**
 * Warehouse Inventory Service
 * Manages FEFO batch ranking, stock valuation, and reorder levels
 */
class WarehouseInventoryService {
  constructor(models) {
    this.models = models;
  }

  /**
   * Get active unexpired batches for medicine in FEFO priority order
   */
  async getFEFOBatches(medicineId) {
    const now = new Date();
    const batches = await this.models.Batch.find({
      medicine: medicineId,
      expiry_date: { $gt: now }
    }).sort({ expiry_date: 1 });

    const batchIds = batches.map(b => b._id);
    const stocks = await this.models.WarehouseStock.find({
      batch: { $in: batchIds }
    }).populate('storage_location');

    const stockMap = {};
    stocks.forEach(s => {
      stockMap[s.batch.toString()] = s;
    });

    return batches.map(b => {
      const s = stockMap[b._id.toString()];
      return {
        batch: b,
        stock: s || null,
        availableQuantity: s ? Math.max(0, s.quantity_on_hand - s.quantity_reserved) : 0
      };
    });
  }

  /**
   * Get batches nearing expiry (within days)
   */
  async getExpiringBatches(withinDays = 60) {
    const now = new Date();
    const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    return this.models.Batch.find({
      expiry_date: { $gte: now, $lte: threshold }
    }).populate('medicine', 'medicine_id name dosage');
  }

  /**
   * Get low stock alerts across warehouse
   */
  async getLowStockItems() {
    return this.models.WarehouseStock.find({
      stock_status: { $in: [STOCK_STATUS.LOW_STOCK, STOCK_STATUS.OUT_OF_STOCK] }
    }).populate({
      path: 'batch',
      populate: { path: 'medicine' }
    });
  }
}

module.exports = WarehouseInventoryService;
