const mongoose = require('mongoose');
const { schemaOptions, getModel, createCurrencyField } = require('../commonSchema');
const { PAYMENT_METHODS } = require('../../utils/constants');

const paymentSchema = new mongoose.Schema(
  {
    payment_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
      index: true
    },
    method: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      required: true,
      uppercase: true
    },
    amount: createCurrencyField({ required: true, min: 0.01 }),
    payment_date: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    ...schemaOptions,
    collection: 'payments'
  }
);

paymentSchema.index({ payment_date: -1 });

const getPaymentModel = (conn) => getModel(conn, 'Payment', paymentSchema);

module.exports = {
  paymentSchema,
  getPaymentModel
};
