import React, { useState, useMemo } from 'react';

/**
 * Deep search helper across objects, nested properties, and arrays
 */
function itemMatchesQuery(item, query, columns) {
  if (!query) return true;
  const q = query.toLowerCase().trim();

  // 1. Check custom column accessors and keys
  for (const col of columns) {
    if (col.accessor) {
      try {
        const val = col.accessor(item);
        if (val !== undefined && val !== null && String(val).toLowerCase().includes(q)) {
          return true;
        }
      } catch {}
    }
    if (col.key && item[col.key] !== undefined && item[col.key] !== null) {
      const val = item[col.key];
      if (typeof val === 'string' || typeof val === 'number') {
        if (String(val).toLowerCase().includes(q)) return true;
      } else if (typeof val === 'object' && val !== null) {
        if (val.name && String(val.name).toLowerCase().includes(q)) return true;
        if (val.batch_number && String(val.batch_number).toLowerCase().includes(q)) return true;
        if (val.pharmacy_id && String(val.pharmacy_id).toLowerCase().includes(q)) return true;
        if (val.transfer_id && String(val.transfer_id).toLowerCase().includes(q)) return true;
        if (val.invoice_id && String(val.invoice_id).toLowerCase().includes(q)) return true;
      }
    }
  }

  // 2. Deep recursive fallback across the entire item
  const deepCheck = (val, depth = 0) => {
    if (depth > 4 || val === null || val === undefined) return false;
    if (typeof val === 'string' || typeof val === 'number') {
      return String(val).toLowerCase().includes(q);
    }
    if (Array.isArray(val)) {
      return val.some((el) => deepCheck(el, depth + 1));
    }
    if (typeof val === 'object') {
      return Object.values(val).some((v) => deepCheck(v, depth + 1));
    }
    return false;
  };

  return deepCheck(item);
}

/**
 * Extract sortable primitive from an item given a column key or accessor
 */
function getSortValue(item, sortKey, columns) {
  if (!item) return '';

  const col = columns.find((c) => c.key === sortKey);
  if (col && col.accessor) {
    try {
      const val = col.accessor(item);
      if (val !== undefined && val !== null) return val;
    } catch {}
  }

  const val = item[sortKey];
  if (val === undefined || val === null) return '';

  if (typeof val === 'object' && !Array.isArray(val)) {
    return val.name || val.batch_number || val.transfer_id || val.invoice_id || val.id || '';
  }

  return val;
}

export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  searchPlaceholder = 'Search records by name, ID, batch, status...',
  filterOptions = [],
  sortOptions = [],
  onAddNew,
  addNewLabel = 'Add New',
  emptyTitle = 'No Records Found',
  emptyDesc = 'There are no records matching your current filter criteria.',
  pageSize: initialPageSize = 10
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [sortField, setSortField] = useState(sortOptions[0]?.value || columns[0]?.key || '');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Auto-generate filter dropdowns for common categorical columns if not explicitly passed
  const effectiveFilterOptions = useMemo(() => {
    if (filterOptions && filterOptions.length > 0) return filterOptions;

    // Detect categorical columns in data
    const candidateKeys = ['status', 'stock_status', 'category', 'formulation', 'severity', 'payment_method', 'type'];
    const detected = [];

    candidateKeys.forEach((key) => {
      const col = columns.find((c) => c.key === key || (c.header && c.header.toLowerCase().includes(key)));
      const actualKey = col?.key || key;

      if (Array.isArray(data) && data.length > 0) {
        const uniqueValues = new Set();
        data.forEach((row) => {
          const val = row[actualKey] || (typeof row[key] === 'string' ? row[key] : null);
          if (val && typeof val === 'string') uniqueValues.add(val.toUpperCase().trim());
        });

        if (uniqueValues.size >= 2 && uniqueValues.size <= 15) {
          detected.push({
            key: actualKey,
            label: col?.header || key.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            options: Array.from(uniqueValues).map((v) => ({ label: v, value: v }))
          });
        }
      }
    });

    return detected;
  }, [filterOptions, columns, data]);

  // Handle header sort click
  const handleHeaderSort = (colKey) => {
    if (!colKey || colKey === 'actions' || colKey === 'act') return;
    if (sortField === colKey) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(colKey);
      setSortOrder('asc');
    }
  };

  // Handle filter dropdown changes
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({});
    setSortField(sortOptions[0]?.value || columns[0]?.key || '');
    setSortOrder('asc');
    setCurrentPage(1);
  };

  // Filtering pipeline
  const filteredData = useMemo(() => {
    if (!Array.isArray(data)) return [];

    return data.filter((item) => {
      // 1. Text Search across columns and deep item attributes
      if (searchTerm.trim()) {
        if (!itemMatchesQuery(item, searchTerm, columns)) return false;
      }

      // 2. Dropdown Filters
      for (const [key, value] of Object.entries(filters)) {
        if (!value || value === 'ALL') continue;
        const itemVal = item[key];
        if (itemVal === undefined || itemVal === null) {
          // Check nested property
          const col = columns.find((c) => c.key === key);
          if (col && col.accessor) {
            const accVal = col.accessor(item);
            if (String(accVal).toUpperCase() !== String(value).toUpperCase()) return false;
            continue;
          }
          return false;
        }
        if (String(itemVal).toUpperCase() !== String(value).toUpperCase()) return false;
      }

      return true;
    });
  }, [data, searchTerm, filters, columns]);

  // Sorting pipeline
  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;

    return [...filteredData].sort((a, b) => {
      let valA = getSortValue(a, sortField, columns);
      let valB = getSortValue(b, sortField, columns);

      // Handle numbers
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // Handle date strings
      if (
        (valA instanceof Date || (typeof valA === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valA))) &&
        (valB instanceof Date || (typeof valB === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valB)))
      ) {
        const timeA = new Date(valA).getTime();
        const timeB = new Date(valB).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      // Handle currency strings like ₹1,200
      const cleanA = typeof valA === 'string' ? valA.replace(/[₹,]/g, '').trim() : '';
      const cleanB = typeof valB === 'string' ? valB.replace(/[₹,]/g, '').trim() : '';
      if (cleanA && cleanB && !isNaN(cleanA) && !isNaN(cleanB)) {
        return sortOrder === 'asc' ? Number(cleanA) - Number(cleanB) : Number(cleanB) - Number(cleanA);
      }

      // Fallback string compare
      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();

      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortField, sortOrder, columns]);

  // Pagination calculation
  const totalRecords = sortedData.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const isFiltered = searchTerm.trim() !== '' || Object.values(filters).some((v) => v && v !== 'ALL');

  return (
    <div className="table-card">
      {/* Search, Filter, Sort Toolbar */}
      <div className="table-toolbar">
        <div className="toolbar-row" style={{ flexWrap: 'wrap', gap: '10px' }}>
          {/* Search Bar */}
          <div className="search-input-wrapper" style={{ minWidth: '260px', flex: '1 1 300px' }}>
            <span className="search-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters & Sorting */}
          <div className="filters-wrapper" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {effectiveFilterOptions.map((f) => (
              <select
                key={f.key}
                className="filter-select"
                value={filters[f.key] || 'ALL'}
                onChange={(e) => handleFilterChange(f.key, e.target.value)}
                style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '6px' }}
              >
                <option value="ALL">{f.label}: All</option>
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ))}

            {/* Sort Dropdown */}
            {sortOptions.length > 0 && (
              <select
                className="sort-select"
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '6px' }}
              >
                {sortOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    Sort by: {s.label}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Order Toggle */}
            {sortField && (
              <button
                type="button"
                className="action-icon-btn"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                title={`Order: ${sortOrder === 'asc' ? 'Ascending (click for Descending)' : 'Descending (click for Ascending)'}`}
                style={{ padding: '6px 10px', fontSize: '12px', background: '#f8fafc' }}
              >
                {sortOrder === 'asc' ? '▲ Asc' : '▼ Desc'}
              </button>
            )}

            {/* Page Size Selector */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              title="Rows per page"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            {isFiltered && (
              <button type="button" className="clear-btn" onClick={handleClearFilters} style={{ padding: '6px 12px' }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Clear
              </button>
            )}

            {onAddNew && (
              <button type="button" className="action-add-btn" onClick={onAddNew}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {addNewLabel}
              </button>
            )}
          </div>
        </div>

        {/* Results Metadata */}
        <div className="results-meta">
          <span>
            Showing {totalRecords === 0 ? 0 : startIndex + 1} &ndash; {Math.min(startIndex + pageSize, totalRecords)} of {totalRecords} records
            {data.length !== totalRecords && ` (filtered from ${data.length} total)`}
          </span>
          <span>Page {currentPage} of {totalPages}</span>
        </div>
      </div>

      {/* Table Element */}
      <div className="table-responsive">
        {loading ? (
          <div className="empty-state">
            <div className="btn-spinner" style={{ width: '28px', height: '28px', borderColor: 'var(--teal-primary)', borderTopColor: 'transparent' }}></div>
            <div className="empty-title">Loading live data from MongoDB Atlas...</div>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="empty-title">{emptyTitle}</div>
            <div className="empty-desc">{emptyDesc}</div>
            {isFiltered && (
              <button className="clear-btn" onClick={handleClearFilters}>
                Reset all filters
              </button>
            )}
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                {columns.map((col) => {
                  const isSortable = col.key && col.key !== 'actions' && col.key !== 'act';
                  const isSorted = sortField === col.key;
                  return (
                    <th
                      key={col.key || col.header}
                      style={{
                        width: col.width || 'auto',
                        cursor: isSortable ? 'pointer' : 'default',
                        userSelect: 'none'
                      }}
                      onClick={() => isSortable && handleHeaderSort(col.key)}
                      title={isSortable ? `Click to sort by ${col.header}` : undefined}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span>{col.header}</span>
                        {isSortable && (
                          <span style={{ fontSize: '10px', color: isSorted ? '#0f172a' : '#cbd5e1' }}>
                            {isSorted ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, idx) => (
                <tr key={row._id || row.id || idx}>
                  {columns.map((col) => (
                    <td key={col.key || col.header}>
                      {col.render ? col.render(row) : (col.accessor ? col.accessor(row) : row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination-wrapper">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="pagination-controls">
            <button
              className="page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              title="First Page"
            >
              &laquo;
            </button>
            <button
              className="page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title="Previous Page"
            >
              &lsaquo; Prev
            </button>

            {[...Array(totalPages)].map((_, i) => {
              const pNum = i + 1;
              if (pNum === 1 || pNum === totalPages || (pNum >= currentPage - 1 && pNum <= currentPage + 1)) {
                return (
                  <button
                    key={pNum}
                    className={`page-btn ${currentPage === pNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pNum)}
                  >
                    {pNum}
                  </button>
                );
              }
              if (pNum === currentPage - 2 || pNum === currentPage + 2) {
                return <span key={pNum} style={{ padding: '0 4px', color: '#94a3b8' }}>&hellip;</span>;
              }
              return null;
            })}

            <button
              className="page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title="Next Page"
            >
              Next &rsaquo;
            </button>
            <button
              className="page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="Last Page"
            >
              &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
