const mongoose = require('mongoose');
const env = require('./env');

// Connection pool cache: Map<dbName, mongoose.Connection>
const pharmacyConnections = new Map();

/**
 * Derives normalized database name for a pharmacy identifier
 * @param {string} [pharmacyIdentifier] - E.g. "indiranagar", "pharma_01", or full db name
 * @returns {string} Normalized DB name
 */
function getPharmacyDbName(pharmacyIdentifier) {
  if (!pharmacyIdentifier || pharmacyIdentifier === env.DEFAULT_PHARMACY_DB_NAME || pharmacyIdentifier === 'pharmacy') {
    return env.DEFAULT_PHARMACY_DB_NAME;
  }
  const cleanId = pharmacyIdentifier.toString().trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (cleanId === 'pharmacy') {
    return 'pharmacy';
  }
  if (cleanId.startsWith(env.PHARMACY_DB_PREFIX)) {
    return cleanId;
  }
  return `${env.PHARMACY_DB_PREFIX}${cleanId}`;
}

/**
 * Returns a dedicated Mongoose connection for a specific pharmacy database.
 * Reuses existing connections from the internal connection pool.
 *
 * @param {string} [pharmacyIdentifier] - Branch identifier (e.g., 'indiranagar', 'branch01')
 * @returns {Promise<mongoose.Connection>}
 */
async function getPharmacyConnection(pharmacyIdentifier) {
  const dbName = getPharmacyDbName(pharmacyIdentifier);

  if (pharmacyConnections.has(dbName)) {
    const conn = pharmacyConnections.get(dbName);
    if (conn.readyState === 1) {
      return conn;
    }
  }

  try {
    const conn = mongoose.createConnection(env.MONGODB_URI, {
      dbName: dbName,
      autoIndex: true
    });

    conn.on('connected', () => {
      console.log(`[Pharmacy DB] Connected successfully to "${dbName}"`);
    });

    conn.on('error', (err) => {
      console.error(`[Pharmacy DB] Connection error on "${dbName}":`, err.message);
    });

    conn.on('disconnected', () => {
      console.warn(`[Pharmacy DB] Disconnected from "${dbName}"`);
    });

    await conn.asPromise();
    pharmacyConnections.set(dbName, conn);
    return conn;
  } catch (error) {
    console.error(`[Pharmacy DB] Failed to connect to "${dbName}":`, error.message);
    throw error;
  }
}

/**
 * Closes all active pharmacy connections in the pool
 */
async function closeAllPharmacyConnections() {
  for (const [dbName, conn] of pharmacyConnections.entries()) {
    if (conn.readyState !== 0) {
      await conn.close();
      console.log(`[Pharmacy DB] Closed connection to "${dbName}"`);
    }
  }
  pharmacyConnections.clear();
}

module.exports = {
  getPharmacyConnection,
  getPharmacyDbName,
  closeAllPharmacyConnections,
  pharmacyConnections
};
