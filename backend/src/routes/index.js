const express = require('express');
const router = express.Router();
const ApiResponse = require('../utils/ApiResponse');

const warehouseRouter = require('./warehouse');
const pharmacyRouter = require('./pharmacy');

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  return ApiResponse.success(res, {
    status: 'ONLINE',
    timestamp: new Date().toISOString(),
    system: 'Pharmaceutical Management System (Multi-Database Backend)',
    architecture: {
      warehouse: 'Central Warehouse Database',
      pharmacies: 'Independent Branch Databases via REST APIs'
    }
  }, 'Pharmaceutical Management System API is healthy');
});

// Mount systems
router.use('/warehouse', warehouseRouter);
router.use('/pharmacy', pharmacyRouter);

module.exports = router;
