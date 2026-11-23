const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all warehouse staff users
 * GET /api/warehouse/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await req.models.User.find()
      .populate('role', 'role_id role_name')
      .sort({ name: 1 });

    return ApiResponse.success(res, users, 'Users retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Update user role or status
 * PUT /api/warehouse/users/:id
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role_id, isActive } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (role_id) {
      const role = await req.models.Role.findOne({ role_id: role_id.toUpperCase() });
      if (!role) throw ApiError.badRequest(`Role '${role_id}' does not exist.`);
      updateData.role = role._id;
    }

    const user = await req.models.User.findByIdAndUpdate(id, updateData, { new: true })
      .populate('role', 'role_id role_name');

    if (!user) {
      throw ApiError.notFound(`User not found with id: ${id}`);
    }

    return ApiResponse.success(res, user, 'User updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllUsers,
  updateUser
};
