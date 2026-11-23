/**
 * ============================================================================
 * ENGINE E4: ATOMIC CONCURRENCY & OPTIMISTIC LOCKING SERVICE
 * ============================================================================
 * Enforces atomic stock updates, prevents negative inventory, and guards against
 * lost updates under high concurrency.
 * ============================================================================
 */

const ApiError = require('../../utils/ApiError');
const { STOCK_STATUS } = require('../../utils/constants');

/**
 * Atomically deduct stock from inventory with strict non-negative check.
 * 
 * @param {import('mongoose').Model} StockModel - WarehouseStock or PharmacyStock Model
 * @param {string|import('mongoose').Types.ObjectId} targetId - Stock _id or batch _id
 * @param {number} quantity - Positive integer to deduct
 * @param {Object} [options]
 * @param {import('mongoose').ClientSession} [options.session] - Mongoose session
 * @param {number} [options.expectedVersion] - Expected document version for optimistic locking
 * @param {number} [options.decrementReserved] - Also decrement quantity_reserved by this amount
 * @returns {Promise<Object>} Updated stock document
 */
async function atomicDeductStock(StockModel, targetId, quantity, options = {}) {
  const qty = Math.max(0, parseInt(quantity, 10));
  if (isNaN(qty) || qty <= 0) {
    throw ApiError.badRequest(`Deduction quantity must be a positive integer, got '${quantity}'`, [], 'INVALID_QUANTITY');
  }

  const queryFilter = {
    $or: [{ _id: targetId }, { batch: targetId }],
    quantity_on_hand: { $gte: qty } // ATOMIC CONSTRAINT: Stock can NEVER go negative
  };

  if (options.expectedVersion !== undefined && options.expectedVersion !== null) {
    queryFilter.version = options.expectedVersion;
  }

  const updateDoc = {
    $inc: {
      quantity_on_hand: -qty,
      version: 1
    }
  };

  if (options.decrementReserved && options.decrementReserved > 0) {
    updateDoc.$inc.quantity_reserved = -Math.min(qty, options.decrementReserved);
  }

  const findOptions = { new: true };
  if (options.session) {
    findOptions.session = options.session;
  }

  const updatedStock = await StockModel.findOneAndUpdate(queryFilter, updateDoc, findOptions);

  if (!updatedStock) {
    // Determine exact cause: non-existent document or insufficient stock
    const findQuery = StockModel.findOne({ $or: [{ _id: targetId }, { batch: targetId }] });
    if (options.session) findQuery.session(options.session);
    const existing = await findQuery;

    if (!existing) {
      throw ApiError.notFound(`Stock record not found for id '${targetId}'`, 'RESOURCE_NOT_FOUND');
    }

    if (existing.quantity_on_hand < qty) {
      throw ApiError.insufficientStock(
        `Insufficient stock: requested ${qty} unit(s), but only ${existing.quantity_on_hand} available on hand`,
        {
          targetId: String(targetId),
          requestedQuantity: qty,
          availableQuantity: existing.quantity_on_hand
        }
      );
    }

    // Version mismatch under optimistic locking
    throw ApiError.conflict(
      `Concurrent modification detected on stock '${targetId}'. Please retry transaction.`,
      [],
      'CONCURRENT_MODIFICATION_CONFLICT'
    );
  }

  // Update stock status if exhausted
  if (updatedStock.quantity_on_hand === 0 && updatedStock.stock_status !== STOCK_STATUS.OUT_OF_STOCK) {
    updatedStock.stock_status = STOCK_STATUS.OUT_OF_STOCK;
    await updatedStock.save({ session: options.session });
  }

  return updatedStock;
}

/**
 * Atomically credit stock to inventory.
 * 
 * @param {import('mongoose').Model} StockModel - WarehouseStock or PharmacyStock Model
 * @param {string|import('mongoose').Types.ObjectId} targetId - Stock _id or batch _id
 * @param {number} quantity - Positive integer to credit
 * @param {Object} [options]
 * @param {import('mongoose').ClientSession} [options.session]
 * @returns {Promise<Object>} Updated stock document
 */
async function atomicIncrementStock(StockModel, targetId, quantity, options = {}) {
  const qty = Math.max(0, parseInt(quantity, 10));
  if (isNaN(qty) || qty <= 0) {
    throw ApiError.badRequest(`Increment quantity must be a positive integer, got '${quantity}'`, [], 'INVALID_QUANTITY');
  }

  const queryFilter = {
    $or: [{ _id: targetId }, { batch: targetId }]
  };

  const updateDoc = {
    $inc: {
      quantity_on_hand: qty,
      version: 1
    }
  };

  const findOptions = { new: true };
  if (options.session) {
    findOptions.session = options.session;
  }

  const updatedStock = await StockModel.findOneAndUpdate(queryFilter, updateDoc, findOptions);

  if (!updatedStock) {
    throw ApiError.notFound(`Stock record not found for id '${targetId}'`, 'RESOURCE_NOT_FOUND');
  }

  if (updatedStock.quantity_on_hand > 0 && updatedStock.stock_status === STOCK_STATUS.OUT_OF_STOCK) {
    updatedStock.stock_status = STOCK_STATUS.AVAILABLE;
    await updatedStock.save({ session: options.session });
  }

  return updatedStock;
}

module.exports = {
  atomicDeductStock,
  atomicIncrementStock
};
