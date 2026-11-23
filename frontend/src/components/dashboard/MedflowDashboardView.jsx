import React from 'react';

export default function MedflowDashboardView({
  user,
  systemType = 'WAREHOUSE',
  stats,
  onSelectSection,
  children
}) {
  const [showDateMenu, setShowDateMenu] = React.useState(false);
  const [dateRange, setDateRange] = React.useState('today');
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const userName = user?.name || user?.username || 'Alex';
  const locationText = systemType === 'WAREHOUSE' ? 'central warehouse' : 'branch pharmacy';

  return (
    <div className="medflow-dashboard-wrapper">
      {/* 1. Header Matching Image 2 (NO Add Medicine button!) */}
      <div className="page-heading">
        <div>
          <div className="breadcrumb">
            Overview <span>/</span> Dashboard
          </div>
          <h1>
            Good morning, {userName} <span className="wave">✦</span>
          </h1>
          <p>Here's what's happening across {locationText} today.</p>
        </div>
        <div className="heading-actions">
          <div style={{ position: 'relative' }}>
            <button className="outline-button" onClick={() => setShowDateMenu(prev => !prev)}>
              <span>📅</span> {dateRange === 'today' ? currentDate : dateRange === 'week' ? 'This Week' : dateRange === 'month' ? 'This Month' : currentDate} <span>⌵</span>
            </button>
            {showDateMenu && (
              <div style={{ position: 'absolute', top: '42px', right: 0, background: '#fff', border: '1px solid #e8edf2', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '8px', minWidth: '160px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  { key: 'today', label: '📅 Today' },
                  { key: 'week', label: '📆 This Week' },
                  { key: 'month', label: '🗓️ This Month' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    style={{ background: dateRange === opt.key ? '#fee2e2' : 'transparent', border: 'none', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer', textAlign: 'left', fontSize: '12px', fontWeight: dateRange === opt.key ? 700 : 400, color: '#18212f' }}
                    onClick={() => { setDateRange(opt.key); setShowDateMenu(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* NOTICE: "+ Add medicine" button has been intentionally REMOVED per user instruction! */}
        </div>
      </div>

      {/* 2. 4 Stat Cards in a row Matching Image 2 */}
      <div className="stat-grid" style={{ marginBottom: '16px' }}>
        <div className="stat-card">
          <div className="stat-icon blue">📦</div>
          <div className="stat-copy">
            <div className="stat-label">Total stock units</div>
            <div className="stat-value">
              {(stats?.totalWarehouseStock ?? stats?.totalShelfStock ?? 248620).toLocaleString()}
            </div>
            <div className="stat-change">+8.2% vs last month</div>
          </div>
          <div className="stat-dots">•••</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">🚚</div>
          <div className="stat-copy">
            <div className="stat-label">
              {systemType === 'WAREHOUSE' ? 'Pending dispatches' : 'Today’s sales'}
            </div>
            <div className="stat-value">
              {stats?.pendingRequests ?? stats?.todaySales ?? 18}
            </div>
            <div className="stat-change" style={{ color: '#2563eb' }}>
              {systemType === 'WAREHOUSE' ? '6 due today' : '+12.4% vs yesterday'}
            </div>
          </div>
          <div className="stat-dots">•••</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">⚠️</div>
          <div className="stat-copy">
            <div className="stat-label">Low-stock items</div>
            <div className="stat-value" style={{ color: '#dc2626' }}>
              {stats?.lowStockMedicines ?? 24}
            </div>
            <div className="stat-change" style={{ color: '#dc2626' }}>
              8 need attention
            </div>
          </div>
          <div className="stat-dots">•••</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">⏳</div>
          <div className="stat-copy">
            <div className="stat-label">Near expiry</div>
            <div className="stat-value" style={{ color: '#d97706' }}>
              {stats?.nearExpiryBatches ?? 12}
            </div>
            <div className="stat-change" style={{ color: '#d97706' }}>
              Within 90 days
            </div>
          </div>
          <div className="stat-dots">•••</div>
        </div>
      </div>

      {/* 3. 2-Column Visual Grid Matching Image 2 */}
      <div className="dashboard-grid" style={{ marginBottom: '20px' }}>
        {/* Left Card: Inventory Overview with SVG Wave Line Chart */}
        <section className="content-card inventory-card">
          <div className="card-heading">
            <div>
              <h2>Inventory overview</h2>
              <p>Monitor your medicine stock levels and status.</p>
            </div>
            <button className="text-button" onClick={() => onSelectSection && onSelectSection('inventory')}>
              View all <span>→</span>
            </button>
          </div>

          <div className="mini-chart">
            <div className="chart-y">
              <span>300k</span>
              <span>200k</span>
              <span>100k</span>
              <span>0</span>
            </div>
            <div className="chart-area">
              <div className="grid-lines">
                <i /><i /><i /><i />
              </div>
              <svg viewBox="0 0 600 150" preserveAspectRatio="none" aria-label="Inventory stock trend">
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#dc2626" stopOpacity="0.22" />
                    <stop offset="1" stopColor="#dc2626" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 115 C40 110, 55 90, 90 96 S145 80, 175 87 S220 58, 255 72 S300 54, 340 66 S380 48, 415 59 S455 35, 490 47 S545 26, 600 32 L600 150 L0 150Z"
                  fill="url(#chartFill)"
                />
                <path
                  d="M0 115 C40 110, 55 90, 90 96 S145 80, 175 87 S220 58, 255 72 S300 54, 340 66 S380 48, 415 59 S455 35, 490 47 S545 26, 600 32"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="3"
                />
              </svg>
              <div className="chart-x">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
              </div>
            </div>
          </div>

          <div className="chart-legend">
            <span><i className="legend-dot red" /> Current stock</span>
            <span><i className="legend-dot gray" /> Reorder level</span>
            <span className="legend-total">
              {(stats?.totalWarehouseStock ?? 248620).toLocaleString()} units
            </span>
          </div>
        </section>

        {/* Right Card: Needs Attention Alert Box */}
        <section className="content-card alert-card">
          <div className="card-heading">
            <div>
              <h2>Needs attention</h2>
              <p>Items requiring your review.</p>
            </div>
            <button
              className="icon-button"
              onClick={() => onSelectSection && onSelectSection('alerts')}
              title="View Alerts"
            >
              🔔
            </button>
          </div>

          <div className="alert-list">
            <div
              className="alert-row"
              onClick={() => onSelectSection && onSelectSection('alerts')}
              style={{ cursor: 'pointer' }}
            >
              <span className="alert-symbol red-bg">⚠️</span>
              <div>
                <strong>{stats?.lowStockMedicines ?? 8} low-stock medicines</strong>
                <small>Below safety reorder level</small>
              </div>
              <span className="alert-arrow">›</span>
            </div>

            <div
              className="alert-row"
              onClick={() => onSelectSection && onSelectSection('batches')}
              style={{ cursor: 'pointer' }}
            >
              <span className="alert-symbol amber-bg">⏳</span>
              <div>
                <strong>{stats?.nearExpiryBatches ?? 12} batches near expiry</strong>
                <small>Expiring within 90 days (FEFO)</small>
              </div>
              <span className="alert-arrow">›</span>
            </div>

            <div
              className="alert-row"
              onClick={() => onSelectSection && onSelectSection('supply_requests')}
              style={{ cursor: 'pointer' }}
            >
              <span className="alert-symbol blue-bg">📥</span>
              <div>
                <strong>{stats?.pendingRequests ?? 6} pending orders</strong>
                <small>Awaiting dispatch &amp; allocation</small>
              </div>
              <span className="alert-arrow">›</span>
            </div>
          </div>

          <button className="view-alerts" onClick={() => onSelectSection && onSelectSection('alerts')}>
            View all alerts <span>→</span>
          </button>
        </section>
      </div>

      {/* 4. Live Data Table (All columns preserved 100%) */}
      {children}
    </div>
  );
}
