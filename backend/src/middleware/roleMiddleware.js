const ApiError = require('../utils/ApiError');

/**
 * Restricts access to specific roles
 * @param  {...string} allowedRoles - e.g. 'WAREHOUSE_ADMIN', 'INVENTORY_MANAGER'
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(ApiError.unauthorized('User not authenticated or role not assigned.'));
    }

    const userRole = req.user.role.role_name;

    if (!allowedRoles.includes(userRole)) {
      return next(
        ApiError.forbidden(
          `Access forbidden: Role '${userRole}' is not authorized to access this resource. Allowed roles: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};

module.exports = {
  authorizeRoles
};
