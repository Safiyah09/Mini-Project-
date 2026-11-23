const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all registered pharmacies
 * GET /api/warehouse/pharmacies
 */
const getAllPharmacies = async (req, res, next) => {
  try {
    const { search } = req.query;
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { pharmacy_id: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } }
      ];
    }

    const pharmacies = await req.models.Pharmacy.find(filter).sort({ name: 1 });
    return ApiResponse.success(res, pharmacies, 'Pharmacies retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get pharmacy by ID
 * GET /api/warehouse/pharmacies/:id
 */
const getPharmacyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let pharmacy = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      pharmacy = await req.models.Pharmacy.findById(id);
    }
    if (!pharmacy) {
      pharmacy = await req.models.Pharmacy.findOne({ pharmacy_id: id.toUpperCase() });
    }

    if (!pharmacy) {
      throw ApiError.notFound(`Pharmacy not found with id: ${id}`);
    }

    return ApiResponse.success(res, pharmacy, 'Pharmacy retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Register a new pharmacy in warehouse system
 * POST /api/warehouse/pharmacies
 */
const createPharmacy = async (req, res, next) => {
  try {
    const { pharmacy_id, name, address, contact, connection_details } = req.body;

    if (!name || !address || !contact) {
      throw ApiError.badRequest('name, address, and contact are required.');
    }

    const newId = pharmacy_id || `PHARM-${Date.now().toString().slice(-6)}`;

    const pharmacy = await req.models.Pharmacy.create({
      pharmacy_id: newId.toUpperCase(),
      name,
      address,
      contact,
      connection_details: connection_details || { db_name: 'pharmacy' }
    });

    return ApiResponse.created(res, pharmacy, 'Pharmacy registered successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Update pharmacy information
 * PUT /api/warehouse/pharmacies/:id
 */
const updatePharmacy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pharmacy = await req.models.Pharmacy.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!pharmacy) {
      throw ApiError.notFound(`Pharmacy not found with id: ${id}`);
    }

    return ApiResponse.success(res, pharmacy, 'Pharmacy updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllPharmacies,
  getPharmacyById,
  createPharmacy,
  updatePharmacy
};
