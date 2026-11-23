const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { STOCK_TRANSFER_STATUS, LEDGER_TXN_TYPES } = require('../../utils/constants');

/**
 * 1. Warehouse Stock by Batch Report
 * GET /api/warehouse/reports/stock-by-batch
 */
const getStockByBatch = async (req, res, next) => {
  try {
    const { medicine_id, status } = req.query;
    const filter = {};
    if (status) filter.stock_status = status.toUpperCase();

    const stocks = await req.models.WarehouseStock.find(filter)
      .populate({
        path: 'batch',
        populate: { path: 'medicine', select: 'medicine_id name dosage formulation category manufacturer' }
      })
      .populate('storage_location', 'location_id zone rack_bin cold_storage')
      .sort({ 'batch.expiry_date': 1 });

    const now = new Date();
    const rows = stocks
      .filter((s) => {
        if (!s.batch) return false;
        if (medicine_id) {
          return s.batch.medicine && s.batch.medicine.medicine_id === medicine_id.toUpperCase();
        }
        return true;
      })
      .map((s) => {
        const availableQty = Math.max(0, s.quantity_on_hand - s.quantity_reserved);
        const isExpired = s.batch.expiry_date <= now;
        return {
          stock_id: s.stock_id,
          batch_id: s.batch.batch_id,
          batch_number: s.batch.batch_number,
          medicine: s.batch.medicine,
          storage_location: s.storage_location,
          quantity_on_hand: s.quantity_on_hand,
          quantity_reserved: s.quantity_reserved,
          available_quantity: availableQty,
          opening_balance: s.opening_balance || 0,
          stock_status: s.stock_status,
          manufacturing_date: s.batch.manufacturing_date,
          expiry_date: s.batch.expiry_date,
          is_expired: isExpired
        };
      });

    return ApiResponse.success(res, {
      count: rows.length,
      report: rows
    }, 'Warehouse stock by batch report generated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * 2. Transaction History by Date Range & Filters
 * GET /api/warehouse/reports/transaction-history
 * Query params: from_date, to_date, txn_type, medicine_id, batch_id
 */
const getTransactionHistory = async (req, res, next) => {
  try {
    const { from_date, to_date, txn_type, medicine_id, batch_id } = req.query;
    const filter = {};

    if (txn_type) {
      filter.txn_type = txn_type.toUpperCase();
    }
    if (medicine_id) {
      filter.medicine_id = medicine_id;
    }
    if (batch_id) {
      filter.batch_id = batch_id;
    }

    if (from_date || to_date) {
      filter.created_at = {};
      if (from_date) {
        filter.created_at.$gte = new Date(from_date);
      }
      if (to_date) {
        filter.created_at.$lte = new Date(to_date);
      }
    }

    const transactions = await req.models.TransactionLedger.find(filter)
      .populate('medicine_id', 'medicine_id name dosage formulation')
      .populate('batch_id', 'batch_id batch_number expiry_date')
      .populate('user_id', 'name username role')
      .sort({ created_at: -1 });

    // Compute summary totals
    const summary = {
      total_transactions: transactions.length,
      total_stock_in: 0,
      total_dispatch: 0,
      total_usable_returns: 0,
      total_damaged_returns: 0,
      total_damage: 0
    };

    transactions.forEach((tx) => {
      const delta = tx.quantity_delta;
      switch (tx.txn_type) {
        case LEDGER_TXN_TYPES.STOCK_IN:
        case LEDGER_TXN_TYPES.OPENING_BALANCE:
          summary.total_stock_in += delta;
          break;
        case LEDGER_TXN_TYPES.DISPATCH:
          summary.total_dispatch += Math.abs(delta);
          break;
        case LEDGER_TXN_TYPES.RETURN_USABLE:
          summary.total_usable_returns += delta;
          break;
        case LEDGER_TXN_TYPES.RETURN_DAMAGED:
          summary.total_damaged_returns += 1;
          break;
        case LEDGER_TXN_TYPES.DAMAGE:
          summary.total_damage += Math.abs(delta);
          break;
        default:
          break;
      }
    });

    return ApiResponse.success(res, {
      summary,
      transactions
    }, 'Warehouse transaction history retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * 3. Expiry Report (Expiring soon or Expired batches)
 * GET /api/warehouse/reports/expiry
 * Query params: days (default 60), expired (true/false)
 */
const getExpiryReport = async (req, res, next) => {
  try {
    const { days = 60, expired = 'false' } = req.query;
    const now = new Date();
    const thresholdDate = new Date(now.getTime() + parseInt(days, 10) * 24 * 60 * 60 * 1000);

    const batchFilter = { isActive: true };
    if (expired === 'true') {
      batchFilter.expiry_date = { $lte: now };
    } else {
      batchFilter.expiry_date = { $lte: thresholdDate };
    }

    const batches = await req.models.Batch.find(batchFilter)
      .populate('medicine', 'medicine_id name dosage formulation manufacturer')
      .sort({ expiry_date: 1 });

    const batchIds = batches.map((b) => b._id);
    const stocks = await req.models.WarehouseStock.find({ batch: { $in: batchIds } })
      .populate('storage_location', 'location_id zone rack_bin');

    const stockMap = new Map();
    stocks.forEach((s) => stockMap.set(s.batch.toString(), s));

    const report = batches.map((b) => {
      const s = stockMap.get(b._id.toString());
      const daysUntilExpiry = Math.ceil((b.expiry_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      let riskStatus = 'NORMAL';
      if (daysUntilExpiry <= 0) {
        riskStatus = 'EXPIRED';
      } else if (daysUntilExpiry <= 30) {
        riskStatus = 'CRITICAL';
      } else if (daysUntilExpiry <= 60) {
        riskStatus = 'EXPIRING_SOON';
      }

      return {
        batch_id: b.batch_id,
        batch_number: b.batch_number,
        medicine: b.medicine,
        manufacturing_date: b.manufacturing_date,
        expiry_date: b.expiry_date,
        days_until_expiry: daysUntilExpiry,
        risk_status: riskStatus,
        quantity_on_hand: s ? s.quantity_on_hand : 0,
        quantity_reserved: s ? s.quantity_reserved : 0,
        available_quantity: s ? Math.max(0, s.quantity_on_hand - s.quantity_reserved) : 0,
        storage_location: s ? s.storage_location : null
      };
    });

    return ApiResponse.success(res, {
      total_batches: report.length,
      critical_count: report.filter((r) => r.risk_status === 'CRITICAL' || r.risk_status === 'EXPIRED').length,
      report
    }, 'Warehouse expiry report generated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * 4. Dispatch per Pharmacy Report
 * GET /api/warehouse/reports/dispatch-per-pharmacy
 * Query params: pharmacy_id, from_date, to_date
 */
const getDispatchPerPharmacy = async (req, res, next) => {
  try {
    const { pharmacy_id, from_date, to_date } = req.query;

    const filter = { status: STOCK_TRANSFER_STATUS.DISPATCHED };
    if (pharmacy_id) {
      filter.pharmacy = pharmacy_id;
    }
    if (from_date || to_date) {
      filter.dispatch_date = {};
      if (from_date) filter.dispatch_date.$gte = new Date(from_date);
      if (to_date) filter.dispatch_date.$lte = new Date(to_date);
    }

    const transfers = await req.models.StockTransfer.find(filter)
      .populate('pharmacy', 'pharmacy_id name address contact')
      .sort({ dispatch_date: -1 });

    const transferIds = transfers.map((t) => t._id);
    const transferItems = await req.models.TransferItem.find({ stock_transfer: { $in: transferIds } })
      .populate({
        path: 'batch',
        populate: { path: 'medicine', select: 'medicine_id name dosage formulation' }
      });

    // Group items by transfer
    const itemsByTransfer = new Map();
    transferItems.forEach((itm) => {
      const trfId = itm.stock_transfer.toString();
      if (!itemsByTransfer.has(trfId)) {
        itemsByTransfer.set(trfId, []);
      }
      itemsByTransfer.get(trfId).push(itm);
    });

    // Group by pharmacy
    const pharmacyMap = new Map();

    transfers.forEach((trf) => {
      if (!trf.pharmacy) return;
      const pId = trf.pharmacy._id.toString();

      if (!pharmacyMap.has(pId)) {
        pharmacyMap.set(pId, {
          pharmacy_id: trf.pharmacy.pharmacy_id,
          name: trf.pharmacy.name,
          address: trf.pharmacy.address,
          total_dispatches: 0,
          total_units_dispatched: 0,
          transfers: []
        });
      }

      const pEntry = pharmacyMap.get(pId);
      pEntry.total_dispatches += 1;

      const items = itemsByTransfer.get(trf._id.toString()) || [];
      const trfUnits = items.reduce((sum, itm) => sum + (itm.quantity_dispatched || 0), 0);
      pEntry.total_units_dispatched += trfUnits;

      pEntry.transfers.push({
        transfer_id: trf.transfer_id,
        shipping_reference: trf.shipping_reference,
        dispatch_date: trf.dispatch_date || trf.updatedAt,
        items_count: items.length,
        total_units: trfUnits,
        items: items.map((itm) => ({
          transfer_item_id: itm.transfer_item_id,
          batch_number: itm.batch ? itm.batch.batch_number : null,
          medicine: itm.batch ? itm.batch.medicine : null,
          quantity_dispatched: itm.quantity_dispatched
        }))
      });
    });

    return ApiResponse.success(res, {
      total_pharmacies: pharmacyMap.size,
      pharmacies: Array.from(pharmacyMap.values())
    }, 'Dispatch per pharmacy report generated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStockByBatch,
  getTransactionHistory,
  getExpiryReport,
  getDispatchPerPharmacy
};
