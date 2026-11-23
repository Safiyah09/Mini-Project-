const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { STOCK_RECEIPT_STATUS, SUPPLY_REQUEST_STATUS, STOCK_STATUS, LEDGER_TXN_TYPES, DISCREPANCY_TYPES, AUDIT_ACTIONS } = require('../../utils/constants');
const { lookupWarehouseTransferManifest } = require('../../services/interServiceBridge');
const { getWarehouseConnection } = require('../../config/warehouseDatabase');
const { getWarehouseModels } = require('../../models/warehouse');
const { transitionOrderStatus } = require('../../services/warehouse/orderStateMachine');
const { withTransaction } = require('../../services/common/transactionWrapper');
const { atomicIncrementStock } = require('../../services/common/concurrencyService');
const { recordLedgerEntry } = require('../../services/warehouse/ledgerService');
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
 * Get all pharmacy stock receipts
 * GET /api/pharmacy/receipts
 */
const getAllReceipts = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status.toUpperCase();

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const receipts = await req.models.StockReceipt.find(filter)
      .populate('supply_request', 'request_id status')
      .sort({ received_date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const rIds = receipts.map((r) => r._id);
    const items = await req.models.ReceiptItem.find({ stock_receipt: { $in: rIds } })
      .populate({
        path: 'batch',
        populate: { path: 'medicine', select: 'medicine_id name dosage formulation' }
      });

    const itemsMap = {};
    items.forEach((item) => {
      const rId = item.stock_receipt.toString();
      if (!itemsMap[rId]) itemsMap[rId] = [];
      itemsMap[rId].push(item);
    });

    const populatedReceipts = receipts.map((r) => ({
      ...r.toObject(),
      items: itemsMap[r._id.toString()] || []
    }));

    const total = await req.models.StockReceipt.countDocuments(filter);

    return ApiResponse.success(res, {
      stockReceipts: populatedReceipts,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Stock receipts retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Confirm and Process Stock Receipt from Warehouse
 * Updates pharmacy inventory ONLY after receipt confirmation. Prevents duplicate updates.
 * POST /api/pharmacy/receipts
 */
const confirmStockReceipt = async (req, res, next) => {
  try {
    const { supply_request, transfer_id, items, receipt_id, notes } = req.body;

    if (!transfer_id) {
      throw ApiError.badRequest('transfer_id (External Warehouse Transfer ID) is required.');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('items array is required with received lot details.');
    }

    // 1. Prevent duplicate processing of the same warehouse transfer
    const existingReceipt = await req.models.StockReceipt.findOne({ transfer_id: transfer_id.toUpperCase() });
    if (existingReceipt) {
      throw ApiError.conflict(`Stock receipt for warehouse transfer '${transfer_id}' has already been processed.`);
    }

    // 2. Resolve supply request if provided
    let reqDoc = null;
    if (supply_request) {
      if (supply_request.match(/^[0-9a-fA-F]{24}$/)) {
        reqDoc = await req.models.SupplyRequest.findById(supply_request);
      }
      if (!reqDoc) {
        reqDoc = await req.models.SupplyRequest.findOne({ request_id: supply_request.toUpperCase() });
      }
    }

    const newReceiptId = receipt_id || `REC-${Date.now().toString().slice(-6)}`;

    // Fetch manifest from Warehouse for reconciliation (read-only query)
    let manifest = null;
    try {
      manifest = await lookupWarehouseTransferManifest(transfer_id);
    } catch (mErr) {
      console.warn(`[Receipt] Manifest lookup note: ${mErr.message}`);
    }

    const createdReceiptItems = [];
    const updatedStocks = [];
    const discrepancies = [];
    const manifestItems = (manifest && Array.isArray(manifest.items)) ? manifest.items : [];
    const checkedManifestIndices = new Set();
    let stockReceipt = null;

    // Execute Pharmacy DB mutations atomically inside a MongoDB Session Transaction
    await withTransaction(req.db, async (session) => {
      // 3. Create StockReceipt Header within session
      const createdReceipts = await req.models.StockReceipt.create(
        [
          {
            receipt_id: newReceiptId.toUpperCase(),
            supply_request: reqDoc ? reqDoc._id : null,
            transfer_id: transfer_id.toUpperCase(),
            received_date: new Date(),
            status: STOCK_RECEIPT_STATUS.ACCEPTED,
            notes
          }
        ],
        { session }
      );
      stockReceipt = createdReceipts[0];

      // 4. Process each received batch item and reconcile against manifest
      for (let i = 0; i < items.length; i++) {
        const itm = items[i];
        const qtyReceived = parseInt(itm.quantity_received, 10);
        if (isNaN(qtyReceived) || qtyReceived <= 0) {
          throw ApiError.badRequest(`Invalid quantity_received for item ${i + 1}`);
        }

        const batchNum = itm.batch_number ? itm.batch_number.toUpperCase() : `BAT-REC-${Date.now().toString().slice(-4)}`;

        // Check against manifest items
        let matchedManifestItem = null;
        if (manifestItems.length > 0) {
          const mIdx = manifestItems.findIndex((mItm, idx) => {
            if (checkedManifestIndices.has(idx)) return false;
            return (mItm.batch_number && mItm.batch_number.toUpperCase() === batchNum) ||
                   (itm.transfer_item_id && mItm.transfer_item_id === itm.transfer_item_id);
          });

          if (mIdx !== -1) {
            checkedManifestIndices.add(mIdx);
            matchedManifestItem = manifestItems[mIdx];
            const expectedQty = matchedManifestItem.quantity_dispatched;

            if (qtyReceived < expectedQty) {
              discrepancies.push({
                discrepancy_id: `DISC-${Date.now().toString().slice(-6)}-${discrepancies.length + 1}`,
                receipt_id: stockReceipt.receipt_id,
                transfer_id: transfer_id.toUpperCase(),
                order_id: reqDoc ? reqDoc.request_id : null,
                batch_number: batchNum,
                expected_quantity: expectedQty,
                received_quantity: qtyReceived,
                discrepancy_type: DISCREPANCY_TYPES.SHORTAGE,
                reason: `Shortage of ${expectedQty - qtyReceived} units received against manifest for batch ${batchNum}`
              });
            } else if (qtyReceived > expectedQty) {
              discrepancies.push({
                discrepancy_id: `DISC-${Date.now().toString().slice(-6)}-${discrepancies.length + 1}`,
                receipt_id: stockReceipt.receipt_id,
                transfer_id: transfer_id.toUpperCase(),
                order_id: reqDoc ? reqDoc.request_id : null,
                batch_number: batchNum,
                expected_quantity: expectedQty,
                received_quantity: qtyReceived,
                discrepancy_type: DISCREPANCY_TYPES.EXCESS,
                reason: `Excess of ${qtyReceived - expectedQty} units received over manifest for batch ${batchNum}`
              });
            }
          } else {
            // Wrong batch
            discrepancies.push({
              discrepancy_id: `DISC-${Date.now().toString().slice(-6)}-${discrepancies.length + 1}`,
              receipt_id: stockReceipt.receipt_id,
              transfer_id: transfer_id.toUpperCase(),
              order_id: reqDoc ? reqDoc.request_id : null,
              batch_number: batchNum,
              expected_quantity: 0,
              received_quantity: qtyReceived,
              discrepancy_type: DISCREPANCY_TYPES.WRONG_BATCH,
              reason: `Batch ${batchNum} not present in warehouse manifest`
            });
          }
        }

        // Resolve or sync medicine in pharmacy database
        let medDoc = null;
        if (itm.medicine && typeof itm.medicine === 'string' && itm.medicine.match(/^[0-9a-fA-F]{24}$/)) {
          medDoc = await req.models.Medicine.findById(itm.medicine).session(session);
        }
        if (!medDoc && (itm.medicine_id || itm.medicine)) {
          const code = itm.medicine_id || itm.medicine;
          medDoc = await req.models.Medicine.findOne({ medicine_id: code.toString().toUpperCase() }).session(session);
        }
        if (!medDoc && (itm.medicine_name || (matchedManifestItem && matchedManifestItem.medicine_name))) {
          const mName = itm.medicine_name || matchedManifestItem.medicine_name;
          medDoc = await req.models.Medicine.findOne({ name: mName }).session(session);
        }
        if (!medDoc) {
          // Fallback: create medicine if missing in pharmacy catalog
          const createdMeds = await req.models.Medicine.create(
            [
              {
                medicine_id: itm.medicine_id || (matchedManifestItem && matchedManifestItem.medicine_id) || `MED-${Date.now().toString().slice(-4)}`,
                name: itm.medicine_name || (matchedManifestItem && matchedManifestItem.medicine_name) || 'General Medicine',
                manufacturer: itm.manufacturer || 'Standard Pharma',
                category: itm.category || 'General',
                dosage: itm.dosage || (matchedManifestItem && matchedManifestItem.dosage) || 'Standard',
                formulation: itm.formulation || (matchedManifestItem && matchedManifestItem.formulation) || 'Tablet',
                reorder_level: 20
              }
            ],
            { session }
          );
          medDoc = createdMeds[0];
        }

        // Resolve or create Batch in pharmacy database
        let batchDoc = await req.models.Batch.findOne({ batch_number: batchNum }).session(session);
        if (!batchDoc) {
          const createdBatches = await req.models.Batch.create(
            [
              {
                batch_id: `BAT-PH-${Date.now().toString().slice(-6)}-${i + 1}`,
                medicine: medDoc._id,
                batch_number: batchNum,
                manufacturing_date: itm.manufacturing_date ? new Date(itm.manufacturing_date) : new Date(),
                expiry_date: itm.expiry_date ? new Date(itm.expiry_date) : new Date(Date.now() + 730 * 24 * 60 * 60 * 1000)
              }
            ],
            { session }
          );
          batchDoc = createdBatches[0];
        }

        // Resolve request_item if available
        let reqItemDoc = null;
        if (itm.request_item && typeof itm.request_item === 'string' && itm.request_item.match(/^[0-9a-fA-F]{24}$/)) {
          reqItemDoc = await req.models.RequestItem.findById(itm.request_item).session(session);
        }
        if (!reqItemDoc && reqDoc) {
          reqItemDoc = await req.models.RequestItem.findOne({
            supply_request: reqDoc._id,
            medicine: medDoc._id
          }).session(session);
        }

        // Create ReceiptItem within session
        const createdReceiptItem = (await req.models.ReceiptItem.create(
          [
            {
              receipt_item_id: `RCI-${stockReceipt.receipt_id}-${(i + 1).toString().padStart(2, '0')}`,
              stock_receipt: stockReceipt._id,
              request_item: reqItemDoc ? reqItemDoc._id : null,
              batch: batchDoc._id,
              quantity_received: qtyReceived
            }
          ],
          { session }
        ))[0];
        createdReceiptItems.push(createdReceiptItem);

        // Update PharmacyStock ONLY for verified received quantity
        let updatedStockDoc = null;
        const existingStock = await req.models.PharmacyStock.findOne({ batch: batchDoc._id }).session(session);
        if (!existingStock) {
          const createdStocks = await req.models.PharmacyStock.create(
            [
              {
                stock_id: `STK-PH-${Date.now().toString().slice(-6)}-${i + 1}`,
                batch: batchDoc._id,
                quantity_on_hand: qtyReceived,
                stock_status: STOCK_STATUS.AVAILABLE
              }
            ],
            { session }
          );
          updatedStockDoc = createdStocks[0];
        } else {
          updatedStockDoc = await atomicIncrementStock(req.models.PharmacyStock, batchDoc._id, qtyReceived, { session });
        }
        updatedStocks.push(updatedStockDoc);

        // Record STOCK_IN in Pharmacy TransactionLedger within session
        if (req.models.TransactionLedger) {
          await recordLedgerEntry(req.models, {
            txn_type: LEDGER_TXN_TYPES.STOCK_IN,
            medicine_id: medDoc._id,
            batch_id: batchDoc._id,
            quantity_delta: qtyReceived,
            reference_type: 'STOCK_RECEIPT',
            reference_id: stockReceipt.receipt_id,
            user_id: req.user ? req.user._id : null,
            notes: `Stock received from warehouse transfer ${transfer_id} (batch ${batchNum})`,
            session
          });
        }
      }

      // Persist Discrepancies if any and update receipt status
      if (discrepancies.length > 0) {
        stockReceipt.status = STOCK_RECEIPT_STATUS.DISCREPANCY;
        await stockReceipt.save({ session });

        // Save to Pharmacy ReceiptDiscrepancy collection within session
        if (req.models.ReceiptDiscrepancy) {
          await req.models.ReceiptDiscrepancy.insertMany(discrepancies, { session });
        }
      }

      // Advance Supply Request status to COMPLETED if full delivery accepted
      if (reqDoc) {
        try {
          await transitionOrderStatus(req.models, reqDoc._id, 'COMPLETED', req.user, 'Receipt reconciled against manifest', session);
        } catch (tsErr) {
          reqDoc.status = SUPPLY_REQUEST_STATUS.FULFILLED;
          await reqDoc.save({ session });
        }
      }

      // Record Audit Log within session
      await recordAudit(
        req.models,
        {
          user: req.user ? req.user._id : null,
          tableName: 'stock_receipts',
          action: AUDIT_ACTIONS.STOCK_RECEIPT,
          details: {
            receipt_id: stockReceipt.receipt_id,
            transfer_id: transfer_id.toUpperCase(),
            items_count: createdReceiptItems.length,
            discrepancies_count: discrepancies.length
          }
        },
        session
      );
    });

    // Cross-Database Sync: Sync discrepancies to Warehouse DB using retryable workflow
    if (discrepancies.length > 0) {
      try {
        await executeWithRetry(async () => {
          const whConn = await getWarehouseConnection();
          const whModels = getWarehouseModels(whConn);
          if (whModels.ReceiptDiscrepancy) {
            const warehouseDiscrepancies = discrepancies.map((d) => ({
              ...d,
              pharmacy_id: req.pharmacyId || 'pharmacy'
            }));
            await whModels.ReceiptDiscrepancy.insertMany(warehouseDiscrepancies);
          }
        }, 3, 200);
      } catch (syncErr) {
        console.warn(`[Receipt] Warehouse discrepancy sync notice: ${syncErr.message}`);
      }
    }

    return ApiResponse.created(res, {
      stockReceipt,
      receiptItems: createdReceiptItems,
      pharmacyStocks: updatedStocks,
      discrepanciesCount: discrepancies.length,
      discrepancies
    }, discrepancies.length > 0
      ? 'Stock receipt confirmed with discrepancies recorded'
      : 'Stock receipt verified and pharmacy inventory updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Query Central Warehouse Transfer Manifest before receiving goods
 * GET /api/pharmacy/receipts/warehouse-transfer/:transferId
 */
const lookupWarehouseManifest = async (req, res, next) => {
  try {
    const { transferId } = req.params;
    const manifest = await lookupWarehouseTransferManifest(transferId);
    return ApiResponse.success(res, manifest, 'Warehouse transfer manifest retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Query Receipt Discrepancies
 * GET /api/pharmacy/receipts/discrepancies
 */
const getReceiptDiscrepancies = async (req, res, next) => {
  try {
    const { transfer_id, receipt_id } = req.query;
    const filter = {};
    if (transfer_id) filter.transfer_id = transfer_id.toUpperCase();
    if (receipt_id) filter.receipt_id = receipt_id.toUpperCase();

    const discrepancies = await req.models.ReceiptDiscrepancy.find(filter).sort({ created_at: -1 });
    return ApiResponse.success(res, discrepancies, 'Receipt discrepancies retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllReceipts,
  confirmStockReceipt,
  lookupWarehouseManifest,
  getReceiptDiscrepancies
};
