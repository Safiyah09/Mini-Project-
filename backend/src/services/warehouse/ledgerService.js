const { LEDGER_TXN_TYPES } = require('../../utils/constants');

/**
 * Warehouse Transaction Ledger Service
 * Append-only ledger recording all stock movements and providing stock reconciliation.
 */

/**
 * Record an append-only entry in the Warehouse Transaction Ledger
 */
const recordLedgerEntry = async (models, {
  txn_type,
  medicine_id,
  batch_id,
  quantity_delta,
  reference_type,
  reference_id,
  user_id = null,
  notes = '',
  session = null
}) => {
  const ledgerId = `LED-WH-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

  const createOptions = session ? { session } : {};
  const [entry] = await models.TransactionLedger.create(
    [
      {
        ledger_id: ledgerId,
        txn_type: txn_type.toUpperCase(),
        medicine_id,
        batch_id,
        quantity_delta: parseInt(quantity_delta, 10),
        reference_type: reference_type.toUpperCase(),
        reference_id: reference_id.toString(),
        user_id,
        notes,
        created_at: new Date()
      }
    ],
    createOptions
  );

  return entry;
};

/**
 * Reconcile stored batch stock against the append-only ledger
 * Formula: derived_stock = opening + stock_in + usable_returns - dispatch - damage
 */
const reconcileBatchStock = async (models, batchId) => {
  const stockDoc = await models.WarehouseStock.findOne({ batch: batchId }).populate('batch');
  const batchDoc = stockDoc ? stockDoc.batch : await models.Batch.findById(batchId);

  if (!batchDoc) {
    throw new Error(`Batch not found for reconciliation: ${batchId}`);
  }

  const ledgerEntries = await models.TransactionLedger.find({ batch_id: batchDoc._id }).sort({ created_at: 1 });

  let opening = 0;
  let stock_in = 0;
  let usable_returns = 0;
  let dispatch = 0;
  let damage = 0;
  let return_damaged = 0;

  ledgerEntries.forEach((entry) => {
    switch (entry.txn_type) {
      case LEDGER_TXN_TYPES.OPENING_BALANCE:
        opening += entry.quantity_delta;
        break;
      case LEDGER_TXN_TYPES.STOCK_IN:
        stock_in += entry.quantity_delta;
        break;
      case LEDGER_TXN_TYPES.RETURN_USABLE:
        usable_returns += entry.quantity_delta;
        break;
      case LEDGER_TXN_TYPES.DISPATCH:
        dispatch += Math.abs(entry.quantity_delta);
        break;
      case LEDGER_TXN_TYPES.DAMAGE:
        damage += Math.abs(entry.quantity_delta);
        break;
      case LEDGER_TXN_TYPES.RETURN_DAMAGED:
        return_damaged += Math.abs(entry.quantity_delta);
        break;
      default:
        // Generic fallback signed delta
        if (entry.quantity_delta > 0) stock_in += entry.quantity_delta;
        else dispatch += Math.abs(entry.quantity_delta);
    }
  });

  if (opening === 0 && stockDoc && stockDoc.opening_balance > 0) {
    opening = stockDoc.opening_balance;
  }

  const derived_stock = opening + stock_in + usable_returns - dispatch - damage;
  const stored_stock = stockDoc ? stockDoc.quantity_on_hand : 0;
  const matched = (derived_stock === stored_stock);

  return {
    batch_id: batchDoc._id,
    batch_number: batchDoc.batch_number,
    stored_stock,
    derived_stock,
    matched,
    difference: stored_stock - derived_stock,
    breakdown: {
      opening,
      stock_in,
      usable_returns,
      dispatch,
      damage,
      return_damaged
    },
    ledger_entries_count: ledgerEntries.length
  };
};

/**
 * Reconcile all warehouse stocks against transaction ledgers
 */
const reconcileAllStocks = async (models) => {
  const allStocks = await models.WarehouseStock.find().populate({
    path: 'batch',
    populate: { path: 'medicine', select: 'medicine_id name' }
  });

  const reconciliations = [];
  let matched_count = 0;
  let mismatched_count = 0;
  const discrepancies = [];

  for (const stock of allStocks) {
    if (!stock.batch) continue;
    const rec = await reconcileBatchStock(models, stock.batch._id);
    rec.medicine = stock.batch.medicine ? stock.batch.medicine.name : 'Unknown';
    reconciliations.push(rec);

    if (rec.matched) {
      matched_count++;
    } else {
      mismatched_count++;
      discrepancies.push(rec);
    }
  }

  return {
    total_batches: reconciliations.length,
    matched_count,
    mismatched_count,
    has_discrepancies: mismatched_count > 0,
    discrepancies,
    reconciliations
  };
};

module.exports = {
  recordLedgerEntry,
  reconcileBatchStock,
  reconcileAllStocks
};
