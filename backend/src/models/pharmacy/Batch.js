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

batchSchema.index({ medicine: 1, expiry_date: 1 }); // Supports FEFO
batchSchema.index({ expiry_date: 1 });

const getBatchModel = (conn) => getModel(conn, 'Batch', batchSchema);

module.exports = {
  batchSchema,
  getBatchModel
};
