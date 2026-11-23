const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { STOCK_STATUS } = require('../../utils/constants');
const ledgerService = require('../../services/warehouse/ledgerService');
const { allocateFEFO } = require('../../services/common/fefoMinHeap');

/**
 * Get all warehouse stock inventory with batch & location details
 * GET /api/warehouse/stocks
 */
const getInventory = async (req, res, next) => {
  try {
    const { status, medicine_id, location_id, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status) filter.stock_status = status.toUpperCase();
    if (location_id) filter.storage_location = location_id;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    let stocks = await req.models.WarehouseStock.find(filter)
      .populate({
        path: 'batch',
        populate: { path: 'medicine', select: 'medicine_id name dosage formulation category manufacturer' }
      })
      .populate('storage_location', 'location_id zone rack_bin cold_storage')
      .skip(skip)
      .limit(parseInt(limit, 10));

    // Optional filter by medicine_id
    if (medicine_id) {
      stocks = stocks.filter((s) => s.batch && s.batch.medicine && s.batch.medicine.medicine_id === medicine_id.toUpperCase());
    }

    const total = await req.models.WarehouseStock.countDocuments(filter);

    return ApiResponse.success(res, {
      stocks,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Warehouse inventory retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Query available batches for a medicine using FEFO (First-Expired, First-Out)
 * GET /api/warehouse/stocks/fefo/:medicineId
 */
const getFefoBatches = async (req, res, next) => {
  try {
    const { medicineId } = req.params;
    const now = new Date();

    // 1. Resolve medicine
    let medDoc = null;
    if (medicineId.match(/^[0-9a-fA-F]{24}$/)) {
      medDoc = await req.models.Medicine.findById(medicineId);
    }
    if (!medDoc) {
      medDoc = await req.models.Medicine.findOne({ medicine_id: medicineId.toUpperCase() });
    }
    if (!medDoc) {
      throw ApiError.notFound(`Medicine '${medicineId}' not found.`);
    }

    // 2. Query batches for this medicine that are not expired, sorted by expiry_date ASC
    const batches = await req.models.Batch.find({
      medicine: medDoc._id,
      expiry_date: { $gt: now },
      isActive: true
    }).sort({ expiry_date: 1 });

    const batchIds = batches.map((b) => b._id);

    // 3. Find stocks for these batches with available quantity > 0
    const stocks = await req.models.WarehouseStock.find({
      batch: { $in: batchIds },
      quantity_on_hand: { $gt: 0 }
    })
      .populate('batch')
      .populate('storage_location', 'zone rack_bin');

    // Order stocks strictly according to FEFO batch order
    const fefoAllocations = [];
    for (const b of batches) {
      const stock = stocks.find((s) => s.batch._id.toString() === b._id.toString());
      if (stock) {
        const availableQty = stock.quantity_on_hand - stock.quantity_reserved;
        if (availableQty > 0) {
          fefoAllocations.push({
            batch_id: b.batch_id,
            batch_number: b.batch_number,
            expiry_date: b.expiry_date,
            manufacturing_date: b.manufacturing_date,
            quantity_on_hand: stock.quantity_on_hand,
            quantity_reserved: stock.quantity_reserved,
            available_quantity: availableQty,
            storage_location: stock.storage_location,
            stock_id: stock.stock_id,
            _batchObjectId: b._id,
            _stockObjectId: stock._id
          });
        }
      }
    }

    return ApiResponse.success(res, {
      medicine: {
        id: medDoc._id,
        medicine_id: medDoc.medicine_id,
        name: medDoc.name,
        dosage: medDoc.dosage,
        formulation: medDoc.formulation
      },
      fefoBatches: fefoAllocations
    }, 'FEFO batches retrieved successfully (ordered by earliest expiry)');
  } catch (err) {
    next(err);
  }
};

/**
 * Reconcile stored warehouse batch stock against append-only ledger
 * Formula: derived = opening + stock_in + usable_returns - dispatch - damage
 * GET /api/warehouse/stocks/reconcile
 * Query params: ?batch_id=... or ?batch=...
 */
const reconcileStock = async (req, res, next) => {
  try {
    const { batch_id, batch } = req.query;
    const targetBatch = batch_id || batch;

    if (targetBatch) {
      let batchDoc = null;
      if (targetBatch.match(/^[0-9a-fA-F]{24}$/)) {
        batchDoc = await req.models.Batch.findById(targetBatch);
      }
      if (!batchDoc) {
        batchDoc = await req.models.Batch.findOne({
          $or: [{ batch_id: targetBatch.toUpperCase() }, { batch_number: targetBatch.toUpperCase() }]
        });
      }
      if (!batchDoc) {
        throw ApiError.notFound(`Batch '${targetBatch}' not found.`);
      }

      const result = await ledgerService.reconcileBatchStock(req.models, batchDoc._id);
      return ApiResponse.success(res, result, 'Batch stock reconciliation completed');
    }

    const results = await ledgerService.reconcileAllStocks(req.models);
    return ApiResponse.success(res, results, 'Warehouse stock reconciliation completed');
  } catch (err) {
    next(err);
  }
};

/**
 * Check stock availability for a medicine using FEFO priority allocation
 * Evaluates whether inventory can fulfill requested quantity: FULL, PARTIAL, or NONE
 * Excludes expired batches strictly.
 * GET /api/warehouse/stocks/availability/:medicineId
 * GET /api/warehouse/stocks/availability?medicine_id=...&quantity=...
 */
const checkStockAvailability = async (req, res, next) => {
  try {
    const medicineIdentifier = req.params.medicineId || req.query.medicine_id || req.query.medicine;
    if (!medicineIdentifier) {
      throw ApiError.badRequest('Medicine identifier is required (:medicineId param or ?medicine_id query)');
    }

    const rawQty = req.query.quantity !== undefined ? req.query.quantity : (req.query.qty !== undefined ? req.query.qty : 1);
    const requestedQuantity = parseInt(rawQty, 10);
    if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
      throw ApiError.badRequest('Requested quantity must be a positive integer');
    }

    // 1. Resolve medicine
    let medDoc = null;
    if (medicineIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
      medDoc = await req.models.Medicine.findById(medicineIdentifier);
    }
    if (!medDoc) {
      medDoc = await req.models.Medicine.findOne({ medicine_id: medicineIdentifier.toUpperCase() });
    }
    if (!medDoc) {
      throw ApiError.notFound(`Medicine '${medicineIdentifier}' not found.`);
    }

    // 2. Fetch all batches for this medicine
    const batches = await req.models.Batch.find({
      medicine: medDoc._id,
      isActive: true
    });

    const batchIds = batches.map(b => b._id);

    // 3. Fetch warehouse stock records
    const stocks = await req.models.WarehouseStock.find({
      batch: { $in: batchIds }
    }).populate('storage_location');

    const stockMap = {};
    stocks.forEach(s => {
      stockMap[s.batch.toString()] = s;
    });

    // 4. Build candidate batch list with available quantity
    const candidateBatches = batches.map(b => {
      const stock = stockMap[b._id.toString()];
      const availableQty = stock ? Math.max(0, stock.quantity_on_hand - stock.quantity_reserved) : 0;
      return {
        _id: b._id,
        batch_id: b.batch_id,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date,
        manufacturing_date: b.manufacturing_date,
        received_date: b.createdAt || (stock ? stock.createdAt : null),
        available_quantity: availableQty,
        quantity_on_hand: stock ? stock.quantity_on_hand : 0,
        quantity_reserved: stock ? stock.quantity_reserved : 0,
        storage_location: stock ? stock.storage_location : null
      };
    });

    // 5. Run FEFO allocation via Min-Heap engine
    const allocation = allocateFEFO(candidateBatches, requestedQuantity);

    // Format batches matching requirement: [{batch_id, batch_number, expiry_date, qty}]
    const batchesOutput = allocation.allocations.map(a => ({
      batch_id: a.batch_id,
      batch_number: a.batch_number,
      expiry_date: a.expiry_date,
      qty: a.allocated_quantity,
      available_qty: a.available_quantity
    }));

    return ApiResponse.success(res, {
      medicine_id: medDoc.medicine_id,
      medicine_name: medDoc.name,
      medicine_doc_id: medDoc._id,
      status: allocation.status, // "FULL" | "PARTIAL" | "NONE"
      requested_quantity: requestedQuantity,
      available_quantity: allocation.total_unexpired_available,
      unfulfilled_quantity: allocation.unfulfilled_quantity,
      batches: batchesOutput,
      eligible_batches_count: allocation.eligible_batches_count,
      expired_batches_count: allocation.expired_batches_count
    }, `Stock availability evaluated: ${allocation.status}`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getInventory,
  getFefoBatches,
  reconcileStock,
  checkStockAvailability
};
