const ApiError = require('../../utils/ApiError');
const { ORDER_STATUS_TRANSITIONS, SUPPLY_REQUEST_STATUS } = require('../../utils/constants');

/**
 * Validates whether a transition from fromStatus to toStatus is valid
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {boolean}
 */
const isValidTransition = (fromStatus, toStatus) => {
  const normFrom = (fromStatus || 'CREATED').toUpperCase();
  const normTo = (toStatus || '').toUpperCase();

  const allowed = ORDER_STATUS_TRANSITIONS[normFrom] || [];
  return allowed.includes(normTo);
};

/**
 * Validates and applies a status transition on an order (SupplyRequest)
 * Records the transition in OrderStatusHistory.
 * Throws ApiError.conflict (409) if the transition is invalid.
 *
 * @param {object} models - Warehouse or Pharmacy Mongoose models
 * @param {string|object} orderId - SupplyRequest _id or doc
 * @param {string} toStatus - Target status
 * @param {object} [user] - User performing the transition
 * @param {string} [notes] - Reason or notes for transition
 * @returns {Promise<{order: object, historyEntry: object}>}
 */
const transitionOrderStatus = async (models, orderId, toStatus, user = null, notes = '', session = null) => {
  const targetStatus = (toStatus || '').toUpperCase();

  let order = null;
  if (orderId && typeof orderId.save === 'function') {
    order = orderId;
  } else {
    const idStr = (orderId && orderId._id) ? orderId._id.toString() : orderId ? orderId.toString() : '';
    if (idStr.match(/^[0-9a-fA-F]{24}$/)) {
      const q = models.SupplyRequest.findById(idStr);
      if (session) q.session(session);
      order = await q;
    }
    if (!order && idStr) {
      const q = models.SupplyRequest.findOne({ request_id: idStr.toUpperCase() });
      if (session) q.session(session);
      order = await q;
    }
  }

  if (!order) {
    throw ApiError.notFound(`Supply Request not found: ${orderId}`);
  }

  const currentStatus = (order.status || 'CREATED').toUpperCase();

  // If already at target status, return idempotently
  if (currentStatus === targetStatus) {
    return { order, historyEntry: null, noop: true };
  }

  if (!isValidTransition(currentStatus, targetStatus)) {
    const allowed = ORDER_STATUS_TRANSITIONS[currentStatus] || [];
    throw ApiError.conflict(
      `Invalid order status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${allowed.join(', ')}]`
    );
  }

  const previousStatus = order.status;
  order.status = targetStatus;
  if (session) {
    await order.save({ session });
  } else {
    await order.save();
  }

  // Record transition in OrderStatusHistory
  let historyEntry = null;
  if (models.OrderStatusHistory) {
    const historyId = `OSH-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const historyDoc = {
      history_id: historyId,
      order_id: order._id,
      request_id: order.request_id,
      from_status: previousStatus,
      to_status: targetStatus,
      user: user ? user._id : null,
      username: user ? (user.username || user.name) : 'SYSTEM',
      notes: notes || `Status changed from ${previousStatus} to ${targetStatus}`,
      created_at: new Date()
    };

    if (session) {
      historyEntry = (await models.OrderStatusHistory.create([historyDoc], { session }))[0];
    } else {
      historyEntry = await models.OrderStatusHistory.create(historyDoc);
    }
  }

  return {
    order,
    historyEntry
  };
};

/**
 * Get status history for an order
 */
const getOrderStatusHistory = async (models, orderId) => {
  let order = null;
  const idStr = (orderId && orderId._id) ? orderId._id.toString() : orderId ? orderId.toString() : '';
  if (idStr.match(/^[0-9a-fA-F]{24}$/)) {
    order = await models.SupplyRequest.findById(idStr);
  }
  if (!order && idStr) {
    order = await models.SupplyRequest.findOne({ request_id: idStr.toUpperCase() });
  }

  if (!order) {
    throw ApiError.notFound(`Supply Request not found: ${orderId}`);
  }

  const history = await models.OrderStatusHistory.find({ order_id: order._id })
    .populate('user', 'name username role')
    .sort({ created_at: -1 });

  return {
    order: {
      id: order._id,
      request_id: order.request_id,
      current_status: order.status,
      request_date: order.request_date
    },
    history
  };
};

module.exports = {
  isValidTransition,
  transitionOrderStatus,
  getOrderStatusHistory
};
