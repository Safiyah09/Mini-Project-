const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { GOODS_RECEIPT_STATUS, PURCHASE_ORDER_STATUS, STOCK_STATUS, AUDIT_ACTIONS, LEDGER_TXN_TYPES } = require('../../utils/constants');
const { recordLedgerEntry } = require('../../services/warehouse/ledgerService');

/**
 * Get all Goods Receipts
 * GET /api/warehouse/goods-receipts
 */
const getAllGoodsReceipts = async (req, res, next) => {
  try {
    const { status, po_id, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status) filter.status = status.toUpperCase();

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const receipts = await req.models.GoodsReceipt.find(filter)
      .populate({
        path: 'purchase_order',
        select: 'po_id status order_date',
        populate: { path: 'supplier', select: 'name contact' }
      })
      .sort({ received_date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const receiptIds = receipts.map((r) => r._id);
    const items = await req.models.GoodsReceiptItem.find({ goods_receipt: { $in: receiptIds } })
      .populate({
        path: 'po_item',
        populate: { path: 'medicine', select: 'name dosage formulation medicine_id' }
      });

    const itemsMap = {};
    items.forEach((item) => {
      const rId = item.goods_receipt.toString();
      if (!itemsMap[rId]) itemsMap[rId] = [];
      itemsMap[rId].push(item);
    });

    const populatedReceipts = receipts.map((r) => ({
      ...r.toObject(),
      items: itemsMap[r._id.toString()] || []
    }));

    const total = await req.models.GoodsReceipt.countDocuments(filter);

    return ApiResponse.success(res, {
      goodsReceipts: populatedReceipts,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Goods receipts retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Receive Goods against Purchase Order and allocate into WarehouseStock
 * POST /api/warehouse/goods-receipts
 */
const createGoodsReceipt = async (req, res, next) => {
  try {
    const { purchase_order, receipt_id, items, notes } = req.body;

    if (!purchase_order) {
      throw ApiError.badRequest('purchase_order identifier is required.');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('items array is required with received lot details.');
    }

    // Resolve PO
    let poDoc = null;
    if (purchase_order.match(/^[0-9a-fA-F]{24}$/)) {
      poDoc = await req.models.PurchaseOrder.findById(purchase_order);
    }
    if (!poDoc) {
      poDoc = await req.models.PurchaseOrder.findOne({ po_id: purchase_order.toUpperCase() });
    }
    if (!poDoc) {
      throw ApiError.notFound(`Purchase order '${purchase_order}' not found.`);
    }

    const newReceiptId = receipt_id || `GR-${Date.now().toString().slice(-6)}`;

    // Create GoodsReceipt header
    const goodsReceipt = await req.models.GoodsReceipt.create({
      receipt_id: newReceiptId.toUpperCase(),
      purchase_order: poDoc._id,
      status: GOODS_RECEIPT_STATUS.ACCEPTED,
      notes
    });

    const createdGrItems = [];
    const createdBatches = [];
    const updatedStocks = [];

    for (let i = 0; i < items.length; i++) {
      const itm = items[i];

      // Resolve PO Item
      let poItemDoc = null;
      if (itm.po_item && itm.po_item.match(/^[0-9a-fA-F]{24}$/)) {
        poItemDoc = await req.models.PurchaseOrderItem.findById(itm.po_item);
      }
      if (!poItemDoc && itm.po_item) {
        poItemDoc = await req.models.PurchaseOrderItem.findOne({ po_item_id: itm.po_item.toUpperCase() });
      }
      if (!poItemDoc) {
        throw ApiError.notFound(`Purchase order item '${itm.po_item}' not found.`);
      }

      // Resolve Storage Location
      let locationDoc = null;
      if (itm.storage_location && itm.storage_location.match(/^[0-9a-fA-F]{24}$/)) {
        locationDoc = await req.models.StorageLocation.findById(itm.storage_location);
      }
      if (!locationDoc && itm.storage_location) {
        locationDoc = await req.models.StorageLocation.findOne({ location_id: itm.storage_location.toUpperCase() });
      }
      if (!locationDoc) {
        // Fallback to first available storage location
        locationDoc = await req.models.StorageLocation.findOne();
      }

      const qtyReceived = parseInt(itm.quantity_received, 10);
      if (isNaN(qtyReceived) || qtyReceived <= 0) {
        throw ApiError.badRequest(`Invalid quantity_received for item ${i + 1}. Must be > 0.`);
      }

      // 1. Create GoodsReceiptItem
      const grItem = await req.models.GoodsReceiptItem.create({
        gr_item_id: `GRI-${goodsReceipt.receipt_id}-${(i + 1).toString().padStart(2, '0')}`,
        goods_receipt: goodsReceipt._id,
        po_item: poItemDoc._id,
        quantity_received: qtyReceived
      });
      createdGrItems.push(grItem);

      // 2. Find or Create Batch
      const batchNumber = itm.batch_number || `BAT-${poItemDoc.medicine}-${Date.now().toString().slice(-4)}`;
      const mfgDate = itm.manufacturing_date ? new Date(itm.manufacturing_date) : new Date();
      const expDate = itm.expiry_date ? new Date(itm.expiry_date) : new Date(Date.now() + 730 * 24 * 60 * 60 * 1000); // +2 years default

      if (expDate <= mfgDate) {
        throw ApiError.badRequest(`Expiry date must be after manufacturing date for batch '${batchNumber}'.`);
      }

      let batch = await req.models.Batch.findOne({
        medicine: poItemDoc.medicine,
        batch_number: batchNumber.toUpperCase()
      });

      if (!batch) {
        batch = await req.models.Batch.create({
          batch_id: `BAT-ID-${Date.now().toString().slice(-6)}-${i + 1}`,
          medicine: poItemDoc.medicine,
          gr_item: grItem._id,
          batch_number: batchNumber.toUpperCase(),
          manufacturing_date: mfgDate,
          expiry_date: expDate
        });
      }
      createdBatches.push(batch);

      // 3. Create or Update WarehouseStock for this batch
      let stock = await req.models.WarehouseStock.findOne({ batch: batch._id });
      if (!stock) {
        stock = await req.models.WarehouseStock.create({
          stock_id: `STK-WH-${Date.now().toString().slice(-6)}-${i + 1}`,
          batch: batch._id,
          storage_location: locationDoc._id,
          quantity_on_hand: qtyReceived,
          quantity_reserved: 0,
          reorder_level: 50,
          stock_status: STOCK_STATUS.AVAILABLE
        });
      } else {
        stock.quantity_on_hand += qtyReceived;
        stock.stock_status = STOCK_STATUS.AVAILABLE;
        await stock.save();
      }
      updatedStocks.push(stock);

      // Record STOCK_IN in TransactionLedger (Append-only)
      await recordLedgerEntry(req.models, {
        txn_type: LEDGER_TXN_TYPES.STOCK_IN,
        medicine_id: poItemDoc.medicine,
        batch_id: batch._id,
        quantity_delta: qtyReceived,
        reference_type: 'GOODS_RECEIPT',
        reference_id: goodsReceipt.receipt_id,
        user_id: req.user ? req.user._id : null,
        notes: `Goods receipt ${goodsReceipt.receipt_id} from PO ${poDoc.po_id}`
      });
    }

    // Update PO status
    poDoc.status = PURCHASE_ORDER_STATUS.RECEIVED;
    await poDoc.save();

    // Audit Log
    if (req.user) {
      await req.models.AuditLog.create({
        log_id: `LOG-${Date.now()}`,
        user: req.user._id,
        table_name: 'goods_receipts',
        action: AUDIT_ACTIONS.RECEIVE_GOODS,
        details: { receipt_id: goodsReceipt.receipt_id, po_id: poDoc.po_id, receivedItems: items.length }
      });
    }

    return ApiResponse.created(res, {
      goodsReceipt: goodsReceipt.toObject(),
      receiptItems: createdGrItems,
      batches: createdBatches,
      stocks: updatedStocks
    }, 'Goods received and allocated into warehouse inventory successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllGoodsReceipts,
  createGoodsReceipt
};
