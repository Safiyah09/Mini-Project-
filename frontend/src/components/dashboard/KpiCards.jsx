import React from 'react';

export default function KpiCards({ roleCategory, stats, loading }) {
  if (loading) {
    return (
      <div className="kpi-grid">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="kpi-card" style={{ opacity: 0.6 }}>
            <div className="kpi-label">Loading metric...</div>
            <div className="kpi-value" style={{ fontSize: '1.2rem', color: '#94a3b8' }}>&bull;&bull;&bull;</div>
          </div>
        ))}
      </div>
    );
  }

  // 1. Warehouse Admin Cards (8 cards)
  if (roleCategory === 'WAREHOUSE_ADMIN') {
    return (
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Total Medicines</span>
            <div className="kpi-icon-wrapper teal">💊</div>
          </div>
          <div className="kpi-value">{stats?.totalMedicines ?? 0}</div>
          <div className="kpi-subtitle">Approved formulations in formulary</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Total Warehouse Stock</span>
            <div className="kpi-icon-wrapper blue">📦</div>
          </div>
          <div className="kpi-value">{(stats?.totalWarehouseStock ?? 0).toLocaleString()}</div>
          <div className="kpi-subtitle">Physical units in storage locations</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Registered Pharmacies</span>
            <div className="kpi-icon-wrapper purple">🏥</div>
          </div>
          <div className="kpi-value">{stats?.registeredPharmacies ?? 0}</div>
          <div className="kpi-subtitle">Connected dispensary branches</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Pending Requests</span>
            <div className="kpi-icon-wrapper yellow">📥</div>
          </div>
          <div className="kpi-value">{stats?.pendingRequests ?? 0}</div>
          <div className="kpi-subtitle">Awaiting approval / allocation</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Total Transfers</span>
            <div className="kpi-icon-wrapper green">🚚</div>
          </div>
          <div className="kpi-value">{stats?.totalTransfers ?? 0}</div>
          <div className="kpi-subtitle">Branch dispatches recorded</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Low Stock Medicines</span>
            <div className="kpi-icon-wrapper red">⚠️</div>
          </div>
          <div className="kpi-value" style={{ color: (stats?.lowStockMedicines ?? 0) > 0 ? '#ef4444' : 'inherit' }}>
            {stats?.lowStockMedicines ?? 0}
          </div>
          <div className="kpi-subtitle">Stock below safety threshold</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Near Expiry Batches</span>
            <div className="kpi-icon-wrapper yellow">⏳</div>
          </div>
          <div className="kpi-value" style={{ color: (stats?.nearExpiryBatches ?? 0) > 0 ? '#ca8a04' : 'inherit' }}>
            {stats?.nearExpiryBatches ?? 0}
          </div>
          <div className="kpi-subtitle">Expiring within 90 days (FEFO)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Total Suppliers</span>
            <div className="kpi-icon-wrapper teal">🤝</div>
          </div>
          <div className="kpi-value">{stats?.totalSuppliers ?? 0}</div>
          <div className="kpi-subtitle">Active pharmaceutical vendors</div>
        </div>
      </div>
    );
  }

  // 2. Warehouse Staff Cards (6 cards)
  if (roleCategory === 'WAREHOUSE_STAFF') {
    return (
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Total Medicines</span>
            <div className="kpi-icon-wrapper teal">💊</div>
          </div>
          <div className="kpi-value">{stats?.totalMedicines ?? 0}</div>
          <div className="kpi-subtitle">Formulary medicines catalog</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Available Stock</span>
            <div className="kpi-icon-wrapper blue">📦</div>
          </div>
          <div className="kpi-value">{(stats?.totalWarehouseStock ?? 0).toLocaleString()}</div>
          <div className="kpi-subtitle">Physical units ready for dispatch</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Pending Tasks</span>
            <div className="kpi-icon-wrapper yellow">📋</div>
          </div>
          <div className="kpi-value">{(stats?.pendingRequests ?? 0) + (stats?.nearExpiryBatches ?? 0)}</div>
          <div className="kpi-subtitle">Inward receipts &amp; allocation jobs</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Orders to Process</span>
            <div className="kpi-icon-wrapper purple">📥</div>
          </div>
          <div className="kpi-value">{stats?.pendingRequests ?? 0}</div>
          <div className="kpi-subtitle">Incoming branch pharmacy requests</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Pending Dispatches</span>
            <div className="kpi-icon-wrapper green">🚚</div>
          </div>
          <div className="kpi-value">{stats?.totalTransfers ?? 0}</div>
          <div className="kpi-subtitle">Transfers queued for transit</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Near Expiry Batches</span>
            <div className="kpi-icon-wrapper red">⏳</div>
          </div>
          <div className="kpi-value">{stats?.nearExpiryBatches ?? 0}</div>
          <div className="kpi-subtitle">Batches requiring FEFO dispatch</div>
        </div>
      </div>
    );
  }

  // 3. Pharmacy Admin Cards (8 cards)
  if (roleCategory === 'PHARMACY_ADMIN') {
    return (
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Total Medicines</span>
            <div className="kpi-icon-wrapper teal">💊</div>
          </div>
          <div className="kpi-value">{stats?.totalMedicines ?? 0}</div>
          <div className="kpi-subtitle">Branch dispensary medicines</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Total Pharmacy Stock</span>
            <div className="kpi-icon-wrapper blue">📦</div>
          </div>
          <div className="kpi-value">{(stats?.totalPharmacyStock ?? 0).toLocaleString()}</div>
          <div className="kpi-subtitle">Current stock on branch shelves</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Today's Sales</span>
            <div className="kpi-icon-wrapper green">₹</div>
          </div>
          <div className="kpi-value">₹{(stats?.todaySales ?? 0).toLocaleString()}</div>
          <div className="kpi-subtitle">{stats?.todaySalesCount ?? 0} sales transactions today</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Total Transactions</span>
            <div className="kpi-icon-wrapper purple">🧾</div>
          </div>
          <div className="kpi-value">{stats?.totalTransactions ?? 0}</div>
          <div className="kpi-subtitle">All-time customer sales bills</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Pending Requests</span>
            <div className="kpi-icon-wrapper yellow">📝</div>
          </div>
          <div className="kpi-value">{stats?.pendingRequests ?? 0}</div>
          <div className="kpi-subtitle">Orders submitted to Warehouse</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Orders Received</span>
            <div className="kpi-icon-wrapper teal">📥</div>
          </div>
          <div className="kpi-value">{stats?.ordersReceived ?? 0}</div>
          <div className="kpi-subtitle">Confirmed stock receipts credited</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Low Stock Medicines</span>
            <div className="kpi-icon-wrapper red">⚠️</div>
          </div>
          <div className="kpi-value" style={{ color: (stats?.lowStockMedicines ?? 0) > 0 ? '#ef4444' : 'inherit' }}>
            {stats?.lowStockMedicines ?? 0}
          </div>
          <div className="kpi-subtitle">Below branch reorder levels</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-label">Near Expiry Batches</span>
            <div className="kpi-icon-wrapper yellow">⏳</div>
          </div>
          <div className="kpi-value">{stats?.nearExpiryBatches ?? 0}</div>
          <div className="kpi-subtitle">Expiring within 90 days</div>
        </div>
      </div>
    );
  }

  // 4. Pharmacy Staff Cards (6 cards)
  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-label">Available Medicines</span>
          <div className="kpi-icon-wrapper teal">💊</div>
        </div>
        <div className="kpi-value">{stats?.totalMedicines ?? 0}</div>
        <div className="kpi-subtitle">In-stock formulas ready for sale</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-label">Today's Sales</span>
          <div className="kpi-icon-wrapper green">₹</div>
        </div>
        <div className="kpi-value">₹{(stats?.todaySales ?? 0).toLocaleString()}</div>
        <div className="kpi-subtitle">{stats?.todaySalesCount ?? 0} counter sales billed</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-label">Total Transactions</span>
          <div className="kpi-icon-wrapper purple">🧾</div>
        </div>
        <div className="kpi-value">{stats?.totalTransactions ?? 0}</div>
        <div className="kpi-subtitle">Completed POS invoices</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-label">Low Stock Medicines</span>
          <div className="kpi-icon-wrapper red">⚠️</div>
        </div>
        <div className="kpi-value">{stats?.lowStockMedicines ?? 0}</div>
        <div className="kpi-subtitle">Medications to reorder</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-label">Near Expiry Batches</span>
          <div className="kpi-icon-wrapper yellow">⏳</div>
        </div>
        <div className="kpi-value">{stats?.nearExpiryBatches ?? 0}</div>
        <div className="kpi-subtitle">Stock nearing expiry date</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-label">Pending Receipts</span>
          <div className="kpi-icon-wrapper teal">📥</div>
        </div>
        <div className="kpi-value">{stats?.pendingRequests ?? 0}</div>
        <div className="kpi-subtitle">Incoming warehouse shipments</div>
      </div>
    </div>
  );
}
