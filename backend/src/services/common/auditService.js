/**
 * ============================================================================
 * ENGINE E4: SHARED AUDIT LOGGING SERVICE
 * ============================================================================
 * Integrates audit logging into every stock-changing transaction across both
 * central warehouse and branch pharmacies.
 * ============================================================================
 */

/**
 * Records an audit log entry in the appropriate tenant database.
 * 
 * @param {Object} models - Model registry for the active connection
 * @param {Object} params
 * @param {string|import('mongoose').Types.ObjectId} [params.user] - User ID who triggered the action
 * @param {string} params.tableName - Affected table / collection
 * @param {string} params.action - Action identifier (e.g. TRANSFER_DISPATCH, STOCK_RECEIPT, POS_SALE)
 * @param {Object} [params.details] - Structured metadata detailing the change
 * @param {import('mongoose').ClientSession} [session] - Optional transaction session
 * @returns {Promise<Object|null>} Created AuditLog document
 */
async function recordAudit(models, { user, tableName, action, details }, session = null) {
  if (!models || !models.AuditLog) {
    return null;
  }

  try {
    const logId = `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const doc = {
      log_id: logId,
      user: user || null,
      table_name: tableName,
      action: (action || 'UNKNOWN').toUpperCase(),
      logged_at: new Date(),
      details: details || {}
    };

    const created = session
      ? await models.AuditLog.create([doc], { session })
      : await models.AuditLog.create([doc]);
    return Array.isArray(created) ? created[0] : created;
  } catch (err) {
    console.warn(`[AuditService] Warning: Failed to record audit log: ${err.message}`);
    return null;
  }
}

module.exports = {
  recordAudit
};
