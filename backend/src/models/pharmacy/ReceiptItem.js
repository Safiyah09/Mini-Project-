const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const receiptItemSchema = new mongoose.Schema(
  {
    receipt_item_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    stock_receipt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockReceipt',
      required: true,
      index: true
    },
    request_item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RequestItem',
      default: null,
      index: true
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true
    },
    quantity_received: {
      type: Number,
      required: [true, 'Quantity received is required'],
      min: [0, 'Quantity received cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer'
      }
    }
  },
  {
    ...schemaOptions,
    collection: 'receipt_items'
  }
);

receiptItemSchema.index({ stock_receipt: 1, batch: 1 });

const getReceiptItemModel = (conn) => getModel(conn, 'ReceiptItem', receiptItemSchema);

module.exports = {
  receiptItemSchema,
  getReceiptItemModel
};
