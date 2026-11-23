const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Generates signed JWT authentication token
 * @param {Object} payload - { userId, username, role, systemType: 'WAREHOUSE' | 'PHARMACY', pharmacyId? }
 * @returns {string}
 */
const generateToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  });
};

/**
 * Verifies JWT token
 * @param {string} token
 * @returns {Object} decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

module.exports = {
  generateToken,
  verifyToken
};
