const { getWarehouseConnection } = require('../config/warehouseDatabase');
const { getPharmacyConnection } = require('../config/pharmacyDatabase');
const { disconnectAllDatabases } = require('../config/database');
const { getWarehouseModels } = require('../models/warehouse');
const { getPharmacyModels } = require('../models/pharmacy');

async function seedData() {
  console.log('================================================================');
  console.log(' Seeding Master Data & Admin Accounts (Warehouse & Pharmacy)');
  console.log('================================================================');

  try {
    // -------------------------------------------------------------------------
    // 1. Warehouse Seed
    // -------------------------------------------------------------------------
    console.log('\n[1/2] Seeding Central Warehouse Database ("warehouse")...');
    const warehouseConn = await getWarehouseConnection();
    const wh = getWarehouseModels(warehouseConn);

    // 1.1 Warehouse Roles
    console.log('  -> Creating Warehouse Roles...');
    const rolesData = [
      { role_id: 'ROLE-WH-ADMIN', role_name: 'WAREHOUSE_ADMIN', description: 'Full system administrator' },
      { role_id: 'ROLE-WH-INV', role_name: 'INVENTORY_MANAGER', description: 'Manages warehouse inventory and stock' },
      { role_id: 'ROLE-WH-PROC', role_name: 'PROCUREMENT_OFFICER', description: 'Manages supplier purchase orders and receipts' },
      { role_id: 'ROLE-WH-DISP', role_name: 'DISPATCH_OPERATOR', description: 'Handles stock transfer dispatch to pharmacies' }
    ];

    for (const r of rolesData) {
      await wh.Role.findOneAndUpdate({ role_id: r.role_id }, r, { upsert: true, new: true });
    }
    const whAdminRole = await wh.Role.findOne({ role_name: 'WAREHOUSE_ADMIN' });

    // 1.2 Warehouse Admin User
    console.log('  -> Creating Warehouse Admin User...');
    const existingWhAdmin = await wh.User.findOne({ username: 'admin' });
    if (!existingWhAdmin) {
      await wh.User.create({
        user_id: 'WH-USR-001',
        name: 'Warehouse Administrator',
        username: 'admin',
        password: 'Password@123', // Will be hashed by bcrypt pre-save hook
        email: 'admin@pharmamgmt-warehouse.com',
        role: whAdminRole._id
      });
      console.log('     Created warehouse user: "admin" (Password: "Password@123")');
    } else {
      console.log('     Warehouse user "admin" already exists.');
    }

    // 1.3 Warehouse Suppliers
    console.log('  -> Creating Master Suppliers...');
    const suppliersData = [
      {
        supplier_id: 'SUP-CIPLA-01',
        name: 'Cipla Pharmaceuticals Ltd.',
        address: 'Plot 14, MIDC Industrial Area, Mumbai, Maharashtra',
        contact: '+91-9876543210 / orders@cipla.com'
      },
      {
        supplier_id: 'SUP-SUN-02',
        name: 'Sun Pharma Laboratories',
        address: 'Sun House, Goregaon East, Mumbai, Maharashtra',
        contact: '+91-9876543211 / supply@sunpharma.com'
      },
      {
        supplier_id: 'SUP-DRREDDY-03',
        name: "Dr. Reddy's Laboratories",
        address: 'Banjara Hills, Hyderabad, Telangana',
        contact: '+91-9876543212 / distribution@drreddys.com'
      }
    ];
    for (const s of suppliersData) {
      await wh.Supplier.findOneAndUpdate({ supplier_id: s.supplier_id }, s, { upsert: true });
    }

    // 1.4 Warehouse Storage Locations
    console.log('  -> Creating Warehouse Storage Locations...');
    const locationsData = [
      { location_id: 'LOC-ZA-R01-B01', zone: 'Zone A', rack_bin: 'Rack 1 / Bin 01', cold_storage: false, description: 'Ambient general tablet storage' },
      { location_id: 'LOC-ZA-R01-B02', zone: 'Zone A', rack_bin: 'Rack 1 / Bin 02', cold_storage: false, description: 'Ambient capsule storage' },
      { location_id: 'LOC-ZB-COLD-01', zone: 'Zone B', rack_bin: 'Cold Unit 1', cold_storage: true, description: '2°C to 8°C cold chain storage' }
    ];
    for (const l of locationsData) {
      await wh.StorageLocation.findOneAndUpdate({ location_id: l.location_id }, l, { upsert: true });
    }

    // 1.5 Warehouse Medicines
    console.log('  -> Creating Master Medicines...');
    const medicinesData = [
      { medicine_id: 'MED-PCM-500', name: 'Paracetamol', manufacturer: 'Cipla Ltd.', category: 'Analgesic', dosage: '500mg', formulation: 'Tablet' },
      { medicine_id: 'MED-AMX-500', name: 'Amoxicillin', manufacturer: 'Sun Pharma', category: 'Antibiotic', dosage: '500mg', formulation: 'Capsule' },
      { medicine_id: 'MED-AZI-250', name: 'Azithromycin', manufacturer: "Dr. Reddy's", category: 'Antibiotic', dosage: '250mg', formulation: 'Tablet' },
      { medicine_id: 'MED-CET-010', name: 'Cetirizine', manufacturer: 'Cipla Ltd.', category: 'Antihistamine', dosage: '10mg', formulation: 'Tablet' },
      { medicine_id: 'MED-INS-100', name: 'Insulin Glargine', manufacturer: 'Sanofi', category: 'Antidiabetic', dosage: '100 IU/ml', formulation: 'Injection' }
    ];
    for (const m of medicinesData) {
      await wh.Medicine.findOneAndUpdate({ medicine_id: m.medicine_id }, m, { upsert: true });
    }

    // 1.6 Warehouse Registered Pharmacies
    console.log('  -> Creating Registered Pharmacies...');
    const pharmaciesData = [
      {
        pharmacy_id: 'PHARM-IND-01',
        name: 'Apollo Care Pharmacy - Indiranagar',
        address: '100 Feet Road, Indiranagar, Bengaluru, Karnataka',
        contact: '+91-8025251122',
        connection_details: { db_name: 'pharmacy' }
      },
      {
        pharmacy_id: 'PHARM-KOR-02',
        name: 'MedPlus Health Care - Koramangala',
        address: '80 Feet Road, Koramangala 4th Block, Bengaluru, Karnataka',
        contact: '+91-8025253344',
        connection_details: { db_name: 'pharmacy' }
      }
    ];
    for (const p of pharmaciesData) {
      await wh.Pharmacy.findOneAndUpdate({ pharmacy_id: p.pharmacy_id }, p, { upsert: true });
    }

    console.log('✓ Warehouse master data seeded successfully.');

    // -------------------------------------------------------------------------
    // 2. Pharmacy Seed
    // -------------------------------------------------------------------------
    console.log('\n[2/2] Seeding Default Pharmacy Database ("pharmacy")...');
    const pharmacyConn = await getPharmacyConnection();
    const ph = getPharmacyModels(pharmacyConn);

    // 2.1 Pharmacy Roles
    console.log('  -> Creating Pharmacy Roles...');
    const phRolesData = [
      { role_id: 'ROLE-PH-ADMIN', role_name: 'PHARMACY_ADMIN', description: 'Branch dispensary head' },
      { role_id: 'ROLE-PH-PHARMACIST', role_name: 'PHARMACIST', description: 'Dispenses medications and verifies prescriptions' },
      { role_id: 'ROLE-PH-CASHIER', role_name: 'CASHIER', description: 'Handles point-of-sale customer billing and payments' }
    ];
    for (const r of phRolesData) {
      await ph.Role.findOneAndUpdate({ role_id: r.role_id }, r, { upsert: true, new: true });
    }
    const phAdminRole = await ph.Role.findOne({ role_name: 'PHARMACY_ADMIN' });

    // 2.2 Pharmacy Admin User
    console.log('  -> Creating Pharmacy Admin User...');
    const existingPhAdmin = await ph.User.findOne({ username: 'pharmadmin' });
    if (!existingPhAdmin) {
      await ph.User.create({
        user_id: 'PH-USR-001',
        name: 'Pharmacy Branch Administrator',
        username: 'pharmadmin',
        password: 'Password@123',
        email: 'branch.admin@pharmacy.com',
        role: phAdminRole._id
      });
      console.log('     Created pharmacy user: "pharmadmin" (Password: "Password@123")');
    } else {
      console.log('     Pharmacy user "pharmadmin" already exists.');
    }

    // 2.3 Pharmacy Medicines Catalog
    console.log('  -> Syncing Pharmacy Medicine Catalog...');
    for (const m of medicinesData) {
      await ph.Medicine.findOneAndUpdate(
        { medicine_id: m.medicine_id },
        { ...m, reorder_level: 25 },
        { upsert: true }
      );
    }

    // 2.4 Pharmacy Customers
    console.log('  -> Creating Pharmacy Customers...');
    const customersData = [
      {
        customer_id: 'CUST-001',
        name: 'Rajesh Sharma',
        phone: '+91-9820112233',
        email: 'rajesh.sharma@example.com',
        address: 'Flat 402, Green Glen Layout, Bengaluru',
        date_of_birth: new Date('1985-04-12')
      },
      {
        customer_id: 'CUST-002',
        name: 'Priya Nair',
        phone: '+91-9845009988',
        email: 'priya.nair@example.com',
        address: '12, 5th Cross, Indiranagar, Bengaluru',
        date_of_birth: new Date('1992-09-24')
      }
    ];
    for (const c of customersData) {
      await ph.Customer.findOneAndUpdate({ customer_id: c.customer_id }, c, { upsert: true });
    }

    console.log('✓ Pharmacy master data seeded successfully.');

    console.log('\n================================================================');
    console.log(' SEED COMPLETE!');
    console.log(' Warehouse Admin Credentials: username="admin", password="Password@123"');
    console.log(' Pharmacy Admin Credentials:  username="pharmadmin", password="Password@123"');
    console.log('================================================================\n');

  } catch (err) {
    console.error('✗ Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectAllDatabases();
  }
}

if (require.main === module) {
  seedData();
}

module.exports = seedData;
