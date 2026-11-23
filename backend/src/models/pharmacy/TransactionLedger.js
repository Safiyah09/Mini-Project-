const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const pharmacyLedgerSchema = new mongoose.Schema(
  {
    ledger_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    txn_type: {
      type: String,
      required: true,
      uppercase: true,
      index: true
    },
    medicine_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true
    },
    batch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true
    },
    quantity_delta: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'quantity_delta must be an integer'
      }
    },
    reference_type: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    reference_id: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    notes: {
      type: String,
      trim: true
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    ...schemaOptions,
    collection: 'transaction_ledgers'
  }
);

// Append-only enforcement: prevent update and delete operations
const blockMutation = function (next) {
  const err = new Error('Pharmacy TransactionLedger is append-only. Modifying or deleting ledger records is strictly forbidden.');
  err.statusCode = 403;
  return next(err);
};

pharmacyLedgerSchema.pre('save', function (next) {
  if (!this.isNew) {
    return blockMutation(next);
  }
  next();
});

pharmacyLedgerSchema.pre('updateOne', blockMutation);
pharmacyLedgerSchema.pre('updateMany', blockMutation);
pharmacyLedgerSchema.pre('findOneAndUpdate', blockMutation);
pharmacyLedgerSchema.pre('replaceOne', blockMutation);
pharmacyLedgerSchema.pre('deleteOne', blockMutation);
pharmacyLedgerSchema.pre('deleteMany', blockMutation);
pharmacyLedgerSchema.pre('findOneAndDelete', blockMutation);
pharmacyLedgerSchema.pre('findByIdAndDelete', blockMutation);

pharmacyLedgerSchema.index({ batch_id: 1, created_at: -1 });
pharmacyLedgerSchema.index({ medicine_id: 1, created_at: -1 });
pharmacyLedgerSchema.index({ reference_type: 1, reference_id: 1 });

const getTransactionLedgerModel = (conn) => getModel(conn, 'TransactionLedger', pharmacyLedgerSchema);

module.exports = {
  pharmacyLedgerSchema,
  getTransactionLedgerModel
};
