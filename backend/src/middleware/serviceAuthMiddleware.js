const ApiError = require('../utils/ApiError');
const { SERVICE_CONFIG } = require('../utils/constants');
const { verifyToken } = require('../utils/generateToken');

/**
 * Service-to-Service Authentication Middleware
 * Validates either an API key header (`x-service-token` or `x-api-key`)
 * or a signed service JWT token.
 * Rejects missing or invalid credentials with HTTP 401 Unauthorized.
 */
const requireServiceAuth = (req, res, next) => {
  const serviceToken = req.headers['x-service-token'] || req.headers['x-api-key'];
  const authHeader = req.headers.authorization;

  // 1. Check API Key in headers
  if (serviceToken) {
    if (serviceToken === SERVICE_CONFIG.DEFAULT_SERVICE_KEY) {
      req.isServiceCall = true;
      req.serviceSource = 'PHARMACY_BRIDGE';
      return next();
    } else {
      return next(ApiError.unauthorized('Invalid service token. Service access denied.'));
    }
  }

  // 2. Check Bearer Service Token in Authorization header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyToken(token);
      if (decoded.systemType === 'SERVICE' || decoded.systemType === 'PHARMACY' || decoded.systemType === 'WAREHOUSE') {
        req.isServiceCall = true;
        req.serviceSource = decoded.systemType;
        req.serviceUser = decoded;
        return next();
      }
      return next(ApiError.unauthorized('Invalid service token type.'));
    } catch (err) {
      return next(ApiError.unauthorized('Invalid or expired service authentication token.'));
    }
  }

  // 3. Neither valid key nor token provided
  return next(ApiError.unauthorized('Access denied. Missing service authentication token (x-service-token or Bearer token).'));
};

module.exports = {
  requireServiceAuth
};
