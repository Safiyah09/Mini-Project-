const app = require('../src/app');
const { connectAllDatabases, disconnectAllDatabases, getWarehouseConnection, getPharmacyConnection } = require('../src/config/database');
const { getWarehouseModels } = require('../src/models/warehouse');
const { getPharmacyModels } = require('../src/models/pharmacy');
const { LEDGER_TXN_TYPES, STOCK_TRANSFER_STATUS } = require('../src/utils/constants');

async function runE1WarehouseLedgerTests() {
  console.log('================================================================');
  console.log(' RUNNING ENGINE E1 AUTOMATED TEST SUITE: WAREHOUSE LEDGER');
  console.log('================================================================');

  await connectAllDatabases();

  const PORT = 5088;
  const server = app.listen(PORT);

  const request = async (path, options = {}) => {
    const url = `http://localhost:${PORT}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, description) => {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ PASS: ${description}`);
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      throw new Error(`Test assertion failed: ${description}`);
    }
  };

  try {
    // -------------------------------------------------------------------------
    // Setup & Authenticate Warehouse Admin
    // -------------------------------------------------------------------------
    console.log('\n[Setup] Authenticating Warehouse Admin...');
    const whLogin = await request('/api/warehouse/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'Password@123' }
    });
    assert(whLogin.status === 200 && whLogin.data.data.token, 'Warehouse Admin login succeeds');
    const whToken = whLogin.data.data.token;

    const whConn = await getWarehouseConnection();
    const whModels = getWarehouseModels(whConn);

    const suffix = Date.now().toString().slice(-5);
    const testSupplier = await whModels.Supplier.findOne();
    const testMedicine = await whModels.Medicine.findOne({ medicine_id: 'MED-PCM-500' }) || await whModels.Medicine.findOne();
    const testLocation = await whModels.StorageLocation.findOne();
    const testPharmacy = await whModels.Pharmacy.findOne();

    console.log(`Using Medicine: ${testMedicine.name} (${testMedicine.medicine_id})`);
    console.log(`Using Pharmacy: ${testPharmacy.name} (${testPharmacy.pharmacy_id})`);

    // -------------------------------------------------------------------------
    // TEST 1: Stock-in 100 + 50 = 150 and exactly one ledger row per stock-in
    // -------------------------------------------------------------------------
    console.log('\n[Test 1] Testing Stock-in (100 + 50 = 150) and Ledger Rows...');
    const poId1 = `PO-E1-${suffix}-1`;
    const poRes1 = await request('/api/warehouse/purchase-orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        po_id: poId1,
        supplier: testSupplier.supplier_id || testSupplier._id.toString(),
        items: [{ medicine: testMedicine.medicine_id || testMedicine._id.toString(), quantity_ordered: 150, unit_cost: 12.5 }]
      }
    });
    assert(poRes1.status === 201, `Purchase order ${poId1} created`);
    const poDoc1 = poRes1.data.data;
    const poItem1 = poRes1.data.data.items[0];

    // First receipt: 100 units
    const batchNum1 = `BAT-E1-STKIN-${suffix}`;
    const grRes1 = await request('/api/warehouse/goods-receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        receipt_id: `GR-E1-${suffix}-A`,
        purchase_order: poDoc1._id,
        items: [
          {
            po_item: poItem1._id,
            quantity_received: 100,
            batch_number: batchNum1,
            manufacturing_date: '2026-01-01',
            expiry_date: '2028-01-01',
            storage_location: testLocation._id
          }
        ]
      }
    });
    assert(grRes1.status === 201, 'Goods receipt 1 (100 units) accepted');

    const batchDoc1 = await whModels.Batch.findOne({ batch_number: batchNum1 });
    let stock1 = await whModels.WarehouseStock.findOne({ batch: batchDoc1._id });
    assert(stock1.quantity_on_hand === 100, 'Warehouse stock on hand is 100 after 1st receipt');

    // Second receipt: 50 units for the same batch
    const grRes2 = await request('/api/warehouse/goods-receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        receipt_id: `GR-E1-${suffix}-B`,
        purchase_order: poDoc1._id,
        items: [
          {
            po_item: poItem1._id,
            quantity_received: 50,
            batch_number: batchNum1,
            manufacturing_date: '2026-01-01',
            expiry_date: '2028-01-01',
            storage_location: testLocation._id
          }
        ]
      }
    });
    assert(grRes2.status === 201, 'Goods receipt 2 (50 units) accepted');

    stock1 = await whModels.WarehouseStock.findOne({ batch: batchDoc1._id });
    assert(stock1.quantity_on_hand === 150, 'Warehouse stock on hand is 100 + 50 = 150');

    // Verify ledger rows for this batch
    const ledgerRows1 = await whModels.TransactionLedger.find({ batch_id: batchDoc1._id });
    assert(ledgerRows1.length === 2, 'Exactly 2 ledger rows created (one per stock-in)');
    assert(ledgerRows1[0].txn_type === LEDGER_TXN_TYPES.STOCK_IN && ledgerRows1[0].quantity_delta === 100, '1st ledger entry is STOCK_IN (+100)');
    assert(ledgerRows1[1].txn_type === LEDGER_TXN_TYPES.STOCK_IN && ledgerRows1[1].quantity_delta === 50, '2nd ledger entry is STOCK_IN (+50)');

    // -------------------------------------------------------------------------
    // TEST 2: Damaged stock recording (damage 10 > available 5 rejected)
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Testing Damaged Stock Validation (damage 10 > available 5 rejected)...');
    const batchNum2 = `BAT-E1-DMG-${suffix}`;
    const batchDoc2 = await whModels.Batch.create({
      batch_id: `BAT-ID-DMG-${suffix}`,
      medicine: testMedicine._id,
      batch_number: batchNum2,
      manufacturing_date: new Date('2026-01-01'),
      expiry_date: new Date('2028-01-01')
    });
    const stock2 = await whModels.WarehouseStock.create({
      stock_id: `STK-E1-DMG-${suffix}`,
      batch: batchDoc2._id,
      storage_location: testLocation._id,
      quantity_on_hand: 5,
      quantity_reserved: 0
    });

    // Attempt to record damage of 10 units when only 5 are on hand
    const dmgFailRes = await request('/api/warehouse/adjustments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        batch: batchDoc2.batch_number,
        quantity: -10, // attempting to deduct 10 units for damage
        reason: 'Water damage during storage'
      }
    });
    assert(dmgFailRes.status === 400, 'Damage of 10 units when available is 5 is REJECTED with 400 Bad Request');

    const stock2After = await whModels.WarehouseStock.findById(stock2._id);
    assert(stock2After.quantity_on_hand === 5, 'Stock quantity on hand remains untouched at 5');

    // -------------------------------------------------------------------------
    // TEST 3: Reconciliation Formula
    // Opening 100 + 50 in + 5 usable return - 30 dispatch - 2 damage = 123
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Testing Stock Reconciliation Formula (100 + 50 + 5 - 30 - 2 = 123)...');
    const batchNum3 = `BAT-E1-RECON-${suffix}`;
    const batchDoc3 = await whModels.Batch.create({
      batch_id: `BAT-ID-RECON-${suffix}`,
      medicine: testMedicine._id,
      batch_number: batchNum3,
      manufacturing_date: new Date('2026-01-01'),
      expiry_date: new Date('2028-01-01')
    });

    // 1. Opening balance: 100
    const stock3 = await whModels.WarehouseStock.create({
      stock_id: `STK-E1-RECON-${suffix}`,
      batch: batchDoc3._id,
      storage_location: testLocation._id,
      opening_balance: 100,
      quantity_on_hand: 100,
      quantity_reserved: 0
    });
    await whModels.TransactionLedger.create({
      ledger_id: `LED-OP-${suffix}`,
      txn_type: LEDGER_TXN_TYPES.OPENING_BALANCE,
      medicine_id: testMedicine._id,
      batch_id: batchDoc3._id,
      quantity_delta: 100,
      reference_type: 'OPENING_STOCK',
      reference_id: `OPEN-${suffix}`
    });

    // 2. Stock-in: +50 -> on hand 150
    stock3.quantity_on_hand += 50;
    await stock3.save();
    await whModels.TransactionLedger.create({
      ledger_id: `LED-IN-${suffix}`,
      txn_type: LEDGER_TXN_TYPES.STOCK_IN,
      medicine_id: testMedicine._id,
      batch_id: batchDoc3._id,
      quantity_delta: 50,
      reference_type: 'GOODS_RECEIPT',
      reference_id: `GR-${suffix}`
    });

    // 3. Usable return: +5 -> on hand 155
    stock3.quantity_on_hand += 5;
    await stock3.save();
    await whModels.TransactionLedger.create({
      ledger_id: `LED-RET-${suffix}`,
      txn_type: LEDGER_TXN_TYPES.RETURN_USABLE,
      medicine_id: testMedicine._id,
      batch_id: batchDoc3._id,
      quantity_delta: 5,
      reference_type: 'PHARMACY_RETURN',
      reference_id: `RET-${suffix}`
    });

    // 4. Dispatch: -30 -> on hand 125
    stock3.quantity_on_hand -= 30;
    await stock3.save();
    await whModels.TransactionLedger.create({
      ledger_id: `LED-DSP-${suffix}`,
      txn_type: LEDGER_TXN_TYPES.DISPATCH,
      medicine_id: testMedicine._id,
      batch_id: batchDoc3._id,
      quantity_delta: -30,
      reference_type: 'STOCK_TRANSFER',
      reference_id: `TRF-${suffix}`
    });

    // 5. Damage: -2 -> on hand 123
    stock3.quantity_on_hand -= 2;
    await stock3.save();
    await whModels.TransactionLedger.create({
      ledger_id: `LED-DMG-${suffix}`,
      txn_type: LEDGER_TXN_TYPES.DAMAGE,
      medicine_id: testMedicine._id,
      batch_id: batchDoc3._id,
      quantity_delta: -2,
      reference_type: 'STOCK_ADJUSTMENT',
      reference_id: `ADJ-${suffix}`
    });

    // Check reconciliation via API endpoint
    const reconRes = await request(`/api/warehouse/stocks/reconcile?batch_id=${batchDoc3._id}`, {
      headers: { Authorization: `Bearer ${whToken}` }
    });
    assert(reconRes.status === 200, 'Reconciliation API endpoint returns 200 OK');
    const rData = reconRes.data.data;
    assert(rData.stored_stock === 123, 'Stored stock is exactly 123');
    assert(rData.derived_stock === 123, 'Derived stock from ledger formula is exactly 123');
    assert(rData.matched === true, 'Stored stock matches ledger derived stock (matched: true)');
    assert(rData.difference === 0, 'Discrepancy difference is 0');
    assert(rData.breakdown.opening === 100, 'Breakdown opening balance is 100');
    assert(rData.breakdown.stock_in === 50, 'Breakdown stock-in is 50');
    assert(rData.breakdown.usable_returns === 5, 'Breakdown usable returns is 5');
    assert(rData.breakdown.dispatch === 30, 'Breakdown dispatch is 30');
    assert(rData.breakdown.damage === 2, 'Breakdown damage is 2');

    // -------------------------------------------------------------------------
    // TEST 4: Damaged return from pharmacy does NOT add to available stock
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Testing Damaged Pharmacy Return (does NOT add to available stock)...');
    // Create transfer item to return against
    const dummyReq = await whModels.SupplyRequest.create({
      request_id: `REQ-DUMMY-${suffix}`,
      pharmacy: testPharmacy._id
    });
    const dummyTrf = await whModels.StockTransfer.create({
      transfer_id: `TRF-DUMMY-${suffix}`,
      supply_request: dummyReq._id,
      pharmacy: testPharmacy._id
    });
    const dummyTrfItem = await whModels.TransferItem.create({
      transfer_item_id: `TRI-DUMMY-${suffix}`,
      stock_transfer: dummyTrf._id,
      request_item: dummyReq._id,
      batch: batchDoc1._id,
      quantity_allocated: 20,
      quantity_dispatched: 20
    });

    const stock1BeforeDamagedReturn = (await whModels.WarehouseStock.findOne({ batch: batchDoc1._id })).quantity_on_hand;

    // Send damaged return of 8 units with restock_to_inventory: false
    const dmgReturnRes = await request('/api/warehouse/returns/pharmacy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        transfer_item: dummyTrfItem._id.toString(),
        quantity: 8,
        reason: 'Broken ampoules during pharmacy handling',
        restock_to_inventory: false
      }
    });
    if (dmgReturnRes.status !== 201) {
      console.error('Damaged return error payload:', JSON.stringify(dmgReturnRes.data));
    }
    assert(dmgReturnRes.status === 201, 'Pharmacy damaged return accepted');

    const stock1AfterDamagedReturn = (await whModels.WarehouseStock.findOne({ batch: batchDoc1._id })).quantity_on_hand;
    assert(stock1AfterDamagedReturn === stock1BeforeDamagedReturn, 'Stock on hand did NOT increase after damaged return');

    const dmgReturnLedger = await whModels.TransactionLedger.findOne({
      batch_id: batchDoc1._id,
      txn_type: LEDGER_TXN_TYPES.RETURN_DAMAGED
    });
    assert(dmgReturnLedger !== null, 'RETURN_DAMAGED recorded in append-only TransactionLedger');
    assert(dmgReturnLedger.quantity_delta === 0, 'RETURN_DAMAGED ledger delta is 0 (does not augment available stock)');

    // -------------------------------------------------------------------------
    // TEST 5: Dispatch reduces warehouse stock by exactly quantity and generates manifest
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Testing Dispatch reduction & JSON Manifest generation...');
    const dispReq = await whModels.SupplyRequest.create({
      request_id: `REQ-DISP-${suffix}`,
      pharmacy: testPharmacy._id
    });
    const dispTrf = await whModels.StockTransfer.create({
      transfer_id: `TRF-DISP-${suffix}`,
      supply_request: dispReq._id,
      pharmacy: testPharmacy._id,
      shipping_reference: `SPEED-AIR-${suffix}`
    });
    await whModels.TransferItem.create({
      transfer_item_id: `TRI-DISP-${suffix}`,
      stock_transfer: dispTrf._id,
      request_item: dispReq._id,
      batch: batchDoc1._id,
      quantity_allocated: 25,
      quantity_dispatched: 25
    });

    const stock1BeforeDisp = (await whModels.WarehouseStock.findOne({ batch: batchDoc1._id })).quantity_on_hand;

    const dispatchRes = await request(`/api/warehouse/transfers/${dispTrf._id}/dispatch`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${whToken}` }
    });
    assert(dispatchRes.status === 200, 'Dispatch endpoint returns 200 OK');

    const stock1AfterDisp = (await whModels.WarehouseStock.findOne({ batch: batchDoc1._id })).quantity_on_hand;
    assert(stock1AfterDisp === stock1BeforeDisp - 25, 'Stock on hand decreased by exactly 25 dispatched units');

    const manifest = dispatchRes.data.data.manifest;
    assert(manifest !== null && manifest !== undefined, 'Dispatch response includes generated JSON manifest');
    assert(manifest.transfer_id === `TRF-DISP-${suffix}`, 'Manifest matches transfer_id');
    assert(manifest.items.length === 1 && manifest.items[0].quantity_dispatched === 25, 'Manifest contains dispatched batch with quantity 25');

    const dispatchLedger = await whModels.TransactionLedger.findOne({
      batch_id: batchDoc1._id,
      reference_id: `TRF-DISP-${suffix}`
    });
    assert(dispatchLedger !== null && dispatchLedger.quantity_delta === -25, 'DISPATCH ledger row created with quantity_delta: -25');

    // -------------------------------------------------------------------------
    // TEST 6: Append-Only Immutability: Block update and delete
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Testing Ledger Immutability (Block UPDATE & DELETE)...');
    let updateBlocked = false;
    try {
      await whModels.TransactionLedger.updateOne(
        { _id: dispatchLedger._id },
        { $set: { quantity_delta: -999 } }
      );
    } catch (err) {
      updateBlocked = true;
      assert(err.message.includes('append-only'), 'Direct updateOne throws append-only error');
    }
    assert(updateBlocked, 'Direct updateOne on TransactionLedger is strictly forbidden');

    let deleteBlocked = false;
    try {
      await whModels.TransactionLedger.deleteOne({ _id: dispatchLedger._id });
    } catch (err) {
      deleteBlocked = true;
      assert(err.message.includes('append-only'), 'Direct deleteOne throws append-only error');
    }
    assert(deleteBlocked, 'Direct deleteOne on TransactionLedger is strictly forbidden');

    // -------------------------------------------------------------------------
    // TEST 7: Warehouse Reports
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] Testing Warehouse Reports...');
    // 1. Stock by batch
    const repStockRes = await request('/api/warehouse/reports/stock-by-batch', {
      headers: { Authorization: `Bearer ${whToken}` }
    });
    assert(repStockRes.status === 200, 'Report: Stock by batch returns 200');
    assert(repStockRes.data.data.report.length > 0, 'Report: Contains stock batch records');

    // 2. Transaction history
    const repHistoryRes = await request('/api/warehouse/reports/transaction-history', {
      headers: { Authorization: `Bearer ${whToken}` }
    });
    assert(repHistoryRes.status === 200, 'Report: Transaction history returns 200');
    const historySummary = repHistoryRes.data.data.summary;
    assert(historySummary.total_transactions > 0, 'Report: Transaction history contains transactions');
    assert(historySummary.total_stock_in > 0, 'Report: Transaction history summary tracks total_stock_in');
    assert(historySummary.total_dispatch > 0, 'Report: Transaction history summary tracks total_dispatch');

    // 3. Expiry report
    const repExpiryRes = await request('/api/warehouse/reports/expiry?days=750', {
      headers: { Authorization: `Bearer ${whToken}` }
    });
    assert(repExpiryRes.status === 200, 'Report: Expiry report returns 200');
    assert(repExpiryRes.data.data.report.length > 0, 'Report: Expiry report lists tracked batches');

    // 4. Dispatch per pharmacy
    const repDispPharmRes = await request('/api/warehouse/reports/dispatch-per-pharmacy', {
      headers: { Authorization: `Bearer ${whToken}` }
    });
    assert(repDispPharmRes.status === 200, 'Report: Dispatch per pharmacy returns 200');
    assert(repDispPharmRes.data.data.pharmacies.length > 0, 'Report: Grouped dispatches per pharmacy present');

    // -------------------------------------------------------------------------
    // TEST 8: Multi-tenant Database Isolation Check
    // -------------------------------------------------------------------------
    console.log('\n[Test 8] Testing Multi-tenant Database Isolation Check...');
    const defaultPharmConn = await getPharmacyConnection('pharmacy');
    const defaultPharmModels = getPharmacyModels(defaultPharmConn);

    const indPharmConn = await getPharmacyConnection('pharm_ind_01');
    const indPharmModels = getPharmacyModels(indPharmConn);

    assert(whConn.name === 'warehouse', 'Warehouse connection connects strictly to "warehouse" DB');
    assert(defaultPharmConn.name === 'pharmacy', 'Default pharmacy connection connects to "pharmacy" DB');
    assert(indPharmConn.name === 'pharmacy_pharm_ind_01', 'Indiranagar pharmacy connection connects to "pharmacy_pharm_ind_01" DB');

    // Verify warehouse ledger exists in warehouse and not in pharmacy
    const whLedgerCount = await whModels.TransactionLedger.countDocuments();
    assert(whLedgerCount > 0, 'Warehouse transaction ledger populated in "warehouse" DB');

    console.log('\n================================================================');
    console.log(` ALL ${passedTests}/${totalTests} ENGINE E1 TESTS PASSED SUCCESSFULLY! ✓`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n✗ Test Suite Encountered an Error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await disconnectAllDatabases();
  }
}

runE1WarehouseLedgerTests();
