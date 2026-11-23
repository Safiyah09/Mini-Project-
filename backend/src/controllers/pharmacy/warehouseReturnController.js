const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { LEDGER_TXN_TYPES, AUDIT_ACTIONS } = require('../../utils/constants');
const { getWarehouseConnection } = require('../../config/warehouseDatabase');
const { getWarehouseModels } = require('../../models/warehouse');
const { recordLedgerEntry } = require('../../services/warehouse/ledgerService');
const { withTransaction } = require('../../services/common/transactionWrapper');
const { atomicDeductStock, atomicIncrementStock } = require('../../services/common/concurrencyService');
const { recordAudit } = require('../../services/common/auditService');

/**
 * Retryable execution helper for cross-database operations
 */
async function executeWithRetry(fn, retries = 3, delayMs = 150) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastErr;
}

/**
 * Pharmacy sends a Return / Damaged stock back to the Central Warehouse
 * Uses Saga pattern with compensating transaction across independent databases.
 * POST /api/pharmacy/returns/to-warehouse
 */
const returnGoodsToWarehouse = async (req, res, next) => {
  try {
    const { transfer_id, batch_number, quantity, reason, is_usable = true } = req.body;

    if (!transfer_id || !batch_number || !quantity || !reason) {
      throw ApiError.badRequest('transfer_id, batch_number, quantity, and reason are required.');
    }

    const returnQty = parseInt(quantity, 10);
    if (isNaN(returnQty) || returnQty <= 0) {
      throw ApiError.badRequest('quantity must be a positive integer.');
    }

    // 1. Validate batch and stock in Pharmacy database
    const pharmBatch = await req.models.Batch.findOne({ batch_number: batch_number.toUpperCase() });
    if (!pharmBatch) {
      throw ApiError.notFound(`Batch '${batch_number}' not found in pharmacy database.`);
    }

    const returnRefId = (req.body.operation_id || req.body.return_id || `RET-WH-${Date.now().toString().slice(-6)}`).toUpperCase();
    let pharmLedgerEntry = null;
    let updatedPharmStock = null;

    // 2. Phase 1 (Pharmacy DB): Deduct physical stock & append ledger within Pharmacy Session Transaction
    await withTransaction(req.db, async (pharmSession) => {
      // Atomic stock deduction with non-negative check
      updatedPharmStock = await atomicDeductStock(
        req.models.PharmacyStock,
        pharmBatch._id,
        returnQty,
        { session: pharmSession }
      );

      // Record in Pharmacy TransactionLedger within session
      pharmLedgerEntry = await recordLedgerEntry(req.models, {
        txn_type: LEDGER_TXN_TYPES.DISPATCH,
        medicine_id: pharmBatch.medicine,
        batch_id: pharmBatch._id,
        quantity_delta: -returnQty,
        reference_type: 'WAREHOUSE_RETURN',
        reference_id: returnRefId,
        user_id: req.user ? req.user._id : null,
        notes: `Returned to central warehouse (${is_usable ? 'Usable' : 'Damaged'}). Reason: ${reason}`,
        session: pharmSession
      });

      // Record Pharmacy Audit Log within session
      await recordAudit(
        req.models,
        {
          user: req.user ? req.user._id : null,
          tableName: 'pharmacy_stocks',
          action: AUDIT_ACTIONS.ADJUST_STOCK,
          details: {
            batch_number: batch_number.toUpperCase(),
            quantity_returned: returnQty,
            is_usable,
            reason,
            reference_id: returnRefId
          }
        },
        pharmSession
      );
    });

    // 3. Phase 2 (Warehouse DB): Cross-database update with retryable workflow & compensating saga rollback
    let whReturnDoc = null;
    let whLedgerEntry = null;

    try {
      await executeWithRetry(async () => {
        const whConn = await getWarehouseConnection();
        const whModels = getWarehouseModels(whConn);

        // Idempotency check on Warehouse DB: If this return_id already committed on an earlier attempt, reuse it
        const existingReturn = await whModels.PharmacyReturn.findOne({ return_id: returnRefId });
        if (existingReturn) {
          whReturnDoc = existingReturn;
          return;
        }

        // Find warehouse transfer item
        const whTransfer = await whModels.StockTransfer.findOne({ transfer_id: transfer_id.toUpperCase() });
        let whTrfItem = null;
        if (whTransfer) {
          const whBatches = await whModels.Batch.find({ batch_number: batch_number.toUpperCase() });
          const whBatchIds = whBatches.map((b) => b._id);
          whTrfItem = await whModels.TransferItem.findOne({
            stock_transfer: whTransfer._id,
            batch: { $in: whBatchIds }
          }).populate('batch');
        }

        if (whTrfItem) {
          // Wrap Warehouse updates in Warehouse Session Transaction
          await withTransaction(whConn, async (whSession) => {
            // Re-verify inside session to prevent race conditions
            const inSessionCheck = await whModels.PharmacyReturn.findOne({ return_id: returnRefId }).session(whSession);
            if (inSessionCheck) {
              whReturnDoc = inSessionCheck;
              return;
            }

            const createdReturns = await whModels.PharmacyReturn.create(
              [
                {
                  return_id: returnRefId,
                  transfer_item: whTrfItem._id,
                  quantity: returnQty,
                  reason,
                  return_date: new Date()
                }
              ],
              { session: whSession }
            );
            whReturnDoc = createdReturns[0];

            // Update warehouse stock if usable
            if (is_usable && whTrfItem.batch) {
              await atomicIncrementStock(
                whModels.WarehouseStock,
                whTrfItem.batch._id,
                returnQty,
                { session: whSession }
              );
            }

            // Record in Warehouse TransactionLedger within warehouse session
            const whTxnType = is_usable ? LEDGER_TXN_TYPES.RETURN_USABLE : LEDGER_TXN_TYPES.RETURN_DAMAGED;
            const whDelta = is_usable ? returnQty : 0;
            const whMedId = whTrfItem.batch ? whTrfItem.batch.medicine : null;

            whLedgerEntry = await recordLedgerEntry(whModels, {
              txn_type: whTxnType,
              medicine_id: whMedId,
              batch_id: whTrfItem.batch._id,
              quantity_delta: whDelta,
              reference_type: 'PHARMACY_RETURN',
              reference_id: returnRefId,
              user_id: null,
              notes: is_usable
                ? `Usable return from pharmacy accepted (+${returnQty} stock). Reason: ${reason}`
                : `Damaged return from pharmacy recorded (0 stock delta). Reason: ${reason}`,
              session: whSession
            });

            // Record Warehouse Audit Log within session
            await recordAudit(
              whModels,
              {
                user: null,
                tableName: 'pharmacy_returns',
                action: AUDIT_ACTIONS.ADJUST_STOCK,
                details: {
                  return_id: returnRefId,
                  batch: whTrfItem.batch ? whTrfItem.batch.batch_number : null,
                  quantity: returnQty,
                  is_usable,
                  reason
                }
              },
              whSession
            );
          });
        }
      }, 3, 200);
    } catch (whErr) {
      console.error(`[Saga Notice] Warehouse sync attempt encountered error for return ${returnRefId}: ${whErr.message}. Checking actual commit state...`);

      // Saga Recovery Check: Did the warehouse operation commit successfully despite response timeout/drop?
      try {
        const whCheckConn = await getWarehouseConnection();
        const whCheckModels = getWarehouseModels(whCheckConn);
        const committedWhReturn = await whCheckModels.PharmacyReturn.findOne({ return_id: returnRefId });
        if (committedWhReturn) {
          console.log(`[Saga Recovery] Warehouse return ${returnRefId} committed successfully on warehouse DB. Reusing committed record without compensation.`);
          whReturnDoc = committedWhReturn;
          return ApiResponse.created(res, {
            return_id: returnRefId,
            transfer_id: transfer_id.toUpperCase(),
            batch_number: batch_number.toUpperCase(),
            quantity_returned: returnQty,
            is_usable,
            pharmacyStockRemaining: updatedPharmStock ? updatedPharmStock.quantity_on_hand : null,
            pharmacyLedgerId: pharmLedgerEntry ? pharmLedgerEntry.ledger_id : null,
            warehouseReturnId: whReturnDoc ? whReturnDoc.return_id : null,
            warehouseLedgerId: whLedgerEntry ? whLedgerEntry.ledger_id : null,
            saga_recovered: true
          }, 'Return to warehouse processed successfully (recovered from transient response timeout)');
        }
      } catch (checkErr) {
        console.warn(`[Saga Recovery Warning] Could not verify warehouse commit status: ${checkErr.message}`);
      }

      // Saga Compensating Action: Restore deducted stock and record reversal in Pharmacy DB only if not already compensated
      try {
        const existingComp = await req.models.TransactionLedger.findOne({
          reference_type: 'SAGA_COMPENSATION',
          reference_id: returnRefId
        });

        if (!existingComp) {
          await withTransaction(req.db, async (compSession) => {
            await atomicIncrementStock(req.models.PharmacyStock, pharmBatch._id, returnQty, { session: compSession });
            await recordLedgerEntry(req.models, {
              txn_type: LEDGER_TXN_TYPES.RETURN_USABLE,
              medicine_id: pharmBatch.medicine,
              batch_id: pharmBatch._id,
              quantity_delta: returnQty,
              reference_type: 'SAGA_COMPENSATION',
              reference_id: returnRefId,
              user_id: req.user ? req.user._id : null,
              notes: `Compensating reversal: Warehouse sync failed for return ${returnRefId}. Stock restored.`,
              session: compSession
            });
          });
          console.log(`[Saga Success] Pharmacy stock successfully restored under compensation.`);
        }
      } catch (compErr) {
        console.error(`[Saga Critical] Compensating transaction failed: ${compErr.message}`);
      }

      throw ApiError.internal(`Failed to complete return to Central Warehouse: ${whErr.message}. Pharmacy inventory has been restored.`);
    }

    return ApiResponse.created(res, {
      return_id: returnRefId,
      transfer_id: transfer_id.toUpperCase(),
      batch_number: batch_number.toUpperCase(),
      quantity_returned: returnQty,
      is_usable,
      pharmacyStockRemaining: updatedPharmStock ? updatedPharmStock.quantity_on_hand : null,
      pharmacyLedgerId: pharmLedgerEntry ? pharmLedgerEntry.ledger_id : null,
      warehouseReturnId: whReturnDoc ? whReturnDoc.return_id : null,
      warehouseLedgerId: whLedgerEntry ? whLedgerEntry.ledger_id : null
    }, 'Return to warehouse processed successfully with matching ledger entries');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  returnGoodsToWarehouse
};
