const http = require('http');
const app = require('../src/app');
const { disconnectAllDatabases } = require('../src/config/database');

const PORT = 5098;
let server;

const request = (path, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:${PORT}${path}`);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
};

async function runCommunicationTests() {
  console.log('================================================================');
  console.log(' Testing Step 10: Warehouse <-> Pharmacy Communication Bridge');
  console.log('================================================================');

  try {
    server = app.listen(PORT);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 1. Authenticate both sides
    console.log('\n[1/8] Authenticating Warehouse & Pharmacy admins...');
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
    console.log('✓ Tokens acquired.');

    const suffix = Date.now().toString().slice(-4);

    // 2. Pharmacy creates local Supply Request
    console.log('\n[2/8] Pharmacy creates local Supply Request...');
    const phReqRes = await request('/api/pharmacy/supply-requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${phToken}` },
      body: {
        request_id: `REQ-COMM-${suffix}`,
        items: [
          { medicine: 'MED-PCM-500', quantity_requested: 250 }
        ],
        notes: 'Urgent restocking for weekend surge'
      }
    });
    console.log('Supply Request Created:', phReqRes.status, phReqRes.data.data.request_id);
    const pharmacyRequestId = phReqRes.data.data._id;

    // 3. Pharmacy transmits Supply Request to Central Warehouse
    console.log('\n[3/8] Pharmacy transmits Supply Request to Central Warehouse API...');
    const transmitRes = await request(`/api/pharmacy/supply-requests/${pharmacyRequestId}/transmit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${phToken}` }
    });
    console.log('Transmission Status:', transmitRes.status);
    console.log('Transmitted Payload:', transmitRes.data.data.warehouseRequestId, 'to Pharmacy:', transmitRes.data.data.pharmacyName);
    if (transmitRes.status !== 200) {
      throw new Error('Supply request transmission failed');
    }
    console.log('✓ Supply request successfully bridged to Central Warehouse.');

    // 4. Warehouse processes request and allocates stock transfer
    console.log('\n[4/8] Warehouse receives request and creates Stock Transfer...');
    const whReqs = await request('/api/warehouse/supply-requests?status=PENDING', {
      headers: { Authorization: `Bearer ${whToken}` }
    });
    const targetWhReq = whReqs.data.data.supplyRequests.find(r => r.request_id === `REQ-COMM-${suffix}`);
    if (!targetWhReq) {
      throw new Error(`Transmitted request REQ-COMM-${suffix} not found in Warehouse queue!`);
    }

    const trfRes = await request('/api/warehouse/transfers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        supply_request: targetWhReq._id,
        transfer_id: `TRF-COMM-${suffix}`,
        shipping_reference: `SPEED-POST-${suffix}`,
        auto_fefo: true
      }
    });
    console.log('Transfer Created Status:', trfRes.status, '| Transfer ID:', trfRes.data.data.stockTransfer.transfer_id);
    const whTransferId = trfRes.data.data.stockTransfer._id;

    // 5. Warehouse dispatches and notifies Pharmacy
    console.log('\n[5/8] Warehouse dispatches transfer and broadcasts notification to Pharmacy...');
    const dispatchRes = await request(`/api/warehouse/transfers/${whTransferId}/dispatch`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${whToken}` }
    });
    console.log('Dispatch Status:', dispatchRes.status, '| Invoice ID:', dispatchRes.data.data.invoice.invoice_id);

    const notifyRes = await request(`/api/warehouse/transfers/${whTransferId}/notify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` }
    });
    console.log('Notification Status:', notifyRes.status);
    console.log('Broadcast Alert Message:', notifyRes.data.data.message);
    console.log('✓ Pharmacy alerted of shipment in transit.');

    // 6. Pharmacy verifies Alert and queries Warehouse Transfer Manifest
    console.log('\n[6/8] Pharmacy checks Alerts and looks up Transfer Manifest...');
    const alertsRes = await request('/api/pharmacy/alerts', {
      headers: { Authorization: `Bearer ${phToken}` }
    });
    const alertsList = Array.isArray(alertsRes.data.data) ? alertsRes.data.data : alertsRes.data.data.alerts;
    const dispatchAlert = alertsList.find(a => a.alert_type === 'STOCK_IN_TRANSIT');
    if (!dispatchAlert) {
      throw new Error('STOCK_IN_TRANSIT alert was not received in pharmacy!');
    }
    console.log('✓ Pharmacy received alert:', dispatchAlert.message);

    const manifestRes = await request(`/api/pharmacy/receipts/warehouse-transfer/TRF-COMM-${suffix}`, {
      headers: { Authorization: `Bearer ${phToken}` }
    });
    console.log('Manifest Status:', manifestRes.status);
    console.log('Manifest Item Count:', manifestRes.data.data.item_count);
    const manifestItem = manifestRes.data.data.items[0];
    console.log(`Manifest Item: ${manifestItem.medicine_name} | Batch: ${manifestItem.batch_number} | Dispatched Qty: ${manifestItem.quantity_dispatched}`);

    // 7. Pharmacy confirms Stock Receipt using the manifest
    console.log('\n[7/8] Pharmacy confirms Stock Receipt from manifest...');
    const recRes = await request('/api/pharmacy/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${phToken}` },
      body: {
        supply_request: pharmacyRequestId,
        transfer_id: `TRF-COMM-${suffix}`,
        receipt_id: `REC-COMM-${suffix}`,
        items: [
          {
            medicine: manifestItem.medicine_id,
            batch_number: manifestItem.batch_number,
            quantity_received: manifestItem.quantity_dispatched,
            manufacturing_date: manifestItem.manufacturing_date,
            expiry_date: manifestItem.expiry_date,
            unit_price: 15.00
          }
        ],
        notes: 'Bridge delivery received in excellent condition'
      }
    });
    console.log('Receipt Confirmation Status:', recRes.status, recRes.data);
    if (recRes.status !== 201) {
      throw new Error(`Receipt failed: ${JSON.stringify(recRes.data)}`);
    }
    console.log('✓ Pharmacy inventory credited.');

    // 8. Warehouse Invoice Payment & Audit Log
    console.log('\n[8/8] Warehouse records Invoice Settlement & verifies Audit Log...');
    const invoiceId = dispatchRes.data.data.invoice.invoice_id;
    const invRes = await request(`/api/warehouse/invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${whToken}` }
    });
    console.log('Invoice Status:', invRes.data.data.invoice.status, '| Total Amount: ₹' + invRes.data.data.invoice.total_amount);

    const payRes = await request('/api/warehouse/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        invoice_id: invoiceId,
        amount: parseFloat(invRes.data.data.invoice.total_amount),
        method: 'BANK_TRANSFER',
        reference_number: `UTR-COMM-${suffix}`
      }
    });
    console.log('Payment Status:', payRes.status, '| Invoice Updated to:', payRes.data.data.invoiceSummary.status);
    if (payRes.data.data.invoiceSummary.status !== 'PAID') {
      throw new Error('Invoice was not updated to PAID!');
    }

    const auditRes = await request('/api/warehouse/audit-logs?limit=5', {
      headers: { Authorization: `Bearer ${whToken}` }
    });
    console.log('Audit Logs Count:', auditRes.data.data.logs.length);
    console.log('Latest Log Action:', auditRes.data.data.logs[0].action, 'on Table:', auditRes.data.data.logs[0].table_name);
    console.log('✓ Audit logging verified.');

    console.log('\n================================================================');
    console.log(' ALL 8/8 COMMUNICATION BRIDGE PHASES PASSED SUCCESSFULLY! ✓');
    console.log('================================================================\n');

  } catch (err) {
    console.error('✗ Communication test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await disconnectAllDatabases();
  }
}

runCommunicationTests();
