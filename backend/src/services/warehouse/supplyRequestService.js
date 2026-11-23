const { SUPPLY_REQUEST_STATUS } = require('../../utils/constants');

/**
 * Warehouse Supply Request Service
 * Handles pharmacy order queue management
 */
class SupplyRequestService {
  constructor(models) {
    this.models = models;
  }

  async getPendingRequests() {
    return this.models.SupplyRequest.find({
      status: SUPPLY_REQUEST_STATUS.PENDING
    })
      .populate('pharmacy', 'pharmacy_id name branch_name')
      .sort({ request_date: 1 });
  }

  async getRequestWithItems(requestId) {
    const request = await this.models.SupplyRequest.findById(requestId).populate('pharmacy');
    if (!request) return null;

    const items = await this.models.RequestItem.find({ supply_request: request._id })
      .populate('medicine');

    return { request, items };
  }
}

module.exports = SupplyRequestService;
