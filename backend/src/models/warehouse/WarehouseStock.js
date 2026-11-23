const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');
const { STOCK_STATUS } = require('../../utils/constants');

const warehouseStockSchema = new mongoose.Schema(
  {
    stock_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      unique: true, // One stock record per batch in warehouse
      index: true
    },
    storage_location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StorageLocation',
      required: true,
      index: true
    },
    quantity_on_hand: {
      type: Number,
      required: true,
      min: [0, 'Quantity on hand cannot be negative'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer'
      }
    },
    quantity_reserved: {
      type: Number,
      required: true,
      min: [0, 'Quantity reserved cannot be negative'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Quantity reserved must be an integer'
      }
    },
    reorder_level: {
      type: Number,
      default: 100,
      min: [0, 'Reorder level cannot be negative']
    },
    opening_balance: {
      type: Number,
      default: 0,
      min: [0, 'Opening balance cannot be negative']
    },
    version: {
      type: Number,
      default: 0
    },
    stock_status: {
      type: String,
      enum: Object.values(STOCK_STATUS),
      default: STOCK_STATUS.AVAILABLE,
      uppercase: true
    }
  },
  {
    ...schemaOptions,
    collection: 'warehouse_stocks'
  }
);

warehouseStockSchema.index({ storage_location: 1, stock_status: 1 });

const getWarehouseStockModel = (conn) => getModel(conn, 'WarehouseStock', warehouseStockSchema);

module.exports = {
  warehouseStockSchema,
  getWarehouseStockModel
};
