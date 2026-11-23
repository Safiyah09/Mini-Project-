const mongoose = require('mongoose');
const { schemaOptions, getModel, createCurrencyField, toDecimal128 } = require('../commonSchema');

const saleItemSchema = new mongoose.Schema(
  {
    sale_item_id: {
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
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity sold is required'],
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer'
      }
    },
    unit_price: createCurrencyField({ required: true, min: 0 }),
    subtotal: createCurrencyField({ required: false, min: 0 })
  },
  {
    ...schemaOptions,
    collection: 'sale_items'
  }
);

// Auto-calculate subtotal before validation if not explicitly given
saleItemSchema.pre('validate', function () {
  if (this.quantity && this.unit_price !== undefined && this.unit_price !== null) {
    const price = parseFloat(this.unit_price.toString());
    const total = this.quantity * price;
    this.subtotal = toDecimal128(total);
  }
});

saleItemSchema.index({ sale: 1, batch: 1 });

const getSaleItemModel = (conn) => getModel(conn, 'SaleItem', saleItemSchema);

module.exports = {
  saleItemSchema,
  getSaleItemModel
};
