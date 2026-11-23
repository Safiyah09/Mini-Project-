/**
 * Pharmacy Return Service
 * Manages customer returns and refunds
 */
class PharmacyReturnService {
  constructor(models) {
    this.models = models;
  }

  async getReturnsForSale(saleId) {
    const saleItems = await this.models.SaleItem.find({ sale: saleId });
    const itemIds = saleItems.map(si => si._id);
    return this.models.SalesReturn.find({ sale_item: { $in: itemIds } });
  }

  async getTotalRefundsIssued() {
    const returns = await this.models.SalesReturn.find();
    return returns.reduce((sum, r) => sum + parseFloat(r.refund_amount ? r.refund_amount.toString() : 0), 0);
  }
}

module.exports = PharmacyReturnService;
