const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');
const { STOCK_TRANSFER_STATUS } = require('../../utils/constants');

const stockTransferSchema = new mongoose.Schema(
  {
    transfer_id: {
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
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true
    },
    transfer_date: {
      type: Date,
      default: Date.now,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(STOCK_TRANSFER_STATUS),
      default: STOCK_TRANSFER_STATUS.PENDING,
      uppercase: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    ...schemaOptions,
    collection: 'stock_transfers'
  }
);

stockTransferSchema.index({ pharmacy: 1, transfer_date: -1 });
stockTransferSchema.index({ status: 1 });

const getStockTransferModel = (conn) => getModel(conn, 'StockTransfer', stockTransferSchema);

module.exports = {
  stockTransferSchema,
  getStockTransferModel
};
