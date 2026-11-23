const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { LEDGER_TXN_TYPES } = require('../../utils/constants');
const { withTransaction } = require('../../services/common/transactionWrapper');
const { atomicIncrementStock } = require('../../services/common/concurrencyService');
const { recordAudit } = require('../../services/common/auditService');
const { validatePositiveQuantity, validateReturnLimit } = require('../../services/common/sharedValidation');

/**
 * Get all sales returns
 * GET /api/pharmacy/returns
 */
const getAllReturns = async (req, res, next) => {
  try {
    const returns = await req.models.SalesReturn.find()
      .populate({
        path: 'sale_item',
        populate: [
          { path: 'sale', select: 'sale_id sale_date' },
          { path: 'batch', select: 'batch_number expiry_date' }
        ]
      })
      .sort({ return_date: -1 });

    return ApiResponse.success(res, returns, 'Sales returns retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Process a customer sales return and restore inventory
 * POST /api/pharmacy/returns
 */
const createSalesReturn = async (req, res, next) => {
  try {
    const { sale_item, quantity, reason, return_id } = req.body;

    if (!sale_item || !quantity || !reason) {
      throw ApiError.badRequest('sale_item, quantity, and reason are required.');
    }

    const qty = validatePositiveQuantity(quantity, 'quantity');

    // Resolve sale_item
    let saleItemDoc = null;
    if (sale_item.match(/^[0-9a-fA-F]{24}$/)) {
      saleItemDoc = await req.models.SaleItem.findById(sale_item).populate('batch');
    }
    if (!saleItemDoc) {
      saleItemDoc = await req.models.SaleItem.findOne({ sale_item_id: sale_item.toUpperCase() }).populate('batch');
    }
    if (!saleItemDoc) {
      throw ApiError.notFound(`Sale item '${sale_item}' not found.`);
    }

    // Shared validation: Return quantity cannot exceed original sold quantity
    validateReturnLimit(qty, saleItemDoc.quantity, saleItemDoc.sale_item_id);

    const newReturnId = return_id || `RET-${Date.now().toString().slice(-6)}`;
    let salesReturn = null;

    // Execute sales return & inventory restock in an ACID Transaction
    await withTransaction(req.db, async (session) => {
      // Create SalesReturn record
      const [srDoc] = await req.models.SalesReturn.create(
        [
          {
            return_id: newReturnId.toUpperCase(),
            sale_item: saleItemDoc._id,
            quantity: qty,
            reason,
            return_date: new Date()
          }
        ],
        { session }
      );
      salesReturn = srDoc;

      // Restock PharmacyStock atomically
      await atomicIncrementStock(req.models.PharmacyStock, saleItemDoc.batch._id || saleItemDoc.batch, qty, { session });

      // Record in pharmacy TransactionLedger
      if (req.models.TransactionLedger) {
        await req.models.TransactionLedger.create(
          [
            {
              ledger_id: `LED-RET-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
              txn_type: LEDGER_TXN_TYPES.RETURN_USABLE,
              medicine_id: saleItemDoc.batch.medicine ? (saleItemDoc.batch.medicine._id || saleItemDoc.batch.medicine) : null,
              batch_id: saleItemDoc.batch._id || saleItemDoc.batch,
              quantity_delta: qty,
              reference_type: 'SALES_RETURN',
              reference_id: salesReturn.return_id,
              user_id: req.user ? req.user._id : null,
              notes: `Customer return restocked: ${reason}`,
              created_at: new Date()
            }
          ],
          { session }
        );
      }

      // Record Audit Log
      await recordAudit(
        req.models,
        {
          user: req.user ? req.user._id : null,
          tableName: 'sales_returns',
          action: 'SALES_RETURN',
          details: {
            return_id: salesReturn.return_id,
            sale_item: saleItemDoc.sale_item_id,
            quantity: qty,
            reason
          }
        },
        session
      );
    });

    return ApiResponse.created(res, {
      salesReturn,
      restockedQuantity: qty
    }, 'Sales return processed and inventory restocked successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllReturns,
  createSalesReturn
};
