const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');
const { STOCK_RECEIPT_STATUS } = require('../../utils/constants');

const stockReceiptSchema = new mongoose.Schema(
  {
    receipt_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    supply_request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupplyRequest',
      required: false,
      index: true
    },
    transfer_id: {
      type: String,
      required: [true, 'Warehouse Transfer Reference ID is required'],
      trim: true,
      index: true // External reference from Warehouse system!
    },
    received_date: {
      type: Date,
      default: Date.now,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(STOCK_RECEIPT_STATUS),
      default: STOCK_RECEIPT_STATUS.PENDING,
      uppercase: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    ...schemaOptions,
    collection: 'stock_receipts'
  }
);

stockReceiptSchema.index({ received_date: -1 });

const getStockReceiptModel = (conn) => getModel(conn, 'StockReceipt', stockReceiptSchema);

module.exports = {
  stockReceiptSchema,
  getStockReceiptModel
};
