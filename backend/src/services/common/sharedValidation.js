/**
 * ============================================================================
 * ENGINE E4: SHARED VALIDATION LAYER
 * ============================================================================
 * Centralized domain validations for quantities, batch expiry, stock availability,
 * return limits, and order state machine transitions.
 * ============================================================================
 */

const ApiError = require('../../utils/ApiError');
const { ORDER_STATUS_TRANSITIONS } = require('../../utils/constants');

/**
 * Validates that an input value is a strict positive integer (> 0).
 * Rejects negative numbers (-5), zero, floats (2.5), non-numeric strings ("abc"), null/undefined.
 * 
 * @param {any} value
 * @param {string} [fieldName='quantity']
 * @returns {number} Validated integer
 */
function validatePositiveQuantity(value, fieldName = 'quantity') {
  if (value === null || value === undefined || value === '') {
    throw ApiError.badRequest(`${fieldName} is required and must be a positive integer`, [], 'INVALID_QUANTITY');
  }

  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw ApiError.badRequest(
      `${fieldName} must be a positive integer (> 0), received '${value}'`,
      [{ field: fieldName, value }],
      'INVALID_QUANTITY'
    );
  }

  return num;
}

/**
 * Validates that a medicine batch has not expired.
 * 
 * @param {Object} batchDoc - Batch Mongoose document or object
 * @param {Date} [referenceDate] - Current reference date
 */
function validateBatchExpiry(batchDoc, referenceDate = new Date()) {
  if (!batchDoc) {
    throw ApiError.notFound('Batch record not found', 'BATCH_NOT_FOUND');
  }

  const expDate = new Date(batchDoc.expiry_date);
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  if (isNaN(expDate.getTime()) || expDate <= now) {
    const expStr = !isNaN(expDate.getTime()) ? expDate.toISOString().split('T')[0] : 'Invalid Date';
    throw ApiError.expiredBatch(
      `Cannot dispense or dispatch expired medicine! Batch '${batchDoc.batch_number || batchDoc.batch_id || 'UNKNOWN'}' expired on ${expStr}.`,
      [{
        batch_id: batchDoc._id || batchDoc.batch_id,
        batch_number: batchDoc.batch_number,
        expiry_date: expStr
      }]
    );
  }
}

/**
 * Validates that stock on hand is sufficient to satisfy the requested quantity.
 * 
 * @param {Object} stockDoc - WarehouseStock or PharmacyStock document
 * @param {number} requestedQuantity - Requested quantity
 * @param {string} [medicineName='Medicine']
 */
function validateStockAvailability(stockDoc, requestedQuantity, medicineName = 'Medicine') {
  const reqQty = validatePositiveQuantity(requestedQuantity, 'requested quantity');
  const available = stockDoc ? Math.max(0, stockDoc.quantity_on_hand) : 0;

  if (!stockDoc || available < reqQty) {
    throw ApiError.insufficientStock(
      `Insufficient stock for '${medicineName}'. Requested: ${reqQty}, Available: ${available}`,
      [{
        medicine: medicineName,
        requestedQuantity: reqQty,
        availableQuantity: available
      }]
    );
  }
}

/**
 * Validates that a return quantity does not exceed the originally dispatched/sold quantity.
 * 
 * @param {number} returnQuantity - Quantity being returned
 * @param {number} originalQuantity - Quantity originally sold or dispatched
 * @param {string} [referenceId=''] - Reference identifier (sale item or transfer item)
 */
function validateReturnLimit(returnQuantity, originalQuantity, referenceId = '') {
  const retQty = validatePositiveQuantity(returnQuantity, 'return quantity');
  const origQty = Math.max(0, parseInt(originalQuantity, 10) || 0);

  if (retQty > origQty) {
    throw ApiError.badRequest(
      `Return quantity (${retQty}) exceeds originally eligible quantity (${origQty})${referenceId ? ` for item '${referenceId}'` : ''}`,
      [{
        returnQuantity: retQty,
        originalQuantity: origQty,
        referenceId
      }],
      'RETURN_LIMIT_EXCEEDED'
    );
  }
}

/**
 * Validates an order state machine transition.
 * 
 * @param {string} currentStatus
 * @param {string} targetStatus
 */
function validateOrderStatusTransition(currentStatus, targetStatus) {
  const curr = String(currentStatus || '').toUpperCase();
  const tgt = String(targetStatus || '').toUpperCase();

  const allowed = ORDER_STATUS_TRANSITIONS[curr] || [];
  if (!allowed.includes(tgt)) {
    throw ApiError.invalidTransition(
      `Invalid order status transition from '${curr}' to '${tgt}'. Allowed transitions: [${allowed.join(', ')}]`,
      [{
        currentStatus: curr,
        targetStatus: tgt,
        allowedTransitions: allowed
      }]
    );
  }
}

module.exports = {
  validatePositiveQuantity,
  validateBatchExpiry,
  validateStockAvailability,
  validateReturnLimit,
  validateOrderStatusTransition
};
