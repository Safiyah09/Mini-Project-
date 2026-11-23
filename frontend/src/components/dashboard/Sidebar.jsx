import React from 'react';

// Navigation configurations for all 4 roles (PRESERVED 100%)
const NAVIGATION_CONFIG = {
  WAREHOUSE_ADMIN: [
    { id: 'dashboard', label: '1. Dashboard', icon: '📊' },
    { id: 'medicines', label: '2. Medicine Management', icon: '💊' },
    { id: 'batches', label: '3. Batch Management', icon: '🏷️' },
    { id: 'inventory', label: '4. Warehouse Inventory', icon: '📦' },
    { id: 'locations', label: '5. Storage Locations', icon: '🏢' },
    { id: 'suppliers', label: '6. Supplier Management', icon: '🤝' },
    { id: 'procurement', label: '7. Procurement (PO & GR)', icon: '🛒' },
    { id: 'pharmacies', label: '8. Pharmacy Management', icon: '🏥' },
    { id: 'supply_requests', label: '9. Supply Requests', icon: '📥' },
    { id: 'transfers', label: '10. Stock Transfers', icon: '🚚' },
    { id: 'returns', label: '11. Returns Management', icon: '🔄' },
    { id: 'ledger', label: '12. Transaction Ledger', icon: '📑' },
    { id: 'alerts', label: '13. Alerts & Expiry', icon: '🔔' },
    { id: 'reports', label: '14. Reports & Analytics', icon: '📈' },
    { id: 'users', label: '15. User Management', icon: '👥' },
    { id: 'audit_logs', label: '16. Audit Logs', icon: '📜' }
  ],
  WAREHOUSE_STAFF: [
    { id: 'dashboard', label: '1. Dashboard', icon: '📊' },
    { id: 'medicines', label: '2. Medicine Management', icon: '💊' },
    { id: 'batches', label: '3. Batch Management', icon: '🏷️' },
    { id: 'inventory', label: '4. Warehouse Inventory', icon: '📦' },
    { id: 'goods_receipt', label: '5. Goods Receipt', icon: '📥' },
    { id: 'order_processing', label: '6. Order Processing', icon: '📋' },
    { id: 'batch_allocation', label: '7. Batch Allocation (FEFO)', icon: '⚙️' },
    { id: 'stock_dispatch', label: '8. Stock Dispatch', icon: '🚚' },
    { id: 'adjustments', label: '9. Stock Adjustments', icon: '⚖️' },
    { id: 'returns', label: '10. Returns Processing', icon: '🔄' },
    { id: 'transactions', label: '11. Transaction History', icon: '📑' },
    { id: 'alerts', label: '12. Alerts', icon: '🔔' },
    { id: 'profile', label: '13. My Profile', icon: '👤' }
  ],
  PHARMACY_ADMIN: [
    { id: 'dashboard', label: '1. Dashboard', icon: '📊' },
    { id: 'medicines', label: '2. Medicine Management', icon: '💊' },
    { id: 'batches', label: '3. Batch Management', icon: '🏷️' },
    { id: 'inventory', label: '4. Pharmacy Inventory', icon: '📦' },
    { id: 'sales', label: '5. Sales Management (POS)', icon: '💳' },
    { id: 'returns', label: '6. Sales Returns', icon: '🔄' },
    { id: 'customers', label: '7. Customer Management', icon: '👥' },
    { id: 'warehouse_connection', label: '8. Warehouse Connection', icon: '🔗' },
    { id: 'receipts', label: '9. Stock Receipts', icon: '📥' },
    { id: 'adjustments', label: '10. Stock Adjustments', icon: '⚖️' },
    { id: 'alerts', label: '11. Alerts & Reorders', icon: '🔔' },
    { id: 'reports', label: '12. Reports & Analytics', icon: '📈' },
    { id: 'users', label: '13. User Management', icon: '👥' },
    { id: 'audit_logs', label: '14. Audit Logs', icon: '📜' }
  ],
  PHARMACY_STAFF: [
    { id: 'dashboard', label: '1. Dashboard', icon: '📊' },
    { id: 'medicine_search', label: '2. Medicine Search', icon: '🔍' },
    { id: 'inventory', label: '3. Pharmacy Inventory', icon: '📦' },
    { id: 'batches', label: '4. Batch Management', icon: '🏷️' },
    { id: 'sales', label: '5. Sales Management (POS)', icon: '💳' },
    { id: 'returns', label: '6. Sales Returns', icon: '🔄' },
    { id: 'supply_requests', label: '7. Supply Requests', icon: '📝' },
    { id: 'receipts', label: '8. Stock Receipts', icon: '📥' },
    { id: 'alerts', label: '9. Alerts & Expiry', icon: '🔔' },
    { id: 'profile', label: '10. My Profile', icon: '👤' }
  ]
};

export default function Sidebar({ user, systemType, activeSection, onSelectSection, onLogout, alertCount = 0 }) {
  const roleName = user?.role?.role_name || user?.role || '';
  let roleCategory = 'WAREHOUSE_ADMIN';

  if (systemType === 'WAREHOUSE') {
    if (roleName === 'WAREHOUSE_ADMIN') {
      roleCategory = 'WAREHOUSE_ADMIN';
    } else {
      roleCategory = 'WAREHOUSE_STAFF';
    }
  } else {
    if (roleName === 'PHARMACY_ADMIN') {
      roleCategory = 'PHARMACY_ADMIN';
    } else {
      roleCategory = 'PHARMACY_STAFF';
    }
  }

  const navItems = NAVIGATION_CONFIG[roleCategory] || NAVIGATION_CONFIG.WAREHOUSE_ADMIN;

  const roleDisplayNames = {
    WAREHOUSE_ADMIN: 'Warehouse Administrator',
    WAREHOUSE_STAFF: 'Warehouse Staff Operator',
    PHARMACY_ADMIN: 'Pharmacy Administrator',
    PHARMACY_STAFF: 'Pharmacy Staff & Dispenser'
  };

  const userInitials = (user?.name || user?.username || 'AM')
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-top">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="#fee2e2" stroke="#dc2626" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          <span>
            pharma<span className="brand-accent">sync</span>
          </span>
        </div>
      </div>

      {/* Workspace Switcher */}
      <div className="workspace-switcher">
        <div className="workspace-avatar">
          {systemType === 'WAREHOUSE' ? '🏢' : '🏥'}
        </div>
        <div>
          <strong>{systemType === 'WAREHOUSE' ? 'Central Warehouse' : 'Branch Pharmacy'}</strong>
          <small>{roleDisplayNames[roleCategory]}</small>
        </div>
        <span className="chevron">⌵</span>
      </div>

      {/* Navigation List - Exact items & options preserved */}
      <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div className="nav-label">NAVIGATION MENU</div>
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectSection(item.id)}
            >
              <span className="nav-icon" style={{ fontSize: '15px' }}>{item.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              {item.id === 'dashboard' && <span className="nav-pulse" />}
              {item.id === 'alerts' && alertCount > 0 && (
                <span className="nav-item-badge">{alertCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Bottom / Profile */}
      <div className="sidebar-bottom">
        <button className="user-card" onClick={onLogout} title="Click to log out">
          <div className="user-avatar">{userInitials}</div>
          <div>
            <strong>{user?.name || 'User'}</strong>
            <small>{roleDisplayNames[roleCategory]}</small>
          </div>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
