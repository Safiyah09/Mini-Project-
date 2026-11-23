const { getRoleModel, roleSchema } = require('./Role');
const { getUserModel, userSchema } = require('./User');
const { getCustomerModel, customerSchema } = require('./Customer');
const { getMedicineModel, medicineSchema } = require('./Medicine');
const { getBatchModel, batchSchema } = require('./Batch');
const { getPharmacyStockModel, pharmacyStockSchema } = require('./PharmacyStock');
const { getStockAdjustmentModel, stockAdjustmentSchema } = require('./StockAdjustment');
const { getAlertModel, alertSchema } = require('./Alert');
const { getSaleModel, saleSchema } = require('./Sale');
const { getSaleItemModel, saleItemSchema } = require('./SaleItem');
const { getPaymentModel, paymentSchema } = require('./Payment');
const { getSalesReturnModel, salesReturnSchema } = require('./SalesReturn');
const { getSupplyRequestModel, supplyRequestSchema } = require('./SupplyRequest');
const { getRequestItemModel, requestItemSchema } = require('./RequestItem');
const { getStockReceiptModel, stockReceiptSchema } = require('./StockReceipt');
const { getReceiptItemModel, receiptItemSchema } = require('./ReceiptItem');
const { getTransactionLedgerModel, pharmacyLedgerSchema } = require('./TransactionLedger');
const { getOrderStatusHistoryModel, pharmacyOrderStatusHistorySchema } = require('./OrderStatusHistory');
const { getReceiptDiscrepancyModel, pharmacyReceiptDiscrepancySchema } = require('./ReceiptDiscrepancy');
const { getAuditLogModel, auditLogSchema } = require('./AuditLog');
const { getIdempotencyRecordModel, idempotencyRecordSchema } = require('../common/IdempotencyRecord');

/**
 * Initializes and returns all Pharmacy Mongoose models for a given connection
 * @param {import('mongoose').Connection} conn
 */
function getPharmacyModels(conn) {
  return {
    Role: getRoleModel(conn),
    User: getUserModel(conn),
    Customer: getCustomerModel(conn),
    Medicine: getMedicineModel(conn),
    Batch: getBatchModel(conn),
    PharmacyStock: getPharmacyStockModel(conn),
    StockAdjustment: getStockAdjustmentModel(conn),
    Alert: getAlertModel(conn),
    Sale: getSaleModel(conn),
    SaleItem: getSaleItemModel(conn),
    Payment: getPaymentModel(conn),
    SalesReturn: getSalesReturnModel(conn),
    SupplyRequest: getSupplyRequestModel(conn),
    RequestItem: getRequestItemModel(conn),
    StockReceipt: getStockReceiptModel(conn),
    ReceiptItem: getReceiptItemModel(conn),
    TransactionLedger: getTransactionLedgerModel(conn),
    OrderStatusHistory: getOrderStatusHistoryModel(conn),
    ReceiptDiscrepancy: getReceiptDiscrepancyModel(conn),
    AuditLog: getAuditLogModel(conn),
    IdempotencyRecord: getIdempotencyRecordModel(conn)
  };
}

module.exports = {
  getPharmacyModels,
  schemas: {
    roleSchema,
    userSchema,
    customerSchema,
    medicineSchema,
    batchSchema,
    pharmacyStockSchema,
    stockAdjustmentSchema,
    alertSchema,
    saleSchema,
    saleItemSchema,
    paymentSchema,
    salesReturnSchema,
    supplyRequestSchema,
    requestItemSchema,
    stockReceiptSchema,
    receiptItemSchema,
    pharmacyLedgerSchema,
    pharmacyOrderStatusHistorySchema,
    pharmacyReceiptDiscrepancySchema
  }
};
