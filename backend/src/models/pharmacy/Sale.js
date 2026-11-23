const mongoose = require('mongoose');
const { schemaOptions, getModel, createCurrencyField } = require('../commonSchema');

const saleSchema = new mongoose.Schema(
  {
    sale_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null, // Supports walk-in patients
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff user who processed the sale is required'],
      index: true
    },
    sale_date: {
      type: Date,
      default: Date.now,
      required: true
    },
    total_amount: createCurrencyField({ required: true, min: 0 }),
    notes: {
      type: String,
      trim: true
    }
  },
  {
    ...schemaOptions,
    collection: 'sales'
  }
);

saleSchema.index({ sale_date: -1 });

const getSaleModel = (conn) => getModel(conn, 'Sale', saleSchema);

module.exports = {
  saleSchema,
  getSaleModel
};
