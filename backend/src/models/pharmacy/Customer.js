const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const customerSchema = new mongoose.Schema(
  {
    customer_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    address: {
      type: String,
      trim: true
    },
    date_of_birth: {
      type: Date
    },
    registered_date: {
      type: Date,
      default: Date.now
    }
  },
  {
    ...schemaOptions,
    collection: 'customers'
  }
);

customerSchema.index({ name: 1 });

const getCustomerModel = (conn) => getModel(conn, 'Customer', customerSchema);

module.exports = {
  customerSchema,
  getCustomerModel
};
