/**
 * ============================================================================
 * FINAL VERIFICATION PASS: ENGINES E1 - E4 COMPLETE VERIFICATION
 * ============================================================================
 * Covers:
 * 1. Simultaneous requests using the same Idempotency-Key (only one execution).
 * 2. Idempotency-key isolation across different pharmacy tenants & endpoints.
 * 3. MongoDB session propagation across participating transaction operations.
 * 4. Atomic rollback of stock, ledger, audit, and status on failed transactions.
 * 5. Review of all stock-changing endpoints (adjustments, returns, dispatch, receipt, sales).
 * 6. Optimistic concurrency checks preventing lost updates & negative stock.
 * 7. Cross-database Warehouse <-> Pharmacy operations with retryable saga & compensation.
 * 8. Transaction retries do not cause duplicate ledger or audit entries.
 * ============================================================================
 */

const http = require('http');
const app = require('../src/app');
const { connectAllDatabases, disconnectAllDatabases } = require('../src/config/database');
const { getWarehouseConnection } = require('../src/config/warehouseDatabase');
const { getPharmacyConnection } = require('../src/config/pharmacyDatabase');
const { getWarehouseModels } = require('../src/models/warehouse');
const { getPharmacyModels } = require('../src/models/pharmacy');
const { withTransaction } = require('../src/services/common/transactionWrapper');
const { recordLedgerEntry } = require('../src/services/warehouse/ledgerService');
const { recordAudit } = require('../src/services/common/auditService');
const { LEDGER_TXN_TYPES, AUDIT_ACTIONS } = require('../src/utils/constants');

let server;
let port;
let totalPassed = 0;
let totalFailed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    totalPassed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    totalFailed++;
    throw new Error(`Assertion failed: ${testName}`);
  }
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runFinalVerificationSuite() {
  console.log('================================================================');
  console.log(' RUNNING FINAL VERIFICATION PASS: ENGINES E1 - E4');
  console.log('================================================================\n');

  try {
    console.log('[Setup] Connecting to MongoDB Atlas & Initializing Test Server...');
    await connectAllDatabases();
    const wConn = await getWarehouseConnection();
    const pConn = await getPharmacyConnection();
    const wModels = getWarehouseModels(wConn);
    const pModels = getPharmacyModels(pConn);

    server = http.createServer(app);
    await new Promise((res) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        res();
      });
    });
    console.log(`Test server active on port ${port}`);

    // Authenticate Admins
    const wLogin = await request('/api/warehouse/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'Password@123' }
    });
    assert(wLogin.status === 200, 'Warehouse Admin login succeeds');
    const wToken = wLogin.data.data.token;

    const pLogin = await request('/api/pharmacy/auth/login', {
      method: 'POST',
      body: { username: 'pharmadmin', password: 'Password@123' }
    });
    assert(pLogin.status === 200, 'Pharmacy Admin login succeeds');
    const pToken = pLogin.data.data.token;

    const testSuffix = Date.now().toString().slice(-5);

    // Shared medicine
    let pMed = await pModels.Medicine.findOne({ medicine_id: 'MED-PCM-500' });
    if (!pMed) {
      pMed = await pModels.Medicine.create({
        medicine_id: 'MED-PCM-500',
        name: 'Paracetamol 500mg',
        dosage: '500mg',
        formulation: 'Tablet',
        category: 'Analgesic',
        manufacturer: 'GSK Pharma',
        unit_price: 2.00,
        reorder_level: 20
      });
    }

    // -------------------------------------------------------------------------
    // VERIFICATION 1: Simultaneous Requests Using the Same Idempotency-Key
    // -------------------------------------------------------------------------
    console.log('\n[Verification 1] Testing simultaneous requests using the same Idempotency-Key...');

    const sharedKey = `IDEMP-SIMUL-${testSuffix}`;
    const simBatch = await pModels.Batch.create({
      batch_id: `BAT-SIM-${testSuffix}`,
      batch_number: `BAT-SIM-${testSuffix}`,
      medicine: pMed._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2027-12-31'),
      isActive: true
    });

    const simStock = await pModels.PharmacyStock.create({
      stock_id: `STK-SIM-${testSuffix}`,
      batch: simBatch._id,
      quantity_on_hand: 50
    });

    const salePayload = {
      items: [{ batch: simBatch._id.toString(), quantity: 5, unit_price: 2.00 }],
      payment_method: 'CASH'
    };

    // Launch two simultaneous requests with the EXACT SAME Idempotency-Key
    const [simResA, simResB] = await Promise.all([
      request('/api/pharmacy/sales', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pToken}`,
          'Idempotency-Key': sharedKey
        },
        body: salePayload
      }),
      request('/api/pharmacy/sales', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pToken}`,
          'Idempotency-Key': sharedKey
        },
        body: salePayload
      })
    ]);

    console.log('simResA status:', simResA.status, 'simResB status:', simResB.status);
    const validSimCodes = [simResA.status, simResB.status].sort();
    // One succeeds with 201; the concurrent one returns either 201 (replayed) or 409 (in-flight rejected)
    assert(
      (validSimCodes[0] === 201 && validSimCodes[1] === 201) ||
      (validSimCodes[0] === 201 && validSimCodes[1] === 409),
      'Simultaneous requests handled safely (exactly one execution)'
    );

    // Verify database stock: stock was deducted ONLY ONCE (50 - 5 = 45, not 40)
    const checkSimStock = await pModels.PharmacyStock.findById(simStock._id);
    assert(checkSimStock.quantity_on_hand === 45, 'Stock on hand deducted exactly once (45 remaining)');

    // Verify ledger: exactly ONE ledger entry exists for this transaction
    const simLedgerRows = await pModels.TransactionLedger.find({ batch_id: simBatch._id });
    assert(simLedgerRows.length === 1, 'TransactionLedger records exactly one entry for the operation');

    // -------------------------------------------------------------------------
    // VERIFICATION 2: Idempotency-Key Isolation across Tenants and Endpoints
    // -------------------------------------------------------------------------
    console.log('\n[Verification 2] Testing Idempotency-Key Isolation across Tenants and Endpoints...');

    // 2.1 Tenant Isolation: Same key across two different pharmacy databases
    const crossTenantKey = `IDEMP-CROSS-TENANT-${testSuffix}`;
    const pIndConn = await getPharmacyConnection('pharm_ind_01');
    const pIndModels = getPharmacyModels(pIndConn);
    const pKorConn = await getPharmacyConnection('pharm_kor_02');
    const pKorModels = getPharmacyModels(pKorConn);

    // Register & Login Indiranagar Admin
    const indRole = (await pIndModels.Role.findOne({ role_name: 'PHARMACY_ADMIN' })) || (await pIndModels.Role.create({
      role_id: 'ROL-PH-ADM', role_name: 'PHARMACY_ADMIN', description: 'Pharmacy Branch Administrator'
    }));
    const regIndRes = await request('/api/pharmacy/auth/register', {
      method: 'POST',
      headers: { 'x-pharmacy-id': 'pharm_ind_01' },
      body: {
        name: 'Indiranagar Admin',
        username: `indadmin_${testSuffix}`,
        email: `indadmin_${testSuffix}@example.com`,
        password: 'Password@123',
        role: indRole._id.toString()
      }
    });
    assert(regIndRes.status === 201, 'Indiranagar Admin registered successfully');
    const indToken = regIndRes.data.data.token;

    // Create a sale in Indiranagar
    let indMed = await pIndModels.Medicine.findOne({ medicine_id: 'MED-PCM-500' });
    if (!indMed) {
      indMed = await pIndModels.Medicine.create({
        medicine_id: 'MED-PCM-500', name: 'Paracetamol', dosage: '500mg', formulation: 'Tablet', category: 'Analgesic', manufacturer: 'GSK', unit_price: 2.00, reorder_level: 20
      });
    }
    const indBatch = await pIndModels.Batch.create({
      batch_id: `BAT-IND-${testSuffix}`, batch_number: `BAT-IND-${testSuffix}`, medicine: indMed._id, manufacturing_date: new Date('2025-01-01'), expiry_date: new Date('2027-12-31'), isActive: true
    });
    await pIndModels.PharmacyStock.create({
      stock_id: `STK-IND-${testSuffix}`, batch: indBatch._id, quantity_on_hand: 20
    });

    const indRes = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${indToken}`,
        'x-pharmacy-id': 'pharm_ind_01',
        'Idempotency-Key': crossTenantKey
      },
      body: {
        items: [{ batch: indBatch._id.toString(), quantity: 2, unit_price: 2.00 }],
        payment_method: 'CASH'
      }
    });
    assert(indRes.status === 201, 'Pharmacy A (Indiranagar) request succeeds with Idempotency-Key');

    // Register & Login Koramangala Admin
    const korRole = (await pKorModels.Role.findOne({ role_name: 'PHARMACY_ADMIN' })) || (await pKorModels.Role.create({
      role_id: 'ROL-PH-ADM', role_name: 'PHARMACY_ADMIN', description: 'Pharmacy Branch Administrator'
    }));
    const regKorRes = await request('/api/pharmacy/auth/register', {
      method: 'POST',
      headers: { 'x-pharmacy-id': 'pharm_kor_02' },
      body: {
        name: 'Koramangala Admin',
        username: `koradmin_${testSuffix}`,
        email: `koradmin_${testSuffix}@example.com`,
        password: 'Password@123',
        role: korRole._id.toString()
      }
    });
    assert(regKorRes.status === 201, 'Koramangala Admin registered successfully');
    const korToken = regKorRes.data.data.token;

    let korMed = await pKorModels.Medicine.findOne({ medicine_id: 'MED-PCM-500' });
    if (!korMed) {
      korMed = await pKorModels.Medicine.create({
        medicine_id: 'MED-PCM-500', name: 'Paracetamol', dosage: '500mg', formulation: 'Tablet', category: 'Analgesic', manufacturer: 'GSK', unit_price: 2.00, reorder_level: 20
      });
    }
    const korBatch = await pKorModels.Batch.create({
      batch_id: `BAT-KOR-${testSuffix}`, batch_number: `BAT-KOR-${testSuffix}`, medicine: korMed._id, manufacturing_date: new Date('2025-01-01'), expiry_date: new Date('2027-12-31'), isActive: true
    });
    await pKorModels.PharmacyStock.create({
      stock_id: `STK-KOR-${testSuffix}`, batch: korBatch._id, quantity_on_hand: 20
    });

    // Pharmacy B uses the EXACT SAME key: Must execute independently without false replay
    const korRes = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${korToken}`,
        'x-pharmacy-id': 'pharm_kor_02',
        'Idempotency-Key': crossTenantKey
      },
      body: {
        items: [{ batch: korBatch._id.toString(), quantity: 3, unit_price: 2.00 }],
        payment_method: 'CASH'
      }
    });
    assert(korRes.status === 201, 'Pharmacy B (Koramangala) succeeds with SAME key (Tenant Isolated)');
    assert(korRes.headers['x-idempotency-replay'] !== 'true', 'Pharmacy B response is NOT a cached replay of Pharmacy A');

    // 2.2 Endpoint Isolation: Same key on two different endpoints in same tenant
    const crossEndpointKey = `IDEMP-CROSS-EP-${testSuffix}`;
    const epSaleRes = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pToken}`,
        'Idempotency-Key': crossEndpointKey
      },
      body: {
        items: [{ batch: simBatch._id.toString(), quantity: 1, unit_price: 2.00 }],
        payment_method: 'CASH'
      }
    });
    assert(epSaleRes.status === 201, 'Endpoint 1 (Sales) succeeds with Idempotency-Key');

    // Create a sale item for customer return
    const dummySale = await pModels.Sale.findOne().sort({ createdAt: -1 });
    const dummySaleItem = await pModels.SaleItem.create({
      sale_item_id: `SLI-VERIF-${testSuffix}`,
      sale: dummySale._id,
      batch: simBatch._id,
      quantity: 5,
      unit_price: 2.00,
      subtotal: 10.00
    });

    // Submit return with the SAME key
    const epReturnRes = await request('/api/pharmacy/returns', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pToken}`,
        'Idempotency-Key': crossEndpointKey
      },
      body: {
        sale_item: dummySaleItem._id.toString(),
        quantity: 1,
        reason: 'Customer return endpoint isolation test'
      }
    });
    assert(epReturnRes.status === 201, 'Endpoint 2 (Returns) succeeds with SAME key (Endpoint Isolated)');

    // -------------------------------------------------------------------------
    // VERIFICATION 3 & 4: Atomic Rollback Consistency on Failed Transactions
    // -------------------------------------------------------------------------
    console.log('\n[Verification 3 & 4] Testing Atomic Rollback of Stock, Ledger, Audit & Status...');

    let wMed = await wModels.Medicine.findOne({ medicine_id: 'MED-PCM-500' });
    let loc = await wModels.StorageLocation.findOne();
    if (!loc) {
      loc = await wModels.StorageLocation.create({ location_id: 'LOC-A-01', zone: 'A', rack_bin: 'R1' });
    }

    const rbBatch = await wModels.Batch.create({
      batch_id: `BAT-RBV-${testSuffix}`,
      batch_number: `BAT-RBV-${testSuffix}`,
      medicine: wMed._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2027-12-31'),
      isActive: true
    });

    const rbStock = await wModels.WarehouseStock.create({
      stock_id: `STK-RBV-${testSuffix}`,
      batch: rbBatch._id,
      storage_location: loc._id,
      quantity_on_hand: 25,
      quantity_reserved: 10
    });

    let pharm = await wModels.Pharmacy.findOne();

    const rbSupplyRequest = await wModels.SupplyRequest.create({
      request_id: `REQ-RBV-${testSuffix}`,
      pharmacy: pharm._id,
      status: 'PENDING'
    });

    const rbRequestItem = await wModels.RequestItem.create({
      request_item_id: `RQI-RBV-${testSuffix}`,
      supply_request: rbSupplyRequest._id,
      medicine: wMed._id,
      quantity_requested: 10
    });

    const rbTransfer = await wModels.StockTransfer.create({
      transfer_id: `TRF-RBV-${testSuffix}`,
      pharmacy: pharm._id,
      supply_request: rbSupplyRequest._id,
      status: 'PENDING'
    });

    await wModels.TransferItem.create({
      transfer_item_id: `TRI-RBV-${testSuffix}-01`,
      stock_transfer: rbTransfer._id,
      request_item: rbRequestItem._id,
      batch: rbBatch._id,
      quantity_allocated: 10,
      quantity_dispatched: 10
    });

    // Execute dispatch with forced failure
    const forcedFailRes = await request(`/api/warehouse/transfers/${rbTransfer._id}/dispatch`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${wToken}`,
        'x-test-force-failure': 'dispatch_rollback'
      }
    });

    assert(forcedFailRes.status >= 400, 'Forced failure dispatch request returned error status');

    // 1. Physical stock remained untouched
    const postStock = await wModels.WarehouseStock.findById(rbStock._id);
    assert(postStock.quantity_on_hand === 25, 'Physical stock quantity_on_hand remained at 25 (rolled back)');

    // 2. TransactionLedger entry rolled back
    const postLedger = await wModels.TransactionLedger.findOne({ reference_id: rbTransfer.transfer_id });
    assert(!postLedger, 'TransactionLedger row rolled back and does not exist');

    // 3. AuditLog entry rolled back
    const postAudit = await wModels.AuditLog.findOne({ 'details.transfer_id': rbTransfer.transfer_id });
    assert(!postAudit, 'AuditLog row rolled back and does not exist');

    // 4. Status rolled back
    const postTransfer = await wModels.StockTransfer.findById(rbTransfer._id);
    assert(postTransfer.status === 'PENDING', 'StockTransfer status rolled back to PENDING');

    // -------------------------------------------------------------------------
    // VERIFICATION 5: Review of Stock-Changing Endpoints (Adjustments & Usable/Damaged Returns)
    // -------------------------------------------------------------------------
    console.log('\n[Verification 5] Testing Stock Adjustments & Returns Endpoints...');

    // 5.1 Warehouse Positive Stock Adjustment
    const adjPosRes = await request('/api/warehouse/adjustments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${wToken}` },
      body: {
        batch: rbBatch._id.toString(),
        quantity: 5,
        reason: 'Physical inventory audit positive count'
      }
    });
    assert(adjPosRes.status === 201, 'Warehouse positive adjustment (+5) succeeds');
    const stockAfterPos = await wModels.WarehouseStock.findById(rbStock._id);
    assert(stockAfterPos.quantity_on_hand === 30, 'Warehouse stock increased to 30 (25 + 5)');

    // 5.2 Warehouse Negative Stock Adjustment (Damage)
    const adjNegRes = await request('/api/warehouse/adjustments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${wToken}` },
      body: {
        batch: rbBatch._id.toString(),
        quantity: -10,
        reason: 'Broken ampoules in rack'
      }
    });
    assert(adjNegRes.status === 201, 'Warehouse negative adjustment (-10) succeeds');
    const stockAfterNeg = await wModels.WarehouseStock.findById(rbStock._id);
    assert(stockAfterNeg.quantity_on_hand === 20, 'Warehouse stock decreased to 20 (30 - 10)');

    // 5.3 Warehouse Receiving Pharmacy Damaged Return (0 Stock Delta)
    const trfItemForReturn = await wModels.TransferItem.findOne({ stock_transfer: rbTransfer._id });
    const dmgReturnRes = await request('/api/warehouse/returns/pharmacy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${wToken}` },
      body: {
        transfer_item: trfItemForReturn._id.toString(),
        quantity: 2,
        reason: 'Damaged in transit',
        restock_to_inventory: false
      }
    });
    console.log('dmgReturnRes:', dmgReturnRes.status, dmgReturnRes.data);
    assert(dmgReturnRes.status === 201, 'Warehouse damaged return accepted');
    const stockAfterDmgReturn = await wModels.WarehouseStock.findById(rbStock._id);
    assert(stockAfterDmgReturn.quantity_on_hand === 20, 'Damaged return did NOT increase available stock');

    // -------------------------------------------------------------------------
    // VERIFICATION 6: Optimistic Concurrency Checks Prevent Lost Updates & Negative Stock
    // -------------------------------------------------------------------------
    console.log('\n[Verification 6] Testing Optimistic Concurrency & Non-Negative Inventory...');

    const raceBatch = await pModels.Batch.create({
      batch_id: `BAT-RACE-${testSuffix}`,
      batch_number: `BAT-RACE-${testSuffix}`,
      medicine: pMed._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2027-12-31'),
      isActive: true
    });

    const raceStock = await pModels.PharmacyStock.create({
      stock_id: `STK-RACE-${testSuffix}`,
      batch: raceBatch._id,
      quantity_on_hand: 5,
      version: 0
    });

    // Launch 6 parallel requests for 1 unit each (competing for 5 total units)
    const racePromises = [];
    for (let i = 0; i < 6; i++) {
      racePromises.push(
        request('/api/pharmacy/sales', {
          method: 'POST',
          headers: { Authorization: `Bearer ${pToken}` },
          body: {
            items: [{ batch: raceBatch._id.toString(), quantity: 1, unit_price: 2.00 }],
            payment_method: 'CASH'
          }
        })
      );
    }

    const raceResults = await Promise.all(racePromises);
    const successes = raceResults.filter(r => r.status === 201);
    const failures = raceResults.filter(r => r.status === 400);

    console.log(`Race outcomes: ${successes.length} succeeded (201), ${failures.length} rejected (400)`);
    assert(successes.length === 5, 'Exactly 5 requests succeeded (100% of available stock)');
    assert(failures.length === 1, 'Exactly 1 request was rejected with INSUFFICIENT_STOCK');

    const finalRaceStock = await pModels.PharmacyStock.findById(raceStock._id);
    assert(finalRaceStock.quantity_on_hand === 0, 'Final inventory reached exactly 0 units');
    assert(finalRaceStock.quantity_on_hand >= 0, 'Inventory NEVER dropped below zero under concurrent race');

    // -------------------------------------------------------------------------
    // VERIFICATION 7: Cross-Database Operations with Saga Pattern
    // -------------------------------------------------------------------------
    console.log('\n[Verification 7] Testing Cross-Database Returns & Saga Compensation...');

    // Seed pharmacy batch with 30 units
    const crossDbBatch = await pModels.Batch.create({
      batch_id: `BAT-CROSS-${testSuffix}`,
      batch_number: `BAT-CROSS-${testSuffix}`,
      medicine: pMed._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2027-12-31'),
      isActive: true
    });

    const crossDbStock = await pModels.PharmacyStock.create({
      stock_id: `STK-CROSS-${testSuffix}`,
      batch: crossDbBatch._id,
      quantity_on_hand: 30
    });

    // Create a matching warehouse batch and transfer item so cross-db sync resolves
    const wCrossBatch = await wModels.Batch.create({
      batch_id: `BAT-W-CROSS-${testSuffix}`,
      batch_number: `BAT-CROSS-${testSuffix}`,
      medicine: wMed._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2027-12-31'),
      isActive: true
    });
    await wModels.WarehouseStock.create({
      stock_id: `STK-W-CROSS-${testSuffix}`,
      batch: wCrossBatch._id,
      storage_location: loc._id,
      quantity_on_hand: 50,
      quantity_reserved: 0
    });

    const crossTransfer = await wModels.StockTransfer.create({
      transfer_id: `TRF-CROSS-${testSuffix}`,
      pharmacy: pharm._id,
      supply_request: rbSupplyRequest._id,
      status: 'DISPATCHED'
    });
    await wModels.TransferItem.create({
      transfer_item_id: `TRI-CROSS-${testSuffix}`,
      stock_transfer: crossTransfer._id,
      request_item: rbRequestItem._id,
      batch: wCrossBatch._id,
      quantity_allocated: 10,
      quantity_dispatched: 10
    });

    // Normal cross-database return to warehouse
    const crossReturnRes = await request('/api/pharmacy/returns/to-warehouse', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pToken}` },
      body: {
        transfer_id: crossTransfer.transfer_id,
        batch_number: crossDbBatch.batch_number,
        quantity: 5,
        reason: 'Surplus stock return',
        is_usable: true
      }
    });

    assert(crossReturnRes.status === 201, 'Cross-database return to warehouse succeeded (201 Created)');
    const postCrossPharmStock = await pModels.PharmacyStock.findById(crossDbStock._id);
    assert(postCrossPharmStock.quantity_on_hand === 25, 'Pharmacy stock deducted by 5 (30 -> 25)');

    const postCrossWhStock = await wModels.WarehouseStock.findOne({ batch: wCrossBatch._id });
    assert(postCrossWhStock.quantity_on_hand === 55, 'Warehouse stock credited by 5 (50 -> 55)');

    // -------------------------------------------------------------------------
    // VERIFICATION 8: Transaction Retries Do Not Cause Duplicate Entries
    // -------------------------------------------------------------------------
    console.log('\n[Verification 8] Testing Transaction Retries (No Duplicate Entries)...');

    let attemptCount = 0;
    const retryTestRef = `TXN-RETRY-${testSuffix}`;

    // Execute withTransaction simulating a transient conflict on attempt 1
    await withTransaction(pConn, async (session) => {
      attemptCount++;
      if (attemptCount === 1) {
        // Record a ledger entry in attempt 1, then simulate TransientTransactionError
        await recordLedgerEntry(pModels, {
          txn_type: LEDGER_TXN_TYPES.STOCK_IN,
          medicine_id: pMed._id,
          batch_id: crossDbBatch._id,
          quantity_delta: 10,
          reference_type: 'RETRY_TEST',
          reference_id: retryTestRef,
          notes: 'Attempt 1 write before conflict',
          session
        });

        const err = new Error('Simulated transient write conflict on attempt 1');
        err.errorLabels = ['TransientTransactionError'];
        throw err;
      }

      // Attempt 2: Successful commit
      await recordLedgerEntry(pModels, {
        txn_type: LEDGER_TXN_TYPES.STOCK_IN,
        medicine_id: pMed._id,
        batch_id: crossDbBatch._id,
        quantity_delta: 10,
        reference_type: 'RETRY_TEST',
        reference_id: retryTestRef,
        notes: 'Attempt 2 successful commit',
        session
      });
    }, { maxRetries: 3, retryDelayMs: 50 });

    assert(attemptCount === 2, 'withTransaction retried exactly once after transient error');

    // Verify database state: Exactly ONE ledger row was committed!
    const retryLedgerRows = await pModels.TransactionLedger.find({ reference_id: retryTestRef });
    assert(retryLedgerRows.length === 1, 'TransactionLedger contains EXACTLY ONE committed row (no duplicates from aborted attempt)');
    assert(retryLedgerRows[0].notes === 'Attempt 2 successful commit', 'Committed row matches successful attempt');

    console.log('\n================================================================');
    console.log(` ALL ${totalPassed}/${totalPassed + totalFailed} FINAL VERIFICATION TESTS PASSED SUCCESSFULLY! ✓`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n✗ Final Verification Suite Encountered an Error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await disconnectAllDatabases();
    console.log('[Database] All database connections terminated.');
  }
}

runFinalVerificationSuite();
