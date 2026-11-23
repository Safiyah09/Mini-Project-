const ApiError = require('../utils/ApiError');
const env = require('../config/env');

/**
 * Global centralized error handling middleware
 * Standardized Response Schema:
 * {
 *   success: false,
 *   statusCode: Number,
 *   error_code: String,
 *   message: String,
 *   details: Array | Object
 * }
 * In production mode, stack traces are strictly stripped.
 */
const errorMiddleware = (err, req, res, next) => {
  let error = err;

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new ApiError(404, message, [], '', 'NOT_FOUND');
  }

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const value = err.keyValue ? err.keyValue[field] : '';
    const message = `Duplicate value '${value}' entered for field '${field}'. Must be unique.`;
    error = new ApiError(409, message, [], '', 'DUPLICATE_KEY_ERROR');
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((el) => ({
      field: el.path,
      message: el.message
    }));
    error = new ApiError(400, 'Validation Error', errors, '', 'VALIDATION_ERROR');
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Invalid authentication token', [], '', 'INVALID_TOKEN');
  }
  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Authentication token has expired', [], '', 'TOKEN_EXPIRED');
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const errorCode = error.errorCode || error.error_code || ApiError.getDefaultErrorCode(statusCode);
  const details = error.details || error.errors || [];

  const responsePayload = {
    success: false,
    statusCode,
    error_code: errorCode,
    message,
    details,
    errors: details // Preserved for backward compatibility
  };

  // Stack traces strictly stripped in production mode
  const isProduction = (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production');
  if (!isProduction && error.stack) {
    responsePayload.stack = error.stack;
  }

  return res.status(statusCode).json(responsePayload);
};

module.exports = errorMiddleware;
