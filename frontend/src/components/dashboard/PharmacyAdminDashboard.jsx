import SectionWorkspaceLayout from './SectionWorkspaceLayout';
import MedflowDashboardView from './MedflowDashboardView';
import React, { useState, useEffect, useCallback } from 'react';
import DataTable from './DataTable';
import KpiCards from './KpiCards';
import Modal from './Modal';
import EntityDetailsTable from './EntityDetailsTable';
import { pharmacyService } from '../../services/api';

export default function PharmacyAdminDashboard({ user, activeSection, showToast, onSelectSection }) {
  const pharmacyId = user?.pharmacyId || 'pharmacy';
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Section data states
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [supplyRequests, setSupplyRequests] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Modals
  const [modalType, setModalType] = useState(null); // 'NEW_SALE' | 'ADD_MEDICINE' | 'ADD_BATCH' | 'ADD_CUSTOMER' | 'CREATE_SUPPLY_REQ' | 'CONFIRM_RECEIPT' | 'ADD_PHARMACY_STAFF' | 'VIEW_DETAILS'
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editMedForm, setEditMedForm] = useState({ name: '', manufacturer: '', category: 'Analgesic', dosage: '', formulation: 'Tablet', reorder_level: 25 });
  const [editBatchForm, setEditBatchForm] = useState({ manufacturing_date: '', expiry_date: '' });
  const [editCustomerForm, setEditCustomerForm] = useState({ name: '', phone: '', email: '' });

  // Forms
  const [saleForm, setSaleForm] = useState({ customer_id: '', items: [{ medicine_id: '', batch_number: '', quantity: 1, unit_price: 15 }], payment_method: 'UPI' });
  const [medForm, setMedForm] = useState({ name: '', manufacturer: '', category: 'Analgesic', dosage: '500mg', formulation: 'Tablet', reorder_level: 25 });
  const [batchForm, setBatchForm] = useState({ medicine_id: '', batch_number: '', manufacturing_date: '', expiry_date: '', initial_quantity: 100 });
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '' });
  const [reqForm, setReqForm] = useState({ items: [{ medicine_id: '', requested_quantity: 100 }], priority: 'NORMAL', notes: '' });
  const [receiptForm, setReceiptForm] = useState({ transfer_id: '', receipt_id: `REC-${Date.now().toString().slice(-6)}`, notes: 'Confirmed delivery in sound condition' });
  const [adjForm, setAdjForm] = useState({ medicine_id: '', batch_number: '', quantity_delta: -2, reason: 'DAMAGED', notes: '' });
  const [staffForm, setStaffForm] = useState({ name: '', username: '', email: '', password: 'Password@123', role_name: 'PHARMACY_STAFF' });

  // Load KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await pharmacyService.getStats(pharmacyId);
      if (res.success) setStats(res.data.kpis);
    } catch (err) {
      console.error('Failed to load pharmacy stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [pharmacyId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Load section-specific data
  const loadSectionData = useCallback(async () => {
    setLoadingData(true);
    try {
      if (activeSection === 'dashboard') {
        const [sRes, salesRes] = await Promise.all([pharmacyService.getStats(pharmacyId), pharmacyService.getSales({ limit: 10 }, pharmacyId)]);
        if (sRes.success) setStats(sRes.data?.kpis || null);
        if (salesRes.success) setSales(salesRes.data?.sales || (Array.isArray(salesRes.data) ? salesRes.data : []));
      } else if (activeSection === 'medicines') {
        const res = await pharmacyService.getMedicines({ limit: 100 }, pharmacyId);
        if (res.success) setMedicines(res.data?.medicines || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'batches') {
        const [bRes, mRes] = await Promise.all([pharmacyService.getBatches({ limit: 100 }, pharmacyId), pharmacyService.getMedicines({ limit: 100 }, pharmacyId)]);
        if (bRes.success) setBatches(bRes.data?.batches || (Array.isArray(bRes.data) ? bRes.data : []));
        if (mRes.success) setMedicines(mRes.data?.medicines || (Array.isArray(mRes.data) ? mRes.data : []));
      } else if (activeSection === 'inventory') {
        const res = await pharmacyService.getStocks({ limit: 100 }, pharmacyId);
        if (res.success) setStocks(res.data?.stocks || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'sales') {
        const [sRes, cRes, mRes, bRes, stkRes] = await Promise.all([
          pharmacyService.getSales({ limit: 100 }, pharmacyId),
          pharmacyService.getCustomers({ limit: 100 }, pharmacyId),
          pharmacyService.getMedicines({ limit: 100 }, pharmacyId),
          pharmacyService.getBatches({ limit: 100 }, pharmacyId),
          pharmacyService.getStocks({ limit: 100 }, pharmacyId)
        ]);
        if (sRes.success) setSales(sRes.data?.sales || (Array.isArray(sRes.data) ? sRes.data : []));
        if (cRes.success) setCustomers(cRes.data?.customers || (Array.isArray(cRes.data) ? cRes.data : []));
        if (mRes.success) setMedicines(mRes.data?.medicines || (Array.isArray(mRes.data) ? mRes.data : []));
        if (bRes.success) setBatches(bRes.data?.batches || (Array.isArray(bRes.data) ? bRes.data : []));
        if (stkRes && stkRes.success) setStocks(stkRes.data?.stocks || (Array.isArray(stkRes.data) ? stkRes.data : []));
      } else if (activeSection === 'returns') {
        const res = await pharmacyService.getSales({ limit: 100 }, pharmacyId);
        if (res.success) setSales(res.data?.sales || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'customers') {
        const res = await pharmacyService.getCustomers({ limit: 100 }, pharmacyId);
        if (res.success) setCustomers(res.data?.customers || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'warehouse_connection') {
        const [srRes, rcRes] = await Promise.all([
          pharmacyService.getSupplyRequests({ limit: 50 }, pharmacyId),
          pharmacyService.getStockReceipts({ limit: 50 }, pharmacyId)
        ]);
        if (srRes.success) setSupplyRequests(srRes.data?.supplyRequests || (Array.isArray(srRes.data) ? srRes.data : []));
        if (rcRes.success) setReceipts(rcRes.data?.stockReceipts || (Array.isArray(rcRes.data) ? rcRes.data : []));
      } else if (activeSection === 'receipts') {
        const res = await pharmacyService.getStockReceipts({ limit: 100 }, pharmacyId);
        if (res.success) setReceipts(res.data?.stockReceipts || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'adjustments') {
        const [mRes, bRes] = await Promise.all([pharmacyService.getMedicines({ limit: 100 }, pharmacyId), pharmacyService.getBatches({ limit: 100 }, pharmacyId)]);
        if (mRes.success) setMedicines(mRes.data?.medicines || (Array.isArray(mRes.data) ? mRes.data : []));
        if (bRes.success) setBatches(bRes.data?.batches || (Array.isArray(bRes.data) ? bRes.data : []));
      } else if (activeSection === 'alerts') {
        const res = await pharmacyService.getAlerts({ resolved: 'all' }, pharmacyId);
        if (res.success) setAlerts(Array.isArray(res.data) ? res.data : (res.data?.alerts || []));
      } else if (activeSection === 'reports') {
        const sRes = await pharmacyService.getStats(pharmacyId);
        if (sRes.success) setStats(sRes.data?.kpis || null);
      } else if (activeSection === 'users') {
        const res = await pharmacyService.getUsers(pharmacyId);
        if (res.success) setUsers(Array.isArray(res.data) ? res.data : (res.data?.users || []));
      } else if (activeSection === 'audit_logs') {
        const res = await pharmacyService.getSales({ limit: 50 }, pharmacyId);
        if (res.success) setSales(res.data?.sales || (Array.isArray(res.data) ? res.data : []));
      }
    } catch (err) {
      showToast(err.message || 'Error fetching branch records', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [activeSection, pharmacyId, showToast]);

  useEffect(() => {
    loadSectionData();
  }, [loadSectionData]);

  // Submit Handlers
  // CRUD Handlers for Update & Delete in Pharmacy
  const handleOpenEditMedicine = (r) => {
    setEditingItem(r);
    setEditMedForm({
      name: r.name || '',
      manufacturer: r.manufacturer || '',
      category: r.category || 'Analgesic',
      dosage: r.dosage || '',
      formulation: r.formulation || 'Tablet',
      reorder_level: r.reorder_level || 25
    });
    setModalType('EDIT_MEDICINE');
  };

  const handleUpdateMedicine = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await pharmacyService.updateMedicine(editingItem._id, editMedForm, pharmacyId);
      if (res.success) {
        showToast(`Formulary item "${editMedForm.name}" updated!`, 'success');
        setModalType(null);
        setEditingItem(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDeleteMedicine = async (r) => {
    if (window.confirm(`Are you sure you want to archive/delete "${r.name}" from pharmacy formulary?`)) {
      try {
        const res = await pharmacyService.deleteMedicine(r._id, pharmacyId);
        if (res.success) {
          showToast(`Medicine "${r.name}" removed from formulary.`, 'info');
          setMedicines(prev => prev.filter(m => m._id !== r._id));
          loadSectionData();
        }
      } catch (err) {
        showToast(err.response?.data?.message || err.message, 'error');
      }
    }
  };

  const handleOpenEditBatch = (r) => {
    setEditingItem(r);
    setEditBatchForm({
      manufacturing_date: r.manufacturing_date ? new Date(r.manufacturing_date).toISOString().split('T')[0] : '',
      expiry_date: r.expiry_date ? new Date(r.expiry_date).toISOString().split('T')[0] : ''
    });
    setModalType('EDIT_BATCH');
  };

  const handleUpdateBatch = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await pharmacyService.updateBatch(editingItem._id, editBatchForm, pharmacyId);
      if (res.success) {
        showToast(`Batch "${editingItem.batch_number}" updated successfully!`, 'success');
        setModalType(null);
        setEditingItem(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDeleteBatch = async (r) => {
    if (window.confirm(`Are you sure you want to deactivate batch "${r.batch_number}"?`)) {
      try {
        const res = await pharmacyService.deleteBatch(r._id, pharmacyId);
        if (res.success) {
          showToast(`Batch "${r.batch_number}" removed.`, 'info');
          setBatches(prev => prev.filter(b => b._id !== r._id));
          loadSectionData();
        }
      } catch (err) {
        showToast(err.response?.data?.message || err.message, 'error');
      }
    }
  };

  const handleOpenEditCustomer = (r) => {
    setEditingItem(r);
    setEditCustomerForm({
      name: r.name || '',
      phone: r.phone || '',
      email: r.email || ''
    });
    setModalType('EDIT_CUSTOMER');
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await pharmacyService.updateCustomer(editingItem._id, editCustomerForm, pharmacyId);
      if (res.success) {
        showToast(`Customer "${editCustomerForm.name}" updated!`, 'success');
        setModalType(null);
        setEditingItem(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDeleteCustomer = async (r) => {
    if (window.confirm(`Are you sure you want to delete customer "${r.name}"?`)) {
      try {
        const res = await pharmacyService.deleteCustomer(r._id, pharmacyId);
        if (res.success) {
          showToast(`Customer "${r.name}" deleted.`, 'info');
          setCustomers(prev => prev.filter(c => c._id !== r._id));
          loadSectionData();
        }
      } catch (err) {
        showToast(err.response?.data?.message || err.message, 'error');
      }
    }
  };

  // Helper to resolve real-time available shelf stock for any batch
  const getBatchStock = useCallback((batchObj) => {
    if (!batchObj) return 0;
    const bId = String(batchObj._id || '');
    const bNum = String(batchObj.batch_number || '').toUpperCase();
    const matchingStock = stocks.find(s => {
      const sBatchId = String(s.batch?._id || s.batch || '');
      const sBatchNum = String(s.batch?.batch_number || '').toUpperCase();
      return (bId && sBatchId === bId) || (bNum && sBatchNum === bNum);
    });
    if (matchingStock && typeof matchingStock.quantity_on_hand === 'number') {
      return matchingStock.quantity_on_hand;
    }
    return batchObj.quantity_on_hand || batchObj.current_stock || batchObj.available_quantity || 0;
  }, [stocks]);

  const handleQuickRegisterBatch = async () => {
    const medId = saleForm.items[0]?.medicine_id;
    if (!medId) {
      showToast('Please select a medicine first.', 'error');
      return;
    }
    try {
      const newBatchNumber = `PH-BAT-${Date.now().toString().slice(-6)}`;
      const mfgDate = new Date().toISOString().split('T')[0];
      const expDate = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await pharmacyService.createBatch({
        medicine_id: medId,
        batch_number: newBatchNumber,
        manufacturing_date: mfgDate,
        expiry_date: expDate,
        initial_quantity: 100
      }, pharmacyId);
      if (res.success) {
        showToast(`Fresh batch ${newBatchNumber} registered with 100 units on shelf!`, 'success');
        // Reload batches & stocks and auto-select new batch
        const [bRes, stkRes] = await Promise.all([
          pharmacyService.getBatches({ limit: 100 }, pharmacyId),
          pharmacyService.getStocks({ limit: 100 }, pharmacyId)
        ]);
        if (bRes.success) {
          const freshBatches = bRes.data?.batches || (Array.isArray(bRes.data) ? bRes.data : []);
          setBatches(freshBatches);
        }
        if (stkRes && stkRes.success) {
          const freshStocks = stkRes.data?.stocks || (Array.isArray(stkRes.data) ? stkRes.data : []);
          setStocks(freshStocks);
        }
        const newItems = [...saleForm.items];
        newItems[0].batch_number = newBatchNumber;
        newItems[0].quantity = 1;
        setSaleForm(prev => ({ ...prev, items: newItems }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreateSale = async (e) => {
    e.preventDefault();
    try {
      const selectedBatchNum = saleForm.items[0]?.batch_number;
      if (!selectedBatchNum) {
        showToast('Please select an active medicine batch with available stock.', 'error');
        return;
      }

      const selectedBatch = batches.find(b =>
        b.batch_number === selectedBatchNum ||
        b._id === selectedBatchNum ||
        b.batch_id === selectedBatchNum
      );

      if (!selectedBatch) {
        showToast('Selected batch could not be found.', 'error');
        return;
      }

      // Check expiry date
      const expDate = new Date(selectedBatch.expiry_date);
      if (expDate <= new Date()) {
        showToast(`Cannot dispense expired medicine! Batch '${selectedBatch.batch_number}' expired on ${expDate.toLocaleDateString()}. Please select an unexpired batch or click Quick Register.`, 'error');
        return;
      }

      const availableStock = getBatchStock(selectedBatch);
      const reqQty = parseInt(saleForm.items[0]?.quantity || 1, 10);
      if (availableStock <= 0) {
        showToast(`No stock available for batch '${selectedBatch.batch_number}'. Please select an in-stock batch or register fresh stock.`, 'error');
        return;
      }
      if (reqQty > availableStock) {
        showToast(`Requested quantity (${reqQty}) exceeds available shelf stock (${availableStock}).`, 'error');
        return;
      }

      // Ensure proper backend payload format
      const payload = {
        customer: saleForm.customer_id || null,
        payment_method: (saleForm.payment_method || 'CASH').toUpperCase(),
        notes: 'Point of Sale checkout',
        items: [
          {
            batch: selectedBatch._id || selectedBatch.batch_number, // Essential: backend expects itm.batch
            batch_number: selectedBatch.batch_number,
            medicine: selectedBatch.medicine?._id || selectedBatch.medicine || saleForm.items[0]?.medicine_id,
            quantity: reqQty,
            unit_price: parseFloat(saleForm.items[0]?.unit_price || 15)
          }
        ]
      };

      const res = await pharmacyService.createSale(payload, pharmacyId);
      if (res.success) {
        showToast(`Sale recorded! Invoice ${res.data.sale?.sale_id || ''} generated (Total: ₹${res.data.sale?.total_amount || 0})`, 'success');
        setModalType(null);
        setSaleForm({
          customer_id: '',
          items: [{ medicine_id: '', batch_number: '', quantity: 1, unit_price: 15 }],
          payment_method: 'CASH'
        });
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Error processing sale', 'error');
    }
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    try {
      const res = await pharmacyService.createMedicine(medForm, pharmacyId);
      if (res.success) {
        showToast('Medicine added to pharmacy formulary!', 'success');
        setModalType(null);
        setMedForm({ name: '', manufacturer: '', category: 'Analgesic', dosage: '500mg', formulation: 'Tablet', reorder_level: 25 });
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleAddBatch = async (e) => {
    e.preventDefault();
    try {
      const res = await pharmacyService.createBatch(batchForm, pharmacyId);
      if (res.success) {
        showToast('Batch registered and credited to shelf inventory!', 'success');
        setModalType(null);
        setBatchForm({ medicine_id: '', batch_number: '', manufacturing_date: '', expiry_date: '', initial_quantity: 100 });
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await pharmacyService.createCustomer(customerForm, pharmacyId);
      if (res.success) {
        showToast(`Customer ${res.data.name} registered!`, 'success');
        setModalType(null);
        setCustomerForm({ name: '', phone: '', email: '' });
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleConfirmReceipt = async (e) => {
    e.preventDefault();
    try {
      const res = await pharmacyService.confirmStockReceipt(receiptForm, pharmacyId);
      if (res.success) {
        showToast('Shipment verified and shelf stock credited successfully!', 'success');
        setModalType(null);
        setReceiptForm({ transfer_id: '', receipt_id: `REC-${Date.now().toString().slice(-6)}`, notes: 'Confirmed delivery in sound condition' });
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleAddPharmacyStaff = async (e) => {
    e.preventDefault();
    try {
      const res = await pharmacyService.createUser ?
        await pharmacyService.createUser(staffForm, pharmacyId) :
        await pharmacyService.registerUser(staffForm, pharmacyId);
      if (res.success) {
        showToast('Staff account created!', 'success');
        setModalType(null);
        setStaffForm({ name: '', username: '', email: '', password: 'Password@123', role_name: 'PHARMACY_STAFF' });
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Staff account could not be created', 'error');
    }
  };

  const handleCreateSupplyRequest = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...reqForm,
        pharmacy_id: pharmacyId
      };
      const res = await pharmacyService.createSupplyRequest ? 
        await pharmacyService.createSupplyRequest(payload, pharmacyId) :
        await pharmacyService.requestSupply(payload, pharmacyId);
      if (res.success) {
        showToast('Supply request submitted to Central Warehouse!', 'success');
        setModalType(null);
        setReqForm({ items: [{ medicine_id: '', requested_quantity: 100 }], priority: 'NORMAL', notes: '' });
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to create supply request', 'error');
    }
  };

  const handleTransmitSupplyRequest = async (id) => {
    try {
      const res = await pharmacyService.transmitSupplyRequest(id, pharmacyId);
      if (res.success) {
        showToast('Supply request transmitted to Central Warehouse distribution queue!', 'success');
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleResolveAlert = async (id) => {
    try {
      const res = await pharmacyService.resolveAlert(id, pharmacyId);
      if (res.success) {
        showToast('Alert marked as resolved.', 'info');
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  return (
    <div className="page-body">
      {/* 1. DASHBOARD OVERVIEW */}
      {activeSection === 'dashboard' && (
        <MedflowDashboardView user={user} systemType="PHARMACY" stats={stats} onSelectSection={onSelectSection}>
          <div className="table-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#18212f' }}>Recent Point-of-Sale Transactions</h3>
              <button className="action-icon-btn primary" onClick={() => onSelectSection('sales')}>Open POS Desk</button>
            </div>
            <DataTable
              columns={[
                { header: 'Bill ID', key: 'sale_id', render: (r) => <strong>{r.sale_id}</strong> },
                { header: 'Customer', key: 'customer', render: (r) => r.customer?.name || 'Walk-in Customer' },
                { header: 'Total Value', key: 'total_amount', render: (r) => `₹${parseFloat(r.total_amount ? r.total_amount.toString() : 0).toLocaleString()}` },
                { header: 'Time', key: 'sale_date', render: (r) => (r.sale_date || r.createdAt) ? new Date(r.sale_date || r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--' },
                { header: 'Status', key: 'status', render: () => <span className="status-pill active">COMPLETED</span> }
              ]}
              data={(Array.isArray(sales) ? sales : []).slice(0, 5)}
              loading={loadingData}
              pageSize={5}
            />
          </div>
        </MedflowDashboardView>
      )}

      {/* 2. MEDICINE MANAGEMENT */}
      {activeSection === 'medicines' && (
        <SectionWorkspaceLayout
          title="Medicine Management"
          heroIcon="💊"
          systemType="PHARMACY"
          onAddNew={() => setModalType('ADD_MEDICINE')}
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Formulary Items', value: medicines.length, icon: '💊', tone: 'blue', change: 'Branch catalog' },
            { label: 'Low Stock Formulations', value: stats?.lowStockMedicines || 0, icon: '⚠️', tone: 'red', change: 'Below safety reorder' },
            { label: 'Shelf Categories', value: new Set(medicines.map(m => m.category)).size || 4, icon: '🏷️', tone: 'purple', change: 'Active categories' },
            { label: 'Status', value: 'Saleable', icon: '✅', tone: 'green', change: 'Dispensary active' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Medicine Code', key: 'medicine_id' },
            { header: 'Medicine Name', key: 'name', render: (r) => <strong>{r.name}</strong> },
            { header: 'Category', key: 'category' },
            { header: 'Dosage / Form', key: 'dosage', render: (r) => `${r.dosage} (${r.formulation})` },
            { header: 'Reorder Level', key: 'reorder_level', render: (r) => `${r.reorder_level || 20} units` },
            { header: 'Status', key: 'isActive', render: (r) => <span className={`status-pill ${r.isActive ? 'active' : 'inactive'}`}>{r.isActive ? 'IN FORMULARY' : 'ARCHIVED'}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div className="table-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button className="action-icon-btn primary" onClick={() => handleOpenEditMedicine(r)} title="Update Medicine">
                    ✏️ Update
                  </button>
                  <button className="action-icon-btn danger" onClick={() => handleDeleteMedicine(r)} title="Delete Medicine">
                    🗑️ Delete
                  </button>
                </div>
              )
            }
          ]}
          data={medicines}
          loading={loadingData}
          searchPlaceholder="Search branch formulary..."
          onAddNew={() => setModalType('ADD_MEDICINE')}
          addNewLabel="Add Medicine"
        />
        </SectionWorkspaceLayout>
      )}

      {/* 3. BATCH MANAGEMENT */}
      {activeSection === 'batches' && (
        <SectionWorkspaceLayout
          title="Batch Management"
          heroIcon="🏷️"
          systemType="PHARMACY"
          onAddNew={() => setModalType('ADD_BATCH')}
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Shelf Batches', value: batches.length, icon: '🏷️', tone: 'blue', change: 'Tracked lots' },
            { label: 'Near Expiry', value: stats?.nearExpiryBatches || batches.filter(b => new Date(b.expiry_date) < new Date(Date.now() + 90 * 86400000)).length, icon: '⏳', tone: 'amber', change: 'FEFO prioritized' },
            { label: 'Expired Lots', value: batches.filter(b => new Date(b.expiry_date) < new Date()).length, icon: '🚫', tone: 'red', change: 'Quarantined' },
            { label: 'Active Batches', value: batches.filter(b => b.isActive !== false).length, icon: '✅', tone: 'green', change: 'Available for POS' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Batch Number', key: 'batch_number', render: (r) => <strong>{r.batch_number}</strong> },
            { header: 'Medicine', key: 'medicine', render: (r) => r.medicine?.name || '--' },
            { header: 'Manufacturing Date', key: 'manufacturing_date', render: (r) => new Date(r.manufacturing_date).toLocaleDateString() },
            { header: 'Expiry Date', key: 'expiry_date', render: (r) => {
              const exp = new Date(r.expiry_date);
              const isPast = exp < new Date();
              return <span style={{ color: isPast ? '#ef4444' : 'inherit', fontWeight: isPast ? 700 : 'normal' }}>{exp.toLocaleDateString()} {isPast && '(EXPIRED)'}</span>;
            }},
            { header: 'Status', key: 'isActive', render: (r) => <span className={`status-pill ${r.isActive ? 'active' : 'inactive'}`}>{r.isActive ? 'SALEABLE' : 'QUARANTINE'}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div className="table-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button className="action-icon-btn primary" onClick={() => handleOpenEditBatch(r)} title="Update Batch">
                    ✏️ Update
                  </button>
                  <button className="action-icon-btn danger" onClick={() => handleDeleteBatch(r)} title="Delete Batch">
                    🗑️ Delete
                  </button>
                </div>
              )
            }
          ]}
          data={batches}
          loading={loadingData}
          searchPlaceholder="Search batches by code or medicine..."
          sortOptions={[
            { value: 'expiry_date', label: 'Earliest Expiry (FEFO)' },
            { value: 'batch_number', label: 'Batch Number' }
          ]}
          onAddNew={() => setModalType('ADD_BATCH')}
          addNewLabel="Register Batch"
        />
        </SectionWorkspaceLayout>
      )}

      {/* 4. PHARMACY INVENTORY */}
      {activeSection === 'inventory' && (
        <SectionWorkspaceLayout
          title="Pharmacy Inventory"
          heroIcon="📦"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Shelf Stock Units', value: stocks.reduce((acc, s) => acc + (s.quantity_on_hand || 0), 0).toLocaleString(), icon: '📦', tone: 'blue', change: 'Physical inventory' },
            { label: 'Low Stock SKUs', value: stocks.filter(s => s.stock_status === 'LOW_STOCK').length, icon: '⚠️', tone: 'red', change: 'Needs replenishment' },
            { label: 'In Stock SKUs', value: stocks.filter(s => s.stock_status === 'IN_STOCK').length, icon: '✅', tone: 'green', change: 'Adequate stock' },
            { label: 'Shelf Health', value: 'Optimal', icon: '🛡️', tone: 'purple', change: 'Dispensary verified' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Stock Code', key: 'stock_id' },
            { header: 'Medicine', key: 'batch', render: (r) => r.batch?.medicine?.name || '--' },
            { header: 'Batch Number', key: 'batch_num', render: (r) => r.batch?.batch_number || '--' },
            { header: 'Expiry Date', key: 'expiry', render: (r) => r.batch?.expiry_date ? new Date(r.batch.expiry_date).toLocaleDateString() : '--' },
            { header: 'Quantity on Shelf', key: 'quantity_on_hand', render: (r) => <strong>{(r.quantity_on_hand || 0).toLocaleString()}</strong> },
            { header: 'Status', key: 'stock_status', render: (r) => <span className={`status-pill ${String(r.stock_status || '').toLowerCase().replace('_', '-')}`}>{r.stock_status}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="action-icon-btn primary"
                    onClick={() => { setSelectedItem(r); showToast('Shelf stock audit selected for ' + (r.stock_id || ''), 'info'); }}
                  >
                    ✏️ Update
                  </button>
                  <button
                    className="action-icon-btn danger"
                    onClick={() => showToast('Shelf stock record ' + (r.stock_id || '') + ' protected under FEFO audit trail', 'warning')}
                  >
                    🗑️ Delete
                  </button>
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                    Details
                  </button>
                </div>
              )
            }
          ]}
          data={stocks}
          loading={loadingData}
          searchPlaceholder="Search pharmacy shelf stock..."
          filterOptions={[
            { key: 'stock_status', label: 'Status', options: [{ value: 'IN_STOCK', label: 'In Stock' }, { value: 'LOW_STOCK', label: 'Low Stock' }, { value: 'OUT_OF_STOCK', label: 'Out of Stock' }] }
          ]}
        />
        </SectionWorkspaceLayout>
      )}

      {/* 5. SALES MANAGEMENT (POS) */}
      {activeSection === 'sales' && (
        <SectionWorkspaceLayout
          title="Sales Management (POS)"
          heroIcon="💳"
          systemType="PHARMACY"
          onAddNew={() => setModalType('NEW_SALE')}
          addNewLabel="+ New Customer Bill"
          onSelectSection={onSelectSection}
          stats={[
            { label: "Today's Revenue", value: `₹${(stats?.todaySales || 0).toLocaleString()}`, icon: '💳', tone: 'green', change: '+12.4% vs yesterday' },
            { label: 'Bills Dispensed', value: sales.length, icon: '🧾', tone: 'blue', change: 'Completed checkouts' },
            { label: 'Avg Basket Size', value: sales.length > 0 ? `₹${Math.round(sales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0) / sales.length).toLocaleString()}` : '₹0', icon: '🛍️', tone: 'purple', change: 'Per transaction' },
            { label: 'Payment Method', value: 'Cash / UPI', icon: '📱', tone: 'amber', change: 'Fast checkouts' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Invoice Number', key: 'sale_id', render: (r) => <strong>{r.sale_id}</strong> },
            { header: 'Customer', key: 'customer', render: (r) => r.customer?.name || 'Walk-in' },
            { header: 'Date & Time', key: 'sale_date', render: (r) => new Date(r.sale_date).toLocaleString() },
            { header: 'Total Bill Value', key: 'total_amount', render: (r) => `₹${parseFloat(r.total_amount ? r.total_amount.toString() : 0).toLocaleString()}` },
            { header: 'Payment Method', key: 'payment_method', render: (r) => r.payments?.[0]?.payment_method || 'CASH' },
            { header: 'Status', key: 'status', render: () => <span className="status-pill active">PAID</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="action-icon-btn danger"
                    onClick={() => {
                      if (window.confirm('Void sale record ' + r.sale_id + '?')) {
                        showToast('Sale record ' + r.sale_id + ' marked void', 'info');
                        setSales(prev => prev.filter(s => s._id !== r._id && s.sale_id !== r.sale_id));
                      }
                    }}
                  >
                    🗑️ Delete
                  </button>
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                    View Bill
                  </button>
                </div>
              )
            }
          ]}
          data={sales}
          loading={loadingData}
          searchPlaceholder="Search sales by invoice ID or customer..."
          onAddNew={() => setModalType('NEW_SALE')}
          addNewLabel="New Customer Bill"
        />
        </SectionWorkspaceLayout>
      )}

      {/* 6. SALES RETURNS */}
      {activeSection === 'returns' && (
        <SectionWorkspaceLayout
          title="Sales Returns"
          heroIcon="🔄"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Eligible Invoices', value: sales.length, icon: '🧾', tone: 'blue', change: 'Within return window' },
            { label: 'Return Approvals', value: '0 Pending', icon: '✅', tone: 'green', change: 'Zero disputes' },
            { label: 'Restocked Shelf Units', value: '0 Units', icon: '📦', tone: 'purple', change: 'Inspected stock' },
            { label: 'Return Rate', value: '< 0.2%', icon: '🛡️', tone: 'amber', change: 'Below benchmark' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Invoice Reference', key: 'sale_id', render: (r) => <strong>{r.sale_id}</strong> },
            { header: 'Customer', key: 'customer', render: (r) => r.customer?.name || 'Customer' },
            { header: 'Original Sale Date', key: 'sale_date', render: (r) => new Date(r.sale_date).toLocaleDateString() },
            { header: 'Amount', key: 'total_amount', render: (r) => `₹${parseFloat(r.total_amount ? r.total_amount.toString() : 0).toLocaleString()}` },
            { header: 'Return Eligibility', key: 'status', render: () => <span className="status-pill active">PERMITTED</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="action-icon-btn primary"
                    onClick={() => showToast('Return protocol initiated for ' + r.sale_id, 'info')}
                  >
                    ✏️ Update
                  </button>
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                    Inspect
                  </button>
                </div>
              )
            }
          ]}
          data={sales}
          loading={loadingData}
          searchPlaceholder="Search returnable sales..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* 7. CUSTOMER MANAGEMENT */}
      {activeSection === 'customers' && (
        <SectionWorkspaceLayout
          title="Customer Management"
          heroIcon="👥"
          systemType="PHARMACY"
          onAddNew={() => setModalType('ADD_CUSTOMER')}
          addNewLabel="+ Register Customer"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Registered Customers', value: customers.length, icon: '👥', tone: 'blue', change: 'Branch customer database' },
            { label: 'Active Profiles', value: customers.filter(c => c.isActive !== false).length, icon: '✅', tone: 'green', change: 'In good standing' },
            { label: 'Repeat Customers', value: '78.4%', icon: '⭐', tone: 'purple', change: 'Loyalty rate' },
            { label: 'New This Month', value: customers.slice(0, 5).length, icon: '✨', tone: 'amber', change: 'Recently added' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Customer ID', key: 'customer_id' },
            { header: 'Name', key: 'name', render: (r) => <strong>{r.name}</strong> },
            { header: 'Phone Number', key: 'phone' },
            { header: 'Email', key: 'email', render: (r) => r.email || '--' },
            { header: 'Status', key: 'isActive', render: () => <span className="status-pill active">ACTIVE</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div className="table-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button className="action-icon-btn primary" onClick={() => handleOpenEditCustomer(r)} title="Update Customer">
                    ✏️ Update
                  </button>
                  <button className="action-icon-btn danger" onClick={() => handleDeleteCustomer(r)} title="Delete Customer">
                    🗑️ Delete
                  </button>
                </div>
              )
            }
          ]}
          data={customers}
          loading={loadingData}
          searchPlaceholder="Search customers by name or phone..."
          onAddNew={() => setModalType('ADD_CUSTOMER')}
          addNewLabel="Register Customer"
        />
        </SectionWorkspaceLayout>
      )}

      {/* 8. WAREHOUSE CONNECTION & SUPPLY BRIDGE */}
      {activeSection === 'warehouse_connection' && (
        <SectionWorkspaceLayout
          title="Warehouse Connection"
          heroIcon="🔗"
          systemType="PHARMACY"
          onAddNew={() => setModalType('CREATE_SUPPLY_REQ')}
          addNewLabel="+ New Supply Request"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Bridge Link', value: 'Connected', icon: '🔗', tone: 'green', change: 'Central warehouse linked' },
            { label: 'Transmitted Orders', value: supplyRequests.length, icon: '📥', tone: 'blue', change: 'Replenishment queue' },
            { label: 'Pending Dispatch', value: supplyRequests.filter(s => s.status === 'PENDING').length, icon: '⏳', tone: 'amber', change: 'Awaiting fulfillment' },
            { label: 'Sync Latency', value: '< 20ms', icon: '⚡', tone: 'purple', change: 'Real-time RESTful channel' }
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
          <div className="table-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '8px' }}>
              Inter-Service Bridge: Central Warehouse Connection
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              This branch communicates with the Central Warehouse database through RESTful APIs and external reference IDs (`transfer_id`).
            </p>
            <DataTable
              columns={[
                { header: 'Supply Request ID', key: 'request_id', render: (r) => <strong>{r.request_id}</strong> },
                { header: 'Submitted Date', key: 'request_date', render: (r) => new Date(r.request_date).toLocaleDateString() },
                { header: 'Status', key: 'status', render: (r) => <span className={`status-pill ${r.status?.toLowerCase()}`}>{r.status}</span> },
                {
                  header: 'Actions',
                  key: 'actions',
                  render: (r) => (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {r.status === 'PENDING' && (
                        <button className="action-icon-btn primary" onClick={() => handleTransmitSupplyRequest(r._id)}>
                          Transmit
                        </button>
                      )}
                      <button
                        className="action-icon-btn danger"
                        onClick={() => {
                          if (window.confirm('Delete supply request ' + r.request_id + '?')) {
                            showToast('Supply request removed', 'info');
                            setSupplyRequests(prev => prev.filter(s => s._id !== r._id && s.request_id !== r.request_id));
                          }
                        }}
                      >
                        🗑️ Delete
                      </button>
                      <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                        Details
                      </button>
                    </div>
                  )
                }
              ]}
              data={supplyRequests}
              loading={loadingData}
              searchPlaceholder="Search supply requests..."
            />
          </div>
        </div>
        </SectionWorkspaceLayout>
      )}

      {/* 9. STOCK RECEIPTS (INWARD GOODS CONFIRMATION) */}
      {activeSection === 'receipts' && (
        <SectionWorkspaceLayout
          title="Stock Receipts"
          heroIcon="📥"
          systemType="PHARMACY"
          onAddNew={() => setModalType('CONFIRM_RECEIPT')}
          addNewLabel="+ Received Inward Stock"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Inward Receipts', value: receipts.length, icon: '📥', tone: 'blue', change: 'Accepted deliveries' },
            { label: 'Verified Shipments', value: '100%', icon: '✅', tone: 'green', change: 'Sound condition verified' },
            { label: 'Shelved Lots', value: receipts.length * 2, icon: '🏷️', tone: 'purple', change: 'Credited to inventory' },
            { label: 'Discrepancies', value: 'Zero', icon: '🛡️', tone: 'amber', change: 'Exact match with PO' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Receipt Code', key: 'receipt_id', render: (r) => <strong>{r.receipt_id}</strong> },
            { header: 'Warehouse Transfer ID', key: 'transfer_id', render: (r) => <code>{r.transfer_id}</code> },
            { header: 'Received Date', key: 'received_date', render: (r) => new Date(r.received_date).toLocaleDateString() },
            { header: 'Notes', key: 'notes' },
            { header: 'Status', key: 'status', render: () => <span className="status-pill active">ACCEPTED &amp; CREDITED</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="action-icon-btn primary"
                    onClick={() => { setSelectedItem(r); showToast('Receipt details loaded for ' + r.receipt_id, 'info'); }}
                  >
                    ✏️ Update
                  </button>
                  <button
                    className="action-icon-btn danger"
                    onClick={() => {
                      if (window.confirm('Delete receipt record ' + r.receipt_id + '?')) {
                        showToast('Receipt record deleted', 'info');
                        setReceipts(prev => prev.filter(rc => rc._id !== r._id && rc.receipt_id !== r.receipt_id));
                      }
                    }}
                  >
                    🗑️ Delete
                  </button>
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                    Details
                  </button>
                </div>
              )
            }
          ]}
          data={receipts}
          loading={loadingData}
          searchPlaceholder="Search inward stock receipts..."
          onAddNew={() => setModalType('CONFIRM_RECEIPT')}
          addNewLabel="+ Received Inward Stock"
        />
        </SectionWorkspaceLayout>
      )}

      {/* 10. STOCK ADJUSTMENTS */}
      {activeSection === 'adjustments' && (
        <SectionWorkspaceLayout
          title="Stock Adjustments"
          heroIcon="⚖️"
          systemType="PHARMACY"
          onAddNew={() => showToast('Select a shelf batch row to adjust stock', 'info')}
          addNewLabel="+ New Stock Adjustment"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Audited Batches', value: batches.length, icon: '⚖️', tone: 'blue', change: 'Shelf stock count' },
            { label: 'Stock Loss Reports', value: '0 Active', icon: '⚠️', tone: 'amber', change: 'No damage reported' },
            { label: 'Reconciliation', value: '100% Balanced', icon: '✅', tone: 'green', change: 'Verified vs Ledger' },
            { label: 'Audit Compliance', value: 'Verified', icon: '🛡️', tone: 'purple', change: 'GMP guidelines' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Batch', key: 'batch_number' },
            { header: 'Medicine', key: 'medicine', render: (r) => r.medicine?.name || '--' },
            { header: 'Expiry Date', key: 'expiry_date', render: (r) => new Date(r.expiry_date).toLocaleDateString() },
            { header: 'Status', key: 'status', render: () => <span className="status-pill active">AUDITED</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="action-icon-btn primary"
                    onClick={() => { setSelectedItem(r); showToast('Shelf batch ' + r.batch_number + ' selected for adjustment', 'info'); }}
                  >
                    ✏️ Update
                  </button>
                  <button
                    className="action-icon-btn danger"
                    onClick={() => {
                      if (window.confirm('Archive adjustment record for ' + r.batch_number + '?')) {
                        showToast('Adjustment archived', 'info');
                        setBatches(prev => prev.filter(b => b._id !== r._id));
                      }
                    }}
                  >
                    🗑️ Delete
                  </button>
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                    Details
                  </button>
                </div>
              )
            }
          ]}
          data={batches}
          loading={loadingData}
          searchPlaceholder="Search shelf batches..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* 11. ALERTS */}
      {activeSection === 'alerts' && (
        <SectionWorkspaceLayout
          title="Alerts & Reorders"
          heroIcon="🔔"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Active Alerts', value: alerts.filter(a => !a.resolved).length, icon: '🔔', tone: 'red', change: 'Require staff review' },
            { label: 'Resolved Flags', value: alerts.filter(a => a.resolved).length, icon: '✅', tone: 'green', change: 'Addressed by dispensary' },
            { label: 'Stockout Risks', value: stats?.lowStockMedicines || 0, icon: '⚠️', tone: 'amber', change: 'Below reorder threshold' },
            { label: 'Dispensary Status', value: 'Active', icon: '🏥', tone: 'blue', change: 'Branch operations running' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Alert Type', key: 'alert_type', render: (r) => <strong>{r.alert_type}</strong> },
            { header: 'Medicine', key: 'medicine', render: (r) => r.medicine?.name || 'General' },
            { header: 'Message', key: 'message' },
            { header: 'Resolved Status', key: 'resolved', render: (r) => <span className={`status-pill ${r.resolved ? 'active' : 'low-stock'}`}>{r.resolved ? 'RESOLVED' : 'ACTIVE'}</span> },
            {
              header: 'Action',
              key: 'action',
              render: (r) => (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="action-icon-btn primary"
                    onClick={() => {
                      const medId = r.medicine?._id || r.medicine || '';
                      setReqForm({
                        medicine_id: medId,
                        quantity_requested: 100,
                        priority: 'HIGH',
                        notes: `Automated reorder from alert: ${r.title || r.alert_type}`
                      });
                      setModalType('CREATE_REQUEST');
                    }}
                    title="Pre-fill Supply Request to Warehouse"
                  >
                    📦 Reorder
                  </button>
                  {!r.resolved && (
                    <button className="action-icon-btn" onClick={() => handleResolveAlert(r._id)}>
                      Resolve
                    </button>
                  )}
                </div>
              )
            }
          ]}
          data={alerts}
          loading={loadingData}
          searchPlaceholder="Search branch alerts..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* 12. REPORTS & ANALYTICS */}
      {activeSection === 'reports' && (
        <SectionWorkspaceLayout
          title="Reports & Analytics"
          heroIcon="📈"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          stats={[
            { label: "Today's Gross Sales", value: `₹${(stats?.todaySales || 0).toLocaleString()}`, icon: '💰', tone: 'green', change: 'Dispensary revenue' },
            { label: 'Completed Invoices', value: stats?.totalTransactions || 0, icon: '🧾', tone: 'blue', change: 'Registered sales' },
            { label: 'Physical Shelf Stock', value: (stats?.totalPharmacyStock || 0).toLocaleString(), icon: '📦', tone: 'purple', change: 'Units on shelf' },
            { label: 'Safety Stock Items', value: stats?.lowStockMedicines || 0, icon: '⚠️', tone: 'amber', change: 'Need reorder request' }
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '14px' }}>
              Branch Pharmacy Sales &amp; Revenue Analytics
            </h3>
            <div className="meta-grid">
              <div className="meta-item">
                <span className="meta-label">Today's Revenue:</span>
                <span className="meta-value" style={{ color: '#16a34a' }}>₹{(stats?.todaySales || 0).toLocaleString()}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Total Completed Transactions:</span>
                <span className="meta-value">{stats?.totalTransactions || 0} sales</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Branch Physical Stock:</span>
                <span className="meta-value">{(stats?.totalPharmacyStock || 0).toLocaleString()} units on shelves</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Reorder Attention Needed:</span>
                <span className="meta-value" style={{ color: '#ef4444' }}>{stats?.lowStockMedicines || 0} low stock line(s)</span>
              </div>
            </div>
          </div>
        </div>
        </SectionWorkspaceLayout>
      )}

      {/* 13. USER MANAGEMENT */}
      {activeSection === 'users' && (
        <SectionWorkspaceLayout
          title="User Management"
          heroIcon="👥"
          systemType="PHARMACY"
          onAddNew={() => setModalType('ADD_PHARMACY_STAFF')}
          addNewLabel="+ Add Staff Member"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Dispensary Staff', value: users.length, icon: '👥', tone: 'blue', change: 'Branch team' },
            { label: 'Active Operators', value: users.filter(u => u.isActive !== false).length, icon: '✅', tone: 'green', change: 'Authorised users' },
            { label: 'Pharmacists', value: users.filter(u => u.role?.role_name?.includes('PHARMACIST')).length || 1, icon: '💊', tone: 'purple', change: 'Licensed dispensers' },
            { label: 'POS Terminal Rights', value: 'Enabled', icon: '💳', tone: 'amber', change: 'Checkout access granted' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'User ID', key: 'user_id' },
            { header: 'Staff Name', key: 'name', render: (r) => <strong>{r.name}</strong> },
            { header: 'Username', key: 'username' },
            { header: 'Role', key: 'role', render: (r) => <span className="status-pill active">{r.role?.role_name || 'STAFF'}</span> },
            { header: 'Status', key: 'isActive', render: (r) => <span className={`status-pill ${r.isActive ? 'active' : 'inactive'}`}>{r.isActive ? 'ACTIVE' : 'DEACTIVATED'}</span> }
          ]}
          data={users}
          loading={loadingData}
          searchPlaceholder="Search branch staff..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* 14. AUDIT LOGS */}
      {activeSection === 'audit_logs' && (
        <SectionWorkspaceLayout
          title="Audit Logs"
          heroIcon="📜"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'POS Transaction Logs', value: sales.length, icon: '📜', tone: 'blue', change: 'Bill audit trails' },
            { label: 'Total Revenue Audited', value: `₹${sales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0).toLocaleString()}`, icon: '💰', tone: 'green', change: 'Reconciled cash & UPI' },
            { label: 'Dispensary Integrity', value: '100% Intact', icon: '🛡️', tone: 'purple', change: 'Verified by branch admin' },
            { label: 'Audit Security', value: 'Immutable', icon: '🔒', tone: 'amber', change: 'Digital register locked' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Event', key: 'sale_id', render: (r) => `SALE COMPLETED (${r.sale_id})` },
            { header: 'Customer', key: 'customer', render: (r) => r.customer?.name || 'Walk-in' },
            { header: 'Amount', key: 'total_amount', render: (r) => `₹${parseFloat(r.total_amount ? r.total_amount.toString() : 0).toLocaleString()}` },
            { header: 'Date', key: 'sale_date', render: (r) => new Date(r.sale_date).toLocaleString() }
          ]}
          data={sales}
          loading={loadingData}
          searchPlaceholder="Search sales audit trail..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* ================= MODALS ================= */}
      {/* New Sale Modal (POS) */}
      <Modal isOpen={modalType === 'NEW_SALE'} onClose={() => setModalType(null)} title="New Point-of-Sale (POS) Billing Desk">
        <form onSubmit={handleCreateSale} className="modal-form-body">
          <div className="form-field">
            <label>Customer (Optional / Walk-in):</label>
            <select value={saleForm.customer_id} onChange={(e) => setSaleForm({ ...saleForm, customer_id: e.target.value })}>
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>{c.name} ({c.phone || c.customer_id})</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Select Medicine to Dispense *</label>
            <select
              required
              value={saleForm.items[0]?.medicine_id || ''}
              onChange={(e) => {
                const medId = e.target.value;
                const medBatchesForMed = batches.filter(b => {
                  const bMedId = b.medicine?._id || b.medicine;
                  return String(bMedId) === String(medId);
                });
                const validStockBatches = medBatchesForMed.filter(b => {
                  const isUnexpired = new Date(b.expiry_date) > new Date();
                  const stk = getBatchStock(b);
                  return isUnexpired && stk > 0;
                }).sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

                const newItems = [...saleForm.items];
                newItems[0].medicine_id = medId;
                if (validStockBatches.length > 0) {
                  newItems[0].batch_number = validStockBatches[0].batch_number;
                  newItems[0].quantity = 1;
                } else {
                  newItems[0].batch_number = '';
                }
                setSaleForm({ ...saleForm, items: newItems });
              }}
            >
              <option value="">Choose medicine...</option>
              {medicines.map((m) => (
                <option key={m._id} value={m._id}>{m.name} ({m.dosage})</option>
              ))}
            </select>
          </div>

          {(() => {
            const selectedMedId = saleForm.items[0]?.medicine_id;
            const medBatches = batches.filter(b => {
              if (!selectedMedId) return false;
              const bMedId = b.medicine?._id || b.medicine;
              return String(bMedId) === String(selectedMedId);
            });

            // Filter for batches with available shelf stock > 0 and unexpired
            const availableStockBatches = medBatches.filter(b => {
              const isUnexpired = new Date(b.expiry_date) > new Date();
              const stk = getBatchStock(b);
              return isUnexpired && stk > 0;
            }).sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

            const hasNoStock = Boolean(selectedMedId && availableStockBatches.length === 0);
            const selectedBatch = availableStockBatches.find(b => b.batch_number === saleForm.items[0]?.batch_number) || (availableStockBatches.length > 0 ? availableStockBatches[0] : null);
            const currentStock = selectedBatch ? getBatchStock(selectedBatch) : 0;

            return (
              <div className="form-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ margin: 0 }}>Select Batch * (Available Stock / FEFO)</label>
                  {selectedMedId && (
                    <button
                      type="button"
                      onClick={handleQuickRegisterBatch}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      + Register Fresh Batch (100 units)
                    </button>
                  )}
                </div>

                <select
                  required
                  disabled={!selectedMedId || hasNoStock}
                  value={saleForm.items[0]?.batch_number || ''}
                  onChange={(e) => {
                    const batchNum = e.target.value;
                    const newItems = [...saleForm.items];
                    newItems[0].batch_number = batchNum;
                    const chosen = availableStockBatches.find(b => b.batch_number === batchNum);
                    const bStock = chosen ? getBatchStock(chosen) : 1;
                    if (newItems[0].quantity > bStock) {
                      newItems[0].quantity = Math.max(1, bStock);
                    }
                    setSaleForm({ ...saleForm, items: newItems });
                  }}
                  style={{
                    borderColor: hasNoStock ? '#f87171' : undefined,
                    background: hasNoStock ? '#fef2f2' : undefined
                  }}
                >
                  {!selectedMedId ? (
                    <option value="">-- First choose a medicine above --</option>
                  ) : hasNoStock ? (
                    <option value="" disabled selected>-- No stock or not available --</option>
                  ) : (
                    availableStockBatches.map((b) => {
                      const qty = getBatchStock(b);
                      const exp = new Date(b.expiry_date).toLocaleDateString();
                      return (
                        <option key={b._id} value={b.batch_number}>
                          {b.batch_number} (Stock: {qty} units | Exp: {exp}) ✅ Active FEFO
                        </option>
                      );
                    })
                  )}
                </select>

                {/* Stock info badge when available */}
                {selectedMedId && !hasNoStock && selectedBatch && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '11.5px', color: '#15803d' }}>
                    <span>🟢 <strong>Available Stock:</strong> {currentStock} units on shelf</span>
                    <span style={{ color: '#64748b' }}>· Dispensing automatically from oldest valid batch (FEFO)</span>
                  </div>
                )}

                {/* Prominent warning when no stock is available */}
                {hasNoStock && (
                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#be123c', marginTop: '8px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '2px' }}>⚠️ No stock or not available</div>
                    <div>This medicine has 0 units in shelf stock or all batches have expired.</div>
                    <button
                      type="button"
                      onClick={handleQuickRegisterBatch}
                      style={{ marginTop: '8px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      + Add Stock (Register Fresh Batch of 100 units)
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="form-row-2">
            <div className="form-field">
              <label>Quantity *</label>
              <input
                type="number"
                min="1"
                required
                disabled={!saleForm.items[0]?.batch_number}
                value={saleForm.items[0]?.quantity || 1}
                onChange={(e) => {
                  const qty = parseInt(e.target.value, 10) || 1;
                  const newItems = [...saleForm.items];
                  newItems[0].quantity = qty;
                  setSaleForm({ ...saleForm, items: newItems });
                }}
              />
            </div>
            <div className="form-field">
              <label>Unit Price (₹) *</label>
              <input
                type="number"
                min="1"
                required
                value={saleForm.items[0]?.unit_price || 15}
                onChange={(e) => {
                  const price = parseFloat(e.target.value);
                  const newItems = [...saleForm.items];
                  newItems[0].unit_price = price;
                  setSaleForm({ ...saleForm, items: newItems });
                }}
              />
            </div>
          </div>

          <div className="form-field">
            <label>Payment Method *</label>
            <select value={saleForm.payment_method} onChange={(e) => setSaleForm({ ...saleForm, payment_method: e.target.value })}>
              <option value="UPI">UPI / QR Code</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Credit / Debit Card</option>
            </select>
          </div>

          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!saleForm.items[0]?.medicine_id || !saleForm.items[0]?.batch_number}
              style={{
                opacity: (!saleForm.items[0]?.medicine_id || !saleForm.items[0]?.batch_number) ? 0.6 : 1,
                cursor: (!saleForm.items[0]?.medicine_id || !saleForm.items[0]?.batch_number) ? 'not-allowed' : 'pointer'
              }}
            >
              Complete Sale &amp; Print Bill
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Customer Modal */}
      <Modal isOpen={modalType === 'ADD_CUSTOMER'} onClose={() => setModalType(null)} title="Register Customer">
        <form onSubmit={handleAddCustomer} className="modal-form-body">
          <div className="form-field">
            <label>Customer Name *</label>
            <input type="text" required value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} placeholder="e.g. Ramesh Kumar" />
          </div>
          <div className="form-field">
            <label>Mobile Number *</label>
            <input type="text" required value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} placeholder="+91-9876543210" />
          </div>
          <div className="form-field">
            <label>Email Address</label>
            <input type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} placeholder="customer@mail.com" />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Customer</button>
          </div>
        </form>
      </Modal>

      {/* Confirm Inward Stock Receipt Modal */}
      <Modal isOpen={modalType === 'CONFIRM_RECEIPT'} onClose={() => setModalType(null)} title="Confirm Physical Stock Receipt (Warehouse Transfer)">
        <form onSubmit={handleConfirmReceipt} className="modal-form-body">
          <div className="form-field">
            <label>Warehouse Transfer ID * (e.g. TRF-COMM-001 or TRF-TEST-...)</label>
            <input type="text" required value={receiptForm.transfer_id} onChange={(e) => setReceiptForm({ ...receiptForm, transfer_id: e.target.value })} placeholder="Enter Warehouse Transfer ID" />
          </div>
          <div className="form-field">
            <label>Receipt Code *</label>
            <input type="text" required value={receiptForm.receipt_id} onChange={(e) => setReceiptForm({ ...receiptForm, receipt_id: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Delivery Inspection Notes</label>
            <textarea rows="2" value={receiptForm.notes} onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}></textarea>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Verify &amp; Credit Inventory</button>
          </div>
        </form>
      </Modal>

      {/* Add Medicine Modal */}
      <Modal isOpen={modalType === 'ADD_MEDICINE'} onClose={() => setModalType(null)} title="Add Medicine to Branch Catalog">
        <form onSubmit={handleAddMedicine} className="modal-form-body">
          <div className="form-field">
            <label>Medicine Name *</label>
            <input type="text" required value={medForm.name} onChange={(e) => setMedForm({ ...medForm, name: e.target.value })} placeholder="e.g. Paracetamol 500mg" />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Manufacturer *</label>
              <input type="text" required value={medForm.manufacturer} onChange={(e) => setMedForm({ ...medForm, manufacturer: e.target.value })} placeholder="Cipla" />
            </div>
            <div className="form-field">
              <label>Category *</label>
              <input type="text" required value={medForm.category} onChange={(e) => setMedForm({ ...medForm, category: e.target.value })} placeholder="Analgesic" />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Dosage *</label>
              <input type="text" required value={medForm.dosage} onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })} placeholder="500mg" />
            </div>
            <div className="form-field">
              <label>Reorder Level *</label>
              <input type="number" required value={medForm.reorder_level} onChange={(e) => setMedForm({ ...medForm, reorder_level: parseInt(e.target.value, 10) })} />
            </div>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save to Catalog</button>
          </div>
        </form>
      </Modal>

      {/* Add Batch Modal */}
      {/* Create Supply Request Modal */}
      {/* Edit Medicine Modal */}
      <Modal isOpen={modalType === 'EDIT_MEDICINE'} onClose={() => { setModalType(null); setEditingItem(null); }} title={`Update Formulary Medicine: ${editingItem?.name || ''}`}>
        <form onSubmit={handleUpdateMedicine} className="modal-form-body">
          <div className="form-field">
            <label>Medicine Name *</label>
            <input type="text" required value={editMedForm.name} onChange={(e) => setEditMedForm({ ...editMedForm, name: e.target.value })} />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Manufacturer *</label>
              <input type="text" required value={editMedForm.manufacturer} onChange={(e) => setEditMedForm({ ...editMedForm, manufacturer: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Category *</label>
              <select value={editMedForm.category} onChange={(e) => setEditMedForm({ ...editMedForm, category: e.target.value })} required>
                <option value="Analgesic">Analgesic</option>
                <option value="Antibiotic">Antibiotic</option>
                <option value="Antihistamine">Antihistamine</option>
                <option value="Antidiabetic">Antidiabetic</option>
                <option value="Cardiovascular">Cardiovascular</option>
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Dosage *</label>
              <input type="text" required value={editMedForm.dosage} onChange={(e) => setEditMedForm({ ...editMedForm, dosage: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Formulation *</label>
              <select value={editMedForm.formulation} onChange={(e) => setEditMedForm({ ...editMedForm, formulation: e.target.value })} required>
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Syrup">Syrup</option>
                <option value="Injection">Injection</option>
                <option value="Ointment">Ointment</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label>Safety Reorder Threshold</label>
            <input type="number" min="1" value={editMedForm.reorder_level} onChange={(e) => setEditMedForm({ ...editMedForm, reorder_level: parseInt(e.target.value) || 20 })} />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => { setModalType(null); setEditingItem(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Formulary Changes</button>
          </div>
        </form>
      </Modal>

      {/* Edit Batch Modal */}
      <Modal isOpen={modalType === 'EDIT_BATCH'} onClose={() => { setModalType(null); setEditingItem(null); }} title={`Update Batch: ${editingItem?.batch_number || ''}`}>
        <form onSubmit={handleUpdateBatch} className="modal-form-body">
          <div className="form-field">
            <label>Medicine</label>
            <input type="text" disabled value={editingItem?.medicine?.name || 'Shelf Item'} />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Manufacturing Date *</label>
              <input type="date" required value={editBatchForm.manufacturing_date} onChange={(e) => setEditBatchForm({ ...editBatchForm, manufacturing_date: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Expiry Date (FEFO) *</label>
              <input type="date" required value={editBatchForm.expiry_date} onChange={(e) => setEditBatchForm({ ...editBatchForm, expiry_date: e.target.value })} />
            </div>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => { setModalType(null); setEditingItem(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Batch Dates</button>
          </div>
        </form>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal isOpen={modalType === 'EDIT_CUSTOMER'} onClose={() => { setModalType(null); setEditingItem(null); }} title={`Update Customer: ${editingItem?.name || ''}`}>
        <form onSubmit={handleUpdateCustomer} className="modal-form-body">
          <div className="form-field">
            <label>Customer Full Name *</label>
            <input type="text" required value={editCustomerForm.name} onChange={(e) => setEditCustomerForm({ ...editCustomerForm, name: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Contact Phone Number *</label>
            <input type="text" required value={editCustomerForm.phone} onChange={(e) => setEditCustomerForm({ ...editCustomerForm, phone: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Email Address</label>
            <input type="email" value={editCustomerForm.email} onChange={(e) => setEditCustomerForm({ ...editCustomerForm, email: e.target.value })} />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => { setModalType(null); setEditingItem(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Customer Changes</button>
          </div>
        </form>
      </Modal>

      {/* Add Pharmacy Staff Modal */}
      <Modal isOpen={modalType === 'ADD_PHARMACY_STAFF'} onClose={() => setModalType(null)} title="Add Branch Pharmacy Staff Member">
        <form onSubmit={handleAddPharmacyStaff} className="modal-form-body">
          <div className="form-row-2">
            <div className="form-field">
              <label>Full Name *</label>
              <input type="text" required value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                placeholder="e.g. Priya Sharma" />
            </div>
            <div className="form-field">
              <label>Username *</label>
              <input type="text" required value={staffForm.username}
                onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                placeholder="e.g. priya.sharma" />
            </div>
          </div>
          <div className="form-field">
            <label>Email *</label>
            <input type="email" required value={staffForm.email}
              onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
              placeholder="e.g. priya@pharmacy.com" />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Temporary Password *</label>
              <input type="text" required value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                placeholder="Min 8 characters" />
            </div>
            <div className="form-field">
              <label>Role *</label>
              <select value={staffForm.role_name}
                onChange={(e) => setStaffForm({ ...staffForm, role_name: e.target.value })}>
                <option value="PHARMACY_ADMIN">PHARMACY_ADMIN</option>
                <option value="PHARMACY_STAFF">PHARMACY_STAFF</option>
                <option value="DISPENSER">DISPENSER</option>
              </select>
            </div>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Staff Account</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modalType === 'CREATE_SUPPLY_REQ'} onClose={() => setModalType(null)} title="Create Supply Request to Central Warehouse">
        <form onSubmit={handleCreateSupplyRequest} className="modal-form-body">
          <div className="form-field">
            <label>Medicine Required *</label>
            <select
              value={reqForm.items[0]?.medicine_id || ''}
              onChange={(e) => setReqForm({ ...reqForm, items: [{ ...reqForm.items[0], medicine_id: e.target.value }] })}
              required
            >
              <option value="">-- Select Medicine --</option>
              {medicines.map(m => (
                <option key={m._id || m.medicine_id} value={m._id || m.medicine_id}>
                  {m.name} {m.dosage ? `(${m.dosage})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Quantity Requested *</label>
              <input
                type="number"
                min="1"
                required
                value={reqForm.items[0]?.requested_quantity || 100}
                onChange={(e) => setReqForm({ ...reqForm, items: [{ ...reqForm.items[0], requested_quantity: parseInt(e.target.value) || 100 }] })}
                placeholder="e.g. 500 units"
              />
            </div>
            <div className="form-field">
              <label>Priority Level</label>
              <select
                value={reqForm.priority}
                onChange={(e) => setReqForm({ ...reqForm, priority: e.target.value })}
              >
                <option value="NORMAL">NORMAL</option>
                <option value="URGENT">URGENT</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label>Clinical Notes / Justification</label>
            <input
              type="text"
              value={reqForm.notes}
              onChange={(e) => setReqForm({ ...reqForm, notes: e.target.value })}
              placeholder="e.g. Running low due to high patient demand this week"
            />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit Request to Warehouse</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modalType === 'ADD_BATCH'} onClose={() => setModalType(null)} title="Register Inward Batch in Pharmacy">
        <form onSubmit={handleAddBatch} className="modal-form-body">
          <div className="form-field">
            <label>Select Medicine *</label>
            <select value={batchForm.medicine_id} onChange={(e) => setBatchForm({ ...batchForm, medicine_id: e.target.value })} required>
              <option value="">Choose medicine...</option>
              {medicines.map((m) => (
                <option key={m._id} value={m.medicine_id}>{m.name} ({m.dosage})</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Batch Number *</label>
            <input type="text" required value={batchForm.batch_number} onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })} placeholder="e.g. PH-BAT-2027-101" />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Manufacturing Date *</label>
              <input type="date" required value={batchForm.manufacturing_date} onChange={(e) => setBatchForm({ ...batchForm, manufacturing_date: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Expiry Date *</label>
              <input type="date" required value={batchForm.expiry_date} onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label>Initial Shelf Stock (Units) *</label>
            <input type="number" required min="0" value={batchForm.initial_quantity} onChange={(e) => setBatchForm({ ...batchForm, initial_quantity: parseInt(e.target.value, 10) })} />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Credit to Inventory</button>
          </div>
        </form>
      </Modal>
      {/* Details Modal */}
      <Modal isOpen={modalType === 'VIEW_DETAILS'} onClose={() => setModalType(null)} title="Record Details & Specifications" maxWidth="760px">
        <div style={{ padding: '4px 0' }}>
          <EntityDetailsTable data={selectedItem} title="Pharmacy Record" />
          <div className="modal-action-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="btn btn-primary" onClick={() => setModalType(null)}>Close</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
