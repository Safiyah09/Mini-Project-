const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { SUPPLY_REQUEST_STATUS } = require('../../utils/constants');
const { transitionOrderStatus, getOrderStatusHistory } = require('../../services/warehouse/orderStateMachine');

/**
 * Get all pharmacy supply requests in warehouse
 * Enforces pharmacy isolation: a pharmacy user can only view their own orders; warehouse roles view all.
 * GET /api/warehouse/supply-requests
 */
const getAllSupplyRequests = async (req, res, next) => {
  try {
    const { status, pharmacy_id, page = 1, limit = 50 } = req.query;
    const filter = {};

    // Map PENDING to filter both PENDING and CREATED
    if (status) {
      if (status.toUpperCase() === 'PENDING') {
        filter.status = { $in: ['PENDING', 'CREATED'] };
      } else {
        filter.status = status.toUpperCase();
      }
    }

    // Pharmacy Isolation Check
    if (req.userPharmacyId && req.user && req.user.role && req.user.role.role_name && req.user.role.role_name.startsWith('PHARMACY')) {
      const pharmDoc = await req.models.Pharmacy.findOne({
        $or: [{ pharmacy_id: req.userPharmacyId.toUpperCase() }, { name: new RegExp(req.userPharmacyId, 'i') }]
      });
      if (pharmDoc) {
        filter.pharmacy = pharmDoc._id;
      }
    } else if (pharmacy_id) {
      filter.pharmacy = pharmacy_id;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const requests = await req.models.SupplyRequest.find(filter)
      .populate('pharmacy', 'pharmacy_id name address contact')
      .sort({ request_date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const reqIds = requests.map((r) => r._id);
    const items = await req.models.RequestItem.find({ supply_request: { $in: reqIds } })
      .populate('medicine', 'medicine_id name dosage formulation manufacturer category');

    const itemsMap = {};
    items.forEach((item) => {
      const rId = item.supply_request.toString();
      if (!itemsMap[rId]) itemsMap[rId] = [];
      itemsMap[rId].push(item);
    });

    const populatedRequests = requests.map((r) => ({
      ...r.toObject(),
      items: itemsMap[r._id.toString()] || []
    }));

    const total = await req.models.SupplyRequest.countDocuments(filter);

    return ApiResponse.success(res, {
      supplyRequests: populatedRequests,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Pharmacy supply requests retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get single supply request by ID with line items and backorders
 * GET /api/warehouse/supply-requests/:id
 */
const getSupplyRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let request = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      request = await req.models.SupplyRequest.findById(id).populate('pharmacy');
    }
    if (!request) {
      request = await req.models.SupplyRequest.findOne({ request_id: id.toUpperCase() }).populate('pharmacy');
    }

    if (!request) {
      throw ApiError.notFound(`Supply request not found with id: ${id}`);
    }

    // Pharmacy Isolation: verify that pharmacy users can only access their own pharmacy's orders
    if (req.userPharmacyId && req.user && req.user.role && req.user.role.role_name && req.user.role.role_name.startsWith('PHARMACY')) {
      const orderPharmId = request.pharmacy ? (request.pharmacy.pharmacy_id || '').toUpperCase() : '';
      const requestingPharmId = (req.userPharmacyId || '').toUpperCase();
      if (orderPharmId && requestingPharmId && orderPharmId !== requestingPharmId && requestingPharmId !== 'PHARMACY') {
        throw ApiError.forbidden(`Forbidden. Pharmacy '${requestingPharmId}' is not authorized to access orders of '${orderPharmId}'.`);
      }
    }

    const items = await req.models.RequestItem.find({ supply_request: request._id })
      .populate('medicine', 'medicine_id name dosage formulation manufacturer category');

    return ApiResponse.success(res, {
      ...request.toObject(),
      items
    }, 'Supply request retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Update Supply Request status with strict state machine validation and history logging
 * PUT /api/warehouse/supply-requests/:id/status
 */
const updateRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      throw ApiError.badRequest('status is required.');
    }

    // Use orderStateMachine to validate transition and record in OrderStatusHistory
    const result = await transitionOrderStatus(req.models, id, status, req.user, notes);

    return ApiResponse.success(res, result, `Supply request status successfully updated to ${result.order.status}`);
  } catch (err) {
    next(err);
  }
};

/**
 * Get Order Status History for a supply request
 * GET /api/warehouse/supply-requests/:id/history
 */
const getStatusHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await getOrderStatusHistory(req.models, id);
    return ApiResponse.success(res, result, 'Order status history retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllSupplyRequests,
  getSupplyRequestById,
  updateRequestStatus,
  getStatusHistory
};
