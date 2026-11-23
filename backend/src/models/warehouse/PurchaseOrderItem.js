const mongoose = require('mongoose');
const { schemaOptions, getModel, createCurrencyField } = require('../commonSchema');

const purchaseOrderItemSchema = new mongoose.Schema(
  {
    po_item_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    purchase_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      required: true,
      index: true
    },
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true
    },
    quantity_ordered: {
      type: Number,
      required: [true, 'Quantity ordered is required'],
      min: [1, 'Quantity ordered must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity ordered must be an integer'
      }
    },
    unit_cost: createCurrencyField({ required: true, min: 0 })
  },
  {
    ...schemaOptions,
    collection: 'purchase_order_items'
  }
);

purchaseOrderItemSchema.index({ purchase_order: 1, medicine: 1 });

const getPurchaseOrderItemModel = (conn) => getModel(conn, 'PurchaseOrderItem', purchaseOrderItemSchema);

module.exports = {
  purchaseOrderItemSchema,
  getPurchaseOrderItemModel
};
