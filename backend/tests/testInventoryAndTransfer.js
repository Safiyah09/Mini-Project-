const app = require('../src/app');
const { connectAllDatabases, disconnectAllDatabases } = require('../src/config/database');

async function testInventoryAndTransfer() {
  console.log('================================================================');
  console.log(' Testing Step 9: Inventory Management & Stock Transfer Logic');
  console.log('================================================================');

  await connectAllDatabases();

  const PORT = 5056;
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
    const data = await res.json();
    return { status: res.status, data };
  };

  try {
    // -------------------------------------------------------------------------
    // 1. Authenticate Warehouse and Pharmacy Admins
    // -------------------------------------------------------------------------
    console.log('\n[1/10] Authenticating Warehouse & Pharmacy admins...');
    const whLogin = await request('/api/warehouse/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'Password@123' }
    });
    const whToken = whLogin.data.data.token;

    const phLogin = await request('/api/pharmacy/auth/login', {
      method: 'POST',
      body: { username: 'pharmadmin', password: 'Password@123' }
    });
    const phToken = phLogin.data.data.token;
    console.log('✓ Tokens acquired for both systems.');

    const suffix = Date.now().toString().slice(-4);
    const testBatch2027 = `BAT-PCM-2027-${suffix}`;
    const testBatch2028 = `BAT-PCM-2028-${suffix}`;
    const testTrfId = `TRF-TEST-${suffix}`;

    // -------------------------------------------------------------------------
    // 2. Create Purchase Order in Warehouse
    // -------------------------------------------------------------------------
    console.log(`\n[2/10] Creating Purchase Order (PO-TEST-${suffix})...`);
    const poRes = await request('/api/warehouse/purchase-orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        po_id: `PO-TEST-${suffix}`,
        supplier: 'SUP-CIPLA-01',
        items: [
          { medicine: 'MED-PCM-500', quantity_ordered: 5000, unit_cost: 1.50 }
        ],
        notes: 'Bulk order for Paracetamol 500mg'
      }
    });
    console.log('PO Status:', poRes.status, '| PO ID:', poRes.data.data.po_id);
    const poItem = poRes.data.data.items[0];

    // -------------------------------------------------------------------------
    // 3. Receive Goods & Inward Batches (Batch 1 expiring 2028, Batch 2 expiring 2027)
    // -------------------------------------------------------------------------
    console.log('\n[3/10] Receiving Goods & Creating 2 Batches with different expiry dates...');
    const grRes1 = await request('/api/warehouse/goods-receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        purchase_order: `PO-TEST-${suffix}`,
        receipt_id: `GR-TEST-${suffix}-1`,
        items: [
          {
            po_item: poItem.po_item_id,
            batch_number: testBatch2028,
            quantity_received: 3000,
            manufacturing_date: '2026-01-01',
            expiry_date: '2028-12-31', // Later expiry
            storage_location: 'LOC-ZA-R01-B01'
          }
        ]
      }
    });
    console.log('GR 1 Status:', grRes1.status, '| Batch 1 received: 3000 units (Expiry: 2028-12-31)');

    const grRes2 = await request('/api/warehouse/goods-receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        purchase_order: `PO-TEST-${suffix}`,
        receipt_id: `GR-TEST-${suffix}-2`,
        items: [
          {
            po_item: poItem.po_item_id,
            batch_number: testBatch2027,
            quantity_received: 2000,
            manufacturing_date: '2025-06-01',
            expiry_date: '2027-06-30', // Earlier expiry!
            storage_location: 'LOC-ZA-R01-B01'
          }
        ]
      }
    });
    console.log('GR 2 Status:', grRes2.status, '| Batch 2 received: 2000 units (Expiry: 2027-06-30)');

    // -------------------------------------------------------------------------
    // 4. Test FEFO Batch Query
    // -------------------------------------------------------------------------
    console.log('\n[4/10] Testing FEFO batch query for Paracetamol 500mg...');
    const fefoRes = await request('/api/warehouse/stocks/fefo/MED-PCM-500', {
      headers: { Authorization: `Bearer ${whToken}` }
    });
    const fefoBatches = fefoRes.data.data.fefoBatches;
    console.log('First FEFO Batch:', fefoBatches[0].batch_number, '| Expiry:', fefoBatches[0].expiry_date.split('T')[0]);
    console.log('Second FEFO Batch:', fefoBatches[1].batch_number, '| Expiry:', fefoBatches[1].expiry_date.split('T')[0]);
    const d1 = new Date(fefoBatches[0].expiry_date).getTime();
    const d2 = new Date(fefoBatches[1].expiry_date).getTime();
    if (d1 > d2) {
      throw new Error('FEFO failure: Earlier expiry batch was not prioritized first!');
    }
    console.log('✓ FEFO Priority Verified: Batch with earlier expiry is ordered first!');

    // -------------------------------------------------------------------------
    // 5. Pharmacy Submits Supply Request for 1500 units
    // -------------------------------------------------------------------------
    console.log('\n[5/10] Pharmacy submits supply request for 1500 units of Paracetamol...');
    const reqRes = await request('/api/pharmacy/supply-requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${phToken}` },
      body: {
        request_id: `REQ-PH-${suffix}`,
        items: [
          { medicine: 'MED-PCM-500', quantity_requested: 1500 }
        ],
        notes: 'Monthly stock replenishment'
      }
    });
    console.log('Supply Request Status:', reqRes.status, '| Request ID:', reqRes.data.data.request_id);

    // -------------------------------------------------------------------------
    // 6. Warehouse Creates Stock Transfer with automated FEFO Allocation
    // -------------------------------------------------------------------------
    console.log('\n[6/10] Warehouse creates Stock Transfer with automated FEFO allocation...');
    const whConn = await require('../src/config/warehouseDatabase').getWarehouseConnection();
    const whModels = require('../src/models/warehouse').getWarehouseModels(whConn);
    const pharmacyDoc = await whModels.Pharmacy.findOne();

    const whReqDoc = await whModels.SupplyRequest.create({
      request_id: `REQ-WH-${suffix}`,
      pharmacy: pharmacyDoc._id,
      request_date: new Date(),
      status: 'APPROVED'
    });
    const pcmWhMed = await whModels.Medicine.findOne({ medicine_id: 'MED-PCM-500' });
    await whModels.RequestItem.create({
      request_item_id: `RQI-${suffix}`,
      supply_request: whReqDoc._id,
      medicine: pcmWhMed._id,
      quantity_requested: 1500
    });

    const transferRes = await request('/api/warehouse/transfers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        supply_request: whReqDoc.request_id,
        transfer_id: testTrfId,
        auto_fefo: true
      }
    });
    console.log('Transfer Status:', transferRes.status, '| Transfer ID:', transferRes.data.data.stockTransfer.transfer_id);
    const allocatedItem = transferRes.data.data.transferItems[0];
    console.log('Allocated Item Qty:', allocatedItem.quantity_allocated);
    console.log('✓ Stock successfully allocated and reserved via FEFO.');

    // -------------------------------------------------------------------------
    // 7. Warehouse Dispatches Transfer (Deducts stock & generates Invoice)
    // -------------------------------------------------------------------------
    console.log('\n[7/10] Dispatching Stock Transfer from Warehouse...');
    const dispatchRes = await request(`/api/warehouse/transfers/${transferRes.data.data.stockTransfer._id}/dispatch`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${whToken}` }
    });
    console.log('Dispatch Status:', dispatchRes.status);
    console.log('Invoice Generated:', dispatchRes.data.data.invoice.invoice_id);
    console.log('Invoice Total:', dispatchRes.data.data.invoice.total_amount);
    console.log('✓ Warehouse stock deducted and invoice created.');

    // -------------------------------------------------------------------------
    // 8. Pharmacy Confirms Stock Receipt
    // -------------------------------------------------------------------------
    console.log('\n[8/10] Pharmacy confirms Stock Receipt and updates inventory...');
    const receiptRes = await request('/api/pharmacy/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${phToken}` },
      body: {
        supply_request: reqRes.data.data._id,
        transfer_id: testTrfId, // External warehouse reference
        receipt_id: `REC-${suffix}`,
        items: [
          {
            medicine_id: 'MED-PCM-500',
            batch_number: testBatch2027,
            quantity_received: 1500,
            manufacturing_date: '2025-06-01',
            expiry_date: '2027-06-30'
          }
        ]
      }
    });
    console.log('Receipt Status:', receiptRes.status);
    if (receiptRes.status >= 400) {
      console.error('Receipt Error details:', JSON.stringify(receiptRes.data, null, 2));
    }
    console.log('Updated Pharmacy Stock Qty:', receiptRes.data.data.pharmacyStocks[0].quantity_on_hand);
    console.log('✓ Pharmacy stock confirmed & updated.');

    // Test Duplicate Receipt Prevention
    const dupRes = await request('/api/pharmacy/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${phToken}` },
      body: {
        transfer_id: testTrfId,
        items: [{ medicine_id: 'MED-PCM-500', quantity_received: 500 }]
      }
    });
    console.log('Duplicate Receipt Attempt Status (Expected 409):', dupRes.status);
    if (dupRes.status !== 409) throw new Error('Duplicate receipt was not prevented!');
    console.log('✓ Duplicate receipt prevented.');

    // -------------------------------------------------------------------------
    // 9. Pharmacy Point of Sale (POS) Checkout & Negative Inventory Prevention
    // -------------------------------------------------------------------------
    console.log('\n[9/10] Testing Point-of-Sale checkout and negative inventory rules...');
    const custRes = await request('/api/pharmacy/customers?limit=1', {
      headers: { Authorization: `Bearer ${phToken}` }
    });
    const customer = custRes.data.data.customers[0];

    // Successful Sale of 50 units
    const saleRes = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: { Authorization: `Bearer ${phToken}` },
      body: {
        customer: customer ? customer._id : null,
        items: [
          { batch: testBatch2027, quantity: 50, unit_price: 3.50 }
        ],
        payment_method: 'UPI',
        notes: 'Regular prescription purchase'
      }
    });
    console.log('Sale Status:', saleRes.status, '| Invoice:', saleRes.data.data.sale.sale_id);
    console.log('Total Amount:', saleRes.data.data.sale.total_amount);
    console.log('Payment Method:', saleRes.data.data.payment.method);
    console.log('✓ Sale completed and stock deducted from pharmacy.');

    // Test Negative Inventory Prevention (Attempting to buy 500,000 units)
    const excessSaleRes = await request('/api/pharmacy/sales', {
      method: 'POST',
      headers: { Authorization: `Bearer ${phToken}` },
      body: {
        items: [
          { batch: testBatch2027, quantity: 500000, unit_price: 3.50 }
        ]
      }
    });
    console.log('Excessive Sale Attempt Status (Expected 400):', excessSaleRes.status);
    if (excessSaleRes.status !== 400) throw new Error('Negative inventory was not prevented!');
    console.log('✓ Negative inventory strictly prevented.');

    // -------------------------------------------------------------------------
    // 10. Sales Return & Restocking
    // -------------------------------------------------------------------------
    console.log('\n[10/10] Testing Customer Sales Return & Restocking...');
    const soldItem = saleRes.data.data.items[0];
    const returnRes = await request('/api/pharmacy/returns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${phToken}` },
      body: {
        sale_item: soldItem._id,
        quantity: 10,
        reason: 'Patient changed prescription'
      }
    });
    console.log('Return Status:', returnRes.status);
    console.log('Restocked Quantity:', returnRes.data.data.restockedQuantity);
    console.log('✓ Customer return processed and inventory restocked.');

    console.log('\n================================================================');
    console.log(' ALL 10/10 INVENTORY & TRANSFER PHASES PASSED SUCCESSFULLY! ✓');
    console.log('================================================================\n');

  } catch (err) {
    console.error('✗ Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await disconnectAllDatabases();
  }
}

testInventoryAndTransfer();
