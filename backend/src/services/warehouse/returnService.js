/**
 * Warehouse Return Service
 * Manages supplier and pharmacy returns
 */
class WarehouseReturnService {
  constructor(models) {
    this.models = models;
  }

  async getSupplierReturnHistory(grItemId) {
    const filter = {};
    if (grItemId) filter.gr_item = grItemId;
    return this.models.SupplierReturn.find(filter).sort({ return_date: -1 });
  }

  async getPharmacyReturnHistory(transferItemId) {
    const filter = {};
    if (transferItemId) filter.transfer_item = transferItemId;
    return this.models.PharmacyReturn.find(filter).sort({ return_date: -1 });
  }
}

module.exports = WarehouseReturnService;
