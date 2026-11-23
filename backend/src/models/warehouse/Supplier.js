const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const supplierSchema = new mongoose.Schema(
  {
    supplier_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      minlength: 2,
      maxlength: 150
    },
    address: {
      type: String,
      required: [true, 'Supplier address is required'],
      trim: true
    },
    contact: {
      type: String,
      required: [true, 'Supplier contact details are required'],
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    ...schemaOptions,
    collection: 'suppliers'
  }
);

supplierSchema.index({ name: 1 });

const getSupplierModel = (conn) => getModel(conn, 'Supplier', supplierSchema);

module.exports = {
  supplierSchema,
  getSupplierModel
};
