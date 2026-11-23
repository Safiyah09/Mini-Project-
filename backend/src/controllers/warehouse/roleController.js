const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all warehouse roles
 * GET /api/warehouse/roles
 */
const getAllRoles = async (req, res, next) => {
  try {
    const roles = await req.models.Role.find().sort({ role_name: 1 });
    return ApiResponse.success(res, roles, 'Roles retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new warehouse role
 * POST /api/warehouse/roles
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
