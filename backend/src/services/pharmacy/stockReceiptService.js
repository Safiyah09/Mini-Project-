const { STOCK_RECEIPT_STATUS } = require('../../utils/constants');

/**
 * Pharmacy Stock Receipt Service
 * Manages receipt validation and idempotency
 */
class PharmacyStockReceiptService {
  constructor(models) {
    this.models = models;
  }

  async isTransferAlreadyReceived(transferId) {
    const existing = await this.models.StockReceipt.findOne({
      transfer_id: transferId.toUpperCase()
    });
    return !!existing;
  }

  async getRecentReceipts(limit = 20) {
    return this.models.StockReceipt.find()
      .populate('supply_request', 'request_id status')
      .sort({ received_date: -1 })
      .limit(limit);
  }
}

module.exports = PharmacyStockReceiptService;
