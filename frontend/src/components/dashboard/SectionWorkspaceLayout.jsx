import React from 'react';

export default function SectionWorkspaceLayout({
  title,
  systemType = 'WAREHOUSE',
  heroIcon = '📦',
  stats = [],
  onAddNew,
  addNewLabel = '+ Create new',
  onSelectSection,
  children
}) {
  const locationLabel = systemType === 'WAREHOUSE' ? 'Central Warehouse' : 'Branch Pharmacy';

  return (
    <div className="section-workspace-wrapper">
      {/* 1. Page Heading Matching Image 1 */}
      <div className="page-heading">
        <div>
          <div className="breadcrumb">
            Workspace <span>/</span> {title}
          </div>
          <h1>{title}</h1>
          <p>Manage {title.toLowerCase()} across {locationLabel}.</p>
        </div>
        {onAddNew && (
          <div className="heading-actions">
            <button className="primary-button" onClick={onAddNew}>
              {addNewLabel}
            </button>
          </div>
        )}
      </div>

      {/* 2. Related Stats & Metrics Row for this page (Easy Reference) */}
      {stats && stats.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: '16px' }}>
          {stats.map((s, idx) => (
            <div className="stat-card" key={idx}>
              <div className={`stat-icon ${s.tone || 'blue'}`}>
                {s.icon || '📊'}
              </div>
              <div className="stat-copy">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
                <div
                  className="stat-change"
                  style={{
                    color:
                      s.tone === 'red'
                        ? '#dc2626'
                        : s.tone === 'amber'
                        ? '#d97706'
                        : '#16a34a'
                  }}
                >
                  {s.change}
                </div>
              </div>
              <div className="stat-dots">•••</div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Hero Workspace Card + Quick Actions Matching Image 1 */}
      <div className="generic-layout" style={{ marginBottom: '20px' }}>
        <div className="content-card generic-hero">
          <div className="generic-icon">{heroIcon}</div>
          <h2>{title} workspace</h2>
          <p>
            This operational module is ready for your team. Use the controls above
            to add records, review activity, and keep inventory accurate.
          </p>
          <button
            className="outline-button"
            onClick={() => {
              const tableEl = document.querySelector('.table-card');
              if (tableEl) {
                tableEl.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            Open workspace <span>→</span>
          </button>
        </div>

        <div className="content-card quick-card">
          <h2>Quick actions</h2>
          
          <button onClick={() => window.print()}>
            <span>📄</span> Export report
          </button>
          <button onClick={() => onSelectSection && onSelectSection('alerts')}>
            <span>🔔</span> Configure alerts
          </button>
        </div>
      </div>

      {/* 4. Complete Interactive DataTable (All Columns Preserved 100%) */}
      {children}
    </div>
  );
}
