const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const idempotencyRecordSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true
    },
    endpoint: {
      type: String,
      required: true,
      trim: true
    },
    method: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    request_hash: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PROCESSING',
      index: true
    },
    response_status: {
      type: Number,
      default: null
    },
    response_body: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    created_at: {
      type: Date,
      default: Date.now,
      expires: 604800 // Auto-expire after 7 days (60 * 60 * 24 * 7)
    }
  },
  {
    ...schemaOptions,
    collection: 'idempotency_records'
  }
);

idempotencyRecordSchema.index({ key: 1, endpoint: 1 }, { unique: true });
idempotencyRecordSchema.index({ key: 1, request_hash: 1 });

const getIdempotencyRecordModel = (conn) => {
  const model = getModel(conn, 'IdempotencyRecord', idempotencyRecordSchema);
  // Safely drop obsolete legacy key_1 index if it existed previously
  if (conn && conn.collection) {
    conn.collection('idempotency_records').dropIndex('key_1').catch(() => {});
  }
  return model;
};

module.exports = {
  idempotencyRecordSchema,
  getIdempotencyRecordModel
};
