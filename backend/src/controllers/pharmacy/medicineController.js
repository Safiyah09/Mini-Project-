const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { allocateFEFO } = require('../../services/common/fefoMinHeap');

/**
 * Get all medicines in pharmacy catalog
 * GET /api/pharmacy/medicines
 */
const getAllMedicines = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 50 } = req.query;
    const filter = { isActive: true };

    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { medicine_id: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const medicines = await req.models.Medicine.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await req.models.Medicine.countDocuments(filter);

    return ApiResponse.success(res, {
      medicines,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Medicines retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get pharmacy medicine by ID
 * GET /api/pharmacy/medicines/:id
 */
const getMedicineById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let medicine = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      medicine = await req.models.Medicine.findById(id);
    }
    if (!medicine) {
      medicine = await req.models.Medicine.findOne({ medicine_id: id.toUpperCase() });
    }

    if (!medicine) {
      throw ApiError.notFound(`Medicine not found with id: ${id}`);
    }

    return ApiResponse.success(res, medicine, 'Medicine retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create or sync medicine in pharmacy catalog
 * POST /api/pharmacy/medicines
 */
const createMedicine = async (req, res, next) => {
  try {
    const { medicine_id, name, manufacturer, category, dosage, formulation, reorder_level } = req.body;

    if (!name || !manufacturer || !category || !dosage || !formulation) {
      throw ApiError.badRequest('name, manufacturer, category, dosage, and formulation are required.');
    }

    const newId = medicine_id || `MED-PH-${Date.now().toString().slice(-6)}`;

    const medicine = await req.models.Medicine.create({
      medicine_id: newId.toUpperCase(),
      name,
      manufacturer,
      category,
      dosage,
      formulation,
      reorder_level: reorder_level || 20
    });

    return ApiResponse.created(res, medicine, 'Medicine added to pharmacy catalog successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Update medicine in pharmacy catalog
 * PUT /api/pharmacy/medicines/:id
 */
const updateMedicine = async (req, res, next) => {
  try {
    const { id } = req.params;
    const medicine = await req.models.Medicine.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!medicine) {
      throw ApiError.notFound(`Medicine not found with id: ${id}`);
    }

    return ApiResponse.success(res, medicine, 'Medicine updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Check pharmacy stock availability for a medicine using FEFO priority allocation
 * Evaluates whether branch pharmacy inventory can fulfill requested quantity: FULL, PARTIAL, or NONE
 * Excludes expired batches strictly.
 * GET /api/pharmacy/medicines/:id/availability?quantity=...
 */
const checkStockAvailability = async (req, res, next) => {
  try {
    const medicineIdentifier = req.params.id || req.params.medicineId || req.query.medicine_id || req.query.medicine;
    if (!medicineIdentifier) {
      throw ApiError.badRequest('Medicine identifier is required');
    }

    const rawQty = req.query.quantity !== undefined ? req.query.quantity : (req.query.qty !== undefined ? req.query.qty : 1);
    const requestedQuantity = parseInt(rawQty, 10);
    if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
      throw ApiError.badRequest('Requested quantity must be a positive integer');
    }

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

    const batches = await req.models.Batch.find({
      medicine: medDoc._id,
      isActive: true
    });

    const batchIds = batches.map(b => b._id);
    const stocks = await req.models.PharmacyStock.find({
      batch: { $in: batchIds }
    });

    const stockMap = {};
    stocks.forEach(s => {
      stockMap[s.batch.toString()] = s;
    });

    const candidateBatches = batches.map(b => {
      const stock = stockMap[b._id.toString()];
      const availableQty = stock ? Math.max(0, stock.quantity_on_hand) : 0;
      return {
        _id: b._id,
        batch_id: b.batch_id,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date,
        manufacturing_date: b.manufacturing_date,
        received_date: b.createdAt || (stock ? stock.createdAt : null),
        available_quantity: availableQty,
        quantity_on_hand: stock ? stock.quantity_on_hand : 0
      };
    });

    const allocation = allocateFEFO(candidateBatches, requestedQuantity);

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
      status: allocation.status,
      requested_quantity: requestedQuantity,
      available_quantity: allocation.total_unexpired_available,
      unfulfilled_quantity: allocation.unfulfilled_quantity,
      batches: batchesOutput,
      eligible_batches_count: allocation.eligible_batches_count,
      expired_batches_count: allocation.expired_batches_count
    }, `Pharmacy stock availability evaluated: ${allocation.status}`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  checkStockAvailability
};
