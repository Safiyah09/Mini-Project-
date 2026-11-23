const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const auditLogSchema = new mongoose.Schema(
  {
    log_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    table_name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    logged_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    ...schemaOptions,
    collection: 'audit_logs'
  }
);

auditLogSchema.index({ table_name: 1, logged_at: -1 });

const getAuditLogModel = (conn) => getModel(conn, 'AuditLog', auditLogSchema);

module.exports = {
  auditLogSchema,
  getAuditLogModel
};
