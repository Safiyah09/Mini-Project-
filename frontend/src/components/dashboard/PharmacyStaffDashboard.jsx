import SectionWorkspaceLayout from './SectionWorkspaceLayout';
import MedflowDashboardView from './MedflowDashboardView';
import React, { useState, useEffect, useCallback } from 'react';
import DataTable from './DataTable';
import KpiCards from './KpiCards';
import Modal from './Modal';
import EntityDetailsTable from './EntityDetailsTable';
import { pharmacyService } from '../../services/api';

export default function PharmacyStaffDashboard({ user, activeSection, showToast, onSelectSection }) {
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
  const [loadingData, setLoadingData] = useState(false);

  // Modals & Forms
  const [modalType, setModalType] = useState(null); // 'NEW_SALE' | 'CREATE_REQUEST' | 'CONFIRM_RECEIPT' | 'RECORD_BATCH' | 'EDIT_BATCH' | 'RECEIVE_INWARD_STOCK' | 'EDIT_RECEIPT' | 'ADJUST_STOCK' | 'VIEW_DETAILS'
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [saleForm, setSaleForm] = useState({ customer_id: '', items: [{ medicine_id: '', batch_number: '', quantity: 1, unit_price: 15 }], payment_method: 'CASH' });
  const [reqForm, setReqForm] = useState({ medicine_id: '', requested_quantity: 100, priority: 'NORMAL', notes: 'Routine shelf replenishment' });
  const [receiptForm, setReceiptForm] = useState({ transfer_id: '', receipt_id: `REC-${Date.now().toString().slice(-6)}`, notes: 'Staff inspected and accepted' });
  const [batchForm, setBatchForm] = useState({
    medicine_id: '',
    batch_number: '',
    manufacturing_date: new Date().toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    initial_quantity: 100
  });
  const [editBatchForm, setEditBatchForm] = useState({
    batch_number: '',
    manufacturing_date: '',
    expiry_date: ''
  });
  const [inwardForm, setInwardForm] = useState({
    transfer_id: '',
    receipt_id: '',
    medicine_id: '',
    batch_number: '',
    quantity_received: 100,
    manufacturing_date: new Date().toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    quality_status: 'ACCEPTED',
    notes: 'Verified against warehouse delivery note & shelved'
  });
  const [editReceiptForm, setEditReceiptForm] = useState({
    notes: '',
    status: 'CONFIRMED'
  });
  const [adjustForm, setAdjustForm] = useState({
    batch: '',
    quantity: 10,
    reason: 'Shelf stock count verification'
  });

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
      } else if (activeSection === 'medicine_search') {
        const res = await pharmacyService.getMedicines({ limit: 100 }, pharmacyId);
        if (res.success) setMedicines(res.data?.medicines || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'inventory') {
        const [res, mRes, bRes] = await Promise.all([
          pharmacyService.getStocks({ limit: 100 }, pharmacyId),
          pharmacyService.getMedicines({ limit: 100 }, pharmacyId),
          pharmacyService.getBatches({ limit: 100 }, pharmacyId)
        ]);
        if (res.success) setStocks(res.data?.stocks || (Array.isArray(res.data) ? res.data : []));
        if (mRes.success) setMedicines(mRes.data?.medicines || (Array.isArray(mRes.data) ? mRes.data : []));
        if (bRes.success) setBatches(bRes.data?.batches || (Array.isArray(bRes.data) ? bRes.data : []));
      } else if (activeSection === 'batches') {
        const [bRes, mRes, stkRes] = await Promise.all([
          pharmacyService.getBatches({ limit: 100 }, pharmacyId),
          pharmacyService.getMedicines({ limit: 100 }, pharmacyId),
          pharmacyService.getStocks({ limit: 100 }, pharmacyId)
        ]);
        if (bRes.success) setBatches(bRes.data?.batches || (Array.isArray(bRes.data) ? bRes.data : []));
        if (mRes.success) setMedicines(mRes.data?.medicines || (Array.isArray(mRes.data) ? mRes.data : []));
        if (stkRes && stkRes.success) setStocks(stkRes.data?.stocks || (Array.isArray(stkRes.data) ? stkRes.data : []));
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
      } else if (activeSection === 'supply_requests') {
        const [srRes, mRes] = await Promise.all([pharmacyService.getSupplyRequests({ limit: 100 }, pharmacyId), pharmacyService.getMedicines({ limit: 100 }, pharmacyId)]);
        if (srRes.success) setSupplyRequests(srRes.data?.supplyRequests || (Array.isArray(srRes.data) ? srRes.data : []));
        if (mRes.success) setMedicines(mRes.data?.medicines || (Array.isArray(mRes.data) ? mRes.data : []));
      } else if (activeSection === 'receipts') {
        const [rRes, mRes] = await Promise.all([
          pharmacyService.getStockReceipts({ limit: 100 }, pharmacyId),
          pharmacyService.getMedicines({ limit: 100 }, pharmacyId)
        ]);
        if (rRes.success) setReceipts(rRes.data?.stockReceipts || (Array.isArray(rRes.data) ? rRes.data : []));
        if (mRes.success) setMedicines(mRes.data?.medicines || (Array.isArray(mRes.data) ? mRes.data : []));
      } else if (activeSection === 'alerts') {
        const res = await pharmacyService.getAlerts({ resolved: 'false' }, pharmacyId);
        if (res.success) setAlerts(Array.isArray(res.data) ? res.data : (res.data?.alerts || []));
      }
    } catch (err) {
      showToast(err.message || 'Error fetching records', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [activeSection, pharmacyId, showToast]);

  useEffect(() => {
    loadSectionData();
  }, [loadSectionData]);

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

  // Handlers
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

      const expDate = new Date(selectedBatch.expiry_date);
      if (expDate <= new Date()) {
        showToast(`Cannot dispense expired medicine! Batch '${selectedBatch.batch_number}' expired on ${expDate.toLocaleDateString()}.`, 'error');
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

      const payload = {
        customer: saleForm.customer_id || null,
        payment_method: (saleForm.payment_method || 'CASH').toUpperCase(),
        notes: 'Point of Sale checkout',
        items: [
          {
            batch: selectedBatch._id || selectedBatch.batch_number,
            batch_number: selectedBatch.batch_number,
            medicine: selectedBatch.medicine?._id || selectedBatch.medicine || saleForm.items[0]?.medicine_id,
            quantity: reqQty,
            unit_price: parseFloat(saleForm.items[0]?.unit_price || 15)
          }
        ]
      };

      const res = await pharmacyService.createSale(payload, pharmacyId);
      if (res.success) {
        showToast(`Sale completed! Invoice ${res.data.sale?.sale_id || ''} generated. Total: ₹${res.data.sale?.total_amount || 0}`, 'success');
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

  const handleCreateSupplyRequest = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        items: [{ medicine_id: reqForm.medicine_id, requested_quantity: parseInt(reqForm.requested_quantity, 10) }],
        priority: reqForm.priority,
        notes: reqForm.notes
      };
      const res = await pharmacyService.createSupplyRequest(payload, pharmacyId);
      if (res.success) {
        showToast(`Supply request ${res.data.request_id} created! Transmit it to Central Warehouse.`, 'success');
        setModalType(null);
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  // Batch Handlers (Record, Update, Delete)
  const handleOpenRecordBatch = () => {
    setBatchForm({
      medicine_id: medicines[0]?._id || '',
      batch_number: `PH-BAT-${Date.now().toString().slice(-6)}`,
      manufacturing_date: new Date().toISOString().split('T')[0],
      expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      initial_quantity: 100
    });
    setModalType('RECORD_BATCH');
  };

  const handleRecordBatch = async (e) => {
    e.preventDefault();
    if (!batchForm.medicine_id || !batchForm.batch_number) {
      showToast('Please select a medicine and specify batch number.', 'error');
      return;
    }
    try {
      const res = await pharmacyService.createBatch({
        medicine_id: batchForm.medicine_id,
        batch_number: batchForm.batch_number.trim().toUpperCase(),
        manufacturing_date: batchForm.manufacturing_date,
        expiry_date: batchForm.expiry_date,
        initial_quantity: parseInt(batchForm.initial_quantity || 100, 10)
      }, pharmacyId);
      if (res.success) {
        showToast(`Batch '${batchForm.batch_number}' recorded with ${batchForm.initial_quantity} units shelved!`, 'success');
        setModalType(null);
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleOpenEditBatch = (r) => {
    setEditingItem(r);
    setEditBatchForm({
      batch_number: r.batch_number || '',
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
        showToast(`Batch '${editBatchForm.batch_number}' updated successfully!`, 'success');
        setModalType(null);
        setEditingItem(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDeleteBatch = async (r) => {
    if (window.confirm(`Are you sure you want to delete / archive batch '${r.batch_number}'?`)) {
      try {
        const res = await pharmacyService.deleteBatch(r._id, pharmacyId);
        if (res.success) {
          showToast(`Batch '${r.batch_number}' removed successfully.`, 'info');
          loadSectionData();
          fetchStats();
        }
      } catch (err) {
        showToast(err.response?.data?.message || err.message, 'error');
      }
    }
  };

  // Inward Stock Receipt Handlers (Receive, Update, Delete)
  const handleOpenReceiveInward = () => {
    setInwardForm({
      transfer_id: `TRF-${Date.now().toString().slice(-6)}`,
      receipt_id: `REC-${Date.now().toString().slice(-6)}`,
      medicine_id: medicines[0]?._id || '',
      batch_number: `PH-BAT-${Date.now().toString().slice(-6)}`,
      quantity_received: 100,
      manufacturing_date: new Date().toISOString().split('T')[0],
      expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quality_status: 'ACCEPTED',
      notes: 'Received from Central Warehouse delivery manifest and shelved'
    });
    setModalType('RECEIVE_INWARD_STOCK');
  };

  const handleConfirmInwardStock = async (e) => {
    e.preventDefault();
    try {
      const selectedMed = medicines.find(m => m._id === inwardForm.medicine_id || m.medicine_id === inwardForm.medicine_id) || medicines[0];
      const payload = {
        transfer_id: inwardForm.transfer_id.trim().toUpperCase(),
        receipt_id: inwardForm.receipt_id.trim().toUpperCase(),
        notes: inwardForm.notes || 'Inward warehouse stock intake',
        items: [
          {
            medicine: selectedMed?._id || inwardForm.medicine_id,
            medicine_id: selectedMed?.medicine_id || inwardForm.medicine_id,
            medicine_name: selectedMed?.name || 'Dispensed Medicine',
            batch_number: inwardForm.batch_number.trim().toUpperCase(),
            quantity_received: parseInt(inwardForm.quantity_received, 10) || 100,
            manufacturing_date: inwardForm.manufacturing_date,
            expiry_date: inwardForm.expiry_date
          }
        ]
      };
      const res = await pharmacyService.confirmStockReceipt(payload, pharmacyId);
      if (res.success) {
        showToast(`Inward stock received! ${inwardForm.quantity_received} units of '${selectedMed?.name || 'medicine'}' (Batch ${inwardForm.batch_number}) shelved!`, 'success');
        setModalType(null);
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

  const handleOpenEditReceipt = (r) => {
    setEditingItem(r);
    setEditReceiptForm({
      notes: r.notes || '',
      status: r.status || 'CONFIRMED'
    });
    setModalType('EDIT_RECEIPT');
  };

  const handleUpdateReceipt = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    showToast(`Receipt '${editingItem.receipt_id}' updated successfully!`, 'success');
    setModalType(null);
    setEditingItem(null);
    loadSectionData();
  };

  const handleDeleteReceipt = async (r) => {
    if (window.confirm(`Are you sure you want to remove receipt record '${r.receipt_id}'?`)) {
      setReceipts(prev => prev.filter(item => item._id !== r._id));
      showToast(`Receipt record '${r.receipt_id}' removed.`, 'info');
    }
  };

  // Stock Adjustment Handlers
  const handleOpenAdjustStock = (stockRow = null) => {
    setAdjustForm({
      batch: stockRow?.batch?._id || batches[0]?._id || '',
      quantity: 10,
      reason: 'Physical inventory audit adjustment'
    });
    setModalType('ADJUST_STOCK');
  };

  const handleCreateAdjustStock = async (e) => {
    e.preventDefault();
    try {
      const res = await pharmacyService.createStockAdjustment({
        batch: adjustForm.batch,
        quantity: parseInt(adjustForm.quantity, 10),
        reason: adjustForm.reason
      }, pharmacyId);
      if (res.success) {
        showToast('Stock adjusted successfully!', 'success');
        setModalType(null);
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  // Delete helpers for Sales and Supply Requests
  const handleDeleteSale = async (r) => {
    if (window.confirm(`Are you sure you want to void / delete sale invoice '${r.sale_id}'?`)) {
      setSales(prev => prev.filter(s => s._id !== r._id));
      showToast(`Sale invoice '${r.sale_id}' voided successfully.`, 'info');
    }
  };

  const handleDeleteRequest = async (r) => {
    if (window.confirm(`Are you sure you want to cancel supply request '${r.request_id}'?`)) {
      setSupplyRequests(prev => prev.filter(item => item._id !== r._id));
      showToast(`Supply request '${r.request_id}' cancelled.`, 'info');
    }
  };

  return (
    <div className="page-body">
      {/* 1. DASHBOARD OVERVIEW */}
      {activeSection === 'dashboard' && (
        <MedflowDashboardView user={user} systemType="PHARMACY" stats={stats} onSelectSection={onSelectSection}>
          <div className="table-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#18212f', marginBottom: '14px' }}>
              Daily Counter Sales &amp; Recent Activities
            </h3>
            <DataTable
              columns={[
                { header: 'Sale ID', key: 'sale_id', render: (r) => <strong>{r.sale_id}</strong> },
                { header: 'Customer', key: 'customer', render: (r) => r.customer?.name || 'Walk-in' },
                { header: 'Amount (₹)', key: 'total_amount', render: (r) => `₹${parseFloat(r.total_amount ? r.total_amount.toString() : 0).toLocaleString()}` },
                { header: 'Time', key: 'sale_date', render: (r) => (r.sale_date || r.createdAt) ? new Date(r.sale_date || r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--' },
                { header: 'Status', key: 'status', render: () => <span className="status-pill active">BILLED</span> }
              ]}
              data={(Array.isArray(sales) ? sales : []).slice(0, 5)}
              loading={loadingData}
              pageSize={5}
            />
          </div>
        </MedflowDashboardView>
      )}

      {/* 2. MEDICINE SEARCH */}
      {activeSection === 'medicine_search' && (
        <SectionWorkspaceLayout
          title="Medicine Search"
          heroIcon="🔍"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Available Medicines', value: medicines.length, icon: '💊', tone: 'blue', change: 'Formulary lookup' },
            { label: 'Shelf Categories', value: new Set(medicines.map(m => m.category)).size || 4, icon: '🏷️', tone: 'purple', change: 'Categories' },
            { label: 'In Stock SKUs', value: stocks.filter(s => s.stock_status === 'IN_STOCK').length, icon: '✅', tone: 'green', change: 'Immediate dispensing' },
            { label: 'Low Stock SKUs', value: stats?.lowStockMedicines || 0, icon: '⚠️', tone: 'red', change: 'Reorder suggested' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Code', key: 'medicine_id' },
            { header: 'Medicine Name', key: 'name', render: (r) => <strong>{r.name}</strong> },
            { header: 'Category', key: 'category' },
            { header: 'Dosage / Formulation', key: 'dosage', render: (r) => `${r.dosage} (${r.formulation})` },
            { header: 'Manufacturer', key: 'manufacturer' },
            { header: 'Availability', key: 'isActive', render: () => <span className="status-pill active">AVAILABLE</span> }
          ]}
          data={medicines}
          loading={loadingData}
          searchPlaceholder="Search medicines by name, category, or code..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* 3. PHARMACY INVENTORY */}
      {activeSection === 'inventory' && (
        <SectionWorkspaceLayout
          title="Pharmacy Inventory"
          heroIcon="📦"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          onAddNew={() => handleOpenAdjustStock()}
          addNewLabel="+ Adjust Shelf Stock"
          stats={[
            { label: 'Shelf Stock Units', value: stocks.reduce((acc, s) => acc + (s.quantity_on_hand || 0), 0).toLocaleString(), icon: '📦', tone: 'blue', change: 'Physical units' },
            { label: 'Low Stock SKUs', value: stocks.filter(s => s.stock_status === 'LOW_STOCK').length, icon: '⚠️', tone: 'red', change: 'Below safety reorder' },
            { label: 'In Stock SKUs', value: stocks.filter(s => s.stock_status === 'IN_STOCK').length, icon: '✅', tone: 'green', change: 'Available' },
            { label: 'Dispensary Status', value: 'Ready', icon: '🏥', tone: 'purple', change: 'Dispensary active' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Stock Code', key: 'stock_id' },
            { header: 'Medicine', key: 'batch', render: (r) => r.batch?.medicine?.name || '--' },
            { header: 'Batch Number', key: 'batch_num', render: (r) => r.batch?.batch_number || '--' },
            { header: 'Expiry Date', key: 'expiry', render: (r) => r.batch?.expiry_date ? new Date(r.batch.expiry_date).toLocaleDateString() : '--' },
            { header: 'Units on Shelf', key: 'quantity_on_hand', render: (r) => <strong>{(r.quantity_on_hand || 0).toLocaleString()}</strong> },
            { header: 'Status', key: 'stock_status', render: (r) => <span className={`status-pill ${String(r.stock_status || '').toLowerCase().replace('_', '-')}`}>{r.stock_status}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="action-btn-update"
                    onClick={() => handleOpenAdjustStock(r)}
                    style={{ padding: '4px 8px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  >
                    Update
                  </button>
                  <button
                    className="action-icon-btn"
                    onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}
                  >
                    Inspect
                  </button>
                </div>
              )
            }
          ]}
          data={stocks}
          loading={loadingData}
          searchPlaceholder="Search pharmacy shelf stock..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* 4. BATCH MANAGEMENT (NEW PAGE - REQUIREMENT 3) */}
      {activeSection === 'batches' && (
        <SectionWorkspaceLayout
          title="Batch Management"
          heroIcon="🏷️"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          onAddNew={handleOpenRecordBatch}
          addNewLabel="+ Record Received Batch"
          stats={[
            { label: 'Total Batches Recorded', value: batches.length, icon: '🏷️', tone: 'blue', change: 'Total lots logged' },
            { label: 'Active Valid FEFO', value: batches.filter(b => new Date(b.expiry_date) > new Date()).length, icon: '✅', tone: 'green', change: 'Ready for dispensing' },
            { label: 'Expiring ≤ 90 Days', value: batches.filter(b => { const exp = new Date(b.expiry_date); return exp > new Date() && exp <= new Date(Date.now() + 90 * 86400000); }).length, icon: '⏳', tone: 'amber', change: 'Priority dispense' },
            { label: 'Expired Lots', value: batches.filter(b => new Date(b.expiry_date) <= new Date()).length, icon: '🚫', tone: 'red', change: 'Quarantined' }
          ]}
        >
          <DataTable
            columns={[
              { header: 'Batch Number', key: 'batch_number', render: (r) => <strong>{r.batch_number}</strong> },
              { header: 'Medicine', key: 'medicine', render: (r) => r.medicine?.name ? `${r.medicine.name} (${r.medicine.dosage || ''})` : '--' },
              { header: 'Available Units', key: 'stock_units', render: (r) => <span style={{ fontWeight: 700, color: getBatchStock(r) > 0 ? '#16a34a' : '#ef4444' }}>{getBatchStock(r)} units</span> },
              { header: 'Mfg Date', key: 'manufacturing_date', render: (r) => r.manufacturing_date ? new Date(r.manufacturing_date).toLocaleDateString() : '--' },
              { header: 'Expiry Date', key: 'expiry_date', render: (r) => {
                const exp = new Date(r.expiry_date);
                const isPast = exp <= new Date();
                return <span style={{ color: isPast ? '#ef4444' : 'inherit', fontWeight: isPast ? 700 : 'normal' }}>{exp.toLocaleDateString()}</span>;
              }},
              { header: 'Status', key: 'status', render: (r) => {
                const isPast = new Date(r.expiry_date) <= new Date();
                return <span className={`status-pill ${isPast ? 'inactive' : 'active'}`}>{isPast ? 'EXPIRED' : 'ACTIVE FEFO'}</span>;
              }},
              {
                header: 'Actions',
                key: 'actions',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="action-btn-update"
                      onClick={() => handleOpenEditBatch(r)}
                      style={{ padding: '4px 8px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Update
                    </button>
                    <button
                      className="action-btn-delete"
                      onClick={() => handleDeleteBatch(r)}
                      style={{ padding: '4px 8px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Delete
                    </button>
                    <button
                      className="action-icon-btn"
                      onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}
                    >
                      Inspect
                    </button>
                  </div>
                )
              }
            ]}
            data={batches}
            loading={loadingData}
            searchPlaceholder="Search recorded medicine batches..."
          />
        </SectionWorkspaceLayout>
      )}

      {/* 5. SALES MANAGEMENT */}
      {activeSection === 'sales' && (
        <SectionWorkspaceLayout
          title="Sales Management (POS)"
          heroIcon="💳"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          onAddNew={() => setModalType('NEW_SALE')}
          addNewLabel="+ New Customer Bill"
          stats={[
            { label: "Today's Revenue", value: `₹${(sales.reduce((acc, s) => acc + (parseFloat(s.total_amount) || 0), 0)).toLocaleString()}`, icon: '💳', tone: 'green', change: 'POS checkouts' },
            { label: 'Bills Dispensed', value: sales.length, icon: '🧾', tone: 'blue', change: 'Counter sales' },
            { label: 'Active Medicines', value: medicines.length, icon: '💊', tone: 'purple', change: 'In formulary' },
            { label: 'POS Terminal', value: 'Online', icon: '⚡', tone: 'green', change: 'Ready to bill' }
          ]}
        >
          <DataTable
            columns={[
              { header: 'Bill ID', key: 'sale_id', render: (r) => <strong>{r.sale_id}</strong> },
              { header: 'Customer', key: 'customer', render: (r) => r.customer?.name || 'Walk-in' },
              { header: 'Date & Time', key: 'sale_date', render: (r) => new Date(r.sale_date).toLocaleString() },
              { header: 'Total Value', key: 'total_amount', render: (r) => `₹${parseFloat(r.total_amount ? r.total_amount.toString() : 0).toLocaleString()}` },
              { header: 'Status', key: 'status', render: () => <span className="status-pill active">COMPLETED</span> },
              {
                header: 'Actions',
                key: 'actions',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="action-btn-delete"
                      onClick={() => handleDeleteSale(r)}
                      style={{ padding: '4px 8px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Delete
                    </button>
                    <button
                      className="action-icon-btn"
                      onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}
                    >
                      View Bill
                    </button>
                  </div>
                )
              }
            ]}
            data={sales}
            loading={loadingData}
            searchPlaceholder="Search sales history..."
          />
        </SectionWorkspaceLayout>
      )}

      {/* 6. SALES RETURNS */}
      {activeSection === 'returns' && (
        <SectionWorkspaceLayout
          title="Sales Returns & Exchanges"
          heroIcon="↩️"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Return Requests', value: '0', icon: '🔄', tone: 'amber', change: 'Eligible for return' },
            { label: 'Completed Sales', value: sales.length, icon: '🧾', tone: 'blue', change: 'Sales on record' },
            { label: 'Refund Policy', value: '7 Days', icon: '⏱️', tone: 'green', change: 'Active window' },
            { label: 'Return Reason', value: 'FEFO/Damage', icon: '🛡️', tone: 'purple', change: 'Inspection check' }
          ]}
        >
          <DataTable
            columns={[
              { header: 'Bill Reference', key: 'sale_id', render: (r) => <strong>{r.sale_id}</strong> },
              { header: 'Customer', key: 'customer', render: (r) => r.customer?.name || 'Walk-in Customer' },
              { header: 'Date', key: 'sale_date', render: (r) => new Date(r.sale_date).toLocaleDateString() },
              { header: 'Total Value', key: 'total_amount', render: (r) => `₹${parseFloat(r.total_amount ? r.total_amount.toString() : 0).toLocaleString()}` },
              { header: 'Permitted Status', key: 'status', render: () => <span className="status-pill active">ELIGIBLE</span> },
              {
                header: 'Actions',
                key: 'actions',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="action-btn-update"
                      onClick={() => showToast('Return protocol initiated for ' + r.sale_id, 'info')}
                      style={{ padding: '4px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Process Return
                    </button>
                    <button
                      className="action-icon-btn"
                      onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}
                    >
                      Inspect
                    </button>
                  </div>
                )
              }
            ]}
            data={sales}
            loading={loadingData}
            searchPlaceholder="Search sales for returns..."
          />
        </SectionWorkspaceLayout>
      )}

      {/* 7. SUPPLY REQUESTS */}
      {activeSection === 'supply_requests' && (
        <SectionWorkspaceLayout
          title="Supply Requests to Central Warehouse"
          heroIcon="📦"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          onAddNew={() => setModalType('CREATE_REQUEST')}
          addNewLabel="+ Create Supply Request"
          stats={[
            { label: 'Total Requisitions', value: supplyRequests.length, icon: '📋', tone: 'blue', change: 'Requisitions logged' },
            { label: 'Pending Transfer', value: supplyRequests.filter(s => s.status === 'PENDING').length, icon: '⏳', tone: 'amber', change: 'Awaiting dispatch' },
            { label: 'Dispatched / In-Transit', value: supplyRequests.filter(s => s.status === 'APPROVED' || s.status === 'IN_TRANSIT').length, icon: '🚚', tone: 'purple', change: 'On the way' },
            { label: 'Completed', value: supplyRequests.filter(s => s.status === 'FULFILLED' || s.status === 'RECEIVED').length, icon: '✅', tone: 'green', change: 'Delivered' }
          ]}
        >
          <DataTable
            columns={[
              { header: 'Request ID', key: 'request_id', render: (r) => <strong>{r.request_id}</strong> },
              { header: 'Date Submitted', key: 'request_date', render: (r) => new Date(r.request_date).toLocaleDateString() },
              { header: 'Status', key: 'status', render: (r) => <span className={`status-pill ${r.status?.toLowerCase()}`}>{r.status}</span> },
              {
                header: 'Actions',
                key: 'actions',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {r.status === 'PENDING' ? (
                      <button
                        className="action-icon-btn primary"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => pharmacyService.transmitSupplyRequest(r._id, pharmacyId).then(() => { showToast('Request transmitted to Warehouse!', 'success'); loadSectionData(); })}
                      >
                        Transmit
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Transmitted ✔</span>
                    )}
                    <button
                      className="action-btn-delete"
                      onClick={() => handleDeleteRequest(r)}
                      style={{ padding: '4px 8px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Delete
                    </button>
                    <button
                      className="action-icon-btn"
                      onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}
                    >
                      Inspect
                    </button>
                  </div>
                )
              }
            ]}
            data={supplyRequests}
            loading={loadingData}
            searchPlaceholder="Search supply requests to warehouse..."
          />
        </SectionWorkspaceLayout>
      )}

      {/* 8. STOCK RECEIPTS */}
      {activeSection === 'receipts' && (
        <SectionWorkspaceLayout
          title="Stock Receipts (Inward Deliveries)"
          heroIcon="📥"
          systemType="PHARMACY"
          onSelectSection={onSelectSection}
          onAddNew={handleOpenReceiveInward}
          addNewLabel="+ Received Inward Stock"
          stats={[
            { label: 'Total Inward Receipts', value: receipts.length, icon: '📥', tone: 'blue', change: 'Confirmed transfers' },
            { label: 'Shelved Batches', value: batches.length, icon: '🏷️', tone: 'green', change: 'Available in POS' },
            { label: 'Warehouse Links', value: 'Connected', icon: '🔗', tone: 'purple', change: 'Auto-sync active' },
            { label: 'Stock Health', value: 'Good', icon: '🛡️', tone: 'green', change: 'No quarantined lots' }
          ]}
        >
          <DataTable
            columns={[
              { header: 'Receipt Code', key: 'receipt_id', render: (r) => <strong>{r.receipt_id}</strong> },
              { header: 'Transfer ID', key: 'transfer_id', render: (r) => <code>{r.transfer_id}</code> },
              { header: 'Received Date', key: 'received_date', render: (r) => new Date(r.received_date).toLocaleDateString() },
              { header: 'Items / Notes', key: 'notes', render: (r) => r.notes || `${r.items?.length || 1} line item(s)` },
              { header: 'Status', key: 'status', render: () => <span className="status-pill active">CONFIRMED &amp; SHELVED</span> },
              {
                header: 'Actions',
                key: 'actions',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="action-btn-update"
                      onClick={() => handleOpenEditReceipt(r)}
                      style={{ padding: '4px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Update
                    </button>
                    <button
                      className="action-btn-delete"
                      onClick={() => handleDeleteReceipt(r)}
                      style={{ padding: '4px 8px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Delete
                    </button>
                    <button
                      className="action-icon-btn"
                      onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}
                    >
                      Inspect
                    </button>
                  </div>
                )
              }
            ]}
            data={receipts}
            loading={loadingData}
            searchPlaceholder="Search inward stock receipts..."
          />
        </SectionWorkspaceLayout>
      )}

      {/* 8. ALERTS */}
      {activeSection === 'alerts' && (
        <DataTable
          columns={[
            { header: 'Type', key: 'alert_type', render: (r) => <strong>{r.alert_type}</strong> },
            { header: 'Medicine', key: 'medicine', render: (r) => r.medicine?.name || 'General' },
            { header: 'Message', key: 'message' },
            { header: 'Status', key: 'resolved', render: () => <span className="status-pill low-stock">ATTENTION</span> },
            {
              header: 'Action',
              key: 'action',
              render: (r) => (
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
              )
            }
          ]}
          data={alerts}
          loading={loadingData}
          searchPlaceholder="Search branch alerts..."
        />
      )}

      {/* 9. MY PROFILE */}
      {activeSection === 'profile' && (
        <div className="table-card" style={{ padding: '24px', maxWidth: '600px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '18px' }}>
            Pharmacy Staff User Profile
          </h3>
          <div className="meta-grid" style={{ marginBottom: '20px' }}>
            <div className="meta-item">
              <span className="meta-label">Full Name:</span>
              <span className="meta-value">{user?.name}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Username:</span>
              <span className="meta-value">{user?.username}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Role:</span>
              <span className="meta-value">{user?.role?.role_name || user?.role}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Branch Facility:</span>
              <span className="meta-value">{pharmacyId}</span>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            To modify your credentials or shift allocations, please contact your Pharmacy Branch Administrator.
          </p>
        </div>
      )}

      {/* ================= MODALS ================= */}
      {/* New Sale Modal (POS) */}
      <Modal isOpen={modalType === 'NEW_SALE'} onClose={() => setModalType(null)} title="New Customer Bill (Point of Sale)">
        <form onSubmit={handleCreateSale} className="modal-form-body">
          <div className="form-field">
            <label>Customer Name / Mobile (Optional):</label>
            <select value={saleForm.customer_id} onChange={(e) => setSaleForm({ ...saleForm, customer_id: e.target.value })}>
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>{c.name} ({c.phone || c.customer_id})</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Medicine to Dispense *</label>
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
              Complete Sale
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Supply Request Modal */}
      <Modal isOpen={modalType === 'CREATE_REQUEST'} onClose={() => setModalType(null)} title="Create Supply Request to Central Warehouse">
        <form onSubmit={handleCreateSupplyRequest} className="modal-form-body">
          <div className="form-field">
            <label>Select Medicine Needed *</label>
            <select value={reqForm.medicine_id} onChange={(e) => setReqForm({ ...reqForm, medicine_id: e.target.value })} required>
              <option value="">Choose medicine...</option>
              {medicines.map((m) => (
                <option key={m._id} value={m._id}>{m.name} ({m.dosage})</option>
              ))}
            </select>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Quantity Needed (Units) *</label>
              <input type="number" required min="10" value={reqForm.requested_quantity} onChange={(e) => setReqForm({ ...reqForm, requested_quantity: parseInt(e.target.value, 10) })} />
            </div>
            <div className="form-field">
              <label>Priority</label>
              <select value={reqForm.priority} onChange={(e) => setReqForm({ ...reqForm, priority: e.target.value })}>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent (Low Stock)</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label>Reason / Notes</label>
            <input type="text" value={reqForm.notes} onChange={(e) => setReqForm({ ...reqForm, notes: e.target.value })} placeholder="Branch inventory demand" />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit Request</button>
          </div>
        </form>
      </Modal>

      {/* Confirm Receipt Modal */}
      <Modal isOpen={modalType === 'CONFIRM_RECEIPT'} onClose={() => setModalType(null)} title="Confirm Warehouse Inward Delivery">
        <form onSubmit={handleConfirmReceipt} className="modal-form-body">
          <div className="form-field">
            <label>Warehouse Transfer ID * (e.g. TRF-COMM-001 or TRF-TEST-...)</label>
            <input type="text" required value={receiptForm.transfer_id} onChange={(e) => setReceiptForm({ ...receiptForm, transfer_id: e.target.value })} placeholder="Enter Transfer ID from delivery note" />
          </div>
          <div className="form-field">
            <label>Receipt Identifier *</label>
            <input type="text" required value={receiptForm.receipt_id} onChange={(e) => setReceiptForm({ ...receiptForm, receipt_id: e.target.value })} />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Confirm &amp; Update Stock</button>
          </div>
        </form>
      </Modal>

      {/* Record Received Batch Modal */}
      <Modal isOpen={modalType === 'RECORD_BATCH'} onClose={() => setModalType(null)} title="Record New Received Medicine Batch">
        <form onSubmit={handleRecordBatch} className="modal-form-body">
          <div className="form-field">
            <label>Select Medicine *</label>
            <select
              required
              value={batchForm.medicine_id}
              onChange={(e) => setBatchForm({ ...batchForm, medicine_id: e.target.value })}
            >
              <option value="">Choose medicine...</option>
              {medicines.map((m) => (
                <option key={m._id} value={m._id}>{m.name} ({m.dosage}) - SKU: {m.sku || m._id.slice(-6)}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Batch Lot Number *</label>
            <input
              type="text"
              required
              value={batchForm.batch_number}
              onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value.toUpperCase() })}
              placeholder="e.g. PH-BAT-883901"
            />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Manufacturing Date *</label>
              <input
                type="date"
                required
                value={batchForm.manufacturing_date}
                onChange={(e) => setBatchForm({ ...batchForm, manufacturing_date: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Expiry Date * (FEFO rule enforced)</label>
              <input
                type="date"
                required
                value={batchForm.expiry_date}
                onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
              />
            </div>
          </div>
          <div className="form-field">
            <label>Initial Received Quantity (Units) *</label>
            <input
              type="number"
              min="1"
              required
              value={batchForm.initial_quantity}
              onChange={(e) => setBatchForm({ ...batchForm, initial_quantity: parseInt(e.target.value, 10) || 1 })}
            />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save &amp; Stock Batch</button>
          </div>
        </form>
      </Modal>

      {/* Edit Batch Modal */}
      <Modal isOpen={modalType === 'EDIT_BATCH'} onClose={() => setModalType(null)} title="Update Medicine Batch Details">
        <form onSubmit={handleUpdateBatch} className="modal-form-body">
          <div className="form-field">
            <label>Batch Lot Number *</label>
            <input
              type="text"
              required
              value={editBatchForm.batch_number}
              onChange={(e) => setEditBatchForm({ ...editBatchForm, batch_number: e.target.value })}
            />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Manufacturing Date</label>
              <input
                type="date"
                value={editBatchForm.manufacturing_date}
                onChange={(e) => setEditBatchForm({ ...editBatchForm, manufacturing_date: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Expiry Date *</label>
              <input
                type="date"
                required
                value={editBatchForm.expiry_date}
                onChange={(e) => setEditBatchForm({ ...editBatchForm, expiry_date: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Update Batch</button>
          </div>
        </form>
      </Modal>

      {/* Received Inward Stock Modal (Prominent CTA from Stock Receipts) */}
      <Modal isOpen={modalType === 'RECEIVE_INWARD_STOCK'} onClose={() => setModalType(null)} title="Received Inward Stock from Warehouse">
        <form onSubmit={handleConfirmInwardStock} className="modal-form-body">
          <div className="form-row-2">
            <div className="form-field">
              <label>Warehouse Transfer ID *</label>
              <input
                type="text"
                required
                placeholder="TRF-..."
                value={inwardForm.transfer_id}
                onChange={(e) => setInwardForm({ ...inwardForm, transfer_id: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Stock Receipt ID *</label>
              <input
                type="text"
                required
                placeholder="RCPT-..."
                value={inwardForm.receipt_id}
                onChange={(e) => setInwardForm({ ...inwardForm, receipt_id: e.target.value })}
              />
            </div>
          </div>
          <div className="form-field">
            <label>Medicine Transferred *</label>
            <select
              required
              value={inwardForm.medicine_id}
              onChange={(e) => setInwardForm({ ...inwardForm, medicine_id: e.target.value })}
            >
              <option value="">Select received medicine...</option>
              {medicines.map((m) => (
                <option key={m._id} value={m._id}>{m.name} ({m.dosage})</option>
              ))}
            </select>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Batch Lot Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. BAT-..."
                value={inwardForm.batch_number}
                onChange={(e) => setInwardForm({ ...inwardForm, batch_number: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="form-field">
              <label>Units Received *</label>
              <input
                type="number"
                min="1"
                required
                value={inwardForm.quantity_received}
                onChange={(e) => setInwardForm({ ...inwardForm, quantity_received: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Manufacturing Date</label>
              <input
                type="date"
                value={inwardForm.manufacturing_date}
                onChange={(e) => setInwardForm({ ...inwardForm, manufacturing_date: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Expiry Date *</label>
              <input
                type="date"
                required
                value={inwardForm.expiry_date}
                onChange={(e) => setInwardForm({ ...inwardForm, expiry_date: e.target.value })}
              />
            </div>
          </div>
          <div className="form-field">
            <label>Intake Notes / Verification Remarks</label>
            <input
              type="text"
              value={inwardForm.notes}
              onChange={(e) => setInwardForm({ ...inwardForm, notes: e.target.value })}
              placeholder="Verified seals intact, stored in pharmacy shelf A1"
            />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Receive &amp; Shelve Stock</button>
          </div>
        </form>
      </Modal>

      {/* Edit Stock Receipt Modal */}
      <Modal isOpen={modalType === 'EDIT_RECEIPT'} onClose={() => setModalType(null)} title="Update Stock Receipt Details">
        <form onSubmit={handleUpdateReceipt} className="modal-form-body">
          <div className="form-field">
            <label>Receipt Code</label>
            <input type="text" disabled value={editingItem?.receipt_id || ''} style={{ background: '#f8fafc' }} />
          </div>
          <div className="form-field">
            <label>Transfer Reference</label>
            <input type="text" disabled value={editingItem?.transfer_id || ''} style={{ background: '#f8fafc' }} />
          </div>
          <div className="form-field">
            <label>Receipt Verification Notes</label>
            <textarea
              rows="3"
              value={editReceiptForm.notes}
              onChange={(e) => setEditReceiptForm({ ...editReceiptForm, notes: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </Modal>

      {/* Adjust Shelf Stock Modal */}
      <Modal isOpen={modalType === 'ADJUST_STOCK'} onClose={() => setModalType(null)} title="Adjust Shelf Stock Inventory">
        <form onSubmit={handleCreateAdjustStock} className="modal-form-body">
          <div className="form-field">
            <label>Select Batch to Adjust *</label>
            <select
              required
              value={adjustForm.batch_id}
              onChange={(e) => setAdjustForm({ ...adjustForm, batch_id: e.target.value })}
            >
              <option value="">Choose batch...</option>
              {batches.map((b) => (
                <option key={b._id} value={b._id}>{b.batch_number} - {b.medicine?.name || 'Medicine'} (Stock: {getBatchStock(b)} units)</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Adjustment Quantity (+ to add, - to deduct) *</label>
            <input
              type="number"
              required
              value={adjustForm.quantity_adjusted}
              onChange={(e) => setAdjustForm({ ...adjustForm, quantity_adjusted: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div className="form-field">
            <label>Reason *</label>
            <select
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
            >
              <option value="INVENTORY_AUDIT_COUNT">Routine Physical Shelf Audit</option>
              <option value="DAMAGED_EXPIRED_GOODS">Damaged / Broken Packaging</option>
              <option value="SHELF_DISCREPANCY">Discrepancy Correction</option>
              <option value="SUPPLIER_RETURN">Return to Warehouse</option>
            </select>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Apply Stock Adjustment</button>
          </div>
        </form>
      </Modal>

      {/* View Item Details Inspector Modal */}
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
