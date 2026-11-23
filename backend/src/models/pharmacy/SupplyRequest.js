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
    request_date: {
      type: Date,
      default: Date.now,
      required: true
    },
    submitted_date: {
      type: Date,
      default: null
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
    },
    from_alert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
      default: null,
      index: true
    }
  },
  {
    ...schemaOptions,
    collection: 'supply_requests'
  }
);

supplyRequestSchema.index({ request_date: -1 });
supplyRequestSchema.index({ status: 1 });

const getSupplyRequestModel = (conn) => getModel(conn, 'SupplyRequest', supplyRequestSchema);

module.exports = {
  supplyRequestSchema,
  getSupplyRequestModel
};
