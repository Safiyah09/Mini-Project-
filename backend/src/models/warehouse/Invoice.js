const mongoose = require('mongoose');
const { schemaOptions, getModel, createCurrencyField } = require('../commonSchema');
const { INVOICE_STATUS } = require('../../utils/constants');

const invoiceSchema = new mongoose.Schema(
  {
    invoice_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    stock_transfer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockTransfer',
      required: true,
      unique: true,
      index: true
    },
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUS),
      default: INVOICE_STATUS.UNPAID,
      uppercase: true
    },
    total_amount: createCurrencyField({ required: true, min: 0 }),
    invoice_date: {
      type: Date,
      default: Date.now
    }
  },
  {
    ...schemaOptions,
    collection: 'invoices'
  }
);

invoiceSchema.index({ pharmacy: 1, status: 1 });

const getInvoiceModel = (conn) => getModel(conn, 'Invoice', invoiceSchema);

module.exports = {
  invoiceSchema,
  getInvoiceModel
};
