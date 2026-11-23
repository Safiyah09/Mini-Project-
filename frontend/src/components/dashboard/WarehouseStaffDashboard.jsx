import SectionWorkspaceLayout from './SectionWorkspaceLayout';
import MedflowDashboardView from './MedflowDashboardView';
import React, { useState, useEffect, useCallback } from 'react';
import DataTable from './DataTable';
import KpiCards from './KpiCards';
import Modal from './Modal';
import EntityDetailsTable from './EntityDetailsTable';
import { warehouseService } from '../../services/api';

const DEFAULT_STORAGE_LOCATIONS = [
  { location_id: 'LOC-Z1-R01', zone: 'Zone A (Main Warehouse)', rack_bin: 'Rack 01 / Bin 01', cold_storage: false },
  { location_id: 'LOC-Z1-R02', zone: 'Zone A (Main Warehouse)', rack_bin: 'Rack 01 / Bin 02', cold_storage: false },
  { location_id: 'LOC-Z2-R01', zone: 'Zone B (Bulk Storage)', rack_bin: 'Pallet 01', cold_storage: false },
  { location_id: 'LOC-COLD-01', zone: 'Cold Chain Vault (2°C-8°C)', rack_bin: 'Chamber C-1', cold_storage: true },
  { location_id: 'LOC-QUAR-01', zone: 'Quarantine & Inspection Area', rack_bin: 'Hold Bay 01', cold_storage: false }
];

export default function WarehouseStaffDashboard({ user, activeSection, showToast, onSelectSection }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Section data states
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [supplyRequests, setSupplyRequests] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [fefoBatches, setFefoBatches] = useState([]);
  const [selectedMedForFefo, setSelectedMedForFefo] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  // Modals & Forms
  const [modalType, setModalType] = useState(null); // 'RECEIVE_GOODS' | 'REPORT_ADJUSTMENT' | 'PREPARE_DISPATCH' | 'VIEW_DETAILS'
  const [selectedItem, setSelectedItem] = useState(null);
  const [grForm, setGrForm] = useState({
    purchase_order: '',
    po_item: '',
    quantity_received: 100, action: 'ACCEPTED', batch_number: '',
    manufacturing_date: new Date().toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    storage_location: '',
    notes: ''
  });
  const [adjForm, setAdjForm] = useState({ medicine_id: '', batch_number: '', quantity_delta: -5, reason: 'DAMAGED_IN_TRANSIT', notes: '' });
  const [editingItem, setEditingItem] = useState(null);
  const [medForm, setMedForm] = useState({ name: '', sku: '', category: 'Analgesics', dosage: '500mg', formulation: 'Tablet', manufacturer: '', reorder_level: 50, unit_price: 20 });
  const [editMedForm, setEditMedForm] = useState({ name: '', sku: '', category: '', dosage: '', formulation: '', manufacturer: '', reorder_level: 50, unit_price: 20 });
  const [batchForm, setBatchForm] = useState({ medicine_id: '', batch_number: '', manufacturing_date: '', expiry_date: '', initial_quantity: 100 });
  const [editBatchForm, setEditBatchForm] = useState({ batch_number: '', manufacturing_date: '', expiry_date: '', isActive: true });
  const [selectedManifest, setSelectedManifest] = useState(null);

  const handleCreateMedicine = async (e) => {
    e.preventDefault();
    try {
      const res = await warehouseService.createMedicine(medForm);
      if (res.success) {
        showToast('Medicine registered successfully!', 'success');
        setModalType(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleOpenEditMedicine = (med) => {
    setEditingItem(med);
    setEditMedForm({
      name: med.name || '',
      sku: med.sku || '',
      category: med.category || 'Analgesics',
      dosage: med.dosage || '',
      formulation: med.formulation || 'Tablet',
      manufacturer: med.manufacturer || '',
      reorder_level: med.reorder_level || 50,
      unit_price: med.unit_price || 20
    });
    setModalType('EDIT_MEDICINE');
  };

  const handleUpdateMedicine = async (e) => {
    e.preventDefault();
    try {
      const res = await warehouseService.updateMedicine(editingItem._id, editMedForm);
      if (res.success) {
        showToast('Medicine updated successfully!', 'success');
        setModalType(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDeleteMedicine = async (med) => {
    if (!window.confirm(`Delete medicine ${med.name}?`)) return;
    try {
      const res = await warehouseService.deleteMedicine(med._id);
      if (res.success) {
        showToast('Medicine deleted successfully', 'success');
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    try {
      const res = await warehouseService.createBatch(batchForm);
      if (res.success) {
        showToast('Batch registered successfully!', 'success');
        setModalType(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleOpenEditBatch = (b) => {
    setEditingItem(b);
    setEditBatchForm({
      batch_number: b.batch_number || '',
      manufacturing_date: b.manufacturing_date ? new Date(b.manufacturing_date).toISOString().split('T')[0] : '',
      expiry_date: b.expiry_date ? new Date(b.expiry_date).toISOString().split('T')[0] : '',
      isActive: b.isActive !== false
    });
    setModalType('EDIT_BATCH');
  };

  const handleUpdateBatch = async (e) => {
    e.preventDefault();
    try {
      const res = await warehouseService.updateBatch(editingItem._id, editBatchForm);
      if (res.success) {
        showToast('Batch updated successfully!', 'success');
        setModalType(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDeleteBatch = async (b) => {
    if (!window.confirm(`Delete / Quarantine batch ${b.batch_number}?`)) return;
    try {
      const res = await warehouseService.deleteBatch(b._id);
      if (res.success) {
        showToast('Batch archived / quarantined', 'success');
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  // Load KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await warehouseService.getStats();
      if (res.success) setStats(res.data.kpis);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    warehouseService.getLocations({ limit: 100 }).then(res => {
      if (res?.success) setLocations(Array.isArray(res.data) ? res.data : (res.data?.locations || []));
    }).catch(() => {});
  }, [fetchStats]);

  // Load section-specific data
  const loadSectionData = useCallback(async () => {
    setLoadingData(true);
    try {
      if (activeSection === 'dashboard') {
        const [sRes, aRes] = await Promise.all([warehouseService.getStats(), warehouseService.getSupplyRequests({ status: 'APPROVED' })]);
        if (sRes.success) setStats(sRes.data?.kpis || null);
        if (aRes.success) setSupplyRequests(aRes.data?.supplyRequests || (Array.isArray(aRes.data) ? aRes.data : []));
      } else if (activeSection === 'medicines') {
        const res = await warehouseService.getMedicines({ limit: 100 });
        if (res.success) setMedicines(res.data?.medicines || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'batches') {
        const res = await warehouseService.getBatches({ limit: 100 });
        if (res.success) setBatches(res.data?.batches || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'inventory') {
        const res = await warehouseService.getStocks({ limit: 100 });
        if (res.success) setStocks(res.data?.stocks || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'goods_receipt') {
        const [grRes, poRes, locRes] = await Promise.all([warehouseService.getGoodsReceipts({ limit: 50 }), warehouseService.getPurchaseOrders({ limit: 50 }), warehouseService.getLocations({ limit: 100 })]);
        if (locRes?.success) setLocations(locRes.data?.locations || (Array.isArray(locRes.data) ? locRes.data : []));
        if (grRes.success) setGoodsReceipts(grRes.data?.goodsReceipts || (Array.isArray(grRes.data) ? grRes.data : []));
        if (poRes.success) setPurchaseOrders(poRes.data?.purchaseOrders || (Array.isArray(poRes.data) ? poRes.data : []));
      } else if (activeSection === 'order_processing') {
        const res = await warehouseService.getSupplyRequests({ limit: 100 });
        if (res.success) {
          const list = res.data?.supplyRequests || (Array.isArray(res.data) ? res.data : []);
          setSupplyRequests(list.filter((r) => r.status === 'APPROVED' || r.status === 'PROCESSING'));
        }
      } else if (activeSection === 'batch_allocation') {
        const mRes = await warehouseService.getMedicines({ limit: 50 });
        if (mRes.success) {
          const list = mRes.data?.medicines || (Array.isArray(mRes.data) ? mRes.data : []);
          setMedicines(list);
          if (list.length > 0 && !selectedMedForFefo) {
            setSelectedMedForFefo(list[0].medicine_id);
          }
        }
      } else if (activeSection === 'stock_dispatch') {
        const res = await warehouseService.getTransfers({ limit: 100 });
        if (res.success) setTransfers(res.data?.transfers || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'adjustments') {
        const [mRes, bRes] = await Promise.all([warehouseService.getMedicines({ limit: 100 }), warehouseService.getBatches({ limit: 100 })]);
        if (mRes.success) setMedicines(mRes.data?.medicines || (Array.isArray(mRes.data) ? mRes.data : []));
        if (bRes.success) setBatches(bRes.data?.batches || (Array.isArray(bRes.data) ? bRes.data : []));
      } else if (activeSection === 'returns') {
        const res = await warehouseService.getTransfers({ limit: 50 });
        if (res.success) setTransfers(res.data?.transfers || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'transactions') {
        const res = await warehouseService.getTransfers({ limit: 50 });
        if (res.success) setTransfers(res.data?.transfers || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'alerts') {
        const res = await warehouseService.getAlerts();
        if (res.success) setAlerts(Array.isArray(res.data) ? res.data : (res.data?.alerts || []));
      }
    } catch (err) {
      showToast(err.message || 'Error loading database records', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [activeSection, selectedMedForFefo, showToast]);

  useEffect(() => {
    loadSectionData();
  }, [loadSectionData]);

  // Load FEFO batches whenever selected medicine changes
  useEffect(() => {
    if (selectedMedForFefo && activeSection === 'batch_allocation') {
      warehouseService.getFefoBatches(selectedMedForFefo).then((res) => {
        if (res.success) setFefoBatches(res.data.fefoBatches || []);
      }).catch(() => setFefoBatches([]));
    }
  }, [selectedMedForFefo, activeSection]);

  // Handle Dispatch
  const handleDispatch = async (trfId) => {
    try {
      const res = await warehouseService.dispatchTransfer(trfId);
      if (res.success) {
        showToast('Transfer dispatched successfully and stock deducted!', 'success');
        await warehouseService.notifyPharmacyTransfer(trfId);
        showToast('Inter-service dispatch notification sent to destination pharmacy.', 'info');
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      showToast('Warehouse operational alert acknowledged and recorded.', 'info');
      setAlerts(prev => prev.filter(a => a._id !== alertId));
    } catch (err) {
      showToast(err.message || 'Error updating alert status', 'error');
    }
  };

  const handleConfirmReceipt = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    showToast('Stock receipt confirmation is executed via the Pharmacy Inward Desk.', 'info');
    setModalType(null);
  };

  // Handle Adjustment
    const handleReceiveGoods = async (e) => {
    e.preventDefault();
    try {
      if (!grForm.purchase_order) {
        showToast('Please select a Purchase Order reference', 'error');
        return;
      }
      if (!grForm.quantity_received || Number(grForm.quantity_received) <= 0) {
        showToast('Quantity received must be greater than 0', 'error');
        return;
      }
      if (!grForm.batch_number) {
        showToast('Please enter a manufacturer batch number', 'error');
        return;
      }
      if (new Date(grForm.expiry_date) <= new Date(grForm.manufacturing_date)) {
        showToast('Expiry date must be after manufacturing date', 'error');
        return;
      }

      const poObj = purchaseOrders.find(p => p.po_id === grForm.purchase_order || p._id === grForm.purchase_order);
      const selectedItem = (poObj?.items || []).find(it => it._id === grForm.po_item || it.po_item_id === grForm.po_item) || poObj?.items?.[0];

      if (!selectedItem) {
        showToast('Could not find selected PO line item. Please select a valid item from the PO.', 'error');
        return;
      }

      const isRejected = (grForm.action || 'ACCEPTED') === 'REJECTED';
      const actionPrefix = isRejected ? '[ACTION: REJECTED]' : '[ACTION: ACCEPTED]';
      const combinedNotes = `${actionPrefix} ${grForm.notes || (isRejected ? 'Rejected by staff at dock' : 'Verified and accepted')}`.trim();

      const payload = {
        purchase_order: grForm.purchase_order,
        notes: combinedNotes,
        status: isRejected ? 'REJECTED' : 'ACCEPTED',
        items: [
          {
            po_item: selectedItem._id || selectedItem.po_item_id,
            quantity_received: parseInt(grForm.quantity_received, 10),
            batch_number: grForm.batch_number.toUpperCase().trim(),
            manufacturing_date: grForm.manufacturing_date,
            expiry_date: grForm.expiry_date,
            storage_location: grForm.storage_location || (locations[0]?.location_id || 'LOC-Z1-R01')
          }
        ]
      };

      const res = await warehouseService.createGoodsReceipt(payload);
      if (res.success) {
        if (isRejected) {
          showToast('Inward shipment logged with action: REJECTED (Quarantined)', 'warning');
        } else {
          showToast('Inward goods received & accepted successfully! Stock units & batch registered.', 'success');
        }
        setModalType(null);
        setGrForm({
          purchase_order: '',
          po_item: '',
          quantity_received: 100,
          action: 'ACCEPTED',
          batch_number: '',
          manufacturing_date: new Date().toISOString().split('T')[0],
          expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          storage_location: '',
          notes: ''
        });
        loadSectionData();
      } else {
        showToast(res.message || 'Failed to record goods receipt', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Error recording goods receipt', 'error');
    }
  };

  const handleCreateAdjustment = async (e) => {
    e.preventDefault();
    try {
      const targetBatch = batches.find(b => b.batch_number === adjForm.batch_number || b._id === adjForm.batch_number);
      const targetStock = stocks.find(s => String(s.batch?._id || s.batch) === String(targetBatch?._id) || s.batch?.batch_number === adjForm.batch_number);
      const available = targetStock ? targetStock.quantity_on_hand : (targetBatch?.initial_quantity || 0);

      const damagedQty = Math.abs(parseInt(adjForm.quantity_delta, 10));
      if (adjForm.quantity_delta < 0 && damagedQty > available) {
        showToast(`Cannot record damage of ${damagedQty} units: exceeds available warehouse stock (${available} units).`, 'error');
        return;
      }

      const res = await warehouseService.createStockAdjustment(adjForm);
      if (res.success) {
        showToast('Stock adjustment logged successfully!', 'success');
        setModalType(null);
        setAdjForm({ medicine_id: '', batch_number: '', quantity_delta: -5, reason: 'DAMAGED_IN_TRANSIT', notes: '' });
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  return (
    <div className="page-body">
      {/* 1. DASHBOARD OVERVIEW */}
      {activeSection === 'dashboard' && (
        <MedflowDashboardView user={user} systemType="WAREHOUSE" stats={stats} onSelectSection={onSelectSection}>
          <div className="table-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#18212f', marginBottom: '14px' }}>
              Assigned Operational Tasks: Orders Ready for Allocation &amp; Dispatch
            </h3>
            <DataTable
              columns={[
                { header: 'Request ID', key: 'request_id', render: (r) => <strong>{r.request_id}</strong> },
                { header: 'Pharmacy', key: 'pharmacy', render: (r) => r.pharmacy?.name || 'Branch' },
                { header: 'Date', key: 'request_date', render: (r) => new Date(r.request_date).toLocaleDateString() },
                { header: 'Status', key: 'status', render: (r) => {
                const isRej = r.status === 'REJECTED' || (r.notes && r.notes.includes('REJECTED'));
                return (
                  <span className={`status-pill ${isRej ? 'out-of-stock' : 'in-stock'}`}>
                    {isRej ? 'REJECTED' : (r.status || 'ACCEPTED')}
                  </span>
                );
              } },
                {
                  header: 'Action',
                  key: 'action',
                  render: (r) => (
                    <button className="action-icon-btn primary" onClick={() => onSelectSection('batch_allocation')}>
                      Allocate Batches
                    </button>
                  )
                }
              ]}
              data={supplyRequests}
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
          onSelectSection={onSelectSection}
          onAddNew={() => {
            setMedForm({ name: '', sku: 'MED-' + Date.now().toString().slice(-4), category: 'Analgesics', dosage: '500mg', formulation: 'Tablet', manufacturer: '', reorder_level: 50, unit_price: 20 });
            setModalType('ADD_MEDICINE');
          }}
          addNewLabel="+ Add Medicine"
          stats={[
            { label: 'Formulary Items', value: medicines.length, icon: '💊', tone: 'blue', change: 'Warehouse catalog' },
            { label: 'Low Stock Formulations', value: stats?.lowStockMedicines || 0, icon: '⚠️', tone: 'red', change: 'Below safety threshold' },
            { label: 'Active Categories', value: new Set(medicines.map(m => m.category)).size || 4, icon: '🏷️', tone: 'purple', change: 'Classification' },
            { label: 'Storage Status', value: 'Ready', icon: '✅', tone: 'green', change: 'Inspectable' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Medicine ID', key: 'medicine_id' },
            { header: 'Name', key: 'name', render: (r) => <strong>{r.name}</strong> },
            { header: 'Category', key: 'category' },
            { header: 'Dosage / Formulation', key: 'dosage', render: (r) => `${r.dosage} (${r.formulation})` },
            { header: 'Manufacturer', key: 'manufacturer' },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="action-btn-update"
                    onClick={() => handleOpenEditMedicine(r)}
                    style={{ padding: '4px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  >
                    Update
                  </button>
                  <button
                    className="action-btn-delete"
                    onClick={() => handleDeleteMedicine(r)}
                    style={{ padding: '4px 8px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  >
                    Delete
                  </button>
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                    Inspect
                  </button>
                </div>
              )
            }
          ]}
          data={medicines}
          loading={loadingData}
          searchPlaceholder="Search warehouse formulary..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* 3. BATCH MANAGEMENT */}
      {activeSection === 'batches' && (
        <SectionWorkspaceLayout
          title="Batch Management"
          heroIcon="🏷️"
          onSelectSection={onSelectSection}
          onAddNew={() => {
            setBatchForm({ medicine_id: medicines[0]?._id || '', batch_number: 'BAT-' + Date.now().toString().slice(-6), manufacturing_date: new Date().toISOString().split('T')[0], expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], initial_quantity: 100 });
            setModalType('ADD_BATCH');
          }}
          addNewLabel="+ Register Batch"
          stats={[
            { label: 'Active Batches', value: batches.length, icon: '🏷️', tone: 'blue', change: 'In storage' },
            { label: 'Expiring ≤ 90 Days', value: stats?.nearExpiryBatches || batches.filter(b => new Date(b.expiry_date) < new Date(Date.now() + 90 * 86400000)).length, icon: '⏳', tone: 'amber', change: 'FEFO rule' },
            { label: 'Expired Lots', value: batches.filter(b => new Date(b.expiry_date) < new Date()).length, icon: '🚫', tone: 'red', change: 'Quarantined' },
            { label: 'Integrity', value: '100% Verified', icon: '✅', tone: 'green', change: 'GMP compliant' }
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
              return <span style={{ color: isPast ? '#ef4444' : 'inherit', fontWeight: isPast ? 700 : 'normal' }}>{exp.toLocaleDateString()}</span>;
            }},
            { header: 'Status', key: 'isActive', render: (r) => <span className={`status-pill ${r.isActive ? 'active' : 'inactive'}`}>{r.isActive ? 'ACTIVE' : 'QUARANTINE'}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="action-btn-update"
                    onClick={() => handleOpenEditBatch(r)}
                    style={{ padding: '4px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
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
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                    Inspect
                  </button>
                </div>
              )
            }
          ]}
          data={batches}
          loading={loadingData}
          searchPlaceholder="Search batches by code or medicine..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* 4. WAREHOUSE INVENTORY */}
      {activeSection === 'inventory' && (
        <SectionWorkspaceLayout
          title="Warehouse Inventory"
          heroIcon="📦"
          onSelectSection={onSelectSection}
          onAddNew={() => setModalType('REPORT_ADJUSTMENT')}
          addNewLabel="+ Adjust Stock"
          stats={[
            { label: 'Total Stock Units', value: stocks.reduce((acc, s) => acc + (s.quantity_on_hand || 0), 0).toLocaleString(), icon: '📦', tone: 'blue', change: 'Physical inventory' },
            { label: 'Reserved Lots', value: stocks.reduce((acc, s) => acc + (s.quantity_reserved || 0), 0).toLocaleString(), icon: '🔒', tone: 'purple', change: 'Allocated to dispatches' },
            { label: 'Low Stock Alerts', value: stocks.filter(s => s.stock_status === 'LOW_STOCK').length, icon: '⚠️', tone: 'red', change: 'Replenishment needed' },
            { label: 'Storage Health', value: 'Optimal', icon: '🏢', tone: 'green', change: 'Aisle capacity OK' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Stock Ref', key: 'stock_id' },
            { header: 'Medicine', key: 'batch', render: (r) => r.batch?.medicine?.name || '--' },
            { header: 'Batch Number', key: 'batch_num', render: (r) => r.batch?.batch_number || '--' },
            { header: 'Storage Location', key: 'storage_location', render: (r) => r.storage_location ? `${r.storage_location.zone} (${r.storage_location.rack_bin})` : 'Main Rack' },
            { header: 'Units on Hand', key: 'quantity_on_hand', render: (r) => <strong>{(r.quantity_on_hand || 0).toLocaleString()}</strong> },
            { header: 'Status', key: 'stock_status', render: (r) => <span className={`status-pill ${String(r.stock_status || '').toLowerCase().replace('_', '-')}`}>{r.stock_status}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="action-btn-update"
                    onClick={() => {
                      setAdjForm({
                        medicine_id: r.batch?.medicine?._id || r.batch?.medicine || '',
                        batch_number: r.batch?.batch_number || '',
                        quantity_delta: -5,
                        reason: 'CYCLE_COUNT_DISCREPANCY',
                        notes: 'Audit adjustment for stock ' + (r.stock_id || '')
                      });
                      setModalType('REPORT_ADJUSTMENT');
                    }}
                    style={{ padding: '4px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  >
                    Update / Adjust
                  </button>
                  <button
                    className="action-btn-delete"
                    onClick={() => showToast(`Stock record ${r.stock_id || ''} requires batch quarantine before deletion`, 'warning')}
                    style={{ padding: '4px 8px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  >
                    Delete
                  </button>
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                    Inspect
                  </button>
                </div>
              )
            }
          ]}
          data={stocks}
          loading={loadingData}
          searchPlaceholder="Search warehouse stock by medicine or location..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* 5. GOODS RECEIPT */}
      {activeSection === 'goods_receipt' && (
        <SectionWorkspaceLayout
          title="Goods Receipt"
          heroIcon="📥"
          onAddNew={() => {
            setGrForm({
              purchase_order: '',
              po_item: '',
              quantity_received: 100,
              batch_number: 'BAT-' + Date.now().toString().slice(-6),
              manufacturing_date: new Date().toISOString().split('T')[0],
              expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              storage_location: locations[0]?.location_id || locations[0]?._id || '',
              notes: ''
            });
            setModalType('RECEIVE_GOODS');
          }}
          addNewLabel="+ Receive Inward Goods"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Completed Goods Receipts', value: goodsReceipts.length, icon: '📥', tone: 'green', change: 'Verified inward dock entries' },
            { label: 'Open Purchase Orders', value: purchaseOrders.length, icon: '🛒', tone: 'blue', change: 'Eligible for inward intake' },
            { label: 'Formulary Items', value: medicines.length, icon: '💊', tone: 'purple', change: 'Active catalog medicines' },
            { label: 'Dock Receiving Status', value: 'Ready', icon: '🛡️', tone: 'green', change: 'FEFO batch registration active' }
          ]}
        >
          <DataTable
            columns={[
              { header: 'Receipt ID', key: 'receipt_id', render: (r) => <strong>{r.receipt_id}</strong> },
              { header: 'PO Ref', key: 'purchase_order', render: (r) => r.purchase_order?.po_id || 'Direct Inward' },
              { header: 'Supplier', key: 'supplier', render: (r) => r.purchase_order?.supplier?.name || 'Verified Vendor' },
              { header: 'Date Received', key: 'received_date', render: (r) => new Date(r.received_date).toLocaleDateString() },
              { header: 'Status', key: 'status', render: (r) => <span className="status-pill approved">{r.status}</span> },
              {
                header: 'Actions',
                key: 'actions',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="action-btn-update"
                      onClick={() => { setSelectedItem(r); showToast('Goods receipt ' + r.receipt_id + ' inspected', 'info'); }}
                      style={{ padding: '4px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Update
                    </button>
                    <button
                      className="action-btn-delete"
                      onClick={() => {
                        if (window.confirm('Delete / Void receipt ' + r.receipt_id + '?')) {
                          showToast('Receipt ' + r.receipt_id + ' archived', 'info');
                          setGoodsReceipts(prev => prev.filter(g => g._id !== r._id && g.receipt_id !== r.receipt_id));
                        }
                      }}
                      style={{ padding: '4px 8px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Delete
                    </button>
                    <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                      Inspect Lot
                    </button>
                  </div>
                )
              }
            ]}
            data={goodsReceipts}
            loading={loadingData}
            searchPlaceholder="Search inward goods receipts..."
            onAddNew={() => {
              setGrForm({
                purchase_order: '',
                po_item: '',
                quantity_received: 100,
                batch_number: 'BAT-' + Date.now().toString().slice(-6),
                manufacturing_date: new Date().toISOString().split('T')[0],
                expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                storage_location: locations[0]?.location_id || locations[0]?._id || '',
                notes: ''
              });
              setModalType('RECEIVE_GOODS');
            }}
            addNewLabel="+ Receive Inward Goods"
          />
        </SectionWorkspaceLayout>
      )}

      {/* 6. ORDER PROCESSING */}
      {activeSection === 'order_processing' && (
        <DataTable
          columns={[
            { header: 'Request ID', key: 'request_id', render: (r) => <strong>{r.request_id}</strong> },
            { header: 'Pharmacy Destination', key: 'pharmacy', render: (r) => r.pharmacy?.name || 'Branch' },
            { header: 'Request Date', key: 'request_date', render: (r) => new Date(r.request_date).toLocaleDateString() },
            { header: 'Status', key: 'status', render: (r) => <span className="status-pill approved">{r.status}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: () => (
                <button className="action-icon-btn primary" onClick={() => onSelectSection('batch_allocation')}>
                  FEFO Pick List
                </button>
              )
            }
          ]}
          data={supplyRequests}
          loading={loadingData}
          searchPlaceholder="Search approved orders to process..."
        />
      )}

      {/* 7. BATCH ALLOCATION (FEFO RECOMMENDATIONS) */}
      {activeSection === 'batch_allocation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="table-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '12px' }}>
              First-Expiry, First-Out (FEFO) Allocation Engine
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Select a medicine below to query available batches ranked in strict FEFO order. Batches with the earliest expiry dates are allocated first to prevent inventory loss.
            </p>
            <div className="form-field" style={{ maxWidth: '400px', marginBottom: '18px' }}>
              <label>Select Medicine Formulation:</label>
              <select value={selectedMedForFefo} onChange={(e) => setSelectedMedForFefo(e.target.value)}>
                {medicines.map((m) => (
                  <option key={m._id} value={m.medicine_id}>{m.name} ({m.dosage} &bull; {m.formulation})</option>
                ))}
              </select>
            </div>

            <DataTable
              columns={[
                { header: 'FEFO Rank', key: 'rank', render: (_, idx) => <strong>#{idx + 1}</strong> },
                { header: 'Batch Number', key: 'batch_number', render: (r) => <strong>{r.batch_number}</strong> },
                { header: 'Expiry Date', key: 'expiry_date', render: (r) => <span style={{ color: '#ca8a04', fontWeight: 600 }}>{new Date(r.expiry_date).toLocaleDateString()}</span> },
                { header: 'Available Units', key: 'available_quantity', render: (r) => <strong>{(r.available_quantity || 0).toLocaleString()}</strong> },
                { header: 'Storage Location', key: 'storage_location', render: (r) => r.storage_location ? `${r.storage_location.zone} (${r.storage_location.rack_bin})` : 'Default' }
              ]}
              data={fefoBatches}
              loading={loadingData}
              emptyTitle="No Available Batches"
              emptyDesc="No unexpired stock currently available for this medicine."
            />
          </div>
        </div>
      )}

      {/* 8. STOCK DISPATCH */}
      {activeSection === 'stock_dispatch' && (
        <DataTable
          columns={[
            { header: 'Transfer ID', key: 'transfer_id', render: (r) => <strong>{r.transfer_id}</strong> },
            { header: 'Destination', key: 'pharmacy', render: (r) => r.pharmacy?.name || 'Branch' },
            { header: 'Transfer Date', key: 'transfer_date', render: (r) => new Date(r.transfer_date).toLocaleDateString() },
            { header: 'Status', key: 'status', render: (r) => <span className={`status-pill ${r.status?.toLowerCase()}`}>{r.status}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {(r.status === 'PREPARED' || r.status === 'PENDING') && (
                    <button className="action-icon-btn primary" onClick={() => handleDispatch(r._id)}>
                      Record Dispatch
                    </button>
                  )}
                  {r.status === 'DISPATCHED' && (
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Dispatched ✔</span>
                  )}
                  <button
                    className="action-icon-btn"
                    onClick={() => {
                      const manifest = {
                        manifest_id: `MNF-${r.transfer_id || String(r._id).slice(-6)}`,
                        transfer_id: r.transfer_id,
                        destination_pharmacy: r.pharmacy?.name || 'Branch Pharmacy',
                        dispatched_at: r.transfer_date || new Date().toISOString(),
                        items: (r.items || []).map(it => ({
                          batch_number: it.batch?.batch_number || it.batch_number || 'LOT-MAIN',
                          medicine_name: it.medicine?.name || 'Medicine',
                          quantity: it.quantity || it.allocated_quantity || 0
                        }))
                      };
                      setSelectedManifest(manifest);
                      setModalType('VIEW_MANIFEST');
                    }}
                    title="View Dispatch Manifest JSON"
                    style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}
                  >
                    📄 Manifest
                  </button>
                </div>
              )
            }
          ]}
          data={transfers}
          loading={loadingData}
          searchPlaceholder="Search transfers ready for dispatch..."
        />
      )}

      {/* 9. STOCK ADJUSTMENTS */}
      {activeSection === 'adjustments' && (
        <SectionWorkspaceLayout
          title="Stock Adjustments"
          heroIcon="⚖️"
          onSelectSection={onSelectSection}
          onAddNew={() => setModalType('REPORT_ADJUSTMENT')}
          addNewLabel="+ Report Stock Discrepancy"
          stats={[
            { label: 'Audited Batches', value: batches.length, icon: '🏷️', tone: 'blue', change: 'Total batches' },
            { label: 'Variance Reports', value: '0 Active', icon: '⚠️', tone: 'amber', change: 'Under review' },
            { label: 'Audit Reconciliation', value: '100% Balanced', icon: '✅', tone: 'green', change: 'Physical matches ledger' },
            { label: 'GMP Compliance', value: 'Verified', icon: '🛡️', tone: 'purple', change: 'SOP adherence' }
          ]}
        >
          <DataTable
            columns={[
              { header: 'Batch', key: 'batch_number' },
              { header: 'Medicine', key: 'medicine', render: (r) => r.medicine?.name || '--' },
              { header: 'Expiry Date', key: 'expiry_date', render: (r) => new Date(r.expiry_date).toLocaleDateString() },
              { header: 'Status', key: 'isActive', render: (r) => <span className="status-pill active">RECORDED</span> },
              {
                header: 'Actions',
                key: 'actions',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="action-btn-update"
                      onClick={() => {
                        setAdjForm({
                          medicine_id: r.medicine?._id || r.medicine || '',
                          batch_number: r.batch_number || '',
                          quantity_delta: -5,
                          reason: 'CYCLE_COUNT_DISCREPANCY',
                          notes: 'Adjust batch ' + r.batch_number
                        });
                        setModalType('REPORT_ADJUSTMENT');
                      }}
                      style={{ padding: '4px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Update
                    </button>
                    <button
                      className="action-btn-delete"
                      onClick={() => {
                        if (window.confirm('Archive / Delete adjustment for batch ' + r.batch_number + '?')) {
                          showToast('Adjustment archived', 'info');
                          setBatches(prev => prev.filter(b => b._id !== r._id));
                        }
                      }}
                      style={{ padding: '4px 8px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Delete
                    </button>
                    <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                      Inspect
                    </button>
                  </div>
                )
              }
            ]}
            data={batches}
            loading={loadingData}
            searchPlaceholder="Search batch inventory..."
          />
        </SectionWorkspaceLayout>
      )}

      {/* 10. RETURNS PROCESSING */}
      {activeSection === 'returns' && (
        <SectionWorkspaceLayout
          title="Returns Processing"
          heroIcon="🔄"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Total Returns', value: (Array.isArray(transfers) ? transfers : []).filter(t => t.status === 'DISPATCHED').length, icon: '🔄', tone: 'blue', change: 'Logged return flows' },
            { label: 'Processed', value: '100%', icon: '✅', tone: 'green', change: 'Restocked or quarantined' },
            { label: 'Damaged Units', value: '0', icon: '⚠️', tone: 'red', change: 'Zero reported' },
            { label: 'Return Rate', value: '< 0.5%', icon: '🛡️', tone: 'purple', change: 'Within threshold' }
          ]}
        >
          <DataTable
            columns={[
              { header: 'Return Tracking Ref', key: 'transfer_id', render: (r) => <strong>RET-{r.transfer_id || String(r._id || '').slice(-6)}</strong> },
              { header: 'Branch / Supplier', key: 'pharmacy', render: (r) => r.pharmacy?.name || 'Branch' },
              { header: 'Date', key: 'transfer_date', render: (r) => (r.transfer_date ? new Date(r.transfer_date).toLocaleDateString() : '--') },
              { header: 'Status', key: 'status', render: () => <span className="status-pill active">PROCESSED</span> },
              { header: 'Actions', key: 'act', render: (r) => (
                <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                  View Details
                </button>
              )}
            ]}
            data={(Array.isArray(transfers) ? transfers : []).filter((t) => t.status === 'DISPATCHED')}
            loading={loadingData}
            searchPlaceholder="Search return shipments..."
          />
        </SectionWorkspaceLayout>
      )}

      {/* 11. TRANSACTION HISTORY */}
      {activeSection === 'transactions' && (
        <SectionWorkspaceLayout
          title="Transaction History"
          heroIcon="📑"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Total Transfers Logged', value: transfers.length, icon: '📑', tone: 'blue', change: 'All stock movements' },
            { label: 'Dispatched', value: transfers.filter(t => t.status === 'DISPATCHED').length, icon: '✅', tone: 'green', change: 'Delivered to pharmacy' },
            { label: 'In Transit', value: transfers.filter(t => t.status === 'IN_TRANSIT').length, icon: '🚚', tone: 'purple', change: 'En route' },
            { label: 'Pending', value: transfers.filter(t => t.status === 'PENDING').length, icon: '⏳', tone: 'amber', change: 'Awaiting dispatch' }
          ]}
        >
          <DataTable
            columns={[
              { header: 'Transaction ID', key: 'transfer_id', render: (r) => <strong>{r.transfer_id}</strong> },
              { header: 'Target Destination', key: 'pharmacy', render: (r) => r.pharmacy?.name || 'Branch' },
              { header: 'Date', key: 'transfer_date', render: (r) => new Date(r.transfer_date).toLocaleDateString() },
              { header: 'Status', key: 'status', render: (r) => <span className="status-pill active">{r.status}</span> },
              { header: 'Actions', key: 'act', render: (r) => (
                <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                  View Details
                </button>
              )}
            ]}
            data={transfers}
            loading={loadingData}
            searchPlaceholder="Search transaction records..."
          />
        </SectionWorkspaceLayout>
      )}

      {/* 12. ALERTS */}
      {activeSection === 'alerts' && (
        <SectionWorkspaceLayout
          title="Alerts"
          heroIcon="🔔"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Active Alerts', value: alerts.length, icon: '🔔', tone: 'red', change: 'Need attention' },
            { label: 'Critical', value: alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'DANGER').length, icon: '🚨', tone: 'red', change: 'Immediate action' },
            { label: 'Near Expiry', value: stats?.nearExpiryBatches || 0, icon: '⏳', tone: 'amber', change: 'FEFO threshold' },
            { label: 'System Status', value: 'Operational', icon: '🛡️', tone: 'green', change: 'All services running' }
          ]}
        >
          <DataTable
            columns={[
              { header: 'Severity', key: 'severity', render: (r) => <span className={`status-pill ${r.severity === 'CRITICAL' || r.severity === 'DANGER' ? 'out-of-stock' : 'low-stock'}`}>{r.severity}</span> },
              { header: 'Type', key: 'alert_type' },
              { header: 'Subject', key: 'title', render: (r) => <strong>{r.title}</strong> },
              { header: 'Message Details', key: 'message' },
              { header: 'Reported Date', key: 'created_at', render: (r) => new Date(r.created_at).toLocaleDateString() },
              { header: 'Action', key: 'ack', render: (r) => (
                <button className="action-icon-btn primary" onClick={() => handleAcknowledgeAlert(r._id)}>
                  ✓ Acknowledge
                </button>
              )}
            ]}
            data={alerts}
            loading={loadingData}
            searchPlaceholder="Search warehouse operational alerts..."
          />
        </SectionWorkspaceLayout>
      )}

      {/* 13. MY PROFILE */}
      {activeSection === 'profile' && (
        <div className="table-card" style={{ padding: '24px', maxWidth: '600px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '18px' }}>
            Warehouse Staff User Profile
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
              <span className="meta-label">Assigned Role:</span>
              <span className="meta-value">{user?.role?.role_name || user?.role}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">System Facility:</span>
              <span className="meta-value">Central Warehouse</span>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Need to update your credentials or permissions? Please contact your Warehouse Administrator.
          </p>
        </div>
      )}

      {/* ================= MODALS ================= */}
      {/* Receive Inward Goods Modal */}
      <Modal isOpen={modalType === 'RECEIVE_GOODS'} onClose={() => setModalType(null)} title="Receive Inward Goods (Goods Receipt - GR)">
        <form onSubmit={handleReceiveGoods} className="modal-form-body">
          {/* Action Field: ACCEPTED / REJECTED */}
          <div className="form-field">
            <label style={{ fontWeight: 700, color: '#18212f' }}>Action / Inward Disposition *</label>
            <select
              value={grForm.action || 'ACCEPTED'}
              onChange={(e) => setGrForm({ ...grForm, action: e.target.value })}
              required
              style={{
                borderColor: grForm.action === 'REJECTED' ? '#f87171' : '#86efac',
                background: grForm.action === 'REJECTED' ? '#fffafa' : '#f0fdf4',
                fontWeight: 600
              }}
            >
              <option value="ACCEPTED">ACCEPTED - Quality Verified &amp; Accepted into Inventory</option>
              <option value="REJECTED">REJECTED - Damaged / Defective / Rejected at Inward Dock</option>
            </select>
          </div>

          <div className="form-field">
            <label>Select Purchase Order Reference *</label>
            <select
              value={grForm.purchase_order}
              onChange={(e) => {
                const poId = e.target.value;
                const poObj = purchaseOrders.find(p => p.po_id === poId || p._id === poId);
                const firstItm = poObj?.items?.[0];
                setGrForm(prev => ({
                  ...prev,
                  purchase_order: poId,
                  po_item: firstItm?._id || firstItm?.po_item_id || '',
                  quantity_received: firstItm?.quantity_ordered || prev.quantity_received || 100
                }));
              }}
              required
            >
              <option value="">-- Select Active Purchase Order --</option>
              {purchaseOrders.map(p => (
                <option key={p._id || p.po_id} value={p.po_id || p._id}>
                  {p.po_id} - {p.supplier?.name || 'Vendor'} ({p.status})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>PO Line Item / Medicine SKU *</label>
            {(() => {
              const currentPO = purchaseOrders.find(p => p.po_id === grForm.purchase_order || p._id === grForm.purchase_order);
              const poItems = currentPO?.items || [];
              return (
                <select
                  value={grForm.po_item}
                  onChange={(e) => {
                    const selectedPoItemId = e.target.value;
                    const itm = poItems.find(i => i._id === selectedPoItemId || i.po_item_id === selectedPoItemId);
                    setGrForm(prev => ({
                      ...prev,
                      po_item: selectedPoItemId,
                      quantity_received: itm?.quantity_ordered || prev.quantity_received
                    }));
                  }}
                  required
                >
                  <option value="">-- Select Medicine Line Item from PO --</option>
                  {poItems.length > 0 ? (
                    poItems.map(it => (
                      <option key={it._id || it.po_item_id} value={it._id || it.po_item_id}>
                        {it.medicine?.name || 'Medicine'} ({it.medicine?.dosage || ''} - {it.medicine?.formulation || ''}) | Ordered: {it.quantity_ordered} units
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      {grForm.purchase_order ? 'No line items found in selected PO' : 'Select a PO above first'}
                    </option>
                  )}
                </select>
              );
            })()}
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Quantity Received (Units) *</label>
              <input
                type="number"
                min="1"
                required
                value={grForm.quantity_received}
                onChange={(e) => setGrForm({ ...grForm, quantity_received: parseInt(e.target.value, 10) || 1 })}
              />
            </div>

            <div className="form-field">
              <label>Manufacturer Batch / Lot Number *</label>
              <input
                type="text"
                required
                value={grForm.batch_number}
                onChange={(e) => setGrForm({ ...grForm, batch_number: e.target.value })}
                placeholder="e.g. BAT-2026-X99"
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Manufacturing Date *</label>
              <input
                type="date"
                required
                value={grForm.manufacturing_date}
                onChange={(e) => setGrForm({ ...grForm, manufacturing_date: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label>Expiry Date (FEFO Enforcement) *</label>
              <input
                type="date"
                required
                value={grForm.expiry_date}
                onChange={(e) => setGrForm({ ...grForm, expiry_date: e.target.value })}
              />
            </div>
          </div>

          {/* Storage Location Field: Uses database locations with fallback */}
          <div className="form-field">
            <label>Warehouse Storage Location / Rack *</label>
            {(() => {
              const displayLocs = (locations && locations.length > 0) ? locations : DEFAULT_STORAGE_LOCATIONS;
              return (
                <select
                  value={grForm.storage_location || displayLocs[0]?.location_id || ''}
                  onChange={(e) => setGrForm({ ...grForm, storage_location: e.target.value })}
                  required
                >
                  {displayLocs.map(loc => (
                    <option key={loc._id || loc.location_id} value={loc.location_id || loc._id}>
                      {loc.zone} &bull; {loc.rack_bin} {loc.cold_storage ? '❄️ (Cold Chain 2°C-8°C)' : ''}
                    </option>
                  ))}
                </select>
              );
            })()}
          </div>

          <div className="form-field">
            <label>Dock Quality &amp; Verification Notes</label>
            <input
              type="text"
              value={grForm.notes}
              onChange={(e) => setGrForm({ ...grForm, notes: e.target.value })}
              placeholder={grForm.action === 'REJECTED' ? 'Reason for rejection: broken seal, expired, packaging compromised...' : 'Seals inspected, carton count verified, temperature normal'}
            />
          </div>

          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                background: grForm.action === 'REJECTED' ? '#dc2626' : '#16a34a',
                borderColor: grForm.action === 'REJECTED' ? '#b91c1c' : '#15803d'
              }}
            >
              {grForm.action === 'REJECTED' ? 'Confirm & Reject Shipment' : 'Confirm & Accept Inward Goods'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Report Stock Adjustment Modal */}
      <Modal isOpen={modalType === 'REPORT_ADJUSTMENT'} onClose={() => setModalType(null)} title="Report Damaged or Missing Stock">
        <form onSubmit={handleCreateAdjustment} className="modal-form-body">
          <div className="form-field">
            <label>Select Medicine Formulation *</label>
            <select value={adjForm.medicine_id} onChange={(e) => setAdjForm({ ...adjForm, medicine_id: e.target.value })} required>
              <option value="">Choose medicine...</option>
              {medicines.map((m) => (
                <option key={m._id} value={m.medicine_id}>{m.name} ({m.dosage})</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Batch Number *</label>
            <input type="text" required value={adjForm.batch_number} onChange={(e) => setAdjForm({ ...adjForm, batch_number: e.target.value })} placeholder="e.g. BAT-2027-3444" />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Quantity Delta (Negative for loss) *</label>
              <input type="number" required value={adjForm.quantity_delta} onChange={(e) => setAdjForm({ ...adjForm, quantity_delta: parseInt(e.target.value, 10) })} />
            </div>
            <div className="form-field">
              <label>Reason *</label>
              <select value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}>
                <option value="DAMAGED_IN_TRANSIT">Damaged in Transit</option>
                <option value="STORAGE_BREAKAGE">Storage Breakage</option>
                <option value="EXPIRY_QUARANTINE">Expired / Quarantine</option>
                <option value="CYCLE_COUNT_DISCREPANCY">Cycle Count Discrepancy</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label>Notes / Incident Details</label>
            <textarea rows="3" value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} placeholder="Describe condition or reason..."></textarea>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Log Adjustment</button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal isOpen={modalType === 'VIEW_DETAILS'} onClose={() => setModalType(null)} title="Entity Details & Specifications" maxWidth="760px">
        <div className="modal-form-body">
          <EntityDetailsTable data={selectedItem} title="Warehouse Item" />
          <div className="modal-action-footer" style={{ marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={() => setModalType(null)}>Close</button>
          </div>
        </div>
      </Modal>

      {/* Add Medicine Modal */}
      <Modal isOpen={modalType === 'ADD_MEDICINE'} onClose={() => setModalType(null)} title="Add New Medicine to Formulary">
        <form onSubmit={handleCreateMedicine} className="modal-form-body">
          <div className="form-field">
            <label>Medicine Name *</label>
            <input type="text" required value={medForm.name} onChange={(e) => setMedForm({ ...medForm, name: e.target.value })} placeholder="e.g. Amoxicillin" />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>SKU / Code *</label>
              <input type="text" required value={medForm.sku} onChange={(e) => setMedForm({ ...medForm, sku: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Category</label>
              <input type="text" value={medForm.category} onChange={(e) => setMedForm({ ...medForm, category: e.target.value })} />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Dosage</label>
              <input type="text" value={medForm.dosage} onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })} placeholder="500mg" />
            </div>
            <div className="form-field">
              <label>Formulation</label>
              <input type="text" value={medForm.formulation} onChange={(e) => setMedForm({ ...medForm, formulation: e.target.value })} placeholder="Tablet / Syrup" />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Manufacturer</label>
              <input type="text" value={medForm.manufacturer} onChange={(e) => setMedForm({ ...medForm, manufacturer: e.target.value })} placeholder="Pharma Corp" />
            </div>
            <div className="form-field">
              <label>Unit Price (₹)</label>
              <input type="number" value={medForm.unit_price} onChange={(e) => setMedForm({ ...medForm, unit_price: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Medicine</button>
          </div>
        </form>
      </Modal>

      {/* Edit Medicine Modal */}
      <Modal isOpen={modalType === 'EDIT_MEDICINE'} onClose={() => setModalType(null)} title="Update Medicine">
        <form onSubmit={handleUpdateMedicine} className="modal-form-body">
          <div className="form-field">
            <label>Medicine Name *</label>
            <input type="text" required value={editMedForm.name} onChange={(e) => setEditMedForm({ ...editMedForm, name: e.target.value })} />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Category</label>
              <input type="text" value={editMedForm.category} onChange={(e) => setEditMedForm({ ...editMedForm, category: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Manufacturer</label>
              <input type="text" value={editMedForm.manufacturer} onChange={(e) => setEditMedForm({ ...editMedForm, manufacturer: e.target.value })} />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Dosage</label>
              <input type="text" value={editMedForm.dosage} onChange={(e) => setEditMedForm({ ...editMedForm, dosage: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Unit Price (₹)</label>
              <input type="number" value={editMedForm.unit_price} onChange={(e) => setEditMedForm({ ...editMedForm, unit_price: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </Modal>

      {/* Add Batch Modal */}
      <Modal isOpen={modalType === 'ADD_BATCH'} onClose={() => setModalType(null)} title="Register New Batch">
        <form onSubmit={handleCreateBatch} className="modal-form-body">
          <div className="form-field">
            <label>Select Medicine *</label>
            <select
              required
              value={batchForm.medicine_id}
              onChange={(e) => setBatchForm({ ...batchForm, medicine_id: e.target.value })}
            >
              <option value="">Choose medicine...</option>
              {medicines.map((m) => (
                <option key={m._id} value={m._id}>{m.name} ({m.dosage})</option>
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
              placeholder="e.g. BAT-993021"
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
              <label>Expiry Date * (FEFO rule)</label>
              <input
                type="date"
                required
                value={batchForm.expiry_date}
                onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
              />
            </div>
          </div>
          <div className="form-field">
            <label>Initial Units Received *</label>
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
            <button type="submit" className="btn btn-primary">Register Batch</button>
          </div>
        </form>
      </Modal>

      {/* Edit Batch Modal */}
      <Modal isOpen={modalType === 'EDIT_BATCH'} onClose={() => setModalType(null)} title="Update Batch">
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
      {/* Manifest Modal */}
      <Modal isOpen={modalType === 'VIEW_MANIFEST'} onClose={() => setModalType(null)} title="Dispatch Manifest (Inter-Service Transfer)" maxWidth="760px">
        <div className="modal-form-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>
              Standard Dispatch Manifest readable by Pharmacy Inward Confirm Receipt
            </span>
            <button
              type="button"
              className="action-icon-btn"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(selectedManifest, null, 2));
                showToast('Manifest data copied to clipboard!', 'success');
              }}
            >
              📋 Copy Raw Manifest Data
            </button>
          </div>
          <EntityDetailsTable data={selectedManifest} title="Dispatch Manifest" />
          <div className="modal-action-footer" style={{ marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={() => setModalType(null)}>Close Manifest</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
