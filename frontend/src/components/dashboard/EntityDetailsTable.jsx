import React, { useState } from 'react';

/**
 * Human-readable label dictionary
 */
const LABEL_MAP = {
  _id: 'System Record ID',
  id: 'Reference ID',
  sku: 'Item SKU',
  po_id: 'Purchase Order ID',
  transfer_id: 'Stock Transfer ID',
  sale_id: 'Sale Receipt ID',
  receipt_id: 'Goods Receipt ID',
  request_id: 'Supply Request ID',
  invoice_id: 'Invoice Number',
  batch_id: 'Batch ID',
  batch_number: 'Batch / Lot Number',
  pharmacy_id: 'Pharmacy Branch ID',
  supplier_id: 'Supplier Account ID',
  location_id: 'Storage Location ID',
  customer_id: 'Customer ID',
  quantity_on_hand: 'Available Stock',
  quantity_received: 'Quantity Received',
  quantity_requested: 'Quantity Requested',
  quantity_fulfilled: 'Quantity Fulfilled',
  quantity_delta: 'Adjustment Delta',
  unit_price: 'Unit Price',
  total_amount: 'Total Amount',
  tax_amount: 'Tax Amount',
  discount_amount: 'Discount Amount',
  reorder_level: 'Reorder Threshold',
  created_at: 'Recorded Date',
  createdAt: 'Created Timestamp',
  updated_at: 'Last Updated Date',
  updatedAt: 'Updated Timestamp',
  manufacturing_date: 'Manufacturing Date',
  expiry_date: 'Expiry Date',
  transfer_date: 'Transfer Date',
  invoice_date: 'Invoice Date',
  received_date: 'Received Date',
  payment_method: 'Payment Mode',
  payment_status: 'Payment Status',
  is_active: 'Active Status',
  isActive: 'Active Status',
  cold_storage: 'Cold Storage Required',
  notes: 'Remarks / Notes',
  reason: 'Reason / Description',
  address: 'Physical Address',
  contact: 'Contact Info',
  name: 'Name / Designation',
  description: 'Description',
  status: 'Operational Status',
  stock_status: 'Stock Level Status',
  category: 'Pharmaceutical Category',
  dosage_form: 'Dosage Form',
  formulation: 'Formulation',
  strength: 'Strength / Potency'
};

function formatLabel(key) {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function isDateString(val) {
  if (typeof val !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(val);
}

function renderValue(val, key = '') {
  if (val === null || val === undefined || val === '') {
    return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>;
  }

  if (typeof val === 'boolean') {
    return (
      <span
        style={{
          padding: '3px 10px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 700,
          background: val ? '#dcfce7' : '#f1f5f9',
          color: val ? '#15803d' : '#64748b'
        }}
      >
        {val ? '✓ Active / Yes' : '✗ Inactive / No'}
      </span>
    );
  }

  if (typeof val === 'number') {
    const lKey = key.toLowerCase();
    if (lKey.includes('price') || lKey.includes('amount') || lKey.includes('cost') || lKey.includes('total')) {
      return <strong style={{ color: '#0f172a' }}>₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>;
    }
    if (lKey.includes('quantity') || lKey.includes('stock') || lKey.includes('units') || lKey.includes('delta')) {
      return (
        <span style={{ fontWeight: 600, color: val < 0 ? '#dc2626' : '#0284c7' }}>
          {val > 0 && lKey.includes('delta') ? `+${val}` : val} units
        </span>
      );
    }
    return <span>{val.toLocaleString('en-IN')}</span>;
  }

  if (isDateString(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const isPast = d < new Date();
      const isNear = (d - new Date()) / (1000 * 60 * 60 * 24) < 90 && !isPast;
      return (
        <span style={{ fontWeight: 500, color: key.toLowerCase().includes('expiry') && isPast ? '#dc2626' : (isNear ? '#d97706' : '#334155') }}>
          {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          {val.includes('T') && ` (${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})`}
          {key.toLowerCase().includes('expiry') && isPast && ' [EXPIRED]'}
        </span>
      );
    }
  }

  if (typeof val === 'string') {
    const uVal = val.toUpperCase();
    const statusPills = {
      COMPLETED: { bg: '#dcfce7', color: '#15803d' },
      RECEIVED: { bg: '#dcfce7', color: '#15803d' },
      ACCEPTED: { bg: '#dcfce7', color: '#15803d' },
      AVAILABLE: { bg: '#dcfce7', color: '#15803d' },
      PAID: { bg: '#dcfce7', color: '#15803d' },
      ACTIVE: { bg: '#dcfce7', color: '#15803d' },
      CONFIRMED: { bg: '#dcfce7', color: '#15803d' },
      DISPATCHED: { bg: '#e0f2fe', color: '#0369a1' },
      IN_TRANSIT: { bg: '#e0f2fe', color: '#0369a1' },
      PROCESSING: { bg: '#e0f2fe', color: '#0369a1' },
      APPROVED: { bg: '#e0f2fe', color: '#0369a1' },
      PENDING: { bg: '#fef3c7', color: '#b45309' },
      LOW_STOCK: { bg: '#fef3c7', color: '#b45309' },
      PARTIALLY_FULFILLED: { bg: '#fef3c7', color: '#b45309' },
      RESERVED: { bg: '#fef3c7', color: '#b45309' },
      REJECTED: { bg: '#fee2e2', color: '#b91c1c' },
      CANCELLED: { bg: '#fee2e2', color: '#b91c1c' },
      EXPIRED: { bg: '#fee2e2', color: '#b91c1c' },
      OUT_OF_STOCK: { bg: '#fee2e2', color: '#b91c1c' },
      DAMAGED: { bg: '#fee2e2', color: '#b91c1c' },
      UNPAID: { bg: '#fee2e2', color: '#b91c1c' }
    };

    if (statusPills[uVal]) {
      return (
        <span
          style={{
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 700,
            background: statusPills[uVal].bg,
            color: statusPills[uVal].color,
            display: 'inline-block',
            letterSpacing: '0.02em'
          }}
        >
          {val}
        </span>
      );
    }

    if (/^[0-9a-fA-F]{24}$/.test(val)) {
      return <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#475569' }}>{val}</code>;
    }

    return <span>{val}</span>;
  }

  return <span>{String(val)}</span>;
}

export default function EntityDetailsTable({ data, title = 'Record Information' }) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!data || typeof data !== 'object') {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
        No detailed record information available.
      </div>
    );
  }

  const technicalKeys = ['__v', 'password', 'salt', 'hash', 'password_hash'];
  const allKeys = Object.keys(data).filter(k => !technicalKeys.includes(k));

  // Find array keys that represent line items or batches
  const arrayKeys = allKeys.filter(k => Array.isArray(data[k]) && data[k].length > 0 && typeof data[k][0] === 'object');

  // Find nested objects (e.g. pharmacy, supplier, medicine, supply_request)
  const nestedObjectKeys = allKeys.filter(k => {
    return !arrayKeys.includes(k) && data[k] && typeof data[k] === 'object' && !Array.isArray(data[k]) && !(data[k] instanceof Date);
  });

  // Primitive scalar fields
  const primitiveKeys = allKeys.filter(k => {
    return !arrayKeys.includes(k) && !nestedObjectKeys.includes(k) && !Array.isArray(data[k]);
  });

  // Sort primitive keys with important IDs and statuses at the top
  const priorityKeys = [
    'transfer_id', 'po_id', 'receipt_id', 'sale_id', 'request_id', 'invoice_id',
    'name', 'medicine_name', 'batch_number', 'status', 'stock_status', 'transfer_date',
    'expiry_date', 'total_amount', 'quantity_on_hand'
  ];

  primitiveKeys.sort((a, b) => {
    const aP = priorityKeys.indexOf(a);
    const bP = priorityKeys.indexOf(b);
    if (aP !== -1 && bP !== -1) return aP - bP;
    if (aP !== -1) return -1;
    if (bP !== -1) return 1;
    if (a === '_id' || a === 'id') return 1;
    if (b === '_id' || b === 'id') return -1;
    return a.localeCompare(b);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
      {/* 1. Main Attributes Table */}
      <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📋</span>
          <span>{title} Summary</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <tbody>
            {primitiveKeys.map((key, idx) => (
              <tr
                key={key}
                style={{
                  borderBottom: idx < primitiveKeys.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                }}
              >
                <td style={{ width: '38%', padding: '9px 16px', fontWeight: 600, color: '#475569', verticalAlign: 'middle' }}>
                  {formatLabel(key)}
                </td>
                <td style={{ width: '62%', padding: '9px 16px', color: '#0f172a', verticalAlign: 'middle' }}>
                  {renderValue(data[key], key)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. Nested Entities (e.g. Associated Pharmacy, Supplier, Supply Request) */}
      {nestedObjectKeys.map((objKey) => {
        const subObj = data[objKey];
        if (!subObj || typeof subObj !== 'object') return null;
        const subKeys = Object.keys(subObj).filter(sk => !technicalKeys.includes(sk));

        return (
          <div key={objKey} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏢</span>
              <span>Associated {formatLabel(objKey)}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <tbody>
                {subKeys.map((sk, sIdx) => (
                  <tr
                    key={sk}
                    style={{
                      borderBottom: sIdx < subKeys.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: sIdx % 2 === 0 ? '#ffffff' : '#fafafa'
                    }}
                  >
                    <td style={{ width: '38%', padding: '8px 16px', fontWeight: 600, color: '#475569', verticalAlign: 'middle' }}>
                      {formatLabel(sk)}
                    </td>
                    <td style={{ width: '62%', padding: '8px 16px', color: '#0f172a', verticalAlign: 'middle' }}>
                      {typeof subObj[sk] === 'object' && subObj[sk] !== null
                        ? (subObj[sk].name || subObj[sk].title || subObj[sk]._id || '—')
                        : renderValue(subObj[sk], sk)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* 3. Itemised Line Items (e.g. batches, items, transfer_items) */}
      {arrayKeys.map((arrKey) => {
        const arr = data[arrKey];
        if (!arr || arr.length === 0) return null;

        return (
          <div key={arrKey} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📦</span>
              <span>{formatLabel(arrKey)} ({arr.length})</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', color: '#334155' }}>
                    <th style={{ padding: '8px 12px' }}>#</th>
                    <th style={{ padding: '8px 12px' }}>Description / Item</th>
                    <th style={{ padding: '8px 12px' }}>Batch / Lot</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Quantity</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {arr.map((it, iIdx) => {
                    const itemName = it.medicine?.name || it.medicine_name || it.name || it.medicine || (typeof it === 'object' && it.item) || `Item #${iIdx + 1}`;
                    const batchNum = it.batch?.batch_number || it.batch_number || it.batch || '—';
                    const qty = it.quantity || it.quantity_received || it.quantity_requested || it.allocated_quantity || it.qty || 1;
                    const price = it.unit_price || it.price || 0;
                    const subtotal = it.subtotal || (qty * price);

                    return (
                      <tr
                        key={it._id || it.id || iIdx}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: iIdx % 2 === 0 ? '#ffffff' : '#fafafa'
                        }}
                      >
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{iIdx + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{itemName}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#0369a1' }}>{batchNum}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{qty} units</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹{price.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>₹{subtotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* 4. Optional Technical Inspector Toggle */}
      <div style={{ marginTop: '4px', textAlign: 'right' }}>
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: '11px',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {showTechnicalDetails ? '▲ Hide System Technical Keys' : '▼ View System Technical Keys (Audit/IDs)'}
        </button>
      </div>

      {showTechnicalDetails && (
        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px dashed #cbd5e1', fontSize: '11px', color: '#475569' }}>
          <div><strong>Database ID:</strong> <code>{data._id || data.id || 'N/A'}</code></div>
          {data.createdAt && <div><strong>System Created:</strong> {new Date(data.createdAt).toISOString()}</div>}
          {data.updatedAt && <div><strong>System Updated:</strong> {new Date(data.updatedAt).toISOString()}</div>}
        </div>
      )}
    </div>
  );
}
