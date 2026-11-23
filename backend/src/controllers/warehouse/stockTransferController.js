const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { toDecimal128 } = require('../../models/commonSchema');
const { STOCK_TRANSFER_STATUS, INVOICE_STATUS, AUDIT_ACTIONS, STOCK_STATUS, LEDGER_TXN_TYPES } = require('../../utils/constants');
const { notifyPharmacyOfTransferDispatch, getTransferManifest } = require('../../services/interServiceBridge');
const { recordLedgerEntry } = require('../../services/warehouse/ledgerService');
const { transitionOrderStatus } = require('../../services/warehouse/orderStateMachine');
const { allocateFEFO } = require('../../services/common/fefoMinHeap');
const { withTransaction } = require('../../services/common/transactionWrapper');
const { atomicDeductStock } = require('../../services/common/concurrencyService');
const { recordAudit } = require('../../services/common/auditService');
const { validateBatchExpiry } = require('../../services/common/sharedValidation');

/**
 * Get all Stock Transfers with line items and invoices
 * GET /api/warehouse/transfers
 */
const getAllTransfers = async (req, res, next) => {
  try {
    const { status, pharmacy_id, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status.toUpperCase();
    if (pharmacy_id) filter.pharmacy = pharmacy_id;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const transfers = await req.models.StockTransfer.find(filter)
      .populate('pharmacy', 'pharmacy_id name address contact')
      .populate('supply_request', 'request_id status')
      .sort({ transfer_date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const trfIds = transfers.map((t) => t._id);
    const items = await req.models.TransferItem.find({ stock_transfer: { $in: trfIds } })
      .populate({
        path: 'batch',
        populate: { path: 'medicine', select: 'medicine_id name dosage formulation' }
      });

    const itemsMap = {};
    items.forEach((item) => {
      const tId = item.stock_transfer.toString();
      if (!itemsMap[tId]) itemsMap[tId] = [];
      itemsMap[tId].push(item);
    });

    const populatedTransfers = transfers.map((t) => ({
      ...t.toObject(),
      items: itemsMap[t._id.toString()] || []
    }));

    const total = await req.models.StockTransfer.countDocuments(filter);

    return ApiResponse.success(res, {
      transfers: populatedTransfers,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Stock transfers retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new Stock Transfer with automated FEFO batch allocation
 * POST /api/warehouse/transfers
 */
const createTransfer = async (req, res, next) => {
  try {
    const { supply_request, transfer_id, notes, auto_fefo = true, manual_items } = req.body;

    if (!supply_request) {
      throw ApiError.badRequest('supply_request identifier is required.');
    }

    // Resolve supply request
    let reqDoc = null;
    if (supply_request.match(/^[0-9a-fA-F]{24}$/)) {
      reqDoc = await req.models.SupplyRequest.findById(supply_request).populate('pharmacy');
    }
    if (!reqDoc) {
      reqDoc = await req.models.SupplyRequest.findOne({ request_id: supply_request.toUpperCase() }).populate('pharmacy');
    }
    if (!reqDoc) {
      throw ApiError.notFound(`Supply request '${supply_request}' not found.`);
    }

    const newTransferId = transfer_id || `TRF-${Date.now().toString().slice(-6)}`;

    // Create StockTransfer header
    const stockTransfer = await req.models.StockTransfer.create({
      transfer_id: newTransferId.toUpperCase(),
      supply_request: reqDoc._id,
      pharmacy: reqDoc.pharmacy._id,
      status: STOCK_TRANSFER_STATUS.ALLOCATED,
      notes
    });

    const requestItems = await req.models.RequestItem.find({ supply_request: reqDoc._id });
    const createdTransferItems = [];
    const now = new Date();

    if (auto_fefo) {
      // -----------------------------------------------------------------------
      // FEFO Batch Allocation (First-Expired, First-Out via Min-Heap)
      // -----------------------------------------------------------------------
      for (let i = 0; i < requestItems.length; i++) {
        const reqItem = requestItems[i];

        // Query active batches of this medicine
        const candidateBatchesDocs = await req.models.Batch.find({
          medicine: reqItem.medicine,
          isActive: true
        });

        const batchIds = candidateBatchesDocs.map(b => b._id);
        const stockDocs = await req.models.WarehouseStock.find({
          batch: { $in: batchIds }
        });

        const stockMap = {};
        stockDocs.forEach(s => {
          stockMap[s.batch.toString()] = s;
        });

        const candidateBatches = candidateBatchesDocs.map(b => {
          const s = stockMap[b._id.toString()];
          const avail = s ? Math.max(0, s.quantity_on_hand - s.quantity_reserved) : 0;
          return {
            _id: b._id,
            batch_id: b.batch_id,
            batch_number: b.batch_number,
            expiry_date: b.expiry_date,
            manufacturing_date: b.manufacturing_date,
            received_date: b.createdAt || (s ? s.createdAt : null),
            available_quantity: avail,
            _batchDoc: b,
            _stockDoc: s
          };
        });

        // Run Min-Heap FEFO allocation
        const plan = allocateFEFO(candidateBatches, reqItem.quantity_requested, { now });

        for (const alloc of plan.allocations) {
          const stock = alloc.raw_reference._stockDoc;
          const qtyToTake = alloc.allocated_quantity;

          // Reserve stock in warehouse
          stock.quantity_reserved += qtyToTake;
          await stock.save();

          // Create Transfer Item
          const trfItem = await req.models.TransferItem.create({
            transfer_item_id: `TRI-${stockTransfer.transfer_id}-${(createdTransferItems.length + 1).toString().padStart(2, '0')}`,
            stock_transfer: stockTransfer._id,
            request_item: reqItem._id,
            batch: alloc._id,
            quantity_allocated: qtyToTake,
            quantity_dispatched: qtyToTake
          });

          createdTransferItems.push(trfItem);
        }

        const allocatedForThisItem = plan.allocated_quantity;
        const remainingToAllocate = plan.unfulfilled_quantity;
        reqItem.quantity_fulfilled = allocatedForThisItem;
        reqItem.quantity_pending = remainingToAllocate;
        reqItem.is_backordered = (remainingToAllocate > 0);
        await reqItem.save();

        if (remainingToAllocate > 0) {
          console.warn(`[FEFO Allocation] Partial allocation for request item ${reqItem.request_item_id}: needed ${reqItem.quantity_requested}, shortfall ${remainingToAllocate} (backordered)`);
        }
      }
    } else if (manual_items && Array.isArray(manual_items)) {
      // Manual lot assignment
      for (let i = 0; i < manual_items.length; i++) {
        const mItm = manual_items[i];
        const qty = parseInt(mItm.quantity, 10);
        const trfItem = await req.models.TransferItem.create({
          transfer_item_id: `TRI-${stockTransfer.transfer_id}-${(i + 1).toString().padStart(2, '0')}`,
          stock_transfer: stockTransfer._id,
          request_item: mItm.request_item,
          batch: mItm.batch,
          quantity_allocated: qty,
          quantity_dispatched: qty
        });
        createdTransferItems.push(trfItem);
      }
    }

    if (createdTransferItems.length === 0) {
      throw ApiError.badRequest('Unable to allocate any stock. Insufficient or expired warehouse inventory.');
    }

    // Determine backorder status & update Order Status via State Machine
    const updatedRequestItems = await req.models.RequestItem.find({ supply_request: reqDoc._id });
    const hasBackorders = updatedRequestItems.some((itm) => itm.is_backordered);
    const targetStatus = hasBackorders ? 'PENDING_STOCK' : 'RESERVED';

    try {
      // Advance to STOCK_CHECKING first if current status is CREATED/PENDING
      if (reqDoc.status === 'CREATED' || reqDoc.status === 'PENDING') {
        await transitionOrderStatus(req.models, reqDoc._id, 'STOCK_CHECKING', req.user, 'Warehouse checking inventory availability');
      }
      await transitionOrderStatus(req.models, reqDoc._id, targetStatus, req.user, hasBackorders ? 'Partially allocated; pending backorders created' : 'Stock reserved in warehouse');
    } catch (stErr) {
      console.warn(`[State Machine Notice] Transitioning request: ${stErr.message}`);
    }

    return ApiResponse.created(res, {
      stockTransfer,
      transferItems: createdTransferItems,
      allocationType: auto_fefo ? 'FEFO_AUTOMATED' : 'MANUAL',
      hasBackorders,
      requestItems: updatedRequestItems
    }, 'Stock transfer created and batches allocated via FEFO');
  } catch (err) {
    next(err);
  }
};

/**
 * Dispatch Stock Transfer: Deducts warehouse stock, creates Invoice, and generates manifest
 * PUT /api/warehouse/transfers/:id/dispatch
 */
const dispatchTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const transfer = await req.models.StockTransfer.findById(id).populate('pharmacy');
    if (!transfer) {
      throw ApiError.notFound(`Stock transfer not found with id: ${id}`);
    }

    if (transfer.status === STOCK_TRANSFER_STATUS.DISPATCHED) {
      throw ApiError.badRequest('Transfer has already been dispatched.');
    }

    const transferItems = await req.models.TransferItem.find({ stock_transfer: transfer._id })
      .populate('batch');

    let totalInvoiceAmount = 0;

    let invoice = null;
    let manifest = null;

    // Execute dispatch within an ACID MongoDB session transaction
    await withTransaction(req.db, async (session) => {
      // Deduct physical stock atomically with non-negative check & ledger append
      for (const item of transferItems) {
        // Validation: Block dispatching expired batches
        validateBatchExpiry(item.batch);

        // Atomic stock deduction preventing negative stock & lost updates
        await atomicDeductStock(
          req.models.WarehouseStock,
          item.batch._id,
          item.quantity_dispatched,
          { session, decrementReserved: item.quantity_allocated }
        );

        // Record DISPATCH in TransactionLedger (Append-only) within session
        await recordLedgerEntry(req.models, {
          txn_type: LEDGER_TXN_TYPES.DISPATCH,
          medicine_id: item.batch.medicine,
          batch_id: item.batch._id,
          quantity_delta: -item.quantity_dispatched,
          reference_type: 'STOCK_TRANSFER',
          reference_id: transfer.transfer_id,
          user_id: req.user ? req.user._id : null,
          notes: `Dispatched to pharmacy ${transfer.pharmacy.name || transfer.pharmacy}`,
          session
        });

        // Estimate invoice price (approx ₹15 per item default or batch standard)
        totalInvoiceAmount += item.quantity_dispatched * 15.0;
      }

      transfer.status = STOCK_TRANSFER_STATUS.DISPATCHED;
      await transfer.save({ session });

      // Advance Supply Request status to DISPATCHED via State Machine
      if (transfer.supply_request) {
        try {
          const sr = await req.models.SupplyRequest.findById(transfer.supply_request).session(session);
          if (sr) {
            if (sr.status === 'RESERVED' || sr.status === 'PENDING_STOCK') {
              await transitionOrderStatus(req.models, sr._id, 'CONFIRMED', req.user, 'Transfer confirmed for shipment', session);
              await transitionOrderStatus(req.models, sr._id, 'DISPATCHED', req.user, `Dispatched under transfer ${transfer.transfer_id}`, session);
            } else if (sr.status === 'CONFIRMED') {
              await transitionOrderStatus(req.models, sr._id, 'DISPATCHED', req.user, `Dispatched under transfer ${transfer.transfer_id}`, session);
            }
          }
        } catch (smErr) {
          console.warn(`[State Machine Notice] Transitioning order to DISPATCHED: ${smErr.message}`);
        }
      }

      // Auto-generate Invoice for this transfer
      invoice = await req.models.Invoice.findOneAndUpdate(
        { stock_transfer: transfer._id },
        {
          invoice_id: `INV-${transfer.transfer_id}`,
          stock_transfer: transfer._id,
          pharmacy: transfer.pharmacy._id,
          status: INVOICE_STATUS.UNPAID,
          total_amount: toDecimal128(totalInvoiceAmount),
          invoice_date: new Date()
        },
        { upsert: true, new: true, session }
      );

      // Record Audit Log within session
      await recordAudit(
        req.models,
        {
          user: req.user ? req.user._id : null,
          tableName: 'stock_transfers',
          action: AUDIT_ACTIONS.TRANSFER_DISPATCH,
          details: {
            transfer_id: transfer.transfer_id,
            pharmacy: transfer.pharmacy.name || String(transfer.pharmacy),
            itemsCount: transferItems.length,
            invoice_id: invoice ? invoice.invoice_id : null
          }
        },
        session
      );

      // Support testing forced rollback
      if (req.headers['x-test-force-failure'] === 'dispatch_rollback') {
        throw new Error('Forced failure during dispatch for rollback verification test');
      }
    });

    try {
      manifest = await getTransferManifest(transfer._id);
    } catch (manifestErr) {
      console.warn(`[Dispatch] Manifest generation notice: ${manifestErr.message}`);
    }

    return ApiResponse.success(res, {
      transfer,
      invoice,
      dispatchedItems: transferItems,
      manifest
    }, 'Stock transfer dispatched and warehouse inventory updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Notify Branch Pharmacy of Dispatch
 * POST /api/warehouse/transfers/:id/notify
 */
const notifyPharmacyDispatchHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await notifyPharmacyOfTransferDispatch(id);
    return ApiResponse.success(res, result, 'Pharmacy successfully notified of transfer dispatch');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllTransfers,
  createTransfer,
  dispatchTransfer,
  notifyPharmacyDispatchHandler
};
