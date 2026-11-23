const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all suppliers with optional search and pagination
 * GET /api/warehouse/suppliers
 */
const getAllSuppliers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50, isActive } = req.query;
    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { supplier_id: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const suppliers = await req.models.Supplier.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await req.models.Supplier.countDocuments(filter);

    return ApiResponse.success(res, {
      suppliers,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Suppliers retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get supplier by ID
 * GET /api/warehouse/suppliers/:id
 */
const getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let supplier = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      supplier = await req.models.Supplier.findById(id);
    }
    if (!supplier) {
      supplier = await req.models.Supplier.findOne({ supplier_id: id.toUpperCase() });
    }

    if (!supplier) {
      throw ApiError.notFound(`Supplier not found with identifier: ${id}`);
    }

    return ApiResponse.success(res, supplier, 'Supplier retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new supplier
 * POST /api/warehouse/suppliers
 */
const createSupplier = async (req, res, next) => {
  try {
    const { supplier_id, name, address, contact } = req.body;

    if (!name || !address || !contact) {
      throw ApiError.badRequest('name, address, and contact are required fields.');
    }

    const newId = supplier_id || `SUP-${Date.now().toString().slice(-6)}`;

    const supplier = await req.models.Supplier.create({
      supplier_id: newId.toUpperCase(),
      name,
      address,
      contact
    });

    return ApiResponse.created(res, supplier, 'Supplier created successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing supplier
 * PUT /api/warehouse/suppliers/:id
 */
const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const supplier = await req.models.Supplier.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });

    if (!supplier) {
      throw ApiError.notFound(`Supplier not found with id: ${id}`);
    }

    return ApiResponse.success(res, supplier, 'Supplier updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Delete / deactivate a supplier
 * DELETE /api/warehouse/suppliers/:id
 */
const deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const supplier = await req.models.Supplier.findByIdAndDelete(id);

    if (!supplier) {
      throw ApiError.notFound(`Supplier not found with id: ${id}`);
    }

    return ApiResponse.success(res, null, 'Supplier deleted successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier
};
