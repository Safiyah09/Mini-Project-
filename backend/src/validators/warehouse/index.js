/**
 * Warehouse Input Validators
 */

const validateSupplier = (body) => {
  if (!body.name || body.name.trim().length < 2) return 'Supplier name is required (min 2 characters)';
  return null;
};

const validatePurchaseOrder = (body) => {
  if (!body.supplier) return 'Supplier is required';
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return 'At least one purchase order item is required';
  }
  return null;
};

const validateGoodsReceipt = (body) => {
  if (!body.purchase_order) return 'purchase_order identifier is required';
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return 'items array is required';
  }
  return null;
};

module.exports = {
  validateSupplier,
  validatePurchaseOrder,
  validateGoodsReceipt
};
