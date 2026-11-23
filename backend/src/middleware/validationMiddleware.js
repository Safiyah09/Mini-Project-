const ApiError = require('../utils/ApiError');

/**
 * Higher-order middleware to run validator schemas
 */
const validate = (validatorFn) => {
  return (req, res, next) => {
    try {
      const error = validatorFn(req.body, req.query, req.params);
      if (error) {
        throw ApiError.badRequest(error);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  validate
};
