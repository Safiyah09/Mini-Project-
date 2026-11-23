const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { AUDIT_ACTIONS, STOCK_STATUS, LEDGER_TXN_TYPES } = require('../../utils/constants');
const { recordLedgerEntry } = require('../../services/warehouse/ledgerService');
const { withTransaction } = require('../../services/common/transactionWrapper');
const { atomicDeductStock, atomicIncrementStock } = require('../../services/common/concurrencyService');
const { recordAudit } = require('../../services/common/auditService');

/**
 * Get all stock adjustments
 * GET /api/warehouse/adjustments
 */
const getAllAdjustments = async (req, res, next) => {
  try {
    const adjustments = await req.models.StockAdjustment.find()
      .populate('user', 'name username')
      .populate({
        path: 'batch',
        populate: { path: 'medicine', select: 'name dosage formulation' }
      })
      .sort({ adjustment_date: -1 });

    return ApiResponse.success(res, adjustments, 'Stock adjustments retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new stock adjustment
 * POST /api/warehouse/adjustments
 */
const createAdjustment = async (req, res, next) => {
  try {
    const { batch, quantity, reason, adjustment_id } = req.body;

    if (!batch || quantity === undefined || !reason) {
      throw ApiError.badRequest('batch, quantity, and reason are required.');
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty === 0) {
      throw ApiError.badRequest('quantity must be a non-zero integer.');
    }

    // Resolve batch
    let batchDoc = null;
    if (batch.match(/^[0-9a-fA-F]{24}$/)) {
      batchDoc = await req.models.Batch.findById(batch);
    }
    if (!batchDoc) {
      batchDoc = await req.models.Batch.findOne({
        $or: [{ batch_id: batch.toUpperCase() }, { batch_number: batch.toUpperCase() }]
      });
    }
    if (!batchDoc) {
      throw ApiError.notFound(`Batch '${batch}' not found.`);
    }

    let adjustment = null;
    let updatedStock = null;

    // Wrap inventory modification and ledger append in MongoDB Session Transaction
    await withTransaction(req.db, async (session) => {
      // Find current stock
      const stock = await req.models.WarehouseStock.findOne({ batch: batchDoc._id }).session(session);
      if (!stock) {
        throw ApiError.notFound(`No warehouse inventory found for batch '${batchDoc.batch_number}'.`);
      }

      const prevQty = stock.quantity_on_hand;

      if (qty < 0) {
        // Atomic deduction with non-negative protection
        const deductQty = Math.abs(qty);
        if (stock.quantity_on_hand < deductQty) {
          throw ApiError.badRequest(
            `Cannot adjust quantity by ${qty}. Current quantity on hand is ${stock.quantity_on_hand}, which would result in negative stock.`
          );
        }
        updatedStock = await atomicDeductStock(req.models.WarehouseStock, batchDoc._id, deductQty, { session });
      } else {
        // Atomic increment
        updatedStock = await atomicIncrementStock(req.models.WarehouseStock, batchDoc._id, qty, { session });
      }

      const newAdjId = adjustment_id || `ADJ-${Date.now().toString().slice(-6)}`;

      // Create adjustment record
      const createdAdjs = await req.models.StockAdjustment.create(
        [
          {
            adjustment_id: newAdjId.toUpperCase(),
            batch: batchDoc._id,
            user: req.user ? req.user._id : null,
            quantity: qty,
            reason
          }
        ],
        { session }
      );
      adjustment = createdAdjs[0];

      // Record adjustment in Warehouse Transaction Ledger (Engine E1)
      const txnType = qty < 0 ? LEDGER_TXN_TYPES.DAMAGE : LEDGER_TXN_TYPES.STOCK_IN;
      await recordLedgerEntry(req.models, {
        txn_type: txnType,
        medicine_id: batchDoc.medicine,
        batch_id: batchDoc._id,
        quantity_delta: qty,
        reference_type: 'STOCK_ADJUSTMENT',
        reference_id: adjustment.adjustment_id,
        user_id: req.user ? req.user._id : null,
        notes: `Stock adjustment: ${qty > 0 ? '+' : ''}${qty} units. Reason: ${reason}`,
        session
      });

      // Record audit log within session
      await recordAudit(
        req.models,
        {
          user: req.user ? req.user._id : null,
          tableName: 'warehouse_stocks',
          action: AUDIT_ACTIONS.ADJUST_STOCK,
          details: {
            batch_number: batchDoc.batch_number,
            adjustment_quantity: qty,
            previous_quantity: prevQty,
            new_quantity: updatedStock.quantity_on_hand,
            reason
          }
        },
        session
      );
    });

    return ApiResponse.created(res, {
      adjustment,
      stock: updatedStock
    }, 'Stock adjustment recorded successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllAdjustments,
  createAdjustment
};
