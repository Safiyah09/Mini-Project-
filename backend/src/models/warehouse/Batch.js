const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const batchSchema = new mongoose.Schema(
  {
    batch_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine reference is required'],
      index: true
    },
    gr_item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoodsReceiptItem',
      default: null, // Supports opening stock
      index: true
    },
    batch_number: {
      type: String,
      required: [true, 'Batch number is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    manufacturing_date: {
      type: Date,
      required: [true, 'Manufacturing date is required']
    },
    expiry_date: {
      type: Date,
      required: [true, 'Expiry date is required'],
      validate: {
        validator: function (val) {
          if (!this.manufacturing_date || !val) return true;
          return new Date(val) >= new Date(this.manufacturing_date);
        },
        message: 'Expiry date must be on or after manufacturing date'
      }
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    ...schemaOptions,
    collection: 'batches'
  }
);

batchSchema.index({ medicine: 1, expiry_date: 1 }); // Supports FEFO (First-Expired, First-Out)
batchSchema.index({ expiry_date: 1 });
batchSchema.index({ medicine: 1, batch_number: 1 }, { unique: true });

const getBatchModel = (conn) => getModel(conn, 'Batch', batchSchema);

module.exports = {
  batchSchema,
  getBatchModel
};
