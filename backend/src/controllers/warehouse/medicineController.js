const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all medicines in warehouse catalog
 * GET /api/warehouse/medicines
 */
const getAllMedicines = async (req, res, next) => {
  try {
    const { search, category, manufacturer, page = 1, limit = 50 } = req.query;
    const filter = { isActive: true };

    if (category) filter.category = category;
    if (manufacturer) filter.manufacturer = manufacturer;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { medicine_id: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
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
 * Get medicine by ID or code
 * GET /api/warehouse/medicines/:id
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
      throw ApiError.notFound(`Medicine not found with identifier: ${id}`);
    }

    return ApiResponse.success(res, medicine, 'Medicine retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new medicine
 * POST /api/warehouse/medicines
 */
const createMedicine = async (req, res, next) => {
  try {
    const { medicine_id, name, manufacturer, category, dosage, formulation } = req.body;

    if (!name || !manufacturer || !category || !dosage || !formulation) {
      throw ApiError.badRequest('name, manufacturer, category, dosage, and formulation are required.');
    }

    const newId = medicine_id || `MED-${Date.now().toString().slice(-6)}`;

    const medicine = await req.models.Medicine.create({
      medicine_id: newId.toUpperCase(),
      name,
      manufacturer,
      category,
      dosage,
      formulation
    });

    return ApiResponse.created(res, medicine, 'Medicine created successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Update medicine
 * PUT /api/warehouse/medicines/:id
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
 * Delete / deactivate medicine
 * DELETE /api/warehouse/medicines/:id
 */
const deleteMedicine = async (req, res, next) => {
  try {
    const { id } = req.params;
    const medicine = await req.models.Medicine.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (!medicine) {
      throw ApiError.notFound(`Medicine not found with id: ${id}`);
    }

    return ApiResponse.success(res, null, 'Medicine deactivated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  deleteMedicine
};
