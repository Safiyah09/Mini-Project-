const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { generateToken } = require('../../utils/generateToken');

/**
 * Register a new Pharmacy staff user
 * POST /api/pharmacy/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { User, Role } = req.models;
    const { user_id, name, username, password, email, role_id, role_name } = req.body;

    if (!name || !username || !password) {
      throw ApiError.badRequest('Name, username, and password are required.');
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      throw ApiError.conflict(`Username '${username}' is already in use at this pharmacy.`);
    }

    let roleDoc;
    if (role_id) {
      roleDoc = await Role.findOne({ role_id: role_id.toUpperCase() });
    } else if (role_name) {
      roleDoc = await Role.findOne({ role_name: role_name.toUpperCase() });
    } else {
      roleDoc = await Role.findOne({ role_name: 'PHARMACY_ADMIN' });
    }

    if (!roleDoc) {
      throw ApiError.badRequest('Specified role does not exist. Please create or assign a valid role.');
    }

    const newUserId = user_id || `PH-USR-${Date.now().toString().slice(-6)}`;

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
      systemType: 'PHARMACY',
      pharmacyId: req.pharmacyId
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
    }, 'Pharmacy user registered successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Login Pharmacy user
 * POST /api/pharmacy/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { User } = req.models;
    const { username, password } = req.body;

    if (!username || !password) {
      throw ApiError.badRequest('Username and password are required.');
    }

    const user = await User.findOne({ username: username.toLowerCase() })
      .select('+password')
      .populate('role', 'role_id role_name');

    if (!user) {
      throw ApiError.unauthorized('Invalid username or password.');
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Account is deactivated. Contact pharmacy administrator.');
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
      systemType: 'PHARMACY',
      pharmacyId: req.pharmacyId
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
 * Get current authenticated pharmacy user profile
 * GET /api/pharmacy/auth/me
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
