const { getWarehouseConnection } = require('./warehouseDatabase');
const { getPharmacyConnection, closeAllPharmacyConnections } = require('./pharmacyDatabase');
const env = require('./env');

/**
 * Connects to both Central Warehouse and Default Pharmacy databases.
 * Verifies multi-database connectivity on MongoDB Atlas.
 */
async function connectAllDatabases() {
  console.log('[Database] Initializing multi-database connections to MongoDB Atlas...');

  const warehouseConn = await getWarehouseConnection();
  const defaultPharmacyConn = await getPharmacyConnection();

  console.log(`[Database] Multi-database architecture active:`);
  console.log(`  * Central Warehouse DB : "${warehouseConn.name}" (ReadyState: ${warehouseConn.readyState})`);
  console.log(`  * Pharmacy DB          : "${defaultPharmacyConn.name}" (ReadyState: ${defaultPharmacyConn.readyState})`);

  return {
    warehouseConn,
    defaultPharmacyConn
  };
}

/**
 * Utility function to test and verify MongoDB Atlas connections from terminal
 */
async function testConnections() {
  try {
    const { warehouseConn, defaultPharmacyConn } = await connectAllDatabases();
    console.log('✓ All MongoDB Atlas multi-database connections verified successfully!');
    await disconnectAllDatabases();
    process.exit(0);
  } catch (err) {
    console.error('✗ MongoDB Atlas connection test failed:', err.message);
    process.exit(1);
  }
}

/**
 * Gracefully disconnects all database connections
 */
async function disconnectAllDatabases() {
  const { getWarehouseConnection } = require('./warehouseDatabase');
  try {
    const warehouseConn = await getWarehouseConnection();
    if (warehouseConn && warehouseConn.readyState !== 0) {
      await warehouseConn.close();
      console.log('[Warehouse DB] Connection closed gracefully.');
    }
  } catch (err) {
    // Ignore if not initialized
  }

  await closeAllPharmacyConnections();
  console.log('[Database] All database connections terminated.');
}

module.exports = {
  connectAllDatabases,
  disconnectAllDatabases,
  testConnections,
  getWarehouseConnection,
  getPharmacyConnection
};
