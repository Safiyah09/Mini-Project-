const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all pharmacy roles
 * GET /api/pharmacy/roles
 */
const getAllRoles = async (req, res, next) => {
  try {
    const roles = await req.models.Role.find().sort({ role_name: 1 });
    return ApiResponse.success(res, roles, 'Pharmacy roles retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new pharmacy role
 * POST /api/pharmacy/roles
 */
const createRole = async (req, res, next) => {
  try {
    const { role_id, role_name, description } = req.body;
    if (!role_id || !role_name) {
      throw ApiError.badRequest('role_id and role_name are required.');
    }

    const role = await req.models.Role.create({
      role_id: role_id.toUpperCase(),
      role_name: role_name.toUpperCase(),
      description
    });

    return ApiResponse.created(res, role, 'Role created successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllRoles,
  createRole
};
