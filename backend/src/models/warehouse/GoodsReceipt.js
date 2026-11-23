const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');
const { GOODS_RECEIPT_STATUS } = require('../../utils/constants');

const goodsReceiptSchema = new mongoose.Schema(
  {
    receipt_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    purchase_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      required: true,
      index: true
    },
    received_date: {
      type: Date,
      default: Date.now,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(GOODS_RECEIPT_STATUS),
      default: GOODS_RECEIPT_STATUS.PENDING,
      uppercase: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    ...schemaOptions,
    collection: 'goods_receipts'
  }
);

goodsReceiptSchema.index({ received_date: -1 });

const getGoodsReceiptModel = (conn) => getModel(conn, 'GoodsReceipt', goodsReceiptSchema);

module.exports = {
  goodsReceiptSchema,
  getGoodsReceiptModel
};
