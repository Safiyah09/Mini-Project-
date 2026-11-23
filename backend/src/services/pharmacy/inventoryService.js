const { STOCK_STATUS } = require('../../utils/constants');
const { compareBatchesFEFO, allocateFEFO } = require('../common/fefoMinHeap');

/**
 * Pharmacy Inventory Service
 * Manages shelf stock, expiry tracking, and auto-alerts
 */
class PharmacyInventoryService {
  constructor(models) {
    this.models = models;
  }

  async getAvailableStockForDispensing(medicineId) {
    const now = new Date();
    const batches = await this.models.Batch.find({
      medicine: medicineId,
      expiry_date: { $gt: now }
    }).sort({ expiry_date: 1 });

    const batchIds = batches.map(b => b._id);
    const stocks = await this.models.PharmacyStock.find({
      batch: { $in: batchIds },
      quantity_on_hand: { $gt: 0 }
    });

    const stockMap = {};
    stocks.forEach(s => {
      stockMap[s.batch.toString()] = s;
    });

    return batches
      .filter(b => stockMap[b._id.toString()])
      .map(b => ({
        batch: b,
        stock: stockMap[b._id.toString()],
        quantityOnHand: stockMap[b._id.toString()].quantity_on_hand
      }));
  }

  async checkAndTriggerLowStockAlerts() {
    const lowStocks = await this.models.PharmacyStock.find({
      stock_status: { $in: [STOCK_STATUS.LOW_STOCK, STOCK_STATUS.OUT_OF_STOCK] }
    }).populate({
      path: 'batch',
      populate: { path: 'medicine' }
    });

    return lowStocks;
  }
}

module.exports = PharmacyInventoryService;
