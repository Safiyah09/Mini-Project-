const http = require('http');
const app = require('../src/app');
const { connectAllDatabases, disconnectAllDatabases } = require('../src/config/database');

async function testAPIs() {
  console.log('================================================================');
  console.log(' Testing Authentication & CRUD APIs (Warehouse & Pharmacy)');
  console.log('================================================================');

  await connectAllDatabases();

  const PORT = 5055;
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
    // 1. Warehouse Auth: Login as admin
    // -------------------------------------------------------------------------
    console.log('\n[1/6] Testing Warehouse Login (POST /api/warehouse/auth/login)...');
    const whLoginRes = await request('/api/warehouse/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'Password@123' }
    });
    console.log('Status:', whLoginRes.status);
    console.log('Login Response:', whLoginRes.data.message);
    if (!whLoginRes.data.success || !whLoginRes.data.data.token) {
      throw new Error('Warehouse login failed');
    }
    const whToken = whLoginRes.data.data.token;
    console.log('✓ Warehouse JWT token received.');

    // -------------------------------------------------------------------------
    // 2. Warehouse Profile (GET /api/warehouse/auth/me)
    // -------------------------------------------------------------------------
    console.log('\n[2/6] Testing Warehouse Profile (GET /api/warehouse/auth/me)...');
    const whMeRes = await request('/api/warehouse/auth/me', {
      headers: { Authorization: `Bearer ${whToken}` }
    });
    console.log('Status:', whMeRes.status);
    console.log('User:', whMeRes.data.data.user.name, '| Role:', whMeRes.data.data.user.role.role_name);
    console.log('✓ Warehouse authenticated profile verified.');

    // -------------------------------------------------------------------------
    // 3. Warehouse CRUD: Create & List Suppliers
    // -------------------------------------------------------------------------
    const suffix = Date.now().toString().slice(-4);
    console.log('\n[3/6] Testing Warehouse Suppliers CRUD...');
    const createSupRes = await request('/api/warehouse/suppliers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whToken}` },
      body: {
        supplier_id: `SUP-TEST-${suffix}`,
        name: `Apex Biotech International ${suffix}`,
        address: 'Electronic City, Bengaluru',
        contact: '+91-9988776655'
      }
    });
    console.log('Create Supplier Status:', createSupRes.status);
    console.log('Created Supplier:', createSupRes.data.data.name);

    const listSupRes = await request('/api/warehouse/suppliers', {
      headers: { Authorization: `Bearer ${whToken}` }
    });
    console.log('Suppliers Count:', listSupRes.data.data.suppliers.length);
    console.log('✓ Warehouse Suppliers CRUD verified.');

    // -------------------------------------------------------------------------
    // 4. Pharmacy Auth: Login as pharmadmin
    // -------------------------------------------------------------------------
    console.log('\n[4/6] Testing Pharmacy Login (POST /api/pharmacy/auth/login)...');
    const phLoginRes = await request('/api/pharmacy/auth/login', {
      method: 'POST',
      body: { username: 'pharmadmin', password: 'Password@123' }
    });
    console.log('Status:', phLoginRes.status);
    console.log('Login Response:', phLoginRes.data.message);
    if (!phLoginRes.data.success || !phLoginRes.data.data.token) {
      throw new Error('Pharmacy login failed');
    }
    const phToken = phLoginRes.data.data.token;
    console.log('✓ Pharmacy JWT token received.');

    // -------------------------------------------------------------------------
    // 5. Pharmacy CRUD: Create & List Customers
    // -------------------------------------------------------------------------
    console.log('\n[5/6] Testing Pharmacy Customer CRUD...');
    const createCustRes = await request('/api/pharmacy/customers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${phToken}` },
      body: {
        name: 'Ananya Deshmukh',
        phone: '+91-9777665544',
        email: 'ananya.d@example.com',
        address: 'Indiranagar 2nd Stage, Bengaluru'
      }
    });
    console.log('Create Customer Status:', createCustRes.status);
    console.log('Created Customer:', createCustRes.data.data.name);

    const listCustRes = await request('/api/pharmacy/customers', {
      headers: { Authorization: `Bearer ${phToken}` }
    });
    console.log('Customers Count:', listCustRes.data.data.customers.length);
    console.log('✓ Pharmacy Customers CRUD verified.');

    // -------------------------------------------------------------------------
    // 6. Pharmacy CRUD: List Medicines
    // -------------------------------------------------------------------------
    console.log('\n[6/6] Testing Pharmacy Medicines List...');
    const listPhMedRes = await request('/api/pharmacy/medicines', {
      headers: { Authorization: `Bearer ${phToken}` }
    });
    console.log('Pharmacy Medicines Count:', listPhMedRes.data.data.medicines.length);
    console.log('✓ Pharmacy Medicines catalog verified.');

    console.log('\n================================================================');
    console.log(' ALL 6/6 TEST PHASES PASSED SUCCESSFULLY! ✓');
    console.log('================================================================\n');

  } catch (err) {
    console.error('✗ Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await disconnectAllDatabases();
  }
}

testAPIs();
