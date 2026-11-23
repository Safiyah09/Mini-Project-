const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const goodsReceiptItemSchema = new mongoose.Schema(
  {
    gr_item_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    goods_receipt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoodsReceipt',
      required: true,
      index: true
    },
    po_item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrderItem',
      required: true,
      index: true
    },
    quantity_received: {
      type: Number,
      required: [true, 'Quantity received is required'],
      min: [0, 'Quantity received cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity received must be an integer'
      }
    }
  },
  {
    ...schemaOptions,
    collection: 'goods_receipt_items'
  }
);

goodsReceiptItemSchema.index({ goods_receipt: 1, po_item: 1 });

const getGoodsReceiptItemModel = (conn) => getModel(conn, 'GoodsReceiptItem', goodsReceiptItemSchema);

module.exports = {
  goodsReceiptItemSchema,
  getGoodsReceiptItemModel
};
