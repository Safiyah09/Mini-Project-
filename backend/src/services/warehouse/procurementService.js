const { PO_STATUS, GR_STATUS } = require('../../utils/constants');

/**
 * Warehouse Procurement Service
 * Handles purchase orders and goods inwards
 */
class ProcurementService {
  constructor(models) {
    this.models = models;
  }

  async getPendingPurchaseOrders() {
    return this.models.PurchaseOrder.find({
      status: { $in: [PO_STATUS.DRAFT, PO_STATUS.SUBMITTED, PO_STATUS.APPROVED, PO_STATUS.PARTIALLY_RECEIVED] }
    }).populate('supplier', 'supplier_id name contact');
  }

  async calculateTotalProcured(supplierId) {
    const filter = { status: { $ne: PO_STATUS.CANCELLED } };
    if (supplierId) filter.supplier = supplierId;

    const pos = await this.models.PurchaseOrder.find(filter);
    return pos.reduce((sum, po) => sum + parseFloat(po.total_amount ? po.total_amount.toString() : 0), 0);
  }
}

module.exports = ProcurementService;
