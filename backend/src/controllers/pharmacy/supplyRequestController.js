const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { SUPPLY_REQUEST_STATUS } = require('../../utils/constants');
const { transmitPharmacyRequestToWarehouse } = require('../../services/interServiceBridge');
const { transitionOrderStatus, getOrderStatusHistory: fetchStatusHistory } = require('../../services/warehouse/orderStateMachine');

/**
 * Get all pharmacy supply requests
 * GET /api/pharmacy/supply-requests
 */
const getAllSupplyRequests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status.toUpperCase();

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const requests = await req.models.SupplyRequest.find(filter)
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
    }, 'Supply requests retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new supply request with requested medicines
 * Supports creating from low-stock/reorder alert (with pre-filled medicine and quantity)
 * POST /api/pharmacy/supply-requests
 */
const createSupplyRequest = async (req, res, next) => {
  try {
    const { request_id, items, notes, from_alert_id, alert_id } = req.body;

    let orderItems = items;
    let linkedAlert = null;
    const targetAlertId = from_alert_id || alert_id;

    // Prefill from Low-Stock / Reorder Alert if provided
    if (targetAlertId) {
      if (targetAlertId.match(/^[0-9a-fA-F]{24}$/)) {
        linkedAlert = await req.models.Alert.findById(targetAlertId).populate('medicine');
      }
      if (!linkedAlert) {
        linkedAlert = await req.models.Alert.findOne({ alert_id: targetAlertId.toUpperCase() }).populate('medicine');
      }

      if (linkedAlert) {
        if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
          // Pre-fill item with alert's medicine and suggested reorder quantity (50 default)
          const medId = linkedAlert.medicine ? (linkedAlert.medicine.medicine_id || linkedAlert.medicine._id) : null;
          if (medId) {
            orderItems = [
              {
                medicine: medId,
                quantity_requested: 50
              }
            ];
          }
        }
        // Mark alert as acknowledged / resolved
        linkedAlert.resolved = true;
        await linkedAlert.save();
      }
    }

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      throw ApiError.badRequest('items array is required with at least one medicine request (or provide from_alert_id).');
    }

    const newReqId = request_id || `REQ-PH-${Date.now().toString().slice(-6)}`;

    // Create Supply Request Header (stored as PENDING)
    const supplyRequest = await req.models.SupplyRequest.create({
      request_id: newReqId.toUpperCase(),
      request_date: new Date(),
      submitted_date: new Date(),
      status: SUPPLY_REQUEST_STATUS.PENDING,
      from_alert: linkedAlert ? linkedAlert._id : null,
      notes: notes || (linkedAlert ? `Created from alert ${linkedAlert.alert_id}` : '')
    });

    // Record initial status in OrderStatusHistory
    if (req.models.OrderStatusHistory) {
      await req.models.OrderStatusHistory.create({
        history_id: `OSH-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        order_id: supplyRequest._id,
        request_id: supplyRequest.request_id,
        from_status: 'NONE',
        to_status: SUPPLY_REQUEST_STATUS.PENDING,
        user: req.user ? req.user._id : null,
        username: req.user ? req.user.username : 'SYSTEM',
        notes: linkedAlert ? `Order created and pre-filled from Alert ${linkedAlert.alert_id}` : 'Order created with status PENDING',
        created_at: new Date()
      });
    }

    // Create Request Items with backorder tracking
    const createdItems = [];
    for (let i = 0; i < orderItems.length; i++) {
      const itm = orderItems[i];

      let medDoc = null;
      if (itm.medicine && typeof itm.medicine === 'string' && itm.medicine.match(/^[0-9a-fA-F]{24}$/)) {
        medDoc = await req.models.Medicine.findById(itm.medicine);
      }
      if (!medDoc && itm.medicine) {
        medDoc = await req.models.Medicine.findOne({ medicine_id: itm.medicine.toString().toUpperCase() });
      }

      if (!medDoc) {
        throw ApiError.notFound(`Medicine '${itm.medicine}' in items[${i}] not found.`);
      }

      const qty = parseInt(itm.quantity_requested, 10);
      if (isNaN(qty) || qty <= 0) {
        throw ApiError.badRequest(`Invalid quantity_requested for medicine '${medDoc.name}'.`);
      }

      const reqItem = await req.models.RequestItem.create({
        request_item_id: `RQI-${supplyRequest.request_id}-${(i + 1).toString().padStart(2, '0')}`,
        supply_request: supplyRequest._id,
        medicine: medDoc._id,
        quantity_requested: qty,
        quantity_fulfilled: 0,
        quantity_pending: qty,
        is_backordered: false
      });
      createdItems.push(reqItem);
    }

    return ApiResponse.created(res, {
      ...supplyRequest.toObject(),
      items: createdItems,
      prefilledFromAlert: !!linkedAlert
    }, 'Supply request submitted successfully to warehouse');
  } catch (err) {
    next(err);
  }
};

/**
 * Get status history for a pharmacy supply request
 * GET /api/pharmacy/supply-requests/:id/history
 */
const getOrderHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await fetchStatusHistory(req.models, id);
    return ApiResponse.success(res, result, 'Order status history retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel an order (Validates state machine transitions: CREATED/PENDING_STOCK/RESERVED -> CANCELLED)
 * PUT /api/pharmacy/supply-requests/:id/cancel
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const result = await transitionOrderStatus(req.models, id, 'CANCELLED', req.user, notes || 'Cancelled by pharmacy user');
    return ApiResponse.success(res, result, 'Order successfully cancelled');
  } catch (err) {
    next(err);
  }
};

/**
 * Transmit Supply Request directly to Central Warehouse queue
 * POST /api/pharmacy/supply-requests/:id/transmit
 */
const transmitSupplyRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await transmitPharmacyRequestToWarehouse(req.pharmacyDbName || req.pharmacyId, id);
    return ApiResponse.success(res, result, 'Supply request successfully transmitted to Central Warehouse');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllSupplyRequests,
  createSupplyRequest,
  transmitSupplyRequest,
  getOrderHistory,
  cancelOrder
};
