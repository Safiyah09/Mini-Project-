const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const pharmacyReturnSchema = new mongoose.Schema(
  {
    return_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    transfer_item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransferItem',
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: [true, 'Return quantity is required'],
      min: [1, 'Return quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Return quantity must be an integer'
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
    collection: 'pharmacy_returns'
  }
);

pharmacyReturnSchema.index({ return_date: -1 });

const getPharmacyReturnModel = (conn) => getModel(conn, 'PharmacyReturn', pharmacyReturnSchema);

module.exports = {
  pharmacyReturnSchema,
  getPharmacyReturnModel
};
