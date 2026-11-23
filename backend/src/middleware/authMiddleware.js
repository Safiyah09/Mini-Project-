const { verifyToken } = require('../utils/generateToken');
const ApiError = require('../utils/ApiError');
const { getWarehouseConnection } = require('../config/warehouseDatabase');
const { getWarehouseModels } = require('../models/warehouse');
const { getPharmacyConnection } = require('../config/pharmacyDatabase');
const { getPharmacyModels } = require('../models/pharmacy');

/**
 * Context middleware: Injects Warehouse database connection & models into req
 */
const warehouseContext = async (req, res, next) => {
  try {
    const conn = await getWarehouseConnection();
    req.warehouseConn = conn;
    req.db = conn;
    req.models = getWarehouseModels(conn);
    next();
  } catch (err) {
    next(ApiError.internal(`Failed to attach Warehouse database context: ${err.message}`));
  }
};

/**
 * Context middleware: Injects Pharmacy database connection & models into req (supports multi-tenancy)
 */
const pharmacyContext = async (req, res, next) => {
  try {
    const pharmacyId = req.headers['x-pharmacy-id'] || req.query.pharmacyId || 'pharmacy';
    const conn = await getPharmacyConnection(pharmacyId);
    req.pharmacyConn = conn;
    req.db = conn;
    req.models = getPharmacyModels(conn);
    req.pharmacyId = pharmacyId;
    next();
  } catch (err) {
    next(ApiError.internal(`Failed to attach Pharmacy database context: ${err.message}`));
  }
};

/**
 * Extracts and verifies JWT from Bearer Authorization header
 */
const extractAndVerifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access denied. No authentication token provided.');
  }

  const token = authHeader.split(' ')[1];
  try {
    return verifyToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired authentication token.');
  }
};

/**
 * Authenticates Warehouse staff users
 */
const authenticateWarehouse = async (req, res, next) => {
  try {
    const decoded = extractAndVerifyToken(req);

    if (decoded.systemType !== 'WAREHOUSE') {
      throw ApiError.forbidden('Forbidden. Token is not authorized for Warehouse system.');
    }

    // Attach warehouse models if not already attached
    if (!req.models) {
      const conn = await getWarehouseConnection();
      req.warehouseConn = conn;
      req.db = conn;
      req.models = getWarehouseModels(conn);
    }

    const user = await req.models.User.findById(decoded.id).populate('role');
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or account is deactivated.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Authenticates Pharmacy staff users
 */
const authenticatePharmacy = async (req, res, next) => {
  try {
    const decoded = extractAndVerifyToken(req);

    if (decoded.systemType !== 'PHARMACY') {
      throw ApiError.forbidden('Forbidden. Token is not authorized for Pharmacy system.');
    }

    const tokenPharm = (decoded.pharmacyId || 'pharmacy').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const headerPharm = (req.headers['x-pharmacy-id'] || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Strict Pharmacy Tenant Isolation: User of Pharmacy A cannot access Pharmacy B
    if (headerPharm && tokenPharm && tokenPharm !== 'pharmacy' && headerPharm !== tokenPharm) {
      throw ApiError.forbidden(`Forbidden. Pharmacy '${tokenPharm}' is not authorized to access pharmacy '${headerPharm}'.`);
    }

    const pharmacyId = decoded.pharmacyId || req.headers['x-pharmacy-id'] || 'pharmacy';
    if (!req.models) {
      const conn = await getPharmacyConnection(pharmacyId);
      req.pharmacyConn = conn;
      req.db = conn;
      req.models = getPharmacyModels(conn);
      req.pharmacyId = pharmacyId;
    }

    const user = await req.models.User.findById(decoded.id).populate('role');
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or account is deactivated.');
    }

    req.user = user;
    req.userPharmacyId = pharmacyId;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  warehouseContext,
  pharmacyContext,
  authenticateWarehouse,
  authenticatePharmacy
};
