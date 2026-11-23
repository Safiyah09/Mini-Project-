const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all warehouse batches with populated medicine
 * GET /api/warehouse/batches
 */
const getAllBatches = async (req, res, next) => {
  try {
    const { search, medicine_id, expiryStatus, sort = 'expiry_date', order = 'asc', page = 1, limit = 50 } = req.query;
    const filter = { isActive: true };

    if (medicine_id) {
      filter.medicine = medicine_id;
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    if (expiryStatus === 'EXPIRED') {
      filter.expiry_date = { $lt: now };
    } else if (expiryStatus === 'NEAR_EXPIRY') {
      filter.expiry_date = { $gte: now, $lte: ninetyDaysFromNow };
    } else if (expiryStatus === 'VALID') {
      filter.expiry_date = { $gt: ninetyDaysFromNow };
    }

    if (search) {
      filter.$or = [
        { batch_number: { $regex: search, $options: 'i' } },
        { batch_id: { $regex: search, $options: 'i' } }
      ];
    }

    const sortObj = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const batches = await req.models.Batch.find(filter)
      .populate('medicine', 'medicine_id name category dosage formulation manufacturer')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await req.models.Batch.countDocuments(filter);

    return ApiResponse.success(res, {
      batches,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Batches retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get batch by ID or batch_number
 * GET /api/warehouse/batches/:id
 */
const getBatchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let batch = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      batch = await req.models.Batch.findById(id).populate('medicine');
    }
    if (!batch) {
      batch = await req.models.Batch.findOne({ batch_number: id.toUpperCase() }).populate('medicine');
    }

    if (!batch) {
      throw ApiError.notFound(`Batch not found with identifier: ${id}`);
    }

    return ApiResponse.success(res, batch, 'Batch retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new batch
 * POST /api/warehouse/batches
 */
const createBatch = async (req, res, next) => {
  try {
    const { medicine_id, batch_number, manufacturing_date, expiry_date } = req.body;

    if (!medicine_id || !batch_number || !manufacturing_date || !expiry_date) {
      throw ApiError.badRequest('medicine_id, batch_number, manufacturing_date, and expiry_date are required.');
    }

    // Resolve medicine
    let medDoc = null;
    if (medicine_id.match(/^[0-9a-fA-F]{24}$/)) {
      medDoc = await req.models.Medicine.findById(medicine_id);
    }
    if (!medDoc) {
      medDoc = await req.models.Medicine.findOne({ medicine_id: medicine_id.toUpperCase() });
    }
    if (!medDoc) {
      throw ApiError.badRequest(`Medicine '${medicine_id}' not found.`);
    }

    const batch_id = `BAT-${Date.now().toString().slice(-6)}`;

    const batch = await req.models.Batch.create({
      batch_id,
      medicine: medDoc._id,
      batch_number: batch_number.toUpperCase().trim(),
      manufacturing_date: new Date(manufacturing_date),
      expiry_date: new Date(expiry_date)
    });

    const populated = await req.models.Batch.findById(batch._id).populate('medicine');

    return ApiResponse.created(res, populated, 'Batch created successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Update batch details
 * PUT /api/warehouse/batches/:id
 */
const updateBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { manufacturing_date, expiry_date, isActive } = req.body;

    const updateData = {};
    if (manufacturing_date) updateData.manufacturing_date = new Date(manufacturing_date);
    if (expiry_date) updateData.expiry_date = new Date(expiry_date);
    if (isActive !== undefined) updateData.isActive = isActive;

    const batch = await req.models.Batch.findByIdAndUpdate(id, updateData, { new: true })
      .populate('medicine');

    if (!batch) {
      throw ApiError.notFound(`Batch not found with id: ${id}`);
    }

    return ApiResponse.success(res, batch, 'Batch updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch
};
