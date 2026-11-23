import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import WarehouseAdminDashboard from './WarehouseAdminDashboard';
import WarehouseStaffDashboard from './WarehouseStaffDashboard';
import PharmacyAdminDashboard from './PharmacyAdminDashboard';
import PharmacyStaffDashboard from './PharmacyStaffDashboard';
import { warehouseService, pharmacyService } from '../../services/api';
import '../../dashboard.css';

export default function DashboardContainer({ session, onLogout, showToast }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [alertCount, setAlertCount] = useState(0);

  const { user, systemType, pharmacyId } = session;
  const roleName = user?.role?.role_name || user?.role || '';

  // Determine role category
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

  // Fetch alert count for bell & sidebar badge
  useEffect(() => {
    const fetchAlertCount = async () => {
      try {
        if (systemType === 'WAREHOUSE') {
          const res = await warehouseService.getAlerts();
          if (res.success && Array.isArray(res.data)) {
            setAlertCount(res.data.length);
          }
        } else {
          const res = await pharmacyService.getAlerts({ resolved: 'false' }, pharmacyId);
          if (res.success && Array.isArray(res.data)) {
            setAlertCount(res.data.length);
          }
        }
      } catch {
        // Silently catch
      }
    };
    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [systemType, pharmacyId]);

  // Section Titles lookup
  const getSectionTitle = () => {
    const titles = {
      dashboard: 'Executive Dashboard & Overview',
      medicines: 'Medicine Catalog Management',
      medicine_search: 'Medicine Availability Search',
      batches: 'Batch & Expiry Date Management',
      inventory: systemType === 'WAREHOUSE' ? 'Warehouse Stock Inventory' : 'Pharmacy Shelf Stock',
      locations: 'Warehouse Storage Locations & Zones',
      suppliers: 'Approved Pharmaceutical Suppliers',
      procurement: 'Procurement: Purchase Orders & Goods Receipts',
      goods_receipt: 'Inward Goods Receipts (GR)',
      pharmacies: 'Registered Pharmacy Branches',
      supply_requests: 'Supply Requests & Replenishment',
      transfers: 'Stock Transfers & FEFO Allocations',
      stock_dispatch: 'Stock Transfer Dispatch Desk',
      order_processing: 'Order Processing & Allocation',
      batch_allocation: 'FEFO Batch Allocation Engine',
      receipts: 'Inward Stock Receipt Confirmation',
      stock_receipts: 'Stock Receipts Verification',
      adjustments: 'Stock Adjustments & Loss Logging',
      sales: 'Point-of-Sale (POS) Billing',
      returns: 'Returns Processing & Restocking',
      customers: 'Customer Accounts & Purchase Records',
      warehouse_connection: 'Inter-Service Bridge (Central Warehouse)',
      ledger: 'Financial & Dispatch Transaction Ledger',
      transactions: 'Stock Transaction Ledger',
      alerts: 'System Alerts, Low Stock & Expiry Tracking',
      reports: 'Reports, Metrics & Analytics',
      users: 'User & Staff Account Administration',
      audit_logs: 'Immutable System Audit Logs',
      profile: 'User Profile & Settings'
    };
    return titles[activeSection] || 'Management Portal';
  };

  // Section router
  const renderDashboardView = () => {
    switch (roleCategory) {
      case 'WAREHOUSE_ADMIN':
        return (
          <WarehouseAdminDashboard
            user={user}
            activeSection={activeSection}
            showToast={showToast}
            onSelectSection={setActiveSection}
          />
        );
      case 'WAREHOUSE_STAFF':
        return (
          <WarehouseStaffDashboard
            user={user}
            activeSection={activeSection}
            showToast={showToast}
            onSelectSection={setActiveSection}
          />
        );
      case 'PHARMACY_ADMIN':
        return (
          <PharmacyAdminDashboard
            user={user}
            activeSection={activeSection}
            showToast={showToast}
            onSelectSection={setActiveSection}
          />
        );
      case 'PHARMACY_STAFF':
        return (
          <PharmacyStaffDashboard
            user={user}
            activeSection={activeSection}
            showToast={showToast}
            onSelectSection={setActiveSection}
          />
        );
      default:
        return <div>Invalid Role Configuration</div>;
    }
  };

  return (
    <div className="dashboard-shell">
      {/* Role-Specific Sidebar */}
      <Sidebar
        user={user}
        systemType={systemType}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onLogout={onLogout}
        alertCount={alertCount}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <TopNavbar
          user={user}
          systemType={systemType}
          activeSectionTitle={getSectionTitle()}
          alertCount={alertCount}
          onNavigateAlerts={() => setActiveSection('alerts')}
          onLogout={onLogout}
        />

        <div className="dashboard">
          {renderDashboardView()}
        </div>
      </div>
    </div>
  );
}
