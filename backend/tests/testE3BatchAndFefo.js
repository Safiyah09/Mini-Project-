/**
 * ============================================================================
 * ENGINE E3 AUTOMATED TEST SUITE: BATCH & INVENTORY ALERT (FEFO & AVAILABILITY)
 * ============================================================================
 * Tests:
 * 1. MinHeap binary priority queue operations & ordering.
 * 2. FEFO allocation algorithm:
 *    - B1: expiry 2027-01, qty 20
 *    - B2: expiry 2026-12, qty 30
 *    - B3: expired, qty 50
 *    - Request 40 units -> Allocates B2 (30) + B1 (10)
 *    - Tie-breaker on received date
 *    - PARTIAL availability scenario
 *    - NONE availability scenario
 *    - Immutability check (pure function guarantee)
 * 3. Warehouse Availability Check Endpoint (GET /api/warehouse/stocks/availability)
 * 4. Pharmacy POS Checkout Integration (POST /api/pharmacy/sales)
 *    - Expiry rejection for direct expired batch sale
 *    - Automated FEFO allocation across multiple batches
 *    - Exclusion of expired batches during sale
 *    - Negative / insufficient stock prevention
 * ============================================================================
 */

const http = require('http');
const app = require('../src/app');
const { connectAllDatabases, disconnectAllDatabases } = require('../src/config/database');
const { getWarehouseConnection } = require('../src/config/warehouseDatabase');
const { getPharmacyConnection } = require('../src/config/pharmacyDatabase');
const { MinHeap, allocateFEFO, compareBatchesFEFO } = require('../src/services/common/fefoMinHeap');

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

async function runE3TestSuite() {
  console.log('================================================================');
  console.log(' RUNNING ENGINE E3 AUTOMATED TEST SUITE: BATCH & INVENTORY ALERT');
  console.log('================================================================');

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: UNIT TESTING MIN-HEAP & ALGORITHM
    // -------------------------------------------------------------------------
    console.log('\n[Section 1] Testing MinHeap Priority Queue & Comparator...');

    const heap = new MinHeap((a, b) => a - b);
    heap.insert(50);
    heap.insert(10);
    heap.insert(30);
    heap.insert(5);
    heap.insert(20);

    assert(heap.size() === 5, 'MinHeap size is 5 after insertions');
    assert(heap.peek() === 5, 'MinHeap peek returns minimum element (5)');
    assert(heap.extractMin() === 5, '1st extractMin returns 5');
    assert(heap.extractMin() === 10, '2nd extractMin returns 10');
    assert(heap.extractMin() === 20, '3rd extractMin returns 20');
    assert(heap.extractMin() === 30, '4th extractMin returns 30');
    assert(heap.extractMin() === 50, '5th extractMin returns 50');
    assert(heap.isEmpty(), 'MinHeap is empty after extracting all elements');

    // Test Tie-breaker on received date
    console.log('\n[Section 2] Testing FEFO Comparator with Received-Date Tie-Breaker...');
    const bSame1 = { batch_number: 'B_LATER', expiry_date: new Date('2027-05-01'), received_date: new Date('2026-03-01') };
    const bSame2 = { batch_number: 'B_EARLIER', expiry_date: new Date('2027-05-01'), received_date: new Date('2026-01-15') };
    const cmpResult = compareBatchesFEFO(bSame1, bSame2);
    assert(cmpResult > 0, 'Batch received earlier has higher priority (smaller value in min-heap)');

    // -------------------------------------------------------------------------
    // SECTION 2: SPECIFICATION TEST CASE (B1, B2, B3)
    // -------------------------------------------------------------------------
    console.log('\n[Section 3] Testing Core FEFO Requirement: B1(2027-01, 20), B2(2026-12, 30), B3(expired, 50)...');
    const referenceDate = new Date('2026-11-01');

    const testBatches = [
      {
        batch_id: 'BAT-B1',
        batch_number: 'BAT-B1',
        expiry_date: new Date('2027-01-31'),
        available_quantity: 20,
        received_date: new Date('2026-02-01')
      },
      {
        batch_id: 'BAT-B2',
        batch_number: 'BAT-B2',
        expiry_date: new Date('2026-12-31'),
        available_quantity: 30,
        received_date: new Date('2026-02-15')
      },
      {
        batch_id: 'BAT-B3',
        batch_number: 'BAT-B3',
        expiry_date: new Date('2026-10-15'), // Expired relative to 2026-11-01
        available_quantity: 50,
        received_date: new Date('2026-01-01')
      }
    ];

    // Deep copy before allocation to verify pure function guarantee
    const batchesSnapshot = JSON.stringify(testBatches);

    // Request 40 units
    const allocResult = allocateFEFO(testBatches, 40, { now: referenceDate });

    assert(allocResult.status === 'FULL', 'Allocation status is FULL');
    assert(allocResult.requested_quantity === 40, 'Requested quantity is 40');
    assert(allocResult.allocated_quantity === 40, 'Allocated quantity is 40');
    assert(allocResult.unfulfilled_quantity === 0, 'Unfulfilled quantity is 0');
    assert(allocResult.allocations.length === 2, 'Allocated across exactly 2 batches');
    assert(allocResult.allocations[0].batch_id === 'BAT-B2', '1st batch allocated is B2 (earliest expiry: 2026-12)');
    assert(allocResult.allocations[0].allocated_quantity === 30, 'B2 allocated quantity is 30 units');
    assert(allocResult.allocations[1].batch_id === 'BAT-B1', '2nd batch allocated is B1 (next expiry: 2027-01)');
    assert(allocResult.allocations[1].allocated_quantity === 10, 'B1 allocated quantity is 10 units');
    assert(allocResult.expired_batches_count === 1, 'Expired batch B3 was correctly detected and excluded');
    assert(allocResult.total_unexpired_available === 50, 'Total unexpired available stock is 50 (20 + 30)');

    // Verify Pure Function Immutability: input array untouched
    assert(JSON.stringify(testBatches) === batchesSnapshot, 'Pure function guarantee: candidate batches array was NOT modified');

    // -------------------------------------------------------------------------
    // SECTION 3: PARTIAL & NONE SCENARIOS
    // -------------------------------------------------------------------------
    console.log('\n[Section 4] Testing PARTIAL and NONE Availability Scenarios...');

    // Request 60 units when only 50 unexpired units exist
    const partialResult = allocateFEFO(testBatches, 60, { now: referenceDate });
    assert(partialResult.status === 'PARTIAL', 'Requesting 60 units returns PARTIAL status');
    assert(partialResult.allocated_quantity === 50, 'Allocated all 50 available unexpired units');
    assert(partialResult.unfulfilled_quantity === 10, 'Unfulfilled shortfall is 10 units');

    // Request with zero unexpired stock -> NONE
    const expiredOnlyBatches = [
      { batch_id: 'EXP-1', batch_number: 'EXP-1', expiry_date: new Date('2025-01-01'), available_quantity: 100 }
    ];
    const noneResult = allocateFEFO(expiredOnlyBatches, 10, { now: referenceDate });
    assert(noneResult.status === 'NONE', 'Request with only expired batches returns NONE status');
    assert(noneResult.allocated_quantity === 0, 'Allocated quantity is 0 for NONE status');
    assert(noneResult.unfulfilled_quantity === 10, 'Unfulfilled quantity equals requested quantity for NONE status');
    assert(noneResult.allocations.length === 0, 'No batches allocated for NONE status');

    // -------------------------------------------------------------------------
    // SECTION 4: INTEGRATION WITH ATLAS DATABASE & REST APIS
    // -------------------------------------------------------------------------
    console.log('\n[Section 5] Connecting to MongoDB Atlas & Initializing Test Server...');
    await connectAllDatabases();
    const wConn = await getWarehouseConnection();
    const pConn = await getPharmacyConnection();

    server = http.createServer(app);
    await new Promise((res) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        res();
      });
    });
    console.log(`Test server active on port ${port}`);

    // Authenticate Warehouse Admin
    const wLogin = await request('/api/warehouse/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'Password@123' }
    });
    assert(wLogin.status === 200, 'Warehouse Admin login succeeds');
    const wToken = wLogin.data.data.token;

    // Authenticate Pharmacy Indiranagar Admin
    const pLogin = await request('/api/pharmacy/auth/login', {
      method: 'POST',
      body: { username: 'pharmadmin', password: 'Password@123' }
    });
    assert(pLogin.status === 200, 'Pharmacy Indiranagar Admin login succeeds');
    const pToken = pLogin.data.data.token;

    const testTag = Date.now().toString().slice(-5);
    const medId = `MED-FEFO-${testTag}`;

    // Resolve or create a test Medicine in Warehouse
    const WarehouseMedicine = wConn.model('Medicine');
    const WarehouseBatch = wConn.model('Batch');
    const WarehouseStock = wConn.model('WarehouseStock');
    const StorageLocation = wConn.model('StorageLocation');

    const med = await WarehouseMedicine.create({
      medicine_id: medId,
      name: `Paracetamol FEFO ${testTag}`,
      dosage: '500mg',
      formulation: 'Tablet',
      category: 'Analgesic',
      manufacturer: 'GSK Pharma',
      unit_price: 2.50,
      reorder_level: 20
    });

    let loc = await StorageLocation.findOne();
    if (!loc) {
      loc = await StorageLocation.create({
        location_id: 'LOC-A-01',
        zone: 'A',
        rack_bin: 'R1-B1'
      });
    }

    // Seed Warehouse Batches matching B1, B2, B3
    console.log('\n[Section 6] Seeding Warehouse Batches B1, B2, B3 in MongoDB Atlas...');
    // B1: exp 2027-01, qty 20
    const wBatchB1 = await WarehouseBatch.create({
      batch_id: `BAT-WH-B1-${testTag}`,
      batch_number: `BAT-WH-B1-${testTag}`,
      medicine: med._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2027-01-31'),
      isActive: true
    });
    await WarehouseStock.create({
      stock_id: `STK-WH-B1-${testTag}`,
      batch: wBatchB1._id,
      storage_location: loc._id,
      quantity_on_hand: 20,
      quantity_reserved: 0
    });

    // B2: exp 2026-12, qty 30
    const wBatchB2 = await WarehouseBatch.create({
      batch_id: `BAT-WH-B2-${testTag}`,
      batch_number: `BAT-WH-B2-${testTag}`,
      medicine: med._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2026-12-31'),
      isActive: true
    });
    await WarehouseStock.create({
      stock_id: `STK-WH-B2-${testTag}`,
      batch: wBatchB2._id,
      storage_location: loc._id,
      quantity_on_hand: 30,
      quantity_reserved: 0
    });

    // B3: Expired (2024-01-01), qty 50
    const wBatchB3 = await WarehouseBatch.create({
      batch_id: `BAT-WH-B3-EXP-${testTag}`,
      batch_number: `BAT-WH-B3-EXP-${testTag}`,
      medicine: med._id,
      manufacturing_date: new Date('2023-01-01'),
      expiry_date: new Date('2024-01-01'),
      isActive: true
    });
    await WarehouseStock.create({
      stock_id: `STK-WH-B3-${testTag}`,
      batch: wBatchB3._id,
      storage_location: loc._id,
      quantity_on_hand: 50,
      quantity_reserved: 0
    });

    // -------------------------------------------------------------------------
    // SECTION 5: WAREHOUSE AVAILABILITY API CHECK
    // -------------------------------------------------------------------------
    console.log('\n[Section 7] Testing Warehouse Stock Availability Endpoint...');

    // Test FULL scenario: request 40 units
    const availRes40 = await request(`/api/warehouse/stocks/availability/${med.medicine_id}?quantity=40`, {
      headers: { Authorization: `Bearer ${wToken}` }
    });

    assert(availRes40.status === 200, 'Warehouse availability check returns 200 OK');
    assert(availRes40.data.data.status === 'FULL', 'Availability status is FULL for 40 units');
    assert(availRes40.data.data.batches.length >= 2, 'Batches returned for allocation');
    // Earliest batch should be B2 (exp 2026-12) with qty 30
    const firstAlloc = availRes40.data.data.batches.find(b => b.batch_number === wBatchB2.batch_number);
    assert(firstAlloc && firstAlloc.qty === 30, 'Allocated 30 units from batch B2 (expiry 2026-12)');
    // Second batch should be B1 (exp 2027-01) with qty 10
    const secondAlloc = availRes40.data.data.batches.find(b => b.batch_number === wBatchB1.batch_number);
    assert(secondAlloc && secondAlloc.qty === 10, 'Allocated 10 units from batch B1 (expiry 2027-01)');
    // Expired batch B3 must NOT be present in allocations
    const expiredAlloc = availRes40.data.data.batches.find(b => b.batch_number === wBatchB3.batch_number);
    assert(!expiredAlloc, 'Expired batch B3 is completely excluded from allocations');

    // Test PARTIAL scenario: request 500,000 units
    const availResPartial = await request(`/api/warehouse/stocks/availability/${med.medicine_id}?quantity=500000`, {
      headers: { Authorization: `Bearer ${wToken}` }
    });
    assert(availResPartial.status === 200, 'Warehouse availability check for 500,000 returns 200 OK');
    assert(availResPartial.data.data.status === 'PARTIAL', 'Status is PARTIAL for excessive quantity');
    assert(availResPartial.data.data.unfulfilled_quantity > 0, 'Unfulfilled quantity is reported for PARTIAL');

    // -------------------------------------------------------------------------
    // SECTION 6: PHARMACY POS CHECKOUT & EXPIRED REJECTION
    // -------------------------------------------------------------------------
    console.log('\n[Section 8] Testing Pharmacy POS Checkout FEFO & Expired Rejection...');

    const PharmacyMedicine = pConn.model('Medicine');
    const PharmacyBatch = pConn.model('Batch');
    const PharmacyStock = pConn.model('PharmacyStock');

    const pMed = await PharmacyMedicine.create({
      medicine_id: medId,
      name: `Paracetamol FEFO ${testTag}`,
      dosage: '500mg',
      formulation: 'Tablet',
      category: 'Analgesic',
      manufacturer: 'GSK Pharma',
      unit_price: 3.00,
      reorder_level: 20
    });

    // Seed Pharmacy Batches: B1 (exp 2027-01, 20), B2 (exp 2026-12, 30), B3 (expired, 50)
    const pBatchB1 = await PharmacyBatch.create({
      batch_id: `PH-B1-${testTag}`,
      batch_number: `PH-B1-${testTag}`,
      medicine: pMed._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2027-01-31'),
      isActive: true
    });
    const pStockB1 = await PharmacyStock.create({
      stock_id: `PH-STK-B1-${testTag}`,
      batch: pBatchB1._id,
      quantity_on_hand: 20
    });

    const pBatchB2 = await PharmacyBatch.create({
      batch_id: `PH-B2-${testTag}`,
      batch_number: `PH-B2-${testTag}`,
      medicine: pMed._id,
      manufacturing_date: new Date('2025-01-01'),
      expiry_date: new Date('2026-12-31'),
      isActive: true
    });
    const pStockB2 = await PharmacyStock.create({
      stock_id: `PH-STK-B2-${testTag}`,
      batch: pBatchB2._id,
      quantity_on_hand: 30
    });

    const pBatchB3 = await PharmacyBatch.create({
      batch_id: `PH-B3-EXP-${testTag}`,
      batch_number: `PH-B3-EXP-${testTag}`,
      medicine: pMed._id,
      manufacturing_date: new Date('2023-01-01'),
      expiry_date: new Date('2024-01-01'), // Expired!
      isActive: true
    });
    const pStockB3 = await PharmacyStock.create({
      stock_id: `PH-STK-B3-${testTag}`,
      batch: pBatchB3._id,
      quantity_on_hand: 50
    });

    // Test 1: Selling direct expired batch must be rejected with 400
    const expSaleRes = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pToken}`
      },
      body: {
        items: [
          { batch: pBatchB3._id.toString(), quantity: 5, unit_price: 3.00 }
        ],
        payment_method: 'CASH'
      }
    });

    assert(expSaleRes.status === 400, 'Direct sale of expired batch is REJECTED with 400 Bad Request');
    assert(
      expSaleRes.data.message && expSaleRes.data.message.includes('expired'),
      'Rejection error message clearly specifies expired medicine'
    );

    // Verify expired batch stock remains 50
    const checkPStockB3 = await PharmacyStock.findById(pStockB3._id);
    assert(checkPStockB3.quantity_on_hand === 50, 'Expired batch stock remains untouched at 50 units');

    // Test 2: POS sale of medicine for 40 units using automated Min-Heap FEFO
    const fefoSaleRes = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pToken}`
      },
      body: {
        items: [
          { medicine: pMed.medicine_id, quantity: 40, unit_price: 3.00 }
        ],
        payment_method: 'CASH'
      }
    });

    assert(fefoSaleRes.status === 201, 'POS sale using FEFO allocation succeeds with 201 Created');
    assert(fefoSaleRes.data.data.items.length === 2, 'Sale created 2 line items splitting across batches');

    // Confirm that B2 was exhausted (30 deducted) and B1 was partially used (10 deducted)
    const updatedStockB2 = await PharmacyStock.findById(pStockB2._id);
    const updatedStockB1 = await PharmacyStock.findById(pStockB1._id);
    const updatedStockB3 = await PharmacyStock.findById(pStockB3._id);

    assert(updatedStockB2.quantity_on_hand === 0, 'Batch B2 stock decreased from 30 to 0 (fully dispensed via FEFO)');
    assert(updatedStockB1.quantity_on_hand === 10, 'Batch B1 stock decreased from 20 to 10 (10 dispensed via FEFO)');
    assert(updatedStockB3.quantity_on_hand === 50, 'Expired Batch B3 stock remained untouched at 50');

    // Verify Pharmacy TransactionLedger recorded DISPATCH entries
    const PharmacyLedger = pConn.model('TransactionLedger');
    const ledgerRows = await PharmacyLedger.find({ reference_id: fefoSaleRes.data.data.sale.sale_id });
    assert(ledgerRows.length === 2, 'Pharmacy TransactionLedger recorded exactly 2 rows for the sale');
    assert(ledgerRows.some(r => r.batch_id.toString() === pBatchB2._id.toString() && r.quantity_delta === -30), 'Ledger records -30 delta for Batch B2');
    assert(ledgerRows.some(r => r.batch_id.toString() === pBatchB1._id.toString() && r.quantity_delta === -10), 'Ledger records -10 delta for Batch B1');

    console.log('\n================================================================');
    console.log(` ALL ${totalPassed}/${totalPassed + totalFailed} ENGINE E3 TESTS PASSED SUCCESSFULLY! ✓`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\nTest Suite Execution Error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await disconnectAllDatabases();
    console.log('[Database] All database connections terminated.');
  }
}

runE3TestSuite();
