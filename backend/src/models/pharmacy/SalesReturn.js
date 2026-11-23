const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const salesReturnSchema = new mongoose.Schema(
  {
    return_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    sale_item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleItem',
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: [true, 'Return quantity is required'],
      min: [1, 'Return quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer'
      }
    },
    reason: {
      type: String,
      required: [true, 'Return reason is required'],
      trim: true
    },
    return_date: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    ...schemaOptions,
    collection: 'sales_returns'
  }
);

salesReturnSchema.index({ return_date: -1 });

const getSalesReturnModel = (conn) => getModel(conn, 'SalesReturn', salesReturnSchema);

module.exports = {
  salesReturnSchema,
  getSalesReturnModel
};
