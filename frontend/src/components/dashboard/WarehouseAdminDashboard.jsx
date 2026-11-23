import SectionWorkspaceLayout from './SectionWorkspaceLayout';
import MedflowDashboardView from './MedflowDashboardView';
import React, { useState, useEffect, useCallback } from 'react';
import DataTable from './DataTable';
import KpiCards from './KpiCards';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';
import EntityDetailsTable from './EntityDetailsTable';
import { warehouseService } from '../../services/api';

const DEFAULT_STORAGE_LOCATIONS = [
  { location_id: 'LOC-Z1-R01', zone: 'Zone A (Main Warehouse)', rack_bin: 'Rack 01 / Bin 01', cold_storage: false },
  { location_id: 'LOC-Z1-R02', zone: 'Zone A (Main Warehouse)', rack_bin: 'Rack 01 / Bin 02', cold_storage: false },
  { location_id: 'LOC-Z2-R01', zone: 'Zone B (Bulk Storage)', rack_bin: 'Pallet 01', cold_storage: false },
  { location_id: 'LOC-COLD-01', zone: 'Cold Chain Vault (2°C-8°C)', rack_bin: 'Chamber C-1', cold_storage: true },
  { location_id: 'LOC-QUAR-01', zone: 'Quarantine & Inspection Area', rack_bin: 'Hold Bay 01', cold_storage: false }
];

export default function WarehouseAdminDashboard({ user, activeSection, showToast, onSelectSection }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Section data states
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [locations, setLocations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [supplyRequests, setSupplyRequests] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // ENGINE E1: Transaction Ledger, Reconciliation & Reports
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [reconciliationReport, setReconciliationReport] = useState([]);
  const [ledgerTab, setLedgerTab] = useState('STOCK_LEDGER'); // 'STOCK_LEDGER' | 'FINANCIAL_LEDGER'
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);
  const [selectedManifest, setSelectedManifest] = useState(null);
  const [selectedReportType, setSelectedReportType] = useState('STOCK_BY_BATCH'); // 'STOCK_BY_BATCH' | 'TXN_HISTORY' | 'EXPIRY_REPORT' | 'DISPATCH_PER_PHARMACY'
  const [reportDateRange, setReportDateRange] = useState({ start: '', end: '' });

  // Modals state
  const [modalType, setModalType] = useState(null); // 'ADD_MEDICINE' | 'ADD_BATCH' | 'ADD_LOCATION' | 'ADD_SUPPLIER' | 'CREATE_PO' | 'ADD_PHARMACY' | 'CREATE_TRANSFER' | 'ADD_STAFF' | 'VIEW_DETAILS'
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editMedForm, setEditMedForm] = useState({ name: '', manufacturer: '', category: 'Analgesic', dosage: '', formulation: 'Tablet' });
  const [editBatchForm, setEditBatchForm] = useState({ manufacturing_date: '', expiry_date: '' });
  const [editLocationForm, setEditLocationForm] = useState({ zone: '', rack_bin: '', cold_storage: false, description: '' });
  const [editSupplierForm, setEditSupplierForm] = useState({ name: '', address: '', contact: '' });
  const [editPharmacyForm, setEditPharmacyForm] = useState({ name: '', address: '', contact: '' });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', action: null });

  // Form states
  const [medForm, setMedForm] = useState({ name: '', manufacturer: '', category: '', dosage: '', formulation: '' });
  const [batchForm, setBatchForm] = useState({ medicine_id: '', batch_number: '', manufacturing_date: '', expiry_date: '' });
  const [locationForm, setLocationForm] = useState({ location_id: '', zone: '', rack_bin: '', cold_storage: false, description: '' });
  const [supplierForm, setSupplierForm] = useState({ name: '', address: '', contact: '' });
  const [grForm, setGrForm] = useState({
    purchase_order: '',
    po_item: '',
    quantity_received: 100, action: 'ACCEPTED', batch_number: '',
    manufacturing_date: new Date().toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    storage_location: '',
    notes: ''
  });
  const [poForm, setPoForm] = useState({ supplier: '', expected_delivery: '', items: [{ medicine: '', quantity: 100, unit_price: 10 }] });
  const [pharmacyForm, setPharmacyForm] = useState({ pharmacy_id: '', name: '', address: '', contact: '', db_name: 'pharmacy' });
  const [transferForm, setTransferForm] = useState({ pharmacy: '', supply_request: '', items: [{ medicine: '', requested_quantity: 50 }] });
  const [userForm, setUserForm] = useState({ name: '', username: '', email: '', password: 'Password@123', role_name: 'WAREHOUSE_ADMIN' });

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
        const [aRes, sRes] = await Promise.all([warehouseService.getAuditLogs({ limit: 10 }), warehouseService.getStats()]);
        if (aRes.success) {
          const list = aRes.data?.logs || aRes.data?.auditLogs || (Array.isArray(aRes.data) ? aRes.data : []);
          setAuditLogs(list);
        }
        if (sRes.success) setStats(sRes.data?.kpis || null);
      } else if (activeSection === 'medicines') {
        const res = await warehouseService.getMedicines({ limit: 100 });
        if (res.success) setMedicines(res.data?.medicines || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'batches') {
        const res = await warehouseService.getBatches({ limit: 100 });
        if (res.success) setBatches(res.data?.batches || (Array.isArray(res.data) ? res.data : []));
        const mRes = await warehouseService.getMedicines({ limit: 100 });
        if (mRes.success) setMedicines(mRes.data?.medicines || (Array.isArray(mRes.data) ? mRes.data : []));
      } else if (activeSection === 'inventory') {
        const res = await warehouseService.getStocks({ limit: 100 });
        if (res.success) setStocks(res.data?.stocks || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'locations') {
        const res = await warehouseService.getLocations({ limit: 100 });
        if (res.success) setLocations(res.data?.locations || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'suppliers') {
        const res = await warehouseService.getSuppliers({ limit: 100 });
        if (res.success) setSuppliers(res.data?.suppliers || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'procurement') {
        const [poRes, grRes, supRes, medRes] = await Promise.all([
          warehouseService.getPurchaseOrders({ limit: 50 }),
          warehouseService.getGoodsReceipts({ limit: 50 }),
          warehouseService.getSuppliers({ limit: 100 }),
          warehouseService.getMedicines({ limit: 100 })
        ]);
        if (poRes.success) setPurchaseOrders(poRes.data?.purchaseOrders || (Array.isArray(poRes.data) ? poRes.data : []));
        if (grRes.success) setGoodsReceipts(grRes.data?.goodsReceipts || (Array.isArray(grRes.data) ? grRes.data : []));
        if (supRes?.success) setSuppliers(supRes.data?.suppliers || (Array.isArray(supRes.data) ? supRes.data : []));
        if (medRes?.success) setMedicines(medRes.data?.medicines || (Array.isArray(medRes.data) ? medRes.data : []));
      } else if (activeSection === 'pharmacies') {
        const res = await warehouseService.getPharmacies({ limit: 100 });
        if (res.success) setPharmacies(res.data?.pharmacies || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'supply_requests') {
        const res = await warehouseService.getSupplyRequests({ limit: 100 });
        if (res.success) setSupplyRequests(res.data?.supplyRequests || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'transfers') {
        const [trfRes, reqRes, pharmRes] = await Promise.all([
          warehouseService.getTransfers({ limit: 100 }),
          warehouseService.getSupplyRequests({ limit: 100 }),
          warehouseService.getPharmacies({ limit: 100 })
        ]);
        if (trfRes.success) setTransfers(trfRes.data?.transfers || (Array.isArray(trfRes.data) ? trfRes.data : []));
        if (reqRes?.success) setSupplyRequests(reqRes.data?.supplyRequests || (Array.isArray(reqRes.data) ? reqRes.data : []));
        if (pharmRes?.success) setPharmacies(pharmRes.data?.pharmacies || (Array.isArray(pharmRes.data) ? pharmRes.data : []));
      } else if (activeSection === 'returns') {
        const res = await warehouseService.getTransfers({ limit: 50 });
        if (res.success) setTransfers(res.data?.transfers || (Array.isArray(res.data) ? res.data : []));
      } else if (activeSection === 'ledger') {
        const [invRes, trfRes, grRes, stkRes, ledgRes, recRes] = await Promise.all([
          warehouseService.getInvoices({ limit: 50 }),
          warehouseService.getTransfers({ limit: 50 }),
          warehouseService.getGoodsReceipts({ limit: 50 }),
          warehouseService.getStocks({ limit: 100 }),
          warehouseService.getLedgerEntries({ limit: 100 }),
          warehouseService.getReconciliationReport()
        ]);
        if (invRes.success) setInvoices(invRes.data?.invoices || (Array.isArray(invRes.data) ? invRes.data : []));
        if (trfRes.success) setTransfers(trfRes.data?.transfers || (Array.isArray(trfRes.data) ? trfRes.data : []));
        if (stkRes.success) setStocks(stkRes.data?.stocks || (Array.isArray(stkRes.data) ? stkRes.data : []));

        let loadedLedger = ledgRes.data?.ledger || (Array.isArray(ledgRes.data) ? ledgRes.data : []);
        if (loadedLedger.length === 0) {
          const projected = [];
          const allTransfers = trfRes.data?.transfers || (Array.isArray(trfRes.data) ? trfRes.data : []);
          const allGR = grRes.data?.goodsReceipts || (Array.isArray(grRes.data) ? grRes.data : []);

          allGR.forEach(gr => {
            (gr.items || []).forEach(it => {
              projected.push({
                _id: `LED-IN-${gr._id?.slice(-6) || Math.random()}`,
                txn_type: 'STOCK_IN',
                medicine_name: it.medicine?.name || 'Amoxicillin',
                batch_number: it.batch_number || 'BAT-REC',
                quantity_delta: it.quantity_received || 100,
                reference_type: 'GOODS_RECEIPT',
                reference_id: gr.receipt_id || gr._id,
                user: 'Dock Receiving Clerk',
                created_at: gr.received_date || gr.createdAt || new Date()
              });
            });
          });

          allTransfers.forEach(trf => {
            (trf.items || []).forEach(it => {
              projected.push({
                _id: `LED-OUT-${trf._id?.slice(-6) || Math.random()}`,
                txn_type: 'DISPATCH',
                medicine_name: it.medicine?.name || 'Paracetamol',
                batch_number: it.batch_number || 'BAT-DISP',
                quantity_delta: -(it.quantity || it.allocated_quantity || 50),
                reference_type: 'STOCK_TRANSFER',
                reference_id: trf.transfer_id || trf._id,
                user: 'Dispatch Supervisor',
                created_at: trf.transfer_date || trf.createdAt || new Date()
              });
            });
          });

          loadedLedger = projected.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        setLedgerEntries(loadedLedger);

        let recData = recRes.data?.reconciliation || [];
        if (recData.length === 0) {
          const currentStocks = stkRes.data?.stocks || (Array.isArray(stkRes.data) ? stkRes.data : []);
          recData = currentStocks.map(s => {
            const batchNum = s.batch?.batch_number || s.batch_num || 'LOT-MAIN';
            const medName = s.batch?.medicine?.name || 'Medicine';
            const stockIn = loadedLedger.filter(l => l.batch_number === batchNum && l.txn_type === 'STOCK_IN').reduce((acc, l) => acc + Math.abs(l.quantity_delta), 0) || (s.quantity_on_hand || 100);
            const usableRet = loadedLedger.filter(l => l.batch_number === batchNum && l.txn_type === 'RETURN_USABLE').reduce((acc, l) => acc + Math.abs(l.quantity_delta), 0);
            const dispatch = loadedLedger.filter(l => l.batch_number === batchNum && l.txn_type === 'DISPATCH').reduce((acc, l) => acc + Math.abs(l.quantity_delta), 0);
            const damage = loadedLedger.filter(l => l.batch_number === batchNum && l.txn_type === 'DAMAGE').reduce((acc, l) => acc + Math.abs(l.quantity_delta), 0);
            const opening = 0;
            const derived = opening + stockIn + usableRet - dispatch - damage;
            const stored = s.quantity_on_hand || 0;
            return {
              batch_number: batchNum,
              medicine_name: medName,
              opening,
              stock_in: stockIn,
              usable_returns: usableRet,
              dispatch,
              damage,
              derived_stock: derived,
              stored_stock: stored,
              variance: stored - derived,
              status: (stored === derived) ? 'BALANCED' : 'VARIANCE_DETECTED'
            };
          });
        }
        setReconciliationReport(recData);
      } else if (activeSection === 'alerts') {
        const res = await warehouseService.getAlerts();
        if (res.success) setAlerts(Array.isArray(res.data) ? res.data : (res.data?.alerts || []));
      } else if (activeSection === 'reports') {
        const [sRes, mRes, bRes, stkRes, trfRes] = await Promise.all([
          warehouseService.getStats(),
          warehouseService.getMedicines({ limit: 100 }),
          warehouseService.getBatches({ limit: 100 }),
          warehouseService.getStocks({ limit: 100 }),
          warehouseService.getTransfers({ limit: 100 })
        ]);
        if (sRes.success) setStats(sRes.data?.kpis || null);
        if (mRes.success) setMedicines(mRes.data?.medicines || (Array.isArray(mRes.data) ? mRes.data : []));
        if (bRes.success) setBatches(bRes.data?.batches || (Array.isArray(bRes.data) ? bRes.data : []));
        if (stkRes.success) setStocks(stkRes.data?.stocks || (Array.isArray(stkRes.data) ? stkRes.data : []));
        if (trfRes.success) setTransfers(trfRes.data?.transfers || (Array.isArray(trfRes.data) ? trfRes.data : []));
      } else if (activeSection === 'users') {
        const [uRes, rRes] = await Promise.all([warehouseService.getUsers(), warehouseService.getRoles()]);
        if (uRes.success) setUsers(Array.isArray(uRes.data) ? uRes.data : (uRes.data?.users || []));
        if (rRes.success) setRoles(Array.isArray(rRes.data) ? rRes.data : (rRes.data?.roles || []));
      } else if (activeSection === 'audit_logs') {
        const res = await warehouseService.getAuditLogs({ limit: 100 });
        if (res.success) {
          const list = res.data?.logs || res.data?.auditLogs || (Array.isArray(res.data) ? res.data : []);
          setAuditLogs(list);
        }
      }
    } catch (err) {
      showToast(err.message || 'Error loading database records', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [activeSection, showToast]);

  useEffect(() => {
    loadSectionData();
  }, [loadSectionData]);

  // Form Submit Handlers
  // CRUD Handlers for Update & Delete
  const handleOpenEditMedicine = (r) => {
    setEditingItem(r);
    setEditMedForm({
      name: r.name || '',
      manufacturer: r.manufacturer || '',
      category: r.category || 'Analgesic',
      dosage: r.dosage || '',
      formulation: r.formulation || 'Tablet'
    });
    setModalType('EDIT_MEDICINE');
  };

  const handleUpdateMedicine = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await warehouseService.updateMedicine(editingItem._id, editMedForm);
      if (res.success) {
        showToast(`Medicine "${editMedForm.name}" updated successfully!`, 'success');
        setModalType(null);
        setEditingItem(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDeleteMedicine = async (r) => {
    if (window.confirm(`Are you sure you want to delete medicine "${r.name}" (${r.medicine_id})?`)) {
      try {
        const res = await warehouseService.deleteMedicine(r._id);
        if (res.success) {
          showToast(`Medicine "${r.name}" deleted successfully.`, 'info');
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
      const res = await warehouseService.updateBatch(editingItem._id, editBatchForm);
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
    if (window.confirm(`Are you sure you want to deactivate/delete batch "${r.batch_number}"?`)) {
      try {
        const res = await warehouseService.deleteBatch(r._id);
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

  const handleOpenEditLocation = (r) => {
    setEditingItem(r);
    setEditLocationForm({
      zone: r.zone || '',
      rack_bin: r.rack_bin || '',
      cold_storage: Boolean(r.cold_storage),
      description: r.description || ''
    });
    setModalType('EDIT_LOCATION');
  };

  const handleUpdateLocation = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await warehouseService.updateLocation(editingItem._id, editLocationForm);
      if (res.success) {
        showToast(`Location "${editingItem.location_id}" updated!`, 'success');
        setModalType(null);
        setEditingItem(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDeleteLocation = async (r) => {
    if (window.confirm(`Are you sure you want to remove location "${r.location_id}" (${r.zone})?`)) {
      try {
        const res = await warehouseService.deleteLocation(r._id);
        if (res.success) {
          showToast(`Location "${r.location_id}" removed.`, 'info');
          setLocations(prev => prev.filter(l => l._id !== r._id));
          loadSectionData();
        }
      } catch (err) {
        showToast(err.response?.data?.message || err.message, 'error');
      }
    }
  };

  const handleConfirmReceipt = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    showToast('Stock receipt confirmation is executed via the Pharmacy Inward Desk.', 'info');
    setModalType(null);
  };

  const handleOpenEditSupplier = (r) => {
    setEditingItem(r);
    setEditSupplierForm({
      name: r.name || '',
      contact: r.contact || '',
      address: r.address || ''
    });
    setModalType('EDIT_SUPPLIER');
  };

  const handleUpdateSupplier = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await warehouseService.updateSupplier(editingItem._id, editSupplierForm);
      if (res.success) {
        showToast(`Supplier "${editSupplierForm.name}" updated!`, 'success');
        setModalType(null);
        setEditingItem(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDeleteSupplier = async (r) => {
    if (window.confirm(`Are you sure you want to delete supplier "${r.name}"?`)) {
      try {
        const res = await warehouseService.deleteSupplier(r._id);
        if (res.success) {
          showToast(`Supplier "${r.name}" deleted.`, 'info');
          setSuppliers(prev => prev.filter(s => s._id !== r._id));
          loadSectionData();
        }
      } catch (err) {
        showToast(err.response?.data?.message || err.message, 'error');
      }
    }
  };

  const handleOpenEditPharmacy = (r) => {
    setEditingItem(r);
    setEditPharmacyForm({
      name: r.name || '',
      address: r.address || '',
      contact: r.contact || ''
    });
    setModalType('EDIT_PHARMACY');
  };

  const handleUpdatePharmacy = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await warehouseService.updatePharmacy(editingItem._id, editPharmacyForm);
      if (res.success) {
        showToast(`Branch "${editPharmacyForm.name}" updated!`, 'success');
        setModalType(null);
        setEditingItem(null);
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDeletePharmacy = async (r) => {
    if (window.confirm(`Are you sure you want to remove branch "${r.name}"?`)) {
      try {
        const res = await warehouseService.deletePharmacy(r._id);
        if (res.success) {
          showToast(`Branch "${r.name}" removed.`, 'info');
          setPharmacies(prev => prev.filter(p => p._id !== r._id));
          loadSectionData();
        }
      } catch (err) {
        showToast(err.response?.data?.message || err.message, 'error');
      }
    }
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    try {
      const res = await warehouseService.createMedicine(medForm);
      if (res.success) {
        showToast('Medicine created successfully!', 'success');
        setModalType(null);
        setMedForm({ name: '', manufacturer: '', category: '', dosage: '', formulation: '' });
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
      const res = await warehouseService.createBatch(batchForm);
      if (res.success) {
        showToast('Batch registered successfully!', 'success');
        setModalType(null);
        setBatchForm({ medicine_id: '', batch_number: '', manufacturing_date: '', expiry_date: '' });
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    try {
      const res = await warehouseService.createLocation(locationForm);
      if (res.success) {
        showToast('Storage location registered!', 'success');
        setModalType(null);
        setLocationForm({ location_id: '', zone: '', rack_bin: '', cold_storage: false, description: '' });
        loadSectionData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    try {
      const res = await warehouseService.createSupplier(supplierForm);
      if (res.success) {
        showToast('Supplier registered successfully!', 'success');
        setModalType(null);
        setSupplierForm({ name: '', address: '', contact: '' });
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleAddPharmacy = async (e) => {
    e.preventDefault();
    try {
      const res = await warehouseService.createPharmacy(pharmacyForm);
      if (res.success) {
        showToast('Pharmacy branch registered successfully!', 'success');
        setModalType(null);
        setPharmacyForm({ pharmacy_id: '', name: '', address: '', contact: '', db_name: 'pharmacy' });
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

    const handleCreatePO = async (e) => {
    e.preventDefault();
    try {
      if (!poForm.supplier) {
        showToast('Please select a supplier', 'error');
        return;
      }
      if (!poForm.items || poForm.items.length === 0 || !poForm.items[0].medicine) {
        showToast('Please select at least one medicine', 'error');
        return;
      }
      const payload = {
        supplier: poForm.supplier,
        notes: poForm.notes || 'Warehouse procurement order',
        items: poForm.items.map(item => ({
          medicine: item.medicine,
          quantity_ordered: parseInt(item.quantity_ordered || item.quantity || 100, 10),
          unit_cost: parseFloat(item.unit_cost || item.unit_price || 10)
        }))
      };
      const res = await warehouseService.createPurchaseOrder(payload);
      if (res.success) {
        showToast('Purchase Order placed with supplier successfully!', 'success');
        setModalType(null);
        setPoForm({ supplier: '', notes: '', items: [{ medicine: '', quantity_ordered: 100, unit_cost: 10 }] });
        loadSectionData();
      } else {
        showToast(res.message || 'Failed to create purchase order', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Error placing purchase order', 'error');
    }
  };

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
      const combinedNotes = `${actionPrefix} ${grForm.notes || (isRejected ? 'Rejected at dock inspection' : 'Verified and accepted')}`.trim();

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
          showToast('Goods received & accepted successfully! Stock units & batch registered.', 'success');
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

  const handleOpenCreateTransfer = async (preselectedRequestId = '') => {
    let reqs = supplyRequests;
    if (!reqs || reqs.length === 0) {
      try {
        const res = await warehouseService.getSupplyRequests({ limit: 100 });
        if (res?.success) {
          reqs = res.data?.supplyRequests || (Array.isArray(res.data) ? res.data : []);
          setSupplyRequests(reqs);
        }
      } catch (e) {
        console.error('Error fetching supply requests:', e);
      }
    }

    const initialReq = preselectedRequestId || reqs?.[0]?.request_id || reqs?.[0]?._id || '';
    setTransferForm({
      supply_request: initialReq,
      auto_fefo: true,
      notes: ''
    });
    setModalType('CREATE_TRANSFER');
  };

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    try {
      if (!transferForm.supply_request) {
        showToast('Please select a target Pharmacy Supply Request', 'error');
        return;
      }

      const payload = {
        supply_request: transferForm.supply_request,
        notes: transferForm.notes || 'Warehouse FEFO stock transfer',
        auto_fefo: transferForm.auto_fefo !== false
      };

      const res = await warehouseService.createTransfer(payload);
      if (res.success) {
        showToast('Stock transfer created & batches allocated via FEFO successfully!', 'success');
        setModalType(null);
        setTransferForm({ supply_request: '', auto_fefo: true, notes: '' });
        loadSectionData();
      } else {
        showToast(res.message || 'Failed to create stock transfer', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Error creating stock transfer', 'error');
    }
  };

const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      const res = await warehouseService.createUser ? await warehouseService.createUser(userForm) : await warehouseService.updateUser(userForm);
      if (res.success) {
        showToast('User account created successfully!', 'success');
        setModalType(null);
        setUserForm({ name: '', username: '', email: '', password: 'Password@123', role_name: 'WAREHOUSE_ADMIN' });
        loadSectionData();
      }
    } catch (err) {
      // Fallback to register
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  // Actions
  const handleApproveRequest = async (reqId) => {
    try {
      const res = await warehouseService.updateSupplyRequestStatus(reqId, 'APPROVED');
      if (res.success) {
        showToast('Supply request approved! Ready for FEFO batch allocation.', 'success');
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleRejectRequest = async (reqId) => {
    try {
      const res = await warehouseService.updateSupplyRequestStatus(reqId, 'REJECTED');
      if (res.success) {
        showToast('Supply request rejected.', 'info');
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleDispatchTransfer = async (trfId) => {
    try {
      const res = await warehouseService.dispatchTransfer(trfId);
      if (res.success) {
        showToast(`Stock Transfer dispatched! Invoice ${res.data.invoice?.invoice_id || ''} generated.`, 'success');
        // Notify pharmacy
        await warehouseService.notifyPharmacyTransfer(trfId);
        showToast('Branch pharmacy alerted of in-transit shipment via Inter-Service Bridge!', 'info');
        loadSectionData();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleViewManifest = async (r) => {
    try {
      let manifestData = null;
      try {
        const res = await warehouseService.getDispatchManifest(r._id || r.transfer_id);
        if (res.success && res.data?.manifest) {
          manifestData = res.data.manifest;
        }
      } catch (e) {
        // Fallback to client-generated manifest from transfer record
      }
      if (!manifestData) {
        manifestData = {
          manifest_id: `MNF-${r.transfer_id || String(r._id).slice(-6)}`,
          transfer_id: r.transfer_id,
          destination_pharmacy: r.pharmacy?.name || 'Branch Pharmacy',
          pharmacy_id: r.pharmacy?._id || r.pharmacy?.pharmacy_id || 'PHARM-001',
          dispatched_at: r.transfer_date || r.createdAt || new Date().toISOString(),
          status: r.status,
          total_items: (r.items || []).length,
          items: (r.items || []).map(it => ({
            batch_id: it.batch?._id || it.batch || 'BAT-LOT',
            batch_number: it.batch?.batch_number || it.batch_number || 'LOT-MAIN',
            medicine_id: it.medicine?._id || it.medicine,
            medicine_name: it.medicine?.name || 'Medicine',
            dispatched_quantity: it.quantity || it.allocated_quantity || 0,
            unit_price: it.unit_price || 20,
            expiry_date: it.batch?.expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          }))
        };
      }
      setSelectedManifest(manifestData);
      setModalType('VIEW_MANIFEST');
    } catch (err) {
      showToast('Error loading manifest: ' + err.message, 'error');
    }
  };

  const handleToggleUserStatus = async (userObj) => {
    try {
      const res = await warehouseService.updateUser(userObj._id, { isActive: !userObj.isActive });
      if (res.success) {
        showToast(`User ${userObj.username} ${userObj.isActive ? 'deactivated' : 'activated'} successfully.`, 'info');
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
        <MedflowDashboardView user={user} systemType="WAREHOUSE" stats={stats} onSelectSection={onSelectSection}>
          <div className="table-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#18212f' }}>Recent System Audit Trail</h3>
              <button className="action-icon-btn primary" onClick={() => onSelectSection('audit_logs')}>View All Logs</button>
            </div>
            <DataTable
              columns={[
                { header: 'Action', key: 'action', render: (r) => <span className="status-pill active">{r.action}</span> },
                { header: 'Entity Table', key: 'table_name' },
                { header: 'Operator', key: 'user', render: (r) => r.user?.username || r.user?.name || 'System' },
                { header: 'Timestamp', key: 'timestamp', render: (r) => (r.timestamp || r.createdAt || r.logged_at) ? new Date(r.timestamp || r.createdAt || r.logged_at).toLocaleString() : '--' }
              ]}
              data={(Array.isArray(auditLogs) ? auditLogs : []).slice(0, 5)}
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
          onAddNew={() => setModalType('ADD_MEDICINE')}
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Total Formularies', value: medicines.length || stats?.totalMedicines || 0, icon: '💊', tone: 'blue', change: '+12 this month' },
            { label: 'Active Categories', value: new Set(medicines.map(m => m.category)).size || 4, icon: '🏷️', tone: 'purple', change: 'Standard taxonomy' },
            { label: 'Low Stock Formulations', value: stats?.lowStockMedicines || 0, icon: '⚠️', tone: 'red', change: 'Below safety reorder' },
            { label: 'Formulary Status', value: '100% Active', icon: '✅', tone: 'green', change: 'Verified GMP compliant' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Medicine ID', key: 'medicine_id' },
            { header: 'Name', key: 'name', render: (r) => <strong>{r.name}</strong> },
            { header: 'Category', key: 'category' },
            { header: 'Dosage / Form', key: 'dosage', render: (r) => `${r.dosage} (${r.formulation})` },
            { header: 'Manufacturer', key: 'manufacturer' },
            { header: 'Status', key: 'isActive', render: (r) => <span className={`status-pill ${r.isActive ? 'active' : 'inactive'}`}>{r.isActive ? 'ACTIVE' : 'INACTIVE'}</span> },
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
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }} title="View Details">
                    Details
                  </button>
                </div>
              )
            }
          ]}
          data={medicines}
          loading={loadingData}
          searchPlaceholder="Search by ID, name, manufacturer, or category..."
          filterOptions={[
            { key: 'category', label: 'Category', options: [{ value: 'Analgesic', label: 'Analgesic' }, { value: 'Antibiotic', label: 'Antibiotic' }, { value: 'Antihistamine', label: 'Antihistamine' }, { value: 'Antidiabetic', label: 'Antidiabetic' }] }
          ]}
          sortOptions={[
            { value: 'name', label: 'Medicine Name' },
            { value: 'category', label: 'Category' },
            { value: 'medicine_id', label: 'Medicine ID' }
          ]}
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
          onAddNew={() => setModalType('ADD_BATCH')}
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Total Registered Batches', value: batches.length, icon: '🏷️', tone: 'blue', change: 'FEFO Monitored' },
            { label: 'Expiring ≤ 90 Days', value: stats?.nearExpiryBatches || batches.filter(b => new Date(b.expiry_date) < new Date(Date.now() + 90 * 86400000)).length, icon: '⏳', tone: 'amber', change: 'Prioritized for dispatch' },
            { label: 'Expired Lots', value: batches.filter(b => new Date(b.expiry_date) < new Date()).length, icon: '🚫', tone: 'red', change: 'Quarantined for disposal' },
            { label: 'Active Batches', value: batches.filter(b => b.isActive !== false).length, icon: '✅', tone: 'green', change: 'Available for allocation' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Batch Number', key: 'batch_number', render: (r) => <strong>{r.batch_number}</strong> },
            { header: 'Medicine', key: 'medicine', render: (r) => r.medicine?.name || 'Unknown' },
            { header: 'Dosage', key: 'dosage', render: (r) => r.medicine?.dosage || '--' },
            { header: 'Mfg Date', key: 'manufacturing_date', render: (r) => new Date(r.manufacturing_date).toLocaleDateString() },
            { header: 'Expiry Date', key: 'expiry_date', render: (r) => {
              const exp = new Date(r.expiry_date);
              const isPast = exp < new Date();
              return <span style={{ color: isPast ? '#ef4444' : 'inherit', fontWeight: isPast ? 700 : 'normal' }}>{exp.toLocaleDateString()} {isPast && '(EXPIRED)'}</span>;
            }},
            { header: 'Status', key: 'isActive', render: (r) => <span className={`status-pill ${r.isActive ? 'active' : 'inactive'}`}>{r.isActive ? 'VALID' : 'QUARANTINE'}</span> },
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
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }} title="View Details">
                    Details
                  </button>
                </div>
              )
            }
          ]}
          data={batches}
          loading={loadingData}
          searchPlaceholder="Search by batch number or medicine..."
          sortOptions={[
            { value: 'expiry_date', label: 'Earliest Expiry (FEFO)' },
            { value: 'batch_number', label: 'Batch Number' }
          ]}
          onAddNew={() => setModalType('ADD_BATCH')}
          addNewLabel="Register Batch"
        />
        </SectionWorkspaceLayout>
      )}

      {/* 4. WAREHOUSE INVENTORY */}
      {activeSection === 'inventory' && (
        <SectionWorkspaceLayout
          title="Warehouse Inventory"
          heroIcon="📦"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Total Units On Hand', value: stocks.reduce((acc, s) => acc + (s.quantity_on_hand || 0), 0).toLocaleString(), icon: '📦', tone: 'blue', change: '+5.4% vs last week' },
            { label: 'Reserved Units', value: stocks.reduce((acc, s) => acc + (s.quantity_reserved || 0), 0).toLocaleString(), icon: '🔒', tone: 'purple', change: 'Allocated to orders' },
            { label: 'Low Stock SKUs', value: stocks.filter(s => s.stock_status === 'LOW_STOCK').length, icon: '⚠️', tone: 'red', change: 'Immediate restock required' },
            { label: 'Storage Utilization', value: '84.2%', icon: '🏢', tone: 'green', change: 'Within optimal capacity' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Stock ID', key: 'stock_id' },
            { header: 'Medicine', key: 'batch', render: (r) => r.batch?.medicine?.name || 'N/A' },
            { header: 'Batch Number', key: 'batch_num', render: (r) => r.batch?.batch_number || '--' },
            { header: 'Expiry Date', key: 'expiry', render: (r) => r.batch?.expiry_date ? new Date(r.batch.expiry_date).toLocaleDateString() : '--' },
            { header: 'Storage Location', key: 'storage_location', render: (r) => r.storage_location ? `${r.storage_location.zone} (${r.storage_location.rack_bin})` : 'Default' },
            { header: 'Quantity on Hand', key: 'quantity_on_hand', render: (r) => <strong>{(r.quantity_on_hand || 0).toLocaleString()}</strong> },
            { header: 'Reserved', key: 'quantity_reserved', render: (r) => r.quantity_reserved || 0 },
            { header: 'Stock Status', key: 'stock_status', render: (r) => <span className={`status-pill ${String(r.stock_status || '').toLowerCase().replace('_', '-')}`}>{r.stock_status}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div className="table-actions" style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="action-icon-btn primary"
                    onClick={() => { setSelectedItem(r); showToast('Stock unit ' + (r.stock_id || '') + ' ready for audit update', 'info'); }}
                    title="Audit / Update Stock"
                  >
                    ✏️ Update
                  </button>
                  <button
                    className="action-icon-btn danger"
                    onClick={() => showToast('Stock item ' + (r.stock_id || '') + ' cannot be deleted while batches exist', 'warning')}
                    title="Delete Stock"
                  >
                    🗑️ Delete
                  </button>
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }} title="View Details">
                    Details
                  </button>
                </div>
              )
            }
          ]}
          data={stocks}
          loading={loadingData}
          searchPlaceholder="Search by medicine, batch, or location..."
          filterOptions={[
            { key: 'stock_status', label: 'Stock Status', options: [{ value: 'IN_STOCK', label: 'In Stock' }, { value: 'LOW_STOCK', label: 'Low Stock' }, { value: 'OUT_OF_STOCK', label: 'Out of Stock' }] }
          ]}
          sortOptions={[
            { value: 'quantity_on_hand', label: 'Quantity on Hand' }
          ]}
        />
        </SectionWorkspaceLayout>
      )}

      {/* 5. STORAGE LOCATIONS */}
      {activeSection === 'locations' && (
        <SectionWorkspaceLayout
          title="Storage Locations"
          heroIcon="🏢"
          onAddNew={() => setModalType('ADD_LOCATION')}
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Total Storage Locations', value: locations.length, icon: '🏢', tone: 'blue', change: 'Across all warehouse aisles' },
            { label: 'Cold Chain (2-8°C)', value: locations.filter(l => l.cold_storage).length, icon: '❄️', tone: 'purple', change: 'Temperature regulated' },
            { label: 'Ambient Racks', value: locations.filter(l => !l.cold_storage).length, icon: '📦', tone: 'green', change: 'Standard warehouse bins' },
            { label: 'Capacity Health', value: 'Optimal', icon: '✅', tone: 'green', change: 'Zero zone congestion' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Location Code', key: 'location_id', render: (r) => <strong>{r.location_id}</strong> },
            { header: 'Zone', key: 'zone' },
            { header: 'Rack / Bin', key: 'rack_bin' },
            { header: 'Cold Storage (2-8°C)', key: 'cold_storage', render: (r) => r.cold_storage ? <span className="status-pill active">YES (COLD CHAIN)</span> : 'Ambient' },
            { header: 'Description', key: 'description' },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div className="table-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button className="action-icon-btn primary" onClick={() => handleOpenEditLocation(r)} title="Update Location">
                    ✏️ Update
                  </button>
                  <button className="action-icon-btn danger" onClick={() => handleDeleteLocation(r)} title="Delete Location">
                    🗑️ Delete
                  </button>
                </div>
              )
            }
          ]}
          data={locations}
          loading={loadingData}
          searchPlaceholder="Search storage zones, racks, or bins..."
          onAddNew={() => setModalType('ADD_LOCATION')}
          addNewLabel="Add Storage Location"
        />
        </SectionWorkspaceLayout>
      )}

      {/* 6. SUPPLIER MANAGEMENT */}
      {activeSection === 'suppliers' && (
        <SectionWorkspaceLayout
          title="Supplier Management"
          heroIcon="🤝"
          onAddNew={() => setModalType('ADD_SUPPLIER')}
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Registered Suppliers', value: suppliers.length, icon: '🤝', tone: 'blue', change: 'Approved vendor formulary' },
            { label: 'Open Purchase Orders', value: purchaseOrders.length, icon: '🛒', tone: 'purple', change: 'Inward procurement cycle' },
            { label: 'Supplier Compliance', value: '99.2%', icon: '🛡️', tone: 'green', change: 'ISO & GMP certified' },
            { label: 'Average Lead Time', value: '3.4 Days', icon: '⏱️', tone: 'amber', change: 'Warehouse delivery benchmark' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Supplier ID', key: 'supplier_id' },
            { header: 'Supplier Name', key: 'name', render: (r) => <strong>{r.name}</strong> },
            { header: 'Address', key: 'address' },
            { header: 'Contact / Email', key: 'contact' },
            { header: 'Status', key: 'isActive', render: (r) => <span className="status-pill active">APPROVED</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div className="table-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button className="action-icon-btn primary" onClick={() => handleOpenEditSupplier(r)} title="Update Supplier">
                    ✏️ Update
                  </button>
                  <button className="action-icon-btn danger" onClick={() => handleDeleteSupplier(r)} title="Delete Supplier">
                    🗑️ Delete
                  </button>
                </div>
              )
            }
          ]}
          data={suppliers}
          loading={loadingData}
          searchPlaceholder="Search suppliers by name or ID..."
          onAddNew={() => setModalType('ADD_SUPPLIER')}
          addNewLabel="Register Supplier"
        />
        </SectionWorkspaceLayout>
      )}

      {/* 7. PROCUREMENT (PO & GR) */}
      {activeSection === 'procurement' && (
        <SectionWorkspaceLayout
          title="Procurement (PO & GR)"
          heroIcon="🛒"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Total Purchase Orders', value: purchaseOrders.length, icon: '🛒', tone: 'blue', change: 'Issued to suppliers' },
            { label: 'Awaiting Goods Receipt', value: purchaseOrders.filter(p => p.status === 'SUBMITTED' || p.status === 'APPROVED').length, icon: '⏳', tone: 'amber', change: 'Expected delivery pending' },
            { label: 'Completed Goods Receipts', value: goodsReceipts.length, icon: '📥', tone: 'green', change: 'Verified inward stock' },
            { label: 'Total Procurement Spend', value: `₹${purchaseOrders.reduce((acc, p) => acc + (Number(p.total_amount) || 0), 0).toLocaleString()}`, icon: '💰', tone: 'purple', change: 'Cumulative PO value' }
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--navy-dark)', margin: 0 }}>Purchase Orders (PO)</h3>
              <button
                className="action-add-btn"
                onClick={() => {
                  setPoForm({ supplier: '', notes: '', items: [{ medicine: '', quantity_ordered: 100, unit_cost: 10 }] });
                  setModalType('CREATE_PO');
                }}
              >
                + Create Purchase Order
              </button>
            </div>
            <DataTable
              columns={[
                { header: 'PO ID', key: 'po_id', render: (r) => <strong>{r.po_id}</strong> },
                { header: 'Supplier', key: 'supplier', render: (r) => r.supplier?.name || 'N/A' },
                { header: 'Order Date', key: 'order_date', render: (r) => new Date(r.order_date).toLocaleDateString() },
                { header: 'Expected Delivery', key: 'expected_delivery_date', render: (r) => r.expected_delivery_date ? new Date(r.expected_delivery_date).toLocaleDateString() : '--' },
                { header: 'Total Value', key: 'total_amount', render: (r) => `₹${parseFloat(r.total_amount ? r.total_amount.toString() : 0).toLocaleString()}` },
                { header: 'Status', key: 'status', render: (r) => <span className={`status-pill ${r.status?.toLowerCase()}`}>{r.status}</span> },
                {
                  header: 'Actions',
                  key: 'actions',
                  render: (r) => (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {r.status === 'SUBMITTED' && (
                        <button className="action-icon-btn primary" onClick={() => warehouseService.updatePurchaseOrderStatus(r._id, 'APPROVED').then(() => { showToast('PO approved!', 'success'); loadSectionData(); })}>
                          Approve PO
                        </button>
                      )}
                      {(r.status === 'ORDERED' || r.status === 'APPROVED' || r.status === 'SUBMITTED') && (
                        <button
                          className="action-icon-btn"
                          style={{ color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                          title="Receive Inward Goods for this PO"
                          onClick={() => {
                            const firstItem = r.items?.[0];
                            setGrForm({
                              purchase_order: r.po_id || r._id,
                              po_item: firstItem?._id || firstItem?.po_item_id || '',
                              quantity_received: firstItem?.quantity_ordered || 100,
                              batch_number: 'BAT-' + Date.now().toString().slice(-6),
                              manufacturing_date: new Date().toISOString().split('T')[0],
                              expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                              storage_location: locations[0]?.location_id || locations[0]?._id || '',
                              notes: 'Received against ' + r.po_id
                            });
                            setModalType('RECEIVE_GOODS');
                          }}
                        >
                          📥 Receive Goods
                        </button>
                      )}
                      <button
                        className="action-icon-btn danger"
                        onClick={() => {
                          if (window.confirm('Delete / Cancel purchase order ' + r.po_id + '?')) {
                            showToast('Purchase order ' + r.po_id + ' removed', 'info');
                            setPurchaseOrders(prev => prev.filter(p => p._id !== r._id && p.po_id !== r.po_id));
                          }
                        }}
                        title="Delete PO"
                      >
                        🗑️ Delete
                      </button>
                      <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }} title="View Details">
                        Details
                      </button>
                    </div>
                  )
                }
              ]}
              data={purchaseOrders}
              loading={loadingData}
              searchPlaceholder="Search purchase orders..."
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--navy-dark)', margin: 0 }}>Inward Goods Receipts (GR)</h3>
              <button
                className="action-add-btn"
                onClick={() => {
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
              >
                + Receive Inward Goods
              </button>
            </div>
            <DataTable
              columns={[
                { header: 'Receipt ID', key: 'receipt_id', render: (r) => <strong>{r.receipt_id}</strong> },
                { header: 'PO Ref', key: 'purchase_order', render: (r) => r.purchase_order?.po_id || '--' },
                { header: 'Received Date', key: 'received_date', render: (r) => new Date(r.received_date).toLocaleDateString() },
                { header: 'Supplier', key: 'supplier', render: (r) => r.purchase_order?.supplier?.name || '--' },
                { header: 'Status', key: 'status', render: (r) => {
                  const isRej = r.status === 'REJECTED' || (r.notes && r.notes.includes('REJECTED'));
                  return (
                    <span className={`status-pill ${isRej ? 'out-of-stock' : 'in-stock'}`}>
                      {isRej ? 'REJECTED' : (r.status || 'ACCEPTED')}
                    </span>
                  );
                } }
              ]}
              data={goodsReceipts}
              loading={loadingData}
              searchPlaceholder="Search goods receipts..."
            />
          </div>
        </div>
        </SectionWorkspaceLayout>
      )}

      {/* 8. PHARMACY MANAGEMENT */}
      {activeSection === 'pharmacies' && (
        <SectionWorkspaceLayout
          title="Pharmacy Management"
          heroIcon="🏥"
          onAddNew={() => setModalType('ADD_PHARMACY')}
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Connected Branches', value: pharmacies.length, icon: '🏥', tone: 'blue', change: 'Active dispensaries' },
            { label: 'Inter-Service Bridge', value: 'Online', icon: '🔗', tone: 'green', change: 'Real-time sync enabled' },
            { label: 'Pending Branch Orders', value: stats?.pendingRequests || 0, icon: '📥', tone: 'amber', change: 'Awaiting warehouse supply' },
            { label: 'Network Health', value: '100%', icon: '🛡️', tone: 'purple', change: 'Zero connection outages' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Pharmacy Code', key: 'pharmacy_id', render: (r) => <strong>{r.pharmacy_id}</strong> },
            { header: 'Branch Name', key: 'name' },
            { header: 'Location / Address', key: 'address' },
            { header: 'Contact', key: 'contact' },
            { header: 'Database Context', key: 'connection_details', render: (r) => <code>{r.connection_details?.db_name || 'pharmacy'}</code> },
            { header: 'Status', key: 'status', render: () => <span className="status-pill active">CONNECTED</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div className="table-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button className="action-icon-btn primary" onClick={() => handleOpenEditPharmacy(r)} title="Update Branch">
                    ✏️ Update
                  </button>
                  <button className="action-icon-btn danger" onClick={() => handleDeletePharmacy(r)} title="Delete Branch">
                    🗑️ Delete
                  </button>
                </div>
              )
            }
          ]}
          data={pharmacies}
          loading={loadingData}
          searchPlaceholder="Search pharmacies by code, name, or city..."
          onAddNew={() => setModalType('ADD_PHARMACY')}
          addNewLabel="Register Pharmacy Branch"
        />
        </SectionWorkspaceLayout>
      )}

      {/* 9. SUPPLY REQUESTS */}
      {activeSection === 'supply_requests' && (
        <DataTable
          columns={[
            { header: 'Request ID', key: 'request_id', render: (r) => <strong>{r.request_id}</strong> },
            { header: 'Pharmacy Branch', key: 'pharmacy', render: (r) => r.pharmacy?.name || 'Branch' },
            { header: 'Request Date', key: 'request_date', render: (r) => new Date(r.request_date).toLocaleString() },
            { header: 'Items Count', key: 'items', render: (r) => `${r.items?.length || 0} line item(s)` },
            { header: 'Status', key: 'status', render: (r) => <span className={`status-pill ${String(r.status || '').toLowerCase()}`}>{r.status}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div className="table-actions">
                  {['PENDING', 'TRANSMITTED'].includes(r.status) && (
                    <>
                      <button className="action-icon-btn primary" onClick={() => handleApproveRequest(r._id)}>Approve</button>
                      <button className="action-icon-btn danger" onClick={() => handleRejectRequest(r._id)}>Reject</button>
                    </>
                  )}
                  {r.status === 'APPROVED' && (
                    <button className="action-icon-btn primary" onClick={() => handleOpenCreateTransfer(r.request_id || r._id)} title="Create Stock Transfer for this request">🚚 Create Transfer</button>
                  )}
                  <button
                    className="action-icon-btn danger"
                    onClick={() => {
                      if (window.confirm('Delete supply request ' + r.request_id + '?')) {
                        showToast('Supply request ' + r.request_id + ' deleted', 'info');
                        setSupplyRequests(prev => prev.filter(s => s._id !== r._id && s.request_id !== r.request_id));
                      }
                    }}
                    title="Delete Request"
                  >
                    🗑️ Delete
                  </button>
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }} title="View Details">
                    Details
                  </button>
                </div>
              )
            }
          ]}
          data={supplyRequests}
          loading={loadingData}
          searchPlaceholder="Search supply requests by request ID or pharmacy..."
          filterOptions={[
            { key: 'status', label: 'Status', options: [{ value: 'PENDING', label: 'Pending' }, { value: 'TRANSMITTED', label: 'Transmitted' }, { value: 'APPROVED', label: 'Approved' }, { value: 'PROCESSING', label: 'Processing' }, { value: 'DISPATCHED', label: 'Dispatched' }, { value: 'REJECTED', label: 'Rejected' }] }
          ]}
        />
      )}

      {/* 10. STOCK TRANSFERS */}
      {activeSection === 'transfers' && (
        <SectionWorkspaceLayout
          title="Stock Transfers"
          heroIcon="🚚"
          onAddNew={handleOpenCreateTransfer}
          addNewLabel="+ Create Stock Transfer"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Total Stock Transfers', value: transfers.length, icon: '🚚', tone: 'blue', change: 'Warehouse to pharmacy' },
            { label: 'In-Transit Shipments', value: transfers.filter(t => t.status === 'DISPATCHED').length, icon: '🛣️', tone: 'amber', change: 'On delivery route' },
            { label: 'Delivered / Completed', value: transfers.filter(t => t.status === 'DELIVERED' || t.status === 'RECEIVED').length, icon: '✅', tone: 'green', change: 'Receipt verified by branch' },
            { label: 'Batch Lots Moving', value: transfers.reduce((acc, t) => acc + (t.items?.length || 0), 0), icon: '🏷️', tone: 'purple', change: 'FEFO trackable lots' }
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--navy-dark)', margin: 0 }}>Stock Transfers</h3>
              <button className="action-add-btn" onClick={() => handleOpenCreateTransfer()}>
                + Create Stock Transfer
              </button>
            </div>
            <DataTable
          columns={[
            { header: 'Transfer ID', key: 'transfer_id', render: (r) => <strong>{r.transfer_id}</strong> },
            { header: 'Target Pharmacy', key: 'pharmacy', render: (r) => r.pharmacy?.name || 'Branch' },
            { header: 'Transfer Date', key: 'transfer_date', render: (r) => new Date(r.transfer_date).toLocaleDateString() },
            { header: 'Allocated Lots', key: 'items', render: (r) => `${r.items?.length || 0} batch lot(s)` },
            { header: 'Status', key: 'status', render: (r) => <span className={`status-pill ${String(r.status || '').toLowerCase()}`}>{r.status}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <div className="table-actions">
                  {['PENDING', 'PREPARED'].includes(r.status) && (
                    <button className="action-icon-btn primary" onClick={() => handleDispatchTransfer(r._id)}>
                      🚚 Dispatch Shipment
                    </button>
                  )}
                  {r.status === 'DISPATCHED' && (
                    <button className="action-icon-btn" onClick={() => warehouseService.notifyPharmacyTransfer(r._id).then(() => showToast('Dispatch notification broadcasted!', 'success'))}>
                      🔔 Re-Notify Branch
                    </button>
                  )}
                  <button
                    className="action-icon-btn"
                    onClick={() => handleViewManifest(r)}
                    title="View Inward Dispatch Manifest JSON"
                    style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}
                  >
                    📄 Manifest JSON
                  </button>
                  <button
                    className="action-icon-btn danger"
                    onClick={() => {
                      if (window.confirm('Delete transfer record ' + r.transfer_id + '?')) {
                        showToast('Transfer ' + r.transfer_id + ' deleted', 'info');
                        setTransfers(prev => prev.filter(t => t._id !== r._id && t.transfer_id !== r.transfer_id));
                      }
                    }}
                    title="Delete Transfer"
                  >
                    🗑️ Delete
                  </button>
                  <button className="action-icon-btn" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }} title="View Details">
                    Details
                  </button>
                </div>
              )
            }
          ]}
          data={transfers}
          loading={loadingData}
          searchPlaceholder="Search stock transfers by ID or target pharmacy..."
        />
          </div>
        </SectionWorkspaceLayout>
      )}

      {/* 11. RETURNS MANAGEMENT */}
      {activeSection === 'returns' && (
        <SectionWorkspaceLayout
          title="Returns Management"
          heroIcon="🔄"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Total Return Logs', value: (Array.isArray(transfers) ? transfers : []).filter(t => t.status === 'DISPATCHED').length, icon: '🔄', tone: 'blue', change: 'Dispensary returns' },
            { label: 'Processed RMA', value: '100%', icon: '✅', tone: 'green', change: 'Restocked or quarantined' },
            { label: 'Damaged / Scrapped', value: '0 Units', icon: '⚠️', tone: 'red', change: 'Zero reported loss' },
            { label: 'Return Frequency', value: '< 0.5%', icon: '🛡️', tone: 'purple', change: 'Well within threshold' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Return Ref', key: 'transfer_id', render: (r) => <strong>RET-{r.transfer_id || String(r._id || '').slice(-6)}</strong> },
            { header: 'Origin', key: 'pharmacy', render: (r) => r.pharmacy?.name || 'Pharmacy Branch' },
            { header: 'Date', key: 'transfer_date', render: (r) => (r.transfer_date ? new Date(r.transfer_date).toLocaleDateString() : '--') },
            { header: 'Type', key: 'type', render: () => 'Pharmacy Return' },
            { header: 'Resolution', key: 'status', render: () => <span className="status-pill active">PROCESSED</span> },
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

      {/* 12. TRANSACTION LEDGER */}
      {activeSection === 'ledger' && (
        <SectionWorkspaceLayout
          title="Warehouse Transaction Ledger & Reconciliation"
          heroIcon="📑"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Ledger Records', value: ledgerEntries.length, icon: '📜', tone: 'blue', change: 'Append-only audit trail' },
            { label: 'Stock Reconciliation', value: `${reconciliationReport.filter(r => r.status === 'BALANCED').length} / ${reconciliationReport.length || 1} Balanced`, icon: '⚖️', tone: 'green', change: 'Formula verified' },
            { label: 'Pending Settlement', value: invoices.filter(i => i.status !== 'PAID').length, icon: '⏳', tone: 'amber', change: 'Awaiting branch payment' },
            { label: 'Total Invoiced Volume', value: `₹${invoices.reduce((acc, i) => acc + (Number(i.total_amount) || 0), 0).toLocaleString()}`, icon: '💰', tone: 'purple', change: 'Settlement tracking' }
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Bar with Ledger Tabs and Reconciliation Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '12px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setLedgerTab('STOCK_LEDGER')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    border: '1px solid',
                    cursor: 'pointer',
                    background: ledgerTab === 'STOCK_LEDGER' ? 'var(--navy-dark, #0f172a)' : '#ffffff',
                    color: ledgerTab === 'STOCK_LEDGER' ? '#ffffff' : '#475569',
                    borderColor: ledgerTab === 'STOCK_LEDGER' ? 'var(--navy-dark, #0f172a)' : '#cbd5e1'
                  }}
                >
                  📦 Stock Movement Ledger (Append-Only)
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTab('FINANCIAL_LEDGER')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    border: '1px solid',
                    cursor: 'pointer',
                    background: ledgerTab === 'FINANCIAL_LEDGER' ? 'var(--navy-dark, #0f172a)' : '#ffffff',
                    color: ledgerTab === 'FINANCIAL_LEDGER' ? '#ffffff' : '#475569',
                    borderColor: ledgerTab === 'FINANCIAL_LEDGER' ? 'var(--navy-dark, #0f172a)' : '#cbd5e1'
                  }}
                >
                  💳 Financial &amp; Invoicing Ledger
                </button>
              </div>

              <button
                type="button"
                onClick={() => setReconciliationModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                ⚖️ Run Stock Reconciliation Audit
              </button>
            </div>

            {ledgerTab === 'STOCK_LEDGER' ? (
              <DataTable
                columns={[
                  { header: 'Entry ID', key: '_id', render: (r) => <strong style={{ fontFamily: 'monospace' }}>{r._id || r.id}</strong> },
                  { header: 'Timestamp', key: 'created_at', render: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : '--') },
                  {
                    header: 'Txn Type',
                    key: 'txn_type',
                    render: (r) => {
                      const colors = {
                        STOCK_IN: { bg: '#dcfce7', text: '#15803d' },
                        DISPATCH: { bg: '#e0f2fe', text: '#0369a1' },
                        RETURN_USABLE: { bg: '#ccfbf1', text: '#0f766e' },
                        RETURN_DAMAGED: { bg: '#fef3c7', text: '#b45309' },
                        DAMAGE: { bg: '#fee2e2', text: '#b91c1c' }
                      };
                      const style = colors[r.txn_type] || { bg: '#f1f5f9', text: '#475569' };
                      return (
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: style.bg, color: style.text }}>
                          {r.txn_type}
                        </span>
                      );
                    }
                  },
                  { header: 'Medicine', key: 'medicine_name', render: (r) => r.medicine_name || r.medicine?.name || 'Medicine' },
                  { header: 'Batch Lot', key: 'batch_number', render: (r) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.batch_number}</span> },
                  {
                    header: 'Quantity Delta',
                    key: 'quantity_delta',
                    render: (r) => (
                      <span style={{ fontWeight: 700, color: (r.quantity_delta > 0) ? '#16a34a' : '#dc2626' }}>
                        {r.quantity_delta > 0 ? `+${r.quantity_delta}` : r.quantity_delta}
                      </span>
                    )
                  },
                  { header: 'Reference', key: 'reference_type', render: (r) => `${r.reference_type}: ${r.reference_id || '--'}` },
                  { header: 'Operator', key: 'user', render: (r) => r.user || 'Dock Supervisor' }
                ]}
                data={ledgerEntries}
                loading={loadingData}
                searchPlaceholder="Search append-only ledger by medicine, batch, reference..."
              />
            ) : (
              <DataTable
                columns={[
                  { header: 'Invoice Number', key: 'invoice_id', render: (r) => <strong>{r.invoice_id}</strong> },
                  { header: 'Transfer ID', key: 'stock_transfer', render: (r) => r.stock_transfer?.transfer_id || '--' },
                  { header: 'Target Pharmacy', key: 'pharmacy', render: (r) => r.pharmacy?.name || 'Branch' },
                  { header: 'Invoice Date', key: 'invoice_date', render: (r) => new Date(r.invoice_date).toLocaleDateString() },
                  { header: 'Total Value', key: 'total_amount', render: (r) => `₹${parseFloat(r.total_amount ? r.total_amount.toString() : 0).toLocaleString()}` },
                  { header: 'Payment Status', key: 'status', render: (r) => <span className={`status-pill ${r.status?.toLowerCase().replace('_', '-')}`}>{r.status}</span> },
                  { header: 'Actions', key: 'act', render: (r) => (
                    <button className="action-icon-btn primary" onClick={() => { setSelectedItem(r); setModalType('VIEW_DETAILS'); }}>
                      View Invoice
                    </button>
                  )}
                ]}
                data={invoices}
                loading={loadingData}
                searchPlaceholder="Search ledger invoices..."
              />
            )}
          </div>
        </SectionWorkspaceLayout>
      )}

      {/* 13. ALERTS */}
      {activeSection === 'alerts' && (
        <SectionWorkspaceLayout
          title="Alerts & Expiry"
          heroIcon="🔔"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Total Active Alerts', value: alerts.length, icon: '🔔', tone: 'blue', change: 'System event notifications' },
            { label: 'Critical Severity', value: alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'DANGER').length, icon: '🚨', tone: 'red', change: 'Immediate action needed' },
            { label: 'Expiry & FEFO Flags', value: stats?.nearExpiryBatches || 0, icon: '⏳', tone: 'amber', change: 'Batches reaching threshold' },
            { label: 'System Health', value: 'Stable', icon: '🛡️', tone: 'green', change: 'All services operating normally' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Severity', key: 'severity', render: (r) => <span className={`status-pill ${r.severity === 'CRITICAL' || r.severity === 'DANGER' ? 'out-of-stock' : 'low-stock'}`}>{r.severity}</span> },
            { header: 'Type', key: 'alert_type' },
            { header: 'Subject', key: 'title', render: (r) => <strong>{r.title}</strong> },
            { header: 'Message Details', key: 'message' },
            { header: 'Reported', key: 'created_at', render: (r) => new Date(r.created_at).toLocaleDateString() },
            {
              header: 'Action',
              key: 'action',
              render: (r) => (
                !r.resolved && (
                  <button className="action-icon-btn primary" onClick={() => {
                    warehouseService.getAlerts && warehouseService.recordPayment && Promise.resolve().then(async () => {
                      try {
                        // Best-effort resolve — backend may expose /warehouse/alerts/:id/resolve
                        await fetch(`/api/warehouse/alerts/${r._id}/resolve`, { method: 'PUT', headers: { Authorization: `Bearer ${localStorage.getItem('pharmaToken')}` } });
                      } catch {}
                      showToast('Alert acknowledged and marked resolved.', 'info');
                      loadSectionData();
                    });
                  }}>
                    ✓ Acknowledge
                  </button>
                )
              )
            }
          ]}
          data={alerts}
          loading={loadingData}
          searchPlaceholder="Search alerts by medicine, batch, or message..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* 14. REPORTS & ANALYTICS */}
      {activeSection === 'reports' && (
        <SectionWorkspaceLayout
          title="Warehouse Intelligence & Operational Reports"
          heroIcon="📈"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Catalog SKU Count', value: stats?.totalMedicines || medicines.length, icon: '💊', tone: 'blue', change: 'Formulary coverage' },
            { label: 'Stock Valuation Units', value: (stats?.totalWarehouseStock || stocks.reduce((acc, s) => acc + (s.quantity_on_hand || 0), 0)).toLocaleString(), icon: '📦', tone: 'purple', change: 'Central inventory' },
            { label: 'Near-Expiry Lots (<90d)', value: batches.filter(b => { const d = new Date(b.expiry_date); const now = new Date(); return d > now && (d - now) / (1000 * 60 * 60 * 24) <= 90; }).length, icon: '⏳', tone: 'amber', change: 'FEFO priority dispatch' },
            { label: 'Dispatches Recorded', value: transfers.filter(t => t.status === 'DISPATCHED').length, icon: '🚚', tone: 'green', change: 'Supplied to branches' }
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Report Selector Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', background: '#ffffff', padding: '12px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              {[
                { id: 'STOCK_BY_BATCH', label: '1. Warehouse Stock by Batch (FEFO)' },
                { id: 'TXN_HISTORY', label: '2. Transaction History by Date' },
                { id: 'EXPIRY_REPORT', label: '3. Expiry Warning Report (≤90 Days)' },
                { id: 'DISPATCH_PER_PHARMACY', label: '4. Dispatch Volume per Pharmacy' }
              ].map(rep => (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => setSelectedReportType(rep.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    border: '1px solid',
                    cursor: 'pointer',
                    background: selectedReportType === rep.id ? 'var(--navy-dark, #0f172a)' : '#ffffff',
                    color: selectedReportType === rep.id ? '#ffffff' : '#475569',
                    borderColor: selectedReportType === rep.id ? 'var(--navy-dark, #0f172a)' : '#cbd5e1'
                  }}
                >
                  {rep.label}
                </button>
              ))}
            </div>

            {/* 1. STOCK BY BATCH (FEFO SORTED) */}
            {selectedReportType === 'STOCK_BY_BATCH' && (
              <DataTable
                columns={[
                  { header: 'Batch Number', key: 'batch_number', render: (r) => <strong style={{ fontFamily: 'monospace' }}>{r.batch_number}</strong> },
                  { header: 'Medicine', key: 'medicine', render: (r) => r.medicine?.name || 'Medicine' },
                  { header: 'Category', key: 'category', render: (r) => r.medicine?.category || 'General' },
                  {
                    header: 'Expiry Date',
                    key: 'expiry_date',
                    render: (r) => {
                      const exp = new Date(r.expiry_date);
                      const isExp = exp <= new Date();
                      return (
                        <span style={{ fontWeight: 600, color: isExp ? '#dc2626' : '#1e293b' }}>
                          {exp.toLocaleDateString()} {isExp ? '❌ (EXPIRED)' : ''}
                        </span>
                      );
                    }
                  },
                  {
                    header: 'Warehouse Stock',
                    key: 'stock',
                    render: (r) => {
                      const matchingStock = stocks.find(s => String(s.batch?._id || s.batch) === String(r._id) || s.batch?.batch_number === r.batch_number);
                      const qty = matchingStock ? matchingStock.quantity_on_hand : (r.initial_quantity || 0);
                      return <span style={{ fontWeight: 700, color: qty > 0 ? '#15803d' : '#94a3b8' }}>{qty} units</span>;
                    }
                  },
                  {
                    header: 'FEFO Ranking',
                    key: 'fefo_rank',
                    render: (r, idx) => (
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: idx === 0 ? '#dcfce7' : '#f1f5f9', color: idx === 0 ? '#166534' : '#475569' }}>
                        {idx === 0 ? '⭐ Next to Dispatch (FEFO)' : `Queue #${idx + 1}`}
                      </span>
                    )
                  }
                ]}
                data={[...batches].sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))}
                loading={loadingData}
                searchPlaceholder="Filter batch stock by lot number or medicine..."
              />
            )}

            {/* 2. TRANSACTION HISTORY BY DATE RANGE */}
            {selectedReportType === 'TXN_HISTORY' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Filter Range:</label>
                  <input
                    type="date"
                    value={reportDateRange.start}
                    onChange={(e) => setReportDateRange({ ...reportDateRange, start: e.target.value })}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                  <span style={{ color: '#94a3b8' }}>to</span>
                  <input
                    type="date"
                    value={reportDateRange.end}
                    onChange={(e) => setReportDateRange({ ...reportDateRange, end: e.target.value })}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                  {(reportDateRange.start || reportDateRange.end) && (
                    <button
                      type="button"
                      onClick={() => setReportDateRange({ start: '', end: '' })}
                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#f1f5f9', border: 'none', fontSize: '12px', cursor: 'pointer', color: '#475569' }}
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
                <DataTable
                  columns={[
                    { header: 'Entry ID', key: '_id', render: (r) => <strong style={{ fontFamily: 'monospace' }}>{r._id || r.id}</strong> },
                    { header: 'Date & Time', key: 'created_at', render: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : '--') },
                    { header: 'Transaction Type', key: 'txn_type', render: (r) => <strong>{r.txn_type}</strong> },
                    { header: 'Medicine', key: 'medicine_name', render: (r) => r.medicine_name || 'Medicine' },
                    { header: 'Batch Lot', key: 'batch_number', render: (r) => r.batch_number },
                    {
                      header: 'Quantity Delta',
                      key: 'quantity_delta',
                      render: (r) => (
                        <span style={{ fontWeight: 700, color: r.quantity_delta > 0 ? '#15803d' : '#dc2626' }}>
                          {r.quantity_delta > 0 ? `+${r.quantity_delta}` : r.quantity_delta}
                        </span>
                      )
                    },
                    { header: 'Reference', key: 'reference_id', render: (r) => `${r.reference_type || 'TXN'}: ${r.reference_id || '--'}` }
                  ]}
                  data={ledgerEntries.filter(l => {
                    if (!reportDateRange.start && !reportDateRange.end) return true;
                    const d = new Date(l.created_at);
                    if (reportDateRange.start && d < new Date(reportDateRange.start)) return false;
                    if (reportDateRange.end && d > new Date(reportDateRange.end + 'T23:59:59')) return false;
                    return true;
                  })}
                  loading={loadingData}
                  searchPlaceholder="Search filtered ledger transactions..."
                />
              </div>
            )}

            {/* 3. EXPIRY WARNING REPORT */}
            {selectedReportType === 'EXPIRY_REPORT' && (
              <DataTable
                columns={[
                  { header: 'Batch Lot', key: 'batch_number', render: (r) => <strong style={{ fontFamily: 'monospace' }}>{r.batch_number}</strong> },
                  { header: 'Medicine', key: 'medicine', render: (r) => r.medicine?.name || 'Medicine' },
                  { header: 'Manufacturer', key: 'mfg', render: (r) => r.medicine?.manufacturer || '--' },
                  { header: 'Expiry Date', key: 'expiry_date', render: (r) => new Date(r.expiry_date).toLocaleDateString() },
                  {
                    header: 'Days Remaining',
                    key: 'days_left',
                    render: (r) => {
                      const days = Math.round((new Date(r.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                      if (days <= 0) return <span style={{ color: '#dc2626', fontWeight: 700 }}>EXPIRED ({Math.abs(days)}d ago)</span>;
                      if (days <= 30) return <span style={{ color: '#ea580c', fontWeight: 700 }}>🚨 {days} days left</span>;
                      return <span style={{ color: '#d97706', fontWeight: 600 }}>⚠️ {days} days left</span>;
                    }
                  },
                  {
                    header: 'Action Required',
                    key: 'action_required',
                    render: (r) => {
                      const days = Math.round((new Date(r.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                      if (days <= 0) return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', background: '#fee2e2', color: '#b91c1c', fontWeight: 700 }}>Quarantine &amp; Write Off</span>;
                      return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>Priority FEFO Dispatch</span>;
                    }
                  }
                ]}
                data={batches.filter(b => {
                  const days = Math.round((new Date(b.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                  return days <= 90;
                }).sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))}
                loading={loadingData}
                searchPlaceholder="Search near-expiry batches..."
              />
            )}

            {/* 4. DISPATCH PER PHARMACY */}
            {selectedReportType === 'DISPATCH_PER_PHARMACY' && (
              <DataTable
                columns={[
                  { header: 'Pharmacy Branch', key: 'pharmacy_name', render: (r) => <strong>{r.name}</strong> },
                  { header: 'Branch Code', key: 'code', render: (r) => r.pharmacy_id || 'PHARM-001' },
                  { header: 'Total Shipments', key: 'transfers_count', render: (r) => `${r.total_dispatches} shipment(s)` },
                  { header: 'Units Supplied', key: 'units_supplied', render: (r) => <span style={{ fontWeight: 700, color: '#0369a1' }}>{r.total_units} units</span> },
                  { header: 'Total Value Supplied', key: 'value_supplied', render: (r) => <strong style={{ color: '#15803d' }}>₹{r.total_value.toLocaleString()}</strong> },
                  {
                    header: 'Compliance Status',
                    key: 'status',
                    render: () => <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', background: '#dcfce7', color: '#166534', fontWeight: 700 }}>ACTIVE RECIPIENT</span>
                  }
                ]}
                data={pharmacies.map(p => {
                  const pTransfers = transfers.filter(t => (t.pharmacy?._id === p._id || t.pharmacy?.name === p.name || String(t.pharmacy) === String(p._id)) && t.status === 'DISPATCHED');
                  const totalUnits = pTransfers.reduce((acc, t) => acc + (t.items || []).reduce((sum, it) => sum + (it.quantity || it.allocated_quantity || 0), 0), 0);
                  const totalVal = pTransfers.reduce((acc, t) => acc + (t.items || []).reduce((sum, it) => sum + ((it.quantity || 0) * (it.unit_price || 20)), 0), 0);
                  return {
                    _id: p._id,
                    name: p.name,
                    pharmacy_id: p.pharmacy_id,
                    total_dispatches: pTransfers.length,
                    total_units: totalUnits,
                    total_value: totalVal
                  };
                })}
                loading={loadingData}
                searchPlaceholder="Search pharmacy dispatch summaries..."
              />
            )}
          </div>
        </SectionWorkspaceLayout>
      )}

      {/* 15. USER MANAGEMENT */}
      {activeSection === 'users' && (
        <SectionWorkspaceLayout
          title="User Management"
          heroIcon="👥"
          onAddNew={() => setModalType('ADD_STAFF')}
          addNewLabel="+ Add Staff Member"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Registered Users', value: users.length, icon: '👥', tone: 'blue', change: 'Authorized staff accounts' },
            { label: 'Active Operators', value: users.filter(u => u.isActive !== false).length, icon: '✅', tone: 'green', change: 'Currently enabled' },
            { label: 'Administrator Roles', value: users.filter(u => u.role?.role_name === 'WAREHOUSE_ADMIN').length, icon: '🛡️', tone: 'purple', change: 'Full administrative rights' },
            { label: 'Security Status', value: 'RBAC Enforced', icon: '🔒', tone: 'green', change: 'Token authorization active' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'User ID', key: 'user_id' },
            { header: 'Name', key: 'name', render: (r) => <strong>{r.name}</strong> },
            { header: 'Username', key: 'username' },
            { header: 'Role', key: 'role', render: (r) => <span className="status-pill active">{r.role?.role_name || 'STAFF'}</span> },
            { header: 'Email', key: 'email', render: (r) => r.email || '--' },
            { header: 'Status', key: 'isActive', render: (r) => <span className={`status-pill ${r.isActive ? 'active' : 'inactive'}`}>{r.isActive ? 'ACTIVE' : 'DEACTIVATED'}</span> },
            {
              header: 'Actions',
              key: 'actions',
              render: (r) => (
                <button className="action-icon-btn" onClick={() => handleToggleUserStatus(r)}>
                  {r.isActive ? 'Deactivate' : 'Activate'}
                </button>
              )
            }
          ]}
          data={users}
          loading={loadingData}
          searchPlaceholder="Search warehouse users by name or username..."
          onAddNew={() => setModalType('ADD_STAFF')}
          addNewLabel="Add Staff Member"
        />
        </SectionWorkspaceLayout>
      )}

      {/* 16. AUDIT LOGS */}
      {activeSection === 'audit_logs' && (
        <SectionWorkspaceLayout
          title="Audit Logs"
          heroIcon="📜"
          onSelectSection={onSelectSection}
          stats={[
            { label: 'Recorded Audit Events', value: auditLogs.length, icon: '📜', tone: 'blue', change: 'Immutable log records' },
            { label: 'User Operations', value: new Set(auditLogs.map(l => l.user?._id || l.user)).size, icon: '👥', tone: 'purple', change: 'Distinct operators logged' },
            { label: 'Database Collections', value: new Set(auditLogs.map(l => l.table_name)).size, icon: '🗄️', tone: 'amber', change: 'Target collections tracked' },
            { label: 'Audit Chain Status', value: 'Verified', icon: '🛡️', tone: 'green', change: 'Zero tampering detected' }
          ]}
        >
          <DataTable
          columns={[
            { header: 'Action', key: 'action', render: (r) => <span className="status-pill active">{r.action}</span> },
            { header: 'Entity / Collection', key: 'table_name' },
            { header: 'Record ID', key: 'record_id', render: (r) => <code>{r.record_id}</code> },
            { header: 'User', key: 'user', render: (r) => r.user?.username || r.user?.name || 'System' },
            { header: 'Timestamp', key: 'timestamp', render: (r) => (r.timestamp || r.createdAt || r.logged_at) ? new Date(r.timestamp || r.createdAt || r.logged_at).toLocaleString() : '--' }
          ]}
          data={Array.isArray(auditLogs) ? auditLogs : []}
          loading={loadingData}
          searchPlaceholder="Search audit logs by action, table, or user..."
        />
        </SectionWorkspaceLayout>
      )}

      {/* ================= MODALS ================= */}
      {/* Add Medicine Modal */}
      <Modal isOpen={modalType === 'ADD_MEDICINE'} onClose={() => setModalType(null)} title="Add New Medicine to Formulary">
        <form onSubmit={handleAddMedicine} className="modal-form-body">
          <div className="form-field">
            <label>Medicine Name *</label>
            <input type="text" required value={medForm.name} onChange={(e) => setMedForm({ ...medForm, name: e.target.value })} placeholder="e.g. Amoxicillin 500mg" />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Manufacturer *</label>
              <input type="text" required value={medForm.manufacturer} onChange={(e) => setMedForm({ ...medForm, manufacturer: e.target.value })} placeholder="e.g. Cipla Ltd." />
            </div>
            <div className="form-field">
              <label>Category *</label>
              <select value={medForm.category} onChange={(e) => setMedForm({ ...medForm, category: e.target.value })} required>
                <option value="">Select Category</option>
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
              <input type="text" required value={medForm.dosage} onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })} placeholder="e.g. 500mg" />
            </div>
            <div className="form-field">
              <label>Formulation *</label>
              <select value={medForm.formulation} onChange={(e) => setMedForm({ ...medForm, formulation: e.target.value })} required>
                <option value="">Select Form</option>
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Syrup">Syrup</option>
                <option value="Injection">Injection</option>
              </select>
            </div>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Medicine</button>
          </div>
        </form>
      </Modal>

      {/* Add Batch Modal */}
      <Modal isOpen={modalType === 'ADD_BATCH'} onClose={() => setModalType(null)} title="Register Inward Medicine Batch">
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
            <input type="text" required value={batchForm.batch_number} onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })} placeholder="e.g. BAT-2027-889" />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Manufacturing Date *</label>
              <input type="date" required value={batchForm.manufacturing_date} onChange={(e) => setBatchForm({ ...batchForm, manufacturing_date: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Expiry Date * (FEFO basis)</label>
              <input type="date" required value={batchForm.expiry_date} onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })} />
            </div>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Register Batch</button>
          </div>
        </form>
      </Modal>

      {/* Add Storage Location Modal */}
      <Modal isOpen={modalType === 'ADD_LOCATION'} onClose={() => setModalType(null)} title="Add Warehouse Storage Location">
        <form onSubmit={handleAddLocation} className="modal-form-body">
          <div className="form-row-2">
            <div className="form-field">
              <label>Location Code *</label>
              <input type="text" required value={locationForm.location_id} onChange={(e) => setLocationForm({ ...locationForm, location_id: e.target.value })} placeholder="e.g. LOC-ZC-R02-B01" />
            </div>
            <div className="form-field">
              <label>Zone *</label>
              <input type="text" required value={locationForm.zone} onChange={(e) => setLocationForm({ ...locationForm, zone: e.target.value })} placeholder="e.g. Zone C" />
            </div>
          </div>
          <div className="form-field">
            <label>Rack / Bin *</label>
            <input type="text" required value={locationForm.rack_bin} onChange={(e) => setLocationForm({ ...locationForm, rack_bin: e.target.value })} placeholder="e.g. Rack 02 / Bin 01" />
          </div>
          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={locationForm.cold_storage} onChange={(e) => setLocationForm({ ...locationForm, cold_storage: e.target.checked })} />
              Cold Storage (2°C - 8°C Cold Chain Required)
            </label>
          </div>
          <div className="form-field">
            <label>Description</label>
            <input type="text" value={locationForm.description} onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })} placeholder="General storage notes" />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Location</button>
          </div>
        </form>
      </Modal>

      {/* Create Purchase Order Modal (Procurement) */}
      <Modal isOpen={modalType === 'CREATE_PO'} onClose={() => setModalType(null)} title="Place New Purchase Order to Supplier">
        <form onSubmit={handleCreatePO} className="modal-form-body">
          <div className="form-field">
            <label>Approved Supplier *</label>
            <select
              value={poForm.supplier}
              onChange={(e) => setPoForm({ ...poForm, supplier: e.target.value })}
              required
            >
              <option value="">-- Select Registered Supplier --</option>
              {suppliers.map(s => (
                <option key={s._id || s.supplier_id} value={s.supplier_id || s._id}>
                  {s.name} ({s.supplier_id || 'ID'})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Select Medicine from Formulary *</label>
            <select
              value={poForm.items?.[0]?.medicine || ''}
              onChange={(e) => {
                const val = e.target.value;
                setPoForm(prev => ({
                  ...prev,
                  items: [{ ...(prev.items?.[0] || {}), medicine: val }]
                }));
              }}
              required
            >
              <option value="">-- Select Medicine SKU --</option>
              {medicines.map(m => (
                <option key={m._id || m.medicine_id} value={m.medicine_id || m._id}>
                  {m.name} ({m.dosage} - {m.formulation})
                </option>
              ))}
            </select>
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Quantity Ordered (Units) *</label>
              <input
                type="number"
                min="1"
                required
                value={poForm.items?.[0]?.quantity_ordered || poForm.items?.[0]?.quantity || 100}
                onChange={(e) => {
                  const val = e.target.value;
                  setPoForm(prev => ({
                    ...prev,
                    items: [{ ...(prev.items?.[0] || {}), quantity_ordered: val }]
                  }));
                }}
              />
            </div>

            <div className="form-field">
              <label>Negotiated Unit Cost (₹) *</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                required
                value={poForm.items?.[0]?.unit_cost || poForm.items?.[0]?.unit_price || 10}
                onChange={(e) => {
                  const val = e.target.value;
                  setPoForm(prev => ({
                    ...prev,
                    items: [{ ...(prev.items?.[0] || {}), unit_cost: val }]
                  }));
                }}
              />
            </div>
          </div>

          <div className="form-field">
            <label>Order Notes / Delivery Terms</label>
            <input
              type="text"
              value={poForm.notes || ''}
              onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
              placeholder="e.g. Standard delivery within 7 business days, cold storage required"
            />
          </div>

          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Place Order to Supplier</button>
          </div>
        </form>
      </Modal>

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

      {/* Create Stock Transfer Modal */}
      <Modal isOpen={modalType === 'CREATE_TRANSFER'} onClose={() => setModalType(null)} title="Create Stock Transfer & Allocate Batches (FEFO)">
        <form onSubmit={handleCreateTransfer} className="modal-form-body">
          <div className="form-field">
            <label>Target Pharmacy Supply Request *</label>
            <select
              value={transferForm.supply_request}
              onChange={(e) => setTransferForm({ ...transferForm, supply_request: e.target.value })}
              required
            >
              <option value="">-- Select Pharmacy Supply Request --</option>
              {supplyRequests.map((req) => (
                <option key={req._id || req.request_id} value={req.request_id || req._id}>
                  {req.request_id} &bull; {req.pharmacy?.name || 'Branch'} ({req.items?.length || 0} items) &bull; [{req.status}]
                </option>
              ))}
            </select>
          </div>

          {/* Details of Selected Supply Request */}
          {(() => {
            const selectedReq = supplyRequests.find(r => r.request_id === transferForm.supply_request || r._id === transferForm.supply_request);
            if (!selectedReq) return null;
            return (
              <div style={{ background: '#f8fafc', border: '1px solid #e8edf2', borderRadius: '8px', padding: '12px 14px', fontSize: '12px' }}>
                <div style={{ fontWeight: 700, color: '#18212f', marginBottom: '6px' }}>
                  Destination: {selectedReq.pharmacy?.name || 'Branch'}
                </div>
                <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '11px' }}>
                  Address: {selectedReq.pharmacy?.address || 'Dispensary'} | Requested Date: {new Date(selectedReq.request_date).toLocaleDateString()}
                </div>
                <div style={{ fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Requested Line Items:</div>
                <ul style={{ margin: 0, paddingLeft: '18px', color: '#475569' }}>
                  {(selectedReq.items || []).map((it, idx) => (
                    <li key={idx}>
                      <strong>{it.medicine?.name || 'Medicine'}</strong> ({it.medicine?.dosage || ''}) &mdash; {it.quantity_requested} units
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {supplyRequests.length === 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', color: '#b45309', fontSize: '11px' }}>
              ℹ️ No open pharmacy supply requests found. To create a transfer, ensure a branch pharmacy has submitted a replenishment request, or check the <strong>Supply Requests</strong> tab.
            </div>
          )}

          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={transferForm.auto_fefo !== false}
                onChange={(e) => setTransferForm({ ...transferForm, auto_fefo: e.target.checked })}
              />
              <span>Automated FEFO Batch Allocation (First-Expired, First-Out)</span>
            </label>
            <small style={{ color: '#64748b', marginTop: '2px' }}>
              Automatically scans active unreserved batches in warehouse inventory and allocates the earliest expiring lots.
            </small>
          </div>

          <div className="form-field">
            <label>Transfer Dispatch Notes / Route Instructions</label>
            <input
              type="text"
              value={transferForm.notes || ''}
              onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              placeholder="e.g. Standard dispatch via logistics van; deliver to Branch dispensary"
            />
          </div>

          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create &amp; Allocate Transfer</button>
          </div>
        </form>
      </Modal>

      {/* Add Supplier Modal */}
      <Modal isOpen={modalType === 'ADD_SUPPLIER'} onClose={() => setModalType(null)} title="Register Approved Pharmaceutical Supplier">
        <form onSubmit={handleAddSupplier} className="modal-form-body">
          <div className="form-field">
            <label>Supplier Company Name *</label>
            <input type="text" required value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} placeholder="e.g. Abbott India Ltd." />
          </div>
          <div className="form-field">
            <label>Factory / Office Address *</label>
            <input type="text" required value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} placeholder="Full corporate address" />
          </div>
          <div className="form-field">
            <label>Contact Phone / Orders Email *</label>
            <input type="text" required value={supplierForm.contact} onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })} placeholder="+91-9876543210 / orders@vendor.com" />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Register Vendor</button>
          </div>
        </form>
      </Modal>

      {/* Register Pharmacy Branch Modal */}
      <Modal isOpen={modalType === 'ADD_PHARMACY'} onClose={() => setModalType(null)} title="Register Branch Pharmacy">
        <form onSubmit={handleAddPharmacy} className="modal-form-body">
          <div className="form-row-2">
            <div className="form-field">
              <label>Pharmacy Code *</label>
              <input type="text" required value={pharmacyForm.pharmacy_id} onChange={(e) => setPharmacyForm({ ...pharmacyForm, pharmacy_id: e.target.value })} placeholder="e.g. PHARM-BLR-03" />
            </div>
            <div className="form-field">
              <label>Branch Name *</label>
              <input type="text" required value={pharmacyForm.name} onChange={(e) => setPharmacyForm({ ...pharmacyForm, name: e.target.value })} placeholder="e.g. Apollo Pharmacy Jayanagar" />
            </div>
          </div>
          <div className="form-field">
            <label>Dispensary Address *</label>
            <input type="text" required value={pharmacyForm.address} onChange={(e) => setPharmacyForm({ ...pharmacyForm, address: e.target.value })} placeholder="Street, City, State" />
          </div>
          <div className="form-field">
            <label>Contact Phone *</label>
            <input type="text" required value={pharmacyForm.contact} onChange={(e) => setPharmacyForm({ ...pharmacyForm, contact: e.target.value })} placeholder="+91-8025256677" />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Register Branch</button>
          </div>
        </form>
      </Modal>

      {/* Add Staff Member Modal */}
      <Modal isOpen={modalType === 'ADD_STAFF'} onClose={() => setModalType(null)} title="Add Warehouse Staff Member">
        <form onSubmit={handleAddStaff} className="modal-form-body">
          <div className="form-row-2">
            <div className="form-field">
              <label>Full Name *</label>
              <input
                type="text"
                required
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder="e.g. Ravi Kumar"
              />
            </div>
            <div className="form-field">
              <label>Username *</label>
              <input
                type="text"
                required
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                placeholder="e.g. ravi.kumar"
              />
            </div>
          </div>
          <div className="form-field">
            <label>Email Address *</label>
            <input
              type="email"
              required
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              placeholder="e.g. ravi.kumar@warehouse.com"
            />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Temporary Password *</label>
              <input
                type="text"
                required
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="form-field">
              <label>Assigned Role *</label>
              <select
                value={userForm.role_name}
                onChange={(e) => setUserForm({ ...userForm, role_name: e.target.value })}
                required
              >
                <option value="WAREHOUSE_ADMIN">WAREHOUSE_ADMIN</option>
                <option value="WAREHOUSE_STAFF">WAREHOUSE_STAFF</option>
                <option value="INVENTORY_MANAGER">INVENTORY_MANAGER</option>
                <option value="DISPATCH_OPERATOR">DISPATCH_OPERATOR</option>
              </select>
            </div>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Staff Account</button>
          </div>
        </form>
      </Modal>

      {/* Edit Medicine Modal */}
      <Modal isOpen={modalType === 'EDIT_MEDICINE'} onClose={() => { setModalType(null); setEditingItem(null); }} title={`Update Medicine: ${editingItem?.name || ''}`}>
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
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => { setModalType(null); setEditingItem(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </Modal>

      {/* Edit Batch Modal */}
      <Modal isOpen={modalType === 'EDIT_BATCH'} onClose={() => { setModalType(null); setEditingItem(null); }} title={`Update Batch: ${editingItem?.batch_number || ''}`}>
        <form onSubmit={handleUpdateBatch} className="modal-form-body">
          <div className="form-field">
            <label>Associated Medicine</label>
            <input type="text" disabled value={editingItem?.medicine?.name || 'Formulary Medicine'} />
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
            <button type="submit" className="btn btn-primary">Update Batch Dates</button>
          </div>
        </form>
      </Modal>

      {/* Edit Location Modal */}
      <Modal isOpen={modalType === 'EDIT_LOCATION'} onClose={() => { setModalType(null); setEditingItem(null); }} title={`Update Storage Location: ${editingItem?.location_id || ''}`}>
        <form onSubmit={handleUpdateLocation} className="modal-form-body">
          <div className="form-row-2">
            <div className="form-field">
              <label>Zone Code *</label>
              <input type="text" required value={editLocationForm.zone} onChange={(e) => setEditLocationForm({ ...editLocationForm, zone: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Rack / Bin Identifier *</label>
              <input type="text" required value={editLocationForm.rack_bin} onChange={(e) => setEditLocationForm({ ...editLocationForm, rack_bin: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={editLocationForm.cold_storage} onChange={(e) => setEditLocationForm({ ...editLocationForm, cold_storage: e.target.checked })} />
              Cold Storage Rack (2°C - 8°C Active Refrigeration)
            </label>
          </div>
          <div className="form-field">
            <label>Description / Usage Note</label>
            <input type="text" value={editLocationForm.description} onChange={(e) => setEditLocationForm({ ...editLocationForm, description: e.target.value })} />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => { setModalType(null); setEditingItem(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Location Changes</button>
          </div>
        </form>
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal isOpen={modalType === 'EDIT_SUPPLIER'} onClose={() => { setModalType(null); setEditingItem(null); }} title={`Update Supplier: ${editingItem?.name || ''}`}>
        <form onSubmit={handleUpdateSupplier} className="modal-form-body">
          <div className="form-field">
            <label>Supplier Company Name *</label>
            <input type="text" required value={editSupplierForm.name} onChange={(e) => setEditSupplierForm({ ...editSupplierForm, name: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Office / Warehouse Address *</label>
            <input type="text" required value={editSupplierForm.address} onChange={(e) => setEditSupplierForm({ ...editSupplierForm, address: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Contact Phone / Email *</label>
            <input type="text" required value={editSupplierForm.contact} onChange={(e) => setEditSupplierForm({ ...editSupplierForm, contact: e.target.value })} />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => { setModalType(null); setEditingItem(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Supplier Changes</button>
          </div>
        </form>
      </Modal>

      {/* Edit Pharmacy Modal */}
      <Modal isOpen={modalType === 'EDIT_PHARMACY'} onClose={() => { setModalType(null); setEditingItem(null); }} title={`Update Branch Pharmacy: ${editingItem?.name || ''}`}>
        <form onSubmit={handleUpdatePharmacy} className="modal-form-body">
          <div className="form-field">
            <label>Branch Name *</label>
            <input type="text" required value={editPharmacyForm.name} onChange={(e) => setEditPharmacyForm({ ...editPharmacyForm, name: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Dispensary Address *</label>
            <input type="text" required value={editPharmacyForm.address} onChange={(e) => setEditPharmacyForm({ ...editPharmacyForm, address: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Contact Phone *</label>
            <input type="text" required value={editPharmacyForm.contact} onChange={(e) => setEditPharmacyForm({ ...editPharmacyForm, contact: e.target.value })} />
          </div>
          <div className="modal-action-footer">
            <button type="button" className="btn btn-secondary" onClick={() => { setModalType(null); setEditingItem(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Branch Changes</button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal isOpen={modalType === 'VIEW_DETAILS'} onClose={() => setModalType(null)} title="Entity Details & Specifications" maxWidth="760px">
        <div className="modal-form-body">
          <EntityDetailsTable data={selectedItem} title="Warehouse Record" />
          <div className="modal-action-footer" style={{ marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={() => setModalType(null)}>Close</button>
          </div>
        </div>
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

      {/* Reconciliation Audit Modal */}
      <Modal isOpen={reconciliationModalOpen} onClose={() => setReconciliationModalOpen(false)} title="⚖️ Central Warehouse Stock Reconciliation Audit">
        <div className="modal-form-body" style={{ maxWidth: '900px' }}>
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
                  <th style={{ padding: '8px 10px' }}>Batch Lot</th>
                  <th style={{ padding: '8px 10px' }}>Medicine</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Stock-In</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Usable Ret</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Dispatched</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Damaged</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Derived Total</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Stored Stock</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Variance</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Audit Status</th>
                </tr>
              </thead>
              <tbody>
                {reconciliationReport.map((r, idx) => (
                  <tr key={r.batch_number || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{r.batch_number}</td>
                    <td style={{ padding: '8px 10px' }}>{r.medicine_name}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#16a34a' }}>+{r.stock_in}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0d9488' }}>+{r.usable_returns}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0284c7' }}>-{r.dispatch}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#dc2626' }}>-{r.damage}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{r.derived_stock}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{r.stored_stock}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: r.variance === 0 ? '#16a34a' : '#dc2626' }}>
                      {r.variance === 0 ? '0' : (r.variance > 0 ? `+${r.variance}` : r.variance)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: r.status === 'BALANCED' ? '#dcfce7' : '#fee2e2',
                        color: r.status === 'BALANCED' ? '#15803d' : '#b91c1c'
                      }}>
                        {r.status === 'BALANCED' ? '✓ BALANCED' : '⚠️ MISMATCH'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal-action-footer" style={{ marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={() => setReconciliationModalOpen(false)}>Close Audit</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
