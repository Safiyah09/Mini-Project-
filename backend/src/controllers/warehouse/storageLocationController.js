const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all warehouse storage locations
 * GET /api/warehouse/locations
 */
const getAllLocations = async (req, res, next) => {
  try {
    const { zone, cold_storage } = req.query;
    const filter = {};

    if (zone) filter.zone = zone;
    if (cold_storage !== undefined) filter.cold_storage = cold_storage === 'true';

    const locations = await req.models.StorageLocation.find(filter).sort({ zone: 1, rack_bin: 1 });
    return ApiResponse.success(res, locations, 'Storage locations retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new storage location
 * POST /api/warehouse/locations
 */
const createLocation = async (req, res, next) => {
  try {
    const { location_id, zone, rack_bin, cold_storage, description } = req.body;

    if (!zone || !rack_bin) {
      throw ApiError.badRequest('zone and rack_bin are required.');
    }

    const newId = location_id || `LOC-${zone}-${rack_bin.replace(/[^a-zA-Z0-9]/g, '')}`.toUpperCase();

    const location = await req.models.StorageLocation.create({
      location_id: newId,
      zone,
      rack_bin,
      cold_storage: cold_storage === true || cold_storage === 'true',
      description
    });

    return ApiResponse.created(res, location, 'Storage location created successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Update storage location
 * PUT /api/warehouse/locations/:id
 */
const updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const location = await req.models.StorageLocation.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!location) {
      throw ApiError.notFound(`Storage location not found with id: ${id}`);
    }

    return ApiResponse.success(res, location, 'Storage location updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllLocations,
  createLocation,
  updateLocation
};
