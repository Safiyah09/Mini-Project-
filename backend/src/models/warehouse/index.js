const { getRoleModel, roleSchema } = require('./Role');
const { getUserModel, userSchema } = require('./User');
const { getSupplierModel, supplierSchema } = require('./Supplier');
const { getMedicineModel, medicineSchema } = require('./Medicine');
const { getPurchaseOrderModel, purchaseOrderSchema } = require('./PurchaseOrder');
const { getPurchaseOrderItemModel, purchaseOrderItemSchema } = require('./PurchaseOrderItem');
const { getGoodsReceiptModel, goodsReceiptSchema } = require('./GoodsReceipt');
const { getGoodsReceiptItemModel, goodsReceiptItemSchema } = require('./GoodsReceiptItem');
const { getSupplierReturnModel, supplierReturnSchema } = require('./SupplierReturn');
const { getBatchModel, batchSchema } = require('./Batch');
const { getStorageLocationModel, storageLocationSchema } = require('./StorageLocation');
const { getWarehouseStockModel, warehouseStockSchema } = require('./WarehouseStock');
const { getStockAdjustmentModel, stockAdjustmentSchema } = require('./StockAdjustment');
const { getAuditLogModel, auditLogSchema } = require('./AuditLog');
const { getPharmacyModel, pharmacySchema } = require('./Pharmacy');
const { getSupplyRequestModel, supplyRequestSchema } = require('./SupplyRequest');
const { getRequestItemModel, requestItemSchema } = require('./RequestItem');
const { getStockTransferModel, stockTransferSchema } = require('./StockTransfer');
const { getTransferItemModel, transferItemSchema } = require('./TransferItem');
const { getPharmacyReturnModel, pharmacyReturnSchema } = require('./PharmacyReturn');
const { getInvoiceModel, invoiceSchema } = require('./Invoice');
const { getPaymentModel, paymentSchema } = require('./Payment');
const { getTransactionLedgerModel, transactionLedgerSchema } = require('./TransactionLedger');
const { getOrderStatusHistoryModel, orderStatusHistorySchema } = require('./OrderStatusHistory');
const { getReceiptDiscrepancyModel, receiptDiscrepancySchema } = require('./ReceiptDiscrepancy');
const { getIdempotencyRecordModel, idempotencyRecordSchema } = require('../common/IdempotencyRecord');

/**
 * Initializes and returns all Warehouse Mongoose models for a given connection
 * @param {import('mongoose').Connection} conn
 */
function getWarehouseModels(conn) {
  return {
    Role: getRoleModel(conn),
    User: getUserModel(conn),
    Supplier: getSupplierModel(conn),
    Medicine: getMedicineModel(conn),
    PurchaseOrder: getPurchaseOrderModel(conn),
    PurchaseOrderItem: getPurchaseOrderItemModel(conn),
    GoodsReceipt: getGoodsReceiptModel(conn),
    GoodsReceiptItem: getGoodsReceiptItemModel(conn),
    SupplierReturn: getSupplierReturnModel(conn),
    Batch: getBatchModel(conn),
    StorageLocation: getStorageLocationModel(conn),
    WarehouseStock: getWarehouseStockModel(conn),
    StockAdjustment: getStockAdjustmentModel(conn),
    AuditLog: getAuditLogModel(conn),
    Pharmacy: getPharmacyModel(conn),
    SupplyRequest: getSupplyRequestModel(conn),
    RequestItem: getRequestItemModel(conn),
    StockTransfer: getStockTransferModel(conn),
    TransferItem: getTransferItemModel(conn),
    PharmacyReturn: getPharmacyReturnModel(conn),
    Invoice: getInvoiceModel(conn),
    Payment: getPaymentModel(conn),
    TransactionLedger: getTransactionLedgerModel(conn),
    OrderStatusHistory: getOrderStatusHistoryModel(conn),
    ReceiptDiscrepancy: getReceiptDiscrepancyModel(conn),
    IdempotencyRecord: getIdempotencyRecordModel(conn)
  };
}

module.exports = {
  getWarehouseModels,
  schemas: {
    roleSchema,
    userSchema,
    supplierSchema,
    medicineSchema,
    purchaseOrderSchema,
    purchaseOrderItemSchema,
    goodsReceiptSchema,
    goodsReceiptItemSchema,
    supplierReturnSchema,
    batchSchema,
    storageLocationSchema,
    warehouseStockSchema,
    stockAdjustmentSchema,
    auditLogSchema,
    pharmacySchema,
    supplyRequestSchema,
    requestItemSchema,
    stockTransferSchema,
    transferItemSchema,
    pharmacyReturnSchema,
    invoiceSchema,
    paymentSchema,
    transactionLedgerSchema,
    orderStatusHistorySchema,
    receiptDiscrepancySchema
  }
};
