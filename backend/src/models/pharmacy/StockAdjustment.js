const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const stockAdjustmentSchema = new mongoose.Schema(
  {
    adjustment_id: {
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
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: [true, 'Adjustment quantity is required'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer'
      }
    },
    reason: {
      type: String,
      required: [true, 'Adjustment reason is required'],
      trim: true
    },
    adjustment_date: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    ...schemaOptions,
    collection: 'stock_adjustments'
  }
);

stockAdjustmentSchema.index({ batch: 1, adjustment_date: -1 });

const getStockAdjustmentModel = (conn) => getModel(conn, 'StockAdjustment', stockAdjustmentSchema);

module.exports = {
  stockAdjustmentSchema,
  getStockAdjustmentModel
};
