const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { generateToken } = require('../../utils/generateToken');

/**
 * Register a new Warehouse user
 * POST /api/warehouse/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { User, Role } = req.models;
    const { user_id, name, username, password, email, role_id, role_name } = req.body;

    if (!name || !username || !password) {
      throw ApiError.badRequest('Name, username, and password are required.');
    }

    // Check if username already exists
    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      throw ApiError.conflict(`Username '${username}' is already in use.`);
    }

    // Find role by role_id or role_name
    let roleDoc;
    if (role_id) {
      roleDoc = await Role.findOne({ role_id: role_id.toUpperCase() });
    } else if (role_name) {
      roleDoc = await Role.findOne({ role_name: role_name.toUpperCase() });
    } else {
      // Default fallback to WAREHOUSE_ADMIN if no role specified and no users exist, or INVENTORY_MANAGER
      roleDoc = await Role.findOne({ role_name: 'WAREHOUSE_ADMIN' });
    }

    if (!roleDoc) {
      throw ApiError.badRequest('Specified role does not exist. Please create or assign a valid role.');
    }

    const newUserId = user_id || `WH-USR-${Date.now().toString().slice(-6)}`;

    const user = await User.create({
      user_id: newUserId,
      name,
      username: username.toLowerCase(),
      password,
      email,
      role: roleDoc._id
    });

    const populatedUser = await User.findById(user._id).populate('role', 'role_id role_name');

    const token = generateToken({
      id: user._id,
      user_id: user.user_id,
      username: user.username,
      role: roleDoc.role_name,
      systemType: 'WAREHOUSE'
    });

    return ApiResponse.created(res, {
      user: {
        id: populatedUser._id,
        user_id: populatedUser.user_id,
        name: populatedUser.name,
        username: populatedUser.username,
        email: populatedUser.email,
        role: populatedUser.role
      },
      token
    }, 'Warehouse user registered successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Login Warehouse user
 * POST /api/warehouse/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { User } = req.models;
    const { username, password } = req.body;

    if (!username || !password) {
      throw ApiError.badRequest('Username and password are required.');
    }

    // Must explicitly select password since schema has select: false
    const user = await User.findOne({ username: username.toLowerCase() })
      .select('+password')
      .populate('role', 'role_id role_name');

    if (!user) {
      throw ApiError.unauthorized('Invalid username or password.');
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Account is deactivated. Contact warehouse administrator.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid username or password.');
    }

    const token = generateToken({
      id: user._id,
      user_id: user.user_id,
      username: user.username,
      role: user.role ? user.role.role_name : 'STAFF',
      systemType: 'WAREHOUSE'
    });

    return ApiResponse.success(res, {
      user: {
        id: user._id,
        user_id: user.user_id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

/**
 * Get current authenticated warehouse user profile
 * GET /api/warehouse/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    return ApiResponse.success(res, {
      user: req.user
    }, 'Profile retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe
};
