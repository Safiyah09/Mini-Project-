const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { AUDIT_ACTIONS, LEDGER_TXN_TYPES } = require('../../utils/constants');
const { recordLedgerEntry } = require('../../services/warehouse/ledgerService');
const { withTransaction } = require('../../services/common/transactionWrapper');
const { atomicIncrementStock, atomicDeductStock } = require('../../services/common/concurrencyService');
const { recordAudit } = require('../../services/common/auditService');

/**
 * Create Supplier Return (Warehouse returning goods to supplier)
 * POST /api/warehouse/returns/supplier
 */
const createSupplierReturn = async (req, res, next) => {
  try {
    const { gr_item, quantity, reason, return_id } = req.body;

    if (!gr_item || !quantity || !reason) {
      throw ApiError.badRequest('gr_item, quantity, and reason are required.');
    }

    const returnQty = parseInt(quantity, 10);
    if (isNaN(returnQty) || returnQty <= 0) {
      throw ApiError.badRequest('quantity must be a positive integer.');
    }

    // Resolve GR Item
    let grItemDoc = null;
    if (gr_item.match(/^[0-9a-fA-F]{24}$/)) {
      grItemDoc = await req.models.GoodsReceiptItem.findById(gr_item).populate('batch');
    }
    if (!grItemDoc) {
      grItemDoc = await req.models.GoodsReceiptItem.findOne({ gr_item_id: gr_item.toUpperCase() }).populate('batch');
    }

    if (!grItemDoc) {
      throw ApiError.notFound(`Goods receipt item not found: ${gr_item}`);
    }

    // Check available warehouse stock for this batch
    const stock = await req.models.WarehouseStock.findOne({ batch: grItemDoc.batch._id });
    if (!stock || stock.quantity_on_hand < returnQty) {
      throw ApiError.badRequest(`Insufficient warehouse stock on hand (${stock ? stock.quantity_on_hand : 0}) to return ${returnQty} units to supplier.`);
    }

    // Deduct stock from warehouse
    stock.quantity_on_hand -= returnQty;
    await stock.save();

    const newId = return_id || `RET-SUP-${Date.now().toString().slice(-6)}`;

    const supplierReturn = await req.models.SupplierReturn.create({
      return_id: newId.toUpperCase(),
      gr_item: grItemDoc._id,
      quantity: returnQty,
      reason,
      return_date: new Date()
    });

    if (req.user) {
      await req.models.AuditLog.create({
        log_id: `LOG-${Date.now()}`,
        user: req.user._id,
        table_name: 'supplier_returns',
        action: AUDIT_ACTIONS.ADJUST_STOCK,
        details: {
          return_id: supplierReturn.return_id,
          batch: grItemDoc.batch.batch_number,
          quantity: returnQty,
          reason
        }
      });
    }

    return ApiResponse.created(res, {
      supplierReturn,
      remainingStockOnHand: stock.quantity_on_hand
    }, 'Supplier return processed and warehouse inventory updated');
  } catch (err) {
    next(err);
  }
};

/**
 * List Supplier Returns
 * GET /api/warehouse/returns/supplier
 */
const getAllSupplierReturns = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const returns = await req.models.SupplierReturn.find()
      .populate({
        path: 'gr_item',
        populate: [
          { path: 'batch', select: 'batch_number expiry_date medicine' },
          { path: 'goods_receipt', select: 'receipt_id receipt_date' }
        ]
      })
      .sort({ return_date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await req.models.SupplierReturn.countDocuments();

    return ApiResponse.success(res, {
      returns,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Supplier returns retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create Pharmacy Return (Receiving returned stock from pharmacy into warehouse)
 * POST /api/warehouse/returns/pharmacy
 */
const createPharmacyReturn = async (req, res, next) => {
  try {
    const { transfer_item, quantity, reason, return_id, restock_to_inventory = false } = req.body;

    if (!transfer_item || !quantity || !reason) {
      throw ApiError.badRequest('transfer_item, quantity, and reason are required.');
    }

    const returnQty = parseInt(quantity, 10);
    if (isNaN(returnQty) || returnQty <= 0) {
      throw ApiError.badRequest('quantity must be a positive integer.');
    }

    let trfItemDoc = null;
    if (transfer_item.match(/^[0-9a-fA-F]{24}$/)) {
      trfItemDoc = await req.models.TransferItem.findById(transfer_item).populate('batch');
    }
    if (!trfItemDoc) {
      trfItemDoc = await req.models.TransferItem.findOne({ transfer_item_id: transfer_item.toUpperCase() }).populate('batch');
    }

    if (!trfItemDoc) {
      throw ApiError.notFound(`Transfer item not found: ${transfer_item}`);
    }

    const newId = return_id || `RET-PH-${Date.now().toString().slice(-6)}`;
    let pharmacyReturn = null;
    let updatedStock = null;

    await withTransaction(req.db || req.warehouseConn, async (session) => {
      const createdReturns = await req.models.PharmacyReturn.create(
        [
          {
            return_id: newId.toUpperCase(),
            transfer_item: trfItemDoc._id,
            quantity: returnQty,
            reason,
            return_date: new Date()
          }
        ],
        { session }
      );
      pharmacyReturn = createdReturns[0];

      // If restock requested and medicine is not damaged/expired
      if (restock_to_inventory && trfItemDoc.batch) {
        const stockDoc = await atomicIncrementStock(req.models.WarehouseStock, trfItemDoc.batch._id, returnQty, { session });
        updatedStock = stockDoc.quantity_on_hand;
      }

      // Record return in Warehouse Transaction Ledger (Engine E1)
      if (trfItemDoc.batch) {
        const batchDoc = trfItemDoc.batch._id ? trfItemDoc.batch : await req.models.Batch.findById(trfItemDoc.batch).session(session);
        const medicineId = batchDoc.medicine ? (batchDoc.medicine._id || batchDoc.medicine) : null;

        const txnType = restock_to_inventory ? LEDGER_TXN_TYPES.RETURN_USABLE : LEDGER_TXN_TYPES.RETURN_DAMAGED;
        const delta = restock_to_inventory ? returnQty : 0;

        await recordLedgerEntry(req.models, {
          txn_type: txnType,
          medicine_id: medicineId,
          batch_id: batchDoc._id,
          quantity_delta: delta,
          reference_type: 'PHARMACY_RETURN',
          reference_id: pharmacyReturn.return_id,
          user_id: req.user ? req.user._id : null,
          notes: restock_to_inventory
            ? `Usable pharmacy return: +${returnQty} units restored to stock. Reason: ${reason}`
            : `Damaged pharmacy return: ${returnQty} units recorded in ledger (NOT added to stock). Reason: ${reason}`,
          session
        });
      }

      // Record audit log within session
      await recordAudit(
        req.models,
        {
          user: req.user ? req.user._id : null,
          tableName: 'pharmacy_returns',
          action: AUDIT_ACTIONS.ADJUST_STOCK,
          details: {
            return_id: pharmacyReturn.return_id,
            batch: trfItemDoc.batch ? trfItemDoc.batch.batch_number : null,
            quantity: returnQty,
            reason,
            restocked: restock_to_inventory
          }
        },
        session
      );
    });

    return ApiResponse.created(res, {
      pharmacyReturn,
      restockedToInventory: restock_to_inventory,
      warehouseStockOnHand: updatedStock
    }, 'Pharmacy return accepted successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * List Pharmacy Returns
 * GET /api/warehouse/returns/pharmacy
 */
const getAllPharmacyReturns = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const returns = await req.models.PharmacyReturn.find()
      .populate({
        path: 'transfer_item',
        populate: [
          { path: 'batch', select: 'batch_number expiry_date medicine' },
          {
            path: 'stock_transfer',
            select: 'transfer_id pharmacy',
            populate: { path: 'pharmacy', select: 'name branch_name' }
          }
        ]
      })
      .sort({ return_date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await req.models.PharmacyReturn.countDocuments();

    return ApiResponse.success(res, {
      returns,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Pharmacy returns retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createSupplierReturn,
  getAllSupplierReturns,
  createPharmacyReturn,
  getAllPharmacyReturns
};
