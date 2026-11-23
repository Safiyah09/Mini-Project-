const { STOCK_TRANSFER_STATUS } = require('../../utils/constants');

/**
 * Warehouse Stock Transfer Service
 * Handles inter-facility dispatch calculations and transfer tracking
 */
class StockTransferService {
  constructor(models) {
    this.models = models;
  }

  async getTransfersByStatus(status) {
    const filter = {};
    if (status) filter.status = status.toUpperCase();

    return this.models.StockTransfer.find(filter)
      .populate('pharmacy', 'pharmacy_id name branch_name address')
      .populate('supply_request', 'request_id status')
      .sort({ transfer_date: -1 });
  }

  async getTransferDetails(transferId) {
    const transfer = await this.models.StockTransfer.findById(transferId).populate('pharmacy');
    if (!transfer) return null;

    const items = await this.models.TransferItem.find({ stock_transfer: transfer._id })
      .populate({
        path: 'batch',
        populate: { path: 'medicine' }
      });

    return { transfer, items };
  }
}

module.exports = StockTransferService;
