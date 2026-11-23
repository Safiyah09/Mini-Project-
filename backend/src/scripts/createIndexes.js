const { getWarehouseConnection } = require('../config/warehouseDatabase');
const { getPharmacyConnection } = require('../config/pharmacyDatabase');
const { disconnectAllDatabases } = require('../config/database');
const { getWarehouseModels } = require('../models/warehouse');
const { getPharmacyModels } = require('../models/pharmacy');

async function createAllIndexes() {
  console.log('================================================================');
  console.log(' Initializing Collections & Indexes for Warehouse & Pharmacy');
  console.log('================================================================');

  try {
    // 1. Warehouse Database Initialization
    console.log('\n[1/2] Connecting to Central Warehouse Database...');
    const warehouseConn = await getWarehouseConnection();
    const warehouseModels = getWarehouseModels(warehouseConn);
    const warehouseSummary = [];

    console.log('Building Warehouse Collections and Indexes (22 entities)...');
    for (const [name, Model] of Object.entries(warehouseModels)) {
      await Model.createIndexes();
      const indexes = await Model.collection.indexes();
      warehouseSummary.push({
        Model: name,
        Collection: Model.collection.name,
        IndexCount: indexes.length
      });
    }
    console.table(warehouseSummary);
    console.log(`✓ All 22 Warehouse collections and indexes successfully initialized on "${warehouseConn.name}".`);

    // 2. Pharmacy Database Initialization
    console.log('\n[2/2] Connecting to Default Pharmacy Database...');
    const pharmacyConn = await getPharmacyConnection();
    const pharmacyModels = getPharmacyModels(pharmacyConn);
    const pharmacySummary = [];

    console.log('Building Pharmacy Collections and Indexes (16 entities)...');
    for (const [name, Model] of Object.entries(pharmacyModels)) {
      await Model.createIndexes();
      const indexes = await Model.collection.indexes();
      pharmacySummary.push({
        Model: name,
        Collection: Model.collection.name,
        IndexCount: indexes.length
      });
    }
    console.table(pharmacySummary);
    console.log(`✓ All 16 Pharmacy collections and indexes successfully initialized on "${pharmacyConn.name}".`);

    console.log('\n================================================================');
    console.log(' SUMMARY:');
    console.log(' - Central Warehouse Collections Initialized: 22');
    console.log(' - Pharmacy Branch Collections Initialized: 16');
    console.log(' - Total Entities Configured Across Systems: 38');
    console.log('================================================================\n');

  } catch (err) {
    console.error('✗ Index initialization failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectAllDatabases();
  }
}

if (require.main === module) {
  createAllIndexes();
}

module.exports = createAllIndexes;
