const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all pharmacy batches
 * GET /api/pharmacy/batches
 */
const getAllBatches = async (req, res, next) => {
  try {
    const { search, medicine_id, expiryStatus, sort = 'expiry_date', order = 'asc', page = 1, limit = 50 } = req.query;
    const filter = { isActive: true };

    if (medicine_id) {
      filter.medicine = medicine_id;
    }

    const now = new Date();
    const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    if (expiryStatus === 'EXPIRED') {
      filter.expiry_date = { $lt: now };
    } else if (expiryStatus === 'NEAR_EXPIRY') {
      filter.expiry_date = { $gte: now, $lte: ninetyDays };
    } else if (expiryStatus === 'VALID') {
      filter.expiry_date = { $gt: ninetyDays };
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
      .populate('medicine', 'medicine_id name category dosage formulation manufacturer reorder_level')
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
    }, 'Pharmacy batches retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Add or register a batch manually in pharmacy
 * POST /api/pharmacy/batches
 */
const createBatch = async (req, res, next) => {
  try {
    const { medicine_id, batch_number, manufacturing_date, expiry_date, initial_quantity = 0 } = req.body;

    if (!medicine_id || !batch_number || !manufacturing_date || !expiry_date) {
      throw ApiError.badRequest('medicine_id, batch_number, manufacturing_date, and expiry_date are required.');
    }

    let medDoc = null;
    if (medicine_id.match(/^[0-9a-fA-F]{24}$/)) {
      medDoc = await req.models.Medicine.findById(medicine_id);
    }
    if (!medDoc) {
      medDoc = await req.models.Medicine.findOne({ medicine_id: medicine_id.toUpperCase() });
    }
    if (!medDoc) {
      throw ApiError.badRequest(`Medicine '${medicine_id}' not found in pharmacy formulary.`);
    }

    const batch_id = `PH-BAT-${Date.now().toString().slice(-6)}`;

    const batch = await req.models.Batch.create({
      batch_id,
      medicine: medDoc._id,
      batch_number: batch_number.toUpperCase().trim(),
      manufacturing_date: new Date(manufacturing_date),
      expiry_date: new Date(expiry_date)
    });

    // Also create or attach PharmacyStock entry
    let stock = await req.models.PharmacyStock.findOne({ batch: batch._id });
    if (!stock && initial_quantity >= 0) {
      stock = await req.models.PharmacyStock.create({
        stock_id: `PH-STK-${Date.now().toString().slice(-6)}`,
        batch: batch._id,
        quantity_on_hand: parseInt(initial_quantity, 10) || 0,
        stock_status: (parseInt(initial_quantity, 10) || 0) > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK'
      });
    }

    const populated = await req.models.Batch.findById(batch._id).populate('medicine');

    return ApiResponse.created(res, {
      batch: populated,
      stock
    }, 'Batch registered successfully in pharmacy');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllBatches,
  createBatch
};
