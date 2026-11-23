const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const requestItemSchema = new mongoose.Schema(
  {
    request_item_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    supply_request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupplyRequest',
      required: true,
      index: true
    },
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true
    },
    quantity_requested: {
      type: Number,
      required: [true, 'Quantity requested is required'],
      min: [1, 'Quantity requested must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer'
      }
    },
    quantity_fulfilled: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'quantity_fulfilled must be an integer'
      }
    },
    quantity_pending: {
      type: Number,
      default: function () {
        return this.quantity_requested;
      },
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'quantity_pending must be an integer'
      }
    },
    is_backordered: {
      type: Boolean,
      default: false
    }
  },
  {
    ...schemaOptions,
    collection: 'request_items'
  }
);

requestItemSchema.index({ supply_request: 1, medicine: 1 });

const getRequestItemModel = (conn) => getModel(conn, 'RequestItem', requestItemSchema);

module.exports = {
  requestItemSchema,
  getRequestItemModel
};
