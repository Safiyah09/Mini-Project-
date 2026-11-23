const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');
const { LEDGER_TXN_TYPES } = require('../../utils/constants');

const transactionLedgerSchema = new mongoose.Schema(
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
      enum: Object.values(LEDGER_TXN_TYPES),
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
  const err = new Error('TransactionLedger is append-only. Modifying or deleting ledger records is strictly forbidden.');
  err.statusCode = 403;
  return next(err);
};

transactionLedgerSchema.pre('save', function (next) {
  if (!this.isNew) {
    return blockMutation(next);
  }
  next();
});

transactionLedgerSchema.pre('updateOne', blockMutation);
transactionLedgerSchema.pre('updateMany', blockMutation);
transactionLedgerSchema.pre('findOneAndUpdate', blockMutation);
transactionLedgerSchema.pre('replaceOne', blockMutation);
transactionLedgerSchema.pre('deleteOne', blockMutation);
transactionLedgerSchema.pre('deleteMany', blockMutation);
transactionLedgerSchema.pre('findOneAndDelete', blockMutation);
transactionLedgerSchema.pre('findByIdAndDelete', blockMutation);

transactionLedgerSchema.index({ batch_id: 1, created_at: -1 });
transactionLedgerSchema.index({ medicine_id: 1, created_at: -1 });
transactionLedgerSchema.index({ reference_type: 1, reference_id: 1 });

const getTransactionLedgerModel = (conn) => getModel(conn, 'TransactionLedger', transactionLedgerSchema);

module.exports = {
  transactionLedgerSchema,
  getTransactionLedgerModel
};
