const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const supplierReturnSchema = new mongoose.Schema(
  {
    return_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    gr_item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoodsReceiptItem',
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
      default: Date.now
    }
  },
  {
    ...schemaOptions,
    collection: 'supplier_returns'
  }
);

supplierReturnSchema.index({ return_date: -1 });

const getSupplierReturnModel = (conn) => getModel(conn, 'SupplierReturn', supplierReturnSchema);

module.exports = {
  supplierReturnSchema,
  getSupplierReturnModel
};
