/**
 * Standardized API Error class for Pharmaceutical Management System
 */
class ApiError extends Error {
  constructor(statusCode, message = 'Something went wrong', errors = [], stack = '', errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.details = Array.isArray(errors) ? errors : (errors ? [errors] : []);
    this.error_code = errorCode || ApiError.getDefaultErrorCode(statusCode);
    this.errorCode = this.error_code;
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static getDefaultErrorCode(statusCode) {
    switch (statusCode) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 422: return 'UNPROCESSABLE_ENTITY';
      default: return 'INTERNAL_SERVER_ERROR';
    }
  }

  static badRequest(message, errors = [], errorCode = 'BAD_REQUEST') {
    return new ApiError(400, message, errors, '', errorCode);
  }

  static insufficientStock(message = 'Insufficient stock on hand to fulfill request', details = []) {
    return new ApiError(400, message, details, '', 'INSUFFICIENT_STOCK');
  }

  static expiredBatch(message = 'Cannot dispense or dispatch expired medicine batch', details = []) {
    return new ApiError(400, message, details, '', 'EXPIRED_BATCH');
  }

  static idempotencyMismatch(message = 'Idempotency key reused with a different request payload', details = []) {
    return new ApiError(422, message, details, '', 'IDEMPOTENCY_PAYLOAD_MISMATCH');
  }

  static invalidTransition(message = 'Invalid status transition', details = []) {
    return new ApiError(409, message, details, '', 'INVALID_STATUS_TRANSITION');
  }

  static unauthorized(message = 'Unauthorized request', errorCode = 'UNAUTHORIZED') {
    return new ApiError(401, message, [], '', errorCode);
  }

  static forbidden(message = 'Forbidden resource', errorCode = 'FORBIDDEN') {
    return new ApiError(403, message, [], '', errorCode);
  }

  static notFound(message = 'Resource not found', errorCode = 'NOT_FOUND') {
    return new ApiError(404, message, [], '', errorCode);
  }

  static conflict(message = 'Resource conflict or invalid state', errors = [], errorCode = 'CONFLICT') {
    return new ApiError(409, message, errors, '', errorCode);
  }

  static unprocessable(message = 'Unprocessable entity', errors = [], errorCode = 'UNPROCESSABLE_ENTITY') {
    return new ApiError(422, message, errors, '', errorCode);
  }

  static internal(message = 'Internal server error', errorCode = 'INTERNAL_SERVER_ERROR') {
    return new ApiError(500, message, [], '', errorCode);
  }
}

module.exports = ApiError;
