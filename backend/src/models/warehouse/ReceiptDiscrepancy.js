const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');
const { DISCREPANCY_TYPES } = require('../../utils/constants');

const receiptDiscrepancySchema = new mongoose.Schema(
  {
    discrepancy_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    receipt_id: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    transfer_id: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    order_id: {
      type: String,
      default: null,
      trim: true,
      index: true
    },
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      default: null,
      index: true
    },
    pharmacy_id: {
      type: String,
      default: null,
      trim: true,
      index: true
    },
    batch_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    expected_quantity: {
      type: Number,
      required: true,
      min: 0
    },
    received_quantity: {
      type: Number,
      required: true,
      min: 0
    },
    discrepancy_type: {
      type: String,
      enum: Object.values(DISCREPANCY_TYPES),
      required: true,
      uppercase: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    ...schemaOptions,
    collection: 'receipt_discrepancies'
  }
);

receiptDiscrepancySchema.index({ transfer_id: 1, created_at: -1 });
receiptDiscrepancySchema.index({ pharmacy_id: 1, resolved: 1 });

const getReceiptDiscrepancyModel = (conn) => getModel(conn, 'ReceiptDiscrepancy', receiptDiscrepancySchema);

module.exports = {
  receiptDiscrepancySchema,
  getReceiptDiscrepancyModel
};
