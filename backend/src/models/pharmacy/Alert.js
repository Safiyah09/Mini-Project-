const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');
const { ALERT_TYPES } = require('../../utils/constants');

const alertSchema = new mongoose.Schema(
  {
    alert_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: false,
      index: true
    },
    alert_type: {
      type: String,
      enum: Object.values(ALERT_TYPES),
      required: true,
      uppercase: true,
      index: true
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true
    },
    message: {
      type: String,
      trim: true
    }
  },
  {
    ...schemaOptions,
    collection: 'alerts'
  }
);

alertSchema.index({ medicine: 1, resolved: 1 });

const getAlertModel = (conn) => getModel(conn, 'Alert', alertSchema);

module.exports = {
  alertSchema,
  getAlertModel
};
