const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');
const { SUPPLY_REQUEST_STATUS } = require('../../utils/constants');

const supplyRequestSchema = new mongoose.Schema(
  {
    request_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true
    },
    request_date: {
      type: Date,
      default: Date.now,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(SUPPLY_REQUEST_STATUS),
      default: SUPPLY_REQUEST_STATUS.PENDING,
      uppercase: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    ...schemaOptions,
    collection: 'supply_requests'
  }
);

supplyRequestSchema.index({ pharmacy: 1, request_date: -1 });
supplyRequestSchema.index({ status: 1 });

const getSupplyRequestModel = (conn) => getModel(conn, 'SupplyRequest', supplyRequestSchema);

module.exports = {
  supplyRequestSchema,
  getSupplyRequestModel
};
