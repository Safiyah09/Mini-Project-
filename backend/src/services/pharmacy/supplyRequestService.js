const { SUPPLY_REQUEST_STATUS } = require('../../utils/constants');

/**
 * Pharmacy Supply Request Service
 * Handles replenishment ordering
 */
class PharmacySupplyRequestService {
  constructor(models) {
    this.models = models;
  }

  async getActiveRequests() {
    return this.models.SupplyRequest.find({
      status: { $in: [SUPPLY_REQUEST_STATUS.PENDING, SUPPLY_REQUEST_STATUS.APPROVED, SUPPLY_REQUEST_STATUS.PARTIALLY_FULFILLED] }
    }).sort({ request_date: -1 });
  }
}

module.exports = PharmacySupplyRequestService;
