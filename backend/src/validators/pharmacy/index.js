/**
 * Pharmacy Input Validators
 */

const validateCustomer = (body) => {
  if (!body.name || body.name.trim().length < 2) return 'Customer name is required';
  if (!body.phone) return 'Phone number is required';
  return null;
};

const validateSale = (body) => {
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return 'Sale must include at least one item';
  }
  return null;
};

const validateStockReceipt = (body) => {
  if (!body.transfer_id) return 'transfer_id is required';
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return 'items array is required';
  }
  return null;
};

module.exports = {
  validateCustomer,
  validateSale,
  validateStockReceipt
};
