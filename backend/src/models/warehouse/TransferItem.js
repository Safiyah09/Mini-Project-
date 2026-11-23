const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const transferItemSchema = new mongoose.Schema(
  {
    transfer_item_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    stock_transfer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockTransfer',
      required: true,
      index: true
    },
    request_item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RequestItem',
      required: true,
      index: true
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true
    },
    quantity_allocated: {
      type: Number,
      required: true,
      min: [0, 'Quantity allocated cannot be negative'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Quantity allocated must be an integer'
      }
    },
    quantity_dispatched: {
      type: Number,
      required: true,
      min: [0, 'Quantity dispatched cannot be negative'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Quantity dispatched must be an integer'
      }
    }
  },
  {
    ...schemaOptions,
    collection: 'transfer_items'
  }
);

transferItemSchema.index({ stock_transfer: 1, batch: 1 });

const getTransferItemModel = (conn) => getModel(conn, 'TransferItem', transferItemSchema);

module.exports = {
  transferItemSchema,
  getTransferItemModel
};
