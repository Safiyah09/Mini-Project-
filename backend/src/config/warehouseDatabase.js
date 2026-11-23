const mongoose = require('mongoose');
const env = require('./env');

let warehouseConnection = null;

/**
 * Establishes or returns the dedicated connection for the Central Warehouse Database.
 * Uses createConnection to keep the Warehouse connection isolated from Pharmacy databases.
 *
 * @returns {Promise<mongoose.Connection>}
 */
async function getWarehouseConnection() {
  if (warehouseConnection && warehouseConnection.readyState === 1) {
    return warehouseConnection;
  }

  try {
    warehouseConnection = mongoose.createConnection(env.MONGODB_URI, {
      dbName: env.WAREHOUSE_DB_NAME,
      autoIndex: true
    });

    warehouseConnection.on('connected', () => {
      console.log(`[Warehouse DB] Connected successfully to "${env.WAREHOUSE_DB_NAME}"`);
    });

    warehouseConnection.on('error', (err) => {
      console.error(`[Warehouse DB] Connection error:`, err.message);
    });

    warehouseConnection.on('disconnected', () => {
      console.warn(`[Warehouse DB] Disconnected from "${env.WAREHOUSE_DB_NAME}"`);
    });

    // Wait until connected
    await warehouseConnection.asPromise();
    return warehouseConnection;
  } catch (error) {
    console.error(`[Warehouse DB] Initial connection failed:`, error.message);
    throw error;
  }
}

module.exports = {
  getWarehouseConnection
};
