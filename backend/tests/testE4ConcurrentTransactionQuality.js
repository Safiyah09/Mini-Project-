/**
 * ============================================================================
 * ENGINE E4 AUTOMATED TEST SUITE: CONCURRENT TRANSACTION & QUALITY
 * ============================================================================
 * Mandatory Testing Requirements:
 * 1. Concurrency: Two simultaneous requests for the last 5 units -> exactly one
 *    succeeds (201) and one fails (400 INSUFFICIENT_STOCK); stock never negative.
 * 2. Transaction Rollback: Forced failure during dispatch rolls back stock,
 *    ledger, and audit changes atomically.
 * 3. Idempotency Service:
 *    - Same Idempotency-Key submitted twice applies operation only once.
 *    - Reusing key with different request body is rejected with IDEMPOTENCY_PAYLOAD_MISMATCH.
 * 4. Shared Validation Layer:
 *    - Negative quantity (-5) and invalid quantity ("abc") rejected without changing data.
 *    - Invalid status transitions rejected with 409.
 *    - Expired batches cannot be dispatched or sold.
 *    - Return quantities cannot exceed eligible dispatched/sold quantities.
 * 5. Production Error Hardening:
 *    - Standardized error format { success: false, error_code, message, details }.
 *    - Production mode strictly omits stack traces.
 * ============================================================================
 */

const http = require('http');
const app = require('../src/app');
const { connectAllDatabases, disconnectAllDatabases } = require('../src/config/database');
const { getWarehouseConnection } = require('../src/config/warehouseDatabase');
const { getPharmacyConnection } = require('../src/config/pharmacyDatabase');
const { getWarehouseModels } = require('../src/models/warehouse');
const { getPharmacyModels } = require('../src/models/pharmacy');

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

async function runE4TestSuite() {
  console.log('================================================================');
  console.log(' RUNNING ENGINE E4 AUTOMATED TEST SUITE: CONCURRENCY & QUALITY');
  console.log('================================================================');

  try {
    console.log('\n[Setup] Connecting to MongoDB Atlas & Initializing Test Server...');
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

    // -------------------------------------------------------------------------
    // TEST 1: High Concurrency Atomic Protection (Simultaneous Requests for Last 5 Units)
    // -------------------------------------------------------------------------
    console.log('\n[Test 1] Testing Concurrency: Two simultaneous requests for last 5 units...');

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

    // Seed a specific batch with EXACTLY 5 units in pharmacy inventory
    const concurBatch = await pModels.Batch.create({
      batch_id: `BAT-CONCUR-${testSuffix}`,
      batch_number: `BAT-CONCUR-${testSuffix}`,
      medicine: pMed._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2027-12-31'),
      isActive: true
    });

    const concurStock = await pModels.PharmacyStock.create({
      stock_id: `STK-CONCUR-${testSuffix}`,
      batch: concurBatch._id,
      quantity_on_hand: 5,
      version: 0
    });

    // Launch 2 simultaneous POST /api/pharmacy/sales requests for all 5 units
    const [resA, resB] = await Promise.all([
      request('/api/pharmacy/sales', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pToken}` },
        body: {
          items: [{ batch: concurBatch._id.toString(), quantity: 5, unit_price: 2.00 }],
          payment_method: 'CASH'
        }
      }),
      request('/api/pharmacy/sales', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pToken}` },
        body: {
          items: [{ batch: concurBatch._id.toString(), quantity: 5, unit_price: 2.00 }],
          payment_method: 'CASH'
        }
      })
    ]);

    console.log('resA:', resA.status, resA.data);
    console.log('resB:', resB.status, resB.data);
    const statuses = [resA.status, resB.status].sort();
    assert(statuses[0] === 201 && statuses[1] === 400, 'Exactly one request succeeds (201) and one is rejected (400)');

    const failureRes = resA.status === 400 ? resA : resB;
    assert(failureRes.data.error_code === 'INSUFFICIENT_STOCK', 'Rejected request returns error_code INSUFFICIENT_STOCK');

    // Verify database stock level
    const updatedConcurStock = await pModels.PharmacyStock.findById(concurStock._id);
    assert(updatedConcurStock.quantity_on_hand === 0, 'Final stock is exactly 0 units');
    assert(updatedConcurStock.quantity_on_hand >= 0, 'Stock NEVER became negative under concurrent race condition');

    // -------------------------------------------------------------------------
    // TEST 2: Transaction Rollback on Forced Failure
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Testing Transaction Rollback on Forced Failure during Dispatch...');

    let wMed = await wModels.Medicine.findOne({ medicine_id: 'MED-PCM-500' });
    let loc = await wModels.StorageLocation.findOne();
    if (!loc) {
      loc = await wModels.StorageLocation.create({ location_id: 'LOC-A-01', zone: 'A', rack_bin: 'R1' });
    }

    const rbBatch = await wModels.Batch.create({
      batch_id: `BAT-RB-${testSuffix}`,
      batch_number: `BAT-RB-${testSuffix}`,
      medicine: wMed._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2027-12-31'),
      isActive: true
    });

    const rbStock = await wModels.WarehouseStock.create({
      stock_id: `STK-RB-${testSuffix}`,
      batch: rbBatch._id,
      storage_location: loc._id,
      quantity_on_hand: 20,
      quantity_reserved: 10
    });

    let pharm = await wModels.Pharmacy.findOne();

    const rbSupplyRequest = await wModels.SupplyRequest.create({
      request_id: `REQ-RB-${testSuffix}`,
      pharmacy: pharm._id,
      status: 'PENDING'
    });

    const rbRequestItem = await wModels.RequestItem.create({
      request_item_id: `RQI-RB-${testSuffix}`,
      supply_request: rbSupplyRequest._id,
      medicine: wMed._id,
      quantity_requested: 10
    });

    // Create a transfer to dispatch
    const rbTransfer = await wModels.StockTransfer.create({
      transfer_id: `TRF-RB-${testSuffix}`,
      pharmacy: pharm._id,
      supply_request: rbSupplyRequest._id,
      status: 'PENDING'
    });

    await wModels.TransferItem.create({
      transfer_item_id: `TRI-RB-${testSuffix}-01`,
      stock_transfer: rbTransfer._id,
      request_item: rbRequestItem._id,
      batch: rbBatch._id,
      quantity_allocated: 10,
      quantity_dispatched: 10
    });

    // Execute dispatch with forced rollback trigger header
    const rbDispatchRes = await request(`/api/warehouse/transfers/${rbTransfer._id}/dispatch`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${wToken}`,
        'x-test-force-failure': 'dispatch_rollback'
      }
    });

    assert(rbDispatchRes.status >= 400, 'Forced failure request returns error status');

    // Check database state after transaction abort
    const postRbStock = await wModels.WarehouseStock.findById(rbStock._id);
    assert(postRbStock.quantity_on_hand === 20, 'Stock on hand remained untouched at 20 (rolled back)');

    const rbLedger = await wModels.TransactionLedger.findOne({ reference_id: rbTransfer.transfer_id });
    assert(!rbLedger, 'TransactionLedger row was rolled back and does not exist in DB');

    const postRbTransfer = await wModels.StockTransfer.findById(rbTransfer._id);
    assert(postRbTransfer.status === 'PENDING', 'StockTransfer status was rolled back to PENDING');

    // -------------------------------------------------------------------------
    // TEST 3: Idempotency Service (Key Replay & Request Hash Validation)
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Testing Idempotency Service & Payload Hash Validation...');

    const idempKey = `IDEMP-${testSuffix}-${Math.floor(Math.random() * 1000)}`;

    // Seed batch with 50 units for idempotency testing
    const idempBatch = await pModels.Batch.create({
      batch_id: `BAT-IDEMP-${testSuffix}`,
      batch_number: `BAT-IDEMP-${testSuffix}`,
      medicine: pMed._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2027-12-31'),
      isActive: true
    });
    await pModels.PharmacyStock.create({
      stock_id: `STK-IDEMP-${testSuffix}`,
      batch: idempBatch._id,
      quantity_on_hand: 50
    });

    const payloadA = {
      items: [{ batch: idempBatch._id.toString(), quantity: 5, unit_price: 3.00 }],
      payment_method: 'CASH'
    };

    // 3.1 First request with idempotency key
    const idempRes1 = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pToken}`,
        'Idempotency-Key': idempKey
      },
      body: payloadA
    });

    assert(idempRes1.status === 201, '1st request with Idempotency-Key succeeds (201 Created)');
    const originalSaleId = idempRes1.data.data.sale.sale_id;

    // 3.2 Second request with IDENTICAL key and payload (Safe Replay)
    const idempRes2 = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pToken}`,
        'Idempotency-Key': idempKey
      },
      body: payloadA
    });

    assert(idempRes2.status === 201, '2nd request with same Idempotency-Key returns cached response (201)');
    assert(idempRes2.data.data.sale.sale_id === originalSaleId, 'Replayed response returns identical original sale_id');
    assert(idempRes2.headers['x-idempotency-replay'] === 'true', 'Response includes X-Idempotency-Replay header');

    // Verify stock was only deducted ONCE (50 - 5 = 45)
    const checkIdempStock = await pModels.PharmacyStock.findOne({ batch: idempBatch._id });
    assert(checkIdempStock.quantity_on_hand === 45, 'Stock was deducted exactly once (45 remaining, not 40)');

    // 3.3 Third request reusing SAME key with a DIFFERENT payload (Tampering Prevention)
    const payloadB = {
      items: [{ batch: idempBatch._id.toString(), quantity: 20, unit_price: 3.00 }],
      payment_method: 'CARD'
    };

    const idempRes3 = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pToken}`,
        'Idempotency-Key': idempKey
      },
      body: payloadB
    });

    assert(idempRes3.status === 422 || idempRes3.status === 400, 'Reusing key with different payload is REJECTED');
    assert(idempRes3.data.error_code === 'IDEMPOTENCY_PAYLOAD_MISMATCH', 'Error code is IDEMPOTENCY_PAYLOAD_MISMATCH');

    // -------------------------------------------------------------------------
    // TEST 4: Shared Validation Layer
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Testing Shared Validation Layer...');

    // 4.1 Negative quantity rejected
    const negQtyRes = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pToken}` },
      body: {
        items: [{ batch: idempBatch._id.toString(), quantity: -5, unit_price: 3.00 }]
      }
    });
    assert(negQtyRes.status === 400, 'Negative quantity (-5) is rejected with 400 Bad Request');
    assert(negQtyRes.data.error_code === 'INVALID_QUANTITY', 'Error code is INVALID_QUANTITY for negative value');

    // 4.2 Non-numeric string quantity rejected
    const strQtyRes = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pToken}` },
      body: {
        items: [{ batch: idempBatch._id.toString(), quantity: 'abc', unit_price: 3.00 }]
      }
    });
    assert(strQtyRes.status === 400, 'Non-numeric quantity ("abc") is rejected with 400 Bad Request');
    assert(strQtyRes.data.error_code === 'INVALID_QUANTITY', 'Error code is INVALID_QUANTITY for "abc"');

    // 4.3 Expired batch rejected
    const expBatch = await pModels.Batch.create({
      batch_id: `BAT-EXP-V-${testSuffix}`,
      batch_number: `BAT-EXP-V-${testSuffix}`,
      medicine: pMed._id,
      manufacturing_date: new Date('2022-01-01'),
      expiry_date: new Date('2023-01-01'),
      isActive: true
    });
    await pModels.PharmacyStock.create({
      stock_id: `STK-EXP-V-${testSuffix}`,
      batch: expBatch._id,
      quantity_on_hand: 50
    });

    const expSaleRes = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pToken}` },
      body: {
        items: [{ batch: expBatch._id.toString(), quantity: 1 }]
      }
    });
    assert(expSaleRes.status === 400, 'Sale of expired batch is rejected with 400 Bad Request');
    assert(expSaleRes.data.error_code === 'EXPIRED_BATCH', 'Error code is EXPIRED_BATCH');

    // 4.4 Return limit exceeded rejected
    const dummySaleItem = await pModels.SaleItem.create({
      sale_item_id: `SLI-TEST-LIM-${testSuffix}`,
      sale: (await pModels.Sale.findOne())._id,
      batch: idempBatch._id,
      quantity: 10,
      unit_price: 3.00,
      subtotal: 30.00
    });

    const excessReturnRes = await request('/api/pharmacy/returns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pToken}` },
      body: {
        sale_item: dummySaleItem._id.toString(),
        quantity: 15,
        reason: 'Customer returned 15 units'
      }
    });
    assert(excessReturnRes.status === 400, 'Return quantity exceeding sold quantity (15 > 10) is rejected');
    assert(excessReturnRes.data.error_code === 'RETURN_LIMIT_EXCEEDED', 'Error code is RETURN_LIMIT_EXCEEDED');

    // 4.5 Invalid state transition rejected
    const dummySR = await wModels.SupplyRequest.create({
      request_id: `REQ-ST-${testSuffix}`,
      pharmacy: pharm._id,
      status: 'CREATED'
    });

    const badTransitionRes = await request(`/api/warehouse/supply-requests/${dummySR._id}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${wToken}` },
      body: { status: 'COMPLETED' }
    });
    assert(badTransitionRes.status === 409, 'Illegal order transition (CREATED -> COMPLETED) rejected with 409 Conflict');
    assert(badTransitionRes.data.error_code === 'INVALID_STATUS_TRANSITION' || badTransitionRes.data.error_code === 'CONFLICT', 'Transition error code returned');

    // -------------------------------------------------------------------------
    // TEST 5: Production Error Hardening (Stack Traces Strictly Stripped)
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Testing Production Error Hardening (No Stack Traces in Production)...');

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const prodErrRes = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pToken}` },
      body: { items: [{ batch: idempBatch._id.toString(), quantity: -10 }] }
    });

    assert(prodErrRes.status === 400, 'Error returned with standard status');
    assert(prodErrRes.data.success === false, 'success is false in standardized error');
    assert(prodErrRes.data.error_code !== undefined, 'error_code is present in response');
    assert(prodErrRes.data.message !== undefined, 'message is present in response');
    assert(prodErrRes.data.details !== undefined, 'details field is present in response');
    assert(prodErrRes.data.stack === undefined, 'stack trace is strictly omitted in production mode');

    process.env.NODE_ENV = originalEnv;

    console.log('\n================================================================');
    console.log(` ALL ${totalPassed}/${totalPassed + totalFailed} ENGINE E4 TESTS PASSED SUCCESSFULLY! ✓`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n✗ Test Suite Encountered an Error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await disconnectAllDatabases();
    console.log('[Database] All database connections terminated.');
  }
}

runE4TestSuite();
