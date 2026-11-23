const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');
const { PURCHASE_ORDER_STATUS } = require('../../utils/constants');

const purchaseOrderSchema = new mongoose.Schema(
  {
    po_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier reference is required'],
      index: true
    },
    order_date: {
      type: Date,
      default: Date.now,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(PURCHASE_ORDER_STATUS),
      default: PURCHASE_ORDER_STATUS.ORDERED,
      uppercase: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    ...schemaOptions,
    collection: 'purchase_orders'
  }
);

purchaseOrderSchema.index({ supplier: 1, order_date: -1 });
purchaseOrderSchema.index({ status: 1 });

const getPurchaseOrderModel = (conn) => getModel(conn, 'PurchaseOrder', purchaseOrderSchema);

module.exports = {
  purchaseOrderSchema,
  getPurchaseOrderModel
};
