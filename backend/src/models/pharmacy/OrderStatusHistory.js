const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const pharmacyOrderStatusHistorySchema = new mongoose.Schema(
  {
    history_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupplyRequest',
      required: true,
      index: true
    },
    request_id: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    from_status: {
      type: String,
      required: true,
      uppercase: true
    },
    to_status: {
      type: String,
      required: true,
      uppercase: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    username: {
      type: String,
      default: 'SYSTEM',
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    ...schemaOptions,
    collection: 'order_status_histories'
  }
);

pharmacyOrderStatusHistorySchema.index({ order_id: 1, created_at: -1 });
pharmacyOrderStatusHistorySchema.index({ request_id: 1, created_at: -1 });

const getPharmacyOrderStatusHistoryModel = (conn) => getModel(conn, 'OrderStatusHistory', pharmacyOrderStatusHistorySchema);

module.exports = {
  pharmacyOrderStatusHistorySchema,
  getOrderStatusHistoryModel: getPharmacyOrderStatusHistoryModel
};
